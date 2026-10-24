import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG as cfg } from '../shared/config.js';
import {
  computeBreakdown, pickWinner, displayPercents, betMultiplier, settleBet, regionOptions, countryOptions, monthOptions, maxPicksFor, baseFor,
  satisfaction, finalDistribution, travelEstimate, flexibility, crewTravel,
} from '../shared/rules.js';
import { REGIONS } from '../shared/data/regions.js';
import { COUNTRIES } from '../shared/data/countries.js';

const dec = (over = {}) => ({
  options: [{ id: 'a', base: 100, wish: 0 }, { id: 'b', base: 100, wish: 0 }, { id: 'c', base: 100, wish: 0 }],
  boosts: {}, golden: {}, doubled: {}, vetoed: {}, picks: {}, crewSize: 4, ...over,
});

test('probabilities normalize to 1 and the CDF is contiguous', () => {
  const bd = computeBreakdown(dec({ boosts: { p1: { a: 2 } } }), cfg);
  assert.ok(Math.abs(bd.rows.reduce((s, r) => s + r.p, 0) - 1) < 1e-12);
  assert.equal(bd.rows[0].lo, 0); assert.equal(bd.rows.at(-1).hi, 1);
  for (let i = 1; i < bd.rows.length; i++) assert.equal(bd.rows[i].lo, bd.rows[i - 1].hi);
});

test('boosts, doubling, golden tickets, picks and vetoes', () => {
  const bd = computeBreakdown(dec({ boosts: { p1: { a: 2 }, p2: { a: 1 } }, golden: { p3: { b: 3 } }, doubled: { a: 'p4' }, picks: { p1: ['c'], p2: ['c', 'b'] }, vetoed: {} }), cfg);
  const [a, b, c] = bd.rows;
  const W = cfg.weights;
  assert.equal(a.weight, 100 + 3 * 25 * 2);
  assert.equal(b.weight, 100 + 3 * 25 + W.pickWeight);
  assert.equal(c.weight, 100 + 2 * W.pickWeight + W.crowdWeight);
  assert.equal(c.unanimous, false);
  const v = computeBreakdown(dec({ vetoed: { b: 'x' } }), cfg);
  assert.deepEqual(v.rows.map((r) => r.id), ['a', 'c']);
  assert.equal(v.rows[0].p, 0.5);
});

test('crowd bonus grows with the number of pickers and unanimity multiplies the weight', () => {
  const W = cfg.weights;
  const three = computeBreakdown(dec({ picks: { p1: ['a'], p2: ['a'], p3: ['a'] } }), cfg).rows[0];
  assert.equal(three.weight, 100 + 3 * W.pickWeight + W.crowdWeight * 4);
  const all = computeBreakdown(dec({ picks: { p1: ['a', 'b'], p2: ['a'], p3: ['a', 'c'], p4: ['a'] } }), cfg);
  const a = all.rows[0];
  assert.equal(a.unanimous, true);
  assert.equal(a.weight, (100 + 4 * W.pickWeight + W.crowdWeight * 9) * W.unanimityMult);
  assert.ok(a.p > 0.6 && a.p < 0.9, `unanimous option should dominate but not be certain (got ${a.p})`);
});

test('luck always keeps 15%: no option passes maxShare', () => {
  const bd = computeBreakdown(dec({ boosts: { p1: { a: 15 } }, picks: { p1: ['a'], p2: ['a'], p3: ['a'], p4: ['a'] } }), cfg);
  const a = bd.rows[0];
  assert.equal(a.capped, true);
  assert.ok(Math.abs(a.p - cfg.weights.maxShare) < 0.001, `capped at 85% (got ${a.p})`);
  assert.ok(Math.abs(bd.rows.reduce((x, r) => x + r.p, 0) - 1) < 1e-12);
});

test('pickWinner maps draws to bands and rejects out-of-range values', () => {
  const bd = computeBreakdown(dec({ boosts: { p: { a: 4 } } }), cfg); // a=200, b=100, c=100
  assert.equal(pickWinner(bd.rows, 0), 'a');
  assert.equal(pickWinner(bd.rows, 0.4999), 'a');
  assert.equal(pickWinner(bd.rows, 0.5), 'b');
  assert.equal(pickWinner(bd.rows, 0.999999), 'c');
  assert.throws(() => pickWinner(bd.rows, 1));
});

test('draw frequencies match displayed odds', () => {
  const bd = computeBreakdown(dec({ boosts: { p: { b: 3 } } }), cfg);
  const counts = {}; const N = 100000;
  for (let i = 0; i < N; i++) { const w = pickWinner(bd.rows, (i + 0.5) / N); counts[w] = (counts[w] || 0) + 1; }
  for (const r of bd.rows) assert.ok(Math.abs(counts[r.id] / N - r.p) < 1e-4);
});

test('displayed percents always sum to 100.0', () => {
  for (const probs of [[1 / 3, 1 / 3, 1 / 3], Array(11).fill(1 / 11), [0.123456, 0.654321, 0.222223]]) {
    assert.equal(Math.round(displayPercents(probs).reduce((a, b) => a + b, 0) * 10), 1000);
  }
});

test('bets: multiplier bounds, double payout, insurance', () => {
  assert.equal(betMultiplier(0.5, cfg), 1.8);
  assert.equal(betMultiplier(0.01, cfg), cfg.betting.maxMultiplier);
  assert.equal(betMultiplier(0.99, cfg), cfg.betting.minMultiplier);
  const bet = { optionId: 'a', stake: 100, multiplier: 3 };
  assert.deepEqual(settleBet(bet, 'a'), { won: true, payout: 300, profit: 200, double: false, insured: false });
  assert.equal(settleBet(bet, 'a', { double: true }).payout, 600);
  assert.equal(settleBet(bet, 'b').payout, 0);
  assert.equal(settleBet(bet, 'b', { insurance: true }).payout, 100);
});

test('region wishes add +10% of base per player with a wish in the region', () => {
  const opts = regionOptions({ p1: ['620', '300'], p2: ['392'], p3: ['300'] }, cfg);
  const eu = opts.find((o) => o.id === 'europe');
  const ea = opts.find((o) => o.id === 'east_asia');
  assert.equal(eu.wish, 20); // p1 and p3 (p1 counts once even with two European wishes)
  assert.equal(ea.wish, 10);
  assert.equal(opts.length, REGIONS.length);
});

test('country options: already-visited malus multiplies the weight, wishes add +10 each', () => {
  const crew = [{ visited: ['300'] }, { visited: [] }];
  const opts = countryOptions('europe', crew, { p1: ['300'], p2: ['300', '620'] }, cfg);
  const gr = opts.find((o) => o.id === '300');
  const base = Math.max(cfg.weights.minBase, Math.round((cfg.weights.baseTotal / opts.length) * 100) / 100);
  assert.equal(gr.base, base, 'the region shares one fixed base');
  assert.equal(gr.wish, 20);
  assert.equal(gr.malus, 0.85);
  const rows = computeBreakdown({ options: opts, boosts: {}, golden: {}, doubled: {}, vetoed: {} }, cfg).rows;
  assert.equal(rows.find((r) => r.id === '300').weight, Math.round((base + 20) * 0.85 * 100) / 100, '(base + 20) × 0.85');
  assert.equal(rows.find((r) => r.id === '724').weight, base, 'untouched option = its base share');
  assert.ok(countryOptions('antarctica', crew, {}, cfg).some((o) => o.id === '032'), 'Antarctica includes gateway countries');
});

test('fixed base slice: big and small wheels start with the same total, Antarctica stays rare', () => {
  const total = (opts) => opts.reduce((a, o) => a + o.base, 0);
  const regions = regionOptions({}, cfg);
  assert.ok(Math.abs(total(regions) - cfg.weights.baseTotal) < 0.1);
  const ant = regions.find((o) => o.id === 'antarctica'), eu = regions.find((o) => o.id === 'europe');
  assert.ok(Math.abs(ant.base / eu.base - 0.4) < 0.01);
  assert.ok(Math.abs(total(monthOptions({}, cfg)) - cfg.weights.baseTotal) < 0.1);
  assert.equal(baseFor(100, cfg), cfg.weights.minBase, 'never below the minimum');
  assert.deepEqual([3, 4, 5, 6, 7, 27].map((n) => maxPicksFor(n, cfg)), [1, 1, 2, 2, 3, 3]);
});

test('month wishes count the share of your wishes that are comfy; blocked months leave the wheel', () => {
  // Thailand (764) is warm almost all year, Iceland (352) never 18–29 °C
  const both = monthOptions({ p1: ['764', '352'] }, cfg);
  const only = monthOptions({ p1: ['764'] }, cfg);
  const jan = (o) => o.find((x) => x.id === '0').wish;
  assert.equal(jan(only), cfg.weights.wishWeight);
  assert.equal(jan(both), cfg.weights.wishWeight / 2);
  const blocked = monthOptions({}, cfg, [0, 1, 11]);
  assert.equal(blocked.length, 9);
  assert.ok(!blocked.some((o) => ['0', '1', '11'].includes(o.id)));
});

test('satisfaction: couples mean, cupid weight, girls/boys groups', () => {
  const s = satisfaction({ units: [{ scores: [10, 8], weight: 1 }, { scores: [4], weight: 1 }], groups: { girls: [8, 10], boys: [6] } });
  assert.equal(s.couple, 6.5); assert.equal(s.group, 7.5); assert.equal(s.S, 7);
  const c = satisfaction({ units: [{ scores: [10, 10], weight: 2 }, { scores: [4], weight: 1 }], groups: { girls: [], boys: [] } });
  assert.equal(c.couple, 8); assert.equal(c.S, 8);
});

test('final shot: 90% at 10/10, proportional remainder, wishes, always sums to 1', () => {
  const nominations = { p1: ['300', '392', '764'], p2: ['392', '764', '620'], p3: ['300', '392', '036'] };
  const d10 = finalDistribution({ selected: '300', S: 10, nominations, wishes: {} }, cfg);
  assert.equal(d10.P, 0.9);
  const sum = d10.options.reduce((a, o) => a + o.p, 0);
  assert.ok(Math.abs(sum - 1) < 1e-12);
  assert.ok(!d10.options.slice(1).some((o) => o.id === '300'), 'selected country is not double counted');
  const jp = d10.options.find((o) => o.id === '392');
  assert.ok(Math.abs(jp.p - 0.1 * 3 / 7) < 1e-12, 'Japan has 3 of 7 other nominations');
  const d5 = finalDistribution({ selected: '300', S: 5, nominations, wishes: {} }, cfg);
  assert.equal(d5.P, 0.45);
  const dw = finalDistribution({ selected: '300', S: 10, nominations, wishes: { p9: ['036'] } }, cfg);
  assert.ok(dw.options.find((o) => o.id === '036').p > d10.options.find((o) => o.id === '036').p, 'wish boosts a nominee');
  const lone = finalDistribution({ selected: '300', S: 7, nominations: {}, wishes: {}, fallback: ['300', '620', '724'] }, cfg);
  assert.equal(lone.options.length, 3);
  assert.ok(Math.abs(lone.options.reduce((a, o) => a + o.p, 0) - 1) < 1e-12);
});

test('travel estimates: Skopje to far destinations is harder than Brussels', () => {
  const bru = travelEstimate('BRU', '392'), skp = travelEstimate('SKP', '392');
  assert.ok(skp.hours > bru.hours);
  assert.ok(travelEstimate('BRU', '620').ease > travelEstimate('BRU', '036').ease);
  const crew = crewTravel([{ id: 'a', home: 'BRU' }, { id: 'b', home: 'SKP' }], '620');
  assert.equal(crew.hardest.id, 'b');
  for (const c of COUNTRIES) assert.ok(travelEstimate('BRU', c.id).hours > 0);
});

test('flexibility counts comfortable months', () => {
  assert.equal(flexibility('764').months, 12);
  assert.equal(flexibility('352').months, 0);
  assert.ok(flexibility('300').months >= 4);
});

test('dataset integrity', () => {
  const ids = new Set();
  for (const c of COUNTRIES) {
    assert.ok(!ids.has(c.id), `duplicate ${c.id}`); ids.add(c.id);
    assert.equal(c.temp.length, 12, c.name);
    assert.ok(REGIONS.some((r) => r.members.includes(c.id)), `${c.name} has a region`);
  }
  for (const r of REGIONS) assert.ok(r.members.length >= 2, `${r.name} has at least 2 countries`);
});
