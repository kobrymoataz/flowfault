# Contributing to FlowFault

FlowFault favors observable browser behavior, small modules and reproducible evidence.

## Development

Requirements: Node.js 22+, Chrome or Chromium, and a local copy of this repository.

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run test:browser-offline
npm run test:scenario-browser-offline
npm run test:integration
npm run test:scenarios
```

`typecheck` is dependency-free **JavaScript syntax validation**, not a TypeScript type checker. Local fixture integration needs a browser that permits loopback navigation.

## Change requests

- Open focused pull requests with a regression test, documentation and an explanation of expected user impact.
- Prefer standard Node.js modules over adding dependencies for simple capabilities.
- Keep reports independent of external CDNs, script bundles and analytics.
- Preserve stable JSON schema keys and rule IDs or describe migration decisions in the changelog.
- Do not expand to form submission, credentials or production simulations without an explicit permission model and discussion.
- Use fixture servers and synthetic data. Never commit session cookies, private URLs, customer records, or unredacted reports.
- For browser changes, run both unit tests and real Chrome integration on a local staging fixture.

## Community

Use respectful technical discussion, make failures actionable, and never describe a heuristic as definitive proof of security, accessibility compliance, or workflow recovery.

## Dashboard contributions

The v0.3.0 report model is shared between CLI and browser. Changes should preserve the `schemaVersion: 1.0` report contract and remain dependency-free. Keep all imported values as text nodes, never inject them into `innerHTML`. New HTTP routes must stay on an allowlist and reject writes.

Verify with `npm test`, `npm run typecheck`, `npm run build`, `npm run test:dashboard-browser-offline` and, where Chrome permits localhost, `npm run test:dashboard-integration`.
