# FlowFault v0.3.0 | Report Workspace

## Release scope

FlowFault adds a local dashboard and a deterministic comparison workflow while preserving the existing v0.1 inspection and v0.2 one-request GET simulation commands.

### Added

- `flowfault dashboard [--port 4173]`: static local-only report workspace for two browser-side JSON imports.
- `flowfault compare <baseline.json> <current.json> [--json <file>] [--fail-on ...]`: non-browser diff with safe output projection.
- Severity filtering, finding search, new/resolved/persisting status, example datasets, scenario outcome comparison and JSON export.
- HTTP listener bound to loopback, Host validation, GET/HEAD-only asset allowlist, no upload endpoint, and restrictive browser CSP.
- Unit tests, offline Chrome UI checks and localhost integration checks.

### Compatibility

- Node.js 22 or later; Chrome / Chromium required only for inspection, simulation and browser tests.
- Existing FlowFault report schema `1.0` continues to work. Both v0.1 and v0.2 JSON files are accepted.
- No new runtime npm dependencies or external frontend CDNs.

### Verify before tagging

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run test:browser-offline
npm run test:scenario-browser-offline
npm run test:integration
npm run test:scenarios
npm run test:dashboard-browser-offline
npm run test:dashboard-integration
npm run demo:scenarios
```

Chrome localhost checks must pass on the release machine or in GitHub Actions. Do not describe unavailable checks as successful.

### Boundaries

This workspace compares existing reports only. It does not submit a form, exercise application retries, certify security or inspect files beyond those deliberately selected. Scenario comparisons are two individual observations rather than a time series.

### Following release

v0.4.0 may add opt-in test fixtures for duplicate submission and retry behavior on isolated local examples. Production form submission remains out of scope.
