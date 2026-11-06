export const MINECRAFT_COLORS = [
  ['black', 'Black', '#000000'], ['dark_blue', 'Dark Blue', '#0000AA'],
  ['dark_green', 'Dark Green', '#00AA00'], ['dark_aqua', 'Dark Aqua', '#00AAAA'],
  ['dark_red', 'Dark Red', '#AA0000'], ['dark_purple', 'Dark Purple', '#AA00AA'],
  ['gold', 'Gold', '#FFAA00'], ['gray', 'Gray', '#AAAAAA'],
  ['dark_gray', 'Dark Gray', '#555555'], ['blue', 'Blue', '#5555FF'],
  ['green', 'Green', '#55FF55'], ['aqua', 'Aqua', '#55FFFF'],
  ['red', 'Red', '#FF5555'], ['light_purple', 'Light Purple', '#FF55FF'],
  ['yellow', 'Yellow', '#FFFF55'], ['white', 'White', '#FFFFFF'],
].map(([name, label, hex], index) => ({ name, label, hex, code: index.toString(16) }));

export const DECORATIONS = [
  { key: 'bold', label: 'Bold', code: 'l', short: 'B' },
  { key: 'italic', label: 'Italic', code: 'o', short: 'I' },
  { key: 'underlined', label: 'Underlined', code: 'n', short: 'U' },
  { key: 'strikethrough', label: 'Strikethrough', code: 'm', short: 'S' },
  { key: 'obfuscated', label: 'Obfuscated', code: 'k', short: 'Obf' },
];

export const OUTPUT_FORMATS = [
  { id: 'minimessage', label: 'MiniMessage', help: 'For plugins using Adventure MiniMessage.' },
  { id: 'legacy-ampersand', label: 'Legacy (&)', help: '16 colors. Your plugin must support ampersand codes.' },
  { id: 'legacy-section', label: 'Legacy (§)', help: '16 colors with section-sign codes.' },
  { id: 'hex-ampersand', label: 'HEX (&#RRGGBB)', help: 'RGB for plugins that support the short ampersand HEX syntax.' },
  { id: 'hex-section', label: 'HEX (§#RRGGBB)', help: 'Adventure RGB syntax with the section sign.' },
  { id: 'bungee-ampersand', label: 'HEX (&x&R&R&G&G&B&B)', help: 'BungeeCord-style RGB with ampersands.' },
  { id: 'bungee-section', label: 'HEX (§x§R§R§G§G§B§B)', help: 'BungeeCord-style RGB with section signs.' },
  { id: 'json', label: 'JSON (Java)', help: 'Java Edition text component JSON.' },
];

export const MINIMESSAGE_SNIPPETS = [
  ['HEX color', '<#12ABEF>Text</#12ABEF>', 'Any RGB color.'],
  ['Color aliases', '<color:green>Text</color:green>', 'Also: <colour:green> and <c:green>.'],
  ['Disable a style', '<bold:false>Normal</bold>', 'Negated style alias: <!bold>.'],
  ['Gradient', '<gradient:#22C55E:#4B91FF>Gradient</gradient>', 'Two or more named or HEX colors.'],
  ['Rainbow', '<rainbow>Rainbow</rainbow>', 'Use <rainbow:!> to reverse the colors.'],
  ['Transition', '<transition:#22C55E:#4B91FF:0>Text</transition>', 'One color selected from a gradient; phase −1 to 1.'],
  ['Shadow', '<shadow:#000000:0.5>Text</shadow>', 'Custom shadow color and opacity.'],
  ['No shadow', '<shadow:#00000000>Text</shadow>', 'A transparent shadow; alias: <!shadow>.'],
  ['Hover text', "<hover:show_text:'More information'>Hover me</hover>", 'Shows a tooltip in Minecraft.'],
  ['Open URL', "<click:open_url:'https://example.com'>Open link</click>", 'Opens a URL when the player clicks.'],
  ['Suggest command', "<click:suggest_command:'/help'>Help</click>", 'Inserts a command into the chat input.'],
  ['Copy text', "<click:copy_to_clipboard:'Hello'>Copy</click>", 'Copies text when the player clicks.'],
  ['Font', '<font:minecraft:uniform>Text</font>', 'Uses a font available on the client.'],
  ['Newline', 'First line<newline>Second line', 'Alias: <br>.'],
  ['Keybind', '<key:key.jump>', 'Shows the player’s key for jumping.'],
  ['Translation', '<lang:block.minecraft.diamond_block>', 'Shows a translation in the player’s language.'],
  ['Insert text', "<insert:'Hello'>Shift-click me</insert>", 'Inserts text into chat on shift-click.'],
];

export function normalizeHex(value) {
  let hex = String(value).trim().replace(/^#/, '');
  if (/^[\da-f]{3}$/i.test(hex)) hex = [...hex].map(char => char + char).join('');
  return /^[\da-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : null;
}

function rgb(hex) {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
}

export function nearestColor(value) {
  const hex = normalizeHex(value);
  if (!hex) throw new TypeError('Invalid HEX color');
  const channels = rgb(hex);
  return MINECRAFT_COLORS.reduce((nearest, color) => {
    const distance = rgb(color.hex).reduce((sum, channel, index) => sum + (channel - channels[index]) ** 2, 0);
    return distance < nearest.distance ? { color, distance } : nearest;
  }, { color: MINECRAFT_COLORS[0], distance: Infinity }).color;
}

export function mixHex(start, end, fraction) {
  const a = rgb(start);
  const b = rgb(end);
  return `#${a.map((channel, index) => Math.round(channel + (b[index] - channel) * fraction).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function escapeMiniMessage(text) {
  return text.replace(/\\/g, '\\\\').replace(/</g, '\\<');
}

export function messageRuns({ text, start, end = start, mode = 'solid', format = 'minimessage' }) {
  const from = normalizeHex(start);
  const to = normalizeHex(end);
  if (!from || (mode === 'gradient' && !to)) throw new TypeError('Invalid HEX color');
  const chars = Array.from(text);
  const steps = chars.filter(char => char !== '\n' && char !== '\r').length;
  let position = 0;
  return chars.map(char => {
    const color = mode === 'gradient' ? mixHex(from, to, steps > 1 ? Math.min(position, steps - 1) / (steps - 1) : 0) : from;
    if (char !== '\n' && char !== '\r') position++;
    return { text: char, color: format.startsWith('legacy-') ? nearestColor(color).hex : color };
  });
}

export function serializeMessage(options) {
  const { text, mode = 'solid', format = 'minimessage', decorations = [] } = options;
  if (!['solid', 'gradient'].includes(mode)) throw new TypeError('Unknown color mode');
  if (!OUTPUT_FORMATS.some(item => item.id === format)) throw new TypeError('Unknown output format');
  const start = normalizeHex(options.start);
  const end = normalizeHex(options.end ?? options.start);
  if (!start || (mode === 'gradient' && !end)) throw new TypeError('Invalid HEX color');
  if (!text) return '';
  const styles = DECORATIONS.filter(style => decorations.includes(style.key));
  if (format === 'minimessage') {
    const named = MINECRAFT_COLORS.find(color => color.hex === start);
    const colorTag = mode === 'gradient' ? `gradient:${start}:${end}` : named?.name || start;
    const tags = [colorTag, ...styles.map(style => style.key)];
    const closing = [...tags].reverse().map(tag => `</${tag.startsWith('gradient:') ? 'gradient' : tag}>`).join('');
    return `${tags.map(tag => `<${tag}>`).join('')}${escapeMiniMessage(text)}${closing}`;
  }
  const runs = messageRuns({ ...options, start, end });
  const styleObject = Object.fromEntries(styles.map(style => [style.key, true]));
  if (format === 'json') {
    const component = mode === 'gradient'
      ? { text: '', ...styleObject, extra: runs.map(run => ({ text: run.text, color: run.color })) }
      : { text, color: start, ...styleObject };
    return JSON.stringify(component, null, 2);
  }
  const prefix = format.endsWith('section') ? '§' : '&';
  const styleCodes = styles.map(style => prefix + style.code).join('');
  const colorCode = hex => {
    if (format.startsWith('legacy-')) return prefix + nearestColor(hex).code;
    if (format.startsWith('bungee-')) return `${prefix}x${Array.from(hex.slice(1)).map(char => prefix + char).join('')}`;
    return prefix + hex;
  };
  if (mode !== 'gradient') return colorCode(start) + styleCodes + text + prefix + 'r';
  let previous = null;
  return runs.map(run => {
    if (run.text === '\n' || run.text === '\r') return run.text;
    const code = run.color !== previous ? colorCode(run.color) + styleCodes : '';
    previous = run.color;
    return code + run.text;
  }).join('') + prefix + 'r';
}
