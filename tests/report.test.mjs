import test from 'node:test';
import assert from 'node:assert/strict';
import { makeReport, renderHtml } from '../src/lib/report.mjs';

const report = () => makeReport({
  url:'https://example.com/form', title:'Registration', formCount:1, durationMs:123,
  blockedRequests:2, truncated:false, forms:[{index:0,id:'signup',method:'post',action:'https://example.com/post',fields:[],submitControls:1}]
}, {summary:{forms:1,analyzedForms:1,fields:0,issues:1,critical:0,warning:1,info:0},issues:[{
  code:'FF101',severity:'warning',title:'<script>bad</script>',detail:'<img src=x onerror=alert(1)>',recommendation:'Use label',formIndex:0,fieldIndex:0
}]});

test('report has a stable schema and operational safety notes', () => {
  const result = report();
  assert.equal(result.schemaVersion, '1.0');
  assert.equal(result.scan.mode, 'read-only');
  assert.equal(result.scan.blockedNonReadRequests, 2);
});

test('HTML report escapes untrusted page and finding content', () => {
  const result = renderHtml(report());
  assert.ok(result.includes('&lt;script&gt;bad&lt;/script&gt;'));
  assert.ok(!result.includes('<script>bad</script>'));
  assert.ok(result.includes("default-src 'none'"));
});

test('HTML report remains useful when there are no findings', () => {
  const item = report();
  item.issues = [];
  item.summary.issues = 0;
  assert.ok(renderHtml(item).includes('No findings from the rules'));
});
