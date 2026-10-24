// Moon campus layout — shared by the renderer (client) and bot navigation (server).
// Units are tiles. The client renders 32 px per tile (HD pixel art).

export const TILE = 32;
export const MAP_W = 84;
export const MAP_H = 60;
export const EDGE_ROWS = 4; // rows 0..3: the crater edge — beyond the railing is open space

// Every building with a door can be entered (`interior` = interior scene id).
export const BUILDINGS = [
  { id: 'emb_pt', kind: 'embassy', nation: 'portugal', label: 'Portuguese Embassy', x: 3, y: 6, w: 14, h: 10, door: [10, 16], interior: 'emb_pt_1' },
  { id: 'emb_mk', kind: 'embassy', nation: 'macedonia', label: 'Macedonian Embassy', x: 19, y: 6, w: 14, h: 10, door: [26, 16], interior: 'emb_mk_1' },
  { id: 'emb_pl', kind: 'embassy', nation: 'poland', label: 'Polish Embassy', x: 51, y: 6, w: 14, h: 10, door: [58, 16], interior: 'emb_pl_1' },
  { id: 'emb_ma', kind: 'embassy', nation: 'morocco', label: 'Moroccan Embassy', x: 67, y: 6, w: 14, h: 10, door: [74, 16], interior: 'emb_ma_1' },
  { id: 'hq', kind: 'hq', label: "Mahmoud's Control Centre", x: 3, y: 21, w: 13, h: 11, door: [9, 32], interior: 'in_hq' },
  { id: 'biodome', kind: 'biodome', label: 'Biodome Garden', x: 3, y: 35, w: 13, h: 7, door: [9, 42], interior: 'in_bio' },
  { id: 'roles', kind: 'roles', label: 'Role Market', x: 67, y: 21, w: 14, h: 10, door: [74, 31], interior: 'in_roles' },
  { id: 'seer', kind: 'seer', label: "Moumanou's Tent", x: 70, y: 34, w: 10, h: 7, door: [75, 41], interior: 'in_seer' },
  { id: 'black', kind: 'black', label: 'Black Market', x: 4, y: 45, w: 14, h: 8, door: [11, 53], interior: 'in_black' },
  { id: 'club', kind: 'club', label: 'Club Cléopâtre', x: 22, y: 46, w: 16, h: 7, door: [30, 53], interior: 'in_club' },
  { id: 'tower', kind: 'tower', label: 'Control Tower · Moon Arcade', x: 75, y: 47, w: 8, h: 7, door: [78, 54], interior: 'in_tower' },
];

// Walkable surfaces, painted in order (later wins).
export const SURFACES = [
  { kind: 'path', x: 2, y: 16, w: 80, h: 3 },    // Embassy Avenue
  { kind: 'plaza', x: 35, y: 4, w: 14, h: 12 },  // Earthrise overlook
  { kind: 'path', x: 18, y: 19, w: 3, h: 37 },   // west road
  { kind: 'path', x: 63, y: 19, w: 3, h: 24 },   // east road
  { kind: 'plaza', x: 4, y: 32, w: 14, h: 2 },   // HQ forecourt (sidewalk, not a road)
  { kind: 'plaza', x: 66, y: 31, w: 15, h: 2 },  // Role Market forecourt
  { kind: 'path', x: 2, y: 42, w: 80, h: 2 },    // south road
  { kind: 'path', x: 3, y: 53, w: 41, h: 3 },    // neon alley (Black Market → Club → spaceport)
  { kind: 'path', x: 38, y: 19, w: 8, h: 2 },    // avenue → plaza
  { kind: 'plaza', x: 24, y: 21, w: 36, h: 20 }, // Grand Plaza
  { kind: 'pad', x: 44, y: 44, w: 30, h: 14 },   // spaceport
  { kind: 'path', x: 74, y: 51, w: 8, h: 7 },    // tower apron
  { kind: 'garden', x: 27, y: 23, w: 6, h: 4 }, { kind: 'garden', x: 51, y: 23, w: 6, h: 4 },
  { kind: 'garden', x: 27, y: 35, w: 6, h: 4 }, { kind: 'garden', x: 51, y: 35, w: 6, h: 4 },
];

export const FOUNTAIN = { cx: 42, cy: 31, r: 2.6 };
export const STATUE = { x: 42, y: 25.6 };
export const SHIP = { x: 52, y: 46, w: 16, h: 8, ramp: [60, 54] };
export const BILLBOARD = { x: 36, y: 21, w: 12 };
export const CAFE = { x: 29, y: 36, w: 4, h: 2 }; // Alice & Nico's French café kiosk

// Props: `f` = footprint in tiles [x, y, w, h] that blocks movement (null = walk-through).
export const PROPS = (() => {
  const P = [];
  const add = (kind, x, y, f, extra = {}) => P.push({ kind, x, y, f, ...extra });
  // bioluminescent trees in the four gardens
  for (const [gx, gy] of [[27, 23], [51, 23], [27, 35], [51, 35]]) {
    add('biotree', gx + 1.5, gy + 2, [gx + 1, gy + 1, 1, 1]);
    add('biotree', gx + 4.5, gy + 3, [gx + 4, gy + 2, 1, 1], { hue: 1 });
    add('glowshroom', gx + 3, gy + 1.2, null);
  }
  // neon light poles
  for (const x of [5, 13, 21, 30, 54, 62, 70, 78]) add('neonlamp', x + 0.5, 19.6, [x, 19, 1, 1]);
  for (const [x, y] of [[24, 21], [59, 21], [24, 40], [59, 40], [16, 35], [66, 33], [30, 44], [50, 44], [16, 57], [36, 57]]) add('neonlamp', x + 0.5, y + 0.6, [x, y, 1, 1]);
  // benches (solid!)
  for (const [x, y] of [[34, 28], [48, 28], [34, 34], [48, 34], [29, 31], [53, 31]]) add('bench', x + 1, y + 0.9, [x, y, 2, 1]);
  // holo flags in front of each embassy
  for (const [x, nation] of [[16, 'portugal'], [32, 'macedonia'], [64, 'poland'], [80, 'morocco']]) add('flagpole', x + 0.5, 15.8, [x, 15, 1, 1], { nation });
  for (const x of [37, 41, 45]) add('telescope', x + 0.5, 5.7, [x, 5, 1, 1]);
  add('antenna', 1.5, 30, [1, 29, 1, 1]);
  add('rover', 34, 57.6, [33, 57, 2, 1]);
  add('crates', 45, 56.8, [44, 56, 2, 1]);
  add('crates', 70, 56.8, [69, 56, 2, 1]);
  for (const x of [46, 48]) add('tank', x + 0.5, 46.2, [x, 45, 1, 1]);
  add('dish', 13.5, 22.8, null);
  // cyberpunk street furniture
  add('vending', 22.5, 22.6, [22, 22, 1, 1], { hue: 0 });
  add('vending', 60.5, 22.6, [60, 22, 1, 1], { hue: 1 });
  add('vending', 21.5, 45.6, [21, 45, 1, 1], { hue: 2 });
  add('terminal', 47, 20.6, [46, 20, 1, 1]);
  add('terminal', 21.5, 41.6, [21, 41, 1, 1]);
  add('hoload', 62.5, 40.8, [62, 40, 1, 1], { ad: 'roles' });
  add('hoload', 21.5, 33.8, [21, 33, 1, 1], { ad: 'club' });
  add('steamvent', 26, 42.6, null); add('steamvent', 57, 42.6, null); add('steamvent', 40, 54.5, null); add('steamvent', 8, 18.4, null);
  add('cafe', CAFE.x + 2, CAFE.y + 2, [CAFE.x, CAFE.y, CAFE.w, CAFE.h]);
  add('cafetable', 28.5, 39.3, [28, 39, 1, 1]); add('cafetable', 33.5, 39.3, [33, 39, 1, 1]);
  add('hoverbike', 54.5, 57.2, [54, 56, 2, 1]);
  add('planter', 37, 44.6, [36, 44, 2, 1]); add('planter', 43, 44.6, [42, 44, 2, 1]);
  add('barrier', 22, 54.9, null); add('barrier', 37.5, 54.9, null);
  add('bollard', 17.5, 52.6, [17, 52, 1, 1]); add('bollard', 38.5, 52.6, [38, 52, 1, 1]);
  return P;
})();

// Interaction zones on the campus: walking close shows a prompt.
export const ZONES = [
  ...BUILDINGS.filter((b) => b.door).map((b) => ({ id: b.id, label: `Enter: ${b.label}`, x: b.door[0] + 0.5, y: b.door[1] + 0.6, r: 1.7, kind: 'door', building: b.id, interior: b.interior, nation: b.nation })),
  { id: 'ship', label: 'Board the spacecraft', x: SHIP.ramp[0] + 0.5, y: SHIP.ramp[1] + 0.8, r: 2.4, kind: 'ship' },
  { id: 'telescope', label: 'Look through the telescope', x: 41.5, y: 6.6, r: 1.6, kind: 'telescope' },
  { id: 'terminal_a', label: 'Read the info terminal', x: 46.5, y: 21.4, r: 1.4, kind: 'terminal' },
  { id: 'terminal_b', label: 'Read the info terminal', x: 22, y: 42.4, r: 1.4, kind: 'terminal' },
];

export const MAHMOUD_SPOT = { x: 45.5, y: 27.4 };
export const SPAWN = { x: 42, y: 18.5 };

// Bot / NPC navigation graph (tile coordinates).
export const WAYPOINTS = {
  A: [10.5, 17.5], B: [19.5, 17.5], C: [26.5, 17.5], D: [42, 17.5], E: [58.5, 17.5], F: [64.5, 17.5], G: [74.5, 17.5],
  H: [42, 12], I: [42, 21.5], J: [30, 29], K: [54, 29], L: [42, 38.5], M: [19.5, 33], N: [9.5, 33.5], O: [64.5, 32], P: [74.5, 32.5],
  Q: [19.5, 43], R: [42, 43], S: [64.5, 43], T: [11.5, 54.5], Y: [19.5, 54.5], U: [30, 54.5], V: [44, 54.5], W: [60.5, 55.5], X: [76, 55.5],
};
export const WAY_EDGES = [
  ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'F'], ['F', 'G'], ['D', 'H'], ['D', 'I'], ['I', 'J'], ['I', 'K'], ['J', 'L'], ['K', 'L'],
  ['B', 'M'], ['M', 'N'], ['M', 'Q'], ['F', 'O'], ['O', 'P'], ['O', 'S'], ['L', 'R'], ['Q', 'R'], ['R', 'S'], ['Q', 'Y'], ['Y', 'T'], ['Y', 'U'], ['U', 'V'], ['V', 'W'], ['W', 'X'], ['S', 'X'],
];

/** Build a collision grid: 1 = blocked. */
export function buildCollision() {
  const grid = new Uint8Array(MAP_W * MAP_H);
  const block = (x, y) => { if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) grid[y * MAP_W + x] = 1; };
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (x < 1 || y < EDGE_ROWS + 1 || x >= MAP_W - 1 || y >= MAP_H - 1) block(x, y);
  for (let y = EDGE_ROWS; y <= EDGE_ROWS + 1; y++) for (let x = 36; x < 48; x++) grid[y * MAP_W + x] = 0;
  for (let x = 36; x < 48; x++) block(x, EDGE_ROWS);
  for (const b of BUILDINGS) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) block(x, y);
  for (let y = SHIP.y + 2; y < SHIP.y + SHIP.h - 1; y++) for (let x = SHIP.x + 1; x < SHIP.x + SHIP.w - 1; x++) block(x, y);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (Math.hypot(x + 0.5 - FOUNTAIN.cx, y + 0.5 - FOUNTAIN.cy) < FOUNTAIN.r) block(x, y);
  block(Math.floor(STATUE.x), Math.floor(STATUE.y)); block(Math.floor(STATUE.x) - 1, Math.floor(STATUE.y));
  for (const p of PROPS) if (p.f) { const [fx, fy, fw, fh] = p.f; for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) block(x, y); }
  return grid;
}

export const isBlocked = (grid, tx, ty) => tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || grid[ty * MAP_W + tx] === 1;

/** Tiny deterministic PRNG for decoration placement. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
