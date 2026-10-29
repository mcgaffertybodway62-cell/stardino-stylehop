/**
 * Style-Agnostic 2D Painted Scroll & Canvas Stage Engine (`engine/studio2d.js`).
 *
 * Architectural Decoupling (2D Canvas Track vs. 3D Spatial Track):
 *   - 3D styles (`engine/studio3d.js` + `engine/director.js` + `engine/puppet.js`) build one
 *     persistent 3D room and cut between multiple virtual cameras (`wide` -> `close` by solving
 *     3D perspective distance to bounding boxes).
 *   - 2D painted/scroll styles (`engine/studio2d.js` + `engine/puppet2d.js`, e.g. `ink-wash`,
 *     shadow-puppet, paper-cut, flat-vector, ukiyo-e) follow the "One Scene = One Painting,
 *     One Scene = One Continuous Move" (`一幕一构图 · 一场一单向微镜`) paradigm:
 *       1. Canvas optical baseline is ALWAYS locked to full-frame (`baseZoom = vpScale`,
 *          optical center `(designWidth/2, designHeight/2)`). It NEVER scales the 2D canvas
 *          by `1.4x–1.7x` to fake a close-up or interpolates zoom back-and-forth between shots.
 *       2. Shot size (`wide`, `full`, `medium`, `close`, `extreme-close`) is achieved by
 *          composing the scene's artwork at that scale (e.g. character `scale: 0.55` in a wide
 *          landscape vs. `scale: 1.45` or `view: 'back'` in a close scene).
 *       3. Across the entire duration of each scene (`0 .. scene.dur`), the camera executes at
 *          most ONE gentle, single-direction movement (`static`, `push`, `pull`, `pan`/`track`,
 *          `rise`, `drop`, `drift`), eliminating zoom ping-pong ("breathing bellows effect").
 */

import { clamp, lerp, smootherstep, flowStep } from './motion.js';

function layout2DBeats(rawList, sceneDur) {
  const d = Math.max(0.1, sceneDur || 4);
  if (!rawList) {
    return [{ start: 0, dur: d, size: 'full', move: 'static', subject: 'stage' }];
  }
  const list = Array.isArray(rawList) ? rawList : [rawList];
  if (!list.length) {
    return [{ start: 0, dur: d, size: 'full', move: 'static', subject: 'stage' }];
  }
  const fixed = list.reduce((s, sh) => s + (sh.dur || 0), 0);
  const open = list.filter((sh) => !sh.dur).length;
  const each = open ? Math.max(0.4, (d - fixed) / open) : 0;
  let t = 0;
  return list.map((sh, i) => {
    const dur = sh.dur || (i === list.length - 1 ? Math.max(0.4, d - t) : each);
    const entry = { ...sh, start: t, dur };
    t += dur;
    return entry;
  });
}

/**
 * Evaluates a single-direction, full-frame 2D scroll camera state for an entire scene.
 *
 * @param {object} sceneMoveSpec - Primary camera move spec for the scene (`move`, `amount`, `rollDeg`)
 * @param {number} u - Normalized scene progress `0..1` (`localT / scene.dur`)
 * @param {object} dims - `{ width, height, designWidth, designHeight }`
 */
export function evalSceneCamera2D(sceneMoveSpec = {}, u = 0, dims = {}) {
  const {
    width = 1920,
    height = 1080,
    designWidth = 1920,
    designHeight = 1080,
  } = dims;

  const cx0 = designWidth * 0.5;
  const cy0 = designHeight * 0.5;
  const vpScale = Math.min(width / designWidth, height / designHeight);
  const k = flowStep(0, 1, clamp(u, 0, 1), sceneMoveSpec.ease ?? 0.22);

  const moves = String(sceneMoveSpec.move || 'static')
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);
  const amount = clamp(sceneMoveSpec.amount ?? 1.0, 0.2, 1.0);

  const isDepth =
    sceneMoveSpec.mode === 'depth' ||
    sceneMoveSpec.mode === 'multiplane' ||
    moves.some((m) => m.startsWith('depth-'));

  const vanish =
    sceneMoveSpec.vanish ||
    (isDepth ? [designWidth * 0.5, designHeight * 0.42] : [cx0, cy0]);
  const vanishX = vanish[0];
  const vanishY = vanish[1];

  let dolly = 1.0;
  let panX = 0;
  let panY = 0;
  let angleShift = 0;

  for (const m of moves) {
    if (m === 'push') {
      dolly *= lerp(1.0, 1.0 + 0.032 * amount, k);
    } else if (m === 'pull') {
      dolly *= lerp(1.0 + 0.032 * amount, 1.0, k);
    } else if (m === 'depth-push') {
      // Stronger 2.5D dolly into vanishing point, scaled by parallax per layer
      dolly *= lerp(1.0, 1.0 + 0.12 * amount, k);
    } else if (m === 'depth-pull') {
      dolly *= lerp(1.0 + 0.12 * amount, 1.0, k);
    } else if (m === 'depth-crane') {
      // Camera rises/drops over foreground promontory to reveal distant central goal
      panY += lerp(28, -28, k) * amount;
    } else if (m === 'depth-pan') {
      // Lateral parallax sweep across planes
      panX += lerp(-48, 48, k) * amount;
    } else if (m === 'pan' || m === 'track' || m === 'truck') {
      panX += lerp(-20, 20, k) * amount;
    } else if (m === 'orbit') {
      angleShift += lerp(-16, 16, k) * amount;
    } else if (m === 'rise' || m === 'crane') {
      panY += lerp(14, -14, k) * amount;
    } else if (m === 'drop') {
      panY += lerp(-14, 14, k) * amount;
    } else if (m === 'drift') {
      panX += lerp(-14, 14, k) * amount;
      panY += lerp(9, -9, k) * amount;
    }
  }

  const zoom = vpScale * dolly;

  return {
    cx: cx0 + panX,
    cy: cy0 + panY,
    focusX: vanishX,
    focusY: vanishY,
    vanishX,
    vanishY,
    panX,
    panY,
    angleShift,
    dolly,
    zoom,
    roll: ((sceneMoveSpec.rollDeg ?? 0) * Math.PI) / 180,
    isDepth: Boolean(isDepth),
    mode: isDepth ? 'depth' : 'flat',
  };
}

/**
 * Creates a style-agnostic 2D Scroll / Canvas Studio (`createStudio2D`).
 *
 * @param {object} opts
 * @param {number} [opts.width=1920]
 * @param {number} [opts.height=1080]
 * @param {number} [opts.designWidth=1920]
 * @param {number} [opts.designHeight=1080]
 * @param {Array}  [opts.scenes=[]]
 * @param {function} [opts.getLookState] - Optional `(frame) => lookState`
 * @param {function} [opts.drawBackdrop] - Optional `(ctx, width, height, lookState, camOffset, frame) => void`
 */
export function createStudio2D({
  width = 1920,
  height = 1080,
  designWidth = 1920,
  designHeight = 1080,
  scenes = [],
  getLookState = null,
  drawBackdrop = null,
  drawTransition = null,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });

  const cx0 = designWidth * 0.5;
  const cy0 = designHeight * 0.5;
  const vpScale = Math.min(width / designWidth, height / designHeight);

  let activeCam = evalSceneCamera2D({ move: 'static' }, 0, {
    width,
    height,
    designWidth,
    designHeight,
  });

  ctx.__inkViewport = { width, height };
  ctx.__inkCam = activeCam;

  /**
   * 2D Scene & Storyboard Director (`director({ subjects, shots, prepare })`).
   *
   * Evaluates ONE continuous, single-direction camera move per scene (`0 .. scene.dur`)
   * so the 2D canvas never zooms in and out mid-scene or across scene cuts.
   * Supports both:
   *   - Single-move per scene: `shots: { 'act1': { size: 'wide', move: 'push', subject: 'valley' } }`
   *   - Multi-beat array per scene: `shots: { 'act1': [ { dur: 1.8, ... }, { dur: 1.8, ... } ] }`
   *     (used as storyboard inspection timestamps while locking the scene's camera to a single move).
   */
  function director({ subjects = {}, shots = {}, prepare = null } = {}) {
    const table = scenes.map((sc, sIdx) => {
      const fromArray = Array.isArray(shots)
        ? shots.filter((s) => s.scene === sIdx || s.scene === sc.id)
        : null;
      const rawList =
        (fromArray && fromArray.length ? fromArray : null) ||
        shots[sc.id] ||
        shots[sc.el?.id] ||
        shots[sc.el?.dataset?.scene] ||
        shots[sIdx] ||
        [{ size: 'full', move: 'static', subject: Object.keys(subjects)[0] || 'stage' }];

      const beatList = layout2DBeats(rawList, sc.dur);
      // Select one unified camera move for the entire scene (preferring the first non-static move, or the first beat)
      const primaryMoveShot =
        beatList.find((b) => b.move && b.move !== 'static') || beatList[0] || { move: 'static' };

      return {
        scene: sc,
        index: sIdx,
        beats: beatList,
        primaryMove: primaryMoveShot,
      };
    });

    function update(frame) {
      if (typeof prepare === 'function') {
        prepare(frame);
      }
      const sIdx = clamp(frame.sceneIndex ?? 0, 0, Math.max(0, table.length - 1));
      const entry = table[sIdx];
      if (!entry) return activeCam;

      const localT = frame.localT ?? 0;
      const sceneDur = Math.max(0.1, entry.scene?.dur || 4.0);
      const sceneU = clamp(localT / sceneDur, 0, 1);

      activeCam = evalSceneCamera2D(entry.primaryMove, sceneU, {
        width,
        height,
        designWidth,
        designHeight,
      });
      ctx.__inkCam = activeCam;
      return activeCam;
    }

    function storyboard() {
      const out = [];
      for (const entry of table) {
        for (const [bIdx, beat] of entry.beats.entries()) {
          const sampleLocalT = +(beat.start + beat.dur * 0.78).toFixed(2);
          const midT = +(entry.scene.start + sampleLocalT).toFixed(2);
          if (typeof prepare === 'function') {
            prepare({
              sceneIndex: entry.index,
              localT: sampleLocalT,
              t: midT,
              scene: entry.scene,
            });
          }
          const subName =
            typeof beat.subject === 'string'
              ? beat.subject
              : Object.keys(subjects)[0] || `scene-${entry.index + 1}`;
          out.push({
            scene: entry.index,
            shot: bIdx,
            t: midT,
            dur: +beat.dur.toFixed(2),
            size: beat.size || 'full',
            subject: subName,
            box: [designWidth, designHeight],
            is2D: true,
            warn: [],
          });
        }
      }
      return out;
    }

    return {
      update,
      storyboard,
      get camera() {
        return activeCam;
      },
    };
  }

  /**
   * Begins drawing a 2D world-space plane at depth `parallax`
   * (`1.0` = main foreground stage, `< 1.0` = mid/far background plane, `> 1.0` = close foreground).
   * Optional `opts.vanish = [vx, vy]` overrides active camera's vanishing point.
   */
  function beginLayer(parallax = 1.0, opts = {}) {
    const p = clamp(parallax, 0.05, 2.5);
    ctx.save();

    const vx = opts.vanish ? opts.vanish[0] : (activeCam.vanishX ?? cx0);
    const vy = opts.vanish ? opts.vanish[1] : (activeCam.vanishY ?? cy0);

    const baseZoom = activeCam.zoom / Math.max(0.5, activeCam.dolly ?? 1.0);
    // When dolly changes, plane p scales according to its parallax
    // e.g. p = 0.15 -> 1 + (dolly-1)*0.15 (~1.02x), p = 0.5 -> ~1.06x, p = 1.0 -> 1.12x, p = 1.25 -> 1.15x
    const effZoom = baseZoom * (1.0 + ((activeCam.dolly ?? 1.0) - 1.0) * p);

    const screenVx = (vx - cx0) * vpScale + width * 0.5;
    const screenVy = (vy - cy0) * vpScale + height * 0.5;

    ctx.translate(screenVx, screenVy);
    if (activeCam.roll) ctx.rotate(activeCam.roll);
    ctx.scale(effZoom, effZoom);

    const layerOffsetX =
      activeCam.panX * p +
      (activeCam.angleShift || 0) * (p - 1.0);
    const layerOffsetY =
      activeCam.panY * p;

    ctx.translate(-vx - layerOffsetX, -vy - layerOffsetY);
  }

  function endLayer() {
    ctx.restore();
  }

  function render(frame, drawWorldFn) {
    const lookState = typeof getLookState === 'function' ? getLookState(frame) : null;
    const camOffset = [activeCam.cx - cx0, activeCam.cy - cy0];

    ctx.__inkFrame = frame;
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    if (typeof drawBackdrop === 'function') {
      drawBackdrop(ctx, width, height, lookState, camOffset, frame);
    }
    if (typeof drawWorldFn === 'function') {
      drawWorldFn({
        ctx,
        width,
        height,
        frame,
        look: lookState,
        camera: activeCam,
        beginLayer,
        endLayer,
      });
    }
    if (typeof drawTransition === 'function') {
      drawTransition(ctx, width, height, lookState, frame);
    }
    ctx.restore();
  }

  const studioApi = {
    canvas,
    ctx,
    width,
    height,
    director,
    getLookState,
    beginLayer,
    endLayer,
    render,
    renderPlanes: (planes, renderOpts) => renderDepthPlanes(ctx, studioApi, planes, renderOpts),
    evalTraversal: (t, waypoints, travOpts) => evalDepthTraversal(t, waypoints, travOpts),
    get camera() {
      return activeCam;
    },
  };

  return studioApi;
}

// ---------------------------------------------------------------------------
// Section II: Generic 2.5D Depth Vista & Traversal Engine (ADR-010 / ADR-015)
// ---------------------------------------------------------------------------

let _studioSoftCanvas = null;
let _studioSoftCtx = null;

function drawStudioSoftPass(ctx, drawFn, softness = 4) {
  const soft = Math.max(0, softness);
  const k = clamp(1 / (1 + soft * 0.4), 0.1, 1);
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const w = Math.max(1, Math.ceil(cw * k));
  const h = Math.max(1, Math.ceil(ch * k));
  if (!_studioSoftCanvas) {
    _studioSoftCanvas = document.createElement('canvas');
    _studioSoftCtx = _studioSoftCanvas.getContext('2d');
  }
  if (_studioSoftCanvas.width < w || _studioSoftCanvas.height < h) {
    _studioSoftCanvas.width = Math.max(_studioSoftCanvas.width, w);
    _studioSoftCanvas.height = Math.max(_studioSoftCanvas.height, h);
  }
  const m = ctx.getTransform();
  _studioSoftCtx.save();
  _studioSoftCtx.setTransform(1, 0, 0, 1, 0, 0);
  _studioSoftCtx.clearRect(0, 0, w, h);
  _studioSoftCtx.setTransform(m.a * k, m.b * k, m.c * k, m.d * k, m.e * k, m.f * k);
  drawFn(_studioSoftCtx);
  _studioSoftCtx.restore();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(_studioSoftCanvas, 0, 0, w, h, 0, 0, cw, ch);
  ctx.restore();
}

/**
 * Evaluates a multi-plane traversal across depth planes with natural occlusion
 * disappearance and foreground re-emergence.
 *
 * @param {number} t - Current scene or timeline time in seconds
 * @param {Array<object>} waypoints - Array of leg descriptors:
 *   - plane: depth plane id or parallax number (e.g. 0.45, 0.75, 1.0)
 *   - t0, t1: active time window [t0, t1]
 *   - fromX, toX: horizontal range in design units
 *   - fromY, toY: optional vertical range
 *   - groundAt: optional (x) => y profile function
 *   - scale: optional actor scale (defaults to lerp(0.32, 1.0, plane))
 *   - facing: optional ±1 direction (defaults to toX >= fromX ? 1 : -1)
 *   - view: optional 'side' | '3q' | 'front' | 'back' (default 'side')
 *   - enterHideY: px to smoothly rise up from behind the crest at start of leg
 *   - exitHideY: px to smoothly dip down behind the crest at end of leg
 *   - hideDur: duration of dip/rise transition in seconds (default ~0.35s)
 *   - ease: optional easing function (default smootherstep)
 *   - haze: optional haze amount (default derived from depth)
 * @param {object} [opts]
 * @returns {object} { activePlane, plane, x, groundY, baseY, scale, facing, view, visible, legIndex, legU, hazeAmount, yOffset, isEmerging, isHiding }
 */
export function evalDepthTraversal(t, waypoints = [], opts = {}) {
  if (!Array.isArray(waypoints) || !waypoints.length) {
    return {
      activePlane: null,
      plane: 1.0,
      x: 0,
      groundY: 0,
      baseY: 0,
      scale: 1.0,
      facing: 1,
      view: 'side',
      visible: false,
      legIndex: -1,
      legU: 0,
      hazeAmount: 0,
      yOffset: 0,
      isEmerging: false,
      isHiding: false,
    };
  }

  const sorted = [...waypoints].sort((a, b) => a.t0 - b.t0);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  let leg = null;
  let legIdx = -1;
  let inGap = false;

  for (let i = 0; i < sorted.length; i++) {
    const w = sorted[i];
    if (t >= w.t0 && t <= w.t1) {
      leg = w;
      legIdx = i;
      break;
    }
    if (i < sorted.length - 1 && t > w.t1 && t < sorted[i + 1].t0) {
      inGap = true;
      legIdx = i;
      break;
    }
  }

  if (inGap) {
    // Hidden behind ridge/trees between legs
    const prevLeg = sorted[legIdx];
    const nextLeg = sorted[legIdx + 1];
    const gapU = (t - prevLeg.t1) / Math.max(1e-4, nextLeg.t0 - prevLeg.t1);
    const pPrev = typeof prevLeg.plane === 'number' ? prevLeg.plane : 1.0;
    const pNext = typeof nextLeg.plane === 'number' ? nextLeg.plane : 1.0;
    const planeEst = lerp(pPrev, pNext, gapU);
    const scaleEst = lerp(
      prevLeg.scale ?? lerp(0.32, 1.0, clamp(pPrev, 0, 1.2)),
      nextLeg.scale ?? lerp(0.32, 1.0, clamp(pNext, 0, 1.2)),
      gapU
    );
    const baseY = typeof prevLeg.groundAt === 'function' ? prevLeg.groundAt(prevLeg.toX) : (prevLeg.toY ?? 0);
    return {
      activePlane: null,
      plane: planeEst,
      x: lerp(prevLeg.toX, nextLeg.fromX, gapU),
      groundY: baseY + 80,
      baseY,
      scale: scaleEst,
      facing: prevLeg.facing ?? (prevLeg.toX >= prevLeg.fromX ? 1 : -1),
      view: prevLeg.view ?? 'side',
      visible: false,
      legIndex: legIdx,
      legU: gapU,
      hazeAmount: clamp((1.0 - planeEst) * 0.75, 0, 1.0),
      yOffset: 80,
      isEmerging: false,
      isHiding: true,
    };
  }

  if (!leg) {
    if (t < first.t0) {
      leg = first;
      legIdx = 0;
      t = first.t0;
    } else {
      leg = last;
      legIdx = sorted.length - 1;
      t = last.t1;
    }
  }

  const legDur = Math.max(1e-4, leg.t1 - leg.t0);
  const legU = clamp((t - leg.t0) / legDur, 0, 1);
  const k = typeof leg.ease === 'function' ? leg.ease(legU) : smootherstep(0, 1, legU);
  const x = lerp(leg.fromX, leg.toX, k);

  let baseY = 0;
  if (typeof leg.groundAt === 'function') {
    baseY = leg.groundAt(x);
  } else if (Number.isFinite(leg.fromY) && Number.isFinite(leg.toY)) {
    baseY = lerp(leg.fromY, leg.toY, k);
  } else {
    baseY = leg.fromY ?? 0;
  }

  const hideDur = leg.hideDur ?? Math.min(0.45, legDur * 0.3);
  let yOffset = 0;
  let isEmerging = false;
  let isHiding = false;

  if (leg.enterHideY && (t - leg.t0) < hideDur) {
    isEmerging = true;
    const eu = clamp((t - leg.t0) / hideDur, 0, 1);
    yOffset = lerp(leg.enterHideY, 0, smootherstep(0, 1, eu));
  } else if (leg.exitHideY && (leg.t1 - t) < hideDur) {
    isHiding = true;
    const hu = clamp((leg.t1 - t) / hideDur, 0, 1);
    yOffset = lerp(leg.exitHideY, 0, smootherstep(0, 1, hu));
  }

  const planeNum = typeof leg.plane === 'number' ? leg.plane : 1.0;
  const defaultScale = lerp(0.32, 1.0, clamp(planeNum, 0, 1.2));
  const scale = leg.scale ?? defaultScale;
  const facing = leg.facing ?? (leg.toX >= leg.fromX ? 1 : -1);
  const view = leg.view ?? 'side';
  const hazeAmount = leg.haze ?? clamp((1.0 - planeNum) * 0.75, 0, 1.0);

  return {
    activePlane: leg.plane,
    plane: leg.plane,
    x,
    groundY: baseY + yOffset,
    baseY,
    scale,
    facing,
    view,
    visible: true,
    legIndex: legIdx,
    legU,
    hazeAmount,
    yOffset,
    isEmerging,
    isHiding,
  };
}

/**
 * Renders back-to-front depth planes with automatic parallax layer transforms,
 * optical defocus for far layers, and actor occlusion ordering.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} studio - Studio2D instance
 * @param {Array<object>} planes - Array of plane descriptors:
 *   - parallax: depth number (e.g. 0.15 horizon, 0.45 far-mid, 0.75 mid, 1.15 foreground)
 *   - softness: optional blur amount (e.g. 4 for distant hills)
 *   - actors: optional array of actor callbacks or objects { draw(ctx) }
 *   - draw: (ctx) => void
 *   - drawFore: optional (ctx) => void
 *   - layerOpts: optional options passed to beginLayer
 * @param {object} [opts]
 */
export function renderDepthPlanes(ctx, studio, planes = [], opts = {}) {
  if (!Array.isArray(planes) || !planes.length) return;
  const sorted = [...planes].sort((a, b) => (a.parallax ?? 1.0) - (b.parallax ?? 1.0));

  for (const plane of sorted) {
    const p = plane.parallax ?? 1.0;
    const renderContent = (targetCtx) => {
      studio.beginLayer(p, plane.layerOpts);
      if (typeof plane.draw === 'function') {
        plane.draw(targetCtx);
      }
      if (Array.isArray(plane.actors)) {
        for (const actor of plane.actors) {
          if (typeof actor === 'function') actor(targetCtx);
          else if (actor && typeof actor.draw === 'function') actor.draw(targetCtx);
        }
      }
      if (typeof plane.drawFore === 'function') {
        plane.drawFore(targetCtx);
      }
      studio.endLayer();
    };

    if (plane.softness && plane.softness > 0) {
      if (typeof opts.drawSoftLayer === 'function') {
        opts.drawSoftLayer(ctx, renderContent, { softness: plane.softness });
      } else {
        drawStudioSoftPass(ctx, renderContent, plane.softness);
      }
    } else {
      renderContent(ctx);
    }
  }
}

/**
 * Creates a 2.5D Multi-Plane Scroll / Canvas Studio (`createMultiPlaneStage`).
 */
export function createMultiPlaneStage(opts = {}) {
  const studio = createStudio2D(opts);
  return {
    ...studio,
    renderPlanes: (planes, renderOpts) => renderDepthPlanes(studio.ctx, studio, planes, renderOpts),
    evalTraversal: (t, waypoints, travOpts) => evalDepthTraversal(t, waypoints, travOpts),
  };
}
