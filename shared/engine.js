// VW4 authoritative game engine — the whole game flow as one state machine.
//
//   lobby  ──launch──▶  game: wishlist → month → region → country → pharaoh → couples → groups → final → exit
//   (the old 'nominate' stage is kept only so saved games from before can finish; the final shot now uses the wishlists)
//          ◀─restart──  market (Baby Mahmoud's Black Market)  ──close──▶  ended
//
// Pure: (room, playerId, action, ctx) → mutate room + return events. ctx = { now, rng }.
// The same code runs on the Node server (multiplayer) and in the browser (solo demo).

import { DEFAULT_CONFIG, mergeConfig } from './config.js';
import { roleById } from './data/roles.js';
import { powerById } from './data/powers.js';
import { MARKET_ITEMS, marketItemById } from './data/market.js';
import { countryById } from './data/countries.js';
import { regionById, REGIONS } from './data/regions.js';
import { MAHMOUD_LINES, PHARAOH_LINES } from './data/dialogue.js';
import { NATIONS, nationById, validateAppearance, APPEARANCE, defaultGroup, COUPLE_NATIONS } from './data/nations.js';
import { DEPARTURE_IDS } from './data/departures.js';
import { arcadeStart, arcadeAnswer, arcadeFlip, arcadeQuit, arcadeView } from './arcade.js';
import { UN_IDS } from './data/un.js';
import { WORLD_COUNTRIES } from './data/world.js';
import {
  monthOptions, regionOptions, countryOptions, maxPicksFor, comfyShare, computeBreakdown, pickWinner, displayPercents, betMultiplier, settleBet,
  boostsOn, playerBoosts, picksOn, satisfaction, finalDistribution, ALL_COUNTRY_IDS,
} from './rules.js';

const WORLD_IDS = UN_IDS; // visited lists use the 193 UN member states
const GAME_COUNTRY_IDS = new Set(ALL_COUNTRY_IDS);
const LEDGER_MAX = 300;
export const DECISION_STAGES = ['month', 'region', 'country', 'final'];

export class GameError extends Error {}

// ───────────────────────────── room & players ─────────────────────────────

export function createRoom({ code, now, config }) {
  return {
    code, createdAt: now, hostId: null, hostAwaySince: null,
    config: mergeConfig(DEFAULT_CONFIG, config),
    phase: 'lobby', players: {}, order: [],
    launchAt: null, game: null, market: null, gameNo: 0,
    history: [], speech: [], speechSeq: 0, lastSaidAt: {}, version: 0,
  };
}

export function addPlayer(room, { id, isBot = false, now }) {
  if (room.players[id]) return room.players[id];
  if (room.order.length >= room.config.maxPlayers) throw new GameError('This crew is full.');
  const p = {
    id, isBot, name: '', nationality: null, appearance: null, visited: [], partnerVisited: [], sharePartner: false,
    home: '056', group: 'boys', partnerId: null,
    role: null, wallet: room.config.startingVC, ledger: [], onboarded: false, connected: true, boarded: false,
    flags: { embassyVisited: false }, usedGame: {}, joinedAt: now, lastSeen: now,
  };
  room.players[id] = p;
  room.order.push(id);
  ledger(p, now, room.config.startingVC, 'Starting Vacation Coins');
  if (!room.hostId && !isBot) room.hostId = id;
  bump(room);
  return p;
}

export function setConnected(room, pid, connected, now) {
  const p = room.players[pid];
  if (!p) return;
  p.connected = connected;
  p.lastSeen = now;
  if (pid === room.hostId) room.hostAwaySince = connected ? null : now;
  bump(room);
}

const bump = (room) => { room.version++; };

/**
 * A saved crew comes back after a server restart: everyone is shown as reconnecting, and every running
 * timer is pushed forward by the downtime, so the game resumes exactly where it stopped (like a pause).
 */
export function resumeAfterRestart(room, now, downtimeMs) {
  const shift = Math.max(0, downtimeMs || 0);
  for (const p of Object.values(room.players)) if (!p.isBot) { p.connected = false; p.lastSeen = now; }
  if (room.hostId && room.players[room.hostId] && !room.players[room.hostId].isBot) room.hostAwaySince = now;
  if (room.launchAt) room.launchAt += shift;
  const g = room.game;
  if (g) {
    if (g.introUntil) g.introUntil += shift;
    if (g.stageEndsAt) g.stageEndsAt += shift;
    const d = g.decisions && g.decisions[g.stage];
    if (d && d.revealStartAt) d.revealStartAt += shift;
  }
  bump(room);
}
function ledger(p, now, delta, reason) { p.ledger.push({ at: now, delta, reason, balance: p.wallet }); if (p.ledger.length > LEDGER_MAX) p.ledger.shift(); }
function debit(p, amount, reason, now) {
  if (!Number.isInteger(amount) || amount < 0) throw new GameError('Invalid amount.');
  if (amount > p.wallet) throw new GameError(`Not enough VC — you have ${p.wallet}, this costs ${amount}.`);
  p.wallet -= amount; ledger(p, now, -amount, reason);
}
function credit(p, amount, reason, now) {
  if (!Number.isInteger(amount) || amount < 0) throw new GameError('Invalid amount.');
  if (amount === 0) return;
  p.wallet += amount; ledger(p, now, amount, reason);
}
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));

/** Mahmoud (or the Pharaoh) speaks. Lines live in state so late joiners and reconnects see them. */
function say(room, ctx, key, vars = {}, { throttleMs = 0, who = 'mahmoud', text = null } = {}) {
  if (throttleMs && room.lastSaidAt[key] && ctx.now - room.lastSaidAt[key] < throttleMs) return;
  room.lastSaidAt[key] = ctx.now;
  let line = text;
  if (!line) {
    const lines = MAHMOUD_LINES[key];
    if (!lines) return;
    line = lines[Math.floor(ctx.rng() * lines.length)];
  }
  room.speech.push({ id: ++room.speechSeq, text: fill(line, vars), at: ctx.now, key, who });
  if (room.speech.length > 10) room.speech.shift();
}

const isHost = (room, pid) => room.hostId === pid;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const optName = (kind, id) => (kind === 'month' ? MONTH_NAMES[Number(id)] : kind === 'region' ? regionById(id)?.name : countryById(id)?.name) || id;
const active = (room, pid) => { const p = room.players[pid]; return p && (p.connected || p.isBot); };
const activeParticipants = (room) => room.game.participants.filter((id) => active(room, id));
const roleAbility = (p) => roleById(p.role)?.ability || null;
const priceFor = (p, price) => (roleAbility(p)?.kind === 'halfPrice' ? Math.ceil(price / 2) : price);

/** Mutual partner, or null. */
export function partnerOf(room, pid) {
  const p = room.players[pid];
  if (!p || !p.partnerId) return null;
  const q = room.players[p.partnerId];
  return q && q.partnerId === pid ? q.id : null;
}

/** Can this player enter the private upstairs of an embassy? Its nation, and that nation's partner. */
export function canEnterUpstairs(room, pid, nation) {
  const p = room.players[pid];
  if (!p) return false;
  if (p.nationality === nation) return true;
  const partner = partnerOf(room, pid);
  return !!(partner && room.players[partner].nationality === nation);
}

// ───────────────────────────── actions ─────────────────────────────

const HANDLERS = {
  // ── profile & lobby ──
  'profile:set'(room, pid, a, ctx) {
    const p = room.players[pid];
    const name = String(a.name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 18);
    if (!name) throw new GameError('Choose a display name.');
    if (!nationById(a.nationality)) throw new GameError('Choose your nationality.');
    const appearance = validateAppearance(a.appearance);
    if (!appearance) throw new GameError('Invalid appearance.');
    const visited = uniqueValid(a.visited);
    const partnerVisited = uniqueValid(a.partnerVisited).filter((id) => visited.includes(id));
    const home = DEPARTURE_IDS.has(a.home) ? a.home : nationById(a.nationality).home;
    const group = ['girls', 'boys'].includes(a.group) ? a.group : defaultGroup(appearance.presentation);
    const first = !p.onboarded;
    Object.assign(p, { name, nationality: a.nationality, appearance, visited, partnerVisited, sharePartner: !!a.sharePartner, home, group, onboarded: true });
    if (a.partnerId !== undefined) setPartner(room, pid, a.partnerId);
    if (first) say(room, ctx, 'welcome', { name });
    return [];
  },

  'partner:set'(room, pid, a) { setPartner(room, pid, a.partnerId); return []; },

  /** Moon NPC deals: Alice & Nico's France promise, Imane's VIP pact, Plami's bracelet, Moumanou's premonition. */
  'npc:deal'(room, pid, a, ctx) {
    const p = room.players[pid];
    requireOnboarded(p);
    const accept = a.accept !== false;
    if (a.deal === 'france') { p.flags.francePromise = accept; return []; }
    if (a.deal === 'vip') {
      if (!accept) { p.flags.vip = false; return []; }
      if (!p.flags.vip) { p.flags.vip = true; say(room, ctx, null, {}, { text: `${p.name} accepted Cléopâtre's VIP pass… and now owes her 3 days of obedience. Bold.` }); }
      return [];
    }
    if (a.deal === 'bracelet') { p.flags.bracelet = true; return []; }
    if (a.deal === 'premonition') {
      const gameNo = room.phase === 'lobby' ? room.gameNo + 1 : room.gameNo;
      if (!p.flags.premonition || p.flags.premonition.game !== gameNo) {
        const ids = [...GAME_COUNTRY_IDS].filter((id) => id !== '010');
        p.flags.premonition = { game: gameNo, countryId: ids[Math.floor(ctx.rng() * ids.length)] };
      }
      return [];
    }
    throw new GameError('Unknown deal.');
  },

  // ── Moon Arcade (Control Tower) ──
  'arcade:start'(room, pid, a, ctx) { const p = room.players[pid]; requireOnboarded(p); arcadeCall(() => arcadeStart(room, p, a, ctx.rng, ctx.now)); return []; },
  'arcade:answer'(room, pid, a, ctx) { const p = room.players[pid]; const s = arcadeCall(() => arcadeAnswer(room, p, a, ctx.now, credit, debit)); return s.done ? [{ type: 'fx', kind: 'arcade', to: pid, delta: s.result.delta }] : []; },
  'arcade:flip'(room, pid, a, ctx) { const p = room.players[pid]; const s = arcadeCall(() => arcadeFlip(room, p, a, ctx.now, credit, debit)); return s.done ? [{ type: 'fx', kind: 'arcade', to: pid, delta: s.result.delta }] : []; },
  'arcade:quit'(room, pid, a, ctx) { const p = room.players[pid]; arcadeCall(() => arcadeQuit(room, p, ctx.now, credit, debit)); return []; },

  'visit:embassy'(room, pid, a) {
    const p = room.players[pid];
    if (!nationById(a.nation)) throw new GameError('Unknown embassy.');
    if (a.nation === p.nationality || p.nationality === 'other') p.flags.embassyVisited = true;
    return [];
  },

  'role:choose'(room, pid, a, ctx) {
    const p = room.players[pid];
    requireOnboarded(p);
    if (room.phase !== 'lobby') throw new GameError('Roles are chosen before launch — the market is closed now.');
    if (p.role) throw new GameError(`You are already a ${roleById(p.role).name}. A role is for the whole game.`);
    const role = roleById(a.roleId);
    if (!role) throw new GameError('Unknown role.');
    if (role.price > 0) debit(p, role.price, `Role: ${role.name}`, ctx.now);
    p.role = role.id;
    if (role.ability?.kind === 'bonusCash') credit(p, role.ability.amount, 'Rookie bonus', ctx.now);
    say(room, ctx, role.id === 'rookie' ? 'roleRookie' : 'roleBought', { name: p.name, role: role.name });
    checkAutoLaunch(room, ctx);
    return [{ type: 'fx', kind: 'role', pid, roleId: role.id }];
  },

  board(room, pid, a, ctx) {
    const p = room.players[pid];
    requireOnboarded(p);
    if (room.phase !== 'lobby') throw new GameError('The spacecraft has already left.');
    if (!p.role) throw new GameError('Choose your role at the Role Market before boarding.');
    if (!p.boarded) { p.boarded = true; say(room, ctx, 'boarded', { name: p.name }, { throttleMs: 4000 }); }
    checkAutoLaunch(room, ctx);
    return [];
  },

  unboard(room, pid) {
    if (room.phase !== 'lobby') throw new GameError('You cannot leave mid-flight.');
    room.players[pid].boarded = false;
    room.launchAt = null;
    return [];
  },

  // ── wishlist ──
  'wish:set'(room, pid, a) {
    const g = requireStage(room, 'wishlist');
    requireParticipant(g, pid);
    if (g.wishLocked[pid]) throw new GameError('Your wishes are locked.');
    const list = [...new Set((a.countryIds || []).filter((id) => GAME_COUNTRY_IDS.has(id)))];
    if (list.length > room.config.wishlist.max) throw new GameError(`At most ${room.config.wishlist.max} wishes.`);
    g.wishes[pid] = list;
    return [];
  },

  // Months this player can't travel (exams, work, a wedding…). Private: the wheel just loses them.
  'months:block'(room, pid, a) {
    const g = requireStage(room, 'wishlist');
    requireParticipant(g, pid);
    if (g.wishLocked[pid]) throw new GameError('Your wishlist is locked.');
    const max = room.config.wishlist.maxBlocked ?? 4;
    const list = [...new Set((a.months || []).filter((m) => Number.isInteger(m) && m >= 0 && m < 12))].sort((x, y) => x - y);
    if (list.length > max) throw new GameError(`You can block at most ${max} months.`);
    g.blocked ||= {};
    const others = new Set(Object.entries(g.blocked).filter(([id]) => id !== pid).flatMap(([, l]) => l));
    const union = new Set([...others, ...list]);
    if (union.size > 12 - 3) throw new GameError('The crew has already blocked almost every month — at least 3 must stay on the wheel.');
    g.blocked[pid] = list;
    return [];
  },

  'wish:lock'(room, pid, a, ctx) {
    const g = requireStage(room, 'wishlist');
    requireParticipant(g, pid);
    if ((g.wishes[pid] || []).length < room.config.wishlist.min) throw new GameError(`Pick at least ${room.config.wishlist.min} country.`);
    g.wishLocked[pid] = true;
    if (activeParticipants(room).every((id) => g.wishLocked[id])) return startDecision(room, ctx, 'month');
    return [];
  },

  // ── decisions (region / country / final) ──
  boost(room, pid, a, ctx) {
    const d = requireStrategy(room, pid);
    if (d.fixed) throw new GameError('The Pharaoh forbids chips in the final shot.');
    const cfg = room.config.boosts;
    const opt = requireOption(d, a.optionId);
    const n = a.count === -1 ? -1 : 1;
    const p = room.players[pid];
    const mine = (d.boosts[pid] || {})[opt.id] || 0;
    if (n === -1) {
      if (!mine) throw new GameError('You have no chip there to remove.');
      d.boosts[pid][opt.id] = mine - 1;
      credit(p, cfg.price, `Chip taken back from ${optName(d.kind, opt.id)}`, ctx.now);
      return [];
    }
    if (playerBoosts(d, pid) >= cfg.perPlayer) throw new GameError(`You have used all ${cfg.perPlayer} of your chips for this decision.`);
    if (boostsOn(d, opt.id) >= cfg.perOption) throw new GameError(`${optName(d.kind, opt.id)} is full (${cfg.perOption} chips max).`);
    debit(p, cfg.price, `Chip on ${optName(d.kind, opt.id)}`, ctx.now);
    d.boosts[pid] ||= {};
    d.boosts[pid][opt.id] = mine + 1;
    say(room, ctx, 'boost', { option: optName(d.kind, opt.id) }, { throttleMs: 9000 });
    return [{ type: 'fx', kind: 'boost', optionId: opt.id }];
  },

  // Up to 3 free picks per player and decision. Small alone; huge when the crew agrees.
  'pick:toggle'(room, pid, a) {
    const d = requireStrategy(room, pid);
    if (d.fixed) throw new GameError('No picks on the final shot.');
    requireOption(d, a.optionId);
    if (d.vetoed[a.optionId]) throw new GameError('That option is off the wheel.');
    const list = d.picks[pid] || (d.picks[pid] = []);
    const i = list.indexOf(a.optionId);
    if (i >= 0) { list.splice(i, 1); return []; }
    const max = d.maxPicks || room.config.weights.maxPicks;
    if (list.length >= max) throw new GameError(max === 1 ? 'You have 1 pick on this wheel — remove it first to move it.' : `You already used your ${max} picks — remove one first.`);
    list.push(a.optionId);
    return [{ type: 'fx', kind: 'pick', optionId: a.optionId }];
  },

  'bet:place'(room, pid, a, ctx) {
    const d = requireStrategy(room, pid);
    const cfg = room.config.betting;
    const opt = requireOption(d, a.optionId);
    const stake = a.stake;
    if (!Number.isInteger(stake) || stake < cfg.minStake || stake > cfg.maxStake) throw new GameError(`Stake must be between ${cfg.minStake} and ${cfg.maxStake} VC.`);
    const p = room.players[pid];
    const old = d.bets[pid];
    const oldStake = old ? old.stake : 0;
    if (stake - oldStake > p.wallet) throw new GameError(`Not enough VC for that stake (you have ${p.wallet + oldStake} including your current bet).`);
    if (oldStake) credit(p, oldStake, 'Bet moved — previous stake returned', ctx.now);
    debit(p, stake, `Bet on ${optName(d.kind, opt.id)}`, ctx.now);
    d.bets[pid] = { optionId: opt.id, stake, at: ctx.now };
    return [];
  },

  'bet:cancel'(room, pid, a, ctx) {
    const d = requireStrategy(room, pid);
    const old = d.bets[pid];
    if (old) { credit(room.players[pid], old.stake, 'Bet cancelled — stake returned', ctx.now); delete d.bets[pid]; }
    return [];
  },

  ready(room, pid, a, ctx) {
    const d = requireStrategy(room, pid);
    if (a.ready) d.ready[pid] = true; else delete d.ready[pid];
    if (activeParticipants(room).every((id) => d.ready[id])) return lockDecision(room, ctx);
    return [];
  },

  /** Black Market power — bought and used immediately. */
  'power:buy'(room, pid, a, ctx) {
    const g = room.game;
    const pw = powerById(a.powerId);
    if (!pw) throw new GameError('Unknown power.');
    const d = g && DECISION_STAGES.includes(g.stage) ? g.decisions[g.stage] : null;
    if (!d) throw new GameError('Powers can only be used during a decision.');
    requireParticipant(g, pid);
    if (d.fixed) throw new GameError('The Pharaoh forbids Black Market powers in the final shot.');
    if (pw.window === 'strategy' && (d.step !== 'strategy' || ctx.now < g.introUntil)) throw new GameError(`${pw.name} can only be used while the decision is open.`);
    if (pw.window === 'results' && d.step !== 'results') throw new GameError(`${pw.name} can only be used right after a result.`);
    const p = room.players[pid];
    const price = priceFor(p, pw.price);
    if (price > p.wallet) throw new GameError(`Not enough VC — ${pw.name} costs ${price}.`);
    const events = applyPower(room, ctx, d, pid, pw.id, a.targetId, `${pw.icon} ${pw.name}`);
    debit(p, price, `Black Market: ${pw.name}`, ctx.now);
    return events;
  },

  /** Role ability. */
  'role:use'(room, pid, a, ctx) {
    const g = room.game;
    if (!g) throw new GameError('No game in progress.');
    requireParticipant(g, pid);
    const p = room.players[pid];
    const ab = roleAbility(p);
    const role = roleById(p.role);
    if (!ab || ab.uses === 'passive') throw new GameError('Your role has no active power — it is always on.');
    if (ab.kind === 'steal') {
      if (!DECISION_STAGES.includes(g.stage) || g.decisions[g.stage].step !== 'strategy') throw new GameError('Steal during an open decision.');
      if (p.usedGame.steal) throw new GameError('You already used your theft this game.');
      const t = room.players[a.targetId];
      if (!t || t.id === pid) throw new GameError('Choose a crewmate to rob.');
      if (roleAbility(t)?.kind === 'shield') { p.usedGame.steal = true; say(room, ctx, null, {}, { text: `${p.name} tried to rob ${t.name}… but Bodyguards don't get robbed. Attempt wasted!` }); return [{ type: 'fx', kind: 'power', powerId: 'steal' }]; }
      const amount = Math.min(ab.amount, t.wallet);
      debit(t, amount, `Robbed by ${p.name}`, ctx.now);
      credit(p, amount, `Stolen from ${t.name}`, ctx.now);
      p.usedGame.steal = true;
      say(room, ctx, 'stolen', { name: p.name, amount, victim: t.name });
      return [{ type: 'fx', kind: 'power', powerId: 'steal' }, { type: 'toast', to: t.id, tone: 'bad', text: `${p.name} stole ${amount} VC from you!` }];
    }
    const d = DECISION_STAGES.includes(g.stage) ? g.decisions[g.stage] : null;
    if (!d) throw new GameError('Use your power during a decision.');
    if (d.fixed) throw new GameError('The Pharaoh forbids powers in the final shot.');
    if (ab.uses === 'game' && p.usedGame[ab.kind]) throw new GameError(`${role.name}: already used this game.`);
    if (ab.uses === 'stage' && d.roleUsed[pid]) throw new GameError(`${role.name}: already used this decision.`);
    const map = { doubleBoosts: 'double', veto: 'veto', sabotage: 'sabotage', shield: 'shield', respin: 'time_loop' };
    const effect = map[ab.kind];
    if (!effect) throw new GameError('Nothing to use.');
    if (effect === 'time_loop' ? d.step !== 'results' : d.step !== 'strategy' || ctx.now < g.introUntil) throw new GameError(effect === 'time_loop' ? 'Re-spin right after a result.' : 'Use it while the decision is open.');
    const events = applyPower(room, ctx, d, pid, effect, a.targetId, `${role.icon} ${role.name}`);
    if (ab.uses === 'game') p.usedGame[ab.kind] = true; else d.roleUsed[pid] = true;
    return events;
  },

  // ── Pharaoh's tests ──
  'test:done'(room, pid) {
    const g = room.game;
    if (!g || !['couples', 'groups'].includes(g.stage)) throw new GameError('No test right now.');
    requireParticipant(g, pid);
    g.tests[g.stage].done[pid] = true;
    return [];
  },

  'test:score'(room, pid, a, ctx) {
    const g = room.game;
    if (!g || !['couples', 'groups'].includes(g.stage)) throw new GameError('No test right now.');
    requireParticipant(g, pid);
    const t = g.tests[g.stage];
    const s = a.score;
    if (!Number.isInteger(s) || s < 1 || s > 10) throw new GameError('Score from 1 to 10.');
    t.score[pid] = s;
    t.done[pid] = true;
    if (activeParticipants(room).every((id) => t.score[id])) return nextTestStage(room, ctx);
    return [];
  },

  'nominate:set'(room, pid, a, ctx) {
    const g = requireStage(room, 'nominate');
    requireParticipant(g, pid);
    if (g.nominationLocked[pid]) throw new GameError('Your three countries are locked.');
    const list = (a.countryIds || []);
    const n = room.config.final.nominationsPerPlayer;
    if (list.length !== n) throw new GameError(`Pick exactly ${n} countries.`);
    if (new Set(list).size !== n) throw new GameError('Three DIFFERENT countries. The Pharaoh counts.');
    if (!list.every((id) => GAME_COUNTRY_IDS.has(id))) throw new GameError('Only countries from the game list.');
    g.nominations[pid] = [...list];
    g.nominationLocked[pid] = true;
    if (activeParticipants(room).every((id) => g.nominationLocked[id])) return startFinal(room, ctx);
    return [];
  },

  // ── end-game Black Market ──
  'market:open'(room, pid, a, ctx) {
    const m = requireMarket(room);
    const item = marketItemById(a.itemId);
    if (!item) throw new GameError('Unknown item.');
    const left = stockLeft(m, item);
    if (left <= 0) throw new GameError(`${item.name} is sold out.`);
    if (m.pools.some((x) => !x.done && x.itemId === item.id && (item.for === 'crew' || x.owner === pid))) throw new GameError('There is already an open pool for this — fund it instead.');
    const pool = { id: `pool${++m.seq}`, itemId: item.id, owner: item.for === 'crew' ? null : pid, openedBy: pid, contributions: {}, done: false, at: ctx.now };
    m.pools.push(pool);
    return a.amount ? fundPool(room, ctx, pool, pid, a.amount) : [];
  },

  'market:fund'(room, pid, a, ctx) {
    const m = requireMarket(room);
    const pool = m.pools.find((x) => x.id === a.poolId);
    if (!pool || pool.done) throw new GameError('This pool is closed.');
    return fundPool(room, ctx, pool, pid, a.amount);
  },

  'market:withdraw'(room, pid, a, ctx) {
    const m = requireMarket(room);
    const pool = m.pools.find((x) => x.id === a.poolId);
    if (!pool || pool.done) throw new GameError('This pool is closed.');
    const c = pool.contributions[pid];
    if (!c) throw new GameError('You have nothing in this pool.');
    delete pool.contributions[pid];
    credit(room.players[pid], c.paid, `Withdrawn from pool: ${marketItemById(pool.itemId).name}`, ctx.now);
    if (!Object.keys(pool.contributions).length) m.pools = m.pools.filter((x) => x !== pool);
    return [];
  },

  'market:give'(room, pid, a, ctx) {
    requireMarket(room);
    const to = room.players[a.toId];
    if (!to || to.id === pid) throw new GameError('Choose a crewmate.');
    const amount = a.amount;
    if (!Number.isInteger(amount) || amount < 1) throw new GameError('Enter a whole number of VC.');
    const p = room.players[pid];
    debit(p, amount, `Sent to ${to.name}${a.note ? ` — ${clean(a.note)}` : ''}`, ctx.now);
    credit(to, amount, `From ${p.name}${a.note ? ` — ${clean(a.note)}` : ''}`, ctx.now);
    room.market.log.push({ at: ctx.now, kind: 'give', from: pid, to: to.id, amount, note: clean(a.note) });
    return [{ type: 'toast', to: to.id, tone: 'good', text: `${p.name} sent you ${amount} VC${a.note ? `: “${clean(a.note)}”` : ''}` }];
  },

  'market:request'(room, pid, a, ctx) {
    const m = requireMarket(room);
    const to = room.players[a.toId];
    if (!to || to.id === pid) throw new GameError('Choose a crewmate.');
    if (!Number.isInteger(a.amount) || a.amount < 1) throw new GameError('Enter a whole number of VC.');
    const req = { id: `req${++m.seq}`, from: pid, to: to.id, amount: a.amount, note: clean(a.note), status: 'open', at: ctx.now };
    m.requests.push(req);
    return [{ type: 'toast', to: to.id, tone: 'info', text: `${room.players[pid].name} asks you for ${a.amount} VC${req.note ? `: “${req.note}”` : ''}. Answer in the Black Market.` }];
  },

  'market:answer'(room, pid, a, ctx) {
    const m = requireMarket(room);
    const req = m.requests.find((r) => r.id === a.requestId);
    if (!req || req.to !== pid || req.status !== 'open') throw new GameError('This request is no longer open.');
    if (!a.accept) { req.status = 'declined'; return [{ type: 'toast', to: req.from, tone: 'bad', text: `${room.players[pid].name} declined your request.` }]; }
    const p = room.players[pid], to = room.players[req.from];
    debit(p, req.amount, `Gave ${to.name} (request)${req.note ? ` — ${req.note}` : ''}`, ctx.now);
    credit(to, req.amount, `From ${p.name} (request)${req.note ? ` — ${req.note}` : ''}`, ctx.now);
    req.status = 'accepted';
    m.log.push({ at: ctx.now, kind: 'give', from: pid, to: to.id, amount: req.amount, note: req.note });
    return [{ type: 'toast', to: req.from, tone: 'good', text: `${p.name} accepted: +${req.amount} VC.` }];
  },

  // ── host controls ──
  'host:launch'(room, pid, a, ctx) { requireHost(room, pid); return launch(room, ctx); },

  'host:advance'(room, pid, a, ctx) {
    requireHost(room, pid);
    const g = room.game;
    if (!g) throw new GameError('No game in progress.');
    return advance(room, ctx, true);
  },

  'host:extend'(room, pid, a) {
    requireHost(room, pid);
    const g = room.game;
    if (!g || !g.stageEndsAt) throw new GameError('Nothing to extend.');
    g.stageEndsAt += Math.max(10, Math.min(600, Number(a.seconds) || 60)) * 1000;
    return [];
  },

  'host:config'(room, pid, a) {
    requireHost(room, pid);
    if (room.phase !== 'lobby') throw new GameError('Change settings before launch.');
    const t = room.config.timers;
    if (a.strategy !== undefined) t.strategy = clampInt(a.strategy, 30, 900);
    if (a.wishlist !== undefined) t.wishlist = clampInt(a.wishlist, 30, 600);
    if (a.month !== undefined) room.config.round.month = clampInt(a.month, 0, 11);
    return [];
  },

  'host:addBot'(room, pid, a, ctx) {
    requireHost(room, pid);
    if (room.phase !== 'lobby') throw new GameError('Add bots before launch.');
    const id = `bot_${Math.floor(ctx.rng() * 1e9).toString(36)}`;
    const bot = addPlayer(room, { id, isBot: true, now: ctx.now });
    const taken = new Set(room.order.map((x) => room.players[x].nationality));
    const nation = NATIONS.filter((n) => n.id !== 'other').find((n) => !taken.has(n.id)) || NATIONS[Math.floor(ctx.rng() * 4)];
    const names = { portugal: 'Bot Inês', macedonia: 'Bot Ana', poland: 'Bot Kuba', morocco: 'Bot Yassine', other: 'Bot Nova' };
    Object.assign(bot, {
      name: names[nation.id], nationality: nation.id, onboarded: true, home: nation.home,
      appearance: { ...nation.preset, outfit: Math.floor(ctx.rng() * APPEARANCE.outfit.length) },
      group: defaultGroup(nation.preset.presentation),
      visited: [nation.countryId, '724', '380'].filter(Boolean),
    });
    bot.flags.embassyVisited = true;
    // Bots pair up with the unpaired crewmate of their couple nation (Macedonia ♥ Poland, Morocco ♥ Portugal).
    const mate = room.order.map((x) => room.players[x]).find((q) => q.id !== id && q.onboarded && q.nationality === COUPLE_NATIONS[nation.id] && !q.partnerId);
    if (mate) { bot.partnerId = mate.id; mate.partnerId = bot.id; }
    say(room, ctx, 'welcome', { name: bot.name });
    return [];
  },

  'host:removePlayer'(room, pid, a) {
    requireHost(room, pid);
    if (room.phase !== 'lobby') throw new GameError('Remove players before launch.');
    const t = room.players[a.targetId];
    if (!t || a.targetId === pid) throw new GameError('Invalid player.');
    delete room.players[a.targetId];
    room.order = room.order.filter((x) => x !== a.targetId);
    for (const q of Object.values(room.players)) if (q.partnerId === a.targetId) q.partnerId = null;
    return [{ type: 'kick', to: a.targetId }];
  },

  'host:transfer'(room, pid, a, ctx) {
    requireHost(room, pid);
    const t = room.players[a.targetId];
    if (!t || t.isBot) throw new GameError('Choose a human crew member.');
    room.hostId = a.targetId;
    room.hostAwaySince = t.connected ? null : ctx.now;
    say(room, ctx, null, {}, { text: `${t.name} now holds the host controls. Use them gently.` });
    return [];
  },

  'host:closeMarket'(room, pid, a, ctx) {
    requireHost(room, pid);
    const m = requireMarket(room);
    for (const pool of m.pools) if (!pool.done) for (const [cid, c] of Object.entries(pool.contributions)) credit(room.players[cid], c.paid, `Refund: ${marketItemById(pool.itemId).name} was not completed`, ctx.now);
    m.pools = m.pools.filter((x) => x.done);
    m.closed = true;
    room.phase = 'ended';
    say(room, ctx, null, {}, { who: 'baby', text: 'Market closed! Your vacation contract is ready. Screenshot it, it\'s legally binding. (It isn\'t.)' });
    return [{ type: 'fx', kind: 'ended' }];
  },
};

export function applyAction(room, pid, action, ctx) {
  try {
    if (!room.players[pid]) throw new GameError('You are not in this crew.');
    if (!action || typeof action !== 'object') throw new GameError('Bad request.');
    const fn = HANDLERS[action.type];
    if (!fn) throw new GameError(`Unknown action: ${action.type}`);
    const events = fn(room, pid, action, ctx) || [];
    bump(room);
    return { ok: true, events };
  } catch (e) {
    if (e instanceof GameError) return { ok: false, error: e.message, events: [] };
    throw e;
  }
}

// ───────────────────────────── powers ─────────────────────────────

function applyPower(room, ctx, d, pid, effect, targetId, label) {
  const p = room.players[pid];
  const g = room.game;
  const logPublic = (detail, target) => {
    d.log.push({ at: ctx.now, by: pid, effect, label, target: target || null, detail });
    say(room, ctx, 'power', { name: p.name, power: label, detail });
  };
  const needOpt = () => {
    const o = d.options.find((x) => x.id === targetId);
    if (!o) throw new GameError('Choose an option on the wheel.');
    if (d.vetoed[o.id]) throw new GameError('That option is already off the wheel.');
    return o;
  };
  switch (effect) {
    case 'veto': {
      const o = needOpt();
      if (d.shields[o.id]) throw new GameError(`${optName(d.kind, o.id)} is shielded — vetoes bounce off.`);
      const remaining = d.options.filter((x) => !d.vetoed[x.id]).length;
      if (remaining <= 2) throw new GameError('At least two options must stay on the wheel.');
      d.vetoed[o.id] = pid;
      // refund everything that was riding on the vetoed option
      for (const [bid, m] of Object.entries(d.boosts)) if (m[o.id]) { credit(room.players[bid], m[o.id] * room.config.boosts.price, `Refund: chips on vetoed ${optName(d.kind, o.id)}`, ctx.now); m[o.id] = 0; }
      for (const [bid, b] of Object.entries(d.bets)) if (b.optionId === o.id) { credit(room.players[bid], b.stake, `Refund: bet on vetoed ${optName(d.kind, o.id)}`, ctx.now); delete d.bets[bid]; }
      for (const list of Object.values(d.picks)) { const k = list.indexOf(o.id); if (k >= 0) list.splice(k, 1); }
      logPublic(`${optName(d.kind, o.id)} is OFF the wheel (chips & bets on it refunded).`, o.id);
      return [{ type: 'fx', kind: 'power', powerId: 'veto', optionId: o.id }];
    }
    case 'shield': {
      const o = needOpt();
      d.shields[o.id] = pid;
      logPublic(`${optName(d.kind, o.id)} is shielded against veto and sabotage.`, o.id);
      return [{ type: 'fx', kind: 'power', powerId: 'shield', optionId: o.id }];
    }
    case 'sabotage': {
      const o = needOpt();
      if (d.shields[o.id]) throw new GameError(`${optName(d.kind, o.id)} is shielded — sabotage fizzles.`);
      let wiped = 0;
      for (const m of Object.values(d.boosts)) { wiped += m[o.id] || 0; m[o.id] = 0; }
      for (const m of Object.values(d.golden)) { wiped += m[o.id] || 0; m[o.id] = 0; }
      logPublic(`${wiped} boost${wiped === 1 ? '' : 's'} on ${optName(d.kind, o.id)} destroyed.`, o.id);
      return [{ type: 'fx', kind: 'power', powerId: 'sabotage', optionId: o.id }];
    }
    case 'double': {
      const o = needOpt();
      d.doubled[o.id] = pid;
      logPublic(`Every boost on ${optName(d.kind, o.id)} now counts double.`, o.id);
      return [{ type: 'fx', kind: 'power', powerId: 'double', optionId: o.id }];
    }
    case 'golden_ticket': {
      const o = needOpt();
      d.golden[pid] ||= {};
      d.golden[pid][o.id] = (d.golden[pid][o.id] || 0) + 3;
      logPublic(`+3 chips on ${optName(d.kind, o.id)}.`, o.id);
      return [{ type: 'fx', kind: 'power', powerId: 'golden_ticket', optionId: o.id }];
    }
    case 'spyglass': d.mods[pid] = { ...(d.mods[pid] || {}), spy: true }; return [{ type: 'toast', to: pid, tone: 'info', text: 'Spyglass active: you can now see every bet.' }];
    case 'double_down': if (d.mods[pid]?.double) throw new GameError('Already active.'); d.mods[pid] = { ...(d.mods[pid] || {}), double: true }; return [{ type: 'toast', to: pid, tone: 'good', text: 'Double Down active: a winning bet pays double.' }];
    case 'insurance': if (d.mods[pid]?.insurance) throw new GameError('Already active.'); d.mods[pid] = { ...(d.mods[pid] || {}), insurance: true }; return [{ type: 'toast', to: pid, tone: 'good', text: 'Insurance active: if your bet loses, you get your stake back.' }];
    case 'time_loop': {
      if (d.respinUsed) throw new GameError('This decision has already been re-spun once.');
      if (d.kind === 'final') throw new GameError('The Pharaoh forbids re-spins.');
      d.respinUsed = pid;
      logPublic('TIME LOOP — the wheel spins again with the same odds.', null);
      say(room, ctx, 'respin', { name: p.name });
      drawAndReveal(room, ctx, d, pid);
      void g;
      return [{ type: 'fx', kind: 'power', powerId: 'time_loop' }];
    }
    default: throw new GameError('Unknown power.');
  }
}

// ───────────────────────────── flow ─────────────────────────────

function checkAutoLaunch(room, ctx) {
  if (room.phase !== 'lobby') return;
  const humans = room.order.map((id) => room.players[id]).filter((p) => !p.isBot && p.connected && p.onboarded);
  if (humans.length && humans.every((p) => p.boarded && p.role)) {
    if (!room.launchAt) { room.launchAt = ctx.now + room.config.timers.launchCountdown * 1000; say(room, ctx, 'allAboard'); }
  } else room.launchAt = null;
}

function launch(room, ctx) {
  if (room.phase !== 'lobby') throw new GameError('Already launched.');
  const participants = room.order.filter((id) => room.players[id].onboarded && active(room, id));
  if (!participants.length) throw new GameError('Nobody is ready yet.');
  // The Role Market is a mandatory stop: every human must have chosen a role there before the ship leaves.
  const roleless = participants.filter((id) => !room.players[id].role && !room.players[id].isBot);
  if (roleless.length) throw new GameError(`${roleless.map((id) => room.players[id].name).join(', ')} still ${roleless.length === 1 ? 'has' : 'have'} to choose a role at the Role Market.`);
  for (const id of participants) {
    const p = room.players[id];
    if (!p.role) { p.role = 'rookie'; credit(p, 400, 'Rookie bonus (bot)', ctx.now); }
    p.boarded = false;
  }
  room.gameNo++;
  room.phase = 'game';
  room.launchAt = null;
  const T = room.config.timers;
  const intro = ctx.now + T.launchCinematic * 1000;
  room.game = {
    no: room.gameNo, stage: 'wishlist', participants, startedAt: ctx.now,
    introUntil: intro, stageEndsAt: intro + T.wishlist * 1000,
    wishes: Object.fromEntries(participants.filter((id) => room.players[id].flags.francePromise).map((id) => [id, ['250']])), wishLocked: {}, blocked: {}, decisions: {}, result: {},
    tests: { couples: { done: {}, score: {} }, groups: { done: {}, score: {} } },
    nominations: {}, nominationLocked: {}, satisfaction: null,
  };
  say(room, ctx, 'launch');
  return [{ type: 'fx', kind: 'launch' }];
}

/** Union of every crewmate's impossible months (who blocked what stays private). */
export function blockedMonths(g) {
  return [...new Set(Object.values(g.blocked || {}).flat())].sort((a, b) => a - b);
}

/**
 * Picks prefilled from each wishlist, so nobody starts from zero (everyone can change them):
 *  month → the months where most of your wishes are comfy · region → regions holding your wishes ·
 *  country → your wished countries in the drawn region.
 */
export function suggestedPicks(g, kind, options, max) {
  const ids = new Set(options.map((o) => o.id));
  const out = {};
  for (const pid of g.participants) {
    const wishes = g.wishes[pid] || [];
    let ranked = [];
    if (kind === 'month') {
      const temps = wishes.map(countryById).filter(Boolean);
      ranked = options.map((o) => {
        const m = Number(o.id);
        const share = comfyShare(wishes, m);
        const mild = temps.length ? -temps.reduce((a, c) => a + Math.abs(c.temp[m] - 24), 0) / temps.length : 0;
        return [o.id, share, mild];
      }).filter(([, share]) => share > 0).sort((a, b) => b[1] - a[1] || b[2] - a[2]).map(([id]) => id);
    } else if (kind === 'region') {
      ranked = REGIONS.map((r) => [r.id, wishes.filter((c) => r.members.includes(c)).length]).filter(([id, n]) => n > 0 && ids.has(id)).sort((a, b) => b[1] - a[1]).map(([id]) => id);
    } else {
      ranked = wishes.filter((c) => ids.has(c));
    }
    out[pid] = ranked.slice(0, max);
  }
  return out;
}

function newDecision(kind, options, extra = {}) {
  return {
    kind, options, step: 'strategy', boosts: {}, golden: {}, doubled: {}, shields: {}, vetoed: {}, picks: {}, ready: {}, crewSize: 0,
    bets: {}, mods: {}, roleUsed: {}, log: [], consensus: null, frozen: null, multipliers: null, draws: [], revealStartAt: null,
    respinUsed: null, settlements: null, ...extra,
  };
}

function startDecision(room, ctx, kind) {
  const g = room.game;
  const T = room.config.timers;
  const crew = g.participants.map((id) => room.players[id]);
  let options;
  if (kind === 'month') {
    options = monthOptions(g.wishes, room.config, blockedMonths(g));
    say(room, ctx, 'monthStart');
  } else if (kind === 'region') {
    options = regionOptions(g.wishes, room.config);
    say(room, ctx, 'regionStart');
  } else {
    options = countryOptions(g.result.region, crew, g.wishes, room.config);
    say(room, ctx, 'countryStart', { region: regionById(g.result.region).name });
  }
  const maxPicks = maxPicksFor(options.length, room.config);
  g.decisions[kind] = newDecision(kind, options, { crewSize: g.participants.length, maxPicks, picks: suggestedPicks(g, kind, options, maxPicks), prefilled: true });
  g.stage = kind;
  g.introUntil = ctx.now + T.stageCinematic * 1000;
  g.stageEndsAt = g.introUntil + T.strategy * 1000;
  return [{ type: 'fx', kind: 'stage', stage: kind }];
}

function lockDecision(room, ctx) {
  const g = room.game;
  const d = g.decisions[g.stage];
  if (!d.fixed) {
    const united = d.options.filter((o) => !d.vetoed[o.id] && picksOn(d, o.id) >= Math.max(2, d.crewSize));
    if (united.length) { d.consensus = united[0].id; say(room, ctx, 'consensus', { option: united.map((o) => optName(d.kind, o.id)).join(' & ') }); }
  }
  const bd = computeBreakdown(d, room.config);
  d.frozen = bd;
  d.multipliers = Object.fromEntries(bd.rows.map((r) => [r.id, betMultiplier(r.p, room.config)]));
  for (const b of Object.values(d.bets)) b.multiplier = d.multipliers[b.optionId];
  say(room, ctx, 'lock');
  drawAndReveal(room, ctx, d, null);
  return [{ type: 'fx', kind: 'reveal' }];
}

/** One honest draw with the frozen odds, then a synchronized reveal for everyone. */
function drawAndReveal(room, ctx, d, by) {
  const g = room.game;
  const T = room.config.timers;
  const u = ctx.rng();
  const winner = pickWinner(d.frozen.rows, u);
  d.draws.push({ u, winner, at: ctx.now, by });
  d.step = 'reveal';
  d.revealStartAt = ctx.now + T.revealLeadIn * 1000;
  g.stageEndsAt = d.revealStartAt + T.reveal * 1000;
  if (!by) say(room, ctx, 'reveal');
}

function toResults(room, ctx) {
  const g = room.game;
  const d = g.decisions[g.stage];
  const draw = d.draws[d.draws.length - 1];
  const w = d.frozen.rows.find((r) => r.id === draw.winner);
  const pct = `${(w.p * 100).toFixed(1)}%`;
  const max = Math.max(...d.frozen.rows.map((r) => r.p));
  if (d.kind === 'final') say(room, ctx, null, {}, { who: 'pharaoh', text: fill(PHARAOH_LINES.verdict, { country: optName('country', w.id) }) });
  else say(room, ctx, w.p === max ? 'winnerFavourite' : w.p < 0.08 ? 'winnerUnderdog' : 'winnerMiddle', { option: optName(d.kind, w.id), pct });
  d.step = 'results';
  d.settlements = previewSettlements(room, d);
  g.stageEndsAt = ctx.now + room.config.timers.results * 1000;
}

function previewSettlements(room, d) {
  const winner = d.draws[d.draws.length - 1].winner;
  const out = {};
  for (const id of room.game.participants) {
    const p = room.players[id];
    const bet = d.bets[id];
    if (!p || !bet) { out[id] = null; continue; }
    const mods = d.mods[id] || {};
    out[id] = { bet, ...settleBet(bet, winner, { double: mods.double || roleAbility(p)?.kind === 'betDouble', insurance: !!mods.insurance }) };
  }
  return out;
}

/** Leave the results of a decision: pay bets, record the result, move on. */
function closeDecision(room, ctx) {
  const g = room.game;
  const d = g.decisions[g.stage];
  const winner = d.draws[d.draws.length - 1].winner;
  d.settlements = previewSettlements(room, d);
  for (const [id, s] of Object.entries(d.settlements)) if (s && s.payout) credit(room.players[id], s.payout, s.won ? `Bet won on ${optName(d.kind, winner)}${s.double ? ' (×2)' : ''}` : 'Insurance: stake returned', ctx.now);
  d.settled = true;
  g.result[d.kind] = winner;
  room.history.push({ game: g.no, kind: d.kind, winner, p: d.frozen.rows.find((r) => r.id === winner).p, u: d.draws[d.draws.length - 1].u, at: ctx.now });
  if (d.kind === 'month') return startDecision(room, ctx, 'region');
  if (d.kind === 'region') return startDecision(room, ctx, 'country');
  if (d.kind === 'country') {
    const T = room.config.timers;
    g.stage = 'pharaoh';
    g.introUntil = ctx.now + T.pharaoh * 1000;
    g.stageEndsAt = g.introUntil;
    say(room, ctx, null, {}, { who: 'pharaoh', text: PHARAOH_LINES.reveal[0] });
    return [{ type: 'fx', kind: 'pharaoh' }];
  }
  // final → exit
  const T = room.config.timers;
  g.stage = 'exit';
  g.introUntil = ctx.now + T.exitCinematic * 1000;
  g.stageEndsAt = g.introUntil;
  return [{ type: 'fx', kind: 'exit' }];
}

function nextTestStage(room, ctx) {
  const g = room.game;
  const country = optName('country', g.result.country);
  if (g.stage === 'couples') {
    g.stage = 'groups';
    g.stageEndsAt = ctx.now + room.config.timers.groups * 1000;
    say(room, ctx, null, {}, { who: 'pharaoh', text: fill(PHARAOH_LINES.groups, { country }) });
    return [{ type: 'fx', kind: 'stage', stage: 'groups' }];
  }
  // groups → the final shot (the other slices come from everyone's wishlist)
  g.satisfaction = computeSatisfaction(room);
  const score = g.satisfaction.S.toFixed(1);
  say(room, ctx, null, {}, { who: 'pharaoh', text: fill(g.satisfaction.S >= 8 ? PHARAOH_LINES.berserkHappy : PHARAOH_LINES.berserk, { score, country }) });
  return startFinal(room, ctx);
}

export function computeSatisfaction(room) {
  const g = room.game;
  const seen = new Set();
  const units = [];
  const cs = g.tests.couples.score;
  for (const id of g.participants) {
    if (seen.has(id)) continue;
    const mate = partnerOf(room, id);
    const members = mate && g.participants.includes(mate) ? [id, mate] : [id];
    members.forEach((m) => seen.add(m));
    const cupid = members.some((m) => roleAbility(room.players[m])?.kind === 'cupid');
    units.push({ members, scores: members.map((m) => cs[m]).filter(Boolean), weight: cupid ? 2 : 1 });
  }
  const groups = { girls: [], boys: [] };
  for (const id of g.participants) { const s = g.tests.groups.score[id]; if (s) groups[room.players[id].group === 'girls' ? 'girls' : 'boys'].push(s); }
  return { ...satisfaction({ units, groups }), units: units.map((u) => ({ members: u.members, score: u.scores.length ? u.scores.reduce((a, b) => a + b, 0) / u.scores.length : null, weight: u.weight })), groups: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length ? v.reduce((a, b) => a + b, 0) / v.length : null])) };
}

function startFinal(room, ctx) {
  const g = room.game;
  if (!g.satisfaction) g.satisfaction = computeSatisfaction(room);
  const fallback = g.decisions.country.options.map((o) => o.id);
  // Each crewmate's wishlist is their list of escape routes (old saves may still carry nominations).
  const escapes = Object.keys(g.nominations || {}).length ? g.nominations : g.wishes;
  const dist = finalDistribution({ selected: g.result.country, S: g.satisfaction.S, nominations: escapes, wishes: g.wishes, fallback }, room.config);
  g.finalDist = dist;
  const options = dist.options.map((o) => ({ id: o.id, p: o.p, base: 0, wish: 0, nominations: o.nominations, leader: !!o.leader, wishes: o.wishes || 0 }));
  g.decisions.final = newDecision('final', options, { fixed: true });
  g.stage = 'final';
  const T = room.config.timers;
  g.introUntil = ctx.now + T.stageCinematic * 1000;
  g.stageEndsAt = g.introUntil + T.finalStrategy * 1000;
  say(room, ctx, null, {}, { who: 'pharaoh', text: fill(PHARAOH_LINES.final, { country: optName('country', g.result.country), pct: `${(dist.P * 100).toFixed(1)}%` }) });
  return [{ type: 'fx', kind: 'stage', stage: 'final' }];
}

function openMarket(room, ctx) {
  const total = Object.values(room.players).reduce((a, p) => a + p.wallet, 0);
  room.phase = 'market';
  room.market = { openedAt: ctx.now, startTotal: total, pools: [], purchases: [], requests: [], log: [], seq: 0, closed: false, destination: room.game.result.final };
  for (const p of Object.values(room.players)) p.boarded = false;
  say(room, ctx, null, {}, { who: 'baby', text: 'Welcome to the Black Market, legends! Fund privileges, send coins, team up. The restart costs every coin you own together.' });
  return [{ type: 'fx', kind: 'market' }];
}

function fundPool(room, ctx, pool, pid, amount) {
  const m = room.market;
  const item = marketItemById(pool.itemId);
  if (!Number.isInteger(amount) || amount < 1) throw new GameError('Enter a whole number of VC.');
  const price = item.id === 'restart' ? restartPrice(room) : item.price;
  const p = room.players[pid];
  const factor = roleAbility(p)?.kind === 'halfPrice' && item.id !== 'restart' ? 2 : 1; // Merchant coins count double (not for the restart)
  const funded = poolValue(pool);
  const needed = price - funded;
  const pay = Math.min(amount, Math.ceil(needed / factor));
  if (pay <= 0) throw new GameError('This pool is already full.');
  debit(p, pay, `Pool: ${item.name}`, ctx.now);
  const c = pool.contributions[pid] || { paid: 0, value: 0 };
  c.paid += pay; c.value += pay * factor;
  pool.contributions[pid] = c;
  const events = [];
  if (poolValue(pool) >= price) {
    pool.done = true; pool.doneAt = ctx.now;
    m.purchases.push({ itemId: item.id, owner: pool.owner, poolId: pool.id, at: ctx.now, contributors: Object.keys(pool.contributions) });
    say(room, ctx, null, {}, { who: 'baby', text: `SOLD! ${item.icon} ${item.name}${pool.owner ? ` for ${room.players[pool.owner].name}` : ' for the whole crew'}.` });
    if (stockLeft(m, item) <= 0) {
      for (const other of m.pools.filter((x) => !x.done && x.itemId === item.id)) {
        for (const [cid, c] of Object.entries(other.contributions)) credit(room.players[cid], c.paid, `Refund: ${item.name} sold out`, ctx.now);
        other.contributions = {};
      }
      m.pools = m.pools.filter((x) => x.done || x.itemId !== item.id);
    }
    events.push({ type: 'fx', kind: 'purchase', itemId: item.id });
    if (item.id === 'restart') events.push(...restartGame(room, ctx));
  }
  return events;
}
const poolValue = (pool) => Object.values(pool.contributions).reduce((a, c) => a + c.value, 0);
/** The restart costs every coin the crew still owns: all wallets plus everything sitting in open pools. */
export function restartPrice(room) {
  const wallets = Object.values(room.players).reduce((a, p) => a + p.wallet, 0);
  const pooled = room.market.pools.filter((x) => !x.done).reduce((a, x) => a + Object.values(x.contributions).reduce((b, c) => b + c.paid, 0), 0);
  return Math.max(1, wallets + pooled);
}
const stockLeft = (m, item) => item.stock - m.purchases.filter((x) => x.itemId === item.id).length;

function restartGame(room, ctx) {
  room.history.push({ game: room.gameNo, kind: 'restart', at: ctx.now });
  room.phase = 'lobby';
  room.game = null;
  room.market = null;
  room.launchAt = null;
  for (const p of Object.values(room.players)) {
    p.wallet = room.config.startingVC; ledger(p, ctx.now, 0, `New game — wallet reset to ${room.config.startingVC} VC`);
    p.role = null; p.usedGame = {}; p.boarded = false;
  }
  say(room, ctx, null, {}, { text: 'THE CREW BOUGHT A RESTART! Wallets reset. Choose new roles and board again. Round two!' });
  return [{ type: 'fx', kind: 'restart' }];
}

/** Move the game forward when a timer expires (or the host forces it). */
function advance(room, ctx, forced) {
  const g = room.game;
  if (room.phase !== 'game' || !g) throw new GameError('Nothing to advance.');
  if (g.stage === 'wishlist') return startDecision(room, ctx, 'month');
  if (DECISION_STAGES.includes(g.stage)) {
    const d = g.decisions[g.stage];
    if (d.step === 'strategy') return lockDecision(room, ctx);
    if (d.step === 'reveal') { if (forced) throw new GameError('The reveal cannot be skipped — everyone watches it together.'); toResults(room, ctx); return []; }
    if (d.step === 'results') return closeDecision(room, ctx);
  }
  if (g.stage === 'pharaoh') {
    g.stage = 'couples';
    g.stageEndsAt = ctx.now + room.config.timers.couples * 1000;
    say(room, ctx, null, {}, { who: 'pharaoh', text: fill(PHARAOH_LINES.couples, { country: optName('country', g.result.country) }) });
    return [{ type: 'fx', kind: 'stage', stage: 'couples' }];
  }
  if (g.stage === 'couples' || g.stage === 'groups') return nextTestStage(room, ctx);
  if (g.stage === 'nominate') return startFinal(room, ctx);
  if (g.stage === 'exit') return openMarket(room, ctx);
  return [];
}

/** Timers, auto-launch, host migration. Call a few times per second. */
export function tick(room, ctx) {
  const events = [];
  if (room.phase === 'lobby' && room.launchAt && ctx.now >= room.launchAt) { events.push(...launch(room, ctx)); bump(room); }
  const g = room.game;
  if (room.phase === 'game' && g && g.stageEndsAt && ctx.now >= g.stageEndsAt) { events.push(...advance(room, ctx, false)); bump(room); }
  if (room.hostAwaySince && ctx.now - room.hostAwaySince > room.config.presence.hostMigrationSec * 1000) {
    const next = room.order.find((id) => !room.players[id].isBot && room.players[id].connected);
    if (next) { room.hostId = next; room.hostAwaySince = null; bump(room); }
  }
  return events;
}

// ───────────────────────────── views ─────────────────────────────

/** What one player may see. Bets, boost owners, partner trips and other wallets stay private. */
export function viewFor(room, pid, now) {
  const me = room.players[pid];
  const marketOpen = room.phase === 'market' || room.phase === 'ended';
  const players = room.order.map((id) => {
    const p = room.players[id];
    const self = id === pid;
    return {
      id, name: p.name, nationality: p.nationality, appearance: p.appearance, role: p.role, isBot: p.isBot,
      connected: p.connected, onboarded: p.onboarded, boarded: p.boarded, isHost: id === room.hostId,
      visited: p.visited, partnerVisited: self || p.sharePartner ? p.partnerVisited : null,
      home: p.home, group: p.group, partnerId: p.partnerId, couple: partnerOf(room, id),
      wallet: self || marketOpen ? p.wallet : null, embassyVisited: p.flags.embassyVisited,
      vip: !!p.flags.vip, bracelet: !!p.flags.bracelet, premonition: self || marketOpen ? p.flags.premonition || null : null,
      arcade: p.arcade ? { best: p.arcade.best || {}, played: p.arcade.played || 0, net: p.arcade.key === `${room.phase === 'lobby' ? 'lobby' : 'market'}:${room.gameNo}` ? p.arcade.net : 0 } : null,
    };
  });
  return {
    code: room.code, you: pid, now, version: room.version, hostId: room.hostId, phase: room.phase, launchAt: room.launchAt,
    config: { timers: room.config.timers, boosts: room.config.boosts, betting: room.config.betting, weights: room.config.weights, final: room.config.final, wishlist: room.config.wishlist, round: room.config.round, startingVC: room.config.startingVC },
    players,
    me: me && { wallet: me.wallet, role: me.role, usedGame: me.usedGame, ledger: me.ledger.slice(-60), sharePartner: me.sharePartner, onboarded: me.onboarded, flags: me.flags, arcade: arcadeView(room, me) },
    speech: room.speech,
    history: room.history,
    game: room.game ? gameView(room, room.game, pid) : null,
    market: room.market ? marketView(room, pid) : null,
  };
}

function gameView(room, g, pid) {
  const me = room.players[pid];
  const seeAll = roleAbility(me)?.kind === 'seeAll';
  const decisions = {};
  for (const [k, d] of Object.entries(g.decisions)) decisions[k] = decisionView(room, d, pid, seeAll || !!d.mods[pid]?.spy);
  const testsOver = ['nominate', 'final', 'exit'].includes(g.stage);
  const couplesOver = testsOver || g.stage === 'groups';
  return {
    no: g.no, stage: g.stage, participants: g.participants, introUntil: g.introUntil, stageEndsAt: g.stageEndsAt,
    // wishes are private until the wishlist closes, then public (they change the odds visibly)
    wishes: g.stage === 'wishlist' ? { [pid]: g.wishes[pid] || [] } : g.wishes,
    wishLocked: g.wishLocked,
    myBlocked: (g.blocked || {})[pid] || [],
    blockedMonths: g.stage === 'wishlist' ? null : blockedMonths(g),
    decisions, result: g.result,
    tests: {
      couples: { done: g.tests.couples.done, scored: Object.fromEntries(Object.keys(g.tests.couples.score).map((k) => [k, true])), mine: g.tests.couples.score[pid] || null },
      groups: { done: g.tests.groups.done, scored: Object.fromEntries(Object.keys(g.tests.groups.score).map((k) => [k, true])), mine: g.tests.groups.score[pid] || null },
    },
    satisfaction: testsOver ? g.satisfaction : null,
    couplesAverage: couplesOver ? computeSatisfaction(room).couple : null,
    nominationLocked: g.nominationLocked,
    myNominations: g.nominations[pid] || null,
    nominations: ['final', 'exit'].includes(g.stage) ? g.nominations : null,
    finalDist: g.finalDist || null,
  };
}

function decisionView(room, d, pid, seeBets) {
  const live = d.step === 'strategy' ? computeBreakdown(d, room.config) : d.frozen;
  const pcts = displayPercents(live.rows.map((r) => r.p));
  const seeAll = roleAbility(room.players[pid])?.kind === 'seeAll';
  const revealed = d.step === 'reveal' || d.step === 'results' || d.settled;
  const lastDraw = d.draws[d.draws.length - 1] || null;
  return {
    kind: d.kind, step: d.step, fixed: !!d.fixed,
    options: d.options.map((o) => ({ id: o.id, base: o.base, wish: o.wish, wishers: o.wishers || o.wishes || 0, visitedBy: o.visitedBy, nominations: o.nominations, leader: o.leader })),
    rows: live.rows.map((r, i) => ({ ...r, pct: pcts[i], multiplier: d.multipliers ? d.multipliers[r.id] : null })),
    totalWeight: live.total,
    vetoed: d.vetoed, shields: d.shields, doubled: d.doubled, consensus: d.consensus,
    picks: d.picks, crewSize: d.crewSize, maxPicks: d.maxPicks || room.config.weights.maxPicks, prefilled: !!d.prefilled, ready: d.ready, log: d.log,
    myBoosts: d.boosts[pid] || {}, myGolden: d.golden[pid] || {}, myBoostCount: playerBoosts(d, pid), myMods: d.mods[pid] || {}, roleUsed: !!d.roleUsed[pid],
    myBet: d.bets[pid] || null,
    betCount: Object.keys(d.bets).length,
    bets: seeBets || revealed ? d.bets : null,
    boostsByPlayer: seeAll || d.settled || d.step === 'results' ? d.boosts : null,
    revealStartAt: d.revealStartAt,
    draw: revealed ? lastDraw : null,
    draws: revealed ? d.draws : [],
    respinUsed: d.respinUsed,
    settlements: d.step === 'results' || d.settled ? d.settlements : null,
    settled: !!d.settled,
  };
}

function marketView(room, pid) {
  const m = room.market;
  return {
    openedAt: m.openedAt, restartPrice: restartPrice(room), closed: m.closed, destination: m.destination,
    items: MARKET_ITEMS.map((i) => ({ ...i, price: i.id === 'restart' ? restartPrice(room) : i.price, left: stockLeft(m, i) })),
    pools: m.pools.map((p) => ({ ...p, value: poolValue(p) })),
    purchases: m.purchases,
    requests: m.requests.filter((r) => r.to === pid || r.from === pid),
    log: m.log.slice(-40),
  };
}

// ───────────────────────────── helpers ─────────────────────────────

function arcadeCall(fn) { try { return fn(); } catch (e) { if (e instanceof GameError) throw e; throw new GameError(e.message); } }

function setPartner(room, pid, partnerId) {
  const p = room.players[pid];
  if (partnerId === null || partnerId === '' || partnerId === undefined) { p.partnerId = null; return; }
  const q = room.players[partnerId];
  if (!q || q.id === pid) throw new GameError('Choose a crew member as your partner.');
  p.partnerId = q.id;
  if (q.isBot && !partnerOf(room, q.id)) q.partnerId = pid; // bots accept proposals
}
function uniqueValid(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((id) => typeof id === 'string' && WORLD_IDS.has(id)))].slice(0, 260);
}
const clean = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80);
function requireOnboarded(p) { if (!p.onboarded) throw new GameError('Finish creating your character first.'); }
function requireHost(room, pid) { if (!isHost(room, pid)) throw new GameError('Only the host can do that.'); }
function requireStage(room, stage) {
  const g = room.game;
  if (room.phase !== 'game' || !g || g.stage !== stage) throw new GameError('Not possible right now.');
  return g;
}
function requireParticipant(g, pid) { if (!g.participants.includes(pid)) throw new GameError('You joined mid-flight — you can watch this game and play the next one.'); }
function requireStrategy(room, pid, ctxNow) {
  const g = room.game;
  if (room.phase !== 'game' || !g || !DECISION_STAGES.includes(g.stage)) throw new GameError('No decision is open right now.');
  requireParticipant(g, pid);
  const d = g.decisions[g.stage];
  if (d.step !== 'strategy') throw new GameError('Bets are locked — watch the wheel!');
  void ctxNow;
  return d;
}
function requireOption(d, id) {
  const o = d.options.find((x) => x.id === id);
  if (!o || d.vetoed[id]) throw new GameError('That option is not on the wheel.');
  return o;
}
function requireMarket(room) {
  if (room.phase !== 'market' || !room.market) throw new GameError('The Black Market opens at the end of the game.');
  return room.market;
}
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || lo)));
