// Global tuning constants for movement, combat and staging.

export const STAGE_HALF_WIDTH = 8.2;    // playable area: x in [-w, w]
export const MIN_SEPARATION = 0.72;     // fighters push apart to at least this distance

export const WALK_SPEED = 3.7;
export const BACK_SPEED = 2.9;

// Dash: double-tap forward/back within DASH_TAP_WINDOW.
export const DASH_TAP_WINDOW = 0.25;
export const DASH_TIME = 0.22;
export const DASH_SPEED = 7.5;
export const BACKDASH_SPEED = 6.5;
export const DASH_COOLDOWN = 0.35;

export const INPUT_BUFFER = 0.18;       // attack presses while busy are held this long

// Impact freeze on clean melee hits (seconds of real time).
export const HITSTOP = 0.07;
export const HITSTOP_HEAVY = 0.11;      // attacks with dmg >= 8
export const JUMP_VELOCITY = 8.6;
export const JUMP_DRIFT = 3.4;
export const GRAVITY = 22;

export const MAX_HP = 100;
export const ROUND_TIME = 99;
export const ROUNDS_TO_WIN = 2;

export const COMBO_DAMAGE_SCALE = [1, 1, 0.85, 0.7, 0.6, 0.5]; // by hit index in combo
export const CHIP_RATIO = 0.12;         // chip damage for specials on block

export const FREEZE_DURATION = 2.2;
export const KNOCKDOWN_TIME = 0.95;
export const GETUP_INVULN = 0.55;

// Base attack set shared by all fighters. `active` is [start, end] seconds of
// the hit window within the move, `total` is full move duration.
export const ATTACKS = {
  lp: { anim: 'lightPunch', dmg: 5,  range: 1.35, active: [0.07, 0.17], total: 0.26, hitstun: 0.32, blockstun: 0.18, push: 0.35, shove: 0.18, high: true },
  hp: { anim: 'heavyPunch', dmg: 9,  range: 1.45, active: [0.16, 0.30], total: 0.55, hitstun: 0.46, blockstun: 0.26, push: 0.95, shove: 0.30, high: true },
  lk: { anim: 'lightKick',  dmg: 6,  range: 1.62, active: [0.10, 0.22], total: 0.34, hitstun: 0.34, blockstun: 0.20, push: 0.45, shove: 0.20 },
  hk: { anim: 'heavyKick',  dmg: 11, range: 1.75, active: [0.20, 0.36], total: 0.62, hitstun: 0.5,  blockstun: 0.3,  push: 1.4,  shove: 0.4, knockdown: true },
  uppercut: { anim: 'uppercut', dmg: 14, range: 1.2, active: [0.14, 0.28], total: 0.6, hitstun: 0.6, blockstun: 0.3, push: 0.8, shove: 0.3, launch: true, knockdown: true },
  sweep: { anim: 'sweep', dmg: 8, range: 1.7, active: [0.16, 0.3], total: 0.58, hitstun: 0.5, blockstun: 0.28, push: 0.6, shove: 0.25, low: true, knockdown: true },
  jumpKick: { anim: 'jumpKick', dmg: 8, range: 1.5, active: [0.06, 0.5], total: 0.6, hitstun: 0.42, blockstun: 0.24, push: 0.9, shove: 0.3, high: true },
};

export const PROJECTILE_SPEED = 9.5;
export const PROJECTILE_DMG = 9;
