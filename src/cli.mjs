#!/usr/bin/env node
import { parseArgs, HELP } from './lib/args.mjs';
import { findChrome } from './lib/chrome.mjs';
import { inspect } from './lib/inspect.mjs';
import { analyze, hasFailingIssues } from './lib/analyze.mjs';

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
  if (options.json || options.html) throw new Error('JSON and HTML exports become available in Stage 03.');
  const snapshot = await inspect(options.url, options);
  const result = analyze(snapshot);
  console.log(`FlowFault · ${snapshot.url}`);
  console.log(`${result.summary.forms} forms / ${result.summary.fields} fields / ${result.summary.issues} findings`);
  console.log(`${result.summary.critical} critical · ${result.summary.warning} warnings · ${result.summary.info} info`);
  for (const issue of result.issues.slice(0, 12)) {
    console.log(`  [${issue.severity.toUpperCase()}] ${issue.code} ${issue.title}`);
  }
  console.log(`Non-read requests blocked: ${snapshot.blockedRequests}`);
  if (hasFailingIssues(result.issues, options.failOn)) process.exitCode = 2;
}
main().catch(error => { console.error(`FlowFault error: ${error.message}`); process.exitCode = 1; });
