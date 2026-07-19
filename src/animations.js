// Code-driven keyframe animation. A pose is a flat set of joint channels;
// clips are lists of timed full poses, sampled with smoothstep easing.
//
// Rig conventions (rig is built facing +X):
//   shoulder/hip rz > 0  → limb swings forward (+X)
//   elbow rz > 0         → forearm curls forward/up
//   knee rz < 0          → natural knee bend
//   spine/hips rz > 0    → lean back, < 0 → lean forward
//   hips[0]              → vertical offset of the pelvis from its rest height

export const POSE_SCHEMA = {
  hips: 4,   // [yOffset, rx, ry, rz]
  spine: 3, head: 3,
  shL: 3, shR: 3,
  hipL: 3, hipR: 3,
  elL: 1, elR: 1, kneeL: 1, kneeR: 1, footL: 1, footR: 1,
};

function zeroPose() {
  const p = {};
  for (const [k, n] of Object.entries(POSE_SCHEMA)) p[k] = n === 1 ? 0 : new Array(n).fill(0);
  return p;
}

export function clonePose(src) {
  const p = {};
  for (const k of Object.keys(POSE_SCHEMA)) p[k] = Array.isArray(src[k]) ? src[k].slice() : src[k];
  return p;
}

function merge(base, over) {
  const p = clonePose(base);
  if (!over) return p;
  for (const [k, v] of Object.entries(over)) p[k] = Array.isArray(v) ? v.slice() : v;
  return p;
}

export function lerpPose(a, b, t, out) {
  for (const [k, n] of Object.entries(POSE_SCHEMA)) {
    if (n === 1) out[k] = a[k] + (b[k] - a[k]) * t;
    else for (let i = 0; i < n; i++) out[k][i] = a[k][i] + (b[k][i] - a[k][i]) * t;
  }
  return out;
}

const smooth = (t) => t * t * (3 - 2 * t);

// ---------------------------------------------------------------- base stance
export const STANCE = merge(zeroPose(), {
  hips: [-0.08, 0, -0.38, -0.06],
  spine: [0, 0.12, -0.14],
  head: [0, 0.2, 0.06],
  shL: [-0.15, 0, 0.75], elL: 1.95,   // lead arm, fist up
  shR: [0.3, 0, 0.5],  elR: 2.15,     // rear arm guards chin
  hipL: [0, 0, 0.42], kneeL: -0.62, footL: 0.2,
  hipR: [0, 0, -0.3], kneeR: -0.45, footR: 0.45,
});

const S = (over) => merge(STANCE, over);

// ---------------------------------------------------------------- clip helper
export class Clip {
  constructor(dur, loop, keyDefs) {
    this.dur = dur;
    this.loop = loop;
    this.keys = keyDefs.map(k => ({ t: k.t, pose: k.pose }));
    this._out = zeroPose();
  }
  sample(time) {
    let t = time;
    if (this.loop) { t = time % this.dur; if (t < 0) t += this.dur; }
    else t = Math.max(0, Math.min(this.dur, t));
    const keys = this.keys;
    if (t <= keys[0].t) return keys[0].pose;
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t >= a.t && t <= b.t) {
        const f = smooth((t - a.t) / Math.max(1e-5, b.t - a.t));
        return lerpPose(a.pose, b.pose, f, this._out);
      }
    }
    return keys[keys.length - 1].pose;
  }
}

const C = (dur, loop, defs) => new Clip(dur, loop, defs.map(d => ({ t: d.t, pose: S(d.p) })));

// ---------------------------------------------------------------- clips
export const CLIPS = {

  idle: C(1.7, true, [
    { t: 0.0,  p: {} },
    { t: 0.85, p: { hips: [-0.13, 0, -0.38, -0.06], shL: [-0.15, 0, 0.68], elL: 2.05, shR: [0.3, 0, 0.44], elR: 2.25, spine: [0, 0.12, -0.18], kneeL: -0.72, kneeR: -0.55 } },
    { t: 1.7,  p: {} },
  ]),

  walk: C(0.7, true, [
    { t: 0.0,   p: { hips: [-0.1, 0, -0.3, -0.04], hipL: [0, 0, 0.7], kneeL: -0.35, hipR: [0, 0, -0.5], kneeR: -0.7, footL: -0.1, footR: 0.7 } },
    { t: 0.175, p: { hips: [-0.05, 0, -0.3, -0.04], hipL: [0, 0, 0.15], kneeL: -0.4, hipR: [0, 0, 0.1], kneeR: -0.9, footR: 0.5 } },
    { t: 0.35,  p: { hips: [-0.1, 0, -0.3, -0.04], hipL: [0, 0, -0.5], kneeL: -0.7, hipR: [0, 0, 0.7], kneeR: -0.35, footL: 0.7, footR: -0.1 } },
    { t: 0.525, p: { hips: [-0.05, 0, -0.3, -0.04], hipL: [0, 0, 0.1], kneeL: -0.9, hipR: [0, 0, 0.15], kneeR: -0.4, footL: 0.5 } },
    { t: 0.7,   p: { hips: [-0.1, 0, -0.3, -0.04], hipL: [0, 0, 0.7], kneeL: -0.35, hipR: [0, 0, -0.5], kneeR: -0.7, footL: -0.1, footR: 0.7 } },
  ]),

  jump: C(0.9, false, [
    { t: 0.0, p: { hips: [-0.3, 0, -0.38, -0.1], kneeL: -1.4, kneeR: -1.2, hipL: [0, 0, 0.8], hipR: [0, 0, 0.5] } },
    { t: 0.2, p: { hips: [0, 0, -0.38, 0.08], hipL: [0, 0, 0.9], kneeL: -1.5, hipR: [0, 0, 0.5], kneeR: -1.3, shL: [-0.3, 0, 0.3], shR: [0.4, 0, 0.1], elL: 1.2, elR: 1.4 } },
    { t: 0.9, p: { hips: [0, 0, -0.38, 0.05], hipL: [0, 0, 0.6], kneeL: -1.1, hipR: [0, 0, 0.3], kneeR: -0.9 } },
  ]),

  crouch: C(0.14, false, [
    { t: 0.0,  p: {} },
    { t: 0.14, p: { hips: [-0.52, 0, -0.38, -0.15], spine: [0, 0.12, -0.3], kneeL: -1.9, kneeR: -1.75, hipL: [0, 0, 1.15], hipR: [0, 0, 0.75], footL: 0.75, footR: 1.0, shL: [-0.15, 0, 0.6], elL: 2.1, shR: [0.3, 0, 0.45], elR: 2.2 } },
  ]),

  block: C(0.1, false, [
    { t: 0.0, p: {} },
    { t: 0.1, p: { spine: [0, 0.05, -0.2], shL: [-0.1, 0, 1.15], elL: 2.3, shR: [0.2, 0, 0.95], elR: 2.4, head: [0, 0.15, -0.1] } },
  ]),

  blockCrouch: C(0.1, false, [
    { t: 0.0, p: {} },
    { t: 0.1, p: { hips: [-0.5, 0, -0.38, -0.15], spine: [0, 0.1, -0.32], kneeL: -1.85, kneeR: -1.7, hipL: [0, 0, 1.1], hipR: [0, 0, 0.72], footL: 0.75, footR: 1.0, shL: [-0.1, 0, 1.05], elL: 2.35, shR: [0.2, 0, 0.9], elR: 2.4 } },
  ]),

  lightPunch: C(0.3, false, [
    { t: 0.0,  p: {} },
    { t: 0.06, p: { shL: [-0.1, 0, 0.5], elL: 2.4, spine: [0, 0.25, -0.1] } },
    { t: 0.13, p: { shL: [0, 0, 1.5], elL: 0.1, spine: [0, -0.35, -0.2], hips: [-0.08, 0, -0.55, -0.06] } },
    { t: 0.3,  p: {} },
  ]),

  heavyPunch: C(0.55, false, [
    { t: 0.0,  p: {} },
    { t: 0.12, p: { shR: [0.3, 0, -0.5], elR: 2.5, spine: [0, 0.55, -0.05], hips: [-0.12, 0, -0.15, -0.02] } },
    { t: 0.24, p: { shR: [0, 0, 1.55], elR: 0.05, spine: [0, -0.55, -0.3], hips: [-0.1, 0, -0.75, -0.1], head: [0, 0.5, 0], hipL: [0, 0, 0.55], kneeL: -0.75 } },
    { t: 0.38, p: { shR: [0, 0, 1.4], elR: 0.3, spine: [0, -0.4, -0.25] } },
    { t: 0.55, p: {} },
  ]),

  lightKick: C(0.38, false, [
    { t: 0.0,  p: {} },
    { t: 0.1,  p: { hipL: [0, 0, 1.3], kneeL: -1.7, hips: [-0.06, 0, -0.38, 0.12], spine: [0, 0.12, 0.05] } },
    { t: 0.2,  p: { hipL: [0, 0, 1.5], kneeL: -0.05, footL: 0.5, hips: [-0.02, 0, -0.38, 0.18], spine: [0, 0.12, 0.14], shL: [-0.2, 0, 0.2], elL: 1.6 } },
    { t: 0.38, p: {} },
  ]),

  heavyKick: C(0.62, false, [
    { t: 0.0,  p: {} },
    { t: 0.14, p: { hips: [-0.18, 0, -0.15, 0.05], hipR: [0, 0, 0.4], kneeR: -1.6, spine: [0, 0.5, 0], shR: [0.3, 0, 1.0], elR: 1.5 } },
    { t: 0.28, p: { hips: [-0.02, 0, -0.85, 0.2], hipR: [0, -0.3, 1.75], kneeR: -0.05, footR: 0.4, spine: [0, -0.5, 0.15], head: [0, 0.55, 0], shR: [0.4, 0, -0.4], elR: 0.8, shL: [-0.3, 0, 1.2], elL: 1.2, hipL: [0, 0, 0.15], kneeL: -0.5 } },
    { t: 0.44, p: { hips: [-0.1, 0, -0.5, 0.1], hipR: [0, 0, 0.7], kneeR: -1.1, spine: [0, 0, 0] } },
    { t: 0.62, p: {} },
  ]),

  uppercut: C(0.6, false, [
    { t: 0.0,  p: {} },
    { t: 0.09, p: { hips: [-0.5, 0, -0.38, -0.2], kneeL: -1.9, kneeR: -1.7, hipL: [0, 0, 1.1], hipR: [0, 0, 0.7], footL: 0.8, footR: 1.0, shR: [0.3, 0, -0.9], elR: 2.6, spine: [0, 0.35, -0.4] } },
    { t: 0.2,  p: { hips: [0.12, 0, -0.55, 0.2], shR: [0.1, 0, 2.9], elR: 0.15, spine: [0, -0.3, 0.25], head: [0, 0.35, 0.15], hipL: [0, 0, 0.35], kneeL: -0.4, hipR: [0, 0, -0.3], kneeR: -0.8, footR: 0.9 } },
    { t: 0.34, p: { hips: [0.02, 0, -0.5, 0.1], shR: [0.1, 0, 2.5], elR: 0.4 } },
    { t: 0.6,  p: {} },
  ]),

  sweep: C(0.58, false, [
    { t: 0.0,  p: {} },
    { t: 0.1,  p: { hips: [-0.55, 0, -0.38, -0.25], kneeL: -2.0, kneeR: -1.8, hipL: [0, 0, 1.2], hipR: [0, 0, 0.8], spine: [0, 0.2, -0.35] } },
    { t: 0.24, p: { hips: [-0.6, 0, 0.5, -0.3], hipR: [0, 0, 1.4], kneeR: -0.1, footR: 0.3, hipL: [0, 0, 1.3], kneeL: -2.1, spine: [0, -0.2, -0.3], shL: [-0.4, 0, 0.3], shR: [0.5, 0, 0.6] } },
    { t: 0.4,  p: { hips: [-0.55, 0, -0.2, -0.25], hipR: [0, 0, 0.9], kneeR: -1.5, kneeL: -2.0 } },
    { t: 0.58, p: {} },
  ]),

  jumpKick: C(0.6, false, [
    { t: 0.0,  p: { hips: [0, 0, -0.38, 0.05], hipL: [0, 0, 0.6], kneeL: -1.1, hipR: [0, 0, 0.3], kneeR: -0.9 } },
    { t: 0.1,  p: { hips: [0, 0, -0.45, 0.25], hipL: [0, 0, 1.5], kneeL: -0.1, footL: 0.4, hipR: [0, 0, -0.2], kneeR: -1.6, spine: [0, 0.1, 0.1], shL: [-0.3, 0, 0.4], elL: 1.3, shR: [0.4, 0, 0.6], elR: 1.6 } },
    { t: 0.6,  p: { hips: [0, 0, -0.4, 0.1], hipL: [0, 0, 0.9], kneeL: -0.6, hipR: [0, 0, 0.1], kneeR: -1.2 } },
  ]),

  // projectile throw — both palms thrust forward
  special: C(0.62, false, [
    { t: 0.0,  p: {} },
    { t: 0.12, p: { spine: [0, 0.45, 0.1], shL: [-0.2, 0, -0.6], elL: 1.8, shR: [0.3, 0, -0.7], elR: 1.9, hips: [-0.14, 0, -0.2, -0.05] } },
    { t: 0.26, p: { spine: [0, -0.15, -0.25], shL: [-0.05, 0, 1.45], elL: 0.2, shR: [0.1, 0, 1.5], elR: 0.15, hips: [-0.1, 0, -0.5, -0.1], hipL: [0, 0, 0.6], kneeL: -0.8 } },
    { t: 0.45, p: { spine: [0, -0.15, -0.2], shL: [-0.05, 0, 1.35], elL: 0.35, shR: [0.1, 0, 1.4], elR: 0.3 } },
    { t: 0.62, p: {} },
  ]),

  // rising fiery uppercut / dragon punch
  rise: C(0.7, false, [
    { t: 0.0,  p: {} },
    { t: 0.1,  p: { hips: [-0.45, 0, -0.38, -0.2], kneeL: -1.8, kneeR: -1.6, hipL: [0, 0, 1.0], hipR: [0, 0, 0.65], shR: [0.3, 0, -1.0], elR: 2.7, spine: [0, 0.4, -0.4] } },
    { t: 0.25, p: { hips: [0.25, 0, -0.5, 0.3], shR: [0.1, 0, 3.0], elR: 0.1, spine: [0, -0.2, 0.3], hipL: [0, 0, 0.9], kneeL: -1.4, hipR: [0, 0, -0.4], kneeR: -0.9 } },
    { t: 0.45, p: { hips: [0.1, 0, -0.5, 0.15], shR: [0.1, 0, 2.6], elR: 0.3 } },
    { t: 0.7,  p: {} },
  ]),

  // slide kick along the ground
  slide: C(0.65, false, [
    { t: 0.0,  p: {} },
    { t: 0.1,  p: { hips: [-0.5, 0, -0.38, -0.3], kneeL: -1.9, kneeR: -1.7, hipL: [0, 0, 1.15], hipR: [0, 0, 0.75], spine: [0, 0.2, -0.3] } },
    { t: 0.22, p: { hips: [-0.62, 0, -0.3, 0.5], hipL: [0, 0, 1.2], kneeL: -0.05, footL: 0.3, hipR: [0, 0, 0.3], kneeR: -1.9, spine: [0, 0.15, 0.35], shL: [-0.4, 0, 0.1], elL: 0.8, shR: [0.5, 0, -0.7], elR: 0.5, head: [0, 0.2, 0.2] } },
    { t: 0.45, p: { hips: [-0.55, 0, -0.3, 0.3], hipL: [0, 0, 1.1], kneeL: -0.3 } },
    { t: 0.65, p: {} },
  ]),

  // teleport strike wind-up / arrival flash pose
  teleport: C(0.55, false, [
    { t: 0.0,  p: {} },
    { t: 0.1,  p: { spine: [0, 0.1, 0.3], shL: [-0.6, 0, 1.9], elL: 2.4, shR: [0.7, 0, 1.9], elR: 2.4, hips: [-0.2, 0, -0.38, 0.1], head: [0, 0.2, 0.25] } },
    { t: 0.3,  p: { spine: [0, -0.3, -0.2], shR: [0.1, 0, 1.5], elR: 0.2, shL: [-0.1, 0, 0.6], elL: 1.8, hips: [-0.08, 0, -0.55, -0.06] } },
    { t: 0.55, p: {} },
  ]),

  hit: C(0.32, false, [
    { t: 0.0,  p: {} },
    { t: 0.07, p: { head: [0, 0.2, 0.55], spine: [0, 0.2, 0.3], hips: [-0.12, 0, -0.38, 0.08], shL: [-0.3, 0, 0.4], elL: 1.5, shR: [0.4, 0, 0.2], elR: 1.6 } },
    { t: 0.32, p: {} },
  ]),

  hitCrouch: C(0.32, false, [
    { t: 0.0,  p: { hips: [-0.52, 0, -0.38, -0.15], kneeL: -1.9, kneeR: -1.75, hipL: [0, 0, 1.15], hipR: [0, 0, 0.75] } },
    { t: 0.07, p: { hips: [-0.5, 0, -0.38, 0.0], kneeL: -1.8, kneeR: -1.7, hipL: [0, 0, 1.1], hipR: [0, 0, 0.72], head: [0, 0.2, 0.5], spine: [0, 0.2, 0.25] } },
    { t: 0.32, p: { hips: [-0.52, 0, -0.38, -0.15], kneeL: -1.9, kneeR: -1.75, hipL: [0, 0, 1.15], hipR: [0, 0, 0.75] } },
  ]),

  knockdown: C(0.55, false, [
    { t: 0.0,  p: { head: [0, 0, 0.5], spine: [0, 0, 0.35], hips: [-0.05, 0, -0.2, 0.25] } },
    { t: 0.3,  p: { hips: [-0.35, 0, 0, 0.9], spine: [0, 0, 0.3], head: [0, 0, 0.4], shL: [-0.7, 0, 0.4], shR: [0.8, 0, 0.4], elL: 0.5, elR: 0.5, hipL: [0, 0, 0.5], kneeL: -0.4, hipR: [0, 0, 0.3], kneeR: -0.3 } },
    { t: 0.55, p: { hips: [-0.72, 0, 0, 1.5], spine: [0, 0, 0.1], head: [0, 0, 0.15], shL: [-1.0, 0, 0.25], shR: [1.1, 0, 0.25], elL: 0.2, elR: 0.2, hipL: [0, 0, 0.25], kneeL: -0.25, hipR: [0, 0, 0.12], kneeR: -0.15, footL: 0.4, footR: 0.4 } },
  ]),

  getup: C(0.45, false, [
    { t: 0.0,  p: { hips: [-0.72, 0, 0, 1.5], spine: [0, 0, 0.1], head: [0, 0, 0.15], shL: [-1.0, 0, 0.25], shR: [1.1, 0, 0.25], elL: 0.2, elR: 0.2, hipL: [0, 0, 0.25], kneeL: -0.25, hipR: [0, 0, 0.12], kneeR: -0.15 } },
    { t: 0.25, p: { hips: [-0.5, 0, -0.2, 0.4], kneeL: -1.6, kneeR: -1.4, hipL: [0, 0, 1.0], hipR: [0, 0, 0.6], spine: [0, 0.1, -0.2] } },
    { t: 0.45, p: {} },
  ]),

  win: C(1.6, false, [
    { t: 0.0,  p: {} },
    { t: 0.35, p: { hips: [-0.3, 0, -0.1, -0.1], kneeL: -1.2, kneeR: -1.1, hipL: [0, 0, 0.7], hipR: [0, 0, 0.5], shL: [-0.3, 0, -0.4], shR: [0.4, 0, -0.4], elL: 0.6, elR: 0.6, spine: [0, 0, -0.15] } },
    { t: 0.7,  p: { hips: [0.05, 0, -0.1, 0.05], shL: [-2.6, 0, 0.4], shR: [2.7, 0, 0.4], elL: 0.15, elR: 0.15, head: [0, 0, 0.3], spine: [0, 0, 0.12], hipL: [0, 0, 0.2], kneeL: -0.3, hipR: [0, 0, -0.1], kneeR: -0.2 } },
    { t: 1.6,  p: { hips: [0.0, 0, -0.1, 0.03], shL: [-2.5, 0, 0.35], shR: [2.6, 0, 0.35], elL: 0.2, elR: 0.2, head: [0, 0, 0.25], spine: [0, 0, 0.1] } },
  ]),

  // frontal portrait stance for the character-select renders
  portrait: C(1, false, [
    { t: 0, p: { hips: [-0.04, 0, -1.25, 0], spine: [0, 0.2, -0.05], head: [0, 0.12, 0.02], shL: [-0.35, 0, 0.55], elL: 2.0, shR: [0.45, 0, 0.35], elR: 2.1, hipL: [0, 0, 0.3], kneeL: -0.4, hipR: [0, 0, -0.2], kneeR: -0.3 } },
  ]),
};
