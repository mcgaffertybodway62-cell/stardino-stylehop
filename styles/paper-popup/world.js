/**
 * Paper Pop-Up Book · Default Showcase Story (`styles/paper-popup/world.js`):
 *   《春涧折莲与星夜镂空月：桌上的立体书》 (Spring Origami Lotus & Starlight Kirigami Moon)
 *
 * Built 100% from rule-based generative primitives in `./kernel.js` (`paperProfileFn`,
 * `createKirigamiCard`, `createOrigamiLotus`, `createKirigamiMoonArch`,
 * `createPopUpBookBase`, `buildPaperWater`, `createOrigamiCrane`, `createOrigamiButterfly`,
 * `createPaperBoat`, `createPaperPineTree`), following the 3 core laws of the Tabletop Pop-Up Book Theater:
 *   1. Clearly visible 3D hardcover pop-up book lying flat on the studio tabletop (`> 50%` negative space,
 *      all 4 edges of the burgundy cover, gold-foil corners, crimson bookmark ribbon & stepped page stack visible).
 *   2. Uncluttered, zero-interpenetration composition (`<= 4` distinct elements per spread, parted flanking ridge
 *      corridors so the hero Origami Lotus and Origami Paper Boat are 100% unobstructed).
 *   3. Two spreads across 4 scenes with ONE single, unhurried, 180° curving page turn between Scene 2 and Scene 3
 *      (Spread A folds down flat at the end of Scene 2 before the right-hand book page curls across the spine).
 */

import {
  THREE,
  PAPER_PALETTE,
  clamp,
  lerp,
  smootherstep,
  flowStep,
  evalOrigamiWingFlap,
  createPopUpBookBase,
  createKirigamiCard,
  createOrigamiLotus,
  createKirigamiMoonArch,
  buildPaperWater,
  createOrigamiCrane,
  createOrigamiButterfly,
  createPaperBoat,
  createPaperPineTree,
  createPaperStudioStage,
} from './kernel.js';

export async function createWorld({ width = 1920, height = 1080, scenes = [], style = {} } = {}) {
  const studio = createPaperStudioStage({
    width,
    height,
    baseFov: 31,
    look: style.look,
    looks: style.looks,
    scenes,
  });
  const { scene, makeCardstockMat } = studio;

  // -------------------------------------------------------------------------
  // 1. Sculptural Tabletop 3D Pop-Up Book (`15.6 x 9.0` open book on the table)
  // -------------------------------------------------------------------------
  const bookBase = createPopUpBookBase(makeCardstockMat, {
    coverWidth: 15.6,
    coverDepth: 9.0,
    spreadCount: 2,
  });
  scene.add(bookBase);
  const pageY = bookBase.pageY; // 0.55

  // =========================================================================
  // SPREAD 0 (Scenes 1 & 2 · `0.0s – 7.4s`):
  //   《春涧折纸莲 · Spring Kirigami Valley & Blooming Origami Lotus》
  //   Clean multi-tone layered paper silhouettes framing an open V-shaped valley
  //   corridor so 100% of the emerald lily pad & 3-ring Origami Lotus are visible:
  //     Layer 1: z = -3.1 (Clean Celadon Kirigami Ridge with single central water-arch)
  //     Layer 2: z = -1.2 (Parted Left & Right Coral/Amber Valley Hills + Folded Paper Pines)
  //     Layer 3: z = +0.55 (Low Scalloped Mint & Cream Paper Stream)
  //     Layer 4: z = +0.85 (Hero 3-Ring Crease-Folded Origami Lotus resting in clear foreground)
  // =========================================================================

  const springBackRidge = createKirigamiCard(makeCardstockMat, {
    width: 13.0,
    baseHeight: 1.48,
    peaks: [
      [-4.1, 1.24, 2.2],
      [0.0, 0.35, 1.9],
      [4.1, 1.32, 2.2],
    ],
    seed: 19,
    rough: 0.12,
    mode: 'mountain',
    cutouts: [
      { x: 0.0, y: 0.0, w: 1.05, h: 0.92, kind: 'arch' },
    ],
    color: PAPER_PALETTE.celadonTeal,
    y: pageY,
    z: -3.1,
  });
  bookBase.addLayer(0, springBackRidge);

  const springValleyLeft = createKirigamiCard(makeCardstockMat, {
    width: 4.5,
    baseHeight: 0.85,
    peaks: [
      [-0.45, 0.98, 1.45],
      [0.95, 0.42, 1.1],
    ],
    seed: 23,
    rough: 0.1,
    mode: 'mountain',
    cutouts: [],
    color: PAPER_PALETTE.ridgeCoral,
    x: -3.85,
    y: pageY,
    z: -1.2,
  });
  const pineL1 = createPaperPineTree(makeCardstockMat, 0.92, PAPER_PALETTE.bambooGreen);
  pineL1.position.set(-1.35, 0.0, 0.18);
  springValleyLeft.foldPivot.add(pineL1);
  const pineL2 = createPaperPineTree(makeCardstockMat, 0.72, PAPER_PALETTE.jadeBlue);
  pineL2.position.set(1.15, 0.0, 0.22);
  springValleyLeft.foldPivot.add(pineL2);
  bookBase.addLayer(0, springValleyLeft);

  const springValleyRight = createKirigamiCard(makeCardstockMat, {
    width: 4.5,
    baseHeight: 0.85,
    peaks: [
      [-0.95, 0.42, 1.1],
      [0.45, 1.02, 1.45],
    ],
    seed: 31,
    rough: 0.1,
    mode: 'mountain',
    cutouts: [],
    color: PAPER_PALETTE.canyonAmber,
    x: 3.85,
    y: pageY,
    z: -1.2,
  });
  const pineR1 = createPaperPineTree(makeCardstockMat, 0.95, PAPER_PALETTE.bambooGreen);
  pineR1.position.set(1.35, 0.0, 0.18);
  springValleyRight.foldPivot.add(pineR1);
  const pineR2 = createPaperPineTree(makeCardstockMat, 0.74, PAPER_PALETTE.jadeBlue);
  pineR2.position.set(-1.15, 0.0, 0.22);
  springValleyRight.foldPivot.add(pineR2);
  bookBase.addLayer(0, springValleyRight);

  const springStream = buildPaperWater(makeCardstockMat, {
    width: 12.2,
    depth: 0.72,
    waveRows: 3,
    waveHeight: 0.16,
    scallopAmp: 0.11,
    color: PAPER_PALETTE.jadeMint,
    crestColor: PAPER_PALETTE.origamiCream,
    foamColor: PAPER_PALETTE.origamiWhite,
    y: pageY,
    z: 0.55,
  });
  bookBase.addLayer(0, springStream);

  const springLotus = createOrigamiLotus(makeCardstockMat, {
    petals: 8,
    layers: 3,
    radius: 1.65,
    height: 1.18,
    outerColor: PAPER_PALETTE.origamiRose,
    midColor: PAPER_PALETTE.origamiPink,
    innerColor: PAPER_PALETTE.origamiWhite,
    coreColor: PAPER_PALETTE.foilGold,
    padColor: PAPER_PALETTE.bambooGreen,
    padRadius: 1.98,
  });
  springLotus.position.set(0.0, pageY + 0.24, 0.85);
  bookBase.addLayer(0, springLotus);

  // =========================================================================
  // SPREAD 1 (Scenes 3 & 4 · `7.4s – 14.8s`):
  //   《星夜镂空月与折纸扁舟 · Starlight Kirigami Moon & Origami Boat》
  //   Parted twilight cloud/mountain flanks frame the glowing Kirigami Moon Arch
  //   down to the water level (`x in [-2.6, +2.6]` completely open), with the white
  //   Origami Paper Boat sailing unobstructed in the foreground:
  //     Layer 1: z = -2.85 (Flanked Left & Right Twilight-Plum Cloud Cards at x = ±4.55)
  //     Layer 2: z = -1.50 (Sculptural Kirigami Crescent Moon & Gold-Foil Star Arch)
  //     Layer 3: z = +1.15 (Low Starlight Wave Strips)
  //     Layer 4: z = +1.35 (Elevated White Origami Paper Boat & Golden Sail)
  // =========================================================================

  const nightCloudLeft = createKirigamiCard(makeCardstockMat, {
    width: 3.7,
    baseHeight: 1.05,
    peaks: [
      [-0.35, 1.12, 1.35],
      [0.75, 0.55, 1.05],
    ],
    seed: 43,
    rough: 0.12,
    mode: 'cloud',
    cutouts: [],
    color: PAPER_PALETTE.twilightPlum,
    x: -4.55,
    y: pageY,
    z: -2.85,
  });
  const nightPineL = createPaperPineTree(makeCardstockMat, 0.88, PAPER_PALETTE.deepIndigo);
  nightPineL.position.set(-0.85, 0.0, 0.22);
  nightCloudLeft.foldPivot.add(nightPineL);
  bookBase.addLayer(1, nightCloudLeft);

  const nightCloudRight = createKirigamiCard(makeCardstockMat, {
    width: 3.7,
    baseHeight: 1.05,
    peaks: [
      [-0.75, 0.55, 1.05],
      [0.35, 1.12, 1.35],
    ],
    seed: 57,
    rough: 0.12,
    mode: 'cloud',
    cutouts: [],
    color: PAPER_PALETTE.twilightPlum,
    x: 4.55,
    y: pageY,
    z: -2.85,
  });
  const nightPineR = createPaperPineTree(makeCardstockMat, 0.88, PAPER_PALETTE.deepIndigo);
  nightPineR.position.set(0.85, 0.0, 0.22);
  nightCloudRight.foldPivot.add(nightPineR);
  bookBase.addLayer(1, nightCloudRight);

  const moonArch = createKirigamiMoonArch(makeCardstockMat, {
    outerR: 2.85,
    innerR: 1.92,
    thickness: 0.11,
    archColor: PAPER_PALETTE.pageWarm,
    moonColor: PAPER_PALETTE.lanternGold,
    foilColor: PAPER_PALETTE.foilGold,
    accentColor: PAPER_PALETTE.celadonTeal,
    skyColor: PAPER_PALETTE.deepIndigo,
    y: pageY,
    z: -1.5,
  });
  bookBase.addLayer(1, moonArch);

  const nightStream = buildPaperWater(makeCardstockMat, {
    width: 12.2,
    depth: 0.72,
    waveRows: 3,
    waveHeight: 0.15,
    scallopAmp: 0.1,
    color: PAPER_PALETTE.jadeBlue,
    crestColor: PAPER_PALETTE.celadonTeal,
    foamColor: PAPER_PALETTE.lanternGold,
    y: pageY,
    z: 1.15,
  });
  bookBase.addLayer(1, nightStream);

  const starlightBoat = createPaperBoat(makeCardstockMat, {
    scale: 1.85,
    color: PAPER_PALETTE.origamiWhite,
    sailColor: PAPER_PALETTE.lanternGold,
    withStar: true,
  });
  starlightBoat.position.set(0.0, pageY + 0.32, 1.35);
  bookBase.addLayer(1, starlightBoat);

  // -------------------------------------------------------------------------
  // 2. Shared Aerial Crease-Folded Origami Fauna (2 Cranes + 3 Butterflies)
  // -------------------------------------------------------------------------
  const cranePair = new THREE.Group();
  scene.add(cranePair);

  const craneWhite = createOrigamiCrane(makeCardstockMat, { colorScheme: 'white' });
  craneWhite.scale.setScalar(0.54);
  cranePair.add(craneWhite);

  const cranePink = createOrigamiCrane(makeCardstockMat, { colorScheme: 'pink' });
  cranePink.scale.setScalar(0.44);
  cranePink.position.set(-1.35, 0.32, -0.38);
  cranePair.add(cranePink);

  const butterflyTrio = new THREE.Group();
  scene.add(butterflyTrio);

  const bflyGold = createOrigamiButterfly(makeCardstockMat, {
    color: PAPER_PALETTE.foilGold,
    accentColor: PAPER_PALETTE.ridgeCoral,
    span: 0.72,
  });
  bflyGold.position.set(0.0, 0.0, 0.0);
  butterflyTrio.add(bflyGold);

  const bflyPink = createOrigamiButterfly(makeCardstockMat, {
    color: PAPER_PALETTE.origamiPink,
    accentColor: PAPER_PALETTE.foilGold,
    span: 0.65,
  });
  bflyPink.position.set(-0.65, 0.18, 0.2);
  butterflyTrio.add(bflyPink);

  const bflySky = createOrigamiButterfly(makeCardstockMat, {
    color: PAPER_PALETTE.origamiSky,
    accentColor: PAPER_PALETTE.origamiWhite,
    span: 0.62,
  });
  bflySky.position.set(0.65, 0.24, -0.18);
  butterflyTrio.add(bflySky);

  // -------------------------------------------------------------------------
  // 3. Continuous Tabletop Book-Stage Camera (`studio.bookDirector`)
  //    Shows all 4 edges of the open pop-up book on the wooden table!
  // -------------------------------------------------------------------------
  bookBase.setPageTurn(0.0, 0, 1.0);

  const director = studio.bookDirector({
    basePos: [0.0, 8.8, 18.0],
    baseTarget: [0.0, 1.65, 0.25],

    // Scene 1 (`spring-valley-unfold`, Spread A):
    // Full tabletop book overview as Spread A unfolds, then gently glides closer
    'spring-valley-unfold': {
      move: 'push-pull',
      subject: 'springBookSpread',
      startPos: [0.0, 8.8, 18.0],
      startTarget: [0.0, 1.65, 0.25],
      focusPos: [-0.18, 7.9, 16.2],
      focusTarget: [-0.08, 1.65, 0.25],
      endPos: [-0.18, 7.9, 16.2],
      endTarget: [-0.08, 1.65, 0.25],
      holdStart: 0.2,
      peakStart: 0.62,
      peakEnd: 1.0,
      swayAmp: 0.18,
      storyboardFrac: 0.65,
    },

    // Scene 2 (`origami-lotus-bloom`, Spread A):
    // Gently zooms in on the blooming 3-ring Origami Lotus while keeping the front book edge & ribbon visible,
    // then pulls back to the full tabletop overview (`u = 0.75..0.98`) as Spread A folds flat!
    'origami-lotus-bloom': {
      move: 'push-pull',
      subject: 'origamiLotusSpread',
      startPos: [-0.18, 7.9, 16.2],
      startTarget: [-0.08, 1.65, 0.25],
      focusPos: [0.1, 7.4, 15.0],
      focusTarget: [0.0, 1.62, 0.28],
      endPos: [0.0, 9.0, 18.2],
      endTarget: [0.0, 1.68, 0.2],
      holdStart: 0.0,
      peakStart: 0.42,
      peakEnd: 0.75,
      pullEnd: 0.98,
      swayAmp: 0.16,
      storyboardFrac: 0.58,
    },

    // Scene 3 (`page-turn-moon-arch`, Spread A -> Spread B 180° Page Turn):
    // Holds the full tabletop book overview (`u = 0.00..0.34`) while the right-hand book page
    // curls 180° across the spine and Spread B pops up, then glides toward the Kirigami Moon Arch!
    'page-turn-moon-arch': {
      move: 'push-pull',
      subject: 'kirigamiMoonSpread',
      startPos: [0.0, 9.0, 18.2],
      startTarget: [0.0, 1.68, 0.2],
      focusPos: [0.15, 7.8, 16.0],
      focusTarget: [0.0, 1.8, 0.18],
      endPos: [0.15, 7.8, 16.0],
      endTarget: [0.0, 1.8, 0.18],
      holdStart: 0.34,
      peakStart: 0.62,
      peakEnd: 1.0,
      swayAmp: 0.18,
      storyboardFrac: 0.66,
    },

    // Scene 4 (`starlight-boat-finale`, Spread B):
    // Gently glides in toward the glowing Kirigami Crescent Moon Arch & sailing Origami Boat,
    // keeping both the top of the arch and the front edge of the pop-up book cleanly framed!
    'starlight-boat-finale': {
      move: 'push-pull',
      subject: 'starlightBoatSpread',
      startPos: [0.15, 7.8, 16.0],
      startTarget: [0.0, 1.8, 0.18],
      focusPos: [-0.12, 7.4, 15.1],
      focusTarget: [0.0, 1.8, 0.18],
      endPos: [0.0, 8.0, 16.5],
      endTarget: [0.0, 1.78, 0.2],
      holdStart: 0.0,
      peakStart: 0.45,
      peakEnd: 0.76,
      pullEnd: 0.98,
      swayAmp: 0.16,
      storyboardFrac: 0.58,
    },
  });

  // -------------------------------------------------------------------------
  // 4. Deterministic Frame Choreography (1 Mid-Film Page Turn + Non-Penetrating Folds)
  // -------------------------------------------------------------------------
  function updateWorld(frame) {
    const t = frame.t ?? 0;
    const localT = frame.localT ?? 0;
    const sIdx = frame.sceneIndex ?? 0;

    const wWhite = evalOrigamiWingFlap(t, 5.0, 0.0);
    const wPink = evalOrigamiWingFlap(t, 5.0, 1.4);
    craneWhite.setWingFlap(wWhite.flap, wWhite.neckNod);
    cranePink.setWingFlap(wPink.flap, wPink.neckNod);

    bflyGold.setFlap(Math.sin(t * 9.0));
    bflyPink.setFlap(Math.sin(t * 9.0 + 1.5));
    bflySky.setFlap(Math.sin(t * 9.0 + 3.0));

    if (sIdx === 0) {
      const unfoldU = smootherstep(0.0, 1.55, localT);
      bookBase.setPageTurn(0.0, 0, Math.max(0.08, unfoldU));
      springLotus.setBloom(lerp(0.22, 0.52, unfoldU));
      springLotus.rotation.y = t * 0.22;
      springStream.update(t);

      const cProg = flowStep(0.0, 3.6, localT, 0.2);
      cranePair.visible = true;
      cranePair.position.set(lerp(-2.5, 2.2, cProg), 4.38 + wWhite.hoverY, -0.55);
      cranePair.rotation.set(0.04, -0.18, 0.05);

      butterflyTrio.visible = localT > 0.35;
      butterflyTrio.position.set(
        Math.sin(t * 1.4) * 0.55,
        2.15 + Math.cos(t * 2.0) * 0.12,
        0.85
      );
      butterflyTrio.rotation.y = t * 0.65;
    } else if (sIdx === 1) {
      const bloomU = lerp(0.52, 1.0, smootherstep(0.0, 1.65, localT));
      springLotus.setBloom(bloomU);
      springLotus.rotation.y = t * 0.25;
      springStream.update(t);

      const preTurnClose = smootherstep(2.82, 3.76, localT);
      const spread0Fold = 1.0 - 0.98 * preTurnClose;
      bookBase.setPageTurn(0.0, 0, spread0Fold);

      const riseU = smootherstep(0.1, 2.5, localT);
      butterflyTrio.visible = true;
      butterflyTrio.position.set(
        Math.sin(t * 1.6) * 0.65,
        lerp(2.1, 3.15, riseU) + preTurnClose * 0.9,
        0.82
      );
      butterflyTrio.rotation.y = t * 0.85;

      const cProg = flowStep(0.0, 3.8, localT, 0.2);
      cranePair.visible = true;
      cranePair.position.set(lerp(2.1, -2.2, cProg), 4.42 + wWhite.hoverY + preTurnClose * 0.5, -0.65);
      cranePair.rotation.set(0.04, Math.PI + 0.18, -0.05);
    } else if (sIdx === 2) {
      const turnU = clamp(localT / 1.85, 0, 1);
      bookBase.setPageTurn(turnU, 0, 0.02, 1);

      const glowU = smootherstep(0.75, 2.4, localT);
      moonArch.update(t, glowU * 0.78);
      nightStream.update(t);

      const boatU = flowStep(0.85, 3.8, localT, 0.2);
      starlightBoat.position.set(
        lerp(-1.45, -0.15, boatU),
        pageY + 0.32 + Math.sin(t * 2.4) * 0.03,
        1.35
      );
      starlightBoat.rotation.z = Math.sin(t * 2.2) * 0.04;

      const enterU = smootherstep(0.65, 1.8, localT);
      cranePair.visible = enterU > 0.05;
      cranePair.position.set(
        lerp(-3.95, -3.15, boatU),
        lerp(4.9, 4.45, enterU) + wWhite.hoverY,
        -0.45
      );
      cranePair.rotation.set(0.04, -0.15, 0.05);

      butterflyTrio.visible = enterU > 0.05;
      butterflyTrio.position.set(
        2.35 + Math.sin(t * 1.5) * 0.28,
        lerp(4.2, 2.85, enterU) + Math.cos(t * 2.2) * 0.12,
        0.65
      );
      butterflyTrio.rotation.y = t * 0.75;
    } else {
      bookBase.setPageTurn(0.0, 1, 1.0);
      moonArch.update(t, 1.0);
      nightStream.update(t);

      const sailU = flowStep(0.0, 3.6, localT, 0.22);
      starlightBoat.position.set(
        lerp(-0.15, 1.35, sailU),
        pageY + 0.32 + Math.sin(t * 2.4) * 0.03,
        1.35
      );
      starlightBoat.rotation.z = Math.sin(t * 2.2) * 0.04;

      cranePair.visible = true;
      cranePair.position.set(
        lerp(3.65, 4.35, sailU),
        4.45 + wWhite.hoverY,
        -0.45
      );
      cranePair.rotation.set(0.04, -0.15, 0.05);

      butterflyTrio.visible = true;
      butterflyTrio.position.set(
        -2.35 + Math.sin(t * 1.4) * 0.28,
        2.75 + Math.cos(t * 2.0) * 0.14,
        0.65
      );
      butterflyTrio.rotation.y = t * 0.75;
    }
  }

  return {
    canvas: studio.canvas,
    storyboard: director.storyboard,
    async render(frame) {
      updateWorld(frame);
      director.update(frame);
      studio.render(frame);
    },
  };
}

export default createWorld;
