// Tactile Polymer Clay Relief, Sculptor Thumbprint Whorls & Miniature Tilt-Shift DoF (`engine/passes/clay.js`).
// Uses `u_paper` (`assets/textures/clay_thumbprint.png`: R=thumbprint whorls, G=plasticine micro-dimples, B=marbled seam)
// to emboss DOM cards and typography with warm sunlit matte clay subsurface scattering, a roving sculptor's
// macro inspection zone around `u_focusRect`, and top/bottom miniature tilt-shift depth-of-field blur.
export default {
  name: 'clay',
  label: 'Clay Relief & Tilt-Shift',
  params: {
    relief: 0.048,
    whorl: 0.036,
    tiltShift: 0.42,
    warmBounce: 0.28,
    boil: 1.0,
  },
  ui: {
    relief: [0, 0.12],
    whorl: [0, 0.1],
    tiltShift: [0, 1.0],
    warmBounce: [0, 0.8],
    boil: [0, 1],
  },
  glsl: `
void main() {
  vec2 a = aspectv();
  vec2 p = v_uv;
  vec2 texel = 1.0 / u_res;

  // 1. Stop-motion 12fps quantized frame boil (on twos) for authentic handcrafted plasticine feel
  float frameStep = floor(u_time * 12.0) * p_boil;
  vec2 boilOffset = vec2(
    hash21(vec2(frameStep, 11.7)) - 0.5,
    hash21(vec2(frameStep, 37.3)) - 0.5
  ) * 0.0018 * p_boil;

  // 2. Sample seamless clay thumbprint & micro-dimple normal/height map (512x512 tiled)
  vec2 clayUv = fract((p * u_res) / 420.0 + boilOffset);
  vec3 tCenter = texture(u_paper, clayUv).rgb;
  vec3 tRight  = texture(u_paper, clayUv + vec2(1.0 / 512.0, 0.0)).rgb;
  vec3 tDown   = texture(u_paper, clayUv + vec2(0.0, 1.0 / 512.0)).rgb;

  // Height gradient from thumbprint whorls (R) and micro-dimples (G)
  float h0 = (tCenter.r - 0.5) * 0.72 + (tCenter.g - 0.5) * 0.28;
  float hx = (tRight.r  - 0.5) * 0.72 + (tRight.g  - 0.5) * 0.28;
  float hy = (tDown.r   - 0.5) * 0.72 + (tDown.g   - 0.5) * 0.28;
  vec2 grad = vec2(hx - h0, hy - h0);

  // 3. Subtle hand-pinched organic edge wobble around the focused [data-focus] card (or center stage if pure 3D)
  float hasDomFocus = step(0.5, float(u_targetCount));
  float focusDist = rectSdf(p, u_focusRect);
  float domFocusZone = smoothstep(0.24, -0.02, focusDist);
  float stageCenterZone = smoothstep(0.45, 0.14, length((p - vec2(0.5, 0.52)) * a));
  float focusZone = mix(stageCenterZone, domFocusZone, hasDomFocus);
  vec2 pinchWarp = grad * (0.0014 + 0.0010 * focusZone) * (p_relief * 14.0);
  vec2 uvWarped = clamp(p + pinchWarp, 0.0, 1.0);

  // 4. Base color + DOM luminance bevel gradient (makes cards & big titles look like thick pinched clay slabs)
  vec3 baseCol = texture(u_src, uvWarped).rgb;
  float l0 = luma(baseCol);
  float lx = luma(texture(u_src, clamp(uvWarped + vec2(texel.x * 2.5, 0.0), 0.0, 1.0)).rgb);
  float ly = luma(texture(u_src, clamp(uvWarped + vec2(0.0, texel.y * 2.5), 0.0, 1.0)).rgb);
  vec2 domBevel = vec2(lx - l0, ly - l0);

  // 5. Miniature Tilt-Shift shallow depth-of-field blur at top and bottom of tabletop viewport
  // Keep both the vertical center band AND the active [data-focus] element sharp
  float edgeBand = smoothstep(0.26, 0.50, abs(p.y - 0.5));
  float blurMask = edgeBand * (1.0 - focusZone * 0.88) * p_tiltShift;

  vec3 col = baseCol;
  if (blurMask > 0.01) {
    vec3 acc = vec3(0.0);
    float wSum = 0.0;
    vec2 rStep = texel * (2.2 + 5.5 * blurMask);
    for (int j = -2; j <= 2; j++) {
      for (int i = -2; i <= 2; i++) {
        float w = 1.0 / (1.0 + float(i * i + j * j) * 0.45);
        vec2 sUv = clamp(uvWarped + vec2(float(i), float(j)) * rStep, 0.0, 1.0);
        acc += texture(u_src, sUv).rgb * w;
        wSum += w;
      }
    }
    col = mix(baseCol, acc / wSum, clamp(blurMask * 1.15, 0.0, 1.0));
  }

  // 6. Sunlit Studio Lighting (Upper-Left Warm Key Light + Lower-Right Peach Tabletop Bounce)
  vec2 lightDir = normalize(vec2(-0.68, -0.73));
  float clayShade = dot(grad, lightDir) * p_whorl * 16.0 + dot(domBevel, lightDir) * p_relief * 2.4;
  col += vec3(1.0, 0.96, 0.88) * max(0.0, clayShade);
  col -= vec3(0.24, 0.30, 0.36) * max(0.0, -clayShade) * 0.85;

  // Marbled clay pigment warmth & focal sculptor spotlight
  float marble = (tCenter.b - 0.5) * 0.035;
  col += vec3(0.045, 0.018, -0.012) * marble;

  // Warm afternoon sun beam from upper-left + peach tabletop bounce at bottom
  float sunKey = smoothstep(1.15, 0.0, length((p - vec2(0.18, 0.12)) * a));
  float peachBounce = smoothstep(0.35, 1.0, p.y);
  col += vec3(0.055, 0.038, 0.012) * sunKey * p_warmBounce;
  col += vec3(0.048, 0.022, 0.015) * peachBounce * p_warmBounce * 0.65;

  // Highlight ring around the focused DOM element only when DOM [data-focus] targets exist
  float rim = hasDomFocus * exp(-abs(focusDist) * 95.0) * (0.35 + 0.15 * sin(u_time * 3.0));
  col += vec3(0.96, 0.72, 0.38) * rim * 0.32;

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};
