#!/usr/bin/env node
import { parseArgs, HELP } from './lib/args.mjs';
import { findChrome } from './lib/chrome.mjs';
import { inspect } from './lib/inspect.mjs';
import { analyze, hasFailingIssues } from './lib/analyze.mjs';
import { makeReport, saveReports } from './lib/report.mjs';
import { simulate } from './lib/simulate.mjs';
import { makeScenarioReport, saveScenarioReports } from './lib/scenario-report.mjs';
import { compareReportFiles, shouldFailComparison } from './lib/report-files.mjs';
import { startDashboard } from './lib/dashboard-server.mjs';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === 'help') return console.log(HELP);
  if (options.command === 'version') return console.log('0.3.0');
  if (options.command === 'doctor') {
    const chrome = await findChrome();
    console.log(`Node.js: ${process.version}`);
    console.log(`Chrome: ${chrome || 'NOT FOUND'}`);
    if (!chrome) process.exitCode = 1;
    return;
  }
  if (options.command === 'dashboard') {
    const instance = await startDashboard({ port: options.port });
    console.log(`FlowFault dashboard is ready at ${instance.url}`);
    console.log('Open this address in a browser. Files remain in this browser tab. Press Control+C to stop.');
    return;
  }
  if (options.command === 'compare') {
    const comparison = await compareReportFiles(options);
    if (comparison.kind === 'inspection') {
      console.log(`FlowFault compare | ${comparison.current.target}`);
      console.log(`New ${comparison.counts.added} | Resolved ${comparison.counts.resolved} | Persisting ${comparison.counts.persisting} | New critical ${comparison.counts.newCritical}`);
      for (const item of comparison.added.slice(0, 12)) console.log(`  [+] ${item.code} ${item.title}`);
      for (const item of comparison.resolved.slice(0, 12)) console.log(`  [-] ${item.code} ${item.title}`);
    } else {
      console.log(`FlowFault compare | ${comparison.current.target}`);
      console.log(`Scenario ${comparison.current.profile} | ${comparison.current.endpoint}`);
      console.log(`Status changed: ${comparison.statusChanged ? 'yes' : 'no'} | Observed latency delta: ${comparison.deltaMs == null ? 'unavailable' : `${comparison.deltaMs} ms`}`);
      console.log('One observation per report. No trend or recovery claim is made.');
    }
    if (options.json) console.log(`Comparison JSON: ${options.json}`);
    if (shouldFailComparison(comparison, options.failOn)) process.exitCode = 2;
    return;
  }
  if (options.command === 'simulate') {
    const probe = await simulate(options.scenario,options);
    const report = makeScenarioReport(probe);
    await saveScenarioReports(report,options);
    console.log(`\nFlowFault v0.3.0 | ${probe.scenario.publicPageUrl}`);
    console.log(`Scenario: ${probe.scenario.profile} | endpoint: ${probe.scenario.endpoint}`);
    console.log(`Observed: ${probe.observation.kind}${probe.observation.status == null ? '' : ` (HTTP ${probe.observation.status})`} in ${probe.observation.elapsedMs} ms`);
    console.log(`Injection: ${probe.interceptionsApplied} | Blocked non-read requests: ${probe.blockedNonReadRequests}`);
    console.log(probe.interpretation);
    if(options.json) console.log(`JSON: ${options.json}`);
    if(options.html) console.log(`HTML: ${options.html}`);
    return;
  }
  const snapshot = await inspect(options.url, options);
  const analysis = analyze(snapshot);
  const report = makeReport(snapshot, analysis);
  await saveReports(report, options);
  console.log(`\nFlowFault v0.3.0 | ${report.scan.url}`);
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
