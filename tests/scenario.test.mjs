import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenario, matchesScenario, explainObservation } from '../src/lib/scenario.mjs';

const defaults = { url: 'http://127.0.0.1:8181/register?session=PRIVATE', endpoint: '/api/health', profile: 'latency' };

test('scenario is loopback-only by default and strips sensitive page query from display', () => {
  const scenario = createScenario(defaults);
  assert.equal(scenario.scope, 'loopback');
  assert.equal(scenario.delayMs, 800);
  assert.equal(scenario.publicPageUrl, 'http://127.0.0.1:8181/register');
  assert.ok(!JSON.stringify({ publicPageUrl: scenario.publicPageUrl }).includes('PRIVATE'));
});
test('supports localhost and IPv6 loopback with bounded delay', () => {
  assert.equal(createScenario({ ...defaults, url:'http://localhost:3000/', delayMs:100 }).delayMs, 100);
  assert.equal(createScenario({ ...defaults, url:'http://[::1]:3000/' }).scope, 'loopback');
  assert.throws(() => createScenario({ ...defaults, delayMs:6000 }), /between 100 and 5000/);
});
test('rejects traversal, query strings, protocol-relative or unsafe endpoint', () => {
  for (const endpoint of ['//external.test/api', '/api/../admin', '/api?token=x', '/api#frag', 'https://evil.test', '/a%2Fb', '/']) {
    assert.throws(() => createScenario({ ...defaults, endpoint }), /endpoint/);
  }
});
test('requires two flags and HTTPS for remote staging', () => {
  const remote = { ...defaults, url: 'https://staging.example.test/register' };
  assert.throws(() => createScenario(remote), /BOTH/);
  assert.throws(() => createScenario({ ...remote, allowRemote: true }), /BOTH/);
  assert.throws(() => createScenario({ ...remote, ackStaging: true }), /BOTH/);
  assert.equal(createScenario({ ...remote, allowRemote: true, ackStaging: true }).scope, 'authorized-remote');
  assert.throws(() => createScenario({ ...remote, url:'http://staging.example.test/', allowRemote:true, ackStaging:true }), /HTTPS/);
});
test('profile selection is exact and delay applies only to latency', () => {
  assert.throws(() => createScenario({ ...defaults, profile:'latency;rm' }), /profile/);
  assert.equal(createScenario({ ...defaults, profile:'offline' }).delayMs, 0);
  assert.equal(createScenario({ ...defaults, profile:'http-503' }).delayMs, 0);
  assert.throws(() => createScenario({ ...defaults, profile:'offline', delayMs:150 }), /only available/);
});
test('matches exactly one GET endpoint on same origin with no query', () => {
  const scenario = createScenario(defaults);
  assert.equal(matchesScenario({ method:'GET', url:'http://127.0.0.1:8181/api/health' }, scenario), true);
  for (const request of [
    { method:'POST', url:scenario.endpointUrl },
    { method:'HEAD', url:scenario.endpointUrl },
    { method:'GET', url:'http://127.0.0.1:8181/api/health?secret=1' },
    { method:'GET', url:'http://127.0.0.1:8181/api/health/extra' },
    { method:'GET', url:'http://127.0.0.1:8182/api/health' },
    { method:'GET', url:'http://elsewhere.test/api/health' }
  ]) assert.equal(matchesScenario(request,scenario),false);
});
test('interpretation does not claim application recovery or status for latency', () => {
  const scenario = createScenario(defaults);
  assert.match(explainObservation(scenario,{ kind:'http-response', status:200 },1), /delayed/);
  assert.match(explainObservation({ ...scenario,profile:'http-503' },{ kind:'http-response',status:503 },1), /synthetic HTTP 503/);
  assert.match(explainObservation(scenario,{ kind:'network-error' },0), /not injected/);
});
