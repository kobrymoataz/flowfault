import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareReportFiles, loadReportFile, shouldFailComparison } from '../src/lib/report-files.mjs';
import { parseArgs } from '../src/lib/args.mjs';

const fixture = new URL('../examples/sample-report.json', import.meta.url);
test('compare CLI options do not affect existing inspect and simulate', () => {
  assert.deepEqual(parseArgs(['compare','a.json','b.json']), {
    command:'compare',baseline:'a.json',current:'b.json',failOn:'none'
  });
  assert.equal(parseArgs(['compare','a','b','--json','out.json','--fail-on','new-critical']).failOn,'new-critical');
  assert.equal(parseArgs(['inspect','http://127.0.0.1:3000']).command,'inspect');
  assert.equal(parseArgs(['simulate','http://127.0.0.1:3000','--endpoint','/api/health','--profile','offline']).command,'simulate');
  assert.throws(()=>parseArgs(['compare','a']),/requires two/);
  assert.throws(()=>parseArgs(['compare','a','b','--fail-on','critical']),/must be/);
  assert.throws(()=>parseArgs(['compare','a','b','--json','a','--json','b']),/repeated/);
});
test('compare local inputs, output JSON, preserve source files', async () => {
  const folder = await mkdtemp(join(tmpdir(),'flowfault-compare-'));
  try {
    const original = await readFile(fixture,'utf8');
    const baseline = join(folder,'baseline.json');
    const current = join(folder,'current.json');
    const json = join(folder,'out.json');
    await writeFile(baseline,original);
    const parsed=JSON.parse(original); parsed.issues = parsed.issues.slice(0,2);
    await writeFile(current,JSON.stringify(parsed));
    const result=await compareReportFiles({baseline,current,json});
    assert.equal(result.counts.resolved,2);
    assert.equal(shouldFailComparison(result,'any-new'),false);
    assert.equal((await readFile(baseline,'utf8')),original);
    assert.equal(JSON.parse(await readFile(json,'utf8')).counts.resolved,2);
    await assert.rejects(compareReportFiles({baseline,current,json:baseline}),/cannot overwrite/);
  } finally {await rm(folder,{recursive:true,force:true});}
});
test('refuses oversized and invalid JSON files', async () => {
  const folder=await mkdtemp(join(tmpdir(),'flowfault-compare-invalid-'));
  try {
    const path=join(folder,'oversized.json');
    await writeFile(path,'x'.repeat(2*1024*1024+1));
    await assert.rejects(loadReportFile(path),/smaller/);
    await writeFile(path,'not json');
    await assert.rejects(loadReportFile(path),/Cannot parse/);
  } finally {await rm(folder,{recursive:true,force:true});}
});
