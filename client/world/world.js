// The walkable world: HD Moon campus + every building interior. Rendering, movement, jump,
// footprints, residents, vehicles, emotes and easter eggs. Never decides game outcomes.
import { TILE, MAP_W, MAP_H, ZONES, MAHMOUD_SPOT, SPAWN, FOUNTAIN, BUILDINGS, WAYPOINTS, WAY_EDGES, SHIP, SURFACES, buildCollision, isBlocked, mulberry32 } from '../../shared/map.js';
import { INTERIORS, CODE_NATION, interiorCollision } from '../../shared/interiors.js';
import { isSpecialPair, nationById } from '../../shared/data/nations.js';
import { roleById } from '../../shared/data/roles.js';
import { NPCS } from '../../shared/data/npcs.js';
import { campusArt as sharedCampusArt, buildSky, rover as drawRover, PW, PH, glow } from '../gfx/campusArt.js';
import { buildInterior } from '../gfx/interiorArt.js';
import { characterSheet, drawCharacter } from '../gfx/sprites.js';
import { drawPixelTextCentered, textWidth } from '../gfx/pixelfont.js';
import { audio } from '../audio.js';

const T = TILE;
const EMOJI = { wave: '👋', heart: '❤️', laugh: '😂', dance: '💃', thumbs: '👍', party: '🎉', kiss: '💋' };
const SPEED = 5.2;                 // tiles / s
const JUMP_V = 240, GRAV = 560;    // px/s, px/s² (moon gravity — floaty)
const MAHMOUD_LOOK = { special: 'mahmoud' };
const BABY_LOOK = { special: 'baby' };
const CAMPUS_NPCS = NPCS.filter((n) => n.scene === 'campus');
const AMBIENT_LOOKS = [
  { special: 'astronaut' }, { special: 'droid' },
  { appearance: { presentation: 'fem', skin: 3, hairStyle: 'bob', hairColor: 7, facial: 'none', eyewear: 'visor', accessory: 'none', outfit: 5 }, look: { topStyle: 'jacket', top: '#1b1a22', accent: '#ff4fd8', pants: '#2b2d42', extras: { chain: false } } },
  { appearance: { presentation: 'masc', skin: 1, hairStyle: 'buzz', hairColor: 6, facial: 'stubble', eyewear: 'none', accessory: 'headphones', outfit: 7 }, look: { topStyle: 'hoodie', top: '#3a2a6a', accent: '#5ff2ff', pantsStyle: 'cargo', pants: '#3a3f52' } },
  { special: 'astronaut', look: { accent: '#5ff2ff', top: '#f2d27a' } },
];
const DANCER_LOOKS = [
  { appearance: { presentation: 'fem', skin: 4, hairStyle: 'afro', hairColor: 0, facial: 'none', eyewear: 'none', accessory: 'earrings', outfit: 1 }, look: { topStyle: 'dress', top: '#ff4fd8' } },
  { appearance: { presentation: 'masc', skin: 0, hairStyle: 'short', hairColor: 5, facial: 'none', eyewear: 'sunglasses', accessory: 'none', outfit: 3 }, look: { topStyle: 'shirt', top: '#5ff2ff' } },
  { appearance: { presentation: 'fem', skin: 2, hairStyle: 'ponytail', hairColor: 7, facial: 'none', eyewear: 'none', accessory: 'none', outfit: 4 }, look: { topStyle: 'crop', top: '#f0c35a', pantsStyle: 'skirt', pants: '#1b1a22' } },
];

export function createWorld(container, { net, getView, onZone, onPrompt, onEnterEmbassy, onToast, isAllowedUpstairs }) {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;image-rendering:pixelated';
  container.appendChild(cv);
  const ctx = cv.getContext('2d');

  // ── scenes ──
  const campusArt = sharedCampusArt();
  const campus = { id: 'campus', art: campusArt, grid: buildCollision(), w: MAP_W, h: MAP_H, pw: PW, ph: PH };
  let sky = null;
  import('../ship/earthTex.js').then(({ renderGlobeImage }) => import('../ship/ship.js').then(({ prewarmEarth }) => { try { sky = buildSky(renderGlobeImage(prewarmEarth(), 500, { lon0: 10, lat0: 30 })); } catch { sky = buildSky(null); } }));
  const interiors = {};
  function sceneOf(id) {
    if (id === 'campus') return campus;
    if (!interiors[id]) {
      const I = INTERIORS[id];
      interiors[id] = { id, I, art: buildInterior(id), grid: interiorCollision(id), w: I.w, h: I.h, pw: I.w * T, ph: I.h * T, npcs: (I.npcs || []).map((n, i) => interiorNpc(n, i)) };
    }
    return interiors[id];
  }
  function interiorNpc(n, i) {
    const npc = NPCS.find((x) => x.id === n.id);
    let look;
    if (npc) look = npc.look;
    else if (n.id === 'ambassador') { const nat = nationById(n.nation); look = { special: 'ambassador', nationality: n.nation, appearance: { presentation: i % 2 ? 'fem' : 'masc', skin: { portugal: 1, macedonia: 0, poland: 0, morocco: 2 }[n.nation] ?? 1, hairStyle: 'short', hairColor: 6, facial: 'moustache', eyewear: 'glasses', accessory: 'none', outfit: 7 } }; void nat; }
    else if (n.id.startsWith('droid')) look = { special: 'droid' };
    else if (n.id.startsWith('dancer')) look = DANCER_LOOKS[(Number(n.id.slice(-1)) - 1) % DANCER_LOOKS.length];
    else look = AMBIENT_LOOKS[0];
    const label = npc ? npc.name.split(' ')[0].replace('“', '').toUpperCase() : n.id === 'ambassador' ? 'AMBASSADOR' : n.id === 'droid_dj' ? 'DJ BOT' : n.id === 'droid_roles' ? 'ROLE CLERK' : n.id === 'droid_hq' ? 'HQ BOT' : null;
    return { ...n, look, label, color: npc ? npc.color : '#9fd3ff', phase: i * 1.7 };
  }
  let scene = campus;

  const me = { x: SPAWN.x, y: SPAWN.y, dir: 'down', moving: false, z: 0, vz: 0, placed: false, stepAcc: 0, foot: 0 };
  const others = new Map();
  const bubbles = new Map();
  const dancing = new Map();
  const particles = [];
  const footprints = [];
  const pairState = new Map();
  const keys = new Set();
  let joy = { x: 0, y: 0 };
  let moveTarget = null;
  let W = 0, H = 0, scale = 2, dpr = 1;
  let lastSend = 0, lastSent = '';
  let activeZone = null, paused = false, raf = 0, lastT = performance.now();
  let objective = null;

  // ── ambient residents ──
  const rnd = mulberry32(99);
  const mahmoud = { x: MAHMOUD_SPOT.x, y: MAHMOUD_SPOT.y, dir: 'down', tx: MAHMOUD_SPOT.x, ty: MAHMOUD_SPOT.y, moving: false, next: 0, visible: true };
  const baby = { x: SHIP.ramp[0] + 1.5, y: SHIP.ramp[1] + 1.5, dir: 'down', moving: false, visible: false, path: [], mode: 'idle', bumpAt: 0 };
  const WALKER_WHO = [
    { talk: 'vega', name: 'Cmdr. Vega', title: 'Astronaut · solar panel repair', color: '#f4f6fb' },
    { talk: 'b0p', name: 'Unit B-0P', title: 'Campus service droid', color: '#5ff2ff' },
    { talk: 'nova', name: 'Nova', title: 'Moon local', color: '#ff4fd8' },
    { talk: 'rex', name: 'Rex', title: 'Moon local · club regular', color: '#c77dff' },
    { talk: 'orion', name: 'Cmdr. Orion', title: 'Astronaut · retired, suspicious', color: '#f0c35a' },
    { talk: 'z3d', name: 'Unit Z-3D', title: 'Campus security droid', color: '#5ff2ff' },
  ];
  const walkers = Array.from({ length: 6 }, (_, i) => { const k = Object.keys(WAYPOINTS)[(i * 5) % Object.keys(WAYPOINTS).length]; const look = AMBIENT_LOOKS[i % AMBIENT_LOOKS.length]; return { x: WAYPOINTS[k][0], y: WAYPOINTS[k][1], at: k, to: null, wait: rnd() * 3, dir: 'down', moving: false, look, foot: 0, who: { ...WALKER_WHO[i], look } }; });
  const INTERIOR_TALK = { droid_hq: 'hq_bot', droid_roles: 'role_clerk', droid_dj: 'dj_bot', dancer1: 'zara', dancer2: 'leo', dancer3: 'mia' };
  const INTERIOR_WHO = { droid_hq: ['HQ Bot', 'Mission control assistant'], droid_roles: ['Role Clerk', 'Role Market droid'], droid_dj: ['DJ Bot', 'Resident DJ, Club Cléopâtre'], dancer1: ['Zara', 'Dancer · ran away from ballet school'], dancer2: ['Leo', 'Dancer · engineer by day'], dancer3: ['Mia', 'Dancer · club regular'] };
  const drones = [0, 1, 2].map((i) => ({ phase: i * 2.1, cx: [30, 58, 42][i], cy: [30, 34, 50][i], r: [9, 12, 14][i] }));
  const roverPath = [[20.5, 17.6], [63.5, 17.6], [64.5, 42.7], [19.5, 42.7]];
  const vehicle = { seg: 0, t: 0, x: roverPath[0][0], y: roverPath[0][1], dir: 1 };
  const hovercars = [0, 1, 2].map((i) => ({ y: [10, 26, 48][i] * T, speed: [180, -240, 140][i], off: i * 900, color: ['#ff4fd8', '#5ff2ff', '#f0c35a'][i] }));

  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = container.clientWidth; H = container.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    computeScale();
  }
  function computeScale() {
    const forced = Number(new URLSearchParams(location.search).get('scale'));
    const css = forced || (W < 700 ? 1 : W < 1100 ? 1.5 : 2);
    scale = Math.max(1, Math.round(css * dpr));
    // small rooms: zoom in one more step when the whole room still fits on screen
    if (scene !== campus && !forced) { const up = scale + Math.max(1, Math.round(dpr / 2)); if (scene.pw * up <= cv.width - 40 * dpr && scene.ph * up <= cv.height - 140 * dpr) scale = up; }
    ctx.imageSmoothingEnabled = false;
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(container);

  // ── input (physical keys → works on QWERTY and AZERTY) ──
  const CODEMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const onKey = (e, down) => {
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (container.offsetParent === null) return;
    const dir = CODEMAP[e.code];
    if (dir) { down ? keys.add(dir) : keys.delete(dir); if (down) moveTarget = null; e.preventDefault(); }
    if (!down || paused) return;
    if (e.code === 'Space') { e.preventDefault(); jump(); }
    if ((e.code === 'KeyE' || e.code === 'KeyQ' || e.code === 'KeyF' || e.code === 'Enter') && activeZone) { e.preventDefault(); interact(); }
    const dig = /^Digit([1-7])$/.exec(e.code);
    if (dig) emote(Object.keys(EMOJI)[Number(dig[1]) - 1]);
    if (e.code === 'KeyK') emote('kiss');
  };
  const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const blurH = () => keys.clear();
  addEventListener('blur', blurH);

  // click / tap: talk to what you tap, or walk there
  cv.addEventListener('pointerdown', (e) => {
    if (paused) return;
    const r = cv.getBoundingClientRect();
    const wx = ((e.clientX - r.left) * dpr / scale + view.ox) / T, wy = ((e.clientY - r.top) * dpr / scale + view.oy) / T;
    let best = null, bestD = 1.6;
    for (const z of allZones()) { const d = Math.hypot(wx - z.x, wy - (z.y - 0.8)); if (d < bestD) { best = z; bestD = d; } }
    if (best && Math.hypot(me.x - best.x, me.y - best.y) < Math.max(best.r + 1.5, 3)) { activeZone = best; interact(); return; }
    moveTarget = { x: wx, y: wy + 0.3, until: performance.now() + 6000 };
    if (best) moveTarget.zone = best;
  });

  function jump() {
    if (me.z > 0 || paused) return;
    me.vz = JUMP_V; me.z = 0.01;
    audio.sfx('jump');
  }
  function interact() { if (activeZone && !paused) { audio.sfx('open'); handleZone(activeZone); } }
  function emote(e) {
    if (!EMOJI[e]) return;
    net.send({ t: 'emote', e });
    showEmote(net.pid, e);
  }
  function posOf(pid) { return pid === net.pid ? { ...me, scene: scene.id } : others.get(pid); }
  function showEmote(pid, e) {
    bubbles.set(pid, { emoji: EMOJI[e], until: performance.now() + 2600 });
    const p = posOf(pid);
    if (!p || p.scene !== scene.id) return;
    if (e === 'dance') dancing.set(pid, performance.now() + 4000);
    if (e === 'heart') burst(p.x, p.y - 1.6, ['❤️', '💖'], 6);
    if (e === 'party') confetti(p.x, p.y - 1.2, 40);
    if (e === 'kiss') {
      let target = null, best = 4;
      for (const [id, o] of others) { if (o.scene !== scene.id || id === pid) continue; const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < best) { best = d; target = o; } }
      if (pid !== net.pid && Math.hypot(me.x - p.x, me.y - p.y) < 4) target = me;
      for (let i = 0; i < 9; i++) particles.push({ kind: 'glyph', g: i % 2 ? '💋' : '💕', x: p.x, y: p.y - 1.6, vx: target ? (target.x - p.x) * 0.9 + (Math.random() - 0.5) : (Math.random() - 0.5) * 2, vy: target ? (target.y - p.y) * 0.9 - 1.2 : -1.5, life: 1.3 + i * 0.08, age: -i * 0.07 });
      audio.sfx('heart');
    }
  }

  function burst(x, y, glyphs, n) { for (let i = 0; i < n; i++) particles.push({ kind: 'glyph', g: glyphs[i % glyphs.length], x: x + (Math.random() - 0.5), y, vx: (Math.random() - 0.5) * 0.8, vy: -1.2 - Math.random() * 1.2, life: 1.6 + Math.random() * 0.6, age: 0 }); }
  function confetti(x, y, n) { const cols = ['#f0c35a', '#5ff2ff', '#ff4fd8', '#48e08f', '#ff7a5c']; for (let i = 0; i < n; i++) particles.push({ kind: 'bit', c: cols[i % cols.length], x, y, vx: (Math.random() - 0.5) * 6, vy: -3 - Math.random() * 4, life: 1.4 + Math.random(), age: 0, grav: 7 }); }
  function dust(x, y, n = 4, big = false) { for (let i = 0; i < n; i++) particles.push({ kind: 'dust', x: x + (Math.random() - 0.5) * 0.4, y: y + (Math.random() - 0.3) * 0.2, vx: (Math.random() - 0.5) * (big ? 2.4 : 0.8), vy: -(Math.random() * (big ? 0.8 : 0.3)), life: 0.7 + Math.random() * (big ? 0.8 : 0.4), age: 0, r: big ? 5 : 3 }); }
  function sparkle(x, y, n, color) { for (let i = 0; i < n; i++) particles.push({ kind: 'spark', c: color, x: x + (Math.random() - 0.5) * 1.5, y: y - Math.random() * 1.5, vx: (Math.random() - 0.5) * 0.6, vy: -0.4 - Math.random() * 0.6, life: 1 + Math.random(), age: 0 }); }

  // ── zones ──
  function npcZonesCampus() {
    return CAMPUS_NPCS.map((n) => ({ id: 'npc_' + n.id, kind: 'npc', npc: n.id, label: `Talk to ${n.name}`, x: n.pair ? n.x + 0.55 : n.x, y: n.y + 1.1, r: n.pair ? 1.9 : 1.6 }));
  }
  function allZones() {
    if (scene === campus) {
      const z = [...ZONES, ...npcZonesCampus()];
      if (mahmoud.visible) z.push({ id: 'mahmoud', kind: 'mahmoud', label: 'Talk to Mahmoud', x: mahmoud.x, y: mahmoud.y + 1, r: 1.8 });
      if (baby.visible) z.push({ id: 'baby', kind: 'baby', label: 'Talk to Baby Mahmoud', x: baby.x, y: baby.y + 0.8, r: 1.6 });
      walkers.forEach((w, i) => z.push({ id: 'walker' + i, kind: 'npc', npc: w.who.talk, who: w.who, label: `Talk to ${w.who.name}`, x: w.x, y: w.y + 0.9, r: 1.3 }));
      return z;
    }
    const I = scene.I;
    const z = [...(I.zones || [])];
    if (I.exit) z.push({ id: 'exit', kind: 'exit', label: `Leave: back to the campus`, x: I.exit.x, y: I.exit.y - 0.2, r: 0.95 });
    if (I.stairs) z.push({ id: 'stairs', kind: 'stairs', label: I.stairs.label, x: I.stairs.x, y: I.stairs.y, r: 1.4 });
    for (const n of scene.npcs) if (INTERIOR_TALK[n.id]) {
      const [name, title] = INTERIOR_WHO[n.id];
      z.push({ id: 'talk_' + n.id, kind: 'npc', npc: INTERIOR_TALK[n.id], who: { name, title, color: n.color === '#9fd3ff' ? '#5ff2ff' : n.color, look: n.look }, label: `Talk to ${name}`, x: n.x, y: n.y + 1, r: n.id === 'droid_roles' ? 1.6 : 1.2 });
    }
    return z;
  }

  function handleZone(z) {
    if (z.kind === 'door') {
      const I = INTERIORS[z.interior];
      if (!I) return;
      return enterScene(z.interior, I.spawn.x, I.spawn.y, I.spawn.dir);
    }
    if (z.kind === 'exit') {
      const b = BUILDINGS.find((x) => x.id === scene.I.outside);
      return enterScene('campus', b.door[0] + 0.5, b.door[1] + 1.3, 'down');
    }
    if (z.kind === 'stairs') {
      const target = INTERIORS[scene.I.stairs.to];
      if (target.private && !isAllowedUpstairs(target.private)) { onToast(`🔒 Private floor — only for this embassy's crew member and their partner.`, 'bad'); audio.sfx('error'); return; }
      const a = scene.I.stairs.arrive;
      return enterScene(target.id, a.x, a.y, a.dir);
    }
    if (z.kind === 'bed') { burst(me.x, me.y - 1.4, ['💤', '❤️', '✨'], 8); onToast('So cosy… you feel ready to fight for your holiday. 💤', 'good'); return; }
    if (z.kind === 'fire') { sparkle(me.x, me.y - 1, 12, '#ffb070'); onToast('Warm hands, warm heart. 🔥', 'good'); return; }
    if (z.kind === 'music') { burst(me.x, me.y - 1.6, ['🎵', '🎶', '💃'], 6); onToast('The record player crackles a slow song… 🎶', 'good'); return; }
    if (z.kind === 'dance') { emote('dance'); confetti(me.x, me.y - 1.6, 30); return; }
    onZone(z);
  }

  function enterScene(id, x, y, dir) {
    const prev = scene.id;
    scene = sceneOf(id);
    me.x = x; me.y = y; me.dir = dir; me.z = 0; me.vz = 0;
    keys.clear(); moveTarget = null;
    computeScale();
    activeZone = null; onPrompt(null);
    audio.sfx('door');
    sendPos(true);
    if (id.startsWith('emb_') && id.endsWith('_1') && !prev.startsWith('emb_')) onEnterEmbassy(CODE_NATION[id.split('_')[1]]);
    if (id !== 'campus') onToast(`📍 ${scene.I.name}`, 'info');
    audio.music(id === 'campus' ? 'campus' : scene.I.music || 'campus');
  }

  // ── network ──
  function setPositions(list) {
    const seen = new Set();
    for (const [pid, x, y, dir, moving, scn, jumpH] of list) {
      seen.add(pid);
      if (pid === net.pid) {
        if (!me.placed) { me.placed = true; if (scn === 'campus') { me.x = x; me.y = y; } }
        continue;
      }
      const o = others.get(pid);
      if (!o || o.scene !== scn) others.set(pid, { x, y, tx: x, ty: y, dir, moving: !!moving, scene: scn, z: (jumpH || 0) * 52, stepAcc: 0, foot: 0 });
      else Object.assign(o, { tx: x, ty: y, dir, moving: !!moving, z: (jumpH || 0) * 52 });
    }
    for (const pid of others.keys()) if (!seen.has(pid)) others.delete(pid);
  }
  function sendPos(force) {
    const sig = `${me.x.toFixed(2)},${me.y.toFixed(2)},${me.dir},${me.moving},${scene.id},${me.z > 0 ? 1 : 0}`;
    const now = performance.now();
    if (!force && (now - lastSend < 80 || sig === lastSent)) return;
    lastSend = now; lastSent = sig;
    net.send({ t: 'pos', x: me.x, y: me.y, dir: me.dir, moving: me.moving, scene: scene.id, jump: Math.min(1, me.z / 52) });
  }

  // ── simulation ──
  const paved = new Uint8Array(MAP_W * MAP_H);
  for (const s of SURFACES) for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) paved[y * MAP_W + x] = 1;
  const regolith = (x, y) => scene === campus && !paved[Math.floor(y) * MAP_W + Math.floor(x)];

  function blockedAt(x, y) {
    if (scene === campus) return isBlocked(scene.grid, Math.floor(x), Math.floor(y));
    return x < 0 || y < 0 || x >= scene.w || y >= scene.h || scene.grid[Math.floor(y) * scene.w + Math.floor(x)] === 1;
  }
  function solidBodies() {
    const list = [];
    if (scene === campus) {
      if (mahmoud.visible) list.push(mahmoud);
      for (const n of CAMPUS_NPCS) { list.push(n); if (n.pair) list.push({ x: n.x + 1.1, y: n.y }); }
      for (const w of walkers) list.push(w);
    } else for (const n of scene.npcs) list.push(n);
    return list;
  }
  function tryMove(dx, dy) {
    const nx = me.x + dx, ny = me.y + dy;
    const hw = 0.3;
    const pts = [[nx - hw, ny - 0.22], [nx + hw, ny - 0.22], [nx - hw, ny + 0.06], [nx + hw, ny + 0.06]];
    if (pts.some(([x, y]) => blockedAt(x, y))) return false;
    for (const b of solidBodies()) { const d0 = Math.hypot(me.x - b.x, me.y - b.y), d1 = Math.hypot(nx - b.x, ny - b.y); if (d1 < 0.62 && d1 < d0) return false; }
    me.x = nx; me.y = ny;
    return true;
  }

  function update(dt, now) {
    let mx = 0, my = 0;
    if (!paused) {
      if (keys.has('up')) my -= 1; if (keys.has('down')) my += 1; if (keys.has('left')) mx -= 1; if (keys.has('right')) mx += 1;
      mx += joy.x; my += joy.y;
      if (moveTarget && !mx && !my) {
        const dx = moveTarget.x - me.x, dy = moveTarget.y - me.y, d = Math.hypot(dx, dy);
        if (d < 0.25 || now > moveTarget.until) { const z = moveTarget.zone; moveTarget = null; if (z && Math.hypot(me.x - z.x, me.y - z.y) < z.r + 0.6) { activeZone = z; interact(); } }
        else { mx = dx / d; my = dy / d; }
      }
    }
    const len = Math.hypot(mx, my);
    me.moving = len > 0.18;
    if (me.moving) {
      mx /= Math.max(1, len); my /= Math.max(1, len);
      me.dir = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'right' : 'left') : (my > 0 ? 'down' : 'up');
      const step = SPEED * dt * (me.z > 0 ? 1.15 : 1);
      const okx = tryMove(mx * step, 0), oky = tryMove(0, my * step);
      if (moveTarget && !okx && !oky) moveTarget = null;
      me.stepAcc += dt;
      if (me.z === 0 && me.stepAcc > 0.16) { me.stepAcc = 0; me.foot ^= 1; addFootprint(me, now); }
    }
    if (me.z > 0) {
      me.vz -= GRAV * dt; me.z += me.vz * dt;
      if (me.z <= 0) { me.z = 0; me.vz = 0; dust(me.x, me.y, 10, true); audio.sfx('land'); addFootprint(me, now, true); }
    }
    sendPos(false);
    for (const o of others.values()) {
      const k = Math.min(1, dt * 12);
      const ox = o.x, oy = o.y;
      o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k;
      if (o.scene === scene.id && o.moving && !o.z) { o.stepAcc += dt; if (o.stepAcc > 0.16 && Math.hypot(o.x - ox, o.y - oy) > 0.001) { o.stepAcc = 0; o.foot ^= 1; addFootprint(o, now); } }
    }
    if (scene === campus) updateNPCs(dt, now);
    else if (Math.random() < dt * 3 && scene.I.lights === 'club') sparkle(6 + Math.random() * 12, 6 + Math.random() * 5, 1, Math.random() < 0.5 ? '#ff4fd8' : '#5ff2ff');
    // zones
    let best = null, bestD = 1e9;
    for (const z of allZones()) { const d = Math.hypot(me.x - z.x, me.y - z.y); if (d < z.r && d < bestD) { best = z; bestD = d; } }
    if ((best && best.id) !== (activeZone && activeZone.id)) { activeZone = best; onPrompt(best); }
    socialEggs(now);
    for (const p of particles) { p.age += dt; if (p.age < 0) continue; p.x += p.vx * dt; p.y += p.vy * dt; if (p.grav) p.vy += p.grav * dt; }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].age > particles[i].life) particles.splice(i, 1);
    if (scene === campus && Math.random() < dt * 40) particles.push({ kind: 'water', x: FOUNTAIN.cx + (Math.random() - 0.5) * 0.4, y: FOUNTAIN.cy - 0.4, vx: (Math.random() - 0.5) * 2, vy: -3 - Math.random() * 1.4, life: 1.4, age: 0, grav: 3.8 });
    while (footprints.length && now - footprints[0].t > 45000) footprints.shift();
  }

  function addFootprint(p, now, both = false) {
    if (scene !== campus || (p.scene && p.scene !== 'campus')) return;
    if (!regolith(p.x, p.y)) return;
    const side = p.dir === 'up' || p.dir === 'down' ? 0.14 : 0;
    const vside = p.dir === 'left' || p.dir === 'right' ? 0.08 : 0;
    const s = p.foot ? 1 : -1;
    footprints.push({ x: p.x + side * s, y: p.y + vside * s, dir: p.dir, t: now });
    if (both) footprints.push({ x: p.x - side * s, y: p.y - vside * s, dir: p.dir, t: now });
    if (footprints.length > 900) footprints.shift();
    if (Math.random() < 0.6) dust(p.x, p.y, 2);
  }

  function socialEggs(now) {
    const v = getView();
    if (!v) return;
    const meP = v.players.find((p) => p.id === net.pid);
    for (const p of v.players) {
      if (p.id === net.pid || !p.onboarded) continue;
      const o = others.get(p.id);
      if (!o || o.scene !== scene.id) continue;
      const d = Math.hypot(o.x - me.x, o.y - me.y);
      const st = pairState.get(p.id) || { near: false, next: 0 };
      const special = meP && (isSpecialPair(meP.nationality, p.nationality) || meP.couple === p.id);
      if (d < 2 && (!st.near || (special && now > st.next))) {
        const mx2 = (o.x + me.x) / 2, my2 = (o.y + me.y) / 2 - 1.8;
        if (special) { burst(mx2, my2, ['💕', '😊', '💋', '😄', '💖'], 7); audio.sfx('heart'); st.next = now + 4000; }
        else if (!st.near) burst(mx2, my2, ['👋', '✨', '🙂'], 3);
      }
      st.near = d < 2.6; st.special = special;
      pairState.set(p.id, st);
    }
    const dancers = [...dancing.entries()].filter(([, until]) => until > now).map(([pid]) => posOf(pid)).filter((p) => p && p.scene === scene.id);
    if (dancers.length >= 3 && (!socialEggs.last || now - socialEggs.last > 3000)) {
      const cx = dancers.reduce((a, p) => a + p.x, 0) / dancers.length, cy = dancers.reduce((a, p) => a + p.y, 0) / dancers.length;
      if (dancers.every((p) => Math.hypot(p.x - cx, p.y - cy) < 4)) { confetti(cx, cy - 2, 60); socialEggs.last = now; audio.sfx('coin'); }
    }
  }

  function updateNPCs(dt, now) {
    const v = getView();
    const phase = v ? v.phase : 'lobby';
    mahmoud.visible = phase === 'lobby';
    if (now > mahmoud.next) { mahmoud.next = now + 3000 + Math.random() * 4000; const a = Math.random() * Math.PI * 2; mahmoud.tx = MAHMOUD_SPOT.x + Math.cos(a) * 1.4; mahmoud.ty = MAHMOUD_SPOT.y + Math.sin(a) * 0.4; }
    stepToward(mahmoud, mahmoud.tx, mahmoud.ty, 1.8, dt);
    if (!mahmoud.moving && Math.hypot(me.x - mahmoud.x, me.y - mahmoud.y) < 4) mahmoud.dir = faceDir(mahmoud, me);
    for (const a of walkers) {
      if (!a.to) {
        if (a.wait > 0) { a.wait -= dt; a.moving = false; continue; }
        const nexts = WAY_EDGES.filter((e) => e.includes(a.at)).map((e) => (e[0] === a.at ? e[1] : e[0]));
        a.to = nexts[Math.floor(Math.random() * nexts.length)];
      }
      if (Math.hypot(me.x - a.x, me.y - a.y) < 0.9) { a.moving = false; a.dir = faceDir(a, me); continue; } // politely wait
      const [tx, ty] = WAYPOINTS[a.to];
      if (stepToward(a, tx, ty, 2.2, dt)) { a.at = a.to; a.to = null; a.wait = Math.random() < 0.4 ? 1 + Math.random() * 4 : 0; }
      if (a.moving) { a.stepAcc = (a.stepAcc || 0) + dt; if (a.stepAcc > 0.22) { a.stepAcc = 0; a.foot ^= 1; addFootprint(a, now); } }
    }
    const [ax, ay] = roverPath[vehicle.seg], [bx, by] = roverPath[(vehicle.seg + 1) % roverPath.length];
    const segLen = Math.hypot(bx - ax, by - ay);
    const stop = Math.hypot(me.x - vehicle.x, me.y - vehicle.y) < 1.8;
    if (!stop) vehicle.t += (3 * dt) / segLen;
    if (vehicle.t >= 1) { vehicle.t = 0; vehicle.seg = (vehicle.seg + 1) % roverPath.length; }
    vehicle.x = ax + (bx - ax) * vehicle.t; vehicle.y = ay + (by - ay) * vehicle.t;
    vehicle.dir = bx > ax ? 1 : bx < ax ? -1 : vehicle.dir;
    if (!stop && Math.random() < dt * 6) dust(vehicle.x - vehicle.dir * 0.9, vehicle.y, 1);
    updateBaby(dt, now, phase);
  }

  function updateBaby(dt, now, phase) {
    const g = getView()?.game;
    const show = phase === 'market' || phase === 'ended' || (phase === 'game' && g && g.stage === 'exit');
    baby.visible = show && scene === campus;
    if (!show) { baby.mode = 'idle'; return; }
    if (scene !== campus) return;
    if (baby.mode === 'idle') { baby.mode = 'run'; baby.x = SHIP.ramp[0] + 4; baby.y = SHIP.ramp[1] + 2.5; }
    if (baby.mode === 'run') {
      if (stepToward(baby, me.x + 0.6, me.y + 0.2, 4.2, dt) || Math.hypot(baby.x - me.x, baby.y - me.y) < 0.9) {
        baby.mode = 'bumped'; baby.bumpAt = now; burst(me.x, me.y - 1.5, ['💥', '⭐', '😵'], 6); audio.sfx('bump');
        onZone({ id: 'baby_bump', kind: 'baby_bump' });
      }
    } else if (baby.mode === 'bumped') {
      if (now - baby.bumpAt > 2600) { baby.mode = 'guide'; baby.path = ['W', 'V', 'U', 'Y', 'T'].map((k) => WAYPOINTS[k]).concat([[11.5, 54.2]]); }
    } else if (baby.mode === 'guide') {
      const target = baby.path[0];
      if (target) {
        const near = Math.hypot(me.x - baby.x, me.y - baby.y) < 5;
        if (near && stepToward(baby, target[0], target[1], 3.2, dt)) baby.path.shift();
        if (!near) { baby.moving = false; baby.dir = faceDir(baby, me); }
      } else baby.mode = 'wait';
    } else { baby.moving = false; if (Math.hypot(me.x - baby.x, me.y - baby.y) < 5) baby.dir = faceDir(baby, me); }
  }

  function stepToward(n, tx, ty, speed, dt) {
    const dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy);
    n.moving = d > 0.05;
    if (!n.moving) return true;
    const s = Math.min(d, speed * dt);
    n.x += (dx / d) * s; n.y += (dy / d) * s;
    n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    return d <= speed * dt;
  }
  const faceDir = (n, p) => (Math.abs(p.x - n.x) > Math.abs(p.y - n.y) ? (p.x > n.x ? 'right' : 'left') : (p.y > n.y ? 'down' : 'up'));

  // ── rendering ──
  const view = { ox: 0, oy: 0 };
  const cam = { x: 0, y: 0, scene: null, t: 0 };
  function render(now) {
    const sc = scene;
    const vw = cv.width / scale, vh = cv.height / scale;
    // smooth camera: eases towards the player, snaps on scene changes / teleports
    const tx = me.x * T, ty = (me.y - 0.6) * T;
    const cdt = Math.min(0.1, (now - (cam.t || now)) / 1000); cam.t = now;
    if (cam.scene !== sc.id || Math.hypot(tx - cam.x, ty - cam.y) > 320) { cam.x = tx; cam.y = ty; cam.scene = sc.id; }
    else { const k = 1 - Math.exp(-cdt * 9); cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; }
    let ox = cam.x - vw / 2, oy = cam.y - vh / 2;
    if (sc.pw > vw) ox = Math.max(0, Math.min(sc.pw - vw, ox)); else ox = (sc.pw - vw) / 2;
    const padB = Math.round(100 * dpr / scale); // keep the bottom of the room above the HUD prompt
    if (sc.ph + padB > vh) oy = Math.max(sc === campus ? -140 : -20, Math.min(sc.ph - vh + padB, oy)); else oy = (sc.ph - vh) / 2 + padB / 2;
    ox = Math.round(ox * scale) / scale; oy = Math.round(oy * scale) / scale; // snap to device pixels
    view.ox = ox; view.oy = oy;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = sc === campus ? '#02030a' : '#05040a';
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (sc === campus && sky) {
      const s = scale * 0.75;
      ctx.drawImage(sky, Math.round(-ox * 0.2 * scale - 200 * scale), Math.round((-oy * 0.3 - 560) * s), sky.width * s * 1.2, sky.height * s * 1.2);
      shootingStars(now);
    }
    ctx.setTransform(scale, 0, 0, scale, -ox * scale, -oy * scale);
    // only the visible part of the big pre-rendered layers (much cheaper on phones)
    const vx0 = Math.max(0, Math.floor(ox) - 2), vy0 = Math.max(0, Math.floor(oy) - 2);
    const vx1 = Math.min(sc.pw, Math.ceil(ox + vw) + 2), vy1 = Math.min(sc.ph, Math.ceil(oy + vh) + 2);
    if (vx1 > vx0 && vy1 > vy0) ctx.drawImage(sc.art.ground, vx0, vy0, vx1 - vx0, vy1 - vy0, vx0, vy0, vx1 - vx0, vy1 - vy0);
    const inView = (x, y, m = 260) => x > ox - m && x < ox + vw + m && y > oy - m && y < oy + vh + m * 1.6;

    if (sc === campus) {
      sc.art.groundFx(ctx, now);
      for (const f of footprints) {
        if (!inView(f.x * T, f.y * T, 20)) continue;
        const age = (now - f.t) / 45000;
        ctx.fillStyle = `rgba(36,38,48,${0.6 * (1 - age)})`;
        const fx = f.x * T, fy = f.y * T;
        if (f.dir === 'up' || f.dir === 'down') { ctx.fillRect(Math.round(fx - 2), Math.round(fy - 4), 4, 7); ctx.fillStyle = `rgba(150,156,175,${0.35 * (1 - age)})`; ctx.fillRect(Math.round(fx - 2), Math.round(fy + 3), 4, 1); }
        else { ctx.fillRect(Math.round(fx - 4), Math.round(fy - 2), 7, 4); ctx.fillStyle = `rgba(150,156,175,${0.35 * (1 - age)})`; ctx.fillRect(Math.round(fx - 4), Math.round(fy + 2), 7, 1); }
      }
    }

    // y-sorted world
    const v = getView();
    const ents = [];
    const frameOf = (moving, seed = 0) => (moving ? [1, 0, 2, 0][Math.floor(now / 110 + seed) % 4] : 0);
    const plates = [];
    const drawChar = (look, pos, dirOverride, extraHop = 0, seed = 0) => {
      const sheet = characterSheet(look);
      const px = Math.round(pos.x * T * scale) / scale, py = Math.round(pos.y * T * scale) / scale;
      const z = Math.round(pos.z || 0);
      const sh = Math.max(0.45, 1 - z / 80);
      ctx.fillStyle = `rgba(0,0,0,${0.38 * sh})`; ctx.beginPath(); ctx.ellipse(px, py, 11 * sh, 4 * sh, 0, 0, Math.PI * 2); ctx.fill();
      const idleBob = !pos.moving && !z && Math.floor(now / 600 + seed) % 2 ? 1 : 0;
      drawCharacter(ctx, sheet, dirOverride || pos.dir, z > 0 ? 1 : frameOf(pos.moving, seed), px, py - z - extraHop + idleBob, 1, scale);
    };
    if (v) {
      for (const p of v.players) {
        if (!p.onboarded) continue;
        const isMe = p.id === net.pid;
        const pos = isMe ? me : others.get(p.id);
        if (!pos || (!isMe && pos.scene !== sc.id)) continue;
        if (!isMe && v.phase === 'game') continue;
        const dance = (dancing.get(p.id) || 0) > now;
        ents.push({ y: pos.y * T, draw: () => drawChar({ appearance: p.appearance, nationality: p.nationality, role: p.role }, pos, dance ? ['down', 'right', 'up', 'left'][Math.floor(now / 200) % 4] : null, dance ? Math.abs(Math.sin(now / 120)) * 8 : 0) });
        plates.push({ p, x: pos.x * T, y: pos.y * T - 58 - (pos.z || 0), isMe });
      }
    }
    if (sc === campus) {
      for (const b of sc.art.buildings) if (b.x < ox + vw + 20 && b.x + b.canvas.width > ox - 20 && b.y < oy + vh + 20 && b.y + b.canvas.height > oy - 20) ents.push({ y: b.sortY, draw: () => ctx.drawImage(b.canvas, b.x, b.y) });
      for (const p of sc.art.props) if (p.cx === undefined || inView(p.cx, p.cy)) ents.push({ y: p.y, draw: () => p.draw(ctx, now) });
      if (mahmoud.visible) ents.push({ y: mahmoud.y * T, draw: () => drawChar(MAHMOUD_LOOK, mahmoud) });
      if (baby.visible) ents.push({ y: baby.y * T, draw: () => drawChar(BABY_LOOK, baby, null, baby.mode === 'bumped' ? Math.abs(Math.sin((now - baby.bumpAt) / 90)) * 6 : 0) });
      for (const a of walkers) if (inView(a.x * T, a.y * T, 80)) ents.push({ y: a.y * T, draw: () => drawChar(a.look, a, null, 0, a.x) });
      for (const a of walkers) if (Math.hypot(me.x - a.x, me.y - a.y) < 3) plates.push({ npcTag: a.who.name.toUpperCase(), color: a.who.color, x: a.x * T, y: a.y * T - 58 });
      for (const n of CAMPUS_NPCS) {
        const near = Math.hypot(me.x - n.x, me.y - n.y) < 4;
        ents.push({ y: n.y * T, draw: () => drawChar(n.look, { x: n.x, y: n.y, dir: near ? faceDir(n, me) : n.dir, moving: false }, null, 0, n.x) });
        if (n.pair) ents.push({ y: n.y * T, draw: () => drawChar(n.look2, { x: n.x + 1.1, y: n.y, dir: near ? faceDir({ x: n.x + 1.1, y: n.y }, me) : 'left', moving: false }, null, 0, n.y) });
      }
      ents.push({ y: vehicle.y * T + 10, draw: () => drawRover(ctx, Math.round(vehicle.x * T), Math.round(vehicle.y * T + 10), vehicle.dir, now) });
    } else {
      for (const s of sc.art.sprites) ents.push({ y: s.y, draw: () => s.draw(ctx) });
      for (const n of sc.npcs) {
        const near = Math.hypot(me.x - n.x, me.y - n.y) < 4;
        const dir = n.dance ? ['down', 'right', 'up', 'left'][Math.floor(now / 260 + n.phase) % 4] : near ? faceDir(n, me) : n.dir;
        ents.push({ y: n.y * T, draw: () => drawChar(n.look, { x: n.x, y: n.y, dir, moving: !!n.dance }, null, n.dance ? Math.abs(Math.sin(now / 140 + n.phase)) * 6 : 0, n.phase) });
      }
    }
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw();

    for (const p of particles) {
      if (p.age < 0) continue;
      const a = 1 - p.age / p.life;
      if (p.kind === 'water') { ctx.fillStyle = `rgba(190,240,255,${a})`; ctx.fillRect(p.x * T, p.y * T, 2, 3); }
      if (p.kind === 'dust') { ctx.fillStyle = `rgba(205,208,220,${0.45 * a})`; ctx.beginPath(); ctx.arc(p.x * T, p.y * T, p.r + (1 - a) * 4, 0, Math.PI * 2); ctx.fill(); }
    }

    // lighting: multiply the light map, then additive glows, then emissive neon on top
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    { const k = sc.art.lightmap.width / sc.pw; if (vx1 > vx0 && vy1 > vy0) ctx.drawImage(sc.art.lightmap, vx0 * k, vy0 * k, (vx1 - vx0) * k, (vy1 - vy0) * k, vx0, vy0, vx1 - vx0, vy1 - vy0); }
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'lighter';
    for (const l of sc.art.lights) if (l.r <= 160 && l.x > ox - 200 && l.x < ox + vw + 200 && l.y > oy - 200 && l.y < oy + vh + 200) glow(ctx, l.x, l.y, l.r * 0.35, l.color, 0.12 + 0.04 * Math.sin(now / 500 + l.x));
    glow(ctx, me.x * T, (me.y - 0.8) * T, 70, '170,200,255', 0.1);
    ctx.globalCompositeOperation = 'source-over';
    if (sc === campus) {
      for (const b of sc.art.buildings) if (b.x < ox + vw + 200 && b.x + b.canvas.width > ox - 200 && b.y < oy + vh + 200 && b.y + b.canvas.height > oy - 260) b.emissive(ctx, now);
      for (const p of sc.art.props) if (p.emissive && (p.cx === undefined || inView(p.cx, p.cy))) p.emissive(ctx, now);
      for (const d of drones) drawDrone(d, now);
      for (const h of hovercars) drawHovercar(h, now);
    } else sc.art.emissive(ctx, now);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of particles) {
      if (p.age < 0) continue;
      const a = 1 - p.age / p.life;
      if (p.kind === 'glyph') { ctx.globalAlpha = Math.min(1, a * 1.5); ctx.font = '18px serif'; ctx.fillText(p.g, p.x * T, p.y * T); }
      if (p.kind === 'bit') { ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.fillRect(p.x * T, p.y * T, 4, 4); }
      if (p.kind === 'spark') { ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.fillRect(p.x * T, p.y * T, 3, 3); }
    }
    ctx.globalAlpha = 1;

    for (const n of plates) {
      if (n.npcTag) { nameTag(n.x, n.y, n.npcTag, n.color, 'rgba(10,8,24,.82)'); continue; }
      const role = roleById(n.p.role);
      const col = n.isMe ? '#f0c35a' : n.p.connected ? '#ffffff' : '#8a93a8';
      nameTag(n.x, n.y, (n.p.name || '?').toUpperCase().slice(0, 12), col, 'rgba(5,8,20,.72)');
      const w = textWidth(n.p.name.slice(0, 12), 2) + 8;
      ctx.font = '14px serif';
      if (role && role.id !== 'rookie') ctx.fillText(role.icon, Math.round(n.x + w / 2 + 10), Math.round(n.y + 5));
      const badges = (n.p.vip ? '👑' : '') + (n.p.bracelet ? '🌸' : '');
      if (badges) { ctx.font = '12px serif'; ctx.fillText(badges, Math.round(n.x - w / 2 - 12), Math.round(n.y + 5)); }
      // in the Control Tower: what this player won or lost at the arcade on this Moon visit
      if (scene.id === 'in_tower' && n.p.arcade && n.p.arcade.played) {
        const net = n.p.arcade.net || 0, lbl = `${net > 0 ? '+' : ''}${net} VC`;
        const bw = textWidth(lbl, 1) + 8, bx = Math.round(n.x - bw / 2), by = Math.round(n.y - 16);
        ctx.fillStyle = net > 0 ? 'rgba(20,70,40,.9)' : net < 0 ? 'rgba(90,20,30,.9)' : 'rgba(30,34,50,.9)'; ctx.fillRect(bx, by, bw, 10);
        drawPixelTextCentered(ctx, lbl, Math.round(n.x), by + 2, net > 0 ? '#7dffb8' : net < 0 ? '#ff9a9a' : '#c9ced9', 1);
      }
      const b = bubbles.get(n.p.id);
      if (b && b.until > now) { const bx = n.x, by = n.y - 22; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(bx - 16, by - 15, 32, 28, 8); ctx.fill(); ctx.beginPath(); ctx.moveTo(bx - 4, by + 13); ctx.lineTo(bx + 4, by + 13); ctx.lineTo(bx, by + 19); ctx.fill(); ctx.font = '20px serif'; ctx.fillText(b.emoji, bx, by); }
    }
    if (sc === campus) {
      if (mahmoud.visible) nameTag(mahmoud.x * T, mahmoud.y * T - 58, 'MAHMOUD', '#f0c35a', 'rgba(40,28,6,.82)');
      if (baby.visible) nameTag(baby.x * T, baby.y * T - 44, 'BABY MAHMOUD', '#ffd0f0', 'rgba(60,10,50,.82)');
      for (const n of CAMPUS_NPCS) nameTag((n.pair ? n.x + 0.55 : n.x) * T, n.y * T - 58, n.pair ? 'ALICE & NICO' : n.name.toUpperCase(), n.color, 'rgba(10,8,24,.82)');
    } else for (const n of sc.npcs) if (n.label && Math.hypot(me.x - n.x, me.y - n.y) < 5.5) nameTag(n.x * T, n.y * T - 58, n.label, n.color, 'rgba(10,8,24,.82)');

    if (activeZone && activeZone.x) { const zx = activeZone.x * T, zy = activeZone.y * T - 56 + Math.sin(now / 200) * 3; ctx.fillStyle = '#f0c35a'; ctx.beginPath(); ctx.moveTo(zx - 7, zy); ctx.lineTo(zx + 7, zy); ctx.lineTo(zx, zy + 9); ctx.fill(); }
    if (objective && objective.scene === sc.id) {
      const zx = objective.x * T, zy = objective.y * T - 76 + Math.sin(now / 250) * 5;
      ctx.fillStyle = 'rgba(95,242,255,.95)'; ctx.beginPath(); ctx.moveTo(zx - 10, zy); ctx.lineTo(zx + 10, zy); ctx.lineTo(zx, zy + 14); ctx.fill();
      ctx.strokeStyle = 'rgba(95,242,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(objective.x * T, objective.y * T, 18 + (now / 40) % 18, 9 + ((now / 40) % 18) / 2, 0, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (objective && objective.scene === sc.id) {
      const sx = (objective.x * T - ox) * scale, sy = (objective.y * T - oy) * scale;
      const m = 44 * dpr;
      if (sx < m || sy < m || sx > cv.width - m || sy > cv.height - m) {
        const cx = cv.width / 2, cy = cv.height / 2, ang = Math.atan2(sy - cy, sx - cx);
        const ex = Math.max(m, Math.min(cv.width - m, cx + Math.cos(ang) * cv.width)), ey = Math.max(m + 50 * dpr, Math.min(cv.height - m - 60 * dpr, cy + Math.sin(ang) * cv.height));
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
        ctx.fillStyle = 'rgba(95,242,255,.95)'; ctx.beginPath(); ctx.moveTo(18 * dpr, 0); ctx.lineTo(-9 * dpr, -12 * dpr); ctx.lineTo(-9 * dpr, 12 * dpr); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    // cinematic vignette + scanline sheen
    const vg = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.4, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,10,0)'); vg.addColorStop(1, 'rgba(0,0,10,.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, cv.width, cv.height);
  }

  function nameTag(x, y, label, col, bg) {
    const w = textWidth(label, 2) + 8;
    ctx.fillStyle = bg; ctx.fillRect(Math.round(x - w / 2), Math.round(y - 4), w, 18);
    ctx.fillStyle = col; ctx.fillRect(Math.round(x - w / 2), Math.round(y + 13), w, 1);
    drawPixelTextCentered(ctx, label, Math.round(x), Math.round(y), col, 2);
  }

  function drawDrone(d, now) {
    const t = now / 4000 + d.phase;
    const x = (d.cx + Math.cos(t) * d.r) * T, y = (d.cy + Math.sin(t * 2) * d.r * 0.4) * T;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x + 10, y + 56, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9ced9'; ctx.fillRect(x - 10, y - 4, 20, 8); ctx.fillStyle = '#3c4150'; ctx.fillRect(x - 16, y - 8, 8, 2); ctx.fillRect(x + 8, y - 8, 8, 2);
    ctx.fillStyle = Math.floor(now / 300) % 2 ? '#ff5050' : '#50ff8a'; ctx.fillRect(x - 2, y + 4, 4, 2);
    ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#bff6ff'; ctx.beginPath(); ctx.moveTo(x - 4, y + 6); ctx.lineTo(x + 4, y + 6); ctx.lineTo(x + 26, y + 60); ctx.lineTo(x - 18, y + 60); ctx.fill(); ctx.restore();
  }
  function drawHovercar(h, now) {
    const span = PW + 1200;
    const x = ((((now * h.speed) / 1000 + h.off) % span) + span) % span - 600;
    const y = h.y + Math.sin(now / 700 + h.off) * 6;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x, y + 90, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2f3c'; ctx.beginPath(); ctx.ellipse(x, y, 40, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7fe8ff'; ctx.fillRect(x - 12, y - 10, 24, 6);
    ctx.fillStyle = h.color; ctx.fillRect(x - 38, y + 2, 76, 2);
    glow(ctx, x + (h.speed > 0 ? -40 : 40), y, 30, h.color === '#ff4fd8' ? '255,79,216' : h.color === '#5ff2ff' ? '95,242,255' : '240,195,90', 0.5);
  }
  function shootingStars(now) {
    const p = (now / 6200) % 1;
    if (p < 0.1) {
      const k = p / 0.1, x = (200 + 1200 * k) * dpr, y = (30 + 80 * k) * dpr;
      const g = ctx.createLinearGradient(x, y, x - 140 * dpr, y - 18 * dpr); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 140 * dpr, y - 18 * dpr); ctx.stroke();
    }
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (container.offsetParent === null) return;
    update(dt, t);
    render(t);
  }
  raf = requestAnimationFrame(loop);

  return {
    setPositions, showEmote, emote, interact, jump,
    setJoystick(x, y) { joy = { x, y }; if (x || y) moveTarget = null; },
    pause(p) { paused = p; if (p) { keys.clear(); joy = { x: 0, y: 0 }; moveTarget = null; } },
    setObjective(o) { objective = o; },
    nearSpecial() { return [...pairState.values()].some((s) => s.near && s.special); },
    teleportToShipRamp() { if (scene !== campus) enterScene('campus', SHIP.ramp[0] + 0.5, SHIP.ramp[1] + 1.6, 'down'); me.x = SHIP.ramp[0] + 0.5; me.y = SHIP.ramp[1] + 1.6; me.dir = 'down'; sendPos(true); },
    resetBaby() { baby.mode = 'idle'; },
    fx(kind) {
      const x = me.x, y = me.y - 1.6;
      if (kind === 'confetti') { confetti(x, y, 50); audio.sfx('coin'); }
      if (kind === 'hearts') { burst(x, y, ['❤️', '💖', '💕'], 8); audio.sfx('heart'); }
      if (kind === 'petals') { burst(x, y, ['🌸', '🌺', '🌼'], 10); audio.sfx('heart'); }
      if (kind === 'crown') { burst(x, y, ['👑', '✨'], 8); confetti(x, y, 24); }
      if (kind === 'stars') { burst(x, y, ['🔮', '✨', '⭐'], 9); sparkle(x, y + 1, 20, '#c7b8ff'); }
      if (kind === 'dance') emote('dance');
      if (kind === 'music') { burst(x, y, ['🎵', '🎶', '🎧'], 7); }
      if (kind === 'rain') { burst(x, y - 0.6, ['💧', '💧', '☔'], 12); audio.sfx('whoosh'); }
      if (kind === 'alarm') { sparkle(x, y + 0.6, 26, '#ff4f6e'); audio.sfx('error'); }
      if (kind === 'sparks') { sparkle(x, y + 0.6, 30, '#5ff2ff'); audio.sfx('chaos'); }
      if (kind === 'tears') { burst(x, y, ['🥲', '💧'], 6); }
    },
    debugGoto(id, x, y) { if (id === 'campus') enterScene('campus', x ?? SPAWN.x, y ?? SPAWN.y, 'down'); else { const I = INTERIORS[id]; enterScene(id, x ?? I.spawn.x, y ?? I.spawn.y, 'up'); } },
    get sceneId() { return scene.id; },
    get sceneMusic() { return scene === campus ? 'campus' : scene.I.music; },
    get position() { return { x: me.x, y: me.y, dir: me.dir, moving: me.moving }; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', blurH); cv.remove(); },
  };
}

export { INTERIORS };
