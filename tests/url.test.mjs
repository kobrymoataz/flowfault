import test from 'node:test';
import assert from 'node:assert/strict';
import { identifier, publicUrl, validateTarget } from '../src/lib/url.mjs';

test('accepts local and public HTTP URLs', () => {
  assert.equal(validateTarget('http://127.0.0.1:3000/'), 'http://127.0.0.1:3000/');
  assert.equal(validateTarget('https://example.org'), 'https://example.org/');
});

test('refuses non-web protocols and embedded credentials', () => {
  assert.throws(() => validateTarget('file:///etc/passwd'));
  assert.throws(() => validateTarget('https://person:secret@example.com/'));
});

test('redacts query strings, fragments and credentials from output URLs', () => {
  assert.equal(publicUrl('https://example.com:443/register?token=private#key'), 'https://example.com/register');
  assert.equal(publicUrl('https://me:secret@example.com/form'), 'https://example.com/form');
});

test('allows recognizable form identifiers without arbitrary content', () => {
  assert.equal(identifier('person.email'), 'person.email');
  assert.equal(identifier('something with spaces'), '(redacted)');
  assert.equal(identifier(''), '');
});
