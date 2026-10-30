/**
 * Twilight Bioluminescent Fable (`styles/twilight-fable/kernel.js`)
 * Dreamy Bokeh, Dual-Pass Normal-Dot-Light Rim Shader & 120Hz Continuous-Topology Spring Creature Kernel
 *
 * Core Capabilities:
 *   1. Five `lookcheck.py`-calibrated optical look presets (`TWILIGHT_LOOKS`, `getTwilightLook`, `lerpTwilightLook`)
 *      maintaining luminous twilight/aurora skies & water so mean lightness `L` stays in `[42, 62]`.
 *   2. Stage & Atmospheric Optics (`createTwilightStage`, `drawDreamyBackdrop`, `drawBokehField`,
 *      `drawAuroraRibbons`, `drawStarfieldAndMeteors`, `drawStarTrail`, `evalCubicBezier`).
 *   3. Silk-Mirror Water & Reflections (`drawWaterSurface`, `drawLightWaterReflection`,
 *      `drawStreamRipples`, `drawCritterWaterReflection`).
 *   4. Dual-Pass Normal-Dot-Light Rim Renderer (`drawLitOrganicShape`, `applyDirectionalRimLight`)
 *      with offscreen unified silhouette masking (`Pass A` subsurface glow + `Pass B` crescent rim).
 *   5. 120Hz Continuous-Topology Spring Creature Rig (`simulateCritterRig`, `drawTwilightCritter`,
 *      `createTwilightCritter`) with strict anatomical bounds (`clampNeckConstraint` in `[28*s, 52*s]`,
 *      `traceNeckBridgePath`, spine length clamp `[0.72, 1.22]`, limb socket clamp `0.92 * maxLen`,
 *      near-critical damping `zeta = 0.78-0.80`, and multi-species customization `'fennec' | 'moonBunny' | 'mossDeer'`).
 *   6. Bioluminescent Woodland & Water Flora/Props (`drawBiolumDandelion`, `drawDandelionSeed`,
 *      `drawGlowMushroom`, `drawLilyPad`, `drawDefocusedFlora`, `drawLotusLanternBoat`, `drawCrystalDewdrop`).
 *   7. Generative Terrain & Set-Dressing (`groundProfile`, `drawGroundMass`, `drawGrassTufts`, `drawStoneMass`,
 *      `drawTrunk`, `drawCanopyMass`, `drawLightShafts`, `drawFogLayer`, `drawWindowGlow`, `drawPond`,
 *      `drawStreamPath`). Water is OPTIONAL: a story may be a meadow, a forest floor, a burrow or a room.
 *   8. Material Roles (`MATERIAL_ROLES`, `resolveCritterMaterials`, `governMaterialColor`, `drawHardMaterial`):
 *      parts declare a role (`spirit | fur | hard`) via `build.materials`; the role, not the species, decides
 *      glow, rim, saturation and value. Saturation and glow are mutually exclusive; one emissive subject per shot.
 *
 * De-solidification contract (see SPEC.md §1):
 *   - No primitive carries story content in its defaults. Placement-type primitives (mushroom clusters,
 *     lily pads, stones, trees …) draw NOTHING and log a `console.error` when called without explicit
 *     placement, so `tools/audit.mjs` fails instead of silently pasting the showcase layout.
 *   - Atmospheric layouts (ambient washes, aurora, sheen bands) are generated from `opts.seed` + the look,
 *     never from fixed screen coordinates. Give every scene its own seed.
 *   - Creatures are parametric (`build`: body length, girth, head size, muzzle, leg length, ear/tail/horn
 *     type, eye colours) and render real `side` / `3q` / `front` / `back` views.
 */

import { createStudio2D } from '../../engine/studio2d.js';
import { clamp, lerp, smootherstep } from '../../engine/motion.js';
import {
  STANCES,
  SKULLS,
  TRUNKS,
  COATS,
  TAILS,
  GAITS,
  MARKING_ZONES,
  PROFILE_SPECIES,
  profileSizeForScale,
  poseProfileQuadruped,
  traceProfilePart,
  profileParts,
  v2,
  traceOutline,
  sampleChain as sampleProfileChain,
  stepSpring1D,
  stepSpring2D,
  wrapAngleNear,
  shapeEarAngle,
  CRITTER_EAR_TYPES,
  CRITTER_TAIL_TYPES,
  CRITTER_BUILD_DEFAULTS,
  DEFAULT_PLUSH_SPECIES,
  CRITTER_PART_MATERIALS,
  resolveCritterBuild,
  contourEarGeometry,
  traceContourEar,
  simulateCritterRig as _simulateCritterRig,
  traceSmoothSpineBodyPath,
  traceNeckBridgePath,
  projectCritterView,
  limbSocketsFor,
  tracePlushLimbPath,
  headLocal,
  muzzleSpec,
  traceCritterHeadPath,
  traceHornBuds,
  fillAntlers,
  fillHorns,
  sampleSmoothChain,
  traceSmoothChainRibbon,
  traceEar,
  traceTail,
  HERO_MOVES,
  heroBaseAt,
  createPlushCritter,
  FISH_SPECIES,
  poseProfileFish,
  applyFishTransform,
  traceFishPart,
} from '../../engine/critter2d.js';

// Re-export style-agnostic Layer 1 creature geometry and kinematics from engine/critter2d.js (ADR-015)
export {
  STANCES,
  SKULLS,
  TRUNKS,
  COATS,
  TAILS,
  GAITS,
  MARKING_ZONES,
  PROFILE_SPECIES,
  profileSizeForScale,
  poseProfileQuadruped,
  traceProfilePart,
  profileParts,
  v2,
  traceOutline,
  sampleProfileChain,
  sampleProfileChain as sampleChain,
  stepSpring1D,
  stepSpring2D,
  wrapAngleNear,
  shapeEarAngle,
  CRITTER_EAR_TYPES,
  CRITTER_TAIL_TYPES,
  CRITTER_BUILD_DEFAULTS,
  DEFAULT_PLUSH_SPECIES,
  CRITTER_PART_MATERIALS,
  resolveCritterBuild,
  contourEarGeometry,
  traceContourEar,
  traceSmoothSpineBodyPath,
  traceNeckBridgePath,
  projectCritterView,
  limbSocketsFor,
  tracePlushLimbPath,
  headLocal,
  muzzleSpec,
  traceCritterHeadPath,
  traceHornBuds,
  fillAntlers,
  fillHorns,
  sampleSmoothChain,
  traceSmoothChainRibbon,
  traceEar,
  traceTail,
  HERO_MOVES,
  heroBaseAt,
  createPlushCritter,
  FISH_SPECIES,
  poseProfileFish,
  applyFishTransform,
  traceFishPart,
};

// ---------------------------------------------------------------------------
// 1. Deterministic Math, Spline & Color Utilities
// ---------------------------------------------------------------------------

export function hash11(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/** Deterministic seeded PRNG (`mulberry32`) returning floats in `[0, 1)`. */
export function seededRandom(seed = 1) {
  let a = (Math.floor(seed * 9973) ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1D value noise in `[-1, 1]` (deterministic per seed). */
export function noise1D(x, seed = 1) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash11(i * 1.31 + seed * 17.7) * 2 - 1;
  const b = hash11((i + 1) * 1.31 + seed * 17.7) * 2 - 1;
  return a + (b - a) * u;
}

const _reportedOnce = new Set();
/**
 * Reports a contract violation once per key via `console.error`, which `tools/audit.mjs`
 * counts as a runtime failure. Used when a placement primitive is called without placement.
 */
function reportOnce(key, msg) {
  if (_reportedOnce.has(key)) return;
  _reportedOnce.add(key);
  console.error(`[twilight-fable] ${msg}`);
}

export function hexToRgb(hex) {
  const clean = String(hex || '#ffffff').replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const parsed = parseInt(full, 16);
  const num = Number.isNaN(parsed) ? 0xffffff : parsed; // '#000000' parses to 0 — black, not a parse failure
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgba(hex, alpha = 1) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1).toFixed(4)})`;
}

export function mixHex(hexA, hexB, u) {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const k = clamp(u, 0, 1);
  const r = Math.round(lerp(r1, r2, k));
  const g = Math.round(lerp(g1, g2, k));
  const b = Math.round(lerp(b1, b2, k));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Evaluates a 2D Cubic Bezier curve `p0 -> p1 -> p2 -> p3` at `u in [0, 1]`.
 */
export function evalCubicBezier(p0, p1, p2, p3, u) {
  const t = clamp(u, 0, 1);
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  const x =
    mt2 * mt * p0[0] +
    3 * mt2 * t * p1[0] +
    3 * mt * t2 * p2[0] +
    t2 * t * p3[0];
  const y =
    mt2 * mt * p0[1] +
    3 * mt2 * t * p1[1] +
    3 * mt * t2 * p2[1] +
    t2 * t * p3[1];

  const dx =
    3 * mt2 * (p1[0] - p0[0]) +
    6 * mt * t * (p2[0] - p1[0]) +
    3 * t2 * (p3[0] - p2[0]);
  const dy =
    3 * mt2 * (p1[1] - p0[1]) +
    6 * mt * t * (p2[1] - p1[1]) +
    3 * t2 * (p3[1] - p2[1]);

  return { x, y, dx, dy, heading: Math.atan2(dy, dx) };
}

// ---------------------------------------------------------------------------
// 2. Curated Palette & `lookcheck.py`-Calibrated Optical Look Presets
// ---------------------------------------------------------------------------

export const TWILIGHT_PALETTE = {
  velvetIndigo: '#1B163E',
  velvetPlum: '#2D2463',
  lavenderRuff: '#DDD6FE',
  roseBlush: '#F472B6',
  champagneGold: '#FEF08A',
  amberWarm: '#F59E0B',
  sunsetPeach: '#FB923C',
  biolumCyan: '#67E8F9',
  biolumMint: '#5EEAD4',
  periwinkleMist: '#93C5FD',
  amethystGlow: '#C084FC',
};

/**
 * Optical look presets calibrated so `tools/lookcheck.py` readability floors
 * (`L in [35, 92]`, `p95 >= 55`, `contrast >= 7`, `range >= 18`) pass with normal lighting.
 *
 * Every look carries THREE colour families so a story is never forced onto water:
 *   - sky*      backdrop (sky, or the wall of an interior)
 *   - water*    only used if the story actually draws water (`drawWaterSurface`, `drawPond`, `drawStreamPath`)
 *   - ground* / foliage* / stone*   land, forest floor, floorboards, rocks and canopy masses
 * Use `defineTwilightLook(base, overrides)` (or pass `looks` to `createTwilightStage`) to author
 * a story-specific look instead of reusing a preset verbatim.
 */
export const TWILIGHT_LOOKS = {
  // 1. Luminous Periwinkle-Violet Twilight (`twilight` / `dusk`)
  twilight: {
    name: 'twilight',
    skyTop: '#313B78',
    skyMid: '#515DA6',
    skyHorizon: '#8A7EC9',
    waterTop: '#6476BA',
    waterMid: '#435496',
    waterDeep: '#2A366E',
    groundTop: '#4E5398',
    groundMid: '#363B7A',
    groundDeep: '#24295A',
    foliageDark: '#1E2350',
    foliageMid: '#323D7E',
    foliageGlow: '#5EEAD4',
    stoneDark: '#2A2A5E',
    stoneMid: '#4C4C8E',
    warmGlow: '#FDE047',
    warmMid: '#FB923C',
    coolGlow: '#67E8F9',
    mistColor: '#C4B5FD',
    critterDark: '#171338',
    critterMid: '#2A225C',
    critterBounce: '#60A5FA',
  },
  // 2. Bioluminescent Cyan-Violet Aurora (`aurora` / `night`)
  aurora: {
    name: 'aurora',
    skyTop: '#28386E',
    skyMid: '#445C9C',
    skyHorizon: '#748EC9',
    waterTop: '#5678B8',
    waterMid: '#3A5894',
    waterDeep: '#243A6C',
    groundTop: '#3E5E96',
    groundMid: '#2C4676',
    groundDeep: '#1C2E54',
    foliageDark: '#16264A',
    foliageMid: '#25407A',
    foliageGlow: '#5EEAD4',
    stoneDark: '#22305C',
    stoneMid: '#40568E',
    warmGlow: '#FEF08A',
    warmMid: '#FDBA74',
    coolGlow: '#5EEAD4',
    mistColor: '#93C5FD',
    critterDark: '#14183A',
    critterMid: '#242B60',
    critterBounce: '#5EEAD4',
  },
  // 3. Golden-Hour Amber & Rose Wish-Bloom (`amber` / `golden`)
  amber: {
    name: 'amber',
    skyTop: '#3B3372',
    skyMid: '#68509C',
    skyHorizon: '#B57BA6',
    waterTop: '#7D68AE',
    waterMid: '#55478C',
    waterDeep: '#352C66',
    groundTop: '#7A5A92',
    groundMid: '#5A4278',
    groundDeep: '#3A2A56',
    foliageDark: '#2E2250',
    foliageMid: '#4A3672',
    foliageGlow: '#FDE68A',
    stoneDark: '#3A2C5C',
    stoneMid: '#6A5290',
    warmGlow: '#FDE047',
    warmMid: '#FB923C',
    coolGlow: '#7DD3FC',
    mistColor: '#FDBA74',
    critterDark: '#1A1338',
    critterMid: '#31235E',
    critterBounce: '#FBBF24',
  },
  // 4. Misty Lavender-Rose Dawn (`dawn` / `day`)
  dawn: {
    name: 'dawn',
    skyTop: '#424C8C',
    skyMid: '#6B73B8',
    skyHorizon: '#B29CE0',
    waterTop: '#7B86C8',
    waterMid: '#5560A6',
    waterDeep: '#384180',
    groundTop: '#7078B4',
    groundMid: '#545C98',
    groundDeep: '#383F74',
    foliageDark: '#2C3268',
    foliageMid: '#454E90',
    foliageGlow: '#A5F3FC',
    stoneDark: '#3C4276',
    stoneMid: '#6268A8',
    warmGlow: '#FEF9C3',
    warmMid: '#FDBA74',
    coolGlow: '#A5F3FC',
    mistColor: '#E9D5FF',
    critterDark: '#1C1842',
    critterMid: '#322B68',
    critterBounce: '#93C5FD',
  },
  // 5. Enchanted Emerald-Indigo Forest Glade (`glade` / `indoor`)
  glade: {
    name: 'glade',
    skyTop: '#28406C',
    skyMid: '#426698',
    skyHorizon: '#749EBD',
    waterTop: '#5280AD',
    waterMid: '#385E8C',
    waterDeep: '#243E66',
    groundTop: '#3F6E78',
    groundMid: '#2E5460',
    groundDeep: '#1E3844',
    foliageDark: '#163042',
    foliageMid: '#25506A',
    foliageGlow: '#6EE7B7',
    stoneDark: '#243A50',
    stoneMid: '#41627E',
    warmGlow: '#FDE68A',
    warmMid: '#FDBA74',
    coolGlow: '#6EE7B7',
    mistColor: '#99F6E4',
    critterDark: '#151A38',
    critterMid: '#262E5C',
    critterBounce: '#6EE7B7',
  },
  // 6. Lamp-Lit Honey Interior (`honey` / `warm` / `room`) — burrows, bedrooms, tea rooms, product tables
  honey: {
    name: 'honey',
    skyTop: '#5A3A5E',
    skyMid: '#8A5A6E',
    skyHorizon: '#D9A27A',
    waterTop: '#9A7A9A',
    waterMid: '#74587A',
    waterDeep: '#4E3A58',
    groundTop: '#8A5E64',
    groundMid: '#6A4652',
    groundDeep: '#46303E',
    foliageDark: '#3E2E48',
    foliageMid: '#5E4868',
    foliageGlow: '#FDE68A',
    stoneDark: '#4A3848',
    stoneMid: '#745A70',
    warmGlow: '#FFD58A',
    warmMid: '#F59E0B',
    coolGlow: '#A5B4FC',
    mistColor: '#F5C9A0',
    critterDark: '#2A1A33',
    critterMid: '#45304F',
    critterBounce: '#FDBA74',
  },
  // 7. Mint Morning Mist (`mintmist` / `morning`) — dew, spring meadows, fresh beginnings
  mintmist: {
    name: 'mintmist',
    skyTop: '#3E6A86',
    skyMid: '#6FA0B0',
    skyHorizon: '#BFE3D6',
    waterTop: '#7EB4C0',
    waterMid: '#5A92A4',
    waterDeep: '#3A6A80',
    groundTop: '#5E9A8E',
    groundMid: '#467D78',
    groundDeep: '#2F5C5E',
    foliageDark: '#24494E',
    foliageMid: '#3E7272',
    foliageGlow: '#D9F99D',
    stoneDark: '#3A5660',
    stoneMid: '#62868C',
    warmGlow: '#FEF3C7',
    warmMid: '#FCD34D',
    coolGlow: '#99F6E4',
    mistColor: '#E0F7F1',
    critterDark: '#1F3440',
    critterMid: '#335262',
    critterBounce: '#A7F3D0',
  },
  // 8. Deep Under-Canopy Woodland (`deepwood` / `forest`) — moss, roots, fireflies under trees
  deepwood: {
    name: 'deepwood',
    skyTop: '#1F3A48',
    skyMid: '#2F5A62',
    skyHorizon: '#5E8F86',
    waterTop: '#4A7E80',
    waterMid: '#336264',
    waterDeep: '#20464A',
    groundTop: '#3E6656',
    groundMid: '#2C4E44',
    groundDeep: '#1A3430',
    foliageDark: '#163632',
    foliageMid: '#2A5A50',
    foliageGlow: '#BEF264',
    stoneDark: '#2C4440',
    stoneMid: '#4E6E64',
    warmGlow: '#FDE68A',
    warmMid: '#FBBF24',
    coolGlow: '#6EE7B7',
    mistColor: '#A7D8C4',
    critterDark: '#12222A',
    critterMid: '#203A44',
    critterBounce: '#6EE7B7',
  },
};

const LOOK_ALIASES = {
  twilight: 'twilight',
  dusk: 'twilight',
  aurora: 'aurora',
  night: 'aurora',
  amber: 'amber',
  golden: 'amber',
  dawn: 'dawn',
  day: 'dawn',
  glade: 'glade',
  indoor: 'glade',
  honey: 'honey',
  warm: 'honey',
  room: 'honey',
  mintmist: 'mintmist',
  morning: 'mintmist',
  deepwood: 'deepwood',
  forest: 'deepwood',
};

/**
 * Resolves a look by preset name / alias, by a key in `customLooks`, or passes a look object through.
 * Missing colour keys are filled from the `twilight` preset so partial custom looks are safe.
 */
export function getTwilightLook(name = 'twilight', customLooks = null) {
  if (name && typeof name === 'object') return { ...TWILIGHT_LOOKS.twilight, ...name };
  const raw = String(name || 'twilight');
  if (customLooks && customLooks[raw]) {
    const c = customLooks[raw];
    return { ...TWILIGHT_LOOKS.twilight, name: raw, ...(typeof c === 'string' ? getTwilightLook(c) : c) };
  }
  const key = LOOK_ALIASES[raw.toLowerCase()] || 'twilight';
  return TWILIGHT_LOOKS[key] || TWILIGHT_LOOKS.twilight;
}

/**
 * Authors a story-specific look: `defineTwilightLook('deepwood', { skyHorizon: '#7FB0A0', warmGlow: '#FFE4A0' })`.
 */
export function defineTwilightLook(base = 'twilight', overrides = {}) {
  const b = getTwilightLook(base);
  return { ...b, ...overrides, name: overrides.name || `${b.name}*` };
}

export function lerpTwilightLook(lookA, lookB, u) {
  const a = getTwilightLook(lookA || 'twilight');
  const b = getTwilightLook(lookB || 'twilight');
  const k = clamp(u, 0, 1);
  if (k <= 0.001) return a;
  if (k >= 0.999) return b;
  const out = { name: k < 0.5 ? a.name : b.name };
  for (const key of Object.keys(a)) {
    const va = a[key];
    const vb = b[key];
    if (typeof va === 'string' && va.startsWith('#') && typeof vb === 'string' && vb.startsWith('#')) {
      out[key] = mixHex(va, vb, k);
    } else if (key !== 'name') {
      out[key] = k < 0.5 ? va : vb ?? va;
    }
  }
  return out;
}

/**
 * Convenience stage wrapper around `createStudio2D` providing automatic `resolveLook(frame)`
 * from `data-look` and `data-look-blend` attributes on `<section class="frame scene">`.
 * Pass `looks: { myLook: defineTwilightLook('honey', {...}) }` to make `data-look="myLook"` resolvable.
 */
export function createTwilightStage({
  width = 1920,
  height = 1080,
  designWidth = 1920,
  designHeight = 1080,
  scenes = [],
  looks = null,
} = {}) {
  const studio = createStudio2D({ width, height, designWidth, designHeight, scenes });
  // Scene attributes live on the <section> dataset (`scene.el.dataset.look`), not on the scene object.
  const lookOf = (sc) => (sc?.el?.dataset || sc || {}).look;
  const blendOf = (sc) => Number((sc?.el?.dataset || sc || {}).lookBlend ?? 0);
  const unknown = scenes.map(lookOf).filter((l) => l && !looks?.[l] && !LOOK_ALIASES[String(l).toLowerCase()]);
  if (unknown.length) {
    reportOnce('unknown-look', `unknown data-look "${unknown.join('", "')}" — use a preset (${Object.keys(LOOK_ALIASES).join(', ')}) or pass it in createTwilightStage({ looks }).`);
  }
  return {
    studio,
    canvas: studio.canvas,
    resolveLook(frame) {
      const idx = frame?.sceneIndex ?? 0;
      const curScene = scenes[idx] || {};
      const curLook = getTwilightLook(lookOf(curScene) || frame?.look || 'twilight', looks);
      const blendDur = blendOf(curScene);
      if (blendDur > 0 && idx > 0 && (frame?.localT ?? 0) < blendDur) {
        const prevLook = getTwilightLook(lookOf(scenes[idx - 1]) || 'twilight', looks);
        const u = smootherstep(0, blendDur, frame.localT ?? 0);
        return lerpTwilightLook(prevLook, curLook, u);
      }
      return curLook;
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Shared Offscreen Scratch Canvases for Rim Lighting & Water Reflections
// ---------------------------------------------------------------------------

let _shapeCanvas = null;
let _shapeCtx = null;
let _rimCanvas = null;
let _rimCtx = null;
let _reflCanvas = null;
let _reflCtx = null;

function getShapeScratch(w = 1200, h = 1200) {
  if (!_shapeCanvas) {
    _shapeCanvas = document.createElement('canvas');
    _shapeCtx = _shapeCanvas.getContext('2d');
  }
  if (_shapeCanvas.width < w || _shapeCanvas.height < h) {
    _shapeCanvas.width = Math.max(_shapeCanvas.width, w);
    _shapeCanvas.height = Math.max(_shapeCanvas.height, h);
  }
  return { canvas: _shapeCanvas, ctx: _shapeCtx };
}

function getRimScratch(w = 1200, h = 1200) {
  if (!_rimCanvas) {
    _rimCanvas = document.createElement('canvas');
    _rimCtx = _rimCanvas.getContext('2d');
  }
  if (_rimCanvas.width < w || _rimCanvas.height < h) {
    _rimCanvas.width = Math.max(_rimCanvas.width, w);
    _rimCanvas.height = Math.max(_rimCanvas.height, h);
  }
  return { canvas: _rimCanvas, ctx: _rimCtx };
}

let _featherCanvas = null;
let _featherCtx = null;

/**
 * Feathered erase (the rim / core-shadow falloff): draws the mask at each offset in `shifts` into a low-resolution
 * canvas and erases its smooth bilinear upscale from `rCtx` (`destination-out`). A real blur without `ctx.filter`
 * (which stalls headless rendering): the falloff is one continuous ramp, not stacked hard-edged copies, so a rim stays
 * a single soft glow at close-up size. `box` = { ox, oy, boxW, boxH } of the scratch, `blur` ≈ ramp width in px.
 */
function featherEraseShifted(rCtx, drawMaskFn, box, shifts, blur, alpha = 1) {
  const { ox, oy, boxW, boxH } = box;
  const k = clamp(1.25 / Math.max(1, blur), 1 / 24, 1);
  const w = Math.max(1, Math.ceil(boxW * k));
  const h = Math.max(1, Math.ceil(boxH * k));
  if (!_featherCanvas) {
    _featherCanvas = document.createElement('canvas');
    _featherCtx = _featherCanvas.getContext('2d');
  }
  if (_featherCanvas.width < w || _featherCanvas.height < h) {
    _featherCanvas.width = Math.max(_featherCanvas.width, w);
    _featherCanvas.height = Math.max(_featherCanvas.height, h);
  }
  const f = _featherCtx;
  f.save();
  f.setTransform(1, 0, 0, 1, 0, 0);
  f.clearRect(0, 0, w + 2, h + 2);
  f.fillStyle = '#000000';
  for (const [dx, dy] of shifts) {
    f.setTransform(k, 0, 0, k, (ox + dx) * k, (oy + dy) * k);
    drawMaskFn(f);
  }
  f.restore();
  rCtx.save();
  rCtx.setTransform(1, 0, 0, 1, 0, 0);
  rCtx.globalCompositeOperation = 'destination-out';
  rCtx.globalAlpha = alpha;
  rCtx.imageSmoothingEnabled = true;
  rCtx.imageSmoothingQuality = 'high';
  rCtx.drawImage(_featherCanvas, 0, 0, w, h, 0, 0, boxW, boxH);
  rCtx.restore();
}

function getReflScratch(w = 1200, h = 1200) {
  if (!_reflCanvas) {
    _reflCanvas = document.createElement('canvas');
    _reflCtx = _reflCanvas.getContext('2d');
  }
  if (_reflCanvas.width < w || _reflCanvas.height < h) {
    _reflCanvas.width = Math.max(_reflCanvas.width, w);
    _reflCanvas.height = Math.max(_reflCanvas.height, h);
  }
  return { canvas: _reflCanvas, ctx: _reflCtx };
}

// ---------------------------------------------------------------------------
// 4. Multi-Temperature Dreamy Sky, Aurora Ribbons, Bokeh & Starfield
// ---------------------------------------------------------------------------

/**
 * Renders the multi-temperature twilight sky gradient, ambient color washes, and dynamic point-light blooms.
 */
export function drawDreamyBackdrop(ctx, w, h, look = TWILIGHT_LOOKS.twilight, lights = [], t = 0, opts = {}) {
  const pal = getTwilightLook(look);
  const horizonY = opts.horizonY ?? h * 0.72;

  ctx.save();

  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY + h * 0.08);
  skyGrad.addColorStop(0, pal.skyTop);
  skyGrad.addColorStop(0.55, pal.skyMid);
  skyGrad.addColorStop(1, pal.skyHorizon);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Ambient mist washes: generated from `opts.seed` + the look (no fixed screen layout).
  // Pass `opts.ambientWashes` for full control, or `opts.washCount: 0` to disable.
  const washes = opts.ambientWashes || makeAmbientWashes(w, h, horizonY, pal, opts.seed ?? 1, opts.washCount ?? 3);

  for (const wash of washes) {
    const wx = wash.x + Math.sin(t * 0.35 + (wash.phase || 0)) * 12;
    const wy = wash.y + Math.cos(t * 0.28 + (wash.phase || 0)) * 9;
    const rx = wash.rx ?? wash.r ?? 480;
    const ry = wash.ry ?? wash.r ?? 420;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.scale(1, ry / Math.max(1, rx));
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    const a = wash.alpha ?? 0.34;
    g.addColorStop(0, rgba(wash.color, a));
    g.addColorStop(0.48, rgba(wash.midColor || wash.color, a * 0.58));
    g.addColorStop(0.80, rgba(wash.outerColor || wash.midColor || wash.color, a * 0.22));
    g.addColorStop(1, rgba(wash.outerColor || wash.color, 0));
    if (wash.blend) ctx.globalCompositeOperation = wash.blend;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Dynamic point-light atmospheric halos
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const light of lights) {
    if (!light || (light.intensity ?? 1) <= 0.01) continue;
    const r = (light.r || 420) * (light.backdropScale ?? 1.22);
    const alpha = clamp((light.intensity ?? 1) * (light.backdropAlpha ?? 0.30), 0, 0.78);
    const g = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, r);
    const midCol = light.color || pal.warmGlow;
    const outerCol = light.outerColor || pal.mistColor;
    g.addColorStop(0, rgba(light.coreColor || '#FFFBEB', alpha * 0.88));
    g.addColorStop(0.30, rgba(midCol, alpha * 0.58));
    g.addColorStop(0.65, rgba(outerCol, alpha * 0.25));
    g.addColorStop(1, rgba(outerCol, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(light.x, light.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}

/**
 * Seeded ambient wash layout: `count` soft colour clouds whose positions, sizes and colour pairing
 * are derived from `seed` and the look. Different seeds give genuinely different skies.
 */
export function makeAmbientWashes(w, h, horizonY, look, seed = 1, count = 3) {
  const pal = getTwilightLook(look);
  const rnd = seededRandom(seed * 3.7 + 1);
  const colorPairs = [
    [pal.coolGlow, pal.mistColor],
    [pal.warmGlow, pal.warmMid || pal.mistColor],
    [pal.mistColor, pal.skyHorizon],
    [pal.warmMid || pal.warmGlow, pal.skyHorizon],
  ];
  const out = [];
  for (let i = 0; i < count; i++) {
    const [color, midColor] = colorPairs[Math.floor(rnd() * colorPairs.length)];
    const low = i === count - 1; // keep one wash near the horizon so the frame keeps a bright band
    out.push({
      x: w * lerp(0.08, 0.92, rnd()),
      y: low ? horizonY * lerp(0.78, 0.96, rnd()) : horizonY * lerp(0.18, 0.7, rnd()),
      rx: w * lerp(0.28, 0.6, rnd()),
      ry: h * lerp(0.2, 0.4, rnd()),
      color,
      midColor,
      alpha: lerp(0.2, 0.34, rnd()),
      phase: rnd() * 6.28,
    });
  }
  return out;
}

/**
 * Draws bioluminescent aurora across the sky (`drawAuroraRibbons`).
 *   opts.mode   'bands' (horizontal ribbons) | 'curtains' (hanging vertical drapes) | 'arc' (one sweeping bow)
 *   opts.seed   layout seed — positions, phases and thickness come from it (give each scene its own)
 *   opts.look   look object/name: default colours come from it instead of a fixed palette
 *   opts.yBands explicit band centre Ys (bands mode) · opts.x0/x1 horizontal extent (curtains/arc)
 */
export function drawAuroraRibbons(ctx, w, h, t = 0, opts = {}) {
  const mode = opts.mode || 'bands';
  const seed = opts.seed ?? 1;
  const rnd = seededRandom(seed * 5.3 + 2);
  const pal = opts.look ? getTwilightLook(opts.look) : null;
  const count = opts.count ?? 3;
  const maxY = opts.maxY ?? h * 0.52;
  const colors =
    opts.colors || (pal ? [pal.coolGlow, pal.mistColor, pal.warmGlow, pal.foliageGlow] : ['#5EEAD4', '#67E8F9', '#C084FC', '#FDE047']);
  const baseAlpha = opts.alpha ?? 0.26;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  if (mode === 'curtains') {
    const x0 = opts.x0 ?? 0;
    const x1 = opts.x1 ?? w;
    const curtains = Math.max(2, opts.count ?? 3);
    for (let c = 0; c < curtains; c++) {
      const colA = colors[c % colors.length];
      const colB = colors[(c + 1) % colors.length];
      const baseTop = maxY * lerp(0.10, 0.34, (c + 0.3 * rnd()) / curtains);
      const curtainH = maxY * lerp(0.42, 0.68, rnd());
      const ph = rnd() * 6.28 + c * 1.7;
      const steps = 36;
      const waveX = (u) => lerp(x0, x1, u) + Math.sin(u * 4.5 + t * 0.35 + ph) * 28;
      const waveY = (u) =>
        baseTop +
        Math.sin(u * 5.2 + t * 0.42 + ph) * 34 +
        Math.cos(u * 9.5 - t * 0.28 + ph) * 16;

      // Soft overarching curtain veil
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const px = waveX(u);
        const py = waveY(u);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (let i = steps; i >= 0; i--) {
        const u = i / steps;
        const px = waveX(u) + Math.sin(u * 7 + t * 0.5) * 18;
        const py = waveY(u) + curtainH * (0.65 + 0.35 * Math.sin(u * Math.PI));
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      const vg = ctx.createLinearGradient(0, baseTop - 30, 0, baseTop + curtainH + 30);
      vg.addColorStop(0, rgba(colA, 0));
      vg.addColorStop(0.28, rgba(colA, baseAlpha * 0.85));
      vg.addColorStop(0.68, rgba(colB, baseAlpha * 0.55));
      vg.addColorStop(1, rgba(colB, 0));
      ctx.fillStyle = vg;
      ctx.fill();

      // Soft vertical shimmer folds inside the curtain
      const folds = 9;
      for (let f = 0; f < folds; f++) {
        const fu = (f + 0.5 + 0.25 * Math.sin(t * 0.4 + f)) / folds;
        const fx = waveX(fu);
        const fy = waveY(fu);
        const fh = curtainH * (0.55 + 0.35 * Math.sin(fu * Math.PI));
        const fw = lerp(45, 95, hash11(f * 3.1 + c + seed));
        const fg = ctx.createRadialGradient(fx, fy + fh * 0.35, 2, fx, fy + fh * 0.35, fw);
        fg.addColorStop(0, rgba('#FFFFFF', baseAlpha * 0.42));
        fg.addColorStop(0.45, rgba(colA, baseAlpha * 0.28));
        fg.addColorStop(1, rgba(colA, 0));
        ctx.save();
        ctx.translate(fx, fy + fh * 0.35);
        ctx.scale(1, (fh * 0.55) / fw);
        ctx.translate(-fx, -(fy + fh * 0.35));
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(fx, fy + fh * 0.35, fw, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
    return;
  }

  if (mode === 'arc') {
    const cx = opts.cx ?? lerp(w * 0.25, w * 0.75, rnd());
    const cy = opts.cy ?? maxY * 1.85;
    const r = opts.radius ?? maxY * 1.48;
    for (let k = 0; k < count; k++) {
      const colA = colors[k % colors.length];
      const colB = colors[(k + 1) % colors.length];
      const rr = r - k * lerp(38, 64, rnd());
      const bandW = lerp(55, 95, rnd());
      const a0 = Math.PI * (1.06 + 0.04 * Math.sin(t * 0.3 + k));
      const a1 = Math.PI * (1.94 - 0.04 * Math.cos(t * 0.27 + k));
      const steps = 40;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const a = lerp(a0, a1, u);
        const wob = Math.sin(i * 0.45 + t * 0.55 + k) * 10;
        const px = cx + Math.cos(a) * (rr + wob);
        const py = cy + Math.sin(a) * (rr + wob);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (let i = steps; i >= 0; i--) {
        const u = i / steps;
        const a = lerp(a0, a1, u);
        const wob = Math.sin(i * 0.45 + t * 0.55 + k) * 10;
        const thick = bandW * Math.sin(u * Math.PI);
        const px = cx + Math.cos(a) * (rr - thick + wob);
        const py = cy + Math.sin(a) * (rr - thick + wob);
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      const ag = ctx.createRadialGradient(cx, cy, Math.max(10, rr - bandW), cx, cy, rr + 20);
      ag.addColorStop(0, rgba(colB, 0));
      ag.addColorStop(0.45, rgba(colA, baseAlpha * (1 - k * 0.18)));
      ag.addColorStop(0.8, rgba(colB, baseAlpha * 0.55));
      ag.addColorStop(1, rgba(colA, 0));
      ctx.fillStyle = ag;
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  const yBands = opts.yBands || Array.from({ length: count }, (_, r) => maxY * lerp(0.15, 0.85, (r + rnd() * 0.8) / count));
  for (let r = 0; r < yBands.length; r++) {
    const colA = colors[r % colors.length];
    const colB = colors[(r + 1) % colors.length];
    const yBase = yBands[r];
    const bandH = lerp(70, 150, rnd()) * (opts.heightScale ?? 1.0);
    const freqA = lerp(3.2, 6.0, rnd());
    const freqB = lerp(6.5, 10.5, rnd());
    const ampA = lerp(20, 50, rnd());
    const tilt = (opts.tilt ?? lerp(-0.08, 0.08, rnd())) * h;
    const ph = rnd() * 6.28;

    ctx.beginPath();
    const steps = 28;
    const waveAt = (u) =>
      Math.sin(u * freqA + t * (0.45 + r * 0.12) + ph) * ampA +
      Math.cos(u * freqB - t * 0.32 + ph * 0.7) * ampA * 0.4 +
      (u - 0.5) * tilt;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = u * w;
      const y = yBase + waveAt(u);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = steps; i >= 0; i--) {
      const u = i / steps;
      const x = u * w;
      const y = yBase + waveAt(u) + bandH * (0.65 + 0.35 * Math.sin(u * Math.PI));
      ctx.lineTo(x, y);
    }
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, yBase - 40, 0, yBase + bandH + 40);
    grad.addColorStop(0, rgba(colA, 0));
    grad.addColorStop(0.35, rgba(colA, baseAlpha));
    grad.addColorStop(0.70, rgba(colB, baseAlpha * 0.65));
    grad.addColorStop(1, rgba(colB, 0));
    ctx.fillStyle = grad;
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Generates a deterministic array of optical Bokeh circles (`createBokehOrbs`) for use with `drawBokehField`.
 */
export function createBokehOrbs(count = 28, w = 1920, h = 1080, opts = {}) {
  const seed = opts.seed ?? 42;
  const lp = opts.look ? getTwilightLook(opts.look) : null;
  const palette =
    opts.colors ||
    (lp
      ? [lp.warmGlow, lp.warmMid, lp.coolGlow, lp.mistColor, lp.foliageGlow, lp.skyHorizon]
      : ['#FEF08A', '#FDBA74', '#67E8F9', '#C4B5FD', '#F9A8D4', '#5EEAD4']);
  const minR = opts.minR ?? 18;
  const maxR = opts.maxR ?? 78;
  const orbs = [];
  for (let i = 0; i < count; i++) {
    const h1 = hash11(seed + i * 5.13);
    const h2 = hash11(seed + i * 11.7);
    const h3 = hash11(seed + i * 19.3);
    const h4 = hash11(seed + i * 29.1);
    const color = palette[i % palette.length];
    orbs.push({
      x: h1 * w,
      y: h2 * h,
      r: lerp(minR, maxR, Math.pow(h3, 1.35)),
      color,
      coreColor: mixHex(color, '#FFFFFF', 0.72),
      edgeColor: mixHex(color, '#F59E0B', 0.25),
      alpha: lerp(0.18, 0.46, 1 - h3 * 0.55) * (opts.alphaScale ?? 1.0),
      softness: lerp(0.16, 0.42, h4),
      speed: lerp(0.32, 0.75, h1),
      ampX: lerp(10, 28, h2),
      ampY: lerp(10, 24, h3),
      riseSpeed: lerp(6, 22, h4),
      phase: i * 1.37,
    });
  }
  return orbs;
}

/**
 * Renders fast-aperture (`f/1.2`) creamy optical Bokeh circles with bright inner cores and soft feathered edges.
 */
export function drawBokehField(ctx, w, h, bokehs = [], t = 0) {
  ctx.save();
  for (const b of bokehs) {
    const phase = b.phase ?? 0;
    const speed = b.speed ?? 0.45;
    const driftX = Math.sin(t * speed + phase) * (b.ampX ?? 14);
    const driftY =
      Math.cos(t * speed * 0.85 + phase * 1.3) * (b.ampY ?? 14) -
      t * (b.riseSpeed ?? 12);
    const x = b.x + driftX;
    const y = (((b.y + driftY) % (h + 160)) + (h + 160)) % (h + 160) - 80;
    const pulse = 1 + Math.sin(t * (b.pulseSpeed ?? 1.6) + phase) * (b.pulseAmp ?? 0.06);
    const r = (b.r ?? 28) * pulse;
    const alpha = clamp(
      (b.alpha ?? 0.42) * (0.92 + 0.08 * Math.sin(t * 2.0 + phase)),
      0.02,
      1.0
    );
    const color = b.color || '#FDE68A';
    const coreColor = b.coreColor || mixHex(color, '#FFFFFF', 0.65);
    const edgeColor = b.edgeColor || mixHex(color, '#FB923C', 0.35);

    ctx.save();
    ctx.globalCompositeOperation = b.blend || 'screen';
    ctx.translate(x, y);
    if (b.angle) ctx.rotate(b.angle);
    if (b.stretchX || b.stretchY) ctx.scale(b.stretchX ?? 1, b.stretchY ?? 1);

    const softness = clamp(b.softness ?? 0.22, 0.08, 0.65);
    const innerEdge = clamp(0.76 - softness * 0.35, 0.32, 0.84);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, rgba(coreColor, alpha));
    g.addColorStop(innerEdge * 0.78, rgba(coreColor, alpha * 0.94));
    g.addColorStop(innerEdge, rgba(color, alpha * 0.88));
    g.addColorStop(
      Math.min(0.96, innerEdge + (1 - innerEdge) * 0.45),
      rgba(edgeColor, alpha * 0.38)
    );
    g.addColorStop(1, rgba(edgeColor, 0));

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Renders twinkling twilight stars and optional shooting meteors across the upper sky.
 */
export function drawStarfieldAndMeteors(ctx, w, h, t = 0, opts = {}) {
  const starCount = opts.starCount ?? 80;
  const maxY = opts.maxY ?? h * 0.68;
  const seed = opts.seed ?? 17;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let i = 0; i < starCount; i++) {
    const h1 = hash11(seed + i * 3.17);
    const h2 = hash11(seed + i * 7.31);
    const h3 = hash11(seed + i * 13.7);
    const sx = h1 * w;
    const sy = Math.pow(h2, 1.1) * maxY;
    const r = 0.8 + Math.pow(h3, 2.3) * 2.4;
    const twinkle = 0.55 + 0.45 * Math.sin(t * (1.8 + h1 * 3.2) + h2 * 12);
    const alpha = (0.28 + 0.65 * h3) * twinkle;
    const col = h3 > 0.70 ? '#FEF08A' : h3 > 0.36 ? '#E0F2FE' : '#DDD6FE';

    if (r > 1.7) {
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.0);
      g.addColorStop(0, rgba('#FFFFFF', alpha));
      g.addColorStop(0.35, rgba(col, alpha * 0.62));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 3.0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = rgba(col, alpha);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const meteors = opts.meteors || [];
  for (const m of meteors) {
    const pulse = 0.85 + 0.15 * Math.sin(t * 1.6 + (m.phase || 0));
    const slide = (t * (m.speed ?? 0.35)) % 1.0;
    const dx = (m.x2 - m.x1) * slide * 0.25;
    const dy = (m.y2 - m.y1) * slide * 0.25;
    const x1 = m.x1 + dx;
    const y1 = m.y1 + dy;
    const x2 = m.x2 + dx;
    const y2 = m.y2 + dy;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    const col = m.color || '#FEF08A';
    const a = (m.alpha ?? 0.68) * pulse;
    grad.addColorStop(0, rgba(col, 0));
    grad.addColorStop(0.45, rgba(col, a * 0.55));
    grad.addColorStop(0.82, rgba('#FFFFFF', a));
    grad.addColorStop(1, rgba(col, 0));

    ctx.strokeStyle = grad;
    ctx.lineWidth = m.width ?? 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws a tapered stardust ribbon trail behind any spline-guided object (`evalFn(u)`).
 */
export function drawStarTrail(ctx, evalFn, uNow, t = 0, opts = {}) {
  const span = opts.span ?? 0.26;
  const steps = opts.steps ?? 20;
  const width = opts.width ?? 9;
  const color = opts.color || '#FDE047';
  const alpha = opts.alpha ?? 0.62;

  if (uNow <= 0.005) return;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let i = 0; i < steps - 1; i++) {
    const f0 = i / (steps - 1);
    const f1 = (i + 1) / (steps - 1);
    const u0 = Math.max(0, uNow - span * (1 - f0));
    const u1 = Math.max(0, uNow - span * (1 - f1));
    if (u1 <= u0 + 1e-4) continue;
    const p0 = evalFn(u0);
    const p1 = evalFn(u1);
    const segAlpha = Math.pow(f1, 1.5) * alpha;
    ctx.strokeStyle = rgba(f1 > 0.7 ? '#FFFBEB' : color, segAlpha * 0.65);
    ctx.lineWidth = Math.max(1, width * f1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  const moteCount = opts.moteCount ?? 12;
  for (let i = 0; i < moteCount; i++) {
    const f = (i + 0.5) / moteCount;
    const uMote = uNow - span * (1 - f) * 1.12;
    if (uMote < 0 || uMote > 1) continue;
    const p = evalFn(uMote);
    const age = 1 - f;
    const ox = Math.sin(i * 7.3 + t * 2.4) * (5 + age * 24);
    const oy = Math.cos(i * 5.1 + t * 2.0) * (5 + age * 20) - age * 12;
    const r = (1.5 + hash11(i * 13.7) * 3.2) * f;
    const g = ctx.createRadialGradient(p.x + ox, p.y + oy, 0, p.x + ox, p.y + oy, r * 2.6);
    g.addColorStop(0, rgba('#FFFFFF', alpha * f));
    g.addColorStop(0.45, rgba(color, alpha * f * 0.65));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x + ox, p.y + oy, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 5. Silk-Mirror Water Surface, Reflections & Expanding Stream Ripples
// ---------------------------------------------------------------------------

/**
 * Shared water painter: fills the CURRENT clip with a vertical water gradient between `topY` and `bottomY`,
 * point-light specular glints and seeded silk sheen bands. Used by `drawWaterSurface`, `drawPond`,
 * and `drawStreamPath`.
 */
function paintWater(ctx, x0, x1, topY, bottomY, pal, lights, t, opts = {}) {
  const w = x1 - x0;
  const h = Math.max(8, bottomY - topY);
  const waterGrad = ctx.createLinearGradient(0, topY - 12, 0, bottomY);
  waterGrad.addColorStop(0, pal.waterTop);
  waterGrad.addColorStop(0.36, pal.waterMid);
  waterGrad.addColorStop(1, pal.waterDeep);
  ctx.fillStyle = waterGrad;
  ctx.fillRect(x0, topY - 4, w, h + 8);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const l of lights) {
    if (!l || (l.intensity ?? 1) <= 0.01) continue;
    const rx = (l.r || 380) * 0.52;
    const ry = rx * 0.24;
    const reflY = clamp(topY + (topY - l.y) * 0.22 + 38, topY + 14, bottomY - 8);
    ctx.save();
    ctx.translate(l.x, reflY);
    ctx.scale(1, ry / Math.max(1, rx));
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    const a = clamp((l.intensity ?? 1) * 0.34, 0, 0.68);
    g.addColorStop(0, rgba(l.coreColor || '#FFFFFF', a));
    g.addColorStop(0.42, rgba(l.color || pal.warmGlow, a * 0.62));
    g.addColorStop(1, rgba(l.color || pal.warmGlow, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Silk sheen bands: explicit `opts.sheenBands`, otherwise a seeded layout inside the water bounds.
  let bands = opts.sheenBands;
  if (!bands) {
    const rnd = seededRandom((opts.seed ?? 1) * 7.1 + 3);
    const n = opts.sheenCount ?? 4;
    const cols = [pal.coolGlow, pal.warmGlow, pal.mistColor];
    bands = Array.from({ length: n }, (_, i) => ({
      x: x0 + w * lerp(0.15, 0.85, rnd()),
      y: topY + h * lerp(0.06, 0.75, (i + rnd()) / n),
      rx: w * lerp(0.12, 0.26, rnd()),
      ry: lerp(6, 12, rnd()),
      color: cols[Math.floor(rnd() * cols.length)],
      alpha: lerp(0.16, 0.24, rnd()),
    }));
  }
  for (const [i, b] of bands.entries()) {
    const drift = Math.sin(t * 0.9 + i * 1.4) * 14;
    ctx.save();
    ctx.translate(b.x + drift, b.y);
    ctx.scale(1, b.ry / Math.max(1, b.rx));
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.rx);
    g.addColorStop(0, rgba(b.color, b.alpha));
    g.addColorStop(0.5, rgba(b.color, b.alpha * 0.45));
    g.addColorStop(1, rgba(b.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, b.rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Full-width silk-mirror water from `horizonY` to the bottom of the frame (lake / sea / wide shallows).
 * Only use it when the story's place really is open water — for brooks use `drawStreamPath`,
 * for puddles and ponds use `drawPond`, and for land use `drawGroundMass`.
 */
export function drawWaterSurface(ctx, w, h, horizonY, look = TWILIGHT_LOOKS.twilight, lights = [], t = 0, opts = {}) {
  const pal = getTwilightLook(look);
  ctx.save();
  paintWater(ctx, 0, w, horizonY, h, pal, lights, t, opts);

  // Soft horizon mist cushion blending sky and water
  const mistGrad = ctx.createLinearGradient(0, horizonY - 42, 0, horizonY + 46);
  mistGrad.addColorStop(0, rgba(pal.skyHorizon, 0));
  mistGrad.addColorStop(0.48, rgba(pal.skyHorizon, 0.72));
  mistGrad.addColorStop(1, rgba(pal.waterTop, 0));
  ctx.fillStyle = mistGrad;
  ctx.fillRect(0, horizonY - 42, w, 88);
  ctx.restore();
}

/**
 * Organic pond / puddle / basin of water (`drawPond`) clipped to a wobbly ellipse.
 *   opts.seed (outline wobble), opts.wobble (0..0.2), opts.rimColor, opts.rimAlpha
 * Returns the outline tracer so callers can reuse it (e.g. to clip reflections).
 */
export function drawPond(ctx, cx, cy, rx, ry, look = TWILIGHT_LOOKS.twilight, lights = [], t = 0, opts = {}) {
  const pal = getTwilightLook(look);
  const seed = opts.seed ?? 1;
  const wob = opts.wobble ?? 0.06;
  const trace = (c, scaleM = 1) => {
    c.beginPath();
    const N = 56;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const k = 1 + noise1D(Math.cos(a) * 2.0 + 5, seed) * wob + noise1D(Math.sin(a) * 2.0 + 9, seed + 3) * wob * 0.5;
      const px = cx + Math.cos(a) * rx * k * scaleM;
      const py = cy + Math.sin(a) * ry * k * scaleM;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
  };
  // Soft recessed bank shadow & mossy rim cushion around the pond
  ctx.save();
  trace(ctx, 1.06);
  const bankGrad = ctx.createLinearGradient(0, cy - ry * 1.1, 0, cy + ry * 1.1);
  bankGrad.addColorStop(0, rgba(pal.groundDeep, 0.75));
  bankGrad.addColorStop(0.5, rgba(pal.groundMid, 0.45));
  bankGrad.addColorStop(1, rgba(pal.groundDeep, 0.65));
  ctx.fillStyle = bankGrad;
  ctx.fill();
  ctx.restore();

  ctx.save();
  trace(ctx, 1.0);
  ctx.clip();
  paintWater(ctx, cx - rx * 1.3, cx + rx * 1.3, cy - ry * 1.1, cy + ry * 1.1, pal, lights, t, { ...opts, sheenCount: opts.sheenCount ?? 3 });
  // Soft inner shore vignette so the pond feels recessed into the earth
  const shoreGrad = ctx.createRadialGradient(cx, cy + ry * 0.08, Math.min(rx, ry) * 0.35, cx, cy, Math.max(rx, ry));
  shoreGrad.addColorStop(0, rgba(pal.waterTop, 0));
  shoreGrad.addColorStop(0.75, rgba(pal.waterDeep, 0.15));
  shoreGrad.addColorStop(1, rgba(pal.groundDeep, 0.65));
  ctx.fillStyle = shoreGrad;
  ctx.fillRect(cx - rx * 1.2, cy - ry * 1.2, rx * 2.4, ry * 2.4);
  ctx.restore();

  // Soft bioluminescent water-edge glow
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  trace(ctx, 1.0);
  ctx.strokeStyle = rgba(opts.rimColor || pal.coolGlow, (opts.rimAlpha ?? 0.35) * 0.5);
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.strokeStyle = rgba(opts.rimColor || pal.mistColor, opts.rimAlpha ?? 0.38);
  ctx.lineWidth = opts.rimWidth ?? 2.0;
  ctx.stroke();
  ctx.restore();
  return trace;
}

/**
 * A brook / stream that follows a path across the frame (`drawStreamPath`).
 *   path    [[x, y], ...] centre-line points (any direction: diagonal, S-curve, receding into depth)
 *   widthFn (u) => half-width in px, or a number; defaults widen toward the bottom of the frame (perspective)
 * Returns the outline tracer.
 */
export function drawStreamPath(ctx, path, widthFn = null, look = TWILIGHT_LOOKS.twilight, lights = [], t = 0, opts = {}) {
  if (!Array.isArray(path) || path.length < 2) {
    reportOnce('stream-path', 'drawStreamPath(ctx, path, ...) needs a centre-line path of at least 2 points.');
    return null;
  }
  const pal = getTwilightLook(look);
  const ys = path.map((p) => p[1]);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const wf =
    typeof widthFn === 'function'
      ? widthFn
      : (u) => {
          const p = sampleSmoothChain(path, u);
          const depth = clamp((p.y - minY) / Math.max(1, maxY - minY), 0, 1);
          return (typeof widthFn === 'number' ? widthFn : 60) * lerp(0.12, 1.25, Math.pow(depth, 1.15));
        };
  // Taper the far source tip smoothly to a point so it never sticks up above the horizon like a round thumb
  const taperedWf = (u) => wf(u) * smootherstep(0, 0.08, u);
  const steps = opts.steps ?? 32;
  const trace = (c, extraW = 0) => {
    const left = [];
    const right = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const sp = sampleSmoothChain(path, u);
      const w = taperedWf(u) + extraW * smootherstep(0, 0.08, u);
      left.push([sp.x + sp.nx * w, sp.y + sp.ny * w]);
      right.push([sp.x - sp.nx * w, sp.y - sp.ny * w]);
    }
    c.beginPath();
    c.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i <= steps; i++) {
      const p = left[i - 1];
      const q = left[i];
      c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) * 0.5, (p[1] + q[1]) * 0.5);
    }
    c.lineTo(left[steps][0], left[steps][1]);
    c.lineTo(right[steps][0], right[steps][1]);
    for (let i = steps - 1; i >= 0; i--) {
      const p = right[i + 1];
      const q = right[i];
      c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) * 0.5, (p[1] + q[1]) * 0.5);
    }
    c.closePath();
  };
  const xs = path.map((p) => p[0]);
  const pad = 260;
  // Soft recessed earth bank along the stream edges
  ctx.save();
  trace(ctx, 8);
  ctx.fillStyle = rgba(pal.groundDeep, 0.55);
  ctx.fill();
  ctx.restore();

  ctx.save();
  trace(ctx, 0);
  ctx.clip();
  paintWater(ctx, Math.min(...xs) - pad, Math.max(...xs) + pad, minY - 20, maxY + pad * 0.5, pal, lights, t, opts);
  // Flowing silk current lines along the stream path
  ctx.globalCompositeOperation = 'screen';
  for (const [off, col, lw, al] of [[-0.35, pal.coolGlow, 2.2, 0.28], [0.05, pal.mistColor, 3.0, 0.32], [0.38, pal.warmGlow, 1.8, 0.22]]) {
    ctx.strokeStyle = rgba(col, al);
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 2; i <= steps; i++) {
      const u = i / steps;
      const sp = sampleSmoothChain(path, u);
      const w = taperedWf(u);
      const wave = Math.sin(u * 14 - t * 2.4 + off * 5) * w * 0.12;
      const px = sp.x + sp.nx * (w * off + wave);
      const py = sp.y + sp.ny * (w * off + wave);
      if (i === 2) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  trace(ctx, 0);
  ctx.strokeStyle = rgba(opts.rimColor || pal.mistColor, (opts.rimAlpha ?? 0.32) * 0.65);
  ctx.lineWidth = opts.rimWidth ?? 2.0;
  ctx.stroke();
  ctx.restore();
  return trace;
}

/**
 * Draws a shimmering multi-row elliptical light reflection column on the water (`drawLightWaterReflection`).
 */
export function drawLightWaterReflection(ctx, x, waterY, r = 65, color = '#FDE68A', t = 0, opts = {}) {
  const depth = opts.depth ?? r * 0.92;
  const alpha = opts.alpha ?? 0.68;
  const coreColor = opts.coreColor || '#FFFFFF';
  if (alpha <= 0.01 || r <= 1) return;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  ctx.save();
  ctx.translate(x, waterY + depth * 0.45);
  ctx.scale(1.5, 0.52);
  const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.18);
  bg.addColorStop(0, rgba(coreColor, alpha * 0.72));
  bg.addColorStop(0.45, rgba(color, alpha * 0.46));
  bg.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const rows = Math.max(16, Math.round(depth / 2.0));
  const rowH = depth / rows;
  for (let i = 0; i < rows; i++) {
    const u = i / Math.max(1, rows - 1);
    const sy = waterY + i * rowH;
    const envelope = Math.pow(Math.max(0, Math.sin(u * Math.PI)), 0.45);
    const wave = Math.sin(u * 12 - t * 2.6 + x * 0.02) * (3 + u * 6);
    const widthMod = 0.85 + 0.16 * Math.cos(u * 14 + t * 2.0);
    const rw = Math.max(2, r * 0.84 * envelope * widthMod);
    const rowAlpha = alpha * (0.94 - u * 0.45) * envelope;

    const rg = ctx.createLinearGradient(x + wave - rw, sy, x + wave + rw, sy);
    rg.addColorStop(0, rgba(color, 0));
    rg.addColorStop(0.22, rgba(color, rowAlpha * 0.78));
    rg.addColorStop(0.5, rgba(coreColor, rowAlpha));
    rg.addColorStop(0.78, rgba(color, rowAlpha * 0.78));
    rg.addColorStop(1, rgba(color, 0));

    ctx.fillStyle = rg;
    ctx.fillRect(x + wave - rw, sy, rw * 2, rowH + 0.9);
  }

  ctx.restore();
}

/**
 * Draws expanding perspective-flattened concentric water ripple rings & splashing light droplets.
 */
export function drawStreamRipples(ctx, ripples = [], t = 0) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (const rp of ripples) {
    const age = t - (rp.t0 ?? 0);
    const dur = rp.dur ?? 1.4;
    if (age < 0 || age > dur) continue;

    const u = age / dur;
    const maxRx = rp.maxRx ?? 180;
    const aspect = rp.aspect ?? 0.22;
    const color = rp.color || '#67E8F9';
    const coreColor = rp.coreColor || '#FFFFFF';
    const ringCount = rp.rings ?? 3;

    for (let k = 0; k < ringCount; k++) {
      const ku = clamp((u - k * 0.14) / (1 - k * 0.14), 0, 1);
      if (ku <= 0) continue;
      const kease = 1 - Math.pow(1 - ku, 2.1);
      const kfade = Math.pow(1 - ku, 1.2) * (1 - k * 0.22);
      const rx = Math.max(6, maxRx * kease);
      const ry = Math.max(2, rx * aspect);

      ctx.strokeStyle = rgba(k === 0 ? coreColor : color, (rp.alpha ?? 0.78) * kfade);
      ctx.lineWidth = Math.max(1.2, (rp.lineWidth ?? 3.0) * (1 - ku * 0.55));
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const splashCount = rp.splashCount ?? 0;
    if (splashCount > 0 && u < 0.75) {
      const su = u / 0.75;
      for (let i = 0; i < splashCount; i++) {
        const h1 = hash11(i * 17.3 + (rp.seed || 1));
        const h2 = hash11(i * 31.1 + (rp.seed || 1));
        const vx = (h1 - 0.5) * maxRx * 1.15;
        const peakH = (40 + h2 * 80) * (rp.splashHeight ?? 1.0);
        const sx = rp.x + vx * su;
        const sy = rp.y - 4 * peakH * su * (1 - su);
        const sr = (2.0 + h2 * 3.0) * (1 - su * 0.65);

        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.5);
        g.addColorStop(0, rgba('#FFFFFF', (1 - su) * 0.92));
        g.addColorStop(0.5, rgba(color, (1 - su) * 0.62));
        g.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, sr * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 6. Dual-Pass Normal-Dot-Light Rim Renderer (`drawLitOrganicShape`)
// ---------------------------------------------------------------------------

/**
 * Renders any unified multi-part silhouette (`drawMaskFn`) on an offscreen canvas and applies:
 *   - Base gradient + ground/water bounce light (`bounceColor`) + optional `drawInnerDetailsFn`
 *   - Pass A: Soft subsurface inner glow (`softWidth`)
 *   - Pass B: Crisp normal-dot-light directional rim crescent (`rimWidth`)
 */
export function drawLitOrganicShape(ctx, drawMaskFn, shapeOpts = {}, lights = []) {
  const cx = shapeOpts.cx ?? 960;
  const cy = shapeOpts.cy ?? 720;
  const radius = shapeOpts.radius ?? 160;
  const pad = Math.min(620, Math.ceil(radius * 1.75 + 56));
  const boxW = pad * 2;
  const boxH = pad * 2;
  const ox = pad - cx;
  const oy = pad - cy;

  const { canvas: sCan, ctx: sCtx } = getShapeScratch(boxW, boxH);
  const { canvas: rCan, ctx: rCtx } = getRimScratch(boxW, boxH);
  const featherBox = { ox, oy, boxW, boxH };

  // 1. Opaque silhouette mask
  sCtx.save();
  sCtx.setTransform(1, 0, 0, 1, 0, 0);
  sCtx.clearRect(0, 0, boxW, boxH);
  sCtx.translate(ox, oy);
  sCtx.fillStyle = '#FFFFFF';
  drawMaskFn(sCtx);
  sCtx.restore();

  // 2. Base velvet gradient + water bounce light
  sCtx.save();
  sCtx.setTransform(1, 0, 0, 1, 0, 0);
  sCtx.translate(ox, oy);
  sCtx.globalCompositeOperation = 'source-in';

  const baseDark = shapeOpts.baseDark || '#171338';
  const baseMid = shapeOpts.baseMid || '#2A225C';
  const bounceColor = shapeOpts.bounceColor || '#60A5FA';
  const bounceAlpha = shapeOpts.bounceAlpha ?? 0.52;
  const rimScale = shapeOpts.rimScale ?? 1.0;
  const rimIntensity = shapeOpts.rimIntensity ?? 1.0;

  const baseGrad = sCtx.createLinearGradient(cx, cy - radius, cx, cy + radius);
  baseGrad.addColorStop(0, baseDark);
  baseGrad.addColorStop(0.62, baseMid);
  baseGrad.addColorStop(1, mixHex(baseMid, bounceColor, bounceAlpha));
  sCtx.fillStyle = baseGrad;
  sCtx.fillRect(cx - pad, cy - pad, boxW, boxH);

  sCtx.globalCompositeOperation = 'source-atop';
  if (bounceAlpha > 0.01) {
    const bounceGrad = sCtx.createRadialGradient(
      cx,
      cy + radius * 0.75,
      radius * 0.05,
      cx,
      cy + radius * 0.68,
      radius * 1.15
    );
    bounceGrad.addColorStop(0, rgba(bounceColor, bounceAlpha * 0.62));
    bounceGrad.addColorStop(0.55, rgba(bounceColor, bounceAlpha * 0.24));
    bounceGrad.addColorStop(1, rgba(bounceColor, 0));
    sCtx.fillStyle = bounceGrad;
    sCtx.fillRect(cx - pad, cy - pad, boxW, boxH);
  }

  if (typeof shapeOpts.drawInnerDetailsFn === 'function') {
    sCtx.save();
    sCtx.globalCompositeOperation = 'source-atop';
    shapeOpts.drawInnerDetailsFn(sCtx);
    sCtx.restore();
  }

  // Core shadow (`coreShade: { color, alpha, width }`): every part — each leg, the neck, the tail — darkens along the
  // edge turned away from the light (strongest scene light blended with sky-from-above), so thin parts read as round
  // volumes instead of flat cut-outs. Same offset-mask feather as the rim passes, mirrored.
  if (shapeOpts.coreShade && (shapeOpts.coreShade.alpha ?? 0) > 0.01) {
    const cs = shapeOpts.coreShade;
    let kx = 0;
    let ky = -0.6; // sky from above
    let best = 0;
    for (const l of lights || []) {
      if (!l || (l.intensity ?? 1) <= 0.01) continue;
      const d = Math.hypot(l.x - cx, l.y - cy) || 1;
      const w = (l.intensity ?? 1) * clamp(1 - d / Math.max(180, (l.r || 480) * 2.15), 0, 1);
      if (w > best) {
        best = w;
        kx = (l.x - cx) / d;
        ky = (l.y - cy) / d - 0.6;
      }
    }
    const kl = Math.hypot(kx, ky) || 1;
    kx /= kl;
    ky /= kl;
    const sw = cs.width ?? radius * 0.08;
    rCtx.save();
    rCtx.setTransform(1, 0, 0, 1, 0, 0);
    rCtx.clearRect(0, 0, boxW, boxH);
    rCtx.translate(ox, oy);
    rCtx.fillStyle = '#FFFFFF';
    drawMaskFn(rCtx);
    rCtx.globalCompositeOperation = 'source-in';
    rCtx.fillStyle = rgba(cs.color || '#000000', cs.alpha);
    rCtx.fillRect(cx - pad, cy - pad, boxW, boxH);
    rCtx.restore();
    featherEraseShifted(rCtx, drawMaskFn, featherBox, [[kx * sw, ky * sw]], sw * 0.6);
    sCtx.save();
    sCtx.setTransform(1, 0, 0, 1, 0, 0);
    sCtx.globalCompositeOperation = 'source-atop';
    sCtx.drawImage(rCan, 0, 0, boxW, boxH, 0, 0, boxW, boxH);
    sCtx.restore();
  }

  // 3. Normal-Dot-Light Rim Lighting inside `sCan`
  if (lights && lights.length > 0 && rimIntensity > 0.01) {
    const active = [];
    for (const l of lights) {
      if (!l || (l.intensity ?? 1) <= 0.01) continue;
      const dx = l.x - cx;
      const dy = l.y - cy;
      const dist = Math.hypot(dx, dy);
      const maxR = Math.max(180, (l.r || 480) * 2.15);
      if (dist > maxR) continue;
      const falloff = Math.pow(clamp(1 - dist / maxR, 0, 1), 0.68);
      const weight = falloff * (l.intensity ?? 1) * rimIntensity;
      if (weight <= 0.04) continue;
      const len = Math.max(1e-4, dist);
      active.push({
        ux: dx / len,
        uy: dy / len,
        weight: clamp(weight, 0, 1.5),
        color: l.color || '#FDE68A',
        coreColor: l.coreColor || '#FFFDF7',
        rimWidth: (l.rimWidth ?? 4.0) * rimScale,
        softWidth: (l.softWidth ?? 19.0) * rimScale,
        reach: l.reach ?? 0.60,
      });
    }

    active.sort((a, b) => b.weight - a.weight);
    const topLights = active.slice(0, 3);

    for (const L of topLights) {
      // Pass A: Soft subsurface inner glow (`softWidth`) — fast multi-step feather (no CPU filter blur)
      rCtx.save();
      rCtx.setTransform(1, 0, 0, 1, 0, 0);
      rCtx.clearRect(0, 0, boxW, boxH);
      rCtx.translate(ox, oy);

      rCtx.fillStyle = '#FFFFFF';
      drawMaskFn(rCtx);

      rCtx.globalCompositeOperation = 'source-in';
      const gx0 = cx + L.ux * radius * 0.92;
      const gy0 = cy + L.uy * radius * 0.92;
      const gx1 = cx - L.ux * radius * L.reach;
      const gy1 = cy - L.uy * radius * L.reach;
      const softGrad = rCtx.createLinearGradient(gx0, gy0, gx1, gy1);
      const softAlpha = clamp(L.weight * 0.52, 0, 0.72);
      softGrad.addColorStop(0, rgba(L.color, softAlpha));
      softGrad.addColorStop(0.55, rgba(L.color, softAlpha * 0.36));
      softGrad.addColorStop(1, rgba(L.color, 0));
      rCtx.fillStyle = softGrad;
      rCtx.fillRect(cx - pad, cy - pad, boxW, boxH);

      rCtx.restore();
      featherEraseShifted(rCtx, drawMaskFn, featherBox, [[-L.ux * L.softWidth, -L.uy * L.softWidth]], L.softWidth * 0.55);

      sCtx.save();
      sCtx.setTransform(1, 0, 0, 1, 0, 0);
      sCtx.globalCompositeOperation = 'source-atop';
      sCtx.drawImage(rCan, 0, 0, boxW, boxH, 0, 0, boxW, boxH);
      sCtx.restore();

      // Pass B: Crisp normal-dot-light directional rim highlight (`rimWidth`)
      rCtx.save();
      rCtx.setTransform(1, 0, 0, 1, 0, 0);
      rCtx.clearRect(0, 0, boxW, boxH);
      rCtx.translate(ox, oy);

      rCtx.fillStyle = '#FFFFFF';
      drawMaskFn(rCtx);

      rCtx.globalCompositeOperation = 'source-in';
      const sx0 = cx + L.ux * radius * 0.95;
      const sy0 = cy + L.uy * radius * 0.95;
      const sx1 = cx - L.ux * radius * L.reach;
      const sy1 = cy - L.uy * radius * L.reach;
      const sharpGrad = rCtx.createLinearGradient(sx0, sy0, sx1, sy1);
      const rimAlpha = clamp(L.weight * 0.98, 0, 1.0);
      sharpGrad.addColorStop(0, rgba(L.coreColor, rimAlpha));
      sharpGrad.addColorStop(0.48, rgba(L.color, rimAlpha * 0.88));
      sharpGrad.addColorStop(0.82, rgba(L.color, rimAlpha * 0.34));
      sharpGrad.addColorStop(1, rgba(L.color, 0));
      rCtx.fillStyle = sharpGrad;
      rCtx.fillRect(cx - pad, cy - pad, boxW, boxH);

      rCtx.restore();
      featherEraseShifted(rCtx, drawMaskFn, featherBox, [1, 1.8, 3].map((u) => [-L.ux * L.rimWidth * u, -L.uy * L.rimWidth * u]), Math.max(1.2, L.rimWidth * 0.45));

      sCtx.save();
      sCtx.setTransform(1, 0, 0, 1, 0, 0);
      sCtx.globalCompositeOperation = 'source-atop';
      sCtx.drawImage(rCan, 0, 0, boxW, boxH, 0, 0, boxW, boxH);
      sCtx.restore();
    }
  }

  sCtx.restore();

  ctx.save();
  ctx.drawImage(sCan, 0, 0, boxW, boxH, cx - pad, cy - pad, boxW, boxH);
  ctx.restore();
}

/**
 * Cool counter-rim (learned from the prototype): a second, cooler and weaker light opposite the warm key across the
 * subject and a little below it, so the shadow side of a dark subject still has an edge instead of melting into the
 * night. `key` = the scene's key light, `at` = [x, y] of the subject, `opts` = { color, intensity, distance }.
 * Add it to the shot's `lights` (it lights rims only where it reaches; it is not a visible source).
 */
export function counterRimLight(key, at, opts = {}) {
  const dx = key.x - at[0];
  const dy = key.y - at[1];
  const d = Math.hypot(dx, dy) || 1;
  const dist = opts.distance ?? clamp(d * 0.8, 260, 700);
  return {
    x: at[0] - (dx / d) * dist,
    y: at[1] - (dy / d) * dist * 0.4 + dist * 0.35,
    r: dist * 1.1,
    color: opts.color || '#60A5FA',
    coreColor: mixHex(opts.color || '#60A5FA', '#FFFFFF', 0.55),
    intensity: opts.intensity ?? (key.intensity ?? 1) * 0.55,
    rimWidth: (key.rimWidth ?? 4) * 0.7,
    softWidth: (key.softWidth ?? 19) * 0.7,
    reach: 0.35,
    backdropAlpha: 0,
  };
}

export function applyDirectionalRimLight(ctx, buildPathFn, shapeOpts = {}, lights = []) {
  return drawLitOrganicShape(
    ctx,
    (c) => {
      buildPathFn(c);
      c.fill();
    },
    shapeOpts,
    lights
  );
}

// ---------------------------------------------------------------------------
// 7. Material Roles & Color Governance (Layer 2 Shading & Optics)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Material roles — HOW a part is rendered is decided by its material, never by its species.
// A build only declares which role each part plays; colours are then governed by that role's rules:
//   1. Saturation and glow are mutually exclusive: the more a part emits, the closer to white it must be.
//   2. Non-emissive albedo keeps its natural colour (a black cat is black, a fawn is fawn) with a real
//      value range; only emission forces desaturation. Scene lights add hue on top (rim / bounce).
//   3. One emissive subject per shot (`spirit`) — everything else receives light (`fur`, `hard`).
// ---------------------------------------------------------------------------

/**
 * Rendering contract per material role (every field is consumed by `drawTwilightCritter`):
 *   emissive    0..1 self-light: outer halo + full-strength accent glow. Caps saturation by `(1 - 0.7*emissive)`.
 *   satCap      max HSL saturation of the part's own colours.
 *   light       [min, max] HSL lightness of the part's base (albedo) colours.
 *   rim         multiplier on the directional rim + subsurface passes (0 = matte, highlight only).
 *   bounce      multiplier on ground / water bounce light.
 *   accentAlpha opacity of tip / paw / tail-tip accents (low = value tint, high = glowing marking).
 *   accentReach radius multiplier of those accents (small = marking on the fur, large = glow spilling out).
 *   accentLight max HSL lightness of accents and ruff (non-emissive parts must not out-shine the light-bearer).
 *   hostLift    (optional) max lightness ABOVE the body the part grows from — horn / hoof / claw value is relative
 *               to its host, so a brown deer gets bone-brown antlers and a black one dark antlers, never white forks.
 */
export const MATERIAL_ROLES = {
  spirit: { emissive: 1, satCap: 0.58, light: [0.46, 0.96], rim: 1.2, bounce: 0.35, accentAlpha: 0.9, accentReach: 1, accentLight: 1 },
  fur: { emissive: 0, satCap: 0.68, light: [0.05, 0.82], rim: 1.0, bounce: 1.0, accentAlpha: 0.42, accentReach: 0.55, accentLight: 0.88 },
  hard: { emissive: 0, satCap: 0.22, light: [0.32, 0.82], rim: 0, bounce: 0, accentAlpha: 0, accentReach: 0, accentLight: 0.82, hostLift: 0.08 },
};

export function resolveCritterMaterials(build = {}) {
  const m = { ...CRITTER_PART_MATERIALS, ...(build.materials || {}) };
  if (!m.accents) m.accents = m.body;
  for (const part of Object.keys(CRITTER_PART_MATERIALS)) {
    if (!MATERIAL_ROLES[m[part]]) {
      reportOnce(`material-${part}-${m[part]}`, `build.materials.${part} = '${m[part]}' is not one of ${Object.keys(MATERIAL_ROLES).join(' | ')}.`);
      m[part] = CRITTER_PART_MATERIALS[part] || m.body;
    }
  }
  return m;
}

function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `#${((1 << 24) + (f(0) << 16) + (f(8) << 8) + f(4)).toString(16).slice(1)}`;
}

/**
 * Green–yellow guard (`绿黄禁配`): saturated lime / green next to saturated yellow reads as poison, sickness or
 * radiation and is uncomfortable to look at. Chartreuse / lime hues are always muted, and when a colour set also
 * holds a saturated yellow, every green is muted too (low saturation, kept dark) so it reads as jade, not neon.
 */
export function tameGreenYellow(colors) {
  const hsl = colors.map(hexToHsl);
  const deg = (h) => h * 360;
  const hasYellow = hsl.some(([h, s2, l]) => deg(h) >= 38 && deg(h) < 70 && s2 > 0.55 && l > 0.4);
  return colors.map((hex, i) => {
    const [h, s2, l] = hsl[i];
    const d = deg(h);
    if (d >= 70 && d < 110 && s2 > 0.35) return hslToHex(h, 0.35, Math.min(l, 0.55)); // lime / chartreuse
    if (hasYellow && d >= 110 && d < 175 && s2 > 0.3) return hslToHex(h, 0.3, Math.min(l, 0.42)); // green beside yellow
    return hex;
  });
}

/**
 * Applies a material role's colour rules to a hex colour. `base: true` also clamps lightness to the
 * role's albedo range (use for body base colours; accents keep their value and only lose saturation).
 * `host` (hex, the governed mid colour of the body the part grows from) caps a `hostLift` role's lightness
 * at host + hostLift; a dark host may pull the part below the role's own floor.
 */
export function governMaterialColor(hex, role, { base = false, accent = false, host = null } = {}) {
  const R = typeof role === 'string' ? MATERIAL_ROLES[role] || MATERIAL_ROLES.fur : role;
  const [h, s, l] = hexToHsl(hex);
  const cap = R.satCap * (1 - 0.52 * R.emissive);
  let lo = R.light[0];
  let hi = R.light[1];
  if (host && R.hostLift != null) {
    hi = Math.min(hi, hexToHsl(host)[2] + R.hostLift);
    lo = Math.min(lo, hi);
  }
  const lOut = base ? clamp(l, lo, hi) : accent ? Math.min(l, R.accentLight ?? 1) : l;
  return hslToHex(h, Math.min(s, cap), lOut);
}

/**
 * Species presets = palette + build. They are starting points, not a cast list: override `build`
 * and `paletteOverrides` so each story's creatures are its own.
 */
export const CRITTER_SPECIES = {
  fennec: {
    species: 'fennec',
    baseDark: '#171338',
    baseMid: '#29215A',
    farDark: '#110D29',
    farMid: '#1F1845',
    bounceColor: '#38BDF8',
    ruffColor: '#EDE9FE',
    ruffMid: '#C4B5FD',
    earTipColor: '#FEF08A',
    earTipGlow: '#67E8F9',
    earInnerColor: '#F472B6',
    build: { earType: 'long', tailType: 'plume', muzzle: 0.35 },
  },
  moonBunny: {
    species: 'moonBunny',
    baseDark: '#262154',
    baseMid: '#433B82',
    farDark: '#1B1740',
    farMid: '#302A66',
    bounceColor: '#93C5FD',
    ruffColor: '#FFFBEB',
    ruffMid: '#E9D5FF',
    earTipColor: '#FEF9C3',
    earTipGlow: '#F9A8D4',
    earInnerColor: '#F9A8D4',
    build: { earType: 'long', tailType: 'pom', bodyLen: 0.96, girth: 0.98, legLen: 0.98, headR: 1.04, muzzle: 0.08, earLen: 1.08 },
  },
  mossDeer: {
    species: 'mossDeer',
    baseDark: '#162836',
    baseMid: '#244254',
    farDark: '#101E29',
    farMid: '#1B3242',
    bounceColor: '#5EEAD4',
    ruffColor: '#FEF9C3',
    ruffMid: '#A7F3D0',
    earTipColor: '#FEF08A',
    earTipGlow: '#5EEAD4',
    earInnerColor: '#FDBA74',
    build: {
      earType: 'leaf',
      tailType: 'stub',
      horn: 'antlers',
      hornColor: '#ECFCCB',
      hornGlow: '#BEF264',
      legLen: 1.42,
      legGirth: 0.72,
      girth: 0.84,
      bodyLen: 1.14,
      headR: 0.88,
      muzzle: 0.7,
      cheekTufts: false,
      irisColors: ['#1E1B4B', '#3F6212', '#A3E635', '#FEF9C3'],
    },
  },
  cubBear: {
    species: 'cubBear',
    baseDark: '#2A1A2E',
    baseMid: '#4A2E44',
    farDark: '#1E1222',
    farMid: '#362036',
    bounceColor: '#FDBA74',
    ruffColor: '#FDE68A',
    ruffMid: '#F5C9A0',
    earTipColor: '#FDE68A',
    earTipGlow: '#FDBA74',
    earInnerColor: '#F9A8D4',
    build: {
      earType: 'round',
      tailType: 'stub',
      girth: 1.28,
      bodyLen: 0.95,
      legLen: 0.8,
      legGirth: 1.3,
      headR: 1.12,
      muzzle: 0.45,
      cheekTufts: false,
      tailLen: 0.7,
      irisColors: ['#3B1F0E', '#7C2D12', '#F59E0B', '#FDE68A'],
    },
  },
  meadowCat: {
    species: 'meadowCat',
    baseDark: '#1A2430',
    baseMid: '#2E4050',
    farDark: '#121A24',
    farMid: '#22303E',
    bounceColor: '#99F6E4',
    ruffColor: '#E0F2FE',
    ruffMid: '#A5F3FC',
    earTipColor: '#FEF9C3',
    earTipGlow: '#99F6E4',
    earInnerColor: '#FDA4AF',
    build: {
      // sleek plush kitten proportions matching the unified quadruped rig: short triangular ears, low-butt slender tail
      earType: 'tri',
      tailType: 'thin',
      bodyLen: 0.96,
      girth: 0.98,
      legLen: 0.98,
      legGirth: 1.0,
      headR: 1.06,
      headWidth: 1.04,
      mantle: false,
      muzzle: 0.06,
      cheekTufts: false,
      eyeSize: 1.14,
      tailLen: 1.0,
      irisColors: ['#5A2A0C', '#B45309', '#F59E0B', '#FDE68A'], // amber: a dark cat's eyes are the brightest warm spot
    },
  },
};

export function simulateCritterRig(targetT, choreoFn, scale = 1.32, opts = {}) {
  return _simulateCritterRig(targetT, choreoFn, scale, {
    speciesTable: CRITTER_SPECIES,
    ...opts,
  });
}


/**
 * `hard` material renderer (horn, hoof, claw, shell …): matte value gradient from a darker root, a crisp
 * edge and one thin specular crescent toward the strongest light. No subsurface, no rim bloom, no glow.
 *   opts: { cx, cy, radius, base, tip, highlight, width }  (bounding circle in canvas px + colours)
 */
export function drawHardMaterial(ctx, fillFn, opts = {}, lights = []) {
  const { cx, cy, radius } = opts;
  const pad = Math.ceil(radius + 8);
  const box = pad * 2;
  const ox = pad - cx;
  const oy = pad - cy;
  const { canvas: rCan, ctx: rCtx } = getRimScratch(box, box);

  // Albedo: darker at the root (bottom of the bounding circle), lighter toward the tips
  ctx.save();
  const g = ctx.createLinearGradient(cx, cy + radius, cx, cy - radius);
  g.addColorStop(0, opts.base);
  g.addColorStop(1, opts.tip);
  ctx.fillStyle = g;
  fillFn(ctx);
  ctx.restore();

  let best = null;
  for (const l of lights || []) {
    if (!l || (l.intensity ?? 1) <= 0.01) continue;
    const d = Math.hypot(l.x - cx, l.y - cy);
    const w = (l.intensity ?? 1) / Math.max(1, d / Math.max(180, (l.r || 480) * 2.15));
    if (!best || w > best.w) best = { w, ux: (l.x - cx) / Math.max(1e-4, d), uy: (l.y - cy) / Math.max(1e-4, d) };
  }
  if (!best) best = { w: 0.6, ux: 0, uy: -1 };

  // Specular crescent: shape minus itself shifted away from the light
  const sw = opts.width ?? 2;
  rCtx.save();
  rCtx.setTransform(1, 0, 0, 1, 0, 0);
  rCtx.clearRect(0, 0, box, box);
  rCtx.translate(ox, oy);
  rCtx.fillStyle = opts.highlight;
  fillFn(rCtx);
  rCtx.globalCompositeOperation = 'destination-out';
  rCtx.translate(-best.ux * sw, -best.uy * sw);
  rCtx.fillStyle = '#000';
  fillFn(rCtx);
  rCtx.restore();
  ctx.save();
  ctx.globalAlpha = clamp(0.45 + best.w * 0.4, 0, 0.9);
  ctx.drawImage(rCan, 0, 0, box, box, cx - pad, cy - pad, box, box);
  ctx.restore();
}



/**
 * One eye. `eo` = { lid 0 open … 1 shut (upper lid), lower 0..1 (lower lid rise), skin (governed body colour),
 * emissive }. The eyeball never squashes: blinks and squints are lids covering it (an aperture clip). Sclera, socket and
 * lid line are derived from the skin, so a dark body shows no white crescent and gets a light lid line instead.
 */
function drawEye(ctx, ex, ey, rx, ry, rot, tilt, look, build, R, eo = {}) {
  const [targetX, targetY] = look;
  const dx = targetX - ex;
  const dy = targetY - ey;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const localUx = (dx / dist) * cos + (dy / dist) * sin;
  const localUy = -(dx / dist) * sin + (dy / dist) * cos;
  const iris = tameGreenYellow(build.irisColors || ['#312E81', '#6D28D9', '#F59E0B', '#FDE047']);
  const skin = eo.skin || '#2A225C';
  const emissive = eo.emissive ?? 0;
  const darkSkin = hexToHsl(skin)[2] < 0.45;
  const lid = clamp(eo.lid ?? 0, 0, 1);
  const lower = clamp(eo.lower ?? 0, 0, 1);

  // lids: the eye only shows through the aperture between the upper lid (sags a little) and the lower lid (rises
  // flat); the face itself stays visible above / below, so no lid colour has to match the shaded fur
  const yU = -ry + lid * ry * 1.9;
  const yL = ry - lower * ry * 0.75;
  // upper lid edge: arches like the eye while barely lowered, flattens, then sags into a closed "‿" near a full blink
  const arch = ry * (0.3 * (1 - lid) - 0.12 * lid);
  const traceUpperLid = (c) => {
    c.moveTo(-rx * 1.3, yU + arch);
    c.quadraticCurveTo(0, yU - arch, rx * 1.3, yU + arch);
  };

  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(tilt + rot);
  if (lid > 0.01 || lower > 0.01) {
    ctx.beginPath();
    traceUpperLid(ctx);
    ctx.lineTo(rx * 1.3, yL + ry * 0.08);
    ctx.quadraticCurveTo(0, yL - ry * 0.3 * lower, -rx * 1.3, yL + ry * 0.08);
    ctx.closePath();
    ctx.clip();
  }
  ctx.fillStyle = rgba(mixHex(skin, '#000000', 0.55), 0.6);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 1.07, ry * 1.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = mixHex(skin, iris[0], 0.5);
  ctx.fill();
  ctx.clip();

  const irisX = localUx * rx * 0.18;
  const irisY = localUy * ry * 0.18;
  const irisRx = rx * 0.94;
  const irisRy = ry * 0.95;
  const irisGrad = ctx.createLinearGradient(0, -irisRy, 0, irisRy);
  irisGrad.addColorStop(0, iris[0]);
  irisGrad.addColorStop(0.38, iris[1]);
  irisGrad.addColorStop(0.72, iris[2]);
  irisGrad.addColorStop(1, iris[3]);
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.ellipse(irisX, irisY, irisRx, irisRy, 0, 0, Math.PI * 2);
  ctx.fill();

  const pupX = localUx * rx * 0.24;
  const pupY = localUy * ry * 0.24;
  const pupRx = rx * 0.64;
  const pupRy = ry * 0.68;
  const pupGrad = ctx.createRadialGradient(pupX, pupY, pupRx * 0.1, pupX, pupY, pupRx);
  // an emissive body has no black hole in its face: the pupil is a deep tint of the iris
  const pupCore = mixHex('#070514', iris[0], emissive * 0.7);
  pupGrad.addColorStop(0, pupCore);
  pupGrad.addColorStop(0.8, mixHex('#130E2E', iris[0], emissive * 0.6));
  pupGrad.addColorStop(1, mixHex(iris[0], '#000000', 0.3));
  ctx.fillStyle = pupGrad;
  ctx.beginPath();
  ctx.ellipse(pupX, pupY, pupRx, pupRy, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = rgba(iris[3], 0.65);
  ctx.lineWidth = Math.max(1.5, R * 0.032);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(irisX, irisY, irisRx * 0.78, 0.25, Math.PI - 0.25);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(-rx * 0.3, -ry * 0.32, rx * 0.24, ry * 0.2, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(iris[3], 0.95);
  ctx.beginPath();
  ctx.arc(rx * 0.32, ry * 0.28, rx * 0.11, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // lid line: contrasts with the skin (a light line on dark fur, a dark one on pale fur) and rides the upper lid
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(tilt + rot);
  // it hugs the eye's own edge (a glossy lid rim), never floats above it — a separate arc reads as a raised eyebrow
  ctx.strokeStyle = darkSkin ? rgba(mixHex(skin, iris[3], 0.45), 0.75) : rgba(mixHex(skin, '#0B0720', 0.8), 0.9);
  ctx.lineWidth = Math.max(1.6, R * 0.028);
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (lid < 0.04) ctx.ellipse(0, 0, rx * 1.0, ry * 1.0, 0, Math.PI * 1.08, Math.PI * 1.92);
  else {
    // the same edge that clips the eye, kept to the eye's width
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 1.04, ry * 1.08, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    traceUpperLid(ctx);
    ctx.stroke();
    ctx.restore();
  }
  if (lid < 0.04) ctx.stroke();
  ctx.restore();
}

/**
 * Where a feature drawn at frontal head-local x `lx` lands when the head turns by `phi` (radians toward screen +x):
 * features sit on the face sphere (radius 0.84 R), so the far-side eye slides toward the contour and narrows while
 * the pair keeps its spacing on the sphere. Returns [x, widthFactor].
 */
function faceSphereX(lx, phi) {
  const r = 0.84;
  const a = Math.asin(clamp(lx / r, -1, 1));
  return [r * Math.sin(a + phi), Math.max(0.35, Math.cos(a + phi) / Math.max(0.35, Math.cos(a)))];
}

/**
 * Face layout rules (every species, every view):
 *   - Eye spacing: the gap between the eyes is `build.eyeGap` eye-widths on the face; when a big `eyeSize` would not
 *     fit inside the face, the eyes shrink — the gap never collapses.
 *   - Turning (3q / yaw) moves every feature on the face sphere (`faceSphereX`), never by a flat offset.
 *   - Blink / squint are lids (`drawEye`), never a squashed eyeball.
 * `fo` = { skin, emissive } from the body material.
 */
function drawCritterFace(ctx, head, R, simState, lights = [], t = 0, fo = {}) {
  const view = simState.view;
  if (view === 'back') return; // back of the head: no facial features
  const build = simState.build || CRITTER_BUILD_DEFAULTS;
  const f = simState.facing ?? -1;
  const { tilt, yaw, pitch } = head;
  const pt = headLocal(head, R);

  const blinkWave = Math.sin(t * 1.65 + 0.9);
  const blink = blinkWave > 0.982 ? clamp((blinkWave - 0.982) / 0.018, 0, 0.92) : 0;
  const squint = clamp(simState.eyeSquint ?? 0, 0, 1);
  // a squint is the cheek pushing the lower lid up (content / smiling); the upper lid barely drops (a heavy upper lid reads as bored)
  const eo = { lid: Math.max(blink, squint * 0.18), lower: squint * 0.95, skin: fo.skin, emissive: fo.emissive };
  const eyeK = build.eyeSize ?? 1;
  const look = simState.lookAt || [head.x + f * 200, head.y - 120];
  const pitchShiftY = pitch * 0.16;
  const mz = muzzleSpec(simState);

  let eyes;
  let blushes;
  let nose;
  {
    // the plush (hero) face never goes one-eyed: `side` is drawn as a strong three-quarter turn, the far eye narrowed
    // but present (a single eye on a round face reads as a cyclops). True profiles belong to `world` forms.
    const turn = view === 'side' ? 0.5 : view === '3q' ? 0.26 : 0;
    const phi = f * turn + yaw * 0.3;
    const gap = build.eyeGap ?? CRITTER_BUILD_DEFAULTS.eyeGap;
    const ex = Math.min(0.285 * eyeK, 0.86 / (2 + gap)); // frontal eye half-width (head units), fitted to the face
    const ey = ex * (0.325 / 0.285);
    const cx = ex * (1 + gap);
    const at = (lx) => faceSphereX(lx, phi);
    const [xL, kL] = at(-cx);
    const [xR, kR] = at(cx);
    eyes = [
      { lx: xL, ly: 0.04 + pitchShiftY, rx: ex * R * kL, ry: ey * R, rot: -0.06 },
      { lx: xR, ly: 0.04 + pitchShiftY, rx: ex * R * kR, ry: ey * R, rot: 0.06 },
    ];
    const [bL, bkL] = at(-0.58);
    const [bR, bkR] = at(0.58);
    blushes = [
      [bL, 0.28 + pitchShiftY, 0.22 * R * bkL],
      [bR, 0.28 + pitchShiftY, 0.22 * R * bkR],
    ];
    nose = mz ? [mz.cx + (view !== 'front' ? f * mz.rx * (view === 'side' ? 0.86 : 0.45) : 0), mz.cy - mz.ry * 0.45] : [at(0)[0], 0.22 + pitchShiftY * 1.1];
  }

  if (build.blush) {
    for (const [bx, by, br] of blushes) {
      const [cx, cy] = pt(bx, by);
      const g = ctx.createRadialGradient(cx, cy, br * 0.1, cx, cy, br);
      g.addColorStop(0, rgba(build.blush, 0.42));
      g.addColorStop(1, rgba(build.blush, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, br, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const e of eyes) {
    const [ex, ey] = pt(e.lx, e.ly);
    drawEye(ctx, ex, ey, e.rx, e.ry, e.rot, tilt, look, build, R, eo);
  }

  const [nx, ny] = pt(nose[0], nose[1]);
  const open = clamp(simState.mouthOpen ?? 0, 0, 1);
  // mouthless by default (learned from the prototype): the eyes carry the face. Only an animated open mouth
  // (a meow, a gasp) shows, as a small dark oval; `build.mouth: true` restores nose + mouth line.
  if (!build.mouth) {
    if (open > 0.25) {
      ctx.save();
      ctx.fillStyle = rgba(mixHex(fo.skin || '#2A225C', '#12060E', 0.7), 0.85);
      ctx.beginPath();
      ctx.ellipse(nx, ny + R * 0.06, R * 0.045, R * 0.055 * open, tilt, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    return;
  }
  ctx.save();
  ctx.fillStyle = build.noseColor || '#FDA4AF';
  ctx.beginPath();
  ctx.ellipse(nx, ny, R * 0.068, R * 0.048, tilt, 0, Math.PI * 2);
  ctx.fill();
  // mouth line is a low-contrast fold of the skin: barely there on dark fur (the eyes carry the face), drawn on pale fur
  const skinFace = fo.skin || '#2A225C';
  ctx.strokeStyle = hexToHsl(skinFace)[2] < 0.45 ? rgba(mixHex(skinFace, '#FFFFFF', 0.14), 0.55) : rgba(mixHex(skinFace, '#3B1F2B', 0.6), 0.7);
  ctx.lineWidth = Math.max(1.4, R * 0.026);
  ctx.lineCap = 'round';
  if (view === 'side') {
    ctx.beginPath();
    ctx.arc(nx - f * R * 0.06, ny + R * 0.07, R * 0.06 + open * R * 0.03, f > 0 ? 0.2 : Math.PI * 0.35, f > 0 ? Math.PI * 0.65 : Math.PI - 0.2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(nx - R * 0.055, ny + R * 0.045, R * 0.055, 0.1, Math.PI - 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(nx + R * 0.055, ny + R * 0.045, R * 0.055, 0.2, Math.PI - 0.1);
    ctx.stroke();
    if (open > 0.05) {
      ctx.fillStyle = rgba('#4C1D3D', 0.85);
      ctx.beginPath();
      ctx.ellipse(nx, ny + R * 0.13, R * 0.05, R * 0.06 * open, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Renders the 120Hz simulated creature (`drawTwilightCritter` / `drawMoonCritter`) with unified
 * continuous silhouette masking, neck bridge envelope, 2-bone IK limbs, Catmull-Rom ears/tail,
 * build-driven proportions and real `side` / `3q` / `front` / `back` views.
 */
export function drawTwilightCritter(ctx, simStateIn, lights = [], t = 0) {
  const sim = projectCritterView(simStateIn);
  const { scale, R, pelvis, chest, head, earL, earR, tail, feet, speciesCfg = CRITTER_SPECIES.fennec, facing = -1, view } = sim;
  const build = sim.build || CRITTER_BUILD_DEFAULTS;
  const L = build.legLen ?? 1;
  const lg = build.legGirth ?? 1;
  const sock = limbSocketsFor(sim);
  const sizeK = Math.max(1, build.bodyLen ?? 1, L * 0.95, build.headR ?? 1);
  const isBack = view === 'back';
  const isFront = view === 'front';

  // Material roles decide treatment; species colours only pass through the role's colour governor
  const mats = resolveCritterMaterials(build);
  const bodyM = MATERIAL_ROLES[mats.body];
  const accM = MATERIAL_ROLES[mats.accents];
  const hornM = MATERIAL_ROLES[mats.horn];
  const bodyCol = (hex) => governMaterialColor(hex, bodyM, { base: true });
  const accCol = (hex) => governMaterialColor(hex, accM, { accent: true });
  const reach = accM.accentReach;
  const bounceCol = governMaterialColor(speciesCfg.bounceColor || '#38BDF8', bodyM);
  const [accentTip, accentGlow] = tameGreenYellow([accCol(speciesCfg.earTipColor || '#FEF08A'), accCol(speciesCfg.earTipGlow || '#67E8F9')]);
  const ruffCol = governMaterialColor(speciesCfg.ruffColor || '#EDE9FE', bodyM, { accent: true });
  const ruffMidCol = governMaterialColor(speciesCfg.ruffMid || '#C4B5FD', bodyM, { accent: true });
  const aA = accM.accentAlpha;
  const hornSeparate = build.horn !== 'none' && mats.horn !== mats.body;

  const limb = (c, key, rHip, rFoot, maxLen, bendDir) => {
    const sx = sock[key][0];
    const sy = sock[key][1];
    const fx = feet[key].x;
    const fy = feet[key].y;
    const footR = rFoot * scale * lg;
    const stretchK = sim.limbStretch?.[key] ?? 1;
    tracePlushLimbPath(c, [sx, sy], [fx, fy], { rHip: rHip * scale * lg, rFoot: footR, maxLen: maxLen * scale * L * stretchK, bendDir });
    c.fill();
  };

  const farLimbs = isFront ? ['hindL', 'hindR'] : isBack ? ['frontL', 'frontR'] : ['hindR', 'frontR'];
  const nearLimbs = isFront ? ['frontL', 'frontR'] : isBack ? ['hindL', 'hindR'] : ['hindL', 'frontL'];
  const limbSpec = { hindL: [22, 15, 92, facing], hindR: [19, 14, 90, facing], frontL: [21, 15, 90, facing], frontR: [18, 13, 86, facing] };
  const tailOnTop = isBack;

  const tailGlow = (c) => {
    const tip = tail[4];
    const tr = 68 * scale * reach;
    if (tr < 1) return;
    const tGrad = c.createRadialGradient(tip[0], tip[1], 4 * scale * reach, tip[0], tip[1], tr);
    tGrad.addColorStop(0, rgba(accentTip, 0.98 * aA));
    tGrad.addColorStop(0.45, rgba(accentGlow, 0.53 * aA));
    tGrad.addColorStop(1, rgba(accentGlow, 0));
    c.fillStyle = tGrad;
    c.beginPath();
    c.arc(tip[0], tip[1], tr, 0, Math.PI * 2);
    c.fill();
  };

  // 1. Back Layer: tail (unless on top) + far limbs
  drawLitOrganicShape(
    ctx,
    (c) => {
      if (!tailOnTop && traceTail(c, sim, tail)) c.fill();
      for (const k of farLimbs) limb(c, k, ...limbSpec[k]);
    },
    {
      cx: pelvis.x - facing * 40 * scale,
      cy: pelvis.y - 20 * scale,
      radius: 185 * scale * sizeK,
      baseDark: bodyCol(speciesCfg.farDark || '#110D29'),
      baseMid: bodyCol(speciesCfg.farMid || '#1F1845'),
      bounceColor: bounceCol,
      bounceAlpha: 0.48 * bodyM.bounce,
      rimScale: scale * 0.95,
      rimIntensity: 1.18 * bodyM.rim,
      drawInnerDetailsFn: (c) => {
        if (!tailOnTop && build.tailType !== 'none') tailGlow(c);
        const farPawAlpha = accM.emissive > 0.01 ? 0.52 * aA : 0.28;
        const pawTipCol = accM.emissive > 0.01 ? accentTip : mixHex(bounceCol, '#FFFBEB', 0.42);
        const pawMidCol = accM.emissive > 0.01 ? ruffMidCol : bounceCol;
        if (farPawAlpha > 0.01) {
          for (const k of farLimbs) {
            const fp = feet[k];
            const pGrad = c.createRadialGradient(fp.x, fp.y, 2, fp.x, fp.y, 16 * scale);
            pGrad.addColorStop(0, rgba(pawTipCol, farPawAlpha));
            pGrad.addColorStop(0.55, rgba(pawMidCol, farPawAlpha * 0.5));
            pGrad.addColorStop(1, rgba(pawMidCol, 0));
            c.fillStyle = pGrad;
            c.beginPath();
            c.arc(fp.x, fp.y, 16 * scale, 0, Math.PI * 2);
            c.fill();
          }
        }
      },
    },
    lights
  );

  // 2. Unified Foreground Silhouette: torso + neck bridge + near limbs + head (+muzzle/horn buds) + ears
  const midX = (pelvis.x + head.x) * 0.5;
  const midY = (pelvis.y + head.y - 45 * scale) * 0.5;
  drawLitOrganicShape(
    ctx,
    (c) => {
      traceSmoothSpineBodyPath(c, sim);
      c.fill();
      traceNeckBridgePath(c, sim);
      c.fill();
      for (const k of nearLimbs) limb(c, k, ...limbSpec[k]);
      traceCritterHeadPath(c, head, R, sim);
      c.fill();
      if (traceEar(c, sim, earL, 1.0)) c.fill();
      if (traceEar(c, sim, earR, 0.96)) c.fill();
      if (build.horn === 'antlers' && !hornSeparate) fillAntlers(c, head, R, sim);
    },
    {
      cx: midX,
      cy: midY,
      radius: 245 * scale * sizeK,
      baseDark: bodyCol(speciesCfg.baseDark || '#161133'),
      baseMid: bodyCol(speciesCfg.baseMid || '#282054'),
      bounceColor: bounceCol,
      bounceAlpha: 0.55 * bodyM.bounce,
      rimScale: scale * 1.05,
      rimIntensity: 1.3 * bodyM.rim,
      drawInnerDetailsFn: (c) => {
        if (!isBack) {
          const ruffX = isFront ? chest.x : chest.x + facing * 16 * scale;
          const ruffY = chest.y + 8 * scale;
          const ruffR = 46 * scale * (build.girth ?? 1);
          const cGrad = c.createRadialGradient(ruffX, ruffY, 4 * scale, ruffX, ruffY, ruffR);
          cGrad.addColorStop(0, rgba(ruffCol, 0.76));
          cGrad.addColorStop(0.55, rgba(ruffMidCol, 0.42));
          cGrad.addColorStop(1, rgba(ruffMidCol, 0));
          c.fillStyle = cGrad;
          c.beginPath();
          c.arc(ruffX, ruffY, ruffR, 0, Math.PI * 2);
          c.fill();
          const mz = muzzleSpec(sim);
          if (mz) {
            const [mx, my] = headLocal(head, R)(mz.cx, mz.cy);
            const mg = c.createRadialGradient(mx, my, 0, mx, my, Math.max(mz.rx, mz.ry) * R * 1.2);
            mg.addColorStop(0, rgba(ruffCol, 0.5));
            mg.addColorStop(1, rgba(ruffCol, 0));
            c.fillStyle = mg;
            c.beginPath();
            c.arc(mx, my, Math.max(mz.rx, mz.ry) * R * 1.2, 0, Math.PI * 2);
            c.fill();
          }
        } else {
          // Back of the head & spine: darker nape with a soft highlight line down the back
          const ng = c.createRadialGradient(head.x, head.y - R * 0.2, R * 0.1, head.x, head.y, R * 1.1);
          ng.addColorStop(0, rgba(bodyCol(speciesCfg.baseMid || '#282054'), 0.0));
          ng.addColorStop(1, rgba('#05040F', 0.28));
          c.fillStyle = ng;
          c.beginPath();
          c.arc(head.x, head.y, R * 1.1, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = rgba(ruffMidCol, 0.22);
          c.lineWidth = 8 * scale;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(head.x, head.y + R * 0.6);
          c.quadraticCurveTo(chest.x, chest.y, pelvis.x, pelvis.y - 10 * scale);
          c.stroke();
        }

        if (build.earType !== 'none') {
          for (const ePts of [earL, earR]) {
            const tip = ePts[3];
            const mid = ePts[1];
            const tr = 50 * scale * reach * Math.min(1, (build.earLen ?? 1) * (CRITTER_EAR_TYPES[build.earType]?.seg[0] ?? 42) / 42 + 0.3);
            const tipGrad = c.createRadialGradient(tip[0], tip[1], 2 * scale, tip[0], tip[1], tr);
            tipGrad.addColorStop(0, rgba(accentTip, aA));
            tipGrad.addColorStop(0.5, rgba(accentGlow, 0.6 * aA));
            tipGrad.addColorStop(1, rgba(accentGlow, 0));
            c.fillStyle = tipGrad;
            c.beginPath();
            c.arc(tip[0], tip[1], tr, 0, Math.PI * 2);
            c.fill();
            if (!isBack) {
              c.save();
              c.strokeStyle = rgba(governMaterialColor(speciesCfg.earInnerColor || '#F472B6', bodyM), 0.34);
              c.lineWidth = 10 * scale * (build.earWidth ?? 1) * (build.earType === 'round' ? 0.8 : 1);
              c.lineCap = 'round';
              c.beginPath();
              c.moveTo(lerp(ePts[0][0], ePts[1][0], 0.35), lerp(ePts[0][1], ePts[1][1], 0.35));
              c.quadraticCurveTo(mid[0], mid[1], ePts[2][0], ePts[2][1]);
              c.stroke();
              c.restore();
            }
          }
        }

        if (build.horn === 'antlers' && !hornSeparate) {
          const hg = c.createLinearGradient(head.x, head.y - R * 0.7, head.x, head.y - R * 2.1);
          hg.addColorStop(0, governMaterialColor(build.hornColor || '#FEF3C7', hornM));
          hg.addColorStop(1, governMaterialColor(build.hornGlow || '#FDE68A', hornM));
          c.fillStyle = hg;
          fillAntlers(c, head, R, sim);
        }

        // Subtle internal paw/forearm separation so near limbs never melt into the belly without exposing joint bones
        if (!isBack) {
          c.save();
          c.strokeStyle = rgba('#060514', 0.46);
          c.lineWidth = 2.5 * scale;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(lerp(sock.frontL[0], feet.frontL.x, 0.28), lerp(sock.frontL[1], feet.frontL.y, 0.28) + 12 * scale);
          c.quadraticCurveTo((sock.frontL[0] + feet.frontL.x) * 0.5, (sock.frontL[1] + feet.frontL.y) * 0.5 + 14 * scale, feet.frontL.x, feet.frontL.y + 10 * scale);
          c.moveTo(lerp(sock.hindL[0], feet.hindL.x, 0.30), lerp(sock.hindL[1], feet.hindL.y, 0.30) + 10 * scale);
          c.quadraticCurveTo((sock.hindL[0] + feet.hindL.x) * 0.5, (sock.hindL[1] + feet.hindL.y) * 0.5 + 12 * scale, feet.hindL.x, feet.hindL.y + 9 * scale);
          c.stroke();
          c.restore();
        }

        // Paw-pad glow on near limbs (strong for emissive accents, subtle bounce tip for furred paws)
        const pawGlowAlpha = accM.emissive > 0.01 ? 0.72 * aA : 0.36;
        const nearPawTipCol = accM.emissive > 0.01 ? accentTip : mixHex(bounceCol, '#FFFBEB', 0.46);
        const nearPawMidCol = accM.emissive > 0.01 ? ruffMidCol : bounceCol;
        if (pawGlowAlpha > 0.01) {
          for (const k of nearLimbs) {
            const fp = feet[k];
            const pGrad = c.createRadialGradient(fp.x, fp.y, 2, fp.x, fp.y, 18 * scale);
            pGrad.addColorStop(0, rgba(nearPawTipCol, pawGlowAlpha));
            pGrad.addColorStop(0.55, rgba(nearPawMidCol, pawGlowAlpha * 0.55));
            pGrad.addColorStop(1, rgba(nearPawMidCol, 0));
            c.fillStyle = pGrad;
            c.beginPath();
            c.arc(fp.x, fp.y, 18 * scale, 0, Math.PI * 2);
            c.fill();
          }
        }
      },
    },
    lights
  );

  // 2b. Emissive body: soft outer halo (only `spirit`-like roles emit beyond their silhouette)
  if (bodyM.emissive > 0.01) {
    const hr = 230 * scale * sizeK;
    const hg = ctx.createRadialGradient(midX, midY, hr * 0.15, midX, midY, hr);
    const haloCol = bodyCol(speciesCfg.baseMid || '#282054');
    hg.addColorStop(0, rgba(haloCol, 0.26 * bodyM.emissive));
    hg.addColorStop(0.5, rgba(haloCol, 0.1 * bodyM.emissive));
    hg.addColorStop(1, rgba(haloCol, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = hg;
    ctx.fillRect(midX - hr, midY - hr, hr * 2, hr * 2);
    ctx.restore();
  }

  // 2c. Horns in their own material (default `hard`: matte, crisp, one specular crescent)
  if (hornSeparate) {
    const hornHost = bodyCol(speciesCfg.baseMid || '#29215A');
    const hornBase = governMaterialColor(build.hornColor || '#FEF3C7', hornM, { base: true, host: hornHost });
    const hornTip = governMaterialColor(build.hornGlow || '#FDE68A', hornM, { base: true, host: hornHost });
    const hornOpts = {
      cx: head.x,
      cy: head.y - R * 1.3,
      radius: R * 1.6,
      base: mixHex(hornBase, bodyCol(speciesCfg.baseDark || '#161133'), 0.35),
      tip: hornTip,
      highlight: mixHex(hornTip, '#FFFFFF', 0.6),
      width: Math.max(1.2, 1.8 * scale),
    };
    if (hornM.emissive > 0.01 || hornM.rim > 0.01) {
      drawLitOrganicShape(ctx, (c) => fillHorns(c, head, R, sim), {
        cx: hornOpts.cx, cy: hornOpts.cy, radius: hornOpts.radius,
        baseDark: hornOpts.base, baseMid: hornOpts.tip,
        bounceAlpha: 0.3 * hornM.bounce, rimScale: scale * 0.6, rimIntensity: hornM.rim,
      }, lights);
    } else {
      drawHardMaterial(ctx, (c) => fillHorns(c, head, R, sim), hornOpts, lights);
    }
  }

  // 3. Tail over the body for rear views
  if (tailOnTop && build.tailType !== 'none') {
    drawLitOrganicShape(
      ctx,
      (c) => {
        if (traceTail(c, sim, tail)) c.fill();
      },
      {
        cx: tail[2][0],
        cy: tail[2][1],
        radius: 160 * scale * (build.tailLen ?? 1),
        baseDark: bodyCol(speciesCfg.baseDark || '#161133'),
        baseMid: bodyCol(speciesCfg.baseMid || '#282054'),
        bounceColor: bounceCol,
        bounceAlpha: 0.4 * bodyM.bounce,
        rimScale: scale,
        rimIntensity: 1.25 * bodyM.rim,
        drawInnerDetailsFn: tailGlow,
      },
      lights
    );
  }

  // 4. Expressive Face
  drawCritterFace(ctx, head, R, sim, lights, t, { skin: bodyCol(speciesCfg.baseMid || '#29215A'), emissive: bodyM.emissive });
}

export const drawMoonCritter = drawTwilightCritter;

/**
 * Renders the 1px-sliced sinusoidal water reflection of the creature (`drawCritterWaterReflection`).
 */
export function drawCritterWaterReflection(ctx, simStateIn, groundY = 858, t = 0) {
  const simState = projectCritterView(simStateIn);
  const { scale, pelvis, chest, head, tail } = simState;
  const L = simState.build?.legLen ?? 1;
  const jumpHeight = Math.max(0, groundY - 38 * scale * L - pelvis.y);
  const airFade = clamp(1 - jumpHeight / 280, 0.16, 1.0);
  const sizeK = Math.max(1, simState.build?.bodyLen ?? 1, L);

  const boxW = Math.ceil(460 * scale * sizeK);
  const boxH = Math.ceil(340 * scale * sizeK);
  const { canvas: rCan, ctx: rCtx } = getReflScratch(boxW, boxH);

  const localPx = boxW * 0.5;
  const localPy = boxH * 0.82;
  const dx = localPx - pelvis.x;
  const dy = localPy - pelvis.y;
  const shiftPt = (p) => [p[0] + dx, p[1] + dy];
  const localSim = {
    ...simState,
    pelvis: { ...pelvis, x: pelvis.x + dx, y: pelvis.y + dy },
    waist: { ...simState.waist, x: simState.waist.x + dx, y: simState.waist.y + dy },
    chest: { ...chest, x: chest.x + dx, y: chest.y + dy },
    head: { ...head, x: head.x + dx, y: head.y + dy },
    earL: simState.earL.map(shiftPt),
    earR: simState.earR.map(shiftPt),
    tail: tail.map(shiftPt),
  };

  rCtx.save();
  rCtx.setTransform(1, 0, 0, 1, 0, 0);
  rCtx.clearRect(0, 0, boxW, boxH);
  rCtx.fillStyle = '#18143C';
  if (traceTail(rCtx, localSim, localSim.tail)) rCtx.fill();
  traceSmoothSpineBodyPath(rCtx, localSim);
  rCtx.fill();
  traceNeckBridgePath(rCtx, localSim);
  rCtx.fill();
  traceCritterHeadPath(rCtx, localSim.head, simState.R, localSim);
  rCtx.fill();
  if (traceEar(rCtx, localSim, localSim.earL)) rCtx.fill();
  if (traceEar(rCtx, localSim, localSim.earR)) rCtx.fill();

  rCtx.globalCompositeOperation = 'destination-in';
  const fadeGrad = rCtx.createLinearGradient(0, localPy, 0, localPy - 230 * scale);
  fadeGrad.addColorStop(0, `rgba(0,0,0,${(0.58 * airFade).toFixed(3)})`);
  fadeGrad.addColorStop(0.6, `rgba(0,0,0,${(0.28 * airFade).toFixed(3)})`);
  fadeGrad.addColorStop(1, 'rgba(0,0,0,0)');
  rCtx.fillStyle = fadeGrad;
  rCtx.fillRect(0, 0, boxW, boxH);
  rCtx.restore();

  const reflHeight = Math.round(105 * scale);
  const srcTotalH = 220 * scale;
  ctx.save();
  for (let row = 0; row < reflHeight; row++) {
    const u = row / reflHeight;
    const srcY = Math.max(0, localPy - u * srcTotalH);
    const srcH = Math.max(1.5, srcTotalH / reflHeight);
    const amp = (1.5 + Math.pow(u, 0.85) * 14.0) * scale;
    const wave = Math.sin(row * 0.14 - t * 3.0 + pelvis.x * 0.015) * amp;
    ctx.drawImage(rCan, 0, srcY, boxW, srcH, pelvis.x - localPx + wave, groundY + row + jumpHeight * 0.18, boxW, 1.4);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 8a. High-level Twilight Character Helper (`createTwilightCritter`)
// ---------------------------------------------------------------------------

/**
 * High-level character helper (`createTwilightCritter`): delegates to style-agnostic
 * `createPlushCritter` in `engine/critter2d.js` bound to `CRITTER_SPECIES`.
 * Placement (`x`, `groundY`) is REQUIRED.
 */
export function createTwilightCritter(opts = {}) {
  if (!Number.isFinite(opts.x) || !Number.isFinite(opts.groundY)) {
    reportOnce('critter-placement', 'createTwilightCritter({ x, groundY, ... }) needs explicit x and groundY for this shot.');
  }
  return createPlushCritter(opts, CRITTER_SPECIES);
}

// ---------------------------------------------------------------------------
// 8b. Generative Terrain & Set-Dressing (land, stones, trees, light, fog, interiors)
// ---------------------------------------------------------------------------
//
// These primitives exist so a story can BUILD ITS OWN PLACE (meadow slope, mossy forest floor, river bank,
// burrow, bedroom, tea table) instead of standing every creature on the same full-width water line.
// None of them has a default placement: every call states where and how big.

/**
 * Builds a smooth terrain height function `y = f(x)` from control points (`groundProfile`).
 *   points  [[x, y], ...] (any count >= 2, sorted or not) — the silhouette you designed for THIS shot
 *   opts.rough  px of seeded noise added on top (default 6) · opts.freq noise frequency per px (default 0.008)
 *   opts.seed   noise seed
 */
export function groundProfile(points, opts = {}) {
  if (!Array.isArray(points) || points.length < 2) {
    reportOnce('ground-profile', 'groundProfile(points) needs at least 2 [x, y] control points designed for the shot.');
    return () => 1e6;
  }
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  const rough = opts.rough ?? 6;
  const freq = opts.freq ?? 0.008;
  const seed = opts.seed ?? 1;
  return (x) => {
    let i = 0;
    while (i < pts.length - 2 && x > pts[i + 1][0]) i++;
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const span = Math.max(1e-3, p2[0] - p1[0]);
    const u = clamp((x - p1[0]) / span, 0, 1);
    const m1 = ((p2[1] - p0[1]) / Math.max(1e-3, p2[0] - p0[0])) * span;
    const m2 = ((p3[1] - p1[1]) / Math.max(1e-3, p3[0] - p1[0])) * span;
    const u2 = u * u;
    const u3 = u2 * u;
    const y = (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2;
    return y + (rough ? noise1D(x * freq, seed) * rough + noise1D(x * freq * 3.1, seed + 7) * rough * 0.35 : 0);
  };
}

function lightWeightAt(lights, x, y) {
  let best = null;
  let sum = 0;
  for (const l of lights || []) {
    if (!l || (l.intensity ?? 1) <= 0.01) continue;
    const d = Math.hypot(l.x - x, l.y - y);
    const R = (l.r || 420) * 1.6;
    if (d > R) continue;
    const wgt = Math.pow(1 - d / R, 1.4) * (l.intensity ?? 1);
    sum += wgt;
    if (!best || wgt > best.w) best = { w: wgt, color: l.color };
  }
  return { sum, color: best?.color };
}

/**
 * Fills the land below `profileFn` with a lit, textured mass (`drawGroundMass`): hills, banks, forest floor,
 * a table top or floorboards (pass a flat profile).
 *   opts.x0/x1        horizontal extent (default whole frame) · opts.bottom (default h)
 *   opts.colors       { top, mid, deep } (default from look ground*) · opts.rimColor · opts.rimAlpha
 *   opts.depth        0..1 depth metric (attenuates rim, adds aerial haze)
 *   opts.haze         { color, amount }
 *   opts.valleyMist   boolean (default true) soft upward mist gradient near ridge foot
 *   opts.folds        count of internal rolling sub-ridge folds (default 3)
 *   opts.seed
 */
export function drawGroundMass(ctx, w, h, profileFn, look = TWILIGHT_LOOKS.twilight, lights = [], t = 0, opts = {}) {
  if (typeof profileFn !== 'function') {
    reportOnce('ground-mass', 'drawGroundMass(ctx, w, h, profileFn, ...) needs a profile from groundProfile([...]).');
    return;
  }
  const pal = getTwilightLook(look);
  const x0 = opts.x0 ?? -20;
  const x1 = opts.x1 ?? w + 20;
  const bottom = opts.bottom ?? h + 10;
  const baseCols = { top: pal.groundTop, mid: pal.groundMid, deep: pal.groundDeep, ...(opts.colors || {}) };

  // Aerial haze & depth attenuation
  const hazeAmt = clamp(opts.haze?.amount ?? (Number.isFinite(opts.depth) ? opts.depth * 0.65 : 0), 0, 0.75);
  const hazeCol = opts.haze?.color || pal.mistColor;
  const cols = {
    top: hazeAmt > 0 ? mixHex(baseCols.top, hazeCol, hazeAmt) : baseCols.top,
    mid: hazeAmt > 0 ? mixHex(baseCols.mid, hazeCol, hazeAmt * 0.9) : baseCols.mid,
    deep: hazeAmt > 0 ? mixHex(baseCols.deep, hazeCol, hazeAmt * 0.7) : baseCols.deep,
  };

  const step = 8;
  let minY = Infinity;
  const trace = (c) => {
    c.beginPath();
    c.moveTo(x0, bottom);
    for (let x = x0; x <= x1; x += step) {
      const y = profileFn(x);
      minY = Math.min(minY, y);
      c.lineTo(x, y);
    }
    c.lineTo(x1, profileFn(x1));
    c.lineTo(x1, bottom);
    c.closePath();
  };

  ctx.save();
  trace(ctx);
  const g = ctx.createLinearGradient(0, minY, 0, bottom);
  g.addColorStop(0, cols.top);
  g.addColorStop(0.35, cols.mid);
  g.addColorStop(1, cols.deep);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();

  // Soft rolling sub-ridges / velvet terrain folds inside the ground mass
  const foldSeed = (opts.seed ?? 1) * 7.7 + 3;
  const foldCount = opts.folds ?? 3;
  for (let f = 1; f <= foldCount; f++) {
    const fOffset = f * 34;
    const fAlpha = lerp(0.18, 0.08, f / foldCount);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, bottom);
    for (let x = x0; x <= x1; x += step * 2) {
      const ny = profileFn(x) + fOffset + Math.sin(x * 0.005 + f * 1.7) * 12 + noise1D(x * 0.003, foldSeed + f * 5) * 14;
      ctx.lineTo(x, ny);
    }
    ctx.lineTo(x1, bottom);
    ctx.closePath();
    const fg = ctx.createLinearGradient(0, minY + fOffset, 0, bottom);
    fg.addColorStop(0, rgba(mixHex(cols.mid, pal.mistColor, 0.14), fAlpha));
    fg.addColorStop(0.45, rgba(cols.deep, fAlpha * 0.6));
    fg.addColorStop(1, rgba(cols.deep, 0));
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.restore();
  }

  // Atmospheric Valley Mist Base: separates stacked receding ridges in depth
  if (opts.valleyMist !== false) {
    ctx.save();
    const mistH = Math.max(60, (bottom - minY) * 0.55);
    const mg = ctx.createLinearGradient(0, bottom, 0, bottom - mistH);
    const mistBaseAlpha = (opts.mistAlpha ?? 0.32) * (opts.depth ? lerp(0.4, 0.9, opts.depth) : 0.45);
    mg.addColorStop(0, rgba(hazeCol, mistBaseAlpha));
    mg.addColorStop(0.55, rgba(hazeCol, mistBaseAlpha * 0.35));
    mg.addColorStop(1, rgba(hazeCol, 0));
    ctx.fillStyle = mg;
    ctx.fillRect(x0, bottom - mistH, x1 - x0, mistH);
    ctx.restore();
  }

  // Soft inner glow just below the crest (subsurface of moss / sky bounce)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const rimAtten = lerp(1.0, 0.35, hazeAmt);
  const rimAlpha = (opts.rimAlpha ?? 0.35) * rimAtten;
  for (const [lw, a] of [[64, 0.05], [32, 0.09], [14, 0.15]]) {
    ctx.strokeStyle = rgba(opts.rimColor || hazeCol, a * rimAlpha * 2.2);
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) {
      const y = profileFn(x) + lw * 0.42;
      if (x === x0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();

  // Light-weighted crest rim (softly localized to light sources, never a uniform wire across the whole frame)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  const rimW = opts.rimWidth ?? 2.4;
  for (let x = x0; x < x1; x += step * 2) {
    const ya = profileFn(x);
    const yb = profileFn(x + step * 2);
    const lw = lightWeightAt(lights, x, ya);
    const alpha = clamp((rimAlpha * 0.12) + Math.pow(lw.sum, 1.3) * 0.68 * rimAtten, 0, 0.88);
    if (alpha <= 0.015) continue;
    ctx.strokeStyle = rgba(lw.color && lw.sum > 0.15 ? lw.color : opts.rimColor || hazeCol, alpha);
    ctx.lineWidth = rimW * (0.65 + lw.sum * 0.45);
    ctx.beginPath();
    ctx.moveTo(x, ya + 1);
    ctx.lineTo(x + step * 2, yb + 1);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Swaying organic clustered grass / reed / flower tufts along a terrain crest (`drawGrassTufts`).
 * Tapered filled botanical blades grouped in natural clumps.
 *   opts.density tufts per 100px · opts.height [min, max] px · opts.colors [base, tip]
 *   opts.glowTips (bool) · opts.lean (rad, wind) · opts.seed · opts.blades per tuft
 */
export function drawGrassTufts(ctx, profileFn, x0, x1, opts = {}, t = 0) {
  if (typeof profileFn !== 'function') {
    reportOnce('grass-tufts', 'drawGrassTufts(ctx, profileFn, x0, x1, opts, t) needs a terrain profile.');
    return;
  }
  const seed = opts.seed ?? 1;
  const rnd = seededRandom(seed * 13.9 + 2);
  const density = opts.density ?? 3.5;
  const [hMin, hMax] = opts.height || [18, 48];
  const [cBase, cTip] = opts.colors || ['#2F4A6E', '#7DD3C0'];
  const lean = opts.lean ?? 0.12;
  const bladesPerClump = opts.blades ?? 4;
  const totalClumps = Math.round(((x1 - x0) / 100) * density);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (let i = 0; i < totalClumps; i++) {
    const u = (i + 0.4 * (rnd() - 0.5)) / Math.max(1, totalClumps);
    const bx = lerp(x0, x1, u);
    // Use low-frequency noise so grass clusters naturally in organic drifts
    const clusterDensity = 0.5 + 0.5 * noise1D(bx * 0.006, seed * 5.1);
    if (rnd() > clusterDensity * 1.35) continue;

    const by = profileFn(bx) + 2;
    const hh = lerp(hMin, hMax, rnd()) * (0.65 + clusterDensity * 0.5);
    const clumpPhase = rnd() * 6.28;
    const clumpBlades = Math.max(2, Math.round(bladesPerClump * lerp(0.7, 1.3, rnd())));

    for (let b = 0; b < clumpBlades; b++) {
      const spread = (b / Math.max(1, clumpBlades - 1) - 0.5) * 0.85;
      const sway = Math.sin(t * 1.6 + clumpPhase + b * 0.5) * 0.14 + lean;
      const a = -Math.PI / 2 + spread + sway;
      const len = hh * lerp(0.7, 1.1, rnd());
      const tx = bx + Math.cos(a) * len;
      const ty = by + Math.sin(a) * len;

      const halfRootW = lerp(1.6, 3.2, rnd());
      const cpX = bx + Math.cos(a) * len * 0.45;
      const cpY = by + Math.sin(a) * len * 0.45;

      const g = ctx.createLinearGradient(bx, by, tx, ty);
      g.addColorStop(0, rgba(cBase, 0.95));
      g.addColorStop(0.7, rgba(cTip, 0.88));
      g.addColorStop(1, rgba(cTip, 0.98));

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx - halfRootW, by);
      ctx.quadraticCurveTo(cpX - halfRootW * 0.35, cpY, tx, ty);
      ctx.quadraticCurveTo(cpX + halfRootW * 0.35, cpY, bx + halfRootW, by);
      ctx.closePath();
      ctx.fill();

      if (opts.glowTips) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const glowR = 6 * lerp(0.8, 1.2, rnd());
        const gg = ctx.createRadialGradient(tx, ty, 0, tx, ty, glowR);
        gg.addColorStop(0, rgba('#FFFFFF', 0.85));
        gg.addColorStop(0.35, rgba(cTip, 0.65));
        gg.addColorStop(1, rgba(cTip, 0));
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(tx, ty, glowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

/**
 * Rim-lit organic stone / boulder / pebble / stepping stone (`drawStoneMass`). `(x, y)` is the bottom centre.
 *   opts.seed (outline) · opts.flatTop (0..1) · opts.moss { color, coverage 0..1 } · opts.cracks (count)
 *   opts.colors { dark, mid } (default look stone*) · opts.haze { color, amount }
 */
export function drawStoneMass(ctx, x, y, w, h, look = TWILIGHT_LOOKS.twilight, lights = [], opts = {}) {
  if (![x, y, w, h].every((v) => Number.isFinite(v))) {
    reportOnce('stone-mass', 'drawStoneMass(ctx, x, y, w, h, look, lights, opts) needs explicit placement and size.');
    return;
  }
  const pal = getTwilightLook(look);
  const seed = opts.seed ?? 1;
  const flat = opts.flatTop ?? 0.25;
  const cy = y - h * 0.5;

  const hazeAmt = clamp(opts.haze?.amount ?? (Number.isFinite(opts.depth) ? opts.depth * 0.6 : 0), 0, 0.75);
  const hazeCol = opts.haze?.color || pal.mistColor;

  const trace = (c) => {
    const n = 2.2 + flat * 2.6;
    c.beginPath();
    const N = 56;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const k = 1 + noise1D(i * 0.35, seed) * 0.12 + noise1D(i * 0.9, seed + 5) * 0.04;
      const px = x + Math.sign(ca) * Math.pow(Math.abs(ca), 2 / n) * w * 0.5 * k;
      let py = cy + Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n) * h * 0.5 * k;
      if (sa > 0) py = Math.min(py, y + h * 0.03);
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
  };

  const rawCols = { dark: pal.stoneDark, mid: pal.stoneMid, ...(opts.colors || {}) };
  const cols = {
    dark: hazeAmt > 0 ? mixHex(rawCols.dark, hazeCol, hazeAmt) : rawCols.dark,
    mid: hazeAmt > 0 ? mixHex(rawCols.mid, hazeCol, hazeAmt * 0.9) : rawCols.mid,
  };

  drawLitOrganicShape(
    ctx,
    trace,
    {
      cx: x,
      cy,
      radius: Math.max(w, h) * 0.55,
      baseDark: cols.mid,
      baseMid: cols.dark,
      bounceColor: opts.bounceColor || pal.critterBounce,
      bounceAlpha: 0.3 * (1 - hazeAmt * 0.5),
      rimScale: clamp(Math.max(w, h) / 160, 0.6, 1.4),
      rimIntensity: (opts.rimIntensity ?? 0.9) * (1 - hazeAmt * 0.5),
      drawInnerDetailsFn: (c) => {
        if (opts.moss) {
          const mc = opts.moss.color || pal.foliageMid;
          const cov = opts.moss.coverage ?? 0.45;
          const mg = c.createLinearGradient(0, y - h, 0, y - h * (1 - cov));
          mg.addColorStop(0, rgba(mc, 0.95));
          mg.addColorStop(0.7, rgba(mc, 0.7));
          mg.addColorStop(1, rgba(mc, 0));
          c.fillStyle = mg;
          c.fillRect(x - w, y - h * 1.2, w * 2, h * (cov + 0.2));
        }
        const rnd = seededRandom(seed * 3.3);
        for (let i = 0; i < (opts.cracks ?? 0); i++) {
          const sx = x + (rnd() - 0.5) * w * 0.6;
          const sy = y - h * lerp(0.3, 0.8, rnd());
          c.strokeStyle = rgba('#0B0720', 0.35);
          c.lineWidth = 1.6;
          c.beginPath();
          c.moveTo(sx, sy);
          c.quadraticCurveTo(sx + (rnd() - 0.5) * w * 0.2, sy + h * 0.15, sx + (rnd() - 0.5) * w * 0.3, sy + h * 0.3);
          c.stroke();
        }
      },
    },
    lights
  );
}

/**
 * Rim-lit tree trunk / stalk / post (`drawTrunk`) from `(x, baseY)` up to `topY`.
 *   opts.width [base, top] px · opts.lean px offset at top · opts.bend px bow · opts.roots count
 *   opts.colors { dark, mid } · opts.haze { color, amount }
 */
export function drawTrunk(ctx, x, baseY, topY, look = TWILIGHT_LOOKS.twilight, lights = [], opts = {}) {
  if (![x, baseY, topY].every((v) => Number.isFinite(v))) {
    reportOnce('trunk', 'drawTrunk(ctx, x, baseY, topY, look, lights, opts) needs explicit placement.');
    return;
  }
  const pal = getTwilightLook(look);
  const [w0, w1] = opts.width || [70, 34];
  const lean = opts.lean ?? 0;
  const bend = opts.bend ?? 0;
  const roots = opts.roots ?? 2;
  const H = baseY - topY;

  const hazeAmt = clamp(opts.haze?.amount ?? (Number.isFinite(opts.depth) ? opts.depth * 0.6 : 0), 0, 0.75);
  const hazeCol = opts.haze?.color || pal.mistColor;

  const spine = (u) => [x + lean * u + Math.sin(u * Math.PI) * bend, baseY - H * u];
  const trace = (c) => {
    c.beginPath();
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const [sx, sy] = spine(u);
      const hw = lerp(w0, w1, u) * 0.5;
      if (i === 0) c.moveTo(sx - hw, sy);
      else c.lineTo(sx - hw, sy);
    }
    for (let i = N; i >= 0; i--) {
      const u = i / N;
      const [sx, sy] = spine(u);
      c.lineTo(sx + lerp(w0, w1, u) * 0.5, sy);
    }
    c.closePath();
    c.fill();
    // Graceful flared root buttresses blending into mossy ground
    for (let r = 0; r < roots; r++) {
      const side = r % 2 === 0 ? -1 : 1;
      const reach = w0 * (0.85 + 0.45 * hash11(r + (opts.seed ?? 1)));
      c.beginPath();
      c.moveTo(x + side * w0 * 0.25, baseY - w0 * 0.85);
      c.quadraticCurveTo(x + side * w0 * 0.45, baseY - w0 * 0.15, x + side * reach, baseY + 4);
      c.lineTo(x + side * w0 * 0.08, baseY + 4);
      c.closePath();
      c.fill();
    }
  };

  const rawCols = { dark: pal.foliageDark, mid: pal.stoneDark, ...(opts.colors || {}) };
  const cols = {
    dark: hazeAmt > 0 ? mixHex(rawCols.dark, hazeCol, hazeAmt) : rawCols.dark,
    mid: hazeAmt > 0 ? mixHex(rawCols.mid, hazeCol, hazeAmt * 0.9) : rawCols.mid,
  };
  const [mx, my] = spine(0.5);

  drawLitOrganicShape(
    ctx,
    trace,
    {
      cx: mx,
      cy: my,
      radius: Math.max(H * 0.52, w0),
      baseDark: cols.mid,
      baseMid: cols.dark,
      bounceColor: pal.critterBounce,
      bounceAlpha: 0.22 * (1 - hazeAmt * 0.5),
      rimScale: clamp(w0 / 50, 0.7, 1.4),
      rimIntensity: (opts.rimIntensity ?? 0.85) * (1 - hazeAmt * 0.5),
      drawInnerDetailsFn: (c) => {
        const n = opts.bark ?? 5;
        c.strokeStyle = rgba('#05040F', 0.20 * (1 - hazeAmt * 0.6));
        c.lineWidth = 1.8;
        for (let i = 0; i < n; i++) {
          const off = ((i + 0.5) / n - 0.5) * 0.65;
          c.beginPath();
          for (let k = 0; k <= 12; k++) {
            const u = k / 12;
            const [sx, sy] = spine(u);
            const px = sx + off * lerp(w0, w1, u) + Math.sin(u * 8 + i) * 2;
            if (k === 0) c.moveTo(px, sy);
            else c.lineTo(px, sy);
          }
          c.stroke();
        }
      },
    },
    lights
  );
}

/**
 * Soft, organic multi-lobe foliage canopy / bush / hedge (`drawCanopyMass`).
 * Uses smooth spline lobes, internal depth foliage layers, and directional shading.
 *   opts.lumps (count) · opts.seed · opts.colors { dark, mid } · opts.dapple · opts.glints · opts.haze
 */
export function drawCanopyMass(ctx, cx, cy, rx, ry, look = TWILIGHT_LOOKS.twilight, lights = [], t = 0, opts = {}) {
  if (![cx, cy, rx, ry].every((v) => Number.isFinite(v))) {
    reportOnce('canopy', 'drawCanopyMass(ctx, cx, cy, rx, ry, look, lights, t, opts) needs explicit placement.');
    return;
  }
  const pal = getTwilightLook(look);
  const seed = opts.seed ?? 1;
  const lumps = opts.lumps ?? 9;
  const sway = opts.sway ?? 3;

  const hazeAmt = clamp(opts.haze?.amount ?? (Number.isFinite(opts.depth) ? opts.depth * 0.6 : 0), 0, 0.75);
  const hazeCol = opts.haze?.color || pal.mistColor;

  // Build a soft continuous botanical multi-lobe perimeter
  const N = Math.max(12, Math.min(22, Math.round(lumps * 1.8)));
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const lobeNoise = noise1D(i * 0.5, seed * 3.3) * 0.16 + noise1D(i * 1.1, seed + 9) * 0.08;
    const radFactor = clamp(1.0 + lobeNoise, 0.78, 1.22);
    const sw = Math.sin(t * 0.75 + i * 0.5) * (sway * 0.4);
    pts.push([
      cx + Math.cos(a) * rx * radFactor + sw,
      cy + Math.sin(a) * ry * radFactor,
    ]);
  }

  const trace = (c) => {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[(i + 1) % pts.length];
      const p2 = pts[(i + 2) % pts.length];
      const mx = (p1[0] + p2[0]) * 0.5;
      const my = (p1[1] + p2[1]) * 0.5;
      c.quadraticCurveTo(p1[0], p1[1], mx, my);
    }
    c.closePath();
    c.fill();
  };

  const rawCols = { dark: pal.foliageDark, mid: pal.foliageMid, ...(opts.colors || {}) };
  const cols = {
    dark: hazeAmt > 0 ? mixHex(rawCols.dark, hazeCol, hazeAmt) : rawCols.dark,
    mid: hazeAmt > 0 ? mixHex(rawCols.mid, hazeCol, hazeAmt * 0.9) : rawCols.mid,
  };

  drawLitOrganicShape(
    ctx,
    trace,
    {
      cx,
      cy,
      radius: Math.max(rx, ry) * 1.05,
      baseDark: cols.mid,
      baseMid: cols.dark,
      bounceColor: pal.foliageGlow,
      bounceAlpha: 0.18 * (1 - hazeAmt * 0.5),
      rimScale: clamp(Math.max(rx, ry) / 200, 0.8, 1.3),
      rimIntensity: (opts.rimIntensity ?? 0.8) * (1 - hazeAmt * 0.5),
      drawInnerDetailsFn: (c) => {
        // Internal depth foliage clusters in shifted tones
        for (let layer = 1; layer <= 2; layer++) {
          const sc = 1.0 - layer * 0.24;
          c.save();
          c.beginPath();
          for (let i = 0; i < pts.length; i++) {
            const p1 = pts[(i + 1) % pts.length];
            const p2 = pts[(i + 2) % pts.length];
            const ix1 = cx + (p1[0] - cx) * sc;
            const iy1 = cy + (p1[1] - cy) * sc + layer * 7;
            const ix2 = cx + (p2[0] - cx) * sc;
            const iy2 = cy + (p2[1] - cy) * sc + layer * 7;
            const imx = (ix1 + ix2) * 0.5;
            const imy = (iy1 + iy2) * 0.5;
            if (i === 0) c.moveTo(cx + (pts[0][0] - cx) * sc, cy + (pts[0][1] - cy) * sc + layer * 7);
            c.quadraticCurveTo(ix1, iy1, imx, imy);
          }
          c.closePath();
          const subCol = mixHex(cols.dark, pal.foliageMid, layer * 0.25);
          c.fillStyle = rgba(subCol, 0.42);
          c.fill();
          c.restore();
        }

        const r2 = seededRandom(seed * 6.1);
        for (let i = 0; i < (opts.dapple ?? 8); i++) {
          const dx = cx + (r2() - 0.5) * rx * 1.5;
          const dy = cy + (r2() - 0.5) * ry * 1.3;
          const dr = Math.min(rx, ry) * lerp(0.08, 0.2, r2());
          const g = c.createRadialGradient(dx, dy, 0, dx, dy, dr);
          g.addColorStop(0, rgba(cols.mid, 0.0));
          g.addColorStop(0.5, rgba(mixHex(cols.mid, pal.mistColor, 0.35), 0.30));
          g.addColorStop(1, rgba(cols.mid, 0));
          c.fillStyle = g;
          c.beginPath();
          c.arc(dx, dy, dr, 0, Math.PI * 2);
          c.fill();
        }
      },
    },
    lights
  );

  const glints = opts.glints ?? 0;
  if (glints > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const r3 = seededRandom(seed * 8.7);
    const gc = opts.glintColor || pal.foliageGlow;
    for (let i = 0; i < glints; i++) {
      const gx = cx + (r3() - 0.5) * rx * 1.6 + Math.sin(t * 0.9 + i) * 6;
      const gy = cy + (r3() - 0.5) * ry * 1.4 + Math.cos(t * 1.1 + i) * 5;
      const tw = 0.5 + 0.5 * Math.sin(t * (2 + r3() * 2) + i * 1.7);
      const gr = lerp(4, 10, r3());
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr * 2.4);
      g.addColorStop(0, rgba('#FFFFFF', 0.85 * tw));
      g.addColorStop(0.35, rgba(gc, 0.6 * tw));
      g.addColorStop(1, rgba(gc, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(gx, gy, gr * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * Generative depth-plane tree/shrub silhouette row along any ridge `profileFn` (`drawWoodlandRow`).
 * Supports pines, deciduous grove, or low shrubs, with depth aerial haze and sightline gap.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {function} profileFn - Terrain profile function
 * @param {number} x0 - Start x
 * @param {number} x1 - End x
 * @param {object} [look]
 * @param {Array} [lights]
 * @param {number} [t]
 * @param {object} [opts]
 *   - kind: 'pines' | 'grove' | 'bushes' (default 'grove')
 *   - depth: 0..1 (default 0.5)
 *   - density: trees per 1000px (default 6)
 *   - height: [min, max] px (default [90, 180])
 *   - gap: [gx0, gx1] - sightline corridor / gap where trees are omitted (to frame distant beacon!)
 *   - haze: { color, amount }
 *   - seed: number
 */
export function drawWoodlandRow(ctx, profileFn, x0, x1, look = TWILIGHT_LOOKS.twilight, lights = [], t = 0, opts = {}) {
  if (typeof profileFn !== 'function' || !Number.isFinite(x0) || !Number.isFinite(x1)) {
    reportOnce('woodland-row', 'drawWoodlandRow(ctx, profileFn, x0, x1, look, lights, t, opts) needs a ground profile function and explicit [x0, x1].');
    return;
  }
  const pal = getTwilightLook(look);
  const kind = opts.kind || 'grove';
  const seed = opts.seed ?? 1;
  const rnd = seededRandom(seed * 17.3 + 1);
  const density = opts.density ?? 6;
  const [hMin, hMax] = opts.height || (kind === 'pines' ? [120, 220] : kind === 'bushes' ? [40, 80] : [90, 180]);
  const span = x1 - x0;
  const n = Math.max(2, Math.round((span / 1000) * density));

  const haze = opts.haze || {
    color: pal.mistColor,
    amount: clamp(opts.depth ? opts.depth * 0.65 : 0.45, 0, 0.75),
  };

  for (let i = 0; i < n; i++) {
    const u = (i + 0.45 * (rnd() - 0.5)) / Math.max(1, n);
    const tx = lerp(x0, x1, u);

    // Sightline corridor check: preserve central vista window for distant beacon
    if (opts.gap && tx >= opts.gap[0] && tx <= opts.gap[1]) {
      continue;
    }

    const ty = profileFn(tx);
    const th = lerp(hMin, hMax, rnd());

    if (kind === 'pines') {
      // Soft layered alpine conifer spire grounded into the ridge mist (no exposed stick trunk or geometric triangles)
      const tw = th * lerp(0.21, 0.29, rnd());
      const sway = Math.sin(t * 1.1 + i * 0.7) * (th * 0.018);
      ctx.save();
      const tiers = 6;
      for (let tr = 0; tr < tiers; tr++) {
        const tu = tr / (tiers - 1);
        const bY = ty + 6 - lerp(0, th * 0.86, tu);
        const bW = lerp(tw, tw * 0.24, Math.pow(tu, 0.85));
        const bH = th * lerp(0.28, 0.22, tu);
        const tierGrad = ctx.createLinearGradient(0, bY - bH, 0, bY + 4);
        tierGrad.addColorStop(0, rgba(mixHex(pal.foliageMid, haze.color, haze.amount * 0.82), 0.92));
        tierGrad.addColorStop(0.75, rgba(mixHex(pal.foliageDark, haze.color, haze.amount * 0.92), 0.95));
        tierGrad.addColorStop(1, rgba(mixHex(pal.groundTop, haze.color, haze.amount), tr === 0 ? 0.45 : 0.88));
        ctx.fillStyle = tierGrad;
        ctx.beginPath();
        const apexX = tx + sway * tu;
        const apexY = bY - bH;
        ctx.moveTo(apexX, apexY);
        ctx.quadraticCurveTo(apexX + bW * 0.42, bY - bH * 0.32, tx + bW, bY);
        ctx.quadraticCurveTo(tx + bW * 0.45, bY + bH * 0.10, tx, bY + bH * 0.04);
        ctx.quadraticCurveTo(tx - bW * 0.45, bY + bH * 0.10, tx - bW, bY);
        ctx.quadraticCurveTo(apexX - bW * 0.42, bY - bH * 0.32, apexX, apexY);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else if (kind === 'grove') {
      // Soft painterly woodland grove cluster (overlapping lower & upper crowns with subtle depth rim)
      const depthK = clamp(opts.depth ?? 0.5, 0, 1);
      const treeRim = lerp(0.34, 0.08, depthK);
      drawTrunk(ctx, tx, ty + 8, ty - th * 0.52, look, lights, {
        width: [th * 0.13, th * 0.06],
        roots: 2,
        seed: seed + i * 7,
        rimIntensity: treeRim * 0.6,
        haze,
      });
      drawCanopyMass(ctx, tx - th * 0.18, ty - th * 0.56, th * 0.38, th * 0.28, look, lights, t, {
        lumps: 7,
        seed: seed + i * 13 + 3,
        rimIntensity: treeRim * 0.75,
        haze,
      });
      drawCanopyMass(ctx, tx + th * 0.16, ty - th * 0.58, th * 0.40, th * 0.30, look, lights, t, {
        lumps: 7,
        seed: seed + i * 17 + 5,
        rimIntensity: treeRim * 0.85,
        haze,
      });
      drawCanopyMass(ctx, tx, ty - th * 0.74, th * 0.48, th * 0.36, look, lights, t, {
        lumps: 8,
        seed: seed + i * 11,
        rimIntensity: treeRim,
        haze,
      });
    } else if (kind === 'bushes') {
      // Low rounded ridge shrub clusters
      drawCanopyMass(ctx, tx, ty + 4, th * 0.65, th * 0.38, look, lights, t, {
        lumps: 6,
        seed: seed + i * 9,
        rimIntensity: 0.22,
        haze,
      });
    }
  }
}

/**
 * Volumetric light shafts / god rays fanning from `(x, y)` (`drawLightShafts`).
 * Concentric soft-alpha feathered passes for optical volumetric mist beams.
 *   opts.angle (rad) · opts.spread (rad) · opts.count · opts.length · opts.width [near, far] · opts.color · opts.alpha · opts.seed
 */
export function drawLightShafts(ctx, x, y, opts = {}, t = 0) {
  const rnd = seededRandom((opts.seed ?? 1) * 4.4 + 1);
  const angle = opts.angle ?? Math.PI / 2;
  const spread = opts.spread ?? 0.5;
  const count = opts.count ?? 5;
  const length = opts.length ?? 700;
  const [wNear, wFar] = opts.width || [16, 120];
  const color = opts.color || '#FEF3C7';
  const alpha = opts.alpha ?? 0.18;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let i = 0; i < count; i++) {
    const a = angle + (count === 1 ? 0 : ((i / (count - 1)) - 0.5) * spread) + (rnd() - 0.5) * 0.06;
    const len = length * lerp(0.7, 1.0, rnd());
    const flick = 0.75 + 0.25 * Math.sin(t * lerp(0.6, 1.4, rnd()) + i * 2.1);
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const nx = -uy;
    const ny = ux;
    const wn = wNear * lerp(0.6, 1.2, rnd());
    const wf = wFar * lerp(0.6, 1.2, rnd());
    const ex = x + ux * len;
    const ey = y + uy * len;

    // 3 concentric soft-alpha feathered passes: eliminates hard triangular edges!
    const passes = [
      { wScale: 1.6, aMul: 0.25 },
      { wScale: 1.0, aMul: 0.45 },
      { wScale: 0.45, aMul: 0.55 },
    ];

    for (const pass of passes) {
      const pwn = wn * pass.wScale;
      const pwf = wf * pass.wScale;
      const g = ctx.createLinearGradient(x, y, ex, ey);
      const curAlpha = alpha * flick * pass.aMul;
      g.addColorStop(0, rgba(color, curAlpha));
      g.addColorStop(0.55, rgba(color, curAlpha * 0.45));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + nx * pwn * 0.5, y + ny * pwn * 0.5);
      ctx.lineTo(ex + nx * pwf * 0.5, ey + ny * pwf * 0.5);
      ctx.lineTo(ex - nx * pwf * 0.5, ey - ny * pwf * 0.5);
      ctx.lineTo(x - nx * pwn * 0.5, y - ny * pwn * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Generative distant focal goal for 2.5D vista shots (`drawDistantBeacon`).
 * Renders a soft multi-layered horizon halo, ascending spore motes, and a delicate focal silhouette.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Beacon horizon x
 * @param {number} y - Beacon horizon y
 * @param {number} [r=120] - Focal radius
 * @param {object} [look]
 * @param {number} [t=0]
 * @param {object} [opts]
 *   - kind: 'lanternTree' | 'shrineWindow' | 'starlightPillar' | 'crownStag' (default 'lanternTree')
 *   - glowColor: hex or rgba (default pal.warmGlow)
 *   - coreColor: hex (default '#FFFBEB')
 *   - seed: number
 */
export function drawDistantBeacon(ctx, x, y, r = 120, look = TWILIGHT_LOOKS.twilight, t = 0, opts = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    reportOnce('distant-beacon', 'drawDistantBeacon(ctx, x, y, r, look, t, opts) needs explicit placement (x, y).');
    return;
  }
  const pal = getTwilightLook(look);
  const kind = opts.kind || 'lanternTree';
  const glow = opts.glowColor || pal.warmGlow;
  const core = opts.coreColor || '#FFFBEB';
  const seed = opts.seed ?? 1;
  const rnd = seededRandom(seed * 23.7 + 5);

  ctx.save();

  // 1. Multi-layered horizon halo
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // Outer diffuse atmosphere
  const g1 = ctx.createRadialGradient(x, y, 0, x, y, r * 4.6);
  g1.addColorStop(0, rgba(glow, 0.42));
  g1.addColorStop(0.35, rgba(glow, 0.18));
  g1.addColorStop(1, rgba(glow, 0));
  ctx.fillStyle = g1;
  ctx.beginPath();
  ctx.arc(x, y, r * 4.6, 0, Math.PI * 2);
  ctx.fill();

  // Luminous inner halo
  const g2 = ctx.createRadialGradient(x, y - r * 0.15, 0, x, y - r * 0.15, r * 2.2);
  g2.addColorStop(0, rgba(core, 0.75));
  g2.addColorStop(0.4, rgba(glow, 0.45));
  g2.addColorStop(1, rgba(glow, 0));
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.15, r * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Ascending spore / light motes
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const moteCount = opts.motes ?? 14;
  for (let m = 0; m < moteCount; m++) {
    const ph = m * (Math.PI * 2 / moteCount) + seed;
    const speed = 24 + (m % 5) * 8;
    const riseDist = r * 3.4;
    const my = y + r * 0.2 - ((t * speed + m * 55) % riseDist);
    const mx = x + Math.sin(t * 1.4 + ph) * (r * 0.75 * (1 + (y - my) / riseDist));
    const uLife = clamp((y - my) / riseDist, 0, 1);
    const mAlpha = (1 - uLife) * 0.85;
    const mr = lerp(2.2, 5.0, hash11(m + seed));

    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 2.6);
    mg.addColorStop(0, rgba('#FFFFFF', mAlpha));
    mg.addColorStop(0.4, rgba(glow, mAlpha * 0.75));
    mg.addColorStop(1, rgba(glow, 0));
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 3. Generative Focal Silhouette (seed & opts driven, never a fixed sticker)
  if (kind === 'lanternTree') {
    ctx.save();
    const spread = opts.spread ?? 1.0;
    const lean = (opts.lean ?? (rnd() - 0.5) * 0.14) * r;
    const crownCol = mixHex(pal.foliageMid, glow, 0.38);
    const lobeCount = opts.lobes ?? 3;
    for (let i = 0; i < lobeCount; i++) {
      const u = lobeCount === 1 ? 0 : (i / (lobeCount - 1)) * 2 - 1;
      const ox = u * 0.36 * spread + (rnd() - 0.5) * 0.08;
      const oy = -lerp(0.86, 0.65, Math.abs(u)) + (rnd() - 0.5) * 0.06;
      const rx = lerp(0.62, 0.46, Math.abs(u)) * spread;
      const ry = rx * lerp(0.64, 0.72, rnd());
      const a = lerp(0.52, 0.40, Math.abs(u));
      const cg = ctx.createRadialGradient(x + lean + ox * r, y + oy * r, r * 0.05, x + lean + ox * r, y + oy * r, rx * r);
      cg.addColorStop(0, rgba(mixHex(crownCol, core, 0.45), a));
      cg.addColorStop(0.65, rgba(crownCol, a * 0.65));
      cg.addColorStop(1, rgba(crownCol, 0));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(x + lean + ox * r, y + oy * r, rx * r, ry * r, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const trunkGrad = ctx.createLinearGradient(0, y - r * 0.95, 0, y + r * 0.85);
    trunkGrad.addColorStop(0, rgba(mixHex(pal.groundTop, glow, 0.32), 0.88));
    trunkGrad.addColorStop(0.55, rgba(pal.groundMid, 0.92));
    trunkGrad.addColorStop(1, rgba(pal.groundDeep, 0.96));
    ctx.fillStyle = trunkGrad;
    const bSpanL = lerp(0.42, 0.54, rnd()) * spread;
    const bSpanR = lerp(0.42, 0.54, rnd()) * spread;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.34, y + r * 0.85);
    ctx.quadraticCurveTo(x - r * 0.14, y + r * 0.15, x + lean * 0.5 - r * 0.11, y - r * 0.38);
    ctx.quadraticCurveTo(x + lean - r * 0.18, y - r * 0.52, x + lean - r * bSpanL, y - r * 0.65);
    ctx.quadraticCurveTo(x + lean - r * 0.22, y - r * 0.55, x + lean - r * 0.06, y - r * 0.52);
    ctx.quadraticCurveTo(x + lean, y - r * 0.85, x + lean - r * 0.1, y - r * 0.95);
    ctx.quadraticCurveTo(x + lean + r * 0.08, y - r * 0.88, x + lean + r * 0.06, y - r * 0.52);
    ctx.quadraticCurveTo(x + lean + r * 0.25, y - r * 0.56, x + lean + r * bSpanR, y - r * 0.62);
    ctx.quadraticCurveTo(x + lean + r * 0.16, y - r * 0.48, x + lean * 0.5 + r * 0.11, y - r * 0.38);
    ctx.quadraticCurveTo(x + r * 0.14, y + r * 0.15, x + r * 0.34, y + r * 0.85);
    ctx.closePath();
    ctx.fill();

    // Seed-generated beacon blossoms / lantern orbs hanging on boughs
    const lanternCount = opts.lanternCount ?? 8;
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < lanternCount; i++) {
      const u = i / Math.max(1, lanternCount - 1);
      const lx = (i === 0 ? 0.06 : (u * 2 - 1) * 0.48 * spread + (rnd() - 0.5) * 0.12);
      const ly = (i === 0 ? -0.62 : -lerp(0.40, 0.88, rnd()));
      const lScale = i === 0 ? 0.32 : lerp(0.14, 0.25, rnd());
      const px = x + lean + lx * r;
      const py = y + ly * r;
      const lr = r * lScale;
      const pulse = 0.85 + 0.15 * Math.sin(t * 2.2 + lx * 10);

      const lg = ctx.createRadialGradient(px, py, 0, px, py, lr * 1.8);
      lg.addColorStop(0, rgba('#FFFFFF', 0.95 * pulse));
      lg.addColorStop(0.35, rgba(glow, 0.82 * pulse));
      lg.addColorStop(1, rgba(glow, 0));
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(px, py, lr * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (kind === 'shrineWindow') {
    // Distant torii / mountain window shrine
    ctx.save();
    ctx.strokeStyle = rgba(pal.groundDeep, 0.95);
    ctx.lineWidth = Math.max(3, r * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Pillars
    ctx.moveTo(x - r * 0.3, y + r * 0.05);
    ctx.lineTo(x - r * 0.28, y - r * 0.65);
    ctx.moveTo(x + r * 0.3, y + r * 0.05);
    ctx.lineTo(x + r * 0.28, y - r * 0.65);
    // Beams
    ctx.moveTo(x - r * 0.44, y - r * 0.62);
    ctx.lineTo(x + r * 0.44, y - r * 0.62);
    ctx.moveTo(x - r * 0.36, y - r * 0.50);
    ctx.lineTo(x + r * 0.36, y - r * 0.50);
    ctx.stroke();

    // Pure radiant center
    ctx.globalCompositeOperation = 'screen';
    const sg = ctx.createRadialGradient(x, y - r * 0.4, 0, x, y - r * 0.4, r * 0.9);
    sg.addColorStop(0, rgba(core, 0.95));
    sg.addColorStop(0.5, rgba(glow, 0.65));
    sg.addColorStop(1, rgba(glow, 0));
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.4, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (kind === 'starlightPillar') {
    // Column of starlight connecting celestial sky to ridge
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const pg = ctx.createLinearGradient(x, y - r * 4.5, x, y);
    pg.addColorStop(0, rgba(glow, 0.1));
    pg.addColorStop(0.7, rgba(glow, 0.65));
    pg.addColorStop(1, rgba('#FFFFFF', 0.95));
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.65, y - r * 4.5);
    ctx.lineTo(x + r * 0.65, y - r * 4.5);
    ctx.lineTo(x + r * 0.15, y);
    ctx.lineTo(x - r * 0.15, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (kind === 'crownStag') {
    // Spirit stag silhouette atop distant crag
    ctx.save();
    ctx.fillStyle = rgba(pal.groundDeep, 0.95);
    ctx.beginPath();
    // Body & head silhouette
    ctx.arc(x, y - r * 0.35, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    // Glowing crown antlers
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = rgba(glow, 0.95);
    ctx.lineWidth = Math.max(2, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.05, y - r * 0.45);
    ctx.quadraticCurveTo(x - r * 0.3, y - r * 0.7, x - r * 0.42, y - r * 0.9);
    ctx.moveTo(x + r * 0.05, y - r * 0.45);
    ctx.quadraticCurveTo(x + r * 0.3, y - r * 0.7, x + r * 0.42, y - r * 0.9);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Drifting fog / mist band (`drawFogLayer`) centred on `y` with height `bandH`.
 *   opts.color · opts.alpha · opts.puffs (count) · opts.seed · opts.speed (px/s drift)
 */
let _softCanvas = null;
let _softCtx = null;

/**
 * Defocused background layer (`drawSoftLayer`): renders `drawFn(ctx)` at reduced resolution and scales it back up
 * with smoothing — a cheap optical defocus. Use this instead of `ctx.filter = 'blur(…)'`, which is far too slow in
 * headless rendering (minutes per audit).
 *   opts.softness  ~ blur radius in px (1 = nearly sharp, 4–8 = distant hills / trees)
 */
export function drawSoftLayer(ctx, drawFn, opts = {}) {
  const soft = Math.max(0, opts.softness ?? 5);
  const k = clamp(1 / (1 + soft * 0.4), 0.1, 1);
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const w = Math.max(1, Math.ceil(cw * k));
  const h = Math.max(1, Math.ceil(ch * k));
  if (!_softCanvas) {
    _softCanvas = document.createElement('canvas');
    _softCtx = _softCanvas.getContext('2d');
  }
  if (_softCanvas.width < w || _softCanvas.height < h) {
    _softCanvas.width = Math.max(_softCanvas.width, w);
    _softCanvas.height = Math.max(_softCanvas.height, h);
  }
  const m = ctx.getTransform();
  _softCtx.save();
  _softCtx.setTransform(1, 0, 0, 1, 0, 0);
  _softCtx.clearRect(0, 0, w, h);
  _softCtx.setTransform(m.a * k, m.b * k, m.c * k, m.d * k, m.e * k, m.f * k);
  drawFn(_softCtx);
  _softCtx.restore();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(_softCanvas, 0, 0, w, h, 0, 0, cw, ch);
  ctx.restore();
}

export function drawFogLayer(ctx, w, y, bandH, opts = {}, t = 0) {
  const color = opts.color || '#E9D5FF';
  const alpha = opts.alpha ?? 0.28;
  const rnd = seededRandom((opts.seed ?? 1) * 9.2 + 6);
  ctx.save();
  const g = ctx.createLinearGradient(0, y - bandH * 0.5, 0, y + bandH * 0.5);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.5, rgba(color, alpha * 0.6));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, y - bandH * 0.5, w, bandH);
  const puffs = opts.puffs ?? 7;
  const speed = opts.speed ?? 14;
  for (let i = 0; i < puffs; i++) {
    const baseX = rnd() * (w + 600) - 300;
    const px = ((baseX + t * speed * lerp(0.6, 1.4, rnd())) % (w + 600) + (w + 600)) % (w + 600) - 300;
    const py = y + (rnd() - 0.5) * bandH * 0.6;
    const prx = lerp(160, 380, rnd());
    const pry = prx * lerp(0.18, 0.32, rnd());
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1, pry / prx);
    const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, prx);
    pg.addColorStop(0, rgba(color, alpha * 0.7));
    pg.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(0, 0, prx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Glowing window for interiors (`drawWindowGlow`): rectangular or arched frame, glowing panes,
 * optional light spill onto the floor.
 *   opts.arch (bool) · opts.panes [cols, rows] · opts.frameColor · opts.glow (pane colour) · opts.outside (sky colour)
 *   opts.spillTo (floor y for the light pool) · opts.moon { x, y, r } (relative 0..1 inside the window)
 */
export function drawWindowGlow(ctx, x, y, w, h, look = TWILIGHT_LOOKS.twilight, t = 0, opts = {}) {
  if (![x, y, w, h].every((v) => Number.isFinite(v))) {
    reportOnce('window', 'drawWindowGlow(ctx, x, y, w, h, look, t, opts) needs explicit placement.');
    return;
  }
  const pal = getTwilightLook(look);
  const glow = opts.glow || pal.warmGlow;
  const outside = opts.outside || pal.skyMid;
  const frame = opts.frameColor || pal.groundDeep;
  const [pc, pr] = opts.panes || [2, 3];
  const tracePane = (c) => {
    c.beginPath();
    if (opts.arch) {
      c.moveTo(x, y + h);
      c.lineTo(x, y + w * 0.5);
      c.arc(x + w * 0.5, y + w * 0.5, w * 0.5, Math.PI, 0);
      c.lineTo(x + w, y + h);
    } else {
      c.rect(x, y, w, h);
    }
    c.closePath();
  };
  ctx.save();
  // Wide diffuse halo on the wall / surround
  ctx.globalCompositeOperation = 'screen';
  const hg = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.25, x + w / 2, y + h / 2, Math.max(w, h) * 1.4);
  hg.addColorStop(0, rgba(glow, 0.36));
  hg.addColorStop(0.5, rgba(glow, 0.12));
  hg.addColorStop(1, rgba(glow, 0));
  ctx.fillStyle = hg;
  ctx.fillRect(x - w * 1.2, y - h * 1.2, w * 3.4, h * 3.4);

  // Recessed outer casement shadow (bevel)
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = rgba('#06040A', 0.55);
  ctx.save();
  tracePane(ctx);
  ctx.translate(2, 3);
  tracePane(ctx);
  ctx.restore();

  // Glass pane gradient
  tracePane(ctx);
  const og = ctx.createLinearGradient(0, y, 0, y + h);
  og.addColorStop(0, outside);
  og.addColorStop(0.4, mixHex(outside, glow, 0.45));
  og.addColorStop(1, mixHex(outside, glow, 0.85));
  ctx.fillStyle = og;
  ctx.fill();

  if (opts.moon) {
    const mx = x + w * opts.moon.x;
    const my = y + h * opts.moon.y;
    const mr = Math.min(w, h) * (opts.moon.r ?? 0.12);
    ctx.save();
    tracePane(ctx);
    ctx.clip();
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 3);
    mg.addColorStop(0, '#FFFFFF');
    mg.addColorStop(0.3, rgba(pal.warmGlow, 0.9));
    mg.addColorStop(1, rgba(pal.warmGlow, 0));
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Wooden / stone frame casement
  ctx.strokeStyle = frame;
  ctx.lineWidth = Math.max(6, w * 0.055);
  tracePane(ctx);
  ctx.stroke();

  // Inner mullions
  ctx.lineWidth = Math.max(3, w * 0.026);
  ctx.beginPath();
  for (let i = 1; i < pc; i++) {
    ctx.moveTo(x + (w * i) / pc, y + (opts.arch ? w * 0.15 : 0));
    ctx.lineTo(x + (w * i) / pc, y + h);
  }
  for (let j = 1; j < pr; j++) {
    ctx.moveTo(x, y + (h * j) / pr);
    ctx.lineTo(x + w, y + (h * j) / pr);
  }
  ctx.stroke();

  // Warm floor light spill
  if (Number.isFinite(opts.spillTo)) {
    ctx.globalCompositeOperation = 'screen';
    const fy = opts.spillTo;
    const sg = ctx.createLinearGradient(0, y + h, 0, fy + h * 0.6);
    sg.addColorStop(0, rgba(glow, 0.28 + 0.03 * Math.sin(t * 1.3)));
    sg.addColorStop(0.5, rgba(glow, 0.12));
    sg.addColorStop(1, rgba(glow, 0));
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w * 1.7, fy + h * 0.6);
    ctx.lineTo(x - w * 0.7, fy + h * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 9. Bioluminescent Woodland & Water Flora / Props
// ---------------------------------------------------------------------------

/**
 * Draws a floating Bioluminescent Dandelion Puffball (`drawBiolumDandelion`) with 32 radial filaments.
 */
export function drawBiolumDandelion(ctx, x, y, radius = 42, t = 0, opts = {}) {
  // Colours are overridable so the puffball can be a seed, a spore, a pollen star, a snow crystal …
  const C = {
    core: '#FFFFFF',
    warm: '#FEF08A',
    hot: '#FB923C',
    cool: '#38BDF8',
    shell: '#FFFBEB',
    shellMid: '#FDE68A',
    filamentA: '#A5F3FC',
    filamentB: '#FEF08A',
    heart: '#FDE047',
    heartEdge: '#F59E0B',
    ...(opts.colors || {}),
  };
  const pulse = 1 + 0.05 * Math.sin(t * 4.2 + (opts.phase || 0));
  const R = radius * pulse;
  const rot = t * 0.35 + (opts.rotation || 0);

  ctx.save();
  ctx.translate(x, y);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const bloomR = R * 4.2;
  const bloom = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, bloomR);
  bloom.addColorStop(0, rgba(C.core, 0.95));
  bloom.addColorStop(0.18, rgba(C.warm, 0.78));
  bloom.addColorStop(0.42, rgba(C.hot, 0.36));
  bloom.addColorStop(0.72, rgba(C.cool, 0.14));
  bloom.addColorStop(1, rgba(C.cool, 0));
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(0, 0, bloomR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const shellGrad = ctx.createRadialGradient(0, 0, R * 0.15, 0, 0, R * 1.15);
  shellGrad.addColorStop(0, rgba(C.shell, 0.92));
  shellGrad.addColorStop(0.55, rgba(C.shellMid, 0.45));
  shellGrad.addColorStop(0.88, rgba(C.filamentA, 0.28));
  shellGrad.addColorStop(1, rgba(C.filamentA, 0));
  ctx.fillStyle = shellGrad;
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.15, 0, Math.PI * 2);
  ctx.fill();

  const count = opts.filamentCount ?? 32;
  ctx.rotate(rot);
  for (let i = 0; i < count; i++) {
    const baseAngle = (i / count) * Math.PI * 2;
    const wave = Math.sin(t * 5.0 + i * 1.7) * 0.06;
    const a = baseAngle + wave;
    const len = R * (i % 2 === 0 ? 1.05 : 0.84);
    const ex = Math.cos(a) * len;
    const ey = Math.sin(a) * len;
    const cx = Math.cos(a + 0.12) * len * 0.55;
    const cy = Math.sin(a + 0.12) * len * 0.55;

    ctx.strokeStyle = i % 3 === 0 ? rgba(C.filamentA, 0.78) : rgba(C.filamentB, 0.82);
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 0.22, Math.sin(a) * R * 0.22);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();

    ctx.fillStyle = i % 3 === 0 ? mixHex(C.filamentA, '#FFFFFF', 0.6) : C.shell;
    ctx.beginPath();
    ctx.arc(ex, ey, i % 2 === 0 ? 2.5 : 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  const coreGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, R * 0.34);
  coreGrad.addColorStop(0, C.core);
  coreGrad.addColorStop(0.6, C.heart);
  coreGrad.addColorStop(1, C.heartEdge);
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.34, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws an individual floating dandelion parachute wish-seed (`drawDandelionSeed`).
 */
export function drawDandelionSeed(ctx, x, y, size = 18, angle = -0.2, alpha = 1.0) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(0, -size * 0.3, 0, 0, -size * 0.3, size * 1.4);
  g.addColorStop(0, rgba('#FEF08A', 0.65 * alpha));
  g.addColorStop(0.5, rgba('#67E8F9', 0.28 * alpha));
  g.addColorStop(1, rgba('#67E8F9', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, -size * 0.3, size * 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = rgba('#FFFBEB', 0.85 * alpha);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.35);
  ctx.lineTo(0, -size * 0.25);
  ctx.stroke();

  const rays = 7;
  for (let i = 0; i < rays; i++) {
    const u = (i / (rays - 1)) - 0.5;
    const rx = Math.sin(u * 1.35) * size * 0.72;
    const ry = -size * 0.25 - Math.cos(u * 1.35) * size * 0.58;
    ctx.strokeStyle = rgba(i % 2 === 0 ? '#FEF08A' : '#A5F3FC', 0.75 * alpha);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.22);
    ctx.quadraticCurveTo(rx * 0.4, ry * 0.7, rx, ry);
    ctx.stroke();
  }

  ctx.fillStyle = rgba('#FDE047', 0.95 * alpha);
  ctx.beginPath();
  ctx.ellipse(0, size * 0.38, 2.3, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws ONE bioluminescent mushroom (`drawGlowMushroom`) with its stem base at `(x, y)`.
 *   opts.c1/c2 cap colours · opts.stem stem colour · opts.cap 'dome' | 'bell' | 'flat' · opts.lean (rad)
 *   opts.phase (sway phase) · opts.glow (0..1.5)
 */
export function drawGlowMushroom(ctx, x, y, s = 1, t = 0, opts = {}) {
  const c1 = opts.c1 || '#67E8F9';
  const c2 = opts.c2 || '#3B82F6';
  const lean = opts.lean ?? 0;
  const sway = Math.sin(t * 1.8 + (opts.phase ?? 0)) * 2.5 * s;
  const stemH = (opts.stemH ?? 54) * s;
  const capX = x + sway + Math.sin(lean) * stemH;
  const capY = y - Math.cos(lean) * stemH;
  const capW = (opts.capW ?? 28) * s;
  const glowA = opts.glow ?? 1;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glow = ctx.createRadialGradient(capX, capY, 2, capX, capY, 68 * s);
  glow.addColorStop(0, rgba(c1, 0.5 * glowA));
  glow.addColorStop(0.5, rgba(c2, 0.2 * glowA));
  glow.addColorStop(1, rgba(c2, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(capX, capY, 68 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = opts.stem || '#DDD6FE';
  ctx.lineWidth = 6.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + sway * 0.4 + Math.sin(lean) * stemH * 0.4, y - stemH * 0.5, capX, capY);
  ctx.stroke();

  const capGrad = ctx.createLinearGradient(capX, capY - 22 * s, capX, capY + 8 * s);
  capGrad.addColorStop(0, '#FFFFFF');
  capGrad.addColorStop(0.35, c1);
  capGrad.addColorStop(1, c2);
  ctx.fillStyle = capGrad;
  ctx.translate(capX, capY);
  ctx.rotate(lean * 0.8);
  ctx.beginPath();
  const cap = opts.cap || 'dome';
  if (cap === 'bell') {
    ctx.moveTo(-capW * 0.8, 6 * s);
    ctx.bezierCurveTo(-capW * 0.9, -30 * s, capW * 0.9, -30 * s, capW * 0.8, 6 * s);
    ctx.quadraticCurveTo(0, 2 * s, -capW * 0.8, 6 * s);
  } else if (cap === 'flat') {
    ctx.moveTo(-capW * 1.25, 3 * s);
    ctx.bezierCurveTo(-capW * 1.1, -12 * s, capW * 1.1, -12 * s, capW * 1.25, 3 * s);
    ctx.quadraticCurveTo(0, 9 * s, -capW * 1.25, 3 * s);
  } else {
    ctx.moveTo(-capW, 4 * s);
    ctx.bezierCurveTo(-capW * 0.93, -24 * s, capW * 0.93, -24 * s, capW, 4 * s);
    ctx.quadraticCurveTo(0, 10 * s, -capW, 4 * s);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draws ONE floating lily pad (`drawLilyPad`) centred at `(x, y)`.
 *   opts.color · opts.rimColor · opts.phase · opts.notch (rad, angle of the V cut)
 */
export function drawLilyPad(ctx, x, y, rx = 60, ry = 12, t = 0, opts = {}) {
  const dx = Math.sin(t * 1.2 + (opts.phase ?? 0)) * 4;
  const notch = opts.notch ?? 0.15;
  ctx.save();
  ctx.fillStyle = rgba(opts.color || '#233B6E', opts.alpha ?? 0.82);
  ctx.strokeStyle = rgba(opts.rimColor || '#67E8F9', 0.45);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(x + dx, y, rx, ry, 0, notch, Math.PI * 2 - notch * 0.5);
  ctx.lineTo(x + dx, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Batch helper for mushroom clusters and lily pads (`drawGlowingMushrooms` / `drawTwilightFlora`).
 * There is NO default layout: pass `opts.clusters` ([{ x, y, s, c1, c2, cap?, lean? }]) and/or
 * `opts.pads` ([{ x, y, rx, ry }]) composed for the current shot. Calling it without either draws
 * nothing and reports a contract error (so `tools/audit.mjs` fails).
 */
export function drawGlowingMushrooms(ctx, t = 0, opts = {}) {
  const clusters = opts.clusters;
  const pads = opts.pads;
  if (!clusters && !pads) {
    reportOnce(
      'mushrooms-default',
      'drawGlowingMushrooms(ctx, t) was called without opts.clusters / opts.pads. The kernel has no default ' +
        'layout — place mushrooms (drawGlowMushroom) and pads (drawLilyPad) for this shot.'
    );
    return;
  }
  for (const [idx, m] of (clusters || []).entries()) {
    drawGlowMushroom(ctx, m.x, m.y, m.s ?? 1, t, { phase: idx, ...m });
  }
  for (const [i, p] of (pads || []).entries()) {
    drawLilyPad(ctx, p.x, p.y, p.rx ?? 60, p.ry ?? 12, t, { phase: i, ...p });
  }
}

export const drawTwilightFlora = drawGlowingMushrooms;

/**
 * Draws soft-focus foreground/midground swaying botanical stems (`drawDefocusedFlora`).
 */
export function drawDefocusedFlora(ctx, stems = [], t = 0) {
  if (!Array.isArray(stems) || !stems.length) return;
  drawSoftLayer(
    ctx,
    (sCtx) => {
      sCtx.save();
      for (const stem of stems) {
        const x = stem.x;
        const y = stem.y;
        const h = stem.h ?? 150;
        const scale = stem.scale ?? 1.0;
        const sway = Math.sin(t * 1.6 + (stem.phase || 0)) * 12 * scale;
        const topColor = stem.topColor || '#93C5FD';
        const baseColor = stem.baseColor || '#435CA8';
        const alpha = stem.alpha ?? 0.88;

        sCtx.save();
        const grad = sCtx.createLinearGradient(x, y - h, x, y);
        grad.addColorStop(0, rgba(topColor, alpha));
        grad.addColorStop(1, rgba(baseColor, alpha * 0.90));

        sCtx.strokeStyle = grad;
        sCtx.lineWidth = 7.2 * scale;
        sCtx.lineCap = 'round';
        sCtx.beginPath();
        sCtx.moveTo(x, y);
        sCtx.quadraticCurveTo(x + sway * 0.5, y - h * 0.5, x + sway, y - h);
        sCtx.stroke();

        sCtx.fillStyle = grad;
        const pairs = stem.pairs || [0.32, 0.64, 0.95];
        for (const [idx, frac] of pairs.entries()) {
          const lx = x + sway * frac * frac;
          const ly = y - h * frac;
          const leafL = (36 - idx * 3) * scale;
          const leafW = (14 - idx * 1) * scale;

          if (frac > 0.9) {
            sCtx.beginPath();
            sCtx.ellipse(lx, ly - leafL * 0.55, leafW * 0.9, leafL * 0.85, sway * 0.01, 0, Math.PI * 2);
            sCtx.fill();
          }
          sCtx.beginPath();
          sCtx.ellipse(lx - leafL * 0.72, ly - leafL * 0.18, leafL * 0.88, leafW, -0.42 + sway * 0.01, 0, Math.PI * 2);
          sCtx.fill();
          sCtx.beginPath();
          sCtx.ellipse(lx + leafL * 0.72, ly - leafL * 0.18, leafL * 0.88, leafW, 0.42 + sway * 0.01, 0, Math.PI * 2);
          sCtx.fill();
        }
        sCtx.restore();
      }
      sCtx.restore();
    },
    { softness: 4 }
  );
}

/**
 * Draws a glowing floating lotus lantern boat on the water (`drawLotusLanternBoat`).
 */
export function drawLotusLanternBoat(ctx, x, y, scale = 1.0, t = 0, opts = {}) {
  const bob = Math.sin(t * 2.4 + (opts.phase || 0)) * 3.5 * scale;
  const tilt = Math.cos(t * 1.9 + (opts.phase || 0)) * 0.04;
  const color = opts.color || '#F9A8D4';
  const coreColor = opts.coreColor || '#FEF08A';

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(tilt);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(0, -14 * scale, 2, 0, -14 * scale, 82 * scale);
  g.addColorStop(0, rgba('#FFFFFF', 0.90));
  g.addColorStop(0.28, rgba(coreColor, 0.65));
  g.addColorStop(0.65, rgba(color, 0.28));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, -14 * scale, 82 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Outer petals
  for (const ang of [-0.65, -0.32, 0, 0.32, 0.65]) {
    ctx.save();
    ctx.rotate(ang);
    const pGrad = ctx.createLinearGradient(0, -38 * scale, 0, 4 * scale);
    pGrad.addColorStop(0, '#FFFBEB');
    pGrad.addColorStop(0.45, color);
    pGrad.addColorStop(1, '#6D28D9');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.moveTo(0, 4 * scale);
    ctx.bezierCurveTo(-18 * scale, -10 * scale, -14 * scale, -32 * scale, 0, -40 * scale);
    ctx.bezierCurveTo(14 * scale, -32 * scale, 18 * scale, -10 * scale, 0, 4 * scale);
    ctx.fill();
    ctx.restore();
  }

  // Warm glowing candle pearl inside lotus
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, -12 * scale, 9 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws a luminous crystal dewdrop pearl hanging or falling from forest leaves (`drawCrystalDewdrop`).
 */
export function drawCrystalDewdrop(ctx, x, y, r = 16, t = 0, opts = {}) {
  const color = opts.color || '#67E8F9';
  const pulse = 1 + 0.06 * Math.sin(t * 3.8 + (opts.phase || 0));
  const R = r * pulse;

  ctx.save();
  ctx.translate(x, y);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, R * 3.2);
  halo.addColorStop(0, rgba('#FFFFFF', 0.90));
  halo.addColorStop(0.35, rgba(color, 0.55));
  halo.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, R * 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const dGrad = ctx.createLinearGradient(0, -R * 1.3, 0, R);
  dGrad.addColorStop(0, rgba('#E0F2FE', 0.92));
  dGrad.addColorStop(0.55, rgba(color, 0.85));
  dGrad.addColorStop(1, rgba('#FEF08A', 0.95));
  ctx.fillStyle = dGrad;
  ctx.beginPath();
  ctx.moveTo(0, -R * 1.35);
  ctx.bezierCurveTo(R * 1.05, -R * 0.2, R * 1.05, R * 0.95, 0, R);
  ctx.bezierCurveTo(-R * 1.05, R * 0.95, -R * 1.05, -R * 0.2, 0, -R * 1.35);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(-R * 0.28, -R * 0.15, R * 0.18, R * 0.32, -0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 12. `world`-form creatures: side-profile quadrupeds shaded in this style (`drawProfileQuadruped`)
// ---------------------------------------------------------------------------
// The plush rig (`simulateCritterRig`) is the `hero` form. Every other creature in a film uses a `world` form:
// real proportions, silhouette first, small eyes, life carried by gait / posture / light — never a cute close-up.
//
// Geometry lives in `engine/critter2d.js` (ADR-015): a species is a combination of body-plan axes (stance, skull,
// trunk, coat, tail, gait, markings, real size). This section only shades its parts with the material roles.

export const QUADRUPED_PROFILES = PROFILE_SPECIES;

/**
 * Draws a `world`-form quadruped in profile. Required: `x`, `groundY`, and `size` (px per body unit) or `pxPerM`
 * (real-size shot: the species' `withersM` decides its size, so a fox stands knee-high to a deer).
 *   kind      keyof PROFILE_SPECIES ('deer' | 'horse' | 'fox' | 'wolf' | 'bear'); override axes / proportions with `profile`
 *   facing    ±1 · pose { gait, stride, graze, lift, nod, breathe }
 *   materials { body, horn } → MATERIAL_ROLES (default body 'fur'; horn follows a `spirit` body, else 'hard')
 *   colors    { dark, mid, belly, far, horn, eye, markDark, markPale }  albedo inputs, governed by the material role
 *   bounceColor · alpha (fade for vanish / appear)
 *   haze      { color, amount 0..1 } aerial perspective: a far creature sinks toward the air colour and loses rim
 *             contrast (use the look's mist / horizon colour; amount grows with depth)
 *   ambient   { level, color } light received from the sky (default dusk: 0.45, blue-violet). A non-emissive body is
 *             exposed at ambient + the scene lights reaching it, so fur far from every light is dim, not a sticker.
 */
export function drawProfileQuadruped(ctx, o = {}, lights = []) {
  if (!Number.isFinite(o.x) || !Number.isFinite(o.groundY)) {
    reportOnce('profile-placement', 'drawProfileQuadruped({ x, groundY, size | pxPerM, ... }) needs explicit x and groundY.');
  }
  const S = poseProfileQuadruped(o);
  const parts = profileParts(S);
  const { P, hy, top, bot, legs, head: H, trunk: T } = S;
  const size = o.size ?? (o.pxPerM ? profileSizeForScale(o.kind, o.pxPerM, o.profile) : 160);
  const f = o.facing ?? 1;
  const ox = o.x ?? 0;
  const gy = o.groundY ?? 0;
  const M = (p) => [ox + f * p[0] * size, gy - p[1] * size];
  const path = (c, part) => {
    c.beginPath();
    traceProfilePart(c, part, M);
    c.fill();
  };

  const bodyRole = (o.materials && o.materials.body) || 'fur';
  const hornRole = (o.materials && o.materials.horn) || (bodyRole === 'spirit' ? 'spirit' : 'hard');
  const bodyM = MATERIAL_ROLES[bodyRole] || MATERIAL_ROLES.fur;
  const hornM = MATERIAL_ROLES[hornRole] || MATERIAL_ROLES.hard;
  const col = o.colors || {};
  // received light: albedo × (sky ambient + the scene lights that reach this body); emission ignores it
  const amb = { level: 0.45, color: '#5D6BB5', ...(o.ambient || {}) };
  const bodyAt = [ox, gy - (P.hy + 0.2) * size];
  let lit = 0;
  for (const l of lights || []) {
    if (!l || (l.intensity ?? 1) <= 0.01) continue;
    const d = Math.hypot(l.x - bodyAt[0], l.y - bodyAt[1]);
    lit += (l.intensity ?? 1) * Math.pow(clamp(1 - d / Math.max(180, (l.r || 480) * 2.15), 0, 1), 1.2) * 0.6;
  }
  const exposure = bodyM.emissive > 0.01 ? 1 : clamp(amb.level + lit, amb.level, 1);
  const expose = (hex) => (exposure >= 0.999 ? hex : mixHex(mixHex(hex, '#000000', 1 - exposure), amb.color, (1 - exposure) * 0.22));
  const hz = o.haze && o.haze.color ? clamp(o.haze.amount ?? 0, 0, 1) : 0;
  const air = (hex) => (hz > 0 ? mixHex(expose(hex), o.haze.color, hz) : expose(hex));
  const airRim = 1 - 0.6 * hz;
  const emissive = bodyM.emissive > 0.01;
  const rawDark = col.dark || (emissive ? '#4A7C9B' : '#5B4636');
  const rawMid = col.mid || (emissive ? '#BAE6FD' : '#8A6A50');
  const rawFar = col.far || (emissive ? mixHex(rawDark, '#1E3A5F', 0.55) : mixHex(rawDark, '#000000', 0.35));
  const dark = governMaterialColor(rawDark, bodyM, { base: true });
  const mid = governMaterialColor(rawMid, bodyM, { base: true });
  const belly = governMaterialColor(col.belly || mixHex(rawMid, '#F5EBDD', 0.55), bodyM, { accent: true });
  const far = governMaterialColor(rawFar, bodyM, { base: true });
  const bounce = governMaterialColor(o.bounceColor || (emissive ? '#7DD3FC' : '#94A3B8'), bodyM);
  const shade = air(emissive ? mixHex(dark, '#1E3A5F', 0.42) : mixHex(dark, '#000000', 0.45));
  const light = air(mixHex(mid, '#FFFFFF', emissive ? 0.55 : 0.24));
  const markTone = {
    dark: air(governMaterialColor(col.markDark || mixHex(rawDark, '#0B0806', 0.75), bodyM, { base: true })),
    pale: air(governMaterialColor(col.markPale || '#EFE6D8', bodyM, { accent: true })),
  };
  const [bDark, bMid, bFar, bBelly, bBounce] = [dark, mid, far, belly, bounce].map(air);
  // core shadow on the side away from the light; emissive spirits retain cool cyan-indigo core depth so limbs read in 3D
  const coreShade = {
    color: emissive ? mixHex(dark, '#1E3A5F', 0.48) : mixHex(dark, '#000000', 0.5),
    alpha: (emissive ? 0.38 : 0.55) * (1 - 0.5 * hz),
    width: size * 0.045,
  };
  const planes = P.coatT.planes;

  const c0 = M([0, hy * 0.7]);
  const radius = size * (0.9 + P.hy * 0.6 + P.neckLen * 0.6);

  ctx.save();
  ctx.globalAlpha *= clamp(o.alpha ?? 1, 0, 1);

  if (emissive) {
    const hc = M([0.1, hy + 0.1]);
    const hr = radius * 1.05;
    const g = ctx.createRadialGradient(hc[0], hc[1], hr * 0.1, hc[0], hc[1], hr);
    g.addColorStop(0, rgba(mid, 0.28 * bodyM.emissive));
    g.addColorStop(0.5, rgba(mid, 0.09 * bodyM.emissive));
    g.addColorStop(1, rgba(mid, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(hc[0] - hr, hc[1] - hr, hr * 2, hr * 2);
    ctx.restore();
  }

  // Antlers / horns in their own material; the far one is drawn before the body and darkened like the far legs
  const drawAntler = (chains, isFar) => {
    if (!chains || !chains.length) return;
    const antlerSpec = P.antlers || { len: 0.75, w: 0.02, taper: 0.7 };
    const aLen = antlerSpec.len ?? 0.75;
    const fillAnt = (c) => {
      for (const ch of chains) {
        const pts = Array.isArray(ch) ? ch : ch.pts;
        if (!pts || pts.length < 2) continue;
        const cw = (ch && ch.w) || antlerSpec.w || 0.02;
        const ct = (ch && ch.taper) ?? antlerSpec.taper ?? 0.7;
        traceSmoothChainRibbon(c, pts.map(M), (u) => cw * size * 0.5 * (1 - ct * u), 10);
        c.fill();
      }
    };
    const antRoot = H.antler || S.poll;
    const at = M([antRoot[0], antRoot[1] + aLen * P.headLen * 0.5]);
    const ar = Math.max(16, aLen * P.headLen * size * 1.1);
    const sink = (hex, k) => air(isFar ? mixHex(hex, far, k) : hex);
    if (hornM.emissive > 0.01 || hornM.rim > 0.01) {
      const hd = governMaterialColor(col.horn || mid, hornM, { base: true, host: mid });
      const hm = governMaterialColor(col.horn || light, hornM, { base: true, host: mid });
      drawLitOrganicShape(ctx, fillAnt, { cx: at[0], cy: at[1], radius: ar, baseDark: sink(hd, isFar ? 0.45 : 0), baseMid: sink(hm, isFar ? 0.45 : 0), bounceAlpha: 0.2 * hornM.bounce, rimScale: size / 220, rimIntensity: (isFar ? 0.45 : 0.85) * hornM.rim * airRim }, lights);
    } else {
      const hb = sink(governMaterialColor(col.horn || '#B8A68C', hornM, { base: true, host: mid }), isFar ? 0.5 : 0);
      drawHardMaterial(ctx, fillAnt, { cx: at[0], cy: at[1], radius: ar, base: mixHex(hb, isFar ? bFar : bDark, 0.45), tip: hb, highlight: mixHex(hb, '#FFFFFF', isFar ? 0.15 : 0.35), width: Math.max(1, size / 140) }, isFar ? [] : lights);
    }
  };
  drawAntler(parts.antlers && parts.antlers[1], true);

  // 1. Far legs + far ear: darker, recessed in value, receive softer rim
  drawLitOrganicShape(ctx, (c) => {
    for (const part of parts.far) path(c, part);
  }, {
    cx: c0[0],
    cy: c0[1],
    radius,
    baseDark: mixHex(bFar, '#060814', emissive ? 0.25 : 0.18),
    baseMid: mixHex(bFar, bDark, 0.42),
    bounceColor: bBounce,
    bounceAlpha: 0.15 * bodyM.bounce,
    rimScale: clamp(size / 360, 0.45, 1),
    rimIntensity: 0.5 * bodyM.rim * airRim,
    coreShade: { ...coreShade, alpha: coreShade.alpha * 0.7 },
  }, lights);

  // Soft radial plane helper; `core` keeps the centre solid (markings) instead of fading from the middle (light planes)
  const ell = (c, p, rx, ry, rot, color, a, core = 0) => {
    if (!p) return;
    const [x, y] = M(p);
    const maxR = Math.max(1e-3, Math.max(rx, ry) * size);
    const g = c.createRadialGradient(x, y, 0, x, y, maxR);
    g.addColorStop(0, rgba(color, a));
    if (core > 0) g.addColorStop(core, rgba(color, a));
    g.addColorStop(1, rgba(color, 0));
    c.save();
    c.translate(x, y);
    c.rotate(-f * rot);
    c.scale(1, ry / Math.max(1e-4, rx));
    c.translate(-x, -y);
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, Math.max(1e-3, rx * size), 0, Math.PI * 2);
    c.fill();
    c.restore();
  };
  const along = (c, a, b, ratio, color, alpha) => {
    if (!a || !b) return;
    const d = v2.sub(b, a);
    const len = v2.len(d);
    if (len < 1e-4) return;
    ell(c, v2.lerp(a, b, 0.5), len * 0.5, len * 0.5 * ratio, Math.atan2(d[1], d[0]), color, alpha);
  };
  // horizontal light / shade band peaking at `yPeak`, fading to zero at y0 and y1 (no hard edges)
  const band = (c, y0, yPeak, y1, color, a) => {
    const [, sy0] = M([0, y0]);
    const [, syp] = M([0, yPeak]);
    const [, sy1] = M([0, y1]);
    const g = c.createLinearGradient(0, sy0, 0, sy1);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(clamp((syp - sy0) / (sy1 - sy0 || 1), 0.01, 0.99), rgba(color, a));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(ox - size * 3, Math.min(sy0, sy1), size * 6, Math.abs(sy1 - sy0));
  };
  const drawMarking = (c, m) => {
    const color = markTone[m.tone] || markTone.dark;
    const a = m.alpha * (emissive ? 0.38 : 1);
    for (const p of m.prims || []) {
      if (p.kind === 'ell') ell(c, p.c, p.rx, p.ry, p.rot || 0, color, a, 0.55);
      else if (p.kind === 'part') {
        c.fillStyle = rgba(color, a);
        path(c, p.part);
      } else if (p.kind === 'outline') {
        c.fillStyle = rgba(color, a);
        path(c, p);
      } else if (p.kind === 'disc') {
        ell(c, [p.cx, p.cy], p.r * 1.2, p.r, 0, color, a, 0.6);
      } else if (p.kind === 'band') {
        const [, s0] = M([0, p.y0]);
        const [, s1] = M([0, p.y1]);
        const [, sg] = M([0, -0.05]);
        const g = c.createLinearGradient(0, s0, 0, sg);
        g.addColorStop(0, rgba(color, 0));
        g.addColorStop(clamp((s1 - s0) / (sg - s0 || 1), 0.01, 0.99), rgba(color, a));
        g.addColorStop(1, rgba(color, a));
        c.fillStyle = g;
        c.fillRect(ox - size * 3, Math.min(s0, sg), size * 6, Math.abs(sg - s0));
      }
    }
  };
  const nearOpts = {
    cx: c0[0], cy: c0[1], radius, baseDark: bDark, baseMid: bMid, bounceColor: bBounce, bounceAlpha: 0.3 * bodyM.bounce,
    rimScale: clamp(size / 320, 0.5, 1.1), rimIntensity: 1.05 * bodyM.rim * airRim, coreShade,
  };
  const isTailMark = (m) => m.zone === 'tailTip';
  const isEarMark = (m) => m.zone === 'earBacks';

  // 2. Near body + integrated near limbs + mane + coat tufts, with anatomical muscle planes,
  // soft limb-separation creases, and species markings inside the unified mask
  const bodyGroup = parts.body || parts.near;
  drawLitOrganicShape(ctx, (c) => {
    for (const part of bodyGroup) path(c, part);
  }, {
    ...nearOpts,
    drawInnerDetailsFn: (c) => {
      const fl = legs.frontNear;
      const hl = legs.hindNear;
      // Pale belly / inner thigh countershading, then ventral core shadow over it
      ell(c, [0.06, bot + 0.06], 0.34, 0.08, 0, bBelly, 0.42);
      band(c, bot + 0.18, bot + 0.01, bot - 0.14, shade, 0.42);
      // Anatomical muscle planes (`coat.planes` scales visibility for sleek vs shaggy coats)
      along(c, T.withers, fl.sj, 0.48, light, 0.32 * planes);
      along(c, v2.add(T.withers, [-0.10, -0.06]), v2.add(fl.el, [-0.04, 0.03]), 0.26, shade, 0.24 * planes);
      ell(c, [0.08, hy - 0.02], 0.28, 0.15, 0, light, 0.16 * planes);
      ell(c, [hl.root[0] - 0.02, hy - 0.02], 0.20, 0.17, 0.22, light, 0.32 * planes);
      along(c, hl.st, hl.hk, 0.34, shade, 0.24 * planes);
      // Soft anatomical occlusion creases where the haunch meets the flank and the shoulder/forearm meets the chest
      c.save();
      c.lineCap = 'round';
      const creaseCol = emissive ? mixHex(dark, '#1E3A5F', 0.55) : mixHex(dark, '#060514', 0.65);
      c.strokeStyle = rgba(creaseCol, (emissive ? 0.32 : 0.44) * (0.4 + 0.6 * planes));
      c.lineWidth = Math.max(1.5, size * 0.014);
      const [hs0, hs1, hs2] = [
        [hl.st[0] + 0.02, hl.st[1] + 0.02],
        [hl.root[0] + 0.10, lerp(hl.st[1], hl.root[1], 0.52)],
        [hl.root[0] + 0.04, hl.root[1] - 0.06],
      ].map(M);
      c.beginPath();
      c.moveTo(hs0[0], hs0[1]);
      c.quadraticCurveTo(hs1[0], hs1[1], hs2[0], hs2[1]);
      const [fs0, fs1, fs2] = [
        [fl.el[0] - 0.02, fl.el[1] + 0.01],
        [fl.sj[0] - 0.05, lerp(fl.el[1], T.withers[1], 0.45)],
        [T.withers[0] - 0.05, T.withers[1] - 0.14],
      ].map(M);
      c.moveTo(fs0[0], fs0[1]);
      c.quadraticCurveTo(fs1[0], fs1[1], fs2[0], fs2[1]);
      c.stroke();
      c.restore();
      // Neck: lit dorsal crest, shaded jugular groove
      along(c, H.poll, T.withers, 0.32, light, 0.24);
      along(c, v2.lerp(H.latch || S.throat, T.pointShoulder, 0.15), v2.lerp(H.latch || S.throat, T.pointShoulder, 0.85), 0.35, shade, 0.20);
      // Head: cheek plane and darker muzzle / nostril
      ell(c, H.jaw, 0.075, 0.055, S.headAngle, light, 0.24);
      if (!emissive) ell(c, H.nostril, 0.05, 0.035, S.headAngle, shade, 0.55);
      // Lower legs darken toward the feet; carpus & hock joints catch subtle light
      band(c, Math.min(fl.kn[1], hl.hk[1]) + 0.06, 0.02, -0.04, shade, emissive ? 0.22 : 0.42);
      for (const p of [fl.kn, hl.hk]) ell(c, p, 0.036, 0.03, 0, light, 0.24 * planes);
      // Species markings (stockings, socks, bib, chin, blaze, saddle, rump, nose)
      for (const m of parts.markings) {
        if (!isTailMark(m) && !isEarMark(m)) drawMarking(c, m);
      }
    },
  }, lights);

  // 2d. Tail: its own lit layer over the haunch, so its rim separates it from the hind leg
  if (parts.tail.length) {
    const tc = parts.tailChain && parts.tailChain.length >= 2
      ? M(sampleProfileChain(parts.tailChain, 0.5).p)
      : M(T.croup);
    const tailLen = (P.tailSpec && P.tailSpec.len) || (P.tailT && P.tailT.len) || 0.35;
    drawLitOrganicShape(ctx, (c) => {
      for (const part of parts.tail) path(c, part);
    }, {
      ...nearOpts,
      cx: tc[0],
      cy: tc[1],
      radius: tailLen * size * 0.8 + 24,
      rimIntensity: 1.15 * bodyM.rim * airRim,
      drawInnerDetailsFn: (c) => {
        for (const m of parts.markings) if (isTailMark(m)) drawMarking(c, m);
      },
    }, lights);
  }

  // 2e. Near Ear: separate volume on top of poll with inner pinna shadow
  if (parts.earNear && parts.earNear.length) {
    const ec = M(H.ear || S.poll);
    drawLitOrganicShape(ctx, (c) => {
      for (const part of parts.earNear) path(c, part);
    }, {
      ...nearOpts,
      cx: ec[0],
      cy: ec[1],
      radius: Math.max(18, P.earLen * size * 0.45),
      rimIntensity: 1.15 * bodyM.rim * airRim,
      drawInnerDetailsFn: (c) => {
        for (const m of parts.markings) if (isEarMark(m)) drawMarking(c, m);
        ell(c, H.ear || S.poll, P.earLen * 0.12, P.earLen * 0.06, S.headAngle + 0.9, shade, 0.35);
      },
    }, lights);
  }

  // 3. Near antler over the head & ear
  drawAntler(parts.antlers && parts.antlers[0], false);

  // 4. Naturalistic eye: dark almond with a lid shadow and a tiny catchlight; predators get a visible iris
  if (H.eye) {
    const E = P.skullT.eye;
    const [ex, ey] = M(H.eye);
    const er = Math.max(1.8, P.headLen * size * E.r);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(-f * ((S.headAngle ?? S.headAng ?? 0) + (E.tilt || 0)));
    ctx.scale(f, 1);
    ctx.fillStyle = rgba(shade, 0.55);
    ctx.beginPath();
    ctx.ellipse(0, -er * 0.15, er * 1.7, er * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    const iris = col.eye || (emissive ? mixHex(dark, '#0F2942', 0.65) : (P.skull === 'canid' ? '#B9832E' : E.iris));
    ctx.fillStyle = iris || '#140D08';
    ctx.beginPath();
    ctx.ellipse(0, 0, er * 1.25, er * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();
    if (iris && !emissive) {
      ctx.fillStyle = '#120A06';
      ctx.beginPath();
      ctx.ellipse(er * 0.1, 0, er * 0.42, er * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = rgba('#FFFFFF', 0.72);
    ctx.beginPath();
    ctx.arc(er * 0.4, -er * 0.28, er * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  return S;
}

// ---------------------------------------------------------------------------
// 13. `world`-form aquatic creatures: parametric fish shaded with Material Roles (`drawProfileFish`)
// ---------------------------------------------------------------------------
// Geometry & velocity-aligned swimming kinematics live in `engine/critter2d.js` (`FISH_SPECIES`,
// `poseProfileFish`, `applyFishTransform`, `traceFishPart`).
// Shading here obeys `MATERIAL_ROLES`:
//   - Default `materials.body = 'fur'` (lit non-emissive aquatic body receiving ambient + dual-pass rim light)
//   - Optional `materials.body = 'spirit'` (emissive starlight/spirit fish — at most ONE per shot, governed desaturated near-white)
//   - Optional `lanternFish` illicium esca bulb shaded as a point light lure.

export function drawProfileFish(ctx, o = {}, lights = []) {
  if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) {
    reportOnce('fish-placement', 'drawProfileFish({ x, y, scale | length, ... }) needs explicit x and y.');
    return null;
  }
  const F = poseProfileFish(o);
  const { L, P } = F;
  const bodyRole = (o.materials && o.materials.body) || o.role || 'fur';
  const bodyM = MATERIAL_ROLES[bodyRole] || MATERIAL_ROLES.fur;
  const emissive = bodyM.emissive > 0.01;
  const col = o.colors || {};

  const amb = { level: 0.48, color: '#4B5FA8', ...(o.ambient || {}) };
  let lit = 0;
  for (const l of lights || []) {
    if (!l || (l.intensity ?? 1) <= 0.01) continue;
    const d = Math.hypot(l.x - F.x, l.y - F.y);
    lit += (l.intensity ?? 1) * Math.pow(clamp(1 - d / Math.max(160, (l.r || 420) * 2.1), 0, 1), 1.2) * 0.65;
  }
  const exposure = emissive ? 1 : clamp(amb.level + lit, amb.level, 1);
  const expose = (hex) => (exposure >= 0.999 ? hex : mixHex(mixHex(hex, '#000000', 1 - exposure), amb.color, (1 - exposure) * 0.22));
  const hz = o.haze && o.haze.color ? clamp(o.haze.amount ?? 0, 0, 1) : 0;
  const air = (hex) => (hz > 0 ? mixHex(expose(hex), o.haze.color, hz) : expose(hex));
  const airRim = 1 - 0.6 * hz;

  const rawDark = col.dark || (emissive ? '#FDE68A' : '#1E294B');
  const rawMid = col.mid || (emissive ? '#FFFBEB' : '#3B4E82');
  const rawFin = col.fin || mixHex(rawMid, '#93C5FD', 0.38);
  const bDark = air(governMaterialColor(rawDark, bodyM, { base: true }));
  const bMid = air(governMaterialColor(rawMid, bodyM, { base: true }));
  const bFin = air(governMaterialColor(rawFin, bodyM, { accent: true }));
  const bBounce = air(governMaterialColor(o.bounceColor || '#67E8F9', bodyM));
  const lureCol = col.lure || '#FDE047';

  const drawWorldPath = (c, partName) => {
    c.save();
    applyFishTransform(c, F);
    if (partName === 'pectoral') {
      c.translate(F.pecRoot[0], F.pecRoot[1]);
      c.rotate(F.finFlutter);
    }
    traceFishPart(c, F, partName);
    c.fill();
    c.restore();
  };

  ctx.save();
  ctx.globalAlpha *= clamp(o.alpha ?? 1, 0, 1);

  // 1. Emissive halo (strictly when role === 'spirit')
  if (emissive) {
    const glowR = L * 1.45;
    const gi = clamp((o.glowIntensity ?? 1.0) * bodyM.emissive, 0, 1.2);
    const g = ctx.createRadialGradient(F.x, F.y, 0, F.x, F.y, glowR);
    g.addColorStop(0, rgba('#FFFFFF', 0.46 * gi));
    g.addColorStop(0.32, rgba(bMid, 0.28 * gi));
    g.addColorStop(1, rgba(bDark, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(F.x, F.y, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Translucent dorsal + ventral fins (behind body)
  ctx.save();
  ctx.fillStyle = rgba(bFin, emissive ? 0.72 : 0.58);
  drawWorldPath(ctx, 'dorsal');
  drawWorldPath(ctx, 'ventral');
  ctx.restore();

  // 3. Main fish body + forked tail silhouette shaded via `drawLitOrganicShape`
  const radius = Math.max(28, L * 0.95);
  const coreShade = {
    color: emissive ? mixHex(bDark, '#1E3A5F', 0.45) : mixHex(bDark, '#000000', 0.5),
    alpha: (emissive ? 0.32 : 0.5) * (1 - 0.5 * hz),
    width: Math.max(3, L * 0.08),
  };
  drawLitOrganicShape(
    ctx,
    (c) => drawWorldPath(c, 'body'),
    {
      cx: F.x,
      cy: F.y,
      radius,
      baseDark: bDark,
      baseMid: bMid,
      bounceColor: bBounce,
      bounceAlpha: 0.36 * bodyM.bounce,
      rimScale: clamp(L / 140, 0.45, 1.15),
      rimIntensity: (emissive ? 0.85 : 1.08) * bodyM.rim * airRim,
      coreShade,
      drawInnerDetailsFn: (c) => {
        c.save();
        applyFishTransform(c, F);
        // Translucent caudal web veil
        c.fillStyle = rgba(bFin, emissive ? 0.42 : 0.28);
        traceFishPart(c, F, 'caudalWeb');
        c.fill();
        // Subtle lateral sheen along the spine + silver belly countershading
        const sheen = c.createLinearGradient(F.noseX, 0, F.tailTipTopX, 0);
        sheen.addColorStop(0, rgba('#FFFFFF', emissive ? 0.55 : 0.22));
        sheen.addColorStop(0.45, rgba(bFin, emissive ? 0.35 : 0.14));
        sheen.addColorStop(1, rgba(bDark, 0));
        c.fillStyle = sheen;
        c.fillRect(-L, -L * P.bodyDepth, L * 2.2, L * P.bodyDepth * 0.95);
        c.restore();
      },
    },
    lights
  );

  // 4. Pectoral fin, gill arc, naturalistic small world eye, and optional lantern lure
  ctx.save();
  applyFishTransform(ctx, F);

  // Pectoral fin
  ctx.save();
  ctx.translate(F.pecRoot[0], F.pecRoot[1]);
  ctx.rotate(F.finFlutter);
  const pecGrad = ctx.createLinearGradient(0, 0, L * P.pectoralLen, L * P.pectoralWidth);
  pecGrad.addColorStop(0, rgba(mixHex(bFin, '#FFFFFF', 0.25), emissive ? 0.82 : 0.68));
  pecGrad.addColorStop(1, rgba(bFin, emissive ? 0.45 : 0.28));
  ctx.fillStyle = pecGrad;
  traceFishPart(ctx, F, 'pectoral');
  ctx.fill();
  ctx.restore();

  // Gill arc
  ctx.strokeStyle = rgba(emissive ? bDark : mixHex(bDark, '#000000', 0.45), 0.34);
  ctx.lineWidth = Math.max(1.0, 1.6 * F.scale);
  ctx.lineCap = 'round';
  traceFishPart(ctx, F, 'gill');
  ctx.stroke();

  // Small world-form eye
  const er = F.eye.r;
  ctx.fillStyle = emissive ? rgba('#FFFFFF', 0.92) : rgba('#0D1326', 0.92);
  ctx.beginPath();
  ctx.arc(F.eye.x, F.eye.y, er, 0, Math.PI * 2);
  ctx.fill();
  if (!emissive) {
    ctx.fillStyle = rgba('#FFFFFF', 0.78);
    ctx.beginPath();
    ctx.arc(F.eye.x - er * 0.28, F.eye.y - er * 0.28, er * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }

  // Optional lanternFish illicium stalk + glowing esca lure
  if (F.lure) {
    ctx.strokeStyle = rgba(lureCol, 0.62);
    ctx.lineWidth = Math.max(1.1, 1.5 * F.scale);
    traceFishPart(ctx, F, 'lureStalk');
    ctx.stroke();

    const [lx, ly] = F.lure.tip;
    const br = F.lure.bulbR;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, br * 5.2);
    lg.addColorStop(0, rgba('#FFFFFF', 0.85));
    lg.addColorStop(0.32, rgba(lureCol, 0.52));
    lg.addColorStop(1, rgba(lureCol, 0));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(lx, ly, br * 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(lx, ly, br * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  ctx.restore();
  return F;
}

export const drawTwilightFish = drawProfileFish;

/**
 * Backwards-compatible wrapper matching `(ctx, x, y, scale, angle, t, opts)` signature
 * while routing through `drawProfileFish` and `MATERIAL_ROLES`.
 */
export function drawStarlightFish(ctx, x, y, scale = 1.0, angle = 0, t = 0, opts = {}) {
  if (typeof x === 'object' && x !== null) {
    return drawProfileFish(ctx, x, y || []);
  }
  return drawProfileFish(
    ctx,
    {
      ...opts,
      x,
      y,
      scale,
      angle,
      t,
      role: opts.role || (opts.materials && opts.materials.body) || 'spirit',
    },
    opts.lights || []
  );
}

