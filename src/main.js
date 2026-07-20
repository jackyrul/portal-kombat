import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createStage } from './stage.js';
import { FX } from './fx.js';
import { AudioFX } from './audio.js';
import { Input, VirtualPad } from './input.js';
import { UI, renderPortraits } from './ui.js';
import { Game } from './game.js';
import { CHARACTERS } from './characters.js';

// ---------------------------------------------------------------- renderer
// `?q=low` disables the expensive effects for weak devices / software GL.
const LOW_Q = new URLSearchParams(location.search).get('q') === 'low';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW_Q });
renderer.setPixelRatio(LOW_Q ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !LOW_Q;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.8, 6.4);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
if (!LOW_Q) {
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.55, 0.82
  ));
}
composer.addPass(new OutputPass());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- systems
const stage = createStage(scene);
const fx = new FX(scene);
const audio = new AudioFX();
const input = new Input();
const ui = new UI();
const game = new Game(scene, camera, fx, audio, ui, input);
const portraits = renderPortraits(CHARACTERS);

// ---------------------------------------------------------------- app state
const app = {
  mode: null,          // { cpu, difficulty }
  p1: null, p2: null,
  picking: -1,
  inFight: false,
};

function goMenu() {
  app.inFight = false;
  game.clearFighters();
  ui.show('menu');
}

function goSelect() {
  app.inFight = false;
  game.clearFighters();
  app.p1 = null; app.p2 = null;
  app.picking = 0;
  ui.setSelectState(app);
  ui.show('select');
}

function onPick(def, hoverOnly = false) {
  if (hoverOnly) { ui.setSelectState({ ...app, hoverName: def.name }); return; }
  audio.whoosh();
  if (app.picking === 0) {
    app.p1 = def;
    if (app.mode.cpu) {
      app.picking = 2;
      ui.setSelectState(app);
      // CPU "roulette" pick
      let spins = 8;
      const spin = setInterval(() => {
        app.p2 = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
        ui.setSelectState(app);
        if (--spins <= 0) { clearInterval(spin); setTimeout(goVS, 500); }
      }, 120);
    } else {
      app.picking = 1;
      ui.setSelectState(app);
    }
  } else if (app.picking === 1) {
    app.p2 = def;
    app.picking = 2;
    ui.setSelectState(app);
    setTimeout(goVS, 500);
  }
}

function goVS() {
  ui.showVS(app.p1, app.p2, portraits);
  audio.gong();
  setTimeout(startFight, 2200);
}

function startFight() {
  ui.setPortraits(portraits[app.p1.id], portraits[app.p2.id]);
  ui.show('hud');
  app.inFight = true;
  const pads = [input.pads[0], app.mode.cpu ? new VirtualPad() : input.pads[1]];
  game.startMatch([app.p1, app.p2], pads, { cpu: app.mode.cpu, difficulty: app.mode.difficulty });
  audio.startMusic();
}

game.onMatchEnd = (winnerIdx) => {
  app.inFight = false;
  const def = winnerIdx === 0 ? app.p1 : app.p2;
  const who = app.mode.cpu ? (winnerIdx === 0 ? 'PLAYER 1' : 'CPU') : `PLAYER ${winnerIdx + 1}`;
  setTimeout(() => {
    game.clearFighters();
    ui.showVictory(def, portraits, `${who} · FLAWLESS TECHNIQUE`);
    audio.announce(`${def.name} wins`);
  }, 1600);
};

// ---------------------------------------------------------------- menu wiring
for (const btn of document.querySelectorAll('.menu-btn[data-mode]')) {
  btn.addEventListener('click', () => {
    const m = btn.dataset.mode;
    app.mode = m === 'versus'
      ? { cpu: false, difficulty: null }
      : { cpu: true, difficulty: m.replace('cpu-', '') };
    audio.gong();
    goSelect();
  });
}
document.getElementById('btn-controls').addEventListener('click', () => ui.show('controls'));
document.getElementById('btn-controls-back').addEventListener('click', () => ui.show('menu'));
document.getElementById('btn-rematch').addEventListener('click', () => { audio.gong(); goVS(); });
document.getElementById('btn-charselect').addEventListener('click', goSelect);
document.getElementById('btn-mainmenu').addEventListener('click', goMenu);

const muteBtn = document.getElementById('btn-mute');
muteBtn.addEventListener('click', () => {
  audio.setMuted(!audio.muted);
  muteBtn.classList.toggle('muted', audio.muted);
});

// wake up audio on the first interaction anywhere
window.addEventListener('pointerdown', () => audio.ensure(), { once: true });

ui.buildSelectGrid(CHARACTERS, portraits, onPick);
ui.show('menu');

// debug/testing handle
window.__pk = { app, game, input };

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();
let elapsed = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  stage.update(dt, elapsed);
  fx.update(dt);

  if (app.inFight) {
    game.update(dt);
  } else {
    // slow attract-mode camera drift behind the menus
    const t = elapsed * 0.1;
    camera.position.set(Math.sin(t) * 3.5, 2.2 + Math.sin(t * 0.7) * 0.4, 6.5);
    camera.lookAt(0, 1.2, 0);
  }

  input.endFrame();
  composer.render();
}
animate();
