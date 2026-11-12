export const GRID_SIZE = 10;
export const MIN_KNOWN = 8;
export const MAX_RADIUS = 8192;
export const MAX_MATCHES = 100;
export const BATCH_SIZE = 16384;
export const LAYERS = [-63, -62, -61, -60];
export const CELL_NAMES = ['Unknown', 'Bedrock', 'Other'];
export const MIN_COORD = -29999984;
export const MAX_ORIGIN = 29999984 - GRID_SIZE;
const MASK = (1n << 64n) - 1n;
const GOLD = 0x9e3779b97f4a7c15n;
const SILVER = 0x6a09e667f3bcc909n;

export function parseSeed(value) {
  if (typeof value==='number'&&!Number.isSafeInteger(value)) throw new TypeError('Enter a large seed as text to preserve all 64 bits.');
  const text = String(value).trim();
  if (!/^[+-]?\d{1,19}$/.test(text)) throw new TypeError('Enter a numeric 64-bit Java world seed.');
  const seed = BigInt(text);
  if (seed < -(1n << 63n) || seed >= (1n << 63n)) throw new RangeError('The seed must be a signed 64-bit integer.');
  return seed;
}

function mix(value) {
  value = ((value ^ (value >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
  value = ((value ^ (value >> 27n)) * 0x94d049bb133111ebn) & MASK;
  return value ^ (value >> 31n);
}

function xoroshiro(low, high) {
  low &= MASK; high &= MASK;
  if (!(low | high)) { low = GOLD; high = SILVER; }
  const rotate = (value, bits) => ((value << bits) | (value >> (64n - bits))) & MASK;
  return () => {
    const sum = (low + high) & MASK;
    const result = (rotate(sum, 17n) + low) & MASK;
    high ^= low;
    low = (rotate(low, 49n) ^ high ^ ((high << 21n) & MASK)) & MASK;
    high = rotate(high, 28n);
    return result;
  };
}

// Named positional factory, independently implemented from the vanilla RNG contract.
// Hash constants are MD5 UTF-8("minecraft:bedrock_floor"), two big-endian uint64s.
export function bedrockFactory(seed) {
  const base = (BigInt(seed) ^ SILVER) & MASK;
  const root = xoroshiro(mix(base), mix((base + GOLD) & MASK));
  const named = xoroshiro(root() ^ 0xbbf7928b7bf1d285n, root() ^ 0xc4dc7cf90e1b3b94n);
  return [named(), named()];
}

export function layerThreshold(layer) {
  if (!LAYERS.includes(layer)) throw new RangeError('Choose a bedrock layer from Y=-63 to Y=-60.');
  return Math.ceil((( -59 - layer) / 5) * 16777216);
}

export function compilePattern(pattern, allRotations = true, layer = -61) {
  if (!Array.isArray(pattern) || pattern.length !== GRID_SIZE ** 2 || pattern.some(value => !Number.isInteger(value) || value < 0 || value > 2)) throw new TypeError('The pattern must contain 100 Bedrock / Other / Unknown cells.');
  const known = pattern.flatMap((state, index) => state ? [{ x:index % GRID_SIZE, z:Math.floor(index / GRID_SIZE), bedrock:Number(state === 1) }] : []);
  if (known.length < MIN_KNOWN) throw new TypeError(`Mark at least ${MIN_KNOWN} known cells.`);
  const preferBedrock = layerThreshold(layer) <= 8388608;
  const seen = new Set();
  const rotations = [];
  for (const turns of allRotations ? [0,1,2,3] : [0]) {
    const cells = known.map(cell => {
      let {x,z} = cell;
      for (let turn=0;turn<turns;turn++) [x,z] = [GRID_SIZE-1-z,x];
      return { x,z,bedrock:cell.bedrock };
    });
    cells.sort((a,b) => a.z-b.z || a.x-b.x);
    const signature = cells.map(cell=>`${cell.x},${cell.z},${cell.bedrock}`).join(';');
    if (seen.has(signature)) continue;
    seen.add(signature);
    cells.sort((a,b)=>(preferBedrock?b.bedrock-a.bedrock:a.bedrock-b.bedrock) || a.z-b.z || a.x-b.x);
    rotations.push({ angle:turns*90,cells });
  }
  return rotations;
}

function integer(value, label, min, max) {
  const text = String(value).trim();
  if (!/^-?\d+$/.test(text)) throw new TypeError(`${label} must be an integer.`);
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new RangeError(`${label} must be between ${min} and ${max}.`);
  return number;
}

export function normalizeSearch(input) {
  const seed = parseSeed(input.seed).toString();
  const layer = integer(input.layer,'Layer',-63,-60);
  const centerX = integer(input.centerX,'Center X',MIN_COORD,MAX_ORIGIN);
  const centerZ = integer(input.centerZ,'Center Z',MIN_COORD,MAX_ORIGIN);
  const radius = integer(input.radius,'Radius',0,MAX_RADIUS);
  const pattern = Array.isArray(input.pattern) ? input.pattern.slice() : input.pattern;
  const rotations = compilePattern(pattern,input.allRotations !== false,layer);
  const minX = Math.max(MIN_COORD,centerX-radius), maxX = Math.min(MAX_ORIGIN,centerX+radius);
  const minZ = Math.max(MIN_COORD,centerZ-radius), maxZ = Math.min(MAX_ORIGIN,centerZ+radius);
  const width = maxX-minX+1, height = maxZ-minZ+1;
  return {seed,layer,centerX,centerZ,radius,pattern,rotations,minX,maxX,minZ,maxZ,width,height,total:width*height,threshold:layerThreshold(layer)};
}

export async function createBedrockEngine(bytes, job) {
  const { instance } = await WebAssembly.instantiate(bytes);
  const wasm = instance.exports;
  const memory = new Int32Array(wasm.memory.buffer);
  let offset = 1024 / 4;
  for (const orientation of job.rotations) for (const cell of orientation.cells) {
    memory[offset++] = cell.x; memory[offset++] = cell.z; memory[offset++] = cell.bedrock;
  }
  const factory = bedrockFactory(job.seed);
  wasm.configure(...factory,job.rotations[0].cells.length,job.rotations.length,job.layer,job.threshold,job.minX,job.minZ,job.width);
  return {
    sample:(x,y,z)=>wasm.sample(x,y,z),
    scan(start,count,cap=MAX_MATCHES) {
      if (!Number.isInteger(start) || start < 0 || start >= job.total || !Number.isInteger(count) || count < 1 || count > BATCH_SIZE || start+count > job.total || !Number.isInteger(cap) || cap < 1 || cap > MAX_MATCHES) throw new RangeError('Invalid search batch.');
      const checked = wasm.scan(start,count,cap);
      const matches = [];
      for (let index=0;index<wasm.found.value;index++) {
        const at = 8192/4+index*3;
        matches.push({x:memory[at],z:memory[at+1],rotation:job.rotations[memory[at+2]].angle});
      }
      return { checked,matches };
    },
  };
}
