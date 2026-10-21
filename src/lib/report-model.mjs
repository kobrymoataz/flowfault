/**
 * FlowFault report contract v1.0. No Node imports: usable in the CLI and browser.
 * Results are projections of the supported schema, not copies of arbitrary JSON.
 */
export const MAX_REPORT_BYTES = 2 * 1024 * 1024;
const SEVERITIES = new Set(['critical', 'warning', 'info']);
const PROFILES = new Set(['offline', 'latency', 'http-503']);
const MAX_ISSUES = 1200;

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function string(value, max = 320) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}
function whole(value, max = 1_000_000) {
  return Number.isSafeInteger(value) && value >= 0 && value <= max ? value : null;
}
function positive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1_000_000
    ? Math.round(value * 10) / 10 : null;
}
function safeUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return `${url.origin}${url.pathname}`.slice(0, 600);
  } catch { return ''; }
}
function parseRoot(raw) {
  if (!object(raw) || raw.schemaVersion !== '1.0' || !object(raw.tool) || raw.tool.name !== 'FlowFault') {
    throw new Error('Unsupported report. Expected FlowFault JSON with schemaVersion 1.0.');
  }
  if (object(raw.scan) && Array.isArray(raw.issues)) return 'inspection';
  if (object(raw.experiment) && object(raw.observation)) return 'scenario';
  throw new Error('Unrecognized FlowFault report structure.');
}

export function normalizeReport(raw) {
  const kind = parseRoot(raw);
  const toolVersion = string(raw.tool.version, 24);
  if (kind === 'inspection') {
    if (raw.issues.length > MAX_ISSUES) throw new Error('The report has too many findings.');
    const issues = raw.issues.map((item, index) => {
      if (!object(item)) throw new Error('Malformed inspection finding.');
      const code = string(item.code, 20);
      if (!/^FF\d{3}$/.test(code)) throw new Error('Invalid finding code.');
      const severity = string(item.severity, 15).toLowerCase();
      if (!SEVERITIES.has(severity)) throw new Error('Invalid finding severity.');
      return {
        code, severity, title: string(item.title, 160),
        detail: string(item.detail, 500), recommendation: string(item.recommendation, 500),
        formIndex: whole(item.formIndex, 100000), fieldIndex: whole(item.fieldIndex, 100000),
        occurrence: index
      };
    });
    const counts = { critical: 0, warning: 0, info: 0 };
    for (const item of issues) counts[item.severity]++;
    return {
      kind, toolVersion,
      target: safeUrl(raw.scan.url),
      title: string(raw.scan.title, 120),
      capturedAt: string(raw.scan.scannedAt, 40),
      sample: raw.scan.sample === true,
      durationMs: positive(raw.scan.durationMs),
      blockedRequests: whole(raw.scan.blockedNonReadRequests, 100000),
      truncated: raw.scan.truncated === true,
      metrics: {
        forms: whole(raw.summary?.forms, 100000),
        fields: whole(raw.summary?.fields, 100000),
        total: issues.length, ...counts
      },
      issues
    };
  }
  const ex = raw.experiment;
  const obs = raw.observation;
  const profile = string(ex.profile, 30);
  if (!PROFILES.has(profile)) throw new Error('Unrecognized scenario profile.');
  const endpoint = string(ex.endpoint, 150);
  if (!/^\/[A-Za-z0-9/_-]{1,140}$/.test(endpoint) || endpoint.startsWith('//')) {
    throw new Error('Unrecognized scenario endpoint.');
  }
  const resultKind = string(obs.kind, 40);
  if (!['http-response', 'network-error'].includes(resultKind)) throw new Error('Unrecognized scenario observation.');
  const status = obs.status == null ? null : whole(obs.status, 599);
  if (obs.status != null && (status === null || status < 100)) throw new Error('Invalid observed HTTP status.');
  return {
    kind, toolVersion,
    target: safeUrl(ex.page),
    title: `${profile.toUpperCase()} · ${endpoint}`,
    capturedAt: string(ex.executedAt, 40),
    sample: ex.sample === true,
    profile, endpoint,
    scope: string(ex.scope, 30),
    configuredDelayMs: whole(ex.configuredDelayMs, 5000),
    applied: whole(raw.delivery?.interceptionsApplied, 1000),
    blockedRequests: whole(raw.delivery?.blockedNonReadRequests, 100000),
    observation: {
      kind: resultKind, status, elapsedMs: positive(obs.elapsedMs),
      ok: obs.ok === true
    },
    interpretation: string(raw.interpretation, 650)
  };
}

/** Fingerprints represent locations, not text order or absolute issue counts. */
export function findingFingerprint(item) {
  const coordinate = item.formIndex == null ? 'global' :
    `form:${item.formIndex};field:${item.fieldIndex == null ? '*' : item.fieldIndex}`;
  const discriminator = coordinate === 'global' ? `:${item.detail.toLowerCase().trim()}` : '';
  return `${item.code}:${coordinate}${discriminator}`;
}

function issueMultiset(issues) {
  const buckets = new Map();
  for (const issue of issues) {
    const key = findingFingerprint(issue);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(issue);
  }
  return buckets;
}

export function compareReports(baseline, current) {
  if (!baseline || !current) throw new Error('Two reports are required for comparison.');
  if (baseline.kind !== current.kind) {
    return { kind: 'incompatible', compatible: false, reason: 'Inspection reports can only be compared to inspection reports, and scenarios to scenarios.' };
  }
  if (baseline.kind === 'scenario') {
    if (baseline.profile !== current.profile || baseline.endpoint !== current.endpoint || baseline.target !== current.target) {
      return { kind: 'incompatible', compatible: false,
        reason: 'Scenario comparisons require the same page, endpoint and fault profile.' };
    }
    const before = baseline.observation;
    const after = current.observation;
    const deltaMs = before.elapsedMs == null || after.elapsedMs == null ? null :
      Math.round((after.elapsedMs - before.elapsedMs) * 10) / 10;
    return {
      kind: 'scenario', compatible: true,
      baseline, current, deltaMs,
      statusChanged: before.status !== after.status || before.kind !== after.kind,
      observationChanged: before.ok !== after.ok || before.kind !== after.kind || before.status !== after.status
    };
  }
  if (baseline.target !== current.target) {
    return { kind: 'incompatible', compatible: false, reason: 'Inspection comparisons require the same page URL (without query or fragment).' };
  }
  const left = issueMultiset(baseline.issues);
  const right = issueMultiset(current.issues);
  const added = [];
  const resolved = [];
  const persisting = [];
  const severityChanged = [];
  for (const key of new Set([...left.keys(), ...right.keys()])) {
    const previous = left.get(key) || [];
    const latest = right.get(key) || [];
    const matched = Math.min(previous.length, latest.length);
    for (let i = 0; i < matched; i++) {
      persisting.push(latest[i]);
      if (latest[i].severity !== previous[i].severity) severityChanged.push({ before: previous[i], after: latest[i] });
    }
    added.push(...latest.slice(matched));
    resolved.push(...previous.slice(matched));
  }
  return {
    kind: 'inspection', compatible: true, baseline, current,
    added, resolved, persisting, severityChanged,
    counts: { added: added.length, resolved: resolved.length, persisting: persisting.length,
      newCritical: added.filter(item => item.severity === 'critical').length }
  };
}

/** Allow only supported, privacy-conscious projections in exported comparison JSON. */
export function comparisonExport(comparison) {
  if (!comparison.compatible) throw new Error(comparison.reason);
  const compact = r => ({ kind: r.kind, target: r.target, capturedAt: r.capturedAt, toolVersion: r.toolVersion,
    sample: r.sample, ...(r.kind === 'inspection' ? { metrics: r.metrics } :
      { profile: r.profile, endpoint: r.endpoint, observation: r.observation }) });
  const base = { schemaVersion: '1.0', generatedBy: 'FlowFault 0.3.0',
    comparisonKind: comparison.kind, baseline: compact(comparison.baseline), current: compact(comparison.current) };
  if (comparison.kind === 'inspection') return { ...base, counts: comparison.counts,
    added: comparison.added.map(issueExport), resolved: comparison.resolved.map(issueExport),
    severityChanged: comparison.severityChanged.map(pair => ({ before: issueExport(pair.before), after: issueExport(pair.after) })) };
  return { ...base, deltaMs: comparison.deltaMs,
    statusChanged: comparison.statusChanged, observationChanged: comparison.observationChanged };
}
function issueExport({ code, severity, title, formIndex, fieldIndex }) {
  return { code, severity, title, formIndex, fieldIndex };
}
