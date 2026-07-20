import * as THREE from 'three';
import { softCircleTexture } from './fx.js';

// ---------------------------------------------------------------- textures
function stoneTexture(base = '#3b3430', dark = '#241f1c') {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = Math.random();
    g.fillStyle = `rgba(${v > 0.5 ? 90 : 20},${v > 0.5 ? 80 : 16},${v > 0.5 ? 70 : 14},${0.12 + Math.random() * 0.2})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  // tile cracks
  g.strokeStyle = dark; g.lineWidth = 3;
  for (let x = 0; x <= 512; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() * 20 - 10), 512); g.stroke(); }
  for (let y = 0; y <= 512; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y + (Math.random() * 20 - 10)); g.stroke(); }
  g.strokeStyle = 'rgba(10,6,4,0.8)'; g.lineWidth = 1.5;
  for (let i = 0; i < 25; i++) {
    g.beginPath();
    let x = Math.random() * 512, y = Math.random() * 512;
    g.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += Math.random() * 60 - 30; y += Math.random() * 60 - 30; g.lineTo(x, y); }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------- lava
const LAVA_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LAVA_FRAG = /* glsl */`
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv * vec2(9.0, 6.0);
    float t = uTime * 0.14;
    float n = fbm(uv + vec2(t, -t * 0.6) + fbm(uv * 1.6 - t));
    // crust vs molten channels
    float channels = smoothstep(0.42, 0.62, n);
    vec3 crust = vec3(0.09, 0.02, 0.01);
    vec3 molten = mix(vec3(0.9, 0.16, 0.0), vec3(1.0, 0.75, 0.12), smoothstep(0.55, 0.85, n));
    vec3 col = mix(molten * 1.6, crust, channels);
    // slow pulsing
    col *= 0.85 + 0.15 * sin(uTime * 0.8 + n * 9.0);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ---------------------------------------------------------------- stage
export function createStage(scene) {
  scene.fog = new THREE.FogExp2(0x0d0405, 0.028);

  // --- sky dome
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: false, depthWrite: false,
    uniforms: {},
    vertexShader: /* glsl */`
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 top = vec3(0.05, 0.02, 0.10);
        vec3 mid = vec3(0.10, 0.03, 0.06);
        vec3 bot = vec3(0.30, 0.07, 0.02);
        vec3 col = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.7, h))
                            : mix(bot, mid, smoothstep(-0.25, 0.12, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 16), skyMat);
  scene.add(sky);

  // moon
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(5.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xf5ead0, fog: false })
  );
  moon.position.set(-26, 26, -70); moon.lookAt(0, 2, 0);
  scene.add(moon);
  const moonHalo = new THREE.Mesh(
    new THREE.CircleGeometry(8.5, 32),
    new THREE.MeshBasicMaterial({ color: 0x8a7a55, transparent: true, opacity: 0.22, fog: false })
  );
  moonHalo.position.copy(moon.position).add(new THREE.Vector3(0, 0, -0.5)); moonHalo.lookAt(0, 2, 0);
  scene.add(moonHalo);

  // stars
  {
    const n = 320, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.7 + 0.15);
      const r = 85;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfd6ff, size: 0.35, fog: false })));
  }

  // --- lava lake
  const lavaMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: LAVA_VERT, fragmentShader: LAVA_FRAG, fog: false,
  });
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), lavaMat);
  lava.rotation.x = -Math.PI / 2; lava.position.y = -2.4;
  scene.add(lava);

  // --- fighting platform
  const stone = stoneTexture();
  stone.repeat.set(3, 1.2);
  const platMat = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.9, metalness: 0.05 });
  const platform = new THREE.Mesh(new THREE.BoxGeometry(19.5, 1.4, 7.6), platMat);
  platform.position.y = -0.7; platform.receiveShadow = true;
  scene.add(platform);

  // stone rim
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x231c18, roughness: 0.95 });
  for (const s of [1, -1]) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(19.9, 0.32, 0.5), rimMat);
    rim.position.set(0, -0.1, s * 3.9); rim.castShadow = true; rim.receiveShadow = true;
    scene.add(rim);
  }

  // support columns under the platform, lit by lava
  for (const x of [-8, -3, 3, 8]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 2.2, 8), rimMat);
    col.position.set(x, -2.1, 0);
    scene.add(col);
  }

  // --- pillars with torches
  const pillarMat = new THREE.MeshStandardMaterial({ map: stoneTexture('#332b26', '#1d1713'), roughness: 0.9 });
  const torches = [];
  const pillarDefs = [
    { x: -11.5, z: -3.5 }, { x: 11.5, z: -3.5 },
    { x: -7, z: -7.5 }, { x: 7, z: -7.5 },
  ];
  for (const p of pillarDefs) {
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 7.5, 10), pillarMat);
    pil.position.set(p.x, 1.5, p.z); pil.castShadow = true;
    scene.add(pil);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 1.5), rimMat);
    cap.position.set(p.x, 5.35, p.z); cap.castShadow = true; scene.add(cap);

    // skull on the cap
    const skullMat = new THREE.MeshStandardMaterial({ color: 0xb8a98c, roughness: 0.85 });
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), skullMat);
    skull.scale.set(0.9, 1, 0.85); skull.position.set(p.x, 5.8, p.z);
    scene.add(skull);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.3), skullMat);
    jaw.position.set(p.x, 5.55, p.z + 0.08); scene.add(jaw);
    for (const s of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff5a00, emissiveIntensity: 3 }));
      eye.position.set(p.x + s * 0.11, 5.85, p.z + 0.26);
      scene.add(eye);
    }

    // torch flame
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.75, 8),
      new THREE.MeshStandardMaterial({ color: 0xffa020, emissive: 0xff7a10, emissiveIntensity: 3.4, transparent: true, opacity: 0.92 })
    );
    flame.position.set(p.x, 6.55, p.z);
    scene.add(flame);
    const light = new THREE.PointLight(0xff8a2a, 26, 16, 2);
    light.position.set(p.x, 6.4, p.z);
    scene.add(light);
    torches.push({ flame, light, seed: Math.random() * 10 });
  }

  // --- background rocks
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x201914, roughness: 1 });
  for (let i = 0; i < 14; i++) {
    const s = 1.5 + Math.random() * 3.5;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    const ang = (i / 14) * Math.PI * 2;
    const rr = 24 + Math.random() * 14;
    rock.position.set(Math.cos(ang) * rr, -1.5 + Math.random() * 1.6, Math.sin(ang) * rr * 0.7 - 6);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    scene.add(rock);
  }

  // --- bone piles near the platform edges
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xcbbc9c, roughness: 0.85 });
  for (let i = 0; i < 10; i++) {
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.4 + Math.random() * 0.3, 3, 6), boneMat);
    b.position.set((Math.random() - 0.5) * 17, 0.05, 3.2 + Math.random() * 0.5);
    b.rotation.set(Math.PI / 2 + (Math.random() - 0.5), 0, Math.random() * Math.PI);
    b.castShadow = true;
    scene.add(b);
  }

  // --- impaled-skull spikes framing the far corners (kept off-center so they
  // don't clutter fight readability)
  const spearMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 1 });
  const spearSkullMat = new THREE.MeshStandardMaterial({ color: 0x8a7960, roughness: 0.9 });
  const spearDefs = [
    { x: -14.5, z: -10.5, h: 5.4, lean: 0.16 }, { x: -11, z: -12.5, h: 6.2, lean: -0.1 },
    { x: 11.5, z: -12.5, h: 5.8, lean: 0.12 }, { x: 14.5, z: -10.5, h: 4.9, lean: -0.2 },
  ];
  for (const s of spearDefs) {
    const spike = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.3, s.h, 7), spearMat);
    shaft.position.y = s.h / 2;
    spike.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.7, 7), spearMat);
    tip.position.y = s.h + 0.35;
    spike.add(tip);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 10), spearSkullMat);
    skull.scale.set(0.9, 1.05, 0.85);
    skull.position.y = s.h - 0.45;
    spike.add(skull);
    spike.position.set(s.x, -1.6, s.z);
    spike.rotation.z = s.lean;
    scene.add(spike);
  }

  // --- emissive lava-glow strips along the platform's long edges
  const edgeGlowMat = new THREE.MeshStandardMaterial({
    color: 0x2a0a02, emissive: 0xff5a14, emissiveIntensity: 1.7, roughness: 1,
  });
  for (const s of [1, -1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(19.9, 0.09, 0.1), edgeGlowMat);
    strip.position.set(0, -0.32, s * 4.1);
    scene.add(strip);
  }

  // --- occasional lava bubble pops (single Points cloud, per-point lifecycle)
  const BUBBLE_ZONES = [
    () => [(Math.random() - 0.5) * 26, 4.8 + Math.random() * 2.5],   // in front of platform
    () => [(Math.random() - 0.5) * 30, -5 - Math.random() * 7],      // behind
    () => [(11 + Math.random() * 6) * (Math.random() < 0.5 ? 1 : -1), (Math.random() - 0.5) * 8], // sides
  ];
  const bubbleCount = 26;
  const bubblePos = new Float32Array(bubbleCount * 3);
  const bubbles = [];
  for (let i = 0; i < bubbleCount; i++) {
    bubblePos[i * 3 + 1] = -30; // parked out of sight until spawned
    bubbles.push({ delay: Math.random() * 3, life: 0, vy: 0, x: 0, z: 0 });
  }
  const bubbleGeo = new THREE.BufferGeometry();
  bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3));
  const bubblePoints = new THREE.Points(bubbleGeo, new THREE.PointsMaterial({
    color: 0xff8a26, size: 0.17, transparent: true, opacity: 0.9, map: softCircleTexture(),
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(bubblePoints);

  // --- slow dark cloud drift near the moon
  const cloudMat = new THREE.SpriteMaterial({
    map: softCircleTexture(), color: 0x0a0509, transparent: true, opacity: 0.55,
    depthWrite: false, fog: false,
  });
  const clouds = [];
  for (const c of [{ x: -20, y: 27.5, s: 24 }, { x: -32, y: 24, s: 30 }]) {
    const spr = new THREE.Sprite(cloudMat);
    spr.position.set(c.x, c.y, -66);
    spr.scale.set(c.s, c.s * 0.3, 1);
    scene.add(spr);
    clouds.push({ spr, baseX: c.x, ph: Math.random() * 6.28 });
  }

  // --- drifting embers
  const emberCount = 260;
  const emberPos = new Float32Array(emberCount * 3);
  const emberVel = [];
  for (let i = 0; i < emberCount; i++) {
    emberPos[i * 3] = (Math.random() - 0.5) * 34;
    emberPos[i * 3 + 1] = Math.random() * 12 - 2;
    emberPos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    emberVel.push({ y: 0.4 + Math.random() * 0.9, x: (Math.random() - 0.5) * 0.4, ph: Math.random() * 6.28 });
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({
    color: 0xffa540, size: 0.09, transparent: true, opacity: 0.85, map: softCircleTexture(),
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(embers);

  // --- lighting
  scene.add(new THREE.AmbientLight(0x33202a, 0.9));
  const hemi = new THREE.HemisphereLight(0x2a2340, 0x51190a, 0.85);
  scene.add(hemi);

  const moonLight = new THREE.DirectionalLight(0xb8ccff, 1.35);
  moonLight.position.set(-8, 14, 10);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.camera.left = -14; moonLight.shadow.camera.right = 14;
  moonLight.shadow.camera.top = 14; moonLight.shadow.camera.bottom = -6;
  moonLight.shadow.camera.near = 1; moonLight.shadow.camera.far = 40;
  moonLight.shadow.bias = -0.002;
  scene.add(moonLight);

  const lavaGlow = new THREE.PointLight(0xff4a10, 60, 40, 2);
  lavaGlow.position.set(0, -1.6, 4.5);
  scene.add(lavaGlow);
  const lavaGlowBack = new THREE.PointLight(0xff5a14, 40, 34, 2);
  lavaGlowBack.position.set(0, -1.6, -6);
  scene.add(lavaGlowBack);

  const rim = new THREE.DirectionalLight(0xff4a20, 0.8);
  rim.position.set(4, 3, -10);
  scene.add(rim);

  function update(dt, time) {
    lavaMat.uniforms.uTime.value = time;
    for (const t of torches) {
      const f = Math.sin(time * 11 + t.seed) * 0.5 + Math.sin(time * 23 + t.seed * 3) * 0.3;
      t.light.intensity = 24 + f * 7;
      t.flame.scale.set(1 + f * 0.12, 1 + f * 0.2, 1 + f * 0.12);
    }
    lavaGlow.intensity = 55 + Math.sin(time * 2.2) * 10;
    edgeGlowMat.emissiveIntensity = 1.7 + Math.sin(time * 2.2) * 0.45 + Math.sin(time * 5.3) * 0.2;

    // lava bubble pops
    const bp = bubbleGeo.attributes.position.array;
    for (let i = 0; i < bubbleCount; i++) {
      const b = bubbles[i];
      if (b.delay > 0) {
        b.delay -= dt;
        if (b.delay <= 0) {
          const [x, z] = BUBBLE_ZONES[Math.floor(Math.random() * BUBBLE_ZONES.length)]();
          b.x = x; b.z = z; b.life = 0.55 + Math.random() * 0.35;
          b.vy = 1.6 + Math.random() * 1.6;
          bp[i * 3] = x; bp[i * 3 + 1] = -2.35; bp[i * 3 + 2] = z;
        }
        continue;
      }
      b.life -= dt;
      if (b.life <= 0) { bp[i * 3 + 1] = -30; b.delay = 1 + Math.random() * 4; continue; }
      b.vy -= 4.5 * dt;
      bp[i * 3] = b.x + Math.sin(time * 7 + i) * 0.04;
      bp[i * 3 + 1] += b.vy * dt;
    }
    bubbleGeo.attributes.position.needsUpdate = true;

    // slow cloud drift near the moon
    for (const c of clouds) {
      c.spr.position.x = c.baseX + Math.sin(time * 0.05 + c.ph) * 5;
      c.spr.position.y += Math.sin(time * 0.11 + c.ph) * dt * 0.12;
    }

    const p = emberGeo.attributes.position.array;
    for (let i = 0; i < emberCount; i++) {
      const v = emberVel[i];
      p[i * 3] += (v.x + Math.sin(time + v.ph) * 0.2) * dt;
      p[i * 3 + 1] += v.y * dt;
      if (p[i * 3 + 1] > 11) { p[i * 3 + 1] = -2; p[i * 3] = (Math.random() - 0.5) * 34; }
    }
    emberGeo.attributes.position.needsUpdate = true;
  }

  return { update };
}
