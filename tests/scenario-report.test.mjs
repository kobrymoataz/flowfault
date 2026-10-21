import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createScenario } from '../src/lib/scenario.mjs';
import { makeScenarioReport, renderScenarioHtml, saveScenarioReports } from '../src/lib/scenario-report.mjs';

const raw = {
  scenario:createScenario({ url:'http://127.0.0.1:3000/register?secret=TOKEN_PRIVATE',endpoint:'/api/health',profile:'http-503' }),
  observation:{kind:'http-response',status:503,ok:false,elapsedMs:42},
  interceptionsApplied:1, blockedNonReadRequests:2, durationMs:308,
  interpretation:'Browser received a synthetic HTTP 503.'
};

test('scenario report projects only safe fields and never retains query', () => {
  const report=makeScenarioReport(raw);
  assert.equal(report.tool.version,'0.3.0');
  assert.equal(report.experiment.page,'http://127.0.0.1:3000/register');
  assert.equal(report.observation.status,503);
  assert.ok(!JSON.stringify(report).includes('TOKEN_PRIVATE'));
  assert.ok(report.limitations.some(item=>item.includes('not the application error UI')));
});
test('HTML escapes untrusted report fields and forbids scripts', () => {
  const report=makeScenarioReport(raw);
  report.interpretation='<script>alert(1)</script>';
  report.experiment.endpoint='/api/<img src=x>';
  const html=renderScenarioHtml(report);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes("default-src 'none'"));
});
test('standalone files are written with matching schema', async () => {
  const dir=await mkdtemp(join(tmpdir(),'flowfault-report-test-'));
  try {
    const json=join(dir,'out.json'),html=join(dir,'out.html');
    await saveScenarioReports(makeScenarioReport(raw),{json,html});
    assert.equal(JSON.parse(await readFile(json,'utf8')).observation.status,503);
    assert.match(await readFile(html,'utf8'),/Observe the failure/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('simulate CLI accepts JSON and HTML output paths without changing inspect behavior', async () => {
  const {parseArgs}=await import('../src/lib/args.mjs');
  const options=parseArgs(['simulate','http://localhost:3000/register','--endpoint','/api/health','--profile','offline','--json','reports/a.json','--html','reports/a.html']);
  assert.equal(options.json,'reports/a.json');
  assert.equal(options.html,'reports/a.html');
});
