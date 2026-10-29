/**
 * Style-agnostic 3D Studio (`engine/studio3d.js`).
 *
 * Everything a 3D style needs that is NOT about its medium: renderer + aspect-adapted camera,
 * the look rig (energy budget, IBL, contact shadow), per-scene looks from `data-look`, the
 * shot-list director and the single per-frame `render(frame)`. A style kernel calls
 * `createStudio3D` and adds only its own medium (palette, textures, materials, set floor):
 *
 *   const studio = createStudio3D(THREE, {
 *     width, height, scenes,
 *     look: resolveLook(LOOK_DEFAULTS, MY_STYLE_LOOK, style.look),
 *     presets: { ...MY_STYLE_PRESETS, ...style.looks },
 *     maxDist: 26,
 *   });
 *   // ...build materials / props...
 *   const director = studio.director({ subjects, shots });
 *   // per frame: pose props; director.update(frame); studio.render(frame);
 */

import { resolveAspectFraming, evalCameraShot, applyThreeCamera } from './camera.js';
import { LOOK_PRESETS, createLookRig, createLookTimeline } from './look.js';
import { createDirector } from './director.js';

/**
 * @param {object} THREE
 * @param {object} opts
 * @param {number} opts.width
 * @param {number} opts.height
 * @param {object} opts.look            fully resolved look (see `resolveLook`)
 * @param {object} [opts.presets]       name -> look layer for `data-look`; defaults to `LOOK_PRESETS`
 * @param {object[]} [opts.scenes]      `scenes` passed to `createWorld`
 * @param {number} [opts.baseFov=31]    landscape vertical fov; portrait / square widen it
 * @param {number} [opts.maxDist]       director camera distance cap (set edge / fog falloff)
 */
export function createStudio3D(THREE, { width, height, look, presets = LOOK_PRESETS, scenes = [], baseFov = 31, maxDist = null, near = 0.5, far = 200 }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  // The look rig must exist before any material is created (colour management).
  const lookRig = createLookRig(THREE, { renderer, scene, look });
  const lookTimeline = createLookTimeline(THREE, { base: look, presets, scenes });

  const framing = resolveAspectFraming(width, height, baseFov);
  const camera = new THREE.PerspectiveCamera(framing.fov, framing.aspect, near, far);

  /** Hand-placed camera move from `engine/camera.js` (orbit / crane / track ...). */
  function applyShot(shotSpec, u, localT = 0, opts = {}) {
    const state = evalCameraShot(shotSpec, u, localT, { baseFov: framing.fov, ...opts });
    applyThreeCamera(camera, state, { distScale: framing.distScale });
    return state;
  }

  /** Shot-list director for this camera; create it after the props are built and posed. */
  function director({ subjects = {}, shots = {} } = {}) {
    return createDirector(THREE, { camera, scenes, subjects, shots, aspect: framing.aspect, lensBase: baseFov, maxDist });
  }

  /** Draw a frame. Pass the frame so per-scene looks (`data-look`) apply. */
  function render(frame = null) {
    if (frame && lookTimeline.animated) {
      const { look: l, envLook } = lookTimeline.at(frame.sceneIndex ?? 0, frame.localT ?? 0);
      lookRig.apply(l, { envLook });
    }
    lookRig.render(camera);
  }

  return { canvas, renderer, scene, camera, framing, lookRig, applyShot, director, render };
}
