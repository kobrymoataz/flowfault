# FlowFault v0.3.0 architecture

FlowFault is a deliberately small, zero-runtime-dependency Node.js ESM CLI.

## Inspection path

`CLI -> Chrome launcher -> CDP request guard -> DOM collector -> sanitizer -> rule engine -> report renderer`

The existing `inspect` command remains read-only. It inventories form structure, strips URL query strings and produces JSON and HTML reports. HTTP request methods other than GET/HEAD are blocked on the CDP page target, not at the operating system level.

## Controlled scenario path

`CLI -> scenario validation -> isolated Chrome -> guarded page navigation -> arm one fault -> GET probe -> observation -> report projection`

`src/lib/scenario.mjs` enforces loopback by default, requires two affirmative options for HTTPS staging, validates an exact same-origin query-free endpoint and bounds latency at 100-5000 ms.

`src/lib/network.mjs` continues GET/HEAD and blocks all non-read methods. Once armed, at most one matching GET is changed:

- **offline:** CDP `Fetch.failRequest` with `InternetDisconnected`.
- **http-503:** CDP `Fetch.fulfillRequest` with synthetic 503 JSON response; it does not reach the origin.
- **latency:** wait for the selected duration before CDP `Fetch.continueRequest`; the origin receives one GET.

`src/lib/simulate.mjs` launches a new browser, navigates to the selected page, arms the guard, then executes one explicit credential-free browser `fetch()` with redirected requests rejected. It captures status / error type and elapsed time, with no response body inspection. The interception must be applied exactly once to count the experiment as valid.

`src/lib/scenario-report.mjs` creates a whitelisted public report shape and no-script HTML, separate from internal scenario objects that temporarily contain full navigational URLs. Report projection excludes URL query strings, credentials, headers, bodies, cookies and form values.

## Important boundaries

CDP interception affects one Chrome page target; background traffic and side effects from GET are not globally prohibited. This is not a sandbox. Fault injection is **not** a claim that an application correctly handles errors or retries. A future version could observe UI behaviors, but that requires explicit workflow fixtures and a different consent model.

## Testing

- `npm test` covers pure rules, argument validation, interception decisions and report output.
- `test:scenario-browser-offline` exercises real Chrome CDP injections from about:blank, without navigating to an HTTP page. Its synthetic HTTP 503 is not used to prove a same-origin JS response because of browser CORS.
- `test:scenarios` runs real GET probes against a local fixture to assert disconnection, synthetic 503, delayed 200, write-method rejection and no extra origin GET. It requires browser permission to navigate to localhost.
- CI runs the same checks on its Ubuntu runner with an installed browser.

## Report workspace path

`File API JSON -> browser-safe report normalization -> deterministic finding comparison -> DOM text nodes / local JSON export`

The CLI uses the same `src/lib/report-model.mjs` for pure schema projection and comparison in Node. `src/lib/report-files.mjs` imposes a 2 MB file limit and refuses to overwrite comparison inputs. `src/lib/dashboard-server.mjs` is only a localhost static asset listener; it never receives a selected JSON file.

`src/dashboard/app.mjs` is a native ECMAScript module with zero external frontend dependencies. It uses File API, in-memory state and safe DOM text nodes. It can filter evidence, show observation deltas and download a whitelisted JSON comparison. Its built-in sample reports are demonstrative, not scans of a target.

The dashboard has an offline Chrome UI smoke test (the page and sources are inserted into about:blank with bundled fixture fetches) and a separate full browser integration test for actual localhost navigation. Both must be distinguished in verification reporting.
