import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/lib/args.mjs';

const cmd = ['simulate','http://127.0.0.1:8080/register','--endpoint','/api/health','--profile','offline'];
test('simulates explicit local GET probe with safe defaults', () => {
  const options = parseArgs(cmd);
  assert.equal(options.command,'simulate');
  assert.equal(options.scenario.profile,'offline');
  assert.equal(options.scenario.scope,'loopback');
  assert.equal(options.wait,300);
});
test('enforces explicit consent for remote staging', () => {
  const remote=[...cmd];remote[1]='https://staging.example.org/register';
  assert.throws(() => parseArgs(remote),/BOTH/);
  assert.equal(parseArgs([...remote,'--allow-remote','--ack-staging']).scenario.scope,'authorized-remote');
});
test('inspect remains backward compatible including fail-on and outputs', () => {
  const options=parseArgs(['inspect','https://example.org/register','--json','a.json','--html','a.html','--fail-on','critical']);
  assert.equal(options.command,'inspect');
  assert.equal(options.failOn,'critical');
  assert.equal(options.json,'a.json');
  assert.equal(options.html,'a.html');
});
test('rejects repeat flags, unknown flags, and malformed values', () => {
  for(const bad of [['--profile','offline'],['--endpoint'],['--delay-ms','1'],['--delay-ms','500000'],['--bogus','x'],['--json','out.json','--json','other.json']]) {
    assert.throws(()=>parseArgs([...cmd,...bad]));
  }
  assert.equal(parseArgs(['simulate',cmd[1],'--endpoint','/api/health','--profile','latency','--delay-ms','150']).scenario.delayMs,150);
  assert.throws(()=>parseArgs([...cmd,'--delay-ms','800']),/only available/);
});
