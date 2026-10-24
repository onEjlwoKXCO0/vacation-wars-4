// Visual-novel dialogue box for Moon residents: pixel portrait, typewriter text and
// multiple-choice answers (click, tap, or keys 1–4). No photos.
import { h, toast } from './dom.js';
import { TALKS } from '../../shared/data/talks.js';
import { npcById, premonitionText } from '../../shared/data/npcs.js';
import { countryById } from '../../shared/data/countries.js';
import { portrait } from '../gfx/sprites.js';
import { audio } from '../audio.js';

const NAMES = { alice: 'Alice', nico: 'Nico' };

// Conversations remember you: how many times you met each resident, and story flags set by your answers
// (stored on this device only — they only change dialogue, never the game).
const MEM_KEY = 'vw4.talkmem';
const memLoad = () => { try { return JSON.parse(localStorage.getItem(MEM_KEY)) || { met: {}, flags: {} }; } catch { return { met: {}, flags: {} }; } };
const memSave = (m) => { try { localStorage.setItem(MEM_KEY, JSON.stringify(m)); } catch {} };
const pick = (v) => (Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v);

export function openTalk(root, npcId, { net, getView, onFx, openMarket, onAction, who, onClose }) {
  const npc = who || npcById(npcId);
  const tree = TALKS[npcId];
  if (!npc || !tree) return null;
  const mem = memLoad();
  mem.met[npcId] = (mem.met[npcId] || 0) + 1; memSave(mem);
  const state = () => {
    const v = getView();
    const me = v.players.find((p) => p.id === v.you) || {};
    const pre = me.premonition;
    return { phase: v.phase, francePromise: !!v.me?.flags?.francePromise, vip: !!me.vip, bracelet: !!me.bracelet, premonition: !!pre, premonitionLine: premonitionText(pre && countryById(pre.countryId)),
      met: mem.met[npcId], flag: (k) => !!mem.flags[k], name: me.name || 'traveller', role: v.me?.role || null, wallet: v.me?.wallet ?? 0 };
  };

  const pic = h('canvas', { class: 'talk-portrait', width: 64, height: 64 });
  const nameEl = h('div', { class: 'talk-name' });
  const titleEl = h('div', { class: 'talk-title' }, npc.title);
  const textEl = h('div', { class: 'talk-text' });
  const choicesEl = h('div', { class: 'talk-choices' });
  const box = h('div', { class: 'talk' },
    h('div', { class: 'talk-face' }, pic, nameEl),
    h('div', { class: 'talk-main' }, h('div', { class: 'talk-head' }, titleEl, h('button', { class: 'talk-x', onclick: () => close(), 'aria-label': 'Close' }, '✕')), textEl, choicesEl));
  box.style.setProperty('--npc', npc.color);
  const bg = h('div', { class: 'talk-bg', onclick: (e) => { if (e.target === bg) skipOrNothing(); } }, box);
  root.appendChild(bg);

  let typing = null, full = '', busy = false, closed = false;
  function setFace(who, mood) {
    const spec = who === 'nico' ? npc.look2 : npc.look;
    const src = portrait(spec, mood || 'happy');
    const g = pic.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, 64, 64);
    g.drawImage(src, 0, 0, 64, 64);
    nameEl.textContent = who ? NAMES[who] : npc.name;
  }
  function type(str, done) {
    clearInterval(typing);
    full = str; let i = 0;
    textEl.textContent = '';
    typing = setInterval(() => {
      i += 2;
      textEl.textContent = full.slice(0, i);
      if (i % 6 === 0) audio.sfx('tick');
      if (i >= full.length) { clearInterval(typing); typing = null; done(); }
    }, 22);
  }
  function skipOrNothing() { if (typing) { clearInterval(typing); typing = null; textEl.textContent = full; showChoices(); } }
  let current = null;
  function showChoices() {
    const st = state();
    const list = (current.choices || [{ t: 'Continue ▸', go: current.next }]).filter((c) => !c.if || c.if(st));
    current.shown = list;
    choicesEl.replaceChildren(...list.map((c, i) =>
      h('button', { class: 'talk-choice', onclick: () => choose(c) }, h('span', { class: 'talk-key' }, String(i + 1)), c.t)));
    choicesEl.classList.add('in');
  }
  function go(id) {
    const node = tree.nodes[id];
    if (!node) return close();
    current = node;
    choicesEl.classList.remove('in');
    choicesEl.replaceChildren();
    setFace(node.who, node.mood);
    const say = pick(typeof node.say === 'function' ? node.say(state()) : node.say);
    if (node.fx) onFx?.(node.fx);
    if (node.clear) { for (const k of [].concat(node.clear)) delete mem.flags[k]; memSave(mem); }
    if (node.set) { for (const k of [].concat(node.set)) mem.flags[k] = true; memSave(mem); }
    type(say, showChoices);
  }
  async function choose(c) {
    if (busy) return;
    if (typing) return skipOrNothing();
    audio.sfx('blip');
    if (c.deal) {
      busy = true;
      const res = await net.act({ type: 'npc:deal', deal: c.deal, accept: c.accept !== false });
      busy = false;
      if (res && res.ok === false) { toast(res.error || 'Not now.', 'bad'); return; }
      audio.sfx('coin');
      // wait for the server's new state so the next line can use it
      const want = { premonition: (st) => st.premonition, bracelet: (st) => st.bracelet, vip: (st) => st.vip === (c.accept !== false), france: (st) => st.francePromise === (c.accept !== false) }[c.deal];
      for (let i = 0; want && i < 20 && !want(state()); i++) await new Promise((r) => setTimeout(r, 60));
    }
    if (c.fx) onFx?.(c.fx);
    if (c.set) { for (const k of [].concat(c.set)) mem.flags[k] = true; memSave(mem); }
    if (c.action === 'market') { close(); openMarket?.(); return; }
    if (c.action) { close(); onAction?.(c.action); return; }
    if (!c.go) return close();
    go(c.go);
  }
  const onKey = (e) => {
    if (e.code === 'Escape') return close();
    const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
    if (m && current && !typing) { const c = (current.shown || current.choices || [])[Number(m[1]) - 1]; if (c) { e.preventDefault(); e.stopPropagation(); choose(c); } }
    else if ((e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') && typing) { e.preventDefault(); e.stopPropagation(); skipOrNothing(); }
  };
  addEventListener('keydown', onKey, true);
  function close() {
    if (closed) return;
    closed = true;
    clearInterval(typing);
    removeEventListener('keydown', onKey, true);
    bg.classList.add('out');
    setTimeout(() => bg.remove(), 180);
    onClose?.();
  }
  audio.sfx('open');
  go(tree.start(state()));
  return { close, refresh() {} };
}
