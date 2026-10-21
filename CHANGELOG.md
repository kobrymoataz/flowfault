# Changelog

## [0.1.0] - 2026-10-21

### Added
- Dependency-free Node.js CLI and Chrome-based read-only form discovery.
- CDP interception that blocks all non-GET/HEAD browser network requests.
- Explainable, rule-based findings for labels, duplicate ids and dangerous form method / action combinations.
- CLI exit thresholds for future automation.
- Portable JSON reports and standalone, escaped, script-free HTML reports.
- Unit tests, integration fixture, demo, GitHub Actions verification and contributor documentation.

### Known limitations
- Only the current document's regular HTML forms are examined.
- Client-side applications may need a longer `--wait` value.
- This release cannot verify whether submitted data reaches a server, database or mailbox.
