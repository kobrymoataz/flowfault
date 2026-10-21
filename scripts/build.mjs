import { chmod, cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'src');
const target = resolve(root, 'dist');
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
await chmod(resolve(target, 'cli.mjs'), 0o755);
console.log('Built dist/cli.mjs and all runtime modules (no external dependencies).');
