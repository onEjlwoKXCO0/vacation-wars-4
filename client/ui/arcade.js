// Alessandro's Moon Arcade (Control Tower): Country Quiz, Flag Memory, Globe Duel and a leaderboard.
// Every outcome is decided by the server (answers and face-down cards never reach the browser early).
import { h, replace, toast, fmtVC } from './dom.js';
import { countryById } from '../../shared/data/countries.js';
import { portrait } from '../gfx/sprites.js';
import { npcById } from '../../shared/data/npcs.js';
import { avatarURL } from '../gfx/sprites.js';
import { audio } from '../audio.js';
import { confetti } from './decision.js';

const QUIZ_SECONDS = 20;
const TITLES = { quiz: '🧠 Country Quiz', memory: '🃏 Flag Memory', duel: '⚔️ Globe Duel', board: '🏆 Leaderboard' };

export function openArcade(root, { net, getView, game, openGlobe, onClose }) {
  const ui = { tab: game && TITLES[game] ? game : 'quiz', level: 'medium', feedback: null, timer: null, deadline: 0, lastKey: '', lastAnswered: 0, flash: null };
  const face = h('canvas', { class: 'talk-portrait', width: 64, height: 64 });
  const fg = face.getContext('2d'); fg.imageSmoothingEnabled = false; fg.drawImage(portrait(npcById('alessandro').look, 'happy'), 0, 0, 64, 64);
  const say = h('div', { class: 'speech-bubble small' });
  const tabs = h('div', { class: 'arc-tabs' });
  const purse = h('div', { class: 'arc-purse' });
  const body = h('div', { class: 'arc-body' });
  const bg = h('div', { class: 'modal-bg arc-bg' }, h('div', { class: 'panel gold modal arcade' },
    h('header', {}, h('div', {}, h('div', { class: 'eyebrow gold' }, 'Control Tower · Moon Arcade'), h('h2', {}, 'Alessandro\'s Arcade')), h('button', { class: 'btn ghost small close', onclick: () => close() }, 'Close ✕')),
    h('div', { class: 'body' }, h('div', { class: 'row dialog-row' }, face, say), purse, tabs, body)));
  root.appendChild(bg);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', onKey);

  async function act(a) {
    const r = await net.act(a);
    if (!r.ok) { toast(r.error, 'bad'); audio.sfx('error'); }
    return r.ok;
  }
  const arc = () => getView()?.me?.arcade;
  const me = () => getView()?.me;

  function lines(tab) {
    return {
      quiz: 'Five questions, twenty seconds each. Choose your level — hard pays more and costs less if you fail.',
      memory: 'Find the eight pairs of flags. Every two cards you turn is one try. Eight tries is perfection.',
      duel: 'Two countries, one question. Trust your instinct… or your geography teacher.',
      board: 'The legends of the tower. Best scores of the crew.',
    }[tab];
  }

  function render() {
    const v = getView(); const A = arc();
    if (!v || !A) return;
    const s = A.session;
    if (s && !s.done && TITLES[s.game]) ui.tab = s.game; // a running game always shows itself
    say.textContent = lines(ui.tab);
    const left = A.cap - A.net;
    replace(purse,
      h('span', {}, 'Wallet ', h('b', { class: 'tnum' }, `${fmtVC(me().wallet)} VC`)),
      h('span', { class: `tnum ${A.net > 0 ? 'good' : A.net < 0 ? 'bad' : ''}` }, `This Moon visit: ${A.net > 0 ? '+' : ''}${A.net} VC`),
      h('span', { class: 'muted small' }, left > 0 ? `you can still win up to ${left} VC` : 'win cap reached — just for glory now'),
      v.phase === 'game' ? h('span', { class: 'tag warn' }, 'Closed during the flight') : null);
    replace(tabs, Object.entries(TITLES).map(([id, label]) => h('button', { class: `btn small ${ui.tab === id ? 'solid' : 'ghost'}`, disabled: s && !s.done && s.game !== id && id !== 'board', onclick: () => { ui.tab = id; ui.feedback = null; render(); } }, label)));
    if (ui.tab === 'board') return replace(body, board(v));
    if (s && s.game === ui.tab) return replace(body, ui.tab === 'quiz' ? quiz(s) : ui.tab === 'memory' ? memory(s) : duel(s));
    replace(body, lobby(ui.tab, A));
  }

  // ───────── start screens ─────────
  function lobby(tab, A) {
    const T = A.tables;
    const row = (label, vals) => h('div', { class: 'arc-table' }, h('b', {}, label), vals.map(([k, d]) => h('span', { class: d > 0 ? 'good' : d < 0 ? 'bad' : 'muted' }, `${k}: ${d > 0 ? '+' : ''}${d}`)));
    const start = (extra = {}) => act({ type: 'arcade:start', game: tab, ...extra }).then((ok) => { if (ok) { audio.sfx('open'); ui.deadline = 0; ui.lastAnswered = 0; render(); } });
    if (tab === 'quiz') return h('div', { class: 'stack' },
      h('div', { class: 'arc-levels' }, ['easy', 'medium', 'hard'].map((l) => h('button', { class: `arc-level ${ui.level === l ? 'on' : ''}`, onclick: () => { ui.level = l; render(); } },
        h('b', {}, l.toUpperCase()), h('small', {}, l === 'easy' ? 'famous countries' : l === 'medium' ? 'travellers' : 'geography nerds'), h('span', { class: 'good' }, `5/5 → +${T.quiz[l][5]} VC`)))),
      row('Payouts', T.quiz[ui.level].map((d, i) => [`${i}/5`, d])),
      h('button', { class: 'btn solid big', onclick: () => start({ level: ui.level }) }, `▶ Start the ${ui.level} quiz`));
    if (tab === 'memory') return h('div', { class: 'stack' },
      h('div', { class: 'arc-hero' }, '🃏🃏🃏🃏'),
      row('Payouts (tries)', T.memory.map(([m, d]) => [m ? `≤${m}` : 'more', d])),
      h('button', { class: 'btn solid big', onclick: () => start() }, '▶ Deal the cards'));
    return h('div', { class: 'stack' },
      h('div', { class: 'arc-hero' }, '🌡️ 💶 ✈️ 🧭'),
      h('div', { class: 'small muted' }, 'Warmer in a given month? Cheaper per day? Faster to fly to from your home airport? Further north?'),
      row('Payouts', T.duel.map((d, i) => [`${i}/5`, d])),
      h('button', { class: 'btn solid big', onclick: () => start() }, '▶ Start the duel'));
  }

  function resultCard(s, again) {
    const r = s.result;
    if (!ui.celebrated || ui.celebrated !== JSON.stringify(r)) { ui.celebrated = JSON.stringify(r); if (r.delta > 0) confetti(50); }
    return h('div', { class: `arc-result ${r.delta > 0 ? 'win' : r.delta < 0 ? 'bust' : ''}` },
      h('div', { class: 'display' }, r.delta > 0 ? 'WIN!' : r.delta < 0 ? 'BUST' : 'DRAW'),
      h('div', { class: 'big tnum' }, `${r.delta > 0 ? '+' : ''}${r.delta} VC`),
      r.capped ? h('div', { class: 'small muted' }, `Capped — the arcade can move your wallet by ±100 VC per Moon visit (table said ${r.table > 0 ? '+' : ''}${r.table}).`) : null,
      h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn solid', onclick: again }, '↻ Play again'), h('button', { class: 'btn ghost', onclick: () => { act({ type: 'arcade:quit' }).then(() => render()); } }, 'Back')));
  }

  // ───────── quiz ─────────
  function quiz(s) {
    const answered = s.answered;
    if (answered.length > ui.lastAnswered) { // show the correction of the last answer for a moment
      const last = answered[answered.length - 1];
      ui.feedback = { ...last, until: performance.now() + 1700 };
      audio.sfx(last.ok ? 'coin' : 'error');
      ui.lastAnswered = answered.length;
      setTimeout(render, 1750);
    }
    const dots = h('div', { class: 'arc-dots' }, Array.from({ length: s.total }, (_, i) => h('span', { class: i < answered.length ? (answered[i].ok ? 'ok' : 'ko') : i === answered.length ? 'now' : '' })));
    const fb = ui.feedback && ui.feedback.until > performance.now() ? ui.feedback : null;
    if (fb) {
      return h('div', { class: 'stack' }, dots, h('div', { class: 'arc-q' }, fb.q),
        h('div', { class: 'arc-choices' }, fb.choices.map((c, i) => h('button', { class: `arc-choice ${i === fb.a ? 'right' : i === fb.choice ? 'wrong' : 'dim'}`, disabled: true }, c))),
        h('div', { class: `arc-why ${fb.ok ? 'good' : 'bad'}` }, fb.ok ? '✓ Correct! ' : fb.choice === -1 ? '⏱️ Time\'s up. ' : '✗ Wrong. ', fb.why));
    }
    if (s.done) return h('div', { class: 'stack' }, dots, resultCard(s, () => act({ type: 'arcade:start', game: 'quiz', level: s.level }).then(() => { ui.lastAnswered = 0; render(); })),
      h('details', { class: 'small' }, h('summary', {}, 'Review the answers'), answered.map((x) => h('div', { class: 'arc-review' }, h('b', {}, x.ok ? '✓ ' : '✗ '), x.q, ' → ', h('b', {}, x.choices[x.a]), h('span', { class: 'muted' }, ` · ${x.why}`)))));
    const cur = s.current;
    const key = `${s.level}:${answered.length}`;
    if (ui.qKey !== key) { ui.qKey = key; ui.deadline = performance.now() + QUIZ_SECONDS * 1000; }
    const bar = h('i');
    const tick = () => {
      if (!bg.isConnected || ui.qKey !== key) return;
      const left = Math.max(0, ui.deadline - performance.now());
      bar.style.width = `${(left / (QUIZ_SECONDS * 1000)) * 100}%`;
      if (left <= 0) { if (ui.sentKey !== key) { ui.sentKey = key; act({ type: 'arcade:answer', choice: -1 }); } return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return h('div', { class: 'stack' }, dots, h('div', { class: 'arc-timer' }, bar),
      h('div', { class: 'eyebrow' }, `Question ${cur.n}/${s.total} · ${s.level}`), h('div', { class: 'arc-q' }, cur.q),
      h('div', { class: 'arc-choices' }, cur.choices.map((c, i) => h('button', { class: 'arc-choice', onclick: (e) => { if (ui.sentKey === key) return; ui.sentKey = key; e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => { b.disabled = true; }); act({ type: 'arcade:answer', choice: i }); } }, h('span', { class: 'k' }, 'ABCD'[i]), c))),
      h('button', { class: 'btn ghost small', onclick: () => act({ type: 'arcade:quit' }).then(render) }, 'Quit (the remaining questions count as wrong)'));
  }

  // ───────── flag memory ─────────
  function memory(s) {
    const lastBad = s.last && !s.last.match ? s.last.cards : [];
    if (s.last && ui.flipKey !== `${s.attempts}`) { ui.flipKey = `${s.attempts}`; audio.sfx(s.last.match ? 'coin' : 'blip'); }
    const grid = h('div', { class: 'arc-memory' }, s.cards.map((cid, i) => {
      const c = cid && countryById(cid);
      const up = !!cid;
      const matched = s.matched.includes(i);
      return h('button', { class: `mcard ${up ? 'up' : ''} ${matched ? 'matched' : ''} ${lastBad.includes(i) ? 'miss' : ''}`, disabled: s.done || matched || s.open.includes(i),
        onclick: () => act({ type: 'arcade:flip', index: i }) },
      h('span', { class: 'back' }, '🌙'), h('span', { class: 'front' }, c ? h('span', {}, h('span', { class: 'mflag' }, c.flag), h('small', {}, c.name)) : ''));
    }));
    return h('div', { class: 'stack' },
      h('div', { class: 'row small' }, h('b', {}, `Tries: ${s.attempts}`), h('span', { class: 'muted' }, `/ ${s.maxAttempts} max · pairs ${s.matched.length / 2}/8`)),
      grid,
      s.done ? resultCard(s, () => act({ type: 'arcade:start', game: 'memory' }).then(render)) : h('button', { class: 'btn ghost small', onclick: () => act({ type: 'arcade:quit' }).then(render) }, 'Give up (counts as a loss)'));
  }

  // ───────── globe duel ─────────
  function duel(s) {
    const answered = s.answered;
    if (answered.length > ui.lastAnswered) {
      const last = answered[answered.length - 1];
      ui.feedback = { ...last, until: performance.now() + 1800 };
      audio.sfx(last.ok ? 'coin' : 'error');
      ui.lastAnswered = answered.length;
      setTimeout(render, 1850);
    }
    const dots = h('div', { class: 'arc-dots' }, Array.from({ length: s.total }, (_, i) => h('span', { class: i < answered.length ? (answered[i].ok ? 'ok' : 'ko') : i === answered.length ? 'now' : '' })));
    const card = (id, side, state) => { const c = countryById(id); return h('button', { class: `duel-card ${state || ''}`, disabled: !!state, onclick: () => act({ type: 'arcade:answer', choice: side }) }, h('span', { class: 'dflag' }, c.flag), h('b', {}, c.name), h('small', { class: 'muted' }, c.refCity)); };
    const fb = ui.feedback && ui.feedback.until > performance.now() ? ui.feedback : null;
    if (fb) return h('div', { class: 'stack' }, dots, h('div', { class: 'arc-q' }, fb.q),
      h('div', { class: 'duel' }, card(fb.a, 'a', fb.ans === 'a' ? 'right' : fb.choice === 'a' ? 'wrong' : 'dim'), h('span', { class: 'vs' }, 'VS'), card(fb.b, 'b', fb.ans === 'b' ? 'right' : fb.choice === 'b' ? 'wrong' : 'dim')),
      h('div', { class: `arc-why ${fb.ok ? 'good' : 'bad'}` }, fb.ok ? '✓ ' : '✗ ', fb.why));
    if (s.done) return h('div', { class: 'stack' }, dots, resultCard(s, () => act({ type: 'arcade:start', game: 'duel' }).then(() => { ui.lastAnswered = 0; render(); })));
    const cur = s.current;
    return h('div', { class: 'stack' }, dots, h('div', { class: 'eyebrow' }, `Duel ${cur.n}/${s.total}`), h('div', { class: 'arc-q' }, cur.q),
      h('div', { class: 'duel' }, card(cur.a, 'a'), h('span', { class: 'vs' }, 'VS'), card(cur.b, 'b')),
      h('button', { class: 'btn ghost small', onclick: () => act({ type: 'arcade:quit' }).then(render) }, 'Quit (the remaining duels count as wrong)'));
  }

  // ───────── leaderboard ─────────
  function board(v) {
    const rows = v.players.filter((p) => p.onboarded).map((p) => ({ p, b: p.arcade?.best || {}, played: p.arcade?.played || 0 }));
    const quizScore = (b) => (b.quiz ? `${Math.floor(b.quiz)}/5${b.quiz % 1 ? ' (hard)' : ''}` : '—');
    rows.sort((x, y) => (y.b.quiz || 0) - (x.b.quiz || 0) || (x.b.memory || 99) - (y.b.memory || 99) || (y.b.duel || 0) - (x.b.duel || 0));
    return h('div', { class: 'stack' },
      h('div', { class: 'table-scroll' }, h('table', { class: 'mods' },
        h('thead', {}, h('tr', {}, ['', 'Crew', '🧠 Quiz', '🃏 Memory', '⚔️ Duel', 'Games'].map((x) => h('th', {}, x)))),
        h('tbody', {}, rows.map((r, i) => h('tr', { class: r.p.id === v.you ? 'win' : '' }, h('td', {}, ['🥇', '🥈', '🥉'][i] || i + 1), h('td', {}, h('span', { class: 'row', style: { gap: '6px' } }, h('img', { src: avatarURL(r.p, 24), alt: '' }), r.p.name)), h('td', {}, quizScore(r.b)), h('td', {}, r.b.memory ? `${r.b.memory} tries` : '—'), h('td', {}, r.b.duel ? `${r.b.duel}/5` : '—'), h('td', {}, r.played)))))),
      h('button', { class: 'btn holo', onclick: () => { close(); openGlobe?.(); } }, '🌍 Explore the Earth instead'));
  }

  function close() { removeEventListener('keydown', onKey); bg.remove(); onClose?.(); }
  render();
  return { close, refresh: () => { const A = arc(); const key = JSON.stringify([A?.session, A?.net, me()?.wallet, ui.tab]); if (key !== ui.lastKey) { ui.lastKey = key; render(); } }, kind: 'arcade' };
}
