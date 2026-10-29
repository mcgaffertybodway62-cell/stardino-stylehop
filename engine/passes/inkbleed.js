// Ink bleeding into raw rice paper: dark strokes spread along a fibrous noise field,
// colour drains toward ink tones, the sheet gets fibres and soft mottling.
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
void main() {
  vec2 p = v_uv;
  vec2 fc = p * u_res;
  vec3 src = texture(u_src, p).rgb;

  // Capillary spread: take the darkest sample along a noise-jittered ring
  float ink = 1.0 - luma(src);
  vec2 texel = 1.0 / u_res;
  float spread = 0.0;
  for (int i = 0; i < 12; i++) {
    float ang = float(i) * 0.5236 + vnoise(fc * 0.05) * 3.0;
    float rad = (2.0 + 3.5 * vnoise(fc * 0.09 + float(i))) * p_bleed;
    vec3 s = texture(u_src, p + vec2(cos(ang), sin(ang)) * rad * texel).rgb;
    spread = max(spread, (1.0 - luma(s)) * (0.55 + 0.25 * vnoise(fc * 0.2 + float(i) * 7.0)));
  }
  float wetEdge = max(0.0, spread - ink) * p_wet;
  float total = max(ink, spread * 0.7);

  float g = luma(src);
  vec3 tone = mix(src, vec3(g), p_desaturate);
  vec3 col = mix(tone, tone * (1.0 - wetEdge * 0.6), step(0.02, wetEdge));
  col = min(col, vec3(1.0 - total * 0.92) + (src - g) * (1.0 - p_desaturate));

  float fib = (vnoise(vec2(fc.x * 0.6, fc.y * 0.04)) - 0.5) * 0.05 + (vnoise(fc * 0.015) - 0.5) * 0.06;
  col += fib * p_fiber;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};
