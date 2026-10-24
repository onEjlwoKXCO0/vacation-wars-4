// HD cyberpunk Moon campus (32 px per tile). Static albedo is baked once; neon, screens and
// holograms are "emissive" layers drawn after the lighting pass so they glow in the dark.
// Buildings and tall props are y-sorted sprites so characters can walk behind them.
import { TILE, MAP_W, MAP_H, EDGE_ROWS, BUILDINGS, SURFACES, FOUNTAIN, SHIP, PROPS, STATUE, BILLBOARD, CAFE, mulberry32 } from '../../shared/map.js';
import { drawPixelText, drawPixelTextCentered, textWidth } from './pixelfont.js';
import { shade, mix, outline, characterSheet, drawCharacter, mahmoudPortrait } from './sprites.js';

const T = TILE;
export const PW = MAP_W * T, PH = MAP_H * T;
export const MAP_PX = { w: PW, h: PH };

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}
export const R = (g, x, y, w, h, c) => { if (w <= 0 || h <= 0) return; g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
export const ell = (g, x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); g.fill(); };
export const glow = (g, x, y, r, rgb, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.4, `rgba(${rgb},${a * 0.35})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
const hexRGB = (hex) => { const n = parseInt(hex.slice(1, 7), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
const flick = (t, seed, rate = 1) => { const k = Math.sin(t / (90 / rate) + seed * 7.1) + Math.sin(t / (37 / rate) + seed * 3.3); return k > 1.85 ? 0.35 : 1; };

const hexRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };

/** Neon text: pixel font with a coloured halo. */
export function neonText(g, text, cx, y, color, scale = 2, a = 1) {
  const w = textWidth(text, scale);
  g.save(); g.globalAlpha = a * 0.35; g.shadowColor = color; g.shadowBlur = 10 * scale;
  drawPixelTextCentered(g, text, cx, y, color, scale); g.restore();
  g.save(); g.globalAlpha = a; drawPixelTextCentered(g, text, cx, y, mix(color, '#ffffff', 0.55), scale); g.restore();
  return w;
}
export function neonRect(g, x, y, w, h, color, a = 1, lw = 2) {
  g.save(); g.globalAlpha = a; g.shadowColor = color; g.shadowBlur = 12; g.strokeStyle = color; g.lineWidth = lw; g.strokeRect(x + 0.5, y + 0.5, w, h);
  g.shadowBlur = 0; g.strokeStyle = mix(color, '#ffffff', 0.6); g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w, h); g.restore();
}

// ───────────────────────────── entry ─────────────────────────────

let campusCache = null;
/** The campus art is big: build it once and share it between the world and the cinematics. */
export function campusArt() { return campusCache || (campusCache = buildCampusArt()); }

export function buildCampusArt() {
  const rnd = mulberry32(4242);
  const [ground, g] = canvas(PW, PH);
  const lights = [];
  const surfaceAt = new Array(MAP_W * MAP_H).fill('regolith');
  for (const s of SURFACES) for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) if (y >= 0 && y < MAP_H) surfaceAt[y * MAP_W + x] = s.kind;
  const at = (tx, ty) => (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H ? 'void' : surfaceAt[ty * MAP_W + tx]);
  const occupied = (tx, ty) => tx < 1 || ty < EDGE_ROWS + 1 || tx >= MAP_W - 1 || ty >= MAP_H - 1 || at(tx, ty) !== 'regolith' ||
    BUILDINGS.some((b) => tx >= b.x - 1 && tx < b.x + b.w + 1 && ty >= b.y - 1 && ty < b.y + b.h + 2);

  drawRegolith(g, rnd);
  drawCraters(g, rnd, occupied);
  drawEdge(g, rnd);
  drawSurfaces(g, at, rnd, lights);
  drawFountainBase(g);
  for (const b of BUILDINGS) dropShadow(g, b);
  dropShadow(g, { x: SHIP.x + 1, y: SHIP.y + 2, w: SHIP.w - 2, h: SHIP.h - 2 });

  // buildings → y-sorted sprites with an emissive pass
  const buildings = BUILDINGS.map((b) => buildBuilding(b, lights));
  const props = PROPS.map((p) => { const o = buildProp(p, lights); if (o) { o.cx = p.x * T; o.cy = p.y * T; } return o; }).filter(Boolean);
  props.push(statueProp(lights), shipProp(lights), billboardProp(lights), fountainSculpture());

  // street lights from emissive props are already pushed; global accents:
  lights.push({ x: FOUNTAIN.cx * T, y: FOUNTAIN.cy * T, r: 190, color: '90,220,255', a: 0.9 });
  lights.push({ x: 42 * T, y: 7 * T, r: 300, color: '110,150,255', a: 0.55 });
  lights.push({ x: (SHIP.x + SHIP.w / 2) * T, y: (SHIP.y + SHIP.h / 2) * T, r: 360, color: '140,180,255', a: 0.45 });
  const groundFx = groundAnimations();
  const lightmap = buildLightmap(lights);
  return { ground, lightmap, lights, buildings, props, groundFx };
}

// ───────────────────────────── terrain ─────────────────────────────

function drawRegolith(g, rnd) {
  const base = g.createLinearGradient(0, 0, 0, PH);
  base.addColorStop(0, '#5b5f6e'); base.addColorStop(1, '#4a4d5b');
  g.fillStyle = base; g.fillRect(0, 0, PW, PH);
  // grain
  const img = g.getImageData(0, 0, PW, PH); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n + 2; }
  g.putImageData(img, 0, 0);
  // dust ripples & pebbles
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * PW, y = rnd() * PH, s = rnd();
    if (s < 0.6) R(g, x, y, 2, 2, s < 0.3 ? '#6c7080' : '#40434f');
    else if (s < 0.9) { R(g, x, y, 4, 3, '#3b3e49'); R(g, x, y, 3, 1, '#7a7e8e'); }
    else { ell(g, x, y, 5, 3, '#43465294'); ell(g, x - 1, y - 1, 4, 2, '#73788a80'); }
  }
}

function drawCraters(g, rnd, occupied) {
  for (let i = 0; i < 70; i++) {
    const tx = Math.floor(rnd() * MAP_W), ty = Math.floor(rnd() * MAP_H);
    const r = 0.6 + rnd() * 2.2;
    let free = true;
    for (let y = Math.floor(ty - r); y <= ty + r && free; y++) for (let x = Math.floor(tx - r); x <= tx + r; x++) if (occupied(x, y)) { free = false; break; }
    if (free) crater(g, (tx + 0.5) * T, (ty + 0.5) * T, r * T);
  }
}
function crater(g, x, y, r) {
  ell(g, x + 2, y + 3, r * 1.06, r * 0.72, 'rgba(20,22,32,.35)');
  ell(g, x, y, r, r * 0.7, '#3d404c');
  ell(g, x + r * 0.08, y + r * 0.08, r * 0.82, r * 0.56, '#4a4e5c');
  ell(g, x - r * 0.15, y - r * 0.12, r * 0.55, r * 0.34, '#343743');
  g.strokeStyle = 'rgba(160,166,186,.55)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y + 1, r, r * 0.7, 0, 0.15, Math.PI - 0.15); g.stroke();
}

function drawEdge(g, rnd) {
  // the crater rim: everything above EDGE_ROWS is the drop into space (sky shows through, transparent)
  const ey = EDGE_ROWS * T;
  g.clearRect(0, 0, PW, ey - 10);
  for (let x = 0; x < PW; x += 4) { const h = 6 + Math.sin(x * 0.05) * 4 + rnd() * 6; R(g, x, ey - 10 - h, 4, h + 10, x % 8 ? '#3c3f4c' : '#454957'); }
  R(g, 0, ey - 2, PW, 4, '#2a2d38');
  // neon railing along the rim
  for (let x = 8; x < PW; x += 48) { R(g, x, ey + 4, 4, 22, '#2b2f3c'); R(g, x, ey + 4, 1, 22, '#5d6478'); }
  R(g, 0, ey + 6, PW, 3, '#3a4152'); R(g, 0, ey + 6, PW, 1, '#8a93ad');
  // overlook glass balcony
  const ox = 35 * T, ow = 14 * T;
  g.clearRect(ox + T, ey - 30, ow - 2 * T, 30);
  R(g, ox + T, ey - 34, ow - 2 * T, 4, '#5ff2ff55');
  for (let x = ox + T; x < ox + ow - T; x += 32) R(g, x, ey - 34, 2, 40, '#8ad8ff66');
}

function drawSurfaces(g, at, rnd, lights) {
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const k = at(tx, ty);
    if (k === 'regolith' || k === 'void') continue;
    const x = tx * T, y = ty * T;
    if (k === 'path') pathTile(g, x, y, tx, ty, rnd);
    if (k === 'plaza') plazaTile(g, x, y, tx, ty, rnd);
    if (k === 'pad') padTile(g, x, y, tx, ty);
    if (k === 'garden') gardenTile(g, x, y, rnd);
  }
  // edges: raised curbs with neon strips where path/plaza meets regolith
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const k = at(tx, ty);
    if (k === 'regolith' || k === 'void') continue;
    const x = tx * T, y = ty * T;
    const nb = (dx, dy) => at(tx + dx, ty + dy);
    const neon = k === 'path' ? '#2fd6ff' : k === 'pad' ? '#ffb547' : k === 'plaza' ? '#c77dff' : null;
    if (nb(0, -1) === 'regolith') { R(g, x, y, T, 3, '#20232d'); if (neon) R(g, x, y + 3, T, 1, neon); }
    if (nb(0, 1) === 'regolith') { R(g, x, y + T - 4, T, 4, '#1b1e27'); if (neon) R(g, x, y + T - 5, T, 1, neon); }
    if (nb(-1, 0) === 'regolith') { R(g, x, y, 3, T, '#20232d'); if (neon) R(g, x + 3, y, 1, T, neon); }
    if (nb(1, 0) === 'regolith') { R(g, x + T - 3, y, 3, T, '#1b1e27'); if (neon) R(g, x + T - 4, y, 1, T, neon); }
  }
  // lane markings on the long roads
  for (let tx = 3; tx < MAP_W - 3; tx += 2) { R(g, tx * T + 4, 17.5 * T - 1, 20, 2, '#e9eef8aa'); R(g, tx * T + 4, 43 * T - 1, 20, 2, '#e9eef8aa'); }
  for (let ty = 20; ty < 55; ty += 2) R(g, 19.5 * T - 1, ty * T + 4, 2, 20, '#e9eef8aa');
  for (let ty = 20; ty < 42; ty += 2) R(g, 64.5 * T - 1, ty * T + 4, 2, 20, '#e9eef8aa');
  // inlaid rings around the fountain
  g.strokeStyle = 'rgba(199,125,255,.55)'; g.lineWidth = 2;
  for (const r of [4.2, 6.5]) { g.beginPath(); g.ellipse(FOUNTAIN.cx * T, FOUNTAIN.cy * T, r * T, r * T * 0.8, 0, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = 'rgba(95,242,255,.25)';
  for (let a = 0; a < 16; a++) { const an = (a / 16) * Math.PI * 2; g.beginPath(); g.moveTo(FOUNTAIN.cx * T + Math.cos(an) * 4.2 * T, FOUNTAIN.cy * T + Math.sin(an) * 3.4 * T); g.lineTo(FOUNTAIN.cx * T + Math.cos(an) * 6.5 * T, FOUNTAIN.cy * T + Math.sin(an) * 5.2 * T); g.stroke(); }
  // landing circle on the pad
  const px = (SHIP.x + SHIP.w / 2) * T, py = (SHIP.y + SHIP.h / 2 + 0.5) * T;
  g.strokeStyle = '#ffb547'; g.lineWidth = 4; g.setLineDash([22, 12]); g.beginPath(); g.ellipse(px, py, 9.5 * T, 5.4 * T, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  g.strokeStyle = 'rgba(255,181,71,.4)'; g.lineWidth = 2; g.beginPath(); g.ellipse(px, py, 10.3 * T, 6 * T, 0, 0, Math.PI * 2); g.stroke();
  drawPixelTextCentered(g, 'PAD 01  MAHMOUD-1', 59 * T, 57 * T + 8, '#ffb547', 3);
  // alley graffiti
  drawPixelText(g, 'NO REFUNDS', 5 * T, 55.2 * T, '#ff4fd866', 2);
  drawPixelText(g, 'VW4', 40 * T, 55.4 * T, '#5ff2ff55', 3);
}

function pathTile(g, x, y, tx, ty, rnd) {
  R(g, x, y, T, T, '#2a2e3a');
  R(g, x, y, T, 1, '#363b4a'); R(g, x, y, 1, T, '#323745');
  for (let i = 0; i < 10; i++) R(g, x + rnd() * 30, y + rnd() * 30, 2, 1, rnd() < 0.5 ? '#333847' : '#24273200');
  if ((tx * 7 + ty * 3) % 11 === 0) { R(g, x + 8, y + 10, 14, 10, '#262935'); R(g, x + 9, y + 11, 12, 1, '#3d4252'); for (let i = 0; i < 3; i++) R(g, x + 10, y + 13 + i * 2, 10, 1, '#1f222c'); }
  if ((tx * 5 + ty * 13) % 17 === 0) R(g, x + 4, y + 22, 9, 3, '#1f222b');
}
function plazaTile(g, x, y, tx, ty, rnd) {
  const alt = (tx + ty) % 2;
  R(g, x, y, T, T, alt ? '#3b3f52' : '#383c4e');
  // hex-ish plates
  R(g, x + 1, y + 1, T - 2, T - 2, alt ? '#41465b' : '#3d4256');
  R(g, x + 1, y + 1, T - 2, 1, '#555b73'); R(g, x + 1, y + 1, 1, T - 2, '#4f556c');
  R(g, x + 1, y + T - 2, T - 2, 1, '#2c3040'); R(g, x + T - 2, y + 1, 1, T - 2, '#2e3243');
  if ((tx * 11 + ty * 7) % 9 === 0) { R(g, x + 14, y + 14, 4, 4, '#2a2e3d'); R(g, x + 15, y + 15, 2, 2, '#5ff2ff66'); }
  if (rnd() < 0.15) R(g, x + rnd() * 26, y + rnd() * 26, 5, 1, '#4b5168');
}
function padTile(g, x, y, tx, ty) {
  R(g, x, y, T, T, '#30333f');
  R(g, x + 1, y + 1, T - 2, T - 2, '#363a47');
  for (const [cx, cy] of [[3, 3], [28, 3], [3, 28], [28, 28]]) R(g, x + cx, y + cy, 2, 2, '#4b5060');
  R(g, x, y, T, 1, '#454a59');
  const edgeY = ty === 44 || ty === 57, edgeX = tx === 44 || tx === 73;
  if (edgeY || edgeX) for (let i = 0; i < T; i += 8) { if (edgeY) R(g, x + i, y + (ty === 44 ? 0 : T - 6), 4, 6, (Math.floor((x + i) / 8) % 2) ? '#ffb547' : '#1b1b22'); if (edgeX) R(g, x + (tx === 44 ? 0 : T - 6), y + i, 6, 4, (Math.floor((y + i) / 8) % 2) ? '#ffb547' : '#1b1b22'); }
}
function gardenTile(g, x, y, rnd) {
  R(g, x, y, T, T, '#123a3a');
  for (let i = 0; i < 26; i++) { const c = rnd(); R(g, x + rnd() * 31, y + rnd() * 31, 2, 2, c < 0.5 ? '#1a5a52' : c < 0.85 ? '#0e2d30' : '#3cf2c0'); }
  for (let i = 0; i < 3; i++) { const bx = x + rnd() * 28, by = y + rnd() * 28; R(g, bx, by, 1, 3, '#2a8a6a'); R(g, bx + 2, by + 1, 1, 2, '#2a8a6a'); }
}

function drawFountainBase(g) {
  const x = FOUNTAIN.cx * T, y = FOUNTAIN.cy * T, r = FOUNTAIN.r * T, ry = r * 0.8;
  ell(g, x + 4, y + 12, r + 22, ry + 16, 'rgba(8,10,20,.4)');
  // outer stone rim with gold inlay and benches of light
  ell(g, x, y, r + 16, ry + 13, '#4a5068'); ell(g, x, y - 3, r + 14, ry + 11, '#6c7591'); ell(g, x, y - 4, r + 11, ry + 8, '#8a93ad');
  g.strokeStyle = '#d9a83a'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y - 4, r + 12.5, ry + 9.5, 0, 0, Math.PI * 2); g.stroke();
  // water basin with a tiled mosaic floor
  ell(g, x, y, r + 4, ry + 3, '#0a2c46');
  g.save(); g.beginPath(); g.ellipse(x, y, r + 2, ry + 1, 0, 0, Math.PI * 2); g.clip();
  for (let yy = y - ry - 4; yy < y + ry + 4; yy += 8) for (let xx = x - r - 4; xx < x + r + 4; xx += 8) { const k = ((xx + yy) / 8) | 0; R(g, xx, yy, 7, 7, k % 3 === 0 ? '#11507a' : k % 3 === 1 ? '#0e4468' : '#135a86'); }
  for (let i = 0; i < 8; i++) { const a2 = (i / 8) * Math.PI * 2; g.strokeStyle = 'rgba(240,195,90,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a2) * r, y + Math.sin(a2) * ry); g.stroke(); }
  g.restore();
  // rim nozzles
  for (let i = 0; i < 12; i++) { const a2 = (i / 12) * Math.PI * 2; ell(g, x + Math.cos(a2) * (r + 6), y - 4 + Math.sin(a2) * (ry + 4), 3, 2, '#c9ced9'); }
}

function dropShadow(g, b) {
  const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T;
  g.fillStyle = 'rgba(8,10,20,.45)';
  g.beginPath(); g.moveTo(x + 6, y + h); g.lineTo(x + w + 18, y + h); g.lineTo(x + w + 18, y + h + 16); g.lineTo(x + 6, y + h + 12); g.closePath(); g.fill();
  R(g, x + w, y + 14, 18, h, 'rgba(8,10,20,.35)');
}

// ───────────────────────────── buildings ─────────────────────────────

/**
 * Each building is drawn into its own canvas: the footprint is the bottom part of the canvas,
 * with `top` tiles of extra room above for towers and signs.
 */
function buildBuilding(b, lights) {
  const spec = BUILDING_ART[b.id] || BUILDING_ART[b.kind];
  const top = spec ? spec.top || 2 : 2;
  const W = b.w * T, H = (b.h + top) * T;
  const [c, g] = canvas(W, H);
  const ox = b.x * T, oy = (b.y - top) * T;
  const L = (x, y, r, color, a = 0.9) => lights.push({ x: ox + x, y: oy + y, r, color, a });
  const ctx = { g, W, H, top: top * T, fh: b.h * T, b, L, emissive: [] };
  if (spec) spec.draw(ctx);
  outline(c, '#0b0a14');
  return {
    id: b.id, canvas: c, x: ox, y: oy, sortY: (b.y + b.h) * T - 2,
    emissive: (dctx, t) => { dctx.save(); dctx.translate(ox, oy); for (const e of ctx.emissive) e(dctx, t); dctx.restore(); },
  };
}

// helpers for facades
function wallBlock(g, x, y, w, h, base, { light = 0.12, dark = -0.25, texture = null, rnd = mulberry32(x * 7 + y) } = {}) {
  R(g, x, y, w, h, base);
  R(g, x, y, w, 2, shade(base, light)); R(g, x, y + h - 3, w, 3, shade(base, dark));
  R(g, x, y, 2, h, shade(base, light * 0.6)); R(g, x + w - 3, y, 3, h, shade(base, dark * 0.8));
  if (texture === 'plaster') for (let i = 0; i < w * h / 60; i++) R(g, x + rnd() * w, y + rnd() * h, 2, 1, shade(base, (rnd() - 0.5) * 0.12));
  if (texture === 'brick') for (let yy = y + 2; yy < y + h - 3; yy += 6) { const off = ((yy - y) / 6) % 2 ? 6 : 0; R(g, x, yy + 5, w, 1, shade(base, -0.3)); for (let xx = x + off; xx < x + w; xx += 12) R(g, xx, yy, 1, 6, shade(base, -0.3)); for (let xx = x + off + 2; xx < x + w - 4; xx += 12) if (rnd() < 0.3) R(g, xx, yy + 1, 8, 4, shade(base, (rnd() - 0.5) * 0.15)); }
  if (texture === 'stone') for (let yy = y + 2; yy < y + h - 3; yy += 8) for (let xx = x + ((yy / 8) % 2) * 7; xx < x + w - 2; xx += 14) { R(g, xx, yy, 13, 7, shade(base, (rnd() - 0.5) * 0.2)); R(g, xx, yy, 13, 1, shade(base, 0.15)); R(g, xx, yy + 6, 13, 1, shade(base, -0.3)); }
  if (texture === 'metal') for (let xx = x + 14; xx < x + w - 2; xx += 16) { R(g, xx, y + 2, 1, h - 5, shade(base, -0.25)); R(g, xx + 1, y + 2, 1, h - 5, shade(base, 0.1)); }
}
function roofTiles(g, x, y, w, h, c1, { rows = 8, ridge = null, rnd = mulberry32(x + y) } = {}) {
  R(g, x, y, w, h, c1);
  for (let yy = y; yy < y + h; yy += rows) {
    R(g, x, yy + rows - 2, w, 2, shade(c1, -0.28));
    for (let xx = x + ((yy - y) / rows) % 2 * 5; xx < x + w; xx += 10) { R(g, xx, yy, 1, rows - 2, shade(c1, -0.2)); R(g, xx + 1, yy, 7, 1, shade(c1, 0.18)); if (rnd() < 0.12) R(g, xx + 2, yy + 1, 5, rows - 4, shade(c1, (rnd() - 0.5) * 0.25)); }
  }
  if (ridge) { R(g, x, y, w, 4, ridge); R(g, x, y, w, 1, shade(ridge, 0.3)); }
  R(g, x, y + h - 3, w, 3, shade(c1, -0.45));
}
function windowLit(g, x, y, w, h, frame, { warm = true, arch = false, shutters = null, sill = null, mull = true, curtain = null } = {}, E, lights = null) {
  R(g, x - 2, y - 2, w + 4, h + 4, frame);
  const glass = warm ? '#ffcf7a' : '#7fe8ff';
  const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, shade(glass, 0.25)); gr.addColorStop(1, shade(glass, -0.25));
  g.fillStyle = gr;
  if (arch) { g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); g.fill(); }
  else g.fillRect(x, y, w, h);
  if (curtain) { R(g, x, y, 3, h, curtain); R(g, x + w - 3, y, 3, h, curtain); }
  if (mull) { R(g, x + Math.floor(w / 2), y + (arch ? w / 3 : 0), 1, h - (arch ? w / 3 : 0), frame); R(g, x, y + Math.floor(h / 2), w, 1, frame); }
  R(g, x + 1, y + 1, 2, Math.max(2, h / 3), 'rgba(255,255,255,.55)');
  if (shutters) { R(g, x - 7, y - 1, 5, h + 2, shutters); R(g, x + w + 2, y - 1, 5, h + 2, shutters); for (let i = 0; i < h; i += 3) { R(g, x - 7, y + i, 5, 1, shade(shutters, -0.3)); R(g, x + w + 2, y + i, 5, 1, shade(shutters, -0.3)); } }
  if (sill) { R(g, x - 3, y + h + 2, w + 6, 3, sill); R(g, x - 3, y + h + 2, w + 6, 1, shade(sill, 0.3)); }
  if (E) E.push((d, t) => { d.save(); d.globalAlpha = 0.25 + 0.08 * Math.sin(t / 900 + x); d.fillStyle = warm ? '#ffd27a' : '#7fe8ff'; d.fillRect(x, y, w, h); d.restore(); });
  if (lights) lights(x + w / 2, y + h / 2 + 20, 70, warm ? '255,200,120' : '120,220,255', 0.6);
}
function doorWay(g, cx, by, w, h, wood, frame, { arch = false, horseshoe = false, glass = false } = {}) {
  const x = cx - w / 2, y = by - h;
  R(g, x - 4, y - 4, w + 8, h + 4, frame);
  if (horseshoe || arch) { g.fillStyle = frame; g.beginPath(); g.arc(cx, y + w / 2, w / 2 + 4, Math.PI, 0); g.fill(); }
  g.fillStyle = glass ? '#3fd0ff' : wood;
  if (horseshoe || arch) { g.beginPath(); g.moveTo(x, by); g.lineTo(x, y + w / 2); g.arc(cx, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, by); g.closePath(); g.fill(); }
  else g.fillRect(x, y, w, h);
  if (!glass) { R(g, cx - 1, y + 4, 2, h - 4, shade(wood, -0.35)); for (let yy = y + 8; yy < by - 4; yy += 10) { R(g, x + 3, yy, w / 2 - 5, 7, shade(wood, 0.12)); R(g, cx + 2, yy, w / 2 - 5, 7, shade(wood, 0.12)); } R(g, cx - 5, y + h / 2, 2, 3, '#f0c35a'); R(g, cx + 3, y + h / 2, 2, 3, '#f0c35a'); }
  else { R(g, x + 2, y + 2, 3, h - 4, 'rgba(255,255,255,.5)'); R(g, cx - 1, y, 2, h, '#1b2a3a'); }
  R(g, x - 6, by - 2, w + 12, 3, shade(frame, -0.3));
}
function plantPot(g, x, y, c = '#b5562a', leaf = '#3f8a45') { R(g, x, y, 12, 10, c); R(g, x - 1, y, 14, 3, shade(c, 0.15)); R(g, x + 1, y + 9, 10, 1, shade(c, -0.3)); ell(g, x + 6, y - 5, 9, 7, shade(leaf, -0.2)); ell(g, x + 4, y - 7, 6, 5, leaf); ell(g, x + 3, y - 9, 3, 2, shade(leaf, 0.3)); }
function orangeTree(g, x, y) { plantPot(g, x, y, '#c2652e', '#2f7a3c'); for (const [dx, dy] of [[0, -8], [6, -4], [-4, -3], [3, -11]]) { R(g, x + 6 + dx, y + dy, 3, 3, '#ff9f2a'); R(g, x + 6 + dx, y + dy, 1, 1, '#ffe08a'); } }
// Accurate little flags (36×24) for the four embassies, drawn once and waved slice by slice.
const FLAG_W = 36, FLAG_H = 24;
const flagCache = {};
export function flagCanvas(nation) {
  if (flagCache[nation]) return flagCache[nation];
  const [c, g] = canvas(FLAG_W, FLAG_H);
  const W = FLAG_W, H = FLAG_H;
  if (nation === 'portugal') {
    R(g, 0, 0, W * 0.4, H, '#046a38'); R(g, W * 0.4, 0, W * 0.6, H, '#da291c');
    const cx = Math.round(W * 0.4), cy = H / 2;
    g.strokeStyle = '#ffe900'; g.lineWidth = 1.4; g.beginPath(); g.arc(cx, cy, 6.2, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(cx, cy, 6.2, 2.4, 0, 0, Math.PI * 2); g.stroke();
    R(g, cx - 3, cy - 3.5, 6, 7, '#ffffff'); R(g, cx - 2.5, cy - 3, 5, 6, '#da291c'); R(g, cx - 1.5, cy - 2, 3, 4, '#ffffff');
    R(g, cx - 0.5, cy - 1.5, 1, 1, '#002d72'); R(g, cx - 0.5, cy + 0.5, 1, 1, '#002d72');
  } else if (nation === 'macedonia') {
    R(g, 0, 0, W, H, '#d20000');
    const cx = W / 2, cy = H / 2;
    g.fillStyle = '#ffe600';
    const rays = [[0, 0], [W / 2, 0], [W, 0], [W, H / 2], [W, H], [W / 2, H], [0, H], [0, H / 2]];
    for (const [ex, ey] of rays) {
      const ang = Math.atan2(ey - cy, ex - cx), spread = (ex === W / 2 || ey === H / 2) ? 0.16 : 0.12, len = Math.hypot(ex - cx, ey - cy) + 4;
      g.beginPath(); g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(ang - spread) * len, cy + Math.sin(ang - spread) * len);
      g.lineTo(cx + Math.cos(ang + spread) * len, cy + Math.sin(ang + spread) * len); g.closePath(); g.fill();
    }
    g.fillStyle = '#d20000'; g.beginPath(); g.arc(cx, cy, 5.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffe600'; g.beginPath(); g.arc(cx, cy, 4.2, 0, Math.PI * 2); g.fill();
  } else if (nation === 'poland') {
    R(g, 0, 0, W, H / 2, '#ffffff'); R(g, 0, H / 2, W, H / 2, '#dc143c');
  } else if (nation === 'morocco') {
    R(g, 0, 0, W, H, '#c1272d');
    const cx = W / 2, cy = H / 2 + 0.5, r = 7;
    const pts = [0, 1, 2, 3, 4].map((i) => [cx + Math.sin((i * 4 * Math.PI) / 5) * r, cy - Math.cos((i * 4 * Math.PI) / 5) * r]);
    g.strokeStyle = '#006233'; g.lineWidth = 1.6; g.lineJoin = 'miter';
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
  } else { R(g, 0, 0, W, H, '#3a4152'); }
  return (flagCache[nation] = c);
}
function holoFlagStrip(g, x, y, nation) { g.drawImage(flagCanvas(nation), x, y, 24, 16); }

const BUILDING_ART = {
  // ── Portuguese Embassy: azulejo palace, terracotta roof, bell tower ──
  emb_pt: { top: 3, draw({ g, W, top, fh, L, emissive: E }) {
    const roofH = fh * 0.42, fy = top + roofH, facH = fh - roofH;
    roofTiles(g, 6, top + 10, W - 12, roofH, '#b9542c', { ridge: '#8a3a1e' });
    // bell tower
    const tx = W - 96; wallBlock(g, tx, top - 56, 52, 70, '#f1ece2', { texture: 'plaster' });
    roofTiles(g, tx - 6, top - 74, 64, 22, '#b9542c', { rows: 6 }); R(g, tx + 23, top - 92, 6, 20, '#3a3f52'); R(g, tx + 19, top - 92, 14, 3, '#3a3f52');
    windowLit(g, tx + 16, top - 44, 20, 26, '#2a5db0', { arch: true, warm: true }, E);
    R(g, tx + 21, top - 40, 10, 10, '#c49324');
    // facade
    wallBlock(g, 0, fy, W, facH, '#f1ece2', { texture: 'plaster' });
    // azulejo band
    for (let y = fy + 8; y < fy + facH - 12; y += 8) for (let x = 6; x < W - 6; x += 8) { const k = ((x + y) / 8) % 2; R(g, x, y, 8, 8, k ? '#f4f6fb' : '#dfe8f7'); R(g, x + 2, y + 2, 4, 4, '#2a5db0'); R(g, x + 3, y + 3, 2, 2, k ? '#9ec0ff' : '#ffffff'); }
    R(g, 0, fy, W, 6, '#e4dccd'); R(g, 0, fy + facH - 14, W, 14, '#cfc6b4');
    // windows with blue shutters, balcony with wrought iron
    for (let i = 0; i < 5; i++) { if (i === 2) continue; const wx = 26 + i * ((W - 70) / 4); windowLit(g, wx, fy + 24, 26, 40, '#efe7d6', { arch: true, shutters: '#2a5db0', sill: '#cfc6b4', curtain: '#f2d27a' }, E, L); }
    R(g, W / 2 - 60, fy + 70, 120, 4, '#2b2f3c'); for (let x = W / 2 - 58; x < W / 2 + 60; x += 6) R(g, x, fy + 58, 2, 14, '#2b2f3c');
    doorWay(g, W / 2, fy + facH - 4, 40, 62, '#6a3a1e', '#cfc6b4', { arch: true });
    orangeTree(g, W / 2 - 52, fy + facH - 14); orangeTree(g, W / 2 + 40, fy + facH - 14);
    // neon sign + holo flag
    E.push((d, t) => { neonText(d, 'EMBAIXADA DE PORTUGAL', W / 2, fy + 6, '#5ff2ff', 2, flick(t, 1)); holoFlag(d, 18, fy - 22, 'portugal', t); });
    L(W / 2, fy + facH, 160, '255,190,110', 0.9); L(W / 2, fy + 10, 140, '95,242,255', 0.5);
  } },
  // ── Macedonian Embassy: Ohrid house, stone base, white upper floor with timber beams ──
  emb_mk: { top: 2, draw({ g, W, top, fh, L, emissive: E }) {
    const roofH = fh * 0.38, fy = top + roofH;
    roofTiles(g, 0, top, W, roofH + 8, '#a5462a', { ridge: '#7a2e1a' });
    R(g, 40, top + 10, 18, 26, '#8a8d99'); R(g, 38, top + 8, 22, 4, '#6b6e7a'); // chimney
    const upH = (fh - roofH) * 0.5;
    wallBlock(g, -0, fy, W, upH + 8, '#f6f3ec', { texture: 'plaster' });
    for (let x = 0; x < W; x += 34) R(g, x, fy, 5, upH + 8, '#4a2e1c');
    R(g, 0, fy + upH / 2, W, 4, '#4a2e1c'); R(g, 0, fy, W, 5, '#3a2416');
    for (let i = 0; i < 6; i++) { const wx = 14 + i * ((W - 50) / 5); windowLit(g, wx, fy + 12, 20, 24, '#4a2e1c', { warm: true, sill: '#4a2e1c' }, E, L); for (let k = 0; k < 4; k++) { R(g, wx - 1 + k * 6, fy + 38, 4, 4, '#e54b4b'); R(g, wx + k * 6, fy + 41, 3, 2, '#3f8a45'); } }
    const gy = fy + upH + 8, gh = fh - roofH - upH - 8;
    wallBlock(g, 0, gy, W, gh, '#b7b0a2', { texture: 'stone' });
    R(g, 0, gy, W, 6, '#3a2416');
    for (const i of [0, 1, 3, 4]) windowLit(g, 22 + i * ((W - 70) / 4), gy + 20, 22, 26, '#6b5a44', { warm: true, arch: true }, E);
    doorWay(g, W / 2, fh + top - 4, 40, 54, '#5a3418', '#8a8070', { arch: true });
    E.push((d, t) => { neonText(d, 'EMBASSY OF NORTH MACEDONIA', W / 2, fy - 18, '#ffd23a', 2, flick(t, 2)); holoFlag(d, W - 46, fy - 30, 'macedonia', t); });
    L(W / 2, fh + top, 160, '255,180,100', 0.9);
  } },
  // ── Polish Embassy: red brick town hall, attic arcade, copper spire with clock ──
  emb_pl: { top: 4, draw({ g, W, top, fh, L, emissive: E }) {
    const sx = W / 2 - 26;
    // spire
    g.fillStyle = '#3f8a6a'; g.beginPath(); g.moveTo(W / 2, top - 120); g.lineTo(sx + 6, top - 40); g.lineTo(sx + 46, top - 40); g.closePath(); g.fill();
    g.fillStyle = '#5fb08a'; g.beginPath(); g.moveTo(W / 2, top - 120); g.lineTo(sx + 6, top - 40); g.lineTo(W / 2 - 4, top - 40); g.closePath(); g.fill();
    R(g, W / 2 - 1, top - 132, 2, 14, '#f0c35a'); R(g, W / 2 - 5, top - 128, 10, 2, '#f0c35a');
    wallBlock(g, sx, top - 42, 52, 60, '#a8432f', { texture: 'brick' });
    ell(g, W / 2, top - 14, 15, 15, '#f4f6fb'); ell(g, W / 2, top - 14, 12, 12, '#fffbe8');
    E.push((d, t) => { const a = (t / 1000) % (Math.PI * 2); d.strokeStyle = '#1b1b22'; d.lineWidth = 2; d.beginPath(); d.moveTo(W / 2, top - 14); d.lineTo(W / 2 + Math.cos(a) * 9, top - 14 + Math.sin(a) * 9); d.moveTo(W / 2, top - 14); d.lineTo(W / 2 + Math.cos(a / 12) * 6, top - 14 + Math.sin(a / 12) * 6); d.stroke(); });
    // attic with blind arcades
    const roofH = fh * 0.3;
    roofTiles(g, 0, top, W, roofH, '#7a3a2a', { ridge: '#5a2a1e' });
    const ay = top + roofH - 6;
    wallBlock(g, 0, ay, W, 30, '#e8dcc6', { texture: 'plaster' });
    for (let x = 8; x < W - 16; x += 22) { R(g, x, ay + 8, 16, 18, '#cdbfa5'); g.fillStyle = '#cdbfa5'; g.beginPath(); g.arc(x + 8, ay + 8, 8, Math.PI, 0); g.fill(); R(g, x + 4, ay + 10, 8, 16, '#a89878'); }
    for (let x = 0; x < W; x += 22) { g.fillStyle = '#e8dcc6'; g.beginPath(); g.moveTo(x, ay); g.lineTo(x + 11, ay - 12); g.lineTo(x + 22, ay); g.fill(); }
    const fy = ay + 30, fhh = fh + top - fy;
    wallBlock(g, 0, fy, W, fhh, '#a8432f', { texture: 'brick' });
    for (let i = 0; i < 6; i++) windowLit(g, 16 + i * ((W - 48) / 5), fy + 12, 20, 30, '#e8dcc6', { warm: true, sill: '#e8dcc6' }, E, L);
    // arcade ground floor
    const gy = fy + fhh - 64;
    R(g, 0, gy, W, 64, '#8f3626');
    for (let x = 6; x < W - 30; x += 46) { R(g, x, gy + 10, 36, 54, '#2a1a16'); g.fillStyle = '#2a1a16'; g.beginPath(); g.arc(x + 18, gy + 10, 18, Math.PI, 0); g.fill(); g.fillStyle = 'rgba(255,190,110,.25)'; g.fillRect(x + 2, gy + 20, 32, 44); }
    doorWay(g, W / 2, fh + top - 4, 40, 56, '#3a2416', '#e8dcc6', { arch: true });
    E.push((d, t) => { neonText(d, 'AMBASADA RP', W / 2, ay + 2, '#ff3b5c', 2, flick(t, 3)); holoFlag(d, 12, ay - 30, 'poland', t); });
    L(W / 2, fh + top, 170, '255,200,140', 0.9);
  } },
  // ── Moroccan Embassy: ochre riad, zellige band, green tiles, horseshoe door, lanterns ──
  emb_ma: { top: 2, draw({ g, W, top, fh, L, emissive: E }) {
    const roofH = fh * 0.4;
    // roof terrace with tiled parapet
    R(g, 0, top, W, roofH, '#c98a4a'); for (let i = 0; i < 40; i++) R(g, (i * 37) % W, top + 6 + ((i * 13) % (roofH - 10)), 10, 6, '#b97a3c');
    for (let x = 0; x < W; x += 12) { R(g, x, top + roofH - 14, 12, 10, (x / 12) % 2 ? '#1e7a4a' : '#2b9a5e'); R(g, x, top + roofH - 14, 12, 2, '#5fd08a'); }
    for (let x = 0; x < W; x += 16) { g.fillStyle = '#d99a5a'; g.beginPath(); g.moveTo(x, top + 6); g.lineTo(x + 8, top - 4); g.lineTo(x + 16, top + 6); g.fill(); }
    plantPot(g, 24, top + 22, '#b5562a', '#3f8a45'); plantPot(g, W - 40, top + 22, '#b5562a', '#3f8a45');
    const fy = top + roofH - 4, fhh = fh + top - fy;
    wallBlock(g, 0, fy, W, fhh, '#d9a066', { texture: 'plaster' });
    // zellige band
    for (let x = 0; x < W; x += 10) for (let r = 0; r < 2; r++) { const c = ['#1e7a4a', '#2a5db0', '#f4f6fb', '#c1272d'][(x / 10 + r) % 4]; R(g, x, fy + fhh - 34 + r * 10, 10, 10, c); R(g, x + 3, fy + fhh - 31 + r * 10, 4, 4, '#f0c35a'); }
    for (let i = 0; i < 4; i++) { const wx = 30 + i * ((W - 80) / 3); if (i === 1 || i === 2) { windowLit(g, wx, fy + 18, 22, 30, '#8a5a2e', { arch: true, warm: true }, E, L); for (let k = 0; k < 4; k++) R(g, wx + k * 6, fy + 18, 2, 30, '#5a3a1e'); } }
    doorWay(g, W / 2, fh + top - 4, 42, 62, '#1e5a3a', '#e8c48a', { horseshoe: true });
    for (let x = W / 2 - 14; x < W / 2 + 14; x += 4) R(g, x, fh + top - 62, 2, 2, '#f0c35a');
    // brass lanterns
    for (const lx of [W / 2 - 46, W / 2 + 40]) { R(g, lx, fh + top - 70, 8, 12, '#b8862b'); R(g, lx + 2, fh + top - 68, 4, 8, '#ffe08a'); R(g, lx + 3, fh + top - 76, 2, 6, '#5a3a1e'); L(lx + 4, fh + top - 40, 90, '255,170,70', 0.9); }
    E.push((d, t) => { neonText(d, 'AMBASSADE DU MAROC', W / 2, fy + 4, '#48e08f', 2, flick(t, 4)); holoFlag(d, W - 40, top - 26, 'morocco', t); for (const lx of [W / 2 - 46, W / 2 + 40]) { glow(d, lx + 4, fh + top - 62, 22, '255,180,80', 0.5 + 0.1 * Math.sin(t / 200 + lx)); } });
    L(W / 2, fh + top, 150, '255,170,80', 0.95);
  } },
  // ── Mahmoud HQ: a gold-and-glass palace — central atrium tower with MAHMOUD crown and live billboard,
  //    two lit office wings, rooftop helipad & drone, sweeping searchlights, fountains, red carpet and droid guards ──
  hq: { top: 3, draw({ g, W, top, fh, L, emissive: E }) {
    const base = top + fh, cx = W / 2;
    const wingTop = top + 70, towerL = 136, towerR = W - 136;
    const gold = '#d9a83a', goldHi = '#ffe08a', goldLo = '#8a6216';
    // wings
    for (const [x0, x1] of [[0, towerL], [towerR, W]]) {
      wallBlock(g, x0, wingTop, x1 - x0, base - wingTop, '#232a42', { texture: 'metal' });
      R(g, x0, wingTop - 8, x1 - x0, 10, '#2f3756'); R(g, x0, wingTop - 8, x1 - x0, 2, goldHi); R(g, x0, wingTop + 1, x1 - x0, 2, goldLo);
      for (let f = 0; f < 4; f++) {
        const fy = wingTop + 16 + f * 52;
        R(g, x0, fy + 38, x1 - x0, 3, gold); // gold floor band
        for (let k = 0; k < 4; k++) { const wx = x0 + 10 + k * ((x1 - x0 - 20) / 4); R(g, wx, fy, (x1 - x0 - 20) / 4 - 6, 32, '#0c1426'); R(g, wx, fy, (x1 - x0 - 20) / 4 - 6, 2, '#3a4466'); }
      }
    }
    // central atrium tower: glass curtain wall with golden fins, rising into the headroom
    const tTop = 18;
    R(g, towerL, tTop, towerR - towerL, base - tTop, '#0d1730');
    const gl = g.createLinearGradient(towerL, 0, towerR, 0); gl.addColorStop(0, 'rgba(95,242,255,.10)'); gl.addColorStop(0.5, 'rgba(255,255,255,.04)'); gl.addColorStop(1, 'rgba(95,242,255,.12)'); g.fillStyle = gl; g.fillRect(towerL, tTop, towerR - towerL, base - tTop);
    for (let x = towerL; x <= towerR; x += 16) { R(g, x - 1, tTop, 3, base - tTop, x === towerL || x === towerR ? gold : '#8a7a4a'); R(g, x, tTop, 1, base - tTop, goldHi); }
    for (let y = tTop + 24; y < base - 40; y += 24) R(g, towerL, y, towerR - towerL, 1, '#3a4466');
    // crown: stepped gold top and the MAHMOUD letters base
    R(g, towerL - 10, tTop - 6, towerR - towerL + 20, 12, gold); R(g, towerL - 10, tTop - 6, towerR - towerL + 20, 2, goldHi); R(g, towerL - 10, tTop + 4, towerR - towerL + 20, 2, goldLo);
    R(g, towerL + 14, tTop - 18, towerR - towerL - 28, 12, '#2b3148'); R(g, cx - 3, tTop - 46, 6, 30, '#8a93a8'); // spire
    // live billboard frame
    const bx = cx - 52, by = top + 54, bw = 104, bh = 72;
    R(g, bx - 6, by - 6, bw + 12, bh + 12, '#07080f'); R(g, bx - 6, by - 6, bw + 12, 2, gold); R(g, bx - 6, by + bh + 4, bw + 12, 2, gold);
    // rooftop helipad (right wing) + a dish (left wing)
    ell(g, W - 68, wingTop - 18, 40, 11, '#2f3756'); ell(g, W - 68, wingTop - 19, 34, 9, '#3a4466'); drawPixelTextCentered(g, 'H', W - 68, wingTop - 24, '#f0c35a', 2);
    for (const dx of [48]) { R(g, dx, wingTop - 26, 3, 18, '#6b7385'); g.fillStyle = '#c9ced9'; g.beginPath(); g.ellipse(dx + 1, wingTop - 28, 10, 5, -0.4, 0, Math.PI * 2); g.fill(); }
    // grand entrance: steps, glass doors with gold frame, red carpet, velvet ropes
    for (let k = 0; k < 3; k++) R(g, cx - 70 + k * 8, base - 10 + k * 3 - 6, 140 - k * 16, 4, k % 2 ? '#3a4466' : '#4b5578');
    R(g, cx - 54, base - 92, 108, 8, gold); R(g, cx - 54, base - 92, 108, 2, goldHi); // canopy
    doorWay(g, cx, base - 6, 52, 70, '#0a1226', gold, { glass: true });
    R(g, cx - 16, base - 8, 32, 8, '#a8162e'); R(g, cx - 16, base - 8, 32, 2, '#e04050');
    for (const sx of [-44, -30, 30, 44]) { R(g, cx + sx - 1, base - 22, 3, 16, goldHi); ell(g, cx + sx, base - 23, 3, 3, goldHi); }
    g.strokeStyle = '#a8162e'; g.lineWidth = 3; for (const [a1, a2] of [[-44, -30], [30, 44]]) { g.beginPath(); g.moveTo(cx + a1, base - 20); g.quadraticCurveTo(cx + (a1 + a2) / 2, base - 13, cx + a2, base - 20); g.stroke(); }
    // droid guards
    for (const gx of [cx - 82, cx + 70]) { R(g, gx, base - 30, 12, 18, '#c9ced9'); ell(g, gx + 6, base - 33, 7, 6, '#e9ecf2'); R(g, gx + 2, base - 35, 8, 3, '#07080f'); R(g, gx + 1, base - 12, 4, 8, '#8a93a8'); R(g, gx + 7, base - 12, 4, 8, '#8a93a8'); }
    // planters along the facade instead of fountains
    for (const px of [30, 80, W - 80, W - 30]) { R(g, px - 16, base - 16, 32, 12, '#3a4466'); R(g, px - 16, base - 16, 32, 2, '#6b78a8'); for (let k = 0; k < 5; k++) ell(g, px - 12 + k * 6, base - 19, 5, 4, k % 2 ? '#2f7a3c' : '#3f8a45'); }
    const pic = mahmoudPortrait('happy');
    E.push((d, t) => {
      // windows: lit rooms; two people walk the corridors from window to window (smooth, never jumping back)
      const winX = [], winY = [];
      for (const [x0, x1] of [[0, towerL], [towerR, W]]) for (let f = 0; f < 4; f++) for (let k = 0; k < 4; k++) {
        const ww = (x1 - x0 - 20) / 4 - 6, wx = x0 + 10 + k * ((x1 - x0 - 20) / 4), fy = wingTop + 16 + f * 52, seed = (x0 + f * 7 + k * 13);
        if ((seed * 37) % 7 === 0) continue; // a few dark offices
        d.fillStyle = seed % 3 ? 'rgba(255,214,140,.55)' : 'rgba(150,220,255,.5)'; d.fillRect(wx + 2, fy + 3, ww - 4, 27);
        winX.push([x0, x1]); winY.push(fy);
      }
      for (const [x0, x1, floor, speed, ph] of [[0, towerL, 1, 9000, 0], [towerR, W, 2, 11000, 0.4]]) {
        const fy = wingTop + 16 + floor * 52, span = x1 - x0 - 30;
        const u = (Math.sin((t / speed + ph) * Math.PI * 2) + Math.sin((t / speed + ph) * Math.PI * 2 * 0.37) * 0.35 + 1.35) / 2.7; // wanders back and forth, never teleports
        const sx = x0 + 14 + u * span, step = Math.abs(Math.sin(t / 180)) * 1.5;
        d.save(); d.beginPath(); for (let k = 0; k < 4; k++) { const wx = x0 + 10 + k * ((x1 - x0 - 20) / 4); d.rect(wx + 2, fy + 3, (x1 - x0 - 20) / 4 - 10, 27); } d.clip();
        d.fillStyle = 'rgba(10,12,24,.78)'; d.fillRect(sx - 3, fy + 12 - step, 6, 18); d.fillRect(sx - 2, fy + 7 - step, 4, 5); d.restore();
      }
      // atrium glow + elevator capsules
      d.fillStyle = `rgba(95,242,255,${0.08 + 0.03 * Math.sin(t / 900)})`; d.fillRect(towerL, tTop, towerR - towerL, base - tTop);
      for (const [ex, sp] of [[towerL + 34, 3100], [towerR - 42, 3700]]) { const ph = (Math.sin(t / sp) + 1) / 2, ey = tTop + 30 + ph * (base - tTop - 120); d.fillStyle = '#fff3c4'; d.fillRect(ex, ey, 10, 14); glow(d, ex + 5, ey + 7, 16, '255,220,140', 0.5); }
      // billboard: Mahmoud live + ticker
      d.fillStyle = '#0a0f22'; d.fillRect(bx, by, bw, bh);
      const bob = Math.round(Math.sin(t / 400) * 1.5);
      d.save(); d.imageSmoothingEnabled = false; d.drawImage(pic, bx + 4, by + 4 + bob, 52, 52); d.restore();
      neonText(d, 'THE', bx + 80, by + 10, '#f0c35a', 1, 1); neonText(d, 'ODDS', bx + 80, by + 22, '#f0c35a', 1, 1); neonText(d, 'NEVER', bx + 80, by + 34, '#ff4fd8', 1, (Math.floor(t / 500) % 2) ? 1 : 0.5); neonText(d, 'LIE', bx + 80, by + 46, '#ff4fd8', 1, 1);
      d.save(); d.beginPath(); d.rect(bx, by + bh - 12, bw, 12); d.clip(); d.fillStyle = '#f0c35a'; d.fillRect(bx, by + bh - 12, bw, 12);
      const TK = '  WELCOME TO MAHMOUD HQ  ·  SEASON SPIN  ·  REGION ROULETTE  ·  COUNTRY CLASH  ·  ', tw = textWidth(TK, 1); const off = (t / 30) % tw;
      for (let k = 0; k < 3; k++) drawPixelText(d, TK, bx - off + k * tw, by + bh - 10, '#1a1205', 1); d.restore();
      d.fillStyle = 'rgba(255,255,255,.06)'; d.fillRect(bx, by + ((t / 20) % bh), bw, 2);
      // the crown letters
      const f = flick(t, 5, 0.6);
      neonText(d, 'MAHMOUD', cx, tTop - 14, '#f0c35a', 3, f);
      // halo ring + spire light
      d.strokeStyle = `rgba(240,195,90,${0.45 + 0.2 * Math.sin(t / 500)})`; d.lineWidth = 2; d.beginPath(); d.ellipse(cx, tTop - 40, 18, 5, 0, 0, Math.PI * 2); d.stroke();
      if (Math.floor(t / 600) % 2) { R(d, cx - 2, tTop - 50, 4, 4, '#ff3b5c'); glow(d, cx, tTop - 48, 22, '255,59,92', 0.6); }
      // searchlights sweeping the sky
      for (const [sx, ph] of [[towerL + 6, 0], [towerR - 6, 1.7]]) {
        const a = -Math.PI / 2 + Math.sin(t / 1600 + ph) * 0.55, len = 220;
        const gr = d.createLinearGradient(sx, tTop, sx + Math.cos(a) * len, tTop + Math.sin(a) * len); gr.addColorStop(0, 'rgba(255,240,200,.35)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
        d.fillStyle = gr; d.beginPath(); d.moveTo(sx, tTop); d.lineTo(sx + Math.cos(a - 0.08) * len, tTop + Math.sin(a - 0.08) * len); d.lineTo(sx + Math.cos(a + 0.08) * len, tTop + Math.sin(a + 0.08) * len); d.fill();
      }
      // helipad landing lights (smooth pulse)
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; d.fillStyle = `rgba(240,195,90,${0.35 + 0.35 * Math.sin(t / 700 - k * 0.8)})`; d.fillRect(W - 68 + Math.cos(a) * 36 - 1, wingTop - 18 + Math.sin(a) * 9 - 1, 3, 2); }
      // entrance glow + door sign
      neonText(d, 'CONTROL CENTRE', cx, base - 104, '#5ff2ff', 1, 1);
      glow(d, cx, base - 40, 60, '255,214,140', 0.25 + 0.05 * Math.sin(t / 400));
    });
    L(cx, base - 30, 220, '255,214,140', 0.95); L(cx, top + 90, 200, '95,242,255', 0.6);
  } },
  // ── Biodome: geodesic glass dome with glowing jungle inside ──
  biodome: { top: 2, draw({ g, W, top, fh, L, emissive: E }) {
    const cx = W / 2, cy = top + fh * 0.62, rx = W / 2 - 4, ry = fh * 0.62;
    ell(g, cx, cy, rx, ry, '#0d2c2a');
    const rnd = mulberry32(31);
    for (let i = 0; i < 120; i++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()); const x = cx + Math.cos(a) * r * rx * 0.9, y = cy + Math.sin(a) * r * ry * 0.85; ell(g, x, y, 6 + rnd() * 10, 5 + rnd() * 8, ['#1a5a46', '#227a58', '#2fa070', '#145040'][i % 4]); }
    for (let i = 0; i < 30; i++) R(g, cx + (rnd() - 0.5) * rx * 1.6, cy + (rnd() - 0.6) * ry, 3, 3, ['#ff7aa8', '#ffe08a', '#5ff2ff'][i % 3]);
    g.strokeStyle = 'rgba(200,255,240,.35)'; g.lineWidth = 2;
    for (let k = -5; k <= 5; k++) { g.beginPath(); g.ellipse(cx, cy, Math.abs(rx * k / 5), ry, 0, Math.PI, 0); g.stroke(); }
    for (let k = 1; k < 5; k++) { g.beginPath(); g.ellipse(cx, cy, rx, ry * k / 5, 0, Math.PI, 0); g.stroke(); }
    ell(g, cx - rx * 0.4, cy - ry * 0.6, rx * 0.25, ry * 0.12, 'rgba(255,255,255,.18)');
    R(g, 0, top + fh - 26, W, 26, '#2b3148'); R(g, 0, top + fh - 26, W, 3, '#5d6890');
    doorWay(g, W / 2, fh + top - 2, 40, 40, '#1b2a3a', '#4b5578', { glass: true });
    E.push((d, t) => { neonText(d, 'BIODOME', W / 2, top + fh - 22, '#48e08f', 2, 1); for (let i = 0; i < 6; i++) { const x = cx + Math.sin(t / 900 + i * 2) * rx * 0.6, y = cy - ry * 0.3 + Math.cos(t / 700 + i) * ry * 0.3; d.fillStyle = 'rgba(180,255,200,.8)'; d.fillRect(x, y, 2, 2); } });
    L(cx, cy, 180, '72,224,143', 0.7);
  } },
  // ── Role Market: cyberpunk tower — role pods behind glass, magenta billboard ticker, vertical neon, steam vents ──
  roles: { top: 3, draw({ g, W, top, fh, L, emissive: E }) {
    const roofH = Math.round(fh * 0.3);
    // stepped roof, antennas, cable bundles
    R(g, 0, top, W, roofH, '#141726'); R(g, 18, top - 16, W - 36, 18, '#1b1f33');
    for (let x = 0; x < W; x += 12) R(g, x, top, 2, roofH, '#1e2236');
    for (const ax of [26, W - 34]) { R(g, ax, top - 64, 3, 50, '#6b7385'); R(g, ax - 7, top - 50, 17, 2, '#6b7385'); R(g, ax - 4, top - 40, 11, 2, '#6b7385'); }
    g.strokeStyle = '#0a0c16'; g.lineWidth = 2; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(30, top - 20 + k * 3); g.quadraticCurveTo(W / 2, top + 10 + k * 5, W - 30, top - 20 + k * 3); g.stroke(); }
    const bx = Math.round(W * 0.16), bw = Math.round(W * 0.68), by = top + 6, bh = roofH - 14;
    R(g, bx - 4, by - 4, bw + 8, bh + 8, '#07080f'); R(g, bx, by, bw, bh, '#14082a');
    const fy = top + roofH, fhh = fh + top - fy;
    wallBlock(g, 0, fy, W, fhh, '#1b1e2f', { texture: 'metal' });
    // side pillars for vertical signs
    R(g, 4, fy + 4, 22, fhh - 64, '#0b0d18'); R(g, W - 26, fy + 4, 22, fhh - 64, '#0b0d18');
    // big shop glass with 5 role pods
    const gx = 34, gw = W - 68, gy = fy + 12, gh = fhh - 82;
    R(g, gx, gy, gw, gh, '#0a1226');
    const pods = 5, pw = (gw - 16) / pods, cols = ['#ff4fd8', '#5ff2ff', '#f0c35a', '#48e08f', '#9b8cff'];
    for (let i = 0; i < pods; i++) {
      const px = Math.round(gx + 8 + i * pw), pww = Math.round(pw - 6);
      R(g, px, gy + 6, pww, gh - 12, '#232842'); R(g, px + 2, gy + 8, pww - 4, gh - 16, '#0f1830');
      const cx = px + pww / 2, base = gy + gh - 14;
      R(g, cx - 10, base, 20, 4, '#3a4060'); // plinth
      ell(g, cx, base - 34, 6, 7, '#2a2f48'); R(g, cx - 8, base - 26, 16, 24, '#2a2f48'); R(g, cx - 8, base - 26, 16, 4, cols[i]); // mannequin silhouette
      R(g, cx - 4, base - 36, 8, 3, cols[i]); // visor
    }
    for (let k = 0; k < 3; k++) R(g, 0, fy + fhh - 66 + k * 5, W, 2, k === 1 ? '#3a2f55' : '#262b44'); // pipes
    doorWay(g, W / 2, fh + top - 4, 48, 52, '#07080f', '#3a3f5c', { glass: true });
    R(g, W / 2 - 40, fh + top - 62, 80, 4, '#0b0d18');
    // vents
    for (const vx of [44, W - 70]) { R(g, vx, fh + top - 40, 26, 14, '#2a2f48'); for (let k = 0; k < 4; k++) R(g, vx + 2, fh + top - 38 + k * 3, 22, 1, '#121524'); }
    const TICK = 'ROOKIE  COMMANDER  HACKER  BOOKMAKER  DIPLOMAT  SABOTEUR  BODYGUARD  MERCHANT  CHAOS AGENT  THIEF  CUPID  ';
    const tw = textWidth(TICK, 2);
    E.push((d, t) => {
      // billboard: title + scrolling role ticker
      neonRect(d, bx, by, bw, bh, '#ff4fd8', 0.9);
      neonText(d, 'ROLE MARKET', W / 2, by + 8, '#ff4fd8', 3, flick(t, 6));
      d.save(); d.beginPath(); d.rect(bx + 3, by + bh - 20, bw - 6, 16); d.clip();
      const off = (t / 25) % tw;
      for (let k = -1; k < 2; k++) drawPixelText(d, TICK, bx + 6 - off + k * tw, by + bh - 17, '#5ff2ff', 2);
      d.restore();
      // vertical neon on the pillars
      'ROLES'.split('').forEach((ch, i) => neonText(d, ch, 15, fy + 12 + i * 22, '#5ff2ff', 3, flick(t, 11 + i, 0.6)));
      'VW4'.split('').forEach((ch, i) => neonText(d, ch, W - 15, fy + 24 + i * 26, '#f0c35a', 3, flick(t, 21 + i, 0.6)));
      // pods light up one after another + scan line on the glass
      const hot = Math.floor(t / 900) % pods;
      for (let i = 0; i < pods; i++) { const cx = gx + 8 + i * pw + (pw - 6) / 2; glow(d, cx, gy + gh / 2, 34, i === hot ? '255,255,255' : hexRgb(cols[i]), i === hot ? 0.35 : 0.16); }
      const sy = gy + ((t / 12) % gh); d.fillStyle = 'rgba(95,242,255,.18)'; d.fillRect(gx, sy, gw, 2);
      neonRect(d, gx, gy, gw, gh, '#5ff2ff', 0.55, 1);
      neonRect(d, W / 2 - 25, fh + top - 57, 50, 53, '#ff4fd8', 0.8);
      // steam from the vents
      for (const vx of [44, W - 70]) for (let k = 0; k < 3; k++) { const ph = ((t / 1400) + k / 3) % 1; d.fillStyle = `rgba(200,210,255,${0.18 * (1 - ph)})`; d.beginPath(); d.arc(vx + 13 + Math.sin(ph * 6 + k) * 5, fh + top - 44 - ph * 40, 4 + ph * 10, 0, Math.PI * 2); d.fill(); }
      if (Math.floor(t / 500) % 2) R(d, 27, top - 66, 3, 3, '#ff4f6e');
    });
    L(W / 2, fy + 50, 220, '255,79,216', 0.75); L(W / 2, fh + top, 150, '95,242,255', 0.8);
  } },
  // ── Moumanou's tent: purple velvet, gold stars, eye sign ──
  seer: { top: 3, draw({ g, W, top, fh, L, emissive: E }) {
    const cx = W / 2;
    g.fillStyle = '#3a1f5a'; g.beginPath(); g.moveTo(cx, top - 60); g.lineTo(W - 4, top + fh - 30); g.lineTo(4, top + fh - 30); g.closePath(); g.fill();
    g.fillStyle = '#4b2a74'; g.beginPath(); g.moveTo(cx, top - 60); g.lineTo(cx - 30, top + fh - 30); g.lineTo(4, top + fh - 30); g.closePath(); g.fill();
    for (let i = 0; i < 7; i++) { g.strokeStyle = '#2a1640'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, top - 60); g.lineTo(10 + i * ((W - 20) / 6), top + fh - 30); g.stroke(); }
    const rnd = mulberry32(9); for (let i = 0; i < 28; i++) { const y = top - 40 + rnd() * (fh + 10), spread = (y - top + 60) / (fh + 30); const x = cx + (rnd() - 0.5) * (W - 10) * spread; R(g, x, y, 3, 3, '#f0c35a'); R(g, x + 1, y - 1, 1, 5, '#f0c35a'); R(g, x - 1, y + 1, 5, 1, '#f0c35a'); }
    R(g, 0, top + fh - 32, W, 32, '#2a1640');
    g.fillStyle = '#120a1e'; g.beginPath(); g.moveTo(cx - 24, top + fh); g.lineTo(cx, top + fh - 60); g.lineTo(cx + 24, top + fh); g.fill();
    R(g, cx - 30, top + fh - 66, 4, 66, '#f0c35a'); R(g, cx + 26, top + fh - 66, 4, 66, '#f0c35a');
    E.push((d, t) => {
      neonText(d, 'MOUMANOU', cx, top + fh - 26, '#c77dff', 2, flick(t, 7));
      // the eye
      const ey = top - 4; d.save(); d.shadowColor = '#c77dff'; d.shadowBlur = 14; d.strokeStyle = '#e6d9ff'; d.lineWidth = 2; d.beginPath(); d.ellipse(cx, ey, 16, 8, 0, 0, Math.PI * 2); d.stroke(); d.fillStyle = '#c77dff'; d.beginPath(); d.arc(cx + Math.sin(t / 900) * 4, ey, 5, 0, Math.PI * 2); d.fill(); d.restore();
      glow(d, cx, top + fh - 30, 60, '199,125,255', 0.25 + 0.08 * Math.sin(t / 300));
    });
    L(cx, top + fh - 20, 140, '199,125,255', 0.9);
  } },
  // ── Black Market: rusted container shop, graffiti, flickering purple neon ──
  black: { top: 3, draw({ g, W, top, fh, L, emissive: E }) {
    const roofH = 46;
    R(g, 0, top, W, roofH, '#24252e'); for (let x = 0; x < W; x += 14) R(g, x, top, 2, roofH, '#30313c');
    R(g, 20, top - 30, 40, 34, '#3a3b46'); R(g, 24, top - 26, 32, 4, '#55566a'); // AC units
    R(g, W - 70, top - 20, 30, 24, '#3a3b46'); ell(g, W - 55, top - 8, 9, 9, '#2a2b36');
    const fy = top + roofH, fhh = fh + top - fy;
    wallBlock(g, 0, fy, W, fhh, '#3a2f3f', { texture: 'metal' });
    for (let x = 0; x < W; x += 8) R(g, x, fy, 3, fhh, '#33293a');
    // rust streaks & graffiti
    const rnd = mulberry32(13);
    for (let i = 0; i < 16; i++) R(g, rnd() * W, fy + 10 + rnd() * 30, 3, 10 + rnd() * 30, 'rgba(160,80,40,.35)');
    drawPixelText(g, 'HICHAM', 16, fy + fhh - 50, '#ff4fd8aa', 2); drawPixelText(g, 'WAS HERE', 16, fy + fhh - 36, '#5ff2ff88', 2);
    // shutter + door
    R(g, W - 120, fy + 30, 90, fhh - 34, '#5a5b66'); for (let y = fy + 32; y < fy + fhh - 6; y += 5) R(g, W - 120, y, 90, 1, '#3a3b46');
    doorWay(g, W / 2, fh + top - 4, 40, 56, '#1b1420', '#5a4a66');
    R(g, W / 2 + 26, fh + top - 70, 10, 8, '#2a2b36'); // camera
    E.push((d, t) => {
      const f = flick(t, 8, 1.6);
      neonRect(d, 8, fy + 6, W - 16, 26, '#c77dff', f);
      neonText(d, 'BLACK MARKET', W / 2, fy + 12, '#c77dff', 2, f);
      if (Math.floor(t / 700) % 2) R(d, W / 2 + 33, fh + top - 68, 2, 2, '#ff3b5c');
      neonText(d, 'OPEN LATE', W - 75, fy + fhh - 70, '#ff4fd8', 1, flick(t, 9));
    });
    L(W / 2, fy + 40, 200, '199,125,255', 0.95); L(W / 2, fh + top, 120, '199,125,255', 0.8);
  } },
  // ── Club Cléopâtre: Egyptian neon nightclub ──
  club: { top: 4, draw({ g, W, top, fh, L, emissive: E }) {
    const roofH = 40;
    R(g, 0, top, W, roofH, '#2a1a24');
    // pyramid sign frame
    g.fillStyle = '#3a2430'; g.beginPath(); g.moveTo(W / 2, top - 110); g.lineTo(W / 2 + 70, top + 4); g.lineTo(W / 2 - 70, top + 4); g.closePath(); g.fill();
    const fy = top + roofH, fhh = fh + top - fy;
    wallBlock(g, 0, fy, W, fhh, '#1f1420', { texture: 'metal' });
    // columns with hieroglyph LEDs
    for (const x of [16, 76, W - 92, W - 32]) { R(g, x, fy, 16, fhh - 6, '#d9b45a'); R(g, x, fy, 16, 4, '#fff1b0'); R(g, x + 12, fy, 4, fhh - 6, '#a8862b'); for (let y = fy + 12; y < fy + fhh - 14; y += 12) { R(g, x + 4, y, 8, 2, '#1f4fb5'); R(g, x + 6, y + 4, 4, 4, '#1f4fb5'); } }
    // red carpet & rope
    R(g, W / 2 - 24, fh + top - 6, 48, 6, '#b81d3a');
    for (const x of [W / 2 - 60, W / 2 + 52]) { R(g, x, fh + top - 26, 6, 22, '#d9b45a'); ell(g, x + 3, fh + top - 28, 5, 4, '#fff1b0'); }
    doorWay(g, W / 2, fh + top - 4, 46, 58, '#120a12', '#d9b45a');
    E.push((d, t) => {
      // pyramid neon
      const f = flick(t, 10);
      d.save(); d.globalAlpha = f; d.shadowColor = '#ff4fd8'; d.shadowBlur = 16; d.strokeStyle = '#ff9be8'; d.lineWidth = 3; d.beginPath(); d.moveTo(W / 2, top - 104); d.lineTo(W / 2 + 62, top); d.lineTo(W / 2 - 62, top); d.closePath(); d.stroke(); d.restore();
      d.save(); d.shadowColor = '#f0c35a'; d.shadowBlur = 10; d.strokeStyle = '#ffe28a'; d.lineWidth = 2; d.beginPath(); d.ellipse(W / 2, top - 36, 12, 6, 0, 0, Math.PI * 2); d.stroke(); d.fillStyle = '#ffe28a'; d.beginPath(); d.arc(W / 2, top - 36, 3, 0, Math.PI * 2); d.fill(); d.restore();
      neonText(d, 'CLUB CLEOPATRE', W / 2, fy + 8, '#ff4fd8', 3, f);
      neonText(d, 'VIP', W / 2, fy + 34, '#f0c35a', 2, 1);
      // sweeping spotlights
      for (let i = 0; i < 2; i++) { const a = Math.sin(t / 1400 + i * 2) * 0.6 - Math.PI / 2; d.save(); d.globalAlpha = 0.18; const gr = d.createLinearGradient(W / 2, top, W / 2 + Math.cos(a) * 260, top + Math.sin(a) * 260); gr.addColorStop(0, i ? '#ff4fd8' : '#5ff2ff'); gr.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = gr; d.beginPath(); d.moveTo(W / 2 + (i ? 20 : -20), top); d.lineTo(W / 2 + Math.cos(a - 0.12) * 260, top + Math.sin(a - 0.12) * 260); d.lineTo(W / 2 + Math.cos(a + 0.12) * 260, top + Math.sin(a + 0.12) * 260); d.closePath(); d.fill(); d.restore(); }
      // bass pulse
      glow(d, W / 2, fh + top - 30, 70, '255,79,216', 0.2 + 0.15 * Math.max(0, Math.sin(t / 120)));
    });
    L(W / 2, fy + 30, 230, '255,79,216', 0.95); L(W / 2, fh + top, 140, '240,195,90', 0.8);
  } },
  // ── Control Tower · Moon Arcade: glass control cab on a lit shaft, radar & beacon on top, arcade hall below ──
  tower: { top: 5, draw({ g, W, top, fh, L, emissive: E }) {
    const base = top + fh, hallTop = base - 118, cx = W / 2, doorX = 112;
    const trap = (x0, y0, w0, x1, y1, w1, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(x0 - w0 / 2, y0); g.lineTo(x0 + w0 / 2, y0); g.lineTo(x1 + w1 / 2, y1); g.lineTo(x1 - w1 / 2, y1); g.closePath(); g.fill(); };
    // shaft
    const shaftTop = 104;
    trap(cx, shaftTop, 52, cx, hallTop, 76, '#262e48');
    trap(cx - 18, shaftTop, 12, cx - 26, hallTop, 18, '#323b5c');
    for (let y = shaftTop + 8; y < hallTop; y += 14) R(g, cx - 34 + (y - shaftTop) * 0.05, y, 68 - (y - shaftTop) * 0.1, 1, '#1b2236');
    R(g, cx + 14, shaftTop, 4, hallTop - shaftTop, '#151b2e'); // elevator rail
    // control cab
    const cabY = 30, cabH = 66;
    trap(cx, cabY + cabH, 128, cx, shaftTop, 52, '#1d2338');
    R(g, cx - 74, cabY - 12, 148, 14, '#3a4466'); R(g, cx - 74, cabY - 12, 148, 3, '#6b78a8'); R(g, cx - 62, cabY - 18, 124, 7, '#2b3148');
    trap(cx, cabY + 2, 148, cx, cabY + cabH - 6, 124, '#0c1630');
    for (let i = 0; i <= 8; i++) { const t0 = i / 8; g.strokeStyle = '#3a4466'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 74 + t0 * 148, cabY + 2); g.lineTo(cx - 62 + t0 * 124, cabY + cabH - 6); g.stroke(); }
    R(g, cx - 62, cabY + cabH - 8, 124, 4, '#3a4466');
    for (let i = 0; i < 5; i++) { R(g, cx - 54 + i * 24, cabY + cabH - 22, 16, 12, '#07080f'); ell(g, cx - 46 + i * 24, cabY + cabH - 26, 4, 4, '#07080f'); } // controllers at their desks
    // roof gear: antenna mast, small dishes
    R(g, cx + 38, cabY - 74, 3, 60, '#8a93a8'); for (let k = 0; k < 4; k++) R(g, cx + 32 + k, cabY - 66 + k * 12, 15 - k * 2, 2, '#8a93a8');
    R(g, cx - 54, cabY - 30, 4, 14, '#6b7385'); ell(g, cx - 52, cabY - 32, 9, 5, '#c9ced9');
    // arcade hall
    wallBlock(g, 0, hallTop, W, base - hallTop, '#1d2338', { texture: 'metal' });
    R(g, 0, hallTop - 6, W, 8, '#3a4466'); R(g, 0, hallTop - 6, W, 2, '#6b78a8');
    R(g, 10, hallTop + 34, W - 20, 52, '#0a1226');
    const cab = ['#c77dff', '#ff4fd8', '#48e08f', '#5ff2ff', '#f0c35a', '#ff7a5c'];
    for (let i = 0; i < 6; i++) { if (i === 2 || i === 3) continue; const x0 = 18 + i * 38; R(g, x0, hallTop + 44, 22, 40, '#151a2e'); R(g, x0 + 3, hallTop + 48, 16, 12, '#07080f'); R(g, x0 + 2, hallTop + 64, 18, 4, cab[i]); }
    for (let x0 = 10; x0 < W - 10; x0 += 42) R(g, x0, hallTop + 34, 2, 52, '#3a4466');
    doorWay(g, doorX, base - 4, 40, 50, '#07080f', '#3a3f5c', { glass: true });
    R(g, doorX - 36, base - 70, 72, 14, '#07080f');
    // vents & pipes
    for (const vx of [W - 44, 14]) { R(g, vx, hallTop + 8, 30, 14, '#2b3148'); for (let k = 0; k < 4; k++) R(g, vx + 2, hallTop + 10 + k * 3, 26, 1, '#151b2e'); }
    E.push((d, t) => {
      // cab glow, screens, controller lamps
      d.fillStyle = `rgba(95,242,255,${0.16 + 0.05 * Math.sin(t / 700)})`; d.beginPath(); d.moveTo(cx - 72, cabY + 3); d.lineTo(cx + 72, cabY + 3); d.lineTo(cx + 61, cabY + cabH - 8); d.lineTo(cx - 61, cabY + cabH - 8); d.fill();
      for (let i = 0; i < 5; i++) { d.fillStyle = (Math.floor(t / 400) + i) % 4 ? 'rgba(95,242,255,.8)' : 'rgba(240,195,90,.9)'; d.fillRect(cx - 52 + i * 24, cabY + cabH - 20, 12, 4); }
      neonRect(d, cx - 74, cabY - 12, 148, cabH + 6, '#5ff2ff', 0.35, 1);
      // rotating radar dish
      const a = t / 450; d.save(); d.translate(cx - 6, cabY - 40); d.scale(1, 0.45); d.fillStyle = '#d9dee8'; d.beginPath(); d.ellipse(Math.sin(a) * 6, 0, 26 * Math.abs(Math.cos(a)) + 5, 26, 0, 0, Math.PI * 2); d.fill(); d.fillStyle = '#8a93a8'; d.beginPath(); d.ellipse(Math.sin(a) * 6, 0, 10 * Math.abs(Math.cos(a)) + 2, 10, 0, 0, Math.PI * 2); d.fill(); d.restore();
      R(d, cx - 8, cabY - 36, 4, 20, '#6b7385');
      // beacon
      if (Math.floor(t / 700) % 2) { R(d, cx + 37, cabY - 80, 5, 5, '#ff3b5c'); glow(d, cx + 39, cabY - 78, 30, '255,59,92', 0.7); }
      // elevator capsule riding the shaft
      const ph = (Math.sin(t / 2600) + 1) / 2, ey = shaftTop + 6 + ph * (hallTop - shaftTop - 26);
      R(d, cx + 10, ey, 12, 18, '#bfefff'); R(d, cx + 12, ey + 2, 8, 10, '#5ff2ff'); glow(d, cx + 16, ey + 9, 18, '95,242,255', 0.4);
      // vertical light strips + CONTROL letters
      for (let y = shaftTop + 12, i = 0; y < hallTop - 6; y += 10, i++) { d.fillStyle = (Math.floor(t / 90) - i) % 12 === 0 ? '#ffffff' : 'rgba(95,242,255,.45)'; d.fillRect(cx - 30 + (y - shaftTop) * 0.05, y, 2, 4); }
      'TWR'.split('').forEach((ch, i) => neonText(d, ch, cx - 4, shaftTop + 22 + i * 24, '#5ff2ff', 2, flick(t, 30 + i, 0.5)));
      // arcade hall: cabinet screens, neon sign, landing lights
      for (let i = 0; i < 6; i++) { if (i === 2 || i === 3) continue; const x0 = 18 + i * 38; d.fillStyle = `hsla(${(t / 10 + i * 60) % 360},80%,60%,.75)`; d.fillRect(x0 + 4, hallTop + 49, 14, 10); }
      neonText(d, 'MOON ARCADE', doorX, base - 67, (Math.floor(t / 1200) % 2) ? '#ff4fd8' : '#f0c35a', 1, flick(t, 41));
      neonText(d, 'CONTROL TOWER', W / 2, hallTop + 14, '#5ff2ff', 2, flick(t, 42, 0.7));
      for (let i = 0; i < 16; i++) { const k = (Math.floor(t / 110) - i) % 16; d.fillStyle = k === 0 ? '#ffffff' : k < 3 ? '#f0c35a' : 'rgba(240,195,90,.25)'; d.fillRect(4 + i * ((W - 8) / 16), hallTop - 5, 4, 3); }
      // tiny hologram Earth above the door
      const gx = doorX + 46, gy = base - 92 + Math.sin(t / 700) * 2; glow(d, gx, gy, 18, '95,242,255', 0.35);
      d.strokeStyle = 'rgba(95,242,255,.85)'; d.lineWidth = 1; d.beginPath(); d.arc(gx, gy, 8, 0, Math.PI * 2); d.stroke(); d.beginPath(); d.ellipse(gx, gy, 8 * Math.abs(Math.cos(t / 600)), 8, 0, 0, Math.PI * 2); d.stroke();
    });
    L(cx, cabY + 30, 160, '95,242,255', 0.75); L(doorX, base, 150, '255,79,216', 0.7); L(cx, hallTop + 50, 200, '240,195,90', 0.45);
  } },
};

function holoFlag(d, x, y, nation, t) {
  const f = flagCanvas(nation);
  d.fillStyle = '#9aa2b5'; d.fillRect(x - 2, y - 2, 2, 34);
  d.save();
  for (let i = 0; i < FLAG_W; i++) {
    const wave = Math.sin(t / 300 - i * 0.3) * 2 * (i / FLAG_W), shadeK = 0.82 + 0.18 * Math.cos(t / 300 - i * 0.3);
    d.globalAlpha = 0.95; d.drawImage(f, i, 0, 1, FLAG_H, x + i, Math.round(y + wave), 1, FLAG_H);
    d.globalAlpha = (1 - shadeK) * 0.9; d.fillStyle = '#000'; d.fillRect(x + i, Math.round(y + wave), 1, FLAG_H);
  }
  d.restore();
}

// ───────────────────────────── props ─────────────────────────────

function spriteProp(w, h, ax, ay, draw, sortY, emissive = null) {
  const [c, g] = canvas(w, h);
  draw(g);
  outline(c, '#0b0a14');
  return { y: sortY, draw: (ctx) => ctx.drawImage(c, Math.round(ax), Math.round(ay)), emissive };
}

function buildProp(p, lights) {
  const X = p.x * T, Y = p.y * T;
  const L = (x, y, r, color, a = 0.9) => lights.push({ x, y, r, color, a });
  switch (p.kind) {
    case 'neonlamp': {
      L(X, Y - 70, 150, '120,210,255', 0.85);
      return spriteProp(24, 100, X - 12, Y - 96, (g) => { R(g, 10, 20, 4, 74, '#3a4152'); R(g, 10, 20, 1, 74, '#6b7385'); R(g, 6, 90, 12, 6, '#2b2f3c'); R(g, 4, 8, 16, 14, '#2b2f3c'); R(g, 2, 6, 20, 3, '#4b5578'); }, Y,
        (d, t) => { d.fillStyle = '#bff6ff'; d.fillRect(X - 6, Y - 84, 12, 6); glow(d, X, Y - 80, 40, '120,220,255', 0.55 * flick(t, X % 13, 0.4)); d.fillStyle = '#ff4fd8'; d.fillRect(X - 1, Y - 60, 2, 30); glow(d, X, Y - 45, 18, '255,79,216', 0.35); });
    }
    case 'bench': {
      return spriteProp(70, 34, X - 35, Y - 30, (g) => { R(g, 4, 8, 62, 8, '#3a4152'); R(g, 4, 8, 62, 2, '#6b7385'); R(g, 4, 18, 62, 6, '#4b5578'); R(g, 4, 18, 62, 1, '#8a93ad'); R(g, 8, 24, 4, 8, '#2b2f3c'); R(g, 58, 24, 4, 8, '#2b2f3c'); }, Y,
        (d) => { d.fillStyle = 'rgba(95,242,255,.7)'; d.fillRect(X - 31, Y - 4, 62, 2); });
    }
    case 'biotree': {
      const hue = p.hue ? ['#ff4fd8', '#ff9be8'] : ['#5ff2ff', '#b8fbff'];
      L(X, Y - 40, 110, p.hue ? '255,79,216' : '95,242,255', 0.65);
      return spriteProp(80, 120, X - 40, Y - 112, (g) => {
        R(g, 24, 100, 32, 14, '#2b3148'); R(g, 24, 100, 32, 3, '#5d6890'); R(g, 26, 112, 28, 2, '#1b1e27');
        g.fillStyle = '#3a2f3f'; g.beginPath(); g.moveTo(36, 102); g.lineTo(44, 102); g.lineTo(42, 60); g.lineTo(38, 60); g.fill();
        for (const [cx, cy, rx, ry] of [[40, 46, 34, 24], [24, 54, 18, 14], [58, 54, 18, 14], [40, 30, 22, 18]]) { ell(g, cx, cy, rx, ry, '#1a2a4a'); ell(g, cx - 3, cy - 3, rx * 0.75, ry * 0.7, '#22385e'); }
      }, Y, (d, t) => { for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 10 + (i % 4) * 7; const x = X + Math.cos(a) * r, y = Y - 70 + Math.sin(a) * r * 0.6; d.fillStyle = i % 2 ? hue[0] : hue[1]; d.globalAlpha = 0.55 + 0.45 * Math.sin(t / 500 + i); d.fillRect(x, y, 3, 3); } d.globalAlpha = 1; glow(d, X, Y - 64, 50, p.hue ? '255,79,216' : '95,242,255', 0.18); });
    }
    case 'glowshroom': return { y: Y, draw: () => {}, emissive: (d, t) => { for (let i = 0; i < 3; i++) { const x = X - 14 + i * 12, y = Y - 6 + (i % 2) * 6; d.fillStyle = '#2a1a3a'; d.fillRect(x + 2, y, 2, 6); d.fillStyle = ['#c77dff', '#5ff2ff', '#48e08f'][i]; d.globalAlpha = 0.7 + 0.3 * Math.sin(t / 400 + i); d.fillRect(x, y - 3, 6, 3); d.globalAlpha = 1; } } };
    case 'flagpole': return spriteProp(12, 110, X - 6, Y - 106, (g) => { R(g, 5, 4, 3, 100, '#9aa2b5'); R(g, 2, 100, 9, 6, '#3a4152'); }, Y, (d, t) => holoFlag(d, X + 2, Y - 102, p.nation, t));
    case 'telescope': return spriteProp(44, 54, X - 22, Y - 50, (g) => { R(g, 18, 26, 6, 22, '#4b5578'); R(g, 10, 44, 22, 6, '#2b2f3c'); g.save(); g.translate(22, 22); g.rotate(-0.5); R(g, -18, -6, 34, 12, '#c9ced9'); R(g, -18, -6, 34, 3, '#ffffff'); R(g, 14, -8, 6, 16, '#6b7385'); g.restore(); }, Y);
    case 'antenna': return spriteProp(40, 130, X - 20, Y - 126, (g) => { R(g, 18, 10, 4, 116, '#6b7385'); for (let y = 20; y < 120; y += 14) { R(g, 8, y, 24, 2, '#4b5578'); } }, Y, (d, t) => { if (Math.floor(t / 700) % 2) { d.fillStyle = '#ff3b5c'; d.fillRect(X - 2, Y - 122, 4, 4); glow(d, X, Y - 120, 20, '255,59,92', 0.6); } });
    case 'rover': return { y: Y, draw: (d, t) => rover(d, X, Y, 1, t) };
    case 'crates': return spriteProp(70, 50, X - 35, Y - 46, (g) => { for (const [x, y, w, h, c] of [[4, 18, 30, 26, '#6b4a2e'], [34, 22, 30, 22, '#3a5a8a'], [14, 0, 26, 20, '#8a5a2e']]) { R(g, x, y, w, h, c); R(g, x, y, w, 3, shade(c, 0.25)); R(g, x + 2, y + 6, w - 4, 1, shade(c, -0.3)); R(g, x + w / 2 - 6, y + h / 2 - 2, 12, 4, '#f0c35a'); } }, Y);
    case 'tank': return spriteProp(30, 64, X - 15, Y - 60, (g) => { R(g, 3, 6, 24, 54, '#c9ced9'); ell(g, 15, 6, 12, 6, '#e9ecf2'); R(g, 3, 20, 24, 4, '#ff7a5c'); R(g, 5, 8, 3, 50, '#ffffff'); drawPixelTextCentered(g, 'H2', 15, 32, '#3a4152', 2); }, Y);
    case 'dish': return { y: Y, draw: (d, t) => { R(d, X - 3, Y - 30, 6, 30, '#6b7385'); d.save(); d.translate(X, Y - 34); d.rotate(Math.sin(t / 3000) * 0.4); ell(d, 0, 0, 22, 12, '#c9ced9'); ell(d, 2, -2, 16, 8, '#e9ecf2'); R(d, -1, -16, 2, 14, '#6b7385'); d.restore(); } };
    case 'vending': {
      const col = ['#ff4fd8', '#5ff2ff', '#f0c35a'][p.hue];
      L(X, Y - 30, 90, hexRGB(col), 0.8);
      return spriteProp(36, 68, X - 18, Y - 64, (g) => { R(g, 2, 2, 32, 62, '#2b2f3c'); R(g, 2, 2, 32, 3, '#5d6478'); R(g, 6, 8, 18, 36, '#111520'); R(g, 26, 10, 6, 22, '#3a4152'); R(g, 6, 50, 22, 8, '#111520'); }, Y,
        (d, t) => { d.fillStyle = col; d.globalAlpha = 0.9; for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) d.fillRect(X - 10 + k * 6, Y - 54 + r * 9, 4, 6); d.globalAlpha = 1; neonRect(d, X - 13, Y - 57, 20, 38, col, 0.8, 1); d.fillStyle = '#9dff9d'; d.fillRect(X + 9, Y - 52, 2, 2); });
    }
    case 'terminal': return spriteProp(30, 50, X - 15, Y - 46, (g) => { R(g, 9, 20, 12, 26, '#3a4152'); R(g, 3, 4, 24, 18, '#2b2f3c'); R(g, 5, 6, 20, 14, '#111520'); }, Y, (d, t) => { d.fillStyle = 'rgba(95,242,255,.85)'; d.fillRect(X - 10, Y - 40, 20, 14); d.fillStyle = '#0b2030'; for (let k = 0; k < 3; k++) d.fillRect(X - 8, Y - 38 + k * 4, 6 + ((t / 50 + k * 7) % 10), 1); drawPixelTextCentered(d, 'INFO', X, Y - 24, '#5ff2ff', 1); glow(d, X, Y - 32, 30, '95,242,255', 0.3); });
    case 'hoload': return spriteProp(60, 130, X - 30, Y - 126, (g) => { R(g, 28, 40, 4, 86, '#3a4152'); R(g, 24, 120, 12, 6, '#2b2f3c'); }, Y, (d, t) => {
      const ad = p.ad, y0 = Y - 124, cols = ad === 'club' ? ['#ff4fd8', '#f0c35a'] : ['#f0c35a', '#5ff2ff'];
      d.save(); d.globalAlpha = 0.8 * flick(t, X % 7); d.fillStyle = 'rgba(10,10,30,.55)'; d.fillRect(X - 28, y0, 56, 44); neonRect(d, X - 28, y0, 56, 44, cols[0], 1, 1);
      if (ad === 'club') { drawPixelTextCentered(d, 'CLUB', X, y0 + 6, cols[0], 2); drawPixelTextCentered(d, Math.floor(t / 1500) % 2 ? 'TONIGHT' : 'VIP 24/7', X, y0 + 24, cols[1], 1); }
      else { drawPixelTextCentered(d, 'ROLES', X, y0 + 6, cols[0], 2); drawPixelTextCentered(d, ['VETO', 'STEAL', 'SPY', 'CHAOS'][Math.floor(t / 1000) % 4], X, y0 + 24, cols[1], 2); }
      d.restore(); for (let i = 0; i < 44; i += 4) { d.fillStyle = 'rgba(255,255,255,.05)'; d.fillRect(X - 28, y0 + ((i + t / 40) % 44), 56, 1); }
    });
    case 'steamvent': return { y: Y - 40, draw: (d, t) => { R(d, X - 10, Y - 4, 20, 8, '#1b1e27'); for (let i = 0; i < 4; i++) R(d, X - 8 + i * 5, Y - 3, 2, 6, '#3a4152'); for (let i = 0; i < 6; i++) { const k = ((t / 1600 + i / 6) % 1); d.fillStyle = `rgba(200,210,230,${0.22 * (1 - k)})`; d.beginPath(); d.arc(X + Math.sin(k * 6 + i) * 8, Y - k * 70, 6 + k * 14, 0, Math.PI * 2); d.fill(); } } };
    case 'cafe': {
      L(X, Y - 40, 130, '255,200,130', 0.9);
      const x0 = CAFE.x * T, y0 = CAFE.y * T;
      return spriteProp(CAFE.w * T + 20, CAFE.h * T + 70, x0 - 10, y0 - 50, (g) => {
        const W = CAFE.w * T;
        for (let k = 0; k < W; k += 12) R(g, 10 + k, 30, 12, 22, (k / 12) % 3 === 0 ? '#2a5db0' : (k / 12) % 3 === 1 ? '#f4f6fb' : '#e54b4b');
        R(g, 10, 52, W, 4, 'rgba(0,0,0,.3)');
        R(g, 14, 56, W - 8, CAFE.h * T - 6, '#5a3a24'); R(g, 14, 56, W - 8, 4, '#8a5a34');
        R(g, 20, 64, 30, 18, '#d8c3a5'); for (let i = 0; i < 4; i++) R(g, 24 + i * 7, 68, 5, 4, '#d99a45');
        R(g, W - 40, 62, 14, 20, '#2b2f3c'); R(g, W - 38, 60, 10, 4, '#c9ced9');
        R(g, 16, 6, 4, 24, '#6b7385'); R(g, W + 2, 6, 4, 24, '#6b7385');
      }, Y, (d, t) => { neonText(d, 'CAFE DE PARIS', x0 + CAFE.w * T / 2, y0 - 40, '#ff4f6e', 2, flick(t, 11)); for (let i = 0; i < 3; i++) { const k = ((t / 1800 + i / 3) % 1); d.fillStyle = `rgba(255,255,255,${0.3 * (1 - k)})`; d.fillRect(x0 + CAFE.w * T - 30 + Math.sin(k * 5 + i) * 3, y0 + 4 - k * 30, 2, 4); } });
    }
    case 'cafetable': return spriteProp(40, 40, X - 20, Y - 36, (g) => { ell(g, 20, 14, 14, 6, '#f4f6fb'); ell(g, 20, 12, 12, 4, '#ffffff'); R(g, 19, 16, 2, 16, '#3a4152'); R(g, 12, 30, 16, 3, '#3a4152'); R(g, 4, 18, 6, 12, '#8a5a34'); R(g, 30, 18, 6, 12, '#8a5a34'); R(g, 17, 6, 6, 5, '#f4f6fb'); }, Y);
    case 'hoverbike': return { y: Y, draw: (d, t) => { const b = Math.sin(t / 300) * 2; ell(d, X, Y + 2, 30, 6, 'rgba(0,0,0,.4)'); d.save(); d.translate(X, Y - 14 + b); R(d, -30, -6, 60, 12, '#5d6b4a'); R(d, -30, -6, 60, 3, '#8a9a70'); R(d, 18, -14, 14, 10, '#3a4152'); R(d, -22, -12, 22, 6, '#2b2f3c'); R(d, -34, -2, 6, 6, '#3a4152'); d.restore(); }, emissive: (d, t) => { glow(d, X, Y - 4, 34, '255,140,60', 0.35 + 0.1 * Math.sin(t / 120)); } };
    case 'planter': return spriteProp(70, 40, X - 35, Y - 36, (g) => { R(g, 4, 20, 62, 16, '#2b3148'); R(g, 4, 20, 62, 3, '#5d6890'); for (let i = 0; i < 6; i++) { ell(g, 10 + i * 10, 16, 7, 8, '#1a4a46'); ell(g, 9 + i * 10, 13, 4, 4, '#2a7a6a'); } }, Y, (d, t) => { for (let i = 0; i < 6; i++) { d.fillStyle = i % 2 ? '#3cf2c0' : '#c77dff'; d.globalAlpha = 0.6 + 0.4 * Math.sin(t / 600 + i); d.fillRect(X - 26 + i * 10, Y - 26, 2, 2); } d.globalAlpha = 1; });
    case 'barrier': return { y: Y, draw: () => {}, emissive: (d, t) => { for (let i = 0; i < 6; i++) { d.fillStyle = (Math.floor(t / 300) + i) % 2 ? '#ffb547' : '#3a2a12'; d.fillRect(X - 30 + i * 10, Y - 8, 8, 4); } } };
    case 'bollard': return spriteProp(18, 34, X - 9, Y - 30, (g) => { R(g, 3, 4, 12, 26, '#3a4152'); R(g, 3, 4, 12, 3, '#6b7385'); }, Y, (d, t) => { d.fillStyle = '#ffb547'; d.fillRect(X - 6, Y - 20, 12, 3); glow(d, X, Y - 18, 16, '255,181,71', 0.35); });
    default: return null;
  }
}

/** The fountain's centrepiece: three gilded bowls stacked under a glowing crescent moon. */
function fountainSculpture() {
  const X = FOUNTAIN.cx * T, Y = FOUNTAIN.cy * T;
  return spriteProp(70, 110, X - 35, Y - 100, (g) => {
    R(g, 31, 40, 8, 60, '#8a93ad'); R(g, 31, 40, 2, 60, '#c9ced9');
    for (const [yy, w] of [[92, 34], [66, 26], [44, 18]]) { ell(g, 35, yy, w, 7, '#6c7591'); ell(g, 35, yy - 2, w - 2, 5, '#9aa3c0'); g.strokeStyle = '#d9a83a'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(35, yy - 2, w - 2, 5, 0, 0, Math.PI * 2); g.stroke(); ell(g, 35, yy - 3, w - 6, 3, '#2a7ab0'); }
    g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(35, 18, 13, 0, Math.PI * 2); g.fill(); g.fillStyle = '#0b0a14'; g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(41, 14, 11, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over';
  }, Y + 4, (d, t) => {
    glow(d, X - 2, Y - 82, 30, '255,224,140', 0.35 + 0.08 * Math.sin(t / 900));
    for (const [yy, w] of [[-34, 26], [-56, 18]]) for (let k = 0; k < 6; k++) { const ph = ((t / 700) + k / 6) % 1; const side = k % 2 ? 1 : -1; d.fillStyle = `rgba(190,235,255,${0.8 - ph * 0.7})`; d.fillRect(X + side * (w - 2) + side * ph * 4, Y + yy + ph * 22, 2, 3); }
  });
}

function statueProp(lights) {
  const X = STATUE.x * T, Y = STATUE.y * T + 10;
  lights.push({ x: X, y: Y - 40, r: 130, color: '255,210,110', a: 0.85 });
  const sheet = characterSheet({ special: 'statue' });
  return spriteProp(110, 170, X - 55, Y - 166, (g) => {
    R(g, 15, 130, 80, 36, '#4b5578'); R(g, 15, 130, 80, 4, '#8a93ad'); R(g, 20, 160, 70, 4, '#2b2f3c');
    drawPixelTextCentered(g, 'MAHMOUD', 55, 144, '#f0c35a', 2);
    drawCharacter(g, sheet, 'down', 0, 55, 132, 2);
  }, Y, (d, t) => { glow(d, X, Y - 90, 70, '255,210,110', 0.15 + 0.05 * Math.sin(t / 800)); });
}

function billboardProp(lights) {
  const X = BILLBOARD.x * T, Y = BILLBOARD.y * T, W = BILLBOARD.w * T;
  lights.push({ x: X + W / 2, y: Y + 10, r: 220, color: '199,125,255', a: 0.6 });
  return spriteProp(W, 90, X, Y - 70, (g) => { R(g, 30, 50, 6, 40, '#3a4152'); R(g, W - 36, 50, 6, 40, '#3a4152'); R(g, 0, 0, W, 54, '#151826'); R(g, 0, 0, W, 3, '#5d6478'); }, Y + 18, (d, t) => {
    const msgs = ['1 ROLE  1 GAME  NO REFUNDS', 'VISIT YOUR EMBASSY FIRST', 'CHIPS MOVE THE ODDS', 'THE PHARAOH IS WATCHING', 'BOARD AT PAD 01'];
    const m = msgs[Math.floor(t / 3500) % msgs.length];
    d.save(); d.beginPath(); d.rect(X + 4, Y - 66, W - 8, 46); d.clip();
    d.fillStyle = 'rgba(40,10,60,.65)'; d.fillRect(X + 4, Y - 66, W - 8, 46);
    const off = ((t / 18) % (W + 400)) - 200;
    neonText(d, m, X + W - off, Y - 52, '#ff4fd8', 3, 1);
    d.restore(); neonRect(d, X + 2, Y - 68, W - 4, 50, '#c77dff', flick(t, 12), 2);
  });
}

function shipProp(lights) {
  const X = SHIP.x * T, Y = SHIP.y * T;
  lights.push({ x: X + 40, y: Y + 4 * T, r: 120, color: '255,140,70', a: 0.8 });
  const c = buildShip();
  return { isShip: true, y: (SHIP.y + SHIP.h - 1) * T, draw: (d) => d.drawImage(c, X, Y - 12), emissive: (d, t) => {
    const pulse = 0.55 + Math.sin(t / 110) * 0.15;
    for (const ey of [Y + 3.1 * T, Y + 5.1 * T]) glow(d, X + 26, ey, 44, '255,150,70', pulse);
    if (Math.floor(t / 500) % 2) { R(d, X + 230, Y + 30, 5, 5, '#ff5050'); R(d, X + 230, Y + 6.2 * T, 5, 5, '#50ff8a'); }
    for (let i = 0; i < 6; i++) { d.fillStyle = `rgba(255,220,140,${0.5 + 0.5 * Math.sin(t / 300 + i)})`; d.fillRect(X + 150 + i * 40, Y + 3.3 * T, 8, 8); }
    neonText(d, 'MAHMOUD-1', X + 8.5 * T, Y + 4.7 * T, '#5ff2ff', 2, 1);
  } };
}

export function buildShip({ parked = true } = {}) {
  const W = SHIP.w * T, H = SHIP.h * T + 24;
  const [cv, g] = canvas(W, H);
  const cy = 4 * T;
  if (parked) ell(g, W / 2 + 10, H - 30, 240, 36, 'rgba(0,0,0,.35)');
  const wing = (dir) => {
    g.fillStyle = '#b9c0cf'; g.beginPath(); g.moveTo(170, cy); g.lineTo(290, cy); g.lineTo(210, cy + dir * 108); g.lineTo(120, cy + dir * 108); g.closePath(); g.fill();
    g.fillStyle = '#9aa1b2'; g.beginPath(); g.moveTo(196, cy); g.lineTo(270, cy); g.lineTo(206, cy + dir * 72); g.closePath(); g.fill();
    R(g, 128, cy + dir * 100 - (dir < 0 ? 0 : 6), 76, 6, '#e1b84b');
    for (let i = 0; i < 4; i++) R(g, 150 + i * 14, cy + dir * (30 + i * 16), 30, 2, '#7a8194');
  };
  wing(-1); wing(1);
  for (const ey of [cy - 32, cy + 32]) { R(g, 26, ey - 22, 72, 44, '#4b5262'); R(g, 20, ey - 18, 12, 36, '#22252f'); R(g, 40, ey - 22, 56, 4, '#7a8194'); R(g, 40, ey + 18, 56, 4, '#2b2f3c'); }
  g.fillStyle = '#eef1f7'; g.beginPath(); g.moveTo(60, cy - 48); g.lineTo(392, cy - 40); g.quadraticCurveTo(508, cy, 392, cy + 40); g.lineTo(60, cy + 48); g.closePath(); g.fill();
  g.fillStyle = '#cdd3df'; g.beginPath(); g.moveTo(60, cy + 4); g.lineTo(460, cy + 8); g.quadraticCurveTo(436, cy + 32, 392, cy + 40); g.lineTo(60, cy + 48); g.closePath(); g.fill();
  R(g, 80, cy - 42, 280, 3, '#ffffff'); R(g, 72, cy - 8, 360, 6, '#e1b84b');
  for (let x = 128; x < 392; x += 44) R(g, x, cy - 38, 2, 80, '#b8bfcd');
  for (let x = 90; x < 380; x += 18) R(g, x, cy + 22, 8, 3, '#9aa1b2');
  g.fillStyle = '#1b2c4a'; g.beginPath(); g.moveTo(372, cy - 32); g.quadraticCurveTo(476, cy - 16, 476, cy - 4); g.quadraticCurveTo(440, cy + 4, 372, cy + 4); g.closePath(); g.fill();
  g.fillStyle = 'rgba(120,220,255,.9)'; g.beginPath(); g.moveTo(380, cy - 28); g.quadraticCurveTo(460, cy - 14, 464, cy - 6); g.lineTo(380, cy - 6); g.closePath(); g.fill();
  R(g, 392, cy - 22, 36, 2, 'rgba(255,255,255,.8)');
  g.fillStyle = '#3d8ad6'; g.beginPath(); g.ellipse(120, cy + 20, 20, 8, -0.2, 0, Math.PI * 2); g.fill(); R(g, 136, cy + 12, 8, 6, '#3d8ad6');
  if (parked) { for (const lx of [112, 340]) { R(g, lx, cy + 44, 6, 44, '#6c7283'); R(g, lx - 10, cy + 86, 26, 6, '#6c7283'); } }
  const rx = (SHIP.ramp[0] - SHIP.x) * T + 16;
  if (parked) { g.fillStyle = '#8d94a5'; g.beginPath(); g.moveTo(rx - 22, cy + 40); g.lineTo(rx + 22, cy + 40); g.lineTo(rx + 32, H - 20); g.lineTo(rx - 32, H - 20); g.closePath(); g.fill();
  for (let y = cy + 48; y < H - 20; y += 8) R(g, rx - 26, y, 52, 2, '#a9b0c0'); }
  outline(cv, '#0b0a14');
  return cv;
}

/** A cute moon rover (animated wheels). */
export function rover(c, x, by, dir = 1, t = 0) {
  const s = dir < 0 ? -1 : 1;
  c.save(); c.translate(x, by); c.scale(s, 1);
  ell(c, 0, 2, 34, 6, 'rgba(0,0,0,.35)');
  R(c, -30, -26, 60, 18, '#e9ecf2'); R(c, -30, -26, 60, 4, '#ffffff'); R(c, -30, -10, 60, 4, '#9aa1b2');
  R(c, -6, -42, 30, 18, '#1b2c4a'); R(c, -4, -40, 26, 10, '#7fe8ff');
  R(c, -26, -48, 2, 24, '#6b7385'); R(c, -30, -50, 10, 4, '#ff7a5c');
  for (const wx of [-22, 0, 22]) { ell(c, wx, -4, 9, 9, '#2b2f3c'); ell(c, wx, -4, 5, 5, '#6b7385'); const a = t / 120; R(c, wx + Math.cos(a) * 4 - 1, -4 + Math.sin(a) * 4 - 1, 2, 2, '#c9ced9'); }
  c.restore();
}

function groundAnimations() {
  // data pulses running along the neon curbs of the main roads + the fountain's water
  const fx = FOUNTAIN.cx * T, fy = FOUNTAIN.cy * T, fr = FOUNTAIN.r * T, fry = fr * 0.8;
  return (d, t) => {
    // fountain: underwater lights slowly changing colour, expanding ripples, caustic sparkles, rim jets arcing inwards
    const hue = (t / 80) % 360;
    const uw = d.createRadialGradient(fx, fy, 4, fx, fy, fr); uw.addColorStop(0, `hsla(${hue},80%,65%,.35)`); uw.addColorStop(1, 'hsla(190,80%,50%,0)');
    d.fillStyle = uw; d.beginPath(); d.ellipse(fx, fy, fr + 2, fry + 1, 0, 0, Math.PI * 2); d.fill();
    for (let k = 0; k < 3; k++) { const ph = ((t / 2400) + k / 3) % 1; d.strokeStyle = `rgba(200,240,255,${0.45 * (1 - ph)})`; d.lineWidth = 1.5; d.beginPath(); d.ellipse(fx, fy, 12 + ph * (fr - 14), (12 + ph * (fr - 14)) * 0.8, 0, 0, Math.PI * 2); d.stroke(); }
    for (let i = 0; i < 14; i++) { const a = i * 2.4 + t / 3000, rr = (0.25 + ((i * 37) % 70) / 100) * fr, k = (Math.sin(t / 300 + i * 1.7) + 1) / 2; d.fillStyle = `rgba(255,255,255,${0.15 + 0.5 * k})`; d.fillRect(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr * 0.8, 2, 1); }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, sx = fx + Math.cos(a) * (fr + 6), sy = fy - 4 + Math.sin(a) * (fry + 4);
      for (let j = 0; j < 6; j++) { const p = ((t / 900) + j / 6) % 1; const px = sx + (fx - sx) * p * 0.75, py = sy + (fy - sy) * p * 0.75 - Math.sin(p * Math.PI) * 22; d.fillStyle = `rgba(190,235,255,${0.75 - p * 0.45})`; d.fillRect(px - 1, py - 1, 2, 3); }
    }
    d.fillStyle = 'rgba(95,242,255,.85)';
    for (let i = 0; i < 10; i++) { const x = ((t / 8 + i * 280) % (PW + 200)) - 100; d.fillRect(x, 16 * T + 3, 18, 2); d.fillRect(PW - x, 19 * T - 5, 18, 2); }
    for (let i = 0; i < 6; i++) { const y = ((t / 10 + i * 300) % (40 * T)) + 19 * T; d.fillRect(18 * T + 3, y, 2, 18); d.fillRect(21 * T - 5, 40 * T + 19 * T - y, 2, 18); }
    d.fillStyle = 'rgba(255,181,71,.8)';
    for (let i = 0; i < 8; i++) { const x = ((t / 9 + i * 300) % (30 * T)) + 44 * T; d.fillRect(x, 44 * T + 2, 14, 2); }
  };
}

// ───────────────────────────── lighting & sky ─────────────────────────────

/** Half-resolution light map (multiplied over the scene). */
function buildLightmap(lights) {
  const S = 0.5;
  const [c, g] = canvas(PW * S, PH * S);
  g.fillStyle = '#4b5278';
  g.fillRect(0, 0, PW * S, PH * S);
  g.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const x = l.x * S, y = l.y * S, r = l.r * S;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${l.color},${l.a * 0.8})`);
    grd.addColorStop(0.5, `rgba(${l.color},${l.a * 0.28})`);
    grd.addColorStop(1, `rgba(${l.color},0)`);
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.globalCompositeOperation = 'source-over';
  c.scaleUp = 1 / S;
  return c;
}

/** The view beyond the crater edge: deep space, nebula and a huge Earth. */
export function buildSky(globeImage) {
  const w = 1600, h = 760;
  const [c, g] = canvas(w, h);
  g.fillStyle = '#02030a'; g.fillRect(0, 0, w, h);
  const rnd = mulberry32(77);
  for (const [nx, ny, nr, col] of [[0.18, 0.3, 420, '120,80,220'], [0.8, 0.2, 360, '255,79,216'], [0.5, 0.75, 500, '60,140,255']]) { const neb = g.createRadialGradient(w * nx, h * ny, 10, w * nx, h * ny, nr); neb.addColorStop(0, `rgba(${col},.16)`); neb.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = neb; g.fillRect(0, 0, w, h); }
  for (let i = 0; i < 1600; i++) { const b = rnd(); g.fillStyle = `rgba(${200 + b * 55},${210 + b * 45},255,${0.25 + b * 0.75})`; const s = b > 0.97 ? 3 : b > 0.85 ? 2 : 1; g.fillRect(rnd() * w, rnd() * h, s, s); }
  const ex = w * 0.62, ey = h * 0.6, er = 250;
  const halo = g.createRadialGradient(ex, ey, er * 0.95, ex, ey, er * 1.4); halo.addColorStop(0, 'rgba(110,170,255,.55)'); halo.addColorStop(1, 'rgba(110,170,255,0)');
  g.fillStyle = halo; g.beginPath(); g.arc(ex, ey, er * 1.4, 0, Math.PI * 2); g.fill();
  if (globeImage) { g.imageSmoothingEnabled = true; g.drawImage(globeImage, ex - er, ey - er, er * 2, er * 2); }
  else { g.fillStyle = '#2a6fd0'; g.beginPath(); g.arc(ex, ey, er, 0, Math.PI * 2); g.fill(); }
  return c;
}
