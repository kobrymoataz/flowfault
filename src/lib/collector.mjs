/** Runs in the inspected browser document. Never reads field values. */
export const DOM_COLLECTOR = String.raw`(() => {
  const safeString = (value, max = 180) => typeof value === 'string' ? value.slice(0, max) : '';
  const duplicateIds = [];
  const counts = new Map();
  for (const element of document.querySelectorAll('[id]')) {
    const id = element.getAttribute('id');
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }
  for (const [id, amount] of counts) {
    if (amount > 1) duplicateIds.push({ id: safeString(id, 72), count: amount });
    if (duplicateIds.length >= 100) break;
  }

  const collectNameSource = (el) => {
    if (el.labels && Array.from(el.labels).some(label => label.textContent.trim())) return 'label';
    if (el.getAttribute('aria-label')?.trim()) return 'aria-label';
    const ids = (el.getAttribute('aria-labelledby') || '').trim().split(/\s+/).filter(Boolean);
    if (ids.some(id => document.getElementById(id)?.textContent?.trim())) return 'aria-labelledby';
    if (el.getAttribute('title')?.trim()) return 'title';
    return 'none';
  };

  const forms = Array.from(document.forms).slice(0, 200).map((form, formIndex) => {
    const elements = Array.from(form.elements);
    const fields = elements.filter(el => {
      const tag = el.tagName.toLowerCase();
      return ['input', 'textarea', 'select'].includes(tag) &&
        !['hidden', 'submit', 'reset', 'button', 'image'].includes((el.getAttribute('type') || '').toLowerCase());
    }).slice(0, 300).map((el, fieldIndex) => ({
      index: fieldIndex,
      tag: el.tagName.toLowerCase(),
      type: safeString((el.getAttribute('type') || (el.tagName.toLowerCase() === 'input' ? 'text' : el.tagName.toLowerCase())).toLowerCase(), 28),
      id: safeString(el.getAttribute('id') || '', 180),
      name: safeString(el.getAttribute('name') || '', 180),
      required: Boolean(el.required),
      disabled: Boolean(el.disabled),
      nameSource: collectNameSource(el),
      hasPlaceholder: Boolean(el.getAttribute('placeholder')?.trim()),
      autocomplete: safeString(el.getAttribute('autocomplete') || '', 50)
    }));
    const submitControls = elements.filter(el => {
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute('type') || (tag === 'button' ? 'submit' : 'text')).toLowerCase();
      return (tag === 'button' && type === 'submit') || (tag === 'input' && ['submit', 'image'].includes(type));
    }).length;
    return {
      index: formIndex,
      id: safeString(form.id || '', 180),
      method: safeString((form.getAttribute('method') || 'get').toLowerCase(), 16),
      action: safeString(form.action || document.location.href, 2048),
      submitControls,
      totalFieldCount: elements.filter(el => ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)).length,
      fields
    };
  });

  return {
    title: safeString(document.title || '', 160),
    formCount: document.forms.length,
    forms,
    duplicateIds,
    truncated: document.forms.length > 200 || forms.some(f => f.totalFieldCount > 300)
  };
})()`;
