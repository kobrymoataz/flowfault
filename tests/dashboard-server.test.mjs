import test from 'node:test';
import assert from 'node:assert/strict';
import { startDashboard } from '../src/lib/dashboard-server.mjs';
import { request } from 'node:http';
import { parseArgs } from '../src/lib/args.mjs';

test('dashboard CLI stays loopback-only and validates port', () => {
  assert.deepEqual(parseArgs(['dashboard']),{command:'dashboard',port:4173});
  assert.deepEqual(parseArgs(['dashboard','--port','0']),{command:'dashboard',port:0});
  assert.throws(()=>parseArgs(['dashboard','--host','0.0.0.0']),/only --port/);
  assert.throws(()=>parseArgs(['dashboard','--port','65536']),/between/);
});
test('dashboard serves only static assets, refuses writes and hostile hosts',async()=>{
  const app=await startDashboard({port:0});
  try {
    const page=await fetch(app.url);
    assert.equal(page.status,200);
    assert.match(await page.text(),/Report workspace/);
    assert.match(page.headers.get('content-security-policy'),/default-src 'none'/);
    assert.match(page.headers.get('content-security-policy'),/form-action 'none'/);
    const js=await fetch(app.url+'assets/app.mjs');
    assert.equal(js.status,200);
    assert.match(js.headers.get('content-type'),/javascript/);
    const sample=await fetch(app.url+'samples/current.json');
    assert.equal((await sample.json()).scan.sample,true);
    const head=await fetch(app.url,{method:'HEAD'});
    assert.equal(head.status,200);
    const post=await fetch(app.url,{method:'POST',body:'PRIVATE-REPORT'});
    assert.equal(post.status,405);
    const traversal=await fetch(app.url+'../../.env');
    assert.equal(traversal.status,404);
    const wrongHostStatus=await new Promise((resolve,reject)=>{
      const req=request(app.url,{headers:{Host:'attacker.test'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
      req.on('error',reject);req.end();
    });
    assert.equal(wrongHostStatus,403);
    const wrongOrigin=await fetch(app.url,{headers:{Origin:'https://attacker.test'}});
    assert.equal(wrongOrigin.status,403);
  } finally {await app.close();}
});
