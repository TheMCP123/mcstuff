import { normalizeUuid, validUsername } from '../public/checker-data.js';

class ApiError extends Error {
  constructor(status, code, message, details = {}) { super(message); this.status = status; this.code = code; this.details = details; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
}

async function upstream(url, fetcher, ttl = 0) {
  let response;
  try {
    const accept = new URL(url).hostname === 'textures.minecraft.net' ? 'image/png' : 'application/json';
    response = await fetcher(url, { headers: { Accept: accept, 'User-Agent': 'MCStuff (+https://github.com/TheMCP123/mcstuff)' }, redirect: 'manual', signal: AbortSignal.timeout(5000), ...(ttl ? { cf: { cacheTtl: ttl, cacheEverything: true } } : { cache: 'no-store' }) });
  } catch { throw new ApiError(503, 'upstream_unavailable', 'The profile service could not be reached. Try again shortly.'); }
  if (response.status === 429) throw new ApiError(429, 'rate_limited', 'The lookup service is rate limiting requests. Wait a minute and try again.');
  if (response.status === 404 || response.status === 204) return null;
  if (!response.ok) throw new ApiError(502, 'upstream_error', 'The profile service could not complete this lookup. Try again shortly.', { upstreamStatus: response.status, upstreamHost: new URL(url).hostname });
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

async function playerDbLookup(value, fetcher, expectedId) {
  const response = await upstream(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(value)}`, fetcher);
  if (!response) throw new ApiError(503, 'profile_unavailable', 'The official profile service is unavailable and no cached profile was found.');
  const body = await readJson(response);
  const data = body?.data?.player;
  if (body.code !== 'player.found' || !data) throw new ApiError(502, 'invalid_response', 'The backup profile service returned an invalid profile.');
  const identity = profileIdentity({ id: data.id, name: data.username }, expectedId);
  if (validUsername(value) && identity.name.toLowerCase() !== value.toLowerCase()) throw new ApiError(502, 'invalid_response', 'The cached profile does not match this username. Try its UUID instead.');
  const cachedTime = Number(data.meta?.cached_at) * 1000;
  const cachedAt = Number.isFinite(cachedTime) && cachedTime > 0 && cachedTime <= Date.now() + 300000 ? new Date(cachedTime).toISOString() : null;
  return { ...identity, properties: data.properties, source: 'PlayerDB', cachedAt };
}

async function nameLookup(name, fetcher, allowCached = false) {
  const path = `/minecraft/profile/lookup/name/${encodeURIComponent(name)}`;
  let failure;
  for (const host of ['api.minecraftservices.com', 'api.mojang.com']) {
    try {
      const response = await upstream(`https://${host}${path}`, fetcher);
      return response ? profileIdentity(await readJson(response)) : null;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status === 429) throw error;
      failure = error;
    }
  }
  if (allowCached) {
    const data = await playerDbLookup(name, fetcher);
    return { id: data.id, name: data.name, source: data.source, cachedAt: data.cachedAt };
  }
  throw failure;
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
      const profile = await nameLookup(value, fetcher, true);
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
        const identity = await nameLookup(value, fetcher, true);
        if (!identity) throw new ApiError(404, 'player_not_found', 'No public Java profile was found for this username.');
        id = identity.id;
      }
      let data;
      try {
        const session = await upstream(`https://sessionserver.mojang.com/session/minecraft/profile/${id.replaceAll('-', '')}`, fetcher, 60);
        if (!session) throw new ApiError(404, 'player_not_found', 'No public Java profile was found for this UUID.');
        data = await readJson(session);
        profileIdentity(data, id);
      } catch (error) {
        if (!(error instanceof ApiError) || [404, 429].includes(error.status)) throw error;
        data = await playerDbLookup(id, fetcher, id);
        if (!Array.isArray(data.properties)) throw new ApiError(502, 'skin_unavailable', 'The cached profile has no skin data. Try again shortly.');
      }
      response = json({ ...profileIdentity(data, id), skin: skinFromProfile(data), source: data.source || 'Mojang', cachedAt: data.cachedAt || null, checkedAt: new Date().toISOString() });
    }
  } catch (error) {
    response = error instanceof ApiError ? json({ error: error.code, message: error.message, ...error.details }, error.status) : json({ error: 'lookup_failed', message: 'The lookup could not be completed. Try again shortly.' }, 502);
  }
  return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
}

export default {
  fetch(request, env) {
    const path = new URL(request.url).pathname;
    return path === '/api' || path.startsWith('/api/') ? handleApi(request) : env.ASSETS.fetch(request);
  },
};
