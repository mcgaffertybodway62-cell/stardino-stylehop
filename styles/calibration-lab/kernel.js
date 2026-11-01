/**
 * Calibration Lab · Subject-Agnostic Style Kernel (`styles/calibration-lab/kernel.js`).
 *
 * This module holds ONLY the reusable medium of the "machine under measurement" style:
 *   1. Palette + look tokens (`CAL_PALETTE`, `CAL_LOOK`)
 *   2. PBR material factory (`createMaterials`)
 *   3. Rule-based geometry primitives (`blockGeometry`, `gearGeometry`, `helixGeometry`)
 *   4. Turnkey pale studio stage (`createCalLabStudio`) + engraved bench
 *   5. Instrument HUD drawn to a canvas texture (`createGaugeHud`) — declarative data in, layout only here
 *   6. Staged-explode easing (`layerEase`)
 *
 * AI authoring rule: build a subject by importing this kernel and declaring numbers in `world.js`.
 * Never add subject-specific parts (pistons, pumps, gearboxes) to this file; the kernel must stay
 * able to pose an unrelated machine after `world.js` is deleted.
 */

import '../../engine/vendor/three.min.js';
import { clamp, smootherstep } from '../../engine/motion.js';
import { LOOK_DEFAULTS, LOOK_PRESETS, resolveLook } from '../../engine/look.js';
import { createStudio3D } from '../../engine/studio3d.js';

export const THREE = globalThis.THREE;

// ============================================================================
// 1. PALETTE & LOOK
// ============================================================================

export const CAL_PALETTE = {
  backdrop: '#EDEFF1',
  bench: '#F3F4F5',
  benchLine: '#D5D8DC',
  ink: '#15181C',
  muted: '#7C838C',
  line: '#C9CDD2',
  accent: '#FF5A1F',
  accentSoft: 'rgba(255, 90, 31, 0.16)',
  anodized: '#C9CDD2',
  anodizedDark: '#8E949C',
  powder: '#E9EAEC',
  structure: '#1A1C1F',
  steel: '#BFC4CA',
  bronze: '#B08A5A',
  glass: '#EAF2F6',
  rubber: '#2A2C30',
  panel: 'rgba(250, 251, 252, 0.92)',
};

/**
 * Resolved over `LOOK_DEFAULTS` by `createCalLabStudio`. Pale seamless studio, one key above
 * the bench, contact shadow always on: it is the only cue that the sample sits on a real surface.
 */
export const CAL_LOOK = {
  color: { output: 'srgb', toneMapping: 'aces', exposure: 1.04 },
  light: {
    illuminance: 2.4,
    keyRatio: 2.2,
    key: { color: '#FFFFFF', pos: [-9, 16, 11], shadow: { mapSize: 2048, extent: [5, 5], near: 1, far: 40, bias: -0.0006, normalBias: 0.012 } },
    sky: '#FFFFFF',
    ground: '#C6CAD0',
    bounce: { color: '#FFFFFF', pos: [8, -3, -9], share: 0.22 },
  },
  env: { enabled: true, share: 0.55, softbox: 3.0 },
  backdrop: { color: CAL_PALETTE.backdrop, fog: 0.006 },
  contact: {
    enabled: true,
    opacity: 0.42,
    blur: 2.6,
    size: [6, 6],
    center: [0, 0],
    height: 1.2,
    resolution: 512,
    updateInterval: 1,
  },
};

export const CAL_LOOK_PRESETS = {};

// ============================================================================
// 2. MATERIALS
// ============================================================================

export function createMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  return {
    alu: std({ color: CAL_PALETTE.anodized, metalness: 0.88, roughness: 0.34 }),
    aluDark: std({ color: CAL_PALETTE.anodizedDark, metalness: 0.85, roughness: 0.44 }),
    white: phys({ color: CAL_PALETTE.powder, metalness: 0.04, roughness: 0.62, clearcoat: 0.18, clearcoatRoughness: 0.4 }),
    black: phys({ color: CAL_PALETTE.structure, metalness: 0.3, roughness: 0.36, clearcoat: 0.4, clearcoatRoughness: 0.22 }),
    steel: std({ color: CAL_PALETTE.steel, metalness: 1.0, roughness: 0.28 }),
    bronze: std({ color: CAL_PALETTE.bronze, metalness: 0.9, roughness: 0.36 }),
    rubber: std({ color: CAL_PALETTE.rubber, metalness: 0.08, roughness: 0.92 }),
    glass: phys({
      color: CAL_PALETTE.glass,
      metalness: 0,
      roughness: 0.06,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 1.4,
    }),
    accent: new THREE.MeshBasicMaterial({ color: CAL_PALETTE.accent, toneMapped: false }),
    accentGlow: new THREE.MeshBasicMaterial({ color: CAL_PALETTE.accent, transparent: true, opacity: 0.22, toneMapped: false, depthWrite: false }),
  };
}

/** Solid materials that take the section cut (glass and accent are never clipped). */
export function solidMaterials(M) {
  return [M.alu, M.aluDark, M.white, M.black, M.steel, M.bronze, M.rubber];
}

// ============================================================================
// 3. GEOMETRY PRIMITIVES
// ============================================================================

/** Rounded-corner box, extruded and centred on the origin. `w` × `d` is the footprint, `h` the height. */
export function blockGeometry({ w, h, d, r = 4, bevel = 1.2 }) {
  const rr = Math.min(r, Math.min(w, d) / 2 - 0.01);
  const hw = w / 2;
  const hd = d / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw + rr, -hd);
  s.lineTo(hw - rr, -hd);
  s.quadraticCurveTo(hw, -hd, hw, -hd + rr);
  s.lineTo(hw, hd - rr);
  s.quadraticCurveTo(hw, hd, hw - rr, hd);
  s.lineTo(-hw + rr, hd);
  s.quadraticCurveTo(-hw, hd, -hw, hd - rr);
  s.lineTo(-hw, -hd + rr);
  s.quadraticCurveTo(-hw, -hd, -hw + rr, -hd);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.2, h - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 6,
    steps: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2 + bevel, 0);
  g.computeVertexNormals();
  return g;
}

/**
 * Spur/helical gear blank from a tooth count — the rule that makes any two gears mesh:
 * pitch radius follows from the teeth, so a 24-tooth and a 52-tooth turn at 52:24.
 */
export function gearGeometry({ teeth, rOut, rRoot, width, helix = 0, holeR = 0, bevel = 0.8 }) {
  const sh = new THREE.Shape();
  const da = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * da;
    const pts = [
      [rRoot, a0],
      [rRoot, a0 + da * 0.2],
      [rOut, a0 + da * 0.33],
      [rOut, a0 + da * 0.62],
      [rRoot, a0 + da * 0.75],
    ];
    for (let k = 0; k < pts.length; k++) {
      const [rr, a] = pts[k];
      const x = rr * Math.cos(a);
      const y = rr * Math.sin(a);
      if (i === 0 && k === 0) sh.moveTo(x, y);
      else sh.lineTo(x, y);
    }
  }
  sh.closePath();
  if (holeR > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
    sh.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 4,
  });
  g.translate(0, 0, -width / 2);
  if (helix) {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const a = (pos.getZ(i) / width) * helix;
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setXY(i, x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));
    }
    pos.needsUpdate = true;
  }
  g.computeVertexNormals();
  return g;
}

/** Coil spring as a swept tube; callers scale it along y to show compression. */
export function helixGeometry({ r, wire, turns, len, seg = 160 }) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const a = u * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, u * len, Math.sin(a) * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, wire, 7, false);
}

/** Hex-head fastener: the one repeated detail that reads as "assembled", not "modelled". */
export function boltGeometry({ r = 4, h = 6, washer = true }) {
  const g = new THREE.CylinderGeometry(r, r, h, 6);
  if (!washer) return g;
  const w = new THREE.CylinderGeometry(r * 1.7, r * 1.7, h * 0.28, 18);
  w.translate(0, -h / 2 + h * 0.14, 0);
  return mergeGeometries([g, w]);
}

/** Minimal BufferGeometry merge (core three has no BufferGeometryUtils in the vendored r147 build). */
export function mergeGeometries(list) {
  let vCount = 0;
  let iCount = 0;
  for (const g of list) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  let vo = 0;
  let io = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, vo * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3);
    const c = g.attributes.position.count;
    if (g.index) {
      const a = g.index.array;
      for (let k = 0; k < a.length; k++) idx[io++] = a[k] + vo;
    } else {
      for (let k = 0; k < c; k++) idx[io++] = k + vo;
    }
    vo += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeVertexNormals();
  return out;
}

// ============================================================================
// 4. STUDIO + ENGRAVED BENCH
// ============================================================================

/** Fine calibration grid engraved into the bench top: 25 mm fines, 100 mm majors, corner fiducials. */
function createBenchTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#EAECEF';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = '#A8AEB5';
  g.lineWidth = 2.2;
  for (let i = 1; i < 20; i++) {
    const p = Math.round((i * size) / 20) + 0.5;
    g.globalAlpha = i % 4 === 0 ? 0.95 : 0.6;
    g.beginPath();
    g.moveTo(p, 0);
    g.lineTo(p, size);
    g.moveTo(0, p);
    g.lineTo(size, p);
    g.stroke();
  }
  g.globalAlpha = 0.85;
  g.strokeStyle = '#C2C6CB';
  g.lineWidth = 2;
  g.strokeRect(1, 1, size - 2, size - 2);
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = 4;
  return tex;
}

export function createCalLabStudio({ width, height, scenes = [], style = {}, maxDist = 9 }) {
  const studio = createStudio3D(THREE, {
    width,
    height,
    baseFov: 28,
    scenes,
    look: resolveLook(LOOK_DEFAULTS, CAL_LOOK, style.look),
    presets: resolveLook(LOOK_PRESETS, CAL_LOOK_PRESETS, style.looks),
    maxDist,
  });
  // Section cuts are the style's signature; the engine does not enable local clipping by default.
  studio.renderer.localClippingEnabled = true;

  const benchTex = createBenchTexture();
  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.12, 6.4),
    new THREE.MeshStandardMaterial({ map: benchTex, color: '#FFFFFF', roughness: 0.86, metalness: 0.02 }),
  );
  bench.position.set(0, -0.06, 0);
  bench.receiveShadow = true;
  studio.scene.add(bench);

  // A milled edge lip, so the bench reads as an object rather than a painted plane.
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(9.06, 0.035, 0.05),
    new THREE.MeshStandardMaterial({ color: '#AEB4BB', roughness: 0.4, metalness: 0.7 }),
  );
  lip.position.set(0, 0.012, 3.2);
  studio.scene.add(lip);

  return { ...studio, bench, benchTex, benchLip: lip };
}

// ============================================================================
// 5. INSTRUMENT HUD (canvas texture on a camera-parented plane)
// ============================================================================

const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';

function spacedText(ctx, text, x, y, spacing) {
  if (!spacing) {
    ctx.fillText(text, x, y);
    return;
  }
  // fillText per glyph ignores textAlign, so honour the alignment here or right-aligned
  // labels run off the frame.
  const align = ctx.textAlign;
  let total = 0;
  for (const ch of text) total += ctx.measureText(ch).width + spacing;
  total = Math.max(0, total - spacing);
  let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

/**
 * Declarative instrument panel. `draw(state)` lays out:
 *   { title, subtitle, formula, big: {label, value, unit}, rows: [{label, value}],
 *     phase: {labels, index}, plot: {title, xMax, yMax, series: [{points, color, width}], dot,
 *     xText, yText, note}, tag, progress, accent }
 */
export function createGaugeHud({ camera, width, height }) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(width));
  canvas.height = Math.max(2, Math.round(height));
  const ctx = canvas.getContext('2d');

  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding = THREE.sRGBEncoding;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  plane.frustumCulled = false;
  plane.renderOrder = 999;
  plane.position.set(0, 0, -1);
  plane.userData.skipContactShadow = true;
  camera.add(plane);

  function fit() {
    const h = 2 * Math.tan((camera.fov * Math.PI) / 360);
    plane.scale.set(h * camera.aspect, h, 1);
  }
  fit();

  function panel(x, y, w, h, { alpha = 0.92 } = {}) {
    ctx.fillStyle = `rgba(250, 251, 252, ${alpha})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = CAL_PALETTE.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function crosshair(x, y, s = 9) {
    ctx.strokeStyle = 'rgba(21, 24, 28, 0.34)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x + s, y);
    ctx.moveTo(x, y - s);
    ctx.lineTo(x, y + s);
    ctx.stroke();
  }

  function draw(state = {}) {
    const W = canvas.width;
    const H = canvas.height;
    const accent = state.accent || CAL_PALETTE.accent;
    const u = Math.min(W, H) / 1080;
    const m = Math.round(Math.min(W, H) * 0.055);
    const portrait = H > W * 1.15;
    const square = !portrait && W < H * 1.15;

    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';

    // corners
    crosshair(m * 0.55, m * 0.55);
    crosshair(W - m * 0.55, m * 0.55);
    crosshair(m * 0.55, H - m * 0.55);
    crosshair(W - m * 0.55, H - m * 0.55);

    // ---------------------------------------------------------------- title
    ctx.fillStyle = accent;
    ctx.fillRect(m, m, Math.round(46 * u), Math.max(2, Math.round(3 * u)));
    ctx.fillStyle = CAL_PALETTE.ink;
    ctx.font = `700 ${Math.round(34 * u)}px ${SANS}`;
    ctx.fillText(state.title || 'CALIBRATION', m, m + Math.round(42 * u));
    ctx.font = `500 ${Math.round(12.5 * u)}px ${MONO}`;
    ctx.fillStyle = CAL_PALETTE.muted;
    spacedText(ctx, (state.subtitle || '').toUpperCase(), m, m + Math.round(63 * u), 1.6 * u);

    // ---------------------------------------------------------------- big readout
    const bigY = m + Math.round((portrait ? 118 : 132) * u);
    const big = state.big || { label: '', value: '—', unit: '' };
    ctx.fillStyle = CAL_PALETTE.muted;
    ctx.font = `600 ${Math.round(11.5 * u)}px ${MONO}`;
    spacedText(ctx, (big.label || '').toUpperCase(), m, bigY - Math.round(8 * u), 1.5 * u);
    ctx.fillStyle = CAL_PALETTE.ink;
    ctx.font = `800 ${Math.round((portrait ? 78 : 88) * u)}px ${MONO}`;
    const bigText = String(big.value);
    ctx.fillText(bigText, m, bigY + Math.round(78 * u));
    const bw = ctx.measureText(bigText).width;
    ctx.fillStyle = CAL_PALETTE.muted;
    ctx.font = `600 ${Math.round(20 * u)}px ${MONO}`;
    ctx.fillText(big.unit || '', m + bw + Math.round(10 * u), bigY + Math.round(78 * u));

    // ---------------------------------------------------------------- rows
    let ry = bigY + Math.round(112 * u);
    const rowW = Math.round(portrait ? W - m * 2 - 400 * u : 380 * u);
    for (const row of state.rows || []) {
      ctx.strokeStyle = 'rgba(201, 205, 210, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m, ry + 0.5);
      ctx.lineTo(m + rowW, ry + 0.5);
      ctx.stroke();
      ctx.fillStyle = CAL_PALETTE.muted;
      ctx.font = `500 ${Math.round(11 * u)}px ${MONO}`;
      spacedText(ctx, String(row.label).toUpperCase(), m, ry + Math.round(19 * u), 1.0 * u);
      ctx.fillStyle = CAL_PALETTE.ink;
      ctx.font = `600 ${Math.round(15 * u)}px ${MONO}`;
      ctx.textAlign = 'right';
      ctx.fillText(String(row.value), m + rowW, ry + Math.round(19 * u));
      ctx.textAlign = 'left';
      ry += Math.round(27 * u);
    }

    // ---------------------------------------------------------------- formula
    if (state.formula) {
      ctx.fillStyle = CAL_PALETTE.muted;
      ctx.font = `400 ${Math.round(11.5 * u)}px ${MONO}`;
      ctx.fillText(state.formula, m, ry + Math.round(20 * u));
    }

    // ---------------------------------------------------------------- phase strip
    const phase = state.phase;
    if (phase && phase.labels) {
      const cellW = Math.round((portrait ? (W - m * 2) / 4 : 96 * u));
      const cellH = Math.round(26 * u);
      const py = H - m - cellH - Math.round(16 * u);
      const stripW = cellW * phase.labels.length;
      ctx.fillStyle = 'rgba(250, 251, 252, 0.86)';
      ctx.fillRect(m - 6 * u, py - 6 * u, stripW + 12 * u, cellH + 12 * u);
      ctx.strokeStyle = CAL_PALETTE.line;
      ctx.lineWidth = 1;
      ctx.strokeRect(m - 6 * u + 0.5, py - 6 * u + 0.5, stripW + 12 * u - 1, cellH + 12 * u - 1);
      phase.labels.forEach((label, i) => {
        const x = m + i * cellW;
        const on = i === phase.index;
        ctx.fillStyle = on ? accent : 'rgba(21, 24, 28, 0.04)';
        ctx.fillRect(x + 1, py, cellW - 3, cellH);
        ctx.fillStyle = on ? '#FFFFFF' : '#5E666F';
        ctx.font = `600 ${Math.round(10.5 * u)}px ${MONO}`;
        const tw = ctx.measureText(label).width;
        ctx.textAlign = 'center';
        ctx.fillText(label, x + cellW / 2, py + cellH * 0.68);
        ctx.textAlign = 'left';
        void tw;
      });
      ctx.fillStyle = CAL_PALETTE.muted;
      ctx.font = `500 ${Math.round(10.5 * u)}px ${MONO}`;
      spacedText(ctx, 'CYCLE 0–720°', m, py - Math.round(8 * u), 1.2 * u);
    }

    // ---------------------------------------------------------------- plot
    const plot = state.plot;
    if (plot) {
      const size = Math.round((portrait ? Math.min(W * 0.62, 360 * u) : square ? 300 * u : 340 * u));
      const px = portrait ? W - m - size : W - m - size;
      const py = portrait ? m + Math.round(90 * u) : m + Math.round(28 * u);
      panel(px, py, size, size + Math.round(30 * u));
      ctx.fillStyle = CAL_PALETTE.ink;
      ctx.font = `700 ${Math.round(11.5 * u)}px ${MONO}`;
      spacedText(ctx, plot.title || 'PLOT', px + Math.round(12 * u), py + Math.round(20 * u), 1.3 * u);
      const x0 = px + Math.round(34 * u);
      const y0 = py + Math.round(30 * u);
      const pw = size - Math.round(48 * u);
      const ph = size - Math.round(46 * u);
      const X = (v) => x0 + (clamp(v / (plot.xMax || 1), 0, 1)) * pw;
      const Y = (v) => y0 + ph - (clamp(v / (plot.yMax || 1), 0, 1)) * ph;
      ctx.strokeStyle = 'rgba(21, 24, 28, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0, y0 + ph);
      ctx.lineTo(x0 + pw, y0 + ph);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(201, 205, 210, 0.7)';
      for (let i = 1; i <= 3; i++) {
        const gy = y0 + (ph * i) / 4;
        ctx.beginPath();
        ctx.moveTo(x0, gy);
        ctx.lineTo(x0 + pw, gy);
        ctx.stroke();
      }
      for (const s of plot.series || []) {
        if (!s.points || s.points.length < 2) continue;
        ctx.strokeStyle = s.color || CAL_PALETTE.ink;
        ctx.lineWidth = (s.width || 1.6) * u;
        ctx.beginPath();
        s.points.forEach(([vx, vy], i) => {
          const X0 = X(vx);
          const Y0 = Y(vy);
          if (i === 0) ctx.moveTo(X0, Y0);
          else ctx.lineTo(X0, Y0);
        });
        ctx.stroke();
      }
      if (plot.dot) {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(X(plot.dot[0]), Y(plot.dot[1]), Math.max(2.6, 3.4 * u), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = CAL_PALETTE.muted;
      ctx.font = `500 ${Math.round(10 * u)}px ${MONO}`;
      if (plot.yText) ctx.fillText(plot.yText, px + Math.round(8 * u), y0 + Math.round(9 * u));
      if (plot.xText) {
        ctx.textAlign = 'right';
        ctx.fillText(plot.xText, x0 + pw, y0 + ph + Math.round(14 * u));
        ctx.textAlign = 'left';
      }
      if (plot.note) {
        ctx.fillText(plot.note, px + Math.round(12 * u), py + size + Math.round(22 * u));
      }
    }

    // ---------------------------------------------------------------- tag + progress
    if (state.tag) {
      ctx.fillStyle = CAL_PALETTE.ink;
      ctx.font = `600 ${Math.round(11.5 * u)}px ${MONO}`;
      ctx.textAlign = 'right';
      spacedText(ctx, state.tag.toUpperCase(), W - m, H - m - Math.round(14 * u), 1.4 * u);
      ctx.textAlign = 'left';
    }
    if (typeof state.progress === 'number') {
      const barW = portrait ? W - m * 2 : Math.round(260 * u);
      const barY = H - m;
      ctx.fillStyle = 'rgba(21, 24, 28, 0.10)';
      ctx.fillRect(W - m - barW, barY, barW, Math.max(2, 3 * u));
      ctx.fillStyle = accent;
      ctx.fillRect(W - m - barW, barY, barW * clamp(state.progress, 0, 1), Math.max(2, 3 * u));
    }

    tex.needsUpdate = true;
  }

  return { plane, canvas, texture: tex, draw, fit };
}

// ============================================================================
// 6. STAGED EXPLODE
// ============================================================================

/**
 * One layer's share of an explode amount. Layers leave in order and each move is
 * smoothstepped inside its own window, so nothing passes through anything on the way out.
 */
export function layerEase(ex, [from, to], distance) {
  return smootherstep(from, to, clamp(ex, 0, 1)) * distance;
}
