// World geometry helpers (Natural Earth 1:110m via world-atlas), equirectangular.
import { feature } from 'topojson-client';
import atlas from 'world-atlas/countries-110m.json';

let cache = null;

/** [{ id, name, rings: [[ [lon,lat], ... ], ...], bbox, centroid }] */
export function countries() {
  if (cache) return cache;
  const fc = feature(atlas, atlas.objects.countries);
  cache = fc.features.filter((f) => f.geometry).map((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const rings = [];
    let best = null, bestArea = -1;
    for (const poly of polys) {
      rings.push(...poly.map(fixRing));
      const a = Math.abs(ringArea(poly[0]));
      if (a > bestArea) { bestArea = a; best = poly[0]; }
    }
    return { id: f.id, name: f.properties.name, rings, centroid: ringCentroid(best) };
  });
  return cache;
}

export const countryGeo = (id) => countries().find((c) => c.id === id) || null;

// Unwrap rings that cross the antimeridian so they can be drawn twice (shifted ±360).
function fixRing(ring) {
  const out = [ring[0].slice()];
  for (let i = 1; i < ring.length; i++) {
    let [lon, lat] = ring[i];
    const prev = out[i - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, lat]);
  }
  return out;
}

function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return a / 2;
}

function ringCentroid(r) {
  let x = 0, y = 0, a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    x += (r[j][0] + r[i][0]) * f; y += (r[j][1] + r[i][1]) * f; a += f;
  }
  if (Math.abs(a) < 1e-9) return r[0];
  return [x / (3 * a), y / (3 * a)];
}

/** Trace all rings of a country as a path in an equirectangular canvas of size w×h. */
export function tracePath(ctx, c, w, h, offsetX = 0) {
  ctx.beginPath();
  for (const ring of c.rings) {
    for (const shift of [0, 360, -360]) {
      const minLon = Math.min(...ring.map((p) => p[0] + shift));
      const maxLon = Math.max(...ring.map((p) => p[0] + shift));
      if (maxLon < -180 || minLon > 180) continue;
      ring.forEach(([lon, lat], i) => {
        const x = ((lon + shift + 180) / 360) * w + offsetX;
        const y = ((90 - lat) / 180) * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }
  }
}

/** Point-in-country test in lon/lat space (even-odd over all rings). */
export function hitTest(lon, lat) {
  for (const c of countries()) {
    let inside = false;
    for (const ring of c.rings) {
      for (const shift of [0, 360, -360]) {
        const L = lon - shift;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i], [xj, yj] = ring[j];
          if ((yi > lat) !== (yj > lat) && L < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
        }
      }
    }
    if (inside) return c;
  }
  return null;
}
