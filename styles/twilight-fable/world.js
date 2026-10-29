// twilight-fable · default showcase v2 — 《暖窗》 The Warm Window
//
// A stray meadow kitten follows the only warm window in a foggy wood; a stout bear cub opens the round door,
// and by dawn the kitten's cold blue rim light has turned honey-gold.
// Treatment: out/styles/twilight-fable/TREATMENT.md
//
//   S1 fog-wood     wide   · forest floor rising to a far ridge · kitten back view, small, lower-left · push
//   S2 mound-door   full   · burrow mound at dusk, door opens     · kitten side, bear 3q in the doorway  · pan
//   S3 hearth-warm  close  · burrow interior, plank floor          · kitten 3q face, rim hands over cyan→honey · push
//   S4 dawn-window  medium · outside the mound at mint dawn        · both front view inside the window   · pull
//
// Native move: "window-warmth hand-off" — the same warm source travels from a far speck (S1) to the door (S2)
// to the hearth (S3) and is handed to the kitten's rim light live; S4 reverses the vantage.
// Every coordinate below is composed for its shot; no water is used anywhere in this film.

import { clamp, lerp, smootherstep } from '../../engine/motion.js';
import {
  createTwilightStage,
  defineTwilightLook,
  mixHex,
  rgba,
  simulateCritterRig,
  drawTwilightCritter,
  drawDreamyBackdrop,
  drawStarfieldAndMeteors,
  createBokehOrbs,
  drawBokehField,
  groundProfile,
  drawGroundMass,
  drawGrassTufts,
  drawStoneMass,
  drawTrunk,
  drawCanopyMass,
  drawLightShafts,
  drawFogLayer,
  drawWindowGlow,
  drawGlowMushroom,
  drawLitOrganicShape,
  traceSmoothChainRibbon,
} from './kernel.js';

const DW = 1920;
const DH = 1080;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------
// Looks authored for this story (two custom + presets glade / mintmist)
// ---------------------------------------------------------------------------------------------
const LOOKS = {
  fogwood: defineTwilightLook('deepwood', {
    name: 'fogwood',
    skyTop: '#1C3644',
    skyMid: '#2E5A62',
    skyHorizon: '#7FA89C',
    mistColor: '#B9DCCD',
    coolGlow: '#8FE3D0',
    warmGlow: '#FFD98A',
    groundTop: '#3A5E52',
    groundMid: '#28463E',
    groundDeep: '#16302C',
  }),
  hearth: defineTwilightLook('honey', {
    name: 'hearth',
    skyTop: '#4A2C46',
    skyMid: '#7C4C5C',
    skyHorizon: '#CC9070',
    groundTop: '#8C5A48',
    groundMid: '#6A4038',
    groundDeep: '#3E262C',
    warmGlow: '#FFD089',
    warmMid: '#F5A04A',
    coolGlow: '#9FB6F2',
    mistColor: '#F4C69E',
  }),
};

// ---------------------------------------------------------------------------------------------
// Cast: two silhouettes that differ in mass, ears and tail
// ---------------------------------------------------------------------------------------------
const KITTEN = {
  species: 'meadowCat',
  base: { bodyLen: 1.1, legLen: 1.05 },
  build: { headR: 1.16, bodyLen: 0.92, girth: 0.92, legLen: 0.98, earLen: 1.2, tailLen: 1.35, eyeSize: 1.12 },
  paletteOverrides: {
    baseDark: '#1B2538',
    baseMid: '#33465E',
    farDark: '#131B2A',
    farMid: '#23314A',
    bounceColor: '#9CC7E8',
    ruffColor: '#EEF4FA',
    ruffMid: '#B8CCE0',
    earTipColor: '#FFF1C9',
    earTipGlow: '#A5D8F0',
    earInnerColor: '#F4A6B8',
  },
};

const CUB = {
  species: 'cubBear',
  base: { bodyLen: 0.95, legLen: 0.8 },
  build: { girth: 1.38, headR: 1.18, legLen: 0.78, legGirth: 1.35, earLen: 1.1, tailLen: 0.6 },
  paletteOverrides: {
    baseDark: '#2E1B26',
    baseMid: '#553447',
    farDark: '#21131C',
    farMid: '#3C2434',
    ruffColor: '#FFE2A8',
    ruffMid: '#E8B784',
    bounceColor: '#F6B26B',
  },
};

const ss = (a, b, x) => smootherstep(a, b, x);
const pulse = (a, b, c, x) => ss(a, b, x) * (1 - ss(b, c, x));

/**
 * Semantic quadruped intent → rig intent. `sit` 0 = standing on four legs, 1 = sitting upright.
 * Gait (optional) is a diagonal walk: { phase, stride, lift } in scale units.
 */
function quadIntent(o) {
  const { x, gy, s, b, f } = o;
  const L = b.legLen;
  const bl = b.bodyLen;
  const sit = o.sit ?? 0;
  const crouch = o.crouch ?? 0;
  const pelvisY = lerp(gy - 56 * L * s, gy - 48 * s * L, sit) + crouch * 14 * s + (o.bob ?? 0);
  const chestOffsetX = f * lerp(68, 34, sit) * s * bl + f * (o.lean ?? 0) * s;
  const chestOffsetY = lerp(-4, -46 * L, sit) * s + crouch * 8 * s + (o.chestDY ?? 0) * s;
  const headOffsetX = f * lerp(24, 12, sit) * s + f * (o.headDX ?? 0) * s;
  const headOffsetY = lerp(-42, -44, sit) * s + (o.headDY ?? 0) * s;
  const chestX = x + chestOffsetX;
  const g = o.gait;
  const step = (ph) => (g ? [f * Math.sin(ph) * g.stride * s, -Math.max(0, Math.cos(ph)) * g.lift * s] : [0, 0]);
  const p0 = g ? g.phase : 0;
  const [hl, hr, fl, fr] = [step(p0), step(p0 + Math.PI), step(p0 + Math.PI), step(p0)];
  const earBack = o.earBack ?? 0;
  const earPerk = o.earPerk ?? 0;
  const earShift = -f * 0.62 * earBack + f * 0.22 * earPerk + (o.earWiggle ?? 0);
  const tailBase = f < 0 ? -0.48 : -Math.PI + 0.48;
  const tailAngle = tailBase - f * 0.28 * (o.tailLow ?? 0) + f * 0.18 * (o.tailUp ?? 0);
  return {
    facing: f,
    view: o.view,
    pelvisX: x,
    pelvisY,
    chestOffsetX,
    chestOffsetY,
    headOffsetX,
    headOffsetY,
    spineArch: (o.arch ?? -6) * s,
    headYaw: o.yaw ?? f * 0.15,
    headTilt: o.tilt ?? 0,
    headPitch: o.pitch ?? -0.06,
    earAngleL: -1.85 + earShift - (o.earSpread ?? 0),
    earAngleR: -1.22 + earShift + (o.earSpread ?? 0),
    tailAngle,
    tailWagAmp: o.wag ?? 0.07,
    eyeSquint: o.squint ?? 0,
    mouthOpen: o.mouth ?? 0,
    feet: {
      hindL: [x - f * lerp(10, 6, sit) * s * bl + hl[0] * 1.15, gy + hl[1]],
      hindR: [x - f * lerp(22, 18, sit) * s * bl + hr[0] * 1.15, gy - 2 * s + hr[1]],
      frontL: [chestX + f * lerp(24, 18, sit) * s * bl + fl[0] * 1.15, gy + fl[1]],
      frontR: [chestX + f * lerp(12, 6, sit) * s * bl + fr[0] * 1.15, gy - 2 * s + fr[1]],
    },
    lookAt: o.lookAt,
  };
}

function rig(who, t, s, choreo) {
  const b = { ...who.base, ...who.build };
  return simulateCritterRig(t, (u) => quadIntent({ s, b, ...choreo(u) }), s, {
    species: who.species,
    build: who.build,
    paletteOverrides: who.paletteOverrides,
  });
}

/** Visible design-space rectangle for any output aspect (16:9, 9:16, 1:1). */
function visibleRect(W, H) {
  const k = Math.min(W / DW, H / DH);
  const hw = W / 2 / k;
  const hh = H / 2 / k;
  return { x0: DW / 2 - hw - 60, x1: DW / 2 + hw + 60, y0: DH / 2 - hh - 60, y1: DH / 2 + hh + 60 };
}

function skyAndWall(ctx, V, look, lights, t, opts) {
  if (V.y0 < 0) {
    ctx.fillStyle = look.skyTop;
    ctx.fillRect(V.x0, V.y0, V.x1 - V.x0, -V.y0 + 4);
  }
  drawDreamyBackdrop(ctx, DW, Math.max(DH, V.y1), look, lights, t, opts);
}

function glowDot(ctx, x, y, r, color, a) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba('#FFFFFF', a));
  g.addColorStop(0.25, rgba(color, a * 0.7));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Soft pale footpath ribbon (lighter, misted ground) along a centre line. */
function paintPath(ctx, pts, widthFn, look, alpha) {
  ctx.save();
  traceSmoothChainRibbon(ctx, pts, widthFn, 24);
  const ys = pts.map((p) => p[1]);
  const g = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
  g.addColorStop(0, rgba(look.mistColor, alpha * 0.6));
  g.addColorStop(1, rgba(mixHex(look.groundTop, look.mistColor, 0.5), alpha));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function traceArch(c, x, y, w, h) {
  c.beginPath();
  c.moveTo(x, y + h);
  c.lineTo(x, y + w * 0.5);
  c.arc(x + w * 0.5, y + w * 0.5, w * 0.5, Math.PI, 0);
  c.lineTo(x + w, y + h);
  c.closePath();
}

export default async function createWorld({ width = 1920, height = 1080, scenes = [] } = {}) {
  const stage = createTwilightStage({ width, height, designWidth: DW, designHeight: DH, scenes, looks: LOOKS });
  const { studio } = stage;

  const director = studio.director({
    subjects: {
      lostKitten: { x: 560, y: 860 },
      doorway: { x: 900, y: 700 },
      kittenFace: { x: 1230, y: 520 },
      windowPair: { x: 960, y: 610 },
    },
    shots: {
      'fog-wood': { size: 'wide', move: 'push', amount: 0.6, subject: 'lostKitten' },
      'mound-door': { size: 'full', move: 'pan', amount: 0.5, subject: 'doorway' },
      'hearth-warm': { size: 'close', move: 'push', amount: 0.7, subject: 'kittenFace' },
      'dawn-window': { size: 'medium', move: 'pull', amount: 0.8, subject: 'windowPair' },
    },
  });

  // Seeded optical layers, one set per scene
  const bokeh = {
    fog: createBokehOrbs(9, DW, DH, { seed: 131, minR: 26, maxR: 70, alphaScale: 0.45, colors: ['#B9DCCD', '#8FE3D0', '#FFD98A'] }),
    dusk: createBokehOrbs(7, DW, DH, { seed: 277, minR: 18, maxR: 52, alphaScale: 0.5, colors: ['#6EE7B7', '#FDE68A', '#99F6E4'] }),
    hearthFg: createBokehOrbs(6, DW, DH, { seed: 389, minR: 70, maxR: 140, alphaScale: 0.38, colors: ['#FFD089', '#F5A04A', '#F4C69E'] }),
    dew: createBokehOrbs(12, DW, DH, { seed: 457, minR: 14, maxR: 46, alphaScale: 0.55, colors: ['#FEF3C7', '#E0F7F1', '#D9F99D'] }),
  };

  // -------------------------------------------------------------------------------------------
  // S1 · fog-wood — wide. The kitten, small and seen from behind, notices one warm speck on the ridge.
  // -------------------------------------------------------------------------------------------
  const fogFloor = groundProfile([[-60, 1018], [360, 972], [820, 918], [1320, 872], [1980, 832]], { rough: 9, seed: 41 });
  const fogRidge = groundProfile(
    [[-60, 650], [380, 612], [860, 556], [1240, 488], [1452, 446], [1530, 414], [1612, 442], [1980, 470]],
    { rough: 12, seed: 17, freq: 0.006 }
  );

  function fogWood(ctx, V, t, look, beginLayer, endLayer) {
    const s = 0.92;
    const winX = 1530;
    const winY = fogRidge(winX) - 22;
    const notice = ss(0.7, 1.9, t);
    const kx = lerp(548, 604, ss(1.4, 3.2, t));
    const kitten = rig(KITTEN, t, s, (u) => {
      const wu = ss(1.4, 3.2, u);
      const x = lerp(548, 604, wu);
      const n = ss(0.7, 1.9, u);
      const moving = wu > 0.01 && wu < 0.99 ? 1 : 0;
      return {
        x,
        gy: fogFloor(x + 20) - 2,
        f: 1,
        view: 'back',
        crouch: 0.35 * (1 - n),
        gait: { phase: u * 5.2, stride: 7 * moving, lift: 6 * moving },
        earBack: 0.5 * (1 - n),
        earPerk: n,
        tilt: -0.12 * n + Math.sin(u * 2.1) * 0.04,
        pitch: -0.18 * n,
        tailUp: 0.55 + 0.55 * n,
        wag: 0.05 + 0.06 * n,
      };
    });

    const lights = [
      { x: 340, y: -60, r: 820, color: look.coolGlow, coreColor: '#EAFFF8', intensity: 0.95, rimWidth: 3.2 },
      { x: winX, y: winY, r: 620, color: look.warmGlow, coreColor: '#FFF6DE', intensity: 0.32 + 0.4 * notice },
      { x: kx + 40, y: 1040, r: 300, color: look.mistColor, intensity: 0.4 },
    ];

    beginLayer(0.88);
    skyAndWall(ctx, V, look, lights, t, { horizonY: 430, seed: 101, washCount: 2 });
    drawGroundMass(ctx, DW, DH, fogRidge, look, lights, t, {
      x0: V.x0,
      x1: V.x1,
      bottom: V.y1,
      colors: { top: mixHex(look.groundTop, look.mistColor, 0.35), mid: mixHex(look.groundMid, look.mistColor, 0.2), deep: look.groundDeep },
      rimAlpha: 0.25,
      seed: 5,
    });
    const farTrunk = { dark: mixHex(look.foliageDark, look.mistColor, 0.42), mid: mixHex(look.stoneDark, look.mistColor, 0.5) };
    for (const [x, w0, lean, seed] of [[300, 44, -10, 3], [690, 34, 14, 4], [1090, 40, -6, 6], [1780, 52, 18, 8]]) {
      drawTrunk(ctx, x, fogRidge(x) + 10, -60, look, lights, { width: [w0, w0 * 0.7], lean, roots: 2, colors: farTrunk, rimIntensity: 0.35, bark: 3, seed });
    }
    // A pale footpath climbing the slope to the window: the leading line of the shot (far part, misted)
    paintPath(ctx, [[930, 900], [1080, 790], [1180, 700], [1330, 590], [1440, 500], [1516, 440]], (u) => lerp(46, 5, u), look, 0.34);
    drawWindowGlow(ctx, winX - 15, winY - 18, 30, 36, look, t, { arch: true, panes: [1, 1], outside: look.warmMid, frameColor: look.groundDeep });
    glowDot(ctx, winX, winY, 70 + 40 * notice, look.warmGlow, 0.35 + 0.35 * notice);
    drawFogLayer(ctx, DW, 540, 260, { color: look.mistColor, alpha: 0.34, puffs: 8, seed: 12, speed: 10 }, t);
    endLayer();

    beginLayer(1.0);
    drawGroundMass(ctx, DW, DH, fogFloor, look, lights, t, { x0: V.x0, x1: V.x1, bottom: V.y1, speckles: 150, seed: 9 });
    drawTrunk(ctx, 1745, fogFloor(1745) + 18, -80, look, lights, { width: [150, 96], lean: 26, bend: -14, roots: 3, seed: 21 });
    drawStoneMass(ctx, 930, fogFloor(930) + 14, 150, 74, look, lights, { flatTop: 0.35, moss: { coverage: 0.5 }, cracks: 1, seed: 33 });
    drawStoneMass(ctx, 1290, fogFloor(1290) + 8, 70, 36, look, lights, { flatTop: 0.1, moss: { coverage: 0.4 }, seed: 34 });
    drawGrassTufts(ctx, fogFloor, V.x0, V.x1, { density: 2.2, height: [16, 40], colors: [look.groundDeep, look.foliageGlow], lean: 0.08, seed: 15 }, t);
    paintPath(ctx, [[470, 1120], [560, 1000], [700, 942], [860, 908], [960, 890]], (u) => lerp(120, 44, u), look, 0.22);
    drawGlowMushroom(ctx, 1010, fogFloor(1010) + 4, 0.55, t, { c1: look.coolGlow, c2: '#2DD4BF', cap: 'bell', phase: 1 });
    drawGlowMushroom(ctx, 1042, fogFloor(1042) + 6, 0.38, t, { c1: look.foliageGlow, c2: '#65A30D', cap: 'dome', lean: 0.2, phase: 2 });
    drawGlowMushroom(ctx, 250, fogFloor(250) + 8, 0.7, t, { c1: look.coolGlow, c2: '#0F766E', cap: 'dome', lean: -0.1, phase: 3 });
    drawFogLayer(ctx, DW, 930, 150, { color: look.mistColor, alpha: 0.22, puffs: 6, seed: 27, speed: 16 }, t);
    drawLightShafts(ctx, 520, -40, { angle: Math.PI * 0.44, spread: 0.36, count: 4, length: 1050, width: [40, 170], color: look.coolGlow, alpha: 0.18, seed: 19 }, t);
    drawTwilightCritter(ctx, kitten, lights, t);
    drawCanopyMass(ctx, 820, -20, 520, 250, look, lights, t, { lumps: 10, glints: 10, seed: 44 });
    drawCanopyMass(ctx, 1640, -40, 470, 200, look, lights, t, { lumps: 10, glints: 12, seed: 45 });
    endLayer();

    beginLayer(1.14);
    drawTrunk(ctx, 70, V.y1, -120, look, lights, { width: [230, 170], lean: 30, roots: 0, bark: 7, seed: 51 });
    drawCanopyMass(ctx, 230, -70, 440, 210, look, lights, t, { lumps: 9, glints: 8, seed: 52 });
    drawBokehField(ctx, DW, DH, bokeh.fog, t);
    endLayer();
  }

  // -------------------------------------------------------------------------------------------
  // S2 · mound-door — full. Kitten hesitates; the round door swings open; the cub leans into the light.
  // -------------------------------------------------------------------------------------------
  const duskHills = groundProfile([[-60, 740], [300, 690], [700, 720], [1100, 660], [1500, 690], [1980, 670]], { rough: 8, seed: 63 });
  const mound = groundProfile(
    [[-60, 900], [640, 875], [880, 770], [1060, 580], [1260, 445], [1520, 410], [1760, 445], [1990, 510]],
    { rough: 10, seed: 64 }
  );
  const duskPath = groundProfile([[-60, 900], [420, 884], [900, 878], [1360, 886], [1990, 908]], { rough: 5, seed: 65 });
  const DOOR = { x: 1316, y: 628, w: 176, h: 256 };

  function moundDoor(ctx, V, t, look, beginLayer, endLayer) {
    const open = ss(1.5, 2.6, t);
    const sK = 1.75;
    const kitten = rig(KITTEN, t, sK, (u) => {
      const walk = ss(0.0, 1.5, u);
      const step2 = ss(3.2, 4.0, u);
      const x = lerp(250, 520, walk) + 46 * step2;
      const op = ss(1.5, 2.6, u);
      const hesitate = pulse(1.1, 1.6, 2.4, u);
      const moving = 1 - ss(1.2, 1.5, u) + pulse(3.2, 3.6, 4.0, u);
      return {
        x,
        gy: duskPath(x + 40),
        f: 1,
        view: 'side',
        crouch: 0.7 * hesitate,
        bob: Math.sin(u * 10.4) * 2 * moving,
        gait: { phase: u * 10.4, stride: 13 * moving, lift: 9 * moving },
        earBack: 0.9 * hesitate,
        earPerk: op * (1 - hesitate),
        pitch: lerp(0.08, -0.2, op),
        tilt: 0.1 * op + Math.sin(u * 2.4) * 0.03,
        tailLow: 0.9 * hesitate,
        tailUp: (0.35 + 0.5 * op) * (1 - hesitate),
        wag: 0.05 + 0.08 * op,
        lookAt: [DOOR.x + 60, DOOR.y + 120],
      };
    });
    const cub = rig(CUB, t, 1.18, (u) => {
      const lean = ss(1.9, 3.0, u);
      return {
        x: lerp(DOOR.x + 230, DOOR.x + 104, lean),
        gy: DOOR.y + DOOR.h - 4,
        f: -1,
        view: '3q',
        sit: 0.8,
        lean: 10 * lean,
        headDX: 6 * lean,
        tilt: -0.18 * lean + Math.sin(u * 1.7) * 0.04,
        yaw: -0.3,
        earPerk: lean,
        squint: 0.35 * lean,
        mouth: 0.35 * pulse(2.8, 3.2, 3.9, u),
        wag: 0.1,
        lookAt: [420, 700],
      };
    });

    const doorLight = {
      x: DOOR.x + DOOR.w * 0.5,
      y: DOOR.y + DOOR.h * 0.45,
      r: 640,
      color: look.warmGlow,
      coreColor: '#FFF7E0',
      intensity: 0.25 + 1.25 * open,
      rimWidth: 4.6,
      softWidth: 22,
    };
    const lights = [doorLight, { x: 220, y: 120, r: 760, color: look.coolGlow, coreColor: '#E6FFF6', intensity: lerp(1.0, 0.55, open) }];

    beginLayer(0.9);
    skyAndWall(ctx, V, look, lights, t, { horizonY: 800, seed: 211, washCount: 3 });
    drawStarfieldAndMeteors(ctx, DW, DH, t, { seed: 29, starCount: 70, maxY: 640 });
    drawGroundMass(ctx, DW, DH, duskHills, look, lights, t, {
      x0: V.x0,
      x1: V.x1,
      bottom: V.y1,
      colors: { top: mixHex(look.foliageMid, look.skyHorizon, 0.35), mid: look.foliageMid, deep: look.foliageDark },
      rimAlpha: 0.2,
      seed: 7,
    });
    endLayer();

    beginLayer(1.0);
    drawTrunk(ctx, 1610, mound(1610) + 25, -80, look, lights, { width: [180, 120], lean: -22, bend: 14, roots: 3, seed: 68 });
    drawCanopyMass(ctx, 1540, 20, 480, 230, look, lights, t, { lumps: 10, glints: 12, seed: 69 });
    drawGroundMass(ctx, DW, DH, mound, look, lights, t, { x0: V.x0, x1: V.x1, bottom: V.y1, speckles: 120, seed: 11 });
    drawGrassTufts(ctx, mound, 860, V.x1, { density: 3, height: [18, 44], colors: [look.groundDeep, look.foliageGlow], glowTips: true, seed: 66 }, t);
    // Door: halo + lamp-lit interior, cub clipped inside the arch, door leaf swinging on the left hinge.
    // (Painted here rather than with drawWindowGlow: a tall door needs a round halo, see report.)
    const dcx = DOOR.x + DOOR.w * 0.5;
    glowDot(ctx, dcx, DOOR.y + DOOR.h * 0.5, 300 + 120 * open, look.warmGlow, 0.18 + 0.4 * open);
    ctx.save();
    traceArch(ctx, DOOR.x, DOOR.y, DOOR.w, DOOR.h);
    const inside = ctx.createLinearGradient(0, DOOR.y, 0, DOOR.y + DOOR.h);
    inside.addColorStop(0, '#7A4A48');
    inside.addColorStop(0.6, mixHex('#B87458', look.warmGlow, 0.25 * open));
    inside.addColorStop(1, mixHex('#D89A68', look.warmGlow, 0.5 * open));
    ctx.fillStyle = inside;
    ctx.fill();
    ctx.clip();
    glowDot(ctx, dcx + 30, DOOR.y + DOOR.h * 0.72, 190, '#FFC27A', 0.35 + 0.5 * open);
    drawTwilightCritter(
      ctx,
      cub,
      [
        { x: DOOR.x + DOOR.w + 40, y: DOOR.y + 40, r: 420, color: '#FFD9A0', coreColor: '#FFFFFF', intensity: 1.4, rimWidth: 4 },
        { x: 300, y: 300, r: 900, color: look.coolGlow, intensity: 0.7 },
        { x: dcx + 40, y: DOOR.y + DOOR.h + 60, r: 300, color: '#FFB86B', intensity: 0.9 },
      ],
      t
    );
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#2A2234';
    ctx.lineWidth = 11;
    traceArch(ctx, DOOR.x, DOOR.y, DOOR.w, DOOR.h);
    ctx.stroke();
    ctx.restore();
    const leafW = (DOOR.w - 12) * (1 - open * 0.86);
    drawLitOrganicShape(
      ctx,
      (c) => {
        c.save();
        traceArch(c, DOOR.x + 6, DOOR.y + 6, DOOR.w - 12, DOOR.h - 6);
        c.clip();
        c.fillRect(DOOR.x + 6, DOOR.y, leafW, DOOR.h + 4);
        c.restore();
      },
      {
        cx: DOOR.x + 6 + leafW * 0.5,
        cy: DOOR.y + DOOR.h * 0.5,
        radius: DOOR.h * 0.55,
        baseDark: '#3A2532',
        baseMid: '#5A3A40',
        bounceColor: look.warmMid,
        bounceAlpha: 0.3,
        rimScale: 0.8,
        rimIntensity: 0.9,
      },
      lights
    );
    for (const [dx, dy, w, h, seed] of [[-30, 250, 66, 54, 71], [-22, 180, 44, 50, 72], [DOOR.w + 26, 252, 70, 52, 73], [DOOR.w + 20, 186, 46, 46, 74]]) {
      drawStoneMass(ctx, DOOR.x + dx, DOOR.y + dy, w, h, look, lights, { flatTop: 0.3, moss: { coverage: 0.35 }, seed });
    }
    drawGlowMushroom(ctx, DOOR.x - 70, duskPath(DOOR.x - 70) + 6, 0.9, t, { c1: '#FDE68A', c2: '#F59E0B', cap: 'dome', lean: -0.15, phase: 1 });
    drawGlowMushroom(ctx, DOOR.x - 108, duskPath(DOOR.x - 108) + 8, 0.6, t, { c1: '#6EE7B7', c2: '#0EA5A4', cap: 'bell', lean: 0.1, phase: 2 });
    drawGroundMass(ctx, DW, DH, duskPath, look, lights, t, {
      x0: V.x0,
      x1: V.x1,
      bottom: V.y1,
      speckles: 90,
      colors: { top: mixHex(look.groundTop, '#C4825E', 0.12 * open) },
      seed: 13,
    });
    // Warm spill from the open door across the path, reaching toward the kitten
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const spillY = duskPath(dcx);
    const sg = ctx.createRadialGradient(dcx, spillY, 10, dcx, spillY, 760);
    sg.addColorStop(0, rgba(look.warmGlow, 0.5 * open));
    sg.addColorStop(0.5, rgba(look.warmMid, 0.16 * open));
    sg.addColorStop(1, rgba(look.warmMid, 0));
    ctx.fillStyle = sg;
    ctx.translate(dcx, spillY);
    ctx.scale(1, 0.22);
    ctx.translate(-dcx, -spillY);
    ctx.beginPath();
    ctx.arc(dcx, spillY, 760, 0, TAU);
    ctx.fill();
    ctx.restore();
    drawGrassTufts(ctx, duskPath, V.x0, V.x1, { density: 2.6, height: [14, 34], colors: [look.groundDeep, look.foliageGlow], seed: 67 }, t);
    drawTwilightCritter(ctx, kitten, lights, t);
    endLayer();

    beginLayer(1.12);
    drawBokehField(ctx, DW, DH, bokeh.dusk, t);
    endLayer();
  }

  // -------------------------------------------------------------------------------------------
  // S3 · hearth-warm — close. Cold cyan rim from the window gives way to the honey lamp; squint, yawn.
  // -------------------------------------------------------------------------------------------
  const plankFloor = groundProfile([[-60, 930], [1980, 924]], { rough: 2, seed: 81 });

  function hearthWarm(ctx, V, t, look, beginLayer, endLayer) {
    const warm = ss(0.3, 2.6, t);
    const kitten = rig(KITTEN, t, 3.0, (u) => {
      const w = ss(0.3, 2.6, u);
      const yawn = pulse(2.3, 2.9, 3.6, u);
      const shiver = Math.sin(u * 37) * 0.05 * (1 - w);
      return {
        x: 1385,
        gy: 1006,
        f: -1,
        view: '3q',
        sit: 1,
        crouch: 0.5 * (1 - w),
        chestDY: -6 * w,
        headDY: -4 * w + 6 * yawn,
        tilt: shiver + 0.14 * w - 0.08 * yawn,
        yaw: lerp(0.35, -0.25, w),
        pitch: lerp(0.12, -0.04, w) - 0.12 * yawn,
        earBack: 0.75 * (1 - w),
        earPerk: 0.4 * w,
        earSpread: 0.15 * yawn,
        tailLow: 0.6 * (1 - w),
        tailUp: 0.3 * w,
        wag: 0.04,
        squint: 0.85 * w,
        mouth: yawn,
        lookAt: [lerp(1700, 380, w), lerp(260, 760, w)],
      };
    });
    const cub = rig(CUB, t, 0.95, (u) => ({
      x: 640,
      gy: 948,
      f: 1,
      view: 'front',
      sit: 1,
      tilt: 0.12 * Math.sin(u * 1.3),
      squint: 0.3,
      wag: 0.06,
    }));

    const lamp = { x: 400, y: 760, r: 820, color: look.warmGlow, coreColor: '#FFF6DF', intensity: lerp(0.35, 1.5, warm), rimWidth: 5, softWidth: 24 };
    const windowCool = { x: 1560, y: 260, r: 700, color: look.coolGlow, coreColor: '#EEF2FF', intensity: lerp(1.3, 0.3, warm), rimWidth: 4.2 };
    const lights = [lamp, windowCool];

    beginLayer(0.92);
    skyAndWall(ctx, V, look, lights, t, { horizonY: 930, seed: 307, washCount: 2 });
    drawWindowGlow(ctx, 1430, 150, 250, 270, look, t, {
      arch: true,
      panes: [2, 2],
      outside: '#2C3B6E',
      glow: '#7F93D8',
      frameColor: '#3A2430',
      moon: { x: 0.68, y: 0.3, r: 0.14 },
    });
    // Earthen burrow dome framing the top corners
    ctx.save();
    const dome = ctx.createRadialGradient(960, 900, 500, 960, 900, 1250);
    dome.addColorStop(0, rgba(look.groundDeep, 0));
    dome.addColorStop(0.75, rgba(look.groundDeep, 0.35));
    dome.addColorStop(1, rgba(look.groundDeep, 0.85));
    ctx.fillStyle = dome;
    ctx.fillRect(V.x0, Math.min(0, V.y0), V.x1 - V.x0, DH);
    ctx.restore();
    drawGroundMass(ctx, DW, DH, plankFloor, look, lights, t, {
      x0: V.x0,
      x1: V.x1,
      bottom: V.y1,
      colors: { top: '#9A6650', mid: '#704634', deep: '#3E2626' },
      rimAlpha: 0.3,
      seed: 17,
    });
    ctx.save();
    ctx.strokeStyle = rgba('#2A1418', 0.32);
    ctx.lineWidth = 3;
    for (let i = -6; i <= 6; i++) {
      const xt = 960 + i * 170;
      ctx.beginPath();
      ctx.moveTo(xt, plankFloor(xt) + 2);
      ctx.lineTo(960 + i * 520, V.y1);
      ctx.stroke();
    }
    ctx.restore();
    for (const [x, w, h, seed] of [[300, 120, 62, 91], [430, 140, 70, 92], [530, 96, 50, 93]]) {
      drawStoneMass(ctx, x, plankFloor(x) + 30, w, h, look, lights, { flatTop: 0.45, seed });
    }
    drawGlowMushroom(ctx, 400, plankFloor(400) + 6, 2.5, t, { c1: '#FFE6A8', c2: '#F59E0B', stem: '#F5DCC0', cap: 'flat', glow: 0.6 + 0.8 * warm, phase: 0.5 });
    drawTwilightCritter(ctx, cub, lights, t);
    endLayer();

    beginLayer(1.0);
    drawTwilightCritter(ctx, kitten, lights, t);
    endLayer();

    beginLayer(1.2);
    drawBokehField(ctx, DW, DH, bokeh.hearthFg, t);
    endLayer();
  }

  // -------------------------------------------------------------------------------------------
  // S4 · dawn-window — medium. Outside at mint dawn: the two of them, drowsy, framed by the window; mist lifts.
  // -------------------------------------------------------------------------------------------
  const moundWall = groundProfile([[-60, 660], [380, 470], [960, 318], [1520, 420], [1980, 610]], { rough: 10, seed: 91 });
  const meadowFront = groundProfile([[-60, 990], [560, 972], [1240, 986], [1980, 962]], { rough: 7, seed: 92 });
  const WIN = { x: 790, y: 420, w: 340, h: 370 };

  function dawnWindow(ctx, V, t, look, beginLayer, endLayer) {
    const lift = ss(0.0, 3.0, t);
    const sun = { x: 1700, y: 90, r: 900, color: look.warmGlow, coreColor: '#FFFFFF', intensity: 1.1 };
    const inner = { x: WIN.x + WIN.w * 0.5, y: WIN.y + WIN.h + 40, r: 360, color: '#FFC27A', coreColor: '#FFF3D6', intensity: 1.3, rimWidth: 3.4 };
    const lights = [sun, { x: 200, y: 300, r: 700, color: look.coolGlow, intensity: 0.6 }];
    const gyIn = WIN.y + WIN.h + 12;
    const cub = rig(CUB, t, 0.86, (u) => ({
      x: WIN.x + 118,
      gy: gyIn,
      f: 1,
      view: 'front',
      sit: 1,
      chestDY: Math.sin(u * 1.6) * 1.5,
      tilt: 0.14,
      pitch: 0.12,
      squint: 1,
      wag: 0.03,
    }));
    const kitten = rig(KITTEN, t, 0.78, (u) => ({
      x: WIN.x + 236,
      gy: gyIn,
      f: -1,
      view: 'front',
      sit: 1,
      chestDY: Math.sin(u * 1.6 + 1.2) * 1.5,
      tilt: -0.3,
      pitch: 0.14,
      earBack: 0.2,
      squint: 1,
      tailUp: 0.2,
      wag: 0.05,
    }));

    beginLayer(0.9);
    skyAndWall(ctx, V, look, lights, t, { horizonY: 640, seed: 419, washCount: 3 });
    glowDot(ctx, 1700, 60, 220, look.warmGlow, 0.8);
    drawLightShafts(ctx, 1700, 60, { angle: Math.PI * 0.72, spread: 0.55, count: 6, length: 1300, width: [30, 220], color: look.warmGlow, alpha: 0.16, seed: 23 }, t);
    endLayer();

    beginLayer(1.0);
    drawGroundMass(ctx, DW, DH, moundWall, look, lights, t, { x0: V.x0, x1: V.x1, bottom: V.y1, speckles: 160, seed: 19 });
    drawGrassTufts(ctx, moundWall, V.x0, V.x1, { density: 3.4, height: [20, 52], colors: [look.groundDeep, look.foliageGlow], glowTips: true, lean: -0.1, seed: 93 }, t);
    drawWindowGlow(ctx, WIN.x, WIN.y, WIN.w, WIN.h, look, t, {
      arch: true,
      panes: [1, 1],
      outside: '#B97A5E',
      glow: '#FFD089',
      frameColor: '#35423F',
    });
    ctx.save();
    traceArch(ctx, WIN.x, WIN.y, WIN.w, WIN.h);
    ctx.clip();
    glowDot(ctx, inner.x, WIN.y + WIN.h - 30, 260, '#FFC27A', 0.7);
    drawTwilightCritter(ctx, cub, [inner, sun], t);
    drawTwilightCritter(ctx, kitten, [inner, sun], t);
    ctx.restore();
    // Window frame and mullion over the sleepers
    ctx.save();
    ctx.strokeStyle = '#35423F';
    ctx.lineWidth = 17;
    traceArch(ctx, WIN.x, WIN.y, WIN.w, WIN.h);
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(WIN.x + WIN.w * 0.5, WIN.y + 6);
    ctx.lineTo(WIN.x + WIN.w * 0.5, WIN.y + WIN.w * 0.42);
    ctx.stroke();
    ctx.restore();
    drawStoneMass(ctx, WIN.x + WIN.w * 0.5, WIN.y + WIN.h + 34, WIN.w + 90, 52, look, lights, { flatTop: 0.9, moss: { coverage: 0.3 }, seed: 95 });
    for (const [dx, dy, w, h, seed] of [[-36, 330, 70, 60, 96], [-40, 230, 56, 62, 97], [WIN.w + 36, 334, 74, 58, 98], [WIN.w + 40, 236, 52, 60, 99]]) {
      drawStoneMass(ctx, WIN.x + dx, WIN.y + dy, w, h, look, lights, { flatTop: 0.25, moss: { coverage: 0.45 }, seed });
    }
    drawFogLayer(ctx, DW, lerp(840, 700, lift), 300, { color: look.mistColor, alpha: lerp(0.55, 0.18, lift), puffs: 9, seed: 31, speed: 22 }, t);
    drawGroundMass(ctx, DW, DH, meadowFront, look, lights, t, {
      x0: V.x0,
      x1: V.x1,
      bottom: V.y1,
      colors: { top: look.foliageMid, mid: look.foliageDark, deep: look.groundDeep },
      speckles: 80,
      seed: 21,
    });
    drawGrassTufts(ctx, meadowFront, V.x0, V.x1, { density: 4, height: [30, 80], colors: [look.foliageDark, look.foliageGlow], glowTips: true, seed: 94 }, t);
    endLayer();

    beginLayer(1.15);
    drawBokehField(ctx, DW, DH, bokeh.dew, t);
    endLayer();
  }

  const RENDER = {
    'fog-wood': fogWood,
    'mound-door': moundDoor,
    'hearth-warm': hearthWarm,
    'dawn-window': dawnWindow,
  };

  return {
    canvas: studio.canvas,
    storyboard: director.storyboard,
    async render(frame) {
      director.update(frame);
      const look = stage.resolveLook(frame);
      const id = frame.sceneId || frame.scene?.id || scenes[frame.sceneIndex ?? 0]?.id;
      const t = clamp(frame.localT ?? 0, 0, 20);
      const V = visibleRect(width, height);
      studio.render(frame, ({ ctx, beginLayer, endLayer }) => {
        const fn = RENDER[id] || fogWood;
        fn(ctx, V, t, look, beginLayer, endLayer);
      });
    },
  };
}
