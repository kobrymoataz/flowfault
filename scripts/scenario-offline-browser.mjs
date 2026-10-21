import assert from 'node:assert/strict';
import { launchChrome } from '../src/lib/chrome.mjs';
import { createScenario } from '../src/lib/scenario.mjs';
import { installReadOnlyRequestGuard } from '../src/lib/network.mjs';

// This checks that real Chrome accepts CDP fault commands without navigating
// to any real network URL. The browser remains on about:blank. Browser CORS
// prevents checking the HTTP response status; test:scenarios checks that.
for (const profile of ['offline','http-503']) {
  const session = await launchChrome({});
  try {
    const cdp=session.cdp;
    await cdp.send('Runtime.enable');
    const guard=await installReadOnlyRequestGuard(cdp);
    const scenario=createScenario({ url:'http://127.0.0.1:12345/register', endpoint:'/api/health',profile });
    guard.armScenario(scenario);
    const output=await cdp.send('Runtime.evaluate',{
      expression:`(async () => {
        try {
          await fetch('http://127.0.0.1:12345/api/health', { method:'GET', credentials:'omit', cache:'no-store' });
        } catch { /* about:blank has a different origin */ }
        return 'finished';
      })()`,
      awaitPromise:true,returnByValue:true
    });
    await guard.drain();
    assert.equal(output.result?.value,'finished');
    assert.equal(guard.interceptionsApplied,1,profile);
    assert.equal(guard.deliveryErrors,0,profile);
  } finally { await session.close(); }
}
console.log('Offline Chrome CDP fault injection passed: GET intercept, disconnection and synthetic HTTP response.');
