// RoomHost: wraps the pure engine with clients, timers, bots and movement relay.
// Runs on the Node server for real multiplayer, or in the browser for the solo demo.

import { createRoom, addPlayer, setConnected, applyAction, tick, viewFor, canEnterUpstairs, resumeAfterRestart } from './engine.js';
import { botThink } from './bots.js';
import { WAYPOINTS, WAY_EDGES, SPAWN, MAP_W, MAP_H } from './map.js';

const EMOTES = new Set(['wave', 'heart', 'laugh', 'dance', 'thumbs', 'party', 'kiss']);
const EMB_NATION = { pt: 'portugal', mk: 'macedonia', pl: 'poland', ma: 'morocco' };

export class RoomHost {
  /** @param {{code:string, rng:()=>number, now?:()=>number, config?:object}} opts */
  constructor({ code, rng, now = Date.now, config }) {
    this.rng = rng;
    this.now = now;
    this.room = createRoom({ code, now: now(), config });
    this.clients = new Map(); // pid → send(msg)
    this.positions = new Map(); // pid → {x,y,dir,moving,scene}
    this.botMem = new Map();
    this.botNav = new Map();
    this.lastEmote = new Map();
    this.sentVersion = -1;
    this.posDirty = false;
    this.lastActivity = now();
  }

  ctx() { return { now: this.now(), rng: this.rng }; }

  /** Everything needed to bring this crew back after a restart (positions are not needed). */
  snapshot() { return { v: 1, savedAt: this.now(), room: this.room }; }

  /** Rebuild a crew from a snapshot; timers resume where they stopped. */
  static restore(saved, { rng, now = Date.now }) {
    const host = new RoomHost({ code: saved.room.code, rng, now });
    host.room = saved.room;
    resumeAfterRestart(host.room, now(), now() - (saved.savedAt || now()));
    return host;
  }

  join(pid, send) {
    const room = this.room;
    if (!room.players[pid]) addPlayer(room, { id: pid, now: this.now() });
    this.clients.set(pid, send);
    setConnected(room, pid, true, this.now());
    if (!this.positions.has(pid)) this.positions.set(pid, { x: SPAWN.x + (this.rng() - 0.5) * 3, y: SPAWN.y, dir: 'down', moving: false, scene: 'campus' });
    this.lastActivity = this.now();
    send({ t: 'pos', list: this.posList() });
    this.broadcastState(true);
  }

  leave(pid) {
    this.clients.delete(pid);
    if (this.room.players[pid]) setConnected(this.room, pid, false, this.now());
    this.broadcastState(true);
  }

  hasHumansConnected() { return this.clients.size > 0; }

  handle(pid, msg) {
    if (!msg || typeof msg !== 'object') return;
    this.lastActivity = this.now();
    if (msg.t === 'act') {
      const res = applyAction(this.room, pid, msg.a, this.ctx());
      const send = this.clients.get(pid);
      if (send) send(res.ok ? { t: 'ack', id: msg.id } : { t: 'err', id: msg.id, msg: res.error });
      this.dispatchEvents(res.events);
      this.broadcastState();
      if (res.ok && msg.a.type === 'host:removePlayer') { this.positions.delete(msg.a.targetId); this.posDirty = true; }
    } else if (msg.t === 'pos') {
      const x = Number(msg.x), y = Number(msg.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > MAP_W || y > MAP_H) return;
      const scene = typeof msg.scene === 'string' && /^(campus|ship|emb_(pt|mk|pl|ma)_[12]|in_(hq|roles|black|club|bio|seer))$/.test(msg.scene) ? msg.scene : 'campus';
      const up = scene.match(/^emb_(pt|mk|pl|ma)_2$/);
      if (up && !canEnterUpstairs(this.room, pid, EMB_NATION[up[1]])) return; // private floor
      this.positions.set(pid, { x, y, dir: ['up', 'down', 'left', 'right'].includes(msg.dir) ? msg.dir : 'down', moving: !!msg.moving, jump: Number(msg.jump) > 0 ? Math.min(1, Number(msg.jump)) : 0, scene });
      this.posDirty = true;
    } else if (msg.t === 'emote') {
      if (!EMOTES.has(msg.e)) return;
      const last = this.lastEmote.get(pid) || 0;
      if (this.now() - last < 600) return;
      this.lastEmote.set(pid, this.now());
      this.broadcast({ t: 'emote', pid, e: msg.e });
    } else if (msg.t === 'ping') {
      const send = this.clients.get(pid);
      if (send) send({ t: 'pong', c: msg.c, s: this.now() });
    }
  }

  dispatchEvents(events) {
    for (const ev of events || []) {
      if (ev.type === 'toast' || ev.type === 'kick') {
        const send = this.clients.get(ev.to);
        if (send) send({ t: 'event', ev });
      } else this.broadcast({ t: 'event', ev });
    }
  }

  broadcast(msg) { for (const send of this.clients.values()) send(msg); }

  broadcastState(force = false) {
    if (!force && this.room.version === this.sentVersion) return;
    this.sentVersion = this.room.version;
    const now = this.now();
    for (const [pid, send] of this.clients) {
      if (this.room.players[pid]) send({ t: 'state', s: viewFor(this.room, pid, now) });
      else send({ t: 'event', ev: { type: 'kick', to: pid } });
    }
  }

  posList() {
    const out = [];
    for (const [pid, p] of this.positions) if (this.room.players[pid]) out.push([pid, Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, p.dir, p.moving ? 1 : 0, p.scene, p.jump ? Math.round(p.jump * 100) / 100 : 0]);
    return out;
  }

  /** Call ~10×/s. */
  step(dt) {
    const ctx = this.ctx();
    this.dispatchEvents(tick(this.room, ctx));
    for (const pid of this.room.order) {
      const p = this.room.players[pid];
      if (!p || !p.isBot) continue;
      if (!this.botMem.has(pid)) this.botMem.set(pid, {});
      const a = botThink(this.room, pid, this.botMem.get(pid), ctx);
      if (a) this.dispatchEvents(applyAction(this.room, pid, a, ctx).events);
      this.moveBot(pid, dt);
    }
    this.broadcastState();
    if (this.posDirty) { this.posDirty = false; this.broadcast({ t: 'pos', list: this.posList() }); }
  }

  moveBot(pid, dt) {
    const p = this.room.players[pid];
    let pos = this.positions.get(pid);
    if (!pos) {
      const keys = Object.keys(WAYPOINTS);
      const k = keys[Math.floor(this.rng() * keys.length)];
      pos = { x: WAYPOINTS[k][0], y: WAYPOINTS[k][1], dir: 'down', moving: false, scene: 'campus' };
      this.positions.set(pid, pos);
      this.botNav.set(pid, { at: k, to: null, wait: 0 });
    }
    const nav = this.botNav.get(pid) || { at: 'H', to: null, wait: 0 };
    this.botNav.set(pid, nav);
    pos.scene = this.room.phase === 'game' ? 'ship' : 'campus';
    if (pos.scene === 'ship') { pos.moving = false; return; }
    nav.goal = p.boarded ? 'R' : null;
    if (!nav.to) {
      if (nav.wait > 0) { nav.wait -= dt; if (pos.moving) { pos.moving = false; this.posDirty = true; } return; }
      const nexts = WAY_EDGES.filter((e) => e.includes(nav.at)).map((e) => (e[0] === nav.at ? e[1] : e[0]));
      if (nav.goal && nav.at === nav.goal) { nav.wait = 2; return; }
      nav.to = nav.goal ? this.towards(nav.at, nav.goal) : nexts[Math.floor(this.rng() * nexts.length)];
    }
    const [tx, ty] = WAYPOINTS[nav.to];
    const dx = tx - pos.x, dy = ty - pos.y;
    const d = Math.hypot(dx, dy);
    const sp = 3.2 * dt;
    if (d <= sp) {
      pos.x = tx; pos.y = ty; nav.at = nav.to; nav.to = null;
      nav.wait = this.rng() < 0.35 ? 1 + this.rng() * 4 : 0;
    } else {
      pos.x += (dx / d) * sp; pos.y += (dy / d) * sp;
      pos.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    pos.moving = true;
    this.posDirty = true;
  }

  /** BFS next hop on the waypoint graph. */
  towards(from, goal) {
    const prev = { [from]: null };
    const q = [from];
    while (q.length) {
      const n = q.shift();
      if (n === goal) break;
      for (const e of WAY_EDGES) {
        if (!e.includes(n)) continue;
        const m = e[0] === n ? e[1] : e[0];
        if (!(m in prev)) { prev[m] = n; q.push(m); }
      }
    }
    let cur = goal;
    while (prev[cur] && prev[cur] !== from) cur = prev[cur];
    return cur === from ? null : cur;
  }
}
