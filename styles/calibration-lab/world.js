/**
 * Calibration Lab · Default Showcase Story (`styles/calibration-lab/world.js`).
 *
 * Separation of concerns (see `kernel.js`):
 *   - `./kernel.js` owns the reusable medium: pale studio with high-contrast reflection strips,
 *     procedural normal/roughness maps, CSG-2D & swept geometry primitives, true Stencil section
 *     capping, multi-DOF kinematics, pressure field shader, 3D dimension callouts and gauge HUD.
 *   - THIS file owns one subject only: a single-cylinder four-stroke sample on a calibration bench.
 *
 * Everything that moves is a pure function of one input, crank angle `th` (degrees):
 * piston position from the closed-form slider-crank, connecting-rod obliquity angle, valve lift
 * from its opening window, and chamber pressure from polytropic compression + combustion.
 */

import '../../engine/vendor/three.min.js';
import { clamp, lerp, smootherstep } from '../../engine/motion.js';
import {
  CAL_PALETTE,
  bellowsGeometry,
  blockGeometry,
  boltGeometry,
  counterboreBossGeometry,
  createCalLabStudio,
  createDimensionCallout,
  createGaugeHud,
  createMaterials,
  createPressureFieldMaterial,
  createSectionCutManager,
  createTorqueArc,
  creviceAoBox,
  creviceAoRing,
  gearGeometry,
  helixGeometry,
  layerEase,
  machinedPlateGeometry,
  normalizeGeometryUVs,
  poseCompressedSpring,
  ribbedLinkGeometry,
  sweptProfileGeometry,
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
const CHARGE_COLORS = ['#FF6B2B', '#8E99A6', '#5B9BE0', '#D99B4E'];

// ============================================================================
// 2. GEOMETRY
// ============================================================================

/** Crank web outline: counterweight sector opposite the pin, boss around the pin, bored shaft hole. */
function webGeometry(thick) {
  const R = 54;
  const s = new THREE.Shape();
  s.moveTo(-R * Math.sin(1.0), -R * Math.cos(1.0));
  s.absarc(0, 0, R, -Math.PI / 2 - 1.0, -Math.PI / 2 + 1.0, false);
  s.lineTo(26, 20);
  s.absarc(0, K.crankR, 26, 0, Math.PI, false);
  s.lineTo(-26, 20);
  s.closePath();

  const mainHole = new THREE.Path();
  mainHole.absarc(0, 0, 14.5, 0, Math.PI * 2, true);
  s.holes.push(mainHole);

  for (const sx of [-1, 1]) {
    const balanceHole = new THREE.Path();
    balanceHole.absarc(sx * 22, -26, 7.5, 0, Math.PI * 2, true);
    s.holes.push(balanceHole);
  }

  const g = new THREE.ExtrudeGeometry(s, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: 1.4,
    bevelSize: 1.4,
    bevelSegments: 2,
    curveSegments: 28,
  });
  g.translate(0, 0, -thick / 2);
  g.computeVertexNormals();
  return normalizeGeometryUVs(g);
}

export function buildSample(M, hostScene) {
  const root = new THREE.Group();
  const rootScale = 0.006;
  root.scale.setScalar(rootScale);
  root.position.y = 0.522; // rubber pads rest on the bench (y = 0)

  const add = (parent, geo, mat, opts = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = opts.cast !== false;
    m.receiveShadow = opts.receive !== false;
    parent.add(m);
    return m;
  };

  // True Stencil section-cut manager: automatically caps any registered closed shell with a 45°
  // CNC hatched cross-section plane without hand-coded cap boxes.
  const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.92);
  const section = createSectionCutManager({
    scene: hostScene,
    plane: clipPlane,
    capMaterial: M.sectionCap.clone(),
    size: 12,
  });

  // Clone shell materials so section clipping only affects structural housings and cylinder walls
  const shellBlack = M.black.clone();
  const shellAlu = M.alu.clone();
  const shellAluDark = M.aluDark.clone();
  const jacketMat = M.white.clone();

  // ---------------------------------------------------------------- bench fixture / crankcase
  const frame = new THREE.Group();
  root.add(frame);

  // Base plate with machined mounting holes and crevice AO collar
  const base = add(
    frame,
    machinedPlateGeometry({
      w: 300,
      h: 16,
      d: 190,
      r: 8,
      bevel: 1.4,
      holes: [
        { x: -128, z: -76, r: 5.5 },
        { x: 128, z: -76, r: 5.5 },
        { x: -128, z: 76, r: 5.5 },
        { x: 128, z: 76, r: 5.5 },
      ],
    }),
    shellAluDark,
  );
  base.position.y = -70;

  const caseAo = creviceAoBox({ w: 290, d: 180, spread: 14, opacity: 0.45 });
  caseAo.position.y = -61.8;
  frame.add(caseAo);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pad = add(frame, new THREE.CylinderGeometry(11, 11, 9, 20), M.rubber);
      pad.position.set(sx * 118, -83, sz * 70);
      const mountBolt = add(frame, boltGeometry({ r: 4.5, h: 7 }), M.steel);
      mountBolt.position.set(sx * 128, -59, sz * 76);
    }
  }

  // Hollow machined crankcase with weight-relief side pockets and bored main bearing journals
  const frontBackGeo = machinedPlateGeometry({
    w: 290,
    h: 16,
    d: 142,
    r: 4,
    bevel: 1.2,
    holes: [{ x: 0, z: 8, r: 22 }],
  });
  frontBackGeo.rotateX(Math.PI / 2);

  const backWall = add(frame, frontBackGeo, shellBlack);
  backWall.position.set(0, -8, -82);
  const frontWall = add(frame, frontBackGeo, shellBlack);
  frontWall.position.set(0, -8, 82);

  const sideWallGeo = machinedPlateGeometry({
    w: 16,
    h: 142,
    d: 180,
    r: 3,
    bevel: 1.0,
    slots: [
      { x: 0, z: -38, w: 6, d: 52, r: 2.5 },
      { x: 0, z: 38, w: 6, d: 52, r: 2.5 },
    ],
  });
  const farWall = add(frame, sideWallGeo, shellBlack);
  farWall.position.set(-137, -8, 0);
  const nearWall = add(frame, sideWallGeo, shellBlack);
  nearWall.position.set(137, -8, 0);

  const floorWall = add(frame, blockGeometry({ w: 290, h: 16, d: 180, r: 4 }), shellBlack);
  floorWall.position.set(0, -71, 0);

  const caseDeck = add(
    frame,
    machinedPlateGeometry({
      w: 290,
      h: 16,
      d: 180,
      r: 6,
      bevel: 1.2,
      holes: [{ x: 0, z: 0, r: 56 }],
    }),
    shellBlack,
  );
  caseDeck.position.y = 55;

  // Front main bearing housing with counterbored flange and bronze bushing
  const boss = add(
    frame,
    counterboreBossGeometry({ rOuter: 37, rBore: 16, rCounter: 26, hTotal: 20, hCounter: 5, bevel: 1.4, seg: 40 }),
    shellAlu,
  );
  boss.rotation.x = Math.PI / 2;
  boss.position.set(0, 0, 96);

  const frontBushing = add(
    frame,
    counterboreBossGeometry({ rOuter: 22, rBore: 15.2, rCounter: 18, hTotal: 18, hCounter: 3, bevel: 0.8, seg: 32 }),
    M.bronze,
  );
  frontBushing.rotation.x = Math.PI / 2;
  frontBushing.position.set(0, 0, 98);

  const bossAo = creviceAoRing({ rIn: 35, rOut: 48, opacity: 0.45 });
  bossAo.rotation.x = Math.PI / 2;
  bossAo.position.set(0, 0, 90.2);
  frame.add(bossAo);

  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const fb = add(frame, boltGeometry({ r: 2.8, h: 5 }), M.steel);
    fb.rotation.x = Math.PI / 2;
    fb.position.set(Math.cos(a) * 30, Math.sin(a) * 30, 107);
  }

  // Engraved calibration nameplate on front crankcase wall
  const plate = add(frame, blockGeometry({ w: 86, h: 34, d: 3, r: 3 }), shellAlu);
  plate.position.set(-96, -26, 91);
  for (const px of [-32, 32]) {
    const screw = add(frame, boltGeometry({ r: 2.4, h: 4 }), M.steel);
    screw.position.set(-96 + px, -26, 93);
    screw.rotation.x = Math.PI / 2;
  }

  // Register crankcase walls for Stencil Section Capping
  section.addShell(backWall);
  section.addShell(frontWall);
  section.addShell(farWall);
  section.addShell(nearWall);
  section.addShell(floorWall);
  section.addShell(caseDeck);
  section.addShell(boss);

  // ---------------------------------------------------------------- air-cooled cylinder barrel
  const cylGroup = new THREE.Group();
  frame.add(cylGroup);

  const revolve = (profile, mat, seg = 64) => {
    const g = new THREE.LatheGeometry(
      profile.map(([r, y]) => new THREE.Vector2(r, y)),
      seg,
    );
    g.computeVertexNormals();
    return add(cylGroup, normalizeGeometryUVs(g), mat);
  };

  // Finned barrel casting with inner bore Ø86 (r=43) and 4 stepped cooling fins
  const barrelMesh = revolve(
    [
      [43, 32], [72, 32], [72, 66], [80, 66], [80, 76], [72, 76],
      [72, 104], [80, 104], [80, 114], [72, 114], [72, 142], [80, 142],
      [80, 152], [72, 152], [72, 180], [80, 180], [80, 190], [72, 190],
      [66, 206], [66, 212], [43, 212], [43, 32],
    ],
    jacketMat,
  );
  const baseFlange = revolve([[58, 33], [84, 33], [84, 47], [58, 47], [58, 33]], shellAlu);

  const cylBaseAo = creviceAoRing({ rIn: 78, rOut: 98, opacity: 0.48 });
  cylBaseAo.position.y = 63.2;
  cylGroup.add(cylBaseAo);

  // Counterbored hold-down studs around cylinder base flange
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const seat = add(
        cylGroup,
        counterboreBossGeometry({ rOuter: 8.5, rBore: 3.5, rCounter: 5.8, hTotal: 14, hCounter: 4 }),
        shellAlu,
      );
      seat.position.set(sx * 54, 40, sz * 54);
      const nut = add(cylGroup, boltGeometry({ r: 4.2, h: 6.5 }), M.steel);
      nut.position.set(sx * 54, 47.5, sz * 54);
    }
  }

  // External braided breather / oil-return bellows line tucked on the rear-left service side
  const breatherBellows = add(
    cylGroup,
    bellowsGeometry({ rInner: 5.0, rOuter: 7.4, rBore: 3.2, ribs: 8, len: 56, seg: 28 }),
    M.graphite,
  );
  breatherBellows.position.set(-64, 96, -46);

  section.addShell(barrelMesh);
  section.addShell(baseFlange);

  // ---------------------------------------------------------------- crankshaft + flywheel + drive gear
  const crank = new THREE.Group();
  root.add(crank);
  const shaft = add(crank, normalizeGeometryUVs(new THREE.CylinderGeometry(14.5, 14.5, 262, 32)), M.chrome);
  shaft.rotation.x = Math.PI / 2;
  const webGeo = webGeometry(16);
  for (const z of [-30, 30]) {
    const w = add(crank, webGeo, M.steel);
    w.position.z = z;
  }
  const crankPin = add(crank, normalizeGeometryUVs(new THREE.CylinderGeometry(16, 16, 52, 28)), M.chrome);
  crankPin.rotation.x = Math.PI / 2;
  crankPin.position.y = K.crankR;

  const flywheel = new THREE.Group();
  flywheel.position.z = -112;
  root.add(flywheel);
  const disc = add(
    flywheel,
    counterboreBossGeometry({ rOuter: 62, rBore: 15, rCounter: 46, hTotal: 16, hCounter: 4, bevel: 1.5, seg: 64 }),
    M.black,
  );
  disc.rotation.x = Math.PI / 2;
  add(
    flywheel,
    gearGeometry({ teeth: 56, rOut: 72, rRoot: 66, width: 14, holeR: 38, lighteningHoles: 6, lighteningR: 7.5 }),
    M.black,
  );
  const mark = add(flywheel, new THREE.BoxGeometry(8, 16, 4), M.accent, { cast: false });
  mark.position.set(0, 52, 10);

  // Helical front timing gear with lightening holes
  const crankGear = add(
    root,
    gearGeometry({ teeth: 34, rOut: 52, rRoot: 46, width: 15, holeR: 15, helix: 0.25, lighteningHoles: 5, lighteningR: 6.2 }),
    M.alu,
  );
  crankGear.position.set(0, 0, 112);

  // ---------------------------------------------------------------- cylinder head + valvetrain + rocker arms
  const head = new THREE.Group();
  root.add(head);

  const headBack = add(
    head,
    machinedPlateGeometry({
      w: 138,
      h: 12,
      d: 80,
      r: 4,
      bevel: 1.0,
      slots: [{ x: 0, z: 0, w: 86, d: 34, r: 4 }],
    }),
    shellAlu,
  );
  headBack.rotation.x = Math.PI / 2;
  headBack.position.set(0, 252, -56);
  section.addShell(headBack);

  for (const sx of [-1, 1]) {
    const headSide = add(
      head,
      machinedPlateGeometry({
        w: 12,
        h: 80,
        d: 124,
        r: 4,
        bevel: 1.0,
        holes: [{ x: 0, z: -10, r: 11 }],
      }),
      shellAlu,
    );
    headSide.position.set(sx * 63, 252, 0);
    section.addShell(headSide);
  }

  const headDeck = add(
    head,
    machinedPlateGeometry({
      w: 138,
      h: 10,
      d: 124,
      r: 4,
      bevel: 1.0,
      holes: [
        { x: -20, z: 0, r: 12 },
        { x: 20, z: 0, r: 12 },
      ],
    }),
    shellBlack,
  );
  headDeck.position.y = 217;
  section.addShell(headDeck);

  // Roof plate with machined counterbore bosses and crevice AO rings for the 4 cap bolts
  const headPlate = add(
    head,
    machinedPlateGeometry({
      w: 112,
      h: 10,
      d: 112,
      r: 5,
      bevel: 1.2,
      holes: [
        { x: -44, z: -44, r: 4 },
        { x: 44, z: -44, r: 4 },
        { x: -44, z: 44, r: 4 },
        { x: 44, z: 44, r: 4 },
      ],
    }),
    shellAlu,
  );
  headPlate.position.y = 302;
  section.addShell(headPlate);

  const gasketRing = normalizeGeometryUVs(
    new THREE.LatheGeometry(
      [[70, 209], [70, 215], [44, 215], [44, 209], [70, 209]].map(([r, y]) => new THREE.Vector2(r, y)),
      48,
    ),
  );
  section.addShell(add(head, gasketRing, shellBlack));

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cBoss = add(
        head,
        counterboreBossGeometry({ rOuter: 9.2, rBore: 4.0, rCounter: 6.4, hTotal: 6, hCounter: 2.5 }),
        shellAlu,
      );
      cBoss.position.set(sx * 44, 308, sz * 44);
      const ao = creviceAoRing({ rIn: 8.5, rOut: 14, opacity: 0.42 });
      ao.position.set(sx * 44, 307.1, sz * 44);
      head.add(ao);
      const bolt = add(head, boltGeometry({ r: 4.8, h: 7.5 }), M.steel);
      bolt.position.set(sx * 44, 311, sz * 44);
    }
  }

  for (const sx of [-1, 1]) {
    const flange = add(
      head,
      counterboreBossGeometry({ rOuter: 18, rBore: 11, rCounter: 14, hTotal: 10, hCounter: 3 }),
      shellAlu,
    );
    flange.rotation.z = Math.PI / 2;
    flange.position.set(sx * 70, 232, -10);
  }

  const valves = new THREE.Group();
  head.add(valves);
  const valveParts = [];
  for (const [sx, which] of [[-1, 'intake'], [1, 'exhaust']]) {
    // Stationary bronze valve guide + lower spring seat on the head deck
    const guide = add(
      valves,
      counterboreBossGeometry({ rOuter: 13.5, rBore: 3.6, rCounter: 10.5, hTotal: 9, hCounter: 3 }),
      M.bronze,
    );
    guide.position.set(sx * 20, 224, 0);
    const seatAo = creviceAoRing({ rIn: 12, rOut: 18, opacity: 0.45 });
    seatAo.position.set(sx * 20, 222.2, 0);
    valves.add(seatAo);

    const v = new THREE.Group();
    v.position.x = sx * 20;
    valves.add(v);
    const stem = add(v, normalizeGeometryUVs(new THREE.CylinderGeometry(3.4, 3.4, 42, 16)), M.chrome);
    stem.position.y = 237;
    const face = add(v, normalizeGeometryUVs(new THREE.CylinderGeometry(15.5, 6, 7, 28)), M.steel);
    face.position.y = 216.5;

    const spring = new THREE.Group();
    spring.position.set(sx * 20, 225, 0);
    valves.add(spring);
    add(spring, helixGeometry({ r: 11, wire: 1.85, turns: 7, len: 28 }), M.bronze);

    const retainer = add(
      v,
      counterboreBossGeometry({ rOuter: 12.5, rBore: 3.5, rCounter: 9.2, hTotal: 4.5, hCounter: 1.8 }),
      M.steel,
    );
    retainer.position.y = 253.5;

    // Pivoting roller-finger follower / rocker arm bridging cam lobe and valve stem tip
    const follower = new THREE.Group();
    follower.position.set(sx * 36, 261, 0);
    valves.add(follower);
    const armMesh = add(
      follower,
      ribbedLinkGeometry({ length: 20, rBig: 6.5, rSmall: 5.0, rBoreBig: 3.2, rBoreSmall: 2.4, beamW: 8, thickness: 8, webThickness: 3 }),
      M.graphite,
    );
    armMesh.rotation.z = sx * (Math.PI / 2);
    armMesh.position.x = -sx * 10;

    valveParts.push({ which, sx, group: v, spring, follower });
  }

  // Variable-radius swept exhaust manifold using `sweptProfileGeometry`
  {
    const pts = [
      new THREE.Vector3(-66, 232, -10),
      new THREE.Vector3(-104, 226, -12),
      new THREE.Vector3(-128, 198, -14),
      new THREE.Vector3(-132, 148, -14),
    ];
    const pipeGeo = sweptProfileGeometry({
      points: pts,
      radiusAt: (u) => lerp(13.5, 15.5, smootherstep(0.65, 1.0, u)),
      tubularSeg: 44,
      radialSeg: 22,
    });
    add(head, pipeGeo, shellBlack);
    const outlet = add(
      head,
      counterboreBossGeometry({ rOuter: 21, rBore: 12, rCounter: 16, hTotal: 9, hCounter: 3 }),
      shellAlu,
    );
    outlet.position.set(-132, 146, -14);
  }

  const plug = new THREE.Group();
  head.add(plug);
  plug.position.set(0, 268, -34);
  add(plug, normalizeGeometryUVs(new THREE.CylinderGeometry(6, 6, 26, 16)), jacketMat).position.y = 12;
  add(plug, boltGeometry({ r: 8, h: 8, washer: true }), M.steel).position.y = -2;

  // ---------------------------------------------------------------- cam carrier + camshaft
  const camWallZ = add(head, blockGeometry({ w: 126, h: 36, d: 12, r: 4 }), shellBlack);
  camWallZ.position.set(0, 282, -51);
  section.addShell(camWallZ);
  for (const sx of [-1, 1]) {
    const frontPost = add(head, blockGeometry({ w: 12, h: 28, d: 12, r: 3 }), shellBlack);
    frontPost.position.set(sx * 57, 278, 47);
    const bearingCap = add(head, blockGeometry({ w: 24, h: 10, d: 24, r: 3 }), shellAlu);
    bearingCap.position.set(sx * 57, 292, 47);
  }
  const cam = new THREE.Group();
  cam.position.y = 275;
  root.add(cam);
  const camShaft = add(cam, normalizeGeometryUVs(new THREE.CylinderGeometry(10.5, 10.5, 156, 24)), M.chrome);
  camShaft.rotation.x = Math.PI / 2;
  camShaft.position.z = -22;
  const camSprocket = new THREE.Mesh(
    gearGeometry({ teeth: 20, rOut: 33, rRoot: 28, width: 11, holeR: 11, lighteningHoles: 4, lighteningR: 4.5 }),
    M.alu,
  );
  camSprocket.position.z = -96;
  cam.add(camSprocket);

  const lobes = [];
  for (const [sx, which] of [[-1, 'intake'], [1, 'exhaust']]) {
    const lg = new THREE.Group();
    lg.position.x = sx * 20;
    cam.add(lg);
    const shape = new THREE.Shape();
    shape.absellipse(0, 4.2, 9.5, 14.2, 0, Math.PI * 2, false, 0);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 6.5, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = normalizeGeometryUVs(
      new THREE.ExtrudeGeometry(shape, {
        depth: 11,
        bevelEnabled: true,
        bevelSize: 0.9,
        bevelThickness: 0.9,
        bevelSegments: 2,
        curveSegments: 24,
      }),
    );
    geo.translate(0, 0, -5.5);
    add(lg, geo, M.steel);
    const [a, b] = VALVE_WINDOWS[which];
    lobes.push({ group: lg, peak: (a + b) / 2, which });
  }

  // ---------------------------------------------------------------- piston + forged I-beam connecting rod
  const piston = new THREE.Group();
  root.add(piston);
  // Machined piston skirt with ring grooves and wrist-pin bore
  const pistonProfile = [
    [0, 24],
    [K.bore / 2 - 0.8, 24],
    [K.bore / 2 - 0.5, 19],
    [K.bore / 2 - 2.2, 19],
    [K.bore / 2 - 2.2, 16.5],
    [K.bore / 2 - 0.5, 16.5],
    [K.bore / 2 - 0.5, 12],
    [K.bore / 2 - 2.2, 12],
    [K.bore / 2 - 2.2, 9.5],
    [K.bore / 2 - 0.5, 9.5],
    [K.bore / 2 - 0.5, -26],
    [K.bore / 2 - 5.5, -26],
    [K.bore / 2 - 5.5, 16],
    [0, 16],
    [0, 24],
  ];
  const pistonGeo = normalizeGeometryUVs(
    new THREE.LatheGeometry(
      pistonProfile.map(([r, y]) => new THREE.Vector2(r, y)),
      48,
    ),
  );
  const body = add(piston, pistonGeo, M.steel);
  const ringGeo = new THREE.TorusGeometry(K.bore / 2 - 0.7, 1.3, 10, 48);
  for (const dy of [17.7, 10.7]) {
    const ring31 = add(piston, ringGeo, M.black);
    ring31.rotation.x = Math.PI / 2;
    ring31.position.y = dy;
  }
  const wristPin = add(piston, normalizeGeometryUVs(new THREE.CylinderGeometry(9.5, 9.5, 74, 20)), M.chrome);
  wristPin.rotation.z = Math.PI / 2;

  // Forged I-beam connecting rod (`ribbedLinkGeometry`) with bronze small-end & big-end bushings
  const rod = new THREE.Group();
  root.add(rod);
  const rodGeo = ribbedLinkGeometry({
    length: K.rod,
    rBig: 24,
    rSmall: 14.5,
    rBoreBig: 16.2,
    rBoreSmall: 9.8,
    beamW: 20,
    thickness: 16,
    webThickness: 5.5,
    bevel: 1.0,
  });
  add(rod, rodGeo, M.graphite);
  const bigBushing = add(
    rod,
    counterboreBossGeometry({ rOuter: 18.5, rBore: 15.8, rCounter: 17, hTotal: 19, hCounter: 2 }),
    M.bronze,
  );
  bigBushing.rotation.x = Math.PI / 2;
  bigBushing.position.y = -K.rod / 2;
  const smallBushing = add(
    rod,
    counterboreBossGeometry({ rOuter: 11.8, rBore: 9.5, rCounter: 10.6, hTotal: 19, hCounter: 2 }),
    M.bronze,
  );
  smallBushing.rotation.x = Math.PI / 2;
  smallBushing.position.y = K.rod / 2;

  // ---------------------------------------------------------------- physical field shader & 3D metrology callouts
  const pressureMat = createPressureFieldMaterial({ clipPlane });
  const charge = new THREE.Mesh(
    new THREE.CylinderGeometry(K.bore / 2 - 1.2, K.bore / 2 - 1.2, 1, 40, 12, false),
    pressureMat,
  );
  charge.renderOrder = 3;
  charge.userData.skipContactShadow = true;
  root.add(charge);

  // Instrument-grade 3D torque arc around the front crank drive pulley
  const torqueArc = createTorqueArc({ radius: 62, width: 5.2, spanDeg: 92, color: CAL_PALETTE.accent });
  torqueArc.group.position.set(0, 0, 118);
  root.add(torqueArc.group);

  // 3D engineering dimension callout tracking live piston stroke / explode height
  const strokeCallout = createDimensionCallout({
    text: `86.0 mm`,
    label: `BORE Ø${K.bore} · STROKE`,
    x: 98,
    y0: 124,
    y1: 210,
    witnessX: 76,
    accent: true,
  });
  root.add(strokeCallout.group);

  /**
   * Pose everything from crank angle `th` (degrees) and operational state `ops`.
   * ops: { cut: 'solid'|'section', cutConst, explode: 0..1, arrows: 0..1, t: 0 }
   */
  function update(th, ops = {}) {
    const cut = ops.cut || 'solid';
    const ex = clamp(ops.explode ?? 0, 0, 1);
    const arrowsOn = ops.arrows ?? 1;
    const t = ops.t ?? 0;

    // ---- 1. True Stencil section cut
    const sectionOn = cut === 'section';
    section.update({
      enabled: sectionOn,
      constant: ops.cutConst ?? 0.92,
    });

    // ---- 2. Staged explode choreography
    const eJacket = layerEase(ex, [0.12, 0.85], 205);
    const eHead = layerEase(ex, [0.06, 0.75], 300);

    cylGroup.position.y = eJacket;
    flywheel.position.z = -112 - layerEase(ex, [0.0, 0.4], 120);
    head.position.y = eHead;
    cam.position.y = 275 + eHead;

    // ---- 3. Rotating shafts & cam lobes
    crank.rotation.z = -th * DEG;
    flywheel.rotation.z = -th * DEG;
    crankGear.rotation.z = -th * DEG;
    cam.rotation.z = -th * DEG * 0.5;
    for (const l of lobes) l.group.rotation.z = Math.PI + (th - l.peak) * 0.5 * DEG;

    // ---- 4. Closed-form slider-crank piston + forged I-beam rod
    const s = pistonAt(th);
    const crown = s + K.comp;
    piston.position.y = s;
    body.position.y = 0;
    wristPin.position.y = 0;

    const pinX = K.crankR * Math.sin(th * DEG);
    const pinY = K.crankR * Math.cos(th * DEG);
    const midX = pinX * 0.5;
    const midY = (pinY + s) * 0.5;
    const dx = -pinX;
    const dy = s - pinY;
    rod.position.set(midX, midY, 0);
    rod.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;

    // ---- 5. Thermodynamic pressure field shader (visible inside sectioned bore!)
    const key = strokeIndex(th);
    const strokeU = (wrap720(th) % 180) / 180;
    const compressionRatioNorm = clamp((crown - (S_BDC + K.comp)) / STROKE_MM, 0, 1);
    const isPower = key === 0;
    const isCompress = key === 3;
    const pressureLevel = isPower
      ? Math.pow(1 - strokeU, 1.3)
      : isCompress
        ? Math.pow(compressionRatioNorm, 1.5)
        : 0.22;
    const burnLevel = isPower ? Math.pow(Math.max(0, 1 - strokeU * 1.35), 1.4) : isCompress ? compressionRatioNorm * 0.45 : 0.0;

    pressureMat.uniforms.uBaseColor.value.set(CHARGE_COLORS[key]);
    pressureMat.uniforms.uPressure.value = pressureLevel;
    pressureMat.uniforms.uBurn.value = burnLevel;
    pressureMat.uniforms.uTime.value = t;
    pressureMat.uniforms.uOpacity.value = sectionOn ? 0.58 : 0.28;

    const chHeight = Math.max(2, K.deck - crown - 1.5);
    charge.position.y = crown + chHeight / 2;
    charge.scale.y = chHeight;
    charge.visible = ex < 0.02;

    // ---- 6. Valvetrain, rocker followers & volume-conserving springs
    for (const v of valveParts) {
      const lift = valveLift(th, v.which) * K.lift;
      v.group.position.y = -lift;
      poseCompressedSpring(v.spring, 28, 28 - lift);
      v.follower.rotation.z = v.sx * (lift / 20);
    }

    // ---- 7. Torque arc & 3D metrology dimension callout
    torqueArc.group.rotation.z = -th * DEG * 0.35;
    torqueArc.material.opacity = 0.85 * arrowsOn;
    torqueArc.group.visible = arrowsOn > 0.02;

    const calloutVis = sectionOn ? 0 : arrowsOn;
    if (ex > 0.05) {
      strokeCallout.update({
        y0: 55,
        y1: 212 + eJacket,
        x: 108,
        witnessX: 80,
        label: 'BARREL LIFT ΔY',
        text: `+${Math.round(eJacket)} mm`,
        opacity: smootherstep(0.08, 0.28, ex),
      });
    } else {
      strokeCallout.update({
        y0: crown,
        y1: K.deck,
        x: 104,
        witnessX: 80,
        label: `CLEARANCE · Ø${K.bore}`,
        text: `${(K.deck - crown).toFixed(1)} mm`,
        opacity: calloutVis,
      });
    }
  }

  update(0, { cut: 'solid', t: 0 });
  root.updateMatrixWorld(true);

  return {
    root,
    update,
    parts: { frame, crank, flywheel, crankGear, head, valves, cam, piston, rod },
    clipPlane,
    section,
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

  // Measured framing envelopes, including dynamic interpolated `{ from: HERO, to: EXPLODED }`
  // supported by the upgraded `engine/director.js`.
  const HERO = { center: [0, 1.2, -0.02], size: [1.95, 2.4, 1.5] };
  const UPPER = { center: [0, 1.42, -0.05], size: [1.7, 2.1, 1.5] };
  const HEAD = { center: [0, 2.06, -0.02], size: [1.2, 0.92, 1.15] };
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
        { dur: 1.5, size: 'full', subject: HERO, angle: 44, height: 'eye', move: 'orbit', amount: 0.7 },
        { size: 'full', fill: 0.98, subject: HERO, angle: 12, height: 'eye', move: 'push', amount: 0.2 },
      ],
      'lab-section': [
        { dur: 1.4, size: 'full', subject: HERO, angle: 70, height: 20, move: 'pull' },
        { size: 'wide', subject: UPPER, angle: 82, height: 12, move: 'push' },
      ],
      'lab-explode': [
        { dur: 0.9, size: 'medium', subject: { from: HERO, to: EXPLODED }, angle: 26, height: 18, move: 'push', amount: 0.2 },
        { size: 'full', subject: EXPLODED, angle: 18, height: 22, move: 'rise', amount: 0.3 },
      ],
      'lab-valves': [
        { dur: 1.6, size: 'wide', subject: UPPER, angle: 24, height: 30, move: 'push', amount: 0.4 },
        { size: 'medium', subject: HEAD, angle: 18, height: 14, move: 'push', amount: 0.25 },
      ],
    },
  });

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
      subtitle: sceneIndex === 1 ? `SECTION A–A · STENCIL CAP · BORE Ø${K.bore}` : common.subtitle,
      big: { label: 'Crank angle', value: Math.round(ps), unit: '°' },
    };
  }

  function render(frame = {}) {
    const t = frame.t ?? 0;
    const localT = frame.localT ?? t;
    const sceneIndex = clamp(frame.sceneIndex ?? 0, 0, 3);
    const th = 150 + 200 * t;

    const ops = { cut: 'solid', cutConst: 0.92, explode: 0, arrows: 1, t };
    if (sceneIndex === 1) {
      ops.cut = 'section';
      ops.cutConst = lerp(0.92, 0.02, smootherstep(0.1, 1.7, localT));
    } else if (sceneIndex === 2) {
      ops.cut = 'solid';
      ops.explode = smootherstep(0.22, 2.3, localT);
      ops.arrows = 0;
    } else if (sceneIndex === 3) {
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
