import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, hasFailingIssues } from '../src/lib/analyze.mjs';

const field = overrides => ({
  index: 0, tag: 'input', type: 'email', id: 'email', name: 'email', required: true,
  disabled: false, nameSource: 'label', hasPlaceholder: false, autocomplete: 'email',
  ...overrides
});
const snapshot = (formOverrides = {}, other = {}) => ({
  url: 'https://example.com/register', formCount: 1, truncated: false,
  duplicateIds: [], forms: [{index:0, id:'registration', action:'https://example.com/register', method:'post',
    submitControls: 1, fields:[field()], ...formOverrides}], ...other
});

test('valid form has no issues', () => {
  assert.deepEqual(analyze(snapshot()).summary, {
    forms: 1, analyzedForms: 1, fields: 1, issues: 0, critical: 0, warning: 0, info: 0
  });
});

test('identifies missing labels including placeholder-only forms', () => {
  const report = analyze(snapshot({fields:[field({nameSource:'none', hasPlaceholder:true})]}));
  assert.equal(report.issues[0].code, 'FF101');
  assert.equal(report.issues[0].severity, 'warning');
});

test('detects password in GET and insecure HTTPS form action', () => {
  const report = analyze(snapshot({method:'get', action:'http://example.com/login', fields:[field({type:'password'})]}));
  assert.equal(report.summary.critical, 2);
  assert.deepEqual(report.issues.filter(issue => issue.severity === 'critical').map(issue => issue.code), ['FF201','FF202']);
});

test('detects repeated ids and missing submit control', () => {
  const report = analyze(snapshot({submitControls:0}, {duplicateIds:[{id:'email',count:3}]}));
  assert.ok(report.issues.some(issue => issue.code === 'FF110'));
  assert.ok(report.issues.some(issue => issue.code === 'FF121'));
});

test('skips disabled controls in label diagnostics', () => {
  assert.equal(analyze(snapshot({fields:[field({disabled:true,nameSource:'none'})]})).summary.warning, 0);
});

test('threshold controls exit policy', () => {
  const report = analyze(snapshot({fields:[field({nameSource:'none'})]}));
  assert.equal(hasFailingIssues(report.issues, 'none'), false);
  assert.equal(hasFailingIssues(report.issues, 'critical'), false);
  assert.equal(hasFailingIssues(report.issues, 'warning'), true);
});

test('reports no forms without inventing a failure', () => {
  const report = analyze({url:'https://example.com',formCount:0,truncated:false,duplicateIds:[],forms:[]});
  assert.equal(report.summary.info, 1);
  assert.equal(report.summary.warning, 0);
});

test('does not flag a disabled password as a GET credential leak', () => {
  const report = analyze(snapshot({method:'get',fields:[field({type:'password',disabled:true})]}));
  assert.equal(report.summary.critical, 0);
});
