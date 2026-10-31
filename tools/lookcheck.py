#!/usr/bin/env python3
"""
StyleHop Look Regression Guard (`tools/lookcheck.py`).

Renders a style's 2x2 contact sheet and measures it against a stored baseline, so every
look change (new light, env map, pass, palette tweak) shows up as numbers instead of a
gut feeling. Drift beyond the guard thresholds is flagged; intentional changes are
re-baselined with `--accept`.

Per-panel metrics (CIE Lab, D65 + Spatial Composition):
  L         mean lightness (exposure)         contrast  std of L (flat / milky vs punchy)
  p5        shadow depth (lower = deeper)     p95       highlight level
  chroma    mean Lab chroma (saturation)      grit      median |L - blur(L)| (fine texture /
                                                        screen-space pattern energy)
  com_y     vertical center-of-mass of visual salience (0 = top edge, 1 = bottom edge)
  half_void max dead-void fraction in upper or lower half (16x9 grid cells with near-zero
            texture & tonal deviation from background median)
  dE        mean CIE76 colour difference against the baseline panel

Absolute readability & spatial composition floors (checked on every run, including the first run
of a new story, which only stores a baseline and therefore compares nothing):
  L in [35, 92]        not murky / not blown out      p95 >= 55         something catches light
  contrast >= 7        not a flat milky wash          p95 - p5 >= 18    real tonal range
  com_y in [0.36,0.66] balanced vertical weight       half_void <= 0.72 no dead-white empty half

Originality gate (every --style run; exit 3 on failure, independent of --strict):
  the rendered sheet is compared panel-by-panel with the style's showcase contact sheet, archived
  showcases ($STYLEHOP_OUT/look/archive/<style>_*contact_sheet*.jpg) and every OTHER topic baseline of the style
  ($STYLEHOP_OUT/look/<style>__*/look_baseline.jpg). sim = layout correlation x colour proximity must stay < 0.33,
  layout correlation alone < 0.78. A new story must not be an old film with the names changed.

Usage:
  python3 tools/lookcheck.py --style clay-macaron            # render + compare vs baseline
  python3 tools/lookcheck.py --style clay-macaron --accept   # store current render as baseline
  python3 tools/lookcheck.py --a before.jpg --b after.jpg    # compare any two sheets
  python3 tools/lookcheck.py --style clay-macaron --look '{"env":{"enabled":false}}' --tag noenv
  [--world $STYLEHOP_OUT/custom-world.js] [--content $STYLEHOP_OUT/custom-scenes.html]  (own baseline under $STYLEHOP_OUT/look/<style>__<world>/, first run stores it)
  [--originality-ref other_sheet.jpg]  (extra originality reference, repeatable)
  [--strict]  (exit 2 on drift)
"""

import argparse
import json
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Rendered artifacts, look baselines and archived showcases live OUTSIDE the repo, so a public
# clone never carries private output. Override with STYLEHOP_OUT (absolute path; a relative value
# resolves against the current directory); defaults to the sibling `../out`.
OUT_ROOT = os.path.abspath(os.environ.get('STYLEHOP_OUT') or os.path.join(REPO_ROOT, os.pardir, 'out'))

# Max drift tolerated for a change that is NOT meant to alter the look (per panel).
GUARD = {'L': 4.0, 'contrast_pct': 20.0, 'chroma_pct': 25.0, 'dE': 6.0}

METRICS = ['L', 'contrast', 'p5', 'p95', 'chroma', 'grit', 'com_y', 'half_void']

# Absolute floors any shippable panel must meet, whatever the story or time of day.
ABS = {
    'L_min': 35.0,
    'L_max': 92.0,
    'p95_min': 55.0,
    'contrast_min': 7.0,
    'range_min': 18.0,
    'com_y_min': 0.36,
    'com_y_max': 0.66,
    'half_void_max': 0.72,
}

# Medium-specific overrides:
# - `ink-wash`: honors classical `计白当黑` (expansive blank Xuan-paper voids up to `half_void <= 0.88`,
#   high/low horizon `com_y in [0.24, 0.78]`) and stark nocturnal martial scenes (`L_min = 18.0`).
# - `paper-popup`: tabletop pop-up book theater requires >=45% desk/page breathing margin and a single
#   central pop-up mechanism per spread (`half_void <= 0.82`, `com_y in [0.30, 0.72]`).
# - `rubber-hose`: 1930s single-focus stage & large facial reaction close-ups keep upper backdrops clean
#   rather than stuffing the sky with floating filler (`half_void <= 0.80`, `com_y in [0.30, 0.72]`).
# - `twilight-fable`: nocturnal bioluminescent woodland fables feature deep night skies and low-key lighting
#   (`L_min = 18.0`, `half_void <= 0.84`, `com_y in [0.28, 0.74]`).
STYLE_ABS_OVERRIDES = {
    'ink-wash': {
        'L_min': 18.0,
        'com_y_min': 0.24,
        'com_y_max': 0.78,
        'half_void_max': 0.88,
    },
    'paper-popup': {
        'com_y_min': 0.30,
        'com_y_max': 0.72,
        'half_void_max': 0.82,
    },
    'rubber-hose': {
        'com_y_min': 0.30,
        'com_y_max': 0.72,
        'half_void_max': 0.80,
    },
    'twilight-fable': {
        'L_min': 18.0,
        'com_y_min': 0.28,
        'com_y_max': 0.74,
        'half_void_max': 0.84,
    },
}


def resolve_panel_floors(style=None, path=None):
    eff_style = style
    if not eff_style and path:
        base = os.path.basename(str(path))
        for k in STYLE_ABS_OVERRIDES:
            if k in base:
                eff_style = k
                break
    floors = dict(ABS)
    if eff_style in STYLE_ABS_OVERRIDES:
        floors.update(STYLE_ABS_OVERRIDES[eff_style])
    return floors


def absolute_check(path, style=None):
    img = Image.open(path).convert('RGB')
    floors = resolve_panel_floors(style=style, path=path)
    fails = []
    for i, p in enumerate(panels(img)):
        m = measure(p)[0]
        f = []
        if not floors['L_min'] <= m['L'] <= floors['L_max']:
            f.append(f"L {m['L']:.1f} outside [{floors['L_min']:.0f}, {floors['L_max']:.0f}]")
        if m['p95'] < floors['p95_min']:
            f.append(f"p95 {m['p95']:.1f} < {floors['p95_min']:.0f} (nothing catches light)")
        if m['contrast'] < floors['contrast_min']:
            f.append(f"contrast {m['contrast']:.1f} < {floors['contrast_min']:.0f} (flat)")
        if m['p95'] - m['p5'] < floors['range_min']:
            f.append(f"tonal range {m['p95'] - m['p5']:.1f} < {floors['range_min']:.0f}")
        if not floors['com_y_min'] <= m['com_y'] <= floors['com_y_max']:
            f.append(
                f"com_y {m['com_y']:.3f} outside [{floors['com_y_min']:.2f}, {floors['com_y_max']:.2f}] "
                "(vertical center-of-mass imbalance: top-heavy or bottom-heavy frame)"
            )
        if m['half_void'] > floors['half_void_max']:
            f.append(
                f"half_void {m['half_void']:.2f} > {floors['half_void_max']:.2f} "
                "(dead-void empty upper/lower half; anchor foreground/midground across vertical planes)"
            )
        if f:
            fails.append((i, f))
    if fails:
        print('\n  READABILITY & SPATIAL COMPOSITION floors failed:')
        for i, f in fails:
            print(f'    panel {i}: ' + ', '.join(f))
    else:
        print('\n  readability & spatial composition floors: OK')
    return fails


def srgb_to_lab(rgb):
    c = rgb.astype(np.float64) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375],
                  [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    xyz = lin @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


def panels(img):
    w, h = img.size
    cols = 3 if (w / max(h, 1)) > 2.2 else 2
    rows = 2
    pw, ph = w // cols, h // rows
    return [img.crop((c * pw, r * ph, (c + 1) * pw, (r + 1) * ph)) for r in range(rows) for c in range(cols)]


def measure(panel):
    lab = srgb_to_lab(np.asarray(panel.convert('RGB')))
    L = lab[..., 0]
    chroma_map = np.hypot(lab[..., 1], lab[..., 2])
    gray = panel.convert('L')
    hp = np.abs(np.asarray(gray, np.float64) - np.asarray(gray.filter(ImageFilter.GaussianBlur(3)), np.float64))

    # Spatial salience center-of-mass (com_y in [0, 1]) & 16x9 grid dead-void check
    bg_L = float(np.median(L))
    bg_C = float(np.median(chroma_map))
    sal = hp + 0.30 * np.abs(L - bg_L) + 0.20 * np.abs(chroma_map - bg_C)
    h, w = sal.shape
    ys = (np.arange(h, dtype=np.float64) + 0.5) / max(h, 1)
    row_sal = sal.mean(axis=1)
    com_y = float((row_sal * ys).sum() / max(float(row_sal.sum()), 1e-6))

    gh, gw = 9, 16
    ch, cw = max(1, h // gh), max(1, w // gw)
    void_cells = np.zeros((gh, gw), dtype=bool)
    for r in range(gh):
        for c in range(gw):
            sub_hp = float(hp[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw].mean())
            sub_dL = float(np.abs(L[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw] - bg_L).mean())
            if sub_hp < 0.85 and sub_dL < 3.2:
                void_cells[r, c] = True
    top_void = float(void_cells[:4, :].mean())
    bot_void = float(void_cells[5:, :].mean())
    half_void = max(top_void, bot_void)

    return {
        'L': float(L.mean()),
        'contrast': float(L.std()),
        'p5': float(np.percentile(L, 5)),
        'p95': float(np.percentile(L, 95)),
        'chroma': float(chroma_map.mean()),
        'grit': float(np.median(hp)),
        'com_y': com_y,
        'half_void': half_void,
    }, lab


def compare(path_a, path_b, out_img=None):
    a_img, b_img = Image.open(path_a).convert('RGB'), Image.open(path_b).convert('RGB')
    if b_img.size != a_img.size:
        b_img = b_img.resize(a_img.size, Image.LANCZOS)
    rows, drift = [], []
    for i, (pa, pb) in enumerate(zip(panels(a_img), panels(b_img))):
        ma, la = measure(pa)
        mb, lb = measure(pb)
        de = float(np.linalg.norm(la - lb, axis=-1).mean())
        rows.append((i, ma, mb, de))
        flags = []
        if abs(mb['L'] - ma['L']) > GUARD['L']:
            flags.append(f"L {mb['L'] - ma['L']:+.1f}")
        if abs(mb['contrast'] / max(ma['contrast'], 1e-6) - 1) * 100 > GUARD['contrast_pct']:
            flags.append(f"contrast {(mb['contrast'] / ma['contrast'] - 1) * 100:+.0f}%")
        if abs(mb['chroma'] / max(ma['chroma'], 1e-6) - 1) * 100 > GUARD['chroma_pct']:
            flags.append(f"chroma {(mb['chroma'] / ma['chroma'] - 1) * 100:+.0f}%")
        if de > GUARD['dE']:
            flags.append(f'dE {de:.1f}')
        if flags:
            drift.append((i, flags))

    print(f'\n  baseline: {os.path.relpath(path_a, REPO_ROOT)}\n  current : {os.path.relpath(path_b, REPO_ROOT)}\n')
    print('  panel  metric      base    curr    delta')
    for i, ma, mb, de in rows:
        for k in METRICS:
            print(f'  {i:>5}  {k:<9} {ma[k]:7.2f} {mb[k]:7.2f} {mb[k] - ma[k]:+8.2f}')
        print(f'  {i:>5}  {"dE":<9} {"":7} {"":7} {de:8.2f}\n')

    if out_img:
        w, h = a_img.size
        sheet = Image.new('RGB', (w * 2, h + 40), (24, 24, 24))
        sheet.paste(a_img, (0, 40))
        sheet.paste(b_img, (w, 40))
        d = ImageDraw.Draw(sheet)
        d.text((16, 12), 'BASELINE', fill=(240, 240, 240))
        d.text((w + 16, 12), 'CURRENT', fill=(240, 240, 240))
        os.makedirs(os.path.dirname(out_img), exist_ok=True)
        sheet.save(out_img, quality=90)
        print(f'  side-by-side: {os.path.relpath(out_img, REPO_ROOT)}')
    return rows, drift


def render_sheet(style, out, world=None, look=None, content=None):
    cmd = ['node', os.path.join(REPO_ROOT, 'tools', 'render.mjs'), '--style', style, '--sheet', out]
    if world:
        cmd += ['--world', world]
    if content:
        cmd += ['--content', content]
    if look:
        cmd += ['--look', look]
    subprocess.run(cmd, check=True, cwd=REPO_ROOT, stdout=subprocess.DEVNULL)


# Originality gate (calibrated on known clones vs genuinely different stories of the same style):
#   sim  = layout correlation (64x36 luminance) x colour proximity exp(-dE/25), best-matching reference
#          panel per current panel, averaged over the 4 panels
#   corr = the layout correlation alone (catches a re-coloured clone)
ORIG = {'sim_max': 0.33, 'corr_max': 0.78, 'clone_sim': 0.6}


def _panel_features(path):
    img = Image.open(path).convert('RGB')
    feats = []
    for p in panels(img):
        lum = np.asarray(p.convert('L').resize((64, 36)), np.float64).ravel()
        lab = srgb_to_lab(np.asarray(p.resize((48, 27))))
        feats.append((lum, lab))
    return feats


def _similarity(ref_feats, cur_feats):
    sims, corrs = [], []
    for lum_b, lab_b in cur_feats:
        best_s, best_c = -1.0, -1.0
        for lum_a, lab_a in ref_feats:
            c = float(np.corrcoef(lum_a, lum_b)[0, 1]) if lum_a.std() > 1e-6 and lum_b.std() > 1e-6 else 0.0
            de = float(np.linalg.norm(lab_a - lab_b, axis=-1).mean())
            best_s = max(best_s, c * float(np.exp(-de / 25.0)))
            best_c = max(best_c, c)
        sims.append(best_s)
        corrs.append(best_c)
    return float(np.mean(sims)), float(np.mean(corrs))


def originality_references(style, own_dir=None, is_showcase=False, extra=None):
    """Showcase contact sheet, archived showcases ($STYLEHOP_OUT/look/archive/<style>_*contact_sheet*.jpg) and the
    look baselines of every other topic world of this style ($STYLEHOP_OUT/look/<style>__*/look_baseline.jpg)."""
    import glob
    refs = []
    sheet = os.path.join(REPO_ROOT, 'styles', style, 'contact_sheet.jpg')
    if not is_showcase and os.path.exists(sheet):
        refs.append(('showcase', sheet))
    for p in sorted(glob.glob(os.path.join(OUT_ROOT, 'look', 'archive', f'{style}_*contact_sheet*.jpg'))):
        refs.append(('archived showcase ' + os.path.basename(p), p))
    if not is_showcase:
        for p in sorted(glob.glob(os.path.join(OUT_ROOT, 'look', f'{style}__*', 'look_baseline.jpg'))):
            d = os.path.dirname(p)
            if own_dir and os.path.abspath(d) == os.path.abspath(own_dir):
                continue
            refs.append(('topic ' + os.path.basename(d).split('__', 1)[1], p))
    for p in extra or []:
        refs.append(('ref ' + os.path.basename(p), p))
    return refs


def originality_check(current, refs):
    """Fails when the current sheet is too close to the showcase, an archived showcase or another topic."""
    if not refs:
        print('\n  originality: no references to compare against')
        return []
    cur = _panel_features(current)
    fails = []
    print('\n  ORIGINALITY (sim = layout x colour; limits sim < %.2f, layout corr < %.2f)' % (ORIG['sim_max'], ORIG['corr_max']))
    for label, path in refs:
        sim, corr = _similarity(_panel_features(path), cur)
        bad = sim >= ORIG['sim_max'] or corr >= ORIG['corr_max']
        tag = ('CLONE' if sim >= ORIG['clone_sim'] else 'TOO SIMILAR') if bad else 'ok'
        print(f'    {tag:<11} sim {sim:.2f}  corr {corr:.2f}  vs {label}')
        if bad:
            fails.append((label, sim, corr))
    if fails:
        print('\n  ORIGINALITY failed: this film re-uses the composition / palette of an existing one.')
        print('  Re-compose the places (ground type, horizon height, subject position and size) and looks for THIS story.')
    else:
        print('  originality: OK')
    return fails


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--style')
    ap.add_argument('--world')
    ap.add_argument('--content', help='custom scenes.html (same as render.mjs --content)')
    ap.add_argument('--look', help='JSON deep-merged over style.look, e.g. \'{"env":{"enabled":false}}\'')
    ap.add_argument('--tag', default='current', help='name for the rendered sheet ($STYLEHOP_OUT/look/<style>_<tag>.jpg)')
    ap.add_argument('--a')
    ap.add_argument('--b')
    ap.add_argument('--accept', action='store_true')
    ap.add_argument('--strict', action='store_true')
    ap.add_argument('--originality-ref', action='append', default=[],
                    help='extra reference sheet(s) for the originality gate (repeatable)')
    o = ap.parse_args()

    if o.a and o.b:
        _, drift = compare(o.a, o.b)
    elif o.style:
        style_dir = os.path.join(REPO_ROOT, 'styles', o.style)
        baseline = os.path.join(style_dir, 'look_baseline.jpg')
        if o.world:
            # A custom story world has different content, so it gets its own (uncommitted) baseline;
            # the first run stores it, later runs guard that world's look.
            stem = os.path.splitext(os.path.basename(o.world))[0]
            style_dir = os.path.join(OUT_ROOT, 'look', f'{o.style}__{stem}')
            os.makedirs(style_dir, exist_ok=True)
            baseline = os.path.join(style_dir, 'look_baseline.jpg')
        current = os.path.join(OUT_ROOT, 'look', f'{o.style}_{o.tag}.jpg')
        os.makedirs(os.path.dirname(current), exist_ok=True)
        render_sheet(o.style, current, o.world, o.look, o.content)
        abs_fails = absolute_check(current, style=o.style)
        orig_fails = originality_check(
            current,
            originality_references(o.style, own_dir=style_dir if o.world else None, is_showcase=not o.world, extra=o.originality_ref),
        )
        if o.accept or not os.path.exists(baseline):
            first = not os.path.exists(baseline)
            shutil.copyfile(current, baseline)
            img = Image.open(baseline).convert('RGB')
            with open(os.path.join(style_dir, 'look_baseline.json'), 'w') as f:
                json.dump([measure(p)[0] for p in panels(img)], f, indent=2)
            print(f'  baseline stored: {os.path.relpath(baseline, REPO_ROOT)}')
            if first:
                print('  (first run: nothing was compared; later runs guard this look against drift)')
            if orig_fails:
                sys.exit(3)
            if abs_fails and o.strict:
                sys.exit(2)
            return
        _, drift = compare(baseline, current, os.path.join(OUT_ROOT, 'look', f'{o.style}_{o.tag}_compare.jpg'))
        drift = drift or []
        if orig_fails:
            sys.exit(3)
        if abs_fails and o.strict:
            sys.exit(2)
    else:
        ap.error('pass --style <id> or --a/--b')
        return

    if drift:
        print('\n  DRIFT beyond guard (intentional? re-run with --accept):')
        for i, flags in drift:
            print(f'    panel {i}: ' + ', '.join(flags))
        if o.strict:
            sys.exit(2)
    else:
        print('\n  OK · within guard')


if __name__ == '__main__':
    main()
