/**
 * Ink Wash Scroll · Default 4-Scene Showcase Story (`styles/ink-wash/world.js`).
 *
 * Story: 《山高水长 · 四时丹青》 (Four Seasons & Four Modes of Classical Chinese Painting)
 *   - Scene 1 (`act1-pine-tea`, `shanshui`, 3.6s): 松间煮茶 · 鹤起云谷
 *   - Scene 2 (`act2-brush-bridge`, `qinglv`, 3.8s): 千里青绿 · 挥毫成桥
 *   - Scene 3 (`act3-river-boat`, `xieyi`, 3.8s): 秋江泛舟 · 双鲤化荷
 *   - Scene 4 (`act4-moon-pavilion`, `night`, 3.6s): 月夜古亭 · 抚琴落印
 *
 * Architectural Rule:
 *   Imports ONLY `./kernel.js` and `../../engine/motion.js`.
 *   Zero Star-Spark Slime mascot. Future AI runs authoring a video for a user topic
 *   MUST import `./kernel.js` and build a bespoke world for that topic.
 */

import { clamp, lerp, smootherstep } from '../../engine/motion.js';
import {
  INK_PALETTE,
  evalBoatBob,
  evalBrushWriteProgress,
  evalElasticCantilever,
  drawCelestialBody,
  drawScrollMountains,
  drawMistRibbons,
  drawInkRipples,
  drawMaYuanWaves,
  drawWeatherParticles,
  drawQiYunTrail,
  drawTaijiInkArray,
  drawScholarRock,
  drawInkBamboo,
  drawInkPine,
  drawInkPlumBranch,
  drawInkLotus,
  drawInkReeds,
  drawInkBridge,
  drawInkPavilion,
  drawInkBoat,
  drawInkBird,
  drawInkFish,
  drawInkVessel,
  drawMasterBrush,
  drawCinnabarSeal,
  drawVerticalColophon,
  createInkCharacter,
  createInkScrollStage,
} from './kernel.js';

export default async function createWorld({ width = 1920, height = 1080, scenes = [], style = {} } = {}) {
  const studio = createInkScrollStage({
    width,
    height,
    scenes,
    look: style.look,
    looks: style.looks,
  });

  // -------------------------------------------------------------------------
  // Characters across the 4 scenes (distinct silhouettes, archetypes & props)
  // -------------------------------------------------------------------------
  const scholar = createInkCharacter({
    archetype: 'scholar',
    x: 520,
    y: 725,
    scale: 1.08,
    facing: 1,
    robeColor: INK_PALETTE.huaQing,
    sashColor: INK_PALETTE.zhuSha,
    hat: 'scholar',
    heldProp: 'cup',
  });

  const apprentice = createInkCharacter({
    archetype: 'child',
    x: 455,
    y: 660,
    scale: 1.0,
    facing: 1,
    robeColor: INK_PALETTE.shiLv,
    sashColor: INK_PALETTE.niJin,
    hat: 'topknot',
    heldProp: 'scroll',
  });

  const bridgeScholar = createInkCharacter({
    archetype: 'scholar',
    x: 565,
    y: 642,
    scale: 1.04,
    facing: 1,
    robeColor: INK_PALETTE.shiQing,
    sashColor: INK_PALETTE.zhuSha,
    hat: 'scholar',
    heldProp: 'fan',
  });

  const boatAngler = createInkCharacter({
    archetype: 'angler',
    x: 560,
    y: 690,
    scale: 1.0,
    facing: 1,
    robeColor: INK_PALETTE.zheShi,
    sashColor: INK_PALETTE.huaQing,
    hat: 'bamboo',
    heldProp: 'rod',
  });

  const qinMaster = createInkCharacter({
    archetype: 'musician',
    x: 960,
    y: 648,
    scale: 1.06,
    facing: 1,
    robeColor: INK_PALETTE.geFen,
    sashColor: INK_PALETTE.zhuSha,
    hat: 'scholar',
    heldProp: 'none',
  });

  // -------------------------------------------------------------------------
  // Shot-List Director (`studio.director`) — 2 contemplative shots per scene
  // with smooth intra-scene scroll gliding (`画卷平滑移镜`) and distinct progressions
  // -------------------------------------------------------------------------
  const director = studio.director({
    subjects: {
      // Scene 1 subjects
      teaTable: { x: 635, y: 665, w: 480, h: 300 },
      scholarAndCranes: { x: 860, y: 555, w: 1080, h: 620 },

      // Scene 2 subjects
      bridgePainting: { x: 920, y: 555, w: 980, h: 550 },
      qinglvPanorama: { x: 960, y: 540, w: 1740, h: 950 },

      // Scene 3 subjects
      autumnRiver: { x: 880, y: 600, w: 1620, h: 880 },
      grandLotus: { x: 1220, y: 650, w: 580, h: 360 },

      // Scene 4 subjects
      pavilionQin: { x: 960, y: 585, w: 760, h: 450 },
      moonScrollFinale: { x: 980, y: 525, w: 1680, h: 920 },
    },
    shots: {
      'act1-pine-tea': [
        { dur: 1.7, size: 'close', subject: 'teaTable', angle: -18, move: 'push' },
        { size: 'medium', subject: 'scholarAndCranes', angle: 22, move: 'track+rise' },
      ],
      'act2-brush-bridge': [
        { dur: 1.9, size: 'medium', subject: 'bridgePainting', angle: -18, move: 'track' },
        { size: 'wide', subject: 'qinglvPanorama', angle: 20, move: 'pull' },
      ],
      'act3-river-boat': [
        { dur: 1.85, size: 'wide', subject: 'autumnRiver', angle: -15, move: 'track' },
        { size: 'close', subject: 'grandLotus', angle: 22, move: 'push' },
      ],
      'act4-moon-pavilion': [
        { dur: 1.75, size: 'medium', subject: 'pavilionQin', angle: -18, move: 'push' },
        { size: 'full', subject: 'moonScrollFinale', angle: 22, move: 'pull+rise' },
      ],
    },
  });

  function renderScene1(ctx, width, height, frame, look, beginLayer, endLayer) {
    const localT = frame.localT ?? 0;
    const t = frame.t ?? 0;

    // Distant sun & parallax mountains
    beginLayer(0.25);
    drawCelestialBody(ctx, 1460, 235, 66, look);
    endLayer();

    drawScrollMountains(ctx, width, height, look, {
      camX: studio.camera.cx,
      camY: studio.camera.cy,
      withWaterfall: true,
      waterfallX: 1320,
    });
    drawMistRibbons(ctx, width, height, look, t, {
      camX: studio.camera.cx,
      camY: studio.camera.cy,
    });

    // Main stage layer (parallax = 1.0)
    beginLayer(1.0);

    // Water ripples across valley stream
    drawMaYuanWaves(ctx, 220, 740, 1520, 210, t, { alpha: 0.25 });
    drawInkRipples(ctx, 1180, 780, 185, 0.72);

    // Left bamboo grove swaying gently
    const bamboo = evalElasticCantilever(localT, 0.3, 1.1, 0.22);
    drawInkBamboo(ctx, 180, 980, {
      scale: 0.92,
      bend: bamboo.bend * 0.35,
      vib: bamboo.vib,
    });

    // Scholar's cliff terrace & welcoming pine tree
    drawScholarRock(ctx, 620, 725, { w: 460, h: 270, color: INK_PALETTE.huaQing, seed: 12 });
    drawInkPine(ctx, 420, 725, {
      scale: 1.05,
      sway: Math.sin(t * 1.4) * 0.02,
      needleColor: INK_PALETTE.shiLv,
    });

    // Stone tea table on the terrace + Celadon Teapot pouring into Teacup
    drawScholarRock(ctx, 710, 695, { w: 165, h: 52, color: INK_PALETTE.inkZhong, goldRim: true, seed: 19 });
    const pourProg = smootherstep(0.65, 2.35, localT);
    const potTilt = localT >= 0.55 && localT <= 2.45 ? Math.sin(clamp((localT - 0.55) / 1.9, 0, 1) * Math.PI) * 0.36 : 0;
    drawInkVessel(ctx, 665, 675, {
      kind: 'teapot',
      glaze: 'celadon',
      scale: 0.95,
      tilt: potTilt,
      pour: potTilt > 0.12 ? pourProg : 0,
      steam: smootherstep(0.3, 1.5, localT),
      t,
    });
    drawInkVessel(ctx, 760, 695, {
      kind: 'teacup',
      glaze: 'celadon',
      scale: 0.9,
      steam: smootherstep(1.2, 2.8, localT),
      t,
    });

    // Scholar acting
    scholar.act(localT, [
      { do: 'walk', from: 0.0, to: 1.1, fromX: 485, toX: 555, fromY: 725, toY: 725 },
      { do: 'drink', from: 1.1, to: 2.6, amount: 0.85 },
      { do: 'mood', from: 1.2, to: 3.6, mood: 'happy' },
    ]);
    scholar.draw(ctx, t);

    // Standing crane by the water + two cranes soaring across the valley
    drawInkBird(ctx, 1140, 775, { species: 'crane', pose: 'stand', scale: 0.92, flip: -1 });
    const flyU = clamp((localT - 0.2) / 3.2, 0, 1);
    const c1x = lerp(880, 1420, flyU);
    const c1y = lerp(610, 310, Math.pow(flyU, 0.85));
    drawQiYunTrail(
      ctx,
      [
        [880, 610],
        [1060, 485],
        [1240, 385],
        [1420, 310],
      ],
      { width: 14, alpha: 0.52, reveal: flyU, withDroplets: false }
    );
    drawInkBird(ctx, c1x, c1y, {
      species: 'crane',
      pose: 'fly',
      scale: 0.96,
      angle: -0.24,
      flapPhase: t * 6.5,
    });
    drawInkBird(ctx, c1x - 115, c1y + 58, {
      species: 'crane',
      pose: 'fly',
      scale: 0.82,
      angle: -0.2,
      flapPhase: t * 6.5 + 1.4,
    });

    // Poetic colophon in upper left (positioned inside both wide and medium framing)
    drawVerticalColophon(ctx, 325, 165, {
      lines: ['松风煮茗 · 鹤起云谷'],
      sealText: '清欢',
      reveal: smootherstep(0.2, 2.2, localT),
    });

    endLayer();
  }

  function renderScene2(ctx, width, height, frame, look, beginLayer, endLayer) {
    const localT = frame.localT ?? 0;
    const t = frame.t ?? 0;

    // Song blue-green (`qinglv`) mountains & cascading waterfall
    drawScrollMountains(ctx, width, height, look, {
      camX: studio.camera.cx,
      camY: studio.camera.cy,
      ampScale: 1.15,
      withWaterfall: true,
      waterfallX: 780,
      seed: 308,
    });
    drawMistRibbons(ctx, width, height, look, t, {
      camX: studio.camera.cx,
      camY: studio.camera.cy,
    });

    beginLayer(1.0);

    // Left bank rock & apprentice + scholar
    drawScholarRock(ctx, 495, 650, { w: 340, h: 280, color: INK_PALETTE.shiLv, seed: 21 });
    drawScholarRock(ctx, 1460, 655, { w: 360, h: 275, color: INK_PALETTE.shiQing, seed: 22 });

    // Live brush-painting of the Song stone arch bridge (`0.85s .. 2.55s`)
    const write = evalBrushWriteProgress(localT, 0.85, 1.7);
    const bridgeInfo = drawInkBridge(ctx, 980, 565, {
      span: 780,
      archDrop: 140,
      drawnProgress: 0.15 + 0.85 * write.progress,
      scale: 1.0,
    });

    // Suspended Master Wolf-Hair Brush sweeping across the bridge arch
    const brushDescend = smootherstep(0.15, 0.85, localT);
    const brushRetract = smootherstep(2.45, 3.25, localT);
    const trailFade = 1 - smootherstep(2.05, 2.6, localT);
    const bx = write.progress < 0.01 ? 660 : bridgeInfo.edgeX;
    const by =
      lerp(140, bridgeInfo.edgeY - 180, brushDescend) -
      brushRetract * 240 +
      (write.active ? Math.sin(localT * 14) * 12 : 0);
    const bAng = write.active ? 0.18 + Math.cos(localT * 12) * 0.22 : -0.18;

    if (brushRetract < 0.98) {
      if (trailFade > 0.02) {
        drawQiYunTrail(
          ctx,
          [
            [660, 565],
            [820, 495],
            [980, 470],
            [1160, 495],
            [1350, 565],
          ],
          { width: 16, alpha: 0.62 * trailFade, reveal: write.progress, seed: 44 }
        );
      }
      drawMasterBrush(ctx, bx, by, {
        angle: bAng,
        scale: 1.02,
        painting: write.active,
        t,
      });
    }

    // Characters walking onto the newly painted bridge
    apprentice.act(localT, [
      { do: 'walk', from: 0.1, to: 1.2, fromX: 410, toX: 485, fromY: 650, toY: 650 },
      { do: 'hop', at: 2.3, dur: 0.65, toX: 540, height: 48 },
      { do: 'mood', from: 1.8, to: 3.8, mood: 'happy' },
    ]);
    apprentice.draw(ctx, t);

    bridgeScholar.act(localT, [
      { do: 'walk', from: 0.0, to: 1.0, fromX: 515, toX: 590, fromY: 645, toY: 635 },
      { do: 'wave', from: 0.8, to: 2.2, amount: 0.9 },
      { do: 'walk', from: 2.35, to: 3.6, fromX: 590, toX: 880, fromY: 635, toY: 572 },
      { do: 'mood', from: 2.2, to: 3.8, mood: 'happy' },
    ]);
    bridgeScholar.draw(ctx, t);

    // Right cliff red plum blossoms blooming as the bridge completes!
    const plumBloom = smootherstep(1.9, 3.3, localT);
    drawInkPlumBranch(ctx, 1620, 645, {
      scale: 1.08,
      flip: -1,
      bloom: plumBloom,
      petalColor: INK_PALETTE.zhuSha,
    });

    drawWeatherParticles(ctx, width, height, t, {
      kind: 'petals',
      count: 24,
      alpha: 0.75 * plumBloom,
    });
    endLayer();
  }

  function renderScene3(ctx, width, height, frame, look, beginLayer, endLayer) {
    const localT = frame.localT ?? 0;
    const t = frame.t ?? 0;

    drawScrollMountains(ctx, width, height, look, {
      camX: studio.camera.cx,
      camY: studio.camera.cy,
      ampScale: 0.95,
      seed: 512,
    });
    drawMistRibbons(ctx, width, height, look, t, {
      camX: studio.camera.cx,
      camY: studio.camera.cy,
    });

    beginLayer(1.0);

    // Autumn river Ma Yuan waves & riverside reeds
    drawMaYuanWaves(ctx, 140, 660, 1640, 280, t, {
      color: INK_PALETTE.huaQing,
      alpha: 0.3,
    });
    drawInkReeds(ctx, 240, 825, { count: 9, scale: 1.05, t });
    drawInkReeds(ctx, 1640, 815, { count: 8, scale: 0.98, t: t + 1.2 });

    // Splashed-ink mud-gold lotus pads across the pond
    drawInkLotus(ctx, 790, 765, { kind: 'pad', scale: 0.9, withRipples: true, seed: 2 });
    drawInkLotus(ctx, 1040, 785, { kind: 'pad', scale: 1.08, withRipples: true, seed: 5 });
    drawInkLotus(ctx, 920, 650, { kind: 'bud', scale: 0.88 });

    // Wooden skiff with angler gliding across the left-center river
    const bob = evalBoatBob(t, 1.3, 6.0);
    const boatX = lerp(450, 610, smootherstep(0, 3.6, localT));
    const boatY = 720 + bob.dy;

    boatAngler.act(localT, [
      { do: 'row', from: 0.0, to: 3.8 },
      { do: 'mood', from: 1.5, to: 3.8, mood: 'happy' },
    ]);
    boatAngler.state.x = boatX + 28;
    boatAngler.state.y = boatY - 6;
    boatAngler.draw(ctx, t);

    drawInkBoat(ctx, boatX, boatY, {
      scale: 1.04,
      tilt: bob.tilt,
      withCanopy: true,
      withLantern: true,
    });

    // Twin Cinnabar Koi leaping in a Yin-Yang arc (`0.8s .. 2.8s`)
    const koiU = clamp((localT - 0.65) / 2.1, 0, 1);
    if (koiU > 0.01 && koiU < 0.99) {
      const arcY = Math.sin(koiU * Math.PI) * 155;
      const k1x = lerp(860, 1220, koiU);
      const k1y = 735 - arcY;
      const k1Ang = Math.atan2(-Math.cos(koiU * Math.PI) * 155 * Math.PI, 360);

      drawInkRipples(ctx, 960, 745, 165, 0.72);
      drawQiYunTrail(
        ctx,
        [
          [860, 735],
          [980, 585],
          [1110, 585],
          [1220, 720],
        ],
        { width: 16, alpha: 0.72, reveal: koiU, seed: 91 }
      );
      drawInkFish(ctx, k1x, k1y, {
        length: 156,
        angle: k1Ang,
        color: INK_PALETTE.zhuSha,
        swimPhase: t * 12,
      });
      drawInkFish(ctx, k1x - 95, k1y + 48, {
        length: 132,
        angle: k1Ang * 0.85,
        color: INK_PALETTE.inkNong,
        bellyColor: INK_PALETTE.huaQingLight,
        swimPhase: t * 12 + 1.5,
      });
    }

    // Taiji ink array purifying the water & unfurling the Grand Blooming Ink Lotus (`1.5s .. 3.8s`)
    const taijiAlpha = localT >= 1.35 && localT <= 2.95 ? Math.sin(clamp((localT - 1.35) / 1.6, 0, 1) * Math.PI) : 0;
    if (taijiAlpha > 0.02) {
      drawTaijiInkArray(ctx, 1290, 725, 165, -t * 3.2, taijiAlpha * 0.85, { scaleY: 0.36 });
    }

    const lotusRise = smootherstep(1.55, 2.55, localT);
    const lotusOpen = smootherstep(2.05, 3.25, localT);
    if (lotusRise > 0.02) {
      drawInkLotus(ctx, 1290, 695 + (1 - lotusRise) * 85, {
        kind: 'throne',
        scale: 1.18,
        rise: lotusRise,
        open: lotusOpen,
        withRipples: true,
        seed: 42,
      });
    }

    endLayer();
  }

  function renderScene4(ctx, width, height, frame, look, beginLayer, endLayer) {
    const localT = frame.localT ?? 0;
    const t = frame.t ?? 0;

    // Luminous full moon in upper right sky
    beginLayer(0.22);
    drawCelestialBody(ctx, 1380, 225, 78, look, { kind: 'moon' });
    endLayer();

    drawScrollMountains(ctx, width, height, look, {
      camX: studio.camera.cx,
      camY: studio.camera.cy,
      ampScale: 1.12,
      seed: 909,
    });
    drawMistRibbons(ctx, width, height, look, t, {
      camX: studio.camera.cx,
      camY: studio.camera.cy,
    });

    beginLayer(1.0);

    // Summit cliff terrace, cliffside pines & lit flying-eave pavilion
    drawScholarRock(ctx, 960, 680, {
      w: 580,
      h: 340,
      color: INK_PALETTE.huaQing,
      cunfa: 'fupi',
      goldRim: true,
      seed: 77,
    });
    drawInkPine(ctx, 690, 685, {
      scale: 1.02,
      flip: -1,
      sway: Math.sin(t * 1.2) * 0.02,
      needleColor: INK_PALETTE.shiLv,
    });
    drawInkPlumBranch(ctx, 1230, 675, {
      scale: 0.95,
      flip: 1,
      bloom: 1.0,
      petalColor: INK_PALETTE.yanZhi,
    });

    drawInkPavilion(ctx, 960, 680, {
      scale: 1.18,
      tiers: 2,
      lit: true,
    });

    // Musician playing the 7-string Guqin inside the lit pavilion
    qinMaster.act(localT, [
      { do: 'playQin', from: 0.0, to: 3.6 },
      { do: 'mood', from: 0.0, to: 3.6, mood: 'happy' },
    ]);
    qinMaster.draw(ctx, t);
    drawInkVessel(ctx, 985, 622, { kind: 'qin', scale: 0.72, steam: 0.75, t });

    // Soaring cranes ascending toward the full moon
    const craneU = smootherstep(0.2, 3.4, localT);
    drawInkBird(ctx, lerp(1120, 1340, craneU), lerp(480, 260, craneU), {
      species: 'crane',
      pose: 'fly',
      scale: 0.9,
      angle: -0.32,
      flapPhase: t * 6.0,
    });
    drawInkBird(ctx, lerp(1040, 1255, craneU), lerp(535, 315, craneU), {
      species: 'crane',
      pose: 'fly',
      scale: 0.76,
      angle: -0.28,
      flapPhase: t * 6.0 + 1.6,
    });

    // Rising mud-gold acoustic motes
    drawWeatherParticles(ctx, width, height, t, {
      kind: 'gold-motes',
      count: 34,
      alpha: 0.88,
    });

    // Final Cinnabar Seal Stamp (`山高水长`) & Colophon (`1.8s .. 3.6s`)
    const sealProg = smootherstep(1.75, 2.55, localT);
    drawVerticalColophon(ctx, 320, 165, {
      lines: ['四时丹青 · 意在笔先', '月满孤亭 · 山高水长'],
      sealText: '雅集',
      color: INK_PALETTE.geFen,
      fontSize: 26,
      reveal: smootherstep(0.5, 2.3, localT),
    });
    if (sealProg > 0.02) {
      drawCinnabarSeal(ctx, 1545, 585, {
        size: 132,
        text: '山高水长',
        stampProgress: sealProg,
        withShockwave: true,
      });
    }

    endLayer();
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
