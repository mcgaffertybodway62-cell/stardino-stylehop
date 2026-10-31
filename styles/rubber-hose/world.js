/**
 * 1930s Rubber-Hose Cartoon · Default 4-Scene Causal Story (`styles/rubber-hose/world.js`).
 *
 * Story: 《午夜百老汇 · 留声机惊魂与特艺狂想》 (Midnight Broadway · The Jammed Gramophone & Technicolor Rhapsody)
 * Causal Chain (`起因 -> 爆发与夸张特写反应 Take -> 追逐与木槌物理敲击 -> 驯服合奏与圆圈谢幕`):
 *   - Scene 1 (`act1-curtain-up`, `sepia`, 3.6s, `wide`, `keyframe=0.72`):
 *       01 · 摇柄蓄压 · 留声机卡壳蓄力 — Jazz Cat (`scale: 1.50`, `facing: -1`) stands at the right of the
 *       giant brass Gramophone and physically grasps & cranks its winding handle (`do: 'crank'` locked via IK
 *       onto `getGramophoneSockets().crankHub`). As he winds faster, the jammed brass horn swells like a
 *       pressurized boiler while a single curious Flapper on the left watches in suspense.
 *   - Scene 2 (`act2-horn-duel`, `vaudeville`, 3.8s, `close`, `keyframe=0.56`):
 *       02 · 号角喷发 · 夸张惊愕大特写 — The pressurized Gramophone horn blasts out a giant rebellious
 *       Black Note Critter (`BLAM!`). The left half of the screen is dominated by a **50% screen-height
 *       close-up of Jazz Cat (`scale: 2.32`, `view: 'side'`)** performing a 3-beat 1930s Tex Avery / Fleischer
 *       Cartoon Take (`do: 'take'`): anticipation squash -> extreme airborne recoil with telescopic eye-stalks
 *       popping out (`eyePop`), jaw dropping to chest (`jawDrop`), and bowler hat flying off his head (`hatJump`)!
 *   - Scene 3 (`act3-technicolor-keys`, `technicolor`, 3.8s, `medium`, `keyframe=0.64`):
 *       03 · 木槌追击 · 一锤砸绽特艺三色 — Jazz Cat (`scale: 1.68`, `heldProp: 'mallet'`) chases the runaway
 *       Note Critter up the central arching piano wave crest, winds up his giant wooden mallet behind his back,
 *       and **physically smashes the mallet head squarely onto the Note Critter (`do: 'malletStrike'`,
 *       `target: [1005, 615]`)**! The physical impact flattens the Note Critter into an ink pancake (`X X` dizzy
 *       eyes + flying Technicolor stars), depresses the ivory keys (`dip: 32`), and unleashes 3-Strip Technicolor
 *       soundwave rings that dye the sepia stage into vivid cyan, violet, coral, and gold.
 *   - Scene 4 (`act4-vortex-iris`, `talkie`, 3.6s, `full`, `keyframe=0.68`):
 *       04 · 驯服合奏 · 百老汇圆圈谢幕 — Tamed Note Critters and chromatic notes swirl into a golden harmonic
 *       melody as Top-Hat Bandleader Jazz Cat (`scale: 1.48`, `heldProp: 'baton'`) and Flapper (`scale: 1.28`)
 *       take their spotlight curtain call before the classic 1930s circular black Iris-Out.
 *
 * Architectural Rules:
 *   - Imports ONLY `./kernel.js` and `../../engine/motion.js`.
 *   - Single visual focal point per scene: background props stay calm (`bounce: false`) so the viewer's eye
 *     locks immediately onto the protagonist's acting and physical IK contact.
 */

import { clamp, lerp, smootherstep } from '../../engine/motion.js';
import {
  RUBBER_PALETTE,
  evalSwingBounce,
  drawDipPenStroke,
  drawFourPointStar,
  drawComicBurst,
  drawPopIcon,
  drawTechnicolorRing,
  drawTheaterCurtains,
  draw35mmCountdown,
  drawIrisTransition,
  drawElasticKeyboardRoad,
  getGramophoneSockets,
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
  // Scene 1: Jazz Cat cranking the Gramophone (`scale: 1.50`, `facing: -1`, `heldProp: 'none'`)
  const catCranker = createRubberHoseCharacter({
    archetype: 'jazzcat',
    view: 'side',
    x: 1385,
    y: 885,
    scale: 1.50,
    facing: -1,
    bounceScale: 0.22,
    hat: 'bowler',
    heldProp: 'none',
    pantsColor: RUBBER_PALETTE.paperCream,
    accentColor: RUBBER_PALETTE.tcGold,
  });

  const flapperObserver = createRubberHoseCharacter({
    archetype: 'flapper',
    view: 'side',
    x: 375,
    y: 815,
    scale: 1.22,
    facing: 1,
    bounceScale: 0.18,
    hat: 'feather',
    heldProp: 'none',
    pantsColor: RUBBER_PALETTE.tcCoral,
    accentColor: RUBBER_PALETTE.tcGold,
  });

  // Scene 2: 50% Screen-Height Close-Up Jazz Cat performing the 1930s Cartoon Take (`scale: 2.32`)
  const catCloseTake = createRubberHoseCharacter({
    archetype: 'jazzcat',
    view: 'side',
    x: 465,
    y: 945,
    scale: 2.32,
    facing: 1,
    bounceScale: 0.15,
    hat: 'bowler',
    heldProp: 'none',
    pantsColor: RUBBER_PALETTE.paperCream,
    accentColor: RUBBER_PALETTE.tcGold,
  });

  // Scene 3: Mallet-Swinging Action Protagonist on the Piano Wave Crest (`scale: 1.68`, `heldProp: 'mallet'`)
  const catMalletHero = createRubberHoseCharacter({
    archetype: 'jazzcat',
    view: 'side',
    x: 805,
    y: 715,
    scale: 1.68,
    facing: 1,
    bounceScale: 0.25,
    hat: 'bowler',
    heldProp: 'mallet',
    pantsColor: RUBBER_PALETTE.paperCream,
    accentColor: RUBBER_PALETTE.tcGold,
  });

  const flapperCheer = createRubberHoseCharacter({
    archetype: 'flapper',
    view: 'front',
    x: 385,
    y: 785,
    scale: 1.32,
    facing: 1,
    bounceScale: 0.25,
    hat: 'feather',
    heldProp: 'none',
    pantsColor: RUBBER_PALETTE.tcCoral,
    accentColor: RUBBER_PALETTE.tcGold,
  });

  // Scene 4: Full Ensemble Finale Bandleader & Flapper (`view: 'front'`, `scale: 1.48` / `1.28`)
  const catFinale = createRubberHoseCharacter({
    archetype: 'jazzcat',
    view: 'front',
    x: 685,
    y: 725,
    scale: 1.48,
    facing: 1,
    bounceScale: 0.35,
    hat: 'topHat',
    heldProp: 'baton',
    pantsColor: RUBBER_PALETTE.paperCream,
    accentColor: RUBBER_PALETTE.tcGold,
  });

  const flapperFinale = createRubberHoseCharacter({
    archetype: 'flapper',
    view: 'front',
    x: 385,
    y: 775,
    scale: 1.28,
    facing: 1,
    bounceScale: 0.30,
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
      'act2-horn-duel': { size: 'close', move: 'pan', amount: 0.40, subject: 'hornDuelClose' },
      'act3-technicolor-keys': { size: 'medium', move: 'track', amount: 0.45, subject: 'technicolorKeys' },
      'act4-vortex-iris': { size: 'full', move: 'pull', amount: 0.45, subject: 'vortexFinale' },
    },
  });

  // -------------------------------------------------------------------------
  // Scene 1 (`wide`): 01 · 摇柄蓄压 · 留声机卡壳蓄力
  // Cause: Jazz Cat physically cranks the Gramophone winding handle (`do: 'crank'`),
  // causing the jammed brass horn to swell with trapped musical pressure!
  // -------------------------------------------------------------------------
  function renderScene1(ctx, w, h, frame, look, beginLayer, endLayer) {
    const localT = frame.localT ?? 0;
    const t = frame.t ?? 0;

    // Pressure builds continuously as Jazz Cat cranks from 0.4s to 3.4s
    const pressureU = smootherstep(0.4, 3.2, localT);
    const hornSwell = 1.0 + pressureU * 0.24 + Math.sin(t * 16) * pressureU * 0.06;

    beginLayer(1.0);

    // 1. Calm S-curved 3D perspective piano keyboard road (`waveAmp: 0` so stage is steady)
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
        { x: flapperObserver.state.x, y: flapperObserver.state.y, dip: 10, radius: 56 },
      ],
      waveAmp: 0,
      t,
    });

    // 2. Giant Brass Gramophone at center-right (`cx = 1120, cy = 465`), swelling with pressure
    const gramCx = 1120;
    const gramCy = 465;
    const gramSockets = getGramophoneSockets(gramCx, gramCy, {
      scale: 1.0,
      cabSquashY: 1.0 - pressureU * 0.08,
      crankSpeed: 6.5,
      t,
    });

    drawAnthropomorphicGramophone(ctx, gramCx, gramCy, {
      scale: 1.0,
      bounce: false,
      cabSquashY: 1.0 - pressureU * 0.08,
      eyeMode: pressureU > 0.5 ? 'angry' : 'pie',
      arm1Pose: 'fist',
      arm2Pose: 'crank',
      hornSquashX: hornSwell,
      hornSquashY: hornSwell * 0.96,
      spitBlast: pressureU * 0.45,
      t,
    });

    // 3. Trapped musical pressure rings & '?' / '!' pop icon above the swelling horn
    if (pressureU > 0.25) {
      drawTechnicolorRing(ctx, gramSockets.hornBell[0], gramSockets.hornBell[1], 75 + pressureU * 65, {
        alpha: pressureU * 0.65,
      });
      drawPopIcon(ctx, gramSockets.forehead[0] - 10, gramSockets.forehead[1] - 48, '?!', {
        alpha: smootherstep(0.35, 0.85, pressureU),
        scale: 0.85 + pressureU * 0.2,
      });
    }

    // 4. Curious Flapper on left stage leaning forward to watch the jammed Gramophone
    flapperObserver.act(localT, [
      { do: 'walk', from: 0.15, to: 1.6, fromX: 255, toX: 385, fromY: 855, toY: 805 },
      {
        do: 'pose',
        from: 1.5,
        to: 3.6,
        hold: true,
        joints: { spineAngle: 0.12, headAngle: 0.15, shRAng: -0.55, elRAng: 0.65 },
      },
    ]);
    flapperObserver.draw(ctx, t);

    // 5. Protagonist Jazz Cat on right (`x = 1385, y = 885, facing: -1`) physically cranking `crankHub`!
    catCranker.act(localT, [
      {
        do: 'crank',
        from: 0.0,
        to: 3.6,
        center: gramSockets.crankHub,
        radius: 28,
        speed: 6.5,
        mood: pressureU > 0.6 ? 'surprised' : 'neutral',
      },
    ]);
    catCranker.draw(ctx, t);

    endLayer();

    // 6. Theatrical Velvet Curtains (steady after opening in 0.0..0.60s)
    const openProg = smootherstep(0.05, 0.60, localT);
    drawTheaterCurtains(ctx, w, h, {
      openProg,
      bounceDy: 0,
      look,
    });

    // 7. 35mm Reel Leader Countdown (`0.0..0.48s` only)
    if (localT < 0.48) {
      const num = localT < 0.16 ? 3 : localT < 0.32 ? 2 : 1;
      const cdAlpha = 1.0 - smootherstep(0.34, 0.48, localT);
      draw35mmCountdown(ctx, w, h, num, cdAlpha);
    }
  }

  // -------------------------------------------------------------------------
  // Scene 2 (`close`): 02 · 号角喷发 · 夸张惊愕大特写
  // Peak Reaction: The Gramophone horn blasts out a giant rebellious Note Critter (`BLAM!`),
  // triggering a 50% screen-height close-up Cartoon Take (`do: 'take'`) on Jazz Cat!
  // -------------------------------------------------------------------------
  function renderScene2(ctx, w, h, frame, look, beginLayer, endLayer) {
    const localT = frame.localT ?? 0;
    const t = frame.t ?? 0;

    // Blast occurs at localT = 0.45s; Note Critter shoots from horn (1080, 460) toward center (885, 420)
    const blastU = smootherstep(0.35, 1.45, localT);
    const critterX = lerp(1120, 865, blastU) + Math.sin(t * 9) * 14;
    const critterY = lerp(475, 415, blastU) + Math.cos(t * 10) * 12;

    beginLayer(1.0);

    // 1. Foreshortened close-up stage floor & keyboard road in lower frame
    drawElasticKeyboardRoad(
      ctx,
      [
        [120, 1055],
        [490, 965],
        [880, 875],
        [1280, 795],
        [1640, 745],
      ],
      {
        numKeys: 26,
        keyWidth: 165,
        contacts: [{ x: 465, y: 945, dip: 22, radius: 95 }],
        waveAmp: 0,
        t,
      }
    );

    // 2. Right Side: Roaring Giant Brass Gramophone Horn (`scale: 1.48`, `bounce: false`)
    drawAnthropomorphicGramophone(ctx, 1395, 555, {
      scale: 1.48,
      bounce: false,
      eyeMode: 'angry',
      arm1Pose: 'fist',
      arm2Pose: 'fist',
      neckLeanX: -32,
      hornSquashX: 1.16 + Math.sin(t * 14) * 0.06,
      hornSquashY: 1.06 - Math.sin(t * 14) * 0.05,
      spitBlast: 1.0,
      t,
    });

    // 3. Acoustic Blast Rings & `BLAM!` Starburst behind the ejected Note Critter
    if (localT > 0.30) {
      const ringAlpha = clamp(smootherstep(0.30, 0.75, localT), 0, 1);
      drawTechnicolorRing(ctx, 945, 445, 145 + Math.sin(t * 8) * 18, { alpha: ringAlpha * 0.85 });
      drawTechnicolorRing(ctx, 945, 445, 235 + Math.cos(t * 7) * 22, { alpha: ringAlpha * 0.55 });
      drawComicBurst(ctx, 995, 345, 108, {
        scale: 0.90 + Math.sin(t * 12) * 0.08,
        label: 'BLAM!',
      });
    }

    // 4. Giant Rebellious Black Note Critter (`scale: 1.38`) shooting out of the horn toward Jazz Cat!
    drawNoteCritter(ctx, critterX, critterY, {
      state: localT < 0.95 ? 'airborne' : 'walk',
      scale: 1.38,
      flip: -1,
      t,
    });

    // 5. Left Foreground Close-Up (~50% screen height!): Jazz Cat (`scale: 2.32`, `view: 'side'`)
    // performing a 3-beat 1930s Cartoon Take (`eyePop`, `jawDrop`, `hatJump`)!
    catCloseTake.act(localT, [
      { do: 'view', view: 'side' },
      { do: 'take', from: 0.65, to: 3.45, intensity: 1.18 },
    ]);
    catCloseTake.draw(ctx, t);

    // Overhead `!!` shock icon during the Take peak
    if (localT > 1.05 && localT < 3.15) {
      drawPopIcon(ctx, catCloseTake.state.x - 55, catCloseTake.state.y - 540, '!!', {
        alpha: smootherstep(1.05, 1.35, localT),
        scale: 1.25,
        color: RUBBER_PALETTE.tcCoral,
      });
    }

    endLayer();

    drawTheaterCurtains(ctx, w, h, {
      openProg: 1.0,
      bounceDy: 0,
      look,
    });
  }

  // -------------------------------------------------------------------------
  // Scene 3 (`medium`): 03 · 木槌追击 · 一锤砸绽特艺三色
  // Action & Physical IK Contact: Jazz Cat chases the Note Critter onto the piano crest,
  // winds up his wooden mallet, and physically smashes `[1005, 615]` (`do: 'malletStrike'`),
  // squashing the Note Critter into an ink pancake and blooming 3-Strip Technicolor rings!
  // -------------------------------------------------------------------------
  function renderScene3(ctx, w, h, frame, look, beginLayer, endLayer) {
    const localT = frame.localT ?? 0;
    const t = frame.t ?? 0;

    // Strike lands at localT = 1.78s (`from: 1.15, to: 3.60`, where strike phase reaches 1.0 at ~1.78s)
    const struck = localT >= 1.78;
    const strikeTarget = [1005, 615];

    // Expanding 3-Strip Technicolor Soundwave Rings triggered at the exact moment of mallet impact!
    const ring1R = struck ? lerp(95, 580, smootherstep(1.78, 3.55, localT)) : 0;
    const ring2R = localT >= 2.10 ? lerp(75, 420, smootherstep(2.10, 3.65, localT)) : 0;
    const activeRings = [];
    if (ring1R > 10) activeRings.push({ x: strikeTarget[0], y: strikeTarget[1] + 25, r: ring1R });
    if (ring2R > 10) activeRings.push({ x: strikeTarget[0], y: strikeTarget[1] + 25, r: ring2R });

    beginLayer(1.0);

    // 1. Giant Central Arching Piano Wave Crest (`Trampoline Crest`, dyed by Technicolor rings on impact)
    const crestSpine = [
      [110, 965],
      [340, 835],
      [610, 710],
      [940, 645],
      [1240, 705],
      [1490, 815],
      [1760, 935],
    ];
    drawElasticKeyboardRoad(ctx, crestSpine, {
      numKeys: 46,
      keyWidth: 152,
      contacts: [
        { x: strikeTarget[0], y: 645, dip: struck ? 34 : 8, radius: 115 },
        { x: catMalletHero.state.x, y: catMalletHero.state.y, dip: 16, radius: 80 },
        { x: flapperCheer.state.x, y: flapperCheer.state.y, dip: 12, radius: 68 },
      ],
      rings: activeRings,
      waveAmp: struck ? 8 : 0,
      t,
    });

    // 2. Expanding 3-Strip Technicolor Soundwave Rings radiating from the mallet impact point
    if (ring1R > 10) drawTechnicolorRing(ctx, strikeTarget[0], strikeTarget[1], ring1R, { alpha: 0.94 });
    if (ring2R > 10) drawTechnicolorRing(ctx, strikeTarget[0], strikeTarget[1], ring2R, { alpha: 0.84 });

    // 3. Right Flank Accompaniment: Calm Upright Contrabass (`bounce: false` before impact)
    drawAnthropomorphicInstrument(ctx, 1465, 665, {
      kind: 'contrabass',
      scale: 1.32,
      bounce: struck,
      eyeMode: struck ? 'shock' : 'pie',
      t,
    });

    // 4. Spinning 78-RPM Vinyl Record & Technicolor 4-Point Stars blooming in the upper sky upon impact
    if (struck) {
      drawSpinningVinyl(ctx, 645, 245, 70, t * 6.5, { labelColor: RUBBER_PALETTE.tcCoral });
      drawSpinningVinyl(ctx, 1245, 245, 70, -t * 6.5, { labelColor: RUBBER_PALETTE.tcGold });
      for (const [sx, sy, sr] of [
        [825, 205, 26],
        [985, 175, 34],
        [1135, 205, 26],
      ]) {
        drawFourPointStar(ctx, sx, sy + Math.sin(t * 4 + sx) * 6, sr, {
          rot: t * 2.0 + sx * 0.01,
          t,
        });
      }
    }

    // 5. Left Flank: Flapper cheering on the piano slope
    flapperCheer.act(localT, [
      { do: 'view', view: 'front' },
      { do: 'wave', from: 1.75, to: 3.8, amount: 0.95 },
    ]);
    flapperCheer.draw(ctx, t);

    // 6. The Target Note Critter at `[1005, 642]`:
    // Before `1.78s`, it hops tauntingly on the crest; at `>= 1.78s`, the wooden mallet smashes it flat!
    if (struck) {
      drawNoteCritter(ctx, strikeTarget[0], strikeTarget[1] + 28, {
        state: 'squashed',
        scale: 1.38,
        t,
      });
      drawComicBurst(ctx, strikeTarget[0] + 155, strikeTarget[1] - 95, 108, {
        scale: 0.92 + Math.sin(t * 10) * 0.06,
        label: 'POW!',
      });
    } else {
      const runX = lerp(1160, strikeTarget[0], smootherstep(0.0, 1.35, localT));
      drawNoteCritter(ctx, runX, strikeTarget[1] + 15, {
        state: 'walk',
        scale: 1.28,
        flip: -1,
        t,
      });
    }

    // 7. Protagonist Jazz Cat (`scale: 1.68`, `heldProp: 'mallet'`) chasing & physically striking `strikeTarget`!
    catMalletHero.act(localT, [
      { do: 'view', view: 'side' },
      { do: 'walk', from: 0.0, to: 1.18, fromX: 590, toX: 805, fromY: 775, toY: 715 },
      {
        do: 'malletStrike',
        from: 1.15,
        to: 3.65,
        target: strikeTarget,
        toolLen: 64,
      },
    ]);
    catMalletHero.draw(ctx, t);

    endLayer();

    drawTheaterCurtains(ctx, w, h, {
      openProg: 1.0,
      bounceDy: 0,
      look,
    });
  }

  // -------------------------------------------------------------------------
  // Scene 4 (`full`): 04 · 驯服合奏 · 百老汇圆圈谢幕
  // Resolution: The tamed Note Critters flow into a golden harmonic vortex while
  // Top-Hat Bandleader Jazz Cat & Flapper take their Broadway bow before the Iris-Out!
  // -------------------------------------------------------------------------
  function renderScene4(ctx, w, h, frame, look, beginLayer, endLayer) {
    const localT = frame.localT ?? 0;
    const t = frame.t ?? 0;
    const swing = evalSwingBounce(t, 132);

    const vortexStrength = smootherstep(0.25, 1.55, localT);

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
      waveAmp: 4,
      t,
    });

    // 2. Warm Technicolor Spotlight Halo behind the curtain-call duo
    drawTechnicolorRing(ctx, 685, 520, 390 + Math.sin(t * 4) * 16, { alpha: 0.72 });

    // 3. Tamed Giant Gramophone on right with Dizzy `X X` Eyes & Golden Harmonic Vortex
    drawAnthropomorphicGramophone(ctx, 1395, 535, {
      scale: 1.0,
      bounce: false,
      stunned: true,
      eyeMode: 'dizzy',
      recoilAngle: 0.05 * Math.sin(t * 5),
      vortexStrength,
      impactFlash: 0,
      t,
    });

    // 4. Swirling Technicolor Jazz Notes & 4-Point Stars drawn into the golden horn vortex
    drawJazzNoteStream(ctx, 1215, 475, 560, 420, t, {
      count: 14,
      vortex: vortexStrength,
      technicolor: true,
      spreadY: 95,
    });

    for (const [sx, sy, sr] of [
      [540, 265, 26],
      [840, 235, 30],
      [1110, 275, 24],
    ]) {
      drawFourPointStar(ctx, sx, sy + Math.sin(t * 4 + sx) * 6, sr, {
        rot: t * 2.0 + sx * 0.01,
        t,
      });
    }

    // 5. Flapper & Top-Hat Bandleader Jazz Cat taking their frontal Broadway bow/salute
    flapperFinale.act(localT, [
      { do: 'view', view: 'front' },
      { do: 'wave', from: 0.0, to: 3.6, amount: 0.9 },
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
          headAngle: -0.12,
          shRAng: -1.35 + Math.sin(t * 6) * 0.14,
          elRAng: 0.35,
          shLAng: 0.35,
          elLAng: 0.45,
        },
      },
    ]);
    catFinale.draw(ctx, t);

    // 6. Classic 1930s Circular Black Iris-Out ONLY after localT > 2.92s
    if (localT > 2.92) {
      const irisU = smootherstep(2.92, 3.58, localT);
      const irisRadius = lerp(1350, 225, irisU);
      drawIrisTransition(ctx, w, h, catFinale.state.x + 10, catFinale.state.y - 135, irisRadius);
    }

    endLayer();

    drawTheaterCurtains(ctx, w, h, {
      openProg: 1.0,
      bounceDy: swing.bounce * 0.25,
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
