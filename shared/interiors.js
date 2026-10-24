// Interiors of every enterable building. Units: tiles (32 px). Rows 0–2 are the back wall.
// Furniture with `solid` blocks movement; the renderer draws the same list, so what you
// see is what you bump into. Embassy floor 2 (the cosy bedroom) is private to that
// embassy's nationals and their partner — enforced by the server.

export const EMB_CODE = { portugal: 'pt', macedonia: 'mk', poland: 'pl', morocco: 'ma' };
export const CODE_NATION = { pt: 'portugal', mk: 'macedonia', pl: 'poland', ma: 'morocco' };
const F = (kind, x, y, w, h, solid = true, extra = {}) => ({ kind, x, y, w, h, solid, ...extra });

const EMB_STYLE = {
  pt: { name: 'Embaixada de Portugal', floor: 'wood', wall: 'azulejo', accent: '#2a5db0', warm: '255,200,130' },
  mk: { name: 'Амбасада на Македонија', floor: 'stone', wall: 'timber', accent: '#ce2028', warm: '255,190,110' },
  pl: { name: 'Ambasada RP', floor: 'parquet', wall: 'wycinanki', accent: '#dc143c', warm: '255,210,150' },
  ma: { name: 'Ambassade du Maroc', floor: 'zellige', wall: 'riad', accent: '#006233', warm: '255,170,80' },
};

const EMB_F1 = {
  pt: [F('pastry_counter', 1, 4, 4, 2), F('rooster', 13, 3.2, 1, 1), F('guitar_wall', 6.2, 0.5, 1, 2, false), F('tram_poster', 12, 0.3, 3, 2.2, false),
    F('port_barrels', 1, 9, 3, 2), F('sardine_shelf', 16, 7, 3, 2), F('table_round', 5, 8, 2, 2), F('table_round', 12, 8, 2, 2), F('plant_orange', 18, 11, 1, 1), F('rug', 7, 6, 6, 5, false, { pattern: 'azulejo' }), F('chandelier', 9, 0, 2, 1, false)],
  mk: [F('lake_painting', 11.5, 0.3, 4, 2.2, false), F('copper_pots', 6, 0.6, 2, 1.6, false), F('ajvar_shelf', 1, 4, 3, 2), F('wooden_chest', 16, 7, 2, 1),
    F('table_long', 5, 8, 6, 2, true, { theme: 'mk' }), F('pearl_display', 1, 9, 2, 2), F('plant', 18, 11, 1, 1), F('kilim', 13, 6, 5, 4, false), F('chandelier', 9, 0, 2, 1, false)],
  pl: [F('tiled_stove', 13, 1.5, 2, 3), F('piano', 1, 4, 4, 2), F('amber_cabinet', 6.3, 0.5, 1.6, 2.2, false), F('dragon', 17, 8, 2, 2),
    F('table_long', 5, 8, 6, 2, true, { theme: 'pl' }), F('folk_chest', 1, 9, 2, 1), F('plant', 18, 11, 1, 1), F('rug', 13, 6, 4, 4, false, { pattern: 'folk' }), F('chandelier', 9, 0, 2, 1, false)],
  ma: [F('riad_fountain', 8, 7, 4, 3), F('lantern_hang', 3, 0.1, 1, 2, false), F('lantern_hang', 14, 0.1, 1, 2, false), F('arch_niche', 11.4, 0.1, 2, 2.6, false),
    F('poufs', 1, 8, 4, 3), F('tea_table', 15, 8, 3, 2), F('carpet_stack', 1, 4, 3, 2), F('palm_pot', 18, 11, 1, 1), F('palm_pot', 1, 11.4, 1, 1)],
};

function embassyFloor(code, floor) {
  const s = EMB_STYLE[code];
  const nation = CODE_NATION[code];
  const id = `emb_${code}_${floor}`;
  if (floor === 1) {
    return {
      id, name: s.name, w: 20, h: 13, theme: s, nation, music: `emb_${code}`, outside: `emb_${code}`,
      exit: { x: 10, y: 12.4 }, spawn: { x: 10, y: 11, dir: 'up' },
      stairs: { x: 17.5, y: 4.4, to: `emb_${code}_2`, label: 'Go upstairs (private bedroom)', arrive: { x: 16, y: 5.2, dir: 'down' } },
      furniture: [F('stairs', 16, 2, 3, 3, false), F('desk', 8, 4, 4, 1), F('flag_stand', 6.4, 2.9, 0.8, 2.1, false), F('flag_stand', 12.3, 2.9, 0.8, 2.1, false), F('stats_board', 1, 0.3, 5, 2.2, false), F('doormat', 9, 12, 2, 1, false), F('window', 2, 0.6, 0, 0, false), ...EMB_F1[code]],
      npcs: [{ id: 'ambassador', x: 10, y: 3.9, dir: 'down', nation }],
      zones: [{ id: 'ambassador', kind: 'ambassador', label: 'Talk to the ambassador', x: 10, y: 5.6, r: 1.5, nation }, { id: 'stats', kind: 'stats', label: 'Read the travel board', x: 3.5, y: 3.6, r: 1.6, nation }],
      lights: 'warm',
    };
  }
  return {
    id, name: `${s.name} — private floor`, w: 20, h: 13, theme: s, nation, music: `emb_${code}`, outside: `emb_${code}`, private: nation, cosy: true,
    exit: null, spawn: { x: 16, y: 5.2, dir: 'down' },
    stairs: { x: 17.5, y: 4.4, to: `emb_${code}_1`, label: 'Go downstairs', arrive: { x: 16, y: 5.2, dir: 'down' } },
    furniture: [
      F('stairs', 16, 2, 3, 3, false, { down: true }), F('window_earth', 6.5, 0.3, 6, 2.3, false), F('fairy_lights', 1, 0.1, 18, 1, false),
      F('bed', 2, 3, 5, 5, true, { theme: code }), F('nightstand', 1, 3, 1, 1), F('nightstand', 7, 3, 1, 1),
      F('fireplace', 13, 1.4, 3, 2.2), F('couch', 12, 8, 5, 2), F('coffee_table', 13, 6.6, 3, 1), F('bookshelf', 9, 1.4, 3, 2), F('record_player', 1, 10, 2, 1),
      F('rug', 2, 8.5, 7, 3, false, { pattern: code === 'ma' ? 'berber' : code === 'pl' ? 'folk' : code === 'mk' ? 'kilim' : 'azulejo' }), F('plant', 18, 11, 1, 1), F('candles', 7.2, 3.1, 1, 1, false), F('photo_wall', 3, 0.5, 2.8, 1.8, false),
      F('bathtub', 17, 7.5, 2, 3),
    ],
    npcs: [],
    zones: [{ id: 'bed', kind: 'bed', label: 'Lie down a moment', x: 4.5, y: 8.4, r: 1.6 }, { id: 'fire', kind: 'fire', label: 'Warm up by the fire', x: 14.5, y: 4.4, r: 1.4 }, { id: 'music', kind: 'music', label: 'Play a record', x: 2, y: 9.5, r: 1.3 }],
    lights: 'cosy',
  };
}

export const INTERIORS = {};
for (const code of ['pt', 'mk', 'pl', 'ma']) for (const f of [1, 2]) { const d = embassyFloor(code, f); INTERIORS[d.id] = d; }

INTERIORS.in_hq = {
  id: 'in_hq', name: "Mahmoud's Control Centre", w: 22, h: 14, theme: { floor: 'hqmarble', wall: 'hqwall', accent: '#f0c35a' }, music: 'hq', outside: 'hq',
  exit: { x: 11, y: 13.4 }, spawn: { x: 11, y: 12, dir: 'up' },
  furniture: [F('rules_board', 1.4, 0.45, 5, 1.8, false), F('video_wall', 7, 0.25, 8, 2.5, false), F('mission_board', 15.6, 0.45, 5, 1.8, false),
    F('red_carpet', 10.25, 4.9, 1.5, 9.1, false), F('floor_emblem', 8, 6.6, 6, 4.2, false),
    F('gold_desk', 8.5, 3.5, 5, 1.3), F('pharaoh_bust', 2.2, 4.4, 2.4, 1.2), F('bookshelf', 16.6, 3.6, 3.6, 1),
    F('holo_table', 2.2, 7.6, 4, 2.6), F('dolphin_tank', 15.8, 8, 4, 2),
    F('trophy_shelf', 1.8, 12, 3.2, 1), F('espresso_bar', 16.4, 12.2, 3.6, 0.9), F('velvet_sofa', 5.6, 11.4, 3.4, 1.4), F('plant', 0.6, 6.2, 1, 1), F('plant', 20.4, 6.2, 1, 1), F('plant', 13.8, 11.6, 1, 1), F('doormat', 10, 13, 2, 1, false)],
  npcs: [{ id: 'droid_hq', x: 12.8, y: 12.1, dir: 'down' }],
  zones: [{ id: 'rules', kind: 'hq', label: 'Read the rules & mission board', x: 11, y: 6.4, r: 2 }, { id: 'rules2', kind: 'hq', label: 'Watch the holo table', x: 4.2, y: 10.9, r: 1.6 }],
  lights: 'hq',
};

INTERIORS.in_roles = {
  id: 'in_roles', name: 'Role Market', w: 24, h: 14, theme: { floor: 'neongrid', wall: 'cyber', accent: '#ff4fd8' }, music: 'role_market', outside: 'roles',
  exit: { x: 12, y: 13.4 }, spawn: { x: 12, y: 12, dir: 'up' },
  furniture: [F('cyber_banner', 1, 0.2, 22, 1.2, false), F('holo_counter', 9, 3, 6, 1.6), F('role_pod', 1, 4, 3, 2, true, { role: 0 }), F('role_pod', 1, 7.5, 3, 2, true, { role: 1 }), F('role_pod', 1, 10.5, 3, 2, true, { role: 2 }),
    F('role_pod', 20, 4, 3, 2, true, { role: 3 }), F('role_pod', 20, 7.5, 3, 2, true, { role: 4 }), F('role_pod', 20, 10.5, 3, 2, true, { role: 5 }),
    F('neon_plinth', 6, 7, 1, 1, true, { role: 'commander' }), F('neon_plinth', 8, 9, 1, 1, true, { role: 'hacker' }), F('neon_plinth', 15, 9, 1, 1, true, { role: 'diplomat' }), F('neon_plinth', 17, 7, 1, 1, true, { role: 'chaos' }),
    F('cyber_mat', 11, 13, 2, 1, false), F('neon_hang', 5, 0.8, 1, 2, false), F('neon_hang', 18, 0.8, 1, 2, false)],
  npcs: [{ id: 'droid_roles', x: 12, y: 2.9, dir: 'down' }],
  zones: [{ id: 'roles', kind: 'roles', label: 'Choose your role at the counter', x: 12, y: 5.4, r: 2.2 }],
  lights: 'cyber',
};

INTERIORS.in_black = {
  id: 'in_black', name: 'Black Market', w: 20, h: 13, theme: { floor: 'grate', wall: 'graffiti', accent: '#c77dff' }, music: 'black_market', outside: 'black',
  exit: { x: 10, y: 12.4 }, spawn: { x: 10, y: 11, dir: 'up' },
  furniture: [F('neon_sign_bm', 6, 0.2, 8, 1.4, false), F('counter_bm', 6, 4, 8, 1.5), F('shelf_glow', 1, 3, 3, 2), F('shelf_glow', 16, 3, 3, 2), F('cage', 1, 8, 3, 3), F('crates_bm', 16, 8, 3, 2),
    F('rug', 6, 7, 8, 4, false), F('safe', 17, 11, 2, 1), F('card_table', 8, 7.4, 4, 2), F('lounge', 1, 5.6, 4, 2), F('pipes', 0, 0, 20, 1, false), F('doormat', 9, 12, 2, 1, false), F('screen_tv', 15, 0.4, 3, 1.8, false), F('screen_tv', 2, 0.4, 3, 1.8, false)],
  npcs: [{ id: 'hicham', x: 10, y: 3.9, dir: 'down' }],
  zones: [{ id: 'npc_hicham', kind: 'npc', npc: 'hicham', label: 'Talk to Hicham', x: 10, y: 6.2, r: 1.8 }],
  lights: 'purple',
};

INTERIORS.in_club = {
  id: 'in_club', name: 'Club Cléopâtre', w: 24, h: 15, theme: { floor: 'dance', wall: 'egypt', accent: '#ff4fd8' }, music: 'club', outside: 'club',
  exit: { x: 12, y: 14.4 }, spawn: { x: 12, y: 13, dir: 'up' },
  furniture: [F('egypt_wall_art', 1, 0.2, 22, 2.6, false), F('dancefloor', 6, 5, 12, 6, false), F('dj_booth', 9, 3, 6, 1.6), F('bar', 1, 4, 3, 6), F('vip_throne', 20, 3, 3, 2), F('vip_rope', 19, 6, 4, 0.6, true),
    F('speaker', 6, 3, 2, 1.6), F('speaker', 16, 3, 2, 1.6), F('lounge', 19, 10, 4, 2), F('doormat', 11, 14, 2, 1, false), F('pyramid_neon', 10.5, 0.4, 3, 2, false)],
  npcs: [{ id: 'imane', x: 21.5, y: 5.1, dir: 'down' }, { id: 'droid_dj', x: 12, y: 3.4, dir: 'down' }, { id: 'dancer1', x: 8.5, y: 7, dir: 'down', dance: true }, { id: 'dancer2', x: 14.5, y: 8.5, dir: 'left', dance: true }, { id: 'dancer3', x: 11, y: 9.5, dir: 'right', dance: true }],
  zones: [{ id: 'npc_imane', kind: 'npc', npc: 'imane', label: 'Talk to Imane “Cléopâtre”', x: 20.6, y: 7.2, r: 1.9 }, { id: 'dance', kind: 'dance', label: 'Dance!', x: 12, y: 8, r: 3 }],
  lights: 'club',
};

INTERIORS.in_bio = {
  id: 'in_bio', name: 'Biodome Garden', w: 22, h: 14, theme: { floor: 'moss', wall: 'glass', accent: '#48e08f' }, music: 'biodome', outside: 'biodome',
  exit: { x: 11, y: 13.4 }, spawn: { x: 11, y: 12, dir: 'up' },
  furniture: [F('glass_wall', 0, 0, 22, 2.8, false), F('pond', 8, 4, 6, 3), F('biotree_in', 2, 3, 2, 2), F('biotree_in', 18, 3, 2, 2), F('daybed', 15, 8, 4, 2), F('flowerbed', 1, 8, 4, 2), F('flowerbed', 1, 11, 3, 1),
    F('hammock', 5, 9, 3, 1, false), F('stone_path', 9, 7, 4, 6, false), F('lantern_floor', 13, 11, 1, 1), F('lantern_floor', 7, 11, 1, 1), F('glowshroom_in', 19, 11, 2, 2)],
  npcs: [{ id: 'plami', x: 16.6, y: 10.7, dir: 'down' }],
  zones: [{ id: 'npc_plami', kind: 'npc', npc: 'plami', label: 'Talk to Plami', x: 16.6, y: 11.8, r: 1.8 }],
  lights: 'green',
};

INTERIORS.in_seer = {
  id: 'in_seer', name: "Moumanou's Tent", w: 14, h: 11, theme: { floor: 'carpet', wall: 'tent', accent: '#9b8cff' }, music: 'seer', outside: 'seer',
  exit: { x: 7, y: 10.4 }, spawn: { x: 7, y: 9, dir: 'up' },
  furniture: [F('tent_drapes', 0, 0, 14, 2.8, false), F('crystal_table', 5, 4, 4, 2), F('candles_floor', 1, 3, 2, 2), F('candles_floor', 11, 3, 2, 2), F('cushions', 1, 7, 3, 2), F('cushions', 10, 7, 3, 2),
    F('tarot_wall', 5, 0.4, 4, 2, false), F('doormat', 6, 10, 2, 1, false)],
  npcs: [{ id: 'moumanou', x: 7, y: 3.6, dir: 'down' }],
  zones: [{ id: 'npc_moumanou', kind: 'npc', npc: 'moumanou', label: 'Talk to Moumanou', x: 7, y: 6.6, r: 1.8 }],
  lights: 'violet',
};

INTERIORS.in_tower = {
  id: 'in_tower', name: 'Control Tower · Moon Arcade', w: 26, h: 16, theme: { floor: 'towerdeck', wall: 'observation', accent: '#5ff2ff' }, music: 'control_tower', outside: 'tower',
  exit: { x: 13, y: 15.4 }, spawn: { x: 13, y: 14, dir: 'up' },
  furniture: [F('observation_deck', 0, 0, 26, 2.8, false), F('holo_globe', 10.5, 4.4, 5, 3.2),
    F('quiz_booth', 1, 6.5, 3, 2.2), F('memory_table', 1.5, 11, 4, 2), F('duel_cabinet', 22, 6.5, 3, 2.2), F('leaderboard', 20.5, 10.6, 4.5, 2.4), F('arcade_sign', 7, 0.3, 12, 1.2, false),
    F('cyber_mat', 12, 15, 2, 1, false), F('stool', 4.5, 7.6, 1, 1), F('stool', 21, 7.6, 1, 1), F('plant', 25, 13, 1, 1), F('plant', 0, 13, 1, 1), F('floor_lights', 6, 8, 14, 1, false)],
  npcs: [{ id: 'alessandro', x: 13, y: 8.6, dir: 'down' }],
  zones: [
    { id: 'npc_alessandro', kind: 'npc', npc: 'alessandro', label: 'Talk to Alessandro', x: 13, y: 9.8, r: 1.4 },
    { id: 'globe', kind: 'globe', label: 'Explore the Earth (tap a flag)', x: 13, y: 7.9, r: 2.6 },
    { id: 'arc_quiz', kind: 'arcade', game: 'quiz', label: 'Play: Country Quiz', x: 2.5, y: 9.2, r: 1.6 },
    { id: 'arc_memory', kind: 'arcade', game: 'memory', label: 'Play: Flag Memory', x: 3.5, y: 13.6, r: 1.7 },
    { id: 'arc_duel', kind: 'arcade', game: 'duel', label: 'Play: Globe Duel', x: 23.5, y: 9.2, r: 1.6 },
    { id: 'arc_board', kind: 'arcade', game: 'board', label: 'Arcade leaderboard', x: 22.7, y: 13.6, r: 1.7 },
  ],
  lights: 'tower',
};

/** Collision grid for an interior: walls + solid furniture. */
export function interiorCollision(id) {
  const I = INTERIORS[id];
  const W = I.w, H = I.h;
  const grid = new Uint8Array(W * H);
  const block = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) grid[y * W + x] = 1; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (y < 3 || x < 1 || x >= W - 1) block(x, y);
  const ex = I.exit ? Math.floor(I.exit.x) : -9;
  for (let x = 0; x < W; x++) if (!(x === ex || x === ex - 1)) block(x, H - 1);
  for (const f of I.furniture) if (f.solid) for (let y = Math.floor(f.y); y < Math.ceil(f.y + f.h); y++) for (let x = Math.floor(f.x); x < Math.ceil(f.x + f.w); x++) block(x, y);
  if (I.stairs) for (let x = 16; x < 19; x++) grid[2 * W + x] = 0;
  return grid;
}

export const interiorOf = (buildingId) => Object.values(INTERIORS).find((i) => i.outside === buildingId && !i.private) || null;
