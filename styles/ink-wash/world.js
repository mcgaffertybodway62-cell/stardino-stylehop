/**
 * Ink Wash Scroll · Du Fu "Chun Wang" 5-Scene Classical Poem Handscroll (`styles/ink-wash/world.js`).
 *
 * Story: 唐 · 杜甫《春望》
 *   - Act 1 (`act1-ruined-wall`, 4.8s, `shanshui`): 国破山河 · 断垣深草
 *   - Act 2 (`act2-tear-blossom`, 4.5s, `xieyi`): 感时花泪 · 恨别惊禽
 *   - Act 3 (`act3-beacon-letter`, 4.6s, `night`): 烽火三月 · 家书万金
 *   - Act 4 (`act4-white-hairpin`, 5.0s, `snow`): 白头搔短 · 浑不胜簪
 *   - Act 5 (`act5-eternal-void`, 5.5s, `shanshui`): 山河终古 · 少陵春望
 *
 * Architectural Rule:
 *   Imports ONLY `../../engine/motion.js`, `../../engine/studio2d.js`, and `./kernel.js`.
 *   Zero Star-Spark Slime mascot.
 */

import { clamp, lerp, smootherstep } from "../../engine/motion.js";
import { recordSceneElement2D } from "../../engine/studio2d.js";
import {
  INK_PALETTE,
  TONE,
  LOAD,
  stroke,
  drawInkMass,
  drawInkBlot,
  ridgeFn,
  drawRidgeLayer,
  drawCliffFace,
  drawCelestialBody,
  drawMistRibbons,
  drawInkRipples,
  drawMaYuanWaves,
  drawInkBloom,
  drawInkSplatter,
  drawWeatherParticles,
  drawInkWillow,
  drawInkBird,
  drawCinnabarSeal,
  drawCalligraphicVerse,
  createInkCharacter,
  createInkScrollStage,
  evalElasticCantilever,
  mixHex,
  mulberry32,
  rgba,
} from "./kernel.js";

/**
 * 杜甫《春望》 · 水墨丹青五幕动画长卷 (`chunwang-world.js` · 导演精修版)
 *
 * 原文（唐 · 杜甫《春望》，天宝十五载 / 至德二载困守长安作）：
 *   国破山河在，城春草木深。
 *   感时花溅泪，恨别鸟惊心。
 *   烽火连三月，家书抵万金。
 *   白头搔更短，浑欲不胜簪。
 *
 * 五幕视觉与运镜编排（严守 `styles/ink-wash/SPEC.md` 一幕一构图 · 计白当黑 · 墨分五色）：
 *   - Act 1 (`act1-ruined-wall`, 4.8s, `shanshui`): 远山亘古，残破长安拱券城门、断垣旧旌与疯长春柳荒草，诗人缓步穿行驻足。
 *   - Act 2 (`act2-tear-blossom`, 4.5s, `xieyi`): 铁骨老枝残红临水，花尖墨泪坠入春水晕开涟漪，屏息后孤雀以曲折飞白破空惊起。
 *   - Act 3 (`act3-beacon-letter`, 4.6s, `night`): 0.48s 蓄力死寂 -> 远近递进千里烽燧破墨斜卷冲霄，竹轴尺素家书逆风翻飞，狂草砸纸。
 *   - Act 4 (`act4-white-hairpin`, 5.0s, `snow`): 梁楷写意人物半身特写——老杜沧桑眉须、霜鬓飞白，抬手搔首长叹，白玉簪滑脱坠落石栏。
 *   - Act 5 (`act5-eternal-void`, 5.5s, `shanshui`): 2.30x 散发背影立于苍崖 -> 平稳拉远至 1.0x 七分宣纸留白万里山河，钤「少陵野老」印。
 */


export default async function createWorld({ width = 1920, height = 1080, scenes = [], style = {} } = {}) {
  const studio = createInkScrollStage({
    width,
    height,
    scenes,
    look: style.look,
    looks: style.looks,
  });

  // ---------------------------------------------------------------------------
  // 1. 角色定义（远景与越肩背影采用 26 关节木偶，第四幕半身特写采用专属梁楷写意关节肖像）
  // ---------------------------------------------------------------------------
  const duFuAct1 = createInkCharacter({
    id: 'dufu_act1',
    archetype: 'scholar',
    renderMode: 'xieyi',
    view: 'side',
    x: 1090,
    y: 806,
    scale: 0.72,
    facing: -1,
    robeColor: INK_PALETTE.huaQing,
    sashColor: INK_PALETTE.zhuSha,
    hat: 'topknot',
    heldProp: 'staff',
  });

  const duFuAct5 = createInkCharacter({
    id: 'dufu_act5',
    archetype: 'scholar',
    renderMode: 'xieyi',
    view: 'back',
    x: 785,
    y: 766,
    scale: 0.78,
    facing: 1,
    robeColor: INK_PALETTE.huaQing,
    sashColor: INK_PALETTE.zhuSha,
    hat: 'none',
    heldProp: 'none',
  });

  // ---------------------------------------------------------------------------
  // 2. 五幕导演运镜表 (`studio.director`)
  // ---------------------------------------------------------------------------
  const director = studio.director({
    subjects: {
      ruinedChangAn: { x: 960, y: 560, w: 1600, h: 900 },
      tearBlossom: { x: 760, y: 520, w: 1200, h: 760 },
      beaconSmoke: { x: 980, y: 500, w: 1600, h: 920 },
      agingPoet: { x: 840, y: 600, w: 1100, h: 780 },
      eternalMountains: { x: 960, y: 560, w: 1800, h: 980 },
    },
    shots: {
      'act1-ruined-wall': {
        size: 'wide',
        move: 'pan',
        panFrom: [52, 0],
        panTo: [-52, 0],
        subject: 'ruinedChangAn',
        sampleAt: 3.6,
      },
      'act2-tear-blossom': {
        size: 'extreme-close',
        move: 'push',
        zoomFrom: 1.0,
        zoomTo: 1.07,
        panFrom: [-16, 8],
        panTo: [22, -14],
        subject: 'tearBlossom',
        sampleAt: 2.95,
      },
      'act3-beacon-letter': {
        size: 'full',
        move: 'dramatic-push',
        zoomFrom: 1.0,
        zoomTo: 1.22,
        panFrom: [0, 18],
        panTo: [-24, -22],
        holdStart: 0.48,
        burstWindow: [0.48, 2.25],
        burstCurve: 'fast-out',
        unit: 'sec',
        subject: 'beaconSmoke',
        sampleAt: 2.95,
      },
      'act4-white-hairpin': {
        size: 'close',
        move: 'rise',
        zoomFrom: 1.05,
        zoomTo: 1.0,
        panFrom: [-12, -14],
        panTo: [14, 18],
        subject: 'agingPoet',
        sampleAt: 3.55,
      },
      'act5-eternal-void': {
        size: 'wide',
        move: 'reveal-pull',
        zoomFrom: 2.32,
        zoomTo: 1.0,
        panFrom: [-135, 132],
        panTo: [0, 0],
        holdStart: 1.05,
        burstWindow: [1.05, 4.35],
        unit: 'sec',
        vanish: [840, 645],
        subject: 'eternalMountains',
        sampleAt: 4.65,
      },
    },
  });

  // ---------------------------------------------------------------------------
  // 3. 专有水墨造型原语
  // ---------------------------------------------------------------------------

  const zhongnanFarRidge = ridgeFn(
    [
      [180, 195, 340],
      [620, 265, 420],
      [1180, 235, 390],
      [1660, 185, 360],
    ],
    435,
    107,
    22
  );
  const zhongnanMidRidge = ridgeFn(
    [
      [-40, 155, 290],
      [430, 185, 310],
      [1420, 175, 350],
      [1920, 145, 280],
    ],
    515,
    211,
    18
  );

  /**
   * 第一幕：长安沦陷后的崩裂夯土城门洞、残堞飞檐与褪色旧旌 (`国破`)
   */
  function drawRuinedChangAnWall(ctx, t) {
    // 左段城墙与残破拱券城门洞（左右两座城台夹出荒芜门洞）
    const outerLeftWall = [
      [-120, 835],
      [-95, 488],
      [25, 482],
      [44, 514],
      [108, 510],
      [126, 476],
      [238, 482],
      [272, 540],
      [278, 820],
    ];
    drawInkMass(ctx, outerLeftWall, {
      tone: 0.52,
      color: INK_PALETTE.inkNong,
      jitter: 3.4,
      seed: 31,
      grad: [120, 476, 120, 845, 1.0, 0.0],
    });

    // 城门右翼崩塌半边的夯土城台 (`x = 415 .. 715`)
    const innerGatePier = [
      [405, 815],
      [412, 542],
      [458, 502],
      [535, 508],
      [575, 568],
      [648, 638],
      [718, 795],
    ];
    drawInkMass(ctx, innerGatePier, {
      tone: 0.44,
      color: INK_PALETTE.inkNong,
      jitter: 3.2,
      seed: 32,
      grad: [530, 502, 550, 825, 1.0, 0.0],
    });

    // 半坍塌的拱券门楣石梁（连接左右城台，顶部断裂露空）
    stroke(
      ctx,
      [
        [248, 625],
        [292, 558],
        [342, 542],
      ],
      LOAD(18, TONE.jiao, [0, 1], { dry: 0.48, prof: 'brush', seed: 34 })
    );
    stroke(
      ctx,
      [
        [378, 554],
        [418, 618],
      ],
      LOAD(15, TONE.nong, [0, 1], { dry: 0.56, prof: 'nail', seed: 35 })
    );

    // 城堞与崩口斧劈皴勾勒
    stroke(
      ctx,
      [
        [-95, 488],
        [25, 482],
        [44, 514],
        [108, 510],
        [126, 476],
        [238, 482],
        [272, 540],
      ],
      LOAD(13, TONE.jiao, [0, 1], { dry: 0.54, prof: 'nail', seed: 36 })
    );
    stroke(
      ctx,
      [
        [412, 542],
        [458, 502],
        [535, 508],
        [575, 568],
        [648, 638],
      ],
      LOAD(15, TONE.nong, [-1, 1], { dry: 0.58, prof: 'brush', seed: 37 })
    );

    // 墙面纵横兵燹裂痕
    const cracks = [
      [[95, 512], [118, 595], [104, 692]],
      [[192, 495], [218, 578], [202, 665]],
      [[472, 520], [496, 612], [528, 705]],
    ];
    cracks.forEach((pts, idx) => {
      stroke(ctx, pts, { w: 5.0 - idx * 0.6, tone: TONE.jiao, dry: 0.68, prof: 'nail', seed: 40 + idx });
    });

    // 倾颓半塌的城楼焦墨残檐
    const eavePts = [
      [62, 478],
      [175, 424],
      [295, 408],
      [378, 434],
      [422, 416],
      [352, 464],
      [195, 472],
    ];
    drawInkMass(ctx, eavePts, { tone: 0.72, color: INK_PALETTE.inkJiao, jitter: 2.2, seed: 51 });
    stroke(
      ctx,
      [
        [46, 486],
        [185, 426],
        [312, 412],
        [428, 412],
      ],
      LOAD(10, TONE.jiao, [0, 1], { dry: 0.44, prof: 'brush', seed: 53 })
    );

    // 斜插断垣的折戟与褪色暗赭朱砂残旌（撕裂分叉旗尾，沉郁苍凉）
    const poleTopX = 556 + Math.sin(t * 1.8) * 2.5;
    const poleTopY = 408;
    stroke(ctx, [[525, 562], [542, 485], [poleTopX, poleTopY]], {
      w: 4.2,
      tone: TONE.jiao,
      dry: 0.36,
      prof: 'cone',
      seed: 59,
    });
    const flutter = Math.sin(t * 3.1) * 12;
    const rustRed = mixHex(INK_PALETTE.zhuSha, INK_PALETTE.zheShi, 0.38);
    stroke(
      ctx,
      [
        [poleTopX - 2, poleTopY + 14],
        [poleTopX - 58 - flutter * 0.4, poleTopY + 28 + flutter * 0.25],
        [poleTopX - 115 - flutter, poleTopY + 48 - flutter * 0.35],
      ],
      LOAD(22, 0.68, [0, 1], { dry: 0.56, prof: 'fan', color: rustRed, seed: 61 })
    );
    stroke(
      ctx,
      [
        [poleTopX - 12, poleTopY + 28],
        [poleTopX - 64 - flutter * 0.5, poleTopY + 52],
        [poleTopX - 102 - flutter * 0.9, poleTopY + 72 + flutter * 0.3],
      ],
      LOAD(11, 0.54, [0, 1], { dry: 0.66, prof: 'tip', color: rustRed, seed: 62 })
    );

    recordSceneElement2D(ctx, {
      id: 'ruinedWall',
      role: 'mid',
      layerZ: 0.68,
      kind: 'architecture',
      bbox: [-95, 408, 718, 835],
    });
  }

  /**
   * 绘制疯长深春荒草簇 (`城春草木深`)
   */
  function drawWildSpringGrassCluster(ctx, baseX, baseY, count, scale = 1.0, t = 0, seed = 101, color = INK_PALETTE.inkJiao) {
    const rng = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      const ox = (rng() - 0.5) * 210 * scale;
      const h = (58 + rng() * 118) * scale;
      const lean = (-0.38 + rng() * 0.88) * 62 * scale + Math.sin(t * 2.0 + i * 0.7 + seed) * 11 * scale;
      const sx = baseX + ox;
      const sy = baseY + (rng() - 0.5) * 16 * scale;
      stroke(
        ctx,
        [
          [sx, sy],
          [sx + lean * 0.44, sy - h * 0.55],
          [sx + lean, sy - h],
        ],
        LOAD((3.2 + rng() * 3.6) * scale, 0.44 + rng() * 0.44, [1, 0], {
          dry: 0.48 + rng() * 0.25,
          prof: 'tip',
          color: i % 3 === 0 ? mixHex(INK_PALETTE.shiLv, INK_PALETTE.inkZhong, 0.45) : color,
          seed: seed + i * 13,
        })
      );
    }
  }

  /**
   * 第二幕：临水铁骨老枝、没骨春花、花尖凝泪滴水成澜与曲折飞白惊雀 (`感时花溅泪，恨别鸟惊心`)
   */
  function drawTearBlossomAndStartledBird(ctx, t, localT) {
    const twigRecoil = evalElasticCantilever(localT, 2.34, 0.08, 0.68);
    const shakeY = twigRecoil.vib * 22 + Math.sin(t * 1.6) * 2.5;

    // 1. 铁骨老梅/海棠主干（顿挫曲折，宋人折枝法）
    const mainBough = [
      [-90, 860],
      [95, 745 + shakeY * 0.12],
      [265, 668 + shakeY * 0.25],
      [435, 562 + shakeY * 0.45],
      [645, 498 + shakeY * 0.68],
      [835, 442 + shakeY * 0.90],
      [1015, 398 + shakeY * 1.08],
    ];
    stroke(
      ctx,
      mainBough,
      LOAD(34, TONE.jiao, [0, 1], { dry: 0.54, prof: 'cone', seed: 201 }),
      smootherstep(0.0, 0.5, localT + 0.35)
    );

    // 垂向水面的含泪柔枝
    const tearDropBend =
      localT < 1.52
        ? smootherstep(0.3, 1.48, localT) * 15
        : Math.exp(-(localT - 1.52) * 5) * 15 * Math.cos((localT - 1.52) * 18);
    stroke(
      ctx,
      [
        [455, 558 + shakeY * 0.48],
        [575, 552 + shakeY * 0.62 + tearDropBend * 0.5],
        [686, 538 + shakeY * 0.75 + tearDropBend],
      ],
      LOAD(9.0, TONE.nong, [0, 1], { dry: 0.44, prof: 'tip', seed: 205 })
    );

    // 鹿角上挑副枝与嫩梢
    stroke(
      ctx,
      [
        [285, 654 + shakeY * 0.28],
        [355, 512 + shakeY * 0.45],
        [465, 385 + shakeY * 0.65],
        [545, 328 + shakeY * 0.75],
      ],
      LOAD(11.5, TONE.nong, [-1, 0], { dry: 0.58, prof: 'cone', seed: 209 })
    );
    stroke(
      ctx,
      [
        [355, 512 + shakeY * 0.45],
        [278, 435 + shakeY * 0.5],
      ],
      LOAD(6.5, TONE.zhong, [1, 0], { dry: 0.62, prof: 'tip', seed: 210 })
    );

    // 老干焦墨点苔
    for (let i = 0; i < 16; i++) {
      const u = i / 15;
      const bx = lerp(30, 810, u);
      const by = lerp(805, 452, Math.pow(u, 0.85)) + shakeY * u;
      drawInkBlot(ctx, bx, by - 5, 3.0 + (i % 3) * 1.5, TONE.jiao, i * 0.9, 0.65, 220 + i);
    }

    // 2. 没骨点染胭脂春花与含苞花蕾
    const drawMacroBlossom = (cx, cy, r, openScale = 1.0, seed = 1) => {
      const rng = mulberry32(seed);
      for (let p = 0; p < 5; p++) {
        const ang = (p / 5) * Math.PI * 2 - Math.PI * 0.5 + (rng() - 0.5) * 0.18;
        const px = cx + Math.cos(ang) * r * 0.64 * openScale;
        const py = cy + Math.sin(ang) * r * 0.64 * openScale;
        const pr = r * (0.52 + rng() * 0.12) * openScale;
        const petalPts = [];
        for (let k = 0; k < 8; k++) {
          const ka = (k / 8) * Math.PI * 2;
          petalPts.push([px + Math.cos(ka) * pr, py + Math.sin(ka) * pr * 0.88]);
        }
        drawInkMass(ctx, petalPts, {
          tone: p % 2 === 0 ? 0.78 : 0.58,
          color: p === 0 ? INK_PALETTE.zhuSha : INK_PALETTE.yanZhi,
          jitter: 1.8,
          seed: seed + p * 7,
        });
      }
      for (let s = 0; s < 6; s++) {
        const sa = (s / 6) * Math.PI * 2 + 0.3;
        stroke(
          ctx,
          [
            [cx, cy],
            [cx + Math.cos(sa) * r * 0.42, cy + Math.sin(sa) * r * 0.42],
          ],
          { w: 1.8, tone: TONE.jiao, dry: 0.2, prof: 'tip', seed: seed + 50 + s }
        );
        drawInkBlot(
          ctx,
          cx + Math.cos(sa) * r * 0.44,
          cy + Math.sin(sa) * r * 0.44,
          2.2,
          0.95,
          0,
          0.9,
          seed + 80 + s,
          INK_PALETTE.niJinBright
        );
      }
    };

    const mainFlowerX = 688;
    const mainFlowerY = 534 + shakeY * 0.75 + tearDropBend;
    drawMacroBlossom(mainFlowerX, mainFlowerY, 45, 1.0, 301);
    drawMacroBlossom(398, 468 + shakeY * 0.5, 34, 0.94, 311);
    drawMacroBlossom(475, 378 + shakeY * 0.65, 28, 0.88, 321);
    drawMacroBlossom(795, 452 + shakeY * 0.88, 31, 0.90, 331);
    // 两枚含苞红蕾
    drawInkBlot(ctx, 548, 326 + shakeY * 0.75, 9.5, 0.85, -0.4, 0.68, 335, INK_PALETTE.zhuSha);
    drawInkBlot(ctx, 276, 432 + shakeY * 0.5, 8.2, 0.82, -0.6, 0.68, 336, INK_PALETTE.yanZhi);

    // 3. 「花溅泪」：花尖墨胭脂泪珠凝坠 -> 落入下方留白春水，漾开层层水墨同心涟漪
    const petalTipX = mainFlowerX + 4;
    const petalTipY = mainFlowerY + 38;
    const waterSurfaceY = 858;

    if (localT >= 0.42 && localT < 1.52) {
      const swell = smootherstep(0.42, 1.48, localT);
      const rDrop = lerp(2.5, 10.8, swell);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(petalTipX, petalTipY - 4);
      ctx.bezierCurveTo(
        petalTipX - rDrop * 1.1,
        petalTipY + rDrop * 1.4,
        petalTipX - rDrop * 0.9,
        petalTipY + rDrop * 2.5,
        petalTipX,
        petalTipY + rDrop * 2.6
      );
      ctx.bezierCurveTo(
        petalTipX + rDrop * 0.9,
        petalTipY + rDrop * 2.5,
        petalTipX + rDrop * 1.1,
        petalTipY + rDrop * 1.4,
        petalTipX,
        petalTipY - 4
      );
      ctx.closePath();
      ctx.fillStyle = rgba(INK_PALETTE.zhuSha, 0.88);
      ctx.fill();
      ctx.fillStyle = rgba(INK_PALETTE.inkJiao, 0.58);
      ctx.beginPath();
      ctx.arc(petalTipX, petalTipY + rDrop * 1.8, rDrop * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (localT >= 1.52 && localT < 1.95) {
      const fallU = clamp((localT - 1.52) / 0.43, 0, 1);
      const dropY = lerp(petalTipY + 18, waterSurfaceY, fallU * fallU);
      stroke(
        ctx,
        [
          [petalTipX, Math.max(petalTipY, dropY - 78)],
          [petalTipX, dropY],
        ],
        { w: 3.0, tone: 0.46, dry: 0.38, prof: 'cone', color: INK_PALETTE.yanZhi, seed: 350 }
      );
      drawInkBlot(ctx, petalTipX, dropY, 9.5, 0.92, Math.PI * 0.5, 1.45, 351, INK_PALETTE.inkJiao);
      drawInkBlot(ctx, petalTipX, dropY - 4, 6.5, 0.85, Math.PI * 0.5, 1.35, 352, INK_PALETTE.zhuSha);
    }

    if (localT >= 1.92) {
      const bloomU = clamp((localT - 1.92) / 2.35, 0, 1);
      // 扁平透视的水中胭脂墨晕（贴合水面透视，绝无僵硬梯形）
      ctx.save();
      ctx.translate(petalTipX, waterSurfaceY);
      ctx.scale(1.0, 0.32);
      drawInkBloom(ctx, 0, 0, bloomU * 0.88, {
        maxRadius: 155,
        coreColor: INK_PALETTE.inkJiao,
        midColor: INK_PALETTE.yanZhi,
        edgeColor: INK_PALETTE.huaQing,
        alpha: 0.68 * (1 - bloomU * 0.22),
        seed: 361,
      });
      ctx.restore();

      drawInkRipples(ctx, petalTipX, waterSurfaceY, 245 * Math.pow(bloomU, 0.52), 0.86, INK_PALETTE.inkZhong);
      drawInkSplatter(ctx, petalTipX, waterSurfaceY - 4, {
        count: 10,
        spreadX: 72 * Math.pow(bloomU, 0.4),
        spreadY: 20 * Math.pow(bloomU, 0.4),
        colors: [INK_PALETTE.inkJiao, INK_PALETTE.zhuSha, INK_PALETTE.yanZhi],
        alpha: 0.72 * (1 - bloomU * 0.35),
        seed: 365,
      });
    }

    // 4. 「恨别鸟惊心」：栖枝屏息 -> 2.36s 破空惊起，留下婉转干笔游丝飞白气韵弧
    const perchX = 895;
    const perchY = 424 + shakeY * 0.98;
    if (localT < 2.36) {
      const nervous = localT > 1.82 ? Math.sin(localT * 38) * 1.8 : 0;
      const headTurn = localT > 1.95 ? -0.38 : 0.08;
      ctx.save();
      ctx.translate(perchX + nervous, perchY);
      stroke(ctx, [[-4, -2], [-2, 8]], { w: 2.0, tone: TONE.jiao, dry: 0.2, seed: 370 });
      stroke(ctx, [[5, -2], [6, 8]], { w: 2.0, tone: TONE.jiao, dry: 0.2, seed: 371 });
      drawInkMass(
        ctx,
        [
          [-24, -14],
          [-6, -34],
          [18, -28],
          [24, -10],
          [4, 2],
          [-18, -2],
        ],
        { tone: 0.86, color: INK_PALETTE.inkJiao, jitter: 1.6, seed: 372 }
      );
      stroke(ctx, [[-20, -8], [-58, 18], [-82, 34]], LOAD(6.5, TONE.jiao, [0, 1], { dry: 0.55, prof: 'nail', seed: 373 }));
      ctx.save();
      ctx.translate(16, -30);
      ctx.rotate(headTurn);
      drawInkBlot(ctx, 0, 0, 9.5, TONE.jiao, -0.2, 0.88, 374);
      stroke(ctx, [[7, -2], [20, -5]], { w: 2.6, tone: TONE.jiao, dry: 0.1, prof: 'cone', seed: 375 });
      ctx.fillStyle = INK_PALETTE.geFen;
      ctx.beginPath();
      ctx.arc(3, -2, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.restore();
    } else {
      const flyU = clamp((localT - 2.36) / 1.95, 0, 1);
      const easeFly = 1 - Math.pow(1 - flyU, 2.3);
      // 富有生命律动的上扬弧形飞行轨迹
      const bx = lerp(perchX, 1585, easeFly);
      const by = lerp(perchY - 18, 125, Math.pow(easeFly, 0.82)) - Math.sin(easeFly * Math.PI) * 52;

      // 婉转双缕干笔飞白惊风痕（绝非生硬直线）
      const trailAlpha = clamp(1.15 - flyU * 0.92, 0, 0.62);
      if (trailAlpha > 0.03) {
        stroke(
          ctx,
          [
            [perchX + 12, perchY - 14],
            [perchX + 175, perchY - 125],
            [perchX + 385, perchY - 195],
            [bx - 42, by + 18],
          ],
          { w: 9.5, tone: 0.36 * trailAlpha, dry: 0.84, prof: 'tip', color: INK_PALETTE.inkZhong, seed: 380 },
          clamp(flyU * 1.8, 0, 1),
          trailAlpha
        );
        stroke(
          ctx,
          [
            [perchX + 35, perchY + 4],
            [perchX + 225, perchY - 88],
            [bx - 65, by + 34],
          ],
          { w: 5.5, tone: 0.26 * trailAlpha, dry: 0.88, prof: 'tip', color: INK_PALETTE.inkDan, seed: 382 },
          clamp(flyU * 1.6, 0, 1),
          trailAlpha
        );
      }

      drawInkBird(ctx, bx, by, {
        species: 'swallow',
        pose: 'fly',
        scale: lerp(1.12, 0.72, easeFly),
        angle: -0.38 + easeFly * 0.16,
        flapPhase: (localT - 2.36) * 19.0,
      });

      // 惊飞震落的纷飞花瓣
      const rng = mulberry32(390);
      for (let p = 0; p < 11; p++) {
        const px0 = 490 + rng() * 440;
        const py0 = 395 + rng() * 155;
        const dt = Math.max(0, localT - 2.36 - rng() * 0.25);
        const px = px0 + dt * (58 + rng() * 68) + Math.sin(dt * 4 + p) * 20;
        const py = py0 + dt * (82 + rng() * 55);
        drawInkBlot(
          ctx,
          px,
          py,
          5.0 + rng() * 3.8,
          0.80,
          dt * 3 + p,
          0.55,
          400 + p,
          p % 2 === 0 ? INK_PALETTE.zhuSha : INK_PALETTE.yanZhi
        );
      }
    }
  }

  /**
   * 第三幕：主次分明、疾风斜卷的千里连绵烽燧破墨狼烟 + 竹轴尺素家书 (`烽火连三月，家书抵万金`)
   */
  function drawBeaconSmokeAndSilkLetter(ctx, t, localT) {
    // 四座由近及远蜿蜒向群山深处的烽燧台（近大远小、斜风狂卷，打破呆板平行柱）
    const beacons = [
      { x: 485, baseY: 692, maxH: 720, w: 175, windDX: 340, delay: 0.00, scale: 1.05, seed: 501 },
      { x: 935, baseY: 612, maxH: 580, w: 125, windDX: 255, delay: 0.09, scale: 0.78, seed: 511 },
      { x: 1265, baseY: 566, maxH: 430, w: 88, windDX: 185, delay: 0.17, scale: 0.56, seed: 521 },
      { x: 1415, baseY: 542, maxH: 275, w: 54, windDX: 105, delay: 0.24, scale: 0.36, seed: 531 },
    ];

    for (const tw of beacons) {
      const sc = tw.scale;
      // 夯土烽燧台基座
      drawInkMass(
        ctx,
        [
          [tw.x - 48 * sc, tw.baseY + 72 * sc],
          [tw.x - 32 * sc, tw.baseY - 14 * sc],
          [tw.x + 32 * sc, tw.baseY - 14 * sc],
          [tw.x + 50 * sc, tw.baseY + 72 * sc],
        ],
        { tone: 0.85, color: INK_PALETTE.inkJiao, jitter: 2.0 * sc, seed: tw.seed }
      );

      const burstActive = localT >= 0.48 + tw.delay;
      const emberPulse = burstActive ? 1.0 + 0.25 * Math.sin(t * 11 + tw.seed) : 0.42 + 0.14 * Math.sin(t * 5);
      const fireR = (burstActive ? 105 : 36) * sc * emberPulse;
      const fg = ctx.createRadialGradient(tw.x, tw.baseY - 16 * sc, 3, tw.x, tw.baseY - 16 * sc, fireR);
      fg.addColorStop(0.0, rgba(INK_PALETTE.niJinBright, burstActive ? 0.96 : 0.72));
      fg.addColorStop(0.38, rgba(INK_PALETTE.zhuSha, burstActive ? 0.82 : 0.44));
      fg.addColorStop(1.0, rgba(INK_PALETTE.zhuSha, 0));
      ctx.save();
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(tw.x, tw.baseY - 16 * sc, fireR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (burstActive) {
        const uErupt = clamp((localT - (0.48 + tw.delay)) / 1.48, 0, 1);
        const rise = 1 - Math.pow(1 - uErupt, 2.6);
        const curH = tw.maxH * rise;
        const turb1 = Math.sin(t * 2.1 + tw.seed) * 26 * sc;
        const turb2 = Math.cos(t * 1.5 + tw.seed) * 38 * sc;
        const dxMid = tw.windDX * 0.36 * rise + turb1;
        const dxTop = tw.windDX * rise + turb2;

        // S形斜卷破墨狼烟团块
        const smokePoly = [
          [tw.x - 24 * sc, tw.baseY - 14 * sc],
          [tw.x + dxMid - tw.w * 0.45, tw.baseY - curH * 0.44],
          [tw.x + dxTop - tw.w * 0.88, tw.baseY - curH * 0.86],
          [tw.x + dxTop + tw.w * 0.15, tw.baseY - curH * 1.04],
          [tw.x + dxTop + tw.w * 0.92, tw.baseY - curH * 0.78],
          [tw.x + dxMid + tw.w * 0.48, tw.baseY - curH * 0.36],
          [tw.x + 24 * sc, tw.baseY - 14 * sc],
        ];
        drawInkMass(ctx, smokePoly, {
          tone: 0.74 * (0.65 + 0.35 * sc),
          color: INK_PALETTE.inkJiao,
          jitter: 6.8 * sc,
          seed: tw.seed + 3,
          grad: [tw.x, tw.baseY - 14 * sc, tw.x + dxTop, tw.baseY - curH, 1.0, 0.16],
        });

        // 狂劲侧锋飞白龙脊笔触
        stroke(
          ctx,
          [
            [tw.x, tw.baseY - 14 * sc],
            [tw.x + dxMid * 0.85, tw.baseY - curH * 0.42],
            [tw.x + dxTop * 0.82, tw.baseY - curH * 0.78],
            [tw.x + dxTop + tw.w * 0.25, tw.baseY - curH],
          ],
          LOAD(tw.w * 0.62, TONE.jiao, [-1, 1], {
            dry: 0.58,
            wet: 0.88,
            prof: 'fan',
            color: INK_PALETTE.inkJiao,
            seed: tw.seed + 9,
          }),
          clamp(uErupt * 1.35, 0, 1)
        );
      }
    }

    // 前景逆风飘卷的「竹轴尺素家书」（两端紫竹卷轴 + 飘拂朱丝系带 + 竖行草书墨迹 + 朱砂平安小印）
    const letterEnter = smootherstep(0.58, 1.75, localT);
    if (letterEnter > 0.01) {
      const lx = lerp(1240, 740, smootherstep(0.55, 4.45, localT));
      const ly = lerp(858, 742, smootherstep(0.55, 4.45, localT)) + Math.sin(t * 2.8) * 12;
      const wA = Math.sin(t * 3.5) * 16;
      const wB = Math.cos(t * 3.0 + 1.1) * 18;

      const pTL = [lx - 215, ly + 18 + wA * 0.4];
      const pBL = [lx - 196, ly + 112 + wA * 0.4];
      const pTR = [lx + 215, ly - 36 + wB * 0.4];
      const pBR = [lx + 234, ly + 58 + wB * 0.4];

      const topEdge = [
        pTL,
        [lx - 72, ly - 28 - wB * 0.5],
        [lx + 82, ly + 8 + wA * 0.6],
        pTR,
      ];
      const botEdge = [
        pBR,
        [lx + 98, ly + 102 + wA * 0.6],
        [lx - 56, ly + 66 - wB * 0.5],
        pBL,
      ];

      ctx.save();
      ctx.globalAlpha = letterEnter;

      const glow = ctx.createRadialGradient(lx, ly + 36, 14, lx, ly + 36, 285);
      glow.addColorStop(0.0, rgba(INK_PALETTE.xuanWarm, 0.42));
      glow.addColorStop(1.0, rgba(INK_PALETTE.xuanWarm, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lx, ly + 36, 285, 0, Math.PI * 2);
      ctx.fill();

      // 温润宣纸信笺卷面
      drawInkMass(ctx, [...topEdge, ...botEdge], {
        tone: 0.96,
        color: INK_PALETTE.xuanWarm,
        jitter: 1.5,
        seed: 560,
      });
      stroke(ctx, topEdge, { w: 2.8, tone: 0.85, dry: 0.35, color: INK_PALETTE.inkJiao, seed: 561 });
      stroke(ctx, botEdge.slice().reverse(), { w: 2.6, tone: 0.78, dry: 0.4, color: INK_PALETTE.inkJiao, seed: 562 });

      // 左右两端湘妃竹信轴 (`竹轴`)
      stroke(
        ctx,
        [
          [pTL[0] - 3, pTL[1] - 8],
          [pBL[0] + 3, pBL[1] + 8],
        ],
        { w: 9.5, tone: 0.94, dry: 0.22, prof: 'even', color: INK_PALETTE.zheShi, seed: 563 }
      );
      stroke(
        ctx,
        [
          [pTR[0] - 3, pTR[1] - 8],
          [pBR[0] + 3, pBR[1] + 8],
        ],
        { w: 8.5, tone: 0.92, dry: 0.22, prof: 'even', color: INK_PALETTE.zheShi, seed: 564 }
      );

      // 信轴一端迎风飞舞的朱砂丝绦（与烽火朱砂遥相呼应）
      stroke(
        ctx,
        [
          [(pTL[0] + pBL[0]) * 0.5, (pTL[1] + pBL[1]) * 0.5],
          [pTL[0] - 65, pTL[1] + 58 + wB * 0.8],
          [pTL[0] - 135, pTL[1] + 82 - wA * 0.9],
        ],
        { w: 3.6, tone: 0.92, dry: 0.28, prof: 'tip', color: INK_PALETTE.zhuSha, seed: 565 }
      );

      // 信笺内错落有致的行草家书字迹点画（非生硬竖线）
      const rng = mulberry32(575);
      for (let col = -3; col <= 3; col++) {
        const baseColX = lx + col * 44;
        const waveOff = Math.sin(col * 0.85 + t * 3.1) * 10 - col * 6;
        for (let chIdx = 0; chIdx < 4; chIdx++) {
          const cy = ly + 6 + chIdx * 17 + waveOff;
          const cw = 6 + rng() * 5;
          stroke(
            ctx,
            [
              [baseColX - cw * 0.5, cy],
              [baseColX + cw * 0.4, cy + 4],
              [baseColX - cw * 0.2, cy + 10],
            ],
            { w: 2.1, tone: 0.68, dry: 0.45, prof: 'brush', color: INK_PALETTE.inkJiao, seed: 580 + col * 10 + chIdx }
          );
        }
      }
      // 信末朱砂小方印
      ctx.fillStyle = rgba(INK_PALETTE.zhuSha, 0.9);
      ctx.fillRect(lx - 148, ly + 66 + wA * 0.25, 13, 13);

      // 掠过信笺的寒风飞白气韵线
      stroke(
        ctx,
        [
          [lx + 330, ly - 58],
          [lx + 35, ly + 12],
          [lx - 295, ly + 92],
        ],
        { w: 6.5, tone: 0.36, dry: 0.84, prof: 'tip', color: INK_PALETTE.geFen, seed: 590 }
      );
      ctx.restore();
    }
  }

  /**
   * 第四幕核心：梁楷/宋元写意人物半身大特写 (`drawAgingDuFuCloseUp`)
   * 彻底取代远景小比例无脸人偶，以 520px 半身写意笔墨刻画沧桑眉目、稀疏白发、抬手搔首与白玉簪滑落石栏！
   */
  function drawAgingDuFuCloseUp(ctx, t, localT) {
    // 动作时间曲线：
    // 0.0..1.85s 缓抬右手至发髻搔首 -> 1.85..2.35s 触及稀疏白发微颤 -> 2.35..4.9s 无力垂手俯首长叹
    const reachUp = smootherstep(0.12, 1.65, localT) * (1 - smootherstep(2.15, 3.65, localT));
    const sighBow = smootherstep(1.95, 3.75, localT);
    const breath = Math.sin(t * 1.7) * 3.0;
    const wind = Math.sin(t * 2.2) * 11.0;

    const baseX = 685;
    const parapetY = 884; // 前景不透明石栏顶沿

    ctx.save();

    // 1. 杜甫苍老半身躯干（站立于石栏内侧，衣襟没入 y = 884 石栏之后）
    const torsoTilt = -0.04 + sighBow * 0.14; // 叹息时微微俯身佝偻
    ctx.save();
    ctx.translate(baseX, parapetY + 25);
    ctx.rotate(torsoTilt);

    // 宽博花青灰布衣袍底染 (`没骨淡墨花青衣身`)
    drawInkMass(
      ctx,
      [
        [-155, 10],
        [-132, -235],
        [-58, -328],
        [45, -332],
        [128, -225],
        [156, 10],
      ],
      {
        tone: 0.48,
        color: mixHex(INK_PALETTE.huaQing, INK_PALETTE.inkZhong, 0.55),
        jitter: 3.2,
        seed: 601,
      }
    );
    // 左肩与后背浑厚侧锋浓墨衣廓（梁楷减笔折芦描）
    stroke(
      ctx,
      [
        [-52, -326],
        [-128, -238],
        [-152, -95],
        [-162, 10],
      ],
      LOAD(26, TONE.jiao, [-1, 0], { dry: 0.48, prof: 'robe', seed: 602 })
    );
    // 交领右衽书生内襟（蛤粉素白内领衬托憔悴面容）
    drawInkMass(
      ctx,
      [
        [-32, -335],
        [38, -338],
        [68, -215],
        [8, -205],
      ],
      { tone: 0.92, color: INK_PALETTE.geFen, jitter: 1.4, seed: 603 }
    );
    stroke(ctx, [[-26, -332], [28, -245], [52, -175]], LOAD(12, TONE.nong, [1, 0], { dry: 0.42, prof: 'brush', seed: 604 }));
    stroke(ctx, [[36, -336], [66, -225], [32, -165]], LOAD(10, TONE.jiao, [-1, 0], { dry: 0.46, prof: 'brush', seed: 605 }));
    // 腰间一缕暗红系带微露
    stroke(ctx, [[-25, -82], [45, -76], [92, -64]], LOAD(11, 0.78, [0, 1], { dry: 0.36, color: INK_PALETTE.zhuSha, seed: 606 }));

    // 2. 俯首沧桑头部（3/4 侧面朝右，清癯面庞、深锁愁眉、花白长须与稀疏白发髻）
    const headPivotX = 8;
    const headPivotY = -342 + breath * 0.5;
    const headPitch = 0.05 + sighBow * 0.22 - reachUp * 0.06;

    ctx.save();
    ctx.translate(headPivotX, headPivotY);
    ctx.rotate(headPitch);

    // 面部温润淡赭清墨底色
    drawInkMass(
      ctx,
      [
        [-48, -108],
        [24, -116],
        [64, -76],
        [68, -22],
        [48, 22],
        [-12, 26],
        [-52, -28],
      ],
      {
        tone: 0.88,
        color: '#EAE2D3',
        jitter: 1.6,
        seed: 610,
      }
    );

    // 前额、高耸鼻梁与瘦削面颊的中锋枯笔勾勒
    stroke(
      ctx,
      [
        [46, -96],
        [54, -66],
        [69, -38], // 鼻尖微钩
        [56, -26],
        [58, -4],
        [42, 18],
      ],
      { w: 3.4, tone: TONE.jiao, dry: 0.32, prof: 'brush', seed: 611 }
    );
    // 颧骨清墨瘦影
    stroke(ctx, [[18, -36], [38, -24], [46, -8]], LOAD(10, TONE.qing, [0, 1], { dry: 0.55, seed: 612 }));

    // 深锁的八字愁眉与微阖悲悯眼眸
    stroke(ctx, [[22, -64], [42, -68], [58, -60]], {
      w: 4.6,
      tone: TONE.jiao,
      dry: 0.38,
      prof: 'nail',
      seed: 613,
    });
    // 眼尾忧思鱼尾细纹
    stroke(ctx, [[18, -53], [36, -54], [48, -50]], {
      w: 2.8,
      tone: TONE.jiao,
      dry: 0.2,
      prof: 'tip',
      seed: 614,
    });
    stroke(ctx, [[18, -53], [6, -48]], { w: 1.6, tone: TONE.zhong, dry: 0.5, seed: 615 });

    // 随寒风微拂的花白胡须（淡墨底 + 蛤粉飞白银须）
    const beardSway = wind * 0.45;
    for (let b = 0; b < 5; b++) {
      const bx0 = 38 + b * 4;
      const by0 = 4 + b * 3;
      stroke(
        ctx,
        [
          [bx0, by0],
          [bx0 + 8 - beardSway * 0.4, by0 + 42],
          [bx0 - 4 - beardSway, by0 + 88 + (b % 2) * 14],
        ],
        {
          w: 3.2 - b * 0.3,
          tone: b % 2 === 0 ? 0.92 : 0.58,
          dry: 0.48,
          prof: 'tip',
          color: b % 2 === 0 ? INK_PALETTE.geFen : INK_PALETTE.inkZhong,
          seed: 620 + b,
        }
      );
    }

    // 「白头搔更短」：头顶与后脑稀疏蓬松的霜雪白发与松散发髻（2.12s 后发髻随落簪松垂）
    const knotLoose = smootherstep(2.05, 2.85, localT);
    // 后脑灰白底发
    drawInkMass(
      ctx,
      [
        [-56, -34],
        [-64, -92],
        [-22, -126],
        [36, -118],
        [18, -76],
        [-28, -22],
      ],
      { tone: 0.42, color: INK_PALETTE.inkDan, jitter: 2.5, seed: 626 }
    );
    // 头顶稀疏松散的小发髻
    drawInkMass(
      ctx,
      [
        [-28, -118],
        [-16, -152 + knotLoose * 14],
        [14, -148 + knotLoose * 16],
        [18, -114],
      ],
      { tone: 0.52, color: INK_PALETTE.inkZhong, jitter: 2.0, seed: 627 }
    );

    // 层层蛤粉干笔飞白霜丝垂落双鬓与耳畔
    const whiteLocks = [
      [[-12, -138 + knotLoose * 10], [-48 - wind * 0.4, -85], [-74 - wind, -4], [-88 - wind * 1.3, 68]],
      [[4, -132 + knotLoose * 10], [-28 - wind * 0.3, -72], [-46 - wind * 0.8, 12]],
      [[26, -112], [6 - wind * 0.2, -58], [-8 - wind * 0.6, 22]],
      [[38, -104], [24, -64], [14 - wind * 0.4, -8]],
      [[-34, -112], [-66 - wind * 0.5, -52], [-96 - wind * 1.2, 34]],
      [[-4, -146 + knotLoose * 14], [28 + knotLoose * 18, -124 + knotLoose * 26], [42 + knotLoose * 24, -88 + knotLoose * 38]],
    ];
    whiteLocks.forEach((pts, idx) => {
      stroke(ctx, pts, {
        w: 5.2 - (idx % 3) * 0.9,
        tone: 0.95,
        dry: 0.36,
        prof: 'tip',
        color: INK_PALETTE.geFen,
        seed: 630 + idx,
      });
    });

    // 长叹时唇边袅袅升起的一缕寒气白雾 (`2.15s .. 4.6s`)
    if (localT > 2.1 && localT < 4.7) {
      const sU = clamp((localT - 2.1) / 2.4, 0, 1);
      const sAlpha = Math.sin(sU * Math.PI) * 0.62;
      stroke(
        ctx,
        [
          [66, -6],
          [108 + sU * 48, -18 - sU * 24],
          [158 + sU * 82, -46 - sU * 52],
        ],
        { w: 12 * (0.6 + sU * 0.6), tone: sAlpha, dry: 0.52, prof: 'fan', color: INK_PALETTE.geFen, seed: 640 }
      );
    }

    ctx.restore(); // 结束头部局部坐标

    // 3. 右前臂与宽大广袖关节动画：从石栏缓抬至头顶搔首 -> 无力垂落石栏
    const shX = 28;
    const shY = -255;
    // 手腕目标在躯干局部坐标中的插值：石栏前 (185, -32) <-> 发髻旁 (42, -468)
    const wrX = lerp(178, 38, reachUp);
    const wrY = lerp(-34, -466 + Math.sin(localT * 9.5) * 6 * reachUp, reachUp);
    const elX = lerp(102, 136, reachUp);
    const elY = lerp(-112, -285, reachUp);

    // 宽博书生广袖（没骨重墨花青衣褶 + 焦墨衣纹勾勒）
    const sleevePoly = [
      [shX - 18, shY - 18],
      [elX - 24, elY - 22],
      [wrX - 18, wrY - 14],
      [wrX + 16, wrY + 18],
      [elX + 38, elY + 86], // 垂落的宽大袖兜
      [shX + 12, shY + 68],
    ];
    drawInkMass(ctx, sleevePoly, {
      tone: 0.72,
      color: mixHex(INK_PALETTE.huaQing, INK_PALETTE.inkNong, 0.52),
      jitter: 2.6,
      seed: 645,
    });
    stroke(
      ctx,
      [
        [shX - 14, shY - 16],
        [elX - 18, elY - 18],
        [wrX - 14, wrY - 12],
      ],
      LOAD(14, TONE.jiao, [0, -1], { dry: 0.44, prof: 'brush', seed: 646 })
    );
    stroke(
      ctx,
      [
        [wrX + 14, wrY + 16],
        [elX + 38, elY + 86],
        [shX + 8, shY + 64],
      ],
      LOAD(18, TONE.jiao, [0, 1], { dry: 0.48, prof: 'robe', seed: 647 })
    );
    // 素白袖口内衬
    stroke(ctx, [[wrX - 12, wrY - 10], [wrX + 12, wrY + 14]], {
      w: 9.0,
      tone: 0.92,
      dry: 0.15,
      prof: 'even',
      color: INK_PALETTE.geFen,
      seed: 648,
    });

    // 苍瘦修长的手指（搔首时微曲轻颤）
    const handAng = lerp(0.18, -2.15, reachUp);
    ctx.save();
    ctx.translate(wrX + 4, wrY + 2);
    ctx.rotate(handAng);
    drawInkMass(ctx, [[0, -9], [24, -11], [34, 0], [22, 11], [0, 9]], {
      tone: 0.9,
      color: '#EAE2D3',
      jitter: 1.0,
      seed: 650,
    });
    for (let f = 0; f < 3; f++) {
      const fy = -7 + f * 6.5;
      stroke(
        ctx,
        [
          [16, fy],
          [34, fy - 2],
          [46 - f * 3, fy + 4],
        ],
        { w: 2.6, tone: TONE.jiao, dry: 0.25, prof: 'tip', seed: 652 + f }
      );
    }
    ctx.restore();

    ctx.restore(); // 结束躯干局部坐标

    // 登记第四幕主角包围盒（供 `audit.mjs` 空间语义门禁校验）
    recordSceneElement2D(ctx, {
      id: 'dufu_closeup_portrait',
      role: 'hero',
      isHero: true,
      kind: 'portrait',
      bbox: [baseX - 165, parapetY - 485, baseX + 215, parapetY],
      footY: parapetY,
      groundY: parapetY,
    });

    // 4. 前景厚重不透明寒石栏杆（先铺满纸色衬底阻隔半透明穿透，再施斧劈皴与浓墨压顶）
    ctx.save();
    ctx.fillStyle = '#DBD7CE';
    ctx.fillRect(-160, parapetY, 2280, 340);
    drawInkMass(
      ctx,
      [
        [-160, parapetY],
        [560, parapetY - 4],
        [1190, parapetY + 2],
        [1760, parapetY + 12],
        [2120, parapetY + 24],
        [2120, 1220],
        [-160, 1220],
      ],
      {
        tone: 0.78,
        color: INK_PALETTE.inkNong,
        jitter: 2.8,
        seed: 660,
        grad: [960, parapetY, 960, 1180, 1.0, 0.28],
      }
    );
    stroke(
      ctx,
      [
        [-120, parapetY],
        [580, parapetY - 4],
        [1220, parapetY + 2],
        [1820, parapetY + 14],
      ],
      LOAD(16, TONE.jiao, [0, 1], { dry: 0.46, prof: 'brush', seed: 662 })
    );
    // 右侧唐代莲瓣望柱石雕（平衡构图右重）
    drawInkMass(
      ctx,
      [
        [1330, parapetY + 4],
        [1342, parapetY - 108],
        [1362, parapetY - 134],
        [1398, parapetY - 134],
        [1418, parapetY - 108],
        [1430, parapetY + 6],
      ],
      { tone: 0.76, color: INK_PALETTE.inkJiao, jitter: 2.2, seed: 665 }
    );
    stroke(ctx, [[1342, parapetY - 106], [1380, parapetY - 138], [1418, parapetY - 106]], {
      w: 5.5,
      tone: TONE.jiao,
      dry: 0.45,
      prof: 'nail',
      seed: 666,
    });
    ctx.restore();

    // 5. 搔首时散落寒风中的数缕断白发 + 「浑欲不胜簪」滑落石栏的白玉簪 (`2.08s .. 2.96s` 坠石弹跳)
    const knotWorldX = baseX + 4 + sighBow * 32;
    const knotWorldY = parapetY - 455 + sighBow * 18;

    if (localT > 1.35) {
      const dt = localT - 1.35;
      for (let s = 0; s < 5; s++) {
        const sx = knotWorldX + 45 + s * 22 + dt * (34 + s * 10) + Math.sin(t * 2.5 + s) * 12;
        const sy = knotWorldY + 26 + s * 18 + dt * (52 + s * 9);
        if (sy < parapetY - 6) {
          stroke(
            ctx,
            [
              [sx - 18, sy - 6],
              [sx, sy + 3],
              [sx + 20, sy - 4],
            ],
            { w: 2.6, tone: 0.9, dry: 0.32, prof: 'tip', color: INK_PALETTE.geFen, seed: 670 + s }
          );
        }
      }
    }

    const landX = 1045;
    let pinX = knotWorldX + 12;
    let pinY = knotWorldY + 8;
    let pinAng = -0.24;

    if (localT < 2.08) {
      const slip = smootherstep(0.85, 2.08, localT);
      pinX = knotWorldX + 12 + slip * 28;
      pinY = knotWorldY + 8 + slip * 22;
      pinAng = -0.24 + slip * 0.72;
    } else if (localT < 2.96) {
      const fu = clamp((localT - 2.08) / 0.88, 0, 1);
      pinX = lerp(knotWorldX + 40, landX - 22, fu);
      pinY = lerp(knotWorldY + 30, parapetY - 6, fu * fu);
      pinAng = 0.48 + fu * 2.72;
    } else if (localT < 3.45) {
      const bu = clamp((localT - 2.96) / 0.49, 0, 1);
      pinX = lerp(landX - 22, landX, bu);
      pinY = parapetY - 6 - Math.sin(bu * Math.PI) * 28;
      pinAng = lerp(3.20, 3.12, bu);
    } else {
      pinX = landX;
      pinY = parapetY - 5;
      pinAng = 3.12;
    }

    if (localT >= 2.95) {
      const rU = clamp((localT - 2.95) / 1.65, 0, 1);
      drawInkRipples(ctx, landX, parapetY + 4, 125 * Math.pow(rU, 0.5), 0.65 * (1 - rU * 0.45), INK_PALETTE.geFen);
    }

    // 绘制温润白玉簪与簪首朱砂小穗（在深墨石栏上晶莹醒目）
    ctx.save();
    ctx.translate(pinX, pinY);
    ctx.rotate(pinAng);
    ctx.shadowColor = rgba(INK_PALETTE.inkJiao, 0.65);
    ctx.shadowBlur = 10;
    stroke(ctx, [[-58, 0], [62, 0]], {
      w: 8.2,
      tone: 0.99,
      dry: 0.06,
      prof: 'cone',
      color: INK_PALETTE.geFen,
      seed: 680,
    });
    stroke(ctx, [[-58, 2.5], [62, 1.8]], {
      w: 2.2,
      tone: 0.88,
      dry: 0.22,
      prof: 'tip',
      color: INK_PALETTE.inkJiao,
      seed: 681,
    });
    drawInkBlot(ctx, -58, 0, 8.2, 0.98, 0, 0.86, 682, INK_PALETTE.geFen);
    drawInkBlot(ctx, -49, 1, 5.2, 0.95, 0.3, 0.82, 683, INK_PALETTE.zhuSha);
    ctx.restore();

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 4. 五幕场景主渲染函数
  // ---------------------------------------------------------------------------

  // === ACT 1: 国破山河在，城春草木深 ===
  function renderAct1(ctx, w, h, frame, look, beginLayer, endLayer) {
    const { t, localT } = frame;

    beginLayer(0.20);
    drawRidgeLayer(ctx, {
      id: 'act1_far_mtn',
      role: 'bg',
      layerZ: 0.20,
      ridge: zhongnanFarRidge,
      depth: 320,
      tone: TONE.qing,
      color: INK_PALETTE.huaQing,
      rimW: 9,
      cun: 0.6,
      moss: 0.5,
      seed: 101,
    });
    drawRidgeLayer(ctx, {
      id: 'act1_mid_mtn',
      role: 'bg',
      layerZ: 0.28,
      ridge: zhongnanMidRidge,
      depth: 290,
      tone: TONE.dan,
      color: INK_PALETTE.inkZhong,
      rimW: 11,
      cun: 1.0,
      moss: 0.9,
      seed: 103,
    });
    const birdX = 1190 - localT * 38;
    drawInkBird(ctx, birdX, 242 + Math.sin(t * 1.5) * 6, {
      species: 'crane',
      pose: 'fly',
      scale: 0.42,
      flip: -1,
      flapPhase: t * 5.2,
    });
    drawInkBird(ctx, birdX + 68, 218 + Math.cos(t * 1.5) * 5, {
      species: 'crane',
      pose: 'fly',
      scale: 0.34,
      flip: -1,
      flapPhase: t * 5.2 + 1.4,
    });
    endLayer();

    drawMistRibbons(ctx, w, h, look, t, {
      bands: [
        { y: 455, h: 88, alpha: 0.34, parallax: 0.32 },
        { y: 585, h: 105, alpha: 0.42, parallax: 0.48 },
      ],
    });

    beginLayer(0.68);
    drawRuinedChangAnWall(ctx, t);
    // 右侧荒城古柳新绿依依，反衬国破荒凉 (`城春草木深`)
    drawInkWillow(ctx, 1525, 795, { scale: 1.16, flip: -1, t, wind: 0.25 });
    drawWildSpringGrassCluster(ctx, 215, 515, 14, 0.52, t, 121, INK_PALETTE.inkNong);
    drawWildSpringGrassCluster(ctx, 515, 558, 12, 0.48, t, 131, INK_PALETTE.inkZhong);
    endLayer();

    beginLayer(1.0);
    drawInkMass(
      ctx,
      [
        [-140, 822],
        [480, 792],
        [980, 798],
        [1560, 812],
        [2080, 845],
        [2080, 1090],
        [-140, 1090],
      ],
      {
        tone: 0.28,
        color: INK_PALETTE.inkZhong,
        jitter: 4.0,
        seed: 141,
        grad: [960, 792, 960, 1060, 0.95, 0.0],
      }
    );
    stroke(
      ctx,
      [
        [520, 804],
        [860, 798],
        [1240, 812],
      ],
      LOAD(12, TONE.zhong, [0, 1], { dry: 0.62, prof: 'brush', seed: 145 })
    );

    duFuAct1.act(localT, [
      { do: 'walk', from: 0.0, to: 3.15, fromX: 1110, toX: 865, fromY: 806, toY: 802, cadence: 1.32 },
      { do: 'sigh', from: 3.10, to: 4.8 },
    ]);
    duFuAct1.state.groundY = duFuAct1.state.y;
    duFuAct1.draw(ctx, t);

    drawWildSpringGrassCluster(ctx, 645, 848, 26, 0.92, t, 151);
    drawWildSpringGrassCluster(ctx, 1265, 855, 28, 0.96, t, 161);
    drawWildSpringGrassCluster(ctx, 385, 862, 22, 0.84, t, 165);
    endLayer();

    beginLayer(1.16);
    drawWildSpringGrassCluster(ctx, 185, 1068, 26, 1.32, t, 171, INK_PALETTE.inkJiao);
    drawWildSpringGrassCluster(ctx, 1745, 1075, 24, 1.28, t, 181, INK_PALETTE.inkJiao);
    endLayer();

    drawCalligraphicVerse(ctx, 1685, 132, {
      lines: ['国破山河在', '城春草木深'],
      style: 'xingcao',
      fontSize: 40,
      color: INK_PALETTE.inkJiao,
      reveal: smootherstep(0.55, 3.25, localT),
      seed: 191,
    });
  }

  // === ACT 2: 感时花溅泪，恨别鸟惊心 ===
  function renderAct2(ctx, w, h, frame, look, beginLayer, endLayer) {
    const { t, localT } = frame;

    beginLayer(0.24);
    drawRidgeLayer(ctx, {
      id: 'act2_distant_haze',
      role: 'bg',
      layerZ: 0.24,
      peaks: [
        [340, 145, 420],
        [1380, 168, 480],
      ],
      base: 735,
      depth: 260,
      tone: 0.12,
      color: INK_PALETTE.zheShi,
      rim: false,
      seed: 202,
    });
    // 下方留白春池微澜，承接花上坠泪
    drawMaYuanWaves(ctx, 180, 785, 1450, 210, t, {
      rows: 3,
      cols: 5,
      color: INK_PALETTE.zheShi,
      alpha: 0.14,
      seed: 212,
    });
    endLayer();

    drawMistRibbons(ctx, w, h, look, t, {
      bands: [
        { y: 315, h: 95, alpha: 0.24, parallax: 0.28 },
        { y: 745, h: 125, alpha: 0.34, parallax: 0.42 },
      ],
    });

    beginLayer(1.0);
    drawInkMass(
      ctx,
      [
        [-160, 1120],
        [-140, 725],
        [65, 718],
        [215, 815],
        [310, 1120],
      ],
      {
        tone: 0.76,
        color: INK_PALETTE.inkJiao,
        jitter: 3.6,
        seed: 206,
        grad: [40, 720, 90, 1080, 1.0, 0.25],
      }
    );
    drawCliffFace(ctx, -35, 715, 1.32, {
      id: 'act2_corner_rock',
      role: 'mid',
      flip: 1,
      color: INK_PALETTE.inkJiao,
      seed: 207,
    });
    drawTearBlossomAndStartledBird(ctx, t, localT);
    endLayer();

    drawWeatherParticles(ctx, w, h, t, {
      kind: 'petals',
      count: 14,
      wind: 0.75,
      alpha: 0.56,
      seed: 240,
    });

    drawCalligraphicVerse(ctx, 1665, 465, {
      lines: ['感时花溅泪', '恨别鸟惊心'],
      style: 'xingcao',
      fontSize: 40,
      color: INK_PALETTE.inkJiao,
      reveal: smootherstep(0.45, 2.95, localT),
      seed: 291,
    });
  }

  // === ACT 3: 烽火连三月，家书抵万金 ===
  function renderAct3(ctx, w, h, frame, look, beginLayer, endLayer) {
    const { t, localT } = frame;

    beginLayer(0.22);
    drawCelestialBody(ctx, 355, 205, 52, look, { kind: 'moon', alpha: 0.88 });
    drawRidgeLayer(ctx, {
      id: 'act3_pass_far',
      role: 'bg',
      layerZ: 0.22,
      peaks: [
        [240, 210, 360],
        [820, 250, 440],
        [1520, 225, 410],
      ],
      base: 565,
      depth: 320,
      tone: 0.46,
      color: '#182433',
      rimW: 10,
      seed: 305,
    });
    endLayer();

    beginLayer(0.62);
    drawRidgeLayer(ctx, {
      id: 'act3_beacon_ridge',
      role: 'mid',
      layerZ: 0.62,
      peaks: [
        [485, 138, 280],
        [935, 192, 320],
        [1265, 225, 280],
        [1415, 238, 250],
      ],
      base: 790,
      depth: 330,
      tone: 0.78,
      color: INK_PALETTE.inkJiao,
      rimW: 14,
      cun: 1.1,
      seed: 315,
    });
    drawBeaconSmokeAndSilkLetter(ctx, t, localT);
    endLayer();

    if (localT >= 0.48) {
      const sparkAlpha = clamp((localT - 0.48) * 1.4, 0, 0.88);
      drawWeatherParticles(ctx, w, h, t, {
        kind: 'gold-motes',
        count: 34,
        wind: 1.45,
        alpha: sparkAlpha,
        seed: 340,
      });
    }

    drawCalligraphicVerse(ctx, 1665, 138, {
      lines: ['烽火连三月', '家书抵万金'],
      style: 'kuangcao',
      fontSize: 54,
      color: INK_PALETTE.geFen,
      accentColor: INK_PALETTE.zhuSha,
      withSplatter: true,
      reveal: smootherstep(0.92, 2.45, localT),
      seed: 391,
    });
  }

  // === ACT 4: 白头搔更短，浑欲不胜簪 ===
  function renderAct4(ctx, w, h, frame, look, beginLayer, endLayer) {
    const { t, localT } = frame;

    beginLayer(0.26);
    drawRidgeLayer(ctx, {
      id: 'act4_frost_hills',
      role: 'bg',
      layerZ: 0.26,
      peaks: [
        [380, 175, 460],
        [1420, 215, 520],
      ],
      base: 575,
      depth: 290,
      tone: 0.16,
      color: INK_PALETTE.inkDan,
      rimW: 7,
      seed: 405,
    });
    // 左上斜探寒柯枯枝
    stroke(
      ctx,
      [
        [-80, 145],
        [165, 212 + Math.sin(t * 1.4) * 4],
        [365, 184 + Math.sin(t * 1.4) * 7],
      ],
      LOAD(14, TONE.zhong, [0, 1], { dry: 0.65, prof: 'cone', seed: 411 })
    );
    stroke(
      ctx,
      [
        [165, 212],
        [268, 282],
      ],
      LOAD(6.5, TONE.dan, [0, 1], { dry: 0.68, prof: 'tip', seed: 412 })
    );
    endLayer();

    drawMistRibbons(ctx, w, h, look, t, {
      bands: [{ y: 515, h: 115, alpha: 0.36, parallax: 0.42 }],
    });

    beginLayer(1.0);
    drawAgingDuFuCloseUp(ctx, t, localT);
    endLayer();

    drawCalligraphicVerse(ctx, 1655, 165, {
      lines: ['白头搔更短', '浑欲不胜簪'],
      style: 'xingcao',
      fontSize: 42,
      color: INK_PALETTE.inkJiao,
      reveal: smootherstep(0.5, 3.1, localT),
      seed: 491,
    });
  }

  // === ACT 5: 万古山河 · 少陵春望 ===
  function renderAct5(ctx, w, h, frame, look, beginLayer, endLayer) {
    const { t, localT } = frame;

    beginLayer(0.22);
    drawRidgeLayer(ctx, {
      id: 'act5_eternal_far',
      role: 'bg',
      layerZ: 0.22,
      peaks: [
        [260, 175, 390],
        [780, 235, 460],
        [1360, 265, 510],
        [1790, 190, 380],
      ],
      base: 430,
      depth: 290,
      tone: TONE.qing,
      color: INK_PALETTE.huaQing,
      rimW: 9,
      cun: 0.7,
      seed: 501,
    });
    drawRidgeLayer(ctx, {
      id: 'act5_eternal_mid',
      role: 'bg',
      layerZ: 0.34,
      peaks: [
        [110, 145, 320],
        [1140, 185, 420],
        [1640, 165, 360],
      ],
      base: 515,
      depth: 260,
      tone: TONE.dan,
      color: INK_PALETTE.inkZhong,
      rimW: 10,
      cun: 0.9,
      moss: 0.8,
      seed: 507,
    });

    drawInkRipples(ctx, 1320, 695, 225, 0.38, INK_PALETTE.huaQing);
    const flyProgress = clamp(localT / 5.5, 0, 1);
    drawInkBird(ctx, lerp(1020, 1450, flyProgress), lerp(485, 268, flyProgress), {
      species: 'crane',
      pose: 'fly',
      scale: 0.56,
      angle: -0.26,
      flapPhase: t * 5.4,
    });
    drawInkBird(ctx, lerp(955, 1365, flyProgress), lerp(515, 302, flyProgress), {
      species: 'crane',
      pose: 'fly',
      scale: 0.44,
      angle: -0.24,
      flapPhase: t * 5.4 + 1.5,
    });
    endLayer();

    drawMistRibbons(ctx, w, h, look, t, {
      bands: [
        { y: 445, h: 95, alpha: 0.36, parallax: 0.35 },
        { y: 590, h: 130, alpha: 0.45, parallax: 0.52 },
      ],
    });

    // 主舞台危崖层 (p = 1.0)：自左麓自然延绵隆起的宋画悬崖石台（消除硬切左缘）
    beginLayer(1.0);
    drawInkMass(
      ctx,
      [
        [-180, 1120],
        [-160, 835],
        [240, 795],
        [680, 762],
        [755, 766],
        [895, 1120],
      ],
      {
        tone: 0.28,
        color: INK_PALETTE.inkJiao,
        jitter: 3.5,
        seed: 520,
        grad: [420, 762, 420, 1085, 1.0, 0.02],
      }
    );
    stroke(
      ctx,
      [
        [-140, 838],
        [245, 795],
        [685, 762],
      ],
      LOAD(14, TONE.nong, [0, 1], { dry: 0.52, prof: 'brush', seed: 522 })
    );
    drawCliffFace(ctx, 665, 760, 1.32, {
      id: 'act5_promontory',
      role: 'mid',
      flip: 1,
      color: INK_PALETTE.inkJiao,
      seed: 525,
    });

    drawWildSpringGrassCluster(ctx, 712, 766, 10, 0.52, t, 531);
    drawInkBlot(ctx, 732, 732 + Math.sin(t * 2.2) * 2, 4.4, 0.88, 0.2, 0.85, 535, INK_PALETTE.zhuSha);

    // 杜甫散发无簪背影静立危崖
    duFuAct5.act(localT, [
      {
        do: 'pose',
        from: 0.0,
        to: 5.5,
        hold: true,
        view: 'back',
        joints: {
          spineAngle: -0.04,
          headAngle: -0.12,
          shLAng: 0.18,
          elLAng: 0.35,
          shRAng: -0.20,
          elRAng: 0.42,
        },
      },
    ]);
    duFuAct5.state.groundY = duFuAct5.state.y;
    duFuAct5.draw(ctx, t);

    const hairWind = Math.sin(t * 2.4) * 9;
    for (let hIdx = 0; hIdx < 4; hIdx++) {
      stroke(
        ctx,
        [
          [782 + (hIdx - 1.5) * 4, 602],
          [776 + (hIdx - 1.5) * 6 - hairWind * 0.6, 636],
          [766 + (hIdx - 1.5) * 8 - hairWind, 668],
        ],
        { w: 2.3, tone: 0.92, dry: 0.35, prof: 'tip', color: INK_PALETTE.geFen, seed: 540 + hIdx }
      );
    }
    endLayer();

    // 竖排题款与「少陵野老」朱砂方印（钤定瞬间激起一圈涟漪并自然消散，定格画面干净古雅）
    drawCalligraphicVerse(ctx, 275, 148, {
      lines: ['春望', '唐 · 杜甫'],
      style: 'xingcao',
      fontSize: 38,
      color: INK_PALETTE.inkJiao,
      reveal: smootherstep(1.95, 3.85, localT),
      seed: 581,
    });

    const sealProg = smootherstep(3.75, 4.45, localT);
    if (sealProg > 0.02) {
      ctx.save();
      const vpScale = Math.min(w / 1920, h / 1080);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(w * 0.5, h * 0.5);
      ctx.scale(vpScale, vpScale);
      ctx.translate(-960, -540);

      // 仅在落印瞬间 (3.75s..4.55s) 扩散并淡出的朱砂气韵圈
      if (localT < 4.65) {
        const ringU = clamp((localT - 3.78) / 0.85, 0, 1);
        if (ringU > 0 && ringU < 1) {
          ctx.beginPath();
          ctx.arc(256, 442, 62 + ringU * 85, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(INK_PALETTE.zhuSha, (1 - ringU) * 0.38);
          ctx.lineWidth = 4.5 * (1 - ringU * 0.5);
          ctx.stroke();
        }
      }

      drawCinnabarSeal(ctx, 256, 442, {
        size: 88,
        text: '少陵野老',
        stampProgress: sealProg,
        withShockwave: false,
        seed: 599,
      });
      ctx.restore();
    }
  }

  return {
    canvas: studio.canvas,
    storyboard: director.storyboard,
    async render(frame) {
      director.update(frame);
      studio.render(frame, ({ ctx, width: w, height: h, look, beginLayer, endLayer }) => {
        const sIdx = frame.sceneIndex ?? 0;
        if (sIdx === 0) renderAct1(ctx, w, h, frame, look, beginLayer, endLayer);
        else if (sIdx === 1) renderAct2(ctx, w, h, frame, look, beginLayer, endLayer);
        else if (sIdx === 2) renderAct3(ctx, w, h, frame, look, beginLayer, endLayer);
        else if (sIdx === 3) renderAct4(ctx, w, h, frame, look, beginLayer, endLayer);
        else renderAct5(ctx, w, h, frame, look, beginLayer, endLayer);
      });
    },
  };
}
