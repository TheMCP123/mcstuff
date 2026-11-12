import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import wabtFactory from 'wabt';
import { parseSeed,bedrockFactory,layerThreshold,compilePattern,normalizeSearch,createBedrockEngine,BATCH_SIZE,MIN_COORD,MAX_ORIGIN } from '../public/bedrock-data.js';

const references = await Promise.all(['1.21.11','26.3'].map(async version=>JSON.parse(await readFile(new URL(`./fixtures/bedrock-${version}.json`,import.meta.url),'utf8'))));
const reference = references[0];
const bytes = await readFile(new URL('../public/bedrock-engine.wasm',import.meta.url));
const cells = rows => rows.join('').split('').map(value=>value==='B'?1:2);
const request = (entry=reference.seeds[0],extra={}) => ({seed:entry.seed,layer:-61,centerX:1036,centerZ:-966,radius:12,allRotations:true,pattern:cells(entry.pattern.rows),...extra});

test('the shipped WASM artifact matches the checked-in source with the pinned compiler',async()=>{
  const wabt=await wabtFactory(),source=await readFile(new URL('../engine/bedrock.wat',import.meta.url),'utf8');
  const module=wabt.parseWat('bedrock.wat',source);
  try{module.resolveNames();module.validate();assert.deepEqual(Buffer.from(module.toBinary({canonicalize_lebs:true,write_debug_names:false}).buffer),bytes);}finally{module.destroy();}
});

test('bedrock seeds preserve all 64 signed bits and reject invalid numeric input',()=>{
  for(const text of ['0','-1','9007199254740993','9223372036854775807','-9223372036854775808'])assert.equal(parseSeed(text).toString(),text);
  for(const value of ['', 'hello','1e4','1.5','9223372036854775808','-9223372036854775809',9007199254740993])assert.throws(()=>parseSeed(value));
});

test('named bedrock factory matches actual Minecraft 1.21.11 and 26.3 seeds',()=>{
  assert.equal(createHash('md5').update('minecraft:bedrock_floor').digest('hex'),'bbf7928b7bf1d285c4dc7cf90e1b3b94');
  for(const entry of references.flatMap(reference=>reference.seeds))assert.deepEqual(bedrockFactory(entry.seed),entry.factory.map(value=>BigInt.asUintN(64,BigInt(value))),entry.seed);
});

test('WebAssembly matches 504 vanilla RNG samples, including int overflow and negative coordinates',async()=>{
  let count=0;
  for(const entry of references.flatMap(reference=>reference.seeds)){const engine=await createBedrockEngine(bytes,normalizeSearch(request(entry)));for(const [x,y,z,expected]of entry.samples){assert.equal(engine.sample(x,y,z),expected,`${entry.seed}: ${x},${y},${z}`);count++;}}
  assert.equal(count,504);
});

test('bedrock layer thresholds preserve the strict comparison with nextFloat',()=>{
  assert.deepEqual([-63,-62,-61,-60].map(layerThreshold),[13421773,10066330,6710887,3355444]);
  assert.throws(()=>layerThreshold(-64));assert.throws(()=>layerThreshold(-59));
});

test('search recovers each vanilla 10 by 10 pattern at its known coordinates',async()=>{
  for(const entry of references.flatMap(reference=>reference.seeds)){const job=normalizeSearch(request(entry));const engine=await createBedrockEngine(bytes,job);const result=engine.scan(0,job.total);assert.equal(result.checked,job.total);assert.ok(result.matches.some(match=>match.x===1036&&match.z===-966&&match.rotation===0),entry.seed);}
});

test('Unknown cells are ignored while Other remains an exact negative constraint',async()=>{
  const entry=reference.seeds[3], pattern=cells(entry.pattern.rows);
  const partial=pattern.map((value,index)=>index%3===0?0:value);
  const job=normalizeSearch(request(entry,{pattern:partial,radius:0,allRotations:false}));
  assert.equal((await createBedrockEngine(bytes,job)).scan(0,1).matches.length,1);
  const changed=pattern.slice();changed[0]=changed[0]===1?2:1;
  const mismatch=normalizeSearch(request(entry,{pattern:changed,radius:0,allRotations:false}));
  assert.deepEqual((await createBedrockEngine(bytes,mismatch)).scan(0,1).matches,[]);
});

test('rotations report the world northwest corner and deduplicate symmetrical patterns',async()=>{
  const entry=reference.seeds[3], pattern=cells(entry.pattern.rows), rotated=Array(100);
  for(let z=0;z<10;z++)for(let x=0;x<10;x++)rotated[x*10+9-z]=pattern[z*10+x];
  const job=normalizeSearch(request(entry,{pattern:rotated,radius:0}));
  assert.deepEqual((await createBedrockEngine(bytes,job)).scan(0,1).matches,[{x:1036,z:-966,rotation:270}]);
  assert.equal(compilePattern(Array(100).fill(2)).length,1);
});

test('bounded search validates the grid, layer, coordinates, radius and batch sizes',async()=>{
  for(const extra of [{pattern:Array(100).fill(0)},{pattern:[1]},{pattern:Array(100).fill(3)},{radius:8193},{radius:-1},{radius:'1.5'},{layer:-64},{centerX:MAX_ORIGIN+1}])assert.throws(()=>normalizeSearch(request(undefined,extra)));
  const edge=normalizeSearch(request(undefined,{centerX:MIN_COORD,centerZ:MAX_ORIGIN,radius:12}));
  assert.equal(edge.minX,MIN_COORD);assert.equal(edge.maxZ,MAX_ORIGIN);assert.equal(edge.total,13*13);
  const job=normalizeSearch(request()),engine=await createBedrockEngine(bytes,job);
  for(const args of [[-1,1],[0,BATCH_SIZE+1],[job.total,1],[0,0],[0,1,101]])assert.throws(()=>engine.scan(...args));
});

test('result cap stops a broad pattern early and chunked scans preserve every result',async()=>{
  const broad=Array(100).fill(0);broad.fill(2,0,8);
  const job=normalizeSearch(request(undefined,{centerX:0,centerZ:0,radius:128,pattern:broad,allRotations:false}));
  const engine=await createBedrockEngine(bytes,job), result=engine.scan(0,Math.min(job.total,BATCH_SIZE),5);
  assert.equal(result.matches.length,5);assert.ok(result.checked<BATCH_SIZE);
  const exactJob=normalizeSearch(request()),exact=await createBedrockEngine(bytes,exactJob);
  const all=exact.scan(0,exactJob.total).matches,parts=[];
  for(let offset=0;offset<exactJob.total;offset+=27)parts.push(...exact.scan(offset,Math.min(27,exactJob.total-offset)).matches);
  assert.deepEqual(parts,all);
});
