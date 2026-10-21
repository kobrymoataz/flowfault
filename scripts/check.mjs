import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error('Node.js 22 or newer is required.');
  process.exit(1);
}

async function gather(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await gather(path));
    else if (entry.isFile() && entry.name.endsWith('.mjs')) files.push(path);
  }
  return files;
}

const paths = [];
for (const dir of ['src', 'scripts', 'tests']) {
  try { paths.push(...await gather(join(root, dir))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
let failures = 0;
for (const file of paths) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures++;
    console.error(result.stderr || `Syntax check failed: ${file}`);
  }
}
if (failures) process.exit(1);
console.log(`Verified ${paths.length} JavaScript module(s) with Node syntax checks.`);
console.log('Note: this is dependency-free JavaScript verification, not a TypeScript compiler.');
