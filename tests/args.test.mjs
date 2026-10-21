import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/lib/args.mjs';

test('parses safe scan defaults', () => {
  assert.deepEqual(parseArgs(['inspect','https://example.com']), {
    command:'inspect',url:'https://example.com/',timeout:20000,wait:400,failOn:'none'
  });
});

test('parses report and timing options', () => {
  const args = parseArgs(['inspect','http://localhost:3000/','--json','reports/a.json','--timeout','5000','--wait','0']);
  assert.equal(args.json, 'reports/a.json');
  assert.equal(args.timeout, 5000);
  assert.equal(args.wait, 0);
});

test('rejects invalid or unexpected options', () => {
  assert.throws(() => parseArgs(['inspect','https://example.org','--wait','-1']));
  assert.throws(() => parseArgs(['inspect','https://example.org','--unknown','x']));
  assert.throws(() => parseArgs(['inspect','https://example.org','--wait','99999']));
  assert.throws(() => parseArgs(['inspect','https://example.org','--json']));
});
