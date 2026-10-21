import { startFixtureServer } from './fixture-server.mjs';
import { createScenario } from '../src/lib/scenario.mjs';
import { simulate } from '../src/lib/simulate.mjs';
import { makeScenarioReport, saveScenarioReports } from '../src/lib/scenario-report.mjs';

const fixture=await startFixtureServer();
try {
  for (const profile of ['offline','http-503','latency']) {
    const scenario=createScenario({url:fixture.url,endpoint:'/api/health',profile,delayMs:profile==='latency'?500:800});
    const probe=await simulate(scenario,{wait:100});
    const report=makeScenarioReport(probe);
    const basename=`reports/scenario-${profile}`;
    await saveScenarioReports(report,{json:`${basename}.json`,html:`${basename}.html`});
    console.log(`${profile}: ${probe.observation.kind} ${probe.observation.status??''}, ${probe.observation.elapsedMs} ms; ${basename}.html`);
  }
  if (fixture.received.some(req => !['GET','HEAD'].includes(req.method))) {
    throw new Error('Fixture received a non-read request.');
  }
  console.log('All three scenario reports generated in reports/.');
} finally {await fixture.close();}
