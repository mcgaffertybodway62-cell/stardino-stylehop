// Phosphor CRT: barrel curvature, RGB mask, scanlines, glow, rolling refresh band.
export default {
  name: 'crt',
  label: 'CRT',
  params: { curvature: 0.08, scan: 0.35, glow: 0.6, shift: 1.2, tint: [0.55, 1.0, 0.7] },
  ui: { curvature: [0, 0.25], scan: [0, 1], glow: [0, 1.5], shift: [0, 4] },
  glsl: `
void main() {
  vec2 c = v_uv - 0.5;
  vec2 p = 0.5 + c * (1.0 + p_curvature * dot(c, c) * 4.0);
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 sh = vec2(p_shift / u_res.x, 0.0);
  vec3 col = vec3(texture(u_src, p + sh).r, texture(u_src, p).g, texture(u_src, p - sh).b);
  vec3 glow = vec3(0.0);
  for (int i = -2; i <= 2; i++)
    for (int j = -2; j <= 2; j++)
      glow += texture(u_src, p + vec2(float(i), float(j)) * 3.0 / u_res).rgb;
  col += glow / 25.0 * p_glow;
  float line = 0.5 + 0.5 * sin(p.y * u_res.y * 3.14159);
  col *= mix(1.0, line, p_scan);
  float mask = 0.85 + 0.15 * sin(p.x * u_res.x * 2.094);
  col *= mask;
  col *= mix(vec3(1.0), p_tint * 1.2, 0.5);
  col += 0.03 * smoothstep(0.02, 0.0, abs(fract(p.y - u_time * 0.12) - 0.5));
  // focused element glows hotter
  col *= 1.0 + 0.25 * (1.0 - smoothstep(0.0, 0.02, rectSdf(p, u_focusRect)));
  float vig = smoothstep(0.75, 0.35, length(c * vec2(1.0, 1.1)));
  outColor = vec4(clamp(col * vig, 0.0, 1.0), 1.0);
}`,
};
