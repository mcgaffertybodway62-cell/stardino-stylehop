// Dark-field spotlight: the board sits in cool ambient light, a warm cone follows the
// focus point and a soft frame hugs the focused element. Bright strokes bloom like chalk.
// Ported from the original manuscript-spotlight page.
export default {
  name: 'spotlight',
  label: 'Spotlight',
  params: { radius: 0.28, ambient: 0.45, warmth: 1.0, bloom: 0.5, frame: 0.6 },
  ui: { radius: [0.1, 0.6], ambient: [0.1, 1], warmth: [0, 2], bloom: [0, 1.5], frame: [0, 1.5] },
  glsl: `
void main() {
  vec2 a = aspectv();
  vec2 cen = v_uv - 0.5;
  vec2 p = clamp(0.5 + cen * (1.0 + 0.03 * dot(cen * a, cen * a)), 0.0, 1.0);
  vec3 dom = texture(u_src, p).rgb;

  vec2 texel = 2.5 / u_res;
  vec3 bloom = vec3(0.0);
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec3 s = texture(u_src, clamp(p + vec2(float(x), float(y)) * texel, 0.0, 1.0)).rgb;
      bloom += s * smoothstep(0.42, 0.85, luma(s));
    }
  bloom /= 9.0;

  float dist = length((p - u_focus) * a);
  float cone = exp(-(dist * dist) / (2.0 * p_radius * p_radius));
  float inRect = 1.0 - smoothstep(0.0, 0.05, rectSdf(p, u_focusRect));
  float lit = max(cone, inRect * 0.85);

  vec3 ambient = dom * vec3(0.46, 0.54, 0.68) * (p_ambient / 0.45);
  vec3 warm = dom * mix(vec3(1.15), vec3(1.38, 1.26, 1.06), p_warmth) + vec3(0.07, 0.045, 0.01) * cone * p_warmth;
  vec3 col = mix(ambient, warm, lit);
  col += bloom * (0.28 + 0.34 * lit) * vec3(1.05, 0.92, 0.72) * p_bloom * 2.0;

  float edge = abs(rectSdf(p, u_focusRect) - 0.012);
  col += vec3(0.96, 0.66, 0.2) * smoothstep(0.003, 0.0, edge) * p_frame * 0.5;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};
