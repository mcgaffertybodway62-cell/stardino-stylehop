/**
 * Paper Pop-Up Book · Rule-Based 3D Paper-Engineering, Kirigami & Origami Kernel (`styles/paper-popup/kernel.js`).
 *
 * Encapsulates the subject-agnostic, rule-based 3D paper-engineering medium laws of `paper-popup`
 * (ADR-008 / ADR-011 / ADR-012 / ADR-013 — De-Stickerized Generative Primitives):
 *   1. Die-Cut Cardstock, Washi & Gold-Foil Palette (`PAPER_PALETTE`)
 *   2. Non-Penetrating Pop-Up Fold, Accordion & Page-Curl Kinematics (`evalPaperFold`,
 *      `evalAccordionExpand`, `evalPageTurnTransition`, `evalOrigamiWingFlap`,
 *      `evalSpreadFoldEnvelope`, `applyBookPageTurn`)
 *   3. Procedural Washi Fiber Bump, Book-Spread Crease Grid & Radial Glow Textures
 *   4. Cardstock, Gold-Foil & Backlit Washi Material Factory + Die-Cut White Paper Rim (`addWhitePaperEdge`)
 *   5. Rule-Based 3D Paper-Engineering & Kirigami Generative Primitives:
 *      - `paperProfileFn(peaks, baseH, seed, rough, mode)` — 1D height contour generator (`mountain` | `wave` | `cloud` | `terraced`)
 *      - `createKirigamiCard(makeCardstockMat, opts)` — extruded contour card with negative-space kirigami cutouts (`shape.holes`)
 *      - `createVFoldMechanism(makeCardstockMat, opts)` — symmetric spine V-fold pop-up wings with kirigami cutouts
 *      - `createOrigamiCreaseMesh(makeCardstockMat, opts)` & `createOrigamiLotus(makeCardstockMat, opts)` — multi-ring crease-hinged blooming origami lotus
 *      - `createKirigamiMoonArch(makeCardstockMat, opts)` — openwork laser-cut crescent moon & celestial astrolabe arch
 *      - `createDieCutCard`, `createDieCutRidgeCard`, `createAccordionPleat`, `createPopupVFoldBuilding`, `createPaperGearWheel`
 *      - `createPopUpBookBase` — realistic tabletop 3D hardcover pop-up book with curving page leaf (`flippingPagePivot`)
 *   6. Set-Dressing & Crease-Folded Origami Fauna Builders (`buildPaperGround`, `buildPaperWater`, `buildPaperPath`,
 *      `createOrigamiCrane`, `createOrigamiButterfly`, `createOrigamiFox`, `createPaperBoat`, `createPaperPineTree`)
 *   7. Turnkey 3D Pop-Up Book Studio & Continuous Book-Stage Camera (`createPaperStudioStage`, `createPopupBookDirector`)
 *
 * Strict Rule: Zero Star-Spark Slime mascot, zero `engine/puppet.js` humanoid characters, and zero fixed
 * `world_05_paper` sticker props (`createOrigamiCloudBridge`, `createZoetropePavilion`, etc.) in `styles/paper-popup/`.
 */

import '../../engine/vendor/three.min.js';
import { clamp, lerp, smootherstep, flowStep, springStep } from '../../engine/motion.js';
import { LOOK_DEFAULTS, LOOK_PRESETS, resolveLook } from '../../engine/look.js';
import { createStudio3D } from '../../engine/studio3d.js';

export const THREE = globalThis.THREE;
export { clamp, lerp, smootherstep, flowStep, springStep };

// ============================================================================
// 1. PALETTE TOKENS (`PAPER_PALETTE`)
// ============================================================================

export const PAPER_PALETTE = {
  // Book Covers, Spine & Washi Grounds
  deskWood: '#3A2320',
  coverBurgundy: '#6E1F2A',
  coverDeep: '#4F131C',
  deckleCream: '#E5D6BA',
  pageCream: '#FCF6E8',
  pageWarm: '#F7EFE0',
  pageFoldShadow: '#D9C4A6',
  creaseWhite: '#FFFDF7',
  kraftTan: '#DAB990',
  charcoalInk: '#2B1D28',

  // Warm Amber, Coral, Crimson & Twilight Cardstock Layers
  canyonAmber: '#EE9F54',
  amberGold: '#F2AE5E',
  ridgeCoral: '#DE6E5B',
  coralOrange: '#DE6E5B',
  ridgeCrimson: '#C83E4B',
  plumRose: '#AC4666',
  twilightPlum: '#733466',
  mulberryViolet: '#5F2B5E',
  deepIndigo: '#3C2350',
  strataPlum: '#2D183E',

  // Jade, Celadon, Harbor & Sanctuary Cardstock Layers
  sunGold: '#F6BE65',
  jadeMint: '#8AD6C6',
  bambooGreen: '#5AA482',
  celadonTeal: '#4BA69C',
  jadeBlue: '#357E8C',
  sanctuarySlate: '#2C6876',
  jadeDark: '#22515E',
  abyssalBlue: '#284E78',
  harborNavy: '#1D3B62',

  // Festive, Gold-Foil & Origami Accents
  lanternRed: '#EB3832',
  cinnabarRed: '#E3423C',
  bridgeCrimson: '#C83E4B',
  lanternGold: '#FAD67D',
  foilGold: '#FACC75',
  origamiWhite: '#FFFDF6',
  origamiCream: '#FDF2DA',
  origamiPink: '#FAD4DC',
  origamiRose: '#F09AA8',
  origamiSky: '#C4E6FC',
  origamiBlue: '#78B6F0',
  origamiLavender: '#CBB8F2',
};

function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// 2. POP-UP ENGINEERING & ORIGAMI KINEMATICS
// ============================================================================

export function easeOutBack(x) {
  const t = clamp(x, 0.0, 1.0);
  const c1 = 1.52;
  const c3 = c1 + 1.0;
  return 1.0 + c3 * Math.pow(t - 1.0, 3) + c1 * Math.pow(t - 1.0, 2);
}

export function easeInOutCubic(x) {
  const t = clamp(x, 0.0, 1.0);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function quantizePaperTime(t, fps = 24, blend = 0.22) {
  const stepped = Math.floor(t * fps) / fps;
  return lerp(t, stepped, blend);
}

/**
 * Evaluates a non-penetrating pop-up cardstock layer unfolding from flat on the book page (`u = 0`)
 * to upright (`u = 1`) with staggered spring overshoot (`easeOutBack`).
 * Because `scaleY` collapses to `0.02` as `rotationX` tilts forward, folding cards NEVER poke below
 * the book page (`y < 0`) or collide with adjacent Z-layers.
 */
export function evalPaperFold(globalFold = 1.0, staggerIndex = 0, staggerStep = 0.05) {
  const raw = clamp((globalFold - staggerIndex * staggerStep) / Math.max(0.15, 1.0 - staggerIndex * staggerStep), 0, 1);
  const springVal = raw <= 0.001 ? 0 : easeOutBack(raw);
  const clamped = clamp(springVal, 0, 1);
  return {
    rotationX: (1.0 - clamped) * 1.42,
    scaleY: Math.max(0.02, springVal),
    liftY: (1.0 - clamped) * 0.04,
    progress: raw,
  };
}

/**
 * Evaluates concertina / accordion pleat expansion (`evalAccordionExpand`) from compressed
 * (`u = 0`) to expanded (`u = 1`) with spring elasticity.
 */
export function evalAccordionExpand(u = 1.0, folds = 6) {
  const p = clamp(u, 0.0, 1.0);
  const springVal = easeOutBack(p);
  const expandProgress = clamp(springVal, 0.04, 1.1);
  const pleatAngle = lerp(1.22, 0.42, clamp(springVal, 0.0, 1.05));
  const stepReach = expandProgress;
  const bounceY = Math.sin(p * Math.PI) * 0.05 * Math.min(2.0, folds * 0.2);
  return { expandProgress, pleatAngle, stepReach, bounceY };
}

/**
 * Evaluates a 3-stage 180° Pop-Up Book Page-Turn Transition:
 *   - `u in [0.00, 0.25]`: Outgoing pop-up spread finishes folding flat onto the book page
 *   - `u in [0.15, 0.82]`: Right-hand book page curls and flips 180° across the spine to the left page
 *   - `u in [0.58, 1.00]`: Incoming pop-up spread unfolds upright from the fresh spread
 */
export function evalPageTurnTransition(u = 0.0) {
  const p = clamp(u, 0, 1);
  const page1Fold = clamp(1.0 - p / 0.24, 0, 1);
  const flipU = clamp((p - 0.12) / 0.68, 0, 1);
  const flipAngle = easeInOutCubic(flipU) * Math.PI;
  const page2Fold = clamp((p - 0.54) / 0.46, 0, 1);
  return {
    activePage: flipAngle < Math.PI * 0.5 ? 1 : 2,
    page1Fold,
    page2Fold,
    flipAngle,
    flipU,
    flipping: flipU > 0.001 && flipU < 0.999,
  };
}

/**
 * Evaluates dual-joint origami bird/crane wing flapping, neck nod, and vertical thermal bob.
 */
export function evalOrigamiWingFlap(t, speed = 5.0, phase = 0.0) {
  const ph = t * speed + phase;
  const flap = Math.sin(ph) * 0.82 + Math.sin(ph * 2.0) * 0.14;
  const neckNod = Math.cos(ph - 0.4) * 0.07;
  const hoverY = -Math.cos(ph) * 0.12;
  return { flap, neckNod, hoverY };
}

export function evalContinuousHopChain(u, numHops = 5, jumpHeight = 0.75) {
  const t = clamp(u, 0.0, 1.0);
  const phase = t * numHops;
  const hopIdx = Math.min(numHops - 1, Math.floor(phase));
  const local = phase - hopIdx;
  const baseLinear = phase / numHops;
  const surge = (local - Math.sin(local * Math.PI * 2) / (Math.PI * 2)) / numHops;
  const progressX = clamp(lerp(baseLinear, (hopIdx + surge * numHops) / numHops, 0.35), 0.0, 1.0);
  const air = clamp((local - 0.12) / 0.88, 0, 1);
  const y = local < 0.12 ? 0 : Math.sin(air * Math.PI) * jumpHeight;
  return { y, squashY: 1.0, pitch: 0.0, progressX, hopIdx, local };
}

export function evalTargetedJump(u, startPos, endPos, arcHeight = 1.2) {
  const t = clamp(u, 0.0, 1.0);
  const pos = new THREE.Vector3().lerpVectors(startPos, endPos, smootherstep(0, 1, t));
  pos.y += Math.sin(t * Math.PI) * arcHeight;
  return { pos, squashY: 1.0, pitch: 0.0 };
}

// ============================================================================
// 3. PROCEDURAL PAPER TEXTURES & DIE-CUT MATERIAL FACTORY
// ============================================================================

let _glowTex = null;
let _pageGridTex = null;

export function createWashiPaperBumpTexture(size = 512, seed = 89) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 850; i++) {
    const x0 = rng() * size;
    const y0 = rng() * size;
    const len = 10 + rng() * 32;
    const ang = rng() * Math.PI * 2;
    ctx.strokeStyle = rng() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.8 + rng() * 1.3;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len);
    ctx.stroke();
  }

  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(rng() * size, rng() * size, 2, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

export function getRadialGlowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0.0, 'rgba(255, 248, 205, 0.92)');
  g.addColorStop(0.38, 'rgba(255, 190, 88, 0.42)');
  g.addColorStop(1.0, 'rgba(255, 120, 40, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

export function getBookPageTexture() {
  if (_pageGridTex) return _pageGridTex;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Warm cream open spread with subtle center spine shadow and decorative Double-Rule border
  const grad = ctx.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0.0, '#F8F0E0');
  grad.addColorStop(0.45, '#FCF6E8');
  grad.addColorStop(0.49, '#DECBB0');
  grad.addColorStop(0.5, '#B59B7E');
  grad.addColorStop(0.51, '#DECBB0');
  grad.addColorStop(0.55, '#FCF6E8');
  grad.addColorStop(1.0, '#F8F0E0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Subtle gold-ink book-margin frame on left and right pages
  ctx.strokeStyle = 'rgba(186, 152, 104, 0.36)';
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 26, 456, 460);
  ctx.strokeRect(540, 26, 456, 460);
  ctx.lineWidth = 1;
  ctx.strokeRect(36, 34, 440, 444);
  ctx.strokeRect(548, 34, 440, 444);

  // Faint paper-engineering fold-crease guides
  ctx.strokeStyle = 'rgba(175, 154, 126, 0.22)';
  ctx.lineWidth = 1.5;
  [0.25, 0.75].forEach((fx) => {
    ctx.beginPath();
    ctx.moveTo(fx * 1024, 26);
    ctx.lineTo(fx * 1024, 486);
    ctx.stroke();
  });

  _pageGridTex = new THREE.CanvasTexture(c);
  return _pageGridTex;
}

/**
 * Adds a crisp die-cut white paper rim (`THREE.EdgesGeometry` + `THREE.LineSegments`)
 * to any mesh so stacked cardstock layers and origami facets read with tactile cut-paper thickness.
 */
export function addWhitePaperEdge(mesh, opacity = 0.9, thresholdAngle = 12) {
  if (!mesh || !mesh.geometry) return null;
  const edgeGeo = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xfffdf7,
    transparent: opacity < 0.99,
    opacity,
  });
  const lines = new THREE.LineSegments(edgeGeo, edgeMat);
  mesh.add(lines);
  return lines;
}

/**
 * Factory for matte heavy cardstock, stamped gold-foil, and backlit translucent washi materials.
 */
export function createPaperMaterialFactory(paperBumpTex) {
  const matCache = new Map();

  function makeCardstockMat(hexColor, opts = {}) {
    const key = `${hexColor}_${opts.roughness ?? 0.78}_${opts.metalness ?? 0.03}_${opts.emissive ?? 0}_${opts.emissiveIntensity ?? 0}_${opts.flatShading ? 1 : 0}`;
    if (!opts.unique && matCache.has(key)) return matCache.get(key);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hexColor),
      roughness: opts.roughness ?? 0.78,
      metalness: opts.metalness ?? 0.03,
      bumpMap: paperBumpTex,
      bumpScale: opts.bumpScale ?? 0.015,
      flatShading: opts.flatShading ?? false,
      side: opts.side ?? THREE.DoubleSide,
    });
    if (opts.emissive) {
      mat.emissive = new THREE.Color(opts.emissive);
      mat.emissiveIntensity = opts.emissiveIntensity ?? 0.35;
    }
    if (!opts.unique) matCache.set(key, mat);
    return mat;
  }

  function makeGoldFoilMat(hexColor = PAPER_PALETTE.foilGold, opts = {}) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(hexColor),
      roughness: opts.roughness ?? 0.3,
      metalness: opts.metalness ?? 0.65,
      bumpMap: paperBumpTex,
      bumpScale: 0.008,
      emissive: new THREE.Color(hexColor),
      emissiveIntensity: opts.emissiveIntensity ?? 0.18,
      side: THREE.DoubleSide,
    });
  }

  function makeBacklitWashiMat(hexColor = PAPER_PALETTE.lanternGold, glowIntensity = 0.65) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(hexColor),
      roughness: 0.52,
      metalness: 0.02,
      bumpMap: paperBumpTex,
      bumpScale: 0.01,
      emissive: new THREE.Color(hexColor),
      emissiveIntensity: glowIntensity,
      side: THREE.DoubleSide,
    });
  }

  return { makeCardstockMat, makeGoldFoilMat, makeBacklitWashiMat, addWhitePaperEdge };
}

// ============================================================================
// 4. RULE-BASED 3D PAPER-ENGINEERING & KIRIGAMI GENERATIVE PRIMITIVES
//    (Analogous to `ink-wash/kernel.js` lines 3600–4159)
// ============================================================================

/**
 * Rule-based 1D paper-cut contour height generator (`paperProfileFn` — analogous to `ink-wash`'s `ridgeFn`).
 *
 * Evaluates a continuous silhouette height `y(x)` from an arbitrary array of `[peakX, height, spread]`
 * control peaks and a stylistic paper-cutting mode:
 *   - `'mountain'`: Smooth Gaussian peaks with subtle harmonic paper-cut modulation
 *   - `'wave'`: Rolling scalloped trochoidal wave crests
 *   - `'cloud'`: Billowy rounded paper-cut cloud lobes
 *   - `'terraced'`: Stepped quantized paper terrace levels
 */
export function paperProfileFn(peaks = [], baseH = 1.8, seed = 11, rough = 0.18, mode = 'mountain') {
  return (x) => {
    let env = 0;
    for (let i = 0; i < peaks.length; i++) {
      const [px, h, w = 2.5] = peaks[i];
      const d = Math.abs(x - px) / Math.max(0.25, w);
      env = Math.max(env, h * Math.exp(-Math.pow(d, 1.75)));
    }
    let mod = 0;
    if (mode === 'wave') {
      mod = Math.abs(Math.sin(x * 1.15 + seed * 0.7)) * rough + Math.cos(x * 0.55 - seed) * rough * 0.35;
    } else if (mode === 'cloud') {
      mod = Math.abs(Math.cos(x * 0.72 + seed * 0.5)) * rough * 1.35 + Math.abs(Math.sin(x * 1.45 + seed)) * rough * 0.45;
    } else {
      mod =
        Math.sin(x * 0.65 + seed * 1.3) * rough * 0.55 +
        Math.cos(x * 1.35 - seed * 0.7) * rough * 0.3;
    }
    const rawY = Math.max(0.22, baseH + env + mod);
    if (mode === 'terraced') {
      const stepH = Math.max(0.25, rough * 1.8);
      return Math.max(0.24, Math.round(rawY / stepH) * stepH);
    }
    return rawY;
  };
}

/**
 * Helper that builds a 2D cutout `THREE.Path` (`circle` | `arch` | `diamond` | `crescent` | `slit`)
 * to punch negative-space kirigami windows into any `THREE.Shape` (`shape.holes.push(...)`).
 */
export function buildKirigamiHolePath(cut) {
  const path = new THREE.Path();
  const cx = cut.x ?? 0;
  const cy = cut.y ?? 1.2;
  const kind = cut.kind || 'circle';

  if (kind === 'arch') {
    const w = cut.w ?? (cut.r ? cut.r * 1.6 : 0.9);
    const h = cut.h ?? (cut.r ? cut.r * 2.2 : 1.35);
    const hw = w * 0.5;
    const bodyH = Math.max(0.2, h - hw);
    path.moveTo(cx - hw, cy);
    path.lineTo(cx + hw, cy);
    path.lineTo(cx + hw, cy + bodyH);
    path.absarc(cx, cy + bodyH, hw, 0, Math.PI, false);
    path.lineTo(cx - hw, cy);
  } else if (kind === 'diamond') {
    const rx = cut.rx ?? cut.r ?? 0.45;
    const ry = cut.ry ?? (cut.r ? cut.r * 1.35 : 0.62);
    path.moveTo(cx, cy + ry);
    path.lineTo(cx - rx, cy);
    path.lineTo(cx, cy - ry);
    path.lineTo(cx + rx, cy);
    path.closePath();
  } else if (kind === 'slit') {
    const hw = (cut.w ?? 0.22) * 0.5;
    const hh = (cut.h ?? 1.1) * 0.5;
    path.moveTo(cx - hw, cy - hh);
    path.lineTo(cx + hw, cy - hh);
    path.lineTo(cx + hw, cy + hh);
    path.lineTo(cx - hw, cy + hh);
    path.closePath();
  } else {
    const r = cut.r ?? 0.55;
    path.absarc(cx, cy, r, 0, Math.PI * 2, true);
  }
  return path;
}

/**
 * Rule-based Kirigami Die-Cut Contour & Negative-Space Window Card (`createKirigamiCard`).
 *
 * Extrudes any 1D contour (`profileFn` or `peaks` + `mode`) into a 3D cardstock layer with crisp
 * white paper edges (`addWhitePaperEdge`), punches hollow kirigami cutouts (`cutouts`) into `shape.holes`
 * so light and deeper layers shine through, and hinges the card at `y = 0` with non-penetrating `setFold(u)`.
 */
export function createKirigamiCard(makeCardstockMat, opts = {}) {
  const {
    width = 16.4,
    steps = 56,
    profileFn = null,
    peaks = [
      [-5.2, 1.4, 2.8],
      [4.8, 1.6, 3.0],
    ],
    baseHeight = 1.65,
    seed = 17,
    rough = 0.18,
    mode = 'mountain',
    cutouts = [],
    thickness = 0.09,
    color = PAPER_PALETTE.celadonTeal,
    rimColor = null,
    edgeAlpha = 0.94,
    x = 0.0,
    y = 0.45,
    z = 0.0,
  } = opts;

  const group = new THREE.Group();
  group.name = 'KirigamiCard';
  group.position.set(x, y, z);

  const foldPivot = new THREE.Group();
  group.add(foldPivot);

  const fn = typeof profileFn === 'function' ? profileFn : paperProfileFn(peaks, baseHeight, seed, rough, mode);
  const hw = width * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  for (let i = 0; i <= steps; i++) {
    const x = -hw + (width * i) / steps;
    // Taper gently at the left and right ends so the card sits cleanly inside the book margins
    const edgeTaper = smoothEdgeTaper(i / steps);
    const h = Math.max(0.18, fn(x) * edgeTaper);
    shape.lineTo(x, h);
  }
  shape.lineTo(hw, 0);
  shape.closePath();

  for (const cut of cutouts) {
    shape.holes.push(buildKirigamiHolePath(cut));
  }

  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 20 });
  geo.translate(0, 0, -thickness * 0.5);
  const mesh = new THREE.Mesh(geo, makeCardstockMat(color, { roughness: 0.76 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addWhitePaperEdge(mesh, edgeAlpha, 10);
  foldPivot.add(mesh);

  // Optional decorative accent rings around circular/arch cutouts
  if (rimColor) {
    const rimMat = makeCardstockMat(rimColor, { roughness: 0.48 });
    for (const cut of cutouts) {
      if ((cut.kind || 'circle') === 'circle' && cut.r) {
        const ringGeo = new THREE.RingGeometry(cut.r * 1.0, cut.r * 1.14, 28);
        const ringMesh = new THREE.Mesh(ringGeo, rimMat);
        ringMesh.position.set(cut.x ?? 0, cut.y ?? 1.2, thickness * 0.56);
        foldPivot.add(ringMesh);
      }
    }
  }

  function setFold(progress = 1.0, staggerIdx = 0) {
    const f = evalPaperFold(progress, staggerIdx);
    foldPivot.rotation.x = f.rotationX;
    foldPivot.scale.y = f.scaleY;
    foldPivot.position.y = f.liftY;
  }

  group.group = group;
  group.pivot = group;
  group.foldPivot = foldPivot;
  group.setFold = setFold;
  group.heightAt = (x) => fn(x);
  group.userData = { foldPivot, setFold };
  return group;
}

function smoothEdgeTaper(u) {
  const d = Math.min(u, 1 - u);
  if (d >= 0.08) return 1.0;
  const t = clamp(d / 0.08, 0, 1);
  return 0.35 + 0.65 * (t * t * (3 - 2 * t));
}

/**
 * Rule-based Symmetric Spine V-Fold Pop-Up Mechanism (`createVFoldMechanism`).
 *
 * Constructs two symmetric angled cardstock wings (`leftWing`, `rightWing`) hinged at the book's
 * central spine (`x = 0`) that fold flat and inward when the spread closes (`u = 0`) and pop out
 * into a 3D V-prow / canyon / water-gate when the spread opens (`u = 1`).
 */
export function createVFoldMechanism(makeCardstockMat, opts = {}) {
  const {
    wingSpan = 5.8,
    height = 2.2,
    spineAngle = 0.28,
    peaks = [
      [2.6, 0.85, 1.8],
      [4.4, 0.45, 1.4],
    ],
    cutouts = [],
    thickness = 0.09,
    color = PAPER_PALETTE.ridgeCoral,
    accentColor = PAPER_PALETTE.pageWarm,
    y = 0.45,
    z = 0.0,
  } = opts;

  const group = new THREE.Group();
  group.name = 'VFoldMechanism';
  group.position.set(0, y, z);

  const leftHinge = new THREE.Group();
  const rightHinge = new THREE.Group();
  group.add(leftHinge, rightHinge);

  const fn = paperProfileFn(peaks, height * 0.62, 29, 0.14, 'mountain');
  const steps = 28;

  function buildWingMesh(sign, matColor) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    // Low near the center spine so a clear valley channel opens down the middle
    shape.lineTo(0, height * 0.32);
    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      const d = u * wingSpan;
      const taper = u > 0.88 ? lerp(1.0, 0.42, (u - 0.88) / 0.12) : 1.0;
      const h = Math.max(0.24, fn(d) * taper);
      shape.lineTo(sign * d, h);
    }
    shape.lineTo(sign * wingSpan, 0);
    shape.closePath();

    for (const cut of cutouts) {
      shape.holes.push(
        buildKirigamiHolePath({
          ...cut,
          x: sign * Math.abs(cut.x ?? wingSpan * 0.46),
        })
      );
    }

    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geo.translate(0, 0, -thickness * 0.5);
    const mesh = new THREE.Mesh(geo, makeCardstockMat(matColor, { roughness: 0.74 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addWhitePaperEdge(mesh, 0.94, 10);
    return mesh;
  }

  leftHinge.add(buildWingMesh(-1, color));
  rightHinge.add(buildWingMesh(1, accentColor || color));

  function setFold(progress = 1.0, staggerIdx = 0) {
    const f = evalPaperFold(progress, staggerIdx);
    const openU = clamp(f.progress, 0, 1);
    leftHinge.rotation.x = f.rotationX;
    rightHinge.rotation.x = f.rotationX;
    leftHinge.rotation.y = spineAngle * openU;
    rightHinge.rotation.y = -spineAngle * openU;
    leftHinge.scale.y = f.scaleY;
    rightHinge.scale.y = f.scaleY;
    leftHinge.position.y = f.liftY;
    rightHinge.position.y = f.liftY;
  }

  setFold(1.0, 0);

  group.group = group;
  group.pivot = group;
  group.setFold = setFold;
  group.userData = { leftHinge, rightHinge, setFold };
  return group;
}

/**
 * Rule-based Radial Crease-Hinged Origami Mesh / Blooming Lotus (`createOrigamiCreaseMesh` & `createOrigamiLotus`).
 *
 * Generates concentric rings of flat-shaded triangular origami petals hinged around an octagonal
 * die-cut paper lily-pad base (`lilyPad`) and a golden origami stamen crown.
 *   - `setBloom(u)`: Smoothly unfolds each ring of petals from closed bud (`u = 0`) to open flower (`u = 1`).
 *   - `setFold(u)`: Smoothly folds the entire lotus flat onto the book page when the spread closes.
 */
export function createOrigamiCreaseMesh(makeCardstockMat, opts = {}) {
  const {
    petals = 8,
    layers = 3,
    radius = 1.65,
    height = 1.15,
    outerColor = PAPER_PALETTE.origamiRose,
    midColor = PAPER_PALETTE.origamiPink,
    innerColor = PAPER_PALETTE.origamiWhite,
    coreColor = PAPER_PALETTE.foilGold,
    padColor = PAPER_PALETTE.bambooGreen,
    padRadius = 2.1,
  } = opts;

  const group = new THREE.Group();
  group.name = 'OrigamiCreaseLotus';

  const foldPivot = new THREE.Group();
  group.add(foldPivot);

  // 1. Octagonal die-cut paper lily-pad with V-notch cutout
  if (padRadius > 0) {
    const padShape = new THREE.Shape();
    const sides = 10;
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 1.88 + 0.06;
      const r = padRadius * (i % 2 === 0 ? 1.0 : 0.94);
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) padShape.moveTo(0, 0);
      padShape.lineTo(px, py);
    }
    padShape.closePath();
    const padGeo = new THREE.ExtrudeGeometry(padShape, { depth: 0.06, bevelEnabled: false });
    padGeo.rotateX(-Math.PI / 2);
    const padMesh = new THREE.Mesh(padGeo, makeCardstockMat(padColor, { roughness: 0.76 }));
    padMesh.receiveShadow = true;
    addWhitePaperEdge(padMesh, 0.92, 12);
    foldPivot.add(padMesh);
  }

  // 2. Concentric rings of 4-facet crease-folded origami petals
  const ringColors = [outerColor, midColor, innerColor];
  const petalPivots = [];

  function buildCreasedPetalMesh(len, wid, archH, colHex) {
    const w = wid * 0.5;
    const midZ = len * 0.52;
    const ridgeH = archH;
    const sideH = archH * 0.38;

    // 4 triangles meeting along a raised central valley/mountain crease line `(0,0,0) -> (0,ridgeH,midZ) -> (0,ridgeH*0.65,len)`
    const pBase = [0, 0, 0];
    const pMidC = [0, ridgeH, midZ];
    const pTip = [0, ridgeH * 0.72, len];
    const pMidL = [-w, sideH, midZ * 0.92];
    const pMidR = [w, sideH, midZ * 0.92];

    const pos = new Float32Array([
      // Left lower facet
      ...pBase, ...pMidL, ...pMidC,
      // Right lower facet
      ...pBase, ...pMidC, ...pMidR,
      // Left upper tip facet
      ...pMidL, ...pTip, ...pMidC,
      // Right upper tip facet
      ...pMidC, ...pTip, ...pMidR,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, makeCardstockMat(colHex, { roughness: 0.68, flatShading: true }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addWhitePaperEdge(mesh, 0.95, 1);
    return mesh;
  }

  for (let ring = 0; ring < layers; ring++) {
    const ringFrac = ring / Math.max(1, layers - 1);
    const pLen = radius * lerp(1.0, 0.62, ringFrac);
    const pWid = radius * lerp(0.56, 0.38, ringFrac);
    const pArch = height * lerp(0.32, 0.48, ringFrac);
    const col = ringColors[ring % ringColors.length];
    const ringR = lerp(0.26, 0.12, ringFrac) * radius;

    for (let k = 0; k < petals; k++) {
      const yaw = ((k + (ring % 2) * 0.5) / petals) * Math.PI * 2;
      const anchor = new THREE.Group();
      anchor.rotation.y = yaw;

      const hinge = new THREE.Group();
      hinge.position.set(0, 0.07 + ring * 0.04, ringR);
      hinge.add(buildCreasedPetalMesh(pLen, pWid, pArch, col));
      anchor.add(hinge);
      foldPivot.add(anchor);

      petalPivots.push({
        hinge,
        ring,
        closedPitch: -1.18 + ring * 0.08,
        openPitch: -0.18 - ring * 0.28,
      });
    }
  }

  // 3. Central faceted golden origami stamen crown
  const coreGeo = new THREE.ConeGeometry(radius * 0.22, height * 0.42, 8);
  coreGeo.translate(0, height * 0.21 + 0.06, 0);
  const coreMesh = new THREE.Mesh(
    coreGeo,
    makeCardstockMat(coreColor, {
      roughness: 0.45,
      emissive: coreColor,
      emissiveIntensity: 0.32,
      flatShading: true,
    })
  );
  addWhitePaperEdge(coreMesh, 0.95, 4);
  foldPivot.add(coreMesh);

  let currentBloom = 1.0;

  function setBloom(bloomU = 1.0) {
    currentBloom = clamp(bloomU, 0, 1);
    for (const item of petalPivots) {
      const ringDelay = item.ring * 0.16;
      const localU = clamp((currentBloom - ringDelay) / Math.max(0.2, 1.0 - ringDelay), 0, 1);
      const eased = easeOutBack(localU);
      item.hinge.rotation.x = lerp(item.closedPitch, item.openPitch, eased);
    }
    const coreScale = lerp(0.45, 1.0, smootherstep(0.2, 0.95, currentBloom));
    coreMesh.scale.set(coreScale, coreScale, coreScale);
  }

  function setFold(foldU = 1.0, staggerIdx = 0) {
    const f = evalPaperFold(foldU, staggerIdx);
    foldPivot.scale.set(1.0, Math.max(0.03, f.scaleY), 1.0);
    foldPivot.position.y = f.liftY;
  }

  setBloom(1.0);

  group.group = group;
  group.pivot = group;
  group.setBloom = setBloom;
  group.setFold = setFold;
  group.userData = { foldPivot, setBloom, setFold };
  return group;
}

export const createOrigamiLotus = createOrigamiCreaseMesh;

/**
 * Rule-based Openwork Kirigami Crescent Moon & Concentric Star-Ring Arch (`createKirigamiMoonArch`).
 *
 * Builds a sculptural laser-cut cardstock arch with clean gold-foil rim accents,
 * cradling a backlit-washi 3D crescent moon, a clean dark-indigo night sky aperture behind it,
 * and a suspended faceted gold-foil star at the focal center.
 */
export function createKirigamiMoonArch(makeCardstockMat, opts = {}) {
  const {
    outerR = 2.85,
    innerR = 1.92,
    thickness = 0.11,
    archColor = PAPER_PALETTE.pageWarm,
    moonColor = PAPER_PALETTE.lanternGold,
    foilColor = PAPER_PALETTE.foilGold,
    accentColor = PAPER_PALETTE.celadonTeal,
    skyColor = PAPER_PALETTE.deepIndigo,
    y = 0.45,
    z = -1.5,
  } = opts;

  const group = new THREE.Group();
  group.name = 'KirigamiMoonArch';
  group.position.set(0, y, z);

  const foldPivot = new THREE.Group();
  group.add(foldPivot);

  const baseW = outerR * 1.15;
  const centerH = outerR * 0.78;
  const segs = 48;

  // 0. Clean Dark-Indigo Night Sky Aperture Disc behind the arch so the glowing crescent moon & star pop with crisp contrast
  const skyShape = new THREE.Shape();
  skyShape.moveTo(-innerR * 1.02, 0);
  for (let i = 0; i <= segs; i++) {
    const a = Math.PI - (i / segs) * Math.PI;
    skyShape.lineTo(Math.cos(a) * innerR * 1.02, centerH + Math.sin(a) * innerR * 1.02);
  }
  skyShape.lineTo(innerR * 1.02, 0);
  skyShape.closePath();

  const skyGeo = new THREE.ExtrudeGeometry(skyShape, { depth: 0.05, bevelEnabled: false, curveSegments: 32 });
  skyGeo.translate(0, 0, -thickness * 1.35);
  const skyMesh = new THREE.Mesh(skyGeo, makeCardstockMat(skyColor, { roughness: 0.82 }));
  skyMesh.receiveShadow = true;
  addWhitePaperEdge(skyMesh, 0.85, 12);
  foldPivot.add(skyMesh);

  // 1. Sculptural Scalloped Kirigami Outer Arch + Stepped Gold-Foil Inner Filigree Ring (no Swiss-cheese holes)
  const archShape = new THREE.Shape();
  archShape.moveTo(-baseW, 0);
  archShape.lineTo(-outerR, centerH * 0.32);
  for (let i = 0; i <= segs; i++) {
    const a = Math.PI - (i / segs) * Math.PI;
    const scallop = 1.0 + Math.sin(i * Math.PI * 0.5) * 0.022;
    archShape.lineTo(Math.cos(a) * outerR * scallop, centerH + Math.sin(a) * outerR * scallop);
  }
  archShape.lineTo(baseW, 0);
  archShape.lineTo(innerR, 0);
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI;
    archShape.lineTo(Math.cos(a) * innerR, centerH + Math.sin(a) * innerR);
  }
  archShape.lineTo(-innerR, 0);
  archShape.closePath();

  const archGeo = new THREE.ExtrudeGeometry(archShape, { depth: thickness, bevelEnabled: false, curveSegments: 32 });
  archGeo.translate(0, 0, -thickness * 0.5);
  const archMesh = new THREE.Mesh(archGeo, makeCardstockMat(archColor, { roughness: 0.72 }));
  archMesh.castShadow = true;
  archMesh.receiveShadow = true;
  addWhitePaperEdge(archMesh, 0.95, 10);
  foldPivot.add(archMesh);

  // Concentric Gold-Foil Inner Trim Arch
  const foilOuterR = innerR * 1.12;
  const foilInnerR = innerR * 0.98;
  const foilShape = new THREE.Shape();
  foilShape.moveTo(-foilOuterR, 0);
  for (let i = 0; i <= segs; i++) {
    const a = Math.PI - (i / segs) * Math.PI;
    foilShape.lineTo(Math.cos(a) * foilOuterR, centerH + Math.sin(a) * foilOuterR);
  }
  foilShape.lineTo(foilInnerR, 0);
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI;
    foilShape.lineTo(Math.cos(a) * foilInnerR, centerH + Math.sin(a) * foilInnerR);
  }
  foilShape.closePath();
  const foilGeo = new THREE.ExtrudeGeometry(foilShape, { depth: thickness * 1.18, bevelEnabled: false, curveSegments: 32 });
  foilGeo.translate(0, 0, -thickness * 0.59);
  const foilMesh = new THREE.Mesh(
    foilGeo,
    makeCardstockMat(foilColor, {
      roughness: 0.36,
      metalness: 0.45,
      emissive: foilColor,
      emissiveIntensity: 0.22,
    })
  );
  addWhitePaperEdge(foilMesh, 0.95, 10);
  foldPivot.add(foilMesh);

  // 2. Sculpted 3D Kirigami Crescent Moon nestled inside the arch (intersection of two clean circular arcs)
  const moonShape = new THREE.Shape();
  const r1 = innerR * 0.84;
  const r2 = innerR * 0.72;
  const d = innerR * 0.36;
  const xInt = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const yInt = Math.sqrt(Math.max(0.001, r1 * r1 - xInt * xInt));
  const ang1 = Math.atan2(yInt, xInt);
  const ang2 = Math.atan2(yInt, xInt - d);
  const shiftX = -innerR * 0.1;

  for (let i = 0; i <= 44; i++) {
    const a = -ang1 + (i / 44) * (ang1 * 2);
    const px = Math.cos(a) * r1 + shiftX;
    const py = Math.sin(a) * r1;
    if (i === 0) moonShape.moveTo(px, py);
    else moonShape.lineTo(px, py);
  }
  for (let i = 44; i >= 0; i--) {
    const a = -ang2 + (i / 44) * (ang2 * 2);
    const px = -d + Math.cos(a) * r2 + shiftX;
    const py = Math.sin(a) * r2;
    moonShape.lineTo(px, py);
  }
  moonShape.closePath();

  const moonGeo = new THREE.ExtrudeGeometry(moonShape, { depth: thickness * 1.25, bevelEnabled: false });
  moonGeo.translate(0, 0, -thickness * 0.62);
  const moonMat = makeCardstockMat(moonColor, {
    roughness: 0.42,
    emissive: moonColor,
    emissiveIntensity: 0.46,
    unique: true,
  });
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.position.set(0, centerH + 0.08, 0.08);
  moonMesh.castShadow = true;
  addWhitePaperEdge(moonMesh, 0.96, 10);
  foldPivot.add(moonMesh);

  // 3. Suspended Faceted 8-Point Gold-Foil Origami Star at the focal center of the crescent hollow
  const starPivot = new THREE.Group();
  starPivot.position.set(-0.26, centerH + 0.14, 0.08);
  foldPivot.add(starPivot);

  const starShape = new THREE.Shape();
  const points = 8;
  const rOut = innerR * 0.28;
  const rIn = innerR * 0.11;
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI * 0.5;
    const r = i % 2 === 0 ? rOut : rIn;
    const sx = Math.cos(a) * r;
    const sy = Math.sin(a) * r;
    if (i === 0) starShape.moveTo(sx, sy);
    else starShape.lineTo(sx, sy);
  }
  starShape.closePath();

  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: thickness * 0.9, bevelEnabled: false });
  starGeo.translate(0, 0, -thickness * 0.45);
  const starMesh = new THREE.Mesh(
    starGeo,
    makeCardstockMat(foilColor, {
      roughness: 0.34,
      metalness: 0.52,
      emissive: foilColor,
      emissiveIntensity: 0.38,
      flatShading: true,
    })
  );
  addWhitePaperEdge(starMesh, 0.96, 4);
  starPivot.add(starMesh);

  const coreGemGeo = new THREE.OctahedronGeometry(innerR * 0.075, 0);
  const coreGemMesh = new THREE.Mesh(
    coreGemGeo,
    makeCardstockMat(accentColor, { roughness: 0.42, flatShading: true })
  );
  addWhitePaperEdge(coreGemMesh, 0.95, 2);
  starPivot.add(coreGemMesh);

  // Soft warm glow sprite behind the crescent moon
  const glowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getRadialGlowTexture(),
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.55,
    })
  );
  glowSprite.position.set(0, centerH, -0.05);
  glowSprite.scale.set(outerR * 2.1, outerR * 2.1, 1);
  foldPivot.add(glowSprite);

  function update(t = 0, glowLevel = 0.6) {
    starPivot.rotation.z = t * 0.45;
    moonMesh.rotation.z = Math.sin(t * 1.4) * 0.035;
    moonMat.emissiveIntensity = 0.32 + glowLevel * 0.52;
    glowSprite.material.opacity = 0.28 + glowLevel * 0.52;
  }

  function setFold(foldU = 1.0, staggerIdx = 0) {
    const f = evalPaperFold(foldU, staggerIdx);
    foldPivot.rotation.x = f.rotationX;
    foldPivot.scale.y = f.scaleY;
    foldPivot.position.y = f.liftY;
  }

  group.group = group;
  group.pivot = group;
  group.update = update;
  group.setFold = setFold;
  group.userData = { foldPivot, update, setFold };
  return group;
}

// ============================================================================
// 5. ADDITIONAL COMPOSABLE PAPER-ENGINEERING & BOOK-BASE PRIMITIVES
// ============================================================================

export function createDieCutCard(makeCardstockMat, opts = {}) {
  const {
    points = [
      [-1.5, 0],
      [-1.5, 2.0],
      [0, 2.8],
      [1.5, 2.0],
      [1.5, 0],
    ],
    holes = [],
    thickness = 0.09,
    color = PAPER_PALETTE.canyonAmber,
    edgeOpacity = 0.94,
    roughness = 0.78,
    emissive = null,
    emissiveIntensity = 0.25,
  } = opts;

  const group = new THREE.Group();
  group.name = 'DieCutCard';

  const foldPivot = new THREE.Group();
  group.add(foldPivot);

  const shape = new THREE.Shape();
  points.forEach(([x, y], idx) => {
    if (idx === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();

  for (const hPts of holes) {
    if (Array.isArray(hPts) && hPts.length >= 3) {
      const path = new THREE.Path();
      hPts.forEach(([hx, hy], idx) => {
        if (idx === 0) path.moveTo(hx, hy);
        else path.lineTo(hx, hy);
      });
      path.closePath();
      shape.holes.push(path);
    } else if (hPts && typeof hPts === 'object') {
      shape.holes.push(buildKirigamiHolePath(hPts));
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geo.translate(0, 0, -thickness * 0.5);
  const mat = makeCardstockMat(color, { roughness, emissive, emissiveIntensity });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addWhitePaperEdge(mesh, edgeOpacity, 10);
  foldPivot.add(mesh);

  function setFold(progress = 1.0, staggerIdx = 0) {
    const f = evalPaperFold(progress, staggerIdx);
    foldPivot.rotation.x = f.rotationX;
    foldPivot.scale.y = f.scaleY;
    foldPivot.position.y = f.liftY;
  }

  group.group = group;
  group.pivot = group;
  group.foldPivot = foldPivot;
  group.mesh = mesh;
  group.setFold = setFold;
  group.userData = { foldPivot, mesh, setFold };
  return group;
}

export function createDieCutRidgeCard(makeCardstockMat, opts = {}) {
  return createKirigamiCard(makeCardstockMat, opts);
}

export function createAccordionPleat(makeCardstockMat, opts = {}) {
  const {
    segments = 6,
    segWidth = 0.65,
    segHeight = 1.9,
    thickness = 0.06,
    color = PAPER_PALETTE.pageWarm,
    altColor = PAPER_PALETTE.lanternGold,
    direction = 'horizontal',
  } = opts;

  const group = new THREE.Group();
  group.name = 'AccordionPleat';

  const foldPivot = new THREE.Group();
  group.add(foldPivot);

  const matEven = makeCardstockMat(color, { roughness: 0.76 });
  const matOdd = makeCardstockMat(altColor || color, { roughness: 0.74 });
  const panels = [];

  for (let i = 0; i < segments; i++) {
    const pGeo =
      direction === 'vertical'
        ? new THREE.BoxGeometry(segHeight, segWidth, thickness)
        : new THREE.BoxGeometry(segWidth, segHeight, thickness);
    if (direction === 'vertical') {
      pGeo.translate(0, segWidth * 0.5, 0);
    } else {
      pGeo.translate(segWidth * 0.5, segHeight * 0.5, 0);
    }
    const mesh = new THREE.Mesh(pGeo, i % 2 === 0 ? matEven : matOdd);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addWhitePaperEdge(mesh, 0.92, 8);

    const segPivot = new THREE.Group();
    segPivot.add(mesh);
    foldPivot.add(segPivot);
    panels.push({ pivot: segPivot, index: i });
  }

  function setFold(u = 1.0) {
    const { pleatAngle, stepReach } = evalAccordionExpand(u, segments);
    let curX = 0;
    let curY = 0;
    let curZ = 0;
    for (let i = 0; i < panels.length; i++) {
      const sign = i % 2 === 0 ? 1 : -1;
      const p = panels[i].pivot;
      p.position.set(curX, curY, curZ);
      if (direction === 'vertical') {
        p.rotation.set(sign * pleatAngle, 0, 0);
        curY += Math.cos(pleatAngle) * segWidth * stepReach;
        curZ += Math.sin(sign * pleatAngle) * segWidth;
      } else {
        p.rotation.set(0, sign * pleatAngle, 0);
        curX += Math.cos(pleatAngle) * segWidth * stepReach;
        curZ -= Math.sin(sign * pleatAngle) * segWidth;
      }
    }
  }

  setFold(1.0);

  group.group = group;
  group.pivot = group;
  group.setFold = setFold;
  group.userData = { panels, setFold };
  return group;
}

export function createPopupVFoldBuilding(makeCardstockMat, opts = {}) {
  const {
    width = 2.8,
    height = 2.9,
    depth = 1.8,
    tiers = 2,
    wallColor = PAPER_PALETTE.pageWarm,
    roofColor = PAPER_PALETTE.bridgeCrimson,
    trimColor = PAPER_PALETTE.lanternGold,
    hasClock = false,
  } = opts;

  const group = new THREE.Group();
  group.name = 'PopupVFoldBuilding';
  const foldPivot = new THREE.Group();
  group.add(foldPivot);

  const wallMat = makeCardstockMat(wallColor, { roughness: 0.78 });
  const roofMat = makeCardstockMat(roofColor, { roughness: 0.68 });
  const trimMat = makeCardstockMat(trimColor, { roughness: 0.45 });
  const tierH = height / Math.max(1, tiers);

  for (let t = 0; t < tiers; t++) {
    const s = 1 - t * 0.22;
    const tw = width * s;
    const td = depth * s;
    const y0 = t * tierH * 0.88;
    const boxGeo = new THREE.BoxGeometry(tw, tierH, td);
    boxGeo.translate(0, y0 + tierH * 0.5, 0);
    const boxMesh = new THREE.Mesh(boxGeo, wallMat);
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    addWhitePaperEdge(boxMesh, 0.92, 12);
    foldPivot.add(boxMesh);

    const roofGeo = new THREE.ConeGeometry(Math.hypot(tw, td) * 0.64, tierH * 0.42, 4);
    roofGeo.rotateY(Math.PI / 4);
    roofGeo.translate(0, y0 + tierH + tierH * 0.2, 0);
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.castShadow = true;
    addWhitePaperEdge(roofMesh, 0.95, 8);
    foldPivot.add(roofMesh);
  }

  const clockHands = new THREE.Group();
  if (hasClock) {
    foldPivot.add(clockHands);
  }

  function setFold(progress = 1.0, staggerIdx = 0) {
    const f = evalPaperFold(progress, staggerIdx);
    foldPivot.rotation.x = f.rotationX;
    foldPivot.scale.y = f.scaleY;
    foldPivot.position.y = f.liftY;
  }

  group.group = group;
  group.pivot = group;
  group.clockHands = clockHands;
  group.setFold = setFold;
  group.userData = { foldPivot, clockHands, setFold };
  return group;
}

/**
 * Die-cut cardstock & gold-foil mechanical gear / astrolabe wheel (`createPaperGearWheel`).
 */
export function createPaperGearWheel(makeCardstockMat, opts = {}) {
  const {
    radius = 1.0,
    teeth = 12,
    thickness = 0.08,
    color = PAPER_PALETTE.foilGold,
    rimColor = PAPER_PALETTE.bridgeCrimson,
    innerCutouts = true,
  } = opts;

  const group = new THREE.Group();
  group.name = 'PaperGearWheel';

  const outerR = radius;
  const rootR = radius * 0.82;
  const shape = new THREE.Shape();
  const n = Math.max(6, teeth);

  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const step = (Math.PI * 2) / n;
    const pts = [
      [Math.cos(a0) * rootR, Math.sin(a0) * rootR],
      [Math.cos(a0 + step * 0.16) * outerR, Math.sin(a0 + step * 0.16) * outerR],
      [Math.cos(a0 + step * 0.46) * outerR, Math.sin(a0 + step * 0.46) * outerR],
      [Math.cos(a0 + step * 0.62) * rootR, Math.sin(a0 + step * 0.62) * rootR],
    ];
    if (i === 0) shape.moveTo(pts[0][0], pts[0][1]);
    else shape.lineTo(pts[0][0], pts[0][1]);
    shape.lineTo(pts[1][0], pts[1][1]);
    shape.lineTo(pts[2][0], pts[2][1]);
    shape.lineTo(pts[3][0], pts[3][1]);
  }
  shape.closePath();

  if (innerCutouts && radius > 0.42) {
    const holeCount = 6;
    const rIn = radius * 0.28;
    const rOut = radius * 0.6;
    for (let k = 0; k < holeCount; k++) {
      const a0 = (k / holeCount) * Math.PI * 2 + 0.12;
      const a1 = ((k + 0.64) / holeCount) * Math.PI * 2 - 0.12;
      const path = new THREE.Path();
      path.moveTo(Math.cos(a0) * rIn, Math.sin(a0) * rIn);
      path.lineTo(Math.cos(a0) * rOut, Math.sin(a0) * rOut);
      path.absarc(0, 0, rOut, a0, a1, false);
      path.lineTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
      path.absarc(0, 0, rIn, a1, a0, true);
      shape.holes.push(path);
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geo.translate(0, 0, -thickness * 0.5);
  const mesh = new THREE.Mesh(geo, makeCardstockMat(color, { roughness: 0.46, metalness: 0.28 }));
  mesh.castShadow = true;
  addWhitePaperEdge(mesh, 0.94, 12);
  group.add(mesh);

  const hubGeo = new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, thickness * 1.45, 16);
  hubGeo.rotateX(Math.PI / 2);
  const hubMesh = new THREE.Mesh(hubGeo, makeCardstockMat(rimColor, { roughness: 0.55 }));
  addWhitePaperEdge(hubMesh, 0.92, 12);
  group.add(hubMesh);

  group.group = group;
  group.pivot = group;
  return group;
}

/**
 * Sculptural Tabletop 3D Pop-Up Book Base (`createPopUpBookBase`):
 *
 * Builds an authentic open hardcover pop-up book lying flat on the studio tabletop (ZERO giant vertical
 * back wall so the viewer immediately sees the open book, burgundy cloth cover, gold-foil corner plates,
 * stepped cream deckle page stack, and central spine gutter).
 *
 * Includes a realistic curving right-to-left turning page (`flippingPagePivot`, width `pageW = coverWidth * 0.475`)
 * that remains continuously visible on the book surface (zero 1-frame visibility pop) and bends with a
 * parabolic paper-curl arch during `setPageTurn(turnProgress, activeSpreadIdx, foldProgress, nextSpreadIdx)`.
 */
export function createPopUpBookBase(makeCardstockMat, options = {}) {
  const {
    coverWidth = 15.6,
    coverDepth = 9.0,
    spreadCount = 2,
    coverColor = PAPER_PALETTE.coverBurgundy,
    pageColor = PAPER_PALETTE.pageCream,
  } = options;

  const stage = new THREE.Group();
  stage.name = 'TabletopPopUpBookBase';

  const coverMat = makeCardstockMat(coverColor, { roughness: 0.72 });
  const spineMat = makeCardstockMat(PAPER_PALETTE.coverDeep, { roughness: 0.7 });
  const foilMat = makeCardstockMat(PAPER_PALETTE.foilGold, {
    roughness: 0.32,
    metalness: 0.58,
    emissive: PAPER_PALETTE.foilGold,
    emissiveIntensity: 0.16,
  });
  const deckleMat = makeCardstockMat(PAPER_PALETTE.deckleCream, { roughness: 0.82 });
  const pageMat = makeCardstockMat(pageColor, { roughness: 0.78 });

  // 1. Burgundy Cloth Hardcover Base Board + Central Spine Clasp + Gold-Foil Corner Plates
  const boardW = coverWidth + 1.2;
  const boardD = coverDepth + 0.85;
  const coverBoardGeo = new THREE.BoxGeometry(boardW, 0.2, boardD);
  coverBoardGeo.translate(0, 0.1, 0);
  const coverBoardMesh = new THREE.Mesh(coverBoardGeo, coverMat);
  coverBoardMesh.castShadow = true;
  coverBoardMesh.receiveShadow = true;
  addWhitePaperEdge(coverBoardMesh, 0.78);
  stage.add(coverBoardMesh);

  const spineBarGeo = new THREE.BoxGeometry(1.35, 0.24, boardD + 0.22);
  spineBarGeo.translate(0, 0.11, 0);
  const spineBarMesh = new THREE.Mesh(spineBarGeo, spineMat);
  addWhitePaperEdge(spineBarMesh, 0.72);
  stage.add(spineBarMesh);

  // 4 Gold-Foil Corner Protectors on the Hardcover
  const cornerSize = 1.15;
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].forEach(([sx, sz]) => {
    const cGeo = new THREE.BoxGeometry(cornerSize, 0.22, cornerSize);
    cGeo.translate(
      sx * (boardW * 0.5 - cornerSize * 0.44),
      0.12,
      sz * (boardD * 0.5 - cornerSize * 0.44)
    );
    const cMesh = new THREE.Mesh(cGeo, foilMat);
    addWhitePaperEdge(cMesh, 0.88);
    stage.add(cMesh);
  });

  // 2. Stepped Cream Deckle Page Block (4 visible stacked page tiers so the front & side page stacks read clearly)
  for (let tier = 0; tier < 4; tier++) {
    const inset = tier * 0.15;
    const tierGeo = new THREE.BoxGeometry(coverWidth - inset, 0.085, coverDepth - inset * 0.75);
    tierGeo.translate(0, 0.23 + tier * 0.085, 0);
    const tierMesh = new THREE.Mesh(tierGeo, tier % 2 === 0 ? deckleMat : pageMat);
    tierMesh.castShadow = true;
    tierMesh.receiveShadow = true;
    addWhitePaperEdge(tierMesh, 0.9);
    stage.add(tierMesh);
  }

  // 3. Top Open Spread Surface (`y = 0.54`) with Central Spine Gutter Crease + Bookmark Ribbon
  const topPageY = 0.54;
  const topPageGeo = new THREE.PlaneGeometry(coverWidth - 0.42, coverDepth - 0.4, 36, 8);
  topPageGeo.rotateX(-Math.PI / 2);
  const pPos = topPageGeo.attributes.position;
  for (let i = 0; i < pPos.count; i++) {
    const px = pPos.getX(i);
    const dip = Math.exp(-Math.abs(px) * 0.95) * 0.14;
    pPos.setY(i, topPageY - dip);
  }
  topPageGeo.computeVertexNormals();
  const topPageMesh = new THREE.Mesh(
    topPageGeo,
    new THREE.MeshStandardMaterial({ map: getBookPageTexture(), roughness: 0.78 })
  );
  topPageMesh.receiveShadow = true;
  stage.add(topPageMesh);

  // Crimson silk bookmark ribbon extending from the front of the central spine onto the table
  const ribbonShape = new THREE.Shape();
  ribbonShape.moveTo(-0.28, 0);
  ribbonShape.lineTo(0.28, 0);
  ribbonShape.lineTo(0.32, 1.55);
  ribbonShape.lineTo(0.0, 1.25);
  ribbonShape.lineTo(-0.32, 1.55);
  ribbonShape.closePath();
  const ribbonGeo = new THREE.ExtrudeGeometry(ribbonShape, { depth: 0.03, bevelEnabled: false });
  ribbonGeo.rotateX(Math.PI / 2);
  const ribbonMesh = new THREE.Mesh(ribbonGeo, makeCardstockMat(PAPER_PALETTE.bridgeCrimson, { roughness: 0.6 }));
  ribbonMesh.position.set(0.15, 0.08, boardD * 0.5 - 0.1);
  addWhitePaperEdge(ribbonMesh, 0.85);
  stage.add(ribbonMesh);

  // 4. Composable Spread Groups (`spreads[0..spreadCount-1]`)
  const spreads = [];
  const spreadLayers = [];
  for (let s = 0; s < spreadCount; s++) {
    const spGroup = new THREE.Group();
    spGroup.name = `PopUpSpread_${s}`;
    spGroup.visible = s === 0;
    stage.add(spGroup);
    spreads.push(spGroup);
    spreadLayers.push([]);
  }

  // 5. Realistic Curving 180° Turning Page Leaf (`flippingPagePivot`)
  const flippingPagePivot = new THREE.Group();
  flippingPagePivot.position.set(0, topPageY + 0.006, 0);
  stage.add(flippingPagePivot);

  const pageW = (coverWidth - 0.52) * 0.49;
  const pageD = coverDepth - 0.52;
  const segX = 24;
  const segZ = 4;
  const leafGeo = new THREE.PlaneGeometry(pageW, pageD, segX, segZ);
  leafGeo.rotateX(-Math.PI / 2);
  leafGeo.translate(pageW * 0.5, 0, 0);

  const baseLeafX = new Float32Array(leafGeo.attributes.position.count);
  const baseLeafZ = new Float32Array(leafGeo.attributes.position.count);
  for (let i = 0; i < leafGeo.attributes.position.count; i++) {
    baseLeafX[i] = leafGeo.attributes.position.getX(i);
    baseLeafZ[i] = leafGeo.attributes.position.getZ(i);
  }

  const leafMesh = new THREE.Mesh(leafGeo, makeCardstockMat(pageColor, { roughness: 0.72 }));
  leafMesh.castShadow = true;
  leafMesh.receiveShadow = true;
  flippingPagePivot.add(leafMesh);

  function updateCurvingLeaf(flipAngle = 0) {
    const angle = clamp(flipAngle, 0.008, Math.PI - 0.008);
    const curlLag = Math.sin(angle) * 0.42;
    const posAttr = leafGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x0 = baseLeafX[i];
      const u = x0 / pageW;
      const localTheta = angle - curlLag * (u * u * 0.85 + u * 0.15);
      const px = Math.cos(localTheta) * x0;
      const py = Math.sin(localTheta) * x0 + Math.sin(u * Math.PI) * Math.sin(angle) * 0.24;
      posAttr.setXYZ(i, px, py, baseLeafZ[i]);
    }
    posAttr.needsUpdate = true;
    leafGeo.computeVertexNormals();
  }

  updateCurvingLeaf(0.01);

  function addLayer(spreadIdx, obj) {
    const idx = clamp(spreadIdx, 0, spreads.length - 1);
    const node = obj.pivot || obj.group || obj;
    spreads[idx].add(node);
    spreadLayers[idx].push(obj);
    return obj;
  }

  function applySpreadFold(spreadIdx, foldVal = 1.0) {
    const idx = clamp(spreadIdx, 0, spreads.length - 1);
    const fClamped = clamp(foldVal, 0, 1);
    spreads[idx].visible = fClamped > 0.015;
    if (!spreads[idx].visible) return;

    const list = spreadLayers[idx].length > 0 ? spreadLayers[idx] : spreads[idx].children;
    list.forEach((item, i) => {
      if (typeof item.setFold === 'function') {
        item.setFold(fClamped, i);
      } else if (item.userData && typeof item.userData.setFold === 'function') {
        item.userData.setFold(fClamped, i);
      } else if (item.scale) {
        const f = evalPaperFold(fClamped, i, 0.045);
        item.scale.y = f.scaleY;
      }
    });
  }

  function setPageTurn(
    turnProgress = 0.0,
    activeSpreadIdx = 0,
    foldProgress = 1.0,
    nextSpreadIdx = activeSpreadIdx + 1
  ) {
    const fromIdx = clamp(activeSpreadIdx, 0, spreads.length - 1);
    const toIdx = clamp(nextSpreadIdx, 0, spreads.length - 1);

    spreads.forEach((sp) => {
      sp.visible = false;
    });

    if (turnProgress <= 0.001) {
      const restAngle = fromIdx === 0 ? 0.01 : Math.PI - 0.01;
      updateCurvingLeaf(restAngle);
      applySpreadFold(fromIdx, foldProgress);
      return;
    }

    const st = evalPageTurnTransition(turnProgress);
    updateCurvingLeaf(st.flipAngle);

    if (st.page1Fold > 0.02) {
      applySpreadFold(fromIdx, st.page1Fold * foldProgress);
    }
    if (st.page2Fold > 0.02) {
      applySpreadFold(toIdx, st.page2Fold);
    }
  }

  stage.group = stage;
  stage.spreads = spreads;
  stage.flippingPagePivot = flippingPagePivot;
  stage.updateCurvingLeaf = updateCurvingLeaf;
  stage.addLayer = addLayer;
  stage.setPageTurn = setPageTurn;
  stage.applySpreadFold = applySpreadFold;
  stage.pageY = topPageY + 0.01;
  stage.userData = {
    spreads,
    spreadLayers,
    flippingPagePivot,
    addLayer,
    setPageTurn,
    applySpreadFold,
  };
  return stage;
}

// ============================================================================
// 6. SET-DRESSING & CREASE-FOLDED ORIGAMI FAUNA BUILDERS
// ============================================================================

export function buildPaperGround(makeCardstockMat, opts = {}) {
  const {
    center = [0, 0],
    width = 9.0,
    depth = 1.6,
    tiers = 2,
    height = 1.2,
    colors = [PAPER_PALETTE.jadeBlue, PAPER_PALETTE.celadonTeal],
    y = 0.45,
  } = opts;

  const group = new THREE.Group();
  group.name = 'PaperSteppedGround';
  group.position.set(center[0], y, center[1]);

  const foldPivot = new THREE.Group();
  group.add(foldPivot);

  const tierH = height / Math.max(1, tiers);
  for (let i = 0; i < tiers; i++) {
    const frac = i / Math.max(1, tiers);
    const tw = width * (1 - frac * 0.14);
    const td = depth * (1 - frac * 0.16);
    const geo = new THREE.BoxGeometry(tw, tierH, td);
    geo.translate(0, i * tierH + tierH * 0.5, 0);
    const mesh = new THREE.Mesh(geo, makeCardstockMat(colors[i % colors.length], { roughness: 0.78 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addWhitePaperEdge(mesh, 0.9, 12);
    foldPivot.add(mesh);
  }

  function setFold(u = 1.0, staggerIdx = 0) {
    const f = evalPaperFold(u, staggerIdx);
    foldPivot.scale.y = f.scaleY;
    foldPivot.position.y = f.liftY;
  }

  group.group = group;
  group.pivot = group;
  group.top = y + height;
  group.setFold = setFold;
  group.userData = { foldPivot, top: y + height, setFold };
  return { group, pivot: group, top: y + height, setFold };
}

export function buildPaperWater(makeCardstockMat, opts = {}) {
  const {
    width = 16.4,
    depth = 2.0,
    waveRows = 3,
    waveHeight = 0.24,
    scallopAmp = 0.16,
    color = PAPER_PALETTE.celadonTeal,
    crestColor = PAPER_PALETTE.jadeMint,
    foamColor = PAPER_PALETTE.origamiWhite,
    y = 0.45,
    z = 0.8,
  } = opts;

  const group = new THREE.Group();
  group.name = 'PaperWaveStrips';
  group.position.set(0, y, z);

  const rows = [];
  const rowColors = [color, crestColor, foamColor];

  for (let r = 0; r < waveRows; r++) {
    const rz = (r / Math.max(1, waveRows - 1) - 0.5) * depth;
    const rowPivot = new THREE.Group();
    rowPivot.position.set(0, 0, rz);

    const shape = new THREE.Shape();
    const hw = width * 0.5;
    const steps = 40;
    const baseH = waveHeight + (waveRows - 1 - r) * 0.04;
    shape.moveTo(-hw, 0);
    for (let i = 0; i <= steps; i++) {
      const x = -hw + (width * i) / steps;
      const taper = smoothEdgeTaper(i / steps);
      const scallop =
        (Math.abs(Math.sin(x * 1.15 + r * 0.9)) * scallopAmp +
          Math.cos(x * 0.45 - r) * (scallopAmp * 0.25)) *
        taper;
      shape.lineTo(x, (baseH + scallop) * taper);
    }
    shape.lineTo(hw, 0);
    shape.closePath();

    const wGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false });
    wGeo.translate(0, 0, -0.035);
    const wMesh = new THREE.Mesh(
      wGeo,
      makeCardstockMat(rowColors[r % rowColors.length], { roughness: 0.68 })
    );
    wMesh.castShadow = true;
    wMesh.receiveShadow = true;
    addWhitePaperEdge(wMesh, 0.94, 8);
    rowPivot.add(wMesh);
    group.add(rowPivot);
    rows.push({ pivot: rowPivot, baseZ: rz, idx: r });
  }

  function update(t = 0) {
    rows.forEach((row) => {
      const ph = t * 2.0 + row.idx * 1.1;
      row.pivot.position.x = Math.sin(ph) * 0.18;
      row.pivot.position.y = Math.cos(ph * 1.3) * 0.025;
    });
  }

  function setFold(u = 1.0, staggerIdx = 0) {
    rows.forEach((row, i) => {
      const f = evalPaperFold(u, staggerIdx + i, 0.04);
      row.pivot.rotation.x = f.rotationX;
      row.pivot.scale.y = f.scaleY;
    });
  }

  group.group = group;
  group.pivot = group;
  group.update = update;
  group.setFold = setFold;
  group.userData = { rows, update, setFold };
  return { group, pivot: group, rows, update, setFold };
}

export function buildPaperPath(makeCardstockMat, opts = {}) {
  const {
    path = [
      [-3.0, 0.6],
      [0.0, 0.7],
      [3.0, 0.6],
    ],
    width = 0.75,
    style = 'stones',
    color = PAPER_PALETTE.deckleCream,
    altColor = PAPER_PALETTE.lanternGold,
    y = 0.45,
  } = opts;

  const group = new THREE.Group();
  group.name = `PaperPath_${style}`;
  group.position.y = y;

  const pts = path.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts);
  const len = Math.max(0.5, curve.getLength());
  const count = Math.max(3, Math.floor(len / 0.75));
  const matA = makeCardstockMat(color, { roughness: 0.74 });
  const matB = makeCardstockMat(altColor, { roughness: 0.72 });

  for (let i = 0; i <= count; i++) {
    const u = i / count;
    const p = curve.getPointAt(u);
    const sGeo = new THREE.CylinderGeometry(width * 0.36, width * 0.4, 0.06, 6);
    const mesh = new THREE.Mesh(sGeo, i % 2 === 0 ? matA : matB);
    mesh.position.set(p.x, 0.03, p.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addWhitePaperEdge(mesh, 0.9, 8);
    group.add(mesh);
  }

  group.group = group;
  group.pivot = group;
  return { group, pivot: group, update() {} };
}

/**
 * Geometric Crease-Folded Origami Paper Boat (`createPaperBoat`) with optional glowing star lantern.
 */
export function createPaperBoat(makeCardstockMat, options = {}) {
  const group = new THREE.Group();
  group.name = 'OrigamiPaperBoat';
  const scale = options.scale || 1.25;
  const hullHex = options.color || PAPER_PALETTE.origamiWhite;
  const sailHex = options.sailColor || PAPER_PALETTE.lanternGold;

  const foldPivot = new THREE.Group();
  group.add(foldPivot);

  const hullMat = makeCardstockMat(hullHex, { roughness: 0.74, flatShading: true });
  const sailMat = makeCardstockMat(sailHex, {
    roughness: 0.62,
    emissive: sailHex,
    emissiveIntensity: 0.25,
    flatShading: true,
  });

  const L = 0.78 * scale;
  const H = 0.28 * scale;
  const W = 0.34 * scale;

  const hullPos = new Float32Array([
    -L, H * 0.9, 0, 0, H * 0.35, W, -L * 0.62, 0, 0,
    0, H * 0.35, W, L, H * 0.9, 0, L * 0.62, 0, 0,
    0, H * 0.35, W, L * 0.62, 0, 0, -L * 0.62, 0, 0,
    -L, H * 0.9, 0, -L * 0.62, 0, 0, 0, H * 0.35, -W,
    0, H * 0.35, -W, L * 0.62, 0, 0, L, H * 0.9, 0,
    0, H * 0.35, -W, -L * 0.62, 0, 0, L * 0.62, 0, 0,
  ]);
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.BufferAttribute(hullPos, 3));
  hullGeo.computeVertexNormals();
  const hullMesh = new THREE.Mesh(hullGeo, hullMat);
  hullMesh.castShadow = true;
  addWhitePaperEdge(hullMesh, 0.92, 1);
  foldPivot.add(hullMesh);

  const sailH = 0.68 * scale;
  const sailW = 0.32 * scale;
  const sailD = 0.18 * scale;
  const sailPos = new Float32Array([
    0, sailH, 0, -sailW, H * 0.2, 0, 0, H * 0.2, sailD,
    0, sailH, 0, 0, H * 0.2, sailD, sailW, H * 0.2, 0,
    0, sailH, 0, 0, H * 0.2, -sailD, -sailW, H * 0.2, 0,
    0, sailH, 0, sailW, H * 0.2, 0, 0, H * 0.2, -sailD,
  ]);
  const sailGeo = new THREE.BufferGeometry();
  sailGeo.setAttribute('position', new THREE.BufferAttribute(sailPos, 3));
  sailGeo.computeVertexNormals();
  const sailMesh = new THREE.Mesh(sailGeo, sailMat);
  sailMesh.castShadow = true;
  addWhitePaperEdge(sailMesh, 0.95, 1);
  foldPivot.add(sailMesh);

  if (options.withStar) {
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getRadialGlowTexture(),
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.72,
      })
    );
    glow.position.set(0, sailH + 0.14 * scale, 0);
    glow.scale.set(1.1 * scale, 1.1 * scale, 1);
    foldPivot.add(glow);
  }

  function setFold(u = 1.0, staggerIdx = 0) {
    const f = evalPaperFold(u, staggerIdx);
    foldPivot.scale.y = f.scaleY;
    foldPivot.position.y = f.liftY;
  }

  group.group = group;
  group.pivot = group;
  group.setFold = setFold;
  group.userData = { foldPivot, setFold };
  return group;
}

/**
 * Crease-Folded Origami Paper Crane (`createOrigamiCrane`).
 */
export function createOrigamiCrane(makeCardstockMat, options = {}) {
  const group = new THREE.Group();
  group.name = 'OrigamiPaperCrane';
  const scheme = options.colorScheme || 'white';

  const palettes = {
    white: {
      bright: 0xfffcf5,
      hi: 0xfcedd8,
      mid: 0xf2d6ba,
      shd: 0xd9b396,
      deep: 0xb88d76,
      beak: 0xe66852,
    },
    gold: {
      bright: 0xfff2ba,
      hi: 0xfad878,
      mid: 0xedb34c,
      shd: 0xd48832,
      deep: 0xad6224,
      beak: 0xd94838,
    },
    pink: {
      bright: 0xfff0f5,
      hi: 0xfad2dc,
      mid: 0xf0a5b8,
      shd: 0xd47a92,
      deep: 0xb05670,
      beak: 0xe04858,
    },
    blue: {
      bright: 0xf0f8ff,
      hi: 0xc2e6fc,
      mid: 0x85c4f2,
      shd: 0x5696cc,
      deep: 0x3b6e9e,
      beak: 0xf2b852,
    },
  };
  const pal = palettes[scheme] || palettes.white;
  const s = 0.022;
  const reach = 1.16;

  function buildTriangleMesh(pts, hexColor) {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) {
      arr[i * 3 + 0] = pts[i][0] * s;
      arr[i * 3 + 1] = -pts[i][1] * s;
      arr[i * 3 + 2] = pts[i][2] * s;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      makeCardstockMat(hexColor, { roughness: 0.72, flatShading: true })
    );
    mesh.castShadow = true;
    addWhitePaperEdge(mesh, 0.92, 1);
    return mesh;
  }

  const pTop = [0, -11, 0];
  const pFront = [34 * reach, 4, 0];
  const pBack = [-38 * reach, 3, 0];
  const pChest = [10, 22, 0];
  const pShNear = [4, -2, 22];
  const pShFar = [4, -2, -22];

  const bodyGroup = new THREE.Group();
  bodyGroup.add(
    buildTriangleMesh([pTop, pFront, pShNear], pal.hi),
    buildTriangleMesh([pTop, pShNear, pBack], pal.mid),
    buildTriangleMesh([pShNear, pFront, pChest], pal.shd),
    buildTriangleMesh([pShNear, pChest, pBack], pal.deep),
    buildTriangleMesh([pTop, pShFar, pFront], pal.mid),
    buildTriangleMesh([pTop, pBack, pShFar], pal.shd),
    buildTriangleMesh([pShFar, pChest, pFront], pal.deep),
    buildTriangleMesh([pShFar, pBack, pChest], pal.deep)
  );
  group.add(bodyGroup);

  const neckPivot = new THREE.Group();
  const pNeckBaseF = [36 * reach, 2, 0];
  const pNeckBaseMNear = [28 * reach, -2, 7];
  const pNeckBaseMFar = [28 * reach, -2, -7];
  const pNeckBaseB = [20 * reach, -6, 0];
  const pHeadCrest = [58 * reach, -48, 0];
  const pHeadThroat = [48 * reach, -36, 0];
  const pHeadSideNear = [52 * reach, -42, 4];
  const pHeadSideFar = [52 * reach, -42, -4];
  const pBeakTip = [86 * reach, -32, 0];

  neckPivot.add(
    buildTriangleMesh([pNeckBaseF, pHeadThroat, pNeckBaseMNear], pal.hi),
    buildTriangleMesh([pNeckBaseMNear, pHeadThroat, pHeadCrest], pal.hi),
    buildTriangleMesh([pNeckBaseMNear, pHeadCrest, pNeckBaseB], pal.bright),
    buildTriangleMesh([pNeckBaseF, pNeckBaseMFar, pHeadThroat], pal.mid),
    buildTriangleMesh([pNeckBaseMFar, pHeadCrest, pHeadThroat], pal.mid),
    buildTriangleMesh([pNeckBaseMFar, pNeckBaseB, pHeadCrest], pal.shd),
    buildTriangleMesh([pHeadCrest, pBeakTip, pHeadSideNear], pal.beak),
    buildTriangleMesh([pHeadSideNear, pBeakTip, pHeadThroat], pal.shd),
    buildTriangleMesh([pHeadCrest, pHeadSideFar, pBeakTip], pal.beak),
    buildTriangleMesh([pHeadSideFar, pHeadThroat, pBeakTip], pal.deep)
  );
  group.add(neckPivot);

  const pTailBaseB = [-42 * reach, 2, 0];
  const pTailBaseMNear = [-32 * reach, -3, 6];
  const pTailBaseMFar = [-32 * reach, -3, -6];
  const pTailBaseF = [-24 * reach, -8, 0];
  const pTailTip = [-88 * reach, -52, 0];
  const tailGroup = new THREE.Group();
  tailGroup.add(
    buildTriangleMesh([pTailBaseF, pTailBaseMNear, pTailTip], pal.bright),
    buildTriangleMesh([pTailBaseMNear, pTailBaseB, pTailTip], pal.mid),
    buildTriangleMesh([pTailBaseF, pTailTip, pTailBaseMFar], pal.mid),
    buildTriangleMesh([pTailBaseMFar, pTailTip, pTailBaseB], pal.shd)
  );
  group.add(tailGroup);

  const nearWingPivot = new THREE.Group();
  nearWingPivot.position.set(0, 0.05, 22 * s);
  const farWingPivot = new THREE.Group();
  farWingPivot.position.set(0, 0.05, -22 * s);

  nearWingPivot.add(
    buildTriangleMesh([[26, 0, 0], [-18, -68, 48], [-8, -6, 2]], pal.bright),
    buildTriangleMesh([[-8, -6, 2], [-18, -68, 48], [-58, -16, 32]], pal.hi),
    buildTriangleMesh([[-8, -6, 2], [-58, -16, 32], [-30, 2, 0]], pal.mid)
  );
  farWingPivot.add(
    buildTriangleMesh([[26, 0, 0], [-8, -6, -2], [-18, -68, -48]], pal.hi),
    buildTriangleMesh([[-8, -6, -2], [-58, -16, -32], [-18, -68, -48]], pal.mid),
    buildTriangleMesh([[-8, -6, -2], [-30, 2, 0], [-58, -16, -32]], pal.shd)
  );
  group.add(nearWingPivot, farWingPivot);

  const setWingFlap = (flapVal, neckNod = 0.0) => {
    nearWingPivot.rotation.x = flapVal * 0.52;
    farWingPivot.rotation.x = -flapVal * 0.52;
    neckPivot.rotation.z = neckNod;
  };

  group.setWingFlap = setWingFlap;
  group.userData = { nearWingPivot, farWingPivot, neckPivot, setWingFlap };
  return group;
}

/**
 * Crease-Folded Origami Paper Butterfly (`createOrigamiButterfly`).
 */
export function createOrigamiButterfly(makeCardstockMat, opts = {}) {
  const {
    color = PAPER_PALETTE.origamiPink,
    accentColor = PAPER_PALETTE.foilGold,
    bodyColor = PAPER_PALETTE.origamiWhite,
    span = 0.85,
  } = opts;

  const group = new THREE.Group();
  group.name = 'OrigamiButterfly';
  const s = span * 0.5;

  function buildTri(pts, hex) {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(pts.flat());
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, makeCardstockMat(hex, { roughness: 0.65, flatShading: true }));
    mesh.castShadow = true;
    addWhitePaperEdge(mesh, 0.94, 1);
    return mesh;
  }

  const spine = buildTri(
    [
      [0, 0.06 * s, 0.42 * s],
      [-0.08 * s, 0, -0.38 * s],
      [0.08 * s, 0, -0.38 * s],
    ],
    bodyColor
  );
  group.add(spine);

  const leftWing = new THREE.Group();
  leftWing.add(
    buildTri(
      [
        [0, 0, 0.35 * s],
        [-1.05 * s, 0.18 * s, 0.55 * s],
        [-0.78 * s, 0.04 * s, -0.12 * s],
      ],
      color
    ),
    buildTri(
      [
        [0, 0, 0.05 * s],
        [-0.72 * s, 0.02 * s, -0.08 * s],
        [-0.48 * s, -0.05 * s, -0.68 * s],
      ],
      accentColor
    )
  );

  const rightWing = new THREE.Group();
  rightWing.add(
    buildTri(
      [
        [0, 0, 0.35 * s],
        [0.78 * s, 0.04 * s, -0.12 * s],
        [1.05 * s, 0.18 * s, 0.55 * s],
      ],
      color
    ),
    buildTri(
      [
        [0, 0, 0.05 * s],
        [0.48 * s, -0.05 * s, -0.68 * s],
        [0.72 * s, 0.02 * s, -0.08 * s],
      ],
      accentColor
    )
  );

  group.add(leftWing, rightWing);

  function setFlap(flapVal = 0.0) {
    leftWing.rotation.z = -flapVal * 0.68;
    rightWing.rotation.z = flapVal * 0.68;
  }

  group.setFlap = setFlap;
  group.userData = { leftWing, rightWing, setFlap };
  return group;
}

/**
 * Crease-Folded Geometric Origami Fox (`createOrigamiFox`) — pure triangular facets, zero cartoon features.
 */
export function createOrigamiFox(makeCardstockMat, opts = {}) {
  const {
    color = PAPER_PALETTE.canyonAmber,
    chestColor = PAPER_PALETTE.origamiWhite,
    tailTipColor = PAPER_PALETTE.origamiWhite,
    scale = 1.0,
  } = opts;

  const group = new THREE.Group();
  group.name = 'OrigamiFox';
  const s = scale * 0.62;

  function buildTri(pts, hex) {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(pts.flat());
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, makeCardstockMat(hex, { roughness: 0.72, flatShading: true }));
    mesh.castShadow = true;
    addWhitePaperEdge(mesh, 0.94, 1);
    return mesh;
  }

  const bodyGroup = new THREE.Group();
  bodyGroup.add(
    buildTri([[-0.65 * s, 0, 0.32 * s], [0.55 * s, 0, 0.28 * s], [0.35 * s, 0.95 * s, 0]], color),
    buildTri([[-0.65 * s, 0, 0.32 * s], [0.35 * s, 0.95 * s, 0], [-0.45 * s, 0.72 * s, 0]], color),
    buildTri([[-0.65 * s, 0, -0.32 * s], [0.35 * s, 0.95 * s, 0], [0.55 * s, 0, -0.28 * s]], color),
    buildTri([[-0.65 * s, 0, -0.32 * s], [-0.45 * s, 0.72 * s, 0], [0.35 * s, 0.95 * s, 0]], color),
    buildTri([[0.55 * s, 0, 0.28 * s], [0.72 * s, 0.55 * s, 0], [0.35 * s, 0.95 * s, 0]], chestColor),
    buildTri([[0.55 * s, 0, -0.28 * s], [0.35 * s, 0.95 * s, 0], [0.72 * s, 0.55 * s, 0]], chestColor)
  );
  group.add(bodyGroup);

  const headPivot = new THREE.Group();
  headPivot.position.set(0.42 * s, 0.92 * s, 0);
  headPivot.add(
    buildTri([[0, 0.25 * s, 0], [0.75 * s, -0.08 * s, 0], [0.12 * s, -0.15 * s, 0.34 * s]], color),
    buildTri([[0, 0.25 * s, 0], [0.12 * s, -0.15 * s, -0.34 * s], [0.75 * s, -0.08 * s, 0]], color),
    buildTri([[0.12 * s, -0.15 * s, 0.34 * s], [0.75 * s, -0.08 * s, 0], [0.12 * s, -0.22 * s, 0]], chestColor),
    buildTri([[0.12 * s, -0.15 * s, -0.34 * s], [0.12 * s, -0.22 * s, 0], [0.75 * s, -0.08 * s, 0]], chestColor),
    buildTri([[-0.05 * s, 0.12 * s, 0.1 * s], [0.12 * s, 0.68 * s, 0.26 * s], [0.18 * s, 0.1 * s, 0.28 * s]], color),
    buildTri([[-0.05 * s, 0.12 * s, -0.1 * s], [0.18 * s, 0.1 * s, -0.28 * s], [0.12 * s, 0.68 * s, -0.26 * s]], color)
  );
  group.add(headPivot);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(-0.58 * s, 0.18 * s, 0);
  tailPivot.add(
    buildTri([[0, 0, 0], [-0.62 * s, 0.42 * s, 0.18 * s], [-0.45 * s, 0.68 * s, 0]], color),
    buildTri([[0, 0, 0], [-0.45 * s, 0.68 * s, 0], [-0.62 * s, 0.42 * s, -0.18 * s]], color),
    buildTri([[-0.62 * s, 0.42 * s, 0.18 * s], [-1.05 * s, 0.92 * s, 0], [-0.45 * s, 0.68 * s, 0]], tailTipColor),
    buildTri([[-0.62 * s, 0.42 * s, -0.18 * s], [-0.45 * s, 0.68 * s, 0], [-1.05 * s, 0.92 * s, 0]], tailTipColor)
  );
  group.add(tailPivot);

  group.headPivot = headPivot;
  group.tailPivot = tailPivot;
  group.userData = { headPivot, tailPivot };
  return group;
}

export function createPaperPineTree(makeCardstockMat, height = 1.0, hexColor = 0x264d59) {
  const group = new THREE.Group();
  const mat = makeCardstockMat(hexColor, { roughness: 0.8 });
  for (let t = 0; t < 3; t++) {
    const r = (0.36 - t * 0.08) * height;
    const h = 0.42 * height;
    const cone = new THREE.ConeGeometry(r, h, 4);
    cone.translate(0, 0.25 * height + t * 0.24 * height + h * 0.5, 0);
    const m = new THREE.Mesh(cone, mat);
    addWhitePaperEdge(m, 0.85, 8);
    group.add(m);
  }
  return group;
}

// ============================================================================
// 7. PAPER POP-UP LOOK RIG & TURNKEY 3D STUDIO (`createPaperStudioStage`)
// ============================================================================

export const PAPER_LOOK = {
  toneMapping: 'agx',
  exposure: 1.08,
  backdrop: { color: '#EAD8C3', fog: 0.005 },
  light: {
    illuminance: 2.85,
    keyRatio: 2.35,
    key: {
      color: '#FFF4DC',
      pos: [8, 19, 14],
      castShadow: true,
      shadowMapSize: 2048,
      shadowBias: -0.0005,
    },
    sky: '#FFF7E8',
    ground: '#B88D72',
    bounce: { color: '#FAD5A5', share: 0.32, pos: [-8, 6, 10] },
    rim: { color: '#FFE8B8', share: 0.34, pos: [-6, 12, -12] },
  },
  env: {
    intensity: 0.42,
    zenith: '#FFF5E4',
    horizon: '#F5DEC2',
    ground: '#9E735B',
    card: { color: '#FFFDF6', w: 0.32, h: 0.22, x: 0.22, y: 0.62, intensity: 2.1 },
  },
  contact: {
    enabled: false,
  },
};

export const PAPER_LOOK_PRESETS = {
  day: {},
  golden: {
    backdrop: { color: '#E6C6A6', fog: 0.005 },
    light: {
      illuminance: 2.8,
      keyRatio: 2.45,
      key: { color: '#FFD892', pos: [9, 16, 13] },
      sky: '#FFEAC4',
      ground: '#9E6854',
      bounce: { color: '#F5B882', share: 0.32 },
    },
  },
  dusk: {
    backdrop: { color: '#4B365A', fog: 0.006 },
    light: {
      illuminance: 2.45,
      keyRatio: 2.25,
      key: { color: '#FFD28A', pos: [4, 17, 13] },
      sky: '#E8C8E0',
      ground: '#6E425C',
      bounce: { color: '#F0B698', share: 0.3 },
    },
  },
  night: {
    backdrop: { color: '#2B2042', fog: 0.006 },
    light: {
      illuminance: 2.25,
      keyRatio: 2.15,
      key: { color: '#DCE8FF', pos: [-5, 18, 14] },
      sky: '#C2D4F8',
      ground: '#5A4472',
      bounce: { color: '#F5C488', share: 0.32 },
    },
  },
  indoor: {
    backdrop: { color: '#522938', fog: 0.006 },
    light: {
      illuminance: 2.3,
      keyRatio: 2.2,
      key: { color: '#FFE0A8', pos: [5, 17, 13] },
      sky: '#FFF0D4',
      ground: '#8E5262',
      bounce: { color: '#FFC896', share: 0.3 },
    },
  },
};

export function evalSpreadFoldEnvelope(localT, sceneDur = 3.6, delay = 0.08, riseDur = 0.85, isLastScene = false) {
  const openP = clamp((localT - delay) / Math.max(0.001, riseDur), 0, 1);
  if (isLastScene) return openP;
  const closeStart = Math.max(delay + riseDur + 0.4, sceneDur - 0.38);
  if (localT <= closeStart) return openP;
  const closeT = clamp((localT - closeStart) / Math.max(0.001, sceneDur - closeStart), 0, 1);
  const closeEase = closeT * closeT * (3 - 2 * closeT);
  return openP * (1 - 0.88 * closeEase);
}

export function applyBookPageTurn(flippingPagePivot, localT, sceneIndex = 0, turnDur = 0.82) {
  if (!flippingPagePivot) return 1;
  const raw = clamp(localT / Math.max(0.001, turnDur), 0, 1);
  const ease = easeInOutCubic(raw);
  const startAngle = sceneIndex === 0 ? 0.12 : 0.02;
  const endAngle = Math.PI - 0.02;
  flippingPagePivot.rotation.z = startAngle + ease * (endAngle - startAngle);
  return ease;
}

/**
 * Continuous Proscenium Pop-Up Book Camera Controller (`createPopupBookDirector`).
 *
 * Supports both single-scene spreads and multi-scene spreads with mid-film 180° page turns:
 *   - Every scene specifies `startPos` / `focusPos` / `endPos` and `startTarget` / `focusTarget` / `endTarget`
 *     (defaulting to `basePos` / `baseTarget`), plus timing windows `holdStart`, `peakStart`, `peakEnd`, `pullEnd`.
 *   - Guarantees `C¹` smooth camera motion across all scene boundaries with ZERO hard camera cuts.
 */
export function createPopupBookDirector(studio, scenes = [], spreadSpecs = {}) {
  const { camera, framing } = studio;
  const basePos = spreadSpecs.basePos || [0.0, 9.2, 19.6];
  const baseTarget = spreadSpecs.baseTarget || [0.0, 2.0, -0.2];

  function smooth01(x) {
    const t = clamp(x, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function update(frame) {
    const idx = frame.sceneIndex ?? 0;
    const sc = scenes[idx] || scenes[0] || { id: 'main', index: idx, start: 0, dur: 3.6 };
    const spec = spreadSpecs[sc.id] || spreadSpecs[idx] || {};

    const sPos = spec.startPos || basePos;
    const fPos = spec.focusPos || [0.0, 7.2, 14.8];
    const ePos = spec.endPos || basePos;

    const sTgt = spec.startTarget || baseTarget;
    const fTgt = spec.focusTarget || [0.0, 2.0, 0.1];
    const eTgt = spec.endTarget || baseTarget;

    const holdStart = spec.holdStart ?? 0.16;
    const peakStart = spec.peakStart ?? 0.48;
    const peakEnd = spec.peakEnd ?? 0.74;
    const pullEnd = spec.pullEnd ?? 0.98;
    const swayAmp = spec.swayAmp ?? 0.22;

    const u = clamp(frame.sceneProgress ?? 0, 0, 1);
    let pos = sPos;
    let tgt = sTgt;
    let swayW = 0.25;

    if (u < holdStart) {
      pos = sPos;
      tgt = sTgt;
      swayW = 0.15;
    } else if (u < peakStart) {
      const w = smooth01((u - holdStart) / Math.max(0.001, peakStart - holdStart));
      pos = [lerp(sPos[0], fPos[0], w), lerp(sPos[1], fPos[1], w), lerp(sPos[2], fPos[2], w)];
      tgt = [lerp(sTgt[0], fTgt[0], w), lerp(sTgt[1], fTgt[1], w), lerp(sTgt[2], fTgt[2], w)];
      swayW = lerp(0.15, 1.0, w);
    } else if (u < peakEnd) {
      pos = fPos;
      tgt = fTgt;
      swayW = 1.0;
    } else if (u < pullEnd) {
      const w = smooth01((u - peakEnd) / Math.max(0.001, pullEnd - peakEnd));
      pos = [lerp(fPos[0], ePos[0], w), lerp(fPos[1], ePos[1], w), lerp(fPos[2], ePos[2], w)];
      tgt = [lerp(fTgt[0], eTgt[0], w), lerp(fTgt[1], eTgt[1], w), lerp(fTgt[2], eTgt[2], w)];
      swayW = lerp(1.0, 0.15, w);
    } else {
      pos = ePos;
      tgt = eTgt;
      swayW = 0.15;
    }

    const sway = Math.sin(u * Math.PI * 2) * swayAmp * swayW;
    const ds = framing.distScale || 1;

    camera.fov = framing.fov;
    camera.aspect = framing.aspect;
    camera.updateProjectionMatrix();
    camera.position.set(pos[0] + sway, pos[1], pos[2] * ds);
    camera.up.set(0, 1, 0);
    camera.lookAt(tgt[0] + sway * 0.22, tgt[1], tgt[2]);
  }

  const board = (scenes || []).map((sc, idx) => {
    const spec = spreadSpecs[sc.id] || spreadSpecs[idx] || {};
    const sampleFrac = spec.storyboardFrac ?? 0.62;
    return {
      t: +(sc.start + sc.dur * sampleFrac).toFixed(2),
      scene: sc.index ?? idx,
      shot: 0,
      size: spec.move || 'push-pull',
      subject: spec.subject || sc.id || `spread-${idx + 1}`,
      dur: sc.dur,
      is2D: true,
      warn: [],
    };
  });

  return { update, storyboard: () => board };
}

/**
 * Initializes the Turnkey 3D Paper Pop-Up Book Studio (`createPaperStudioStage`).
 */
export function createPaperStudioStage({
  width = 1920,
  height = 1080,
  baseFov = 31,
  look = null,
  looks = null,
  scenes = [],
} = {}) {
  const studio = createStudio3D(THREE, {
    width,
    height,
    baseFov,
    scenes,
    look: resolveLook(LOOK_DEFAULTS, PAPER_LOOK, look),
    presets: resolveLook(LOOK_PRESETS, PAPER_LOOK_PRESETS, looks),
    maxDist: 36,
  });

  const { canvas, renderer, scene, camera, framing } = studio;
  const paperBumpTex = createWashiPaperBumpTexture(512, 89);
  const {
    makeCardstockMat,
    makeGoldFoilMat,
    makeBacklitWashiMat,
  } = createPaperMaterialFactory(paperBumpTex);

  const envGroup = new THREE.Group();
  scene.add(envGroup);

  // Warm walnut studio tabletop so the open burgundy & cream pop-up book reads clearly as a physical book on a table
  const deskMesh = new THREE.Mesh(
    new THREE.BoxGeometry(64, 1.2, 42),
    makeCardstockMat(PAPER_PALETTE.deskWood, { roughness: 0.84, bumpScale: 0.012 })
  );
  deskMesh.position.set(0, -0.6, 0.5);
  deskMesh.receiveShadow = true;
  envGroup.add(deskMesh);

  return {
    canvas,
    renderer,
    scene,
    camera,
    framing,
    distScale: framing.distScale,
    envGroup,
    deskMesh,
    paperBumpTex,
    makeCardstockMat,
    makeGoldFoilMat,
    makeBacklitWashiMat,
    addWhitePaperEdge,
    applyShot: studio.applyShot,
    director: studio.director,
    bookDirector: (spreadSpecs) => createPopupBookDirector(studio, scenes, spreadSpecs),
    lookRig: studio.lookRig,
    render: studio.render,
  };
}
