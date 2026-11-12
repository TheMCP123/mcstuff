import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { handleApi } from '../worker/index.js';

const root = fileURLToPath(new URL('../public/', import.meta.url));
try { process.loadEnvFile(fileURLToPath(new URL('../../.dev.vars', import.meta.url))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = createServer(async (request, response) => {
  try {
    const localHost = [`127.0.0.1:${port}`, `localhost:${port}`].includes(request.headers.host) ? request.headers.host : `127.0.0.1:${port}`;
    const requestUrl = new URL(request.url, `http://${localHost}`);
    if (requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/')) {
      const abort = new AbortController();
      response.on('close', () => abort.abort());
      let body;
      if (request.method === 'POST') {
        const chunks = [];
        let size = 0;
        for await (const chunk of request) { size += chunk.length; if (size > 16384) { response.writeHead(413); response.end('Request too large'); return; } chunks.push(chunk); }
        body = Buffer.concat(chunks);
      }
      const result = await handleApi(new Request(requestUrl, { method: request.method, headers: request.headers, signal: abort.signal, ...(body ? { body } : {}) }), fetch, { CURSEFORGE_API_KEY: process.env.CURSEFORGE_API_KEY });
      response.writeHead(result.status, Object.fromEntries(result.headers));
      if (request.method === 'HEAD' || !result.body) response.end();
      else { for await (const chunk of result.body) { if (response.destroyed) break; if (!response.write(chunk)) await new Promise(resolve => response.once('drain',resolve)); } response.end(); }
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(resolve(root) + sep)) { response.writeHead(403); response.end('Forbidden'); return; }
    try {
      if (!(await stat(path)).isFile()) throw new Error('Not a file');
    } catch {
      if (extname(pathname)) { response.writeHead(404); response.end('Not found'); return; }
      path = resolve(root, 'index.html');
    }
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    if (response.headersSent) response.destroy();
    else { response.writeHead(400); response.end('Bad request'); }
  }
});
server.listen(port, '127.0.0.1', () => console.log(`MCStuff Local: http://127.0.0.1:${port}`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
