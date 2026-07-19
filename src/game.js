import * as THREE from 'three';
import { Fighter } from './fighter.js';
import { AI } from './ai.js';
import { makeProjectileVisual } from './fx.js';
import {
  MIN_SEPARATION, ROUND_TIME, ROUNDS_TO_WIN, STAGE_HALF_WIDTH, PROJECTILE_SPEED,
} from './config.js';

const START_X = 3.1;

export class Game {
  constructor(scene, camera, fx, audio, ui, input) {
    this.scene = scene;
    this.camera = camera;
    this.fx = fx;
    this.audio = audio;
    this.ui = ui;
    this.input = input;

    this.fighters = [];
    this.projectiles = [];
    this.ai = null;
    this.phase = 'idle';       // intro | fight | ko | roundEnd | matchEnd
    this.phaseT = 0;
    this.timeScale = 1;
    this.roundNum = 0;
    this.wins = [0, 0];
    this.combo = [{ count: 0 }, { count: 0 }];
    this.onMatchEnd = null;
    this._camPos = new THREE.Vector3(0, 1.8, 6.4);
    this._camTarget = new THREE.Vector3(0, 1.2, 0);
    this._v = new THREE.Vector3();
  }

  startMatch(defs, pads, { cpu = false, difficulty = 'medium' } = {}) {
    this.clearFighters();
    this.wins = [0, 0];
    this.roundNum = 0;

    this.fighters = [
      new Fighter(defs[0], pads[0], this.scene),
      new Fighter(defs[1], pads[1], this.scene),
    ];
    this.fighters[0].opponent = this.fighters[1];
    this.fighters[1].opponent = this.fighters[0];
    for (const f of this.fighters) f.game = this;

    this.ai = cpu ? new AI(this.fighters[1], this.fighters[0], this, difficulty) : null;

    this.ui.setNames(defs[0].name, defs[1].name);
    this.ui.setPips(0, 0); this.ui.setPips(1, 0);
    this.startRound();
  }

  clearFighters() {
    for (const f of this.fighters) this.scene.remove(f.root);
    for (const p of this.projectiles) p.visual.dispose();
    this.fighters = [];
    this.projectiles = [];
  }

  startRound() {
    this.roundNum++;
    this.timer = ROUND_TIME;
    this.phase = 'intro';
    this.phaseT = 0;
    this.timeScale = 1;
    this.combo = [{ count: 0 }, { count: 0 }];
    for (const p of this.projectiles) p.visual.dispose();
    this.projectiles = [];

    this.fighters[0].reset(-START_X, 1);
    this.fighters[1].reset(START_X, -1);
    this.ui.setHP(0, 1); this.ui.setHP(1, 1);
    this.ui.setTimer(this.timer);
    this.ui.hideCombo(0); this.ui.hideCombo(1);

    this.ui.announce(`ROUND ${this.roundNum}`);
    this.audio.announce(`Round ${this.roundNum}`);
    this.audio.gong();
  }

  // ------------------------------------------------------------------ events
  onAttackStart(f, def) {
    this.audio.whoosh();
    if (def.special?.type) this.audio.special(def.special.effect ?? 'burn');
  }
  onJump() {}
  onLand(f, hard) {
    if (hard) this.fx.shake(0.25);
  }
  onRise(f) {
    this.fx.burst(this._v.set(f.x, f.y + 1, 0), { color: 0xff8a20, count: 30, speed: 5, size: 0.09, life: 0.5 });
    this.fx.shake(0.3);
  }

  doTeleport(f) {
    const opp = f.opponent;
    this.fx.teleportFlash(this._v.set(f.x, 1.1, 0).clone());
    const side = f.x <= opp.x ? 1 : -1;   // reappear on the far side of the opponent
    f.x = Math.max(-STAGE_HALF_WIDTH, Math.min(STAGE_HALF_WIDTH, opp.x + side * 1.05));
    f.facing = opp.x >= f.x ? 1 : -1;
    this.fx.teleportFlash(this._v.set(f.x, 1.1, 0).clone());
    this.audio.special('shock');
  }

  spawnProjectile(f, sp) {
    const visual = makeProjectileVisual(this.scene, sp);
    this.projectiles.push({
      x: f.x + f.facing * 0.9, y: f.y + 1.25, vx: f.facing * (sp.speed ?? PROJECTILE_SPEED),
      owner: f, sp, visual, trail: 0,
    });
  }

  hasHostileProjectile(f) {
    return this.projectiles.some(p => p.owner !== f && Math.sign(f.x - p.x) === Math.sign(p.vx) && Math.abs(p.x - f.x) < 4.5);
  }

  // ------------------------------------------------------------------ update
  update(rawDt) {
    if (!this.fighters.length) return;
    const dt = rawDt * this.timeScale;
    this.phaseT += rawDt;

    switch (this.phase) {
      case 'intro':
        if (this.phaseT > 1.1 && !this._fightShown) {
          this._fightShown = true;
          this.ui.announce('FIGHT!', { red: true, fade: true });
          this.audio.announce('Fight');
        }
        if (this.phaseT > 1.5) {
          this._fightShown = false;
          this.phase = 'fight';
          this.phaseT = 0;
          for (const f of this.fighters) f.controlEnabled = true;
        }
        break;

      case 'fight':
        this.timer -= dt;
        if (this.timer <= 0) { this.timer = 0; this.timeUp(); }
        this.ui.setTimer(this.timer);
        break;

      case 'ko':
        // slow-motion drama, then round end
        if (this.phaseT > 2.3) this.endRound();
        break;

      case 'roundEnd':
        if (this.phaseT > 2.6) {
          if (this.wins[0] >= ROUNDS_TO_WIN || this.wins[1] >= ROUNDS_TO_WIN) this.endMatch();
          else this.startRound();
        }
        break;
    }

    if (this.ai && this.phase === 'fight') this.ai.update(dt);

    for (const f of this.fighters) f.update(dt);
    this.separate();
    this.updateProjectiles(dt);
    if (this.phase === 'fight') this.detectHits();

    // AI pad edge-flags live outside Input's pads
    if (this.ai) this.fighters[1].pad.endFrame();

    this.updateCamera(rawDt);
  }

  separate() {
    const [a, b] = this.fighters;
    if (!a.onGround && !b.onGround) return;
    const overlap = MIN_SEPARATION - Math.abs(a.x - b.x);
    if (overlap > 0 && Math.abs(a.y - b.y) < 1.2) {
      const dir = a.x <= b.x ? 1 : -1;
      const half = overlap / 2;
      a.x -= dir * half; b.x += dir * half;
      a.x = Math.max(-STAGE_HALF_WIDTH, Math.min(STAGE_HALF_WIDTH, a.x));
      b.x = Math.max(-STAGE_HALF_WIDTH, Math.min(STAGE_HALF_WIDTH, b.x));
    }
  }

  detectHits() {
    for (let i = 0; i < 2; i++) {
      const a = this.fighters[i];
      const atk = a.activeAttack();
      if (!atk) continue;
      const v = a.opponent;
      const def = atk.def;

      const dx = (v.x - a.x) * a.facing;
      if (dx < -0.35 || dx > def.range) continue;

      // vertical reach checks
      const vTop = v.y + (v.crouching ? 1.05 : 1.75);
      const attackY = a.y + (def.low ? 0.3 : 1.2);
      if (def.launch) { /* uppercuts reach high */ }
      else if (attackY > vTop + 0.25 || (v.airborne && v.y > 1.15 && a.onGround)) continue;
      if (v.crouching && def.high && a.onGround) continue; // highs whiff on crouchers

      atk.hasHit = true;
      this.applyHit(a, v, def, { special: !!def.special, effect: def.special?.effect });
    }
  }

  applyHit(attacker, victim, def, { projectile = false, effect = null } = {}) {
    const i = this.fighters.indexOf(attacker);
    const combo = this.combo[i];
    const wasVulnerable = ['hitstun', 'hitcrouch', 'launched', 'frozen', 'blockstun'].includes(victim.state);

    const result = victim.receiveHit(def, attacker, {
      projectile,
      freeze: effect === 'freeze',
      comboIdx: wasVulnerable ? combo.count : 0,
    });
    if (result === 'miss') return;

    const impact = this._v.set(
      (attacker.x + victim.x) / 2 + attacker.facing * 0.2,
      victim.y + (def.low ? 0.5 : 1.25),
      0.1
    );

    if (result === 'blocked') {
      this.fx.blockSpark(impact);
      this.audio.block();
      this.ui.setHP(this.fighters.indexOf(victim), victim.hp / 100);
      combo.count = 0;
      return;
    }

    // clean hit
    combo.count = wasVulnerable ? combo.count + 1 : 1;
    if (combo.count >= 2) this.ui.showCombo(i, combo.count);
    else this.ui.hideCombo(i);

    const heavy = def.dmg >= 8;
    if (effect) this.fx.elementBurst(impact, effect);
    else {
      this.fx.hitSpark(impact, heavy);
      this.fx.blood(impact, heavy);
    }
    if (result === 'frozen') this.audio.special('freeze');
    else { this.audio.punch(heavy); this.audio.hitHurt(); }
    this.fx.shake(heavy ? 0.5 : 0.25);

    const vi = this.fighters.indexOf(victim);
    this.ui.setHP(vi, victim.hp / 100);

    if (result === 'ko') this.startKO(attacker, victim);
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.visual.group.position.set(p.x, p.y, 0);
      p.visual.update(dt);

      // trail
      p.trail -= dt;
      if (p.trail <= 0) {
        p.trail = 0.03;
        this.fx.burst(this._v.set(p.x, p.y, 0), {
          color: p.sp.color, count: 2, speed: 0.7, gravity: -0.5, size: 0.07, life: 0.35, spread: 0.6,
        });
      }

      if (Math.abs(p.x) > STAGE_HALF_WIDTH + 3) {
        p.visual.dispose();
        this.projectiles.splice(i, 1);
        continue;
      }

      const v = p.owner.opponent;
      if (this.phase === 'fight' && Math.abs(p.x - v.x) < 0.55) {
        const bottom = v.y + 0.15, top = v.y + (v.crouching ? 1.05 : 1.75);
        if (p.y > bottom && p.y < top) {
          const def = {
            dmg: p.sp.dmg, hitstun: p.sp.hitstun, blockstun: 0.3,
            push: p.sp.push, special: true, knockdown: p.sp.effect === 'shock',
          };
          this.fx.elementBurst(this._v.set(p.x, p.y, 0.1), p.sp.effect);
          this.applyHit(p.owner, v, def, { projectile: true, effect: p.sp.effect });
          p.visual.dispose();
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  // ------------------------------------------------------------------ round flow
  startKO(winner, loser) {
    if (this.phase !== 'fight') return;
    this.phase = 'ko';
    this.phaseT = 0;
    this.timeScale = 0.22;
    for (const f of this.fighters) f.controlEnabled = false;
    this.ui.announce('K.O.', { red: true });
    this.audio.announce('K O');
    this.audio.ko();
    this.fx.koBurst(this._v.set(loser.x, loser.y + 1.2, 0.2));
    this.fx.shake(1.0);
    this._roundWinner = winner;
    this._flawless = winner.hp >= 100;
  }

  timeUp() {
    if (this.phase !== 'fight') return;
    const [a, b] = this.fighters;
    this.ui.announce('TIME UP', { red: true });
    for (const f of this.fighters) f.controlEnabled = false;
    if (a.hp === b.hp) { this.phase = 'roundEnd'; this.phaseT = 0; return; } // replay round
    this._roundWinner = a.hp > b.hp ? a : b;
    this._flawless = false;
    this.phase = 'ko';
    this.phaseT = 1.0; // skip most of the slow-mo
    this.timeScale = 0.6;
  }

  endRound() {
    this.timeScale = 1;
    this.phase = 'roundEnd';
    this.phaseT = 0;
    const w = this._roundWinner;
    if (w) {
      const wi = this.fighters.indexOf(w);
      this.wins[wi]++;
      this.ui.setPips(wi, this.wins[wi]);
      if (w.alive) { w.state = 'win'; w.setAnim('win', true); }
      const loser = w.opponent;
      if (!loser.alive) { loser.state = 'ko'; }
      this.ui.announce(this._flawless ? 'FLAWLESS VICTORY' : `${w.def.name} WINS`, { small: this._flawless });
      this.audio.announce(this._flawless ? 'Flawless victory' : `${w.def.name} wins`);
    }
    this._roundWinner = null;
  }

  endMatch() {
    this.phase = 'matchEnd';
    const wi = this.wins[0] >= ROUNDS_TO_WIN ? 0 : 1;
    if (this.onMatchEnd) this.onMatchEnd(wi, this.wins);
  }

  // ------------------------------------------------------------------ camera
  updateCamera(dt) {
    const [a, b] = this.fighters;
    let midX = 0, span = 6, midY = 1.15;
    if (a && b) {
      midX = (a.x + b.x) / 2;
      span = Math.abs(a.x - b.x);
      midY = 1.05 + Math.max(a.y, b.y) * 0.3;
    }

    let tx = midX, ty = 1.55 + span * 0.05, tz = 4.6 + span * 0.5;
    let lx = midX, ly = midY, lz = 0;

    if (this.phase === 'ko' && this._roundWinner) {
      // dramatic push-in on the winner
      const w = this._roundWinner;
      tx = w.x + w.facing * 0.4; ty = 1.35; tz = 3.4;
      lx = w.x; ly = 1.15;
    }

    tx = Math.max(-5.5, Math.min(5.5, tx));

    const k = 1 - Math.pow(0.001, dt);
    this._camPos.x += (tx - this._camPos.x) * k;
    this._camPos.y += (ty - this._camPos.y) * k;
    this._camPos.z += (tz - this._camPos.z) * k;
    this._camTarget.x += (lx - this._camTarget.x) * k;
    this._camTarget.y += (ly - this._camTarget.y) * k;
    this._camTarget.z += (lz - this._camTarget.z) * k;

    const s = this.fx.shakeAmount;
    this.camera.position.set(
      this._camPos.x + (Math.random() - 0.5) * s * 0.3,
      this._camPos.y + (Math.random() - 0.5) * s * 0.25,
      this._camPos.z + (Math.random() - 0.5) * s * 0.1
    );
    this.camera.lookAt(this._camTarget);
  }
}
