// Heads-up display: wallet, role, crew, invite code, Mahmoud's speech, prompts, emotes, touch controls.
import { h, replace, toast, fmtVC, isTouch } from './dom.js';
import { roleById } from '../../shared/data/roles.js';
import { avatarURL, mahmoudPortrait } from '../gfx/sprites.js';
import { audio } from '../audio.js';

const EMOTES = [['wave', '👋'], ['heart', '❤️'], ['laugh', '😂'], ['dance', '💃'], ['thumbs', '👍'], ['party', '🎉']];
const WHO = { mahmoud: 'MAHMOUD · GAME MASTER', pharaoh: 'THE PHARAOH OF DISCORD', baby: 'BABY MAHMOUD' };

export function createHUD(root, { net, getView, onOpen, onInteract, onEmote, onJoystick, onMenu, onJump, onHelp, onObjective }) {
  const top = h('div', { class: 'hud-top' });
  const walletChip = h('button', { class: 'hud-chip', 'aria-label': 'Wallet and passport', onclick: () => onOpen({ kind: 'wallet' }) });
  const crew = h('div', { class: 'crew' });
  const codeChip = h('button', { class: 'hud-chip code-chip', title: 'Copy invite link', onclick: copyInvite });
  const menuBtn = h('button', { class: 'icon-btn', 'aria-label': 'Menu', onclick: () => onMenu() }, '☰');
  const soundBtn = h('button', { class: 'icon-btn', 'aria-label': 'Toggle sound', onclick: () => { audio.unlock(); audio.setMuted(!audio.muted); soundBtn.textContent = audio.muted ? '🔇' : '🔊'; } }, audio.muted ? '🔇' : '🔊');
  const helpBtn = h('button', { class: 'icon-btn', 'aria-label': 'Rules & help', title: 'Rules & help', onclick: () => onHelp?.() }, '?');
  top.append(walletChip, h('div', { class: 'spacer' }), crew, codeChip, helpBtn, soundBtn, menuBtn);
  const objective = h('div', { class: 'panel objective hidden', role: 'status' });
  const kissBtn = h('button', { class: 'kiss-btn hidden', title: 'Send a kiss (K)', 'aria-label': 'Send a kiss', onclick: () => { audio.unlock(); onEmote('kiss'); } }, '💋');

  const portrait = h('canvas', { class: 'pixel', width: 48, height: 48 });
  portrait.getContext('2d').drawImage(mahmoudPortrait('happy'), 0, 0);
  const speechTxt = h('div', { class: 'txt' });
  const whoEl = h('div', { class: 'who' }, WHO.mahmoud);
  const speech = h('div', { class: 'panel gold speech hidden', role: 'status', onclick: () => nextLine(true) }, portrait, h('div', { style: { minWidth: 0 } }, whoEl, speechTxt));
  const prompt = h('button', { class: 'panel prompt hidden', onclick: () => onInteract() });
  const emotes = h('div', { class: 'emotes' }, EMOTES.map(([id, e], i) => h('button', { title: `${id} (${i + 1})`, 'aria-label': id, onclick: () => { audio.unlock(); onEmote(id); } }, e)));
  const netBanner = h('div', { class: 'panel netstatus hud-chip hidden' }, '📡 Reconnecting to the Moon…');
  const els = [top, speech, prompt, emotes, netBanner, objective, kissBtn];

  // touch controls
  let joy, actBtn;
  if (isTouch()) {
    const knob = h('div', { class: 'knob' });
    joy = h('div', { class: 'joystick', 'aria-hidden': 'true' }, knob);
    actBtn = h('button', { class: 'act-btn hidden', onclick: () => onInteract() }, 'GO');
    const jumpBtn = h('button', { class: 'jump-btn', 'aria-label': 'Jump', onclick: () => onJump?.() }, 'X');
    jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); onJump?.(); }, { passive: false });
    els.push(jumpBtn);
    let id = null;
    const move = (e) => {
      const t = [...e.changedTouches].find((x) => x.identifier === id); if (!t) return;
      const r = joy.getBoundingClientRect();
      let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy), max = r.width / 2 - 10;
      if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      onJoystick(dx / max, dy / max);
      e.preventDefault();
    };
    joy.addEventListener('touchstart', (e) => { id = e.changedTouches[0].identifier; move(e); }, { passive: false });
    joy.addEventListener('touchmove', move, { passive: false });
    const end = (e) => { if ([...e.changedTouches].some((x) => x.identifier === id)) { id = null; knob.style.transform = ''; onJoystick(0, 0); } };
    joy.addEventListener('touchend', end); joy.addEventListener('touchcancel', end);
    els.push(joy, actBtn);
  }
  root.append(...els);

  // speech queue with typewriter effect
  const queue = [];
  let shownId = 0, typing = null, hideTimer = null;
  function pushLines(lines) {
    for (const l of lines) if (l.id > shownId) { queue.push(l); shownId = l.id; }
    if (queue.length > 2) queue.splice(0, queue.length - 2); // never lag behind the game
    if (!typing && queue.length) nextLine();
  }
  function nextLine(manual) {
    clearTimeout(hideTimer);
    if (typing && manual) { clearInterval(typing.t); speechTxt.textContent = typing.text; typing = null; hideTimer = setTimeout(() => nextLine(), 3500); return; }
    const line = queue.shift();
    if (!line) { if (manual || !typing) speech.classList.add('hidden'); return; }
    speech.classList.remove('hidden');
    const mood = line.who === 'pharaoh' ? 'pharaoh' : /WHAT|!!!|CHAOS|furious/.test(line.text) ? 'shock' : /cheat|honest|odds/.test(line.text) ? 'smug' : 'happy';
    const g = portrait.getContext('2d'); g.clearRect(0, 0, 48, 48); g.drawImage(mahmoudPortrait(mood), 0, 0);
    portrait.style.transform = line.who === 'baby' ? 'scale(.8) translateY(10%)' : '';
    whoEl.textContent = WHO[line.who] || WHO.mahmoud;
    speech.classList.toggle('pharaoh', line.who === 'pharaoh');
    speechTxt.textContent = '';
    let i = 0;
    const text = line.text;
    typing = { text, t: setInterval(() => {
      i += 2; speechTxt.textContent = text.slice(0, i);
      if (i % 6 === 0) audio.sfx('blip');
      if (i >= text.length) { clearInterval(typing.t); typing = null; hideTimer = setTimeout(() => nextLine(), queue.length ? 1200 : document.querySelector('.ship-ui.deciding') ? 3500 : 6500); }
    }, 28) };
  }

  function copyInvite() {
    const v = getView();
    if (!v || net.mode === 'local') return toast('Solo demo: there is no invite link. Run the VW4 server to play with friends.', 'info');
    const link = `${location.origin}${location.pathname}?code=${v.code}`;
    const done = () => toast(`Invite link copied: ${link}`, 'good');
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, () => toast(`Share this link: ${link}`, 'info', 8000));
    else toast(`Share this link: ${link}`, 'info', 8000);
  }

  let lastKey = '';
  return {
    update(v) {
      const me = v.players.find((p) => p.id === v.you);
      const role = roleById(v.me.role);
      const key = JSON.stringify([v.me.wallet, v.me.role, v.players.map((p) => [p.id, p.name, p.connected, p.boarded, p.role, p.appearance, p.isHost]), v.code]);
      if (key !== lastKey) {
        lastKey = key;
        replace(walletChip, h('span', { class: 'wallet tnum' }, fmtVC(v.me.wallet), h('small', {}, 'VC')), role ? h('span', { title: role.detail }, `${role.icon} ${role.name}`) : h('span', { class: 'muted' }, 'no role yet'));
        replace(crew, v.players.filter((p) => p.onboarded).map((p) => h('img', {
          src: avatarURL(p, 32), alt: p.name,
          class: [p.connected || p.isBot ? '' : 'off', p.isHost ? 'host' : '', p.boarded ? 'boarded' : ''].join(' '),
          title: `${p.name}${p.isBot ? ' (bot)' : ''} · ${roleById(p.role)?.name || 'no role'}${p.isHost ? ' · host' : ''}${p.boarded ? ' · aboard' : ''}${p.connected || p.isBot ? '' : ' · offline'}`,
        })));
        codeChip.textContent = net.mode === 'local' ? 'SOLO DEMO' : `CREW ${v.code} ⧉`;
        void me;
      }
      pushLines(v.speech || []);
    },
    setPrompt(zone) {
      prompt.classList.toggle('hidden', !zone);
      if (actBtn) actBtn.classList.toggle('hidden', !zone);
      if (zone) replace(prompt, h('kbd', {}, isTouch() ? 'TAP' : 'E'), zone.label);
    },
    setScene(scene) {
      emotes.classList.toggle('hidden', scene !== 'campus');
      if (joy) joy.classList.toggle('hidden', scene !== 'campus');
      root.querySelector('.jump-btn')?.classList.toggle('hidden', scene !== 'campus');
      if (scene !== 'campus') { objective.classList.add('hidden'); kissBtn.classList.add('hidden'); }
      if (scene !== 'campus') { prompt.classList.add('hidden'); if (actBtn) actBtn.classList.add('hidden'); }
      speech.classList.toggle('ship', scene === 'ship');
    },
    /** steps: [{label, done, now}] — the first-time guidance checklist. */
    setObjective(o) {
      objective.classList.toggle('hidden', !o);
      if (!o) return;
      const key = JSON.stringify(o);
      if (objective.dataset.key === key) return;
      objective.dataset.key = key;
      replace(objective, h('div', { class: 'eyebrow gold' }, o.title || 'What to do'),
        h('ol', {}, o.steps.map((s) => h('li', { class: s.done ? 'done' : s.now ? 'now' : '' }, s.done ? '✓ ' : s.now ? '▸ ' : '', s.label,
          s.action && !s.done ? h('button', { class: 'btn small solid', style: { marginLeft: '8px', pointerEvents: 'auto' }, onclick: () => onObjective?.(s.action) }, s.actionLabel || 'Go') : null))),
        o.hint ? h('div', { class: 'small muted' }, o.hint) : null);
    },
    setKiss(show) { kissBtn.classList.toggle('hidden', !show); },
    setNet(status) { netBanner.classList.toggle('hidden', status === 'online'); },
    seedSpeech(lines) { shownId = Math.max(0, ...(lines || []).map((l) => l.id)) - 1; },
    destroy() { els.forEach((e) => e.remove()); },
  };
}
