import * as THREE from 'three';
import { CLIPS, STANCE, clonePose } from './animations.js';
import {
  ATTACKS, STAGE_HALF_WIDTH, WALK_SPEED, BACK_SPEED, JUMP_VELOCITY, JUMP_DRIFT,
  GRAVITY, MAX_HP, FREEZE_DURATION, KNOCKDOWN_TIME, GETUP_INVULN, COMBO_DAMAGE_SCALE,
  CHIP_RATIO, DASH_TAP_WINDOW, DASH_TIME, DASH_SPEED, BACKDASH_SPEED, DASH_COOLDOWN,
  INPUT_BUFFER,
} from './config.js';

const HIPS_Y = 0.96;

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.12, ...opts });
}

function capsule(r, len, material) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), material);
  m.castShadow = true;
  return m;
}

function box(w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  return m;
}

// ---------------------------------------------------------------------------
// Rig — a stylized humanoid built from primitives, facing +X.
// ---------------------------------------------------------------------------
export function buildRig(def) {
  const c = def.colors;
  const mats = {
    primary: mat(c.primary),
    secondary: mat(c.secondary, { roughness: 0.5, metalness: 0.3 }),
    accent: mat(c.accent, { roughness: 0.4, metalness: 0.45 }),
    skin: mat(c.skin, { roughness: 0.75, metalness: 0 }),
    dark: mat(c.dark ?? 0x14100e, { roughness: 0.8 }),
    glow: new THREE.MeshStandardMaterial({ color: c.glow, emissive: c.glow, emissiveIntensity: 2.6, roughness: 0.3 }),
  };

  const root = new THREE.Group();
  const joints = {};
  const parts = { mats };

  const hips = new THREE.Group(); hips.position.y = HIPS_Y; root.add(hips); joints.hips = hips;
  const pelvis = box(0.3, 0.24, 0.36, mats.dark); pelvis.position.y = -0.02; hips.add(pelvis);
  const belt = box(0.32, 0.09, 0.38, mats.accent); belt.position.y = 0.1; hips.add(belt);

  const spine = new THREE.Group(); spine.position.y = 0.1; hips.add(spine); joints.spine = spine;
  const torso = box(0.32, 0.5, 0.42, mats.primary); torso.position.y = 0.27; spine.add(torso);
  const chest = box(0.12, 0.3, 0.44, mats.secondary); chest.position.set(0.13, 0.32, 0); spine.add(chest);
  parts.torsoG = spine; parts.chest = chest;

  // head
  const neck = new THREE.Group(); neck.position.y = 0.54; spine.add(neck); joints.head = neck;
  const headG = new THREE.Group(); headG.position.y = 0.14; neck.add(headG);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.155, 18, 14), mats.skin);
  skull.castShadow = true; skull.scale.set(1.05, 1.15, 0.95); headG.add(skull);
  const eyeGeo = new THREE.BoxGeometry(0.05, 0.028, 0.045);
  const eyeL = new THREE.Mesh(eyeGeo, mats.glow); eyeL.position.set(0.125, 0.03, 0.06); headG.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, mats.glow); eyeR.position.set(0.125, 0.03, -0.06); headG.add(eyeR);
  parts.headG = headG; parts.eyes = [eyeL, eyeR];

  // arms
  function buildArm(side) { // side: +1 = left (+Z), -1 = right (-Z)
    const sh = new THREE.Group(); sh.position.set(0, 0.46, side * 0.29); spine.add(sh);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.secondary);
    pad.castShadow = true; pad.scale.set(1, 0.85, 1); sh.add(pad);
    const upper = capsule(0.075, 0.2, mats.primary); upper.position.y = -0.15; sh.add(upper);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    const fore = capsule(0.065, 0.17, mats.dark); fore.position.y = -0.13; el.add(fore);
    const bracer = capsule(0.075, 0.08, mats.accent); bracer.position.y = -0.1; el.add(bracer);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 10), mats.dark);
    fist.castShadow = true; fist.scale.set(1.15, 1, 1); fist.position.y = -0.31; el.add(fist);
    return { sh, el, fore, fist };
  }
  const armL = buildArm(1), armR = buildArm(-1);
  joints.shL = armL.sh; joints.elL = armL.el; joints.shR = armR.sh; joints.elR = armR.el;
  parts.fistL = armL.fist; parts.fistR = armR.fist;

  // legs
  function buildLeg(side) {
    const hip = new THREE.Group(); hip.position.set(0, -0.08, side * 0.14); hips.add(hip);
    const thigh = capsule(0.095, 0.24, mats.primary); thigh.position.y = -0.19; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
    const shin = capsule(0.078, 0.22, mats.dark); shin.position.y = -0.17; knee.add(shin);
    const ankle = new THREE.Group(); ankle.position.y = -0.4; knee.add(ankle);
    const foot = box(0.27, 0.09, 0.13, mats.dark); foot.position.set(0.07, -0.03, 0); ankle.add(foot);
    return { hip, knee, ankle, shin };
  }
  const legL = buildLeg(1), legR = buildLeg(-1);
  joints.hipL = legL.hip; joints.kneeL = legL.knee; joints.footL = legL.ankle;
  joints.hipR = legR.hip; joints.kneeR = legR.knee; joints.footR = legR.ankle;

  if (def.decorate) def.decorate({ THREE, root, joints, parts, mats, colors: c });

  return { root, joints, parts, mats };
}

// Apply a sampled pose to a rig's joints (also used by the portrait renderer).
export function applyPose(joints, pose) {
  joints.hips.position.y = HIPS_Y + pose.hips[0];
  joints.hips.rotation.set(pose.hips[1], pose.hips[2], pose.hips[3]);
  joints.spine.rotation.set(pose.spine[0], pose.spine[1], pose.spine[2]);
  joints.head.rotation.set(pose.head[0], pose.head[1], pose.head[2]);
  joints.shL.rotation.set(pose.shL[0], pose.shL[1], pose.shL[2]);
  joints.shR.rotation.set(pose.shR[0], pose.shR[1], pose.shR[2]);
  joints.hipL.rotation.set(pose.hipL[0], pose.hipL[1], pose.hipL[2]);
  joints.hipR.rotation.set(pose.hipR[0], pose.hipR[1], pose.hipR[2]);
  joints.elL.rotation.z = pose.elL;
  joints.elR.rotation.z = pose.elR;
  joints.kneeL.rotation.z = pose.kneeL;
  joints.kneeR.rotation.z = pose.kneeR;
  joints.footL.rotation.z = pose.footL;
  joints.footR.rotation.z = pose.footR;
}

// ---------------------------------------------------------------------------
// Fighter — gameplay state machine + animation playback.
// ---------------------------------------------------------------------------
export class Fighter {
  constructor(def, pad, scene) {
    this.def = def;
    this.pad = pad;
    this.scene = scene;

    const rig = buildRig(def);
    this.root = rig.root;
    this.joints = rig.joints;
    this.parts = rig.parts;
    this.mats = rig.mats;
    scene.add(this.root);

    this._tintSaved = null;
    this._pose = clonePose(STANCE);

    this.opponent = null;
    this.game = null;
    this.reset(0, 1);
  }

  reset(x, facing) {
    this.x = x; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.facing = facing;
    this.hp = MAX_HP;
    this.state = 'idle';
    this.stateT = 0;
    this.animName = 'idle';
    this.animT = 0;
    this.attack = null;
    this.hitstunT = 0;
    this.freezeT = 0;
    this.invulnT = 0;
    this.spCooldown = 0;
    this.dashCooldown = 0;
    this._tapDir = 0;          // last tapped direction for double-tap dash
    this._tapAge = Infinity;
    this.buffered = null;      // { btn, t } attack press stored while busy
    this.controlEnabled = false;
    this.clearTint();
    this._applyCurrentPose(0);
  }

  get onGround() { return this.y <= 0.001; }
  get crouching() { return this.state === 'crouch' || this.state === 'blockcrouch' || this.state === 'hitcrouch'; }
  get airborne() { return !this.onGround; }
  get alive() { return this.hp > 0; }
  get busy() { return ['attack', 'hitstun', 'launched', 'knockdown', 'getup', 'frozen', 'ko'].includes(this.state); }

  // held direction relative to facing: +1 forward, -1 back, 0 neutral
  heldDir() {
    const h = this.pad.held;
    const dx = (h.right ? 1 : 0) - (h.left ? 1 : 0);
    return dx * this.facing;
  }

  isBlockReady() {
    // hold-back-to-block, only while grounded and not doing anything else
    return this.controlEnabled && this.onGround && this.heldDir() < 0 &&
      ['idle', 'walk', 'crouch', 'block', 'blockcrouch'].includes(this.state);
  }

  setAnim(name, restart = false) {
    if (this.animName !== name || restart) { this.animName = name; this.animT = 0; }
  }

  // Store attack presses made while busy so they fire on recovery; also called
  // by the game during hitstop so presses aren't lost while updates are paused.
  bufferInput(dt) {
    if (this.buffered && (this.buffered.t -= dt) <= 0) this.buffered = null;
    if (!this.controlEnabled) return;
    if (!['attack', 'hitstun', 'hitcrouch', 'blockstun', 'dash'].includes(this.state)) return;
    const pr = this.pad.pressed;
    for (const b of ['hp', 'hk', 'lp', 'lk']) {
      if (pr[b]) { this.buffered = { btn: b, t: INPUT_BUFFER }; break; }
    }
  }

  startDash(dir) {
    const rel = dir * this.facing;
    this.state = 'dash'; this.stateT = 0;
    this.vx = dir * (rel >= 0 ? DASH_SPEED : BACKDASH_SPEED);
    this.dashCooldown = DASH_COOLDOWN;
    this._tapDir = 0; this._tapAge = Infinity;
    this.setAnim('walk', true);
  }

  startAttack(key, def) {
    this.state = 'attack';
    this.stateT = 0;
    this.attack = { key, def, hasHit: false, spawned: false, teleported: false };
    this.setAnim(def.anim, true);
    this.vx = 0;
    if (this.game) this.game.onAttackStart(this, def);
  }

  startSpecial(slot) {
    const sp = this.def[slot];
    if (!sp || this.spCooldown > 0) return false;
    const def = {
      anim: sp.anim, dmg: sp.dmg, range: sp.range ?? 1.4,
      active: sp.active ?? [0, 0], total: sp.total,
      hitstun: sp.hitstun ?? 0.5, blockstun: 0.3,
      push: sp.push ?? 1.2, shove: 0.3,
      knockdown: sp.knockdown, launch: sp.launch, low: sp.low,
      special: sp,
    };
    this.startAttack(slot, def);
    this.spCooldown = 1.0;
    return true;
  }

  // ------------------------------------------------------------------ update
  update(dt) {
    const opp = this.opponent;
    this.stateT += dt;
    if (this.spCooldown > 0) this.spCooldown -= dt;
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    this._tapAge += dt;
    this.bufferInput(dt);

    switch (this.state) {
      case 'idle': case 'walk': case 'crouch': case 'block': case 'blockcrouch':
        this.updateGrounded(dt); break;
      case 'dash':
        if (this.stateT >= DASH_TIME) {
          this.state = 'idle'; this.stateT = 0; this.vx = 0; this.setAnim('idle');
        }
        break;
      case 'jump': this.updateJump(dt); break;
      case 'attack': this.updateAttack(dt); break;
      case 'hitstun': case 'hitcrouch':
        this.vx *= Math.pow(0.02, dt);
        if (this.stateT >= this.hitstunT) { this.state = this.state === 'hitcrouch' ? 'crouch' : 'idle'; this.stateT = 0; }
        break;
      case 'blockstun':
        this.vx *= Math.pow(0.02, dt);
        if (this.stateT >= this.hitstunT) { this.state = 'idle'; this.stateT = 0; }
        break;
      case 'launched':
        this.vy -= GRAVITY * dt;
        this.y += this.vy * dt;
        if (this.y <= 0 && this.vy < 0) {
          this.y = 0; this.vx = 0;
          this.state = 'knockdown'; this.stateT = 0;
          this.setAnim('knockdown', true);
          if (this.game) this.game.onLand(this, true);
        }
        break;
      case 'knockdown':
        this.vx *= Math.pow(0.05, dt);
        if (this.stateT >= KNOCKDOWN_TIME && this.alive && this.controlEnabled) {
          this.state = 'getup'; this.stateT = 0;
          this.setAnim('getup', true);
          this.invulnT = CLIPS.getup.dur + GETUP_INVULN;
        }
        break;
      case 'getup':
        if (this.stateT >= CLIPS.getup.dur) { this.state = 'idle'; this.stateT = 0; }
        break;
      case 'frozen':
        this.freezeT -= dt;
        if (this.freezeT <= 0) { this.clearTint(); this.state = 'idle'; this.stateT = 0; }
        break;
      case 'ko': case 'win': case 'intro':
        this.vx *= Math.pow(0.05, dt);
        break;
    }

    // shared horizontal motion & bounds
    this.x += this.vx * dt;
    this.x = Math.max(-STAGE_HALF_WIDTH, Math.min(STAGE_HALF_WIDTH, this.x));

    // face the opponent whenever free to
    if (opp && this.onGround && ['idle', 'walk', 'crouch'].includes(this.state)) {
      this.facing = opp.x >= this.x ? 1 : -1;
    }

    this.updateAnimation(dt);
  }

  updateGrounded(dt) {
    const pad = this.pad, held = pad.held, pressed = pad.pressed;
    if (!this.controlEnabled) {
      this.vx = 0;
      this.state = 'idle'; this.setAnim('idle');
      return;
    }

    // --- double-tap dash
    if (pressed.left || pressed.right) {
      const d = pressed.right ? 1 : -1;
      if (d === this._tapDir && this._tapAge <= DASH_TAP_WINDOW && this.dashCooldown <= 0) {
        return this.startDash(d);
      }
      this._tapDir = d; this._tapAge = 0;
    }

    // --- attacks first (a buffered press from recovery counts as pressed now)
    if (pressed.sp1 && this.startSpecial('sp1')) return;
    if (pressed.sp2 && this.startSpecial('sp2')) return;
    const buf = this.buffered ? this.buffered.btn : null;
    if (buf) this.buffered = null;
    const down = held.down;
    if (pressed.hp || buf === 'hp') return this.startAttack(down ? 'uppercut' : 'hp', down ? ATTACKS.uppercut : ATTACKS.hp);
    if ((pressed.lp || buf === 'lp') && !down) return this.startAttack('lp', ATTACKS.lp);
    if (pressed.hk || buf === 'hk') return this.startAttack(down ? 'sweep' : 'hk', down ? ATTACKS.sweep : ATTACKS.hk);
    if ((pressed.lk || buf === 'lk') && !down) return this.startAttack('lk', ATTACKS.lk);

    // --- jump
    if (pressed.up) {
      this.state = 'jump'; this.stateT = 0;
      this.vy = JUMP_VELOCITY;
      const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      this.vx = dir * JUMP_DRIFT;
      this.setAnim('jump', true);
      this.airAttacked = false;
      if (this.game) this.game.onJump(this);
      return;
    }

    // --- crouch / block / walk
    const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    const rel = dir * this.facing;
    const oppAttacking = this.opponent && (this.opponent.state === 'attack' || this.game?.hasHostileProjectile(this));

    if (down) {
      this.vx = 0;
      if (rel < 0 && oppAttacking) { this.state = 'blockcrouch'; this.setAnim('blockCrouch'); }
      else { this.state = 'crouch'; this.setAnim('crouch'); }
      return;
    }
    if (rel < 0 && oppAttacking) {
      this.vx = -this.facing * BACK_SPEED * 0.4;
      this.state = 'block'; this.setAnim('block');
      return;
    }
    if (dir !== 0) {
      this.vx = dir * (rel > 0 ? WALK_SPEED : BACK_SPEED);
      this.state = 'walk'; this.setAnim('walk');
    } else {
      this.vx = 0;
      this.state = 'idle'; this.setAnim('idle');
    }
  }

  updateJump(dt) {
    this.vy -= GRAVITY * dt;
    this.y += this.vy * dt;
    const pr = this.pad.pressed;
    if (this.controlEnabled && !this.airAttacked && (pr.lk || pr.hk || pr.lp || pr.hp)) {
      this.airAttacked = true;
      this.attack = { key: 'jumpKick', def: ATTACKS.jumpKick, hasHit: false };
      this.setAnim('jumpKick', true);
      this.attackT = 0;
      if (this.game) this.game.onAttackStart(this, ATTACKS.jumpKick);
    }
    if (this.attack) this.attackT = (this.attackT ?? 0) + dt;
    if (this.y <= 0 && this.vy < 0) {
      this.y = 0; this.vy = 0; this.vx = 0;
      this.attack = null;
      this.state = 'idle'; this.stateT = 0;
      this.setAnim('idle', true);
      if (this.game) this.game.onLand(this, false);
    }
  }

  updateAttack(dt) {
    const a = this.attack;
    if (!a) { this.state = 'idle'; return; }
    const sp = a.def.special;
    const t = this.stateT;

    if (sp) {
      if (sp.type === 'projectile' && !a.spawned && t >= sp.spawnT) {
        a.spawned = true;
        this.game.spawnProjectile(this, sp);
      }
      if (sp.type === 'slide') {
        if (t >= sp.moveFrom && t <= sp.moveTo) this.vx = this.facing * sp.speed;
        else this.vx = 0;
      }
      if (sp.type === 'teleport' && !a.teleported && t >= sp.tpT) {
        a.teleported = true;
        this.game.doTeleport(this);
      }
      if (sp.type === 'rise' && !a.spawned && t >= sp.riseT) {
        a.spawned = true;
        this.vy = 5.5; this.y = Math.max(this.y, 0.01);
        this.game.onRise(this);
      }
    }
    if (sp?.type === 'rise' && this.y > 0) {
      this.vy -= GRAVITY * dt; this.y = Math.max(0, this.y + this.vy * dt);
    }

    const total = a.def.total ?? CLIPS[a.def.anim].dur;
    if (t >= total) {
      this.attack = null;
      this.state = 'idle'; this.stateT = 0;
      this.vx = 0; this.y = Math.max(0, this.y);
    }
  }

  // attack hit window helpers -------------------------------------------------
  activeAttack() {
    if (this.state === 'jump' && this.attack && !this.attack.hasHit) {
      const t = this.attackT ?? 0;
      const [s, e] = this.attack.def.active;
      if (t >= s && t <= e) return this.attack;
      return null;
    }
    if (this.state !== 'attack' || !this.attack || this.attack.hasHit) return null;
    const [s, e] = this.attack.def.active;
    if (this.stateT >= s && this.stateT <= e) return this.attack;
    return null;
  }

  // ------------------------------------------------------------------ damage
  receiveHit(def, attacker, opts = {}) {
    if (this.invulnT > 0 || this.state === 'ko' || this.state === 'knockdown' || this.state === 'getup') return 'miss';

    const away = attacker ? (this.x >= attacker.x ? 1 : -1) : this.facing * -1;

    // blocking?
    const blockReady = this.isBlockReady() || this.state === 'block' || this.state === 'blockcrouch' || this.state === 'blockstun';
    const crouchBlock = this.crouching || this.state === 'blockcrouch' || (blockReady && this.pad.held.down);
    let blocked = false;
    if (blockReady && this.onGround) {
      if (def.low && !crouchBlock) blocked = false;
      else if (def.high && crouchBlock && !opts.projectile) blocked = true; // crouch-block still stops highs
      else blocked = true;
    }

    if (blocked) {
      const chip = def.special || opts.projectile ? Math.max(1, Math.round(def.dmg * CHIP_RATIO)) : 0;
      this.hp = Math.max(1, this.hp - chip);
      this.state = 'blockstun'; this.stateT = 0;
      this.hitstunT = def.blockstun ?? 0.22;
      this.vx = away * (def.push ?? 0.6) * 2.2;
      this.setAnim(crouchBlock ? 'blockCrouch' : 'block', true);
      return 'blocked';
    }

    // clean hit
    const comboIdx = Math.min(opts.comboIdx ?? 0, COMBO_DAMAGE_SCALE.length - 1);
    const dmg = Math.max(1, Math.round(def.dmg * COMBO_DAMAGE_SCALE[comboIdx]));
    this.hp = Math.max(0, this.hp - dmg);
    this.attack = null;

    if (opts.freeze && this.onGround && this.alive) {
      this.state = 'frozen'; this.stateT = 0;
      this.freezeT = FREEZE_DURATION;
      this.applyTint(0x7fd4ff, 0x2277cc);
      this.vx = 0;
      return 'frozen';
    }

    if (!this.alive) {
      this.state = 'launched'; this.stateT = 0;
      this.vy = def.launch ? 7.5 : 4.5;
      this.vx = away * 3.2;
      this.y = Math.max(this.y, 0.01);
      this.setAnim('hit', true);
      return 'ko';
    }

    if (def.launch || this.airborne) {
      this.state = 'launched'; this.stateT = 0;
      this.vy = def.launch ? 7.8 : 3.5;
      this.vx = away * 2.6;
      this.y = Math.max(this.y, 0.01);
      this.setAnim('hit', true);
    } else if (def.knockdown) {
      this.state = 'launched'; this.stateT = 0;
      this.vy = 3.4;
      this.vx = away * (def.push ?? 1.2) * 2.4;
      this.y = 0.01;
      this.setAnim('hit', true);
    } else {
      const wasCrouch = this.crouching;
      this.state = wasCrouch ? 'hitcrouch' : 'hitstun'; this.stateT = 0;
      this.hitstunT = def.hitstun ?? 0.35;
      this.vx = away * (def.push ?? 0.6) * 2.6;
      this.setAnim(wasCrouch ? 'hitCrouch' : 'hit', true);
    }
    return 'hit';
  }

  // ------------------------------------------------------------------ visuals
  applyTint(colorHex, emissiveHex) {
    if (this._tintSaved) return;
    this._tintSaved = [];
    for (const m of Object.values(this.mats)) {
      this._tintSaved.push({ m, color: m.color.getHex(), em: m.emissive.getHex(), ei: m.emissiveIntensity });
      m.color.setHex(colorHex);
      m.emissive.setHex(emissiveHex);
      m.emissiveIntensity = 0.55;
    }
  }
  clearTint() {
    if (!this._tintSaved) return;
    for (const s of this._tintSaved) { s.m.color.setHex(s.color); s.m.emissive.setHex(s.em); s.m.emissiveIntensity = s.ei; }
    this._tintSaved = null;
  }

  currentClip() {
    return CLIPS[this.animName] ?? CLIPS.idle;
  }

  updateAnimation(dt) {
    if (this.state === 'frozen') { /* pose frozen in place */ }
    else if (this.state === 'walk') {
      // play walk forward, reverse when walking backwards
      const rel = Math.sign(this.vx) * this.facing;
      this.animT += dt * (rel >= 0 ? 1.15 : -1.0);
    } else if (this.state === 'dash') {
      // reuse the walk clip at a sprint-like rate
      const rel = Math.sign(this.vx) * this.facing;
      this.animT += dt * (rel >= 0 ? 2.3 : -2.0);
    } else if (this.state === 'ko' && this.animName === 'knockdown' && this.animT >= CLIPS.knockdown.dur) {
      // hold final frame
    } else {
      this.animT += dt;
    }
    this._applyCurrentPose(dt);
  }

  _applyCurrentPose() {
    const clip = this.currentClip();
    const pose = clip.sample(this.animT);
    applyPose(this.joints, pose);
    this.root.position.set(this.x, this.y, 0);
    this.root.rotation.y = this.facing === 1 ? 0 : Math.PI;
  }

  // world-space point roughly at the fists, for FX / projectile spawns
  handPoint(target) {
    target.set(this.x + this.facing * 0.75, this.y + 1.25, 0);
    return target;
  }
}
