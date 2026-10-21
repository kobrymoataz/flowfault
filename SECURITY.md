# Security and privacy

FlowFault is a **developer QA tool**, not a network sandbox, security certification tool, penetration test utility, or guaranteed isolation boundary. Only run it on websites you own or are explicitly authorized to test.

## Safety model

- A temporary headless Chrome profile is created for every scan, then deleted.
- CDP interception on the selected page target blocks all HTTP methods other than GET/HEAD, including writes triggered by page scripts.
- This interception **does not cover every possible Chrome process, target, service worker, WebSocket, background request or external process**. Do not consider it a comprehensive firewall.
- `inspect` reads form metadata without reading or recording form values, passwords, cookies, response bodies or local storage.
- `simulate` deliberately performs exactly one credential-free same-origin GET to an explicit path and alters at most one request using the selected profile.
- `simulate` allows loopback (`localhost`, `127.0.0.1`, `::1`) by default. Testing any other host requires **both** `--allow-remote` and `--ack-staging`, and HTTPS.
- HTTP 503 replies are synthesized inside Chrome and do not reach the target origin. The `offline` profile fails the matching request in Chrome. The `latency` profile delays **and then forwards** the GET to its origin.
- No form controls are filled or submitted. No request headers, cookies, user input values, response bodies, URL queries or fragments are exported in reports.
- FlowFault has no hosted service, third-party telemetry or analytics scripts.

## Limitations and precautions

- A GET request can still produce server-side effects on a poorly designed application, even when it is nominally read-only. **Use dedicated staging accounts and endpoints.** Do not probe login, logout, payment, account deletion or production endpoints.
- A page may itself issue GET requests during initial navigation, and these may be forwarded. You are responsible for testing a safe, approved target.
- Page scripts can alter network behavior; JavaScript on a malicious inspected page is not a trusted environment.
- The simulator tests one network transport observation. It does not measure UI recovery, retries or end-to-end deliverability.
- Chrome and Chromium behavior is version-sensitive; run real browser tests on your target platform before publishing results.
- Some reports include page titles, paths and element identifiers. Review documents before public sharing.
- CDP's local debugging socket exists while the scan is running; do not expose it externally.

## Reporting vulnerabilities

Do not post private security details, authentication material or raw customer data to public issues. Use GitHub private vulnerability reporting if available, or contact the maintainer privately.
