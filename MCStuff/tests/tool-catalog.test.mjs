import test from 'node:test';
import assert from 'node:assert/strict';
import { searchTools } from '../public/tool-catalog.js';

test('search matches tool names, format aliases and multiple words', () => {
  for (const query of ['colors', 'COLOUR', ' mini message ', 'legacy hex', 'rgb', 'formatting']) assert.deepEqual(searchTools(query).map(tool => tool.id), ['colors']);
  assert.deepEqual(searchTools('pack').map(tool => tool.id), ['builder']);
});

test('search returns actual registered tools and handles empty or unknown queries', () => {
  assert.deepEqual(searchTools('  ').map(tool => tool.id), ['colors', 'builder']);
  assert.deepEqual(searchTools('not-a-real-tool'), []);
  assert.deepEqual(searchTools('<script>'), []);
});
