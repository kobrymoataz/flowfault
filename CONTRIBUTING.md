# Contributing to FlowFault

Thank you for considering a contribution. The goal is to keep findings reproducible and the CLI approachable.

## Development

- Node.js 22+ and Google Chrome or Chromium for browser integration tests.
- Run `npm ci`, `npm test`, `npm run typecheck` and `npm run build`.
- Run `npm run test:integration` when modifying browser or inspection behavior.
- Prefer a small pull request that adds a regression test for each new rule.

## Issues and pull requests

A good bug report includes the operating system, Node and Chrome versions, a *minimal public fixture* and the expected / actual output. Never paste passwords, tokens, cookies, private URLs or real application data into a public issue. Remove sensitive values before uploading reports.

Use conventional commits such as `fix: handle missing form action` or `feat: add new form diagnostic`. Please discuss major features in an issue first.

## Rule design

Findings must have a unique code, severity, clear explanation, actionable recommendation and tests. Avoid claiming that a heuristic proves compliance, security, or successful delivery of emails; v0.1.0 only inspects the loaded page and form markup.

## Community expectations

Be considerate, discuss code on its merits, avoid harassment and respect the privacy of people who use the tool. Maintainers can moderate issues and pull requests to keep technical discussions constructive.
