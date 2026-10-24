// VW4 film engine: every cinematic is a sequence of shots. A shot shows the crew's own
// full-screen image when `assets/cine/<slot>.jpg` exists (10 s, gentle push-in), otherwise an
// in-engine pixel-art scene rendered live at 480×270 and upscaled crisp. Subtitles carry a
// speaker portrait. Shots, slots and lines are listed in FILMS at the bottom.
import { h } from './dom.js';
import { audio } from '../audio.js';
import { characterSheet, drawCharacter, portrait, MAHMOUD_SPEC, PHARAOH_SPEC, BABY_SPEC } from '../gfx/sprites.js';
import { campusArt, buildShip, PW, PH } from '../gfx/campusArt.js';
import { drawPixelText, drawPixelTextCentered, textWidth } from '../gfx/pixelfont.js';
import { prewarmEarth } from '../ship/ship.js';
import { npcById } from '../../shared/data/npcs.js';

export const FW = 480, FH = 270;
export const IMAGE_MS = 10000;

// ───────────────────────── speakers ─────────────────────────
const SPEAKERS = {
  mahmoud: { name: 'Mahmoud', color: '#f0c35a', spec: MAHMOUD_SPEC, mood: 'happy' },
  mahmoud_smug: { name: 'Mahmoud', color: '#f0c35a', spec: MAHMOUD_SPEC, mood: 'smug' },
  pharaoh: { name: 'The Pharaoh of Discord', color: '#ffd36b', spec: PHARAOH_SPEC, mood: 'smug', pharaoh: true },
  baby: { name: 'Baby Mahmoud', color: '#ffb3e6', spec: BABY_SPEC, mood: 'happy' },
  hicham: { name: 'Hicham', color: '#c77dff', spec: () => npcById('hicham').look, mood: 'smug' },
  narrator: { name: '', color: '#9fd3ff' },
};

// ───────────────────────── image slots ─────────────────────────
const slotState = new Map(); // slot → 'ok' | 'missing' | Promise
export function probeSlot(slot) {
  if (!slot) return Promise.resolve(false);
  const st = slotState.get(slot);
  if (st === 'ok') return Promise.resolve(true);
  if (st === 'missing') return Promise.resolve(false);
  if (st) return st;
  const p = new Promise((res) => {
    const img = new Image();
    img.onload = () => { slotState.set(slot, 'ok'); res(true); };
    img.onerror = () => { slotState.set(slot, 'missing'); res(false); };
    img.src = `assets/cine/${slot}.jpg`;
  });
  slotState.set(slot, p);
  return p;
}
export function preloadFilm(name) { for (const s of FILMS[name] || []) probeSlot(s.slot); }

/** Real duration of a shot: 10 s for a provided image, the scene's own length otherwise. */
const shotMs = (s) => (slotState.get(s.slot) === 'ok' ? IMAGE_MS : s.dur);
export const filmLength = (name) => (FILMS[name] || []).reduce((a, s) => a + shotMs(s), 0);

// ───────────────────────── shared drawing helpers ─────────────────────────
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const glowAt = (g, x, y, r, rgb, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.45, `rgba(${rgb},${a * 0.3})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
const sheets = new Map();
const sheetOf = (spec) => { const k = JSON.stringify(spec); if (!sheets.has(k)) sheets.set(k, characterSheet(spec)); return sheets.get(k); };
const char = (g, spec, dir, frame, x, y, scale = 1) => { g.save(); g.imageSmoothingEnabled = false; drawCharacter(g, sheetOf(spec), dir, frame, x, y, scale); g.restore(); };
const shadow = (g, x, y, rx, a = 0.4) => { g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); g.ellipse(x, y, rx, rx * 0.32, 0, 0, Math.PI * 2); g.fill(); };
const GLYPHS = [
  ['01110', '01010', '01110', '11111', '00100', '00100', '00100'], // ankh
  ['00000', '01110', '10101', '11111', '01110', '00100', '01000'], // eye
  ['10001', '01110', '11111', '11111', '01110', '10001', '00000'], // scarab
  ['00100', '01110', '11111', '00100', '00100', '01110', '00000'], // feather
];
function glyphRain(g, t, color, n = 24, speed = 30) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const gl = GLYPHS[i % GLYPHS.length], x = (i * 53 + Math.floor(i / 9) * 17) % FW, y = Math.round(((t * speed + i * 37) % (FH + 30)) - 15);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (gl[r][c] === '1') g.fillRect(x + c * 2, y + r * 2, 2, 2);
  }
}
const walkFrame = (t, speed = 8) => [1, 0, 2, 0][Math.floor(t * speed) % 4];

const STARS = (() => { const r = rnd(7); return Array.from({ length: 420 }, () => ({ x: r(), y: r(), z: 0.2 + r() * 0.8, tw: r() * 6, c: r() < 0.12 ? '255,220,190' : r() < 0.2 ? '190,210,255' : '235,240,255' })); })();
function space(g, t, { dx = 0, dy = 0, warp = 0, nebula = true } = {}) {
  const bg = g.createLinearGradient(0, 0, 0, FH);
  bg.addColorStop(0, '#02030b'); bg.addColorStop(1, '#070a1c');
  g.fillStyle = bg; g.fillRect(0, 0, FW, FH);
  if (nebula) {
    glowAt(g, FW * 0.22, FH * 0.3, 190, '120,60,200', 0.18);
    glowAt(g, FW * 0.8, FH * 0.75, 220, '30,120,200', 0.16);
    glowAt(g, FW * 0.6, FH * 0.15, 120, '255,79,216', 0.08);
  }
  for (const s of STARS) {
    const x = ((s.x * FW + dx * s.z * t) % FW + FW) % FW, y = ((s.y * FH + dy * s.z * t) % FH + FH) % FH;
    const b = (0.45 + 0.55 * Math.sin(t * 1.3 + s.tw) ** 2) * s.z;
    g.fillStyle = `rgba(${s.c},${b})`;
    if (warp > 0) { g.fillRect(x, y, Math.max(1, warp * s.z * 40), 1); continue; }
    const sz = s.z > 0.85 ? 2 : 1;
    g.fillRect(Math.round(x), Math.round(y), sz, sz);
    if (s.z > 0.95 && b > 0.8) { g.fillStyle = `rgba(${s.c},${b * 0.4})`; g.fillRect(Math.round(x) - 1, Math.round(y), 4, 1); g.fillRect(Math.round(x) + 0.5, Math.round(y) - 1, 1, 4); }
  }
}

// Real-time globe (orthographic) with cached texture data.
let globeData = null;
function globeTex() {
  if (globeData) return globeData;
  const tex = prewarmEarth();
  const read = (c) => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
  globeData = { day: read(tex.day), night: read(tex.night), W: tex.day.width, H: tex.day.height };
  return globeData;
}
const globeCanvases = new Map();
function globe(size, lon0, lat0, sun = [-0.6, 0.35, 0.72]) {
  const T = globeTex();
  let c = globeCanvases.get(size);
  if (!c) { c = document.createElement('canvas'); c.width = c.height = size; c.ctx = c.getContext('2d'); c.img = c.ctx.createImageData(size, size); globeCanvases.set(size, c); }
  const d = c.img.data; d.fill(0);
  const sl = Math.hypot(...sun), sx = sun[0] / sl, sy = sun[1] / sl, sz = sun[2] / sl;
  const la0 = (lat0 * Math.PI) / 180, cosL = Math.cos(la0), sinL = Math.sin(la0), lo0 = (lon0 * Math.PI) / 180;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x + 0.5) / size * 2 - 1, ny = 1 - (y + 0.5) / size * 2, r2 = nx * nx + ny * ny;
    if (r2 > 1) continue;
    const nz = Math.sqrt(1 - r2);
    const ry = ny * cosL + nz * sinL, rz = -ny * sinL + nz * cosL;
    const lat = Math.asin(ry), lon = Math.atan2(nx, rz) + lo0;
    let u = (lon / (2 * Math.PI) + 0.5) % 1; if (u < 0) u += 1;
    const tx = Math.min(T.W - 1, Math.floor(u * T.W)), ty = Math.min(T.H - 1, Math.floor((0.5 - lat / Math.PI) * T.H));
    const ti = (ty * T.W + tx) * 4, light = nx * sx + ny * sy + nz * sz;
    const k = Math.max(0, Math.min(1, (light + 0.15) / 0.4)), sh = 0.06 + Math.max(0, light), rim = Math.pow(1 - nz, 2.4);
    const i = (y * size + x) * 4;
    d[i] = T.day.data[ti] * sh * k + T.night.data[ti] * 1.5 * (1 - k) + 70 * rim;
    d[i + 1] = T.day.data[ti + 1] * sh * k + T.night.data[ti + 1] * 1.35 * (1 - k) + 140 * rim;
    d[i + 2] = T.day.data[ti + 2] * sh * k + T.night.data[ti + 2] * 0.8 * (1 - k) + 255 * rim;
    d[i + 3] = 255 * Math.min(1, (1 - Math.sqrt(r2)) * size * 0.5);
  }
  c.ctx.putImageData(c.img, 0, 0);
  return c;
}
function drawGlobe(g, cx, cy, r, lon0, lat0) {
  glowAt(g, cx, cy, r * 1.45, '90,160,255', 0.5);
  const size = Math.min(220, Math.max(48, Math.round(r * 2)));
  g.save(); g.imageSmoothingEnabled = true;
  g.drawImage(globe(size, lon0, lat0), cx - r, cy - r, r * 2, r * 2);
  g.restore();
}
/** Screen position of a lat/lon on a drawn globe, or null when on the far side. */
function globePoint(cx, cy, r, lon0, lat0, lat, lon) {
  const L = (lat * Math.PI) / 180, dl = ((lon - lon0) * Math.PI) / 180, la0 = (lat0 * Math.PI) / 180;
  const nx = Math.cos(L) * Math.sin(dl), ry = Math.sin(L), rz = Math.cos(L) * Math.cos(dl);
  const ny = ry * Math.cos(la0) - rz * Math.sin(la0), nz = ry * Math.sin(la0) + rz * Math.cos(la0);
  if (nz < 0.05) return null;
  return { x: cx + nx * r, y: cy - ny * r, z: nz };
}

const CRATERS = (() => { const r = rnd(31); return Array.from({ length: 70 }, () => ({ a: r(), d: r(), s: 0.02 + r() ** 2 * 0.09 })); })();
function moonDisc(g, cx, cy, R, lit = [-0.5, -0.6]) {
  glowAt(g, cx, cy, R * 1.35, '200,210,240', 0.18);
  const mg = g.createRadialGradient(cx + lit[0] * R * 0.5, cy + lit[1] * R * 0.5, R * 0.1, cx, cy, R);
  mg.addColorStop(0, '#e8eaf2'); mg.addColorStop(0.65, '#9a9dab'); mg.addColorStop(1, '#3d4050');
  g.fillStyle = mg; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  for (const c of CRATERS) {
    const ang = c.a * Math.PI * 2, dist = Math.sqrt(c.d) * R, x = cx + Math.cos(ang) * dist, y = cy + Math.sin(ang) * dist, r = c.s * R;
    g.fillStyle = 'rgba(60,62,76,.35)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(240,242,250,.18)'; g.beginPath(); g.arc(x + r * 0.2, y + r * 0.25, r * 0.8, 0, Math.PI * 2); g.fill();
  }
  // tiny campus lights on the night side
  const sh = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R); sh.addColorStop(0.45, 'rgba(0,0,10,0)'); sh.addColorStop(1, 'rgba(0,0,10,.7)');
  g.fillStyle = sh; g.fillRect(cx - R, cy - R, R * 2, R * 2);
  g.restore();
}

const shipCanvases = {};
const parkedShip = () => shipArt(true);
const shipArt = (parked) => shipCanvases[parked] || (shipCanvases[parked] = buildShip({ parked }));
function drawShip(g, x, y, scale, { flame = 1, t = 0, flip = false, angle = 0, parked = false } = {}) {
  const c = shipArt(parked);
  g.save(); g.translate(x, y); g.rotate(angle); if (flip) g.scale(-1, 1);
  const w = c.width * scale, hh = c.height * scale;
  if (flame > 0) {
    for (const ey of [-0.12, 0.12]) {
      const fx = -w / 2 + 6 * scale, fy = ey * hh * 1.6 - 4 * scale;
      const len = (60 + Math.sin(t * 40) * 10) * scale * flame;
      const gr = g.createLinearGradient(fx, 0, fx - len, 0); gr.addColorStop(0, 'rgba(255,240,200,.95)'); gr.addColorStop(0.3, 'rgba(255,150,60,.85)'); gr.addColorStop(1, 'rgba(255,60,120,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(fx, fy - 9 * scale); g.lineTo(fx - len, fy); g.lineTo(fx, fy + 9 * scale); g.fill();
      glowAt(g, fx, fy, 40 * scale * flame, '255,150,70', 0.5);
    }
  }
  g.imageSmoothingEnabled = true;
  g.drawImage(c, -w / 2, -hh / 2, w, hh);
  g.restore();
}

/** Draws a window of the real campus at zoom z, centred on (wx, wy) world px. */
function campusView(g, wx, wy, z, t, actors = [], { hideShip = false, overlay = null } = {}) {
  const A = campusArt();
  const vw = FW / z, vh = FH / z;
  const ox = Math.max(0, Math.min(PW - vw, wx - vw / 2)), oy = Math.max(0, Math.min(PH - vh, wy - vh / 2));
  g.save(); g.imageSmoothingEnabled = false;
  g.fillStyle = '#05060d'; g.fillRect(0, 0, FW, FH);
  g.scale(z, z); g.translate(-ox, -oy);
  g.drawImage(A.ground, ox, oy, vw + 2, vh + 2, ox, oy, vw + 2, vh + 2);
  A.groundFx(g, t * 1000);
  const ents = [];
  for (const b of A.buildings) if (b.x < ox + vw && b.x + b.canvas.width > ox && b.y < oy + vh + 200) ents.push({ y: b.sortY, d: () => g.drawImage(b.canvas, b.x, b.y) });
  for (const p of A.props) if (!(hideShip && p.isShip)) ents.push({ y: p.y, d: () => p.draw(g, t * 1000) });
  if (overlay && overlay.sorted) ents.push({ y: overlay.y, d: () => overlay.sorted(g) });
  for (const a of actors) ents.push({ y: a.y, d: () => { shadow(g, a.x, a.y, 11); g.imageSmoothingEnabled = false; drawCharacter(g, sheetOf(a.spec), a.dir, a.frame || 0, a.x, a.y - (a.z || 0)); } });
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) e.d();
  g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true;
  g.drawImage(A.lightmap, 0, 0, PW, PH);
  g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false;
  for (const b of A.buildings) if (b.x < ox + vw + 200 && b.x + b.canvas.width > ox - 200) b.emissive(g, t * 1000);
  for (const p of A.props) if (p.emissive && !(hideShip && p.isShip)) p.emissive(g, t * 1000);
  if (overlay && overlay.top) overlay.top(g);
  g.restore();
}

function wheel(g, cx, cy, r, segs, angle, { rim = '#f0c35a', labels = true } = {}) {
  glowAt(g, cx, cy, r * 1.5, '240,195,90', 0.25);
  g.fillStyle = '#1a1208'; g.beginPath(); g.arc(cx, cy, r + 6, 0, Math.PI * 2); g.fill();
  const n = segs.length; let a0 = angle;
  const total = segs.reduce((s, x) => s + (x.w || 1), 0);
  for (const s of segs) {
    const da = (Math.PI * 2 * (s.w || 1)) / total;
    g.fillStyle = s.color; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a0 + da); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
    if (labels && s.label) {
      const am = a0 + da / 2, lx = cx + Math.cos(am) * r * 0.7, ly = cy + Math.sin(am) * r * 0.7;
      drawPixelTextCentered(g, s.label, Math.round(lx), Math.round(ly) - 2, '#fff', 1, 'rgba(0,0,0,.7)');
    }
    a0 += da;
  }
  g.strokeStyle = rim; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r + 2, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < n * 2; i++) { const a = angle + (i / (n * 2)) * Math.PI * 2; g.fillStyle = i % 2 ? '#fff6d0' : '#f0c35a'; g.fillRect(Math.round(cx + Math.cos(a) * (r + 4)) - 1, Math.round(cy + Math.sin(a) * (r + 4)) - 1, 2, 2); }
  g.fillStyle = '#2a1d08'; g.beginPath(); g.arc(cx, cy, r * 0.18, 0, Math.PI * 2); g.fill();
  g.fillStyle = rim; g.beginPath(); g.arc(cx, cy, r * 0.11, 0, Math.PI * 2); g.fill();
  // pointer
  g.fillStyle = '#ff4fd8'; g.beginPath(); g.moveTo(cx, cy - r - 2); g.lineTo(cx - 7, cy - r - 14); g.lineTo(cx + 7, cy - r - 14); g.closePath(); g.fill();
}

function casinoRoom(g, t, accent = '255,79,216') {
  const bg = g.createLinearGradient(0, 0, 0, FH); bg.addColorStop(0, '#120818'); bg.addColorStop(1, '#05030a');
  g.fillStyle = bg; g.fillRect(0, 0, FW, FH);
  // back wall neon arches
  for (let i = 0; i < 6; i++) { const x = 20 + i * 80; g.strokeStyle = `rgba(${accent},${0.25 + 0.15 * Math.sin(t * 2 + i)})`; g.lineWidth = 2; g.beginPath(); g.arc(x + 30, 70, 28, Math.PI, 0); g.stroke(); g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x + 4, 70, 52, 50); }
  for (let i = 0; i < 26; i++) { const x = (i * 37 + t * 12) % FW; glowAt(g, x, 14, 10, i % 2 ? '240,195,90' : accent, 0.35 + 0.25 * Math.sin(t * 4 + i)); }
  // felt table
  g.fillStyle = '#0b3a26'; g.beginPath(); g.ellipse(FW / 2, FH * 0.86, FW * 0.62, 70, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#c9a046'; g.lineWidth = 3; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.04)'; g.beginPath(); g.ellipse(FW / 2, FH * 0.84, FW * 0.5, 50, 0, 0, Math.PI * 2); g.fill();
}
function chipStack(g, x, y, n, color) { for (let i = 0; i < n; i++) { g.fillStyle = '#000'; g.fillRect(x - 5, y - i * 3 - 1, 10, 3); g.fillStyle = color; g.fillRect(x - 5, y - i * 3 - 2, 10, 3); g.fillStyle = '#fff'; g.fillRect(x - 1, y - i * 3 - 2, 2, 1); } }

// ───────────────────────── scenes ─────────────────────────
// Each scene: (g, t seconds, d seconds, S state, env) → draws a 480×270 frame.
const CITIES = [['🇵🇹', 'LISBON', 38.7, -9.1, '#48e08f'], ['🇲🇰', 'SKOPJE', 42.0, 21.4, '#ff5a6e'], ['🇵🇱', 'KRAKOW', 50.06, 19.9, '#ffffff'], ['🇲🇦', 'MARRAKECH', 31.6, -8.0, '#ff7a5c']];

const SCENES = {
  // Deep space, the Earth slowly rising.
  space(g, t, d) {
    space(g, t, { dx: -4 });
    const k = ease(t / d);
    drawGlobe(g, FW * 0.7, lerp(FH * 1.25, FH * 0.62, k), 120, 10 + t * 3, 25);
    moonDisc(g, FW * 0.16, FH * 0.24, 22);
  },

  // Earth with the four home cities lighting up and beaming to the Moon.
  earthPins(g, t, d, S) {
    space(g, t, { dx: -2 });
    const cx = FW * 0.42, cy = FH * 0.56, r = 112, lon0 = 4 + t * 1.2, lat0 = 32;
    drawGlobe(g, cx, cy, r, lon0, lat0);
    moonDisc(g, FW * 0.86, FH * 0.16, 18);
    CITIES.forEach(([, name, lat, lon, col], i) => {
      const at = 1.2 + i * 1.3;
      if (t < at) return;
      const p = globePoint(cx, cy, r, lon0, lat0, lat, lon);
      if (!p) return;
      const k = clamp01((t - at) / 0.6), pulse = (t - at) % 1.4;
      g.strokeStyle = col; g.globalAlpha = 1 - pulse / 1.4; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, 2 + pulse * 10, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
      glowAt(g, p.x, p.y, 10, '255,230,160', 0.9 * k);
      g.fillStyle = '#fff'; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
      // label
      const lx = p.x + (i % 2 ? 10 : -10 - textWidth(name)), ly = p.y - 10 - (i === 2 ? 8 : 0) + (i === 3 ? 10 : 0);
      g.globalAlpha = k; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(lx - 2, ly - 2, textWidth(name) + 4, 9); drawPixelText(g, name, lx, ly, col); g.globalAlpha = 1;
      // beam to the Moon after all four are lit
      const bt = clamp01((t - 6.5 - i * 0.25) / 1.5);
      if (bt > 0) {
        const mx = FW * 0.86, my = FH * 0.16;
        g.strokeStyle = `rgba(95,242,255,${0.7 * (1 - bt * 0.4)})`; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, p.y);
        g.quadraticCurveTo((p.x + mx) / 2, Math.min(p.y, my) - 40, lerp(p.x, mx, bt), lerp(p.y, my, bt)); g.stroke();
        if (bt >= 1) glowAt(g, mx, my, 30, '95,242,255', 0.3 + 0.2 * Math.sin(t * 6));
      }
    });
  },

  // The title: big VACATION WARS 4 logo over the Earth limb.
  logo(g, t, d) {
    space(g, t, { dx: -6 });
    drawGlobe(g, FW / 2, FH * 1.55, 260, 20 + t * 2, 10);
    const k = ease(t / 1.6);
    g.save(); g.translate(FW / 2, FH * 0.42); const s = lerp(2.4, 1, k); g.scale(s, s); g.globalAlpha = k;
    glowAt(g, 0, 0, 160, '240,195,90', 0.25);
    drawPixelTextCentered(g, 'VACATION WARS', 0, -22, '#f0c35a', 4, '#5a3a08');
    drawPixelTextCentered(g, 'IV', 0, 4, '#ffffff', 4, '#5a3a08');
    drawPixelTextCentered(g, 'THE LUNAR GAMBIT', 0, 30, '#5ff2ff', 1);
    g.restore(); g.globalAlpha = 1;
    // sweep shine
    const sx = lerp(-80, FW + 80, clamp01((t - 1.8) / 1.6));
    const gr = g.createLinearGradient(sx - 30, 0, sx + 30, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(sx - 30, FH * 0.25, 60, 90);
  },

  // MAHMOUD-1 crossing space from Earth to the Moon.
  flight(g, t, d, S) {
    space(g, t, { dx: -40, warp: t > d * 0.6 ? (t - d * 0.6) / (d * 0.4) * 0.6 : 0 });
    const k = t / d;
    drawGlobe(g, lerp(FW * 0.18, -FW * 0.1, k), FH * 0.72, lerp(70, 50, k), 30 + t * 4, 30);
    moonDisc(g, lerp(FW * 1.05, FW * 0.82, k), FH * 0.3, lerp(26, 70, ease(k)));
    const sx = lerp(-60, FW * 0.52, ease(clamp01(k * 1.4))), sy = FH * 0.5 + Math.sin(t * 2) * 4;
    drawShip(g, sx, sy, 0.32, { t, flame: 1 });
  },

  // Approach and landing on the Moon campus pad.
  descent(g, t, d) {
    space(g, t, { dy: 20 });
    const k = ease(t / (d * 0.85));
    drawGlobe(g, FW * 0.8, lerp(FH * 0.2, FH * 0.08, k), 26, 40, 20);
    // lunar horizon rising
    const R = FW * 1.8, cx = FW / 2, cy = FH + R - lerp(30, FH * 0.55, k);
    const mg = g.createRadialGradient(cx, cy - R, 10, cx, cy, R);
    mg.addColorStop(0, '#d6d8e2'); mg.addColorStop(0.04, '#a7aab8'); mg.addColorStop(0.15, '#5d6070'); mg.addColorStop(1, '#1d1e27');
    g.fillStyle = mg; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    // campus skyline on the horizon
    const hy = cy - R, sc = lerp(0.4, 1.6, k);
    g.save(); g.translate(FW / 2, hy + 2); g.scale(sc, sc);
    const r2 = rnd(5);
    for (let i = -14; i <= 14; i++) {
      const bw = 10 + r2() * 12, bh = 8 + r2() * 30, x = i * 16;
      g.fillStyle = '#1b1d2a'; g.fillRect(x, -bh, bw, bh);
      for (let wy = -bh + 3; wy < -2; wy += 5) for (let wx = x + 2; wx < x + bw - 2; wx += 4) if (r2() < 0.5) { g.fillStyle = r2() < 0.3 ? '#5ff2ff' : r2() < 0.5 ? '#ff4fd8' : '#ffd890'; g.fillRect(wx, wy, 2, 2); }
    }
    glowAt(g, 0, -10, 120, '95,242,255', 0.15);
    g.restore();
    // ship descending onto the pad with thrusters down
    const sy = lerp(-40, hy - 8, ease(t / d)), sx = FW * 0.5;
    drawShip(g, sx, sy, lerp(0.14, 0.3, k), { t, flame: 0.6 });
    const fl = 1 - clamp01((t - d * 0.85) / (d * 0.15));
    glowAt(g, sx, sy + 20, 30, '255,170,90', 0.5 * fl);
    if (t > d * 0.8) { const a = clamp01((t - d * 0.8) / (d * 0.2)); g.fillStyle = `rgba(255,255,255,${a * 0.85})`; g.fillRect(0, 0, FW, FH); }
  },

  // Real campus at night; the camera glides south to the fountain where Mahmoud waves.
  campusArrival(g, t, d, S, env) {
    const k = ease(t / (d * 0.8));
    const wx = 42 * 32, wy = lerp(14 * 32, 32.6 * 32, k);
    const m = { spec: MAHMOUD_SPEC, x: 42 * 32, y: 34.0 * 32, dir: 'down', frame: 0, z: t > d * 0.6 ? Math.abs(Math.sin(t * 6)) * 3 : 0 };
    const crew = (env.crew || []).slice(0, 5);
    const actors = crew.map((c, i) => {
      const tx = (42 + (i - (crew.length - 1) / 2) * 1.5) * 32, arrive = clamp01((t - 2 - i * 0.3) / 4);
      const x = lerp(tx - 9 * 32, tx, arrive), y = 36.2 * 32;
      return { spec: c, x, y, dir: arrive < 1 ? 'right' : 'up', frame: arrive < 1 ? walkFrame(t + i * 0.3) : 0 };
    });
    campusView(g, wx, wy, 1, t, [m, ...actors]);
  },

  // Close-up of a character talking in front of a backdrop.
  closeup(g, t, d, S, env, opt = {}) {
    const who = opt.who || 'mahmoud';
    const backs = {
      hq: () => { g.fillStyle = '#060b18'; g.fillRect(0, 0, FW, FH); for (let x = 0; x < FW; x += 24) { g.fillStyle = 'rgba(95,242,255,.06)'; g.fillRect(x, 0, 1, FH); } for (let i = 0; i < 5; i++) { const x = 20 + i * 92; g.fillStyle = '#0d1a30'; g.fillRect(x, 26, 76, 46); g.strokeStyle = 'rgba(95,242,255,.5)'; g.strokeRect(x + 0.5, 26.5, 76, 46); for (let l = 0; l < 4; l++) { g.fillStyle = `rgba(95,242,255,${0.3 + 0.3 * Math.sin(t * 3 + i + l)})`; g.fillRect(x + 6, 34 + l * 9, 20 + ((i * 13 + l * 29 + Math.floor(t * 4)) % 44), 3); } } drawGlobe(g, FW * 0.82, FH * 0.56, 46, t * 8, 25); },
      pyramid: () => { const bg = g.createLinearGradient(0, 0, 0, FH); bg.addColorStop(0, '#2a1404'); bg.addColorStop(1, '#090402'); g.fillStyle = bg; g.fillRect(0, 0, FW, FH); g.fillStyle = '#3d2208'; g.beginPath(); g.moveTo(FW / 2, 20); g.lineTo(FW * 0.95, FH); g.lineTo(FW * 0.05, FH); g.fill(); g.strokeStyle = 'rgba(240,195,90,.45)'; g.lineWidth = 2; g.stroke(); glowAt(g, FW / 2, 60, 120, '240,195,90', 0.35 + 0.1 * Math.sin(t * 5)); glyphRain(g, t, 'rgba(240,195,90,.28)', 18, 24); },
      club: () => { g.fillStyle = '#12061a'; g.fillRect(0, 0, FW, FH); for (let i = 0; i < 8; i++) glowAt(g, (i * 70 + t * 40) % FW, 40 + (i % 3) * 30, 50, i % 2 ? '255,79,216' : '95,242,255', 0.35); },
      market: () => { g.fillStyle = '#0c0614'; g.fillRect(0, 0, FW, FH); g.strokeStyle = '#c77dff'; g.lineWidth = 2; g.strokeRect(FW * 0.2, 18, FW * 0.6, 34); drawPixelTextCentered(g, "HICHAM'S BLACK MARKET", FW / 2, 30, '#ff4fd8', 2); for (let i = 0; i < 10; i++) { g.fillStyle = ['#5ff2ff', '#ff4fd8', '#f0c35a', '#c77dff'][i % 4]; g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3 + i); g.fillRect(30 + i * 44, 80, 12, 16); g.globalAlpha = 1; } },
      campus: () => { campusView(g, (42 + t * 0.25) * 32, 30 * 32, 0.9, t); const v = g.createLinearGradient(0, 0, FW, 0); v.addColorStop(0, 'rgba(4,5,14,.2)'); v.addColorStop(0.55, 'rgba(4,5,14,.55)'); v.addColorStop(1, 'rgba(4,5,14,.2)'); g.fillStyle = v; g.fillRect(0, 0, FW, FH); },
    };
    (backs[opt.back || 'hq'])();
    const spk = SPEAKERS[who];
    const spec = typeof spk.spec === 'function' ? spk.spec() : spk.spec;
    const bob = Math.sin(t * 3) * 1.5;
    const x = opt.x ?? FW * 0.36, y = FH - 6;
    glowAt(g, x, y - 90, 110, opt.glow || '240,195,90', 0.2);
    shadow(g, x, y, 60, 0.5);
    char(g, spec, 'down', 0, x, y + bob, opt.scale || 4);
    if (opt.extra) opt.extra(g, t, d);
  },

  // Boarding: the crew walk up the ramp of MAHMOUD-1.
  boarding(g, t, d, S, env) {
    space(g, t, { dx: -3 });
    g.fillStyle = '#1b1d28'; g.fillRect(0, FH * 0.7, FW, FH); g.fillStyle = '#2a2d3c'; g.fillRect(0, FH * 0.7, FW, 3);
    for (let x = 0; x < FW; x += 30) { g.fillStyle = '#f0c35a'; g.fillRect(x, FH * 0.86, 16, 2); }
    drawGlobe(g, FW * 0.86, FH * 0.2, 30, 10 + t * 4, 25);
    const sx = FW * 0.62, sy = FH * 0.52;
    drawShip(g, sx, sy, 0.62, { t, flame: t > d - 2.5 ? 0.6 : 0, parked: true });
    const rampX = sx - 30, rampY = FH * 0.78;
    const crew = (env.crew && env.crew.length ? env.crew : [MAHMOUD_SPEC]).slice(0, 6);
    crew.forEach((spec, i) => {
      const start = i * 0.9, k = clamp01((t - start) / 4);
      if (k >= 1) return;
      const x = lerp(-20 - i * 6, rampX, k), y = lerp(FH * 0.9, rampY, k * k);
      shadow(g, x, y, 10);
      char(g, spec, 'right', walkFrame(t + i), x, y, 1);
    });
    if (t > d - 2.5) { glowAt(g, sx - 120, sy + 10, 60, '255,150,70', 0.4); }
  },

  // Lift-off: thrusters, smoke and the ship climbing out of frame.
  liftoff(g, t, d, S) {
    space(g, t, { dy: t > 2 ? 30 * (t - 2) : 0 });
    const up = Math.max(0, t - 2.4), k = up * up * 7;
    g.fillStyle = '#1b1d28'; g.fillRect(0, FH * 0.78 + k, FW, FH); g.fillStyle = '#f0c35a'; for (let x = 0; x < FW; x += 30) g.fillRect(x, FH * 0.82 + k, 16, 2);
    S.smoke = S.smoke || [];
    if (t < d - 1 && S.smoke.length < 160) for (let i = 0; i < 4; i++) S.smoke.push({ x: FW / 2 + (Math.random() - 0.5) * 60, y: FH * 0.78, vx: (Math.random() - 0.5) * 70, vy: -Math.random() * 10, r: 6 + Math.random() * 10, b: Math.random() });
    for (const p of S.smoke) { p.x += p.vx / 60; p.y += p.vy / 60 + k * 0.01; p.r += 0.25; g.fillStyle = `rgba(${200 + p.b * 40},${200 + p.b * 30},${210},0.10)`; g.beginPath(); g.arc(p.x, p.y + k, p.r, 0, Math.PI * 2); g.fill(); }
    const y = FH * 0.6 - k;
    g.save(); g.translate(FW / 2, y);
    const fl = 0.7 + Math.random() * 0.3;
    for (const dx of [-26, 26]) { const gr = g.createLinearGradient(0, 20, 0, 90); gr.addColorStop(0, 'rgba(255,240,200,.95)'); gr.addColorStop(0.35, 'rgba(255,140,60,.85)'); gr.addColorStop(1, 'rgba(255,60,120,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(dx - 8, 22); g.lineTo(dx, 22 + 70 * fl * (1 + up)); g.lineTo(dx + 8, 22); g.fill(); glowAt(g, dx, 30, 40, '255,150,70', 0.6); }
    g.restore();
    drawShip(g, FW / 2, y, 0.42, { t, flame: 0, angle: -Math.PI / 2 });
    S.shake = t > 1 && t < 5 ? 2 : 0;
  },

  // Cockpit window: Earth growing ahead, HUD overlays.
  cockpit(g, t, d) {
    space(g, t, { dx: -1, warp: 0 });
    const k = ease(t / d);
    drawGlobe(g, FW / 2, FH * 0.5, lerp(30, 150, k), 0 + t * 6, 30);
    // window frame
    g.fillStyle = '#0b0d16';
    g.beginPath(); g.rect(0, 0, FW, FH); g.moveTo(40, 30); g.lineTo(FW - 40, 30); g.lineTo(FW - 70, FH - 50); g.lineTo(70, FH - 50); g.closePath(); g.fill('evenodd');
    g.strokeStyle = '#2b3048'; g.lineWidth = 4; g.beginPath(); g.moveTo(40, 30); g.lineTo(FW - 40, 30); g.lineTo(FW - 70, FH - 50); g.lineTo(70, FH - 50); g.closePath(); g.stroke();
    g.strokeStyle = 'rgba(95,242,255,.6)'; g.lineWidth = 1; g.strokeRect(FW / 2 - 30, FH / 2 - 30, 60, 60);
    drawPixelText(g, 'TARGET: EARTH', 52, 38, '#5ff2ff'); drawPixelText(g, `DIST ${Math.round(384400 * (1 - k))} KM`, FW - 140, 38, '#5ff2ff');
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(95,242,255,${0.4 + 0.4 * Math.sin(t * 5 + i)})`; g.fillRect(90 + i * 52, FH - 40, 30, 4); }
    g.fillStyle = '#ff4fd8'; if (Math.floor(t * 2) % 2) g.fillRect(FW / 2 - 2, FH - 28, 4, 4);
  },

  // Season Spin: 12-month wheel in the casino.
  seasonWheel(g, t, d) {
    casinoRoom(g, t, '95,242,255');
    const segs = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map((m, i) => ({ label: m, color: [0, 1, 11].includes(i) ? '#4a7bd8' : i < 5 ? '#3fae6a' : i < 8 ? '#e0a52a' : '#d0662e' }));
    const spin = t * (2.2 - t / d * 1.9);
    wheel(g, FW * 0.5, FH * 0.5, 92, segs, spin);
    char(g, MAHMOUD_SPEC, 'down', 0, FW * 0.15, FH * 0.92, 2);
    // season icons flying
    const icons = ['❄', '✿', '☀', '❦'];
    g.font = '14px serif'; g.textAlign = 'center';
    icons.forEach((ic, i) => { const a = t * 0.8 + i * Math.PI / 2; g.fillStyle = ['#9fd3ff', '#7ee8a0', '#ffd36b', '#ff9d5c'][i]; g.fillText(ic, FW / 2 + Math.cos(a) * 130, FH * 0.5 + Math.sin(a) * 70); });
    g.textAlign = 'start';
  },

  // Region Roulette: Earth spinning inside a neon roulette ring with a rolling ball.
  regionGlobe(g, t, d) {
    casinoRoom(g, t);
    const cx = FW / 2, cy = FH * 0.48, r = 70;
    const segs = Array.from({ length: 11 }, (_, i) => ({ color: i % 2 ? '#1a0f24' : '#3a1030' }));
    g.save(); g.globalAlpha = 0.9; wheel(g, cx, cy, r + 26, segs, -t * 0.6, { rim: '#ff4fd8', labels: false }); g.restore();
    drawGlobe(g, cx, cy, r, t * 25, 20);
    const ba = t * (5 - t / d * 3.5);
    glowAt(g, cx + Math.cos(ba) * (r + 14), cy + Math.sin(ba) * (r + 14), 10, '255,255,255', 0.8);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + Math.cos(ba) * (r + 14), cy + Math.sin(ba) * (r + 14), 3, 0, Math.PI * 2); g.fill();
    chipStack(g, FW * 0.2, FH * 0.92, 6, '#ff4fd8'); chipStack(g, FW * 0.24, FH * 0.94, 4, '#5ff2ff'); chipStack(g, FW * 0.78, FH * 0.93, 7, '#f0c35a');
    char(g, MAHMOUD_SPEC, 'down', 0, FW * 0.88, FH * 0.86, 2);
  },

  // Country Clash: darts thrown at a spinning Earth.
  countryDarts(g, t, d, S) {
    casinoRoom(g, t, '240,195,90');
    const cx = FW / 2, cy = FH * 0.47, r = 80;
    // dartboard rings behind the globe
    for (let i = 5; i > 0; i--) { g.fillStyle = i % 2 ? '#2a0f14' : '#e9dcc0'; g.beginPath(); g.arc(cx, cy, r + i * 6, 0, Math.PI * 2); g.fill(); }
    drawGlobe(g, cx, cy, r, 10 + t * 12, 25);
    S.darts = S.darts || [];
    if (S.darts.length < Math.floor(t / 1.2) && S.darts.length < 6) S.darts.push({ t0: t, a: Math.random() * Math.PI * 2, rr: Math.random() * r * 0.8, from: Math.random() < 0.5 ? -1 : 1, col: ['#ff5a6e', '#48e08f', '#5ff2ff', '#f0c35a', '#c77dff', '#ff7a5c'][S.darts.length] });
    for (const dd of S.darts) {
      const k = clamp01((t - dd.t0) / 0.35), tx = cx + Math.cos(dd.a) * dd.rr, ty = cy + Math.sin(dd.a) * dd.rr;
      const x = lerp(dd.from < 0 ? -20 : FW + 20, tx, k), y = lerp(FH * 0.3, ty, k) - Math.sin(k * Math.PI) * 30;
      g.strokeStyle = '#d9d9e0'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + dd.from * -14, y - 6); g.stroke();
      g.fillStyle = dd.col; g.fillRect(x + dd.from * -16 - 2, y - 9, 5, 5);
      if (k >= 1 && t - dd.t0 < 0.6) glowAt(g, tx, ty, 16, '255,255,255', 0.6);
    }
    char(g, MAHMOUD_SPEC, 'down', 0, FW * 0.12, FH * 0.9, 2);
  },

  // The transformation: Mahmoud flickers into the Pharaoh amid lightning.
  morph(g, t, d, S) {
    const k = t / d;
    const bg = g.createRadialGradient(FW / 2, FH * 0.6, 10, FW / 2, FH * 0.6, 300);
    bg.addColorStop(0, k > 0.5 ? '#4a2a08' : '#0b1430'); bg.addColorStop(1, '#000');
    g.fillStyle = bg; g.fillRect(0, 0, FW, FH);
    if (k > 0.3) glyphRain(g, t, `rgba(240,195,90,${Math.min(0.6, (k - 0.3) * 2)})`, 30, 60);
    const flick = k > 0.3 && k < 0.72 ? Math.floor(t * (6 + k * 20)) % 2 : k >= 0.72 ? 1 : 0;
    const x = FW / 2 + (k > 0.3 && k < 0.75 ? (Math.random() - 0.5) * 4 : 0);
    glowAt(g, FW / 2, FH * 0.55, 140, flick ? '240,195,90' : '95,160,255', 0.35 + (k > 0.3 ? 0.2 * Math.random() : 0));
    shadow(g, FW / 2, FH - 10, 70, 0.6);
    char(g, flick ? PHARAOH_SPEC : MAHMOUD_SPEC, 'down', 0, x, FH - 10, 5);
    S.bolts = S.bolts || [];
    if (k > 0.28 && Math.random() < 0.25) S.bolts.push({ x: 60 + Math.random() * (FW - 120), life: 1, seed: Math.random() * 1000 });
    for (const b of S.bolts) { const r2 = rnd(Math.floor(b.seed) + 1); g.strokeStyle = `rgba(255,240,180,${b.life})`; g.lineWidth = 2; g.beginPath(); let bx = b.x, by = 0; g.moveTo(bx, by); while (by < FH * 0.8) { bx += (r2() - 0.5) * 30; by += 14 + r2() * 14; g.lineTo(bx, by); } g.stroke(); b.life -= 0.12; }
    S.bolts = S.bolts.filter((b) => b.life > 0);
    if (k > 0.72 && k < 0.78) { g.fillStyle = 'rgba(255,240,200,.8)'; g.fillRect(0, 0, FW, FH); }
    S.shake = k > 0.3 && k < 0.8 ? 3 : 0;
  },

  // Couples call / groups call explained with phones and hearts.
  pharaohTest(g, t, d, S, env) {
    SCENES.closeup(g, t, d, S, env, { who: 'pharaoh', back: 'pyramid', x: FW * 0.2, scale: 3 });
    const crew = (env.crew || []).slice(0, 4);
    crew.forEach((spec, i) => {
      const x = FW * 0.5 + (i % 2) * 70 + Math.floor(i / 2) * 30, y = FH * 0.62 + Math.floor(i / 2) * 60;
      shadow(g, x, y, 10); char(g, spec, i % 2 ? 'left' : 'right', 0, x, y, 1);
      if (t > 1 + i * 0.4) { g.fillStyle = '#111'; g.fillRect(x + (i % 2 ? -14 : 8), y - 30, 7, 12); g.fillStyle = Math.floor(t * 3 + i) % 2 ? '#48e08f' : '#5ff2ff'; g.fillRect(x + (i % 2 ? -13 : 9), y - 29, 5, 9); }
    });
    if (crew.length >= 2 && t > 3) { const k = (t * 0.8) % 1; g.font = '12px serif'; g.globalAlpha = 1 - k; g.fillText('💕', FW * 0.6, FH * 0.5 - k * 30); g.globalAlpha = 1; }
    // score board 1..10
    for (let i = 1; i <= 10; i++) { const lit = t > 4 && i <= Math.min(10, Math.floor((t - 4) * 2.5)); g.fillStyle = lit ? (i < 4 ? '#ff5a6e' : i < 8 ? '#f0c35a' : '#48e08f') : '#2a1d08'; g.fillRect(FW * 0.5 + (i - 1) * 20, 30, 16, 16); drawPixelTextCentered(g, String(i), FW * 0.5 + (i - 1) * 20 + 8, 35, lit ? '#000' : '#7a5a20'); }
  },

  // Berserk: three countries each, flags flying onto the board.
  berserk(g, t, d, S, env) {
    SCENES.closeup(g, t, d, S, env, { who: 'pharaoh', back: 'pyramid', x: FW * 0.78, scale: 3 });
    const n = Math.min(12, Math.floor(t * 2));
    for (let i = 0; i < n; i++) { const x = 40 + (i % 4) * 66, y = 50 + Math.floor(i / 4) * 60; g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, y, 56, 40); g.strokeStyle = ['#ff5a6e', '#48e08f', '#5ff2ff', '#f0c35a'][i % 4]; g.strokeRect(x + 0.5, y + 0.5, 56, 40); drawPixelTextCentered(g, ['PICK', '3', 'COUNTRIES', 'EACH'][i % 4], x + 28, y + 17, '#fff'); }
  },

  // The probability shot: one golden slice for the chosen country.
  finalWheel(g, t, d) {
    SCENES.closeup(g, t, d, {}, {}, { who: 'pharaoh', back: 'pyramid', x: FW * 0.16, scale: 2 });
    const k = clamp01(t / 2.5);
    const S2 = 0.9 * lerp(0.3, 0.8, (Math.sin(t * 1.2) + 1) / 2);
    wheel(g, FW * 0.6, FH * 0.48, 78 * (0.6 + 0.4 * k), [{ w: S2, color: '#f0c35a', label: 'CHOSEN' }, { w: (1 - S2) / 3, color: '#3a2a6a' }, { w: (1 - S2) / 3, color: '#2a3a6a' }, { w: (1 - S2) / 3, color: '#4a1a3a' }], t * 0.7);
  },

  // Back on the Moon: MAHMOUD-1 descends onto its pad over the real campus — flames, dust, touchdown.
  shipLanding(g, t, d, S) {
    const land = 6.2; // touchdown time (s)
    const k = clamp01(t / land), e = 1 - (1 - k) ** 3;
    const h = (1 - e) * 520; // height above the pad, world px
    const X = 52 * 32, Y = 46 * 32; // SHIP.x, SHIP.y
    const sh = parkedShip();
    S.dust = S.dust || [];
    if (h < 120 && t < land + 0.6 && S.dust.length < 120) for (let i = 0; i < 2; i++) { const side = Math.random() < 0.5 ? -1 : 1; S.dust.push({ x: X + 266 + side * (60 + Math.random() * 160), y: Y + 232 + Math.random() * 16, vx: side * (80 + Math.random() * 220), vy: -Math.random() * 30, r: 5 + Math.random() * 8, a: 0.32, life: 0 }); }
    const camY = lerp(Y - 120, Y + 120, ease(t / d));
    const overlay = {
      y: Y + 240,
      sorted: (gg) => {
        // shadow grows as the ship comes down
        gg.fillStyle = `rgba(0,0,0,${0.15 + 0.35 * e})`; gg.beginPath(); gg.ellipse(X + 266, Y + 238, 150 + 110 * e, 18 + 18 * e, 0, 0, Math.PI * 2); gg.fill();
        // landing thrusters
        if (t < land + 0.5) {
          const fl = (t < land ? 1 : 1 - (t - land) / 0.5) * (0.8 + Math.random() * 0.3);
          for (const fx of [X + 150, X + 370]) {
            const gr = gg.createLinearGradient(0, Y + 200 - h, 0, Y + 200 - h + 120 * fl);
            gr.addColorStop(0, 'rgba(255,240,200,.95)'); gr.addColorStop(0.4, 'rgba(255,140,60,.8)'); gr.addColorStop(1, 'rgba(255,60,120,0)');
            gg.fillStyle = gr; gg.beginPath(); gg.moveTo(fx - 14, Y + 196 - h); gg.lineTo(fx, Y + 200 - h + 120 * fl); gg.lineTo(fx + 14, Y + 196 - h); gg.fill();
            glowAt(gg, fx, Y + 220 - h, 90, '255,150,70', 0.45 * fl);
          }
        }
        gg.imageSmoothingEnabled = false;
        gg.drawImage(sh, X, Y - 12 - h);
      },
      top: (gg) => {
        for (const p of S.dust) { p.life += 1 / 60; p.x += p.vx / 60; p.y += p.vy / 60; p.vx *= 0.96; p.r += 0.35; p.a *= 0.975; gg.fillStyle = `rgba(200,204,218,${p.a})`; gg.beginPath(); gg.arc(p.x, p.y, p.r, 0, Math.PI * 2); gg.fill(); }
        S.dust = S.dust.filter((p) => p.a > 0.02 && p.life < 2);
      },
    };
    campusView(g, X + 260, camY, lerp(0.38, 0.5, ease(t / d)), t, [], { hideShip: true, overlay });
    S.shake = t > land - 0.2 && t < land + 0.5 ? 3 : 0;
    if (t > land - 0.05 && !S.thud) { S.thud = true; audio.sfx('land'); }
  },

  // Back to the Moon: ship lands, Baby Mahmoud runs into you.
  babyBump(g, t, d, S, env) {
    const me = (env.crew && env.crew[0]) || MAHMOUD_SPEC;
    const bumpAt = 3.2;
    const bx = t < bumpAt ? lerp(64 * 32, 60.6 * 32, t / bumpAt) : 60.6 * 32 + Math.min(1, (t - bumpAt) * 3) * 20;
    const actors = [
      { spec: me, x: 60 * 32, y: 55.6 * 32, dir: t < bumpAt ? 'right' : 'right', frame: 0, z: t > bumpAt && t < bumpAt + 0.4 ? Math.sin((t - bumpAt) / 0.4 * Math.PI) * 8 : 0 },
      { spec: BABY_SPEC, x: bx, y: 55.7 * 32, dir: t < bumpAt ? 'left' : 'left', frame: t < bumpAt ? walkFrame(t, 12) : 0, z: t > bumpAt && t < bumpAt + 0.5 ? Math.sin((t - bumpAt) / 0.5 * Math.PI) * 12 : 0 },
    ];
    campusView(g, 61 * 32, 55 * 32, 1.2, t, actors);
    if (t > bumpAt && t < bumpAt + 1.4) { g.font = '18px serif'; g.textAlign = 'center'; g.fillText('💥', FW * 0.5 + 14, FH * 0.55); g.fillText('⭐', FW * 0.5 - 20 + (t - bumpAt) * 20, FH * 0.4 - (t - bumpAt) * 20); g.textAlign = 'start'; }
    S.shake = t > bumpAt && t < bumpAt + 0.3 ? 3 : 0;
  },

  // The Black Market container lights up.
  marketReveal(g, t, d, S, env) {
    const actors = [{ spec: BABY_SPEC, x: 11.5 * 32, y: 54.3 * 32, dir: t > 5 ? 'down' : 'up', frame: 0, z: t > 5 ? Math.abs(Math.sin(t * 5)) * 4 : 0 }];
    (env.crew || []).slice(0, 3).forEach((c, i) => actors.push({ spec: c, x: (9.5 + i * 1.6) * 32, y: lerp(57.6, 55.4, clamp01(t / 4)) * 32, dir: 'up', frame: t < 4 ? walkFrame(t + i) : 0 }));
    campusView(g, 11 * 32, 53.4 * 32, 0.9, t, actors);
  },
};

// ───────────────────────── films ─────────────────────────
// slot: the image file you can drop into assets/cine/<slot>.jpg (16:9, no text) to replace the scene.
export const FILMS = {
  arrival: [
    { slot: 'arrival_1_campus', scene: 'campusArrival', dur: 10000, title: 'MAHMOUD\'S MOON', lines: [[0.8, 'narrator', 'Four embassies. A Role Market. A club. A Black Market. And one spacecraft.']] },
    { slot: 'arrival_2_mahmoud', scene: 'closeup', opt: { who: 'mahmoud', back: 'campus' }, dur: 10000, lines: [[0.3, 'mahmoud', 'Welcome! Three things before we fly: 1) visit YOUR embassy, 2) choose ONE role at the Role Market,'], [4.6, 'mahmoud', '3) board the spacecraft on the launch pad. Follow the blue arrow — and talk to everyone you meet!']] },
  ],
  launch: [
    { slot: 'launch_1_boarding', scene: 'boarding', dur: 10000, title: 'PAD 01 · MAHMOUD-1', lines: [[0.5, 'mahmoud', 'Everybody in! Seatbelts are decorative.']] },
    { slot: 'launch_2_liftoff', scene: 'liftoff', dur: 10000, lines: [[0.5, 'mahmoud', 'Three… two… one… LIFT-OFF!']] },
    { slot: 'launch_3_cockpit', scene: 'cockpit', dur: 10000, lines: [[0.4, 'mahmoud', 'First: write your wishlist — up to 5 countries. Then the Season Spin, the Region Roulette and the Country Clash.'], [5, 'mahmoud', 'Every wish counts. Every coin counts.']] },
  ],
  season: [
    { slot: 'season_1', scene: 'seasonWheel', dur: 10000, title: 'THE SEASON SPIN', lines: [[0.6, 'mahmoud', 'Before WHERE comes WHEN. Twelve months on the wheel.'], [5.2, 'mahmoud', 'Your wishes push the months when your countries are 18–29 °C. Chips push even harder.']] },
  ],
  region: [
    { slot: 'region_1', scene: 'regionGlobe', dur: 10000, title: 'THE REGION ROULETTE', lines: [[0.6, 'mahmoud', 'Now: which corner of the world? Put chips on a region to grow its slice.'], [5.4, 'mahmoud', 'Click a region to see its countries light up on the globe.']] },
  ],
  country: [
    { slot: 'country_1', scene: 'countryDarts', dur: 10000, title: 'THE COUNTRY CLASH', lines: [[0.6, 'mahmoud', 'Only the countries of the winning region are left. Fight for yours!'], [5.4, 'mahmoud', 'Countries you already visited get a malus. Hicham\'s powers can wreck the others.']] },
  ],
  pharaoh: [
    { slot: 'pharaoh_1_doubt', scene: 'closeup', opt: { who: 'mahmoud_smug', back: 'hq' }, dur: 10000, lines: [[0.4, 'mahmoud_smug', 'Alright, my friends… you think you\'ve made your decision?'], [4.4, 'mahmoud_smug', 'Hmm. I don\'t think you\'re happy enough yet…']] },
    { slot: 'pharaoh_2_transform', scene: 'morph', dur: 10000, fx: 'laugh', lines: [[0.4, 'narrator', 'Mahmoud\'s dolphin shirt begins to glow…']] },
    { slot: 'pharaoh_3_reveal', scene: 'closeup', opt: { who: 'pharaoh', back: 'pyramid', x: FW / 2 }, dur: 10000, title: 'THE PHARAOH OF DISCORD', fx: 'shake', lines: [[0.8, 'pharaoh', 'Three thousand years I have waited… to ruin ONE group holiday.']] },
    { slot: 'pharaoh_4_test', scene: 'pharaohTest', dur: 10000, lines: [[0.3, 'pharaoh', 'The test! Couples call each other on WhatsApp, then score this country from 1 to 10.'], [4.8, 'pharaoh', 'Then girls call girls, boys call boys — and score again.']] },
    { slot: 'pharaoh_5_berserk', scene: 'berserk', dur: 10000, lines: [[0.3, 'pharaoh', 'Unhappy? Your wishlists become your escape routes on my final wheel.']] },
  ],
  final: [
    { slot: 'final_1', scene: 'finalWheel', dur: 10000, title: 'THE PROBABILITY SHOT', lines: [[0.6, 'pharaoh', 'Your satisfaction decides how safe the chosen country is: 90% at a perfect 10/10.'], [5.6, 'pharaoh', 'The rest of the wheel goes to your nominations. Let the wheel judge you.']] },
  ],
  exit: [
    { slot: 'exit_1_landing', scene: 'shipLanding', dur: 10000, title: 'BACK ON THE MOON', lines: [[0.5, 'narrator', 'The destination is decided. The Pharaoh is… napping.']] },
    { slot: 'exit_2_baby_bump', scene: 'babyBump', dur: 10000, lines: [[0.4, 'narrator', 'Leaving the spacecraft, someone very small runs straight into you…'], [3.6, 'baby', 'Oof! Sorry legends, tiny legs!']] },
    { slot: 'exit_3_market', scene: 'marketReveal', dur: 10000, lines: [[0.4, 'baby', 'The Black Market is open! Spend your coins on the REAL holiday: the Airbnb, the car DJ, no dishes…'], [5.2, 'baby', 'Pool coins with the crew — or buy a full RESTART. Follow me!']] },
  ],
  telescope: [
    { slot: 'telescope_1', scene: 'earthPins', dur: 10000, title: 'EARTHRISE', lines: [[0.6, 'narrator', 'Lisbon, Skopje, Kraków, Marrakech… somewhere down there is your next holiday.']] },
  ],
};

/** Every image slot, for the README / the crew's artists. */
export const ALL_SLOTS = Object.values(FILMS).flat().map((s) => s.slot);

// ───────────────────────── player ─────────────────────────
/**
 * Play a film. `offsetMs` skips into it (late joiners), `maxMs` trims it to the time the server
 * allows. Resolves when finished or skipped.
 */
export async function playFilm(root, name, { offsetMs = 0, maxMs = Infinity, skippable = true, crew = [], className = '' } = {}) {
  const shots = FILMS[name];
  if (!shots) return;
  await Promise.race([Promise.all(shots.map((s) => probeSlot(s.slot))), new Promise((r) => setTimeout(r, 700))]);
  return new Promise((resolve) => {
    const cv = h('canvas', { class: 'film-cv', width: FW, height: FH });
    const g = cv.getContext('2d');
    const img = h('img', { class: 'film-img', alt: '' });
    const titleEl = h('div', { class: 'cine-title display' });
    const sub = h('div', { class: 'film-sub' });
    const dots = h('div', { class: 'film-dots' }, shots.map(() => h('i')));
    const skip = skippable ? h('button', { class: 'btn ghost small cine-skip', onclick: (e) => { e.stopPropagation(); finish(); } }, 'Skip ▸') : null;
    const el = h('div', { class: `cine film ${className}`, role: 'dialog', 'aria-label': 'Cinematic' }, cv, img, h('div', { class: 'cine-bar top' }), h('div', { class: 'cine-bar bottom' }), titleEl, sub, dots, skip);
    root.appendChild(el);
    el.addEventListener('click', () => nextShot());

    let i = 0, done = false, raf = 0, shotStart = 0, S = {}, lineIdx = 0, typer = null;
    let elapsed = 0;
    while (i < shots.length - 1 && elapsed + shotMs(shots[i]) <= offsetMs) { elapsed += shotMs(shots[i]); i++; }
    const lead = Math.max(0, offsetMs - elapsed);
    const total = shots.reduce((a, s) => a + shotMs(s), 0);
    const deadline = performance.now() + Math.max(600, Math.min(maxMs, total - offsetMs));

    function finish() {
      if (done) return; done = true;
      cancelAnimationFrame(raf); clearInterval(typer);
      el.classList.add('out');
      setTimeout(() => { el.remove(); resolve(); }, 500);
    }
    function say(who, text) {
      const spk = SPEAKERS[who] || SPEAKERS.narrator;
      sub.replaceChildren();
      sub.classList.toggle('narr', !spk.spec);
      if (spk.spec) {
        const pc = h('canvas', { class: 'film-face', width: 64, height: 64 });
        const pg = pc.getContext('2d'); pg.imageSmoothingEnabled = false;
        pg.drawImage(portrait(typeof spk.spec === 'function' ? spk.spec() : spk.spec, spk.mood), 0, 0);
        pc.style.borderColor = spk.color;
        sub.append(pc);
      }
      const txt = h('span', { class: 'film-txt' });
      sub.append(h('div', { class: 'film-line' }, spk.name ? h('b', { style: { color: spk.color }, class: spk.pharaoh ? 'pharaoh' : '' }, spk.name) : null, txt));
      let k = 0; clearInterval(typer);
      typer = setInterval(() => { k += 2; txt.textContent = text.slice(0, k); if (k >= text.length) clearInterval(typer); }, 22);
    }
    function startShot(skipMs = 0) {
      const s = shots[i];
      S = {}; lineIdx = 0;
      shotStart = performance.now() - skipMs;
      [...dots.children].forEach((d, j) => d.classList.toggle('on', j <= i));
      el.dataset.shot = String(i);
      const useImg = slotState.get(s.slot) === 'ok';
      el.classList.toggle('has-img', useImg);
      if (useImg) {
        img.src = `assets/cine/${s.slot}.jpg`;
        img.getAnimations().forEach((a) => a.cancel());
        img.animate([{ transform: 'scale(1.02)', opacity: 0 }, { opacity: 1, offset: 0.06 }, { transform: 'scale(1.1)', opacity: 1 }], { duration: IMAGE_MS, fill: 'forwards', easing: 'linear' });
      }
      titleEl.textContent = s.title || '';
      titleEl.classList.toggle('show', !!s.title);
      if (s.title) titleEl.animate([{ letterSpacing: '.6em', opacity: 0 }, { letterSpacing: '.12em', opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 4200, fill: 'forwards', easing: 'ease-out' });
      sub.replaceChildren();
      if (s.fx === 'laugh') { audio.oneShot('pharaoh_laugh', 1); audio.sfx('boom'); }
      if (s.fx === 'shake') { el.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-8px,4px)' }, { transform: 'translate(7px,-5px)' }, { transform: 'translate(0,0)' }], { duration: 500, iterations: 3 }); audio.sfx('boom'); }
      if (s.scene === 'liftoff' || s.scene === 'flight') audio.sfx('whoosh');
    }
    function nextShot() {
      if (done) return;
      i++;
      if (i >= shots.length || performance.now() >= deadline) return finish();
      startShot();
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (done) return;
      if (now >= deadline) return finish();
      const s = shots[i];
      const t = (now - shotStart) / 1000, dur = shotMs(s) / 1000;
      if (t >= dur) return nextShot();
      while (lineIdx < (s.lines || []).length && t >= s.lines[lineIdx][0]) { const [, who, text] = s.lines[lineIdx++]; say(who, text); }
      if (slotState.get(s.slot) !== 'ok') {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.imageSmoothingEnabled = false;
        const sc = SCENES[s.scene];
        try { sc(g, t, s.dur / 1000, S, { crew }, s.opt || {}); } catch (e) { console.error(e); g.fillStyle = '#000'; g.fillRect(0, 0, FW, FH); }
        if (S.shake) cv.style.transform = `translate(${(Math.random() - 0.5) * S.shake * 3}px, ${(Math.random() - 0.5) * S.shake * 3}px)`;
        else cv.style.transform = '';
        // fade in/out of each shot
        const fade = Math.min(t / 0.45, (dur - t) / 0.45);
        if (fade < 1) { g.fillStyle = `rgba(0,0,0,${1 - Math.max(0, fade)})`; g.fillRect(0, 0, FW, FH); }
      }
    }
    startShot(lead);
    raf = requestAnimationFrame(frame);
  });
}

/** Live background for the title / passport screens (stars, Earth, Moon). */
export function filmBackground(cv, scene = 'space') {
  cv.width = FW; cv.height = FH;
  const g = cv.getContext('2d');
  const t0 = performance.now();
  let raf;
  const loop = (now) => {
    if (!cv.isConnected) return cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    const t = (now - t0) / 1000;
    if (scene === 'space') {
      space(g, t, { dx: -3 });
      drawGlobe(g, FW * 0.74, FH * 0.66, 118, 10 + t * 2, 28);
      moonDisc(g, FW * 0.14, FH * 0.22, 24);
    } else SCENES[scene](g, t % 20, 20, {}, {});
  };
  raf = requestAnimationFrame(loop);
}
