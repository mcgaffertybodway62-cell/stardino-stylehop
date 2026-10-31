/**
 * Paper Pop-Up Book · Default Showcase Story (`styles/paper-popup/world.js`):
 *   《春涧折莲与星夜镂空月：桌上的立体书》 (Spring Origami Lotus & Starlight Kirigami Moon)
 *
 * Built 100% from rule-based generative primitives in `./kernel.js` (`paperProfileFn`,
 * `createKirigamiCard`, `createOrigamiLotus`, `createKirigamiMoonArch`,
 * `createPopUpBookBase`, `buildPaperWater`, `buildPaperPath`, `createOrigamiFox`,
 * `createOrigamiCrane`, `createOrigamiButterfly`, `createPaperBoat`, `createPaperPineTree`,
 * `evalContinuousHopChain`, `evalTargetedJump`), following the 3 core laws of the Tabletop Pop-Up Book Theater:
 *   1. Clearly visible 3D hardcover pop-up book lying flat on the studio tabletop (`>= 45%` negative space
 *      on wide establishing & page-turn shots, alternating with medium-close macro push-ins during peak action).
 *   2. Strict per-spread isolation: every mountain, lotus, moon arch, fox, boat, crane, and butterfly belongs
 *      to its physical spread (`spread 0` or `spread 1`) and hinges flat (`rotation.x`) when the page turns.
 *   3. Authentic 3-phase hop/jump physics (`evalContinuousHopChain` & `evalTargetedJump`) with anticipation crouch,
 *      airborne stretch/pitch, and landing cushion on the articulated 4-legged Origami Fox.
 */

import {
  THREE,
  PAPER_PALETTE,
  clamp,
  lerp,
  smootherstep,
  flowStep,
  evalOrigamiWingFlap,
  evalContinuousHopChain,
  evalTargetedJump,
  createPopUpBookBase,
  createKirigamiCard,
  createOrigamiLotus,
  createKirigamiMoonArch,
  createOrigamiArchBridge,
  createHangingPaperLanterns,
  createBacklitSunWheel,
  createPaperEmotionPop,
  buildPaperWater,
  buildPaperPath,
  createOrigamiFox,
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
  //   《春涧折纸莲与跃涧折纸狐 · Spring Kirigami Valley, Origami Fox & Blooming Lotus》
  // =========================================================================

  const springSunWheel = createBacklitSunWheel(makeCardstockMat, {
    radius: 1.55,
    rings: 3,
    rays: 12,
    centerY: 2.55,
    color: PAPER_PALETTE.sunGold,
    innerColor: PAPER_PALETTE.origamiCream,
    foilColor: PAPER_PALETTE.foilGold,
    x: 0.0,
    y: pageY,
    z: -3.45,
  });
  bookBase.addLayer(0, springSunWheel);

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
    color: PAPER_PALETTE.bambooGreen,
    x: -3.85,
    y: pageY,
    z: -1.2,
  });
  const pineL1 = createPaperPineTree(makeCardstockMat, 0.92, PAPER_PALETTE.celadonTeal);
  pineL1.position.set(-1.35, 0.0, 0.18);
  springValleyLeft.foldPivot.add(pineL1);
  const pineL2 = createPaperPineTree(makeCardstockMat, 0.72, PAPER_PALETTE.jadeBlue);
  pineL2.position.set(1.15, 0.0, 0.22);
  springValleyLeft.foldPivot.add(pineL2);
  bookBase.addLayer(0, springValleyLeft);

  // Cool Jade-Blue right valley wing so the Vermilion Origami Fox has maximum warm-cool contrast
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
    color: PAPER_PALETTE.jadeBlue,
    x: 3.85,
    y: pageY,
    z: -1.2,
  });
  const pineR1 = createPaperPineTree(makeCardstockMat, 0.95, PAPER_PALETTE.bambooGreen);
  pineR1.position.set(1.35, 0.0, 0.18);
  springValleyRight.foldPivot.add(pineR1);
  const pineR2 = createPaperPineTree(makeCardstockMat, 0.74, PAPER_PALETTE.celadonTeal);
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

  const springArchBridge = createOrigamiArchBridge(makeCardstockMat, {
    span: 2.25,
    archHeight: 0.62,
    width: 0.78,
    steps: 9,
    color: PAPER_PALETTE.lanternGold,
    stepColor: PAPER_PALETTE.deckleCream,
    railColor: PAPER_PALETTE.jadeBlue,
    x: 2.55,
    y: pageY,
    z: 0.55,
  });
  bookBase.addLayer(0, springArchBridge);

  const springPath = buildPaperPath(makeCardstockMat, {
    path: [
      [-4.6, 1.55],
      [-3.1, 1.42],
      [-1.85, 1.28],
    ],
    width: 0.68,
    color: PAPER_PALETTE.deckleCream,
    altColor: PAPER_PALETTE.lanternGold,
    y: pageY,
  });
  bookBase.addLayer(0, springPath);

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
  springLotus.position.set(0.25, pageY + 0.24, 0.85);
  bookBase.addLayer(0, springLotus);

  // Foreground Pop-Up Corner Cards on Spread 0 (`z = +2.65, x = ±4.75`) to frame lower book corners
  const springFrontCornerLeft = createKirigamiCard(makeCardstockMat, {
    width: 2.55,
    baseHeight: 0.52,
    peaks: [
      [-0.55, 0.48, 0.85],
      [0.45, 0.28, 0.72],
    ],
    seed: 61,
    rough: 0.08,
    mode: 'mountain',
    cutouts: [{ x: -0.35, y: 0.12, w: 0.32, h: 0.32, kind: 'diamond' }],
    color: PAPER_PALETTE.bambooGreen,
    x: -4.75,
    y: pageY,
    z: 2.65,
  });
  const cornerPine0L = createPaperPineTree(makeCardstockMat, 0.62, PAPER_PALETTE.celadonTeal);
  cornerPine0L.position.set(-0.65, 0.0, 0.14);
  springFrontCornerLeft.foldPivot.add(cornerPine0L);
  bookBase.addLayer(0, springFrontCornerLeft);

  const springFrontCornerRight = createKirigamiCard(makeCardstockMat, {
    width: 2.55,
    baseHeight: 0.52,
    peaks: [
      [-0.45, 0.28, 0.72],
      [0.55, 0.48, 0.85],
    ],
    seed: 67,
    rough: 0.08,
    mode: 'mountain',
    cutouts: [{ x: 0.35, y: 0.12, w: 0.32, h: 0.32, kind: 'diamond' }],
    color: PAPER_PALETTE.celadonTeal,
    x: 4.75,
    y: pageY,
    z: 2.65,
  });
  const cornerPine0R = createPaperPineTree(makeCardstockMat, 0.62, PAPER_PALETTE.bambooGreen);
  cornerPine0R.position.set(0.65, 0.0, 0.14);
  springFrontCornerRight.foldPivot.add(cornerPine0R);
  bookBase.addLayer(0, springFrontCornerRight);

  // High-Contrast Vermilion Articulated 4-legged Origami Fox on Spread 0 (`#D94432`)
  const springFox = createOrigamiFox(makeCardstockMat, {
    color: PAPER_PALETTE.foxVermilion,
    shadeColor: PAPER_PALETTE.foxCrimsonShade,
    chestColor: PAPER_PALETTE.origamiWhite,
    tailTipColor: PAPER_PALETTE.origamiWhite,
    scale: 1.38,
  });
  springFox.position.set(-4.5, pageY + 0.06, 1.52);
  const springEmotionPop = createPaperEmotionPop(makeCardstockMat, {
    symbol: '!',
    color: PAPER_PALETTE.foxVermilion,
    foilColor: PAPER_PALETTE.foilGold,
    scale: 0.86,
  });
  springEmotionPop.position.set(0.34, 1.02, 0);
  springFox.foldPivot.add(springEmotionPop);
  bookBase.addLayer(0, springFox);

  // Spread 0 isolated aerial fauna (folds flat with Spread 0!)
  const springCranes = new THREE.Group();
  const craneWhite0 = createOrigamiCrane(makeCardstockMat, { colorScheme: 'white' });
  craneWhite0.scale.setScalar(0.52);
  springCranes.add(craneWhite0);
  const cranePink0 = createOrigamiCrane(makeCardstockMat, { colorScheme: 'pink' });
  cranePink0.scale.setScalar(0.42);
  cranePink0.position.set(-1.25, 0.28, -0.35);
  springCranes.add(cranePink0);
  bookBase.addLayer(0, springCranes);

  const springButterflies = new THREE.Group();
  const bflyGold0 = createOrigamiButterfly(makeCardstockMat, {
    color: PAPER_PALETTE.foilGold,
    accentColor: PAPER_PALETTE.ridgeCoral,
    span: 0.7,
  });
  const bflyPink0 = createOrigamiButterfly(makeCardstockMat, {
    color: PAPER_PALETTE.origamiPink,
    accentColor: PAPER_PALETTE.foilGold,
    span: 0.62,
  });
  bflyPink0.position.set(-0.6, 0.18, 0.2);
  const bflySky0 = createOrigamiButterfly(makeCardstockMat, {
    color: PAPER_PALETTE.origamiSky,
    accentColor: PAPER_PALETTE.origamiWhite,
    span: 0.6,
  });
  bflySky0.position.set(0.6, 0.22, -0.18);
  springButterflies.add(bflyGold0, bflyPink0, bflySky0);
  bookBase.addLayer(0, springButterflies);

  // =========================================================================
  // SPREAD 1 (Scenes 3 & 4 · `7.4s – 14.8s`):
  //   《星夜镂空月与折纸扁舟 · Starlight Kirigami Moon, Origami Fox & Boat》
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

  const nightHangingLanterns = createHangingPaperLanterns(makeCardstockMat, {
    span: 8.8,
    height: 3.45,
    sag: 0.56,
    count: 5,
    x: 0.0,
    y: pageY,
    z: -1.95,
  });
  bookBase.addLayer(1, nightHangingLanterns);

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

  // Foreground Pop-Up Corner Cards on Spread 1 (`z = +2.65, x = ±4.75`)
  const nightFrontCornerLeft = createKirigamiCard(makeCardstockMat, {
    width: 2.55,
    baseHeight: 0.52,
    peaks: [
      [-0.55, 0.48, 0.85],
      [0.45, 0.28, 0.72],
    ],
    seed: 73,
    rough: 0.08,
    mode: 'cloud',
    cutouts: [{ x: -0.35, y: 0.12, w: 0.32, h: 0.32, kind: 'diamond' }],
    color: PAPER_PALETTE.jadeBlue,
    x: -4.75,
    y: pageY,
    z: 2.65,
  });
  const cornerPine1L = createPaperPineTree(makeCardstockMat, 0.62, PAPER_PALETTE.celadonTeal);
  cornerPine1L.position.set(-0.65, 0.0, 0.14);
  nightFrontCornerLeft.foldPivot.add(cornerPine1L);
  bookBase.addLayer(1, nightFrontCornerLeft);

  const nightFrontCornerRight = createKirigamiCard(makeCardstockMat, {
    width: 2.55,
    baseHeight: 0.52,
    peaks: [
      [-0.45, 0.28, 0.72],
      [0.55, 0.48, 0.85],
    ],
    seed: 79,
    rough: 0.08,
    mode: 'cloud',
    cutouts: [{ x: 0.35, y: 0.12, w: 0.32, h: 0.32, kind: 'diamond' }],
    color: PAPER_PALETTE.mulberryViolet,
    x: 4.75,
    y: pageY,
    z: 2.65,
  });
  const cornerPine1R = createPaperPineTree(makeCardstockMat, 0.62, PAPER_PALETTE.deepIndigo);
  cornerPine1R.position.set(0.65, 0.0, 0.14);
  nightFrontCornerRight.foldPivot.add(cornerPine1R);
  bookBase.addLayer(1, nightFrontCornerRight);

  // High-Contrast Vermilion Articulated 4-legged Origami Fox on Spread 1 (`#D94432`)
  const nightFox = createOrigamiFox(makeCardstockMat, {
    color: PAPER_PALETTE.foxVermilion,
    shadeColor: PAPER_PALETTE.foxCrimsonShade,
    chestColor: PAPER_PALETTE.origamiWhite,
    tailTipColor: PAPER_PALETTE.origamiWhite,
    scale: 1.36,
  });
  nightFox.position.set(-3.4, pageY + 0.06, 1.68);
  const nightEmotionPop = createPaperEmotionPop(makeCardstockMat, {
    symbol: '♥',
    color: PAPER_PALETTE.origamiRose,
    foilColor: PAPER_PALETTE.foilGold,
    scale: 0.85,
  });
  nightEmotionPop.position.set(0.32, 0.96, 0);
  nightFox.foldPivot.add(nightEmotionPop);
  bookBase.addLayer(1, nightFox);

  // Spread 1 isolated aerial fauna (pops up with Spread 1!)
  const nightCranes = new THREE.Group();
  const craneGold1 = createOrigamiCrane(makeCardstockMat, { colorScheme: 'gold' });
  craneGold1.scale.setScalar(0.52);
  nightCranes.add(craneGold1);
  const craneBlue1 = createOrigamiCrane(makeCardstockMat, { colorScheme: 'blue' });
  craneBlue1.scale.setScalar(0.44);
  craneBlue1.position.set(-1.3, 0.3, -0.36);
  nightCranes.add(craneBlue1);
  bookBase.addLayer(1, nightCranes);

  const nightButterflies = new THREE.Group();
  const bflyGold1 = createOrigamiButterfly(makeCardstockMat, {
    color: PAPER_PALETTE.foilGold,
    accentColor: PAPER_PALETTE.origamiWhite,
    span: 0.68,
  });
  const bflySky1 = createOrigamiButterfly(makeCardstockMat, {
    color: PAPER_PALETTE.origamiSky,
    accentColor: PAPER_PALETTE.foilGold,
    span: 0.6,
  });
  bflySky1.position.set(-0.58, 0.2, 0.18);
  nightButterflies.add(bflyGold1, bflySky1);
  bookBase.addLayer(1, nightButterflies);

  // -------------------------------------------------------------------------
  // 2. Tabletop Book-Stage Camera with Wide-to-Macro Depth Progression
  // -------------------------------------------------------------------------
  bookBase.setPageTurn(0.0, 0, 1.0);

  const director = studio.bookDirector({
    basePos: [0.0, 6.4, 16.6],
    baseTarget: [0.0, 1.35, 0.25],

    // Scene 1 (`spring-valley-unfold`, Spread 0):
    // Starts with tabletop book overview as Spread 0 hinges upright, then glides in toward the hopping Origami Fox & Lotus
    'spring-valley-unfold': {
      move: 'push-pull',
      subject: 'springBookSpread',
      startPos: [0.0, 6.4, 16.6],
      startTarget: [0.0, 1.35, 0.25],
      focusPos: [-0.20, 5.45, 12.8],
      focusTarget: [-0.25, 1.15, 0.55],
      endPos: [-0.20, 5.45, 12.8],
      endTarget: [-0.25, 1.15, 0.55],
      holdStart: 0.18,
      peakStart: 0.62,
      peakEnd: 1.0,
      swayAmp: 0.14,
      storyboardFrac: 0.68,
    },

    // Scene 2 (`origami-lotus-bloom`, Spread 0 True Macro Close-Up -> Pre-Turn Wide Pull-Back):
    // Pushes into a true medium-close macro view (`y = 2.85, z = 7.15`) of the Vermilion Origami Fox (`!`),
    // curious head-tilt interaction & blooming 3-ring Origami Lotus, then pulls back (`z = 16.8`) as Spread 0 folds flat!
    'origami-lotus-bloom': {
      move: 'push-pull',
      subject: 'origamiLotusMacro',
      startPos: [-0.20, 5.45, 12.8],
      startTarget: [-0.25, 1.15, 0.55],
      focusPos: [-0.35, 2.85, 7.15],
      focusTarget: [-0.35, 1.25, 0.96],
      endPos: [0.0, 6.6, 16.8],
      endTarget: [0.0, 1.35, 0.2],
      holdStart: 0.0,
      peakStart: 0.32,
      peakEnd: 0.72,
      pullEnd: 0.98,
      swayAmp: 0.10,
      storyboardFrac: 0.58,
    },

    // Scene 3 (`page-turn-moon-arch`, Spread 0 -> Spread 1 180° Page Turn):
    // Holds the wide tabletop overview (`u = 0.00..0.34`) while the book page curls 180° across the spine
    // and Spread 1 hinges upright, then glides closer toward the Kirigami Moon Arch & Origami Boat!
    'page-turn-moon-arch': {
      move: 'push-pull',
      subject: 'kirigamiMoonSpread',
      startPos: [0.0, 6.6, 16.8],
      startTarget: [0.0, 1.35, 0.2],
      focusPos: [0.08, 5.55, 13.0],
      focusTarget: [-0.08, 1.25, 0.45],
      endPos: [0.08, 5.55, 13.0],
      endTarget: [-0.08, 1.25, 0.45],
      holdStart: 0.32,
      peakStart: 0.64,
      peakEnd: 1.0,
      swayAmp: 0.14,
      storyboardFrac: 0.68,
    },

    // Scene 4 (`starlight-boat-finale`, Spread 1 True Macro Finale):
    // Pushes into a true medium-close macro view (`y = 2.95, z = 7.35`) as the Vermilion Origami Fox leaps aboard
    // the glowing Paper Boat (`♥` emotion pop + joyful nod) sailing beneath the Kirigami Crescent Moon Arch!
    'starlight-boat-finale': {
      move: 'push-pull',
      subject: 'starlightBoatMacro',
      startPos: [0.08, 5.55, 13.0],
      startTarget: [-0.08, 1.25, 0.45],
      focusPos: [0.22, 2.95, 7.35],
      focusTarget: [0.28, 1.32, 1.15],
      endPos: [0.0, 5.6, 13.8],
      endTarget: [0.0, 1.35, 0.35],
      holdStart: 0.0,
      peakStart: 0.36,
      peakEnd: 0.78,
      pullEnd: 0.98,
      swayAmp: 0.10,
      storyboardFrac: 0.64,
    },
  });

  // -------------------------------------------------------------------------
  // 3. Deterministic Frame Choreography (3-Phase Hop Physics & Crease-Hinge Folds)
  // -------------------------------------------------------------------------
  const foxJumpStartS2 = new THREE.Vector3(-1.85, pageY + 0.06, 1.28);
  const foxJumpEndS2 = new THREE.Vector3(-1.08, pageY + 0.14, 1.08);
  const foxJumpStartS4 = new THREE.Vector3(-1.35, pageY + 0.06, 1.55);

  function updateWorld(frame) {
    const t = frame.t ?? 0;
    const localT = frame.localT ?? 0;
    const sIdx = frame.sceneIndex ?? 0;

    const wA = evalOrigamiWingFlap(t, 5.0, 0.0);
    const wB = evalOrigamiWingFlap(t, 5.0, 1.4);
    craneWhite0.setWingFlap(wA.flap, wA.neckNod);
    cranePink0.setWingFlap(wB.flap, wB.neckNod);
    craneGold1.setWingFlap(wA.flap, wA.neckNod);
    craneBlue1.setWingFlap(wB.flap, wB.neckNod);

    bflyGold0.setFlap(Math.sin(t * 9.0));
    bflyPink0.setFlap(Math.sin(t * 9.0 + 1.5));
    bflySky0.setFlap(Math.sin(t * 9.0 + 3.0));
    bflyGold1.setFlap(Math.sin(t * 9.0 + 0.8));
    bflySky1.setFlap(Math.sin(t * 9.0 + 2.2));

    springSunWheel.update(t);
    nightHangingLanterns.update(t);

    if (sIdx === 0) {
      // Spread 0 hinges upright from the book page (0..1.45s) while Fox hops across the stepping stones (0.8..3.4s)
      const unfoldU = smootherstep(0.0, 1.45, localT);
      bookBase.setPageTurn(0.0, 0, Math.max(0.08, unfoldU));
      springLotus.setBloom(lerp(0.22, 0.55, unfoldU));
      springLotus.rotation.y = t * 0.22;
      springStream.update(t);
      springEmotionPop.setPop(0, t);

      const hopU = clamp((localT - 0.65) / 2.75, 0, 1);
      const hop = evalContinuousHopChain(hopU, 3, 0.52);
      springFox.position.set(
        lerp(-4.6, -1.85, hop.progressX),
        pageY + 0.06 + hop.y,
        lerp(1.55, 1.28, hop.progressX)
      );
      springFox.setPose({
        squashY: hop.squashY,
        pitch: hop.pitch,
        yaw: -0.12,
        stridePhase: hopU > 0 && hopU < 1 ? hop.local * Math.PI * 2 : 0,
        tailWag: Math.sin(t * 6.0) * 0.22,
      });

      const cProg = flowStep(0.0, 3.6, localT, 0.2);
      springCranes.position.set(lerp(-2.6, 2.1, cProg), 4.15 + wA.hoverY, -0.55);
      springCranes.rotation.set(0.04, -0.18, 0.05);

      springButterflies.position.set(
        0.25 + Math.sin(t * 1.4) * 0.55,
        2.05 + Math.cos(t * 2.0) * 0.12,
        0.85
      );
      springButterflies.rotation.y = t * 0.65;
    } else if (sIdx === 1) {
      // Scene 2: Lotus blooms to 100%, Fox does a 3-phase targeted jump onto the lotus bank,
      // tilts its head curiously (`act('curious')`) & pops up 3D `'!'` emotion badge (`springEmotionPop`),
      // then at t=2.82..3.76s Spread 0 hinges flat onto the book page in preparation for the page turn!
      const bloomU = lerp(0.55, 1.0, smootherstep(0.0, 1.65, localT));
      springLotus.setBloom(bloomU);
      springLotus.rotation.y = t * 0.25;
      springStream.update(t);

      const jumpU = clamp((localT - 0.18) / 1.25, 0, 1);
      const jmp = evalTargetedJump(jumpU, foxJumpStartS2, foxJumpEndS2, 0.68);
      springFox.position.copy(jmp.pos);
      if (jumpU < 1.0) {
        springFox.setPose({
          squashY: jmp.squashY,
          pitch: jmp.pitch,
          yaw: -0.18,
          tailWag: Math.sin(t * 7.5) * 0.32,
        });
        springEmotionPop.setPop(0, t);
      } else {
        springFox.act(localT - 1.43, { mode: 'curious' });
        const popU = smootherstep(1.45, 1.85, localT) * (1.0 - smootherstep(2.68, 2.95, localT));
        springEmotionPop.setPop(popU, t);
      }

      const riseU = smootherstep(0.1, 2.5, localT);
      springButterflies.position.set(
        0.25 + Math.sin(t * 1.6) * 0.65,
        lerp(2.05, 3.05, riseU),
        0.82
      );
      springButterflies.rotation.y = t * 0.85;

      const cProg = flowStep(0.0, 3.8, localT, 0.2);
      springCranes.position.set(lerp(2.1, -2.2, cProg), 4.2 + wA.hoverY, -0.65);
      springCranes.rotation.set(0.04, Math.PI + 0.18, -0.05);

      const preTurnClose = smootherstep(2.82, 3.76, localT);
      const spread0Fold = 1.0 - 0.98 * preTurnClose;
      bookBase.setPageTurn(0.0, 0, spread0Fold);
    } else if (sIdx === 2) {
      // Scene 3: 180° curving page turn (`0..1.80s`) unfolds Spread 1, Kirigami Moon Arch glows,
      // Origami Boat glides in from the left, and Fox hops along the foreground bank!
      const turnU = clamp(localT / 1.8, 0, 1);
      bookBase.setPageTurn(turnU, 0, 0.02, 1);
      nightEmotionPop.setPop(0, t);

      const glowU = smootherstep(0.75, 2.4, localT);
      moonArch.update(t, glowU * 0.82);
      nightStream.update(t);

      const boatU = flowStep(0.8, 3.8, localT, 0.2);
      starlightBoat.position.set(
        lerp(-1.65, -0.25, boatU),
        pageY + 0.32 + Math.sin(t * 2.4) * 0.03,
        1.35
      );
      starlightBoat.rotation.z = Math.sin(t * 2.2) * 0.04;

      const foxHopU = clamp((localT - 0.95) / 2.65, 0, 1);
      const foxHop = evalContinuousHopChain(foxHopU, 3, 0.46);
      nightFox.position.set(
        lerp(-3.5, -1.35, foxHop.progressX),
        pageY + 0.06 + foxHop.y,
        lerp(1.68, 1.55, foxHop.progressX)
      );
      nightFox.setPose({
        squashY: foxHop.squashY,
        pitch: foxHop.pitch,
        yaw: -0.1,
        stridePhase: foxHopU > 0 && foxHopU < 1 ? foxHop.local * Math.PI * 2 : 0,
        tailWag: Math.sin(t * 6.2) * 0.25,
      });

      const enterU = smootherstep(0.65, 1.8, localT);
      nightCranes.position.set(
        lerp(-3.6, -1.8, boatU),
        lerp(4.7, 4.15, enterU) + wA.hoverY,
        -0.45
      );
      nightCranes.rotation.set(0.04, -0.15, 0.05);

      nightButterflies.position.set(
        2.1 + Math.sin(t * 1.5) * 0.28,
        lerp(3.8, 2.65, enterU) + Math.cos(t * 2.2) * 0.12,
        0.65
      );
      nightButterflies.rotation.y = t * 0.75;
    } else {
      // Scene 4: Fox performs a 3-phase targeted jump (`0.12s..1.35s`) onto the Origami Boat deck,
      // nods joyfully (`act('joy')`) with its 3D `'♥'` emotion pop badge, and sails beneath the Kirigami Moon Arch!
      bookBase.setPageTurn(0.0, 1, 1.0);
      moonArch.update(t, 1.0);
      nightStream.update(t);

      const sailU = flowStep(0.0, 3.6, localT, 0.22);
      const boatX = lerp(-0.25, 0.95, sailU);
      const boatY = pageY + 0.32 + Math.sin(t * 2.4) * 0.03;
      const boatZ = 1.35;
      starlightBoat.position.set(boatX, boatY, boatZ);
      starlightBoat.rotation.z = Math.sin(t * 2.2) * 0.04;

      const boardU = clamp((localT - 0.12) / 1.25, 0, 1);
      const boatDeckPos = new THREE.Vector3(boatX - 0.36, boatY + 0.06, boatZ + 0.32);
      const boardJump = evalTargetedJump(boardU, foxJumpStartS4, boatDeckPos, 0.76);
      if (boardU < 1.0) {
        nightFox.position.copy(boardJump.pos);
        nightFox.setPose({
          squashY: boardJump.squashY,
          pitch: boardJump.pitch,
          yaw: -0.05,
          tailWag: Math.sin(t * 7.5) * 0.28,
        });
        nightEmotionPop.setPop(0, t);
      } else {
        nightFox.position.copy(boatDeckPos);
        nightFox.act(localT - 1.37, { mode: 'joy' });
        const heartPopU = smootherstep(1.38, 1.82, localT);
        nightEmotionPop.setPop(heartPopU, t);
      }

      nightCranes.position.set(
        lerp(-1.2, 2.4, sailU),
        4.15 + wA.hoverY,
        -0.45
      );
      nightCranes.rotation.set(0.04, -0.15, 0.05);

      nightButterflies.position.set(
        -2.15 + Math.sin(t * 1.4) * 0.28,
        2.55 + Math.cos(t * 2.0) * 0.14,
        0.65
      );
      nightButterflies.rotation.y = t * 0.75;
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
