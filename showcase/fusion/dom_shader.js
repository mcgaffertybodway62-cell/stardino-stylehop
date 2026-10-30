/**
 * HTML-in-Canvas × WebGL2 Zero-Copy Shader Bridge
 *
 * Contract:
 * 1. <canvas id="stage" width="1920" height="1080" content="drawable" layoutsubtree>
 *      <div id="dom-scene" drawable>...live HTML/CSS/SVG/Math layout...</div>
 *    </canvas>
 * 2. Call `await stage.syncAndUpload()` inside `window.render(t)` to trigger
 *    Blink's Paint phase via `canvas.requestPaint()` + `canvas.onpaint`, then
 *    upload the painted DOM record. Chrome 157+ uses
 *    `gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, domElement)` into
 *    pre-allocated storage; Chrome 151–154 falls back to the legacy
 *    3-argument `gl.texElementImage2D`.
 */

import {
  assertElementTextureApi,
  ensureCanvasDrawable,
  markDrawable,
  uploadElementTexture,
} from '../../engine/html_in_canvas.js';

export const FULLSCREEN_QUAD_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  // Flip Y so DOM top-left is UV (0, 0) and bottom-right is UV (1, 1)
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`WebGL2 shader compile error:\n${log}`);
  }
  return shader;
}

/**
 * Initializes a WebGL2 full-screen shader stage backed by a live HTML-in-Canvas DOM child.
 *
 * @param {HTMLCanvasElement} canvas - Canvas element with `content="drawable"`
 * @param {HTMLElement} domElement - Direct child element inside `canvas` to rasterize
 * @param {string} fragmentShaderSource - GLSL ES 3.00 fragment shader (`in vec2 v_uv; uniform sampler2D u_dom;`)
 * @param {string[]} [uniformNames=[]] - List of uniform names to look up on the compiled program
 */
export function createDomShaderStage(canvas, domElement, fragmentShaderSource, uniformNames = []) {
  ensureCanvasDrawable(canvas);
  markDrawable(domElement);
  const gl = canvas.getContext('webgl2', {
    preserveDrawingBuffer: true,
    antialias: false,
    alpha: false,
  });
  if (!gl) {
    throw new Error('Failed to initialize WebGL2 context on HTML-in-Canvas stage.');
  }
  assertElementTextureApi(gl);

  const prog = gl.createProgram();
  const vs = compileShader(gl, gl.VERTEX_SHADER, FULLSCREEN_QUAD_VS);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'a_pos');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`WebGL2 program link error:\n${gl.getProgramInfoLog(prog)}`);
  }
  gl.useProgram(prog);

  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const domTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, domTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const allUniforms = Array.from(new Set(['u_dom', 'u_res', 'u_time', ...uniformNames]));
  const uniforms = {};
  for (const name of allUniforms) {
    uniforms[name] = gl.getUniformLocation(prog, name);
  }

  if (uniforms.u_dom !== null) {
    gl.uniform1i(uniforms.u_dom, 0);
  }

  async function syncAndUpload() {
    await new Promise((resolve) => {
      canvas.onpaint = () => {
        canvas.onpaint = null;
        resolve();
      };
      canvas.requestPaint();
    });
    gl.activeTexture(gl.TEXTURE0);
    uploadElementTexture(gl, domTex, canvas, domElement);
  }

  function drawQuad() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  return {
    gl,
    prog,
    domTex,
    uniforms,
    canvas,
    domElement,
    syncAndUpload,
    drawQuad,
  };
}

/**
 * Analytical underdamped 2nd-order spring-damper step response:
 * x''(t) + 2*zeta*w0*x'(t) + w0^2*x(t) = w0^2 * u(t)
 */
export function springStep(t, zeta = 0.24, w0 = 8.5) {
  if (t <= 0) return { x: 0, v: 0 };
  const s = Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
  const wd = w0 * s;
  const env = Math.exp(-zeta * w0 * t);
  const x = 1 - env * (Math.cos(wd * t) + (zeta / s) * Math.sin(wd * t));
  const v = env * ((w0 / s) * Math.sin(wd * t));
  return { x, v };
}

/**
 * C2-continuous Quintic Perlin smootherstep interpolation
 */
export function smootherstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Linear interpolation
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Scalar clamp
 */
export function clamp(x, min = 0, max = 1) {
  return Math.max(min, Math.min(max, x));
}
