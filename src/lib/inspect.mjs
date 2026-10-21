import { launchChrome } from './chrome.mjs';
import { DOM_COLLECTOR } from './collector.mjs';
import { identifier, publicUrl, validateTarget } from './url.mjs';
import { installReadOnlyRequestGuard } from './network.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runEvaluation(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: false
  });
  if (result.exceptionDetails) throw new Error('Could not inspect the loaded document.');
  return result.result?.value;
}

function sanitizeSnapshot(raw, target) {
  return {
    url: publicUrl(target),
    title: typeof raw.title === 'string' ? raw.title.slice(0, 160) : '',
    formCount: raw.formCount,
    truncated: Boolean(raw.truncated),
    duplicateIds: (raw.duplicateIds || []).map(item => ({
      id: identifier(item.id), count: item.count
    })),
    forms: raw.forms.map(form => ({
      index: form.index,
      id: identifier(form.id),
      method: form.method,
      action: publicUrl(form.action),
      submitControls: form.submitControls,
      totalFieldCount: form.totalFieldCount,
      fields: form.fields.map(field => ({
        index: field.index,
        tag: field.tag,
        type: field.type,
        id: identifier(field.id),
        name: identifier(field.name),
        required: field.required,
        disabled: field.disabled,
        nameSource: field.nameSource,
        hasPlaceholder: field.hasPlaceholder,
        autocomplete: field.autocomplete
      }))
    }))
  };
}

/** Only GET and HEAD requests are allowed at the CDP interception layer. */
export async function inspect(target, { chrome, timeout = 20000, wait = 400 } = {}) {
  const url = validateTarget(target);
  const started = Date.now();
  const session = await launchChrome({ executable: chrome, startupTimeout: Math.min(timeout, 12000) });
  try {
    const { cdp } = session;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    const network = await installReadOnlyRequestGuard(cdp);
    await cdp.send('Network.enable');
    await cdp.send('Network.setBypassServiceWorker', { bypass: true });
    const navigation = await cdp.send('Page.navigate', { url }, timeout);
    if (navigation.errorText) throw new Error(`Navigation failed: ${navigation.errorText}`);

    const until = Date.now() + timeout;
    let ready = false;
    while (Date.now() < until) {
      try {
        const state = await runEvaluation(cdp, 'document.readyState');
        if (state === 'complete' || state === 'interactive') { ready = true; break; }
      } catch { /* navigation can temporarily replace the execution context */ }
      await delay(120);
    }
    if (!ready) throw new Error('The page did not become ready before the timeout.');
    if (wait > 0) await delay(wait);
    const raw = await runEvaluation(cdp, DOM_COLLECTOR);
    if (!raw || !Array.isArray(raw.forms)) throw new Error('Browser returned an invalid document snapshot.');
    return {
      ...sanitizeSnapshot(raw, url),
      durationMs: Date.now() - started,
      blockedRequests: network.blockedRequests
    };
  } finally {
    await session.close();
  }
}
