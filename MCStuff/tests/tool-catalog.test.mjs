import test from 'node:test';
import assert from 'node:assert/strict';
import { searchTools, TOOL_CATALOG } from '../public/tool-catalog.js';

test('search matches tool names, format aliases and multiple words', () => {
  for (const query of ['colors', 'COLOUR', ' mini message ', 'legacy hex', 'rgb', 'formatting']) assert.equal(searchTools(query)[0]?.id, 'colors');
  assert.deepEqual(searchTools('pack').map(tool => tool.id), ['builder']);
});

test('search returns actual registered tools and handles empty or unknown queries', () => {
  assert.deepEqual(searchTools('  ').map(tool => tool.id), ['colors', 'builder', 'skin', 'waypoint', 'ign', 'bedrock']);
  assert.deepEqual(searchTools('not-a-real-tool'), []);
  assert.deepEqual(searchTools('<script>'), []);
});

test('search tolerates missing, extra, replaced and transposed letters', () => {
  for (const query of ['colros', 'xolors', 'colourrs', 'formating', 'minimessgae', 'minimesage', 'legcy', 'jsno']) assert.equal(searchTools(query)[0]?.id, 'colors', query);
  for (const query of ['pak', 'pack biulder', 'modrith', 'mod paak']) assert.deepEqual(searchTools(query).map(tool => tool.id), ['builder'], query);
});

test('search normalizes punctuation, full-width letters and diacritics', () => {
  for (const query of ['CÓLÓURS', 'ＭｉｎｉＭｅｓｓａｇｅ', 'colors & formatting', ' mini-message / HEX ', 'C&F', 'cf']) assert.equal(searchTools(query)[0]?.id, 'colors', query);
  for (const query of ['Pack-Builder', 'packbuilder', 'pb']) assert.deepEqual(searchTools(query).map(tool => tool.id), ['builder'], query);
});

test('search understands feature names and short natural-language queries', () => {
  for (const query of ['colour codes', 'tool for bold text', 'how to format text', 'chat styles', 'bungee rgb', 'rainbow', 'underlined']) assert.equal(searchTools(query)[0]?.id, 'colors', query);
  for (const query of ['modpack', 'find a plugin pack', 'mods']) assert.deepEqual(searchTools(query).map(tool => tool.id), ['builder'], query);
});

test('search accepts Russian aliases and repairs an English query typed on a Russian keyboard', () => {
  for (const query of ['цвета', 'форматирование текста', 'коды для цвета', 'сщдщкы', 'дупфсн']) assert.equal(searchTools(query)[0]?.id, 'colors', query);
  for (const query of ['сборка', 'плагины', 'модпак', 'зфсл игшдвук']) assert.deepEqual(searchTools(query).map(tool => tool.id), ['builder'], query);
});

test('search ranks exact titles before title words, aliases and approximate matches', () => {
  const catalog = [
    { id: 'alias', title: 'Message Preview', keywords: 'hex' },
    { id: 'prefix', title: 'Hex Viewer' },
    { id: 'exact', title: 'HEX' },
    { id: 'approximate', title: 'Hax' },
  ];
  assert.deepEqual(searchTools('hex', catalog).map(tool => tool.id), ['exact', 'prefix', 'alias', 'approximate']);
});

test('search rejects unrelated terms, punctuation and overly short fuzzy matches', () => {
  for (const query of ['???', 'zz', 'zzz', 'weather', 'legacy weather', 'pack formatting', 'x'.repeat(500)]) assert.deepEqual(searchTools(query), [], query);
  assert.deepEqual(searchTools('le').map(tool => tool.id), ['bedrock', 'colors']);
  assert.deepEqual(searchTools('pa').map(tool => tool.id), ['builder', 'colors', 'bedrock']);
});

test('search is deterministic and leaves the catalog in its original order', () => {
  const original = structuredClone(TOOL_CATALOG);
  const first = searchTools('minecraft').map(tool => tool.id);
  searchTools('builder');
  assert.deepEqual(searchTools('minecraft').map(tool => tool.id), first);
  assert.deepEqual(TOOL_CATALOG, original);
  assert.notEqual(searchTools(''), TOOL_CATALOG);
});

test('the new checkers are searchable by purpose and category', () => {
  assert.deepEqual(searchTools('checkers').map(tool => tool.id), ['skin', 'waypoint', 'ign']);
  assert.equal(searchTools('skin download')[0]?.id, 'skin');
  assert.equal(searchTools('locator bar')[0]?.id, 'waypoint');
  assert.equal(searchTools('name availability')[0]?.id, 'ign');
  assert.deepEqual(searchTools('general').map(tool => tool.id), ['colors', 'builder']);
});

test('Base Finding finds Bedrock Leak by category, pattern and Russian aliases',()=>{
  for(const query of ['base finding','basefinding','bedrock leak','bedrock pattern','бедрок','координаты сид'])assert.deepEqual(searchTools(query).map(tool=>tool.id),['bedrock'],query);
});
