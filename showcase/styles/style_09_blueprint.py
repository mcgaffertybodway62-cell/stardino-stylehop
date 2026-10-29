#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StyleHop v5 · World 05 · 工程蓝图 3D 浮岛 (style_05_blueprint.py)
-----------------------------------------------------------------------------
Golden Left-Right Split Composition (Upgraded from v3 & STORY.md):
- Left Half (x ≈ 0 .. 1015): Deep Prussian Blue Cyanotype Engineering Blueprint
  with full drawing frame (8..1, A..D), fine dual drafting grids, top-left
  orthographic island section (SECTION A-A 浮空岛 · 正交剖面 1:50, Ø 3600, 2050),
  middle-left 2D building elevations (ELEVATION E-1, 1200, 1050) with spring coils,
  bottom-left standard title block (GEMINI 4 · 星芒史莱姆 剖面图 | 05), and the
  large polar compass coordinate specification (120°/150°/60°/30°/R 120/sx=1/√sy)
  with the blueprint cross-section cutaway Slime at (0,0,0).
- Boundary Wavefront (x ≈ 1000 .. 1060): Hand-drawn torn-blueprint / scanning
  wavefront boundary with CAD ticks and a split floating island (left half white
  triangular wireframe in blueprint, right half 3D macaron island in sky).
- Right Half (x ≈ 1015 .. 1920): Dreamy Lavender-Pink Gradient Sky with subtle
  white isometric perspective grid, floating pastel geometric particles, 4 Macaron
  Low-Poly 3D Floating Islands (mint-emerald faceted grass, cream bevel rim,
  lavender-amethyst crystal rock cone, cottages with cherry-pink/lemon-yellow/sky-blue
  roofs, low-poly pine trees & pink polyhedral cherry-blossom trees), the radiant
  vertical Starlight Pillar (通天白金星光升降柱), compass-constructed geometric
  star ✦ with dashed trajectory, and the freshly landed 3D Macaron Slime with
  perspective ellipse drafting ripples.

Strictly adheres to the 5 visual iron rules for the Gemini Slime and exposes
the standard contract interfaces: W, H, WORLD_W, WORLD_H, draw_slime, draw_star,
render_world, render_keyframe.
"""

import math
import os
import sys
import numpy as np
import cairo
from PIL import Image, ImageDraw

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from corelib.math_ops import (
    clamp, lerp, smoothstep, smootherstep,
    ease_out_cubic, ease_out_back, ease_in_out_cubic, spring_val
)
from corelib.camera import get_font

# -----------------------------------------------------------------------------
# Contract Dimensions & Constants
# -----------------------------------------------------------------------------
W, H = 1920, 1080
WORLD_W, WORLD_H = 7680, 1080  # 4 screens wide

# Gemini Slime Brand Palette
SLIME_SKY = (79 / 255.0, 178 / 255.0, 255 / 255.0)       # #4FB2FF
SLIME_BLUE = (66 / 255.0, 133 / 255.0, 244 / 255.0)      # #4285F4
SLIME_INDIGO = (102 / 255.0, 98 / 255.0, 238 / 255.0)    # #6662EE
SLIME_IRIS = (148 / 255.0, 92 / 255.0, 226 / 255.0)      # #945CE2
SLIME_CORAL = (232 / 255.0, 94 / 255.0, 118 / 255.0)     # #E85E76


# -----------------------------------------------------------------------------
# 1. Core Geometric Primitives & Boundary Function
# -----------------------------------------------------------------------------

def boundary_x_at_y(y: float, offset_x: float = 0.0) -> float:
    """
    Returns the x-coordinate of the organic torn-blueprint / scanning wavefront
    boundary at vertical coordinate y (in [0, 1080]).
    Matches v3's golden split curve around x ≈ 990 .. 1060.
    """
    yn = y / 1080.0
    # Smooth macro S-curve bulging right around y=250 (x≈1015) and y=660 (x≈1058)
    macro = (
        992.0
        + 24.0 * math.exp(-((yn - 0.22) / 0.13) ** 2)
        - 8.0 * math.exp(-((yn - 0.40) / 0.10) ** 2)
        + 66.0 * math.exp(-((yn - 0.62) / 0.18) ** 2)
        - 10.0 * math.exp(-((yn - 0.90) / 0.12) ** 2)
    )
    # Fine hand-drawn torn paper / wavefront micro-waviness
    micro = (
        3.2 * math.sin(y * 0.042 + 0.8)
        + 1.8 * math.cos(y * 0.105 + 2.1)
        + 0.9 * math.sin(y * 0.23 - 0.4)
    )
    return macro + micro + offset_x


def build_boundary_clip_path(ctx: cairo.Context, side: str, width: int = W, height: int = H,
                             offset_x: float = 0.0):
    """
    Builds a closed path covering either the 'left' (blueprint) or 'right' (3D sky)
    side of the wavy boundary curve.
    """
    ctx.new_path()
    steps = 216
    if side == "left":
        ctx.move_to(0, 0)
        for i in range(steps + 1):
            yy = (i / steps) * height
            xx = boundary_x_at_y(yy, offset_x)
            ctx.line_to(xx, yy)
        ctx.line_to(0, height)
        ctx.close_path()
    else:
        ctx.move_to(width, 0)
        for i in range(steps + 1):
            yy = (i / steps) * height
            xx = boundary_x_at_y(yy, offset_x)
            ctx.line_to(xx, yy)
        ctx.line_to(width, height)
        ctx.close_path()


def draw_four_point_star(ctx: cairo.Context, cx: float, cy: float, outer_r: float,
                         inner_r: float = None, rot: float = 0.0):
    """Draws signature Gemini 4-pointed curved sparkle star with smooth concave Bezier arcs."""
    if inner_r is None:
        inner_r = outer_r * 0.26
    ctx.new_path()
    tips = []
    waists = []
    for i in range(4):
        ang_tip = rot + i * (math.pi / 2.0) - math.pi / 2.0
        ang_waist = ang_tip + math.pi / 4.0
        tips.append((cx + outer_r * math.cos(ang_tip), cy + outer_r * math.sin(ang_tip)))
        waists.append((cx + inner_r * math.cos(ang_waist), cy + inner_r * math.sin(ang_waist)))

    ctx.move_to(tips[0][0], tips[0][1])
    for i in range(4):
        wx, wy = waists[i]
        nx, ny = tips[(i + 1) % 4]
        ctx.curve_to(wx, wy, wx, wy, nx, ny)
    ctx.close_path()


def draw_capsule_pill(ctx: cairo.Context, cx: float, cy: float, half_w: float, half_h: float):
    """Draws rounded capsule centered at (cx, cy) with half-width half_w and half-height half_h."""
    w = max(1.5, half_w)
    h = max(1.5, half_h)
    ctx.new_path()
    if h >= w:
        dy = h - w
        ctx.arc(cx, cy - dy, w, math.pi, 0.0)
        ctx.arc(cx, cy + dy, w, 0.0, math.pi)
    else:
        dx = w - h
        ctx.arc(cx + dx, cy, h, -math.pi * 0.5, math.pi * 0.5)
        ctx.arc(cx - dx, cy, h, math.pi * 0.5, math.pi * 1.5)
    ctx.close_path()


# -----------------------------------------------------------------------------
# 2. Slime Drawing (Contract Function)
# -----------------------------------------------------------------------------

def draw_slime(ctx: cairo.Context, cx: float, cy: float, radius: float, *,
               squash_y: float = 0.88, tilt: float = 0.0,
               look: tuple = (0.0, 0.0), eye_mode: str = "pill",
               blink: float = 0.0, t: float = 0.0, **style_kw):
    """
    Draws the Gemini Star-Spark Slime adhering strictly to the 5 visual iron rules:
    1. Volume conservation: s_x = 1.0 / sqrt(squash_y)
    2. Strictly mouthless, noseless, blushless
    3. Pure white capsule eyes tilted at -30°
    4. Far eye width strictly 81% of near eye width
    5. Sky Blue -> Iris Purple -> Coral Pink diagonal gradient

    Supports modes via style_kw["mode"]:
    - "solid": 3D Macaron volume with residual white blueprint meridian/equator lines
    - "cutaway": v3 signature CAD specification view (270° vibrant stepped/gradient body
                 + 90° bottom-right blueprint orthographic cross-section cutaway)
    - "blueprint": Pure white blueprint section view with tri-color hatching
    """
    mode = style_kw.get("mode", "solid")
    draw_shadow = style_kw.get("draw_shadow", True)

    squash_y = max(0.25, float(squash_y))
    s_x = 1.0 / math.sqrt(squash_y)
    s_y = squash_y
    r = float(radius)

    # Ground contact shadow
    if draw_shadow and mode == "solid":
        ctx.save()
        ctx.translate(cx, cy + r * s_y - 1.0)
        ctx.scale(s_x * r * 1.12, r * 0.28)
        pat = cairo.RadialGradient(0, 0, 0.08, 0, 0, 1.0)
        pat.add_color_stop_rgba(0.0, 0.28, 0.22, 0.48, 0.45)
        pat.add_color_stop_rgba(0.6, 0.38, 0.32, 0.58, 0.20)
        pat.add_color_stop_rgba(1.0, 0.45, 0.38, 0.65, 0.0)
        ctx.set_source(pat)
        ctx.arc(0, 0, 1.0, 0, 2 * math.pi)
        ctx.fill()
        ctx.restore()

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(tilt)
    ctx.scale(s_x, s_y)

    if mode == "cutaway":
        # --- v3 Signature Blueprint Cutaway Specification Slime ---
        # Outer subtle cyan glow
        glow = cairo.RadialGradient(0, 0, r * 0.7, 0, 0, r * 1.15)
        glow.add_color_stop_rgba(0.0, 0.45, 0.78, 1.0, 0.22)
        glow.add_color_stop_rgba(1.0, 0.20, 0.55, 0.95, 0.0)
        ctx.set_source(glow)
        ctx.arc(0, 0, r * 1.15, 0, 2 * math.pi)
        ctx.fill()

        # 1. Full circle base filled with deep blueprint section dark blue
        ctx.new_path()
        ctx.arc(0, 0, r, 0, 2 * math.pi)
        ctx.set_source_rgba(14 / 255.0, 42 / 255.0, 88 / 255.0, 0.92)
        ctx.fill()

        # 2. Upper-Left sector (everything except the lower-right isometric cutaway wedge)
        #    Cutaway vertex at (cx_cut, cy_cut) = (0.08*r, 0.08*r), rays at -12° and +98°
        cut_vx, cut_vy = 0.08 * r, 0.08 * r
        ang_r1 = math.radians(-12.0)
        ang_r2 = math.radians(98.0)

        ctx.save()
        ctx.new_path()
        ctx.arc(0, 0, r, 0, 2 * math.pi)
        ctx.clip()

        # Smooth diagonal base gradient: Sky Blue -> Cobalt -> Iris Purple -> Coral Pink
        grad = cairo.LinearGradient(-0.85 * r, -0.85 * r, 0.85 * r, 0.85 * r)
        grad.add_color_stop_rgb(0.00, *SLIME_SKY)
        grad.add_color_stop_rgb(0.28, *SLIME_BLUE)
        grad.add_color_stop_rgb(0.54, *SLIME_INDIGO)
        grad.add_color_stop_rgb(0.76, *SLIME_IRIS)
        grad.add_color_stop_rgb(1.00, *SLIME_CORAL)
        ctx.set_source(grad)
        ctx.paint()

        # Layered curved contour bands inside the sphere (matching v3's topographic bands)
        band_specs = [
            (-0.42 * r, -0.45 * r, 0.95 * r, (95 / 255.0, 192 / 255.0, 255 / 255.0, 0.55)),
            (-0.22 * r, -0.22 * r, 1.05 * r, (68 / 255.0, 140 / 255.0, 248 / 255.0, 0.45)),
            (0.05 * r, 0.08 * r, 1.05 * r, (108 / 255.0, 96 / 255.0, 236 / 255.0, 0.45)),
            (0.32 * r, 0.35 * r, 0.95 * r, (158 / 255.0, 92 / 255.0, 222 / 255.0, 0.50)),
            (0.58 * r, 0.58 * r, 0.82 * r, (236 / 255.0, 96 / 255.0, 122 / 255.0, 0.65)),
        ]
        for bx, by, br, bcol in band_specs:
            ctx.new_path()
            ctx.arc(bx, by, br, 0, 2 * math.pi)
            ctx.set_source_rgba(*bcol)
            ctx.fill_preserve()
            ctx.set_source_rgba(1.0, 1.0, 1.0, 0.45)
            ctx.set_line_width(1.2)
            ctx.stroke()

        # Top-left glossy capsule highlight (matching v3!)
        ctx.save()
        ctx.translate(-0.42 * r, -0.42 * r)
        ctx.rotate(-math.pi * 0.25)
        draw_capsule_pill(ctx, 0, 0, 0.28 * r, 0.11 * r)
        ctx.set_source_rgba(0.68, 0.90, 1.0, 0.72)
        ctx.fill_preserve()
        ctx.set_source_rgba(1.0, 1.0, 1.0, 0.85)
        ctx.set_line_width(1.3)
        ctx.stroke()
        ctx.restore()

        # 3. Bottom-Right Isometric Cutaway Wedge (-12° to +98° from (cut_vx, cut_vy))
        ctx.save()
        ctx.new_path()
        ctx.move_to(cut_vx, cut_vy)
        ctx.line_to(cut_vx + 1.5 * r * math.cos(ang_r1), cut_vy + 1.5 * r * math.sin(ang_r1))
        ctx.line_to(1.5 * r, 1.5 * r)
        ctx.line_to(cut_vx + 1.5 * r * math.cos(ang_r2), cut_vy + 1.5 * r * math.sin(ang_r2))
        ctx.close_path()
        ctx.clip()

        # Deep blueprint cross-section interior
        sec_grad = cairo.LinearGradient(0, 0, r * 0.8, r * 0.8)
        sec_grad.add_color_stop_rgba(0.0, 0.20, 0.26, 0.58, 0.94)
        sec_grad.add_color_stop_rgba(1.0, 0.10, 0.22, 0.48, 0.96)
        ctx.set_source(sec_grad)
        ctx.paint()

        # Fine 45° white engineering section hatching lines
        ctx.set_source_rgba(0.85, 0.94, 1.0, 0.78)
        ctx.set_line_width(1.15)
        for offset in range(-int(r), int(r * 2.2), 7):
            ctx.move_to(offset, -0.3 * r)
            ctx.line_to(offset - 1.3 * r, 1.0 * r)
        ctx.stroke()

        # Internal dashed isometric bisecting line inside the cutaway wedge
        ctx.set_source_rgba(0.90, 0.96, 1.0, 0.75)
        ctx.set_line_width(1.1)
        ctx.set_dash([4.0, 3.0])
        ctx.move_to(cut_vx, cut_vy)
        ctx.line_to(cut_vx + r * math.cos(math.radians(38.0)), cut_vy + r * math.sin(math.radians(38.0)))
        ctx.stroke()
        ctx.set_dash([])
        ctx.restore()

        # Cutaway section boundary lines (clipped to circle r)
        ctx.set_source_rgba(1.0, 1.0, 1.0, 0.95)
        ctx.set_line_width(1.8)
        ctx.move_to(cut_vx, cut_vy)
        ctx.line_to(cut_vx + 1.2 * r * math.cos(ang_r1), cut_vy + 1.2 * r * math.sin(ang_r1))
        ctx.move_to(cut_vx, cut_vy)
        ctx.line_to(cut_vx + 1.2 * r * math.cos(ang_r2), cut_vy + 1.2 * r * math.sin(ang_r2))
        ctx.stroke()

        ctx.restore()

        # Outer double white drafting ring around the Slime sphere
        ctx.new_path()
        ctx.arc(0, 0, r, 0, 2 * math.pi)
        ctx.set_source_rgba(1.0, 1.0, 1.0, 0.98)
        ctx.set_line_width(2.8)
        ctx.stroke()

    elif mode == "solid":
        # --- 3D Macaron Volume Solid with Residual Blueprint Lines ---
        ctx.new_path()
        ctx.arc(0, 0, r, 0, 2 * math.pi)
        ctx.close_path()

        # Three-color diagonal gradient: Sky Blue -> Iris Purple -> Coral Pink
        grad = cairo.LinearGradient(-0.85 * r, -0.88 * r, 0.90 * r, 0.90 * r)
        grad.add_color_stop_rgb(0.00, *SLIME_SKY)
        grad.add_color_stop_rgb(0.32, *SLIME_BLUE)
        grad.add_color_stop_rgb(0.66, *SLIME_IRIS)
        grad.add_color_stop_rgb(1.00, *SLIME_CORAL)
        ctx.set_source(grad)
        ctx.fill_preserve()

        # Spherical 3D studio lighting
        inner_light = cairo.RadialGradient(-0.35 * r, -0.42 * r, 2.0, -0.15 * r, -0.20 * r, 0.98 * r)
        inner_light.add_color_stop_rgba(0.0, 1.0, 1.0, 1.0, 0.46)
        inner_light.add_color_stop_rgba(0.35, 1.0, 1.0, 1.0, 0.14)
        inner_light.add_color_stop_rgba(0.82, 0.18, 0.10, 0.36, 0.16)
        inner_light.add_color_stop_rgba(1.0, 0.12, 0.06, 0.28, 0.36)
        ctx.set_source(inner_light)
        ctx.fill()

        # Residual white blueprint meridian & equator arcs
        ctx.save()
        ctx.new_path()
        ctx.arc(0, 0, r, 0, 2 * math.pi)
        ctx.clip()

        ctx.set_line_width(1.3)
        ctx.set_source_rgba(1.0, 1.0, 1.0, 0.55)
        # Meridian ellipse arc
        ctx.save()
        ctx.scale(0.46, 1.0)
        ctx.new_path()
        ctx.arc(0, 0, r * 0.96, -math.pi * 0.5, math.pi * 0.5)
        ctx.stroke()
        ctx.restore()
        # Equator ellipse arc
        ctx.save()
        ctx.scale(1.0, 0.38)
        ctx.new_path()
        ctx.arc(0, 0, r * 0.96, 0, math.pi)
        ctx.stroke()
        ctx.restore()
        # Top-left glossy highlight pill
        ctx.save()
        ctx.translate(-0.42 * r, -0.42 * r)
        ctx.rotate(-math.pi * 0.25)
        draw_capsule_pill(ctx, 0, 0, 0.24 * r, 0.09 * r)
        ctx.set_source_rgba(1.0, 1.0, 1.0, 0.55)
        ctx.fill()
        ctx.restore()
        ctx.restore()

        # Crisp white drafting rim
        ctx.new_path()
        ctx.arc(0, 0, r, 0, 2 * math.pi)
        ctx.set_source_rgba(1.0, 1.0, 1.0, 0.95)
        ctx.set_line_width(2.0)
        ctx.stroke()

    else:
        # Pure blueprint wireframe mode
        ctx.new_path()
        ctx.arc(0, 0, r, 0, 2 * math.pi)
        ctx.set_source_rgba(1.0, 1.0, 1.0, 0.95)
        ctx.set_line_width(2.0)
        ctx.stroke()

    # --- Pure White Capsule Eyes (Adhering strictly to the 5 Visual Iron Rules) ---
    look_x, look_y = look
    look_x = clamp(look_x, -1.0, 1.0)
    look_y = clamp(look_y, -1.0, 1.0)

    base_eye_x = 0.08 * r + look_x * 0.14 * r
    base_eye_y = -0.10 * r + look_y * 0.12 * r

    eye_tilt = -30.0 * math.pi / 180.0  # Strictly -30° tilt
    cos_e = math.cos(eye_tilt)
    sin_e = math.sin(eye_tilt)

    eye_spacing = 0.35 * r
    lx = base_eye_x - 0.5 * eye_spacing * cos_e
    ly = base_eye_y - 0.5 * eye_spacing * sin_e
    rx = base_eye_x + 0.5 * eye_spacing * cos_e
    ry = base_eye_y + 0.5 * eye_spacing * sin_e

    near_w = 0.102 * r
    near_h = 0.238 * r
    far_w = near_w * 0.81  # STRICTLY 81% of near eye width!
    far_h = near_h * 0.88

    blink_factor = clamp(1.0 - blink, 0.06, 1.0)

    # Subtle eye glow
    for (ex, ey, ew, eh) in [(lx, ly, near_w, near_h), (rx, ry, far_w, far_h)]:
        eglow = cairo.RadialGradient(ex, ey, ew * 0.2, ex, ey, eh * 1.35)
        eglow.add_color_stop_rgba(0.0, 1.0, 1.0, 1.0, 0.35)
        eglow.add_color_stop_rgba(1.0, 1.0, 1.0, 1.0, 0.0)
        ctx.set_source(eglow)
        ctx.arc(ex, ey, eh * 1.35, 0, 2 * math.pi)
        ctx.fill()

    ctx.set_source_rgba(1.0, 1.0, 1.0, 1.0)
    if eye_mode == "happy":
        ctx.set_line_width(max(2.4, 0.055 * r))
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        for (ex, ey, ew) in [(lx, ly, near_w), (rx, ry, far_w)]:
            ctx.save()
            ctx.translate(ex, ey)
            ctx.rotate(eye_tilt)
            ctx.new_path()
            ctx.arc(0, 2.0, ew * 1.45, -math.pi * 0.85, -math.pi * 0.15)
            ctx.stroke()
            ctx.restore()
    elif eye_mode == "sparkle":
        draw_four_point_star(ctx, lx, ly, outer_r=near_h * 0.78, inner_r=near_h * 0.20, rot=-0.2)
        ctx.fill()
        draw_four_point_star(ctx, rx, ry, outer_r=far_h * 0.78 * 0.81, inner_r=far_h * 0.20 * 0.81, rot=-0.2)
        ctx.fill()
    else:
        # Standard pure white capsule eyes
        ctx.save()
        ctx.translate(lx, ly)
        ctx.rotate(eye_tilt)
        draw_capsule_pill(ctx, 0, 0, near_w, near_h * blink_factor)
        ctx.fill()
        ctx.restore()

        ctx.save()
        ctx.translate(rx, ry)
        ctx.rotate(eye_tilt)
        draw_capsule_pill(ctx, 0, 0, far_w, far_h * blink_factor)
        ctx.fill()
        ctx.restore()

    ctx.restore()


# -----------------------------------------------------------------------------
# 3. Sparkle Star Drawing (Contract Function)
# -----------------------------------------------------------------------------

def draw_star(ctx: cairo.Context, cx: float, cy: float, r: float, *,
              rot: float = 0.0, t: float = 0.0, **style_kw):
    """
    Draws the signature Gemini 4-pointed sparkle star as a compass-constructed
    geometric star with concentric compass arcs, crosshair guidelines, and
    gradient core.
    """
    ctx.save()

    # Luminous halo
    glow = cairo.RadialGradient(cx, cy, 1.0, cx, cy, r * 2.4)
    glow.add_color_stop_rgba(0.0, 1.0, 1.0, 1.0, 0.55)
    glow.add_color_stop_rgba(0.45, 0.85, 0.92, 1.0, 0.22)
    glow.add_color_stop_rgba(1.0, 0.75, 0.85, 1.0, 0.0)
    ctx.set_source(glow)
    ctx.arc(cx, cy, r * 2.4, 0, 2 * math.pi)
    ctx.fill()

    # Compass construction concentric circles
    ctx.set_source_rgba(1.0, 1.0, 1.0, 0.65)
    ctx.set_line_width(1.0)
    ctx.set_dash([3.0, 3.0])
    ctx.new_path()
    ctx.arc(cx, cy, r * 0.55, 0, 2 * math.pi)
    ctx.stroke()
    ctx.new_path()
    ctx.arc(cx, cy, r * 1.18, 0, 2 * math.pi)
    ctx.stroke()

    # Crosshair lines
    ctx.set_dash([4.0, 3.0])
    ctx.move_to(cx - r * 1.55, cy)
    ctx.line_to(cx + r * 1.55, cy)
    ctx.move_to(cx, cy - r * 1.55)
    ctx.line_to(cx, cy + r * 1.55)
    ctx.stroke()
    ctx.set_dash([])

    # Four-point curved star body
    inner_r = r * 0.26
    draw_four_point_star(ctx, cx, cy, outer_r=r, inner_r=inner_r, rot=rot)
    grad = cairo.LinearGradient(cx - r * 0.5, cy - r * 0.5, cx + r * 0.5, cy + r * 0.5)
    grad.add_color_stop_rgb(0.0, *SLIME_SKY)
    grad.add_color_stop_rgb(0.5, *SLIME_IRIS)
    grad.add_color_stop_rgb(1.0, *SLIME_CORAL)
    ctx.set_source(grad)
    ctx.fill_preserve()

    ctx.set_source_rgba(1.0, 1.0, 1.0, 0.98)
    ctx.set_line_width(1.8)
    ctx.stroke()

    # Small CAD node circles at tips
    for i in range(4):
        ang = rot + i * (math.pi / 2.0) - math.pi / 2.0
        tx = cx + r * math.cos(ang)
        ty = cy + r * math.sin(ang)
        ctx.new_path()
        ctx.arc(tx, ty, 2.0, 0, 2 * math.pi)
        ctx.fill()

    ctx.restore()


# -----------------------------------------------------------------------------
# 4. Left Half: Prussian Blue Blueprint Technical Drawings (v3 Fidelity)
# -----------------------------------------------------------------------------

def make_blueprint_surface(width: int, height: int) -> cairo.ImageSurface:
    """
    Creates the rich Prussian Blue cyanotype background with authentic subtle
    cyanotype paper mottling texture.
    """
    rng = np.random.RandomState(202605)
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)

    # Radial glow centered around x=520, y=520
    dist = np.sqrt(((xx - 520.0) / 720.0) ** 2 + ((yy - 520.0) / 620.0) ** 2)
    vig = np.clip(1.0 - 0.55 * (dist ** 1.35), 0.0, 1.0)

    # Multi-scale low-frequency cyanotype paper mottling
    small_h, small_w = height // 12, width // 12
    noise_coarse = rng.normal(0.0, 1.0, (small_h, small_w)).astype(np.float32)
    noise_img = Image.fromarray(noise_coarse).resize((width, height), resample=Image.BILINEAR)
    mottle = np.array(noise_img, dtype=np.float32)
    mottle += 0.45 * np.sin(xx * 0.018 + yy * 0.013) + 0.35 * np.cos(xx * 0.031 - yy * 0.024)

    r = np.clip(11.0 + 13.0 * vig + 3.2 * mottle, 6, 38).astype(np.uint8)
    g = np.clip(34.0 + 30.0 * vig + 5.5 * mottle, 20, 82).astype(np.uint8)
    b = np.clip(70.0 + 50.0 * vig + 8.5 * mottle, 48, 145).astype(np.uint8)
    a = np.full((height, width), 255, dtype=np.uint8)

    bgra = np.dstack([b, g, r, a]).copy()
    return cairo.ImageSurface.create_for_data(bgra, cairo.FORMAT_ARGB32, width, height)


def draw_blueprint_grids_and_sections(ctx: cairo.Context, ox: float = 0.0):
    """
    Draws all technical blueprint linework on the left Prussian Blue sheet:
    - Fine minor (24px) & major (120px) blueprint grids
    - Top-Left Orthographic Island Section (SECTION A-A 浮空岛 · 正交剖面 1:50)
    - Middle-Left 2D Building Elevations (ELEVATION E-1) with spring coils
    - Center-Left Polar Compass Ring & Slime Cutaway Specification at (725, 555)
    """
    ctx.save()
    ctx.translate(ox, 0)

    # 1. Dual Blueprint Grid
    ctx.set_source_rgba(0.55, 0.80, 1.0, 0.09)
    ctx.set_line_width(0.6)
    for gx in range(44, 1150, 24):
        ctx.move_to(gx, 38)
        ctx.line_to(gx, H - 38)
    for gy in range(38, H - 38, 24):
        ctx.move_to(44, gy)
        ctx.line_to(1150, gy)
    ctx.stroke()

    ctx.set_source_rgba(0.62, 0.85, 1.0, 0.21)
    ctx.set_line_width(1.0)
    for gx in range(44, 1150, 120):
        ctx.move_to(gx, 38)
        ctx.line_to(gx, H - 38)
    for gy in range(38, H - 38, 120):
        ctx.move_to(44, gy)
        ctx.line_to(1150, gy)
    ctx.stroke()

    # Subtle '+' crosshairs at major intersections
    ctx.set_source_rgba(0.75, 0.92, 1.0, 0.35)
    ctx.set_line_width(1.0)
    for gx in range(164, 1050, 240):
        for gy in range(158, H - 100, 240):
            ctx.move_to(gx - 4, gy)
            ctx.line_to(gx + 4, gy)
            ctx.move_to(gx, gy - 4)
            ctx.line_to(gx, gy + 4)
    ctx.stroke()

    # =========================================================================
    # 2. Top-Left: Orthographic Island Section (SECTION A-A, Ø 3600, 2050)
    # =========================================================================
    sec_x0, sec_x1 = 115.0, 455.0
    sec_cx = 0.5 * (sec_x0 + sec_x1)  # 285.0
    sec_y_top = 290.0
    sec_y_bot = 492.0

    # Rock cone outer polygon
    cone_pts = [
        (sec_x0, sec_y_top),
        (134.0, 358.0),
        (sec_cx, sec_y_bot),
        (436.0, 358.0),
        (sec_x1, sec_y_top),
    ]

    # 45° diagonal section hatching inside the rock cone
    ctx.save()
    ctx.new_path()
    for idx, (px, py) in enumerate(cone_pts):
        if idx == 0:
            ctx.move_to(px, py)
        else:
            ctx.line_to(px, py)
    ctx.close_path()
    ctx.clip()

    ctx.set_source_rgba(0.65, 0.86, 1.0, 0.25)
    ctx.set_line_width(0.9)
    for h_off in range(-220, 420, 9):
        ctx.move_to(sec_x0 + h_off, sec_y_top)
        ctx.line_to(sec_x0 + h_off - 210, sec_y_bot + 10)
    ctx.stroke()
    ctx.restore()

    # Main white outline of the orthographic rock cone
    ctx.set_source_rgba(0.95, 0.98, 1.0, 0.95)
    ctx.set_line_width(1.8)
    ctx.new_path()
    for idx, (px, py) in enumerate(cone_pts):
        if idx == 0:
            ctx.move_to(px, py)
        else:
            ctx.line_to(px, py)
    ctx.close_path()
    ctx.stroke()

    # Internal facet ridges of the rock cone
    ctx.set_source_rgba(0.80, 0.92, 1.0, 0.72)
    ctx.set_line_width(1.1)
    # Mid zigzag ridge
    ctx.move_to(134.0, 358.0)
    ctx.line_to(220.0, 382.0)
    ctx.line_to(sec_cx, 355.0)
    ctx.line_to(352.0, 378.0)
    ctx.line_to(436.0, 358.0)
    # Ridges from top platform to bottom apex
    ctx.move_to(220.0, sec_y_top)
    ctx.line_to(220.0, 382.0)
    ctx.line_to(sec_cx, sec_y_bot)
    ctx.move_to(352.0, sec_y_top)
    ctx.line_to(352.0, 378.0)
    ctx.line_to(sec_cx, sec_y_bot)
    ctx.move_to(sec_cx, sec_y_top)
    ctx.line_to(sec_cx, sec_y_bot)
    ctx.stroke()

    # Top platform small 2D house (left), pine tree (middle), cherry tree (right)
    ctx.set_source_rgba(0.95, 0.98, 1.0, 0.92)
    ctx.set_line_width(1.5)
    # Small 2D house (x=172..224, y=248..290)
    ctx.rectangle(172.0, 248.0, 52.0, 42.0)
    ctx.move_to(164.0, 248.0)
    ctx.line_to(198.0, 218.0)
    ctx.line_to(232.0, 248.0)
    ctx.close_path()
    # Chimney
    ctx.move_to(212.0, 230.0)
    ctx.line_to(212.0, 216.0)
    ctx.line_to(222.0, 216.0)
    ctx.line_to(222.0, 239.0)
    # Window
    ctx.rectangle(191.0, 260.0, 14.0, 14.0)
    ctx.stroke()

    # Small 2D pine tree (center, x=298)
    ctx.move_to(298.0, 290.0)
    ctx.line_to(298.0, 274.0)
    ctx.move_to(278.0, 274.0)
    ctx.line_to(298.0, 224.0)
    ctx.line_to(318.0, 274.0)
    ctx.close_path()
    ctx.stroke()

    # Small 2D round cherry tree (right, x=376)
    ctx.move_to(376.0, 290.0)
    ctx.line_to(376.0, 274.0)
    ctx.stroke()
    ctx.new_path()
    ctx.arc(376.0, 255.0, 19.0, 0, 2 * math.pi)
    ctx.stroke()

    # Dimension lines for SECTION A-A: Horizontal Ø 3600 & Vertical 2050
    ctx.set_source_rgba(0.72, 0.88, 1.0, 0.78)
    ctx.set_line_width(1.0)
    dim_y = 192.0
    # Extension lines
    ctx.move_to(sec_x0, sec_y_top - 8)
    ctx.line_to(sec_x0, dim_y - 8)
    ctx.move_to(sec_x1, sec_y_top - 8)
    ctx.line_to(sec_x1, dim_y - 8)
    # Horizontal dimension line with gap in center for text
    ctx.move_to(sec_x0, dim_y)
    ctx.line_to(sec_cx - 32, dim_y)
    ctx.move_to(sec_cx + 32, dim_y)
    ctx.line_to(sec_x1, dim_y)
    # Arrow ticks
    for ax, dir_s in [(sec_x0, 1), (sec_x1, -1)]:
        ctx.move_to(ax, dim_y)
        ctx.line_to(ax + dir_s * 7, dim_y - 3.5)
        ctx.move_to(ax, dim_y)
        ctx.line_to(ax + dir_s * 7, dim_y + 3.5)
    ctx.stroke()

    # Vertical dimension line on right (x = 492, y = 290..492, label 2050)
    dim_x = 492.0
    ctx.move_to(sec_x1 + 8, sec_y_top)
    ctx.line_to(dim_x + 8, sec_y_top)
    ctx.move_to(sec_cx + 12, sec_y_bot)
    ctx.line_to(dim_x + 8, sec_y_bot)
    ctx.move_to(dim_x, sec_y_top)
    ctx.line_to(dim_x, 372.0)
    ctx.move_to(dim_x, 412.0)
    ctx.line_to(dim_x, sec_y_bot)
    for ay, dir_s in [(sec_y_top, 1), (sec_y_bot, -1)]:
        ctx.move_to(dim_x, ay)
        ctx.line_to(dim_x - 3.5, ay + dir_s * 7)
        ctx.move_to(dim_x, ay)
        ctx.line_to(dim_x + 3.5, ay + dir_s * 7)
    ctx.stroke()

    # =========================================================================
    # 3. Bottom-Left: 2D Building Elevations (ELEVATION E-1) + Spring Coils
    # =========================================================================
    by_base = 848.0
    ctx.set_source_rgba(0.92, 0.97, 1.0, 0.92)
    ctx.set_line_width(1.6)

    # Ground line
    ctx.move_to(75.0, by_base)
    ctx.line_to(500.0, by_base)
    ctx.stroke()

    # Building 1: Left Cottage (x=96..184, y=756..848)
    ctx.rectangle(96.0, 756.0, 88.0, 92.0)
    ctx.move_to(86.0, 756.0)
    ctx.line_to(140.0, 708.0)
    ctx.line_to(194.0, 756.0)
    ctx.close_path()
    # Two windows & door
    ctx.rectangle(108.0, 786.0, 20.0, 22.0)
    ctx.rectangle(152.0, 786.0, 20.0, 22.0)
    ctx.rectangle(133.0, 810.0, 14.0, 38.0)
    ctx.stroke()

    # Building 2: Tall Spire Tower (x=226..264, y=656..848)
    ctx.rectangle(226.0, 656.0, 38.0, 192.0)
    ctx.move_to(220.0, 656.0)
    ctx.line_to(245.0, 586.0)
    ctx.line_to(270.0, 656.0)
    ctx.close_path()
    ctx.stroke()
    # Circle ornament at spire tip
    ctx.new_path()
    ctx.arc(245.0, 580.0, 5.5, 0, 2 * math.pi)
    ctx.stroke()
    # 4 stacked square windows
    for wy in [674.0, 706.0, 738.0, 770.0]:
        ctx.rectangle(238.0, wy, 14.0, 18.0)
    ctx.stroke()
    # Horizontal spring hatching at base of tower
    ctx.set_line_width(1.1)
    for sy in range(806, 848, 5):
        ctx.move_to(226.0, sy)
        ctx.line_to(264.0, sy)
    ctx.stroke()

    # Building 3: Two-story House (x=302..386, y=732..848)
    ctx.set_line_width(1.6)
    ctx.rectangle(302.0, 732.0, 84.0, 116.0)
    ctx.move_to(292.0, 732.0)
    ctx.line_to(344.0, 682.0)
    ctx.line_to(396.0, 732.0)
    ctx.close_path()
    ctx.rectangle(316.0, 750.0, 20.0, 20.0)
    ctx.rectangle(352.0, 750.0, 20.0, 20.0)
    ctx.rectangle(316.0, 790.0, 20.0, 22.0)
    ctx.rectangle(352.0, 798.0, 18.0, 50.0)
    ctx.stroke()

    # Building 4: Small Right Shed (x=418..466, y=792..848)
    ctx.rectangle(418.0, 792.0, 48.0, 56.0)
    ctx.move_to(412.0, 792.0)
    ctx.line_to(442.0, 764.0)
    ctx.line_to(472.0, 792.0)
    ctx.close_path()
    ctx.rectangle(434.0, 808.0, 16.0, 16.0)
    ctx.stroke()

    # Zigzag spring coil symbols under/beside buildings (showing upward pop-up action)
    ctx.set_source_rgba(0.80, 0.93, 1.0, 0.85)
    ctx.set_line_width(1.2)
    for sx_base in [296.0, 392.0, 442.0]:
        ctx.move_to(sx_base, by_base)
        for step in range(6):
            dx = 6.0 if (step % 2 == 0) else -6.0
            ctx.line_to(sx_base + dx, by_base - (step + 1) * 4.5)
        ctx.line_to(sx_base, by_base - 30.0)
    ctx.stroke()

    # Dimension lines under elevations (y = 868)
    ctx.set_source_rgba(0.68, 0.86, 1.0, 0.72)
    ctx.set_line_width(1.0)
    ctx.move_to(96.0, 868.0)
    ctx.line_to(122.0, 868.0)
    ctx.move_to(158.0, 868.0)
    ctx.line_to(184.0, 868.0)
    ctx.move_to(302.0, 868.0)
    ctx.line_to(326.0, 868.0)
    ctx.move_to(362.0, 868.0)
    ctx.line_to(386.0, 868.0)
    ctx.stroke()

    # =========================================================================
    # 4. Center-Left (cx=726, cy=556): Polar Compass Ring & Slime Cutaway
    # =========================================================================
    pcx, pcy = 726.0, 556.0
    slime_r = 116.0
    ring_r1 = 152.0
    ring_r2 = 186.0

    # Isometric coordinate origin & axes at bottom of Slime: (0,0,0) at (pcx, pcy + slime_r)
    orig_x, orig_y = pcx, pcy + slime_r
    ctx.set_source_rgba(0.85, 0.95, 1.0, 0.82)
    ctx.set_line_width(1.3)

    # Isometric base ellipse centered at (pcx, pcy + slime_r * 0.45)
    ctx.save()
    ctx.translate(pcx, pcy + slime_r * 0.45)
    ctx.scale(1.0, 0.42)
    ctx.new_path()
    ctx.arc(0, 0, slime_r * 1.12, 0, 2 * math.pi)
    ctx.set_source_rgba(0.75, 0.90, 1.0, 0.55)
    ctx.stroke()
    ctx.restore()

    # Isometric X, Y, Z axes radiating through the Slime
    ctx.set_source_rgba(0.88, 0.96, 1.0, 0.85)
    ctx.set_line_width(1.3)
    # Z axis (vertical up to y = 318)
    ctx.move_to(pcx, pcy + slime_r + 25)
    ctx.line_to(pcx, 318.0)
    # Arrowhead at top of Z
    ctx.move_to(pcx, 318.0)
    ctx.line_to(pcx - 4.5, 327.0)
    ctx.move_to(pcx, 318.0)
    ctx.line_to(pcx + 4.5, 327.0)

    # Y axis (down-left 30°)
    y_end_x = pcx - 165.0 * math.cos(math.radians(30))
    y_end_y = orig_y + 165.0 * math.sin(math.radians(30)) - 42.0
    ctx.move_to(pcx + 120.0 * math.cos(math.radians(30)), orig_y - 120.0 * math.sin(math.radians(30)) - 42.0)
    ctx.line_to(y_end_x, y_end_y)

    # X axis (down-right 30°)
    x_end_x = pcx + 165.0 * math.cos(math.radians(30))
    x_end_y = orig_y + 165.0 * math.sin(math.radians(30)) - 42.0
    ctx.move_to(pcx - 120.0 * math.cos(math.radians(30)), orig_y - 120.0 * math.sin(math.radians(30)) - 42.0)
    ctx.line_to(x_end_x, x_end_y)
    ctx.stroke()

    # Outer Polar Compass Rings (r1=152, r2=186)
    ctx.set_source_rgba(0.82, 0.93, 1.0, 0.72)
    ctx.set_line_width(1.2)
    ctx.new_path()
    ctx.arc(pcx, pcy, ring_r1, 0, 2 * math.pi)
    ctx.stroke()

    ctx.set_source_rgba(0.68, 0.86, 1.0, 0.48)
    ctx.set_line_width(1.0)
    ctx.new_path()
    ctx.arc(pcx, pcy, ring_r2, 0, 2 * math.pi)
    ctx.stroke()

    # Degree tick marks on ring_r1 & ring_r2
    ctx.set_source_rgba(0.85, 0.95, 1.0, 0.78)
    for deg in range(0, 360, 5):
        rad = math.radians(deg)
        ca, sa = math.cos(rad), math.sin(rad)
        if deg % 30 == 0:
            t_in, t_out = ring_r1 - 6.0, ring_r1 + 10.0
            ctx.set_line_width(1.4)
        elif deg % 15 == 0:
            t_in, t_out = ring_r1 - 3.0, ring_r1 + 6.0
            ctx.set_line_width(1.0)
        else:
            t_in, t_out = ring_r1, ring_r1 + 3.5
            ctx.set_line_width(0.7)
        ctx.move_to(pcx + t_in * ca, pcy + t_in * sa)
        ctx.line_to(pcx + t_out * ca, pcy + t_out * sa)
    ctx.stroke()

    # Draw the Cutaway Specification Slime at (pcx, pcy, radius=116)
    draw_slime(ctx, pcx, pcy, radius=slime_r, squash_y=0.92, tilt=0.0,
               look=(0.10, -0.12), eye_mode="pill", mode="cutaway", draw_shadow=False)

    # Crown Sparkle Star ✦ right above the Cutaway Slime's head (matching v3!)
    draw_star(ctx, pcx, pcy - slime_r - 18.0, r=22.0, rot=0.0)

    # Technical Callout Leader Lines around the Cutaway Slime
    ctx.set_source_rgba(0.88, 0.96, 1.0, 0.85)
    ctx.set_line_width(1.1)
    # 1. Leader from far (right) eye to "FAR EYE 81%"
    ctx.move_to(pcx + 32.0, pcy - 34.0)
    ctx.line_to(pcx + 122.0, pcy - 106.0)
    ctx.line_to(pcx + 162.0, pcy - 106.0)
    # 2. Leader from eye tilt to "-30°" outside the right contour
    ctx.move_to(pcx + 42.0, pcy - 16.0)
    ctx.line_to(pcx + 124.0, pcy - 26.0)
    # 3. Leader from bottom-left contour to "R 120 / sx=1/sqrt(sy)"
    ctx.move_to(pcx - 82.0, pcy + 78.0)
    ctx.line_to(pcx - 135.0, pcy + 98.0)
    ctx.line_to(pcx - 195.0, pcy + 98.0)
    ctx.stroke()

    ctx.restore()


# -----------------------------------------------------------------------------
# 5. Right Half: Dreamy Pastel Sky & 4 Macaron Low-Poly Floating Islands
# -----------------------------------------------------------------------------

def draw_pastel_macaron_sky(ctx: cairo.Context, width: int = W, height: int = H):
    """
    Renders the dreamy lavender-purple -> cherry-pink gradient sky on the right half,
    complete with subtle white isometric 30° perspective grid and floating pastel
    geometric particles (matching v3!).
    """
    # 1. Smooth Pastel Lavender -> Sakura Pink Sky Gradient
    sky_grad = cairo.LinearGradient(950, 0, width, height)
    sky_grad.add_color_stop_rgb(0.00, 206 / 255.0, 202 / 255.0, 242 / 255.0)  # #CECAF2 soft lavender-blue
    sky_grad.add_color_stop_rgb(0.38, 224 / 255.0, 214 / 255.0, 246 / 255.0)  # #E0D6F6 dreamy lilac
    sky_grad.add_color_stop_rgb(0.74, 246 / 255.0, 222 / 255.0, 238 / 255.0)  # #F6DEEE warm sakura pink
    sky_grad.add_color_stop_rgb(1.00, 232 / 255.0, 216 / 255.0, 242 / 255.0)  # #E8D8F2 soft pastel mist
    ctx.set_source(sky_grad)
    ctx.paint()

    # Warm luminous radial bloom behind the Hero Island & Starlight Pillar
    bloom = cairo.RadialGradient(1485, 520, 40, 1485, 520, 480)
    bloom.add_color_stop_rgba(0.0, 1.0, 0.95, 0.98, 0.45)
    bloom.add_color_stop_rgba(0.5, 0.98, 0.88, 0.95, 0.20)
    bloom.add_color_stop_rgba(1.0, 0.92, 0.84, 0.96, 0.0)
    ctx.set_source(bloom)
    ctx.arc(1485, 520, 480, 0, 2 * math.pi)
    ctx.fill()

    # 2. Delicate White Isometric 30° Perspective Grid across the Sky
    ctx.save()
    ctx.set_source_rgba(1.0, 1.0, 1.0, 0.26)
    ctx.set_line_width(0.85)
    tan30 = math.tan(math.radians(30.0))
    dx_span = 1100.0
    dy_span = dx_span * tan30
    for y_start in range(-700, 1800, 56):
        # Down-right 30° lines
        ctx.move_to(900.0, y_start)
        ctx.line_to(900.0 + dx_span, y_start + dy_span)
        # Up-right 30° lines
        ctx.move_to(900.0, y_start)
        ctx.line_to(900.0 + dx_span, y_start - dy_span)
    ctx.stroke()
    ctx.restore()

    # 3. Floating Pastel Geometric Particles (tiny triangles, diamonds, sparkles)
    rng = np.random.RandomState(77)
    p_cols = [
        (255 / 255.0, 182 / 255.0, 208 / 255.0, 0.78),  # sakura pink
        (152 / 255.0, 238 / 255.0, 208 / 255.0, 0.78),  # mint green
        (255 / 255.0, 235 / 255.0, 165 / 255.0, 0.82),  # lemon gold
        (195 / 255.0, 180 / 255.0, 248 / 255.0, 0.75),  # lavender
        (1.0, 1.0, 1.0, 0.85),                          # pure white
    ]
    for _ in range(38):
        px = rng.uniform(1020.0, 1870.0)
        py = rng.uniform(55.0, 1025.0)
        ps = rng.uniform(3.0, 6.5)
        col = p_cols[rng.randint(0, len(p_cols))]
        ctx.set_source_rgba(*col)
        shape_t = rng.randint(0, 3)
        ctx.new_path()
        if shape_t == 0:
            # Diamond
            ctx.move_to(px, py - ps)
            ctx.line_to(px + ps * 0.75, py)
            ctx.line_to(px, py + ps)
            ctx.line_to(px - ps * 0.75, py)
            ctx.close_path()
            ctx.fill()
        elif shape_t == 1:
            # Small triangle
            ang = rng.uniform(0, math.pi)
            for k in range(3):
                a = ang + k * (2 * math.pi / 3)
                vx, vy = px + ps * math.cos(a), py + ps * math.sin(a)
                if k == 0:
                    ctx.move_to(vx, vy)
                else:
                    ctx.line_to(vx, vy)
            ctx.close_path()
            ctx.fill()
        else:
            # Tiny dot
            ctx.arc(px, py, ps * 0.45, 0, 2 * math.pi)
            ctx.fill()


def draw_poly_face(ctx: cairo.Context, pts: list, fill_rgb: tuple,
                   edge_rgba: tuple = (1.0, 1.0, 1.0, 0.25), edge_w: float = 0.8):
    """Helper to draw a crisp low-poly polygon face with subtle edge highlight."""
    ctx.new_path()
    for idx, (x, y) in enumerate(pts):
        if idx == 0:
            ctx.move_to(x, y)
        else:
            ctx.line_to(x, y)
    ctx.close_path()
    if len(fill_rgb) == 4:
        ctx.set_source_rgba(*fill_rgb)
    else:
        ctx.set_source_rgb(*fill_rgb)
    if edge_w > 0:
        ctx.fill_preserve()
        ctx.set_source_rgba(*edge_rgba)
        ctx.set_line_width(edge_w)
        ctx.stroke()
    else:
        ctx.fill()


def draw_lowpoly_pine_tree(ctx: cairo.Context, tx: float, ty: float, scale: float = 1.0,
                           wireframe: bool = False):
    """
    Draws a cute multi-tiered faceted mint-emerald low-poly pine tree at (tx, ty).
    """
    s = scale
    # Trunk
    trunk_pts = [
        (tx - 3.5 * s, ty),
        (tx + 3.5 * s, ty),
        (tx + 2.5 * s, ty - 14 * s),
        (tx - 2.5 * s, ty - 14 * s),
    ]
    # 2 stacked low-poly cones
    tiers = [
        # (base_y, apex_y, half_w)
        (ty - 10 * s, ty - 42 * s, 18.0 * s),
        (ty - 28 * s, ty - 58 * s, 14.0 * s),
    ]
    if wireframe:
        ctx.set_source_rgba(0.92, 0.98, 1.0, 0.90)
        ctx.set_line_width(1.1)
        for b_y, a_y, hw in tiers:
            apex = (tx, a_y)
            b_pts = [
                (tx - hw, b_y - 2 * s),
                (tx - hw * 0.35, b_y + 4 * s),
                (tx + hw * 0.35, b_y + 4 * s),
                (tx + hw, b_y - 2 * s),
            ]
            for bp in b_pts:
                ctx.move_to(apex[0], apex[1])
                ctx.line_to(bp[0], bp[1])
            for i in range(len(b_pts) - 1):
                ctx.move_to(b_pts[i][0], b_pts[i][1])
                ctx.line_to(b_pts[i + 1][0], b_pts[i + 1][1])
        ctx.stroke()
        return

    # Shadow on grass
    ctx.save()
    ctx.translate(tx + 4 * s, ty + 2 * s)
    ctx.scale(16 * s, 7 * s)
    ctx.new_path()
    ctx.arc(0, 0, 1.0, 0, 2 * math.pi)
    ctx.set_source_rgba(0.25, 0.58, 0.48, 0.25)
    ctx.fill()
    ctx.restore()

    draw_poly_face(ctx, trunk_pts, (145 / 255.0, 112 / 255.0, 98 / 255.0), edge_w=0.0)

    mint_cols = [
        (138 / 255.0, 232 / 255.0, 196 / 255.0),  # left sunlit
        (106 / 255.0, 212 / 255.0, 174 / 255.0),  # center-left
        (78 / 255.0, 188 / 255.0, 150 / 255.0),   # right shaded
    ]
    for b_y, a_y, hw in tiers:
        apex = (tx, a_y)
        b_pts = [
            (tx - hw, b_y - 2 * s),
            (tx - hw * 0.32, b_y + 4.5 * s),
            (tx + hw * 0.32, b_y + 4.5 * s),
            (tx + hw, b_y - 2 * s),
        ]
        for i in range(3):
            draw_poly_face(ctx, [apex, b_pts[i], b_pts[i + 1]], mint_cols[i],
                           edge_rgba=(1.0, 1.0, 1.0, 0.28), edge_w=0.7)


def draw_lowpoly_cherry_tree(ctx: cairo.Context, tx: float, ty: float, scale: float = 1.0,
                             wireframe: bool = False):
    """
    Draws a cute faceted pink polyhedral sakura / cherry-blossom tree (粉红圆球冠樱花树)
    matching v3's signature island flora!
    """
    s = scale
    cx, cy = tx, ty - 34.0 * s
    r = 20.0 * s

    # Polyhedral crown vertices: top, upper ring (4), lower ring (4), bottom
    top = (cx, cy - r * 0.95)
    u_ring = [
        (cx - r * 0.92, cy - r * 0.28),
        (cx - r * 0.32, cy - r * 0.15),
        (cx + r * 0.35, cy - r * 0.18),
        (cx + r * 0.92, cy - r * 0.28),
    ]
    l_ring = [
        (cx - r * 0.82, cy + r * 0.45),
        (cx - r * 0.28, cy + r * 0.62),
        (cx + r * 0.32, cy + r * 0.60),
        (cx + r * 0.82, cy + r * 0.42),
    ]
    bot = (cx, cy + r * 0.88)

    tris = [
        ([top, u_ring[0], u_ring[1]], (255 / 255.0, 206 / 255.0, 222 / 255.0)),
        ([top, u_ring[1], u_ring[2]], (255 / 255.0, 192 / 255.0, 212 / 255.0)),
        ([top, u_ring[2], u_ring[3]], (246 / 255.0, 168 / 255.0, 194 / 255.0)),
        ([u_ring[0], l_ring[0], u_ring[1]], (252 / 255.0, 184 / 255.0, 206 / 255.0)),
        ([u_ring[1], l_ring[0], l_ring[1]], (248 / 255.0, 166 / 255.0, 192 / 255.0)),
        ([u_ring[1], l_ring[1], u_ring[2]], (244 / 255.0, 156 / 255.0, 184 / 255.0)),
        ([u_ring[2], l_ring[1], l_ring[2]], (236 / 255.0, 142 / 255.0, 172 / 255.0)),
        ([u_ring[2], l_ring[2], u_ring[3]], (232 / 255.0, 134 / 255.0, 166 / 255.0)),
        ([u_ring[3], l_ring[2], l_ring[3]], (220 / 255.0, 120 / 255.0, 154 / 255.0)),
        ([l_ring[0], bot, l_ring[1]], (228 / 255.0, 132 / 255.0, 164 / 255.0)),
        ([l_ring[1], bot, l_ring[2]], (216 / 255.0, 118 / 255.0, 150 / 255.0)),
        ([l_ring[2], bot, l_ring[3]], (204 / 255.0, 106 / 255.0, 138 / 255.0)),
    ]

    if wireframe:
        ctx.set_source_rgba(0.92, 0.98, 1.0, 0.90)
        ctx.set_line_width(1.1)
        for pts, _ in tris:
            ctx.move_to(pts[0][0], pts[0][1])
            ctx.line_to(pts[1][0], pts[1][1])
            ctx.line_to(pts[2][0], pts[2][1])
            ctx.close_path()
        ctx.stroke()
        return

    # Soft ground shadow
    ctx.save()
    ctx.translate(tx + 4 * s, ty + 2 * s)
    ctx.scale(15 * s, 6.5 * s)
    ctx.new_path()
    ctx.arc(0, 0, 1.0, 0, 2 * math.pi)
    ctx.set_source_rgba(0.25, 0.58, 0.48, 0.25)
    ctx.fill()
    ctx.restore()

    # Slender wooden trunk
    trunk_pts = [
        (tx - 3.2 * s, ty),
        (tx + 3.2 * s, ty),
        (tx + 2.0 * s, ty - 20.0 * s),
        (tx - 2.0 * s, ty - 20.0 * s),
    ]
    draw_poly_face(ctx, trunk_pts, (142 / 255.0, 104 / 255.0, 92 / 255.0), edge_w=0.0)

    # Faceted pink sakura crown
    for pts, col in tris:
        draw_poly_face(ctx, pts, col, edge_rgba=(1.0, 0.95, 0.98, 0.30), edge_w=0.7)


def draw_lowpoly_cottage(ctx: cairo.Context, hx: float, hy: float, scale: float = 1.0,
                         roof_style: str = "pink", flip: bool = False):
    """
    Draws a charming isometric low-poly cottage at (hx, hy) with pastel roof:
    - roof_style: 'pink' (sakura pink), 'yellow' (lemon butter), or 'blue' (periwinkle sky)
    """
    s = scale
    dir_x = -1.0 if flip else 1.0

    # Roof palettes (light slope, shaded slope)
    palettes = {
        "pink": ((252 / 255.0, 158 / 255.0, 186 / 255.0), (232 / 255.0, 124 / 255.0, 156 / 255.0)),
        "yellow": ((254 / 255.0, 228 / 255.0, 132 / 255.0), (238 / 255.0, 200 / 255.0, 96 / 255.0)),
        "blue": ((166 / 255.0, 192 / 255.0, 248 / 255.0), (136 / 255.0, 162 / 255.0, 228 / 255.0)),
    }
    roof_hi, roof_shd = palettes.get(roof_style, palettes["pink"])

    # Soft shadow on grass
    ctx.save()
    ctx.translate(hx + 4 * s, hy + 4 * s)
    ctx.scale(28 * s, 12 * s)
    ctx.new_path()
    ctx.arc(0, 0, 1.0, 0, 2 * math.pi)
    ctx.set_source_rgba(0.22, 0.55, 0.45, 0.26)
    ctx.fill()
    ctx.restore()

    # Isometric house vertices relative to (hx, hy)
    # Front-left wall (sunlit cream) & front-right gable wall (warm shaded cream)
    p_bot_mid = (hx, hy + 10 * s)
    p_bot_left = (hx - 24 * s * dir_x, hy - 2 * s)
    p_bot_right = (hx + 20 * s * dir_x, hy - 2 * s)

    p_top_mid = (hx, hy - 14 * s)
    p_top_left = (hx - 24 * s * dir_x, hy - 26 * s)
    p_top_right = (hx + 20 * s * dir_x, hy - 26 * s)

    # Gable peak on front-right face & back-left face
    p_peak_front = (hx + 10 * s * dir_x, hy - 44 * s)
    p_peak_back = (hx - 14 * s * dir_x, hy - 56 * s)

    wall_sun = (252 / 255.0, 246 / 255.0, 238 / 255.0)
    wall_shd = (232 / 255.0, 222 / 255.0, 214 / 255.0)

    # Left wall (quad)
    draw_poly_face(ctx, [p_bot_left, p_bot_mid, p_top_mid, p_top_left], wall_sun,
                   edge_rgba=(1.0, 1.0, 1.0, 0.4), edge_w=0.8)
    # Right gable wall (pentagon)
    draw_poly_face(ctx, [p_bot_mid, p_bot_right, p_top_right, p_peak_front, p_top_mid], wall_shd,
                   edge_rgba=(1.0, 1.0, 1.0, 0.4), edge_w=0.8)

    # Roof slope (with slight overhang)
    r_eave_front = (hx - 2 * s * dir_x, hy - 11 * s)
    r_eave_back = (hx - 27 * s * dir_x, hy - 24 * s)
    r_peak_front = (hx + 10 * s * dir_x, hy - 46 * s)
    r_peak_back = (hx - 15 * s * dir_x, hy - 58 * s)
    r_far_eave = (hx + 23 * s * dir_x, hy - 25 * s)

    # Far roof rim
    draw_poly_face(ctx, [r_peak_front, p_top_right, r_far_eave], roof_shd,
                   edge_rgba=(1.0, 1.0, 1.0, 0.35), edge_w=0.8)
    # Main sunlit roof slope
    draw_poly_face(ctx, [r_eave_back, r_eave_front, r_peak_front, r_peak_back], roof_hi,
                   edge_rgba=(1.0, 1.0, 1.0, 0.45), edge_w=0.9)

    # Cute tiny window on gable wall
    wx = hx + 9 * s * dir_x
    wy = hy - 16 * s
    win_pts = [
        (wx - 3.5 * s * dir_x, wy + 2 * s),
        (wx + 3.5 * s * dir_x, wy - 1.5 * s),
        (wx + 3.5 * s * dir_x, wy - 9.5 * s),
        (wx - 3.5 * s * dir_x, wy - 6 * s),
    ]
    draw_poly_face(ctx, win_pts, (125 / 255.0, 145 / 255.0, 185 / 255.0), edge_w=0.5)


def draw_macaron_island(ctx: cairo.Context, cx: float, cy: float, rx: float, ry: float,
                        depth: float, *, seed: int = 1, wireframe: bool = False):
    """
    Renders a hand-crafted v3-style Macaron Low-Poly Floating Island centered at (cx, cy):
    - Multi-faceted fresh Mint-Emerald grass top (#B8F7DC / #9AEFCD / #7CE3BE / #64D2AE)
    - Crisp double-bevel lip (mint grass edge + warm cream cliff rim #EDE4DD / #D5C8C4)
    - Deep faceted Lavender-Amethyst crystal rock cone (#B2A6CE -> #8476A8 -> #584B7A)
    - If wireframe=True, draws clean white blueprint triangulated mesh with CAD nodes!
    """
    rng = np.random.RandomState(seed)

    # 8 outer rim angles around the isometric ellipse
    # Index 0 = Left, 1 = Front-Left, 2 = Front-Center-Left, 3 = Front-Center-Right,
    # 4 = Front-Right, 5 = Right, 6 = Back-Right, 7 = Back-Left
    angles_deg = [180, 142, 106, 74, 38, 0, -55, -125]
    top_rim = []
    for i, deg in enumerate(angles_deg):
        rad = math.radians(deg)
        jx = rng.uniform(-0.03, 0.03) * rx
        jy = rng.uniform(-0.03, 0.03) * ry
        top_rim.append((cx + rx * math.cos(rad) + jx, cy + ry * math.sin(rad) + jy))

    # Grass lip drop (8px) and cream cliff rim drop (18px) for the front-facing vertices (0..5)
    lip_drop = max(5.0, ry * 0.08)
    cliff_drop = max(12.0, ry * 0.19)
    lip_rim = [(px, py + lip_drop) for (px, py) in top_rim]
    cliff_rim = [(px * 0.99 + cx * 0.01, py + cliff_drop) for (px, py) in top_rim]

    # Rock cone mid-tier vertices (5 front-facing vertices between Left and Right)
    mid_y = cy + cliff_drop + depth * 0.44
    mid_pts = [
        (cx - rx * 0.68, cy + cliff_drop + depth * 0.34),
        (cx - rx * 0.34, mid_y + depth * 0.04),
        (cx + rx * 0.02, mid_y - depth * 0.03),
        (cx + rx * 0.38, mid_y + depth * 0.05),
        (cx + rx * 0.68, cy + cliff_drop + depth * 0.32),
    ]

    # Bottom main crystal apex + 2 secondary side crystal tips (like v3!)
    apex_main = (cx - rx * 0.02, cy + cliff_drop + depth)
    apex_left = (cx - rx * 0.36, cy + cliff_drop + depth * 0.72)
    apex_right = (cx + rx * 0.38, cy + cliff_drop + depth * 0.68)

    # Inner grass triangulation points (for multi-faceted mint top)
    in_pts = [
        (cx - rx * 0.42, cy - ry * 0.12),
        (cx + rx * 0.02, cy - ry * 0.32),
        (cx + rx * 0.44, cy - ry * 0.10),
        (cx - rx * 0.22, cy + ry * 0.34),
        (cx + rx * 0.26, cy + ry * 0.32),
        (cx, cy + ry * 0.04),
    ]

    # Rock facets list: (pts, rgb)
    rock_facets = [
        # Upper rock band (from cliff_rim[0..5] to mid_pts[0..4])
        ([cliff_rim[0], cliff_rim[1], mid_pts[0]], (182 / 255.0, 170 / 255.0, 212 / 255.0)),
        ([cliff_rim[1], mid_pts[1], mid_pts[0]], (164 / 255.0, 152 / 255.0, 198 / 255.0)),
        ([cliff_rim[1], cliff_rim[2], mid_pts[1]], (152 / 255.0, 138 / 255.0, 186 / 255.0)),
        ([cliff_rim[2], mid_pts[2], mid_pts[1]], (140 / 255.0, 126 / 255.0, 176 / 255.0)),
        ([cliff_rim[2], cliff_rim[3], mid_pts[2]], (132 / 255.0, 118 / 255.0, 168 / 255.0)),
        ([cliff_rim[3], mid_pts[3], mid_pts[2]], (118 / 255.0, 104 / 255.0, 154 / 255.0)),
        ([cliff_rim[3], cliff_rim[4], mid_pts[3]], (110 / 255.0, 96 / 255.0, 146 / 255.0)),
        ([cliff_rim[4], mid_pts[4], mid_pts[3]], (98 / 255.0, 84 / 255.0, 134 / 255.0)),
        ([cliff_rim[4], cliff_rim[5], mid_pts[4]], (88 / 255.0, 74 / 255.0, 124 / 255.0)),

        # Lower rock crystal cones (from mid_pts to apex_left, apex_main, apex_right)
        ([mid_pts[0], mid_pts[1], apex_left], (156 / 255.0, 142 / 255.0, 190 / 255.0)),
        ([mid_pts[1], apex_main, apex_left], (136 / 255.0, 122 / 255.0, 172 / 255.0)),
        ([mid_pts[1], mid_pts[2], apex_main], (124 / 255.0, 110 / 255.0, 160 / 255.0)),
        ([mid_pts[2], mid_pts[3], apex_main], (102 / 255.0, 88 / 255.0, 138 / 255.0)),
        ([mid_pts[3], apex_right, apex_main], (90 / 255.0, 76 / 255.0, 126 / 255.0)),
        ([mid_pts[3], mid_pts[4], apex_right], (80 / 255.0, 68 / 255.0, 116 / 255.0)),
    ]

    # Top grass triangles: (pts, rgb)
    m1 = (186 / 255.0, 248 / 255.0, 222 / 255.0)  # bright sunlit mint
    m2 = (162 / 255.0, 240 / 255.0, 210 / 255.0)  # fresh mint
    m3 = (138 / 255.0, 230 / 255.0, 198 / 255.0)  # mid mint
    m4 = (116 / 255.0, 218 / 255.0, 184 / 255.0)  # cool mint
    grass_facets = [
        ([top_rim[7], top_rim[0], in_pts[0]], m1),
        ([top_rim[7], in_pts[0], in_pts[1]], m2),
        ([top_rim[6], top_rim[7], in_pts[1]], m1),
        ([top_rim[6], in_pts[1], in_pts[2]], m3),
        ([top_rim[5], top_rim[6], in_pts[2]], m4),
        ([top_rim[0], top_rim[1], in_pts[0]], m2),
        ([top_rim[1], in_pts[3], in_pts[0]], m1),
        ([in_pts[0], in_pts[3], in_pts[5]], m2),
        ([in_pts[0], in_pts[5], in_pts[1]], m1),
        ([in_pts[1], in_pts[5], in_pts[2]], m3),
        ([in_pts[5], in_pts[3], in_pts[4]], m3),
        ([in_pts[5], in_pts[4], in_pts[2]], m2),
        ([top_rim[1], top_rim[2], in_pts[3]], m3),
        ([top_rim[2], top_rim[3], in_pts[3]], m2),
        ([top_rim[3], in_pts[4], in_pts[3]], m4),
        ([top_rim[3], top_rim[4], in_pts[4]], m3),
        ([top_rim[4], in_pts[2], in_pts[4]], m4),
        ([top_rim[4], top_rim[5], in_pts[2]], m3),
    ]

    if wireframe:
        # Clean white CAD wireframe mesh for the blueprint half!
        ctx.save()
        ctx.set_source_rgba(0.92, 0.98, 1.0, 0.90)
        ctx.set_line_width(1.2)
        for pts, _ in rock_facets + grass_facets:
            ctx.move_to(pts[0][0], pts[0][1])
            for p in pts[1:]:
                ctx.line_to(p[0], p[1])
            ctx.close_path()
        # Lip & cliff edges
        for i in range(5):
            ctx.move_to(top_rim[i][0], top_rim[i][1])
            ctx.line_to(cliff_rim[i][0], cliff_rim[i][1])
            ctx.line_to(cliff_rim[i + 1][0], cliff_rim[i + 1][1])
        ctx.stroke()

        # CAD vertex nodes
        ctx.set_source_rgba(1.0, 1.0, 1.0, 0.95)
        for vx, vy in top_rim + mid_pts + [apex_main, apex_left, apex_right]:
            ctx.new_path()
            ctx.arc(vx, vy, 2.2, 0, 2 * math.pi)
            ctx.fill()
        ctx.restore()
        return

    # 1. Soft atmospheric shadow below the island in the sky
    ctx.save()
    ctx.translate(cx, cy + cliff_drop + depth * 0.85)
    ctx.scale(rx * 0.72, ry * 0.35)
    shd = cairo.RadialGradient(0, 0, 0.1, 0, 0, 1.0)
    shd.add_color_stop_rgba(0.0, 0.48, 0.40, 0.68, 0.24)
    shd.add_color_stop_rgba(1.0, 0.55, 0.48, 0.75, 0.0)
    ctx.set_source(shd)
    ctx.arc(0, 0, 1.0, 0, 2 * math.pi)
    ctx.fill()
    ctx.restore()

    # 2. Render Lavender-Amethyst Crystal Rock Cone Facets
    for pts, col in rock_facets:
        draw_poly_face(ctx, pts, col, edge_rgba=(1.0, 1.0, 1.0, 0.18), edge_w=0.8)

    # 3. Render Cream/Warm-Stone Cliff Rim Band (between lip_rim and cliff_rim)
    cliff_cols = [
        (242 / 255.0, 234 / 255.0, 228 / 255.0),
        (232 / 255.0, 222 / 255.0, 216 / 255.0),
        (220 / 255.0, 208 / 255.0, 204 / 255.0),
        (206 / 255.0, 194 / 255.0, 192 / 255.0),
        (192 / 255.0, 180 / 255.0, 182 / 255.0),
    ]
    for i in range(5):
        quad = [lip_rim[i], lip_rim[i + 1], cliff_rim[i + 1], cliff_rim[i]]
        draw_poly_face(ctx, quad, cliff_cols[i], edge_rgba=(1.0, 1.0, 1.0, 0.25), edge_w=0.7)

    # 4. Render Mint Grass Bevel Lip (between top_rim and lip_rim)
    lip_cols = [
        (146 / 255.0, 232 / 255.0, 200 / 255.0),
        (128 / 255.0, 220 / 255.0, 188 / 255.0),
        (112 / 255.0, 208 / 255.0, 176 / 255.0),
        (96 / 255.0, 196 / 255.0, 164 / 255.0),
        (82 / 255.0, 182 / 255.0, 150 / 255.0),
    ]
    for i in range(5):
        quad = [top_rim[i], top_rim[i + 1], lip_rim[i + 1], lip_rim[i]]
        draw_poly_face(ctx, quad, lip_cols[i], edge_rgba=(1.0, 1.0, 1.0, 0.25), edge_w=0.6)

    # 5. Render Multi-Faceted Mint-Emerald Grass Top Platform
    for pts, col in grass_facets:
        draw_poly_face(ctx, pts, col, edge_rgba=(1.0, 1.0, 1.0, 0.28), edge_w=0.8)


def draw_starlight_pillar(ctx: cairo.Context, px: float, py_base: float):
    """
    Renders the radiant vertical Starlight Pillar (通天白金星光升降柱) rising from
    (px, py_base) on the center of the main island straight up to y = 0!
    """
    ctx.save()

    # 1. Glowing Magic / Drafting Base Ellipses on the Island Surface
    for rx, ry, alpha in [(56, 25, 0.25), (38, 17, 0.48), (22, 10, 0.85)]:
        ctx.save()
        ctx.translate(px, py_base)
        ctx.scale(rx, ry)
        ctx.new_path()
        ctx.arc(0, 0, 1.0, 0, 2 * math.pi)
        ctx.set_source_rgba(1.0, 0.97, 0.92, alpha)
        ctx.fill()
        ctx.restore()

    # Crisp perspective ring around the pillar base
    ctx.save()
    ctx.translate(px, py_base)
    ctx.scale(1.0, 0.45)
    ctx.new_path()
    ctx.arc(0, 0, 44.0, 0, 2 * math.pi)
    ctx.set_source_rgba(1.0, 1.0, 1.0, 0.90)
    ctx.set_line_width(2.0)
    ctx.stroke()
    ctx.restore()

    # 2. Outer Soft Pastel Pink-Gold Vertical Aura
    aura_w = 42.0
    aura = cairo.LinearGradient(px - aura_w, 0, px + aura_w, 0)
    aura.add_color_stop_rgba(0.00, 1.0, 0.82, 0.92, 0.0)
    aura.add_color_stop_rgba(0.30, 1.0, 0.88, 0.92, 0.28)
    aura.add_color_stop_rgba(0.50, 1.0, 0.98, 0.95, 0.65)
    aura.add_color_stop_rgba(0.70, 1.0, 0.88, 0.92, 0.28)
    aura.add_color_stop_rgba(1.00, 1.0, 0.82, 0.92, 0.0)
    ctx.set_source(aura)
    ctx.rectangle(px - aura_w, 0, aura_w * 2.0, py_base)
    ctx.fill()

    # 3. Core Brilliant White-Gold Vertical Beam
    core_w = 10.0
    core = cairo.LinearGradient(px - core_w, 0, px + core_w, 0)
    core.add_color_stop_rgba(0.00, 1.0, 0.96, 0.88, 0.0)
    core.add_color_stop_rgba(0.28, 1.0, 0.99, 0.95, 0.88)
    core.add_color_stop_rgba(0.50, 1.0, 1.00, 1.00, 1.00)
    core.add_color_stop_rgba(0.72, 1.0, 0.99, 0.95, 0.88)
    core.add_color_stop_rgba(1.00, 1.0, 0.96, 0.88, 0.0)
    ctx.set_source(core)
    ctx.rectangle(px - core_w, 0, core_w * 2.0, py_base)
    ctx.fill()

    # 4. Rising Sparkles & Light Motes along the Starlight Pillar
    spark_pts = [
        (px - 18, py_base - 35, 6.5),
        (px + 20, py_base - 75, 5.5),
        (px - 14, py_base - 135, 7.0),
        (px + 16, py_base - 195, 5.0),
        (px - 22, py_base - 265, 6.0),
        (px + 14, py_base - 335, 6.5),
        (px - 12, py_base - 405, 5.5),
    ]
    for sx, sy, sr in spark_pts:
        draw_four_point_star(ctx, sx, sy, outer_r=sr, inner_r=sr * 0.25)
        ctx.set_source_rgba(1.0, 0.96, 0.88, 0.92)
        ctx.fill()

    ctx.restore()


def draw_landing_perspective_ripples(ctx: cairo.Context, ground_cx: float, ground_cy: float):
    """
    Draws concentric perspective ellipse drafting ripples around the 3D Slime's
    landing point on the Hero Floating Island.
    """
    ctx.save()
    iso_y_scale = 0.48

    # Inner crisp impact ellipse
    for r_ell, lw, alpha, dashed in [
        (46.0, 2.2, 0.92, False),
        (78.0, 1.5, 0.72, True),
    ]:
        ctx.save()
        ctx.translate(ground_cx, ground_cy)
        ctx.scale(1.0, iso_y_scale)
        if dashed:
            ctx.set_dash([5.0 / iso_y_scale, 4.0 / iso_y_scale])
        ctx.new_path()
        ctx.arc(0, 0, r_ell, 0, 2 * math.pi)
        ctx.set_source_rgba(1.0, 1.0, 1.0, alpha)
        ctx.set_line_width(lw / iso_y_scale)
        ctx.stroke()
        ctx.restore()

    # Radial compass ticks on inner ellipse
    ctx.save()
    ctx.translate(ground_cx, ground_cy)
    ctx.scale(1.0, iso_y_scale)
    ctx.set_source_rgba(1.0, 1.0, 1.0, 0.85)
    ctx.set_line_width(1.4 / iso_y_scale)
    for i in range(12):
        a = i * (math.pi / 6.0)
        ctx.move_to(43.0 * math.cos(a), 43.0 * math.sin(a))
        ctx.line_to(53.0 * math.cos(a), 53.0 * math.sin(a))
    ctx.stroke()
    ctx.restore()

    ctx.restore()


# -----------------------------------------------------------------------------
# 6. Wavy Boundary Line & Full-Sheet Engineering Border Frame
# -----------------------------------------------------------------------------

def draw_boundary_wavefront(ctx: cairo.Context, offset_x: float = 0.0):
    """
    Draws the hand-drawn torn-blueprint / scanning wavefront curve separating
    the Left Prussian Blue Blueprint from the Right 3D Macaron Sky:
    - Soft right-side drop shadow
    - Main 3.2px crisp white irregular boundary curve
    - Secondary inner blueprint contour line with small CAD triangles & ticks
    """
    ctx.save()
    steps = 216

    # 1. Soft right-side drop shadow along the boundary
    ctx.new_path()
    for i in range(steps + 1):
        yy = (i / steps) * H
        xx = boundary_x_at_y(yy, offset_x) + 5.0
        if i == 0:
            ctx.move_to(xx, yy)
        else:
            ctx.line_to(xx, yy)
    ctx.set_source_rgba(0.14, 0.12, 0.32, 0.22)
    ctx.set_line_width(12.0)
    ctx.stroke()

    # 2. Secondary thin white drafting contour slightly to the left (inside blueprint)
    ctx.new_path()
    for i in range(steps + 1):
        yy = (i / steps) * H
        xx = boundary_x_at_y(yy, offset_x) - 10.0 + 2.5 * math.sin(yy * 0.07)
        if i == 0:
            ctx.move_to(xx, yy)
        else:
            ctx.line_to(xx, yy)
    ctx.set_source_rgba(0.80, 0.93, 1.0, 0.72)
    ctx.set_line_width(1.1)
    ctx.stroke()

    # Small CAD triangles & tick marks along the boundary
    ctx.set_source_rgba(0.88, 0.96, 1.0, 0.85)
    ctx.set_line_width(1.1)
    for yy in range(85, H - 60, 115):
        bx = boundary_x_at_y(yy, offset_x)
        # Small triangle pointing left into blueprint
        ctx.move_to(bx - 14.0, yy)
        ctx.line_to(bx - 22.0, yy - 4.5)
        ctx.line_to(bx - 22.0, yy + 4.5)
        ctx.close_path()
    ctx.stroke()

    # 3. Main crisp white torn-paper / scanning wavefront curve
    ctx.new_path()
    for i in range(steps + 1):
        yy = (i / steps) * H
        xx = boundary_x_at_y(yy, offset_x)
        if i == 0:
            ctx.move_to(xx, yy)
        else:
            ctx.line_to(xx, yy)
    ctx.set_source_rgba(1.0, 1.0, 1.0, 0.98)
    ctx.set_line_width(3.2)
    ctx.stroke()

    ctx.restore()


def draw_engineering_sheet_frame(ctx: cairo.Context, side: str):
    """
    Draws the standard engineering drawing double-border frame across the full
    1920x1080 sheet (8 columns along top/bottom, 4 rows A..D along left/right).
    - On the 'left' (blueprint) side: crisp cyan-white lines.
    - On the 'right' (3D macaron sky) side: delicate lavender-indigo lines.
    """
    ctx.save()
    if side == "left":
        ctx.set_source_rgba(0.80, 0.92, 1.0, 0.82)
    else:
        ctx.set_source_rgba(0.42, 0.38, 0.68, 0.48)

    # Outer border [26, 18, 1894, 1062] and inner border [44, 36, 1876, 1044]
    ctx.set_line_width(1.6)
    ctx.rectangle(26, 18, W - 52, H - 36)
    ctx.stroke()

    ctx.set_line_width(1.2)
    ctx.rectangle(44, 36, W - 88, H - 72)
    ctx.stroke()

    # Column dividers (8 columns across 44 .. 1876)
    col_w = (W - 88) / 8.0
    for c in range(1, 8):
        cx_div = 44.0 + c * col_w
        # Top border tick
        ctx.move_to(cx_div, 18)
        ctx.line_to(cx_div, 36)
        # Bottom border tick
        ctx.move_to(cx_div, H - 36)
        ctx.line_to(cx_div, H - 18)

    # Row dividers (4 rows across 36 .. 1044)
    row_h = (H - 72) / 4.0
    for r in range(1, 4):
        ry_div = 36.0 + r * row_h
        # Left border tick
        ctx.move_to(26, ry_div)
        ctx.line_to(44, ry_div)
        # Right border tick
        ctx.move_to(W - 44, ry_div)
        ctx.line_to(W - 26, ry_div)
    ctx.stroke()
    ctx.restore()


# -----------------------------------------------------------------------------
# 7. Blueprint Typography & Bottom-Left Engineering Title Block (PIL FreeType)
# -----------------------------------------------------------------------------

def draw_blueprint_typography_and_title_block(draw: ImageDraw.Draw, ox: float = 0.0):
    """
    Renders crisp engineering labels, coordinate frame numbers/letters,
    section/elevation annotations, polar compass degree labels, and the
    Bottom-Left Standard Engineering Title Block (matching v3!).
    Note: Per v5 rules, NO top-left UI title is drawn.
    """
    font_coord = get_font(12)
    font_dim = get_font(13)
    font_sec_title = get_font(16)
    font_sec_sub = get_font(14)
    font_title = get_font(21)
    font_num_big = get_font(24)
    font_sub = get_font(11)
    font_val = get_font(13)

    # 1. Outer Frame Coordinate Numbers (8 7 6 5 4 3 2 1) & Letters (A B C D)
    col_w = (W - 88) / 8.0
    for idx, label in enumerate(["8", "7", "6", "5", "4", "3", "2", "1"]):
        tx = int(44 + (idx + 0.5) * col_w - 4)
        col_top = (195, 228, 255) if tx < boundary_x_at_y(25, ox) else (115, 105, 168)
        col_bot = (195, 228, 255) if tx < boundary_x_at_y(H - 25, ox) else (115, 105, 168)
        draw.text((tx, 20), label, fill=col_top, font=font_coord)
        draw.text((tx, H - 34), label, fill=col_bot, font=font_coord)

    row_h = (H - 72) / 4.0
    for idx, label in enumerate(["A", "B", "C", "D"]):
        ty = int(36 + (idx + 0.5) * row_h - 7)
        draw.text((31, ty), label, fill=(195, 228, 255), font=font_coord)
        draw.text((W - 39, ty), label, fill=(115, 105, 168), font=font_coord)

    # 2. Top-Left Orthographic Island Section Labels (SECTION A-A)
    ix = int(ox)
    draw.text((ix + 262, 184), "Ø 3600", fill=(235, 246, 255), font=font_dim)
    draw.text((ix + 478, 384), "2050", fill=(235, 246, 255), font=font_dim)
    draw.text((ix + 115, 504), "SECTION A-A", fill=(245, 250, 255), font=font_sec_title)
    draw.text((ix + 115, 526), "浮空岛 · 正交剖面 1:50", fill=(185, 225, 255), font=font_sec_sub)

    # 3. Bottom-Left Building Elevation Labels
    draw.text((ix + 125, 860), "1200", fill=(195, 230, 255), font=font_coord)
    draw.text((ix + 330, 860), "1050", fill=(195, 230, 255), font=font_coord)
    draw.text((ix + 408, 860), "ELEVATION E-1", fill=(215, 238, 255), font=font_coord)

    # 4. Polar Compass Ring & Slime Specification Labels around (726, 556)
    pcx, pcy = int(ox + 726), 556
    # Axis labels
    draw.text((pcx + 6, 314), "Z", fill=(240, 248, 255), font=font_dim)
    draw.text((pcx - 155, 672), "Y", fill=(240, 248, 255), font=font_dim)
    draw.text((pcx + 148, 672), "X", fill=(240, 248, 255), font=font_dim)
    draw.text((pcx - 24, 686), "(0,0,0)", fill=(235, 246, 255), font=font_dim)

    # Degree labels around the compass ring (r ≈ 162)
    deg_labels = [
        (120, "120°", -16, -12),
        (150, "150°", -28, -8),
        (180, "180°", -30, -6),
        (60,  "60°",   6, -12),
        (30,  "30°",   8, -8),
        (0,   "0°",    8, -6),
    ]
    for deg_ang, d_txt, dx_o, dy_o in deg_labels:
        rad = math.radians(-deg_ang)
        lx = int(pcx + 156 * math.cos(rad) + dx_o)
        ly = int(pcy + 156 * math.sin(rad) + dy_o)
        draw.text((lx, ly), d_txt, fill=(215, 238, 255), font=font_coord)

    # Callout texts
    draw.text((pcx + 135, pcy - 120), "FAR EYE 81%", fill=(240, 248, 255), font=font_dim)
    draw.text((pcx + 108, pcy - 22), "-30°", fill=(230, 244, 255), font=font_coord)
    draw.text((pcx - 196, pcy + 74), "R 120", fill=(245, 250, 255), font=font_sec_title)
    draw.text((pcx - 196, pcy + 94), "sx=1/√sy", fill=(195, 228, 255), font=font_coord)

    # =========================================================================
    # 5. Bottom-Left Standard Engineering Title Block (图签栏)
    # =========================================================================
    tb_x0, tb_y0 = ix + 56, 886
    tb_w, tb_h = 560, 146
    border_col = (225, 242, 255)
    line_col = (145, 198, 248)
    fill_col = (10, 28, 62)

    draw.rectangle([tb_x0, tb_y0, tb_x0 + tb_w, tb_y0 + tb_h],
                   fill=fill_col, outline=border_col, width=2)
    draw.rectangle([tb_x0 + 3, tb_y0 + 3, tb_x0 + tb_w - 3, tb_y0 + tb_h - 3],
                   outline=line_col, width=1)

    y_r1 = tb_y0 + 44
    y_r2 = y_r1 + 24
    y_r3 = y_r2 + 38
    draw.line([tb_x0 + 3, y_r1, tb_x0 + tb_w - 3, y_r1], fill=border_col, width=1)
    draw.line([tb_x0 + 3, y_r2, tb_x0 + tb_w - 3, y_r2], fill=line_col, width=1)
    draw.line([tb_x0 + 3, y_r3, tb_x0 + tb_w - 3, y_r3], fill=line_col, width=1)

    # Vertical divider for '05' badge in Row 1
    x_badge = tb_x0 + tb_w - 72
    draw.line([x_badge, tb_y0 + 3, x_badge, y_r1], fill=border_col, width=2)

    # Vertical dividers for Row 3 & Row 4
    x_c1 = tb_x0 + 205
    x_c2 = tb_x0 + 385
    draw.line([x_c1, y_r2, x_c1, tb_y0 + tb_h - 3], fill=line_col, width=1)
    draw.line([x_c2, y_r2, x_c2, tb_y0 + tb_h - 3], fill=line_col, width=1)

    # Row 1: Main Title + '05'
    draw.text((tb_x0 + 14, tb_y0 + 10), "GEMINI 4 · 星芒史莱姆  剖面图",
              fill=(255, 255, 255), font=font_title)
    draw.text((x_badge + 18, tb_y0 + 8), "05", fill=(255, 255, 255), font=font_num_big)

    # Row 2: Subtitle
    draw.text((tb_x0 + 14, y_r1 + 5),
              "STAR-SPARK SLIME  ·  ORTHOGRAPHIC  →  ISOMETRIC EXTRUSION",
              fill=(185, 225, 255), font=font_sub)

    # Row 3: DWG NO. | SCALE | SHEET
    draw.text((tb_x0 + 10, y_r2 + 4), "DWG NO.", fill=(140, 195, 245), font=font_sub)
    draw.text((tb_x0 + 88, y_r2 + 16), "GM4-05-ISO", fill=(245, 250, 255), font=font_val)

    draw.text((x_c1 + 10, y_r2 + 4), "SCALE", fill=(140, 195, 245), font=font_sub)
    draw.text((x_c1 + 110, y_r2 + 16), "1 : 1", fill=(245, 250, 255), font=font_val)

    draw.text((x_c2 + 10, y_r2 + 4), "SHEET", fill=(140, 195, 245), font=font_sub)
    draw.text((x_c2 + 105, y_r2 + 16), "05 / 06", fill=(245, 250, 255), font=font_val)

    # Row 4: PROJ. | DRAWN | DATE
    draw.text((tb_x0 + 10, y_r3 + 4), "PROJ.", fill=(140, 195, 245), font=font_sub)
    draw.text((tb_x0 + 108, y_r3 + 16), "ISO 30°", fill=(245, 250, 255), font=font_val)

    draw.text((x_c1 + 10, y_r3 + 4), "DRAWN", fill=(140, 195, 245), font=font_sub)
    draw.text((x_c1 + 95, y_r3 + 16), "GEMINI-4", fill=(245, 250, 255), font=font_val)

    draw.text((x_c2 + 10, y_r3 + 4), "DATE", fill=(140, 195, 245), font=font_sub)
    draw.text((x_c2 + 82, y_r3 + 16), "2026-10-15", fill=(245, 250, 255), font=font_val)


# -----------------------------------------------------------------------------
# 8. World & Keyframe Render Functions (Contract Functions)
# -----------------------------------------------------------------------------

_BLUEPRINT_BG_CACHE = None


def render_world(cam_x: float, cam_y: float, t: float, state: dict = None) -> Image.Image:
    """
    Renders the World 05 viewport at (cam_x, cam_y) at time t.
    Deterministic: identical (cam_x, cam_y, t, state) always yields identical output.
    """
    global _BLUEPRINT_BG_CACHE
    if state is None:
        state = {}

    if _BLUEPRINT_BG_CACHE is None:
        _BLUEPRINT_BG_CACHE = make_blueprint_surface(W, H)

    # Support both keyframe default (cam_x == 2100.0 or 0.0) and scrolling camera
    ref_cam_x = state.get("ref_cam_x", 2100.0 if abs(cam_x - 2100.0) < 1e-3 else 0.0)
    ox = -(cam_x - ref_cam_x) * 0.25 if abs(cam_x - ref_cam_x) > 1.0 else 0.0

    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surface)

    # =========================================================================
    # A. RIGHT SIDE (x >= boundary_x_at_y): Pastel Sky + 3D Macaron Islands
    # =========================================================================
    ctx.save()
    build_boundary_clip_path(ctx, side="right", width=W, height=H, offset_x=ox)
    ctx.clip()

    # 1. Dreamy Lavender -> Sakura Pink Sky with White Isometric Grid
    draw_pastel_macaron_sky(ctx, W, H)

    # 2. Island 1 (Top-Left Split Island at cx=1030, cy=258 — Right Half in 3D Macaron!)
    isl1_x, isl1_y = 1030.0 + ox, 258.0
    draw_macaron_island(ctx, isl1_x, isl1_y, rx=108.0, ry=46.0, depth=92.0, seed=11, wireframe=False)
    draw_lowpoly_cherry_tree(ctx, isl1_x + 8.0, isl1_y - 12.0, scale=0.92, wireframe=False)
    draw_lowpoly_pine_tree(ctx, isl1_x + 48.0, isl1_y + 4.0, scale=0.78, wireframe=False)

    # 3. Island 2 (Top-Right Distant Island at cx=1715, cy=252)
    isl2_x, isl2_y = 1715.0 + ox, 252.0
    draw_macaron_island(ctx, isl2_x, isl2_y, rx=122.0, ry=52.0, depth=104.0, seed=22, wireframe=False)
    draw_lowpoly_cherry_tree(ctx, isl2_x - 8.0, isl2_y - 18.0, scale=0.82, wireframe=False)
    draw_lowpoly_cottage(ctx, isl2_x - 36.0, isl2_y - 2.0, scale=0.76, roof_style="blue")
    draw_lowpoly_pine_tree(ctx, isl2_x + 42.0, isl2_y - 6.0, scale=0.75, wireframe=False)
    draw_lowpoly_pine_tree(ctx, isl2_x + 18.0, isl2_y + 12.0, scale=0.62, wireframe=False)

    # 4. Island 3 (Bottom-Left Foreground Small Island at cx=1212, cy=868)
    isl3_x, isl3_y = 1212.0 + ox, 868.0
    draw_macaron_island(ctx, isl3_x, isl3_y, rx=104.0, ry=46.0, depth=94.0, seed=33, wireframe=False)
    draw_lowpoly_pine_tree(ctx, isl3_x - 28.0, isl3_y - 16.0, scale=0.80, wireframe=False)
    draw_lowpoly_cottage(ctx, isl3_x + 2.0, isl3_y - 6.0, scale=0.74, roof_style="pink")
    draw_lowpoly_Pine_or_Sakura = draw_lowpoly_cherry_tree
    draw_lowpoly_Pine_or_Sakura(ctx, isl3_x - 38.0, isl3_y + 6.0, scale=0.68, wireframe=False)
    draw_lowpoly_pine_tree(ctx, isl3_x + 42.0, isl3_y - 4.0, scale=0.72, wireframe=False)

    # 5. Island 4 (Center-Right Hero Main Floating Island at cx=1486, cy=542)
    isl4_x, isl4_y = 1486.0 + ox, 542.0
    draw_macaron_island(ctx, isl4_x, isl4_y, rx=228.0, ry=98.0, depth=195.0, seed=44, wireframe=False)

    # Back trees & cottages on the Hero Main Island (matching v3's village layout!)
    draw_lowpoly_pine_tree(ctx, isl4_x - 42.0, isl4_y - 58.0, scale=1.15, wireframe=False)
    draw_lowpoly_pine_tree(ctx, isl4_x + 36.0, isl4_y - 54.0, scale=0.95, wireframe=False)
    draw_lowpoly_cottage(ctx, isl4_x + 8.0, isl4_y - 38.0, scale=0.88, roof_style="yellow")
    draw_lowpoly_cottage(ctx, isl4_x - 98.0, isl4_y - 14.0, scale=1.08, roof_style="pink")
    draw_lowpoly_cottage(ctx, isl4_x + 88.0, isl4_y - 12.0, scale=0.98, roof_style="blue", flip=True)
    draw_lowpoly_pine_tree(ctx, isl4_x - 162.0, isl4_y - 4.0, scale=0.96, wireframe=False)

    # Center Starlight Pillar rising from (isl4_x, isl4_y - 18) straight up to y=0!
    pillar_x, pillar_y = isl4_x, isl4_y - 18.0
    draw_starlight_pillar(ctx, pillar_x, pillar_y)

    # Foreground trees on the Hero Main Island
    draw_lowpoly_cherry_tree(ctx, isl4_x + 22.0, isl4_y + 42.0, scale=1.02, wireframe=False)
    draw_lowpoly_pine_tree(ctx, isl4_x + 98.0, isl4_y + 34.0, scale=0.92, wireframe=False)
    draw_lowpoly_pine_tree(ctx, isl4_x + 148.0, isl4_y + 8.0, scale=0.72, wireframe=False)

    # 6. Freshly Landed 3D Macaron Slime on the Hero Main Island Front-Left Lawn!
    slime_3d_x = isl4_x - 84.0
    slime_3d_y = isl4_y + 22.0
    squash_y = state.get("squash_y", 0.88)
    draw_landing_perspective_ripples(ctx, slime_3d_x, slime_3d_y + 34.0 * squash_y)

    # Dashed compass trajectory from 3D Slime up to the geometric star ✦ on the Starlight Pillar
    star_3d_x = pillar_x
    star_3d_y = 310.0
    ctx.save()
    ctx.set_source_rgba(1.0, 1.0, 1.0, 0.88)
    ctx.set_line_width(1.8)
    ctx.set_dash([6.0, 5.0])
    ctx.move_to(slime_3d_x + 12.0, slime_3d_y - 28.0)
    ctx.curve_to(slime_3d_x + 25.0, slime_3d_y - 120.0,
                 star_3d_x - 45.0, star_3d_y + 55.0,
                 star_3d_x, star_3d_y)
    ctx.stroke()
    ctx.restore()

    draw_slime(ctx, slime_3d_x, slime_3d_y, radius=38.0,
               squash_y=squash_y, tilt=-0.06,
               look=(0.55, -0.50), eye_mode=state.get("eye_mode", "pill"),
               t=t, mode="solid", draw_shadow=True)

    # Geometric compass star ✦ ascending the Starlight Pillar
    draw_star(ctx, star_3d_x, star_3d_y, r=21.0, rot=-0.12, t=t)

    # Right-side Engineering Border Frame (in delicate lavender-indigo)
    draw_engineering_sheet_frame(ctx, side="right")
    ctx.restore()

    # =========================================================================
    # B. LEFT SIDE (x < boundary_x_at_y): Prussian Blue Cyanotype Blueprint
    # =========================================================================
    ctx.save()
    build_boundary_clip_path(ctx, side="left", width=W, height=H, offset_x=ox)
    ctx.clip()

    # 1. Prussian Blue Cyanotype Mottled Paper Surface
    ctx.set_source_surface(_BLUEPRINT_BG_CACHE, 0, 0)
    ctx.paint()

    # 2. Island 1 Left Half: White Triangular Wireframe Mesh inside the Blueprint!
    draw_macaron_island(ctx, isl1_x, isl1_y, rx=108.0, ry=46.0, depth=92.0, seed=11, wireframe=True)
    draw_lowpoly_cherry_tree(ctx, isl1_x + 8.0, isl1_y - 12.0, scale=0.92, wireframe=True)

    # 3. Blueprint Grids, Orthographic Island Section, Elevations & Polar Cutaway Slime
    draw_blueprint_grids_and_sections(ctx, ox=ox)

    # 4. Left-side Engineering Border Frame (in crisp cyan-white)
    draw_engineering_sheet_frame(ctx, side="left")
    ctx.restore()

    # =========================================================================
    # C. Wavy Torn-Blueprint / Scanning Wavefront Boundary Curve
    # =========================================================================
    draw_boundary_wavefront(ctx, offset_x=ox)

    # =========================================================================
    # D. Convert Cairo Surface to PIL & Overlay Native Engineering Typography
    # =========================================================================
    surface.flush()
    buf = surface.get_data()
    img_np = np.ndarray(shape=(H, W, 4), dtype=np.uint8, buffer=buf)
    img_rgb = Image.fromarray(img_np[:, :, [2, 1, 0]])

    draw = ImageDraw.Draw(img_rgb)
    draw_blueprint_typography_and_title_block(draw, ox=ox)

    return img_rgb


def render_keyframe() -> Image.Image:
    """
    Renders the master v5 keyframe for World 05 (1920x1080).
    """
    state = {
        "squash_y": 0.88,
        "eye_mode": "pill",
        "ref_cam_x": 2100.0,
    }
    return render_world(2100.0, 0.0, 5.8, state)


if __name__ == "__main__":
    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, "style_09_blueprint.png")
    img = render_keyframe()
    img.save(out_path)
    print(f"Saved v5 keyframe: {out_path} ({img.size[0]}x{img.size[1]})")

    # Save lightweight 1280x720 JPEG preview (<150KB) for visual inspection
    preview_path = "/tmp/preview_v5_09.jpg"
    preview_img = img.resize((1280, 720), resample=Image.LANCZOS)
    preview_img.save(preview_path, "JPEG", quality=80)
    print(f"Saved preview JPEG: {preview_path} ({os.path.getsize(preview_path)} bytes)")
