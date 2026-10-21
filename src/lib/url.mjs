/** Strip fragment, query, and credentials from any URL retained in an audit. */
export function publicUrl(input) {
  try {
    const url = new URL(input);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return '(unavailable)';
  }
}

export function validateTarget(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error('Target must be a valid http:// or https:// URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http:// and https:// targets are supported.');
  }
  if (url.username || url.password) {
    throw new Error('Credentials in the target URL are not supported.');
  }
  return url.href;
}

/** Whitelist structural identifier characters; do not keep URL/query-like content. */
export function identifier(input) {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) return '';
  if (value.length > 72 || !/^[\w:.-]+$/u.test(value)) return '(redacted)';
  return value;
}
