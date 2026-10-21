/**
 * Rules intentionally favor explainability over noisy heuristics.
 * These are diagnostics, not a WCAG compliance certification.
 */
export function analyze(snapshot) {
  const issues = [];
  const add = (code, severity, title, detail, recommendation, location = {}) => {
    issues.push({ code, severity, title, detail, recommendation, ...location });
  };
  const countFields = snapshot.forms.reduce((total, form) => total + form.fields.length, 0);

  if (snapshot.formCount === 0) {
    add('FF001', 'info', 'No HTML forms detected',
      'No form elements were present when this snapshot was taken.',
      'Check whether the page uses shadow DOM or renders forms after the chosen wait time.');
  }
  if (snapshot.truncated) {
    add('FF002', 'warning', 'Collection limit reached',
      'The page has more forms or fields than v0.1.0 collects.',
      'Inspect a smaller page or split the workflow into focused pages.');
  }

  for (const duplicate of snapshot.duplicateIds) {
    add('FF110', 'warning', 'Duplicate HTML id',
      `The id "${duplicate.id}" occurs ${duplicate.count} times.`,
      'Give each element a unique id, especially controls associated with labels.');
  }
  for (const form of snapshot.forms) {
    const loc = { formIndex: form.index };
    if (!form.fields.length) {
      add('FF120', 'info', 'Form has no visible fields',
        'This form contains no inspectable inputs, textareas or selects.',
        'Review whether the form is still needed or its fields are generated later.', loc);
    }
    if (form.fields.length && form.submitControls === 0) {
      add('FF121', 'info', 'No explicit submit control',
        'No button or input with submit behavior was associated with the form.',
        'Confirm users have a discoverable way to complete the workflow.', loc);
    }
    if (form.method === 'get' && form.fields.some(field => field.type === 'password' && !field.disabled)) {
      add('FF201', 'critical', 'Password form uses GET',
        'A password field is present in a form with GET as its HTTP method.',
        'Submit sensitive fields using POST over HTTPS; never place passwords in a URL.', loc);
    }
    try {
      const action = new URL(form.action);
      if (new URL(snapshot.url).protocol === 'https:' && action.protocol === 'http:') {
        add('FF202', 'critical', 'HTTPS form targets HTTP',
          'An HTTPS page has a form action pointing to an unencrypted HTTP endpoint.',
          'Use an HTTPS endpoint for the form action.', loc);
      }
    } catch { /* malformed actions are outside this rule */ }

    for (const field of form.fields) {
      if (field.disabled) continue;
      const location = { formIndex: form.index, fieldIndex: field.index };
      if (field.nameSource === 'none') {
        add('FF101', 'warning', 'Form control has no accessible name',
          `The ${field.type} control${field.id ? ` #${field.id}` : ''} has no associated label, aria-label, aria-labelledby or title.`,
          'Add a visible <label> linked to the control, or another valid accessible name.', location);
      }
      if (field.type === 'password' && field.autocomplete === 'off') {
        add('FF203', 'info', 'Password autocomplete disabled',
          'This password field declares autocomplete="off".',
          'Consider using current-password or new-password to support password managers.', location);
      }
    }
  }

  const counts = {
    critical: issues.filter(issue => issue.severity === 'critical').length,
    warning: issues.filter(issue => issue.severity === 'warning').length,
    info: issues.filter(issue => issue.severity === 'info').length
  };
  return {
    summary: {
      forms: snapshot.formCount,
      analyzedForms: snapshot.forms.length,
      fields: countFields,
      issues: issues.length,
      ...counts
    },
    issues
  };
}

export function hasFailingIssues(issues, threshold = 'none') {
  if (threshold === 'critical') return issues.some(issue => issue.severity === 'critical');
  if (threshold === 'warning') return issues.some(issue => ['critical', 'warning'].includes(issue.severity));
  return false;
}
