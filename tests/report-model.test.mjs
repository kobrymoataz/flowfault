import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReport, compareReports, comparisonExport, findingFingerprint } from '../src/lib/report-model.mjs';
import { readFile } from 'node:fs/promises';
const sample = JSON.parse(await readFile(new URL('../examples/sample-report.json', import.meta.url)));
const scenario = JSON.parse(await readFile(new URL('../examples/scenario-report.json', import.meta.url)));
const cloned = a => JSON.parse(JSON.stringify(a));

test('parses inspection and does not carry arbitrary fields', () => {
  const payload = cloned(sample);
  payload.secret = 'NOT_PUBLIC';
  payload.scan.url = 'https://user:pass@example.org/register?api_token=SECRET#data';
  const data = normalizeReport(payload);
  assert.equal(data.kind, 'inspection');
  assert.equal(data.target, 'https://example.org/register');
  assert.ok(!JSON.stringify(data).includes('SECRET'));
  assert.ok(!JSON.stringify(data).includes('NOT_PUBLIC'));
  assert.equal(data.metrics.total, 4);
});
test('parses scenario and whitelist observation', () => {
  const data = normalizeReport(scenario);
  assert.equal(data.kind, 'scenario');
  assert.equal(data.profile, 'http-503');
  assert.equal(data.observation.status, 503);
});
test('rejects unsupported, malformed and excessive data', () => {
  assert.throws(() => normalizeReport({}), /Unsupported/);
  const x = cloned(sample); x.schemaVersion = '2.0';
  assert.throws(() => normalizeReport(x), /Unsupported/);
  const y = cloned(sample); y.issues[0].code = 'constructor';
  assert.throws(() => normalizeReport(y), /finding code/);
  const z = cloned(sample); z.issues = Array.from({length:1201},()=>z.issues[0]);
  assert.throws(() => normalizeReport(z), /too many/);
});
test('identical inspections have no added or resolved findings', () => {
  const r = normalizeReport(sample);
  const diff = compareReports(r, r);
  assert.equal(diff.counts.added, 0);
  assert.equal(diff.counts.resolved, 0);
  assert.equal(diff.counts.persisting, 4);
});
test('finding matching is order independent and counts duplicates', () => {
  const a = normalizeReport(sample);
  const b = normalizeReport({ ...sample, issues: [sample.issues[1], sample.issues[0], sample.issues[2]] });
  const diff = compareReports(a, b);
  assert.equal(diff.counts.resolved, 1);
  assert.equal(diff.counts.added, 0);
  assert.equal(diff.counts.persisting, 3);
  assert.equal(findingFingerprint(a.issues[0]), findingFingerprint(b.issues[1]));
});
test('tracks new critical and severity changes separately', () => {
  const a = normalizeReport(sample);
  const newItem = { ...sample.issues[1], code: 'FF202' };
  const b = normalizeReport({ ...sample, issues: [ ...sample.issues.map(x => x.code === 'FF110' ? {...x,severity:'info'} : x), newItem ] });
  const diff = compareReports(a, b);
  assert.equal(diff.counts.added, 1);
  assert.equal(diff.counts.newCritical, 1);
  assert.equal(diff.severityChanged.length, 1);
});
test('does not compare unrelated pages or report kinds', () => {
  const a = normalizeReport(sample);
  const b = normalizeReport({...sample,scan:{...sample.scan,url:'https://different.test/form'}});
  assert.equal(compareReports(a,b).compatible,false);
  assert.equal(compareReports(a,normalizeReport(scenario)).compatible,false);
});
test('compares same scenario and reports elapsed-time delta, not recovery', () => {
  const a = normalizeReport(scenario);
  const changed = normalizeReport({...scenario,observation:{...scenario.observation,elapsedMs:85,status:500}});
  const diff = compareReports(a,changed);
  assert.equal(diff.deltaMs,47);
  assert.equal(diff.statusChanged,true);
  assert.equal(diff.kind,'scenario');
  const wrong = normalizeReport({...scenario,experiment:{...scenario.experiment,profile:'offline'}});
  assert.equal(compareReports(a,wrong).compatible,false);
});
test('comparison export omits issue details and arbitrary input', () => {
  const a=normalizeReport(sample);
  const data=comparisonExport(compareReports(a,normalizeReport({...sample,issues:[]})));
  assert.equal(data.counts.resolved,4);
  assert.ok(!JSON.stringify(data).includes('aria-label'));
  assert.equal(data.generatedBy,'FlowFault 0.3.0');
});
