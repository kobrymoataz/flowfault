import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { DOM_COLLECTOR } from '../src/lib/collector.mjs';

const element = (tagName, attrs, extra = {}) => ({
  tagName: tagName.toUpperCase(), required: Boolean(attrs.required),
  disabled: false, labels: extra.labels || [],
  getAttribute(name) { return Object.hasOwn(attrs, name) ? attrs[name] : null; },
  get value() { throw new Error('Collector must never read input values'); },
  ...extra
});

test('DOM collector inventories forms without reading sensitive control values', () => {
  const email = element('input', {id:'email',name:'email',type:'email',required:true}, {labels:[{textContent:'Email'}]});
  const password = element('input', {id:'password',name:'password',type:'password'}, {labels:[{textContent:'Password'}]});
  const submit = element('button', {type:'submit'});
  const form = {
    id:'registration', action:'https://example.org/post?token=secret', elements:[email,password,submit],
    getAttribute(name) { return name === 'method' ? 'POST' : null; }
  };
  const document = {
    title:'Example', location:{href:'https://example.org/'}, forms:[form],
    querySelectorAll() { return [email, password]; },
    getElementById() { return null; }
  };
  const raw = runInNewContext(DOM_COLLECTOR, { document }, { timeout: 1000 });
  assert.equal(raw.formCount, 1);
  assert.equal(raw.forms[0].fields.length, 2);
  assert.equal(raw.forms[0].submitControls, 1);
  assert.equal(raw.forms[0].fields[1].type, 'password');
  assert.equal(JSON.stringify(raw).includes('value'), false);
});
