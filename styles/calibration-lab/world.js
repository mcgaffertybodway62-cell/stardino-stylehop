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
const VALVE_WINDOWS = { intake: [380, 560], exhaust: [120, 360] };
/** 0..1 lift inside the opening window, `sin²` so the seat sees a soft landing. */
export function valveLift(th, which) {
  const [a, b] = VALVE_WINDOWS[which];
  const x = wrap720(th - a) / (b - a);
  return x >= 0 && x <= 1 ? Math.sin(Math.PI * x) ** 2 : 0;
}

const STROKES = ['POWER', 'EXHAUST', 'INTAKE', 'COMPRESS'];
const strokeIndex = (th) => Math.floor(wrap720(th) / 180);
const CHARGE = ['#D98A5E', '#A7ADB4', '#7FA6C4', '#C9CDD2'];

// ============================================================================
// 2. GEOMETRY
// ============================================================================

/** Crank web outline: counterweight sector opposite the pin, boss around the pin. */
function webGeometry(thick) {
  const R = 54;
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
  // Hollow crankcase (16 mm walls) with a polycarbonate inspection aperture in the near wall.
  // A solid box is a featureless block while running, and once the section cut opens it the crank
  // reads as a mechanism floating outside a black wedge — the walls + aperture fix both.
  const deckGeometry = (w, d, h, holeR) => {
    const rr = 6;
    const hw = w / 2;
    const hd = d / 2;
    const sh = new THREE.Shape();
    sh.moveTo(-hw + rr, -hd);
    sh.lineTo(hw - rr, -hd);
    sh.quadraticCurveTo(hw, -hd, hw, -hd + rr);
    sh.lineTo(hw, hd - rr);
    sh.quadraticCurveTo(hw, hd, hw - rr, hd);
    sh.lineTo(-hw + rr, hd);
    sh.quadraticCurveTo(-hw, hd, -hw, hd - rr);
    sh.lineTo(-hw, -hd + rr);
    sh.quadraticCurveTo(-hw, -hd, -hw + rr, -hd);
    sh.closePath();
    if (holeR) {
      const hole = new THREE.Path();
      hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
      sh.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 40 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -h / 2, 0);
    g.computeVertexNormals();
    return g;
  };
  const caseWall = (w, h, d, x, y, z) => {
    const m = add(frame, blockGeometry({ w, h, d, r: 3 }), shellBlack);
    m.position.set(x, y, z);
    return m;
  };
  caseWall(290, 142, 16, 0, -8, -82); // back
  caseWall(290, 142, 16, 0, -8, 82); // front (carries the boss and the nameplate)
  caseWall(16, 142, 180, -137, -8, 0); // far wall
  caseWall(290, 16, 180, 0, -71, 0); // floor
  caseWall(16, 142, 180, 137, -8, 0); // near wall
  const caseDeck = add(frame, deckGeometry(290, 180, 16, 76), shellBlack);
  caseDeck.position.y = 55; // the bore opens through the deck
  const boss = add(frame, new THREE.CylinderGeometry(34, 38, 18, 32), shellAlu);
  boss.rotation.x = Math.PI / 2;
  boss.position.set(0, 0, 96);
  const plate = add(frame, blockGeometry({ w: 86, h: 34, d: 3, r: 3 }), shellAlu);
  plate.position.set(-96, -26, 91);
  for (const px of [-30, 30]) {
    const screw = add(frame, boltGeometry({ r: 2.6, h: 4 }), valveSteel);
    screw.position.set(-96 + px, -26, 93);
    screw.rotation.x = Math.PI / 2;
  }
  const bossRing = add(frame, new THREE.TorusGeometry(35, 2.4, 8, 32), shellBlack);
  bossRing.position.set(0, 0, 105);

  const jacketMat = M.white.clone();
  shells.push(jacketMat);
  const cylGroup = new THREE.Group();
  frame.add(cylGroup);
  const revolve = (profile, mat, seg = 56) => {
    const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    g.computeVertexNormals();
    return add(cylGroup, g, mat);
  };
  // Air-cooled barrel: bore r 43 inside one powder-white casting whose *fins are steps in the
  // profile*, so the fin edges are the silhouette. A smooth canister with separate rings wrapped
  // around it read as hoops on a jar, and a windowed jacket put a 29 mm white wall across the bore.
  revolve(
    [
      [43, 32], [72, 32], [72, 66], [79, 66], [79, 76], [72, 76],
      [72, 104], [79, 104], [79, 114], [72, 114], [72, 142], [79, 142],
      [79, 152], [72, 152], [72, 180], [79, 180], [79, 190], [72, 190],
      [66, 206], [66, 212], [43, 212], [43, 32],
    ],
    jacketMat,
  );
  revolve([[58, 33], [82, 33], [82, 47], [58, 47], [58, 33]], shellAlu); // base flange

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
  const crankGear = add(root, gearGeometry({ teeth: 34, rOut: 52, rRoot: 46, width: 15, holeR: 16, helix: 0.25 }), shellAlu);
  crankGear.position.set(0, 0, 104);

  // ---------------------------------------------------------------- head + valvetrain
  const head = new THREE.Group();
  root.add(head);
  // Open-front head: an educational cutaway casting, so the valvetrain reads even without a cut.
  const headBack = add(head, blockGeometry({ w: 138, h: 80, d: 12, r: 4 }), shellAlu);
  headBack.position.set(0, 252, -56);
  for (const sx of [-1, 1]) {
    const headSide = add(head, blockGeometry({ w: 12, h: 80, d: 124, r: 4 }), shellAlu);
    headSide.position.set(sx * 63, 252, 0);
  }
  const headDeck = add(head, blockGeometry({ w: 138, h: 10, d: 124, r: 4 }), shellBlack);
  headDeck.position.y = 217;
  // Roof plate above the camshaft (the old plate sat below the cam, so the cam floated on top of
  // the head with nothing holding it).
  const headPlate = add(head, blockGeometry({ w: 104, h: 10, d: 104, r: 4 }), shellAlu);
  headPlate.position.y = 302;
  const gasketRing = new THREE.LatheGeometry(
    [[70, 209], [70, 215], [46, 215], [46, 209], [70, 209]].map(([r, y]) => new THREE.Vector2(r, y)),
    48,
  );
  add(head, gasketRing, shellBlack);
  // Cover bolts on the roof: long through-studs read as scaffolding around a 12 mm wall.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const bolt = add(head, boltGeometry({ r: 5.5, h: 9 }), valveSteel);
      bolt.position.set(sx * 44, 309, sz * 44);
    }
  }
  for (const sx of [-1, 1]) {
    const flange = add(head, new THREE.CylinderGeometry(16, 16, 10, 20), shellAlu);
    flange.rotation.z = Math.PI / 2;
    flange.position.set(sx * 70, 232, -10);
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
    const retainer = add(v, new THREE.CylinderGeometry(12, 12, 3.5, 20), valveSteel);
    retainer.position.y = 253;
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
    const outlet = add(head, new THREE.CylinderGeometry(17, 17, 8, 20), shellAlu);
    outlet.position.set(-132, 146, -14);
  }

  const plug = new THREE.Group();
  head.add(plug);
  plug.position.set(0, 268, -34);
  add(plug, new THREE.CylinderGeometry(6, 6, 26, 16), jacketMat).position.y = 12;
  add(plug, new THREE.CylinderGeometry(8, 8, 7, 6), valveSteel).position.y = -2;

  // ---------------------------------------------------------------- cam cover + camshaft
  const camWallZ = add(head, blockGeometry({ w: 126, h: 36, d: 12, r: 4 }), shellBlack);
  camWallZ.position.set(0, 282, -51);
  for (const sx of [-1, 1]) {
    const frontPost = add(head, blockGeometry({ w: 12, h: 28, d: 12, r: 3 }), shellBlack);
    frontPost.position.set(sx * 57, 278, 47);
    const bearingCap = add(head, blockGeometry({ w: 24, h: 10, d: 24, r: 3 }), shellAlu);
    bearingCap.position.set(sx * 57, 292, 47);
  }
  const cam = new THREE.Group();
  cam.position.y = 273;
  root.add(cam);
  const camShaft = add(cam, new THREE.CylinderGeometry(11, 11, 156, 20), M.steel);
  camShaft.rotation.x = Math.PI / 2;
  camShaft.position.z = -22; // reaches the rear sprocket, stops inside the head at the front
  // cam sprocket rides on the shaft: the one thing that says "driven", not "decorative"
  const camSprocket = new THREE.Mesh(gearGeometry({ teeth: 20, rOut: 33, rRoot: 28, width: 11, holeR: 11 }), M.alu);
  camSprocket.position.z = -96;
  cam.add(camSprocket);

  const lobes = [];
  for (const [sx, which] of [[-1, 'intake'], [1, 'exhaust']]) {
    const lg = new THREE.Group();
    lg.position.x = sx * 20;
    cam.add(lg);
    const shape = new THREE.Shape();
    shape.absellipse(0, 4, 9.5, 14, 0, Math.PI * 2, false, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 10, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.8, bevelSegments: 1, curveSegments: 20 });
    geo.translate(0, 0, -5);
    add(lg, geo, M.steel);
    const [a, b] = VALVE_WINDOWS[which];
    lobes.push({ group: lg, peak: (a + b) / 2, which });
  }

  // ---------------------------------------------------------------- piston, rod, charge
  const piston = new THREE.Group();
  root.add(piston);
  // Bright piston: the bore's inside is unlit, so a graphite piston vanished into it in the section;
  // the rings stay dark and give the part its read.
  const body = add(piston, new THREE.CylinderGeometry(K.bore / 2 - 0.5, K.bore / 2 - 0.5, 52, 48), M.steel);
  const ringGeo = new THREE.TorusGeometry(K.bore / 2 - 0.8, 1.4, 8, 48);
  for (const dy of [16, 10]) {
    const ring31 = add(piston, ringGeo, shellBlack);
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
  const beam = add(rod, new THREE.BoxGeometry(15, 1, 11), M.steel);
  const bigEnd = add(rod, new THREE.CylinderGeometry(24, 24, 20, 28), M.graphite);
  bigEnd.rotation.x = Math.PI / 2;
  const smallEnd = add(rod, new THREE.CylinderGeometry(13, 13, 20, 20), M.graphite);
  smallEnd.rotation.x = Math.PI / 2;

  // ---------------------------------------------------------------- section plane (world units)
  const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.9);
  let cutNow = '';

  // The cut is a hollow half-shell: a stencil cap needs a stencil-attached default framebuffer,
  // which the headless renderer does not provide (documented in SPEC §3). No dead code here.


  const rootScale = 0.006;
  root.scale.setScalar(rootScale);
  root.position.y = 0.522; // rubber pads rest on the bench (y = 0)

  // ---- section caps, built analytically (no stencil in the headless framebuffer): a wall strip
  // for the cylinder, a frame for each hollow casting, so the cut reads as material with a wall
  // thickness instead of a see-through shell.
  // Cut faces are a distinct, darker stock: pale caps read as white posts standing in the sample.
  const capMat = new THREE.MeshStandardMaterial({ color: '#5C636C', roughness: 0.66, metalness: 0.1, side: THREE.DoubleSide });
  const capGroup = new THREE.Group();
  capGroup.visible = false;
  root.add(capGroup);
  const CAP_T = 7; // cap thickness along the cut normal, mm
  const capBox = (sx, sy, sz, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), capMat);
    m.scale.set(sx, sy, sz);
    m.position.set(0, y, z);
    m.castShadow = false;
    m.receiveShadow = false;
    capGroup.add(m);
    return m;
  };
  // The head is an open casting: a solid cut face would cover the valvetrain the shot is about,
  // so its 12 mm walls are left to show their own edge. The barrel is a true hollow: the cut face is
  // the jacket wall band (r 43…69), not two decorative strips.
  const jacketCaps = [capBox(CAP_T, 186, CAP_T, 123, 0), capBox(CAP_T, 186, CAP_T, 123, 0)];
  // Crankcase: y -79…63, z ±90, 16 mm walls. Without this frame the opened case is a hole.
  const CASE_W = 16;
  const caseCaps = [
    capBox(CAP_T, CASE_W, 180, 63 - CASE_W / 2, 0),
    capBox(CAP_T, CASE_W, 180, -79 + CASE_W / 2, 0),
    capBox(CAP_T, 142, CASE_W, -8, -90 + CASE_W / 2),
    capBox(CAP_T, 142, CASE_W, -8, 90 - CASE_W / 2),
  ];

  const placeCap = () => {
    const cMm = clipPlane.constant / rootScale;
    capGroup.position.set(cMm, 0, 0);
    // The cut stops inside the barrel wall (see `cutConst`), so the barrel's cut face is one band
    // through the wall — band-with-gap geometry only applies while the plane still crosses the bore.
    const rOut = Math.sqrt(Math.max(0, 69 * 69 - cMm * cMm));
    const [capA, capB] = jacketCaps;
    if (cMm < 43) {
      const rIn = Math.sqrt(Math.max(0, 43 * 43 - cMm * cMm));
      capA.visible = capB.visible = true;
      capA.scale.z = capB.scale.z = Math.max(0.5, rOut - rIn);
      capA.position.z = -(rOut + rIn) / 2;
      capB.position.z = (rOut + rIn) / 2;
    } else {
      capA.visible = rOut > 0.5;
      capB.visible = false;
      capA.scale.z = Math.max(0.5, 2 * rOut);
      capA.position.z = 0;
    }
    for (const m of caseCaps) m.visible = Math.abs(cMm) < 145;
  };

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  /**
   * Pose everything from the crank angle.
   * ops: {cut: 'solid'|'section', cutConst, explode 0..1, arrows 0..1}
   */
  function update(th, ops = {}) {
    const cut = ops.cut || 'solid';
    const ex = clamp(ops.explode ?? 0, 0, 1);
    const arrowsOn = ops.arrows ?? 1;

    // ---- section cut
    clipPlane.constant = ops.cutConst ?? 0.92;
    const sectionOn = cut === 'section';
    if (cut !== cutNow) {
      cutNow = cut;
      for (const m of shells) {
        m.clippingPlanes = sectionOn ? [clipPlane] : null;
        m.side = sectionOn ? THREE.DoubleSide : THREE.FrontSide;
        m.needsUpdate = true;
      }
      capGroup.visible = sectionOn;
    }
    charge.visible = cut !== 'section' && ex < 0.02;

    placeCap();

    // ---- explode choreography
    // Barrel and head leave; the crank train stays assembled. Lifting the piston instead left it
    // inside the jacket for part of the stroke (BDC crown 236 < jacket top 258), and lifting the cam
    // on its own pulled it out of the cam room and floated it above the head. Lifts are chosen so
    // every layer clears the one under it at all times: jacket ≥ piston crown (210) + gap, head ≥
    // jacket top (212 + lift) + gap.
    const eJacket = layerEase(ex, [0.12, 0.85], 205);
    const eHead = layerEase(ex, [0.06, 0.75], 300);

    cylGroup.position.y = eJacket;
    flywheel.position.z = -112 - layerEase(ex, [0.0, 0.4], 120);
    head.position.y = eHead;
    cam.position.y = 273 + eHead; // the cam is part of the head subassembly

    // ---- rotating parts
    crank.rotation.z = -th * DEG;
    flywheel.rotation.z = -th * DEG;
    crankGear.rotation.z = -th * DEG;
    cam.rotation.z = -th * DEG * 0.5;
    for (const l of lobes) l.group.rotation.z = Math.PI + (th - l.peak) * 0.5 * DEG;

    // ---- piston + rod
    const s = pistonAt(th);
    const crown = s + K.comp;
    piston.position.y = s;
    body.position.y = -2;
    wristPin.position.y = 0;
    rod.position.y = 0;

    const pinX = K.crankR * Math.sin(th * DEG);
    const pinY = K.crankR * Math.cos(th * DEG);
    tmpA.set(pinX, pinY, 0);
    tmpB.set(0, s, 0);
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
    charge.position.y = crown + (K.deck - crown) / 2 + 1.5;
    charge.scale.y = Math.max(1, K.deck - crown - 3);

    // ---- valvetrain
    for (const v of valveParts) {
      const lift = valveLift(th, v.which) * K.lift;
      v.group.position.y = -lift;
      v.spring.scale.y = (28 - lift) / 28;
    }

    // ---- accent arrow: the part doing the work, and the way it is moving
    const vel = pistonAt(th + 2) - s;
    arrow.position.y = crown - 26;
    arrow.rotation.z = vel > 0 ? 0 : Math.PI;
    arrow.scale.setScalar(arrowsOn * Math.min(1, Math.abs(vel) / 0.5));
    arrow.visible = arrowsOn > 0.02;
  }

  update(0, { cut: 'solid' });
  root.updateMatrixWorld(true);

  return {
    root,
    update,
    parts: { frame, crank, flywheel, crankGear, head, valves, cam, piston, rod, arrow },
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
  // Measured, not guessed: pads -87.5 mm … cam wall 338 mm (×0.006 + root 0.522) is y −0.003…2.55,
  // the case is 1.74 wide, the boss/flywheel span z −119…111 mm. The previous boxes were padded by
  // ~25% in depth, so the `wide` fill framed the padding and the machine only filled half the frame.
  const HERO = { center: [0, 1.2, -0.02], size: [1.95, 2.4, 1.5] };
  const UPPER = { center: [0, 1.42, -0.05], size: [1.7, 2.1, 1.5] };
  const HEAD = { center: [0, 2.06, -0.02], size: [1.2, 0.92, 1.15] };
  // Rest bounds plus the explode lifts: barrel 205, head 300, flywheel −120 in z.
  const EXPLODED = { center: [0, 2.12, -0.38], size: [1.95, 4.26, 2.1] };

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
        { dur: 1.5, size: 'full', subject: HERO, angle: 34, height: 'eye', move: 'orbit', amount: 0.7 },
        // The establishing pair reads as "sample on a bench": fill 0.98 keeps the whole machine in
        // frame while leaving no dead upper half (lookcheck half_void floor).
        { size: 'full', fill: 0.98, subject: HERO, angle: 14, height: 'eye', move: 'push', amount: 0.2 },
      ],
      'lab-section': [
        { dur: 1.4, size: 'full', subject: HERO, angle: 70, height: 20, move: 'pull' },
        { size: 'wide', subject: UPPER, angle: 82, height: 12, move: 'push' },
      ],
      'lab-explode': [
        // Open on the assembled sample at its own framing, then widen to the whole separating stack:
        // one `EXPLODED` shot from the start would enter on a machine half its usual size.
        { dur: 0.9, size: 'medium', subject: HERO, angle: 26, height: 18, move: 'push', amount: 0.2 },
        { size: 'full', subject: EXPLODED, angle: 18, height: 22, move: 'rise', amount: 0.3 },
      ],
      'lab-valves': [
        { dur: 1.6, size: 'wide', subject: UPPER, angle: 24, height: 30, move: 'push', amount: 0.4 },
        { size: 'medium', subject: HEAD, angle: 18, height: 14, move: 'push', amount: 0.25 },
      ],
    },
  });

  // Only the measurement shot keeps a curve: the indicator diagram that used to sit in scenes 01–02
  // was a 340 px unlabelled loop read by nobody (two curves + one dot, no scale), i.e. decoration.
  const intakeCurve = [];
  const exhaustCurve = [];
  for (let d = 0; d <= CYCLE; d += 4) {
    intakeCurve.push([d, valveLift(d, 'intake')]);
    exhaustCurve.push([d, valveLift(d, 'exhaust')]);
  }

  function hudState(sceneIndex, th, ops) {
    const ps = wrap720(th);
    const common = {
      title: 'SINGLE-CYLINDER FOUR-STROKE',
      subtitle: `Ø${K.bore} × ${STROKE_MM} mm · CR ${K.cr}:1`,
      accent: CAL_PALETTE.accent,
      phase: { labels: STROKES, index: strokeIndex(th) },
    };

    if (sceneIndex === 2) {
      return { ...common, big: { label: 'Explode', value: Math.round((ops.explode ?? 0) * 100), unit: '%' } };
    }

    if (sceneIndex === 3) {
      return {
        ...common,
        subtitle: 'INTAKE / EXHAUST LIFT · CAM 1:2',
        big: { label: 'Intake lift', value: (valveLift(th, 'intake') * K.lift).toFixed(2), unit: 'mm' },
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
      };
    }

    return {
      ...common,
      subtitle: sceneIndex === 1 ? `SECTION A–A · BORE Ø${K.bore}` : common.subtitle,
      big: { label: 'Crank angle', value: Math.round(ps), unit: '°' },
    };
  }

  function render(frame = {}) {
    const t = frame.t ?? 0;
    const localT = frame.localT ?? t;
    const sceneIndex = clamp(frame.sceneIndex ?? 0, 0, 3);
    const th = 150 + 200 * t; // 200°/s keeps the four strokes readable in 16 s

    const ops = { cut: 'solid', cutConst: 0.92, explode: 0, arrows: 1 };
    if (sceneIndex === 1) {
      ops.cut = 'section';
      // Stop inside the barrel wall: the near case wall and the near half of the barrel wall come
      // off, the crank/rod/piston stay whole. A cut at 0 halves the sample and the mechanism reads
      // as debris.
      ops.cutConst = lerp(0.92, 0.02, smootherstep(0.1, 1.7, localT));
    } else if (sceneIndex === 2) {
      ops.cut = 'solid';
      ops.explode = smootherstep(0.22, 2.3, localT);
      ops.arrows = 0;
    } else if (sceneIndex === 3) {
      // The head is open-front, so the valvetrain reads without a cut: keep the sample whole.
      ops.cut = 'solid';
      ops.arrows = 0;
      ops.explode = 1 - smootherstep(0.05, 0.95, localT);
    }

    sample.update(th, ops);
    hud.fit();
    hud.draw(hudState(sceneIndex, th, ops));
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
