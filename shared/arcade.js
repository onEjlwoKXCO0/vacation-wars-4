// Alessandro's Moon Arcade (inside the Control Tower). Server-authoritative mini-games:
//   • Quiz — 5 questions (easy / medium / hard) from a 900+ question bank
//   • Flag Memory — 8 pairs of flags, fewer attempts = better
//   • Globe Duel — 5 "which one?" duels from the real game data (warmer, cheaper, closer, further north)
// Rewards are deliberately small next to the Black Market prices (400–700 VC): a perfect game is worth
// at most about one chip, and every player's net result per Moon visit is capped at ±cap VC.
import { QUIZ_BY_LEVEL, quizById } from './data/quiz.js';
import { COUNTRIES, countryById, MONTHS } from './data/countries.js';
import { travelEstimate } from './rules.js';

export const ARCADE = {
  cap: 100, // max net win (and max net loss) per player per Moon visit
  quiz: { easy: [-15, -15, -5, 0, 8, 15], medium: [-15, -15, -5, 0, 10, 20], hard: [-10, -10, -5, 0, 15, 30] }, // by correct answers 0..5
  duel: [-10, -10, -5, 0, 10, 20],
  memory: { pairs: 8, maxAttempts: 26, table: [[10, 20], [13, 10], [17, 0], [21, -5], [Infinity, -10]] }, // attempts ≤ n → VC
};

const GAMES = ['quiz', 'memory', 'duel'];
const pickN = (arr, n, rng, avoid = new Set()) => {
  const pool = arr.filter((x) => !avoid.has(x.id ?? x));
  const out = [];
  const src = pool.length >= n ? pool : arr;
  const used = new Set();
  while (out.length < Math.min(n, src.length)) { const i = Math.floor(rng() * src.length); if (!used.has(i)) { used.add(i); out.push(src[i]); } }
  return out;
};

export function arcadeState(room, p) {
  const key = `${room.phase === 'lobby' ? 'lobby' : 'market'}:${room.gameNo}`;
  if (!p.arcade || p.arcade.key !== key) p.arcade = { key, net: 0, played: p.arcade?.played || 0, best: p.arcade?.best || {}, seen: p.arcade?.seen || [], session: null };
  return p.arcade;
}

const FLAG_POOL = COUNTRIES.filter((c) => c.id !== '010');

function makeDuels(rng, home) {
  const kinds = ['temp', 'cost', 'flight', 'north', 'temp'];
  const out = [];
  for (const kind of kinds) {
    for (let tries = 0; tries < 200; tries++) {
      const [a, b] = pickN(FLAG_POOL, 2, rng);
      const m = Math.floor(rng() * 12);
      let va, vb, gap, q, unit, wantHigh;
      if (kind === 'temp') { va = a.temp[m]; vb = b.temp[m]; gap = 2; q = `Which is warmer in ${MONTHS[m]}?`; unit = '°C'; wantHigh = true; }
      else if (kind === 'cost') { va = a.dailyEUR; vb = b.dailyEUR; gap = 15; q = 'Which is cheaper per day?'; unit = '€/day'; wantHigh = false; }
      else if (kind === 'flight') { va = travelEstimate(home, a.id).hours; vb = travelEstimate(home, b.id).hours; gap = 1.5; q = 'Which is faster to fly to from your home airport?'; unit = 'h'; wantHigh = false; }
      else { va = a.lat; vb = b.lat; gap = 5; q = 'Which is further north?'; unit = '°'; wantHigh = true; }
      if (Math.abs(va - vb) < gap) continue;
      const ans = (va > vb) === wantHigh ? 'a' : 'b';
      out.push({ kind, q, a: a.id, b: b.id, ans, why: `${a.flag} ${a.name} ${va}${unit} · ${b.flag} ${b.name} ${vb}${unit}` });
      break;
    }
  }
  return out;
}

export function arcadeStart(room, p, a, rng, now) {
  if (!['lobby', 'market', 'ended'].includes(room.phase)) throw new Error('The arcade is closed while the spacecraft is flying.');
  if (!GAMES.includes(a.game)) throw new Error('Unknown game.');
  const st = arcadeState(room, p);
  if (st.session && !st.session.done && st.session.progress > 0) throw new Error('Finish (or quit) your current game first.');
  let session;
  if (a.game === 'quiz') {
    const level = ['easy', 'medium', 'hard'].includes(a.level) ? a.level : 'medium';
    const qs = pickN(QUIZ_BY_LEVEL[level], 5, rng, new Set(st.seen)).map((q) => q.id);
    st.seen = [...st.seen, ...qs].slice(-150);
    session = { game: 'quiz', level, qs, answers: [], progress: 0, startedAt: now };
  } else if (a.game === 'memory') {
    const flags = pickN(FLAG_POOL, ARCADE.memory.pairs, rng).map((c) => c.id);
    const cards = [...flags, ...flags];
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    session = { game: 'memory', cards, open: [], matched: [], last: null, attempts: 0, progress: 0, startedAt: now };
  } else {
    session = { game: 'duel', duels: makeDuels(rng, p.home || '056'), answers: [], progress: 0, startedAt: now };
  }
  st.session = session;
  return session;
}

function settle(room, p, st, score, table, label, now, credit, debit) {
  let delta = table;
  if (delta > 0) delta = Math.max(0, Math.min(delta, ARCADE.cap - st.net));
  else if (delta < 0) delta = -Math.min(-delta, ARCADE.cap + st.net, p.wallet);
  const capped = delta !== table;
  if (delta > 0) credit(p, delta, `Arcade · ${label}`, now);
  else if (delta < 0) debit(p, -delta, `Arcade · ${label}`, now);
  st.net += delta;
  st.played++;
  st.session.done = true;
  st.session.result = { score, delta, table, capped };
  return delta;
}

export function arcadeAnswer(room, p, a, now, credit, debit) {
  const st = arcadeState(room, p);
  const s = st.session;
  if (!s || s.done) throw new Error('No game running.');
  if (s.game === 'quiz') {
    const q = quizById.get(s.qs[s.answers.length]);
    const choice = Number.isInteger(a.choice) ? a.choice : -1; // -1 = time out
    s.answers.push({ choice, ok: choice === q.a });
    s.progress = s.answers.length;
    if (s.answers.length === s.qs.length) {
      const score = s.answers.filter((x) => x.ok).length;
      st.best.quiz = Math.max(st.best.quiz || 0, score + (s.level === 'hard' ? 0.5 : 0));
      settle(room, p, st, score, ARCADE.quiz[s.level][score], `Quiz ${s.level} ${score}/5`, now, credit, debit);
    }
    return s;
  }
  if (s.game === 'duel') {
    const d = s.duels[s.answers.length];
    const pick = a.choice === 'a' || a.choice === 'b' ? a.choice : null;
    s.answers.push({ choice: pick, ok: pick === d.ans });
    s.progress = s.answers.length;
    if (s.answers.length === s.duels.length) {
      const score = s.answers.filter((x) => x.ok).length;
      st.best.duel = Math.max(st.best.duel || 0, score);
      settle(room, p, st, score, ARCADE.duel[score], `Globe Duel ${score}/5`, now, credit, debit);
    }
    return s;
  }
  throw new Error('Wrong game.');
}

export function arcadeFlip(room, p, a, now, credit, debit) {
  const st = arcadeState(room, p);
  const s = st.session;
  if (!s || s.done || s.game !== 'memory') throw new Error('No memory game running.');
  const i = a.index;
  if (!Number.isInteger(i) || i < 0 || i >= s.cards.length) throw new Error('No such card.');
  if (s.matched.includes(i) || s.open.includes(i)) throw new Error('That card is already face up.');
  s.open.push(i);
  s.last = null;
  if (s.open.length === 2) {
    const [x, y] = s.open;
    s.attempts++;
    const match = s.cards[x] === s.cards[y];
    if (match) s.matched.push(x, y);
    s.last = { cards: [x, y], match };
    s.open = [];
  }
  s.progress = s.attempts + s.open.length;
  const allDone = s.matched.length === s.cards.length;
  if (allDone || s.attempts >= ARCADE.memory.maxAttempts) {
    const score = allDone ? s.attempts : Infinity;
    const row = ARCADE.memory.table.find(([max]) => score <= max);
    if (allDone) st.best.memory = Math.min(st.best.memory || 99, s.attempts);
    settle(room, p, st, allDone ? s.attempts : null, row[1], allDone ? `Flag Memory in ${s.attempts} tries` : 'Flag Memory (out of tries)', now, credit, debit);
  }
  return s;
}

/** Quitting a started quiz/duel counts the unanswered questions as wrong (no free escapes). */
export function arcadeQuit(room, p, now, credit, debit) {
  const st = arcadeState(room, p);
  const s = st.session;
  if (!s || s.done) { st.session = null; return; }
  if (s.progress === 0) { st.session = null; return; }
  if (s.game === 'memory') { s.attempts = ARCADE.memory.maxAttempts; const row = ARCADE.memory.table.at(-1); settle(room, p, st, null, row[1], 'Flag Memory (quit)', now, credit, debit); return; }
  const total = s.game === 'quiz' ? s.qs.length : s.duels.length;
  while (s.answers.length < total) s.answers.push({ choice: -1, ok: false });
  const score = s.answers.filter((x) => x.ok).length;
  settle(room, p, st, score, s.game === 'quiz' ? ARCADE.quiz[s.level][score] : ARCADE.duel[score], `${s.game === 'quiz' ? 'Quiz' : 'Globe Duel'} ${score}/5 (quit)`, now, credit, debit);
}

/** What the player sees: never the answer of a question not answered yet, never a face-down card. */
export function arcadeView(room, p) {
  const st = p.arcade && p.arcade.key === `${room.phase === 'lobby' ? 'lobby' : 'market'}:${room.gameNo}` ? p.arcade : { net: 0, played: p.arcade?.played || 0, best: p.arcade?.best || {}, session: null };
  const s = st.session;
  let session = null;
  if (s && s.game === 'quiz') {
    session = {
      game: 'quiz', level: s.level, done: !!s.done, result: s.result || null, total: s.qs.length,
      answered: s.answers.map((ans, i) => { const q = quizById.get(s.qs[i]); return { q: q.q, choices: q.choices, choice: ans.choice, ok: ans.ok, a: q.a, why: q.why }; }),
      current: s.done ? null : (() => { const q = quizById.get(s.qs[s.answers.length]); return { q: q.q, choices: q.choices, n: s.answers.length + 1 }; })(),
    };
  } else if (s && s.game === 'duel') {
    session = {
      game: 'duel', done: !!s.done, result: s.result || null, total: s.duels.length,
      answered: s.answers.map((ans, i) => ({ ...s.duels[i], choice: ans.choice, ok: ans.ok })),
      current: s.done ? null : (() => { const d = s.duels[s.answers.length]; return { q: d.q, a: d.a, b: d.b, kind: d.kind, n: s.answers.length + 1 }; })(),
    };
  } else if (s && s.game === 'memory') {
    const show = new Set([...s.matched, ...s.open, ...(s.last && !s.last.match ? s.last.cards : [])]);
    session = { game: 'memory', done: !!s.done, result: s.result || null, attempts: s.attempts, maxAttempts: ARCADE.memory.maxAttempts, matched: s.matched, open: s.open, last: s.last, cards: s.cards.map((c, i) => (show.has(i) || s.done ? c : null)) };
  }
  return { net: st.net, cap: ARCADE.cap, played: st.played, best: st.best, session, tables: { quiz: ARCADE.quiz, duel: ARCADE.duel, memory: ARCADE.memory.table.map(([m, v]) => [m === Infinity ? null : m, v]) } };
}
