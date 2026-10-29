/**
 * Style-agnostic 2D creature geometry and kinematics (`engine/critter2d.js`) — ADR-015.
 *
 * Layer 1 geometry and motion only — zero colours, zero lights, zero style-specific shaders.
 * Shading and optical rendering live in style kernels (e.g. `styles/twilight-fable/kernel.js`).
 *
 * Provides two unified creature geometry models across styles:
 *   1. `plush` (Hero Form):
 *      - 120Hz continuous-topology spring rig (`simulateCritterRig`)
 *      - Volume-conserving parabolic spine capsule & neck bridge envelope (`traceSmoothSpineBodyPath`, `traceNeckBridgePath`)
 *      - Table-driven ear (`CRITTER_EAR_TYPES`) & tail (`CRITTER_TAIL_TYPES`) topology tables
 *      - 4 plush IK limbs (`tracePlushLimbPath`, `limbSocketsFor`)
 *      - Continuous multi-view projection (`projectCritterView`)
 *      - `HERO_MOVES` motion vocabulary & choreography performer (`heroBaseAt`, `createPlushCritter`)
 *
 *   2. `world` (Side-Profile Quadruped Form):
 *      - Parameterised anatomical outline generator from orthogonal body-plan axes:
 *        stance (unguligrade/digitigrade/plantigrade) × skull (grazer/canid/ursid) ×
 *        trunk (barrel/tucked/heavy) × coat (sleek/short/plush/shaggy) × tail (flag/brush/hair/stub) ×
 *        gait (walk/trot) × markings × withers height in metres (`PROFILE_SPECIES`)
 *      - Posing & silhouette extraction (`poseProfileQuadruped`, `traceProfilePart`, `profileParts`)
 */

import { clamp, lerp, smootherstep } from './motion.js';

const _reportedOnce = new Set();
function reportOnce(key, msg) {
  if (_reportedOnce.has(key)) return;
  _reportedOnce.add(key);
  console.error(`[critter2d] ${msg}`);
}

// ===========================================================================
// SECTION I: PLUSH HERO-FORM CREATURE RIG & KINEMATICS (Layer 1 Geometry)
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. Spring Math Helpers
// ---------------------------------------------------------------------------

export function stepSpring1D(st, target, omega, zeta, dt, extForce = 0) {
  const prevV = st.v;
  const force = omega * omega * (target - st.x) - 2 * zeta * omega * st.v + extForce;
  st.v += force * dt;
  st.x += st.v * dt;
  st.a = (st.v - prevV) / dt;
}

export function stepSpring2D(st, tx, ty, omega, zeta, dt, fx = 0, fy = 0) {
  const pvx = st.vx;
  const pvy = st.vy;
  const ax = omega * omega * (tx - st.x) - 2 * zeta * omega * st.vx + fx;
  const ay = omega * omega * (ty - st.y) - 2 * zeta * omega * st.vy + fy;
  st.vx += ax * dt;
  st.vy += ay * dt;
  st.x += st.vx * dt;
  st.y += st.vy * dt;
  st.ax = (st.vx - pvx) / dt;
  st.ay = (st.vy - pvy) / dt;
}

export function wrapAngleNear(a, ref) {
  let d = a - ref;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return ref + d;
}

/** Blends a choreographed ear-root angle toward hanging (droop) / sideways (splay) for the ear's screen side. */
export function shapeEarAngle(angle, side, droop, splay) {
  if (droop <= 0.001 && splay <= 0.001) return angle;
  const hang = [side * 0.32, 1];
  const spl = [side * 1, -0.22];
  const s2 = splay * (1 - droop);
  const wd = 1 - droop - s2;
  const vx = Math.cos(angle) * wd + hang[0] * droop + spl[0] * s2;
  const vy = Math.sin(angle) * wd + hang[1] * droop + spl[1] * s2;
  return Math.atan2(vy, vx);
}

// ---------------------------------------------------------------------------
// 2. Topology Tables & Build Defaults
// ---------------------------------------------------------------------------

/**
 * Ear topology table. Widths and segment lengths are in scale units.
 * Contour ears are part of the head silhouette, defined in head-radius units.
 */
export const CRITTER_EAR_TYPES = {
  long: { seg: [42, 40, 36], width: (u) => (15 + 14 * Math.sin(Math.PI * Math.pow(u, 0.72))) * (1 - 0.25 * u), droop: 0, splay: 0 },
  lop: { seg: [40, 40, 38], width: (u) => (17 + 16 * Math.sin(Math.PI * Math.pow(u, 0.6))) * (1 - 0.1 * u), droop: 0.8, splay: 0 },
  leaf: { seg: [30, 26, 20], width: (u) => (12 + 13 * Math.sin(Math.PI * Math.pow(u, 0.55))) * (1 - 0.55 * u), droop: 0, splay: 0.55 },
  tri: { seg: [20, 16, 12], droop: 0, splay: 0.12, contour: { outer: [-0.90, -0.30], tip: [-0.62, -1.16], inner: [-0.20, -0.72] } },
  round: { seg: [12, 10, 6], droop: 0, splay: 0.3, contour: { outer: [-0.86, -0.5], tip: [-0.66, -0.98], inner: [-0.36, -0.8], round: true } },
  none: null,
};

/**
 * 100% table-driven tail topology table (ADR-015):
 * Each tail type declares its segment lengths, width curve, rootX offset behind pelvis,
 * ground/air rootY offsets, ground/air drop angle offsets, and 3-joint resting curl array.
 */
export const CRITTER_TAIL_TYPES = {
  plume: {
    seg: [38, 40, 38, 34],
    width: (u) => 18 + 29 * Math.sin(Math.PI * Math.pow(u, 0.64)),
    rootX: 28,
    rootY: [-10, -10],
    dropAngle: [0, 0],
    restCurl: [-0.14, -0.10, 0.16],
  },
  pom: {
    seg: [9, 8, 7, 6],
    width: (u) => 24 + 14 * Math.sin(Math.PI * u),
    rootX: 28,
    rootY: [-10, -10],
    dropAngle: [0, 0],
    restCurl: [-0.14, -0.10, 0.16],
  },
  stub: {
    seg: [14, 12, 9, 6],
    width: (u) => (14 + 6 * Math.sin(Math.PI * u)) * (1 - 0.4 * u),
    rootX: 28,
    rootY: [-8, -8],
    dropAngle: [0, 0],
    restCurl: [-0.14, -0.10, 0.16],
  },
  thin: {
    seg: [30, 30, 28, 24],
    width: (u) => (12 + 4.5 * Math.sin(Math.PI * u)) * (1 - 0.30 * u),
    rootX: 34,
    rootY: [2, -4],
    dropAngle: [0.56, 0.24],
    restCurl: [-0.26, -0.36, -0.28],
  },
  none: null,
};

export const CRITTER_BUILD_DEFAULTS = {
  bodyLen: 1.0, // spine rest length multiplier
  girth: 1.0, // torso / neck radius multiplier
  headR: 1.0, // head radius multiplier
  headWidth: 1.0, // cheek width multiplier (plush kitten face is wider than tall)
  muzzle: 0.25, // 0 = flat kitten face … 1 = long deer / fox snout
  legLen: 1.0, // limb reach multiplier (raise pelvisY accordingly in choreography)
  legGirth: 1.0, // limb thickness multiplier
  earType: 'long', // keyof CRITTER_EAR_TYPES
  earLen: 1.0,
  earWidth: 1.0,
  earDroop: null, // null = use ear type default
  earSplay: null,
  tailType: 'plume', // keyof CRITTER_TAIL_TYPES
  tailLen: 1.0,
  tailWidth: 1.0,
  horn: 'none', // 'none' | 'buds' | 'antlers'
  hornColor: null,
  hornGlow: null,
  cheekTufts: true,
  eyeSize: 1.0,
  eyeGap: 0.4, // gap between eyes in eye-widths
  irisColors: null,
  blush: null, // null disables
  noseColor: null,
  mouth: false, // hero faces are mouthless (eyes carry the face); true draws nose + mouth line
  materials: null, // partial { body, accents, horn } → keyof MATERIAL_ROLES
};

export const DEFAULT_PLUSH_SPECIES = {
  fennec: {
    species: 'fennec',
    build: { earType: 'long', tailType: 'plume', muzzle: 0.35 },
  },
  moonBunny: {
    species: 'moonBunny',
    build: { earType: 'lop', tailType: 'pom', bodyLen: 0.96, girth: 0.98, legLen: 0.98, headR: 1.04, muzzle: 0.08, earLen: 1.08 },
  },
  mossDeer: {
    species: 'mossDeer',
    build: {
      earType: 'leaf',
      tailType: 'stub',
      horn: 'antlers',
      legLen: 1.42,
      legGirth: 0.72,
      girth: 0.84,
      bodyLen: 1.14,
      headR: 0.88,
      muzzle: 0.7,
      cheekTufts: false,
    },
  },
  cubBear: {
    species: 'cubBear',
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
    },
  },
  meadowCat: {
    species: 'meadowCat',
    build: {
      earType: 'tri',
      tailType: 'thin',
      bodyLen: 0.96,
      girth: 0.98,
      legLen: 0.98,
      legGirth: 1.0,
      headR: 1.06,
      headWidth: 1.04,
      muzzle: 0.06,
      cheekTufts: false,
      eyeSize: 1.14,
      tailLen: 1.0,
    },
  },
};

export function resolveCritterBuild(speciesCfg = {}, overrides = {}) {
  const b = { ...CRITTER_BUILD_DEFAULTS, ...(speciesCfg.build || {}), ...(overrides || {}) };
  if (speciesCfg.earSegScale) b.earLen *= speciesCfg.earSegScale;
  if (speciesCfg.earWidthMul) b.earWidth *= speciesCfg.earWidthMul;
  if (speciesCfg.tailSegScale && !(speciesCfg.build && speciesCfg.build.tailLen)) b.tailLen *= speciesCfg.tailSegScale;
  if (speciesCfg.tailWidthMul) b.tailWidth *= speciesCfg.tailWidthMul;
  if (speciesCfg.hasAntlers && b.horn === 'none') b.horn = 'buds';
  return b;
}

export const CRITTER_PART_MATERIALS = { body: 'fur', accents: null, horn: 'hard' };

export function resolveCritterMaterials(build = {}) {
  const m = { ...CRITTER_PART_MATERIALS, ...(build.materials || {}) };
  if (!m.accents) m.accents = m.body;
  return m;
}

// ---------------------------------------------------------------------------
// 3. Contour Ear Geometry
// ---------------------------------------------------------------------------

export function contourEarGeometry(type, build, side, twist = 0) {
  const c = type.contour;
  const len = build.earLen ?? 1;
  const wid = build.earWidth ?? 1;
  const mx = (c.outer[0] + c.inner[0]) * 0.5;
  const my = (c.outer[1] + c.inner[1]) * 0.5;
  const rel = (p, kx, ky) => [mx + (p[0] - mx) * kx, my + (p[1] - my) * ky];
  const cos = Math.cos(twist * side * -1);
  const sin = Math.sin(twist * side * -1);
  const rot = (p) => {
    const dx = p[0] - mx;
    const dy = p[1] - my;
    return [mx + dx * cos - dy * sin, my + dx * sin + dy * cos];
  };
  const mirror = (p) => [p[0] * -side, p[1]];
  const outer = mirror(rot(rel(c.outer, wid, 1)));
  const inner = mirror(rot(rel(c.inner, wid, 1)));
  const tip = mirror(rot(rel(c.tip, wid, len)));
  return { outer, inner, tip, base: [(outer[0] + inner[0]) * 0.5, (outer[1] + inner[1]) * 0.5], round: !!c.round };
}

export function traceContourEar(ctx, pt, g, side = -1) {
  const lerp2 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const o = pt(...lerp2(g.outer, g.base, -0.05));
  const i = pt(...lerp2(g.inner, g.base, -0.05));
  const sink = pt(g.base[0], g.base[1] + 0.22);
  let edges;
  if (g.round) {
    const bulgeO = [g.outer[0] + (g.tip[0] - g.base[0]) * 0.9, g.outer[1] + (g.tip[1] - g.base[1]) * 0.9];
    const bulgeI = [g.inner[0] + (g.tip[0] - g.base[0]) * 0.9, g.inner[1] + (g.tip[1] - g.base[1]) * 0.9];
    edges = [
      [bulgeO, lerp2(bulgeO, g.tip, 0.55), g.tip],
      [lerp2(bulgeI, g.tip, 0.55), bulgeI, g.inner],
    ];
  } else {
    const oc = lerp2(lerp2(g.outer, g.tip, 0.55), [g.outer[0] * 1.08, g.outer[1]], 0.25);
    const ic = lerp2(lerp2(g.inner, g.tip, 0.5), g.base, 0.12);
    edges = [
      [oc, lerp2(g.tip, g.outer, 0.07)],
      [g.tip, lerp2(g.tip, g.inner, 0.07)],
      [ic, g.inner],
    ];
  }
  const curve = (cps, end) => {
    const q = [...cps.map((p) => pt(...p)), end].flat();
    if (cps.length === 2) ctx.bezierCurveTo(...q);
    else ctx.quadraticCurveTo(...q);
  };
  ctx.moveTo(...sink);
  if (side < 0) {
    ctx.lineTo(...o);
    edges.forEach((e, k) => curve(e.slice(0, -1), k === edges.length - 1 ? i : pt(...e[e.length - 1])));
  } else {
    ctx.lineTo(...i);
    const starts = [g.outer, ...edges.slice(0, -1).map((e) => e[e.length - 1])];
    for (let k = edges.length - 1; k >= 0; k--) {
      const cps = edges[k].slice(0, -1).reverse();
      curve(cps, k === 0 ? o : pt(...starts[k]));
    }
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// 4. 120Hz Continuous-Topology Spring Creature Rig Simulator
// ---------------------------------------------------------------------------

export function simulateCritterRig(targetT, choreoFn, scale = 1.32, opts = {}) {
  const dt = 1 / 120;
  const initIntent = choreoFn(0);
  const speciesKey = opts.species || initIntent.species || 'fennec';
  const table = opts.speciesTable || DEFAULT_PLUSH_SPECIES;
  const baseSpecies = opts.speciesCfg || table[speciesKey] || DEFAULT_PLUSH_SPECIES[speciesKey] || DEFAULT_PLUSH_SPECIES.fennec || {};
  const speciesCfg = { ...baseSpecies, ...(opts.paletteOverrides || {}) };
  const build = resolveCritterBuild(speciesCfg, opts.build);
  const earType = CRITTER_EAR_TYPES[build.earType] === undefined ? CRITTER_EAR_TYPES.long : CRITTER_EAR_TYPES[build.earType];
  const tailType = CRITTER_TAIL_TYPES[build.tailType] === undefined ? CRITTER_TAIL_TYPES.plume : CRITTER_TAIL_TYPES[build.tailType];
  const droop = build.earDroop ?? earType?.droop ?? 0;
  const splay = build.earSplay ?? earType?.splay ?? 0;

  const restSpineLen = 68 * scale * build.bodyLen;
  const minSpineLen = 0.72 * restSpineLen;
  const maxSpineLen = 1.65 * restSpineLen;
  const headK = 0.6 + 0.4 * build.headR;
  const minNeckDist = 28 * scale * headK;
  const maxNeckDist = 56 * scale * headK;
  const initFacing = initIntent.facing ?? -1;

  const mk = (x, y) => ({ x, y, vx: 0, vy: 0, ax: 0, ay: 0 });
  const pelvis = mk(initIntent.pelvisX, initIntent.pelvisY);
  const chest = mk(initIntent.pelvisX + initIntent.chestOffsetX, initIntent.pelvisY + initIntent.chestOffsetY);
  const waist = mk((pelvis.x + chest.x) * 0.5, (pelvis.y + chest.y) * 0.5);
  const headRel = mk(initIntent.headOffsetX, initIntent.headOffsetY);
  const head = mk(chest.x + headRel.x, chest.y + headRel.y);

  const headYaw = { x: initIntent.headYaw ?? 0, v: 0, a: 0 };
  const headTilt = { x: initIntent.headTilt ?? 0, v: 0, a: 0 };
  const headPitch = { x: initIntent.headPitch ?? 0, v: 0, a: 0 };

  const earCurlL = [-0.10, -0.12];
  const earCurlR = [0.10, 0.12];
  const ear0L = shapeEarAngle((initIntent.earAngleL ?? -1.9) + (initIntent.headTilt ?? 0) * 0.75, -1, droop, splay);
  const ear0R = shapeEarAngle((initIntent.earAngleR ?? -1.24) + (initIntent.headTilt ?? 0) * 0.75, 1, droop, splay);
  const earLAngles = [0, 1, 2].map((k) => ({ x: ear0L + (k > 0 ? earCurlL.slice(0, k).reduce((a, b) => a + b, 0) : 0), v: 0, a: 0 }));
  const earRAngles = [0, 1, 2].map((k) => ({ x: ear0R + (k > 0 ? earCurlR.slice(0, k).reduce((a, b) => a + b, 0) : 0), v: 0, a: 0 }));

  const tailRootX = tailType?.rootX ?? 28;
  const tailRootYArr = tailType?.rootY ?? [-10, -10];
  const tailDropArr = tailType?.dropAngle ?? [0, 0];
  const tailRestCurlBase = tailType?.restCurl ?? [-0.14, -0.10, 0.16];

  const tailDrop0 = tailDropArr[0] * -initFacing;
  const tail0 = (initIntent.tailAngle ?? (initFacing < 0 ? -0.45 : -Math.PI + 0.45)) + tailDrop0;
  const tailAngles = [0, 1, 2, 3].map((k) => {
    let a = tail0;
    for (let j = 0; j < k; j++) a += tailRestCurlBase[j] * -initFacing;
    return { x: a, v: 0, a: 0 };
  });

  const feet = {
    hindL: mk(initIntent.feet.hindL[0], initIntent.feet.hindL[1]),
    hindR: mk(initIntent.feet.hindR[0], initIntent.feet.hindR[1]),
    frontL: mk(initIntent.feet.frontL[0], initIntent.feet.frontL[1]),
    frontR: mk(initIntent.feet.frontR[0], initIntent.feet.frontR[1]),
  };

  const steps = Math.max(1, Math.round(clamp(targetT, 0, 20) / dt));
  let curIntent = initIntent;
  const stretchS = { hindL: { x: 1, v: 0, a: 0 }, hindR: { x: 1, v: 0, a: 0 }, frontL: { x: 1, v: 0, a: 0 }, frontR: { x: 1, v: 0, a: 0 } };

  for (let i = 1; i <= steps; i++) {
    const t = Math.min(targetT, i * dt);
    curIntent = choreoFn(t);
    const facingNow = curIntent.facing ?? initFacing;

    // 1. Pelvis Spring
    stepSpring2D(pelvis, curIntent.pelvisX, curIntent.pelvisY, 28.0, 0.80, dt, curIntent.pelvisForceX || 0, curIntent.pelvisForceY || 0);

    // 2. Chest Spring
    {
      const pvx = chest.vx;
      const pvy = chest.vy;
      const tx = pelvis.x + curIntent.chestOffsetX;
      const ty = pelvis.y + curIntent.chestOffsetY;
      const omega = 26.0;
      const zeta = 0.78;
      const ax = omega * omega * (tx - chest.x) - 2 * zeta * omega * (chest.vx - pelvis.vx) - 0.04 * pelvis.ax + (curIntent.chestForceX || 0);
      const ay = omega * omega * (ty - chest.y) - 2 * zeta * omega * (chest.vy - pelvis.vy) - 0.05 * pelvis.ay + (curIntent.chestForceY || 0);
      chest.vx += ax * dt;
      chest.vy += ay * dt;
      chest.x += chest.vx * dt;
      chest.y += chest.vy * dt;
      chest.ax = (chest.vx - pvx) / dt;
      chest.ay = (chest.vy - pvy) / dt;
    }

    // Hard Spine Length Clamp
    {
      const sDx = chest.x - pelvis.x;
      const sDy = chest.y - pelvis.y;
      const sDist = Math.max(1e-4, Math.hypot(sDx, sDy));
      if (sDist < minSpineLen || sDist > maxSpineLen) {
        const clampedLen = clamp(sDist, minSpineLen, maxSpineLen);
        const ux = sDx / sDist;
        const uy = sDy / sDist;
        chest.x = pelvis.x + ux * clampedLen;
        chest.y = pelvis.y + uy * clampedLen;
        const radV = (chest.vx - pelvis.vx) * ux + (chest.vy - pelvis.vy) * uy;
        if ((sDist > maxSpineLen && radV > 0) || (sDist < minSpineLen && radV < 0)) {
          chest.vx -= radV * ux * 0.85;
          chest.vy -= radV * uy * 0.85;
        }
      }
    }

    // 3. Waist Spring
    const spineDx = chest.x - pelvis.x;
    const spineDy = chest.y - pelvis.y;
    const spineLen = Math.max(1, Math.hypot(spineDx, spineDy));
    const archAmt = clamp(curIntent.spineArch ?? -6 * scale, -22 * scale, 22 * scale);
    const midSpineX = (pelvis.x + chest.x) * 0.5;
    const midSpineY = (pelvis.y + chest.y) * 0.5;
    const archSign = -facingNow;
    stepSpring2D(
      waist,
      midSpineX + (spineDy / spineLen) * archAmt * archSign,
      midSpineY - (spineDx / spineLen) * archAmt * archSign,
      28.0,
      0.78,
      dt,
      -0.04 * pelvis.ax,
      -0.05 * pelvis.ay
    );
    {
      const maxWaistOff = 22 * scale;
      const wDx = waist.x - midSpineX;
      const wDy = waist.y - midSpineY;
      const wDist = Math.hypot(wDx, wDy);
      if (wDist > maxWaistOff) {
        waist.x = midSpineX + (wDx / wDist) * maxWaistOff;
        waist.y = midSpineY + (wDy / wDist) * maxWaistOff;
        waist.vx *= 0.65;
        waist.vy *= 0.65;
      }
    }

    // 4. Head Spring
    stepSpring2D(headRel, curIntent.headOffsetX, curIntent.headOffsetY, 26.0, 0.80, dt, -0.05 * chest.ax, -0.06 * chest.ay + (curIntent.headForceY || 0));
    {
      headRel.y = Math.min(headRel.y, -10 * scale);
      const nDist = Math.max(1e-4, Math.hypot(headRel.x, headRel.y));
      if (nDist < minNeckDist || nDist > maxNeckDist) {
        const clampedN = clamp(nDist, minNeckDist, maxNeckDist);
        const ux = headRel.x / nDist;
        const uy = headRel.y / nDist;
        headRel.x = ux * clampedN;
        headRel.y = uy * clampedN;
        const radV = headRel.vx * ux + headRel.vy * uy;
        if ((nDist > maxNeckDist && radV > 0) || (nDist < minNeckDist && radV < 0)) {
          headRel.vx -= radV * ux;
          headRel.vy -= radV * uy;
        }
      }
    }
    head.x = chest.x + headRel.x;
    head.y = chest.y + headRel.y;
    head.vx = chest.vx + headRel.vx;
    head.vy = chest.vy + headRel.vy;
    head.ax = chest.ax + headRel.ax;
    head.ay = chest.ay + headRel.ay;

    const inertialTilt = clamp(chest.ax * 0.00008 - chest.ay * 0.00006, -0.14, 0.14);
    const inertialPitch = clamp(chest.ay * 0.0001, -0.16, 0.16);
    stepSpring1D(headYaw, curIntent.headYaw ?? 0, 22.0, 0.78, dt);
    stepSpring1D(headTilt, (curIntent.headTilt ?? 0) + inertialTilt, 22.0, 0.76, dt);
    stepSpring1D(headPitch, (curIntent.headPitch ?? 0) + inertialPitch, 22.0, 0.76, dt);
    headYaw.x = clamp(headYaw.x, -0.75, 0.75);
    headTilt.x = clamp(headTilt.x, -0.32, 0.32);
    headPitch.x = clamp(headPitch.x, -0.32, 0.32);

    // 5. Ear Pendulums
    const baseEarL = wrapAngleNear(shapeEarAngle((curIntent.earAngleL ?? -1.9) + headTilt.x * 0.75, -1, droop, splay), earLAngles[0].x);
    const baseEarR = wrapAngleNear(shapeEarAngle((curIntent.earAngleR ?? -1.24) + headTilt.x * 0.75, 1, droop, splay), earRAngles[0].x);
    const earOmegas = [22.0, 18.0, 14.5];
    const earZetas = [0.66, 0.64, 0.62];
    const earFx = -0.0018 * head.ax - 0.008 * head.vx;
    const earFy = -0.0018 * head.ay - 0.008 * head.vy;

    for (let k = 0; k < 3; k++) {
      for (const [angles, base, curl] of [
        [earLAngles, baseEarL, earCurlL],
        [earRAngles, baseEarR, earCurlR],
      ]) {
        const rest = k === 0 ? base : angles[k - 1].x + curl[k - 1];
        const th = angles[k].x;
        const tau = Math.cos(th) * earFy - Math.sin(th) * earFx - headTilt.a * 0.06 - headYaw.v * 0.35;
        stepSpring1D(angles[k], rest, earOmegas[k], earZetas[k], dt, clamp(tau, -28, 28));
        const maxDev = k === 0 ? 0.44 : 0.36;
        if (Math.abs(angles[k].x - rest) > maxDev) {
          angles[k].x = clamp(angles[k].x, rest - maxDev, rest + maxDev);
          angles[k].v *= 0.45;
        }
      }
    }

    // 6. Tail Chain (100% table-driven + Haunch-Stride Counter-Balance Linkage)
    const groundYNow = Number.isFinite(curIntent.groundY) ? curIntent.groundY : pelvis.y + 45 * scale * build.legLen;
    const airFactor = clamp((groundYNow - 48 * scale * build.legLen - pelvis.y) / (75 * scale), 0, 1);
    const tailDrop = lerp(tailDropArr[0], tailDropArr[1], airFactor) * -facingNow;
    const hindFootRefX = curIntent.feet?.hindL ? curIntent.feet.hindL[0] : pelvis.x - facingNow * 8 * scale;
    const hindStrideNorm = clamp(((hindFootRefX - (pelvis.x - facingNow * 8 * scale)) * facingNow) / (36 * scale), -1, 1);
    const haunchTailLink = hindStrideNorm * 0.14 * -facingNow;
    const baseTail = wrapAngleNear((curIntent.tailAngle ?? (facingNow < 0 ? -0.45 : -Math.PI + 0.45)) + tailDrop + haunchTailLink, tailAngles[0].x);
    const tailOmegas = [20.0, 16.5, 13.5, 11.0];
    const tailZetas = [0.68, 0.65, 0.63, 0.62];
    const tailWag = Math.sin(t * 5.2) * (curIntent.tailWagAmp ?? 0.08);
    const tailFx = -0.0016 * pelvis.ax - 0.007 * pelvis.vx;
    const tailFy = -0.0016 * pelvis.ay - 0.007 * pelvis.vy;
    for (let k = 0; k < 4; k++) {
      const restT = k === 0 ? baseTail + tailWag : tailAngles[k - 1].x + tailRestCurlBase[k - 1] * -facingNow;
      const thT = tailAngles[k].x;
      const tauT = Math.cos(thT) * tailFy - Math.sin(thT) * tailFx;
      stepSpring1D(tailAngles[k], restT, tailOmegas[k], tailZetas[k], dt, clamp(tauT, -24, 24));
      const maxTailDev = k === 0 ? 0.42 : 0.34;
      if (Math.abs(tailAngles[k].x - restT) > maxTailDev) {
        tailAngles[k].x = clamp(tailAngles[k].x, restT - maxTailDev, restT + maxTailDev);
        tailAngles[k].v *= 0.45;
      }
    }

    // 7. Foot Springs
    stepSpring2D(feet.hindL, curIntent.feet.hindL[0], curIntent.feet.hindL[1], 38.0, 0.80, dt);
    stepSpring2D(feet.hindR, curIntent.feet.hindR[0], curIntent.feet.hindR[1], 38.0, 0.80, dt);
    stepSpring2D(feet.frontL, curIntent.feet.frontL[0], curIntent.feet.frontL[1], 36.0, 0.78, dt);
    stepSpring2D(feet.frontR, curIntent.feet.frontR[0], curIntent.feet.frontR[1], 36.0, 0.78, dt);

    const L = build.legLen;
    const g = build.girth;
    const ls = curIntent.limbStretch;
    for (const key of Object.keys(stretchS)) {
      stepSpring1D(stretchS[key], typeof ls === 'number' ? ls : (ls && ls[key]) || 1, 32.0, 0.9, dt);
    }
    const st = (key) => Math.max(0.5, stretchS[key].x);
    const reachL = (key) => lerp(L, Math.max(L, build.headR * (build.headWidth ?? 1)), clamp((st(key) - 1) * 3.5, 0, 1));
    const limbSockets = [
      { foot: feet.hindL, sx: pelvis.x - facingNow * 6 * scale, sy: pelvis.y + 12 * scale * g, maxR: 94 * scale * reachL('hindL') * 0.95 * st('hindL') },
      { foot: feet.hindR, sx: pelvis.x - facingNow * 16 * scale, sy: pelvis.y + 10 * scale * g, maxR: 92 * scale * reachL('hindR') * 0.95 * st('hindR') },
      { foot: feet.frontL, sx: chest.x + facingNow * 20 * scale, sy: chest.y + 10 * scale * g, maxR: 92 * scale * reachL('frontL') * 0.95 * st('frontL') },
      { foot: feet.frontR, sx: chest.x + facingNow * 10 * scale, sy: chest.y + 12 * scale * g, maxR: 88 * scale * reachL('frontR') * 0.95 * st('frontR') },
    ];
    for (const ls of limbSockets) {
      const fDx = ls.foot.x - ls.sx;
      const fDy = ls.foot.y - ls.sy;
      const fDist = Math.hypot(fDx, fDy);
      if (fDist > ls.maxR) {
        ls.foot.x = ls.sx + (fDx / fDist) * ls.maxR;
        ls.foot.y = ls.sy + (fDy / fDist) * ls.maxR;
        ls.foot.vx *= 0.6;
        ls.foot.vy *= 0.6;
      }
    }
  }

  const R = 56 * scale * build.headR;
  const tiltCos = Math.cos(headTilt.x);
  const tiltSin = Math.sin(headTilt.x);
  const yawShift = -headYaw.x * R * 0.14;
  const headPt = (lx, ly) => [
    head.x + (lx * R + yawShift) * tiltCos - ly * R * tiltSin,
    head.y + (lx * R + yawShift) * tiltSin + ly * R * tiltCos,
  ];

  const earSeg = earType ? earType.seg.map((v) => v * scale * build.headR * build.earLen) : [0, 0, 0];
  const earRootY = build.earType === 'round' || build.earType === 'tri' ? -0.74 : -0.68;
  const earRootX = build.earType === 'round' ? 0.62 : build.earType === 'leaf' ? 0.66 : 0.48;
  const earL = [headPt(-earRootX, earRootY)];
  const earR = [headPt(earRootX, earRootY)];
  for (let k = 0; k < 3; k++) {
    earL.push([earL[k][0] + Math.cos(earLAngles[k].x) * earSeg[k], earL[k][1] + Math.sin(earLAngles[k].x) * earSeg[k]]);
    earR.push([earR[k][0] + Math.cos(earRAngles[k].x) * earSeg[k], earR[k][1] + Math.sin(earRAngles[k].x) * earSeg[k]]);
  }

  let earTwist = [0, 0];
  if (earType?.contour) {
    const restL = shapeEarAngle((curIntent.earAngleL ?? -1.9) + headTilt.x * 0.75, -1, droop, splay);
    const restR = shapeEarAngle((curIntent.earAngleR ?? -1.24) + headTilt.x * 0.75, 1, droop, splay);
    const neutralL = shapeEarAngle(-1.9 + headTilt.x * 0.75, -1, droop, splay);
    const neutralR = shapeEarAngle(-1.24 + headTilt.x * 0.75, 1, droop, splay);
    earTwist = [
      clamp(-((earLAngles[0].x - restL) * 0.45 + (restL - neutralL) * 0.35), -0.42, 0.42),
      clamp((earRAngles[0].x - restR) * 0.45 + (restR - neutralR) * 0.35, -0.42, 0.42),
    ];
    for (const [side, arr, tw] of [[-1, earL, earTwist[0]], [1, earR, earTwist[1]]]) {
      const g = contourEarGeometry(earType, build, side, tw);
      const lerp2 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
      arr.splice(0, arr.length, headPt(...g.base), headPt(...lerp2(g.base, g.tip, 0.45)), headPt(...lerp2(g.base, g.tip, 0.8)), headPt(...g.tip));
    }
  }

  const facing = curIntent.facing ?? initFacing;
  const tailSeg = tailType ? tailType.seg.map((v) => v * scale * build.tailLen) : [0, 0, 0, 0];
  const groundYFinal = Number.isFinite(curIntent.groundY) ? curIntent.groundY : pelvis.y + 45 * scale * build.legLen;
  const airK = clamp((groundYFinal - 48 * scale * build.legLen - pelvis.y) / (75 * scale), 0, 1);
  const tailRootOffsetY = lerp(tailRootYArr[0], tailRootYArr[1], airK);
  const hindMidXForTail = feet.hindL.x * 0.68 + feet.hindR.x * 0.32;
  const hindMidYForTail = feet.hindL.y * 0.68 + feet.hindR.y * 0.32;
  const tailHaunchDx = clamp(hindMidXForTail - (pelvis.x - facing * 10 * scale), -32 * scale, 32 * scale) * 0.22;
  const tailHaunchDy = clamp(hindMidYForTail - (pelvis.y + 45 * scale * build.legLen), -18 * scale, 22 * scale) * 0.16;
  const tailRoot = [
    pelvis.x - facing * tailRootX * scale * build.girth + tailHaunchDx,
    pelvis.y + tailRootOffsetY * scale * build.girth + tailHaunchDy,
  ];
  const tail = [tailRoot];
  for (let k = 0; k < 4; k++) {
    tail.push([tail[k][0] + Math.cos(tailAngles[k].x) * tailSeg[k], tail[k][1] + Math.sin(tailAngles[k].x) * tailSeg[k]]);
  }

  const currentSpineLen = Math.hypot(chest.x - pelvis.x, chest.y - pelvis.y);
  const spineStretch = clamp(currentSpineLen / Math.max(1, restSpineLen), 0.68, 1.68);

  return {
    scale,
    R,
    speciesCfg,
    build,
    earType: build.earType,
    tailType: build.tailType,
    facing,
    view: curIntent.view || opts.view || '3q',
    pelvis,
    waist,
    chest,
    head: { ...head, yaw: headYaw.x, tilt: headTilt.x, pitch: headPitch.x },
    earL,
    earR,
    earTwist,
    earLAngles: earLAngles.map((a) => a.x),
    earRAngles: earRAngles.map((a) => a.x),
    tail,
    tailAngles: tailAngles.map((a) => a.x),
    feet,
    limbStretch: {
      hindL: Math.max(0.5, stretchS.hindL.x),
      hindR: Math.max(0.5, stretchS.hindR.x),
      frontL: Math.max(0.5, stretchS.frontL.x),
      frontR: Math.max(0.5, stretchS.frontR.x),
    },
    spineStretch,
    lookAt: curIntent.lookAt || [head.x + facing * 200, head.y - 100],
    eyeSquint: curIntent.eyeSquint ?? 0,
    mouthOpen: curIntent.mouthOpen ?? 0,
    groundY: curIntent.groundY,
  };
}

// ---------------------------------------------------------------------------
// 5. Pure Geometry Path Tracers (No Colour, No Lighting)
// ---------------------------------------------------------------------------

export function traceSmoothSpineBodyPath(ctx, simState, girthK = 1) {
  const { pelvis, waist, chest, scale, spineStretch, feet, facing = -1, projected } = simState;
  const g = (simState.build?.girth ?? 1) * girthK;
  const volScale = 1 / Math.pow(spineStretch, 0.56);

  // Detect upright sitting posture (chest significantly higher than pelvis, e.g. sitIntent / back view sitting)
  const sitK = projected ? 0 : clamp((-(chest.y - pelvis.y) - 24 * scale) / (26 * scale), 0, 1);

  // Dorsal (back) vs Ventral (belly/under-butt) radii:
  // Smoothly taper from narrower shoulders (`rChestBack`) to a plump rounded rump (`rPelvisBack`)
  // so the back line is sleek and continuous — never forming a mid-back hump ("炸毛弓背").
  const rPelvisBack = (projected ? 38 : 42) * scale * g * Math.pow(volScale, 0.85);
  const rPelvisBelly = (projected ? 38 : 32) * scale * g * Math.pow(volScale, 0.85);
  const rWaistBack = (projected ? 36 : lerp(38, 41, sitK)) * scale * g * volScale;
  const rWaistBelly = (projected ? 36 : 35) * scale * g * volScale;
  const rChestBack = (projected ? 33 : lerp(34, 38, sitK)) * scale * g * Math.pow(volScale, 0.90);
  const rChestBelly = (projected ? 33 : 36) * scale * g * Math.pow(volScale, 0.90);

  // Haunch-to-Leg Linkage ("臀腿联动"):
  // Applied strictly to the ventral (under-butt) contour so the round rump drives the vertical-strip hind leg
  // without ever pulling or denting the dorsal back line.
  let haunchShiftX = 0;
  let haunchShiftY = 0;
  if (!projected && feet?.hindL && feet?.hindR) {
    const hindMidX = feet.hindL.x * 0.70 + feet.hindR.x * 0.30;
    const hindMidY = feet.hindL.y * 0.70 + feet.hindR.y * 0.30;
    const neutralHindX = pelvis.x - facing * 8 * scale;
    const neutralHindY = pelvis.y + 42 * scale * (simState.build?.legLen ?? 1);
    haunchShiftX = clamp(hindMidX - neutralHindX, -32 * scale, 32 * scale) * 0.38;
    haunchShiftY = clamp(hindMidY - neutralHindY, -16 * scale, 20 * scale) * 0.22;
  }

  const N = 16;
  const backPts = [];
  const bellyPts = [];
  let ux0 = -1;
  let uy0 = 0;
  let uxN = -1;
  let uyN = 0;

  const chordDx = chest.x - pelvis.x;
  const chordDy = chest.y - pelvis.y;
  const chordLen = Math.max(1e-3, Math.hypot(chordDx, chordDy));
  const cUx = chordDx / chordLen;
  const cUy = chordDy / chordLen;

  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const inv = 1 - u;
    const x = inv * inv * pelvis.x + 2 * inv * u * waist.x + u * u * chest.x;
    const y = inv * inv * pelvis.y + 2 * inv * u * waist.y + u * u * chest.y;
    let dx = 2 * inv * (waist.x - pelvis.x) + 2 * u * (chest.x - waist.x);
    let dy = 2 * inv * (waist.y - pelvis.y) + 2 * u * (chest.y - waist.y);
    const tLen = Math.max(1e-3, Math.hypot(dx, dy));
    // Blend local Bezier tangent with spine chord so arched spines never form a cusp on the offset curve
    dx = lerp(cUx, dx / tLen, 0.45);
    dy = lerp(cUy, dy / tLen, 0.45);
    const len = Math.max(1e-3, Math.hypot(dx, dy));
    dx /= len;
    dy /= len;
    if (i === 0) {
      ux0 = dx;
      uy0 = dy;
    }
    if (i === N) {
      uxN = dx;
      uyN = dy;
    }
    // True dorsal normal (points toward the creature's back regardless of facing = -1 or +1)
    const dorsalX = dy * facing;
    const dorsalY = -dx * facing;
    const rBack = inv * inv * rPelvisBack + 2 * inv * u * rWaistBack + u * u * rChestBack;
    const rBelly = inv * inv * rPelvisBelly + 2 * inv * u * rWaistBelly + u * u * rChestBelly;
    const haunchW = Math.pow(clamp(1 - u / 0.46, 0, 1), 1.5);
    backPts.push([
      x + dorsalX * rBack,
      y + dorsalY * rBack,
    ]);
    // Ventral normal blends toward straight-down (0, 1) at the pelvis when sitting so the bottom of the rump rests flat
    const vGroundW = sitK * Math.pow(clamp(1 - u / 0.65, 0, 1), 1.3);
    const ventralX = lerp(-dorsalX, -facing * 0.10, vGroundW);
    const ventralY = lerp(-dorsalY, 1.0, vGroundW);
    bellyPts.push([
      x + ventralX * rBelly + haunchShiftX * haunchW,
      y + ventralY * rBelly + haunchShiftY * haunchW,
    ]);
  }

  const m1x = (backPts[N][0] + bellyPts[N][0]) * 0.5;
  const m1y = (backPts[N][1] + bellyPts[N][1]) * 0.5;
  const rCap1 = (rChestBack + rChestBelly) * 0.5;

  const m0x = (backPts[0][0] + bellyPts[0][0]) * 0.5;
  const m0y = (backPts[0][1] + bellyPts[0][1]) * 0.5;
  const rCap0 = (rPelvisBack + rPelvisBelly) * 0.54;
  // Rear cap direction: horizontal (-facing, 0) when sitting so the rump cap bulges backward rather than into the ground
  const capUx0 = lerp(ux0, facing, sitK * 0.92);
  const capUy0 = lerp(uy0, 0, sitK * 0.92);
  const rearApexX = lerp(m0x - ux0 * rCap0 * 1.08, pelvis.x - facing * rPelvisBack * 1.02, sitK) + haunchShiftX * 0.18;
  const rearApexY = lerp(m0y - uy0 * rCap0 * 1.08, pelvis.y + 3 * scale * g, sitK) + haunchShiftY * 0.15;
  const rearCtrlBellyX = lerp(bellyPts[0][0] - ux0 * rCap0 * 0.85, pelvis.x - facing * rPelvisBack * 0.86, sitK) + haunchShiftX * 0.15;
  const rearCtrlBellyY = lerp(bellyPts[0][1] - uy0 * rCap0 * 0.85, bellyPts[0][1], sitK) + haunchShiftY * 0.12;
  const rearCtrlBackX = lerp(backPts[0][0] - ux0 * rCap0 * 0.85, pelvis.x - facing * rPelvisBack * 1.04, sitK);
  const rearCtrlBackY = lerp(backPts[0][1] - uy0 * rCap0 * 0.85, (backPts[0][1] + rearApexY) * 0.5, sitK);

  ctx.beginPath();
  ctx.moveTo(backPts[0][0], backPts[0][1]);
  for (let i = 1; i <= N; i++) {
    const prev = backPts[i - 1];
    const cur = backPts[i];
    ctx.quadraticCurveTo(prev[0], prev[1], (prev[0] + cur[0]) * 0.5, (prev[1] + cur[1]) * 0.5);
  }
  ctx.lineTo(backPts[N][0], backPts[N][1]);
  ctx.quadraticCurveTo(
    backPts[N][0] + uxN * rCap1 * 0.82,
    backPts[N][1] + uyN * rCap1 * 0.82,
    m1x + uxN * rCap1 * 1.04,
    m1y + uyN * rCap1 * 1.04
  );
  ctx.quadraticCurveTo(bellyPts[N][0] + uxN * rCap1 * 0.82, bellyPts[N][1] + uyN * rCap1 * 0.82, bellyPts[N][0], bellyPts[N][1]);
  for (let i = N - 1; i >= 0; i--) {
    const prev = bellyPts[i + 1];
    const cur = bellyPts[i];
    ctx.quadraticCurveTo(prev[0], prev[1], (prev[0] + cur[0]) * 0.5, (prev[1] + cur[1]) * 0.5);
  }
  ctx.lineTo(bellyPts[0][0], bellyPts[0][1]);
  ctx.quadraticCurveTo(rearCtrlBellyX, rearCtrlBellyY, rearApexX, rearApexY);
  ctx.quadraticCurveTo(rearCtrlBackX, rearCtrlBackY, backPts[0][0], backPts[0][1]);
  ctx.closePath();
}

export function traceNeckBridgePath(ctx, simState) {
  const { pelvis, chest, head, scale, R, spineStretch, facing = -1, projected } = simState;
  const g = simState.build?.girth ?? 1;
  const volScale = 1 / Math.pow(spineStretch, 0.48);
  const sitK = projected ? 0 : clamp((-(chest.y - pelvis.y) - 24 * scale) / (26 * scale), 0, 1);
  const rBaseFront = (projected ? 28 : 26) * scale * g * Math.pow(volScale, 0.85);
  const rBaseBack = (projected ? 28 : lerp(31, 37, sitK)) * scale * g * Math.pow(volScale, 0.85);
  const rTopFront = R * (projected ? 0.52 : 0.44);
  const rTopBack = R * (projected ? 0.52 : lerp(0.62, 0.72, sitK));

  const hx = head.x;
  const hy = head.y + 12 * scale;
  const dx = hx - chest.x;
  const dy = hy - chest.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / dist;
  const uy = dy / dist;
  // Dorsal normal points toward the back of the neck; ventral points toward the throat
  const dorsalX = (dy * facing) / dist;
  const dorsalY = (-dx * facing) / dist;
  const midX = (chest.x + hx) * 0.5;
  const midY = (chest.y + hy) * 0.5;
  const rMidFront = (rBaseFront + rTopFront) * (projected ? 0.46 : 0.42);
  const rMidBack = (rBaseBack + rTopBack) * (projected ? 0.46 : lerp(0.45, 0.50, sitK));

  ctx.beginPath();
  ctx.moveTo(chest.x + dorsalX * rBaseBack, chest.y + dorsalY * rBaseBack);
  ctx.quadraticCurveTo(midX + dorsalX * rMidBack, midY + dorsalY * rMidBack, hx + dorsalX * rTopBack, hy + dorsalY * rTopBack);
  ctx.bezierCurveTo(
    hx + ux * rTopBack + dorsalX * rTopBack,
    hy + uy * rTopBack + dorsalY * rTopBack,
    hx + ux * rTopFront - dorsalX * rTopFront,
    hy + uy * rTopFront - dorsalY * rTopFront,
    hx - dorsalX * rTopFront,
    hy - dorsalY * rTopFront
  );
  ctx.quadraticCurveTo(midX - dorsalX * rMidFront, midY - dorsalY * rMidFront, chest.x - dorsalX * rBaseFront, chest.y - dorsalY * rBaseFront);
  ctx.bezierCurveTo(
    chest.x - ux * rBaseFront - dorsalX * rBaseFront,
    chest.y - uy * rBaseFront - dorsalY * rBaseFront,
    chest.x - ux * rBaseBack + dorsalX * rBaseBack,
    chest.y - uy * rBaseBack + dorsalY * rBaseBack,
    chest.x + dorsalX * rBaseBack,
    chest.y + dorsalY * rBaseBack
  );
  ctx.closePath();
}

export function projectCritterView(simState) {
  const view = simState.view;
  if (view !== 'front' && view !== 'back') return simState;
  const { scale: s, pelvis, chest, waist, head, feet } = simState;
  const g = simState.build?.girth ?? 1;
  const cx = (pelvis.x + chest.x) * 0.5;
  const k = 0.26;
  const px = (x) => cx + (x - cx) * k;
  const nPelvis = { ...pelvis, x: px(pelvis.x), y: pelvis.y + (view === 'front' ? 4 * s : 0) };
  const nChest = { ...chest, x: px(chest.x), y: chest.y };
  const nWaist = { ...waist, x: px(waist.x), y: waist.y };
  const nHead = { ...head, x: nChest.x + (head.x - chest.x) * 0.2, y: head.y };
  const dhx = nHead.x - head.x;
  const dhy = nHead.y - head.y;
  const shift = (p) => [p[0] + dhx, p[1] + dhy];
  const root = simState.tail[0];
  const nRoot = [cx, nPelvis.y + (view === 'back' ? 36 : 16) * s * g];
  const tk = view === 'front' ? 0.52 : 0.78;
  const tyk = view === 'back' ? 0.22 : 0.48;
  const nTail = simState.tail.map((p) => [nRoot[0] + (p[0] - root[0]) * tk, nRoot[1] + (p[1] - root[1]) * tyk]);
  const spread = (foot, side, w, ref) => ({ ...foot, x: cx + side * w * s * g + (foot.x - ref) * 0.12, y: foot.y });
  const nFeet = {
    hindL: spread(feet.hindL, -1, 26, pelvis.x),
    hindR: spread(feet.hindR, 1, 26, pelvis.x),
    frontL: spread(feet.frontL, -1, 15, chest.x),
    frontR: spread(feet.frontR, 1, 15, chest.x),
  };
  return {
    ...simState,
    projected: true,
    bodyCx: cx,
    pelvis: nPelvis,
    chest: nChest,
    waist: nWaist,
    head: nHead,
    earL: simState.earL.map(shift),
    earR: simState.earR.map(shift),
    tail: nTail,
    feet: nFeet,
    spineStretch: simState.spineStretch,
  };
}

export function limbSocketsFor(sim) {
  const { scale: s, pelvis, chest, facing = -1 } = sim;
  const g = sim.build?.girth ?? 1;
  if (sim.projected) {
    const cx = sim.bodyCx;
    return {
      hindL: [cx - 22 * s * g, pelvis.y + 8 * s * g],
      hindR: [cx + 22 * s * g, pelvis.y + 8 * s * g],
      frontL: [cx - 14 * s * g, chest.y + 14 * s * g],
      frontR: [cx + 14 * s * g, chest.y + 14 * s * g],
    };
  }
  return {
    hindL: [pelvis.x - facing * 6 * s, pelvis.y + 12 * s * g],
    hindR: [pelvis.x - facing * 16 * s, pelvis.y + 10 * s * g],
    frontL: [chest.x + facing * 20 * s, chest.y + 10 * s * g],
    frontR: [chest.x + facing * 10 * s, chest.y + 12 * s * g],
  };
}

export function tracePlushLimbPath(ctx, hip, foot, opts = {}) {
  const [hx, hy] = hip;
  const [fx, fy] = foot;
  const rHip = opts.rHip ?? 24;
  const rFoot = opts.rFoot ?? 16;
  const maxLen = opts.maxLen ?? 92;
  const bendDir = opts.bendDir ?? 1;
  const bendScale = opts.bendScale ?? 0.14;

  const dx = fx - hx;
  const dy = fy - hy;
  const dist = Math.max(4, Math.hypot(dx, dy));
  const ux = dx / dist;
  const uy = dy / dist;
  const nx = -uy * bendDir;
  const ny = ux * bendDir;
  const ratio = clamp(dist / maxLen, 0.25, 1.0);
  const vertSupport = clamp((uy - 0.15) / 0.55, 0.12, 1.0);
  const kneeBend = Math.sqrt(Math.max(0, 1 - ratio * ratio)) * maxLen * bendScale * vertSupport;
  const kx = (hx + fx) * 0.5 + nx * kneeBend;
  const ky = (hy + fy) * 0.5 + ny * kneeBend;
  const pnx = -uy;
  const pny = ux;

  ctx.beginPath();
  ctx.moveTo(hx - pnx * rHip, hy - pny * rHip);
  ctx.quadraticCurveTo(kx - pnx * ((rHip + rFoot) * 0.54), ky - pny * ((rHip + rFoot) * 0.54), fx - ux * rFoot * 0.2 - pnx * rFoot, fy - uy * rFoot * 0.2 - pny * rFoot);
  ctx.bezierCurveTo(
    fx + ux * rFoot * 1.25 - pnx * rFoot * 1.05,
    fy + uy * rFoot * 1.25 - pny * rFoot * 1.05,
    fx + ux * rFoot * 1.25 + pnx * rFoot * 1.05,
    fy + uy * rFoot * 1.25 + pny * rFoot * 1.05,
    fx - ux * rFoot * 0.2 + pnx * rFoot,
    fy - uy * rFoot * 0.2 + pny * rFoot
  );
  ctx.quadraticCurveTo(kx + pnx * ((rHip + rFoot) * 0.54), ky + pny * ((rHip + rFoot) * 0.54), hx + pnx * rHip, hy + pny * rHip);
  ctx.bezierCurveTo(hx - ux * rHip * 1.1 + pnx * rHip, hy - uy * rHip * 1.1 + pny * rHip, hx - ux * rHip * 1.1 - pnx * rHip, hy - uy * rHip * 1.1 - pny * rHip, hx - pnx * rHip, hy - pny * rHip);
  ctx.closePath();
}

export function headLocal(head, R) {
  const cos = Math.cos(head.tilt);
  const sin = Math.sin(head.tilt);
  return (lx, ly) => [head.x + (lx * cos - ly * sin) * R, head.y + (lx * sin + ly * cos) * R];
}

export function muzzleSpec(simState) {
  const m = simState.build?.muzzle ?? 0;
  const view = simState.view;
  if (view === 'back' || m < 0.04) return null;
  const f = simState.facing ?? -1;
  if (view === 'front') return { cx: 0, cy: 0.4, rx: 0.3 + 0.12 * m, ry: 0.22 + 0.08 * m };
  const out = view === 'side' ? 1 : 0.55;
  return { cx: f * (0.42 + 0.5 * m) * out, cy: 0.3 + 0.04 * m, rx: 0.3 + 0.3 * m, ry: 0.24 + 0.05 * m };
}

export function traceCritterHeadPath(ctx, head, R, simState) {
  const pt = headLocal(head, R);
  const yaw = head.yaw || 0;
  const tufts = simState.build?.cheekTufts !== false && simState.view !== 'back';
  const hw = simState.build?.headWidth ?? 1;
  const cWL = (tufts ? 1.16 : 1.02) * hw * (1 - yaw * 0.1);
  const cWR = (tufts ? 1.16 : 1.02) * hw * (1 + yaw * 0.1);

  ctx.beginPath();
  const pChin = pt(yaw * 0.06, 0.78);
  ctx.moveTo(pChin[0], pChin[1]);
  if (tufts) {
    const pTuftL1 = pt(-cWL * 1.08, 0.34);
    const pTuftL2 = pt(-cWL * 0.96, 0.12);
    const pTuftR2 = pt(cWR * 0.96, 0.12);
    const pTuftR1 = pt(cWR * 1.08, 0.34);
    ctx.bezierCurveTo(...pt(-0.62, 0.8), ...pt(-cWL * 1.02, 0.62), pTuftL1[0], pTuftL1[1]);
    ctx.quadraticCurveTo(...pt(-cWL * 1.14, 0.22), pTuftL2[0], pTuftL2[1]);
    ctx.bezierCurveTo(...pt(-cWL * 0.98, -0.08), ...pt(-0.94, -0.22), ...pt(-0.86, -0.38));
    ctx.bezierCurveTo(...pt(-0.68, -0.78), ...pt(-0.28, -0.86), ...pt(0, -0.86));
    ctx.bezierCurveTo(...pt(0.28, -0.86), ...pt(0.68, -0.78), ...pt(0.86, -0.38));
    ctx.bezierCurveTo(...pt(0.94, -0.22), ...pt(cWR * 0.98, -0.08), pTuftR2[0], pTuftR2[1]);
    ctx.quadraticCurveTo(...pt(cWR * 1.14, 0.22), pTuftR1[0], pTuftR1[1]);
    ctx.bezierCurveTo(...pt(cWR * 1.02, 0.62), ...pt(0.62, 0.8), pChin[0], pChin[1]);
  } else {
    ctx.bezierCurveTo(...pt(-0.7, 0.78), ...pt(-cWL, 0.4), ...pt(-cWL, 0));
    ctx.bezierCurveTo(...pt(-cWL, -0.55), ...pt(-0.5, -0.88), ...pt(0, -0.88));
    ctx.bezierCurveTo(...pt(0.5, -0.88), ...pt(cWR, -0.55), ...pt(cWR, 0));
    ctx.bezierCurveTo(...pt(cWR, 0.4), ...pt(0.7, 0.78), pChin[0], pChin[1]);
  }
  ctx.closePath();

  const mz = muzzleSpec(simState);
  if (mz) {
    const [mx, my] = pt(mz.cx, mz.cy);
    ctx.moveTo(mx + mz.rx * R, my);
    ctx.ellipse(mx, my, mz.rx * R, mz.ry * R, head.tilt, 0, Math.PI * 2);
    ctx.closePath();
  }

  const earT = CRITTER_EAR_TYPES[simState.build?.earType];
  if (earT?.contour) {
    const tw = simState.earTwist || [0, 0];
    traceContourEar(ctx, pt, contourEarGeometry(earT, simState.build, -1, tw[0]), -1);
    traceContourEar(ctx, pt, contourEarGeometry(earT, simState.build, 1, tw[1]), 1);
  }

  const mats = resolveCritterMaterials(simState.build);
  if (simState.build?.horn === 'buds' && mats.horn === mats.body) traceHornBuds(ctx, head, R);
}

export function traceHornBuds(ctx, head, R) {
  const pt = headLocal(head, R);
  for (const sgn of [-1, 1]) {
    const [ax0, ay0] = pt(sgn * 0.26, -0.78);
    const [ax1, ay1] = pt(sgn * 0.42, -1.26);
    const [ax2, ay2] = pt(sgn * 0.22, -1.12);
    ctx.moveTo(ax0 - 6, ay0);
    ctx.quadraticCurveTo(ax1, ay1, ax1 + sgn * 8, ay1 + 6);
    ctx.quadraticCurveTo(ax2, ay2, ax0 + 6, ay0);
    ctx.closePath();
  }
}

export function fillAntlers(ctx, head, R, simState) {
  const pt = headLocal(head, R);
  const f = simState.view === 'side' ? (simState.facing ?? -1) * 0.18 : 0;
  const branches = [];
  for (const sgn of [-1, 1]) {
    branches.push([pt(sgn * 0.3 + f, -0.74), pt(sgn * 0.52 + f, -1.25), pt(sgn * 0.46 + f, -1.75), pt(sgn * 0.62 + f, -2.05)]);
    branches.push([pt(sgn * 0.5 + f, -1.22), pt(sgn * 0.82 + f, -1.4), pt(sgn * 1.02 + f, -1.66)]);
    branches.push([pt(sgn * 0.47 + f, -1.62), pt(sgn * 0.2 + f, -1.86), pt(sgn * 0.12 + f, -2.06)]);
  }
  for (const [i, b] of branches.entries()) {
    const w0 = (i % 3 === 0 ? 0.075 : 0.05) * R;
    traceSmoothChainRibbon(ctx, b, (u) => w0 * (1 - 0.55 * u), 10);
    ctx.fill();
  }
}

export function fillHorns(ctx, head, R, simState) {
  const horn = simState.build?.horn;
  if (horn === 'antlers') fillAntlers(ctx, head, R, simState);
  else if (horn === 'buds') {
    ctx.beginPath();
    traceHornBuds(ctx, head, R);
    ctx.fill();
  }
}

export function sampleSmoothChain(pts, u) {
  const n = pts.length - 1;
  const s = clamp(u, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(s));
  const t = s - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(n, i + 2)];
  const t2 = t * t;
  const t3 = t2 * t;
  const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
  const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
  let tx = 0.5 * (-p0[0] + p2[0] + 2 * (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t + 3 * (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t2);
  let ty = 0.5 * (-p0[1] + p2[1] + 2 * (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t + 3 * (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t2);
  const len = Math.max(1e-4, Math.hypot(tx, ty));
  tx /= len;
  ty /= len;
  return { x, y, tx, ty, nx: -ty, ny: tx };
}

export function traceSmoothChainRibbon(ctx, pts, widthFn, steps = 16) {
  const left = [];
  const right = [];
  let startSample = null;
  let endSample = null;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const sp = sampleSmoothChain(pts, u);
    const w = widthFn(u);
    if (i === 0) startSample = { ...sp, w };
    if (i === steps) endSample = { ...sp, w };
    left.push([sp.x + sp.nx * w, sp.y + sp.ny * w]);
    right.push([sp.x - sp.nx * w, sp.y - sp.ny * w]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i <= steps; i++) {
    const p = left[i - 1];
    const c = left[i];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + c[0]) * 0.5, (p[1] + c[1]) * 0.5);
  }
  ctx.lineTo(left[steps][0], left[steps][1]);
  const tw = endSample.w;
  ctx.bezierCurveTo(
    left[steps][0] + endSample.tx * tw * 1.25,
    left[steps][1] + endSample.ty * tw * 1.25,
    right[steps][0] + endSample.tx * tw * 1.25,
    right[steps][1] + endSample.ty * tw * 1.25,
    right[steps][0],
    right[steps][1]
  );
  for (let i = steps - 1; i >= 0; i--) {
    const p = right[i + 1];
    const c = right[i];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + c[0]) * 0.5, (p[1] + c[1]) * 0.5);
  }
  ctx.lineTo(right[0][0], right[0][1]);
  const rw = startSample.w;
  ctx.bezierCurveTo(
    right[0][0] - startSample.tx * rw * 1.1,
    right[0][1] - startSample.ty * rw * 1.1,
    left[0][0] - startSample.tx * rw * 1.1,
    left[0][1] - startSample.ty * rw * 1.1,
    left[0][0],
    left[0][1]
  );
  ctx.closePath();
}

export function traceEar(ctx, simState, earPts, widthMul = 1) {
  const type = CRITTER_EAR_TYPES[simState.earType] ?? CRITTER_EAR_TYPES.long;
  if (!type || type.contour) return false;
  const w = simState.scale * (simState.build?.earWidth ?? 1) * widthMul;
  traceSmoothChainRibbon(ctx, earPts, (u) => type.width(u) * w, 16);
  return true;
}

export function traceTail(ctx, simState, tailPts) {
  const type = CRITTER_TAIL_TYPES[simState.tailType] ?? CRITTER_TAIL_TYPES.plume;
  if (!type) return false;
  const w = simState.scale * (simState.build?.tailWidth ?? 1);
  traceSmoothChainRibbon(ctx, tailPts, (u) => type.width(u) * w, 18);
  return true;
}

// ---------------------------------------------------------------------------
// 6. Hero Motion Vocabulary (`HERO_MOVES`, `createPlushCritter`)
// ---------------------------------------------------------------------------

const _win = (t, t0, t1, ramp = 0.18) => smootherstep(t0 - 1e-6, t0 + ramp, t) * (1 - smootherstep(t1 - ramp, t1 + 1e-6, t));
const _ears = (it, f, dL, dR) => {
  it.earAngleL += -f * dL;
  it.earAngleR += -f * dR;
};

export const HERO_MOVES = {
  /** Breathing, head sway, slow tail sway and an occasional ear flick. `{ amp }` */
  idle(it, t, m, k) {
    const a = m.amp ?? 1;
    it.chestOffsetY += Math.sin(t * 2.1) * 1.8 * k.s * a;
    it.headOffsetY += Math.sin(t * 2.1 - 0.5) * 1.2 * k.s * a;
    it.headTilt += Math.sin(t * 0.9 + 0.7) * 0.05 * a;
    it.tailWagAmp = Math.max(it.tailWagAmp ?? 0, 0.1 * a);
    const flick = Math.max(0, Math.sin(t * 2.35 + 1.1)) ** 24;
    it.earAngleR += flick * 0.35 * a;
  },

  /**
   * Travel from `fromX` to `toX` over [t0, t1] (moves the base). Stride is driven by distance.
   * `gait`: 'trot' | 'walk' | 'auto'. `{ t0, t1, fromX, toX, stride, gait }`
   */
  trot(it, t, m, k) {
    const fadeIn = m.t0 <= 0.01 ? 1 : smootherstep(m.t0 - 1e-6, m.t0 + 0.12, t);
    const fadeOut = 1 - smootherstep(m.t1 - 0.02, m.t1 + 0.24, t);
    const w = fadeIn * fadeOut;
    if (w <= 0) return;
    const { s, f } = k;
    const dist = Math.abs((m.toX ?? m._fromX ?? 0) - (m.fromX ?? m._fromX ?? 0));
    const speed = dist / Math.max(0.1, m.t1 - m.t0);
    const gait = m.gait && m.gait !== 'auto' ? m.gait : speed < 260 ? 'walk' : 'trot';
    const tr = gait === 'trot' ? 1 : 0;
    const st = (m.stride ?? (tr ? 24 : 16)) * s;
    const u = clamp((t - m.t0) / (m.t1 - m.t0), 0, 1);
    const ph = (Math.PI * dist * smootherstep(0, 1, u)) / (2 * st) + 1.65;
    const bounceP = Math.abs(Math.sin(ph)) * lerp(4, 12, tr) * s * w;
    const bounceC = Math.abs(Math.sin(ph - 0.55)) * lerp(4, 13, tr) * s * w;
    it.pelvisY = lerp(it.pelvisY, k.G - lerp(44, 46, tr) * s * k.L - bounceP, w);
    it.chestOffsetX = lerp(it.chestOffsetX, f * lerp(64, 72, tr) * s * k.bl, w);
    it.chestOffsetY = lerp(it.chestOffsetY, lerp(-8, -6, tr) * s * k.L - bounceC + bounceP, w);
    it.headOffsetX = lerp(it.headOffsetX, f * lerp(22, 26, tr) * s, w);
    it.headOffsetY = lerp(it.headOffsetY, -42 * s, w);
    it.spineArch = lerp(it.spineArch, -4 * s, w);
    it.headYaw = lerp(it.headYaw ?? 0, f * 0.28, w);
    it.headTilt += (Math.sin(ph - 0.8) * lerp(0.03, 0.06, tr) - 0.05) * w;
    _ears(it, f, 0.27 * w * tr, 0.14 * w * tr);
    it.tailAngle += -f * (0.1 + Math.sin(ph * 0.5) * 0.18) * w;
    it.tailWagAmp = Math.max(it.tailWagAmp ?? 0, 0.12 * w);
    const s1 = Math.sin(ph);
    const c1 = Math.cos(ph);
    const lift = lerp(0.45, 0.82, tr);
    const px = it.pelvisX;
    const cx = px + it.chestOffsetX;
    const G = k.G + 3 * s;
    const footW = smootherstep(m.t0 - 1e-6, m.t0 + (m.t0 <= 0.01 ? 1e-4 : 0.1), t) * (1 - smootherstep(m.t1 - 0.04, m.t1 + 0.02, t));
    const mix = (key, x, y) => {
      it.feet[key] = [lerp(it.feet[key][0], x, footW), lerp(it.feet[key][1], y, footW)];
    };
    const hindCenterL = px - f * lerp(8, 14, tr) * s * k.bl;
    const hindCenterR = px - f * lerp(18, 24, tr) * s * k.bl;
    const frontCenterL = cx + f * lerp(22, 28, tr) * s * k.bl;
    const frontCenterR = cx + f * lerp(12, 18, tr) * s * k.bl;
    mix('hindL', hindCenterL - f * c1 * st, G - Math.max(0, s1) * st * lift);
    mix('hindR', hindCenterR + f * c1 * st, G - Math.max(0, -s1) * st * 0.92 * lift - 2 * s);
    mix('frontL', frontCenterL + f * c1 * st, G - Math.max(0, -s1) * st * 1.05 * lift);
    mix('frontR', frontCenterR - f * c1 * st, G - Math.max(0, s1) * st * lift - 2 * s);
  },

  /** Sudden stop: torso pitches past the hips, tail sweeps up to balance, front paws plant ahead. `{ t0, dur }` */
  brake(it, t, m, k) {
    const dur = m.dur ?? 0.36;
    if (t < m.t0 || t > m.t0 + dur) return;
    const bu = clamp((t - m.t0) / dur, 0, 1);
    const p = Math.sin(clamp((t - m.t0) / (dur * 0.67), 0, 1) * Math.PI);
    const { s, f } = k;
    it.pelvisY = lerp(it.pelvisY, k.G - 42 * s * k.L, p);
    it.chestOffsetX = lerp(it.chestOffsetX, f * 58 * s * k.bl, p);
    it.chestOffsetY = lerp(it.chestOffsetY, -10 * s * k.L, p);
    it.headOffsetX = lerp(it.headOffsetX, f * 22 * s, p);
    it.headOffsetY = lerp(it.headOffsetY, -40 * s, p);
    it.spineArch = lerp(it.spineArch ?? -3 * s, -5 * s, p);
    it.chestForceX = (it.chestForceX || 0) + f * 180 * p;
    it.chestForceY = (it.chestForceY || 0) + 65 * p;
    it.headForceY = (it.headForceY || 0) + 55 * p;
    it.headTilt += f * 0.12 * p;
    it.headPitch += 0.12 * p;
    _ears(it, f, -0.53 * p, -0.8 * p);
    it.tailAngle += f * 0.64 * p;
    const px = it.pelvisX;
    it.feet.hindL = [px - f * 6 * s * k.bl, k.G + 3 * s];
    it.feet.hindR = [px - f * 18 * s * k.bl, k.G - 2 * s];
    it.feet.frontL = [px + f * lerp(70, 56, bu) * s * k.bl, k.G + 4 * s];
    it.feet.frontR = [px + f * lerp(54, 42, bu) * s * k.bl, k.G - 1 * s];
  },

  /** Deep anticipation crouch: hips and chest drop, spine bows, ears fold flat back, tail coils low. `{ t0, t1, depth, wiggle }` */
  crouch(it, t, m, k) {
    const cu = smootherstep(m.t0, m.t0 + Math.max(0.1, (m.t1 - m.t0) * 0.78), t) * (1 - smootherstep(m.t1 - 0.01, m.t1 + (m.release ?? 0.01), t));
    if (cu <= 0) return;
    const { s, f } = k;
    const d = m.depth ?? 1;
    const basePx = it.pelvisX;
    it.pelvisX += f * -16 * s * cu;
    it.pelvisY = lerp(it.pelvisY, k.G - 36 * s * k.L * d, cu);
    it.chestOffsetX = lerp(it.chestOffsetX, f * 60 * s * k.bl, cu);
    it.chestOffsetY = lerp(it.chestOffsetY, -4 * s * k.L * d, cu);
    it.headOffsetX = lerp(it.headOffsetX, f * 22 * s, cu);
    it.headOffsetY = lerp(it.headOffsetY, -38 * s, cu);
    it.spineArch = lerp(it.spineArch ?? -3 * s, -6 * s, cu);
    it.headYaw = lerp(it.headYaw ?? 0, f * 0.34, cu);
    it.headTilt += f * 0.13 * cu;
    it.headPitch = lerp(it.headPitch ?? 0, -0.18, cu);
    _ears(it, f, 1.27 * cu, 0.9 * cu);
    it.tailAngle += -f * 0.29 * cu + Math.sin(t * 16) * 0.06 * cu;
    if (m.wiggle !== false) it.pelvisX += Math.sin(t * 24) * 2.5 * s * smootherstep(0.65, 1, cu);
    it.feet.hindL = [lerp(it.feet.hindL[0], basePx - f * 8 * s * k.bl, cu), k.G + 2 * s];
    it.feet.hindR = [lerp(it.feet.hindR[0], basePx - f * 20 * s * k.bl, cu), k.G - 2 * s];
    it.feet.frontL = [lerp(it.feet.frontL[0], basePx + f * 68 * s * k.bl, cu), k.G + 3 * s];
    it.feet.frontR = [lerp(it.feet.frontR[0], basePx + f * 50 * s * k.bl, cu), k.G - 1 * s];
  },

  /**
   * Leap to `toX` / `toGroundY` over [t0, t1] (moves the base): chest leads pelvis, spine extends parabolically.
   * `{ t0, t1, toX, toGroundY, height }`
   */
  leap(it, t, m, k) {
    if (t < m.t0 || t > m.t1) return;
    const { s, f } = k;
    const dur = m.t1 - m.t0;
    const uC = clamp((t - m.t0) / dur, 0, 1);
    const uP = clamp((t - (m.t0 + 0.03)) / (dur - 0.03), 0, 1);
    const H = m.height ?? 195;
    const fromX = m._fromX ?? it.pelvisX;
    const toX = m.toX ?? fromX;
    const G0 = m._fromG ?? k.G;
    const G1 = m.toGroundY ?? G0;
    const startPx = fromX - f * 14 * s;
    const endPx = lerp(toX - f * 24 * s, toX, smootherstep(0.76, 1.0, uP));
    const px = lerp(startPx, endPx, uP);
    const py = lerp(G0, G1, uP) - 28 * s * k.L - 4 * H * uP * (1 - uP);
    const arc = Math.sin(uC * Math.PI);
    it.pelvisX = px;
    it.pelvisY = py;
    const stretchEnv = smootherstep(0.0, 0.18, uC) * (1 - 0.25 * smootherstep(0.82, 1.0, uC));
    it.chestOffsetX = f * lerp(64, 102, stretchEnv) * s * k.bl;
    const pitchY = lerp(-34, 4, smootherstep(0.08, 0.78, uC));
    it.chestOffsetY = lerp(pitchY, -22, smootherstep(0.82, 1.0, uC)) * s * k.L;
    it.spineArch = -18 * arc * s;
    it.headOffsetX = f * lerp(28, 34, arc) * s;
    it.headOffsetY = lerp(-32, -24, smootherstep(0.12, 0.70, uC)) * s;
    it.headYaw = f * 0.24;
    it.headTilt = -f * lerp(0.14, -0.14, uC);
    _ears(it, f, lerp(1.23, 1.47, uC), lerp(0.84, 1.02, uC));
    it.tailAngle += -f * lerp(-0.14, -0.32, uC);
    const cx = px + it.chestOffsetX;
    const cy = py + it.chestOffsetY;
    const reachUp = Math.sin(uC * Math.PI);
    it.feet.frontL = [cx + f * (68 + 20 * reachUp) * s, cy + lerp(44, 48, uC) * s - reachUp * 4 * s];
    it.feet.frontR = [cx + f * (52 + 16 * reachUp) * s, cy + lerp(52, 56, uC) * s - reachUp * 2 * s];
    const kickBlend = smootherstep(0.02, 0.12, uP);
    it.feet.hindL = [lerp(fromX - f * 18 * s, px - f * 88 * s, kickBlend), lerp(G0 + 2 * s, py + lerp(58, 46, uP) * s, kickBlend)];
    it.feet.hindR = [lerp(fromX - f * 32 * s, px - f * 102 * s, kickBlend), lerp(G0 - 2 * s, py + lerp(46, 34, uP) * s, kickBlend)];
    it.limbStretch = { frontL: 1.26, frontR: 1.20, hindL: 1.30, hindR: 1.30 };
  },

  /**
   * Landing cushion driven by impact FORCES, head bob, asymmetric ear whip, tail rebound. `{ t0, dur }`
   */
  land(it, t, m, k) {
    const dur = m.dur ?? 0.45;
    if (t < m.t0 || t > m.t0 + dur) return;
    const p = Math.sin(clamp((t - m.t0) / 0.25, 0, 1) * Math.PI);
    const { s, f } = k;
    it.pelvisY = lerp(it.pelvisY, k.G - 38 * s * k.L, p);
    it.chestOffsetX = lerp(it.chestOffsetX, f * 60 * s * k.bl, p);
    it.chestOffsetY = lerp(it.chestOffsetY, -6 * s * k.L, p);
    it.headOffsetX = lerp(it.headOffsetX, f * 20 * s, p);
    it.headOffsetY = lerp(it.headOffsetY, -38 * s, p);
    it.spineArch = lerp(it.spineArch ?? -3 * s, -6 * s, p);
    it.pelvisForceY = (it.pelvisForceY || 0) + 280 * p;
    it.chestForceY = (it.chestForceY || 0) + 320 * p;
    it.headForceY = (it.headForceY || 0) + 240 * p;
    it.headTilt += f * 0.16 * p;
    it.headPitch += 0.16 * p;
    it.eyeSquint = Math.max(it.eyeSquint ?? 0, 0.55 * p);
    _ears(it, f, -0.5 * p, 0.62 * p);
    it.tailAngle += -f * 0.6 * p;
    const px = it.pelvisX;
    it.feet.hindL = [lerp(it.feet.hindL[0], px - f * 6 * s * k.bl, p), k.G + 3 * s];
    it.feet.hindR = [lerp(it.feet.hindR[0], px - f * 18 * s * k.bl, p), k.G - 2 * s];
    it.feet.frontL = [lerp(it.feet.frontL[0], px + f * 62 * s * k.bl, p), k.G + 4 * s];
    it.feet.frontR = [lerp(it.feet.frontR[0], px + f * 46 * s * k.bl, p), k.G - 1 * s];
  },

  /** Lift one paw to `target` (boop, reach, wave), leaning in and looking at it. `{ t0, t1, paw, target, hold, stretch }` */
  reach(it, t, m, k) {
    const span = m.t1 - m.t0;
    const a = smootherstep(m.t0, m.t0 + Math.min(0.4, span * 0.45), t) * (m.hold ? 1 : 1 - smootherstep(m.t1 - Math.min(0.3, span * 0.3), m.t1, t));
    if (a <= 0) return;
    const { s, f } = k;
    const paw = m.paw || 'frontL';
    const [rawTx, rawTy] = m.target;
    const cx = it.pelvisX + it.chestOffsetX;
    const cy = it.pelvisY + it.chestOffsetY;
    const d = Math.max(1, Math.hypot(rawTx - cx, rawTy - cy));
    it.chestOffsetX += ((rawTx - cx) / d) * a * 10 * s;
    it.chestOffsetY += ((rawTy - cy) / d) * a * 6 * s;
    const hx = it.pelvisX + it.chestOffsetX + it.headOffsetX;
    const hy = it.pelvisY + it.chestOffsetY + it.headOffsetY;
    const headR = (k.R || 56 * s) * (k.hw || 1);
    let tx = rawTx;
    let ty = rawTy;
    if (Math.abs(ty - hy) < headR * 1.08 && f * (tx - hx) < headR * 1.38) {
      tx = hx + f * headR * 1.38;
    }
    it.feet[paw] = [lerp(it.feet[paw][0], tx, a), lerp(it.feet[paw][1], ty, a)];
    const reqStretch = Math.max(m.stretch ?? 1.28, 1.28);
    it.limbStretch = { ...(typeof it.limbStretch === 'object' ? it.limbStretch : {}), [paw]: 1 + a * (reqStretch - 1) };
    it.headTilt += f * 0.14 * a;
    it.eyeSquint = Math.max(it.eyeSquint ?? 0, 0.22 * a);
    it.lookAt = m.target;
  },

  /** Turn head and eyes toward `target` (and back after t1 unless `hold`). `{ t0, t1, target, hold }` */
  look(it, t, m, k) {
    const a = smootherstep(m.t0, m.t0 + 0.35, t) * (m.hold ? 1 : 1 - smootherstep(m.t1, m.t1 + 0.35, t));
    if (a <= 0) return;
    const hx = it.pelvisX + it.chestOffsetX + it.headOffsetX;
    const hy = it.pelvisY + it.chestOffsetY + it.headOffsetY;
    const nx = clamp((m.target[0] - hx) / 240, -1, 1);
    const ny = clamp((m.target[1] - hy) / 220, -1, 1);
    it.headYaw = lerp(it.headYaw ?? 0, nx * 0.58, a);
    it.headPitch = lerp(it.headPitch ?? 0, ny * 0.28, a);
    it.headTilt += a * nx * 0.12;
    it.chestOffsetX += a * nx * 6 * k.s;
    it.chestOffsetY += a * ny * 4 * k.s;
    const cur = it.lookAt || [hx + k.f * 200, hy - 100];
    it.lookAt = [lerp(cur[0], m.target[0], a), lerp(cur[1], m.target[1], a)];
  },

  /** Ear shake (after a landing, a splash, a surprise). `{ t0, dur }` */
  earShake(it, t, m, k) {
    const dur = m.dur ?? 0.6;
    if (t < m.t0 || t > m.t0 + dur) return;
    const q = (t - m.t0) / dur;
    const e = Math.sin(Math.PI * q);
    it.earAngleL += Math.sin((t - m.t0) * 38) * 0.45 * e;
    it.earAngleR += Math.sin((t - m.t0) * 38 + 0.6) * 0.45 * e;
    it.headTilt += Math.sin((t - m.t0) * 30) * 0.12 * e;
    it.eyeSquint = Math.max(it.eyeSquint ?? 0, 0.5 * e);
  },
};

export function heroBaseAt(t, x0, G0, moves) {
  let x = x0;
  let G = G0;
  const list = moves.filter(([n]) => n === 'trot' || n === 'leap').sort((a, b) => a[1].t0 - b[1].t0);
  for (const [name, m] of list) {
    const fromX = m.fromX ?? x;
    const toX = m.toX ?? fromX;
    const toG = m.toGroundY ?? G;
    if (t <= m.t0) break;
    const u = clamp((t - m.t0) / (m.t1 - m.t0), 0, 1);
    const e = name === 'leap' ? u : smootherstep(0, 1, u);
    x = lerp(fromX, toX, e);
    G = lerp(G, toG, name === 'leap' ? u : e);
    if (u < 1) break;
  }
  return { x, G };
}

export function createPlushCritter(opts = {}, speciesTable = DEFAULT_PLUSH_SPECIES) {
  if (!Number.isFinite(opts.x) || !Number.isFinite(opts.groundY)) {
    reportOnce('critter-placement', 'createPlushCritter({ x, groundY, ... }) needs explicit x and groundY for this shot.');
  }
  const scale = opts.scale ?? 1.32;
  const species = opts.species || 'fennec';
  const facing = opts.facing ?? -1;
  const groundY = opts.groundY ?? 858;
  const baseX = opts.x ?? 960;
  const speciesCfg = speciesTable[species] || speciesTable.fennec || {};
  const build = resolveCritterBuild(speciesCfg, opts.build);
  const L = build.legLen;
  const bl = build.bodyLen;

  const api = {
    scale,
    species,
    facing,
    groundY,
    build,
    restPose(time = 0) {
      return {
        species,
        facing,
        view: opts.view || '3q',
        pelvisX: baseX,
        pelvisY: groundY - 40 * scale * L,
        chestOffsetX: facing * 48 * scale * bl,
        chestOffsetY: -22 * scale * L,
        headOffsetX: facing * 18 * scale,
        headOffsetY: -42 * scale,
        spineArch: -3 * scale,
        headYaw: facing * 0.18,
        headTilt: Math.sin(time * 1.8) * 0.06,
        headPitch: -0.08,
        earAngleL: -1.85 + Math.sin(time * 2.2) * 0.08,
        earAngleR: -1.22 + Math.sin(time * 2.2) * 0.08,
        tailAngle: facing < 0 ? -0.48 : -Math.PI + 0.48,
        tailWagAmp: 0.09,
        eyeSquint: opts.eyeSquint ?? 0,
        feet: {
          hindL: [baseX - facing * 6 * scale * bl, groundY + 3 * scale],
          hindR: [baseX - facing * 18 * scale * bl, groundY - 2 * scale],
          frontL: [baseX + facing * 52 * scale * bl, groundY + 4 * scale],
          frontR: [baseX + facing * 38 * scale * bl, groundY - 1 * scale],
        },
        lookAt: opts.lookAt || [baseX + facing * 240, groundY - 160 * scale],
      };
    },
    perform(time, moves = [], extra = {}) {
      const b = heroBaseAt(time, baseX, groundY, moves);
      const G = extra.groundAt ? extra.groundAt(b.x) : b.G;
      const it = api.restPose(time);
      const dx = b.x - baseX;
      const dy = G - groundY;
      it.pelvisX += dx;
      it.pelvisY += dy;
      for (const key of Object.keys(it.feet)) {
        const fx = it.feet[key][0] + dx;
        const localG = extra.groundAt ? clamp(extra.groundAt(fx), G - 8 * scale, G + 8 * scale) : G;
        it.feet[key] = [fx, localG + (it.feet[key][1] - groundY)];
      }
      it.lookAt = [it.lookAt[0] + dx, it.lookAt[1] + dy];
      it.groundY = G;
      const k = { s: scale, f: facing, L, bl, G, R: 56 * scale * build.headR, hw: build.headWidth ?? 1 };
      for (const [name, m0 = {}] of moves) {
        let m = m0;
        if ((name === 'leap' || name === 'trot') && m0.t0 != null) {
          const b0 = heroBaseAt(m0.t0 - 1e-4, baseX, groundY, moves);
          m = { ...m0, _fromX: b0.x, _fromG: extra.groundAt ? extra.groundAt(b0.x) : b0.G };
        }
        const fn = HERO_MOVES[name];
        if (!fn) {
          reportOnce(`move-${name}`, `perform(): unknown move '${name}' (known: ${Object.keys(HERO_MOVES).join(', ')}).`);
          continue;
        }
        fn(it, time, m, k);
      }
      return { ...it, ...(extra.override ? extra.override(it, time) : {}) };
    },
    simulate(t, customChoreoFn) {
      const fn = customChoreoFn || ((time) => api.restPose(time));
      return simulateCritterRig(t, fn, scale, {
        species,
        speciesTable,
        build: opts.build,
        view: opts.view,
        paletteOverrides: opts.paletteOverrides,
      });
    },
  };
  return api;
}

// ===========================================================================
// SECTION II: WORLD-FORM SIDE-PROFILE QUADRUPEDS (ADR-015 Realistic Wildlife)
// ===========================================================================

// ---------------------------------------------------------------------------
// Axes
// ---------------------------------------------------------------------------

/** kneeH / hockH as fractions of hip height · footLen in body units · hockBack = hock behind the foot joint. */
export const STANCES = {
  unguligrade: { foot: 'hoof', kneeH: 0.31, hockH: 0.37, footLen: 0.04, fetH: 0.2, hockBack: 0.07, metaTilt: 0 },
  digitigrade: { foot: 'paw', kneeH: 0.2, hockH: 0.3, footLen: 0.085, fetH: 0.045, hockBack: 0.09, metaTilt: -0.12 },
  plantigrade: { foot: 'sole', kneeH: 0.2, hockH: 0.09, footLen: 0.17, fetH: 0.06, hockBack: 0.0, metaTilt: -0.05 },
};

/**
 * Head landmarks in head-local units (x along the skull toward the nose, y down out of the jaw, 1 = headLen).
 * `top` / `bottom` are the outline orders (nose → poll, latch → lip). `rest` = resting head angle (0 = level).
 * `muzzleFrom` = where the `muzzle` stretch starts. `ear` = default ear shape and how upright it stands.
 */
export const SKULLS = {
  grazer: {
    rest: -0.5, muzzleFrom: 0.15,
    pts: {
      noseTip: [0.84, -0.03], bridge: [0.55, -0.19], brow: [0.15, -0.34], poll: [-0.26, -0.3],
      lip: [0.82, 0.1], chin: [0.62, 0.18], jaw: [0.12, 0.3], latch: [-0.28, 0.2],
      eye: [0.16, -0.14], ear: [-0.2, -0.33], antler: [-0.04, -0.36], nostril: [0.76, -0.02],
    },
    top: [['noseTip', 0.5], ['bridge', 1], ['brow', 1], ['poll', 0.8]],
    bottom: [['latch', 0.8], ['jaw', 1], ['chin', 0.8], ['lip', 0.6]],
    eye: { r: 0.055, tilt: 0, iris: null },
    ear: { shape: 'leaf', angle: 0.72 },
    nose: 'nostril',
  },
  canid: {
    rest: -0.12, muzzleFrom: 0.36,
    pts: {
      noseTip: [0.9, -0.05], bridge: [0.62, -0.12], stop: [0.38, -0.2], brow: [0.14, -0.37], poll: [-0.22, -0.33],
      lip: [0.84, 0.05], chin: [0.62, 0.12], jaw: [0.2, 0.33], latch: [-0.26, 0.27],
      eye: [0.31, -0.19], ear: [-0.06, -0.36], antler: [0, -0.38], nostril: [0.9, -0.04],
    },
    top: [['noseTip', 0.45], ['bridge', 1], ['stop', 0.7], ['brow', 1], ['poll', 0.8]],
    bottom: [['latch', 0.8], ['jaw', 1], ['chin', 0.7], ['lip', 0.6]],
    eye: { r: 0.06, tilt: -0.3 },
    ear: { shape: 'triangle', angle: 0.6 },
    nose: 'noseTip',
  },
  ursid: {
    rest: -0.08, muzzleFrom: 0.4,
    pts: {
      noseTip: [0.86, -0.03], bridge: [0.62, -0.1], stop: [0.42, -0.19], brow: [0.16, -0.36], poll: [-0.2, -0.36],
      lip: [0.84, 0.08], chin: [0.62, 0.17], jaw: [0.16, 0.38], latch: [-0.26, 0.32],
      eye: [0.33, -0.17], ear: [-0.08, -0.36], antler: [0, -0.38], nostril: [0.86, -0.02],
    },
    top: [['noseTip', 0.5], ['bridge', 1], ['stop', 0.8], ['brow', 1], ['poll', 1]],
    bottom: [['latch', 1], ['jaw', 1], ['chin', 0.8], ['lip', 0.6]],
    eye: { r: 0.045, tilt: 0, iris: null },
    ear: { shape: 'round', angle: 0.62 },
    nose: 'noseTip',
  },
};

/** tuck = flank rise behind the ribs · chest = brisket drop · hump = extra withers height (shoulder muscle). */
export const TRUNKS = {
  barrel: { tuck: 0.02, chest: 0.01, hump: 0 },
  tucked: { tuck: 0.08, chest: 0.03, hump: 0 },
  heavy: { tuck: -0.01, chest: 0.02, hump: 0.07 },
};

/**
 * tuft = tuft length (body units) · planes = how much muscle form shows through (1 = all) · zones = where the coat
 * breaks the silhouette (weight per outline zone).
 */
export const COATS = {
  sleek: { tuft: 0, planes: 1, zones: {} },
  short: { tuft: 0.008, planes: 0.85, zones: { throat: 0.6, belly: 0.5, thighBack: 0.4 } },
  plush: { tuft: 0.017, planes: 0.5, zones: { cheek: 1, throat: 1, chest: 0.9, belly: 0.7, thighBack: 0.9, back: 0.25, nape: 0.4 } },
  shaggy: { tuft: 0.02, planes: 0.5, zones: { cheek: 0.8, throat: 1, chest: 1, belly: 0.9, thighBack: 1, back: 0.5, nape: 1, croup: 0.4 } },
};

/**
 * kind: 'chain' (points along spine) · segs = segment count · tuft = extra fluff on the tail.
 * carriage: resting angle relative to the spine (positive = drooping).
 */
export const TAILS = {
  flag: { kind: 'chain', segs: 3, drop: 0.6, carriage: 0.2, tuft: 0.015 },
  brush: { kind: 'chain', segs: 4, drop: 0.8, carriage: 0.4, tuft: 0.025 },
  hair: { kind: 'chain', segs: 4, drop: 1.1, carriage: 0.85, tuft: 0.005 },
  stub: { kind: 'stub', r: 0.05, drop: 0.2, carriage: 0.3, tuft: 0.012 },
};

/**
 * Gaits: timing offsets per limb (fraction of stride cycle), lift heights and spine bob.
 * order: [hindFar, frontFar, hindNear, frontNear] — e.g. diagonal trot vs four-beat walk.
 */
export const GAITS = {
  walk: { phase: [0.0, 0.25, 0.5, 0.75], lift: 0.08, spineBob: 0.02, neckBob: 0.04 },
  trot: { phase: [0.0, 0.5, 0.5, 0.0], lift: 0.14, spineBob: 0.04, neckBob: 0.02 },
};

/**
 * Anatomical landmarks for markings. Shaders match these landmarks against their own palette zones so markings
 * sit on the real animal's body (e.g. stockings stay on the lower leg, a bib stays on the throat).
 */
export const MARKING_ZONES = [
  'stockings', 'socks', 'bib', 'chin', 'muzzle', 'blaze', 'saddle', 'rump', 'tailTip', 'earBacks', 'mane', 'nose',
];

// ---------------------------------------------------------------------------
// Species = Axes + Proportions
// ---------------------------------------------------------------------------

/**
 * Proportions (in body-local units where withers height `hy = 1 - withers` and shoulder-to-hip distance `D ≈ 0.6..0.7`):
 *   withersM    real shoulder height in metres. Multiplied by `pxPerM` to give this species its scale in the shot.
 *   hy          hip height (usually 0.85..1.0 × withers).
 *   D           back length: shoulder joint to hip joint.
 *   withers     withers peak above the back line.
 *   backDip     sway-back dip between withers and croup.
 *   neckLen     cervical spine length.
 *   neckAngle   resting neck angle above the back line (rad).
 *   neckW       [base, throat] half-widths.
 *   crestArch   arch of the dorsal neck curve.
 *   headLen     skull length (poll to nose).
 *   headDepth   skull height multiplier (jaw to brow).
 *   muzzle      muzzle length multiplier.
 *   earLen      ear length multiplier.
 *   earWidth    ear width multiplier.
 *   legW        [shoulder/hip, elbow/knee, pastern, foot] half-widths of the leg.
 *   thighW      [croup, flank, stifle] haunch widths.
 *   antlers     chain of control points for horn/antler growth, or null.
 *   markings    [{ zone, tone: 'dark'|'pale'|'accent', alpha }]
 */
export const PROFILE_SPECIES = {
  deer: {
    stance: 'unguligrade', skull: 'grazer', trunk: 'tucked', coat: 'sleek', tail: 'flag', gait: 'walk', withersM: 1.0,
    hy: 0.95, D: 0.62, withers: 0.04, backDip: 0.015,
    neckLen: 0.42, neckAngle: 0.85, neckW: [0.18, 0.1], crestArch: 0.02,
    headLen: 0.34, headDepth: 0.92, muzzle: 1.0, earLen: 0.36, earWidth: 0.6,
    legW: [0.08, 0.042, 0.022, 0.024], thighW: [0.19, 0.1, 0.04],
    tailSpec: { len: 0.18, w: [0.03, 0.05, 0.01], angle: 0.4, curl: 0.05 },
    antlers: {
      beams: [
        [[0.0, 0.0], [0.05, 0.22], [0.02, 0.45], [-0.08, 0.65], [-0.18, 0.78]],
        [[0.05, 0.22], [0.14, 0.35], [0.22, 0.42]],
        [[0.02, 0.45], [0.08, 0.58]],
      ],
      w: 0.02,
    },
    markings: [
      { zone: 'rump', tone: 'pale', alpha: 0.85 }, { zone: 'bib', tone: 'pale', alpha: 0.65 },
      { zone: 'chin', tone: 'pale', alpha: 0.7 }, { zone: 'nose', tone: 'dark', alpha: 0.9 },
    ],
  },
  horse: {
    stance: 'unguligrade', skull: 'grazer', trunk: 'barrel', coat: 'short', tail: 'hair', gait: 'trot', withersM: 1.55,
    hy: 0.98, D: 0.7, withers: 0.08, backDip: 0.03,
    neckLen: 0.52, neckAngle: 0.75, neckW: [0.28, 0.16], crestArch: 0.08,
    headLen: 0.42, headDepth: 1.05, muzzle: 1.05, earLen: 0.22, earWidth: 0.45,
    legW: [0.11, 0.065, 0.036, 0.048], thighW: [0.24, 0.14, 0.06],
    tailSpec: { len: 0.75, w: [0.04, 0.09, 0.07], angle: 0.85, curl: 0.08 },
    antlers: null,
    mane: { arch: 0.08, tuft: 0.04 },
    markings: [
      { zone: 'blaze', tone: 'pale', alpha: 0.85 }, { zone: 'socks', tone: 'pale', alpha: 0.75 },
      { zone: 'mane', tone: 'dark', alpha: 0.9 }, { zone: 'nose', tone: 'dark', alpha: 0.8 },
    ],
  },
  fox: {
    stance: 'digitigrade', skull: 'canid', trunk: 'tucked', coat: 'plush', tail: 'brush', gait: 'trot', withersM: 0.42,
    hy: 0.92, D: 0.64, withers: 0.02, backDip: 0.01,
    neckLen: 0.3, neckAngle: 0.55, neckW: [0.22, 0.13], crestArch: 0.03,
    headLen: 0.36, headDepth: 0.9, muzzle: 1.15, earLen: 0.46, earWidth: 0.7,
    legW: [0.08, 0.045, 0.024, 0.032], thighW: [0.18, 0.095, 0.04],
    tailSpec: { len: 0.72, w: [0.05, 0.14, 0.06], angle: 0.95, curl: 0.18 },
    antlers: null,
    markings: [
      { zone: 'bib', tone: 'pale', alpha: 0.9 }, { zone: 'chin', tone: 'pale', alpha: 0.9 },
      { zone: 'tailTip', tone: 'pale', alpha: 0.95 }, { zone: 'stockings', tone: 'dark', alpha: 0.85 },
      { zone: 'earBacks', tone: 'dark', alpha: 0.9 }, { zone: 'nose', tone: 'dark', alpha: 0.95 },
    ],
  },
  wolf: {
    stance: 'digitigrade', skull: 'canid', trunk: 'barrel', coat: 'shaggy', tail: 'brush', gait: 'trot', withersM: 0.8,
    hy: 0.9, D: 0.66, withers: 0.05, backDip: 0.015,
    neckLen: 0.32, neckAngle: 0.62, neckW: [0.36, 0.24], crestArch: 0.04,
    headLen: 0.4, headDepth: 1.1, muzzle: 1.0, earLen: 0.36, earWidth: 0.7,
    legW: [0.12, 0.07, 0.055, 0.07], thighW: [0.24, 0.13, 0.075],
    tailSpec: { len: 0.55, w: [0.05, 0.11, 0.04], angle: 1.05, curl: 0.15 },
    antlers: null,
    markings: [
      { zone: 'saddle', tone: 'dark', alpha: 0.55 }, { zone: 'bib', tone: 'pale', alpha: 0.6 },
      { zone: 'chin', tone: 'pale', alpha: 0.6 }, { zone: 'nose', tone: 'dark', alpha: 0.95 },
    ],
  },
  bear: {
    stance: 'plantigrade', skull: 'ursid', trunk: 'heavy', coat: 'shaggy', tail: 'stub', gait: 'walk', withersM: 1.0,
    hy: 0.7, D: 0.52, withers: 0.04, backDip: 0.0,
    neckLen: 0.24, neckAngle: 0.3, neckW: [0.42, 0.32], crestArch: 0.03,
    headLen: 0.38, headDepth: 1.15, muzzle: 0.95, earLen: 0.22, earWidth: 1.0,
    legW: [0.21, 0.15, 0.13, 0.14], thighW: [0.32, 0.22, 0.15],
    antlers: null,
    markings: [{ zone: 'nose', tone: 'dark', alpha: 0.9 }],
  },
};

// ---------------------------------------------------------------------------
// Vector + Path Helpers (World Quadruped Form)
// ---------------------------------------------------------------------------

export const v2 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, k) => [a[0] * k, a[1] * k],
  lerp: (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u],
  len: (a) => Math.hypot(a[0], a[1]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1]) || 1;
    return [a[0] / l, a[1] / l];
  },
};

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function outlineSegment(pts, i) {
  const n = pts.length;
  const k = (p) => (p[2] ?? 1) / 6;
  const p0 = pts[(i - 1 + n) % n];
  const p1 = pts[i];
  const p2 = pts[(i + 1) % n];
  const p3 = pts[(i + 2) % n];
  return [
    p1,
    [p1[0] + (p2[0] - p0[0]) * k(p1), p1[1] + (p2[1] - p0[1]) * k(p1)],
    [p2[0] - (p3[0] - p1[0]) * k(p2), p2[1] - (p3[1] - p1[1]) * k(p2)],
    p2,
  ];
}

export function traceOutline(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length; i++) {
    const [, c1, c2, p2] = outlineSegment(pts, i);
    ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]);
  }
  ctx.closePath();
}

export function traceProfilePart(ctx, part, map) {
  if (part.kind === 'tuft') {
    const [b0, c0, tip, c1, b1] = [part.b0, part.c0, part.tip, part.c1, part.b1].map(map);
    ctx.moveTo(b0[0], b0[1]);
    ctx.quadraticCurveTo(c0[0], c0[1], tip[0], tip[1]);
    ctx.quadraticCurveTo(c1[0], c1[1], b1[0], b1[1]);
    ctx.closePath();
    return;
  }
  traceOutline(ctx, part.pts.map((p) => [...map(p), p[2] ?? 1]));
}

export function sampleChain(pts, u) {
  const n = pts.length - 1;
  const s = clamp(u, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(s));
  const t = s - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(n, i + 2)];
  const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  const df = (a, b, c, d) => 0.5 * (-a + c + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t * t);
  const tan = v2.norm([df(p0[0], p1[0], p2[0], p3[0]), df(p0[1], p1[1], p2[1], p3[1])]);
  return { p: [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])], t: tan };
}

function solveTwoBone(a, target, l1, l2, bend) {
  const dx = target[0] - a[0];
  const dy = target[1] - a[1];
  const d = Math.max(1e-4, Math.hypot(dx, dy));
  const dClamped = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-4, d));
  const cosAlpha = (l1 * l1 + dClamped * dClamped - l2 * l2) / (2 * l1 * dClamped);
  const alpha = Math.acos(clamp(cosAlpha, -1, 1));
  const baseAngle = Math.atan2(dy, dx);
  const angle = baseAngle + bend * alpha;
  const mid = [a[0] + Math.cos(angle) * l1, a[1] + Math.sin(angle) * l1];
  return { mid, end: target };
}

function mixAngles(a, b, u) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * u;
}

// ---------------------------------------------------------------------------
// Kinematics & Posing (World Quadruped Form)
// ---------------------------------------------------------------------------

export function profileSizeForScale(species, scale = 1.0, pxPerM = 480) {
  const S = typeof species === 'string' ? PROFILE_SPECIES[species] || PROFILE_SPECIES.deer : species;
  return (S.withersM || 1.0) * pxPerM * (scale / 1.32);
}

export function poseProfileQuadruped(species, opts = {}) {
  const P = typeof species === 'string' ? { ...PROFILE_SPECIES[species], species } : { ...species };
  const stance = STANCES[P.stance] || STANCES.unguligrade;
  const skull = SKULLS[P.skull] || SKULLS.grazer;
  const trunk = TRUNKS[P.trunk] || TRUNKS.barrel;
  const coat = COATS[P.coat] || COATS.sleek;
  const tail = TAILS[P.tail] || TAILS.brush;
  const gait = GAITS[P.gait] || GAITS.walk;

  const t = opts.t ?? 0;
  const speed = opts.speed ?? 1.0;
  const cycle = (t * speed) % 1;
  const headLift = opts.headLift ?? 0;
  const alert = opts.alert ?? 0;
  const earTwitch = opts.earTwitch ?? [0, 0];

  const D = P.D;
  const shoulderX = D * 0.5;
  const hipX = -D * 0.5;

  const footXOffsets = [
    hipX - 0.05,
    shoulderX - 0.04,
    hipX + 0.03,
    shoulderX + 0.05,
  ];

  const legLengths = {
    front: { l1: 0.52, l2: 0.44 },
    hind: { l1: 0.48, l2: 0.48 },
  };

  const legs = {};
  const legKeys = ['hindFar', 'frontFar', 'hindNear', 'frontNear'];
  const legIsHind = [true, false, true, false];
  const legIsNear = [false, false, true, true];

  for (let i = 0; i < 4; i++) {
    const key = legKeys[i];
    const isHind = legIsHind[i];
    const isNear = legIsNear[i];
    const phase = (cycle + gait.phase[i]) % 1;
    const footX = footXOffsets[i] + (phase < 0.5 ? lerp(-0.08, 0.08, phase * 2) : lerp(0.08, -0.08, (phase - 0.5) * 2));
    const inAir = phase >= 0.5;
    const liftNorm = inAir ? Math.sin((phase - 0.5) * 2 * Math.PI) : 0;
    const footY = liftNorm * gait.lift;

    const root = isHind ? [hipX, P.hy] : [shoulderX, 1.0];
    const lens = isHind ? legLengths.hind : legLengths.front;
    const ik = solveTwoBone(root, [footX, footY + stance.footLen * 0.5], lens.l1, lens.l2, isHind ? -1 : 1);

    legs[key] = {
      root,
      knee: ik.mid,
      ankle: [ik.end[0], ik.end[1] + (isHind ? stance.hockH : stance.kneeH)],
      foot: [footX, footY],
      pastern: [footX + (isNear ? stance.metaTilt : -stance.metaTilt) * 0.02, footY + stance.fetH],
      isNear,
      isHind,
      phase,
    };
  }

  const spineBob = Math.sin(cycle * Math.PI * 4) * gait.spineBob;
  const neckBob = Math.cos(cycle * Math.PI * 2) * gait.neckBob;

  const spine = {
    withers: [shoulderX, 1.0 + P.withers + spineBob],
    midBack: [0, (1.0 + P.hy) * 0.5 - P.backDip + spineBob * 0.5],
    croup: [hipX, P.hy + spineBob * 0.8],
    brisket: [shoulderX + 0.02, 1.0 - trunk.chest],
    belly: [0, (1.0 + P.hy) * 0.5 - 0.32 + trunk.tuck],
    flank: [hipX + 0.04, P.hy - 0.28],
  };

  const restingNeck = P.neckAngle;
  const finalNeckAngle = restingNeck + headLift * 0.35 + alert * 0.2 + neckBob;
  const neckBase = [shoulderX - 0.04, spine.withers[1] - 0.04];
  const poll = [
    neckBase[0] + Math.cos(finalNeckAngle) * P.neckLen,
    neckBase[1] + Math.sin(finalNeckAngle) * P.neckLen,
  ];
  const throat = [
    neckBase[0] + Math.cos(finalNeckAngle) * P.neckLen * 0.85 - P.neckW[1] * 0.5,
    neckBase[1] + Math.sin(finalNeckAngle) * P.neckLen * 0.85 - P.neckW[1] * 0.5,
  ];

  const headAngle = mixAngles(skull.rest, 0.1, headLift) - alert * 0.1;
  const headCos = Math.cos(headAngle);
  const headSin = Math.sin(headAngle);
  const headMap = ([lx, ly]) => [
    poll[0] + (lx * P.headLen * headCos - ly * P.headLen * P.headDepth * headSin),
    poll[1] + (lx * P.headLen * headSin + ly * P.headLen * P.headDepth * headCos),
  ];

  const headPts = {};
  for (const [k, p] of Object.entries(skull.pts)) {
    headPts[k] = headMap(p);
  }

  return {
    P: { ...P, stanceT: stance, skullT: skull, trunkT: trunk, coatT: coat, tailT: tail, gaitT: gait },
    spine,
    neckBase,
    poll,
    throat,
    headAngle,
    headPts,
    legs,
    earTwitch,
    alert,
  };
}

// ---------------------------------------------------------------------------
// Silhouette & Outline Extraction (World Quadruped Form)
// ---------------------------------------------------------------------------

function bodyOutlinePts(S) {
  const { spine, throat, headPts, P } = S;
  const skull = P.skullT;
  const pts = [];

  for (const [name, k] of skull.top) {
    if (headPts[name]) pts.push([...headPts[name], k, 'skullTop']);
  }

  pts.push([...S.poll, 0.8, 'poll']);
  pts.push([spine.withers[0] + 0.02, spine.withers[1] + P.crestArch, 0.9, 'nape']);
  pts.push([...spine.withers, 1.0, 'withers']);
  pts.push([...spine.midBack, 1.0, 'back']);
  pts.push([...spine.croup, 0.85, 'croup']);

  pts.push([spine.croup[0] - 0.08, spine.croup[1] - 0.08, 0.8, 'rump']);
  pts.push([spine.flank[0] - 0.06, spine.flank[1] - 0.06, 0.9, 'thighBack']);
  pts.push([...spine.flank, 1.0, 'flank']);
  pts.push([...spine.belly, 1.0, 'belly']);
  pts.push([...spine.brisket, 0.95, 'chest']);
  pts.push([...throat, 0.8, 'throat']);

  for (const [name, k] of skull.bottom) {
    if (headPts[name]) pts.push([...headPts[name], k, 'jaw']);
  }

  return pts;
}

function limbOutlinePts(S, L) {
  const { root, knee, ankle, pastern, foot, isHind, isNear } = L;
  const P = S.P;
  const w = isHind ? P.thighW : P.legW;
  const side = isNear ? 1 : -1;
  const pts = [];

  pts.push([root[0] - w[0] * 0.5, root[1], 0.7, 'shoulderTop']);
  pts.push([knee[0] - w[1] * 0.4 * side, knee[1], 1.0, 'kneeFront']);
  pts.push([pastern[0] - 0.02, pastern[1], 1.0, 'pasternFront']);
  pts.push([foot[0] - 0.03, foot[1], 0.4, 'toe']);
  pts.push([foot[0] + 0.03, foot[1], 0.4, 'heel']);
  pts.push([pastern[0] + 0.02, pastern[1], 1.0, 'pasternBack']);
  pts.push([ankle[0] + w[1] * 0.4 * side, ankle[1], 1.0, 'hockBack']);
  pts.push([root[0] + w[0] * 0.5, root[1] - 0.05, 0.8, 'shoulderBack']);

  return pts;
}

function earPts(S, sideIdx = 0) {
  const { headPts, headAngle, P, earTwitch, alert } = S;
  const earRoot = headPts.ear || S.poll;
  const skull = P.skullT;
  const earAngle = headAngle + skull.ear.angle * (sideIdx === 0 ? 1 : 0.85) + earTwitch[sideIdx] + alert * 0.15;
  const len = P.earLen * 0.35;
  const wid = P.earWidth * 0.16;

  const tip = [earRoot[0] + Math.cos(earAngle) * len, earRoot[1] + Math.sin(earAngle) * len];
  const perp = [-Math.sin(earAngle) * wid, Math.cos(earAngle) * wid];

  return [
    [earRoot[0] - perp[0] * 0.5, earRoot[1] - perp[1] * 0.5, 0.6, 'earRoot'],
    [tip[0], tip[1], 0.4, 'earTip'],
    [earRoot[0] + perp[0] * 0.5, earRoot[1] + perp[1] * 0.5, 0.6, 'earBack'],
  ];
}

function tailShape(S) {
  const { spine, P } = S;
  const tail = P.tailT;
  if (!tail || tail.kind === 'stub') {
    const root = spine.croup;
    const r = tail ? tail.r : 0.04;
    return {
      pts: [
        [root[0] - r, root[1], 0.6, 'tail'],
        [root[0] - r * 1.8, root[1] - r * 0.8, 0.4, 'tailTip'],
        [root[0] - r * 0.5, root[1] - r * 1.5, 0.6, 'tail'],
      ],
      chain: null,
    };
  }

  const spec = P.tailSpec || { len: 0.4, w: [0.03, 0.08, 0.02], angle: 0.8, curl: 0.1 };
  const chain = [];
  const start = [spine.croup[0] - 0.02, spine.croup[1] - 0.02];
  const angle = -spec.angle;
  for (let i = 0; i <= tail.segs; i++) {
    const u = i / tail.segs;
    const a = angle + spec.curl * Math.sin(u * Math.PI);
    chain.push([start[0] - Math.cos(a) * u * spec.len, start[1] + Math.sin(a) * u * spec.len]);
  }

  const left = [];
  const right = [];
  for (let i = 0; i <= tail.segs; i++) {
    const u = i / tail.segs;
    const p = chain[i];
    const w = lerp(spec.w[0], spec.w[1], Math.sin(u * Math.PI)) * (1 - u * 0.5);
    left.push([p[0] - w * 0.5, p[1], 0.8, 'tail']);
    right.push([p[0] + w * 0.5, p[1], 0.8, 'tail']);
  }

  return {
    pts: [...left, ...right.reverse()],
    chain,
  };
}

function maneShape(S) {
  if (!S.P.mane) return null;
  const { spine, poll } = S;
  const m = S.P.mane;
  const pts = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const base = v2.lerp(poll, spine.withers, u);
    const arch = Math.sin(u * Math.PI) * m.arch;
    pts.push([base[0] - arch * 0.5, base[1] + arch, 0.7, 'mane']);
  }
  return { pts };
}

function coatTufts(pts, zones, tuftLen, seed = 1) {
  if (tuftLen <= 0.001) return [];
  const tufts = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const zone = p[3];
    const weight = zones[zone] || 0;
    if (weight <= 0.05) continue;
    const h = hash(seed + i * 3.7);
    if (h > weight) continue;
    const pNext = pts[(i + 1) % pts.length];
    const mid = v2.lerp(p, pNext, 0.5);
    const edge = v2.sub(pNext, p);
    const norm = v2.norm([-edge[1], edge[0]]);
    const len = tuftLen * (0.6 + 0.8 * hash(seed + i * 9.1));
    tufts.push({
      kind: 'tuft',
      b0: [p[0], p[1]],
      c0: [mid[0] + norm[0] * len * 0.6, mid[1] + norm[1] * len * 0.6],
      tip: [mid[0] + norm[0] * len, mid[1] + norm[1] * len],
      c1: [pNext[0] + norm[0] * len * 0.4, pNext[1] + norm[1] * len * 0.4],
      b1: [pNext[0], pNext[1]],
      zone,
    });
  }
  return tufts;
}

function antlerChains(S) {
  const spec = S.P.antlers;
  if (!spec || !spec.beams) return [];
  const headMap = (p) => {
    const cos = Math.cos(S.headAngle);
    const sin = Math.sin(S.headAngle);
    const root = S.headPts.antler || S.poll;
    return [root[0] + (p[0] * cos - p[1] * sin) * S.P.headLen, root[1] + (p[0] * sin + p[1] * cos) * S.P.headLen];
  };
  return spec.beams.map((b) => b.map(headMap));
}

function markingPrims(S, parts, zone) {
  switch (zone) {
    case 'bib':
    case 'throat':
      return parts.near.filter((p) => p.kind === 'outline');
    case 'socks':
    case 'stockings':
      return parts.far.concat(parts.near).filter((p) => p.kind === 'outline');
    case 'saddle':
      return [parts.near[0]];
    case 'rump':
      return [parts.near[0]];
    case 'tailTip':
      return parts.tail;
    case 'nose': {
      const tip = S.headPts.noseTip;
      return tip ? [{ kind: 'disc', cx: tip[0], cy: tip[1], r: 0.02 }] : [];
    }
    default:
      return [];
  }
}

export function profileParts(S) {
  const { P } = S;
  const body = { kind: 'outline', pts: bodyOutlinePts(S) };
  const tail = tailShape(S);
  const mane = maneShape(S);
  const ears = [earPts(S, 0), earPts(S, 1)];
  const coat = P.coatT;
  const seed = (P.withersM || 1) * 1000;
  const bodyTufts = [
    ...coatTufts(body.pts, coat.zones, coat.tuft, seed),
    ...(mane ? coatTufts(mane.pts, { mane: 1 }, 0.02, seed + 2) : []),
  ];
  const tailTufts = tail && P.tailT.tuft ? coatTufts(tail.pts, { tail: 1 }, P.tailT.tuft, seed + 1) : [];
  const parts = {
    far: [
      { kind: 'outline', pts: limbOutlinePts(S, S.legs.hindFar) },
      { kind: 'outline', pts: limbOutlinePts(S, S.legs.frontFar) },
      { kind: 'outline', pts: ears[1] },
    ],
    near: [body, ...(mane ? [{ kind: 'outline', pts: mane.pts }] : []), { kind: 'outline', pts: ears[0] }, ...bodyTufts],
    tail: tail ? [{ kind: 'outline', pts: tail.pts }, ...tailTufts] : [],
    antlers: antlerChains(S),
    tailChain: tail ? tail.chain : null,
    mane: mane ? { kind: 'outline', pts: mane.pts } : null,
    ears: [ears[0]],
  };
  parts.markings = (P.markings || []).map((m) => ({ tone: m.tone || 'dark', alpha: m.alpha ?? 0.8, zone: m.zone, prims: markingPrims(S, parts, m.zone) }));
  return parts;
}

// ===========================================================================
// SECTION III: WORLD-FORM AQUATIC / FISH GEOMETRY & KINEMATICS (Layer 1)
// ===========================================================================
// Style-agnostic parametric fish geometry with:
//   - Velocity-aligned orientation (`heading = Math.atan2(dy, dx)` automatically keeps dorsal fin upright)
//   - 3-stage travelling wave body undulation (`nose`, `mid`, `peduncle`, `tailSwing`, `finFlutter`)
//   - Species / body-plan table (`FISH_SPECIES`: 'streamFish' | 'veilKoi' | 'lanternFish')
//   - Zero colours, zero lights, zero style-specific shaders (shaded by Layer 2 style kernels).

export const FISH_SPECIES = {
  streamFish: {
    kind: 'streamFish',
    bodyDepth: 0.28,
    tailLen: 0.58,
    tailSpread: 0.34,
    tailFork: 0.28,
    dorsalLen: 0.46,
    dorsalHeight: 0.24,
    pectoralLen: 0.28,
    pectoralWidth: 0.16,
    lure: false,
  },
  veilKoi: {
    kind: 'veilKoi',
    bodyDepth: 0.32,
    tailLen: 0.84,
    tailSpread: 0.46,
    tailFork: 0.36,
    dorsalLen: 0.54,
    dorsalHeight: 0.32,
    pectoralLen: 0.38,
    pectoralWidth: 0.22,
    lure: false,
  },
  lanternFish: {
    kind: 'lanternFish',
    bodyDepth: 0.33,
    tailLen: 0.52,
    tailSpread: 0.30,
    tailFork: 0.24,
    dorsalLen: 0.38,
    dorsalHeight: 0.20,
    pectoralLen: 0.26,
    pectoralWidth: 0.15,
    lure: true,
    lureReach: [0.58, 0.36],
  },
};

/**
 * Computes the kinematic pose and control points of a `world`-form fish in local coordinates
 * (where nose is along `-X`, tail is along `+X`, and dorsal fin is along `-Y`).
 */
export function poseProfileFish(opts = {}) {
  const kind = opts.kind || 'streamFish';
  const baseSpec = FISH_SPECIES[kind] || FISH_SPECIES.streamFish;
  const P = { ...baseSpec, ...(opts.profile || {}) };
  const scale = opts.scale ?? 1.0;
  const L = opts.length ?? 128 * scale;
  const t = opts.t ?? 0;
  const phase = opts.phase ?? 0;
  const swimSpeed = opts.swimSpeed ?? 5.2;
  const swimAmp = opts.swimAmp ?? 1.0;

  const swim = Math.sin(t * swimSpeed + phase) * 9 * scale * swimAmp;
  const tailSwing = Math.sin(t * (swimSpeed * 1.25) + phase - 0.9) * 18 * scale * swimAmp;
  const finFlutter = Math.sin(t * (swimSpeed * 1.25) + phase) * 0.14 * swimAmp;

  // Velocity-aligned orientation: nose in local space is at `-X` (`-L * 0.66`), dorsal is at `-Y`.
  // When `heading` is provided, flip X whenever `cos(heading) >= 0` so the nose points along `heading`
  // while the dorsal fin (`-Y`) always stays on top!
  let rot = opts.angle ?? 0;
  let flipX = opts.flipX ? -1 : (opts.facing ?? -1) > 0 ? -1 : 1;
  const flipY = opts.flipY ? -1 : 1;
  if (opts.heading !== undefined && opts.heading !== null) {
    if (Math.cos(opts.heading) >= 0) {
      rot = opts.heading;
      flipX = -1;
    } else {
      rot = opts.heading - Math.PI;
      flipX = 1;
    }
  }

  const D = P.bodyDepth;
  const noseX = -L * 0.66;
  const noseY = swim * 0.15;
  const midY = -swim * 0.32;
  const peduncleX = L * 0.42;
  const peduncleY = swim * 0.40;

  const tLen = P.tailLen;
  const tSpread = P.tailSpread;
  const tailTipTopX = peduncleX + L * tLen * 1.03;
  const tailTipTopY = -L * tSpread * 1.1 + tailSwing;
  const tailForkX = peduncleX + L * tLen * (1 - P.tailFork * 0.65);
  const tailForkY = -L * 0.04 + tailSwing * 0.65;
  const tailTipBotX = peduncleX + L * tLen * 0.91;
  const tailTipBotY = L * tSpread * 0.72 + tailSwing * 0.85;

  const dorsalStart = [-L * 0.20, midY - L * D * 0.78];
  const dorsalCtrlTop = [dorsalStart[0] + L * P.dorsalLen * 0.52, midY - L * (D * 0.78 + P.dorsalHeight * 0.65)];
  const dorsalEnd = [dorsalStart[0] + L * P.dorsalLen, peduncleY - L * D * 0.42];
  const dorsalCtrlBot = [dorsalStart[0] + L * P.dorsalLen * 0.52, midY - L * D * 0.56];

  const pecRoot = [-L * 0.22, noseY + L * D * 0.52];
  const gillArc = { cx: -L * 0.34, cy: noseY + L * 0.01, r: L * D * 0.48, a0: -0.60, a1: 0.80 };
  const eye = { x: -L * 0.49, y: noseY + L * 0.02, r: L * 0.036 };

  let lure = null;
  if (P.lure) {
    const [rx, ry] = P.lureReach || [0.58, 0.36];
    const rootX = -L * 0.42;
    const rootY = noseY - L * D * 0.62;
    const tipX = -L * (0.42 + rx * 0.52);
    const tipY = noseY - L * (D * 0.62 + ry) + swim * 0.25;
    lure = {
      root: [rootX, rootY],
      ctrl: [rootX - L * rx * 0.32, tipY - L * 0.06],
      tip: [tipX, tipY],
      bulbR: L * 0.046,
    };
  }

  return {
    P,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    scale,
    L,
    rot,
    flipX,
    flipY,
    swim,
    tailSwing,
    finFlutter,
    noseX,
    noseY,
    midY,
    peduncleX,
    peduncleY,
    tailTipTopX,
    tailTipTopY,
    tailForkX,
    tailForkY,
    tailTipBotX,
    tailTipBotY,
    dorsal: { start: dorsalStart, ctrlTop: dorsalCtrlTop, end: dorsalEnd, ctrlBot: dorsalCtrlBot },
    pecRoot,
    gillArc,
    eye,
    lure,
  };
}

/**
 * Applies the world-to-local fish transform (`x, y, rot, flipX, flipY`) to `ctx`.
 */
export function applyFishTransform(ctx, F) {
  ctx.translate(F.x, F.y);
  ctx.rotate(F.rot);
  if (F.flipX !== 1 || F.flipY !== 1) ctx.scale(F.flipX, F.flipY);
}

/**
 * Traces a pure geometric part of a posed fish (`'body' | 'dorsal' | 'pectoral' | 'gill' | 'lureStalk'`)
 * in fish-local coordinates (call after `applyFishTransform(ctx, F)` or inside a local offscreen pass).
 */
export function traceFishPart(ctx, F, part = 'body') {
  const { L, P } = F;
  const D = P.bodyDepth;
  if (part === 'body') {
    const {
      noseX, noseY, midY, peduncleX, peduncleY,
      tailTipTopX, tailTipTopY, tailForkX, tailForkY, tailTipBotX, tailTipBotY,
    } = F;
    ctx.beginPath();
    ctx.moveTo(noseX, noseY);
    ctx.bezierCurveTo(
      -L * 0.54,
      noseY - L * D * 1.08,
      -L * 0.12,
      midY - L * D * 1.18,
      peduncleX,
      peduncleY - L * 0.06
    );
    ctx.bezierCurveTo(
      peduncleX + (tailTipTopX - peduncleX) * 0.36,
      peduncleY - L * 0.22,
      tailTipTopX - L * 0.16,
      tailTipTopY - L * 0.08,
      tailTipTopX,
      tailTipTopY
    );
    ctx.quadraticCurveTo(tailForkX + L * 0.08, tailForkY - L * 0.05, tailForkX, tailForkY);
    ctx.quadraticCurveTo(tailTipBotX - L * 0.04, tailTipBotY - L * 0.05, tailTipBotX, tailTipBotY);
    ctx.bezierCurveTo(
      peduncleX + (tailTipBotX - peduncleX) * 0.48,
      tailTipBotY + L * 0.04,
      peduncleX + L * 0.12,
      peduncleY + L * 0.12,
      peduncleX,
      peduncleY + L * 0.05
    );
    ctx.bezierCurveTo(
      L * 0.05,
      midY + L * D * 0.96,
      -L * 0.48,
      noseY + L * D * 1.0,
      noseX,
      noseY
    );
    ctx.closePath();
    return;
  }
  if (part === 'dorsal') {
    const { start, ctrlTop, end, ctrlBot } = F.dorsal;
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.quadraticCurveTo(ctrlTop[0], ctrlTop[1], end[0], end[1]);
    ctx.quadraticCurveTo(ctrlBot[0], ctrlBot[1], start[0], start[1]);
    ctx.closePath();
    return;
  }
  if (part === 'pectoral') {
    const pL = L * P.pectoralLen;
    const pW = L * P.pectoralWidth;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(pL * 0.42, pW * 1.35, pL * 1.2, pW * 1.1, pL, pW * 0.25);
    ctx.quadraticCurveTo(pL * 0.5, -pW * 0.12, 0, 0);
    ctx.closePath();
    return;
  }
  if (part === 'gill') {
    const { cx, cy, r, a0, a1 } = F.gillArc;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    return;
  }
  if (part === 'lureStalk' && F.lure) {
    const { root, ctrl, tip } = F.lure;
    ctx.beginPath();
    ctx.moveTo(root[0], root[1]);
    ctx.quadraticCurveTo(ctrl[0], ctrl[1], tip[0], tip[1]);
  }
}

