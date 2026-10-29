#!/usr/bin/env python3
"""
StyleHop Tactile Texture Generator (`tools/textures.py`).

Generates 5 deterministic, 100% tile-seamless 512x512 tactile textures in `assets/textures/`
for WebGL2 shader passes (`u_paper` sampler on TEXTURE2 with GL_REPEAT):
  1. `assets/textures/paper_fiber.png`        — Organic cotton/xuan paper fibers + cloud mottling
  2. `assets/textures/halftone_screen.png`    — Angled dual-frequency halftone screen + ink grain
  3. `assets/textures/brushed_metal.png`      — Anisotropic brushed metallic normal/roughness map
  4. `assets/textures/blueprint_cyanotype.png`— Cyanotype paper grain + micro fold creases
  5. `assets/textures/clay_thumbprint.png`    — Polymer clay thumbprint whorls + micro-dimples + marbled seams

Usage:
  python3 tools/textures.py [--size 512] [--out-dir assets/textures]
"""

import argparse
from pathlib import Path
import numpy as np
from PIL import Image


def tileable_fbm(size: int, rng: np.random.Generator, octaves=(2, 4, 8, 16, 32, 64), weights=None) -> np.ndarray:
    """Synthesizes a 100% seamless periodic 2D fBm field via FFT spectral shaping."""
    freq_y = np.fft.fftfreq(size)[:, None] * size
    freq_x = np.fft.fftfreq(size)[None, :] * size
    radius = np.hypot(freq_x, freq_y)

    if weights is None:
        weights = [1.0 / (i + 1) ** 1.15 for i in range(len(octaves))]

    acc = np.zeros((size, size), dtype=np.float64)
    for scale, w in zip(octaves, weights):
        white = rng.standard_normal((size, size)) + 1j * rng.standard_normal((size, size))
        band = np.exp(-0.5 * ((radius - scale) / max(1.0, scale * 0.45)) ** 2)
        band[0, 0] = 0.0
        layer = np.fft.ifft2(white * band).real
        std = layer.std()
        if std > 1e-8:
            acc += (layer / std) * w

    acc -= acc.min()
    mx = acc.max()
    return (acc / mx) if mx > 1e-8 else acc


def generate_paper_fiber(size: int, seed: int = 101) -> Image.Image:
    """Organic cotton / rice paper fibers centered around 0.5 luminance for shader blending."""
    rng = np.random.default_rng(seed)
    cloud = tileable_fbm(size, rng, octaves=(2, 5, 11, 24), weights=(1.0, 0.7, 0.45, 0.25))
    fine = tileable_fbm(size, rng, octaves=(32, 64, 128), weights=(0.6, 0.8, 1.0))

    # Directional organic strands (periodic across boundaries)
    y, x = np.mgrid[0:size, 0:size] / float(size)
    tau = 2.0 * np.pi
    strands = np.zeros((size, size), dtype=np.float64)
    for _ in range(28):
        kx = rng.choice([-3, -2, -1, 1, 2, 3]) * rng.integers(4, 18)
        ky = rng.choice([-3, -2, -1, 1, 2, 3]) * rng.integers(4, 18)
        phase = rng.uniform(0, tau)
        warp = 0.35 * np.sin(tau * (kx * x - ky * y) + phase)
        wave = np.exp(-18.0 * (0.5 + 0.5 * np.sin(tau * (kx * x + ky * y) + phase + warp)) ** 2)
        strands += wave

    strands = (strands - strands.mean()) / (strands.std() + 1e-8)
    combined = 0.5 + 0.14 * (cloud - 0.5) + 0.12 * (fine - 0.5) + 0.045 * strands
    combined = np.clip(combined, 0.0, 1.0)

    # Pack: R = composite paper height, G = fine grain, B = cloud mottle
    r = (combined * 255.0).astype(np.uint8)
    g = (np.clip(0.5 + 0.35 * (fine - 0.5), 0.0, 1.0) * 255.0).astype(np.uint8)
    b = (np.clip(0.5 + 0.35 * (cloud - 0.5), 0.0, 1.0) * 255.0).astype(np.uint8)
    return Image.fromarray(np.stack([r, g, b], axis=-1), mode="RGB")


def generate_halftone_screen(size: int, seed: int = 202) -> Image.Image:
    """Angled dual-frequency halftone screen & riso ink grain (tile-seamless)."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:size, 0:size] / float(size)
    tau = 2.0 * np.pi

    # Integer wavevectors guarantee exact periodicity across 512x512 edges
    # Screen 1 (~15 deg): k1 = (48, 13), Screen 2 (~75 deg): k2 = (13, 48)
    u1 = tau * (48 * x + 13 * y)
    v1 = tau * (-13 * x + 48 * y)
    dot1 = 0.5 + 0.25 * (np.cos(u1) + np.cos(v1))

    u2 = tau * (18 * x + 64 * y)
    v2 = tau * (-64 * x + 18 * y)
    dot2 = 0.5 + 0.25 * (np.cos(u2) + np.cos(v2))

    ink_grain = tileable_fbm(size, rng, octaves=(16, 36, 80, 140), weights=(0.4, 0.7, 1.0, 0.8))

    r = (np.clip(0.8 * dot1 + 0.2 * ink_grain, 0.0, 1.0) * 255.0).astype(np.uint8)
    g = (np.clip(0.8 * dot2 + 0.2 * ink_grain, 0.0, 1.0) * 255.0).astype(np.uint8)
    b = (np.clip(ink_grain, 0.0, 1.0) * 255.0).astype(np.uint8)
    return Image.fromarray(np.stack([r, g, b], axis=-1), mode="RGB")


def generate_brushed_metal(size: int, seed: int = 303) -> Image.Image:
    """Anisotropic horizontal brushed metallic micro-grooves + tangent normal/roughness."""
    rng = np.random.default_rng(seed)
    freq_y = np.fft.fftfreq(size)[:, None] * size
    freq_x = np.fft.fftfreq(size)[None, :] * size

    # Strong anisotropy: high vertical frequency (horizontal grooves), low horizontal frequency
    white = rng.standard_normal((size, size)) + 1j * rng.standard_normal((size, size))
    aniso_filter = np.exp(-0.5 * (freq_x / 3.5) ** 2) * np.exp(-0.5 * ((np.abs(freq_y) - 52.0) / 38.0) ** 2)
    aniso_filter[0, 0] = 0.0
    grooves = np.fft.ifft2(white * aniso_filter).real
    grooves = (grooves - grooves.mean()) / (grooves.std() + 1e-8)

    micro = tileable_fbm(size, rng, octaves=(12, 32, 96), weights=(0.5, 0.8, 0.6))
    height = np.clip(0.5 + 0.18 * grooves + 0.08 * (micro - 0.5), 0.0, 1.0)

    # Periodic finite differences for tangent-space normal X/Y + roughness in B
    dx = np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)
    dy = np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)
    nx = np.clip(0.5 + dx * 2.2, 0.0, 1.0)
    ny = np.clip(0.5 + dy * 2.2, 0.0, 1.0)

    r = (height * 255.0).astype(np.uint8)
    g = (ny * 255.0).astype(np.uint8)
    b = (nx * 255.0).astype(np.uint8)
    return Image.fromarray(np.stack([r, g, b], axis=-1), mode="RGB")


def generate_blueprint_cyanotype(size: int, seed: int = 404) -> Image.Image:
    """Cyanotype paper grain + subtle drafting grid & micro fold creases."""
    rng = np.random.default_rng(seed)
    base_grain = tileable_fbm(size, rng, octaves=(4, 12, 32, 84), weights=(0.8, 0.7, 0.9, 0.6))

    y, x = np.mgrid[0:size, 0:size] / float(size)
    tau = 2.0 * np.pi

    # Subtle periodic fold crease lines
    crease_h = np.exp(-90.0 * np.sin(tau * x) ** 2)
    crease_v = np.exp(-90.0 * np.sin(tau * y) ** 2)
    creases = np.maximum(crease_h, crease_v) * (0.4 + 0.6 * base_grain)

    # Fine 16x16 drafting grid ticks
    grid = np.maximum(
        np.exp(-60.0 * np.sin(tau * 8 * x) ** 2),
        np.exp(-60.0 * np.sin(tau * 8 * y) ** 2),
    )

    r = (np.clip(0.5 + 0.28 * (base_grain - 0.5) + 0.16 * creases, 0.0, 1.0) * 255.0).astype(np.uint8)
    g = (np.clip(0.5 + 0.25 * (base_grain - 0.5) + 0.22 * grid, 0.0, 1.0) * 255.0).astype(np.uint8)
    b = (np.clip(0.55 + 0.30 * (base_grain - 0.5) + 0.18 * creases + 0.12 * grid, 0.0, 1.0) * 255.0).astype(np.uint8)
    return Image.fromarray(np.stack([r, g, b], axis=-1), mode="RGB")


def generate_clay_thumbprint(size: int, seed: int = 505) -> Image.Image:
    """
    Hand-kneaded polymer clay surface texture (tile-seamless):
      - R: Concentric oval sculptor's thumbprint whorl ridges + matte clay base
      - G: Fine plasticine micro-dimples & sculpting tool impressions
      - B: Flowing marbled clay kneading seams
    """
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:size, 0:size] / float(size)
    tau = 2.0 * np.pi

    # 1. Periodic concentric oval thumbprint whorl patches (using torus distance)
    whorl_centers = [
        (0.22, 0.28, 1.0, 1.38, -0.42, 0.19, 34.0),
        (0.68, 0.32, 1.15, 1.32, 0.58, 0.21, 32.0),
        (0.42, 0.72, 1.32, 0.96, 0.18, 0.20, 36.0),
        (0.82, 0.78, 0.95, 1.28, -0.30, 0.18, 34.0),
        (0.15, 0.80, 1.10, 1.22, 0.40, 0.17, 35.0),
    ]
    whorl_field = np.zeros((size, size), dtype=np.float64)
    for cx, cy, sx, sy, rot, rad, freq in whorl_centers:
        # Torus-wrapped delta in [-0.5, 0.5] for exact tileability
        dx = np.sin(tau * (x - cx)) / tau
        dy = np.sin(tau * (y - cy)) / tau
        c, s = np.cos(rot), np.sin(rot)
        rx = (dx * c - dy * s) / sx
        ry = (dx * s + dy * c) / sy
        dist = np.hypot(rx, ry)
        env = np.exp(-0.5 * (dist / rad) ** 2)
        ridges = np.cos(tau * freq * dist + 0.35 * np.sin(tau * 3.0 * np.arctan2(ry, rx)))
        whorl_field += env * ridges

    whorl_field = (whorl_field - whorl_field.mean()) / (whorl_field.std() + 1e-8)

    # 2. Fine plasticine micro-dimples & matte clay grain
    dimples = tileable_fbm(size, rng, octaves=(14, 28, 56, 112), weights=(0.8, 1.0, 0.9, 0.6))
    mottle = tileable_fbm(size, rng, octaves=(2, 5, 10), weights=(1.0, 0.65, 0.35))

    # 3. Flowing marbled clay kneading seams (periodic phase-warped bands)
    warp = 0.22 * np.sin(tau * (2 * x - 3 * y)) + 0.14 * np.cos(tau * (3 * x + 2 * y))
    marble = 0.5 + 0.28 * np.sin(tau * (2 * x + 1 * y + warp)) + 0.22 * (mottle - 0.5)

    r_val = np.clip(0.5 + 0.18 * whorl_field + 0.10 * (dimples - 0.5) + 0.08 * (mottle - 0.5), 0.0, 1.0)
    g_val = np.clip(0.5 + 0.32 * (dimples - 0.5) + 0.08 * whorl_field, 0.0, 1.0)
    b_val = np.clip(marble, 0.0, 1.0)

    return Image.fromarray(
        np.stack([(r_val * 255.0).astype(np.uint8), (g_val * 255.0).astype(np.uint8), (b_val * 255.0).astype(np.uint8)], axis=-1),
        mode="RGB",
    )


def main():
    parser = argparse.ArgumentParser(description="Generate seamless 512x512 tactile textures for StyleHop.")
    parser.add_argument("--size", type=int, default=512, help="Texture width/height in pixels (default: 512)")
    parser.add_argument("--out-dir", type=str, default="assets/textures", help="Output directory")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    out_dir = (repo_root / args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    recipes = {
        "paper_fiber.png": generate_paper_fiber,
        "halftone_screen.png": generate_halftone_screen,
        "brushed_metal.png": generate_brushed_metal,
        "blueprint_cyanotype.png": generate_blueprint_cyanotype,
        "clay_thumbprint.png": generate_clay_thumbprint,
    }

    manifest = []
    for filename, fn in recipes.items():
        img = fn(args.size)
        dest = out_dir / filename
        img.save(dest, format="PNG", optimize=True)
        manifest.append({"file": str(dest.relative_to(repo_root)), "size": f"{args.size}x{args.size}"})
        print(f"[textures] wrote {dest.relative_to(repo_root)} ({args.size}x{args.size})")


if __name__ == "__main__":
    main()
