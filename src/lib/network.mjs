import { matchesScenario } from './scenario.mjs';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const SIMULATED_503 = Buffer.from('{"error":"service_unavailable","simulated":true}\n').toString('base64');

/**
 * Interception applies to this Chrome DevTools page target, not to browser-level
 * requests or all service workers. This is a guardrail, not a security sandbox.
 * Non-GET/HEAD requests are always blocked; at most one exact GET is faulted.
 */
export async function installReadOnlyRequestGuard(cdp) {
  let blockedRequests = 0;
  let interceptionsApplied = 0;
  let deliveryErrors = 0;
  let scenario = null;
  const tasks = new Set();

  function enqueue(promise) {
    const task = Promise.resolve(promise).catch(() => { deliveryErrors++; });
    tasks.add(task);
    void task.finally(() => tasks.delete(task));
  }

  cdp.on('Fetch.requestPaused', ({ requestId, request }) => {
    if (typeof requestId !== 'string' || !request) return;
    const method = String(request.method ?? '').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      blockedRequests++;
      enqueue(cdp.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }));
      return;
    }
    if (!scenario || interceptionsApplied >= 1 || !matchesScenario(request, scenario)) {
      enqueue(cdp.send('Fetch.continueRequest', { requestId }));
      return;
    }
    interceptionsApplied++;
    if (scenario.profile === 'offline') {
      enqueue(cdp.send('Fetch.failRequest', { requestId, errorReason: 'InternetDisconnected' }));
    } else if (scenario.profile === 'http-503') {
      enqueue(cdp.send('Fetch.fulfillRequest', {
        requestId, responseCode: 503,
        responseHeaders: [
          { name:'Content-Type', value:'application/json; charset=utf-8' },
          { name:'Cache-Control', value:'no-store' }
        ],
        body: SIMULATED_503
      }));
    } else {
      enqueue((async () => {
        await pause(scenario.delayMs);
        await cdp.send('Fetch.continueRequest', { requestId });
      })());
    }
  });
  await cdp.send('Fetch.enable', { patterns:[{urlPattern:'*',requestStage:'Request'}] });
  return {
    armScenario(value) {
      if (scenario) throw new Error('Only one fault scenario may run per browser session.');
      if (!value || !['offline','latency','http-503'].includes(value.profile)) throw new Error('Invalid scenario.');
      scenario = value;
    },
    get blockedRequests() { return blockedRequests; },
    get interceptionsApplied() { return interceptionsApplied; },
    get deliveryErrors() { return deliveryErrors; },
    async drain() { await Promise.allSettled([...tasks]); }
  };
}
