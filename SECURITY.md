# Security and privacy

**FlowFault v0.1.0 is a developer inspection tool, not a security scanner or penetration-testing tool.** Only inspect sites you own or are authorized to inspect.

## Inspection model

- Starts a new temporary headless Chrome profile and deletes it after each run.
- Navigates to one user-specified HTTP or HTTPS page. Chrome may request page assets.
- Uses Chrome DevTools Protocol to block non-GET/HEAD requests on the inspected page target while the session is active; other browser/service-worker targets are not a guaranteed security boundary.
- Does not fill inputs, submit forms, click elements, capture screenshots or collect cookies / local storage.
- Does not read input values. Exports only form structure and selected field attributes.
- Strips query strings, fragments and credentials from recorded URLs.
- Does not upload reports or send telemetry.

## Limitations

- GET requests can have server-side effects on poorly designed websites. Do not use this tool on untrusted targets without permission.
- Some pages may not render correctly when POST requests are blocked.
- A single DOM snapshot cannot verify backend delivery, runtime validation, shadow DOM fields, email confirmation or hidden states.
- Reports can still include page titles and developer-chosen element identifiers. **Review reports before sharing publicly.**
- The CDP debugging endpoint is bound to localhost for the duration of the session; never expose the machine to untrusted local processes during a scan.

## Vulnerability reports

Please do not open a public issue containing exploit details or private data. Use GitHub's private vulnerability reporting feature if enabled for the repository, or contact the maintainer privately.
