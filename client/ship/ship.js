// Spacecraft bridge: a real-time 3D Earth seen through the cockpit window, with
// holographic probability beams over the candidate countries. Rendering only —
// it never decides anything; it visualises the authoritative state it is given.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildEarthTextures, buildClouds, buildHighlight } from './earthTex.js';
import { countryById } from '../../shared/data/countries.js';
import { regionById } from '../../shared/data/regions.js';
import { countryGeo } from '../gfx/geo.js';

let texCache = null;
export function prewarmEarth() { if (!texCache) texCache = { ...buildEarthTextures(), clouds: buildClouds() }; return texCache; }

const toVec = (lat, lon, r = 1) => {
  const la = THREE.MathUtils.degToRad(lat), lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(lo) * r);
};

/** Where a country's pin goes: centroid of its main landmass, falling back to the reference city. */
export function countryAnchor(id, kind = 'country') {
  if (kind === 'region') { const r = regionById(id); return r ? { lon: r.lon, lat: r.lat } : { lon: 0, lat: 0 }; }
  if (id === '010') return { lon: 0, lat: -80 };
  const geo = countryGeo(id);
  if (geo && geo.centroid) return { lon: geo.centroid[0], lat: geo.centroid[1] };
  const c = countryById(id);
  return c ? { lon: c.lon, lat: c.lat } : { lon: 0, lat: 0 };
}

export function createShip(container) {
  const tex = prewarmEarth();
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(container.clientWidth < 760 ? 1.25 : 1.75, devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.domElement.className = 'gl';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#010208');
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 200);
  camera.position.set(0, 0.12, 4.1);

  // stars
  const starGeo = new THREE.BufferGeometry();
  const N = 5000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 40);
    pos.set([v.x, v.y, v.z], i * 3);
    const t = Math.random();
    const c = new THREE.Color().setHSL(0.6 - t * 0.5, 0.4, 0.7 + Math.random() * 0.3);
    col.set([c.r, c.g, c.b], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.12, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.95 }));
  scene.add(stars);

  // Earth (tilt group → spin group)
  const tilt = new THREE.Group(); const spin = new THREE.Group();
  tilt.add(spin); scene.add(tilt);
  tilt.position.set(0, -0.05, 0);
  const T = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const dayTex = T(tex.day), nightTex = T(tex.night), maskTex = new THREE.CanvasTexture(tex.mask);
  let hiTex = new THREE.CanvasTexture(buildHighlight([]));
  const sunDir = new THREE.Vector3(-0.6, 0.35, 0.75).normalize();
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { dayTex: { value: dayTex }, nightTex: { value: nightTex }, maskTex: { value: maskTex }, hiTex: { value: hiTex }, sunDir: { value: sunDir }, pulse: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position,1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform sampler2D dayTex, nightTex, maskTex, hiTex; uniform vec3 sunDir; uniform float pulse;
      varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vP);
        float d = dot(n, sunDir); float dayMix = smoothstep(-0.18, 0.28, d);
        vec3 day = texture2D(dayTex, vUv).rgb; vec3 night = texture2D(nightTex, vUv).rgb;
        float ocean = 1.0 - texture2D(maskTex, vUv).r;
        vec3 lit = day * (0.06 + 1.05 * max(d, 0.0));
        vec3 hv = normalize(sunDir + v); lit += vec3(1.0, 0.93, 0.8) * pow(max(dot(n, hv), 0.0), 90.0) * ocean * 0.45;
        vec3 col = mix(night * 1.6 + day * 0.025, lit, dayMix);
        vec4 hi = texture2D(hiTex, vUv); col = mix(col, col * 0.75 + hi.rgb * 0.35, hi.a * (0.75 + 0.15 * pulse));
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0); col += vec3(0.25, 0.55, 1.0) * fres * 0.55 * (0.2 + 0.8 * dayMix);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), earthMat);
  spin.add(earth);
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 96, 64), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(tex.clouds), transparent: true, opacity: 0.7, depthWrite: false }));
  spin.add(clouds);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.1, 64, 48), new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: sunDir } }, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 wp = modelMatrix*vec4(position,1.); vP = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform vec3 sunDir; varying vec3 vN; varying vec3 vP; void main(){ vec3 v = normalize(cameraPosition - vP); float k = smoothstep(0.0, 0.42, -dot(vN, v)); float rim = k * k; float lit = 0.3 + 0.7 * smoothstep(-0.5, 0.5, dot(normalize(vP), sunDir)); gl_FragColor = vec4(vec3(0.35,0.62,1.0) * rim * 0.9 * lit, 1.0); }`,
  }));
  tilt.add(atmo);
  const sun = new THREE.DirectionalLight('#fff4e0', 1.5); sun.position.copy(sunDir).multiplyScalar(10); scene.add(sun);
  scene.add(new THREE.AmbientLight('#334', 0.6));

  // holographic graticule + neon equator for a "map table" look
  const gratPts = [];
  for (let lat = -60; lat <= 60; lat += 30) for (let lon = 0; lon < 360; lon += 3) { const a = toVec(lat, lon, 1.018), b = toVec(lat, lon + 3, 1.018); gratPts.push(a.x, a.y, a.z, b.x, b.y, b.z); }
  for (let lon = 0; lon < 360; lon += 30) for (let lat = -84; lat < 84; lat += 3) { const a = toVec(lat, lon, 1.018), b = toVec(lat + 3, lon, 1.018); gratPts.push(a.x, a.y, a.z, b.x, b.y, b.z); }
  const gratGeo = new THREE.BufferGeometry(); gratGeo.setAttribute('position', new THREE.Float32BufferAttribute(gratPts, 3));
  const grat = new THREE.LineSegments(gratGeo, new THREE.LineBasicMaterial({ color: '#5ff2ff', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
  spin.add(grat);

  // holographic orbit rings
  const ringMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
  const rings = new THREE.Group(); scene.add(rings);
  const ring1 = new THREE.Mesh(new THREE.RingGeometry(1.42, 1.425, 160), ringMat('#5ff2ff', 0.35)); ring1.rotation.x = Math.PI / 2.25;
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.603, 160), ringMat('#f0c35a', 0.25)); ring2.rotation.x = Math.PI / 1.8; ring2.rotation.y = 0.3;
  rings.add(ring1, ring2);
  const tickGeo = new THREE.BufferGeometry(); const tp = [];
  for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2, r1 = 1.42, r2 = i % 6 ? 1.45 : 1.5; tp.push(Math.cos(a) * r1, Math.sin(a) * r1, 0, Math.cos(a) * r2, Math.sin(a) * r2, 0); }
  tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  const ticks = new THREE.LineSegments(tickGeo, new THREE.LineBasicMaterial({ color: '#5ff2ff', transparent: true, opacity: 0.4 }));
  ticks.rotation.x = ring1.rotation.x; rings.add(ticks);

  // floating dust in the cabin
  const dustGeo = new THREE.BufferGeometry(); const dp = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) dp.set([(Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2.4, 1.2 + Math.random() * 1.8], i * 3);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.008, color: '#9fdcff', transparent: true, opacity: 0.5 }));
  scene.add(dust);

  // probability beams
  const beams = new THREE.Group(); spin.add(beams);
  const beamGeo = new THREE.CylinderGeometry(0.006, 0.012, 1, 10, 1, true); beamGeo.translate(0, 0.5, 0);
  const tipTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,220,140,.8)'); gr.addColorStop(1, 'rgba(255,200,100,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  let beamMap = new Map();

  // burst particles
  const burstGeo = new THREE.BufferGeometry(); const BN = 900; const bp = new Float32Array(BN * 3); const bv = new Float32Array(BN * 3);
  burstGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  const burst = new THREE.Points(burstGeo, new THREE.PointsMaterial({ size: 0.03, map: tipTex, color: '#ffd77a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  burst.visible = false; scene.add(burst);
  let burstAge = 0;

  // post-processing
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.38, 0.45, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // label overlay
  const labelLayer = document.createElement('div');
  labelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5';
  container.appendChild(labelLayer);
  const labels = new Map();

  let W = 1, H = 1;
  function resize() {
    W = container.clientWidth || 1; H = container.clientHeight || 1;
    renderer.setSize(W, H, false);
    composer.setSize(W, H);
    camera.aspect = W / H;
    // keep the globe readable between the side panels on wide screens, and smaller on phones
    camera.fov = W < 760 ? 52 : 38;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(container);

  // rotation state
  let targetSpin = spin.rotation.y, targetTilt = 0.35, autoSpin = 0.03;
  let reveal = null; // { start, dur, from, to, winner }

  // drag the globe with a finger or the mouse
  let drag = null;
  const dom = renderer.domElement;
  dom.style.touchAction = 'none'; dom.style.cursor = 'grab';
  dom.addEventListener('pointerdown', (e) => { if (reveal) return; drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; dom.setPointerCapture(e.pointerId); dom.style.cursor = 'grabbing'; autoSpin = 0; });
  dom.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    spin.rotation.y += dx * 0.008; targetSpin = spin.rotation.y;
    targetTilt = Math.max(-1.2, Math.min(1.2, targetTilt + dy * 0.006)); tilt.rotation.x = targetTilt;
  });
  const endDrag = () => { drag = null; dom.style.cursor = 'grab'; };
  dom.addEventListener('pointerup', endDrag); dom.addEventListener('pointercancel', endDrag);

  function faceAngles(id, kind) {
    const a = countryAnchor(id, kind);
    return { y: -Math.PI / 2 - THREE.MathUtils.degToRad(a.lon), x: THREE.MathUtils.degToRad(a.lat) * 0.9 };
  }

  const api = {
    setCandidates(rows, kind = 'country', { winner = null, vetoed = {} } = {}) {
      if (kind === 'month') rows = [];
      rows = rows.filter((r) => !vetoed[r.id]);
      const ids = rows.map((r) => kind + ':' + r.id);
      const key = ids.join(',') + '|' + winner;
      if (api._hiKey !== key) {
        api._hiKey = key;
        hiTex.dispose();
        const countryIds = kind === 'region' ? rows.flatMap((r) => regionById(r.id)?.members || []) : rows.map((r) => r.id);
        const win = kind === 'region' ? (winner ? regionById(winner)?.members : null) : winner;
        hiTex = new THREE.CanvasTexture(buildHighlight(countryIds, { winner: win }));
        earthMat.uniforms.hiTex.value = hiTex;
      }
      const max = Math.max(...rows.map((r) => r.p), 0.0001);
      for (const r of rows) {
        const bid = kind + ':' + r.id;
        let b = beamMap.get(bid);
        if (!b) {
          const a = countryAnchor(r.id, kind);
          const mesh = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#e8c070', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
          const n = toVec(a.lat, a.lon).normalize();
          mesh.position.copy(n);
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
          const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: tipTex, color: '#c9a560', opacity: 0.7, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
          beams.add(mesh, tip);
          const el = document.createElement('div');
          el.className = 'globe-label';
          el.style.cssText = 'position:absolute;transform:translate(-50%,-120%);font:700 13px var(--f-hud);color:#fff;text-shadow:0 0 6px #000,0 0 2px #000;white-space:nowrap;transition:opacity .3s';
          labelLayer.appendChild(el);
          b = { mesh, tip, n, el, h: 0, target: 0 };
          beamMap.set(bid, b);
        }
        b.target = 0.08 + (r.p / max) * 0.5;
        b.p = r.p;
        b.el.textContent = `${(kind === 'region' ? regionById(r.id)?.icon : countryById(r.id)?.flag) || ''} ${(r.pct ?? r.p * 100).toFixed(1)}%`;
        b.el.style.color = r.id === winner ? '#ffd36b' : '#fff';
      }
      for (const [id, b] of beamMap) if (!ids.includes(id)) { beams.remove(b.mesh, b.tip); b.el.remove(); beamMap.delete(id); }
    },
    focus(id, kind = 'country', { tiltOnly = false } = {}) {
      if (kind === 'month') { api.release(); return; }
      const f = faceAngles(id, kind);
      const cur = spin.rotation.y;
      const twoPi = Math.PI * 2;
      let ty = f.y; while (ty - cur > Math.PI) ty -= twoPi; while (ty - cur < -Math.PI) ty += twoPi;
      if (!tiltOnly) targetSpin = ty;
      targetTilt = f.x;
      autoSpin = 0;
    },
    release() { autoSpin = 0.03; targetTilt = 0.35; },
    /** Spin dramatically and settle facing `winnerId` exactly when the reveal ends. */
    revealSpin(winnerId, durMs, kind = 'country') {
      const f = kind === 'month' ? { y: spin.rotation.y + Math.PI * (Number(winnerId) / 6), x: 0.35 } : faceAngles(winnerId, kind);
      const from = spin.rotation.y;
      let to = f.y; while (to < from) to += Math.PI * 2;
      to += Math.PI * 2 * 5;
      reveal = { start: performance.now(), dur: durMs, from, to, tiltFrom: tilt.rotation.x, tiltTo: f.x };
      autoSpin = 0;
    },
    celebrate(id, kind = 'country') {
      if (kind === 'month') { bloom.strength = 0.9; return; }
      const a = countryAnchor(id, kind);
      const p = toVec(a.lat, a.lon, 1.02).applyMatrix4(spin.matrixWorld);
      for (let i = 0; i < BN; i++) {
        bp.set([p.x, p.y, p.z], i * 3);
        const v = new THREE.Vector3().randomDirection().multiplyScalar(0.3 + Math.random() * 1.1);
        bv.set([v.x, v.y, v.z + 0.4], i * 3);
      }
      burstGeo.attributes.position.needsUpdate = true;
      burst.visible = true; burstAge = 0;
      bloom.strength = 1.0;
    },
    setPaused(p) { api.paused = p; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); renderer.domElement.remove(); labelLayer.remove(); },
  };

  let raf = 0, last = performance.now();
  const camDir = new THREE.Vector3();
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (api.paused || container.offsetParent === null) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (reveal) {
      const t = Math.min(1, (now - reveal.start) / reveal.dur);
      const e = 1 - Math.pow(1 - t, 4);
      spin.rotation.y = reveal.from + (reveal.to - reveal.from) * e;
      tilt.rotation.x = reveal.tiltFrom + (reveal.tiltTo - reveal.tiltFrom) * e;
      camera.position.z = 4.1 - Math.sin(t * Math.PI) * 0.6 - e * 0.45;
      if (t >= 1) { targetSpin = spin.rotation.y; targetTilt = tilt.rotation.x; reveal = null; }
    } else {
      if (autoSpin) targetSpin += autoSpin * dt;
      spin.rotation.y += (targetSpin - spin.rotation.y) * Math.min(1, dt * 2.2);
      tilt.rotation.x += (targetTilt - tilt.rotation.x) * Math.min(1, dt * 2.2);
      camera.position.z += ((W < 760 ? 4.6 : 4.1) - camera.position.z) * Math.min(1, dt);
    }
    clouds.rotation.y += dt * 0.012;
    rings.rotation.z += dt * 0.05; ring2.rotation.z -= dt * 0.03;
    stars.rotation.y += dt * 0.004;
    const dpos = dustGeo.attributes.position.array;
    for (let i = 0; i < 300; i++) { dpos[i * 3 + 1] += Math.sin(now / 2000 + i) * 0.0003; dpos[i * 3] += 0.0002; if (dpos[i * 3] > 2) dpos[i * 3] = -2; }
    dustGeo.attributes.position.needsUpdate = true;
    earthMat.uniforms.pulse.value = 0.5 + 0.5 * Math.sin(now / 1100);
    if (bloom.strength > 0.38) bloom.strength = Math.max(0.38, bloom.strength - dt * 0.4);
    // beams & labels
    camera.getWorldDirection(camDir);
    const v = new THREE.Vector3();
    for (const b of beamMap.values()) {
      b.h += (b.target - b.h) * Math.min(1, dt * 3);
      b.mesh.scale.set(1, b.h, 1);
      b.tip.position.copy(b.n).multiplyScalar(1 + b.h);
      const s = 0.04 + b.p * 0.16; b.tip.scale.set(s, s, s);
      b.tip.getWorldPosition(v);
      const facing = b.n.clone().applyQuaternion(spin.getWorldQuaternion(new THREE.Quaternion())).dot(camera.position.clone().normalize());
      v.project(camera);
      b.el.style.left = `${(v.x * 0.5 + 0.5) * W}px`; b.el.style.top = `${(-v.y * 0.5 + 0.5) * H}px`;
      b.el.style.opacity = facing > 0.15 ? '1' : '0';
    }
    if (burst.visible) {
      burstAge += dt;
      for (let i = 0; i < BN; i++) { bp[i * 3] += bv[i * 3] * dt; bp[i * 3 + 1] += bv[i * 3 + 1] * dt; bp[i * 3 + 2] += bv[i * 3 + 2] * dt; }
      burstGeo.attributes.position.needsUpdate = true;
      burst.material.opacity = Math.max(0, 1 - burstAge / 2.5);
      if (burstAge > 2.5) burst.visible = false;
    }
    // adaptive quality: slow device → lower resolution, then drop the bloom pass
    perf.n++; perf.sum += dt;
    if (perf.n >= 90) {
      const avg = perf.sum / perf.n; perf.n = 0; perf.sum = 0;
      if (avg > 0.034 && perf.level < 2) {
        perf.level++;
        if (perf.level === 1) { renderer.setPixelRatio(Math.min(1, devicePixelRatio || 1)); resize(); }
        if (perf.level === 2) { renderer.setPixelRatio(0.75); resize(); }
      }
    }
    if (perf.level >= 2) renderer.render(scene, camera); else composer.render();
  }
  const perf = { n: 0, sum: 0, level: 0 };
  raf = requestAnimationFrame(loop);
  return api;
}
