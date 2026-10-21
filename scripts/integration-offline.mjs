import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launchChrome } from '../src/lib/chrome.mjs';
import { DOM_COLLECTOR } from '../src/lib/collector.mjs';
import { analyze } from '../src/lib/analyze.mjs';

// This test uses Chrome's about:blank document, not network navigation.
// It is useful even when the environment forbids all visited URLs.
const html = await readFile(join(import.meta.dirname, '..', 'tests', 'fixture-page.html'), 'utf8');
const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const session = await launchChrome({});
try {
  await session.cdp.send('Page.enable');
  await session.cdp.send('Runtime.enable');
  const write = await session.cdp.send('Runtime.evaluate', {
    expression: `document.open(); document.write(${JSON.stringify(withoutScripts)}); document.close();`,
    returnByValue: true
  });
  assert.equal(write.exceptionDetails, undefined, 'could write local fixture into isolated document');
  const output = await session.cdp.send('Runtime.evaluate', { expression: DOM_COLLECTOR, returnByValue: true });
  assert.equal(output.exceptionDetails, undefined);
  const raw = output.result?.value;
  assert.equal(raw.formCount, 1);
  assert.equal(raw.forms[0].fields.length, 3);
  assert.equal(raw.forms[0].submitControls, 1);
  assert.equal(raw.duplicateIds[0].id, 'email');
  assert.ok(!JSON.stringify(raw).includes('DO_NOT_CAPTURE_123'));
  const findings = analyze({url:'https://example.org/register',formCount:raw.formCount,
    truncated:raw.truncated,duplicateIds:raw.duplicateIds,
    forms:raw.forms.map(form => ({...form,action:'https://example.org/register'}))});
  assert.ok(findings.issues.some(issue => issue.code === 'FF201'));
  assert.ok(findings.issues.some(issue => issue.code === 'FF110'));
  console.log('Offline Chrome integration passed: DOM collection, sensitive-value exclusion, rule engine.');
} finally { await session.close(); }
