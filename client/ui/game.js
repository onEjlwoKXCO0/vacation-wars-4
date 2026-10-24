// Everything that happens aboard the spacecraft except the roulette itself:
// stage banner + timer, wishlist, the Pharaoh's couple/group tests, the 3-country
// nomination, and the explanation of the final probability shot.
import { h, replace, toast, fmtVC, fmtTime } from './dom.js';
import { COUNTRIES, countryById } from '../../shared/data/countries.js';
import { REGIONS, regionById } from '../../shared/data/regions.js';
import { avatarURL, mahmoudPortrait } from '../gfx/sprites.js';
import { createDecisionUI } from './decision.js';
import { audio } from '../audio.js';

// [step, title, what this step is — one plain sentence]
const STAGE_INFO = {
  wishlist: ['Step 1 of 6', 'Your secret wishlist', 'Pick your dream countries — they push the odds all game long.'],
  month: ['Step 2 of 6', 'Season Spin', 'The wheel that picks the MONTH we travel.'],
  region: ['Step 3 of 6', 'Region Roulette', 'The wheel that picks the PART OF THE WORLD.'],
  country: ['Step 4 of 6', 'Country Clash', 'The wheel that picks the COUNTRY inside that region.'],
  pharaoh: ['Step 5 of 6', 'The Pharaoh awakens', 'Mahmoud was hiding something…'],
  couples: ['Step 5 of 6', 'Pharaoh test 1 · Couples', 'Call your partner, then rate the chosen country.'],
  groups: ['Step 5 of 6', 'Pharaoh test 2 · Girls & boys', 'Group calls, then rate the chosen country again.'],
  nominate: ['Step 5 of 6', 'Three countries each', 'Name three countries you would rather visit.'],
  final: ['Step 6 of 6', 'The Probability Shot', 'Last spin: the chosen country against your wishlists.'],
  exit: ['Landing', 'Back to the Moon', ''],
};

export function createGameUI(root, { net, ship, getView }) {
  const layer = h('div', { class: 'ship-ui', 'data-tab': 'board' });
  root.appendChild(layer);
  const banner = h('div', { class: 'panel stage-banner' });
  const main = h('div', { class: 'stage-main' });
  const tabs = h('div', { class: 'mobile-tabs hidden' }, [['board', '📊 Odds'], ['act', '🎲 Act'], ['globe', '🌍 Globe']].map(([id, label]) => h('button', { class: 'btn small', 'data-t': id, onclick: () => { layer.dataset.tab = id; tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('solid', b.dataset.t === id)); } }, label)));
  tabs.firstChild.classList.add('solid');
  layer.append(banner, main);
  const decision = createDecisionUI(layer, { net, ship, getView, act });
  layer.appendChild(tabs);
  const ui = { wish: null, nom: null, key: '', stage: null, score: null, filter: '' };

  async function act(a, okMsg) {
    const res = await net.act(a);
    if (!res.ok) { toast(res.error, 'bad'); audio.sfx('error'); } else if (okMsg) toast(okMsg, 'good');
    return res.ok;
  }
  const player = (v, id) => v.players.find((p) => p.id === id);

  function renderBanner(v) {
    const g = v.game;
    const [step, title, what] = STAGE_INFO[g.stage] || ['', '', ''];
    const d = g.decisions[g.stage];
    const sub = d ? (d.step === 'strategy' ? `${what} ${d.fixed ? 'Last bets, then Ready.' : '★ pick · 🪙 chips · 🎲 bet · Ready'}` : d.step === 'reveal' ? 'The Earth is spinning…' : 'Result') : what;
    const left = g.stageEndsAt ? g.stageEndsAt - net.serverNow() : 0;
    replace(banner,
      h('div', {}, h('div', { class: 'eyebrow gold' }, step), h('div', { class: 'stage-title display' }, title), sub ? h('div', { class: 'muted small' }, sub) : null),
      h('span', { class: 'spacer' }),
      g.result.month !== undefined ? h('span', { class: 'chip small' }, `📅 ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(g.result.month)]}`) : null,
      g.result.region ? h('span', { class: 'chip small' }, `${regionById(g.result.region).icon} ${regionById(g.result.region).name}`) : null,
      g.result.country ? h('span', { class: 'chip small' }, `${countryById(g.result.country).flag} ${countryById(g.result.country).name}`) : null,
      h('span', { class: `timer tnum ${left < 15000 ? 'urgent' : ''}`, 'data-timer': '1' }, fmtTime(left)));
    syncTop();
  }

  // Everything below the banner starts where the banner really ends (it grows with zoom / long titles).
  function syncTop() {
    if (!banner.offsetParent) return;
    const r = banner.getBoundingClientRect(), lr = layer.getBoundingClientRect();
    const top = Math.round(r.bottom - lr.top + 8);
    if (layer.style.getPropertyValue('--ui-top') !== `${top}px`) layer.style.setProperty('--ui-top', `${top}px`);
  }
  new ResizeObserver(syncTop).observe(banner);
  addEventListener('resize', syncTop);

  // ───────── wishlist ─────────
  function renderWishlist(v) {
    const g = v.game;
    const locked = !!g.wishLocked[v.you];
    const max = v.config.wishlist.max;
    if (!ui.wish) ui.wish = new Set(g.wishes[v.you] || []);
    const doneCount = Object.keys(g.wishLocked).length;
    const list = h('div', { class: 'wish-regions' });
    const q = ui.filter.toLowerCase();
    const counter = h('b', { class: 'tnum' });
    const chosen = h('div', { class: 'chips' });
    const lockBtn = h('button', { class: 'btn solid big', onclick: () => act({ type: 'wish:lock' }, 'Wishes locked!').then((ok) => ok && audio.sfx('lock')) });
    const fill = () => {
      counter.textContent = `${ui.wish.size}/${max}`;
      lockBtn.disabled = ui.wish.size < v.config.wishlist.min;
      lockBtn.textContent = ui.wish.size ? `🔒 Lock my ${ui.wish.size} wish${ui.wish.size === 1 ? '' : 'es'}` : 'Pick at least 1 country';
      replace(chosen, [...ui.wish].map((id) => h('span', { class: 'chip gold' }, `${countryById(id).flag} ${countryById(id).name}`)));
      replace(list, REGIONS.map((r) => {
        const items = COUNTRIES.filter((c) => c.region === r.id && (!q || c.name.toLowerCase().includes(q)));
        if (!items.length) return null;
        return h('div', { class: 'wish-region' }, h('div', { class: 'eyebrow' }, `${r.icon} ${r.name}`),
          h('div', { class: 'chips' }, items.map((c) => h('button', {
            class: 'chip wish', 'aria-pressed': ui.wish.has(c.id) ? 'true' : 'false', disabled: locked || (!ui.wish.has(c.id) && ui.wish.size >= max),
            onclick: () => { ui.wish.has(c.id) ? ui.wish.delete(c.id) : ui.wish.add(c.id); audio.sfx('blip'); act({ type: 'wish:set', countryIds: [...ui.wish] }); fill(); },
          }, `${c.flag} ${c.name}`))));
      }));
    };
    // months this player can't travel: private, they simply leave the Season wheel
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (!ui.blocked) ui.blocked = new Set(g.myBlocked || []);
    const maxBlocked = v.config.wishlist.maxBlocked ?? 4;
    const blockRow = h('div', { class: 'block-months' });
    const fillBlocks = () => replace(blockRow,
      h('span', { class: 'small' }, '🚫 Months I ', h('b', {}, "can't"), ' travel ', h('span', { class: 'muted' }, `(private, max ${maxBlocked}):`)),
      MONTHS.map((m, i) => h('button', {
        class: `chip month ${ui.blocked.has(i) ? 'blocked' : ''}`, 'aria-pressed': ui.blocked.has(i) ? 'true' : 'false',
        disabled: locked || (!ui.blocked.has(i) && ui.blocked.size >= maxBlocked),
        onclick: async () => {
          const before = new Set(ui.blocked);
          ui.blocked.has(i) ? ui.blocked.delete(i) : ui.blocked.add(i);
          fillBlocks();
          const ok = await act({ type: 'months:block', months: [...ui.blocked] });
          if (!ok) { ui.blocked = before; fillBlocks(); } else audio.sfx('blip');
        },
      }, m)));
    fillBlocks();
    const search = h('input', { type: 'search', placeholder: 'Search a country…', value: ui.filter, 'aria-label': 'Search countries' });
    search.addEventListener('input', () => { ui.filter = search.value; fill(); });
    fill();
    replace(main, h('div', { class: 'panel gold stage-card wide' },
      h('div', { class: 'row dialog-row' }, portraitCanvas('happy'), h('div', { class: 'speech-bubble' }, 'Pick 1–5 dream countries — secret until everyone locks. Each wish pushes that country, its region and its comfy months, and pre-fills your picks. Can\'t travel some months? Block them below, privately.')),
      h('div', { class: 'row sticky-actions' },
        h('span', {}, 'Your wishes: ', counter), chosen, h('span', { class: 'spacer' }),
        locked ? h('span', { class: 'tag good' }, `✓ Locked — waiting for the crew (${doneCount}/${g.participants.length})`) : lockBtn,
        v.hostId === v.you ? h('button', { class: 'btn ghost small', onclick: () => act({ type: 'host:advance' }) }, 'Host: start now') : null),
      blockRow,
      search,
      list,
    ));
  }

  // ───────── Pharaoh tests ─────────
  // Score directly (no separate "call done" step), see who is on which side, and the results of each side.
  function renderTest(v) {
    const g = v.game;
    const stage = g.stage;
    const t = g.tests[stage];
    const me = player(v, v.you);
    const mate = me.couple ? player(v, me.couple) : null;
    const country = countryById(g.result.country);
    const mine = t.mine;
    const isCouples = stage === 'couples';
    const crew = g.participants.map((id) => player(v, id)).filter(Boolean);
    const status = (p) => h('span', { class: 'tag ' + (t.scored[p.id] ? 'good' : '') }, t.scored[p.id] ? '✓ rated' : '📞 calling…');
    const person = (p) => h('div', { class: `cs ${p.id === v.you ? 'me' : ''}` }, h('img', { src: avatarURL(p, 32), alt: '' }), h('span', {}, p.id === v.you ? `${p.name} (you)` : p.name), status(p));
    // sides: couples (pairs + solos) or girls vs boys
    let sides;
    if (isCouples) {
      const seen = new Set(); const units = [];
      for (const p of crew) { if (seen.has(p.id)) continue; const m = p.couple && crew.find((x) => x.id === p.couple); const members = m ? [p, m] : [p]; members.forEach((x) => seen.add(x.id)); units.push(members); }
      sides = h('div', { class: 'sides' }, units.map((u) => h('div', { class: `side-box ${u.some((p) => p.id === v.you) ? 'mine' : ''}` }, h('div', { class: 'eyebrow' }, u.length === 2 ? '💞 Couple' : '🧍 Solo'), u.map(person))));
    } else {
      const girls = crew.filter((p) => p.group === 'girls'), boys = crew.filter((p) => p.group !== 'girls');
      sides = h('div', { class: 'sides two' },
        h('div', { class: `side-box girls ${me.group === 'girls' ? 'mine' : ''}` }, h('div', { class: 'eyebrow' }, `👭 Girls' call (${girls.length})`), girls.length ? girls.map(person) : h('div', { class: 'muted small' }, 'Nobody')),
        h('div', { class: `side-box boys ${me.group !== 'girls' ? 'mine' : ''}` }, h('div', { class: 'eyebrow' }, `👬 Boys' call (${boys.length})`), boys.length ? boys.map(person) : h('div', { class: 'muted small' }, 'Nobody')));
    }
    const groupMates = crew.filter((p) => p.group === me.group && p.id !== v.you);
    const who = isCouples ? (mate ? `Call ${mate.name} on WhatsApp.` : 'No partner in this crew: take a minute (or call your partner) and decide honestly.')
      : `${me.group === 'girls' ? '👭 Girls' : '👬 Boys'} call on WhatsApp${groupMates.length ? ` with ${groupMates.map((p) => p.name).join(', ')}` : ''}.`;
    const scoreRow = h('div', { class: 'score-row' }, Array.from({ length: 10 }, (_, i) => i + 1).map((n) => h('button', {
      class: `score-btn ${mine === n ? 'sel' : ''} ${n <= 3 ? 'lo' : n >= 8 ? 'hi' : ''}`,
      onclick: () => act({ type: 'test:score', score: n }, `You gave ${n}/10.`).then((ok) => ok && audio.sfx('lock')),
    }, String(n))));
    const rated = Object.keys(t.scored).length;
    replace(main, h('div', { class: 'panel gold stage-card pharaoh-card' },
      h('div', { class: 'row dialog-row' }, portraitCanvas('pharaoh'), h('div', { class: 'speech-bubble pharaoh' }, isCouples
        ? `LOVERS FIRST. Call each other. Whisper. Argue. Then tell me, out of 10, how happy you really are with ${country.name}.`
        : `Now girls with girls, boys with boys. Group calls. Then rate ${country.name} out of 10. I can smell lies.`)),
      h('div', { class: 'row small' }, h('span', {}, `📞 ${who}`), h('a', { href: 'https://wa.me/', target: '_blank', rel: 'noopener', class: 'btn small holo' }, 'Open WhatsApp')),
      h('div', { class: 'stack' }, h('b', {}, `${country.flag} How happy ${isCouples ? 'are you two' : 'is your group'} with ${country.name}?`), scoreRow,
        h('div', { class: 'small muted' }, mine ? `You answered ${mine}/10 — tap another number to change it until everyone has rated.` : 'Tap a number once your call is done.')),
      sides,
      g.couplesAverage !== null && g.couplesAverage !== undefined ? h('div', { class: 'sat-row' }, h('div', { class: 'big-stat' }, h('b', { class: 'tnum' }, g.couplesAverage.toFixed(1)), h('span', {}, '💞 couples result'))) : null,
      h('div', { class: 'muted small' }, `${rated}/${crew.length} rated. ${isCouples ? 'Each couple counts as one (average of both partners). Scores stay secret, only averages are shown.' : 'Girls\' average and boys\' average are revealed with the final shot, together with the couples result.'} Low satisfaction gives your wishlists a bigger slice of the final wheel.`),
      v.hostId === v.you ? h('button', { class: 'btn ghost small', onclick: () => act({ type: 'host:advance' }) }, 'Host: move on') : null,
    ));
  }

  // ───────── nominate ─────────
  function renderNominate(v) {
    const g = v.game;
    const locked = !!g.nominationLocked[v.you];
    const n = v.config.final.nominationsPerPlayer;
    if (!ui.nom) ui.nom = new Set(g.myNominations || []);
    const S = g.satisfaction;
    const counter = h('b', { class: 'tnum' });
    const grid = h('div', { class: 'wish-regions' });
    const q = ui.filter.toLowerCase();
    const fill = () => {
      counter.textContent = `${ui.nom.size}/${n}`;
      replace(grid, REGIONS.map((r) => {
        const items = COUNTRIES.filter((c) => c.region === r.id && (!q || c.name.toLowerCase().includes(q)));
        if (!items.length) return null;
        return h('div', { class: 'wish-region' }, h('div', { class: 'eyebrow' }, `${r.icon} ${r.name}`), h('div', { class: 'chips' }, items.map((c) => h('button', {
          class: 'chip wish', 'aria-pressed': ui.nom.has(c.id) ? 'true' : 'false', disabled: locked || (!ui.nom.has(c.id) && ui.nom.size >= n),
          onclick: () => { ui.nom.has(c.id) ? ui.nom.delete(c.id) : ui.nom.add(c.id); audio.sfx('blip'); fill(); lockBtn.disabled = ui.nom.size !== n; },
        }, `${c.flag} ${c.name}${c.id === g.result.country ? ' (chosen)' : ''}`))));
      }));
    };
    const lockBtn = h('button', { class: 'btn bad big', disabled: ui.nom.size !== n, onclick: () => act({ type: 'nominate:set', countryIds: [...ui.nom] }, 'Your three countries are locked.').then((ok) => ok && audio.sfx('lock')) }, 'Lock my 3 countries');
    const search = h('input', { type: 'search', placeholder: 'Search a country…', value: ui.filter, 'aria-label': 'Search countries' });
    search.addEventListener('input', () => { ui.filter = search.value; fill(); });
    fill();
    const doneCount = Object.keys(g.nominationLocked).length;
    replace(main, h('div', { class: 'panel gold stage-card wide pharaoh-card' },
      h('div', { class: 'row dialog-row' }, portraitCanvas('pharaoh'), h('div', { class: 'speech-bubble pharaoh' }, `An average of ${S ? S.S.toFixed(1) : '?'} out of 10?! I AM BERSERK! Each of you: name THREE different countries you would rather visit. I count. I always count.`)),
      S ? h('div', { class: 'sat-row' },
        h('div', { class: 'big-stat' }, h('b', { class: 'tnum' }, S.couple !== null ? S.couple.toFixed(1) : '—'), h('span', {}, 'couples average')),
        h('div', { class: 'big-stat' }, h('b', { class: 'tnum' }, S.group !== null ? S.group.toFixed(1) : '—'), h('span', {}, 'groups average')),
        h('div', { class: 'big-stat gold' }, h('b', { class: 'tnum' }, S.S.toFixed(1)), h('span', {}, 'satisfaction')),
        h('div', { class: 'big-stat' }, h('b', { class: 'tnum' }, `${(90 * S.S / 10).toFixed(1)}%`), h('span', {}, `${countryById(g.result.country).flag} keeps in the final shot`))) : null,
      h('div', { class: 'small' }, `In the final shot, ${countryById(g.result.country).name} keeps 90% × satisfaction ÷ 10. The rest is shared between the countries you all nominate here — the more crewmates name a country, the bigger its slice (a wishlist match adds +10%).`),
      h('div', { class: 'row sticky-actions' }, h('span', {}, 'Your picks: ', counter), h('span', { class: 'spacer' }), locked ? h('span', { class: 'tag good' }, `✓ Locked (${doneCount}/${g.participants.length})`) : lockBtn, h('span', { class: 'muted small' }, `${doneCount}/${g.participants.length} locked`),
        v.hostId === v.you ? h('button', { class: 'btn ghost small', onclick: () => act({ type: 'host:advance' }) }, 'Host: fire the final shot') : null),
      search,
      grid,
    ));
  }


  function portraitCanvas(mood) {
    const cv = h('canvas', { class: 'pixel', width: 48, height: 48, style: { width: '84px', height: '84px', flex: 'none' } });
    cv.getContext('2d').drawImage(mahmoudPortrait(mood), 0, 0);
    return cv;
  }

  function update() {
    const v = getView();
    if (!v || !v.game) return;
    const g = v.game;
    renderBanner(v);
    if (g.stage !== ui.stage) { ui.stage = g.stage; ui.key = ''; ui.filter = ''; if (g.stage !== 'wishlist') { ui.wish = null; ui.blocked = null; } if (g.stage !== 'nominate') ui.nom = null; main.classList.remove('hidden'); }
    const intro = net.serverNow() < g.introUntil;
    root.classList.toggle('in-intro', intro);
    // decision stages use the roulette UI
    if (['month', 'region', 'country', 'final'].includes(g.stage)) {
      decision.update();
      tabs.classList.toggle('hidden', g.decisions[g.stage]?.step !== 'strategy');
      layer.classList.toggle('deciding', !!g.decisions[g.stage]);
      main.classList.add('hidden'); replace(main);
      return;
    }
    decision.hideAll();
    tabs.classList.add('hidden');
    layer.classList.toggle('deciding', ['wishlist', 'nominate', 'couples', 'groups'].includes(g.stage));
    main.classList.remove('hidden');
    const key = JSON.stringify([g.stage, g.wishLocked, g.tests, g.nominationLocked, g.satisfaction, g.couplesAverage, v.hostId]);
    if (key === ui.key) return;
    ui.key = key;
    if (g.stage === 'wishlist') renderWishlist(v);
    else if (g.stage === 'couples' || g.stage === 'groups') renderTest(v);
    else if (g.stage === 'nominate') renderNominate(v);
    else replace(main);
  }

  const timer = setInterval(() => {
    const v = getView(); const el = banner.querySelector('[data-timer]');
    if (v && v.game && el) { const left = v.game.stageEndsAt - net.serverNow(); el.textContent = fmtTime(left); el.classList.toggle('urgent', left < 15000); }
  }, 250);

  return { update, destroy() { clearInterval(timer); layer.remove(); } };
}
void fmtVC;
