import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, applyAction, tick, viewFor, setConnected, canEnterUpstairs, partnerOf } from '../shared/engine.js';
import { pickWinner } from '../shared/rules.js';
import { mulberry32 } from '../shared/map.js';
import { NATIONS } from '../shared/data/nations.js';
import { RoomHost } from '../shared/host.js';

function setup({ players = 2, seed = 1 } = {}) {
  let now = 1_000_000;
  const rng = mulberry32(seed);
  const room = createRoom({ code: 'TEST', now });
  const ids = [];
  for (let i = 0; i < players; i++) {
    const id = `p${i}`;
    addPlayer(room, { id, now });
    ids.push(id);
    const nation = NATIONS[i % 4];
    const r = applyAction(room, id, { type: 'profile:set', name: `Player ${i}`, nationality: nation.id, appearance: nation.preset, visited: i === 0 ? ['300', '620'] : [], partnerVisited: i === 0 ? ['620'] : [] }, { now, rng });
    assert.ok(r.ok, r.error);
  }
  const act = (pid, a) => applyAction(room, pid, a, { now, rng });
  const ok = (pid, a) => { const r = act(pid, a); assert.ok(r.ok, `${a.type}: ${r.error}`); return r; };
  const advanceTime = (ms) => { now += ms; return tick(room, { now, rng }); };
  const skipIntro = () => advanceTime(Math.max(0, room.game.introUntil - now) + 1);
  return { room, ids, act, ok, advanceTime, skipIntro, rng, getNow: () => now };
}

/** Lobby → launched with everyone holding a role. */
function launch(t, roles = []) {
  t.ids.forEach((id, i) => t.ok(id, { type: 'role:choose', roleId: roles[i] || 'rookie' }));
  t.ok('p0', { type: 'host:launch' });
  t.skipIntro();
}

test('roles are chosen once, before launch; Rookie gets +400', () => {
  const t = setup();
  t.ok('p0', { type: 'role:choose', roleId: 'rookie' });
  assert.equal(t.room.players.p0.wallet, 1400);
  assert.equal(t.act('p0', { type: 'role:choose', roleId: 'hacker' }).ok, false, 'final choice');
  t.ok('p1', { type: 'role:choose', roleId: 'commander' });
  assert.equal(t.room.players.p1.wallet, 700);
  assert.equal(t.act('p1', { type: 'board' }).ok, true);
});

test('boarding requires a role; everyone aboard starts the auto-launch countdown', () => {
  const t = setup();
  assert.equal(t.act('p0', { type: 'board' }).ok, false);
  t.ok('p0', { type: 'role:choose', roleId: 'rookie' }); t.ok('p1', { type: 'role:choose', roleId: 'rookie' });
  t.ok('p0', { type: 'board' });
  assert.equal(t.room.launchAt, null);
  t.ok('p1', { type: 'board' });
  assert.ok(t.room.launchAt);
  t.advanceTime(t.room.config.timers.launchCountdown * 1000 + 1);
  assert.equal(t.room.phase, 'game');
  assert.equal(t.room.game.stage, 'wishlist');
});

test('partners, private upstairs access and partner-trip privacy', () => {
  const t = setup({ players: 3 }); // p0 portugal, p1 macedonia, p2 poland
  t.ok('p2', { type: 'partner:set', partnerId: 'p1' });
  assert.equal(partnerOf(t.room, 'p2'), null, 'not mutual yet');
  assert.equal(canEnterUpstairs(t.room, 'p1', 'poland'), false);
  t.ok('p1', { type: 'partner:set', partnerId: 'p2' });
  assert.equal(partnerOf(t.room, 'p2'), 'p1');
  assert.equal(canEnterUpstairs(t.room, 'p1', 'poland'), true, 'partner may go upstairs');
  assert.equal(canEnterUpstairs(t.room, 'p0', 'poland'), false, 'others may not');
  assert.equal(canEnterUpstairs(t.room, 'p2', 'poland'), true);
  const v1 = viewFor(t.room, 'p1', 0);
  assert.equal(v1.players.find((p) => p.id === 'p0').partnerVisited, null);
  assert.equal(v1.players.find((p) => p.id === 'p0').wallet, null);
});

test('wishlist: 1–5 game countries, private until locked, then region roulette', () => {
  const t = setup();
  launch(t);
  assert.equal(t.act('p0', { type: 'wish:set', countryIds: ['300', '620', '392', '764', '036', '484'] }).ok, false);
  t.ok('p0', { type: 'wish:set', countryIds: ['300', '620', 'zzz'] });
  assert.deepEqual(t.room.game.wishes.p0, ['300', '620']);
  assert.equal(viewFor(t.room, 'p1', 0).game.wishes.p0, undefined, 'wishes private during wishlist');
  assert.equal(t.act('p1', { type: 'wish:lock' }).ok, false, 'needs at least one');
  t.ok('p1', { type: 'wish:set', countryIds: ['392'] });
  // impossible months: private, removed from the Season wheel
  t.ok('p0', { type: 'months:block', months: [0, 1] });
  t.ok('p1', { type: 'months:block', months: [1] });
  assert.equal(t.act('p1', { type: 'months:block', months: [2, 3, 4, 5, 6] }).ok, false, 'at most 4 each');
  assert.deepEqual(viewFor(t.room, 'p1', 0).game.myBlocked, [1]);
  assert.equal(viewFor(t.room, 'p1', 0).game.blockedMonths, null, 'nobody sees the others while the wishlist is open');
  t.ok('p0', { type: 'wish:lock' }); t.ok('p1', { type: 'wish:lock' });
  assert.equal(t.room.game.stage, 'month', 'the season spin comes first');
  const md = t.room.game.decisions.month;
  assert.equal(md.options.length, 10, 'January and February left the wheel');
  assert.ok(!md.options.some((o) => o.id === '0' || o.id === '1'));
  assert.deepEqual(viewFor(t.room, 'p1', 0).game.blockedMonths, [0, 1], 'only the union is public, never who');
  const aug = md.options.find((o) => o.id === '7');
  const dec = md.options.find((o) => o.id === '11');
  assert.equal(aug.wish, 20, 'both players have a wish that is comfortable in August');
  assert.equal(dec.wish, 0);
  // picks are prefilled from the wishlist (comfy months), editable, within the per-wheel cap
  assert.equal(md.maxPicks, 3);
  assert.ok(md.picks.p0.length >= 1 && md.picks.p0.length <= 3);
  for (const m of md.picks.p0) assert.ok(md.options.find((o) => o.id === m).wish > 0);
  t.ok('p0', { type: 'pick:toggle', optionId: md.picks.p0[0] });
  t.skipIntro();
  for (const id of t.ids) t.ok(id, { type: 'ready', ready: true });
  t.advanceTime(t.room.config.timers.reveal * 1000 + 3000);
  assert.equal(t.room.game.decisions.month.step, 'results');
  t.ok('p0', { type: 'host:advance' });
  assert.equal(t.room.game.stage, 'region');
  assert.ok(t.room.game.result.month !== undefined);
  const eu = t.room.game.decisions.region.options.find((o) => o.id === 'europe');
  assert.equal(eu.wish, 10);
  assert.deepEqual(t.room.game.decisions.region.picks.p0, ['europe'], 'region pick prefilled from the wishes');
  assert.deepEqual(t.room.game.decisions.region.picks.p1, ['east_asia']);
});

function toRegion(t) {
  launch(t);
  for (const id of t.ids) { t.ok(id, { type: 'wish:set', countryIds: ['300'] }); t.ok(id, { type: 'wish:lock' }); }
  t.skipIntro();
  for (const id of t.ids) t.ok(id, { type: 'ready', ready: true });
  t.advanceTime(t.room.config.timers.reveal * 1000 + 3000);
  t.ok('p0', { type: 'host:advance' });
  t.skipIntro();
}

test('boosts: flat price, per-player and per-option caps, refundable while open', () => {
  const t = setup({ players: 4 });
  toRegion(t);
  const w0 = t.room.players.p0.wallet;
  t.ok('p0', { type: 'boost', optionId: 'oceania' });
  assert.equal(t.room.players.p0.wallet, w0 - 50);
  t.ok('p0', { type: 'boost', optionId: 'oceania', count: -1 });
  assert.equal(t.room.players.p0.wallet, w0);
  for (let i = 0; i < 5; i++) t.ok('p0', { type: 'boost', optionId: 'oceania' });
  assert.equal(t.act('p0', { type: 'boost', optionId: 'africa' }).ok, false, 'per-player cap 5');
  for (let i = 0; i < 5; i++) t.ok('p1', { type: 'boost', optionId: 'oceania' });
  for (let i = 0; i < 5; i++) t.ok('p2', { type: 'boost', optionId: 'oceania' });
  assert.equal(t.act('p3', { type: 'boost', optionId: 'oceania' }).ok, false, 'per-option cap 15');
});

test('powers: shield blocks veto and sabotage, veto refunds, min two options', () => {
  const t = setup({ players: 2 });
  toRegion(t);
  t.ok('p0', { type: 'boost', optionId: 'africa' });
  t.ok('p0', { type: 'bet:place', optionId: 'africa', stake: 100 });
  const before = t.room.players.p0.wallet;
  t.ok('p1', { type: 'power:buy', powerId: 'shield', targetId: 'oceania' });
  assert.equal(t.act('p1', { type: 'power:buy', powerId: 'veto', targetId: 'oceania' }).ok, false, 'shielded');
  t.ok('p1', { type: 'power:buy', powerId: 'veto', targetId: 'africa' });
  assert.equal(t.room.players.p0.wallet, before + 150, 'boost + bet on vetoed option refunded');
  assert.equal(t.room.game.decisions.region.bets.p0, undefined);
  assert.equal(t.act('p0', { type: 'boost', optionId: 'africa' }).ok, false, 'vetoed option is gone');
  t.ok('p0', { type: 'boost', optionId: 'europe' }); t.ok('p0', { type: 'boost', optionId: 'europe' });
  t.ok('p1', { type: 'power:buy', powerId: 'sabotage', targetId: 'europe' });
  const v = viewFor(t.room, 'p0', 0).game.decisions.region;
  assert.equal(v.rows.find((r) => r.id === 'europe').boosts, 0);
  // veto down to two options
  const d = t.room.game.decisions.region;
  const left = () => d.options.filter((o) => !d.vetoed[o.id]);
  t.room.players.p1.wallet = 100000;
  while (left().length > 2) { const target = left().find((o) => !d.shields[o.id]); t.ok('p1', { type: 'power:buy', powerId: 'veto', targetId: target.id }); }
  const lastUnshielded = left().find((o) => !d.shields[o.id]);
  assert.equal(t.act('p1', { type: 'power:buy', powerId: 'veto', targetId: lastUnshielded?.id || left()[0].id }).ok, false);
});

test('roles: commander doubles, diplomat veto once per game, thief vs bodyguard, merchant half price', () => {
  const t = setup({ players: 4 });
  toRegion(t);
  t.room.players.p0.role = 'commander'; t.room.players.p1.role = 'diplomat'; t.room.players.p2.role = 'thief'; t.room.players.p3.role = 'bodyguard';
  t.ok('p0', { type: 'boost', optionId: 'europe' });
  t.ok('p0', { type: 'role:use', targetId: 'europe' });
  assert.equal(t.act('p0', { type: 'role:use', targetId: 'africa' }).ok, false, 'once per decision');
  assert.equal(viewFor(t.room, 'p0', 0).game.decisions.region.rows.find((r) => r.id === 'europe').boostWeight, 50);
  t.ok('p1', { type: 'role:use', targetId: 'antarctica' });
  assert.equal(t.act('p1', { type: 'role:use', targetId: 'oceania' }).ok, false, 'once per game');
  const w3 = t.room.players.p3.wallet;
  t.ok('p2', { type: 'role:use', targetId: 'p3' });
  assert.equal(t.room.players.p3.wallet, w3, 'bodyguard immune');
  assert.equal(t.act('p2', { type: 'role:use', targetId: 'p0' }).ok, false, 'theft used');
  t.room.players.p1.role = 'merchant';
  const w1 = t.room.players.p1.wallet;
  t.ok('p1', { type: 'power:buy', powerId: 'spyglass' });
  assert.equal(w1 - t.room.players.p1.wallet, 40);
});

test('secret bets: hidden from others, visible to hacker and spyglass; payouts at frozen odds', () => {
  const t = setup({ players: 3 });
  toRegion(t);
  t.room.players.p2.role = 'hacker';
  t.ok('p0', { type: 'bet:place', optionId: 'europe', stake: 200 });
  assert.equal(viewFor(t.room, 'p1', 0).game.decisions.region.bets, null);
  assert.equal(viewFor(t.room, 'p2', 0).game.decisions.region.bets.p0.stake, 200, 'hacker sees');
  t.ok('p1', { type: 'power:buy', powerId: 'spyglass' });
  assert.equal(viewFor(t.room, 'p1', 0).game.decisions.region.bets.p0.stake, 200, 'spyglass sees');
  for (const id of t.ids) t.ok(id, { type: 'ready', ready: true });
  const d = t.room.game.decisions.region;
  assert.equal(d.step, 'reveal');
  assert.equal(pickWinner(d.frozen.rows, d.draws[0].u), d.draws[0].winner);
  assert.equal(d.bets.p0.multiplier, d.multipliers.europe);
  assert.equal(t.act('p0', { type: 'host:advance' }).ok, false, 'reveal not skippable');
  t.advanceTime(20000);
  assert.equal(d.step, 'results');
  const before = t.room.players.p0.wallet;
  t.advanceTime(t.room.config.timers.results * 1000 + 1);
  const s = d.settlements.p0;
  assert.equal(t.room.players.p0.wallet, before + (s.won ? s.payout : 0));
  assert.equal(t.room.game.stage, 'country');
  assert.ok(t.room.game.decisions.country.options.length >= 2);
});

test('time loop: one re-spin per decision, during results only, same odds', () => {
  const t = setup({ players: 2, seed: 9 });
  toRegion(t);
  t.room.players.p1.role = 'chaos';
  assert.equal(t.act('p1', { type: 'role:use' }).ok, false, 'not during strategy');
  for (const id of t.ids) t.ok(id, { type: 'ready', ready: true });
  t.advanceTime(20000);
  const d = t.room.game.decisions.region;
  t.ok('p1', { type: 'role:use' });
  assert.equal(d.draws.length, 2);
  assert.equal(d.step, 'reveal');
  t.advanceTime(20000);
  t.room.players.p0.wallet = 5000;
  assert.equal(t.act('p0', { type: 'power:buy', powerId: 'time_loop' }).ok, false, 'only one re-spin');
  assert.equal(pickWinner(d.frozen.rows, d.draws[1].u), d.draws[1].winner);
});

function playDecision(t) {
  for (const id of t.ids) t.ok(id, { type: 'ready', ready: true });
  t.advanceTime(20000);
  t.advanceTime(t.room.config.timers.results * 1000 + 1);
}

test('full game: month → region → country → pharaoh → couples → groups → final → market → restart', () => {
  const t = setup({ players: 4, seed: 4 }); // portugal, macedonia, poland, morocco
  t.ok('p2', { type: 'partner:set', partnerId: 'p1' }); t.ok('p1', { type: 'partner:set', partnerId: 'p2' });
  t.ok('p0', { type: 'partner:set', partnerId: 'p3' }); t.ok('p3', { type: 'partner:set', partnerId: 'p0' });
  t.room.players.p1.group = 'girls'; t.room.players.p0.group = 'girls';
  toRegion(t);
  playDecision(t);
  assert.equal(t.room.game.stage, 'country');
  t.skipIntro();
  playDecision(t);
  assert.equal(t.room.game.stage, 'pharaoh');
  assert.ok(t.room.game.result.country);
  t.advanceTime(t.room.config.timers.pharaoh * 1000 + 1);
  assert.equal(t.room.game.stage, 'couples');
  const couple = { p0: 10, p3: 10, p1: 10, p2: 10 };
  for (const id of t.ids) t.ok(id, { type: 'test:score', score: couple[id] }); // scoring directly marks the call as done
  assert.equal(t.room.game.stage, 'groups');
  assert.equal(viewFor(t.room, 'p1', 0).game.couplesAverage, 10, 'the couples result is shown once the couples are done');
  assert.equal(t.act('p0', { type: 'test:score', score: 11 }).ok, false);
  for (const id of t.ids) { t.ok(id, { type: 'test:done' }); t.ok(id, { type: 'test:score', score: 10 }); }
  assert.equal(t.room.game.stage, 'final', 'no nomination step any more: straight to the final shot');
  assert.equal(t.room.game.satisfaction.S, 10);
  const f = t.room.game.decisions.final;
  assert.equal(f.options[0].id, t.room.game.result.country);
  assert.ok(Math.abs(f.options[0].p - 0.9) < 1e-12, '10/10 → 90%');
  if (t.room.game.result.country !== '300') assert.deepEqual(f.options.slice(1).map((o) => o.id), ['300'], 'the crew\'s wishlist country fights the chosen one');
  assert.ok(Math.abs(f.options.reduce((a, o) => a + o.p, 0) - 1) < 1e-12);
  assert.equal(t.act('p0', { type: 'boost', optionId: f.options[0].id }).ok, false, 'no boosts in the final');
  t.skipIntro();
  playDecision(t);
  assert.equal(t.room.game.stage, 'exit');
  assert.ok(t.room.game.result.final);
  t.advanceTime(t.room.config.timers.exitCinematic * 1000 + 1);
  assert.equal(t.room.phase, 'market');
  // market: pools, gifts, requests
  const m = t.room.market;
  const total = Object.values(t.room.players).reduce((a, p) => a + p.wallet, 0);
  assert.equal(viewFor(t.room, 'p0', 0).market.restartPrice, total, 'restart costs every coin the crew owns');
  t.ok('p0', { type: 'market:open', itemId: 'dj', amount: 50 });
  const pool = m.pools[0];
  t.ok('p1', { type: 'market:fund', poolId: pool.id, amount: 500 });
  assert.equal(pool.done, true);
  assert.equal(m.purchases[0].owner, 'p0', 'privilege belongs to the pool owner');
  assert.equal(t.act('p2', { type: 'market:open', itemId: 'dj' }).ok, false, 'sold out');
  const w2 = t.room.players.p2.wallet;
  t.ok('p3', { type: 'market:give', toId: 'p2', amount: 30, note: 'for the DJ' });
  assert.equal(t.room.players.p2.wallet, w2 + 30);
  t.ok('p2', { type: 'market:request', toId: 'p1', amount: 20 });
  t.ok('p1', { type: 'market:answer', requestId: m.requests[0].id, accept: true });
  assert.equal(t.act('p1', { type: 'market:give', toId: 'p2', amount: 10 ** 9 }).ok, false, 'no overdraft');
  for (const p of Object.values(t.room.players)) assert.ok(p.wallet >= 0);
  // restart: the crew pools everything
  t.ok('p0', { type: 'market:open', itemId: 'restart' });
  const rp = m.pools.find((x) => x.itemId === 'restart');
  for (const id of t.ids) { const w = t.room.players[id].wallet; if (w > 0 && !rp.done) t.ok(id, { type: 'market:fund', poolId: rp.id, amount: w }); }
  assert.ok(rp.done === true || t.room.phase === 'lobby');
  assert.equal(t.room.phase, 'lobby', 'restart bought → new game');
  assert.equal(t.room.players.p0.role, null);
  assert.equal(t.room.players.p0.wallet, 1000);
});

test('satisfaction below 10 lowers the chosen country share', () => {
  const t = setup({ players: 2, seed: 2 });
  toRegion(t); playDecision(t); t.skipIntro(); playDecision(t);
  t.advanceTime(t.room.config.timers.pharaoh * 1000 + 1);
  for (const id of t.ids) t.ok(id, { type: 'test:score', score: 5 });
  for (const id of t.ids) t.ok(id, { type: 'test:score', score: 5 });
  const f = t.room.game.decisions.final;
  assert.ok(Math.abs(f.options[0].p - 0.45) < 1e-12);
  assert.ok(f.options.length > 1, 'the rest goes to wishlist countries (or the region when nothing else was wished)');
});

test('fuzz: wallets never negative and ledgers reconcile across random games', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const t = setup({ players: 4, seed });
    const roles = ['rookie', 'commander', 'hacker', 'bookmaker', 'diplomat', 'saboteur', 'bodyguard', 'merchant', 'chaos', 'thief', 'cupid'];
    t.ids.forEach((id) => t.act(id, { type: 'role:choose', roleId: roles[Math.floor(t.rng() * roles.length)] }));
    t.ok('p0', { type: 'host:launch' }); t.skipIntro();
    t.advanceTime(10 * 60 * 1000); // wishlist times out
    for (let stage = 0; stage < 2; stage++) {
      t.skipIntro();
      const d = t.room.game.decisions[t.room.game.stage];
      for (let k = 0; k < 60; k++) {
        const id = t.ids[Math.floor(t.rng() * 4)];
        const opt = d.options[Math.floor(t.rng() * d.options.length)].id;
        const r = t.rng();
        if (r < 0.35) t.act(id, { type: 'boost', optionId: opt });
        else if (r < 0.5) t.act(id, { type: 'bet:place', optionId: opt, stake: 10 + Math.floor(t.rng() * 400) });
        else if (r < 0.7) t.act(id, { type: 'power:buy', powerId: ['veto', 'shield', 'sabotage', 'golden_ticket', 'spyglass', 'double_down', 'insurance'][Math.floor(t.rng() * 7)], targetId: opt });
        else if (r < 0.8) t.act(id, { type: 'role:use', targetId: t.rng() < 0.5 ? opt : t.ids[Math.floor(t.rng() * 4)] });
        else t.act(id, { type: 'pick:toggle', optionId: opt });
      }
      t.advanceTime(20 * 60 * 1000); // lock
      t.advanceTime(20000); // reveal
      if (t.rng() < 0.5) for (const id of t.ids) t.act(id, { type: 'role:use' });
      t.advanceTime(20000);
      t.advanceTime(60000);
      const bd = d.frozen.rows;
      assert.ok(Math.abs(bd.reduce((a, r) => a + r.p, 0) - 1) < 1e-9);
      assert.ok(bd.length >= 2);
    }
    for (const p of Object.values(t.room.players)) {
      assert.ok(Number.isInteger(p.wallet) && p.wallet >= 0, `wallet ${p.wallet}`);
      assert.equal(p.ledger.reduce((s, l) => s + l.delta, 0), p.wallet, 'ledger reconciles');
    }
  }
});

test('RoomHost: bots play an entire game to the market; reconnection keeps the player', () => {
  let now = 5_000_000;
  const host = new RoomHost({ code: 'HOST', rng: mulberry32(3), now: () => now });
  const inbox = [];
  host.join('h1', (m) => inbox.push(m));
  host.handle('h1', { t: 'act', id: 1, a: { type: 'profile:set', name: 'Gauthier', nationality: 'poland', appearance: NATIONS[2].preset, visited: [] } });
  for (let i = 0; i < 3; i++) host.handle('h1', { t: 'act', id: 2 + i, a: { type: 'host:addBot' } });
  host.leave('h1'); host.join('h1', (m) => inbox.push(m));
  assert.equal(host.room.order.length, 4);
  const bot = host.room.order.find((id) => host.room.players[id].nationality === 'macedonia');
  host.handle('h1', { t: 'act', id: 9, a: { type: 'partner:set', partnerId: bot } });
  assert.equal(partnerOf(host.room, 'h1'), bot, 'bot accepts the proposal');
  host.handle('h1', { t: 'act', id: 10, a: { type: 'role:choose', roleId: 'rookie' } });
  host.handle('h1', { t: 'act', id: 11, a: { type: 'host:launch' } });
  const me = (a) => host.handle('h1', { t: 'act', id: 99, a });
  for (let i = 0; i < 20000 && host.room.phase === 'game'; i++) {
    now += 250;
    host.step(0.25);
    const g = host.room.game;
    if (!g || now < g.introUntil) continue;
    if (g.stage === 'wishlist' && !g.wishLocked.h1) { me({ type: 'wish:set', countryIds: ['300'] }); me({ type: 'wish:lock' }); }
    if (['month', 'region', 'country', 'final'].includes(g.stage) && g.decisions[g.stage].step === 'strategy' && !g.decisions[g.stage].ready.h1) me({ type: 'ready', ready: true });
    if (['couples', 'groups'].includes(g.stage) && !g.tests[g.stage].score.h1) { me({ type: 'test:done' }); me({ type: 'test:score', score: 8 }); }
    if (g.stage === 'nominate' && !g.nominationLocked.h1) me({ type: 'nominate:set', countryIds: ['300', '620', '392'] });
  }
  assert.equal(host.room.phase, 'market');
  assert.ok(host.room.market.destination);
  assert.equal(inbox.filter((m) => m.t === 'state').at(-1).s.you, 'h1');
});

test('moon NPC deals: France promise pre-fills the wishlist, VIP pact, premonition is stable per game', () => {
  const t = setup();
  t.ok('p0', { type: 'npc:deal', deal: 'france', accept: true });
  t.ok('p1', { type: 'npc:deal', deal: 'vip', accept: true });
  t.ok('p1', { type: 'npc:deal', deal: 'premonition' });
  const first = t.room.players.p1.flags.premonition.countryId;
  t.ok('p1', { type: 'npc:deal', deal: 'premonition' });
  assert.equal(t.room.players.p1.flags.premonition.countryId, first);
  assert.equal(viewFor(t.room, 'p0', 0).players.find((p) => p.id === 'p1').premonition, null, 'premonitions private until the market');
  assert.equal(viewFor(t.room, 'p0', 0).players.find((p) => p.id === 'p1').vip, true);
  launch(t);
  assert.deepEqual(t.room.game.wishes.p0, ['250']);
});
