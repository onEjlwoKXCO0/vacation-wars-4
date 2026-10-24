// Bot crewmates for solo play and small groups. Bots only use the same validated actions as humans.
import { ROLES } from './data/roles.js';
import { COUNTRIES, countryById } from './data/countries.js';
import { POWERS } from './data/powers.js';
import { computeBreakdown } from './rules.js';

const pickRand = (arr, rng) => arr[Math.floor(rng() * arr.length)];

/** Returns the next action for a bot, or null. `mem` is a per-bot scratch object. */
export function botThink(room, pid, mem, ctx) {
  const p = room.players[pid];
  if (!p || !p.isBot) return null;
  if (mem.nextAt && ctx.now < mem.nextAt) return null;
  mem.nextAt = ctx.now + 1200 + ctx.rng() * 3500;
  const rng = ctx.rng;

  if (room.phase === 'lobby') {
    if (!p.role) {
      const pool = ROLES.filter((r) => r.price <= p.wallet - 300);
      return { type: 'role:choose', roleId: pickRand(pool, rng).id };
    }
    const humansBoarded = room.order.some((id) => !room.players[id].isBot && room.players[id].boarded);
    if (humansBoarded && !p.boarded) return { type: 'board' };
    return null;
  }
  const g = room.game;
  if (room.phase !== 'game' || !g || !g.participants.includes(pid)) return null;
  if (g.introUntil && ctx.now < g.introUntil) return null;
  if (mem.stageKey !== `${g.no}:${g.stage}`) { mem.stageKey = `${g.no}:${g.stage}`; mem.acts = 0; mem.bet = false; mem.power = false; mem.pickTries = 0; mem.blockTried = false; }

  if (g.stage === 'wishlist') {
    if (!g.wishes[pid] || !g.wishes[pid].length) {
      const warm = COUNTRIES.filter((c) => c.sea > 70 && c.id !== '010');
      const n = 1 + Math.floor(rng() * 3);
      const list = [];
      while (list.length < n) { const c = pickRand(warm, rng).id; if (!list.includes(c)) list.push(c); }
      return { type: 'wish:set', countryIds: list };
    }
    if (!mem.blockTried && !g.wishLocked[pid]) {
      mem.blockTried = true; // a third of bots have a month they can't do
      if (rng() < 0.33) return { type: 'months:block', months: [Math.floor(rng() * 12)] };
    }
    if (!g.wishLocked[pid]) return { type: 'wish:lock' };
    return null;
  }

  if (['month', 'region', 'country', 'final'].includes(g.stage)) {
    const d = g.decisions[g.stage];
    if (d.step !== 'strategy') return null;
    const rows = computeBreakdown(d, room.config).rows;
    if (!mem.fav || !rows.some((r) => r.id === mem.fav)) {
      // taste: warm & sea-friendly countries; regions holding their wishes
      const myWishes = g.wishes[pid] || [];
      mem.fav = rows.map((r) => {
        let s = rng() * 4;
        if (g.stage === 'region' || g.stage === 'month') s += g.decisions[g.stage].options.find((o) => o.id === r.id)?.wish ? 5 : 0;
        else if (g.stage !== 'month') { const c = countryById(r.id); if (c) s += (c.sea + c.nightlife) / 40 - Math.abs(c.temp[g.result.month !== undefined ? Number(g.result.month) : room.config.round.month] - 26) / 4 + (myWishes.includes(r.id) ? 4 : 0); }
        return { id: r.id, s };
      }).sort((a, b) => b.s - a.s)[0].id;
    }
    const mine = (d.picks && d.picks[pid]) || [];
    if (!d.fixed && mine.length < (d.maxPicks || 3) && (mem.pickTries = (mem.pickTries || 0) + 1) < 8) {
      // first pick: own favourite; then often follow what the crew already likes, sometimes a random one
      const counts = {};
      for (const [id, list] of Object.entries(d.picks || {})) if (id !== pid) for (const o of list) counts[o] = (counts[o] || 0) + 1;
      const popular = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([o]) => o).filter((o) => !mine.includes(o) && !d.vetoed[o]);
      const open = rows.map((r) => r.id).filter((o) => !mine.includes(o));
      const choice = !mine.includes(mem.fav) ? mem.fav : popular.length && rng() < 0.7 ? popular[0] : open[Math.floor(rng() * open.length)];
      if (choice) return { type: 'pick:toggle', optionId: choice };
    }
    if (!d.fixed && mem.acts < 2 && p.wallet > 250 && rng() < 0.75) { mem.acts++; return { type: 'boost', optionId: mem.fav }; }
    if (!d.fixed && !mem.power && p.wallet > 400 && rng() < 0.15) {
      mem.power = true;
      const pw = pickRand(POWERS.filter((x) => ['shield', 'golden_ticket', 'spyglass'].includes(x.id)), rng);
      return { type: 'power:buy', powerId: pw.id, targetId: mem.fav };
    }
    if (!mem.bet) {
      mem.bet = true;
      const stake = Math.min(p.wallet, 20 + Math.floor(rng() * 6) * 20);
      if (stake >= room.config.betting.minStake) {
        const pick = rng() < 0.5 ? mem.fav : rows.reduce((m, x) => (x.p > m.p ? x : m), rows[0]).id;
        return { type: 'bet:place', optionId: pick, stake };
      }
    }
    if (!d.ready[pid]) return { type: 'ready', ready: true };
    return null;
  }

  if (g.stage === 'couples' || g.stage === 'groups') {
    const t = g.tests[g.stage];
    if (!t.done[pid]) return { type: 'test:done' };
    if (!t.score[pid]) return { type: 'test:score', score: 6 + Math.floor(rng() * 5) };
    return null;
  }

  if (g.stage === 'nominate' && !g.nominationLocked[pid]) {
    const pool = [...(g.decisions.country?.options.map((o) => o.id) || []), ...(g.wishes[pid] || []), ...COUNTRIES.filter((c) => c.sea > 85).map((c) => c.id)];
    const list = [];
    while (list.length < 3) { const c = pickRand(pool, rng); if (!list.includes(c)) list.push(c); }
    return { type: 'nominate:set', countryIds: list };
  }
  return null;
}
