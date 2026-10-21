import test from 'node:test';
import assert from 'node:assert/strict';
import { installReadOnlyRequestGuard } from '../src/lib/network.mjs';
import { createScenario } from '../src/lib/scenario.mjs';

function fakeCdp() {
  const sent = [];
  let handler;
  return {
    sent,
    on(event, callback) { assert.equal(event, 'Fetch.requestPaused'); handler = callback; },
    async send(method,params) { sent.push({method,params}); return {}; },
    emit(id,method,url='http://127.0.0.1:8181/api/health') { handler({requestId:id,request:{method,url}}); }
  };
}
const options = { url:'http://127.0.0.1:8181/register', endpoint:'/api/health' };

test('read-only guard allows GET/HEAD and blocks all write methods', async () => {
  const cdp = fakeCdp();
  const guard = await installReadOnlyRequestGuard(cdp);
  for (const [id,method] of [['1','GET'],['2','HEAD'],['3','POST'],['4','PUT'],['5','PATCH'],['6','DELETE']]) cdp.emit(id,method);
  await guard.drain();
  assert.equal(guard.blockedRequests,4);
  assert.equal(guard.interceptionsApplied,0);
  assert.deepEqual(cdp.sent.map(item=>item.method),[
    'Fetch.enable','Fetch.continueRequest','Fetch.continueRequest',
    'Fetch.failRequest','Fetch.failRequest','Fetch.failRequest','Fetch.failRequest'
  ]);
});
test('offline scenario faults exactly one matching GET; never faults POST', async () => {
  const cdp = fakeCdp(); const guard = await installReadOnlyRequestGuard(cdp);
  guard.armScenario(createScenario({ ...options, profile:'offline' }));
  cdp.emit('a','GET','http://127.0.0.1:8181/other');
  cdp.emit('b','GET','http://127.0.0.1:8181/api/health?key=sensitive');
  cdp.emit('c','POST');
  cdp.emit('d','GET');
  cdp.emit('e','GET');
  await guard.drain();
  assert.equal(guard.blockedRequests,1);
  assert.equal(guard.interceptionsApplied,1);
  assert.equal(cdp.sent.filter(item=>item.method==='Fetch.failRequest' && item.params.errorReason==='InternetDisconnected').length,1);
  assert.equal(cdp.sent.filter(item=>item.method==='Fetch.continueRequest').length,3);
});
test('HTTP 503 is fully synthetic, no origin continuation', async () => {
  const cdp = fakeCdp(); const guard = await installReadOnlyRequestGuard(cdp);
  guard.armScenario(createScenario({ ...options, profile:'http-503' }));
  cdp.emit('one','GET'); await guard.drain();
  const fulfill = cdp.sent.find(item=>item.method==='Fetch.fulfillRequest');
  assert.equal(fulfill.params.responseCode,503);
  assert.match(Buffer.from(fulfill.params.body,'base64').toString(), /simulated/);
  assert.equal(cdp.sent.some(item=>item.method==='Fetch.continueRequest'),false);
});
test('latency delays only matching request and then continues it', async () => {
  const cdp = fakeCdp(); const guard = await installReadOnlyRequestGuard(cdp);
  guard.armScenario(createScenario({ ...options, profile:'latency', delayMs:110 }));
  const before=Date.now(); cdp.emit('one','GET'); await guard.drain();
  assert.ok(Date.now()-before >=95);
  assert.equal(cdp.sent.at(-1).method,'Fetch.continueRequest');
});
test('CDP delivery errors are observable, not silently trusted', async () => {
  const cdp = fakeCdp(); cdp.send=async method=>{ if(method==='Fetch.enable') return {}; throw Error('disconnected'); };
  const guard = await installReadOnlyRequestGuard(cdp);
  cdp.emit('one','GET'); await guard.drain();
  assert.equal(guard.deliveryErrors,1);
});
