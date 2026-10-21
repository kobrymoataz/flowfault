import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { startFixtureServer } from './fixture-server.mjs';

const fixture = await startFixtureServer();
try {
  const child = spawn(process.execPath, [
    resolve(import.meta.dirname, '..', 'src', 'cli.mjs'), 'inspect', fixture.url,
    '--json', 'reports/demo.json', '--html', 'reports/demo.html'
  ], { stdio: 'inherit' });
  const code = await new Promise(resolve => child.once('close', resolve));
  if (code !== 0) process.exitCode = code || 1;
  if (fixture.received.some(request => request.method !== 'GET' && request.method !== 'HEAD')) {
    throw new Error('Safety check failed: fixture received a write request.');
  }
  console.log('Demo report: reports/demo.html');
} finally {
  await fixture.close();
}
