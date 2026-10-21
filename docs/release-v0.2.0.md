# FlowFault v0.2.0 | Controlled Network Faults

v0.2.0 expands FlowFault from passive form inspection into a small, local-first network experiment tool.

## Highlights

- Explicit `simulate` command to inject one of three faults into **one exact GET**: offline, latency or synthetic HTTP 503.
- Loopback-only by default. Remote HTTPS staging requires both `--allow-remote` and `--ack-staging`.
- No form submission, no credentials, no runtime dependencies, no telemetry.
- Standalone HTML and structured JSON scenario reports with a public-safe projection.
- Dedicated browser integration tests, local fixture demo and expanded GitHub Actions checks.
- Improved Chrome discovery for macOS Desktop installations.

## Verify before releasing

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run test:browser-offline
npm run test:scenario-browser-offline
npm run test:integration
npm run test:scenarios
npm run demo:scenarios
```

`test:integration` and `test:scenarios` require a local browser permitted to navigate to 127.0.0.1. On a managed browser that blocks network navigation, do not report these tests as successful. Verify CI and local macOS runs before creating the tag.

## Scope

This release tests controlled browser transport behavior, **not** automatic retry or end-to-end workflow recovery. See `docs/scenarios.md` and `SECURITY.md` before using remote staging targets.

## Next

v0.3.0 will explore a local dashboard and comparisons between safely generated runs.
