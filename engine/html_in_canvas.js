/**
 * HTML-in-Canvas compatibility layer.
 *
 * Chrome 157+ (stable):
 *   - <canvas content="drawable"> opts descendants into layout/paint.
 *   - Every independently drawn element carries `drawable`.
 *   - WebGL uploads use `texElementSubImage2D(target, level, xoffset, yoffset, el)`
 *     into storage pre-allocated with `texImage2D(..., null)`.
 *   - `canvas.updateElementGeometry()` is required for WebGL hit-testing/a11y.
 *
 * Chrome 151–154 (legacy):
 *   - <canvas layoutsubtree> and `gl.texElementImage2D(target, RGBA8, el)`.
 *
 * Both attributes are written so a single document works on either runtime.
 * The legacy path is intentionally isolated here; engine code only calls the
 * helpers below.
 */

const DRAWABLE = 'drawable';
const textureSizes = new WeakMap(); // WebGLTexture -> { width, height }

/** Opt a canvas into HTML layout + paint across Chrome generations. */
export function ensureCanvasDrawable(canvas) {
  if (!canvas) throw new Error('HTML-in-Canvas: canvas is required');
  if (canvas.getAttribute('content') !== DRAWABLE) canvas.setAttribute('content', DRAWABLE);
  // Chrome 151–154 still needs the boolean attribute. Chrome 155+ ignores it.
  if (!canvas.hasAttribute('layoutsubtree')) canvas.setAttribute('layoutsubtree', '');
  return canvas;
}

/** Mark an element as an independent paint root (required on Chrome 155+). */
export function markDrawable(element) {
  if (element && !element.hasAttribute(DRAWABLE)) element.setAttribute(DRAWABLE, '');
  return element;
}

/** Mark direct scene/layer children of a stage canvas. */
export function markDrawableChildren(canvas) {
  if (!canvas) return;
  for (const el of canvas.querySelectorAll(':scope > .frame, :scope > [data-layer]')) markDrawable(el);
}

/** Feature detection that does not rely on a version string. */
export function supportsHtmlInCanvas(canvas) {
  if (!canvas) return false;
  return canvas.content === DRAWABLE || typeof canvas.requestPaint === 'function';
}

/** True when the context exposes either generation of element-texture upload. */
export function hasElementTextureApi(gl) {
  return typeof gl?.texElementSubImage2D === 'function' || typeof gl?.texElementImage2D === 'function';
}

export function assertElementTextureApi(gl) {
  if (!hasElementTextureApi(gl)) {
    throw new Error(
      'HTML-in-Canvas WebGL upload unavailable. Use Chrome 157+ (recommended), or Chrome 151–154 with --enable-blink-features=CanvasDrawElement.'
    );
  }
}

/**
 * Natural element size in canvas grid pixels.
 * Chrome 155+ exposes `getElementImageDefaultSize`; the fallback matches the
 * old auto-allocation rule (CSS border box × canvas scale).
 */
export function getElementImageSize(canvas, element) {
  if (typeof canvas.getElementImageDefaultSize === 'function') {
    const size = canvas.getElementImageDefaultSize(element);
    if (size && size.width > 0 && size.height > 0) {
      return { width: size.width, height: size.height };
    }
  }
  const rect = element.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(1, canvas.clientWidth || canvas.width);
  const scaleY = canvas.height / Math.max(1, canvas.clientHeight || canvas.height);
  return { width: rect.width * scaleX, height: rect.height * scaleY };
}

/**
 * Upload a drawable element into a WebGL texture.
 *
 * Chrome 157+ path allocates `RGBA8` storage lazily and re-allocates only when
 * the element's natural size changes. Chrome 151–154 keeps the old
 * auto-allocating three-argument call.
 */
export function uploadElementTexture(gl, texture, canvas, element, { flipY = false } = {}) {
  assertElementTextureApi(gl);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const previousFlip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
  if (flipY) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  try {
    if (typeof gl.texElementSubImage2D === 'function') {
      const { width, height } = getElementImageSize(canvas, element);
      const w = Math.max(1, Math.ceil(width));
      const h = Math.max(1, Math.ceil(height));
      const cached = textureSizes.get(texture);
      if (!cached || cached.width !== w || cached.height !== h) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        textureSizes.set(texture, { width: w, height: h });
      }
      gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, element);
    } else {
      gl.texElementImage2D(gl.TEXTURE_2D, gl.RGBA8, element);
    }
  } finally {
    if (flipY) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, previousFlip);
  }
  return texture;
}

/** Synchronous main-thread geometry update; no-op on legacy Chrome. */
export function updateElementGeometry(canvas, element, canvasTransform, options = {}) {
  if (typeof canvas.updateElementGeometry !== 'function') return false;
  canvas.updateElementGeometry(element, { canvasTransform, ...options });
  return true;
}

/** Reset geometry after a frame so layout queries see the un-drawn border box. */
export function clearElementGeometry(canvas, element) {
  if (typeof canvas.clearElementGeometry !== 'function') return false;
  canvas.clearElementGeometry(element);
  return true;
}
