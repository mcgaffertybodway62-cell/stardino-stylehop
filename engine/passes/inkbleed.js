// Ink bleeding into raw Xuan rice paper: anisotropic capillary domain warping along
// mulberry paper fibers + coffee-ring pigment boundary accumulation (`破墨毛细渗化与宿墨水线`).
export default {
  name: 'inkbleed',
  label: 'Ink bleed',
  params: { bleed: 1.0, fiber: 1.0, desaturate: 0.6, wet: 0.5 },
  ui: { bleed: [0, 3], fiber: [0, 2], desaturate: [0, 1], wet: [0, 1.5] },
  glsl: `
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float fbmPaper(vec2 p) {
  float v = 0.5 * vnoise(p);
  v += 0.3 * vnoise(p * 2.13 + vec2(17.3, 9.1));
  v += 0.2 * vnoise(p * 4.37 + vec2(3.7, 29.4));
  return v;
}
void main() {
  vec2 p = v_uv;
  vec2 fc = p * u_res;
  vec2 texel = 1.0 / u_res;

  // Anisotropic Xuan-paper fiber field (long horizontal/diagonal bast fibers + fine capillary grain)
  float fLong = vnoise(vec2(fc.x * 0.16, fc.y * 0.45)) - 0.5;
  float fFine = fbmPaper(fc * 0.22) - 0.5;
  vec2 warp = vec2(fLong * 1.35 + fFine * 0.85, fFine * 1.05) * p_bleed * 1.65 * texel;

  vec3 srcCenter = texture(u_src, p).rgb;
  vec3 srcWarped = texture(u_src, clamp(p + warp, vec2(0.0), vec2(1.0))).rgb;
  float ink0 = 1.0 - luma(srcCenter);
  // Apply stronger fiber domain-warping along stroke/wash boundaries
  vec3 src = mix(srcCenter, srcWarped, smoothstep(0.02, 0.35, ink0) * clamp(p_bleed * 1.4, 0.0, 1.0));

  // Capillary diffusion ring: sample along fiber-skewed radial directions
  float ink = 1.0 - luma(src);
  float spread = 0.0;
  float meanSpread = 0.0;
  for (int i = 0; i < 12; i++) {
    float ang = float(i) * 0.5235988 + fFine * 2.4;
    float rad = (1.6 + 3.8 * fbmPaper(fc * 0.08 + float(i) * 3.1)) * p_bleed;
    vec2 dir = vec2(cos(ang) * 1.18, sin(ang) * 0.92);
    vec3 s = texture(u_src, clamp(p + dir * rad * texel, vec2(0.0), vec2(1.0))).rgb;
    float sInk = (1.0 - luma(s)) * (0.58 + 0.28 * vnoise(fc * 0.18 + float(i) * 7.0));
    spread = max(spread, sInk);
    meanSpread += sInk;
  }
  meanSpread /= 12.0;

  // Coffee-ring capillary water-line: pigment accumulates where wet halo meets dry fibers
  float wetHalo = max(0.0, spread - ink);
  float coffeeRing = smoothstep(0.015, 0.09, wetHalo) * (1.0 - smoothstep(0.09, 0.24, wetHalo)) * (0.65 + 0.7 * fFine);
  float wetEdge = (wetHalo * 0.65 + coffeeRing * 0.55) * p_wet;
  float total = max(ink, mix(meanSpread, spread, 0.65) * 0.74);

  float g = luma(src);
  vec3 tone = mix(src, vec3(g), p_desaturate);
  vec3 col = mix(tone, tone * (1.0 - wetEdge * 0.68), step(0.012, wetEdge));
  col = min(col, vec3(1.0 - total * 0.92) + (src - g) * (1.0 - p_desaturate));

  float fib = (vnoise(vec2(fc.x * 0.55, fc.y * 0.045)) - 0.5) * 0.048
            + (vnoise(vec2(fc.x * 0.05, fc.y * 0.52)) - 0.5) * 0.028
            + (fFine) * 0.052;
  col += fib * p_fiber;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};
