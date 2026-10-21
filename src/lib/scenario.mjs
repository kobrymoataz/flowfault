import { publicUrl, validateTarget } from './url.mjs';

export const PROFILES = Object.freeze(['offline', 'latency', 'http-503']);
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * This probe performs one same-origin, credential-free GET request from an isolated
 * browser. Remote hosts require two explicit flags. It never submits a form.
 */
export function createScenario({ url, endpoint, profile, delayMs = 800, allowRemote = false, ackStaging = false }) {
  const page = new URL(validateTarget(url));
  if (!PROFILES.includes(profile)) {
    throw new Error(`--profile must be one of: ${PROFILES.join(', ')}.`);
  }
  if (typeof endpoint !== 'string' || !/^\/[A-Za-z0-9/_-]{1,140}$/.test(endpoint) || endpoint.startsWith('//') ||
      endpoint.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('--endpoint requires a simple path such as /api/health (no query, fragment or traversal).');
  }
  const resolved = new URL(endpoint, page.origin);
  if (resolved.origin !== page.origin || resolved.pathname !== endpoint) {
    throw new Error('--endpoint must resolve to an exact same-origin path.');
  }
  if (!Number.isInteger(delayMs) || delayMs < 100 || delayMs > 5000) {
    throw new Error('--delay-ms must be an integer between 100 and 5000.');
  }
  if (profile !== 'latency' && delayMs !== 800) {
    throw new Error('--delay-ms is only available for the latency profile.');
  }
  const loopback = LOOPBACK.has(page.hostname.toLowerCase());
  if (!loopback) {
    if (!allowRemote || !ackStaging) {
      throw new Error('Remote simulation requires BOTH --allow-remote and --ack-staging. Only test systems you control.');
    }
    if (page.protocol !== 'https:') {
      throw new Error('Remote simulation requires HTTPS.');
    }
  }
  return Object.freeze({
    pageUrl: page.href,
    publicPageUrl: publicUrl(page.href),
    endpoint,
    endpointUrl: resolved.href,
    profile,
    delayMs: profile === 'latency' ? delayMs : 0,
    scope: loopback ? 'loopback' : 'authorized-remote'
  });
}

/** Match a paused CDP request without considering or exposing its query string. */
export function matchesScenario(request, scenario) {
  if (!request || String(request.method || '').toUpperCase() !== 'GET') return false;
  try {
    const candidate = new URL(request.url);
    const target = new URL(scenario.endpointUrl);
    return candidate.origin === target.origin && candidate.pathname === target.pathname && !candidate.search && !candidate.hash;
  } catch { return false; }
}

export function explainObservation(scenario, observation, intercepted) {
  if (intercepted !== 1) return 'Fault was not injected. The requested endpoint was not intercepted by this browser session.';
  if (scenario.profile === 'offline') {
    return observation.kind === 'network-error'
      ? 'Browser observed a transport failure caused by the injected disconnection.'
      : 'Injected disconnection occurred, but the browser did not report the expected transport error.';
  }
  if (scenario.profile === 'http-503') {
    return observation.kind === 'http-response' && observation.status === 503
      ? 'Browser received a synthetic HTTP 503 response. No 503 request was sent to the origin.'
      : 'The injected 503 was not observed as expected.';
  }
  return observation.kind === 'http-response'
    ? 'The selected GET request was delayed before reaching the origin. Response status belongs to the origin.'
    : 'The selected GET request was delayed, but the browser later reported a network error.';
}
