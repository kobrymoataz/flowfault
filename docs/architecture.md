# Architecture in v0.1.0

FlowFault uses an intentionally small ESM codebase with no runtime npm dependencies.

1. **CLI** validates the command and URL. Only `http:` and `https:` targets without embedded credentials are accepted.
2. **Chrome launcher** selects an installed Chrome / Chromium binary and creates a fresh disposable profile.
3. **CDP bridge** connects to the page target's DevTools WebSocket. The request guard intercepts the page target's requests and continues GET/HEAD while rejecting non-read HTTP methods. This is a defense-in-depth behavior, not an independent guarantee of network safety.
4. **DOM collector** inventories HTML forms in the loaded document. It intentionally does not read form control `value`, cookies, local storage, or page HTML.
5. **Sanitizer** strips URL queries, fragments and credentials and constrains field IDs and names.
6. **Rule engine** produces stable rule identifiers and actionable output with transparent severity.
7. **Report renderer** produces JSON and a no-script, CSP-constrained HTML document with HTML-escaped dynamic content.

Limitations include snapshot timing, lack of shadow DOM traversal, no cross-page workflows, no authentication helpers, and no network assertion that a backend has actually performed a task. Those will require a carefully designed permission model before later releases.
