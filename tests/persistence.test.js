import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { RoomHost } from '../shared/host.js';
import { applyAction } from '../shared/engine.js';
import { mulberry32 } from '../shared/map.js';
import { NATIONS } from '../shared/data/nations.js';

test('a crew survives a JSON save/restore and its timers resume where they stopped', () => {
  let now = 5_000_000;
  const rng = mulberry32(3);
  const host = new RoomHost({ code: 'SAVED', rng, now: () => now });
  for (let i = 0; i < 2; i++) {
    host.join(`p${i}`, () => {});
    const n = NATIONS[i];
    assert.ok(applyAction(host.room, `p${i}`, { type: 'profile:set', name: `P${i}`, nationality: n.id, appearance: n.preset, visited: [] }, host.ctx()).ok);
    assert.ok(applyAction(host.room, `p${i}`, { type: 'role:choose', roleId: 'rookie' }, host.ctx()).ok);
  }
  assert.ok(applyAction(host.room, 'p0', { type: 'host:launch' }, host.ctx()).ok);
  const g = host.room.game;
  const leftBefore = g.stageEndsAt - now;
  const saved = JSON.parse(JSON.stringify(host.snapshot()));
  now += 10 * 60 * 1000; // the server was down 10 minutes
  const back = RoomHost.restore(saved, { rng, now: () => now });
  assert.equal(back.room.code, 'SAVED');
  assert.equal(back.room.phase, 'game');
  assert.equal(back.room.game.stage, g.stage);
  assert.equal(back.room.game.stageEndsAt - now, leftBefore, 'same time left as before the restart');
  assert.equal(back.room.players.p0.wallet, host.room.players.p0.wallet);
  assert.equal(back.room.players.p0.connected, false, 'shown as reconnecting until the browser comes back');
  back.join('p0', () => {});
  assert.equal(back.room.players.p0.connected, true);
});

function startServer(port, dataDir) {
  const proc = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    let out = '';
    const onData = (b) => { out += b; if (out.includes('server on')) resolve(proc); };
    proc.stdout.on('data', onData); proc.stderr.on('data', (b) => { out += b; });
    proc.on('exit', (c) => reject(new Error(`server exited ${c}: ${out}`)));
    setTimeout(() => reject(new Error('server did not start: ' + out)), 8000);
  });
}
const stopServer = (proc) => new Promise((r) => { proc.removeAllListeners('exit'); proc.on('exit', r); proc.kill('SIGTERM'); });

function hello(port, msg) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', ...msg })));
    ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.t === 'welcome' || m.t === 'fatal') resolve({ ws, m }); });
    ws.on('error', reject);
    setTimeout(() => reject(new Error('no welcome')), 5000);
  });
}

test('the real server saves crews and gives players their seat back after a restart', { timeout: 30000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vw4-save-'));
  const port = 3400 + Math.floor(Math.random() * 400);
  try {
    let proc = await startServer(port, dir);
    const a = await hello(port, { create: true });
    assert.equal(a.m.t, 'welcome');
    const { code, token, pid } = a.m;
    await new Promise((r) => setTimeout(r, 400));
    a.ws.close();
    await stopServer(proc); // SIGTERM → final save
    assert.ok(readdirSync(dir).includes(`${code}.json`), 'crew saved to disk');

    proc = await startServer(port, dir);
    const b = await hello(port, { code, token });
    assert.equal(b.m.t, 'welcome');
    assert.equal(b.m.resumed, true, 'same seat');
    assert.equal(b.m.pid, pid);
    b.ws.close();
    const c = await hello(port, { code });
    assert.equal(c.m.t, 'welcome', 'a friend can still join with the invite code');
    assert.notEqual(c.m.pid, pid);
    c.ws.close();
    await stopServer(proc);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Upstash store speaks the Redis REST protocol (mocked)', async () => {
  const { createStore } = await import('../server/store.js');
  const db = new Map(); const sets = new Map(); const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const [cmd, ...args] = JSON.parse(init.body); calls.push(cmd);
    assert.equal(url, 'https://example.upstash.io');
    assert.equal(init.headers.Authorization, 'Bearer secret');
    let result = 'OK';
    if (cmd === 'SET') db.set(args[0], args[1]);
    else if (cmd === 'GET') result = db.get(args[0]) ?? null;
    else if (cmd === 'SADD') { if (!sets.has(args[0])) sets.set(args[0], new Set()); sets.get(args[0]).add(args[1]); result = 1; }
    else if (cmd === 'SMEMBERS') result = [...(sets.get(args[0]) || [])];
    else if (cmd === 'PING') result = 'PONG';
    return new Response(JSON.stringify({ result }), { status: 200 });
  };
  try {
    const st = createStore({ UPSTASH_REDIS_REST_URL: 'https://example.upstash.io/', UPSTASH_REDIS_REST_TOKEN: 'secret' });
    assert.equal(st.kind, 'Upstash Redis');
    await st.init();
    await st.save('ABCDE', { savedAt: 1, room: { code: 'ABCDE' } });
    assert.deepEqual((await st.load('ABCDE')).room, { code: 'ABCDE' });
    assert.equal((await st.loadAll()).length, 1);
    assert.ok(calls.includes('SET') && calls.includes('SADD'));
  } finally { globalThis.fetch = realFetch; }
});
