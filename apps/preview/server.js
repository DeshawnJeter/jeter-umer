import {createServer, request} from 'node:http';
import {request as secureRequest} from 'node:https';
import {pathToFileURL} from 'node:url';

// This relay has no disk, credentials or workshop routes. The upstream still
// validates every signed, expiring game capability before serving any asset.
export function previewRelay({upstream, previewOrigin, secret}) {
  const target = new URL(upstream);
  const origin = new URL(previewOrigin);
  if(!['http:','https:'].includes(target.protocol) || target.username || target.password || target.pathname !== '/' || target.search || target.hash) throw Error('Use an exact HTTP(S) upstream origin');
  if(target.protocol === 'https:' && (typeof secret !== 'string' || secret.length < 32)) throw Error('Public upstream requires a relay secret');
  if(origin.protocol !== 'https:' || origin.origin !== previewOrigin) throw Error('Use an exact HTTPS preview origin');
  return createServer((req, res) => {
    const reject = (status, message) => {res.writeHead(status, {'Content-Type':'text/plain','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(message);};
    if(req.url === '/healthz' && req.method === 'GET') return reject(200, 'ready');
    if(req.headers.host !== origin.host) return reject(403, 'Host rejected');
    // Validate the raw path, before URL normalization can remove dot segments.
    if(req.method !== 'GET' || !/^\/play\/[A-Za-z0-9._-]+\/preview\/[A-Za-z0-9-]+\/\d+\/[A-Za-z0-9_./-]+$/.test(req.url || '') || req.url.split('/').some(p => p === '.' || p === '..' || p.startsWith('.'))) return reject(404, 'Game asset not found');
    const headers = {host:secret?target.host:origin.host};
    if(secret) headers['x-workshop-preview-relay'] = secret;
    if(req.headers['sec-fetch-dest'] === 'worker') headers['sec-fetch-dest'] = 'worker';
    const outgoing = (target.protocol === 'https:'?secureRequest:request)({hostname:target.hostname, port:target.port || (target.protocol==='https:'?443:80), path:req.url, method:'GET', headers, timeout:90000}, incoming => {
      // Do not let any upstream response create credentials or redirects here.
      const safe = {};
      for(const key of ['content-type','content-security-policy','access-control-allow-origin','cache-control','x-content-type-options','referrer-policy','permissions-policy','strict-transport-security']) if(incoming.headers[key]) safe[key] = incoming.headers[key];
      res.writeHead(incoming.statusCode || 502, safe); incoming.pipe(res);
      incoming.on('error', () => res.destroy());
    });
    outgoing.on('timeout', () => outgoing.destroy());
    outgoing.on('error', () => {if(!res.headersSent) reject(502, 'Preview temporarily unavailable'); else res.destroy();});
    res.on('close', () => outgoing.destroy());
    outgoing.end();
  });
}

if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const configured=process.env.WORKSHOP_UPSTREAM;
  const server = previewRelay({upstream:configured?.includes('://')?configured:`http://${configured}`, previewOrigin:process.env.WORKSHOP_PREVIEW_ORIGIN,secret:process.env.WORKSHOP_PREVIEW_RELAY_SECRET});
  server.requestTimeout = 20000; server.headersTimeout = 10000; server.maxConnections = 100;
  server.listen(Number(process.env.PORT || 10000), '0.0.0.0');
  process.on('SIGTERM', () => {server.close(); setTimeout(() => process.exit(0), 10000).unref();});
}
