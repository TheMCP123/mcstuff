import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';

const reference=JSON.parse(await readFile(new URL('./fixtures/bedrock-1.21.11.json',import.meta.url),'utf8')).seeds[3];
const input={seed:reference.seed,layer:-61,centerX:1036,centerZ:-966,radius:20,allRotations:true,pattern:reference.pattern.rows.join('').split('').map(value=>value==='B'?1:2)};
const spawn=()=>new Worker(new URL('../scripts/bedrock-test-worker.mjs',import.meta.url));

test('real worker protocol produces progress and exact results without blocking its caller',async t=>{
  const worker=spawn();t.after(()=>worker.terminate());
  const messages=[];
  const complete=new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',data=>{messages.push(data);if(data.type==='done'||data.type==='error')resolve(data);});});
  worker.postMessage({type:'search',input});
  const end=await complete;
  assert.equal(end.type,'done');assert.equal(end.complete,true);assert.equal(end.capped,false);assert.equal(end.checked,41*41);
  assert.equal(messages[0].type,'progress');assert.equal(messages[0].checked,0);
  assert.ok(messages.flatMap(message=>message.matches||[]).some(match=>match.x===1036&&match.z===-966&&match.rotation===0));
  assert.ok(messages.every((message,index)=>index===0||message.checked>=messages[index-1].checked));
});

test('worker rejects an empty pattern instead of reporting fake coordinates',async t=>{
  const worker=spawn();t.after(()=>worker.terminate());
  const result=new Promise((resolve,reject)=>{worker.on('error',reject);worker.once('message',resolve);});
  worker.postMessage({type:'search',input:{...input,pattern:Array(100).fill(0)}});
  const data=await result;assert.equal(data.type,'error');assert.match(data.message,/at least 8/);
});

test('a long worker search can be terminated without completing in the background',async()=>{
  const worker=spawn();let completed=false;
  try{
    const progress=new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',data=>{if(data.type==='done')completed=true;if(data.type==='progress')resolve();});});
    worker.postMessage({type:'search',input:{...input,centerX:0,centerZ:0,radius:8192}});
    await progress;await worker.terminate();assert.equal(completed,false);
  }finally{await worker.terminate();}
});
