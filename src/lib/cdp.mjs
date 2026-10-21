const TIMEOUT = 12000;

/** Tiny DevTools Protocol client backed by the WebSocket in Node.js 22+. */
export class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    socket.addEventListener('message', event => this.#message(event));
    socket.addEventListener('close', () => this.#closed());
    socket.addEventListener('error', () => this.#closed());
  }

  static async connect(url, timeout = TIMEOUT) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Could not connect to Chrome debugging session.')), timeout);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Chrome debugging connection failed.')); }, { once: true });
    }).catch(error => { socket.close(); throw error; });
    return new CdpClient(socket);
  }

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  async send(method, params = {}, timeout = TIMEOUT) {
    if (this.socket.readyState !== WebSocket.OPEN) throw new Error('Chrome session is closed.');
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Chrome command timed out: ${method}`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.socket.readyState <= WebSocket.OPEN) this.socket.close();
    this.#closed();
  }

  #message(event) {
    let message;
    try { message = JSON.parse(String(event.data)); } catch { return; }
    if (message.id != null) {
      const job = this.pending.get(message.id);
      if (!job) return;
      this.pending.delete(message.id);
      clearTimeout(job.timer);
      if (message.error) job.reject(new Error(`Chrome CDP: ${message.error.message}`));
      else job.resolve(message.result ?? {});
    } else if (message.method) {
      for (const handler of this.handlers.get(message.method) || []) {
        try { handler(message.params || {}); } catch { /* never break other handlers */ }
      }
    }
  }

  #closed() {
    for (const job of this.pending.values()) {
      clearTimeout(job.timer);
      job.reject(new Error('Chrome debugging connection was closed.'));
    }
    this.pending.clear();
  }
}
