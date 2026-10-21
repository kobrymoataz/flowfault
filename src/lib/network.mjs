/**
 * Intercepts requests for the inspected CDP page target.
 * Requests outside this target (for example browser-level work or service workers)
 * may not be intercepted. Never treat this as a security sandbox.
 */
export async function installReadOnlyRequestGuard(cdp) {
  let blockedRequests = 0;
  cdp.on('Fetch.requestPaused', ({ requestId, request }) => {
    if (typeof requestId !== 'string' || !request) return;
    const method = typeof request.method === 'string' ? request.method.toUpperCase() : '';
    if (method === 'GET' || method === 'HEAD') {
      void cdp.send('Fetch.continueRequest', { requestId }).catch(() => {});
    } else {
      blockedRequests++;
      void cdp.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => {});
    }
  });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  return { get blockedRequests() { return blockedRequests; } };
}
