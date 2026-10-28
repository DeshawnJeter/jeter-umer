import { createServer } from 'node:http';
import { readFile, stat, readdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { Manager } from './orchestrator/manager.js';
import { terminalStates } from '../../../shared/policies/index.js';
const manager = new Manager(); await manager.initialize();
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be 1024–65535');
const origin = `http://127.0.0.1:${port}`;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('Use application/json');
  let text = ''; for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 12000) throw new Error('Request too large'); } return JSON.parse(text || '{}');
}
async function serve(res, base, relative, preview = false) {
  const file = resolve(base, relative); const root = resolve(base);
  if (!file.startsWith(root + sep) || relative.split(/[\\/]/).some(part => part.startsWith('.'))) { json(res, 404, { error: 'Not found' }); return; }
  if (!(await stat(file)).isFile()) throw new Error('Not a file');
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(preview ? { 'Access-Control-Allow-Origin': '*', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; object-src 'none'; base-uri 'none'" } : {}) }); res.end(await readFile(file));
}
async function archive(folder) {
  const { zipSync } = await import('fflate'); const files = {};
  async function walk(dir, prefix = '') { for (const entry of await readdir(dir, { withFileTypes: true })) { const key = prefix + entry.name; if (entry.isDirectory()) await walk(resolve(dir, entry.name), key + '/'); else files[key] = new Uint8Array(await readFile(resolve(dir, entry.name))); } }
  await walk(folder); return zipSync(files);
}
const server = createServer(async (req, res) => {
  try {
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) return json(res, 403, { error: 'Local access only' });
    const url = new URL(req.url, origin); const parts = decodeURIComponent(url.pathname).split('/').filter(Boolean);
    if (req.method === 'POST') {
      if (req.headers.origin && ![origin, `http://localhost:${port}`].includes(req.headers.origin)) return json(res, 403, { error: 'Origin rejected' });
      if (parts[0] !== 'api' || parts[1] !== 'runs') return json(res, 404, { error: 'Not found' });
      const data = await body(req);
      if (parts.length === 2) {
        if ([...manager.runs.values()].filter(run => !terminalStates.has(run.status)).length >= 5) throw new Error('Finish or cancel an existing run before creating another');
        return json(res, 201, await manager.create(data));
      }
      if (parts.length === 4) return json(res, 200, await manager.act(parts[2], parts[3], data));
      return json(res, 404, { error: 'Not found' });
    }
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
    if (url.pathname === '/api/runs') return json(res, 200, [...manager.runs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    if (parts[0] === 'api' && parts[1] === 'runs' && parts.length === 3) return json(res, 200, manager.get(parts[2]));
    if (parts[0] === 'api' && parts[1] === 'runs' && parts[3] === 'download' && parts.length === 4) {
      const run = manager.get(parts[2]); if (!run.build) throw new Error('No build available');
      const bytes = await archive(resolve(manager.store.folder(run.id), 'builds', String(run.build.generation)));
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="star-collector.zip"' }); return res.end(bytes);
    }
    if (parts[0] === 'preview' && parts.length >= 4) {
      const run = manager.get(parts[1]); if (!/^\d+$/.test(parts[2]) || !run.build || Number(parts[2]) !== run.build.generation) return json(res, 404, { error: 'Build unavailable' });
      return await serve(res, resolve(manager.store.folder(run.id), 'builds', parts[2]), parts.slice(3).join('/'), true);
    }
    if (url.pathname === '/') return await serve(res, 'apps/web', 'index.html');
    if (url.pathname === '/app.js' || url.pathname === '/style.css') return await serve(res, 'apps/web', parts[0]);
    json(res, 404, { error: 'Not found' });
  } catch (error) { json(res, error.code === 'ENOENT' ? 404 : 400, { error: error.code === 'ENOENT' ? 'Not found' : error.message }); }
});
server.listen(port, '127.0.0.1', () => console.log(`Game builder: ${origin} (scripted demo, no API key)`));
