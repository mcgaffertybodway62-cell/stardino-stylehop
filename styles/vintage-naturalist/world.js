/**
 * Vintage Naturalist · 15-second default specimen-plate film
 * (`styles/vintage-naturalist/world.js`).
 *
 * Story: 《同一片群岛 · One Archipelago》
 *   01 `specimen-plate`  (0.0–3.8s)  a finch plate prints on
 *   02 `beak-tools`      (3.8–7.5s)  three etched busts: the same bird, three tools
 *   03 `drought-selection` (7.5–11.3s) drought hardens the menu; a brass dial and balance
 *   04 `tree-of-life`    (11.3–15.0s) differences are kept by time
 *
 * Architectural rule: only the medium lives in `kernel.js`; the finch contour, its three
 * beaks, the seeds and the composition live here. No prefabricated specimen is reused.
 */

import { clamp, lerp, smootherstep } from '../../engine/motion.js';
import {
  VN_PALETTE,
  rgba,
  mulberry32,
  createVintageStage,
  drawPlateFrame,
  drawSpecimenPin,
  hatchShape,
  stippleShape,
  etchPath,
  washShape,
  drawMedallion,
  drawBrassDial,
  drawBalanceScale,
  drawTreeOfLife,
} from './kernel.js';

// ============================================================================
// SHAPE HELPERS
// ============================================================================

function renderShape(ctx, pathFn, box, opts = {}) {
  const {
    fill = null,
    fillAlpha = 0.9,
    hatchAngle = -0.62,
    hatchGap = 5.6,
    hatchAlpha = 0.42,
    hatchWidth = 1.05,
    cross = 0,
    crossGap = 11,
    crossAlpha = 0.2,
    stipple = 0,
    stippleAlpha = 0.3,
    seed = 7,
    etchWidth = 2.0,
    etchAlpha = 0.85,
    etchColor = VN_PALETTE.inkSoft,
  } = opts;
  if (fill) washShape(ctx, pathFn, fill, fillAlpha);
  if (hatchAlpha > 0) {
    hatchShape(ctx, pathFn, box, {
      angle: hatchAngle,
      gap: hatchGap,
      width: hatchWidth,
      alpha: hatchAlpha,
      cross,
      crossGap,
      crossAlpha,
    });
  }
  if (stipple > 0) {
    stippleShape(ctx, pathFn, box, { count: stipple, alpha: stippleAlpha, seed, size: 1.0 });
  }
  if (etchAlpha > 0) etchPath(ctx, pathFn, { width: etchWidth, alpha: etchAlpha, color: etchColor });
}

function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  const g = c.getContext('2d');
  draw(g);
  return c;
}

function drawCache(ctx, cache, x, y, scale = 1, opts = {}) {
  const { alpha = 1, reveal = 1, anchorX = 0, anchorY = 0 } = opts;
  if (alpha <= 0 || reveal <= 0) return;
  const w = cache.width * scale;
  const h = cache.height * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (reveal < 1) {
    ctx.beginPath();
    ctx.rect(x, y, w * clamp(reveal, 0, 1), h);
    ctx.clip();
  }
  ctx.drawImage(cache, x - anchorX * scale, y - anchorY * scale, w, h);
  ctx.restore();
}

// ============================================================================
// FINCH · CONTOURS (story-specific, drawn through the etching primitives)
// ============================================================================

/**
 * One continuous silhouette (body + neck + head dome). The head is NOT a separate circle:
 * that produced the "snowman seam" in the first pass. The beak is a separate overlay that
 * plugs into the flat vertical opening between `(224,-146)` and `(224,-84)`.
 */
function finchBodyPath(g) {
  g.beginPath();
  g.moveTo(-195, 26);
  g.bezierCurveTo(-185, -45, -125, -105, -40, -118);
  g.bezierCurveTo(55, -140, 140, -105, 168, -40);
  g.bezierCurveTo(188, 8, 155, 70, 80, 102);
  g.bezierCurveTo(0, 136, -115, 112, -178, 68);
  g.bezierCurveTo(-210, 45, -220, 38, -195, 26);
  g.closePath();
}

function finchHeadPath(g) {
  g.beginPath();
  g.arc(165, -108, 70, 0, Math.PI * 2);
  g.closePath();
}

function finchNapePath(g) {
  g.beginPath();
  g.moveTo(100, -122);
  g.bezierCurveTo(105, -90, 130, -66, 168, -58);
  g.bezierCurveTo(150, -82, 132, -104, 116, -128);
  g.closePath();
}

/** A tapered cone with a single sharp tip: upper and lower edges converge on the point. */
function beakPath(g, bx, top, bot, len, tipY) {
  g.beginPath();
  g.moveTo(bx, top);
  g.quadraticCurveTo(bx + len * 0.46, top + (tipY - top) * 0.28, bx + len, tipY);
  g.quadraticCurveTo(bx + len * 0.46, bot + (tipY - bot) * 0.28, bx, bot);
  g.closePath();
}

function finchBeakPath(g, type = 'thick') {
  const cfg =
    type === 'thin'
      ? { len: 158, top: -134, bot: -94, tip: -108 }
      : type === 'medium'
        ? { len: 106, top: -150, bot: -78, tip: -106 }
        : { len: 96, top: -156, bot: -72, tip: -108 };
  beakPath(g, 214, cfg.top, cfg.bot, cfg.len, cfg.tip);
}

function finchBellyShadowPath(g) {
  g.beginPath();
  g.moveTo(-182, 16);
  g.bezierCurveTo(-120, 52, -50, 88, 30, 92);
  g.bezierCurveTo(108, 96, 148, 52, 164, -6);
  g.lineTo(120, -16);
  g.bezierCurveTo(90, 38, 12, 68, -54, 56);
  g.bezierCurveTo(-114, 46, -154, 28, -182, 16);
  g.closePath();
}

function finchWingPath(g) {
  g.beginPath();
  g.moveTo(-42, -82);
  g.bezierCurveTo(18, -98, 70, -66, 72, -14);
  g.bezierCurveTo(72, 26, 28, 46, -12, 38);
  g.bezierCurveTo(-60, 28, -84, -2, -74, -32);
  g.bezierCurveTo(-66, -56, -54, -74, -42, -82);
  g.closePath();
}

function tailFeatherPath(g, i) {
  const y0 = 2 + i * 22;
  g.beginPath();
  g.moveTo(-190, y0);
  g.quadraticCurveTo(-235, y0 - 2, -272 + i * 3, 32 + i * 20);
  g.quadraticCurveTo(-235, 28 + i * 16, -186, y0 + 20);
  g.closePath();
}

function branchPath(g) {
  g.beginPath();
  g.moveTo(-430, 156);
  g.bezierCurveTo(-260, 122, 110, 120, 402, 146);
  g.lineTo(402, 166);
  g.bezierCurveTo(110, 140, -260, 142, -430, 178);
  g.closePath();
}

function leafPath(g, x, y, len, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const tipX = x + c * len;
  const tipY = y + s * len;
  const nx = -s * len * 0.3;
  const ny = c * len * 0.3;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + c * len * 0.45 + nx, y + s * len * 0.45 + ny, tipX, tipY);
  g.quadraticCurveTo(x + c * len * 0.45 - nx, y + s * len * 0.45 - ny, x, y);
  g.closePath();
}

function seedPath(g, cx, cy, rx, ry, ang = 0) {
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, ang, 0, Math.PI * 2);
  g.closePath();
}

/** Full specimen: finch on a branch, in the 900×720 cache. */
function drawFinchPlate(g, cx, cy, s) {
  g.save();
  g.translate(cx, cy);
  g.scale(s, s);

  const branchBox = [-440, 110, 860, 100];
  renderShape(g, branchPath, branchBox, {
    fill: VN_PALETTE.inkSoft,
    fillAlpha: 0.1,
    hatchAngle: 0.14,
    hatchGap: 5.2,
    hatchAlpha: 0.3,
    hatchWidth: 1.0,
    cross: 1.0,
    crossGap: 13,
    crossAlpha: 0.14,
    etchWidth: 2.2,
    etchAlpha: 0.85,
  });
  // Bark cracks and knots.
  for (let i = -3; i <= 3; i++) {
    g.beginPath();
    g.moveTo(i * 72 - 20, 140 + (i % 2) * 5);
    g.quadraticCurveTo(i * 72 + 16, 128, i * 72 + 38, 138);
    g.strokeStyle = rgba(VN_PALETTE.ink, 0.34);
    g.lineWidth = 0.9;
    g.stroke();
  }
  for (const [kx, ky] of [
    [-128, 140],
    [184, 136],
  ]) {
    g.beginPath();
    g.ellipse(kx, ky, 15, 6, 0.1, 0, Math.PI * 2);
    g.strokeStyle = rgba(VN_PALETTE.ink, 0.45);
    g.lineWidth = 1.0;
    g.stroke();
    g.beginPath();
    g.ellipse(kx, ky, 7, 2.6, 0.1, 0, Math.PI * 2);
    g.strokeStyle = rgba(VN_PALETTE.ink, 0.3);
    g.stroke();
  }

  // Leaves.
  const leaves = [
    [-330, 140, 48, -1.0],
    [-282, 126, 40, -0.72],
    [210, 146, 46, -0.92],
    [286, 144, 54, -0.66],
  ];
  for (const [lx, ly, ll, la] of leaves) {
    renderShape(g, (c) => leafPath(c, lx, ly, ll, la), [lx - ll, ly - ll, ll * 2, ll * 2], {
      fill: VN_PALETTE.teal,
      fillAlpha: 0.16,
      hatchAngle: la + 0.9,
      hatchGap: 4.4,
      hatchAlpha: 0.32,
      cross: 1.1,
      crossGap: 9,
      crossAlpha: 0.14,
      etchWidth: 1.4,
      etchColor: VN_PALETTE.tealDeep,
    });
  }

  // Tail feathers (behind body).
  for (let i = 0; i < 3; i++) {
    renderShape(g, (c) => tailFeatherPath(c, i), [-360, -10, 200, 140], {
      fill: VN_PALETTE.parchmentShade,
      fillAlpha: 0.55,
      hatchAngle: 0.5,
      hatchGap: 4.2,
      hatchAlpha: 0.55,
      cross: 1.0,
      crossGap: 9,
      crossAlpha: 0.22,
      etchWidth: 1.6,
    });
    g.beginPath();
    g.moveTo(-188, 14 + i * 22);
    g.quadraticCurveTo(-246, 14 + i * 20, -296 + i * 3, 44 + i * 22);
    g.strokeStyle = rgba(VN_PALETTE.ink, 0.34);
    g.lineWidth = 0.9;
    g.stroke();
  }

  // Body + neck + head, one continuous silhouette (no seam).
  renderShape(g, finchBodyPath, [-230, -210, 480, 380], {
    fill: VN_PALETTE.parchmentShade,
    fillAlpha: 0.34,
    hatchAngle: -0.58,
    hatchGap: 4.8,
    hatchAlpha: 0.64,
    hatchWidth: 1.1,
    cross: 1.12,
    crossGap: 10.5,
    crossAlpha: 0.28,
    stipple: 170,
    stippleAlpha: 0.22,
    seed: 31,
    etchWidth: 2.4,
    etchAlpha: 0.92,
  });

  // Watercolour bloom over the engraving: warm brass on the body, cool teal on the wing.
  washShape(g, finchBodyPath, VN_PALETTE.brass, 0.14);

  // Belly shadow: a denser cross-hatch band gives the engraving volume.
  hatchShape(g, finchBellyShadowPath, [-220, -30, 420, 150], {
    angle: -0.82,
    gap: 3.4,
    width: 1.0,
    alpha: 0.3,
    cross: 1,
    crossGap: 7.5,
    crossAlpha: 0.2,
  });

  // Head: filled and hatched, but only the upper arc is inked, so the neck has no
  // "snowman seam" while the skull keeps a crisp engraved contour.
  renderShape(g, finchHeadPath, [90, -190, 170, 160], {
    fill: VN_PALETTE.parchmentShade,
    fillAlpha: 0.34,
    hatchAngle: -0.34,
    hatchGap: 4.1,
    hatchAlpha: 0.66,
    cross: 1.15,
    crossGap: 8.5,
    crossAlpha: 0.28,
    stipple: 80,
    stippleAlpha: 0.18,
    seed: 73,
    etchAlpha: 0,
  });
  washShape(g, finchHeadPath, VN_PALETTE.brass, 0.06);
  hatchShape(g, finchNapePath, [90, -140, 100, 90], {
    angle: 0.5,
    gap: 4.2,
    width: 0.95,
    alpha: 0.26,
    cross: 0.7,
    crossGap: 9,
    crossAlpha: 0.14,
  });
  g.beginPath();
  g.arc(165, -108, 70, Math.PI * 1.02, Math.PI * 1.98);
  g.strokeStyle = rgba(VN_PALETTE.inkSoft, 0.92);
  g.lineWidth = 2.4;
  g.lineCap = 'round';
  g.stroke();

  // Crown feather contours (volume without re-introducing a head outline).
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.moveTo(120 + i * 12, -166 + i * 3);
    g.quadraticCurveTo(156 + i * 10, -180 + i * 4, 192 + i * 4, -152 + i * 3);
    g.strokeStyle = rgba(VN_PALETTE.ink, 0.3);
    g.lineWidth = 0.9;
    g.stroke();
  }

  // Breast scallops and back coverts: layered feather groups, not a flat blob.
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(-44 + i * 19, 62 + (i % 2) * 9);
    g.quadraticCurveTo(-20 + i * 18, 84 + (i % 2) * 9, 4 + i * 16, 60 + (i % 2) * 9);
    g.strokeStyle = rgba(VN_PALETTE.ink, 0.26);
    g.lineWidth = 0.9;
    g.stroke();
    g.beginPath();
    g.moveTo(-112 + i * 25, -88 - (i % 2) * 8);
    g.quadraticCurveTo(-84 + i * 23, -68, -54 + i * 21, -86 - (i % 2) * 8);
    g.strokeStyle = rgba(VN_PALETTE.ink, 0.22);
    g.lineWidth = 0.8;
    g.stroke();
  }

  // Beak.
  renderShape(g, (c) => finchBeakPath(c, 'thick'), [210, -170, 150, 100], {
    fill: VN_PALETTE.brass,
    fillAlpha: 0.34,
    hatchAngle: -0.95,
    hatchGap: 3.4,
    hatchAlpha: 0.68,
    cross: 1.2,
    crossGap: 7.5,
    crossAlpha: 0.3,
    etchWidth: 2.1,
  });

  // Beak anatomy: lower mandible and nostril, not a flat triangle.
  g.beginPath();
  g.moveTo(216, -88);
  g.quadraticCurveTo(264, -94, 310, -104);
  g.strokeStyle = rgba(VN_PALETTE.ink, 0.6);
  g.lineWidth = 1.4;
  g.stroke();
  g.beginPath();
  g.ellipse(246, -132, 3.6, 1.9, -0.28, 0, Math.PI * 2);
  g.fillStyle = rgba(VN_PALETTE.ink, 0.55);
  g.fill();

  // Wing.
  renderShape(g, finchWingPath, [-120, -115, 240, 190], {
    fill: VN_PALETTE.inkSoft,
    fillAlpha: 0.13,
    hatchAngle: 0.9,
    hatchGap: 3.8,
    hatchAlpha: 0.66,
    cross: 1.15,
    crossGap: 8.5,
    crossAlpha: 0.26,
    etchWidth: 1.9,
  });
  washShape(g, finchWingPath, VN_PALETTE.teal, 0.14);

  // Dark leading edge of the folded wing.
  g.beginPath();
  g.moveTo(-62, -72);
  g.quadraticCurveTo(28, -92, 94, -52);
  g.strokeStyle = rgba(VN_PALETTE.ink, 0.62);
  g.lineWidth = 2.2;
  g.stroke();

  // Wing feather ribs: three layered covert rows, clipped to the wing.
  g.save();
  g.beginPath();
  finchWingPath(g);
  g.clip();
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.moveTo(-28 + i * 16, -74);
    g.quadraticCurveTo(18 + i * 13, -18 + i * 4, 6 + i * 12, 46);
    g.strokeStyle = rgba(VN_PALETTE.ink, 0.34);
    g.lineWidth = 0.9;
    g.stroke();
  }
  for (let row = 0; row < 3; row++) {
    g.beginPath();
    g.moveTo(-88 + row * 12, -28 + row * 18);
    g.quadraticCurveTo(-12 + row * 6, 2 + row * 14, 74 - row * 12, 20 + row * 11);
    g.strokeStyle = rgba(VN_PALETTE.ink, 0.3);
    g.lineWidth = 0.8;
    g.stroke();
  }
  g.restore();

  // Eye.
  g.beginPath();
  g.arc(198, -130, 7.2, 0, Math.PI * 2);
  g.fillStyle = rgba(VN_PALETTE.ink, 0.95);
  g.fill();
  g.strokeStyle = rgba(VN_PALETTE.ink, 0.45);
  g.lineWidth = 1.2;
  g.stroke();
  g.beginPath();
  g.arc(200.4, -132.4, 2.1, 0, Math.PI * 2);
  g.fillStyle = rgba(VN_PALETTE.cream, 0.9);
  g.fill();

  // Legs and feet.
  g.strokeStyle = rgba(VN_PALETTE.inkSoft, 0.85);
  g.lineWidth = 3.4;
  g.lineCap = 'round';
  for (const [x0, x1] of [
    [-24, -36],
    [44, 58],
  ]) {
    g.beginPath();
    g.moveTo(x0, 104);
    g.quadraticCurveTo(x0 - 6, 124, x1, 142);
    g.stroke();
    g.beginPath();
    g.moveTo(x1, 142);
    g.lineTo(x1 - 12, 154);
    g.moveTo(x1, 142);
    g.lineTo(x1 + 10, 154);
    g.stroke();
  }

  // A few branch seeds.
  for (const [sx, sy, hard] of [
    [246, 134, true],
    [270, 144, false],
    [292, 134, true],
  ]) {
    renderShape(g, (c) => seedPath(c, sx, sy, 8.5, 5.2, -0.2), [sx - 12, sy - 10, 24, 20], {
      fill: hard ? VN_PALETTE.inkSoft : VN_PALETTE.brass,
      fillAlpha: hard ? 0.22 : 0.32,
      hatchAngle: 0.8,
      hatchGap: 2.4,
      hatchAlpha: 0.55,
      etchWidth: 1.1,
    });
    if (hard) {
      g.beginPath();
      g.moveTo(sx - 6, sy - 1);
      g.quadraticCurveTo(sx, sy + 3, sx + 6, sy - 1);
      g.strokeStyle = rgba(VN_PALETTE.ink, 0.45);
      g.lineWidth = 1.0;
      g.stroke();
    }
  }

  g.restore();
}

// ---------------------------------------------------------------------------
// BUSTS · three beak tools
// ---------------------------------------------------------------------------

function bustShoulderPath(g) {
  g.beginPath();
  g.moveTo(-124, 182);
  g.bezierCurveTo(-120, 102, -94, 38, -30, -2);
  g.lineTo(74, -6);
  g.bezierCurveTo(108, 24, 118, 94, 112, 182);
  g.closePath();
}

function bustHeadPath(g) {
  g.beginPath();
  g.arc(30, -64, 76, 0, Math.PI * 2);
  g.closePath();
}

function bustBeakPath(g, type) {
  const cfg =
    type === 'thin'
      ? { len: 188, top: -100, bot: -50, tip: -76 }
      : type === 'medium'
        ? { len: 150, top: -120, bot: -24, tip: -72 }
        : { len: 118, top: -138, bot: 0, tip: -68 };
  beakPath(g, 98, cfg.top, cfg.bot, cfg.len, cfg.tip);
}

function drawFinchBust(g, cx, cy, s, beakType) {
  g.save();
  g.translate(cx, cy);
  g.scale(s, s);

  // Shoulders / chest.
  renderShape(g, bustShoulderPath, [-140, -20, 280, 220], {
    fill: VN_PALETTE.parchmentShade,
    fillAlpha: 0.32,
    hatchAngle: 1.02,
    hatchGap: 5.2,
    hatchAlpha: 0.56,
    cross: 1.1,
    crossGap: 10,
    crossAlpha: 0.24,
    stipple: 100,
    stippleAlpha: 0.2,
    seed: 51,
    etchWidth: 2.0,
    etchAlpha: 0.9,
  });

  // Head.
  renderShape(g, bustHeadPath, [-50, -145, 170, 160], {
    fill: VN_PALETTE.parchmentShade,
    fillAlpha: 0.3,
    hatchAngle: -0.4,
    hatchGap: 3.9,
    hatchAlpha: 0.64,
    cross: 1.15,
    crossGap: 8,
    crossAlpha: 0.28,
    stipple: 70,
    stippleAlpha: 0.18,
    seed: 73,
    etchWidth: 2.3,
    etchAlpha: 0.92,
  });

  // Beak.
  renderShape(g, (c) => bustBeakPath(c, beakType), [90, -145, 200, 150], {
    fill: VN_PALETTE.brass,
    fillAlpha: 0.36,
    hatchAngle: -0.9,
    hatchGap: 3.2,
    hatchAlpha: 0.72,
    cross: 1.2,
    crossGap: 7,
    crossAlpha: 0.3,
    etchWidth: 2.1,
  });

  // Eye: a deliberate high-contrast focal point in the engraved head.
  g.beginPath();
  g.arc(58, -84, 11.0, 0, Math.PI * 2);
  g.fillStyle = rgba(VN_PALETTE.ink, 0.96);
  g.fill();
  g.beginPath();
  g.arc(58, -84, 13.2, 0, Math.PI * 2);
  g.strokeStyle = rgba(VN_PALETTE.inkSoft, 0.55);
  g.lineWidth = 1.1;
  g.stroke();
  g.beginPath();
  g.arc(61.2, -87.4, 3.4, 0, Math.PI * 2);
  g.fillStyle = rgba(VN_PALETTE.cream, 0.95);
  g.fill();
  // Nostril at the beak base.
  g.beginPath();
  g.ellipse(104, -104, 3.2, 1.6, -0.3, 0, Math.PI * 2);
  g.fillStyle = rgba(VN_PALETTE.ink, 0.55);
  g.fill();

  // Neck feather contours.
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(-72 + i * 12, 8 + i * 8);
    g.quadraticCurveTo(-54 + i * 10, 42 + i * 8, -34 + i * 8, 58 + i * 7);
    g.strokeStyle = rgba(VN_PALETTE.ink, 0.22);
    g.lineWidth = 0.8;
    g.stroke();
  }

  g.restore();
}

// ============================================================================
// WORLD
// ============================================================================

export default async function createWorld({ width = 1920, height = 1080, scenes = [], style = {} } = {}) {
  const studio = createVintageStage({
    width,
    height,
    scenes,
    look: style.look,
    looks: style.looks,
  });

  const W = studio.designWidth;
  const H = studio.designHeight;
  const P = studio.portrait;
  const S = studio.square;

  // Pre-render the heavy hatching once; the per-frame layer only moves / wipes it.
  const finchPlate = makeCanvas(900, 720, (g) => drawFinchPlate(g, 450, 330, 1.0));
  const busts = {
    thick: makeCanvas(560, 440, (g) => drawFinchBust(g, 220, 240, 1.0, 'thick')),
    thin: makeCanvas(560, 440, (g) => drawFinchBust(g, 220, 240, 1.0, 'thin')),
    medium: makeCanvas(560, 440, (g) => drawFinchBust(g, 220, 240, 1.0, 'medium')),
  };

  const progressFills = scenes.map((sc) => sc.el?.querySelector('.vnh-progress__fill') || null);

  function updateProgress(frame) {
    const idx = clamp(frame.sceneIndex ?? 0, 0, Math.max(0, scenes.length - 1));
    const sc = scenes[idx];
    const fill = progressFills[idx];
    if (!sc || !fill) return;
    const u = clamp((frame.localT ?? 0) / Math.max(0.1, sc.dur), 0, 1);
    fill.style.transform = `scaleX(${u.toFixed(4)})`;
  }

  // -------------------------------------------------------------------------
  // Director: two storyboard beats per scene, one continuous move per scene.
  // -------------------------------------------------------------------------
  const director = studio.director({
    subjects: {
      plate: { x: 1290, y: 560, w: 820, h: 640 },
      finch: { x: 1290, y: 540, w: 620, h: 520 },
      beaks: { x: 960, y: 520, w: 1360, h: 480 },
      thickBeak: { x: 420, y: 520, w: 380, h: 420 },
      selection: { x: 960, y: 610, w: 1300, h: 600 },
      balance: { x: 1320, y: 780, w: 460, h: 330 },
      tree: { x: 960, y: 780, w: 1000, h: 680 },
      stars: { x: 960, y: 620, w: 1400, h: 760 },
    },
    shots: {
      'specimen-plate': [
        { dur: 1.9, size: 'wide', subject: 'plate', move: 'push', amount: 1.15 },
        { size: 'close', subject: 'finch' },
      ],
      'beak-tools': [
        { dur: 1.85, size: 'medium', subject: 'beaks', move: 'pan', amount: 0.9 },
        { size: 'close', subject: 'thickBeak' },
      ],
      'drought-selection': [
        { dur: 1.9, size: 'medium', subject: 'selection', move: 'push', amount: 1.0 },
        { size: 'close', subject: 'balance' },
      ],
      'tree-of-life': [
        { dur: 1.8, size: 'full', subject: 'tree', move: 'pull', amount: 1.1 },
        { size: 'wide', subject: 'stars' },
      ],
    },
  });

  // -------------------------------------------------------------------------
  // Scene 1 · plate prints on
  // -------------------------------------------------------------------------
  function renderPlate(ctx, localT) {
    const plate = P
      ? { x: 100, y: 520, w: 880, h: 1000 }
      : S
        ? { x: 470, y: 330, w: 560, h: 470 }
        : { x: 900, y: 246, w: 800, h: 624 };

    const frameReveal = smootherstep(0.12, 0.9, localT);
    drawPlateFrame(ctx, plate.x, plate.y, plate.w, plate.h, {
      reveal: frameReveal,
      weight: P ? 1.1 : 1,
    });

    // Faint habitat ring behind the specimen.
    ctx.save();
    ctx.globalAlpha = 0.28 * smootherstep(0.3, 1.2, localT);
    ctx.beginPath();
    ctx.arc(plate.x + plate.w * 0.54, plate.y + plate.h * 0.5, Math.min(plate.w, plate.h) * 0.4, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(VN_PALETTE.brass, 0.6);
    ctx.lineWidth = 0.9;
    ctx.setLineDash([2, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Specimen, wiped on like a fresh impression.
    const scale = Math.min(plate.w / finchPlate.width, plate.h / finchPlate.height) * 0.98;
    const dx = plate.x + (plate.w - finchPlate.width * scale) / 2;
    const dy = plate.y + (plate.h - finchPlate.height * scale) / 2 + plate.h * 0.01;
    drawCache(ctx, finchPlate, dx, dy, scale, {
      reveal: smootherstep(0.34, 1.7, localT),
      alpha: 1,
    });

    // Pin the top-right corner of the plate.
    drawSpecimenPin(ctx, plate.x + plate.w - 38, plate.y + 34, {
      alpha: smootherstep(1.8, 2.4, localT),
      r: P ? 8 : 7,
    });

    // Plate number, engraved by hand.
    ctx.save();
    ctx.globalAlpha = 0.62 * smootherstep(1.2, 2.0, localT);
    ctx.font = `700 ${P ? 26 : 24}px "Noto Serif CJK SC", "Songti SC", serif`;
    ctx.fillStyle = VN_PALETTE.inkSoft;
    ctx.fillText('PL. I', plate.x + 26, plate.y + plate.h - 22);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Scene 2 · three beak tools
  // -------------------------------------------------------------------------
  function medallionLayout() {
    if (P) return { r: 158, items: [{ x: 300, y: 760, type: 'thick' }, { x: 300, y: 1120, type: 'thin' }, { x: 300, y: 1480, type: 'medium' }] };
    if (S) return { r: 132, items: [{ x: 250, y: 566, type: 'thick' }, { x: 540, y: 566, type: 'thin' }, { x: 830, y: 566, type: 'medium' }] };
    return { r: 202, items: [{ x: 420, y: 522, type: 'thick' }, { x: 960, y: 522, type: 'thin' }, { x: 1500, y: 522, type: 'medium' }] };
  }

  function drawBustInMedallion(ctx, cx, cy, r, type, reveal, alpha = 1) {
    drawMedallion(ctx, cx, cy, r, { reveal, alpha });
    const inner = r * 0.79;
    const cache = busts[type];
    // Head + beak span ~320 cache units; fit that, not the empty shoulder margin.
    const scale = (inner * 2) / 300;
    // Cached head centre is (250, 176); align it to the medallion centre.
    const x = cx - 250 * scale;
    const y = cy - 176 * scale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = alpha * smootherstep(0, 1, reveal);
    ctx.drawImage(cache, x, y, cache.width * scale, cache.height * scale);
    ctx.restore();
  }

  function renderBeaks(ctx, localT) {
    const { r, items } = medallionLayout();

    // Brass rail ties the three specimens together.
    if (!P) {
      const y = items[0].y + r + 34;
      ctx.save();
      ctx.globalAlpha = 0.4 * smootherstep(0.4, 1.2, localT);
      ctx.beginPath();
      ctx.moveTo(items[0].x, y);
      ctx.lineTo(items[2].x, y);
      ctx.strokeStyle = rgba(VN_PALETTE.brassDeep, 0.65);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      for (const it of items) {
        ctx.save();
        ctx.translate(it.x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = rgba(VN_PALETTE.brass, 0.9);
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      }
      ctx.restore();
    }

    items.forEach((it, i) => {
      const reveal = smootherstep(0.18 + i * 0.2, 0.9 + i * 0.2, localT);
      drawBustInMedallion(ctx, it.x, it.y, r, it.type, reveal, 1);
    });
  }

  // -------------------------------------------------------------------------
  // Scene 3 · drought selection
  // -------------------------------------------------------------------------
  function renderSelection(ctx, localT) {
    const dial = P
      ? { x: 300, y: 800, r: 190 }
      : S
        ? { x: 282, y: 640, r: 162 }
        : { x: 470, y: 632, r: 208 };

    drawBrassDial(ctx, dial.x, dial.y, dial.r, {
      reveal: smootherstep(0.15, 0.8, localT),
      value: lerp(0.2, 0.92, smootherstep(0.8, 2.5, localT)),
      alpha: 1,
    });

    // Two busts: thick survives, thin fades.
    const bustScale = P ? 0.56 : S ? 0.42 : 0.66;
    const bustsPos = P
      ? [{ x: 742, y: 912, type: 'thick' }, { x: 742, y: 1242, type: 'thin' }]
      : S
        ? [{ x: 680, y: 502, type: 'thick' }, { x: 910, y: 502, type: 'thin' }]
        : [{ x: 1100, y: 486, type: 'thick' }, { x: 1510, y: 486, type: 'thin' }];

    bustsPos.forEach((b, i) => {
      const cache = busts[b.type];
      const reveal = smootherstep(1.25 + i * 0.12, 1.95 + i * 0.12, localT);
      const fade = b.type === 'thin' ? lerp(0.95, 0.48, smootherstep(2.2, 3.2, localT)) : 1;
      // Ring marks the verdict.
      ctx.save();
      ctx.globalAlpha = reveal * fade * 0.8;
      ctx.beginPath();
      ctx.arc(b.x, b.y - 4, (P ? 124 : S ? 100 : 146), 0, Math.PI * 2);
      ctx.strokeStyle = b.type === 'thick' ? rgba(VN_PALETTE.teal, 0.75) : rgba(VN_PALETTE.crimson, 0.65);
      ctx.lineWidth = 2.2;
      ctx.setLineDash([3, 9]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      drawCache(ctx, cache, b.x - 250 * bustScale, b.y - 176 * bustScale, bustScale, {
        alpha: fade,
        reveal,
      });
    });

    // Brass balance: hard seeds heavy on the right.
    const scalePos = P
      ? { x: 742, y: 1560, s: 0.95 }
      : S
        ? { x: 792, y: 784, s: 0.72 }
        : { x: 1320, y: 812, s: 0.95 };
    const tilt = lerp(-0.015, 0.2, smootherstep(1.2, 2.8, localT));
    const pans = drawBalanceScale(ctx, scalePos.x, scalePos.y, scalePos.s, {
      reveal: smootherstep(1.0, 1.7, localT),
      tilt,
      alpha: 1,
    });
    if (pans) {
      const seedAlpha = smootherstep(1.7, 2.4, localT);
      drawSeedPile(ctx, pans.left.x, pans.left.y - 4, scalePos.s * 0.9, false, seedAlpha);
      drawSeedPile(ctx, pans.right.x, pans.right.y - 4, scalePos.s * 0.9, true, seedAlpha);
    }

  }

  function drawSeedPile(ctx, x, y, s, hard, alpha) {
    if (alpha <= 0) return;
    const rnd = mulberry32(hard ? 91 : 57);
    const n = hard ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const sx = x + (i - (n - 1) / 2) * 13 * s + (rnd() - 0.5) * 4;
      const sy = y - (i % 2) * 4 * s;
      const rx = 8.2 * s;
      const ry = 5.0 * s;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(sx, sy, rx, ry, (rnd() - 0.5) * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = hard ? rgba(VN_PALETTE.inkSoft, 0.72) : rgba(VN_PALETTE.brassLight, 0.82);
      ctx.fill();
      ctx.strokeStyle = rgba(VN_PALETTE.ink, 0.85);
      ctx.lineWidth = 1.15;
      ctx.stroke();
      if (hard) {
        ctx.beginPath();
        ctx.moveTo(sx - rx * 0.55, sy - 0.5);
        ctx.quadraticCurveTo(sx, sy + ry * 0.45, sx + rx * 0.55, sy - 0.5);
        ctx.strokeStyle = rgba(VN_PALETTE.parchmentLight, 0.7);
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // -------------------------------------------------------------------------
  // Scene 4 · tree of life
  // -------------------------------------------------------------------------
  /** Faint engraved star chart: fills the upper finale void like a 19th-century celestial plate. */
  function drawCelestialChart(ctx, cx, cy, r, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(VN_PALETTE.brassDeep, 0.8);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(VN_PALETTE.brassDeep, 0.42);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const major = i % 4 === 0;
      const r0 = major ? r * 0.94 : r * 0.965;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.strokeStyle = rgba(VN_PALETTE.brassDeep, major ? 0.55 : 0.3);
      ctx.lineWidth = major ? 1.0 : 0.6;
      ctx.stroke();
    }

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72);
      ctx.lineTo(cx + Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94);
      ctx.strokeStyle = rgba(VN_PALETTE.brassDeep, 0.32);
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }

    const rnd = mulberry32(911);
    for (let i = 0; i < 54; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = r * (0.12 + rnd() * 0.88);
      const sx = cx + Math.cos(a) * rr;
      const sy = cy + Math.sin(a) * rr;
      const tw = 0.35 + rnd() * 0.65;
      ctx.fillStyle = rgba(VN_PALETTE.brass, 0.9 * tw);
      ctx.beginPath();
      ctx.arc(sx, sy, 1.0 + rnd() * 1.5, 0, Math.PI * 2);
      ctx.fill();
      if (i % 8 === 0) {
        ctx.strokeStyle = rgba(VN_PALETTE.brass, 0.95 * tw);
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(sx - 5, sy);
        ctx.lineTo(sx + 5, sy);
        ctx.moveTo(sx, sy - 5);
        ctx.lineTo(sx, sy + 5);
        ctx.stroke();
      }
    }

    // A loose zodiac-like constellation in the upper half, drawn as a dashed chain.
    const nodes = [];
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.92 + (i / 6) * Math.PI * 0.84;
      const rr = r * (0.3 + 0.38 * Math.abs(Math.sin(i * 1.7 + 0.4)));
      nodes.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
    }
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 1; i < nodes.length; i++) ctx.lineTo(nodes[i].x, nodes[i].y);
    ctx.strokeStyle = rgba(VN_PALETTE.brassDeep, 0.55);
    ctx.lineWidth = 0.9;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 3.0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(VN_PALETTE.brassLight, 0.9);
      ctx.fill();
      ctx.strokeStyle = rgba(VN_PALETTE.brassDeep, 0.7);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderTree(ctx, localT) {
    const tree = P
      ? { x: 540, y: 1710, h: 1030 }
      : S
        ? { x: 540, y: 886, h: 720 }
        : { x: 960, y: 906, h: 900 };

    const frame = P
      ? { x: 100, y: 380, w: 880, h: 1340 }
      : S
        ? { x: 280, y: 280, w: 520, h: 620 }
        : { x: 560, y: 246, w: 800, h: 664 };
    drawPlateFrame(ctx, frame.x, frame.y, frame.w, frame.h, {
      reveal: smootherstep(0.1, 0.95, localT),
      weight: P ? 0.9 : 0.8,
      alpha: 0.82,
    });

    const chart = P
      ? { x: 540, y: 1050, r: 560, a: 0.62 }
      : S
        ? { x: 540, y: 590, r: 280, a: 0.46 }
        : { x: 960, y: 580, r: 300, a: 0.36 };
    ctx.save();
    ctx.beginPath();
    ctx.rect(frame.x + 14, frame.y + 14, frame.w - 28, frame.h - 28);
    ctx.clip();
    drawCelestialChart(ctx, chart.x, chart.y, chart.r, chart.a * smootherstep(0.2, 1.4, localT));
    ctx.restore();

    // Warm halo behind the constellation.
    const glow = ctx.createRadialGradient(tree.x, tree.y - tree.h * 0.42, tree.h * 0.05, tree.x, tree.y - tree.h * 0.42, tree.h * 0.62);
    glow.addColorStop(0, rgba(VN_PALETTE.brassLight, 0.18 * smootherstep(0.2, 1.6, localT)));
    glow.addColorStop(1, rgba(VN_PALETTE.brassLight, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    drawTreeOfLife(ctx, tree.x, tree.y, {
      height: tree.h,
      reveal: smootherstep(0.25, 2.9, localT),
      seed: 23,
      alpha: 1,
      stars: 34,
    });
  }

  // -------------------------------------------------------------------------
  // Render loop
  // -------------------------------------------------------------------------
  return {
    canvas: studio.canvas,
    storyboard: director.storyboard,
    // Called by engine/stage.js before Blink records the frame, so stills and video
    // show the same progress state.
    prepareDom(frame) {
      updateProgress(frame);
    },
    async render(frame) {
      director.update(frame);
      studio.render(frame, ({ ctx, width: w, height: h, beginLayer, endLayer }) => {
        const sIdx = frame.sceneIndex ?? 0;
        const localT = frame.localT ?? 0;

        // Backdrop is drawn by the stage; all story layers share the design plane.
        beginLayer(1.0);
        if (sIdx === 0) renderPlate(ctx, localT);
        else if (sIdx === 1) renderBeaks(ctx, localT);
        else if (sIdx === 2) renderSelection(ctx, localT);
        else renderTree(ctx, localT);

        // Plate edge falloff inside the artwork area.
        const edge = ctx.createLinearGradient(0, 0, 0, h);
        edge.addColorStop(0.0, rgba(VN_PALETTE.ink, 0.05));
        edge.addColorStop(0.22, rgba(VN_PALETTE.ink, 0));
        edge.addColorStop(0.82, rgba(VN_PALETTE.ink, 0));
        edge.addColorStop(1.0, rgba(VN_PALETTE.ink, 0.06));
        ctx.fillStyle = edge;
        ctx.fillRect(0, 0, w, h);
        endLayer();
      });
    },
  };
}
