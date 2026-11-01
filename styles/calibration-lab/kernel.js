/**
 * Calibration Lab · Subject-Agnostic Style Kernel (`styles/calibration-lab/kernel.js`).
 *
 * This module holds ONLY the reusable medium of the "machine under measurement" style:
 *   1. Palette + look tokens (`CAL_PALETTE`, `CAL_LOOK`) with high-contrast studio reflection strips
 *   2. Procedural micro-surface textures (`createSurfaceMaps`, `normalizeGeometryUVs`) & PBR materials (`createMaterials`)
 *   3. Industrial CSG-2D, multi-axis & bionic geometry primitives + Crevice AO (`blockGeometry`, `machinedPlateGeometry`,
 *      `counterboreBossGeometry`, `ribbedLinkGeometry`, `gearGeometry`, `helixGeometry`, `boltGeometry`,
 *      `sweptProfileGeometry`, `updateSweptGeometry`, `bellowsGeometry`, `ballJointGeometry`,
 *      `creviceAoRing`, `creviceAoBox`, `mergeGeometries`)
 *   4. True Stencil section-cut manager (`createSectionCutManager`) with 45° CNC cross-hatch caps
 *   5. Multi-DOF kinematics & secondary linkage solvers (`solveFabrikChain`, `solveKinematicChain`,
 *      `solveFourBar`, `solveTwoLinkIK2D`, `poseActuator`, `poseCompressedSpring`, `updateDynamicCable`, `layerEase`)
 *   6. Physical field shaders & 3D metrology callouts (`createPressureFieldMaterial`, `createTorqueArc`,
 *      `createDimensionCallout`, `lerpFramingBox`, `weightedCoreBox`)
 *   7. Turnkey pale studio stage (`createCalLabStudio`) + Instrument HUD (`createGaugeHud`)
 *
 * AI authoring rule: build any mechanical or bionic subject by importing this kernel in `world.js`.
 * Never hardcode subject-specific assemblies in this file; the kernel must remain able to build
 * an engine, a gearbox, a hydraulic pump, or a multi-DOF robotic octopus after `world.js` is replaced.
 */

import '../../engine/vendor/three.min.js';
import { clamp, lerp, smootherstep } from '../../engine/motion.js';
import { LOOK_DEFAULTS, LOOK_PRESETS, resolveLook } from '../../engine/look.js';
import { createStudio3D } from '../../engine/studio3d.js';

export const THREE = globalThis.THREE;

// ============================================================================
// 1. PALETTE & LOOK (WITH HIGH-CONTRAST STUDIO REFLECTION STRIPS)
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
  anodized: '#C8CDD3',
  anodizedDark: '#868D96',
  powder: '#ECEEF0',
  structure: '#1A1D21',
  steel: '#C6CCD2',
  chrome: '#DCE2E8',
  bronze: '#B88E58',
  glass: '#EAF2F6',
  rubber: '#23262A',
  sectionCap: '#4E5660',
  panel: 'rgba(250, 251, 252, 0.92)',
};

/**
 * Resolved over `LOOK_DEFAULTS` by `createCalLabStudio`.
 * `env.studioStrips: true` injects high-contrast specular light strips and negative-fill absorber
 * cards into the PMREM studio dome so cylindrical steel shafts, bearings and anodized chamfers
 * exhibit crisp metallic reflection bands instead of flat plastic grey.
 */
export const CAL_LOOK = {
  color: { output: 'srgb', toneMapping: 'aces', exposure: 1.05 },
  light: {
    illuminance: 2.45,
    keyRatio: 2.35,
    key: {
      color: '#FFFFFF',
      pos: [-9, 16, 11],
      shadow: { mapSize: 2048, extent: [5, 5], near: 1, far: 40, bias: -0.0005, normalBias: 0.01 },
    },
    sky: '#FFFFFF',
    ground: '#C2C7CE',
    bounce: { color: '#F4F7FA', pos: [8, -3, -9], share: 0.22 },
  },
  env: { enabled: true, share: 0.58, softbox: 3.2, studioStrips: true },
  backdrop: { color: CAL_PALETTE.backdrop, fog: 0.006 },
  contact: {
    enabled: true,
    opacity: 0.45,
    blur: 2.4,
    size: [9, 6.4],
    center: [0, 0],
    height: 1.2,
    resolution: 512,
    updateInterval: 1,
  },
};

export const CAL_LOOK_PRESETS = {};

// ============================================================================
// 2. PROCEDURAL MICRO-SURFACE MAPS, UV NORMALIZATION & PBR MATERIALS
// ============================================================================

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convert a 2D scalar heightfield `heights` (size × size, values in 0..1) into a tangent-space
 * normal map + roughness map pair with seamless wrap-around differences.
 */
function buildNormalAndRoughnessFromHeight(size, heights, { strength = 2.4, baseRough = 0.4, roughSpan = 0.18 } = {}) {
  const normCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  normCanvas.width = normCanvas.height = size;
  roughCanvas.width = roughCanvas.height = size;
  const nCtx = normCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const nImg = nCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const nd = nImg.data;
  const rd = rImg.data;
  const mask = size - 1;

  for (let y = 0; y < size; y++) {
    const ym = ((y - 1) & mask) * size;
    const yp = ((y + 1) & mask) * size;
    const y0 = y * size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1) & mask;
      const xp = (x + 1) & mask;
      const dx = (heights[y0 + xp] - heights[y0 + xm]) * strength;
      const dy = (heights[yp + x] - heights[ym + x]) * strength;
      const invLen = 1 / Math.hypot(dx, dy, 1);
      const nx = -dx * invLen;
      const ny = -dy * invLen;
      const nz = invLen;
      const idx = (y0 + x) * 4;
      nd[idx] = Math.round(clamp((nx * 0.5 + 0.5) * 255, 0, 255));
      nd[idx + 1] = Math.round(clamp((ny * 0.5 + 0.5) * 255, 0, 255));
      nd[idx + 2] = Math.round(clamp((nz * 0.5 + 0.5) * 255, 128, 255));
      nd[idx + 3] = 255;

      const h = heights[y0 + x];
      const rv = Math.round(clamp((baseRough + (h - 0.5) * roughSpan) * 255, 8, 250));
      rd[idx] = rv;
      rd[idx + 1] = rv;
      rd[idx + 2] = rv;
      rd[idx + 3] = 255;
    }
  }
  nCtx.putImageData(nImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const configure = (c, repeat = 4) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    return t;
  };
  return {
    normalMap: configure(normCanvas),
    roughnessMap: configure(roughCanvas),
  };
}

let cachedSurfaceMaps = null;

/**
 * Deterministic procedural industrial surface textures:
 *   - `anodized`: fine bead-blasted micro-pits + subtle directional brush grain
 *   - `machined`: precision lathe/milling tool marks + harmonic micro-grooves
 *   - `cast`: sand-cast / powder-coat micro-pebble & orange-peel relief
 *   - `hatch`: 45° technical section-cut CNC cross-hatching (albedo + normal)
 *   - `aoRing` / `aoBox`: soft analytical contact-occlusion alpha maps
 */
export function createSurfaceMaps() {
  if (cachedSurfaceMaps) return cachedSurfaceMaps;
  const size = 128;
  const mask = size - 1;

  // 1. Anodized aluminium (bead-blasted + fine horizontal brush)
  const randA = mulberry32(0xCA11AB01);
  const rawA = new Float32Array(size * size);
  for (let i = 0; i < rawA.length; i++) rawA[i] = randA();
  const hAnodized = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const rowJitter = (randA() - 0.5) * 0.28;
    for (let x = 0; x < size; x++) {
      // Horizontal brush correlation + isotropic bead-blast
      const b =
        rawA[y * size + x] * 0.4 +
        rawA[y * size + ((x + 1) & mask)] * 0.25 +
        rawA[y * size + ((x + 2) & mask)] * 0.2 +
        rawA[((y + 1) & mask) * size + x] * 0.15;
      hAnodized[y * size + x] = clamp(b + rowJitter * 0.35, 0, 1);
    }
  }
  const anodized = buildNormalAndRoughnessFromHeight(size, hAnodized, {
    strength: 1.8,
    baseRough: 0.34,
    roughSpan: 0.16,
  });

  // 2. Machined steel / bronze / graphite (fine parallel/lathe turning grooves + micro-grain)
  const randM = mulberry32(0xCA11AB02);
  const hMachined = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = (y / size) * Math.PI * 2;
    const groove =
      Math.sin(v * 24) * 0.28 +
      Math.sin(v * 52 + 0.7) * 0.16 +
      Math.cos(v * 11 - 0.4) * 0.1;
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const cross = Math.sin(u * 18 + v * 6) * 0.08 + (randM() - 0.5) * 0.14;
      hMachined[y * size + x] = clamp(0.5 + groove + cross, 0, 1);
    }
  }
  const machined = buildNormalAndRoughnessFromHeight(size, hMachined, {
    strength: 2.1,
    baseRough: 0.26,
    roughSpan: 0.14,
  });

  // 3. Cast / powder-coated housing (multi-octave smoothed cellular pebble relief)
  const randC = mulberry32(0xCA11AB03);
  let bufC = new Float32Array(size * size);
  for (let i = 0; i < bufC.length; i++) bufC[i] = randC();
  for (let pass = 0; pass < 3; pass++) {
    const next = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        next[y * size + x] =
          (bufC[y * size + x] * 4 +
            bufC[y * size + ((x - 1) & mask)] +
            bufC[y * size + ((x + 1) & mask)] +
            bufC[((y - 1) & mask) * size + x] +
            bufC[((y + 1) & mask) * size + x]) /
          8;
      }
    }
    bufC = next;
  }
  const cast = buildNormalAndRoughnessFromHeight(size, bufC, {
    strength: 3.2,
    baseRough: 0.54,
    roughSpan: 0.22,
  });

  // 4. 45° CNC section-cut hatching texture (albedo + normal)
  const hatchSize = 128;
  const hCanvas = document.createElement('canvas');
  hCanvas.width = hCanvas.height = hatchSize;
  const hCtx = hCanvas.getContext('2d');
  hCtx.fillStyle = '#4A525C';
  hCtx.fillRect(0, 0, hatchSize, hatchSize);
  hCtx.strokeStyle = '#67717D';
  hCtx.lineWidth = 2.2;
  const step = 8;
  for (let offset = -hatchSize; offset < hatchSize * 2; offset += step) {
    hCtx.beginPath();
    hCtx.moveTo(offset, 0);
    hCtx.lineTo(offset - hatchSize, hatchSize);
    hCtx.stroke();
  }
  hCtx.strokeStyle = '#343A42';
  hCtx.lineWidth = 1.1;
  for (let offset = -hatchSize + 3; offset < hatchSize * 2; offset += step) {
    hCtx.beginPath();
    hCtx.moveTo(offset, 0);
    hCtx.lineTo(offset - hatchSize, hatchSize);
    hCtx.stroke();
  }
  const hatchMap = new THREE.CanvasTexture(hCanvas);
  hatchMap.wrapS = hatchMap.wrapT = THREE.RepeatWrapping;
  hatchMap.repeat.set(18, 18);
  hatchMap.encoding = THREE.sRGBEncoding;

  // 5. Soft radial & rectangular crevice AO alpha maps
  const aoRadCanvas = document.createElement('canvas');
  aoRadCanvas.width = aoRadCanvas.height = 128;
  const arCtx = aoRadCanvas.getContext('2d');
  const grad = arCtx.createRadialGradient(64, 64, 18, 64, 64, 62);
  grad.addColorStop(0.0, 'rgba(10, 12, 16, 0.95)');
  grad.addColorStop(0.45, 'rgba(10, 12, 16, 0.65)');
  grad.addColorStop(0.8, 'rgba(10, 12, 16, 0.18)');
  grad.addColorStop(1.0, 'rgba(10, 12, 16, 0.0)');
  arCtx.fillStyle = grad;
  arCtx.fillRect(0, 0, 128, 128);
  const aoRadialTex = new THREE.CanvasTexture(aoRadCanvas);

  cachedSurfaceMaps = { anodized, machined, cast, hatchMap, aoRadialTex };
  return cachedSurfaceMaps;
}

/**
 * Tri-planar box UV projection in millimeter space (`mmScale` mm per UV tile).
 * Ensures `ExtrudeGeometry`, `LatheGeometry`, and merged parts share a uniform physical
 * texture density without stretching across bevels or side walls.
 */
export function normalizeGeometryUVs(geometry, mmScale = 56) {
  const pos = geometry.attributes.position;
  if (!pos) return geometry;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const nor = geometry.attributes.normal;
  const uvs = new Float32Array(pos.count * 2);
  const inv = 1 / Math.max(1e-3, mmScale);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    if (ny >= nx && ny >= nz) {
      uvs[i * 2] = x * inv;
      uvs[i * 2 + 1] = z * inv;
    } else if (nx >= ny && nx >= nz) {
      uvs[i * 2] = z * inv;
      uvs[i * 2 + 1] = y * inv;
    } else {
      uvs[i * 2] = x * inv;
      uvs[i * 2 + 1] = y * inv;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geometry;
}

export function createMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const maps = createSurfaceMaps();
  const v2 = (s) => new THREE.Vector2(s, s);

  return {
    alu: std({
      color: CAL_PALETTE.anodized,
      metalness: 0.88,
      roughness: 0.30,
      normalMap: maps.anodized.normalMap,
      roughnessMap: maps.anodized.roughnessMap,
      normalScale: v2(0.14),
    }),
    aluDark: std({
      color: CAL_PALETTE.anodizedDark,
      metalness: 0.85,
      roughness: 0.38,
      normalMap: maps.anodized.normalMap,
      roughnessMap: maps.anodized.roughnessMap,
      normalScale: v2(0.16),
    }),
    white: phys({
      color: CAL_PALETTE.powder,
      metalness: 0.05,
      roughness: 0.56,
      clearcoat: 0.22,
      clearcoatRoughness: 0.36,
      normalMap: maps.cast.normalMap,
      roughnessMap: maps.cast.roughnessMap,
      normalScale: v2(0.18),
    }),
    black: phys({
      color: CAL_PALETTE.structure,
      metalness: 0.34,
      roughness: 0.34,
      clearcoat: 0.42,
      clearcoatRoughness: 0.22,
      normalMap: maps.cast.normalMap,
      roughnessMap: maps.cast.roughnessMap,
      normalScale: v2(0.20),
    }),
    steel: std({
      color: CAL_PALETTE.steel,
      metalness: 0.98,
      roughness: 0.22,
      normalMap: maps.machined.normalMap,
      roughnessMap: maps.machined.roughnessMap,
      normalScale: v2(0.18),
    }),
    chrome: std({
      color: CAL_PALETTE.chrome,
      metalness: 1.0,
      roughness: 0.12,
      normalMap: maps.machined.normalMap,
      normalScale: v2(0.08),
    }),
    bronze: std({
      color: CAL_PALETTE.bronze,
      metalness: 0.92,
      roughness: 0.28,
      normalMap: maps.machined.normalMap,
      roughnessMap: maps.machined.roughnessMap,
      normalScale: v2(0.16),
    }),
    graphite: std({
      color: '#464C53',
      metalness: 0.62,
      roughness: 0.42,
      normalMap: maps.machined.normalMap,
      roughnessMap: maps.machined.roughnessMap,
      normalScale: v2(0.18),
    }),
    rubber: std({
      color: CAL_PALETTE.rubber,
      metalness: 0.06,
      roughness: 0.88,
      normalMap: maps.cast.normalMap,
      normalScale: v2(0.24),
    }),
    sectionCap: std({
      color: '#FFFFFF',
      map: maps.hatchMap,
      normalMap: maps.machined.normalMap,
      normalScale: v2(0.22),
      metalness: 0.55,
      roughness: 0.48,
      side: THREE.DoubleSide,
    }),
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
    accentGlow: new THREE.MeshBasicMaterial({
      color: CAL_PALETTE.accent,
      transparent: true,
      opacity: 0.22,
      toneMapped: false,
      depthWrite: false,
    }),
  };
}

// ============================================================================
// 3. INDUSTRIAL CSG-2D, MULTI-AXIS & BIONIC GEOMETRY PRIMITIVES + CREVICE AO
// ============================================================================

function makeRoundedRectShape(w, d, r = 4) {
  const rr = Math.max(0.01, Math.min(r, Math.min(w, d) / 2 - 0.01));
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
  return s;
}

function makeRoundedSlotPath(cx, cz, w, d, r = 2) {
  const rr = Math.max(0.01, Math.min(r, Math.min(w, d) / 2 - 0.01));
  const hw = w / 2;
  const hd = d / 2;
  // Clockwise winding so ExtrudeGeometry treats it as an interior hole
  const p = new THREE.Path();
  p.moveTo(cx - hw + rr, cz - hd);
  p.quadraticCurveTo(cx - hw, cz - hd, cx - hw, cz - hd + rr);
  p.lineTo(cx - hw, cz + hd - rr);
  p.quadraticCurveTo(cx - hw, cz + hd, cx - hw + rr, cz + hd);
  p.lineTo(cx + hw - rr, cz + hd);
  p.quadraticCurveTo(cx + hw, cz + hd, cx + hw, cz + hd - rr);
  p.lineTo(cx + hw, cz - hd + rr);
  p.quadraticCurveTo(cx + hw, cz - hd, cx + hw - rr, cz - hd);
  p.closePath();
  return p;
}

/** Rounded-corner box, extruded and centred on the origin. `w` × `d` is the footprint, `h` the height. */
export function blockGeometry({ w, h, d, r = 4, bevel = 1.2 }) {
  const s = makeRoundedRectShape(w, d, r);
  const bv = Math.min(bevel, Math.min(w, h, d) * 0.22);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.2, h - bv * 2),
    bevelEnabled: bv > 0.01,
    bevelThickness: bv,
    bevelSize: bv,
    bevelSegments: 2,
    curveSegments: 8,
    steps: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2 + bv, 0);
  g.computeVertexNormals();
  return normalizeGeometryUVs(g);
}

/**
 * 2D CSG boolean-subtracted plate / bulkhead / flange (`machinedPlateGeometry`).
 * Subtracts circular bores (`holes: [{ x = 0, z = 0, r }]`) and stadium/rounded-rect weight-relief
 * pockets or windows (`slots: [{ x = 0, z = 0, w, d, r }]`) before bevelled extrusion.
 */
export function machinedPlateGeometry({
  w,
  h,
  d,
  r = 5,
  bevel = 1.0,
  holes = [],
  slots = [],
  curveSegments = 24,
}) {
  const s = makeRoundedRectShape(w, d, r);
  for (const hole of holes) {
    const p = new THREE.Path();
    p.absarc(hole.x || 0, -(hole.z || 0), hole.r, 0, Math.PI * 2, true);
    s.holes.push(p);
  }
  for (const slot of slots) {
    s.holes.push(makeRoundedSlotPath(slot.x || 0, -(slot.z || 0), slot.w, slot.d, slot.r ?? Math.min(slot.w, slot.d) * 0.45));
  }
  const bv = Math.min(bevel, Math.min(w, h, d) * 0.2);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.2, h - bv * 2),
    bevelEnabled: bv > 0.01,
    bevelThickness: bv,
    bevelSize: bv,
    bevelSegments: 2,
    curveSegments,
    steps: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2 + bv, 0);
  g.computeVertexNormals();
  return normalizeGeometryUVs(g);
}

/**
 * Recessed counterbore boss / bearing seat (`counterboreBossGeometry`).
 * Lathes a watertight profile with a through-bore `rBore`, outer chamfered cylinder `rOuter`,
 * and stepped top counterbore pocket `rCounter` of depth `hCounter` so fasteners sit inside a
 * machined recess instead of floating on a flat surface.
 */
export function counterboreBossGeometry({
  rOuter = 11,
  rBore = 3.2,
  rCounter = 6.8,
  hTotal = 9,
  hCounter = 3.8,
  bevel = 0.8,
  seg = 32,
} = {}) {
  const y0 = -hTotal / 2;
  const y1 = hTotal / 2;
  const yc = y1 - clamp(hCounter, 0.5, hTotal - 1.0);
  const b = Math.min(bevel, (rOuter - rCounter) * 0.4, hTotal * 0.2);
  const profile = [
    [rBore, y0],
    [rOuter - b, y0],
    [rOuter, y0 + b],
    [rOuter, y1 - b],
    [rOuter - b, y1],
    [rCounter, y1],
    [rCounter, yc],
    [rBore, yc],
    [rBore, y0],
  ];
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  );
  g.computeVertexNormals();
  return normalizeGeometryUVs(g);
}

/**
 * Forged/machined I-beam connecting link or robotic limb segment (`ribbedLinkGeometry`).
 * Origin is at the midpoint between the two bearing centres (`y = -length/2` and `y = +length/2`).
 * Includes bored big/small ends, tapered flanges, and recessed front/back I-beam pockets.
 */
export function ribbedLinkGeometry({
  length = 143,
  rBig = 23,
  rSmall = 13.5,
  rBoreBig = 15,
  rBoreSmall = 8.5,
  beamW = 19,
  thickness = 16,
  webThickness = 5.5,
  bevel = 0.9,
} = {}) {
  const halfL = length / 2;
  const sh = new THREE.Shape();
  const w0 = beamW * 0.56;
  const w1 = beamW * 0.42;
  const yBig = -halfL;
  const ySmall = halfL;

  const aBig = Math.acos(clamp(w0 / rBig, -0.95, 0.95));
  const aSmall = Math.acos(clamp(w1 / rSmall, -0.95, 0.95));

  sh.absarc(0, yBig, rBig, aBig, Math.PI - aBig, true);
  sh.lineTo(-w1, ySmall - rSmall * Math.sin(aSmall));
  sh.absarc(0, ySmall, rSmall, Math.PI + aSmall, -aSmall, true);
  sh.closePath();

  if (rBoreBig > 0) {
    const hBig = new THREE.Path();
    hBig.absarc(0, yBig, rBoreBig, 0, Math.PI * 2, false);
    sh.holes.push(hBig);
  }
  if (rBoreSmall > 0) {
    const hSmall = new THREE.Path();
    hSmall.absarc(0, ySmall, rBoreSmall, 0, Math.PI * 2, false);
    sh.holes.push(hSmall);
  }

  // Subtract recessed I-beam web channels on front and back by building a central web + raised rim
  const rim = new THREE.Shape();
  rim.absarc(0, yBig, rBig, aBig, Math.PI - aBig, true);
  rim.lineTo(-w1, ySmall - rSmall * Math.sin(aSmall));
  rim.absarc(0, ySmall, rSmall, Math.PI + aSmall, -aSmall, true);
  rim.closePath();
  if (rBoreBig > 0) {
    const hBig = new THREE.Path();
    hBig.absarc(0, yBig, rBoreBig, 0, Math.PI * 2, false);
    rim.holes.push(hBig);
  }
  if (rBoreSmall > 0) {
    const hSmall = new THREE.Path();
    hSmall.absarc(0, ySmall, rBoreSmall, 0, Math.PI * 2, false);
    rim.holes.push(hSmall);
  }

  const slotBottom = yBig + rBig + 4;
  const slotTop = ySmall - rSmall - 4;
  const slotH = slotTop - slotBottom;
  const slotW = Math.max(3, (w0 + w1) - 7);
  if (slotH > 8 && slotW > 3) {
    const pocket = new THREE.Path();
    const cy = (slotBottom + slotTop) / 2;
    const hw = slotW / 2;
    const hh = slotH / 2;
    const pr = Math.min(hw * 0.85, 4);
    pocket.moveTo(-hw + pr, cy - hh);
    pocket.lineTo(hw - pr, cy - hh);
    pocket.quadraticCurveTo(hw, cy - hh, hw, cy - hh + pr);
    pocket.lineTo(hw, cy + hh - pr);
    pocket.quadraticCurveTo(hw, cy + hh, hw - pr, cy + hh);
    pocket.lineTo(-hw + pr, cy + hh);
    pocket.quadraticCurveTo(-hw, cy + hh, -hw, cy + hh - pr);
    pocket.lineTo(-hw, cy - hh + pr);
    pocket.quadraticCurveTo(-hw, cy - hh, -hw + pr, cy - hh);
    pocket.closePath();
    rim.holes.push(pocket);
  }

  const webGeo = new THREE.ExtrudeGeometry(sh, {
    depth: webThickness,
    bevelEnabled: false,
    curveSegments: 28,
  });
  webGeo.translate(0, 0, -webThickness / 2);

  const rimGeo = new THREE.ExtrudeGeometry(rim, {
    depth: Math.max(1, thickness - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 28,
  });
  rimGeo.translate(0, 0, -(thickness - bevel * 2) / 2);

  return normalizeGeometryUVs(mergeGeometries([webGeo, rimGeo]));
}

/**
 * Spur/helical gear blank from a tooth count — the rule that makes any two gears mesh:
 * pitch radius follows from the teeth, so a 24-tooth and a 52-tooth turn at 52:24.
 */
export function gearGeometry({
  teeth,
  rOut,
  rRoot,
  width,
  helix = 0,
  holeR = 0,
  lighteningHoles = 0,
  lighteningR = 0,
  bevel = 0.8,
}) {
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
  if (lighteningHoles > 0) {
    const pitchR = (rRoot + Math.max(holeR, rRoot * 0.25)) * 0.52;
    const lr = lighteningR || Math.min((rRoot - holeR) * 0.24, (pitchR * Math.PI) / (lighteningHoles * 1.8));
    if (lr > 1.5) {
      for (let i = 0; i < lighteningHoles; i++) {
        const a = (i * Math.PI * 2) / lighteningHoles;
        const p = new THREE.Path();
        p.absarc(Math.cos(a) * pitchR, Math.sin(a) * pitchR, lr, 0, Math.PI * 2, true);
        sh.holes.push(p);
      }
    }
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
  return normalizeGeometryUVs(g);
}

/** Coil spring as a swept tube; callers scale it along y (or use `poseCompressedSpring`) to show compression. */
export function helixGeometry({ r, wire, turns, len, seg = 160 }) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const a = u * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, u * len, Math.sin(a) * r));
  }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, wire, 10, false);
  return normalizeGeometryUVs(g);
}

/**
 * Hex-head / Socket-head fastener (`boltGeometry`) with recessed allen socket and flanged washer.
 */
export function boltGeometry({ r = 4, h = 6, washer = true }) {
  const profile = [
    [r * 0.46, h * 0.12],
    [r * 0.46, h * 0.5],
    [r * 0.92, h * 0.5],
    [r, h * 0.38],
    [r, -h * 0.5],
    [0, -h * 0.5],
    [0, h * 0.12],
    [r * 0.46, h * 0.12],
  ];
  const head = new THREE.LatheGeometry(
    profile.map(([rx, y]) => new THREE.Vector2(rx, y)),
    6,
  );
  if (!washer) {
    head.computeVertexNormals();
    return normalizeGeometryUVs(head);
  }
  const w = new THREE.CylinderGeometry(r * 1.62, r * 1.68, h * 0.28, 20);
  w.translate(0, -h / 2 + h * 0.14, 0);
  return normalizeGeometryUVs(mergeGeometries([head, w]));
}

/**
 * Parallel-transport (Bishop frame) variable-radius / elliptical spline sweep (`sweptProfileGeometry`).
 * Ideal for bionic octopus tentacles, tapered manifolds, hydraulic lines, and compliant continuum arms.
 * Pair with `updateSweptGeometry` for real-time deformation without recreating buffers.
 */
export function sweptProfileGeometry({
  points,
  radiusAt = 6,
  scaleZAt = null,
  tubularSeg = 48,
  radialSeg = 20,
  capEnds = true,
}) {
  const ringCount = tubularSeg + 1;
  const stride = radialSeg + 1;
  const bodyVerts = ringCount * stride;
  const capVerts = capEnds ? 2 * (radialSeg + 2) : 0;
  const totalVerts = bodyVerts + capVerts;

  const pos = new Float32Array(totalVerts * 3);
  const nor = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices = [];

  for (let i = 0; i < tubularSeg; i++) {
    for (let j = 0; j < radialSeg; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }
  if (capEnds) {
    const startCenter = bodyVerts;
    for (let j = 0; j < radialSeg; j++) {
      indices.push(startCenter, startCenter + 1 + ((j + 1) % stride), startCenter + 1 + j);
    }
    const endCenter = bodyVerts + radialSeg + 2;
    for (let j = 0; j < radialSeg; j++) {
      indices.push(endCenter, endCenter + 1 + j, endCenter + 1 + ((j + 1) % stride));
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.userData.sweepMeta = { tubularSeg, radialSeg, capEnds };

  updateSweptGeometry(geo, points, radiusAt, scaleZAt);
  return geo;
}

/**
 * Recompute vertex positions and normals of a `sweptProfileGeometry` along updated 3D `points`.
 */
export function updateSweptGeometry(geo, points, radiusAt = 6, scaleZAt = null) {
  const { tubularSeg, radialSeg, capEnds } = geo.userData.sweepMeta;
  const ringCount = tubularSeg + 1;
  const stride = radialSeg + 1;
  const bodyVerts = ringCount * stride;

  const vecPts = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2])));
  const curve = new THREE.CatmullRomCurve3(vecPts);
  const rFn = typeof radiusAt === 'function' ? radiusAt : () => radiusAt;
  const zFn = typeof scaleZAt === 'function' ? scaleZAt : () => (scaleZAt ?? 1);

  const posAttr = geo.attributes.position;
  const uvsAttr = geo.attributes.uv;
  const pos = posAttr.array;
  const uvs = uvsAttr.array;

  const T = new THREE.Vector3();
  const prevT = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const rotAxis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const P = new THREE.Vector3();

  for (let i = 0; i <= tubularSeg; i++) {
    const u = i / tubularSeg;
    curve.getPointAt(u, P);
    curve.getTangentAt(u, T).normalize();

    if (i === 0) {
      const up = Math.abs(T.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      B.crossVectors(T, up).normalize();
      N.crossVectors(B, T).normalize();
    } else {
      rotAxis.crossVectors(prevT, T);
      const sinA = rotAxis.length();
      if (sinA > 1e-5) {
        rotAxis.divideScalar(sinA);
        const cosA = clamp(prevT.dot(T), -1, 1);
        q.setFromAxisAngle(rotAxis, Math.atan2(sinA, cosA));
        N.applyQuaternion(q);
      }
      N.sub(T.clone().multiplyScalar(N.dot(T))).normalize();
      B.crossVectors(T, N).normalize();
    }
    prevT.copy(T);

    const rx = rFn(u);
    const rz = rx * zFn(u);
    for (let j = 0; j <= radialSeg; j++) {
      const v = j / radialSeg;
      const ang = v * Math.PI * 2;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const idx = (i * stride + j) * 3;
      pos[idx] = P.x + N.x * ca * rx + B.x * sa * rz;
      pos[idx + 1] = P.y + N.y * ca * rx + B.y * sa * rz;
      pos[idx + 2] = P.z + N.z * ca * rx + B.z * sa * rz;
      const uvIdx = (i * stride + j) * 2;
      uvs[uvIdx] = u * 6;
      uvs[uvIdx + 1] = v * 2;
    }

    if (capEnds && (i === 0 || i === tubularSeg)) {
      const capBase = i === 0 ? bodyVerts : bodyVerts + radialSeg + 2;
      pos[capBase * 3] = P.x;
      pos[capBase * 3 + 1] = P.y;
      pos[capBase * 3 + 2] = P.z;
      for (let j = 0; j <= radialSeg; j++) {
        const ringIdx = (i * stride + j) * 3;
        const cIdx = (capBase + 1 + j) * 3;
        pos[cIdx] = pos[ringIdx];
        pos[cIdx + 1] = pos[ringIdx + 1];
        pos[cIdx + 2] = pos[ringIdx + 2];
      }
    }
  }

  posAttr.needsUpdate = true;
  uvsAttr.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Accordion-pleated hydraulic/pneumatic bellows or soft actuator (`bellowsGeometry`).
 */
export function bellowsGeometry({ rInner = 9, rOuter = 14, rBore = 0, ribs = 7, len = 36, seg = 36 } = {}) {
  const profile = [];
  const y0 = -len / 2;
  const step = len / ribs;
  if (rBore > 0) profile.push([rBore, y0]);
  else profile.push([0, y0]);
  profile.push([rInner, y0]);

  for (let i = 0; i < ribs; i++) {
    const ya = y0 + i * step;
    const ym = ya + step * 0.5;
    const yb = ya + step;
    profile.push([rInner, ya + step * 0.12]);
    profile.push([rOuter, ym - step * 0.08]);
    profile.push([rOuter, ym + step * 0.08]);
    profile.push([rInner, yb - step * 0.12]);
  }
  profile.push([rInner, y0 + len]);
  if (rBore > 0) {
    profile.push([rBore, y0 + len]);
    profile.push([rBore, y0]);
  } else {
    profile.push([0, y0 + len]);
  }

  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  );
  g.computeVertexNormals();
  return normalizeGeometryUVs(g);
}

/**
 * Spherical ball-and-socket joint primitive (`ballJointGeometry`) for multi-DOF arms & tentacles.
 */
export function ballJointGeometry({
  rBall = 10,
  rSocket = 12.6,
  neckR = 4.6,
  neckLen = 14,
  cupAngle = Math.PI * 0.62,
  seg = 32,
} = {}) {
  const ball = new THREE.SphereGeometry(rBall, seg, Math.round(seg * 0.65));
  const neck = new THREE.CylinderGeometry(neckR, neckR * 1.12, neckLen, Math.round(seg * 0.75));
  neck.translate(0, -rBall * 0.7 - neckLen / 2, 0);
  const ballGeo = normalizeGeometryUVs(mergeGeometries([ball, neck]));

  const socketProfile = [];
  const steps = 16;
  const rInner = rBall + 0.35;
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * cupAngle;
    socketProfile.push([Math.max(0, Math.cos(a) * rSocket), Math.sin(a) * rSocket]);
  }
  for (let i = steps; i >= 0; i--) {
    const a = -Math.PI / 2 + (i / steps) * cupAngle;
    socketProfile.push([Math.max(0, Math.cos(a) * rInner), Math.sin(a) * rInner]);
  }
  socketProfile.push(socketProfile[0]);
  const socketGeo = normalizeGeometryUVs(
    new THREE.LatheGeometry(
      socketProfile.map(([r, y]) => new THREE.Vector2(r, y)),
      seg,
    ),
  );
  return { ballGeo, socketGeo };
}

/**
 * Analytical Crevice AO ring (`creviceAoRing`) for fastener bases, cylinder flanges, and shaft shoulders.
 * Grounds intersecting parts so they never look pasted together.
 */
export function creviceAoRing({ rIn = 4, rOut = 9, opacity = 0.46, seg = 32 } = {}) {
  const g = new THREE.RingGeometry(rIn, rOut, seg, 1);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const alphas = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    const u = clamp((r - rIn) / Math.max(1e-3, rOut - rIn), 0, 1);
    const fade = Math.pow(1 - u, 1.8);
    colors[i * 3] = 0.05;
    colors[i * 3 + 1] = 0.06;
    colors[i * 3 + 2] = 0.08;
    alphas[i] = fade;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const maps = createSurfaceMaps();
  const mat = new THREE.MeshBasicMaterial({
    color: '#0D1014',
    alphaMap: maps.aoRadialTex,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    toneMapped: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rOut * 2.1, rOut * 2.1).rotateX(-Math.PI / 2), mat);
  m.castShadow = false;
  m.receiveShadow = false;
  m.userData.skipContactShadow = true;
  return m;
}

/**
 * Rectangular Crevice AO collar (`creviceAoBox`) for box walls, deck joints, and mounting bases.
 */
export function creviceAoBox({ w = 100, d = 100, spread = 12, opacity = 0.38 } = {}) {
  const maps = createSurfaceMaps();
  const mat = new THREE.MeshBasicMaterial({
    color: '#0D1014',
    alphaMap: maps.aoRadialTex,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    toneMapped: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w + spread * 2, d + spread * 2).rotateX(-Math.PI / 2), mat);
  m.castShadow = false;
  m.receiveShadow = false;
  m.userData.skipContactShadow = true;
  return m;
}

/** Minimal BufferGeometry merge (preserves position, normal, and uv attributes). */
export function mergeGeometries(list) {
  let vCount = 0;
  let iCount = 0;
  for (const g of list) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uvs = new Float32Array(vCount * 2);
  const idx = new Uint32Array(iCount);
  let vo = 0;
  let io = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, vo * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uvs.set(g.attributes.uv.array, vo * 2);
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
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeVertexNormals();
  return out;
}

// ============================================================================
// 4. TRUE STENCIL SECTION-CUT MANAGER (AUTOMATIC CROSS-HATCH CAPS)
// ============================================================================

/**
 * Automatic Stencil-Buffer Section Cut Manager (`createSectionCutManager`).
 *
 * Replaces fragile hand-placed `BoxGeometry` caps with exact WebGL Stencil Capping:
 *   1. Every registered shell mesh (`addShell(mesh)`) gets `BackSide` (increment stencil) and
 *      `FrontSide` (decrement stencil) stencil helper children attached directly to `mesh`, so even
 *      rotating, exploding, or multi-DOF tentacle parts carry their stencil volumes automatically.
 *   2. A single 45° CNC cross-hatched `capPlaneMesh` aligned with `plane` draws ONLY where
 *      `stencil != 0` and resets the stencil buffer to 0, sealing cooling fins, rounded corners,
 *      bored holes, and curved manifolds with pixel-perfect accuracy.
 */
export function createSectionCutManager({
  scene,
  plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.9),
  capMaterial = null,
  size = 16,
} = {}) {
  const materials = new Set();
  const stencilHelpers = [];

  const backStencilMat = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    clippingPlanes: [plane],
    depthTest: false,
    depthWrite: false,
    colorWrite: false,
    stencilWrite: true,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.IncrementWrapStencilOp,
  });

  const frontStencilMat = new THREE.MeshBasicMaterial({
    side: THREE.FrontSide,
    clippingPlanes: [plane],
    depthTest: false,
    depthWrite: false,
    colorWrite: false,
    stencilWrite: true,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.DecrementWrapStencilOp,
  });

  const baseCapMat = capMaterial || createMaterials().sectionCap;
  const stencilCapMat = baseCapMat.clone();
  stencilCapMat.stencilWrite = true;
  stencilCapMat.stencilRef = 0;
  stencilCapMat.stencilFunc = THREE.NotEqualStencilFunc;
  stencilCapMat.stencilFail = THREE.ReplaceStencilOp;
  stencilCapMat.stencilZFail = THREE.ReplaceStencilOp;
  stencilCapMat.stencilZPass = THREE.ReplaceStencilOp;
  stencilCapMat.polygonOffset = true;
  stencilCapMat.polygonOffsetFactor = -1;
  stencilCapMat.polygonOffsetUnits = -1;

  const capPlaneMesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), stencilCapMat);
  capPlaneMesh.renderOrder = 2;
  capPlaneMesh.castShadow = false;
  capPlaneMesh.receiveShadow = false;
  capPlaneMesh.visible = false;
  capPlaneMesh.userData.skipContactShadow = true;
  if (scene) scene.add(capPlaneMesh);

  function addShell(meshOrGroup) {
    meshOrGroup.traverse((m) => {
      if (!m.isMesh || m.userData.isStencilHelper) return;
      if (m.material) {
        const list = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of list) materials.add(mat);
      }
      const bMesh = new THREE.Mesh(m.geometry, backStencilMat);
      bMesh.renderOrder = 1;
      bMesh.castShadow = false;
      bMesh.receiveShadow = false;
      bMesh.visible = false;
      bMesh.userData.isStencilHelper = true;
      bMesh.userData.skipContactShadow = true;

      const fMesh = new THREE.Mesh(m.geometry, frontStencilMat);
      fMesh.renderOrder = 1;
      fMesh.castShadow = false;
      fMesh.receiveShadow = false;
      fMesh.visible = false;
      fMesh.userData.isStencilHelper = true;
      fMesh.userData.skipContactShadow = true;

      m.add(bMesh, fMesh);
      stencilHelpers.push(bMesh, fMesh);
    });
    return meshOrGroup;
  }

  let activeState = null;
  const tmpPt = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  function update({ enabled = false, constant = plane.constant, normal = null } = {}) {
    if (normal) plane.normal.copy(normal).normalize();
    plane.constant = constant;

    if (enabled !== activeState) {
      activeState = enabled;
      for (const mat of materials) {
        mat.clippingPlanes = enabled ? [plane] : null;
        mat.side = enabled ? THREE.DoubleSide : THREE.FrontSide;
        mat.needsUpdate = true;
      }
      for (const h of stencilHelpers) h.visible = enabled;
      capPlaneMesh.visible = enabled;
    }

    if (enabled) {
      plane.coplanarPoint(tmpPt);
      capPlaneMesh.position.copy(tmpPt);
      tmpLook.copy(tmpPt).sub(plane.normal);
      capPlaneMesh.lookAt(tmpLook);
    }
  }

  return { plane, capPlaneMesh, materials, addShell, update };
}

// ============================================================================
// 5. MULTI-DOF KINEMATICS & SECONDARY LINKAGE SOLVERS
// ============================================================================

/**
 * 3D FABRIK Inverse Kinematics Solver (`solveFabrikChain`) with joint cone limits.
 * Mutates and returns `joints` (array of `THREE.Vector3` in world/root space).
 */
export function solveFabrikChain({
  joints,
  lengths,
  target,
  basePos = null,
  maxIter = 8,
  maxConeAngle = Math.PI * 0.42,
}) {
  const n = joints.length;
  if (n < 2) return joints;
  const root = basePos ? new THREE.Vector3(...(basePos.isVector3 ? [basePos.x, basePos.y, basePos.z] : basePos)) : joints[0].clone();
  const goal = target.isVector3 ? target : new THREE.Vector3(target[0], target[1], target[2]);
  const dir = new THREE.Vector3();
  const prevDir = new THREE.Vector3();
  const axis = new THREE.Vector3();

  for (let iter = 0; iter < maxIter; iter++) {
    // Backward reaching: pull tip to target
    joints[n - 1].copy(goal);
    for (let i = n - 2; i >= 0; i--) {
      dir.subVectors(joints[i], joints[i + 1]).normalize();
      joints[i].copy(joints[i + 1]).addScaledVector(dir, lengths[i]);
    }
    // Forward reaching: anchor root and enforce cone angle limits
    joints[0].copy(root);
    for (let i = 0; i < n - 1; i++) {
      dir.subVectors(joints[i + 1], joints[i]).normalize();
      if (i > 0 && maxConeAngle < Math.PI) {
        prevDir.subVectors(joints[i], joints[i - 1]).normalize();
        const dot = clamp(prevDir.dot(dir), -1, 1);
        const ang = Math.acos(dot);
        if (ang > maxConeAngle) {
          axis.crossVectors(prevDir, dir);
          if (axis.lengthSq() > 1e-6) {
            axis.normalize();
            dir.copy(prevDir).applyAxisAngle(axis, maxConeAngle);
          }
        }
      }
      joints[i + 1].copy(joints[i]).addScaledVector(dir, lengths[i]);
    }
  }
  return joints;
}

/**
 * Multi-DOF Traveling-Wave + Whip-Damped + IK-Blended Kinematic Chain (`solveKinematicChain`).
 * Designed for bionic octopus tentacles, hyper-redundant continuum arms, and articulated spines.
 */
export function solveKinematicChain({
  count = 10,
  segLengths = 18,
  basePos = [0, 0, 0],
  baseDir = [0, 1, 0],
  upDir = [0, 0, 1],
  t = 0,
  freq = 2.2,
  waveNumber = 2.6,
  ampYaw = 0.28,
  ampPitch = 0.18,
  whip = 1.45,
  curl = 0.0,
  target = null,
  ikMix = 0.0,
} = {}) {
  const lengths = Array.from({ length: count }, (_, i) =>
    typeof segLengths === 'function' ? segLengths(i) : Array.isArray(segLengths) ? segLengths[i] : segLengths,
  );
  const positions = [new THREE.Vector3(...(basePos.isVector3 ? [basePos.x, basePos.y, basePos.z] : basePos))];
  const tangents = [];
  const quaternions = [];

  const T = new THREE.Vector3(...baseDir).normalize();
  const U = new THREE.Vector3(...upDir).normalize();
  const R = new THREE.Vector3().crossVectors(T, U).normalize();
  U.crossVectors(R, T).normalize();

  const qSeg = new THREE.Quaternion();
  const basisMat = new THREE.Matrix4();

  for (let i = 0; i < count; i++) {
    const u = i / Math.max(1, count - 1);
    const env = Math.pow(u + 0.15, whip);
    const phase = t * freq - u * waveNumber * Math.PI * 2;
    const dYaw = Math.sin(phase) * ampYaw * env;
    const dPitch = Math.cos(phase * 0.85 + 0.6) * ampPitch * env + curl / count;

    qSeg.setFromAxisAngle(U, dYaw);
    T.applyQuaternion(qSeg).normalize();
    R.crossVectors(T, U).normalize();

    qSeg.setFromAxisAngle(R, dPitch);
    T.applyQuaternion(qSeg).normalize();
    U.crossVectors(R, T).normalize();

    positions.push(positions[i].clone().addScaledVector(T, lengths[i]));
  }

  if (target && ikMix > 1e-3) {
    const ikPts = positions.map((p) => p.clone());
    solveFabrikChain({ joints: ikPts, lengths, target, basePos: positions[0] });
    for (let i = 1; i <= count; i++) {
      positions[i].lerp(ikPts[i], clamp(ikMix, 0, 1));
    }
  }

  const prevT = new THREE.Vector3(...baseDir).normalize();
  for (let i = 0; i < count; i++) {
    const segT = new THREE.Vector3().subVectors(positions[i + 1], positions[i]).normalize();
    tangents.push(segT);
    const segR = new THREE.Vector3().crossVectors(segT, U);
    if (segR.lengthSq() < 1e-5) segR.set(1, 0, 0);
    else segR.normalize();
    const segU = new THREE.Vector3().crossVectors(segR, segT).normalize();
    basisMat.makeBasis(segR, segT, segU);
    quaternions.push(new THREE.Quaternion().setFromRotationMatrix(basisMat));
    prevT.copy(segT);
  }

  return { positions, tangents, quaternions, lengths };
}

/** Exact closed-form 2-link planar IK solver (`solveTwoLinkIK2D`). */
export function solveTwoLinkIK2D(dx, dy, L1, L2, elbowSign = 1) {
  const d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1e-4, L1 + L2 - 1e-4);
  const cosKnee = clamp((dx * dx + dy * dy - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
  const q2 = elbowSign * Math.acos(cosKnee);
  const q1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
  return {
    q1,
    q2,
    elbow: [Math.cos(q1) * L1, Math.sin(q1) * L1],
    tip: [Math.cos(q1) * L1 + Math.cos(q1 + q2) * L2, Math.sin(q1) * L1 + Math.sin(q1 + q2) * L2],
  };
}

/**
 * Align a 2-part telescopic hydraulic actuator, shock absorber or pushrod between `pointA` and `pointB`.
 */
export function poseActuator(cylinderObj, plungerObj, pointA, pointB) {
  const a = pointA.isVector3 ? pointA : new THREE.Vector3(...pointA);
  const b = pointB.isVector3 ? pointB : new THREE.Vector3(...pointB);
  const dir = new THREE.Vector3().subVectors(b, a);
  const dist = dir.length();
  if (dist < 1e-4) return dist;
  dir.divideScalar(dist);
  const up = new THREE.Vector3(0, 1, 0);
  if (cylinderObj) {
    cylinderObj.position.copy(a);
    cylinderObj.quaternion.setFromUnitVectors(up, dir);
  }
  if (plungerObj) {
    plungerObj.position.copy(b);
    plungerObj.quaternion.setFromUnitVectors(up, dir.clone().negate());
  }
  return dist;
}

/**
 * Compress/extend a coil spring or bellows along Y with volume-conserving radial bulge (`scaleXZ`).
 */
export function poseCompressedSpring(springObj, restLen, currentLen) {
  const sy = clamp(currentLen / Math.max(1e-3, restLen), 0.15, 2.5);
  const sxz = 1 + (1 - sy) * 0.11;
  springObj.scale.set(sxz, sy, sxz);
}

/**
 * Staged-explode easing (`layerEase`): layers leave in order inside `[from, to]`.
 */
export function layerEase(ex, [from, to], distance) {
  return smootherstep(from, to, clamp(ex, 0, 1)) * distance;
}

// ============================================================================
// 6. PHYSICAL FIELD SHADERS, TORQUE ARCS & 3D METROLOGY CALLOUTS
// ============================================================================

const PRESSURE_VS = `
#include <clipping_planes_pars_vertex>
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewPos;
void main() {
  #include <begin_vertex>
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  vViewPos = -mvPosition.xyz;
  vNormalView = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}
`;

const PRESSURE_FS = `
#include <clipping_planes_pars_fragment>
uniform vec3 uBaseColor;
uniform vec3 uHotColor;
uniform float uPressure;
uniform float uBurn;
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewPos;

void main() {
  #include <clipping_planes_fragment>
  vec3 N = normalize(vNormalView);
  vec3 V = normalize(vViewPos);
  float fresnel = pow(1.0 - abs(dot(N, V)), 1.35);
  float core = 0.38 + 0.62 * (1.0 - fresnel * 0.65);

  // Stratified axial pressure waves + crown combustion front near vUv.y = 1.0
  float crownHeat = smoothstep(0.32, 0.98, vUv.y) * (0.45 + 0.55 * uBurn);
  float wave = 0.5 + 0.5 * sin((vUv.y * 16.0 - uTime * 5.0) + uPressure * 4.0);
  float band = smoothstep(0.25, 0.85, wave) * (0.28 + 0.52 * uPressure);

  vec3 col = mix(uBaseColor, uHotColor, clamp(crownHeat + band * 0.45 * uBurn, 0.0, 1.0));
  float alpha = uOpacity * core * (0.55 + 0.45 * crownHeat + 0.35 * band);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.78));
}
`;

/**
 * Thermodynamic / Fluid Pressure Field Shader Material (`createPressureFieldMaterial`).
 * Renders stratified axial isobar waves and crown thermal gradients inside an actuator or bore,
 * while natively respecting `clippingPlanes` during section cuts.
 */
export function createPressureFieldMaterial({ clipPlane = null } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: PRESSURE_VS,
    fragmentShader: PRESSURE_FS,
    uniforms: {
      uBaseColor: { value: new THREE.Color('#6E9EC2') },
      uHotColor: { value: new THREE.Color(CAL_PALETTE.accent) },
      uPressure: { value: 0.4 },
      uBurn: { value: 0.0 },
      uTime: { value: 0.0 },
      uOpacity: { value: 0.42 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    clipping: true,
    clippingPlanes: clipPlane ? [clipPlane] : null,
  });
}

/**
 * Sleek 3D Torque / Force Flow Ribbon (`createTorqueArc`) with directional chevron tip.
 * Replaces toy-like cone arrows with an instrument-grade concentric vector arc.
 */
export function createTorqueArc({
  radius = 42,
  width = 5.5,
  thick = 1.6,
  spanDeg = 96,
  color = CAL_PALETTE.accent,
} = {}) {
  const group = new THREE.Group();
  const span = (spanDeg * Math.PI) / 180;
  const segs = 32;
  const arcPts = [];
  for (let i = 0; i <= segs; i++) {
    const a = -span / 2 + (i / segs) * span * 0.82;
    arcPts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const bodyGeo = sweptProfileGeometry({
    points: arcPts,
    radiusAt: width * 0.38,
    scaleZAt: thick / Math.max(1, width * 0.76),
    tubularSeg: segs,
    radialSeg: 12,
  });
  const body = new THREE.Mesh(bodyGeo, mat);
  body.castShadow = false;
  body.userData.skipContactShadow = true;
  group.add(body);

  // Precision arrowhead at the leading end of the arc
  const aTip = span / 2;
  const aBase = -span / 2 + span * 0.80;
  const head = new THREE.Mesh(new THREE.ConeGeometry(width * 0.9, width * 2.1, 14), mat);
  head.position.set(Math.cos(aBase) * radius, Math.sin(aBase) * radius, 0);
  const tangent = new THREE.Vector3(-Math.sin(aBase), Math.cos(aBase), 0).normalize();
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  head.castShadow = false;
  head.userData.skipContactShadow = true;
  void aTip;
  group.add(head);

  return {
    group,
    material: mat,
    setDirection(ccw = true) {
      group.scale.y = ccw ? 1 : -1;
    },
  };
}

/**
 * 3D Engineering Dimension & Tolerance Callout (`createDimensionCallout`).
 * Draws extension witness lines, opposing precision tick arrows, and a high-DPI `JetBrains Mono`
 * dimension plaque in 3D space (e.g. `Ø84.00 ±0.02`, `STROKE 86.0 mm`) that can track moving
 * or exploding parts in real time via `update({ y0, y1, text, opacity })`.
 */
export function createDimensionCallout({
  text = 'Ø84.00 ±0.02',
  label = 'BORE',
  x = 92,
  y0 = 32,
  y1 = 212,
  witnessX = 72,
  accent = false,
} = {}) {
  const group = new THREE.Group();
  group.userData.skipContactShadow = true;

  const lineColor = accent ? CAL_PALETTE.accent : '#2A3038';
  const lineMat = new THREE.MeshBasicMaterial({
    color: lineColor,
    transparent: true,
    opacity: 0.88,
    toneMapped: false,
  });

  const stem = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1, 1.1), lineMat);
  const ext0 = new THREE.Mesh(new THREE.BoxGeometry(1, 1.0, 1.0), lineMat);
  const ext1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1.0, 1.0), lineMat);
  const tip0 = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6.5, 10), lineMat);
  const tip1 = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6.5, 10), lineMat);
  tip0.rotation.z = Math.PI;
  group.add(stem, ext0, ext1, tip0, tip1);

  // High-DPI canvas badge for the dimension value
  const bCanvas = document.createElement('canvas');
  bCanvas.width = 320;
  bCanvas.height = 88;
  const bCtx = bCanvas.getContext('2d');
  const bTex = new THREE.CanvasTexture(bCanvas);
  bTex.encoding = THREE.sRGBEncoding;
  bTex.minFilter = THREE.LinearFilter;
  const badgeMat = new THREE.MeshBasicMaterial({
    map: bTex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(78, 21.5), badgeMat);
  group.add(badge);

  let lastText = '';
  let lastLabel = '';

  function drawBadge(valText, subLabel) {
    if (valText === lastText && subLabel === lastLabel) return;
    lastText = valText;
    lastLabel = subLabel;
    bCtx.clearRect(0, 0, 320, 88);
    bCtx.fillStyle = 'rgba(250, 251, 252, 0.94)';
    bCtx.fillRect(2, 2, 316, 84);
    bCtx.strokeStyle = accent ? CAL_PALETTE.accent : '#8A929C';
    bCtx.lineWidth = 3;
    bCtx.strokeRect(2, 2, 316, 84);
    bCtx.fillStyle = accent ? CAL_PALETTE.accent : '#15181C';
    bCtx.fillRect(2, 2, 8, 84);

    bCtx.font = '700 18px "JetBrains Mono", monospace';
    bCtx.fillStyle = '#68707A';
    bCtx.fillText(subLabel.toUpperCase(), 22, 29);

    bCtx.font = '800 30px "JetBrains Mono", monospace';
    bCtx.fillStyle = '#15181C';
    bCtx.fillText(valText, 22, 68);
    bTex.needsUpdate = true;
  }

  function update(opts = {}) {
    const ya = opts.y0 ?? y0;
    const yb = opts.y1 ?? y1;
    const cx = opts.x ?? x;
    const wx = opts.witnessX ?? witnessX;
    const op = opts.opacity ?? 1;
    group.visible = op > 0.02;
    if (!group.visible) return;

    lineMat.opacity = 0.86 * op;
    badgeMat.opacity = op;
    drawBadge(opts.text ?? text, opts.label ?? label);

    const span = Math.max(8, Math.abs(yb - ya));
    const midY = (ya + yb) / 2;
    stem.position.set(cx, midY, 0);
    stem.scale.y = span;

    const extLen = Math.abs(cx - wx) + 6;
    const extMid = (wx + cx + Math.sign(cx - wx) * 3) / 2;
    ext0.position.set(extMid, ya, 0);
    ext0.scale.x = extLen;
    ext1.position.set(extMid, yb, 0);
    ext1.scale.x = extLen;

    tip0.position.set(cx, ya + 3.2, 0);
    tip1.position.set(cx, yb - 3.2, 0);
    badge.position.set(cx + Math.sign(cx || 1) * 46, midY, 2);
  }

  update({ y0, y1, text, label, opacity: 1 });
  return { group, update };
}

/** Interpolate two director framing boxes (`{ center, size }`). */
export function lerpFramingBox(boxA, boxB, u) {
  const k = clamp(u, 0, 1);
  return {
    center: boxA.center.map((v, i) => lerp(v, boxB.center[i], k)),
    size: boxA.size.map((v, i) => lerp(v, boxB.size[i], k)),
  };
}

/** Blend a sparse radial outer bounding box with a dense core bounding box by `coreWeight`. */
export function weightedCoreBox(coreBox, fullBox, coreWeight = 0.72) {
  return lerpFramingBox(fullBox, coreBox, clamp(coreWeight, 0, 1));
}

// ============================================================================
// 7. STUDIO + ENGRAVED BENCH + INSTRUMENT HUD
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

export function createCalLabStudio({ width, height, scenes = [], style = {}, maxDist = null }) {
  const studio = createStudio3D(THREE, {
    width,
    height,
    baseFov: 28,
    scenes,
    look: resolveLook(LOOK_DEFAULTS, CAL_LOOK, style.look),
    presets: resolveLook(LOOK_PRESETS, CAL_LOOK_PRESETS, style.looks),
    maxDist,
  });
  studio.renderer.localClippingEnabled = true;

  const benchTex = createBenchTexture();
  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.12, 6.4),
    new THREE.MeshStandardMaterial({ map: benchTex, color: '#FFFFFF', roughness: 0.86, metalness: 0.02 }),
  );
  bench.position.set(0, -0.06, 0);
  bench.receiveShadow = true;
  studio.scene.add(bench);

  return { ...studio, bench, benchTex };
}

const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';

function spacedText(ctx, text, x, y, spacing) {
  if (!spacing) {
    ctx.fillText(text, x, y);
    return;
  }
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

    crosshair(m * 0.55, m * 0.55);
    crosshair(W - m * 0.55, m * 0.55);
    crosshair(m * 0.55, H - m * 0.55);
    crosshair(W - m * 0.55, H - m * 0.55);

    ctx.fillStyle = accent;
    ctx.fillRect(m, m, Math.round(46 * u), Math.max(2, Math.round(3 * u)));
    ctx.fillStyle = CAL_PALETTE.ink;
    ctx.font = `700 ${Math.round(27 * u)}px ${SANS}`;
    ctx.fillText(state.title || 'CALIBRATION', m, m + Math.round(34 * u));
    ctx.font = `500 ${Math.round(12.5 * u)}px ${MONO}`;
    ctx.fillStyle = CAL_PALETTE.muted;
    spacedText(ctx, (state.subtitle || '').toUpperCase(), m, m + Math.round(54 * u), 1.6 * u);

    const bigY = m + Math.round((portrait ? 104 : 118) * u);
    const big = state.big || { label: '', value: '—', unit: '' };
    ctx.fillStyle = CAL_PALETTE.muted;
    ctx.font = `600 ${Math.round(12 * u)}px ${MONO}`;
    spacedText(ctx, (big.label || '').toUpperCase(), m, bigY - Math.round(10 * u), 1.5 * u);
    ctx.fillStyle = CAL_PALETTE.ink;
    ctx.font = `800 ${Math.round((portrait ? 54 : 62) * u)}px ${MONO}`;
    const bigText = String(big.value);
    ctx.fillText(bigText, m, bigY + Math.round(54 * u));
    const bw = ctx.measureText(bigText).width;
    ctx.fillStyle = CAL_PALETTE.muted;
    ctx.font = `600 ${Math.round(18 * u)}px ${MONO}`;
    ctx.fillText(big.unit || '', m + bw + Math.round(9 * u), bigY + Math.round(54 * u));

    const phase = state.phase;
    if (phase && phase.labels) {
      const cellW = Math.round(portrait ? (W - m * 2) / 4 : 104 * u);
      const cellH = Math.round(28 * u);
      const py = H - m - cellH - Math.round(16 * u);
      const stripW = cellW * phase.labels.length;
      ctx.fillStyle = 'rgba(250, 251, 252, 0.88)';
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
        ctx.font = `600 ${Math.round(12 * u)}px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText(label, x + cellW / 2, py + cellH * 0.68);
        ctx.textAlign = 'left';
      });
      ctx.fillStyle = CAL_PALETTE.muted;
      ctx.font = `500 ${Math.round(12 * u)}px ${MONO}`;
      spacedText(ctx, 'CYCLE 0–720° · 1 DOF DERIVED', m, py - Math.round(8 * u), 1.2 * u);
    }

    const plot = state.plot;
    if (plot) {
      const size = Math.round(portrait ? Math.min(W * 0.62, 360 * u) : square ? 300 * u : 340 * u);
      const px = W - m - size;
      const py = portrait ? m + Math.round(90 * u) : m + Math.round(28 * u);
      panel(px, py, size, size + Math.round(30 * u));
      ctx.fillStyle = CAL_PALETTE.ink;
      ctx.font = `700 ${Math.round(12 * u)}px ${MONO}`;
      spacedText(ctx, plot.title || 'PLOT', px + Math.round(12 * u), py + Math.round(20 * u), 1.3 * u);
      const x0 = px + Math.round(34 * u);
      const y0 = py + Math.round(30 * u);
      const pw = size - Math.round(48 * u);
      const ph = size - Math.round(46 * u);
      const X = (v) => x0 + clamp(v / (plot.xMax || 1), 0, 1) * pw;
      const Y = (v) => y0 + ph - clamp(v / (plot.yMax || 1), 0, 1) * ph;
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
      ctx.font = `500 ${Math.round(12 * u)}px ${MONO}`;
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

    tex.needsUpdate = true;
  }

  return { plane, canvas, texture: tex, draw, fit };
}
