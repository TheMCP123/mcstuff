import { parentPort } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';

globalThis.self=globalThis;
globalThis.postMessage=message=>parentPort.postMessage(message);
globalThis.fetch=async url=>{
  const engine=new URL('../public/bedrock-engine.wasm',import.meta.url);
  if(String(url)!==engine.href)throw new Error('Unexpected worker request');
  return new Response(await readFile(engine),{headers:{'Content-Type':'application/wasm'}});
};
await import('../public/bedrock-worker.js');
parentPort.on('message',data=>self.onmessage({data}));
