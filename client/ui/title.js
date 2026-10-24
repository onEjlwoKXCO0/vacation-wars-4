// Title / lobby entry: create a crew, join with an invite code, or play solo with bots.
import { h, store } from './dom.js';
import { audio } from '../audio.js';
import { filmBackground } from './film.js';

export function showTitle(root, { demoOnly, onChoose, onReplayIntro, error }) {
  const el = h('div', { class: 'screen', id: 'title' });
  const bg = h('canvas', { class: 'bg' });
  const params = new URLSearchParams(location.search);
  const codeInput = h('input', { type: 'text', id: 'join-code', maxlength: 5, placeholder: 'CODE', 'aria-label': 'Invite code', value: (params.get('code') || '').toUpperCase() });
  const saved = store.get('session');
  const err = h('div', { class: 'toast bad', style: { display: error ? 'block' : 'none' } }, error || '');

  const go = (choice) => { audio.unlock(); audio.sfx('open'); onChoose(choice); };
  const onlineBlock = demoOnly ? [
    h('div', { class: 'privacy' }, 'This preview runs the whole game on your device with bot crewmates. To play together from different countries, run the VW4 server and share its link — the README explains how.'),
  ] : [
    saved ? h('button', { class: 'btn solid big', onclick: () => go({ mode: 'online', code: saved.code, resume: true }) }, `Rejoin crew ${saved.code}`) : null,
    h('button', { class: `btn ${saved ? '' : 'solid'} big`, onclick: () => go({ mode: 'online', create: true }) }, 'Create a crew'),
    h('div', { class: 'join-row' }, codeInput, h('button', { class: 'btn holo', onclick: () => { const c = codeInput.value.trim().toUpperCase(); if (c.length >= 4) go({ mode: 'online', code: c }); else codeInput.focus(); } }, 'Join')),
  ];
  codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.querySelector('.join-row .btn').click(); });

  const card = h('div', { class: 'panel gold title-card' },
    h('div', { class: 'eyebrow gold', style: { textAlign: 'center' } }, 'Mahmoud presents'),
    h('h1', { class: 'display logo' }, 'VACATION WARS', h('small', {}, 'IV · THE LUNAR GAMBIT')),
    h('div', { class: 'tagline' }, 'Same crew. Different dreams. One destination.'),
    err,
    h('div', { class: 'choice' },
      ...onlineBlock,
      h('button', { class: `btn ${demoOnly ? 'solid big' : 'ghost'}`, onclick: () => go({ mode: 'local' }) }, demoOnly ? 'Play the solo demo with bot crewmates' : 'Solo demo with bots'),
    ),
    h('div', { class: 'row', style: { justifyContent: 'center' } },
      h('button', { class: 'btn ghost small', onclick: onReplayIntro }, 'Replay intro'),
      h('button', { class: 'btn ghost small', onclick: (e) => { audio.unlock(); audio.setMuted(!audio.muted); e.target.textContent = audio.muted ? 'Sound: off' : 'Sound: on'; } }, audio.muted ? 'Sound: off' : 'Sound: on'),
    ),
  );
  el.append(bg, card);
  root.appendChild(el);
  filmBackground(bg);
  return () => el.remove();
}

