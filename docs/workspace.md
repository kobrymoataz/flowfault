# Local report workspace

FlowFault v0.3.0 adds two compatible report analysis interfaces: a terminal comparison command and a local browser dashboard. They read existing report JSON, not the website being inspected.

## Open dashboard

```bash
npm ci
npm run build
npm run dashboard
```

Visit `http://127.0.0.1:4173/`. The site loads **sample reports** on first launch, clearly marked as examples. Choose **Import current report** to replace the example, and **Import baseline** for an earlier run. Use the Findings search and severity filter. When two compatible reports are loaded, choose **Export comparison JSON** to save a whitelisted diff locally.

The server never accepts an uploaded report. The File API reads files in browser memory only; reloading forgets them. A 2 MB limit prevents accidentally importing large exports. No telemetry, persistence, or third-party packages are used. The server accepts only GET/HEAD on a fixed list of static resources, bound to IPv4 localhost.

## Terminal comparison

```bash
node dist/cli.mjs compare reports/baseline.json reports/current.json \
  --json reports/comparison.json --fail-on new-critical
```

The output contains counts, new and resolved findings and changed severities. The exit status is `2` only when the selected policy is triggered. Accepted thresholds are `none`, `new-critical`, and `any-new`. Mismatched reports or invalid input fail with exit code `1`.

The report loader never executes code in JSON. It rejects oversized files and unsupported schemas and refuses to overwrite the input report with output.

## Comparison contract

- Both inputs must be FlowFault `schemaVersion: 1.0` JSON reports.
- **Inspection:** identical normalized target page URLs, excluding queries and fragments. Findings match by `FFxxx` rule, form/field index; page-level findings use their detail as an additional discriminator. Reordered DOM structures can create apparent new/resolved items.
- **Scenario:** identical normalized page, endpoint and injection profile. Changes are limited to response kind/status and elapsed time from **one** GET probe per report. There is no statistical inference or claim of automatic recovery.
- New findings and resolved findings are separate from persisting findings. A severity change on the same finding location is shown separately.
- A report with no findings is not a security, accessibility or reliability certificate.

## Privacy boundaries

Report JSON may contain page titles, endpoint paths, form field identifiers, and problem descriptions. Query strings, credentials and hash fragments are discarded from target URLs during normalization. Input reports themselves are not edited. When sharing comparisons, check the page path and finding titles for identifying information. The exported comparison intentionally omits verbose finding details and fixes.

## Browser verification

```bash
npm run test:dashboard-browser-offline
npm run test:dashboard-integration
```

The first runs real Chromium with the dashboard code and example data injected into `about:blank`, without navigating a network URL. The second visits the server and validates same-origin loading and interactions. Managed environments may forbid Chrome localhost navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`; that **must not** be reported as a pass. Run it on macOS or GitHub Actions before release.
