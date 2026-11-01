/**
 * Calibration Lab · Default Showcase Story (`styles/calibration-lab/world.js`).
 *
 * Separation of concerns (see `kernel.js`):
 *   - `./kernel.js` owns the reusable medium: pale studio, anodized materials, gear/spring/block
 *     primitives, the instrument HUD and staged-explode easing.
 *   - THIS file owns one subject only: a single-cylinder four-stroke sample on a calibration bench.
 *
 * Everything that moves is a pure function of one input, crank angle `th` (degrees):
 * piston position from the closed-form slider-crank, valve lift from its opening window,
 * chamber pressure from polytropic compression + a fast burn. Nothing is keyframed by hand,
 * so the film, the HUD and the section cut can never disagree with the motion.
 *
 * Authoring a different machine: keep the kernel, replace the subject below.
 */

import '../../engine/vendor/three.min.js';
import { clamp, lerp, smootherstep } from '../../engine/motion.js';
import {
  CAL_PALETTE,
  blockGeometry,
  boltGeometry,
  createCalLabStudio,
  createGaugeHud,
  createMaterials,
  gearGeometry,
  helixGeometry,
  layerEase,
} from './kernel.js';

const THREE = globalThis.THREE;
const DEG = Math.PI / 180;

// ============================================================================
// 1. THE SAMPLE — one source of truth for every number on screen
// ============================================================================

const K = {
  bore: 84, // mm
  crankR: 43,
  rod: 143,
  comp: 24, // piston pin to crown
  deck: 210,
  cr: 9.5,
  lift: 10.5, // max valve lift, mm
};
const S_TDC = K.crankR + K.rod; // 186
const S_BDC = K.rod - K.crankR; // 100
const STROKE_MM = S_TDC - S_BDC; // 86
const CYCLE = 720;

const mod = (a, m) => ((a % m) + m) % m;
const wrap720 = (a) => mod(a, CYCLE);

/** Piston-pin distance from the crank axis: the closed-form slider-crank, no iteration. */
export function pistonAt(th) {
  const a = th * DEG;
  return K.crankR * Math.cos(a) + Math.sqrt(K.rod * K.rod - (K.crankR * Math.sin(a)) ** 2);
}
/** 0 at TDC, 1 at BDC. */
export const pistonFrac = (th) => (S_TDC - pistonAt(th)) / STROKE_MM;
/** Cylinder volume in clearance volumes. */
export const volumeRatio = (th) => 1 + (K.cr - 1) * pistonFrac(th);

const VALVE_WINDOWS = { intake: [380, 560], exhaust: [120, 360] };
/** 0..1 lift inside the opening window, `sin²` so the seat sees a soft landing. */
export function valveLift(th, which) {
  const [a, b] = VALVE_WINDOWS[which];
  const x = wrap720(th - a) / (b - a);
  return x >= 0 && x <= 1 ? Math.sin(Math.PI * x) ** 2 : 0;
}

/** Chamber pressure in bar: intake, exhaust blow-down, compression, then a 16° burn and expansion. */
export function pressureAt(th) {
  const ps = wrap720(th);
  const V = volumeRatio(ps);
  if (ps >= 360 && ps < 540) return 0.9;
  if (ps >= 180 && ps < 360) return 1.1 + 0.5 * Math.max(0, 1 - (ps - 180) / 50);
  if (ps >= 540) return Math.max(0.9, 0.98 * Math.pow(K.cr / V, 1.34));
  const compressed = 0.98 * Math.pow(K.cr / V, 1.34);
  const burned = 48 * Math.pow(1 / V, 1.3);
  const k = Math.min(1, ps / 16);
  return Math.max(1.1, compressed + (burned - compressed) * (k * k * (3 - 2 * k)));
}

const STROKES = ['POWER', 'EXHAUST', 'INTAKE', 'COMPRESS'];
const strokeIndex = (th) => Math.floor(wrap720(th) / 180);
const CHARGE = ['#D98A5E', '#A7ADB4', '#7FA6C4', '#C9CDD2'];

// ============================================================================
// 2. GEOMETRY
// ============================================================================

/** Crank web outline: counterweight sector opposite the pin, boss around the pin. */
function webGeometry(thick) {
  const R = 64;
  const s = new THREE.Shape();
  s.moveTo(-R * Math.sin(1.0), -R * Math.cos(1.0));
  s.absarc(0, 0, R, -Math.PI / 2 - 1.0, -Math.PI / 2 + 1.0, false);
  s.lineTo(26, 20);
  s.absarc(0, K.crankR, 26, 0, Math.PI, false);
  s.lineTo(-26, 20);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: 1.4,
    bevelSize: 1.4,
    bevelSegments: 2,
    curveSegments: 24,
  });
  g.translate(0, 0, -thick / 2);
  return g;
}

export function buildSample(M, hostScene) {
  const root = new THREE.Group();
  const add = (parent, geo, mat, opts = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = opts.cast !== false;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // Shell materials are the only ones the section cut removes; internals stay whole so the cut
  // reveals the working parts instead of halving them.
  const shellBlack = M.black.clone();
  const shellAlu = M.alu.clone();
  const valveSteel = M.steel.clone();
  const valveBronze = M.bronze.clone();
  const shells = [shellBlack, shellAlu, valveSteel, valveBronze];

  // ---------------------------------------------------------------- bench fixture / crankcase
  const frame = new THREE.Group();
  root.add(frame);

  const base = add(frame, blockGeometry({ w: 300, h: 16, d: 190, r: 8 }), M.aluDark);
  base.position.y = -70;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pad = add(frame, new THREE.CylinderGeometry(11, 11, 9, 16), M.rubber);
      pad.position.set(sx * 118, -83, sz * 70);
    }
  }
  // Closed crankcase: the section cut is what opens it, which keeps scene 01 a clean silhouette.
  const crankcase = add(frame, blockGeometry({ w: 290, h: 110, d: 180, r: 10 }), M.black);
  crankcase.position.y = -22;
  const boss = add(frame, new THREE.CylinderGeometry(34, 38, 18, 32), M.alu);
  boss.rotation.x = Math.PI / 2;
  boss.position.set(0, 0, 96);
  const bossRing = add(frame, new THREE.TorusGeometry(35, 2.4, 8, 32), M.black);
  bossRing.position.set(0, 0, 105);

  const jacketMat = M.white.clone();
  shells.push(jacketMat);
  const cylGroup = new THREE.Group();
  frame.add(cylGroup);
  const boreMat = M.aluDark.clone();
  boreMat.side = THREE.BackSide;
  shells.push(boreMat);
  const boreSleeve = add(cylGroup, new THREE.CylinderGeometry(K.bore / 2 + 1, K.bore / 2 + 1, 168, 44, 1, true), boreMat, { cast: false });
  boreSleeve.position.y = 126;
  boreSleeve.visible = false;
  const jacket = add(cylGroup, new THREE.CylinderGeometry(66, 72, 180, 44), jacketMat);
  jacket.position.y = 122;
  for (const y of [70, 118, 166]) {
    const fin = add(cylGroup, new THREE.TorusGeometry(70, 1.8, 8, 44), shellAlu);
    fin.rotation.x = Math.PI / 2;
    fin.position.y = y;
  }

  // ---------------------------------------------------------------- crank
  const crank = new THREE.Group();
  root.add(crank);
  const shaft = add(crank, new THREE.CylinderGeometry(15, 15, 262, 28), M.steel);
  shaft.rotation.x = Math.PI / 2;
  const webGeo = webGeometry(16);
  for (const z of [-30, 30]) {
    const w = add(crank, webGeo, M.steel);
    w.position.z = z;
  }
  const crankPin = add(crank, new THREE.CylinderGeometry(18, 18, 52, 26), M.steel);
  crankPin.rotation.x = Math.PI / 2;
  crankPin.position.y = K.crankR;

  // ---------------------------------------------------------------- flywheel + ring gear
  const flywheel = new THREE.Group();
  flywheel.position.z = -112;
  root.add(flywheel);
  const disc = add(flywheel, new THREE.CylinderGeometry(62, 62, 16, 64), M.black);
  disc.rotation.x = Math.PI / 2;
  const ring = add(flywheel, gearGeometry({ teeth: 56, rOut: 72, rRoot: 66, width: 14, holeR: 34 }), M.black);
  const mark = add(flywheel, new THREE.BoxGeometry(8, 16, 4), M.accent, { cast: false });
  mark.position.set(0, 52, 10);

  // ---------------------------------------------------------------- timing train (24 : 55 : 48)
  // One toothed crank pulley at the front is enough drive detail; a full timing train read as
  // "gears with a small cylinder attached" at film scale.
  const crankGear = add(root, gearGeometry({ teeth: 28, rOut: 40, rRoot: 35, width: 15, holeR: 14, helix: 0.25 }), M.alu);
  crankGear.position.set(0, 0, 104);

  // ---------------------------------------------------------------- liner + head + valvetrain
  const liner = add(cylGroup, new THREE.CylinderGeometry(K.bore / 2, K.bore / 2, 130, 48, 1, true), M.glass, { cast: false });
  liner.position.y = 145;
  liner.renderOrder = 3;

  const head = new THREE.Group();
  root.add(head);
  const headBody = add(head, blockGeometry({ w: 150, h: 44, d: 130, r: 6 }), shellAlu);
  headBody.position.y = 234;
  const gasket = add(head, blockGeometry({ w: 152, h: 5, d: 132, r: 4 }), shellBlack);
  gasket.position.y = 212;
  const headTop = add(head, blockGeometry({ w: 112, h: 16, d: 104, r: 4 }), shellBlack);
  headTop.position.y = 263;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const b = add(head, boltGeometry({ r: 4.4, h: 7 }), valveSteel);
      b.position.set(sx * 64, 258, sz * 54);
    }
  }

  const valves = new THREE.Group();
  head.add(valves);
  const valveParts = [];
  for (const [sx, which] of [[-1, 'intake'], [1, 'exhaust']]) {
    const v = new THREE.Group();
    v.position.x = sx * 20;
    valves.add(v);
    const stem = add(v, new THREE.CylinderGeometry(3.2, 3.2, 40, 14), valveSteel);
    stem.position.y = 236.5;
    const face = add(v, new THREE.CylinderGeometry(15, 6, 7, 24), valveSteel);
    face.position.y = 217;
    const spring = new THREE.Group();
    spring.position.y = 224;
    v.add(spring);
    add(spring, helixGeometry({ r: 11, wire: 1.7, turns: 7, len: 28 }), valveBronze);
    valveParts.push({ which, group: v, spring });
  }

  {
    const pts = [
      new THREE.Vector3(-66, 226, -6),
      new THREE.Vector3(-104, 222, -10),
      new THREE.Vector3(-128, 196, -14),
      new THREE.Vector3(-132, 150, -14),
    ];
    const pipe = add(head, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 13, 18, false), shellBlack);
    void pipe;
  }

  const plug = new THREE.Group();
  head.add(plug);
  plug.position.set(0, 268, -34);
  add(plug, new THREE.CylinderGeometry(6, 6, 26, 16), jacketMat).position.y = 12;
  add(plug, new THREE.CylinderGeometry(8, 8, 7, 6), valveSteel).position.y = -2;

  // ---------------------------------------------------------------- camshaft
  const cam = new THREE.Group();
  cam.position.y = 274;
  root.add(cam);
  const camShaft = add(cam, new THREE.CylinderGeometry(11, 11, 224, 20), M.steel);
  camShaft.rotation.x = Math.PI / 2;
  for (const z of [-70, 70]) {
    const bearing = add(cam, blockGeometry({ w: 28, h: 22, d: 22, r: 4 }), M.black);
    bearing.position.set(0, 0, z);
  }
  const lobes = [];
  for (const [sx, which] of [[-1, 'intake'], [1, 'exhaust']]) {
    const lg = new THREE.Group();
    lg.position.x = sx * 20;
    cam.add(lg);
    const shape = new THREE.Shape();
    shape.absellipse(0, 5, 12, 17, 0, Math.PI * 2, false, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 13, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.8, bevelSegments: 1, curveSegments: 20 });
    geo.translate(0, 0, -6.5);
    add(lg, geo, M.steel);
    const [a, b] = VALVE_WINDOWS[which];
    lobes.push({ group: lg, peak: (a + b) / 2, which });
  }

  // ---------------------------------------------------------------- piston, rod, charge
  const piston = new THREE.Group();
  root.add(piston);
  const body = add(piston, new THREE.CylinderGeometry(K.bore / 2 - 1.5, K.bore / 2 - 1.5, 52, 48), M.alu);
  const ringGeo = new THREE.TorusGeometry(K.bore / 2 - 1.0, 1.5, 8, 48);
  for (const dy of [16, 10]) {
    const ring31 = add(piston, ringGeo, M.black);
    ring31.rotation.x = Math.PI / 2;
    ring31.position.y = dy;
  }
  const wristPin = add(piston, new THREE.CylinderGeometry(10, 10, 78, 16), M.steel);
  wristPin.rotation.z = Math.PI / 2;

  const charge = new THREE.Mesh(
    new THREE.CylinderGeometry(K.bore / 2 - 6, K.bore / 2 - 6, 1, 32),
    new THREE.MeshBasicMaterial({ color: CHARGE[0], transparent: true, opacity: 0.24, depthWrite: false, toneMapped: false }),
  );
  charge.renderOrder = 2;
  root.add(charge);

  const arrow = new THREE.Group();
  root.add(arrow);
  const arrowShaft = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 26, 12), M.accent);
  const arrowTip = new THREE.Mesh(new THREE.ConeGeometry(7, 16, 16), M.accent);
  arrowTip.position.y = 20;
  arrow.add(arrowShaft, arrowTip);
  arrow.position.x = 76;
  arrow.scale.setScalar(0.85);

  const rod = new THREE.Group();
  root.add(rod);
  const beam = add(rod, new THREE.BoxGeometry(15, 1, 11), M.black);
  const bigEnd = add(rod, new THREE.CylinderGeometry(24, 24, 20, 28), M.black);
  bigEnd.rotation.x = Math.PI / 2;
  const smallEnd = add(rod, new THREE.CylinderGeometry(13, 13, 20, 20), M.black);
  smallEnd.rotation.x = Math.PI / 2;

  // ---------------------------------------------------------------- section plane (world units)
  const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.9);
  let cutNow = '';

  // Section caps, teardown-style: two stencil twins per clipped mesh count its faces beyond the
  // cut, and a plane lying on the cut paints the cap colour wherever the count says metal.
  const capCount = (side, op) =>
    new THREE.MeshBasicMaterial({
      side,
      colorWrite: false,
      depthWrite: false,
      depthTest: false,
      stencilWrite: true,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilFail: op,
      stencilZFail: op,
      stencilZPass: op,
      clippingPlanes: [clipPlane],
    });
  const capBack = capCount(THREE.BackSide, THREE.IncrementWrapStencilOp);
  const capFront = capCount(THREE.FrontSide, THREE.DecrementWrapStencilOp);
  const capMat = new THREE.MeshStandardMaterial({
    color: '#D7DADE',
    roughness: 0.62,
    metalness: 0.0,
    side: THREE.DoubleSide,
    stencilWrite: true,
    stencilRef: 0,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.ReplaceStencilOp,
    stencilZFail: THREE.ReplaceStencilOp,
    stencilZPass: THREE.ReplaceStencilOp,
  });
  const cap = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), capMat);
  cap.renderOrder = 3;
  cap.visible = false;
  cap.onAfterRender = (r) => r.clearStencil();
  hostScene.add(cap);

  const capTwins = [];
  {
    const clipped = new Set(shells);
    root.traverse((o) => {
      if (!o.isMesh || !clipped.has(o.material)) return;
      for (const mat of [capBack, capFront]) {
        const twin = new THREE.Mesh(o.geometry, mat);
        twin.castShadow = false;
        twin.receiveShadow = false;
        twin.renderOrder = 0.5;
        twin.visible = false;
        o.add(twin);
        capTwins.push(twin);
      }
    });
  }
  const placeCap = () => {
    const c = clipPlane.constant;
    const n = clipPlane.normal;
    cap.position.set(-c * n.x, -c * n.y, -c * n.z);
    cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.clone().negate());
  };
  placeCap();

  const rootScale = 0.006;
  root.scale.setScalar(rootScale);
  root.position.y = 0.522; // rubber pads rest on the bench (y = 0)

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  /**
   * Pose everything from the crank angle.
   * ops: {cut: 'glass'|'solid'|'section', cutConst, explode 0..1, arrows 0..1}
   */
  function update(th, ops = {}) {
    const cut = ops.cut || 'glass';
    const ex = clamp(ops.explode ?? 0, 0, 1);
    const arrowsOn = ops.arrows ?? 1;

    // ---- section cut
    clipPlane.constant = ops.cutConst ?? 0.9;
    placeCap();
    const sectionOn = cut === 'section';
    if (cut !== cutNow) {
      cutNow = cut;
      for (const m of shells) {
        m.clippingPlanes = sectionOn ? [clipPlane] : null;
        m.side = sectionOn ? THREE.DoubleSide : THREE.FrontSide;
        m.needsUpdate = true;
      }
      jacketMat.transparent = cut === 'glass';
      jacketMat.opacity = cut === 'glass' ? 0.42 : 1;
      jacketMat.depthWrite = cut !== 'glass';
      jacketMat.needsUpdate = true;
      // Stencil caps need a stencil-attached default framebuffer; headless SwiftShader drops it,
      // so the shipped look is a hollow half-shell (see SPEC §3).
      cap.visible = false;
      for (const t of capTwins) t.visible = false;
      M.glass.opacity = cut === 'solid' ? 0.9 : 0.18;
      M.glass.depthWrite = cut === 'solid';
      M.glass.needsUpdate = true;
      liner.visible = cut !== 'section';
      boreSleeve.visible = sectionOn;
    }

    // ---- explode choreography (staged, so nothing passes through anything)
    const eJacket = layerEase(ex, [0.04, 0.46], 46);
    const ePiston = layerEase(ex, [0.14, 0.62], 95);
    const eHead = layerEase(ex, [0.30, 0.74], 140);
    const eCam = layerEase(ex, [0.48, 0.92], 220);

    cylGroup.position.y = eJacket;
    flywheel.position.z = -112 - layerEase(ex, [0.0, 0.4], 120);
    head.position.y = eHead;
    cam.position.y = 274 + eCam;

    // ---- rotating parts
    crank.rotation.z = -th * DEG;
    flywheel.rotation.z = -th * DEG;
    crankGear.rotation.z = -th * DEG;
    cam.rotation.z = -th * DEG * 0.5;
    for (const l of lobes) l.group.rotation.z = Math.PI + (th - l.peak) * 0.5 * DEG;

    // ---- piston + rod
    const s = pistonAt(th);
    const crown = s + K.comp;
    piston.position.y = s + ePiston;
    body.position.y = -2;
    wristPin.position.y = 0;
    rod.position.y = 0;

    const pinX = K.crankR * Math.sin(th * DEG);
    const pinY = K.crankR * Math.cos(th * DEG);
    tmpA.set(pinX, pinY, 0);
    // Low end leaves the crank pin as the sample comes apart and hangs under the piston.
    tmpA.lerp(tmpB.set(0, s + ePiston - K.rod, 0), smootherstep(0.15, 0.65, ex));
    tmpB.set(0, s + ePiston, 0);
    const midX = (tmpA.x + tmpB.x) / 2;
    const midY = (tmpA.y + tmpB.y) / 2;
    const dx = tmpB.x - tmpA.x;
    const dy = tmpB.y - tmpA.y;
    const len = Math.hypot(dx, dy);
    rod.position.set(midX, midY, 0);
    rod.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    beam.scale.y = Math.max(8, len - 26);
    bigEnd.position.y = -len / 2;
    smallEnd.position.y = len / 2;

    // ---- charge column: the one place colour carries meaning
    const key = strokeIndex(th);
    charge.material.color.set(CHARGE[key]);
    charge.material.opacity = key === 0 ? 0.16 : 0.1;
    charge.position.y = (crown + K.deck) / 2 + ePiston * 0.15;
    charge.scale.y = Math.max(1, K.deck - crown);

    // ---- valvetrain
    for (const v of valveParts) {
      const lift = valveLift(th, v.which) * K.lift;
      v.group.position.y = -lift;
      v.spring.scale.y = (28 - lift) / 28;
    }

    // ---- accent arrow: the part doing the work, and the way it is moving
    const vel = pistonAt(th + 2) - s;
    arrow.position.y = crown - 26 + ePiston * 0.2;
    arrow.rotation.z = vel > 0 ? 0 : Math.PI;
    arrow.scale.setScalar(arrowsOn * Math.min(1, Math.abs(vel) / 0.5));
    arrow.visible = arrowsOn > 0.02;
  }

  update(0, { cut: 'glass' });
  root.updateMatrixWorld(true);

  return {
    root,
    update,
    parts: { frame, crank, flywheel, crankGear, liner, head, valves, cam, piston, rod, arrow },
    clipPlane,
    scale: rootScale,
  };
}

// ============================================================================
// 3. THE FILM
// ============================================================================

export default async function createWorld({ width, height, scenes = [], style = {} }) {
  const studio = createCalLabStudio({ width, height, scenes, style });
  const { scene, camera } = studio;

  const M = createMaterials();
  const sample = buildSample(M, scene);
  scene.add(sample.root);

  // HUD rides the camera: a canvas texture plane at z = -1, sized from the live fov.
  scene.add(camera);
  const hud = createGaugeHud({ camera, width, height });
  hud.fit();

  // Framing boxes, in world units, declared from the built sample's real extents. Subjects that are
  // Object3D get measured at their rest pose; the exploded stack needs its own envelope because the
  // parts leave their rest bounds while the camera is already moving.
  const HERO = { center: [0, 1.0, 0], size: [2.15, 2.15, 2.0] };
  const UPPER = { center: [0, 1.34, -0.1], size: [1.15, 1.9, 1.3] };
  const HEAD = { center: [0, 1.52, 0], size: [0.92, 0.78, 0.82] };
  const EXPLODED = { center: [0, 1.55, 0], size: [2.2, 3.3, 2.1] };

  const director = studio.director({
    subjects: {
      machine: sample.root,
      crank: sample.parts.crank,
      head: sample.parts.head,
      valves: sample.parts.valves,
      piston: sample.parts.piston,
    },
    shots: {
      'lab-run': [
        { dur: 1.5, size: 'wide', subject: HERO, angle: 24, height: 'eye', move: 'orbit', amount: 0.7 },
        { size: 'full', subject: HERO, angle: 12, height: 'eye', move: 'push' },
      ],
      'lab-section': [
        { dur: 1.4, size: 'wide', subject: HERO, angle: 22, height: 20, move: 'pull' },
        { size: 'wide', subject: UPPER, angle: 34, height: 22, move: 'push' },
      ],
      'lab-explode': [
        { size: 'wide', subject: EXPLODED, angle: 26, height: 18, move: 'rise', amount: 0.4 },
      ],
      'lab-valves': [
        { size: 'full', subject: UPPER, angle: 26, height: 18, move: 'push', amount: 0.5 },
      ],
    },
  });

  const loop = [];
  for (let d = 0; d <= CYCLE; d += 4) loop.push([volumeRatio(d), pressureAt(d)]);
  const intakeCurve = [];
  const exhaustCurve = [];
  for (let d = 0; d <= CYCLE; d += 4) {
    intakeCurve.push([d, valveLift(d, 'intake')]);
    exhaustCurve.push([d, valveLift(d, 'exhaust')]);
  }

  function hudState(sceneIndex, th, t, ops) {
    const ps = wrap720(th);
    const s = pistonAt(th);
    const common = {
      title: 'SINGLE-CYLINDER FOUR-STROKE',
      subtitle: `Ø${K.bore} × ${STROKE_MM} mm · CR ${K.cr}:1 · 720° CYCLE`,
      accent: CAL_PALETTE.accent,
      progress: clamp(t / 16, 0, 1),
    };

    if (sceneIndex === 2) {
      const ex = ops.explode ?? 0;
      return {
        ...common,
        big: { label: 'Exploded', value: Math.round(ex * 100), unit: '%' },
        rows: [
          { label: 'Jacket lift', value: `${Math.round(layerEase(ex, [0.04, 0.46], 46))} mm` },
          { label: 'Piston lift', value: `${Math.round(layerEase(ex, [0.14, 0.62], 95))} mm` },
          { label: 'Head lift', value: `${Math.round(layerEase(ex, [0.3, 0.74], 140))} mm` },
          { label: 'Cam lift', value: `${Math.round(layerEase(ex, [0.48, 0.92], 220))} mm` },
        ],
        phase: { labels: STROKES, index: strokeIndex(th) },
        formula: 'layers leave in assembly order · no manual keys',
        tag: '4 LAYERS · ASSEMBLY ORDER',
      };
    }

    if (sceneIndex === 3) {
      const li = valveLift(th, 'intake') * K.lift;
      const le = valveLift(th, 'exhaust') * K.lift;
      return {
        ...common,
        big: { label: 'Intake lift', value: li.toFixed(2), unit: 'mm' },
        rows: [
          { label: 'Exhaust lift', value: `${le.toFixed(2)} mm` },
          { label: 'Cam ratio', value: '1 : 2 (crank)' },
          { label: 'Chamber', value: `${pressureAt(th).toFixed(1)} bar` },
        ],
        phase: { labels: STROKES, index: strokeIndex(th) },
        plot: {
          title: 'VALVE LIFT',
          xMax: CYCLE,
          yMax: 1,
          series: [
            { points: intakeCurve, color: '#5B9BE0', width: 1.8 },
            { points: exhaustCurve, color: CAL_PALETTE.accent, width: 1.8 },
          ],
          dot: [ps, valveLift(th, 'intake')],
          xText: 'crank°',
          yText: 'lift',
          note: 'INTAKE blue · EXHAUST orange',
        },
        tag: 'CAM 1:2 · 720° CYCLE',
      };
    }

    return {
      ...common,
      subtitle: sceneIndex === 1 ? 'SECTION A–A · CLIPPED IN WORLD SPACE' : common.subtitle,
      big: { label: 'Crank angle', value: Math.round(ps), unit: '°' },
      rows: [
        { label: 'Piston from TDC', value: `${(S_TDC - s).toFixed(1)} mm` },
        { label: 'Chamber', value: `${volumeRatio(th).toFixed(2)} × Vc` },
        { label: 'Pressure', value: `${pressureAt(th).toFixed(1)} bar` },
      ],
      phase: { labels: STROKES, index: strokeIndex(th) },
      plot: {
        title: 'INDICATOR DIAGRAM',
        xMax: K.cr,
        yMax: 55,
        series: [{ points: loop, color: CAL_PALETTE.ink, width: 1.6 }],
        dot: [volumeRatio(th), pressureAt(th)],
        xText: 'V / Vc',
        yText: 'bar',
        note: 'same function that poses the piston',
      },
      formula: 's = r·cos φ + √(L² − r² sin²φ)',
      tag: sceneIndex === 1 ? 'SECTION A–A · 1 DOF' : '1 DOF · DERIVED',
    };
  }

  function render(frame = {}) {
    const t = frame.t ?? 0;
    const localT = frame.localT ?? t;
    const sceneIndex = clamp(frame.sceneIndex ?? 0, 0, 3);
    const th = 150 + 200 * t; // 200°/s keeps the four strokes readable in 16 s

    const ops = { cut: 'solid', cutConst: 0.9, explode: 0, arrows: 1 };
    if (sceneIndex === 1) {
      ops.cut = 'section';
      ops.cutConst = lerp(0.9, 0.0, smootherstep(0.12, 1.5, localT));
    } else if (sceneIndex === 2) {
      ops.cut = 'section';
      ops.cutConst = 0.0;
      ops.explode = smootherstep(0.22, 2.3, localT);
      ops.arrows = 0;
    } else if (sceneIndex === 3) {
      ops.cut = 'section';
      ops.cutConst = 0.0;
      ops.arrows = 0;
      ops.explode = 1 - smootherstep(0.05, 0.95, localT);
    }

    sample.update(th, ops);
    hud.fit();
    hud.draw(hudState(sceneIndex, th, t, ops));
    director.update({ ...frame, t, localT, sceneIndex });
    studio.render(frame);
  }

  render({ t: 0, localT: 0, sceneIndex: 0 });

  return {
    canvas: studio.canvas,
    scene,
    camera,
    renderer: studio.renderer,
    render,
    storyboard: director.storyboard,
  };
}
