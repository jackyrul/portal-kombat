import * as THREE from 'three';

// Particle bursts, projectile visuals, camera shake. Bursts are short-lived
// THREE.Points clouds simulated on the CPU — cheap at this scale.

// Shared soft radial-gradient dot, so points/sprites are round, not square.
let _softTex = null;
export function softCircleTexture() {
  if (_softTex) return _softTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  _softTex = new THREE.CanvasTexture(cv);
  return _softTex;
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
    this.shakeAmount = 0;
    this.flashes = [];
    this.rings = [];
  }

  burst(pos, { color = 0xffd75e, count = 18, speed = 5, gravity = 9, size = 0.07, life = 0.5, spread = 1, up = 0.5 } = {}) {
    const positions = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z;
      const th = Math.random() * Math.PI * 2;
      const sp = speed * (0.35 + Math.random() * 0.65);
      vels.push(new THREE.Vector3(
        Math.cos(th) * sp * spread,
        (Math.random() * 2 - 1 + up) * sp,
        Math.sin(th) * sp * spread * 0.6
      ));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color, size, transparent: true, opacity: 1, map: softCircleTexture(),
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.bursts.push({ points, geo, mat, vels, life, maxLife: life, gravity, count });
  }

  hitSpark(pos, heavy = false) {
    this.burst(pos, { color: 0xffe08a, count: heavy ? 26 : 14, speed: heavy ? 7 : 4.5, size: 0.085, life: 0.35 });
    this.burst(pos, { color: 0xff8a30, count: 8, speed: 3, size: 0.06, life: 0.3 });
    this.flash(pos, 0xffd090, heavy ? 1.6 : 1.0);
    if (heavy) this.shockwave(pos, { color: 0xffc860 });
  }

  blood(pos, heavy = false) {
    this.burst(pos, {
      color: 0xc01414, count: heavy ? 34 : 20, speed: heavy ? 5.5 : 3.8,
      gravity: 14, size: 0.075, life: 0.6, up: 0.9,
    });
  }

  blockSpark(pos) {
    this.burst(pos, { color: 0x9fb8ff, count: 10, speed: 3.5, size: 0.06, life: 0.28 });
  }

  iceShatter(pos) {
    this.burst(pos, { color: 0xd8f4ff, count: 40, speed: 6, gravity: 12, size: 0.09, life: 0.7 });
  }

  elementBurst(pos, effect) {
    const presets = {
      burn: [0xff8a20, 0xffd23e], freeze: [0x8fe4ff, 0xffffff],
      shock: [0xbfe0ff, 0xffffff], acid: [0xaef23c, 0x4a8f1c],
    };
    const [a, b] = presets[effect] ?? [0xffd75e, 0xffffff];
    this.burst(pos, { color: a, count: 26, speed: 5, size: 0.09, life: 0.45 });
    this.burst(pos, { color: b, count: 12, speed: 2.5, size: 0.06, life: 0.35 });
    this.flash(pos, a, 1.5);
  }

  teleportFlash(pos, color = 0x9fd0ff) {
    this.burst(pos, { color, count: 30, speed: 4, gravity: -2, size: 0.09, life: 0.5, spread: 0.5 });
    this.flash(pos, color, 1.8);
  }

  koBurst(pos) {
    this.burst(pos, { color: 0xffffff, count: 40, speed: 8, size: 0.1, life: 0.6 });
    this.burst(pos, { color: 0xc01414, count: 50, speed: 6, gravity: 12, size: 0.09, life: 0.9, up: 1.2 });
    this.flash(pos, 0xffffff, 2.6);
    this.shockwave(pos, { color: 0xffffff, scale: 2.4, life: 0.5 });
    this.shockwave(pos, { color: 0xff6a20, scale: 1.6, life: 0.42 });
  }

  // expanding camera-facing ring — heavy-hit / KO shockwave
  shockwave(pos, { color = 0xffd090, scale = 1, life = 0.35 } = {}) {
    const geo = new THREE.RingGeometry(0.72, 1.0, 40);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.copy(pos);
    ring.scale.setScalar(0.15 * scale);
    this.scene.add(ring);
    this.rings.push({ ring, geo, mat, life, maxLife: life, scale });
  }

  // short-lived glowing sprite at impact point
  flash(pos, color, scale = 1) {
    const mat = new THREE.SpriteMaterial({
      color, transparent: true, opacity: 0.95, map: softCircleTexture(),
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.setScalar(0.35 * scale);
    this.scene.add(sprite);
    this.flashes.push({ sprite, mat, life: 0.14, maxLife: 0.14, scale });
  }

  shake(amount) { this.shakeAmount = Math.max(this.shakeAmount, amount); }

  update(dt) {
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 2.4);

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.points); b.geo.dispose(); b.mat.dispose();
        this.bursts.splice(i, 1);
        continue;
      }
      const p = b.geo.attributes.position.array;
      for (let k = 0; k < b.count; k++) {
        const v = b.vels[k];
        v.y -= b.gravity * dt;
        p[k * 3] += v.x * dt; p[k * 3 + 1] += v.y * dt; p[k * 3 + 2] += v.z * dt;
        if (p[k * 3 + 1] < 0.02 && b.gravity > 0) { p[k * 3 + 1] = 0.02; v.y *= -0.3; v.x *= 0.7; }
      }
      b.geo.attributes.position.needsUpdate = true;
      b.mat.opacity = Math.min(1, b.life / (b.maxLife * 0.5));
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) { this.scene.remove(r.ring); r.geo.dispose(); r.mat.dispose(); this.rings.splice(i, 1); continue; }
      const k = 1 - r.life / r.maxLife;
      const ease = 1 - (1 - k) * (1 - k); // ease-out expansion
      r.ring.scale.setScalar((0.15 + ease * 1.35) * r.scale);
      r.mat.opacity = 0.85 * (1 - k);
    }

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      if (f.life <= 0) { this.scene.remove(f.sprite); f.mat.dispose(); this.flashes.splice(i, 1); continue; }
      const k = 1 - f.life / f.maxLife;
      f.sprite.scale.setScalar((0.35 + k * 1.1) * f.scale);
      f.mat.opacity = 0.95 * (1 - k);
    }
  }
}

// ---------------------------------------------------------------- projectile
export function makeProjectileVisual(scene, sp) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 14, 12),
    new THREE.MeshBasicMaterial({ color: sp.color2 })
  );
  group.add(core);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 14, 12),
    new THREE.MeshBasicMaterial({ color: sp.color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  group.add(glow);
  const light = new THREE.PointLight(sp.color, 18, 8, 2);
  group.add(light);
  scene.add(group);

  let t = 0;
  return {
    group,
    update(dt) {
      t += dt;
      const pulse = 1 + Math.sin(t * 30) * 0.15;
      glow.scale.setScalar(pulse);
      core.scale.setScalar(1 + Math.sin(t * 42) * 0.1);
      group.rotation.z += dt * 9;
    },
    dispose() {
      scene.remove(group);
      core.geometry.dispose(); core.material.dispose();
      glow.geometry.dispose(); glow.material.dispose();
    },
  };
}
