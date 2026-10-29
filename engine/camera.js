/**
 * StyleHop Deterministic Cinematography & Camera Rig Engine (`engine/camera.js`).
 *
 * Provides pure, time-deterministic (`f(t)`) camera choreography primitives for both:
 *   1. Three.js 3D Worlds (`world.js` -> `evalCameraShot`, `applyThreeCamera`)
 *   2. 2D Canvas / DOM Stages (`evalCamera2D`, `applyDomCamera`)
 *
 * Core Cinematography Moves (`shot.type`):
 *   - `static`     : Locked-off symmetrical / tabletop composition
 *   - `push`       : Dolly-in toward hero subject (optional FOV tightening)
 *   - `pull`       : Dolly-out reveal from macro detail to full environment
 *   - `orbit`      : Cylindrical arc around `target` (`angleFrom -> angleTo`, `radius`, `height`)
 *   - `crane`      : Vertical boom sweep with synchronized lookAt tilt (`crane-up` / `crane-down`)
 *   - `track`      : Lateral / diagonal trucking following a moving subject (`targetFrom -> targetTo`)
 *   - `dolly-zoom` : Vertigo / Hitchcock zoom (adjusts FOV while scaling distance to lock subject size)
 *   - `whip`       : Fast angular whip-pan entry/exit at scene cuts
 */

import { clamp, lerp, smootherstep, springStep } from './motion.js';

function easeCurve(u, mode = 'smooth') {
  const x = clamp(u, 0, 1);
  if (mode === 'linear') return x;
  if (mode === 'spring') return clamp(springStep(x * 1.35, 0.32, 6.2).x, 0, 1.08);
  if (mode === 'ease-out') return 1 - Math.pow(1 - x, 3);
  if (mode === 'ease-in') return x * x * x;
  return smootherstep(0, 1, x);
}

function lerpVec3(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
}

/**
 * Computes aspect-ratio adaptive camera framing parameters across 16:9, 9:16, and 1:1
 * so 3D stages never clip horizontally on portrait/square viewports.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} [baseFov=31]
 */
export function resolveAspectFraming(width, height, baseFov = 31) {
  const aspect = width / Math.max(1, height);
  const orient =
    aspect > 1.15 ? 'landscape' : aspect < 0.85 ? 'portrait' : 'square';
  const fov =
    orient === 'portrait'
      ? Math.round(baseFov * 1.42)
      : orient === 'square'
      ? Math.round(baseFov * 1.16)
      : baseFov;
  const distScale =
    orient === 'portrait' ? 1.32 : orient === 'square' ? 1.14 : 1.0;

  return { aspect, orient, fov, baseFov, distScale };
}

/**
 * Exponentially decaying physical impact shake triggered at `dt = localT - impactTime`.
 *
 * @param {number} dt  Time elapsed since impact (seconds); <= 0 means before impact.
 * @param {object} [opts]
 */
export function evalImpactShake(
  dt,
  {
    amp = 0.18,
    decay = 7.5,
    freq = null,
    freqX = 48.0,
    freqY = 39.0,
    rollAmp = 0.016,
  } = {}
) {
  if (!Number.isFinite(dt) || dt <= 0 || dt > 1.5) {
    return { dx: 0, dy: 0, dz: 0, roll: 0 };
  }
  const fx = freq ? freq * 2.1 : freqX;
  const fy = freq ? freq * 1.7 : freqY;
  const env = Math.exp(-decay * dt);
  return {
    dx: env * amp * Math.sin(dt * fx),
    dy: env * amp * Math.cos(dt * fy),
    dz: env * amp * 0.4 * Math.sin(dt * 31.0),
    roll: env * rollAmp * Math.sin(dt * 35.0),
  };
}

/**
 * Subtle continuous dual-sine handheld camera breathing sway.
 */
export function evalHandheldSway(
  t,
  { ampX = 0.05, ampY = 0.035, rollAmp = 0.004, freq = 1.4 } = {}
) {
  return {
    dx: Math.sin(t * freq) * ampX + Math.cos(t * freq * 0.63) * (ampX * 0.4),
    dy: Math.cos(t * freq * 0.85) * ampY,
    dz: 0,
    roll: Math.sin(t * freq * 0.72) * rollAmp,
  };
}

/**
 * Stepped stop-motion camera rig micro-boil (quantized to `fps`, e.g. 12fps).
 */
export function evalStopMotionBoil(t, fps = 12, amp = 0.012) {
  const step = Math.floor(t * fps);
  const hx = Math.sin(step * 127.1 + 311.7) * 43758.5453;
  const hy = Math.sin(step * 269.5 + 183.3) * 43758.5453;
  const fx = hx - Math.floor(hx) - 0.5;
  const fy = hy - Math.floor(hy) - 0.5;
  return {
    dx: fx * amp,
    dy: fy * amp,
    dz: 0,
    roll: fx * amp * 0.15,
  };
}

/**
 * Standard named 3D camera shot presets that AI can invoke directly or customize.
 */
export const CAMERA_PRESETS = {
  /** Slow macro dolly-in with gentle right arc */
  macroPush: {
    type: 'orbit',
    radius: [11.6, 9.8],
    angle: [-0.20, 0.15],
    height: [4.1, 3.2],
    target: [0.0, 1.45, 0.3],
    ease: 'smooth',
  },
  /** Wide establishing pull-out revealing full stage */
  widePull: {
    type: 'orbit',
    radius: [9.4, 12.6],
    angle: [0.16, -0.18],
    height: [3.1, 4.6],
    target: [0.0, 1.6, 0.2],
    ease: 'smooth',
  },
  /** Sweeping crane descent from high angle down to eye level */
  craneReveal: {
    type: 'crane',
    from: [-1.4, 5.8, 12.2],
    to: [1.1, 3.4, 11.4],
    targetFrom: [0.0, 2.4, 0.0],
    targetTo: [0.0, 1.45, 0.3],
    ease: 'smooth',
  },
  /** Lateral street / stage tracking shot following horizontal action */
  lateralTrack: {
    type: 'track',
    from: [-2.2, 3.3, 12.6],
    to: [1.8, 3.6, 12.6],
    targetFrom: [-1.2, 1.9, 0.2],
    targetTo: [0.8, 2.1, 0.2],
    ease: 'smooth',
  },
  /** Majestic orbital crane sweep for grand finales */
  finaleOrbit: {
    type: 'orbit',
    radius: [13.2, 11.8],
    angle: [-0.32, 0.28],
    height: [5.3, 4.1],
    target: [0.0, 1.75, 0.25],
    ease: 'smooth',
  },
  /** Vertigo / Hitchcock dolly-zoom keeping subject scale locked */
  vertigoZoom: {
    type: 'dolly-zoom',
    target: [0.0, 1.5, 0.3],
    baseDist: 11.2,
    baseFov: 31,
    fovFrom: 24,
    fovTo: 42,
    angle: [-0.1, 0.1],
    height: [3.8, 3.6],
  },
};

/**
 * Evaluates a deterministic 3D camera state `{ pos, target, fov, roll }` at normalized
 * scene progress `u in [0, 1]` and scene-local time `localT` (seconds).
 *
 * @param {string|object} shotSpec  Preset name in `CAMERA_PRESETS` or custom shot config object
 * @param {number} u                Normalized scene progress `0..1`
 * @param {number} [localT=0]       Scene-local timestamp in seconds
 * @param {object} [opts]
 * @param {number} [opts.baseFov=31]
 * @param {number} [opts.dur=3.7]
 */
export function evalCameraShot(shotSpec, u, localT = 0, opts = {}) {
  const spec =
    typeof shotSpec === 'string'
      ? CAMERA_PRESETS[shotSpec] || CAMERA_PRESETS.macroPush
      : shotSpec || CAMERA_PRESETS.macroPush;

  const baseFov = spec.baseFov ?? opts.baseFov ?? 31;
  const dur = opts.dur ?? 3.7;
  const k = easeCurve(u, spec.ease || 'smooth');
  const type = spec.move || spec.type || 'orbit';

  let pos = [0, 3.8, 11.5];
  let target = [0, 1.5, 0.2];
  let fov = spec.fov
    ? Array.isArray(spec.fov)
      ? lerp(spec.fov[0], spec.fov[1], k)
      : spec.fov
    : baseFov;

  const rawRoll =
    spec.roll != null
      ? Array.isArray(spec.roll)
        ? lerp(spec.roll[0], spec.roll[1], k)
        : spec.roll
      : spec.rollDeg != null
      ? ((Array.isArray(spec.rollDeg)
          ? lerp(spec.rollDeg[0], spec.rollDeg[1], k)
          : spec.rollDeg) *
          Math.PI) /
        180
      : 0;
  let roll = rawRoll;

  const resolveTarget = () => {
    const tFrom = spec.targetFrom || spec.fromLookAt;
    const tTo = spec.targetTo || spec.toLookAt;
    if (tFrom && tTo) {
      return lerpVec3(tFrom, tTo, k);
    }
    const tSingle = spec.target || spec.lookAt;
    return tSingle ? [...tSingle] : [0, 1.5, 0.2];
  };

  if (type === 'static') {
    pos = spec.pos ? [...spec.pos] : [0, 3.8, 11.5];
    target = resolveTarget();
  } else if (type === 'push' || type === 'pull' || type === 'crane' || type === 'track') {
    const from = spec.from || spec.fromPos || [0, 4.2, 12.4];
    const to = spec.to || spec.toPos || [0, 3.3, 9.8];
    pos = lerpVec3(from, to, k);
    target = resolveTarget();
  } else if (type === 'orbit') {
    target = resolveTarget();
    const rArr = Array.isArray(spec.radius)
      ? spec.radius
      : [spec.distFrom ?? spec.radius ?? 11.5, spec.distTo ?? spec.radius ?? 11.5];
    const aArr = Array.isArray(spec.angle)
      ? spec.angle
      : [spec.angleFrom ?? -0.22, spec.angleTo ?? 0.22];
    const hArr = Array.isArray(spec.height)
      ? spec.height
      : [spec.heightFrom ?? spec.height ?? 4.0, spec.heightTo ?? spec.height ?? 3.6];

    const r = lerp(rArr[0], rArr[1], k);
    const ang = lerp(aArr[0], aArr[1], k);
    const h = lerp(hArr[0], hArr[1], k);
    const zOffset = spec.zOffset ?? 0.35;

    pos = [
      target[0] + Math.sin(ang) * r,
      h,
      target[2] + zOffset + Math.cos(ang) * r,
    ];
  } else if (type === 'dolly-zoom') {
    target = resolveTarget();
    const fovFrom = spec.fovFrom ?? 24;
    const fovTo = spec.fovTo ?? 42;
    fov = lerp(fovFrom, fovTo, k);
    const refDist = spec.baseDist ?? 11.2;
    const refHalfRad = ((spec.baseFov ?? baseFov) * 0.5 * Math.PI) / 180;
    const curHalfRad = (fov * 0.5 * Math.PI) / 180;
    const dist = (refDist * Math.tan(refHalfRad)) / Math.max(0.05, Math.tan(curHalfRad));

    const aArr = Array.isArray(spec.angle)
      ? spec.angle
      : [spec.angleFrom ?? -0.1, spec.angleTo ?? 0.1];
    const hArr = Array.isArray(spec.height)
      ? spec.height
      : [spec.heightFrom ?? 3.8, spec.heightTo ?? 3.6];
    const ang = lerp(aArr[0], aArr[1], k);
    const h = lerp(hArr[0], hArr[1], k);
    pos = [
      target[0] + Math.sin(ang) * dist,
      h,
      target[2] + Math.cos(ang) * dist,
    ];
  } else if (type === 'whip') {
    target = resolveTarget();
    const from = spec.from || spec.fromPos;
    const to = spec.to || spec.toPos;
    const basePos = from && to ? lerpVec3(from, to, k) : [0, 3.8, 11.5];
    const whipIn = localT < 0.28 ? Math.pow(1 - localT / 0.28, 3) * (spec.whipDir ?? -1) * 3.2 : 0;
    const whipOut =
      localT > dur - 0.24
        ? Math.pow((localT - (dur - 0.24)) / 0.24, 3) * (spec.whipDir ?? 1) * 3.2
        : 0;
    pos = [basePos[0] + whipIn + whipOut, basePos[1], basePos[2]];
    target = [target[0] + (whipIn + whipOut) * 0.45, target[1], target[2]];
    roll += (whipIn + whipOut) * -0.025;
  }

  return applyMicroMotion({ pos, target, fov, roll }, spec, localT);
}

// Whole-frame shake is off by default: shaking the entire picture on every impact reads as
// a glitch, not as weight. Show impacts on the props (squash, bounce, wobble) and keep the
// camera steady. A shot may opt in with `shake: true`; even then it is capped to a soft nudge.
const SHAKE_CAP = { amp: 0.03, freq: 9, boil: 0.004 };

/**
 * Layers optional micro-motions from `spec` onto an evaluated camera state (in place):
 * `sway` (slow handheld drift) always; `boil` (12fps rig jitter) and `impacts` (shakes at
 * scene-local times) only with `spec.shake === true`, capped by `SHAKE_CAP`.
 * Shared by `evalCameraShot` and `engine/director.js`.
 */
export function applyMicroMotion(state, spec, localT = 0) {
  const { pos } = state;
  let roll = state.roll || 0;
  const shake = spec.shake === true;
  const swaySpec = spec.sway ?? spec.swayAmp;
  if (swaySpec) {
    const sw = evalHandheldSway(
      localT,
      typeof swaySpec === 'object'
        ? swaySpec
        : { ampX: swaySpec, ampY: swaySpec * 0.7 }
    );
    pos[0] += sw.dx;
    pos[1] += sw.dy;
    roll += sw.roll;
  }

  const boilSpec = shake ? spec.boil ?? spec.boilAmp : null;
  if (boilSpec) {
    const bl = evalStopMotionBoil(
      localT,
      spec.boilFps ?? 12,
      Math.min(SHAKE_CAP.boil, typeof boilSpec === 'number' ? boilSpec : SHAKE_CAP.boil)
    );
    pos[0] += bl.dx;
    pos[1] += bl.dy;
    roll += bl.roll;
  }

  if (shake && Array.isArray(spec.impacts)) {
    for (const imp of spec.impacts) {
      const impT = typeof imp === 'number' ? imp : (imp.at ?? imp.t ?? 0);
      const o = typeof imp === 'object' ? imp : {};
      const sh = evalImpactShake(localT - impT, {
        decay: o.decay ?? 9,
        amp: Math.min(SHAKE_CAP.amp, o.amp ?? SHAKE_CAP.amp),
        freq: Math.min(SHAKE_CAP.freq, o.freq ?? SHAKE_CAP.freq),
        rollAmp: 0,
      });
      pos[0] += sh.dx;
      pos[1] += sh.dy;
      pos[2] += sh.dz;
      roll += sh.roll;
    }
  }

  state.roll = roll;
  return state;
}

/**
 * Applies an evaluated shot state `{ pos, target, fov, roll }` to a `THREE.PerspectiveCamera`,
 * automatically scaling horizontal/depth distance by `distScale` for portrait (9:16) & square (1:1).
 *
 * @param {object} camera      THREE.PerspectiveCamera
 * @param {object} state       Output of `evalCameraShot`
 * @param {object} [opts]
 * @param {number} [opts.distScale=1.0]
 * @param {number} [opts.fovScale=1.0]
 */
export function applyThreeCamera(camera, state, { distScale = 1.0, fovScale = 1.0 } = {}) {
  const [tx, ty, tz] = state.target;
  const dx = (state.pos[0] - tx) * distScale;
  const dz = (state.pos[2] - tz) * distScale;

  camera.position.set(tx + dx, state.pos[1], tz + dz);
  if (state.fov && Math.abs(camera.fov - state.fov * fovScale) > 0.05) {
    camera.fov = state.fov * fovScale;
    camera.updateProjectionMatrix();
  }
  camera.up.set(Math.sin(state.roll || 0), Math.cos(state.roll || 0), 0);
  camera.lookAt(tx, ty, tz);
}

/**
 * Evaluates a 2D camera transform (`{ x, y, zoom, rot }`) for 2D Canvas or `[data-cam]` DOM stages.
 */
export function evalCamera2D(preset = 'drift', u = 0, localT = 0, opts = {}) {
  const k = smootherstep(0, 1, clamp(u, 0, 1));
  const maxZoom = opts.zoom ?? 1.06;
  let x = 0;
  let y = 0;
  let zoom = 1.0;
  let rot = 0;

  if (preset === 'push') {
    zoom = lerp(1.0, maxZoom, k);
  } else if (preset === 'pull') {
    zoom = lerp(maxZoom, 1.0, k);
  } else if (preset === 'pan-right') {
    zoom = 1.04;
    x = lerp(-18, 18, k);
  } else if (preset === 'pan-left') {
    zoom = 1.04;
    x = lerp(18, -18, k);
  } else if (preset === 'crane-up') {
    zoom = 1.04;
    y = lerp(14, -14, k);
  } else if (preset === 'crane-down') {
    zoom = 1.04;
    y = lerp(-14, 14, k);
  } else if (preset === 'drift') {
    zoom = 1.02 + 0.015 * Math.sin(localT * 0.9);
    x = Math.sin(localT * 0.8) * 6;
    y = Math.cos(localT * 0.65) * 4;
  }

  if (opts.shakeAt != null) {
    const sh = evalImpactShake(localT - opts.shakeAt, { amp: opts.shakeAmp ?? 12 });
    x += sh.dx;
    y += sh.dy;
    rot += sh.roll;
  }

  return { x, y, zoom, rot };
}
