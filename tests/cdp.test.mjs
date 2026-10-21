import test from 'node:test';
import assert from 'node:assert/strict';
import { CdpClient } from '../src/lib/cdp.mjs';

class FakeSocket {
  readyState = WebSocket.OPEN;
  listeners = new Map();
  sent = [];
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  emit(type, event) { for (const fn of this.listeners.get(type) || []) fn(event); }
  send(payload) { this.sent.push(JSON.parse(payload)); }
  close() { this.readyState = 3; this.emit('close', {}); }
}

test('CDP correlates command requests and responses', async () => {
  const socket = new FakeSocket();
  const client = new CdpClient(socket);
  const response = client.send('Page.enable');
  assert.equal(socket.sent[0].method, 'Page.enable');
  socket.emit('message', {data:JSON.stringify({id:socket.sent[0].id,result:{ok:true}})});
  assert.deepEqual(await response, {ok:true});
  client.close();
});

test('CDP broadcasts events and rejects pending requests on close', async () => {
  const socket = new FakeSocket();
  const client = new CdpClient(socket);
  let eventSeen = false;
  client.on('Fetch.requestPaused', () => { eventSeen = true; });
  socket.emit('message', {data:JSON.stringify({method:'Fetch.requestPaused',params:{}})});
  assert.equal(eventSeen, true);
  const request = client.send('Runtime.enable');
  client.close();
  await assert.rejects(request, /connection was closed/);
});
