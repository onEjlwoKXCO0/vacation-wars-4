// HD interiors (32 px per tile): walls, floors and furniture for every enterable building.
// Furniture data comes from shared/interiors.js; each kind has a drawer here. Tall furniture
// becomes a y-sorted sprite; lamps, screens, candles and neon go into an emissive pass.
import { INTERIORS, CODE_NATION } from '../../shared/interiors.js';
import { ROLES } from '../../shared/data/roles.js';
import { COUNTRIES } from '../../shared/data/countries.js';
import { drawPixelText, drawPixelTextCentered, textWidth } from './pixelfont.js';
import { shade, mix, outline, characterSheet, drawCharacter, mahmoudPortrait } from './sprites.js';
import { canvas, R, ell, glow, neonText, neonRect, flagCanvas } from './campusArt.js';

const T = 32;
const FLAT = new Set(['red_carpet', 'floor_emblem', 'video_wall', 'floor_lights', 'arcade_sign', 'observation_deck', 'rug', 'kilim', 'carpet', 'doormat', 'cyber_mat', 'dancefloor', 'stone_path', 'hammock', 'fairy_lights', 'stairs', 'pipes']);
const AMB = {
  ambient: { warm: '#5a4a52', cosy: '#4a3a40', cyan: '#3a4a66', gold: '#5a4a40', purple: '#5a4672', club: '#45305a', cyber: '#2e2a4e', tower: '#2a3654', hq: '#34405e', green: '#3a5a50', violet: '#4f4272' },
};

export function buildInterior(id) {
  const I = INTERIORS[id];
  const W = I.w * T, H = I.h * T;
  const [ground, g] = canvas(W, H);
  const lights = [];
  const emissive = [];
  const L = (x, y, r, color, a = 0.9) => lights.push({ x, y, r, color, a });
  const E = (fn) => emissive.push(fn);
  drawFloor(g, I, E);
  drawWalls(g, I, E, L);
  const sprites = [];
  for (const f of I.furniture) {
    const draw = DRAW[f.kind];
    if (!draw) continue;
    const flat = FLAT.has(f.kind) || f.y + f.h <= 3.05;
    const x = f.x * T, y = f.y * T, w = f.w * T, h = f.h * T;
    const ctx = { I, f, x, y, w, h, L, E };
    if (flat) { draw(g, ctx); continue; }
    // sprite with headroom above for tall furniture
    const head = 3 * T;
    const [c, sg] = canvas(w + 16, h + head + 8);
    sg.translate(8 - x, head - y);
    draw(sg, ctx);
    outline(c, '#0b0a14');
    sprites.push({ y: y + h, draw: (d) => d.drawImage(c, x - 8, y - head) });
  }
  // global lights per theme
  const amb = AMB.ambient[I.lights] || '#4a4a5a';
  if (I.lights === 'club') { L(W / 2, H / 2, 300, '255,79,216', 0.5); L(W / 2, 4 * T, 200, '95,242,255', 0.4); }
  if (I.lights === 'cyan') L(W / 2, 3 * T, 360, '95,242,255', 0.5);
  if (I.lights === 'gold') L(W / 2, 5 * T, 380, '255,200,120', 0.6);
  if (I.lights === 'cyber') { L(W * 0.25, 4 * T, 300, '255,79,216', 0.45); L(W * 0.75, 4 * T, 300, '95,242,255', 0.45); L(W / 2, 6 * T, 260, '155,140,255', 0.35); }
  if (I.lights === 'hq') { L(W / 2, 3.6 * T, 320, '255,214,140', 0.6); L(W * 0.2, 8 * T, 220, '95,242,255', 0.45); L(W * 0.8, 8 * T, 220, '95,242,255', 0.45); L(W / 2, 9 * T, 200, '240,195,90', 0.35); }
  if (I.lights === 'tower') { L(W / 2, 6 * T, 340, '95,242,255', 0.55); L(W * 0.15, 9 * T, 200, '255,79,216', 0.35); L(W * 0.85, 9 * T, 200, '240,195,90', 0.35); }
  if (I.lights === 'purple') L(W / 2, 4 * T, 300, '199,125,255', 0.6);
  if (I.lights === 'green') L(W / 2, 4 * T, 340, '120,255,190', 0.5);
  if (I.lights === 'violet') L(W / 2, 4 * T, 240, '199,125,255', 0.6);
  if (I.lights === 'warm' || I.lights === 'cosy') L(W / 2, 4 * T, 320, I.theme.warm || '255,200,130', 0.55);
  const [lm, lg] = canvas(W, H);
  lg.fillStyle = amb; lg.fillRect(0, 0, W, H);
  lg.globalCompositeOperation = 'lighter';
  for (const l of lights) { const gr = lg.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); gr.addColorStop(0, `rgba(${l.color},${l.a * 0.8})`); gr.addColorStop(0.5, `rgba(${l.color},${l.a * 0.3})`); gr.addColorStop(1, `rgba(${l.color},0)`); lg.fillStyle = gr; lg.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); }
  return { ground, lightmap: lm, lights, sprites, emissive: (d, t) => { for (const e of emissive) e(d, t); } };
}

// ───────────────────────── floors & walls ─────────────────────────

function drawFloor(g, I, E) {
  const W = I.w * T, H = I.h * T;
  const kind = I.theme.floor;
  const y0 = 3 * T;
  for (let ty = 3; ty < I.h; ty++) for (let tx = 0; tx < I.w; tx++) {
    const x = tx * T, y = ty * T, alt = (tx + ty) % 2;
    switch (kind) {
      case 'wood': for (let k = 0; k < 4; k++) { const c = ['#8a5a34', '#7a4e2c', '#94643a', '#83552f'][(tx * 3 + ty + k) % 4]; R(g, x, y + k * 8, T, 8, c); R(g, x, y + k * 8 + 7, T, 1, '#5a3a1e'); R(g, x + ((tx * 13 + k * 7) % 28), y + k * 8, 1, 8, '#5a3a1e'); R(g, x + 3, y + k * 8 + 2, 6, 1, shade(c, 0.12)); } break;
      case 'stone': R(g, x, y, T, T, alt ? '#8a8578' : '#7d786c'); R(g, x + 1, y + 1, T - 2, 1, '#a39e90'); R(g, x, y + T - 1, T, 1, '#5a564c'); R(g, x + T - 1, y, 1, T, '#5a564c'); if ((tx * 7 + ty) % 5 === 0) R(g, x + 8, y + 12, 10, 2, '#6b675c'); break;
      case 'parquet': for (let k = 0; k < 4; k++) for (let j = 0; j < 2; j++) { const v = (k + j + tx + ty) % 2; R(g, x + j * 16, y + k * 8, 16, 8, v ? '#b07a44' : '#9a6a3a'); R(g, x + j * 16, y + k * 8 + 7, 16, 1, '#6a4422'); if (v) R(g, x + j * 16 + 15, y + k * 8, 1, 8, '#6a4422'); } break;
      case 'zellige': { R(g, x, y, T, T, '#f2ead8'); const c = ['#1e7a4a', '#2a5db0', '#c1272d', '#f0c35a'][(tx + ty * 2) % 4]; g.fillStyle = c; g.beginPath(); g.moveTo(x + 16, y + 3); g.lineTo(x + 29, y + 16); g.lineTo(x + 16, y + 29); g.lineTo(x + 3, y + 16); g.closePath(); g.fill(); R(g, x + 13, y + 13, 6, 6, '#f2ead8'); R(g, x + 15, y + 15, 2, 2, c); R(g, x, y, T, 1, '#d9cfb8'); R(g, x, y, 1, T, '#d9cfb8'); break; }
      case 'metal': R(g, x, y, T, T, '#2b3148'); R(g, x + 1, y + 1, T - 2, T - 2, alt ? '#323a55' : '#2f3650'); R(g, x + 1, y + 1, T - 2, 1, '#4b5578'); for (const [cx, cy] of [[4, 4], [27, 4], [4, 27], [27, 27]]) R(g, x + cx, y + cy, 2, 2, '#5d6890'); break;
      case 'hqmarble': { // dark marble with gold inlay
        const v = (tx * 13 + ty * 7) % 5;
        R(g, x, y, T, T, ['#1d2236', '#202640', '#1b2034', '#22283f', '#1e2338'][v]);
        g.strokeStyle = 'rgba(200,210,240,.07)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + (v * 6) % T, y); g.quadraticCurveTo(x + 16, y + 10 + v * 2, x + T, y + (v * 9) % T); g.stroke();
        if (tx % 3 === 0) R(g, x, y, 1, T, 'rgba(240,195,90,.35)'); if (ty % 3 === 0) R(g, x, y, T, 1, 'rgba(240,195,90,.35)');
        break; }
      case 'towerdeck': { // polished deck plates with inset light strips
        R(g, x, y, T, T, alt ? '#1f2740' : '#1c2339'); R(g, x + 1, y + 1, T - 2, T - 2, alt ? '#252f4c' : '#212a45');
        R(g, x + 2, y + 2, T - 6, 2, 'rgba(255,255,255,.06)'); R(g, x, y + T - 1, T, 1, '#141a2c'); R(g, x + T - 1, y, 1, T, '#141a2c');
        if (tx % 4 === 0) R(g, x, y + 14, 2, 4, '#3a4a7a'); if ((tx * 3 + ty * 7) % 17 === 0) R(g, x + 10, y + 10, 12, 12, 'rgba(95,242,255,.05)'); break; }
      case 'neongrid': R(g, x, y, T, T, alt ? '#1d2140' : '#191c36'); R(g, x + 2, y + 2, T - 4, T - 4, alt ? '#22274a' : '#1e2240'); R(g, x, y, T, 1, '#3a4280'); R(g, x, y, 1, T, '#3a4280'); if ((tx * 7 + ty * 3) % 11 === 0) R(g, x + 6, y + 6, T - 12, T - 12, 'rgba(255,79,216,.08)'); if ((tx + ty * 5) % 13 === 0) R(g, x + 14, y + 14, 4, 4, '#5ff2ff'); break;
      case 'bazaar': R(g, x, y, T, T, alt ? '#a8743e' : '#9a6a38'); R(g, x + 2, y + 2, T - 4, T - 4, alt ? '#b8844a' : '#a8743e'); R(g, x + 14, y + 14, 4, 4, '#e85b5b'); break;
      case 'grate': R(g, x, y, T, T, '#1f1d26'); for (let k = 0; k < T; k += 4) { R(g, x + k, y, 1, T, '#2e2b38'); R(g, x, y + k, T, 1, '#2e2b38'); } if ((tx * 5 + ty) % 7 === 0) R(g, x + 6, y + 10, 12, 6, 'rgba(199,125,255,.12)'); break;
      case 'dance': R(g, x, y, T, T, '#140c18'); R(g, x + 1, y + 1, T - 2, T - 2, alt ? '#22122a' : '#1a1020'); break;
      case 'moss': { R(g, x, y, T, T, '#173a32'); for (let k = 0; k < 14; k++) R(g, x + ((tx * 31 + k * 17) % 30), y + ((ty * 17 + k * 11) % 30), 2, 2, k % 5 === 0 ? '#3cf2c0' : k % 2 ? '#1f4a40' : '#122e28'); break; }
      case 'carpet': { R(g, x, y, T, T, '#3a1f4a'); R(g, x + 2, y + 2, T - 4, T - 4, '#4b2a5e'); if (alt) { R(g, x + 12, y + 12, 8, 8, '#f0c35a'); R(g, x + 14, y + 14, 4, 4, '#3a1f4a'); } break; }
      default: R(g, x, y, T, T, alt ? '#555' : '#4a4a4a');
    }
  }
  // soft shadow under the back wall
  const gr = g.createLinearGradient(0, y0, 0, y0 + 40); gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, y0, W, 40);
  if (kind === 'towerdeck') E((d, t) => { // reflections of the hologram sliding on the deck
    const cx = W / 2 + Math.sin(t / 1800) * 40; const gr = d.createRadialGradient(cx, 8 * T, 10, cx, 8 * T, 220); gr.addColorStop(0, 'rgba(95,242,255,.10)'); gr.addColorStop(1, 'rgba(95,242,255,0)'); d.fillStyle = gr; d.fillRect(0, y0, W, H - y0);
  });
  if (kind === 'neongrid') E((d, t) => { // a light pulse running along the floor grid
    const row = 3 + Math.floor(t / 120) % (I.h - 3); d.fillStyle = 'rgba(95,242,255,.1)'; d.fillRect(0, row * T, W, 1);
    const col = Math.floor(t / 90) % I.w; d.fillStyle = 'rgba(255,79,216,.1)'; d.fillRect(col * T, y0, 1, H - y0);
  });
  if (kind === 'dance') void E;
  void H;
}

function drawWalls(g, I, E, L) {
  const W = I.w * T, H = I.h * T, wh = 3 * T;
  const st = I.theme.wall;
  const base = {
    hqwall: '#151a2c', observation: '#0b1020', cyber: '#0d0f1e', azulejo: '#f4f6fb', timber: '#f6f3ec', wycinanki: '#efe2c8', riad: '#e0a870', screens: '#1b2236', bazaar: '#5a2a3a', graffiti: '#2a2430', egypt: '#2a1a14', glass: '#0e2a30', tent: '#3a1f5a',
  }[st] || '#666';
  R(g, 0, 0, W, wh, base);
  switch (st) {
    case 'azulejo':
      for (let y = 30; y < wh - 18; y += 12) for (let x = 0; x < W; x += 12) { const k = ((x + y) / 12) % 2; R(g, x, y, 12, 12, k ? '#f4f6fb' : '#e6eefb'); R(g, x + 2, y + 2, 8, 8, '#2a5db0'); R(g, x + 4, y + 4, 4, 4, k ? '#f4f6fb' : '#9ec0ff'); R(g, x + 5, y + 2, 2, 8, k ? '#5b8cff' : '#2a5db0'); R(g, x + 2, y + 5, 8, 2, k ? '#5b8cff' : '#2a5db0'); }
      R(g, 0, 26, W, 4, '#2a5db0'); break;
    case 'timber':
      for (let x = 0; x < W; x += 40) { R(g, x, 0, 6, wh, '#4a2e1c'); R(g, x + 1, 0, 1, wh, '#6a4a30'); }
      R(g, 0, 36, W, 5, '#4a2e1c'); for (let x = 0; x < W; x += 40) { g.strokeStyle = '#4a2e1c'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 6, 41); g.lineTo(x + 38, wh - 16); g.stroke(); }
      R(g, 0, wh - 30, W, 14, '#9a958a'); break;
    case 'wycinanki':
      for (let x = 10; x < W; x += 44) { const c = ['#dc143c', '#1e7a4a', '#2a5db0', '#f0c35a'][(x / 44 | 0) % 4]; ell(g, x + 12, 46, 12, 12, c); ell(g, x + 12, 46, 6, 6, '#efe2c8'); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; R(g, x + 12 + Math.cos(a) * 16 - 2, 46 + Math.sin(a) * 16 - 2, 4, 4, c); } }
      R(g, 0, wh - 34, W, 18, '#8a5a34'); R(g, 0, wh - 34, W, 2, '#b07a44'); break;
    case 'riad':
      for (let x = 0; x < W; x += 48) { R(g, x + 6, 20, 36, wh - 36, shade(base, -0.12)); g.fillStyle = shade(base, -0.12); g.beginPath(); g.arc(x + 24, 26, 18, Math.PI, 0); g.fill(); R(g, x + 10, 32, 28, wh - 48, '#1e5a3a33'); }
      for (let x = 0; x < W; x += 8) { R(g, x, wh - 26, 8, 10, ['#1e7a4a', '#2a5db0', '#f4f6fb', '#c1272d'][(x / 8) % 4]); R(g, x + 3, wh - 23, 2, 4, '#f0c35a'); } break;
    case 'screens':
      for (let x = 0; x < W; x += 64) { R(g, x + 4, 12, 56, 52, '#0b1020'); R(g, x + 4, 12, 56, 2, '#3a4466'); }
      E((d, t) => { for (let x = 0; x < W; x += 64) { d.fillStyle = `rgba(95,242,255,${0.12 + 0.05 * Math.sin(t / 400 + x)})`; d.fillRect(x + 6, 14, 52, 48); d.fillStyle = 'rgba(95,242,255,.7)'; for (let k = 0; k < 5; k++) d.fillRect(x + 10, 20 + k * 8, (t / 15 + k * 17 + x) % 44, 2); } });
      L(W / 2, 40, 300, '95,242,255', 0.5); break;
    case 'hqwall': {
      // calm navy panels, thin gold trims, warm sconces — no screens, no blinking
      for (let x2 = 0; x2 < W; x2 += 64) { R(g, x2 + 3, 8, 58, wh - 30, '#1b2136'); R(g, x2 + 3, 8, 58, 1, '#2a3150'); R(g, x2 + 7, 12, 50, wh - 38, '#181d30'); }
      R(g, 0, 4, W, 2, '#d9a83a'); R(g, 0, wh - 20, W, 3, '#d9a83a'); R(g, 0, wh - 17, W, 1, '#8a6216');
      for (let x2 = 32; x2 < W; x2 += 128) { R(g, x2 - 3, 30, 6, 10, '#8a6216'); ell(g, x2, 28, 6, 4, '#ffe08a'); }
      E((d, t) => { for (let x2 = 32; x2 < W; x2 += 128) glow(d, x2, 26, 34, '255,214,140', 0.3 + 0.03 * Math.sin(t / 1500 + x2)); });
      break; }
    case 'observation': {
      // a panoramic window over the Moon: stars, the Earth hanging in the sky, craters on the horizon
      const sky = g.createLinearGradient(0, 0, 0, wh); sky.addColorStop(0, '#02030a'); sky.addColorStop(0.75, '#0a1230'); sky.addColorStop(1, '#141c3c'); g.fillStyle = sky; g.fillRect(0, 0, W, wh);
      for (let i = 0; i < 220; i++) R(g, (i * 137) % W, (i * 53) % (wh - 34), 1, 1, i % 7 ? '#ffffff99' : '#9fd3ff');
      const ex = W * 0.72, ey = 34, er = 22;
      const eg = g.createRadialGradient(ex - 6, ey - 6, 2, ex, ey, er); eg.addColorStop(0, '#7fd0ff'); eg.addColorStop(0.6, '#2a6fd0'); eg.addColorStop(1, '#0b2a6a'); g.fillStyle = eg; g.beginPath(); g.arc(ex, ey, er, 0, Math.PI * 2); g.fill();
      for (const [dx, dy, w2, h2] of [[-10, -6, 9, 7], [2, -12, 7, 5], [4, 2, 10, 8], [-14, 6, 6, 4]]) { g.fillStyle = '#3f9a55'; g.beginPath(); g.ellipse(ex + dx, ey + dy, w2, h2, 0.4, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(ex - 4, ey - 2, 16, 3, -0.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(2,3,10,.55)'; g.beginPath(); g.arc(ex + 9, ey + 4, er, 0, Math.PI * 2); g.fill(); // terminator
      g.strokeStyle = 'rgba(120,190,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(ex, ey, er + 2, 0, Math.PI * 2); g.stroke();
      // lunar horizon
      g.fillStyle = '#5c6070'; g.beginPath(); g.moveTo(0, wh - 22); for (let x2 = 0; x2 <= W; x2 += 16) g.lineTo(x2, wh - 26 - Math.abs(Math.sin(x2 / 70)) * 8 - (x2 % 48 === 0 ? 4 : 0)); g.lineTo(W, wh); g.lineTo(0, wh); g.fill();
      for (let i = 0; i < 18; i++) { const cx2 = (i * 151) % W, cy2 = wh - 14 + (i % 3) * 3; g.fillStyle = '#4a4e5c'; g.beginPath(); g.ellipse(cx2, cy2, 8 + (i % 4) * 3, 2.5, 0, 0, Math.PI * 2); g.fill(); }
      // window mullions & frame
      for (let x2 = 0; x2 <= W; x2 += 104) { R(g, x2 - 3, 0, 6, wh - 16, '#1b2236'); R(g, x2 - 1, 0, 2, wh - 16, '#3a4466'); }
      R(g, 0, 0, W, 6, '#1b2236'); R(g, 0, 5, W, 1, '#3a4466'); R(g, 0, wh - 18, W, 8, '#1b2236'); R(g, 0, wh - 18, W, 1, '#5d6890');
      E((d, t) => {
        const sx = (t / 40) % (W + 60) - 30; d.fillStyle = '#ffffff'; d.fillRect(sx, 14 + Math.sin(t / 900) * 3, 2, 1); d.fillStyle = 'rgba(255,79,110,.9)'; if (Math.floor(t / 400) % 2) d.fillRect(sx + 2, 14 + Math.sin(t / 900) * 3, 1, 1);
        for (let i = 0; i < 12; i++) { const k = (Math.sin(t / 500 + i * 3.1) + 1) / 2; d.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * k})`; d.fillRect((i * 271) % W, (i * 97) % (wh - 40), 1, 1); }
        d.save(); d.globalAlpha = 0.07 + 0.03 * Math.sin(t / 1200); d.fillStyle = '#9fd3ff'; for (let x2 = 0; x2 < W; x2 += 104) d.fillRect(x2 + 10, 8, 24, wh - 30); d.restore(); // glass reflections
      });
      L(W * 0.72, 30, 160, '120,190,255', 0.5);
      break; }
    case 'cyber': {
      // dark chrome panels, vertical neon tubes, holo ads, cable trays
      for (let x = 0; x < W; x += 48) { R(g, x + 2, 6, 44, wh - 26, '#151831'); R(g, x + 2, 6, 44, 2, '#2a2f5a'); R(g, x + 4, wh - 24, 40, 2, '#07080f'); }
      for (let x = 0; x < W; x += 8) R(g, x, 0, 4, 4, '#1d2140');
      const ads = ['HACKER', 'THIEF', 'CUPID', 'CHAOS', 'BOOKIE', 'SPY'];
      E((d, t) => {
        for (let x = 46, i = 0; x < W; x += 96, i++) { const c = i % 2 ? '#ff4fd8' : '#5ff2ff'; d.save(); d.globalAlpha = 0.8 + 0.2 * Math.sin(t / 200 + i); d.shadowColor = c; d.shadowBlur = 12; d.fillStyle = c; d.fillRect(x, 10, 3, wh - 34); d.restore(); }
        for (let i = 0, x = 60; x < W - 60; x += 192, i++) { const on = (Math.floor(t / 1600) + i) % 2; d.fillStyle = 'rgba(10,12,30,.9)'; d.fillRect(x, 24, 96, 40); neonText(d, ads[(i + Math.floor(t / 3200)) % ads.length], x + 48, 32, on ? '#f0c35a' : '#9b8cff', 2, 0.9); d.fillStyle = 'rgba(95,242,255,.5)'; d.fillRect(x + 6, 54, ((t / 15 + i * 40) % 84), 2); }
      });
      R(g, 0, wh - 20, W, 4, '#2a2f5a'); E((d, t) => { d.fillStyle = `rgba(255,79,216,${0.5 + 0.3 * Math.sin(t / 300)})`; d.fillRect(0, wh - 20, W, 2); });
      L(W / 2, 40, 320, '155,140,255', 0.45);
      break; }
    case 'bazaar':
      for (let x = 0; x < W; x += 24) { R(g, x, 0, 12, wh - 20, '#7a2a3a'); R(g, x + 12, 0, 12, wh - 20, '#5a2a3a'); for (let y = 10; y < wh - 30; y += 14) R(g, x + 4, y, 4, 4, '#f0c35a'); }
      R(g, 0, wh - 20, W, 4, '#f0c35a'); break;
    case 'graffiti':
      for (let x = 0; x < W; x += 16) R(g, x, 0, 2, wh, '#221d28');
      drawPixelText(g, 'NO COPS', 40, 40, '#ff4fd866', 3); drawPixelText(g, 'CASH ONLY', W - 230, 50, '#5ff2ff55', 3); drawPixelText(g, 'H', W / 2 - 160, 30, '#f0c35a55', 5);
      break;
    case 'egypt':
      for (let x = 0; x < W; x += 32) { R(g, x, 0, 30, wh - 16, '#3a2414'); for (let y = 10; y < wh - 30; y += 16) { R(g, x + 6, y, 6, 8, '#d9b45a'); R(g, x + 16, y + 2, 8, 4, '#1f4fb5'); } }
      E((d, t) => { d.save(); d.globalAlpha = 0.5 + 0.3 * Math.sin(t / 300); d.fillStyle = '#ff4fd8'; d.fillRect(0, wh - 18, W, 3); d.restore(); });
      break;
    case 'glass':
      { const gr = g.createLinearGradient(0, 0, 0, wh); gr.addColorStop(0, '#05121a'); gr.addColorStop(1, '#0e2a30'); g.fillStyle = gr; g.fillRect(0, 0, W, wh); for (let i = 0; i < 80; i++) R(g, (i * 97) % W, (i * 41) % (wh - 20), 1, 1, '#ffffffaa'); for (let x = 0; x < W; x += 40) R(g, x, 0, 3, wh, '#3a5a5a'); R(g, 0, 30, W, 2, '#3a5a5a'); }
      break;
    case 'tent':
      for (let x = 0; x < W; x += 28) { R(g, x, 0, 14, wh, '#4b2a74'); R(g, x + 14, 0, 14, wh, '#3a1f5a'); }
      for (let i = 0; i < 20; i++) { const x = (i * 71) % W, y = 10 + (i * 37) % (wh - 30); R(g, x, y, 3, 3, '#f0c35a'); }
      break;
  }
  // baseboard, side walls, front wall with doorway
  R(g, 0, wh - 6, W, 6, shade(base, -0.5)); R(g, 0, wh - 6, W, 1, shade(base, -0.2));
  R(g, 0, 0, 10, H, shade(base, -0.55)); R(g, W - 10, 0, 10, H, shade(base, -0.55));
  R(g, 8, wh, 2, H - wh, 'rgba(0,0,0,.35)'); R(g, W - 10, wh, 2, H - wh, 'rgba(0,0,0,.35)');
  const fy = H - 12;
  R(g, 0, fy, W, 12, shade(base, -0.55));
  if (I.exit) { const dx = I.exit.x * T; R(g, dx - T, fy, 2 * T, 12, '#0b0a14'); R(g, dx - T - 4, fy - 4, 4, 16, '#5d6478'); R(g, dx + T, fy - 4, 4, 16, '#5d6478'); E((d) => { d.fillStyle = 'rgba(120,200,255,.25)'; d.fillRect(dx - T, fy - 2, 2 * T, 14); }); }
}

// ───────────────────────── furniture drawers ─────────────────────────

/** Live arcade standings for the tower's leaderboard screen (set from the game view). */
let ARCADE_BOARD = [];
export function setArcadeBoard(rows) { ARCADE_BOARD = rows; }

/** A real arcade cabinet: lit marquee, speaker grille, bezel + screen, angled control panel with stick and buttons, coin door. */
function arcadeCabinet(g, { x, y, w, h, E, L }, { accent, rgb, title, screen }) {
  const top = y - 62, bot = y + h;
  // side panels with art stripes
  g.fillStyle = '#141024'; g.beginPath(); g.moveTo(x, bot); g.lineTo(x, top + 6); g.lineTo(x + 8, top); g.lineTo(x + w - 8, top); g.lineTo(x + w, top + 6); g.lineTo(x + w, bot); g.fill();
  for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? accent : '#2a2040'; g.beginPath(); g.moveTo(x, bot - 12 - k * 10); g.lineTo(x + 6, bot - 22 - k * 10); g.lineTo(x + 6, bot - 18 - k * 10); g.lineTo(x, bot - 8 - k * 10); g.fill(); g.beginPath(); g.moveTo(x + w, bot - 12 - k * 10); g.lineTo(x + w - 6, bot - 22 - k * 10); g.lineTo(x + w - 6, bot - 18 - k * 10); g.lineTo(x + w, bot - 8 - k * 10); g.fill(); }
  // marquee box
  R(g, x + 6, top + 2, w - 12, 16, '#0a0716'); R(g, x + 6, top + 2, w - 12, 1, '#ffffff33');
  // speaker grille
  for (let k = 0; k < 10; k++) R(g, x + 14 + k * ((w - 28) / 10), top + 21, 2, 2, '#2a2040');
  // bezel + screen
  R(g, x + 8, top + 26, w - 16, 34, '#221a36'); R(g, x + 12, top + 29, w - 24, 28, '#05040c');
  // control panel (angled) with joystick and buttons
  g.fillStyle = '#2a2040'; g.beginPath(); g.moveTo(x + 4, top + 62); g.lineTo(x + w - 4, top + 62); g.lineTo(x + w, top + 74); g.lineTo(x, top + 74); g.fill();
  R(g, x, top + 74, w, 2, accent);
  R(g, x + 16, top + 62, 3, 6, '#9aa3c0'); ell(g, x + 17.5, top + 62, 4, 4, '#e54b4b'); ell(g, x + 16.5, top + 61, 1.5, 1.5, '#ff9a9a');
  ['#ff4f6e', '#48e08f', '#5ff2ff', '#f0c35a'].forEach((c, i) => { ell(g, x + 34 + i * 10, top + 68 - (i % 2) * 2, 3.5, 2.5, c); ell(g, x + 33 + i * 10, top + 67 - (i % 2) * 2, 1.5, 1, '#ffffffaa'); });
  // coin door + kick plate
  R(g, x + w / 2 - 14, top + 80, 28, 22, '#0f0b1c'); R(g, x + w / 2 - 14, top + 80, 28, 1, '#ffffff22');
  R(g, x + w / 2 - 8, top + 86, 4, 8, '#3a0a10'); R(g, x + w / 2 + 4, top + 86, 4, 8, '#3a0a10');
  R(g, x + 2, bot - 6, w - 4, 6, '#0b0814');
  E((d, t) => {
    const mg = d.createLinearGradient(0, top + 2, 0, top + 18); mg.addColorStop(0, `rgba(${rgb},.85)`); mg.addColorStop(1, `rgba(${rgb},.35)`);
    d.fillStyle = mg; d.fillRect(x + 7, top + 3, w - 14, 14);
    drawPixelTextCentered(d, title, x + w / 2, top + 6, '#ffffff', 2);
    d.fillStyle = `rgba(${rgb},.12)`; d.fillRect(x + 12, top + 29, w - 24, 28);
    screen(d, x + 12, top + 29, w - 24, 28, t);
    d.fillStyle = 'rgba(255,255,255,.05)'; d.fillRect(x + 12, top + 29 + 14 - 13 * Math.cos(t / 900), w - 24, 1); // scanline (ping-pong, no jump)
    const c = 0.45 + 0.35 * Math.sin(t / 700); d.fillStyle = `rgba(255,120,60,${c})`; d.fillRect(x + w / 2 - 7, top + 87, 2, 6); d.fillRect(x + w / 2 + 5, top + 87, 2, 6);
    glow(d, x + w / 2, top + 10, 36, rgb, 0.25);
  });
  L(x + w / 2, y, 150, rgb, 0.65);
}

/** Gold-framed wall plaque with a few calm lines of text (no blinking). */
function plaque(g, x, y, w, h, title, rows) {
  R(g, x, y, w, h, '#120e1a'); R(g, x, y, w, 2, '#ffe08a'); R(g, x, y + h - 2, w, 2, '#8a6216'); R(g, x, y, 2, h, '#d9a83a'); R(g, x + w - 2, y, 2, h, '#d9a83a');
  drawPixelTextCentered(g, title, x + w / 2, y + 5, '#f0c35a', 2);
  R(g, x + w / 2 - 24, y + 19, 48, 1, '#8a6216');
  rows.forEach((r, i) => drawPixelText(g, r, x + 10, y + 24 + i * 8, '#c9c2b0', 1));
}
const wood = (g, x, y, w, h, c = '#7a4e2c') => { R(g, x, y, w, h, c); R(g, x, y, w, 2, shade(c, 0.25)); R(g, x, y + h - 3, w, 3, shade(c, -0.35)); for (let k = 6; k < h - 3; k += 6) R(g, x + 2, y + k, w - 4, 1, shade(c, -0.15)); };
const legs = (g, x, y, w, h, c = '#5a3a1e') => { R(g, x + 2, y + h - 8, 3, 8, c); R(g, x + w - 5, y + h - 8, 3, 8, c); };
const shelfItems = (g, x, y, w, colors, n = 6) => { for (let i = 0; i < n; i++) { const c = colors[i % colors.length]; const bh = 6 + (i * 5) % 6; R(g, x + 3 + i * (w - 6) / n, y - bh, (w - 6) / n - 2, bh, c); R(g, x + 3 + i * (w - 6) / n, y - bh, 1, bh, shade(c, 0.3)); } };

const DRAW = {
  stairs(g, { x, y, w, h, f }) {
    for (let i = 0; i < 6; i++) { const c = shade('#8a6a4a', -i * 0.08); R(g, x + 2, y + i * (h / 6), w - 4, h / 6, c); R(g, x + 2, y + i * (h / 6), w - 4, 2, shade(c, 0.3)); }
    R(g, x, y, 4, h, '#4a2e1c'); R(g, x + w - 4, y, 4, h, '#4a2e1c');
    drawPixelTextCentered(g, f.down ? 'DOWN' : 'UP', x + w / 2, y + h - 12, '#ffffff', 1);
  },
  flag_stand(g, { I, x, y, h }) {
    const f = flagCanvas(I.nation);

    R(g, x + 4, y - 10, 3, h + 8, '#c9a046'); R(g, x + 3, y - 13, 5, 4, '#f0c35a'); ell(g, x + 5.5, y + h - 1, 9, 3, '#3a2a14');
    for (let i = 0; i < 36; i++) { const sag = Math.round(Math.sin(i / 36 * Math.PI) * 3 + i * 0.25); g.drawImage(f, i, 0, 1, 24, x + 7 + i, y - 8 + sag, 1, 24); }
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 36; i += 6) g.fillRect(x + 7 + i + 3, y - 8 + Math.round(Math.sin((i + 3) / 36 * Math.PI) * 3 + (i + 3) * 0.25), 2, 24);
  },
  desk(g, { x, y, w, h, L, E }) { wood(g, x, y - 10, w, h + 10, '#5a3418'); R(g, x + 4, y - 14, w - 8, 4, '#3a2416'); R(g, x + w - 26, y - 22, 16, 10, '#c9ced9'); R(g, x + 8, y - 20, 18, 6, '#f4f6fb'); R(g, x + 30, y - 22, 4, 12, '#b8862b'); E((d, t) => glow(d, x + w - 18, y - 18, 18, '255,220,150', 0.4)); L(x + w / 2, y, 110, '255,210,140', 0.6); },
  stats_board(g, { x, y, w, h, E }) { R(g, x, y, w, h, '#1b2236'); R(g, x + 3, y + 3, w - 6, h - 6, '#0b1020'); E((d, t) => { d.fillStyle = '#5ff2ff'; d.globalAlpha = 0.85; drawPixelTextCentered(d, 'TRAVEL BOARD', x + w / 2, y + 8, '#5ff2ff', 1); for (let i = 0; i < 6; i++) { d.fillStyle = ['#f0c35a', '#5ff2ff', '#ff4fd8', '#48e08f', '#c77dff', '#ff7a5c'][i]; d.fillRect(x + 10, y + 20 + i * 7, 20 + ((i * 37 + t / 80) % (w - 40)), 4); } d.globalAlpha = 1; }); },
  doormat(g, { x, y, w, h }) { R(g, x, y + 6, w, h - 12, '#7a2a2a'); for (let i = 0; i < w; i += 4) R(g, x + i, y + 8, 2, h - 16, '#8a3a3a'); },
  window(g) { void g; },
  chandelier(g, { x, y, w, E, L }) { const cx = x + w / 2; R(g, cx - 1, 0, 2, 20, '#b8862b'); for (let i = -2; i <= 2; i++) { R(g, cx + i * 10 - 2, 24 + Math.abs(i) * 2, 4, 8, '#f0c35a'); } R(g, cx - 24, 22, 48, 3, '#b8862b'); E((d, t) => { for (let i = -2; i <= 2; i++) glow(d, cx + i * 10, 26, 14, '255,220,150', 0.5 + 0.1 * Math.sin(t / 200 + i)); }); L(cx, 60, 220, '255,210,150', 0.7); },
  // Portugal
  pastry_counter(g, { x, y, w, h, E }) { wood(g, x, y - 18, w, h + 18, '#e8dcc6'); R(g, x + 4, y - 14, w - 8, 22, '#bfe8ff'); for (let i = 0; i < 6; i++) { R(g, x + 8 + i * 18, y - 2, 12, 6, '#e0a050'); ell(g, x + 14 + i * 18, y - 1, 4, 2, '#5a3418'); } R(g, x + 4, y - 14, w - 8, 2, '#ffffff'); drawPixelTextCentered(g, 'PASTEIS', x + w / 2, y + 16, '#2a5db0', 1); E((d) => { d.fillStyle = 'rgba(255,240,200,.15)'; d.fillRect(x + 4, y - 14, w - 8, 22); }); },
  rooster(g, { x, y }) { ell(g, x + 16, y + 8, 10, 12, '#1b1b22'); ell(g, x + 16, y - 6, 6, 6, '#1b1b22'); R(g, x + 14, y - 14, 6, 4, '#e54b4b'); R(g, x + 10, y, 12, 4, '#f0c35a'); R(g, x + 18, y + 4, 4, 4, '#e54b4b'); R(g, x + 8, y + 8, 4, 2, '#2a5db0'); R(g, x + 20, y + 10, 4, 2, '#48e08f'); },
  guitar_wall(g, { x, y }) { ell(g, x + 16, y + 48, 12, 14, '#b07a44'); ell(g, x + 16, y + 48, 4, 4, '#3a2416'); R(g, x + 14, y + 6, 4, 32, '#5a3418'); R(g, x + 12, y + 2, 8, 8, '#3a2416'); },
  tram_poster(g, { x, y, w, h }) { R(g, x, y, w, h, '#f2d27a'); R(g, x + 4, y + 4, w - 8, h - 8, '#7fd0ff'); R(g, x + 10, y + h - 30, w - 20, 18, '#f0c35a'); R(g, x + 14, y + h - 26, 8, 6, '#bfe8ff'); R(g, x + 26, y + h - 26, 8, 6, '#bfe8ff'); R(g, x + 38, y + h - 26, 8, 6, '#bfe8ff'); R(g, x + 10, y + h - 12, w - 20, 2, '#3a3f52'); drawPixelTextCentered(g, 'LISBOA 28', x + w / 2, y + 8, '#2a5db0', 1); },
  port_barrels(g, { x, y, w }) { for (let i = 0; i < 3; i++) { const bx = x + i * (w / 3); ell(g, bx + 15, y + 22, 14, 18, '#7a4e2c'); R(g, bx + 1, y + 10, 28, 3, '#3a3f52'); R(g, bx + 1, y + 30, 28, 3, '#3a3f52'); ell(g, bx + 15, y + 8, 12, 5, '#5a3418'); } drawPixelTextCentered(g, 'PORTO', x + w / 2, y + 44, '#f2d27a', 1); },
  sardine_shelf(g, { x, y, w, h }) { wood(g, x, y - 30, w, h + 30, '#5a3418'); for (let r = 0; r < 3; r++) { R(g, x + 4, y - 22 + r * 20, w - 8, 2, '#3a2416'); for (let i = 0; i < 7; i++) { const c = ['#2a5db0', '#e54b4b', '#f0c35a', '#48e08f'][(i + r) % 4]; R(g, x + 6 + i * 12, y - 32 + r * 20, 10, 9, c); R(g, x + 8 + i * 12, y - 29 + r * 20, 6, 2, '#c9ced9'); } } },
  table_round(g, { x, y, w }) { ell(g, x + w / 2, y + 30, 28, 10, 'rgba(0,0,0,.3)'); ell(g, x + w / 2, y + 16, 26, 12, '#f4f6fb'); ell(g, x + w / 2, y + 14, 24, 10, '#ffffff'); for (let i = 0; i < 6; i++) R(g, x + 12 + i * 7, y + 22, 3, 6, '#2a5db0'); R(g, x + w / 2 - 2, y + 24, 4, 20, '#5a3418'); R(g, x + w / 2 - 6, y + 6, 12, 8, '#e0a050'); for (const sx of [x - 6, x + w - 4]) { R(g, sx, y + 20, 10, 20, '#8a5a34'); R(g, sx, y + 14, 10, 6, '#a8743e'); } },
  plant_orange(g, { x, y }) { R(g, x + 6, y + 14, 20, 16, '#c2652e'); ell(g, x + 16, y + 2, 16, 14, '#2f7a3c'); ell(g, x + 12, y - 2, 10, 8, '#3f9a4c'); for (const [dx, dy] of [[4, -2], [12, 4], [20, -6], [8, 8]]) R(g, x + dx + 2, y + dy, 4, 4, '#ff9f2a'); },
  rug(g, { x, y, w, h, f }) {
    const pat = f.pattern || 'plain';
    R(g, x, y, w, h, pat === 'folk' ? '#dc143c' : pat === 'berber' ? '#b8562a' : pat === 'kilim' ? '#8a1f2a' : '#2a5db0');
    R(g, x + 6, y + 6, w - 12, h - 12, pat === 'folk' ? '#efe2c8' : pat === 'berber' ? '#e8c48a' : pat === 'kilim' ? '#e8c48a' : '#f4f6fb');
    for (let yy = y + 12; yy < y + h - 12; yy += 16) for (let xx = x + 12; xx < x + w - 12; xx += 16) { const c = pat === 'folk' ? ['#1e7a4a', '#2a5db0', '#f0c35a'][((xx + yy) / 16 | 0) % 3] : pat === 'berber' ? '#1b1b22' : pat === 'kilim' ? '#ce2028' : '#2a5db0'; g.fillStyle = c; g.beginPath(); g.moveTo(xx + 6, yy); g.lineTo(xx + 12, yy + 6); g.lineTo(xx + 6, yy + 12); g.lineTo(xx, yy + 6); g.fill(); }
    for (let xx = x; xx < x + w; xx += 4) { R(g, xx, y - 3, 2, 3, '#e8dcc6'); R(g, xx, y + h, 2, 3, '#e8dcc6'); }
  },
  kilim(g, ctx) { DRAW.rug(g, { ...ctx, f: { pattern: 'kilim' } }); },
  carpet(g, ctx) { DRAW.rug(g, { ...ctx, f: { pattern: 'berber' } }); },
  // Macedonia
  lake_painting(g, { x, y, w, h }) { R(g, x, y, w, h, '#b8862b'); R(g, x + 5, y + 5, w - 10, h - 10, '#7fc8ff'); R(g, x + 5, y + h / 2, w - 10, h / 2 - 5, '#2a6fa8'); g.fillStyle = '#5a6a5a'; g.beginPath(); g.moveTo(x + 5, y + h / 2); g.lineTo(x + 40, y + 16); g.lineTo(x + 70, y + h / 2); g.fill(); R(g, x + w - 40, y + h / 2 - 16, 12, 16, '#f4f6fb'); R(g, x + w - 42, y + h / 2 - 22, 16, 6, '#a5462a'); },
  copper_pots(g, { x, y }) { R(g, x, y + 4, 60, 3, '#3a2416'); for (let i = 0; i < 3; i++) { ell(g, x + 10 + i * 20, y + 24, 8, 8, '#c8743a'); R(g, x + 8 + i * 20, y + 6, 4, 10, '#8a4a22'); ell(g, x + 7 + i * 20, y + 21, 3, 3, '#f0a060'); } },
  ajvar_shelf(g, { x, y, w, h }) { wood(g, x, y - 30, w, h + 30, '#6a4022'); for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) { R(g, x + 6 + i * 14, y - 26 + r * 24, 10, 14, '#c8301e'); R(g, x + 6 + i * 14, y - 28 + r * 24, 10, 3, '#f0c35a'); R(g, x + 8 + i * 14, y - 22 + r * 24, 6, 5, '#f4f6fb'); } },
  wooden_chest(g, { x, y, w, h }) { wood(g, x, y - 10, w, h + 10, '#6a4022'); R(g, x + 4, y - 4, w - 8, 3, '#f0c35a'); R(g, x + w / 2 - 4, y, 8, 8, '#b8862b'); for (let i = 0; i < w; i += 10) R(g, x + i + 3, y + 10, 4, 4, '#ce2028'); },
  table_long(g, { x, y, w, h, f, E }) { const top = f.theme === 'pl' ? '#efe2c8' : '#f6f3ec'; R(g, x, y + h - 6, w, 6, 'rgba(0,0,0,.3)'); wood(g, x, y - 4, w, h, '#7a4e2c'); R(g, x + 4, y - 6, w - 8, h - 6, top); for (let i = 0; i < w - 8; i += 8) R(g, x + 4 + i, y + h - 14, 4, 4, f.theme === 'pl' ? '#dc143c' : '#ce2028'); legs(g, x, y, w, h + 10); for (let i = 0; i < 4; i++) { ell(g, x + 24 + i * ((w - 48) / 3), y + 6, 8, 4, '#c9ced9'); R(g, x + 20 + i * ((w - 48) / 3), y + 3, 8, 4, f.theme === 'pl' ? '#f0c070' : '#c8301e'); } R(g, x + w / 2 - 2, y - 14, 4, 12, '#f4f6fb'); E((d, t) => glow(d, x + w / 2, y - 16, 16, '255,200,120', 0.6 + 0.2 * Math.sin(t / 150))); },
  pearl_display(g, { x, y, w, h, E }) { wood(g, x, y - 20, w, h + 20, '#3a2416'); R(g, x + 4, y - 16, w - 8, h + 4, '#bfe8ff'); for (let i = 0; i < 8; i++) ell(g, x + 10 + (i % 4) * 12, y - 6 + Math.floor(i / 4) * 12, 3, 3, '#fffbe8'); E((d) => glow(d, x + w / 2, y, 30, '220,240,255', 0.3)); },
  plant(g, { x, y }) { R(g, x + 6, y + 12, 20, 18, '#b5562a'); R(g, x + 4, y + 12, 24, 4, '#c8743a'); for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.35; g.strokeStyle = i % 2 ? '#3f8a45' : '#2f7a3c'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 16, y + 12); g.lineTo(x + 16 + Math.cos(a) * 20, y + 12 + Math.sin(a) * 22); g.stroke(); } },
  // Poland
  tiled_stove(g, { x, y, w, h, E, L }) { R(g, x, y - 20, w, h + 20, '#f4f6fb'); for (let yy = y - 18; yy < y + h; yy += 12) for (let xx = x + 2; xx < x + w - 2; xx += 12) { R(g, xx, yy, 11, 11, '#e6eefb'); R(g, xx + 3, yy + 3, 5, 5, '#2a5db0'); } R(g, x + w / 2 - 10, y + h - 26, 20, 16, '#1b1b22'); E((d, t) => glow(d, x + w / 2, y + h - 18, 22, '255,140,60', 0.6 + 0.2 * Math.sin(t / 120))); L(x + w / 2, y + h, 120, '255,150,80', 0.7); },
  piano(g, { x, y, w, h }) { R(g, x, y - 26, w, h + 26, '#141418'); R(g, x + 2, y - 24, w - 4, 3, '#3a3a44'); R(g, x + 4, y + 2, w - 8, 12, '#f4f6fb'); for (let i = 0; i < w - 8; i += 6) R(g, x + 6 + i, y + 2, 3, 7, '#141418'); R(g, x + w / 2 - 12, y - 20, 24, 14, '#f4f6fb'); R(g, x + 8, y + h - 6, 4, 10, '#141418'); R(g, x + w - 12, y + h - 6, 4, 10, '#141418'); },
  amber_cabinet(g, { x, y, w, h, E }) { R(g, x, y, w, h, '#5a3418'); R(g, x + 4, y + 4, w - 8, h - 8, '#2a1a10'); for (let i = 0; i < 5; i++) ell(g, x + 12 + (i % 2) * 18, y + 14 + i * 12, 5, 4, '#ffb030'); E((d) => glow(d, x + w / 2, y + h / 2, 30, '255,170,40', 0.4)); },
  dragon(g, { x, y }) { g.fillStyle = '#2f7a3c'; ell(g, x + 32, y + 30, 24, 14, '#2f7a3c'); ell(g, x + 52, y + 12, 10, 8, '#3f9a4c'); R(g, x + 56, y + 8, 3, 3, '#ffe08a'); for (let i = 0; i < 5; i++) R(g, x + 14 + i * 8, y + 14, 4, 6, '#e54b4b'); R(g, x + 8, y + 36, 8, 8, '#2f7a3c'); R(g, x + 44, y + 36, 8, 8, '#2f7a3c'); drawPixelTextCentered(g, 'SMOK', x + 32, y + 48, '#f0c35a', 1); },
  folk_chest(g, ctx) { DRAW.wooden_chest(g, ctx); },
  // Morocco
  riad_fountain(g, { x, y, w, h, E }) { ell(g, x + w / 2, y + h / 2 + 8, w / 2, h / 2, '#1e7a4a'); ell(g, x + w / 2, y + h / 2 + 4, w / 2 - 4, h / 2 - 4, '#f2ead8'); ell(g, x + w / 2, y + h / 2 + 4, w / 2 - 12, h / 2 - 12, '#2a8fb0'); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; R(g, x + w / 2 + Math.cos(a) * (w / 2 - 8) - 2, y + h / 2 + 4 + Math.sin(a) * (h / 2 - 8) - 2, 4, 4, ['#2a5db0', '#c1272d', '#f0c35a'][i % 3]); } R(g, x + w / 2 - 4, y + h / 2 - 20, 8, 22, '#f2ead8'); ell(g, x + w / 2, y + h / 2 - 20, 10, 4, '#1e7a4a'); E((d, t) => { for (let i = 0; i < 8; i++) { const k = ((t / 700 + i / 8) % 1); d.fillStyle = `rgba(190,240,255,${0.8 * (1 - k)})`; d.fillRect(x + w / 2 + Math.cos(i) * k * 24, y + h / 2 - 22 + k * k * 30 - k * 20, 2, 3); } }); },
  lantern_hang(g, { x, y, E, L }) { R(g, x + 15, y, 2, 20, '#5a3a1e'); R(g, x + 8, y + 20, 16, 24, '#b8862b'); for (let i = 0; i < 3; i++) R(g, x + 10 + i * 5, y + 24, 3, 16, '#ffe08a'); R(g, x + 6, y + 18, 20, 4, '#8a6216'); E((d, t) => glow(d, x + 16, y + 32, 36, '255,180,80', 0.55 + 0.1 * Math.sin(t / 180 + x))); L(x + 16, y + 60, 140, '255,170,70', 0.7); },
  arch_niche(g, { x, y, w, h }) { R(g, x, y + 20, w, h - 20, '#c98a4a'); g.fillStyle = '#c98a4a'; g.beginPath(); g.arc(x + w / 2, y + 22, w / 2, Math.PI, 0); g.fill(); R(g, x + 8, y + 26, w - 16, h - 32, '#1e5a3a'); R(g, x + w / 2 - 6, y + h - 22, 12, 16, '#f0c35a'); },
  poufs(g, { x, y, w, h }) { for (let i = 0; i < 3; i++) { const px = x + 10 + (i % 2) * (w / 2) + (i > 1 ? 10 : 0), py = y + 14 + (i > 1 ? h / 2 : 0); ell(g, px + 12, py + 12, 16, 10, '#8a3a1e'); ell(g, px + 12, py + 8, 15, 8, ['#c1272d', '#f0c35a', '#1e7a4a'][i]); for (let k = 0; k < 4; k++) R(g, px + 2 + k * 6, py + 6, 2, 4, '#f4f6fb'); } },
  tea_table(g, { x, y, w, h, E }) { ell(g, x + w / 2, y + h / 2 + 8, w / 2, h / 2, '#8a6216'); ell(g, x + w / 2, y + h / 2 + 4, w / 2 - 4, h / 2 - 4, '#d9b45a'); R(g, x + w / 2 - 6, y + h / 2 - 12, 12, 14, '#c9ced9'); R(g, x + w / 2 + 6, y + h / 2 - 8, 6, 2, '#c9ced9'); for (let i = 0; i < 4; i++) R(g, x + 12 + i * 14, y + h / 2 + 4, 6, 8, '#bff6c0'); E((d, t) => { for (let i = 0; i < 3; i++) { const k = ((t / 1500 + i / 3) % 1); d.fillStyle = `rgba(255,255,255,${0.35 * (1 - k)})`; d.fillRect(x + w / 2 + Math.sin(k * 6) * 3, y + h / 2 - 16 - k * 20, 2, 3); } }); },
  carpet_stack(g, { x, y, w }) { for (let i = 0; i < 4; i++) { const c = ['#c1272d', '#1e7a4a', '#2a5db0', '#f0c35a'][i]; R(g, x, y + 20 - i * 8, w, 8, c); for (let k = 0; k < w; k += 8) R(g, x + k, y + 22 - i * 8, 4, 2, shade(c, 0.4)); } },
  palm_pot(g, { x, y }) { R(g, x + 6, y + 12, 20, 18, '#1e5a8a'); R(g, x + 4, y + 12, 24, 4, '#2a7ab0'); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.5; g.strokeStyle = '#2f7a3c'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 16, y + 10); g.quadraticCurveTo(x + 16 + Math.cos(a) * 14, y - 10, x + 16 + Math.cos(a) * 28, y + 4 + Math.sin(a) * 4); g.stroke(); } },
  lantern_floor(g, { x, y, E, L }) { R(g, x + 8, y - 10, 16, 30, '#b8862b'); for (let i = 0; i < 3; i++) R(g, x + 10 + i * 5, y - 6, 3, 22, '#ffe08a'); R(g, x + 12, y - 18, 8, 8, '#8a6216'); E((d, t) => glow(d, x + 16, y + 4, 30, '255,180,80', 0.6 + 0.1 * Math.sin(t / 150 + x))); L(x + 16, y + 10, 120, '255,170,70', 0.7); },
  // ── cosy floor 2 ──
  window_earth(g, { x, y, w, h, E }) { R(g, x - 4, y - 4, w + 8, h + 8, '#3a2416'); R(g, x, y, w, h, '#02030a'); for (let i = 0; i < 30; i++) R(g, x + (i * 37) % w, y + (i * 13) % h, 1, 1, '#ffffff'); ell(g, x + w * 0.7, y + h * 0.75, 26, 26, '#2a6fd0'); ell(g, x + w * 0.66, y + h * 0.7, 10, 6, '#3f9a4c'); ell(g, x + w * 0.74, y + h * 0.82, 8, 4, '#3f9a4c'); R(g, x + w / 2 - 2, y, 4, h, '#3a2416'); R(g, x - 10, y - 4, 10, h + 8, '#8a2a3a'); R(g, x + w, y - 4, 10, h + 8, '#8a2a3a'); E((d, t) => { d.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t / 400)})`; d.fillRect(x + 20, y + 14, 2, 2); }); },
  fairy_lights(g, { x, y, w, E }) { g.strokeStyle = '#3a2416'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= 40; i++) { const xx = x * T / T + i * (w / 40), yy = y + 10 + Math.sin(i * 0.8) * 6; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); E((d, t) => { for (let i = 0; i < 40; i++) { const xx = x + i * (w / 40), yy = y + 10 + Math.sin(i * 0.8) * 6; const c = ['255,210,120', '255,140,200', '140,220,255'][i % 3]; glow(d, xx, yy, 8, c, 0.5 + 0.4 * Math.sin(t / 300 + i)); d.fillStyle = `rgb(${c})`; d.fillRect(xx - 1, yy - 1, 2, 2); } }); },
  bed(g, { x, y, w, h, f, E }) {
    const [c1, c2] = { pt: ['#2a5db0', '#f4f6fb'], mk: ['#ce2028', '#f6f3ec'], pl: ['#dc143c', '#efe2c8'], ma: ['#c1272d', '#f0c35a'] }[f.theme] || ['#5b8cff', '#ffffff'];
    R(g, x + 4, y + h - 8, w - 8, 8, 'rgba(0,0,0,.35)');
    wood(g, x, y - 36, w, 40, '#5a3418'); R(g, x + 6, y - 30, w - 12, 26, shade(c1, -0.3)); for (let i = 0; i < w - 20; i += 12) R(g, x + 10 + i, y - 26, 6, 18, c1);
    R(g, x + 2, y, w - 4, h - 6, '#f4f6fb');
    R(g, x + 8, y + 6, w / 2 - 12, 18, '#ffffff'); R(g, x + w / 2 + 4, y + 6, w / 2 - 12, 18, '#ffffff'); R(g, x + 8, y + 22, w - 16, 2, '#d8dce6');
    R(g, x + 2, y + 34, w - 4, h - 40, c1); R(g, x + 2, y + 34, w - 4, 4, shade(c1, 0.25));
    for (let yy = y + 44; yy < y + h - 10; yy += 12) for (let xx = x + 10; xx < x + w - 10; xx += 16) R(g, xx, yy, 6, 6, c2);
    R(g, x + 2, y + h - 10, w - 4, 4, shade(c1, -0.35));
    // canopy posts
    R(g, x - 2, y - 60, 6, h + 56, '#4a2e1c'); R(g, x + w - 4, y - 60, 6, h + 56, '#4a2e1c'); R(g, x - 2, y - 62, w + 4, 6, '#4a2e1c');
    g.fillStyle = 'rgba(255,240,250,.35)'; g.fillRect(x - 6, y - 56, 10, 70); g.fillRect(x + w - 4, y - 56, 10, 70);
    // two hearts on the pillows
    for (const hx of [x + w / 4, x + 3 * w / 4 - 8]) { R(g, hx, y + 12, 3, 3, '#ff7aa8'); R(g, hx + 4, y + 12, 3, 3, '#ff7aa8'); R(g, hx + 1, y + 14, 5, 3, '#ff7aa8'); }
    E((d, t) => { d.save(); d.globalAlpha = 0.15 + 0.05 * Math.sin(t / 800); d.fillStyle = '#ffb0d0'; d.fillRect(x, y, w, h); d.restore(); });
  },
  nightstand(g, { x, y, E, L }) { wood(g, x, y - 10, T, T + 6, '#6a4022'); R(g, x + 4, y + 2, T - 8, 2, '#3a2416'); R(g, x + 12, y - 22, 8, 12, '#f0c35a'); g.fillStyle = '#ffe6b0'; g.beginPath(); g.moveTo(x + 6, y - 22); g.lineTo(x + 26, y - 22); g.lineTo(x + 22, y - 34); g.lineTo(x + 10, y - 34); g.fill(); E((d, t) => glow(d, x + 16, y - 26, 34, '255,200,130', 0.55 + 0.05 * Math.sin(t / 900))); L(x + 16, y, 120, '255,190,120', 0.7); },
  fireplace(g, { x, y, w, h, E, L }) { R(g, x, y - 24, w, h + 24, '#8a8578'); for (let yy = y - 22; yy < y + h; yy += 10) for (let xx = x + ((yy / 10) % 2) * 6; xx < x + w; xx += 14) R(g, xx, yy, 12, 8, shade('#8a8578', ((xx + yy) % 3 - 1) * 0.08)); R(g, x - 4, y - 28, w + 8, 6, '#5a3418'); R(g, x + 14, y + 8, w - 28, h - 14, '#1b1010'); for (let i = 0; i < 3; i++) R(g, x + 20 + i * 14, y + h - 14, 12, 4, '#5a3418'); R(g, x + w / 2 - 6, y - 40, 12, 14, '#f0c35a'); E((d, t) => { for (let i = 0; i < 7; i++) { const k = ((t / 500 + i / 7) % 1), fx = x + 22 + (i * 11) % (w - 44); d.fillStyle = k < 0.5 ? '#ffe08a' : '#ff7a3a'; d.globalAlpha = 1 - k; d.fillRect(fx + Math.sin(t / 100 + i) * 2, y + h - 14 - k * 26, 4, 6); } d.globalAlpha = 1; glow(d, x + w / 2, y + h - 16, 50, '255,140,60', 0.55 + 0.15 * Math.sin(t / 90)); }); L(x + w / 2, y + h + 20, 220, '255,140,60', 0.9); },
  couch(g, { x, y, w, h }) { R(g, x, y - 16, w, h + 16, '#6a2a3a'); R(g, x, y - 16, w, 4, '#8a3a4a'); R(g, x + 6, y + 2, w - 12, h - 10, '#7a3242'); for (let i = 0; i < 3; i++) R(g, x + 8 + i * ((w - 16) / 3), y + 4, (w - 16) / 3 - 4, h - 16, '#8a3a4a'); R(g, x - 4, y - 8, 10, h + 4, '#5a2232'); R(g, x + w - 6, y - 8, 10, h + 4, '#5a2232'); R(g, x + 14, y - 4, 16, 12, '#f0c35a'); R(g, x + w - 32, y - 4, 16, 12, '#5ff2ff'); },
  coffee_table(g, { x, y, w, h, E }) { R(g, x, y, w, h, '#4a2e1c'); R(g, x, y, w, 3, '#6a4a30'); R(g, x + 10, y - 6, 10, 8, '#f4f6fb'); R(g, x + w - 26, y - 4, 14, 4, '#e54b4b'); R(g, x + w / 2 - 2, y - 14, 4, 12, '#f4f6fb'); E((d, t) => glow(d, x + w / 2, y - 16, 14, '255,200,120', 0.6 + 0.2 * Math.sin(t / 130))); },
  velvet_sofa(g, { x, y, w, h }) {
    R(g, x, y - 14, w, 16, '#5a0f1e'); R(g, x, y - 14, w, 3, '#d9a83a');
    R(g, x - 4, y - 6, 8, h + 4, '#6a1424'); R(g, x + w - 4, y - 6, 8, h + 4, '#6a1424');
    R(g, x + 4, y + 2, w - 8, h - 8, '#7a1a2c'); for (let k = 1; k < 3; k++) R(g, x + 4 + k * ((w - 8) / 3), y + 2, 1, h - 8, '#5a0f1e');
    for (let k = 0; k < 4; k++) ell(g, x + 10 + k * ((w - 20) / 3), y - 8, 2, 2, '#d9a83a');
    R(g, x, y + h - 6, w, 3, '#2b1a14');
  },
  bookshelf(g, { x, y, w, h }) { wood(g, x, y - 20, w, h + 20, '#5a3418'); for (let r = 0; r < 3; r++) { R(g, x + 4, y - 18 + r * 22 + 18, w - 8, 3, '#3a2416'); shelfItems(g, x + 4, y - 18 + r * 22 + 18, w - 8, ['#e54b4b', '#2a5db0', '#f0c35a', '#48e08f', '#c77dff', '#f4f6fb'], 8); } },
  record_player(g, { x, y, w, h, E }) { wood(g, x, y - 6, w, h + 6, '#3a2416'); ell(g, x + w / 2 - 6, y + 4, 14, 8, '#141418'); ell(g, x + w / 2 - 6, y + 4, 4, 2, '#e54b4b'); R(g, x + w - 12, y - 4, 3, 14, '#c9ced9'); E((d, t) => { if (Math.floor(t / 400) % 2) { d.fillStyle = '#ff7aa8'; drawPixelText(d, '♪', x + w + 2, y - 20 - (t / 50) % 10, '#ff7aa8', 1); } }); },
  candles(g, { x, y, E }) { for (let i = 0; i < 3; i++) R(g, x + 6 + i * 8, y + 8 - i * 3, 5, 12 + i * 3, '#f4f6fb'); E((d, t) => { for (let i = 0; i < 3; i++) { const fx = x + 8 + i * 8, fy = y + 4 - i * 3; d.fillStyle = '#ffd27a'; d.fillRect(fx, fy + Math.sin(t / 90 + i), 2, 4); glow(d, fx + 1, fy + 2, 14, '255,200,120', 0.6); } }); },
  photo_wall(g, { x, y }) { for (let i = 0; i < 3; i++) { const px = x + i * 30, py = y + (i % 2) * 10; R(g, px, py, 24, 28, '#f4f6fb'); R(g, px + 3, py + 3, 18, 16, ['#7fd0ff', '#ffb0d0', '#f0c35a'][i]); R(g, px + 8, py + 8, 3, 3, '#3a2416'); R(g, px + 13, py + 8, 3, 3, '#3a2416'); R(g, px + 10, py + 12, 4, 2, '#ff7aa8'); } },
  bathtub(g, { x, y, w, h, E }) { ell(g, x + w / 2, y + h / 2 + 4, w / 2 + 2, h / 2, '#c9ced9'); ell(g, x + w / 2, y + h / 2 + 2, w / 2 - 2, h / 2 - 4, '#ffffff'); ell(g, x + w / 2, y + h / 2 + 4, w / 2 - 6, h / 2 - 10, '#a8e0ff'); for (let i = 0; i < 6; i++) ell(g, x + 10 + (i * 7) % (w - 16), y + 20 + (i * 11) % (h - 30), 5, 4, '#ffffff'); R(g, x + w / 2 - 2, y - 6, 4, 10, '#f0c35a'); E((d, t) => { for (let i = 0; i < 3; i++) { const k = ((t / 2000 + i / 3) % 1); d.fillStyle = `rgba(255,255,255,${0.3 * (1 - k)})`; d.beginPath(); d.arc(x + w / 2 + Math.sin(k * 5 + i) * 10, y + 10 - k * 30, 4 + k * 6, 0, Math.PI * 2); d.fill(); } }); },
  // ── HQ ──
  screen_wall(g) { void g; },
  holo_table(g, { x, y, w, h, E, L }) { R(g, x, y + 8, w, h - 8, '#2b3148'); R(g, x, y + 8, w, 4, '#5d6890'); R(g, x + 6, y + 14, w - 12, h - 26, '#111520'); E((d, t) => { const cx = x + w / 2, cy = y - 14; d.save(); d.globalAlpha = 0.8; d.strokeStyle = '#5ff2ff'; d.lineWidth = 1; for (let i = 0; i < 6; i++) { d.beginPath(); d.ellipse(cx, cy, 30, 30 * Math.abs(Math.cos(t / 1200 + i * 0.5)), 0, 0, Math.PI * 2); d.stroke(); } d.beginPath(); d.arc(cx, cy, 30, 0, Math.PI * 2); d.stroke(); d.restore(); glow(d, cx, cy, 60, '95,242,255', 0.3); d.fillStyle = 'rgba(95,242,255,.3)'; d.beginPath(); d.moveTo(cx - 40, y + 14); d.lineTo(cx + 40, y + 14); d.lineTo(cx + 30, cy); d.lineTo(cx - 30, cy); d.fill(); }); L(x + w / 2, y, 200, '95,242,255', 0.8); },
  console(g, { x, y, w, h, E }) { R(g, x, y - 10, w, h + 10, '#2b3148'); R(g, x, y - 10, w, 3, '#5d6890'); R(g, x + 6, y - 22, w - 12, 14, '#111520'); E((d, t) => { d.fillStyle = 'rgba(95,242,255,.7)'; d.fillRect(x + 8, y - 20, w - 16, 10); for (let i = 0; i < 10; i++) { d.fillStyle = ['#ff4f6e', '#48e08f', '#f0c35a'][(i + Math.floor(t / 300)) % 3]; d.fillRect(x + 8 + i * ((w - 16) / 10), y - 4, 4, 3); } }); },
  server_rack(g, { x, y, w, h, E }) { R(g, x, y - 30, w, h + 30, '#1b1e27'); E((d, t) => { for (let i = 0; i < 14; i++) { d.fillStyle = (Math.floor(t / 120) + i * 7) % 5 ? '#48e08f' : '#ff4f6e'; d.fillRect(x + 6, y - 26 + i * 8, 4, 2); d.fillRect(x + 16, y - 26 + i * 8, 6, 2); } }); },
  rules_board(g, { x, y, w, h }) { plaque(g, x, y, w, h, 'RULES', ['CHIPS MOVE THE ODDS', 'BETS ARE SECRET', 'POWERS ACT NOW', 'READY = SPIN']); },
  mission_board(g, { x, y, w, h }) { plaque(g, x, y, w, h, 'MISSION', ['1 EMBASSY  4 SEASON', '2 ROLE     5 REGION', '3 BOARD    6 COUNTRY', '   7 THE PHARAOH']); },
  dolphin_tank(g, { x, y, w, h, E }) {
    R(g, x, y - 30, w, h + 30, '#1a1420'); R(g, x, y - 30, w, 3, '#d9a83a'); R(g, x, y + h - 3, w, 3, '#d9a83a');
    const ix = x + 5, iy = y - 25, iw = w - 10, ih = h + 18;
    const wg = g.createLinearGradient(0, iy, 0, iy + ih); wg.addColorStop(0, '#2a8ac0'); wg.addColorStop(1, '#0b3a62'); g.fillStyle = wg; g.fillRect(ix, iy, iw, ih);
    R(g, ix, iy + ih - 8, iw, 8, '#c8b27a'); for (let k = 0; k < 9; k++) ell(g, ix + 8 + k * (iw / 9), iy + ih - 6, 3, 2, '#a8925a');
    for (const sx of [ix + 10, ix + iw - 16, ix + iw / 2 + 20]) for (let k = 0; k < 4; k++) ell(g, sx + Math.sin(k) * 2, iy + ih - 12 - k * 7, 2.5, 5, '#2f8a55');
    E((d, t) => {
      // light rays drifting slowly
      d.save(); d.beginPath(); d.rect(ix, iy, iw, ih); d.clip();
      for (let k = 0; k < 3; k++) { const rx = ix + ((k * 47 + t / 60) % (iw + 40)) - 20; d.fillStyle = 'rgba(255,255,255,.06)'; d.beginPath(); d.moveTo(rx, iy); d.lineTo(rx + 12, iy); d.lineTo(rx + 30, iy + ih); d.lineTo(rx + 18, iy + ih); d.fill(); }
      // the dolphin swims back and forth and turns around (ping-pong, no jump)
      const span = iw - 44, u = (1 - Math.cos((t / 7000) * Math.PI * 2)) / 2, dir = Math.sin((t / 7000) * Math.PI * 2) >= 0 ? 1 : -1;
      const px = ix + 22 + u * span, py = iy + ih * 0.42 + Math.sin(t / 600) * 4;
      d.translate(px, py); d.scale(dir, 1);
      d.fillStyle = '#9fb7cf'; d.beginPath(); d.ellipse(0, 0, 14, 5.5, 0, 0, Math.PI * 2); d.fill();
      d.fillStyle = '#d8e6f2'; d.beginPath(); d.ellipse(1, 2, 10, 2.5, 0, 0, Math.PI * 2); d.fill();
      d.fillStyle = '#9fb7cf'; d.beginPath(); d.moveTo(13, -1); d.lineTo(19, 0); d.lineTo(13, 2); d.fill(); // beak
      d.beginPath(); d.moveTo(-2, -5); d.lineTo(-7, -11); d.lineTo(-6, -4); d.fill(); // dorsal fin
      const fl = Math.sin(t / 160) * 3; d.beginPath(); d.moveTo(-13, 0); d.lineTo(-20, -5 + fl); d.lineTo(-18, 0); d.lineTo(-20, 5 + fl); d.fill(); // tail
      d.fillStyle = '#0b0a14'; d.fillRect(8, -2, 2, 2);
      d.restore();
      for (let k = 0; k < 5; k++) { const ph = ((t / 2600) + k / 5) % 1; d.fillStyle = `rgba(255,255,255,${0.6 * (1 - ph)})`; d.fillRect(ix + 12 + k * (iw / 5), iy + ih - 10 - ph * (ih - 14), 2, 2); }
    });
  },
  chair_office(g, { x, y }) { R(g, x + 8, y - 10, 16, 16, '#3a4152'); R(g, x + 6, y + 6, 20, 6, '#4b5578'); R(g, x + 14, y + 12, 4, 10, '#2b2f3c'); R(g, x + 6, y + 22, 20, 3, '#2b2f3c'); },
  // ── Mahmoud's Control Centre ──
  video_wall(g, { x, y, w, h, E }) {
    R(g, x - 4, y - 2, w + 8, h + 4, '#07080f'); R(g, x - 4, y - 2, w + 8, 2, '#d9a83a'); R(g, x - 4, y + h + 1, w + 8, 2, '#d9a83a');
    const pic = mahmoudPortrait('smug');
    const routes = COUNTRIES.filter((c, i) => i % 9 === 0).map((c) => [x + ((c.lon + 180) / 360) * w, y + 6 + ((90 - c.lat) / 180) * (h - 12)]);
    E((d, t) => {
      d.fillStyle = '#081430'; d.fillRect(x, y, w, h);
      // world map made of dots (country centroids), glowing routes between random destinations
      for (const c of COUNTRIES) { const px = x + ((c.lon + 180) / 360) * w, py = y + 6 + ((90 - c.lat) / 180) * (h - 12); d.fillStyle = 'rgba(95,242,255,.4)'; d.fillRect(px, py, 2, 2); }
      const k = Math.floor(t / 1500) % routes.length, a = routes[k], b = routes[(k * 7 + 3) % routes.length], ph = (t % 1500) / 1500;
      d.strokeStyle = 'rgba(240,195,90,.8)'; d.lineWidth = 1; d.beginPath(); d.moveTo(a[0], a[1]); d.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 20, a[0] + (b[0] - a[0]) * ph, a[1] + (b[1] - a[1]) * ph - Math.sin(ph * Math.PI) * 20 * ph); d.stroke();
      glow(d, b[0], b[1], 10, '240,195,90', 0.6 * ph);
      // centre: the boss himself
      const cx = x + w / 2; d.fillStyle = '#0a0f22'; d.fillRect(cx - 34, y + 6, 68, h - 12); d.save(); d.imageSmoothingEnabled = false; d.drawImage(pic, cx - 28, y + 8, 56, 56); d.restore();
      d.strokeStyle = '#d9a83a'; d.lineWidth = 2; d.strokeRect(cx - 34, y + 6, 68, h - 12);
    });
  },
  gold_desk(g, { x, y, w, h, E, L }) {
    // the boss's chair behind the desk
    R(g, x + w / 2 - 18, y - 46, 36, 40, '#6a1020'); R(g, x + w / 2 - 18, y - 46, 36, 4, '#d9a83a'); R(g, x + w / 2 - 14, y - 40, 28, 30, '#8a1a2e');
    for (let k = 0; k < 3; k++) ell(g, x + w / 2 - 8 + k * 8, y - 30, 2, 2, '#d9a83a');
    // desk
    R(g, x, y - 10, w, h + 10, '#1a1420'); R(g, x, y - 12, w, 6, '#d9a83a'); R(g, x, y - 12, w, 2, '#ffe08a'); R(g, x + 6, y - 2, w - 12, h - 6, '#241a2c');
    for (let i = 0; i < 5; i++) R(g, x + 12 + i * ((w - 24) / 4), y + 2, 2, h - 12, '#d9a83a');
    // monitor, gold dolphin, nameplate, phone
    R(g, x + 16, y - 34, 40, 22, '#07080f'); R(g, x + 32, y - 12, 8, 4, '#3a4152');
    g.fillStyle = '#d9a83a'; g.beginPath(); g.ellipse(x + w - 34, y - 22, 12, 5, -0.5, 0, Math.PI * 2); g.fill(); R(g, x + w - 38, y - 16, 8, 6, '#8a6216');
    R(g, x + w / 2 - 28, y - 8, 56, 8, '#2b2b2b'); drawPixelTextCentered(g, 'THE PHARAOH', x + w / 2, y - 6, '#f0c35a', 1);
    E((d, t) => { d.fillStyle = `rgba(95,242,255,${0.6 + 0.2 * Math.sin(t / 300)})`; d.fillRect(x + 18, y - 32, 36, 18); d.fillStyle = '#ffffff'; for (let k = 0; k < 4; k++) d.fillRect(x + 21, y - 29 + k * 4, (t / 25 + k * 9) % 28, 1); glow(d, x + w - 34, y - 22, 20, '255,214,140', 0.35); });
    L(x + w / 2, y - 20, 180, '255,214,140', 0.8);
  },
  floor_emblem(g, { x, y, w, h, E }) {
    const cx = x + w / 2, cy = y + h / 2;
    g.strokeStyle = 'rgba(240,195,90,.55)'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, w / 2 - 4, h / 2 - 8, 0, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, w / 2 - 14, h / 2 - 16, 0, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; R(g, cx + Math.cos(a) * (w / 2 - 9) - 1, cy + Math.sin(a) * (h / 2 - 12) - 1, 3, 3, '#d9a83a'); }
    drawPixelTextCentered(g, 'M', cx, cy - 10, 'rgba(240,195,90,.7)', 5);
    E((d, t) => { const a = t / 1400; d.fillStyle = 'rgba(255,224,140,.35)'; for (let i = 0; i < 3; i++) { const b = a + (i * Math.PI * 2) / 3; d.fillRect(cx + Math.cos(b) * (w / 2 - 4) - 2, cy + Math.sin(b) * (h / 2 - 8) - 2, 4, 4); } });
  },
  red_carpet(g, { x, y, w, h }) { R(g, x, y, w, h, '#7a1020'); R(g, x + 3, y, w - 6, h, '#a8162e'); R(g, x, y, 2, h, '#d9a83a'); R(g, x + w - 2, y, 2, h, '#d9a83a'); for (let k = 8; k < h; k += 24) R(g, x + w / 2 - 3, y + k, 6, 6, 'rgba(255,224,140,.35)'); },
  trophy_shelf(g, { x, y, w, h, E }) {
    R(g, x, y - 34, w, h + 34, '#1a1420'); for (let r = 0; r < 2; r++) R(g, x + 3, y - 14 + r * 22, w - 6, 3, '#d9a83a');
    for (let i = 0; i < 4; i++) { const tx2 = x + 10 + i * ((w - 20) / 4); R(g, tx2 + 4, y - 26, 4, 10, '#d9a83a'); ell(g, tx2 + 6, y - 28, 6, 4, '#ffe08a'); R(g, tx2 + 2, y - 16, 8, 2, '#8a6216'); }
    for (let i = 0; i < 3; i++) { const tx2 = x + 14 + i * ((w - 20) / 3); g.strokeStyle = '#d9a83a'; g.lineWidth = 2; g.beginPath(); g.arc(tx2 + 6, y + 2, 6, 0, Math.PI * 2); g.stroke(); R(g, tx2 + 5, y - 4, 2, 6, '#ffe08a'); }
    E((d, t) => { const k = Math.floor(t / 600) % 4; glow(d, x + 16 + k * ((w - 20) / 4), y - 26, 14, '255,224,140', 0.6); });
  },
  espresso_bar(g, { x, y, w, h, E }) {
    R(g, x, y - 8, w, h + 8, '#2b2230'); R(g, x, y - 10, w, 4, '#d9a83a'); R(g, x + 10, y - 34, 26, 24, '#c9ced9'); R(g, x + 14, y - 30, 18, 8, '#3a4152'); R(g, x + 18, y - 16, 4, 6, '#3a4152');
    for (let i = 0; i < 4; i++) { R(g, x + 48 + i * 12, y - 18, 8, 8, '#f4f6fb'); R(g, x + 49 + i * 12, y - 16, 6, 3, '#6b3a1e'); }
    E((d, t) => { for (let k = 0; k < 3; k++) { const ph = ((t / 1200) + k / 3) % 1; d.fillStyle = `rgba(255,255,255,${0.25 * (1 - ph)})`; d.fillRect(x + 20 + Math.sin(ph * 6 + k) * 2, y - 40 - ph * 16, 3, 3); } neonText(d, 'ESPRESSO', x + w / 2, y - 48, '#f0c35a', 1, 0.9); });
  },
  pharaoh_bust(g, { x, y, w, h, E, L }) {
    R(g, x + 6, y - 6, w - 12, h + 6, '#2b2236'); R(g, x + 6, y - 8, w - 12, 3, '#d9a83a'); R(g, x + 2, y + h - 4, w - 4, 4, '#1a1420');
    const cx = x + w / 2, by = y - 10;
    // golden nemes headdress with blue stripes, face, beard
    g.fillStyle = '#d9a83a'; g.beginPath(); g.moveTo(cx - 20, by); g.lineTo(cx - 14, by - 40); g.quadraticCurveTo(cx, by - 52, cx + 14, by - 40); g.lineTo(cx + 20, by); g.closePath(); g.fill();
    for (let k = 0; k < 5; k++) { g.fillStyle = '#1f4fb5'; g.fillRect(cx - 18 + k * 1.5, by - 34 + k * 7, 36 - k * 3, 3); }
    R(g, cx - 9, by - 36, 18, 24, '#e0b25a'); R(g, cx - 6, by - 28, 4, 2, '#1a1205'); R(g, cx + 2, by - 28, 4, 2, '#1a1205'); R(g, cx - 3, by - 20, 6, 2, '#a8762a');
    R(g, cx - 2, by - 12, 4, 10, '#1f4fb5'); R(g, cx - 1, by - 12, 2, 10, '#d9a83a');
    g.fillStyle = '#ffe08a'; g.beginPath(); g.moveTo(cx - 3, by - 44); g.lineTo(cx, by - 50); g.lineTo(cx + 3, by - 44); g.fill(); // cobra
    E((d, t) => glow(d, cx, by - 26, 40, '255,214,140', 0.22 + 0.06 * Math.sin(t / 1300)));
    L(cx, by - 20, 120, '255,214,140', 0.6);
  },
  bookshelf(g, { x, y, w, h }) {
    R(g, x, y - 40, w, h + 40, '#2a1d14'); R(g, x, y - 40, w, 3, '#d9a83a');
    for (let r = 0; r < 3; r++) { const sy = y - 34 + r * 18; R(g, x + 3, sy + 14, w - 6, 3, '#3a2a1c'); for (let bx = x + 5, k = 0; bx < x + w - 10; k++) { const bw = 5 + ((k * 7 + r * 3) % 4); R(g, bx, sy + (k % 3), bw, 14 - (k % 3), ['#7a1020', '#1f4fb5', '#2f7a3c', '#d9a83a', '#5a3a7a'][(k + r) % 5]); bx += bw + 1; } }
  },
  nation_flag(g, { x, y, h, f }) {
    const fl = flagCanvas(f.nation);
    R(g, x + 4, y - 10, 3, h + 8, '#c9a046'); R(g, x + 3, y - 13, 5, 4, '#f0c35a'); ell(g, x + 5.5, y + h - 1, 9, 3, '#3a2a14');
    for (let i = 0; i < 36; i++) { const sag = Math.round(Math.sin(i / 36 * Math.PI) * 3 + i * 0.25); g.drawImage(fl, i, 0, 1, 24, x + 7 + i, y - 8 + sag, 1, 24); }
  },
  // ── Control Tower · Moon Arcade ──
  observation_deck(g, { x, w, E }) { void g; void x; void w; void E; },
  arcade_sign(g, { x, y, w, E }) { R(g, x, y, w, 26, '#07080f'); E((d, t) => { const f = (Math.sin(t / 60) + Math.sin(t / 23)) > 1.82 ? 0.35 : 1; neonRect(d, x + 2, y + 2, w - 4, 22, '#5ff2ff', f, 2); neonText(d, 'MOON ARCADE  ·  CONTROL TOWER', x + w / 2, y + 9, (Math.floor(t / 1600) % 2) ? '#f0c35a' : '#5ff2ff', 1, f); }); },
  radar_console(g, { x, y, w, h, E }) {
    R(g, x, y - 14, w, h + 14, '#232b44'); R(g, x, y - 14, w, 3, '#5d6890'); R(g, x + 4, y - 8, w - 8, h + 2, '#141a2c');
    E((d, t) => {
      const cx = x + 22, cy = y + 4, r = 14; d.fillStyle = '#062018'; d.beginPath(); d.arc(cx, cy, r, 0, Math.PI * 2); d.fill();
      d.strokeStyle = 'rgba(72,224,143,.5)'; d.lineWidth = 1; for (const rr of [5, 10, 14]) { d.beginPath(); d.arc(cx, cy, rr, 0, Math.PI * 2); d.stroke(); }
      const a = t / 700; d.fillStyle = 'rgba(72,224,143,.35)'; d.beginPath(); d.moveTo(cx, cy); d.arc(cx, cy, r, a - 0.6, a); d.fill();
      d.strokeStyle = '#7dffb8'; d.beginPath(); d.moveTo(cx, cy); d.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); d.stroke();
      for (let i = 0; i < 3; i++) { const b = i * 2.1 + 0.7; const dd = ((a - b) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); if (dd < 1.5) { d.fillStyle = `rgba(160,255,200,${1 - dd / 1.5})`; d.fillRect(cx + Math.cos(b) * (6 + i * 3), cy + Math.sin(b) * (6 + i * 3), 2, 2); } }
      for (let i = 0; i < 8; i++) { d.fillStyle = (Math.floor(t / 250) + i) % 3 ? '#2a3a5a' : ['#ff4f6e', '#f0c35a', '#5ff2ff'][i % 3]; d.fillRect(x + 44 + (i % 4) * 14, y - 4 + Math.floor(i / 4) * 8, 8, 4); }
      d.fillStyle = 'rgba(95,242,255,.6)'; for (let k = 0; k < 3; k++) d.fillRect(x + w - 34, y - 6 + k * 6, ((t / 30 + k * 11) % 24), 2);
    });
  },
  holo_globe(g, { x, y, w, h, E, L }) {
    const cx = x + w / 2, base = y + h - 6;
    // stepped pedestal
    g.fillStyle = '#1b2236'; g.beginPath(); g.ellipse(cx, base, w / 2, 18, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#28324f'; g.beginPath(); g.ellipse(cx, base - 6, w / 2 - 16, 13, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#323e62'; g.beginPath(); g.ellipse(cx, base - 12, w / 2 - 34, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5ff2ff'; g.beginPath(); g.ellipse(cx, base - 13, w / 2 - 44, 5, 0, 0, Math.PI * 2); g.fill();
    const pts = COUNTRIES.map((c) => [c.lat * Math.PI / 180, c.lon * Math.PI / 180, c.region]);
    const cols = { europe: '#9fd3ff', africa: '#f0c35a', asia: '#ff8fb8', americas: '#48e08f', oceania: '#c77dff' };
    const tint = (r) => (r === 'europe' ? cols.europe : r === 'africa' || r === 'middle_east' ? cols.africa : r.includes('asia') ? cols.asia : r === 'oceania' || r === 'antarctica' ? cols.oceania : cols.americas);
    E((d, t) => {
      const gy = y - 30 + Math.sin(t / 900) * 3, R0 = 46, rot = t / 2600;
      // light cone from the pedestal
      const cone = d.createLinearGradient(0, base - 14, 0, gy - R0); cone.addColorStop(0, 'rgba(95,242,255,.35)'); cone.addColorStop(1, 'rgba(95,242,255,0)');
      d.fillStyle = cone; d.beginPath(); d.moveTo(cx - 22, base - 14); d.lineTo(cx + 22, base - 14); d.lineTo(cx + R0 + 8, gy); d.lineTo(cx - R0 - 8, gy); d.fill();
      glow(d, cx, gy, R0 + 30, '95,242,255', 0.28);
      d.save();
      d.fillStyle = 'rgba(10,40,80,.55)'; d.beginPath(); d.arc(cx, gy, R0, 0, Math.PI * 2); d.fill();
      d.strokeStyle = 'rgba(95,242,255,.35)'; d.lineWidth = 1;
      for (let i = 0; i < 6; i++) { const ph = rot + (i * Math.PI) / 6; d.beginPath(); d.ellipse(cx, gy, Math.abs(Math.cos(ph)) * R0, R0, 0, 0, Math.PI * 2); d.stroke(); }
      for (const la of [-0.8, -0.4, 0, 0.4, 0.8]) { d.beginPath(); d.ellipse(cx, gy + Math.sin(la) * R0, Math.cos(la) * R0, Math.cos(la) * R0 * 0.18, 0, 0, Math.PI * 2); d.stroke(); }
      for (const [la, lo, r] of pts) { const z = Math.cos(la) * Math.cos(lo + rot); if (z < -0.05) continue; const px = cx + Math.cos(la) * Math.sin(lo + rot) * R0, py = gy - Math.sin(la) * R0; d.globalAlpha = 0.45 + 0.55 * z; d.fillStyle = tint(r); d.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3); }
      d.globalAlpha = 1; d.strokeStyle = '#5ff2ff'; d.lineWidth = 2; d.beginPath(); d.arc(cx, gy, R0, 0, Math.PI * 2); d.stroke();
      // orbit ring + satellite
      d.strokeStyle = 'rgba(240,195,90,.7)'; d.lineWidth = 1; d.beginPath(); d.ellipse(cx, gy, R0 + 16, 10, -0.25, 0, Math.PI * 2); d.stroke();
      const sa = t / 800; d.fillStyle = '#fff6d6'; d.fillRect(cx + Math.cos(sa) * (R0 + 16) - 2, gy + Math.sin(sa) * 10 - Math.cos(sa) * (R0 + 16) * Math.sin(-0.25) * 0.25 - 2, 4, 4);
      d.restore();
      // scanning line
      const sy = gy - R0 * Math.cos(t / 1400); d.fillStyle = 'rgba(160,255,255,.25)'; d.fillRect(cx - Math.sqrt(Math.max(0, R0 * R0 - (sy - gy) ** 2)), sy, 2 * Math.sqrt(Math.max(0, R0 * R0 - (sy - gy) ** 2)), 1);
    });
    L(cx, y, 260, '95,242,255', 0.9);
  },
  quiz_booth(g, ctx) { arcadeCabinet(g, ctx, { accent: '#c77dff', rgb: '199,125,255', title: 'QUIZ', screen: (d, sx, sy, sw, sh, t) => {
    const k = (t % 6000) / 6000;
    drawPixelTextCentered(d, '?', sx + sw / 2, sy + 4 + Math.sin(t / 500) * 1.5, '#ffffff', 3);
    ['A', 'B', 'C', 'D'].forEach((l, i) => { d.fillStyle = ['#ff4f6e', '#48e08f', '#5ff2ff', '#f0c35a'][i]; d.globalAlpha = 0.85; d.fillRect(sx + 4 + (i % 2) * (sw / 2 - 2), sy + 18 + Math.floor(i / 2) * 7, sw / 2 - 6, 5); d.globalAlpha = 1; });
    d.fillStyle = '#f0c35a'; d.fillRect(sx + 3, sy + sh - 3, (sw - 6) * (1 - k), 2);
  } }); },
  duel_cabinet(g, ctx) { arcadeCabinet(g, ctx, { accent: '#ff4fd8', rgb: '255,79,216', title: 'DUEL', screen: (d, sx, sy, sw, sh, t) => {
    const pairs = [['#c8102e', '#ffffff', '#c8102e'], ['#0b6b3a', '#f2c94c', '#0b6b3a'], ['#1f4fb5', '#ffffff', '#c8102e'], ['#000000', '#dd0000', '#ffce00']];
    const k = Math.floor(t / 2400) % pairs.length, a = pairs[k], b = pairs[(k + 2) % pairs.length];
    for (let i = 0; i < 3; i++) { d.fillStyle = a[i]; d.fillRect(sx + 4, sy + 6 + i * 4, 16, 4); d.fillStyle = b[i]; d.fillRect(sx + sw - 20, sy + 6 + i * 4, 16, 4); }
    neonText(d, 'VS', sx + sw / 2, sy + 8, '#ff4fd8', 1, 0.6 + 0.4 * Math.sin(t / 400));
    drawPixelTextCentered(d, ['WARMER?', 'CHEAPER?', 'CLOSER?', 'NORTH?'][k], sx + sw / 2, sy + sh - 9, '#ffffff', 1);
  } }); },
  memory_table(g, { x, y, w, h, E, L }) {
    // cocktail-style arcade table: chrome legs, glass top showing the cards
    R(g, x + 8, y + h - 6, 6, 6, '#8a93ad'); R(g, x + w - 14, y + h - 6, 6, 6, '#8a93ad');
    R(g, x, y - 4, w, h - 2, '#151a2e'); R(g, x, y - 4, w, 3, '#48e08f'); R(g, x + 2, y + h - 8, w - 4, 2, '#0b0f1e');
    R(g, x + 6, y, w - 12, h - 12, '#062018');
    E((d, t) => {
      const cw = 16, ch = 11, cols = 4, gx0 = x + (w - cols * (cw + 4)) / 2 + 2, gy0 = y + 2;
      const flags = [['#c8102e', '#0b6b3a'], ['#1f4fb5', '#f2c94c'], ['#ffffff', '#dc143c'], ['#000000', '#ffce00']];
      for (let i = 0; i < 12; i++) {
        const cx = gx0 + (i % cols) * (cw + 4), cy = gy0 + Math.floor(i / cols) * (ch + 3);
        const ph = ((t / 5200) + i * 0.11) % 1, open = ph > 0.55 && ph < 0.85, flip = Math.abs(Math.cos(Math.max(0, Math.min(1, (ph - 0.5) / 0.4)) * Math.PI));
        const ww = Math.max(1, cw * (open ? 1 : flip));
        d.fillStyle = open ? '#f4f6fb' : '#2a3570'; d.fillRect(cx + (cw - ww) / 2, cy, ww, ch);
        if (open) { const f = flags[i % 4]; d.fillStyle = f[0]; d.fillRect(cx + 2, cy + 2, cw - 4, 3); d.fillStyle = f[1]; d.fillRect(cx + 2, cy + 6, cw - 4, 3); }
      }
      neonRect(d, x + 4, y - 2, w - 8, h - 8, '#48e08f', 0.5, 1);
      neonText(d, 'FLAG MEMORY', x + w / 2, y - 16, '#48e08f', 1, 0.9);
    });
    L(x + w / 2, y + h / 2, 140, '72,224,143', 0.55);
  },
  leaderboard(g, { x, y, w, h, E, L }) {
    R(g, x + 10, y + h - 14, 6, 14, '#3a4466'); R(g, x + w - 16, y + h - 14, 6, 14, '#3a4466');
    R(g, x, y - 34, w, h + 20, '#1a1420'); R(g, x, y - 34, w, 3, '#ffe08a'); R(g, x, y + h - 16, w, 3, '#8a6216'); R(g, x + 6, y - 28, w - 12, h + 8, '#07080f');
    E((d, t) => {
      neonText(d, 'TOP CREW', x + w / 2, y - 22, '#f0c35a', 2, 1);
      const rows = ARCADE_BOARD.length ? ARCADE_BOARD : [['PLAY A GAME', ''], ['TO ENTER', ''], ['THE BOARD', '']];
      rows.slice(0, 4).forEach(([name, val], i) => {
        drawPixelText(d, `${ARCADE_BOARD.length ? i + 1 + ' ' : ''}${name}`, x + 12, y - 2 + i * 11, i === 0 && ARCADE_BOARD.length ? '#ffe08a' : '#c9c2b0', 1);
        if (val) drawPixelText(d, val, x + w - 12 - textWidth(val, 1), y - 2 + i * 11, val.startsWith('-') ? '#ff9a9a' : '#7dffb8', 1);
      });
      d.fillStyle = `rgba(255,224,140,${0.05 + 0.03 * Math.sin(t / 1400)})`; d.fillRect(x + 6, y - 28, w - 12, h + 8);
    });
    L(x + w / 2, y, 140, '240,195,90', 0.55);
  },
  stool(g, { x, y }) { R(g, x + 14, y + 10, 4, 14, '#5d6890'); ell(g, x + 16, y + 10, 10, 4, '#c77dff'); ell(g, x + 16, y + 9, 10, 3, '#d9a3ff'); R(g, x + 8, y + 24, 16, 3, '#2b3148'); },
  floor_lights(g, { x, y, w, E }) { E((d, t) => { const n = Math.floor(w / 16); for (let i = 0; i < n; i++) { const k = (Math.floor(t / 120) - i) % n; d.fillStyle = k === 0 || k === 1 ? '#5ff2ff' : 'rgba(95,242,255,.18)'; d.fillRect(x + 4 + i * 16, y + 14, 6, 2); } }); void g; },
  // ── Role market (cyberpunk) ──
  cyber_banner(g, { x, y, w, E }) { R(g, x, y, w, 22, '#07080f'); E((d, t) => { neonRect(d, x + 2, y + 1, w - 4, 20, '#ff4fd8', 0.85); neonText(d, 'ROLE MARKET  ·  ONE ROLE PER GAME  ·  NO REFUNDS', x + w / 2, y + 7, (Math.floor(t / 700) % 2) ? '#5ff2ff' : '#f0c35a', 1, 1); }); },
  holo_counter(g, { x, y, w, h, E, L }) {
    R(g, x, y - 10, w, h + 10, '#1b1f33'); R(g, x, y - 10, w, 3, '#5d6890'); R(g, x + 4, y - 4, w - 8, h - 2, '#101326');
    for (let i = 0; i < 4; i++) R(g, x + 14 + i * ((w - 36) / 3), y + 4, 16, 10, '#07080f');
    E((d, t) => {
      neonRect(d, x + 1, y - 9, w - 2, h + 8, '#5ff2ff', 0.7, 1);
      for (let i = 0; i < 4; i++) { d.fillStyle = ['#ff4fd8', '#5ff2ff', '#f0c35a', '#48e08f'][i]; d.globalAlpha = 0.6 + 0.4 * Math.sin(t / 250 + i); d.fillRect(x + 16 + i * ((w - 36) / 3), y + 6, 12, 6); d.globalAlpha = 1; }
      // hologram cone with a spinning role card
      const cx = x + w / 2, top = y - 34, k = Math.abs(Math.cos(t / 700));
      d.save(); d.globalAlpha = 0.18; d.fillStyle = '#5ff2ff'; d.beginPath(); d.moveTo(cx - 6, y - 10); d.lineTo(cx - 30, top); d.lineTo(cx + 30, top); d.lineTo(cx + 6, y - 10); d.fill(); d.restore();
      d.save(); d.globalAlpha = 0.85; d.fillStyle = 'rgba(95,242,255,.25)'; d.strokeStyle = '#5ff2ff'; d.lineWidth = 1; d.fillRect(cx - 16 * k, top - 14, 32 * k, 22); d.strokeRect(cx - 16 * k, top - 14, 32 * k, 22); d.restore();
      if (k > 0.5) drawPixelTextCentered(d, ['ROOKIE', 'HACKER', 'THIEF', 'CUPID', 'CHAOS'][Math.floor(t / 1400) % 5], cx, top - 6, '#ffffff', 1);
    });
    L(x + w / 2, y, 220, '95,242,255', 0.7);
  },
  role_pod(g, { x, y, w, h, f, E }) {
    const role = ROLES[f.role + 3] || ROLES[f.role];
    const col = ['#ff4fd8', '#5ff2ff', '#f0c35a', '#9b8cff', '#48e08f', '#ff7a5c'][f.role % 6];
    R(g, x, y - 26, w, h + 26, '#1b1f33'); R(g, x + 4, y - 22, w - 8, h + 12, '#24345e'); R(g, x + 4, y - 22, w - 8, 6, '#3a5088'); R(g, x + 6, y + h - 12, w - 12, 6, '#2a2f48');
    if (role) { const sheet = characterSheet({ appearance: { presentation: 'neutral', skin: 2, hairStyle: 'short', hairColor: 1, facial: 'none', eyewear: 'none', accessory: 'none', outfit: 4 }, role: role.id }); drawCharacter(g, sheet, 'down', 0, x + w / 2, y + h - 10, 1); }
    E((d, t) => {
      neonRect(d, x + 3, y - 23, w - 6, h + 14, col, 0.75 + 0.25 * Math.sin(t / 400 + f.role), 1);
      glow(d, x + w / 2, y + h / 2 - 6, 40, '200,220,255', 0.22); const sy = y - 22 + ((t / 18 + f.role * 20) % (h + 12)); d.fillStyle = `${col}55`; d.fillRect(x + 4, sy, w - 8, 2);
      if (role) neonText(d, role.name.toUpperCase(), x + w / 2, y - 36, col, 1, 1);
    });
  },
  neon_plinth(g, { x, y, f, E }) { R(g, x + 6, y + 22, 20, 8, '#1b1f33'); const sheet = characterSheet({ appearance: { presentation: 'neutral', skin: 0, hairStyle: 'buzz', hairColor: 6, facial: 'none', eyewear: 'none', accessory: 'none', outfit: 2 }, role: f.role }); drawCharacter(g, sheet, 'down', 0, x + 16, y + 26, 1); E((d, t) => { d.save(); d.globalAlpha = 0.6 + 0.3 * Math.sin(t / 300 + x); d.fillStyle = '#ff4fd8'; d.fillRect(x + 6, y + 28, 20, 2); d.restore(); glow(d, x + 16, y + 28, 20, '255,79,216', 0.25); }); },
  neon_hang(g, { x, y, E, L }) { R(g, x + 15, y, 2, 16, '#3a3f5c'); R(g, x + 4, y + 16, 24, 6, '#1b1f33'); E((d, t) => { d.save(); d.shadowColor = '#5ff2ff'; d.shadowBlur = 14; d.fillStyle = '#bff8ff'; d.globalAlpha = 0.85 + 0.15 * Math.sin(t / 120 + x); d.fillRect(x + 5, y + 22, 22, 3); d.restore(); }); L(x + 16, y + 40, 150, '95,242,255', 0.6); },
  cyber_mat(g, { x, y, w, h, E }) { R(g, x, y + 6, w, h - 12, '#101326'); E((d, t) => neonRect(d, x + 2, y + 7, w - 4, h - 14, '#ff4fd8', 0.5 + 0.3 * Math.sin(t / 300), 1)); },
  // ── Role market (old bazaar pieces, kept for reference) ──
  bazaar_banner(g, { x, y, w, E }) { for (let i = 0; i < w; i += 16) { g.fillStyle = ['#e85b5b', '#f0c35a', '#48e08f', '#5b8cff', '#c77dff'][(i / 16) % 5]; g.beginPath(); g.moveTo(x + i, y); g.lineTo(x + i + 16, y); g.lineTo(x + i + 8, y + 20); g.fill(); } E((d, t) => neonText(d, 'CHOOSE YOUR ROLE  ONE PER GAME', x + w / 2, y + 26, '#f0c35a', 2, 1)); },
  counter_roles(g, { x, y, w, h, E, L }) { wood(g, x, y - 8, w, h + 8, '#8a5a2e'); R(g, x, y - 8, w, 4, '#f0c35a'); for (let i = 0; i < 4; i++) R(g, x + 12 + i * ((w - 30) / 3), y + 6, 18, 14, ['#ff4fd8', '#5ff2ff', '#f0c35a', '#48e08f'][i]); E((d, t) => glow(d, x + w / 2, y, 60, '255,200,120', 0.25 + 0.05 * Math.sin(t / 500))); L(x + w / 2, y + 20, 200, '255,200,120', 0.8); },
  role_booth(g, { x, y, w, h, f, E }) {
    const role = ROLES[f.role + 3] || ROLES[f.role];
    wood(g, x, y - 20, w, h + 20, '#5a3418'); R(g, x, y - 20, w, 6, ['#e85b5b', '#2a9df4', '#f0c35a', '#c77dff', '#48e08f', '#ff7a5c'][f.role % 6]);
    if (role) { const sheet = characterSheet({ appearance: { presentation: 'neutral', skin: 2, hairStyle: 'short', hairColor: 1, facial: 'none', eyewear: 'none', accessory: 'none', outfit: 4 }, role: role.id }); drawCharacter(g, sheet, 'down', 0, x + w / 2, y + 10, 1); }
    E((d) => { if (role) neonText(d, role.name.toUpperCase(), x + w / 2, y + h - 8, '#f0c35a', 1, 1); });
  },
  mannequin(g, { x, y, f }) { R(g, x + 10, y + 24, 12, 6, '#3a4152'); const sheet = characterSheet({ appearance: { presentation: 'neutral', skin: 0, hairStyle: 'buzz', hairColor: 6, facial: 'none', eyewear: 'none', accessory: 'none', outfit: 2 }, role: f.role }); drawCharacter(g, sheet, 'down', 0, x + 16, y + 26, 1); },
  // ── Black market ──
  neon_sign_bm(g, { x, y, w, h, E }) { R(g, x, y, w, h, '#120a18'); E((d, t) => { const f = (Math.sin(t / 70) + Math.sin(t / 23)) > 1.7 ? 0.3 : 1; neonRect(d, x + 2, y + 2, w - 4, h - 4, '#c77dff', f, 2); neonText(d, "HICHAM'S", x + w / 2, y + 10, '#ff4fd8', 2, f); neonText(d, 'BLACK MARKET', x + w / 2, y + 26, '#c77dff', 2, f); }); },
  counter_bm(g, { x, y, w, h, E, L }) { R(g, x, y - 10, w, h + 10, '#1b1420'); R(g, x, y - 10, w, 4, '#5a4a66'); R(g, x + 6, y - 2, w - 12, h - 4, '#2a1f30'); for (let i = 0; i < 5; i++) { R(g, x + 14 + i * ((w - 40) / 4), y - 18, 14, 10, ['#5ff2ff', '#f0c35a', '#ff4fd8', '#48e08f', '#c77dff'][i]); } E((d, t) => { for (let i = 0; i < 5; i++) glow(d, x + 21 + i * ((w - 40) / 4), y - 14, 16, ['95,242,255', '240,195,90', '255,79,216', '72,224,143', '199,125,255'][i], 0.5 + 0.2 * Math.sin(t / 300 + i)); }); L(x + w / 2, y, 180, '199,125,255', 0.8); },
  shelf_glow(g, { x, y, w, h, E }) { R(g, x, y - 40, w, h + 40, '#1b1420'); for (let r = 0; r < 3; r++) { R(g, x + 4, y - 18 + r * 22, w - 8, 3, '#3a2f3f'); for (let i = 0; i < 4; i++) R(g, x + 8 + i * ((w - 16) / 4), y - 30 + r * 22, 10, 12, ['#5ff2ff', '#ff4fd8', '#f0c35a', '#48e08f'][(i + r) % 4]); } E((d, t) => { d.save(); d.globalAlpha = 0.25 + 0.1 * Math.sin(t / 400 + x); d.fillStyle = '#c77dff'; d.fillRect(x, y - 40, w, h + 40); d.restore(); }); },
  cage(g, { x, y, w, h }) { R(g, x, y - 20, w, h + 20, '#14101a'); for (let i = 0; i < w; i += 8) R(g, x + i, y - 20, 2, h + 20, '#6b7385'); R(g, x, y - 20, w, 3, '#6b7385'); R(g, x + 20, y + 20, 30, 20, '#5a3418'); R(g, x + 30, y + 10, 12, 10, '#f0c35a'); },
  crates_bm(g, { x, y, w }) { for (const [dx, dy, ww, hh, c] of [[0, 10, 44, 34, '#3a2f3f'], [44, 16, 44, 28, '#2f3a4f'], [16, -18, 40, 28, '#4a3a2a']]) { R(g, x + dx, y + dy, ww, hh, c); R(g, x + dx, y + dy, ww, 3, shade(c, 0.3)); drawPixelText(g, 'XX', x + dx + 6, y + dy + 10, '#ff4fd8', 1); } void w; },
  safe(g, { x, y, w, h }) { R(g, x, y - 16, w, h + 16, '#3a4152'); R(g, x + 4, y - 12, w - 8, h + 8, '#4b5578'); ell(g, x + w / 2, y + 2, 8, 8, '#c9ced9'); R(g, x + w / 2 - 1, y - 6, 2, 8, '#1b1b22'); },
  card_table(g, { x, y, w, h, E }) { ell(g, x + w / 2, y + h / 2 + 6, w / 2, h / 2 + 2, '#14101a'); ell(g, x + w / 2, y + h / 2, w / 2 - 4, h / 2 - 2, '#1e5a3a'); for (let i = 0; i < 5; i++) { R(g, x + 20 + i * 14, y + h / 2 - 6, 10, 14, '#f4f6fb'); R(g, x + 22 + i * 14, y + h / 2 - 4, 3, 3, i % 2 ? '#e54b4b' : '#1b1b22'); } for (let i = 0; i < 3; i++) ell(g, x + w - 30 + i * 6, y + 14, 6, 3, '#f0c35a'); E((d, t) => glow(d, x + w / 2, y + h / 2, 50, '72,224,143', 0.15)); },
  pipes(g, { x, w }) { R(g, x, 4, w * 1, 8, '#3a3b46'); R(g, x, 4, w, 2, '#5d6478'); for (let i = 20; i < w; i += 60) R(g, x + i, 0, 10, 14, '#2a2b36'); },
  screen_tv(g, { x, y, w, h, E }) { R(g, x, y, w, h, '#14101a'); E((d, t) => { d.fillStyle = `hsl(${(t / 20) % 360},80%,55%)`; d.globalAlpha = 0.35; d.fillRect(x + 3, y + 3, w - 6, h - 6); d.globalAlpha = 1; drawPixelTextCentered(d, ['ODDS', 'LIVE', 'VC'][Math.floor(t / 1200) % 3], x + w / 2, y + h / 2 - 3, '#ffffff', 2); }); },
  // ── Club ──
  egypt_wall_art(g, { x, y, w, E }) { for (let i = 0; i < 6; i++) { const ex = x + 40 + i * (w - 80) / 5; R(g, ex - 10, y + 10, 20, 50, '#d9b45a'); R(g, ex - 6, y + 14, 12, 12, '#1f4fb5'); R(g, ex - 2, y + 30, 4, 20, '#1f4fb5'); } E((d, t) => { for (let i = 0; i < 6; i++) glow(d, x + 40 + i * (w - 80) / 5, y + 36, 24, '255,79,216', 0.2 + 0.15 * Math.max(0, Math.sin(t / 150 + i))); }); },
  dancefloor(g, { x, y, w, h, E }) { R(g, x, y, w, h, '#0b0610'); for (let yy = 0; yy < h; yy += T) for (let xx = 0; xx < w; xx += T) R(g, x + xx + 2, y + yy + 2, T - 4, T - 4, '#1a1020');
    E((d, t) => { const beat = Math.floor(t / 230); for (let yy = 0; yy < h; yy += T) for (let xx = 0; xx < w; xx += T) { const k = (xx / T * 3 + yy / T * 5 + beat) % 7; if (k < 3) { d.fillStyle = ['rgba(255,79,216,.55)', 'rgba(95,242,255,.5)', 'rgba(240,195,90,.5)'][k]; d.fillRect(x + xx + 2, y + yy + 2, T - 4, T - 4); } } }); },
  dj_booth(g, { x, y, w, h, E, L }) { R(g, x, y - 16, w, h + 16, '#1b1420'); R(g, x, y - 16, w, 4, '#d9b45a'); ell(g, x + 30, y - 6, 14, 6, '#2a2a34'); ell(g, x + w - 30, y - 6, 14, 6, '#2a2a34'); E((d, t) => { for (let i = 0; i < 12; i++) { const hgt = 4 + Math.abs(Math.sin(t / 120 + i)) * 14; d.fillStyle = i % 2 ? '#ff4fd8' : '#5ff2ff'; d.fillRect(x + 54 + i * 6, y + h - hgt, 4, hgt); } }); L(x + w / 2, y + 30, 200, '255,79,216', 0.8); },
  bar(g, { x, y, w, h, E }) { R(g, x, y - 20, w, h + 20, '#2a1a24'); R(g, x + w - 8, y - 20, 8, h + 20, '#d9b45a'); for (let i = 0; i < 6; i++) { R(g, x + 8, y - 10 + i * 30, 10, 18, ['#48e08f', '#ff4fd8', '#f0c35a'][i % 3]); R(g, x + 10, y - 16 + i * 30, 6, 6, '#c9ced9'); } E((d, t) => { d.save(); d.globalAlpha = 0.35; d.fillStyle = '#5ff2ff'; d.fillRect(x + w - 8, y - 20, 4, h + 20); d.restore(); }); },
  vip_throne(g, { x, y, w, h, E }) { R(g, x + 10, y - 50, w - 20, 60, '#d9b45a'); R(g, x + 16, y - 44, w - 32, 50, '#b81d3a'); R(g, x, y + 4, w, h - 4, '#d9b45a'); R(g, x + 6, y + 8, w - 12, h - 16, '#b81d3a'); for (let i = 0; i < 3; i++) R(g, x + 20 + i * 20, y - 58, 8, 10, '#f0c35a'); E((d, t) => { neonText(d, 'VIP', x + w / 2, y - 78, '#f0c35a', 2, 0.7 + 0.3 * Math.sin(t / 300)); glow(d, x + w / 2, y - 20, 70, '240,195,90', 0.2); }); },
  vip_rope(g, { x, y, w }) { for (let i = 0; i <= 3; i++) { R(g, x + i * (w / 3) - 3, y - 20, 6, 26, '#d9b45a'); ell(g, x + i * (w / 3), y - 22, 5, 4, '#fff1b0'); } g.strokeStyle = '#b81d3a'; g.lineWidth = 4; g.beginPath(); for (let i = 0; i < 3; i++) { g.moveTo(x + i * (w / 3), y - 14); g.quadraticCurveTo(x + (i + 0.5) * (w / 3), y - 2, x + (i + 1) * (w / 3), y - 14); } g.stroke(); },
  speaker(g, { x, y, w, h, E }) { R(g, x, y - 30, w, h + 30, '#141018'); ell(g, x + w / 2, y - 12, 18, 18, '#2a2a34'); ell(g, x + w / 2, y + 22, 12, 12, '#2a2a34'); E((d, t) => { const p = Math.max(0, Math.sin(t / 115)) * 3; ell(d, x + w / 2, y - 12, 8 + p, 8 + p, '#3a3a44'); }); },
  lounge(g, { x, y, w, h }) { R(g, x, y - 10, w, h + 10, '#4a1a3a'); R(g, x, y - 10, w, 4, '#ff4fd8'); for (let i = 0; i < 3; i++) R(g, x + 8 + i * ((w - 16) / 3), y + 2, (w - 16) / 3 - 6, h - 10, '#6a2a4a'); },
  pyramid_neon(g, { x, y, w, h, E }) { E((d, t) => { d.save(); d.shadowColor = '#f0c35a'; d.shadowBlur = 12; d.strokeStyle = '#ffe28a'; d.lineWidth = 2; d.beginPath(); d.moveTo(x + w / 2, y + 4); d.lineTo(x + w - 4, y + h - 4); d.lineTo(x + 4, y + h - 4); d.closePath(); d.stroke(); d.restore(); glow(d, x + w / 2, y + h / 2, 40, '240,195,90', 0.25 + 0.1 * Math.sin(t / 200)); }); },
  // ── Biodome ──
  glass_wall(g) { void g; },
  pond(g, { x, y, w, h, E }) { ell(g, x + w / 2, y + h / 2 + 4, w / 2, h / 2, '#2a4a40'); ell(g, x + w / 2, y + h / 2, w / 2 - 6, h / 2 - 6, '#0f5a6a'); for (let i = 0; i < 4; i++) ell(g, x + 30 + i * 36, y + 20 + (i % 2) * 30, 10, 5, '#2f9a5a'); E((d, t) => { for (let i = 0; i < 3; i++) { const r = ((t / 30 + i * 40) % 60); d.strokeStyle = `rgba(160,240,255,${0.5 * (1 - r / 60)})`; d.beginPath(); d.ellipse(x + w / 2 + (i - 1) * 30, y + h / 2, r, r * 0.4, 0, 0, Math.PI * 2); d.stroke(); } const fx = x + w / 2 + Math.sin(t / 900) * 50, fy = y + h / 2 + Math.cos(t / 700) * 14; d.fillStyle = '#ff9f2a'; d.fillRect(fx, fy, 6, 3); }); },
  biotree_in(g, { x, y, w, h, E }) { R(g, x + w / 2 - 4, y - 20, 8, h + 20, '#3a2f3f'); for (const [dx, dy, r] of [[0, -50, 30], [-20, -36, 20], [20, -36, 20]]) { ell(g, x + w / 2 + dx, y + dy, r, r * 0.8, '#1a2a4a'); ell(g, x + w / 2 + dx - 3, y + dy - 3, r * 0.7, r * 0.6, '#22385e'); } E((d, t) => { for (let i = 0; i < 12; i++) { d.fillStyle = i % 2 ? '#5ff2ff' : '#b8fbff'; d.globalAlpha = 0.5 + 0.5 * Math.sin(t / 500 + i); d.fillRect(x + w / 2 + Math.cos(i * 2.3) * 22, y - 44 + Math.sin(i * 1.7) * 16, 3, 3); } d.globalAlpha = 1; glow(d, x + w / 2, y - 40, 50, '95,242,255', 0.2); }); },
  daybed(g, { x, y, w, h }) { R(g, x, y - 10, w, h + 10, '#d8c3a5'); R(g, x + 4, y - 6, w - 8, h + 2, '#f2ede4'); R(g, x + 8, y - 4, 22, 12, '#ff9be8'); R(g, x + w - 30, y - 4, 22, 12, '#ffe08a'); for (let i = 0; i < 6; i++) R(g, x + 10 + i * 18, y + 14, 6, 6, '#ff7aa8'); R(g, x - 2, y - 26, 4, h + 26, '#8a6a45'); R(g, x + w - 2, y - 26, 4, h + 26, '#8a6a45'); },
  flowerbed(g, { x, y, w, h, E }) { R(g, x, y, w, h, '#2a1a10'); for (let i = 0; i < w / 6; i++) for (let j = 0; j < h / 10; j++) { const fx = x + 3 + i * 6, fy = y + 4 + j * 10; R(g, fx + 1, fy + 2, 1, 5, '#2f7a3c'); R(g, fx, fy, 3, 3, ['#ff7aa8', '#ffe08a', '#c77dff', '#5ff2ff'][(i + j) % 4]); } E((d, t) => { for (let i = 0; i < 3; i++) { const bx = x + w / 2 + Math.sin(t / 700 + i * 2) * w / 2.2, by = y - 10 + Math.cos(t / 500 + i) * 8; d.fillStyle = ['#ffe08a', '#ff9be8', '#5ff2ff'][i]; d.fillRect(bx, by, 3, 2); d.fillRect(bx + (Math.floor(t / 100) % 2 ? 3 : -2), by - 1, 2, 2); } }); },
  hammock(g, { x, y, w }) { g.strokeStyle = '#f2ede4'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y + 24, x + w, y); g.stroke(); R(g, x - 4, y - 30, 4, 36, '#8a6a45'); R(g, x + w, y - 30, 4, 36, '#8a6a45'); },
  stone_path(g, { x, y, w, h }) { for (let yy = y; yy < y + h; yy += 20) for (let xx = x + ((yy / 20) % 2) * 10; xx < x + w; xx += 28) ell(g, xx + 10, yy + 8, 10, 6, '#7d786c'); },
  glowshroom_in(g, { x, y, w, h, E }) { void g; E((d, t) => { for (let i = 0; i < 6; i++) { const sx = x + 6 + (i * 13) % (w - 10), sy = y + 10 + (i * 17) % (h - 16); d.fillStyle = '#3a2a4a'; d.fillRect(sx + 3, sy, 3, 10); d.fillStyle = ['#c77dff', '#5ff2ff', '#48e08f'][i % 3]; d.globalAlpha = 0.7 + 0.3 * Math.sin(t / 400 + i); d.fillRect(sx, sy - 5, 9, 5); d.globalAlpha = 1; glow(d, sx + 4, sy - 3, 14, '199,125,255', 0.25); } }); },
  // ── Seer ──
  tent_drapes(g) { void g; },
  crystal_table(g, { x, y, w, h, E, L }) { R(g, x, y + 4, w, h - 4, '#2a1640'); R(g, x - 4, y, w + 8, 10, '#4b2a74'); for (let i = 0; i < w; i += 8) R(g, x + i, y + 10, 4, 6, '#f0c35a'); for (let i = 0; i < 3; i++) { R(g, x + 10 + i * 22, y - 4, 14, 20, ['#f4f6fb', '#f0c35a', '#c77dff'][i]); } ell(g, x + w / 2, y - 14, 16, 16, '#6a5ab8'); ell(g, x + w / 2 - 5, y - 19, 6, 6, '#d6ccff'); R(g, x + w / 2 - 12, y, 24, 6, '#b8862b'); E((d, t) => { glow(d, x + w / 2, y - 14, 50, '199,125,255', 0.45 + 0.15 * Math.sin(t / 400)); d.save(); d.globalAlpha = 0.5; d.fillStyle = '#ffffff'; d.beginPath(); d.arc(x + w / 2 + Math.sin(t / 300) * 6, y - 14 + Math.cos(t / 260) * 6, 3, 0, Math.PI * 2); d.fill(); d.restore(); }); L(x + w / 2, y, 200, '199,125,255', 0.9); },
  candles_floor(g, { x, y, w, h, E }) { for (let i = 0; i < 5; i++) R(g, x + 6 + i * 11, y + 30 - (i % 3) * 8, 6, 14 + (i % 3) * 8, '#f2ede4'); E((d, t) => { for (let i = 0; i < 5; i++) { const fx = x + 8 + i * 11, fy = y + 26 - (i % 3) * 8; d.fillStyle = '#ffd27a'; d.fillRect(fx, fy + Math.sin(t / 80 + i), 2, 4); glow(d, fx + 1, fy + 2, 12, '255,200,120', 0.6); } }); void w; void h; },
  cushions(g, { x, y, w, h }) { for (let i = 0; i < 3; i++) { ell(g, x + 16 + i * 30, y + h / 2 + 4, 16, 10, ['#6a2a8a', '#b8862b', '#2a5db0'][i]); ell(g, x + 14 + i * 30, y + h / 2, 10, 5, '#ffffff22'); } },
  tarot_wall(g, { x, y, w, h, E }) { for (let i = 0; i < 4; i++) { const cx = x + 8 + i * (w / 4); R(g, cx, y + 6, 22, 36, '#1b1030'); R(g, cx + 2, y + 8, 18, 32, '#f0c35a'); R(g, cx + 4, y + 10, 14, 28, '#3a1f5a'); R(g, cx + 9, y + 16, 4, 4, '#f0c35a'); R(g, cx + 7, y + 26, 8, 2, '#c77dff'); } E((d, t) => { const k = Math.floor(t / 1000) % 4; glow(d, x + 19 + k * (w / 4), y + 24, 30, '240,195,90', 0.4); }); void h; },
  pipes_none() {},
};
