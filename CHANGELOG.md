# Changelog

## [0.2.0] - 2026-10-21

### Added
- Explicit `simulate` command with one-request network fault profiles: offline, latency and synthetic HTTP 503.
- Safer scope: localhost by default; remote simulations require two deliberate flags and HTTPS.
- Same-origin GET endpoint validation with no query strings or URL fragments.
- Scenario-specific JSON and standalone HTML reports with privacy-preserving projections.
- Repeatable local fixture tests for transport errors, delay and intercepted HTTP 503.
- Dedicated offline Chrome CDP test, expanded CI, and scenario documentation.
- Chrome detection for nonstandard macOS Desktop installations.

### Preserved
- The v0.1.0 `inspect` command and all existing diagnostic rule IDs.
- No runtime npm dependencies, no form submissions, and no telemetry.

### Limits
- Simulations do not yet verify whether an application displays an error, retries, or recovers.
- One explicitly chosen same-origin GET is faulted per isolated Chrome session.

## [0.1.0] - 2026-10-21

### Added
- Dependency-free Node.js CLI and Chrome-based read-only form discovery.
- CDP interception that blocks all non-GET/HEAD browser network requests.
- Explainable, rule-based findings for labels, duplicate ids and dangerous form method / action combinations.
- CLI exit thresholds for future automation.
- Portable JSON reports and standalone, escaped, script-free HTML reports.
- Unit tests, integration fixture, demo, GitHub Actions verification and contributor documentation.

### Known limitations
- Only the current document's regular HTML forms are examined.
- Client-side applications may need a longer `--wait` value.
- This release cannot verify whether submitted data reaches a server, database or mailbox.
