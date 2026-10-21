import assert from 'node:assert/strict';
import { inspect } from '../src/lib/inspect.mjs';
import { analyze } from '../src/lib/analyze.mjs';
import { makeReport, renderHtml } from '../src/lib/report.mjs';
import { startFixtureServer } from './fixture-server.mjs';

const fixture = await startFixtureServer();
try {
  const snapshot = await inspect(fixture.url, { wait: 200 });
  const analysis = analyze(snapshot);
  const report = makeReport(snapshot, analysis);
  const serialized = JSON.stringify(report) + renderHtml(report);
  assert.equal(snapshot.formCount, 1);
  assert.equal(snapshot.forms[0].fields.length, 3);
  assert.ok(analysis.issues.some(item => item.code === 'FF201'), 'password GET rule');
  assert.ok(analysis.issues.some(item => item.code === 'FF101'), 'label rule');
  assert.ok(analysis.issues.some(item => item.code === 'FF110'), 'duplicate id rule');
  assert.ok(snapshot.blockedRequests >= 1, 'POST interception was active');
  assert.ok(!serialized.includes('DO_NOT_CAPTURE_123'), 'password values must not be exported');
  assert.ok(!serialized.includes('DO_NOT_PRINT_QUERY'), 'query strings must be omitted');
  assert.ok(!serialized.includes('PRIVATE_QUERY_STRING'), 'action query strings must be omitted');
  assert.ok(!fixture.received.some(req => req.method !== 'GET' && req.method !== 'HEAD'), 'no write requests reach fixture');
  console.log('Integration passed: Chromium DOM read, diagnostics, read-only network interception, report privacy.');
} finally {
  await fixture.close();
}
