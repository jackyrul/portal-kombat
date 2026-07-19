# PORTAL KOMBAT 🐉

A Mortal Kombat / Street Fighter–style 3D fighting game that runs in the
browser. Built with [Three.js](https://threejs.org/) — no build step, no
external assets: the fighters, the arena, the sound effects and the music are
all generated in code.

![genre](https://img.shields.io/badge/genre-fighting-red)
![engine](https://img.shields.io/badge/engine-three.js%20r160-blue)
![build](https://img.shields.io/badge/build-none%20needed-green)

## Play

Any static file server works:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open http://localhost:8000. On weak GPUs add `?q=low` to the URL to
disable bloom and shadows.

## Features

- **4 fighters**, each with a signature look and special moves:
  - **BLAZE** — burning spectre. Blazing Spear projectile, Inferno Rise uppercut.
  - **FROST** — cryomancer. Ice Ball that *freezes* the opponent, Glacier Slide.
  - **VOLT** — god of storms. Fast Lightning Bolt, Storm Warp teleport strike.
  - **SERPENT** — hidden fang. Acid Spit, Viper Slide.
- **The Bone Pit arena**: animated lava shader, torch-lit pillars with glowing
  skulls, drifting embers, fog, moonlight and bloom post-processing.
- **Real fighting-game combat**: light/heavy punches and kicks, MK-style
  uppercut, sweep, jump kicks, hold-back blocking (high/low), chip damage,
  hitstun and blockstun, knockdowns, juggles, combo counter with damage
  scaling, projectiles, slides and teleports.
- **Match flow**: best-of-3 rounds, 99-second timer, KO slow-motion camera,
  "FLAWLESS VICTORY", win pips, rematch.
- **1 player vs CPU** (three difficulty levels) or **2 players** on one keyboard.
- **Procedural audio**: punches, whooshes, gongs, per-element special sounds
  and an ominous music loop — synthesized live with WebAudio.

## Controls

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Walk | A / D | ← / → |
| Jump | W | ↑ |
| Crouch | S | ↓ |
| Block | hold *back* | hold *back* |
| Light / Heavy Punch | U / I | Num 1 / Num 2 |
| Light / Heavy Kick | J / K | Num 4 / Num 5 |
| Uppercut | S + I | ↓ + Num 2 |
| Sweep | S + K | ↓ + Num 5 |
| Special I / II | O / L | Num 3 / Num 6 |

Tips: crouch-block low slides and sweeps, stand-block jump kicks. The uppercut
launches — juggle for combo damage. Frost's Ice Ball freezes the enemy solid:
walk up and land a free uppercut.

## Tech notes

- `src/fighter.js` — procedural humanoid rig built from capsules/boxes, driven
  by a keyframe-pose animation system (`src/animations.js`) and a combat state
  machine (idle/walk/jump/attack/hitstun/launched/knockdown/frozen/ko…).
- `src/game.js` — the fight director: hit detection, projectiles, combos,
  round flow, dynamic camera with shake and KO push-in.
- `src/stage.js` — the arena, including a custom GLSL lava shader.
- `src/ai.js` — the CPU opponent (spacing, blocking, projectile reactions).
- `src/audio.js` — WebAudio synthesis for every sound in the game.
- `vendor/three/` — vendored Three.js r160 + bloom post-processing, loaded via
  an import map. No bundler, no npm install required to play.
