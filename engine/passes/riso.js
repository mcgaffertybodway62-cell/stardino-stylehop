// Twin-drum risograph: any composite is separated into two ink densities (least-squares
// in absorbance space), each drum printed slightly out of register, midtones screened
// with rotated halftone dots, warm paper grain. A loupe band near the focus magnifies
// the screen. Ported from the original risograph-editorial page.
export default {
  name: 'riso',
  label: 'Risograph',
  params: {
    offset: 0.0022,
    halftone: 1.0,
    grain: 1.0,
    loupe: 1.0,
    paper: [0.957, 0.937, 0.902],
    inkA: [0.98, 0.33, 0.55],
    inkB: [0.16, 0.32, 0.78],
  },
  ui: { offset: [0, 0.008], halftone: [0, 2], grain: [0, 2], loupe: [0, 2] },
  glsl: `
float screen(vec2 fc, float ang, float freq) {
  float s = sin(ang), c = cos(ang);
  vec2 g = sin((mat2(c, -s, s, c) * fc * freq) * 6.2831853);
  return 0.5 + 0.25 * (g.x + g.y);
}
// Solve colour ~= paper * inkA^dA * inkB^dB for (dA, dB)
vec2 densities(vec3 c) {
  vec3 A = -log(max(c, 0.003) / p_paper);
  vec3 a = -log(max(p_inkA, 0.003));
  vec3 b = -log(max(p_inkB, 0.003));
  float aa = dot(a, a), bb = dot(b, b), ab = dot(a, b);
  vec2 d = vec2(bb * dot(a, A) - ab * dot(b, A), aa * dot(b, A) - ab * dot(a, A)) / max(aa * bb - ab * ab, 1e-4);
  return clamp(d, 0.0, 1.8);
}
void main() {
  vec2 p = v_uv;
  vec2 fc = p * u_res;
  float band = exp(-pow(abs(p.x - u_focus.x) / 0.1, 2.0)) * p_loupe;
  vec2 off = vec2(p_offset, p_offset * 0.6) * (1.0 + sin(u_time * 0.7) * 0.3) * mix(0.6, 1.6, band);

  float dA = densities(texture(u_src, clamp(p + off, 0.0, 1.0)).rgb).x;
  float dB = densities(texture(u_src, clamp(p - off * 0.85, 0.0, 1.0)).rgb).y;

  float freq = 0.22 - 0.07 * band;
  float hA = screen(fc, 0.7854, freq);
  float hB = screen(fc, 0.2618, freq);
  dA = max(0.0, dA + (hA - 0.5) * smoothstep(0.04, 0.3, dA) * (1.0 - smoothstep(0.7, 1.0, dA)) * 0.7 * p_halftone);
  dB = max(0.0, dB + (hB - 0.5) * smoothstep(0.04, 0.3, dB) * (1.0 - smoothstep(0.7, 1.0, dB)) * 0.7 * p_halftone);

  vec3 col = p_paper * pow(max(p_inkA, 0.003), vec3(dA)) * pow(max(p_inkB, 0.003), vec3(dB));
  float fiber = (hash21(floor(fc * 0.5)) * 0.65 + hash21(floor(fc * 0.25 + 17.0)) * 0.35 - 0.5) * 0.045 * p_grain;
  float vig = smoothstep(0.95, 0.25, length((p - 0.5) * vec2(1.1, 1.0)));
  col = clamp(col + fiber, 0.0, 1.0) * mix(0.93, 1.0, vig);
  outColor = vec4(col, 1.0);
}`,
};
