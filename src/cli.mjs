#!/usr/bin/env node
import { parseArgs, HELP } from './lib/args.mjs';
import { findChrome } from './lib/chrome.mjs';
import { inspect } from './lib/inspect.mjs';
import { analyze, hasFailingIssues } from './lib/analyze.mjs';
import { makeReport, saveReports } from './lib/report.mjs';

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
  const snapshot = await inspect(options.url, options);
  const analysis = analyze(snapshot);
  const report = makeReport(snapshot, analysis);
  await saveReports(report, options);
  console.log(`\nFlowFault v0.1.0 · ${report.scan.url}`);
  console.log(`Forms ${analysis.summary.forms}  Fields ${analysis.summary.fields}  Findings ${analysis.summary.issues}`);
  console.log(`Critical ${analysis.summary.critical}  Warning ${analysis.summary.warning}  Info ${analysis.summary.info}`);
  for (const issue of analysis.issues.slice(0, 12)) {
    console.log(`  [${issue.severity.toUpperCase()}] ${issue.code} ${issue.title}${Number.isInteger(issue.formIndex) ? ` (form ${issue.formIndex + 1})` : ''}`);
  }
  if (analysis.issues.length > 12) console.log(`  ... ${analysis.issues.length - 12} more in the report`);
  console.log(`Non-GET/HEAD requests blocked: ${snapshot.blockedRequests}`);
  if (options.json) console.log(`JSON: ${options.json}`);
  if (options.html) console.log(`HTML: ${options.html}`);
  if (hasFailingIssues(analysis.issues, options.failOn)) {
    console.error(`Threshold reached: --fail-on ${options.failOn}`);
    process.exitCode = 2;
  }
}
main().catch(error => { console.error(`FlowFault error: ${error.message}`); process.exitCode = 1; });
