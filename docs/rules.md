# FlowFault v0.1 rules

Every finding is an *indicator* to verify, not a claim that the entire workflow is broken.

- **FF001**: The loaded document contains no regular HTML `<form>` elements. Shadow DOM and later rendering may not be covered.
- **FF002**: For performance and privacy, the collector caps output at 200 forms and 300 controls per form, and emits a warning when truncated.
- **FF101**: An enabled, inspectable control has no nonempty associated HTML label, `aria-label`, valid `aria-labelledby` text, or `title`. A placeholder alone does not provide a robust accessible name. Real accessibility conformance requires further testing.
- **FF110**: More than one element uses an identical `id`, which can make associations unreliable.
- **FF120**: A form contains no visible inspectable fields. This may be intentional.
- **FF121**: A form has fields but no explicit submit control. Enter-key, script-driven, or other submissions may still exist.
- **FF201**: A password control is present in an HTML form with a GET method, potentially exposing credentials in URLs upon actual submission. FlowFault does not submit it.
- **FF202**: An HTTPS page points a form action at an HTTP address. This is determined from DOM attributes, not from observing a submission.
- **FF203**: A password field has `autocomplete="off"`. Password manager compatibility varies by browser and site; this is informational.

### Snapshot semantics

The scan observes one document after browser readiness and the configured `--wait`. It does not navigate across pages, open dialogs, authenticate, click, fill or submit. It does not capture actual backend operations. Field metadata is limited to type, `id`, `name`, `required`, `disabled`, accessible-name source, placeholder presence and autocomplete setting. `value`, cookies, CSRF tokens and input content are not collected.

### Severity thresholds

`--fail-on critical`: exit status 2 if a critical finding exists.

`--fail-on warning`: exit status 2 if a warning or critical finding exists.

`--fail-on none`: always exit 0 after a successful audit (even with findings).
