// HD procedural pixel-art characters (32×48 frames, 3-tone shading, outlines).
// Every sprite — players, roles, NPCs, Mahmoud — is generated from look data, so a new
// outfit or resident is a data change, not a new image file.
import { APPEARANCE, nationById } from '../../shared/data/nations.js';
import { roleById } from '../../shared/data/roles.js';

export const SW = 32, SH = 48;          // drawable frame size
const FW = SW + 2, FH = SH + 2;         // + 1px padding for the outline
const DIRS = ['down', 'left', 'right', 'up'];
const OUTLINE = '#0d0a16';

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1, 7), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; } else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}
export const mix = (a, b, t) => {
  const A = parseInt(a.slice(1, 7), 16), B = parseInt(b.slice(1, 7), 16);
  const c = [16, 8, 0].map((s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

/** Add a 1px dark outline around opaque pixels. */
export function outline(canvas, color = OUTLINE) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 60;
  const n = parseInt(color.slice(1), 16);
  const add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (solid(x, y)) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) add.push((y * w + x) * 4);
  }
  for (const i of add) { d[i] = (n >> 16) & 255; d[i + 1] = (n >> 8) & 255; d[i + 2] = n & 255; d[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
}

// ───────────────────────── looks ─────────────────────────

const ROLE_STYLE = {
  commander: { topStyle: 'uniform', gear: 'cape' },
  hacker: { topStyle: 'hoodie', eyewear: 'visor' },
  bookmaker: { topStyle: 'vest', accessory: 'visorcap' },
  diplomat: { topStyle: 'suit', gear: 'sash' },
  saboteur: { topStyle: 'tactical', gear: 'mask' },
  bodyguard: { topStyle: 'armor' },
  merchant: { topStyle: 'apron' },
  chaos: { topStyle: 'robe', gear: 'bolt' },
  thief: { topStyle: 'hoodie', gear: 'mask' },
  cupid: { topStyle: 'tee', gear: 'wings' },
};

/** Resolve the colours/parts of a character from appearance, nation, role and specials. */
export function resolveLook({ appearance, nationality, role, special, look: override }) {
  const a = appearance || { presentation: 'neutral', skin: 2, hairStyle: 'short', hairColor: 1, facial: 'none', eyewear: 'none', accessory: 'none', outfit: 4 };
  const nation = nationById(nationality);
  const r = roleById(role || 'rookie');
  const fem = a.presentation === 'fem';
  const L = {
    skin: APPEARANCE.skin[a.skin] || '#c98e62', hair: APPEARANCE.hairColor[a.hairColor] || '#3b2418', hairStyle: a.hairStyle, facial: a.facial,
    eyewear: a.eyewear, accessory: a.accessory, presentation: a.presentation, build: 'normal',
    top: APPEARANCE.outfit[a.outfit] || '#3a6ea5', topStyle: fem ? 'top' : 'tee', trim: nation ? nation.colors.trim : '#9fd3ff',
    pants: '#2c3550', pantsStyle: fem ? 'jeans' : 'jeans', shoes: '#e9ecf2', shoeStyle: 'sneaker',
    gear: 'none', accent: nation ? nation.colors.primary : '#5ff2ff', extras: {}, eye: '#2a1a14', special,
  };
  if (r && ROLE_STYLE[r.id]) {
    Object.assign(L, ROLE_STYLE[r.id]);
    if (r.look && r.look.body) { L.top = r.look.body; L.accent = r.look.accent; }
    if (r.id === 'cupid') { L.top = '#ff8fb8'; L.accent = '#ffffff'; }
  }
  if (special === 'mahmoud' || special === 'statue' || special === 'baby') Object.assign(L, {
    skin: '#c98e62', hair: '#17110f', hairStyle: 'curly', facial: 'beard', eyewear: 'sunglasses', accessory: 'none', presentation: 'masc',
    top: '#f4f6fb', topStyle: 'shirt', accent: '#3d8ad6', pants: '#d8c7a0', pantsStyle: 'chinos', shoes: '#7a5a3a', shoeStyle: 'sandal', gear: 'none', extras: { dolphins: true, chain: false },
  });
  if (special === 'baby') Object.assign(L, { build: 'baby', facial: 'none', accessory: 'cap', accent: '#3d8ad6', pants: '#5b8cff', pantsStyle: 'shorts' });
  if (special === 'statue') Object.assign(L, { skin: '#d9a83a', hair: '#9c6f1c', top: '#f0c35a', pants: '#c49324', shoes: '#8a6216', accent: '#fff1b0', statue: true });
  if (special === 'pharaoh') Object.assign(L, {
    skin: '#c98e62', hair: '#17110f', hairStyle: 'short', facial: 'beard', eyewear: 'none', presentation: 'masc', build: 'broad',
    top: '#f2ead8', topStyle: 'pharaoh', accent: '#1f4fb5', pants: '#f2ead8', pantsStyle: 'robe', shoes: '#e0b13a', shoeStyle: 'sandal', accessory: 'nemes', extras: { collar: true },
  });
  if (special === 'astronaut') Object.assign(L, { top: '#e9ecf2', topStyle: 'astro', pants: '#d5dae4', pantsStyle: 'astro', shoes: '#8d94a5', shoeStyle: 'boot', gear: 'helmet', accent: '#f2a65a' });
  if (special === 'ambassador') Object.assign(L, { top: '#1d2333', topStyle: 'suit', pants: '#1d2333', pantsStyle: 'trousers', shoes: '#120e14', shoeStyle: 'shoe', gear: 'sash', accent: L.trim });
  if (special === 'droid') Object.assign(L, { droid: true });
  if (override) {
    const { extras, ...rest } = override;
    Object.assign(L, rest);
    if (extras) L.extras = { ...L.extras, ...extras };
  }
  return L;
}

// ───────────────────────── drawing ─────────────────────────

function painter(ctx, flip) {
  const fill = (x, y, w, h, c) => { if (w <= 0 || h <= 0 || !c) return; ctx.fillStyle = c; ctx.fillRect(flip ? 1 + (SW - x - w) : 1 + x, 1 + y, w, h); };
  const dot = (x, y, c) => fill(x, y, 1, 1, c);
  /** horizontal span list: [[y, x0, x1], …] */
  const rows = (list, c) => { for (const [y, x0, x1] of list) fill(x0, y, x1 - x0 + 1, 1, c); };
  const ell = (cx, cy, rx, ry, c, y0 = -1e9, y1 = 1e9) => {
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
      if (y < y0 || y > y1) continue;
      const dy = (y + 0.5 - cy) / ry; if (Math.abs(dy) > 1) continue;
      const half = rx * Math.sqrt(1 - dy * dy);
      const x0 = Math.round(cx - half), x1 = Math.round(cx + half) - 1;
      if (x1 >= x0) fill(x0, y, x1 - x0 + 1, 1, c);
    }
  };
  return { fill, dot, rows, ell };
}

/**
 * Draw one frame. dir ∈ down/left/right/up; frame 0 = stand, 1 = step A, 2 = step B.
 * Side views are drawn facing LEFT and mirrored for right.
 */
function drawFrame(ctx, L, dir, frame) {
  const side = dir === 'left' || dir === 'right';
  const { fill, dot, ell } = painter(ctx, dir === 'right');
  const pal = {
    skin: L.skin, skinD: shade(L.skin, -0.2), skinDD: shade(L.skin, -0.36), skinL: shade(L.skin, 0.16),
    hair: L.hair, hairD: shade(L.hair, -0.35), hairL: shade(L.hair, 0.3),
    top: L.top, topD: shade(L.top, -0.24), topDD: shade(L.top, -0.42), topL: shade(L.top, 0.2),
    pants: L.pants, pantsD: shade(L.pants, -0.28), pantsL: shade(L.pants, 0.15),
    shoe: L.shoes, shoeD: shade(L.shoes, -0.35), shoeL: shade(L.shoes, 0.3),
    acc: L.accent || '#5ff2ff', accD: shade(L.accent || '#5ff2ff', -0.3), gold: '#f0c35a', goldD: '#b8862b', goldL: '#fff1b0',
  };
  if (L.statue) Object.assign(pal, { skinD: '#b8862b', skinDD: '#8a6216', skinL: '#ffe28a', hairL: '#d9a83a' });
  const baby = L.build === 'baby';
  const broad = L.build === 'broad';
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const bob = step ? 1 : 0;
  // vertical layout (baby: big head on a tiny body)
  const HY = baby ? 14 : 0;                 // head offset
  const TY = (baby ? 31 : 22) + bob;        // torso top
  const torsoH = baby ? 8 : 13;
  const LEG0 = TY + torsoH;                 // legs start
  const FOOT = 47;                          // shoes bottom
  const legLen = FOOT - 3 - LEG0;

  if (L.droid) return drawDroid(fill, ell, pal, dir, frame);

  // ── back layers ──
  if (L.gear === 'cape' && dir !== 'down') fill(side ? 15 : 8, TY + 1, side ? 9 : 17, 17, shade(pal.acc, -0.45));
  if (L.gear === 'wings') { const wy = TY + 1; fill(side ? 18 : 3, wy, 6, 8, '#fff6fb'); fill(side ? 18 : 23, wy, 6, 8, '#fff6fb'); fill(side ? 19 : 4, wy + 1, 4, 5, '#ffd0e4'); fill(side ? 19 : 24, wy + 1, 4, 5, '#ffd0e4'); }
  if ((L.extras.backpack || L.topStyle === 'astro') && dir !== 'down') fill(side ? 18 : 10, TY + 1, side ? 5 : 12, 10, L.topStyle === 'astro' ? '#cfd5e0' : '#5a3d2a');
  const longHair = ['long', 'wavy', 'braids'].includes(L.hairStyle);
  if (longHair && !baby) {
    const len = L.hairStyle === 'braids' ? 34 : 30;
    if (dir === 'down') { fill(7, HY + 9, 4, len - 9, pal.hairD); fill(21, HY + 9, 4, len - 9, pal.hairD); }
    if (dir === 'up') fill(7, HY + 8, 18, len - 6, pal.hair);
    if (side) fill(16, HY + 8, 8, len - 6, pal.hairD);
  }
  if (L.accessory === 'nemes' && dir !== 'down') fill(side ? 15 : 8, HY + 10, side ? 9 : 16, 14, '#1f4fb5');

  // ── legs & shoes ──
  drawLegs();
  // ── torso & arms ──
  drawTorso();
  // ── head ──
  drawHead();

  function drawLegs() {
    const ps = L.pantsStyle;
    const robe = ps === 'robe' || L.topStyle === 'robe' || L.topStyle === 'dress';
    if (!side) {
      // front / back view: one leg lifts on steps
      const lift = [step > 0 ? 2 : 0, step < 0 ? 2 : 0];
      const xs = [10, 17];
      xs.forEach((x, i) => {
        const yb = FOOT - 3 - lift[i];
        const y0 = LEG0;
        const h = yb - y0;
        if (ps === 'shorts') { fill(x, y0, 6, Math.min(4, h), i ? pal.pantsD : pal.pants); fill(x + 1, y0 + 4, 4, h - 4, i ? pal.skinD : pal.skin); }
        else if (ps === 'skirt') { fill(x + 1, y0 + 3, 4, h - 3, i ? pal.skinD : pal.skin); }
        else if (!robe) {
          const w = ps === 'wide' ? 7 : 6, xx = ps === 'wide' ? x - (i ? 0 : 1) : x;
          fill(xx, y0, w, h, i ? pal.pantsD : pal.pants);
          fill(xx + (i ? w - 1 : 0), y0, 1, h, i ? shade(pal.pants, -0.4) : pal.pantsL);
          if (ps === 'cargo') { fill(xx + 1, y0 + Math.floor(h / 2) - 1, 4, 3, i ? shade(pal.pants, -0.38) : pal.pantsD); }
          if (ps === 'jeans') { dot(xx + (i ? 1 : 4), y0 + 1, shade(pal.pants, 0.3)); fill(xx, yb - 1, w, 1, pal.pantsL); }
        } else {
          fill(x + 1, y0 + 6, 4, h - 6, i ? pal.skinD : pal.skin);
        }
        drawShoe(x - (i ? 0 : 1), yb, false);
      });
    } else {
      // side view: legs scissor
      const front = step === 0 ? 0 : step;
      const legs = [{ dx: -3 * front, d: false }, { dx: 3 * front, d: true }];
      for (const lg of (front ? legs : [legs[0]])) {
        const x = 13 + lg.dx;
        const h = legLen;
        const col = lg.d ? pal.pantsD : pal.pants;
        if (ps === 'shorts') { fill(x, LEG0, 6, 4, col); fill(x + 1, LEG0 + 4, 4, h - 4, lg.d ? pal.skinD : pal.skin); }
        else if (ps === 'skirt' || robe) fill(x + 1, LEG0 + (robe ? 6 : 3), 4, h - (robe ? 6 : 3), lg.d ? pal.skinD : pal.skin);
        else { fill(x, LEG0, 6, h, col); fill(x, LEG0, 1, h, lg.d ? shade(pal.pants, -0.4) : pal.pantsL); if (ps === 'cargo') fill(x + 1, LEG0 + 3, 4, 3, pal.pantsD); }
        drawShoe(x - 1, FOOT - 3, true);
      }
    }
    // robes / dresses / skirts drawn over the legs
    if (L.topStyle === 'dress' || ps === 'skirt') {
      const y0 = LEG0 - 1, y1 = LEG0 + (L.topStyle === 'dress' ? 8 : 5);
      const c = L.topStyle === 'dress' ? pal.top : pal.pants;
      for (let y = y0; y <= y1; y++) { const k = Math.round((y - y0) * 0.5); const x0 = (side ? 11 : 9) - k, x1 = (side ? 21 : 23) + k; fill(x0, y, x1 - x0, 1, c); fill(x1 - 2, y, 2, 1, shade(c, -0.25)); fill(x0, y, 1, 1, shade(c, 0.2)); }
      fill((side ? 11 : 9) - Math.round((y1 - y0) * 0.5), y1, (side ? 10 : 14) + 2 * Math.round((y1 - y0) * 0.5), 1, shade(c, -0.3));
    }
    if (ps === 'robe' || L.topStyle === 'robe') {
      const y0 = LEG0 - 1, y1 = FOOT - 4;
      for (let y = y0; y <= y1; y++) { const k = Math.round((y - y0) * 0.25); const x0 = (side ? 11 : 9) - k, x1 = (side ? 21 : 23) + k; fill(x0, y, x1 - x0, 1, pal.top); fill(x1 - 3, y, 3, 1, pal.topD); fill(x0, y, 2, 1, pal.topL); }
      if (L.topStyle === 'pharaoh') { fill(side ? 13 : 14, LEG0, side ? 5 : 4, legLen - 2, pal.gold); fill(side ? 14 : 15, LEG0, 1, legLen - 2, pal.goldL); }
      else if (L.gear === 'bolt') for (let i = 0; i < 4; i++) fill(side ? 12 : 13 + (i % 2) * 2, LEG0 + 1 + i * 2, 2, 1, pal.acc);
    }
  }

  function drawShoe(x, y, sideView) {
    const st = L.shoeStyle;
    if (st === 'sandal') { fill(x + 1, y + 1, 6, 2, pal.skin); fill(x + 1, y + 1, 6, 1, pal.shoe); fill(x, y + 2, 8, 1, pal.shoeD); return; }
    const w = sideView ? 8 : 7;
    fill(x, y, w, 3, pal.shoe);
    fill(x, y, w, 1, pal.shoeL);
    fill(x, y + 2, w, 1, pal.shoeD);
    if (st === 'sneaker') fill(x + 1, y + 1, w - 2, 1, mix(pal.shoe, pal.acc, 0.35));
    if (st === 'boot') fill(x, y - 2, w, 2, pal.shoe);
  }

  function drawTorso() {
    const ts = L.topStyle;
    const y0 = TY, h = torsoH;
    const wide = broad ? 1 : 0;
    const x0 = side ? 11 : 8 - wide, x1 = side ? 21 : 24 + wide; // inclusive-ish
    const W = x1 - x0;
    // arms first (behind torso in side view)
    const armSwing = step;
    const sleeveLong = ['jacket', 'hoodie', 'suit', 'uniform', 'sherpa', 'tactical', 'astro', 'robe', 'pharaoh_no', 'armor'].includes(ts);
    const sleeveless = ['dress', 'top_sl', 'pharaoh', 'crop'].includes(ts);
    const armCol = sleeveLong ? pal.top : sleeveless ? pal.skin : pal.top;
    const armColD = sleeveLong ? pal.topD : sleeveless ? pal.skinD : pal.topD;
    const armLen = baby ? 6 : 11;
    if (!side) {
      const la = armLen + (armSwing > 0 ? 1 : armSwing < 0 ? -1 : 0), ra = armLen + (armSwing < 0 ? 1 : armSwing > 0 ? -1 : 0);
      for (const [ax, len, d] of [[x0 - 3, la, false], [x1, ra, true]]) {
        const sleeve = sleeveLong ? len : sleeveless ? 0 : Math.min(4, len);
        fill(ax, y0 + 1, 3, sleeve, d ? armColD : armCol);
        fill(ax, y0 + 1 + sleeve, 3, len - sleeve, d ? pal.skinD : pal.skin);
        if (!d) fill(ax, y0 + 1, 1, len, sleeveLong ? pal.topL : pal.skinL);
        fill(ax, y0 + 1 + len, 3, 2, d ? pal.skinD : pal.skin); // hand
        if (L.extras.watch && !d) fill(ax, y0 + len - 1, 3, 1, pal.gold);
        if (L.extras.bracelets && d) { fill(ax, y0 + len - 1, 3, 1, '#e85b8a'); fill(ax, y0 + len, 3, 1, '#f0c35a'); }
      }
    }
    // torso body
    for (let y = y0; y < y0 + h; y++) {
      const t = y - y0;
      let a = x0, b = x1;
      if (t === 0) { a += 2; b -= 2; } else if (t === 1) { a += 1; b -= 1; }
      if (!side && (ts === 'top' || ts === 'dress' || ts === 'crop') && t > h - 5) { a += 1; b -= 1; }
      fill(a, y, b - a, 1, pal.top);
      fill(a, y, side ? 1 : 2, 1, pal.topL);
      fill(b - (side ? 2 : 3), y, side ? 2 : 3, 1, pal.topD);
    }
    fill(x0 + 1, y0 + h - 1, W - 2, 1, pal.topDD);
    const cx = side ? 14 : 16;
    // style details
    if (!side && dir !== 'up') {
      if (ts === 'tee' || ts === 'top' || ts === 'crop') { fill(cx - 2, y0, 5, 2, pal.skin); fill(cx - 1, y0 + 2, 3, 1, pal.skin); fill(cx - 3, y0, 7, 1, pal.topDD); }
      if (ts === 'crop') { fill(x0 + 2, y0 + h - 4, W - 4, 3, pal.skin); fill(x0 + 2, y0 + h - 4, W - 4, 1, pal.skinD); }
      if (ts === 'shirt') {
        fill(cx - 4, y0, 3, 3, '#ffffff'); fill(cx + 2, y0, 3, 3, '#ffffff'); fill(cx - 1, y0, 3, 3, pal.skin);
        for (let i = 0; i < 3; i++) dot(cx, y0 + 4 + i * 3, shade(pal.top, -0.3));
        if (L.extras.dolphins) for (const [dx, dy] of [[x0 + 2, y0 + 4], [x1 - 6, y0 + 7], [x0 + 3, y0 + 9]]) { fill(dx, dy, 3, 1, pal.acc); dot(dx + 3, dy - 1, pal.acc); dot(dx - 1, dy + 1, pal.acc); }
      }
      if (ts === 'jacket' || ts === 'sherpa') {
        fill(cx - 2, y0, 5, h - 1, pal.acc); fill(cx - 2, y0, 5, 1, pal.skin);
        fill(cx - 3, y0, 1, h - 1, pal.topDD); fill(cx + 3, y0, 1, h - 1, pal.topDD);
        if (ts === 'sherpa') { fill(x0 + 1, y0 - 1, W - 2, 3, '#efe6d2'); for (let i = 0; i < W - 2; i += 2) dot(x0 + 1 + i, y0 + 2, '#d8ccb2'); }
        if (L.extras.chain) for (let i = 0; i < 4; i++) { dot(cx - 2 + i, y0 + 2 + i, pal.gold); dot(cx + 2 - i, y0 + 2 + i, pal.gold); }
      }
      if (ts === 'hoodie') {
        fill(cx - 3, y0 + 1, 7, 1, pal.topDD); dot(cx - 2, y0 + 2, '#f4f6fb'); dot(cx - 2, y0 + 3, '#f4f6fb'); dot(cx + 2, y0 + 2, '#f4f6fb'); dot(cx + 2, y0 + 3, '#f4f6fb');
        fill(x0 + 3, y0 + h - 5, W - 6, 1, pal.topDD); fill(x0 + 3, y0 + h - 5, 1, 3, pal.topDD); fill(x1 - 4, y0 + h - 5, 1, 3, pal.topDD);
      }
      if (ts === 'suit' || ts === 'uniform') {
        fill(cx - 2, y0, 5, 6, '#f4f6fb'); fill(cx, y0 + 1, 1, ts === 'suit' ? 8 : 0, pal.acc);
        for (let i = 0; i < 5; i++) { dot(cx - 3 - (i > 2 ? 1 : 0), y0 + i, pal.topL); dot(cx + 3 + (i > 2 ? 1 : 0), y0 + i, pal.topDD); }
        if (ts === 'uniform') { for (let i = 0; i < 3; i++) { dot(cx - 2, y0 + 6 + i * 2, pal.acc); dot(cx + 2, y0 + 6 + i * 2, pal.acc); } fill(x0, y0, 3, 2, pal.acc); fill(x1 - 3, y0, 3, 2, pal.acc); }
        if (L.extras.chain) for (let i = 0; i < 4; i++) { dot(cx - 2 + i, y0 + 3 + i, pal.gold); dot(cx + 2 - i, y0 + 3 + i, pal.gold); }
      }
      if (ts === 'vest') { fill(x0 + 2, y0, 3, h - 1, '#f4f6fb'); fill(x1 - 5, y0, 3, h - 1, '#f4f6fb'); for (let i = 0; i < 4; i++) fill(x0 + 5 + i * 3, y0 + 2, 1, h - 3, pal.acc); }
      if (ts === 'tactical') { for (let i = 0; i < W - 2; i++) { dot(x0 + 1 + i, y0 + 1 + Math.floor(i * 0.7), '#3a3a44'); } fill(x0 + 1, y0 + h - 4, W - 2, 2, '#3a3a44'); dot(cx, y0 + h - 4, pal.acc); }
      if (ts === 'armor') { fill(x0 + 2, y0 + 2, W - 4, 6, shade(pal.top, 0.15)); fill(x0 + 2, y0 + 2, W - 4, 1, shade(pal.top, 0.4)); fill(x0 - 1, y0, 4, 3, shade(pal.top, 0.25)); fill(x1 - 3, y0, 4, 3, shade(pal.top, 0.1)); fill(cx - 1, y0 + 4, 3, 2, pal.acc); }
      if (ts === 'apron') { fill(x0 + 3, y0 + 3, W - 6, h + 4, pal.acc); fill(x0 + 3, y0 + 3, W - 6, 1, shade(pal.acc, 0.3)); fill(x0 + 5, y0 + 7, W - 10, 3, shade(pal.acc, -0.2)); fill(x0 + 2, y0, 1, 4, pal.acc); fill(x1 - 3, y0, 1, 4, pal.acc); }
      if (ts === 'dress') { fill(cx - 3, y0, 7, 2, pal.skin); fill(x0 + 1, y0 + h - 3, W - 2, 1, pal.gold); }
      if (ts === 'robe') { fill(cx - 2, y0, 5, 2, pal.skin); fill(x0 + 1, y0 + h - 3, W - 2, 2, pal.acc); }
      if (ts === 'astro') { fill(x0 + 3, y0 + 3, 5, 4, '#5ff2ff'); fill(x0 + 4, y0 + 4, 3, 2, '#d6fbff'); fill(x1 - 6, y0 + 3, 3, 3, pal.acc); fill(x0 + 1, y0 + h - 3, W - 2, 1, '#8d94a5'); }
      if (ts === 'pharaoh') {
        // broad usekh collar
        for (let i = 0; i < 5; i++) { const k = 5 - i; fill(cx - 3 - k * 0.8 | 0, y0 + i, 7 + (k * 1.6 | 0), 1, i % 2 ? '#1f4fb5' : pal.gold); }
        fill(x0 + 1, y0 + h - 2, W - 2, 2, pal.gold); fill(cx - 1, y0 + h - 2, 3, 2, '#3fc28a');
      }
    }
    if (side && dir !== 'up') {
      if (ts === 'shirt' && L.extras.dolphins) { fill(x0 + 2, y0 + 5, 3, 1, pal.acc); fill(x0 + 4, y0 + 9, 3, 1, pal.acc); }
      if (ts === 'jacket' || ts === 'suit' || ts === 'sherpa' || ts === 'uniform') { fill(x0, y0, 2, h - 1, ts === 'suit' ? '#f4f6fb' : pal.acc); if (ts === 'sherpa') fill(x0, y0 - 1, W - 2, 3, '#efe6d2'); }
      if (ts === 'pharaoh') { fill(x0, y0, W - 3, 4, pal.gold); fill(x0, y0 + 1, W - 3, 1, '#1f4fb5'); }
      if (ts === 'apron') fill(x0 - 1, y0 + 3, 4, h + 3, pal.acc);
    }
    if (dir === 'up' && (ts === 'hoodie')) { fill(cx - 5, y0 - 1, 11, 4, pal.topD); fill(cx - 4, y0 - 1, 9, 1, pal.topL); }
    if (L.extras.belt || ['tee', 'shirt', 'jacket', 'sherpa', 'top'].includes(ts)) if (!['dress', 'robe'].includes(ts)) fill(x0 + 1, y0 + h - 1, W - 2, 1, L.extras.belt || shade(pal.pants, -0.45));
    // sash / bag straps / gear on top of torso
    if (L.gear === 'sash' && dir !== 'up') for (let i = 0; i < h - 1; i++) fill((side ? x0 + 2 : x0 + 1) + Math.floor(i * (side ? 0.4 : 1.1)), y0 + i, 2, 1, i % 4 === 0 ? shade(pal.acc, 0.3) : pal.acc);
    if (L.extras.bag && dir !== 'up') { for (let i = 0; i < h - 2; i++) dot(x1 - 2 - Math.floor(i * 1.1), y0 + i, '#6b4a2a'); fill(x0 - 1, y0 + h - 2, 5, 4, '#8a5a2e'); fill(x0 - 1, y0 + h - 2, 5, 1, '#a8743e'); }
    if (L.extras.backpack && dir === 'down') { fill(x0 + 1, y0 + 1, 2, 7, '#5a3d2a'); fill(x1 - 3, y0 + 1, 2, 7, '#5a3d2a'); }
    if (L.gear === 'cape' && dir === 'down') { fill(x0 - 1, y0, 2, 14, shade(pal.acc, -0.45)); fill(x1 - 1, y0, 2, 14, shade(pal.acc, -0.45)); fill(x0, y0, 3, 2, pal.acc); fill(x1 - 3, y0, 3, 2, pal.acc); }
    if (L.extras.necklace && dir !== 'up') { for (let i = 0; i < 5; i++) dot((side ? 11 : 13) + i, y0 + 2 + (i === 2 ? 1 : 0), i % 2 ? '#1f4fb5' : pal.gold); }
    if (L.extras.armband && !side) fill(x0 - 3, y0 + 3, 3, 1, pal.gold);
    // side-view arm (in front of torso)
    if (side) {
      const swing = armSwing * 2;
      const ax = 15;
      const sleeve = sleeveLong ? armLen : sleeveless ? 0 : 4;
      for (let i = 0; i < armLen; i++) {
        const xx = ax + Math.round((i / armLen) * -swing);
        fill(xx, y0 + 1 + i, 3, 1, i < sleeve ? (i === 0 ? pal.topL : armCol) : pal.skin);
        dot(xx + 2, y0 + 1 + i, i < sleeve ? armColD : pal.skinD);
      }
      fill(ax - swing, y0 + 1 + armLen, 3, 2, pal.skin);
      if (L.extras.watch) fill(ax - swing, y0 + armLen - 1, 3, 1, pal.gold);
    }
    // held items
    if (L.extras.baguette && dir !== 'up') { const bx = side ? 9 : x0 - 4; for (let i = 0; i < 9; i++) fill(bx + (i > 4 ? 1 : 0), y0 + 2 + i, 2, 1, i % 3 === 0 ? '#e0a050' : '#c98a3a'); }
    if (L.extras.orb && dir !== 'up') { const ox = side ? 8 : x1 + 1, oy = y0 + armLen - 1; fill(ox, oy, 4, 4, '#9b8cff'); fill(ox + 1, oy, 2, 1, '#e6e0ff'); dot(ox + 1, oy + 1, '#ffffff'); }
    if (L.extras.flower && dir !== 'up') { const fx = side ? 10 : x0 - 3, fy = y0 + armLen; fill(fx, fy, 3, 3, '#ff7aa8'); dot(fx + 1, fy + 1, '#ffe08a'); }
    if (L.extras.croissant && dir !== 'up') { const fx = side ? 9 : x1 + 1, fy = y0 + armLen - 1; fill(fx, fy, 4, 2, '#d99a45'); fill(fx + 1, fy - 1, 2, 1, '#f0c070'); }
  }

  function drawHead() {
    const hx = side ? 15 : 16, hy = HY + 11 + bob;
    const rx = 8.5, ry = 9.5;
    // neck
    if (!baby) fill(hx - 2, hy + 8, 5, 3, pal.skinD);
    // hood / nemes back already drawn; head base
    ell(hx, hy, rx, ry, pal.skin);
    // shading: right side darker, chin shadow, forehead light
    if (dir !== 'up') {
      ell(hx + (side ? -1 : 3), hy + 1, rx - 3, ry - 1.5, pal.skin);
      for (let y = Math.ceil(hy - ry); y <= hy + ry; y++) {
        const dy = (y + 0.5 - hy) / ry; if (Math.abs(dy) > 1) continue;
        const half = rx * Math.sqrt(1 - dy * dy);
        const xr = Math.round(hx + half) - 1;
        if (!side) { fill(xr - 1, y, 2, 1, pal.skinD); }
        else fill(Math.round(hx + half) - 3, y, 3, 1, pal.skinD);
      }
      fill(hx - 5, hy + 7, 11, 1, pal.skinD);
      // ears
      if (!side) { fill(hx - 10, hy - 1, 2, 4, pal.skinD); fill(hx + 8, hy - 1, 2, 4, pal.skinDD); dot(hx - 9, hy, pal.skinL); }
      else { fill(hx + 2, hy - 1, 3, 4, pal.skinD); dot(hx + 3, hy, pal.skinDD); }
      if (side) { fill(hx - 9, hy + 2, 1, 2, pal.skin); dot(hx - 9, hy + 3, pal.skinD); } // nose profile
    }
    if (dir === 'up') { drawHair(hx, hy, rx, ry, 'up'); headAcc(hx, hy); return; }
    // face
    const eyeY = hy + 1;
    const ec = L.eye || '#2a1a14';
    const fem = L.presentation === 'fem';
    const eyes = side ? [hx - 5] : [hx - 4, hx + 3];
    for (const ex of eyes) {
      fill(ex - 1, eyeY - 1, 3, 3, '#f8f4ef');
      fill(ex, eyeY - 1, 2, 3, ec);
      dot(ex, eyeY - 1, '#ffffff');
      fill(ex - 1, eyeY - 2, 3, 1, shade(ec, -0.4));
      if (fem) { dot(ex - 2, eyeY - 2, shade(ec, -0.4)); if (!side) dot(ex + 2, eyeY - 2, shade(ec, -0.4)); }
      // brows
      fill(ex - 1, eyeY - 4, 3, 1, L.statue ? pal.skinDD : pal.hairD);
    }
    // nose & mouth
    if (!side) { dot(hx, hy + 3, pal.skinD); dot(hx - 1, hy + 4, pal.skinDD); }
    const my = hy + 6;
    const mouthC = L.statue ? pal.skinDD : '#8a3b3b';
    if (!side) { fill(hx - 2, my, 4, 1, mouthC); dot(hx - 3, my - 1, mouthC); dot(hx + 2, my - 1, mouthC); dot(hx - 1, my + 1, '#d47a7a'); }
    else { fill(hx - 8, my, 3, 1, mouthC); dot(hx - 5, my - 1, mouthC); }
    // blush
    if (fem || baby) { const bc = 'rgba(255,110,140,.45)'; if (!side) { fill(hx - 7, hy + 4, 2, 1, bc); fill(hx + 6, hy + 4, 2, 1, bc); } else fill(hx - 7, hy + 4, 2, 1, bc); }
    // facial hair
    const fh = L.facial;
    if (fh === 'stubble') for (let y = hy + 4; y < hy + 9; y++) for (let x = hx - 6; x < hx + 6; x += 2) if ((x + y) % 2 && Math.abs(x - hx) + (hy + 9 - y) < 9) dot(side ? x - 2 : x, y, 'rgba(30,20,20,.35)');
    if (fh === 'beard') {
      const bc = L.statue ? pal.skinDD : pal.hair;
      if (!side) { fill(hx - 7, hy + 3, 2, 5, bc); fill(hx + 5, hy + 3, 2, 5, bc); fill(hx - 6, hy + 7, 12, 2, bc); fill(hx - 4, hy + 9, 8, 1, bc); fill(hx - 3, my - 1, 6, 1, bc); fill(hx - 1, my + 1, 2, 1, bc); dot(hx - 5, hy + 7, pal.hairL); }
      else { fill(hx - 8, hy + 5, 9, 3, bc); fill(hx - 6, hy + 8, 6, 1, bc); fill(hx - 1, hy + 2, 2, 4, bc); }
    }
    if (fh === 'moustache') { if (!side) { fill(hx - 3, my - 1, 6, 1, pal.hair); dot(hx - 4, my, pal.hair); dot(hx + 3, my, pal.hair); } else fill(hx - 8, my - 1, 4, 1, pal.hair); }
    drawHair(hx, hy, rx, ry, side ? 'side' : 'down');
    // eyewear
    const ew = L.eyewear;
    if (ew === 'glasses') { for (const ex of eyes) { fill(ex - 2, eyeY - 2, 5, 1, '#1b1b22'); fill(ex - 2, eyeY + 2, 5, 1, '#1b1b22'); fill(ex - 2, eyeY - 2, 1, 5, '#1b1b22'); fill(ex + 2, eyeY - 2, 1, 5, '#1b1b22'); } if (!side) fill(hx - 1, eyeY - 1, 2, 1, '#1b1b22'); else fill(hx - 2, eyeY - 1, 5, 1, '#1b1b22'); }
    if (ew === 'sunglasses') { for (const ex of eyes) { fill(ex - 2, eyeY - 2, 5, 4, '#101018'); fill(ex - 1, eyeY - 1, 2, 1, '#5a6a8a'); } if (!side) fill(hx - 1, eyeY - 2, 2, 1, '#101018'); else fill(hx - 2, eyeY - 2, 5, 1, '#101018'); }
    if (ew === 'visor') { fill(side ? hx - 9 : hx - 8, eyeY - 2, side ? 10 : 17, 3, '#38f28c'); fill(side ? hx - 8 : hx - 7, eyeY - 2, side ? 7 : 14, 1, '#b8ffd8'); }
    if (L.gear === 'mask') { fill(side ? hx - 9 : hx - 7, hy + 3, side ? 9 : 15, 5, '#1d1d26'); fill(side ? hx - 8 : hx - 6, hy + 4, side ? 7 : 13, 1, '#2e2e3a'); }
    headAcc(hx, hy);
  }

  function drawHair(hx, hy, rx, ry, view) {
    const hs = L.hairStyle;
    const H = L.statue ? pal.skinD : pal.hair, HD = L.statue ? pal.skinDD : pal.hairD, HL = L.statue ? pal.skinL : pal.hairL;
    const top = hy - ry;
    if (L.accessory === 'nemes' || L.gear === 'helmet') return;
    if (hs === 'buzz') { ell(hx, hy - 2, rx, ry - 2, mix(L.skin, H, 0.7), -1e9, hy - 4); if (view !== 'up') fill(hx - 8, hy - 5, 2, 3, mix(L.skin, H, 0.6)); else ell(hx, hy, rx, ry, mix(L.skin, H, 0.7)); return; }
    if (view === 'up') {
      const big = hs === 'curly' || hs === 'afro';
      ell(hx, hy - (big ? 1 : 0), rx + (big ? 1.5 : 0.5), ry + (big ? 0.5 : 0), H);
      ell(hx - 2, hy - 4, rx - 4, ry - 5, HL);
      if (hs === 'curly' || hs === 'afro') for (let i = 0; i < 7; i++) dot(hx - 6 + i * 2, hy - 6 + (i % 3) * 3, HD);
      if (hs === 'ponytail') { fill(hx - 1, hy + 6, 3, 9, H); fill(hx, hy + 6, 1, 9, HL); fill(hx - 2, hy + 5, 5, 2, L.accent || '#e85b8a'); }
      if (hs === 'bun') { ell(hx, hy - 9, 4, 3, H); dot(hx - 1, hy - 10, HL); }
      if (hs === 'braids') for (let i = 0; i < 5; i++) { fill(hx - 7 + i * 3, hy + 6, 2, 16, i % 2 ? HD : H); dot(hx - 7 + i * 3, hy + 12, pal.gold); }
      return;
    }
    const side = view === 'side';
    const cap = (dy, bulge = 0.8) => ell(hx + (side ? 1 : 0), hy - dy, rx + bulge, ry - 1, H, -1e9, hy - 4);
    switch (hs) {
      case 'curly': case 'afro': {
        const big = hs === 'afro' ? 2.5 : 1.2;
        ell(hx + (side ? 2 : 0), hy - 2, rx + big, ry - 0.5 + big * 0.4, H, -1e9, hy - 2);
        if (!side) { fill(hx - 10, hy - 4, 3, 6, H); fill(hx + 7, hy - 4, 3, 6, H); }
        else fill(hx + 1, hy - 4, 9, 9, H);
        for (let i = 0; i < 9; i++) { const x = hx - 9 + i * 2 + (side ? 2 : 0), y = top - 1 + ((i * 3) % 4); fill(x, y, 2, 2, i % 2 ? HL : H); dot(x + 1, y + 2, HD); }
        for (let i = 0; i < 6; i++) dot(hx - 6 + i * 2 + (side ? 1 : 0), hy - 4 + (i % 2), HD);
        break;
      }
      case 'long': case 'wavy': case 'braids': {
        cap(1.5);
        if (!side) {
          fill(hx - 10, hy - 5, 3, 16, H); fill(hx + 7, hy - 5, 3, 16, H);
          fill(hx - 10, hy - 5, 1, 16, HL); fill(hx + 9, hy - 5, 1, 16, HD);
          if (hs === 'wavy') for (let y = hy; y < hy + 11; y += 3) { dot(hx - 11, y, H); dot(hx + 10, y + 1, H); }
          if (hs === 'braids') for (let y = hy - 2; y < hy + 12; y += 3) { dot(hx - 9, y, pal.gold); dot(hx + 8, y + 1, pal.gold); fill(hx - 10, y + 1, 3, 1, HD); fill(hx + 7, y + 2, 3, 1, HD); }
          // fringe
          fill(hx - 7, hy - 6, 6, 2, H); fill(hx + 1, hy - 6, 6, 2, H); dot(hx - 2, hy - 4, H);
        } else { fill(hx, hy - 6, 10, 18, H); fill(hx + 8, hy - 4, 2, 16, HD); if (hs === 'braids') for (let y = hy; y < hy + 14; y += 3) dot(hx + 5, y, pal.gold); fill(hx - 8, hy - 6, 6, 2, H); }
        ell(hx - 3, top + 2, 4, 1.5, HL);
        break;
      }
      case 'bob': {
        cap(1.5);
        if (!side) { fill(hx - 10, hy - 5, 3, 11, H); fill(hx + 7, hy - 5, 3, 11, H); fill(hx - 7, hy - 6, 14, 2, H); fill(hx - 10, hy + 5, 4, 1, HD); fill(hx + 6, hy + 5, 4, 1, HD); }
        else { fill(hx - 1, hy - 6, 11, 12, H); fill(hx - 8, hy - 6, 7, 2, H); }
        ell(hx - 3, top + 2, 4, 1.5, HL);
        break;
      }
      case 'ponytail': {
        cap(1.5);
        if (!side) { fill(hx - 9, hy - 5, 2, 5, H); fill(hx + 7, hy - 5, 2, 5, H); fill(hx - 6, hy - 6, 12, 2, H); }
        else { fill(hx, hy - 6, 9, 9, H); fill(hx + 8, hy - 4, 3, 2, L.accent || '#e85b8a'); fill(hx + 10, hy - 3, 3, 12, H); fill(hx + 12, hy - 2, 1, 10, HD); fill(hx - 8, hy - 6, 6, 2, H); }
        ell(hx - 3, top + 2, 4, 1.5, HL);
        break;
      }
      case 'bun': {
        cap(1.5);
        ell(hx + (side ? 3 : 0), top - 1, 4, 3, H); dot(hx - 1 + (side ? 3 : 0), top - 2, HL);
        if (!side) { fill(hx - 9, hy - 5, 2, 5, H); fill(hx + 7, hy - 5, 2, 5, H); fill(hx - 6, hy - 6, 12, 2, H); } else { fill(hx, hy - 6, 9, 8, H); fill(hx - 8, hy - 6, 6, 2, H); }
        ell(hx - 3, top + 2, 4, 1.5, HL);
        break;
      }
      default: { // short
        cap(1);
        if (!side) {
          fill(hx - 9, hy - 5, 2, 6, H); fill(hx + 7, hy - 5, 2, 6, H);
          for (let i = 0; i < 7; i++) fill(hx - 7 + i * 2, hy - 6, 2, 1 + (i % 2), H);
        } else { fill(hx, hy - 6, 9, 8, H); fill(hx + 7, hy - 3, 2, 5, HD); for (let i = 0; i < 4; i++) fill(hx - 8 + i * 2, hy - 6, 2, 1 + (i % 2), H); }
        ell(hx - 3, top + 2, 4, 1.4, HL);
        dot(hx + 4, top + 3, HD);
      }
    }
  }

  function headAcc(hx, hy) {
    const ac = L.accessory;
    const top = hy - 9.5;
    const sideV = side;
    if (ac === 'cap' || ac === 'visorcap') {
      const c = ac === 'visorcap' ? '#3c5a3a' : (L.extras.capColor || pal.acc);
      ell(hx + (sideV ? 1 : 0), hy - 3, 9, 7, c, -1e9, hy - 4);
      fill(hx - 9, hy - 5, 18, 2, shade(c, -0.2));
      if (dir === 'down') fill(hx - 7, hy - 4, 14, 2, shade(c, -0.4));
      if (sideV) fill(hx - 13, hy - 4, 6, 2, shade(c, -0.35));
      if (dir === 'up') fill(hx - 3, hy - 3, 6, 1, shade(c, -0.4));
      ell(hx - 2, top + 3, 3, 1.5, shade(c, 0.3));
      if (ac === 'visorcap') fill(hx - 6, hy - 6, 12, 1, '#f2e6c4');
    }
    if (ac === 'headphones') { fill(hx - 9, top + 1, 18, 2, '#2b2d42'); fill(sideV ? hx + 1 : hx - 11, hy - 2, 4, 6, '#2b2d42'); if (!sideV) fill(hx + 7, hy - 2, 4, 6, '#2b2d42'); fill(sideV ? hx + 2 : hx - 10, hy - 1, 2, 4, '#5ff2ff'); }
    if (ac === 'earrings' && dir !== 'up') { if (!sideV) { fill(hx - 10, hy + 3, 1, 2, pal.gold); fill(hx + 9, hy + 3, 1, 2, pal.gold); } else fill(hx + 3, hy + 3, 1, 2, pal.gold); }
    if (ac === 'scarf') { fill(hx - 7, hy + 8, 14, 3, pal.acc); fill(hx + (sideV ? 4 : 3), hy + 10, 3, 6, shade(pal.acc, -0.2)); }
    if (L.extras.headband) { fill(hx - 9, hy - 6, 18, 2, '#e85b5b'); for (let i = 0; i < 6; i++) dot(hx - 8 + i * 3, hy - 6, ['#f0c35a', '#48e08f', '#5b8cff'][i % 3]); }
    if (L.extras.laurel) { for (let i = 0; i < 8; i++) { dot(hx - 8 + i * 2, hy - 6 - (i > 1 && i < 6 ? 1 : 0), pal.gold); dot(hx - 7 + i * 2, hy - 5, pal.goldD); } if (dir !== 'up') fill(hx - 1, hy - 8, 2, 2, pal.goldL); }
    if (L.extras.crown) { fill(hx - 5, top - 1, 10, 3, pal.gold); for (let i = 0; i < 3; i++) fill(hx - 5 + i * 4, top - 3, 2, 2, pal.gold); dot(hx, top, '#e54b4b'); }
    if (L.extras.beads && dir !== 'up') { dot(hx - 6, top + 1, pal.gold); dot(hx + 2, top, pal.gold); dot(hx + 5, top + 2, pal.gold); }
    if (ac === 'nemes') {
      // striped royal headdress
      const c1 = pal.gold, c2 = '#1f4fb5';
      ell(hx, hy - 3, 10, 8, c1, -1e9, hy - 4);
      for (let y = Math.round(top) - 1; y < hy - 4; y += 2) fill(hx - 10, y, 20, 1, c2);
      if (!sideV) for (let y = hy - 4; y < hy + 12; y++) { const c = (y % 2) ? c2 : c1; fill(hx - 12, y, 4, 1, c); fill(hx + 8, y, 4, 1, c); }
      else for (let y = hy - 4; y < hy + 10; y++) fill(hx + 2, y, 7, 1, (y % 2) ? c2 : c1);
      if (dir === 'down') { fill(hx - 9, hy - 5, 18, 1, pal.goldL); fill(hx - 1, top - 1, 2, 3, '#3fc28a'); }
    }
    if (L.gear === 'helmet') {
      ell(hx + (sideV ? 1 : 0), hy, 11, 11.5, 'rgba(210,235,255,0.35)');
      ell(hx + (sideV ? 1 : 0), hy, 11, 11.5, null);
      fill(hx - 10, hy + 8, 20, 3, '#cfd5e0'); fill(hx - 10, hy + 8, 20, 1, '#ffffff');
      if (dir !== 'up') { fill(hx - 6, hy - 7, 4, 2, 'rgba(255,255,255,.7)'); }
      else ell(hx, hy, 10, 10.5, '#e9ecf2');
      fill(hx - 11, hy - 1, 2, 4, pal.acc);
    }
  }
}

function drawDroid(fill, ell, pal, dir, frame) {
  const b = frame ? 1 : 0;
  ell(16, 18 + b, 9, 9, '#c9ced9'); ell(14, 15 + b, 5, 4, '#eef1f6');
  fill(9, 26 + b, 14, 12, '#9aa2b5'); fill(9, 26 + b, 14, 2, '#c9ced9');
  if (dir !== 'up') { fill(11, 15 + b, 10, 5, '#1b1d2a'); fill(dir === 'left' ? 11 : dir === 'right' ? 16 : 13, 16 + b, 4, 3, '#5ff2ff'); }
  fill(12, 38, 8, 6, '#6b7385'); fill(11, 44, 10, 3, '#3a3f4e');
  fill(15, 7 + b, 2, 3, '#9aa2b5'); fill(14, 5 + b, 4, 2, frame === 1 ? '#ff4fd8' : '#5ff2ff');
}

const sheetCache = new Map();

/** Sprite sheet: 3 frames × 4 dirs (34×50 cells), outlined. Cached per look. */
export function characterSheet(spec) {
  const L = resolveLook(spec);
  const key = JSON.stringify(L);
  if (sheetCache.has(key)) return sheetCache.get(key);
  const [c, ctx] = makeCanvas(FW * 3, FH * 4);
  DIRS.forEach((dir, row) => {
    for (let f = 0; f < 3; f++) {
      const [fc, fctx] = makeCanvas(FW, FH);
      drawFrame(fctx, L, dir, f);
      outline(fc);
      ctx.drawImage(fc, f * FW, row * FH);
    }
  });
  const sheet = { canvas: c, fw: FW, fh: FH, row: Object.fromEntries(DIRS.map((d, i) => [d, i])) };
  sheetCache.set(key, sheet);
  return sheet;
}

/** Draw a character at pixel position (feet at x, y). */
/** `snap` = device pixels per world pixel: positions snap to the screen grid, not the art grid (smooth motion). */
export function drawCharacter(ctx, sheet, dir, frame, x, y, scale = 1, snap = 1) {
  const sx = frame * sheet.fw, sy = sheet.row[dir] * sheet.fh;
  ctx.drawImage(sheet.canvas, sx, sy, sheet.fw, sheet.fh, Math.round((x - (sheet.fw * scale) / 2) * snap) / snap, Math.round((y - (sheet.fh - 1) * scale) * snap) / snap, sheet.fw * scale, sheet.fh * scale);
}

/** Head-and-shoulders avatar as a data URL (for HUD lists). */
const avatarCache = new Map();
export function avatarURL(spec, size = 40) {
  const key = JSON.stringify(resolveLook(spec)) + size;
  if (avatarCache.has(key)) return avatarCache.get(key);
  const sheet = characterSheet(spec);
  const [c, ctx] = makeCanvas(size, size);
  const crop = 28;
  const L = resolveLook(spec);
  ctx.drawImage(sheet.canvas, 3, L.build === 'baby' ? 13 : 0, crop, crop, 0, Math.round(size * 0.04), size, size);
  const url = c.toDataURL();
  avatarCache.set(key, url);
  return url;
}

/** Large animated-preview canvas for onboarding. */
export function drawPreview(canvas, spec, t) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sheet = characterSheet(spec);
  const dirs = ['down', 'right', 'up', 'left'];
  const dir = dirs[Math.floor(t / 1800) % 4];
  const frame = [0, 1, 0, 2][Math.floor(t / 180) % 4];
  const scale = Math.max(1, Math.floor(Math.min(canvas.width / sheet.fw, canvas.height / sheet.fh) * 0.9));
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(canvas.width / 2, canvas.height * 0.92, sheet.fw * scale * 0.32, scale * 3, 0, 0, Math.PI * 2); ctx.fill();
  drawCharacter(ctx, sheet, dir, frame, canvas.width / 2, canvas.height * 0.93, scale);
}

// ───────────────────────── portraits (dialogues) ─────────────────────────

const portraitCache = new Map();
/** 64×64 bust portrait for dialogue boxes. mood ∈ happy | smug | shock | angry | sad | wink */
export function portrait(spec, mood = 'happy') {
  const L = resolveLook(spec);
  const key = JSON.stringify(L) + mood;
  if (portraitCache.has(key)) return portraitCache.get(key);
  // render the front frame big, then repaint the face with more detail
  const sheet = characterSheet(spec);
  const [c, ctx] = makeCanvas(64, 64);
  const bg = ctx.createRadialGradient(32, 30, 4, 32, 32, 44);
  bg.addColorStop(0, shade(L.accent || '#5ff2ff', -0.35)); bg.addColorStop(1, '#070912');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 64, 64);
  const baby = L.build === 'baby';
  const cropY = baby ? 13 : 0;
  ctx.drawImage(sheet.canvas, 0, cropY, FW, 30, 0, -2, FW * 2, 60);
  // expressive mouth / brows overlay (scaled ×2 coordinates of the front face)
  const P = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const ox = 0, oy = -2 - cropY * 2 + (baby ? 28 : 0);
  const hx = (16 + 1) * 2 + ox, hy = (11 + 1) * 2 + oy;
  if (!L.droid && L.accessory !== 'nemes' || L.special === 'pharaoh') {
    const mouthY = hy + 12;
    const skin = L.skin;
    if (mood === 'shock') { P(hx - 3, mouthY - 1, 6, 5, '#3a1414'); P(hx - 2, mouthY, 4, 3, '#7a2a2a'); }
    else if (mood === 'smug') { P(hx - 4, mouthY, 9, 2, skin); P(hx - 3, mouthY, 8, 2, '#5a2020'); P(hx + 4, mouthY - 2, 2, 2, '#5a2020'); }
    else if (mood === 'angry') { P(hx - 5, mouthY, 10, 2, '#3a1414'); P(hx - 11, hy - 4, 7, 2, '#1b1010'); P(hx + 4, hy - 4, 7, 2, '#1b1010'); }
    else if (mood === 'sad') { P(hx - 4, mouthY + 1, 8, 2, '#5a2020'); P(hx - 5, mouthY + 3, 2, 1, '#5a2020'); P(hx + 3, mouthY + 3, 2, 1, '#5a2020'); }
    else if (mood === 'wink') { P(hx - 4, mouthY, 8, 2, '#5a2020'); P(hx + 4, hy + 1, 6, 2, '#1b1010'); }
  }
  // vignette frame
  ctx.strokeStyle = 'rgba(240,195,90,.6)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 62, 62);
  portraitCache.set(key, c);
  return c;
}

export const MAHMOUD_SPEC = { special: 'mahmoud' };
export const PHARAOH_SPEC = { special: 'pharaoh' };
export const BABY_SPEC = { special: 'baby' };

/** Mahmoud's dialogue portrait, mood ∈ 'happy' | 'smug' | 'shock' | 'pharaoh'. */
export function mahmoudPortrait(mood = 'happy') {
  if (mood === 'pharaoh') return portrait(PHARAOH_SPEC, 'smug');
  return portrait(MAHMOUD_SPEC, mood);
}

export function canvasToURL(c) { return c.toDataURL(); }
