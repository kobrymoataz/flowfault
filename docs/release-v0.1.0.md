# FlowFault v0.1.0 · Foundation

A small, usable starting point for workflow reliability testing. This release does **not** claim to simulate a complete registration process; it identifies structural problems in the currently loaded page.

## Shipped

- Headless Chrome page inspector with no runtime npm dependencies.
- Transparent rules for accessible names, repeated IDs and form transport risks.
- JSON / standalone HTML outputs, optional failure thresholds and a repeatable local demo.
- Source checks, unit tests, isolated-browser fixture and GitHub Actions CI.

## Verify before tagging

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run test:browser-offline
npm run test:integration
npm run demo
```

The real-URL integration and demo commands require Chrome to permit localhost navigation. If a managed browser policy blocks all URLs, report that limitation rather than marking those tests successful.

## Next release

v0.2.0 will explore controlled network failure / delay simulation on authorized staging environments, with reproducible scenarios and local reports.
