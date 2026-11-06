import test from 'node:test';
import assert from 'node:assert/strict';
import { MINECRAFT_COLORS, DECORATIONS, OUTPUT_FORMATS, normalizeHex, nearestColor, messageRuns, serializeMessage } from '../public/formatting.js';

const base = { text: 'Hello', start: '#55FF55', end: '#55FFFF', mode: 'solid', format: 'minimessage', decorations: [] };

test('all 16 Minecraft color codes map to their exact palette color', () => {
  assert.equal(MINECRAFT_COLORS.length, 16);
  assert.equal(MINECRAFT_COLORS.map(color => color.code).join(''), '0123456789abcdef');
  for (const color of MINECRAFT_COLORS) {
    assert.equal(nearestColor(color.hex).name, color.name);
    assert.equal(serializeMessage({ ...base, start: color.hex, format: 'legacy-ampersand' }), `&${color.code}Hello&r`);
  }
  assert.equal(MINECRAFT_COLORS[6].hex, '#FFAA00');
  assert.equal(MINECRAFT_COLORS[8].hex, '#555555');
});

test('HEX input accepts short and full values while rejecting invalid input', () => {
  assert.equal(normalizeHex(' aBc '), '#AABBCC');
  assert.equal(normalizeHex('#12abef'), '#12ABEF');
  for (const invalid of ['', '#12', '#1234567', 'red', '#GG0000', 'url(test)']) assert.equal(normalizeHex(invalid), null);
});

test('MiniMessage uses named colors and closes all decorations in reverse order', () => {
  assert.equal(serializeMessage({ ...base, decorations: ['italic', 'bold'] }), '<green><bold><italic>Hello</italic></bold></green>');
  assert.equal(serializeMessage({ ...base, start: '#12ABEF' }), '<#12ABEF>Hello</#12ABEF>');
  assert.equal(serializeMessage({ ...base, text: '<red>\\path' }), '<green>\\<red>\\\\path</green>');
});

test('MiniMessage gradients export balanced tags and escape literal user tags', () => {
  assert.equal(serializeMessage({ ...base, text: 'A<B', mode: 'gradient', start: '#000000', end: '#FFFFFF', decorations: ['bold'] }), '<gradient:#000000:#FFFFFF><bold>A\\<B</bold></gradient>');
  assert.equal(serializeMessage({ ...base, decorations: ['bold', 'click:run_command'] }), '<green><bold>Hello</bold></green>');
});

test('Legacy styles follow the color and the result ends with a reset', () => {
  assert.equal(serializeMessage({ ...base, format: 'legacy-ampersand', decorations: DECORATIONS.map(style => style.key) }), '&a&l&o&n&m&kHello&r');
  assert.equal(serializeMessage({ ...base, format: 'legacy-section', decorations: ['bold'] }), '§a§lHello§r');
  assert.equal(serializeMessage({ ...base, start: '#010101', format: 'legacy-ampersand' }), '&0Hello&r');
});

test('all four RGB Legacy variants use the selected marker and exact hex digits', () => {
  const color = { ...base, start: '#12ABEF' };
  assert.equal(serializeMessage({ ...color, format: 'hex-ampersand' }), '&#12ABEFHello&r');
  assert.equal(serializeMessage({ ...color, format: 'hex-section' }), '§#12ABEFHello§r');
  assert.equal(serializeMessage({ ...color, format: 'bungee-ampersand' }), '&x&1&2&A&B&E&FHello&r');
  assert.equal(serializeMessage({ ...color, format: 'bungee-section' }), '§x§1§2§A§B§E§FHello§r');
});

test('gradients do not split Unicode surrogate pairs or consume a step for newlines', () => {
  const runs = messageRuns({ ...base, text: 'A😀\nB', mode: 'gradient', start: '#000000', end: '#FFFFFF' });
  assert.equal(runs.map(run => run.text).join(''), 'A😀\nB');
  assert.equal(runs.length, 4);
  assert.equal(runs[0].color, '#000000');
  assert.equal(runs[1].color, '#808080');
  assert.equal(runs.at(-1).color, '#FFFFFF');
  assert.equal(messageRuns({ ...base, text: '😀', mode: 'gradient' })[0].color, '#55FF55');
});

test('Legacy gradients reapply decorations after color changes', () => {
  assert.equal(serializeMessage({ ...base, text: 'AB', mode: 'gradient', start: '#000000', end: '#FFFFFF', decorations: ['bold'], format: 'legacy-ampersand' }), '&0&lA&f&lB&r');
});

test('JSON exports valid text components with intact user text and gradient endpoints', () => {
  const text = '"<script>\\\n😀';
  assert.deepEqual(JSON.parse(serializeMessage({ ...base, text, format: 'json', decorations: ['underlined'] })), { text, color: '#55FF55', underlined: true });
  const gradient = JSON.parse(serializeMessage({ ...base, text: 'AB', mode: 'gradient', format: 'json', decorations: ['italic'] }));
  assert.equal(gradient.italic, true);
  assert.deepEqual(gradient.extra, [{ text: 'A', color: '#55FF55' }, { text: 'B', color: '#55FFFF' }]);
});

test('empty messages have no output and invalid formats or colors are rejected', () => {
  for (const format of OUTPUT_FORMATS) assert.equal(serializeMessage({ ...base, text: '', format: format.id }), '');
  assert.throws(() => serializeMessage({ ...base, format: 'unknown' }), /format/);
  assert.throws(() => serializeMessage({ ...base, mode: 'unknown' }), /mode/);
  assert.throws(() => serializeMessage({ ...base, start: '#badcolor' }), /HEX/);
});
