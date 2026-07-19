import * as THREE from 'three';
import { buildRig, applyPose } from './fighter.js';
import { CLIPS } from './animations.js';

const $ = (id) => document.getElementById(id);

// Render each character's rig once into an offscreen canvas → portrait images.
export function renderPortraits(characters) {
  const W = 300, H = 380;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const portraits = {};
  for (const def of characters) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0610);

    const rig = buildRig(def);
    applyPose(rig.joints, CLIPS.portrait.sample(0));
    scene.add(rig.root);

    scene.add(new THREE.AmbientLight(0x404050, 1.2));
    const key = new THREE.DirectionalLight(0xffd9a0, 2.4); key.position.set(2, 2.5, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(def.colors.glow), 3.2); rim.position.set(-3, 1.5, -2); scene.add(rim);
    const under = new THREE.PointLight(0xff5a14, 8, 10, 2); under.position.set(0, 0.2, 1.5); scene.add(under);

    const cam = new THREE.PerspectiveCamera(34, W / H, 0.1, 20);
    cam.position.set(0.25, 1.52, 2.1);
    cam.lookAt(0, 1.22, 0);

    renderer.render(scene, cam);
    portraits[def.id] = renderer.domElement.toDataURL('image/png');
  }
  renderer.dispose();
  return portraits;
}

export class UI {
  constructor() {
    this.screens = {
      menu: $('menu'), controls: $('controls-screen'), select: $('select'),
      vs: $('vs'), hud: $('hud'), victory: $('victory'),
    };
    this.announceEl = $('announce');
    this._announceTimer = null;
    this.hpEls = [$('hud-hp-1'), $('hud-hp-2')];
    this.chipEls = [$('hud-chip-1'), $('hud-chip-2')];
    this.nameEls = [$('hud-name-1'), $('hud-name-2')];
    this.pipEls = [$('hud-pips-1'), $('hud-pips-2')];
    this.comboEls = [$('combo-1'), $('combo-2')];
    this.timerEl = $('hud-timer');
    this._comboTimers = [null, null];
  }

  show(name) {
    for (const [k, el] of Object.entries(this.screens)) el.classList.toggle('hidden', k !== name);
  }
  showHudWith(overlay) {
    for (const [k, el] of Object.entries(this.screens)) {
      el.classList.toggle('hidden', k !== 'hud' && k !== overlay);
    }
  }

  setNames(n1, n2) {
    this.nameEls[0].textContent = n1;
    this.nameEls[1].textContent = n2;
  }

  setHP(i, frac) {
    const f = Math.max(0, Math.min(1, frac));
    const el = this.hpEls[i];
    el.style.transform = `scaleX(${f})`;
    el.classList.toggle('low', f <= 0.5 && f > 0.22);
    el.classList.toggle('critical', f <= 0.22);
    clearTimeout(this._chipT?.[i]);
    this._chipT = this._chipT || [];
    this._chipT[i] = setTimeout(() => { this.chipEls[i].style.transform = `scaleX(${f})`; }, 60);
  }

  setTimer(sec) {
    const s = Math.ceil(sec);
    this.timerEl.textContent = String(s).padStart(2, '0');
    this.timerEl.classList.toggle('urgent', s <= 10);
  }

  setPips(i, count) {
    const pips = this.pipEls[i].querySelectorAll('.pip');
    pips.forEach((p, idx) => p.classList.toggle('won', idx < count));
  }

  announce(text, { red = false, fade = false, hold = 1400 } = {}) {
    const el = this.announceEl;
    clearTimeout(this._announceTimer);
    el.classList.remove('hidden', 'out');
    el.classList.toggle('red', red);
    el.textContent = text;
    // restart pop animation
    void el.offsetWidth;
    this._announceTimer = setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.classList.add('hidden'), 300);
    }, fade ? 800 : hold);
  }

  showCombo(i, count) {
    const el = this.comboEls[i];
    el.querySelector('.combo-num').textContent = count;
    el.classList.remove('hidden');
    void el.offsetWidth;
    clearTimeout(this._comboTimers[i]);
    this._comboTimers[i] = setTimeout(() => el.classList.add('hidden'), 1200);
  }
  hideCombo(i) { this.comboEls[i].classList.add('hidden'); }

  // ---------------------------------------------------------------- select
  buildSelectGrid(characters, portraits, onPick) {
    const grid = $('select-grid');
    grid.innerHTML = '';
    for (const def of characters) {
      const cell = document.createElement('div');
      cell.className = 'select-cell';
      cell.dataset.id = def.id;
      cell.innerHTML = `<img src="${portraits[def.id]}" alt="${def.name}"><div class="cell-name">${def.name}</div>`;
      cell.addEventListener('click', () => onPick(def));
      cell.addEventListener('mouseenter', () => onPick(def, true));
      grid.appendChild(cell);
    }
  }

  setSelectState({ picking, p1, p2, hoverName }) {
    const status = $('select-status');
    if (picking === 0) { status.textContent = 'PLAYER 1 — SELECT'; status.classList.remove('p2'); }
    else if (picking === 1) { status.textContent = 'PLAYER 2 — SELECT'; status.classList.add('p2'); }
    else { status.textContent = 'GET READY'; }
    $('select-name-1').textContent = p1 ? p1.name : (picking === 0 && hoverName ? hoverName : '');
    $('select-name-2').textContent = p2 ? p2.name : (picking === 1 && hoverName ? hoverName : '');
    for (const cell of $('select-grid').children) {
      cell.classList.toggle('picked-1', p1?.id === cell.dataset.id);
      cell.classList.toggle('picked-2', p2?.id === cell.dataset.id);
    }
  }

  showVS(p1, p2, portraits) {
    $('vs-img-1').src = portraits[p1.id];
    $('vs-img-2').src = portraits[p2.id];
    $('vs-name-1').textContent = p1.name;
    $('vs-name-2').textContent = p2.name;
    this.show('vs');
  }

  showVictory(def, portraits, subtitle) {
    $('victory-img').src = portraits[def.id];
    $('victory-title').textContent = `${def.name} WINS`;
    $('victory-sub').textContent = subtitle;
    this.show('victory');
  }
}
