/**
 * HTML-in-Canvas stage: live DOM layers (multi-scene) -> WebGL2 composite -> pass chain.
 *
 * Chrome 157+ structure (both legacy attributes are emitted for Chrome 151–154):
 *
 *   <canvas id="stage" content="drawable" layoutsubtree width=W height=H>
 *     <section class="frame scene" drawable data-scene="launch" data-dur="3.5">...</section>
 *     <section class="frame scene" drawable data-scene="telemetry" data-dur="3.7">...</section>
 *     <aside class="card" data-layer drawable data-scene="launch">...</aside>
 *   </canvas>
 *
 * At any timestamp t, `applyScene(canvas, t)` sets `data-active="true"` on the active
 * `.frame` and matching `[data-layer]` children and hides inactive scenes via `display: none`.
 * The stage uploads only the active `.frame` (as the full-frame base layer) and active
 * `[data-layer]` children (as 3D perspective-tilted floating cards with drop shadows).
 *
 * Chrome 157 requires `updateElementGeometry()` for WebGL hit-testing. The stage clears
 * geometry before layout-dependent reads and applies an affine approximation after drawing.
 */

import { springStep, smootherstep, lerp, clamp } from './motion.js';
import {
  assertElementTextureApi,
  clearElementGeometry,
  ensureCanvasDrawable,
  markDrawable,
  markDrawableChildren,
  uploadElementTexture,
  updateElementGeometry,
} from './html_in_canvas.js';

const MAX_TARGETS = 16;

const QUAD_VS = `#version 300 es
in vec2 a_pos;
uniform float u_flip;  // -1 when drawing into an FBO so every texture stays DOM-oriented (v=0 at top)
out vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos.x, a_pos.y * u_flip, 0.0, 1.0);
}`;

// Floating layer: unit quad placed in pixel space with a perspective matrix.
const LAYER_VS = `#version 300 es
in vec2 a_pos;
uniform mat4 u_mvp;
uniform vec2 u_size;
uniform vec2 u_grow;
out vec2 v_uv;
void main() {
  vec2 c = a_pos * 0.5 + 0.5;
  v_uv = vec2(c.x, 1.0 - c.y);
  vec2 local = a_pos * 0.5 * (u_size + u_grow) * vec2(1.0, -1.0);
  gl_Position = u_mvp * vec4(local, 0.0, 1.0);
  gl_Position.y = -gl_Position.y;  // layers are only drawn into the (DOM-oriented) composite
}`;

const LAYER_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_alpha;
uniform float u_shadow;
uniform vec2 u_texel;
out vec4 outColor;
void main() {
  if (u_shadow > 0.0) {
    // Soft drop shadow from the layer's own alpha (shadow quad is drawn grown)
    float a = 0.0;
    for (int y = -2; y <= 2; y++)
      for (int x = -2; x <= 2; x++)
        a += texture(u_tex, v_uv + vec2(float(x), float(y)) * u_texel * 6.0).a;
    a /= 25.0;
    outColor = vec4(0.0, 0.0, 0.0, a * u_shadow * u_alpha);
    return;
  }
  vec4 c = texture(u_tex, v_uv);
  outColor = vec4(c.rgb, c.a * u_alpha);
}`;

const COPY_FS = `void main() { outColor = texture(u_src, v_uv); }`;

function passHeader(params) {
  const decl = Object.entries(params)
    .map(([k, v]) => {
      const n = Array.isArray(v) ? v.length : 1;
      return `uniform ${n === 1 ? 'float' : 'vec' + n} p_${k};`;
    })
    .join('\n');
  return `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_src;        // output of the previous stage
uniform sampler2D u_base;       // untouched composite (for passes that need the original)
uniform sampler2D u_paper;      // seamless tactile surface texture (bound on TEXTURE2)
uniform vec2 u_res;             // canvas size in px
uniform float u_time;           // seconds, keeps running in live mode
uniform float u_progress;       // 0..1 over the current scene or timeline
uniform float u_sceneMix;       // 0..1 smooth pulse around scene cuts
uniform vec2 u_focus;           // uv of the current focus point (pointer or auto tour)
uniform vec4 u_focusRect;       // uv rect (x, y, w, h) of the focused [data-focus] element
uniform vec4 u_targets[${MAX_TARGETS}];
uniform int u_targetCount;
${decl}
vec2 aspectv() { return vec2(u_res.x / u_res.y, 1.0); }
float hash21(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float rectSdf(vec2 p, vec4 r) {
  vec2 c = r.xy + r.zw * 0.5;
  vec2 d = abs((p - c) * aspectv()) - r.zw * 0.5 * aspectv();
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
`;
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    throw new Error(`Shader compile error:\n${log}\n---\n${src}`);
  }
  return sh;
}

function link(gl, vsSrc, fsSrc) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.bindAttribLocation(prog, 0, 'a_pos');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error:\n${gl.getProgramInfoLog(prog)}`);
  }
  const uniforms = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(prog, i).name.replace(/\[0\]$/, '');
    uniforms[name] = gl.getUniformLocation(prog, name);
  }
  return { prog, uniforms };
}

function makeTexture(gl, w, h, wrap = gl.CLAMP_TO_EDGE) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  if (w && h) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return tex;
}

function makeNeutralPaperTexture(gl) {
  const tex = makeTexture(gl, 1, 1, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([128, 128, 128, 255])
  );
  return tex;
}

function makeTarget(gl, w, h) {
  const tex = makeTexture(gl, w, h);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fbo };
}

// Column-major mat4 helpers (only what the layer transform needs)
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}
const translate = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const scale = (s) => new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
const rotX = (a) => new Float32Array([1, 0, 0, 0, 0, Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1]);
const rotY = (a) => new Float32Array([Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1]);
const rotZ = (a) => new Float32Array([Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/**
 * @param {HTMLCanvasElement} canvas  canvas with `content="drawable"`, CSS size == pixel size
 * @param {object} opts
 * @param {Array<{pass: object, params?: object}>} opts.passes  pass chain (see engine/passes/)
 * @param {object} [opts.layers]  floating-layer feel: { tilt, lift, shadow }
 * @param {object} [opts.textures]  optional surface textures: { paper: '../assets/textures/paper_fiber.png' }
 * @param {object} [opts.world]  optional 3D/Canvas world renderer: { canvas: HTMLCanvasElement, render(frame) }
 */
export function createStage(canvas, { passes = [], layers = {}, textures = {}, world = null } = {}) {
  const W = canvas.width;
  const H = canvas.height;
  ensureCanvasDrawable(canvas);
  markDrawableChildren(canvas);
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false });
  if (!gl) throw new Error('WebGL2 unavailable');
  assertElementTextureApi(gl);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const layerProg = link(gl, LAYER_VS, LAYER_FS);
  const baseProg = link(gl, QUAD_VS, passHeader({}) + COPY_FS.replace('u_src', 'u_base'));
  const copyProg = link(gl, QUAD_VS, passHeader({}) + COPY_FS);

  const composite = makeTarget(gl, W, H);
  const ping = [makeTarget(gl, W, H), makeTarget(gl, W, H)];
  const layerTex = new Map();
  const worldTex = makeTexture(gl);
  const paperTex = makeNeutralPaperTexture(gl);
  let worldRunner = world;

  let readyResolve;
  const ready = new Promise((r) => {
    readyResolve = r;
  });

  if (textures && textures.paper) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, paperTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
      readyResolve();
    };
    img.onerror = () => readyResolve();
    img.src = textures.paper;
  } else {
    readyResolve();
  }

  let chain = [];
  function setPasses(list) {
    chain = list.map(({ pass, params = {} }) => {
      const values = { ...pass.params, ...params };
      return { pass, values, ...link(gl, QUAD_VS, passHeader(values) + pass.glsl) };
    });
  }
  setPasses(passes);

  const layerFeel = { tilt: 0.18, lift: 36, shadow: 0.45, ...layers };
  const state = { bypass: false };

  function canvasRect() {
    return canvas.getBoundingClientRect();
  }

  function activeFrame() {
    return (
      canvas.querySelector(':scope > .frame[data-active="true"]') ||
      [...canvas.querySelectorAll(':scope > .frame')].find((el) => el.style.display !== 'none') ||
      canvas.querySelector(':scope > .frame')
    );
  }

  function activeLayers() {
    return [...canvas.querySelectorAll(':scope > [data-layer]')].filter((el) => el.style.display !== 'none');
  }

  /** uv rect (x, y, w, h) of any element inside the canvas */
  function uvRect(el, cr = canvasRect()) {
    const r = el.getBoundingClientRect();
    return [(r.left - cr.left) / cr.width, (r.top - cr.top) / cr.height, r.width / cr.width, r.height / cr.height];
  }

  function targets() {
    const cr = canvasRect();
    const scope = activeFrame() || canvas;
    return [...scope.querySelectorAll('[data-focus]')]
      .filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0)
      .slice(0, MAX_TARGETS)
      .map((el) => ({ el, rect: uvRect(el, cr) }));
  }

  /**
   * Deterministic focus tour across [data-focus] targets inside the active scene:
   * glide (spring-eased) to each target in DOM order, hold, move on.
   * Returns { focus: [u, v], rect: [x, y, w, h] }.
   */
  function tour(progress, list = targets()) {
    if (!list.length) return { focus: [0.5, 0.5], rect: [0.4, 0.4, 0.2, 0.2] };
    const n = list.length;
    const k = clamp(progress, 0, 0.9999) * n;
    const i = Math.floor(k);
    const f = smootherstep(0.0, 0.45, k - i);
    const from = i === 0 ? list[0] : list[i - 1];
    const to = list[i];
    const rect = from.rect.map((v, j) => lerp(v, to.rect[j], f));
    return { focus: [rect[0] + rect[2] / 2, rect[1] + rect[3] / 2], rect };
  }

  function placeLayers() {
    for (const el of activeLayers()) {
      const cs = getComputedStyle(el);
      const len = (v, total) => {
        v = v.trim();
        return v.endsWith('%') ? (parseFloat(v) / 100) * total : parseFloat(v) || 0;
      };
      el.style.transform = `translate(${len(cs.getPropertyValue('--x'), W)}px, ${len(cs.getPropertyValue('--y'), H)}px)`;
    }
  }

  async function paint() {
    await new Promise((resolve) => {
      canvas.onpaint = () => {
        canvas.onpaint = null;
        resolve();
      };
      canvas.requestPaint();
    });
  }

  const geometrySupported =
    typeof canvas.updateElementGeometry === 'function' && typeof canvas.clearElementGeometry === 'function';

  function clearActiveGeometry() {
    if (!geometrySupported) return;
    for (const el of [activeFrame(), ...activeLayers()].filter(Boolean)) clearElementGeometry(canvas, el);
  }

  function uploadActiveElements() {
    const baseEl = activeFrame();
    const layers = activeLayers();
    const toUpload = [baseEl, ...layers].filter(Boolean);
    for (const el of toUpload) {
      markDrawable(el);
      if (!layerTex.has(el)) layerTex.set(el, makeTexture(gl));
      uploadElementTexture(gl, layerTex.get(el), canvas, el);
    }
    return { baseEl, layers };
  }

  /**
   * Re-apply canvas geometry after drawing so WebGL layers remain hit-testable
   * and screen-reader bounds follow the composited card. Layout reads happen
   * after `clearElementGeometry()` at the top of the frame, so this affine
   * approximation never feeds back into the next frame's placement.
   */
  function syncActiveGeometry(baseEl, layers, cr, t) {
    if (!geometrySupported) return;
    if (baseEl) updateElementGeometry(canvas, baseEl, new DOMMatrix());

    const k = W / Math.max(1, cr.width);
    for (const el of layers) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const lx = (r.left - cr.left) * k;
      const ly = (r.top - cr.top) * k;
      const lw = r.width * k;
      const lh = r.height * k;
      const clock = el._localT ?? t;
      const delay = parseFloat(el.dataset.delay ?? '0.6');
      const enter = springStep(Math.max(0, clock - delay), 0.42, 7.5).x;
      const scale = 0.86 + 0.14 * enter;
      const tx = (lx + lw / 2) * (1 - scale);
      const ty = (ly + lh / 2) * (1 - scale) + (1 - enter) * 80;
      updateElementGeometry(canvas, el, new DOMMatrix().translate(tx, ty).scale(scale, scale));
    }
  }

  function drawLayer(el, tex, cr, t, focus) {
    const r = el.getBoundingClientRect();
    const k = W / cr.width;
    const w = r.width * k;
    const h = r.height * k;
    if (w <= 0 || h <= 0) return;
    const cx = (r.left - cr.left) * k + w / 2 - W / 2;
    const cy = (r.top - cr.top) * k + h / 2 - H / 2;

    // Entrance spring (evaluated on scene-local clock _localT when available) + focus-driven tilt
    const clock = el._localT ?? t;
    const delay = parseFloat(el.dataset.delay ?? '0.6');
    const enter = springStep(Math.max(0, clock - delay), 0.42, 7.5).x;
    const alpha = smootherstep(0, 0.3, clock - delay);
    const fx = (focus[0] - 0.5) * 2;
    const fy = (focus[1] - 0.5) * 2;
    const tilt = layerFeel.tilt;
    const spin = (parseFloat(getComputedStyle(el).getPropertyValue('--rotate')) || 0) * (Math.PI / 180);
    const lift = layerFeel.lift * (1 + 0.15 * Math.sin(t * 1.7 + cx * 0.01));
    const model = mul(
      translate(cx, cy + (1 - enter) * 80, lift),
      mul(mul(rotY(fx * tilt), rotX(-fy * tilt * 0.7)), mul(rotZ(spin), scale(0.86 + 0.14 * enter)))
    );
    const d = H * 2.2;
    const proj = new Float32Array([2 / W, 0, 0, 0, 0, -2 / H, 0, 0, 0, 0, 0, 0, 0, 0, -1 / d, 1]);

    const { prog, uniforms: u } = layerProg;
    gl.useProgram(prog);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(u.u_tex, 0);
    gl.uniform2f(u.u_size, w, h);
    gl.uniform1f(u.u_alpha, alpha);
    gl.uniform2f(u.u_texel, 1 / w, 1 / h);

    if (layerFeel.shadow > 0) {
      const shadowModel = mul(translate(lift * 0.5, lift * 0.9, -lift), model);
      gl.uniformMatrix4fv(u.u_mvp, false, mul(proj, shadowModel));
      gl.uniform2f(u.u_grow, 24, 24);
      gl.uniform1f(u.u_shadow, layerFeel.shadow);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.uniformMatrix4fv(u.u_mvp, false, mul(proj, model));
    gl.uniform2f(u.u_grow, 0, 0);
    gl.uniform1f(u.u_shadow, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function setCommon(u, frame, flip = -1) {
    gl.uniform1f(u.u_flip, flip);
    gl.uniform2f(u.u_res, W, H);
    gl.uniform1f(u.u_time, frame.time);
    gl.uniform1f(u.u_progress, frame.progress);
    if (u.u_sceneMix != null) gl.uniform1f(u.u_sceneMix, frame.sceneMix ?? 0);
    gl.uniform2f(u.u_focus, frame.focus[0], frame.focus[1]);
    gl.uniform4fv(u.u_focusRect, frame.focusRect);
    if (u.u_targets) {
      const flat = new Float32Array(MAX_TARGETS * 4);
      frame.targets.forEach((tg, i) => flat.set(tg.rect, i * 4));
      gl.uniform4fv(u.u_targets, flat);
    }
    gl.uniform1i(u.u_targetCount, frame.targets.length);
    gl.uniform1i(u.u_src, 0);
    gl.uniform1i(u.u_base, 1);
    if (u.u_paper != null) gl.uniform1i(u.u_paper, 2);
  }

  /**
   * Paint DOM, upload active scene + active floating layers, composite, run passes.
   * @param {object} frame { t, time, progress, sceneMix?, focus?, focusRect? }
   */
  async function render(frame) {
    // New direct children must be drawable before Blink records their paint.
    markDrawableChildren(canvas);
    // Chrome 157 persists geometry across frames; reset before any layout reads.
    clearActiveGeometry();
    placeLayers();
    const list = targets();
    const auto = tour(frame.sceneProgress ?? frame.progress, list);
    const f = {
      time: frame.time ?? frame.t,
      progress: frame.progress,
      sceneMix: frame.sceneMix ?? 0,
      focus: frame.focus ?? auto.focus,
      focusRect: frame.focusRect ?? auto.rect,
      targets: list,
    };

    await paint();
    const { baseEl, layers } = uploadActiveElements();
    const cr = canvasRect();

    if (worldRunner && typeof worldRunner.render === 'function') {
      await worldRunner.render({
        ...frame,
        ...f,
        width: W,
        height: H,
        baseEl,
        layers,
      });
    }
    const hasWorldCanvas = Boolean(worldRunner && worldRunner.canvas);
    if (hasWorldCanvas) {
      gl.bindTexture(gl.TEXTURE_2D, worldTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, worldRunner.canvas);
    }

    // 1. Composite: optional 3D/Canvas world backdrop -> active base scene -> active floating layers
    gl.bindFramebuffer(gl.FRAMEBUFFER, composite.fbo);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (hasWorldCanvas) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, worldTex);
      gl.activeTexture(gl.TEXTURE0);
      gl.useProgram(baseProg.prog);
      setCommon(baseProg.uniforms, f);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (baseEl && layerTex.has(baseEl)) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, layerTex.get(baseEl));
      gl.activeTexture(gl.TEXTURE0);
      gl.useProgram(baseProg.prog);
      setCommon(baseProg.uniforms, f);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    for (const el of layers) {
      drawLayer(el, layerTex.get(el), cr, frame.t, f.focus);
    }
    gl.disable(gl.BLEND);

    // 2. Pass chain (ping-pong), last stage goes to the screen
    const stages = state.bypass || !chain.length ? [{ ...copyProg, values: {} }] : chain;
    let src = composite.tex;
    stages.forEach((p, i) => {
      const last = i === stages.length - 1;
      const dst = last ? null : ping[i % 2];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fbo : null);
      gl.viewport(0, 0, W, H);
      gl.useProgram(p.prog);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, paperTex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, composite.tex);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src);
      setCommon(p.uniforms, f, last ? 1 : -1);
      for (const [k, v] of Object.entries(p.values)) {
        const loc = p.uniforms['p_' + k];
        if (loc == null) continue;
        if (!Array.isArray(v)) gl.uniform1f(loc, v);
        else gl[`uniform${v.length}fv`](loc, v);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (dst) src = dst.tex;
    });

    syncActiveGeometry(baseEl, layers, cr, frame.t);
    return f;
  }

  return {
    gl,
    ready,
    render,
    tour,
    targets,
    uvRect,
    activeFrame,
    activeLayers,
    setPasses,
    setWorld(w) {
      worldRunner = w;
    },
    get chain() {
      return chain;
    },
    setParam(passIndex, name, value) {
      if (chain[passIndex]) chain[passIndex].values[name] = value;
    },
    set bypass(v) {
      state.bypass = v;
    },
    get bypass() {
      return state.bypass;
    },
  };
}
