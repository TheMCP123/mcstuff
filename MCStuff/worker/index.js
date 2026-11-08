import { normalizeUuid, validUsername } from '../public/checker-data.js';

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
}

async function upstream(url, fetcher, ttl = 0) {
  let response;
  try {
    response = await fetcher(url, { headers: { Accept: 'application/json, image/png' }, redirect: 'manual', signal: AbortSignal.timeout(8000), ...(ttl ? { cf: { cacheTtl: ttl, cacheEverything: true } } : { cache: 'no-store' }) });
  } catch { throw new ApiError(503, 'upstream_unavailable', 'Mojang could not be reached. Try again shortly.'); }
  if (response.status === 429) throw new ApiError(429, 'rate_limited', 'Mojang is rate limiting lookups. Wait a minute and try again.');
  if (response.status === 404 || response.status === 204) return null;
  if (!response.ok) throw new ApiError(502, 'upstream_error', 'Mojang could not complete this lookup. Try again shortly.');
  return response;
}

async function readJson(response) {
  try {
    const text = await response.text();
    if (text.length > 65536) throw new Error('Response too large');
    return JSON.parse(text);
  } catch { throw new ApiError(502, 'invalid_response', 'Mojang returned an invalid response. Try again shortly.'); }
}

function profileIdentity(data, expectedId) {
  const id = normalizeUuid(data?.id);
  if (!id || !validUsername(data?.name) || (expectedId && id !== expectedId)) throw new ApiError(502, 'invalid_response', 'Mojang returned an invalid player profile.');
  return { id, name: data.name };
}

async function nameLookup(name, fetcher) {
  const response = await upstream(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`, fetcher);
  return response ? profileIdentity(await readJson(response)) : null;
}

function skinFromProfile(data) {
  const property = data.properties?.find(item => item.name === 'textures');
  if (!property) return null;
  try {
    if (typeof property.value !== 'string' || property.value.length > 32768) throw new Error('Bad textures');
    const textures = JSON.parse(atob(property.value)).textures;
    if (!textures || !textures.SKIN) return null;
    const url = new URL(textures.SKIN.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'textures.minecraft.net' || url.port || url.username || url.password || url.search || url.hash || !/^\/texture\/[a-f\d]{64}$/i.test(url.pathname)) throw new Error('Bad texture URL');
    const hash = url.pathname.split('/').at(-1).toLowerCase();
    return { hash, url: `/api/skin/${hash}`, model: textures.SKIN.metadata?.model === 'slim' ? 'Slim' : 'Classic' };
  } catch { throw new ApiError(502, 'invalid_skin', 'Mojang returned an invalid skin texture.'); }
}

export async function handleApi(request, fetcher = fetch) {
  const url = new URL(request.url);
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  let response;
  try {
    const match = /^\/api\/(player|uuid|ign|skin)\/([^/]+)$/.exec(url.pathname);
    if (!match) throw new ApiError(404, 'not_found', 'API route not found.');
    let value;
    try { value = decodeURIComponent(match[2]).trim(); } catch { throw new ApiError(400, 'invalid_input', 'Enter a valid username or UUID.'); }
    const kind = match[1];
    if (kind === 'skin') {
      if (!/^[a-f\d]{64}$/i.test(value)) throw new ApiError(400, 'invalid_texture', 'Invalid skin texture.');
      const texture = await upstream(`https://textures.minecraft.net/texture/${value.toLowerCase()}`, fetcher, 86400);
      if (!texture) throw new ApiError(404, 'skin_not_found', 'This skin texture was not found.');
      if (Number(texture.headers.get('content-length')) > 1048576) throw new ApiError(502, 'invalid_skin', 'The skin texture is too large.');
      const bytes = new Uint8Array(await texture.arrayBuffer());
      if (bytes.length > 1048576 || bytes.length < 24 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) throw new ApiError(502, 'invalid_skin', 'The skin texture is not a valid PNG.');
      response = new Response(bytes, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } });
    } else if (kind === 'uuid') {
      if (!validUsername(value)) throw new ApiError(400, 'invalid_name', 'Use 1–16 letters, numbers or underscores.');
      const profile = await nameLookup(value, fetcher);
      if (!profile) throw new ApiError(404, 'player_not_found', 'No public Java profile was found for this username.');
      response = json(profile);
    } else if (kind === 'ign') {
      if (!validUsername(value, 3)) throw new ApiError(400, 'invalid_name', 'Use 3–16 letters, numbers or underscores.');
      const profile = await nameLookup(value, fetcher);
      response = json({ name: value, registered: Boolean(profile), profile, checkedAt: new Date().toISOString() });
    } else {
      let id = normalizeUuid(value);
      if (!id) {
        if (!validUsername(value)) throw new ApiError(400, 'invalid_input', 'Enter a Java username or a valid UUID.');
        const identity = await nameLookup(value, fetcher);
        if (!identity) throw new ApiError(404, 'player_not_found', 'No public Java profile was found for this username.');
        id = identity.id;
      }
      const session = await upstream(`https://sessionserver.mojang.com/session/minecraft/profile/${id.replaceAll('-', '')}`, fetcher, 60);
      if (!session) throw new ApiError(404, 'player_not_found', 'No public Java profile was found for this UUID.');
      const data = await readJson(session);
      response = json({ ...profileIdentity(data, id), skin: skinFromProfile(data), checkedAt: new Date().toISOString() });
    }
  } catch (error) {
    response = error instanceof ApiError ? json({ error: error.code, message: error.message }, error.status) : json({ error: 'lookup_failed', message: 'The lookup could not be completed. Try again shortly.' }, 502);
  }
  return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
}

export default {
  fetch(request, env) {
    const path = new URL(request.url).pathname;
    return path === '/api' || path.startsWith('/api/') ? handleApi(request) : env.ASSETS.fetch(request);
  },
};
