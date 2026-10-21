import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';

export async function startFixtureServer() {
  const html = await readFile(join(import.meta.dirname, '..', 'tests', 'fixture-page.html'), 'utf8');
  const received = [];
  const server = createServer((request, response) => {
    received.push({ method: request.method, url: request.url });
    if (request.url.startsWith('/')) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(html);
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/register?ticket=DO_NOT_PRINT_QUERY`,
    received,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  };
}
