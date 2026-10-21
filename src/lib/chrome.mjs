import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { CdpClient } from './cdp.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function findChrome(explicit = process.env.FLOWFAULT_CHROME_PATH) {
  const candidates = [
    explicit,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    join(homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    join(homedir(), 'Desktop/Google Chrome.app/Contents/MacOS/Google Chrome'),
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/opt/google/chrome/chrome'
  ].filter(Boolean);
  if (process.platform === 'win32') {
    const programFiles = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA];
    for (const dir of programFiles.filter(Boolean)) candidates.push(join(dir, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  }
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* try next */ }
  }
  return null;
}

/** Launch a separate disposable Chrome profile so the user's own profile is untouched. */
export async function launchChrome({ executable, startupTimeout = 12000 }) {
  const path = await findChrome(executable);
  if (!path) throw new Error('Chrome or Chromium was not found. Install Google Chrome or set FLOWFAULT_CHROME_PATH.');
  const profile = await mkdtemp(join(tmpdir(), 'flowfault-chrome-'));
  const args = [
    '--headless=new', '--disable-gpu', '--disable-background-networking',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-sync', '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
  ];
  if (process.platform === 'linux' && typeof process.getuid === 'function' && process.getuid() === 0) {
    args.unshift('--no-sandbox');
  }
  const child = spawn(path, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let error = '';
  child.stderr.on('data', chunk => { error = (error + chunk.toString()).slice(-1800); });
  let exited = false;
  child.once('error', failure => { exited = true; error = failure.message; });
  child.once('exit', () => { exited = true; });
  const cleanup = async () => {
    if (!exited) {
      child.kill('SIGTERM');
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), sleep(2000)]);
      if (!exited) child.kill('SIGKILL');
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
  };

  try {
    const start = Date.now();
    let port;
    while (Date.now() - start < startupTimeout) {
      if (exited) throw new Error(`Chrome exited before debugging started. ${error.slice(-500)}`);
      try {
        const active = await readFile(join(profile, 'DevToolsActivePort'), 'utf8');
        port = Number(active.split('\n')[0]);
        if (Number.isInteger(port) && port > 0) break;
      } catch { /* Chrome is still starting */ }
      await sleep(100);
    }
    if (!port) throw new Error(`Chrome did not start its debugging session. ${error.slice(-500)}`);
    let page;
    for (let i = 0; i < 25; i++) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        if (response.ok) page = (await response.json()).find(item => item.type === 'page');
      } catch { /* try again */ }
      if (page?.webSocketDebuggerUrl) break;
      await sleep(100);
    }
    if (!page?.webSocketDebuggerUrl) throw new Error('Chrome started, but no page debugging target was available.');
    const cdp = await CdpClient.connect(page.webSocketDebuggerUrl);
    return {
      cdp,
      async close() { cdp.close(); await cleanup(); }
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
