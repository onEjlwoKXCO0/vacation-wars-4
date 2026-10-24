// Mahmoud's 1-minute briefing: 7 short cards (~9 s each, auto-advance, skippable) so everybody
// understands the game before boarding. Card 5 is a tiny playground to feel ON FIRE / JACKPOT.
import { h, replace } from './dom.js';
import { mahmoudPortrait } from '../gfx/sprites.js';
import { audio } from '../audio.js';

const CARD_MS = 9000;

const CARDS = [
  {
    title: 'Welcome to Vacation Wars',
    say: 'Legends! This game decides our holiday — WHEN we fly, WHERE in the world, and which COUNTRY. Six steps. Zero real money. Maximum drama.',
    visual: () => h('div', { class: 'tut-steps' }, [['✨', 'Wishlist'], ['📅', 'Season Spin', 'the month'], ['🌍', 'Region Roulette', 'part of the world'], ['🎯', 'Country Clash', 'the country'], ['🏺', 'Pharaoh test', 'rate it'], ['🎲', 'Final shot']].map(([i, t, s], k) => h('div', { class: 'tut-step', style: { '--k': k } }, h('span', { class: 'ti' }, i), h('b', {}, t), s ? h('small', {}, s) : null))),
  },
  {
    title: 'Before take-off',
    say: 'On the Moon: visit your embassy, then the Role Market — it is MANDATORY, your role is your superpower for the whole game. Then board my spacecraft. Waiting for the others? Alessandro\'s arcade in the Control Tower pays a few coins.',
    visual: () => h('div', { class: 'tut-row' }, [['🏛️', 'Embassy'], ['🎭', 'Role Market', 'mandatory'], ['🕹️', 'Arcade', 'optional'], ['🚀', 'Board']].map(([i, t, s]) => h('div', { class: 'tut-tile' }, h('span', { class: 'ti' }, i), h('b', {}, t), s ? h('small', { class: 'gold' }, s) : null))),
  },
  {
    title: 'Your secret wishlist',
    say: 'Aboard, whisper me 1 to 5 dream countries. Nobody sees them. Each wish pushes that country, its region and its best months — and pre-fills your picks. Busy in some months? Block them.',
    visual: () => h('div', { class: 'tut-row wrap' }, h('span', { class: 'chip gold' }, '🇹🇭 Thailand'), h('span', { class: 'chip gold' }, '🇯🇵 Japan'), h('span', { class: 'chip gold' }, '🇵🇹 Portugal'), h('span', { class: 'chip month blocked' }, 'Jan'), h('span', { class: 'chip month blocked' }, 'Feb')),
  },
  {
    title: 'The wheels',
    say: 'Three wheels: the MONTH, the REGION, the COUNTRY. Every option shows its exact chance. HOT means favourite, COLD means almost dead. Luck always keeps 15%.',
    visual: () => h('div', { class: 'tut-odds' }, [['🏖️ August', 46.5, 'hot', '🔥 HOT'], ['🍇 September', 19.9, 'mix', '⚖️ IN THE MIX'], ['🌸 April', 6.2, 'long', '🎯 LONG SHOT'], ['❄️ January', 1.4, 'cold', '🧊 COLD']].map(([n, p, c, l]) => h('div', { class: 'tut-odd' }, h('span', {}, n), h('span', { class: 'bar' }, h('i', { style: { width: `${p * 2}%` } })), h('b', { class: 'tnum' }, `${p}%`), h('span', { class: `tier t-${c}` }, l)))),
  },
  {
    title: 'Push the odds',
    say: '★ PICKS are free. Alone, small. Same pick as a friend: ON FIRE! The whole crew on it: JACKPOT, weight ×2.5. Chips cost coins and push what YOU want. Try it — tap the friends!',
    visual: () => playground(),
    long: true,
  },
  {
    title: 'Bet, then Ready',
    say: 'Place a secret bet on who will win: WIN pays more on long shots, BUST loses the stake. Powers from Hicham\'s terminal can veto or shield. Everyone presses Ready… and the Earth spins.',
    visual: () => h('div', { class: 'tut-row' }, h('div', { class: 'tut-tile' }, h('span', { class: 'ti' }, '🎲'), h('b', {}, 'Bet 100'), h('small', { class: 'good' }, 'WIN +333')), h('div', { class: 'tut-tile' }, h('span', { class: 'ti' }, '💥'), h('b', {}, 'or BUST'), h('small', { class: 'bad' }, '−100')), h('div', { class: 'tut-tile' }, h('span', { class: 'ti' }, '✅'), h('b', {}, 'Ready'), h('small', {}, 'spin!'))),
  },
  {
    title: 'And then… the Pharaoh',
    say: 'When the country is chosen, I may… change. Couples call, then girls and boys call, and rate it out of 10. A low score gives your wishlists a bigger slice of my final wheel. Coins left? The Black Market buys real holiday privileges.',
    visual: () => h('div', { class: 'tut-row' }, h('div', { class: 'tut-tile' }, h('span', { class: 'ti' }, '💞'), h('b', {}, 'Couples')), h('div', { class: 'tut-tile' }, h('span', { class: 'ti' }, '👭👬'), h('b', {}, 'Girls & boys')), h('div', { class: 'tut-tile' }, h('span', { class: 'ti' }, '🏺'), h('b', {}, '/10')), h('div', { class: 'tut-tile' }, h('span', { class: 'ti' }, '🕶️'), h('b', {}, 'Black Market'))),
  },
];

/** Card 5: tap 4 friends onto "August" and watch it catch fire. */
function playground() {
  const on = new Set();
  const wrap = h('div', { class: 'tut-play' });
  const draw = () => {
    const k = on.size;
    const w = 12.5 + 12 * k + (k >= 2 ? 25 * (k - 1) ** 2 : 0);
    const weight = k === 4 ? w * 2.5 : w;
    const pct = Math.min(85, (100 * weight) / (weight + 137.5));
    const label = k === 4 ? '🎰 JACKPOT ×2.5' : k >= 2 ? `🔥 ON FIRE · ${k} picks` : k === 1 ? '★ 1 pick' : 'no picks yet';
    replace(wrap,
      h('div', { class: `cand tut-cand ${k === 4 ? 'jackpot' : k >= 2 ? `onfire fire-${k}` : ''}` }, h('span', { class: 'flag' }, '🏖️'), h('span', { class: 'name' }, 'August'), h('span', { class: 'pct tnum' }, `${pct.toFixed(1)}%`), h('span', { class: 'meta' }, h('span', { class: 'crowd' }, label))),
      h('div', { class: 'tut-friends' }, ['You', 'Ana', 'Kuba', 'Yass'].map((n) => h('button', { class: `btn small ${on.has(n) ? 'good' : 'holo'}`, onclick: () => { on.has(n) ? on.delete(n) : on.add(n); audio.sfx(on.size === 4 ? 'jackpot' : on.size >= 2 && on.has(n) ? 'fire' : 'blip'); draw(); } }, `${on.has(n) ? '★' : '☆'} ${n}`))));
  };
  draw();
  return wrap;
}

export function openTutorial(root, { onDone } = {}) {
  let i = 0, timer = null, start = 0, paused = false;
  const portrait = h('canvas', { class: 'pixel', width: 48, height: 48 });
  portrait.getContext('2d').drawImage(mahmoudPortrait('happy'), 0, 0);
  const title = h('h2', { class: 'display' });
  const say = h('div', { class: 'speech-bubble' });
  const visual = h('div', { class: 'tut-visual' });
  const dots = h('div', { class: 'tut-dots' });
  const bar = h('i');
  const back = h('button', { class: 'btn ghost small', onclick: () => go(i - 1) }, '← Back');
  const next = h('button', { class: 'btn solid', onclick: () => go(i + 1) });
  const bg = h('div', { class: 'modal-bg tut-bg' }, h('div', { class: 'panel gold modal tut' },
    h('header', {}, h('div', {}, h('div', { class: 'eyebrow gold' }, "Mahmoud's 1-minute briefing"), title), h('button', { class: 'btn ghost small close', onclick: () => finish() }, 'Skip ✕')),
    h('div', { class: 'body' },
      h('div', { class: 'row dialog-row' }, portrait, say),
      visual,
      h('div', { class: 'tut-progress' }, bar),
      h('div', { class: 'row' }, back, dots, h('span', { class: 'spacer' }), next))));
  bg.addEventListener('pointerdown', () => { paused = true; }, { once: false });
  root.appendChild(bg);
  const onKey = (e) => { if (e.key === 'ArrowRight' || e.key === 'Enter') go(i + 1); else if (e.key === 'ArrowLeft') go(i - 1); else if (e.key === 'Escape') finish(); };
  addEventListener('keydown', onKey);

  function go(n) {
    if (n >= CARDS.length) return finish();
    i = Math.max(0, n);
    const c = CARDS[i];
    title.textContent = c.title;
    say.textContent = c.say;
    replace(visual, c.visual());
    replace(dots, CARDS.map((_, k) => h('span', { class: k === i ? 'on' : k < i ? 'done' : '' })));
    back.disabled = i === 0;
    next.textContent = i === CARDS.length - 1 ? "Got it — let's play!" : 'Next →';
    start = performance.now(); paused = false;
    audio.sfx('open');
  }
  function tick() {
    const c = CARDS[i];
    const dur = c.long ? CARD_MS * 1.6 : CARD_MS;
    if (paused) start += 100; // touching the briefing pauses the auto-advance
    const p = Math.min(1, (performance.now() - start) / dur);
    bar.style.width = `${p * 100}%`;
    if (p >= 1 && i < CARDS.length - 1) go(i + 1);
  }
  function finish() {
    clearInterval(timer); removeEventListener('keydown', onKey); bg.remove();
    try { localStorage.setItem('vw4.tutorialSeen', 'true'); } catch {}
    onDone?.();
  }
  go(0);
  timer = setInterval(tick, 100);
  return { close: finish };
}

export function tutorialSeen() { try { return localStorage.getItem('vw4.tutorialSeen') === 'true'; } catch { return false; } }
