import { PACK_TYPES, MAX_FILE_BYTES, MAX_PACK_BYTES, downloadPath, projectKey, safeFilename, packManifest } from './pack-data.js';
import { createPackZip, verifyFile } from './pack-zip.js';

export async function fetchPackFile(item, context, { signal, fetcher = fetch } = {}) {
  const response = await fetcher(downloadPath(item,context), { signal, cache: 'no-store', credentials: 'omit' });
  if (!response.ok) {
    let data;
    try { data = await response.json(); } catch { /* Non-JSON failures must not become files. */ }
    const error = new Error(data?.message || 'The source could not deliver this file. Open its project page.');
    error.status = response.status;
    throw error;
  }
  if (!response.body) throw new Error('The download returned no file.');
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > MAX_FILE_BYTES) { await reader.cancel(); throw new Error('File exceeds the 64 MB limit. Download it separately.'); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  signal?.throwIfAborted();
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.length; }
  const sha1=response.headers.get('X-MCStuff-SHA1'), sha512=response.headers.get('X-MCStuff-SHA512');
  const hashes = sha1 || sha512 ? {sha1,sha512} : item.version.hashes || {};
  const size = response.headers.has('X-MCStuff-Size') ? Number(response.headers.get('X-MCStuff-Size')) : item.version.size;
  await verifyFile(bytes,hashes,size);
  const name = response.headers.get('X-MCStuff-Filename');
  return { bytes, filename: safeFilename(name ? decodeURIComponent(name) : item.version.filename), hashes };
}

export async function exportPackZip(name, context, items, { signal, fetcher = fetch, onProgress = () => {} } = {}) {
  if (!items.length) throw new Error('Add at least one project.');
  const files = new Array(items.length);
  const outcomes = new Array(items.length);
  let next = 0;
  let completed = 0;
  let totalBytes = 0;
  let limited = false;
  let tooLarge = false;
  async function worker() {
    while (next < items.length && !limited && !tooLarge) {
      signal?.throwIfAborted();
      const index = next++;
      const item = items[index];
      const key = projectKey(item.project);
      if (item.version.downloadMode === 'manual') outcomes[index] = { key, included: false, reason: 'Author requires a manual download.' };
      else try {
        const file = await fetchPackFile(item,context,{signal,fetcher});
        totalBytes += file.bytes.length;
        if (totalBytes > MAX_PACK_BYTES - 1048576) { tooLarge = true; throw new Error('This pack exceeds the 128 MB ZIP limit. Download it in smaller groups.'); }
        files[index] = { path: `${PACK_TYPES[context.type].folder}/${file.filename}`, data: file.bytes };
        outcomes[index] = { key, included: true, filename: file.filename, hashes: file.hashes };
      } catch (error) {
        if (signal?.aborted) throw error;
        outcomes[index] = { key, included: false, reason: error.message };
        if (error.status === 429) limited = true;
      }
      completed++;
      onProgress({ completed,total:items.length,title:item.project.title });
    }
  }
  await Promise.all([worker(),worker()]);
  signal?.throwIfAborted();
  if (tooLarge) throw new Error('This pack exceeds the 128 MB ZIP limit. Download it in smaller groups.');
  items.forEach((item,index)=> { outcomes[index] ||= {key:projectKey(item.project),included:false,reason:'Not downloaded after the source rate limit.'}; });
  const missing = items.filter((item,index)=>!outcomes[index].included);
  const manifest = packManifest(name,context,items,outcomes);
  const entries = files.filter(Boolean);
  entries.push({path:'mcstuff-pack.json',data:JSON.stringify(manifest,null,2)});
  if (missing.length) entries.push({path:'MANUAL_DOWNLOADS.txt',data:missing.map(item=> { const outcome=outcomes.find(outcome=>outcome.key===projectKey(item.project)); return `${item.project.title} (${item.version.number})\n${item.project.url}\n${outcome.reason}\nPlace the file in ${PACK_TYPES[context.type].folder}/\n`; }).join('\n')});
  const archive = createPackZip(entries);
  return { archive,manifest,missing,downloaded:files.filter(Boolean).length };
}
