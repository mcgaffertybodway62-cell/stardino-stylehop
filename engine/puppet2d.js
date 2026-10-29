/**
 * Style-agnostic 2D Character Puppet & Hierarchical Skeleton Solver (`engine/puppet2d.js`).
 *
 * Mirrors the architecture of 3D `engine/puppet.js` for 2D / 2.5D Canvas styles
 * (such as `ink-wash`, shadow-puppetry, paper-cut, cel-animation, or flat vector illustration).
 *
 * A 2D character is a hierarchical 26-joint Forward Kinematics (FK) + secondary cloth/prop
 * pendulum rig with a fixed anatomical naming contract and a vertical 0-radian limb convention
 * (`Math.PI * 0.5` = straight down). Any 2D style hangs its own brush strokes, vector paths,
 * or paper-cut shapes onto the solved `skel` joint coordinates via `skin(ctx, skel, state, t)`.
 *
 * Joint Hierarchy (character stands with feet on `y = 0`, facing +x when `facing = 1`):
 *   - Axial Chain (8 joints):
 *       `root (0,0) -> pelvis -> lumbar -> thorax -> neckBase -> headPivot -> headTop -> topKnotTip`
 *   - Upper Limb Chains (8 joints, 0 rad = straight down `Math.PI * 0.5`):
 *       `neckBase -> shL -> elL -> wrL -> handTipL`
 *       `neckBase -> shR -> elR -> wrR -> handTipR`
 *   - Lower Limb Chains (10 joints, 0 rad = straight down `Math.PI * 0.5`):
 *       `pelvis -> hipL -> kneeL -> ankleL -> heelL / toeL`
 *       `pelvis -> hipR -> kneeR -> ankleR -> heelR / toeR`
 *   - Secondary Gravity Cloth & Flexible Prop Chains (17 nodes):
 *       Left/Right Wide Sleeves: `wrL -> slMidL -> slTipL`, `wrR -> slMidR -> slTipR`
 *       Robe Train:              `lumbar -> trainB1 -> trainB2 -> trainTip`
 *       Nape Hair Ribbon:        `headTop -> hairB1 -> hairB2 -> hairB3`
 *       Waist Sash Ribbon:       `lumbar -> sashB1 -> sashB2 -> sashB3`
 *       Articulated Bamboo Rod:  `wrR -> rodNodes[1..4] (rodTipLocal / rodTipWorld)`
 *
 * Built-in Deterministic Acting Vocabulary (`puppet.act(localT, actions)`):
 *   - `walk`:       Full bipedal gait cycle with opposite thigh swing, knee flexion on swing phase,
 *                   ankle pitch, pelvis shift, and natural counter-swing of arms.
 *   - `drink`:      Natural human V-fold elbow drinking posture (`shRAng = -0.86, elRAng = 2.52`)
 *                   bringing the wrist and cup to the mouth while tilting the head back.
 *   - `toast` / `inviteMoon`: Raises the right arm high toward the sky (`举杯邀月`).
 *   - `sigh`:       Bows spine and neck, drops shoulders and wrists, emits `sighMist` / `sighProgress`.
 *   - `castRod`:    3-phase angler fishing cast (windup -> forward whip -> settled hold).
 *   - `wieldSword`: Martial lunge stance with deep front knee bend and extended sword arm.
 *   - `bow`:        Respectful torso & head bow with clasped/folded forearms.
 *   - `wave` / `paint` / `reach`, `playQin` / `row`, `hop`, `look` / `face`, `mood`, and
 *   - `pose`:       Arbitrary custom joint angle targets (`{ do: 'pose', joints: { shRAng, elRAng, ... } }`).
 */

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smootherstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function flowStep(edge0, edge1, x, ease = 0.22) {
  const u = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  const s = u * u * (3 - 2 * u);
  return u + (s - u) * ease;
}

function rgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(0,0,0,${alpha})`;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${clamp(alpha, 0, 1)})`;
}

export function evalSquashStretch2D(squash = 0) {
  const s = clamp(squash, -0.45, 0.45);
  return {
    sx: 1 + s * 0.35,
    sy: 1 - s * 0.35,
  };
}

function evalHopParabola2D(u, x0, y0, x1, y1, height = 65) {
  const t = clamp(u, 0, 1);
  const x = lerp(x0, x1, t);
  const baseY = lerp(y0, y1, t);
  const arc = 4 * height * t * (1 - t);
  let squash = 0;
  if (t < 0.12) squash = Math.sin((t / 0.12) * Math.PI) * 0.22;
  else if (t > 0.88) squash = Math.sin(((t - 0.88) / 0.12) * Math.PI) * 0.26;
  return { x, y: baseY - arc, squash };
}

/** Default human anatomical segment proportions (in local character units, total height ~248px). */
export const DEFAULT_HUMANOID_DIMS = Object.freeze({
  pelvisHeight: 144,
  lumbarLen: 14,
  thoraxLen: 24,
  neckBaseLen: 18,
  headPivotLen: 11,
  headTopLen: 22,
  topKnotLen: 15,
  shoulderWidthL: 11,
  shoulderWidthR: 9,
  upperArmL: 25,
  forearmL: 24,
  handL: 10,
  upperArmR: 28,
  forearmR: 27,
  handR: 12,
  hipOffset: 5,
  thighLen: 70,
  shinLen: 68,
  footLen: 15,
  heelLen: 5,
  sleeveSeg1L: 22,
  sleeveSeg2L: 20,
  sleeveSeg1R: 24,
  sleeveSeg2R: 22,
  rodSegLen: 40,
});

/**
 * Renders the 26-joint 2D hierarchical skeleton rig (`drawSkeleton2D`)
 * using Spine2D / Blender octahedral bone diamonds and color-coded joint circles.
 */
export function drawSkeleton2D(ctx, skel, state = {}) {
  const drawBone = (p1, p2, color, width = 2.2, dashed = false) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = rgba(color, 0.22);
    ctx.lineWidth = width;
    if (dashed) {
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else {
      const nx = -dy / len;
      const ny = dx / len;
      const w = Math.min(4.2, len * 0.14);
      const mx = p1.x + dx * 0.28;
      const my = p1.y + dy * 0.28;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(mx + nx * w, my + ny * w);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(mx - nx * w, my - ny * w);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawJoint = (p, r, fill, stroke = '#FFFFFF') => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  };

  // 1. Secondary Cloth, Sleeve, Train & Ribbon Bone Chains (Cyan/Teal dashed bones)
  const clothCol = '#0EA5E9';
  drawBone(skel.wrL, skel.slMidL, clothCol, 1.5, true);
  drawBone(skel.slMidL, skel.slTipL, clothCol, 1.5, true);
  drawBone(skel.wrR, skel.slMidR, clothCol, 1.5, true);
  drawBone(skel.slMidR, skel.slTipR, clothCol, 1.5, true);
  drawBone(skel.lumbar, skel.trainB1, clothCol, 1.5, true);
  drawBone(skel.trainB1, skel.trainB2, clothCol, 1.5, true);
  drawBone(skel.trainB2, skel.trainTip, clothCol, 1.5, true);
  drawBone(skel.headTop, skel.hairB1, clothCol, 1.2, true);
  drawBone(skel.hairB1, skel.hairB2, clothCol, 1.2, true);
  drawBone(skel.hairB2, skel.hairB3, clothCol, 1.2, true);
  drawBone(skel.lumbar, skel.sashB1, clothCol, 1.2, true);
  drawBone(skel.sashB1, skel.sashB2, clothCol, 1.2, true);
  drawBone(skel.sashB2, skel.sashB3, clothCol, 1.2, true);
  for (const jp of [
    skel.slMidL, skel.slTipL, skel.slMidR, skel.slTipR,
    skel.trainB1, skel.trainB2, skel.trainTip,
    skel.hairB1, skel.hairB2, skel.hairB3,
    skel.sashB1, skel.sashB2, skel.sashB3,
  ]) {
    drawJoint(jp, 2.2, clothCol);
  }

  // 2. Left (Rear) Leg & Arm Bones (Deep Indigo/Slate bones)
  const leftLimbCol = '#4F46E5';
  drawBone(skel.pelvis, skel.hipL, leftLimbCol, 1.8);
  drawBone(skel.hipL, skel.kneeL, leftLimbCol, 2.2);
  drawBone(skel.kneeL, skel.ankleL, leftLimbCol, 2.0);
  drawBone(skel.ankleL, skel.heelL, leftLimbCol, 1.6);
  drawBone(skel.ankleL, skel.toeL, leftLimbCol, 1.8);

  drawBone(skel.neckBase, skel.shL, leftLimbCol, 1.8);
  drawBone(skel.shL, skel.elL, leftLimbCol, 2.1);
  drawBone(skel.elL, skel.wrL, leftLimbCol, 1.9);
  drawBone(skel.wrL, skel.handTipL, leftLimbCol, 1.6);
  for (const jp of [skel.hipL, skel.kneeL, skel.ankleL, skel.toeL, skel.shL, skel.elL, skel.wrL, skel.handTipL]) {
    drawJoint(jp, 2.8, leftLimbCol);
  }

  // 3. Axial Spine & Head Chain (`root -> pelvis -> lumbar -> thorax -> neckBase -> headPivot -> headTop -> topKnotTip`)
  const spineCol = '#D97706';
  drawBone(skel.root, skel.pelvis, rgba(spineCol, 0.45), 1.2, true);
  drawBone(skel.pelvis, skel.lumbar, spineCol, 2.4);
  drawBone(skel.lumbar, skel.thorax, spineCol, 2.4);
  drawBone(skel.thorax, skel.neckBase, spineCol, 2.2);
  drawBone(skel.neckBase, skel.headPivot, spineCol, 2.0);
  drawBone(skel.headPivot, skel.headTop, spineCol, 2.2);
  drawBone(skel.headTop, skel.topKnotTip, spineCol, 1.8);
  for (const jp of [skel.root, skel.pelvis, skel.lumbar, skel.thorax, skel.neckBase, skel.headPivot, skel.headTop, skel.topKnotTip]) {
    drawJoint(jp, jp === skel.pelvis || jp === skel.neckBase ? 3.6 : 2.8, spineCol);
  }

  // 4. Right (Lead/Foreground) Leg & Arm Bones (Cinnabar Vermilion bones)
  const rightLimbCol = '#DC2626';
  drawBone(skel.pelvis, skel.hipR, rightLimbCol, 1.8);
  drawBone(skel.hipR, skel.kneeR, rightLimbCol, 2.3);
  drawBone(skel.kneeR, skel.ankleR, rightLimbCol, 2.1);
  drawBone(skel.ankleR, skel.heelR, rightLimbCol, 1.6);
  drawBone(skel.ankleR, skel.toeR, rightLimbCol, 1.9);

  drawBone(skel.neckBase, skel.shR, rightLimbCol, 1.8);
  drawBone(skel.shR, skel.elR, rightLimbCol, 2.3);
  drawBone(skel.elR, skel.wrR, rightLimbCol, 2.1);
  drawBone(skel.wrR, skel.handTipR, rightLimbCol, 1.8);
  for (const jp of [skel.hipR, skel.kneeR, skel.ankleR, skel.toeR, skel.shR, skel.elR, skel.wrR, skel.handTipR]) {
    drawJoint(jp, 3.0, rightLimbCol);
  }

  // 5. Prop Bone Chain (Emerald Green)
  if (state.heldProp === 'rod' && skel.rodNodes) {
    const propCol = '#059669';
    for (let i = 0; i < skel.rodNodes.length - 1; i++) {
      drawBone(skel.rodNodes[i], skel.rodNodes[i + 1], propCol, 1.8 - i * 0.2);
      drawJoint(skel.rodNodes[i + 1], 2.2, propCol);
    }
  }
}

/**
 * Recursively interpolates two pose objects/arrays/numbers (`mixPose2D`),
 * enabling smooth blending between any two custom keyframe pose dictionaries.
 */
export function mixPose2D(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
  if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => mixPose2D(x, b[i], t));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out = {};
    for (const k of Object.keys(b)) {
      out[k] = k in a ? mixPose2D(a[k], b[k], t) : b[k];
    }
    return out;
  }
  return t < 0.5 ? a : b;
}

/**
 * Creates a style-agnostic 2D character puppet (`createPuppet2D`).
 *
 * @param {object} opts
 * @param {function} [opts.skin] - Style-specific skinning callback `(ctx, skel, state, t) => void`
 * @param {object} [opts.dims] - Optional custom anatomical segment lengths overriding `DEFAULT_HUMANOID_DIMS`
 */
export function createPuppet2D(opts = {}) {
  const dims = { ...DEFAULT_HUMANOID_DIMS, ...(opts.dims || {}) };
  let skinFn = typeof opts.skin === 'function' ? opts.skin : null;

  const state = {
    archetype: opts.archetype || 'scholar',
    view: opts.view || 'side', // 'side' | 'front' | 'back'
    renderMode: opts.renderMode || 'baimiao', // 'baimiao' | 'xieyi'
    x: opts.x ?? 600,
    y: opts.y ?? 700,
    baseX: opts.x ?? 600,
    baseY: opts.y ?? 700,
    scale: opts.scale ?? 1.0,
    facing: opts.facing ?? 1, // 1 = facing right, -1 = facing left
    robeColor: opts.robeColor || '#FFFFFF',
    innerColor: opts.innerColor || '#ECE7DC',
    sashColor: opts.sashColor || '#FFFFFF',
    strokeColor: opts.strokeColor || '#292524',
    hat: opts.hat ?? (opts.archetype === 'angler' ? 'bamboo' : opts.archetype === 'child' ? 'topknot' : 'scholar'),
    heldProp: opts.heldProp ?? 'none', // 'none' | 'staff' | 'fan' | 'brush' | 'sword' | 'rod' | 'cup' | 'scroll'
    waistSword: opts.waistSword ?? (opts.archetype === 'scholar' && opts.heldProp === 'cup'),
    beard: opts.beard ?? false,
    mood: opts.mood || 'calm',
    showSkeleton: opts.showSkeleton ?? false, // false | true | 'overlay' | 'wireframe'
    // Complete 2D Hierarchical Skeleton Joint State (Zero = vertically downward `Math.PI * 0.5`)
    walkPhase: 0,
    stride: 0,
    hopY: 0,
    squash: 0,
    pelvisShiftX: 0,
    pelvisDropY: 0,
    spineAngle: 0,      // Axial spine lean (+ = bow forward, - = lean back)
    headAngle: -0.02,   // Neck & skull tilt (- = gaze upward, + = bow head)
    // Left (Rear/Side) Arm Chain: neckBase -> shL -> elL -> wrL -> handTipL
    shLAng: 0.16,       // Left upper arm angle (+ = rear/left, - = front/right)
    elLAng: 0.32,       // Left forearm flexion (>= 0 bends forward/up)
    handLAng: 0.05,     // Left wrist/hand angle
    // Right (Lead/Foreground) Arm Chain: neckBase -> shR -> elR -> wrR -> handTipR
    shRAng: -0.22,      // Right upper arm angle (- = raise forward/up, + = rear)
    elRAng: 1.05,       // Right forearm flexion (>= 0 bends forward/up toward chest/mouth)
    handRAng: 0.08,     // Right wrist/hand angle
    // Left (Rear) Leg Chain: hipL -> kneeL -> ankleL -> heelL/toeL
    thighLAng: 0.04,    // Left thigh angle from vertical (+ = back/left, - = forward/right)
    kneeLAng: 0.02,     // Left knee flexion (>= 0, anatomical knee bend backward)
    footLAng: 0.0,      // Left foot pitch
    // Right (Foreground) Leg Chain: hipR -> kneeR -> ankleR -> heelR/toeR
    thighRAng: -0.04,   // Right thigh angle from vertical (- = forward/right, + = back/left)
    kneeRAng: 0.02,     // Right knee flexion (>= 0, anatomical knee bend backward)
    footRAng: 0.0,      // Right foot pitch
    // Secondary Action & Physics states
    sighMist: 0,
    sighProgress: 0,
    rodBend: 0,
    swordSlash: 0,
    lastRodTip: { x: (opts.x ?? 600) + 180, y: (opts.y ?? 700) - 160 },
  };

  function resetPose(hasLocomotion = false) {
    state.view = opts.view || 'side';
    if (hasLocomotion) {
      state.x = state.baseX;
      state.y = state.baseY;
    }
    state.walkPhase = 0;
    state.stride = 0;
    state.hopY = 0;
    state.squash = 0;
    state.pelvisShiftX = 0;
    state.pelvisDropY = 0;
    state.spineAngle = 0;
    state.headAngle = -0.02;

    // Natural upright bipedal standing posture
    state.thighLAng = 0.04;
    state.kneeLAng = 0.02;
    state.footLAng = 0.0;
    state.thighRAng = -0.04;
    state.kneeRAng = 0.02;
    state.footRAng = 0.0;

    // Left arm naturally hangs at side slightly flexed
    state.shLAng = 0.16;
    state.elLAng = 0.32;
    state.handLAng = 0.05;

    // Right arm posture based on held prop
    if (state.heldProp === 'none') {
      state.shRAng = -0.10;
      state.elRAng = 0.28;
      state.handRAng = 0.0;
    } else if (
      state.heldProp === 'cup' ||
      state.heldProp === 'fan' ||
      state.heldProp === 'scroll' ||
      state.heldProp === 'brush'
    ) {
      state.shRAng = -0.22;
      state.elRAng = 1.05;
      state.handRAng = 0.08;
    } else if (state.heldProp === 'rod' || state.heldProp === 'staff' || state.heldProp === 'sword') {
      state.shRAng = -0.45;
      state.elRAng = 0.75;
      state.handRAng = 0.0;
    } else {
      state.shRAng = -0.10;
      state.elRAng = 0.28;
      state.handRAng = 0.0;
    }

    state.sighMist = 0;
    state.sighProgress = 0;
    state.rodBend = 0;
    state.swordSlash = 0;
    state.mood = opts.mood || 'calm';
  }

  function solveSkeleton(breeze = 0, t = 0) {
    const isChild = state.archetype === 'child';
    const sc = state.scale * (isChild ? 0.78 : 1.0);
    const breathPhase = t * 2.35 + state.baseX * 0.013;
    const breathLift = Math.sin(breathPhase) * 1.15;
    const breathPitch = Math.sin(breathPhase - 0.45) * 0.012;

    // 1. Root & Pelvis
    const root = { x: 0, y: 0 };
    const pelvis = {
      x: state.pelvisShiftX,
      y: -dims.pelvisHeight + state.pelvisDropY,
    };

    // 2. Multi-Segment Axial Spine (`pelvis -> lumbar -> thorax -> neckBase -> headPivot -> headTop -> topKnotTip`)
    const aLumbar = state.spineAngle * 0.45 + breathPitch * 0.35;
    const lumbar = {
      x: pelvis.x + Math.sin(aLumbar) * dims.lumbarLen,
      y: pelvis.y - Math.cos(aLumbar) * dims.lumbarLen,
    };

    const aThorax = state.spineAngle * 0.82 + breathPitch * 0.75;
    const thorax = {
      x: lumbar.x + Math.sin(aThorax) * dims.thoraxLen,
      y: lumbar.y - Math.cos(aThorax) * dims.thoraxLen - breathLift * 0.65,
    };

    const aSpineTop = state.spineAngle + breathPitch;
    const neckBase = {
      x: thorax.x + Math.sin(aSpineTop) * dims.neckBaseLen,
      y: thorax.y - Math.cos(aSpineTop) * dims.neckBaseLen - breathLift * 0.35,
    };

    const aNeck = state.spineAngle + state.headAngle * 0.45 + breathPitch * 0.6;
    const headPivot = {
      x: neckBase.x + Math.sin(aNeck) * dims.headPivotLen,
      y: neckBase.y - Math.cos(aNeck) * dims.headPivotLen,
    };

    const aHead = state.spineAngle + state.headAngle + breathPitch * 0.4;
    const headTop = {
      x: headPivot.x + Math.sin(aHead) * dims.headTopLen,
      y: headPivot.y - Math.cos(aHead) * dims.headTopLen,
    };

    const aTopKnot = aHead - 0.06;
    const topKnotTip = {
      x: headTop.x + Math.sin(aTopKnot) * dims.topKnotLen,
      y: headTop.y - Math.cos(aTopKnot) * dims.topKnotLen,
    };

    // 3. Bilateral Clavicles & Upper Limb Chains (`sh -> el -> wr -> handTip`)
    const cosT = Math.cos(aThorax);
    const sinT = Math.sin(aThorax);
    const shL = {
      x: neckBase.x - dims.shoulderWidthL * cosT,
      y: neckBase.y + 5 - dims.shoulderWidthL * sinT,
    };
    const shR = {
      x: neckBase.x + dims.shoulderWidthR * cosT,
      y: neckBase.y + 4 + dims.shoulderWidthR * sinT,
    };

    // Left Arm FK (0 rad = vertically downward `Math.PI * 0.5`)
    const aL1 = Math.PI * 0.5 + state.shLAng + aThorax * 0.5;
    const aL2 = aL1 - state.elLAng;
    const aL3 = aL2 - state.handLAng;
    const elL = { x: shL.x + Math.cos(aL1) * dims.upperArmL, y: shL.y + Math.sin(aL1) * dims.upperArmL };
    const wrL = { x: elL.x + Math.cos(aL2) * dims.forearmL, y: elL.y + Math.sin(aL2) * dims.forearmL };
    const handTipL = { x: wrL.x + Math.cos(aL3) * dims.handL, y: wrL.y + Math.sin(aL3) * dims.handL };

    // Right Arm FK (0 rad = vertically downward `Math.PI * 0.5`)
    const aR1 = Math.PI * 0.5 + state.shRAng + aThorax * 0.5;
    const aR2 = aR1 - state.elRAng;
    const aR3 = aR2 - state.handRAng;
    const elR = { x: shR.x + Math.cos(aR1) * dims.upperArmR, y: shR.y + Math.sin(aR1) * dims.upperArmR };
    const wrR = { x: elR.x + Math.cos(aR2) * dims.forearmR, y: elR.y + Math.sin(aR2) * dims.forearmR };
    const handTipR = { x: wrR.x + Math.cos(aR3) * dims.handR, y: wrR.y + Math.sin(aR3) * dims.handR };

    // 4. Bilateral Lower Limb Chains (`hip -> knee -> ankle -> heel/toe`)
    const hipL = { x: pelvis.x - dims.hipOffset, y: pelvis.y + 4 };
    const hipR = { x: pelvis.x + dims.hipOffset, y: pelvis.y + 4 };

    // Left (Rear) Leg FK
    const aThighL = Math.PI * 0.5 + state.thighLAng;
    const aShinL = aThighL + Math.max(0, state.kneeLAng);
    const kneeL = {
      x: hipL.x + Math.cos(aThighL) * dims.thighLen,
      y: hipL.y + Math.sin(aThighL) * dims.thighLen,
    };
    const ankleL = {
      x: kneeL.x + Math.cos(aShinL) * dims.shinLen,
      y: Math.min(-3, kneeL.y + Math.sin(aShinL) * dims.shinLen),
    };
    const aFootL = state.footLAng;
    const heelL = { x: ankleL.x - Math.cos(aFootL) * dims.heelLen, y: Math.min(0, ankleL.y + 3) };
    const toeL = {
      x: ankleL.x + Math.cos(aFootL) * dims.footLen,
      y: Math.min(0, ankleL.y + Math.sin(aFootL) * dims.footLen + 3),
    };

    // Right (Foreground) Leg FK
    const aThighR = Math.PI * 0.5 + state.thighRAng;
    const aShinR = aThighR + Math.max(0, state.kneeRAng);
    const kneeR = {
      x: hipR.x + Math.cos(aThighR) * dims.thighLen,
      y: hipR.y + Math.sin(aThighR) * dims.thighLen,
    };
    const ankleR = {
      x: kneeR.x + Math.cos(aShinR) * dims.shinLen,
      y: Math.min(-3, kneeR.y + Math.sin(aShinR) * dims.shinLen),
    };
    const aFootR = state.footRAng;
    const heelR = { x: ankleR.x - Math.cos(aFootR) * dims.heelLen, y: Math.min(0, ankleR.y + 3) };
    const toeR = {
      x: ankleR.x + Math.cos(aFootR) * dims.footLen,
      y: Math.min(0, ankleR.y + Math.sin(aFootR) * dims.footLen + 3),
    };

    // 5. Secondary Cloth, Wide-Sleeve & Ribbon Pendulum Bone Chains
    const clothWave1 = Math.sin(t * 2.6 + state.baseX * 0.017) * 0.028;
    const clothWave2 = Math.sin(t * 2.6 - 0.85 + state.baseX * 0.017) * 0.042;
    const windRad = breeze * 0.025;
    const aSlL1 = Math.PI * 0.5 + 0.06 + windRad * 0.6 + clothWave1;
    const aSlL2 = aSlL1 + 0.04 + windRad * 0.8 + clothWave2;
    const slMidL = { x: wrL.x + Math.cos(aSlL1) * dims.sleeveSeg1L, y: wrL.y + Math.sin(aSlL1) * dims.sleeveSeg1L };
    const slTipL = { x: slMidL.x + Math.cos(aSlL2) * dims.sleeveSeg2L, y: slMidL.y + Math.sin(aSlL2) * dims.sleeveSeg2L };

    const aSlR1 = Math.PI * 0.5 + 0.08 + windRad * 0.6 + clothWave1 * 1.1;
    const aSlR2 = aSlR1 + 0.06 + windRad * 0.8 + clothWave2 * 1.15;
    const slBaseX = Math.max(wrR.x, lerp(wrR.x, elR.x, 0.55));
    const slBaseY = Math.max(wrR.y, lerp(wrR.y, elR.y, 0.45));
    const slMidR = { x: slBaseX + Math.cos(aSlR1) * dims.sleeveSeg1R, y: slBaseY + Math.sin(aSlR1) * dims.sleeveSeg1R };
    const slTipR = { x: slMidR.x + Math.cos(aSlR2) * dims.sleeveSeg2R, y: slMidR.y + Math.sin(aSlR2) * dims.sleeveSeg2R };

    const trainB1 = {
      x: lerp(lumbar.x, kneeL.x, 0.5) - 11 - breeze * 0.3,
      y: lumbar.y + 48,
    };
    const trainB2 = {
      x: lerp(kneeL.x, ankleL.x, 0.6) - 13 - breeze * 0.6,
      y: lumbar.y + 98,
    };
    const trainTip = {
      x: Math.min(ankleL.x, ankleR.x) - 16 - breeze * 0.9 - Math.max(0, state.stride) * 0.35,
      y: -6,
    };

    const hairB1 = { x: headTop.x - 10 - breeze * 0.35, y: headTop.y + 16 };
    const hairB2 = { x: headTop.x - 18 - breeze * 0.75, y: headTop.y + 34 };
    const hairB3 = { x: headTop.x - 26 - breeze * 1.2, y: headTop.y + 52 };

    const sashB1 = { x: lumbar.x - 8 - breeze * 0.35, y: lumbar.y + 20 };
    const sashB2 = { x: lumbar.x - 15 - breeze * 0.75, y: lumbar.y + 42 };
    const sashB3 = { x: lumbar.x - 22 - breeze * 1.2, y: lumbar.y + 62 };

    // 6. 4-Segment Flexible Bamboo Fishing Rod Chain (`wrR -> rodNodes[1..4]`)
    const rodBaseAng = -0.48 + (aR2 - (Math.PI * 0.5 - 1.2)) * 0.55;
    const rodNodes = [wrR];
    let curX = wrR.x;
    let curY = wrR.y;
    for (let i = 1; i <= 4; i++) {
      const uSeg = i / 4;
      const segAng = rodBaseAng + (0.06 * uSeg + state.rodBend * 0.28 * uSeg * uSeg);
      curX += Math.cos(segAng) * dims.rodSegLen;
      curY += Math.sin(segAng) * dims.rodSegLen;
      rodNodes.push({ x: curX, y: curY, angle: segAng });
    }
    const rodTipLocal = rodNodes[4];

    return {
      sc,
      breeze,
      dims,
      // Axial
      root,
      pelvis,
      lumbar,
      thorax,
      neckBase,
      headPivot,
      headTop,
      topKnotTip,
      aLumbar,
      aThorax,
      aNeck,
      aHead,
      // Upper limbs
      shL,
      elL,
      wrL,
      handTipL,
      aL1,
      aL2,
      aL3,
      shR,
      elR,
      wrR,
      handTipR,
      aR1,
      aR2,
      aR3,
      // Lower limbs
      hipL,
      kneeL,
      ankleL,
      heelL,
      toeL,
      aThighL,
      aShinL,
      hipR,
      kneeR,
      ankleR,
      heelR,
      toeR,
      aThighR,
      aShinR,
      // Secondary cloth & prop chains
      slMidL,
      slTipL,
      slMidR,
      slTipR,
      trainB1,
      trainB2,
      trainTip,
      hairB1,
      hairB2,
      hairB3,
      sashB1,
      sashB2,
      sashB3,
      rodNodes,
      rodAng: rodBaseAng + state.rodBend * 0.22,
      rodTipLocal,
      rodTipWorld: {
        x: state.x + rodTipLocal.x * sc * state.facing,
        y: state.y + state.hopY + rodTipLocal.y * sc,
      },
    };
  }

  function act(localT, actions = []) {
    const hasLocomotion = actions.some((a) => a.do === 'walk' || a.do === 'leap');
    resetPose(hasLocomotion);
    for (const a of actions) {
      if (a.do === 'walk') {
        if (a.fromX != null) state.x = a.fromX;
        if (a.fromY != null) state.y = a.fromY;
        break;
      }
    }
    for (const a of actions) {
      const from = a.from ?? a.at ?? 0;
      const to = a.to ?? (a.at != null ? a.at + (a.dur ?? 0.6) : 999);
      if (localT < from) continue;
      if (a.view) state.view = a.view;
      const u = clamp((localT - from) / Math.max(0.001, to - from), 0, 1);
      const k = smootherstep(0, 1, u);
      const kFlow = flowStep(0, 1, u, a.ease ?? 0.22);

      if (a.do === 'walk') {
        const fx = a.fromX ?? state.x;
        const tx = a.toX ?? (a.dest ? a.dest[0] : state.x);
        const fy = a.fromY ?? state.y;
        const ty = a.toY ?? (a.dest && a.dest[1] != null ? a.dest[1] : state.y);
        state.x = lerp(fx, tx, kFlow);
        state.y = lerp(fy, ty, kFlow);
        if (Math.abs(tx - fx) > 2) state.facing = tx >= fx ? 1 : -1;
        if (localT <= to) {
          const ph = (localT - from) * 5.6;
          state.walkPhase = ph;
          state.stride = Math.sin(ph) * 12;
          state.hopY = -Math.abs(Math.sin(ph)) * 2.2;
          state.pelvisShiftX = Math.sin(ph) * 2.0;
          state.spineAngle = 0.03 + Math.sin(ph * 2) * 0.015;
          state.thighRAng = -Math.sin(ph) * 0.24;
          state.kneeRAng = Math.max(0, Math.cos(ph - 0.35)) * 0.38;
          state.footRAng = -Math.sin(ph) * 0.14;
          state.thighLAng = Math.sin(ph) * 0.24;
          state.kneeLAng = Math.max(0, -Math.cos(ph - 0.35)) * 0.38;
          state.footLAng = Math.sin(ph) * 0.14;
          state.shLAng = 0.14 + Math.sin(ph) * 0.22;
          state.elLAng = 0.32 + Math.max(0, -Math.sin(ph)) * 0.18;
          state.shRAng = (state.heldProp === 'cup' ? -0.22 : -0.08) - Math.sin(ph) * 0.18;
          state.elRAng = (state.heldProp === 'cup' ? 1.05 : 0.28) - Math.cos(ph) * 0.10;
        }
      } else if (a.do === 'hop') {
        if (localT <= to) {
          const hop = evalHopParabola2D(u, state.x, 0, a.toX ?? state.x, 0, a.height ?? 65);
          state.x = hop.x;
          state.hopY = hop.y;
          state.squash = hop.squash;
          const air = Math.sin(u * Math.PI);
          state.thighRAng = -0.25 * air;
          state.kneeRAng = 0.48 * air;
          state.thighLAng = 0.18 * air;
          state.kneeLAng = 0.42 * air;
        } else if (a.toX != null) {
          state.x = a.toX;
        }
      } else if (a.do === 'look' || a.do === 'face') {
        if (a.facing != null) state.facing = a.facing;
        if (a.tilt != null && localT <= to) state.headAngle = a.tilt * Math.sin(u * Math.PI);
      } else if (a.do === 'drink') {
        if (localT <= to) {
          const env = a.hold ? smootherstep(0, 0.6, u) : Math.sin(u * Math.PI);
          const amt = a.amount ?? 1.0;
          state.shRAng = lerp(-0.22, -0.86 * amt, env);
          state.elRAng = lerp(1.05, 2.52 * amt, env);
          state.handRAng = lerp(0.08, 0.48 * amt, env);
          state.headAngle = lerp(-0.02, -0.34 * amt, env);
          state.spineAngle = lerp(0, -0.05 * amt, env);
          state.shLAng = lerp(0.16, 0.20, env);
          state.elLAng = lerp(0.32, 0.38, env);
          state.thighLAng = 0.04;
          state.thighRAng = -0.04;
          state.kneeLAng = 0.02;
          state.kneeRAng = 0.02;
        }
      } else if (a.do === 'toast' || a.do === 'inviteMoon') {
        if (localT <= to) {
          const env = a.hold ? smootherstep(0, 0.6, u) : Math.sin(u * Math.PI);
          state.shRAng = lerp(-0.22, -1.65, env);
          state.elRAng = lerp(1.05, 0.45, env);
          state.headAngle = lerp(-0.02, -0.28, env);
          state.spineAngle = lerp(0, -0.05, env);
          state.shLAng = lerp(0.16, 0.26, env);
          state.elLAng = lerp(0.32, 0.38, env);
        }
      } else if (a.do === 'sigh') {
        if (localT <= to) {
          const env = Math.sin(u * Math.PI);
          state.spineAngle = lerp(0, 0.12, env);
          state.headAngle = lerp(-0.02, 0.30, env);
          state.pelvisDropY = env * 2.0;
          state.shRAng = lerp(-0.22, 0.05, env);
          state.elRAng = lerp(1.05, 0.22, env);
          state.handRAng = lerp(0.08, 0.12, env);
          state.shLAng = lerp(0.16, 0.22, env);
          state.elLAng = lerp(0.32, 0.24, env);
          state.kneeLAng = lerp(0.02, 0.06, env);
          state.kneeRAng = lerp(0.02, 0.06, env);
          state.sighMist = env;
          state.sighProgress = u;
        }
      } else if (a.do === 'castRod') {
        if (localT <= to) {
          if (u < 0.34) {
            const wu = smootherstep(0, 0.34, u);
            state.thighLAng = lerp(0.04, 0.14, wu);
            state.kneeLAng = lerp(0.02, 0.18, wu);
            state.thighRAng = lerp(-0.04, -0.12, wu);
            state.spineAngle = lerp(0, -0.08, wu);
            state.pelvisShiftX = lerp(0, -4, wu);
            state.shRAng = lerp(-0.45, -1.75, wu);
            state.elRAng = lerp(0.75, 0.55, wu);
            state.handRAng = lerp(0.0, -0.22, wu);
            state.rodBend = -wu * 0.75;
          } else if (u < 0.66) {
            const cu = smootherstep(0.34, 0.66, u);
            state.thighRAng = lerp(-0.12, -0.22, cu);
            state.kneeRAng = lerp(0.02, 0.22, cu);
            state.thighLAng = lerp(0.14, 0.18, cu);
            state.kneeLAng = lerp(0.18, 0.08, cu);
            state.spineAngle = lerp(-0.08, 0.08, cu);
            state.pelvisShiftX = lerp(-4, 5, cu);
            state.pelvisDropY = Math.sin(cu * Math.PI) * 3;
            state.shRAng = lerp(-1.75, -0.75, cu);
            state.elRAng = lerp(0.55, 0.45, cu);
            state.handRAng = lerp(-0.22, 0.15, cu);
            state.rodBend = Math.sin(cu * Math.PI) * 1.10;
          } else {
            const hu = smootherstep(0.66, 1.0, u);
            state.thighLAng = lerp(0.18, 0.06, hu);
            state.thighRAng = lerp(-0.22, -0.08, hu);
            state.kneeRAng = lerp(0.22, 0.04, hu);
            state.kneeLAng = lerp(0.08, 0.02, hu);
            state.spineAngle = lerp(0.08, 0.02, hu);
            state.pelvisShiftX = lerp(5, 2, hu);
            state.shRAng = lerp(-0.75, -0.65, hu);
            state.elRAng = lerp(0.45, 0.65, hu);
            state.handRAng = lerp(0.15, 0.04, hu);
            state.rodBend = lerp(0.35, 0.18, hu);
          }
        } else {
          state.thighLAng = 0.06;
          state.thighRAng = -0.08;
          state.kneeLAng = 0.02;
          state.kneeRAng = 0.04;
          state.shRAng = -0.65;
          state.elRAng = 0.65;
          state.handRAng = 0.04;
          state.rodBend = 0.18;
        }
      } else if (a.do === 'wieldSword') {
        if (localT <= to) {
          const env = Math.sin(u * Math.PI);
          state.thighRAng = -0.32 * env;
          state.kneeRAng = 0.38 * env;
          state.thighLAng = 0.28 * env;
          state.kneeLAng = 0.12 * env;
          state.pelvisDropY = 7 * env;
          state.pelvisShiftX = 5 * env;
          state.spineAngle = 0.08 * env;
          state.shRAng = lerp(-0.45, -1.55, env);
          state.elRAng = lerp(0.75, 0.25, env);
          state.shLAng = lerp(0.16, 0.55, env);
          state.elLAng = 0.25;
          state.swordSlash = u;
        }
      } else if (a.do === 'wave' || a.do === 'paint' || a.do === 'reach') {
        if (localT <= to) {
          const env = Math.sin(u * Math.PI);
          state.shRAng = lerp(-0.22, -1.15 * (a.amount ?? 0.85), env);
          state.elRAng = lerp(0.65, 0.35, env) + 0.12 * Math.sin((localT - from) * 5);
        }
      } else if (a.do === 'bow') {
        if (localT <= to) {
          const env = Math.sin(u * Math.PI);
          state.spineAngle = env * 0.24;
          state.headAngle = env * 0.24;
          state.shRAng = lerp(-0.22, -0.45, env);
          state.elRAng = lerp(1.05, 0.85, env);
          state.shLAng = lerp(0.16, -0.45, env);
          state.elLAng = lerp(0.32, 0.85, env);
        }
      } else if (a.do === 'playQin' || a.do === 'row') {
        if (localT <= to) {
          state.shRAng = -0.22 + 0.14 * Math.sin((localT - from) * 4.5);
          state.elRAng = 0.85 + 0.12 * Math.cos((localT - from) * 4.5);
          state.spineAngle = 0.05 * Math.sin((localT - from) * 2.2);
        }
      } else if (a.do === 'view') {
        state.view = a.view || 'side';
      } else if (a.do === 'leap') {
        const fx = a.fromX ?? state.x;
        const tx = a.toX ?? state.x;
        const fy = a.fromY ?? state.y;
        const ty = a.toY ?? state.y;
        state.x = lerp(fx, tx, kFlow);
        state.y = lerp(fy, ty, kFlow);
        if (Math.abs(tx - fx) > 2) state.facing = tx >= fx ? 1 : -1;
        if (localT <= to) {
          const ph = ((localT - from) * (a.cadence ?? 2.6)) % 1;
          const air = Math.sin(ph * Math.PI);
          state.hopY = -air * (a.height ?? 34);
          state.spineAngle = 0.28;
          state.headAngle = -0.14;
          state.stride = 26 * air;
          state.thighRAng = -0.58 * air - 0.15;
          state.kneeRAng = 0.85 * air + 0.15;
          state.thighLAng = 0.52 * air + 0.18;
          state.kneeLAng = 0.12;
          state.shLAng = 0.68;
          state.elLAng = 0.18;
          state.shRAng = 0.45;
          state.elRAng = 0.35;
        }
      } else if (a.do === 'writeAir') {
        if (localT <= to || a.hold) {
          const env = a.hold ? smootherstep(0, 0.5, u) : Math.sin(u * Math.PI);
          state.spineAngle = lerp(0, -0.06, env);
          state.headAngle = lerp(-0.02, -0.22, env);
          state.thighLAng = lerp(0.04, 0.18, env);
          state.thighRAng = lerp(-0.04, -0.18, env);
          state.shRAng = lerp(-0.45, -2.05 + Math.sin(u * Math.PI * 2) * 0.28, env);
          state.elRAng = lerp(0.75, 0.22, env);
          state.shLAng = lerp(0.16, 0.48, env);
          state.elLAng = lerp(0.32, 0.42, env);
          state.swordSlash = u;
        }
      } else if (a.do === 'pose' && a.joints) {
        if (localT <= to || a.hold) {
          const env = a.hold ? smootherstep(0, 0.6, u) : Math.sin(u * Math.PI);
          for (const [kJoint, targetVal] of Object.entries(a.joints)) {
            if (typeof state[kJoint] === 'number' && typeof targetVal === 'number') {
              state[kJoint] = lerp(state[kJoint], targetVal, env);
            }
          }
        }
      } else if (a.do === 'mood') {
        if (localT <= to) state.mood = a.mood || 'happy';
      }
    }
    state.lastRodTip = solveSkeleton(0, localT).rodTipWorld;
  }

  function draw(ctx, t = 0) {
    const { sx, sy } = evalSquashStretch2D(state.squash);
    const breeze = Math.sin(t * 1.8 + state.baseX * 0.01) * 2.2;
    const skel = solveSkeleton(breeze, t);

    ctx.save();
    ctx.translate(state.x, state.y + state.hopY);
    ctx.scale(skel.sc * state.facing * sx, skel.sc * sy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (state.showSkeleton === 'wireframe' || !skinFn) {
      drawSkeleton2D(ctx, skel, state);
      ctx.restore();
      state.lastRodTip = skel.rodTipWorld;
      return;
    }

    if (state.showSkeleton) {
      ctx.save();
      ctx.globalAlpha = 0.42;
    }

    skinFn(ctx, skel, state, t);

    if (state.showSkeleton) {
      ctx.restore();
      drawSkeleton2D(ctx, skel, state);
    }

    ctx.restore();
    state.lastRodTip = skel.rodTipWorld;
  }

  function drawSkeleton(ctx, t = 0) {
    const { sx, sy } = evalSquashStretch2D(state.squash);
    const breeze = Math.sin(t * 1.8 + state.baseX * 0.01) * 2.2;
    const skel = solveSkeleton(breeze, t);
    ctx.save();
    ctx.translate(state.x, state.y + state.hopY);
    ctx.scale(skel.sc * state.facing * sx, skel.sc * sy);
    drawSkeleton2D(ctx, skel, state);
    ctx.restore();
  }

  function getSkeleton(t = 0) {
    const breeze = Math.sin(t * 1.8 + state.baseX * 0.01) * 2.2;
    return solveSkeleton(breeze, t);
  }

  function getRodTip() {
    return solveSkeleton(0, 0).rodTipWorld;
  }

  function getBounds(targetPart = 'full') {
    const isChild = state.archetype === 'child';
    const sc = state.scale * (isChild ? 0.78 : 1.0);
    const fullH = 252 * sc;
    if (targetPart === 'close' || targetPart === 'extreme-close') {
      return {
        x: state.x,
        y: state.y + state.hopY - fullH * 0.65,
        w: 460 * sc,
        h: 280 * sc,
      };
    }
    if (targetPart === 'medium') {
      return {
        x: state.x,
        y: state.y + state.hopY - fullH * 0.54,
        w: 660 * sc,
        h: 390 * sc,
      };
    }
    return {
      x: state.x,
      y: state.y + state.hopY - fullH * 0.5,
      w: 860 * sc,
      h: 500 * sc,
    };
  }

  function setSkin(fn) {
    skinFn = fn;
  }

  return {
    state,
    dims,
    resetPose,
    solveSkeleton,
    act,
    draw,
    drawSkeleton,
    getSkeleton,
    getRodTip,
    getBounds,
    setSkin,
  };
}
