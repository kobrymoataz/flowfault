import assert from 'node:assert/strict';
import { startFixtureServer } from './fixture-server.mjs';
import { createScenario } from '../src/lib/scenario.mjs';
import { simulate } from '../src/lib/simulate.mjs';

const fixture=await startFixtureServer();
try {
  for (const profile of ['offline','http-503','latency']) {
    const scenario=createScenario({url:fixture.url,endpoint:'/api/health',profile,delayMs:profile==='latency'?300:800});
    const probe=await simulate(scenario,{wait:100,timeout:20000});
    assert.equal(probe.interceptionsApplied,1,profile);
    assert.ok(probe.blockedNonReadRequests>=1,'fixture write request must be blocked');
    assert.ok(!JSON.stringify({ observation:probe.observation,interpretation:probe.interpretation }).includes('DO_NOT_PRINT_QUERY'));
    if(profile==='offline') assert.equal(probe.observation.kind,'network-error');
    if(profile==='http-503') assert.equal(probe.observation.status,503);
    if(profile==='latency') {
      assert.equal(probe.observation.status,200);
      assert.ok(probe.observation.elapsedMs>=260,`delay not observed: ${probe.observation.elapsedMs}`);
    }
  }
  assert.ok(fixture.received.filter(request=>request.url?.startsWith('/api/health')).length===1,
    'only the latency profile should reach origin; offline and 503 must not');
  assert.ok(fixture.received.every(request=>['GET','HEAD'].includes(request.method)),
    'read-only interception must block fixture writes');
  console.log('Scenario integration passed: injected offline, synthetic 503, delayed GET, origin isolation, privacy.');
} finally { await fixture.close(); }
