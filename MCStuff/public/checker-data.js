export function normalizeUuid(value) {
  const text = String(value).trim();
  if (!/^(?:[a-f\d]{32}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i.test(text)) return null;
  const compact = text.replaceAll('-', '').toLowerCase();
  return compact.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

export function validUsername(value, minimum = 1) {
  return typeof value === 'string' && value.length >= minimum && value.length <= 16 && /^[a-z\d_]+$/i.test(value);
}

export function uuidHashCode(value) {
  const uuid = normalizeUuid(value);
  if (!uuid) throw new TypeError('Enter a valid UUID.');
  const hex = uuid.replaceAll('-', '');
  return [0, 8, 16, 24].reduce((hash, offset) => hash ^ parseInt(hex.slice(offset, offset + 8), 16), 0);
}

// Java Edition LocatorBar / ColorHelper.withBrightness, checked against 1.21.7.
// Java float operations and Math.round are significant at channel boundaries.
export function waypointColor(value) {
  const hash = uuidHashCode(value);
  const original = [(hash >>> 16) & 255, (hash >>> 8) & 255, hash & 255];
  const [r, g, b] = original;
  const f = Math.fround;
  const max = Math.max(r, g, b);
  const delta = f(max - Math.min(r, g, b));
  const saturation = max ? f(delta / max) : 0;
  const brightness = f(.9);
  let channels;
  if (!saturation) channels = [brightness, brightness, brightness];
  else {
    const rd = f((max - r) / delta);
    const gd = f((max - g) / delta);
    const bd = f((max - b) / delta);
    let hue = max === r ? f(bd - gd) : max === g ? f(f(2 + rd) - bd) : f(f(4 + gd) - rd);
    hue = f(hue / 6);
    if (hue < 0) hue = f(hue + 1);
    const h = f(f(hue - Math.floor(hue)) * 6);
    const fraction = f(h - Math.floor(h));
    const p = f(brightness * f(1 - saturation));
    const q = f(brightness * f(1 - f(saturation * fraction)));
    const t = f(brightness * f(1 - f(saturation * f(1 - fraction))));
    channels = [[brightness, t, p], [q, brightness, p], [p, brightness, t], [p, q, brightness], [t, p, brightness], [brightness, p, q]][Math.floor(h) % 6];
  }
  const rgb = channels.map(channel => Math.round(f(channel * 255)));
  return { hash, rgb, hex: `#${rgb.map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}` };
}
