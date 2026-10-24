// Transport layer. SocketNet talks to the Node server; LocalNet runs the same RoomHost
// in the browser (solo demo with bots). Both expose the same interface.
import { RoomHost } from '../../shared/host.js';
import { store } from '../ui/dom.js';

class Emitter {
  constructor() { this.handlers = new Set(); }
  on(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }
  emit(msg) { for (const fn of this.handlers) fn(msg); }
}

class BaseNet extends Emitter {
  constructor() { super(); this.seq = 0; this.pending = new Map(); this.offset = 0; this.pid = null; this.code = null; this.mode = 'online'; }
  /** Send a game action; resolves with { ok, error }. */
  act(a) {
    const id = ++this.seq;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.send({ t: 'act', id, a });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); resolve({ ok: false, error: 'Connection is slow — try again.' }); } }, 8000);
    });
  }
  receive(msg) {
    if (msg.t === 'ack' || msg.t === 'err') {
      const res = this.pending.get(msg.id);
      if (res) { this.pending.delete(msg.id); res(msg.t === 'ack' ? { ok: true } : { ok: false, error: msg.msg }); }
      return;
    }
    if (msg.t === 'pong') {
      const rtt = Date.now() - msg.c;
      const est = msg.s + rtt / 2 - Date.now();
      // smooth the clock offset so reveals stay in sync across players
      this.offset = this.offsetSamples ? this.offset * 0.7 + est * 0.3 : est;
      this.offsetSamples = (this.offsetSamples || 0) + 1;
      return;
    }
    this.emit(msg);
  }
  serverNow() { return Date.now() + this.offset; }
}

export class SocketNet extends BaseNet {
  constructor() { super(); this.ws = null; this.backoff = 500; this.closedByUser = false; this.status = 'idle'; }

  /** opts: { create: true } | { code } | { resume: true } */
  start(opts) {
    this.opts = opts;
    return new Promise((resolve, reject) => { this.onWelcome = resolve; this.onFatal = reject; this.open(); });
  }

  open() {
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;
    this.setStatus('connecting');
    ws.onopen = () => {
      const saved = store.get('session');
      const hello = { t: 'hello' };
      if (this.opts.create) hello.create = true;
      else if (this.opts.code) hello.code = this.opts.code;
      if (saved && (!this.opts.code || saved.code === this.opts.code) && !this.opts.create) hello.token = saved.token;
      if (this.pid && saved) hello.token = saved.token; // reconnecting mid-game
      ws.send(JSON.stringify(hello));
      this.pingTimer = setInterval(() => this.send({ t: 'ping', c: Date.now() }), 4000);
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'welcome') {
        this.pid = msg.pid; this.code = msg.code; this.backoff = 500;
        store.set('session', { code: msg.code, token: msg.token });
        this.setStatus('online');
        this.send({ t: 'ping', c: Date.now() });
        if (this.onWelcome) { this.onWelcome(msg); this.onWelcome = null; }
        return;
      }
      if (msg.t === 'fatal') {
        this.closedByUser = true; ws.close();
        if (this.onFatal) { this.onFatal(new Error(msg.msg)); this.onFatal = null; }
        else this.emit({ t: 'fatal', msg: msg.msg });
        return;
      }
      this.receive(msg);
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      if (this.closedByUser) return;
      this.setStatus('reconnecting');
      setTimeout(() => this.open(), this.backoff);
      this.backoff = Math.min(8000, this.backoff * 1.7);
    };
  }

  setStatus(s) { this.status = s; this.emit({ t: 'netstatus', status: s }); }
  send(msg) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); }
  leave() { this.closedByUser = true; store.del('session'); if (this.ws) this.ws.close(); }
}

export class LocalNet extends BaseNet {
  constructor() { super(); this.mode = 'local'; this.status = 'online'; }
  start() {
    const rng = () => { const a = new Uint32Array(2); crypto.getRandomValues(a); return (a[0] * 2 ** 21 + (a[1] >>> 11)) / 2 ** 53; };
    this.host = new RoomHost({ code: 'SOLO', rng, config: {} });
    this.pid = 'you'; this.code = 'SOLO';
    let last = performance.now();
    this.timer = setInterval(() => { const n = performance.now(); this.host.step((n - last) / 1000); last = n; }, 100);
    this.host.join('you', (msg) => setTimeout(() => this.receive(structuredClone(msg)), 0));
    return Promise.resolve({ pid: 'you', code: 'SOLO' });
  }
  send(msg) { setTimeout(() => this.host.handle('you', msg), 0); }
  leave() { clearInterval(this.timer); }
}
