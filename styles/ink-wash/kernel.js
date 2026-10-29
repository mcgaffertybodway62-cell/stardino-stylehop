/**
 * Ink Wash Scroll · Pure Visual & Calligraphic Style Kernel (`styles/ink-wash/kernel.js`).
 *
 * Encapsulates 4 tiers of subject-agnostic 2D/2.5D Chinese Painting medium laws:
 *   Tier 1: Song-Dynasty Mineral Pigment & Five-Tone Ink Palette (`INK_PALETTE`),
 *           5 Time/Sub-Style Look Presets (`INK_LOOK_PRESETS`: `shanshui`, `qinglv`, `xieyi`, `night`, `snow`),
 *           Deterministic Motion/Physics (`quantizeInkTime`, `evalElasticCantilever`, `evalHopParabola`, `evalBoatBob`),
 *           Low-Level Calligraphic Brush (`drawCalligraphicStroke`), Wet-Ink Diffusion Wash (`drawWetInkWash`),
 *           Rock/Bark Cun-Fa Textures (`drawCunFaTexture`), Ink Bloom & Splatter (`drawInkBloom`, `drawInkSplatter`, `drawQiYunTrail`, `drawTaijiInkArray`)
 *   Tier 2: World-Space Raw Xuan Paper & Aged Silk Scroll Generator (`drawXuanPaperBackdrop`),
 *           Multi-Plane Parallax Mountains (`drawScrollMountains`), Negative-Space Mist (`drawMistRibbons`),
 *           Water & Ma Yuan Waves (`drawInkRipples`, `drawMaYuanWaves`),
 *           Atmospheric Weather Particles (`drawWeatherParticles`), Sun/Moon (`drawCelestialBody`)
 *   Tier 3: Composable Botanical, Architectural, Creature & Cultural Vessel Kit:
 *           `drawScholarRock`, `drawInkBamboo`, `drawInkPine`, `drawInkPlumBranch`, `drawInkWillow`,
 *           `drawInkLotus`, `drawInkReeds`, `drawInkPavilion`, `drawInkBridge`, `drawInkBoat`,
 *           `drawInkBird`, `drawInkFish`, `drawInkVessel`, `drawMasterBrush`, `drawCinnabarSeal`, `drawVerticalColophon`
 *   Tier 4: 2D Chinese Painting Character Puppet (`createInkCharacter`) &
 *           Aspect-Adaptive Multi-Plane Shot-List Director (`createInkScrollStage` -> `studio.director`)
 *
 * Strict Rule: Zero Star-Spark Slime mascot in `styles/ink-wash/`.
 */

import { clamp, lerp, smootherstep, flowStep, springStep, registerRuntimeCue } from '../../engine/motion.js';
export { clamp, lerp, smootherstep, flowStep, springStep };
import { createStudio2D, recordSceneElement2D, recordInteractionCheck2D } from '../../engine/studio2d.js';
import { createPuppet2D, computeContourEnvelope2D } from '../../engine/puppet2d.js';

// ============================================================================
// TIER 1A · PALETTE & FIVE-TONE INK / MINERAL PIGMENT SYSTEM
// ============================================================================

export const INK_PALETTE = {
  // Paper & Silk grounds
  xuanWarm: '#EFE5D2',
  xuanMid: '#E4D6BC',
  xuanEdge: '#D5C3A3',
  silkGold: '#EAD6B0',
  silkEdge: '#CEB382',
  sunsetPaper: '#EEDAC0',
  sunsetEdge: '#D6B894',
  nightIndigo: '#30435A',
  nightEdge: '#223144',
  snowPaper: '#EAE8E0',
  snowEdge: '#D2CFC4',

  // Five-Tone Sumi Ink (墨分五色：焦、浓、重、淡、清)
  inkJiao: '#101216',
  inkNong: '#1D2128',
  inkZhong: '#343B46',
  inkDan: '#5C6573',
  inkQing: '#8A94A3',

  // Classical Mineral & Plant Pigments (国画传统矿物植物色)
  huaQing: '#254E70',     // 花青 (Indigo)
  huaQingLight: '#497599',
  shiQing: '#1A5286',     // 石青 (Azurite)
  shiLv: '#2B7A5B',       // 石绿 (Malachite)
  sanLv: '#59A683',       // 三绿 (Light Malachite)
  zhuSha: '#C93524',      // 朱砂 (Cinnabar)
  yinZhu: '#E04F33',      // 银朱 (Vermilion)
  yanZhi: '#B84357',      // 胭脂 (Rouge)
  yanZhiSoft: '#E299A4',
  zheShi: '#9C5A38',      // 赭石 (Burnt Sienna)
  tengHuang: '#E2A83A',   // 藤黄 (Gamboge)
  niJin: '#D8A438',       // 泥金 (Mud Gold)
  niJinBright: '#F3D178', // 亮泥金
  geFen: '#FAF7F0',       // 蛤粉 (Clam White)
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

export function fbm2D(x, y = 0, octaves = 3) {
  let val = 0;
  let amp = 0.5;
  let freq = 1.0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * valueNoise2D(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.02;
  }
  return norm > 0 ? val / norm : 0.5;
}

// ============================================================================
// TIER 1B · SUB-STYLE / TIME-OF-DAY LOOK PRESETS (`data-look`)
// ============================================================================

export const INK_LOOK_PRESETS = {
  shanshui: {
    name: 'shanshui',
    paperTop: '#EFE6D4',
    paperBot: '#DAC8A9',
    fiberDark: '#8F7A5E',
    fiberLight: '#FAF5EA',
    goldFleck: 0.15,
    mtnFar: '#5D6878',
    mtnMid: '#374659',
    mtnNear: '#1F2C3B',
    mtnBaseWash: '#8E6244',
    mtnGoldOutline: 0.15,
    mistColor: '#F4ECE0',
    waterTint: '#264F73',
    celestial: 'sun',
    celestialColor: '#C93524',
  },
  qinglv: {
    name: 'qinglv',
    paperTop: '#EAD8B3',
    paperBot: '#CFB484',
    fiberDark: '#846B46',
    fiberLight: '#F8EED8',
    goldFleck: 0.55,
    mtnFar: '#1E5484',
    mtnMid: '#287658',
    mtnNear: '#1A463B',
    mtnBaseWash: '#9E5E36',
    mtnGoldOutline: 0.85,
    mistColor: '#F3E5C8',
    waterTint: '#246658',
    celestial: 'sun',
    celestialColor: '#D6422A',
  },
  xieyi: {
    name: 'xieyi',
    paperTop: '#F0DEC4',
    paperBot: '#D5B68E',
    fiberDark: '#8C6848',
    fiberLight: '#FAF0E2',
    goldFleck: 0.35,
    mtnFar: '#7A5458',
    mtnMid: '#543B44',
    mtnNear: '#2B2229',
    mtnBaseWash: '#B54A38',
    mtnGoldOutline: 0.42,
    mistColor: '#F5E4CC',
    waterTint: '#3A4B63',
    celestial: 'sun',
    celestialColor: '#C93524',
  },
  night: {
    name: 'night',
    // Calibrated so lookcheck.py READABILITY floors (L in [35, 92], p95 >= 55, contrast >= 7) pass cleanly
    paperTop: '#4A627C',
    paperBot: '#6B8299',
    fiberDark: '#263648',
    fiberLight: '#B8CBE0',
    goldFleck: 0.45,
    mtnFar: '#27394F',
    mtnMid: '#1C2B3D',
    mtnNear: '#121C28',
    mtnBaseWash: '#2F465E',
    mtnGoldOutline: 0.52,
    mistColor: '#DCE8F5',
    waterTint: '#18283A',
    celestial: 'moon',
    celestialColor: '#FAF7F0',
  },
  snow: {
    name: 'snow',
    paperTop: '#EAE8E0',
    paperBot: '#CFCBC0',
    fiberDark: '#7C7A72',
    fiberLight: '#FFFFFF',
    goldFleck: 0.12,
    mtnFar: '#68717D',
    mtnMid: '#3E4652',
    mtnNear: '#1E232B',
    mtnBaseWash: '#545B66',
    mtnGoldOutline: 0.1,
    mistColor: '#F7F7F4',
    waterTint: '#35495E',
    celestial: 'sun',
    celestialColor: '#C93524',
  },
};

// Map standard engine look names to ink-wash presets
INK_LOOK_PRESETS.day = INK_LOOK_PRESETS.shanshui;
INK_LOOK_PRESETS.golden = INK_LOOK_PRESETS.qinglv;
INK_LOOK_PRESETS.dusk = INK_LOOK_PRESETS.xieyi;
INK_LOOK_PRESETS.indoor = INK_LOOK_PRESETS.snow;

export function blendInkLook(lookA, lookB, u) {
  const a = INK_LOOK_PRESETS[lookA] || lookA || INK_LOOK_PRESETS.shanshui;
  const b = INK_LOOK_PRESETS[lookB] || lookB || INK_LOOK_PRESETS.shanshui;
  const k = clamp(u, 0, 1);
  if (k <= 0.001) return a;
  if (k >= 0.999) return b;
  return {
    name: k < 0.5 ? a.name : b.name,
    paperTop: mixHex(a.paperTop, b.paperTop, k),
    paperBot: mixHex(a.paperBot, b.paperBot, k),
    fiberDark: mixHex(a.fiberDark, b.fiberDark, k),
    fiberLight: mixHex(a.fiberLight, b.fiberLight, k),
    goldFleck: lerp(a.goldFleck, b.goldFleck, k),
    mtnFar: mixHex(a.mtnFar, b.mtnFar, k),
    mtnMid: mixHex(a.mtnMid, b.mtnMid, k),
    mtnNear: mixHex(a.mtnNear, b.mtnNear, k),
    mtnBaseWash: mixHex(a.mtnBaseWash, b.mtnBaseWash, k),
    mtnGoldOutline: lerp(a.mtnGoldOutline, b.mtnGoldOutline, k),
    mistColor: mixHex(a.mistColor, b.mistColor, k),
    waterTint: mixHex(a.waterTint, b.waterTint, k),
    celestial: k < 0.5 ? a.celestial : b.celestial,
    celestialColor: mixHex(a.celestialColor, b.celestialColor, k),
  };
}

// ============================================================================
// TIER 1C · DETERMINISTIC MOTION & PHYSICS PRIMITIVES
// ============================================================================

export function quantizeInkTime(t, fps = 24, blend = 0.25) {
  const stepped = Math.floor(t * fps) / fps;
  return lerp(t, stepped, blend);
}

export function evalSquashStretch(compression) {
  const c = clamp(compression, -0.35, 0.4);
  const sy = Math.max(0.55, 1.0 - c);
  const sx = 1.0 / Math.sqrt(sy);
  return { sx, sy };
}

export function evalElasticCantilever(t, pressStart = 0.5, pressDur = 1.2, releaseAmp = 0.42) {
  if (t < pressStart) return { bend: 0, vib: 0 };
  const releaseT = pressStart + pressDur;
  if (t < releaseT) {
    const u = smootherstep(pressStart, releaseT, t);
    return { bend: u, vib: 0 };
  }
  const dt = t - releaseT;
  const vib = Math.exp(-dt * 4.0) * Math.cos(dt * 22.0) * releaseAmp;
  return { bend: 0, vib };
}

export function evalHopParabola(u, x0, y0, x1, y1, apexH = 120) {
  const p = clamp(u, 0, 1);
  if (p < 0.12) {
    const prep = Math.sin((p / 0.12) * Math.PI);
    return { x: x0, y: y0, squash: prep * 0.22, tilt: prep * 0.08, airborne: false };
  }
  if (p > 0.88) {
    const land = Math.sin(((p - 0.88) / 0.12) * Math.PI);
    return { x: x1, y: y1, squash: land * 0.25, tilt: -land * 0.06, airborne: false };
  }
  const f = (p - 0.12) / 0.76;
  const x = lerp(x0, x1, f);
  const baseY = lerp(y0, y1, f);
  const arc = -4.0 * f * (1.0 - f) * apexH;
  const vy = 4.0 * (1.0 - 2.0 * f);
  return {
    x,
    y: baseY + arc,
    squash: -Math.abs(vy) * 0.04,
    tilt: clamp((x1 >= x0 ? 1 : -1) * vy * 0.1, -0.32, 0.32),
    airborne: true,
  };
}

export function evalBoatBob(t, speed = 1.2, amp = 5.5) {
  return {
    dy: Math.sin(t * speed * 2.1) * amp + Math.cos(t * speed * 1.3) * (amp * 0.35),
    tilt: Math.cos(t * speed * 1.9) * 0.028,
  };
}

export function evalBrushWriteProgress(localT, startT = 0.2, dur = 1.4) {
  const u = clamp((localT - startT) / Math.max(0.05, dur), 0, 1);
  const progress = smootherstep(0, 1, u);
  const speed = Math.sin(u * Math.PI);
  const pressure = 0.65 + 0.35 * Math.sin(u * Math.PI * 2.5);
  return { progress, speed, pressure, active: u > 0 && u < 1 };
}

// ============================================================================
// TIER 1D · CALLIGRAPHIC BRUSHSTROKE, WET-INK WASH & CUN-FA PRIMITIVES
// ============================================================================

function subdivideCatmullRom(pts, stepsPerSeg = 5) {
  if (!pts || pts.length < 3) return pts;
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
 * Draws a variable-width Chinese calligraphic brushstroke along `points` (`[[x,y], ...]`).
 * Supports tapered entry/exit (`藏锋/露锋/出锋`), dry-brush flying-white streaks (`feibai`),
 * progressive live-drawing (`reveal: 0..1`), and optional mud-gold companion thread.
 */
export function drawCalligraphicStroke(ctx, points, opts = {}) {
  const {
    width = 8,
    color = INK_PALETTE.inkNong,
    alpha = 0.9,
    entry = 'sharp', // 'sharp' | 'round'
    exit = 'taper',  // 'taper' | 'blunt'
    feibai = 0.25,
    reveal = 1.0,
    goldThread = false,
    smooth = true,
    seed = 42,
  } = opts;

  if (!points || points.length < 2 || reveal <= 0.005 || alpha <= 0.005) return;

  let basePts = points;
  if (points.length === 2) {
    // Subdivide 2-point segments so entry/belly/exit profiles render a full visible stroke
    basePts = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      basePts.push([lerp(points[0][0], points[1][0], u), lerp(points[0][1], points[1][1], u)]);
    }
  } else if (smooth && points.length >= 3 && points.length <= 16) {
    basePts = subdivideCatmullRom(points, 5);
  }

  // Sub-sample polyline up to `reveal`
  const totalSegs = basePts.length - 1;
  const maxFloat = clamp(reveal, 0, 1) * totalSegs;
  const fullCount = Math.floor(maxFloat);
  const frac = maxFloat - fullCount;
  const activePts = basePts.slice(0, fullCount + 1).map((p) => [...p]);
  if (fullCount < totalSegs && frac > 0.01) {
    const p0 = basePts[fullCount];
    const p1 = basePts[fullCount + 1];
    activePts.push([lerp(p0[0], p1[0], frac), lerp(p0[1], p1[1], frac)]);
  }
  if (activePts.length < 2) return;

  // Build left and right ribbon edges for authentic brush belly & tip
  const n = activePts.length;
  const leftEdge = [];
  const rightEdge = [];

  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1);
    const pPrev = activePts[Math.max(0, i - 1)];
    const pNext = activePts[Math.min(n - 1, i + 1)];
    const dx = pNext[0] - pPrev[0];
    const dy = pNext[1] - pPrev[1];
    const len = Math.max(1e-4, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;

    let profile = 1.0;
    if (u < 0.18) {
      profile = entry === 'sharp' ? Math.pow(u / 0.18, 0.65) : 0.55 + 0.45 * (u / 0.18);
    } else if (u > 0.72) {
      const v = (1 - u) / 0.28;
      profile = exit === 'taper' ? Math.pow(Math.max(0, v), 0.75) : 0.45 + 0.55 * v;
    } else {
      // Subtle calligraphic belly modulation (中锋行笔按压提按)
      profile = 0.88 + 0.22 * Math.sin(u * Math.PI * 1.5);
    }
    const w = width * profile * 0.5;
    leftEdge.push([activePts[i][0] + nx * w, activePts[i][1] + ny * w]);
    rightEdge.push([activePts[i][0] - nx * w, activePts[i][1] - ny * w]);
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(leftEdge[0][0], leftEdge[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(leftEdge[i][0], leftEdge[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(rightEdge[i][0], rightEdge[i][1]);
  ctx.closePath();
  ctx.fillStyle = rgba(color, alpha);
  ctx.fill();

  // Feibai (飞白) dry-brush paper-colored streaks near the tail of the stroke
  if (feibai > 0.05 && width >= 4) {
    const rng = mulberry32(seed);
    const streaks = Math.min(4, Math.max(1, Math.round(width * 0.25)));
    ctx.strokeStyle = rgba(INK_PALETTE.xuanWarm, clamp(feibai * 0.58, 0, 0.7));
    ctx.lineCap = 'round';
    for (let s = 0; s < streaks; s++) {
      const offset = (rng() - 0.5) * width * 0.55;
      const startIdx = Math.floor(n * (0.35 + rng() * 0.25));
      if (startIdx >= n - 1) continue;
      ctx.lineWidth = Math.max(0.8, width * 0.09);
      ctx.beginPath();
      for (let i = startIdx; i < n; i++) {
        const pPrev = activePts[Math.max(0, i - 1)];
        const pNext = activePts[Math.min(n - 1, i + 1)];
        const dx = pNext[0] - pPrev[0];
        const dy = pNext[1] - pPrev[1];
        const len = Math.max(1e-4, Math.hypot(dx, dy));
        const px = activePts[i][0] + (-dy / len) * offset * (1 - (i / n) * 0.5);
        const py = activePts[i][1] + (dx / len) * offset * (1 - (i / n) * 0.5);
        if (i === startIdx) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  // Optional mud-gold companion thread (泥金气韵线)
  if (goldThread) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (i === 0) ctx.moveTo(activePts[i][0], activePts[i][1] - width * 0.18);
      else ctx.lineTo(activePts[i][0], activePts[i][1] - width * 0.18);
    }
    ctx.strokeStyle = rgba(INK_PALETTE.niJinBright, alpha * 0.78);
    ctx.lineWidth = Math.max(1.2, width * 0.18);
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Fills any closed contour `points` (`[[x,y], ...]`) with authentic wet-ink & mineral diffusion
 * (`水墨分染/破墨`), optional wet stain rim (`宿墨水渍边`), and broken calligraphic outline (`焦墨破边`).
 */
export function drawWetInkWash(ctx, points, opts = {}) {
  const {
    coreColor = INK_PALETTE.inkNong,
    midColor = INK_PALETTE.huaQing,
    edgeColor = INK_PALETTE.inkDan,
    alpha = 0.88,
    coreAlpha = 0.96,
    midAlpha = 0.82,
    edgeAlpha = 0.24,
    smooth = true,
    wetRim = true,
    brokenOutline = true,
    outlineWidth = 2.4,
    outlineColor = INK_PALETTE.inkJiao,
    goldRim = false,
  } = opts;

  if (!points || points.length < 3 || alpha <= 0.005) return;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const rx = Math.max(8, (maxX - minX) * 0.5);
  const ry = Math.max(8, (maxY - minY) * 0.5);
  const maxR = Math.hypot(rx, ry);

  ctx.save();
  ctx.beginPath();
  if (smooth) {
    const n = points.length;
    const m0x = (points[n - 1][0] + points[0][0]) * 0.5;
    const m0y = (points[n - 1][1] + points[0][1]) * 0.5;
    ctx.moveTo(m0x, m0y);
    for (let i = 0; i < n; i++) {
      const p0 = points[i];
      const p1 = points[(i + 1) % n];
      ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) * 0.5, (p0[1] + p1[1]) * 0.5);
    }
  } else {
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();

  const grad = ctx.createRadialGradient(
    cx - rx * 0.18,
    cy - ry * 0.16,
    maxR * 0.08,
    cx,
    cy,
    maxR * 1.08
  );
  grad.addColorStop(0.0, rgba(coreColor, coreAlpha * alpha));
  grad.addColorStop(0.48, rgba(midColor, midAlpha * alpha));
  grad.addColorStop(0.84, rgba(edgeColor, Math.max(0.35, edgeAlpha * 1.6) * alpha));
  grad.addColorStop(1.0, rgba(edgeColor, edgeAlpha * alpha));
  ctx.fillStyle = grad;
  ctx.fill();

  if (wetRim) {
    ctx.strokeStyle = rgba(midColor, 0.32 * alpha);
    ctx.lineWidth = outlineWidth * 1.9;
    ctx.stroke();
  }

  if (brokenOutline) {
    ctx.strokeStyle = rgba(outlineColor, 0.82 * alpha);
    ctx.lineWidth = outlineWidth;
    ctx.setLineDash([maxR * 0.42, maxR * 0.06, maxR * 0.22, maxR * 0.05]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (goldRim) {
    ctx.strokeStyle = rgba(INK_PALETTE.niJinBright, 0.72 * alpha);
    ctx.lineWidth = Math.max(1.2, outlineWidth * 0.55);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Renders Chinese painting rock/mountain/bark texture strokes (`皴法与苔点`):
 * `kind`: `'pima'` (披麻皴), `'fupi'` (斧劈皴), `'midian'` (米点皴), `'bark'` (松鳞皴).
 */
export function drawCunFaTexture(ctx, bounds, opts = {}) {
  const {
    x = 0,
    y = 0,
    w = 200,
    h = 160,
  } = bounds || {};
  const {
    kind = 'fupi',
    count = 12,
    color = INK_PALETTE.inkZhong,
    mossColor = INK_PALETTE.shiLv,
    alpha = 0.5,
    moss = true,
    seed = 101,
  } = opts;

  const rng = mulberry32(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const sx = x + (0.12 + 0.76 * rng()) * w;
    const sy = y + (0.08 + 0.72 * rng()) * h;
    if (kind === 'midian') {
      // Mi Fu horizontal wet ink dots (米家云山横点)
      const rx = 10 + rng() * 18;
      const ry = 3.2 + rng() * 4.5;
      ctx.beginPath();
      ctx.ellipse(sx, sy, rx, ry, (rng() - 0.5) * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = rgba(color, alpha * (0.45 + 0.45 * rng()));
      ctx.fill();
    } else if (kind === 'pima') {
      // Hemp-fiber flowing curves (披麻皴)
      const len = 35 + rng() * 65;
      const dx = (rng() - 0.5) * 28;
      drawCalligraphicStroke(
        ctx,
        [
          [sx, sy],
          [sx + dx * 0.4, sy + len * 0.45],
          [sx + dx, sy + len],
        ],
        { width: 2.2 + rng() * 2.0, color, alpha: alpha * 0.75, feibai: 0.3, seed: seed + i }
      );
    } else {
      // Axe-cut angular slashes (斧劈皴)
      const len = 28 + rng() * 56;
      const ang = 0.95 + (rng() - 0.5) * 0.55;
      drawCalligraphicStroke(
        ctx,
        [
          [sx, sy],
          [sx + Math.cos(ang) * len * 0.5, sy + Math.sin(ang) * len * 0.5],
          [sx + Math.cos(ang + 0.15) * len, sy + Math.sin(ang + 0.15) * len],
        ],
        { width: 3.0 + rng() * 3.2, color, alpha: alpha * 0.82, entry: 'round', exit: 'taper', feibai: 0.45, seed: seed + i }
      );
    }
  }

  // Calligraphic moss dots along top ridge (点苔)
  if (moss) {
    const mossCount = Math.max(6, Math.round(count * 0.9));
    for (let m = 0; m < mossCount; m++) {
      const mx = x + (0.08 + 0.84 * rng()) * w;
      const my = y + (rng() - 0.15) * Math.min(34, h * 0.25);
      const mr = 2.0 + rng() * 2.8;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fillStyle = m % 3 === 0 ? rgba(mossColor, alpha * 1.15) : rgba(INK_PALETTE.inkJiao, alpha * 1.25);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Renders wet ink & mineral-pigment splash droplets with raw Xuan-paper bleed halos (`水晕墨点`).
 */
export function drawInkSplatter(ctx, cx, cy, opts = {}) {
  const {
    count = 14,
    spreadX = 55,
    spreadY = 42,
    minR = 2.0,
    maxR = 6.5,
    colors = [INK_PALETTE.inkJiao, INK_PALETTE.huaQing, INK_PALETTE.zhuSha, INK_PALETTE.niJin],
    alpha = 0.88,
    seed = 77,
  } = opts;
  if (alpha <= 0.01) return;
  const rng = mulberry32(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = Math.pow(rng(), 0.7);
    const dx = Math.cos(ang) * spreadX * dist;
    const dy = Math.sin(ang) * spreadY * dist;
    const r = lerp(minR, maxR, rng());
    const col = colors[i % colors.length];
    if (r > 3.2) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r * 1.75, 0, Math.PI * 2);
      ctx.fillStyle = rgba(col, alpha * 0.22);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(col, alpha * (0.72 + 0.28 * rng()));
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Animated capillary ink bloom on Xuan paper (`墨滴入纸晕化 / 破墨绽放`).
 */
export function drawInkBloom(ctx, cx, cy, progress, opts = {}) {
  const u = clamp(progress, 0, 1);
  if (u <= 0.005) return;
  const {
    maxRadius = 120,
    coreColor = INK_PALETTE.inkNong,
    midColor = INK_PALETTE.huaQing,
    edgeColor = INK_PALETTE.yanZhi,
    alpha = 0.85,
    seed = 19,
  } = opts;

  const r = maxRadius * Math.pow(u, 0.65);
  const fade = u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1.0;
  const pts = [];
  const n = 36;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wobble = 1 + 0.14 * Math.sin(5 * a + seed) + 0.08 * Math.cos(9 * a - seed * 2);
    pts.push([cx + Math.cos(a) * r * wobble, cy + Math.sin(a) * r * wobble]);
  }
  drawWetInkWash(ctx, pts, {
    coreColor,
    midColor,
    edgeColor,
    alpha: alpha * fade,
    wetRim: true,
    brokenOutline: false,
  });
}

/**
 * Sweeping S-curve calligraphic Qi-Yun motion ribbon (`行笔飞白与花青朱砂气韵线`).
 */
export function drawQiYunTrail(ctx, points, opts = {}) {
  const {
    width = 22,
    alpha = 0.78,
    reveal = 1.0,
    withDroplets = false,
    seed = 88,
  } = opts;
  if (!points || points.length < 2 || alpha <= 0.01 || reveal <= 0.01) return;

  // Outer mineral indigo wash
  drawCalligraphicStroke(ctx, points, {
    width: width * 1.45,
    color: INK_PALETTE.huaQing,
    alpha: alpha * 0.26,
    feibai: 0,
    reveal,
  });
  // Core sumi dry-brush stroke
  drawCalligraphicStroke(ctx, points, {
    width: width * 0.55,
    color: INK_PALETTE.inkNong,
    alpha: alpha * 0.72,
    feibai: 0.42,
    reveal,
    goldThread: true,
    seed,
  });
  // Cinnabar spark vein
  const offsetPts = points.map(([x, y]) => [x, y - width * 0.22]);
  drawCalligraphicStroke(ctx, offsetPts, {
    width: Math.max(2.5, width * 0.2),
    color: INK_PALETTE.zhuSha,
    alpha: alpha * 0.68,
    feibai: 0,
    reveal,
  });

  if (withDroplets) {
    const idx = Math.min(points.length - 1, Math.floor((points.length - 1) * clamp(reveal, 0, 1)));
    const [ tipX, tipY ] = points[idx];
    drawInkSplatter(ctx, tipX, tipY, {
      count: 10,
      spreadX: width * 1.8,
      spreadY: width * 1.5,
      alpha: alpha * 0.85,
      seed,
    });
  }
}

/**
 * Calligraphic Black-and-White Yin-Yang Taiji Diagram + Bagua Trigrams (`水墨黑白两仪太极阵`).
 */
export function drawTaijiInkArray(ctx, cx, cy, radius, rot = 0, alpha = 0.9, opts = {}) {
  if (alpha <= 0.01 || radius <= 2) return;
  const { scaleY = 1.0, withBagua = true } = opts;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1.0, scaleY);
  ctx.rotate(rot);

  const halo = ctx.createRadialGradient(0, 0, radius * 0.15, 0, 0, radius * 1.4);
  halo.addColorStop(0.0, rgba(INK_PALETTE.geFen, 0.45 * alpha));
  halo.addColorStop(0.65, rgba(INK_PALETTE.niJin, 0.24 * alpha));
  halo.addColorStop(1.0, rgba(INK_PALETTE.huaQing, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.4, 0, Math.PI * 2);
  ctx.fill();

  const rCore = radius * 0.74;
  ctx.beginPath();
  ctx.arc(0, 0, rCore, 0, Math.PI * 2);
  ctx.fillStyle = rgba(INK_PALETTE.geFen, 0.92 * alpha);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, rCore, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.arc(0, rCore * 0.5, rCore * 0.5, Math.PI * 0.5, -Math.PI * 0.5);
  ctx.arc(0, -rCore * 0.5, rCore * 0.5, Math.PI * 0.5, -Math.PI * 0.5, true);
  ctx.closePath();
  ctx.fillStyle = rgba(INK_PALETTE.inkJiao, 0.92 * alpha);
  ctx.fill();

  // Yin-Yang eyes
  ctx.beginPath();
  ctx.arc(0, -rCore * 0.5, rCore * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = rgba(INK_PALETTE.inkJiao, 0.95 * alpha);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, rCore * 0.5, rCore * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = rgba(INK_PALETTE.geFen, 0.95 * alpha);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, rCore, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.88 * alpha);
  ctx.lineWidth = 3.6;
  ctx.stroke();

  if (withBagua) {
    const bagua = [
      [1, 1, 1], [0, 1, 1], [1, 0, 1], [0, 0, 1],
      [1, 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 0],
    ];
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 4);
      ctx.translate(0, -radius * 0.95);
      ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.82 * alpha);
      ctx.lineWidth = 2.8;
      ctx.lineCap = 'round';
      for (let row = 0; row < 3; row++) {
        const ly = (row - 1) * 5.8;
        ctx.beginPath();
        if (bagua[i][row] === 1) {
          ctx.moveTo(-12, ly);
          ctx.lineTo(12, ly);
        } else {
          ctx.moveTo(-12, ly);
          ctx.lineTo(-2.5, ly);
          ctx.moveTo(2.5, ly);
          ctx.lineTo(12, ly);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

// ============================================================================
// TIER 2 · XUAN PAPER SURFACE, MULTI-PLANE MOUNTAINS, MIST, WATER & WEATHER
// ============================================================================

const _FIBER_LIST_CACHE = new Map();

function getPaperFibers(seed = 108) {
  if (_FIBER_LIST_CACHE.has(seed)) return _FIBER_LIST_CACHE.get(seed);
  const rng = mulberry32(seed);
  const fibers = [];
  for (let i = 0; i < 320; i++) {
    const x0 = rng() * 2400;
    const y0 = rng() * 1400;
    const len = 14 + rng() * 44;
    const ang = rng() * Math.PI * 2;
    const curve = (rng() - 0.5) * len * 0.65;
    fibers.push({
      x0,
      y0,
      x1: x0 + Math.cos(ang) * len,
      y1: y0 + Math.sin(ang) * len,
      cx: x0 + Math.cos(ang) * len * 0.5 + Math.sin(ang) * curve,
      cy: y0 + Math.sin(ang) * len * 0.5 - Math.cos(ang) * curve,
      isDark: rng() < 0.6,
      alpha: 0.1 + rng() * 0.18,
      lw: 0.55 + rng() * 0.85,
      isGold: rng() < 0.14,
      goldR: 1.0 + rng() * 2.2,
    });
  }
  _FIBER_LIST_CACHE.set(seed, fibers);
  return fibers;
}

/**
 * Renders handmade raw Xuan paper / aged silk scroll backdrop with world-locked mulberry bark
 * threads (`青檀皮丝`), bamboo laid lines (`竹帘纹`), and optional gold-leaf flecks (`洒金`).
 */
export function drawXuanPaperBackdrop(ctx, width, height, look = INK_LOOK_PRESETS.shanshui, camOffset = [0, 0]) {
  const lk = INK_LOOK_PRESETS[look] || look || INK_LOOK_PRESETS.shanshui;
  const [ox = 0, oy = 0] = camOffset;

  ctx.save();
  const bg = ctx.createLinearGradient(0, 0, width * 0.35, height);
  bg.addColorStop(0.0, lk.paperTop);
  bg.addColorStop(0.65, mixHex(lk.paperTop, lk.paperBot, 0.55));
  bg.addColorStop(1.0, lk.paperBot);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle bamboo laid screen lines (宣纸竹帘横纹)
  ctx.fillStyle = rgba(lk.fiberDark, 0.024);
  const startLine = Math.floor((oy * 0.15) % 6);
  for (let y = -startLine; y < height; y += 6) {
    ctx.fillRect(0, y, width, 1);
  }

  // World-space mulberry bark fibers & gold flecks (scrolling at 0.22 parallax so they never stick like dirty glass)
  const fibers = getPaperFibers(108);
  const tileW = 2400;
  const tileH = 1400;
  const shiftX = ((ox * 0.22) % tileW + tileW) % tileW;
  const shiftY = ((oy * 0.22) % tileH + tileH) % tileH;

  for (const f of fibers) {
    const fx0 = ((f.x0 - shiftX + tileW) % tileW) - 120;
    const fy0 = ((f.y0 - shiftY + tileH) % tileH) - 100;
    if (fx0 < -80 || fx0 > width + 80 || fy0 < -80 || fy0 > height + 80) continue;
    const dx = fx0 - f.x0;
    const dy = fy0 - f.y0;
    ctx.beginPath();
    ctx.moveTo(fx0, fy0);
    ctx.quadraticCurveTo(f.cx + dx, f.cy + dy, f.x1 + dx, f.y1 + dy);
    ctx.strokeStyle = f.isDark ? rgba(lk.fiberDark, f.alpha) : rgba(lk.fiberLight, f.alpha * 1.35);
    ctx.lineWidth = f.lw;
    ctx.stroke();

    if (f.isGold && lk.goldFleck > 0.05) {
      ctx.beginPath();
      ctx.arc(fx0 + 8, fy0 - 5, f.goldR, 0, Math.PI * 2);
      ctx.fillStyle = rgba(INK_PALETTE.niJinBright, lk.goldFleck * 0.55);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Renders a cinnabar rising sun (`朱砂旭日`) or luminous negative-space full moon (`留白明月`).
 */
export function drawCelestialBody(ctx, x, y, r = 68, look = INK_LOOK_PRESETS.shanshui, opts = {}) {
  const lk = INK_LOOK_PRESETS[look] || look || INK_LOOK_PRESETS.shanshui;
  const kind = opts.kind || lk.celestial || 'sun';
  const alpha = opts.alpha ?? 0.92;

  ctx.save();
  if (kind === 'moon') {
    const halo = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3.4);
    halo.addColorStop(0.0, rgba(INK_PALETTE.geFen, 0.55 * alpha));
    halo.addColorStop(0.45, rgba(INK_PALETTE.niJinBright, 0.22 * alpha));
    halo.addColorStop(1.0, rgba(INK_PALETTE.geFen, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, r * 3.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(INK_PALETTE.geFen, 0.96 * alpha);
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.niJinBright, 0.65 * alpha);
    ctx.lineWidth = 2.0;
    ctx.stroke();
  } else {
    const halo = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4);
    halo.addColorStop(0.0, rgba(INK_PALETTE.zhuSha, 0.38 * alpha));
    halo.addColorStop(0.55, rgba(INK_PALETTE.niJin, 0.16 * alpha));
    halo.addColorStop(1.0, rgba(INK_PALETTE.zhuSha, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();

    const sunG = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
    sunG.addColorStop(0.0, rgba(INK_PALETTE.yinZhu, 0.92 * alpha));
    sunG.addColorStop(0.75, rgba(INK_PALETTE.zhuSha, 0.88 * alpha));
    sunG.addColorStop(1.0, rgba(INK_PALETTE.zheShi, 0.72 * alpha));
    ctx.fillStyle = sunG;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Renders 3 continuous parallax layers of Song-Dynasty mountains (`远山如黛 / 千里青绿`).
 * Automatically adapts to `look` (`shanshui`, `qinglv`, `xieyi`, `night`, `snow`), transforms
 * coherently with the 2.5D scroll camera (`ctx.__inkCam`) so mountains never slice across the
 * high sky/moon during upward or close-up shots, and softens ridge contrast at high zoom
 * (`水墨景深虚化`) so foreground subjects always read as the clear visual hero.
 */
export function drawScrollMountains(ctx, width, height, look = INK_LOOK_PRESETS.shanshui, opts = {}) {
  const lk = INK_LOOK_PRESETS[look] || look || INK_LOOK_PRESETS.shanshui;
  const cam = ctx.__inkCam || null;
  const {
    camX = cam ? cam.cx : 960,
    camY = cam ? cam.cy : 540,
    baseYOffset = 0,
    ampScale = 1.0,
    withWaterfall = false,
    waterfallX = 1180,
    seed = 2026,
  } = opts;

  const vpScale = Math.min(width / 1920, height / 1080);
  const camZoom = cam ? cam.zoom : vpScale;
  const relZoom = clamp(camZoom / Math.max(0.1, vpScale), 0.85, 2.6);
  // Shallow depth-of-field attenuation when zoomed into medium/close shots so background ridges never clutter the hero
  const dofSoft = clamp(1.28 / Math.pow(relZoom, 0.55), 0.52, 1.0);

  const focusX = cam ? cam.focusX : camX;
  const focusY = cam ? cam.focusY : camY;
  const panX = cam ? cam.panX + (cam.angleShift || 0) : camX - 960;
  const panY = cam ? cam.panY : camY - 540;

  // Horizon vertical shift: when camera tilts up (focusY < 540), mountains move down naturally with the ground plane
  const horizonShiftY = (540 - focusY) * (0.55 + 0.25 * Math.min(1, relZoom - 1)) - panY * 0.35;
  const ox = (focusX - 960) * 0.45 + panX;

  const layers = [
    { parallax: 0.18, baseY: 235 + baseYOffset, amp: 72 * ampScale, period: 380, col: lk.mtnFar, alpha: 0.34 * dofSoft, mistH: 220, details: false },
    { parallax: 0.30, baseY: 315 + baseYOffset, amp: 92 * ampScale, period: 290, col: lk.mtnMid, alpha: 0.50 * dofSoft, mistH: 240, details: false },
    { parallax: 0.44, baseY: 400 + baseYOffset, amp: 108 * ampScale, period: 220, col: lk.mtnNear, alpha: 0.64 * dofSoft, mistH: 260, details: relZoom < 1.55 },
  ];

  const steps = 110;
  for (const [layerIdx, L] of layers.entries()) {
    ctx.save();
    const layerScale = lerp(1.0, relZoom, L.parallax * 0.65);
    const by = 540 + (L.baseY - 540) * layerScale + horizonShiftY * (0.65 + L.parallax * 0.55);
    const amp = L.amp * layerScale;
    const mistH = L.mistH * layerScale;

    const ridgePts = [];
    ctx.beginPath();
    ctx.moveTo(-80, height + 120);
    for (let i = 0; i <= steps; i++) {
      const sx = -80 + ((width + 160) * i) / steps;
      const wx = (sx - width * 0.5) / layerScale + 960 + ox * L.parallax + seed * 17;
      const s1 = Math.sin(wx / L.period + 0.5 + layerIdx);
      const s2 = 0.46 * Math.sin(wx / (L.period * 0.47) + 1.3);
      const s3 = 0.22 * Math.cos(wx / (L.period * 0.23) - 0.8);
      const wy = by + amp * (s1 + s2 + s3);
      ridgePts.push([sx, wy, wx]);
      ctx.lineTo(sx, wy);
    }
    ctx.lineTo(width + 80, height + 120);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, by - amp * 1.2, 0, by + mistH);
    grad.addColorStop(0.0, rgba(L.col, L.alpha));
    grad.addColorStop(0.45, rgba(mixHex(L.col, lk.mtnBaseWash, 0.38), L.alpha * 0.72));
    grad.addColorStop(0.82, rgba(lk.mtnBaseWash, L.alpha * 0.22));
    grad.addColorStop(1.0, rgba(lk.mtnBaseWash, 0.0));
    ctx.fillStyle = grad;
    ctx.fill();

    // Crisp calligraphic ridge line + optional 千里江山 mud-gold outline (`泥金勾山`)
    ctx.beginPath();
    for (let i = 0; i < ridgePts.length; i++) {
      if (i === 0) ctx.moveTo(ridgePts[i][0], ridgePts[i][1]);
      else ctx.lineTo(ridgePts[i][0], ridgePts[i][1]);
    }
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, L.alpha * 0.52 * dofSoft);
    ctx.lineWidth = (layerIdx === 2 ? 2.4 : 1.5) * Math.sqrt(layerScale);
    ctx.stroke();

    if (lk.mtnGoldOutline > 0.2 && layerIdx >= 1) {
      ctx.beginPath();
      for (let i = 0; i < ridgePts.length; i++) {
        if (i === 0) ctx.moveTo(ridgePts[i][0], ridgePts[i][1] + 2.2);
        else ctx.lineTo(ridgePts[i][0], ridgePts[i][1] + 2.2);
      }
      ctx.strokeStyle = rgba(INK_PALETTE.niJinBright, lk.mtnGoldOutline * 0.62 * dofSoft);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Snow caps on winter look (`蛤粉积雪`)
    if (lk.name === 'snow' && layerIdx >= 1) {
      ctx.beginPath();
      for (let i = 0; i < ridgePts.length; i++) {
        if (i === 0) ctx.moveTo(ridgePts[i][0], ridgePts[i][1] + 3);
        else ctx.lineTo(ridgePts[i][0], ridgePts[i][1] + 3);
      }
      ctx.strokeStyle = rgba(INK_PALETTE.geFen, 0.82 * dofSoft);
      ctx.lineWidth = 5.2;
      ctx.stroke();
    }

    // Moss dots on nearer mountain ridge (only in wide/full shots so close-ups stay clean)
    if (L.details) {
      const cellW = L.period * 0.5;
      for (let i = 4; i < ridgePts.length - 4; i += 6) {
        const [sx, sy, wx] = ridgePts[i];
        const prevY = ridgePts[i - 2][1];
        const nextY = ridgePts[i + 2][1];
        if (sy <= prevY && sy <= nextY) {
          const rng = mulberry32(Math.floor(wx / cellW) * 97 + 13);
          for (let m = 0; m < 6; m++) {
            const dx = (rng() - 0.5) * 68;
            const dy = -4 + rng() * 26;
            const r = 1.8 + rng() * 2.2;
            ctx.beginPath();
            ctx.arc(sx + dx, sy + dy, r, 0, Math.PI * 2);
            ctx.fillStyle = m % 2 === 0 ? rgba(INK_PALETTE.inkJiao, 0.36 * dofSoft) : rgba(INK_PALETTE.shiLv, 0.32 * dofSoft);
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  }

  // Optional cascading negative-space waterfall (`留白飞瀑`)
  if (withWaterfall) {
    const layerScale = lerp(1.0, relZoom, 0.28);
    const wfx = width * 0.5 + (waterfallX - 960 - ox * 0.42) * layerScale;
    const wfy = 540 + (335 + baseYOffset - 540) * layerScale + horizonShiftY * 0.85;
    if (wfx > -120 && wfx < width + 120) {
      ctx.save();
      for (const [dx, lw, a] of [[-5, 6.5, 0.82 * dofSoft], [5, 3.8, 0.68 * dofSoft], [0, 12, 0.26 * dofSoft]]) {
        ctx.beginPath();
        ctx.moveTo(wfx + dx, wfy);
        ctx.bezierCurveTo(
          wfx + dx - 10 * layerScale,
          wfy + 90 * layerScale,
          wfx + dx + 8 * layerScale,
          wfy + 185 * layerScale,
          wfx + dx - 4 * layerScale,
          wfy + 275 * layerScale
        );
        ctx.strokeStyle = rgba(INK_PALETTE.geFen, a);
        ctx.lineWidth = lw * Math.sqrt(layerScale);
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  recordSceneElement2D(ctx, {
    id: opts.id || `scrollMountains_${seed}`,
    role: 'bg',
    layerZ: 0.22,
    kind: 'scrollMountains',
    bbox: [0, Math.max(0, 180 + baseYOffset + horizonShiftY * 0.65), width, Math.min(height, 620 + baseYOffset + horizonShiftY * 0.85)],
  });
}

/**
 * Renders drifting negative-space mist ribbons (`留白云带 / 烟波浩渺`).
 * Synchronized with `ctx.__inkCam` vertical horizon and zoom so mist bands stay nestled
 * along the mountain waist and never cut across the high sky or moon.
 */
export function drawMistRibbons(ctx, width, height, look = INK_LOOK_PRESETS.shanshui, t = 0, opts = {}) {
  const lk = INK_LOOK_PRESETS[look] || look || INK_LOOK_PRESETS.shanshui;
  const cam = ctx.__inkCam || null;
  const { camX = cam ? cam.cx : 960, camY = cam ? cam.cy : 540, bands = null } = opts;

  const vpScale = Math.min(width / 1920, height / 1080);
  const camZoom = cam ? cam.zoom : vpScale;
  const relZoom = clamp(camZoom / Math.max(0.1, vpScale), 0.85, 2.6);
  const dofSoft = clamp(1.25 / Math.pow(relZoom, 0.45), 0.55, 1.0);

  const focusX = cam ? cam.focusX : camX;
  const focusY = cam ? cam.focusY : camY;
  const panX = cam ? cam.panX + (cam.angleShift || 0) : camX - 960;
  const panY = cam ? cam.panY : camY - 540;
  const horizonShiftY = (540 - focusY) * (0.55 + 0.25 * Math.min(1, relZoom - 1)) - panY * 0.35;
  const ox = (focusX - 960) * 0.45 + panX;

  const list = bands || [
    { y: 295, h: 58, alpha: 0.22, parallax: 0.25 },
    { y: 395, h: 72, alpha: 0.30, parallax: 0.36 },
    { y: 505, h: 90, alpha: 0.38, parallax: 0.48 },
  ];

  ctx.save();
  for (const [idx, b] of list.entries()) {
    const layerScale = lerp(1.0, relZoom, b.parallax * 0.65);
    const cy = 540 + (b.y - 540) * layerScale + horizonShiftY * (0.65 + b.parallax * 0.55) + Math.sin(t * 0.5 + idx * 1.7) * 5;
    const bh = b.h * layerScale;
    const bAlpha = b.alpha * dofSoft;

    const g = ctx.createLinearGradient(0, cy - bh * 0.5, 0, cy + bh * 0.5);
    g.addColorStop(0.0, rgba(lk.mistColor, 0.0));
    g.addColorStop(0.5, rgba(lk.mistColor, bAlpha));
    g.addColorStop(1.0, rgba(lk.mistColor, 0.0));
    ctx.fillStyle = g;
    ctx.fillRect(0, cy - bh * 0.5, width, bh);

    // Subtle swirling cloud-waist puff ellipses
    const puffX = ((idx * 520 - ox * b.parallax + t * (12 + idx * 4)) % (width + 600) + (width + 600)) % (width + 600) - 300;
    ctx.save();
    ctx.translate(puffX, cy);
    ctx.scale(layerScale, 0.18 * layerScale);
    const rg = ctx.createRadialGradient(0, 0, 12, 0, 0, 260);
    rg.addColorStop(0.0, rgba(lk.mistColor, bAlpha * 1.2));
    rg.addColorStop(0.6, rgba(lk.mistColor, bAlpha * 0.5));
    rg.addColorStop(1.0, rgba(lk.mistColor, 0.0));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Renders concentric sumi-ink & mineral-indigo water ripples (`水墨同心涟漪`) on negative-space water.
 * Uses broken calligraphic dry-brush arcs (`中锋/侧锋枯笔飞白弧`) with perspective foreshortening
 * instead of mechanical vector dashed ellipses.
 */
export function drawInkRipples(ctx, cx, cy, maxR = 175, alphaGain = 1.0, color = INK_PALETTE.huaQing) {
  if (maxR <= 2 || alphaGain <= 0.01) return;
  const t = ctx.__inkFrame?.t ?? 0;
  const flatY = 0.28;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1.0, flatY);
  const pool = ctx.createRadialGradient(0, 0, 2, 0, 0, maxR * 0.32);
  pool.addColorStop(0.0, rgba(color, 0.28 * alphaGain));
  pool.addColorStop(1.0, rgba(color, 0.0));
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.arc(0, 0, maxR * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Concentric calligraphic arc segments with natural breathing gaps & tapered feibai ends
  const rings = [
    { rFrac: 0.26, tone: 0.36 * alphaGain, w: 3.2, arcs: [[-0.85, 0.95], [1.45, 3.05], [3.55, 5.05]], seed: 401 },
    { rFrac: 0.50, tone: 0.27 * alphaGain, w: 2.6, arcs: [[-0.45, 1.35], [1.85, 3.45], [3.95, 5.45]], seed: 419 },
    { rFrac: 0.75, tone: 0.19 * alphaGain, w: 2.1, arcs: [[-1.05, 0.55], [1.05, 2.55], [3.15, 4.75]], seed: 433 },
    { rFrac: 1.00, tone: 0.12 * alphaGain, w: 1.7, arcs: [[-0.25, 1.15], [2.15, 3.65], [4.25, 5.65]], seed: 449 },
  ];

  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri];
    const rx = maxR * ring.rFrac + Math.sin(t * 1.5 - ri * 0.9) * 3.5;
    const ry = rx * flatY;
    const phase = Math.sin(t * 0.8 + ri * 1.3) * 0.12;
    for (let ai = 0; ai < ring.arcs.length; ai++) {
      const [a0, a1] = ring.arcs[ai];
      const pts = [];
      const steps = 7;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const ang = a0 + (a1 - a0) * u + phase;
        const wobble = Math.sin(ang * 3 + ri * 1.7) * 1.8;
        pts.push([
          cx + Math.cos(ang) * (rx + wobble),
          cy + Math.sin(ang) * (ry + wobble * flatY),
        ]);
      }
      stroke(
        ctx,
        pts,
        LOAD({
          w: ring.w,
          tone: ring.tone,
          dry: 0.46,
          wet: 0.35,
          prof: 'orchid',
          color,
          seed: ring.seed + ai * 17,
        })
      );
    }
  }
}

/**
 * Renders Ma Yuan 《水图》 rhythmic calligraphic wave curves (`马远水图 · 层波叠浪/勾云水波纹`).
 * Uses multi-bristle loaded calligraphy (`stroke` + `LOAD`) with organic crest-and-trough rhythm.
 */
export function drawMaYuanWaves(ctx, x0, y0, w, h, t = 0, opts = {}) {
  const {
    rows = 5,
    cols = 6,
    color = INK_PALETTE.huaQing,
    alpha = 0.28,
    seed = 521,
  } = opts;

  for (let r = 0; r < rows; r++) {
    const v = (r + 0.5) / Math.max(1, rows);
    const ry = y0 + v * h;
    const rowScale = 0.68 + 0.52 * (r / Math.max(1, rows - 1));
    const strokeW = (1.8 + 1.4 * rowScale);
    const rowTone = clamp(alpha * (0.68 + 0.45 * v), 0.04, 0.85);

    for (let c = 0; c < cols; c++) {
      const cellHash = hash2D(c + seed * 0.01, r * 3.7);
      const stagger = (r % 2) * 0.48 + (cellHash - 0.5) * 0.22;
      const rx = x0 + ((c + stagger) / cols) * w + Math.sin(t * 1.35 + r * 1.1 + c * 0.8) * 16 * rowScale;
      const span = (w / cols) * (0.62 + cellHash * 0.22) * rowScale;
      const swell = (6.5 + cellHash * 4.5) * rowScale * (0.65 + 0.35 * Math.sin(t * 1.85 + c * 0.95 + r * 1.3));

      // Asymmetric Ma Yuan wave crest: gentle windward rise -> hooked crest -> long leeward sweep
      const pts = [
        [rx - span * 0.52, ry + swell * 0.22],
        [rx - span * 0.22, ry - swell * 0.45],
        [rx - span * 0.04, ry - swell * 0.92],
        [rx + span * 0.18, ry + swell * 0.28],
        [rx + span * 0.52, ry + swell * 0.06],
      ];
      stroke(
        ctx,
        pts,
        LOAD({
          w: strokeW,
          tone: rowTone,
          dry: 0.44 + (1 - v) * 0.16,
          wet: 0.3,
          prof: 'orchid',
          color,
          seed: seed + r * 31 + c * 7,
        })
      );
    }
  }
}

/**
 * Deterministic atmospheric weather particles (`斜风细雨 / 寒江飞雪 / 落英缤纷 / 泥金灵气`).
 * `kind`: `'rain' | 'snow' | 'petals' | 'bamboo-leaves' | 'gold-motes'`.
 */
export function drawWeatherParticles(ctx, width, height, t = 0, opts = {}) {
  const {
    kind = 'petals',
    count = 36,
    wind = 1.0,
    alpha = 0.82,
    seed = 303,
  } = opts;
  const rng = mulberry32(seed);
  ctx.save();

  for (let i = 0; i < count; i++) {
    const bx = rng() * width;
    const by = rng() * height;
    const speedY = kind === 'rain' ? 680 : kind === 'gold-motes' ? -55 : 95 + rng() * 65;
    const speedX = kind === 'rain' ? -180 * wind : (42 + rng() * 35) * wind;
    const px = ((bx + speedX * t) % (width + 120) + (width + 120)) % (width + 120) - 60;
    const py = ((by + speedY * t) % (height + 120) + (height + 120)) % (height + 120) - 60;

    if (kind === 'rain') {
      const len = 28 + rng() * 24;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - 8 * wind, py + len);
      ctx.strokeStyle = rgba(INK_PALETTE.huaQingLight, alpha * (0.28 + 0.25 * rng()));
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (kind === 'snow') {
      const r = 2.2 + rng() * 4.2;
      ctx.beginPath();
      ctx.arc(px + Math.sin(t * 2 + i) * 12, py, r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(INK_PALETTE.geFen, alpha * (0.65 + 0.35 * rng()));
      ctx.fill();
    } else if (kind === 'gold-motes') {
      const r = 1.8 + rng() * 3.4;
      const pulse = 0.55 + 0.45 * Math.sin(t * 3.5 + i * 1.3);
      ctx.beginPath();
      ctx.arc(px + Math.sin(t * 1.4 + i) * 16, py, r * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = rgba(INK_PALETTE.niJinBright, alpha * 0.24 * pulse);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + Math.sin(t * 1.4 + i) * 16, py, r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(i % 3 === 0 ? INK_PALETTE.zhuSha : INK_PALETTE.niJinBright, alpha * pulse);
      ctx.fill();
    } else if (kind === 'bamboo-leaves') {
      const ang = 0.4 + Math.sin(t * 2.5 + i) * 0.35;
      drawBambooLeaf(ctx, px, py, 24 + rng() * 16, ang, 4.8, INK_PALETTE.inkNong, alpha * 0.78, 0.18);
    } else {
      // 'petals' (plum/peach blossom petals 落英缤纷)
      ctx.save();
      ctx.translate(px + Math.sin(t * 2.0 + i) * 14, py);
      ctx.rotate(t * (1.2 + (i % 3) * 0.4) + i);
      const pr = 5.5 + rng() * 5.0;
      ctx.beginPath();
      ctx.moveTo(0, -pr);
      ctx.quadraticCurveTo(pr * 0.85, 0, 0, pr);
      ctx.quadraticCurveTo(-pr * 0.85, 0, 0, -pr);
      ctx.fillStyle = rgba(i % 2 === 0 ? INK_PALETTE.yanZhi : INK_PALETTE.yanZhiSoft, alpha * 0.88);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

// ============================================================================
// TIER 3A · BOTANICAL & LANDSCAPE KIT (奇石、墨竹、苍松、红梅、垂柳、墨荷、芦苇)
// ============================================================================

/**
 * Renders a Song-Dynasty Taihu Scholar's Rock or Cantilevered Cliff Ledge (`太湖奇石 / 悬崖云台`).
 */
export function drawScholarRock(ctx, cx, topY, opts = {}) {
  const {
    w = 240,
    h = 240,
    color = INK_PALETTE.huaQing,
    inkColor = INK_PALETTE.inkJiao,
    cunfa = 'fupi',
    goldRim = true,
    seed = 11,
  } = opts;
  const hw = w * 0.5;
  ctx.save();

  ctx.beginPath();
  ctx.moveTo(cx - hw - 55, topY + h);
  ctx.bezierCurveTo(cx - hw - 42, topY + h * 0.55, cx - hw - 18, topY + 28, cx - hw * 0.76, topY);
  ctx.lineTo(cx + hw * 0.78, topY);
  ctx.bezierCurveTo(cx + hw + 18, topY + 6, cx + hw + 28, topY + 38, cx + hw + 14, topY + 72);
  ctx.bezierCurveTo(cx + hw + 36, topY + h * 0.55, cx + hw + 52, topY + h * 0.82, cx + hw + 62, topY + h);
  ctx.closePath();

  const g = ctx.createLinearGradient(0, topY, 0, topY + h);
  g.addColorStop(0.0, rgba(mixHex(color, INK_PALETTE.inkNong, 0.45), 0.82));
  g.addColorStop(0.45, rgba(color, 0.52));
  g.addColorStop(0.82, rgba(INK_PALETTE.zheShi, 0.18));
  g.addColorStop(1.0, rgba(INK_PALETTE.zheShi, 0.0));
  ctx.fillStyle = g;
  ctx.fill();

  // Calligraphic rock shoulder outline
  drawCalligraphicStroke(
    ctx,
    [
      [cx - hw - 28, topY + 52],
      [cx - hw - 12, topY + 14],
      [cx - hw * 0.75, topY],
      [cx + hw * 0.78, topY],
      [cx + hw + 18, topY + 16],
      [cx + hw + 22, topY + 68],
    ],
    { width: 5.2, color: inkColor, alpha: 0.92, feibai: 0.32, goldThread: goldRim, seed }
  );

  drawCunFaTexture(
    ctx,
    { x: cx - hw * 0.85, y: topY + 6, w: w * 0.85, h: h * 0.65 },
    { kind: cunfa, count: 10, color: inkColor, alpha: 0.48, moss: true, seed }
  );
  ctx.restore();
}

export function drawBambooLeaf(ctx, x0, y0, length, angle, widthMid = 7.5, color = INK_PALETTE.inkJiao, alpha = 0.92, bend = 0.15) {
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(angle);
  const tipX = length;
  const tipY = bend * length;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(
    length * 0.32, -widthMid * 0.85 + tipY * 0.15,
    length * 0.65, -widthMid * 0.35 + tipY * 0.55,
    tipX, tipY
  );
  ctx.bezierCurveTo(
    length * 0.68, widthMid * 0.35 + tipY * 0.55,
    length * 0.28, widthMid * 0.85 + tipY * 0.15,
    0, 0
  );
  ctx.closePath();
  ctx.fillStyle = rgba(color, alpha);
  ctx.fill();
  ctx.restore();
}

export function drawBambooCulmSegment(ctx, p0, p1, w0, w1, color = INK_PALETTE.inkNong, alpha = 0.92) {
  const [x0, y0] = p0;
  const [x1, y1] = p1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.max(1e-4, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  const wMid = (w0 + w1) * 0.46;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0 - nx * w0 * 0.5, y0 - ny * w0 * 0.5);
  ctx.bezierCurveTo(
    x0 + dx * 0.25 - nx * wMid * 0.5, y0 + dy * 0.25 - ny * wMid * 0.5,
    x1 - dx * 0.25 - nx * wMid * 0.5, y1 - dy * 0.25 - ny * wMid * 0.5,
    x1 - nx * w1 * 0.5, y1 - ny * w1 * 0.5
  );
  ctx.lineTo(x1 + nx * w1 * 0.5, y1 + ny * w1 * 0.5);
  ctx.bezierCurveTo(
    x1 - dx * 0.25 + nx * wMid * 0.5, y1 - dy * 0.25 + ny * wMid * 0.5,
    x0 + dx * 0.25 + nx * wMid * 0.5, y0 + dy * 0.25 + ny * wMid * 0.5,
    x0 + nx * w0 * 0.5, y0 + ny * w0 * 0.5
  );
  ctx.closePath();
  ctx.fillStyle = rgba(color, alpha);
  ctx.fill();

  // Bamboo joint ring (竹节雀头结)
  const jw = Math.max(w1 * 1.32, w1 + 4.5);
  ctx.beginPath();
  ctx.moveTo(x1 - nx * jw * 0.5, y1 - ny * jw * 0.5);
  ctx.quadraticCurveTo(x1 + (dx / len) * 2.5, y1 + (dy / len) * 2.5, x1 + nx * jw * 0.5, y1 + ny * jw * 0.5);
  ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, Math.min(1, alpha * 1.15));
  ctx.lineWidth = Math.max(2.2, w1 * 0.18);
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders a calligraphic bamboo grove + elastic hero bamboo stalk (`墨竹丛与弹性青竹竿`).
 */
export function drawInkBamboo(ctx, x = 220, y = 1080, opts = {}) {
  const {
    scale = 1.0,
    flip = 1,
    bend = 0.0,
    vib = 0.0,
    color = INK_PALETTE.inkJiao,
    bgColor = INK_PALETTE.inkDan,
    withGrove = true,
  } = opts;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * flip, scale);

  if (withGrove) {
    // Pale background bamboo culms (淡墨虚竹)
    const bgCulms = [
      [[-85, 0], [-90, -210], [-96, -420], [-102, -630], [-108, -810]],
      [[-155, 0], [-150, -230], [-144, -460], [-138, -680]],
    ];
    for (const [cIdx, pts] of bgCulms.entries()) {
      const w = cIdx === 0 ? 10.5 : 7.5;
      const a = cIdx === 0 ? 0.42 : 0.28;
      for (let i = 0; i < pts.length - 1; i++) {
        drawBambooCulmSegment(ctx, pts[i], pts[i + 1], w - i * 0.7, w - (i + 1) * 0.7, bgColor, a);
        for (const ang of [-0.85, -0.42, 0.35, 0.78]) {
          drawBambooLeaf(ctx, pts[i + 1][0], pts[i + 1][1], 52, ang, 6.2, bgColor, a * 0.95, 0.12);
        }
      }
    }
  }

  // Hero flexing stalk (借力弯竹 / 迎风劲竹)
  const dy1 = bend * 18;
  const dy2 = bend * 48;
  const dy3 = bend * 88 - vib * 15;
  const dx4 = bend * 28 + vib * 22;
  const dy4 = bend * 130 - vib * 25;

  const joints = [
    [[0, 0], [75, -165], 21, 18.5],
    [[75, -165], [155, -295 + dy1], 18.5, 16],
    [[155, -295 + dy1], [235, -365 + dy2], 16, 13.5],
    [[235, -365 + dy2], [305, -395 + dy3], 13.5, 11],
    [[305, -395 + dy3], [405 + dx4 * 0.7, -412 + dy4 * 0.8], 11, 8.8],
    [[405 + dx4 * 0.7, -412 + dy4 * 0.8], [505 + dx4, -408 + dy4], 8.8, 6.5],
  ];

  for (const [p0, p1, w0, w1] of joints) {
    drawBambooCulmSegment(ctx, p0, p1, w0, w1, color, 0.94);
  }

  const leafClusters = [
    [75, -165, [-1.25, -0.82, -0.42], [66, 84, 70], 9.2],
    [155, -295 + dy1, [-1.38, -0.95, -0.5, -0.18], [74, 92, 86, 68], 10.2],
    [235, -365 + dy2, [-1.48, -1.08, -0.68], [68, 88, 78], 9.2],
    [405 + dx4 * 0.7, -412 + dy4 * 0.8, [0.15 + bend * 0.25, 0.48 + bend * 0.25, 0.88 + bend * 0.25], [64, 80, 68], 8.4],
    [505 + dx4, -408 + dy4, [0.05 + bend * 0.35, 0.4 + bend * 0.35, 0.82 + bend * 0.35, 1.2 + bend * 0.35], [56, 74, 66, 50], 7.8],
  ];
  for (const [lx, ly, angs, lens, wm] of leafClusters) {
    for (let i = 0; i < angs.length; i++) {
      drawBambooLeaf(ctx, lx, ly, lens[i], angs[i], wm, color, 0.94, 0.16 + bend * 0.14);
    }
  }
  ctx.restore();

  return {
    tipX: x + (505 + dx4) * scale * flip,
    tipY: y + (-408 + dy4) * scale,
  };
}

/**
 * Renders a gnarled Song-Dynasty Cliffside or Scholar Pine Tree (`迎客古松 / 苍松`).
 */
export function drawInkPine(ctx, x, y, opts = {}) {
  const {
    scale = 1.0,
    flip = 1,
    sway = 0.0,
    needleColor = INK_PALETTE.shiLv,
    trunkColor = INK_PALETTE.inkNong,
  } = opts;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * flip, scale);
  ctx.rotate(sway);

  // Gnarled trunk with dragon-scale bend
  drawCalligraphicStroke(
    ctx,
    [
      [0, 0],
      [-18, -68],
      [12, -135],
      [78, -172],
      [165, -158],
      [235, -168],
    ],
    { width: 22, color: trunkColor, alpha: 0.92, entry: 'round', exit: 'taper', feibai: 0.38, seed: 55 }
  );
  // Secondary upper branch
  drawCalligraphicStroke(
    ctx,
    [
      [12, -135],
      [-45, -188],
      [-105, -205],
    ],
    { width: 13, color: trunkColor, alpha: 0.88, entry: 'round', exit: 'taper', feibai: 0.35, seed: 56 }
  );

  // Pine needle fan clusters (马远松针车轮簇)
  const clusters = [
    [78, -182, 42],
    [132, -176, 46],
    [186, -166, 44],
    [238, -174, 38],
    [-48, -196, 40],
    [-105, -212, 44],
    [-75, -225, 38],
  ];

  for (const [cx, cy, rad] of clusters) {
    // Soft malachite & indigo under-wash behind pine needles
    ctx.beginPath();
    ctx.arc(cx, cy - rad * 0.25, rad * 0.95, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fillStyle = rgba(needleColor, 0.34);
    ctx.fill();

    for (const [dx, dy, r] of [[0, 0, rad], [-rad * 0.55, 8, rad * 0.82], [rad * 0.55, 6, rad * 0.82]]) {
      const px = cx + dx;
      const py = cy + dy;
      const count = 13;
      for (let i = 0; i < count; i++) {
        const ang = Math.PI * 0.95 + (i / (count - 1)) * Math.PI * 1.1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(ang) * r, py + Math.sin(ang) * r);
        ctx.strokeStyle = i % 3 === 0 ? rgba(needleColor, 0.88) : rgba(INK_PALETTE.inkJiao, 0.86);
        ctx.lineWidth = 1.7;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/**
 * Renders an iron-wire Plum or Peach Blossom Branch (`铁骨红梅 / 折枝桃花`) with `bloom: 0..1`.
 */
export function drawInkPlumBranch(ctx, x, y, opts = {}) {
  const {
    scale = 1.0,
    flip = 1,
    bloom = 1.0,
    petalColor = opts.blossomColor || INK_PALETTE.zhuSha,
    withTrunk = opts.withTrunk ?? (y < 640),
    sway = 0.0,
    seed = 71,
  } = opts;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * flip, scale);
  if (sway) ctx.rotate(sway);

  // Optional gnarled old plum trunk base (`苍劲老梅干`) so branches never float in mid-air
  if (withTrunk) {
    drawCalligraphicStroke(
      ctx,
      [
        [-28, 165],
        [-12, 95],
        [-22, 38],
        [0, 0],
      ],
      { width: 22, color: INK_PALETTE.inkJiao, alpha: 0.92, entry: 'round', exit: 'blunt', feibai: 0.45, seed: seed + 10 }
    );
  }

  // Angular iron-wire main branch & twigs (折枝铁骨老干)
  drawCalligraphicStroke(
    ctx,
    [
      [0, 0],
      [85, -42],
      [155, -28],
      [245, -92],
      [325, -82],
    ],
    { width: 15, color: INK_PALETTE.inkJiao, alpha: 0.92, feibai: 0.42, seed }
  );
  drawCalligraphicStroke(
    ctx,
    [
      [155, -28],
      [195, 24],
      [265, 12],
    ],
    { width: 8.5, color: INK_PALETTE.inkNong, alpha: 0.88, feibai: 0.35, seed: seed + 1 }
  );
  drawCalligraphicStroke(
    ctx,
    [
      [85, -42],
      [120, -108],
      [182, -135],
    ],
    { width: 9.0, color: INK_PALETTE.inkNong, alpha: 0.88, feibai: 0.35, seed: seed + 2 }
  );

  // 5-Petal Blossoms, Stamen Filaments & Buds (`点梅与攒蕊`)
  const flowers = [
    [95, -52, 1.05, 0.0],
    [138, -112, 0.95, 0.12],
    [182, -136, 1.12, 0.22],
    [172, -38, 1.18, 0.08],
    [225, -78, 1.08, 0.18],
    [282, -88, 0.96, 0.28],
    [322, -82, 0.78, 0.35],
    [218, 18, 0.95, 0.25],
    [262, 12, 0.72, 0.4],
  ];

  for (const [fx, fy, sc, delay] of flowers) {
    const b = clamp((bloom - delay) / Math.max(0.1, 1 - delay), 0, 1);
    if (b <= 0.02) continue;
    ctx.save();
    ctx.translate(fx, fy);
    const r = 13.5 * sc * (0.35 + 0.65 * b);
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 - Math.PI * 0.5;
      const px = Math.cos(a) * r * 0.72;
      const py = Math.sin(a) * r * 0.72;
      ctx.beginPath();
      ctx.arc(px, py, r * 0.54, 0, Math.PI * 2);
      ctx.fillStyle = rgba(p % 2 === 0 ? petalColor : mixHex(petalColor, INK_PALETTE.geFen, 0.35), 0.94);
      ctx.fill();
      ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.32);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    // Delicate stamen filaments (`花蕊丝`) & golden pollen dots (`金蕊`)
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.75);
    ctx.lineWidth = 0.9;
    for (let s = 0; s < 6; s++) {
      const sa = (s / 6) * Math.PI * 2 + 0.2;
      const sx = Math.cos(sa) * r * 0.42;
      const sy = Math.sin(sa) * r * 0.42;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(sx, sy);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy, 1.3, 0, Math.PI * 2);
      ctx.fillStyle = rgba(INK_PALETTE.niJinBright, 0.98);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = rgba(INK_PALETTE.inkJiao, 0.9);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Renders a Weeping Willow (`垂柳依依`) with wind-swaying silk tendrils.
 */
export function drawInkWillow(ctx, x, y, opts = {}) {
  const {
    scale = 1.0,
    flip = 1,
    t = 0,
    wind = 0.2,
  } = opts;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * flip, scale);

  drawCalligraphicStroke(
    ctx,
    [
      [0, 0],
      [18, -95],
      [48, -185],
      [105, -245],
    ],
    { width: 24, color: INK_PALETTE.inkNong, alpha: 0.9, feibai: 0.4, seed: 31 }
  );

  // Drooping willow silk fronds
  for (let i = 0; i < 11; i++) {
    const bx = 35 + i * 18;
    const by = -175 - Math.sin((i / 10) * Math.PI) * 75;
    const len = 140 + (i % 3) * 38;
    const sway = Math.sin(t * 1.8 + i * 0.7) * 18 + wind * 32;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + sway * 0.45, by + len * 0.5, bx + sway, by + len);
    ctx.strokeStyle = rgba(INK_PALETTE.shiLv, 0.65);
    ctx.lineWidth = 1.8;
    ctx.stroke();

    for (let k = 1; k <= 5; k++) {
      const u = k / 5.5;
      const lx = bx + sway * u * u;
      const ly = by + len * u;
      drawBambooLeaf(ctx, lx, ly, 16, 1.35 + (k % 2 ? 0.25 : -0.25), 3.2, INK_PALETTE.shiLv, 0.78, 0.1);
    }
  }
  ctx.restore();
}

/**
 * Renders Splashed-Ink Mud-Gold Lotus Pad (`泼墨泥金荷叶`), Blooming Ink Lotus (`白描设色盛开墨荷`),
 * or Lotus Bud (`粉白荷苞`).
 * `opts.kind`: `'pad' | 'flower' | 'bud' | 'throne'`.
 */
export function drawInkLotus(ctx, cx, cy, opts = {}) {
  const {
    kind = 'pad',
    scale = 1.0,
    scaleX = 1.25,
    scaleY = 0.56,
    baseRad = 135,
    open = 1.0,
    rise = 1.0,
    alpha = 1.0,
    goldVeins = true,
    withRipples = false,
    seed = 1,
  } = opts;
  if (alpha <= 0.01 || rise <= 0.01) return;

  if (withRipples) {
    drawInkRipples(ctx, cx, cy + 10 * scale, baseRad * 1.25 * scale * rise, 0.72 * alpha);
  }

  if (kind === 'pad') {
    const pts = [];
    const n = 44;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const notch = ang > 0.26 * Math.PI && ang < 0.54 * Math.PI ? 0.48 : 1.0;
      const r =
        (baseRad +
          24 * (baseRad / 135) * Math.sin(3 * ang + 0.4 + seed) +
          14 * (baseRad / 135) * Math.cos(5 * ang - 0.6)) *
        notch *
        scale;
      pts.push([cx + Math.cos(ang) * r * scaleX, cy + Math.sin(ang) * r * scaleY]);
    }
    drawWetInkWash(ctx, pts, {
      coreColor: INK_PALETTE.inkJiao,
      midColor: INK_PALETTE.huaQing,
      edgeColor: INK_PALETTE.inkDan,
      alpha,
      wetRim: true,
      brokenOutline: true,
      outlineWidth: 2.4 * scale,
    });

    // Radiating sumi & mud-gold leaf veins (泥金叶脉)
    ctx.save();
    for (let i = 0; i < 12; i++) {
      const ang = 0.15 + (i / 12) * (Math.PI * 2 - 0.35);
      if (ang > 0.28 * Math.PI && ang < 0.52 * Math.PI) continue;
      const vx = cx + Math.cos(ang) * baseRad * 0.86 * scale * scaleX;
      const vy = cy + Math.sin(ang) * baseRad * 0.86 * scale * scaleY;
      const mx = (cx + vx) * 0.5 + Math.sin(ang * 2) * 8 * scale;
      const my = (cy + vy) * 0.5;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(mx, my, vx, vy);
      ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.55 * alpha);
      ctx.lineWidth = 2.0 * scale;
      ctx.stroke();

      if (goldVeins) {
        ctx.beginPath();
        ctx.moveTo(cx + 1, cy - 0.5);
        ctx.quadraticCurveTo(mx + 1, my - 0.5, vx, vy);
        ctx.strokeStyle = rgba(INK_PALETTE.niJinBright, 0.72 * alpha);
        ctx.lineWidth = 1.25 * scale;
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 4.8 * scale, 0, Math.PI * 2);
    ctx.fillStyle = rgba(INK_PALETTE.niJinBright, 0.88 * alpha);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (kind === 'bud') {
    ctx.save();
    const stemH = 140 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 16 * scale);
    ctx.quadraticCurveTo(cx - 10 * scale, cy + stemH * 0.5, cx + 6 * scale, cy + stemH);
    ctx.strokeStyle = rgba(INK_PALETTE.inkNong, 0.85 * alpha);
    ctx.lineWidth = 4.0 * scale;
    ctx.stroke();

    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    for (const [side, pw, ph] of [[-1, 20, 52], [1, 20, 52], [0, 17, 60]]) {
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.bezierCurveTo(side * pw - pw * 0.6, 4, side * pw * 0.5 - pw * 0.3, -ph * 0.65, side * 4, -ph);
      ctx.bezierCurveTo(side * pw * 0.5 + pw * 0.3, -ph * 0.65, side * pw + pw * 0.6, 4, 0, 18);
      ctx.closePath();
      const pg = ctx.createLinearGradient(0, 18, 0, -ph);
      pg.addColorStop(0.0, rgba(INK_PALETTE.geFen, 0.96 * alpha));
      pg.addColorStop(0.55, rgba(INK_PALETTE.yanZhiSoft, 0.94 * alpha));
      pg.addColorStop(1.0, rgba(INK_PALETTE.yanZhi, 0.94 * alpha));
      ctx.fillStyle = pg;
      ctx.fill();
      ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.82 * alpha);
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // 'flower' or 'throne' (multi-layered blooming ink-and-rouge lotus)
  ctx.save();
  if (kind === 'flower') {
    ctx.beginPath();
    ctx.moveTo(cx - 8 * scale, cy + 28 * scale);
    ctx.quadraticCurveTo(cx - 18 * scale, cy + 110 * scale, cx + 8 * scale, cy + 210 * scale);
    ctx.strokeStyle = rgba(INK_PALETTE.inkNong, 0.86 * alpha);
    ctx.lineWidth = 5.2 * scale;
    ctx.stroke();
  } else {
    // Grand lotus throne includes a broad mud-gold lotus pad base
    drawInkLotus(ctx, cx, cy + 16 * scale, {
      kind: 'pad',
      scale: scale * 1.25 * rise,
      alpha,
      goldVeins: true,
      seed: seed + 10,
    });
  }

  const openSpread = lerp(0.16, 1.0, clamp(open, 0, 1));
  const petalRings = [
    [-1.22, 118, 42, INK_PALETTE.yanZhi],
    [1.22, 118, 42, INK_PALETTE.yanZhi],
    [-0.88, 132, 46, INK_PALETTE.yanZhi],
    [0.88, 132, 46, INK_PALETTE.yanZhi],
    [-0.54, 142, 48, INK_PALETTE.zhuSha],
    [0.54, 142, 48, INK_PALETTE.zhuSha],
    [-0.24, 148, 50, INK_PALETTE.zhuSha],
    [0.24, 148, 50, INK_PALETTE.zhuSha],
    [0.0, 154, 52, INK_PALETTE.yinZhu],
  ];

  // Golden seedpod heart (金蕊莲蓬)
  if (open > 0.15) {
    ctx.save();
    ctx.translate(cx, cy - 4 * scale);
    ctx.scale(1.0, 0.38);
    ctx.beginPath();
    ctx.arc(0, 0, 58 * scale * open, 0, Math.PI * 2);
    ctx.fillStyle = rgba(INK_PALETTE.niJinBright, 0.94 * alpha);
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.82 * alpha);
    ctx.lineWidth = 2.2 * scale;
    ctx.stroke();
    ctx.restore();
  }

  for (const [angBase, lenBase, wBase, tipCol] of petalRings) {
    const pAng = angBase * openSpread;
    const pLen = lenBase * scale * lerp(0.82, 1.0, open) * rise;
    const pW = wBase * scale * lerp(0.75, 1.0, open) * rise;
    ctx.save();
    ctx.translate(cx, cy + 12 * scale);
    ctx.rotate(pAng);
    ctx.beginPath();
    ctx.moveTo(0, 12 * scale);
    ctx.bezierCurveTo(-pW * 0.88, -pLen * 0.32, -pW * 0.68, -pLen * 0.78, 0, -pLen);
    ctx.bezierCurveTo(pW * 0.68, -pLen * 0.78, pW * 0.88, -pLen * 0.32, 0, 12 * scale);
    ctx.closePath();

    const pg = ctx.createLinearGradient(0, 12 * scale, 0, -pLen);
    pg.addColorStop(0.0, rgba(INK_PALETTE.geFen, 0.98 * alpha));
    pg.addColorStop(0.55, rgba(INK_PALETTE.yanZhiSoft, 0.95 * alpha));
    pg.addColorStop(1.0, rgba(tipCol, 0.95 * alpha));
    ctx.fillStyle = pg;
    ctx.fill();

    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.85 * alpha);
    ctx.lineWidth = 2.0 * scale;
    ctx.stroke();

    // Mud-gold central petal vein
    ctx.beginPath();
    ctx.moveTo(0, 6 * scale);
    ctx.lineTo(0, -pLen * 0.82);
    ctx.strokeStyle = rgba(INK_PALETTE.niJinBright, 0.65 * alpha);
    ctx.lineWidth = 1.2 * scale;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Renders swaying autumn riverside reeds (`秋江芦苇`).
 */
export function drawInkReeds(ctx, x, y, opts = {}) {
  const { count = 7, scale = 1.0, t = 0, seed = 63 } = opts;
  const rng = mulberry32(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  for (let i = 0; i < count; i++) {
    const rx = (i - count * 0.5) * 18 + (rng() - 0.5) * 8;
    const h = 110 + rng() * 65;
    const sway = Math.sin(t * 1.9 + i * 0.6) * 14 + 12;
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.quadraticCurveTo(rx + sway * 0.4, -h * 0.55, rx + sway, -h);
    ctx.strokeStyle = rgba(INK_PALETTE.inkNong, 0.78);
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Soft white-ochre reed plume at tip
    ctx.beginPath();
    ctx.moveTo(rx + sway, -h);
    ctx.quadraticCurveTo(rx + sway + 16, -h - 14, rx + sway + 28, -h - 8);
    ctx.strokeStyle = rgba(INK_PALETTE.geFen, 0.85);
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================================
// TIER 3B · ARCHITECTURE, BRIDGES, BOATS, CREATURES & CULTURAL VESSEL KIT
// ============================================================================

/**
 * Renders a Song-Dynasty Stone Arch Bridge (`烟波石拱桥`) with live brush-drawing reveal (`drawnProgress: 0..1`).
 */
export function drawInkBridge(ctx, cx, crownY, opts = {}) {
  const {
    span = 760,
    archDrop = 145,
    drawnProgress = 1.0,
    scale = 1.0,
    withRipples = true,
  } = opts;

  ctx.save();
  ctx.translate(cx, crownY);
  ctx.scale(scale, scale);

  const halfSpan = span * 0.5;
  const archR = span * 0.21;
  const archCY = archDrop + 22;
  const deckY = (lx) => {
    const u = clamp(lx / halfSpan, -1, 1);
    return archDrop * u * u;
  };

  if (withRipples) {
    drawInkRipples(ctx, -span * 0.22, archDrop + 25, 135, 0.72);
    drawInkRipples(ctx, span * 0.22, archDrop + 30, 130, 0.65 * Math.max(0.3, drawnProgress));
  }

  // Faint phantom dry-brush sketch when bridge is not yet fully painted
  if (drawnProgress < 0.99) {
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const lx = (i / 20) * halfSpan;
      const ly = deckY(lx);
      if (i === 0) ctx.moveTo(lx, ly);
      else ctx.lineTo(lx, ly);
    }
    ctx.strokeStyle = rgba(INK_PALETTE.inkDan, 0.32 * (1 - drawnProgress));
    ctx.lineWidth = 2.0;
    ctx.stroke();
    ctx.restore();
  }

  const maxX = drawnProgress * halfSpan;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-halfSpan - 30, -80);
  ctx.lineTo(maxX + 6, -80);
  if (drawnProgress < 0.98) {
    ctx.lineTo(maxX, deckY(maxX) + 8);
    ctx.lineTo(maxX - 18, deckY(maxX) + 32);
    ctx.lineTo(maxX - 10, deckY(maxX) + 58);
    ctx.lineTo(maxX - 42, archDrop + 35);
  } else {
    ctx.lineTo(maxX + 30, archDrop + 35);
  }
  ctx.lineTo(-halfSpan - 30, archDrop + 35);
  ctx.closePath();
  ctx.clip();

  // Translucent wet-ink bridge spandrel dissolving into mist at bottom (`留白拱洞`)
  ctx.beginPath();
  ctx.moveTo(-halfSpan, archDrop + 18);
  for (let i = 0; i <= 50; i++) {
    const lx = -halfSpan + (span * i) / 50;
    ctx.lineTo(lx, deckY(lx));
  }
  ctx.lineTo(halfSpan, archDrop + 18);
  ctx.lineTo(archR, archDrop + 18);
  ctx.arc(0, archCY, archR, 0, Math.PI, true);
  ctx.closePath();

  const gWash = ctx.createLinearGradient(0, 0, 0, archDrop + 18);
  gWash.addColorStop(0.0, rgba(INK_PALETTE.huaQing, 0.65));
  gWash.addColorStop(0.55, rgba(INK_PALETTE.inkZhong, 0.42));
  gWash.addColorStop(1.0, rgba(INK_PALETTE.inkDan, 0.0));
  ctx.fillStyle = gWash;
  ctx.fill();

  // Calligraphic double-line deck & mud-gold thread
  const deckPts = [];
  for (let i = 0; i <= 40; i++) {
    const lx = -halfSpan + (span * i) / 40;
    deckPts.push([lx, deckY(lx)]);
  }
  drawCalligraphicStroke(ctx, deckPts, {
    width: 5.5,
    color: INK_PALETTE.inkJiao,
    alpha: 0.92,
    feibai: 0.22,
    goldThread: true,
  });

  // Arch ring & voussoir ticks
  ctx.beginPath();
  ctx.arc(0, archCY, archR, Math.PI * 1.08, Math.PI * 1.92);
  ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.88);
  ctx.lineWidth = 4.0;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, archCY, archR + 18, Math.PI * 1.1, Math.PI * 1.9);
  ctx.strokeStyle = rgba(INK_PALETTE.inkZhong, 0.62);
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Balustrade posts & lotus finials
  const posts = 9;
  for (let i = 0; i < posts; i++) {
    const px = -halfSpan * 0.84 + ((halfSpan * 1.68) * i) / (posts - 1);
    const py = deckY(px);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - 24);
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.86);
    ctx.lineWidth = 3.0;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px, py - 27, 3.6, 0, Math.PI * 2);
    ctx.fillStyle = rgba(INK_PALETTE.zhuSha, 0.88);
    ctx.fill();

    if (i < posts - 1) {
      const nx = -halfSpan * 0.84 + ((halfSpan * 1.68) * (i + 1)) / (posts - 1);
      const ny = deckY(nx);
      const mx = (px + nx) * 0.5;
      const my = deckY(mx);
      ctx.beginPath();
      ctx.moveTo(px, py - 18);
      ctx.quadraticCurveTo(mx, my - 18, nx, ny - 18);
      ctx.strokeStyle = rgba(INK_PALETTE.inkNong, 0.72);
      ctx.lineWidth = 2.0;
      ctx.stroke();
    }
  }
  ctx.restore();

  // Active painting splash droplets at the growing bridge edge
  if (drawnProgress > 0.02 && drawnProgress < 0.98) {
    drawInkSplatter(ctx, maxX, deckY(maxX), {
      count: 12,
      spreadX: 35,
      spreadY: 38,
      seed: Math.floor(drawnProgress * 100),
    });
  }
  ctx.restore();

  return {
    edgeX: cx + maxX * scale,
    edgeY: crownY + deckY(maxX) * scale,
    deckY: (worldX) => crownY + deckY((worldX - cx) / scale) * scale,
  };
}

/**
 * Renders a Classical Flying-Eave Pavilion (`飞檐古亭 / 水榭`) with upturned eaves,
 * cinnabar columns, and optional warm glowing lantern/window.
 */
export function drawInkPavilion(ctx, cx, baseY, opts = {}) {
  const {
    scale = 1.0,
    tiers = 2,
    lit = false,
    roofColor = INK_PALETTE.inkJiao,
    columnColor = INK_PALETTE.zhuSha,
  } = opts;

  ctx.save();
  ctx.translate(cx, baseY);
  ctx.scale(scale, scale);

  // Stone terrace base
  ctx.fillStyle = rgba(INK_PALETTE.inkZhong, 0.75);
  ctx.fillRect(-105, -18, 210, 18);
  drawCalligraphicStroke(ctx, [[-118, 0], [118, 0]], { width: 5.5, color: INK_PALETTE.inkJiao, goldThread: true });

  // Warm lantern / interior glow when `lit: true`
  if (lit) {
    const glow = ctx.createRadialGradient(0, -78, 8, 0, -78, 135);
    glow.addColorStop(0.0, rgba(INK_PALETTE.niJinBright, 0.72));
    glow.addColorStop(0.5, rgba(INK_PALETTE.yinZhu, 0.28));
    glow.addColorStop(1.0, rgba(INK_PALETTE.yinZhu, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -78, 135, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cinnabar columns & balustrade
  for (const px of [-74, -36, 36, 74]) {
    ctx.fillStyle = rgba(columnColor, 0.92);
    ctx.fillRect(px - 4.5, -118, 9, 100);
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.85);
    ctx.lineWidth = 1.6;
    ctx.strokeRect(px - 4.5, -118, 9, 100);
  }

  // Balustrade lattice
  ctx.strokeStyle = rgba(columnColor, 0.88);
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.moveTo(-78, -38);
  ctx.lineTo(-32, -38);
  ctx.moveTo(32, -38);
  ctx.lineTo(78, -38);
  ctx.stroke();

  // Hanging red-gold palace lanterns under eaves
  for (const lx of [-58, 58]) {
    ctx.beginPath();
    ctx.moveTo(lx, -118);
    ctx.lineTo(lx, -96);
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.85);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(lx, -86, 10, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(lit ? INK_PALETTE.niJinBright : INK_PALETTE.zhuSha, 0.95);
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.zhuSha, 0.95);
    ctx.lineWidth = 2.0;
    ctx.stroke();
  }

  // Flying-eave roof tiers (重檐飞角)
  for (let tier = 0; tier < tiers; tier++) {
    const ry = -118 - tier * 54;
    const rw = 148 - tier * 34;
    const rh = 46 - tier * 8;

    ctx.beginPath();
    ctx.moveTo(-rw, ry - 12);
    ctx.quadraticCurveTo(-rw * 0.45, ry - rh * 0.25, 0, ry - rh);
    ctx.quadraticCurveTo(rw * 0.45, ry - rh * 0.25, rw, ry - 12);
    ctx.quadraticCurveTo(rw * 0.65, ry + 4, 0, ry);
    ctx.quadraticCurveTo(-rw * 0.65, ry + 4, -rw, ry - 12);
    ctx.closePath();

    const rg = ctx.createLinearGradient(0, ry - rh, 0, ry + 4);
    rg.addColorStop(0.0, rgba(roofColor, 0.96));
    rg.addColorStop(0.7, rgba(INK_PALETTE.huaQing, 0.88));
    rg.addColorStop(1.0, rgba(roofColor, 0.94));
    ctx.fillStyle = rg;
    ctx.fill();

    // Sweeping upturned eave stroke
    drawCalligraphicStroke(
      ctx,
      [
        [-rw - 16, ry - 24],
        [-rw * 0.65, ry - 2],
        [0, ry - 4],
        [rw * 0.65, ry - 2],
        [rw + 16, ry - 24],
      ],
      { width: 6.5 - tier * 1.2, color: roofColor, alpha: 0.95, goldThread: true }
    );
  }

  // Golden宝顶 finial at apex
  const topY = -118 - (tiers - 1) * 54 - (46 - (tiers - 1) * 8);
  ctx.beginPath();
  ctx.arc(0, topY - 7, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = rgba(INK_PALETTE.niJinBright, 0.96);
  ctx.fill();
  ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.9);
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders a Calligraphic Wooden Skiff / Awning Boat (`一叶扁舟 / 乌篷船`).
 */
export function drawInkBoat(ctx, cx, cy, opts = {}) {
  const {
    scale = 1.0,
    flip = 1,
    tilt = 0.0,
    withCanopy = true,
    withLantern = false,
    withRipples = true,
  } = opts;

  if (withRipples) {
    drawInkRipples(ctx, cx, cy + 12 * scale, 165 * scale, 0.78);
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale * flip, scale);
  ctx.rotate(tilt);

  // Woven bamboo canopy (乌篷竹席棚)
  if (withCanopy) {
    ctx.beginPath();
    ctx.moveTo(-68, -6);
    ctx.bezierCurveTo(-58, -58, 32, -58, 48, -6);
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, -56, 0, -6);
    cg.addColorStop(0.0, rgba(INK_PALETTE.zheShi, 0.9));
    cg.addColorStop(0.6, rgba(INK_PALETTE.inkZhong, 0.85));
    cg.addColorStop(1.0, rgba(INK_PALETTE.inkNong, 0.92));
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.92);
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Bamboo ribs on canopy
    for (const rx of [-36, -10, 16]) {
      ctx.beginPath();
      ctx.moveTo(rx, -6);
      ctx.quadraticCurveTo(rx, -42, rx + 4, -44);
      ctx.strokeStyle = rgba(INK_PALETTE.niJin, 0.55);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }

  // Sweeping crescent hull (新月舟身)
  const hullPts = [
    [-148, -22],
    [-95, 16],
    [0, 22],
    [102, 14],
    [156, -28],
    [98, -6],
    [0, -4],
    [-92, -6],
  ];
  drawWetInkWash(ctx, hullPts, {
    coreColor: INK_PALETTE.inkJiao,
    midColor: INK_PALETTE.zheShi,
    edgeColor: INK_PALETTE.inkZhong,
    alpha: 0.95,
    wetRim: false,
    brokenOutline: true,
    outlineWidth: 2.8,
    goldRim: true,
  });

  // Bold calligraphic gunwale stroke
  drawCalligraphicStroke(
    ctx,
    [
      [-152, -24],
      [-75, -2],
      [25, -2],
      [158, -30],
    ],
    { width: 6.5, color: INK_PALETTE.inkJiao, alpha: 0.96, feibai: 0.35 }
  );

  // Bow lantern
  if (withLantern) {
    ctx.beginPath();
    ctx.moveTo(125, -18);
    ctx.lineTo(148, -52);
    ctx.lineTo(148, -38);
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.9);
    ctx.lineWidth = 2.2;
    ctx.stroke();

    const lg = ctx.createRadialGradient(148, -30, 2, 148, -30, 36);
    lg.addColorStop(0.0, rgba(INK_PALETTE.niJinBright, 0.9));
    lg.addColorStop(0.5, rgba(INK_PALETTE.zhuSha, 0.45));
    lg.addColorStop(1.0, rgba(INK_PALETTE.zhuSha, 0));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(148, -30, 36, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(148, -30, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = rgba(INK_PALETTE.niJinBright, 0.98);
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.zhuSha, 0.95);
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Renders an Animated Chinese Ink Bird (`仙鹤 / 白鹭 / 飞燕`):
 * `species`: `'crane' | 'egret' | 'swallow'`, `pose`: `'fly' | 'stand'`.
 */
export function drawInkBird(ctx, cx, cy, opts = {}) {
  const {
    species = 'crane',
    pose = 'fly',
    scale = 1.0,
    flip = 1,
    angle = 0.0,
    flapPhase = 0.0,
  } = opts;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale * flip, scale);
  ctx.rotate(angle);

  if (pose === 'stand') {
    // Ground contact shadow right at (0, 0) so standing crane looks planted on the rock/shore
    ctx.save();
    ctx.scale(1.0, 0.22);
    const sh = ctx.createRadialGradient(2, 0, 2, 2, 0, 34);
    sh.addColorStop(0.0, rgba(INK_PALETTE.inkJiao, 0.36));
    sh.addColorStop(1.0, rgba(INK_PALETTE.inkJiao, 0.0));
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.arc(2, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 1. Articulated avian legs (`鹤胫与三趾鹤爪`) planted at y = 0
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.92);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Back leg (slightly raised or planted)
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(-8, -52);
    ctx.lineTo(-12, -26);
    ctx.lineTo(-6, 0);
    ctx.moveTo(-14, 0);
    ctx.lineTo(-6, 0);
    ctx.lineTo(4, 1.5);
    ctx.moveTo(-6, 0);
    ctx.lineTo(2, -2);
    ctx.stroke();

    // Front standing leg with ankle joint & 3-toed claw
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(4, -52);
    ctx.lineTo(2, -25);
    ctx.lineTo(6, 0);
    ctx.moveTo(-3, 0.5);
    ctx.lineTo(6, 0);
    ctx.lineTo(17, 1.5);
    ctx.moveTo(6, 0);
    ctx.lineTo(15, -2.2);
    ctx.stroke();

    // Feathered thigh puffs (`鹤股绒羽`)
    for (const tx of [-7, 4]) {
      ctx.beginPath();
      ctx.ellipse(tx, -50, 6.5, 9.5, 0.15, 0, Math.PI * 2);
      ctx.fillStyle = rgba(INK_PALETTE.geFen, 0.96);
      ctx.fill();
    }

    // 2. Cascading ink-black tail coverts (`玄裳尾羽`, signature of Song red-crowned crane)
    if (species === 'crane') {
      for (let i = 0; i < 6; i++) {
        const ty = -54 + i * 3.2;
        const tx = -26 - i * 4.5;
        ctx.beginPath();
        ctx.moveTo(-12, -56);
        ctx.quadraticCurveTo(tx + 8, ty - 6, tx, ty + 10);
        ctx.quadraticCurveTo(tx + 12, ty + 6, -8, -48);
        ctx.closePath();
        ctx.fillStyle = rgba(i % 2 === 0 ? INK_PALETTE.inkJiao : INK_PALETTE.inkNong, 0.94);
        ctx.fill();
      }
    } else {
      // Egret sleek white tail feathers
      ctx.beginPath();
      ctx.moveTo(-14, -56);
      ctx.lineTo(-42, -42);
      ctx.lineTo(-10, -46);
      ctx.closePath();
      ctx.fillStyle = rgba(INK_PALETTE.geFen, 0.95);
      ctx.fill();
      ctx.strokeStyle = rgba(INK_PALETTE.inkZhong, 0.75);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    // 3. Slender S-curved Neck (`修颈`) with black throat/cheek band for crane
    // Outer white neck contour
    ctx.beginPath();
    ctx.moveTo(12, -58);
    ctx.bezierCurveTo(28, -76, 14, -108, 24, -128);
    ctx.lineTo(31, -126);
    ctx.bezierCurveTo(23, -106, 40, -74, 24, -50);
    ctx.closePath();
    ctx.fillStyle = rgba(INK_PALETTE.geFen, 0.98);
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.85);
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Red-crowned crane signature black inner neck plumage (`丹顶鹤玄色颈羽`)
    if (species === 'crane') {
      ctx.beginPath();
      ctx.moveTo(18, -64);
      ctx.bezierCurveTo(29, -80, 18, -106, 26, -122);
      ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.92);
      ctx.lineWidth = 4.2;
      ctx.stroke();
    }

    // 4. Sculpted Plumage Body & Layered Wing Coverts (`丰满白羽身躯与层叠覆羽`)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-26, -54);
    ctx.bezierCurveTo(-18, -76, 18, -78, 28, -56);
    ctx.bezierCurveTo(22, -40, -14, -38, -26, -54);
    ctx.closePath();
    const bg = ctx.createLinearGradient(0, -76, 0, -40);
    bg.addColorStop(0.0, rgba(INK_PALETTE.geFen, 0.99));
    bg.addColorStop(0.75, rgba('#EDE5D5', 0.96));
    bg.addColorStop(1.0, rgba(INK_PALETTE.inkDan, 0.35));
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.88);
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Delicate layered wing covert arcs (`宋画工笔覆羽线`)
    ctx.strokeStyle = rgba(INK_PALETTE.inkZhong, 0.62);
    ctx.lineWidth = 1.3;
    for (let row = 0; row < 3; row++) {
      const rx = 8 - row * 9;
      const ry = -62 + row * 3;
      ctx.beginPath();
      ctx.arc(rx, ry, 11 + row * 2, 0.25 * Math.PI, 0.88 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();

    // 5. Refined Head, Cinnabar Crown (`朱砂丹顶`), Eye & Tapered Beak (`长喙`)
    const hx = 28;
    const hy = -128;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 8.5, 6.2, -0.15, 0, Math.PI * 2);
    ctx.fillStyle = rgba(INK_PALETTE.geFen, 0.99);
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.88);
    ctx.lineWidth = 1.6;
    ctx.stroke();

    if (species === 'crane') {
      ctx.beginPath();
      ctx.ellipse(hx - 1, hy - 5.2, 5.2, 3.2, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = rgba(INK_PALETTE.zhuSha, 0.96);
      ctx.fill();
    } else if (species === 'egret') {
      // Egret delicate breeding crest plumes (`白鹭丝状冠羽`)
      ctx.beginPath();
      ctx.moveTo(hx - 4, hy - 4);
      ctx.quadraticCurveTo(hx - 18, hy - 12, hx - 26, hy - 4);
      ctx.strokeStyle = rgba(INK_PALETTE.geFen, 0.95);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Tapered two-mandible beak
    ctx.beginPath();
    ctx.moveTo(hx + 6, hy - 2.2);
    ctx.lineTo(hx + 29, hy + 1.2);
    ctx.lineTo(hx + 6, hy + 2.4);
    ctx.closePath();
    ctx.fillStyle = rgba(species === 'egret' ? INK_PALETTE.niJinBright : '#B89B5E', 0.96);
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.85);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Golden-amber eye with dark pupil
    ctx.beginPath();
    ctx.arc(hx + 2.2, hy - 0.8, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = rgba(INK_PALETTE.inkJiao, 0.98);
    ctx.fill();

    ctx.restore();
    return;
  }

  // =========================================================================
  // Flying Crane / Egret / Swallow (`瑞鹤凌云 · 振翅多层飞羽`)
  // =========================================================================
  const flap = Math.sin(flapPhase);
  const wingLift = flap * 32;
  const wristBend = Math.cos(flapPhase) * 10;

  // 1. Far Wing (`远端翼`) with fanned primary feathers
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-4, -3);
  ctx.quadraticCurveTo(-14, -28 + wingLift * 0.55, -32, -38 + wingLift * 0.78);
  ctx.quadraticCurveTo(-48, -42 + wingLift * 0.85 + wristBend, -58, -32 + wingLift * 0.75);
  ctx.quadraticCurveTo(-32, -12 + wingLift * 0.35, -4, -3);
  ctx.closePath();
  ctx.fillStyle = rgba(species === 'swallow' ? INK_PALETTE.inkNong : '#E6DEC8', 0.9);
  ctx.fill();
  ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.82);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // 2. Trailing Legs (`修长拖曳双胫`)
  ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.86);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-22, 3);
  ctx.lineTo(-64, 9);
  ctx.moveTo(-22, 5.5);
  ctx.lineTo(-60, 12.5);
  ctx.stroke();

  // 3. Streamlined Body & Black Tail Coverts (`流线鹤身与玄裳尾羽`)
  if (species === 'crane') {
    ctx.beginPath();
    ctx.ellipse(-26, 1.5, 11, 5.5, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = rgba(INK_PALETTE.inkJiao, 0.94);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 9.8, -0.04, 0, Math.PI * 2);
  ctx.fillStyle = rgba(species === 'swallow' ? INK_PALETTE.inkJiao : INK_PALETTE.geFen, 0.98);
  ctx.fill();
  ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.88);
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // 4. Outstretched Graceful S-Neck, Cinnabar Crown & Beak
  ctx.beginPath();
  ctx.moveTo(18, -3);
  ctx.bezierCurveTo(34, -10, 44, -12, 58, -9);
  ctx.lineTo(57, -4);
  ctx.bezierCurveTo(44, -6, 34, -4, 18, 3);
  ctx.closePath();
  ctx.fillStyle = rgba(species === 'swallow' ? INK_PALETTE.inkJiao : INK_PALETTE.geFen, 0.98);
  ctx.fill();
  ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.88);
  ctx.lineWidth = 1.6;
  ctx.stroke();

  if (species === 'crane') {
    // Black throat stripe & cinnabar crown
    ctx.beginPath();
    ctx.moveTo(22, -1);
    ctx.quadraticCurveTo(38, -7, 52, -7);
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.9);
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(57, -10.5, 4.2, 2.6, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = rgba(INK_PALETTE.zhuSha, 0.98);
    ctx.fill();
  }

  // Tapered beak
  ctx.beginPath();
  ctx.moveTo(61, -8.5);
  ctx.lineTo(79, -5.5);
  ctx.lineTo(61, -4.5);
  ctx.closePath();
  ctx.fillStyle = rgba('#B89B5E', 0.96);
  ctx.fill();
  ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.85);
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // 5. Foreground Articulated Wing with Fanned Black Primary Feathers (`近端展翅与六枚墨黑主飞羽`)
  const tipX = -38;
  const tipY = -50 - wingLift + wristBend * 0.5;

  // Fanned black primary flight feathers (`墨羽飞翎`)
  if (species === 'crane') {
    for (let f = 0; f < 6; f++) {
      const fu = f / 5;
      const fx = lerp(tipX - 18, tipX + 18, fu);
      const fy = lerp(tipY + 10, tipY - 8, Math.sin(fu * Math.PI));
      ctx.beginPath();
      ctx.moveTo(-12 + f * 2.5, -22 - wingLift * 0.45);
      ctx.quadraticCurveTo((fx - 10) * 0.5, (fy - 22 - wingLift * 0.45) * 0.5, fx, fy);
      ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.94);
      ctx.lineWidth = 3.8 - fu * 1.0;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  // White upper wing covert fan (`雪白主覆羽`)
  ctx.beginPath();
  ctx.moveTo(8, -1);
  ctx.bezierCurveTo(14, -26 - wingLift * 0.5, -6, -46 - wingLift * 0.85, tipX + 6, tipY + 6);
  ctx.bezierCurveTo(-18, -16 - wingLift * 0.35, -6, 2, 8, -1);
  ctx.closePath();
  ctx.fillStyle = rgba(species === 'swallow' ? INK_PALETTE.inkJiao : INK_PALETTE.geFen, 0.98);
  ctx.fill();
  ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.9);
  ctx.lineWidth = 1.9;
  ctx.stroke();

  // Subtle feather covert lines on foreground wing
  if (species !== 'swallow') {
    ctx.strokeStyle = rgba(INK_PALETTE.inkZhong, 0.55);
    ctx.lineWidth = 1.1;
    for (let k = 1; k <= 3; k++) {
      const ku = k / 4;
      ctx.beginPath();
      ctx.moveTo(lerp(4, -14, ku), lerp(-6, -24 - wingLift * 0.45, ku));
      ctx.lineTo(lerp(-8, tipX + 8, ku), lerp(-14 - wingLift * 0.25, tipY + 10, ku));
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Renders an Expressive One-Stroke Cinnabar or Sumi Fish (`朱砂/水墨写意游鱼`).
 */
export function drawInkFish(ctx, cx, cy, opts = {}) {
  const {
    length = 148,
    angle = -0.35,
    color = INK_PALETTE.zhuSha,
    bellyColor = INK_PALETTE.niJin,
    swimPhase = 0.0,
    alpha = 0.96,
  } = opts;
  if (alpha <= 0.01) return;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const L = length;
  const W = L * 0.23;
  const tailWag = Math.sin(swimPhase) * L * 0.08;

  // Flowing swallow-tail fins (燕尾双剪大尾鳍)
  const tx = -L * 0.42;
  ctx.save();
  ctx.translate(tx, tailWag * 0.4);
  for (const [sign, lx, ly] of [[-1, -L * 0.52, -L * 0.32], [1, -L * 0.45, L * 0.28]]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-L * 0.24, sign * L * 0.22, lx * 0.82, ly * 0.72, lx, ly + tailWag);
    ctx.bezierCurveTo(lx * 0.62, sign * L * 0.06, -L * 0.16, sign * L * 0.02, 0, 0);
    ctx.closePath();
    const tg = ctx.createLinearGradient(0, 0, lx, ly);
    tg.addColorStop(0.0, rgba(color, 0.92 * alpha));
    tg.addColorStop(0.7, rgba(INK_PALETTE.yinZhu, 0.72 * alpha));
    tg.addColorStop(1.0, rgba(bellyColor, 0.2 * alpha));
    ctx.fillStyle = tg;
    ctx.fill();
  }
  ctx.restore();

  // Pectoral fins
  for (const sign of [-1, 1]) {
    ctx.save();
    ctx.translate(L * 0.15, sign * W * 0.4);
    ctx.rotate(sign * 0.58);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-L * 0.18, sign * L * 0.2, -L * 0.32, sign * L * 0.14, -L * 0.26, 0);
    ctx.closePath();
    ctx.fillStyle = rgba(color, 0.84 * alpha);
    ctx.fill();
    ctx.restore();
  }

  // One-stroke S-curved fish body
  ctx.beginPath();
  ctx.moveTo(L * 0.48, 0);
  ctx.bezierCurveTo(L * 0.26, -W * 1.15, -L * 0.14, -W * 0.9, -L * 0.44, -W * 0.1 + tailWag * 0.3);
  ctx.bezierCurveTo(-L * 0.2, W * 0.65, L * 0.16, W * 0.85, L * 0.48, 0);
  ctx.closePath();

  const fg = ctx.createLinearGradient(L * 0.2, -W, -L * 0.2, W);
  fg.addColorStop(0.0, rgba(mixHex(color, INK_PALETTE.inkJiao, 0.22), 0.98 * alpha));
  fg.addColorStop(0.5, rgba(color, 0.96 * alpha));
  fg.addColorStop(1.0, rgba(bellyColor, 0.92 * alpha));
  ctx.fillStyle = fg;
  ctx.fill();

  ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.78 * alpha);
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // Mud-gold spine line & pitch-black eye
  ctx.beginPath();
  ctx.moveTo(L * 0.34, -W * 0.26);
  ctx.quadraticCurveTo(0, -W * 0.46, -L * 0.34, -W * 0.08);
  ctx.strokeStyle = rgba(INK_PALETTE.niJinBright, 0.75 * alpha);
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(L * 0.34, -W * 0.2, 5.0, 0, Math.PI * 2);
  ctx.fillStyle = rgba(INK_PALETTE.niJinBright, 0.96 * alpha);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(L * 0.34, -W * 0.2, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = rgba(INK_PALETTE.inkJiao, 0.98 * alpha);
  ctx.fill();

  ctx.restore();
}

/**
 * Parametric Chinese Cultural & Craft Vessels (`茶壶、茶盏、点茶百戏、青花梅瓶、古琴、香炉、茶炉`):
 * `kind`: `'teapot' | 'teacup' | 'teacup-top' | 'vase' | 'qin' | 'incense' | 'stove'`.
 */
export function drawInkVessel(ctx, cx, cy, opts = {}) {
  const {
    kind = 'teapot',
    glaze = 'celadon', // 'celadon' (汝窑天青) | 'qinghua' (青花白瓷) | 'zisha' (紫砂赭石) | 'jianzhan' (建盏乌金)
    scale = 1.0,
    tilt = 0.0,
    pour = 0.0,
    steam = 0.0,
    teaArt = 0.0,
    t = 0.0,
  } = opts;

  const glazeColors = {
    celadon: { body: '#B8CEC6', mid: '#84A89E', rim: '#52736C' },
    qinghua: { body: '#F8F5EC', mid: '#DCE4EC', rim: '#1B5488' },
    zisha: { body: '#9E5B38', mid: '#784024', rim: '#3D1E10' },
    jianzhan: { body: '#262A34', mid: '#171A22', rim: '#D8A438' },
  };
  const pal = glazeColors[glaze] || glazeColors.celadon;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.rotate(tilt);

  if (kind === 'teapot') {
    // Spout pouring stream (茶汤倾注抛物线)
    if (pour > 0.02) {
      ctx.save();
      const dropH = 52 * clamp(pour, 0, 1);
      ctx.beginPath();
      ctx.moveTo(64, -40);
      ctx.quadraticCurveTo(84, -34 + dropH * 0.35, 92, -32 + dropH);
      ctx.strokeStyle = rgba('#7CA878', 0.86);
      ctx.lineWidth = 5.5 * (0.85 + 0.15 * Math.sin(t * 14));
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.strokeStyle = rgba(INK_PALETTE.niJinBright, 0.65);
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
    }

    // Handle (壶把)
    ctx.beginPath();
    ctx.arc(-44, -34, 24, Math.PI * 0.45, Math.PI * 1.55);
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.9);
    ctx.lineWidth = 7.5;
    ctx.stroke();
    ctx.strokeStyle = rgba(pal.mid, 0.9);
    ctx.lineWidth = 4.2;
    ctx.stroke();

    // Curved spout (曲流壶嘴)
    ctx.beginPath();
    ctx.moveTo(38, -28);
    ctx.bezierCurveTo(54, -30, 56, -50, 68, -44);
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.9);
    ctx.lineWidth = 9.0;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = rgba(pal.body, 0.95);
    ctx.lineWidth = 5.5;
    ctx.stroke();

    // Plump teapot belly
    ctx.beginPath();
    ctx.ellipse(0, -32, 48, 34, 0, 0, Math.PI * 2);
    const bg = ctx.createRadialGradient(-14, -44, 6, 0, -32, 52);
    bg.addColorStop(0.0, rgba(INK_PALETTE.geFen, 0.96));
    bg.addColorStop(0.35, rgba(pal.body, 0.96));
    bg.addColorStop(0.85, rgba(pal.mid, 0.96));
    bg.addColorStop(1.0, rgba(pal.rim, 0.96));
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.88);
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // Blue-and-white floral motif on belly when `qinghua`
    if (glaze === 'qinghua') {
      drawCalligraphicStroke(ctx, [[-26, -30], [-6, -38], [18, -28], [32, -34]], {
        width: 3.5,
        color: INK_PALETTE.shiQing,
        alpha: 0.85,
      });
    }

    // Lid & finial knob
    ctx.beginPath();
    ctx.ellipse(0, -64, 24, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(pal.body, 0.98);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -73, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = rgba(INK_PALETTE.zhuSha, 0.95);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'teacup') {
    // Classic Song teacup / Jianzhan bowl
    ctx.beginPath();
    ctx.moveTo(-34, -38);
    ctx.quadraticCurveTo(-28, -4, -14, 0);
    ctx.lineTo(14, 0);
    ctx.quadraticCurveTo(28, -4, 34, -38);
    ctx.closePath();
    const cg = ctx.createLinearGradient(-34, -38, 34, 0);
    cg.addColorStop(0.0, rgba(pal.body, 0.96));
    cg.addColorStop(0.6, rgba(pal.mid, 0.96));
    cg.addColorStop(1.0, rgba(pal.rim, 0.96));
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.9);
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Tea liquid rim ellipse
    ctx.beginPath();
    ctx.ellipse(0, -38, 34, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba('#88B482', 0.92);
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.niJinBright, 0.82);
    ctx.lineWidth = 1.8;
    ctx.stroke();
  } else if (kind === 'teacup-top') {
    // Macro top-down Song Diancha (宋代点茶 · 茶百戏水墨丹青茶汤特写!)
    const R = 145;
    // Red lacquer saucer (朱漆茶托)
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.34, 0, Math.PI * 2);
    const sg = ctx.createRadialGradient(-20, -20, 20, 0, 0, R * 1.34);
    sg.addColorStop(0.0, rgba(INK_PALETTE.zhuSha, 0.96));
    sg.addColorStop(0.8, rgba('#7A1B12', 0.96));
    sg.addColorStop(1.0, rgba(INK_PALETTE.inkJiao, 0.98));
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.niJinBright, 0.88);
    ctx.lineWidth = 3.2;
    ctx.stroke();

    // Jianzhan rabbit-fur glaze rim (建盏兔毫金圈)
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = rgba(INK_PALETTE.inkJiao, 0.98);
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.niJinBright, 0.92);
    ctx.lineWidth = 5.5;
    ctx.stroke();

    // Creamy jade-white whipped tea foam (雪沫乳花)
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.88, 0, Math.PI * 2);
    const fg = ctx.createRadialGradient(-18, -18, 10, 0, 0, R * 0.88);
    fg.addColorStop(0.0, rgba(INK_PALETTE.geFen, 0.98));
    fg.addColorStop(0.7, rgba('#E3ECD8', 0.96));
    fg.addColorStop(1.0, rgba('#9AB892', 0.95));
    ctx.fillStyle = fg;
    ctx.fill();

    // Cha-Bai-Xi (茶百戏: painting mountains & flying crane inside the tea foam!)
    if (teaArt > 0.02) {
      const u = clamp(teaArt, 0, 1);
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.84, 0, Math.PI * 2);
      ctx.clip();

      // Miniature ink mountain waves inside the cup
      drawCalligraphicStroke(
        ctx,
        [[-95, 32], [-45, -18], [8, 14], [58, -28], [98, 24]],
        { width: 12, color: INK_PALETTE.shiLv, alpha: 0.65 * u, reveal: u, goldThread: true }
      );
      drawCalligraphicStroke(
        ctx,
        [[-82, 54], [-18, 12], [44, 42], [88, 48]],
        { width: 9, color: INK_PALETTE.huaQing, alpha: 0.72 * u, reveal: u }
      );
      if (u > 0.35) {
        drawInkBird(ctx, -10, -28, {
          species: 'crane',
          pose: 'fly',
          scale: 0.78 * smootherstep(0.35, 0.9, u),
          flapPhase: t * 4.5,
        });
      }
      ctx.restore();
    }
  } else if (kind === 'vase') {
    // Classical Meiping Porcelain Vase (青花/汝窑梅瓶)
    ctx.beginPath();
    ctx.moveTo(-22, -168);
    ctx.lineTo(22, -168);
    ctx.quadraticCurveTo(14, -152, 16, -142);
    ctx.bezierCurveTo(64, -132, 62, -68, 34, 0);
    ctx.lineTo(-34, 0);
    ctx.bezierCurveTo(-62, -68, -64, -132, -16, -142);
    ctx.quadraticCurveTo(-14, -152, -22, -168);
    ctx.closePath();

    const vg = ctx.createLinearGradient(-56, -140, 56, 0);
    vg.addColorStop(0.0, rgba(INK_PALETTE.geFen, 0.98));
    vg.addColorStop(0.45, rgba(pal.body, 0.98));
    vg.addColorStop(0.88, rgba(pal.mid, 0.96));
    vg.addColorStop(1.0, rgba(pal.rim, 0.96));
    ctx.fillStyle = vg;
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.9);
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Cobalt-blue Qinghua landscape & dragon/cloud pattern painted on the vase belly
    const artU = clamp(teaArt || 1.0, 0, 1);
    if (artU > 0.02) {
      ctx.save();
      ctx.clip();
      drawCalligraphicStroke(
        ctx,
        [[-38, -52], [-12, -98], [16, -74], [42, -112]],
        { width: 7.5, color: INK_PALETTE.shiQing, alpha: 0.85, reveal: artU, feibai: 0.3 }
      );
      drawCalligraphicStroke(
        ctx,
        [[-42, -28], [0, -44], [42, -24]],
        { width: 5.0, color: INK_PALETTE.huaQing, alpha: 0.72, reveal: artU }
      );
      // Decorative shoulder collar
      ctx.strokeStyle = rgba(INK_PALETTE.shiQing, 0.82 * artU);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-48, -128);
      ctx.lineTo(48, -128);
      ctx.moveTo(-36, -12);
      ctx.lineTo(36, -12);
      ctx.stroke();
      ctx.restore();
    }
  } else if (kind === 'qin') {
    // 7-String Classical Guqin (七弦古琴)
    ctx.beginPath();
    ctx.roundRect(-95, -14, 190, 14, 5);
    ctx.fillStyle = rgba(INK_PALETTE.inkJiao, 0.94);
    ctx.fill();
    ctx.strokeStyle = rgba(INK_PALETTE.zheShi, 0.9);
    ctx.lineWidth = 2.0;
    ctx.stroke();
    for (let s = 0; s < 3; s++) {
      ctx.beginPath();
      ctx.moveTo(-84, -11 + s * 3.5);
      ctx.lineTo(84, -11 + s * 3.5);
      ctx.strokeStyle = rgba(INK_PALETTE.niJinBright, 0.78);
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
  }

  // Rising calligraphic steam / incense smoke ribbons (`袅袅茶烟/炉香`)
  if (steam > 0.02) {
    const sAlpha = clamp(steam, 0, 1);
    for (let i = 0; i < 2; i++) {
      const sx = (i - 0.5) * 18;
      const sy = kind === 'teapot' ? -78 : -44;
      const w1 = Math.sin(t * 2.2 + i * 2) * 18;
      const w2 = -Math.cos(t * 1.8 + i * 2) * 24;
      drawCalligraphicStroke(
        ctx,
        [
          [sx, sy],
          [sx + w1, sy - 42],
          [sx + w2, sy - 88],
          [sx + w1 * 0.6, sy - 135],
        ],
        { width: 6.5, color: INK_PALETTE.geFen, alpha: 0.55 * sAlpha, feibai: 0.4 }
      );
    }
  }

  ctx.restore();
}

/**
 * Renders the Master Wolf-Hair Calligraphic Brush (`悬空紫毫巨笔 / 文房毛笔`).
 */
export function drawMasterBrush(ctx, bx, by, opts = {}) {
  const {
    angle = -0.2,
    scale = 1.0,
    painting = false,
    t = 0.0,
  } = opts;

  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(scale, scale);
  ctx.rotate(angle);

  // Ethereal mud-gold aura around brush tuft
  const aura = ctx.createRadialGradient(0, 125, 8, 0, 125, 88);
  aura.addColorStop(0.0, rgba(INK_PALETTE.niJinBright, painting ? 0.62 : 0.34));
  aura.addColorStop(0.6, rgba(INK_PALETTE.huaQing, 0.14));
  aura.addColorStop(1.0, rgba(INK_PALETTE.huaQing, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 125, 88, 0, Math.PI * 2);
  ctx.fill();

  // Spotted bamboo shaft (湘妃竹笔杆)
  ctx.beginPath();
  ctx.moveTo(-10, -210);
  ctx.lineTo(-12.5, 0);
  ctx.lineTo(12.5, 0);
  ctx.lineTo(10, -210);
  ctx.closePath();
  const sg = ctx.createLinearGradient(-12.5, 0, 12.5, 0);
  sg.addColorStop(0.0, '#5C4028');
  sg.addColorStop(0.45, '#B08C5C');
  sg.addColorStop(1.0, '#3D291A');
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.strokeStyle = rgba(INK_PALETTE.inkJiao, 0.9);
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // Gold-inlaid ox-horn ferrule (泥金牛角笔斗)
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-18, 40);
  ctx.lineTo(18, 40);
  ctx.lineTo(14, 0);
  ctx.closePath();
  ctx.fillStyle = rgba(INK_PALETTE.inkNong, 0.98);
  ctx.fill();
  ctx.strokeStyle = rgba(INK_PALETTE.niJinBright, 0.92);
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // Plump purple wolf-hair tuft (紫毫笔锋, tip at local y = 180)
  const tipBendX = painting ? -14 * Math.sin(t * 16) : 0;
  ctx.beginPath();
  ctx.moveTo(-17, 40);
  ctx.bezierCurveTo(-24, 84, -16, 136, tipBendX, 180);
  ctx.bezierCurveTo(16, 136, 24, 84, 17, 40);
  ctx.closePath();
  const tg = ctx.createLinearGradient(0, 40, 0, 180);
  tg.addColorStop(0.0, '#624258');
  tg.addColorStop(0.45, INK_PALETTE.huaQing);
  tg.addColorStop(0.85, INK_PALETTE.inkJiao);
  tg.addColorStop(1.0, '#050608');
  ctx.fillStyle = tg;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(tipBendX, 180, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = rgba(INK_PALETTE.niJinBright, 0.95);
  ctx.fill();

  if (painting) {
    drawInkSplatter(ctx, tipBendX, 178, {
      count: 10,
      spreadX: 48,
      spreadY: 42,
      seed: Math.floor(t * 30),
    });
  }
  ctx.restore();
}

/**
 * Renders an Authentic Carved Cinnabar Stone Seal (`朱砂金石方印 / 闲章`) with custom 1–4 character
 * seal inscription and optional stamping shockwave (`stampProgress: 0..1`).
 */
export function drawCinnabarSeal(ctx, cx, cy, opts = {}) {
  const {
    size = 116,
    text = '山高水长',
    stampProgress = 1.0,
    withShockwave = true,
    seed = 999,
  } = opts;
  const u = clamp(stampProgress, 0, 1);
  if (u <= 0.01) return;

  const scale = u < 0.35 ? lerp(1.55, 1.0, smootherstep(0, 0.35, u)) : 1.0;
  const half = size * 0.5;
  const rng = mulberry32(seed);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  if (withShockwave && u > 0.15) {
    const waveU = clamp((u - 0.15) / 0.85, 0, 1);
    for (const [rMult, a] of [[0.85, 0.36], [1.32, 0.24], [1.85, 0.12]]) {
      const r = size * rMult * (0.7 + 0.4 * waveU);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(INK_PALETTE.zhuSha, a);
      ctx.lineWidth = 8.0;
      ctx.stroke();
    }
  }

  // Chiseled stone seal border
  ctx.beginPath();
  const nEdge = 32;
  for (let i = 0; i < nEdge; i++) {
    const tEdge = (i / nEdge) * 4;
    const side = Math.floor(tEdge);
    const f = tEdge - side;
    const jx = (rng() - 0.5) * 3.2;
    const jy = (rng() - 0.5) * 3.2;
    let px = 0, py = 0;
    if (side === 0) { px = -half + f * size; py = -half; }
    else if (side === 1) { px = half; py = -half + f * size; }
    else if (side === 2) { px = half - f * size; py = half; }
    else { px = -half; py = half - f * size; }
    if (i === 0) ctx.moveTo(px + jx, py + jy);
    else ctx.lineTo(px + jx, py + jy);
  }
  ctx.closePath();

  const sg = ctx.createRadialGradient(-10, -10, 6, 0, 0, size * 0.72);
  sg.addColorStop(0.0, rgba(INK_PALETTE.yinZhu, 0.96));
  sg.addColorStop(0.7, rgba(INK_PALETTE.zhuSha, 0.96));
  sg.addColorStop(1.0, rgba('#8F1D14', 0.98));
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.strokeStyle = rgba('#6E120B', 0.92);
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // Inner 2x2 grid divider (界格田字框)
  ctx.beginPath();
  ctx.moveTo(0, -half + 6);
  ctx.lineTo(0, half - 6);
  ctx.moveTo(-half + 6, 0);
  ctx.lineTo(half - 6, 0);
  ctx.strokeStyle = rgba(INK_PALETTE.xuanWarm, 0.42);
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Carved characters in Xuan-paper negative space (`白文篆刻`)
  const chars = [...String(text).slice(0, 4)];
  ctx.fillStyle = rgba(INK_PALETTE.xuanWarm, 0.94);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(size * 0.34)}px "Noto Serif CJK SC", "Songti SC", serif`;
  const cells = [
    [half * 0.48, -half * 0.46],
    [half * 0.48, half * 0.50],
    [-half * 0.48, -half * 0.46],
    [-half * 0.48, half * 0.50],
  ];
  chars.forEach((ch, idx) => {
    const [gx, gy] = cells[idx] || [0, 0];
    ctx.fillText(ch, gx, gy);
  });

  ctx.restore();
}

/**
 * Renders an In-Painting Calligraphic Verse Performance (`画内诗画同源书法演出层`).
 *
 * Breaks out of small margin-only colophons to perform one poetic verse per scene directly
 * inside the painting's negative space, with two expressive calligraphic modes:
 *   - `'xingcao'` (`温润行草`): Warm running-cursive brushwork, soft wet-ink capillary bloom
 *     (`淡墨水晕`), delicate filament links (`游丝牵丝`), and breathing negative space.
 *   - `'kuangcao'` (`焦墨狂草`): High-tension wild-cursive impact for martial climaxes —
 *     charcoal ink (`TONE.jiao`) slamming onto the canvas with per-character staccato punch
 *     (`顿挫砸纸`), dry-bristle flying-white fissures (`飞白裂痕`), and cinnabar vermilion
 *     splatter accents (`朱砂飞溅印记`).
 */
export function drawCalligraphicVerse(ctx, x, y, opts = {}) {
  const {
    lines = ['十步杀一人'],
    style = 'xingcao', // 'xingcao' | 'kuangcao' | 'kaishu'
    layout = 'vertical', // 'vertical' | 'staggered' | 'horizontal'
    sealText = '',
    reveal = 1.0,
    color = INK_PALETTE.inkJiao,
    accentColor = INK_PALETTE.zhuSha,
    fontSize = style === 'kuangcao' ? 76 : 32,
    screenSpace = true,
    freePlacement = true,
    withSplatter = style === 'kuangcao',
    seed = 307,
  } = opts;

  const isKuangcao = style === 'kuangcao';
  const rawU = clamp(reveal, 0, 1);
  const u = isKuangcao
    ? clamp(Math.pow(rawU, 0.72) * 1.25, 0, 1)
    : clamp(Math.pow(rawU, 0.58) * 1.38, 0, 1);
  if (u <= 0.015) return;

  if (isKuangcao && rawU > 0.05 && rawU < 0.45 && ctx.__inkFrame) {
    registerRuntimeCue({
      t: ctx.__inkFrame.t ?? 0,
      kind: 'calligraphy_slam',
      scene: ctx.__inkFrame.scene?.id || 'stage',
      label: 'calligraphy_slam',
      intensity: 0.96,
    });
  }

  ctx.save();
  let drawX = x;
  let drawY = y;

  if (screenSpace && ctx.__inkViewport) {
    const { width, height } = ctx.__inkViewport;
    const cam = ctx.__inkCam;
    const vpScale = Math.min(width / 1920, height / 1080);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(width * 0.5, height * 0.5);
    ctx.scale(vpScale, vpScale);
    const driftFactor = isKuangcao ? 0.02 : 0.05;
    const driftX = cam ? (cam.panX || 0) * driftFactor : 0;
    const driftY = cam ? (cam.panY || 0) * driftFactor : 0;
    ctx.translate(-960 - driftX, -540 - driftY);
    if (!freePlacement) {
      drawX = x < 960 ? clamp(x, 155, 285) : clamp(x, 1625, 1765);
      drawY = clamp(y, 100, 230);
    } else {
      drawX = clamp(x, 130, 1790);
      drawY = clamp(y, 88, 920);
    }
  }

  const rng = mulberry32(seed);
  const textAlpha = clamp(isKuangcao ? Math.min(1, rawU * 3.2) : 0.94 * Math.min(1, rawU * 2.2), 0, 1);
  const [tr, tg, tb] = hexToRgb(color);
  const isLightText = (tr * 0.299 + tg * 0.587 + tb * 0.114) > 150;
  const lineSpacing = fontSize * (isKuangcao ? 1.48 : 1.62);
  const charStep = fontSize * (isKuangcao ? 1.18 : 1.24);

  const rawList = Array.isArray(lines) ? lines : [String(lines)];
  const parsedLines = rawList.map((rawLine) => {
    const clean = String(rawLine).replace(/[《》〈〉「」『』"“”'‘’]/g, ' ');
    const tokens = [];
    for (const ch of clean) {
      if (/[·•，。、；：,.;:\s]/.test(ch)) {
        if (tokens.length > 0 && tokens[tokens.length - 1].type !== 'gap') {
          tokens.push({ type: 'gap', step: charStep * 0.5 });
        }
      } else {
        tokens.push({ type: 'char', ch, step: charStep });
      }
    }
    return tokens;
  });

  const totalChars = Math.max(
    1,
    parsedLines.reduce((acc, tkList) => acc + tkList.filter((tk) => tk.type === 'char').length, 0)
  );

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let globalCharIdx = 0;
  let maxColHeight = 0;
  let lastCharPos = [drawX, drawY];

  parsedLines.forEach((tokens, colIdx) => {
    const colBaseX =
      layout === 'horizontal'
        ? drawX
        : drawX - colIdx * lineSpacing;
    const colBaseY =
      layout === 'horizontal'
        ? drawY + colIdx * lineSpacing
        : drawY + (layout === 'staggered' ? colIdx * fontSize * 0.45 : 0);

    let curX = colBaseX;
    let curY = colBaseY;
    let prevCharPt = null;

    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      if (tk.type === 'gap') {
        const prevRevealed = globalCharIdx / totalChars <= u;
        if (prevRevealed) {
          ctx.save();
          ctx.fillStyle = rgba(accentColor, 0.72 * textAlpha);
          ctx.beginPath();
          const gx = layout === 'horizontal' ? curX + tk.step * 0.35 : curX;
          const gy = layout === 'horizontal' ? curY : curY + tk.step * 0.35;
          ctx.arc(gx, gy, Math.max(2.5, fontSize * 0.095), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        if (layout === 'horizontal') curX += tk.step;
        else curY += tk.step;
        continue;
      }

      const charStartU = (globalCharIdx / totalChars) * 0.78;
      const charDurU = Math.max(0.16, 0.55 / totalChars);
      const charProg = clamp((u - charStartU) / charDurU, 0, 1);
      globalCharIdx++;

      if (charProg <= 0.01) {
        if (layout === 'horizontal') curX += tk.step;
        else curY += tk.step;
        continue;
      }

      const jitterX = (rng() - 0.5) * fontSize * (isKuangcao ? 0.16 : 0.06);
      const jitterY = (rng() - 0.5) * fontSize * (isKuangcao ? 0.1 : 0.04);
      const staggerX = layout === 'staggered' ? (globalCharIdx - 1) * fontSize * 0.22 : 0;
      const cx = curX + jitterX + staggerX;
      const cy = curY + fontSize * 0.5 + jitterY;
      lastCharPos = [cx, cy];

      if (isKuangcao) {
        // Kuangcao staccato slam scale: 1.72x -> 0.96x -> 1.0x
        const slamScale =
          charProg < 0.45
            ? lerp(1.72, 0.96, smootherstep(0, 0.45, charProg))
            : lerp(0.96, 1.0, smootherstep(0.45, 1.0, charProg));
        const charAlpha = clamp(charProg * 2.5, 0, 1) * textAlpha;

        // 1. High-contrast negative-space paper/mist backing halo so dark ink cuts through dark scenes
        const bgGrad = ctx.createRadialGradient(cx, cy, fontSize * 0.08, cx, cy, fontSize * 0.95);
        const haloCol = isLightText ? INK_PALETTE.inkJiao : INK_PALETTE.xuanWarm;
        bgGrad.addColorStop(0, rgba(haloCol, (isLightText ? 0.65 : 0.52) * charAlpha));
        bgGrad.addColorStop(0.55, rgba(haloCol, (isLightText ? 0.32 : 0.22) * charAlpha));
        bgGrad.addColorStop(1, rgba(haloCol, 0));
        ctx.fillStyle = bgGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, fontSize * 0.95, 0, Math.PI * 2);
        ctx.fill();

        // 2. Flying-white dry-bristle slash fissure (`飞白破空裂痕`) behind character
        const slashAng = -0.38 + (rng() - 0.5) * 0.35;
        const slashLen = fontSize * (0.78 + rng() * 0.28);
        const sx0 = cx - Math.cos(slashAng) * slashLen;
        const sy0 = cy - Math.sin(slashAng) * slashLen;
        const sx1 = cx + Math.cos(slashAng) * slashLen;
        const sy1 = cy + Math.sin(slashAng) * slashLen;
        stroke(
          ctx,
          [
            [sx0, sy0],
            [cx + (rng() - 0.5) * 8, cy + (rng() - 0.5) * 8],
            [sx1, sy1],
          ],
          {
            w: fontSize * 0.28,
            tone: 0.42 * charAlpha,
            dry: 0.74,
            prof: 'nail',
            color: isLightText ? INK_PALETTE.inkJiao : color,
            seed: seed + globalCharIdx * 19,
          },
          charProg,
          charAlpha
        );

        // 3. Cinnabar vermilion splatter accents (`朱砂飞溅印记`)
        if (withSplatter) {
          const nSp = 3 + (globalCharIdx % 3);
          for (let sp = 0; sp < nSp; sp++) {
            const ang = rng() * Math.PI * 2;
            const dist = fontSize * (0.36 + rng() * 0.48) * clamp(charProg * 1.4, 0, 1);
            const rDot = (2.2 + rng() * 4.6) * (fontSize / 72);
            drawInkBlot(
              ctx,
              cx + Math.cos(ang) * dist,
              cy + Math.sin(ang) * dist,
              rDot,
              (0.68 + rng() * 0.28) * charAlpha,
              ang,
              0.48 + rng() * 0.35,
              seed + globalCharIdx * 37 + sp,
              sp === 0 ? INK_PALETTE.yinZhu : accentColor
            );
          }
        }

        // 4. Bold Kuangcao glyph with dry-brush double-offset stroke & aggressive tilt
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(slamScale, slamScale);
        const rot = -0.07 + (rng() - 0.5) * 0.08;
        ctx.rotate(rot);
        ctx.transform(1, -0.08, -0.11, 1, 0, 0);
        ctx.font = `900 ${Math.round(fontSize)}px "STKaiti", "Kaiti SC", "FZKai-Z03S", "AR PL UKai CN", "Noto Serif CJK SC", "WenQuanYi Zen Hei", serif`;
        ctx.shadowColor = isLightText ? rgba(INK_PALETTE.inkJiao, 0.92 * charAlpha) : rgba(INK_PALETTE.xuanWarm, 0.92 * charAlpha);
        ctx.shadowBlur = 14;

        // Outer dry-bristle offset ghost for hand-brushed calligraphic edge roughness
        ctx.strokeStyle = rgba(accentColor, 0.42 * charAlpha);
        ctx.lineWidth = Math.max(2.2, fontSize * 0.055);
        ctx.strokeText(tk.ch, 2.2, -1.5);

        ctx.strokeStyle = rgba(color, 0.88 * charAlpha);
        ctx.lineWidth = Math.max(2.8, fontSize * 0.068);
        ctx.strokeText(tk.ch, -1.2, 1.0);

        ctx.fillStyle = rgba(color, charAlpha);
        ctx.fillText(tk.ch, 0, 0);
        ctx.restore();
      } else {
        // Xingcao (`温润行草 · 呼吸留白 · 淡墨晕染逐笔浮现`)
        const bloomU = smootherstep(0, 1, charProg);
        const charAlpha = bloomU * textAlpha;
        const charScale = lerp(1.14, 1.0, bloomU);

        // 1. Soft wet-ink capillary bloom (`淡墨水晕`) behind emerging character
        const bloomR = fontSize * (0.62 + 0.22 * (1 - bloomU));
        const bgGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, bloomR);
        const washCol = isLightText ? INK_PALETTE.inkNong : INK_PALETTE.inkDan;
        bgGrad.addColorStop(0, rgba(washCol, 0.14 * charAlpha * (1.25 - 0.5 * bloomU)));
        bgGrad.addColorStop(0.6, rgba(washCol, 0.06 * charAlpha));
        bgGrad.addColorStop(1, rgba(washCol, 0));
        ctx.fillStyle = bgGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, bloomR, 0, Math.PI * 2);
        ctx.fill();

        // 2. Delicate cursive filament link (`行草游丝牵丝`) from previous character in column
        if (prevCharPt && bloomU > 0.15) {
          stroke(
            ctx,
            [
              [prevCharPt[0], prevCharPt[1] + fontSize * 0.34],
              [(prevCharPt[0] + cx) * 0.5 + (rng() - 0.5) * 6, (prevCharPt[1] + cy) * 0.5],
              [cx, cy - fontSize * 0.34],
            ],
            {
              w: Math.max(1.1, fontSize * 0.045),
              tone: 0.28 * charAlpha,
              dry: 0.62,
              prof: 'tip',
              color,
              seed: seed + globalCharIdx * 11,
            },
            bloomU,
            charAlpha
          );
        }

        // 3. Calligraphic glyph with right-upward brush posture (`右上取势 · 提按墨韵`)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(charScale, charScale);
        ctx.transform(1, -0.045, -0.055, 1, 0, 0);
        ctx.font = `600 ${Math.round(fontSize)}px "STKaiti", "Kaiti SC", "FZKai-Z03S", "AR PL UKai CN", "Noto Serif CJK SC", "WenQuanYi Zen Hei", serif`;
        ctx.shadowColor = isLightText ? rgba(INK_PALETTE.inkJiao, 0.82 * charAlpha) : rgba(INK_PALETTE.xuanWarm, 0.9 * charAlpha);
        ctx.shadowBlur = 11;
        ctx.strokeStyle = rgba(color, 0.34 * charAlpha);
        ctx.lineWidth = Math.max(1.0, fontSize * 0.036);
        ctx.strokeText(tk.ch, 0, 0);
        ctx.fillStyle = rgba(color, charAlpha);
        ctx.fillText(tk.ch, 0, 0);
        ctx.restore();
      }

      prevCharPt = [cx, cy];
      if (layout === 'horizontal') curX += tk.step;
      else curY += tk.step;
    }

    if (colIdx === parsedLines.length - 1) {
      maxColHeight = curY - colBaseY;
    }
  });
  ctx.restore();

  // Optional Cinnabar Seal stamp at the end of the verse (with generous clearance below last glyph)
  if (sealText && u > 0.62) {
    const sealSize = clamp(fontSize * (isKuangcao ? 0.86 : 1.16), 32, 74);
    const sealX = layout === 'horizontal' ? lastCharPos[0] + fontSize * 1.15 : lastCharPos[0];
    const sealY = layout === 'horizontal' ? lastCharPos[1] : lastCharPos[1] + fontSize * 0.78 + sealSize * 0.68;
    drawCinnabarSeal(ctx, sealX, sealY, {
      size: sealSize,
      text: sealText,
      withShockwave: isKuangcao,
      stampProgress: (u - 0.62) / 0.38,
      seed: seed + 99,
    });
  }

  ctx.restore();
}

/**
 * Renders a Vertical Classical Calligraphic Inscription (`竖排题跋落款 + 朱印`).
 * Supports both scroll-margin anchoring and in-painting `'xingcao'` / `'kuangcao'` verse performance.
 */
export function drawVerticalColophon(ctx, x, y, opts = {}) {
  if (opts.style === 'kuangcao' || opts.style === 'xingcao' || opts.freePlacement) {
    drawCalligraphicVerse(ctx, x, y, {
      style: opts.style || 'xingcao',
      freePlacement: Boolean(opts.freePlacement || opts.style === 'kuangcao'),
      ...opts,
    });
    return;
  }
  const {
    lines = ['山高水长 · 四时丹青'],
    sealText = '丹青',
    reveal = 1.0,
    color = INK_PALETTE.inkJiao,
    fontSize = 24,
    screenSpace = true,
  } = opts;
  drawCalligraphicVerse(ctx, x, y, {
    lines,
    sealText,
    reveal,
    color,
    fontSize,
    screenSpace,
    freePlacement: false,
    style: 'xingcao',
  });
}

// ============================================================================
// TIER 3D · AUTHENTIC BRISTLE, LOADED-BRUSH (`没骨侧锋`) & PROCEDURAL TERRAIN ENGINE
// ============================================================================

export const TONE = Object.freeze({
  jiao: 0.96, // 焦墨：书法、最锐线条、苔点
  nong: 0.82, // 浓墨：主要结构、含墨笔触浓侧边缘
  zhong: 0.60, // 重墨：次级结构、衣褶
  dan: 0.34,  // 淡墨：山体、衣袍铺底
  qing: 0.16, // 清墨：远山、面部、烟霭
});

export const INK_PROFILES = Object.freeze({
  brush: (s) => Math.min(1, 0.45 + (s / 0.1) * 0.55) * Math.pow(1 - s * 0.9, 0.45),
  even: (s) => Math.min(1, 0.55 + (s / 0.05) * 0.45) * Math.min(1, 0.5 + ((1 - s) / 0.06) * 0.5),
  tip: (s) => Math.pow(Math.sin(Math.PI * clamp(s * 0.96 + 0.02, 0, 1)), 0.6),
  lens: (s) => Math.pow(Math.sin(Math.PI * clamp(s, 0, 1)), 0.75),
  nail: (s) => Math.pow(1 - s, 0.7) * Math.min(1, 0.7 + s * 6),
  na: (s) => (0.25 + 0.75 * Math.pow(clamp(s / 0.82, 0, 1), 1.4)) * (s > 0.82 ? Math.pow(1 - (s - 0.82) / 0.18, 0.6) : 1),
  press: (s) => Math.min(1, 0.3 + (s / 0.15) * 0.7) * Math.min(1, ((1 - s) / 0.12) * 0.8 + 0.2),
  fan: (s) => (0.4 + 0.6 * Math.pow(s, 0.8)) * Math.min(1, ((1 - s) / 0.06) * 0.6 + 0.4) * Math.min(1, (s / 0.05) * 0.5 + 0.5),
  robe: (s) => (0.75 + 0.25 * s) * Math.min(1, (s / 0.05) * 0.5 + 0.5) * Math.min(1, ((1 - s) / 0.08) * 0.7 + 0.3),
  rise: (s) => Math.min(1, 0.12 + (s / 0.14) * 0.88) * Math.min(1, ((1 - s) / 0.08) * 0.7 + 0.3),
  cone: (s) => Math.pow(1 - s, 0.55) * Math.min(1, (s / 0.04) * 0.6 + 0.4),
  dot: (s) => Math.pow(Math.sin(Math.PI * clamp(s * 0.9 + 0.05, 0, 1)), 0.45),
});

function densifyCatmull(P, per = 8) {
  if (!P || P.length < 2) return P || [];
  if (P.length < 3) {
    const out = [];
    const [a, b] = [P[0], P[P.length - 1]];
    for (let i = 0; i <= per; i++) {
      const t = i / per;
      out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2] ?? 1, b[2] ?? 1, t)]);
    }
    return out;
  }
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), lerp(p1[2] ?? 1, p2[2] ?? 1, t)]);
    }
  }
  const last = P[P.length - 1];
  out.push([last[0], last[1], last[2] ?? 1]);
  return out;
}

function resampleArc(D, ds) {
  const acc = [0];
  for (let i = 1; i < D.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(D[i][0] - D[i - 1][0], D[i][1] - D[i - 1][1]));
  }
  const L = acc[acc.length - 1] || 1e-6;
  const n = Math.max(2, Math.min(480, Math.ceil(L / ds) + 1));
  const out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = (L * i) / (n - 1);
    while (j < D.length - 2 && acc[j + 1] < s) j++;
    const u = clamp((s - acc[j]) / (acc[j + 1] - acc[j] || 1e-6), 0, 1);
    out.push([lerp(D[j][0], D[j + 1][0], u), lerp(D[j][1], D[j + 1][1], u), lerp(D[j][2], D[j + 1][2], u)]);
  }
  return { pts: out, len: L };
}

/**
 * Helper for creating a "Loaded Brushstroke" (`没骨侧锋含墨笔触`):
 * Bristles are darker on the side facing `darkDir`, so a single brushstroke
 * automatically creates both a pale wash body and a dark contour edge on one side!
 */
export function LOAD(w, tone = TONE.nong, darkDir = [0, 1], opts = {}) {
  return {
    w,
    tone,
    darkDir,
    side: opts.side ?? 0.85,
    body: opts.body ?? 0.22,
    dry: opts.dry ?? 0.38,
    wet: opts.wet ?? 0.85,
    prof: opts.prof || 'robe',
    nb: opts.nb,
    rough: opts.rough ?? 0.12,
    color: opts.color || null,
    seed: opts.seed,
  };
}

const _STROKE_CACHE = new Map();
const _STROKE_CACHE_MAX = 2048;

/**
 * Builds a multi-bristle calligraphic/loaded stroke (`mkStroke`).
 * Supports 12 pressure profiles, asymmetric loaded bristles (`darkDir`/`side`),
 * normalized arc-length bristle breaks (`飞白`), and bounded LRU geometry memoization.
 */
export function mkStroke(pts, o = {}) {
  let cacheKey = null;
  if (typeof o.prof !== 'function' && pts && pts.length <= 64) {
    let pStr = '';
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      pStr += `${Math.round(pt[0] * 4)},${Math.round(pt[1] * 4)}${pt[2] != null ? ',' + Math.round(pt[2] * 20) : ''};`;
    }
    const dd = o.darkDir ? `${o.darkDir[0]},${o.darkDir[1]}` : '';
    cacheKey = `${pStr}|${o.w ?? 4}|${o.seed ?? 137}|${o.ds ?? ''}|${o.per ?? 8}|${o.prof || 'brush'}|${o.rough ?? 0.12}|${o.boil || 0}|${o.gapLen ?? ''}|${o.dry ?? 0.25}|${o.side || 0}|${dd}|${o.nb ?? ''}|${o.tone ?? TONE.nong}|${o.wet ?? 0}|${o.fade ?? ''}|${o.body ?? 1}|${o.bristle ?? 1}|${o.color || ''}|${o.solid ? 1 : 0}`;
    const hit = _STROKE_CACHE.get(cacheKey);
    if (hit) {
      _STROKE_CACHE.delete(cacheKey);
      _STROKE_CACHE.set(cacheKey, hit);
      return hit;
    }
  }

  const w = o.w ?? 4;
  const seed = o.seed ?? 137;
  const ds = o.ds ?? Math.max(0.4, w * 0.22);
  const { pts: P, len } = resampleArc(densifyCatmull(pts, o.per ?? 8), ds);
  const n = P.length;
  const prof = typeof o.prof === 'function' ? o.prof : INK_PROFILES[o.prof || 'brush'] || INK_PROFILES.brush;
  const rough = o.rough ?? 0.12;
  const ws = [];
  const nx = [];
  const ny = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    const nVal = valueNoise2D(seed * 0.013 + (o.boil || 0) * 0.35 + (s * (o.gapLen ?? len)) / (w * 1.3 + 1), seed * 0.07);
    ws.push(Math.max(w * 0.04, w * prof(s) * (P[i][2] ?? 1) * (1 + rough * (nVal * 2 - 1))));
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    nx.push(-dy / L);
    ny.push(dx / L);
  }
  const dry = o.dry ?? 0.25;
  let side = o.side || 0;
  if (o.darkDir) {
    let ax = 0;
    let ay = 0;
    for (let i = 0; i < n; i++) {
      ax += nx[i];
      ay += ny[i];
    }
    side = Math.abs(o.side || 1) * Math.sign(ax * o.darkDir[0] + ay * o.darkDir[1] || 1);
  }
  const nb = o.nb ?? Math.round(clamp(w * 1.05, 4, 48));
  const R = mulberry32(seed);
  const br = [];
  for (let j = 0; j < nb; j++) {
    const off = (j + 0.5) / nb - 0.5 + ((R() - 0.5) * 0.6) / nb;
    const edge = Math.abs(off) * 2;
    br.push({
      off,
      bw: (w / nb) * (1.0 + R() * 1.1),
      a: 0.55 + R() * 0.45,
      ph: R() * 1000,
      load: 1 - dry * (0.15 + 0.85 * edge) * (0.5 + R() * 0.7),
      gs: 0.5 + R() * 1.6,
      end: 1 - R() * dry * 0.35,
    });
  }
  const res = {
    P,
    n,
    len,
    ws,
    nx,
    ny,
    w,
    tone: o.tone ?? TONE.nong,
    dry,
    wet: o.wet ?? 0,
    br,
    seed,
    fade: o.fade ?? dry * 0.55,
    bodyK: o.body ?? 1,
    brK: o.bristle ?? 1,
    color: o.color || INK_PALETTE.inkJiao,
    side,
    solid: !!o.solid,
    gapLen: o.gapLen ?? null,
  };
  if (cacheKey) {
    if (_STROKE_CACHE.size >= _STROKE_CACHE_MAX) {
      const oldestKey = _STROKE_CACHE.keys().next().value;
      _STROKE_CACHE.delete(oldestKey);
    }
    _STROKE_CACHE.set(cacheKey, res);
  }
  return res;
}

/**
 * Renders a stroke created by `mkStroke` onto `ctx`, with optional progressive reveal `p` (`0..1`).
 */
export function drawStroke(ctx, s, p = 1, am = 1) {
  if (!s || p <= 0 || am <= 0) return;
  const prog = clamp(p, 0, 1);
  const { P, n, ws, nx, ny } = s;
  const m = (n - 1) * prog;
  const k = Math.floor(m);
  const f = m - k;
  if (k < 1 && f < 0.05) return;

  const endPt =
    k < n - 1
      ? [lerp(P[k][0], P[k + 1][0], f), lerp(P[k][1], P[k + 1][1], f), lerp(ws[k], ws[k + 1], f)]
      : [P[n - 1][0], P[n - 1][1], ws[n - 1]];
  const endN = k < n - 1 ? [lerp(nx[k], nx[k + 1], f), lerp(ny[k], ny[k + 1], f)] : [nx[n - 1], ny[n - 1]];

  const poly = (scale = 1) => {
    ctx.beginPath();
    for (let i = 0; i <= k; i++) {
      const x = P[i][0] + nx[i] * ws[i] * 0.5 * scale;
      const y = P[i][1] + ny[i] * ws[i] * 0.5 * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(endPt[0] + endN[0] * endPt[2] * 0.5 * scale, endPt[1] + endN[1] * endPt[2] * 0.5 * scale);
    ctx.lineTo(endPt[0] - endN[0] * endPt[2] * 0.5 * scale, endPt[1] - endN[1] * endPt[2] * 0.5 * scale);
    for (let i = k; i >= 0; i--) {
      ctx.lineTo(P[i][0] - nx[i] * ws[i] * 0.5 * scale, P[i][1] - ny[i] * ws[i] * 0.5 * scale);
    }
    ctx.closePath();
  };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Multi-ring capillary wet halo (`宣纸毛细水晕`) & base body fill
  const bodyA = s.tone * am * s.bodyK * Math.pow(clamp(1 - s.dry * 0.85, 0, 1), 1.6);
  const effWet = Math.max(s.wet || 0, s.w >= 6 ? 0.32 : 0.14);
  if (effWet > 0 && bodyA > 0.006) {
    poly(1.26);
    ctx.fillStyle = rgba(s.color, clamp(s.tone * am * effWet * 0.11, 0, 1));
    ctx.fill();
    poly(1.13);
    ctx.fillStyle = rgba(s.color, clamp(s.tone * am * effWet * 0.21, 0, 1));
    ctx.fill();
  }
  if (bodyA > 0.005) {
    poly(1.0);
    ctx.fillStyle = rgba(s.color, clamp(bodyA, 0, 1));
    ctx.fill();
  }

  // 1b. Po-Mo capillary ink pooling stamps (`破墨湿斑与宿墨渗化`) along wide/close-up strokes
  if (s.w >= 6.5 && !s.solid && k >= 3) {
    const stampStep = Math.max(2, Math.floor(14 / Math.max(1, s.w * 0.18)));
    for (let i = 1; i <= k; i += stampStep) {
      const u = i / Math.max(1, n - 1);
      const nVal = valueNoise2D(s.seed * 0.17 + i * 0.73, s.seed * 0.31);
      if (nVal < s.dry * 0.55) continue;
      const sideShift = (s.side ? Math.sign(s.side) * 0.28 : (nVal - 0.5) * 0.4) * ws[i];
      const bx = P[i][0] + nx[i] * sideShift;
      const by = P[i][1] + ny[i] * sideShift;
      const br = ws[i] * (0.34 + 0.28 * nVal);
      const blotA = clamp(s.tone * am * (0.16 + 0.18 * (1 - u * s.fade)), 0.02, 0.42);
      drawInkBlot(ctx, bx, by, br, blotA, i * 1.1 + s.seed, 0.62 + 0.25 * nVal, s.seed + i * 13, s.color);
    }
  }

  // 2. Individual bristles (`笔毫`: asymmetric loaded ink + dry flying-white gaps)
  if (s.brK > 0 && !s.solid) {
    const gL = (s.gapLen ?? s.len) / (s.w * 2.5 + 8);
    for (const b of s.br) {
      const sideBias = clamp(1 + s.side * b.off * 2, 0.08, 2.2);
      const ba = s.tone * am * b.a * s.brK * sideBias * (s.dry < 0.15 ? 0.38 : 0.88);
      if (ba < 0.012) continue;
      ctx.strokeStyle = rgba(s.color, clamp(ba, 0, 1));
      ctx.lineWidth = b.bw;
      ctx.beginPath();
      let down = false;
      const maxI = Math.min(k, Math.floor((n - 1) * b.end));
      for (let i = 0; i <= maxI; i++) {
        const u = i / (n - 1);
        const ink = b.load - u * s.fade + (valueNoise2D(b.ph + u * gL * b.gs, s.seed * 0.1) - 0.5) * s.dry * 1.4;
        if (ink > 0.12) {
          const x = P[i][0] + nx[i] * ws[i] * b.off;
          const y = P[i][1] + ny[i] * ws[i] * b.off;
          if (!down) {
            ctx.moveTo(x, y);
            down = true;
          } else {
            ctx.lineTo(x, y);
          }
        } else if (down) {
          ctx.stroke();
          ctx.beginPath();
          down = false;
        }
      }
      if (down) ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Convenience wrapper that builds and immediately draws a bristle/loaded stroke (`stroke`).
 */
export function stroke(ctx, pts, opts = {}, progress = 1, alpha = 1) {
  const s = mkStroke(pts, opts);
  drawStroke(ctx, s, progress, alpha);
  return s;
}

/**
 * Renders a soft jittered-edge wet ink mass (`drawInkMass`, equivalent to `mass()` in lemo-opuscar):
 * Replaces flat vector fills with multi-stage capillary Po-Mo (`破墨`) ink washes, internal tonal
 * mottling, and interrupted coffee-ring pigment water-lines (`断续宿墨水线`).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<[number,number]>} pts - Polygon vertices
 * @param {object} opts - `{ tone, color, jitter, seed, grad: [x0, y0, x1, y1, a0, a1], wetRim }`
 */
export function drawInkMass(ctx, pts, opts = {}) {
  if (!pts || pts.length < 3) return;
  const tone = opts.tone ?? TONE.dan;
  const color = opts.color || INK_PALETTE.inkNong;
  const jitter = opts.jitter ?? 2.5;
  const seed = opts.seed ?? 19;
  const R = mulberry32(seed);
  const sub = [];
  const subNorms = [];
  let cx = 0;
  let cy = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.min(20, Math.ceil(d / 18)));
    const nx = -(b[1] - a[1]) / (d || 1);
    const ny = (b[0] - a[0]) / (d || 1);
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const nFbm = fbm2D((i + t) * 1.9 + seed * 0.13, seed * 0.29, 2) - 0.5;
      const j = ((R() - 0.5) * 1.3 + nFbm * 1.4) * jitter;
      const px = lerp(a[0], b[0], t) + nx * j;
      const py = lerp(a[1], b[1], t) + ny * j;
      sub.push([px, py]);
      subNorms.push([nx, ny]);
      cx += px;
      cy += py;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }
  cx /= Math.max(1, sub.length);
  cy /= Math.max(1, sub.length);

  const traceSubPath = (expandPx = 0) => {
    ctx.beginPath();
    for (let i = 0; i < sub.length; i++) {
      const prev = sub[(i - 1 + sub.length) % sub.length];
      const pn = subNorms[(i - 1 + sub.length) % sub.length];
      const cur = sub[i];
      const cn = subNorms[i];
      const p0x = prev[0] + pn[0] * expandPx;
      const p0y = prev[1] + pn[1] * expandPx;
      const p1x = cur[0] + cn[0] * expandPx;
      const p1y = cur[1] + cn[1] * expandPx;
      const mx = (p0x + p1x) * 0.5;
      const my = (p0y + p1y) * 0.5;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.quadraticCurveTo(p0x, p0y, mx, my);
    }
    ctx.closePath();
  };

  ctx.save();

  // 1. Outer capillary bleed halo (`宣纸毛细外晕`, eliminates sharp vector edges)
  if (jitter > 0.6 && tone > 0.05) {
    traceSubPath(jitter * 1.15);
    ctx.fillStyle = rgba(color, clamp(tone * 0.22, 0, 0.35));
    ctx.fill();
  }

  // 2. Primary wet wash body
  traceSubPath(0);
  if (opts.grad) {
    const [x0, y0, x1, y1, a0 = 1, a1 = 0] = opts.grad;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, rgba(color, clamp(tone * a0, 0, 1)));
    g.addColorStop(0.55, rgba(color, clamp(tone * lerp(a0, a1, 0.48), 0, 1)));
    g.addColorStop(1, rgba(color, clamp(tone * a1, 0, 1)));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = rgba(color, clamp(tone, 0, 1));
  }
  ctx.fill();

  // 3. Internal Po-Mo tonal mottling (`破墨浓淡渗化`, clipped inside wash body)
  const span = Math.hypot(maxX - minX, maxY - minY);
  if (span > 28 && tone > 0.08) {
    ctx.save();
    ctx.clip();
    const nBlobs = Math.min(4, Math.max(2, Math.floor(span / 85)));
    for (let b = 0; b < nBlobs; b++) {
      const vIdx = Math.floor(R() * sub.length);
      const vp = sub[vIdx];
      const bx = lerp(cx, vp[0], 0.35 + R() * 0.35);
      const by = lerp(cy, vp[1], 0.35 + R() * 0.35);
      const br = span * (0.16 + R() * 0.18);
      const rg = ctx.createRadialGradient(bx, by, br * 0.1, bx, by, br);
      rg.addColorStop(0, rgba(color, clamp(tone * 0.42, 0, 0.45)));
      rg.addColorStop(0.65, rgba(color, clamp(tone * 0.16, 0, 0.22)));
      rg.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 4. Interrupted concave Coffee-Ring pigment water-line (`断续边缘宿墨水线`, never a 360° cartoon outline)
  if (opts.wetRim !== false && tone > 0.08 && sub.length >= 6) {
    ctx.lineCap = 'round';
    let i = 0;
    while (i < sub.length) {
      const nVal = valueNoise2D(seed * 0.31 + i * 0.42, seed * 0.19);
      if (nVal > 0.44) {
        const segLen = Math.min(sub.length - i - 1, 2 + Math.floor(R() * 4));
        if (segLen >= 2) {
          ctx.beginPath();
          ctx.moveTo(sub[i][0], sub[i][1]);
          for (let k = 1; k <= segLen; k++) {
            const p = sub[(i + k) % sub.length];
            ctx.lineTo(p[0], p[1]);
          }
          ctx.strokeStyle = rgba(color, clamp(tone * (0.28 + 0.24 * nVal), 0, 0.48));
          ctx.lineWidth = 0.7 + 1.1 * nVal;
          ctx.stroke();
        }
        i += segLen + 2 + Math.floor(R() * 3);
      } else {
        i += 2;
      }
    }
  }
  ctx.restore();
}

/**
 * Renders an irregular wet ink blot / moss dot / spray droplet (`drawInkBlot`).
 */
export function drawInkBlot(ctx, x, y, r = 3, tone = TONE.jiao, angle = 0, aspect = 0.75, seed = 1, color = INK_PALETTE.inkJiao) {
  const R = mulberry32(seed);
  const m = 12;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(1, aspect);
  ctx.beginPath();
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2;
    const rr = r * (0.72 + R() * 0.52);
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = rgba(color, clamp(tone, 0, 1));
  ctx.fill();
  ctx.restore();
}

/**
 * Evaluates a mountain ridge profile from a list of `[peakX, height, width]` peaks (`ridgeFn`),
 * with 3-octave fractal roughness so any horizon, gorge, or towering peak can be composed.
 */
export function ridgeFn(peaks = [], base = 520, seed = 1, rough = 18) {
  return (x) => {
    let y = 0;
    for (const [px, h, w] of peaks) {
      const d = Math.abs(x - px) / Math.max(1, w);
      y = Math.max(y, h * Math.exp(-Math.pow(d, 1.7)) * (1 - 0.12 * Math.exp(-d * d * 30)));
    }
    const n =
      (fbm2D(x * 0.004 + seed, seed * 0.3, 3) - 0.5) * rough +
      (valueNoise2D(x * 0.018 + seed * 3, 1.7) - 0.5) * rough * 0.45;
    return base - y * (1 + (valueNoise2D(x * 0.01 + seed, 2.3) - 0.5) * 0.22) - n;
  };
}

/**
 * Draws a custom mountain range defined by `ridge` (`ridgeFn`), with a dark ink rim along
 * the crest that dissolves downward into blank-paper mist, plus optional `披麻皴` and `苔点` moss dots.
 */
export function drawRidgeLayer(ctx, opts = {}) {
  const x0 = opts.x0 ?? -120;
  const x1 = opts.x1 ?? 2040;
  const step = opts.step ?? 10;
  const depth = opts.depth ?? 260;
  const tone = opts.tone ?? TONE.dan;
  const color = opts.color || INK_PALETTE.inkNong;
  const seed = opts.seed ?? 11;
  const ridge = typeof opts.ridge === 'function' ? opts.ridge : ridgeFn(opts.peaks || [[960, 220, 380]], opts.base ?? 520, seed);

  const crestPts = [];
  let minY = 9999;
  let maxBaseY = 0;
  for (let x = x0; x <= x1; x += step) {
    const ry = ridge(x);
    if (ry < minY) minY = ry;
    if (ry + depth > maxBaseY) maxBaseY = ry + depth;
    crestPts.push([x, ry]);
  }

  // 1. Mountain body dissolving downward into blank paper mist
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(crestPts[0][0], crestPts[0][1]);
  for (let i = 1; i < crestPts.length; i++) {
    ctx.lineTo(crestPts[i][0], crestPts[i][1]);
  }
  ctx.lineTo(x1, maxBaseY);
  ctx.lineTo(x0, maxBaseY);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, minY, 0, minY + depth);
  grad.addColorStop(0.0, rgba(color, clamp(tone * 0.92, 0, 1)));
  grad.addColorStop(0.38, rgba(color, clamp(tone * 0.48, 0, 1)));
  grad.addColorStop(0.78, rgba(color, clamp(tone * 0.12, 0, 1)));
  grad.addColorStop(1.0, rgba(color, 0));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // 2. Loaded brushstroke along the ridge crest (`山脊浓边`)
  if (opts.rim !== false) {
    stroke(
      ctx,
      crestPts,
      LOAD(opts.rimW ?? 12, clamp(tone * 1.45, 0.12, 0.92), [0, 1], {
        dry: opts.dry ?? 0.48,
        color,
        seed: seed * 17,
      })
    );
  }

  // 3. Optional Pima Cun (`披麻皴`) & Moss Dots (`点苔`) on near/mid ranges
  if (opts.cun) {
    const R = mulberry32(seed * 31);
    const nC = Math.round(((x1 - x0) / 110) * (typeof opts.cun === 'number' ? opts.cun : 1.1));
    for (let i = 0; i < nC; i++) {
      const cx = lerp(x0 + 30, x1 - 30, R());
      const cy = ridge(cx) + 6 + R() * 34;
      const sl = (ridge(cx + 10) - ridge(cx - 10)) / 20;
      const len = 28 + R() * 58;
      const dx = clamp(sl * len * 0.8, -len * 0.7, len * 0.7);
      stroke(
        ctx,
        [
          [cx, cy],
          [cx + dx * 0.45 + (R() - 0.5) * 8, cy + len * 0.5],
          [cx + dx * 0.82, cy + len],
        ],
        LOAD(7 + R() * 8, clamp(tone * 1.35, 0.15, 0.88), [-1, 0], {
          dry: 0.62 + R() * 0.2,
          prof: 'tip',
          color,
          seed: seed * 500 + i,
        }),
        1,
        0.72
      );
    }
  }
  if (opts.moss) {
    const R = mulberry32(seed * 73);
    const nM = Math.round(((x1 - x0) / 120) * (typeof opts.moss === 'number' ? opts.moss : 1.3));
    for (let i = 0; i < nM; i++) {
      const mx = lerp(x0 + 20, x1 - 20, R());
      const my = ridge(mx) + R() * 8;
      for (let k = 0; k < 3; k++) {
        drawInkBlot(
          ctx,
          mx + (R() - 0.5) * 14,
          my + R() * 5,
          1.4 + R() * 2.2,
          clamp(tone * 2.4, 0.35, 0.92),
          R() * 3,
          0.65,
          seed + i * 5 + k,
          color
        );
      }
    }
  }

  recordSceneElement2D(ctx, {
    id: opts.id || `ridgeLayer_${seed}`,
    role: opts.role || 'bg',
    layerZ: opts.layerZ ?? 0.25,
    kind: 'ridgeLayer',
    bbox: [x0, minY, x1, minY + depth * 0.65],
  });
}

/**
 * Renders an authentic Song-Yuan overhanging cliff / precipice (`drawCliffFace`: 勾、皴、染、点),
 * built entirely from loaded brushstrokes (`LOAD`), wet ink masses (`drawInkMass`), and moss blots.
 */
export function drawCliffFace(ctx, x, y, scale = 1.0, opts = {}) {
  const seed = opts.seed ?? 3;
  const flip = opts.flip ?? 1; // 1 = cliff juts right, -1 = cliff juts left
  const color = opts.color || INK_PALETTE.inkJiao;
  const R = mulberry32(seed);
  const T = (p) => [x + p[0] * scale * flip, y + p[1] * scale];

  const top = [[-55, 4], [0, -1], [45, 1], [90, -2], [128, 1], [152, 4]];
  const face = [[152, 4], [172, 22], [167, 62], [188, 98], [183, 142], [204, 192], [214, 262]];
  const facets = [
    [[112, 4], [132, 42], [127, 92], [148, 150], [152, 240]],
    [[62, 3], [80, 52], [74, 120], [94, 210]],
    [[18, 2], [30, 60], [26, 150]],
  ];

  // 1. 染 (Wash): overall pale ink mass fading downward + loaded shadow strokes along facets
  drawInkMass(
    ctx,
    [...top, ...face.slice(1), [65, 262], [-25, 160], [-55, 40]].map(T),
    {
      tone: 0.24,
      color,
      jitter: 2.2 * scale,
      seed,
      grad: [0, y, 0, y + 255 * scale, 1.15, 0.04],
    }
  );
  [face, ...facets].forEach((f, i) => {
    stroke(
      ctx,
      f.map((p) => T([p[0] - 12, p[1] + 4])),
      LOAD((i === 0 ? 32 : 20) * scale, i === 0 ? 0.52 : 0.34, [flip, 0], {
        dry: 0.55,
        prof: 'rise',
        color,
        seed: seed * 5 + i,
      }),
      1,
      0.88
    );
  });

  // 2. 勾 (Outline): segmented pressurized brush strokes along cliff top and face
  const drawSegOutline = (pts, w, sd) => {
    for (let i = 0; i < pts.length - 1; i += 2) {
      const seg = pts.slice(i, i + 3).map((p, j) => [...T(p), j === 1 ? 1.2 : 0.72]);
      stroke(ctx, seg, { w: w * scale, tone: 0.9, dry: 0.48, wet: 0.2, prof: 'brush', color, seed: sd + i });
    }
  };
  drawSegOutline(top, 4.2, seed * 13);
  drawSegOutline(face, 4.6, seed * 17);
  facets.forEach((f, i) => {
    stroke(ctx, f.slice(0, 3 + (i === 0 ? 1 : 0)).map(T), {
      w: (3.0 - i * 0.5) * scale,
      tone: 0.82,
      dry: 0.58,
      prof: 'tip',
      color,
      seed: seed * 23 + i,
    });
  });

  // 3. 皴 (Axe-cut Cun): short diagonal nail-head strokes along rock planes
  for (const f of [face, ...facets]) {
    for (let i = 0; i < 6; i++) {
      const u = R() * 0.75;
      const k = Math.floor(u * (f.length - 1));
      const fr = u * (f.length - 1) - k;
      const px = lerp(f[k][0], f[k + 1][0], fr) - 4 - R() * 10;
      const py = lerp(f[k][1], f[k + 1][1], fr) + 4;
      const len = 16 + R() * 22;
      stroke(
        ctx,
        [
          [px, py],
          [px - len * 0.35, py + len * 0.5],
          [px - len * 0.5, py + len],
        ].map(T),
        { w: (6.5 + R() * 6.5) * scale, tone: 0.72, dry: 0.62, prof: 'nail', color, seed: seed * 50 + i + f.length * 7 },
        1,
        clamp(1.25 - py / 210, 0.15, 1)
      );
    }
  }

  // 4. 点 (Moss dots & grass tufts on cliff top)
  for (let c = 0; c < 5; c++) {
    const cx = R() * 145;
    for (let i = 0; i < 4; i++) {
      const p = T([cx + (R() - 0.5) * 16, -1 + R() * 4]);
      drawInkBlot(ctx, p[0], p[1], (1.3 + R() * 2.0) * scale, 0.85, R() * 3, 0.65, c * 10 + i + seed, color);
    }
  }

  // 5. Base mist-root diffusion wash (`山脚烟霭消融`) so cliffs root into the scroll instead of floating
  const b0 = T([-65, 220]);
  const b1 = T([220, 265]);
  recordSceneElement2D(ctx, {
    id: opts.id || `cliffFace_${seed}`,
    role: opts.role || 'mid',
    kind: 'cliffFace',
    bbox: [Math.min(b0[0], b1[0]), y - 8 * scale, Math.max(b0[0], b1[0]), y + 265 * scale],
  });
}

/**
 * Renders a towering gestural ink wave (`drawGesturalWave`: 巨浪排空 / 黄河之水天上来),
 * built from a multi-layer Po-Mo wet ink mass, 4–5 huge loaded strokes curling at the crest,
 * turbulent claw-foam hooks (`蟹爪水纹`), and organic spray splatter droplets (`飞沫破墨`).
 */
export function drawGesturalWave(ctx, x, y, scale = 1.0, t = 0, opts = {}) {
  const flip = opts.flip ?? 1; // 1 = curls left-to-right, -1 = curls right-to-left
  const seed = opts.seed ?? 77;
  const color = opts.color || INK_PALETTE.inkJiao;
  const surge = Math.sin(t * 2.2) * 8 * scale;
  const T = (px, py) => [x + px * scale * flip, y + py * scale + surge];
  const R = mulberry32(seed * 13);

  // 1. Pale wet body mass of the rising wall of water + deeper turbulent under-belly wash
  const bodyPoly = [
    T(-220, 140),
    T(-140, 40),
    T(-60, -85),
    T(15, -180),
    T(85, -210),
    T(125, -165),
    T(75, -110),
    T(110, -20),
    T(180, 140),
  ];
  drawInkMass(ctx, bodyPoly, {
    tone: 0.24,
    color,
    jitter: 4.2 * scale,
    seed,
    grad: [x, y - 210 * scale, x, y + 140 * scale, 0.95, 0.12],
  });
  // Secondary Po-Mo dark core inside the wave trough (`浓破淡浪腹暗涌`)
  drawInkMass(
    ctx,
    [T(-145, 115), T(-55, -25), T(25, -125), T(78, -95), T(45, 25), T(-40, 125)],
    {
      tone: 0.18,
      color,
      jitter: 3.0 * scale,
      seed: seed + 7,
      wetRim: false,
    }
  );

  // 2. Huge loaded brushstrokes (`没骨巨笔`) curling up into the crest
  const ribs = [
    [[-190, 125], [-95, 10], [-15, -125], [65, -195], [115, -170], [82, -125]],
    [[-130, 130], [-45, 25], [25, -95], [88, -155], [122, -130]],
    [[-70, 135], [5, 45], [55, -45], [95, -85]],
    [[10, 135], [65, 65], [115, 15]],
  ];
  ribs.forEach((pts, idx) => {
    stroke(
      ctx,
      pts.map((p) => T(p[0], p[1])),
      LOAD((26 - idx * 4) * scale, 0.74 - idx * 0.1, [-flip, -1], {
        dry: 0.38 + idx * 0.08,
        wet: 0.92,
        prof: 'rise',
        color,
        seed: seed * 19 + idx,
      })
    );
  });

  // 3. Claw-like crest hooks (`宋代马远水图浪冠爪纹`) & flying ink spray droplets (`飞沫点苔`)
  const hooks = [
    [[72, -198], [108, -214], [134, -186]],
    [[102, -175], [138, -168], [148, -138]],
    [[62, -142], [96, -128], [108, -102]],
  ];
  hooks.forEach((hPts, hIdx) => {
    stroke(
      ctx,
      hPts.map((p) => T(p[0], p[1])),
      {
        w: (5.2 - hIdx * 0.9) * scale,
        tone: TONE.jiao,
        dry: 0.45,
        prof: 'nail',
        color,
        seed: seed * 41 + hIdx,
      }
    );
  });

  for (let sIdx = 0; sIdx < 16; sIdx++) {
    const sx = 35 + R() * 135;
    const sy = -225 + R() * 120 + Math.sin(t * 3.1 + sIdx) * 4;
    const sp = T(sx, sy);
    const rDot = (1.2 + R() * 2.8) * scale;
    drawInkBlot(ctx, sp[0], sp[1], rDot, 0.45 + R() * 0.48, R() * 3.14, 0.58 + R() * 0.3, seed * 97 + sIdx, color);
  }

  const pMin = T(-220, -215);
  const pMax = T(180, 145);
  recordSceneElement2D(ctx, {
    id: opts.id || `gesturalWave_${seed}`,
    role: opts.role || 'mid',
    kind: 'gesturalWave',
    bbox: [Math.min(pMin[0], pMax[0]), Math.min(pMin[1], pMax[1]), Math.max(pMin[0], pMax[0]), Math.max(pMin[1], pMax[1])],
  });
}

// ============================================================================
// TIER 4A · EXPRESSIVE 2D CHINESE PAINTING CHARACTER PUPPET (`createInkCharacter`)
// ============================================================================

/**
 * Creates an articulated 2D Song-Yuan Figure Painting Character Puppet (`写意没骨 + 白描设色双模人物`).
 * Built on the style-agnostic 2D skeleton solver (`engine/puppet2d.js`).
 * Supports:
 *   - `renderMode: 'baimiao' | 'xieyi'` (`'xieyi'` uses loaded brushstrokes `LOAD` + wet mass `drawInkMass`)
 *   - `view: 'side' | 'front' | 'back'` (profile view, frontal bow/greeting view, and over-the-shoulder back view)
 *   - Archetypes: `'scholar' | 'angler' | 'swordsman' | 'musician' | 'child' | 'monk'`
 *   - `.act(localT, actions)` and `.getBounds()` for `studio.director`.
 */
export function createInkCharacter(opts = {}) {
  function skinXieyiFrontOrBack(ctx, skel, state, t = 0) {
    const isBack = state.view === 'back';
    const inkCol = state.strokeColor || INK_PALETTE.inkJiao;
    const { pelvis, lumbar, thorax, neckBase, headTop, shL, elL, wrL, shR, elR, wrR, ankleL, ankleR, breeze } = skel;
    const hemL = [ankleL.x - 16 - breeze * 0.4, -6];
    const hemR = [ankleR.x + 16 - breeze * 0.2, -6];
    const sL = [shL.x - 4, shL.y];
    const sR = [shR.x + 4, shR.y];
    const wL = [lumbar.x - 11, lumbar.y];
    const wR = [lumbar.x + 11, lumbar.y];

    // 1. Boots below robe hem
    for (const ank of [ankleL, ankleR]) {
      stroke(ctx, [[ank.x, -18], [ank.x, 0]], { w: 4.2, tone: TONE.jiao, dry: 0.25, prof: 'even', color: inkCol });
    }

    // 2. Robe base mass (`一块清墨打底`) + bilateral loaded brushstrokes (`左右两笔侧锋含墨，浓边在外`)
    drawInkMass(ctx, [[neckBase.x - 7, neckBase.y], sL, wL, hemL, [0, -4], hemR, wR, sR, [neckBase.x + 7, neckBase.y]], {
      tone: 0.22,
      color: inkCol,
      jitter: 1.8,
      seed: 41,
    });
    stroke(
      ctx,
      [[neckBase.x - 7, neckBase.y], sL, wL, hemL],
      LOAD(11, isBack ? 0.76 : 0.68, [-1, 0], { dry: 0.42, color: inkCol, seed: 42 })
    );
    stroke(
      ctx,
      [[neckBase.x + 7, neckBase.y], sR, wR, hemR],
      LOAD(10.5, isBack ? 0.72 : 0.64, [1, 0], { dry: 0.45, color: inkCol, seed: 43 })
    );

    // 3. Left & Right Wide Sleeves in loaded ink strokes
    for (const [sh, el, wr, side] of [
      [shL, elL, wrL, -1],
      [shR, elR, wrR, 1],
    ]) {
      const droop = [lerp(el.x, wr.x, 0.55) + side * 5, Math.max(el.y, wr.y) + 22];
      drawInkMass(
        ctx,
        [[sh.x, sh.y], [el.x + side * 3, el.y], [wr.x, wr.y], [wr.x, wr.y + 8], droop, [el.x - side * 2, el.y + 8]],
        { tone: 0.16, color: inkCol, jitter: 1.5, seed: side > 0 ? 51 : 52 }
      );
      stroke(ctx, [[sh.x, sh.y], [el.x, el.y], [wr.x, wr.y]], LOAD(9, 0.58, [side, 0.3], { dry: 0.45, color: inkCol }));
      stroke(ctx, [[el.x, el.y + 5], droop, [wr.x, wr.y + 8]], LOAD(5, 0.72, [side, 1], { dry: 0.5, prof: 'tip', color: inkCol }));
    }

    // 4. Collar / Sash & Waist Scabbard
    if (!isBack) {
      stroke(ctx, [[neckBase.x - 7, neckBase.y], [thorax.x, thorax.y + 10], [neckBase.x + 7, neckBase.y]], {
        w: 2.8,
        tone: TONE.nong,
        dry: 0.35,
        prof: 'tip',
        color: inkCol,
      });
    }
    stroke(ctx, [[wL[0] - 2, lumbar.y], [lumbar.x, lumbar.y + 2], [wR[0] + 2, lumbar.y]], {
      w: 4.5,
      tone: TONE.jiao,
      dry: 0.3,
      prof: 'nail',
      color: inkCol,
    });

    // Sword in hand (e.g. `backWrite` / `writeAir` or `wieldSword`)
    if (state.heldProp === 'sword') {
      const swordAng = -0.85 + Math.sin(state.swordSlash * Math.PI) * 0.45;
      const tipX = wrR.x + Math.cos(swordAng) * 96;
      const tipY = wrR.y + Math.sin(swordAng) * 96;
      stroke(ctx, [[wrR.x, wrR.y], [(wrR.x + tipX) * 0.5, (wrR.y + tipY) * 0.5], [tipX, tipY]], {
        w: 2.6,
        tone: TONE.jiao,
        dry: 0.15,
        prof: 'tip',
        color: inkCol,
      });
      // Vermilion sword tassel (`朱砂剑穗` — the single red focal accent in wide shots)
      stroke(
        ctx,
        [
          [wrR.x, wrR.y + 2],
          [wrR.x - 4 - breeze * 0.8, wrR.y + 14],
          [wrR.x - 9 - breeze * 1.6, wrR.y + 26],
        ],
        { w: 2.4, tone: 0.92, dry: 0.3, prof: 'brush', color: INK_PALETTE.zhuSha }
      );
    }

    // 5. Head & Hat / Topknot
    drawInkMass(
      ctx,
      [
        [headTop.x - 8, headTop.y],
        [headTop.x + 8, headTop.y],
        [neckBase.x + 6, neckBase.y],
        [neckBase.x - 6, neckBase.y],
      ],
      { tone: isBack ? 0.65 : 0.15, color: inkCol, jitter: 1.0, seed: 61 }
    );
    if (state.hat === 'bamboo') {
      const ap = [headTop.x, headTop.y - 14];
      const bl = [headTop.x - 38, headTop.y + 4];
      const br = [headTop.x + 38, headTop.y + 4];
      drawInkMass(ctx, [ap, bl, [headTop.x, headTop.y + 7], br], { tone: 0.58, color: inkCol, jitter: 1.5, seed: 62 });
      stroke(ctx, [ap, bl], { w: 3.4, tone: TONE.jiao, dry: 0.48, prof: 'nail', color: inkCol });
      stroke(ctx, [ap, br], { w: 3.4, tone: TONE.jiao, dry: 0.48, prof: 'nail', color: inkCol });
      stroke(ctx, [bl, [headTop.x, headTop.y + 6], br], { w: 2.8, tone: TONE.jiao, dry: 0.4, prof: 'tip', color: inkCol });
    } else {
      stroke(ctx, [[headTop.x, headTop.y + 2], [headTop.x, headTop.y - 14]], {
        w: 7.5,
        tone: TONE.jiao,
        dry: 0.25,
        prof: 'cone',
        color: inkCol,
      });
    }
  }

  function skinXieyiSide(ctx, skel, state, t = 0) {
    const inkCol = state.strokeColor || INK_PALETTE.inkJiao;
    const {
      breeze,
      lumbar,
      thorax,
      neckBase,
      headTop,
      shL,
      elL,
      wrL,
      shR,
      elR,
      wrR,
      ankleL,
      ankleR,
      toeL,
      toeR,
      trainTip,
      hairB1,
      hairB2,
      hairB3,
      rodNodes,
    } = skel;
    const minAnkX = Math.min(ankleL.x, ankleR.x);
    const maxAnkX = Math.max(ankleL.x, ankleR.x);
    const hemB = [Math.min(minAnkX - 15, trainTip.x), -8];
    const hemF = [maxAnkX + 14, -7];
    const nape = [neckBase.x - 6, neckBase.y + 2];
    const chestF = [thorax.x + 11, thorax.y + 2];
    const bw = [lumbar.x - 11, lumbar.y];
    const fw = [lumbar.x + 11, lumbar.y];

    // 1. Rear arm (`后臂`: loaded wash stroke)
    stroke(ctx, [[shL.x, shL.y], [elL.x, elL.y], [wrL.x, wrL.y]], LOAD(11, 0.38, [0, 1], { dry: 0.5, color: inkCol }));

    // 2. Lower legs & boots below hem
    for (const [ank, toe] of [
      [ankleL, toeL],
      [ankleR, toeR],
    ]) {
      stroke(ctx, [[ank.x, -22], [ank.x, ank.y]], { w: 3.4, tone: TONE.nong, dry: 0.38, prof: 'even', color: inkCol });
      stroke(ctx, [[ank.x - 3, ank.y], [toe.x + 2, toe.y]], { w: 4.4, tone: TONE.jiao, dry: 0.22, prof: 'nail', color: inkCol });
    }

    // 3. Xieyi Robe (`一块清墨打底 + 背一笔侧锋重墨 + 前一笔侧锋淡墨 + 干笔衣褶`)
    drawInkMass(ctx, [nape, chestF, fw, hemF, [(hemB[0] + hemF[0]) * 0.5, -5], hemB, bw], {
      tone: 0.21,
      color: inkCol,
      jitter: 2.0,
      seed: 31,
    });
    stroke(ctx, [nape, bw, hemB], LOAD(14, 0.78, [-1, 0], { dry: 0.42, color: inkCol, seed: 32 }));
    stroke(ctx, [chestF, fw, hemF], LOAD(10, 0.55, [1, 0], { dry: 0.48, color: inkCol, seed: 33 }));
    stroke(ctx, [[thorax.x, thorax.y + 8], [lumbar.x, lumbar.y + 4], [(hemB[0] + hemF[0]) * 0.45, -7]], {
      w: 2.0,
      tone: TONE.zhong,
      dry: 0.72,
      prof: 'tip',
      color: inkCol,
    });

    // 4. Sash & Scabbard + Vermilion Sword Tassel (`朱砂剑穗`)
    stroke(ctx, [[bw[0] - 2, bw[1] - 2], [lumbar.x, lumbar.y - 3], [fw[0] + 2, fw[1] - 2]], {
      w: 5.0,
      tone: TONE.jiao,
      dry: 0.3,
      prof: 'nail',
      color: inkCol,
    });
    if (state.waistSword || state.heldProp === 'sword') {
      const gx = lumbar.x + 12;
      const gy = lumbar.y + 2;
      stroke(ctx, [[gx + 16, gy - 14], [gx, gy], [gx - 56, gy + 64]], {
        w: 3.4,
        tone: TONE.zhong,
        dry: 0.32,
        prof: 'even',
        color: inkCol,
      });
      // Vermilion tassel (`一点朱砂破墨`)
      stroke(
        ctx,
        [
          [gx + 16, gy - 14],
          [gx + 18 - breeze * 0.9, gy + 2],
          [gx + 15 - breeze * 1.8, gy + 18],
        ],
        { w: 2.6, tone: 0.92, dry: 0.32, prof: 'brush', color: INK_PALETTE.zhuSha }
      );
    }

    // 5. Foreground Wide Sleeve (`一块清墨 + 一笔含墨袖底 + 袖口焦墨`)
    const droop = [lerp(elR.x, wrR.x, 0.58), Math.max(elR.y, wrR.y) + 20];
    drawInkMass(
      ctx,
      [[shR.x - 3, shR.y - 2], [elR.x, elR.y - 3], [wrR.x, wrR.y - 3], [wrR.x + 2, wrR.y + 8], droop, [elR.x - 2, elR.y + 8]],
      { tone: 0.16, color: inkCol, jitter: 1.5, seed: 35 }
    );
    stroke(ctx, [[shR.x, shR.y], [elR.x, elR.y + 2], [wrR.x, wrR.y]], LOAD(10.5, 0.52, [0, 1], { dry: 0.45, color: inkCol }));
    stroke(ctx, [[elR.x - 1, elR.y + 6], droop, [wrR.x + 1, wrR.y + 8]], LOAD(5.2, 0.7, [0, 1], { dry: 0.5, prof: 'tip', color: inkCol }));

    // Held Prop in Xieyi mode
    if (state.heldProp === 'sword') {
      const ang = skel.aR3 - Math.PI * 0.5 + Math.sin(state.swordSlash * Math.PI) * 0.75;
      stroke(
        ctx,
        [[wrR.x, wrR.y], [wrR.x + Math.cos(ang) * 98, wrR.y + Math.sin(ang) * 98]],
        { w: 2.6, tone: TONE.jiao, dry: 0.15, prof: 'tip', color: inkCol }
      );
    } else if (state.heldProp === 'rod') {
      stroke(ctx, rodNodes.map((n) => [n.x, n.y]), { w: 3.4, tone: TONE.jiao, dry: 0.25, prof: 'tip', color: inkCol });
    } else if (state.heldProp === 'cup') {
      drawInkBlot(ctx, wrR.x + 8, wrR.y - 3, 5.5, TONE.jiao, 0, 0.65, 91, inkCol);
    }

    // 6. Head, Conical Hat / Topknot & Ribbon
    const hc = [headTop.x, (headTop.y + neckBase.y) * 0.5];
    drawInkMass(
      ctx,
      [[hc[0] - 6, hc[1] - 9], [hc[0] + 7, hc[1] - 8], [hc[0] + 6, hc[1] + 8], [hc[0] - 5, hc[1] + 8]],
      { tone: 0.14, color: inkCol, jitter: 0.8, seed: 37 }
    );
    stroke(ctx, [[hc[0] + 5, hc[1] - 7], [hc[0] + 7, hc[1] + 1], [hc[0] + 4, hc[1] + 8]], {
      w: 1.8,
      tone: TONE.nong,
      dry: 0.35,
      prof: 'tip',
      color: inkCol,
    });
    if (state.hat === 'bamboo') {
      const ap = [headTop.x - 2, headTop.y - 14];
      const bl = [headTop.x - 36, headTop.y + 4];
      const br = [headTop.x + 38, headTop.y + 5];
      drawInkMass(ctx, [ap, bl, [headTop.x, headTop.y + 7], br], { tone: 0.52, color: inkCol, jitter: 1.5, seed: 38 });
      stroke(ctx, [ap, bl], { w: 3.4, tone: TONE.jiao, dry: 0.5, prof: 'nail', color: inkCol });
      stroke(ctx, [ap, br], { w: 3.2, tone: TONE.jiao, dry: 0.52, prof: 'nail', color: inkCol });
      stroke(ctx, [bl, [headTop.x, headTop.y + 6], br], { w: 2.8, tone: TONE.jiao, dry: 0.42, prof: 'tip', color: inkCol });
    } else {
      stroke(ctx, [[headTop.x - 1, headTop.y + 2], [headTop.x - 1, headTop.y - 13]], {
        w: 7.0,
        tone: TONE.jiao,
        dry: 0.25,
        prof: 'cone',
        color: inkCol,
      });
    }
    stroke(ctx, [[headTop.x - 5, headTop.y + 4], [hairB1.x, hairB1.y], [hairB2.x, hairB2.y], [hairB3.x, hairB3.y]], {
      w: 2.1,
      tone: TONE.zhong,
      dry: 0.45,
      prof: 'tip',
      color: inkCol,
    });
  }

  function skinInkCharacter(ctx, skel, state, t = 0) {
    if (state.view === 'front' || state.view === 'back') {
      skinXieyiFrontOrBack(ctx, skel, state, t);
      return;
    }
    if (state.renderMode === 'xieyi') {
      skinXieyiSide(ctx, skel, state, t);
      return;
    }
    const {
      breeze,
      pelvis,
      lumbar,
      thorax,
      neckBase,
      shL,
      elL,
      wrL,
      handTipL,
      shR,
      elR,
      wrR,
      handTipR,
      hipL,
      kneeL,
      ankleL,
      heelL,
      toeL,
      hipR,
      kneeR,
      ankleR,
      heelR,
      toeR,
      slMidL,
      slTipL,
      slMidR,
      slTipR,
      trainB1,
      trainB2,
      trainTip,
      hairB1,
      hairB2,
      hairB3,
      sashB1,
      sashB2,
      sashB3,
      rodNodes,
      aThorax,
      aHead,
      aL3,
      aR2,
      aR3,
    } = skel;
    const inkStroke = state.strokeColor;

    // Blend any passed pigment with luminous ivory-white so the figure preserves clean Baimiao aesthetic
    const robeTopCol = state.robeColor === '#FFFFFF' ? '#FFFFFF' : mixHex('#FFFFFF', state.robeColor, 0.22);
    const robeBotCol = state.robeColor === '#FFFFFF' ? '#F2EFE9' : mixHex('#F2EFE9', state.robeColor, 0.34);
    const innerCol = mixHex('#ECE7DC', state.robeColor, 0.15);

    // 0. Subtle ground contact shadow
    ctx.save();
    ctx.scale(1.0, 0.2);
    const sh = ctx.createRadialGradient(0, 0, 2, 0, 0, 46);
    sh.addColorStop(0.0, rgba(INK_PALETTE.inkJiao, 0.26));
    sh.addColorStop(1.0, rgba(INK_PALETTE.inkJiao, 0.0));
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 1. Flowing Nape Hair Ribbon (`发带三段副骨骼链`: headTop -> hairB1 -> hairB2 -> hairB3)
    stroke(
      ctx,
      [
        [skel.headTop.x - 4, skel.headTop.y + 4],
        [hairB1.x, hairB1.y],
        [hairB2.x, hairB2.y],
        [hairB3.x, hairB3.y],
      ],
      { w: 2.1, tone: 0.88, dry: 0.32, prof: 'tip', color: inkStroke, seed: 71 }
    );

    // 2. Optional Waist Sword Scabbard (`腰间佩剑`, anchored to `lumbar` bone)
    if (state.waistSword) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lumbar.x + 15, lumbar.y + 6);
      ctx.lineTo(lumbar.x - 66, lumbar.y + 84);
      ctx.lineTo(lumbar.x - 70, lumbar.y + 86);
      ctx.lineTo(lumbar.x - 68, lumbar.y + 80);
      ctx.lineTo(lumbar.x + 12, lumbar.y + 2);
      ctx.closePath();
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = rgba(inkStroke, 0.86);
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Sword Hilt & Guard at right hip
      ctx.beginPath();
      ctx.moveTo(lumbar.x + 14, lumbar.y + 4);
      ctx.lineTo(lumbar.x + 32, lumbar.y - 14);
      ctx.strokeStyle = rgba(inkStroke, 0.95);
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(lumbar.x + 10, lumbar.y);
      ctx.lineTo(lumbar.x + 18, lumbar.y + 8);
      ctx.lineWidth = 2.0;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Left Wide White Sleeve (`左广袖`, drawn behind torso: Layer 3)
    // Anchored to `shL -> elL -> wrL` & drape chain `slMidL -> slTipL`
    ctx.beginPath();
    ctx.moveTo(shL.x - 2, shL.y + 2);
    ctx.bezierCurveTo(elL.x - 4, elL.y - 2, wrL.x - 3, wrL.y - 3, wrL.x, wrL.y);
    ctx.bezierCurveTo(slMidL.x - 4, slMidL.y, slTipL.x - 3, slTipL.y, slTipL.x, slTipL.y);
    ctx.bezierCurveTo(slTipL.x + 6, slTipL.y + 6, slMidL.x + 10, slMidL.y + 4, elL.x + 8, elL.y + 16);
    ctx.bezierCurveTo(elL.x + 6, elL.y + 18, shL.x + 3, shL.y + 22, shL.x - 1, shL.y + 16);
    ctx.closePath();
    ctx.fillStyle = robeTopCol;
    ctx.fill();
    ctx.strokeStyle = rgba(inkStroke, 0.45);
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Calligraphic variable-width brush strokes along left sleeve contour (`提按顿挫衣纹`)
    stroke(
      ctx,
      [
        [shL.x - 2, shL.y + 2],
        [elL.x - 3, elL.y - 1],
        [wrL.x, wrL.y],
        [slMidL.x - 2, slMidL.y],
        [slTipL.x, slTipL.y],
      ],
      { w: 2.2, tone: 0.9, dry: 0.24, prof: 'brush', color: inkStroke, seed: 73 }
    );
    stroke(
      ctx,
      [
        [slTipL.x, slTipL.y],
        [slMidL.x + 7, slMidL.y + 4],
        [elL.x + 7, elL.y + 16],
        [shL.x - 1, shL.y + 16],
      ],
      { w: 2.4, tone: 0.88, dry: 0.28, prof: 'nail', color: inkStroke, seed: 74 }
    );

    // Left Sleeve fold lines & hand hint
    stroke(
      ctx,
      [
        [wrL.x, wrL.y],
        [slMidL.x + 3, slMidL.y],
        [slTipL.x, slTipL.y],
      ],
      { w: 1.6, tone: 0.72, dry: 0.35, prof: 'tip', color: inkStroke, seed: 75 }
    );

    ctx.beginPath();
    ctx.moveTo(wrL.x, wrL.y + 1);
    ctx.lineTo(handTipL.x, handTipL.y);
    ctx.strokeStyle = rgba(inkStroke, 0.88);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 4. Articulated Cloud-Toe Shoes (`左右足骨与云头履`: ankleL -> heelL/toeL, ankleR -> heelR/toeR)
    const drawCloudShoe = (heel, ankle, toe, isFront) => {
      ctx.save();
      const shoeHeelY = Math.max(0, ankle.y + 3);
      const shoeToeY = Math.max(0, toe.y);
      ctx.beginPath();
      ctx.moveTo(heel.x, shoeHeelY);
      ctx.lineTo(toe.x + 3, shoeToeY);
      // Upturned cloud-toe tip (`唐宋翘头履尖`)
      ctx.quadraticCurveTo(toe.x + 7, shoeToeY - 5, toe.x + 2, shoeToeY - 6);
      ctx.quadraticCurveTo(ankle.x + 3, ankle.y - 2, heel.x, shoeHeelY - 4);
      ctx.closePath();
      ctx.fillStyle = isFront ? '#FFFFFF' : innerCol;
      ctx.fill();
      ctx.strokeStyle = rgba(inkStroke, isFront ? 0.92 : 0.78);
      ctx.lineWidth = 1.55;
      ctx.stroke();
      ctx.restore();
    };
    drawCloudShoe(heelL, ankleL, toeL, false);
    drawCloudShoe(heelR, ankleR, toeR, true);

    // 5. Main Lower Robe Skirt & Flowing Train (`修长白袍下摆与飘逸衣摆`)
    const robeGrad = ctx.createLinearGradient(0, lumbar.y, 0, 0);
    robeGrad.addColorStop(0.0, robeTopCol);
    robeGrad.addColorStop(0.65, '#FCFBF9');
    robeGrad.addColorStop(1.0, robeBotCol);

    const minAnkleX = Math.min(ankleL.x, ankleR.x);
    const maxAnkleX = Math.max(ankleL.x, ankleR.x);
    const backHemX = minAnkleX - 13 - breeze * 0.4;
    const frontHemX = maxAnkleX + 13 - breeze * 0.2;

    ctx.beginPath();
    ctx.moveTo(lumbar.x - 11, lumbar.y);
    ctx.bezierCurveTo(
      Math.min(hipL.x, hipR.x) - 12,
      hipL.y + 36,
      Math.min(kneeL.x, kneeR.x) - 13,
      kneeL.y + 18,
      backHemX,
      -6
    );
    ctx.bezierCurveTo(backHemX + 6, -5, minAnkleX, -5, (backHemX + frontHemX) * 0.5, -5);
    ctx.bezierCurveTo(maxAnkleX, -5, frontHemX - 6, -5, frontHemX, -6);
    ctx.bezierCurveTo(
      Math.max(kneeL.x, kneeR.x) + 13,
      kneeR.y + 18,
      Math.max(hipL.x, hipR.x) + 12,
      hipR.y + 36,
      lumbar.x + 11,
      lumbar.y
    );
    ctx.closePath();
    ctx.fillStyle = robeGrad;
    ctx.fill();
    ctx.strokeStyle = rgba(inkStroke, 0.42);
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Subtle internal Po-Mo wash fold inside lower robe (`衣褶淡墨晕染`)
    drawInkMass(
      ctx,
      [
        [lumbar.x - 8, lumbar.y + 8],
        [Math.min(kneeL.x, kneeR.x) - 8, kneeL.y + 16],
        [backHemX + 4, -6],
        [(backHemX + frontHemX) * 0.42, -6],
        [lumbar.x, lumbar.y + 18],
      ],
      { tone: 0.065, color: inkStroke, jitter: 1.4, seed: 76, wetRim: false }
    );

    // Calligraphic pressurized strokes for back & front robe contours (`吴带当风提按线`)
    stroke(
      ctx,
      [
        [lumbar.x - 11, lumbar.y],
        [Math.min(hipL.x, hipR.x) - 11, hipL.y + 32],
        [Math.min(kneeL.x, kneeR.x) - 11, kneeL.y + 18],
        [backHemX, -6],
      ],
      { w: 2.5, tone: 0.94, dry: 0.24, prof: 'nail', color: inkStroke, seed: 77 }
    );
    stroke(
      ctx,
      [
        [lumbar.x + 11, lumbar.y],
        [Math.max(hipL.x, hipR.x) + 11, hipR.y + 32],
        [Math.max(kneeL.x, kneeR.x) + 11, kneeR.y + 18],
        [frontHemX, -6],
      ],
      { w: 2.35, tone: 0.92, dry: 0.26, prof: 'brush', color: inkStroke, seed: 78 }
    );
    stroke(
      ctx,
      [
        [backHemX, -6],
        [(backHemX + frontHemX) * 0.5, -5],
        [frontHemX, -6],
      ],
      { w: 2.1, tone: 0.9, dry: 0.3, prof: 'even', color: inkStroke, seed: 79 }
    );

    // Overlapping Flowing Skirt Train (`贴合后侧袍边的雅致叠层`: lumbar -> trainB1 -> trainB2 -> trainTip)
    ctx.beginPath();
    ctx.moveTo(lumbar.x - 10, lumbar.y + 4);
    ctx.bezierCurveTo(trainB1.x - 2, trainB1.y, trainB2.x - 2, trainB2.y, trainTip.x, trainTip.y);
    ctx.bezierCurveTo(
      trainTip.x + 4,
      trainTip.y + 1,
      trainTip.x + 8,
      trainTip.y,
      trainTip.x + 12,
      trainTip.y - 1
    );
    ctx.bezierCurveTo(trainB2.x + 5, trainB2.y + 2, trainB1.x + 4, trainB1.y + 2, lumbar.x - 4, lumbar.y + 6);
    ctx.closePath();
    ctx.fillStyle = robeTopCol;
    ctx.fill();
    stroke(
      ctx,
      [
        [lumbar.x - 10, lumbar.y + 4],
        [trainB1.x - 1, trainB1.y],
        [trainB2.x - 1, trainB2.y],
        [trainTip.x, trainTip.y],
      ],
      { w: 2.0, tone: 0.88, dry: 0.28, prof: 'tip', color: inkStroke, seed: 80 }
    );

    // Calligraphic Pleat Lines inside the tall robe
    stroke(
      ctx,
      [
        [lumbar.x - 3, lumbar.y + 10],
        [hipL.x - 3, kneeL.y - 8],
        [kneeL.x - 5, kneeL.y + 18],
        [ankleL.x - 4, -6],
      ],
      { w: 1.55, tone: 0.72, dry: 0.38, prof: 'tip', color: inkStroke, seed: 81 }
    );
    stroke(
      ctx,
      [
        [lumbar.x + 3, lumbar.y + 12],
        [hipR.x + 3, kneeR.y - 8],
        [kneeR.x + 4, kneeR.y + 18],
        [ankleR.x + 4, -6],
      ],
      { w: 1.55, tone: 0.72, dry: 0.38, prof: 'tip', color: inkStroke, seed: 82 }
    );

    // 6. Upper Torso & Crossed Collar (`交领右衽白袍上身`, skinned across `lumbar -> thorax -> neckBase`)
    ctx.beginPath();
    ctx.moveTo(shL.x, shL.y);
    ctx.bezierCurveTo(thorax.x - 16, thorax.y - 4, lumbar.x - 16, lumbar.y - 18, lumbar.x - 12, lumbar.y + 2);
    ctx.lineTo(lumbar.x + 12, lumbar.y + 2);
    ctx.bezierCurveTo(lumbar.x + 15, lumbar.y - 18, thorax.x + 15, thorax.y - 4, shR.x, shR.y);
    ctx.closePath();
    ctx.fillStyle = robeTopCol;
    ctx.fill();
    ctx.strokeStyle = rgba(inkStroke, 0.5);
    ctx.lineWidth = 1.15;
    ctx.stroke();
    stroke(
      ctx,
      [
        [shL.x, shL.y],
        [thorax.x - 14, thorax.y - 2],
        [lumbar.x - 12, lumbar.y + 2],
      ],
      { w: 2.3, tone: 0.92, dry: 0.22, prof: 'brush', color: inkStroke, seed: 83 }
    );
    stroke(
      ctx,
      [
        [shR.x, shR.y],
        [thorax.x + 13, thorax.y - 2],
        [lumbar.x + 12, lumbar.y + 2],
      ],
      { w: 2.3, tone: 0.92, dry: 0.22, prof: 'brush', color: inkStroke, seed: 84 }
    );

    // Inner Crossed Collar (`多层交领`)
    ctx.beginPath();
    ctx.moveTo(neckBase.x - 6, neckBase.y + 1);
    ctx.lineTo(thorax.x + 3, thorax.y + 4);
    ctx.lineTo(neckBase.x + 8, neckBase.y + 2);
    ctx.closePath();
    ctx.fillStyle = innerCol;
    ctx.fill();
    ctx.strokeStyle = rgba(inkStroke, 0.88);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    stroke(
      ctx,
      [
        [neckBase.x - 8, neckBase.y + 3],
        [thorax.x, thorax.y - 4],
        [lumbar.x + 8, lumbar.y - 12],
      ],
      { w: 2.1, tone: 0.92, dry: 0.2, prof: 'nail', color: inkStroke, seed: 85 }
    );

    // 7. Waist Sash & Flowing Ribbon (`束腰与三段腰带骨骼`: `lumbar -> sashB1 -> sashB2 -> sashB3`)
    ctx.beginPath();
    ctx.moveTo(lumbar.x - 13, lumbar.y - 2);
    ctx.quadraticCurveTo(lumbar.x, lumbar.y + 2, lumbar.x + 13, lumbar.y - 2);
    ctx.lineTo(lumbar.x + 13, lumbar.y + 5);
    ctx.quadraticCurveTo(lumbar.x, lumbar.y + 9, lumbar.x - 13, lumbar.y + 5);
    ctx.closePath();
    ctx.fillStyle = state.sashColor === '#FFFFFF' ? '#FFFFFF' : mixHex('#FFFFFF', state.sashColor, 0.75);
    ctx.fill();
    ctx.strokeStyle = rgba(inkStroke, 0.9);
    ctx.lineWidth = 1.65;
    ctx.stroke();

    stroke(
      ctx,
      [
        [lumbar.x - 6, lumbar.y + 4],
        [sashB1.x, sashB1.y],
        [sashB2.x, sashB2.y],
        [sashB3.x, sashB3.y],
      ],
      { w: 2.0, tone: 0.86, dry: 0.3, prof: 'tip', color: inkStroke, seed: 86 }
    );

    // 8. Slender Neck & Faceless Head (`修长颈部与无脸留白轮廓`, driven by `neckBase -> headPivot -> headTop -> topKnotTip`)
    ctx.save();
    ctx.translate(neckBase.x, neckBase.y);
    ctx.rotate(aHead);

    // Neck (`neckPath`)
    ctx.beginPath();
    ctx.moveTo(-4, -10);
    ctx.lineTo(-5, 2);
    ctx.lineTo(5, 3);
    ctx.lineTo(4, -11);
    ctx.closePath();
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = rgba(inkStroke, 0.9);
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Faceless Head Contour (`无脸留白轮廓`, exact curve from li_bai_minimalist_vector_art.html)
    ctx.beginPath();
    ctx.moveTo(-5.5, -28.5);
    ctx.bezierCurveTo(-9.0, -25.0, -9.0, -15.0, -5.5, -10.0);
    ctx.bezierCurveTo(-2.0, -6.5, 5.0, -7.0, 8.5, -11.5);
    ctx.bezierCurveTo(11.5, -16.0, 12.0, -24.0, 7.2, -29.5);
    ctx.bezierCurveTo(3.2, -33.0, -2.5, -32.0, -5.5, -28.5);
    ctx.closePath();
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = rgba(inkStroke, 0.95);
    ctx.lineWidth = 1.9;
    ctx.stroke();

    // Minimalist Hairline wrapping back/top of head (`headHair`)
    ctx.beginPath();
    ctx.moveTo(-8.2, -16.0);
    ctx.bezierCurveTo(-10.5, -23.0, -8.5, -32.0, -1.0, -33.5);
    ctx.bezierCurveTo(4.5, -34.2, 9.0, -31.0, 9.8, -26.5);
    ctx.bezierCurveTo(6.8, -29.8, 0.5, -30.2, -3.8, -26.5);
    ctx.bezierCurveTo(-6.5, -24.0, -7.0, -19.5, -8.2, -16.0);
    ctx.closePath();
    ctx.fillStyle = inkStroke;
    ctx.fill();

    // Temple lock (`鬓发一缕`)
    ctx.beginPath();
    ctx.moveTo(-4.2, -25.5);
    ctx.bezierCurveTo(-5.5, -17.0, -8.2, -7.0, -12.5, 4.5);
    ctx.strokeStyle = rgba(inkStroke, 0.85);
    ctx.lineWidth = 1.25;
    ctx.stroke();

    if (state.hat === 'bamboo') {
      // Sleek Minimalist Baimiao Conical Bamboo Hat (`极简白描斗笠`)
      ctx.beginPath();
      ctx.moveTo(-38, -24);
      ctx.quadraticCurveTo(0, -45, 38, -24);
      ctx.quadraticCurveTo(0, -29, -38, -24);
      ctx.closePath();
      ctx.fillStyle = '#F2ECE1';
      ctx.fill();
      ctx.strokeStyle = rgba(inkStroke, 0.95);
      ctx.lineWidth = 1.9;
      ctx.stroke();
      ctx.strokeStyle = rgba(inkStroke, 0.45);
      ctx.lineWidth = 1.0;
      for (const rx of [-20, 0, 20]) {
        ctx.beginPath();
        ctx.moveTo(0, -36);
        ctx.lineTo(rx, -26);
        ctx.stroke();
      }
    } else {
      // High Slender Topknot (`修长发髻`) & White Jade Hairpin (`白玉簪`) from li_bai reference
      ctx.beginPath();
      ctx.moveTo(-4.6, -33.0);
      ctx.bezierCurveTo(-6.4, -41.0, -4.2, -47.2, -0.2, -47.2);
      ctx.bezierCurveTo(3.4, -47.2, 4.8, -41.0, 3.0, -33.5);
      ctx.closePath();
      ctx.fillStyle = inkStroke;
      ctx.fill();

      ctx.save();
      ctx.translate(0, -35.5);
      ctx.rotate(-0.14);
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = inkStroke;
      ctx.lineWidth = 1.3;
      ctx.fillRect(-4.5, -1.2, 9.0, 2.4);
      ctx.strokeRect(-4.5, -1.2, 9.0, 2.4);
      ctx.beginPath();
      ctx.moveTo(-9.5, 0);
      ctx.lineTo(9.5, 0);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    // Exhaled Sigh Mist (`叹息白气`, curls out from before the faceless head when sighing)
    if (state.sighMist > 0.02) {
      const sp = state.sighProgress;
      const sxm = 12 + sp * 16;
      const sym = -14 - sp * 10;
      drawCalligraphicStroke(
        ctx,
        [
          [10, -14],
          [sxm + 8, sym - 4],
          [sxm + 22 + breeze * 0.4, sym - 14],
          [sxm + 36 + breeze * 0.8, sym - 28],
        ],
        { width: 5.5 * state.sighMist, color: INK_PALETTE.geFen, alpha: 0.72 * state.sighMist, feibai: 0.4 }
      );
    }
    ctx.restore();

    // 9. Right Foreground Wide White Sleeve (`右广袖`, drawn in front: Layer 9)
    // Non-self-intersecting articulated drape across all elbow flexion angles (including V-bent `drink`)
    const isElbowFoldedIn = wrR.y < elR.y - 2;
    const tipY = isElbowFoldedIn ? Math.max(slTipR.y, elR.y + 24) : slTipR.y;
    ctx.beginPath();
    ctx.moveTo(shR.x, shR.y);
    if (isElbowFoldedIn) {
      // V-bent drinking arm (`shR -> low elR -> raised wrR`):
      // Inner sleeve crease dips gently toward the elbow crease then rises to `wrR`,
      // while the wide sleeve cuff hangs naturally below `elR` to `slTipR`
      const creaseX = lerp(shR.x, elR.x, 0.45);
      const creaseY = Math.max(shR.y, wrR.y) + 6;
      ctx.quadraticCurveTo(creaseX, creaseY, wrR.x - 2, wrR.y - 2);
      ctx.lineTo(wrR.x + 4, wrR.y + 2);
      ctx.bezierCurveTo(
        Math.max(elR.x + 8, wrR.x + 10),
        lerp(wrR.y, elR.y, 0.55),
        elR.x + 9,
        elR.y + 12,
        slTipR.x,
        tipY
      );
      ctx.bezierCurveTo(
        slTipR.x - 10,
        tipY + 4,
        shR.x + 4,
        elR.y + 18,
        shR.x - 2,
        shR.y + 16
      );
    } else {
      ctx.bezierCurveTo(elR.x, elR.y - 3, wrR.x - 3, wrR.y - 4, wrR.x, wrR.y - 3);
      ctx.bezierCurveTo(wrR.x + 3, wrR.y + 3, slMidR.x + 4, slMidR.y, slTipR.x, slTipR.y);
      ctx.bezierCurveTo(slTipR.x - 3, slTipR.y + 6, elR.x + 3, elR.y + 22, elR.x - 2, elR.y + 16);
      ctx.bezierCurveTo(elR.x - 6, elR.y + 12, shR.x - 2, shR.y + 18, shR.x - 2, shR.y + 14);
    }
    ctx.closePath();
    ctx.fillStyle = robeTopCol;
    ctx.fill();
    ctx.strokeStyle = rgba(inkStroke, 0.44);
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Subtle internal sleeve shadow wash (`袖肚淡墨晕染`)
    drawInkMass(
      ctx,
      [
        [elR.x - 1, elR.y + 4],
        [wrR.x + 2, wrR.y + 2],
        [slTipR.x - 1, tipY - 1],
        [elR.x + 1, elR.y + 14],
      ],
      { tone: 0.055, color: inkStroke, jitter: 1.2, seed: 87, wetRim: false }
    );

    // Calligraphic variable-width brush strokes along right sleeve contour (`提按顿挫右广袖`)
    stroke(
      ctx,
      isElbowFoldedIn
        ? [
            [shR.x, shR.y],
            [lerp(shR.x, elR.x, 0.45), Math.max(shR.y, wrR.y) + 5],
            [wrR.x - 1, wrR.y - 1],
          ]
        : [
            [shR.x, shR.y],
            [elR.x, elR.y - 2],
            [wrR.x, wrR.y - 2],
          ],
      { w: 2.35, tone: 0.94, dry: 0.22, prof: 'brush', color: inkStroke, seed: 88 }
    );
    stroke(
      ctx,
      [
        [wrR.x + 3, wrR.y + 1],
        [isElbowFoldedIn ? elR.x + 8 : slMidR.x + 3, isElbowFoldedIn ? elR.y + 10 : slMidR.y],
        [slTipR.x, tipY],
        [elR.x - 1, elR.y + 16],
        [shR.x - 2, shR.y + 15],
      ],
      { w: 2.5, tone: 0.92, dry: 0.26, prof: 'nail', color: inkStroke, seed: 89 }
    );

    // Right Sleeve opening fold curves (parallel, never crossing in an X)
    stroke(
      ctx,
      [
        [wrR.x + 3, wrR.y + 2],
        [isElbowFoldedIn ? elR.x + 4 : slMidR.x + 1, isElbowFoldedIn ? elR.y + 4 : slMidR.y + 3],
        [slTipR.x - 2, tipY - 2],
      ],
      { w: 1.65, tone: 0.78, dry: 0.34, prof: 'tip', color: inkStroke, seed: 90 }
    );

    if (!isElbowFoldedIn) {
      stroke(
        ctx,
        [
          [shR.x + 4, shR.y + 5],
          [elR.x + 1, elR.y + 3],
          [wrR.x - 2, wrR.y + 2],
        ],
        { w: 1.4, tone: 0.65, dry: 0.38, prof: 'tip', color: inkStroke, seed: 91 }
      );
    }

    // 10. Minimalist Right Hand & Held Prop at `wrR -> handTipR`
    ctx.save();
    ctx.translate(wrR.x, wrR.y);

    if (state.heldProp === 'cup') {
      // Cup orientation: tilts gracefully into mouth during `drink`
      const cupTilt = aThorax * 0.5 - state.handRAng * 1.05;
      ctx.rotate(cupTilt);

      // Hand hint wrapping around goblet stem
      ctx.beginPath();
      ctx.moveTo(-2, 2);
      ctx.bezierCurveTo(2, 1, 6, -1, 10, -1);
      ctx.strokeStyle = rgba(inkStroke, 0.92);
      ctx.lineWidth = 1.65;
      ctx.stroke();

      // Minimalist Tang Wine Goblet (`简笔酒盏`)
      ctx.beginPath();
      ctx.moveTo(3, -6);
      ctx.quadraticCurveTo(10, -2, 17, -7);
      ctx.bezierCurveTo(14, 1, 7, 2, 3, -6);
      ctx.closePath();
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = rgba(inkStroke, 0.95);
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(10, -1);
      ctx.lineTo(10, 5);
      ctx.moveTo(7, 5);
      ctx.lineTo(13, 5);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else if (state.heldProp === 'fan') {
      ctx.rotate(state.handRAng - 0.2);
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.arc(6, 0, 22, -1.1, 0.25);
      ctx.closePath();
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = rgba(inkStroke, 0.9);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else if (state.heldProp === 'staff') {
      ctx.beginPath();
      ctx.moveTo(6, -48);
      ctx.lineTo(10, 96);
      ctx.strokeStyle = rgba(inkStroke, 0.92);
      ctx.lineWidth = 3.2;
      ctx.stroke();
    } else if (state.heldProp === 'brush') {
      ctx.rotate(aR3 * 0.35 + 0.2);
      ctx.beginPath();
      ctx.moveTo(6, 14);
      ctx.lineTo(10, -24);
      ctx.strokeStyle = rgba(inkStroke, 0.92);
      ctx.lineWidth = 3.0;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(10, -27, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = inkStroke;
      ctx.fill();
    } else if (state.heldProp === 'scroll') {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = inkStroke;
      ctx.lineWidth = 1.5;
      ctx.fillRect(4, -12, 8, 24);
      ctx.strokeRect(4, -12, 8, 24);
    } else if (state.heldProp === 'sword') {
      ctx.rotate(aR3 - Math.PI * 0.5 + Math.sin(state.swordSlash * Math.PI) * 0.8);
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = inkStroke;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(6, -2.5);
      ctx.lineTo(108, 0);
      ctx.lineTo(6, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.rotate(aR3 - Math.PI * 0.5);
      ctx.beginPath();
      ctx.moveTo(-1, 2);
      ctx.lineTo(10, 0);
      ctx.strokeStyle = rgba(inkStroke, 0.9);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // If holding fishing rod (`rod`), draw the 4-Segment Articulated Bamboo Rod (`rodNodes[0..4]`)
    if (state.heldProp === 'rod') {
      drawCalligraphicStroke(
        ctx,
        rodNodes.map((n) => [n.x, n.y]),
        { width: 3.6, color: inkStroke, alpha: 0.94, entry: 'round', exit: 'taper', feibai: 0.1 }
      );
      // Bamboo node ticks (`竹节`) at internal segment joints
      ctx.strokeStyle = rgba(inkStroke, 0.92);
      ctx.lineWidth = 2.0;
      for (let i = 1; i <= 3; i++) {
        const rn = rodNodes[i];
        ctx.beginPath();
        ctx.moveTo(rn.x - 1.5, rn.y - 3.5);
        ctx.lineTo(rn.x + 1.5, rn.y + 3.5);
        ctx.stroke();
      }
    }
  }

  return createPuppet2D({
    ...opts,
    skin: skinInkCharacter,
  });
}

export { createPuppet2D, drawSkeleton2D } from '../../engine/puppet2d.js';

// ============================================================================
// TIER 4A+ · WUXIA DRAMATIC KEYFRAME & PO-MO ACTION PRIMITIVES (`武侠高张力造型与破墨特效`)
// ============================================================================

/**
 * Renders a razor-sharp crescent/diagonal Wuxia blade arc & Po-Mo ink-cleaving fissure
 * (`凌厉弧形刀光 / 剑气破墨裂痕：焦墨飞白 + 留白切口`).
 */
export function drawBladeArcSlash(ctx, cx, cy, opts = {}) {
  const {
    radiusX = 540,
    radiusY = 235,
    tilt = -0.36,
    startAngle = -2.45,
    endAngle = 0.58,
    thickness = 48,
    progress = 1.0,
    bladeColor = INK_PALETTE.geFen,
    inkColor = INK_PALETTE.inkJiao,
    accentColor = INK_PALETTE.zhuSha,
    seed = 409,
  } = opts;

  const u = clamp(progress, 0, 1);
  if (u <= 0.01) return;

  if (u > 0.04 && u < 0.38 && ctx.__inkFrame) {
    registerRuntimeCue({
      t: ctx.__inkFrame.t ?? 0,
      kind: 'blade_cleave',
      scene: ctx.__inkFrame.scene?.id || 'stage',
      label: 'blade_cleave',
      intensity: 0.98,
    });
  }

  const rng = mulberry32(seed);
  const sweepU = clamp(Math.pow(u, 0.45) * 1.18, 0, 1);
  const curEnd = lerp(startAngle, endAngle, sweepU);
  const steps = 36;
  const outerPts = [];
  const innerPts = [];
  const spinePts = [];

  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const ang = lerp(startAngle, curEnd, s);
    // Taper to needle-sharp tips at both ends of the crescent
    const env = Math.sin(Math.PI * s) ** 0.78;
    const halfW = thickness * 0.5 * env;
    const bx = Math.cos(ang) * radiusX;
    const by = Math.sin(ang) * radiusY;
    const nx = Math.cos(ang);
    const ny = Math.sin(ang);
    spinePts.push([bx, by]);
    outerPts.push([bx + nx * halfW, by + ny * halfW]);
    innerPts.push([bx - nx * halfW * 0.65, by - ny * halfW * 0.65]);
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);

  // 1. Outer flying-white (`飞白`) dry-bristle dark ink shockwave halo
  stroke(
    ctx,
    outerPts,
    LOAD(thickness * 0.92, TONE.jiao, [0, 1], {
      dry: 0.72,
      prof: 'lens',
      color: inkColor,
      seed: seed + 3,
    }),
    1.0,
    0.88
  );
  stroke(
    ctx,
    innerPts,
    {
      w: thickness * 0.42,
      tone: TONE.nong,
      dry: 0.68,
      prof: 'tip',
      color: inkColor,
      seed: seed + 7,
    },
    1.0,
    0.76
  );

  // 2. Pure negative-space clam-white cleave body (`留白切口白刃弧光`)
  ctx.beginPath();
  for (let i = 0; i < outerPts.length; i++) {
    const [px, py] = outerPts[i];
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  for (let i = innerPts.length - 1; i >= 0; i--) {
    const [px, py] = innerPts[i];
    ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.save();
  ctx.shadowColor = rgba(bladeColor, 0.95);
  ctx.shadowBlur = 22;
  ctx.fillStyle = rgba(bladeColor, 0.98);
  ctx.fill();
  ctx.restore();

  // 3. Razor-sharp charcoal-ink (`焦墨`) blade spine & flying-white speed fissures inside the cleave
  stroke(
    ctx,
    spinePts,
    {
      w: Math.max(3.2, thickness * 0.12),
      tone: TONE.jiao,
      dry: 0.58,
      prof: 'nail',
      color: inkColor,
      seed: seed + 19,
    },
    1.0,
    0.92
  );

  // 4. Tangential sword-qi air-cleave streaks & shattering ink splinters
  for (let k = 0; k < 14; k++) {
    const idx = Math.min(spinePts.length - 1, Math.floor(rng() * spinePts.length));
    const [px, py] = spinePts[idx];
    const len = 45 + rng() * 110;
    const offY = (rng() - 0.5) * thickness * 1.35;
    stroke(
      ctx,
      [
        [px - len * 0.4, py + offY],
        [px + len * 0.6, py + offY + (rng() - 0.5) * 14],
      ],
      {
        w: 1.8 + rng() * 2.6,
        tone: k % 4 === 0 ? 0.85 : TONE.jiao,
        dry: 0.65,
        prof: 'cone',
        color: k % 4 === 0 ? accentColor : k % 2 === 0 ? bladeColor : inkColor,
        seed: seed + 40 + k,
      },
      1.0,
      0.85
    );
  }

  ctx.restore();
}

/**
 * Renders an explosive Po-Mo dark ink & piercing Cinnabar Vermilion blood-ink burst
 * (`爆发性浓墨与一点刺目朱砂喷溅粒子`).
 */
export function drawBloodInkBurst(ctx, x, y, opts = {}) {
  const {
    angle = -0.38,
    spread = 0.72,
    scale = 1.0,
    progress = 1.0,
    color = INK_PALETTE.zhuSha,
    brightColor = INK_PALETTE.yinZhu,
    inkColor = INK_PALETTE.inkJiao,
    count = 36,
    seed = 521,
  } = opts;

  const u = clamp(progress, 0, 1);
  if (u <= 0.01) return;

  if (u > 0.04 && u < 0.36 && ctx.__inkFrame) {
    registerRuntimeCue({
      t: ctx.__inkFrame.t ?? 0,
      kind: 'blood_splatter',
      scene: ctx.__inkFrame.scene?.id || 'stage',
      label: 'blood_splatter',
      intensity: 0.96,
    });
  }

  const rng = mulberry32(seed);
  const burstK = clamp(Math.pow(u, 0.38) * 1.15, 0, 1);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // 1. Capillary wet Cinnabar & Po-Mo bloom (`朱砂宿墨水晕`) on Xuan paper
  const haloR = 115 * (0.55 + 0.45 * burstK);
  const hg = ctx.createRadialGradient(0, 0, 4, 0, 0, haloR);
  hg.addColorStop(0.0, rgba(color, 0.46));
  hg.addColorStop(0.45, rgba(color, 0.18));
  hg.addColorStop(1.0, rgba(color, 0));
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, 0, haloR, 0, Math.PI * 2);
  ctx.fill();

  // 2. Dark charcoal-ink (`焦墨`) rupture core mass
  const corePts = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = (22 + rng() * 28) * burstK;
    corePts.push([Math.cos(a) * r, Math.sin(a) * r * 0.75]);
  }
  drawInkMass(ctx, corePts, {
    tone: 0.78,
    color: inkColor,
    jitter: 3.5,
    seed: seed + 1,
  });

  // 3. High-velocity directional Cinnabar Vermilion slash jets (`刺目朱砂喷溅射流`)
  const nJets = 9;
  for (let j = 0; j < nJets; j++) {
    const jetAng = angle + (rng() - 0.5) * spread;
    const jetLen = (95 + rng() * 230) * burstK;
    const midLen = jetLen * 0.52;
    const bend = (rng() - 0.5) * 26;
    const jCol = j % 3 === 0 ? brightColor : j % 5 === 0 ? inkColor : color;
    stroke(
      ctx,
      [
        [Math.cos(jetAng) * 8, Math.sin(jetAng) * 8],
        [Math.cos(jetAng) * midLen - Math.sin(jetAng) * bend, Math.sin(jetAng) * midLen + Math.cos(jetAng) * bend],
        [Math.cos(jetAng) * jetLen, Math.sin(jetAng) * jetLen],
      ],
      {
        w: 6.5 + rng() * 9.5,
        tone: 0.96,
        dry: 0.32 + rng() * 0.35,
        wet: 0.65,
        prof: 'cone',
        color: jCol,
        seed: seed + 10 + j,
      },
      1.0,
      0.95
    );
  }

  // 4. Suspended arterial Cinnabar & Po-Mo ink droplets (`朱砂血墨飞沫定格`)
  for (let i = 0; i < count; i++) {
    const isCinnabar = i % 4 !== 3;
    const dAng = angle + (rng() - 0.48) * (spread * 1.45);
    const dist = (24 + Math.pow(rng(), 0.75) * 290) * burstK;
    const dx = Math.cos(dAng) * dist;
    const dy = Math.sin(dAng) * dist + (rng() - 0.35) * 28 * burstK;
    const rDot = isCinnabar ? 3.2 + rng() * 12.5 : 2.5 + rng() * 8.5;
    const dCol = isCinnabar ? (i % 2 === 0 ? brightColor : color) : inkColor;
    drawInkBlot(
      ctx,
      dx,
      dy,
      rDot,
      0.88 + rng() * 0.12,
      dAng,
      0.42 + rng() * 0.4,
      seed + 100 + i,
      dCol
    );
  }

  ctx.restore();
}

/**
 * Renders a background/midground adversary ink silhouette (`背景受创剪影倾倒溃散`):
 * looms menacingly before the strike (`collapseProgress = 0`), then cleaves along a negative-space
 * slash fissure and tilts/disperses into wet ink fragments (`collapseProgress: 0 -> 1`).
 */
export function drawStruckEnemySilhouette(ctx, x, y, opts = {}) {
  const {
    scale = 1.0,
    facing = -1,
    collapseProgress = 0.0,
    slashAngle = -0.35,
    color = INK_PALETTE.inkNong,
    fissureColor = INK_PALETTE.geFen,
    seed = 613,
  } = opts;

  const u = clamp(collapseProgress, 0, 1);
  const rng = mulberry32(seed);
  const shear = smootherstep(0, 1, u);
  const tilt = -facing * shear * 0.46;
  const splitGap = shear * 26;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // 1. Lower torso & wide martial stance (buckling as `shear` increases)
  ctx.save();
  ctx.rotate(tilt * 0.35);
  drawInkMass(
    ctx,
    [
      [-32, -88 + shear * 12],
      [34, -84 + shear * 12],
      [48 - facing * 12, -4],
      [-52 - facing * 8, -4],
    ],
    {
      tone: 0.62 * (1 - shear * 0.25),
      color,
      jitter: 2.8 + shear * 4.0,
      seed: seed + 1,
    }
  );
  stroke(
    ctx,
    [
      [-26, -86 + shear * 12],
      [-46 - facing * 8, -2],
    ],
    LOAD(14, 0.78, [-1, 0], { dry: 0.52, color, seed: seed + 2 })
  );
  stroke(
    ctx,
    [
      [28, -84 + shear * 12],
      [44 - facing * 10, -2],
    ],
    LOAD(13, 0.72, [1, 0], { dry: 0.55, color, seed: seed + 3 })
  );
  ctx.restore();

  // 2. Upper torso, head/hat & dropped weapon (shearing and tilting backward along `slashAngle`)
  ctx.save();
  const shiftX = -facing * shear * 42;
  const shiftY = -splitGap + shear * 18;
  ctx.translate(shiftX, shiftY);
  ctx.rotate(tilt);

  drawInkMass(
    ctx,
    [
      [-38, -172],
      [40, -168],
      [32, -88],
      [-30, -90],
    ],
    {
      tone: 0.68 * (1 - shear * 0.22),
      color,
      jitter: 2.6 + shear * 4.5,
      seed: seed + 5,
    }
  );

  // Conical bamboo hat / warrior helmet flying off
  ctx.save();
  ctx.translate(-facing * shear * 28, -184 - shear * 16);
  ctx.rotate(tilt * 1.4);
  drawInkMass(
    ctx,
    [
      [0, -22],
      [-42, 4],
      [0, 8],
      [42, 4],
    ],
    { tone: 0.76, color, jitter: 2.0, seed: seed + 8 }
  );
  ctx.restore();

  // Enemy weapon flying/dropping from hand
  const wpX = facing * 42 + shiftX * 0.3;
  const wpY = -132 + shear * 45;
  ctx.save();
  ctx.translate(wpX, wpY);
  ctx.rotate(facing * 0.55 + tilt * 1.8);
  stroke(
    ctx,
    [
      [-18, 0],
      [88 * facing, -24],
    ],
    { w: 3.8, tone: 0.84, dry: 0.35, prof: 'cone', color, seed: seed + 12 }
  );
  ctx.restore();
  ctx.restore();

  // 3. White negative-space cleave line & dispersing Po-Mo ink fragments when struck (`u > 0.02`)
  if (u > 0.02) {
    const fLen = 96;
    const fx0 = -Math.cos(slashAngle) * fLen;
    const fy0 = -92 - Math.sin(slashAngle) * fLen;
    const fx1 = Math.cos(slashAngle) * fLen;
    const fy1 = -92 + Math.sin(slashAngle) * fLen;
    stroke(
      ctx,
      [
        [fx0, fy0],
        [0, -92],
        [fx1, fy1],
      ],
      {
        w: 7.5 * (1 - 0.35 * shear),
        tone: 0.94,
        dry: 0.2,
        prof: 'lens',
        color: fissureColor,
        seed: seed + 21,
      }
    );

    // Dispersing ink blots (`破墨溃散碎片`)
    for (let k = 0; k < 12; k++) {
      const ang = rng() * Math.PI * 2;
      const dist = (18 + rng() * 82) * shear;
      drawInkBlot(
        ctx,
        shiftX * 0.6 + Math.cos(ang) * dist,
        -115 + Math.sin(ang) * dist,
        2.5 + rng() * 6.5,
        0.72 * (1 - 0.3 * shear),
        ang,
        0.55,
        seed + 30 + k,
        k % 4 === 0 ? INK_PALETTE.zhuSha : color
      );
    }
  }

  ctx.restore();
}

/**
 * Renders a high-tension Wuxia protagonist keyframe pose (`drawWuxiaHeroPose`):
 * Breaks out of the upright `y = -6` trapezoid robe and `98px` straight stick-sword to support
 * foreshortened martial stances, wide billowing xieyi cloaks, curved Wuxia sabres (`吴钩/长刀`),
 * and 4 signature dramatic keyframes:
 *   - `'loneWalk'` (`独行/微酌`): Wind-swept profile stride with curved Wu-hook sabre & vermilion tassel.
 *   - `'thumbHilt'` (`脱剑膝前横 · 拇指推锷寸许寒光`): Low-angle half-crouch holding sword horizontally across front;
 *     thumb pushes the bronze guard open (`unsheatheFrac: 0..1`) with an icy steel glint.
 *   - `'crouchBlade'` (`十步杀一人 · 正面深蹲蓄力 -> 破空挥斩`): Frontal low-angle foreshortened deep crouch (`slashProgress: 0..1`),
 *     coiled behind horizontal scabbard then exploding into a wide 245px gleaming blade follow-through.
 *   - `'sheatheBack'` (`事了拂衣去 · 背影慢动作归鞘与远行`): Dorsal rear view (`sheatheProgress: 0..1`) guiding the long
 *     blade smoothly into the scabbard with a collar-lock glint and wide sleeve flick.
 */
export function drawWuxiaHeroPose(ctx, x, y, opts = {}) {
  const {
    pose = 'loneWalk', // 'loneWalk' | 'thumbHilt' | 'crouchBlade' | 'sheatheBack'
    scale = 1.0,
    facing = 1,
    t = 0.0,
    stridePhase = 0.0,
    unsheatheFrac = 0.0,
    slashProgress = 0.0,
    sheatheProgress = 0.0,
    withWine = false,
    inkColor = INK_PALETTE.inkJiao,
    cloakTone = TONE.nong,
    tasselColor = INK_PALETTE.zhuSha,
    bladeColor = INK_PALETTE.geFen,
    groundY = null,
    id = 'wuxiaHero',
    seed = 701,
  } = opts;

  const breeze = Math.sin(t * 2.4) * 7.5 + Math.cos(t * 1.3) * 3.5;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Subtle ground contact shadow on Xuan paper
  ctx.save();
  ctx.scale(1.0, 0.18);
  const shR = pose === 'crouchBlade' ? 95 : 64;
  const sh = ctx.createRadialGradient(0, 0, 4, 0, 0, shR);
  sh.addColorStop(0.0, rgba(inkColor, 0.32));
  sh.addColorStop(1.0, rgba(inkColor, 0.0));
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(0, 0, shR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  let bboxLocal = [-75, -210, 75, 4];

  if (pose === 'crouchBlade' || pose === 'slashBurst') {
    const sp = clamp(slashProgress, 0, 1);
    const burst = smootherstep(0.06, 0.42, sp);
    const crouchY = lerp(0, -14, burst);
    const twistX = lerp(0, 22 * facing, burst);
    bboxLocal = [-145, -185, 185, 6];

    // 1. Wide-stance planted martial boots & bent knees (`深蹲跨步双足`)
    const bootLX = -58 - burst * 12;
    const bootRX = 62 + burst * 18;
    const kneeLX = -48 - burst * 8;
    const kneeLY = -44 + crouchY * 0.4;
    const kneeRX = 52 + burst * 14;
    const kneeRY = -42 + crouchY * 0.4;

    stroke(ctx, [[kneeLX, kneeLY], [bootLX, -4], [bootLX - 14, 0]], {
      w: 11,
      tone: TONE.jiao,
      dry: 0.28,
      prof: 'nail',
      color: inkColor,
      seed: seed + 1,
    });
    stroke(ctx, [[kneeRX, kneeRY], [bootRX, -4], [bootRX + 16, 0]], {
      w: 11.5,
      tone: TONE.jiao,
      dry: 0.25,
      prof: 'nail',
      color: inkColor,
      seed: seed + 2,
    });

    // 2. Billowing wide split-hem martial cloak & robe (`泼墨侧锋大披风与分叉下摆`)
    const cloakWingL = -112 - breeze * 1.4 - burst * 34;
    const cloakWingR = 108 - breeze * 0.8 + burst * 42;
    const shY = -124 + crouchY;
    const waistY = -66 + crouchY * 0.6;

    drawInkMass(
      ctx,
      [
        [-38 + twistX, shY],
        [42 + twistX, shY],
        [cloakWingR, -28 - burst * 18],
        [bootRX - 8, -10],
        [0, waistY + 12],
        [bootLX + 8, -10],
        [cloakWingL, -22 + burst * 10],
      ],
      {
        tone: 0.56,
        color: inkColor,
        jitter: 3.4,
        seed: seed + 3,
      }
    );

    // Bold loaded side-brush strokes along left and right cloak wings
    stroke(
      ctx,
      [
        [-34 + twistX, shY + 4],
        [-74, waistY - 8],
        [cloakWingL, -22 + burst * 10],
      ],
      LOAD(24, TONE.jiao, [-1, -0.4], { dry: 0.52, prof: 'robe', color: inkColor, seed: seed + 4 })
    );
    stroke(
      ctx,
      [
        [36 + twistX, shY + 4],
        [78, waistY - 10],
        [cloakWingR, -28 - burst * 18],
      ],
      LOAD(24, TONE.jiao, [1, -0.4], { dry: 0.48, prof: 'robe', color: inkColor, seed: seed + 5 })
    );

    // Inner robe V-collar & crimson/vermilion waist sash
    stroke(
      ctx,
      [
        [-22 + twistX, shY + 6],
        [2 + twistX, waistY - 6],
        [22 + twistX, shY + 6],
      ],
      { w: 5.5, tone: 0.9, dry: 0.25, prof: 'tip', color: bladeColor, seed: seed + 6 }
    );
    stroke(
      ctx,
      [
        [-32 + twistX * 0.6, waistY],
        [34 + twistX * 0.6, waistY - 2],
        [58 + burst * 28, waistY + 18 - breeze],
      ],
      { w: 6.5, tone: 0.95, dry: 0.28, prof: 'brush', color: tasselColor, seed: seed + 7 }
    );

    // 3. Foreshortened low-pressed Bamboo Hat (`斗笠压眉大透视`)
    const hatX = twistX * 0.85;
    const hatY = -134 + crouchY + (1 - burst) * 8;
    const hatW = 76;
    drawInkMass(
      ctx,
      [
        [hatX, hatY - 34],
        [hatX - hatW, hatY + 8],
        [hatX, hatY + 18],
        [hatX + hatW, hatY + 6],
      ],
      { tone: 0.88, color: inkColor, jitter: 2.0, seed: seed + 8 }
    );
    // Crisp clam-white rim highlight on bamboo hat so silhouette pops on dark night canvas
    stroke(
      ctx,
      [
        [hatX - hatW, hatY + 8],
        [hatX, hatY - 34],
        [hatX + hatW, hatY + 6],
      ],
      { w: 3.6, tone: 0.82, dry: 0.45, prof: 'tip', color: bladeColor, seed: seed + 9 }
    );
    stroke(
      ctx,
      [
        [hatX - hatW, hatY + 8],
        [hatX, hatY + 17],
        [hatX + hatW, hatY + 6],
      ],
      { w: 4.8, tone: TONE.jiao, dry: 0.35, prof: 'nail', color: inkColor, seed: seed + 10 }
    );
    // Trailing silk hat ribbon (`缦胡缨`)
    stroke(
      ctx,
      [
        [hatX - 18, hatY - 6],
        [hatX - 65 - breeze * 1.5, hatY - 18 - burst * 16],
        [hatX - 108 - breeze * 2.2, hatY - 8 - burst * 24],
      ],
      { w: 3.4, tone: 0.92, dry: 0.38, prof: 'tip', color: tasselColor, seed: seed + 11 }
    );

    // 4. Scabbard & Coiled / Slashing Long Wuxia Blade (`横刀按鞘蓄力 -> 霜雪长刀破空`)
    if (burst < 0.15) {
      // Anticipation Hold: Horizontal scabbard across crouched chest/knees, thumb on guard
      const scabL = [-88, waistY - 16];
      const scabR = [64, waistY - 26];
      stroke(ctx, [scabL, scabR], {
        w: 9.5,
        tone: TONE.jiao,
        dry: 0.2,
        prof: 'even',
        color: inkColor,
        seed: seed + 12,
      });
      // Exposed 1-inch cold steel gleam at guard (`寸许寒光`)
      stroke(ctx, [scabR, [scabR[0] + 28, scabR[1] - 3]], {
        w: 6.2,
        tone: 0.98,
        dry: 0.05,
        prof: 'even',
        color: bladeColor,
        seed: seed + 13,
      });
      // Hilt & coiled right fist
      stroke(ctx, [[scabR[0] + 24, scabR[1] - 14], [scabR[0] + 26, scabR[1] + 10]], {
        w: 5.5,
        tone: 0.96,
        dry: 0.15,
        prof: 'even',
        color: tasselColor,
        seed: seed + 14,
      });
      stroke(ctx, [[scabR[0] + 26, scabR[1] - 3], [scabR[0] + 62, scabR[1] - 6]], {
        w: 7.0,
        tone: TONE.jiao,
        dry: 0.25,
        prof: 'nail',
        color: inkColor,
        seed: seed + 15,
      });
      // Intense specular glint star at the thumb-pressed guard
      ctx.save();
      ctx.translate(scabR[0] + 18, scabR[1] - 3);
      ctx.fillStyle = rgba(bladeColor, 0.96);
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();
      stroke(ctx, [[-38, 0], [38, 0]], { w: 2.6, tone: 0.95, dry: 0.1, prof: 'lens', color: bladeColor });
      stroke(ctx, [[0, -24], [0, 24]], { w: 2.4, tone: 0.95, dry: 0.1, prof: 'lens', color: bladeColor });
      ctx.restore();
    } else {
      // Burst & Follow-Through: Scabbard thrust left, 245px gleaming white-core Wuxia blade swept wide right!
      stroke(
        ctx,
        [
          [-24 + twistX, waistY - 12],
          [-128, waistY + 14],
        ],
        { w: 8.5, tone: TONE.jiao, dry: 0.25, prof: 'even', color: inkColor, seed: seed + 16 }
      );

      // Extended right arm & sleeve
      const handX = 82 + burst * 28;
      const handY = shY + 12 - burst * 16;
      stroke(
        ctx,
        [
          [28 + twistX, shY + 8],
          [58 + twistX, shY + 14],
          [handX, handY],
        ],
        LOAD(18, TONE.jiao, [0, 1], { dry: 0.42, prof: 'robe', color: inkColor, seed: seed + 17 })
      );

      // Foreshortened 245px curved Wu-hook sabre (`吴钩霜雪长刃`)
      const tipX = handX + 215 * burst;
      const tipY = handY - 92 * burst;
      const midBladeX = lerp(handX, tipX, 0.55);
      const midBladeY = lerp(handY, tipY, 0.55) + 14;

      // Clam-white gleaming blade body
      stroke(
        ctx,
        [
          [handX - 18, handY + 8],
          [handX, handY],
          [midBladeX, midBladeY],
          [tipX, tipY],
        ],
        { w: 12.5, tone: 0.98, dry: 0.08, prof: 'cone', color: bladeColor, seed: seed + 18 }
      );
      // Charcoal-ink back spine of sabre
      stroke(
        ctx,
        [
          [handX, handY + 3],
          [midBladeX, midBladeY + 4],
          [tipX, tipY],
        ],
        { w: 3.8, tone: TONE.jiao, dry: 0.35, prof: 'tip', color: inkColor, seed: seed + 19 }
      );
      // Whipping vermilion sword tassel (`朱砂刀穗`)
      stroke(
        ctx,
        [
          [handX - 16, handY + 8],
          [handX - 48 - breeze, handY + 36],
          [handX - 82 - breeze * 1.8, handY + 54],
        ],
        { w: 4.2, tone: 0.96, dry: 0.28, prof: 'brush', color: tasselColor, seed: seed + 20 }
      );
    }
  } else if (pose === 'thumbHilt' || pose === 'kneelSword') {
    // Act 2: 「闲过信陵饮，脱剑膝前横」 — Low-angle poised half-crouch, sword horizontal across knees, thumb pushing guard open an inch
    const uOpen = clamp(unsheatheFrac, 0, 1);
    bboxLocal = [-135, -205, 145, 6];

    if (uOpen > 0.08 && uOpen < 0.55 && ctx.__inkFrame) {
      registerRuntimeCue({
        t: ctx.__inkFrame.t ?? 0,
        kind: 'blade_clique',
        scene: ctx.__inkFrame.scene?.id || 'stage',
        label: 'blade_clique',
        intensity: 0.96,
      });
    }

    // 1. Seated / half-crouched wide martial robe & cloak base mass
    drawInkMass(
      ctx,
      [
        [-28, -148],
        [32, -146],
        [68, -68],
        [82, -6],
        [-86, -6],
        [-64, -72],
      ],
      { tone: 0.42, color: inkColor, jitter: 2.8, seed: seed + 21 }
    );
    stroke(
      ctx,
      [
        [-26, -144],
        [-58, -76],
        [-82, -6],
      ],
      LOAD(22, cloakTone, [-1, 0], { dry: 0.46, prof: 'robe', color: inkColor, seed: seed + 22 })
    );
    stroke(
      ctx,
      [
        [28, -144],
        [56, -74],
        [78, -6],
      ],
      LOAD(20, cloakTone, [1, 0], { dry: 0.48, prof: 'robe', color: inkColor, seed: seed + 23 })
    );
    // Crossed collar & sash
    stroke(ctx, [[-14, -146], [2, -112], [16, -146]], {
      w: 3.6,
      tone: TONE.jiao,
      dry: 0.3,
      prof: 'tip',
      color: inkColor,
      seed: seed + 24,
    });

    // 2. Bamboo hat tilted low over shadowed brow (`斗笠压眉`)
    const hatY = -166;
    drawInkMass(
      ctx,
      [
        [0, hatY - 30],
        [-68, hatY + 8],
        [0, hatY + 16],
        [68, hatY + 7],
      ],
      { tone: 0.78, color: inkColor, jitter: 1.8, seed: seed + 25 }
    );
    stroke(ctx, [[0, hatY - 30], [-68, hatY + 8]], {
      w: 4.5,
      tone: TONE.jiao,
      dry: 0.45,
      prof: 'nail',
      color: inkColor,
      seed: seed + 26,
    });
    stroke(ctx, [[0, hatY - 30], [68, hatY + 7]], {
      w: 4.5,
      tone: TONE.jiao,
      dry: 0.45,
      prof: 'nail',
      color: inkColor,
      seed: seed + 27,
    });
    // Flowing hat ribbon (`缦胡缨`)
    stroke(
      ctx,
      [
        [-18, hatY + 4],
        [-56 - breeze * 0.8, hatY + 18],
        [-92 - breeze * 1.4, hatY + 28],
      ],
      { w: 3.0, tone: 0.92, dry: 0.35, prof: 'tip', color: tasselColor, seed: seed + 28 }
    );

    // 3. Left & right wide sleeves descending to the horizontal sword
    const guardX = 36;
    const swordY = -74;
    const gapPx = uOpen * 32; // 1 inch (`寸许`) of gleaming steel pushed open!

    stroke(
      ctx,
      [
        [-28, -136],
        [-54, -98],
        [-28, swordY - 2],
      ],
      LOAD(16, 0.68, [-1, 0.5], { dry: 0.45, color: inkColor, seed: seed + 29 })
    );
    stroke(
      ctx,
      [
        [28, -136],
        [62, -98],
        [guardX + gapPx + 14, swordY - 2],
      ],
      LOAD(16, 0.72, [1, 0.5], { dry: 0.45, color: inkColor, seed: seed + 30 })
    );

    // 4. Horizontal Scabbard (`脱剑膝前横`) from [-125, swordY+4] to [guardX, swordY]
    stroke(
      ctx,
      [
        [-128, swordY + 5],
        [-40, swordY + 2],
        [guardX, swordY],
      ],
      { w: 10.5, tone: TONE.jiao, dry: 0.22, prof: 'even', color: inkColor, seed: seed + 31 }
    );

    // 5. Exposed 1-inch gleaming frost-white steel (`拇指按锷推开寸许寒光`)
    if (gapPx > 1.0) {
      stroke(
        ctx,
        [
          [guardX - 2, swordY],
          [guardX + gapPx + 4, swordY - 1],
        ],
        { w: 7.2, tone: 1.0, dry: 0.0, prof: 'even', color: bladeColor, seed: seed + 32 }
      );
      // Horizontal razor glint & concentric qi-freeze ripple
      const glintAlpha = clamp(uOpen * 1.35, 0, 1);
      ctx.save();
      ctx.translate(guardX + gapPx * 0.5, swordY);
      const rg = ctx.createRadialGradient(0, 0, 2, 0, 0, 56 * glintAlpha);
      rg.addColorStop(0, rgba(bladeColor, 0.95 * glintAlpha));
      rg.addColorStop(0.4, rgba(INK_PALETTE.huaQingLight, 0.38 * glintAlpha));
      rg.addColorStop(1, rgba(bladeColor, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(0, 0, 56 * glintAlpha, 0, Math.PI * 2);
      ctx.fill();

      // Piercing horizontal & vertical cold-light cross-flare
      stroke(
        ctx,
        [
          [-110 * glintAlpha, 0],
          [110 * glintAlpha, 0],
        ],
        { w: 3.2, tone: 0.96 * glintAlpha, dry: 0.08, prof: 'lens', color: bladeColor }
      );
      stroke(
        ctx,
        [
          [0, -36 * glintAlpha],
          [0, 36 * glintAlpha],
        ],
        { w: 2.6, tone: 0.92 * glintAlpha, dry: 0.08, prof: 'lens', color: bladeColor }
      );
      ctx.restore();
    }

    // 6. Bronze Sword Guard (`刀锷`), Hilt & Vermilion Tassel (`朱砂剑穗`)
    const hiltX = guardX + gapPx;
    stroke(
      ctx,
      [
        [hiltX, swordY - 15],
        [hiltX, swordY + 14],
      ],
      { w: 5.8, tone: 0.96, dry: 0.15, prof: 'even', color: tasselColor, seed: seed + 33 }
    );
    stroke(
      ctx,
      [
        [hiltX + 2, swordY - 1],
        [hiltX + 58, swordY - 3],
      ],
      { w: 8.0, tone: TONE.jiao, dry: 0.25, prof: 'nail', color: inkColor, seed: seed + 34 }
    );
    // Vermilion tassel hanging from pommel
    stroke(
      ctx,
      [
        [hiltX + 56, swordY - 3],
        [hiltX + 62 - breeze * 0.4, swordY + 26],
        [hiltX + 58 - breeze * 0.8, swordY + 54],
      ],
      { w: 3.6, tone: 0.95, dry: 0.28, prof: 'brush', color: tasselColor, seed: seed + 35 }
    );
  } else if (pose === 'sheatheBack') {
    // Act 4: 「千里不留行 · 事了拂衣去，深藏身与名」 — Dorsal rear view, slow-motion blade sheathing + sleeve flick
    const uSh = clamp(sheatheProgress, 0, 1);
    const slideU = smootherstep(0.0, 0.72, uSh);
    const lockU = smootherstep(0.68, 0.82, uSh);
    const flickU = smootherstep(0.75, 1.0, uSh);
    const stepBob = Math.abs(Math.sin(stridePhase * Math.PI * 2)) * 4.5;
    bboxLocal = [-95, -205, 115, 6];

    if (uSh > 0.62 && uSh < 0.86 && ctx.__inkFrame) {
      registerRuntimeCue({
        t: ctx.__inkFrame.t ?? 0,
        kind: 'blade_sheathe',
        scene: ctx.__inkFrame.scene?.id || 'stage',
        label: 'blade_sheathe',
        intensity: 0.94,
      });
    }

    // 1. Boots below rear split cloak
    const legSpread = 16 + Math.sin(stridePhase * Math.PI * 2) * 8;
    stroke(ctx, [[-legSpread, -24], [-legSpread, 0]], { w: 6.5, tone: TONE.jiao, dry: 0.25, prof: 'even', color: inkColor });
    stroke(ctx, [[legSpread, -24], [legSpread, 0]], { w: 6.5, tone: TONE.jiao, dry: 0.25, prof: 'even', color: inkColor });

    // 2. Broad-shouldered rear martial cloak & wind-swept hem (`拂衣背影`)
    const sleeveFlickX = flickU * 38 - breeze * 1.1;
    drawInkMass(
      ctx,
      [
        [-34, -148 - stepBob],
        [36, -148 - stepBob],
        [52 + sleeveFlickX * 0.4, -76],
        [48 - breeze * 0.9, -6],
        [0, -14],
        [-52 - breeze * 1.2, -6],
        [-48, -78],
      ],
      { tone: 0.54, color: inkColor, jitter: 2.6, seed: seed + 41 }
    );
    stroke(
      ctx,
      [
        [-32, -146 - stepBob],
        [-46, -80],
        [-54 - breeze * 1.2, -6],
      ],
      LOAD(20, TONE.jiao, [-1, 0], { dry: 0.44, prof: 'robe', color: inkColor, seed: seed + 42 })
    );
    stroke(
      ctx,
      [
        [34, -146 - stepBob],
        [48 + sleeveFlickX * 0.5, -78],
        [48 - breeze * 0.9, -6],
      ],
      LOAD(20, TONE.jiao, [1, 0], { dry: 0.44, prof: 'robe', color: inkColor, seed: seed + 43 })
    );

    // 3. Scabbard projecting diagonally across the back-left (`[-118, -14]` -> `[-22, -96]`)
    const scabMouthX = 32;
    const scabMouthY = -98 - stepBob;
    stroke(
      ctx,
      [
        [-98, -22 - stepBob],
        [-28, -64 - stepBob],
        [scabMouthX, scabMouthY],
      ],
      { w: 8.5, tone: TONE.jiao, dry: 0.22, prof: 'even', color: inkColor, seed: seed + 44 }
    );

    // 4. Slow-motion blade sliding into scabbard (`2.4x 近景慢动作归鞘入扣`)
    // Projects out to the upper-right beyond the cloak silhouette so the frost-white steel & collar glint read clearly
    const exposedLen = lerp(146, 0, slideU);
    const dirX = 0.82;
    const dirY = -0.57;
    const hiltX = scabMouthX + dirX * exposedLen;
    const hiltY = scabMouthY + dirY * exposedLen;

    if (exposedLen > 1.5) {
      stroke(
        ctx,
        [
          [scabMouthX, scabMouthY],
          [hiltX, hiltY],
        ],
        { w: 6.8, tone: 1.0, dry: 0.0, prof: 'even', color: bladeColor, seed: seed + 45 }
      );
      // Cold steel edge highlight along the sliding blade
      stroke(
        ctx,
        [
          [scabMouthX, scabMouthY - 1.5],
          [hiltX, hiltY - 1.5],
        ],
        { w: 3.2, tone: 0.98, dry: 0.0, prof: 'even', color: '#FFFFFF', seed: seed + 55 }
      );
    }

    // Bronze Sword Guard (`刀锷`), Hilt & Vermilion Tassel (`朱砂剑穗`)
    stroke(
      ctx,
      [
        [hiltX - 9, hiltY - 11],
        [hiltX + 9, hiltY + 11],
      ],
      { w: 5.5, tone: 0.98, dry: 0.12, prof: 'even', color: tasselColor, seed: seed + 46 }
    );
    stroke(
      ctx,
      [
        [hiltX, hiltY],
        [hiltX + dirX * 42, hiltY + dirY * 42],
      ],
      { w: 7.2, tone: TONE.jiao, dry: 0.22, prof: 'nail', color: inkColor, seed: seed + 47 }
    );
    stroke(
      ctx,
      [
        [hiltX + dirX * 40, hiltY + dirY * 40],
        [hiltX + dirX * 40 + 18 - breeze * 0.9, hiltY + dirY * 40 + 28],
        [hiltX + dirX * 40 + 28 - breeze * 1.6, hiltY + dirY * 40 + 58],
      ],
      { w: 4.0, tone: 0.96, dry: 0.24, prof: 'brush', color: tasselColor, seed: seed + 48 }
    );

    // Collar-lock star glint (`归鞘入扣寒星`) visible throughout sheathing & peaking at lock
    const glintEnv = uSh < 0.96 ? clamp(0.45 + 0.55 * Math.sin(clamp((uSh - 0.15) / 0.78, 0, 1) * Math.PI), 0, 1) : 0;
    if (glintEnv > 0.05) {
      ctx.save();
      ctx.translate(scabMouthX, scabMouthY);
      const rg = ctx.createRadialGradient(0, 0, 2, 0, 0, 44 * glintEnv);
      rg.addColorStop(0, rgba('#FFFFFF', 0.95 * glintEnv));
      rg.addColorStop(0.45, rgba(bladeColor, 0.52 * glintEnv));
      rg.addColorStop(1, rgba(bladeColor, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(0, 0, 44 * glintEnv, 0, Math.PI * 2);
      ctx.fill();
      stroke(ctx, [[-68 * glintEnv, -8], [68 * glintEnv, 8]], { w: 3.0, tone: 0.98 * glintEnv, dry: 0.05, prof: 'lens', color: '#FFFFFF' });
      stroke(ctx, [[-8, -42 * glintEnv], [8, 42 * glintEnv]], { w: 2.6, tone: 0.94 * glintEnv, dry: 0.05, prof: 'lens', color: bladeColor });
      ctx.restore();
    }

    // Right wide sleeve guiding the hilt then flicking (`事了拂衣去`)
    const wrX = lerp(hiltX + dirX * 14, 68 + sleeveFlickX, flickU);
    const wrY = lerp(hiltY + dirY * 14, -104 - stepBob, flickU);
    stroke(
      ctx,
      [
        [32, -142 - stepBob],
        [54 + sleeveFlickX * 0.4, -118 - stepBob],
        [wrX, wrY],
      ],
      LOAD(16, 0.78, [1, 0.4], { dry: 0.45, prof: 'robe', color: inkColor, seed: seed + 49 })
    );

    // 5. Rear Bamboo Hat & trailing silk ribbon (`斗笠背影与缦胡缨`)
    const hatY = -168 - stepBob;
    drawInkMass(
      ctx,
      [
        [0, hatY - 26],
        [-58, hatY + 8],
        [0, hatY + 14],
        [58, hatY + 8],
      ],
      { tone: 0.76, color: inkColor, jitter: 1.8, seed: seed + 50 }
    );
    stroke(ctx, [[-58, hatY + 8], [0, hatY - 26], [58, hatY + 8]], {
      w: 4.0,
      tone: TONE.jiao,
      dry: 0.45,
      prof: 'nail',
      color: inkColor,
      seed: seed + 51,
    });
    // Trailing crimson/ink hat ribbons in mountain wind
    stroke(
      ctx,
      [
        [0, hatY + 8],
        [-22 - breeze * 0.9, hatY + 34],
        [-44 - breeze * 1.7, hatY + 64],
      ],
      { w: 3.0, tone: 0.92, dry: 0.35, prof: 'tip', color: tasselColor, seed: seed + 52 }
    );
  } else {
    // Default `loneWalk` / `strollDrink`: Act 1 「赵客缦胡缨，吴钩霜雪明」
    const dir = facing >= 0 ? 1 : -1;
    const step = Math.sin(stridePhase * Math.PI * 2);
    const bob = Math.abs(step) * 4.0;
    bboxLocal = [-85, -205, 85, 6];

    ctx.save();
    ctx.scale(dir, 1);

    // 1. Striding boots & split legs (`跨步双足，打破等腰梯形`)
    const footFX = 22 + step * 18;
    const footBX = -24 - step * 18;
    stroke(ctx, [[footBX, -28], [footBX, -2], [footBX + 12, 0]], {
      w: 6.2,
      tone: TONE.jiao,
      dry: 0.28,
      prof: 'nail',
      color: inkColor,
      seed: seed + 61,
    });
    stroke(ctx, [[footFX, -28], [footFX, -2], [footFX + 14, 0]], {
      w: 6.5,
      tone: TONE.jiao,
      dry: 0.25,
      prof: 'nail',
      color: inkColor,
      seed: seed + 62,
    });

    // 2. Wind-swept split martial robe & trailing cloak (`没骨侧锋潇洒侠客袍`)
    const hemBackX = -52 - breeze * 1.1 - step * 10;
    const hemFrontX = 36 + step * 12;
    drawInkMass(
      ctx,
      [
        [-14, -152 - bob],
        [18, -150 - bob],
        [24, -88 - bob],
        [hemFrontX, -8],
        [4, -24],
        [hemBackX, -8],
        [-28, -84 - bob],
      ],
      { tone: 0.36, color: inkColor, jitter: 2.4, seed: seed + 63 }
    );
    stroke(
      ctx,
      [
        [-14, -150 - bob],
        [-28, -86 - bob],
        [hemBackX, -8],
      ],
      LOAD(18, cloakTone, [-1, 0], { dry: 0.44, prof: 'robe', color: inkColor, seed: seed + 64 })
    );
    stroke(
      ctx,
      [
        [16, -148 - bob],
        [22, -86 - bob],
        [hemFrontX, -8],
      ],
      LOAD(14, 0.65, [1, 0], { dry: 0.48, prof: 'robe', color: inkColor, seed: seed + 65 })
    );

    // 3. Curved Wu-Hook Sabre (`吴钩霜雪明` — 175px curved sabre at waist with gleaming frost edge)
    const hiltX = 32;
    const hiltY = -98 - bob;
    const tipX = -98 - breeze * 0.6;
    const tipY = -36 - bob;
    // Curved scabbard & frost-white gleaming upper edge (`吴钩霜雪寒芒`)
    stroke(
      ctx,
      [
        [hiltX, hiltY],
        [-26, -74 - bob],
        [tipX, tipY],
      ],
      { w: 7.2, tone: TONE.jiao, dry: 0.25, prof: 'cone', color: inkColor, seed: seed + 66 }
    );
    stroke(
      ctx,
      [
        [hiltX + 18, hiltY - 8],
        [-18, -76 - bob],
        [tipX + 12, tipY - 4],
      ],
      { w: 3.2, tone: 0.95, dry: 0.12, prof: 'tip', color: bladeColor, seed: seed + 67 }
    );
    //Vermilion tassel (`朱砂刀穗`) streaming from Wu-hook hilt
    stroke(
      ctx,
      [
        [hiltX + 20, hiltY - 10],
        [hiltX + 6 - breeze * 1.2, hiltY + 18],
        [hiltX - 14 - breeze * 2.1, hiltY + 42],
      ],
      { w: 3.4, tone: 0.94, dry: 0.3, prof: 'brush', color: tasselColor, seed: seed + 68 }
    );

    // 4. Foreground wide sleeve & arm (holding wine gourd/cup if `withWine`, or resting on Wu-hook hilt)
    const handX = withWine ? 38 : hiltX + 8;
    const handY = withWine ? -136 - bob : hiltY - 4;
    stroke(
      ctx,
      [
        [8, -142 - bob],
        [24, -116 - bob],
        [handX, handY],
      ],
      LOAD(15, 0.72, [0, 1], { dry: 0.45, prof: 'robe', color: inkColor, seed: seed + 69 })
    );
    if (withWine) {
      drawInkBlot(ctx, handX + 10, handY - 6, 8.5, 0.92, -0.3, 0.72, seed + 70, tasselColor);
    }

    // 5. Head, Conical Bamboo Hat & Trailing Tassel (`赵客缦胡缨`)
    const hatY = -172 - bob;
    drawInkMass(
      ctx,
      [
        [2, hatY - 24],
        [-48, hatY + 6],
        [4, hatY + 12],
        [52, hatY + 6],
      ],
      { tone: 0.72, color: inkColor, jitter: 1.6, seed: seed + 71 }
    );
    stroke(ctx, [[-48, hatY + 6], [2, hatY - 24], [52, hatY + 6]], {
      w: 3.8,
      tone: TONE.jiao,
      dry: 0.45,
      prof: 'nail',
      color: inkColor,
      seed: seed + 72,
    });
    // `缦胡缨` (long wind-swept martial hat tassel)
    stroke(
      ctx,
      [
        [-12, hatY + 4],
        [-54 - breeze * 1.2, hatY + 14],
        [-96 - breeze * 2.2, hatY + 26],
      ],
      { w: 3.2, tone: 0.92, dry: 0.32, prof: 'tip', color: tasselColor, seed: seed + 73 }
    );

    ctx.restore();
  }

  ctx.restore();

  // Register hero element into 2D Spatial Audit SceneGraph (`tools/audit.mjs`)
  const worldBbox = [
    x + bboxLocal[0] * scale,
    y + bboxLocal[1] * scale,
    x + bboxLocal[2] * scale,
    y + bboxLocal[3] * scale,
  ];
  recordSceneElement2D(ctx, {
    id,
    role: 'hero',
    isHero: true,
    kind: `wuxiaHero:${pose}`,
    bbox: worldBbox,
    footY: y,
    groundY: groundY ?? y,
  });

  return {
    x,
    y,
    scale,
    bbox: worldBbox,
  };
}

// ============================================================================
// TIER 4B · MULTI-PLANE 2D/2.5D STAGE & SHOT-LIST DIRECTOR (`createInkScrollStage`)
// ============================================================================

/**
 * Initializes the Turnkey 2D/2.5D Ink-Wash Handscroll Stage & Shot-List Director.
 *
 * Features:
 *   - Virtual reference canvas coordinate system (`1920 x 1080`) that automatically adapts
 *     zoom & framing across `16:9`, `9:16` portrait, and `1:1` square viewports without clipping!
 *   - Per-scene `data-look` (`shanshui | qinglv | xieyi | night | snow`) & `data-look-blend` timeline.
 *   - `studio.director({ subjects, shots })` with full `storyboard()` output (`window.SHOTS`)
 *     and continuity / jump-cut warnings for `node tools/render.mjs --storyboard`.
 */
export function createInkScrollStage({
  width = 1920,
  height = 1080,
  scenes = [],
  look = null,
  looks = null,
} = {}) {
  // Resolve per-scene look timeline from `scenes` (`data-look`, `data-look-blend`)
  const mergedPresets = { ...INK_LOOK_PRESETS, ...(looks || {}) };
  const sceneLooks = scenes.map((sc) => {
    const rawLook = sc.el?.dataset?.look || sc.look || 'shanshui';
    const blendDur = parseFloat(sc.el?.dataset?.lookBlend ?? sc.lookBlend ?? '0') || 0;
    const preset = mergedPresets[rawLook] || mergedPresets.shanshui;
    return {
      start: sc.start ?? 0,
      dur: sc.dur ?? 4,
      end: sc.end ?? 4,
      preset: look ? { ...preset, ...look } : preset,
      blendDur,
    };
  });

  function getLookState(frame) {
    if (!sceneLooks.length) return mergedPresets.shanshui;
    const idx = clamp(frame.sceneIndex ?? 0, 0, sceneLooks.length - 1);
    const cur = sceneLooks[idx];
    const localT = frame.localT ?? 0;
    if (idx > 0 && cur.blendDur > 0 && localT < cur.blendDur) {
      const prev = sceneLooks[idx - 1];
      const u = smootherstep(0, cur.blendDur, localT);
      return blendInkLook(prev.preset, cur.preset, u);
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
    drawBackdrop: (ctx, w, h, lookState, camOffset) => {
      drawXuanPaperBackdrop(ctx, w, h, lookState, camOffset);
    },
    drawTransition: (ctx, w, h, lookState, frame) => {
      const idx = frame?.sceneIndex ?? 0;
      const localT = frame?.localT ?? 0;
      const transDur = 0.32;
      if (idx > 0 && localT >= 0 && localT < transDur) {
        const u = smootherstep(0, transDur, localT);
        const veilAlpha = (1 - u) * 0.32;
        const paperCol = lookState?.mistColor || lookState?.paperTop || INK_PALETTE.xuanWarm;
        ctx.save();
        ctx.fillStyle = rgba(paperCol, veilAlpha);
        ctx.fillRect(0, 0, w, h);
        drawMistRibbons(ctx, w, h, lookState, frame?.t ?? 0, {
          bands: [
            { y: 380, h: 240, alpha: (1 - u) * 0.44, parallax: 0.4 },
            { y: 680, h: 260, alpha: (1 - u) * 0.40, parallax: 0.6 },
          ],
        });
        ctx.restore();
      }
    },
  });
}
