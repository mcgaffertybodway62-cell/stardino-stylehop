// Liquid chromatic lens: a glass dome that follows the focus point and magnifies the DOM
// beneath it with per-channel dispersion. Ported from the original bento-lens page.
export default {
  name: 'lens',
  label: 'Liquid lens',
  params: { radius: 0.2, magnify: 0.6, dispersion: 1.0, rim: 0.8, shadow: 0.45 },
  ui: { radius: [0.06, 0.4], magnify: [0.3, 0.95], dispersion: [0, 3], rim: [0, 1.5], shadow: [0, 1] },
  glsl: `
void main() {
  vec2 a = aspectv();
  vec2 p = v_uv;
  vec2 c = u_focus;
  vec2 d = (p - c) * a;
  float r = length(d);
  float R = p_radius;

  float sh = smoothstep(R * 1.01, R * 1.3, length((p - c - vec2(0.011, 0.019)) * a));
  vec3 col = texture(u_src, p).rgb * mix(1.0 - p_shadow, 1.0, sh);

  if (r < R) {
    float nr = r / R;
    float z = sqrt(max(0.0, 1.0 - nr * nr));
    vec2 n = d / R;
    float mag = mix(p_magnify, mix(p_magnify, 1.0, 0.6), pow(nr, 2.15));
    vec2 base = c + (p - c) * mag;
    vec2 k = (n / a) * (1.0 - mag) * R * 0.19 * p_dispersion;
    vec3 lc = vec3(texture(u_src, clamp(base - k * 1.18, 0.0, 1.0)).r,
                   texture(u_src, clamp(base - k, 0.0, 1.0)).g,
                   texture(u_src, clamp(base - k * 0.82, 0.0, 1.0)).b);
    lc = lc * 1.1 + vec3(0.02, 0.05, 0.09) * (1.0 - z);
    vec3 N = normalize(vec3(n * 0.86, z));
    float s1 = pow(max(0.0, dot(N, normalize(vec3(-0.55, -0.65, 0.52) + vec3(0, 0, 1)))), 52.0);
    float s2 = pow(max(0.0, dot(N, normalize(vec3(0.6, 0.55, 0.58) + vec3(0, 0, 1)))), 28.0) * 0.35;
    float fres = pow(1.0 - z, 3.1);
    vec3 rimCol = mix(vec3(0.38, 0.72, 0.99), vec3(0.96, 0.53, 0.72), 0.5 + 0.5 * sin(u_time * 2.2 + atan(d.y, d.x)));
    lc += vec3(1.0, 0.98, 0.95) * (s1 * 0.68 + s2) + rimCol * fres * p_rim;
    col = mix(col, lc, smoothstep(R, R - 0.003, r));
  }
  outColor = vec4(col, 1.0);
}`,
};
