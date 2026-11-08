import { MAX_PACK_BYTES } from './pack-data.js';

const encoder = new TextEncoder();
const table = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ZIP STORE: preserve the original JAR/ZIP bytes, UTF-8 names and standard CRC-32.
export function createPackZip(entries) {
  if (entries.length > 200) throw new Error('Too many archive entries.');
  const seen = new Set();
  const files = entries.map(entry => {
    if (!/^[^\\\u0000-\u001f]+$/.test(entry.path) || entry.path.startsWith('/') || entry.path.split('/').some(part => !part || part === '.' || part === '..') || /^[A-Za-z]:/.test(entry.path)) throw new Error('Invalid archive path.');
    const key = entry.path.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate archive path: ${entry.path}`);
    seen.add(key);
    const bytes = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
    if (!(bytes instanceof Uint8Array)) throw new TypeError('Archive entries must contain bytes or text.');
    const name = encoder.encode(entry.path);
    if (name.length > 65535) throw new Error('Archive filename is too long.');
    return { name, bytes, crc: crc32(bytes) };
  });
  const localSize = files.reduce((size, file) => size + 30 + file.name.length + file.bytes.length, 0);
  const centralSize = files.reduce((size, file) => size + 46 + file.name.length, 0);
  if (localSize + centralSize + 22 > MAX_PACK_BYTES) throw new Error('This pack exceeds the 128 MB ZIP limit. Download the files separately.');
  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  let offset = 0;
  const offsets = [];
  function common(position, file, central = false) {
    view.setUint16(position, 20, true);
    view.setUint16(position + 2, 0x800, true);
    view.setUint16(position + 4, 0, true);
    view.setUint16(position + 6, 0, true);
    view.setUint16(position + 8, 33, true);
    view.setUint32(position + 10, file.crc, true);
    view.setUint32(position + 14, file.bytes.length, true);
    view.setUint32(position + 18, file.bytes.length, true);
    view.setUint16(position + 22, file.name.length, true);
    view.setUint16(position + 24, 0, true);
  }
  for (const file of files) {
    offsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    common(offset + 4, file);
    output.set(file.name, offset + 30);
    output.set(file.bytes, offset + 30 + file.name.length);
    offset += 30 + file.name.length + file.bytes.length;
  }
  for (const [index, file] of files.entries()) {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    common(offset + 6, file);
    view.setUint32(offset + 42, offsets[index], true);
    output.set(file.name, offset + 46);
    offset += 46 + file.name.length;
  }
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, files.length, true);
  view.setUint16(offset + 10, files.length, true);
  view.setUint32(offset + 12, centralSize, true);
  view.setUint32(offset + 16, localSize, true);
  return output;
}

export async function verifyFile(bytes, hashes = {}, size = 0) {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4) throw new Error('The source did not return a JAR or ZIP file.');
  if (size > 0 && bytes.length !== size) throw new Error('The downloaded file size does not match the source.');
  const algorithm = hashes.sha512 ? 'SHA-512' : hashes.sha1 ? 'SHA-1' : null;
  if (algorithm) {
    const expected = hashes.sha512 || hashes.sha1;
    const digest = new Uint8Array(await crypto.subtle.digest(algorithm, bytes));
    const actual = [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== expected.toLowerCase()) throw new Error('File integrity check failed. Try downloading it again.');
  }
  return bytes;
}
