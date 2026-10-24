// Character creation: identity → look → travel history. Also used to edit the passport later.
import { h, replace, toast } from './dom.js';
import { NATIONS, nationById, APPEARANCE, defaultGroup, COUPLE_NATIONS } from '../../shared/data/nations.js';
import { FAVOURITE_DEPARTURES, normalizeHome } from '../../shared/data/departures.js';
import { drawPreview } from '../gfx/sprites.js';
import { travelPicker, departureSelect } from './worldmap.js';
import { audio } from '../audio.js';
import { filmBackground } from './film.js';

export function showOnboarding(root, { initial, editing = false, onSubmit, onCancel, crew = [], youId = null }) {
  const draft = {
    name: initial?.name || '',
    nationality: initial?.nationality || null,
    appearance: initial?.appearance ? { ...initial.appearance } : { ...NATIONS[4].preset },
    visited: [...(initial?.visited || [])],
    partnerVisited: [...(initial?.partnerVisited || [])],
    sharePartner: !!initial?.sharePartner,
    home: initial?.home ? normalizeHome(initial.home) : null,
    group: initial?.group || null,
    partnerId: initial?.partnerId || null,
  };
  let groupTouched = !!initial?.group;
  let partnerTouched = !!(initial && (initial.onboarded || initial.partnerId));
  let step = editing ? 2 : 0;
  const el = h('div', { class: 'screen', id: 'onboarding' });
  const obBg = h('canvas', { class: 'film-bg' });
  el.appendChild(obBg); filmBackground(obBg);
  const preview = h('canvas', { class: 'pixel', width: 220, height: 260 });
  const nameTag = h('div', { class: 'display', style: { fontSize: '22px' } });
  const nationTag = h('div', { class: 'muted small' });
  const stepsNav = h('nav', { class: 'steps', 'aria-label': 'Passport steps' });
  const body = h('div', { class: 'stack', style: { gap: '16px' } });
  const footer = h('div', { class: 'row' });
  el.appendChild(h('div', { class: 'ob' },
    h('aside', { class: 'panel gold ob-preview' }, h('div', { class: 'eyebrow gold' }, 'Lunar passport'), preview, nameTag, nationTag),
    h('main', { class: 'panel ob-main' },
      h('div', {}, h('div', { class: 'eyebrow' }, editing ? 'Embassy services' : 'Before you land'), h('h2', { class: 'display', style: { fontSize: '30px' } }, editing ? 'Edit your passport' : 'Create your crew member')),
      stepsNav, body, footer)));
  root.appendChild(el);

  let raf;
  const anim = (t) => { if (!el.isConnected) return; drawPreview(preview, { appearance: draft.appearance, nationality: draft.nationality, role: initial?.role }, t); raf = requestAnimationFrame(anim); };
  raf = requestAnimationFrame(anim);

  const STEPS = ['Identity', 'Look', 'Travels'];
  const valid = () => draft.name.trim().length > 0 && !!draft.nationality;

  function render() {
    nameTag.textContent = draft.name.trim() || 'Unnamed explorer';
    const n = nationById(draft.nationality);
    nationTag.textContent = n ? `${n.flag} ${n.demonym} · ${n.id === 'other' ? 'Guest quarters' : `${n.name} Embassy`}` : 'Choose a nationality';
    replace(stepsNav, STEPS.map((s, i) => h('button', { 'aria-current': i === step ? 'step' : null, onclick: () => { if (i > 0 && !valid()) return toast('Choose a name and nationality first.', 'bad'); step = i; render(); } }, `${i + 1}. ${s}`)));
    replace(body, [identity, look, travels][step]());
    const last = step === STEPS.length - 1;
    replace(footer,
      editing ? h('button', { class: 'btn ghost', onclick: () => { cancelAnimationFrame(raf); el.remove(); onCancel?.(); } }, 'Cancel') : step > 0 ? h('button', { class: 'btn ghost', onclick: () => { step--; render(); } }, '◂ Back') : null,
      h('div', { class: 'spacer' }),
      last || editing
        ? h('button', { class: 'btn solid big', id: 'ob-submit', onclick: submit }, editing ? 'Save passport' : 'Land on the Moon ▸')
        : h('button', { class: 'btn solid', id: 'ob-next', onclick: () => { if (!valid()) return toast('Choose a name and nationality first.', 'bad'); audio.sfx('blip'); step++; render(); } }, 'Next ▸'),
    );
  }

  function identity() {
    const name = h('input', { type: 'text', id: 'ob-name', maxlength: 18, value: draft.name, placeholder: 'e.g. Inês', autocomplete: 'nickname' });
    name.addEventListener('input', () => { draft.name = name.value; nameTag.textContent = draft.name.trim() || 'Unnamed explorer'; });
    setTimeout(() => !editing && name.focus(), 50);
    return h('div', { class: 'stack', style: { gap: '16px' } },
      h('label', { class: 'field' }, 'Display name', name),
      h('div', { class: 'opt-group' }, h('span', {}, 'Nationality & embassy'),
        h('div', { class: 'nations' }, NATIONS.map((n) => h('button', {
          class: 'nation', 'aria-pressed': draft.nationality === n.id ? 'true' : 'false',
          onclick: () => {
            const firstPick = !draft.nationality || draft.nationality === 'other';
            draft.nationality = n.id;
            if (firstPick || !initial) draft.appearance = { ...n.preset };
            if (!draft.home || !editing) draft.home = n.home;
            if (!groupTouched) draft.group = defaultGroup(draft.appearance.presentation);
            audio.sfx('blip'); render();
          },
        }, h('span', { class: 'flag' }, n.flag), h('b', {}, n.demonym), h('span', { class: 'muted small' }, n.id === 'other' ? 'Guest quarters on the courtyard' : `${n.name} Embassy`))))),
      h('p', { class: 'muted small', style: { margin: 0 } }, 'Picking a nationality loads a starting look for your embassy — change anything on the next step.'),
      draft.nationality ? h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '14px' } },
        h('label', { class: 'field', style: { flex: '1 1 260px' } }, 'I fly from (for flight times & prices)', departureSelect(draft.home || nationById(draft.nationality).home, (v) => { draft.home = v; }, FAVOURITE_DEPARTURES)),
        h('div', { class: 'opt-group', style: { flex: '1 1 200px' } }, h('span', {}, 'Your call group in the final test'),
          h('div', { class: 'chips' }, [['girls', '👭 Girls'], ['boys', '👬 Boys']].map(([id, label]) => h('button', { class: 'chip', 'aria-pressed': (draft.group || defaultGroup(draft.appearance.presentation)) === id ? 'true' : 'false', onclick: () => { draft.group = id; groupTouched = true; render(); } }, label)))),
      ) : null,
      (() => { // default partner = the crewmate of your couple nation (Macedonia ♥ Poland, Morocco ♥ Portugal); you can change it
        if (draft.partnerId || partnerTouched || !draft.nationality) return null;
        const mate = crew.find((p) => p.id !== youId && p.onboarded && p.nationality === COUPLE_NATIONS[draft.nationality] && (!p.partnerId || p.partnerId === youId));
        if (mate) draft.partnerId = mate.id;
        return null;
      })(),
      crew.filter((p) => p.id !== youId && p.onboarded).length ? h('label', { class: 'field' }, 'Your partner in this crew (optional — unlocks the shared bedroom & the couple test)', (() => {
        const sel = h('select', { id: 'ob-partner' }, h('option', { value: '' }, 'No partner in this crew'), crew.filter((p) => p.id !== youId && p.onboarded).map((p) => h('option', { value: p.id, selected: draft.partnerId === p.id }, `${p.name}${p.partnerId === youId ? ' ❤️ (picked you)' : ''}`)));
        sel.addEventListener('change', () => { draft.partnerId = sel.value || null; partnerTouched = true; }); return sel;
      })()) : null,
    );
  }

  function look() {
    const a = draft.appearance;
    const set = (k, v) => { a[k] = v; if (k === 'presentation' && !groupTouched) draft.group = defaultGroup(v); audio.sfx('blip'); render(); };
    const textOpts = (k, list) => h('div', { class: 'opt-group' }, h('span', {}, LABELS[k]), h('div', { class: 'chips' }, list.map((o) => h('button', { class: 'chip', 'aria-pressed': a[k] === o.id ? 'true' : 'false', onclick: () => set(k, o.id) }, o.label))));
    const colorOpts = (k, list) => h('div', { class: 'opt-group' }, h('span', {}, LABELS[k]), h('div', { class: 'chips' }, list.map((c, i) => h('button', { class: 'swatch', style: { background: c }, 'aria-label': `${LABELS[k]} ${i + 1}`, 'aria-pressed': a[k] === i ? 'true' : 'false', onclick: () => set(k, i) }))));
    return h('div', { class: 'stack', style: { gap: '14px' } },
      textOpts('presentation', APPEARANCE.presentation),
      colorOpts('skin', APPEARANCE.skin),
      textOpts('hairStyle', APPEARANCE.hairStyle),
      colorOpts('hairColor', APPEARANCE.hairColor),
      textOpts('facial', APPEARANCE.facial),
      textOpts('eyewear', APPEARANCE.eyewear),
      textOpts('accessory', APPEARANCE.accessory),
      colorOpts('outfit', APPEARANCE.outfit),
      h('p', { class: 'muted small', style: { margin: 0 } }, 'Your outfit changes when you buy a role at the Role Market.'),
    );
  }

  function travels() {
    const share = h('input', { type: 'checkbox', id: 'share-partner' });
    share.checked = draft.sharePartner;
    share.addEventListener('change', () => { draft.sharePartner = share.checked; });
    return h('div', { class: 'stack' },
      h('p', { style: { margin: 0 } }, 'Tick every country you have visited (all 193, grouped by continent) or tap them on the map. You can edit this any time from your passport.'),
      travelPicker({ visited: draft.visited, partner: draft.partnerVisited, onChange: (v, p) => { draft.visited = v; draft.partnerVisited = p; } }),
      h('label', { class: 'row small', style: { gap: '8px' } }, share, 'Share my partner trips with the crew (off by default)'),
    );
  }

  async function submit() {
    if (!valid()) { step = 0; render(); return toast('Choose a name and nationality first.', 'bad'); }
    const btn = el.querySelector('#ob-submit');
    btn.disabled = true;
    const ok = await onSubmit({ ...draft, name: draft.name.trim(), home: draft.home || nationById(draft.nationality).home, group: draft.group || defaultGroup(draft.appearance.presentation) });
    if (ok) { cancelAnimationFrame(raf); el.remove(); } else btn.disabled = false;
  }

  render();
  return () => { cancelAnimationFrame(raf); el.remove(); };
}

const LABELS = { presentation: 'Presentation', skin: 'Skin tone', hairStyle: 'Hair', hairColor: 'Hair colour', facial: 'Facial hair', eyewear: 'Eyewear', accessory: 'Accessory', outfit: 'Outfit colour' };
