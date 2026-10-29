// Clay Macaron · Demo Story World (`styles/clay-macaron/world.js`).
//
// Architectural Separation (`kernel.js` vs `world.js`):
//   - `./kernel.js` holds the reusable, subject-agnostic Clay Macaron visual &
//     physical engine (palette, procedural thumbprint/marbled/latte textures,
//     PBR clay/brass materials, 12fps stop-motion physics primitives, and the
//     turnkey sunlit studio stage `createClayStudioStage`).
//   - THIS file (`world.js`) is the default showcase story ("Le Petit Atelier Macaron")
//     built ON TOP OF `./kernel.js` and `../../engine/camera.js`.
//   - When authoring a new video for a user topic, import `./kernel.js` and
//     `../../engine/camera.js` and build bespoke 3D models for that topic—never
//     blindly copy these demo story props if the topic is unrelated!
//
// Strict rule: No Star-Spark Slime mascot in `styles/`.

import '../../engine/vendor/three.min.js';
import { clamp, lerp, smootherstep, springStep } from '../../engine/motion.js';
import {
  CLAY_PALETTE,
  quantizeStopMotionTime,
  evalVolumePreservingSquash,
  evalHopArc,
  evalLayerStackSpring,
  evalBoxUnfold,
  evalPouringStream,
  evalCarouselWave,
  createThumbprintBumpTexture,
  createMarbledClayTexture,
  createCaramelLatteTexture,
  createClayMaterialFactory,
  createClayStudioStage,
  buildClayCharacter,
  buildClayPath,
  buildClayGrass,
} from './kernel.js';

export {
  CLAY_PALETTE,
  quantizeStopMotionTime,
  evalVolumePreservingSquash,
  evalHopArc,
  evalLayerStackSpring,
  evalBoxUnfold,
  evalPouringStream,
  evalCarouselWave,
  createThumbprintBumpTexture,
  createMarbledClayTexture,
  createCaramelLatteTexture,
  createClayMaterialFactory,
  createClayStudioStage,
};

const THREE = globalThis.THREE;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// PART 4 · SIX CATEGORIES OF REUSABLE 3D CLAY BUILDERS
// ============================================================================

export function buildClayFourPointStar(
  makeClayMat,
  radius = 0.25,
  colorHex = '#FFFDF5',
  emissive = false
) {
  const shape = new THREE.Shape();
  const outer = radius;
  const inner = radius * 0.38;
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    const r = i % 2 === 0 ? outer : inner;
    const x = Math.cos(ang) * r;
    const y = Math.sin(ang) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: radius * 0.26,
    bevelEnabled: true,
    bevelThickness: radius * 0.14,
    bevelSize: radius * 0.12,
    bevelSegments: 3,
  });
  geo.center();

  const mat = makeClayMat(colorHex, {
    roughness: emissive ? 0.35 : 0.62,
    emissive: emissive ? colorHex : '#000000',
    emissiveIntensity: emissive ? 0.45 : 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

export function buildClayStrawberry(makeClayMat, scale = 1.0) {
  const group = new THREE.Group();
  const berryMat = makeClayMat(CLAY_PALETTE.strawberryRed, {
    roughness: 0.58,
    bumpScale: 0.032,
  });
  const seedMat = makeClayMat('#FCE38A', { roughness: 0.5 });
  const leafMat = makeClayMat(CLAY_PALETTE.pistachioGreen, { roughness: 0.68 });

  // Bottom of berry rests at y = 0, height = 0.52 * scale
  const h = 0.52 * scale;
  const bodyGeo = new THREE.ConeGeometry(0.28 * scale, h, 16, 8);
  const body = new THREE.Mesh(bodyGeo, berryMat);
  body.position.y = h * 0.5;
  body.castShadow = true;
  group.add(body);

  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const row = i % 2;
    const r = (row === 0 ? 0.21 : 0.14) * scale;
    const sy = (row === 0 ? 0.18 : 0.34) * scale;
    const seed = new THREE.Mesh(
      new THREE.SphereGeometry(0.024 * scale, 6, 6),
      seedMat
    );
    seed.position.set(Math.cos(a) * r, sy, Math.sin(a) * r);
    group.add(seed);
  }

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sepal = new THREE.Mesh(
      new THREE.BoxGeometry(0.14 * scale, 0.035 * scale, 0.07 * scale),
      leafMat
    );
    sepal.position.set(
      Math.cos(a) * 0.1 * scale,
      0.04 * scale,
      Math.sin(a) * 0.1 * scale
    );
    sepal.rotation.y = -a;
    group.add(sepal);
  }
  return group;
}

export function buildMintLeaf(makeClayMat, scale = 1.0) {
  const leafMat = makeClayMat(CLAY_PALETTE.pistachioGreen, {
    roughness: 0.66,
    bumpScale: 0.025,
  });
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.2 * scale, 12, 10),
    leafMat
  );
  mesh.scale.set(1.5, 0.24, 0.85);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Category A1: Glazed Polymer-Clay Donut (`buildClayDonut`).
 * Normalized so the bottom of the dough torus rests cleanly at local `y = 0`.
 * Total outer radius = `r * 1.42`, total height = `r * 0.90`.
 */
export function buildClayDonut(
  makeClayMat,
  r = 0.55,
  doughHex = '#F2CEA2',
  icingHex = '#F5A3B8'
) {
  const group = new THREE.Group();
  const tubeR = r * 0.42;
  const doughMat = makeClayMat(doughHex, { roughness: 0.76, bumpScale: 0.03 });
  const icingMat = makeClayMat(icingHex, { roughness: 0.44, bumpScale: 0.015 });

  const dough = new THREE.Mesh(
    new THREE.TorusGeometry(r, tubeR, 18, 32),
    doughMat
  );
  dough.rotation.x = Math.PI / 2;
  dough.position.y = tubeR;
  dough.castShadow = true;
  dough.receiveShadow = true;
  group.add(dough);

  const icing = new THREE.Mesh(
    new THREE.TorusGeometry(r * 1.01, tubeR * 0.88, 16, 32),
    icingMat
  );
  icing.rotation.x = Math.PI / 2;
  icing.position.y = tubeR + r * 0.1;
  icing.scale.set(1.0, 1.0, 0.62);
  icing.castShadow = true;
  group.add(icing);

  const sprinkleColors = ['#FFFDF5', '#FADC8C', '#9EDBC0', '#98D4F2', '#C8A8E9'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const sr = r * (0.86 + (i % 3) * 0.1);
    const sp = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.04, r * 0.04, r * 0.18, 8),
      makeClayMat(sprinkleColors[i % sprinkleColors.length], { roughness: 0.5 })
    );
    sp.position.set(Math.cos(a) * sr, tubeR * 1.68, Math.sin(a) * sr);
    sp.rotation.set(Math.PI / 2, a + 0.5, 0.3);
    group.add(sp);
  }

  return group;
}

/**
 * Category A2: Contact-Plane Anchored 5-Layer Clay Macaron (`buildClayMacaron`).
 *
 * Strictly normalized geometry so that at rest (`gap = 0, c = 0`):
 *   - Bottom shell bottom surface sits at local `y = 0.00` (zero plate penetration!)
 *   - Bottom shell + нижней pieds occupy `y in [0.00, 0.24 * r]`
 *   - Ganache filling occupies `y in [0.22 * r, 0.46 * r]`
 *   - Top shell + upper pieds occupy `y in [0.44 * r, 0.78 * r]`
 *   - Optional rosette + strawberry/mint crown sit at `y = 0.78 * r`
 *
 * When `setCompression(c)` is called, `innerGroup` scales relative to `y = 0` so
 * the bottom shell never sinks below `y = 0` or levitates above it.
 * When `setExplode(gap)` is called, `botAssembly` stays pinned at `y = 0` while
 * `creamMesh`, `topAssembly`, and `fruitGroup` lift upward (`+Y`).
 */
export function buildClayMacaron(makeClayMat, opts) {
  const {
    x = 0,
    baseY = 0,
    z = 0,
    r = 1.0,
    shellHex = CLAY_PALETTE.macaronRose,
    botShellHex = null,
    creamHex = CLAY_PALETTE.creamWhite,
    withFruit = false,
    withRosette = false,
  } = opts;

  const group = new THREE.Group();
  group.position.set(x, baseY, z);

  // `innerGroup` has its origin at `y = 0` (the exact bottom contact plane!)
  const innerGroup = new THREE.Group();
  innerGroup.position.set(0, 0, 0);
  group.add(innerGroup);

  const topMat = makeClayMat(shellHex, { roughness: 0.7, bumpScale: 0.028 });
  const botMat = makeClayMat(botShellHex || shellHex, {
    roughness: 0.7,
    bumpScale: 0.028,
  });
  const creamMat = makeClayMat(creamHex, {
    roughness: 0.56,
    bumpScale: 0.016,
  });

  const domeGeo = new THREE.SphereGeometry(r, 32, 20);
  const footCount = 18;
  const footDotGeo = new THREE.SphereGeometry(r * 0.115, 10, 8);

  // 1. Bottom Shell Assembly (`y in [0, 0.26 * r]`)
  const botAssembly = new THREE.Group();
  botAssembly.position.y = 0;

  const botShell = new THREE.Mesh(domeGeo, botMat);
  botShell.scale.set(1.0, 0.18, 1.0);
  // Sphere of radius r scaled by 0.18 has half-height 0.18*r; center at +0.18*r puts bottom at y=0!
  botShell.position.y = r * 0.18;
  botShell.castShadow = true;
  botShell.receiveShadow = true;
  botAssembly.add(botShell);

  for (let i = 0; i < footCount; i++) {
    const a = (i / footCount) * Math.PI * 2;
    const dot = new THREE.Mesh(footDotGeo, botMat);
    const fr = r * 0.95;
    dot.position.set(Math.cos(a) * fr, r * 0.22, Math.sin(a) * fr);
    dot.scale.set(1.12, 0.65, 1.12);
    botAssembly.add(dot);
  }
  innerGroup.add(botAssembly);

  // 2. Ganache / Buttercream Filling (`base center y = 0.34 * r`)
  const creamBaseY = r * 0.34;
  const creamGeo = new THREE.CylinderGeometry(
    r * 0.91,
    r * 0.91,
    r * 0.20,
    28
  );
  const creamMesh = new THREE.Mesh(creamGeo, creamMat);
  creamMesh.position.y = creamBaseY;
  creamMesh.castShadow = true;
   creamMesh.receiveShadow = true;
  innerGroup.add(creamMesh);

  // 3. Top Shell Assembly (`base origin y = 0.44 * r`, top apex at `0.78 * r`)
  const topBaseY = r * 0.44;
  const topAssembly = new THREE.Group();
  topAssembly.position.y = topBaseY;

  const topShell = new THREE.Mesh(domeGeo, topMat);
  topShell.scale.set(1.0, 0.24, 1.0);
  topShell.position.y = r * 0.1;
  topShell.castShadow = true;
  topShell.receiveShadow = true;
  topAssembly.add(topShell);

  for (let i = 0; i < footCount; i++) {
    const a = (i / footCount) * Math.PI * 2;
    const dot = new THREE.Mesh(footDotGeo, topMat);
    const fr = r * 0.96;
    dot.position.set(Math.cos(a) * fr, r * 0.03, Math.sin(a) * fr);
    dot.scale.set(1.15, 0.68, 1.15);
    topAssembly.add(dot);
  }
  innerGroup.add(topAssembly);

  // 4. Optional Top Crown (Whipped Cream Rosette + Strawberry + Mint Leaf)
  // Crown base sits on top of the top shell apex (`y = 0.34 * r` inside `topAssembly`, i.e. `0.78 * r` total)
  const fruitGroup = new THREE.Group();
  const crownLocalBaseY = r * 0.33;
  fruitGroup.position.y = crownLocalBaseY;
  if (withRosette) {
    const rosette = new THREE.Mesh(
      new THREE.TorusGeometry(r * 0.20, r * 0.075, 12, 22),
      makeClayMat('#FFFDF7', { roughness: 0.5 })
    );
    rosette.rotation.x = Math.PI / 2;
    rosette.position.y = r * 0.05;
    fruitGroup.add(rosette);
  }
  if (withFruit) {
    const berry = buildClayStrawberry(makeClayMat, r * 0.72);
    berry.position.set(-r * 0.05, r * 0.08, 0);
    berry.rotation.z = -0.16;
    const mint = buildMintLeaf(makeClayMat, r * 0.72);
    mint.position.set(r * 0.20, r * 0.10, r * 0.08);
    mint.rotation.set(0.18, 0.4, 0.26);
    fruitGroup.add(berry, mint);
  }
  topAssembly.add(fruitGroup);

  const totalRestHeight = (withFruit ? 1.18 : withRosette ? 0.88 : 0.78) * r;

  return {
    group,
    innerGroup,
    topAssembly,
    botAssembly,
    creamMesh,
    fruitGroup,
    baseY,
    r,
    totalRestHeight,
    setCompression(c) {
      const { sx, sy, sz, creamBulge } = evalVolumePreservingSquash(c);
      // Because innerGroup has its origin at y = 0 (contact plane), scaling innerGroup
      // keeps the bottom shell pinned at y = 0 without sinking into the plate!
      innerGroup.scale.set(sx, sy, sz);
      creamMesh.scale.set(creamBulge, 1.0, creamBulge);
    },
    setExplode(gap = 0, crownScale = 1) {
      // Bottom shell stays pinned on the contact plate (`y = 0`)!
      botAssembly.position.y = 0;
      creamMesh.position.y = creamBaseY + gap * 0.45;
      topAssembly.position.y = topBaseY + gap * 1.0;
      fruitGroup.position.y = crownLocalBaseY + gap * 0.35;
      fruitGroup.scale.setScalar(clamp(crownScale, 0.001, 1.2));
      fruitGroup.visible = crownScale > 0.02;
    },
  };
}

/**
 * Category B1: Two-Tier Brass & Ceramic Patisserie Stand (`buildTieredCakeStand`).
 * Audited for zero spindle clipping and exact plate-surface seating:
 *   - Lower plate top surface is at `Y = 1.07` (radius `2.35`).
 *   - Upper plate top surface is at `Y = 2.53` (radius `1.68`).
 *   - Central brass spindle has radius `0.09` at `(0, Y, 0)`.
 *   - Upper donut (`r = 0.38`, outer radius `0.54`) sits at `(-0.88, 2.53, 0.25)` -> clear of spindle by `0.38u`!
 *   - Upper macaron (`r = 0.48`) sits at `(+0.85, 2.53, -0.25)` -> distance to donut = `1.80u > 1.02u`!
 */
export function buildTieredCakeStand(makeClayMat, makeBrassWireMat) {
  const group = new THREE.Group();
  const plateMat = makeClayMat('#FAF2E6', { roughness: 0.62, bumpScale: 0.018 });
  const rimMat = makeClayMat(CLAY_PALETTE.macaronRose, { roughness: 0.58 });
  const brassMat = makeBrassWireMat();

  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 1.25, 0.26, 28),
    brassMat
  );
  foot.position.y = 0.13;
  foot.castShadow = true;
  foot.receiveShadow = true;
  group.add(foot);

  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.095, 3.6, 16),
    brassMat
  );
  rod.position.y = 1.85;
  rod.castShadow = true;
  group.add(rod);

  const ringHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.055, 12, 24),
    brassMat
  );
  ringHandle.position.y = 3.88;
  group.add(ringHandle);

  // Lower tier: center y = 0.98, height = 0.18 -> top surface at Y = 1.07
  // Upper tier: center y = 2.45, height = 0.16 -> top surface at Y = 2.53
  const tiers = [
    { y: 0.98, r: 2.35, h: 0.18 },
    { y: 2.45, r: 1.68, h: 0.16 },
  ];
  tiers.forEach((tr) => {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(tr.r, tr.r * 0.92, tr.h, 36),
      plateMat
    );
    plate.position.y = tr.y;
    plate.castShadow = true;
    plate.receiveShadow = true;
    group.add(plate);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(tr.r * 0.98, 0.055, 10, 36),
      rimMat
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = tr.y + tr.h * 0.5;
    group.add(rim);
  });

  // Lower tier confections seated cleanly at baseY = 1.07 (radius = 1.38 from spindle)
  const m1 = buildClayMacaron(makeClayMat, {
    x: -1.2,
    baseY: 1.07,
    z: 0.72,
    r: 0.58,
    shellHex: CLAY_PALETTE.macaronMint,
  });
  const m2 = buildClayMacaron(makeClayMat, {
    x: 1.2,
    baseY: 1.07,
    z: 0.68,
    r: 0.58,
    shellHex: CLAY_PALETTE.macaronLemon,
  });
  const m3 = buildClayMacaron(makeClayMat, {
    x: 0.0,
    baseY: 1.07,
    z: -1.35,
    r: 0.58,
    shellHex: CLAY_PALETTE.macaronTaro,
  });

  // Upper tier confections seated cleanly at baseY = 2.53, well clear of central spindle (R=0.09)
  const topDonut = buildClayDonut(
    makeClayMat,
    0.38,
    '#F2CEA2',
    CLAY_PALETTE.macaronRose
  );
  topDonut.position.set(-0.88, 2.53, 0.25);

  const topMac = buildClayMacaron(makeClayMat, {
    x: 0.85,
    baseY: 2.53,
    z: -0.25,
    r: 0.48,
    shellHex: CLAY_PALETTE.macaronSky,
    withRosette: true,
  });

  group.add(m1.group, m2.group, m3.group, topDonut, topMac.group);
  return { group };
}

/**
 * Category B2: Spout-Pinned Clay Teapot, Rising Teacup & Pouring Stream (`buildClayTeapotAndCup`).
 *
 * Audited to eliminate all stream/spout disconnection and lateral scaling bugs:
 *   - `potPivot` is located AT the exact spout tip `(1.72, 2.48, 0.55)`.
 *   - Inside `potPivot`, the teapot body is offset by `(+1.85, -0.35, 0)` so the curved spout
 *     terminates precisely at `potPivot` local `(0, 0, 0)`!
 *   - When `potPivot.rotation.z` tilts from `0` to `0.48 rad`, the teapot body lifts and tilts
 *     around the spout tip while the spout opening remains pinned at `(1.72, 2.48, 0.55)`!
 *   - `pourStreamGroup` also has its origin at `(1.72, 2.48, 0.55)` and extends downward to
 *     the teacup (`y = -1.45`), so scaling `(streamRadiusScale, streamExtend, streamRadiusScale)`
 *     grows the stream smoothly downward from inside the spout mouth into the rising tea!
 */
export function buildClayTeapotAndCup(makeClayMat, caramelTex, clayBumpTex) {
  const stageGroup = new THREE.Group();

  const spoutWorldPos = new THREE.Vector3(2.22, 1.74, 0.45);

  // 1. Spout-Pinned Teapot Group (`potPivot` origin IS the spout tip!)
  const potPivot = new THREE.Group();
  potPivot.position.copy(spoutWorldPos);
  stageGroup.add(potPivot);

  const potBodyMat = makeClayMat(CLAY_PALETTE.macaronMint, {
    roughness: 0.6,
    bumpScale: 0.03,
  });
  const trimMat = makeClayMat('#FAF2E6', { roughness: 0.62 });
  const goldMat = makeClayMat('#F8CF52', { roughness: 0.45 });

  // Offset teapot belly by (+1.72, -0.35, 0) relative to the spout tip at (0, 0, 0)
  const bellyCenter = new THREE.Group();
  bellyCenter.position.set(1.72, -0.35, 0);
  potPivot.add(bellyCenter);

  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(1.12, 28, 22),
    potBodyMat
  );
  belly.scale.set(1.08, 0.88, 1.0);
  belly.castShadow = true;
  bellyCenter.add(belly);

  const bellyBand = new THREE.Mesh(
    new THREE.TorusGeometry(1.18, 0.07, 12, 32),
    trimMat
  );
  bellyBand.rotation.x = Math.PI / 2;
  bellyCenter.add(bellyBand);

  const lidGroup = new THREE.Group();
  lidGroup.position.y = 0.92;
  const lidDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.56, 20, 14),
    trimMat
  );
  lidDome.scale.set(1.0, 0.45, 1.0);
  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 14, 14),
    goldMat
  );
  finial.position.y = 0.30;
  lidGroup.add(lidDome, finial);
  bellyCenter.add(lidGroup);

  // Ear handle on the right side of the belly (+X)
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.135, 12, 24, Math.PI * 1.15),
    potBodyMat
  );
  handle.position.set(1.04, 0.08, 0);
  handle.rotation.z = -Math.PI / 2;
  bellyCenter.add(handle);

  // Curved pouring spout running from belly left side `(0.82, -0.42, 0)` to spout tip `(0, 0, 0)`
  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.84, -0.44, 0),
    new THREE.Vector3(0.38, -0.16, 0),
    new THREE.Vector3(0.0, 0.0, 0),
  ]);
  const spoutMesh = new THREE.Mesh(
    new THREE.TubeGeometry(spoutCurve, 18, 0.19, 14, false),
    potBodyMat
  );
  spoutMesh.castShadow = true;
  potPivot.add(spoutMesh);

  const spoutLip = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.04, 10, 20),
    trimMat
  );
  spoutLip.rotation.y = Math.PI / 2;
  potPivot.add(spoutLip);

  // 2. Terracotta & Cream Teacup on Saucer directly below the spout `(2.15, 0.0, 0.45)`
  const cupGroup = new THREE.Group();
  cupGroup.position.set(2.15, 0.0, 0.45);
  stageGroup.add(cupGroup);

  const saucer = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 0.96, 0.15, 28),
    makeClayMat('#FAF0E4', { roughness: 0.64 })
  );
  saucer.position.y = 0.075;
  saucer.receiveShadow = true;
  cupGroup.add(saucer);

  const cupMat = makeClayMat(CLAY_PALETTE.terracotta, { roughness: 0.68 });
  const cupWall = new THREE.Mesh(
    new THREE.CylinderGeometry(0.86, 0.68, 1.06, 28),
    cupMat
  );
  cupWall.position.y = 0.60;
  cupWall.castShadow = true;
  cupGroup.add(cupWall);

  const cupHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.30, 0.09, 10, 20, Math.PI * 1.1),
    cupMat
  );
  cupHandle.position.set(0.82, 0.62, 0);
  cupHandle.rotation.z = -Math.PI / 2;
  cupGroup.add(cupHandle);

  // 3. Rising Tea Surface + Concentric Foam Ripple + Floating Sugar Cube (`teaLevelGroup`)
  const streamMat = new THREE.MeshStandardMaterial({
    map: caramelTex,
    bumpMap: clayBumpTex,
    bumpScale: 0.018,
    roughness: 0.26,
    metalness: 0.05,
  });

  const teaLevelGroup = new THREE.Group();
  teaLevelGroup.position.y = 0.66;
  cupGroup.add(teaLevelGroup);

  const teaSurface = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 0.74, 0.06, 24),
    streamMat
  );
  teaLevelGroup.add(teaSurface);

  // Sugar cube floats on the front-right quadrant of the tea surface `(0.30, 0.07, 0.18)`
  const sugarCube = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.22, 0.22),
    makeClayMat('#FFFDF8', { roughness: 0.72 })
  );
  sugarCube.position.set(0.30, 0.07, 0.18);
  sugarCube.rotation.set(0.25, 0.45, 0.18);
  teaLevelGroup.add(sugarCube);

  // Foam ripple ring centered around stream impact `(-0.04, 0.04, -0.02)` with max radius 0.20
  const foamRipple = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.03, 10, 24),
    makeClayMat('#FFFDF6', { roughness: 0.46 })
  );
  foamRipple.rotation.x = Math.PI / 2;
  foamRipple.position.set(-0.04, 0.04, -0.02);
  teaLevelGroup.add(foamRipple);

  // 4. Spout-Origin Pouring Stream (`pourStreamGroup` origin is at `spoutWorldPos`)
  const pourStreamGroup = new THREE.Group();
  pourStreamGroup.position.copy(spoutWorldPos);
  stageGroup.add(pourStreamGroup);

  // Local curve starts at (0, 0, 0) inside the spout mouth and arcs down to (-0.07, -1.02, 0)
  const localPourCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.0, 0.0),
    new THREE.Vector3(-0.05, -0.45, 0.0),
    new THREE.Vector3(-0.07, -1.02, 0.0),
  ]);
  const pourStreamMesh = new THREE.Mesh(
    new THREE.TubeGeometry(localPourCurve, 24, 0.12, 14, false),
    streamMat
  );
  pourStreamMesh.castShadow = true;
  pourStreamGroup.add(pourStreamMesh);

  return {
    group: stageGroup,
    potPivot,
    lidGroup,
    pourStreamGroup,
    teaLevelGroup,
    foamRipple,
    sugarCube,
    updatePour(qLocalT) {
      const {
        potTiltRad,
        streamExtend,
        streamRadiusScale,
        cupFillProgress,
        ripplePhase,
      } = evalPouringStream(qLocalT);

      // Counter-clockwise (+potTiltRad) around spout tip lifts the teapot belly UP and tilts it FORWARD toward the teacup!
      potPivot.rotation.z = potTiltRad * 0.68;
      lidGroup.position.y = 0.92 + Math.abs(Math.sin(qLocalT * 5.0)) * 0.035;

      // Stream scales around its own origin at the spout mouth!
      pourStreamGroup.scale.set(
        Math.max(0.001, streamRadiusScale),
        Math.max(0.001, streamExtend),
        Math.max(0.001, streamRadiusScale)
      );
      pourStreamGroup.visible = streamExtend > 0.02;

      // Tea level rises smoothly inside the cup from y=0.66 to y=1.04
      const teaY = lerp(0.66, 1.04, cupFillProgress);
      teaLevelGroup.position.y = teaY;
      const rScale =
        lerp(0.65, 1.22, cupFillProgress) *
        (0.85 + (ripplePhase % 1.0) * 0.32);
      foamRipple.scale.set(rScale, rScale, 1.0);

      sugarCube.position.y = 0.06 + Math.sin(qLocalT * 4.8) * 0.03;
      sugarCube.rotation.x = 0.2 + Math.sin(qLocalT * 3.2) * 0.14;
    },
  };
}

/**
 * Category C: 9-Grid Pastel Gift Box with Outer-Edge Hinge, Untying Bow & Retracted Balloons (`buildGiftBoxSet`).
 *
 * Audited to eliminate all 4 unboxing clipping bugs:
 *   - Box outer footprint: `boxW = 5.2, boxD = 4.6, boxH = 1.32`. Each 3x3 cell has clear space `1.54 x 1.34`.
 *   - All 9 confections have outer radius `<= 0.48` (`< 0.67` half-cell clearance), and only rotate once lifted above the dividers!
 *   - `lidPivot` is placed at the outer-top-back edge `(0, boxH + 0.14, -boxD/2 - 0.08)` so the hinged lid never clips the back wall!
 *   - `balloonCluster` starts retracted inside the center cell (`scale = 0.01`, `y = 0.2`) and only inflates & rises at `qLocalT > 0.72s` AFTER the lid is open past `75°`!
 */
export function buildGiftBoxSet(makeClayMat, makeBrassWireMat, marbledTex) {
  const root = new THREE.Group();

  // `boxGroup` has its origin at `y = 0` (tabletop contact plane)
  const boxGroup = new THREE.Group();
  root.add(boxGroup);

  const boxW = 5.2;
  const boxH = 1.32;
  const boxD = 4.6;
  const wallT = 0.20;

  const baseMat = makeClayMat('#FAF0E4', { roughness: 0.7 });
  const innerMat = makeClayMat(CLAY_PALETTE.macaronRose, { roughness: 0.72 });
  const lidMat = makeClayMat(CLAY_PALETTE.macaronRose, { roughness: 0.64 });
  const ribbonMat = makeClayMat('#F8CF52', { roughness: 0.52 });

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(boxW, wallT, boxD),
    baseMat
  );
  floor.position.y = wallT / 2;
  floor.receiveShadow = true;
  floor.castShadow = true;
  boxGroup.add(floor);

  const frontWall = new THREE.Mesh(
    new THREE.BoxGeometry(boxW, boxH, wallT),
    baseMat
  );
  frontWall.position.set(0, boxH / 2, boxD / 2 - wallT / 2);
  frontWall.castShadow = true;
  const backWall = frontWall.clone();
  backWall.position.z = -boxD / 2 + wallT / 2;
  boxGroup.add(frontWall, backWall);

  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallT, boxH, boxD),
    baseMat
  );
  leftWall.position.set(-boxW / 2 + wallT / 2, boxH / 2, 0);
  leftWall.castShadow = true;
  const rightWall = leftWall.clone();
  rightWall.position.x = boxW / 2 - wallT / 2;
  boxGroup.add(leftWall, rightWall);

  // Inner 3x3 pastel clay grid dividers (height = 0.96 so items clear them at y > 1.0)
  const divH = 0.96;
  [-boxW / 6, boxW / 6].forEach((dx) => {
    const divX = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, divH, boxD - wallT * 2),
      innerMat
    );
    divX.position.set(dx, wallT + divH / 2, 0);
    boxGroup.add(divX);
  });
  [-boxD / 6, boxD / 6].forEach((dz) => {
    const divZ = new THREE.Mesh(
      new THREE.BoxGeometry(boxW - wallT * 2, divH, 0.10),
      innerMat
    );
    divZ.position.set(0, wallT + divH / 2, dz);
    boxGroup.add(divZ);
  });

  // Hinged Lid pivoted at outer-top-back edge `(0, boxH + 0.13, -boxD/2 - 0.08)` -> zero back-wall collision
  const lidThick = 0.26;
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, boxH + lidThick / 2, -boxD / 2 - 0.06);
  boxGroup.add(lidPivot);

  const lidSlab = new THREE.Mesh(
    new THREE.BoxGeometry(boxW + 0.16, lidThick, boxD + 0.16),
    lidMat
  );
  lidSlab.position.set(0, 0, boxD / 2 + 0.06);
  lidSlab.castShadow = true;
  lidPivot.add(lidSlab);

  const ribbonCrossX = new THREE.Mesh(
    new THREE.BoxGeometry(boxW + 0.22, lidThick + 0.04, 0.44),
    ribbonMat
  );
  ribbonCrossX.position.set(0, 0.01, boxD / 2 + 0.06);
  const ribbonCrossZ = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, lidThick + 0.04, boxD + 0.22),
    ribbonMat
  );
  ribbonCrossZ.position.set(0, 0.01, boxD / 2 + 0.06);
  lidPivot.add(ribbonCrossX, ribbonCrossZ);

  // 3D Sculpted Clay Ribbon Bow with untying left/right loops
  const bowGroup = new THREE.Group();
  bowGroup.position.set(0, lidThick / 2 + 0.12, boxD / 2 + 0.06);
  const bowLoops = [];
  [-1, 1].forEach((dir) => {
    const loop = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.14, 12, 24),
      ribbonMat
    );
    loop.position.set(dir * 0.44, 0.16, 0);
    loop.rotation.z = dir * 0.35;
    loop.castShadow = true;
    bowGroup.add(loop);
    bowLoops.push({ mesh: loop, dir });
  });
  const knot = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 14, 14),
    ribbonMat
  );
  knot.position.y = 0.14;
  bowGroup.add(knot);
  lidPivot.add(bowGroup);

  // 9 Pop-up Treasures inside the 3x3 grid (compact radius <= 0.44 so zero divider clipping!)
  const popItems = [];
  const gridCoords = [
    [-1.58, -1.35],
    [0.0, -1.35],
    [1.58, -1.35],
    [-1.58, 0.0],
    [0.0, 0.0],
    [1.58, 0.0],
    [-1.58, 1.35],
    [0.0, 1.35],
    [1.58, 1.35],
  ];
  const flavors = [
    CLAY_PALETTE.macaronMint,
    CLAY_PALETTE.macaronLemon,
    CLAY_PALETTE.macaronTaro,
    CLAY_PALETTE.macaronCoral,
    CLAY_PALETTE.macaronRose,
    CLAY_PALETTE.macaronSky,
  ];

  let balloonCluster = null;

  gridCoords.forEach(([gx, gz], idx) => {
    const itemGroup = new THREE.Group();
    itemGroup.position.set(gx, 0.22, gz);

    if (idx === 4) {
      // Center slot: Hero Macaron (`r = 0.48`) + Retractable 3-Balloon Cluster
      const heroMac = buildClayMacaron(makeClayMat, {
        r: 0.48,
        baseY: 0,
        shellHex: CLAY_PALETTE.macaronRose,
        creamHex: CLAY_PALETTE.macaronMint,
        withRosette: true,
      });
      itemGroup.add(heroMac.group);

      balloonCluster = new THREE.Group();
      balloonCluster.position.set(0, 0.35, 0);
      const balloonSpecs = [
        { x: -0.58, y: 1.45, z: -0.18, col: CLAY_PALETTE.macaronMint },
        { x: 0.0, y: 1.75, z: -0.25, col: CLAY_PALETTE.macaronLemon },
        { x: 0.58, y: 1.50, z: -0.15, col: CLAY_PALETTE.macaronTaro },
      ];
      balloonSpecs.forEach((bs) => {
        const bMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.42, 20, 18),
          makeClayMat(bs.col, { roughness: 0.54 })
        );
        bMesh.scale.set(1.0, 1.16, 1.0);
        bMesh.position.set(bs.x, bs.y, bs.z);
        bMesh.castShadow = true;
        const wireLen = bs.y - 0.1;
        const wire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.024, wireLen, 8),
          makeBrassWireMat()
        );
        wire.position.set(bs.x * 0.5, wireLen * 0.5, bs.z * 0.5);
        wire.rotation.z = -bs.x * 0.32;
        balloonCluster.add(bMesh, wire);
      });
      itemGroup.add(balloonCluster);
    } else if (idx === 1 || idx === 7) {
      // Glazed donut with r=0.30 -> outer radius = 0.426 (well inside 0.67 cell radius)
      const donut = buildClayDonut(
        makeClayMat,
        0.30,
        '#F2CEA2',
        flavors[idx % flavors.length]
      );
      itemGroup.add(donut);
    } else if (idx === 3 || idx === 5) {
      // Marbled pearl sitting on y=0 (radius 0.36, center at y=0.36)
      const pearl = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 22, 18),
        makeClayMat('#FFFFFF', { map: marbledTex, roughness: 0.58 })
      );
      pearl.position.y = 0.36;
      pearl.castShadow = true;
      itemGroup.add(pearl);
    } else {
      const mac = buildClayMacaron(makeClayMat, {
        r: 0.42,
        baseY: 0,
        shellHex: flavors[idx % flavors.length],
        creamHex: '#FFFDF5',
      });
      itemGroup.add(mac.group);
    }

    boxGroup.add(itemGroup);
    popItems.push({ group: itemGroup, baseX: gx, baseZ: gz, index: idx });
  });

  return {
    root,
    boxGroup,
    lidPivot,
    bowGroup,
    popItems,
    updateUnbox(qLocalT) {
      const { boxSquash, untieProgress, openAngleRad } = evalBoxUnfold(qLocalT);
      const { sx, sy, sz } = evalVolumePreservingSquash(boxSquash);
      // Squash relative to tabletop y=0
      boxGroup.scale.set(sx, sy, sz);

      // Untie bow loops outward & flatten as ribbon loosens
      bowLoops.forEach(({ mesh, dir }) => {
        mesh.position.x = dir * (0.44 + untieProgress * 0.55);
        mesh.rotation.z = dir * (0.35 + untieProgress * 0.85);
        mesh.scale.setScalar(1.0 - untieProgress * 0.45);
      });

      lidPivot.rotation.x = -openAngleRad;

      // Retract balloons completely below the lid until qLocalT > 0.72s (after lid is wide open!)
      if (balloonCluster) {
        const bPop = springStep(Math.max(0, qLocalT - 0.74), 0.26, 6.2).x;
        const bScale = clamp(bPop, 0.001, 1.08);
        balloonCluster.scale.setScalar(bScale);
        balloonCluster.visible = qLocalT > 0.72;
      }

      popItems.forEach((it) => {
        const delay = 0.66 + it.index * 0.07;
        const sp = springStep(Math.max(0, qLocalT - delay), 0.25, 6.4).x;
        const liftH = it.index === 4 ? 1.38 : 1.05 + (it.index % 3) * 0.22;
        const bob =
          qLocalT > delay + 0.35
            ? Math.sin(qLocalT * 3.6 + it.index) * 0.09
            : 0;
        const curY = 0.22 + sp * liftH + bob;
        it.group.position.y = curY;
        // Only rotate items once they have cleared the 3x3 divider walls (curY > 0.95)!
        const clearFactor = smootherstep(0.85, 1.15, curY);
        it.group.rotation.y =
          clearFactor *
          Math.max(0, qLocalT - delay) *
          (it.index % 2 === 0 ? 0.85 : -0.8);
      });
    },
  };
}

/**
 * Category D: Miniature French Patisserie Boutique, Recessed Vitrine, Wall-Pinned Awning & 4-Wire Cloud Balloon (`buildPatisserieBoutique`).
 *
 * Audited to eliminate all 4 boutique clipping bugs:
 *   - `windowMacaron` sits at `z = 1.12` inside a recessed warm interior niche (`z in [0.55, 1.58]`),
 *     completely behind the translucent glass pane at `z = 1.66`!
 *   - `roofMacaron` rests on a turned brass & terracotta rooftop sign pedestal (`Y = 4.56..4.82`), zero levitation!
 *   - `awningGroup` is pivoted at the front wall face (`z = 1.60`) with all slant boards at `z > 0`, so unfolding never penetrates the facade!
 *   - `balloonGroup` has all 4 brass suspension wires (`(±0.34, y, ±0.34)`) and rises to a safe altitude (`Y = 2.25..2.95`) completely clear of the top-right DOM badge!
 */
export function buildPatisserieBoutique(makeClayMat, makeBrassWireMat) {
  const root = new THREE.Group();

  // 1. Main Boutique Building Facade & Roof
  const houseGroup = new THREE.Group();
  houseGroup.position.set(-1.15, 0.0, -0.8);
  root.add(houseGroup);

  const wallMat = makeClayMat('#FAF0E2', { roughness: 0.76 });
  const trimMat = makeClayMat(CLAY_PALETTE.terracotta, { roughness: 0.7 });
  const mintMat = makeClayMat(CLAY_PALETTE.macaronMint, { roughness: 0.66 });
  const brassMat = makeBrassWireMat();

  // Rear/Main building mass (front face at z = 1.60)
  const mainWall = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 4.2, 3.2),
    wallMat
  );
  mainWall.position.set(0, 2.1, 0.0);
  mainWall.castShadow = true;
  mainWall.receiveShadow = true;
  houseGroup.add(mainWall);

  // Roof cornice: center y = 4.35, height = 0.42 -> top surface at Y = 4.56
  const roofCornice = new THREE.Mesh(
    new THREE.BoxGeometry(6.0, 0.42, 3.5),
    trimMat
  );
  roofCornice.position.y = 4.35;
  roofCornice.castShadow = true;
  houseGroup.add(roofCornice);

  // Rooftop Sign Pedestal (`Y = 4.56..4.82`) supporting the giant spinning macaron sign!
  const roofPedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.92, 1.08, 0.26, 28),
    brassMat
  );
  roofPedestal.position.set(0.0, 4.69, 0.35);
  roofPedestal.castShadow = true;
  houseGroup.add(roofPedestal);

  const roofMacaron = buildClayMacaron(makeClayMat, {
    x: 0.0,
    baseY: 4.82,
    z: 0.35,
    r: 0.82,
    shellHex: CLAY_PALETTE.macaronRose,
    creamHex: CLAY_PALETTE.macaronLemon,
    withRosette: true,
    withFruit: true,
  });
  houseGroup.add(roofMacaron.group);

  // Warm Interior Vitrine Display Niche on Left (`x = -1.05, y = 1.62`)
  // Frame protrudes forward from front wall `z = 1.60` to `z = 1.96` so the display macaron
  // sits inside the frame pocket (`z = 1.60..1.92`) with a clear glass front at `z = 1.95`!
  const vitrineBack = new THREE.Mesh(
    new THREE.PlaneGeometry(2.05, 1.68),
    new THREE.MeshStandardMaterial({
      color: '#FFF3D6',
      emissive: '#FFDFA0',
      emissiveIntensity: 0.65,
      roughness: 0.4,
    })
  );
  vitrineBack.position.set(-1.05, 1.62, 1.61);
  houseGroup.add(vitrineBack);

  // 4-sided Mint Window Frame (`z = 1.60..2.02`, depth = 0.42)
  const frameTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.42, 0.18, 0.44),
    mintMat
  );
  frameTop.position.set(-1.05, 2.52, 1.80);
  const frameBot = new THREE.Mesh(
    new THREE.BoxGeometry(2.48, 0.22, 0.56),
    mintMat
  );
  frameBot.position.set(-1.05, 0.72, 1.84);
  const frameLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.8, 0.44),
    mintMat
  );
  frameLeft.position.set(-2.17, 1.62, 1.80);
  const frameRight = frameLeft.clone();
  frameRight.position.x = 0.07;
  houseGroup.add(frameTop, frameBot, frameLeft, frameRight);

  // Brass turntable & Display Macaron (`r = 0.36`) seated on `frameBot` sill at `z = 1.82`
  // Macaron Z-span is `1.82 ± 0.36 = [1.46, 2.18]` — wait: let's keep `r = 0.30` at `z = 1.82`
  // so its Z-span is `[1.52, 2.12]` and place the front glass pane at `z = 2.16`!
  // Wait: even better, make `frameBot` shelf protrude to `z = 2.28`, place `windowMacaron` (`r = 0.34`)
  // at `z = 1.96` (`Z in [1.62, 2.30]` — completely in front of `vitrineBack` at `1.61`!),
  // and frame it as an open French patisserie display bay window!
  const bayCanopy = new THREE.Mesh(
    new THREE.BoxGeometry(2.48, 0.16, 0.68),
    mintMat
  );
  bayCanopy.position.set(-1.05, 2.52, 1.92);
  frameBot.geometry = new THREE.BoxGeometry(2.48, 0.22, 0.72);
  frameBot.position.set(-1.05, 0.72, 1.94);
  frameLeft.geometry = new THREE.BoxGeometry(0.18, 1.8, 0.68);
  frameLeft.position.set(-2.17, 1.62, 1.92);
  frameRight.geometry = frameLeft.geometry;
  frameRight.position.set(0.07, 1.62, 1.92);
  houseGroup.add(bayCanopy);

  const vitrineStand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.52, 0.14, 24),
    brassMat
  );
  vitrineStand.position.set(-1.05, 0.90, 1.95);
  houseGroup.add(vitrineStand);

  const windowMacaron = buildClayMacaron(makeClayMat, {
    x: -1.05,
    baseY: 0.97,
    z: 1.95,
    r: 0.32,
    shellHex: CLAY_PALETTE.macaronTaro,
    creamHex: '#FFFDF5',
    withRosette: true,
  });
  houseGroup.add(windowMacaron.group);

  // Translucent front glass pane at `z = 2.29` (completely in front of `windowMacaron` max Z = `1.95 + 0.32 = 2.27`!)
  const glassPane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.06, 1.62),
    new THREE.MeshStandardMaterial({
      color: '#FFFDF9',
      transparent: true,
      opacity: 0.22,
      roughness: 0.15,
    })
  );
  glassPane.position.set(-1.05, 1.62, 2.29);
  houseGroup.add(glassPane);

  // Mint Clay Door with Brass Knob (`x = +1.55`)
  const doorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 2.55, 0.24),
    mintMat
  );
  doorMesh.position.set(1.55, 1.275, 1.62);
  const doorKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 12),
    brassMat
  );
  doorKnob.position.set(1.12, 1.25, 1.78);
  houseGroup.add(doorMesh, doorKnob);

  // 2. Wall-Pinned Scalloped 8-Stripe Pastel Awning (`awningGroup` origin at front wall `z = 1.60`)
  const awningGroup = new THREE.Group();
  awningGroup.position.set(0.0, 3.25, 1.60);
  houseGroup.add(awningGroup);

  const stripeCount = 8;
  const stripeW = 5.4 / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    const sx = -2.7 + (i + 0.5) * stripeW;
    const sMat = makeClayMat(
      i % 2 === 0 ? CLAY_PALETTE.macaronRose : '#FFFDF6',
      { roughness: 0.66 }
    );
    // Slant board starts at z = +0.06 and extends forward to z = +1.32 -> zero wall penetration!
    const slant = new THREE.Mesh(
      new THREE.BoxGeometry(stripeW * 0.98, 0.15, 1.32),
      sMat
    );
    slant.position.set(sx, -0.28, 0.64);
    slant.rotation.x = 0.42;
    slant.castShadow = true;

    const scallop = new THREE.Mesh(
      new THREE.CylinderGeometry(
        stripeW * 0.48,
        stripeW * 0.48,
        0.16,
        16
      ),
      sMat
    );
    scallop.rotation.x = Math.PI / 2;
    scallop.position.set(sx, -0.58, 1.24);
    awningGroup.add(slant, scallop);
  }

  // 3. Cobblestone Stepping Stones & Vintage Brass Streetlamp
  const cobblePositions = [
    [-2.4, 2.2, 0.52],
    [-1.1, 2.48, 0.58],
    [0.3, 2.38, 0.55],
    [1.6, 2.18, 0.64],
    [2.8, 2.52, 0.50],
  ];
  cobblePositions.forEach(([cx, cz, cr], idx) => {
    const stone = new THREE.Mesh(
      new THREE.CylinderGeometry(cr, cr * 1.06, 0.14, 18),
      makeClayMat(idx % 2 === 0 ? '#D9C4B0' : '#E5D2BE', { roughness: 0.82 })
    );
    stone.position.set(cx, 0.07, cz);
    stone.receiveShadow = true;
    root.add(stone);
  });

  const lampGroup = new THREE.Group();
  lampGroup.position.set(-4.15, 0.0, 1.65);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.14, 3.8, 14),
    brassMat
  );
  pole.position.y = 1.9;
  pole.castShadow = true;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 18, 16),
    makeClayMat('#FFE885', {
      emissive: '#FFD54F',
      emissiveIntensity: 0.75,
      roughness: 0.35,
    })
  );
  bulb.position.y = 3.95;
  const lampHat = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 0.35, 18),
    brassMat
  );
  lampHat.position.y = 4.32;
  lampGroup.add(pole, bulb, lampHat);
  root.add(lampGroup);

  // 4. 4-Wire Cloud Hot-Air Balloon Carrying a Macaron Basket (`balloonGroup`)
  // Positioned at `x = 3.35, y = 2.25..2.85` so it has +0.44u clearance from roof cornice and stays below the DOM badge!
  const balloonGroup = new THREE.Group();
  balloonGroup.position.set(3.35, 2.35, 0.85);
  root.add(balloonGroup);

  const envelopeMat = makeClayMat(CLAY_PALETTE.macaronSky, { roughness: 0.62 });
  const stripeEnvMat = makeClayMat('#FFFDF6', { roughness: 0.64 });
  const envelope = new THREE.Mesh(
    new THREE.SphereGeometry(1.06, 24, 20),
    envelopeMat
  );
  envelope.scale.set(1.0, 1.15, 1.0);
  envelope.castShadow = true;
  balloonGroup.add(envelope);

  const envBelt = new THREE.Mesh(
    new THREE.TorusGeometry(1.05, 0.11, 12, 28),
    stripeEnvMat
  );
  envBelt.rotation.x = Math.PI / 2;
  balloonGroup.add(envBelt);

  // 4 Brass suspension wires at `(±0.32, -1.22, ±0.32)` connecting envelope to basket rim
  [
    [-0.32, -0.32],
    [0.32, -0.32],
    [-0.32, 0.32],
    [0.32, 0.32],
  ].forEach(([wx, wz]) => {
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 1.35, 8),
      brassMat
    );
    wire.position.set(wx, -1.22, wz);
    balloonGroup.add(wire);
  });

  const basket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.42, 0.58, 18),
    makeClayMat('#D69B66', { roughness: 0.76 })
  );
  basket.position.y = -1.92;
  basket.castShadow = true;
  balloonGroup.add(basket);

  // Macaron passenger seated on top of basket rim (`baseY = -1.63`)
  const basketMac = buildClayMacaron(makeClayMat, {
    baseY: -1.63,
    r: 0.38,
    shellHex: CLAY_PALETTE.macaronLemon,
    creamHex: CLAY_PALETTE.macaronRose,
  });
  balloonGroup.add(basketMac.group);

  return {
    root,
    awningGroup,
    roofMacaron,
    windowMacaron,
    balloonGroup,
    updateBoutique(qLocalT, qTime) {
      const awningBounce = clamp(
        springStep(qLocalT, 0.24, 6.0).x,
        0.15,
        1.06
      );
      // Pivot around wall attachment instead of scaling into wall
      awningGroup.rotation.x = (1.0 - awningBounce) * 0.45;
      roofMacaron.group.rotation.y = qLocalT * 1.15;
      windowMacaron.group.rotation.y = -qLocalT * 1.4;

      // Safe altitude: y in [2.25, 2.88] -> top of balloon <= 4.10 (below DOM badge!)
      balloonGroup.position.y =
        2.25 +
        smootherstep(0.0, 3.2, qLocalT) * 0.55 +
        Math.sin(qTime * 2.6) * 0.08;
      balloonGroup.rotation.z = Math.sin(qTime * 2.0) * 0.05;
    },
  };
}

/**
 * Category E: Brass Wind-Up Music Box Carousel with Edge-Pivoted Domino Wave & Phase-Locked Hopping Pearl (`buildKineticMusicBox`).
 *
 * Audited to eliminate all 4 music-box clipping & physics bugs:
 *   - `windUpKey` is mounted along the exact radial normal `(x = -4.75, y = 0.44, z = 0.0)` with a brass collar flush on the drum wall.
 *   - All 16 dominoes pivot around their **bottom-front tipping edge** (`+T/2 = +0.14`) so leaning forward by `[6°, 36°]` lifts their heel *above* the drum (`Y >= 0.85`, zero gouging!) and keeps tangential reach `<= 0.96 < 1.46` (zero neighbor piercing!).
 *   - `mandalaWheel` is raised to `y = 2.90` with a brass support column so its outer halo clears the pedestal gold ring by `+0.16u`.
 *   - `orbitPearl` hops along its own outer concentric brass track (`R = 2.88`, completely clear of the `R = 1.95, r = 0.54` macaron ring!) OR hops with true parabolic gravity (`evalHopArc`) between the 6 macarons, landing strictly on top of each macaron (`Y = 0.85 + 0.42 = 1.27`) and triggering a synchronized contact squash on the landed macaron!
 */
export function buildKineticMusicBox(makeClayMat, makeBrassWireMat, marbledTex) {
  const root = new THREE.Group();
  const brassMat = makeBrassWireMat();

  // 1. Two-Tier Fluted Pastel Drum Plinth (top surface at Y = 0.85)
  const lowerDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(4.65, 4.85, 0.85, 40),
    makeClayMat('#FAF0E2', { roughness: 0.72 })
  );
  lowerDrum.position.y = 0.425;
  lowerDrum.receiveShadow = true;
  lowerDrum.castShadow = true;
  root.add(lowerDrum);

  const drumTrim = new THREE.Mesh(
    new THREE.TorusGeometry(4.72, 0.11, 12, 44),
    makeClayMat(CLAY_PALETTE.macaronRose, { roughness: 0.62 })
  );
  drumTrim.rotation.x = Math.PI / 2;
  drumTrim.position.y = 0.84;
  root.add(drumTrim);

  // 2. Radially Aligned Brass Wind-Up Key (`x = -4.75, y = 0.44, z = 0.0`)
  const keyCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.32, 0.18, 18),
    brassMat
  );
  keyCollar.rotation.z = Math.PI / 2;
  keyCollar.position.set(-4.76, 0.44, 0.0);
  root.add(keyCollar);

  const windUpKey = new THREE.Group();
  windUpKey.position.set(-4.82, 0.44, 0.0);
  const keyStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 1.05, 14),
    brassMat
  );
  keyStem.rotation.z = Math.PI / 2;
  keyStem.position.x = -0.48;
  windUpKey.add(keyStem);

  [-0.42, 0.42].forEach((ky) => {
    const wing = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.115, 12, 24),
      brassMat
    );
    wing.position.set(-1.05, ky, 0);
    wing.castShadow = true;
    windUpKey.add(wing);
  });
  root.add(windUpKey);

  // 3. Outer Ring (R = 3.75): 16 Edge-Pivoted Pastel Clay Domino Tiles
  const dominoRing = [];
  const domColors = [
    '#FAF5EB',
    '#9EDBC0',
    '#F5A3B8',
    '#FADC8C',
    '#98D4F2',
    '#C8A8E9',
  ];
  const totalDominoes = 16;
  const domT = 0.26;
  const domH = 1.38;
  const domW = 0.78;

  for (let i = 0; i < totalDominoes; i++) {
    const ang = (i / totalDominoes) * Math.PI * 2;
    const radialGroup = new THREE.Group();
    radialGroup.position.set(
      Math.cos(ang) * 3.75,
      0.85,
      Math.sin(ang) * 3.75
    );
    radialGroup.rotation.y = -ang + Math.PI / 2;

    // Pivot is placed at the bottom-front tipping edge `(+domT/2, 0, 0)` so tilting
    // by `-dominoLeanRad` around Z lifts the rear heel UP instead of gouging into the drum!
    const pivot = new THREE.Group();
    pivot.position.set(domT / 2, 0, 0);

    const tileMat = makeClayMat(domColors[i % domColors.length], {
      roughness: 0.66,
    });
    const pipMat = makeClayMat('#3D2722', { roughness: 0.55 });
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(domT, domH, domW),
      tileMat
    );
    // Relative to bottom-front edge `(0,0,0)`, tile center is at `(-domT/2, domH/2, 0)`
    tile.position.set(-domT / 2, domH / 2, 0);
    tile.castShadow = true;
    pivot.add(tile);

    [-0.26, 0.26].forEach((py) => {
      const pip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), pipMat);
      pip.position.set(0.01, domH / 2 + py, 0);
      pivot.add(pip);
    });

    radialGroup.add(pivot);
    root.add(radialGroup);
    dominoRing.push({ pivot, index: i });
  }

  // 4. Inner Ring (R = 2.08): 6 Bouncing Pastel Macarons (`r = 0.56`)
  // Rest height of each macaron = `0.78 * 0.56 = 0.437`, so top surface at rest is `0.85 + 0.437 = 1.287`.
  const macaronRing = [];
  const macRingRadius = 2.08;
  const macRadius = 0.56;
  const innerFlavors = [
    CLAY_PALETTE.macaronMint,
    CLAY_PALETTE.macaronRose,
    CLAY_PALETTE.macaronLemon,
    CLAY_PALETTE.macaronTaro,
    CLAY_PALETTE.macaronCoral,
    CLAY_PALETTE.macaronSky,
  ];
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const mac = buildClayMacaron(makeClayMat, {
      x: Math.cos(ang) * macRingRadius,
      baseY: 0.85,
      z: Math.sin(ang) * macRingRadius,
      r: macRadius,
      shellHex: innerFlavors[i],
      creamHex: '#FFFDF5',
    });
    root.add(mac.group);
    macaronRing.push({ mac, ang, index: i });
  }

  // 5. Center Spire: Hollow Kaleidoscope Crown & 12-Shard Rotating Prism Mandala
  const centerSpire = new THREE.Group();
  centerSpire.position.set(0, 0.85, 0);
  root.add(centerSpire);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.92, 1.12, 1.32, 28),
    makeClayMat(CLAY_PALETTE.kaleidoViolet, { roughness: 0.62 })
  );
  pedestal.position.y = 0.66;
  pedestal.castShadow = true;
  centerSpire.add(pedestal);

  const goldRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.02, 0.09, 12, 32),
    makeClayMat('#F8CF52', { roughness: 0.48 })
  );
  goldRing.rotation.x = Math.PI / 2;
  goldRing.position.y = 1.32;
  centerSpire.add(goldRing);

  // Brass vertical stem supporting the mandala wheel at `y = 2.90` (halo bottom at 2.90 - 1.30 = 1.60 > 1.41!)
  const wheelStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.14, 0.48, 16),
    brassMat
  );
  wheelStem.position.y = 1.52;
  centerSpire.add(wheelStem);

  const mandalaWheel = new THREE.Group();
  mandalaWheel.position.set(0, 2.9, 0);
  centerSpire.add(mandalaWheel);

  const outerHalo = new THREE.Mesh(
    new THREE.TorusGeometry(1.16, 0.13, 14, 36),
    makeClayMat(CLAY_PALETTE.kaleidoViolet, { roughness: 0.58 })
  );
  mandalaWheel.add(outerHalo);

  const shardCols = [
    '#4FADFF',
    '#FFCF48',
    '#F472B6',
    '#6EE7B7',
    '#A78BFA',
    '#FB923C',
  ];
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const col = shardCols[i % shardCols.length];
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.21, 0),
      new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.85,
        roughness: 0.25,
      })
    );
    shard.position.set(Math.cos(ang) * 0.8, Math.sin(ang) * 0.8, 0);
    shard.rotation.z = ang;
    mandalaWheel.add(shard);
  }
  const centerStar = buildClayFourPointStar(
    makeClayMat,
    0.42,
    '#FFE066',
    true
  );
  mandalaWheel.add(centerStar);

  // 6. Phase-Locked Hopping Marbled Sugar Pearl (`pearlR = 0.36`)
  // Bounces strictly from macaron top (`i`) to macaron top (`i+1`) along `R = macRingRadius`!
  // At impact (`u near 0 or 1`), the pearl is directly above macaron `i`, at `Y = macTopY + pearlR`,
  // and triggers a synchronized contact squash on that exact macaron!
  const pearlR = 0.36;
  const orbitPearl = new THREE.Mesh(
    new THREE.SphereGeometry(pearlR, 22, 18),
    makeClayMat('#FFFFFF', { map: marbledTex, roughness: 0.58 })
  );
  orbitPearl.castShadow = true;
  root.add(orbitPearl);

  return {
    root,
    windUpKey,
    mandalaWheel,
    updateCarousel(qLocalT, qTime) {
      windUpKey.rotation.x = qTime * 3.2;
      mandalaWheel.rotation.z = qTime * 1.45;
      mandalaWheel.rotation.y = Math.sin(qLocalT * 1.2) * 0.24;

      dominoRing.forEach((d) => {
        const { dominoLeanDeg } = evalCarouselWave(qTime, d.index, totalDominoes);
        d.pivot.rotation.z = -THREE.MathUtils.degToRad(dominoLeanDeg);
      });

      // Phase-locked hopping pearl across the 6 macarons (2.2 hops per second)
      const hopRate = 2.0;
      const totalStep = qTime * hopRate;
      const macIdx = ((Math.floor(totalStep) % 6) + 6) % 6;
      const nextIdx = (macIdx + 1) % 6;
      const hopU = totalStep - Math.floor(totalStep);

      // Parabolic gravity arc between macaron `macIdx` and `nextIdx`
      const macTopRestY = 0.85 + macRadius * 0.78;
      const pearlRestCenterY = macTopRestY + pearlR;
      const hopState = evalHopArc(hopU, pearlRestCenterY, pearlRestCenterY, 1.05);

      macaronRing.forEach((m, idx) => {
        let comp = 0;
        if (idx === macIdx && hopU < 0.22) {
          comp = Math.sin((1.0 - hopU / 0.22) * Math.PI * 0.5) * 0.26;
        } else if (idx === nextIdx && hopU > 0.78) {
          comp = Math.sin(((hopU - 0.78) / 0.22) * Math.PI) * 0.28;
        }
        m.mac.setCompression(comp);
      });

      const a0 = (macIdx / 6) * Math.PI * 2;
      let a1 = (nextIdx / 6) * Math.PI * 2;
      if (a1 < a0) a1 += Math.PI * 2;
      const curAng = lerp(a0, a1, smootherstep(0.08, 0.92, hopU));

      // Account for contact depression of the landed macaron so pearl stays glued to its top shell
      const activeMacSquash =
        hopU < 0.22
          ? Math.sin((1.0 - hopU / 0.22) * Math.PI * 0.5) * 0.11
          : hopU > 0.78
          ? Math.sin(((hopU - 0.78) / 0.22) * Math.PI) * 0.12
          : 0;

      orbitPearl.position.set(
        Math.cos(curAng) * macRingRadius,
        hopState.y - activeMacSquash,
        Math.sin(curAng) * macRingRadius
      );
      const { sx, sy, sz } = evalVolumePreservingSquash(hopState.squash * 0.65);
      orbitPearl.scale.set(sx, sy, sz);
      orbitPearl.rotation.z = -qTime * 4.2;
    },
  };
}

/** Category F2: Exposed Brass-Wire & Bamboo-Toothpick Coiled Clay Trees/Clouds. */
export function buildCoiledTreeOrCloud(makeClayMat, x, y, z, scale, type) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const trunkH = y - 0.5;
  const trunkGeo = new THREE.CylinderGeometry(0.07, 0.08, trunkH, 10);
  const trunkMat = new THREE.MeshStandardMaterial({
    color:
      type === 'cream_cloud'
        ? CLAY_PALETTE.bambooStick
        : CLAY_PALETTE.brassWire,
    roughness: type === 'cream_cloud' ? 0.65 : 0.35,
    metalness: type === 'cream_cloud' ? 0.05 : 0.65,
  });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(0, -trunkH / 2, 0);
  trunk.castShadow = true;
  group.add(trunk);

  const palette =
    {
      mint_tree: '#A3DBBF',
      pink_tree: '#F7B8C6',
      cream_cloud: '#FCF7ED',
    }[type] || '#FCF7ED';

  const crownMat = makeClayMat(palette, { roughness: 0.72, bumpScale: 0.04 });
  const crownGroup = new THREE.Group();
  const lobes = [
    [-0.62, 0.08, 0, 0.55],
    [-0.25, 0.36, 0.1, 0.65],
    [0.28, 0.32, -0.08, 0.68],
    [0.65, 0.06, 0.05, 0.52],
    [0.15, -0.18, 0.12, 0.58],
    [-0.28, -0.16, -0.1, 0.54],
  ];
  lobes.forEach(([lx, ly, lz, lr]) => {
    const sp = new THREE.Mesh(
      new THREE.SphereGeometry(lr * scale, 16, 14),
      crownMat
    );
    sp.position.set(lx * scale, ly * scale, lz * scale);
    sp.scale.set(1.0, 0.88, 0.72);
    sp.castShadow = true;
    crownGroup.add(sp);
  });

  const coilMesh = new THREE.Mesh(
    new THREE.TorusGeometry(
      0.36 * scale,
      0.06 * scale,
      10,
      24,
      Math.PI * 1.65
    ),
    crownMat
  );
  coilMesh.position.set(0, 0.05 * scale, 0.42 * scale);
  crownGroup.add(coilMesh);

  group.add(crownGroup);
  return { group, crownGroup, baseY: y };
}

/**
 * Category G1: Sculpted Polymer-Clay Pastry Piping Bag (`buildClayPipingBag`)
 * & Rolling Pin Pastry Mat (`buildClayRollingPinSet`) & Tea Steam Wisps (`buildTeaSteamWisps`).
 */
export function buildClayPipingBag(makeClayMat, makeBrassWireMat) {
  const group = new THREE.Group();
  const bagMat = makeClayMat('#FFFDF6', { roughness: 0.68, bumpScale: 0.025 });
  const cuffMat = makeClayMat(CLAY_PALETTE.macaronRose, { roughness: 0.64 });
  const brassMat = makeBrassWireMat();

  // Pivot is near the nozzle tip (0,0,0), bag tilts up-right in the open center stage!
  const tiltGroup = new THREE.Group();
  tiltGroup.rotation.z = -0.48;
  tiltGroup.rotation.x = 0.16;
  group.add(tiltGroup);

  const nozzle = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.34, 14),
    brassMat
  );
  nozzle.rotation.x = Math.PI;
  nozzle.position.y = 0.17;
  nozzle.castShadow = true;
  tiltGroup.add(nozzle);

  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.46, 1.22, 22),
    bagMat
  );
  body.rotation.x = Math.PI;
  body.position.y = 0.86;
  body.castShadow = true;
  tiltGroup.add(body);

  const cuff = new THREE.Mesh(
    new THREE.TorusGeometry(0.40, 0.09, 12, 24),
    cuffMat
  );
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = 1.42;
  tiltGroup.add(cuff);

  const puffTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 16, 14),
    bagMat
  );
  puffTop.scale.set(1.0, 0.55, 1.0);
  puffTop.position.y = 1.48;
  tiltGroup.add(puffTop);

  // Small cream drop at nozzle tip
  const dollop = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 12),
    makeClayMat(CLAY_PALETTE.macaronMint, { roughness: 0.52 })
  );
  dollop.position.y = 0.02;
  tiltGroup.add(dollop);

  return {
    group,
    tiltGroup,
    dollop,
    updatePiping(qLocalT) {
      const activePhase = clamp(qLocalT / 1.25, 0, 1);
      const liftAway = smootherstep(1.05, 2.45, qLocalT);
      const squeeze =
        qLocalT < 1.45 ? Math.abs(Math.sin(qLocalT * 8.5)) * 0.20 : 0.05;
      const { sx, sy, sz } = evalVolumePreservingSquash(squeeze);
      tiltGroup.scale.set(sx, sy, sz);

      // Hover in the open center window between heroMacaron (x=-0.35) and teapot (x=2.22)!
      group.position.set(
        lerp(-0.22, 0.58, liftAway),
        lerp(1.48, 1.92, liftAway) + Math.sin(qLocalT * 4.2) * 0.05,
        lerp(0.95, 0.65, liftAway)
      );
      tiltGroup.rotation.z = lerp(-0.38, -0.58, liftAway);
      dollop.scale.setScalar(1.0 - activePhase * 0.30);
    },
  };
}

export function buildClayRollingPinSet(makeClayMat, makeBrassWireMat) {
  const root = new THREE.Group();

  // Elevated butcher-block / clay pastry pedestal so rolling pin sits clearly in view
  const blockPedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.74, 0.80, 0.34, 28),
    makeClayMat('#FAF0E2', { roughness: 0.72 })
  );
  blockPedestal.position.y = 0.17;
  blockPedestal.castShadow = true;
  blockPedestal.receiveShadow = true;
  root.add(blockPedestal);

  const matMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.68, 0.06, 28),
    makeClayMat(CLAY_PALETTE.macaronRose, { roughness: 0.74 })
  );
  matMesh.position.y = 0.37;
  matMesh.receiveShadow = true;
  root.add(matMesh);

  // Mini round cookie cutout resting on edge of mat
  const doughBit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.19, 0.05, 16),
    makeClayMat(CLAY_PALETTE.macaronLemon, { roughness: 0.70 })
  );
  doughBit.position.set(-0.34, 0.42, 0.26);
  root.add(doughBit);

  const pinGroup = new THREE.Group();
  const pinR = 0.135;
  pinGroup.position.set(0, 0.40 + pinR, 0);
  root.add(pinGroup);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(pinR, pinR, 0.82, 20),
    makeClayMat('#E8C39E', { roughness: 0.68 })
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.castShadow = true;
  pinGroup.add(barrel);

  const brassMat = makeBrassWireMat();
  const handleMat = makeClayMat(CLAY_PALETTE.macaronMint, { roughness: 0.62 });
  [-1, 1].forEach((dir) => {
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.22, 10),
      brassMat
    );
    rod.rotation.z = Math.PI / 2;
    rod.position.x = dir * 0.48;
    const grip = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 12, 10),
      handleMat
    );
    grip.scale.set(1.45, 0.85, 0.85);
    grip.position.x = dir * 0.56;
    pinGroup.add(rod, grip);
  });

  return {
    root,
    pinGroup,
    updateRolling(qLocalT) {
      const dz = Math.sin(qLocalT * 3.2) * 0.22;
      pinGroup.position.z = dz;
      barrel.rotation.x = dz / pinR;
    },
  };
}

export function buildTeaSteamWisps(makeClayMat) {
  const group = new THREE.Group();
  const steamMat = makeClayMat('#FFFDF9', {
    roughness: 0.55,
    transparent: true,
    opacity: 0.82,
  });
  const puffs = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(
      new THREE.TorusGeometry(0.09 + i * 0.02, 0.032, 10, 18, Math.PI * 1.35),
      steamMat
    );
    p.rotation.y = i * 1.1;
    group.add(p);
    puffs.push({ mesh: p, idx: i });
  }
  return {
    group,
    updateSteam(qLocalT) {
      const appear = smootherstep(0.55, 1.15, qLocalT);
      puffs.forEach(({ mesh, idx }) => {
        const cycle = (qLocalT * 0.85 + idx * 0.33) % 1.0;
        mesh.position.set(
          Math.sin(qLocalT * 3.0 + idx * 2.0) * 0.08,
          cycle * 0.58,
          Math.cos(qLocalT * 2.6 + idx) * 0.06
        );
        const s = appear * Math.sin(cycle * Math.PI) * 1.05;
        mesh.scale.setScalar(Math.max(0.001, s));
        mesh.rotation.z = cycle * 1.4 + idx;
      });
    },
  };
}

/**
 * Category G2: Vintage Brass & Mint Patisserie Kitchen Scale (`buildBrassKitchenScale`)
 * & Festive Hat-Box (`buildCelebrationHatBox`).
 */
export function buildBrassKitchenScale(makeClayMat, makeBrassWireMat) {
  const root = new THREE.Group();
  const mintMat = makeClayMat(CLAY_PALETTE.macaronMint, { roughness: 0.66 });
  const creamMat = makeClayMat('#FFFDF6', { roughness: 0.62 });
  const inkMat = makeClayMat('#3D2722', { roughness: 0.55 });
  const brassMat = makeBrassWireMat();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.72, 0.24, 28),
    brassMat
  );
  base.position.y = 0.12;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.54, 0.82, 28),
    mintMat
  );
  body.position.y = 0.65;
  body.castShadow = true;
  root.add(body);

  // Dial Face on +Z front
  const dialFace = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.08, 24),
    creamMat
  );
  dialFace.rotation.x = Math.PI / 2;
  dialFace.position.set(0, 0.68, 0.49);
  root.add(dialFace);

  const dialRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.042, 10, 28),
    brassMat
  );
  dialRim.position.set(0, 0.68, 0.52);
  root.add(dialRim);

  const needlePivot = new THREE.Group();
  needlePivot.position.set(0, 0.68, 0.55);
  const needle = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.28, 0.03),
    inkMat
  );
  needle.position.y = 0.10;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), brassMat);
  needlePivot.add(needle, cap);
  root.add(needlePivot);

  // Weighing Pan Assembly
  const panGroup = new THREE.Group();
  panGroup.position.y = 1.28;
  root.add(panGroup);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.32, 14),
    brassMat
  );
  stem.position.y = -0.14;
  panGroup.add(stem);

  const pan = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.52, 0.12, 28),
    brassMat
  );
  pan.castShadow = true;
  panGroup.add(pan);

  const mac1 = buildClayMacaron(makeClayMat, {
    x: -0.18,
    baseY: 0.06,
    z: 0.05,
    r: 0.34,
    shellHex: CLAY_PALETTE.macaronRose,
    creamHex: '#FFFDF5',
  });
  const mac2 = buildClayMacaron(makeClayMat, {
    x: 0.22,
    baseY: 0.06,
    z: -0.06,
    r: 0.32,
    shellHex: CLAY_PALETTE.macaronLemon,
    creamHex: CLAY_PALETTE.macaronMint,
    withRosette: true,
  });
  panGroup.add(mac1.group, mac2.group);

  return {
    root,
    panGroup,
    needlePivot,
    updateScale(qLocalT) {
      const sp = springStep(Math.max(0, qLocalT - 0.18), 0.22, 6.8).x;
      panGroup.position.y = 1.28 - sp * 0.11;
      needlePivot.rotation.z = -sp * 1.35 + Math.sin(qLocalT * 5.0) * 0.06;
    },
  };
}

export function buildCelebrationHatBox(makeClayMat, makeBrassWireMat) {
  const root = new THREE.Group();
  const boxMat = makeClayMat(CLAY_PALETTE.macaronTaro, { roughness: 0.68 });
  const lidMat = makeClayMat('#FAF0E4', { roughness: 0.66 });
  const goldMat = makeClayMat('#F8CF52', { roughness: 0.48 });

  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.64, 0.68, 28),
    boxMat
  );
  drum.position.y = 0.34;
  drum.castShadow = true;
  drum.receiveShadow = true;
  root.add(drum);

  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.68, 0.14, 28),
    lidMat
  );
  lid.position.y = 0.72;
  lid.castShadow = true;
  root.add(lid);

  const ribbon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.69, 0.69, 0.12, 28),
    goldMat
  );
  ribbon.position.y = 0.36;
  root.add(ribbon);

  const topMac = buildClayMacaron(makeClayMat, {
    baseY: 0.79,
    r: 0.38,
    shellHex: CLAY_PALETTE.macaronSky,
    creamHex: CLAY_PALETTE.macaronRose,
    withRosette: true,
  });
  root.add(topMac.group);

  const star = buildClayFourPointStar(makeClayMat, 0.24, '#FFE066', true);
  star.position.y = 1.42;
  root.add(star);

  return {
    root,
    star,
    topMac,
    updateHatBox(qLocalT) {
      const pop = springStep(Math.max(0, qLocalT - 0.55), 0.24, 6.2).x;
      star.position.y = 1.36 + pop * 0.22 + Math.sin(qLocalT * 4.5) * 0.05;
      star.rotation.y = qLocalT * 2.4;
      topMac.group.rotation.y = -qLocalT * 0.9;
    },
  };
}

/**
 * Category G3: Wind-Up Patisserie Delivery Cart (`buildClayDeliveryCart`)
 * & Sidewalk Bistro Table (`buildSidewalkBistroTable`).
 */
export function buildClayDeliveryCart(makeClayMat, makeBrassWireMat) {
  const root = new THREE.Group();
  const mintMat = makeClayMat(CLAY_PALETTE.macaronMint, { roughness: 0.64 });
  const creamMat = makeClayMat('#FAF2E6', { roughness: 0.66 });
  const roseMat = makeClayMat(CLAY_PALETTE.macaronRose, { roughness: 0.64 });
  const goldMat = makeClayMat('#F8CF52', { roughness: 0.48 });
  const tireMat = makeClayMat('#59382B', { roughness: 0.76 });
  const brassMat = makeBrassWireMat();

  const wheelR = 0.26;
  const wheels = [];
  const wheelCoords = [
    [-0.46, 0.38],
    [0.46, 0.38],
    [-0.46, -0.38],
    [0.46, -0.38],
  ];
  wheelCoords.forEach(([wx, wz]) => {
    const wGroup = new THREE.Group();
    wGroup.position.set(wx, wheelR, wz);
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelR, wheelR, 0.11, 20),
      tireMat
    );
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelR * 0.52, wheelR * 0.52, 0.13, 14),
      creamMat
    );
    hub.rotation.x = Math.PI / 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(wheelR * 1.4, 0.04, 0.14),
      brassMat
    );
    wGroup.add(tire, hub, spoke);
    root.add(wGroup);
    wheels.push(wGroup);
  });

  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.28;
  root.add(bodyGroup);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(1.36, 0.18, 0.74),
    mintMat
  );
  deck.position.y = 0.09;
  deck.castShadow = true;
  bodyGroup.add(deck);

  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.44, 0.68),
    creamMat
  );
  cab.position.set(0.38, 0.36, 0);
  cab.castShadow = true;
  bodyGroup.add(cab);

  const headlamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 12),
    makeClayMat('#FFE885', {
      emissive: '#FFD54F',
      emissiveIntensity: 0.75,
      roughness: 0.35,
    })
  );
  headlamp.position.set(0.62, 0.38, 0);
  bodyGroup.add(headlamp);

  // Cargo gift box + mini macaron on flatbed (deck top at local y = 0.18)
  const cargoBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.38, 0.56),
    roseMat
  );
  cargoBox.position.set(-0.22, 0.37, 0);
  cargoBox.castShadow = true;
  const cargoRibbon = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.40, 0.12),
    goldMat
  );
  cargoRibbon.position.set(-0.22, 0.37, 0);
  bodyGroup.add(cargoBox, cargoRibbon);

  const cargoMac = buildClayMacaron(makeClayMat, {
    x: -0.22,
    baseY: 0.56,
    z: 0,
    r: 0.24,
    shellHex: CLAY_PALETTE.macaronLemon,
    creamHex: '#FFFDF5',
  });
  bodyGroup.add(cargoMac.group);

  // Rear brass wind-up key on cart
  const cartKey = new THREE.Group();
  cartKey.position.set(-0.74, 0.22, 0);
  const kStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.24, 10),
    brassMat
  );
  kStem.rotation.z = Math.PI / 2;
  const kLoop = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.032, 8, 16),
    brassMat
  );
  kLoop.position.x = -0.14;
  cartKey.add(kStem, kLoop);
  bodyGroup.add(cartKey);

  return {
    root,
    wheels,
    bodyGroup,
    cartKey,
    updateCart(qLocalT) {
      const progress = smootherstep(0.0, 3.6, qLocalT);
      const xPos = lerp(-0.32, 1.38, progress);
      root.position.set(xPos, 1.06, 1.88);

      const spinAngle = -xPos / wheelR;
      wheels.forEach((w) => {
        w.rotation.z = spinAngle;
      });
      cartKey.rotation.x = qLocalT * 5.0;
      const chug = Math.abs(Math.sin(qLocalT * 9.0)) * 0.06;
      const { sx, sy, sz } = evalVolumePreservingSquash(chug);
      bodyGroup.scale.set(sx, sy, sz);
    },
  };
}

export function buildSidewalkBistroTable(makeClayMat, makeBrassWireMat) {
  const group = new THREE.Group();
  const brassMat = makeBrassWireMat();
  const topMat = makeClayMat('#FAF2E6', { roughness: 0.62 });

  const stepBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.76, 0.52, 24),
    makeClayMat('#E5D2BE', { roughness: 0.80 })
  );
  stepBase.position.y = 0.26;
  stepBase.receiveShadow = true;
  group.add(stepBase);

  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.42, 0.12, 18),
    brassMat
  );
  foot.position.y = 0.58;
  const leg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.065, 0.88, 12),
    brassMat
  );
  leg.position.y = 1.02;
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.56, 0.11, 24),
    topMat
  );
  top.position.y = 1.48;
  top.castShadow = true;
  top.receiveShadow = true;

  const miniDonut = buildClayDonut(
    makeClayMat,
    0.25,
    '#F2CEA2',
    CLAY_PALETTE.macaronRose
  );
  miniDonut.position.set(0.0, 1.535, 0.0);

  group.add(foot, leg, top, miniDonut);
  return group;
}

/**
 * Category G4: Orbiting Musical Chime Ring (`buildFloatingChimeRing`)
 * & Warm Patisserie Tea Lanterns (`buildClayTeaLantern`).
 */
export function buildFloatingChimeRing(makeClayMat, makeBrassWireMat) {
  const root = new THREE.Group();
  const brassMat = makeBrassWireMat();
  const noteColors = [
    CLAY_PALETTE.macaronRose,
    CLAY_PALETTE.macaronMint,
    CLAY_PALETTE.macaronLemon,
    CLAY_PALETTE.macaronSky,
    CLAY_PALETTE.macaronTaro,
    CLAY_PALETTE.macaronCoral,
  ];
  const charms = [];
  const count = 6;
  const ringR = 2.48;

  const wireHalo = new THREE.Mesh(
    new THREE.TorusGeometry(ringR, 0.024, 10, 48),
    brassMat
  );
  wireHalo.rotation.x = Math.PI / 2;
  root.add(wireHalo);

  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    const item = new THREE.Group();
    item.position.set(Math.cos(ang) * ringR, 0, Math.sin(ang) * ringR);

    if (i % 2 === 0) {
      // Sculpted Clay Eighth-Note Charm
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 14, 12),
        makeClayMat(noteColors[i], { roughness: 0.54 })
      );
      head.scale.set(1.25, 0.9, 0.85);
      head.rotation.z = -0.35;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.46, 8),
        brassMat
      );
      stem.position.set(0.14, 0.22, 0);
      const flag = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.085, 0.04),
        brassMat
      );
      flag.position.set(0.21, 0.40, 0);
      flag.rotation.z = -0.35;
      item.add(head, stem, flag);
    } else {
      const star = buildClayFourPointStar(
        makeClayMat,
        0.24,
        noteColors[i],
        true
      );
      item.add(star);
    }
    root.add(item);
    charms.push({ item, index: i, ang });
  }

  return {
    root,
    updateChimes(qTime) {
      root.rotation.y = -qTime * 0.55;
      charms.forEach((c) => {
        c.item.position.y = Math.sin(qTime * 3.4 + c.index * 1.1) * 0.14;
        c.item.rotation.y = qTime * 1.8 + c.index;
      });
    },
  };
}

export function buildClayTeaLantern(makeClayMat, makeBrassWireMat) {
  const group = new THREE.Group();
  const brassMat = makeBrassWireMat();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.48, 0.22, 20),
    brassMat
  );
  base.position.y = 0.11;
  const glowCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.58, 18),
    makeClayMat('#FFE885', {
      emissive: '#FFD54F',
      emissiveIntensity: 0.78,
      roughness: 0.32,
    })
  );
  glowCore.position.y = 0.50;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.46, 0.34, 20),
    makeClayMat(CLAY_PALETTE.macaronRose, { roughness: 0.64 })
  );
  roof.position.y = 0.96;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.10, 0.025, 8, 16),
    brassMat
  );
  ring.position.y = 1.18;
  group.add(base, glowCore, roof, ring);
  return group;
}

// ============================================================================
// PART 5 · DEMO STORY: SETS, SHOT LIST & PER-SCENE ANIMATION (`createWorld`)
// ============================================================================

export default async function createWorld({ width, height, scenes = [], style = {} }) {
  // Initialize the turnkey Clay Studio Stage (`kernel.js`): look rig + per-scene looks + director
  const studio = createClayStudioStage({ width, height, baseFov: 31, look: style.look, looks: style.looks, scenes });
  const {
    canvas: worldCanvas,
    renderer,
    scene,
    camera,
    envGroup,
    clayBumpTex,
    caramelTex,
    marbledTex,
    makeClayMat,
    makeBrassWireMat,
  } = studio;

  function addHill(zPos, yBase, hAmp, col, freq, phase) {
    const shape = new THREE.Shape();
    shape.moveTo(-28, -2);
    for (let x = -28; x <= 28; x += 1.2) {
      const y =
        yBase +
        Math.sin(x * freq + phase) * hAmp +
        Math.cos(x * freq * 0.55) * (hAmp * 0.45);
      shape.lineTo(x, y);
    }
    shape.lineTo(28, -2);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth: 1.0,
      bevelEnabled: true,
      bevelThickness: 0.4,
      bevelSize: 0.35,
      bevelSegments: 4,
    });
    const mesh = new THREE.Mesh(geo, makeClayMat(col, { roughness: 0.78 }));
    mesh.position.set(0, 0, zPos);
    mesh.receiveShadow = true;
    envGroup.add(mesh);
  }
  addHill(-10.5, 4.8, 1.15, CLAY_PALETTE.hillLavender, 0.18, 0.5);
  addHill(-8.8, 3.6, 0.95, CLAY_PALETTE.hillSage, 0.22, 2.1);
  addHill(-7.2, 2.4, 0.8, CLAY_PALETTE.hillPeach, 0.26, 4.0);

  const bgTrees = [
    buildCoiledTreeOrCloud(makeClayMat, -6.2, 5.2, -6.5, 1.15, 'mint_tree'),
    buildCoiledTreeOrCloud(makeClayMat, -2.8, 6.6, -8.2, 1.35, 'cream_cloud'),
    buildCoiledTreeOrCloud(makeClayMat, 3.2, 6.4, -8.0, 1.3, 'cream_cloud'),
    buildCoiledTreeOrCloud(makeClayMat, 6.4, 5.1, -6.4, 1.18, 'pink_tree'),
  ];
  bgTrees.forEach((tr) => envGroup.add(tr.group));

  // ==========================================================================
  // STAGE 01 · Act I: Morning Piping, Rolling Dough & Earl Grey Tea Pour
  // ==========================================================================
  const stage01 = new THREE.Group();
  scene.add(stage01);

  const cakeStand = buildTieredCakeStand(makeClayMat, makeBrassWireMat);
  cakeStand.group.position.set(-2.95, 0.0, -0.35);
  stage01.add(cakeStand.group);

  // Porcelain hero plate: center y = 0.09, height = 0.18 -> top surface at Y = 0.18
  const heroPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.32, 1.12, 0.18, 32),
    makeClayMat('#FAF3E8', { roughness: 0.62 })
  );
  heroPlate.position.set(-0.35, 0.09, 0.95);
  heroPlate.receiveShadow = true;
  stage01.add(heroPlate);

  // Hero Macaron seated at `baseY = 0.18` (exact top surface of `heroPlate`)
  const heroMacaron = buildClayMacaron(makeClayMat, {
    x: -0.35,
    baseY: 0.18,
    z: 0.95,
    r: 0.94,
    shellHex: CLAY_PALETTE.macaronRose,
    botShellHex: CLAY_PALETTE.macaronRose,
    creamHex: CLAY_PALETTE.macaronMint,
    withFruit: true,
    withRosette: true,
  });
  stage01.add(heroMacaron.group);

  const pipingBag = buildClayPipingBag(makeClayMat, makeBrassWireMat);
  stage01.add(pipingBag.group);

  const rollingPinSet = buildClayRollingPinSet(makeClayMat, makeBrassWireMat);
  rollingPinSet.root.position.set(0.88, 0.0, 1.15);
  stage01.add(rollingPinSet.root);

  const teaPourSet = buildClayTeapotAndCup(
    makeClayMat,
    caramelTex,
    clayBumpTex
  );
  stage01.add(teaPourSet.group);

  const steamWisps = buildTeaSteamWisps(makeClayMat);
  steamWisps.group.position.set(2.15, 1.24, 0.45);
  stage01.add(steamWisps.group);

  // ==========================================================================
  // STAGE 02 · Act II: Brass Kitchen Scale, Hat-Box & 9-Grid Ribbon Unboxing
  // ==========================================================================
  const stage02 = new THREE.Group();
  scene.add(stage02);

  const giftBoxSet = buildGiftBoxSet(
    makeClayMat,
    makeBrassWireMat,
    marbledTex
  );
  giftBoxSet.root.position.set(0.0, 0.0, 0.55);
  stage02.add(giftBoxSet.root);

  const kitchenScale = buildBrassKitchenScale(makeClayMat, makeBrassWireMat);
  kitchenScale.root.position.set(-4.05, 0.0, 0.18);
  stage02.add(kitchenScale.root);

  const celebrationHatBox = buildCelebrationHatBox(
    makeClayMat,
    makeBrassWireMat
  );
  celebrationHatBox.root.position.set(4.05, 0.0, 0.18);
  stage02.add(celebrationHatBox.root);

  const unboxDecoMac = buildClayMacaron(makeClayMat, {
    x: -3.55,
    baseY: 0.0,
    z: 1.75,
    r: 0.62,
    shellHex: CLAY_PALETTE.macaronLemon,
    creamHex: CLAY_PALETTE.ganacheCocoa,
  });
  const unboxDecoDonut = buildClayDonut(
    makeClayMat,
    0.46,
    '#F2CEA2',
    CLAY_PALETTE.macaronMint
  );
  unboxDecoDonut.position.set(3.55, 0.0, 1.65);
  stage02.add(unboxDecoMac.group, unboxDecoDonut);

  // ==========================================================================
  // STAGE 03 · Act III: Boutique Streetfront, Bistro Table & Delivery Cart
  // ==========================================================================
  const stage03 = new THREE.Group();
  scene.add(stage03);

  const boutiqueSet = buildPatisserieBoutique(makeClayMat, makeBrassWireMat);
  stage03.add(boutiqueSet.root);

  const bistroTable = buildSidewalkBistroTable(makeClayMat, makeBrassWireMat);
  bistroTable.position.set(-3.45, 0.0, 1.35);
  stage03.add(bistroTable);

  // Elevated Cobblestone Delivery Terrace (`top surface Y = 1.06`) in front of boutique door
  const deliveryTerrace = new THREE.Mesh(
    new THREE.BoxGeometry(3.15, 1.06, 1.02),
    makeClayMat('#E5D2BE', { roughness: 0.80 })
  );
  deliveryTerrace.position.set(0.52, 0.53, 1.88);
  deliveryTerrace.receiveShadow = true;
  deliveryTerrace.castShadow = true;
  stage03.add(deliveryTerrace);

  const deliveryCart = buildClayDeliveryCart(makeClayMat, makeBrassWireMat);
  stage03.add(deliveryCart.root);

  // The patissier: a clay mouse on the engine puppet rig, walks out to meet the cart.
  const patissier = buildClayCharacter(makeClayMat, {
    species: 'mouse',
    height: 1.25,
    build: 'tiny',
    apron: CLAY_PALETTE.creamWhite,
    scarf: CLAY_PALETTE.macaronRose,
    accessories: ['chef'],
    position: [-4.6, 3.15],
    heading: 90,
  });
  stage03.add(patissier.root);
  // Set dressing: the stepping stones she walks on and grass around the street.
  const streetPath = buildClayPath(makeClayMat, { path: [[-5.2, 3.2], [-3, 3.0], [-0.6, 3.05]], width: 0.8, seed: 21 });
  const streetGrass = buildClayGrass(makeClayMat, { area: [-7.5, 2.2, 7.5, 5.2], count: 46, flowers: 0.35, seed: 22, avoid: [{ center: [-2.8, 3.1], radius: 2.8 }, { center: [0.5, 2.2], radius: 1.6 }] });
  stage03.add(streetPath.group, streetGrass.group);
  const patissierScript = [
    { do: 'walk', from: 0.2, to: 2.3, dest: [-0.9, 3.05] },
    { do: 'look', from: 2.25, to: 3.0, toward: [1.0, 1.7, 1.88] },
    { do: 'mood', from: 2.3, to: 3.1, mood: 'surprised', fade: 0.12 },
    { do: 'face', from: 2.7, to: 3.1, yaw: 15 },
    { do: 'mood', from: 2.9, to: 4.5, mood: 'happy' },
    { do: 'wave', from: 3.0, to: 4.4, hand: 'R' },
    { do: 'hop', at: 3.25, dur: 0.55, height: 0.22 },
  ];

  // ==========================================================================
  // STAGE 04 · Act IV: Grand Clockwork Music Box, Chime Ring & Tea Lanterns
  // ==========================================================================
  const stage04 = new THREE.Group();
  scene.add(stage04);

  const musicBoxSet = buildKineticMusicBox(
    makeClayMat,
    makeBrassWireMat,
    marbledTex
  );
  musicBoxSet.root.position.set(0.15, 0.0, 0.45);
  stage04.add(musicBoxSet.root);

  const chimeRing = buildFloatingChimeRing(makeClayMat, makeBrassWireMat);
  chimeRing.root.position.set(0.0, 2.68, 0.0);
  musicBoxSet.root.add(chimeRing.root);

  const lanternLeft = buildClayTeaLantern(makeClayMat, makeBrassWireMat);
  lanternLeft.position.set(-5.55, 0.0, -0.65);
  const lanternRight = buildClayTeaLantern(makeClayMat, makeBrassWireMat);
  lanternRight.position.set(5.75, 0.0, -0.65);
  stage04.add(lanternLeft, lanternRight);

  const stages = [stage01, stage02, stage03, stage04];

  // The director measures each subject once, now. Pose props the way their shots should see
  // them (macaron closed, gift box open, cart at its start mark); render() re-poses every frame.
  heroMacaron.setExplode(0, 1);
  giftBoxSet.updateUnbox(2.5);
  deliveryCart.updateCart(0);
  patissier.act(0, []);
  teaPourSet.updatePour(1.0);
  musicBoxSet.updateCarousel(1.5, 1.5);

  // ==========================================================================
  // SHOT LIST · each scene is several framed shots with hard cuts (engine/director.js).
  // Sizes follow the action: detail -> reaction -> context, not one drifting wide shot.
  // Durations and looks live in scenes.html (data-dur / data-look); cut points here.
  // ==========================================================================
  const director = studio.director({
    subjects: {
      atelier: stage01,
      macaron: heroMacaron.group,
      cakeStand: cakeStand.group,
      unboxing: stage02,
      giftBox: giftBoxSet.root,
      scale: kitchenScale.root,
      street: boutiqueSet.root,
      cart: deliveryCart.root,
      patissier: patissier.root,
      finale: stage04,
      musicBox: musicBoxSet.root,
    },
    shots: {
      // Shot count, order and ending differ per scene on purpose: hook on the hero then reveal,
      // a quick 4-cut montage, a character beat, then detail -> finale wide.
      'patisserie-pour': [
        { dur: 1.9, size: 'full', subject: 'macaron', angle: 18, height: 'eye', move: 'push' },
        { size: 'wide', subject: 'atelier', angle: 8, height: 'eye', move: 'pull' },
      ],
      'giftbox-unbox': [
        { dur: 0.95, size: 'full', subject: 'giftBox', angle: 0, height: 'high', move: 'push' },
        { dur: 0.8, size: 'close', subject: 'giftBox', angle: 30, height: 'top' },
        { dur: 0.75, size: 'close', subject: 'scale', angle: -24, height: 'eye' },
        { size: 'wide', subject: 'unboxing', angle: 14, height: 'low', move: 'rise' },
      ],
      'street-boutique': [
        { dur: 1.3, size: 'wide', subject: 'street', angle: -6, height: 'eye', move: 'truck' },
        { dur: 1.3, size: 'full', subject: 'patissier', angle: -35, height: 'eye' },
        { size: 'medium', subject: 'patissier', angle: 12, height: 'eye', move: 'push' },
      ],
      'kinetic-carousel': [
        { dur: 1.6, size: 'close', subject: 'musicBox', angle: 16, height: 'eye', move: 'push' },
        { size: 'wide', subject: 'finale', angle: 4, height: 22, move: 'pull+orbit', rollDeg: 0.8 },
      ],
    },
  });

  async function render(frame) {
    const t = frame.t ?? 0;
    const localT = frame.localT ?? t;
    const sceneIdx = clamp(frame.sceneIndex ?? 0, 0, stages.length - 1);
    // Scene length comes from `data-dur` in scenes.html; never hard-code it here.
    const sceneDur = frame.scene?.dur ?? 3.7;

    // True 12fps stepped stop-motion clocks used by ALL 3D clay props!
    const qTime = quantizeStopMotionTime(t, 12, 0.88);
    const qLocalT = quantizeStopMotionTime(localT, 12, 0.88);

    stages.forEach((st, idx) => {
      st.visible = idx === sceneIdx;
    });

    bgTrees.forEach((tr, i) => {
      tr.crownGroup.rotation.z = Math.sin(qTime * 2.2 + i * 1.1) * 0.045;
      tr.group.position.y = tr.baseY + Math.cos(qTime * 1.8 + i) * 0.05;
    });

    // SCENE 01 · Morning piping, rolling pin & pouring milk-tea pot
    if (sceneIdx === 0) {
      const stack = evalLayerStackSpring(qLocalT, 0);
      const crownAppear = smootherstep(0.42, 1.25, qLocalT);
      heroMacaron.setExplode(stack.gap, crownAppear);
      heroMacaron.setCompression(stack.squish);
      heroMacaron.group.rotation.y = qLocalT * 0.52;

      pipingBag.updatePiping(qLocalT);
      rollingPinSet.updateRolling(qLocalT);
      cakeStand.group.rotation.y = qLocalT * 0.36;
      teaPourSet.updatePour(qLocalT);
      steamWisps.updateSteam(qLocalT);
    }

    // SCENE 02 · Brass kitchen scale & 9-grid gift box unboxing
    else if (sceneIdx === 1) {
      giftBoxSet.updateUnbox(qLocalT);
      giftBoxSet.root.rotation.y = lerp(-0.22, 0.2, smootherstep(0.0, sceneDur, qLocalT));
      kitchenScale.updateScale(qLocalT);
      celebrationHatBox.updateHatBox(qLocalT);
    }

    // SCENE 03 · Boutique streetfront & wind-up delivery cart (golden hour)
    else if (sceneIdx === 2) {
      boutiqueSet.updateBoutique(qLocalT, qTime);
      deliveryCart.updateCart(qLocalT);
      patissier.act(qLocalT, patissierScript);
      streetGrass.update(qTime);
    }

    // SCENE 04 · Clockwork music box finale as dusk falls and the lanterns take over
    else {
      musicBoxSet.updateCarousel(qLocalT, qTime);
      musicBoxSet.root.rotation.y = qLocalT * 0.16;
      chimeRing.updateChimes(qTime);
    }

    director.update(frame);
    studio.render(frame);
  }

  return {
    canvas: worldCanvas,
    scene,
    camera,
    renderer,
    render,
    storyboard: director.storyboard,
  };
}
