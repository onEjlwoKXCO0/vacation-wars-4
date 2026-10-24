// VW4 multiplayer server: static files + WebSocket rooms. All game rules run here.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { randomInt, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { RoomHost } from '../shared/host.js';
import { createStore } from './store.js';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const ASSETS = fileURLToPath(new URL('../assets/', import.meta.url));
const ROOM_IDLE_MS = 6 * 60 * 60 * 1000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.map': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

// Cryptographically strong uniform draw in [0, 1) — used for every random game outcome.
const secureRng = () => randomInt(0, 2 ** 48 - 1) / 2 ** 48;

const rooms = new Map();   // code → { host, timer }
const tokens = new Map();  // token → { code, pid }

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) {
    const code = Array.from({ length: 5 }, () => A[randomInt(0, A.length)]).join('');
    if (!rooms.has(code)) return code;
  }
}

const store = createStore();
let storeOk = false;
let lastSaveError = '';

/** Save a crew (state + reconnect tokens). Never runs twice at once for the same crew. */
async function saveRoom(code) {
  const entry = rooms.get(code);
  if (!entry || !storeOk || entry.saving) return;
  entry.saving = true;
  const version = entry.host.room.version;
  try {
    const roomTokens = [...tokens].filter(([, v]) => v.code === code).map(([t, v]) => [t, v.pid]);
    await store.save(code, { ...entry.host.snapshot(), tokens: roomTokens });
    entry.savedVersion = version;
  } catch (e) { lastSaveError = e.message; console.warn(`[room ${code}] save failed: ${e.message}`); }
  finally { entry.lastSave = Date.now(); entry.saving = false; }
}

function startRoom(code, host) {
  let last = Date.now();
  const entry = { host, timer: null, savedVersion: host.room.version, lastSave: 0, saving: false };
  entry.timer = setInterval(() => {
    const now = Date.now();
    host.step((now - last) / 1000);
    last = now;
    // save at most every 1.5 s, only when something changed
    if (host.room.version !== entry.savedVersion && now - entry.lastSave > 1500) saveRoom(code);
    if (!host.hasHumansConnected() && now - host.lastActivity > ROOM_IDLE_MS) {
      clearInterval(entry.timer);
      rooms.delete(code);
      for (const [t, v] of tokens) if (v.code === code) tokens.delete(t);
      saveRoom(code); // keep it a week in case the crew comes back
      console.log(`[room ${code}] closed (idle) — still saved`);
    }
  }, 100);
  rooms.set(code, entry);
  return entry;
}

function createRoom() {
  const code = newCode();
  startRoom(code, new RoomHost({ code, rng: secureRng }));
  console.log(`[room ${code}] created`);
  return code;
}

/** Bring every saved crew back (called once at boot). */
async function restoreRooms() {
  try { await store.init(); storeOk = true; } catch (e) { console.warn(`[store] unavailable (${e.message}) — games will NOT survive a restart`); return; }
  let n = 0;
  for (const saved of await store.loadAll()) {
    try {
      const code = saved.room.code;
      if (rooms.has(code)) continue;
      const host = RoomHost.restore(saved, { rng: secureRng });
      for (const [t, pid] of saved.tokens || []) tokens.set(t, { code, pid });
      startRoom(code, host);
      n++;
    } catch (e) { console.warn(`[store] could not restore a crew: ${e.message}`); }
  }
  console.log(`[store] ${store.kind}: ${n} saved crew${n === 1 ? '' : 's'} restored`);
}

/** Lookup that also wakes a crew that was closed for idleness but is still saved. */
async function findRoom(code) {
  if (rooms.has(code)) return rooms.get(code);
  if (!storeOk || !/^[A-Z]{5}$/.test(code)) return null;
  try {
    const saved = await store.load(code);
    if (!saved || !saved.room || rooms.has(code)) return rooms.get(code) || null;
    for (const [t, pid] of saved.tokens || []) tokens.set(t, { code, pid });
    console.log(`[room ${code}] woken from storage`);
    return startRoom(code, RoomHost.restore(saved, { rng: secureRng }));
  } catch { return null; }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(`ok ${rooms.size} rooms · ${[...rooms.values()].reduce((n, e) => n + e.host.clients.size, 0)} online · saves: ${storeOk ? store.kind : 'off'}${lastSaveError ? ` · last save error: ${lastSaveError}` : ''}`); }
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (path === '/' || !extname(path)) path = '/index.html';
    const base = path.startsWith('/assets/') ? ASSETS : PUBLIC;
    const file = join(base, path.startsWith('/assets/') ? path.slice('/assets/'.length) : path);
    if (!file.startsWith(base) || !existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': path === '/index.html' ? 'no-cache' : 'public, max-age=300' });
    res.end(body);
  } catch (e) {
    res.writeHead(500); res.end('Server error');
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

wss.on('connection', (ws) => {
  let session = null; // { code, pid }
  const send = (msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
  let msgCount = 0;
  const rate = setInterval(() => { msgCount = 0; }, 1000);

  let joining = false;
  ws.on('message', async (raw) => {
    if (++msgCount > 60) return; // simple flood guard
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!session) {
      if (msg.t === 'hello' && !joining) {
        joining = true;
        try { await handleHello(msg); } finally { joining = false; }
      }
      return;
    }
    const entry = rooms.get(session.code);
    if (entry) entry.host.handle(session.pid, msg);
  });

  async function handleHello(msg) {
        // Reconnect with a saved token if possible (also wakes a crew that was put to sleep).
        const askedCode = typeof msg.code === 'string' ? msg.code.toUpperCase().trim() : '';
        if (msg.token && !tokens.has(msg.token) && askedCode) await findRoom(askedCode);
        const saved = msg.token && tokens.get(msg.token);
        if (saved) await findRoom(saved.code);
        if (ws.readyState !== 1) return;
        if (saved && rooms.has(saved.code) && rooms.get(saved.code).host.room.players[saved.pid]) {
          session = saved;
          send({ t: 'welcome', code: saved.code, pid: saved.pid, token: msg.token, resumed: true });
          rooms.get(saved.code).host.join(saved.pid, send);
          return;
        }
        let code = typeof msg.code === 'string' ? msg.code.toUpperCase().trim() : '';
        if (msg.create) code = createRoom();
        const entry = code ? await findRoom(code) : null;
        if (ws.readyState !== 1) return;
        if (!entry) return send({ t: 'fatal', msg: code ? `No crew with code ${code}. Check the invite code.` : 'Missing invite code.' });
        if (entry.host.room.order.length >= entry.host.room.config.maxPlayers) return send({ t: 'fatal', msg: 'This crew is full.' });
        const pid = 'p_' + randomBytes(6).toString('hex');
        const token = randomBytes(18).toString('base64url');
        tokens.set(token, { code, pid });
        session = { code, pid };
        send({ t: 'welcome', code, pid, token, resumed: false });
        entry.host.join(pid, send);
        saveRoom(code);
  }

  ws.on('close', () => {
    clearInterval(rate);
    if (session && rooms.has(session.code)) rooms.get(session.code).host.leave(session.pid);
  });
});

// Keep-alive so proxies don't drop idle sockets.
setInterval(() => { for (const ws of wss.clients) if (ws.readyState === 1) ws.ping(); }, 25000);

// Save everything before the host stops us (redeploy, sleep, Ctrl+C).
let stopping = false;
async function shutdown(sig) {
  if (stopping) return; stopping = true;
  console.log(`[server] ${sig}: saving ${rooms.size} crew(s)…`);
  await Promise.race([Promise.all([...rooms.keys()].map((c) => { const e = rooms.get(c); e.savedVersion = -1; e.saving = false; return saveRoom(c); })), new Promise((r) => setTimeout(r, 8000))]);
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

await restoreRooms();
server.listen(PORT, () => console.log(`VACATION WARS 4 server on http://localhost:${PORT}`));
