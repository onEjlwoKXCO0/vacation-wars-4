// Procedural Earth textures built from real country outlines (Natural Earth 1:110m).
import { countries, tracePath } from '../gfx/geo.js';
import { mulberry32 } from '../../shared/map.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; }

function makeNoise(seed, size = 256) {
  const rnd = mulberry32(seed);
  const v = new Float32Array(size * size).map(() => rnd());
  const s = (t) => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi);
    const i = (a, b) => v[((b & (size - 1)) * size) + (a & (size - 1))];
    return (i(xi, yi) * (1 - xf) + i(xi + 1, yi) * xf) * (1 - yf) + (i(xi, yi + 1) * (1 - xf) + i(xi + 1, yi + 1) * xf) * yf;
  };
  return (x, y, oct = 5) => { let a = 0, amp = 0.5, f = 1; for (let o = 0; o < oct; o++) { a += amp * n(x * f, y * f); amp *= 0.5; f *= 2; } return a; };
}

/** Day texture, night-lights texture and a land mask (white = land) for ocean glint. */
export function buildEarthTextures(W = 2048, H = 1024) {
  const [mask, mctx] = canvas(W, H);
  mctx.fillStyle = '#000'; mctx.fillRect(0, 0, W, H);
  mctx.fillStyle = '#fff';
  for (const c of countries()) { tracePath(mctx, c, W, H); mctx.fill('evenodd'); }
  const m = mctx.getImageData(0, 0, W, H).data;
  const fbm = makeNoise(7);
  const [day, dctx] = canvas(W, H);
  const img = dctx.createImageData(W, H), d = img.data;
  const [night, nctx] = canvas(W, H);
  const nimg = nctx.createImageData(W, H), nd = nimg.data;
  const rnd = mulberry32(99);
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y / H) * 180, al = Math.abs(lat);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const land = m[i] > 127;
      const nx = (x / W) * 24, ny = (y / H) * 12;
      const nz = fbm(nx, ny);
      if (land) {
        // biome by latitude + noise: tropics green, subtropics desert, temperate green, poles ice
        const desert = Math.max(0, 1 - Math.abs(al - 24) / 12) * (0.55 + nz * 0.9);
        const ice = Math.max(0, (al - 62) / 10);
        let r = 52 + nz * 40, g = 98 + nz * 46, b = 44 + nz * 20; // vegetation
        if (al < 12) { r -= 14; g += 8; b -= 6; }
        const dr = 196 + nz * 30, dg = 164 + nz * 26, db = 112 + nz * 20; // sand
        const t = Math.min(1, desert);
        r = r * (1 - t) + dr * t; g = g * (1 - t) + dg * t; b = b * (1 - t) + db * t;
        const k = Math.min(1, ice); r = r * (1 - k) + 236 * k; g = g * (1 - k) + 240 * k; b = b * (1 - k) + 246 * k;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
        // city lights: denser in temperate northern latitudes
        const pop = (lat > 20 && lat < 60 ? 1 : lat > -40 && lat < 20 ? 0.55 : 0.15) * (al > 62 ? 0 : 1);
        if (rnd() < 0.012 * pop * (0.4 + nz)) { nd[i] = 255; nd[i + 1] = 196 + rnd() * 50; nd[i + 2] = 110; nd[i + 3] = 255; }
      } else {
        const deep = 0.6 + nz * 0.5;
        d[i] = 8 + 10 * deep; d[i + 1] = 38 + 34 * deep; d[i + 2] = 92 + 60 * deep; d[i + 3] = 255;
        if (al > 72) { d[i] = 200; d[i + 1] = 214; d[i + 2] = 230; }
      }
    }
  }
  dctx.putImageData(img, 0, 0);
  // soften the night lights into glows
  nctx.putImageData(nimg, 0, 0);
  const [nglow, gctx] = canvas(W, H);
  gctx.fillStyle = '#000'; gctx.fillRect(0, 0, W, H);
  gctx.filter = 'blur(2px)'; gctx.drawImage(night, 0, 0); gctx.filter = 'none';
  gctx.globalCompositeOperation = 'lighter'; gctx.drawImage(night, 0, 0);
  // subtle coastline darkening on the day map
  dctx.globalCompositeOperation = 'source-atop';
  dctx.strokeStyle = 'rgba(20,40,30,.35)'; dctx.lineWidth = 1.2;
  for (const c of countries()) { tracePath(dctx, c, W, H); dctx.stroke(); }
  return { day, night: nglow, mask };
}

export function buildClouds(W = 1024, H = 512) {
  const [c, ctx] = canvas(W, H);
  const fbm = makeNoise(31);
  const img = ctx.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const lat = Math.abs(90 - (y / H) * 180);
    const band = 0.5 + 0.25 * Math.cos((lat / 90) * Math.PI * 3);
    const v = fbm((x / W) * 16, (y / H) * 8, 6) * band * 1.6;
    const a = Math.max(0, Math.min(1, (v - 0.42) * 3));
    const i = (y * W + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a * 210;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Gold highlight overlay for candidate countries. weights: {id: 0..1}, winner: id */
export function buildHighlight(ids, { winner = null, W = 2048, H = 1024 } = {}) {
  const [c, ctx] = canvas(W, H);
  for (const geo of countries()) {
    if (!ids.includes(geo.id)) continue;
    const win = Array.isArray(winner) ? winner.includes(geo.id) : geo.id === winner;
    tracePath(ctx, geo, W, H);
    ctx.fillStyle = win ? 'rgba(240,190,90,.45)' : 'rgba(220,180,90,.16)';
    ctx.fill('evenodd');
    ctx.strokeStyle = win ? 'rgba(255,230,170,.75)' : 'rgba(240,205,130,.45)';
    ctx.lineWidth = win ? 3 : 1.5;
    ctx.stroke();
  }
  return c;
}

/** Orthographic still image of the globe (for 2D scenes such as the intro). */
export function renderGlobeImage(tex, size = 320, { lon0 = 15, lat0 = 25, sun = [-0.55, 0.45, 0.7] } = {}) {
  const [c, ctx] = canvas(size, size);
  const day = tex.day.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, tex.day.width, tex.day.height);
  const night = tex.night.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, tex.night.width, tex.night.height);
  const TW = tex.day.width, TH = tex.day.height;
  const img = ctx.createImageData(size, size), d = img.data;
  const sl = Math.hypot(...sun), sx = sun[0] / sl, sy = sun[1] / sl, sz = sun[2] / sl;
  const la0 = (lat0 * Math.PI) / 180, cosL = Math.cos(la0), sinL = Math.sin(la0);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x + 0.5) / size * 2 - 1, ny = 1 - (y + 0.5) / size * 2;
    const r2 = nx * nx + ny * ny;
    if (r2 > 1) continue;
    const nz = Math.sqrt(1 - r2);
    // rotate view vector back by the center latitude
    const ry = ny * cosL + nz * sinL, rz = -ny * sinL + nz * cosL;
    const lat = Math.asin(ry), lon = Math.atan2(nx, rz) + (lon0 * Math.PI) / 180;
    let u = (lon / (2 * Math.PI) + 0.5) % 1; if (u < 0) u += 1;
    const tx = Math.min(TW - 1, Math.floor(u * TW)), ty = Math.min(TH - 1, Math.floor((0.5 - lat / Math.PI) * TH));
    const ti = (ty * TW + tx) * 4;
    const light = nx * sx + ny * sy + nz * sz;
    const k = Math.max(0, Math.min(1, (light + 0.15) / 0.4));
    const shade = 0.05 + 1.0 * Math.max(0, light);
    const rim = Math.pow(1 - nz, 2.5);
    const i = (y * size + x) * 4;
    d[i] = day.data[ti] * shade * k + night.data[ti] * 1.4 * (1 - k) + 70 * rim;
    d[i + 1] = day.data[ti + 1] * shade * k + night.data[ti + 1] * 1.3 * (1 - k) + 140 * rim;
    d[i + 2] = day.data[ti + 2] * shade * k + night.data[ti + 2] * 0.8 * (1 - k) + 255 * rim;
    const edge = Math.min(1, (1 - Math.sqrt(r2)) * size * 0.5);
    d[i + 3] = 255 * edge;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
