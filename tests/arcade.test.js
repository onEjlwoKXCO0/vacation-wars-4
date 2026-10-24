import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, applyAction, viewFor } from '../shared/engine.js';
import { mulberry32 } from '../shared/map.js';
import { NATIONS } from '../shared/data/nations.js';
import { QUIZ, QUIZ_BY_LEVEL, quizById } from '../shared/data/quiz.js';
import { ARCADE } from '../shared/arcade.js';
import { COUNTRIES } from '../shared/data/countries.js';
import { COUNTRY_INFO } from '../shared/data/countryInfo.js';

function setup() {
  const now = 1_000_000, rng = mulberry32(9);
  const room = createRoom({ code: 'ARC', now });
  addPlayer(room, { id: 'p0', now });
  const n = NATIONS[0];
  assert.ok(applyAction(room, 'p0', { type: 'profile:set', name: 'Gauthier', nationality: n.id, appearance: n.preset, visited: [] }, { now, rng }).ok);
  const act = (a) => applyAction(room, 'p0', a, { now, rng });
  return { room, act, p: room.players.p0 };
}

test('every destination has an encyclopedia card and the quiz bank is big and well-formed', () => {
  for (const c of COUNTRIES) { const i = COUNTRY_INFO[c.id]; assert.ok(i && i.facts.length === 3 && i.bestPlace && i.capital, c.name); }
  assert.ok(QUIZ.length >= 300, `quiz bank has ${QUIZ.length} questions`);
  for (const lvl of ['easy', 'medium', 'hard']) assert.ok(QUIZ_BY_LEVEL[lvl].length >= 60, `${lvl}: ${QUIZ_BY_LEVEL[lvl].length}`);
  for (const q of QUIZ) { assert.equal(q.choices.length, 4); assert.equal(new Set(q.choices).size, 4, q.q); assert.ok(q.a >= 0 && q.a < 4); }
});

test('quiz: answers stay secret until answered, 5/5 pays, 0/5 costs, results are capped', () => {
  const t = setup();
  const w0 = t.p.wallet;
  assert.ok(t.act({ type: 'arcade:start', game: 'quiz', level: 'medium' }).ok);
  const v = viewFor(t.room, 'p0', 0).me.arcade.session;
  assert.equal(v.current.n, 1);
  assert.equal(v.current.a, undefined, 'the answer is not sent');
  for (let i = 0; i < 5; i++) { const q = quizById.get(t.p.arcade.session.qs[i]); assert.ok(t.act({ type: 'arcade:answer', choice: q.a }).ok); }
  assert.equal(t.p.wallet, w0 + ARCADE.quiz.medium[5]);
  // all wrong on easy
  assert.ok(t.act({ type: 'arcade:start', game: 'quiz', level: 'easy' }).ok);
  for (let i = 0; i < 5; i++) { const q = quizById.get(t.p.arcade.session.qs[i]); t.act({ type: 'arcade:answer', choice: (q.a + 1) % 4 }); }
  assert.equal(t.p.wallet, w0 + ARCADE.quiz.medium[5] + ARCADE.quiz.easy[0]);
  // the cap: keep winning hard quizzes → never more than +cap overall
  for (let k = 0; k < 10; k++) {
    t.act({ type: 'arcade:start', game: 'quiz', level: 'hard' });
    for (let i = 0; i < 5; i++) { const q = quizById.get(t.p.arcade.session.qs[i]); t.act({ type: 'arcade:answer', choice: q.a }); }
  }
  assert.equal(t.p.wallet - w0, ARCADE.cap, 'net arcade winnings are capped');
  assert.equal(t.p.arcade.net, ARCADE.cap);
});

test('quiz: quitting after answering counts the rest as wrong; quitting before is free', () => {
  const t = setup();
  const w0 = t.p.wallet;
  t.act({ type: 'arcade:start', game: 'quiz', level: 'easy' });
  assert.ok(t.act({ type: 'arcade:quit' }).ok);
  assert.equal(t.p.wallet, w0);
  t.act({ type: 'arcade:start', game: 'quiz', level: 'easy' });
  const q = quizById.get(t.p.arcade.session.qs[0]);
  t.act({ type: 'arcade:answer', choice: q.a });
  assert.equal(t.act({ type: 'arcade:start', game: 'memory' }).ok, false, 'finish or quit first');
  t.act({ type: 'arcade:quit' });
  assert.equal(t.p.wallet, w0 + ARCADE.quiz.easy[1]);
});

test('flag memory: face-down cards are hidden, a perfect memory wins, the duel uses real data', () => {
  const t = setup();
  const w0 = t.p.wallet;
  t.act({ type: 'arcade:start', game: 'memory' });
  const cards = t.p.arcade.session.cards;
  assert.ok(viewFor(t.room, 'p0', 0).me.arcade.session.cards.every((c) => c === null));
  const seen = new Set();
  for (let i = 0; i < cards.length; i++) {
    if (seen.has(i)) continue;
    const j = cards.findIndex((c, k) => k !== i && c === cards[i]);
    t.act({ type: 'arcade:flip', index: i }); t.act({ type: 'arcade:flip', index: j });
    seen.add(i); seen.add(j);
  }
  assert.equal(t.p.arcade.session.done, true);
  assert.equal(t.p.arcade.session.attempts, ARCADE.memory.pairs);
  assert.equal(t.p.wallet, w0 + 20);
  t.act({ type: 'arcade:start', game: 'duel' });
  const duels = t.p.arcade.session.duels;
  assert.equal(duels.length, 5);
  for (const d of duels) t.act({ type: 'arcade:answer', choice: d.ans });
  assert.equal(t.p.wallet, w0 + 20 + ARCADE.duel[5]);
});

test('the arcade is closed during the flight', () => {
  const t = setup();
  t.room.phase = 'game';
  assert.equal(t.act({ type: 'arcade:start', game: 'quiz' }).ok, false);
});
