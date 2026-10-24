// VACATION WARS 4 — client entry point. Owns screens and routes server state to scenes:
//   lobby  → the Moon (campus + embassy interiors): embassy → Role Market → spacecraft
//   game   → the spacecraft bridge: wishlist → Region → Country → Pharaoh's tests → final shot
//   market → back on the Moon: Baby Mahmoud bumps into you and guides you to the Black Market
//   ended  → the vacation contract
import { h, toast, store } from './ui/dom.js';
import { audio } from './audio.js';
import { playIntro } from './ui/intro.js';
import { showTitle } from './ui/title.js';
import { showOnboarding } from './ui/onboarding.js';
import { createHUD } from './ui/hud.js';
import { openPanel } from './ui/panels.js';
import { openMarket } from './ui/market.js';
import { openTalk } from './ui/talk.js';
import { rulesBlock } from './ui/rules.js';
import { openTutorial, tutorialSeen } from './ui/tutorial.js';
import { openGlobeRoom } from './ui/globeRoom.js';
import { openArcade } from './ui/arcade.js';
import { setArcadeBoard } from './gfx/interiorArt.js';
import { playCinematic, cinematicLength } from './ui/cinematic.js';
import { createWorld } from './world/world.js';
import { SocketNet, LocalNet } from './net/net.js';
import { BUILDINGS, SHIP } from '../shared/map.js';
import { INTERIORS, EMB_CODE } from '../shared/interiors.js';
import { BABY_LINES } from '../shared/data/dialogue.js';

const DEMO_ONLY = !!window.VW4_DEMO;
const app = document.getElementById('app');
const S = { net: null, view: null, scene: null, world: null, ship: null, gameUI: null, hud: null, panel: null, game: null, cine: null, played: new Set(), musicKey: null, bumped: false };
const getView = () => S.view;
const meP = () => S.view?.players.find((p) => p.id === S.view.you);

// ───────────────────────── boot ─────────────────────────
function boot() {
  const params = new URLSearchParams(location.search);
  audio.preload(['campus']);
  if (params.has('code') || params.has('nointro')) return title();
  playIntro(app, { onDone: () => title() });
}

function title(error) {
  const close = showTitle(app, {
    demoOnly: DEMO_ONLY,
    error,
    onReplayIntro: () => { close(); playIntro(app, { onDone: () => title() }); },
    onChoose: async (choice) => {
      close();
      try { await connect(choice); } catch (e) {
        console.error('[vw4] connect failed', e);
        if (choice.resume) store.del('session');
        title(e.message || 'Could not reach the Moon.');
      }
    },
  });
}

async function connect(choice) {
  const net = choice.mode === 'local' ? new LocalNet() : new SocketNet();
  S.net = net;
  const firstState = new Promise((resolve) => {
    net.on((msg) => {
      if (msg.t === 'state') { const first = !S.view; S.view = msg.s; if (first) resolve(msg.s); else onState(); }
      else if (msg.t === 'pos') S.world?.setPositions(msg.list);
      else if (msg.t === 'emote') { if (msg.pid !== net.pid) S.world?.showEmote(msg.pid, msg.e); }
      else if (msg.t === 'event') onEvent(msg.ev);
      else if (msg.t === 'netstatus') S.hud?.setNet(msg.status);
      else if (msg.t === 'fatal') { toast(msg.msg, 'bad'); teardown(); title(msg.msg); }
    });
  });
  await net.start(choice);
  const v = await firstState;
  const me = v.players.find((p) => p.id === v.you);
  if (!me.onboarded) {
    await new Promise((resolve) => showOnboarding(app, {
      crew: v.players, youId: v.you,
      onSubmit: async (draft) => {
        const res = await net.act({ type: 'profile:set', ...draft });
        if (!res.ok) { toast(res.error, 'bad'); return false; }
        // online, the server's new state arrives a moment after the answer: wait for it before entering the Moon
        for (let i = 0; i < 50 && !S.view.players.find((p) => p.id === S.view.you)?.onboarded; i++) await new Promise((r) => setTimeout(r, 60));
        resolve(); return true;
      },
    }));
    if (net.mode === 'local' && S.view.players.length < 2) for (let i = 0; i < 3; i++) await net.act({ type: 'host:addBot' });
  }
  enterGame();
}

// ───────────────────────── game screen ─────────────────────────
function enterGame() {
  const game = h('div', { class: 'screen', id: 'game' });
  const worldLayer = h('div', { class: 'screen', id: 'campus' });
  const shipLayer = h('div', { class: 'screen hidden', id: 'ship' });
  game.append(worldLayer, shipLayer);
  app.appendChild(game);
  Object.assign(S, { game, worldLayer, shipLayer });

  S.world = createWorld(worldLayer, {
    net: S.net, getView,
    onZone: (z) => openZone(z),
    onPrompt: (z) => S.hud.setPrompt(z),
    onEnterEmbassy: (nation) => onEnterEmbassy(nation),
    onToast: (t, tone) => toast(t, tone),
    isAllowedUpstairs: (nation) => {
      const me = meP(); if (!me) return false;
      if (me.nationality === nation) return true;
      const mate = me.couple && S.view.players.find((p) => p.id === me.couple);
      return !!(mate && mate.nationality === nation);
    },
  });
  S.hud = createHUD(game, {
    net: S.net, getView,
    onOpen: (k) => showPanel(k),
    onInteract: () => S.world.interact(),
    onEmote: (e) => S.world.emote(e),
    onJoystick: (x, y) => S.world.setJoystick(x, y),
    onJump: () => S.world.jump(),
    onMenu: () => showMenu(),
    onHelp: () => showHelp(),
    onObjective: (a) => { if (a === 'tutorial') showTutorial(); },
  });
  S.hud.seedSpeech(S.view.speech);
  audio.unlock();
  S.kissTimer = setInterval(() => S.hud?.setKiss(S.scene === 'campus' && !S.panel && !S.game?.querySelector('.cine, .modal-bg') && !!S.world?.nearSpecial()), 400);
  onState();
  if (S.view.phase === 'lobby' && !store.get('arrivalSeen', false)) {
    store.set('arrivalSeen', true);
    cine('arrival').then(() => showTutorial(() => toast('Walk with WASD/ZQSD or arrows (joystick or tap on phone) · Space to jump · E or A to talk / enter · or just click on people. Follow the blue arrow!', 'info', 9000)));
  } else if (S.view.phase === 'lobby' && !tutorialSeen()) setTimeout(() => showTutorial(), 800);
}

/** Mahmoud's 1-minute briefing (auto once, then from the checklist, Mahmoud, the menu or the ? button). */
function showTutorial(after) {
  if (S.tutorial) return;
  if (S.panel) S.panel.close();
  S.world?.pause(true);
  S.tutorial = openTutorial(S.game, { onDone: () => { S.tutorial = null; if (!S.panel) S.world?.pause(false); updateObjective(); after?.(); } });
}

function crewSpecs() {
  const v = S.view; if (!v) return [];
  const ps = v.players.filter((p) => p.onboarded);
  ps.sort((a, b) => (b.id === v.you) - (a.id === v.you));
  return ps.map((p) => ({ appearance: p.appearance, nationality: p.nationality, role: p.role }));
}

function cine(name, opts = {}) {
  S.world?.pause(true);
  const p = playCinematic(S.game, name, { crew: crewSpecs(), ...opts }).then(() => { if (!S.panel) S.world?.pause(false); });
  return p;
}

function onEnterEmbassy(nation) {
  const me = meP();
  if (!me) return;
  if ((me.nationality === nation || me.nationality === 'other') && !me.embassyVisited) setTimeout(() => showPanel({ kind: 'ambassador', nation }), 700);
  else if (me.nationality !== nation) toast('Ground floor open to all visitors. Upstairs is private.', 'info');
}

function openZone(z) {
  const v = S.view;
  const k = z.kind;
  if (k === 'telescope') return cine('telescope');
  if (k === 'baby_bump') {
    toast(`Baby Mahmoud: “${BABY_LINES[0]}”`, 'info', 6000);
    S.bumped = true; updateObjective();
    setTimeout(() => toast('Follow Baby Mahmoud to the Black Market (south-west)!', 'good', 6000), 2600);
    return;
  }
  if (k === 'terminal') return showHelp();
  if (k === 'npc') return showTalk(z.npc, z.who);
  if (k === 'globe') return showGlobe();
  if (k === 'arcade') return showArcade(z.game);
  if (k === 'ship' && v.phase !== 'lobby') return toast('The spacecraft is parked. The Black Market is the place to be now!', 'info');
  const map = { roles: { kind: 'roles' }, hq: { kind: 'hq' }, mahmoud: { kind: 'mahmoud' }, ship: { kind: 'ship' }, black: { kind: 'black' }, baby: { kind: 'baby' }, ambassador: { kind: 'ambassador', nation: z.nation }, stats: { kind: 'stats', nation: z.nation }, npc: { kind: 'npc', npc: z.npc } };
  if (map[k]) showPanel(map[k]);
}

function showPanel(kind) {
  if (S.panel) S.panel.close();
  S.world?.pause(true);
  S.panel = openPanel(S.game, kind, {
    net: S.net, getView,
    editPassport,
    openMarket: () => showMarket(),
    onRoleChosen: () => toast('Role locked! Now board the spacecraft on the launch pad (south-east).', 'good', 7000),
    onBoarded: () => toast('Aboard! Launch starts when the whole crew is on board.', 'good', 6000),
    onClose: () => { S.panel = null; if (S.scene === 'campus') S.world?.pause(false); },
    onDeal: () => updateObjective(),
    openTutorial: () => showTutorial(),
  });
}

function showTalk(npcId, who) {
  if (S.panel) S.panel.close();
  S.world?.pause(true);
  S.panel = openTalk(S.game, npcId, {
    net: S.net, getView, who,
    onAction: (a) => setTimeout(() => (a === 'rules' ? showHelp() : a === 'roles' ? showPanel({ kind: 'roles' }) : a === 'globe' ? showGlobe() : a === 'arcade' ? showArcade() : null), 200),
    onFx: (k) => S.world?.fx(k),
    openMarket: () => setTimeout(showMarket, 200),
    onClose: () => { S.panel = null; S.world?.pause(false); updateObjective(); },
  });
  if (!S.panel) S.world?.pause(false);
}

function showMarket() {
  if (S.panel) S.panel.close();
  S.world?.pause(true);
  audio.music('black_market');
  S.panel = openMarket(S.game, { net: S.net, getView, onClose: () => { S.panel = null; S.world?.pause(false); audio.music(S.world?.sceneMusic || 'campus'); } });
}

/** The Control Tower's live Earth: every flag is clickable. */
function showGlobe(countryId) {
  if (S.panel) S.panel.close();
  S.world?.pause(true);
  S.panel = openGlobeRoom(S.game, { getView, countryId, onClose: () => { S.panel = null; S.world?.pause(false); } });
}

/** Alessandro's Moon Arcade: quiz, flag memory, globe duel, leaderboard. */
function showArcade(game) {
  if (S.panel) S.panel.close();
  S.world?.pause(true);
  S.panel = openArcade(S.game, { net: S.net, getView, game, openGlobe: (id) => setTimeout(() => showGlobe(id), 150), onClose: () => { S.panel = null; S.world?.pause(false); } });
}

function showHelp() {
  const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) bg.remove(); } });
  bg.appendChild(h('div', { class: 'panel gold modal' },
    h('header', {}, h('div', {}, h('div', { class: 'eyebrow gold' }, 'Mahmoud explains'), h('h2', {}, 'Rules')), h('button', { class: 'btn ghost small close', onclick: () => bg.remove() }, 'Close ✕')),
    h('div', { class: 'body' }, h('button', { class: 'btn solid', onclick: () => { bg.remove(); showTutorial(); } }, "▶ Watch Mahmoud's 1-minute briefing"), rulesBlock(), h('div', { class: 'muted small' }, 'Controls — computer: WASD (ZQSD on AZERTY) or arrows to walk · click to walk/talk · Space jump · E or A to interact · 1–7 emotes · K kiss. Phone: joystick or tap · X jump · GO interact.'))));
  S.game.appendChild(bg);
}

function editPassport() {
  const me = meP();
  S.world?.pause(true);
  showOnboarding(app, {
    editing: true, crew: S.view.players, youId: S.view.you,
    initial: { ...me, sharePartner: S.view.me.sharePartner },
    onCancel: () => S.world?.pause(false),
    onSubmit: async (draft) => {
      const res = await S.net.act({ type: 'profile:set', ...draft });
      if (!res.ok) { toast(res.error, 'bad'); return false; }
      toast('Passport updated.', 'good');
      S.world?.pause(false);
      return true;
    },
  });
}

function showMenu() {
  if (S.panel) S.panel.close();
  const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) bg.remove(); } });
  const isLocal = S.net.mode === 'local';
  bg.appendChild(h('div', { class: 'panel gold modal', style: { width: 'min(420px, 100%)' } },
    h('header', {}, h('h2', {}, 'Menu'), h('button', { class: 'btn ghost small close', onclick: () => bg.remove() }, 'Close ✕')),
    h('div', { class: 'body' },
      h('button', { class: 'btn', onclick: () => { bg.remove(); showPanel({ kind: 'wallet' }); } }, 'Passport & wallet'),
      h('button', { class: 'btn solid', onclick: () => { bg.remove(); showTutorial(); } }, "▶ Mahmoud's 1-minute briefing"),
      h('button', { class: 'btn', onclick: () => { bg.remove(); showHelp(); } }, 'Rules'),
      h('button', { class: 'btn', onclick: () => { bg.remove(); showPanel({ kind: 'hq' }); } }, 'Mission control (host controls)'),
      h('button', { class: 'btn', onclick: () => { bg.remove(); editPassport(); } }, 'Edit passport & travels'),
      isLocal ? null : h('div', { class: 'privacy' }, `Invite friends with code ${S.view.code} or the link: ${location.origin}${location.pathname}?code=${S.view.code}`),
      h('button', { class: 'btn bad', onclick: () => { bg.remove(); S.net.leave(); teardown(); title(); } }, isLocal ? 'Quit solo demo' : 'Leave this crew'),
    )));
  S.game.appendChild(bg);
}

function teardown() {
  clearInterval(S.kissTimer);
  S.tutorial?.close(); S.tutorial = null;
  S.world?.destroy(); S.ship?.destroy(); S.gameUI?.destroy(); S.hud?.destroy(); S.game?.remove();
  Object.assign(S, { view: null, scene: null, world: null, ship: null, gameUI: null, hud: null, panel: null, game: null, musicKey: null, bumped: false });
  S.played = new Set();
  audio.music(null);
}

// ───────────────────────── guidance ─────────────────────────
function updateObjective() {
  const v = S.view, me = meP();
  if (!v || !me || !S.world) return;
  const inside = S.world.sceneId;
  let target = null, obj = null;
  if (v.phase === 'lobby') {
    const nation = me.nationality === 'other' ? 'portugal' : me.nationality;
    const emb = BUILDINGS.find((b) => b.nation === nation);
    const steps = [
      { label: "Mahmoud's 1-minute briefing", done: tutorialSeen(), action: 'tutorial', actionLabel: '▶ Watch' },
      { label: emb ? `Visit your embassy (${emb.label})` : 'Visit your embassy', done: !!me.embassyVisited },
      { label: 'Choose your role at the Role Market', done: !!v.me.role },
      { label: 'Board the spacecraft on the launch pad', done: !!me.boarded },
    ];
    const nowIdx = steps.findIndex((s) => !s.done);
    if (nowIdx >= 0) steps[nowIdx].now = true;
    const aboard = v.players.filter((p) => p.onboarded && p.boarded).length, crew = v.players.filter((p) => p.onboarded).length;
    obj = { title: nowIdx < 0 ? 'Waiting for launch' : `Step ${nowIdx + 1} of ${steps.length}`, steps, hint: nowIdx < 0 ? `${aboard}/${crew} aboard${v.launchAt ? ' · launching…' : ''}` : 'Follow the blue arrow · E / GO to interact' };
    if (inside !== 'campus') {
      const I = INTERIORS[inside];
      if (nowIdx === 0) target = null;
      else if (nowIdx === 1 && inside === `emb_${EMB_CODE[nation]}_1`) target = { x: 10, y: 5.6, scene: inside };
      else if (nowIdx === 2 && inside === 'in_roles') target = { x: 12, y: 5.4, scene: inside };
      else target = I.private ? null : { x: I.exit.x, y: I.exit.y - 0.4, scene: inside };
    } else if (nowIdx === 0) target = null; // the briefing opens from the checklist button
    else if (nowIdx === 1) target = { x: emb.door[0] + 0.5, y: emb.door[1] + 0.6, scene: 'campus' };
    else if (nowIdx === 2) { const r = BUILDINGS.find((b) => b.id === 'roles'); target = { x: r.door[0] + 0.5, y: r.door[1] + 0.6, scene: 'campus' }; }
    else if (nowIdx === 3) target = { x: SHIP.ramp[0] + 0.5, y: SHIP.ramp[1] + 0.8, scene: 'campus' };
  } else if (v.phase === 'market') {
    const b = BUILDINGS.find((x) => x.id === 'black');
    obj = { title: 'The Black Market is open', steps: [{ label: 'Meet Baby Mahmoud', done: S.bumped }, { label: 'Enter the Black Market (south-west)', now: S.bumped }], hint: 'Spend, pool, trade — or buy a full restart.' };
    obj.steps.push({ label: 'Talk to Hicham, the dealer', now: inside === 'in_black' });
    target = inside === 'campus' ? { x: b.door[0] + 0.5, y: b.door[1] + 0.6, scene: 'campus' } : inside === 'in_black' ? { x: 10, y: 6.2, scene: inside } : INTERIORS[inside].private ? null : { x: INTERIORS[inside].exit.x, y: INTERIORS[inside].exit.y - 0.4, scene: inside };
  }
  S.hud.setObjective(S.scene === 'campus' ? obj : null);
  S.world.setObjective(target);
}

// ───────────────────────── state routing ─────────────────────────
function onState() {
  const v = S.view;
  if (!S.game || !v) return;
  S.hud.update(v);
  setArcadeBoard(v.players.filter((p) => p.arcade && p.arcade.played).sort((a, b) => (b.arcade.net || 0) - (a.arcade.net || 0)).map((p) => [p.name.toUpperCase().slice(0, 10), `${p.arcade.net > 0 ? '+' : ''}${p.arcade.net || 0} VC`]));
  const want = v.phase === 'game' ? 'ship' : 'campus';
  if (want !== S.scene) switchScene(want);
  if (S.scene === 'ship' && S.gameUI) { S.gameUI.update(); stageEffects(v); }
  if (S.panel) S.panel.refresh();
  if (v.phase === 'ended' && !S.contractShown) { S.contractShown = true; setTimeout(showMarket, 600); }
  if (v.phase !== 'ended') S.contractShown = false;
  updateObjective();
}

const STAGE_CINE = { wishlist: ['launch', 'launchCinematic'], month: ['season', 'stageCinematic'], region: ['region', 'stageCinematic'], country: ['country', 'stageCinematic'], pharaoh: ['pharaoh', 'pharaoh'], final: ['final', 'stageCinematic'], exit: ['exit', 'exitCinematic'] };
const STAGE_MUSIC = { wishlist: 'ship', month: 'season_game', region: 'casino_region', country: 'casino_country', pharaoh: 'pharaoh', couples: 'pharaoh', groups: 'pharaoh', nominate: 'pharaoh', final: 'final_wheel', exit: 'ship' };

function stageEffects(v) {
  const g = v.game;
  if (!g) return;
  const key = `${g.no}:${g.stage}`;
  const music = STAGE_MUSIC[g.stage];
  if (music && S.musicKey !== key) { S.musicKey = key; audio.music(music); }
  if (S.played.has(key)) return;
  S.played.add(key);
  const c = STAGE_CINE[g.stage];
  if (!c) return;
  const now = S.net.serverNow();
  const left = g.introUntil - now;
  if (left < 1200) return;
  const dur = v.config.timers[c[1]] * 1000;
  const offset = Math.max(0, Math.min(cinematicLength(c[0]) - 500, dur - left));
  S.shipLayer.classList.add('cine-on');
  S.ship?.setPaused(true); // the film covers the screen: don't render the 3D Earth underneath
  playCinematic(S.game, c[0], { offsetMs: offset, maxMs: left, crew: crewSpecs() }).then(() => { S.shipLayer.classList.remove('cine-on'); if (S.scene === 'ship') S.ship?.setPaused(false); });
}

async function switchScene(to) {
  const from = S.scene;
  S.scene = to;
  if (S.panel) S.panel.close();
  if (from) { S.game.appendChild(h('div', { class: 'warp' })); setTimeout(() => S.game?.querySelector('.warp')?.remove(), 1300); audio.sfx('whoosh'); }
  S.hud.setScene(to);
  if (to === 'ship') {
    S.world.pause(true);
    await new Promise((r) => setTimeout(r, from ? 450 : 0));
    S.worldLayer.classList.add('hidden');
    S.shipLayer.classList.remove('hidden');
    if (!S.ship) {
      const [mod, gameMod] = await Promise.all([import('./ship/ship.js'), import('./ui/game.js')]);
      S.ship = mod.createShip(S.shipLayer);
      drawCockpit(S.shipLayer);
      S.gameUI = gameMod.createGameUI(S.shipLayer, { net: S.net, ship: S.ship, getView });
    }
    S.ship.setPaused(false);
    S.gameUI.update();
    stageEffects(S.view);
  } else {
    await new Promise((r) => setTimeout(r, from ? 450 : 0));
    S.shipLayer.classList.add('hidden');
    S.worldLayer.classList.remove('hidden');
    S.ship?.setPaused(true);
    if (from === 'ship') { S.world.teleportToShipRamp(); S.world.resetBaby(); S.bumped = false; }
    S.world.pause(false);
    S.musicKey = null;
    audio.music(S.world.sceneMusic || 'campus');
  }
}

/** Cockpit window frame drawn over the 3D view. */
function drawCockpit(layer) {
  const cv = h('canvas', { class: 'cockpit' });
  layer.appendChild(cv);
  const draw = () => {
    const W = (cv.width = layer.clientWidth), H = (cv.height = layer.clientHeight);
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    const inset = Math.min(W, H) * 0.035;
    const c = Math.min(W, H) * 0.12;
    const path = () => { g.moveTo(inset + c, inset); g.lineTo(W - inset - c, inset); g.lineTo(W - inset, inset + c); g.lineTo(W - inset, H - inset - c); g.lineTo(W - inset - c, H - inset); g.lineTo(inset + c, H - inset); g.lineTo(inset, H - inset - c); g.lineTo(inset, inset + c); g.closePath(); };
    g.fillStyle = 'rgba(8,10,20,0.92)';
    g.beginPath(); g.rect(0, 0, W, H); path(); g.fill('evenodd');
    g.strokeStyle = 'rgba(160,190,255,.35)'; g.lineWidth = 2; g.beginPath(); path(); g.stroke();
    g.strokeStyle = 'rgba(240,195,90,.25)'; g.lineWidth = 1; g.strokeRect(inset + 6, inset + 6, W - 2 * inset - 12, H - 2 * inset - 12);
    g.fillStyle = 'rgba(14,18,34,.9)'; g.fillRect(W / 2 - 3, 0, 6, inset + 2); g.fillRect(W / 2 - 3, H - inset - 2, 6, inset + 2);
    const rg = g.createLinearGradient(0, 0, W, H);
    rg.addColorStop(0, 'rgba(160,210,255,.06)'); rg.addColorStop(0.45, 'rgba(160,210,255,0)'); rg.addColorStop(0.55, 'rgba(160,210,255,.04)'); rg.addColorStop(1, 'rgba(160,210,255,0)');
    g.fillStyle = rg; g.fillRect(inset, inset, W - 2 * inset, H - 2 * inset);
    g.fillStyle = 'rgba(160,190,255,.35)';
    for (let x = inset + c; x < W - inset - c; x += 48) { g.fillRect(x, inset / 2, 2, 2); g.fillRect(x, H - inset / 2, 2, 2); }
  };
  draw();
  new ResizeObserver(draw).observe(layer);
}

// ───────────────────────── events ─────────────────────────
function onEvent(ev) {
  if (ev.type === 'toast') { toast(ev.text, ev.tone || 'info', 6000); return; }
  if (ev.type === 'kick') { toast('You were removed from the crew by the host.', 'bad'); S.net.leave(); teardown(); title('You were removed from the crew.'); return; }
  if (ev.type === 'fx') {
    if (ev.kind === 'boost') audio.sfx('coin');
    if (ev.kind === 'power') { audio.sfx('chaos'); S.game?.appendChild(h('div', { class: 'flash', style: { background: '#ff4fd8' } })); setTimeout(() => S.game?.querySelector('.flash')?.remove(), 1000); }
    if (ev.kind === 'role') audio.sfx('coin');
    if (ev.kind === 'purchase') { audio.sfx('heart'); }
    if (ev.kind === 'arcade') audio.sfx(ev.delta > 0 ? 'win' : ev.delta < 0 ? 'bust' : 'coin');
    if (ev.kind === 'restart') { toast('🔁 RESTART! New game — choose new roles and board again.', 'good', 9000); S.played = new Set(); }
  }
}

window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
if (new URLSearchParams(location.search).has('debug')) { window.__vw4 = S; S.showPanel = (k) => showPanel(k); S.showMarket = showMarket; S.showGlobe = showGlobe; S.showArcade = showArcade; S.showTalk = showTalk; S.cine = cine; S.audio = audio; }
boot();
