// Tiny DOM helpers.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
/**
 * Swap an element's children WITHOUT losing the reader's place: the scroll position of the element,
 * of its scrolling ancestors and of scrolling descendants (matched by class) is restored afterwards.
 */
export function replace(el, ...children) {
  const saved = [];
  for (let a = el; a && a !== document.body; a = a.parentElement) if (a.scrollTop || a.scrollLeft) saved.push([a, a.scrollTop, a.scrollLeft]);
  const inner = [];
  for (const d of el.querySelectorAll('*')) if (d.scrollTop > 0 && d.className && typeof d.className === 'string') inner.push([d.className, d.scrollTop]);
  clear(el); append(el, children);
  for (const [a, t, l] of saved) { a.scrollTop = t; a.scrollLeft = l; }
  for (const [cls, t] of inner) { const n = el.getElementsByClassName(cls.trim())[0]; if (n) n.scrollTop = t; }
  return el;
}

export function toast(text, tone = 'info', ms = 3600) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = h('div', { class: `toast ${tone}` }, text);
  box.appendChild(t);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => t.remove(), ms);
}

export const store = {
  get(k, fallback = null) { try { const v = localStorage.getItem('vw4.' + k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem('vw4.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem('vw4.' + k); } catch { /* storage unavailable */ } },
};

export function fmtVC(n) { return n === null || n === undefined ? '—' : Math.round(n).toLocaleString('en-US'); }
export function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export const isTouch = () => matchMedia('(pointer: coarse)').matches;
