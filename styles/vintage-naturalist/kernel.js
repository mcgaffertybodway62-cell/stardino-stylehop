/**
 * Vintage Naturalist · 19th-Century Copperplate Engraving & Popular-Science Kernel
 * (`styles/vintage-naturalist/kernel.js`).
 *
 * Medium-only building blocks — zero story props, zero fixed specimens:
 *   Tier 1  Paper & Plate System:
 *           `VN_PALETTE` / `VN_LOOKS`, `drawParchmentBackdrop` (world-locked fibers, foxing,
 *           plate impression, vignette), `drawPlateFrame` (double classical rule + corner flourishes),
 *           `drawSpecimenPin`.
 *   Tier 2  Copperplate Etching Primitives:
 *           `hatchShape` (parameterised parallel / cross hatching clipped to any path),
 *           `stippleShape`, `etchPath`, `drawMedallion` — the style draws *any* subject by
 *           supplying a contour, never by stamping a prefabricated illustration.
 *   Tier 3  Brass Mechanism Instruments:
 *           `drawBrassRing`, `drawBrassDial`, `drawBalanceScale` — value-driven gauges
 *           (`dial(value)`, `scale(tilt)`), not fixed metaphor stickers.
 *   Tier 4  Finale Grammar:
 *           `drawTreeOfLife` (deterministic recursive branching + star field),
 *           `createVintageStage` (2D multi-plane stage with aspect-adaptive design space).
 *
 * Strict rule: story-specific creatures (finches, cells, molecules) live in `world.js`
 * and are rendered through these etching primitives. ADR-013 De-Stickerization applies.
 */

import { clamp, lerp, smootherstep, flowStep, registerRuntimeCue } from '../../engine/motion.js';
export { clamp, lerp, smootherstep, flowStep, registerRuntimeCue };
import { createStudio2D } from '../../engine/studio2d.js';

// ============================================================================
// TIER 1A · PALETTE & LOOK PRESETS
// ============================================================================

export const VN_PALETTE = {
  // Parchment grounds (guide §I.2)
  parchment: '#F4EAD5',
  parchmentLight: '#FAF3E4',
  parchmentMid: '#EFE2C8',
  parchmentDeep: '#E4D2AE',
  parchmentShade: '#D5BE93',

  // Sepia ink
  ink: '#2A211B',
  inkSoft: '#4A3C31',
  inkFaint: '#7A6552',

  // Accents
  crimson: '#B22D25',
  crimsonDeep: '#8C1F19',
  teal: '#1F6E66',
  tealDeep: '#154E49',
  brass: '#D4942A',
  brassLight: '#F5BD41',
  brassDeep: '#9E6416',
  cream: '#FFF8E8',

  // Auxiliary
  stain: '#C9A86A',
  smoke: '#6B5B4B',
};

export const VN_LOOKS = {
  plate: {
    name: 'plate',
    paperTop: '#FAF3E4',
    paperMid: '#F4EAD5',
    paperBot: '#E8D6B4',
    stain: '#C9A86A',
    vignette: 0.12,
    accent: '#B22D25',
  },
  amber: {
    name: 'amber',
    paperTop: '#FAF0DA',
    paperMid: '#F1E2C4',
    paperBot: '#E0C79E',
    stain: '#BE9250',
    vignette: 0.15,
    accent: '#A92720',
  },
  dusk: {
    name: 'dusk',
    paperTop: '#F6E8CC',
    paperMid: '#EAD6B2',
    paperBot: '#D6B784',
    stain: '#AE7E3E',
    vignette: 0.19,
    accent: '#9E2A23',
  },
  starlight: {
    name: 'starlight',
    paperTop: '#F8EDD6',
    paperMid: '#EBDAB8',
    paperBot: '#D3B888',
    stain: '#A97A3A',
    vignette: 0.22,
    accent: '#B22D25',
  },
};

// ============================================================================
// TIER 1B · DETERMINISTIC HELPERS
// ============================================================================

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

export function hash1(n) {
  let x = Math.imul(n | 0, 374761393);
  x = (x ^ (x >>> 13)) >>> 0;
  x = Math.imul(x, 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

// ============================================================================
// TIER 2A · PARCHMENT BACKDROP
// ============================================================================

const _paperCache = new Map();

function paperDebris(width, height) {
  const key = `${Math.round(width)}x${Math.round(height)}`;
  if (_paperCache.has(key)) return _paperCache.get(key);
  const rnd = mulberry32(0x5eed1234);
  const fibers = [];
  const count = Math.round((width * height) / 30000);
  for (let i = 0; i < count; i++) {
    const x = rnd() * width;
    const y = rnd() * height;
    const len = 6 + rnd() * 30;
    const ang = (rnd() - 0.5) * 0.5 + (rnd() < 0.18 ? Math.PI * 0.5 : 0);
    fibers.push({
      x,
      y,
      x2: x + Math.cos(ang) * len,
      y2: y + Math.sin(ang) * len,
      cx: x + Math.cos(ang) * len * 0.5 + (rnd() - 0.5) * 6,
      cy: y + Math.sin(ang) * len * 0.5 + (rnd() - 0.5) * 6,
      alpha: 0.016 + rnd() * 0.035,
      light: rnd() < 0.45,
      lw: 0.55 + rnd() * 1.1,
    });
  }
  const stains = [];
  const stainCount = 7;
  for (let i = 0; i < stainCount; i++) {
    stains.push({
      x: (0.06 + rnd() * 0.88) * width,
      y: (0.06 + rnd() * 0.88) * height,
      r: (0.05 + rnd() * 0.12) * Math.min(width, height),
      alpha: 0.035 + rnd() * 0.05,
    });
  }
  const entry = { fibers, stains };
  _paperCache.set(key, entry);
  return entry;
}

/**
 * Warm parchment ground: laid lines, pulp fibers and foxing stains scroll at a low parallax
 * so the paper feels like a physical sheet under the camera, not a screen-space filter.
 */
export function drawParchmentBackdrop(ctx, width, height, look = VN_LOOKS.plate, camOffset = [0, 0]) {
  const lk = VN_LOOKS[look?.name] || look || VN_LOOKS.plate;
  const [ox = 0, oy = 0] = camOffset;

  ctx.save();
  const bg = ctx.createLinearGradient(0, 0, width * 0.42, height);
  bg.addColorStop(0.0, lk.paperTop);
  bg.addColorStop(0.56, lk.paperMid);
  bg.addColorStop(1.0, lk.paperBot);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Laid screen lines (paper maker's wire), world-locked.
  const shift = ((oy * 0.16) % 7 + 7) % 7;
  ctx.fillStyle = rgba(VN_PALETTE.inkFaint, 0.02);
  for (let y = -shift; y < height; y += 7) ctx.fillRect(0, y, width, 1);

  const { fibers, stains } = paperDebris(width, height);

  // Foxing stains first, so fibers read over them.
  for (const s of stains) {
    const sx = s.x - ox * 0.1;
    const sy = s.y - oy * 0.1;
    const g = ctx.createRadialGradient(sx, sy, s.r * 0.15, sx, sy, s.r);
    g.addColorStop(0.0, rgba(lk.stain, s.alpha));
    g.addColorStop(0.55, rgba(lk.stain, s.alpha * 0.55));
    g.addColorStop(1.0, rgba(lk.stain, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pulp fibers.
  for (const f of fibers) {
    const dx = -ox * 0.18;
    const dy = -oy * 0.18;
    ctx.beginPath();
    ctx.moveTo(f.x + dx, f.y + dy);
    ctx.quadraticCurveTo(f.cx + dx, f.cy + dy, f.x2 + dx, f.y2 + dy);
    ctx.strokeStyle = f.light
      ? rgba(VN_PALETTE.parchmentLight, f.alpha * 1.5)
      : rgba(VN_PALETTE.inkFaint, f.alpha);
    ctx.lineWidth = f.lw;
    ctx.stroke();
  }

  // Edge vignette: burnt umber at the plate edges.
  const vg = ctx.createRadialGradient(
    width * 0.5,
    height * 0.46,
    Math.min(width, height) * 0.32,
    width * 0.5,
    height * 0.5,
    Math.hypot(width, height) * 0.58
  );
  vg.addColorStop(0.0, rgba(VN_PALETTE.ink, 0));
  vg.addColorStop(0.78, rgba(VN_PALETTE.ink, lk.vignette * 0.35));
  vg.addColorStop(1.0, rgba(VN_PALETTE.ink, lk.vignette));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// ============================================================================
// TIER 2B · PLATE FRAME, PINS & ORNAMENT
// ============================================================================

/**
 * Double classical plate rule with brass hairlines and engraved corner flourishes.
 * `reveal` is a pure alpha/scale gate, so the plate can "print on" in the first beat.
 */
export function drawPlateFrame(ctx, x, y, w, h, opts = {}) {
  const { reveal = 1, alpha = 1, ink = VN_PALETTE.inkSoft, gold = VN_PALETTE.brass, weight = 1 } = opts;
  const u = clamp(reveal, 0, 1);
  if (u <= 0 || alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha * smootherstep(0, 1, u);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(0.985 + 0.015 * u, 0.985 + 0.015 * u);
  ctx.translate(-(x + w / 2), -(y + h / 2));

  ctx.strokeStyle = rgba(ink, 0.9);
  ctx.lineWidth = 2.2 * weight;
  ctx.strokeRect(x, y, w, h);

  ctx.strokeStyle = rgba(ink, 0.55);
  ctx.lineWidth = 0.9 * weight;
  ctx.strokeRect(x + 9, y + 9, w - 18, h - 18);

  ctx.strokeStyle = rgba(gold, 0.62);
  ctx.lineWidth = 0.8 * weight;
  ctx.strokeRect(x + 14, y + 14, w - 28, h - 28);

  // Corner diamonds.
  for (const [cx, cy] of [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = rgba(gold, 0.82);
    ctx.fillRect(-4.2 * weight, -4.2 * weight, 8.4 * weight, 8.4 * weight);
    ctx.restore();
  }

  // Corner flourishes, mirrored.
  const s = 18 * weight;
  drawCornerFlourish(ctx, x + 26, y + 26, 1, 1, s, u * alpha * 0.75);
  drawCornerFlourish(ctx, x + w - 26, y + 26, -1, 1, s, u * alpha * 0.75);
  drawCornerFlourish(ctx, x + 26, y + h - 26, 1, -1, s, u * alpha * 0.75);
  drawCornerFlourish(ctx, x + w - 26, y + h - 26, -1, -1, s, u * alpha * 0.75);

  ctx.restore();
}

function drawCornerFlourish(ctx, x, y, sx, sy, s, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.strokeStyle = rgba(VN_PALETTE.brassDeep, alpha);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(s * 1.3, s * 0.1, s * 1.7, s * 0.75, s * 0.8, s * 1.25);
  ctx.bezierCurveTo(s * 0.2, s * 1.6, -s * 0.4, s * 0.9, s * 0.1, s * 0.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s * 0.62, s * 0.72, s * 0.11, 0, Math.PI * 2);
  ctx.fillStyle = rgba(VN_PALETTE.brass, alpha);
  ctx.fill();
  ctx.restore();
}

/** Brass specimen pin with a crimson wax head. */
export function drawSpecimenPin(ctx, x, y, opts = {}) {
  const { alpha = 1, r = 7 } = opts;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0.0, VN_PALETTE.brassDeep);
  g.addColorStop(0.45, VN_PALETTE.brassLight);
  g.addColorStop(1.0, VN_PALETTE.brassDeep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(VN_PALETTE.ink, 0.65);
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.fillStyle = rgba(VN_PALETTE.crimson, 0.92);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(VN_PALETTE.cream, 0.65);
  ctx.beginPath();
  ctx.arc(x - r * 0.16, y - r * 0.18, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ============================================================================
// TIER 2C · COPPERPLATE ETCHING PRIMITIVES
// ============================================================================

/**
 * Parallel hatching clipped to `pathFn`, with optional cross-hatch pass.
 * The pattern is intentionally not aligned to the page, so each specimen keeps its own
 * hand-engraved direction. `box` is `[x, y, w, h]` in the current transform's units.
 */
export function hatchShape(ctx, pathFn, box, opts = {}) {
  const {
    angle = -0.62,
    gap = 5.6,
    width = 1.05,
    color = VN_PALETTE.ink,
    alpha = 0.42,
    cross = 0,
    crossGap = 11,
    crossAlpha = 0.22,
    crossAngle = 1.08,
    jitter = 0.45,
  } = opts;
  if (alpha <= 0) return;
  const [x, y, w, h] = box;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const span = Math.hypot(w, h) * 0.5 + 14;

  ctx.save();
  ctx.beginPath();
  pathFn(ctx);
  ctx.clip();

  const passes = [{ a: angle, g: gap, w: width, al: alpha }];
  if (cross) passes.push({ a: crossAngle, g: crossGap, w: width * 0.9, al: crossAlpha });

  for (let p = 0; p < passes.length; p++) {
    const pass = passes[p];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(pass.a);
    ctx.strokeStyle = rgba(color, pass.al);
    ctx.lineWidth = pass.w;
    let i = 0;
    for (let d = -span; d <= span; d += pass.g, i++) {
      const j = jitter ? (hash1(i * 17 + p * 101) - 0.5) * jitter : 0;
      const dd = d + j;
      ctx.beginPath();
      ctx.moveTo(-span, dd);
      ctx.lineTo(span, dd);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Stipple / mezzotint dots clipped to a path, for soft organic volume. */
export function stippleShape(ctx, pathFn, box, opts = {}) {
  const {
    count = 260,
    size = 1.15,
    color = VN_PALETTE.ink,
    alpha = 0.45,
    seed = 11,
    density = null,
  } = opts;
  const [x, y, w, h] = box;
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.beginPath();
  pathFn(ctx);
  ctx.clip();
  ctx.fillStyle = rgba(color, alpha);
  for (let i = 0; i < count; i++) {
    const px = x + rnd() * w;
    const py = y + rnd() * h;
    if (density && rnd() > density(px, py)) continue;
    const r = size * (0.5 + rnd());
    ctx.fillRect(px, py, r, r);
  }
  ctx.restore();
}

/** Ink contour stroke for a supplied path. */
export function etchPath(ctx, pathFn, opts = {}) {
  const { color = VN_PALETTE.inkSoft, width = 2.1, alpha = 0.9, close = true } = opts;
  if (alpha <= 0) return;
  ctx.save();
  ctx.beginPath();
  pathFn(ctx);
  if (close) ctx.closePath();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

/** Soft colour wash inside a path (watercolour over the engraving). */
export function washShape(ctx, pathFn, color, alpha = 0.2) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.beginPath();
  pathFn(ctx);
  ctx.fillStyle = rgba(color, alpha);
  ctx.fill();
  ctx.restore();
}

/**
 * Etched specimen medallion: paper face, engraved tick ring, brass rim and knurling.
 * Returns the safe inner radius for the caller's specimen.
 */
export function drawMedallion(ctx, cx, cy, r, opts = {}) {
  const { alpha = 1, reveal = 1, accent = VN_PALETTE.brass } = opts;
  const u = clamp(reveal, 0, 1);
  if (alpha <= 0 || u <= 0) return r * 0.84;

  ctx.save();
  ctx.globalAlpha = alpha * smootherstep(0, 1, u);
  const scale = 0.94 + 0.06 * u;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  // Paper face: warm parchment, slightly darker at the rim.
  const faceG = ctx.createRadialGradient(cx - r * 0.18, cy - r * 0.2, r * 0.08, cx, cy, r * 0.86);
  faceG.addColorStop(0.0, rgba(VN_PALETTE.parchmentLight, 0.96));
  faceG.addColorStop(0.72, rgba(VN_PALETTE.parchmentMid, 0.92));
  faceG.addColorStop(1.0, rgba(VN_PALETTE.parchmentDeep, 0.88));
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
  ctx.fillStyle = faceG;
  ctx.fill();

  // Faint concentric engraving.
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * (0.86 - i * 0.045), 0, Math.PI * 2);
    ctx.strokeStyle = rgba(VN_PALETTE.ink, 0.08);
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  // Tick ring.
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const major = i % 6 === 0;
    const r0 = r * (major ? 0.79 : 0.815);
    const r1 = r * 0.845;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.strokeStyle = rgba(VN_PALETTE.inkSoft, major ? 0.55 : 0.28);
    ctx.lineWidth = major ? 1.2 : 0.7;
    ctx.stroke();
  }

  // Inner rule.
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(VN_PALETTE.inkSoft, 0.75);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  drawBrassRing(ctx, cx, cy, r, { thickness: r * 0.11, knurl: 42, accent, alpha: 0.96 });
  ctx.restore();
  return r * 0.82;
}

// ============================================================================
// TIER 3 · BRASS MECHANISM INSTRUMENTS
// ============================================================================

export function drawBrassRing(ctx, cx, cy, r, opts = {}) {
  const { thickness = 12, knurl = 40, alpha = 1, accent = VN_PALETTE.brass } = opts;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0.0, VN_PALETTE.brassDeep);
  g.addColorStop(0.28, mixHex(accent, VN_PALETTE.brassLight, 0.55));
  g.addColorStop(0.52, VN_PALETTE.brassLight);
  g.addColorStop(0.78, accent);
  g.addColorStop(1.0, VN_PALETTE.brassDeep);

  ctx.beginPath();
  ctx.arc(cx, cy, r - thickness * 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = g;
  ctx.lineWidth = thickness;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r - thickness, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(VN_PALETTE.ink, 0.55);
  ctx.lineWidth = 0.9;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(VN_PALETTE.brassDeep, 0.8);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Knurled teeth.
  for (let i = 0; i < knurl; i++) {
    const a = (i / knurl) * Math.PI * 2;
    const rr = r - thickness * 0.5;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    ctx.rotate(a);
    ctx.fillStyle = i % 3 === 0 ? rgba(VN_PALETTE.parchmentLight, 0.5) : rgba(VN_PALETTE.brassDeep, 0.5);
    ctx.fillRect(-thickness * 0.45, -0.9, thickness * 0.9, 1.8);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Value-driven brass dial. `value` 0..1 maps to the needle sweep; the red sector marks
 * the upper range. No text is baked into the instrument.
 */
export function drawBrassDial(ctx, cx, cy, r, opts = {}) {
  const { value = 0.5, alpha = 1, reveal = 1, accent = VN_PALETTE.brass } = opts;
  const u = clamp(reveal, 0, 1);
  if (alpha <= 0 || u <= 0) return;
  if (u > 0.08 && u < 0.36 && ctx?.__inkFrame) {
    registerRuntimeCue({
      t: ctx.__inkFrame.t ?? 0,
      kind: 'brass_ratchet',
      scene: ctx.__inkFrame.scene?.id || 'stage',
      label: 'brass_ratchet',
      intensity: 0.78,
    });
  }
  const sweep = 4.7;
  const a0 = -Math.PI * 0.5 - sweep * 0.5;
  const val = clamp(value, 0, 1);

  ctx.save();
  ctx.globalAlpha = alpha * smootherstep(0, 1, u);
  const scale = 0.92 + 0.08 * u;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  // Drop shadow under the instrument.
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.06, cy + r * 0.14, r * 0.86, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = rgba(VN_PALETTE.ink, 0.12);
  ctx.fill();

  // Dial face.
  const face = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.12, cx, cy, r * 0.82);
  face.addColorStop(0.0, VN_PALETTE.parchmentLight);
  face.addColorStop(0.75, VN_PALETTE.parchmentMid);
  face.addColorStop(1.0, VN_PALETTE.parchmentDeep);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  ctx.fillStyle = face;
  ctx.fill();

  // Ticks.
  for (let i = 0; i <= 30; i++) {
    const a = a0 + (i / 30) * sweep;
    const major = i % 5 === 0;
    const r0 = r * (major ? 0.58 : 0.65);
    const r1 = r * 0.72;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.strokeStyle = rgba(VN_PALETTE.inkSoft, major ? 0.8 : 0.38);
    ctx.lineWidth = major ? 1.7 : 0.9;
    ctx.stroke();
  }

  // Red high-range sector.
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, a0 + sweep * 0.62, a0 + sweep * 0.99);
  ctx.strokeStyle = rgba(VN_PALETTE.crimson, 0.7);
  ctx.lineWidth = r * 0.055;
  ctx.stroke();

  // Needle.
  const a = a0 + sweep * val;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.045);
  ctx.lineTo(r * 0.58, 0);
  ctx.lineTo(0, r * 0.045);
  ctx.closePath();
  ctx.fillStyle = rgba(VN_PALETTE.crimson, 0.92);
  ctx.fill();
  ctx.strokeStyle = rgba(VN_PALETTE.crimsonDeep, 0.8);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Hub.
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.11, 0, Math.PI * 2);
  ctx.fillStyle = VN_PALETTE.brassLight;
  ctx.fill();
  ctx.strokeStyle = rgba(VN_PALETTE.ink, 0.6);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Rim.
  drawBrassRing(ctx, cx, cy, r * 0.92, { thickness: r * 0.11, knurl: 48, accent, alpha: 1 });
  ctx.restore();
}

/**
 * Brass balance scale: a value-driven comparison instrument (`tilt` > 0 lowers the right pan).
 * Returns pan centres in the caller's coordinate space so a world can place its own samples.
 */
export function drawBalanceScale(ctx, cx, cy, scale = 1, opts = {}) {
  const { tilt = 0, alpha = 1, reveal = 1, accent = VN_PALETTE.brass } = opts;
  const u = clamp(reveal, 0, 1);
  if (alpha <= 0 || u <= 0) return null;
  if (Math.abs(tilt) > 0.08 && Math.abs(tilt) < 0.28 && ctx?.__inkFrame) {
    registerRuntimeCue({
      t: ctx.__inkFrame.t ?? 0,
      kind: 'scale_tilt',
      scene: ctx.__inkFrame.scene?.id || 'stage',
      label: 'scale_tilt',
      intensity: 0.80,
    });
  }

  const s = scale;
  const beamY = -132;
  const beamHalf = 176;
  const hang = 118;
  const panR = 55;

  ctx.save();
  ctx.globalAlpha = alpha * smootherstep(0, 1, u);
  ctx.translate(cx, cy);
  ctx.scale(s, s);

  // Base shadow.
  ctx.beginPath();
  ctx.ellipse(0, 26, 104, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = rgba(VN_PALETTE.ink, 0.12);
  ctx.fill();

  // Base plate and column.
  ctx.beginPath();
  ctx.moveTo(-86, 18);
  ctx.lineTo(86, 18);
  ctx.lineTo(62, 2);
  ctx.lineTo(-62, 2);
  ctx.closePath();
  const baseG = ctx.createLinearGradient(-86, 0, 86, 0);
  baseG.addColorStop(0, VN_PALETTE.brassDeep);
  baseG.addColorStop(0.5, VN_PALETTE.brassLight);
  baseG.addColorStop(1, VN_PALETTE.brassDeep);
  ctx.fillStyle = baseG;
  ctx.fill();
  ctx.strokeStyle = rgba(VN_PALETTE.ink, 0.55);
  ctx.lineWidth = 1.1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(-4, beamY);
  ctx.lineTo(4, beamY);
  ctx.lineTo(6, 2);
  ctx.closePath();
  ctx.fillStyle = rgba(VN_PALETTE.brass, 0.9);
  ctx.fill();
  ctx.strokeStyle = rgba(VN_PALETTE.ink, 0.5);
  ctx.stroke();

  // Fixed vertical index at the pivot.
  ctx.beginPath();
  ctx.moveTo(0, beamY - 16);
  ctx.lineTo(0, beamY + 16);
  ctx.strokeStyle = rgba(VN_PALETTE.crimson, 0.8);
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Beam.
  ctx.save();
  ctx.translate(0, beamY);
  ctx.rotate(tilt);
  ctx.beginPath();
  ctx.moveTo(-beamHalf, 0);
  ctx.lineTo(beamHalf, 0);
  const beamG = ctx.createLinearGradient(-beamHalf, 0, beamHalf, 0);
  beamG.addColorStop(0, VN_PALETTE.brassDeep);
  beamG.addColorStop(0.5, VN_PALETTE.brassLight);
  beamG.addColorStop(1, VN_PALETTE.brassDeep);
  ctx.strokeStyle = beamG;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = rgba(VN_PALETTE.ink, 0.35);
  ctx.lineWidth = 0.9;
  ctx.stroke();

  for (const side of [-1, 1]) {
    const ex = side * beamHalf;
    ctx.beginPath();
    ctx.arc(ex, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = VN_PALETTE.brassLight;
    ctx.fill();
    ctx.strokeStyle = rgba(VN_PALETTE.ink, 0.5);
    ctx.stroke();
  }
  ctx.restore();

  // Pans hang vertically from the rotated beam ends.
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const pans = {};
  for (const side of [-1, 1]) {
    const ex = side * beamHalf;
    const bx = ex * cos;
    const by = beamY + ex * sin;
    const py = by + hang;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - panR * 0.55, py - 8);
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + panR * 0.55, py - 8);
    ctx.strokeStyle = rgba(VN_PALETTE.inkSoft, 0.75);
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(bx, py, panR, 12, 0, 0, Math.PI * 2);
    const panG = ctx.createLinearGradient(bx - panR, py, bx + panR, py);
    panG.addColorStop(0, VN_PALETTE.brassDeep);
    panG.addColorStop(0.5, VN_PALETTE.brassLight);
    panG.addColorStop(1, VN_PALETTE.brassDeep);
    ctx.fillStyle = panG;
    ctx.fill();
    ctx.strokeStyle = rgba(VN_PALETTE.ink, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Etched rings on the pan.
    ctx.beginPath();
    ctx.ellipse(bx, py, panR * 0.72, 7.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(VN_PALETTE.ink, 0.24);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    pans[side < 0 ? 'left' : 'right'] = {
      x: cx + bx * s,
      y: cy + py * s,
      r: panR * s,
    };
  }

  ctx.restore();
  return pans;
}

/**
 * Deterministic recursive tree of life. Each branch grows with `reveal`; tip nodes and
 * a surrounding star field light up in gold. No fixed silhouette: the seed and height
 * change the tree.
 */
export function drawTreeOfLife(ctx, x, y, opts = {}) {
  const {
    height = 560,
    reveal = 1,
    seed = 7,
    alpha = 1,
    ink = VN_PALETTE.inkSoft,
    gold = VN_PALETTE.brassLight,
    stars = 48,
  } = opts;
  const u = clamp(reveal, 0, 1);
  if (alpha <= 0 || u <= 0) return;
  if (u > 0.55 && u < 0.80 && ctx?.__inkFrame) {
    registerRuntimeCue({
      t: ctx.__inkFrame.t ?? 0,
      kind: 'astral_bloom',
      scene: ctx.__inkFrame.scene?.id || 'stage',
      label: 'astral_bloom',
      intensity: 0.82,
    });
  }

  const rnd = mulberry32(seed);
  const branches = [];
  const tips = [];
  function grow(bx, by, len, angle, depth, idx) {
    const x2 = bx + Math.cos(angle) * len;
    const y2 = by + Math.sin(angle) * len;
    const bend = (rnd() - 0.5) * len * 0.26;
    const cx = bx + Math.cos(angle) * len * 0.5 - Math.sin(angle) * bend;
    const cy = by + Math.sin(angle) * len * 0.5 + Math.cos(angle) * bend;
    branches.push({ x1: bx, y1: by, cx, cy, x2, y2, depth, idx });
    if (depth >= 5) tips.push({ x: x2, y: y2, angle, depth });
    if (depth >= 6 || len < 9) return;
    const children = depth < 2 ? 3 : 2;
    for (let k = 0; k < children; k++) {
      const spread = (k - (children - 1) / 2) * (0.44 + rnd() * 0.18) - 0.04;
      const nextLen = len * (0.58 + rnd() * 0.16);
      grow(x2, y2, nextLen, angle + spread + (rnd() - 0.5) * 0.16, depth + 1, idx * 3 + k + 1);
    }
  }
  grow(x, y, height * 0.26, -Math.PI * 0.5 + 0.09, 0, 1);

  ctx.save();
  ctx.globalAlpha = alpha;

  // Constellation ring.
  ctx.beginPath();
  ctx.arc(x, y - height * 0.34, height * 0.48, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(VN_PALETTE.brass, 0.16 * u);
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 9]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Branches, root to tips.
  for (const b of branches) {
    const d = b.depth;
    const local = clamp((u - d * 0.065) / 0.3, 0, 1);
    if (local <= 0) continue;
    const k = smootherstep(0, 1, local);
    const ex = lerp(b.x1, b.x2, k);
    const ey = lerp(b.y1, b.y2, k);
    // Split the quadratic at k so the branch grows from its base along a curve.
    const qx = (1 - k) * b.x1 + k * b.cx;
    const qy = (1 - k) * b.y1 + k * b.cy;
    const tip = d >= 4;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.quadraticCurveTo(qx, qy, ex, ey);
    ctx.strokeStyle = tip
      ? rgba(gold, 0.85 * k)
      : d >= 3
        ? rgba(mixHex(ink, gold, 0.35), (0.82 - d * 0.04) * k)
        : rgba(ink, (0.86 - d * 0.05) * k);
    ctx.lineWidth = Math.max(0.9, (7.4 - d * 0.94) * k);
    ctx.lineCap = 'round';
    ctx.stroke();
    if (d >= 4 && local > 0.75) {
      const glow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 9);
      glow.addColorStop(0, rgba(gold, 0.42 * k));
      glow.addColorStop(1, rgba(gold, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ex, ey, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex, ey, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = rgba(VN_PALETTE.cream, 0.95 * k);
      ctx.fill();
    }
  }

  // Root flare.
  ctx.beginPath();
  ctx.moveTo(x - height * 0.1, y + 5);
  ctx.quadraticCurveTo(x - height * 0.032, y - 4, x, y - 3);
  ctx.moveTo(x, y - 3);
  ctx.quadraticCurveTo(x + height * 0.032, y - 4, x + height * 0.1, y + 5);
  ctx.strokeStyle = rgba(ink, 0.6 * u);
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Leaf clusters: terminal tips get two leaves, inner tips one faint leaf, so the
  // crown has depth instead of a single beaded fringe.
  for (const t of tips) {
    const local = clamp((u - 0.52 - (t.depth >= 6 ? 0 : 0.08)) / 0.32, 0, 1);
    if (local <= 0) continue;
    const lr = mulberry32((t.depth * 97 + Math.round(t.x) * 13 + Math.round(t.y)) >>> 0);
    const leaves = t.depth >= 6 ? 2 : 1;
    for (let j = 0; j < leaves; j++) {
      const a = t.angle + (j === 0 ? -0.7 : 0.7) + (lr() - 0.5) * 0.3;
      const off = t.depth >= 6 ? 10 : 6;
      const lx = t.x + Math.cos(a) * off;
      const ly = t.y + Math.sin(a) * off;
      ctx.beginPath();
      ctx.ellipse(lx, ly, t.depth >= 6 ? 9.0 : 6.5, t.depth >= 6 ? 3.6 : 2.8, a, 0, Math.PI * 2);
      ctx.fillStyle = rgba(gold, (t.depth >= 6 ? 0.26 : 0.12) * local);
      ctx.fill();
      ctx.strokeStyle = rgba(mixHex(ink, gold, 0.55), (t.depth >= 6 ? 0.4 : 0.22) * local);
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }

  // Ground line.
  ctx.beginPath();
  ctx.moveTo(x - height * 0.18, y + 6);
  ctx.quadraticCurveTo(x, y - 6, x + height * 0.18, y + 6);
  ctx.strokeStyle = rgba(ink, 0.5 * u);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Star field.
  const sr = mulberry32(seed * 13 + 5);
  for (let i = 0; i < stars; i++) {
    const ang = sr() * Math.PI * 2;
    const rad = height * (0.06 + sr() * 0.52);
    const sx = x + Math.cos(ang) * rad;
    const sy = y - height * 0.34 + Math.sin(ang) * rad * 0.72;
    const local = clamp((u - 0.2 - sr() * 0.5) / 0.25, 0, 1);
    if (local <= 0) continue;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(i * 2.7 + u * 8));
    ctx.fillStyle = rgba(gold, 0.38 * local * tw);
    ctx.beginPath();
    ctx.arc(sx, sy, 0.9 + sr() * 1.2, 0, Math.PI * 2);
    ctx.fill();
    if (i % 6 === 0) {
      const arm = 3.4 + sr() * 2.2;
      ctx.strokeStyle = rgba(gold, 0.5 * local * tw);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(sx - arm, sy);
      ctx.lineTo(sx + arm, sy);
      ctx.moveTo(sx, sy - arm);
      ctx.lineTo(sx, sy + arm);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ============================================================================
// TIER 4 · 2D STAGE
// ============================================================================

/**
 * Aspect-adaptive 2D stage. The design space follows the target canvas so the plate
 * composition fills 16:9, 9:16 and 1:1 instead of letterboxing a 1920x1080 painting.
 */
export function createVintageStage({ width = 1920, height = 1080, scenes = [], look = null, looks = null } = {}) {
  const aspect = width / height;
  const portrait = aspect < 0.8;
  const square = aspect >= 0.8 && aspect <= 1.25;
  const designWidth = portrait || square ? 1080 : 1920;
  const designHeight = portrait ? 1920 : 1080;

  const merged = { ...VN_LOOKS, ...(looks || {}) };
  const sceneLooks = scenes.map((sc) => {
    const raw = sc.el?.dataset?.look || sc.look || 'plate';
    const preset = merged[raw] || merged.plate;
    return {
      start: sc.start ?? 0,
      dur: sc.dur ?? 4,
      end: sc.end ?? 4,
      preset: look ? { ...preset, ...look } : preset,
    };
  });

  function getLookState(frame) {
    if (!sceneLooks.length) return merged.plate;
    const idx = clamp(frame.sceneIndex ?? 0, 0, sceneLooks.length - 1);
    return sceneLooks[idx].preset;
  }

  const studio = createStudio2D({
    width,
    height,
    designWidth,
    designHeight,
    scenes,
    getLookState,
    drawBackdrop: (ctx, w, h, lookState, camOffset) => {
      drawParchmentBackdrop(ctx, w, h, lookState, camOffset);
    },
    drawTransition: (ctx, w, h, lookState, frame) => {
      const idx = frame?.sceneIndex ?? 0;
      const localT = frame?.localT ?? 0;
      const dur = 0.34;
      if (idx > 0 && localT >= 0 && localT < dur) {
        const u = smootherstep(0, dur, localT);
        ctx.save();
        ctx.fillStyle = rgba(lookState?.paperTop || VN_PALETTE.parchmentLight, (1 - u) * 0.42);
        ctx.fillRect(0, 0, w, h);
        // Printing-press sweep: a thin brass rule crosses the plate at the cut.
        const x = w * (1 - u);
        const g = ctx.createLinearGradient(x - 26, 0, x + 26, 0);
        g.addColorStop(0.0, rgba(VN_PALETTE.brassLight, 0));
        g.addColorStop(0.5, rgba(VN_PALETTE.brassLight, 0.5 * (1 - u)));
        g.addColorStop(1.0, rgba(VN_PALETTE.brassLight, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - 26, 0, 52, h);
        ctx.restore();
      }
    },
  });

  return Object.assign(studio, { designWidth, designHeight, portrait, square, sceneLooks });
}
