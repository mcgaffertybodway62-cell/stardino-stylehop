/**
 * Clay Macaron · Pure Visual & Physical Style Kernel (`styles/clay-macaron/kernel.js`).
 *
 * This module encapsulates ONLY the subject-agnostic medium laws of `clay-macaron`:
 *   1. Pastel Polymer-Clay & Burnished-Brass Color Tokens (`CLAY_PALETTE`)
 *   2. Procedural Tactile Textures (`createThumbprintBumpTexture`, `createMarbledClayTexture`, `createCaramelLatteTexture`)
 *   3. PBR Clay & Brass Material Factory (`createClayMaterialFactory`)
 *   4. Deterministic 12fps Stop-Motion Physics Primitives (`quantizeStopMotionTime`, `evalVolumePreservingSquash`, `evalHopArc`, `evalLayerStackSpring`, ...)
 *   5. Turnkey Sunlit Tabletop 3D Studio Stage (`createClayStudioStage`, built on `engine/studio3d.js`) + look profile (`CLAY_LOOK`)
 *   6. Clay characters on the engine puppet rig (`buildClayCharacter`, `engine/puppet.js`)
 *   7. Set dressing: `buildClayGround`, `buildClayWater`, `buildClayPath`, `buildClayGrass`, `buildClayRocks`, `buildClayTree`
 *
 * AI Authoring Rule:
 *   When creating a new video for any user topic in `clay-macaron` style, import this
 *   `kernel.js` + `../../engine/camera.js` inside `world.js`, and build bespoke 3D models
 *   and scenes tailored to the user's topic. Do NOT copy demo props from previous stories.
 */

import '../../engine/vendor/three.min.js';
import { clamp, lerp, smootherstep, springStep } from '../../engine/motion.js';
import { LOOK_DEFAULTS, LOOK_PRESETS, resolveLook } from '../../engine/look.js';
import { createStudio3D } from '../../engine/studio3d.js';
import { createPuppet } from '../../engine/puppet.js';

export const THREE = globalThis.THREE;

// ============================================================================
// 1. PALETTE TOKENS
// ============================================================================

export const CLAY_PALETTE = {
  deskBg: '#F6E9D7',
  deskSurface: '#F3E1CA',
  hillLavender: '#E6D7F2',
  hillSage: '#D4ECDD',
  hillPeach: '#FCE0D2',

  macaronRose: '#F5A3B8',
  macaronMint: '#9EDBC0',
  macaronLemon: '#FADC8C',
  macaronTaro: '#C8A8E9',
  macaronCoral: '#F79D84',
  macaronSky: '#98D4F2',

  creamWhite: '#FFFDF7',
  ganacheCocoa: '#59382B',
  strawberryRed: '#E34A6F',
  pistachioGreen: '#68B88E',
  terracotta: '#DE8C68',

  brassWire: '#C99B5E',
  bambooStick: '#E2C499',
  kaleidoViolet: '#A584E8',
};

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
// 2. STOP-MOTION PHYSICS PRIMITIVES
// ============================================================================

/**
 * Stepped Stop-Motion Clock (`quantizeStopMotionTime`).
 * Quantizes continuous time `t` to `fps` (default 12fps) with a high stepped blend (`0.88`).
 */
export function quantizeStopMotionTime(t, fps = 12, blend = 0.88) {
  const stepped = Math.floor(t * fps) / fps;
  return lerp(t, stepped, blend);
}

/**
 * Contact-Plane Volume-Preserving Squash & Stretch (`evalVolumePreservingSquash`).
 * Enforces $s_x \cdot s_y \cdot s_z = 1$ anchored at the bottom contact plane ($y = 0$).
 */
export function evalVolumePreservingSquash(compression) {
  const c = clamp(compression, -0.32, 0.38);
  const sy = Math.max(0.55, 1.0 - c);
  const invSqrt = 1.0 / Math.sqrt(sy);
  return {
    sx: invSqrt,
    sy,
    sz: invSqrt,
    creamBulge: 1.0 + Math.max(0, c) * 0.45,
  };
}

/**
 * Parabolic Ballistic Hop with Anticipation Squash & Landing Compression (`evalHopArc`).
 */
export function evalHopArc(u, y0 = 0, y1 = 0, apexHeight = 1.6) {
  const p = clamp(u, 0, 1);
  if (p < 0.12) {
    const prep = Math.sin((p / 0.12) * Math.PI);
    return { y: y0, squash: prep * 0.24, pitch: prep * 0.08 };
  }
  if (p > 0.86) {
    const land = Math.sin(((p - 0.86) / 0.14) * Math.PI);
    return { y: y1, squash: land * 0.28, pitch: -land * 0.08 };
  }
  const f = (p - 0.12) / 0.74;
  const baseLine = lerp(y0, y1, f);
  const arc = 4.0 * f * (1.0 - f) * apexHeight;
  const vy = 4.0 * (1.0 - 2.0 * f);
  const stretch = -Math.abs(vy) * 0.045;
  return {
    y: baseLine + arc,
    squash: stretch,
    pitch: clamp(vy * 0.09, -0.28, 0.28),
  };
}

/**
 * Staggered Layer Stack Assembly (`evalLayerStackSpring`).
 */
export function evalLayerStackSpring(qLocalT, staggerIndex = 0, staggerStep = 0.14) {
  const t = Math.max(0, qLocalT - staggerIndex * staggerStep);
  const closeProgress = clamp(t / 0.95, 0, 1);
  const s = springStep(closeProgress, 0.22, 6.2).x;
  const gap = Math.max(0, (1.0 - s) * 1.25);
  const snapWindow = Math.max(0, t - 0.62);
  const impactSquash =
    snapWindow > 0 && snapWindow < 0.85
      ? Math.exp(-4.8 * snapWindow) * Math.sin(snapWindow * 15.0) * 0.22
      : 0;
  return {
    gap,
    squish: Math.max(0, impactSquash),
  };
}

/**
 * Four-stage Hinged Unfold Choreography (`evalBoxUnfold`).
 */
export function evalBoxUnfold(qLocalT) {
  const prepPhase = clamp(qLocalT / 0.36, 0, 1);
  const boxSquash = qLocalT < 0.38 ? Math.sin(prepPhase * Math.PI) * 0.15 : 0;
  const untieProgress = smootherstep(0.22, 0.62, qLocalT);
  const lidSpring = springStep(Math.max(0, qLocalT - 0.42), 0.28, 5.6).x;
  const openAngleRad = clamp(lidSpring, 0, 1.12) * (Math.PI * 0.56);

  return {
    boxSquash,
    untieProgress,
    openAngleRad,
  };
}

/**
 * Spout-Pinned Parabolic Liquid Pouring (`evalPouringStream`).
 */
export function evalPouringStream(qLocalT) {
  const tiltProgress = smootherstep(0.12, 0.72, qLocalT);
  const potTiltRad = tiltProgress * 0.48;
  const streamExtend = smootherstep(0.32, 0.78, qLocalT);
  const streamRadiusScale =
    streamExtend * (0.92 + 0.08 * Math.sin(qLocalT * 14.0));
  const cupFillProgress = smootherstep(0.50, 3.25, qLocalT);
  const ripplePhase = Math.max(0, (qLocalT - 0.50) * 2.2);

  return {
    potTiltRad,
    streamExtend,
    streamRadiusScale,
    cupFillProgress,
    ripplePhase,
  };
}

/**
 * Asymmetric Harmonic Wave for Circular/Linear Arrays (`evalCarouselWave`).
 */
export function evalCarouselWave(qTime, index, totalCount) {
  const phase = (index / totalCount) * Math.PI * 2 - qTime * 2.8;
  const rawSin = Math.sin(phase);
  const shaped = Math.pow(0.5 + 0.5 * rawSin, 1.6);
  const dominoLeanDeg = 6.0 + shaped * 30.0;
  return { dominoLeanDeg };
}

// ============================================================================
// 3. PROCEDURAL CLAY TEXTURE & MATERIAL GENERATORS
// ============================================================================

export function createThumbprintBumpTexture(size = 512, seed = 73) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed);

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 24; i++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const maxR = 28 + rng() * 54;
    const angle = rng() * Math.PI;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(1.35, 0.85);

    for (let r = 5; r < maxR; r += 4.2) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle =
        (r / 4.2) % 2 < 1 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  for (let i = 0; i < 2600; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.8 + rng() * 2.2;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

export function createMarbledClayTexture(
  colors = ['#F5A3B8', '#FFFDF5', '#9EDBC0', '#FADC8C'],
  size = 512
) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, size, size);

  const bands = 24;
  for (let b = 0; b < bands; b++) {
    ctx.fillStyle = colors[b % colors.length];
    ctx.beginPath();
    const yBase = (b / bands) * size;
    ctx.moveTo(0, yBase);
    for (let x = 0; x <= size; x += 8) {
      const wave =
        Math.sin((x / size) * Math.PI * 4 + b * 0.7) * 20 +
        Math.cos((x / size) * Math.PI * 2 - b * 0.4) * 10;
      ctx.lineTo(x, yBase + wave);
    }
    ctx.lineTo(size, size);
    ctx.lineTo(0, size);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createCaramelLatteTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#D4884E');
  grad.addColorStop(0.5, '#C17138');
  grad.addColorStop(1, '#E09A63');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255, 248, 236, 0.72)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const yBase = (i + 0.5) * (size / 16);
    ctx.lineWidth = 6 + (i % 3) * 4;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const dy =
        Math.sin((x / size) * Math.PI * 4 + i * 0.9) * 14 +
        Math.cos((x / size) * Math.PI * 2 - i) * 7;
      if (x === 0) ctx.moveTo(x, yBase + dy);
      else ctx.lineTo(x, yBase + dy);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

export function createClayMaterialFactory(clayBumpTex) {
  function makeClayMat(hex, opts = {}) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      roughness: opts.roughness ?? 0.72,
      metalness: opts.metalness ?? 0.03,
      bumpMap: opts.bumpMap !== undefined ? opts.bumpMap : clayBumpTex,
      bumpScale: opts.bumpScale ?? 0.026,
      map: opts.map ?? null,
      emissive: opts.emissive
        ? new THREE.Color(opts.emissive)
        : new THREE.Color('#000000'),
      emissiveIntensity: opts.emissiveIntensity ?? 0.0,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1.0,
    });
  }

  function makeBrassWireMat() {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(CLAY_PALETTE.brassWire),
      roughness: 0.34,
      metalness: 0.62,
      bumpMap: clayBumpTex,
      bumpScale: 0.008,
    });
  }

  return { makeClayMat, makeBrassWireMat };
}

// ============================================================================
// 4. TURNKEY CLAY STUDIO STAGE & CAMERA RIG (`createClayStudioStage`)
// ============================================================================

// ============================================================================
// CLAY CHARACTERS (skin over the style-agnostic `engine/puppet.js`)
// ============================================================================

// Per species: colours, features, default build and head shape (x, y, z scale).
const SPECIES = {
  bear: { fur: '#C9844E', belly: '#F6E3C8', ears: 'round', nose: 'dot', tail: 'stub', build: 'round', head: [1.08, 0.95, 1] },
  bunny: { fur: '#F4EEE6', belly: '#FFFDF7', ears: 'long', inner: '#F5A3B8', nose: 'pink', tail: 'puff', teeth: true, build: 'pear', head: [0.95, 1.03, 0.98] },
  cat: { fur: '#F2B66D', belly: '#FFF3DF', ears: 'pointy', inner: '#F5A3B8', nose: 'pink', tail: 'long', whiskers: true, muzzle: 0.75, build: 'slim', head: [1.06, 0.92, 0.98] },
  fox: { fur: '#E58A4E', belly: '#FFF3DF', ears: 'tall', inner: '#59382B', nose: 'none', tail: 'bushy', snout: true, mask: true, build: 'slim', head: [1.0, 0.94, 0.95] },
  mouse: { fur: '#C8BCC4', belly: '#F6EEF0', ears: 'disc', inner: '#F5A3B8', nose: 'pink', tail: 'thin', whiskers: true, muzzle: 0.8, build: 'tiny', head: [1, 1, 1] },
  pig: { fur: '#F7B9C4', belly: '#FCD6DC', ears: 'flop', inner: '#F29AAA', nose: 'snout', tail: 'curly', build: 'chubby', head: [1.1, 0.94, 1] },
  panda: { fur: '#FBF7F0', belly: '#FFFFFF', ears: 'round', earColor: '#2E2A2B', limbs: '#2E2A2B', patches: '#2E2A2B', nose: 'dot', tail: 'stub', build: 'chubby', head: [1.08, 0.98, 1] },
  frog: { fur: '#8CCB7E', belly: '#E9F4C8', ears: 'none', nose: 'none', tail: 'none', topEyes: true, muzzle: 0, build: 'squat', head: [1.25, 0.8, 1] },
  chick: { fur: '#FADC6E', belly: '#FFF1B8', ears: 'none', nose: 'beak', tail: 'none', muzzle: 0, tuft: true, build: 'egg', head: [1, 1, 1] },
  kid: { fur: '#F6D2B8', belly: null, ears: 'small', nose: 'button', tail: 'none', muzzle: 0, hair: '#59382B', outfit: '#9EDBC0', pants: '#6E7FB8', build: 'kid', head: [1, 1.02, 1] },
};

// Builds change the silhouette, not just the scale: skeleton proportions, a lathe body profile
// (radius along the torso, bottom -> neck, as fractions of `body` width) and limb thickness.
// Shoulders and hips are then placed on that body's surface, so arms never sink into it.
const PROFILES = {
  bean: [[0, 0.2], [0.06, 0.62], [0.2, 0.9], [0.42, 1.0], [0.66, 0.9], [0.86, 0.62], [1, 0.26]],
  barrel: [[0, 0.24], [0.06, 0.7], [0.2, 0.94], [0.45, 1.0], [0.7, 0.92], [0.88, 0.64], [1, 0.26]],
  pear: [[0, 0.22], [0.06, 0.72], [0.22, 1.0], [0.45, 0.9], [0.7, 0.7], [0.88, 0.52], [1, 0.26]],
  slim: [[0, 0.2], [0.08, 0.58], [0.3, 0.8], [0.55, 0.82], [0.8, 0.7], [0.93, 0.5], [1, 0.26]],
  egg: [[0, 0.18], [0.08, 0.7], [0.3, 0.98], [0.5, 1.0], [0.75, 0.82], [0.92, 0.5], [1, 0.2]],
};
const BUILDS = {
  round: { proportions: { head: 0.4, legs: 0.2, arms: 0.3, shoulders: 0.34, hips: 0.2 }, body: 1, profile: 'bean', limb: 1 },
  chubby: { proportions: { head: 0.38, legs: 0.17, arms: 0.27, shoulders: 0.34, hips: 0.22 }, body: 1.28, profile: 'barrel', limb: 1.25 },
  slim: { proportions: { head: 0.36, legs: 0.27, arms: 0.33, shoulders: 0.34, hips: 0.16 }, body: 0.82, profile: 'slim', limb: 0.78 },
  tall: { proportions: { head: 0.3, legs: 0.33, arms: 0.36, shoulders: 0.34, hips: 0.18 }, body: 0.9, profile: 'slim', limb: 0.85 },
  tiny: { proportions: { head: 0.46, legs: 0.15, arms: 0.25, shoulders: 0.34, hips: 0.2 }, body: 1.0, profile: 'bean', limb: 0.92 },
  pear: { proportions: { head: 0.38, legs: 0.19, arms: 0.28, shoulders: 0.34, hips: 0.22 }, body: 1.12, profile: 'pear', limb: 0.95 },
  egg: { proportions: { head: 0.42, legs: 0.13, arms: 0.22, shoulders: 0.34, hips: 0.18 }, body: 1.15, profile: 'egg', limb: 0.7 },
  squat: { proportions: { head: 0.42, legs: 0.14, arms: 0.27, shoulders: 0.34, hips: 0.24 }, body: 1.2, profile: 'barrel', limb: 1.05 },
  kid: { proportions: { head: 0.34, legs: 0.29, arms: 0.33, shoulders: 0.34, hips: 0.17 }, body: 0.86, profile: 'slim', limb: 0.86 },
};

/** Lathe radius lookup for a profile: rAt(t) with t in [0, 1] bottom -> neck. */
function profileSampler(name) {
  const curve = new THREE.SplineCurve(PROFILES[name].map(([t, r]) => new THREE.Vector2(t, r)));
  const pts = curve.getPoints(48);
  return {
    pts,
    rAt(t) {
      const x = Math.max(0, Math.min(1, t));
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].x >= x) {
          const a = pts[i - 1];
          const b = pts[i];
          return a.y + ((b.y - a.y) * (x - a.x)) / Math.max(1e-6, b.x - a.x);
        }
      }
      return pts[pts.length - 1].y;
    },
  };
}

/**
 * Chibi polymer-clay character on an `engine/puppet.js` rig: ready to act (`walk`, `look`,
 * `wave`, `hug`, `hop`, `mood` ...) and to be framed by the director (`close` frames the
 * head, `medium` the upper body). Give every character its own silhouette and colours —
 * species, build, outfit and one or two accessories — so two characters never read alike.
 *
 *   const bear = buildClayCharacter(makeClayMat, {
 *     species: 'bear', build: 'chubby', scarf: CLAY_PALETTE.strawberryRed,
 *     accessories: ['beanie'], accent: CLAY_PALETTE.macaronSky, position: [-4, 2.5], heading: 90,
 *   });
 *   scene.add(bear.root);
 *   bear.act(qLocalT, [{ do: 'walk', from: 0.2, to: 2.2, dest: [0, 2] }, { do: 'mood', from: 2.2, to: 3.6, mood: 'happy' }]);
 *
 * For a fully bespoke character, call `createPuppet` yourself and hang your own clay meshes on
 * `puppet.joints` (sizes in `puppet.dims`; face parts in `puppet.parts`); it acts the same.
 *
 * @param {Function} makeClayMat
 * @param {object} [opts]
 * @param {'bear'|'bunny'|'cat'|'fox'|'mouse'|'pig'|'panda'|'frog'|'chick'|'kid'} [opts.species='bear']
 * @param {'round'|'chubby'|'slim'|'tall'|'tiny'|'pear'|'egg'|'squat'|'kid'} [opts.build]  default per species
 * @param {number} [opts.height=1.4]
 * @param {string} [opts.fur]      body colour (skin for `kid`)
 * @param {string} [opts.belly]    belly / muzzle colour
 * @param {string} [opts.limbs]    arm / leg colour (defaults to fur)
 * @param {string} [opts.outfit]   shirt colour (kid default; optional for animals)
 * @param {string} [opts.hair]     kid hair colour;  @param {'short'|'bob'|'pigtails'} [opts.hairStyle='short']
 * @param {'dot'|'big'|'sleepy'} [opts.eyes='dot']
 * @param {number} [opts.earScale=1]
 * @param {string} [opts.scarf]  @param {string} [opts.apron]
 * @param {Array<'beret'|'beanie'|'chef'|'straw'|'bow'|'flower'|'glasses'|'backpack'>} [opts.accessories]
 * @param {string} [opts.accent]   accessory colour
 * @param {'smile'|'flat'|'frown'|'open'} [opts.mouth='smile']  resting mouth
 * @param {number[]} [opts.position] [x, z];  @param {number} [opts.heading] degrees;  @param {number} [opts.ground]
 */
export function buildClayCharacter(makeClayMat, opts = {}) {
  const sp = SPECIES[opts.species] || SPECIES.bear;
  const build = BUILDS[opts.build || sp.build] || BUILDS.round;
  const puppet = createPuppet(THREE, {
    height: opts.height ?? 1.4,
    proportions: build.proportions,
    position: opts.position,
    heading: opts.heading,
    ground: opts.ground,
  });
  const { joints: j, dims: d } = puppet;
  const furHex = opts.fur || sp.fur;
  const fur = makeClayMat(furHex, { roughness: 0.78 });
  const bellyHex = opts.belly || sp.belly;
  const belly = bellyHex ? makeClayMat(bellyHex, { roughness: 0.74 }) : null;
  const limb = makeClayMat(opts.limbs || sp.limbs || furHex, { roughness: 0.78 });
  const outfitHex = opts.outfit || sp.outfit;
  const outfit = outfitHex ? makeClayMat(outfitHex, { roughness: 0.7 }) : null;
  const dark = makeClayMat('#2B1B17', { roughness: 0.28, bumpScale: 0.0 });
  const white = makeClayMat('#FFFDF7', { roughness: 0.3, bumpScale: 0.0 });
  const blush = makeClayMat('#F5A3B8', { roughness: 0.6 });
  const pink = makeClayMat('#E98AA0', { roughness: 0.5 });
  const accentHex = opts.accent || CLAY_PALETTE.macaronRose;
  const accent = makeClayMat(accentHex, { roughness: 0.66 });
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0, scale = null) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (scale) m.scale.set(...scale);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const sphere = (r, seg = 18) => new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.7)));

  // ---- Body: a lathe silhouette from just below the hips to the neck (shirt for outfits).
  const prof = profileSampler(build.profile);
  const R = d.shoulderWidth * 0.62 * build.body; // widest body radius
  const y0 = -d.legLength * 0.22; // body bottom, relative to the spine pivot (hips)
  const y1 = d.chestY + d.neckY; // neck
  const bodyH = y1 - y0;
  const tOf = (y) => (y - y0) / bodyH;
  const surf = (t) => prof.rAt(t) * R; // body radius at height fraction t
  const DEPTH = 0.86; // bodies are slightly flatter front-to-back
  const bodyMat = outfit || fur;
  const lathe = new THREE.LatheGeometry(
    [new THREE.Vector2(0, y0), ...prof.pts.map((p) => new THREE.Vector2(p.y * R, y0 + p.x * bodyH)), new THREE.Vector2(0, y1)],
    32
  );
  const bodyMesh = mesh(lathe, bodyMat, j.spine, 0, 0, 0, [1, 1, DEPTH]);
  puppet.parts.body = bodyMesh;
  if (belly && !outfit) {
    const tb = 0.38;
    mesh(sphere(1, 24), belly, j.spine, 0, y0 + tb * bodyH, surf(tb) * DEPTH * 0.62, [surf(tb) * 0.7, bodyH * 0.33, surf(tb) * DEPTH * 0.46]);
  }
  if (opts.apron) {
    const apron = makeClayMat(opts.apron, { roughness: 0.7 });
    apron.side = THREE.DoubleSide;
    mesh(new THREE.CylinderGeometry(surf(0.62) * 1.04, surf(0.12) * 1.06, bodyH * 0.55, 24, 1, true, -0.95, 1.9), apron, j.spine, 0, y0 + bodyH * 0.38, 0, [1, 1, DEPTH * 1.04]);
  }

  // Limb sizes per build; shoulders and hips sit on the body surface (arms hang just outside it).
  const armR = d.upperArm * 0.34 * build.limb;
  const legR = d.thigh * 0.55 * build.limb;
  const shoulderY = d.chestY + d.shoulderY;
  const shoulderX = surf(tOf(shoulderY)) + armR * 0.55;
  const hipX = Math.max(legR * 1.05, surf(0.12) * 0.48);
  j.shoulderL.position.x = shoulderX;
  j.shoulderR.position.x = -shoulderX;
  // Rest arm angle: tilt the arms out just enough that the hands clear the widest part of the
  // body (round / pear builds stand "arms slightly out", slim builds hang almost straight).
  const armLen = d.upperArm + d.foreArm;
  const clearNeed = R + armR * 1.3 - shoulderX;
  const restOut = Math.max(0.12, Math.asin(Math.min(0.85, Math.max(0, clearNeed / armLen))) * 1.08);
  j.shoulderL.rotation.z = restOut;
  j.shoulderR.rotation.z = -restOut;
  j.hipL.position.x = hipX;
  j.hipR.position.x = -hipX;
  puppet.captureRest();

  // ---- Head.
  const r = d.headDiameter / 2;
  const hc = d.headCenterY;
  const H = j.head;
  mesh(sphere(r, 32), fur, H, 0, hc, 0, sp.head || [1.06, 0.96, 1]);
  const muzzle = sp.muzzle ?? 1;
  let mouthY = hc - r * 0.36;
  let mouthZ = r * 0.95;
  if (sp.snout) {
    const snout = mesh(new THREE.ConeGeometry(r * 0.42, r * 0.9, 20), belly || fur, H, 0, hc - r * 0.22, r * 1.02, [1.15, 1, 0.85]);
    snout.rotation.x = Math.PI / 2;
    mesh(sphere(r * 0.12, 12), dark, H, 0, hc - r * 0.22, r * 1.46);
    if (sp.mask) {
      // White cheek mask sweeping up from the snout: reads as "fox" even head-on.
      for (const sx of [-1, 1]) {
        const ck = mesh(sphere(r * 0.38, 18), belly || fur, H, sx * r * 0.42, hc - r * 0.3, r * 0.7, [1.1, 0.75, 0.55]);
        ck.rotation.z = sx * 0.5;
      }
    }
    mouthY = hc - r * 0.42;
    mouthZ = r * 0.98;
  } else if (muzzle > 0) {
    mesh(sphere(r * 0.42 * muzzle, 20), belly || fur, H, 0, hc - r * 0.22, r * 0.8, [1.15, 0.82, 0.8]);
    mouthZ = r * (0.8 + 0.34 * muzzle);
  }
  if (sp.nose === 'dot') mesh(sphere(r * 0.13, 14), dark, H, 0, hc - r * 0.08, r * 1.12);
  else if (sp.nose === 'pink') mesh(sphere(r * 0.09, 12), pink, H, 0, hc - r * 0.1, r * (0.82 + 0.3 * muzzle), [1.3, 0.8, 0.8]);
  else if (sp.nose === 'snout') {
    const sn = mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.32, r * 0.22, 22), makeClayMat(sp.inner, { roughness: 0.6 }), H, 0, hc - r * 0.15, r * 0.98);
    sn.rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) mesh(sphere(r * 0.06, 10), dark, H, sx * r * 0.11, hc - r * 0.15, r * 1.09, [1, 1.3, 0.5]);
    mouthY = hc - r * 0.5;
  } else if (sp.nose === 'beak') {
    const beak = mesh(new THREE.ConeGeometry(r * 0.2, r * 0.38, 14), makeClayMat('#F29B4B', { roughness: 0.5 }), H, 0, hc - r * 0.12, r * 1.08);
    beak.rotation.x = Math.PI / 2;
  } else if (sp.nose === 'button') mesh(sphere(r * 0.08, 12), makeClayMat('#EDB49A', { roughness: 0.6 }), H, 0, hc - r * 0.08, r * 0.99);
  if (sp.patches) {
    const patch = makeClayMat(sp.patches, { roughness: 0.6 });
    for (const sx of [-1, 1]) {
      const pm = mesh(sphere(r * 0.24, 16), patch, H, sx * r * 0.37, hc + r * 0.08, r * 0.8, [0.9, 1.15, 0.5]);
      pm.rotation.z = sx * 0.5;
    }
  }

  // Eyes (registered for blinks and moods) and brows.
  const eyeStyle = opts.eyes || 'dot';
  const eyeY = sp.topEyes ? hc + r * 0.62 : hc + r * 0.12;
  const eyeX = sp.topEyes ? r * 0.42 : r * 0.36;
  const eyeZ = sp.topEyes ? r * 0.5 : r * 0.88;
  const eyes = [];
  for (const sx of [-1, 1]) {
    if (sp.topEyes) mesh(sphere(r * 0.3, 16), fur, H, sx * eyeX, eyeY - r * 0.05, eyeZ - r * 0.15);
    const eye = new THREE.Group();
    eye.position.set(sx * eyeX, eyeY, eyeZ);
    H.add(eye);
    if (eyeStyle === 'big' || sp.topEyes) {
      mesh(sphere(r * 0.19, 16), white, eye, 0, 0, 0, [1, 1.1, 0.55]);
      mesh(sphere(r * 0.12, 14), dark, eye, 0, -r * 0.02, r * 0.08, [1, 1.1, 0.6]);
      mesh(sphere(r * 0.035, 8), white, eye, r * 0.04, r * 0.03, r * 0.15);
    } else {
      mesh(sphere(r * 0.12, 14), dark, eye, 0, 0, 0, [0.9, 1.15, 0.6]);
    }
    if (eyeStyle === 'sleepy') eye.scale.y = 0.45;
    eyes.push(eye);
  }
  puppet.parts.eyes = eyes;
  const browMat = makeClayMat(sp.hair && opts.species === 'kid' ? opts.hair || sp.hair : '#3B2620', { roughness: 0.5, bumpScale: 0.0 });
  puppet.parts.brows = [1, -1].map((sx) => {
    const b = mesh(new THREE.CapsuleGeometry(r * 0.035, r * 0.2, 4, 8), browMat, H, sx * eyeX, eyeY + r * (eyeStyle === 'big' || sp.topEyes ? 0.3 : 0.24), eyeZ + r * 0.02);
    b.rotation.z = Math.PI / 2 - sx * 0.1; // inner ends slightly raised: a soft, friendly rest face
    return b;
  });
  for (const sx of [-1, 1]) mesh(sphere(r * 0.15, 12), blush, H, sx * r * 0.62, hc - r * 0.2, r * 0.72, [1, 0.6, 0.4]);

  // Mouths (one visible at a time, chosen by mood).
  if (sp.nose !== 'beak') {
    const mouthMat = dark;
    const arc = (flip) => {
      const m = mesh(new THREE.TorusGeometry(r * 0.1, r * 0.022, 6, 14, Math.PI), mouthMat, H, 0, mouthY, mouthZ);
      m.rotation.z = flip ? 0 : Math.PI;
      return m;
    };
    const grin = mesh(new THREE.TorusGeometry(r * 0.15, r * 0.032, 6, 16, Math.PI), mouthMat, H, 0, mouthY + r * 0.02, mouthZ);
    grin.rotation.z = Math.PI;
    puppet.parts.mouths = {
      smile: arc(false),
      grin,
      frown: arc(true),
      open: mesh(sphere(r * 0.09, 12), makeClayMat('#8C3A3A', { roughness: 0.4 }), H, 0, mouthY - r * 0.03, mouthZ, [1.1, 1.0, 0.45]),
      flat: (() => {
        const m = mesh(new THREE.CapsuleGeometry(r * 0.02, r * 0.12, 4, 6), mouthMat, H, 0, mouthY, mouthZ);
        m.rotation.z = Math.PI / 2;
        return m;
      })(),
    };
    if (sp.teeth) mesh(new THREE.BoxGeometry(r * 0.12, r * 0.1, r * 0.03), white, H, 0, mouthY - r * 0.1, mouthZ - r * 0.02);
    puppet.setRestMouth(opts.mouth || 'smile');
  }
  if (sp.whiskers) {
    for (const sx of [-1, 1]) {
      for (const k of [-1, 1]) {
        const w = mesh(new THREE.CylinderGeometry(r * 0.012, r * 0.012, r * 0.55, 5), dark, H, sx * r * 0.5, hc - r * 0.15 + k * r * 0.06, r * 0.9);
        w.rotation.z = Math.PI / 2 + sx * k * 0.15;
      }
    }
  }

  // Ears per species.
  const es = opts.earScale ?? 1;
  const earMat = sp.earColor ? makeClayMat(sp.earColor, { roughness: 0.7 }) : fur;
  const inner = makeClayMat(sp.inner || bellyHex || furHex, { roughness: 0.7 });
  for (const sx of [-1, 1]) {
    if (sp.ears === 'round') {
      mesh(sphere(r * 0.3 * es, 16), earMat, H, sx * r * 0.68, hc + r * 0.72, -r * 0.05, [1, 1, 0.6]);
      if (!sp.earColor) mesh(sphere(r * 0.17 * es, 12), inner, H, sx * r * 0.68, hc + r * 0.72, r * 0.1, [1, 1, 0.4]);
    } else if (sp.ears === 'long') {
      const ear = mesh(new THREE.CapsuleGeometry(r * 0.2, r * 1.0 * es, 6, 14), fur, H, sx * r * 0.36, hc + r * (0.75 + 0.5 * es), -r * 0.05, [1, 1, 0.55]);
      ear.rotation.z = -sx * 0.12;
      const inEar = mesh(new THREE.CapsuleGeometry(r * 0.11, r * 0.8 * es, 6, 12), inner, H, sx * r * 0.36, hc + r * (0.75 + 0.5 * es), r * 0.06, [1, 1, 0.4]);
      inEar.rotation.z = -sx * 0.12;
    } else if (sp.ears === 'pointy' || sp.ears === 'tall') {
      const tall = sp.ears === 'tall' ? 1.45 : 1;
      const ear = mesh(new THREE.ConeGeometry(r * 0.32, r * 0.62 * tall * es, 16), fur, H, sx * r * 0.55, hc + r * (0.82 + 0.12 * tall * es), 0, [1, 1, 0.55]);
      ear.rotation.z = -sx * 0.28;
      const inEar = mesh(new THREE.ConeGeometry(r * 0.18, r * 0.4 * tall * es, 12), inner, H, sx * r * 0.55, hc + r * (0.8 + 0.1 * tall * es), r * 0.1, [1, 1, 0.4]);
      inEar.rotation.z = -sx * 0.28;
    } else if (sp.ears === 'disc') {
      mesh(sphere(r * 0.66 * es, 20), fur, H, sx * r * 0.92, hc + r * 0.78, -r * 0.1, [1, 1, 0.24]);
      mesh(sphere(r * 0.46 * es, 16), inner, H, sx * r * 0.92, hc + r * 0.78, -r * 0.02, [1, 1, 0.18]);
    } else if (sp.ears === 'flop') {
      const ear = mesh(new THREE.ConeGeometry(r * 0.3 * es, r * 0.5 * es, 3), fur, H, sx * r * 0.6, hc + r * 0.72, r * 0.15, [1, 1, 0.45]);
      ear.rotation.set(0.5, 0, -sx * 0.6);
    } else if (sp.ears === 'small') {
      mesh(sphere(r * 0.14 * es, 12), fur, H, sx * r * 1.02, hc, 0, [0.5, 1, 0.8]);
    }
  }
  if (sp.tuft) {
    for (const k of [-1, 0, 1]) {
      const tf = mesh(new THREE.ConeGeometry(r * 0.08, r * 0.35, 8), fur, H, k * r * 0.12, hc + r * 1.05, 0);
      tf.rotation.z = -k * 0.35;
    }
  }
  if (opts.species === 'kid') {
    const hair = makeClayMat(opts.hair || sp.hair, { roughness: 0.62 });
    const style = opts.hairStyle || 'short';
    mesh(new THREE.SphereGeometry(r * 1.06, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, H, 0, hc + r * 0.02, -r * 0.04, [1.04, 1.05, 1.06]);
    mesh(sphere(r * 0.5, 16), hair, H, 0, hc + r * 0.62, r * 0.55, [1.6, 0.45, 0.6]); // fringe
    if (style === 'bob') mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.12, r * 0.9, 24, 1, true, Math.PI * 0.35, Math.PI * 1.3), hair, H, 0, hc - r * 0.15, 0).material.side = THREE.DoubleSide;
    if (style === 'pigtails') for (const sx of [-1, 1]) mesh(sphere(r * 0.3, 14), hair, H, sx * r * 1.0, hc + r * 0.1, -r * 0.3);
  }
  if (opts.scarf) {
    const scarf = makeClayMat(opts.scarf, { roughness: 0.66 });
    const neckR = surf(0.94) + r * 0.08;
    const ring = mesh(new THREE.TorusGeometry(neckR, r * 0.17, 12, 28), scarf, j.neck, 0, -r * 0.05, 0, [1, DEPTH, 1]);
    ring.rotation.x = Math.PI / 2;
    mesh(new THREE.CapsuleGeometry(r * 0.12, r * 0.45, 4, 10), scarf, j.neck, neckR * 0.45, -r * 0.42, surf(0.82) * DEPTH * 0.95);
  }

  // Accessories. Head-top pieces sit on a group lifted above top-mounted eyes (frog).
  const HG = new THREE.Group();
  HG.position.y = sp.topEyes ? r * 0.42 : 0;
  H.add(HG);
  for (const acc of opts.accessories || []) {
    if (acc === 'beret') {
      const b = mesh(sphere(r * 0.75, 22), accent, HG, -r * 0.15, hc + r * 0.88, 0, [1.1, 0.32, 1.1]);
      b.rotation.z = 0.25;
      mesh(sphere(r * 0.08, 8), accent, HG, -r * 0.1, hc + r * 1.1, 0);
    } else if (acc === 'beanie') {
      mesh(new THREE.SphereGeometry(r * 1.07, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), accent, HG, 0, hc + r * 0.06, 0);
      const cuff = mesh(new THREE.TorusGeometry(r * 0.86, r * 0.11, 10, 28), accent, HG, 0, hc + r * 0.42, 0);
      cuff.rotation.x = Math.PI / 2;
      mesh(sphere(r * 0.2, 12), white, HG, 0, hc + r * 1.12, 0);
    } else if (acc === 'chef') {
      mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.6, r * 0.5, 22), white, HG, 0, hc + r * 1.0, 0);
      mesh(sphere(r * 0.62, 20), white, HG, 0, hc + r * 1.38, 0, [1.15, 0.7, 1.15]);
    } else if (acc === 'straw') {
      const straw = makeClayMat(opts.accent || '#EBC774', { roughness: 0.8 });
      mesh(new THREE.CylinderGeometry(r * 1.55, r * 1.6, r * 0.07, 32), straw, HG, 0, hc + r * 0.72, 0);
      mesh(new THREE.CylinderGeometry(r * 0.66, r * 0.72, r * 0.42, 24), straw, HG, 0, hc + r * 0.95, 0);
      const band = mesh(new THREE.TorusGeometry(r * 0.71, r * 0.05, 8, 24), makeClayMat(CLAY_PALETTE.strawberryRed), HG, 0, hc + r * 0.8, 0);
      band.rotation.x = Math.PI / 2;
    } else if (acc === 'bow') {
      for (const sx of [-1, 1]) {
        const lobe = mesh(new THREE.ConeGeometry(r * 0.2, r * 0.36, 12), accent, HG, r * 0.55 + sx * r * 0.18, hc + r * 0.88, r * 0.1);
        lobe.rotation.z = (sx * Math.PI) / 2;
      }
      mesh(sphere(r * 0.09, 10), accent, HG, r * 0.55, hc + r * 0.88, r * 0.12);
    } else if (acc === 'flower') {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        mesh(sphere(r * 0.1, 10), accent, HG, r * 0.62 + Math.cos(a) * r * 0.12, hc + r * 0.8 + Math.sin(a) * r * 0.12, r * 0.3, [1, 1, 0.5]);
      }
      mesh(sphere(r * 0.07, 8), makeClayMat(CLAY_PALETTE.macaronLemon), HG, r * 0.62, hc + r * 0.8, r * 0.34);
    } else if (acc === 'glasses') {
      const frame = makeClayMat(opts.accent || '#59382B', { roughness: 0.4 });
      for (const sx of [-1, 1]) mesh(new THREE.TorusGeometry(r * 0.17, r * 0.025, 8, 20), frame, H, sx * eyeX, eyeY, eyeZ + r * 0.1);
      const bridge = mesh(new THREE.CapsuleGeometry(r * 0.02, r * 0.18, 4, 6), frame, H, 0, eyeY + r * 0.04, eyeZ + r * 0.1);
      bridge.rotation.z = Math.PI / 2;
    } else if (acc === 'backpack') {
      const back = surf(0.55) * DEPTH;
      mesh(new THREE.BoxGeometry(R * 1.05, bodyH * 0.5, R * 0.5), accent, j.spine, 0, y0 + bodyH * 0.58, -back - R * 0.18);
      mesh(sphere(R * 0.28, 12), accent, j.spine, 0, y0 + bodyH * 0.38, -back - R * 0.45, [1.2, 0.8, 0.6]);
    }
  }

  // ---- Limbs: two clay capsules per arm / leg so elbows and knees read when they bend.
  const sleeve = outfit || limb;
  const handMat = opts.species === 'kid' ? fur : belly || limb;
  const legMat = makeClayMat(opts.pants || sp.pants || opts.limbs || sp.limbs || furHex, { roughness: 0.76 });
  for (const side of ['L', 'R']) {
    mesh(new THREE.CapsuleGeometry(armR, d.upperArm * 0.7, 6, 14), sleeve, j[`shoulder${side}`], 0, -d.upperArm * 0.5, 0);
    mesh(new THREE.CapsuleGeometry(armR * 0.95, d.foreArm * 0.65, 6, 14), opts.species === 'kid' ? fur : limb, j[`elbow${side}`], 0, -d.foreArm * 0.5, 0);
    mesh(sphere(armR * 1.15, 14), handMat, j[`hand${side}`], 0, 0, 0);
    mesh(new THREE.CapsuleGeometry(legR, d.thigh * 0.5, 6, 14), legMat, j[`hip${side}`], 0, -d.thigh * 0.5, 0);
    mesh(new THREE.CapsuleGeometry(legR * 0.95, d.shin * 0.45, 6, 14), legMat, j[`knee${side}`], 0, -d.shin * 0.5, 0);
    const shoe = opts.species === 'kid' ? makeClayMat('#FFFDF7', { roughness: 0.6 }) : sp.nose === 'beak' ? makeClayMat('#F29B4B') : limb;
    mesh(sphere(legR * 1.25, 16), shoe, j[`foot${side}`], 0, legR * 0.55, legR * 0.45, [1, 0.6, 1.35]);
  }

  // ---- Tail (on the back surface of the body).
  const backZ = -surf(0.2) * DEPTH;
  const tailY = y0 + bodyH * 0.2;
  if (sp.tail === 'stub') mesh(sphere(R * 0.22, 12), limb, j.spine, 0, tailY, backZ);
  else if (sp.tail === 'puff') mesh(sphere(R * 0.32, 14), belly || fur, j.spine, 0, tailY, backZ);
  else if (sp.tail === 'long' || sp.tail === 'thin') {
    const thin = sp.tail === 'thin' ? 0.45 : 0.6;
    const tail = mesh(new THREE.TorusGeometry(R * 0.55, armR * thin, 8, 20, Math.PI * 0.9), fur, j.spine, 0, tailY + R * 0.15, backZ - R * 0.1);
    tail.rotation.y = Math.PI / 2;
  } else if (sp.tail === 'bushy') {
    const tail = mesh(new THREE.CapsuleGeometry(R * 0.3, R * 0.8, 6, 14), fur, j.spine, 0, tailY + R * 0.1, backZ - R * 0.3);
    tail.rotation.x = -0.9;
    mesh(sphere(R * 0.26, 12), white, j.spine, 0, tailY + R * 0.65, backZ - R * 0.7);
  } else if (sp.tail === 'curly') {
    const tail = mesh(new THREE.TorusGeometry(R * 0.14, armR * 0.35, 6, 14, Math.PI * 1.6), fur, j.spine, 0, tailY + R * 0.1, backZ - R * 0.05);
    tail.rotation.y = Math.PI / 2;
  }
  return puppet;
}

// ============================================================================
// CLAY SET DRESSING (ground, water, paths, plants) — dress wide shots with a world
// ============================================================================

function seeded(seed) {
  const rnd = mulberry32(seed);
  return (a = 0, b = 1) => a + (b - a) * rnd();
}

/** Smooth centre line through `[x, z]` points: `{ points, tangents, length }` sampled evenly. */
function sampleLine(path, step = 0.25) {
  const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const length = curve.getLength();
  const n = Math.max(2, Math.ceil(length / step));
  const points = curve.getSpacedPoints(n);
  const tangents = points.map((_, i) => curve.getTangentAt(i / n).setY(0).normalize());
  return { curve, points, tangents, length };
}

/** Flat ribbon geometry along a sampled line (y = 0, normals up), `width` across; `taper` rounds the ends. */
function ribbonGeometry(line, width, segmentsAcross = 4, taper = 0) {
  const pos = [];
  const uv = [];
  const idx = [];
  const cols = segmentsAcross + 1;
  line.points.forEach((p, i) => {
    const t = line.tangents[i];
    const nx = -t.z;
    const nz = t.x;
    const u = i / (line.points.length - 1);
    const end = Math.min(u, 1 - u) * line.length;
    const w = taper > 0 ? width * Math.max(0.15, Math.sqrt(Math.min(1, end / taper))) : width;
    for (let k = 0; k < cols; k++) {
      const a = (k / segmentsAcross - 0.5) * w;
      pos.push(p.x + nx * a, 0, p.z + nz * a);
      uv.push(k / segmentsAcross, i / (line.points.length - 1));
    }
  });
  for (let i = 0; i < line.points.length - 1; i++) {
    for (let k = 0; k < segmentsAcross; k++) {
      const a = i * cols + k;
      idx.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols); // counter-clockwise from above
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Irregular raised clay ground patch (a lawn, a clearing, a sandbank) so sets stop being a
 * flat disc on the desk. Top surface at `y + height`; put props there.
 * @param {object} [o] { center: [x,z], radius: 6, height: 0.14, color, wobble: 0.16, seed, y: 0 }
 */
export function buildClayGround(makeClayMat, o = {}) {
  const { center = [0, 0], radius = 6, height = 0.14, color = '#B5D9A2', wobble = 0.16, seed = 11, y = 0 } = o;
  const rnd = seeded(seed);
  const ph = [rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)];
  const shape = new THREE.Shape();
  const N = 72;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = radius * (1 + wobble * (0.55 * Math.sin(3 * a + ph[0]) + 0.3 * Math.sin(5 * a + ph[1]) + 0.15 * Math.sin(9 * a + ph[2])));
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelThickness: height * 0.6, bevelSize: Math.min(0.25, radius * 0.05), bevelSegments: 4, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2); // shape y -> -z, extrusion -> +y
  const mesh = new THREE.Mesh(geo, makeClayMat(color, { roughness: 0.86, bumpScale: 0.02 }));
  mesh.position.set(center[0], y - height * 0.4, center[1]);
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  // The bevel adds 0.6 * height above the extrusion; `top` is where props stand.
  return { group, top: y + height * 1.2, update() {} };
}

/**
 * Clay water: a stream along `path` ([x, z] points) or a round `pond`. Glossy wavy surface,
 * pebble banks, highlight streaks drifting downstream and ripple rings. `update(qTime)` animates.
 * @param {object} o { path: [[x,z],...], width: 1.6 } | { pond: { center: [x,z], radius } },
 *                   { color, bank, y: 0 (the ground top it lies on), seed, flow: 0.6 }
 */
export function buildClayWater(makeClayMat, o = {}) {
  const { width = 1.6, color = '#5FAEDC', bank = '#E8D6B8', y = 0, seed = 7, flow = 0.6 } = o;
  const rnd = seeded(seed);
  const group = new THREE.Group();
  group.position.y = y;
  const waterMat = makeClayMat(color, { roughness: 0.14, bumpScale: 0.0 });
  waterMat.metalness = 0.05;
  // Highlights stay subtle: thin, translucent glints, not white road markings.
  const foam = makeClayMat('#F4FBFF', { roughness: 0.3, bumpScale: 0.0, transparent: true, opacity: 0.45 });
  foam.depthWrite = false;
  const pebbleMats = [bank, '#D9C3A0', '#C9D6D9', '#E6CDB8'].map((c) => makeClayMat(c, { roughness: 0.7 }));

  let line;
  let surface;
  if (o.pond) {
    const { center = [0, 0], radius = 2 } = o.pond;
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      pts.push([center[0] + Math.cos(a) * radius * 0.5, center[1] + Math.sin(a) * radius * 0.5]);
    }
    line = sampleLine(pts, 0.2);
    surface = new THREE.Mesh(new THREE.CircleGeometry(radius, 48, 0, Math.PI * 2).rotateX(-Math.PI / 2), waterMat);
    surface.geometry.translate(center[0], 0, center[1]);
    // banks around the rim
    for (let i = 0; i < Math.round(radius * 9); i++) {
      const a = (i / Math.round(radius * 9)) * Math.PI * 2 + rnd(-0.08, 0.08);
      const pr = rnd(0.12, 0.22);
      const m = new THREE.Mesh(new THREE.SphereGeometry(pr, 12, 8), pebbleMats[i % 4]);
      m.scale.set(1.2, 0.55, 1);
      m.position.set(center[0] + Math.cos(a) * (radius + pr * 0.4), 0.05, center[1] + Math.sin(a) * (radius + pr * 0.4));
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
  } else {
    line = sampleLine(o.path || [[-6, 1], [0, 0], [6, 1]], 0.25);
    surface = new THREE.Mesh(ribbonGeometry(line, width, 6, width * 0.6), waterMat);
    // pebble banks on both edges
    line.points.forEach((p, i) => {
      if (i % 1 !== 0) return;
      const t = line.tangents[i];
      for (const side of [-1, 1]) {
        if (rnd() < 0.25) continue;
        const pr = rnd(0.1, 0.2);
        const off = (width / 2 + pr * 0.3) * side;
        const m = new THREE.Mesh(new THREE.SphereGeometry(pr, 12, 8), pebbleMats[(i + (side > 0 ? 1 : 0)) % 4]);
        m.scale.set(1.25, 0.55, 1);
        m.position.set(p.x - t.z * off, 0.05, p.z + t.x * off);
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
      }
    });
  }
  surface.position.y = 0.06; // waves (+-0.015) never dip below the ground it lies on
  surface.receiveShadow = true;
  group.add(surface);
  const base = surface.geometry.attributes.position.array.slice();

  // Highlight streaks drifting along the flow, and ripple rings.
  const streaks = [];
  const nStreaks = Math.max(3, Math.round(line.length * 0.7));
  for (let i = 0; i < nStreaks; i++) {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, rnd(0.18, 0.34), 4, 8), foam);
    m.rotation.order = 'YXZ'; // lay the capsule along z, then turn it to the flow direction
    m.rotation.x = Math.PI / 2;
    group.add(m);
    streaks.push({ m, offset: rnd(0, line.length), lane: rnd(-0.32, 0.32) * (o.pond ? 1 : width) });
  }
  const rings = [];
  for (let i = 0; i < Math.max(1, Math.round(line.length * 0.2)); i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.01, 6, 24), foam);
    m.rotation.x = Math.PI / 2;
    const p = line.points[Math.floor(rnd(0, line.points.length))];
    m.position.set(p.x + rnd(-0.3, 0.3), 0.07, p.z + rnd(-0.3, 0.3));
    group.add(m);
    rings.push({ m, phase: rnd(0, 1) });
  }

  function update(t = 0) {
    const arr = surface.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const z = base[i + 2];
      arr[i + 1] = base[i + 1] + 0.015 * Math.sin(x * 2.1 + t * 2.4) * Math.cos(z * 1.7 - t * 1.9);
    }
    surface.geometry.attributes.position.needsUpdate = true;
    surface.geometry.computeVertexNormals();
    for (const s of streaks) {
      const d = (((s.offset + t * flow) % line.length) + line.length) % line.length;
      const u = d / line.length;
      const p = line.curve.getPointAt(u);
      const tg = line.curve.getTangentAt(u);
      s.m.position.set(p.x - tg.z * s.lane, 0.085, p.z + tg.x * s.lane);
      s.m.rotation.y = Math.atan2(tg.x, tg.z);
      const edge = Math.min(u, 1 - u) * line.length;
      s.m.scale.setScalar(o.pond ? 1 : Math.min(1, edge / 0.6));
    }
    for (const r of rings) {
      const p = (t * 0.45 + r.phase) % 1;
      r.m.scale.setScalar(0.3 + p * 1.2);
      r.m.visible = p < 0.85;
    }
  }
  update(0);
  return { group, line, update };
}

/**
 * A path: stepping stones or a soft dirt track along `path` ([x, z] points).
 * @param {object} o { path, width: 0.9, style: 'stones'|'dirt', color, y: 0, seed }
 */
export function buildClayPath(makeClayMat, o = {}) {
  const { width = 0.9, style = 'stones', y = 0, seed = 5 } = o;
  const rnd = seeded(seed);
  const line = sampleLine(o.path || [[-4, 2], [0, 1.5], [4, 2]], 0.2);
  const group = new THREE.Group();
  group.position.y = y;
  if (style === 'dirt') {
    const mesh = new THREE.Mesh(ribbonGeometry(line, width, 4, width * 0.8), makeClayMat(o.color || '#DDB98A', { roughness: 0.9, bumpScale: 0.02 }));
    mesh.position.y = 0.02;
    mesh.receiveShadow = true;
    group.add(mesh);
  } else {
    const mats = [o.color || '#E8DCCB', '#D8CBB8', '#EFE5D6'].map((c) => makeClayMat(c, { roughness: 0.8 }));
    const stride = width * 0.95;
    for (let d = stride * 0.5; d < line.length; d += stride * rnd(0.9, 1.15)) {
      const u = d / line.length;
      const p = line.curve.getPointAt(u);
      const tg = line.curve.getTangentAt(u);
      const side = rnd(-0.12, 0.12) * width;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.42, width * 0.46, 0.09, 20), mats[Math.floor(rnd(0, 3))]);
      m.scale.set(rnd(0.85, 1.1), 1, rnd(0.7, 0.9));
      m.position.set(p.x - tg.z * side, 0.045, p.z + tg.x * side);
      m.rotation.y = rnd(0, Math.PI);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
  }
  return { group, line, update() {} };
}

/**
 * Grass tufts (optionally with little flowers) scattered over an area; they sway in `update`.
 * @param {object} o { center: [x,z], radius: 4 } | { area: [x0, z0, x1, z1] }, { count: 40, color, flowers: 0.3, y: 0, seed, avoid: [{ center, radius }] }
 */
export function buildClayGrass(makeClayMat, o = {}) {
  const { count = 40, color = '#8CCB7E', flowers = 0.3, y = 0, seed = 3, avoid = [] } = o;
  const rnd = seeded(seed);
  const group = new THREE.Group();
  group.position.y = y;
  const blades = [makeClayMat(color, { roughness: 0.75 }), makeClayMat('#A5D88F', { roughness: 0.75 })];
  const petals = [CLAY_PALETTE.macaronRose, CLAY_PALETTE.macaronLemon, CLAY_PALETTE.creamWhite, CLAY_PALETTE.macaronTaro].map((c) => makeClayMat(c, { roughness: 0.6 }));
  const tufts = [];
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 8; tries++) {
    let x;
    let z;
    if (o.area) {
      x = rnd(o.area[0], o.area[2]);
      z = rnd(o.area[1], o.area[3]);
    } else {
      const c = o.center || [0, 0];
      const a = rnd(0, Math.PI * 2);
      const rr = Math.sqrt(rnd()) * (o.radius ?? 4);
      x = c[0] + Math.cos(a) * rr;
      z = c[1] + Math.sin(a) * rr;
    }
    if (avoid.some((v) => Math.hypot(x - v.center[0], z - v.center[1]) < v.radius)) continue;
    placed++;
    const tuft = new THREE.Group();
    tuft.position.set(x, 0, z);
    const n = Math.floor(rnd(3, 6));
    for (let k = 0; k < n; k++) {
      const h = rnd(0.18, 0.36);
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.045, h, 6), blades[k % 2]);
      b.position.set(rnd(-0.08, 0.08), h / 2, rnd(-0.08, 0.08));
      b.rotation.set(rnd(-0.3, 0.3), 0, rnd(-0.35, 0.35));
      b.castShadow = true;
      tuft.add(b);
    }
    if (rnd() < flowers) {
      const f = new THREE.Group();
      f.position.set(0, rnd(0.28, 0.4), 0);
      const pm = petals[Math.floor(rnd(0, petals.length))];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const pe = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), pm);
        pe.position.set(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05);
        pe.scale.set(1, 0.5, 1);
        f.add(pe);
      }
      f.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), petals[1]));
      tuft.add(f);
    }
    group.add(tuft);
    tufts.push({ tuft, ph: rnd(0, 6.28) });
  }
  return {
    group,
    update(t = 0) {
      for (const { tuft, ph } of tufts) tuft.rotation.z = Math.sin(t * 1.8 + ph) * 0.06;
    },
  };
}

/**
 * Smooth clay rocks / boulders scattered over an area.
 * @param {object} o { center: [x,z], radius: 3 } | { area }, { count: 8, size: [0.2, 0.6], color, y: 0, seed }
 */
export function buildClayRocks(makeClayMat, o = {}) {
  const { count = 8, size = [0.2, 0.6], y = 0, seed = 9 } = o;
  const rnd = seeded(seed);
  const group = new THREE.Group();
  group.position.y = y;
  const mats = [o.color || '#CFC6BE', '#BDB4AD', '#DCD3C6'].map((c) => makeClayMat(c, { roughness: 0.82 }));
  for (let i = 0; i < count; i++) {
    let x;
    let z;
    if (o.area) {
      x = rnd(o.area[0], o.area[2]);
      z = rnd(o.area[1], o.area[3]);
    } else {
      const c = o.center || [0, 0];
      const a = rnd(0, Math.PI * 2);
      const rr = Math.sqrt(rnd()) * (o.radius ?? 3);
      x = c[0] + Math.cos(a) * rr;
      z = c[1] + Math.sin(a) * rr;
    }
    const s = rnd(size[0], size[1]);
    const m = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 12), mats[i % 3]);
    m.scale.set(rnd(1.0, 1.4), rnd(0.5, 0.8), rnd(0.9, 1.2));
    m.position.set(x, s * 0.35, z);
    m.rotation.y = rnd(0, Math.PI);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return { group, update() {} };
}

/**
 * Clay tree: `pine` (stacked tiers) or `round` (lollipop crown), gently swaying in `update`.
 * @param {object} o { position: [x,z], kind: 'pine'|'round', height: 2.4, color, trunk, y: 0, seed }
 */
export function buildClayTree(makeClayMat, o = {}) {
  const { position = [0, 0], kind = 'pine', height = 2.4, y = 0, seed = 1 } = o;
  const rnd = seeded(seed);
  const group = new THREE.Group();
  group.position.set(position[0], y, position[1]);
  const trunkH = height * (kind === 'pine' ? 0.25 : 0.42);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.045, height * 0.06, trunkH, 12), makeClayMat(o.trunk || '#8A5A3C', { roughness: 0.8 }));
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  group.add(trunk);
  const crown = new THREE.Group();
  crown.position.y = trunkH;
  group.add(crown);
  const leaf = makeClayMat(o.color || (kind === 'pine' ? '#6FB58A' : '#9EDBC0'), { roughness: 0.74 });
  if (kind === 'pine') {
    const tiers = 3;
    for (let k = 0; k < tiers; k++) {
      const w = height * (0.36 - k * 0.08);
      const h = height * 0.34;
      const c = new THREE.Mesh(new THREE.ConeGeometry(w, h, 18), leaf);
      c.position.y = h * 0.5 + k * height * 0.2;
      c.castShadow = true;
      c.receiveShadow = true;
      crown.add(c);
    }
  } else {
    const r = height * 0.3;
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r * rnd(0.6, 0.8), 18, 12), leaf);
      b.position.set(rnd(-0.4, 0.4) * r, r * 0.9 + rnd(-0.2, 0.4) * r, rnd(-0.4, 0.4) * r);
      b.castShadow = true;
      b.receiveShadow = true;
      crown.add(b);
    }
  }
  const ph = rnd(0, 6.28);
  return {
    group,
    update(t = 0) {
      crown.rotation.z = Math.sin(t * 1.3 + ph) * 0.025;
    },
  };
}

// ============================================================================
// 8. HAND-MOLDED CLAY SCULPTING PRIMITIVES (De-Boxification Helpers)
// ============================================================================

/**
 * Hand-pinched organic clay lump / loaf / cushion / cloud (`createClayBlob`).
 * Avoids mathematical `THREE.SphereGeometry` perfection by applying low-frequency
 * harmonic thumb-press undulation and an optional flattened contact base (`flatBottom`).
 */
export function createClayBlob(makeClayMat, o = {}) {
  const {
    radius = 0.5,
    scale = [1, 1, 1],
    wobble = 0.07,
    flatBottom = 0.16,
    color = CLAY_PALETTE.macaronRose,
    seed = 41,
    matOpts = {},
  } = o;
  const rGen = mulberry32(seed);
  const p1 = rGen() * 6.28, p2 = rGen() * 6.28, p3 = rGen() * 6.28;
  const geo = new THREE.SphereGeometry(radius, 28, 20);
  const pos = geo.attributes.position;
  const minY = -radius * (1.0 - clamp(flatBottom, 0, 0.6));

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    const nx = x / len, ny = y / len, nz = z / len;
    const d =
      1.0 +
      wobble *
        (0.5 * Math.sin(nx * 2.7 + p1) * Math.cos(nz * 2.3 + p2) +
          0.35 * Math.sin(ny * 3.1 + p3) +
          0.15 * Math.cos((nx + nz) * 4.2 + p1));
    x *= d;
    y *= d;
    z *= d;
    if (flatBottom > 0 && y < minY) {
      const over = minY - y;
      y = minY - over * 0.12;
      const spread = 1.0 + (over / radius) * 0.18;
      x *= spread;
      z *= spread;
    }
    pos.setXYZ(i, x * scale[0], y * scale[1], z * scale[2]);
  }
  geo.computeVertexNormals();
  const mat = typeof makeClayMat === 'function' ? makeClayMat(color, matOpts) : makeClayMat;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Hand-turned clay vessel / dome / mushroom cap / rocket hull (`createClayLathe`).
 * Takes an array of `[r, y]` profile points, interpolates a smooth spline, and adds
 * subtle circumferential hand-pinched asymmetry (`wobble`).
 */
export function createClayLathe(makeClayMat, o = {}) {
  const {
    profile = [
      [0.0, 0.0],
      [0.45, 0.02],
      [0.52, 0.45],
      [0.38, 0.85],
      [0.0, 0.92],
    ],
    segments = 32,
    wobble = 0.03,
    color = CLAY_PALETTE.creamWhite,
    seed = 53,
    matOpts = {},
  } = o;
  const rGen = mulberry32(seed);
  const p1 = rGen() * 6.28, p2 = rGen() * 6.28;
  const pts2d = profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  const spline = new THREE.SplineCurve(pts2d);
  const sampled = spline.getPoints(Math.max(16, profile.length * 6));
  const geo = new THREE.LatheGeometry(sampled, segments);
  if (wobble > 0) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const r = Math.hypot(x, z);
      if (r > 1e-4) {
        const ang = Math.atan2(z, x);
        const mod = 1.0 + wobble * (0.6 * Math.sin(ang * 3 + y * 2.2 + p1) + 0.4 * Math.cos(ang * 5 - y * 1.7 + p2));
        pos.setXYZ(i, x * mod, y, z * mod);
      }
    }
  }
  geo.computeVertexNormals();
  const mat = typeof makeClayMat === 'function' ? makeClayMat(color, matOpts) : makeClayMat;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Hand-pressed rounded clay slab / board / roof tile / book / wall (`createClaySlab`).
 * Replaces sharp-edged `THREE.BoxGeometry` with a soft-beveled, subtly hand-pressed clay block.
 */
export function createClaySlab(makeClayMat, o = {}) {
  const {
    size = [1.2, 0.24, 0.8],
    bevel = 0.055,
    wobble = 0.02,
    color = CLAY_PALETTE.macaronMint,
    seed = 67,
    matOpts = {},
  } = o;
  const [w, h, d] = size;
  const b = Math.min(bevel, w * 0.22, h * 0.38, d * 0.22);
  const hw = Math.max(0.01, w * 0.5 - b);
  const hd = Math.max(0.01, d * 0.5 - b);
  const r = Math.min(b * 1.4, hw * 0.45, hd * 0.45);

  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  const depth = Math.max(0.01, h - b * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 2,
    bevelSize: b,
    bevelThickness: b,
  });
  geo.rotateX(Math.PI / 2);
  geo.center();

  if (wobble > 0) {
    const rGen = mulberry32(seed);
    const p1 = rGen() * 6.28, p2 = rGen() * 6.28;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const dy = wobble * h * Math.sin(x * 2.5 + p1) * Math.cos(z * 2.5 + p2);
      pos.setY(i, y + dy);
    }
  }
  geo.computeVertexNormals();
  const mat = typeof makeClayMat === 'function' ? makeClayMat(color, matOpts) : makeClayMat;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Hand-rolled clay coil / piped cream / vine / rope / handle (`createClayCoil`).
 * Extrudes a tube along 3D `points` with optional tapered ends (`taper: 'none' | 'both' | 'tip'`).
 */
export function createClayCoil(makeClayMat, o = {}) {
  const {
    points = [
      [-0.5, 0, 0],
      [0, 0.2, 0.1],
      [0.5, 0, 0],
    ],
    radius = 0.06,
    taper = 'both',
    tubularSegments = 36,
    radialSegments = 12,
    closed = false,
    color = CLAY_PALETTE.macaronLemon,
    matOpts = {},
  } = o;
  const vecs = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2])));
  const curve = new THREE.CatmullRomCurve3(vecs, closed);
  const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);

  if (taper && taper !== 'none' && !closed) {
    const pos = geo.attributes.position;
    const ringCount = tubularSegments + 1;
    const vertsPerRing = radialSegments + 1;
    for (let i = 0; i < ringCount; i++) {
      const u = i / tubularSegments;
      let scale = 1.0;
      if (taper === 'both') {
        scale = 0.28 + 0.72 * Math.sin(u * Math.PI);
      } else if (taper === 'tip') {
        scale = 1.0 - 0.75 * Math.pow(u, 1.8);
      }
      const center = curve.getPointAt(u);
      for (let j = 0; j < vertsPerRing; j++) {
        const idx = i * vertsPerRing + j;
        if (idx >= pos.count) continue;
        const vx = pos.getX(idx) - center.x;
        const vy = pos.getY(idx) - center.y;
        const vz = pos.getZ(idx) - center.z;
        pos.setXYZ(idx, center.x + vx * scale, center.y + vy * scale, center.z + vz * scale);
      }
    }
    geo.computeVertexNormals();
  }
  const mat = typeof makeClayMat === 'function' ? makeClayMat(color, matOpts) : makeClayMat;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Clay Macaron look profile, layered over `LOOK_DEFAULTS` from `engine/look.js`.
 * Override per video via `style.js -> look` or `createClayStudioStage({ look })`;
 * never set renderer / light values inside `world.js`.
 */
export const CLAY_LOOK = {
  color: { output: 'srgb', toneMapping: 'aces', exposure: 1.0 },
  light: {
    illuminance: 2.0,
    keyRatio: 2.5,
    key: { color: '#FFF5E0', pos: [-10, 22, 16] },
    sky: '#FFF8EB',
    ground: '#D9A796',
    bounce: { color: '#FFC6B0', pos: [12, -6, 10], share: 0.2 },
  },
  env: { enabled: true, share: 0.5, softbox: 4.0 },
  backdrop: { color: CLAY_PALETTE.deskBg, fog: 0.012 },
  contact: { enabled: true, opacity: 0.5, blur: 2.0, size: [26, 18], height: 2.5 },
};

/**
 * Clay-specific overrides of the engine's time-of-day presets (`engine/look.js -> LOOK_PRESETS`),
 * used by `data-look="<name>"`. Empty means the engine presets already suit this palette;
 * add a layer here only where clay needs a different light design. Per video: `style.looks`.
 */
export const CLAY_LOOK_PRESETS = {};

/**
 * Initializes a complete Three.js Stop-Motion Clay Tabletop Studio with:
 *   - Look rig from `engine/look.js` (sRGB pipeline, budgeted key / hemi / bounce / IBL,
 *     contact shadows) resolved from `LOOK_DEFAULTS` <- `CLAY_LOOK` <- `look`
 *   - Aspect-ratio adaptive `PerspectiveCamera` + `applyShot(shotSpec, u, localT)` helper
 *   - Shared procedural textures (`clayBumpTex`, `caramelTex`, `marbledTex`) & `makeClayMat` / `makeBrassWireMat`
 *   - Matte polymer-clay tabletop surface at `Y = 0.0` (`deskMesh`)
 *   - `director({ subjects, shots })` — shot lists with auto framing (`engine/director.js`)
 *   - `render(frame)` — the only way a world should draw a frame; applies per-scene `data-look`
 */
export function createClayStudioStage({
  width,
  height,
  baseFov = 31,
  bgColor = CLAY_PALETTE.deskBg,
  deskColor = CLAY_PALETTE.deskSurface,
  look = null,
  looks = null,
  scenes = [],
} = {}) {
  // Generic 3D plumbing (renderer, camera, look rig + timeline, director) lives in the engine;
  // this kernel only adds the clay medium: textures, materials and the tabletop.
  const studio = createStudio3D(THREE, {
    width,
    height,
    baseFov,
    scenes,
    look: resolveLook(LOOK_DEFAULTS, CLAY_LOOK, { backdrop: { color: bgColor } }, look),
    presets: resolveLook(LOOK_PRESETS, CLAY_LOOK_PRESETS, looks),
    maxDist: 26, // keeps the camera over the 52x32 desk and out of the fog falloff
  });
  const { canvas: worldCanvas, renderer, scene, camera, framing } = studio;

  const clayBumpTex = createThumbprintBumpTexture(512, 101);
  const caramelTex = createCaramelLatteTexture(512);
  const marbledTex = createMarbledClayTexture(
    ['#F5A3B8', '#FFFDF5', '#9EDBC0', '#FADC8C'],
    512
  );
  const { makeClayMat, makeBrassWireMat } =
    createClayMaterialFactory(clayBumpTex);

  const envGroup = new THREE.Group();
  scene.add(envGroup);

  const deskMesh = new THREE.Mesh(
    new THREE.BoxGeometry(52, 2.0, 32),
    makeClayMat(deskColor, {
      roughness: 0.84,
      bumpScale: 0.022,
    })
  );
  deskMesh.position.set(0, -1.0, 0);
  deskMesh.receiveShadow = true;
  envGroup.add(deskMesh);

  return {
    canvas: worldCanvas,
    renderer,
    scene,
    camera,
    framing,
    distScale: framing.distScale,
    envGroup,
    deskMesh,
    clayBumpTex,
    caramelTex,
    marbledTex,
    makeClayMat,
    makeBrassWireMat,
    applyShot: studio.applyShot,
    director: studio.director,
    lookRig: studio.lookRig,
    render: studio.render,
  };
}
