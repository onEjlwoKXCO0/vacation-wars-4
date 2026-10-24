// Opening cinematic: starfield → title → golden mission crawl → descent to the Moon campus.
import { h, store } from './dom.js';
import { audio } from '../audio.js';
import { prewarmEarth } from '../ship/ship.js';
import { renderGlobeImage } from '../ship/earthTex.js';

const CRAWL = [
  ['ep', 'CHAPTER IV'],
  ['h2', 'THE LUNAR GAMBIT'],
  ['p', 'It is a time of holiday unrest. A crew of friends, scattered across four nations, has failed three times to agree on a single destination.'],
  ['p', 'Group chats lie in ruins. Spreadsheets have been abandoned. Somewhere, a shared calendar quietly weeps.'],
  ['p', 'Now a mysterious game master in a dolphin shirt has summoned the crew to his secret campus on the Moon, where every coin, every bet and every alliance will decide where they fly next….'],
];

export function playIntro(root, { onDone }) {
  const seen = store.get('introSeen', false);
  const el = h('div', { class: 'screen', id: 'intro' });
  const cv = h('canvas');
  const crawlWrap = h('div', { class: 'crawl-wrap' });
  const crawl = h('div', { class: 'crawl' }, CRAWL.map(([t, s]) => t === 'ep' ? h('div', { class: 'ep' }, s) : t === 'h2' ? h('h2', {}, s) : h('p', {}, s)));
  crawlWrap.appendChild(crawl);
  const logo = h('div', { class: 'intro-logo' });
  const skip = h('button', { class: 'btn ghost small intro-skip hidden', onclick: () => finish() }, 'Skip intro ▸');
  const start = h('div', { class: 'intro-start' },
    h('div', { class: 'inner' },
      h('div', { class: 'eyebrow gold' }, 'Incoming transmission'),
      h('div', { class: 'display', style: { fontSize: 'clamp(40px, 9vw, 84px)', lineHeight: '0.95' } }, 'VACATION', h('br'), 'WARS 4'),
      h('button', { class: 'btn solid big', onclick: begin, id: 'begin-btn' }, 'Begin transmission'),
      seen ? h('button', { class: 'btn ghost small', onclick: () => { audio.unlock(); finish(); } }, 'Skip straight to the Moon') : h('div', { class: 'muted small' }, 'Sound on for the full experience.'),
    ));
  el.append(cv, crawlWrap, logo, skip, start);
  root.appendChild(el);

  const ctx = cv.getContext('2d');
  let W = 0, Hh = 0;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const resize = () => { W = cv.clientWidth; Hh = cv.clientHeight; cv.width = W * dpr; cv.height = Hh * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  resize(); addEventListener('resize', resize);
  const stars = Array.from({ length: 700 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random(), tw: Math.random() * 6 }));
  const craters = Array.from({ length: 60 }, () => ({ a: Math.random() * Math.PI - Math.PI, d: Math.random() ** 0.7, r: 0.01 + Math.random() ** 2 * 0.05 }));

  let t0 = null, raf = 0, done = false, phase = 'wait';
  let globe = null;
  // Build the Earth textures while the player looks at the start screen (also warms the spacecraft scene).
  setTimeout(() => { try { globe = renderGlobeImage(prewarmEarth(), 360); } catch (e) { globe = null; } }, 250);
  function begin() {
    audio.unlock();
    audio.music('intro');
    start.remove();
    phase = 'run'; t0 = performance.now();
    setTimeout(() => skip.classList.remove('hidden'), seen ? 0 : 6000);
    // timeline (ms), matched to the 49 s intro track
    const T = { tagline: 400, logo: 3600, crawl: 7400, crawlEnd: 47000, moon: 44500, end: 53500 };
    const tag = h('div', { class: 'intro-logo' }, h('div', { style: { color: '#f3cf5a', fontFamily: 'var(--f-ui)', fontWeight: 700, fontSize: 'clamp(24px,4.2vw,46px)', lineHeight: 1.25, textAlign: 'center', letterSpacing: '.02em', maxWidth: '86vw', transition: 'opacity 1s', opacity: 0, textShadow: '0 0 24px rgba(243,207,90,.35)' } }, 'Not so long ago, somewhere between Lisbon, Skopje, Kraków and Marrakech…'));
    el.appendChild(tag);
    setTimeout(() => (tag.firstChild.style.opacity = 1), T.tagline);
    setTimeout(() => (tag.firstChild.style.opacity = 0), T.logo - 900);
    setTimeout(() => {
      tag.remove();
      const word = h('div', { class: 'display', style: { transition: 'transform 4.2s cubic-bezier(.4,0,.8,.6), opacity 4.2s', transform: 'scale(1.6)', opacity: 1 } }, 'VACATION', h('br'), 'WARS');
      logo.appendChild(word);
      requestAnimationFrame(() => requestAnimationFrame(() => { word.style.transform = 'scale(0.02)'; word.style.opacity = 0; }));
    }, T.logo);
    setTimeout(() => {
      const ch = crawl.offsetHeight;
      // Slow, readable crawl: about 45 px/s in the plane of the text.
      crawl.animate([{ transform: `rotateX(26deg) translateY(${ch * 1.02}px)`, opacity: 1 }, { opacity: 1, offset: 0.88 }, { transform: `rotateX(26deg) translateY(${-ch * 1.25}px)`, opacity: 0 }], { duration: T.crawlEnd - T.crawl, easing: 'linear', fill: 'forwards' });
    }, T.crawl);
    setTimeout(() => { phase = 'moon'; }, T.moon);
    setTimeout(finish, T.end);
  }

  function finish() {
    if (done) return;
    done = true;
    store.set('introSeen', true);
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, fill: 'forwards' });
    setTimeout(() => { cancelAnimationFrame(raf); removeEventListener('resize', resize); el.remove(); onDone(); }, 700);
  }

  let moonT0 = null;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, Hh);
    const speed = phase === 'wait' ? 0.00004 : 0.00012;
    let camY = 0;
    if (phase === 'moon') { if (!moonT0) moonT0 = now; camY = Math.min(1, (now - moonT0) / 8000); }
    const ease = camY * camY * (3 - 2 * camY);
    for (const s of stars) {
      s.z -= speed * 16; if (s.z <= 0.02) { s.z = 1; s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; }
      const sx = W / 2 + (s.x / s.z) * W * 0.5, sy = Hh / 2 + (s.y / s.z) * Hh * 0.5 - ease * Hh * 0.6;
      if (sx < 0 || sx > W || sy < 0 || sy > Hh) continue;
      const b = Math.min(1, (1 - s.z) * 1.4) * (0.7 + 0.3 * Math.sin(now / 400 + s.tw));
      ctx.fillStyle = `rgba(230,236,255,${b})`;
      const sz = (1 - s.z) * 2.2;
      ctx.fillRect(sx, sy, sz, sz);
    }
    if (phase === 'moon') drawMoon(ease, now);
  }

  function drawMoon(e, now) {
    const ex = W * 0.72, ey = Hh * (0.4 - e * 0.16), er = Math.min(W, Hh) * (0.1 + e * 0.05);
    const glow = ctx.createRadialGradient(ex, ey, er * 0.95, ex, ey, er * 1.5);
    glow.addColorStop(0, 'rgba(110,170,255,.45)'); glow.addColorStop(1, 'rgba(110,170,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(ex, ey, er * 1.5, 0, Math.PI * 2); ctx.fill();
    if (globe) ctx.drawImage(globe, ex - er, ey - er, er * 2, er * 2);
    else { ctx.fillStyle = '#2a6fd0'; ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill(); }
    const R = W * 1.6, cx = W / 2, cy = Hh + R - Hh * (0.08 + e * 0.6);
    const mg = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.9, R * 0.1, cx, cy, R);
    mg.addColorStop(0, '#d9dbe3'); mg.addColorStop(0.7, '#8a8d99'); mg.addColorStop(1, '#3a3c46');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    for (const c of craters) {
      const ang = -Math.PI / 2 + (c.a + Math.PI / 2) * 0.35, dist = R * (1 - c.d * 0.25);
      const x = cx + Math.cos(ang) * dist, y = cy + Math.sin(ang) * dist, r = c.r * W;
      ctx.fillStyle = 'rgba(232,234,242,.18)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.06, r * 1.08, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(48,50,60,.42)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(80,82,94,.5)'; ctx.beginPath(); ctx.ellipse(x + r * 0.12, y + r * 0.08, r * 0.7, r * 0.26, 0, 0, Math.PI * 2); ctx.fill();
    }
    const hy = cy - R, n = 46;
    for (let i = 0; i < n; i++) {
      const x = cx + (i / n - 0.5) * W * (0.25 + e * 0.6), y = hy + 10 + Math.abs(Math.sin(i * 12.9)) * 18 * (1 + e * 3);
      const col = i % 5 === 0 ? '95,242,255' : i % 3 === 0 ? '240,195,90' : '255,226,170';
      const tw = 0.6 + 0.4 * Math.sin(now / 300 + i);
      const r = (1.5 + e * 5) * tw;
      const gg = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      gg.addColorStop(0, `rgba(${col},0.95)`); gg.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = gg; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    }
    ctx.restore();
    if (e > 0.93) { ctx.fillStyle = `rgba(255,255,255,${(e - 0.93) / 0.07 * 0.7})`; ctx.fillRect(0, 0, W, Hh); }
  }
  raf = requestAnimationFrame(frame);
}
