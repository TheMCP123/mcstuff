import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUuid, validUsername, uuidHashCode, waypointColor } from '../public/checker-data.js';

test('UUID normalization accepts the two actual UUID formats and rejects malformed input', () => {
  assert.equal(normalizeUuid(' 069A79F444E94726A5BEFCA90E38AAF5 '), '069a79f4-44e9-4726-a5be-fca90e38aaf5');
  for (const value of ['hello', '0'.repeat(31), '0'.repeat(33), `-${'0'.repeat(32)}`, '069a79f-444e9-4726-a5be-fca90e38aaf5']) assert.equal(normalizeUuid(value), null);
  assert.throws(() => waypointColor('not a UUID'), TypeError);
});

test('waypoint hash and RGB match the actual Java 1.21.7 client ColorHelper', () => {
  // Oracle: UUID.hashCode() -> baj.c(255, hash) -> baj.b(argb, 0.9f), official 1.21.7 client.
  const vectors = [
    ['069a79f4-44e9-4726-a5be-fca90e38aaf5', -369792882, '#E66185'],
    ['8667ba71-b85a-4004-af54-457a9734eed7', 106779096, '#6356E6'],
    ['00000000-0000-0000-0000-000000000000', 0, '#E6E6E6'],
    ['ffffffff-ffff-ffff-ffff-ffffffffffff', 0, '#E6E6E6'],
    ['01234567-89ab-cdef-fedc-ba9876543210', 0, '#E6E6E6'],
    ['00000000-0000-0000-0000-000000ff0000', 16711680, '#E60000'],
    ['00000000-0000-0000-0000-00000000ff00', 65280, '#00E600'],
    ['00000000-0000-0000-0000-0000000000ff', 255, '#0000E6'],
  ];
  for (const [id, hash, hex] of vectors) {
    assert.equal(uuidHashCode(id), hash);
    assert.equal(waypointColor(id).hex, hex);
    assert.deepEqual(waypointColor(id.toUpperCase().replaceAll('-', '')), waypointColor(id));
  }
});

test('username lookup supports legacy short names while new-name checks require three characters', () => {
  assert.equal(validUsername('fr'), true);
  assert.equal(validUsername('fr', 3), false);
  for (const value of ['Notch', '_123', 'A'.repeat(16)]) assert.equal(validUsername(value, 3), true);
  for (const value of ['', 'A'.repeat(17), 'has space', 'slash/name', 'аccount', '<script>']) assert.equal(validUsername(value), false);
});
