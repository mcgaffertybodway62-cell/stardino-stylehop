// Paper / film grain with tactile surface texture (u_paper), vignette, warm tint,
// and subtle optical shutter pulse at scene cuts (u_sceneMix).
export default {
  name: 'grain',
  label: 'Tactile Grain & Vignette',
  params: { amount: 0.04, paper: 0.035, vignette: 0.25, warm: 0.0, animate: 1.0 },
  ui: { amount: [0, 0.15], paper: [0, 0.15], vignette: [0, 1], warm: [-1, 1], animate: [0, 1] },
  glsl: `
void main() {
  vec2 fc = v_uv * u_res;
  vec3 col = texture(u_src, v_uv).rgb;
  float seed = floor(u_time * 12.0) * p_animate;
  float n = hash21(fc + seed * 17.0) * 0.6 + hash21(floor(fc * 0.5) + 3.0) * 0.4 - 0.5;
  float fiber = texture(u_paper, fract(fc / 512.0)).r - 0.5;
  col += n * p_amount + fiber * p_paper;
  col *= mix(1.0, smoothstep(1.1, 0.3, length((v_uv - 0.5) * vec2(1.15, 1.0))), p_vignette);
  col += vec3(0.04, 0.015, -0.03) * p_warm;
  col += vec3(0.035, 0.045, 0.065) * u_sceneMix * 0.45;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};
