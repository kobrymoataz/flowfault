# Controlled network scenarios

The `simulate` command tests **one GET request** in a disposable Chrome session, using an endpoint chosen by the developer. It does not submit any form or test application recovery yet.

## Profiles

| Profile | Chrome fault | What can be observed | Origin receives the probed GET? |
| --- | --- | --- | --- |
| `offline` | Fail matching request with `InternetDisconnected` | JS fetch reports a transport error | No |
| `http-503` | Fulfill with synthetic JSON / HTTP 503 | JS fetch sees status 503 | No |
| `latency` | Hold request for 100-5000 ms | Browser fetch duration and original HTTP status | Yes |

## First run

```bash
npm ci && npm test && npm run typecheck && npm run build
node dist/cli.mjs doctor
npm run demo:scenarios
open reports/scenario-http-503.html
```

For your own local fixture:

```bash
node dist/cli.mjs simulate http://127.0.0.1:3000/register \
  --endpoint /api/health --profile latency --delay-ms 1200 \
  --json reports/latency.json --html reports/latency.html
```

Authorized HTTPS staging example (only where you have explicit testing permission):

```bash
node dist/cli.mjs simulate https://staging.example.org/register \
  --endpoint /api/health --profile offline \
  --allow-remote --ack-staging \
  --json reports/offline.json
```

The page target may itself make GET requests while loading, and GET can cause side effects on poorly designed servers. Never run against payments, login, logout, account deletion or production workflows.

## How to read a result

- `interceptionsApplied` must be `1` for a valid experiment.
- `blockedNonReadRequests` counts blocked non-GET/HEAD requests from the selected page target. It does not count all processes or targets.
- `observation.kind` is `http-response` or `network-error`.
- `observation.status` is `null` for network errors; an injected HTTP 503 is not a real server outage.
- `observation.elapsedMs` is measured in Chrome. It includes the injected delay and any genuine network time; it is not a site-performance benchmark.
- Local reports store neither cookies nor response bodies nor query strings.

## Known limitations

A page may use a Content Security Policy that forbids the endpoint; in that case, if Chrome does not intercept the GET, FlowFault exits with an error instead of fabricating a successful result. If the page redirects to another origin, it also cannot pass the exact interception check. Login sessions, retries, application error banners, rendering after fetch, and multi-step submissions are outside v0.2.0.
