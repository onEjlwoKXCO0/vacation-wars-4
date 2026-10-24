// The end-game Black Market: holiday privileges funded alone or together (pools), coin
// transfers and requests between crewmates, the legendary restart, and the vacation contract.
import { portrait } from '../gfx/sprites.js';
import { npcById } from '../../shared/data/npcs.js';
import { h, replace, toast, fmtVC } from './dom.js';
import { countryById } from '../../shared/data/countries.js';
import { regionById } from '../../shared/data/regions.js';
import { roleById } from '../../shared/data/roles.js';
import { avatarURL } from '../gfx/sprites.js';
import { audio } from '../audio.js';

function hichamFace() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; c.className = 'dealer-face';
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(portrait(npcById('hicham').look, 'smug'), 0, 0);
  return c;
}

export function openMarket(root, { net, getView, onClose }) {
  const bg = h('div', { class: 'modal-bg market-bg' });
  const body = h('div', { class: 'body' });
  const modal = h('div', { class: 'panel gold modal market', role: 'dialog', 'aria-modal': 'true' },
    h('header', {}, h('div', {}, h('div', { class: 'eyebrow gold' }, 'Baby Mahmoud\'s'), h('h2', { class: 'display' }, 'BLACK MARKET')), h('button', { class: 'btn ghost small close', onclick: () => close() }, 'Close ✕')),
    body);
  bg.appendChild(modal);
  root.appendChild(bg);
  const ui = { tab: 'items', amount: {}, giveTo: '', giveAmt: 100, note: '', key: '' };
  let closed = false;
  function close() { if (closed) return; closed = true; bg.remove(); onClose?.(); }
  async function act(a, okMsg) {
    const res = await net.act(a);
    if (!res.ok) { toast(res.error, 'bad'); audio.sfx('error'); } else { if (okMsg) toast(okMsg, 'good'); audio.sfx('coin'); }
    return res.ok;
  }
  const player = (v, id) => v.players.find((p) => p.id === id);

  function render(force) {
    const v = getView();
    if (!v || !v.market) { if (v && v.phase === 'lobby') close(); return; }
    const m = v.market;
    const key = JSON.stringify([ui.tab, v.me.wallet, m.pools, m.purchases, m.requests, m.closed, v.phase, v.players.map((p) => p.wallet)]);
    if (!force && key === ui.key) return;
    ui.key = key;
    if (v.phase === 'ended') return renderContract(v);
    const total = v.players.reduce((a, p) => a + (p.wallet || 0), 0);
    const restartPool = m.pools.find((p) => p.itemId === 'restart' && !p.done);
    const restartFunded = restartPool ? restartPool.value : 0;
    const dest = countryById(m.destination);
    const tabs = [['items', '🛍️ Privileges'], ['pools', `🤝 Pools (${m.pools.filter((p) => !p.done).length})`], ['coins', `💸 Coins${m.requests.filter((r) => r.to === v.you && r.status === 'open').length ? ' •' : ''}`], ['bought', `🧾 Bought (${m.purchases.length})`]];
    const hichamLines = ['You got the VC? Good. Let\'s make it interesting.', 'Good deals. Bad decisions. Best prices.', 'Need something special? I know a guy… actually, it\'s me. Joseph brings the stock.', 'Shhh… this stays between us, yeah?'];
    replace(body,
      h('div', { class: 'dealer' }, hichamFace(), h('div', {}, h('b', { style: { color: '#e8b84a' } }, 'HICHAM · BLACK MARKET DEALER'), h('div', { class: 'q' }, `“${hichamLines[Math.floor(Date.now() / 15000) % hichamLines.length]}”`))),
      h('div', { class: 'market-top' },
        h('div', { class: 'big-stat gold' }, h('b', { class: 'tnum' }, fmtVC(v.me.wallet)), h('span', {}, 'your VC')),
        h('div', { class: 'big-stat' }, h('b', {}, dest ? `${dest.flag} ${dest.name}` : '—'), h('span', {}, 'destination')),
        h('div', { class: 'wallets' }, v.players.filter((p) => p.onboarded).map((p) => h('div', { class: 'w' }, h('img', { src: avatarURL(p, 28), alt: '' }), h('span', {}, p.name), h('b', { class: 'tnum' }, fmtVC(p.wallet))))),
      ),
      h('div', { class: 'restart-box' },
        h('div', { class: 'row' }, h('b', {}, '🔁 RESTART VACATION WARS'), h('span', { class: 'spacer' }), h('span', { class: 'tnum' }, `${fmtVC(restartFunded)} / ${fmtVC(m.restartPrice)} VC`)),
        h('div', { class: 'meter big' }, h('i', { style: { width: `${Math.min(100, (100 * restartFunded) / Math.max(1, m.restartPrice))}%` } })),
        h('div', { class: 'small muted' }, `The legendary item costs every coin the crew owns (${fmtVC(total)} in wallets + coins in open pools). Everyone must put in everything. When it fills, the whole game restarts: new roles, new wishes, new wheels.`),
        h('div', { class: 'row' }, h('button', { class: 'btn chaos', disabled: v.me.wallet < 1, onclick: () => (restartPool ? act({ type: 'market:fund', poolId: restartPool.id, amount: v.me.wallet }) : act({ type: 'market:open', itemId: 'restart', amount: v.me.wallet })).then((ok) => ok && toast('All in! 🔁', 'good')) }, `Put all my ${fmtVC(v.me.wallet)} VC in`))),
      h('nav', { class: 'tabs' }, tabs.map(([id, label]) => h('button', { 'aria-current': ui.tab === id ? 'page' : null, onclick: () => { ui.tab = id; render(true); } }, label))),
      ui.tab === 'items' ? itemsTab(v) : ui.tab === 'pools' ? poolsTab(v) : ui.tab === 'coins' ? coinsTab(v) : boughtTab(v),
      v.hostId === v.you ? h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => { if (confirm('Close the market for everyone? Unfinished pools are refunded.')) act({ type: 'host:closeMarket' }); } }, 'Host: close the market & print the contract')) : null,
    );
  }

  function amountInput(id, def, max) {
    const val = Math.max(1, Math.min(max || 1, ui.amount[id] ?? def));
    const inp = h('input', { type: 'number', min: 1, max: Math.max(1, max), step: 10, value: val, class: 'amt-in', 'aria-label': 'Amount' });
    inp.addEventListener('input', () => { ui.amount[id] = Math.floor(Number(inp.value) || 0); });
    return inp;
  }

  function itemsTab(v) {
    const m = v.market;
    const merchant = roleById(v.me.role)?.ability?.kind === 'halfPrice';
    const cats = [...new Set(m.items.filter((i) => i.id !== 'restart').map((i) => i.cat))];
    return h('div', { class: 'stack' },
      h('div', { class: 'howto' },
        h('b', {}, 'How the Black Market works'),
        h('ol', {},
          h('li', {}, 'These are REAL holiday privileges — the crew promises to respect them during the trip (they are printed on the final contract).'),
          h('li', {}, 'Enough coins? Press “Buy now”. Not enough? Put what you have: it opens a pool and your crewmates can add coins in the 🤝 Pools tab.'),
          h('li', {}, '👤 = the privilege is yours. 👥 = the whole crew enjoys it.'),
          h('li', {}, 'Need coins? Ask a crewmate in the 💸 Coins tab — make deals!'),
          h('li', {}, 'The odds of the destination are already decided — this shop is about how the holiday goes.')),
        merchant ? h('div', { class: 'small' }, '💰 Merchant: your coins count double here.') : null),
      cats.map((c) => h('div', { class: 'stack' }, h('h3', {}, c), h('div', { class: 'item-grid' }, m.items.filter((i) => i.cat === c).map((i) => {
        const pool = m.pools.find((p) => !p.done && p.itemId === i.id && (i.for === 'crew' || p.owner === v.you));
        const left = pool ? i.price - pool.value : i.price;
        const need = merchant ? Math.ceil(left / 2) : left;
        const inp = amountInput(i.id, Math.min(need, v.me.wallet), Math.min(need, v.me.wallet));
        return h('div', { class: `item ${i.left <= 0 ? 'sold' : ''}` },
          h('div', { class: 'row' }, h('span', { class: 'ii' }, i.icon), h('b', {}, i.name), h('span', { class: 'spacer' }), h('span', { class: 'price tnum' }, `${fmtVC(i.price)} VC`)),
          h('div', { class: 'small' }, i.text),
          h('div', { class: 'row small muted' }, h('span', {}, i.for === 'crew' ? '👥 for the crew' : '👤 for you'), h('span', {}, i.left <= 0 ? 'SOLD OUT' : `${i.left} left`), pool ? h('span', {}, `pool: ${fmtVC(pool.value)}/${fmtVC(i.price)}`) : null),
          i.left > 0 ? h('div', { class: 'row' }, inp,
            h('button', { class: 'btn small solid', disabled: v.me.wallet < 1, onclick: () => { const amt = Math.floor(Number(inp.value) || 0); (pool ? act({ type: 'market:fund', poolId: pool.id, amount: amt }) : act({ type: 'market:open', itemId: i.id, amount: amt })); } }, pool ? 'Add my coins to the pool' : need <= v.me.wallet ? `Buy now (${fmtVC(need)} VC)` : 'Put my coins & open a pool')) : null,
        );
      })))));
  }

  function poolsTab(v) {
    const m = v.market;
    const open = m.pools.filter((p) => !p.done);
    if (!open.length) return h('div', { class: 'muted' }, 'No open pools. Open one from the Privileges tab — crewmates can then chip in.');
    return h('div', { class: 'stack' }, open.map((p) => {
      const item = m.items.find((i) => i.id === p.itemId);
      const mine = p.contributions[v.you];
      const inp = amountInput(p.id, 50, v.me.wallet);
      return h('div', { class: 'pool' },
        h('div', { class: 'row' }, h('b', {}, `${item.icon} ${item.name}`), h('span', { class: 'muted small' }, p.owner ? `for ${player(v, p.owner)?.name}` : 'for the crew'), h('span', { class: 'spacer' }), h('span', { class: 'tnum' }, `${fmtVC(p.value)} / ${fmtVC(item.price)}`)),
        h('div', { class: 'meter' }, h('i', { style: { width: `${Math.min(100, (100 * p.value) / item.price)}%` } })),
        h('div', { class: 'chips' }, Object.entries(p.contributions).map(([pid, c]) => h('span', { class: 'chip small' }, `${player(v, pid)?.name}: ${fmtVC(c.paid)}${c.value !== c.paid ? ` (×2 = ${c.value})` : ''}`))),
        h('div', { class: 'row' }, inp, h('button', { class: 'btn small solid', onclick: () => act({ type: 'market:fund', poolId: p.id, amount: Math.floor(Number(inp.value) || 0) }) }, 'Chip in'),
          mine ? h('button', { class: 'btn small ghost', onclick: () => act({ type: 'market:withdraw', poolId: p.id }, 'Coins withdrawn.') }, `Withdraw my ${fmtVC(mine.paid)}`) : null));
    }));
  }

  function coinsTab(v) {
    const m = v.market;
    const others = v.players.filter((p) => p.onboarded && p.id !== v.you);
    if (!ui.giveTo || !others.some((p) => p.id === ui.giveTo)) ui.giveTo = others[0]?.id || '';
    const sel = h('select', { 'aria-label': 'Crewmate' }, others.map((p) => h('option', { value: p.id, selected: p.id === ui.giveTo }, p.name)));
    sel.addEventListener('change', () => { ui.giveTo = sel.value; });
    const amt = h('input', { type: 'number', min: 1, step: 10, value: ui.giveAmt, class: 'amt-in', 'aria-label': 'Amount' });
    amt.addEventListener('input', () => { ui.giveAmt = Math.floor(Number(amt.value) || 0); });
    const note = h('input', { type: 'text', maxlength: 60, placeholder: 'Note (e.g. “for the Airbnb pick”)', value: ui.note });
    note.addEventListener('input', () => { ui.note = note.value; });
    const incoming = m.requests.filter((r) => r.to === v.you && r.status === 'open');
    const outgoing = m.requests.filter((r) => r.from === v.you);
    return h('div', { class: 'stack' },
      h('div', { class: 'small muted' }, 'Send coins to help a crewmate buy what they want — or ask for some. Make deals: “I fund your bedroom pick if you never make me drive.”'),
      h('div', { class: 'row' }, sel, amt, note),
      h('div', { class: 'row' },
        h('button', { class: 'btn solid', onclick: () => act({ type: 'market:give', toId: ui.giveTo, amount: ui.giveAmt, note: ui.note }, 'Coins sent.') }, '💸 Send coins'),
        h('button', { class: 'btn holo', onclick: () => act({ type: 'market:request', toId: ui.giveTo, amount: ui.giveAmt, note: ui.note }, 'Request sent.') }, '🙏 Ask for coins')),
      incoming.length ? h('div', { class: 'stack' }, h('h3', {}, 'Requests for you'), incoming.map((r) => h('div', { class: 'row pool' }, h('span', {}, `${player(v, r.from)?.name} asks ${fmtVC(r.amount)} VC${r.note ? ` — “${r.note}”` : ''}`), h('span', { class: 'spacer' }),
        h('button', { class: 'btn small good', onclick: () => act({ type: 'market:answer', requestId: r.id, accept: true }, 'Sent!') }, 'Accept'),
        h('button', { class: 'btn small ghost', onclick: () => act({ type: 'market:answer', requestId: r.id, accept: false }) }, 'Decline')))) : null,
      outgoing.length ? h('div', { class: 'stack' }, h('h3', {}, 'Your requests'), outgoing.map((r) => h('div', { class: 'small' }, `${fmtVC(r.amount)} VC from ${player(v, r.to)?.name} — ${r.status}`))) : null,
      h('div', { class: 'stack' }, h('h3', {}, 'Recent transfers'), (m.log || []).slice(-8).reverse().map((l) => h('div', { class: 'small' }, `${player(v, l.from)?.name} → ${player(v, l.to)?.name}: ${fmtVC(l.amount)} VC${l.note ? ` (${l.note})` : ''}`))),
    );
  }

  function boughtTab(v) {
    const m = v.market;
    if (!m.purchases.length) return h('div', { class: 'muted' }, 'Nothing bought yet.');
    return h('div', { class: 'stack' }, m.purchases.map((p) => { const item = m.items.find((i) => i.id === p.itemId); return h('div', { class: 'pool' }, h('b', {}, `${item.icon} ${item.name}`), ' — ', p.owner ? player(v, p.owner)?.name : 'the whole crew', h('div', { class: 'small muted' }, `${item.text} Paid by ${p.contributors.map((id) => player(v, id)?.name).join(', ')}.`)); }));
  }

  function renderContract(v) {
    const m = v.market;
    const dest = countryById(m.destination);
    const hist = (v.history || []).filter((x) => x.game === Math.max(...v.history.map((y) => y.game || 0)));
    const region = hist.find((x) => x.kind === 'region');
    const month = hist.find((x) => x.kind === 'month');
    replace(body, h('div', { class: 'contract' },
      h('div', { class: 'eyebrow gold' }, 'Official vacation contract'),
      h('div', { class: 'contract-dest' }, h('span', { style: { fontSize: '64px' } }, dest?.flag || '🌍'), h('div', { class: 'display', style: { fontSize: '40px' } }, dest?.name || '?')),
      region ? h('div', { class: 'muted' }, `Region spin: ${regionById(region.winner)?.name}${month ? ` · 📅 Travel month: ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(month.winner)]}` : ''}`) : null,
      h('div', { class: 'small' }, hist.filter((x) => x.kind !== 'restart').map((x) => `${x.kind}: ${(x.p * 100).toFixed(1)}% · draw ${x.u.toFixed(4)}`).join(' — ')),
      h('h3', {}, 'Privileges'),
      m.purchases.length ? m.purchases.map((p) => { const item = m.items.find((i) => i.id === p.itemId); return h('div', {}, `${item.icon} ${item.name} — ${p.owner ? player(v, p.owner)?.name : 'everyone'}`); }) : h('div', { class: 'muted' }, 'No privileges bought — pure democracy.'),
      h('h3', {}, 'Moon side-deals'),
      v.players.filter((p) => p.vip).map((p) => h('div', {}, `👑 ${p.name} accepted Cléopâtre's VIP pass — and must obey Imane for 3 days of the holiday.`)),
      v.players.filter((p) => p.bracelet).length ? h('div', {}, `🌸 Wearing Plami's flower bracelet: ${v.players.filter((p) => p.bracelet).map((p) => p.name).join(', ')}.`) : null,
      v.players.filter((p) => p.premonition && p.premonition.countryId).map((p) => { const c = countryById(p.premonition.countryId); const hit = p.premonition.countryId === m.destination; return h('div', { class: 'premo' }, `🔮 Moumanou told ${p.name}: ${c.flag} ${c.name} — ${hit ? 'SHE WAS RIGHT! 😱' : 'not this time… the cards were shy.'}`); }),
      h('h3', {}, 'Signed'),
      h('div', { class: 'chips' }, v.players.filter((p) => p.onboarded).map((p) => h('span', { class: 'chip' }, h('img', { src: avatarURL(p, 20), alt: '', style: { width: '20px', height: '20px', imageRendering: 'pixelated' } }), ` ${p.name} · ${fmtVC(p.wallet)} VC left`))),
      h('div', { class: 'privacy' }, 'Vacation Coins are fictional. Every real-world choice stays subject to the group\'s budget and final agreement. Screenshot this — it is legally binding. (It isn\'t.)'),
    ));
  }

  render(true);
  return { close, refresh: () => render(false), kind: 'market' };
}
