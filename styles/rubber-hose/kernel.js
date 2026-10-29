/**
 * 1930s Rubber-Hose Cartoon · Generative Visual & Acoustic-Rhythm Style Kernel (`styles/rubber-hose/kernel.js`).
 *
 * Encapsulates 4 tiers of subject-agnostic 1930s Fleischer / UB Iwerks / Silly Symphonies medium laws:
 *   Tier 1: 1930s Sepia Celluloid & 3-Strip Technicolor Palette (`RUBBER_PALETTE`),
 *           5 Theatrical Look Presets (`RUBBER_LOOK_PRESETS`: `sepia`, `vaudeville`, `technicolor`, `talkie`, `matinee`),
 *           132 BPM Swing & Volume-Preserving Elastic Physics (`quantizeCelTime`, `evalSwingBounce`,
 *           `evalVolumeSquash`, `evalRubberWave`, `evalHopParabola`)
 *   Tier 2: Rule-Based Generative Dip-Pen Stroke & 12fps Line Boil (`mkDipPenStroke`, `drawDipPenStroke`),
 *           Ben-Day Halftone Shading & Cel Contour Fill (`drawBenDayDots`, `drawInkCelShape`),
 *           Jointless S/C-Curve Rubber-Hose Limb Solver (`drawRubberHoseLimb`),
 *           4-Finger White Cartoon Glove (`drawCartoonGlove`), Bulbous Retro Shoe (`drawCartoonShoe`),
 *           Parameterized Pie-Cut Eyes (`drawPieCutEyes`), Exaggerated Cartoon Mouth (`drawCartoonMouth`),
 *           Technicolor Soundwave Ring (`drawTechnicolorRing`), 4-Point Concave Star (`drawFourPointStar`),
 *           Comic Impact Starburst (`drawComicBurst`), Pop Icons (`drawPopIcon`), Vibration Ticks (`drawVibrationTicks`)
 *   Tier 3: 35mm Celluloid Stage Backdrop (`drawCelluloidBackdrop`), Velvet Curtains (`drawTheaterCurtains`),
 *           35mm Sprocket Borders (`draw35mmSprocketOverlay`), Reel Countdown (`draw35mmCountdown`),
 *           Circular Black Iris Transition (`drawIrisTransition`),
 *           3D Perspective Elastic Piano Keyboard Road (`evalElasticRibbonSpline`, `drawElasticKeyboardRoad`),
 *           Giant Anthropomorphic Brass Gramophone (`drawAnthropomorphicGramophone`),
 *           Anthropomorphic Band Instruments (`drawAnthropomorphicInstrument`: contrabass, saxophone, microphone, drumkit),
 *           Mischievous Note Critters (`drawNoteCritter`), Jazz Note Stream (`drawJazzNoteStream`),
 *           Spinning 78-RPM Vinyl Record (`drawSpinningVinyl`)
 *   Tier 4: Multi-View 2D Rubber-Hose Character Puppet (`createRubberHoseCharacter` via `engine/puppet2d.js`) &
 *           Aspect-Adaptive 2D Celluloid Stage (`createRubberHoseStage` via `engine/studio2d.js`)
 */

import { clamp, lerp, smootherstep, flowStep, springStep } from '../../engine/motion.js';
export { clamp, lerp, smootherstep, flowStep, springStep };
import { createStudio2D } from '../../engine/studio2d.js';
import { createPuppet2D, drawSkeleton2D } from '../../engine/puppet2d.js';
export { createPuppet2D, drawSkeleton2D };

// ============================================================================
// TIER 1A · 1930s SEPIA CELLULOID & 3-STRIP TECHNICOLOR PALETTE
// ============================================================================

export const RUBBER_PALETTE = {
  // 1930s India Ink & Sepia Celluloid Tones
  inkBlack: '#1E1A17',
  sepiaDark: '#3D3226',
  sepiaMid: '#8C7A66',
  sepiaLight: '#D2C4AC',
  agedPaper: '#EFE6D2',
  paperCream: '#FAF4E6',
  ivoryKey: '#F6EFE0',

  // Vintage Stage, Wood & Brass Tones
  brassGold: '#E0B852',
  brassBright: '#F7DC78',
  brassDark: '#7A5C29',
  mahogany: '#613020',
  mahoganyLight: '#9C5035',
  velvetCrimson: '#6E2428',
  velvetDark: '#381215',
  feltGreen: '#336B4C',

  // 3-Strip Technicolor Chromatic Accents
  tcBlue: '#4285F4',
  tcViolet: '#8B5CF6',
  tcCoral: '#E05A64',
  tcGold: '#FBBF24',
  tcCyan: '#38BDF8',
  tcMint: '#34D399',
};

export function hexToRgb(hex) {
  const s = String(hex || '#000000').replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hexOrRgb, a = 1.0) {
  const [r, g, b] = Array.isArray(hexOrRgb) ? hexOrRgb : hexToRgb(hexOrRgb);
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${clamp(a, 0, 1).toFixed(3)})`;
}

export function mixHex(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const u = clamp(t, 0, 1);
  const r = Math.round(lerp(a[0], b[0], u));
  const g = Math.round(lerp(a[1], b[1], u));
  const bl = Math.round(lerp(a[2], b[2], u));
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2D(ix, iy) {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise2D(x, y = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// ============================================================================
// TIER 1B · THEATRICAL & CELLULOID LOOK PRESETS (`data-look`)
// ============================================================================

export const RUBBER_LOOK_PRESETS = {
  sepia: {
    name: 'sepia',
    skyTop: '#FAF3E4',
    skyMid: '#EFE6D2',
    skyBot: '#D6C5A8',
    floorTop: '#DAC7A7',
    floorBot: '#A8906D',
    curtainMain: '#3B2D24',
    curtainFold: '#1E1612',
    spotColor: '#FFF8DE',
    spotAlpha: 0.42,
    staffColor: '#B5A38A',
    tcMix: 0.18,
    grainAlpha: 0.14,
  },
  vaudeville: {
    name: 'vaudeville',
    skyTop: '#F8E9D0',
    skyMid: '#EAD3B0',
    skyBot: '#CCA97E',
    floorTop: '#D4B388',
    floorBot: '#96744E',
    curtainMain: '#632428',
    curtainFold: '#301013',
    spotColor: '#FFEAA6',
    spotAlpha: 0.48,
    staffColor: '#A68B6B',
    tcMix: 0.52,
    grainAlpha: 0.14,
  },
  technicolor: {
    name: 'technicolor',
    skyTop: '#FAF2E4',
    skyMid: '#ECE2D6',
    skyBot: '#D2C4E2',
    floorTop: '#DBCAB8',
    floorBot: '#9B8576',
    curtainMain: '#70242A',
    curtainFold: '#381115',
    spotColor: '#FFF5C8',
    spotAlpha: 0.52,
    staffColor: '#9888A8',
    tcMix: 1.0,
    grainAlpha: 0.12,
  },
  talkie: {
    name: 'talkie',
    // Calibrated so lookcheck.py READABILITY floors (L in [35, 92], p95 >= 55, contrast >= 7) pass with wide margin
    skyTop: '#90A5C0',
    skyMid: '#748BA8',
    skyBot: '#5A708E',
    floorTop: '#A49482',
    floorBot: '#706050',
    curtainMain: '#612228',
    curtainFold: '#2E0F13',
    spotColor: '#FFF9D8',
    spotAlpha: 0.58,
    staffColor: '#B8C6D8',
    tcMix: 0.92,
    grainAlpha: 0.15,
  },
  matinee: {
    name: 'matinee',
    skyTop: '#FCF8EE',
    skyMid: '#F3EAD9',
    skyBot: '#DDD0B8',
    floorTop: '#E2D2B6',
    floorBot: '#B29B7A',
    curtainMain: '#4A3528',
    curtainFold: '#261B14',
    spotColor: '#FFFFFF',
    spotAlpha: 0.38,
    staffColor: '#B8A890',
    tcMix: 0.35,
    grainAlpha: 0.12,
  },
};

// Map standard engine look aliases
RUBBER_LOOK_PRESETS.day = RUBBER_LOOK_PRESETS.sepia;
RUBBER_LOOK_PRESETS.dusk = RUBBER_LOOK_PRESETS.vaudeville;
RUBBER_LOOK_PRESETS.golden = RUBBER_LOOK_PRESETS.technicolor;
RUBBER_LOOK_PRESETS.night = RUBBER_LOOK_PRESETS.talkie;
RUBBER_LOOK_PRESETS.indoor = RUBBER_LOOK_PRESETS.matinee;

export function blendRubberLook(lookA, lookB, u) {
  const a = RUBBER_LOOK_PRESETS[lookA] || lookA || RUBBER_LOOK_PRESETS.sepia;
  const b = RUBBER_LOOK_PRESETS[lookB] || lookB || RUBBER_LOOK_PRESETS.sepia;
  const k = clamp(u, 0, 1);
  if (k <= 0.001) return a;
  if (k >= 0.999) return b;
  return {
    name: k < 0.5 ? a.name : b.name,
    skyTop: mixHex(a.skyTop, b.skyTop, k),
    skyMid: mixHex(a.skyMid, b.skyMid, k),
    skyBot: mixHex(a.skyBot, b.skyBot, k),
    floorTop: mixHex(a.floorTop, b.floorTop, k),
    floorBot: mixHex(a.floorBot, b.floorBot, k),
    curtainMain: mixHex(a.curtainMain, b.curtainMain, k),
    curtainFold: mixHex(a.curtainFold, b.curtainFold, k),
    spotColor: mixHex(a.spotColor, b.spotColor, k),
    spotAlpha: lerp(a.spotAlpha, b.spotAlpha, k),
    staffColor: mixHex(a.staffColor, b.staffColor, k),
    tcMix: lerp(a.tcMix, b.tcMix, k),
    grainAlpha: lerp(a.grainAlpha, b.grainAlpha, k),
  };
}

// ============================================================================
// TIER 1C · 132 BPM SWING BOUNCE & VOLUME-PRESERVING ELASTIC PHYSICS
// ============================================================================

export function quantizeCelTime(t, fps = 12, blend = 0.32) {
  const stepped = Math.floor(t * fps) / fps;
  return lerp(t, stepped, blend);
}

/**
 * Evaluates the universal 1930s Fleischer / Silly Symphonies rhythmic knee-bounce (`evalSwingBounce`).
 * At 132 BPM (`2.2 Hz`), every character, instrument, cabinet, and curtain bounces in sync.
 */
export function evalSwingBounce(t, bpm = 132, phase = 0) {
  const freq = bpm / 60;
  const raw = (t * freq + phase) % 1;
  const beatPhase = raw < 0 ? raw + 1 : raw;
  const rad = beatPhase * Math.PI * 2;
  const sinBeat = Math.sin(rad);
  // Sharp downward knee-dip on the downbeat, lively spring upward on the upbeat
  const bounce = Math.abs(Math.sin(beatPhase * Math.PI)) * 14.0;
  const squashY = clamp(1.0 - 0.085 * Math.sin(beatPhase * Math.PI), 0.72, 1.24);
  const squashX = 1.0 / Math.sqrt(squashY);
  const footTap = Math.max(-0.05, sinBeat) * 0.22;
  const sway = Math.sin(rad * 0.5) * 0.06;
  return { beatPhase, bounce, squashY, squashX, footTap, sway };
}

/**
 * Volume-preserving 2D cartoon squash & stretch (`sx * sy^2 = const -> sx = 1 / sqrt(sy)`).
 */
export function evalVolumeSquash(squashY = 1.0) {
  const sy = clamp(squashY, 0.25, 1.85);
  const sx = 1.0 / Math.sqrt(sy);
  return { sx, sy };
}

/**
 * Travelling sinusoidal wave along a rubber-hose limb or brass horn (`evalRubberWave`).
 */
export function evalRubberWave(u, t, freq = 1.5, amp = 14, phase = 0) {
  const s = clamp(u, 0, 1);
  const env = Math.sin(s * Math.PI);
  return Math.sin(s * freq * Math.PI * 2 - t * 9.0 + phase) * amp * env;
}

/**
 * Parabolic cartoon jump with anticipation squash and landing overshoot (`evalHopParabola`).
 */
export function evalHopParabola(u, x0, y0, x1, y1, apexH = 115) {
  const p = clamp(u, 0, 1);
  if (p < 0.12) {
    const prep = Math.sin((p / 0.12) * Math.PI);
    const sy = 1.0 - prep * 0.22;
    return { x: x0, y: y0, squashY: sy, squashX: 1 / Math.sqrt(sy), tilt: prep * 0.08, airborne: false };
  }
  if (p > 0.88) {
    const land = Math.sin(((p - 0.88) / 0.12) * Math.PI);
    const sy = 1.0 - land * 0.26;
    return { x: x1, y: y1, squashY: sy, squashX: 1 / Math.sqrt(sy), tilt: -land * 0.06, airborne: false };
  }
  const f = (p - 0.12) / 0.76;
  const x = lerp(x0, x1, f);
  const baseY = lerp(y0, y1, f);
  const arc = -4.0 * f * (1.0 - f) * apexH;
  const vy = 4.0 * (1.0 - 2.0 * f);
  const sy = clamp(1.0 + Math.abs(vy) * 0.045, 0.85, 1.22);
  return {
    x,
    y: baseY + arc,
    squashY: sy,
    squashX: 1 / Math.sqrt(sy),
    tilt: clamp((x1 >= x0 ? 1 : -1) * vy * 0.09, -0.3, 0.3),
    airborne: true,
  };
}

// ============================================================================
// TIER 2 · RULE-BASED DIP-PEN STROKE, BEN-DAY DOTS, NOODLE LIMBS & EXPRESSIONS
// ============================================================================

const _DIP_STROKE_CACHE = new Map();
const _DIP_STROKE_CACHE_MAX = 1024;

const DIP_PEN_PROFILES = {
  even: () => 1.0,
  taper: (u) => Math.sin(clamp(u, 0, 1) * Math.PI),
  swell: (u) => 0.55 + 0.65 * Math.sin(clamp(u, 0, 1) * Math.PI),
  whip: (u) => Math.pow(1.0 - clamp(u, 0, 1) * 0.82, 0.7),
};

function densifyPolyline(pts, stepsPerSeg = 6) {
  if (!pts || pts.length < 2) return pts || [];
  if (pts.length === 2) {
    const out = [];
    for (let i = 0; i <= stepsPerSeg; i++) {
      const u = i / stepsPerSeg;
      out.push([lerp(pts[0][0], pts[1][0], u), lerp(pts[0][1], pts[1][1], u)]);
    }
    return out;
  }
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    for (let s = 0; s < stepsPerSeg; s++) {
      const t = s / stepsPerSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, y]);
    }
  }
  out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
}

/**
 * Builds a 1930s Gillott dip-pen ink stroke (`mkDipPenStroke`) with 12fps hand-drawn line boil
 * and bounded LRU caching.
 */
export function mkDipPenStroke(pts, opts = {}) {
  const width = opts.width ?? 4.5;
  const profileName = typeof opts.profile === 'function' ? 'custom' : opts.profile || 'swell';
  const boilAmp = opts.boilAmp ?? 0.9;
  const boilSeed = opts.boilSeed ?? 1934;
  const boilTick = Math.floor((opts.t ?? 0) * 12);

  let cacheKey = null;
  if (profileName !== 'custom' && pts && pts.length <= 48) {
    let pStr = '';
    for (let i = 0; i < pts.length; i++) {
      pStr += `${Math.round(pts[i][0] * 2)},${Math.round(pts[i][1] * 2)};`;
    }
    cacheKey = `${pStr}|${width}|${profileName}|${boilAmp}|${boilSeed}|${boilTick}`;
    const hit = _DIP_STROKE_CACHE.get(cacheKey);
    if (hit) {
      _DIP_STROKE_CACHE.delete(cacheKey);
      _DIP_STROKE_CACHE.set(cacheKey, hit);
      return hit;
    }
  }

  const P = densifyPolyline(pts, opts.stepsPerSeg ?? 6);
  const n = P.length;
  const profFn = typeof opts.profile === 'function' ? opts.profile : DIP_PEN_PROFILES[profileName] || DIP_PEN_PROFILES.swell;

  const left = [];
  const right = [];
  const center = [];
  for (let i = 0; i < n; i++) {
    const u = n <= 1 ? 0 : i / (n - 1);
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const jitter =
      boilAmp > 0
        ? (valueNoise2D(u * 6.5 + boilSeed * 0.017, boilTick * 0.37 + boilSeed * 0.01) - 0.5) * 2.0 * boilAmp
        : 0;
    const cx = P[i][0] + nx * jitter;
    const cy = P[i][1] + ny * jitter;
    const w = Math.max(0.6, width * profFn(u) * 0.5);
    center.push([cx, cy, w]);
    left.push([cx + nx * w, cy + ny * w]);
    right.push([cx - nx * w, cy - ny * w]);
  }

  const res = { center, left, right, n, width };
  if (cacheKey) {
    if (_DIP_STROKE_CACHE.size >= _DIP_STROKE_CACHE_MAX) {
      const oldest = _DIP_STROKE_CACHE.keys().next().value;
      _DIP_STROKE_CACHE.delete(oldest);
    }
    _DIP_STROKE_CACHE.set(cacheKey, res);
  }
  return res;
}

/**
 * Renders a 1930s dip-pen ink stroke (`drawDipPenStroke`) with optional double-ink outer rim
 * (`doubleInk`) and progressive drawing (`reveal: 0..1`).
 */
export function drawDipPenStroke(ctx, pts, opts = {}) {
  if (!pts || pts.length < 2) return;
  const reveal = clamp(opts.reveal ?? 1.0, 0, 1);
  const alpha = clamp(opts.alpha ?? 1.0, 0, 1);
  if (reveal <= 0.01 || alpha <= 0.01) return;

  const geom = mkDipPenStroke(pts, opts);
  const maxIdx = Math.max(1, Math.floor((geom.n - 1) * reveal));
  const color = opts.color || RUBBER_PALETTE.inkBlack;

  ctx.save();
  if (opts.doubleInk) {
    ctx.beginPath();
    for (let i = 0; i <= maxIdx; i++) {
      const [x, y] = geom.center[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgba(opts.doubleColor || RUBBER_PALETTE.paperCream, alpha * 0.78);
    ctx.lineWidth = geom.width + 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(geom.left[0][0], geom.left[0][1]);
  for (let i = 1; i <= maxIdx; i++) {
    ctx.lineTo(geom.left[i][0], geom.left[i][1]);
  }
  for (let i = maxIdx; i >= 0; i--) {
    ctx.lineTo(geom.right[i][0], geom.right[i][1]);
  }
  ctx.closePath();
  ctx.fillStyle = rgba(color, alpha);
  ctx.fill();
  ctx.restore();
}

/**
 * Renders a 1930s Ben-Day halftone dot screen inside the current clip or elliptical region (`drawBenDayDots`).
 */
export function drawBenDayDots(ctx, cx, cy, rx, ry, opts = {}) {
  const spacing = Math.max(5, opts.spacing ?? 8.5);
  const color = opts.color || RUBBER_PALETTE.inkBlack;
  const alpha = opts.alpha ?? 0.32;
  const maxDotR = opts.maxDotR ?? spacing * 0.36;
  const offsetX = opts.offsetX ?? rx * 0.22;
  const offsetY = opts.offsetY ?? ry * 0.28;

  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  const y0 = Math.floor(cy - ry * 0.2);
  const y1 = Math.ceil(cy + ry);
  const focusX = cx + offsetX;
  const focusY = cy + offsetY;
  const maxDist = Math.max(8, Math.hypot(rx, ry) * 0.85);

  ctx.save();
  ctx.fillStyle = rgba(color, alpha);
  let row = 0;
  for (let y = y0; y <= y1; y += spacing) {
    const rowShift = (row % 2) * (spacing * 0.5);
    row++;
    for (let x = x0 + rowShift; x <= x1; x += spacing) {
      const nx = (x - cx) / Math.max(1, rx);
      const ny = (y - cy) / Math.max(1, ry);
      if (nx * nx + ny * ny > 0.94) continue;
      const d = Math.hypot(x - focusX, y - focusY);
      if (d < maxDist) {
        const r = clamp((1.0 - d / maxDist) * maxDotR, 0.75, maxDotR);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/**
 * Renders any closed 1930s celluloid shape (`drawInkCelShape`) with gradient fill,
 * lower-crescent Ben-Day halftone dots, glossy highlight ellipse, and dip-pen ink outline.
 */
export function drawInkCelShape(ctx, pts, opts = {}) {
  if (!pts || pts.length < 3) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const rx = Math.max(6, (maxX - minX) * 0.5);
  const ry = Math.max(6, (maxY - minY) * 0.5);

  const tracePath = () => {
    ctx.beginPath();
    if (opts.smooth !== false && pts.length >= 3) {
      const n = pts.length;
      ctx.moveTo((pts[n - 1][0] + pts[0][0]) * 0.5, (pts[n - 1][1] + pts[0][1]) * 0.5);
      for (let i = 0; i < n; i++) {
        const p0 = pts[i];
        const p1 = pts[(i + 1) % n];
        ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) * 0.5, (p0[1] + p1[1]) * 0.5);
      }
    } else {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.closePath();
  };

  ctx.save();
  tracePath();
  if (opts.gradColors && opts.gradColors.length >= 2) {
    const g = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
    opts.gradColors.forEach((col, idx) => {
      g.addColorStop(idx / (opts.gradColors.length - 1), col);
    });
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = opts.fill || RUBBER_PALETTE.paperCream;
  }
  ctx.fill();

  if (opts.benDay !== false) {
    ctx.save();
    ctx.clip();
    drawBenDayDots(ctx, cx, cy, rx, ry, {
      spacing: opts.dotSpacing ?? 8.0,
      alpha: opts.dotAlpha ?? 0.28,
      color: opts.dotColor || RUBBER_PALETTE.inkBlack,
    });
    if (opts.highlight !== false) {
      ctx.save();
      ctx.translate(cx - rx * 0.32, cy - ry * 0.34);
      ctx.rotate(-0.48);
      ctx.scale(1.0, 0.44);
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(rx, ry) * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = rgba(RUBBER_PALETTE.paperCream, 0.72);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  tracePath();
  ctx.strokeStyle = opts.stroke || RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = opts.lineWidth ?? 4.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

/**
 * Core 1930s Jointless Rubber-Hose Limb Solver (`drawRubberHoseLimb`).
 * Connects any shoulder/hip `p0` to wrist/ankle `p1` with a continuous, kink-free
 * C-curve or S-curve black ink hose, plus optional specular highlight thread or sleeve cuff.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number, y:number}|[number,number]} p0 - Start joint
 * @param {{x:number, y:number}|[number,number]} p1 - End joint
 * @param {object} opts - `{ bend, sCurve, waveAmp, wavePhase, width, color, highlight, cuff }`
 */
export function drawRubberHoseLimb(ctx, p0, p1, opts = {}) {
  const x0 = Array.isArray(p0) ? p0[0] : p0.x;
  const y0 = Array.isArray(p0) ? p0[1] : p0.y;
  const x1 = Array.isArray(p1) ? p1[0] : p1.x;
  const y1 = Array.isArray(p1) ? p1[1] : p1.y;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const span = Math.hypot(dx, dy) || 1;
  const nx = -dy / span;
  const ny = dx / span;

  const bend = opts.bend ?? 0.32;
  const sCurve = opts.sCurve ?? 0.0;
  const waveAmp = opts.waveAmp ?? 0.0;
  const wavePhase = opts.wavePhase ?? 0.0;
  const width = opts.width ?? 11.5;
  const color = opts.color || RUBBER_PALETTE.inkBlack;

  const steps = 16;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const baseX = lerp(x0, x1, u);
    const baseY = lerp(y0, y1, u);
    const cArc = Math.sin(u * Math.PI) * bend * span * 0.45;
    const sArc = Math.sin(u * Math.PI * 2) * sCurve * span * 0.24;
    const wArc = waveAmp !== 0 ? Math.sin(u * Math.PI * 2 + wavePhase) * Math.sin(u * Math.PI) * waveAmp : 0;
    const offset = cArc + sArc + wArc;
    pts.push([baseX + nx * offset, baseY + ny * offset]);
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Outer cream separation rim when crossing dark bodies
  if (opts.creamRim !== false) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = rgba(RUBBER_PALETTE.paperCream, 0.65);
    ctx.lineWidth = width + 3.2;
    ctx.stroke();
  }

  // Main solid India-ink rubber hose
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();

  // Subtle vintage sheen line along the hose curve
  if (opts.highlight !== false && width >= 7) {
    ctx.beginPath();
    for (let i = 2; i < pts.length - 2; i++) {
      const hx = pts[i][0] + nx * (width * 0.22);
      const hy = pts[i][1] + ny * (width * 0.22);
      if (i === 2) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.strokeStyle = rgba(RUBBER_PALETTE.paperCream, 0.35);
    ctx.lineWidth = Math.max(1.2, width * 0.14);
    ctx.stroke();
  }
  ctx.restore();

  const pPrev = pts[pts.length - 2];
  const pLast = pts[pts.length - 1];
  const endAngle = Math.atan2(pLast[1] - pPrev[1], pLast[0] - pPrev[0]);
  return { pts, endAngle, midPt: pts[Math.floor(steps / 2)] };
}

/**
 * Draws an authentic 1930s 4-finger white cartoon glove (`drawCartoonGlove`)
 * with rolled donut wrist cuff and 3 black back-darts.
 * Supports `pose`: `'open' | 'point' | 'fist' | 'wave' | 'grip'`.
 */
export function drawCartoonGlove(ctx, gx, gy, opts = {}) {
  const rot = opts.rot ?? 0;
  const flip = opts.flip ?? false;
  const scale = opts.scale ?? 1.0;
  const pose = opts.pose || 'open';
  const fill = opts.fill || RUBBER_PALETTE.paperCream;
  const stroke = opts.stroke || RUBBER_PALETTE.inkBlack;

  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(rot);
  ctx.scale(flip ? -scale : scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Rolled donut wrist cuff
  ctx.save();
  ctx.scale(1.22, 0.68);
  ctx.beginPath();
  ctx.arc(0, 0, 14.5, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3.2;
  ctx.stroke();
  ctx.restore();

  // 2. Plump palm ball
  ctx.beginPath();
  ctx.arc(0, 15.0, 16.5, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3.2;
  ctx.stroke();

  // 3. Four plump fingers according to pose
  let fingers = [
    [-0.65, 20.0, 7.8],
    [-0.22, 24.0, 8.2],
    [0.22, 22.0, 7.8],
    [0.65, 17.0, 7.2],
  ];
  if (pose === 'point') {
    fingers = [
      [-0.55, 13.0, 7.2],
      [-0.05, 29.0, 8.5],
      [0.32, 13.0, 7.2],
      [0.65, 11.0, 6.8],
    ];
  } else if (pose === 'fist' || pose === 'grip') {
    fingers = [
      [-0.52, 11.5, 8.0],
      [-0.18, 12.5, 8.2],
      [0.18, 12.5, 8.2],
      [0.52, 11.0, 7.6],
    ];
  }

  for (const [fa, fl, fr] of fingers) {
    const fx = fl * Math.sin(fa);
    const fy = 15.0 + fl * Math.cos(fa);
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3.0;
    ctx.stroke();
  }

  // Merge interior palm over finger bases
  ctx.beginPath();
  ctx.arc(0, 15.0, 14.5, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();

  // 4. Three iconic 1930s black back-dart lines
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.4;
  for (const dartDx of [-6.2, 0.0, 6.2]) {
    ctx.beginPath();
    ctx.moveTo(dartDx, 7.5);
    ctx.lineTo(dartDx * 1.15, 19.0);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws a 1930s bulbous cartoon shoe (`drawCartoonShoe`) with heel block, double sole rim,
 * specular toe highlight, and foot-tap angle (`tapAngle`).
 */
export function drawCartoonShoe(ctx, x, y, opts = {}) {
  const scale = opts.scale ?? 1.0;
  const flip = opts.flip ?? false;
  const tapAngle = opts.tapAngle ?? 0;
  const fill = opts.fill || RUBBER_PALETTE.paperCream;
  const stroke = opts.stroke || RUBBER_PALETTE.inkBlack;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -scale : scale, scale);
  // Pivot around heel for foot tapping
  ctx.translate(-8, 0);
  ctx.rotate(-tapAngle);
  ctx.translate(8, 0);

  // Ankle cuff ring
  ctx.save();
  ctx.translate(-4, -10);
  ctx.scale(1.15, 0.55);
  ctx.beginPath();
  ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3.0;
  ctx.stroke();
  ctx.restore();

  // Main bulbous toe + heel silhouette
  ctx.beginPath();
  ctx.moveTo(-14, 4);
  ctx.bezierCurveTo(-16, -8, -4, -10, 4, -8);
  ctx.bezierCurveTo(16, -12, 26, -6, 25, 3);
  ctx.bezierCurveTo(25, 8, 12, 9, -14, 7);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3.2;
  ctx.stroke();

  // Thick vintage sole line & heel block
  ctx.beginPath();
  ctx.moveTo(-14, 4);
  ctx.quadraticCurveTo(6, 6, 24, 3);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // Glossy toe highlight
  ctx.beginPath();
  ctx.arc(14, -3, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = rgba('#FFFFFF', 0.85);
  ctx.fill();

  // Rhythm tap motion ticks when tapping
  if (Math.abs(tapAngle) > 0.06) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(26, 2, 8, -0.45, 0.45);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws parameterized 1930s Pie-Cut (Pac-Man wedge pupil) Cartoon Eyes (`drawPieCutEyes`).
 * Supports `mode`: `'pie' | 'angry' | 'shock' | 'happy' | 'wink' | 'dizzy' | 'squint'`.
 */
export function drawPieCutEyes(ctx, x, y, opts = {}) {
  const mode = opts.mode || 'pie';
  const r = opts.radius ?? 15.0;
  const aspectY = opts.aspectY ?? 1.35;
  const spacing = opts.spacing ?? r * 1.38;
  const lookX = clamp(opts.lookX ?? 0.25, -1, 1);
  const lookY = clamp(opts.lookY ?? -0.05, -1, 1);
  const t = opts.t ?? 0;
  const brows = opts.brows !== false;
  const single = opts.single ?? false;
  const offsets = single ? [0] : [-spacing * 0.5, spacing * 0.5];

  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let idx = 0; idx < offsets.length; idx++) {
    const ex = offsets[idx];
    const ey = 0;
    const isRight = idx === 1;

    ctx.save();
    ctx.translate(ex, ey);

    if (mode === 'happy' || (mode === 'wink' && isRight)) {
      ctx.beginPath();
      ctx.arc(0, r * 0.2, r * 0.85, Math.PI * 1.12, Math.PI * 1.88);
      ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
      ctx.lineWidth = Math.max(3.5, r * 0.32);
      ctx.stroke();
    } else {
      // Tall oval cream eye socket
      ctx.save();
      const sy = mode === 'shock' ? aspectY * 1.15 : aspectY;
      ctx.scale(1.0, sy);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = RUBBER_PALETTE.paperCream;
      ctx.fill();
      ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
      ctx.lineWidth = Math.max(2.4, r * 0.2);
      ctx.stroke();

      if (mode === 'dizzy') {
        const rot = (isRight ? 1 : -1) * t * 4.5;
        ctx.rotate(rot);
        const xr = r * 0.42;
        ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
        ctx.lineWidth = Math.max(2.8, r * 0.24);
        ctx.beginPath();
        ctx.moveTo(-xr, -xr);
        ctx.lineTo(xr, xr);
        ctx.moveTo(xr, -xr);
        ctx.lineTo(-xr, xr);
        ctx.stroke();
      } else if (mode === 'squint') {
        const dir = isRight ? -1 : 1;
        ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
        ctx.lineWidth = Math.max(2.8, r * 0.24);
        ctx.beginPath();
        ctx.moveTo(-dir * r * 0.45, -r * 0.42);
        ctx.lineTo(dir * r * 0.38, 0);
        ctx.lineTo(-dir * r * 0.45, r * 0.42);
        ctx.stroke();
      } else if (mode === 'shock') {
        ctx.beginPath();
        ctx.arc(lookX * r * 0.28, lookY * r * 0.22, r * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = RUBBER_PALETTE.inkBlack;
        ctx.fill();
      } else {
        // Classic 1930s Pac-Man Pie-Cut pupil
        const px = lookX * r * 0.28;
        const py = lookY * r * 0.22;
        const pr = r * 0.62;
        const wedgeAng = opts.wedgeAngle ?? (lookX >= 0 ? -0.45 : Math.PI + 0.45);
        ctx.translate(px, py);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, pr, wedgeAng + 0.38, wedgeAng + Math.PI * 2 - 0.38);
        ctx.closePath();
        ctx.fillStyle = RUBBER_PALETTE.inkBlack;
        ctx.fill();
      }
      ctx.restore();
    }

    // Expressive 1930s Eyebrow
    if (brows) {
      const browY = -r * aspectY - r * 0.35;
      ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
      ctx.lineWidth = Math.max(3.0, r * 0.25);
      ctx.beginPath();
      if (mode === 'angry') {
        const slant = isRight ? -1 : 1;
        ctx.moveTo(-r * 0.85, browY - slant * r * 0.28);
        ctx.lineTo(r * 0.85, browY + slant * r * 0.28);
      } else if (mode === 'dizzy') {
        ctx.moveTo(-r * 0.85, browY);
        ctx.bezierCurveTo(
          -r * 0.3,
          browY - r * 0.35 + Math.sin(t * 14) * 3,
          r * 0.3,
          browY + r * 0.25,
          r * 0.85,
          browY - r * 0.15
        );
      } else {
        const lift = mode === 'shock' ? -r * 0.25 : 0;
        ctx.arc(0, browY + r * 0.35 + lift, r * 0.85, Math.PI * 1.15, Math.PI * 1.85);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
  ctx.restore();
}

/**
 * Draws an expressive 1930s cartoon mouth (`drawCartoonMouth`):
 * `mode`: `'grin' | 'sing' | 'roar' | 'whistle' | 'ooh' | 'teeth'`.
 */
export function drawCartoonMouth(ctx, x, y, opts = {}) {
  const mode = opts.mode || 'grin';
  const w = opts.width ?? 28;
  const h = opts.height ?? 18;
  const t = opts.t ?? 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (mode === 'whistle' || mode === 'ooh') {
    const r = Math.min(w, h) * 0.45 * (1 + Math.sin(t * 12) * 0.1);
    ctx.beginPath();
    ctx.arc(w * 0.15, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.inkBlack;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.paperCream;
    ctx.lineWidth = 2.0;
    ctx.stroke();
  } else if (mode === 'sing' || mode === 'roar') {
    const openH = mode === 'roar' ? h * 1.35 : h;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -openH * 0.15);
    ctx.quadraticCurveTo(0, -openH * 0.45, w * 0.5, -openH * 0.1);
    ctx.bezierCurveTo(w * 0.55, openH * 0.85, -w * 0.55, openH * 0.85, -w * 0.5, -openH * 0.15);
    ctx.closePath();
    ctx.fillStyle = RUBBER_PALETTE.inkBlack;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.0;
    ctx.stroke();

    // Vibrating cartoon tongue inside open throat
    ctx.save();
    ctx.clip();
    const wag = Math.sin(t * 16) * (w * 0.08);
    ctx.beginPath();
    ctx.arc(wag - w * 0.12, openH * 0.48, w * 0.34, 0, Math.PI * 2);
    ctx.arc(wag + w * 0.14, openH * 0.50, w * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.tcCoral;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -openH * 0.15);
    ctx.quadraticCurveTo(0, -openH * 0.45, w * 0.5, -openH * 0.1);
    ctx.bezierCurveTo(w * 0.55, openH * 0.85, -w * 0.55, openH * 0.85, -w * 0.5, -openH * 0.15);
    ctx.closePath();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.0;
    ctx.stroke();
  } else if (mode === 'teeth') {
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.5, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = RUBBER_PALETTE.paperCream;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    for (const tx of [-w * 0.22, 0, w * 0.22]) {
      ctx.beginPath();
      ctx.moveTo(tx, 2);
      ctx.lineTo(tx, h * 0.45);
      ctx.stroke();
    }
  } else {
    // Cheerful vintage grin with cheek dimple arc
    ctx.beginPath();
    ctx.arc(0, -h * 0.15, w * 0.5, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-w * 0.46, -h * 0.08, 4.5, 0.6 * Math.PI, 1.4 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws a 1930s Technicolor 4-Point Concave Star (`drawFourPointStar` ✦) with double-ink outline
 * and optional vibration ticks (`withTicks`).
 */
export function drawFourPointStar(ctx, cx, cy, r = 24, opts = {}) {
  const rot = opts.rot ?? 0;
  const innerR = opts.innerR ?? r * 0.28;
  const withHalo = opts.withHalo !== false;
  const withTicks = opts.withTicks ?? true;

  const traceStar = () => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = rot + (i * Math.PI) / 4;
      const rad = i % 2 === 0 ? r : innerR;
      const px = Math.cos(ang) * rad;
      const py = Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  ctx.save();
  ctx.translate(cx, cy);

  if (withHalo && r >= 10) {
    const halo = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 2.0);
    halo.addColorStop(0.0, rgba('#FFFFFF', 0.88));
    halo.addColorStop(0.45, rgba(RUBBER_PALETTE.tcGold, 0.52));
    halo.addColorStop(1.0, rgba(RUBBER_PALETTE.tcBlue, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.0, 0, Math.PI * 2);
    ctx.fill();
  }

  traceStar();
  ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = Math.max(3.5, r * 0.22);
  ctx.lineJoin = 'round';
  ctx.stroke();

  traceStar();
  if (opts.color) {
    ctx.fillStyle = opts.color;
  } else {
    const sg = ctx.createLinearGradient(-r, -r, r, r);
    sg.addColorStop(0.0, RUBBER_PALETTE.tcBlue);
    sg.addColorStop(0.48, RUBBER_PALETTE.tcViolet);
    sg.addColorStop(0.82, RUBBER_PALETTE.tcCoral);
    sg.addColorStop(1.0, RUBBER_PALETTE.tcGold);
    ctx.fillStyle = sg;
  }
  ctx.fill();
  ctx.strokeStyle = RUBBER_PALETTE.paperCream;
  ctx.lineWidth = Math.max(1.4, r * 0.06);
  ctx.stroke();

  if (withTicks && r >= 14) {
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = Math.max(2.0, r * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-r * 1.28, 0, r * 0.55, Math.PI * 0.72, Math.PI * 1.28);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 1.28, 0, r * 0.55, -Math.PI * 0.28, Math.PI * 0.28);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws vintage cartoon vibration / motion arc ticks (`drawVibrationTicks`) around a ringing bell or key.
 */
export function drawVibrationTicks(ctx, cx, cy, r = 36, opts = {}) {
  const count = opts.count ?? 2;
  const color = opts.color || RUBBER_PALETTE.inkBlack;
  const lw = opts.lineWidth ?? 2.8;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(opts.rot ?? 0);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const rad = r + i * 9;
    ctx.beginPath();
    ctx.arc(0, 0, rad, -0.42, 0.42);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, rad, Math.PI - 0.42, Math.PI + 0.42);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws a 1930s comic impact starburst (`drawComicBurst`, e.g. `CLANG! / BAM! / POW!`).
 */
export function drawComicBurst(ctx, x, y, radius = 110, opts = {}) {
  const scale = clamp(opts.scale ?? 1.0, 0, 2);
  if (scale <= 0.02) return;
  const spikes = opts.spikes ?? 16;
  const label = opts.label || '';

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';

  // Outer cream spike polygon
  ctx.beginPath();
  for (let i = 0; i < spikes; i++) {
    const ang = (i / spikes) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : radius * 0.44;
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = RUBBER_PALETTE.paperCream;
  ctx.fill();
  ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = 5.0;
  ctx.stroke();

  // Inner golden starburst core
  ctx.beginPath();
  for (let i = 0; i < spikes; i++) {
    const ang = (i / spikes) * Math.PI * 2 + 0.1;
    const r = i % 2 === 0 ? radius * 0.68 : radius * 0.28;
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = opts.coreColor || RUBBER_PALETTE.tcGold;
  ctx.fill();
  ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = 3.2;
  ctx.stroke();

  if (label) {
    ctx.font = `900 ${Math.round(radius * 0.34)}px Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = RUBBER_PALETTE.paperCream;
    ctx.lineWidth = 7.0;
    ctx.strokeText(label, 0, 2);
    ctx.fillStyle = RUBBER_PALETTE.inkBlack;
    ctx.fillText(label, 0, 2);
  }

  ctx.restore();
}

/**
 * Draws a vintage cartoon overhead pop icon (`drawPopIcon`: `'!' | '?' | '♪' | '♫'`).
 */
export function drawPopIcon(ctx, x, y, type = '!', opts = {}) {
  const alpha = clamp(opts.alpha ?? 1.0, 0, 1);
  const scale = opts.scale ?? 1.0;
  if (alpha <= 0.02 || scale <= 0.02) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(opts.rot ?? 0);
  ctx.font = '900 58px Impact, "Noto Serif CJK SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(RUBBER_PALETTE.paperCream, alpha);
  ctx.lineWidth = 11.0;
  ctx.strokeText(type, 0, 0);
  ctx.fillStyle = rgba(opts.color || RUBBER_PALETTE.inkBlack, alpha);
  ctx.fillText(type, 0, 0);
  ctx.restore();
}

/**
 * Renders an expanding 3-Strip Technicolor Jazz Soundwave Ring (`drawTechnicolorRing`)
 * that transforms sepia ink into vivid chromatic rings (Cyan, Violet, Coral, Gold).
 */
export function drawTechnicolorRing(ctx, cx, cy, radius = 320, opts = {}) {
  const alpha = clamp(opts.alpha ?? 1.0, 0, 1);
  if (radius <= 6 || alpha <= 0.01) return;

  ctx.save();
  ctx.translate(cx, cy);
  if (opts.scaleY) ctx.scale(1.0, opts.scaleY);

  const aura = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius * 1.05);
  aura.addColorStop(0.0, rgba('#F5FAFF', 0.34 * alpha));
  aura.addColorStop(0.55, rgba(RUBBER_PALETTE.tcViolet, 0.20 * alpha));
  aura.addColorStop(0.85, rgba(RUBBER_PALETTE.tcCoral, 0.16 * alpha));
  aura.addColorStop(1.0, rgba(RUBBER_PALETTE.tcGold, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.05, 0, Math.PI * 2);
  ctx.fill();

  const bands = [
    [1.00, 5.0, RUBBER_PALETTE.paperCream, 0.92],
    [0.97, 6.8, RUBBER_PALETTE.tcCyan, 0.84],
    [0.94, 5.8, RUBBER_PALETTE.tcViolet, 0.74],
    [0.90, 7.5, RUBBER_PALETTE.tcCoral, 0.64],
    [0.86, 4.8, RUBBER_PALETTE.tcGold, 0.54],
  ];
  for (const [rMult, lw, col, a] of bands) {
    ctx.beginPath();
    ctx.arc(0, 0, radius * rMult, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(col, a * alpha);
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  const notches = 32;
  ctx.strokeStyle = rgba(RUBBER_PALETTE.paperCream, 0.72 * alpha);
  ctx.lineWidth = 2.2;
  for (let i = 0; i < notches; i++) {
    const ang = (i / notches) * Math.PI * 2;
    const r1 = radius * 0.98;
    const r2 = radius * (1.03 + 0.03 * Math.sin(i * 3.0));
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
    ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
    ctx.stroke();
  }

  ctx.restore();
}

// ============================================================================
// TIER 3 · 35MM CELLULOID STAGE, ELASTIC PIANO ROAD & ANTHROPOMORPHIC KIT
// ============================================================================

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arc(x + w - rad, y + rad, rad, -Math.PI * 0.5, 0);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arc(x + w - rad, y + h - rad, rad, 0, Math.PI * 0.5);
  ctx.lineTo(x + rad, y + h);
  ctx.arc(x + rad, y + h - rad, rad, Math.PI * 0.5, Math.PI);
  ctx.lineTo(x, y + rad);
  ctx.arc(x + rad, y + rad, rad, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

/**
 * Renders the 1930s Celluloid Stage Backdrop (`drawCelluloidBackdrop`):
 *   - Aged warm celluloid sky gradient (`skyTop -> skyMid -> skyBot`)
 *   - Musical staff wave lines in the backdrop
 *   - Perspective wooden stage floorboards (`floorTop -> floorBot`) aligned with virtual stage horizon
 *   - Dual conical 1930s theater spotlights
 *   - World-space vertical celluloid hair scratches & dust flecks
 */
export function drawCelluloidBackdrop(ctx, width, height, look = RUBBER_LOOK_PRESETS.sepia, camOffset = [0, 0], frame = {}) {
  const lk = RUBBER_LOOK_PRESETS[look] || look || RUBBER_LOOK_PRESETS.sepia;
  const [ox = 0] = camOffset;
  const t = frame?.t ?? 0;
  const vpScale = Math.min(width / 1920, height / 1080);
  // Virtual horizon y=620 mapped to physical screen Y so 16:9, 9:16, and 1:1 align with characters
  const horizonY = height * 0.5 + (620 - 540) * vpScale;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // 1. Aged celluloid sky radial gradient
  const skyG = ctx.createRadialGradient(
    width * 0.5,
    height * 0.36,
    Math.min(width, height) * 0.08,
    width * 0.5,
    height * 0.42,
    Math.max(width, height) * 0.72
  );
  skyG.addColorStop(0.0, lk.skyTop);
  skyG.addColorStop(0.62, lk.skyMid);
  skyG.addColorStop(1.0, lk.skyBot);
  ctx.fillStyle = skyG;
  ctx.fillRect(0, 0, width, height);

  // 2. Backdrop undulating musical staff lines
  ctx.strokeStyle = rgba(lk.staffColor || RUBBER_PALETTE.sepiaMid, 0.38);
  ctx.lineWidth = Math.max(1.5, 2.0 * vpScale);
  const staffBaseY = horizonY - 115 * vpScale;
  const sway = Math.sin(t * 2.2) * 10 * vpScale;
  for (let i = 0; i < 5; i++) {
    const sy = staffBaseY + i * 16 * vpScale;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.bezierCurveTo(
      width * 0.28,
      sy - 26 * vpScale + sway,
      width * 0.64,
      sy + 30 * vpScale - sway,
      width,
      sy - 12 * vpScale
    );
    ctx.stroke();
  }

  // 3. Perspective wooden stage floorboards below `horizonY`
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizonY, width, height - horizonY);
  ctx.clip();

  const floorG = ctx.createLinearGradient(0, horizonY, 0, height);
  floorG.addColorStop(0.0, lk.floorTop);
  floorG.addColorStop(1.0, lk.floorBot);
  ctx.fillStyle = floorG;
  ctx.fillRect(0, horizonY, width, height - horizonY);

  //Horizon baseboard trim
  ctx.strokeStyle = rgba(RUBBER_PALETTE.inkBlack, 0.55);
  ctx.lineWidth = Math.max(2.0, 3.2 * vpScale);
  ctx.beginPath();
  ctx.moveTo(0, horizonY + 1);
  ctx.lineTo(width, horizonY + 1);
  ctx.stroke();

  const vanishX = width * 0.54 - ox * 0.25 * vpScale;
  const vanishY = horizonY - 140 * vpScale;
  const nPlanks = 24;
  ctx.strokeStyle = rgba(RUBBER_PALETTE.sepiaDark, 0.42);
  ctx.fillStyle = rgba(RUBBER_PALETTE.sepiaDark, 0.32);
  ctx.lineWidth = Math.max(1.8, 2.8 * vpScale);

  for (let i = -6; i <= nPlanks + 6; i++) {
    const botX = -width * 0.15 + (i * (width * 1.3)) / nPlanks - ox * vpScale;
    ctx.beginPath();
    ctx.moveTo(vanishX, vanishY);
    ctx.lineTo(botX, height + 40);
    ctx.stroke();

    for (const frac of [0.22, 0.52, 0.82]) {
      const py = lerp(horizonY, height, frac);
      const tPlank = (py - vanishY) / Math.max(1, height + 40 - vanishY);
      const px = vanishX + (botX - vanishX) * tPlank;
      ctx.beginPath();
      ctx.arc(px, py, 2.5 * vpScale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // 4. Dual 1930s Conical Theater Spotlights
  const spotAlpha = lk.spotAlpha ?? 0.44;
  const spotCol = lk.spotColor || '#FFF8DE';
  const spots = [
    { topX1: width * 0.12, topX2: width * 0.19, botX1: width * 0.18, botX2: width * 0.52, cx: width * 0.34 },
    { topX1: width * 0.81, topX2: width * 0.88, botX1: width * 0.54, botX2: width * 0.90, cx: width * 0.72 },
  ];
  for (const sp of spots) {
    const sg = ctx.createRadialGradient(
      sp.cx,
      horizonY * 0.88,
      20 * vpScale,
      sp.cx,
      horizonY * 0.65,
      Math.max(width, height) * 0.45
    );
    sg.addColorStop(0.0, rgba(spotCol, spotAlpha));
    sg.addColorStop(0.55, rgba(spotCol, spotAlpha * 0.48));
    sg.addColorStop(1.0, rgba(spotCol, 0));
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(sp.topX1, 0);
    ctx.lineTo(sp.topX2, 0);
    ctx.lineTo(sp.botX2, height + 40);
    ctx.lineTo(sp.botX1, height + 40);
    ctx.closePath();
    ctx.fill();
  }

  // In 9:16 portrait viewports, add vintage Broadway chandelier medallion & front footlight shell
  if (height > width * 1.15) {
    const chanY = height * 0.16;
    const chanX = width * 0.5;
    ctx.save();
    ctx.strokeStyle = rgba(RUBBER_PALETTE.inkBlack, 0.65);
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(chanX, 0);
    ctx.lineTo(chanX, chanY - 26);
    ctx.stroke();

    // Art-Deco Broadway theatre chandelier / acoustic sunburst medallion
    const glow = ctx.createRadialGradient(chanX, chanY, 8, chanX, chanY, 155);
    glow.addColorStop(0.0, rgba(spotCol, 0.55));
    glow.addColorStop(0.5, rgba(RUBBER_PALETTE.tcGold, 0.18));
    glow.addColorStop(1.0, rgba(spotCol, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(chanX, chanY, 155, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(chanX, chanY, 32, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.brassGold;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    for (const dx of [-58, 0, 58]) {
      ctx.beginPath();
      ctx.arc(chanX + dx, chanY + 26, 12, 0, Math.PI * 2);
      ctx.fillStyle = RUBBER_PALETTE.paperCream;
      ctx.fill();
      ctx.stroke();
    }

    // Foreground vintage brass footlight shells at bottom of 9:16 stage
    const footY = height - 48;
    for (const fx of [width * 0.24, width * 0.5, width * 0.76]) {
      const fg = ctx.createRadialGradient(fx, footY, 6, fx, footY - 80, 180);
      fg.addColorStop(0.0, rgba(spotCol, 0.36));
      fg.addColorStop(1.0, rgba(spotCol, 0));
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(fx, footY - 40, 160, Math.PI, 0);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(fx, footY, 26, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = RUBBER_PALETTE.brassGold;
      ctx.fill();
      ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
      ctx.lineWidth = 3.2;
      ctx.stroke();
    }
    ctx.restore();
  }

  // 5. Subtle 12fps Celluloid Vertical Hair Scratches & Dust Specks
  const filmTick = Math.floor(t * 12);
  const rng = mulberry32(1934 + filmTick * 17);
  const scratchRatios = [0.18, 0.31, 0.52, 0.74, 0.86];
  for (const sr of scratchRatios) {
    if (rng() > 0.65) continue;
    const sx = width * sr + (rng() - 0.5) * 14;
    const y0 = rng() * height * 0.6;
    const segLen = (80 + rng() * 260) * vpScale;
    const isLight = rng() < 0.65;
    ctx.strokeStyle = isLight ? rgba(RUBBER_PALETTE.paperCream, 0.32) : rgba(RUBBER_PALETTE.inkBlack, 0.24);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(sx, y0);
    ctx.lineTo(sx + (rng() - 0.5) * 2, Math.min(height, y0 + segLen));
    ctx.stroke();
  }

  for (let d = 0; d < 14; d++) {
    const dx = (0.08 + rng() * 0.84) * width;
    const dy = (0.05 + rng() * 0.90) * height;
    const dr = 0.8 + rng() * 1.4;
    ctx.fillStyle = rng() < 0.5 ? rgba(RUBBER_PALETTE.paperCream, 0.28) : rgba(RUBBER_PALETTE.inkBlack, 0.22);
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws the 1930s Broadway Scalloped Valance (Pelmet) and Left/Right Draped Velvet Curtains (`drawTheaterCurtains`).
 * Automatically adapts to `16:9`, `9:16`, and `1:1` viewports.
 * Supports `openProg` (`0.0` = closed curtains at center, `1.0` = tied back at stage edges)
 * and `bounceDy` (`132 BPM` rhythmic curtain bounce).
 */
export function drawTheaterCurtains(ctx, w = 1920, h = 1080, opts = {}) {
  const vpW = ctx.__inkViewport?.width || w;
  const vpH = ctx.__inkViewport?.height || h;
  const openU = clamp(opts.openProg ?? 1.0, 0, 1);
  const closeAmt = 1.0 - openU;
  const bounceDy = opts.bounceDy ?? 0.0;
  const lk = RUBBER_LOOK_PRESETS[opts.look] || opts.look || RUBBER_LOOK_PRESETS.sepia;

  const isPortrait = vpW < vpH;
  const isSquare = Math.abs(vpW - vpH) < 32;
  const borderW = isPortrait ? Math.round(vpW * 0.042) : isSquare ? 52 : 84;
  const stageW = vpW - borderW * 2;
  const halfStageW = stageW * 0.5 + 4;
  const openTopW = isPortrait ? stageW * 0.12 : stageW * 0.102;
  const openWaistW = isPortrait ? stageW * 0.04 : stageW * 0.032;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. Left & Right Velvet Curtains
  for (const [cxEdge, dirSign] of [
    [borderW, 1],
    [vpW - borderW, -1],
  ]) {
    const wTop = openTopW * openU + halfStageW * closeAmt;
    const wWaist = openWaistW * openU + halfStageW * Math.pow(closeAmt, 1.15);
    const wBot = 4.0 * openU + halfStageW * Math.pow(closeAmt, 0.88);
    const yBot = vpH * 0.55 * openU + (vpH + 24) * (1.0 - Math.pow(openU, 1.6));
    const sashY = vpH * 0.39 + bounceDy * 0.5;

    const xTop = cxEdge + dirSign * wTop;
    const xWaist = cxEdge + dirSign * wWaist;
    const xBot = cxEdge + dirSign * wBot;

    const traceCurtain = () => {
      ctx.beginPath();
      ctx.moveTo(cxEdge, 0);
      ctx.lineTo(xTop, 0);
      ctx.bezierCurveTo(
        cxEdge + dirSign * (wTop * 0.96),
        sashY * 0.45,
        xWaist + dirSign * (16 * openU),
        sashY - 36,
        xWaist,
        sashY
      );
      ctx.bezierCurveTo(
        xWaist - dirSign * (12 * openU),
        sashY + (yBot - sashY) * 0.48,
        xBot + dirSign * (24 * closeAmt),
        yBot - 68,
        xBot,
        yBot
      );
      ctx.lineTo(cxEdge, yBot);
      ctx.closePath();
    };

    ctx.save();
    traceCurtain();
    const curtG = ctx.createLinearGradient(cxEdge, 0, cxEdge + dirSign * Math.max(140, wTop), 0);
    curtG.addColorStop(0.0, lk.curtainFold || '#1E1612');
    curtG.addColorStop(0.5, lk.curtainMain || '#5C2428');
    curtG.addColorStop(0.85, lk.curtainFold || '#281214');
    curtG.addColorStop(1.0, mixHex(lk.curtainMain || '#5C2428', '#8C3B3F', 0.35));
    ctx.fillStyle = curtG;
    ctx.fill();

    // Pleated vertical velvet folds inside curtain clip
    ctx.save();
    ctx.clip();
    const nFolds = 6;
    for (let f = 1; f <= nFolds; f++) {
      const frac = f / (nFolds + 1);
      const fxTop = cxEdge + dirSign * (wTop * frac);
      const fxWaist = cxEdge + dirSign * (wWaist * frac);
      const fxBot = cxEdge + dirSign * (wBot * frac);

      ctx.beginPath();
      ctx.moveTo(fxTop, 0);
      ctx.bezierCurveTo(fxTop, sashY * 0.46, fxWaist, sashY - 36, fxWaist, sashY);
      ctx.bezierCurveTo(fxWaist, sashY + 75, fxBot, yBot - 68, fxBot, yBot);
      ctx.strokeStyle = rgba('#0E0806', 0.44);
      ctx.lineWidth = 11 * (0.4 + 0.6 * closeAmt);
      ctx.stroke();

      ctx.strokeStyle = rgba(RUBBER_PALETTE.inkBlack, 0.72);
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }

    // Golden braided inner curtain trim
    ctx.beginPath();
    ctx.moveTo(xTop - dirSign * 7, 0);
    ctx.bezierCurveTo(
      cxEdge + dirSign * (wTop * 0.96 - 7),
      sashY * 0.45,
      xWaist + dirSign * (16 * openU - 7),
      sashY - 36,
      xWaist - dirSign * 7,
      sashY
    );
    ctx.bezierCurveTo(
      xWaist - dirSign * (12 * openU + 7),
      sashY + (yBot - sashY) * 0.48,
      xBot + dirSign * (24 * closeAmt - 7),
      yBot - 68,
      xBot - dirSign * 7,
      yBot
    );
    ctx.strokeStyle = rgba(RUBBER_PALETTE.brassGold, 0.86);
    ctx.lineWidth = 4.2;
    ctx.stroke();
    ctx.restore();

    traceCurtain();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 4.2;
    ctx.stroke();

    // Golden Sash Tie-Back Rope & Medallion
    const sashCx = cxEdge + dirSign * (wWaist * 0.72 + 12);
    ctx.beginPath();
    ctx.moveTo(cxEdge, sashY - 8);
    ctx.quadraticCurveTo(sashCx, sashY + 8, xWaist, sashY);
    ctx.strokeStyle = RUBBER_PALETTE.brassGold;
    ctx.lineWidth = 7.5;
    ctx.stroke();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(sashCx, sashY, isPortrait ? 11 : 14, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.brassGold;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 2.8;
    ctx.stroke();
    ctx.restore();
  }

  // 2. Top Scalloped Valance (Pelmet) with Golden Tassels
  ctx.save();
  if (bounceDy !== 0) ctx.translate(0, bounceDy);
  const pelmetH = isPortrait ? 92 : isSquare ? 98 : 122;
  const nScallops = isPortrait ? 10 : 16;
  const dx = stageW / nScallops;

  ctx.beginPath();
  ctx.moveTo(borderW, -20);
  ctx.lineTo(vpW - borderW, -20);
  ctx.lineTo(vpW - borderW, pelmetH * 0.38);
  for (let i = nScallops - 1; i >= 0; i--) {
    const xR = borderW + (i + 1) * dx;
    const xL = borderW + i * dx;
    const yBot = pelmetH + 9 * Math.sin(i * 0.8);
    ctx.bezierCurveTo(
      xR - dx * 0.12,
      yBot,
      xL + dx * 0.12,
      yBot,
      xL,
      pelmetH * 0.36 + 6 * Math.sin(i * 0.5)
    );
  }
  ctx.closePath();

  const valG = ctx.createLinearGradient(0, 0, 0, pelmetH + 12);
  valG.addColorStop(0.0, lk.curtainFold || '#221A15');
  valG.addColorStop(0.7, lk.curtainMain || '#4E2226');
  valG.addColorStop(1.0, lk.curtainFold || '#1A120E');
  ctx.fillStyle = valG;
  ctx.fill();
  ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = 4.2;
  ctx.stroke();

  for (let i = 0; i < nScallops; i++) {
    const xm = borderW + (i + 0.5) * dx;
    const ym = pelmetH + 8 * Math.sin(i * 0.8);
    ctx.beginPath();
    ctx.moveTo(xm, ym - 2);
    ctx.lineTo(xm, ym + 15);
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 2.0;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(xm, ym + 19, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.brassGold;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 2.0;
    ctx.stroke();
  }

  for (let i = 1; i < nScallops; i++) {
    const xf = borderW + i * dx;
    ctx.beginPath();
    ctx.moveTo(xf, 0);
    ctx.bezierCurveTo(xf - 6, pelmetH * 0.38, xf + 5, pelmetH * 0.72, xf, pelmetH * 0.36);
    ctx.strokeStyle = rgba(RUBBER_PALETTE.inkBlack, 0.58);
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
}

/**
 * Draws authentic 1930s 35mm celluloid film margins with rounded sprocket holes (`draw35mmSprocketOverlay`).
 * Automatically adapts margin width to `16:9` (`84px`), `1:1` (`52px`), and `9:16` (`~45px`).
 */
export function draw35mmSprocketOverlay(ctx, w = 1920, h = 1080, opts = {}) {
  const vpW = ctx.__inkViewport?.width || w;
  const vpH = ctx.__inkViewport?.height || h;
  const t = opts.t ?? 0;

  const isPortrait = vpW < vpH;
  const isSquare = Math.abs(vpW - vpH) < 32;
  const borderW = isPortrait ? Math.round(vpW * 0.042) : isSquare ? 52 : 84;
  const scale = borderW / 84;
  const sprocketW = 34 * scale;
  const sprocketH = 50 * scale;
  const sprocketR = 7 * scale;
  const spacing = 76 * scale;
  const scrollOffset = ((t * 48 * scale) % spacing + spacing) % spacing;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  for (const bx of [0, vpW - borderW]) {
    const g = ctx.createLinearGradient(bx, 0, bx + borderW, 0);
    g.addColorStop(0.0, '#171412');
    g.addColorStop(0.5, '#221D1A');
    g.addColorStop(1.0, '#14110F');
    ctx.fillStyle = g;
    ctx.fillRect(bx, 0, borderW, vpH);

    const edgeX = bx === 0 ? borderW : vpW - borderW;
    ctx.strokeStyle = rgba('#4A3F35', 0.85);
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(edgeX, 0);
    ctx.lineTo(edgeX, vpH);
    ctx.stroke();

    const cx = bx + borderW * 0.5;
    const nSprockets = Math.ceil(vpH / spacing) + 2;
    for (let i = -1; i < nSprockets; i++) {
      const cy = 38 * scale + i * spacing + scrollOffset;
      const sx = cx - sprocketW * 0.5;
      const sy = cy - sprocketH * 0.5;

      drawRoundedRectPath(ctx, sx - 1, sy - 1, sprocketW + 2, sprocketH + 2, sprocketR);
      ctx.fillStyle = 'rgba(10, 8, 8, 0.95)';
      ctx.fill();

      const holeG = ctx.createLinearGradient(sx, sy, sx + sprocketW, sy + sprocketH);
      holeG.addColorStop(0.0, '#EBE0C9');
      holeG.addColorStop(1.0, '#DBD0B5');
      drawRoundedRectPath(ctx, sx, sy, sprocketW, sprocketH, sprocketR);
      ctx.fillStyle = holeG;
      ctx.fill();
      ctx.strokeStyle = 'rgba(30, 26, 23, 0.38)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Draws the classic 1930s 35mm film leader crosshair & countdown (`draw35mmCountdown`).
 */
export function draw35mmCountdown(ctx, w = 1920, h = 1080, num = 3, alpha = 1.0) {
  const a = clamp(alpha, 0, 1);
  if (a <= 0.01) return;
  const cx = w * 0.5;
  const cy = h * 0.5;

  ctx.save();
  ctx.fillStyle = rgba('#14100D', 0.18 * a);
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = rgba(RUBBER_PALETTE.paperCream, 0.86 * a);
  ctx.lineWidth = 5.0;
  ctx.beginPath();
  ctx.arc(cx, cy, 240, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.arc(cx, cy, 185, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - 280, cy);
  ctx.lineTo(cx + 280, cy);
  ctx.moveTo(cx, cy - 280);
  ctx.lineTo(cx, cy + 280);
  ctx.stroke();

  ctx.font = '900 220px Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(RUBBER_PALETTE.inkBlack, a);
  ctx.lineWidth = 10.0;
  ctx.strokeText(String(num), cx, cy + 8);
  ctx.fillStyle = rgba(RUBBER_PALETTE.paperCream, a);
  ctx.fillText(String(num), cx, cy + 8);
  ctx.restore();
}

/**
 * Draws the 1930s circular black Iris-In / Iris-Out transition (`drawIrisTransition`).
 * Covers the full viewport across `16:9`, `9:16`, and `1:1` aspect ratios.
 */
export function drawIrisTransition(ctx, w = 1920, h = 1080, cx = 960, cy = 540, radius = 400, opts = {}) {
  const r = Math.max(0, radius);
  if (r >= 2200) return;

  ctx.save();
  ctx.beginPath();
  // Oversized outer rect so 9:16 and 1:1 viewports are 100% covered even inside `beginLayer(1.0)`
  ctx.rect(-2000, -2000, 6000, 6000);
  if (r > 0.5) {
    ctx.moveTo(cx + r, cy);
    ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
  }
  ctx.fillStyle = opts.color || '#100D0B';
  ctx.fill('evenodd');

  if (r > 2) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = RUBBER_PALETTE.brassGold;
    ctx.lineWidth = 4.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 4.0;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Evaluates a point `(x, y)` and tangent along a Catmull-Rom ribbon spline (`evalElasticRibbonSpline`).
 */
export function evalElasticRibbonSpline(controlPts, u) {
  const pts = controlPts && controlPts.length >= 2 ? controlPts : [[100, 900], [1800, 700]];
  const n = pts.length - 1;
  const clampedU = clamp(u, 0, 1);
  const scaled = clampedU * n;
  const idx = Math.min(n - 1, Math.max(0, Math.floor(scaled)));
  const lt = scaled - idx;

  const p0 = pts[Math.max(0, idx - 1)];
  const p1 = pts[idx];
  const p2 = pts[Math.min(n, idx + 1)];
  const p3 = pts[Math.min(n, idx + 2)];
  const tt = lt * lt;
  const ttt = tt * lt;

  const x =
    0.5 *
    (2 * p1[0] +
      (-p0[0] + p2[0]) * lt +
      (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * tt +
      (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * ttt);
  const y =
    0.5 *
    (2 * p1[1] +
      (-p0[1] + p2[1]) * lt +
      (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * tt +
      (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * ttt);
  return [x, y];
}

/**
 * Renders the 3D Perspective S-Curved Undulating Rubber-Hose Piano Keyboard Road (`drawElasticKeyboardRoad`).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<[number,number]>} controlPts - Spine control points for the keyboard road
 * @param {object} opts
 * @param {number} [opts.numKeys=44]
 * @param {number} [opts.keyWidth=135]
 * @param {Array<{x:number, y:number, dip?:number, radius?:number}>} [opts.contacts=[]] - Physical foot/note compressions
 * @param {Array<{x:number, y:number, r:number}>} [opts.rings=[]] - Expanding Technicolor rings tinting the keys
 */
export function drawElasticKeyboardRoad(ctx, controlPts, opts = {}) {
  const spinePts =
    controlPts && controlPts.length >= 2
      ? controlPts
      : [
          [84, 1030],
          [290, 910],
          [530, 755],
          [700, 680],
          [880, 660],
          [1140, 690],
          [1360, 730],
          [1540, 750],
        ];
  const nKeys = opts.numKeys ?? 44;
  const baseKeyLength = opts.keyWidth ?? 135.0;
  const contacts = opts.contacts || [];
  const rings = opts.rings || [];
  const t = opts.t ?? 0;
  const waveAmp = opts.waveAmp ?? 0;

  const keyGeom = [];
  let maxDip = 0;
  let maxDipCenter = null;

  for (let k = 0; k < nKeys; k++) {
    const t0 = k / nKeys;
    const t1 = (k + 0.92) / nKeys;
    const [x0, rawY0] = evalElasticRibbonSpline(spinePts, t0);
    const [x1, rawY1] = evalElasticRibbonSpline(spinePts, t1);
    const wOff0 = waveAmp !== 0 ? Math.sin(t0 * Math.PI * 3 - t * 6.5) * waveAmp : 0;
    const wOff1 = waveAmp !== 0 ? Math.sin(t1 * Math.PI * 3 - t * 6.5) * waveAmp : 0;
    const y0 = rawY0 + wOff0;
    const y1 = rawY1 + wOff1;

    const dx = x1 - x0;
    const dy = y1 - y0;
    const segLen = Math.hypot(dx, dy) || 1;
    const nx = -dy / segLen;
    const ny = dx / segLen;

    const depthScale = 1.0 - 0.45 * t0;
    const keyLength = baseKeyLength * depthScale;
    const midX = (x0 + x1) * 0.5;
    const midY = (y0 + y1) * 0.5;
    const centerX = midX + nx * keyLength * 0.5;
    const centerY = midY + ny * keyLength * 0.5;

    let reboundDip = 0;
    for (const c of contacts) {
      const radX = c.radius ?? 68;
      const radY = (c.radius ?? 68) * 0.55;
      const dxC = Math.abs(centerX - c.x);
      const dyC = Math.abs(centerY - c.y);
      if (dxC < radX && dyC < radY) {
        const dipAmt = (1.0 - dxC / radX) * (1.0 - dyC / radY) * (c.dip ?? 18.0);
        if (dipAmt > reboundDip) reboundDip = dipAmt;
      }
    }
    if (reboundDip > maxDip) {
      maxDip = reboundDip;
      maxDipCenter = [centerX, centerY];
    }

    const pBack = [midX, midY + reboundDip];
    const pFront = [pBack[0] + nx * keyLength, pBack[1] + ny * keyLength];
    const wHalf = segLen * 0.55;
    const tx = dx / segLen;
    const ty = dy / segLen;

    const cTL = [pBack[0] - tx * wHalf, pBack[1] - ty * wHalf];
    const cTR = [pBack[0] + tx * wHalf, pBack[1] + ty * wHalf];
    const cBR = [pFront[0] + tx * wHalf * 1.15, pFront[1] + ty * wHalf * 1.15];
    const cBL = [pFront[0] - tx * wHalf * 1.15, pFront[1] - ty * wHalf * 1.15];

    // Check Technicolor ring overlap
    let tcBlend = 0;
    for (const rg of rings) {
      if (rg.r > 5) {
        const d = Math.hypot(centerX - rg.x, centerY - rg.y);
        if (d < rg.r) {
          tcBlend = Math.max(tcBlend, 1.0 - d / rg.r);
        }
      }
    }

    keyGeom.push({
      idx: k,
      center: [centerX, centerY],
      corners: [cBL, cBR, cTR, cTL],
      isBlack: [1, 2, 4, 5, 6].includes(k % 7) && k % 14 !== 0,
      depthScale,
      tcBlend,
      reboundDip,
    });
  }

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. Drop shadow under keyboard ribbon
  ctx.fillStyle = 'rgba(30, 20, 15, 0.36)';
  for (const kg of keyGeom) {
    const pts = kg.corners;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] + 8, pts[0][1] + 18);
    ctx.lineTo(pts[1][0] + 8, pts[1][1] + 18);
    ctx.lineTo(pts[2][0] + 8, pts[2][1] + 18);
    ctx.lineTo(pts[3][0] + 8, pts[3][1] + 18);
    ctx.closePath();
    ctx.fill();
  }

  // 2. White Ivory Keys
  for (const kg of keyGeom) {
    const pts = kg.corners;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.lineTo(pts[3][0], pts[3][1]);
    ctx.closePath();

    if (kg.tcBlend > 0.02) {
      const palette = [RUBBER_PALETTE.tcBlue, RUBBER_PALETTE.tcViolet, RUBBER_PALETTE.tcCoral, RUBBER_PALETTE.tcGold];
      const accent = palette[kg.idx % palette.length];
      ctx.fillStyle = mixHex(RUBBER_PALETTE.ivoryKey, accent, kg.tcBlend * 0.44);
    } else {
      ctx.fillStyle = kg.idx % 3 === 0 ? '#ECE1CC' : RUBBER_PALETTE.ivoryKey;
    }
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.0 * kg.depthScale + 0.8;
    ctx.stroke();

    // Front lip specular highlight
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.76)';
    ctx.lineWidth = 2.0;
    ctx.stroke();
  }

  // 3. Sharp Black Keys (Accidentals)
  for (const kg of keyGeom) {
    if (!kg.isBlack) continue;
    const pts = kg.corners;
    const bkTL = pts[3];
    const bkTR = pts[2];
    const bkBR = [pts[2][0] * 0.38 + pts[1][0] * 0.62, pts[2][1] * 0.38 + pts[1][1] * 0.62];
    const bkBL = [pts[3][0] * 0.38 + pts[0][0] * 0.62, pts[3][1] * 0.38 + pts[0][1] * 0.62];

    ctx.fillStyle = 'rgba(24, 18, 14, 0.52)';
    ctx.beginPath();
    ctx.moveTo(bkBL[0] + 4, bkBL[1] + 5);
    ctx.lineTo(bkBR[0] + 4, bkBR[1] + 5);
    ctx.lineTo(bkTR[0] + 4, bkTR[1] + 5);
    ctx.lineTo(bkTL[0] + 4, bkTL[1] + 5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bkBL[0], bkBL[1]);
    ctx.lineTo(bkBR[0], bkBR[1]);
    ctx.lineTo(bkTR[0], bkTR[1]);
    ctx.lineTo(bkTL[0], bkTL[1]);
    ctx.closePath();
    ctx.fillStyle = kg.tcBlend > 0.05 ? '#2D1E54' : RUBBER_PALETTE.inkBlack;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 2.6 * kg.depthScale + 0.6;
    ctx.stroke();

    // Key top sheen line
    ctx.beginPath();
    ctx.moveTo(lerp(bkTL[0], bkTR[0], 0.3), lerp(bkTL[1], bkTR[1], 0.3));
    ctx.lineTo(lerp(bkBL[0], bkBR[0], 0.3), lerp(bkBL[1], bkBR[1], 0.3));
    ctx.strokeStyle = rgba(RUBBER_PALETTE.paperCream, kg.tcBlend > 0.05 ? 0.48 : 0.26);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // 4. Trampoline spring vibration ticks under compressed keys
  if (maxDip > 4.0 && maxDipCenter) {
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 2.8;
    for (const off of [-44, -22, 0, 22, 44]) {
      ctx.beginPath();
      ctx.arc(maxDipCenter[0] + off * 1.2, maxDipCenter[1] + Math.abs(off) * 0.16 + 22, 13, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Renders the Giant Anthropomorphic 1930s Brass Gramophone Character (`drawAnthropomorphicGramophone`):
 *   - Mahogany cabinet squashing to the 132 BPM beat + left shoe tapping rhythm
 *   - 78-RPM spinning vinyl record on felt turntable + winding crank handle
 *   - Bending rubber-hose brass gooseneck & 12-petal giant flared brass horn mouth
 *   - Singing cartoon red tongue inside throat + forehead Pie-Cut / Angry / Shock / Dizzy `X X` eyes
 *   - Two expressive rubber-hose arms in 4-finger white cartoon gloves
 *   - Soundwave blast rings, comic impact starburst (`impactFlash`), and golden logarithmic vortex (`vortexStrength`)
 */
export function drawAnthropomorphicGramophone(ctx, cx, cy, opts = {}) {
  const scale = opts.scale ?? 1.0;
  const t = opts.t ?? 0;
  const swing = evalSwingBounce(t, opts.bpm ?? 132, opts.phase ?? 0);
  const stunned = !!opts.stunned;
  const eyeMode = opts.eyeMode || (stunned ? 'dizzy' : 'pie');
  const cabSquashY = opts.cabSquashY ?? swing.squashY;
  const footTapAngle = opts.footTapAngle ?? swing.footTap;
  const recoilAngle = opts.recoilAngle ?? 0;
  const neckLeanX = opts.neckLeanX ?? Math.sin(t * 4.6) * 10;
  const neckStretchY = opts.neckStretchY ?? Math.cos(t * 4.6) * 8;
  const hornSquashX = opts.hornSquashX ?? 1.0;
  const hornSquashY = opts.hornSquashY ?? 1.0;
  const spitBlast = opts.spitBlast ?? 0.0;
  const vortexStrength = opts.vortexStrength ?? 0.0;
  const impactFlash = opts.impactFlash ?? 0.0;
  const arm1Pose = opts.arm1Pose || (stunned ? 'dizzy' : 'point');
  const arm2Pose = opts.arm2Pose || (stunned ? 'dizzy' : 'crank');

  ctx.save();
  const pivotX = cx + 20;
  const pivotY = cy + 220;
  ctx.translate(pivotX, pivotY);
  ctx.scale(scale, scale);
  if (recoilAngle !== 0) ctx.rotate(recoilAngle);
  ctx.translate(-pivotX, -pivotY);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const cabW = 240.0 / Math.max(0.45, Math.sqrt(cabSquashY));
  const cabH = 110.0 * cabSquashY;
  const cabBaseY = cy + 275.0;
  const cabCy = cabBaseY - cabH * 0.5;
  const cabCx = cx + 20.0;

  // 1. Floor contact shadow
  ctx.save();
  ctx.translate(cabCx, cabBaseY + 8);
  ctx.scale(1.0, 0.34);
  ctx.beginPath();
  ctx.arc(0, 0, 155, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(30, 20, 15, 0.40)';
  ctx.fill();
  ctx.restore();

  // 2. Rubber-hose cabinet legs & tapping cartoon shoes
  for (const [footX, footSign, isTap] of [
    [cabCx - 85, -1, true],
    [cabCx + 85, 1, false],
  ]) {
    const footAng = isTap ? footTapAngle : 0;
    ctx.beginPath();
    ctx.moveTo(footX, cabCy + cabH * 0.5 - 10);
    ctx.bezierCurveTo(
      footX + footSign * 18,
      cabCy + cabH * 0.5 + 24,
      footX - footSign * 10,
      cabCy + cabH * 0.5 + 44,
      footX + footSign * 8,
      cabCy + cabH * 0.5 + 50
    );
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 12.0;
    ctx.stroke();

    drawCartoonShoe(ctx, footX + footSign * 8, cabCy + cabH * 0.5 + 50, {
      scale: 0.92,
      flip: footSign < 0,
      tapAngle: footAng,
      fill: '#2B241E',
    });
  }

  // 3. Mahogany Wooden Cabinet Body
  const cabX = cabCx - cabW * 0.5;
  const cabY = cabCy - cabH * 0.5;
  drawRoundedRectPath(ctx, cabX, cabY, cabW, cabH, 14);
  const woodG = ctx.createLinearGradient(cabX, 0, cabX + cabW, 0);
  woodG.addColorStop(0.0, '#7A3D28');
  woodG.addColorStop(0.5, '#9E5236');
  woodG.addColorStop(1.0, '#613020');
  ctx.fillStyle = woodG;
  ctx.fill();
  ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = 5.0;
  ctx.stroke();

  // Brass corner rivets
  for (const [bx, by] of [
    [cabX + 16, cabY + 16],
    [cabX + cabW - 16, cabY + 16],
    [cabX + 16, cabY + cabH - 16],
    [cabX + cabW - 16, cabY + cabH - 16],
  ]) {
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.brassGold;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 2.0;
    ctx.stroke();
  }

  // 4. Top Turntable & Spinning 78-RPM Vinyl Record
  const ttCx = cabCx - 15;
  const ttCy = cabY - 12;
  ctx.save();
  ctx.translate(ttCx, ttCy);
  ctx.scale(1.0, 0.32);
  ctx.beginPath();
  ctx.arc(0, 0, 92, 0, Math.PI * 2);
  ctx.fillStyle = RUBBER_PALETTE.feltGreen;
  ctx.fill();
  ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = 6.0;
  ctx.stroke();
  drawSpinningVinyl(ctx, 0, 0, 86, t * 7.5, { flat: true });
  ctx.restore();

  // 5. Winding Crank Handle on Right Side
  const crankX = cabX + cabW;
  const crankY = cabCy;
  const crankRot = t * 5.2;
  const crankKnobX = crankX + 36 + Math.cos(crankRot) * 12;
  const crankKnobY = crankY + 18 + Math.sin(crankRot) * 12;
  ctx.beginPath();
  ctx.moveTo(crankX, crankY);
  ctx.lineTo(crankX + 36, crankY - 12);
  ctx.lineTo(crankKnobX, crankKnobY);
  ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = 5.0;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(crankKnobX, crankKnobY, 9, 0, Math.PI * 2);
  ctx.fillStyle = RUBBER_PALETTE.paperCream;
  ctx.fill();
  ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = 3.0;
  ctx.stroke();

  // 6. Bending Noodle Brass Gooseneck
  const neckStart = [ttCx + 45, ttCy - 10];
  const neckMid1 = [cx + 120 + neckLeanX * 0.45, cy + 90 - neckStretchY * 0.35];
  const neckMid2 = [cx + 120 + neckLeanX * 0.80, cy - 20 - neckStretchY * 0.70];
  const hornThroat = [cx - 20 + neckLeanX, cy - 10 - neckStretchY];

  ctx.beginPath();
  ctx.moveTo(neckStart[0], neckStart[1]);
  ctx.bezierCurveTo(neckMid1[0], neckMid1[1], neckMid2[0], neckMid2[1], hornThroat[0], hornThroat[1]);
  ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = 32.0;
  ctx.stroke();

  ctx.strokeStyle = RUBBER_PALETTE.brassGold;
  ctx.lineWidth = 22.0;
  ctx.stroke();

  ctx.strokeStyle = rgba(RUBBER_PALETTE.paperCream, 0.75);
  ctx.lineWidth = 5.5;
  ctx.stroke();

  // 7. Giant 12-Petal Flared Brass Horn Mouth
  const bellCx = cx - 180 + neckLeanX;
  const bellCy = cy - 60 - neckStretchY;
  const bellRx = 85 * hornSquashX;
  const bellRy = 160 * hornSquashY;

  ctx.beginPath();
  ctx.moveTo(hornThroat[0], hornThroat[1] - 12);
  ctx.bezierCurveTo(
    cx - 60 + neckLeanX * 0.5,
    cy - 40,
    cx - 110 + neckLeanX * 0.8,
    bellCy - bellRy * 0.85,
    bellCx,
    bellCy - bellRy
  );
  ctx.lineTo(bellCx, bellCy + bellRy);
  ctx.bezierCurveTo(
    cx - 100 + neckLeanX * 0.8,
    bellCy + bellRy * 0.85,
    cx - 50 + neckLeanX * 0.5,
    cy + 30,
    hornThroat[0],
    hornThroat[1] + 16
  );
  ctx.closePath();

  const hornG = ctx.createLinearGradient(hornThroat[0], hornThroat[1], bellCx, bellCy);
  hornG.addColorStop(0.0, '#94702E');
  hornG.addColorStop(0.45, '#ECC858');
  hornG.addColorStop(0.78, '#D1A642');
  hornG.addColorStop(1.0, '#7A5C29');
  ctx.fillStyle = hornG;
  ctx.fill();
  ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = 6.0;
  ctx.stroke();

  // 12 brass petal ribs
  ctx.strokeStyle = 'rgba(60, 44, 18, 0.35)';
  ctx.lineWidth = 2.0;
  for (let p = 0; p < 12; p++) {
    const ang = (p / 12) * Math.PI - Math.PI * 0.5;
    ctx.beginPath();
    ctx.moveTo(hornThroat[0], hornThroat[1]);
    ctx.lineTo(bellCx + bellRx * 0.15 * Math.cos(ang), bellCy + bellRy * Math.sin(ang));
    ctx.stroke();
  }

  // Bell interior throat & vibrating red cartoon tongue
  ctx.save();
  ctx.translate(bellCx, bellCy);
  ctx.scale(bellRx * 0.45, bellRy);
  ctx.beginPath();
  ctx.arc(0, 0, 1.0, 0, Math.PI * 2);
  const innerG = ctx.createRadialGradient(0.2, 0, 0.05, 0, 0, 1.0);
  innerG.addColorStop(0.0, '#120E0B');
  innerG.addColorStop(0.7, '#2E231A');
  innerG.addColorStop(1.0, '#6B512D');
  ctx.fillStyle = innerG;
  ctx.fill();
  ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = 0.08;
  ctx.stroke();

  // Vibrating red tongue
  const tongueWag = Math.sin(t * 14);
  ctx.save();
  ctx.translate(0.18 + tongueWag * 0.1, 0.35 + Math.abs(tongueWag) * 0.08);
  ctx.scale(0.38, 0.32);
  ctx.beginPath();
  ctx.arc(0, 0, 1.0, 0, Math.PI * 2);
  ctx.fillStyle = RUBBER_PALETTE.tcCoral;
  ctx.fill();
  ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = 0.15;
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // Outer brass bell rim
  ctx.save();
  ctx.translate(bellCx, bellCy);
  ctx.scale(bellRx * 0.48, bellRy * 1.03);
  ctx.beginPath();
  ctx.arc(0, 0, 1.0, 0, Math.PI * 2);
  ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = 0.16;
  ctx.stroke();
  ctx.strokeStyle = RUBBER_PALETTE.brassGold;
  ctx.lineWidth = 0.10;
  ctx.stroke();
  ctx.restore();

  // 8. Expressive 1930s Eyes on Horn Bell Forehead
  const eyeHornCx = bellCx + 90;
  const eyeHornCy = bellCy - bellRy * 0.48;
  drawPieCutEyes(ctx, eyeHornCx, eyeHornCy, {
    mode: eyeMode,
    radius: 18,
    spacing: 44,
    lookX: -0.45,
    lookY: 0.1,
    t,
  });

  if (eyeMode === 'dizzy') {
    for (let s = 0; s < 5; s++) {
      const angS = t * 5.2 + (s * Math.PI * 2) / 5;
      drawFourPointStar(
        ctx,
        eyeHornCx + Math.cos(angS) * 70,
        eyeHornCy - 72 + Math.sin(angS) * 24,
        15,
        { rot: angS * 1.4, withHalo: false, withTicks: false, color: RUBBER_PALETTE.tcGold }
      );
    }
  }

  // 9. Optional Comic Impact Starburst (`impactFlash`)
  if (impactFlash > 0.05) {
    drawComicBurst(ctx, bellCx + 30, eyeHornCy, 125, {
      scale: impactFlash,
      label: opts.impactLabel || 'CLANG!',
    });
  }

  // 10. Two Rubber-Hose Arms with 4-Finger White Cartoon Gloves
  const isDizzy = eyeMode === 'dizzy';
  const arm1Start = [cx - 20, cy + 40];
  let arm1Hand = [cx - 145 + Math.sin(t * 8) * 8, cy + 90 + Math.cos(t * 8) * 6];
  let glove1Pose = 'point';
  let glove1Rot = -0.22;
  if (arm1Pose === 'fist') {
    arm1Hand = [cx - 105 + Math.sin(t * 18) * 10, cy + 35 + Math.cos(t * 18) * 8];
    glove1Pose = 'fist';
    glove1Rot = 0.52;
  } else if (arm1Pose === 'dizzy' || isDizzy) {
    arm1Hand = [cabCx - cabW * 0.5 - 26 + Math.sin(t * 4.5) * 6, cabBaseY - 8];
    glove1Pose = 'open';
    glove1Rot = 0.08;
  }
  drawRubberHoseLimb(ctx, arm1Start, arm1Hand, { bend: -0.35, width: 14 });
  drawCartoonGlove(ctx, arm1Hand[0], arm1Hand[1], { rot: glove1Rot, pose: glove1Pose, flip: false });

  const arm2Start = [cx + 80, cy + 80];
  let arm2Hand = [crankKnobX, crankKnobY];
  let glove2Pose = 'grip';
  let glove2Rot = 1.15;
  if (arm2Pose === 'fist') {
    arm2Hand = [cx + 125 + Math.cos(t * 16) * 8, cy + 28 + Math.sin(t * 16) * 10];
    glove2Pose = 'fist';
    glove2Rot = 1.25;
  } else if (arm2Pose === 'dizzy' || isDizzy) {
    arm2Hand = [cabCx + cabW * 0.5 + 28 - Math.sin(t * 4.5) * 6, cabBaseY - 6];
    glove2Pose = 'open';
    glove2Rot = -0.08;
  }
  drawRubberHoseLimb(ctx, arm2Start, arm2Hand, { bend: 0.35, width: 14 });
  drawCartoonGlove(ctx, arm2Hand[0], arm2Hand[1], { rot: glove2Rot, pose: glove2Pose, flip: true });

  // 11. Golden Logarithmic Vortex (`vortexStrength > 0`) or Leftward Soundwave Pulses
  if (vortexStrength > 0.05) {
    ctx.save();
    ctx.translate(bellCx, bellCy);
    const nArms = 6;
    for (let sp = 0; sp < nArms; sp++) {
      const baseTheta = (sp / nArms) * Math.PI * 2 + t * 8.5 * (1 + vortexStrength);
      ctx.beginPath();
      for (let step = 0; step <= 44; step++) {
        const frac = step / 44;
        const rV = 235 * vortexStrength * (1 - frac);
        const thetaV = baseTheta + frac * 4.0 * Math.PI;
        const vx = rV * 0.55 * Math.cos(thetaV);
        const vy = rV * 1.12 * Math.sin(thetaV);
        if (step === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.strokeStyle = rgba(
        sp % 2 === 0 ? RUBBER_PALETTE.tcGold : RUBBER_PALETTE.tcCyan,
        0.78 * vortexStrength
      );
      ctx.lineWidth = Math.max(1.8, 4.2 * vortexStrength);
      ctx.stroke();
    }
    ctx.restore();
  } else if (!isDizzy) {
    const pulseBoost = spitBlast > 0.05 ? 1.35 : 1.0;
    for (let w = 0; w < 4; w++) {
      const wPhase = (t * 1.8 + w * 0.25) % 1;
      const wrX = (65 + wPhase * 380) * pulseBoost;
      const wrY = (130 + wPhase * 300) * pulseBoost;
      const alpha = (1 - wPhase) * 0.58;
      ctx.save();
      ctx.translate(bellCx - 18, bellCy);
      ctx.scale(wrX, wrY);
      ctx.beginPath();
      ctx.arc(0, 0, 1.0, Math.PI * 0.65, Math.PI * 1.35);
      ctx.strokeStyle = rgba(RUBBER_PALETTE.sepiaDark, alpha);
      ctx.lineWidth = 0.04;
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * Renders an Anthropomorphic 1930s Jazz Band Instrument (`drawAnthropomorphicInstrument`):
 * Supports `kind`: `'contrabass' | 'saxophone' | 'microphone' | 'drumkit'`.
 * Every instrument has Pie-Cut cartoon eyes, rubber-hose gloved arms, and 132 BPM bounce!
 */
export function drawAnthropomorphicInstrument(ctx, cx, cy, opts = {}) {
  const kind = opts.kind || 'contrabass';
  const scale = opts.scale ?? 1.0;
  const flip = opts.flip ?? 1;
  const t = opts.t ?? 0;
  const swing = evalSwingBounce(t, opts.bpm ?? 132, opts.phase ?? 0.25);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale * flip * swing.squashX, scale * swing.squashY);
  ctx.rotate(swing.sway);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (kind === 'contrabass') {
    // Endpin & tapping shoes
    drawCartoonShoe(ctx, -28, 120, { scale: 0.78, flip: true, tapAngle: swing.footTap });
    drawCartoonShoe(ctx, 28, 120, { scale: 0.78, flip: false, tapAngle: 0 });
    drawRubberHoseLimb(ctx, [-18, 72], [-26, 114], { bend: -0.25, width: 9 });
    drawRubberHoseLimb(ctx, [18, 72], [26, 114], { bend: 0.25, width: 9 });

    // Figure-8 wooden contrabass body
    ctx.beginPath();
    ctx.moveTo(0, -82);
    ctx.bezierCurveTo(46, -82, 52, -32, 26, -10);
    ctx.bezierCurveTo(64, 14, 68, 84, 0, 86);
    ctx.bezierCurveTo(-68, 84, -64, 14, -26, -10);
    ctx.bezierCurveTo(-52, -32, -46, -82, 0, -82);
    ctx.closePath();
    const bassG = ctx.createLinearGradient(-55, -80, 55, 80);
    bassG.addColorStop(0.0, '#A85838');
    bassG.addColorStop(0.5, '#7D3B22');
    bassG.addColorStop(1.0, '#4E2212');
    ctx.fillStyle = bassG;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 4.5;
    ctx.stroke();

    // Fingerboard neck & scroll pegbox
    ctx.fillStyle = RUBBER_PALETTE.inkBlack;
    ctx.fillRect(-7, -158, 14, 88);
    ctx.beginPath();
    ctx.arc(0, -165, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#8C4428';
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // 4 vibrating strings & F-holes
    ctx.strokeStyle = RUBBER_PALETTE.paperCream;
    ctx.lineWidth = 1.5;
    for (const sx of [-4, -1.3, 1.3, 4]) {
      const vib = Math.sin(t * 28 + sx * 3) * 2.5;
      ctx.beginPath();
      ctx.moveTo(sx, -152);
      ctx.quadraticCurveTo(sx + vib, -25, sx * 1.4, 58);
      ctx.stroke();
    }

    // Pie-Cut eyes on upper bout
    drawPieCutEyes(ctx, 0, -45, { mode: opts.eyeMode || 'pie', radius: 11, spacing: 26, lookX: 0.3, t });
    drawCartoonMouth(ctx, 0, -16, { mode: 'sing', width: 22, height: 14, t });

    // Rubber-hose arms plucking strings
    const pluckX = 8 + Math.sin(t * 11) * 14;
    const pluckY = 12 + Math.cos(t * 11) * 8;
    drawRubberHoseLimb(ctx, [-42, -18], [pluckX, pluckY], { bend: 0.35, width: 9.5 });
    drawCartoonGlove(ctx, pluckX, pluckY, { scale: 0.72, rot: -0.8, pose: 'point' });

    const hand2X = 52 + Math.cos(t * 11) * 10;
    const hand2Y = -30 + Math.sin(t * 11) * 12;
    drawRubberHoseLimb(ctx, [42, -18], [hand2X, hand2Y], { bend: -0.32, width: 9.5 });
    drawCartoonGlove(ctx, hand2X, hand2Y, { scale: 0.72, rot: 0.6, pose: 'open', flip: true });
  } else if (kind === 'microphone') {
    // Vintage 1930s Broadway Stand Microphone with Pie-Cut eyes & dancing shoes
    drawCartoonShoe(ctx, -20, 95, { scale: 0.72, flip: true, tapAngle: swing.footTap });
    drawCartoonShoe(ctx, 20, 95, { scale: 0.72, flip: false, tapAngle: 0 });
    ctx.beginPath();
    ctx.ellipse(0, 86, 28, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.brassDark;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Bending chrome/brass stand pole
    drawRubberHoseLimb(ctx, [0, 84], [Math.sin(t * 6) * 12, -55], {
      bend: 0.22 * Math.sin(t * 4.4),
      width: 9,
      color: RUBBER_PALETTE.inkBlack,
    });

    // Classic pill grill head
    const headX = Math.sin(t * 6) * 12;
    const headY = -75;
    ctx.save();
    ctx.translate(headX, headY);
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.brassGold;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 4.0;
    ctx.stroke();
    drawPieCutEyes(ctx, 0, -4, { mode: 'pie', radius: 9.5, spacing: 22, lookX: 0.35, t });
    drawVibrationTicks(ctx, 0, 0, 40, { count: 2 });
    ctx.restore();
  } else {
    // Anthropomorphic Brass Saxophone with rubber-hose legs, gloved arms & bell vibration ticks
    drawCartoonShoe(ctx, -20, 92, { scale: 0.74, flip: true, tapAngle: swing.footTap });
    drawCartoonShoe(ctx, 20, 92, { scale: 0.74, flip: false, tapAngle: 0 });
    drawRubberHoseLimb(ctx, [-8, 52], [-18, 86], { bend: -0.22, width: 8.5 });
    drawRubberHoseLimb(ctx, [12, 52], [18, 86], { bend: 0.22, width: 8.5 });

    // J-shaped brass saxophone tube
    ctx.beginPath();
    ctx.moveTo(-14, -82);
    ctx.bezierCurveTo(-18, 12, -14, 58, 12, 58);
    ctx.bezierCurveTo(36, 58, 42, 12, 36, -22);
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 28;
    ctx.stroke();
    ctx.strokeStyle = RUBBER_PALETTE.brassGold;
    ctx.lineWidth = 19;
    ctx.stroke();

    // Brass key pearls along tube
    for (const ky of [-42, -24, -6, 12]) {
      ctx.beginPath();
      ctx.arc(-4, ky, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = RUBBER_PALETTE.paperCream;
      ctx.fill();
      ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
      ctx.lineWidth = 2.0;
      ctx.stroke();
    }

    // Flared brass bell
    ctx.beginPath();
    ctx.ellipse(36, -28, 26, 15, -0.25, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.brassGold;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 4.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(36, -28, 16, 8, -0.25, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.inkBlack;
    ctx.fill();

    drawVibrationTicks(ctx, 38, -50, 22, { count: 2, rot: -1.3 });
    drawPieCutEyes(ctx, -10, -34, { mode: 'pie', radius: 9.5, spacing: 21, lookX: 0.4, t });
    drawCartoonMouth(ctx, -8, -12, { mode: 'sing', width: 16, height: 10, t });

    // Rubber-hose gloved arms fingering the keys
    const keyHandY = -4 + Math.sin(t * 12) * 8;
    drawRubberHoseLimb(ctx, [-24, -18], [-4, keyHandY], { bend: 0.32, width: 8.5 });
    drawCartoonGlove(ctx, -4, keyHandY, { scale: 0.68, rot: -0.7, pose: 'point' });
  }

  ctx.restore();
}

/**
 * Renders a Mischievous 1930s Rubber-Hose Black Note Critter (`drawNoteCritter`).
 * Supports `state`: `'walk' | 'airborne' | 'squashed'`.
 * When `'squashed'`, renders the flattened ink pancake + dizzy `X X` eyes + parabolic flying Technicolor stars!
 */
export function drawNoteCritter(ctx, cx, cy, opts = {}) {
  const mode = opts.state || (opts.squashed ? 'squashed' : opts.airborne ? 'airborne' : 'walk');
  const scale = opts.scale ?? 1.0;
  const flip = opts.flip ?? 1;
  const t = opts.t ?? 0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale * flip, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (mode === 'squashed') {
    // 1. Impact shockwave rings on piano key
    ctx.save();
    ctx.scale(1.0, 0.34);
    ctx.beginPath();
    ctx.arc(0, 0, 96, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(RUBBER_PALETTE.tcGold, 0.78);
    ctx.lineWidth = 5.0;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 72, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(RUBBER_PALETTE.tcCyan, 0.68);
    ctx.lineWidth = 3.8;
    ctx.stroke();
    ctx.restore();

    // 2. Flattened black ink note pancake
    ctx.save();
    ctx.scale(1.85, 0.24);
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.inkBlack;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.paperCream;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.restore();

    // 3. Bent wilted note stem & flag flattened horizontally
    ctx.beginPath();
    ctx.moveTo(46, -2);
    ctx.bezierCurveTo(74, -14, 96, 6, 118, -8);
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 7.0;
    ctx.stroke();

    // 4. Two white gloved hands splayed flat trembling on keys
    for (const hSign of [-1, 1]) {
      const tremble = Math.sin(t * 28 + hSign) * 2.5;
      ctx.save();
      ctx.translate(hSign * 64, 4 + tremble);
      ctx.scale(hSign * 0.9, 0.45);
      drawCartoonGlove(ctx, 0, 0, { rot: hSign * 0.4, pose: 'open' });
      ctx.restore();
    }

    // 5. Dizzy X X cartoon eyes on squashed pancake
    drawPieCutEyes(ctx, 0, -2, { mode: 'dizzy', radius: 9.5, spacing: 36, aspectY: 0.75, brows: false, t });

    // 6. Burst of parabolic flying Technicolor stars & mini notes
    const burst = [
      [-82, -22, 14, RUBBER_PALETTE.tcGold],
      [-62, 16, 11, RUBBER_PALETTE.tcCyan],
      [78, -26, 15, RUBBER_PALETTE.tcCoral],
      [68, 18, 12, RUBBER_PALETTE.tcViolet],
    ];
    for (const [bx, by, br, bcol] of burst) {
      drawFourPointStar(ctx, bx, by + Math.sin(t * 10 + bx) * 4, br, {
        rot: t * 3 + bx,
        color: bcol,
        withHalo: false,
        withTicks: false,
      });
    }
  } else if (mode === 'airborne') {
    ctx.rotate(t * 6.0);
    ctx.scale(0.88, 1.24);
    for (const s of [-1, 1]) {
      drawRubberHoseLimb(ctx, [0, 0], [s * 24, -Math.sin(t * 20 + s) * 12], { bend: 0.3, width: 5 });
      drawCartoonGlove(ctx, s * 24, -Math.sin(t * 20 + s) * 12, { scale: 0.65, rot: s * 0.8 });
    }
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.inkBlack;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.paperCream;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    drawPieCutEyes(ctx, 0, -3, { mode: 'shock', radius: 6.2, spacing: 15, brows: false });
  } else {
    // Lively ground-hopping & patrolling Note Critter!
    const walkPh = opts.walkPhase ?? t * 11.0;
    const hopDy = Math.abs(Math.sin(walkPh)) * 15.0;

    // Ground drop shadow
    ctx.save();
    ctx.translate(0, 36);
    ctx.scale(1.2, 0.34);
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.fillStyle = rgba('#1E1410', Math.max(0.18, 0.44 - hopDy * 0.015));
    ctx.fill();
    ctx.restore();

    ctx.translate(0, -hopDy);

    // Rubber-hose kicking legs & cartoon shoes
    for (const [legIdx, legS] of [
      [0, -1],
      [1, 1],
    ]) {
      const legAng = Math.sin(walkPh + legIdx * Math.PI) * 0.6;
      const hip = [legS * 8, 12];
      const ankle = [legS * 8 + Math.sin(legAng) * 24, 34];
      drawRubberHoseLimb(ctx, hip, ankle, { bend: legS * 0.25, width: 5.2, highlight: false });
      drawCartoonShoe(ctx, ankle[0], ankle[1], { scale: 0.55, flip: legS < 0, tapAngle: legAng * 0.5 });
    }

    // Rubber-hose swinging arms & white gloves
    for (const [armIdx, armS] of [
      [0, -1],
      [1, 1],
    ]) {
      const armAng = -Math.sin(walkPh + armIdx * Math.PI) * 0.7;
      const sh = [armS * 14, 2];
      const hand = [armS * 14 - 16 + Math.sin(armAng) * 13, 5 + Math.cos(armAng) * 11];
      drawRubberHoseLimb(ctx, sh, hand, { bend: -0.25, width: 4.8, highlight: false });
      drawCartoonGlove(ctx, hand[0], hand[1], { scale: 0.62, rot: -0.4 + armAng * 0.5, pose: 'fist' });
    }

    // Tilted elliptical black note head body
    ctx.save();
    ctx.rotate(-0.18 + Math.sin(walkPh) * 0.06);
    ctx.scale(1.18, 0.94);
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.inkBlack;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.paperCream;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();

    // Note stem & whipping flag
    const whip = Math.sin(walkPh * 2.0) * 7.0;
    ctx.beginPath();
    ctx.moveTo(16, -4);
    ctx.bezierCurveTo(20, -32, 25, -50, 20 + whip * 0.2, -68);
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 7.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(20 + whip * 0.2, -68);
    ctx.bezierCurveTo(46 + whip, -58, 50 + whip, -36, 33 + whip * 0.5, -26);
    ctx.bezierCurveTo(31, -40, 24, -52, 20 + whip * 0.2, -68);
    ctx.closePath();
    ctx.fillStyle = RUBBER_PALETTE.inkBlack;
    ctx.fill();

    // Mischievous Pie-Cut eyes & toothy grin
    drawPieCutEyes(ctx, -1, -3, { mode: 'angry', radius: 5.5, spacing: 14, lookX: -0.4, brows: true });
    drawCartoonMouth(ctx, -1, 9, { mode: 'teeth', width: 17, height: 10 });
  }

  ctx.restore();
}

/**
 * Renders a flowing stream of jazz musical notes (`♪ ♫ ♬`) between `origin` and `target` (`drawJazzNoteStream`).
 * Notes inside any `rings` (`[{x, y, r}]`) automatically bloom into Technicolor 4-point stars and chromatic notes!
 */
export function drawJazzNoteStream(ctx, originX, originY, targetX, targetY, t = 0, opts = {}) {
  const count = opts.count ?? 12;
  const rings = opts.rings || [];
  const spreadY = opts.spreadY ?? 95;
  const vortex = clamp(opts.vortex ?? 0, 0, 1);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < count; i++) {
    const baseU = ((i / count) + t * 0.22) % 1;
    const u = vortex > 0.1 ? 1.0 - baseU : baseU;
    let nx = lerp(originX, targetX, u);
    let ny =
      lerp(originY, targetY, u) +
      Math.sin(u * Math.PI * 3 - t * 5.0 + i * 1.3) * spreadY * Math.sin(u * Math.PI);

    if (vortex > 0.05) {
      const ang = u * Math.PI * 4 + t * 7.5 + i;
      const rad = (1 - u) * 220 * vortex;
      nx = lerp(nx, originX + Math.cos(ang) * rad * 0.65, vortex);
      ny = lerp(ny, originY + Math.sin(ang) * rad, vortex);
    }

    let inRing = false;
    for (const rg of rings) {
      if (rg.r > 5 && Math.hypot(nx - rg.x, ny - rg.y) < rg.r) {
        inRing = true;
        break;
      }
    }

    const scale = 0.85 + 0.35 * Math.sin(i * 2.1 + 1);
    const rot = Math.sin(t * 4 + i) * 0.32;
    const palette = [RUBBER_PALETTE.tcBlue, RUBBER_PALETTE.tcViolet, RUBBER_PALETTE.tcCoral, RUBBER_PALETTE.tcGold];
    const col = inRing || opts.technicolor ? palette[i % palette.length] : RUBBER_PALETTE.inkBlack;

    ctx.save();
    ctx.translate(nx, ny);
    ctx.rotate(rot);
    ctx.scale(scale, scale);

    if (inRing && i % 3 === 0) {
      drawFourPointStar(ctx, 0, 0, 18, { rot: t * 2 + i, withTicks: false });
    } else if (i % 2 === 0) {
      // Beamed double eighth note (♫)
      for (const [hx, hy] of [
        [-11, 11],
        [11, 6],
      ]) {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(-0.35);
        ctx.scale(1.2, 0.85);
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(-5, 9);
      ctx.lineTo(-5, -14);
      ctx.moveTo(17, 4);
      ctx.lineTo(17, -19);
      ctx.stroke();

      ctx.lineWidth = 5.6;
      ctx.beginPath();
      ctx.moveTo(-6, -12);
      ctx.lineTo(18, -17);
      ctx.stroke();
    } else {
      // Single quaver note (♪)
      ctx.save();
      ctx.translate(-4, 8);
      ctx.rotate(-0.35);
      ctx.scale(1.2, 0.85);
      ctx.beginPath();
      ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = col;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(2, 6);
      ctx.lineTo(2, -18);
      ctx.bezierCurveTo(14, -14, 16, -4, 10, 4);
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.restore();
}

/**
 * Draws a spinning 1930s 78-RPM Vinyl Record (`drawSpinningVinyl`) with concentric grooves,
 * rotating golden sheen sectors, and center label.
 */
export function drawSpinningVinyl(ctx, cx, cy, r = 64, rot = 0, opts = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  if (opts.tiltY) ctx.scale(1.0, opts.tiltY);

  // Outer halo if floating
  if (!opts.flat) {
    const halo = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.45);
    halo.addColorStop(0.0, rgba(RUBBER_PALETTE.tcGold, 0.45));
    halo.addColorStop(1.0, rgba(RUBBER_PALETTE.tcGold, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // Black shellac disc
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#1D1A18';
  ctx.fill();
  ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = Math.max(3.0, r * 0.06);
  ctx.stroke();

  // Concentric sound grooves
  ctx.strokeStyle = 'rgba(225, 220, 210, 0.22)';
  ctx.lineWidth = 1.8;
  for (const gr of [0.54, 0.70, 0.85]) {
    ctx.beginPath();
    ctx.arc(0, 0, r * gr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Rotating golden sheen sectors
  for (const shAng of [rot, rot + Math.PI]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r * 0.96, shAng - 0.26, shAng + 0.26);
    ctx.closePath();
    ctx.fillStyle = rgba(RUBBER_PALETTE.tcGold, 0.30);
    ctx.fill();
  }

  // Vintage gold & coral record label
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
  ctx.fillStyle = opts.labelColor || RUBBER_PALETTE.tcGold;
  ctx.fill();
  ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
  ctx.lineWidth = Math.max(2.2, r * 0.04);
  ctx.stroke();

  // Center spindle hole
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = RUBBER_PALETTE.paperCream;
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// TIER 4A · 2D RUBBER-HOSE CHARACTER PUPPET (`createRubberHoseCharacter`)
// ============================================================================

const RUBBER_HUMANOID_DIMS = Object.freeze({
  pelvisHeight: 112,
  lumbarLen: 16,
  thoraxLen: 26,
  neckBaseLen: 16,
  headPivotLen: 12,
  headTopLen: 26,
  topKnotLen: 16,
  shoulderWidthL: 16,
  shoulderWidthR: 16,
  upperArmL: 34,
  forearmL: 32,
  handL: 12,
  upperArmR: 36,
  forearmR: 34,
  handR: 12,
  hipOffset: 11,
  thighLen: 56,
  shinLen: 54,
  footLen: 18,
  heelLen: 6,
});

function drawRubberHeldProp(ctx, prop, wr, handAng, t = 0) {
  if (!prop || prop === 'none') return;
  ctx.save();
  ctx.translate(wr.x, wr.y);
  ctx.rotate(handAng);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (prop === 'trumpet') {
    const bellPulse = 1.0 + Math.sin(t * 14) * 0.12;
    // Brass trumpet tube & flared bell
    ctx.beginPath();
    ctx.moveTo(4, -4);
    ctx.lineTo(68, -14);
    ctx.lineTo(86, -34 * bellPulse);
    ctx.lineTo(88, 10 * bellPulse);
    ctx.lineTo(68, -4);
    ctx.lineTo(4, 2);
    ctx.closePath();
    ctx.fillStyle = RUBBER_PALETTE.brassGold;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.4;
    ctx.stroke();

    // 3 piston valves
    for (const vx of [28, 38, 48]) {
      ctx.beginPath();
      ctx.moveTo(vx, -8);
      ctx.lineTo(vx, -19);
      ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
      ctx.lineWidth = 3.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(vx, -20, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = RUBBER_PALETTE.paperCream;
      ctx.fill();
      ctx.stroke();
    }

    // Bell mouth dark interior & sound ticks
    ctx.beginPath();
    ctx.ellipse(87, -12, 6 * bellPulse, 20 * bellPulse, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.inkBlack;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.brassGold;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    drawVibrationTicks(ctx, 98, -12, 16, { count: 2, rot: -0.15 });
  } else if (prop === 'saxophone') {
    ctx.beginPath();
    ctx.moveTo(4, -6);
    ctx.bezierCurveTo(28, 8, 34, 42, 52, 40);
    ctx.bezierCurveTo(68, 38, 72, 10, 68, -12);
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 15;
    ctx.stroke();
    ctx.strokeStyle = RUBBER_PALETTE.brassGold;
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(68, -16, 15, 10, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.brassGold;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.2;
    ctx.stroke();
  } else if (prop === 'baton' || prop === 'cane') {
    const len = prop === 'cane' ? 92 : 68;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(len, -len * 0.45);
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 6.5;
    ctx.stroke();
    ctx.strokeStyle = prop === 'cane' ? RUBBER_PALETTE.brassGold : RUBBER_PALETTE.paperCream;
    ctx.lineWidth = 3.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(len, -len * 0.45, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.tcGold;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 2.4;
    ctx.stroke();
  } else if (prop === 'mallet') {
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(58, -32);
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 6.5;
    ctx.stroke();
    ctx.save();
    ctx.translate(60, -34);
    ctx.rotate(-0.55);
    drawRoundedRectPath(ctx, -18, -26, 36, 52, 10);
    ctx.fillStyle = RUBBER_PALETTE.mahoganyLight;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  } else if (prop === 'microphone') {
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(24, -22);
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 6.0;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(26, -26, 13, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.brassGold;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.2;
    ctx.stroke();
  }

  ctx.restore();
}

function drawRubberHat(ctx, hat, archetype) {
  if (!hat || hat === 'none') return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (hat === 'topHat') {
    // Tall Broadway Silk Top Hat
    ctx.beginPath();
    ctx.ellipse(0, -34, 38, 8, -0.05, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.inkBlack;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.paperCream;
    ctx.lineWidth = 2.0;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-22, -34);
    ctx.lineTo(-26, -78);
    ctx.quadraticCurveTo(0, -84, 26, -78);
    ctx.lineTo(22, -34);
    ctx.closePath();
    ctx.fillStyle = RUBBER_PALETTE.inkBlack;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.2;
    ctx.stroke();

    // Satin hatband
    ctx.fillStyle = RUBBER_PALETTE.tcGold;
    ctx.fillRect(-22, -44, 44, 8);
    ctx.strokeRect(-22, -44, 44, 8);
  } else if (hat === 'feather') {
    // 1920s/1930s Flapper Headband with Jewel & Plume Feather
    ctx.beginPath();
    ctx.arc(0, -6, 35, Math.PI * 1.08, Math.PI * 1.92);
    ctx.strokeStyle = RUBBER_PALETTE.tcGold;
    ctx.lineWidth = 7.0;
    ctx.stroke();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Plume feather
    ctx.beginPath();
    ctx.moveTo(14, -32);
    ctx.bezierCurveTo(28, -68, 8, -86, -8, -76);
    ctx.bezierCurveTo(-14, -62, 2, -44, 14, -32);
    ctx.closePath();
    ctx.fillStyle = RUBBER_PALETTE.tcCoral;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.0;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(14, -32, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.paperCream;
    ctx.fill();
    ctx.stroke();
  } else if (hat === 'strawHat') {
    // Vaudeville Boater Straw Hat
    ctx.beginPath();
    ctx.ellipse(0, -34, 40, 8, -0.06, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.brassBright;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.2;
    ctx.stroke();

    drawRoundedRectPath(ctx, -24, -56, 48, 22, 5);
    ctx.fillStyle = RUBBER_PALETTE.brassBright;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = RUBBER_PALETTE.tcCoral;
    ctx.fillRect(-24, -43, 48, 7);
    ctx.strokeRect(-24, -43, 48, 7);
  } else {
    // Classic 1930s Derby Bowler Hat (default `'bowler'`)
    ctx.beginPath();
    ctx.ellipse(0, -33, 36, 7.5, -0.06, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER_PALETTE.inkBlack;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.paperCream;
    ctx.lineWidth = 2.0;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -34, 24, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = archetype === 'jazzcat' ? '#362E28' : RUBBER_PALETTE.inkBlack;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.2;
    ctx.stroke();

    // Ribbon band
    ctx.beginPath();
    ctx.moveTo(-23, -36);
    ctx.quadraticCurveTo(0, -39, 23, -36);
    ctx.strokeStyle = RUBBER_PALETTE.tcGold;
    ctx.lineWidth = 5.0;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Creates an articulated 2D 1930s Rubber-Hose Cartoon Character Puppet (`createRubberHoseCharacter`),
 * powered by [`engine/puppet2d.js`](../../engine/puppet2d.js) and skinned with:
 *   - True jointless S/C-curve rubber-hose limbs (`drawRubberHoseLimb`)
 *   - 4-finger white cartoon gloves (`drawCartoonGlove`) & bulbous shoes (`drawCartoonShoe`)
 *   - 1930s button-front trousers, tuxedo, or flapper dress with Ben-Day halftone dots
 *   - Pie-Cut cartoon eyes (`drawPieCutEyes`) & singing/grinning mouth (`drawCartoonMouth`)
 *   - Automatic 132 BPM rhythmic swing knee-bounce (`evalSwingBounce`)
 *
 * Supports:
 *   - `archetype`: `'jazzcat' | 'bandleader' | 'flapper' | 'mouse' | 'dog' | 'tinbot'`
 *   - `view`: `'side' | 'front' | 'back'`
 *   - `hat`: `'bowler' | 'topHat' | 'feather' | 'strawHat' | 'none'`
 *   - `heldProp`: `'trumpet' | 'saxophone' | 'baton' | 'microphone' | 'cane' | 'mallet' | 'none'`
 */
export function createRubberHoseCharacter(opts = {}) {
  const archetype = opts.archetype || 'jazzcat';
  const bpm = opts.bpm ?? 132;
  const phaseOffset = opts.bouncePhase ?? (opts.x ? opts.x * 0.001 : 0);
  const pantsColor =
    opts.pantsColor ||
    opts.robeColor ||
    (archetype === 'flapper'
      ? RUBBER_PALETTE.tcCoral
      : archetype === 'bandleader'
        ? RUBBER_PALETTE.tcViolet
        : RUBBER_PALETTE.paperCream);
  const accentColor = opts.accentColor || opts.sashColor || RUBBER_PALETTE.tcGold;

  function skinRubberHose(ctx, skel, state, t = 0) {
    const swing = evalSwingBounce(t, bpm, phaseOffset);
    const bounceDy = state.hopY < -4 ? 0 : -swing.bounce * 0.65;
    const isBack = state.view === 'back';
    const isFront = state.view === 'front';

    const { pelvis, lumbar, thorax, neckBase, shL, wrL, shR, wrR, hipL, ankleL, hipR, ankleR, aHead, aR2 } = skel;

    ctx.save();
    // 1. Ground contact shadow (stays on floor)
    ctx.save();
    ctx.translate(0, -state.hopY * 0.85);
    ctx.scale(1.15, 0.26);
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(28, 20, 15, 0.38)';
    ctx.fill();
    ctx.restore();

    // Apply 132 BPM swing bounce to character body
    ctx.translate(0, bounceDy);

    // 2. Swing Rubber-Hose Tail (for `jazzcat`, `mouse`, `dog`)
    if (archetype === 'jazzcat' || archetype === 'mouse' || archetype === 'dog') {
      const tailSign = isFront ? -1 : -1;
      const tailWave = Math.sin(t * 7.5 + phaseOffset * 6);
      ctx.beginPath();
      ctx.moveTo(pelvis.x + tailSign * 16, pelvis.y + 4);
      ctx.bezierCurveTo(
        pelvis.x + tailSign * 56,
        pelvis.y - 8 + tailWave * 16,
        pelvis.x + tailSign * 78,
        pelvis.y - 52 - tailWave * 14,
        pelvis.x + tailSign * 64,
        pelvis.y - 76 + tailWave * 10
      );
      ctx.strokeStyle = RUBBER_PALETTE.paperCream;
      ctx.lineWidth = archetype === 'mouse' ? 6.5 : 11.5;
      ctx.stroke();
      ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
      ctx.lineWidth = archetype === 'mouse' ? 3.5 : 8.0;
      ctx.stroke();
    }

    // 3. Rear (Left) Arm & 4-Finger White Glove
    const armLBend = isFront ? -0.35 : -0.32;
    const armLRes = drawRubberHoseLimb(
      ctx,
      [shL.x, shL.y + 4],
      [wrL.x - (isFront ? 14 : 6), wrL.y + 8],
      {
        bend: armLBend,
        waveAmp: 4.5,
        wavePhase: t * 8,
        width: 11.5,
      }
    );
    drawCartoonGlove(ctx, wrL.x - (isFront ? 14 : 6), wrL.y + 8, {
      scale: 0.78,
      rot: armLRes.endAngle - Math.PI * 0.5,
      pose: 'open',
      flip: true,
    });

    // 4. Jointless S/C-Curve Rubber-Hose Legs & Bulbous Cartoon Shoes
    const legLBend = state.stride !== 0 ? 0.26 * Math.sin(state.walkPhase) : -0.28;
    const legRBend = state.stride !== 0 ? -0.26 * Math.sin(state.walkPhase) : 0.30;

    drawRubberHoseLimb(
      ctx,
      [hipL.x - (isFront ? 8 : 4), hipL.y],
      [ankleL.x - (isFront ? 10 : 4), ankleL.y - bounceDy],
      { bend: legLBend, width: 12.0 }
    );
    drawCartoonShoe(ctx, ankleL.x - (isFront ? 10 : 4), ankleL.y - bounceDy, {
      scale: 0.88,
      flip: isFront,
      tapAngle: 0,
    });

    drawRubberHoseLimb(
      ctx,
      [hipR.x + (isFront ? 8 : 4), hipR.y],
      [ankleR.x + (isFront ? 10 : 4), ankleR.y - bounceDy],
      { bend: legRBend, width: 12.5 }
    );
    drawCartoonShoe(ctx, ankleR.x + (isFront ? 10 : 4), ankleR.y - bounceDy, {
      scale: 0.92,
      flip: false,
      tapAngle: state.stride === 0 ? swing.footTap : 0,
    });

    // 5. Rounded 1930s Cartoon Torso + Button-Front Trousers / Flapper Dress
    const torsoCx = (pelvis.x + thorax.x) * 0.5;
    const torsoCy = (pelvis.y + neckBase.y) * 0.5 + 4;
    const torsoRx = 29 * swing.squashX;
    const torsoRy = 38 * swing.squashY;

    // Upper black ink torso
    ctx.save();
    ctx.translate(torsoCx, torsoCy);
    ctx.rotate(skel.aThorax * 0.65);
    ctx.beginPath();
    ctx.ellipse(0, -8, torsoRx * 0.92, torsoRy * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = archetype === 'tinbot' ? '#8C9BAE' : RUBBER_PALETTE.inkBlack;
    ctx.fill();
    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Lower 1930s high-waisted trousers or flapper fringe skirt with Ben-Day halftone dots
    ctx.beginPath();
    if (archetype === 'flapper') {
      ctx.moveTo(-torsoRx * 0.9, -4);
      ctx.lineTo(torsoRx * 0.9, -4);
      ctx.lineTo(torsoRx * 1.18, torsoRy * 0.88);
      ctx.lineTo(-torsoRx * 1.18, torsoRy * 0.88);
      ctx.closePath();
    } else {
      ctx.ellipse(0, 10, torsoRx, torsoRy * 0.72, 0, 0, Math.PI * 2);
    }
    ctx.fillStyle = pantsColor;
    ctx.fill();

    ctx.save();
    ctx.clip();
    drawBenDayDots(ctx, 4, 14, torsoRx, torsoRy * 0.72, {
      spacing: 7.5,
      alpha: 0.28,
      color: RUBBER_PALETTE.inkBlack,
    });
    ctx.restore();

    ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = 3.8;
    ctx.stroke();

    // Iconic 1930s twin vertical oval buttons on front of shorts/dress, or crossed X-suspenders & buttons on back view
    if (!isBack) {
      for (const bx of isFront ? [-9, 9] : [4, 15]) {
        ctx.beginPath();
        ctx.ellipse(bx, 8, 4.8, 7.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = RUBBER_PALETTE.paperCream;
        ctx.fill();
        ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
      // Bowtie at collar
      ctx.save();
      ctx.translate(isFront ? 0 : 12, -26);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-12, -7);
      ctx.lineTo(-12, 7);
      ctx.closePath();
      ctx.moveTo(0, 0);
      ctx.lineTo(12, -7);
      ctx.lineTo(12, 7);
      ctx.closePath();
      ctx.fillStyle = accentColor;
      ctx.fill();
      ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.restore();
    } else {
      // 1930s back-view crossed X-suspenders & twin back buttons
      ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
      ctx.lineWidth = 7.5;
      ctx.beginPath();
      ctx.moveTo(-14, -26);
      ctx.lineTo(11, 2);
      ctx.moveTo(14, -26);
      ctx.lineTo(-11, 2);
      ctx.stroke();

      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(-14, -26);
      ctx.lineTo(11, 2);
      ctx.moveTo(14, -26);
      ctx.lineTo(-11, 2);
      ctx.stroke();

      for (const bx of [-10, 10]) {
        ctx.beginPath();
        ctx.ellipse(bx, 6, 4.8, 7.0, 0, 0, Math.PI * 2);
        ctx.fillStyle = RUBBER_PALETTE.paperCream;
        ctx.fill();
        ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
    }
    ctx.restore();

    // 6. Expressive 1930s Cartoon Head, Pie-Cut Eyes, Mouth, Ears & Hat
    ctx.save();
    ctx.translate(neckBase.x, neckBase.y - 24);
    ctx.rotate(aHead * 0.8);

    const headR = 32;

    // Archetype Ears (Cat pointed ears, Mouse round ears, Dog floppy ears)
    if (archetype === 'jazzcat') {
      for (const [ex, rotE] of [
        [-18, -0.35],
        [14, 0.25],
      ]) {
        ctx.save();
        ctx.translate(ex, -headR + 6);
        ctx.rotate(rotE);
        ctx.beginPath();
        ctx.moveTo(-12, 8);
        ctx.lineTo(0, -20);
        ctx.lineTo(12, 8);
        ctx.closePath();
        ctx.fillStyle = RUBBER_PALETTE.inkBlack;
        ctx.fill();
        ctx.strokeStyle = isBack ? RUBBER_PALETTE.paperCream : RUBBER_PALETTE.inkBlack;
        ctx.lineWidth = isBack ? 2.4 : 3.2;
        ctx.stroke();
        ctx.restore();
      }
    } else if (archetype === 'mouse') {
      for (const [ex, ey] of [
        [-24, -26],
        [18, -28],
      ]) {
        ctx.beginPath();
        ctx.arc(ex, ey, 18, 0, Math.PI * 2);
        ctx.fillStyle = RUBBER_PALETTE.inkBlack;
        ctx.fill();
        ctx.strokeStyle = RUBBER_PALETTE.paperCream;
        ctx.lineWidth = 2.0;
        ctx.stroke();
      }
    }

    // Main circular cranium
    ctx.beginPath();
    ctx.arc(0, 0, headR, 0, Math.PI * 2);
    ctx.fillStyle = archetype === 'tinbot' ? '#B0C0D4' : RUBBER_PALETTE.inkBlack;
    ctx.fill();
    ctx.strokeStyle = isBack ? RUBBER_PALETTE.paperCream : RUBBER_PALETTE.inkBlack;
    ctx.lineWidth = isBack ? 2.6 : 3.8;
    ctx.stroke();

    if (!isBack) {
      // Cream Mickey/Oswald-style facial mask & plump muzzle
      const faceShiftX = isFront ? 0 : 8;
      ctx.beginPath();
      ctx.ellipse(faceShiftX - 4, -5, 16, 21, 0, 0, Math.PI * 2);
      ctx.ellipse(faceShiftX + 10, -5, 16, 21, 0, 0, Math.PI * 2);
      ctx.ellipse(faceShiftX + 6, 12, 26, 15, 0, 0, Math.PI * 2);
      ctx.fillStyle = RUBBER_PALETTE.paperCream;
      ctx.fill();

      // Muzzle outline
      ctx.beginPath();
      ctx.ellipse(faceShiftX + 6, 12, 26, 15, 0, -0.15 * Math.PI, 1.15 * Math.PI);
      ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
      ctx.lineWidth = 3.0;
      ctx.stroke();

      // Pie-Cut Cartoon Eyes
      const eyeMode =
        state.mood === 'angry'
          ? 'angry'
          : state.mood === 'shock' || state.mood === 'surprised'
            ? 'shock'
            : state.mood === 'dizzy'
              ? 'dizzy'
              : 'pie';
      drawPieCutEyes(ctx, faceShiftX + 4, -7, {
        mode: eyeMode,
        radius: 10.5,
        spacing: 21,
        lookX: isFront ? 0.1 : 0.42,
        lookY: -0.05,
        t,
      });

      // Glossy Black Button Nose
      const noseX = isFront ? 0 : 28;
      const noseY = 6;
      ctx.beginPath();
      ctx.ellipse(noseX, noseY, 8.5, 6.0, -0.15, 0, Math.PI * 2);
      ctx.fillStyle = RUBBER_PALETTE.inkBlack;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(noseX - 2.5, noseY - 2, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = RUBBER_PALETTE.paperCream;
      ctx.fill();

      // Cat whiskers if jazzcat
      if (archetype === 'jazzcat') {
        ctx.strokeStyle = RUBBER_PALETTE.inkBlack;
        ctx.lineWidth = 2.2;
        for (const wy of [-3, 3]) {
          ctx.beginPath();
          ctx.moveTo(faceShiftX + 18, 12 + wy);
          ctx.lineTo(faceShiftX + 36, 10 + wy * 2.2);
          ctx.stroke();
        }
      }

      // Expressive Mouth
      const mouthMode =
        state.heldProp === 'trumpet' || state.heldProp === 'saxophone'
          ? 'whistle'
          : state.mood === 'sing' || state.mood === 'roar'
            ? 'sing'
            : 'grin';
      drawCartoonMouth(ctx, faceShiftX + 6, 18, {
        mode: mouthMode,
        width: 22,
        height: 14,
        t,
      });
    }

    // Hat on top of head
    const defaultHat =
      opts.hat !== undefined
        ? opts.hat
        : archetype === 'flapper'
          ? 'feather'
          : archetype === 'bandleader'
            ? 'topHat'
            : 'bowler';
    drawRubberHat(ctx, defaultHat, archetype);
    ctx.restore();

    // 7. Foreground (Right) Rubber-Hose Arm, Held Instrument/Prop & 4-Finger White Glove
    const armRBend = state.shRAng < -0.5 ? -0.36 : 0.34;
    const armRRes = drawRubberHoseLimb(ctx, [shR.x, shR.y + 4], [wrR.x, wrR.y], {
      bend: armRBend,
      sCurve: state.shRAng < -0.8 ? 0.22 : 0,
      waveAmp: 4.0,
      wavePhase: t * 8 + 1.5,
      width: 12.0,
    });

    drawRubberHeldProp(ctx, state.heldProp, wrR, aR2 - Math.PI * 0.5, t);
    drawCartoonGlove(ctx, wrR.x, wrR.y, {
      scale: 0.84,
      rot: armRRes.endAngle - Math.PI * 0.5,
      pose: state.heldProp && state.heldProp !== 'none' ? 'grip' : 'point',
      flip: false,
    });

    ctx.restore();
  }

  return createPuppet2D({
    ...opts,
    dims: { ...RUBBER_HUMANOID_DIMS, ...(opts.dims || {}) },
    hat:
      opts.hat ??
      (opts.archetype === 'flapper'
        ? 'feather'
        : opts.archetype === 'bandleader'
          ? 'topHat'
          : 'bowler'),
    skin: skinRubberHose,
  });
}

// ============================================================================
// TIER 4B · 2D CELLULOID STAGE & SHOT-LIST DIRECTOR (`createRubberHoseStage`)
// ============================================================================

/**
 * Initializes the Turnkey 2D 1930s Celluloid Rubber-Hose Stage & Director (`createRubberHoseStage`).
 *
 * Built on [`engine/studio2d.js`](../../engine/studio2d.js) following the 2D law:
 *   `One Scene = One Composition, One Scene = One Continuous Move` (`一幕一构图 · 一场一单向微镜`).
 */
export function createRubberHoseStage({
  width = 1920,
  height = 1080,
  scenes = [],
  look = null,
  looks = null,
  sprockets = true,
} = {}) {
  const mergedPresets = { ...RUBBER_LOOK_PRESETS, ...(looks || {}) };
  const sceneLooks = scenes.map((sc) => {
    const rawLook = sc.el?.dataset?.look || sc.look || 'sepia';
    const blendDur = parseFloat(sc.el?.dataset?.lookBlend ?? sc.lookBlend ?? '0') || 0;
    const preset = mergedPresets[rawLook] || mergedPresets.sepia;
    return {
      start: sc.start ?? 0,
      dur: sc.dur ?? 4,
      end: sc.end ?? 4,
      preset: look ? { ...preset, ...look } : preset,
      blendDur,
    };
  });

  function getLookState(frame) {
    if (!sceneLooks.length) return mergedPresets.sepia;
    const idx = clamp(frame?.sceneIndex ?? 0, 0, sceneLooks.length - 1);
    const cur = sceneLooks[idx];
    const localT = frame?.localT ?? 0;
    if (idx > 0 && cur.blendDur > 0 && localT < cur.blendDur) {
      const prev = sceneLooks[idx - 1];
      const u = smootherstep(0, cur.blendDur, localT);
      return blendRubberLook(prev.preset, cur.preset, u);
    }
    return cur.preset;
  }

  return createStudio2D({
    width,
    height,
    designWidth: 1920,
    designHeight: 1080,
    scenes,
    getLookState,
    drawBackdrop: (ctx, w, h, lookState, camOffset, frame) => {
      drawCelluloidBackdrop(ctx, w, h, lookState, camOffset, frame);
    },
    drawTransition: (ctx, w, h, lookState, frame) => {
      const idx = frame?.sceneIndex ?? 0;
      const localT = frame?.localT ?? 0;
      const transDur = 0.24;
      if (idx > 0 && localT >= 0 && localT < transDur) {
        const u = smootherstep(0, transDur, localT);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = rgba(RUBBER_PALETTE.paperCream, (1 - u) * 0.24);
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
      if (sprockets !== false) {
        draw35mmSprocketOverlay(ctx, w, h, { t: frame?.t ?? 0 });
      }
    },
  });
}
