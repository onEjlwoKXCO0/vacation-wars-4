// Original synthesized score & sound effects (WebAudio, no audio files).
import { store } from './ui/dom.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz
// The crew's own recorded music (assets/music/*.mp3). Anything else falls back to synthesized loops.
const TRACKS = new Set(['intro', 'campus', 'emb_pt', 'emb_mk', 'emb_pl', 'emb_ma', 'black_market', 'casino_region', 'casino_country', 'final_wheel', 'season_game', 'club', 'seer', 'biodome', 'role_market', 'hq', 'control_tower']);
const ONE_SHOT = new Set(['intro', 'pharaoh_laugh']);
const TRACK_VOL = { campus: 0.55, emb_pt: 0.7, emb_mk: 0.7, emb_pl: 0.7, emb_ma: 0.7, intro: 0.9, club: 0.7, seer: 0.7, biodome: 0.65 };

// 0.1 s of silence, used to unlock the audio decks inside the first tap/click (iOS / Safari).
function silentWav() {
  const n = 4410, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
  const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}

class Audio {
  constructor() {
    this.ctx = null; this.muted = store.get('muted', false); this.loops = []; this.current = null; this.playing = null; this.base = 'assets/music/';
    // Two music decks (crossfade) + one for one-shots. They are unlocked inside the first user gesture, so every
    // later track change — even one triggered by walking through a door — is allowed to play on every browser.
    this.decks = [0, 1, 2].map(() => { const el = new window.Audio(); el.preload = 'auto'; return el; });
    this.positions = new Map();
    // safety net: if a browser still blocked a track, the next tap / key press starts it
    const kick = () => { if (this.playing && this.playing.paused && this.current && TRACKS.has(this.current)) { const p = this.playing.play(); if (p && p.catch) p.catch(() => {}); } };
    addEventListener('pointerdown', kick, true); addEventListener('keydown', kick, true);
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    // shared reverb
    this.verb = this.ctx.createConvolver();
    this.verb.buffer = this.impulse(2.6);
    const vg = this.ctx.createGain(); vg.gain.value = 0.35;
    this.verb.connect(vg).connect(this.master);
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.5; this.musicBus.connect(this.master); this.musicBus.connect(this.verb);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.6; this.sfxBus.connect(this.master);
    // unlock the decks while we are inside a user gesture
    const silence = silentWav();
    for (const el of this.decks) { if (!el.src) { el.src = silence; el.muted = true; const p = el.play(); if (p && p.then) p.then(() => { if (el.src === silence) el.pause(); el.muted = this.muted; }).catch(() => { el.muted = this.muted; }); } }
    if (this.pendingMusic) this.music(this.pendingMusic);
  }

  impulse(sec) {
    const len = this.ctx.sampleRate * sec, buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    return buf;
  }

  setMuted(m) {
    this.muted = m; store.set('muted', m);
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
    for (const el of this.decks) el.muted = m;
  }

  /** Recorded tracks (the crew's own music) stream through two crossfading <audio> decks. */
  fadeTo(el, target, ms, then) {
    clearInterval(el._fade);
    const start = el.volume, t0 = performance.now();
    el._fade = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      el.volume = Math.max(0, Math.min(1, start + (target - start) * k));
      if (k >= 1) { clearInterval(el._fade); if (then) then(); }
    }, 40);
  }
  playTrack(name, { volume = TRACK_VOL[name] ?? 0.75, fade = 900, restart = false } = {}) {
    const url = this.base + name + '.mp3';
    let el = this.decks.slice(0, 2).find((d) => d._name === name);
    if (!el) el = this.decks[0] === this.playing ? this.decks[1] : this.decks[0];
    if (this.playing && this.playing !== el) {
      const old = this.playing;
      if (old._name && !ONE_SHOT.has(old._name)) this.positions.set(old._name, old.currentTime);
      this.fadeTo(old, 0, fade, () => old.pause());
    }
    this.playing = el;
    if (el._name !== name) {
      clearInterval(el._fade);
      el._name = name; el.src = url; el.volume = 0;
      const resumeAt = restart ? 0 : this.positions.get(name) || 0;
      if (resumeAt) el.addEventListener('loadedmetadata', () => { try { el.currentTime = resumeAt % (el.duration || Infinity); } catch {} }, { once: true });
    } else if (restart || el.ended) el.currentTime = 0;
    el.loop = !ONE_SHOT.has(name); el.muted = this.muted;
    const p = el.play(); if (p && p.catch) p.catch(() => {});
    this.fadeTo(el, volume, fade);
  }
  stopTracks(fade = 900) { if (this.playing) { const old = this.playing; if (old._name) this.positions.set(old._name, old.currentTime); this.fadeTo(old, 0, fade, () => old.pause()); this.playing = null; } }
  /** One-shot recorded effect (e.g. the Pharaoh's laugh) on the third deck. */
  oneShot(name, volume = 1) { const el = this.decks[2]; el.src = this.base + name + '.mp3'; el.loop = false; el.volume = volume; el.muted = this.muted; const p = el.play(); if (p && p.catch) p.catch(() => {}); }
  preload() {}

  voice({ freq, type = 'sawtooth', start, dur, gain = 0.2, attack = 0.02, release = 0.3, cutoff = 2400, bus = this.musicBus, detune = 0, q = 1 }) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = q;
    const g = c.createGain(); g.gain.value = 0;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + attack);
    g.gain.setValueAtTime(gain, start + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur + release);
    o.connect(f).connect(g).connect(bus);
    o.start(start); o.stop(start + dur + release + 0.05);
    return o;
  }

  noise({ start, dur, gain = 0.3, cutoff = 800, bus = this.sfxBus, type = 'lowpass' }) {
    const c = this.ctx, len = Math.ceil(c.sampleRate * (dur + 0.1));
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = cutoff;
    const g = c.createGain(); g.gain.setValueAtTime(gain, start); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    s.connect(f).connect(g).connect(bus); s.start(start); s.stop(start + dur + 0.1);
  }

  timpani(t, n = 38, gain = 0.5) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(NOTE(n) * 1.5, t); o.frequency.exponentialRampToValueAtTime(NOTE(n), t + 0.15);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + 1.3);
    this.noise({ start: t, dur: 0.25, gain: gain * 0.4, cutoff: 300, bus: this.musicBus });
  }

  brass(t, notes, dur, gain = 0.09) {
    for (const n of notes) for (const d of [-7, 7]) this.voice({ freq: NOTE(n), start: t, dur, gain, attack: 0.06, release: 0.4, cutoff: 1800, detune: d });
  }

  stopMusic() {
    for (const l of this.loops) clearInterval(l);
    this.loops = [];
    this.current = null;
  }

  /** name: 'intro' | 'campus' | 'ship' | 'pharaoh' | null */
  music(name) {
    if (!this.ctx) { this.pendingMusic = name; return; }
    if (this.current === name) return;
    this.stopMusic();
    this.current = name;
    if (name && TRACKS.has(name)) { this.playTrack(name, { restart: name === 'intro' || name === 'final_wheel' }); return; }
    this.stopTracks();
    if (!name) return;
    const t0 = this.ctx.currentTime + 0.1;
    if (name === 'intro') this.introScore(t0);
    if (name === 'campus') this.loopScore(t0, 'campus');
    if (name === 'ship' || name === 'pharaoh') this.loopScore(t0, name);
  }

  // Original house groove for Club Cléopâtre: kick, offbeat hats, Phrygian bass, stab chords.
  clubScore(t) {
    const beat = 60 / 122, bar = beat * 4;
    const bass = [40, 40, 41, 40, 43, 41, 40, 38];
    const stabs = [[64, 67, 71], [65, 68, 72], [64, 67, 71], [62, 65, 69]];
    let i = 0;
    const play = (at) => {
      if (!this.ctx || this.current !== 'club') return;
      for (let k = 0; k < 4; k++) {
        const b0 = at + k * beat;
        this.voice({ freq: 52, type: 'sine', start: b0, dur: 0.18, gain: 0.22, attack: 0.002, release: 0.12, cutoff: 300 });
        this.noise({ start: b0 + beat / 2, dur: 0.05, gain: 0.05, cutoff: 7000, type: 'highpass', bus: this.musicBus });
        this.voice({ freq: NOTE(bass[(i * 2 + (k >> 1)) % bass.length]), type: 'sawtooth', start: b0 + beat * 0.5, dur: beat * 0.4, gain: 0.05, attack: 0.005, release: 0.08, cutoff: 500 });
        if (k % 2 === 1) this.noise({ start: b0, dur: 0.12, gain: 0.07, cutoff: 2500, type: 'bandpass', bus: this.musicBus });
      }
      if (i % 2 === 0) for (const n of stabs[(i / 2) % stabs.length]) this.voice({ freq: NOTE(n), type: 'square', start: at + beat * 1.5, dur: 0.12, gain: 0.018, attack: 0.005, release: 0.25, cutoff: 2600 });
      i++;
    };
    play(t);
    let next = t + bar;
    this.loops.push(setInterval(() => { if (!this.ctx) return; while (next < this.ctx.currentTime + 1) { play(next); next += bar; } }, 300));
  }

  // An original heroic fanfare in D major.
  introScore(t) {
    const B = 0.42; // beat
    this.timpani(t, 38, 0.6); this.timpani(t + B * 1.5, 38, 0.4); this.timpani(t + B * 2, 45, 0.6);
    const mel = [[62, 1], [66, 0.5], [69, 0.5], [74, 2], [73, 0.5], [69, 0.5], [71, 2], [67, 1], [69, 1], [66, 1], [64, 1], [62, 3]];
    let at = t + B * 2;
    for (const [n, len] of mel) { this.brass(at, [n, n + 12], B * len * 0.95, 0.07); at += B * len; }
    const chords = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61], [50, 57, 62, 66]];
    chords.forEach((ch, i) => { for (const n of ch) this.voice({ freq: NOTE(n), start: t + B * 2 + i * B * 4, dur: B * 4, gain: 0.035, attack: 0.3, release: 0.8, cutoff: 1200, type: 'sawtooth' }); this.timpani(t + B * 2 + i * B * 4, ch[0] - 12, 0.35); });
    // long shimmering tail for the crawl
    const tail = t + B * 22;
    const pads = [[50, 57, 62, 69], [47, 55, 62, 66], [43, 50, 59, 67], [45, 52, 61, 64]];
    for (let r = 0; r < 4; r++) pads.forEach((ch, i) => { for (const n of ch) this.voice({ freq: NOTE(n), start: tail + (r * 4 + i) * 2.4, dur: 2.4, gain: 0.03, attack: 0.8, release: 1.2, cutoff: 900, type: 'triangle' }); });
  }

  loopScore(t, kind) {
    const prog = kind === 'campus'
      ? [[50, 57, 61, 64], [47, 54, 57, 62], [43, 50, 54, 59], [45, 52, 55, 61]]
      : [[38, 45, 50, 53], [38, 45, 50, 55], [36, 43, 48, 52], [41, 48, 53, 57]];
    const scale = kind === 'campus' ? [62, 64, 66, 69, 71, 74, 76, 78, 81] : [62, 65, 67, 69, 72, 74, 77];
    const bar = kind === 'campus' ? 4.2 : 3.2;
    let i = 0;
    const play = (at) => {
      if (!this.ctx || this.current !== kind) return;
      const ch = prog[i % prog.length];
      for (const n of ch) this.voice({ freq: NOTE(n), start: at, dur: bar, gain: kind === 'campus' ? 0.022 : 0.02, attack: 1.2, release: 1.5, cutoff: kind === 'campus' ? 900 : 600, type: 'triangle' });
      if (kind === 'campus') {
        for (let k = 0; k < 8; k++) if (Math.random() < 0.55) this.voice({ freq: NOTE(scale[Math.floor(Math.random() * scale.length)]), start: at + k * (bar / 8), dur: 0.12, gain: 0.028, attack: 0.005, release: 0.5, cutoff: 3000, type: 'square' });
      } else {
        for (let k = 0; k < 8; k++) this.voice({ freq: NOTE(ch[0] - 12), start: at + k * (bar / 8), dur: 0.1, gain: 0.05, attack: 0.005, release: 0.15, cutoff: 400, type: 'sawtooth' });
        if (i % 2 === 0) this.voice({ freq: NOTE(scale[Math.floor(Math.random() * scale.length)] + 12), start: at + bar / 2, dur: 0.8, gain: 0.015, attack: 0.1, release: 1, cutoff: 5000, type: 'sine' });
      }
      i++;
    };
    play(t);
    let next = t + bar;
    const id = setInterval(() => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 1) { play(next); next += bar; }
    }, 400);
    this.loops.push(id);
  }

  sfx(name) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.01, b = this.sfxBus;
    const V = (o) => this.voice({ bus: b, ...o });
    switch (name) {
      case 'blip': V({ freq: 880, type: 'square', start: t, dur: 0.04, gain: 0.08, release: 0.05, cutoff: 4000 }); break;
      case 'open': V({ freq: 520, type: 'triangle', start: t, dur: 0.06, gain: 0.12, release: 0.1 }); V({ freq: 780, type: 'triangle', start: t + 0.06, dur: 0.08, gain: 0.12, release: 0.12 }); break;
      case 'coin': V({ freq: 1320, type: 'square', start: t, dur: 0.05, gain: 0.07, release: 0.05, cutoff: 5000 }); V({ freq: 1760, type: 'square', start: t + 0.06, dur: 0.12, gain: 0.07, release: 0.2, cutoff: 5000 }); break;
      case 'error': V({ freq: 180, type: 'sawtooth', start: t, dur: 0.15, gain: 0.1, release: 0.1, cutoff: 800 }); break;
      case 'heart': [72, 76, 79].forEach((n, i) => V({ freq: NOTE(n), type: 'sine', start: t + i * 0.07, dur: 0.12, gain: 0.08, release: 0.3 })); break;
      case 'whoosh': this.noise({ start: t, dur: 1.2, gain: 0.25, cutoff: 1400, type: 'bandpass' }); break;
      case 'jump': V({ freq: 300, type: 'triangle', start: t, dur: 0.18, gain: 0.08, release: 0.1 }); this.voice({ freq: 520, type: 'sine', start: t + 0.02, dur: 0.2, gain: 0.05, release: 0.15, bus: b }); break;
      case 'land': this.noise({ start: t, dur: 0.25, gain: 0.18, cutoff: 500 }); break;
      case 'door': V({ freq: 180, type: 'square', start: t, dur: 0.05, gain: 0.06, release: 0.05, cutoff: 900 }); this.noise({ start: t + 0.03, dur: 0.18, gain: 0.08, cutoff: 1500 }); break;
      case 'bump': V({ freq: 140, type: 'sine', start: t, dur: 0.12, gain: 0.25, release: 0.15 }); [880, 1320].forEach((f, i) => V({ freq: f, type: 'square', start: t + 0.08 + i * 0.07, dur: 0.05, gain: 0.05, release: 0.05, cutoff: 5000 })); break;
      case 'tick': V({ freq: 2200, type: 'square', start: t, dur: 0.015, gain: 0.04, release: 0.02, cutoff: 6000 }); break;
      case 'lock': V({ freq: 300, type: 'square', start: t, dur: 0.05, gain: 0.1, release: 0.05, cutoff: 1500 }); V({ freq: 600, type: 'square', start: t + 0.05, dur: 0.05, gain: 0.1, release: 0.1, cutoff: 1500 }); break;
      case 'chaos': for (let i = 0; i < 6; i++) V({ freq: 200 + Math.random() * 900, type: 'sawtooth', start: t + i * 0.05, dur: 0.06, gain: 0.07, release: 0.06, cutoff: 3000 }); this.noise({ start: t, dur: 0.6, gain: 0.2, cutoff: 3000, type: 'highpass' }); break;
      case 'drumroll': for (let i = 0; i < 70; i++) { const at = t + 6.2 * (1 - Math.pow(1 - i / 70, 1.6)); this.noise({ start: at, dur: 0.07, gain: 0.08 + (i / 70) * 0.18, cutoff: 1200, bus: b }); } break;
      case 'fire': this.noise({ start: t, dur: 0.5, gain: 0.18, cutoff: 2400, type: 'bandpass' }); [64, 68, 71].forEach((n, i) => V({ freq: NOTE(n), type: 'square', start: t + i * 0.06, dur: 0.08, gain: 0.06, release: 0.12, cutoff: 3500 })); break;
      case 'jackpot':
        for (let i = 0; i < 14; i++) V({ freq: NOTE([72, 76, 79, 84][i % 4] + (i >= 8 ? 12 : 0)), type: 'square', start: t + i * 0.07, dur: 0.06, gain: 0.07, release: 0.08, cutoff: 6000 });
        for (let i = 0; i < 10; i++) V({ freq: 1500 + Math.random() * 1500, type: 'square', start: t + 1 + i * 0.05, dur: 0.04, gain: 0.05, release: 0.05, cutoff: 7000 });
        this.voice({ freq: NOTE(60), type: 'sawtooth', start: t, dur: 1.1, gain: 0.05, release: 0.6, cutoff: 1800, bus: b });
        break;
      case 'win': [72, 76, 79, 84, 88].forEach((n, i) => V({ freq: NOTE(n), type: 'square', start: t + i * 0.08, dur: 0.1, gain: 0.07, release: 0.2, cutoff: 5000 })); for (let i = 0; i < 12; i++) V({ freq: 1320 + (i % 3) * 440, type: 'square', start: t + 0.45 + i * 0.045, dur: 0.035, gain: 0.05, release: 0.04, cutoff: 6000 }); break;
      case 'bust': [55, 52, 48].forEach((n, i) => V({ freq: NOTE(n), type: 'sawtooth', start: t + i * 0.16, dur: 0.15, gain: 0.08, release: 0.2, cutoff: 1200 })); break;
      case 'boom':
        this.timpani(t, 33, 0.9); this.noise({ start: t, dur: 1.6, gain: 0.5, cutoff: 500 });
        [50, 57, 62, 66, 69, 74].forEach((n) => this.voice({ freq: NOTE(n), start: t + 0.05, dur: 2.2, gain: 0.05, attack: 0.05, release: 1.6, cutoff: 2600, bus: this.musicBus }));
        break;
      default: break;
    }
  }
}

export const audio = new Audio();
