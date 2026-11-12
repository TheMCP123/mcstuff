import { normalizeSearch,createBedrockEngine,BATCH_SIZE,MAX_MATCHES } from './bedrock-data.js';

let started = false;
self.onmessage = async event => {
  if (event.data?.type !== 'search' || started) return;
  started = true;
  const start = performance.now();
  try {
    const job = normalizeSearch(event.data.input);
    const response = await fetch(new URL('./bedrock-engine.wasm',import.meta.url));
    if (!response.ok) throw new Error('The search engine could not load. Reload and try again.');
    const engine = await createBedrockEngine(await response.arrayBuffer(),job);
    let checked=0, found=0, pending=[], lastReport=0;
    self.postMessage({type:'progress',checked,total:job.total,matches:[],elapsedMs:performance.now()-start});
    while (checked < job.total && found < MAX_MATCHES) {
      const batch = engine.scan(checked,Math.min(BATCH_SIZE,job.total-checked),MAX_MATCHES-found);
      checked += batch.checked; found += batch.matches.length; pending.push(...batch.matches);
      const now=performance.now();
      if (now-lastReport >= 100) {
        self.postMessage({type:'progress',checked,total:job.total,matches:pending,elapsedMs:now-start});
        pending=[]; lastReport=now;
      }
      if (checked < job.total && found < MAX_MATCHES) await new Promise(resolve=>setTimeout(resolve,0));
    }
    self.postMessage({type:'done',checked,total:job.total,matches:pending,elapsedMs:performance.now()-start,complete:checked===job.total&&found<MAX_MATCHES,capped:found>=MAX_MATCHES});
  } catch (error) {
    self.postMessage({type:'error',message:error instanceof Error?error.message.slice(0,240):'The search failed.'});
  }
};
