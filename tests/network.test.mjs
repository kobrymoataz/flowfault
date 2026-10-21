import test from 'node:test';
import assert from 'node:assert/strict';
import { installReadOnlyRequestGuard } from '../src/lib/network.mjs';

test('allows GET/HEAD and blocks POST/PUT requests at the page target', async () => {
  const sent = [];
  let handler;
  const cdp = {
    on(event, callback) { assert.equal(event, 'Fetch.requestPaused'); handler = callback; },
    async send(method, params) { sent.push({method,params}); return {}; }
  };
  const guard = await installReadOnlyRequestGuard(cdp);
  for (const [requestId, method] of [['1','GET'],['2','HEAD'],['3','POST'],['4','PUT']]) {
    handler({requestId,request:{method,url:'https://example.org/'}});
  }
  assert.equal(guard.blockedRequests, 2);
  assert.deepEqual(sent.map(item => item.method), [
    'Fetch.enable','Fetch.continueRequest','Fetch.continueRequest','Fetch.failRequest','Fetch.failRequest'
  ]);
});
