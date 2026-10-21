import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dashboard/', import.meta.url)));
const modelPath = fileURLToPath(new URL('./report-model.mjs', import.meta.url));
const ASSETS = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/assets/site.css', ['site.css', 'text/css; charset=utf-8']],
  ['/assets/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/samples/baseline.json', ['samples/baseline.json', 'application/json; charset=utf-8']],
  ['/samples/current.json', ['samples/current.json', 'application/json; charset=utf-8']],
  ['/samples/scenario.json', ['samples/scenario.json', 'application/json; charset=utf-8']]
]);
const HEADERS = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; form-action 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Frame-Options': 'DENY'
};

export async function startDashboard({ port = 4173 } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Dashboard port must be 0-65535.');
  const server = createServer(async (req, res) => {
    const boundPort = server.address()?.port;
    // Reject unexpected Host values to reduce DNS rebinding exposure.
    const host = req.headers.host || '';
    if (![`127.0.0.1:${boundPort}`, `localhost:${boundPort}`].includes(host) ||
      (req.headers.origin && ![`http://127.0.0.1:${boundPort}`, `http://localhost:${boundPort}`].includes(req.headers.origin))) {
      res.writeHead(403, HEADERS); res.end('Local requests only.'); return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...HEADERS, Allow: 'GET, HEAD' }); res.end('Read-only dashboard.'); return;
    }
    const url = req.url || '/';
    const pathname = url.split('?')[0];
    const asset = ASSETS.get(pathname);
    const source = pathname === '/assets/report-model.mjs'
      ? [modelPath, 'text/javascript; charset=utf-8']
      : asset ? [resolve(root, asset[0]), asset[1]] : null;
    if (!source || url.includes('?') || url.includes('#')) {
      res.writeHead(404, HEADERS); res.end('Not found.'); return;
    }
    try {
      const body = await readFile(source[0]);
      res.writeHead(200, { ...HEADERS, 'Content-Type': source[1], 'Content-Length': body.byteLength });
      if (req.method === 'HEAD') res.end();
      else res.end(body);
    } catch (error) {
      res.writeHead(500, HEADERS); res.end('Dashboard asset unavailable.');
      console.error(`FlowFault dashboard asset error: ${error.code || 'unknown'}`);
    }
  });
  await new Promise((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolveReady(); });
  });
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/`;
  return {
    server, url,
    close: () => new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()))
  };
}
