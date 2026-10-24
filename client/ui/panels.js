// Building interiors and menus on the Moon: Role Market, ambassador, embassy travel board,
// Mahmoud's Control Centre (rules + host controls), boarding ramp, Black Market (lobby
// preview), Mahmoud & Baby Mahmoud talks, passport & wallet.
import { h, replace, toast, fmtVC } from './dom.js';
import { ROLES, roleById } from '../../shared/data/roles.js';
import { POWERS } from '../../shared/data/powers.js';
import { MARKET_ITEMS } from '../../shared/data/market.js';
import { MONTHS, countryById } from '../../shared/data/countries.js';
import { regionById } from '../../shared/data/regions.js';
import { nationById } from '../../shared/data/nations.js';
import { departureById } from '../../shared/data/departures.js';
import { ambassadorText, BABY_LINES, MAHMOUD_LINES } from '../../shared/data/dialogue.js';
import { characterSheet, drawCharacter, avatarURL, mahmoudPortrait } from '../gfx/sprites.js';
import { worldName, statsBlock } from './worldmap.js';
import { rulesBlock } from './rules.js';
import { audio } from '../audio.js';

const LANG_NOTE = { portugal: 'Português', macedonia: 'Македонски', poland: 'Français (pour nos amis polonais)', morocco: 'Français' };
const ENGLISH = {
  own: 'Welcome to your embassy! Look around — your bedroom is upstairs. After the visit, go to the Role Market to choose your role. Then Mahmoud\'s spacecraft is waiting.',
};

function spriteCanvas(spec, scale = 3, dir = 'down') {
  const sheet = characterSheet(spec);
  const cv = h('canvas', { class: 'pixel', width: sheet.fw * scale, height: sheet.fh * scale });
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  drawCharacter(g, sheet, dir, 0, (sheet.fw * scale) / 2, sheet.fh * scale, scale);
  return cv;
}
function portrait(mood, size = 88) {
  const cv = h('canvas', { class: 'pixel', width: 48, height: 48, style: { width: `${size}px`, height: `${size}px`, flex: 'none' } });
  cv.getContext('2d').drawImage(mahmoudPortrait(mood), 0, 0);
  return cv;
}

export function openPanel(root, kind, ctx) {
  const { net, getView, editPassport } = ctx;
  const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } });
  const body = h('div', { class: 'body' });
  const titleEl = h('h2', {});
  const sub = h('div', { class: 'eyebrow gold' });
  const modal = h('div', { class: `panel gold modal modal-${kind.kind}`, role: 'dialog', 'aria-modal': 'true' },
    h('header', {}, h('div', {}, sub, titleEl), h('button', { class: 'btn ghost small close', onclick: () => close(), 'aria-label': 'Close' }, 'Close ✕')),
    body);
  bg.appendChild(modal);
  root.appendChild(bg);
  const onEsc = (e) => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', onEsc);
  let closed = false;
  function close() { if (closed) return; closed = true; removeEventListener('keydown', onEsc); bg.remove(); ctx.onClose?.(); }
  async function act(a, okMsg) {
    const res = await net.act(a);
    if (!res.ok) { toast(res.error, 'bad'); audio.sfx('error'); } else { if (okMsg) toast(okMsg, 'good'); audio.sfx('coin'); }
    return res.ok;
  }
  let lastKey = '';
  const ui = {};

  const render = (force) => {
    const v = getView();
    if (!v) return;
    const me = v.players.find((p) => p.id === v.you);
    const key = JSON.stringify([v.phase, v.me.wallet, v.me.role, v.launchAt, v.players.map((p) => [p.id, p.boarded, p.role, p.onboarded, p.partnerId, p.couple, p.visited.length, p.vip, p.bracelet, p.premonition]), v.hostId, ctx.extraKey?.()]);
    if (!force && key === lastKey) return;
    lastKey = key;
    const isHost = v.hostId === v.you;
    const R = RENDER[kind.kind] || RENDER.info;
    R({ v, me, isHost, kind });
  };

  const RENDER = {
    // ───────── Role Market ─────────
    roles({ v, me }) {
      sub.textContent = 'Role Market'; titleEl.textContent = v.me.role ? `You are a ${roleById(v.me.role).name}` : 'Choose your role';
      const chosen = roleById(v.me.role);
      const closedNow = v.phase !== 'lobby';
      replace(body,
        h('div', { class: 'todo' },
          h('b', {}, chosen ? `${chosen.icon} Your role is locked for the whole game.` : 'One role. For the whole game. No refunds, no switching.'),
          h('div', { class: 'small' }, chosen ? 'Next: walk to the spacecraft on the launch pad (south-east) and board.' : `You have ${fmtVC(v.me.wallet)} VC. Every coin spent on a role is a coin you can't use on chips, bets or at the final Black Market. Rookie is free and gives +400 VC.`)),
        closedNow ? h('div', { class: 'privacy' }, 'The Role Market is closed while the game is running.') : null,
        h('div', { class: 'role-grid' }, ROLES.map((r) => {
          const mine = v.me.role === r.id;
          const others = v.players.filter((p) => p.role === r.id && p.id !== v.you);
          const uses = r.ability.uses === 'passive' ? 'Always on' : r.ability.uses === 'stage' ? 'Once per decision' : 'Once per game';
          return h('div', { class: `role-card ${mine ? 'current' : ''} ${chosen && !mine ? 'dim' : ''}` }, spriteCanvas({ appearance: me.appearance, nationality: me.nationality, role: r.id }, 2),
            h('div', { class: 'info' },
              h('div', { class: 'row' }, h('h3', {}, `${r.icon} ${r.name}`), h('span', { class: 'spacer' }), h('span', { class: 'price tnum' }, r.price ? `${r.price} VC` : 'Free')),
              h('div', { class: 'power-line' }, r.power),
              h('p', {}, r.detail),
              h('div', { class: 'row small' }, h('span', { class: 'tag' }, uses), others.length ? h('span', { class: 'muted' }, `Also: ${others.map((p) => p.name).join(', ')}`) : null),
              mine ? h('span', { class: 'tag good' }, 'YOUR ROLE')
                : chosen || closedNow ? null
                  : h('button', { class: 'btn small solid', disabled: r.price > v.me.wallet, onclick: (e) => confirmRole(e.currentTarget, r) }, r.price > v.me.wallet ? 'Not enough VC' : `Choose ${r.name}`),
            ));
        })));
    },

    // ───────── Ambassador ─────────
    ambassador({ v, me, kind: k }) {
      const nation = nationById(k.nation);
      const own = me.nationality === k.nation;
      sub.textContent = `${nation.flag} ${nation.name} Embassy`; titleEl.textContent = 'The Ambassador';
      if (own && !v.me.flags?.embassyVisited) act({ type: 'visit:embassy', nation: k.nation });
      const amb = spriteCanvas({ special: 'ambassador', nationality: k.nation, appearance: { ...nation.preset, facial: 'none', eyewear: 'none', accessory: 'none' } }, 4);
      const text = ambassadorText(k.nation, me.nationality, me.name);
      replace(body,
        h('div', { class: 'row dialog-row' }, h('div', { class: 'amb-sprite' }, amb),
          h('div', { class: 'stack', style: { minWidth: 0, flex: 1 } },
            own ? h('div', { class: 'eyebrow' }, LANG_NOTE[k.nation] || 'English') : null,
            h('div', { class: 'speech-bubble' }, text),
            own ? h('details', {}, h('summary', { class: 'small muted' }, 'English'), h('div', { class: 'small' }, ENGLISH.own)) : null)),
        own ? h('div', { class: 'todo' }, h('b', {}, '✓ Embassy visited.'), h('div', { class: 'small' }, v.me.role ? 'You already have your role — head to the spacecraft!' : 'Next: the Role Market (east side of the campus). Follow the blue arrow.')) : h('div', { class: 'privacy' }, 'This is not your embassy, but the ground floor is open to everyone. The bedroom upstairs is private.'),
        own ? h('div', { class: 'row' }, h('button', { class: 'btn holo', onclick: () => { close(); editPassport(); } }, 'Edit passport & travels')) : null,
      );
    },

    // ───────── Travel stats board ─────────
    stats({ v, me, kind: k }) {
      const nation = nationById(k.nation);
      sub.textContent = `${nation.flag} ${nation.name} Embassy`; titleEl.textContent = 'Travel board';
      const members = v.players.filter((p) => p.onboarded && p.nationality === k.nation);
      const showMe = me.nationality === k.nation;
      const partner = me.couple ? v.players.find((p) => p.id === me.couple) : null;
      replace(body,
        showMe ? h('div', { class: 'stack' }, h('h3', {}, `${me.name}${partner ? ` & ${partner.name}` : ''}`), statsBlock(me.visited, me.partnerVisited || [], { showPartner: true }),
          h('div', { class: 'muted small' }, `Flying from ${departureById(me.home).city}. ❤️ trips are private unless you share them.`)) : null,
        members.filter((p) => p.id !== v.you).map((p) => h('div', { class: 'stack' }, h('h3', {}, p.name), statsBlock(p.visited, p.partnerVisited || [], { showPartner: !!p.partnerVisited }))),
        !showMe && !members.length ? h('div', { class: 'muted' }, 'No crew registered at this embassy yet.') : null,
        h('details', {}, h('summary', {}, 'Whole crew'), h('div', { class: 'player-list' }, v.players.filter((p) => p.onboarded).map((p) => h('div', { class: 'player-row' }, h('img', { src: avatarURL(p, 36), alt: '' }), h('b', {}, p.name), h('span', { class: 'spacer' }), h('span', { class: 'muted small' }, `${p.visited.length} countries`))))),
      );
    },

    // ───────── Mahmoud's Control Centre ─────────
    hq({ v, isHost }) {
      sub.textContent = "Mahmoud's Control Centre"; titleEl.textContent = 'Rules & mission control';
      replace(body,
        h('div', { class: 'row dialog-row' }, portrait('smug'), h('div', { class: 'speech-bubble' }, 'Listen carefully, legends. I explain once. Then I spin.')),
        rulesBlock(),
        historyBlock(v),
        isHost ? hostControls(v) : h('div', { class: 'privacy' }, `${v.players.find((p) => p.id === v.hostId)?.name || 'The host'} holds the host controls (bots, timers, travel month, early launch).`),
      );
    },

    // ───────── Boarding ramp ─────────
    ship({ v, me, isHost }) {
      sub.textContent = 'Spacecraft MAHMOUD-1'; titleEl.textContent = 'Boarding ramp';
      const crew = v.players.filter((p) => p.onboarded);
      const aboard = crew.filter((p) => p.boarded);
      const canBoard = !!v.me.role;
      replace(body,
        h('div', { class: 'todo' },
          h('b', {}, me.boarded ? 'You are aboard. Waiting for the rest of the crew…' : canBoard ? 'Ready for departure?' : 'Choose a role first.'),
          h('div', { class: 'small' }, me.boarded ? 'When everyone is aboard, Mahmoud launches automatically (10 s countdown). The host can launch early once everyone has a role — the Role Market is a mandatory stop.' : canBoard ? 'Inside: your wishlist, then the Region Roulette and the Country Clash.' : 'The Role Market (east side, follow the blue arrow) is a mandatory stop: no role, no seat on MAHMOUD-1.')),
        h('div', { class: 'player-list' }, crew.map((p) => h('div', { class: 'player-row' }, h('img', { src: avatarURL(p, 36), alt: '' }), h('b', {}, p.name), h('span', { class: 'muted small' }, p.role ? `${roleById(p.role).icon} ${roleById(p.role).name}` : 'no role yet'), h('span', { class: 'spacer' }),
          p.boarded ? h('span', { class: 'tag good' }, 'ABOARD') : p.connected || p.isBot ? h('span', { class: 'tag' }, 'ON THE MOON') : h('span', { class: 'tag warn' }, 'OFFLINE')))),
        v.phase !== 'lobby' ? h('div', { class: 'privacy' }, 'The spacecraft is in flight.') :
          h('div', { class: 'row' },
            me.boarded ? h('button', { class: 'btn ghost', onclick: () => act({ type: 'unboard' }) }, 'Step off the ship')
              : h('button', { class: 'btn solid big', disabled: !canBoard, onclick: async () => { if (await act({ type: 'board' }, 'You are aboard!')) { close(); ctx.onBoarded?.(); } } }, '🚀 Board the spacecraft'),
            isHost ? h('button', { class: 'btn holo', onclick: async () => { if (await act({ type: 'host:launch' })) close(); } }, `Launch now (${aboard.length}/${crew.length} aboard)`) : null,
          ),
      );
    },

    // ───────── Black Market (before the end) ─────────
    black() {
      sub.textContent = 'Black Market'; titleEl.textContent = 'Shutters down — opens at the end';
      const cats = [...new Set(MARKET_ITEMS.map((i) => i.cat))];
      replace(body,
        h('div', { class: 'row dialog-row' }, h('div', { class: 'speech-bubble' }, 'A note under the shutter: “Powers are sold from the TERMINAL on the spacecraft, during the decisions. This shop opens after the Pharaoh\'s verdict — bring your coins. — B.M.”')),
        h('h3', {}, 'Spacecraft terminal — powers during decisions'),
        h('div', { class: 'power-grid static' }, POWERS.map((p) => h('div', { class: 'power', style: { '--pc': p.color } }, h('span', { class: 'pi' }, p.icon), h('span', { class: 'pn' }, p.name), h('span', { class: 'pp tnum' }, `${p.price} VC`), h('span', { class: 'pt small' }, p.text)))),
        h('h3', {}, 'Opening at the end — real holiday privileges'),
        cats.map((c) => h('div', { class: 'stack' }, h('b', {}, c), h('div', { class: 'chips' }, MARKET_ITEMS.filter((i) => i.cat === c).map((i) => h('span', { class: 'chip', title: i.text }, `${i.icon} ${i.name} · ${i.price ? `${i.price} VC` : 'all the crew\'s coins'}`))))),
      );
    },

    // ───────── NPC talks ─────────
    mahmoud({ v, me }) {
      sub.textContent = 'Game master'; titleEl.textContent = 'Mahmoud';
      const next = !me.embassyVisited ? `First, visit your embassy — the ${nationById(me.nationality)?.name || ''} one on the north side.`
        : !v.me.role ? 'Now the Role Market, on the east side. Choose wisely, it is for the whole game.'
          : !me.boarded ? 'Everything is ready. My spacecraft is on the launch pad, south-east. Board it!'
            : 'You are aboard. We wait for the others. Patience. Sunscreen.';
      replace(body,
        h('div', { class: 'row dialog-row' }, portrait('happy'), h('div', { class: 'stack', style: { flex: 1, minWidth: 0 } },
          h('div', { class: 'speech-bubble' }, `Hey ${me.name}! ${next}`),
          h('div', { class: 'muted small', style: { fontStyle: 'italic' } }, `“${MAHMOUD_LINES.idle[Math.floor(Math.random() * MAHMOUD_LINES.idle.length)]}”`))),
        h('button', { class: 'btn solid', onclick: () => { close(); ctx.openTutorial?.(); } }, "▶ Brief me — 1 minute"),
        h('details', {}, h('summary', {}, 'Explain all the rules'), rulesBlock({ compact: false })),
      );
    },

    baby({ v }) {
      sub.textContent = 'Tiny but rich'; titleEl.textContent = 'Baby Mahmoud';
      const babyCv = spriteCanvas({ special: 'baby', appearance: { presentation: 'masc', skin: 2, hairStyle: 'curly', hairColor: 0, facial: 'none', eyewear: 'none', accessory: 'cap', outfit: 2 } }, 4);
      replace(body,
        h('div', { class: 'row dialog-row' }, h('div', { class: 'amb-sprite' }, babyCv), h('div', { class: 'stack', style: { flex: 1, minWidth: 0 } }, BABY_LINES.map((l) => h('div', { class: 'speech-bubble' }, l)))),
        v.phase === 'market' ? h('button', { class: 'btn solid big', onclick: () => { close(); ctx.openMarket?.(); } }, '🕶️ Open the Black Market') : null,
      );
    },

    wallet({ v, me }) {
      sub.textContent = 'Lunar passport'; titleEl.textContent = me.name;
      replace(body, passportBlock(v, me));
    },
    info() { titleEl.textContent = 'Nothing here'; },
  };

  function confirmRole(btn, r) {
    if (btn.dataset.armed) { act({ type: 'role:choose', roleId: r.id }, `You are now a ${r.name}! Next: board the spacecraft.`).then((ok) => { if (ok) { audio.sfx('heart'); setTimeout(() => { close(); ctx.onRoleChosen?.(); }, 600); } }); return; }
    btn.dataset.armed = '1';
    btn.textContent = `Tap again to lock ${r.name} (final)`;
    btn.classList.add('bad');
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = `Choose ${r.name}`; btn.classList.remove('bad'); } }, 4000);
  }

  function historyBlock(v) {
    const hist = (v.history || []).filter((x) => x.kind !== 'restart');
    if (!hist.length) return null;
    const label = (x) => (x.kind === 'region' ? `${regionById(x.winner)?.icon} ${regionById(x.winner)?.name}` : `${countryById(x.winner)?.flag} ${countryById(x.winner)?.name}`);
    return h('div', { class: 'stack' }, h('h3', {}, 'Draw history (verifiable)'),
      hist.map((x) => h('div', { class: 'small' }, `Game ${x.game} · ${x.kind}: ${label(x)} won at ${(x.p * 100).toFixed(1)}% · draw ${x.u.toFixed(6)}`)));
  }

  function passportBlock(v, me) {
    const partner = me.partnerVisited || [];
    const mate = me.couple ? v.players.find((p) => p.id === me.couple) : null;
    const asked = me.partnerId && !me.couple ? v.players.find((p) => p.id === me.partnerId) : null;
    return h('div', { class: 'stack' },
      h('div', { class: 'row' }, h('img', { src: avatarURL(me, 40), alt: '', style: { width: '48px', height: '48px', imageRendering: 'pixelated' } }),
        h('div', {}, h('b', {}, me.name), h('div', { class: 'muted small' }, `${nationById(me.nationality).flag} ${nationById(me.nationality).demonym} · ${v.me.role ? `${roleById(v.me.role).icon} ${roleById(v.me.role).name}` : 'no role yet'} · ${me.group === 'girls' ? '👭 girls' : '👬 boys'} group · from ${departureById(me.home).city}`)), h('span', { class: 'spacer' }),
        h('button', { class: 'btn holo small', onclick: () => { close(); editPassport(); } }, 'Edit passport')),
      h('div', { class: 'small' }, mate ? `❤️ Partner: ${mate.name}` : asked ? `💌 You picked ${asked.name} — waiting for them to pick you back.` : 'No partner set (edit passport to choose one).'),
      statsBlock(me.visited, partner),
      h('div', { class: 'small' }, h('b', {}, `${me.visited.length} countries visited: `), me.visited.length ? me.visited.map(worldName).sort().join(', ') : 'none yet'),
      h('div', { class: 'stack' }, h('b', {}, `Wallet: ${fmtVC(v.me.wallet)} VC — history`),
        h('div', { class: 'ledger' }, [...v.me.ledger].reverse().map((l) => h('div', {}, h('span', { class: `amt tnum ${l.delta >= 0 ? 'pos' : 'neg'}` }, `${l.delta >= 0 ? '+' : ''}${l.delta}`), h('span', { style: { flex: 1 } }, l.reason), h('span', { class: 'muted tnum' }, fmtVC(l.balance)))))),
    );
  }

  function hostControls(v) {
    const cfg = v.config;
    const strat = h('input', { type: 'number', id: 'cfg-strategy', min: 30, max: 900, step: 15, value: cfg.timers.strategy });
    const wish = h('input', { type: 'number', id: 'cfg-wishlist', min: 30, max: 600, step: 15, value: cfg.timers.wishlist });
    const bots = v.players.filter((p) => p.isBot);
    const humans = v.players.filter((p) => !p.isBot && p.id !== v.you);
    const lobby = v.phase === 'lobby';
    return h('div', { class: 'stack host-box' },
      h('b', { style: { color: 'var(--gold)' } }, '🎛️ Host controls'),
      lobby ? null : h('div', { class: 'privacy' }, 'Settings unlock before launch.'),
      h('div', { class: 'row' }, h('label', { class: 'field', style: { flex: 1 } }, 'Decision timer (s)', strat), h('label', { class: 'field', style: { flex: 1 } }, 'Wishlist timer (s)', wish)),
      h('div', { class: 'row' },
        h('button', { class: 'btn solid', disabled: !lobby, onclick: () => act({ type: 'host:config', strategy: Number(strat.value), wishlist: Number(wish.value) }, 'Settings saved.') }, 'Save settings'),
        h('button', { class: 'btn holo', disabled: !lobby, onclick: () => act({ type: 'host:addBot' }, 'A bot crewmate has landed.').then(() => setTimeout(() => render(true), 150)) }, '+ Add bot crewmate'),
        h('button', { class: 'btn', disabled: !lobby, onclick: async () => { if (await act({ type: 'host:launch' })) close(); } }, '🚀 Launch now'),
      ),
      bots.length ? h('div', { class: 'row small' }, 'Bots:', bots.map((b) => h('button', { class: 'chip', disabled: !lobby, onclick: () => act({ type: 'host:removePlayer', targetId: b.id }).then(() => setTimeout(() => render(true), 150)) }, `${b.name} ✕`))) : null,
      humans.length ? h('div', { class: 'row small' }, 'Hand host to:', humans.map((p) => h('button', { class: 'chip', onclick: () => act({ type: 'host:transfer', targetId: p.id }, `${p.name} is now host.`).then(() => setTimeout(() => render(true), 150)) }, p.name))) : null,
    );
  }

  render(true);
  return { close, refresh: () => render(false), kind: kind.kind };
}
