// Pure rule math. No I/O, no randomness, no rendering — everything here is unit-tested.
import { COUNTRIES, countryById } from './data/countries.js';
import { REGIONS, regionById } from './data/regions.js';
import { departureById } from './data/departures.js';

export const round2 = (x) => Math.round(x * 100) / 100;

// ───────────────────────── travel & flexibility ─────────────────────────

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Rough getting-there estimate from a departure airport to a country's reference city.
 * hours = distance / 780 km/h + 0.7 h taxi/climb, + connection time when a layover is likely.
 * fare (return, per person) ≈ 70 € + 0.075 €/km, +30 % from smaller airports on long routes.
 * ease (0–100) = 100 − 6 × hours.
 */
export function travelEstimate(depId, countryId) {
  const dep = departureById(depId);
  const c = countryById(countryId);
  if (!dep || !c) return null;
  const km = Math.round(haversineKm(dep.lat, dep.lon, c.lat, c.lon));
  let hours = km / 780 + 0.7;
  let stops = 0;
  if (!dep.hub && km > 2600) { hours += 2.5; stops = 1; }
  if (dep.hub && km > 7500) { hours += 2; stops = 1; }
  if (km > 14000) { hours += 2; stops = 2; }
  if (c.id === '010') { hours += 40; stops = 2; } // expedition ship from Ushuaia
  let fare = 70 + km * 0.075;
  if (!dep.hub && km > 2600) fare *= 1.3;
  fare = Math.round(fare / 10) * 10;
  const ease = Math.max(0, Math.min(100, Math.round(100 - 6 * hours)));
  return { km, hours: Math.round(hours * 10) / 10, stops, fare, ease };
}

/** Crew view of getting there: per player, average ease, and who has it hardest. */
export function crewTravel(players, countryId) {
  const per = players.map((p) => ({ id: p.id, name: p.name, home: p.home, ...travelEstimate(p.home || '056', countryId) }));
  if (!per.length) return { per, avgEase: 0, hardest: null, avgFare: 0, avgHours: 0 };
  const avgEase = Math.round(per.reduce((a, x) => a + x.ease, 0) / per.length);
  const avgFare = Math.round(per.reduce((a, x) => a + x.fare, 0) / per.length);
  const avgHours = Math.round((per.reduce((a, x) => a + x.hours, 0) / per.length) * 10) / 10;
  const hardest = per.reduce((m, x) => (x.hours > m.hours ? x : m), per[0]);
  return { per, avgEase, avgFare, avgHours, hardest };
}

/** Flexibility: number of months with a comfortable average temperature (18–29 °C). */
export function flexibility(countryId) {
  const c = countryById(countryId);
  if (!c) return { months: 0, index: 0, best: [] };
  const best = c.temp.map((t, i) => [t, i]).filter(([t]) => t >= 18 && t <= 29).map(([, i]) => i);
  return { months: best.length, index: Math.round((best.length / 12) * 100), best };
}

// ───────────────────────── options & weights ─────────────────────────

/**
 * Fixed base slice: the options nobody touches share `baseTotal` together, so a 27-country wheel is
 * not 27 times harder to steer than a 3-country one. `share` lets a rare option (Antarctica) get less.
 */
export function baseFor(count, config, share = 1) {
  const W = config.weights;
  const total = W.baseTotal ?? W.base * count;
  return round2(Math.max(W.minBase ?? 0, (total / Math.max(1, count)) * share));
}

/** How many free picks each crewmate gets on a wheel of n options (3–4 → 1, 5–6 → 2, ≥ 7 → 3). */
export function maxPicksFor(n, config) {
  const cap = config.weights.maxPicks;
  if (n <= 4) return Math.min(cap, 1);
  if (n <= 6) return Math.min(cap, 2);
  return cap;
}

/** Region options with base weight and wish bonus (each player with ≥1 wish in a region adds +10). */
export function regionOptions(wishes, config) {
  const avg = REGIONS.reduce((a, r) => a + r.base, 0) / REGIONS.length;
  return REGIONS.map((r) => {
    const wishers = Object.values(wishes).filter((list) => list.some((cid) => r.members.includes(cid))).length;
    return { id: r.id, base: baseFor(REGIONS.length, config, r.base / avg), wish: config.weights.wishWeight * wishers, wishers };
  });
}

/** Share of a player's wished countries that are comfortable (18–29 °C) in month m. */
export function comfyShare(list, m) {
  const valid = (list || []).map(countryById).filter(Boolean);
  if (!valid.length) return 0;
  return valid.filter((c) => c.temp[m] >= 18 && c.temp[m] <= 29).length / valid.length;
}

/**
 * Month options: equal base; each player adds +10 × (share of their wishes that are comfy that month),
 * so a crewmate wishing Iceland + Thailand pulls a little towards both seasons, not fully towards all.
 * `blocked` = months someone can't travel: removed from the wheel (who blocked is never shown).
 */
export function monthOptions(wishes, config, blocked = []) {
  const months = Array.from({ length: 12 }, (_, m) => m).filter((m) => !blocked.includes(m));
  if (!months.length) months.push(...Array.from({ length: 12 }, (_, m) => m));
  return months.map((m) => {
    const shares = Object.values(wishes).map((list) => comfyShare(list, m));
    const wishers = shares.filter((x) => x > 0).length;
    return { id: String(m), base: baseFor(12, config), wish: round2(config.weights.wishWeight * shares.reduce((a, b) => a + b, 0)), wishers };
  });
}

/** Country options for a region: shared base reduced by crew familiarity, plus +10 per wish. */
export function countryOptions(regionId, crew, wishes, config) {
  const r = regionById(regionId);
  if (!r) return [];
  const base = baseFor(r.members.length, config);
  return r.members.map((cid) => {
    const visitedBy = crew.filter((p) => (p.visited || []).includes(cid)).length;
    const share = crew.length ? visitedBy / crew.length : 0;
    const malus = round2(1 - config.weights.familiarityPenalty * share);
    const wishers = Object.values(wishes).filter((list) => list.includes(cid)).length;
    return { id: cid, base, wish: config.weights.wishWeight * wishers, wishers, visitedBy, malus };
  });
}

export const boostsOn = (d, optId) =>
  Object.values(d.boosts).reduce((a, m) => a + (m[optId] || 0), 0) + Object.values(d.golden || {}).reduce((a, m) => a + (m[optId] || 0), 0);
export const playerBoosts = (d, pid) => Object.values(d.boosts[pid] || {}).reduce((a, b) => a + b, 0);

/**
 * Explainable weight breakdown → probability distribution. The SAME function feeds the live
 * odds, the frozen odds used for bets, and the draw. Vetoed options are removed from the wheel.
 * Decisions with `fixed` probabilities (the final shot) bypass boosts entirely.
 */
/** Number of crewmates who put this option among their picks. */
export function picksOn(d, id) {
  let n = 0;
  for (const list of Object.values(d.picks || {})) if (list.includes(id)) n++;
  return n;
}

export function computeBreakdown(d, config) {
  const W = config.weights;
  const rows = [];
  for (const o of d.options) {
    if (d.vetoed && d.vetoed[o.id]) continue;
    if (d.fixed) { rows.push({ id: o.id, base: o.p, wish: 0, boosts: 0, boostWeight: 0, doubled: false, picks: 0, pickWeight: 0, crowd: 0, unanimous: false, weight: o.p }); continue; }
    const boosts = boostsOn(d, o.id);
    const doubled = !!(d.doubled && d.doubled[o.id]);
    const boostWeight = boosts * W.boostWeight * (doubled ? 2 : 1);
    const picks = picksOn(d, o.id);
    const pickWeight = picks * W.pickWeight;
    const crowd = picks >= 2 ? W.crowdWeight * (picks - 1) ** 2 : 0;
    const unanimous = picks >= 2 && picks >= (d.crewSize || Infinity);
    const malus = o.malus ?? 1;
    const weight = round2((o.base + o.wish + boostWeight + pickWeight + crowd) * malus * (unanimous ? W.unanimityMult : 1));
    rows.push({ id: o.id, base: o.base, wish: o.wish, boosts, boostWeight, doubled, picks, pickWeight, crowd, unanimous, malus, weight });
  }
  // Luck always keeps a slice: no option can pass maxShare (85 %) of the wheel, however hard the crew pushes.
  const cap = W.maxShare;
  if (!d.fixed && cap && rows.length > 1) {
    const top = rows.reduce((m, r) => (r.weight > m.weight ? r : m), rows[0]);
    const rest = rows.reduce((a, r) => a + (r === top ? 0 : r.weight), 0);
    const limit = round2((cap * rest) / (1 - cap));
    if (rest > 0 && top.weight > limit) { top.uncapped = top.weight; top.weight = limit; top.capped = true; }
  }
  const total = rows.reduce((a, r) => a + r.weight, 0);
  if (rows.length === 0 || !(total > 0)) throw new Error('Invalid candidate set: total weight must be positive');
  let acc = 0;
  for (const r of rows) { r.p = r.weight / total; r.lo = acc; acc += r.p; r.hi = acc; }
  rows[rows.length - 1].hi = 1;
  return { rows, total: round2(total) };
}

export function pickWinner(rows, u) {
  if (!(u >= 0 && u < 1)) throw new Error('Draw value must be in [0, 1)');
  for (const r of rows) if (u < r.hi) return r.id;
  return rows[rows.length - 1].id;
}

/** Percentages to one decimal that always add up to exactly 100.0 (largest remainder). */
export function displayPercents(probs) {
  const tenths = probs.map((p) => p * 1000);
  const floors = tenths.map(Math.floor);
  let remaining = 1000 - floors.reduce((a, b) => a + b, 0);
  const order = tenths.map((t, i) => [t - Math.floor(t), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < order.length && remaining > 0; k++, remaining--) floors[order[k][1]] += 1;
  return floors.map((f) => f / 10);
}

export function betMultiplier(p, config) {
  const { margin, minMultiplier, maxMultiplier } = config.betting;
  if (!(p > 0)) return maxMultiplier;
  return round2(Math.min(maxMultiplier, Math.max(minMultiplier, (1 - margin) / p)));
}

/** Settle one bet (stake was escrowed). Returns what is credited back. */
export function settleBet(bet, winnerId, { double = false, insurance = false } = {}) {
  if (!bet) return null;
  if (bet.optionId === winnerId) {
    const payout = Math.floor(bet.stake * bet.multiplier * (double ? 2 : 1));
    return { won: true, payout, profit: payout - bet.stake, double, insured: false };
  }
  return { won: false, payout: insurance ? bet.stake : 0, profit: insurance ? 0 : -bet.stake, double, insured: insurance };
}

// ───────────────────────── Pharaoh's final test ─────────────────────────

/**
 * Final satisfaction S (1–10) from the two tests.
 *  • Couples component: each couple's score is the mean of both partners; single players use their own
 *    score. Units with a Cupid count twice. Component = weighted mean of units.
 *  • Groups component: mean score of the girls, mean score of the boys; component = mean of the groups present.
 *  • S = mean of the two components (whichever exist).
 */
export function satisfaction({ units, groups }) {
  const scoredUnits = units.filter((u) => u.scores.length);
  let couple = null;
  if (scoredUnits.length) {
    const wsum = scoredUnits.reduce((a, u) => a + u.weight, 0);
    couple = scoredUnits.reduce((a, u) => a + u.weight * (u.scores.reduce((x, y) => x + y, 0) / u.scores.length), 0) / wsum;
  }
  const gm = Object.values(groups).filter((s) => s.length).map((s) => s.reduce((x, y) => x + y, 0) / s.length);
  const group = gm.length ? gm.reduce((a, b) => a + b, 0) / gm.length : null;
  const parts = [couple, group].filter((x) => x !== null);
  const S = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 5;
  return { couple: couple === null ? null : round2(couple), group: group === null ? null : round2(group), S: round2(S) };
}

/**
 * Final shot distribution.
 *  • The chosen country gets P = maxLeader × S / 10 (90 % only at a perfect 10/10).
 *  • The rest (1 − P) is shared by every OTHER nominated country, in proportion to
 *    nominations × (1 + 10 % per wish). Fallback when nobody nominated: equal shares of `fallback`.
 */
export function finalDistribution({ selected, S, nominations, wishes, fallback = [] }, config) {
  const P = config.final.maxLeader * Math.max(0, Math.min(10, S)) / 10;
  const counts = {};
  for (const list of Object.values(nominations)) for (const cid of list) if (cid !== selected) counts[cid] = (counts[cid] || 0) + 1;
  let others = Object.entries(counts);
  if (!others.length) others = fallback.filter((c) => c !== selected).map((c) => [c, 1]);
  const wishCount = (cid) => Object.values(wishes).filter((l) => l.includes(cid)).length;
  const weighted = others.map(([cid, n]) => [cid, n, n * (1 + config.final.wishFactor * wishCount(cid))]);
  const wsum = weighted.reduce((a, [, , w]) => a + w, 0);
  const rest = others.length ? 1 - P : 0;
  const leaderP = others.length ? P : 1;
  const opts = [{ id: selected, p: leaderP, nominations: counts[selected] || 0, leader: true }];
  for (const [cid, n, w] of weighted.sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]))) opts.push({ id: cid, p: (rest * w) / wsum, nominations: n, wishes: wishCount(cid) });
  return { P: leaderP, options: opts };
}

export const ALL_COUNTRY_IDS = COUNTRIES.map((c) => c.id);
