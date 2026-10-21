import { launchChrome } from './chrome.mjs';
import { installReadOnlyRequestGuard } from './network.mjs';
import { explainObservation } from './scenario.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function evaluate(cdp, expression, timeout) {
  const output = await cdp.send('Runtime.evaluate', {
    expression, returnByValue:true, awaitPromise:true
  }, timeout);
  if (output.exceptionDetails) throw new Error('Browser could not execute the isolated GET probe.');
  return output.result?.value;
}

/** One credential-free GET to one explicit same-origin path, with one injected fault. */
export async function simulate(scenario, { chrome, timeout = 20000, wait = 300 } = {}) {
  const startedAt = Date.now();
  const session = await launchChrome({ executable: chrome, startupTimeout: Math.min(timeout, 12000) });
  try {
    const { cdp } = session;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    const guard = await installReadOnlyRequestGuard(cdp);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled:true });
    await cdp.send('Network.setBypassServiceWorker', { bypass:true });
    const navigation = await cdp.send('Page.navigate', { url:scenario.pageUrl }, timeout);
    if (navigation.errorText) throw new Error(`Navigation failed: ${navigation.errorText}`);
    let ready = false;
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      try {
        const result = await evaluate(cdp, 'document.readyState', Math.min(timeout, 12000));
        if (result === 'interactive' || result === 'complete') { ready = true; break; }
      } catch { /* navigation may replace execution context */ }
      await sleep(120);
    }
    if (!ready) throw new Error('The page did not become ready before the timeout.');
    if (wait > 0) await sleep(wait);
    guard.armScenario(scenario);

    // No form writes, data capture, cookies or request body. Redirects are not followed.
    const expression = `(async () => {
      const start = performance.now();
      try {
        const response = await fetch(${JSON.stringify(scenario.endpoint)}, {
          method:'GET', credentials:'omit', redirect:'error', cache:'no-store', mode:'same-origin'
        });
        return {kind:'http-response',status:response.status,ok:response.ok,elapsedMs:Math.round(performance.now()-start)};
      } catch {
        return {kind:'network-error',status:null,ok:false,elapsedMs:Math.round(performance.now()-start)};
      }
    })()`;
    const raw = await evaluate(cdp, expression, Math.min(60000, Math.max(12000, timeout)));
    await guard.drain();
    if (guard.deliveryErrors) throw new Error('Chrome interception command failed. The result cannot be trusted.');
    if (guard.interceptionsApplied !== 1) {
      throw new Error('The expected request was not intercepted. Check CSP, endpoint path, and browser policy.');
    }
    if (!raw || !['network-error','http-response'].includes(raw.kind) ||
        !Number.isInteger(raw.elapsedMs) || raw.elapsedMs < 0 ||
        (raw.status !== null && (!Number.isInteger(raw.status) || raw.status < 100 || raw.status > 599))) {
      throw new Error('Browser returned an invalid probe observation.');
    }
    const observation = {
      kind: raw.kind, status: raw.status, ok: raw.ok === true, elapsedMs:raw.elapsedMs
    };
    return {
      scenario, observation,
      interceptionsApplied: guard.interceptionsApplied,
      blockedNonReadRequests: guard.blockedRequests,
      durationMs:Date.now() - startedAt,
      interpretation:explainObservation(scenario,observation,guard.interceptionsApplied)
    };
  } finally {
    await session.close();
  }
}
