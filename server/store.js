// Saved games. Every crew is written to storage a moment after each change, and reloaded when the
// server starts again — so a restart, a redeploy or a free host going to sleep never ends a game.
//
//   • UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set → Upstash Redis (free, survives anything)
//   • otherwise → JSON files in DATA_DIR (default ./data) — fine on your own computer or a Fly.io volume
import { mkdir, readFile, writeFile, rename, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const KEEP_SECONDS = 7 * 24 * 3600; // a saved crew is kept one week after its last change

class FileStore {
  constructor(dir) { this.dir = dir; this.kind = `files in ${dir}`; }
  async init() { await mkdir(this.dir, { recursive: true }); }
  file(code) { return join(this.dir, `${code}.json`); }
  async save(code, data) {
    const tmp = this.file(code) + '.tmp';
    await writeFile(tmp, JSON.stringify(data));
    await rename(tmp, this.file(code)); // atomic: never a half-written save
  }
  async remove(code) { try { await unlink(this.file(code)); } catch {} }
  async load(code) { try { return JSON.parse(await readFile(this.file(code), 'utf8')); } catch { return null; } }
  async loadAll() {
    const out = [];
    for (const f of await readdir(this.dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const data = JSON.parse(await readFile(join(this.dir, f), 'utf8'));
        if (Date.now() - (data.savedAt || 0) < KEEP_SECONDS * 1000) out.push(data); else await unlink(join(this.dir, f));
      } catch (e) { console.warn(`[store] skipping unreadable save ${f}: ${e.message}`); }
    }
    return out;
  }
}

class UpstashStore {
  constructor(url, token) { this.url = url.replace(/\/$/, ''); this.token = token; this.kind = 'Upstash Redis'; }
  async cmd(...args) {
    const res = await fetch(this.url, { method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'content-type': 'application/json' }, body: JSON.stringify(args) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) throw new Error(body.error || `HTTP ${res.status}`);
    return body.result;
  }
  async init() { await this.cmd('PING'); }
  async save(code, data) {
    await this.cmd('SET', `vw4:room:${code}`, JSON.stringify(data), 'EX', String(KEEP_SECONDS));
    await this.cmd('SADD', 'vw4:rooms', code);
  }
  async remove(code) { await this.cmd('DEL', `vw4:room:${code}`); await this.cmd('SREM', 'vw4:rooms', code); }
  async load(code) { const raw = await this.cmd('GET', `vw4:room:${code}`); return raw ? JSON.parse(raw) : null; }
  async loadAll() {
    const codes = (await this.cmd('SMEMBERS', 'vw4:rooms')) || [];
    const out = [];
    for (const code of codes) {
      const raw = await this.cmd('GET', `vw4:room:${code}`);
      if (!raw) { await this.cmd('SREM', 'vw4:rooms', code); continue; }
      try { out.push(JSON.parse(raw)); } catch (e) { console.warn(`[store] skipping unreadable save ${code}`); }
    }
    return out;
  }
}

export function createStore(env = process.env) {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) return new UpstashStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
  return new FileStore(env.DATA_DIR || new URL('../data/', import.meta.url).pathname);
}
