import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleApi } from '../worker/index.js';

const id = '069a79f4-44e9-4726-a5be-fca90e38aaf5';
const compact = id.replaceAll('-', '');
const hash = '292009a4925b58f02c77dadc3ecef07ea4c7472f64e0fdc32ce5522489362680';
const identity = { id: compact, name: 'Notch' };
const reply = (value, status = 200) => new Response(JSON.stringify(value), { status });
const request = path => new Request(`https://mcstuff.test${path}`);
const textures = skin => ({ ...identity, properties: [{ name: 'textures', value: btoa(JSON.stringify({ textures: skin ? { SKIN: skin } : {} })) }] });

test('IGN returns a taken profile from the official API and never fetches textures', async () => {
  const calls = [];
  const result = await handleApi(request('/api/ign/notch'), async (url, options) => {
    calls.push(url);
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.Authorization, undefined);
    return reply(identity);
  });
  const body = await result.json();
  assert.equal(result.status, 200);
  assert.equal(body.registered, true);
  assert.deepEqual(body.profile, { id, name: 'Notch' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'https://api.minecraftservices.com/minecraft/profile/lookup/name/notch');
  assert.ok(Number.isFinite(Date.parse(body.checkedAt)));
});

test('only a real Mojang 404 or 204 produces not registered, without claiming availability', async () => {
  for (const status of [404, 204]) {
    const result = await handleApi(request('/api/ign/UnusedName123'), async () => new Response(null, { status }));
    const body = await result.json();
    assert.equal(result.status, 200);
    assert.equal(body.registered, false);
    assert.equal(body.profile, null);
    assert.equal(body.available, undefined);
  }
});

test('rate limits and upstream failures are errors, never free names', async () => {
  for (const status of [302, 429, 403, 500]) {
    const result = await handleApi(request('/api/ign/Notch'), async () => new Response(null, { status }));
    assert.equal(result.status, status === 429 ? 429 : 502);
    const body = await result.json();
    assert.equal(body.registered, undefined);
    assert.ok(body.error);
    if (status === 429) assert.equal(result.headers.get('retry-after'), '60');
  }
  const offline = await handleApi(request('/api/ign/Notch'), async () => { throw new Error('network'); });
  assert.equal(offline.status, 503);
});

test('invalid names, paths and methods make no upstream requests', async () => {
  const forbidden = () => { throw new Error('Unexpected network request'); };
  for (const path of ['/api/ign/ab', '/api/ign/a%20b', '/api/player/%2Fetc', '/api/skin/123']) assert.equal((await handleApi(request(path), forbidden)).status, 400, path);
  assert.equal((await handleApi(request('/api/unknown'), forbidden)).status, 404);
  const post = await handleApi(new Request('https://mcstuff.test/api/ign/Notch', { method: 'POST' }), forbidden);
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
});

test('malformed upstream identities and JSON are rejected instead of guessed', async () => {
  for (const value of [{}, { id: compact, name: '<script>' }, { id: 'bad', name: 'Notch' }]) assert.equal((await handleApi(request('/api/ign/Notch'), async () => reply(value))).status, 502);
  assert.equal((await handleApi(request('/api/ign/Notch'), async () => new Response('not JSON'))).status, 502);
});

test('UUID lookup resolves a name without downloading the session or skin', async () => {
  let count = 0;
  const result = await handleApi(request('/api/uuid/Notch'), async () => { count++; return reply(identity); });
  assert.deepEqual(await result.json(), { id, name: 'Notch' });
  assert.equal(count, 1);
  assert.equal((await handleApi(request('/api/uuid/NoSuchUser'), async () => new Response(null, { status: 404 }))).status, 404);
});

test('skin lookup resolves the name and safely extracts the original texture', async () => {
  const calls = [];
  const result = await handleApi(request('/api/player/Notch'), async url => {
    calls.push(url);
    return reply(calls.length === 1 ? identity : textures({ url: `http://textures.minecraft.net/texture/${hash}`, metadata: { model: 'slim' } }));
  });
  const body = await result.json();
  assert.equal(body.id, id);
  assert.equal(body.skin.model, 'Slim');
  assert.equal(body.skin.url, `/api/skin/${hash}`);
  assert.equal(calls[1], `https://sessionserver.mojang.com/session/minecraft/profile/${compact}`);
});

test('direct UUID skin lookup skips name lookup and checks the returned identity', async () => {
  let count = 0;
  const result = await handleApi(request(`/api/player/${id}`), async () => { count++; return reply(textures(null)); });
  assert.equal((await result.json()).skin, null);
  assert.equal(count, 1);
  const mismatch = await handleApi(request(`/api/player/${id}`), async () => reply({ ...identity, id: '0'.repeat(32) }));
  assert.equal(mismatch.status, 502);
});

test('skin URLs cannot redirect lookups to arbitrary hosts, ports or credentials', async () => {
  for (const url of [`https://evil.example/texture/${hash}`, `https://textures.minecraft.net.evil.example/texture/${hash}`, `https://user@textures.minecraft.net/texture/${hash}`, `https://textures.minecraft.net:443/texture/${hash}?redirect=x`, `file:///texture/${hash}`]) {
    const result = await handleApi(request(`/api/player/${id}`), async () => reply(textures({ url })));
    assert.equal(result.status, 502, url);
  }
});

test('skin proxy uses HTTPS on the fixed texture host and preserves PNG bytes', async () => {
  const png = new Uint8Array(32);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const result = await handleApi(request(`/api/skin/${hash}`), async url => {
    assert.equal(url, `https://textures.minecraft.net/texture/${hash}`);
    return new Response(png);
  });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('content-type'), 'image/png');
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), png);
  const invalid = await handleApi(request(`/api/skin/${hash}`), async () => new Response('<html>not a PNG</html>'));
  assert.equal(invalid.status, 502);
});

test('HEAD strips the body while unknown API routes stay JSON and assets pass through', async () => {
  const head = await handleApi(new Request('https://mcstuff.test/api/ign/Notch', { method: 'HEAD' }), async () => reply(identity));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const unknown = await worker.fetch(request('/api/not-a-route'), {});
  assert.equal(unknown.status, 404);
  assert.match(unknown.headers.get('content-type'), /application\/json/);
  const asset = await worker.fetch(request('/styles.css'), { ASSETS: { fetch: async req => new Response(new URL(req.url).pathname) } });
  assert.equal(await asset.text(), '/styles.css');
});

test('name lookups recover from an official host 403 using the second official endpoint', async () => {
  const calls = [];
  const result = await handleApi(request('/api/ign/Notch'), async url => {
    calls.push(url);
    return calls.length === 1 ? new Response(null, { status: 403 }) : reply(identity);
  });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).registered, true);
  assert.deepEqual(calls, ['https://api.minecraftservices.com/minecraft/profile/lookup/name/Notch', 'https://api.mojang.com/minecraft/profile/lookup/name/Notch']);
});

test('a 403 then authoritative 404 is unregistered; a 429 stops retries', async () => {
  let calls = 0;
  const result = await handleApi(request('/api/ign/UnusedName123'), async () => new Response(null, { status: ++calls === 1 ? 403 : 404 }));
  assert.equal((await result.json()).registered, false);
  calls = 0;
  const limited = await handleApi(request('/api/ign/Notch'), async () => { calls++; return new Response(null, { status: 429 }); });
  assert.equal(limited.status, 429);
  assert.equal(calls, 1);
});

test('IGN never converts a failed official lookup into a cached availability result', async () => {
  const calls = [];
  const result = await handleApi(request('/api/ign/Notch'), async url => { calls.push(url); return new Response(null, { status: 403 }); });
  assert.equal(result.status, 502);
  const body = await result.json();
  assert.equal(body.registered, undefined);
  assert.equal(body.upstreamStatus, 403);
  assert.ok(calls.every(url => !url.includes('playerdb.co')));
});

const cachedPlayer = (overrides = {}) => ({ code: 'player.found', data: { player: { id, username: 'Notch', properties: textures({ url: `https://textures.minecraft.net/texture/${hash}` }).properties, meta: { cached_at: 1700000000 }, ...overrides } } });

test('skin lookup recovers from session-server blocking with a verified cached profile', async () => {
  const calls = [];
  const result = await handleApi(request('/api/player/Notch'), async url => {
    calls.push(url);
    if (url.includes('minecraftservices.com')) return reply(identity);
    if (url.includes('sessionserver.mojang.com')) return new Response(null, { status: 403 });
    assert.equal(url, `https://playerdb.co/api/player/minecraft/${id}`);
    return reply(cachedPlayer());
  });
  const body = await result.json();
  assert.equal(result.status, 200);
  assert.equal(body.id, id);
  assert.equal(body.skin.url, `/api/skin/${hash}`);
  assert.equal(body.source, 'PlayerDB');
  assert.equal(body.cachedAt, '2023-11-14T22:13:20.000Z');
  assert.equal(calls.length, 3);
});

test('waypoint name lookup can use a marked cached identity when both official hosts fail', async () => {
  const result = await handleApi(request('/api/uuid/Notch'), async url => url.includes('playerdb.co') ? reply(cachedPlayer()) : new Response(null, { status: 503 }));
  const body = await result.json();
  assert.equal(result.status, 200);
  assert.equal(body.source, 'PlayerDB');
  assert.equal(body.id, id);
});

test('backup data must match the requested player and must actually contain skin data', async () => {
  for (const overrides of [{ id: '0'.repeat(32) }, { properties: undefined }]) {
    const result = await handleApi(request(`/api/player/${id}`), async url => url.includes('playerdb.co') ? reply(cachedPlayer(overrides)) : new Response(null, { status: 403 }));
    assert.equal(result.status, 502);
  }
  const wrongName = await handleApi(request('/api/uuid/Notch'), async url => url.includes('playerdb.co') ? reply(cachedPlayer({ username: 'OtherPlayer' })) : new Response(null, { status: 403 }));
  assert.equal(wrongName.status, 502);
});
