// The Control Tower's live Earth: a 3D globe with a flag on every destination. Tap a flag (or a
// country) to open its card: capital, languages, money, the most beautiful place, three fun facts,
// what to eat, the weather month by month, the cost of a day and your flight time.
import * as THREE from 'three';
import { h, replace } from './dom.js';
import { COUNTRIES, countryById, MONTHS, COST_LABEL } from '../../shared/data/countries.js';
import { regionById } from '../../shared/data/regions.js';
import { infoFor } from '../../shared/data/countryInfo.js';
import { travelEstimate, flexibility } from '../../shared/rules.js';
import { departureById } from '../../shared/data/departures.js';
import { prewarmEarth, countryAnchor } from '../ship/ship.js';
import { buildHighlight } from '../ship/earthTex.js';
import { hitTest } from '../gfx/geo.js';
import { audio } from '../audio.js';

const toVec = (lat, lon, r = 1) => {
  const la = THREE.MathUtils.degToRad(lat), lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(lo) * r);
};
// big / famous first, so they keep their flag when the map is crowded
const PRIORITY = ['840', '124', '076', '036', '156', '356', '643', '032', '484', '710', '818', '250', '724', '380', '276', '826', '392', '360', '792', '504'];
const tempColor = (t) => (t < 5 ? '#6aa8ff' : t < 12 ? '#7fd0ff' : t < 18 ? '#9fe6c0' : t <= 29 ? '#f0c35a' : '#ff7a5c');

export function openGlobeRoom(root, { getView, countryId, onClose }) {
  const host = h('div', { class: 'globe-stage' });
  const flagLayer = h('div', { class: 'globe-flags' });
  const card = h('aside', { class: 'globe-card hidden' });
  const search = h('input', { type: 'search', placeholder: 'Find a country…', 'aria-label': 'Find a country' });
  const list = h('datalist', { id: 'globe-countries' }, COUNTRIES.map((c) => h('option', { value: c.name })));
  search.setAttribute('list', 'globe-countries');
  const bg = h('div', { class: 'globe-room' },
    host, flagLayer,
    h('header', { class: 'globe-top' },
      h('div', {}, h('div', { class: 'eyebrow gold' }, 'Control Tower'), h('h2', { class: 'display' }, 'The Living Earth')),
      h('span', { class: 'spacer' }),
      search, list,
      h('button', { class: 'btn holo small', onclick: () => select(COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)].id) }, '🎲 Surprise me'),
      h('button', { class: 'btn ghost small', onclick: () => close() }, 'Close ✕')),
    h('div', { class: 'globe-hint small' }, 'Drag to spin · scroll or pinch to zoom · tap a flag'),
    card);
  root.appendChild(bg);
  search.addEventListener('change', () => { const c = COUNTRIES.find((x) => x.name.toLowerCase() === search.value.trim().toLowerCase()); if (c) { select(c.id); search.value = ''; } });

  // ── three.js scene ──
  const tex = prewarmEarth();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(innerWidth < 760 ? 1.5 : 2, devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#02030a');
  const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 200);
  let dist = 3.6, targetDist = 3.6;
  camera.position.set(0, 0, dist);

  const starGeo = new THREE.BufferGeometry(); const N = 3500, sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 40); sp.set([v.x, v.y, v.z], i * 3); }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.12, color: '#cfe0ff', transparent: true, opacity: 0.8 })));

  const tilt = new THREE.Group(); const spin = new THREE.Group(); tilt.add(spin); scene.add(tilt);
  const T = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const sunDir = new THREE.Vector3(-0.35, 0.45, 1).normalize();
  let hiTex = new THREE.CanvasTexture(buildHighlight([]));
  const mat = new THREE.ShaderMaterial({
    uniforms: { dayTex: { value: T(tex.day) }, nightTex: { value: T(tex.night) }, maskTex: { value: new THREE.CanvasTexture(tex.mask) }, hiTex: { value: hiTex }, sunDir: { value: sunDir }, t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vP; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position,1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: `uniform sampler2D dayTex, nightTex, maskTex, hiTex; uniform vec3 sunDir; uniform float t; varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main(){ vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vP); float d = dot(n, sunDir);
        vec3 day = texture2D(dayTex, vUv).rgb; float ocean = 1.0 - texture2D(maskTex, vUv).r;
        vec3 col = day * (0.18 + 0.95 * max(d, 0.0));
        vec3 hv = normalize(sunDir + v); col += vec3(1.0, 0.95, 0.85) * pow(max(dot(n, hv), 0.0), 70.0) * ocean * 0.35;
        col = mix(col, texture2D(nightTex, vUv).rgb * 1.3 + day * 0.05, smoothstep(0.05, -0.35, d));
        vec4 hi = texture2D(hiTex, vUv); col = mix(col, col * 0.6 + hi.rgb * 0.6, hi.a * (0.8 + 0.2 * sin(t * 2.0)));
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0); col += vec3(0.3, 0.6, 1.0) * fres * 0.6;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), mat);
  spin.add(earth);
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 96, 64), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(tex.clouds), transparent: true, opacity: 0.45, depthWrite: false }));
  spin.add(clouds);
  scene.add(new THREE.DirectionalLight('#ffffff', 1.6).translateOnAxis(sunDir, 10));
  scene.add(new THREE.AmbientLight('#445', 0.8));
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.09, 64, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 wp = modelMatrix*vec4(position,1.); vP = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vP; void main(){ vec3 v = normalize(cameraPosition - vP); float k = smoothstep(0.0, 0.45, -dot(vN, v)); gl_FragColor = vec4(vec3(0.35,0.62,1.0) * k * k * 0.95, 1.0); }',
  }));
  tilt.add(atmo);
  // holographic rings, like the tower's projector
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.32, 1.326, 160), new THREE.MeshBasicMaterial({ color: '#5ff2ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = Math.PI / 2.3; scene.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(1.48, 1.483, 160), new THREE.MeshBasicMaterial({ color: '#f0c35a', transparent: true, opacity: 0.22, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring2.rotation.x = Math.PI / 1.8; ring2.rotation.y = 0.4; scene.add(ring2);

  // ── flags ──
  const order = [...COUNTRIES].sort((a, b) => (PRIORITY.indexOf(b.id) + 1 ? 1 : 0) - (PRIORITY.indexOf(a.id) + 1 ? 1 : 0));
  const pins = order.map((c) => {
    const a = countryAnchor(c.id);
    const el = h('button', { class: 'gflag', title: c.name, onclick: (e) => { e.stopPropagation(); select(c.id); } }, h('span', { class: 'f' }, c.flag), h('span', { class: 'n' }, c.name));
    flagLayer.appendChild(el);
    return { c, el, v: toVec(a.lat, a.lon, 1.01) };
  });

  // ── interaction ──
  let W = 1, H = 1;
  const resize = () => { W = host.clientWidth || 1; H = host.clientHeight || 1; renderer.setSize(W, H, false); camera.aspect = W / H; camera.fov = W < 760 ? 50 : 36; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();
  let auto = 0.06, targetY = null, targetX = 0.3, drag = null, moved = 0;
  tilt.rotation.x = 0.3;
  const dom = renderer.domElement; dom.style.touchAction = 'none';
  const pointers = new Map();
  dom.addEventListener('pointerdown', (e) => { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag = { x: e.clientX, y: e.clientY }; moved = 0; dom.setPointerCapture(e.pointerId); auto = 0; targetY = null; });
  dom.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { // pinch
      const [p1, p2] = [...pointers.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y), dPrev = ui.pinch || d; ui.pinch = d;
      targetDist = Math.max(1.7, Math.min(5, targetDist * (dPrev / d))); return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y; moved += Math.abs(dx) + Math.abs(dy);
    spin.rotation.y += dx * 0.006 * (dist / 3.6);
    targetX = tilt.rotation.x = Math.max(-1.3, Math.min(1.3, tilt.rotation.x + dy * 0.005 * (dist / 3.6)));
  });
  const up = (e) => {
    pointers.delete(e.pointerId); ui.pinch = 0;
    if (drag && moved < 6 && pointers.size === 0) pick(e.clientX, e.clientY);
    if (!pointers.size) drag = null;
  };
  dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
  dom.addEventListener('wheel', (e) => { e.preventDefault(); targetDist = Math.max(1.7, Math.min(5, targetDist * (1 + Math.sign(e.deltaY) * 0.12))); }, { passive: false });
  const ui = { pinch: 0, selected: null };
  const ray = new THREE.Raycaster();
  function pick(cx, cy) {
    const r = dom.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObject(earth)[0];
    if (!hit) return;
    const p = earth.worldToLocal(hit.point.clone()).normalize();
    const lat = THREE.MathUtils.radToDeg(Math.asin(p.y)), lon = THREE.MathUtils.radToDeg(Math.atan2(-p.z, p.x));
    const geo = hitTest(lon, lat);
    if (geo && countryById(geo.id)) select(geo.id);
  }

  function select(id) {
    const c = countryById(id); if (!c) return;
    ui.selected = id;
    hiTex.dispose(); hiTex = new THREE.CanvasTexture(buildHighlight([id], { winner: id })); mat.uniforms.hiTex.value = hiTex;
    const a = countryAnchor(id);
    targetY = -Math.PI / 2 - THREE.MathUtils.degToRad(a.lon); targetX = THREE.MathUtils.degToRad(a.lat) * 0.85; auto = 0;
    targetDist = Math.min(targetDist, 2.8);
    audio.sfx('open');
    renderCard(c);
  }

  function renderCard(c) {
    const v = getView(); const me = v?.players.find((p) => p.id === v.you);
    const info = infoFor(c.id) || {};
    const home = me?.home || '056';
    const tr = travelEstimate(home, c.id);
    const flex = flexibility(c.id);
    const meter = (label, val) => h('div', { class: 'attr' }, h('span', {}, label), h('span', { class: 'meter' }, h('i', { style: { width: `${val}%` } })), h('span', { class: 'tnum muted' }, val));
    const max = Math.max(...c.temp, 30), min = Math.min(...c.temp, 0);
    card.classList.remove('hidden');
    replace(card,
      h('button', { class: 'gc-x', onclick: () => { card.classList.add('hidden'); ui.selected = null; hiTex.dispose(); hiTex = new THREE.CanvasTexture(buildHighlight([])); mat.uniforms.hiTex.value = hiTex; }, 'aria-label': 'Close card' }, '✕'),
      h('div', { class: 'gc-head' }, h('span', { class: 'gc-flag' }, c.flag), h('div', {}, h('h3', {}, c.name), h('div', { class: 'small muted' }, `${regionById(c.region)?.icon || ''} ${regionById(c.region)?.name || ''}`))),
      h('div', { class: 'gc-facts-row' },
        h('div', {}, h('small', {}, 'Capital'), h('b', {}, info.capital || '—')),
        h('div', {}, h('small', {}, 'Language'), h('b', {}, info.languages || '—')),
        h('div', {}, h('small', {}, 'Money'), h('b', {}, info.currency || '—'))),
      info.bestPlace ? h('section', { class: 'gc-best' }, h('div', { class: 'eyebrow gold' }, '📸 The most beautiful place'), h('b', {}, info.bestPlace), h('div', { class: 'small' }, info.bestWhy)) : null,
      info.facts ? h('section', {}, h('div', { class: 'eyebrow' }, '🤓 3 fun facts'), h('ol', { class: 'gc-fun' }, info.facts.map((f) => h('li', {}, f)))) : null,
      h('section', {}, h('div', { class: 'eyebrow' }, `🌡️ Weather in ${c.refCity} (avg °C)`),
        h('div', { class: 'gc-temps' }, c.temp.map((t, m) => h('div', { class: 'tcol', title: `${MONTHS[m]}: ${t}°C` }, h('span', { class: 'tv tnum' }, t), h('i', { style: { height: `${8 + ((t - min) / Math.max(1, max - min)) * 52}px`, background: tempColor(t) } }), h('span', { class: 'tm' }, MONTHS[m][0])))),
        h('div', { class: 'small muted' }, flex.months ? `Comfortable (18–29 °C): ${flex.best.map((m) => MONTHS[m]).join(', ')}` : 'Never in the 18–29 °C comfort zone — pack accordingly!')),
      h('section', { class: 'gc-grid' },
        h('div', {}, h('small', {}, '🍽️ Must eat'), h('b', {}, info.dish || '—')),
        h('div', {}, h('small', {}, '💶 A day there'), h('b', {}, `~€${c.dailyEUR} · ${COST_LABEL[c.cost]}`)),
        tr ? h('div', {}, h('small', {}, `✈️ From ${departureById(home)?.city || 'home'}`), h('b', {}, `~${tr.hours} h · ~€${tr.fare}`)) : null,
        h('div', {}, h('small', {}, '✨ Known for'), h('b', {}, c.highlights))),
      h('section', {}, meter('Sea', c.sea), meter('Mountains', c.mountains), meter('Nightlife', c.nightlife), meter('Nature', c.nature), meter('Culture', c.culture)),
      h('div', { class: 'muted', style: { fontSize: '11px' } }, 'Temperatures: climate normals for the reference city. Scores, costs and flights are estimates.'));
  }

  // ── loop ──
  let raf = 0, last = performance.now(), closed = false;
  const tmp = new THREE.Vector3(), camDir = new THREE.Vector3();
  function loop(now) {
    if (closed) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    mat.uniforms.t.value = now / 1000;
    if (targetY !== null) {
      let d = targetY - spin.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      spin.rotation.y += d * Math.min(1, dt * 3.5);
      if (Math.abs(d) < 0.002) targetY = null;
    } else spin.rotation.y += auto * dt;
    if (!drag) tilt.rotation.x += (targetX - tilt.rotation.x) * Math.min(1, dt * 3);
    clouds.rotation.y += dt * 0.008;
    ring.rotation.z += dt * 0.05; ring2.rotation.z -= dt * 0.03;
    dist += (targetDist - dist) * Math.min(1, dt * 5);
    camera.position.set(0, 0, dist);
    renderer.render(scene, camera);
    // flags: front side only, decluttered, bigger when zoomed in
    camDir.copy(camera.position).normalize();
    const placed = [];
    const minGap = 30 * (3.6 / dist) ** -0.2;
    const zoomK = Math.max(0.8, Math.min(1.6, 3.4 / dist));
    for (const pin of pins) {
      tmp.copy(pin.v).applyMatrix4(earth.matrixWorld);
      const facing = tmp.clone().normalize().dot(camDir);
      if (facing < 0.25) { pin.el.style.display = 'none'; continue; }
      tmp.project(camera);
      const x = (tmp.x * 0.5 + 0.5) * W, y = (-tmp.y * 0.5 + 0.5) * H;
      const sel = pin.c.id === ui.selected;
      if (!sel && placed.some(([px, py]) => Math.abs(px - x) < minGap && Math.abs(py - y) < minGap * 0.7)) { pin.el.style.display = 'none'; continue; }
      placed.push([x, y]);
      pin.el.style.display = '';
      pin.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${(sel ? 1.35 : 1) * zoomK * (0.75 + 0.25 * facing)})`;
      pin.el.classList.toggle('sel', sel);
      pin.el.style.zIndex = sel ? 5 : 1;
    }
  }
  raf = requestAnimationFrame(loop);
  if (countryId) setTimeout(() => select(countryId), 300);

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', onKey);
  function close() {
    if (closed) return; closed = true;
    cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('keydown', onKey);
    renderer.dispose(); scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    bg.remove(); onClose?.();
  }
  return { close, refresh: () => {}, kind: 'globe', select };
}
