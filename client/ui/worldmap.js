// Travel-history picker: an always-open checklist of the 193 countries (tick as many as you
// like — the list never jumps), a ❤️ "with my partner" toggle per row, a clickable map and
// live stats (% of the world, per continent, with your partner).
import { h, replace } from './dom.js';
import { countries, tracePath, hitTest } from '../gfx/geo.js';
import { UN_COUNTRIES, UN_IDS, flagOf } from '../../shared/data/un.js';
import { CONTINENT_OF, CONTINENTS } from '../../shared/data/continents.js';

const BY_ID = new Map(UN_COUNTRIES.map((c) => [c.id, c]));
export const worldName = (id) => BY_ID.get(id)?.name || id;
export const worldFlag = (id) => flagOf(BY_ID.get(id)?.iso2);

/** % of the world visited (193 countries), per continent, and with a partner. */
export function travelStats(visited = [], partner = []) {
  visited = visited.filter((id) => UN_IDS.has(id)); partner = partner.filter((id) => UN_IDS.has(id));
  const total = UN_COUNTRIES.length;
  const per = CONTINENTS.filter((n) => n !== 'Antarctica').map((name) => {
    const all = UN_COUNTRIES.filter((c) => CONTINENT_OF[c.id] === name);
    const n = visited.filter((id) => CONTINENT_OF[id] === name).length;
    const p = partner.filter((id) => CONTINENT_OF[id] === name).length;
    return { name, n, p, total: all.length, pct: all.length ? Math.round((n / all.length) * 100) : 0 };
  });
  return { n: visited.length, total, pct: Math.round((visited.length / total) * 1000) / 10, partner: partner.length, partnerPct: Math.round((partner.length / total) * 1000) / 10, per };
}

export function statsBlock(visited, partner, { showPartner = true } = {}) {
  const s = travelStats(visited, partner);
  return h('div', { class: 'stats-block' },
    h('div', { class: 'stats-top' },
      h('div', { class: 'big-stat' }, h('b', { class: 'tnum' }, `${s.pct}%`), h('span', {}, `of the world · ${s.n}/${s.total} countries`)),
      showPartner ? h('div', { class: 'big-stat love' }, h('b', { class: 'tnum' }, `${s.partnerPct}%`), h('span', {}, `with your partner · ${s.partner} ❤️`)) : null),
    h('div', { class: 'cont-bars' }, s.per.map((c) => h('div', { class: 'cont-row' },
      h('span', {}, c.name), h('span', { class: 'meter' }, h('i', { style: { width: `${c.pct}%` } }), showPartner && c.p ? h('i', { class: 'love', style: { width: `${Math.round((c.p / c.total) * 100)}%` } }) : null), h('span', { class: 'tnum muted' }, `${c.n}/${c.total}`)))),
  );
}

/**
 * @param {{visited:string[], partner:string[], onChange:(v,p)=>void}} opts
 */
export function travelPicker({ visited, partner, onChange }) {
  const sel = new Set(visited.filter((id) => UN_IDS.has(id)));
  const hearts = new Set(partner.filter((id) => sel.has(id)));
  const W = 1000, H = 500;
  const cv = h('canvas', { width: W, height: H, 'aria-label': 'World map: tap a country to tick it' });
  const hover = h('div', { class: 'hover hidden' });
  const map = h('div', { class: 'worldmap' }, cv, hover);
  const counter = h('b', { class: 'tnum' });
  const stats = h('div');
  const ctx = cv.getContext('2d');
  let hoverId = null;
  const rows = new Map();

  // ── the always-open checklist ──
  const search = h('input', { type: 'search', placeholder: 'Search… (e.g. “ita”)', 'aria-label': 'Search countries', class: 'cl-search' });
  const list = h('div', { class: 'checklist', role: 'listbox', 'aria-multiselectable': 'true' });
  for (const cont of CONTINENTS.filter((n) => n !== 'Antarctica')) {
    const group = h('div', { class: 'cl-group' }, h('div', { class: 'cl-head' }, cont));
    for (const c of UN_COUNTRIES.filter((x) => CONTINENT_OF[x.id] === cont)) {
      const box = h('span', { class: 'cl-box', 'aria-hidden': 'true' });
      const heart = h('button', { class: 'cl-heart', type: 'button', title: 'Visited with my partner (private)', 'aria-label': `${c.name} with my partner` }, '🤍');
      const row = h('div', { class: 'cl-row', role: 'option', tabindex: 0, 'data-name': c.name.toLowerCase() }, box, h('span', { class: 'cl-flag' }, flagOf(c.iso2)), h('span', { class: 'cl-name' }, c.name), heart);
      row.addEventListener('click', (e) => { if (e.target === heart) return; toggle(c.id); });
      row.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(c.id); } });
      heart.addEventListener('click', (e) => { e.stopPropagation(); if (!sel.has(c.id)) sel.add(c.id); hearts.has(c.id) ? hearts.delete(c.id) : hearts.add(c.id); changed(); });
      rows.set(c.id, { row, heart });
      group.appendChild(row);
    }
    list.appendChild(group);
  }
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    for (const g of list.children) {
      let any = false;
      for (const r of g.querySelectorAll('.cl-row')) { const show = !q || r.dataset.name.includes(q); r.classList.toggle('hidden', !show); any ||= show; }
      g.classList.toggle('hidden', !any);
    }
  });
  const onlyTicked = h('label', { class: 'row small', style: { gap: '6px' } }, h('input', { type: 'checkbox' }), 'Show only my countries');
  onlyTicked.firstChild.addEventListener('change', () => list.classList.toggle('only-ticked', onlyTicked.firstChild.checked));

  function paintRows() {
    for (const [id, { row, heart }] of rows) {
      row.classList.toggle('on', sel.has(id));
      row.setAttribute('aria-selected', sel.has(id) ? 'true' : 'false');
      heart.textContent = hearts.has(id) ? '❤️' : '🤍';
      heart.classList.toggle('on', hearts.has(id));
    }
    counter.textContent = `${sel.size} ticked · ${hearts.size} ❤️`;
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d2147'); g.addColorStop(1, '#081631');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(95,242,255,.08)'; ctx.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 30) { const x = ((lon + 180) / 360) * W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let lat = -60; lat <= 60; lat += 30) { const y = ((90 - lat) / 180) * H; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (const c of countries()) {
      if (c.id === '010') continue;
      tracePath(ctx, c, W, H);
      ctx.fillStyle = hearts.has(c.id) ? '#ff7aa8' : sel.has(c.id) ? '#f0c35a' : c.id === hoverId ? '#3f6bb5' : '#2a4a80';
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(5,10,25,.7)'; ctx.lineWidth = 0.7; ctx.stroke();
    }
  }

  function toggle(id) { if (sel.has(id)) { sel.delete(id); hearts.delete(id); } else sel.add(id); changed(); }
  function changed() { draw(); paintRows(); replace(stats, statsBlock([...sel], [...hearts])); onChange([...sel], [...hearts]); }

  const pick = (e) => { const r = cv.getBoundingClientRect(); return hitTest(((e.clientX - r.left) / r.width) * 360 - 180, 90 - ((e.clientY - r.top) / r.height) * 180); };
  cv.addEventListener('click', (e) => { const c = pick(e); if (c && UN_IDS.has(c.id)) toggle(c.id); });
  cv.addEventListener('mousemove', (e) => {
    const c = pick(e); const id = c && UN_IDS.has(c.id) ? c.id : null;
    if (id !== hoverId) { hoverId = id; draw(); }
    hover.classList.toggle('hidden', !id);
    if (id) hover.textContent = worldName(id) + (sel.has(id) ? ' ✓' : '');
  });
  cv.addEventListener('mouseleave', () => { hoverId = null; hover.classList.add('hidden'); draw(); });

  draw(); paintRows(); replace(stats, statsBlock([...sel], [...hearts]));
  return h('div', { class: 'stack picker' },
    h('div', { class: 'row' }, search, onlyTicked, h('span', { class: 'spacer' }), counter),
    list,
    h('div', { class: 'privacy' }, 'Tick every country you have visited — the list stays open, tick as many as you want. Tap 🤍 to mark a trip with your partner (private by default). Visited countries get a malus in the game: places the crew already knows are a bit less likely.'),
    map, stats);
}

/** A departure menu: favourites first (Belgium, Luxembourg, Serbia, North Macedonia), then all 193. */
export function departureSelect(value, onChange, favourites) {
  const fav = favourites.map((id) => BY_ID.get(id)).filter(Boolean);
  const sel = h('select', { id: 'ob-home', 'aria-label': 'I fly from' },
    h('optgroup', { label: '★ Favourites' }, fav.map((c) => h('option', { value: c.id, selected: c.id === value }, `${flagOf(c.iso2)} ${c.name} — ${c.city}`))),
    h('optgroup', { label: 'All countries' }, UN_COUNTRIES.filter((c) => !favourites.includes(c.id)).map((c) => h('option', { value: c.id, selected: c.id === value }, `${flagOf(c.iso2)} ${c.name} — ${c.city}`))));
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}
