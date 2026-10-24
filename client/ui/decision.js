// A roulette decision (Region, Country or the Pharaoh's final shot): live odds board,
// boosts, crew poll, secret bet, Black Market powers, role power, the synchronized wheel
// and a transparent results report.
import { h, replace, toast, fmtVC, fmtTime } from './dom.js';
import { countryById, MONTHS, COST_LABEL, DATA_NOTES } from '../../shared/data/countries.js';
import { regionById } from '../../shared/data/regions.js';
import { roleById } from '../../shared/data/roles.js';
import { POWERS } from '../../shared/data/powers.js';
import { departureById } from '../../shared/data/departures.js';
import { crewTravel, flexibility, betMultiplier } from '../../shared/rules.js';
import { avatarURL } from '../gfx/sprites.js';
import { audio } from '../audio.js';

const SPIN_START = 1000, SPIN_END = 8500;
const TITLES = { month: 'Season Spin', region: 'Region Roulette', country: 'Country Clash', final: 'The Probability Shot' };
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_ICON = ['❄️', '❄️', '🌱', '🌸', '🌼', '☀️', '🏖️', '🏖️', '🍇', '🍂', '🍁', '🎄'];
const SEASON = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter'];
/** The travel month: the Season Spin's result once decided, else the host default. */
export const tripMonth = (v) => (v.game && v.game.result.month !== undefined ? Number(v.game.result.month) : v.config.round.month);

export const optLabel = (kind, id) => (kind === 'month' ? MONTH_FULL[Number(id)] : kind === 'region' ? regionById(id)?.name : countryById(id)?.name) || id;
export const optIcon = (kind, id) => (kind === 'month' ? MONTH_ICON[Number(id)] : kind === 'region' ? regionById(id)?.icon : countryById(id)?.flag) || '•';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Casino-style odds label — the exact % stays next to it. */
export function tierOf(r, rows) {
  if (!r) return null;
  const live = rows.filter((x) => x.p > 0);
  const ratio = r.p * live.length;
  const top = live.reduce((m, x) => (x.p > m.p ? x : m), live[0]);
  if (r.unanimous) return ['jackpot', '🎰 JACKPOT'];
  if (top && r.id === top.id && ratio >= 1.5) return ['hot', '🔥 HOT'];
  if (ratio >= 1.5) return ['contender', '⭐ CONTENDER'];
  if (ratio >= 0.8) return ['mix', '⚖️ IN THE MIX'];
  if (ratio >= 0.35) return ['long', '🎯 LONG SHOT'];
  return ['cold', '🧊 COLD'];
}

/** The option the crew agrees on most (for the HYPE meter). */
export function hypeOf(d) {
  let best = null;
  for (const r of d.rows) if (!best || r.picks > best.picks || (r.picks === best.picks && r.p > best.p)) best = r;
  return { best, n: d.crewSize || 1, k: best ? best.picks : 0 };
}

export function confetti(n = 60, colors = ['#f0c35a', '#5ff2ff', '#ff4fd8', '#48e08f', '#ff7a5c', '#fff6d6']) {
  const box = h('div', { class: 'confetti-box' });
  for (let i = 0; i < n; i++) {
    const c = h('i', { style: { left: `${Math.random() * 100}%`, background: colors[i % colors.length], width: `${6 + Math.random() * 6}px`, height: `${8 + Math.random() * 10}px` } });
    box.appendChild(c);
    c.animate([{ transform: `translate(0,-10vh) rotate(0deg)`, opacity: 1 }, { transform: `translate(${(Math.random() - 0.5) * 30}vw, ${70 + Math.random() * 40}vh) rotate(${(Math.random() - 0.5) * 1440}deg)`, opacity: 0.9 }], { duration: 1800 + Math.random() * 1600, delay: Math.random() * 400, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4200);
}

export function createDecisionUI(root, { net, ship, getView, act }) {
  const board = h('div', { class: 'panel board' });
  const side = h('div', { class: 'panel side' });
  const wheelWrap = h('div', { class: 'wheel-wrap hidden' });
  const wheel = h('canvas', { width: 900, height: 900, 'aria-label': 'Probability wheel' });
  wheelWrap.appendChild(wheel);
  const overlay = h('div');
  root.append(board, side, wheelWrap, overlay);
  const ui = { selected: null, stake: 50, sideKey: '', fx: {}, revealRaf: null, lastStage: null, powerTarget: null, playerTarget: '', prev: null, open: {} };
  const wide = () => matchMedia('(min-width: 900px)').matches;
  /** A collapsible block that remembers if the player opened/closed it. */
  const fold = (id, summary, body, openDefault) => {
    const el = h('details', { class: 'fold', open: ui.open[id] ?? openDefault }, h('summary', {}, summary), ...body);
    el.addEventListener('toggle', () => { ui.open[id] = el.open; });
    return el;
  };

  const player = (v, id) => v.players.find((p) => p.id === id);

  function current(v) { const g = v.game; return g && g.decisions[g.stage] ? g.decisions[g.stage] : null; }

  function hide(all) { board.classList.toggle('hidden', all); side.classList.toggle('hidden', all); }

  // ───────── board ─────────
  function renderBoard(v, d) {
    const g = v.game;
    const crew = g.participants.map((id) => player(v, id)).filter(Boolean);
    const month = tripMonth(v);
    const wishedIds = [...new Set(Object.values(g.wishes || {}).flat())];
    const showing = d.step === 'strategy';
    board.classList.toggle('hidden', !showing);
    if (!showing) return;
    const rows = new Map(d.rows.map((r) => [r.id, r]));
    const compact = d.kind === 'month' || d.kind === 'region' || d.options.length > 8;
    board.classList.toggle('compact', compact);
    if (!ui.selected || !rows.has(ui.selected)) ui.selected = [...d.rows].sort((a, b) => b.p - a.p)[0].id;
    const participant = g.participants.includes(v.you);
    const canChip = participant && !d.fixed;
    const per = v.config.boosts.perPlayer, used = d.myBoostCount, price = v.config.boosts.price;
    const chipWeight = v.config.weights.boostWeight;
    const total = d.rows.reduce((a, r) => a + r.weight, 0);
    const addChip = (id, e) => { e.stopPropagation(); act({ type: 'boost', optionId: id }).then((ok) => { if (ok) { audio.sfx('coin'); flyChip(e.currentTarget); } }); };
    const takeChip = (id, e) => { e.stopPropagation(); act({ type: 'boost', optionId: id, count: -1 }).then((ok) => ok && audio.sfx('blip')); };
    const takeAll = async () => { for (const [id, n] of Object.entries(d.myBoosts)) for (let i = 0; i < n; i++) await act({ type: 'boost', optionId: id, count: -1 }); audio.sfx('blip'); };
    const W = v.config.weights;
    const maxPicks = d.maxPicks || W.maxPicks;
    const myPicks = (d.picks && d.picks[v.you]) || [];
    const hype = hypeOf(d);
    const blocked = d.kind === 'month' ? g.blockedMonths || [] : [];
    replace(board,
      h('header', {}, h('h3', { class: 'eyebrow' }, d.fixed ? '🏺 Final odds' : '🎰 Live odds'), h('span', { class: 'spacer' }), h('span', { class: 'muted small' }, d.fixed ? 'bets only' : 'tap a row')),
      !d.fixed ? hypeMeter(v, d, hype) : null,
      canChip ? h('div', { class: 'pick-note small' }, h('b', {}, `★ ${myPicks.length}/${maxPicks} free pick${maxPicks === 1 ? '' : 's'}`), d.prefilled && myPicks.length ? ' · pre-filled from your wishes' : ' · same as a friend = 🔥') : null,
      blocked.length ? h('div', { class: 'small muted', style: { padding: '0 14px' } }, `🚫 Off the wheel: ${blocked.map((m) => MONTH_SHORT[m]).join(', ')} (someone can't travel)`) : null,
      canChip ? h('div', { class: 'chip-tray' },
        h('div', { class: 'tray-chips' }, Array.from({ length: per }, (_, i) => h('span', { class: `tchip ${i < used ? 'used' : ''}` }))),
        h('div', { class: 'tray-txt small' }, h('b', {}, `${per - used}/${per} chips`), ` · 1 chip = ${price} VC = +${chipWeight}`, used ? ` · ${used * price} VC on the table` : ''),
        used ? h('button', { class: 'btn ghost small', onclick: takeAll }, 'Take all back') : null) : null,
      h('div', { class: 'list' }, d.options.map((o) => {
        const r = rows.get(o.id);
        const vetoed = d.vetoed[o.id];
        const voters = Object.entries(d.picks || {}).filter(([, list]) => list.includes(o.id)).map(([pid]) => player(v, pid)).filter(Boolean);
        const picked = myPicks.includes(o.id);
        const tier = !vetoed && !d.fixed ? tierOf(r, d.rows) : null;
        const fire = r && !r.unanimous && r.picks >= 2 ? Math.min(4, r.picks) : 0;
        const pickPct = r && !d.fixed ? pickPreview(v, d, r, total, picked ? -1 : 1) : 0;
        const k = d.kind === 'region' || d.kind === 'month' ? null : countryById(o.id);
        const mine = d.myBoosts[o.id] || 0;
        const chips = r ? r.boosts : 0;
        const withOne = r ? (100 * (r.weight + chipWeight * (r.malus ?? 1) * (d.doubled[o.id] ? 2 : 1))) / (total + chipWeight * (r.malus ?? 1) * (d.doubled[o.id] ? 2 : 1)) : 0;
        const travel = k ? crewTravel(crew, o.id) : null;
        return h('div', {
          class: `cand ${ui.selected === o.id ? 'sel' : ''} ${vetoed ? 'vetoed' : ''} ${fire ? `onfire fire-${fire}` : ''} ${r && r.unanimous ? 'jackpot' : ''} ${picked ? 'mine' : ''}`, role: 'button', tabindex: 0, 'data-opt': o.id,
          onclick: () => { if (vetoed) return; ui.selected = o.id; ui.sideKey = ''; ship.focus(o.id, d.kind); audio.sfx('blip'); update(); },
          onkeydown: (e) => { if (e.key === 'Enter') e.currentTarget.click(); },
        },
          h('span', { class: 'flag' }, optIcon(d.kind, o.id)),
          h('span', { class: 'name' }, optLabel(d.kind, o.id), o.leader ? h('span', { class: 'tag gold', style: { marginLeft: '6px' } }, 'CHOSEN') : null),
          h('span', { class: 'pct tnum' }, vetoed ? 'OFF' : `${r.pct.toFixed(1)}%`, tier ? h('span', { class: `tier t-${tier[0]}` }, tier[1]) : null),
          h('span', { class: 'meta' },
            k ? h('span', {}, '🌡 ', h('b', {}, `${k.temp[month]}°`), ` ${MONTHS[month]}`) : null,
            k ? h('span', {}, h('b', {}, COST_LABEL[k.cost])) : null,
            travel ? h('span', { title: `Hardest trip: ${travel.hardest.name} ${travel.hardest.hours} h` }, `✈️ ~${travel.avgHours} h`) : null,
            d.kind === 'region' ? h('span', {}, regionById(o.id).blurb) : null,
            d.kind === 'month' ? h('span', {}, SEASON[Number(o.id)]) : null,
            d.kind === 'month' && wishedIds.length ? h('span', {}, `☀️ ${wishedIds.filter((cid) => { const t = countryById(cid)?.temp[Number(o.id)]; return t >= 18 && t <= 29; }).length}/${wishedIds.length} wished countries comfy`) : null,
            d.kind === 'country' && o.malus < 1 ? h('span', { style: { color: 'var(--warn)' }, title: 'Already-visited malus: weight × (1 − 30% × share of the crew who has been there)' }, `👣 visited · malus −${Math.round((1 - o.malus) * 100)}%`) : null,
            r && r.doubled ? h('span', { style: { color: 'var(--holo)' } }, 'chips ×2') : null,
            o.wishers ? h('span', { style: { color: '#ff8fb8' } }, `♥${o.wishers}`) : null,
            o.nominations ? h('span', {}, `🗳️${o.nominations}`) : null,
            d.shields[o.id] ? h('span', { style: { color: 'var(--good)' } }, '🛡️') : null,
            r && r.unanimous ? h('span', { class: 'crowd all', title: 'Picked by the whole crew: weight ×' + W.unanimityMult }, `🎰 EVERYONE · weight ×${W.unanimityMult}`) : fire ? h('span', { class: 'crowd', title: `${r.picks} crewmates picked it: +${r.pickWeight} for the picks, +${r.crowd} crowd bonus` }, `🔥 ON FIRE · ${r.picks} picks · +${r.pickWeight + r.crowd}`) : null,
            r && r.capped ? h('span', { class: 'muted', title: 'No option can pass 85%: luck always keeps 15%.' }, '🎲 capped 85%') : null,
            voters.length ? h('span', { class: 'poll-dots' }, voters.map((p) => h('img', { src: avatarURL(p, 20), alt: p.name, title: `${p.name} picked this` }))) : null,
          ),
          !vetoed ? h('span', { class: 'chip-row' },
            h('span', { class: `stack-view ${ui.prev && ui.prev.key === prevKey(v, d) && chips > (ui.prev.chips[o.id] || 0) ? 'bump' : ''}`, title: `${chips} chip${chips === 1 ? '' : 's'} on this option (${mine} yours)` }, chips ? Array.from({ length: Math.min(chips, 10) }, (_, i) => h('span', { class: `schip ${i < mine ? 'mine' : ''}`, style: { '--i': i } })) : h('span', { class: 'muted small' }, 'no chips')),
            chips > 10 ? h('span', { class: 'small' }, `+${chips - 10}`) : null,
            h('span', { class: 'spacer' }),
            canChip ? h('button', { class: `pbtn ${picked ? 'on' : ''}`, disabled: !picked && myPicks.length >= maxPicks, title: picked ? 'Remove my pick' : `Pick it (free) → ${pickPct.toFixed(1)}%`, onclick: (e) => { e.stopPropagation(); act({ type: 'pick:toggle', optionId: o.id }).then((ok) => ok && audio.sfx(picked ? 'blip' : 'lock')); } }, picked ? (compact ? '★' : '★ picked') : compact ? `☆→${pickPct.toFixed(1)}%` : `☆ pick → ${pickPct.toFixed(1)}%`) : null,
            canChip && mine ? h('button', { class: 'cbtn minus', title: 'Take one chip back', 'aria-label': 'Take one chip back', onclick: (e) => takeChip(o.id, e) }, '−') : null,
            canChip ? h('button', { class: 'cbtn plus', disabled: used >= per || price > v.me.wallet, title: `Add a chip (${price} VC) → ${withOne.toFixed(1)}%`, 'aria-label': 'Add a chip', onclick: (e) => addChip(o.id, e) }, h('span', { class: 'tchip mini' }), compact ? `+1→${withOne.toFixed(1)}%` : `+1 → ${withOne.toFixed(1)}%`) : h('span', { class: 'mult tnum' }, `bet 100 → win ${Math.floor(100 * betMultiplier(r.p, v.config))}`),
          ) : null,
          h('span', { class: 'bar' }, h('i', { style: { width: `${vetoed ? 0 : Math.max(1, r.pct)}%` } })),
        );
      })),
    );
    celebrateChanges(v, d);
  }

  const prevKey = (v, d) => `${v.game.no}:${d.kind}:${d.draws.length}`;

  /** HYPE meter: how close the crew is to agreeing on one option. */
  function hypeMeter(v, d, { best, n, k }) {
    const W = v.config.weights;
    const pickers = best ? Object.entries(d.picks || {}).filter(([, l]) => l.includes(best.id)).map(([pid]) => player(v, pid)).filter(Boolean) : [];
    const name = best ? `${optIcon(d.kind, best.id)} ${optLabel(d.kind, best.id)}` : '';
    const text = k >= 2 && best.unanimous ? h('span', {}, h('b', { class: 'gold' }, '🎰 JACKPOT! '), `Everyone is on ${name} — weight ×${W.unanimityMult}.`)
      : k >= 2 ? h('span', {}, h('b', {}, `🔥 ${name} is ON FIRE `), `(${k}/${n}). ${n - k} more → `, h('b', { class: 'gold' }, `JACKPOT ×${W.unanimityMult}`), '.')
      : h('span', { class: 'muted' }, 'No crowd yet — pick the same as a friend to set an option ON FIRE 🔥');
    return h('div', { class: `hype ${k >= 2 && best.unanimous ? 'max' : k >= 2 ? 'hot' : ''}` },
      h('div', { class: 'hype-top' }, h('span', { class: 'hype-lbl' }, 'HYPE'),
        h('span', { class: 'hype-bar' }, Array.from({ length: n }, (_, i) => h('i', { class: i < k ? 'on' : '' }))),
        h('span', { class: 'poll-dots' }, k >= 2 ? pickers.map((p) => h('img', { src: avatarURL(p, 20), alt: p.name, title: p.name })) : null)),
      h('div', { class: 'small' }, text));
  }

  /** Sounds and fireworks when the crowd grows (not on the first render of a decision). */
  function celebrateChanges(v, d) {
    const key = prevKey(v, d);
    const now = { key, chips: Object.fromEntries(d.rows.map((r) => [r.id, r.boosts])), picks: Object.fromEntries(d.rows.map((r) => [r.id, r.picks])), jackpot: d.rows.filter((r) => r.unanimous).map((r) => r.id) };
    const prev = ui.prev;
    ui.prev = now;
    if (!prev || prev.key !== key) return;
    const newJackpot = now.jackpot.find((id) => !prev.jackpot.includes(id));
    if (newJackpot) {
      audio.sfx('jackpot'); confetti(80);
      overlay.querySelector('.jackpot-pop')?.remove();
      const pop = h('div', { class: 'jackpot-pop' }, h('div', { class: 'display' }, 'JACKPOT!'), h('div', {}, `${optIcon(d.kind, newJackpot)} Everyone picked ${optLabel(d.kind, newJackpot)} · weight ×${v.config.weights.unanimityMult}`));
      overlay.appendChild(pop); setTimeout(() => pop.remove(), 2600);
      return;
    }
    const lit = d.rows.find((r) => r.picks >= 2 && r.picks > (prev.picks[r.id] || 0));
    if (lit) {
      audio.sfx('fire');
      const el = board.querySelector(`[data-opt="${CSS.escape(lit.id)}"]`);
      if (el) { const f = h('span', { class: 'fire-pop' }, `🔥 ON FIRE ×${lit.picks}`); el.appendChild(f); setTimeout(() => f.remove(), 1400); }
    }
  }

  // ───────── side panel ─────────
  // Order = what you do most: the selected option + pick/chip → bet → Ready (sticky). Explanations fold away.
  function renderSide(v, d) {
    const g = v.game;
    const showing = d.step === 'strategy';
    side.classList.toggle('hidden', !showing);
    if (!showing) return;
    const me = v.me;
    const role = roleById(me.role);
    const key = JSON.stringify([d.step, ui.selected, me.wallet, d.myBet, d.myBoosts, d.myGolden, d.ready, d.picks, d.vetoed, d.shields, d.doubled, d.log.length, d.rows.map((r) => r.pct), d.myMods, d.roleUsed, me.usedGame, v.hostId, ui.playerTarget, d.bets ? Object.keys(d.bets).length : 0]);
    if (key === ui.sideKey) return;
    ui.sideKey = key;
    const o = d.options.find((x) => x.id === ui.selected);
    const r = d.rows.find((x) => x.id === ui.selected);
    const participant = g.participants.includes(v.you);
    const W = v.config.weights;
    const maxPicks = d.maxPicks || W.maxPicks;
    const S = [];
    const tier = !d.fixed ? tierOf(r, d.rows) : null;

    // ① the selected option + the two free/cheap levers
    const head = h('div', { class: 'row' }, h('span', { style: { fontSize: '30px' } }, optIcon(d.kind, o.id)),
      h('div', { style: { minWidth: 0 } }, h('div', { class: 'opt-title' }, optLabel(d.kind, o.id)), tier ? h('span', { class: `tier t-${tier[0]}` }, tier[1]) : null),
      h('span', { class: 'spacer' }), h('span', { class: 'big-pct tnum' }, `${r.pct.toFixed(1)}%`));
    if (participant && !d.fixed) {
      const myPicks = (d.picks && d.picks[v.you]) || [];
      const picked = myPicks.includes(o.id);
      const totalW = d.rows.reduce((a, x) => a + x.weight, 0);
      const mine = d.myBoosts[o.id] || 0;
      const left = v.config.boosts.perPlayer - d.myBoostCount;
      const preview = previewPct(d, o.id, W.boostWeight * (r.malus ?? 1) * (d.doubled[o.id] ? 2 : 1));
      const full = !picked && myPicks.length >= maxPicks;
      S.push(h('section', { class: 'quick' },
        h('div', { class: 'eyebrow gold' }, TITLES[d.kind]),
        head,
        h('div', { class: 'lever' },
          h('button', { class: `btn ${picked ? 'good' : 'holo'}`, disabled: full, onclick: () => act({ type: 'pick:toggle', optionId: o.id }).then((ok) => ok && audio.sfx(picked ? 'blip' : 'lock')) }, picked ? '★ Picked — tap to remove' : full ? `★ ${maxPicks}/${maxPicks} used` : '☆ Pick it (free)'),
          h('span', { class: 'small tnum' }, picked ? 'without my pick → ' : 'with my pick → ', h('b', { class: 'gold' }, `${pickPreview(v, d, r, totalW, picked ? -1 : 1).toFixed(1)}%`))),
        full ? h('div', { class: 'small muted' }, `You have ${maxPicks} free pick${maxPicks === 1 ? '' : 's'} on this wheel (${myPicks.map((id) => optLabel(d.kind, id)).join(', ')}). Remove one to pick ${optLabel(d.kind, o.id)}.`) : null,
        h('div', { class: 'lever' },
          h('button', { class: 'btn holo', disabled: left <= 0 || v.config.boosts.price > me.wallet, onclick: (e) => act({ type: 'boost', optionId: o.id }).then((ok) => { if (ok) { audio.sfx('coin'); flyChip(e.currentTarget); } }) }, `🪙 +1 chip (${v.config.boosts.price} VC)`),
          mine ? h('button', { class: 'btn ghost small', onclick: () => act({ type: 'boost', optionId: o.id, count: -1 }).then((ok) => ok && audio.sfx('blip')) }, `−1 (${mine} here)`) : null,
          h('span', { class: 'small tnum' }, '→ ', h('b', { class: 'gold' }, `${preview}%`))),
        h('div', { class: 'small muted' }, `${left}/${v.config.boosts.perPlayer} chips left · anonymous · refundable until the spin.`),
      ));
    } else S.push(h('section', { class: 'quick' }, h('div', { class: 'eyebrow gold' }, TITLES[d.kind]), head,
      d.fixed ? finalStory(v) : null));

    // ② bet
    if (participant) S.push(betSection(v, d, o, r));

    // ③ details & rules, folded on phones
    S.push(h('section', {}, fold(`about:${d.kind}`, `ℹ️ About ${optLabel(d.kind, o.id)}`, detailsOf(v, d, o, r), wide())));
    if (participant && !d.fixed) S.push(h('section', {}, fold('powers', '⚡ Powers — role & Hicham\'s terminal', [powersSection(v, d, o, role)], false)));
    if (!d.fixed) S.push(h('section', {}, fold('howto', '❓ How do the odds work?', [h('div', { class: 'small' },
      h('p', {}, h('b', {}, '★ Picks (free): '), `${maxPicks} on this wheel, pre-filled from your wishlist. Alone a pick is small (+${W.pickWeight}). Same pick as friends = 🔥 ON FIRE: +${W.crowdWeight} for 2, +${W.crowdWeight * 4} for 3, +${W.crowdWeight * 9} for 4. EVERYONE on it = 🎰 JACKPOT, weight ×${W.unanimityMult}.`),
      h('p', {}, h('b', {}, '🪙 Chips: '), `${v.config.boosts.price} VC = +${W.boostWeight} weight. The way to fight for something nobody else wants.`),
      h('p', {}, h('b', {}, '🎲 Bet: '), 'guess the winner, win coins. Long shots pay more.'),
      h('p', {}, h('b', {}, '🔥 HOT / ⭐ CONTENDER / ⚖️ IN THE MIX / 🎯 LONG SHOT / 🧊 COLD '), 'compare each option to a fair share. The % is the exact chance — and luck always keeps at least 15%.'))], false)));

    if (d.log.length) S.push(h('section', {}, h('h3', {}, 'Power log'), d.log.slice(-6).reverse().map((l) => h('div', { class: 'small' }, `${l.label} — ${player(v, l.by)?.name || '?'}: ${l.detail}`))));
    if (d.bets && Object.keys(d.bets).length) S.push(h('section', {}, h('h3', {}, '👁️ Bets you can see'), Object.entries(d.bets).map(([pid, b]) => h('div', { class: 'small' }, `${player(v, pid)?.name}: ${b.stake} VC on ${optIcon(d.kind, b.optionId)} ${optLabel(d.kind, b.optionId)}`))));
    if (v.hostId === v.you) S.push(h('section', {}, h('h3', {}, 'Host'), h('div', { class: 'row' }, h('button', { class: 'btn ghost small', onclick: () => act({ type: 'host:extend', seconds: 60 }) }, '+60 s'), h('button', { class: 'btn ghost small', onclick: () => act({ type: 'host:advance' }) }, 'Spin now'))));

    // ④ Ready, always visible at the bottom
    if (participant) {
      const ready = !!d.ready[v.you];
      const n = Object.keys(d.ready).length;
      S.push(h('section', { class: 'ready-sec' },
        h('button', { class: `btn ${ready ? 'good' : 'solid'} big`, onclick: () => act({ type: 'ready', ready: !ready }).then((ok) => ok && audio.sfx('lock')) }, ready ? `✓ Ready (${n}/${g.participants.length}) — tap to undo` : `I'm ready — spin! (${n}/${g.participants.length})`),
      ));
    }
    replace(side, ...S);
  }

  /** Couples / girls / boys → satisfaction → share kept by the chosen country. */
  function finalStory(v) {
    const g = v.game; const S = g.satisfaction; const c = countryById(g.result.country);
    if (!S) return null;
    const stat = (val, label, cls = '') => h('div', { class: `big-stat ${cls}` }, h('b', { class: 'tnum' }, val === null || val === undefined ? '—' : Number(val).toFixed(1)), h('span', {}, label));
    return h('div', { class: 'stack' },
      h('div', { class: 'sat-row compact' }, stat(S.couple, '💞 couples'), stat(S.groups?.girls, '👭 girls'), stat(S.groups?.boys, '👬 boys'), stat(S.S, '🏺 satisfaction /10', 'gold')),
      h('div', { class: 'small' }, `${c.flag} ${c.name} keeps `, h('b', { class: 'gold' }, `${(g.finalDist.P * 100).toFixed(1)}%`), ` (90% × ${S.S.toFixed(1)}/10). The rest goes to the countries on your wishlists — wished by more crewmates = bigger slice. Only a last secret bet now, then Ready.`));
  }

  function detailsOf(v, d, o, r) {
    const g = v.game;
    if (d.kind === 'month') {
      const m = Number(o.id);
      const wished = [...new Set(Object.values(g.wishes || {}).flat())].map(countryById).filter(Boolean);
      return [
        h('div', { class: 'muted small' }, `${SEASON[m]} (northern hemisphere)`),
        wished.length ? h('div', { class: 'stack' }, h('div', { class: 'small muted' }, 'Weather in the crew\'s wished countries that month:'),
          h('div', { class: 'chips' }, wished.map((c) => { const t = c.temp[m]; return h('span', { class: 'chip small', style: { borderColor: t >= 18 && t <= 29 ? 'var(--good)' : t > 29 ? 'var(--bad)' : '#5b8cff' } }, `${c.flag} ${c.name} ${t}°C`); }))) : null,
        h('div', { class: 'small muted' }, 'The month you win sets the temperatures shown in the Region and Country decisions. Each crewmate adds up to +10 weight: the share of their wishes that are comfy (18–29 °C) that month.'),
        weightLine(o, r),
      ];
    }
    if (d.kind === 'region') {
      const reg = regionById(o.id);
      return [
        h('div', { class: 'muted small' }, reg.blurb),
        h('div', { class: 'small muted' }, `If ${reg.name} wins, the Country Clash will be between these ${reg.members.length} countries (lit up on the globe):`),
        h('div', { class: 'chips' }, reg.members.map((cid) => h('span', { class: 'chip small' }, `${countryById(cid).flag} ${countryById(cid).name}`))),
        weightLine(o, r),
      ];
    }
    const k = countryById(o.id);
    const crew = g.participants.map((id) => player(v, id)).filter(Boolean);
    const travel = crewTravel(crew, o.id);
    const flex = flexibility(o.id);
    const meter = (label, val) => h('div', { class: 'attr' }, h('span', {}, label), h('span', { class: 'meter' }, h('i', { style: { width: `${val}%` } })), h('span', { class: 'tnum muted' }, val));
    return [
      h('div', { class: 'muted small' }, `${k.refCity} · ${regionById(k.region).name}`),
      h('div', { class: 'muted small' }, k.highlights),
      h('div', { class: 'row small' }, h('span', {}, `🌡 ${k.temp[tripMonth(v)]}°C in ${MONTHS[tripMonth(v)]}`), h('span', {}, `💶 ~€${k.dailyEUR}/day`), o.visitedBy !== undefined ? h('span', { style: { color: o.visitedBy ? 'var(--warn)' : '' } }, `👣 ${o.visitedBy}/${crew.length} visited${o.visitedBy ? ` → malus −${Math.round((1 - (o.malus ?? 1)) * 100)}%` : ''}`) : null),
      meter('Sea', k.sea), meter('Mountains', k.mountains), meter('Nightlife', k.nightlife), meter('Nature', k.nature), meter('Culture', k.culture),
      meter('Flexibility', flex.index), meter('Easy to reach', travel.avgEase),
      h('div', { class: 'travel-list' }, travel.per.map((t) => h('div', { class: 'small' }, `✈️ ${t.name} from ${departureById(t.home).city}: ~${t.hours} h${t.stops ? ` (${t.stops} stop${t.stops > 1 ? 's' : ''})` : ' direct'} · ~€${t.fare} return`))),
      h('div', { class: 'muted', style: { fontSize: '11px' } }, `Flexibility: ${flex.months} comfortable month${flex.months === 1 ? '' : 's'} (${flex.best.map((m) => MONTHS[m]).join(' ') || 'none'}). ${DATA_NOTES.travel} Scores are ${DATA_NOTES.scores}`),
      d.fixed ? null : weightLine(o, r),
    ];
  }

  function flyChip(btn) {
    const r = btn.getBoundingClientRect();
    const c = h('span', { class: 'tchip fly', style: { left: `${r.left + 8}px`, top: `${r.top + 4}px` } });
    document.body.appendChild(c);
    c.animate([{ transform: 'translate(0,0) scale(1.4)', opacity: 1 }, { transform: 'translate(-40px,-50px) scale(.6) rotate(200deg)', opacity: 0 }], { duration: 600, easing: 'ease-out' }).onfinish = () => c.remove();
  }

  function weightLine(o, r) {
    return h('div', { class: 'small' }, h('b', {}, 'Weight: '), `base ${round(o.base)}`, o.wish ? ` + wishes ${round(o.wish)}` : '', r.boostWeight ? ` + chips ${r.boostWeight}` : '', r.pickWeight ? ` + ${r.picks} pick${r.picks === 1 ? '' : 's'} ${r.pickWeight}` : '', r.crowd ? ` + crowd ${r.crowd}` : '', r.malus < 1 ? ` × visited malus ${r.malus}` : '', r.unanimous ? ` × ${getView().config.weights.unanimityMult} (JACKPOT: everyone picked it)` : '', r.capped ? ` → capped at 85% (was ${round(r.uncapped)})` : '', ` = ${round(r.weight)}`, h('span', { class: 'muted' }, ` → chance = weight ÷ total of all options (${round(d0().rows.reduce((a, x) => a + x.weight, 0))})`));
  }
  const round = (x) => Math.round(x * 10) / 10;
  const d0 = () => current(getView());

  // chance of this option if one more (or one less) crewmate picks it
  function pickPreview(v, d, r, total, delta) {
    const W = v.config.weights;
    const wOf = (k) => {
      const raw = r.base + r.wish + r.boostWeight + k * W.pickWeight + (k >= 2 ? W.crowdWeight * (k - 1) ** 2 : 0);
      return raw * (r.malus ?? 1) * (k >= 2 && k >= (d.crewSize || Infinity) ? W.unanimityMult : 1);
    };
    const next = wOf(Math.max(0, (r.picks || 0) + delta));
    return Math.min(100 * (W.maxShare || 1), (100 * next) / (total - r.weight + next));
  }

  function previewPct(d, id, add) {
    const total = d.rows.reduce((a, r) => a + r.weight, 0) + add;
    const r = d.rows.find((x) => x.id === id);
    return Math.min(100 * (getView().config.weights.maxShare || 1), (100 * (r.weight + add)) / total).toFixed(1);
  }

  function betSection(v, d, o, r) {
    const cfg = v.config.betting;
    const bet = d.myBet;
    const maxStake = Math.min(cfg.maxStake, v.me.wallet + (bet ? bet.stake : 0));
    ui.stake = Math.max(cfg.minStake, Math.min(ui.stake, maxStake));
    const mult = betMultiplier(r.p, v.config);
    const doubled = d.myMods.double || roleById(v.me.role)?.ability?.kind === 'betDouble';
    const payout = () => Math.floor(ui.stake * mult * (doubled ? 2 : 1));
    const payoutEl = h('b', { class: 'tnum', style: { color: 'var(--gold)' } }, `${fmtVC(payout())} VC`);
    const stakeVal = h('b', { class: 'tnum' }, `${ui.stake} VC`);
    const slider = h('input', { type: 'range', id: 'stake', min: cfg.minStake, max: Math.max(cfg.minStake, maxStake), step: 10, value: ui.stake, 'aria-label': 'Stake' });
    slider.addEventListener('input', () => { ui.stake = Number(slider.value); stakeVal.textContent = `${ui.stake} VC`; payoutEl.textContent = `${fmtVC(payout())} VC`; });
    return h('section', {},
      h('h3', {}, '🎲 Secret bet'),
      bet ? h('div', { class: 'betslip' }, 'Your bet: ', h('b', {}, `${bet.stake} VC on ${optIcon(d.kind, bet.optionId)} ${optLabel(d.kind, bet.optionId)}`), `. The payout is fixed from the odds when the wheel locks.`) : h('div', { class: 'muted small' }, 'Nobody can see your bet until the result (except a Hacker or a Spyglass).'),
      h('div', { class: 'row small' }, `Stake on ${optIcon(d.kind, o.id)} ${optLabel(d.kind, o.id)}`, h('span', { class: 'spacer' }), stakeVal),
      maxStake >= cfg.minStake ? slider : h('div', { class: 'muted small' }, 'Not enough VC to bet.'),
      h('div', { class: 'row small' }, `WIN → you get`, payoutEl, h('span', { class: 'muted' }, `(×${mult.toFixed(2)}${doubled ? ' ×2' : ''}) · BUST → stake lost`)),
      h('div', { class: 'row' },
        h('button', { class: 'btn solid', disabled: maxStake < cfg.minStake, onclick: () => act({ type: 'bet:place', optionId: o.id, stake: ui.stake }).then((ok) => ok && audio.sfx('coin')) }, bet ? (bet.optionId === o.id ? 'Update my bet' : 'Move my bet here') : `BET on ${optLabel(d.kind, o.id)}`),
        bet ? h('button', { class: 'btn ghost small', onclick: () => act({ type: 'bet:cancel' }) }, 'Cancel bet') : null,
      ),
      d.myMods.insurance ? h('div', { class: 'small', style: { color: 'var(--good)' } }, '☂️ Insured: a losing bet is refunded.') : null,
      doubled ? h('div', { class: 'small', style: { color: 'var(--gold)' } }, '✖️2 A winning bet pays double.') : null,
    );
  }

  function powersSection(v, d, o, role) {
    const ab = role?.ability;
    const merchant = ab?.kind === 'halfPrice';
    const crewOthers = v.game.participants.filter((id) => id !== v.you).map((id) => player(v, id)).filter(Boolean);
    const blocks = [];
    // role power
    if (ab && ab.uses !== 'passive') {
      const used = ab.uses === 'game' ? v.me.usedGame[ab.kind] : d.roleUsed;
      const needsPlayer = ab.kind === 'steal';
      const isRespin = ab.kind === 'respin';
      let control;
      if (used) control = h('span', { class: 'muted small' }, ab.uses === 'game' ? 'Used this game.' : 'Used this decision.');
      else if (isRespin) control = h('span', { class: 'muted small' }, 'Appears right after the result is drawn.');
      else if (needsPlayer) {
        const sel = h('select', { id: 'steal-target' }, h('option', { value: '' }, 'Choose a crewmate…'), crewOthers.map((p) => h('option', { value: p.id, selected: ui.playerTarget === p.id }, p.name)));
        sel.addEventListener('change', () => { ui.playerTarget = sel.value; });
        control = h('div', { class: 'row' }, sel, h('button', { class: 'btn bad small', onclick: () => { if (!ui.playerTarget) return toast('Choose a crewmate.', 'bad'); act({ type: 'role:use', targetId: ui.playerTarget }); } }, `Steal ${ab.amount} VC`));
      } else control = h('button', { class: 'btn chaos', onclick: () => act({ type: 'role:use', targetId: o.id }) }, `${role.icon} ${role.power} → ${optLabel(d.kind, o.id)}`);
      blocks.push(h('div', { class: 'stack' }, h('b', {}, `${role.icon} Your role: ${role.name}`), h('div', { class: 'small muted' }, role.detail), control));
    } else if (role) blocks.push(h('div', { class: 'small' }, h('b', {}, `${role.icon} ${role.name}: `), role.power, ' (always on).'));
    // black market terminal
    blocks.push(h('div', { class: 'stack' }, h('b', {}, '🕶️ Hicham\'s terminal — powers act instantly'), h('div', { class: 'small muted' }, `Pay once, the effect happens right now. Powers that need a target act on the option you selected: ${optIcon(d.kind, o.id)} ${optLabel(d.kind, o.id)}.${merchant ? ' Merchant: half price.' : ''}`),
      h('div', { class: 'power-grid explained' }, POWERS.filter((p) => p.window === 'strategy').map((p) => {
        const price = merchant ? Math.ceil(p.price / 2) : p.price;
        const active = (p.id === 'spyglass' && d.myMods.spy) || (p.id === 'double_down' && d.myMods.double) || (p.id === 'insurance' && d.myMods.insurance);
        return h('button', { class: 'power', style: { '--pc': p.color }, disabled: price > v.me.wallet || active, title: p.text,
          onclick: () => act({ type: 'power:buy', powerId: p.id, targetId: o.id }).then((ok) => ok && audio.sfx('chaos')) },
        h('span', { class: 'pi' }, p.icon), h('span', { class: 'pn' }, p.name), h('span', { class: 'pp tnum' }, active ? 'ACTIVE' : `${price} VC`), h('span', { class: 'pt small' }, p.text));
      }))));
    return h('div', { class: 'stack' }, ...blocks);
  }

  // ───────── wheel & results ─────────
  const ticker = h('div', { class: 'slot-ticker hidden' });
  wheelWrap.appendChild(ticker);
  function slotTicker(d, progress, t) {
    const e = 1 - Math.pow(1 - Math.min(1, Math.max(0, progress)), 4);
    const rot = (-d.draw.u * Math.PI * 2 - Math.PI * 2 * 6) * e;
    const at = ((-rot / (Math.PI * 2)) % 1 + 1) % 1;
    const c = progress >= 1 ? d.rows.find((r) => r.id === d.draw.winner) : d.rows.find((r) => at >= r.lo && at < r.hi) || d.rows[0];
    ticker.classList.toggle('hidden', t < SPIN_START - 200);
    ticker.classList.toggle('done', progress >= 1);
    if (ticker.dataset.id !== c.id) {
      ticker.dataset.id = c.id;
      replace(ticker, h('span', { class: 'st-icon' }, optIcon(d.kind, c.id)), h('span', { class: 'st-name' }, optLabel(d.kind, c.id)), h('span', { class: 'st-pct tnum' }, `${c.pct.toFixed(1)}%`));
      if (progress < 1) audio.sfx('tick');
    }
  }

  function drawWheel(v, d, progress, t) {
    const g = wheel.getContext('2d');
    const S = wheel.width, cx = S / 2, cy = S / 2, R = S * 0.38;
    g.clearRect(0, 0, S, S);
    const rows = d.rows;
    const u = d.draw.u;
    const finalRot = -u * Math.PI * 2 - Math.PI * 2 * 6;
    const e = 1 - Math.pow(1 - Math.min(1, Math.max(0, progress)), 4);
    const rot = finalRot * e;
    const appear = Math.min(1, t / 700);
    g.save(); g.globalAlpha = appear; g.translate(cx, cy);
    const og = g.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.25); og.addColorStop(0, d.kind === 'final' ? 'rgba(240,195,90,.35)' : 'rgba(95,242,255,.25)'); og.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = og; g.beginPath(); g.arc(0, 0, R * 1.25, 0, Math.PI * 2); g.fill();
    g.rotate(rot - Math.PI / 2);
    const cols = ['#2a9df4', '#f0c35a', '#ff4fd8', '#48e08f', '#ff7a5c', '#9b8cff', '#5ff2ff', '#ffd36b', '#e54b4b', '#38a87a', '#c77dff', '#ff9f43'];
    rows.forEach((c, i) => {
      const a0 = c.lo * Math.PI * 2, a1 = c.hi * Math.PI * 2;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a1); g.closePath();
      const won = progress >= 1 && c.id === d.draw.winner;
      g.fillStyle = cols[i % cols.length] + (won ? 'ff' : 'b8'); g.fill();
      g.strokeStyle = 'rgba(5,8,20,.9)'; g.lineWidth = 3; g.stroke();
      const mid = (a0 + a1) / 2;
      if (c.p > 0.025) {
        g.save(); g.rotate(mid); g.translate(R * 0.68, 0); g.rotate(Math.PI / 2);
        g.fillStyle = '#05060d'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `${c.p > 0.07 ? 30 : 20}px serif`; g.fillText(optIcon(d.kind, c.id), 0, -16);
        if (c.p > 0.06) { g.font = '700 21px Orbitron, sans-serif'; g.fillText(`${c.pct.toFixed(1)}%`, 0, 16); }
        g.restore();
      }
    });
    g.beginPath(); g.arc(0, 0, R * 0.2, 0, Math.PI * 2); g.fillStyle = '#0b1024'; g.fill(); g.strokeStyle = '#f0c35a'; g.lineWidth = 4; g.stroke();
    g.restore();
    g.save(); g.translate(cx, cy); g.globalAlpha = appear;
    g.strokeStyle = 'rgba(240,195,90,.85)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R + 8, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; g.fillStyle = (Math.floor(t / 90) + i) % 6 === 0 ? '#fff6d6' : 'rgba(240,195,90,.35)'; g.beginPath(); g.arc(Math.cos(a) * (R + 22), Math.sin(a) * (R + 22), 4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#fff6d6'; g.strokeStyle = '#b8862b'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, -R + 26); g.lineTo(-18, -R - 30); g.lineTo(18, -R - 30); g.closePath(); g.fill(); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f0c35a';
    if (progress >= 1) { g.font = '54px serif'; g.fillText(optIcon(d.kind, d.draw.winner), 0, 4); }
    else { g.font = '40px serif'; g.fillText('★', 0, 2); }
    g.restore();
    const pointerAt = ((-rot / (Math.PI * 2)) % 1 + 1) % 1;
    const seg = rows.findIndex((c) => pointerAt >= c.lo && pointerAt < c.hi);
    if (seg !== ui.lastSeg && progress < 1) { ui.lastSeg = seg; audio.sfx('tick'); }
  }

  function revealLoop() {
    const v = getView();
    const d = v && current(v);
    if (!d || d.step !== 'reveal' || !d.draw) { wheelWrap.classList.add('hidden'); ticker.classList.add('hidden'); delete ticker.dataset.id; ui.revealRaf = null; return; }
    const t = net.serverNow() - d.revealStartAt;
    if (t < 0) { ui.revealRaf = requestAnimationFrame(revealLoop); return; }
    wheelWrap.classList.remove('hidden');
    const key = `${v.game.no}:${d.kind}:${d.draws.length}`;
    if (!ui.fx[key + 's']) {
      ui.fx[key + 's'] = 1;
      overlay.querySelector('#winner-banner')?.remove();
      wheel.style.transform = ''; wheel.style.opacity = '';
      if (t < SPIN_START + 500) audio.sfx('drumroll');
      ship.revealSpin(d.draw.winner, Math.max(300, SPIN_END - t), d.kind);
    }
    const progress = (t - SPIN_START) / (SPIN_END - SPIN_START);
    if (d.kind === 'month') { wheel.classList.remove('hidden'); ticker.classList.add('hidden'); drawWheel(v, d, progress, t); }
    else { wheel.classList.add('hidden'); slotTicker(d, progress, t); } // the spinning Earth is the show; a slot counter names who is under the beam
    if (progress >= 1 && !ui.fx[key + 'l']) {
      ui.fx[key + 'l'] = 1;
      if (t < SPIN_END + 1500) { audio.sfx('boom'); overlay.appendChild(h('div', { class: 'flash' })); setTimeout(() => overlay.querySelector('.flash')?.remove(), 1000); }
      ship.celebrate(d.draw.winner, d.kind);
      const r = d.rows.find((x) => x.id === d.draw.winner);
      // personal casino verdict: your bet and your picks
      const bet = d.myBet;
      const myPicks = (d.picks && d.picks[v.you]) || [];
      const won = bet && bet.optionId === r.id;
      const payout = won ? Math.floor(bet.stake * (bet.multiplier || r.multiplier || 1) * (d.myMods.double || roleById(v.me.role)?.ability?.kind === 'betDouble' ? 2 : 1)) : 0;
      const verdict = bet ? (won ? h('div', { class: 'verdict win' }, `💰 WIN! +${fmtVC(payout - bet.stake)} VC`) : h('div', { class: 'verdict bust' }, d.myMods.insurance ? '☂️ BUST — insured, stake back' : `💥 BUST −${fmtVC(bet.stake)} VC`)) : null;
      const tag = r.unanimous ? '🎰 JACKPOT PAID OUT' : r.pct < 10 ? '😱 UPSET!' : r.pct >= 40 ? '🔥 The favourite delivers' : null;
      overlay.appendChild(h('div', { class: 'winner-banner', id: 'winner-banner' },
        h('div', { class: 'eyebrow gold' }, d.kind === 'final' ? 'The Pharaoh\'s verdict' : 'The cosmos has spoken'),
        h('div', {}, h('span', { style: { fontSize: 'clamp(36px, 7vw, 86px)' } }, optIcon(d.kind, r.id)), ' ', h('span', { class: 'display' }, optLabel(d.kind, r.id).toUpperCase())),
        h('div', { class: 'muted', style: { fontFamily: 'var(--f-hud)', marginTop: '8px' } }, `It had a ${r.pct.toFixed(1)}% chance to win`),
        tag ? h('div', { class: 'verdict tag' }, tag) : null,
        myPicks.includes(r.id) ? h('div', { class: 'verdict pick' }, '★ Your pick won!') : null,
        verdict));
      if (t < SPIN_END + 2500) {
        setTimeout(() => audio.sfx(won ? 'win' : bet ? 'bust' : r.unanimous ? 'jackpot' : 'coin'), 700);
        if (won || r.unanimous || myPicks.includes(r.id)) setTimeout(() => confetti(won || r.unanimous ? 90 : 40), 300);
      }
      if (d.kind === 'month') { wheel.style.transition = 'transform 1.2s, opacity 1.2s'; setTimeout(() => { wheel.style.transform = 'scale(.55) translateY(40%)'; wheel.style.opacity = '.35'; }, 1700); }
      else setTimeout(() => ticker.classList.add('hidden'), 1200);
    }
    ui.revealRaf = requestAnimationFrame(revealLoop);
  }

  function renderResults(v, d) {
    const scroller = overlay.querySelector('.results');
    const rkey = JSON.stringify([v.game.no, d.kind, d.step, d.draws.length, d.settlements, d.respinUsed, d.boostsByPlayer, v.hostId, v.me.wallet, v.me.usedGame]);
    if (scroller && d.step === 'results' && scroller.dataset.key === rkey) return;
    const keep = scroller ? scroller.scrollTop : 0;
    scroller?.remove();
    if (d.step !== 'results') return;
    overlay.querySelector('#winner-banner')?.remove();
    wheelWrap.classList.add('hidden');
    const W = v.config.weights;
    const w = d.rows.find((r) => r.id === d.draw.winner);
    const mine = d.settlements?.[v.you];
    const rows = [...d.rows].sort((a, b) => b.p - a.p);
    const role = roleById(v.me.role);
    const canRespin = !d.fixed && !d.respinUsed;
    const myRespin = canRespin && role?.ability?.kind === 'respin' && !v.me.usedGame.respin;
    const merchant = role?.ability?.kind === 'halfPrice';
    const tlPrice = merchant ? 175 : 350;
    const nextLabel = d.kind === 'month' ? 'Region Roulette' : d.kind === 'region' ? 'Country Clash' : d.kind === 'country' ? 'the Pharaoh…' : 'back to the Moon';
    const verdict = w.unanimous ? '🎰 Jackpot paid out — the whole crew wanted it.' : w.pct >= 40 ? '🔥 The favourite delivered.' : w.pct >= 15 ? '⭐ A solid contender.' : w.pct >= 6 ? '🎯 A long shot — surprise!' : '😱 Huge upset!';
    const top = rows.slice(0, 5);
    const lbl = (id) => `${optIcon(d.kind, id)} ${optLabel(d.kind, id)}`;
    const card = h('div', { class: 'panel gold results' },
      h('div', { class: 'row' }, h('div', {}, h('div', { class: 'eyebrow gold' }, TITLES[d.kind]), h('h2', { style: { fontSize: '32px' } }, h('span', {}, optIcon(d.kind, w.id)), ' ', h('span', { class: 'display' }, optLabel(d.kind, w.id)))), h('span', { class: 'spacer' }),
        h('div', { style: { textAlign: 'right' } }, h('div', { class: 'tnum', style: { fontFamily: 'var(--f-hud)', color: 'var(--gold)', fontSize: '22px' } }, `${w.pct.toFixed(1)}%`), h('div', { class: 'muted small' }, 'chance it had'))),
      h('p', { style: { margin: 0, fontSize: '16px' } }, verdict, d.draws.length > 1 ? ` (After a re-spin — the first spin had landed on ${optLabel(d.kind, d.draws[0].winner)}.)` : ''),
      mine ? h('div', { class: `betslip ${mine.won ? 'win' : 'bust'}` }, mine.won ? `💰 WIN — your bet on ${optLabel(d.kind, mine.bet.optionId)} pays ${fmtVC(mine.payout)} VC${mine.double ? ' (doubled)' : ''}.` : mine.insured ? `☂️ Your bet lost but Insurance returns your ${mine.bet.stake} VC.` : `💥 BUST — your ${mine.bet.stake} VC bet on ${optLabel(d.kind, mine.bet.optionId)} lost.`) : null,
      h('h3', { class: 'res-h' }, '👥 What the crew did'),
      h('div', { class: 'crew-sum' }, v.game.participants.map((id) => {
        const p = player(v, id); const s = d.settlements?.[id]; const bm = d.boostsByPlayer?.[id] || {}; const pk = (d.picks || {})[id] || [];
        const chips = Object.entries(bm).filter(([, n]) => n).map(([oid, n]) => `${optIcon(d.kind, oid)}×${n}`).join(' ');
        return h('div', { class: `cs-row ${pk.includes(w.id) ? 'hit' : ''} ${id === v.you ? 'me' : ''}` },
          h('img', { src: avatarURL(p, 32), alt: '' }),
          h('div', { class: 'cs-main' }, h('b', {}, id === v.you ? `${p?.name || '?'} (you)` : p?.name || '?'),
            h('div', { class: 'small muted' }, d.fixed ? '' : `★ ${pk.length ? pk.map((x) => optIcon(d.kind, x)).join(' ') : '—'}`, chips ? ` · 🪙 ${chips}` : '', s ? ` · 🎲 ${s.bet.stake} on ${optIcon(d.kind, s.bet.optionId)}` : '')),
          (() => { // what this wheel cost or paid: bet result minus the chips spent
            const spent = Object.values(bm).reduce((x, n) => x + n, 0) * v.config.boosts.price;
            const net = (s ? s.profit : 0) - spent;
            return h('span', { class: `cs-res tnum ${net > 0 ? 'win' : net < 0 ? 'bust' : ''}`, title: `${s ? `bet ${s.won ? '+' + s.profit : s.insured ? '±0' : '−' + s.bet.stake}` : 'no bet'}${spent ? ` · chips −${spent}` : ''}` },
              h('b', {}, `${net > 0 ? '+' : net < 0 ? '−' : '±'}${fmtVC(Math.abs(net))} VC`), h('small', { class: 'muted' }, s ? (s.won ? ' bet won' : ' bet lost') : spent ? ' chips' : ' free'));
          })());
      })),
      h('h3', { class: 'res-h' }, d.fixed ? '🎲 The final odds' : '📊 The odds before the spin'),
      h('div', { class: 'odds-sum' }, top.map((c) => h('div', { class: `os-row ${c.id === w.id ? 'win' : ''}` }, h('span', {}, lbl(c.id)),
        h('span', { class: 'small muted' }, d.fixed ? ((d.options.find((x) => x.id === c.id) || {}).leader ? 'chosen country' : 'from your wishlists') : [c.picks ? `${c.unanimous ? '🎰' : c.picks >= 2 ? '🔥' : '★'}${c.picks}` : '', c.boosts ? ` 🪙${c.boosts}` : '', c.wish ? ` ♥${round(c.wish / W.wishWeight)}` : ''].join('')),
        h('span', { class: 'tnum' }, `${c.pct.toFixed(1)}%`))),
        rows.length > top.length ? h('div', { class: 'small muted' }, `+ ${rows.length - top.length} more option${rows.length - top.length === 1 ? '' : 's'} sharing ${rows.slice(5).reduce((a, c) => a + c.pct, 0).toFixed(1)}%`) : null),
      Object.keys(d.vetoed).length ? h('div', { class: 'small' }, `🚫 Vetoed: ${Object.keys(d.vetoed).map((id) => optLabel(d.kind, id)).join(', ')}`) : null,
      canRespin ? h('div', { class: 'small muted' }, `⏳ Time Loop = pay ${tlPrice} VC to spin this wheel ONE more time, same odds (once per wheel, anyone can buy it before the next step starts).`) : null,
      h('div', { class: 'row res-actions' },
        myRespin ? h('button', { class: 'btn chaos big', onclick: () => act({ type: 'role:use' }) }, '🌀 Chaos re-spin!') : null,
        canRespin ? h('button', { class: 'btn chaos', disabled: tlPrice > v.me.wallet, onclick: () => act({ type: 'power:buy', powerId: 'time_loop' }) }, `⏳ Re-spin · Time Loop (${tlPrice} VC)`) : null,
        v.hostId === v.you ? h('button', { class: 'btn ghost', onclick: () => act({ type: 'host:advance' }) }, 'Continue now') : null,
        h('span', { class: 'muted small', 'data-countdown': '1' }, `Next: ${nextLabel} in ${fmtTime(v.game.stageEndsAt - net.serverNow())}`),
      ),
    );
    card.dataset.key = rkey;
    overlay.appendChild(card);
    card.scrollTop = keep;
  }

  // Never rebuild the table under a finger: live odds wait until the press is released,
  // so a tap on a chip button is never lost when someone else moves the odds.
  for (const el of [board, side]) el.addEventListener('pointerdown', () => { ui.holding = true; }, true);
  const release = () => { if (!ui.holding) return; ui.holding = false; if (ui.pending) { ui.pending = false; setTimeout(update, 0); } };
  addEventListener('pointerup', release, true); addEventListener('pointercancel', release, true);

  function update() {
    const v = getView();
    const d = v && current(v);
    if (d && d.step === 'strategy' && `${v.game.no}:${d.kind}` !== ui.selKind) { ui.selKind = `${v.game.no}:${d.kind}`; ui.selected = null; }
    if (ui.holding && d && d.step === 'strategy' && `${v.game.no}:${d.kind}:${d.step}:${d.draws.length}` === ui.lastStage) { ui.pending = true; return; }
    if (!d) { hide(true); overlay.querySelector('.results')?.remove(); return; }
    renderBoard(v, d);
    renderSide(v, d);
    if (d.step !== 'reveal') ship.setCandidates(d.rows, d.kind, { winner: d.step === 'results' ? d.draw?.winner : ui.selected, vetoed: d.vetoed });
    const stageKey = `${v.game.no}:${d.kind}:${d.step}:${d.draws.length}`;
    if (stageKey !== ui.lastStage) {
      if (d.step === 'strategy' && ui.selected) ship.focus(ui.selected, d.kind);
      if (d.step === 'reveal') { ship.setCandidates(d.rows, d.kind, { vetoed: d.vetoed }); if (!ui.revealRaf) ui.revealRaf = requestAnimationFrame(revealLoop); }
      if (d.step === 'results') ship.focus(d.draw.winner, d.kind);
      ui.lastStage = stageKey; ui.sideKey = '';
    }
    if (d.step === 'reveal' && !ui.revealRaf) ui.revealRaf = requestAnimationFrame(revealLoop);
    renderResults(v, d);
  }

  // live countdown inside the results card
  setInterval(() => { const v = getView(); const el = overlay.querySelector('[data-countdown]'); if (v && v.game && el) el.textContent = el.textContent.replace(/in .*$/, `in ${fmtTime(v.game.stageEndsAt - net.serverNow())}`); }, 500);

  return { update, hideAll() { hide(true); wheelWrap.classList.add('hidden'); overlay.querySelector('.results')?.remove(); overlay.querySelector('#winner-banner')?.remove(); } };
}
