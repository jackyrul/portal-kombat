// The roster. Each fighter has a palette, a `decorate` hook that dresses the
// base rig with signature details, and two special moves.

function ninjaCowl({ THREE, joints, parts, mats }, hoodMat, maskMat) {
  const headG = parts.headG;
  // mask over the lower face
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.24), maskMat);
  mask.position.set(0.075, -0.06, 0); mask.castShadow = true; headG.add(mask);
  // hood — an open shell around the skull
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.185, 18, 14, Math.PI * 0.62, Math.PI * 1.76), hoodMat);
  hood.rotation.y = Math.PI / 2; hood.castShadow = true; // opening over the face (+X)
  hood.scale.set(1.02, 1.12, 1.0); hood.position.x = -0.015; headG.add(hood);
  // cowl draping to the shoulders
  const cowl = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.24, 12, 1, true), hoodMat);
  cowl.position.set(0, -0.16, 0); cowl.castShadow = true; headG.add(cowl);
  return { mask, hood, cowl };
}

function shinGuards({ THREE, joints }, material) {
  for (const kn of [joints.kneeL, joints.kneeR]) {
    const g = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.14, 3, 8), material);
    g.position.set(0.02, -0.16, 0); g.castShadow = true; kn.add(g);
  }
}

function chestStrap({ THREE, joints }, material) {
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.46), material);
  strap.position.set(0, 0.34, 0); strap.rotation.x = 0.5; strap.castShadow = true;
  joints.spine.add(strap);
}

export const CHARACTERS = [
  {
    id: 'blaze',
    name: 'BLAZE',
    title: 'THE BURNING SPECTRE',
    colors: {
      primary: 0xe0a516, secondary: 0x191922, accent: 0x8a6d1c,
      skin: 0xc9925f, glow: 0xffb020, dark: 0x141310,
    },
    decorate(ctx) {
      const { THREE, joints, mats } = ctx;
      ninjaCowl(ctx, mats.secondary, mats.primary);
      shinGuards(ctx, mats.primary);
      chestStrap(ctx, mats.dark);
      // twin headband tails
      for (const s of [1, -1]) {
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), mats.primary);
        tail.position.set(-0.26, 0.02, s * 0.05); tail.rotation.z = 0.35 * s * 0.3 + 0.3;
        joints.head.add(tail);
      }
    },
    sp1: {
      name: 'BLAZING SPEAR', type: 'projectile', anim: 'special', total: 0.62, spawnT: 0.26,
      dmg: 9, effect: 'burn', color: 0xff7b1c, color2: 0xffd23e, speed: 9.5, hitstun: 0.55, push: 1.5, special: true,
    },
    sp2: {
      name: 'INFERNO RISE', type: 'rise', anim: 'rise', total: 0.7, riseT: 0.18,
      active: [0.16, 0.42], dmg: 12, launch: true, knockdown: true, range: 1.35, push: 1.0, hitstun: 0.6,
    },
    aiStyle: 'rusher',
  },

  {
    id: 'frost',
    name: 'FROST',
    title: 'THE CRYOMANCER',
    colors: {
      primary: 0x2c63d6, secondary: 0x0f1726, accent: 0x9fd8ff,
      skin: 0xb9885c, glow: 0x8fe4ff, dark: 0x101623,
    },
    decorate(ctx) {
      const { THREE, joints, mats } = ctx;
      ninjaCowl(ctx, mats.secondary, mats.primary);
      shinGuards(ctx, mats.primary);
      // icy crystals on the shoulders
      for (const s of [1, -1]) {
        const ice = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 5), mats.accent);
        ice.position.set(0, 0.56, s * 0.3); ice.rotation.x = s * -0.35;
        joints.spine.add(ice);
      }
    },
    sp1: {
      name: 'ICE BALL', type: 'projectile', anim: 'special', total: 0.66, spawnT: 0.28,
      dmg: 6, effect: 'freeze', color: 0x8fe4ff, color2: 0xd8f6ff, speed: 7.2, hitstun: 0.4, push: 0.6, special: true,
    },
    sp2: {
      name: 'GLACIER SLIDE', type: 'slide', anim: 'slide', total: 0.65, moveFrom: 0.14, moveTo: 0.44, speed: 9,
      active: [0.16, 0.46], dmg: 8, knockdown: true, low: true, range: 1.05, push: 1.2, hitstun: 0.5,
    },
    aiStyle: 'zoner',
  },

  {
    id: 'volt',
    name: 'VOLT',
    title: 'GOD OF STORMS',
    colors: {
      primary: 0xe8e4da, secondary: 0x2b3f66, accent: 0x3fa0ff,
      skin: 0xd8a06b, glow: 0x9fd0ff, dark: 0x232b3d,
    },
    decorate(ctx) {
      const { THREE, joints, parts, mats } = ctx;
      // straw hat with a glowing rim
      const strawMat = new THREE.MeshStandardMaterial({ color: 0xb5975e, roughness: 0.8 });
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.17, 18), strawMat);
      hat.position.y = 0.17; hat.castShadow = true; parts.headG.add(hat);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.016, 8, 26), mats.glow);
      rim.rotation.x = Math.PI / 2; rim.position.y = 0.1; parts.headG.add(rim);
      // robe skirt
      const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.42, 12, 1, true), mats.primary);
      skirt.position.y = -0.12; skirt.castShadow = true; joints.hips.add(skirt);
      chestStrap(ctx, mats.accent);
      // vest
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.2), mats.secondary);
      vest.position.set(-0.02, 0.27, 0); vest.castShadow = true; joints.spine.add(vest);
    },
    sp1: {
      name: 'LIGHTNING BOLT', type: 'projectile', anim: 'special', total: 0.55, spawnT: 0.22,
      dmg: 8, effect: 'shock', color: 0x9fd0ff, color2: 0xffffff, speed: 13.5, hitstun: 0.5, push: 1.6, special: true,
    },
    sp2: {
      name: 'STORM WARP', type: 'teleport', anim: 'teleport', total: 0.58, tpT: 0.14,
      active: [0.28, 0.42], dmg: 10, knockdown: true, range: 1.35, push: 1.4, hitstun: 0.55,
    },
    aiStyle: 'tricky',
  },

  {
    id: 'serpent',
    name: 'SERPENT',
    title: 'THE HIDDEN FANG',
    colors: {
      primary: 0x2f8f3a, secondary: 0x142112, accent: 0x74c94a,
      skin: 0x9fae62, glow: 0xaef23c, dark: 0x101a0e,
    },
    decorate(ctx) {
      const { THREE, joints, mats } = ctx;
      ninjaCowl(ctx, mats.secondary, mats.primary);
      shinGuards(ctx, mats.primary);
      chestStrap(ctx, mats.dark);
      // spikes on the forearms
      for (const el of [joints.elL, joints.elR]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), mats.accent);
        spike.position.set(-0.07, -0.1, 0); spike.rotation.z = Math.PI / 2 + 0.3;
        el.add(spike);
      }
    },
    sp1: {
      name: 'ACID SPIT', type: 'projectile', anim: 'special', total: 0.6, spawnT: 0.25,
      dmg: 10, effect: 'acid', color: 0xaef23c, color2: 0x4a8f1c, speed: 8.5, hitstun: 0.55, push: 1.2, special: true,
    },
    sp2: {
      name: 'VIPER SLIDE', type: 'slide', anim: 'slide', total: 0.6, moveFrom: 0.12, moveTo: 0.4, speed: 10.5,
      active: [0.14, 0.42], dmg: 9, knockdown: true, low: true, range: 1.05, push: 1.3, hitstun: 0.5,
    },
    aiStyle: 'rusher',
  },
];

export const byId = (id) => CHARACTERS.find(c => c.id === id);
