#!/usr/bin/env node
import { parseArgs, HELP } from './lib/args.mjs';
import { findChrome } from './lib/chrome.mjs';
import { inspect } from './lib/inspect.mjs';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === 'help') return console.log(HELP);
  if (options.command === 'version') return console.log('0.1.0');
  if (options.command === 'doctor') {
    const chrome = await findChrome();
    console.log(`Node.js: ${process.version}`);
    console.log(`Chrome: ${chrome || 'NOT FOUND'}`);
    if (!chrome) process.exitCode = 1;
    return;
  }
  if (options.json || options.html || options.failOn !== 'none') {
    throw new Error('JSON/HTML reports and thresholds become available in Stage 03.');
  }
  console.log(`FlowFault · inspecting ${new URL(options.url).origin}`);
  const snapshot = await inspect(options.url, options);
  console.log(`Forms: ${snapshot.formCount} | Fields: ${snapshot.forms.reduce((sum, f) => sum + f.fields.length, 0)}`);
  console.log(`Blocked non-GET/HEAD requests: ${snapshot.blockedRequests}`);
  for (const form of snapshot.forms) {
    console.log(`  Form ${form.index + 1}: ${form.method.toUpperCase()} | ${form.fields.length} fields | ${form.submitControls} submit controls`);
  }
  console.log('Stage 01 complete: read-only discovery only.');
}
main().catch(error => { console.error(`FlowFault error: ${error.message}`); process.exitCode = 1; });
