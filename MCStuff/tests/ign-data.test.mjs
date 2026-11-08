import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIgnNames, validateIgnResult, ignStatus, runIgnBatch, ignResultsText } from '../public/ign-data.js';

const profile = { id: '069a79f4-44e9-4726-a5be-fca90e38aaf5', name: 'Notch' };
const result = { name: 'Notch', registered: true, profile, source: 'Mojang', verification: 'official', checkedAt: '2026-11-07T23:00:00.000Z' };

test('bulk names accept common paste separators, retain order and deduplicate without case sensitivity', () => {
  assert.deepEqual(parseIgnNames(' Notch, notch; Dinnerbone\r\nPlayer_123 ', true), { names: ['Notch', 'Dinnerbone', 'Player_123'], error: '', duplicates: 1 });
  assert.equal(parseIgnNames('Notch Dinnerbone').error, 'Use only letters, numbers and underscores.');
  assert.equal(parseIgnNames('', true).names.length, 0);
});

test('name validation rejects invalid characters, lengths and oversized batches without silently truncating', () => {
  for (const name of ['aa', 'a'.repeat(17), 'аccount', 'abc/def', '<script>']) assert.ok(parseIgnNames(name).error, name);
  assert.equal(parseIgnNames('a'.repeat(16)).error, '');
  assert.ok(parseIgnNames(Array.from({ length: 11 }, (_, i) => `Name${i}`).join('\n'), true).error.includes('10'));
});

test('IGN validation binds results to the requested name and keeps official, cached and unknown states separate', () => {
  assert.equal(validateIgnResult(result, 'notch'), true);
  assert.equal(validateIgnResult({ ...result, registered: false, profile: null }, 'Notch'), true);
  assert.equal(validateIgnResult({ ...result, source: 'PlayerDB', verification: 'cached' }, 'Notch'), true);
  assert.equal(validateIgnResult({ ...result, source: 'PlayerDB', verification: 'unconfirmed', registered: null, profile: null }, 'Notch'), true);
  for (const data of [{ ...result, source: 'PlayerDB' }, { ...result, verification: 'cached', registered: false }, { ...result, name: 'Other' }, { ...result, profile: { ...profile, name: 'Other' } }, { ...result, profile: { ...profile, id: 'invalid' } }, { ...result, checkedAt: 'invalid' }, { ...result, source: 'PlayerDB', verification: 'cached', cachedAt: 'invalid' }]) assert.equal(validateIgnResult(data, 'Notch'), false);
});

test('unconfirmed and cached labels never claim availability; copied results preserve provenance', () => {
  const unknown = { ...result, source: 'PlayerDB', verification: 'unconfirmed', registered: null, profile: null };
  assert.equal(ignStatus(unknown).label, 'Unconfirmed');
  const cached = { ...result, source: 'PlayerDB', verification: 'cached', cachedAt: '2026-11-01T00:00:00Z' };
  assert.equal(ignStatus(cached).label, 'Registered (cached)');
  const text = ignResultsText([{ name: 'Notch', phase: 'complete', data: cached }, { name: 'Example', phase: 'cancelled' }]);
  assert.match(text, /Notch\tRegistered \(cached\)\tPlayerDB\t069a79f4/);
  assert.match(text, /Example\tNot checked/);
  assert.match(text, /2026-11-01T00:00:00Z/);
});

test('batch checks use at most two concurrent requests and retain input order', async () => {
  let active = 0;
  let maximum = 0;
  const rows = await runIgnBatch(['First', 'Second', 'Third', 'Fourth'], async name => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    return { name };
  });
  assert.equal(maximum, 2);
  assert.deepEqual(rows.map(row => row.data.name), ['First', 'Second', 'Third', 'Fourth']);
  assert.ok(rows.every(row => row.phase === 'complete'));
});

test('429 stops queued checks and never changes them to unregistered', async () => {
  const calls = [];
  const rows = await runIgnBatch(['First', 'Second', 'Third', 'Fourth'], async name => {
    calls.push(name);
    if (name === 'First') { const error = new Error('Rate limited'); error.status = 429; throw error; }
    return { name };
  });
  assert.deepEqual(calls, ['First', 'Second']);
  assert.equal(rows[0].phase, 'error');
  assert.equal(rows[1].phase, 'complete');
  assert.ok(rows.slice(2).every(row => row.phase === 'cancelled' && !row.data));
});

test('cancellation discards late replies and prevents queued requests from starting', async () => {
  const controller = new AbortController();
  const calls = [];
  const rows = await runIgnBatch(['First', 'Second', 'Third'], async name => {
    calls.push(name);
    controller.abort();
    return { name };
  }, { signal: controller.signal });
  assert.deepEqual(calls, ['First']);
  assert.ok(rows.every(row => row.phase === 'cancelled' && !row.data));
});

test('one network failure is an error for that name and does not fabricate results or stop other names', async () => {
  const rows = await runIgnBatch(['First', 'Second', 'Third'], async name => {
    if (name === 'Second') throw new Error('Service unavailable');
    return { name };
  });
  assert.deepEqual(rows.map(row => row.phase), ['complete', 'error', 'complete']);
  assert.equal(rows[1].data, undefined);
});
