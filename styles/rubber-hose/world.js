/**
 * 1930s Rubber-Hose Cartoon · Default 4-Scene Showcase Story (`styles/rubber-hose/world.js`).
 *
 * Story: 《午夜百老汇 · 摇摆留声机狂想曲》 (Midnight Broadway · Swing Gramophone Rhapsody)
 *   - Scene 1 (`act1-curtain-up`, `sepia`, 3.6s, `wide`):
 *       01 · 胶片开映 · 百老汇摇摆揭幕 — Wide establishing shot of S-curved 3D piano road,
 *       Jazz Cat & Flapper entering on left, Note Critters on keys, Gramophone cranking on right.
 *   - Scene 2 (`act2-horn-duel`, `vaudeville`, 3.8s, `close`):
 *       02 · 铜管飙音 · 留声机咆哮斗技 — Dramatic low-angle over-the-shoulder close-up (`view: 'back'`,
 *       `scale: 2.15`) of Jazz Cat in left foreground blasting his trumpet diagonally upward against a
 *       towering close-up Giant Gramophone (`scale: 1.68`) spitting airborne Note Critters and shockwaves.
 *   - Scene 3 (`act3-technicolor-keys`, `technicolor`, 3.8s, `medium`):
 *       03 · 琴键踏浪 · 特艺三色彩环绽放 — Frontal medium action shot on a giant central arching piano wave
 *       crest (no Gramophone on right!): frontal Jazz Cat (`view: 'front'`, `scale: 1.56`) stomps a giant
 *       Black Note Critter flat at center crest, unleashing 3-Strip Technicolor rings (`r = 520`), a giant
 *       spinning 78-RPM Vinyl Record (`r = 78`), flanked by Flapper, Contrabass & Saxophone.
 *   - Scene 4 (`act4-vortex-iris`, `talkie`, 3.6s, `full`):
 *       04 · 旋涡华彩 · 经典黑幕圆圈收尾 — Midnight-blue full Broadway ensemble curtain call (Contrabass,
 *       Flapper, Top-Hat Bandleader Jazz Cat, Saxophone) + stunned Gramophone with `X X` dizzy eyes and
 *       swirling Golden Logarithmic Vortex, closing with a classic 1930s circular black Iris-Out.
 *
 * Architectural Rules:
 *   - Imports ONLY `./kernel.js` and `../../engine/motion.js`.
 *   - Zero gallery mascot in code, comments, or visuals.
 *   - Follows 2D Canvas Law (`一幕一构图 · 一场一单向微镜`): shot sizes (`wide -> close -> medium -> full`)
 *     are achieved by re-composing each scene's character/prop scale, placement, and view angle.
 */

import { clamp, lerp, smootherstep } from '../../engine/motion.js';
import {
  RUBBER_PALETTE,
  evalSwingBounce,
  evalHopParabola,
  drawDipPenStroke,
  drawFourPointStar,
  drawComicBurst,
  drawPopIcon,
  drawTechnicolorRing,
  drawTheaterCurtains,
  draw35mmCountdown,
  drawIrisTransition,
  drawElasticKeyboardRoad,
  drawAnthropomorphicGramophone,
  drawAnthropomorphicInstrument,
  drawNoteCritter,
  drawJazzNoteStream,
  drawSpinningVinyl,
  createRubberHoseCharacter,
  createRubberHoseStage,
} from './kernel.js';

export default async function createWorld({ width = 1920, height = 1080, scenes = [], style = {} } = {}) {
  const studio = createRubberHoseStage({
    width,
    height,
    scenes,
    look: style.look,
    looks: style.looks,
    sprockets: true,
  });

  // -------------------------------------------------------------------------
  // Cast of 1930s Rubber-Hose Characters across the 4 scenes
  // -------------------------------------------------------------------------
  // Scene 1 Wide Stage Characters (`view: 'side'`, 0.96x / 0.88x)
  const catWide = createRubberHoseCharacter({
    archetype: 'jazzcat',
    view: 'side',
    x: 470,
    y: 785,
    scale: 0.96,
    facing: 1,
    hat: 'bowler',
    heldProp: 'trumpet',
    pantsColor: RUBBER_PALETTE.paperCream,
    accentColor: RUBBER_PALETTE.tcGold,
  });

  const flapperWide = createRubberHoseCharacter({
    archetype: 'flapper',
    view: 'side',
    x: 295,
    y: 845,
    scale: 0.88,
    facing: 1,
    hat: 'feather',
    heldProp: 'microphone',
    pantsColor: RUBBER_PALETTE.tcCoral,
    accentColor: RUBBER_PALETTE.tcGold,
  });

  // Scene 2 Over-the-Shoulder Close-Up Character (`view: 'back'`, 2.15x foreground close-up!)
  const catCloseBack = createRubberHoseCharacter({
    archetype: 'jazzcat',
    view: 'back',
    x: 425,
    y: 1015,
    scale: 2.15,
    facing: 1,
    hat: 'bowler',
    heldProp: 'trumpet',
    pantsColor: RUBBER_PALETTE.paperCream,
    accentColor: RUBBER_PALETTE.tcGold,
  });

  // Scene 3 Frontal Medium Action Characters on Central Arching Piano Crest (`view: 'front'`, 1.56x / 1.36x)
  const catMediumFront = createRubberHoseCharacter({
    archetype: 'jazzcat',
    view: 'front',
    x: 915,
    y: 655,
    scale: 1.56,
    facing: 1,
    hat: 'bowler',
    heldProp: 'trumpet',
    pantsColor: RUBBER_PALETTE.paperCream,
    accentColor: RUBBER_PALETTE.tcGold,
  });

  const flapperMediumFront = createRubberHoseCharacter({
    archetype: 'flapper',
    view: 'front',
    x: 455,
    y: 765,
    scale: 1.36,
    facing: 1,
    hat: 'feather',
    heldProp: 'none',
    pantsColor: RUBBER_PALETTE.tcCoral,
    accentColor: RUBBER_PALETTE.tcGold,
  });

  // Scene 4 Full Ensemble Finale Characters (`view: 'front'`, 1.18x / 1.06x)
  const catFinale = createRubberHoseCharacter({
    archetype: 'jazzcat',
    view: 'front',
    x: 665,
    y: 695,
    scale: 1.18,
    facing: 1,
    hat: 'topHat',
    heldProp: 'baton',
    pantsColor: RUBBER_PALETTE.paperCream,
    accentColor: RUBBER_PALETTE.tcGold,
  });

  const flapperFinale = createRubberHoseCharacter({
    archetype: 'flapper',
    view: 'front',
    x: 410,
    y: 765,
    scale: 1.06,
    facing: 1,
    hat: 'feather',
    heldProp: 'microphone',
    pantsColor: RUBBER_PALETTE.tcCoral,
    accentColor: RUBBER_PALETTE.tcGold,
  });

  // -------------------------------------------------------------------------
  // 2D Scene Director (`One Scene = One Composition, One Scene = One Continuous Move`)
  // -------------------------------------------------------------------------
  const director = studio.director({
    subjects: {
      broadwayStage: { x: 960, y: 540, w: 1720, h: 920 },
      hornDuelClose: { x: 960, y: 540, w: 1560, h: 860 },
      technicolorKeys: { x: 960, y: 540, w: 1640, h: 880 },
      vortexFinale: { x: 960, y: 540, w: 1700, h: 920 },
    },
    shots: {
      'act1-curtain-up': { size: 'wide', move: 'push', amount: 0.45, subject: 'broadwayStage' },
      'act2-horn-duel': { size: 'close', move: 'pan', amount: 0.50, subject: 'hornDuelClose' },
      'act3-technicolor-keys': { size: 'medium', move: 'track', amount: 0.50, subject: 'technicolorKeys' },
      'act4-vortex-iris': { size: 'full', move: 'pull', amount: 0.45, subject: 'vortexFinale' },
    },
  });

  // -------------------------------------------------------------------------
  // Scene 1 (`wide`): 01 · 胶片开映 · 百老汇摇摆揭幕
  // -------------------------------------------------------------------------
  function renderScene1(ctx, w, h, frame, look, beginLayer, endLayer) {
    const localT = frame.localT ?? 0;
    const t = frame.t ?? 0;
    const swing = evalSwingBounce(t, 132);

    beginLayer(1.0);

    // 1. Wide S-curved 3D perspective piano keyboard road
    const roadSpine = [
      [110, 990],
      [310, 885],
      [540, 760],
      [740, 690],
      [960, 675],
      [1180, 700],
      [1380, 735],
      [1560, 755],
    ];
    drawElasticKeyboardRoad(ctx, roadSpine, {
      numKeys: 44,
      keyWidth: 132,
      contacts: [
        { x: catWide.state.x, y: catWide.state.y, dip: 14, radius: 64 },
        { x: flapperWide.state.x, y: flapperWide.state.y, dip: 11, radius: 56 },
        { x: 1020, y: 690, dip: 9, radius: 44 },
      ],
      t,
    });

    // 2. Background Anthropomorphic Stand Microphone dancing near center-left
    drawAnthropomorphicInstrument(ctx, 790, 565, {
      kind: 'microphone',
      scale: 0.88,
      t,
    });

    // 3. Giant Anthropomorphic Brass Gramophone on right stage
    drawAnthropomorphicGramophone(ctx, 1390, 535, {
      scale: 0.94,
      eyeMode: 'pie',
      arm1Pose: 'point',
      arm2Pose: 'crank',
      spitBlast: 0.35,
      t,
    });

    // 4. Hopping mischievous black Note Critters marching along the piano road
    const critter1X = lerp(1150, 940, smootherstep(0.3, 3.4, localT));
    const critter2X = lerp(1260, 1085, smootherstep(0.3, 3.4, localT));
    drawNoteCritter(ctx, critter1X, 665, { state: 'walk', scale: 0.96, t });
    drawNoteCritter(ctx, critter2X, 690, { state: 'walk', scale: 0.84, t: t + 0.4 });

    // 5. Stream of sepia jazz notes floating from the Gramophone horn
    drawJazzNoteStream(ctx, 1190, 465, 520, 410, t, {
      count: 11,
      spreadY: 75,
    });

    // 6. Jazz Cat Trumpeter & Flapper stepping onto the keyboard road
    flapperWide.act(localT, [
      { do: 'walk', from: 0.2, to: 2.2, fromX: 240, toX: 335, fromY: 855, toY: 815 },
      { do: 'wave', from: 2.0, to: 3.6, amount: 0.9 },
    ]);
    flapperWide.draw(ctx, t);

    catWide.act(localT, [
      { do: 'walk', from: 0.15, to: 2.0, fromX: 410, toX: 535, fromY: 805, toY: 740 },
      {
        do: 'pose',
        from: 1.9,
        to: 3.6,
        hold: true,
        joints: { spineAngle: -0.14, headAngle: -0.22, shRAng: -0.95, elRAng: 0.55 },
      },
    ]);
    catWide.draw(ctx, t);

    // Exclamation pop icon above Jazz Cat when spotting the Note Critters
    if (localT > 1.8 && localT < 3.3) {
      const popAlpha = Math.sin(clamp((localT - 1.8) / 1.5, 0, 1) * Math.PI);
      drawPopIcon(ctx, catWide.state.x + 15, catWide.state.y - 235, '!', {
        alpha: popAlpha,
        scale: 0.95,
      });
    }

    endLayer();

    // 7. Theatrical Velvet Curtains (opening rapidly in 0.0..0.62s so settle=2.74s is 100% open)
    const openProg = smootherstep(0.05, 0.62, localT);
    drawTheaterCurtains(ctx, w, h, {
      openProg,
      bounceDy: swing.bounce * 0.45,
      look,
    });

    // 8. 35mm Reel Leader Countdown (`0.0..0.50s` only)
    if (localT < 0.50) {
      const num = localT < 0.18 ? 3 : localT < 0.34 ? 2 : 1;
      const cdAlpha = 1.0 - smootherstep(0.36, 0.50, localT);
      draw35mmCountdown(ctx, w, h, num, cdAlpha);
    }
  }

  // -------------------------------------------------------------------------
  // Scene 2 (`close`): 02 · 铜管飙音 · 留声机咆哮斗技
  // Low-Angle Over-the-Shoulder (`view: 'back'`) Close-Up vs. Towering Giant Gramophone!
  // -------------------------------------------------------------------------
  function renderScene2(ctx, w, h, frame, look, beginLayer, endLayer) {
    const localT = frame.localT ?? 0;
    const t = frame.t ?? 0;
    const swing = evalSwingBounce(t, 132);

    beginLayer(1.0);

    // 1. Foreshortened diagonal perspective piano road plunging from bottom-left foreground to upper-right
    drawElasticKeyboardRoad(
      ctx,
      [
        [140, 1065],
        [490, 965],
        [860, 865],
        [1240, 785],
        [1620, 735],
      ],
      {
        numKeys: 28,
        keyWidth: 168,
        contacts: [{ x: 440, y: 970, dip: 20, radius: 95 }],
        waveAmp: 10,
        t,
      }
    );

    // 2. Acoustic Clash Starburst & Concentric Shockwaves in the upper-center sky
    const clashR1 = 155 + Math.sin(t * 9) * 26;
    const clashR2 = 245 + Math.cos(t * 7) * 32;
    drawTechnicolorRing(ctx, 815, 445, clashR1, { alpha: 0.82 });
    drawTechnicolorRing(ctx, 815, 445, clashR2, { alpha: 0.58 });
    drawComicBurst(ctx, 815, 440, 115, {
      scale: 0.88 + Math.sin(t * 12) * 0.10,
      label: 'BLAM!',
    });

    // 3. Towering Right Close-Up: Giant Roaring Anthropomorphic Brass Gramophone (`scale: 1.68`)
    drawAnthropomorphicGramophone(ctx, 1385, 555, {
      scale: 1.68,
      eyeMode: 'angry',
      arm1Pose: 'fist',
      arm2Pose: 'fist',
      neckLeanX: -34 + Math.sin(t * 10) * 16,
      hornSquashX: 1.12 + Math.sin(t * 14) * 0.08,
      hornSquashY: 1.05 - Math.sin(t * 14) * 0.06,
      spitBlast: 1.0,
      t,
    });

    // 4. Airborne Black Note Critters (`state: 'airborne'`) blasted out of the giant Gramophone horn!
    for (const [ncX, ncY, ncScale, ncOff] of [
      [965, 335, 1.08, 0.0],
      [925, 555, 0.96, 0.5],
      [1045, 635, 0.90, 1.1],
    ]) {
      drawNoteCritter(
        ctx,
        ncX + Math.sin(t * 7 + ncOff) * 16,
        ncY + Math.cos(t * 8 + ncOff) * 12,
        { state: 'airborne', scale: ncScale, t: t + ncOff }
      );
    }

    // 5. Dueling Jazz Note Stream & Dip-Pen Brass Soundwave Arcs
    drawJazzNoteStream(ctx, 680, 500, 1040, 420, t, {
      count: 11,
      spreadY: 88,
      technicolor: true,
    });

    for (let i = 0; i < 3; i++) {
      const p = (t * 2.5 + i * 0.33) % 1;
      const arcX = 655 + p * 180;
      const arcY = 505 - p * 48;
      const arcH = 42 + p * 82;
      drawDipPenStroke(
        ctx,
        [
          [arcX - 16, arcY - arcH],
          [arcX + 20, arcY],
          [arcX - 16, arcY + arcH],
        ],
        {
          width: 7.2 * (1 - p * 0.45),
          color: i % 2 === 0 ? RUBBER_PALETTE.tcGold : RUBBER_PALETTE.tcCoral,
          doubleInk: true,
          t,
        }
      );
    }

    // 6. Left Foreground Over-the-Shoulder Close-Up: Jazz Cat (`view: 'back'`, `scale: 2.15`)
    // Raising his right rubber-hose arm and golden trumpet diagonally toward the upper-right Gramophone!
    catCloseBack.act(localT, [
      { do: 'view', view: 'back' },
      {
        do: 'pose',
        from: 0.0,
        to: 3.8,
        hold: true,
        joints: {
          spineAngle: -0.18 + Math.sin(t * 6.5) * 0.05,
          headAngle: -0.28,
          shRAng: -1.12 + Math.sin(t * 9) * 0.06,
          elRAng: -0.18,
          shLAng: 0.52,
          elLAng: 0.45,
          thighLAng: 0.16,
          thighRAng: -0.18,
        },
      },
    ]);
    catCloseBack.draw(ctx, t);

    endLayer();

    drawTheaterCurtains(ctx, w, h, {
      openProg: 1.0,
      bounceDy: swing.bounce * 0.45,
      look,
    });
  }

  // -------------------------------------------------------------------------
  // Scene 3 (`medium`): 03 · 琴键踏浪 · 特艺三色彩环绽放
  // Frontal Medium Action on a Giant Central Arching Piano Wave Crest (NO Gramophone on right!)
  // -------------------------------------------------------------------------
  function renderScene3(ctx, w, h, frame, look, beginLayer, endLayer) {
    const localT = frame.localT ?? 0;
    const t = frame.t ?? 0;
    const swing = evalSwingBounce(t, 132);

    // Parabolic jump landing at localT = 0.88s onto the central crest (x = 915, y = 655)
    const hopU = clamp((localT - 0.12) / 0.78, 0, 1);
    const hop = evalHopParabola(hopU, 740, 720, 915, 655, 145);
    const landed = localT >= 0.88;
    const catX = landed ? 915 : hop.x;
    const catY = landed ? 655 - Math.abs(Math.sin((localT - 0.88) * 6.8)) * 24 : hop.y;

    // Two Huge Expanding 3-Strip Technicolor Soundwave Rings centered on the crest stomp
    const ring1R = landed ? lerp(110, 560, smootherstep(0.86, 3.2, localT)) : 0;
    const ring2R = localT >= 1.35 ? lerp(85, 410, smootherstep(1.35, 3.5, localT)) : 0;
    const activeRings = [];
    if (ring1R > 10) activeRings.push({ x: 915, y: 650, r: ring1R });
    if (ring2R > 10) activeRings.push({ x: 915, y: 650, r: ring2R });

    beginLayer(1.0);

    // 1. Giant Central Arching Piano Wave Crest (`Trampoline Crest` across the frame, dyed by Technicolor rings)
    const crestSpine = [
      [110, 965],
      [340, 835],
      [610, 710],
      [915, 650],
      [1220, 705],
      [1490, 815],
      [1760, 935],
    ];
    drawElasticKeyboardRoad(ctx, crestSpine, {
      numKeys: 46,
      keyWidth: 152,
      contacts: [
        { x: catX, y: 655, dip: landed ? 28 : 6, radius: 105 },
        { x: flapperMediumFront.state.x, y: flapperMediumFront.state.y, dip: 16, radius: 75 },
        { x: 1365, y: 725, dip: 14, radius: 70 },
      ],
      rings: activeRings,
      waveAmp: 12,
      t,
    });

    // 2. Expanding 3-Strip Technicolor Soundwave Rings radiating from the central crest
    if (ring1R > 10) drawTechnicolorRing(ctx, 915, 610, ring1R, { alpha: 0.94 });
    if (ring2R > 10) drawTechnicolorRing(ctx, 915, 610, ring2R, { alpha: 0.84 });

    // 3. Right Flank Accompaniment: Anthropomorphic Upright Contrabass & Brass Saxophone (NO Gramophone!)
    drawAnthropomorphicInstrument(ctx, 1365, 635, {
      kind: 'contrabass',
      scale: 1.38,
      eyeMode: 'pie',
      t,
    });
    drawAnthropomorphicInstrument(ctx, 1595, 695, {
      kind: 'saxophone',
      scale: 1.28,
      flip: -1,
      t: t + 0.3,
    });

    // 4. Twin Spinning 78-RPM Vinyl Records (`r = 72`) & Blooming 4-Point Technicolor Stars in the upper sky
    drawSpinningVinyl(ctx, 635, 255, 72, t * 6.5, { labelColor: RUBBER_PALETTE.tcCoral });
    drawSpinningVinyl(ctx, 1195, 255, 72, -t * 6.5, { labelColor: RUBBER_PALETTE.tcGold });
    for (const [sx, sy, sr] of [
      [775, 210, 26],
      [915, 185, 32],
      [1055, 210, 26],
    ]) {
      drawFourPointStar(ctx, sx, sy + Math.sin(t * 4 + sx) * 7, sr, {
        rot: t * 2.0 + sx * 0.01,
        t,
      });
    }

    // 5. Chromatic Jazz Note Stream arching over the wave crest
    drawJazzNoteStream(ctx, 1340, 490, 480, 460, t, {
      count: 14,
      rings: activeRings,
      technicolor: true,
      spreadY: 95,
    });

    // 6. Squashed Black Note Critter pancake under Jazz Cat's stomp + hopping critter on right slope
    if (landed) {
      drawNoteCritter(ctx, 915, 686, { state: 'squashed', scale: 1.32, t });
      drawComicBurst(ctx, 1085, 555, 105, {
        scale: 0.86 + Math.sin(t * 10) * 0.08,
        label: 'CLANG!',
      });
    } else {
      drawNoteCritter(ctx, 915, 650, { state: 'walk', scale: 1.18, t });
    }
    drawNoteCritter(ctx, 1185, 695, { state: 'walk', scale: 1.02, t: t + 0.5 });

    // 7. Left Flank: Frontal Flapper (`view: 'front'`, `scale: 1.36`) dancing on the dyed keys
    flapperMediumFront.act(localT, [
      { do: 'view', view: 'front' },
      { do: 'wave', from: 0.0, to: 3.8, amount: 1.0 },
    ]);
    flapperMediumFront.draw(ctx, t);

    // 8. Center Crest Protagonist: Frontal Jazz Cat (`view: 'front'`, `scale: 1.56`) stomping the keys!
    catMediumFront.state.x = catX;
    catMediumFront.state.y = catY;
    catMediumFront.act(localT, [
      { do: 'view', view: 'front' },
      {
        do: 'pose',
        from: 0.0,
        to: 3.8,
        hold: true,
        joints: {
          spineAngle: landed ? -0.10 : 0.16,
          headAngle: -0.18,
          shRAng: -1.28 + Math.sin(t * 8) * 0.12,
          elRAng: 0.42,
          shLAng: 0.65 + Math.cos(t * 8) * 0.12,
          elLAng: 0.48,
          thighLAng: landed ? 0.18 : 0.36,
          thighRAng: landed ? -0.18 : -0.36,
        },
      },
    ]);
    catMediumFront.draw(ctx, t);

    endLayer();

    drawTheaterCurtains(ctx, w, h, {
      openProg: 1.0,
      bounceDy: swing.bounce * 0.45,
      look,
    });
  }

  // -------------------------------------------------------------------------
  // Scene 4 (`full`): 04 · 旋涡华彩 · 经典黑幕圆圈收尾
  // Midnight Broadway Full Ensemble Finale & Golden Logarithmic Vortex + Circular Iris-Out
  // -------------------------------------------------------------------------
  function renderScene4(ctx, w, h, frame, look, beginLayer, endLayer) {
    const localT = frame.localT ?? 0;
    const t = frame.t ?? 0;
    const swing = evalSwingBounce(t, 132);

    const vortexStrength = smootherstep(0.35, 1.65, localT);
    const impactFlash =
      localT >= 0.18 && localT <= 1.45
        ? Math.sin(clamp((localT - 0.18) / 1.27, 0, 1) * Math.PI) * 0.95
        : 0;

    beginLayer(1.0);

    // 1. Full Technicolor Piano Keyboard Road
    const finaleSpine = [
      [100, 1005],
      [310, 890],
      [535, 755],
      [710, 690],
      [920, 675],
      [1150, 700],
      [1370, 735],
      [1555, 755],
    ];
    drawElasticKeyboardRoad(ctx, finaleSpine, {
      numKeys: 44,
      keyWidth: 136,
      contacts: [
        { x: catFinale.state.x, y: catFinale.state.y, dip: 16, radius: 76 },
        { x: flapperFinale.state.x, y: flapperFinale.state.y, dip: 12, radius: 64 },
      ],
      rings: [{ x: 820, y: 580, r: 680 }],
      waveAmp: 8,
      t,
    });

    // 2. Expanding Technicolor Aura behind ensemble
    drawTechnicolorRing(ctx, 740, 520, 420 + Math.sin(t * 5) * 24, { alpha: 0.78 });

    // 3. Anthropomorphic Contrabass & Brass Saxophone joining the grand finale ensemble
    drawAnthropomorphicInstrument(ctx, 225, 685, {
      kind: 'contrabass',
      scale: 0.96,
      t,
    });
    drawAnthropomorphicInstrument(ctx, 915, 625, {
      kind: 'saxophone',
      scale: 0.98,
      t: t + 0.25,
    });

    // 4. Giant Gramophone with Dizzy `X X` Eyes, Orbiting Stars, `CLANG!` Burst & Golden Logarithmic Vortex!
    drawAnthropomorphicGramophone(ctx, 1395, 535, {
      scale: 1.0,
      stunned: true,
      eyeMode: 'dizzy',
      recoilAngle: 0.08 * Math.sin(t * 6),
      vortexStrength,
      impactFlash,
      impactLabel: 'CLANG!',
      t,
    });

    // 5. Swirling Technicolor Jazz Notes & 4-Point Stars drawn into the golden horn vortex
    drawJazzNoteStream(ctx, 1215, 475, 560, 420, t, {
      count: 15,
      vortex: vortexStrength,
      technicolor: true,
      spreadY: 105,
    });

    for (const [sx, sy, sr] of [
      [540, 275, 26],
      [840, 245, 30],
      [1110, 285, 24],
    ]) {
      drawFourPointStar(ctx, sx, sy + Math.sin(t * 4 + sx) * 8, sr, {
        rot: t * 2.2 + sx * 0.01,
        t,
      });
    }

    // 6. Flapper & Bandleader Jazz Cat taking their frontal Broadway bow/salute
    flapperFinale.act(localT, [
      { do: 'view', view: 'front' },
      { do: 'wave', from: 0.0, to: 3.6, amount: 1.0 },
    ]);
    flapperFinale.draw(ctx, t);

    catFinale.act(localT, [
      { do: 'view', view: 'front' },
      {
        do: 'pose',
        from: 0.0,
        to: 3.6,
        hold: true,
        joints: {
          spineAngle: -0.08,
          headAngle: -0.14,
          shRAng: -1.45 + Math.sin(t * 8) * 0.18,
          elRAng: 0.35,
          shLAng: 0.35,
          elLAng: 0.45,
        },
      },
    ]);
    catFinale.draw(ctx, t);

    // 7. Classic 1930s Circular Black Iris-Out ONLY after localT > 2.92s
    // (strictly after settle=2.74s and storyboard=2.81s so all inspection stills are 100% bright & open!)
    if (localT > 2.92) {
      const irisU = smootherstep(2.92, 3.58, localT);
      const irisRadius = lerp(1350, 225, irisU);
      drawIrisTransition(ctx, w, h, catFinale.state.x + 10, catFinale.state.y - 115, irisRadius);
    }

    endLayer();

    drawTheaterCurtains(ctx, w, h, {
      openProg: 1.0,
      bounceDy: swing.bounce * 0.45,
      look,
    });
  }

  return {
    canvas: studio.canvas,
    storyboard: director.storyboard,
    async render(frame) {
      director.update(frame);
      studio.render(frame, ({ ctx, width: w, height: h, look, beginLayer, endLayer }) => {
        const sIdx = frame.sceneIndex ?? 0;
        if (sIdx === 0) renderScene1(ctx, w, h, frame, look, beginLayer, endLayer);
        else if (sIdx === 1) renderScene2(ctx, w, h, frame, look, beginLayer, endLayer);
        else if (sIdx === 2) renderScene3(ctx, w, h, frame, look, beginLayer, endLayer);
        else renderScene4(ctx, w, h, frame, look, beginLayer, endLayer);
      });
    },
  };
}
