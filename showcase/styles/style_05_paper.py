# -*- coding: utf-8 -*-
"""
Style 04 · 纸雕立体书山谷 (Layered Paper-Cut Pop-up Book & Lantern Canyon)
Unified Style Module for Gemini 4 · StyleHop v5.

Visual Medium & v5 Upgrades:
  1. Complete Pop-Up Book Stage on a Dim Walnut Desk (还原 v3 立体书完整透视舞台外框):
     - Deep walnut wood tabletop with warm ambient vignette.
     - Upright hardcover book backdrop: burgundy cloth cover with gold foil trim + thick creamy-white
       cardstock inner frame + deep twilight royal-purple paper sky with subtle vertical book-spine crease.
     - Horizontal open pop-up book spread: creamy antique cardstock pages with embossed grid fold creases,
       3D folded paper support tabs (折纸支撑卡榫), stacked paper deckle edges, and a central V-shaped
       Book-Spine Lantern Canyon crevice (书脊中缝灯笼峡谷).
  2. Four-Layer Concentric Golden Paper-Cut Sun (四层同心圆暖金模切纸雕日轮):
     - Centered behind the canyon on the twilight backdrop, four concentric warm-golden die-cut paper discs
       with crisp white paper edges, soft inter-layer drop shadows, and central vertical spine fold crease.
  3. Authentic 3D Geometric Origami Paper Cranes (经典 3D 几何折纸千纸鹤):
     - Crisp triangular origami facets with sunlit highlights, warm shadow planes, and white crease lines:
       * 55° upward-sweeping slender folded neck + sharp reverse-fold triangular head and pointed beak.
       * 3D geometric diamond central body.
       * Broad triangular wings sweeping gracefully upward and outward (never pointing downward!).
       * 45° upward-angled slender pointed tail.
     - Three cranes in escort formation: Warm Ivory-Gold lead crane (carrying the Slime on its back saddle),
       Sakura Pink left escort crane, and Celestial Cyan-Blue right escort crane.
  4. Five-Layer Die-Cut Cardstock Slime & Story Landmarks:
     - Plump Slime (diameter ~136px) crafted from 5 diagonally curved die-cut cardstock layers
       (Cerulean Sky Blue -> Azure -> Periwinkle -> Iris Violet -> Dawn Coral Pink) with white cut edges,
       drop shadows, upper-left paper highlight cutout, and pure white stencil eyes (-30° tilt, 81% far eye).
     - Distant paper-cut pagoda on the left ridge, glowing red-gold lanterns across the canyon lit by the
       gold foil star ✦, and the Origami Zoetrope Pavilion (折纸走马灯小亭) on the right cliff ridge.
"""

import os
import sys
import math
import random
import numpy as np
import cairo
from PIL import Image, ImageFilter

# Base library imports
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

try:
    from corelib.math_ops import clamp, lerp, smoothstep
    from corelib.camera import get_font
except ImportError:
    def clamp(v, lo, hi):
        return max(lo, min(hi, v))
    def lerp(a, b, t):
        return a + (b - a) * t
    def smoothstep(edge0, edge1, x):
        t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0)
        return t * t * (3.0 - 2.0 * t)
    def get_font(size):
        from PIL import ImageFont
        return ImageFont.load_default()

# ------------------------------------------------------------------------------
# Viewport and World Coordinates Contract
# ------------------------------------------------------------------------------
W, H = 1920, 1080
WORLD_W, WORLD_H = 7680, 1080

RND_SEED = 20261015
random.seed(RND_SEED)
np.random.seed(RND_SEED)

# ------------------------------------------------------------------------------
# Paper Texture & Drop Shadow Helpers
# ------------------------------------------------------------------------------
_PAPER_NOISE_CACHE = None

def get_paper_noise_texture(width=W, height=H):
    """Generates and caches a subtle cotton paper fiber grain."""
    global _PAPER_NOISE_CACHE
    if _PAPER_NOISE_CACHE is not None and _PAPER_NOISE_CACHE.size == (width, height):
        return _PAPER_NOISE_CACHE

    np.random.seed(RND_SEED)
    noise_base = np.random.normal(128, 12, (height // 2, width // 2)).astype(np.float32)
    im_small = Image.fromarray(np.clip(noise_base, 0, 255).astype(np.uint8), mode="L")
    im_full = im_small.resize((width, height), Image.Resampling.BICUBIC)

    fine_noise = np.random.normal(0, 5, (height, width)).astype(np.float32)
    combined = np.clip(np.array(im_full, dtype=np.float32) + fine_noise, 0, 255).astype(np.uint8)

    _PAPER_NOISE_CACHE = Image.fromarray(combined, mode="L")
    return _PAPER_NOISE_CACHE


def cairo_surface_to_pil(surf: cairo.ImageSurface) -> Image.Image:
    """Converts a Cairo ARGB32 ImageSurface to a Pillow RGBA Image."""
    w, h = surf.get_width(), surf.get_height()
    buf = np.frombuffer(surf.get_data(), dtype=np.uint8).reshape((h, w, 4))
    rgba = buf[:, :, [2, 1, 0, 3]].copy()
    return Image.fromarray(rgba, mode="RGBA")


def pil_to_cairo_surface(img: Image.Image) -> cairo.ImageSurface:
    """Converts a Pillow RGBA Image to a Cairo ARGB32 ImageSurface."""
    rgba = np.array(img.convert("RGBA"), dtype=np.uint8)
    bgra = rgba[:, :, [2, 1, 0, 3]].copy()
    h, w = bgra.shape[:2]
    return cairo.ImageSurface.create_for_data(bgra, cairo.FORMAT_ARGB32, w, h)


def create_blurred_drop_shadow(alpha_mask: Image.Image, dx: float, dy: float, blur_r: float,
                               shadow_rgba=(16, 6, 26, 150)) -> Image.Image:
    """Creates a realistic soft drop shadow from an alpha mask."""
    w, h = alpha_mask.size
    shifted_mask = Image.new("L", (w, h), 0)
    shifted_mask.paste(alpha_mask, (int(round(dx)), int(round(dy))))
    if blur_r > 0:
        shifted_mask = shifted_mask.filter(ImageFilter.GaussianBlur(blur_r))

    r, g, b, a_max = shadow_rgba
    mask_arr = np.array(shifted_mask, dtype=np.float32) / 255.0
    s_rgba = np.zeros((h, w, 4), dtype=np.uint8)
    s_rgba[:, :, 0] = r
    s_rgba[:, :, 1] = g
    s_rgba[:, :, 2] = b
    s_rgba[:, :, 3] = (mask_arr * a_max).astype(np.uint8)

    return Image.fromarray(s_rgba, mode="RGBA")


# ------------------------------------------------------------------------------
# Geometric Utility: Four-Point Concave Sparkle Star (✦)
# ------------------------------------------------------------------------------
def create_four_point_star_path(ctx: cairo.Context, cx: float, cy: float, outer_r: float,
                                inner_r: float = None, rot: float = 0.0):
    """Draws the signature 4-point concave Gemini star sparkle curve."""
    if inner_r is None:
        inner_r = outer_r * 0.28
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


# ------------------------------------------------------------------------------
# Contract API: draw_star (Faceted Gold & Jewel Paper-Cut Sparkle Star ✦)
# ------------------------------------------------------------------------------
def draw_star(ctx: cairo.Context, cx: float, cy: float, r: float, *, rot: float = 0.0,
              t: float = 0.0, **style_kw):
    """
    Renders the 3D faceted paper-cut 4-point sparkle star ✦.
    Features:
      - Warm radiant starlight halo.
      - 8 geometric origami facets around the center catching warm gold, sky blue, and coral tones.
      - Crisp creamy-white die-cut paper outer border and drop shadow.
    """
    ctx.save()

    # 1. Radiant warm starlight halo
    halo_r = r * 3.0
    halo = cairo.RadialGradient(cx, cy, r * 0.12, cx, cy, halo_r)
    halo.add_color_stop_rgba(0.0, 1.00, 0.96, 0.75, 0.72)
    halo.add_color_stop_rgba(0.38, 1.00, 0.82, 0.35, 0.36)
    halo.add_color_stop_rgba(0.75, 0.98, 0.58, 0.20, 0.12)
    halo.add_color_stop_rgba(1.0, 0.95, 0.45, 0.12, 0.0)
    ctx.set_source(halo)
    ctx.arc(cx, cy, halo_r, 0, math.tau)
    ctx.fill()

    inner_r = r * 0.32
    tips = []
    waists = []
    for i in range(4):
        ang_tip = rot + i * (math.pi / 2.0) - math.pi / 2.0
        ang_waist = ang_tip + math.pi / 4.0
        tips.append((cx + r * math.cos(ang_tip), cy + r * math.sin(ang_tip)))
        waists.append((cx + inner_r * math.cos(ang_waist), cy + inner_r * math.sin(ang_waist)))

    # 2. Outer drop shadow
    ctx.save()
    ctx.translate(3.0, 4.5)
    ctx.new_path()
    for i in range(4):
        if i == 0:
            ctx.move_to(tips[i][0], tips[i][1])
        else:
            ctx.line_to(tips[i][0], tips[i][1])
        ctx.line_to(waists[i][0], waists[i][1])
    ctx.close_path()
    ctx.set_source_rgba(0.14, 0.05, 0.16, 0.45)
    ctx.fill()
    ctx.restore()

    # 3. White die-cut outer backing plate
    ctx.new_path()
    for i in range(4):
        if i == 0:
            ctx.move_to(tips[i][0], tips[i][1])
        else:
            ctx.line_to(tips[i][0], tips[i][1])
        ctx.line_to(waists[i][0], waists[i][1])
    ctx.close_path()
    ctx.set_source_rgb(0.99, 0.97, 0.92)
    ctx.set_line_width(max(3.2, r * 0.12))
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    ctx.stroke_preserve()
    ctx.fill()

    # 4. Eight 3D origami facets (matching v3's jewel-toned & gold paper star)
    facet_colors = [
        ((0.42, 0.74, 0.98), (0.28, 0.56, 0.88)),  # Top point: Sky blue / cobalt
        ((0.98, 0.86, 0.42), (0.94, 0.62, 0.32)),  # Right point: Bright gold / amber
        ((0.94, 0.48, 0.58), (0.76, 0.34, 0.58)),  # Bottom point: Coral pink / plum
        ((0.58, 0.48, 0.92), (0.98, 0.88, 0.48)),  # Left point: Iris violet / warm gold
    ]
    for i in range(4):
        tx, ty = tips[i]
        w_prev = waists[(i - 1) % 4]
        w_next = waists[i]
        c_left, c_right = facet_colors[i]

        # Left half-facet of point i
        ctx.new_path()
        ctx.move_to(cx, cy)
        ctx.line_to(w_prev[0], w_prev[1])
        ctx.line_to(tx, ty)
        ctx.close_path()
        ctx.set_source_rgb(*c_left)
        ctx.fill()

        # Right half-facet of point i
        ctx.new_path()
        ctx.move_to(cx, cy)
        ctx.line_to(tx, ty)
        ctx.line_to(w_next[0], w_next[1])
        ctx.close_path()
        ctx.set_source_rgb(*c_right)
        ctx.fill()

    # 5. Crisp white fold ridges
    ctx.set_source_rgba(1.0, 0.99, 0.95, 0.90)
    ctx.set_line_width(max(1.1, r * 0.04))
    for i in range(4):
        ctx.move_to(cx, cy)
        ctx.line_to(tips[i][0], tips[i][1])
        ctx.stroke()
        ctx.move_to(cx, cy)
        ctx.line_to(waists[i][0], waists[i][1])
        ctx.stroke()

    ctx.restore()


# ------------------------------------------------------------------------------
# Geometric Utility: Plump Slime Contour
# ------------------------------------------------------------------------------
def compute_slime_contour_pts(cx: float, cy: float, radius: float, squash_y: float = 1.0,
                              tilt: float = 0.0, n_pts: int = 96):
    """
    Computes a plump, volume-conserving paper-cut silhouette:
    s_x = 1.0 / sqrt(squash_y).
    """
    sy = max(0.35, min(2.5, squash_y))
    sx = 1.0 / math.sqrt(sy)
    r = radius
    pts = []
    cos_t = math.cos(tilt)
    sin_t = math.sin(tilt)

    for i in range(n_pts):
        th = (i / n_pts) * math.tau
        s = math.sin(th)   # -1 at crown, +1 at base
        c = math.cos(th)   # -1 at left, +1 at right

        width_mod = 1.010 + 0.022 * s - 0.008 * (s ** 2)
        height_mod = 0.996 - 0.024 * (max(0.0, s) ** 2.2)

        lx = r * width_mod * c * sx
        ly = r * height_mod * s * sy

        rx = lx * cos_t - ly * sin_t
        ry = lx * sin_t + ly * cos_t
        pts.append((cx + rx, cy + ry))

    return pts


def draw_smooth_closed_path(ctx: cairo.Context, pts: list):
    """Draws a smooth closed Bezier spline through contour points."""
    ctx.new_path()
    n = len(pts)
    for i in range(n):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        mx, my = (x0 + x1) * 0.5, (y0 + y1) * 0.5
        if i == 0:
            ctx.move_to(mx, my)
        else:
            ctx.curve_to(x0, y0, x0, y0, mx, my)
    ctx.close_path()


# ------------------------------------------------------------------------------
# Stencil Die-Cut Capsule / Happy Arc Eyes with Radiant Backlight
# ------------------------------------------------------------------------------
def draw_paper_eye_stencil(ctx: cairo.Context, ex: float, ey: float, w_eye: float,
                           h_eye: float, mode: str, angle: float):
    """
    Draws a single hollowed-out stencil paper-cut eye slot.
    Features an authentic inner paper-cut thickness bevel and radiant pure-white backlight.
    """
    ctx.save()
    ctx.translate(ex, ey)
    ctx.rotate(angle)

    # Subtle warm-white glow around the stencil eye hole
    glow_r = max(w_eye, h_eye) * 1.45
    glow = cairo.RadialGradient(0, 0, w_eye * 0.15, 0, 0, glow_r)
    glow.add_color_stop_rgba(0.0, 1.0, 1.0, 1.0, 0.75)
    glow.add_color_stop_rgba(0.5, 1.0, 0.95, 0.85, 0.28)
    glow.add_color_stop_rgba(1.0, 1.0, 0.85, 0.65, 0.0)
    ctx.set_source(glow)
    ctx.arc(0, 0, glow_r, 0, math.tau)
    ctx.fill()

    hw = max(1.8, w_eye * 0.5)
    hh = max(1.8, h_eye * 0.5)
    dy = max(0.0, hh - hw)

    if mode == "happy":
        arc_r = h_eye * 0.68
        lw = max(3.6, w_eye * 1.08)
        ctx.save()
        ctx.translate(-1.2, -1.5)
        ctx.new_path()
        ctx.arc(0, arc_r * 0.35, arc_r, math.pi * 1.15, math.pi * 1.85)
        ctx.set_source_rgba(0.22, 0.08, 0.28, 0.65)
        ctx.set_line_width(lw + 2.2)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.stroke()
        ctx.restore()

        ctx.new_path()
        ctx.arc(0, arc_r * 0.35, arc_r, math.pi * 1.15, math.pi * 1.85)
        ctx.set_source_rgba(1.0, 1.0, 1.0, 1.0)
        ctx.set_line_width(lw)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.stroke()

    elif mode == "focus":
        flat_w = w_eye * 1.45
        flat_h = w_eye * 0.48
        ctx.save()
        ctx.translate(-1.2, -1.2)
        ctx.rectangle(-flat_w, -flat_h, flat_w * 2, flat_h * 2)
        ctx.set_source_rgba(0.22, 0.08, 0.28, 0.65)
        ctx.fill()
        ctx.restore()

        ctx.rectangle(-flat_w, -flat_h, flat_w * 2, flat_h * 2)
        ctx.set_source_rgba(1.0, 1.0, 1.0, 1.0)
        ctx.fill()

    elif mode == "wince":
        lw = max(2.8, w_eye * 0.95)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.move_to(-w_eye, -h_eye * 0.5)
        ctx.line_to(w_eye * 0.5, 0)
        ctx.line_to(-w_eye, h_eye * 0.5)
        ctx.set_source_rgba(1.0, 1.0, 1.0, 1.0)
        ctx.set_line_width(lw)
        ctx.stroke()

    elif mode == "sparkle":
        create_four_point_star_path(ctx, 0, 0, h_eye * 0.8, w_eye * 0.36)
        ctx.set_source_rgba(1.0, 1.0, 1.0, 1.0)
        ctx.fill()

    else:
        # Default: Pure white stencil capsule pill I (matching v3)
        # Outer dark cut rim + inner paper thickness shadow
        ctx.save()
        ctx.new_path()
        ctx.arc(0, -dy, hw + 1.5, math.pi, 0.0)
        ctx.arc(0, dy, hw + 1.5, 0.0, math.pi)
        ctx.close_path()
        ctx.set_source_rgba(0.20, 0.08, 0.30, 0.72)
        ctx.fill()
        ctx.restore()

        # Pure white backlit capsule core
        ctx.new_path()
        ctx.arc(0, -dy, hw, math.pi, 0.0)
        ctx.arc(0, dy, hw, 0.0, math.pi)
        ctx.close_path()
        ctx.set_source_rgba(1.0, 0.99, 0.97, 1.0)
        ctx.fill()

        # Subtle warm inner paper bevel crescent on the left edge of the slot
        ctx.save()
        ctx.clip()
        ctx.new_path()
        ctx.arc(2.2, -dy + 1.0, hw, math.pi, 0.0)
        ctx.arc(2.2, dy + 1.0, hw, 0.0, math.pi)
        ctx.close_path()
        ctx.set_source_rgba(1.0, 1.0, 1.0, 1.0)
        ctx.fill()
        ctx.restore()

    ctx.restore()


# ------------------------------------------------------------------------------
# Contract API: draw_slime (5-Layer Diagonally Stacked Die-Cut Paper Slime)
# ------------------------------------------------------------------------------
def draw_slime(ctx: cairo.Context, cx: float, cy: float, radius: float, *,
               squash_y: float = 1.0, tilt: float = 0.0,
               look: tuple = (0.38, -0.22), eye_mode: str = "pill",
               blink: float = 0.0, t: float = 0.0, **style_kw):
    """
    Renders the Slime as 5 diagonally curved sheets of die-cut cardstock (matching v3):
      - Layer 1 (Top-Left Crown): Cerulean Sky Blue (#3BA3F8 -> #297FE0) + oval sky-blue paper highlight badge.
      - Layer 2 (Upper-Mid Wave): Deep Azure Blue (#3C6EE8 -> #2D55C4).
      - Layer 3 (Center Wave): Royal Periwinkle Indigo (#5E52E6 -> #4A3ECF).
      - Layer 4 (Lower-Mid Wave): Iris Orchid Violet (#8C4EE6 -> #7436C7).
      - Layer 5 (Bottom-Right Wave): Dawn Coral Pink (#EC647B -> #D4455E).
      - Every sheet has a crisp white paper cut edge and soft inter-layer drop shadow.
      - Thick creamy-white die-cut outer cardstock border around the full silhouette.
      - Strictly mouthless, no nose, no blush, -30° eye tilt, far eye width 81%.
    """
    sy = max(0.4, min(2.4, squash_y))
    sx = 1.0 / math.sqrt(sy)
    r = radius

    # 1. Contact shadow onto the origami crane saddle below
    ctx.save()
    ctx.translate(cx + 2.0, cy + r * 0.94 * sy)
    ctx.scale(sx * r * 1.02, sy * r * 0.26)
    sh_grad = cairo.RadialGradient(0, 0, 0.08, 0, 0, 1.0)
    sh_grad.add_color_stop_rgba(0.0, 0.12, 0.04, 0.18, 0.65)
    sh_grad.add_color_stop_rgba(0.6, 0.12, 0.04, 0.18, 0.28)
    sh_grad.add_color_stop_rgba(1.0, 0.12, 0.04, 0.18, 0.0)
    ctx.set_source(sh_grad)
    ctx.arc(0, 0, 1.0, 0, math.tau)
    ctx.fill()
    ctx.restore()

    base_pts = compute_slime_contour_pts(cx, cy, r, squash_y=sy, tilt=tilt)
    outer_pts = compute_slime_contour_pts(cx, cy, r + 3.6, squash_y=sy, tilt=tilt)

    # 2. Outer Drop Shadow + Thick Creamy-White Cardstock Backing Rim
    ctx.save()
    ctx.save()
    ctx.translate(4.5, 6.0)
    draw_smooth_closed_path(ctx, outer_pts)
    ctx.set_source_rgba(0.12, 0.04, 0.18, 0.48)
    ctx.fill()
    ctx.restore()

    draw_smooth_closed_path(ctx, outer_pts)
    ctx.set_source_rgb(0.99, 0.97, 0.93)  # Creamy-white cardstock rim
    ctx.fill_preserve()
    ctx.set_source_rgba(0.30, 0.16, 0.28, 0.55)
    ctx.set_line_width(1.2)
    ctx.stroke()
    ctx.restore()

    # 3. Five Diagonally Curved Die-Cut Cardstock Layers inside Slime Contour
    ctx.save()
    draw_smooth_closed_path(ctx, base_pts)
    ctx.clip()

    # Layer 1: Full Cerulean Sky Blue Base
    g_l1 = cairo.LinearGradient(cx - r * sx, cy - r * sy, cx + r * 0.4 * sx, cy + r * 0.4 * sy)
    g_l1.add_color_stop_rgb(0.0, 0.25, 0.68, 0.98)  # Bright Cerulean Sky Blue
    g_l1.add_color_stop_rgb(1.0, 0.18, 0.52, 0.90)
    ctx.set_source(g_l1)
    ctx.paint()

    # Upper-Left Paper-Cut Specular Highlight Oval (authentic to v3!)
    ctx.save()
    ctx.translate(cx - r * 0.42 * sx, cy - r * 0.36 * sy)
    ctx.rotate(-0.62)
    # Shadow of highlight badge
    ctx.save()
    ctx.translate(1.8, 2.2)
    ctx.scale(r * 0.30 * sx, r * 0.13 * sy)
    ctx.arc(0, 0, 1.0, 0, math.tau)
    ctx.set_source_rgba(0.08, 0.22, 0.48, 0.38)
    ctx.fill()
    ctx.restore()
    # Badge fill & white cut edge
    ctx.scale(r * 0.30 * sx, r * 0.13 * sy)
    ctx.arc(0, 0, 1.0, 0, math.tau)
    ctx.set_source_rgb(0.56, 0.85, 1.00)
    ctx.fill_preserve()
    ctx.restore()
    ctx.save()
    ctx.translate(cx - r * 0.42 * sx, cy - r * 0.36 * sy)
    ctx.rotate(-0.62)
    ctx.scale(r * 0.30 * sx, r * 0.13 * sy)
    ctx.arc(0, 0, 1.0, 0, math.tau)
    ctx.restore()
    ctx.set_source_rgba(0.99, 0.99, 0.98, 0.92)
    ctx.set_line_width(1.6)
    ctx.stroke()

    # Helper to draw a diagonal curved cardstock wave layer
    def draw_curved_paper_wave(p_start, c1, c2, p_end, c_top, c_bot):
        # Soft drop shadow cast upward-left or downward-right onto previous layer
        ctx.save()
        ctx.translate(-2.2, -2.5)
        ctx.new_path()
        ctx.move_to(p_start[0], p_start[1])
        ctx.curve_to(c1[0], c1[1], c2[0], c2[1], p_end[0], p_end[1])
        ctx.line_to(cx + r * 1.8 * sx, cy + r * 1.8 * sy)
        ctx.line_to(cx - r * 1.8 * sx, cy + r * 1.8 * sy)
        ctx.close_path()
        ctx.set_source_rgba(0.10, 0.04, 0.22, 0.32)
        ctx.fill()
        ctx.restore()

        # Cardstock layer body
        ctx.new_path()
        ctx.move_to(p_start[0], p_start[1])
        ctx.curve_to(c1[0], c1[1], c2[0], c2[1], p_end[0], p_end[1])
        ctx.line_to(cx + r * 1.8 * sx, cy + r * 1.8 * sy)
        ctx.line_to(cx - r * 1.8 * sx, cy + r * 1.8 * sy)
        ctx.close_path()
        grad = cairo.LinearGradient(cx - r * 0.5 * sx, cy - r * 0.3 * sy,
                                    cx + r * sx, cy + r * sy)
        grad.add_color_stop_rgb(0.0, *c_top)
        grad.add_color_stop_rgb(1.0, *c_bot)
        ctx.set_source(grad)
        ctx.fill_preserve()

        # Crisp white die-cut paper edge
        ctx.set_source_rgba(0.99, 0.98, 0.95, 0.94)
        ctx.set_line_width(1.8)
        ctx.stroke()

    # Layer 2: Deep Azure Blue Wave
    draw_curved_paper_wave(
        p_start=(cx - r * 1.25 * sx, cy + r * 0.22 * sy),
        c1=(cx - r * 0.35 * sx, cy + r * 0.42 * sy),
        c2=(cx + r * 0.25 * sx, cy - r * 0.25 * sy),
        p_end=(cx + r * 0.55 * sx, cy - r * 1.15 * sy),
        c_top=(0.24, 0.46, 0.92),
        c_bot=(0.18, 0.36, 0.82),
    )

    # Layer 3: Royal Periwinkle Indigo Wave
    draw_curved_paper_wave(
        p_start=(cx - r * 1.10 * sx, cy + r * 0.56 * sy),
        c1=(cx - r * 0.15 * sx, cy + r * 0.62 * sy),
        c2=(cx + r * 0.45 * sx, cy - r * 0.05 * sy),
        p_end=(cx + r * 0.85 * sx, cy - r * 0.88 * sy),
        c_top=(0.38, 0.34, 0.90),
        c_bot=(0.30, 0.25, 0.80),
    )

    # Layer 4: Iris Orchid Violet Wave
    draw_curved_paper_wave(
        p_start=(cx - r * 0.78 * sx, cy + r * 0.88 * sy),
        c1=(cx + r * 0.08 * sx, cy + r * 0.75 * sy),
        c2=(cx + r * 0.65 * sx, cy + r * 0.18 * sy),
        p_end=(cx + r * 1.08 * sx, cy - r * 0.52 * sy),
        c_top=(0.56, 0.32, 0.88),
        c_bot=(0.45, 0.22, 0.76),
    )

    # Layer 5: Warm Dawn Coral Pink Wave (Lower-Right Crescent)
    draw_curved_paper_wave(
        p_start=(cx - r * 0.32 * sx, cy + r * 1.12 * sy),
        c1=(cx + r * 0.32 * sx, cy + r * 0.82 * sy),
        c2=(cx + r * 0.82 * sx, cy + r * 0.35 * sy),
        p_end=(cx + r * 1.18 * sx, cy - r * 0.12 * sy),
        c_top=(0.93, 0.40, 0.49),
        c_bot=(0.82, 0.28, 0.38),
    )

    ctx.restore()  # End clip to base_pts

    # Inner crisp white cut bevel line around base_pts
    draw_smooth_closed_path(ctx, base_pts)
    ctx.set_source_rgba(1.0, 0.99, 0.95, 0.95)
    ctx.set_line_width(2.2)
    ctx.stroke()

    # 4. Hollowed-out Stencil Eyes with Radiant Backlight (Strictly -30° tilt, far eye 81%)
    gaze_x, gaze_y = look
    gaze_cx = cx + gaze_x * r * 0.38 * sx
    gaze_cy = cy + gaze_y * r * 0.38 * sy

    cant_angle = -math.pi / 6.0  # Strictly -30 degrees
    cos_c, sin_c = math.cos(cant_angle), math.sin(cant_angle)

    effective_mode = eye_mode
    if blink > 0.5 and effective_mode == "pill":
        effective_mode = "focus"

    base_sep = r * 0.24
    w_base = r * 0.145
    h_base = r * 0.305

    for side in (-1, +1):  # -1 = left (near), +1 = right (far)
        is_far_eye = (side == +1)
        persp_w = 0.81 if is_far_eye else 1.0  # Strictly 81% width
        persp_h = 0.90 if is_far_eye else 1.0

        local_dx = side * base_sep * (0.95 if is_far_eye else 1.0)
        local_dy = 0.0

        ex_sphere = local_dx * cos_c - local_dy * sin_c
        ey_sphere = local_dx * sin_c + local_dy * cos_c

        ex = gaze_cx + ex_sphere * math.cos(tilt) - ey_sphere * math.sin(tilt)
        ey = gaze_cy + ex_sphere * math.sin(tilt) + ey_sphere * math.cos(tilt)

        w_eye = w_base * persp_w
        h_eye = h_base * persp_h

        draw_paper_eye_stencil(ctx, ex, ey, w_eye, h_eye, effective_mode, tilt + cant_angle)


# ------------------------------------------------------------------------------
# Authentic 3D Geometric Origami Paper Crane (经典 3D 几何折纸千纸鹤)
# ------------------------------------------------------------------------------
def draw_origami_crane(ctx: cairo.Context, cx: float, cy: float, scale: float, *,
                       tilt: float = 0.0, wing_flap: float = 0.0,
                       color_scheme: str = "white", has_rider: bool = False):
    """
    Renders an authentic 3D geometric origami paper crane (matching v3's iconic origami cranes):
      - Slender folded neck rising forward at ~55° + sharp reverse-fold triangular head & beak.
      - 3D geometric diamond/polyhedral central body with crisp horizontal & vertical fold creases.
      - Broad triangular wings sweeping gracefully UPWARD and outward (never pointing downward!),
        divided into sunlit and warm-shaded paper facets with pure white fold highlights.
      - Slender pointed tail rising rearward at ~45°.
    """
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(tilt)
    ctx.scale(scale, scale)

    # Rich paper color palettes with warm sunlit highlights and deep fold shadows
    if color_scheme == "pink":
        c_bright = (1.00, 0.96, 0.96)
        c_hi     = (0.99, 0.84, 0.86)
        c_mid    = (0.95, 0.64, 0.68)
        c_shd    = (0.85, 0.46, 0.54)
        c_deep   = (0.70, 0.32, 0.42)
    elif color_scheme == "blue":
        c_bright = (0.95, 0.99, 1.00)
        c_hi     = (0.76, 0.90, 0.99)
        c_mid    = (0.48, 0.72, 0.95)
        c_shd    = (0.30, 0.54, 0.84)
        c_deep   = (0.20, 0.38, 0.68)
    else:  # "white" (Warm Ivory-Gold Lead Crane matching v3)
        c_bright = (1.00, 0.99, 0.95)
        c_hi     = (0.99, 0.94, 0.84)
        c_mid    = (0.94, 0.82, 0.65)
        c_shd    = (0.85, 0.68, 0.48)
        c_deep   = (0.72, 0.52, 0.36)

    flap_y = wing_flap * 8.0
    reach = 1.26 if has_rider else 1.0

    # 1. Central 3D Diamond Body Vertices (Lowest point is p_body_bot; NO downward spikes!)
    p_body_top   = (-2.0, -15.0)
    p_body_front = (38.0 * reach, 0.0)
    p_body_bot   = (2.0, 26.0)
    p_body_back  = (-38.0 * reach, 2.0)
    p_body_mid   = (1.0, 5.0)

    # 2. Slender 55° Upward-Sweeping Neck & Sharp Reverse-Fold Head/Beak (+X, -Y)
    p_neck_base_f = p_body_front
    p_neck_base_m = (27.0 * reach, -4.0)
    p_neck_base_b = (16.0 * reach, -10.0)
    p_head_top    = (66.0 * reach, -58.0)
    p_throat      = (70.0 * reach, -39.0)
    p_jaw         = (65.0 * reach, -33.0)
    p_beak        = (100.0 * reach, -40.0)

    # 3. Slender 45° Upward-Angled Pointed Tail (-X, -Y)
    p_tail_base_b = p_body_back
    p_tail_base_m = (-29.0 * reach, -3.0)
    p_tail_base_f = (-18.0 * reach, -9.0)
    p_tail_tip    = (-85.0 * reach, -54.0)

    # 4. Broad Geometric Triangular Wings (Sweeping UPWARD & Outward)
    if has_rider:
        # Spread wings wide to the left and right of the Slime's lower torso
        # so they never poke out like horns above the Slime's top crown!
        p_fw_front = (38.0, -4.0)
        p_fw_back  = (4.0, -14.0)
        p_fw_tip   = (86.0, -64.0 - flap_y * 0.5)
        p_fw_mid   = (52.0, -32.0 - flap_y * 0.3)

        p_nw_front = (26.0, -2.0)
        p_nw_root  = (-12.0, -12.0)
        p_nw_back  = (-40.0, 1.0)
        p_nw_tip   = (-94.0, -68.0 + flap_y * 0.6)
        p_nw_outer = (-76.0, -20.0 + flap_y * 0.4)
    else:
        # Authentic v3 single dominant main wing apex + lower tucked far wing (no rabbit-ear fork!)
        p_fw_front = (30.0, -6.0)
        p_fw_back  = (-4.0, -14.0)
        p_fw_tip   = (20.0, -52.0 - flap_y * 0.5)
        p_fw_mid   = (14.0, -30.0 - flap_y * 0.3)

        p_nw_front = (26.0, -2.0)
        p_nw_root  = (-6.0, -13.0)
        p_nw_back  = (-30.0, 0.0)
        p_nw_tip   = (-14.0, -84.0 + flap_y)
        p_nw_outer = (-54.0, -18.0 + flap_y * 0.5)

    def draw_facet(pts, col_a, col_b=None, stroke_w=1.35):
        ctx.new_path()
        ctx.move_to(pts[0][0], pts[0][1])
        for p in pts[1:]:
            ctx.line_to(p[0], p[1])
        ctx.close_path()
        if col_b is None:
            ctx.set_source_rgb(*col_a)
        else:
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            g = cairo.LinearGradient(min(xs), min(ys), max(xs), max(ys))
            g.add_color_stop_rgb(0.0, *col_a)
            g.add_color_stop_rgb(1.0, *col_b)
            ctx.set_source(g)
        ctx.fill_preserve()
        ctx.set_source_rgba(1.0, 0.99, 0.95, 0.92)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        ctx.set_line_width(stroke_w)
        ctx.stroke()

    # Soft cast shadow beneath the crane
    ctx.save()
    ctx.translate(4.5, 9.0)
    ctx.new_path()
    for p in [p_tail_tip, p_nw_outer, p_body_back, p_body_bot, p_body_front,
              p_beak, p_head_top, p_fw_tip, p_nw_tip]:
        if p is p_tail_tip:
            ctx.move_to(p[0], p[1])
        else:
            ctx.line_to(p[0], p[1])
    ctx.close_path()
    ctx.set_source_rgba(0.12, 0.04, 0.18, 0.30)
    ctx.fill()
    ctx.restore()

    # Layer A: Far Wing (Behind Neck & Saddle)
    draw_facet([p_fw_front, p_fw_tip, p_fw_mid], c_hi, c_mid)
    draw_facet([p_fw_mid, p_fw_tip, p_fw_back], c_shd, c_deep)

    # Layer B: 45° Upward-Sweeping Pointed Tail
    draw_facet([p_tail_base_f, p_tail_base_m, p_tail_tip], c_bright, c_hi)
    draw_facet([p_tail_base_m, p_tail_base_b, p_tail_tip], c_mid, c_shd)

    # Layer C: 55° Upward-Sweeping Slender Neck & Reverse-Fold Beak
    draw_facet([p_neck_base_b, p_neck_base_m, p_head_top], c_bright, c_hi)
    draw_facet([p_neck_base_m, p_neck_base_f, p_throat], c_mid, c_shd)
    draw_facet([p_neck_base_m, p_throat, p_head_top], c_hi, c_mid)
    # Reverse-fold inner shadow & sharp upper beak
    draw_facet([p_head_top, p_throat, p_jaw], c_deep)
    draw_facet([p_throat, p_beak, p_jaw], c_shd, c_deep)
    draw_facet([p_head_top, p_beak, p_throat], c_bright, c_hi)

    # Layer D: Central 3D Diamond Body
    draw_facet([p_body_top, p_body_front, p_body_mid], c_hi, c_mid)
    draw_facet([p_body_top, p_body_mid, p_body_back], c_bright, c_hi)
    draw_facet([p_body_mid, p_body_front, p_body_bot], c_mid, c_shd)
    draw_facet([p_body_mid, p_body_bot, p_body_back], c_shd, c_deep)

    # Layer E: Broad Foreground Near Wing (Sweeping High & Wide, Never Downward!)
    draw_facet([p_nw_root, p_nw_outer, p_nw_back], c_mid, c_shd)
    draw_facet([p_nw_root, p_nw_tip, p_nw_outer], c_hi, c_mid)
    draw_facet([p_nw_front, p_nw_tip, p_nw_root], c_bright, c_hi)

    # Crisp white origami crease highlights on primary ridges
    ctx.set_source_rgba(1.0, 1.0, 0.98, 0.96)
    ctx.set_line_width(1.6)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    # Wing main fold ridge
    ctx.move_to(p_nw_root[0], p_nw_root[1])
    ctx.line_to(p_nw_tip[0], p_nw_tip[1])
    ctx.stroke()
    # Neck & head ridge
    ctx.move_to(p_neck_base_m[0], p_neck_base_m[1])
    ctx.line_to(p_head_top[0], p_head_top[1])
    ctx.line_to(p_beak[0], p_beak[1])
    ctx.stroke()
    # Tail ridge
    ctx.move_to(p_tail_base_m[0], p_tail_base_m[1])
    ctx.line_to(p_tail_tip[0], p_tail_tip[1])
    ctx.stroke()

    ctx.restore()


# ------------------------------------------------------------------------------
# Hanging Red & Gold Paper Lanterns (红金折纸灯笼)
# ------------------------------------------------------------------------------
def draw_paper_lantern(ctx: cairo.Context, cx: float, cy: float, rw: float, rh: float,
                       *, is_lit: bool = True, flicker: float = 0.0,
                       sway_angle: float = 0.0, wire_top_y: float = None):
    """
    Renders a traditional Chinese red-and-gold folded paper lantern with vertical suspension wire,
    warm radial glow, golden ribs, gold-trimmed collars, and crimson tassel.
    """
    # Vertical suspension thread from top book frame (like v3)
    if wire_top_y is not None and wire_top_y < cy - rh:
        ctx.save()
        ctx.set_source_rgba(0.88, 0.72, 0.45, 0.68)
        ctx.set_line_width(1.3)
        ctx.move_to(cx, wire_top_y)
        ctx.line_to(cx, cy - rh)
        ctx.stroke()
        ctx.restore()

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(sway_angle)

    if is_lit:
        halo_r = max(rw, rh) * 2.8
        flicker_scale = 1.0 + 0.04 * math.sin(flicker)
        halo = cairo.RadialGradient(0, 0, rw * 0.15, 0, 0, halo_r * flicker_scale)
        halo.add_color_stop_rgba(0.0, 1.00, 0.90, 0.48, 0.68)
        halo.add_color_stop_rgba(0.38, 0.98, 0.48, 0.20, 0.36)
        halo.add_color_stop_rgba(1.0, 0.90, 0.20, 0.10, 0.0)
        ctx.set_source(halo)
        ctx.arc(0, 0, halo_r * flicker_scale, 0, math.tau)
        ctx.fill()

    # Top collar
    cw, ch = rw * 0.46, rh * 0.13
    ctx.rectangle(-cw, -rh - ch, cw * 2, ch)
    ctx.set_source_rgb(0.28, 0.08, 0.10)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.95, 0.78, 0.34, 0.92)
    ctx.set_line_width(1.2)
    ctx.stroke()

    # Lantern body with white die-cut paper rim
    ctx.save()
    ctx.scale(rw, rh)
    ctx.arc(0, 0, 1.0, 0, math.tau)
    if is_lit:
        bg = cairo.RadialGradient(0, -0.1, 0.08, 0, 0, 1.0)
        bg.add_color_stop_rgb(0.0, 1.00, 0.96, 0.70)
        bg.add_color_stop_rgb(0.42, 0.99, 0.48, 0.22)
        bg.add_color_stop_rgb(0.82, 0.88, 0.18, 0.20)
        bg.add_color_stop_rgb(1.0, 0.70, 0.10, 0.16)
        ctx.set_source(bg)
    else:
        bg = cairo.RadialGradient(0, 0, 0.1, 0, 0, 1.0)
        bg.add_color_stop_rgb(0.0, 0.55, 0.12, 0.16)
        bg.add_color_stop_rgb(0.7, 0.42, 0.08, 0.12)
        bg.add_color_stop_rgb(1.0, 0.28, 0.05, 0.08)
        ctx.set_source(bg)
    ctx.fill_preserve()
    ctx.set_source_rgba(1.0, 0.96, 0.88, 0.92 if is_lit else 0.50)
    ctx.set_line_width(0.055)
    ctx.stroke()
    ctx.restore()

    # Curved vertical gold ribs
    for rx in (-0.82, -0.42, 0.0, 0.42, 0.82):
        ctx.new_path()
        ctx.move_to(rx * rw * 0.42, -rh)
        ctx.curve_to(rx * rw, -rh * 0.45, rx * rw, rh * 0.45, rx * rw * 0.42, rh)
        if is_lit:
            ctx.set_source_rgba(1.0, 0.92, 0.58, 0.72)
            ctx.set_line_width(1.3)
        else:
            ctx.set_source_rgba(0.24, 0.05, 0.08, 0.70)
            ctx.set_line_width(1.0)
        ctx.stroke()

    # Bottom collar
    ctx.rectangle(-cw, rh, cw * 2, ch)
    ctx.set_source_rgb(0.28, 0.08, 0.10)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.95, 0.78, 0.34, 0.92)
    ctx.set_line_width(1.2)
    ctx.stroke()

    # Golden bead & swaying red silk tassel
    ctx.arc(0, rh + ch + 3.2, 2.8, 0, math.tau)
    ctx.set_source_rgb(0.96, 0.80, 0.28)
    ctx.fill()

    tassel_len = rh * 0.82
    ctx.save()
    ctx.translate(0, rh + ch + 5.2)
    ctx.rotate(sway_angle * 0.6)
    for off_tx in (-3.2, -1.6, 0.0, 1.6, 3.2):
        ctx.move_to(off_tx * 0.45, 0)
        ctx.line_to(off_tx * 1.25, tassel_len)
        ctx.set_source_rgba(0.92, 0.24, 0.24, 0.90)
        ctx.set_line_width(1.2)
        ctx.stroke()
    ctx.restore()

    ctx.restore()


# ------------------------------------------------------------------------------
# Scenery Landmarks: Ancient Paper Pagoda, Pine Trees, & Origami Zoetrope Pavilion
# ------------------------------------------------------------------------------
def draw_paper_pagoda(ctx: cairo.Context, cx: float, cy: float, scale: float = 1.0):
    """
    Renders the delicate 5-tiered paper-cut ancient pagoda silhouette on the left mountain ridge
    (matching v3's left-ridge pagoda!).
    """
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)

    # Soft shadow
    ctx.save()
    ctx.translate(2.5, 3.0)
    ctx.set_source_rgba(0.16, 0.05, 0.20, 0.35)
    for tier in range(5):
        ty = -tier * 16.0
        tw = (28.0 - tier * 3.8)
        ctx.move_to(-tw, ty)
        ctx.line_to(tw, ty)
        ctx.line_to(tw * 0.65, ty - 11.0)
        ctx.line_to(-tw * 0.65, ty - 11.0)
        ctx.close_path()
        ctx.fill()
    ctx.restore()

    # Pagoda body in warm plum-terracotta cardstock with fine cream-gold rim
    for tier in range(5):
        ty = -tier * 16.0
        tw = (28.0 - tier * 3.8)
        th = 11.0
        # Core wall
        ctx.rectangle(-tw * 0.52, ty - th, tw * 1.04, th + 3.0)
        ctx.set_source_rgb(0.58, 0.22, 0.34)
        ctx.fill()

        # Upturned eave roof
        ctx.new_path()
        ctx.move_to(-tw * 1.12, ty - 2.0)
        ctx.curve_to(-tw * 0.75, ty + 2.0, -tw * 0.55, ty - th + 1.0, -tw * 0.55, ty - th + 1.0)
        ctx.line_to(tw * 0.55, ty - th + 1.0)
        ctx.curve_to(tw * 0.55, ty - th + 1.0, tw * 0.75, ty + 2.0, tw * 1.12, ty - 2.0)
        ctx.line_to(tw * 0.85, ty + 3.0)
        ctx.line_to(-tw * 0.85, ty + 3.0)
        ctx.close_path()
        ctx.set_source_rgb(0.66, 0.26, 0.38)
        ctx.fill_preserve()
        ctx.set_source_rgba(1.0, 0.92, 0.82, 0.78)
        ctx.set_line_width(1.0)
        ctx.stroke()

    # Spire finial
    ctx.move_to(0, -5 * 16.0 + 4.0)
    ctx.line_to(0, -5 * 16.0 - 18.0)
    ctx.set_source_rgba(0.98, 0.86, 0.68, 0.88)
    ctx.set_line_width(2.0)
    ctx.stroke()

    ctx.restore()


def draw_zoetrope_pavilion(ctx: cairo.Context, cx: float, cy: float, scale: float = 1.0, t: float = 0.0):
    """
    Renders the STORY.md destination landmark on the right cliff ridge:
    '折纸走马灯小亭' (Origami Zoetrope Pavilion) housing a glowing hexagonal rotating paper lantern
    whose backlit panels show silhouettes of the previous worlds (Enter key, pixel castle, tram, seal).
    """
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)

    # 1. Warm golden backlight radiating from the rotating zoetrope inside the pavilion
    halo = cairo.RadialGradient(0, -48.0, 6.0, 0, -48.0, 95.0)
    halo.add_color_stop_rgba(0.0, 1.00, 0.96, 0.72, 0.82)
    halo.add_color_stop_rgba(0.45, 1.00, 0.74, 0.30, 0.42)
    halo.add_color_stop_rgba(1.0, 0.95, 0.42, 0.18, 0.0)
    ctx.set_source(halo)
    ctx.arc(0, -48.0, 95.0, 0, math.tau)
    ctx.fill()

    # 2. Stepped paper platform base
    ctx.rectangle(-48.0, -10.0, 96.0, 10.0)
    ctx.set_source_rgb(0.38, 0.16, 0.34)
    ctx.fill_preserve()
    ctx.set_source_rgba(1.0, 0.96, 0.88, 0.90)
    ctx.set_line_width(1.3)
    ctx.stroke()

    # 3. Pavilion outer pillars
    for px in (-34.0, -22.0, 22.0, 34.0):
        ctx.rectangle(px - 2.2, -74.0, 4.4, 64.0)
        ctx.set_source_rgb(0.48, 0.18, 0.32)
        ctx.fill_preserve()
        ctx.set_source_rgba(1.0, 0.94, 0.84, 0.75)
        ctx.set_line_width(0.9)
        ctx.stroke()

    # 4. Hexagonal Rotating Origami Zoetrope Lantern (六角折纸走马灯) suspended in the center
    z_cy = -44.0
    z_w, z_h = 19.0, 22.0
    # Top/bottom lantern caps
    for cap_y in (z_cy - z_h - 3.5, z_cy + z_h):
        ctx.rectangle(-z_w * 0.85, cap_y, z_w * 1.7, 3.5)
        ctx.set_source_rgb(0.32, 0.10, 0.16)
        ctx.fill_preserve()
        ctx.set_source_rgba(0.96, 0.80, 0.35, 0.90)
        ctx.set_line_width(1.0)
        ctx.stroke()

    # Three visible hexagonal facets (left, center, right) with glowing backlit paper windows
    panels = [
        (-z_w, -z_w * 0.38, 0.88),
        (-z_w * 0.38, z_w * 0.38, 1.00),
        (z_w * 0.38, z_w, 0.88),
    ]
    for idx, (x0, x1, br) in enumerate(panels):
        ctx.new_path()
        ctx.move_to(x0, z_cy - z_h)
        ctx.line_to(x1, z_cy - z_h)
        ctx.line_to(x1, z_cy + z_h)
        ctx.line_to(x0, z_cy + z_h)
        ctx.close_path()
        g_pan = cairo.LinearGradient(0, z_cy - z_h, 0, z_cy + z_h)
        g_pan.add_color_stop_rgb(0.0, 1.00 * br, 0.95 * br, 0.68 * br)
        g_pan.add_color_stop_rgb(1.0, 0.98 * br, 0.65 * br, 0.28 * br)
        ctx.set_source(g_pan)
        ctx.fill_preserve()
        ctx.set_source_rgba(0.45, 0.16, 0.18, 0.85)
        ctx.set_line_width(1.1)
        ctx.stroke()

        # Tiny silhouette easter eggs on the panels (Castle turret / Enter key / Seal)
        mid_x = (x0 + x1) * 0.5
        ctx.set_source_rgba(0.42, 0.14, 0.18, 0.78)
        if idx == 0:
            # Enter key ↵ silhouette
            ctx.rectangle(mid_x - 3.5, z_cy - 5.0, 7.0, 10.0)
            ctx.fill()
        elif idx == 1:
            # Pixel castle silhouette
            ctx.rectangle(mid_x - 4.5, z_cy - 2.0, 9.0, 10.0)
            ctx.rectangle(mid_x - 2.5, z_cy - 9.0, 5.0, 7.0)
            ctx.fill()
        else:
            # Cinnabar square seal silhouette
            ctx.rectangle(mid_x - 3.8, z_cy - 4.5, 7.6, 9.0)
            ctx.fill()

    # 5. Double-tiered Origami Pavilion Upturned Roofs with crisp white die-cut edges
    roof_tiers = [
        (-72.0, 58.0, 18.0),
        (-90.0, 42.0, 16.0),
    ]
    for ry, rw_tier, rh_tier in roof_tiers:
        # Shadow
        ctx.save()
        ctx.translate(2.0, 3.0)
        ctx.new_path()
        ctx.move_to(-rw_tier, ry)
        ctx.curve_to(-rw_tier * 0.5, ry - rh_tier * 0.3, -rw_tier * 0.3, ry - rh_tier, 0, ry - rh_tier)
        ctx.curve_to(rw_tier * 0.3, ry - rh_tier, rw_tier * 0.5, ry - rh_tier * 0.3, rw_tier, ry)
        ctx.close_path()
        ctx.set_source_rgba(0.12, 0.04, 0.18, 0.42)
        ctx.fill()
        ctx.restore()

        # Roof body
        ctx.new_path()
        ctx.move_to(-rw_tier, ry)
        ctx.curve_to(-rw_tier * 0.5, ry + 2.0, -rw_tier * 0.32, ry - rh_tier, 0, ry - rh_tier)
        ctx.curve_to(rw_tier * 0.32, ry - rh_tier, rw_tier * 0.5, ry + 2.0, rw_tier, ry)
        ctx.line_to(rw_tier * 0.78, ry + 4.5)
        ctx.line_to(-rw_tier * 0.78, ry + 4.5)
        ctx.close_path()
        g_roof = cairo.LinearGradient(0, ry - rh_tier, 0, ry + 4.5)
        g_roof.add_color_stop_rgb(0.0, 0.62, 0.24, 0.44)
        g_roof.add_color_stop_rgb(1.0, 0.42, 0.15, 0.32)
        ctx.set_source(g_roof)
        ctx.fill_preserve()
        ctx.set_source_rgba(1.0, 0.98, 0.92, 0.92)
        ctx.set_line_width(1.5)
        ctx.stroke()

    # Spire tip
    ctx.move_to(0, -106.0)
    ctx.line_to(0, -118.0)
    ctx.set_source_rgba(1.0, 0.92, 0.70, 0.95)
    ctx.set_line_width(2.0)
    ctx.stroke()

    ctx.restore()


def draw_paper_pine_tree(ctx: cairo.Context, cx: float, cy: float, h: float,
                         color_tint=(0.38, 0.18, 0.34)):
    """Renders a layered origami/paper-cut pine tree on cliff ridges."""
    ctx.save()
    ctx.translate(cx, cy)

    tw, th = h * 0.08, h * 0.25
    ctx.rectangle(-tw, -th, tw * 2, th)
    ctx.set_source_rgb(0.24, 0.10, 0.16)
    ctx.fill()

    tiers = [
        (0.0, -h * 0.20, h * 0.36, h * 0.28),
        (0.0, -h * 0.44, h * 0.28, h * 0.24),
        (0.0, -h * 0.66, h * 0.20, h * 0.22),
    ]
    for tx, ty, tw_tier, th_tier in tiers:
        ctx.new_path()
        ctx.move_to(tx, ty - th_tier)
        ctx.line_to(tx + tw_tier, ty)
        ctx.curve_to(tx + tw_tier * 0.5, ty + 2.5, tx - tw_tier * 0.5, ty + 2.5, tx - tw_tier, ty)
        ctx.close_path()
        ctx.set_source_rgb(*color_tint)
        ctx.fill_preserve()
        ctx.set_source_rgba(1.0, 0.96, 0.90, 0.85)
        ctx.set_line_width(1.15)
        ctx.stroke()

    ctx.restore()


# ------------------------------------------------------------------------------
# Four-Layer Concentric Golden Paper-Cut Sun (四层同心暖金纸雕日轮)
# ------------------------------------------------------------------------------
def render_concentric_paper_sun(current_pil: Image.Image, sun_cx: float, sun_cy: float):
    """
    Renders v3's signature 4-layer concentric golden paper-cut sun onto current_pil,
    complete with soft inter-layer drop shadows, warm golden paper gradients,
    crisp white die-cut rims, and the central vertical book-spine fold line.
    """
    # Soft outer golden atmospheric glow on the purple sky backdrop
    glow_surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    g_ctx = cairo.Context(glow_surf)
    glow = cairo.RadialGradient(sun_cx, sun_cy, 60.0, sun_cx, sun_cy, 440.0)
    glow.add_color_stop_rgba(0.0, 1.00, 0.88, 0.52, 0.55)
    glow.add_color_stop_rgba(0.55, 0.96, 0.62, 0.34, 0.25)
    glow.add_color_stop_rgba(1.0, 0.65, 0.28, 0.45, 0.0)
    g_ctx.set_source(glow)
    g_ctx.arc(sun_cx, sun_cy, 440.0, 0, math.tau)
    g_ctx.fill()
    current_pil.alpha_composite(cairo_surface_to_pil(glow_surf))

    # 4 concentric golden paper discs from outer to inner (matching v3!)
    sun_rings = [
        (242.0, (0.95, 0.72, 0.38), (0.89, 0.58, 0.28), 11.0, 0.42),
        (184.0, (0.98, 0.80, 0.46), (0.93, 0.68, 0.34), 9.0,  0.38),
        (128.0, (0.99, 0.88, 0.58), (0.96, 0.78, 0.44), 7.5,  0.34),
        (74.0,  (1.00, 0.95, 0.74), (0.98, 0.86, 0.56), 6.0,  0.30),
    ]

    for rad, c_top, c_bot, blur_r, s_alpha in sun_rings:
        # Shadow mask
        mask_surf = cairo.ImageSurface(cairo.FORMAT_A8, W, H)
        m_ctx = cairo.Context(mask_surf)
        m_ctx.arc(sun_cx, sun_cy, rad, 0, math.tau)
        m_ctx.set_source_rgba(0, 0, 0, 1.0)
        m_ctx.fill()
        m_buf = np.frombuffer(mask_surf.get_data(), dtype=np.uint8).reshape((H, W))
        mask_pil = Image.fromarray(m_buf.copy(), mode="L")

        shadow_pil = create_blurred_drop_shadow(
            mask_pil, dx=0.0, dy=4.5, blur_r=blur_r,
            shadow_rgba=(28, 10, 32, int(s_alpha * 255))
        )
        current_pil.alpha_composite(shadow_pil)

        # Golden paper disc
        ring_surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        r_ctx = cairo.Context(ring_surf)
        r_ctx.arc(sun_cx, sun_cy, rad, 0, math.tau)
        rg = cairo.LinearGradient(sun_cx, sun_cy - rad, sun_cx, sun_cy + rad)
        rg.add_color_stop_rgb(0.0, *c_top)
        rg.add_color_stop_rgb(1.0, *c_bot)
        r_ctx.set_source(rg)
        r_ctx.fill_preserve()

        # Crisp creamy-white die-cut paper edge
        r_ctx.set_source_rgba(1.0, 0.98, 0.90, 0.95)
        r_ctx.set_line_width(2.2)
        r_ctx.stroke()

        # Center vertical book-spine fold line across the paper sun disc
        r_ctx.save()
        r_ctx.arc(sun_cx, sun_cy, rad, 0, math.tau)
        r_ctx.clip()
        r_ctx.move_to(sun_cx - 1.0, sun_cy - rad)
        r_ctx.line_to(sun_cx - 1.0, sun_cy + rad)
        r_ctx.set_source_rgba(0.72, 0.46, 0.20, 0.28)
        r_ctx.set_line_width(2.0)
        r_ctx.stroke()

        r_ctx.move_to(sun_cx + 1.2, sun_cy - rad)
        r_ctx.line_to(sun_cx + 1.2, sun_cy + rad)
        r_ctx.set_source_rgba(1.0, 0.99, 0.92, 0.55)
        r_ctx.set_line_width(1.5)
        r_ctx.stroke()
        r_ctx.restore()

        current_pil.alpha_composite(cairo_surface_to_pil(ring_surf))


# ------------------------------------------------------------------------------
# Pop-up Paper Support Tabs & Central Origami Pedestal (3D 折纸支撑卡榫与底座)
# ------------------------------------------------------------------------------
def draw_popup_support_mechanisms(ctx: cairo.Context, seam_x: float, page_top_y: float):
    """
    Renders realistic 3D folded paper support tabs and the central origami folded pedestal/bridge
    straddling the book spine crease (combining v3's central origami stand with folded tabs).
    """
    ctx.save()

    # 1. Central 3D Folded Origami Pedestal / Bridge across the Book Spine Crease (v3 signature detail!)
    ped_y = page_top_y + 38.0
    ped_w = 128.0
    ped_h = 34.0

    # Pedestal cast shadow on the book pages
    ctx.save()
    ctx.new_path()
    ctx.move_to(seam_x - ped_w * 1.08, ped_y + 16.0)
    ctx.line_to(seam_x, ped_y + 28.0)
    ctx.line_to(seam_x + ped_w * 1.08, ped_y + 16.0)
    ctx.line_to(seam_x, ped_y - 4.0)
    ctx.close_path()
    ctx.set_source_rgba(0.28, 0.18, 0.14, 0.36)
    ctx.fill()
    ctx.restore()

    # Left wing of central folded origami stand (lit creamy-beige)
    ctx.new_path()
    ctx.move_to(seam_x, ped_y - ped_h)
    ctx.line_to(seam_x - ped_w, ped_y + 8.0)
    ctx.line_to(seam_x - ped_w * 0.72, ped_y + 18.0)
    ctx.line_to(seam_x, ped_y + 2.0)
    ctx.close_path()
    ctx.set_source_rgb(0.95, 0.89, 0.78)
    ctx.fill_preserve()
    ctx.set_source_rgba(1.0, 0.98, 0.92, 0.95)
    ctx.set_line_width(1.5)
    ctx.stroke()

    # Right wing of central folded origami stand (warm shaded beige)
    ctx.new_path()
    ctx.move_to(seam_x, ped_y - ped_h)
    ctx.line_to(seam_x + ped_w, ped_y + 8.0)
    ctx.line_to(seam_x + ped_w * 0.72, ped_y + 18.0)
    ctx.line_to(seam_x, ped_y + 2.0)
    ctx.close_path()
    ctx.set_source_rgb(0.85, 0.77, 0.65)
    ctx.fill_preserve()
    ctx.set_source_rgba(1.0, 0.98, 0.92, 0.95)
    ctx.set_line_width(1.5)
    ctx.stroke()

    # Upper support collar under the canyon center
    ctx.new_path()
    ctx.move_to(seam_x - 42.0, ped_y - ped_h - 32.0)
    ctx.line_to(seam_x, ped_y - ped_h - 24.0)
    ctx.line_to(seam_x, ped_y - ped_h + 4.0)
    ctx.line_to(seam_x - 36.0, ped_y - ped_h - 4.0)
    ctx.close_path()
    ctx.set_source_rgb(0.96, 0.91, 0.81)
    ctx.fill_preserve()
    ctx.set_source_rgba(1.0, 0.99, 0.94, 0.95)
    ctx.set_line_width(1.4)
    ctx.stroke()

    ctx.new_path()
    ctx.move_to(seam_x + 42.0, ped_y - ped_h - 32.0)
    ctx.line_to(seam_x, ped_y - ped_h - 24.0)
    ctx.line_to(seam_x, ped_y - ped_h + 4.0)
    ctx.line_to(seam_x + 36.0, ped_y - ped_h - 4.0)
    ctx.close_path()
    ctx.set_source_rgb(0.84, 0.76, 0.64)
    ctx.fill_preserve()
    ctx.set_source_rgba(1.0, 0.99, 0.94, 0.95)
    ctx.set_line_width(1.4)
    ctx.stroke()

    # 2. Lateral 3D Folded Paper Pop-Up Tabs (两侧山体折纸支撑卡榫)
    for tx, sign in [(seam_x - 290.0, 1.0), (seam_x + 290.0, -1.0)]:
        ty = page_top_y + 10.0
        ctx.new_path()
        ctx.move_to(tx, ty)
        ctx.line_to(tx + sign * 34.0, ty - 20.0)
        ctx.line_to(tx + sign * 48.0, ty + 4.0)
        ctx.close_path()
        ctx.set_source_rgb(0.91, 0.85, 0.74)
        ctx.fill_preserve()
        ctx.set_source_rgba(1.0, 0.98, 0.92, 0.92)
        ctx.set_line_width(1.2)
        ctx.stroke()

    ctx.restore()


# ------------------------------------------------------------------------------
# Contract API: render_world
# ------------------------------------------------------------------------------
def render_world(cam_x: float, cam_y: float, t: float, state: dict = None) -> Image.Image:
    """
    Renders the viewport at camera (cam_x, cam_y) at time t.
    Outputs a 1920x1080 Pillow Image in RGB.
    Complete v3-style Pop-Up Book Stage on a dim walnut desk + v5 narrative upgrades.
    """
    if state is None:
        state = {}

    fold_progress = state.get("fold_progress", 1.0)
    pop_h_scale = math.sin(clamp(fold_progress, 0.0, 1.0) * (math.pi / 2.0))

    view_x0 = cam_x - W / 2.0
    view_y0 = cam_y - H / 2.0
    valley_cx = 4140.0  # Center of the book seam gorge in world coordinates
    seam_screen_x = clamp(valley_cx - view_x0, 480.0, W - 480.0)

    # Stage geometry constants (matching v3's pop-up theatre book proportions)
    top_y = 48.0
    back_bot_y = 730.0
    front_bot_y = 996.0
    top_left_x, top_right_x = 104.0, W - 104.0
    mid_left_x, mid_right_x = 92.0, W - 92.0
    bot_left_x, bot_right_x = 46.0, W - 46.0

    # --------------------------------------------------------------------------
    # 1. Deep Walnut Wood Tabletop & Upright Book Cover Frame
    # --------------------------------------------------------------------------
    base_surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(base_surf)

    # Rich dark walnut wood tabletop
    desk_grad = cairo.LinearGradient(0, 0, 0, H)
    desk_grad.add_color_stop_rgb(0.0, 0.11, 0.05, 0.05)
    desk_grad.add_color_stop_rgb(0.55, 0.17, 0.08, 0.06)
    desk_grad.add_color_stop_rgb(1.0, 0.08, 0.03, 0.03)
    ctx.set_source(desk_grad)
    ctx.paint()

    # Subtle horizontal wood grain texture
    ctx.save()
    np.random.seed(42)
    for gy in range(0, H, 10):
        ctx.move_to(0, gy + np.sin(gy * 0.05) * 2.5)
        ctx.line_to(W, gy + np.sin(gy * 0.05 + 1.1) * 2.5)
        alpha = 0.045 + 0.025 * np.sin(gy * 0.11)
        ctx.set_source_rgba(0.28, 0.14, 0.10, alpha)
        ctx.set_line_width(1.8 + np.sin(gy) * 0.8)
        ctx.stroke()
    ctx.restore()

    # Warm ambient desk glow around the open pop-up book
    desk_glow = cairo.RadialGradient(W * 0.5, H * 0.55, 220.0, W * 0.5, H * 0.55, 1060.0)
    desk_glow.add_color_stop_rgba(0.0, 0.95, 0.62, 0.30, 0.16)
    desk_glow.add_color_stop_rgba(0.7, 0.65, 0.30, 0.15, 0.06)
    desk_glow.add_color_stop_rgba(1.0, 0.0, 0.0, 0.0, 0.0)
    ctx.set_source(desk_glow)
    ctx.paint()

    # Deep drop shadow of the entire upright book & open spread onto the walnut desk
    ctx.save()
    ctx.new_path()
    ctx.move_to(top_left_x - 24.0, top_y - 8.0)
    ctx.line_to(top_right_x + 24.0, top_y - 8.0)
    ctx.line_to(mid_right_x + 28.0, back_bot_y + 10.0)
    ctx.line_to(bot_right_x + 30.0, front_bot_y + 42.0)
    ctx.line_to(bot_left_x - 30.0, front_bot_y + 42.0)
    ctx.line_to(mid_left_x - 28.0, back_bot_y + 10.0)
    ctx.close_path()
    ctx.set_source_rgba(0.03, 0.01, 0.02, 0.68)
    ctx.fill()
    ctx.restore()

    # Upright Hardcover Outer Frame (Burgundy Red Cloth + Gold Foil Trim)
    ctx.new_path()
    ctx.move_to(top_left_x - 14.0, top_y - 12.0)
    ctx.line_to(top_right_x + 14.0, top_y - 12.0)
    ctx.line_to(mid_right_x + 14.0, back_bot_y + 6.0)
    ctx.line_to(mid_left_x - 14.0, back_bot_y + 6.0)
    ctx.close_path()
    cover_g = cairo.LinearGradient(0, top_y - 12.0, 0, back_bot_y + 6.0)
    cover_g.add_color_stop_rgb(0.0, 0.44, 0.12, 0.16)
    cover_g.add_color_stop_rgb(1.0, 0.30, 0.07, 0.10)
    ctx.set_source(cover_g)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.88, 0.72, 0.34, 0.88)
    ctx.set_line_width(2.0)
    ctx.stroke()

    # Upright Creamy-White Thick Cardstock Inner Liner Frame
    ctx.new_path()
    ctx.move_to(top_left_x, top_y)
    ctx.line_to(top_right_x, top_y)
    ctx.line_to(mid_right_x, back_bot_y)
    ctx.line_to(mid_left_x, back_bot_y)
    ctx.close_path()
    ctx.set_source_rgb(0.97, 0.94, 0.87)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.75, 0.68, 0.58, 0.80)
    ctx.set_line_width(1.5)
    ctx.stroke()

    # Inner Sky Backdrop Viewport (Inset by 13px inside the creamy cardstock border)
    sky_tl_x, sky_tr_x = top_left_x + 13.0, top_right_x - 13.0
    sky_bl_x, sky_br_x = mid_left_x + 13.0, mid_right_x - 13.0
    sky_top_y, sky_bot_y = top_y + 13.0, back_bot_y

    ctx.save()
    ctx.new_path()
    ctx.move_to(sky_tl_x, sky_top_y)
    ctx.line_to(sky_tr_x, sky_top_y)
    ctx.line_to(sky_br_x, sky_bot_y)
    ctx.line_to(sky_bl_x, sky_bot_y)
    ctx.close_path()
    ctx.clip()

    # Deep Twilight Royal-Purple Cardstock Sky Backdrop
    sky_grad = cairo.LinearGradient(0, sky_top_y, 0, sky_bot_y)
    sky_grad.add_color_stop_rgb(0.00, 0.22, 0.10, 0.36)  # Deep royal night-plum
    sky_grad.add_color_stop_rgb(0.45, 0.32, 0.15, 0.48)  # Rich twilight violet
    sky_grad.add_color_stop_rgb(0.80, 0.48, 0.22, 0.52)  # Warm magenta-plum horizon
    sky_grad.add_color_stop_rgb(1.00, 0.65, 0.34, 0.42)
    ctx.set_source(sky_grad)
    ctx.paint()

    # Subtle gold-dust paper speckles in the purple sky
    np.random.seed(108)
    for _ in range(95):
        sx_p = np.random.uniform(sky_tl_x, sky_tr_x)
        sy_p = np.random.uniform(sky_top_y, sky_bot_y - 160.0)
        sr_p = np.random.uniform(0.6, 1.8)
        ctx.arc(sx_p, sy_p, sr_p, 0, math.tau)
        ctx.set_source_rgba(1.0, 0.92, 0.78, np.random.uniform(0.12, 0.38))
        ctx.fill()

    # Center vertical book-spine fold crease on the purple sky backdrop
    ctx.move_to(seam_screen_x - 1.2, sky_top_y)
    ctx.line_to(seam_screen_x - 1.2, sky_bot_y)
    ctx.set_source_rgba(0.12, 0.04, 0.20, 0.42)
    ctx.set_line_width(2.2)
    ctx.stroke()

    ctx.move_to(seam_screen_x + 1.2, sky_top_y)
    ctx.line_to(seam_screen_x + 1.2, sky_bot_y)
    ctx.set_source_rgba(1.0, 0.92, 0.85, 0.22)
    ctx.set_line_width(1.6)
    ctx.stroke()

    ctx.restore()  # End sky backdrop clip

    current_pil = cairo_surface_to_pil(base_surf)

    # --------------------------------------------------------------------------
    # 2. Four-Layer Concentric Golden Paper-Cut Sun (四层同心暖金纸雕日轮)
    # --------------------------------------------------------------------------
    sun_cx = seam_screen_x
    sun_cy = 306.0 - (view_y0 * 0.25)
    render_concentric_paper_sun(current_pil, sun_cx, sun_cy)

    # --------------------------------------------------------------------------
    # 3. Layered Paper-Cut Mountains (with Pagoda, Pine Trees, & Zoetrope Pavilion)
    # --------------------------------------------------------------------------
    # Mountain ridge functions shaped around the central Lantern Canyon (seam_screen_x)
    def ridge_layer1(sx):
        # Furthest warm golden-ochre ridge (like v3's highest sunset ridge)
        dx = sx - seam_screen_x
        canyon_dip = smoothstep(420.0, 60.0, abs(dx)) * 95.0
        wave = 415.0 - 48.0 * math.cos(dx * 0.0085) + 22.0 * math.sin(dx * 0.019)
        return lerp(back_bot_y, wave + canyon_dip, pop_h_scale)

    def ridge_layer2(sx):
        # Terracotta-coral ridge (hosts the ancient paper pagoda on the left peak)
        dx = sx - seam_screen_x
        canyon_dip = smoothstep(380.0, 50.0, abs(dx)) * 125.0
        wave = 468.0 - 52.0 * math.sin(dx * 0.0075 - 0.6) + 26.0 * math.cos(dx * 0.017)
        return lerp(back_bot_y, wave + canyon_dip, pop_h_scale)

    def ridge_layer3(sx):
        # Rose-mulberry midground ridge
        dx = sx - seam_screen_x
        canyon_dip = smoothstep(350.0, 70.0, abs(dx)) * 145.0
        wave = 528.0 + 42.0 * math.sin(dx * 0.009 + 1.2) + 18.0 * math.cos(dx * 0.022)
        return lerp(back_bot_y, wave + canyon_dip, pop_h_scale)

    def ridge_layer4(sx):
        # Royal plum-violet cliff ridge (hosts the Zoetrope Pavilion on the right plateau)
        dx = sx - seam_screen_x
        canyon_dip = smoothstep(320.0, 90.0, abs(dx)) * 165.0
        wave = 588.0 - 36.0 * math.cos(dx * 0.008 - 0.5) + 16.0 * math.sin(dx * 0.020)
        return lerp(back_bot_y, wave + canyon_dip, pop_h_scale)

    def ridge_layer5(sx):
        # Deep indigo-aubergine foreground canyon cliffs anchored to the book pages
        dx = sx - seam_screen_x
        canyon_dip = smoothstep(280.0, 85.0, abs(dx)) * 135.0
        wave = 648.0 + 34.0 * math.sin(dx * 0.010 + 0.4) + 15.0 * math.cos(dx * 0.024)
        return lerp(back_bot_y, wave + canyon_dip, pop_h_scale)

    mountain_specs = [
        # (fn, top_rgb, bot_rgb, shadow_dy, shadow_blur, shadow_alpha)
        (ridge_layer1, (0.93, 0.64, 0.34), (0.80, 0.46, 0.26), 9.0, 14.0, 0.38),
        (ridge_layer2, (0.84, 0.40, 0.34), (0.68, 0.28, 0.28), 8.0, 12.0, 0.38),
        (ridge_layer3, (0.66, 0.26, 0.38), (0.50, 0.18, 0.30), 7.5, 11.0, 0.40),
        (ridge_layer4, (0.46, 0.20, 0.40), (0.34, 0.13, 0.30), 7.0, 10.0, 0.42),
        (ridge_layer5, (0.35, 0.15, 0.36), (0.24, 0.09, 0.26), 6.0, 9.0,  0.45),
    ]

    for l_idx, (r_fn, c_top, c_bot, s_dy, s_blur, s_alpha) in enumerate(mountain_specs):
        # Build mountain polygon clipped horizontally to the inner backdrop width
        xs = np.linspace(sky_bl_x - 2.0, sky_br_x + 2.0, 140)
        pts = [(sky_bl_x - 2.0, back_bot_y + 10.0)]
        for x_val in xs:
            pts.append((float(x_val), float(r_fn(x_val))))
        pts.append((sky_br_x + 2.0, back_bot_y + 10.0))

        # Shadow mask
        mask_surf = cairo.ImageSurface(cairo.FORMAT_A8, W, H)
        m_ctx = cairo.Context(mask_surf)
        m_ctx.new_path()
        m_ctx.move_to(sky_tl_x, sky_top_y)
        m_ctx.line_to(sky_tr_x, sky_top_y)
        m_ctx.line_to(sky_br_x, back_bot_y + 4.0)
        m_ctx.line_to(sky_bl_x, back_bot_y + 4.0)
        m_ctx.close_path()
        m_ctx.clip()

        m_ctx.new_path()
        m_ctx.move_to(pts[0][0], pts[0][1])
        for p in pts[1:]:
            m_ctx.line_to(p[0], p[1])
        m_ctx.close_path()
        m_ctx.set_source_rgba(0, 0, 0, 1.0)
        m_ctx.fill()

        m_buf = np.frombuffer(mask_surf.get_data(), dtype=np.uint8).reshape((H, W))
        mask_pil = Image.fromarray(m_buf.copy(), mode="L")
        shadow_pil = create_blurred_drop_shadow(
            mask_pil, dx=0.0, dy=-s_dy * 0.6, blur_r=s_blur,
            shadow_rgba=(20, 6, 28, int(s_alpha * 255))
        )
        current_pil.alpha_composite(shadow_pil)

        # Mountain paper layer fill + landmarks
        layer_surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        l_ctx = cairo.Context(layer_surf)
        l_ctx.new_path()
        l_ctx.move_to(sky_tl_x, sky_top_y)
        l_ctx.line_to(sky_tr_x, sky_top_y)
        l_ctx.line_to(sky_br_x, back_bot_y + 4.0)
        l_ctx.line_to(sky_bl_x, back_bot_y + 4.0)
        l_ctx.close_path()
        l_ctx.clip()

        # Landmarks standing behind/on this ridge:
        if l_idx == 1:
            # Left distant peak: Ancient Paper Pagoda (纸雕古塔)
            pagoda_x = seam_screen_x - 620.0
            pagoda_y = r_fn(pagoda_x) + 6.0
            draw_paper_pagoda(l_ctx, pagoda_x, pagoda_y, scale=0.95)
        elif l_idx == 3:
            # Right cliff plateau: Origami Zoetrope Pavilion (折纸走马灯小亭)
            pav_x = seam_screen_x + 565.0
            pav_y = r_fn(pav_x) + 8.0
            draw_zoetrope_pavilion(l_ctx, pav_x, pav_y, scale=0.92, t=t)

        # Mountain ridge body
        l_ctx.new_path()
        l_ctx.move_to(pts[0][0], pts[0][1])
        for p in pts[1:]:
            l_ctx.line_to(p[0], p[1])
        l_ctx.close_path()

        mg = cairo.LinearGradient(0, 360.0, 0, back_bot_y)
        mg.add_color_stop_rgb(0.0, *c_top)
        mg.add_color_stop_rgb(1.0, *c_bot)
        l_ctx.set_source(mg)
        l_ctx.fill_preserve()

        # Crisp creamy-white die-cut top ridge edge
        l_ctx.set_source_rgba(1.0, 0.97, 0.90, 0.92)
        l_ctx.set_line_width(1.9)
        l_ctx.stroke()

        # Center vertical book-spine crease across the mountain paper
        l_ctx.save()
        l_ctx.new_path()
        l_ctx.move_to(pts[0][0], pts[0][1])
        for p in pts[1:]:
            l_ctx.line_to(p[0], p[1])
        l_ctx.close_path()
        l_ctx.clip()
        l_ctx.move_to(seam_screen_x - 1.0, 350.0)
        l_ctx.line_to(seam_screen_x - 1.0, back_bot_y)
        l_ctx.set_source_rgba(0.12, 0.04, 0.18, 0.30)
        l_ctx.set_line_width(2.0)
        l_ctx.stroke()
        l_ctx.move_to(seam_screen_x + 1.2, 350.0)
        l_ctx.line_to(seam_screen_x + 1.2, back_bot_y)
        l_ctx.set_source_rgba(1.0, 0.95, 0.88, 0.32)
        l_ctx.set_line_width(1.4)
        l_ctx.stroke()
        l_ctx.restore()

        # Paper pine trees on ridges 2 & 3
        if l_idx in (2, 3):
            for off_x in (-440.0, -310.0, 290.0, 430.0):
                px_s = seam_screen_x + off_x + (l_idx * 28.0)
                py_s = r_fn(px_s) + 3.0
                draw_paper_pine_tree(
                    l_ctx, px_s, py_s, h=34.0 + l_idx * 6.0,
                    color_tint=(c_top[0] * 0.82, c_top[1] * 0.82, c_top[2] * 0.88)
                )

        current_pil.alpha_composite(cairo_surface_to_pil(layer_surf))

    # --------------------------------------------------------------------------
    # 4. Open Horizontal Pop-Up Book Spread (底部带折痕方格压纹的米白立体书页 + 书缝深谷)
    # --------------------------------------------------------------------------
    book_surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    b_ctx = cairo.Context(book_surf)

    # Stacked Paper Deckle Edges & Burgundy Hardcover Base at the front bottom
    deckle_h = 24.0
    cover_thick = 10.0

    # Burgundy lower book cover edge
    b_ctx.new_path()
    b_ctx.move_to(bot_left_x - 12.0, front_bot_y + deckle_h - 2.0)
    b_ctx.line_to(bot_right_x + 12.0, front_bot_y + deckle_h - 2.0)
    b_ctx.line_to(bot_right_x + 16.0, front_bot_y + deckle_h + cover_thick)
    b_ctx.line_to(bot_left_x - 16.0, front_bot_y + deckle_h + cover_thick)
    b_ctx.close_path()
    b_ctx.set_source_rgb(0.38, 0.09, 0.13)
    b_ctx.fill_preserve()
    b_ctx.set_source_rgba(0.90, 0.74, 0.34, 0.90)
    b_ctx.set_line_width(1.6)
    b_ctx.stroke()

    # Creamy stacked paper deckle edge (with central V-dip at the book spine!)
    spine_dip = 10.0
    b_ctx.new_path()
    b_ctx.move_to(bot_left_x, front_bot_y)
    b_ctx.line_to(seam_screen_x, front_bot_y + spine_dip)
    b_ctx.line_to(bot_right_x, front_bot_y)
    b_ctx.line_to(bot_right_x - 4.0, front_bot_y + deckle_h)
    b_ctx.line_to(seam_screen_x, front_bot_y + deckle_h + spine_dip * 0.6)
    b_ctx.line_to(bot_left_x + 4.0, front_bot_y + deckle_h)
    b_ctx.close_path()
    b_ctx.set_source_rgb(0.89, 0.83, 0.72)
    b_ctx.fill()

    # Fine horizontal paper-sheet lines across the deckle thickness
    for frac in (0.2, 0.4, 0.6, 0.8):
        ly = front_bot_y + deckle_h * frac
        b_ctx.move_to(bot_left_x + 2.0, ly)
        b_ctx.line_to(seam_screen_x, ly + spine_dip * (1.0 - frac * 0.4))
        b_ctx.line_to(bot_right_x - 2.0, ly)
        b_ctx.set_source_rgba(0.68, 0.60, 0.48, 0.55)
        b_ctx.set_line_width(1.0)
        b_ctx.stroke()

    # Left Open Creamy Cardstock Page
    b_ctx.new_path()
    b_ctx.move_to(mid_left_x, back_bot_y)
    b_ctx.line_to(seam_screen_x, back_bot_y + 8.0)
    b_ctx.line_to(seam_screen_x, front_bot_y + spine_dip)
    b_ctx.line_to(bot_left_x, front_bot_y)
    b_ctx.close_path()
    pg_l = cairo.LinearGradient(mid_left_x, back_bot_y, seam_screen_x, front_bot_y)
    pg_l.add_color_stop_rgb(0.0, 0.96, 0.92, 0.83)
    pg_l.add_color_stop_rgb(0.85, 0.94, 0.89, 0.79)
    pg_l.add_color_stop_rgb(1.0, 0.82, 0.75, 0.64)
    b_ctx.set_source(pg_l)
    b_ctx.fill_preserve()
    b_ctx.set_source_rgba(1.0, 0.99, 0.94, 0.95)
    b_ctx.set_line_width(2.0)
    b_ctx.stroke()

    # Right Open Creamy Cardstock Page
    b_ctx.new_path()
    b_ctx.move_to(seam_screen_x, back_bot_y + 8.0)
    b_ctx.line_to(mid_right_x, back_bot_y)
    b_ctx.line_to(bot_right_x, front_bot_y)
    b_ctx.line_to(seam_screen_x, front_bot_y + spine_dip)
    b_ctx.close_path()
    pg_r = cairo.LinearGradient(seam_screen_x, back_bot_y, bot_right_x, front_bot_y)
    pg_r.add_color_stop_rgb(0.0, 0.82, 0.75, 0.64)
    pg_r.add_color_stop_rgb(0.15, 0.93, 0.88, 0.78)
    pg_r.add_color_stop_rgb(1.0, 0.96, 0.92, 0.83)
    b_ctx.set_source(pg_r)
    b_ctx.fill_preserve()
    b_ctx.set_source_rgba(1.0, 0.99, 0.94, 0.95)
    b_ctx.set_line_width(2.0)
    b_ctx.stroke()

    # Embossed Origami Grid Crease Lines on the Open Book Pages (v3 signature detail!)
    b_ctx.save()
    b_ctx.new_path()
    b_ctx.move_to(mid_left_x, back_bot_y)
    b_ctx.line_to(seam_screen_x, back_bot_y + 8.0)
    b_ctx.line_to(mid_right_x, back_bot_y)
    b_ctx.line_to(bot_right_x, front_bot_y)
    b_ctx.line_to(seam_screen_x, front_bot_y + spine_dip)
    b_ctx.line_to(bot_left_x, front_bot_y)
    b_ctx.close_path()
    b_ctx.clip()

    # Perspective vertical fold lines
    for col_frac in (-0.75, -0.50, -0.25, 0.25, 0.50, 0.75):
        top_gx = seam_screen_x + col_frac * (seam_screen_x - mid_left_x)
        bot_gx = seam_screen_x + col_frac * (seam_screen_x - bot_left_x)
        b_ctx.move_to(top_gx, back_bot_y)
        b_ctx.line_to(bot_gx, front_bot_y + spine_dip)
        b_ctx.set_source_rgba(0.72, 0.65, 0.54, 0.42)
        b_ctx.set_line_width(1.3)
        b_ctx.stroke()
        b_ctx.move_to(top_gx + 1.5, back_bot_y)
        b_ctx.line_to(bot_gx + 1.5, front_bot_y + spine_dip)
        b_ctx.set_source_rgba(1.0, 0.99, 0.95, 0.65)
        b_ctx.set_line_width(1.2)
        b_ctx.stroke()

    # Horizontal perspective fold lines
    for row_frac in (0.33, 0.67):
        y_side = lerp(back_bot_y, front_bot_y, row_frac)
        y_mid  = lerp(back_bot_y + 8.0, front_bot_y + spine_dip, row_frac)
        xl = lerp(mid_left_x, bot_left_x, row_frac)
        xr = lerp(mid_right_x, bot_right_x, row_frac)
        b_ctx.move_to(xl, y_side)
        b_ctx.line_to(seam_screen_x, y_mid)
        b_ctx.line_to(xr, y_side)
        b_ctx.set_source_rgba(0.72, 0.65, 0.54, 0.45)
        b_ctx.set_line_width(1.4)
        b_ctx.stroke()
        b_ctx.move_to(xl, y_side + 1.6)
        b_ctx.line_to(seam_screen_x, y_mid + 1.6)
        b_ctx.line_to(xr, y_side + 1.6)
        b_ctx.set_source_rgba(1.0, 0.99, 0.95, 0.68)
        b_ctx.set_line_width(1.2)
        b_ctx.stroke()

    # Center Book-Spine Canyon Crevice Shading (书脊中缝峡谷深槽)
    cleft_g = cairo.LinearGradient(seam_screen_x - 28.0, 0, seam_screen_x + 28.0, 0)
    cleft_g.add_color_stop_rgba(0.0, 0.42, 0.32, 0.28, 0.0)
    cleft_g.add_color_stop_rgba(0.46, 0.26, 0.16, 0.22, 0.52)
    cleft_g.add_color_stop_rgba(0.50, 0.16, 0.08, 0.16, 0.75)
    cleft_g.add_color_stop_rgba(0.54, 0.35, 0.24, 0.24, 0.45)
    cleft_g.add_color_stop_rgba(1.0, 0.42, 0.32, 0.28, 0.0)
    b_ctx.set_source(cleft_g)
    b_ctx.rectangle(seam_screen_x - 28.0, back_bot_y, 56.0, front_bot_y - back_bot_y + 20.0)
    b_ctx.fill()

    b_ctx.restore()  # End page clip

    # 3D Folded Paper Support Mechanisms & Central Origami Pedestal (3D 折纸支撑卡榫与中央折纸底座)
    draw_popup_support_mechanisms(b_ctx, seam_screen_x, back_bot_y)

    # Foreground Pop-Up Wing Hills on Left and Right of the Open Pages (matching v3!)
    def draw_foreground_wing_hill(pts_hill, col_top, col_bot):
        # Drop shadow on the creamy book page
        b_ctx.save()
        b_ctx.translate(0.0, 10.0)
        b_ctx.new_path()
        b_ctx.move_to(pts_hill[0][0], pts_hill[0][1])
        for p in pts_hill[1:]:
            b_ctx.line_to(p[0], p[1])
        b_ctx.close_path()
        b_ctx.set_source_rgba(0.16, 0.08, 0.18, 0.38)
        b_ctx.fill()
        b_ctx.restore()

        # Cutout hill body
        b_ctx.new_path()
        b_ctx.move_to(pts_hill[0][0], pts_hill[0][1])
        for p in pts_hill[1:]:
            b_ctx.line_to(p[0], p[1])
        b_ctx.close_path()
        ys = [p[1] for p in pts_hill]
        hg = cairo.LinearGradient(0, min(ys), 0, max(ys))
        hg.add_color_stop_rgb(0.0, *col_top)
        hg.add_color_stop_rgb(1.0, *col_bot)
        b_ctx.set_source(hg)
        b_ctx.fill_preserve()
        b_ctx.set_source_rgba(1.0, 0.98, 0.92, 0.95)
        b_ctx.set_line_width(2.0)
        b_ctx.stroke()

    # Back-tier foreground wing hills (y_base = 795)
    left_hill_back = [
        (76.0, 795.0), (110.0, 715.0), (195.0, 672.0), (285.0, 708.0),
        (375.0, 668.0), (470.0, 712.0), (575.0, 795.0)
    ]
    right_hill_back = [
        (W - 575.0, 795.0), (W - 470.0, 708.0), (W - 375.0, 665.0),
        (W - 285.0, 705.0), (W - 195.0, 670.0), (W - 110.0, 712.0), (W - 76.0, 795.0)
    ]
    draw_foreground_wing_hill(left_hill_back, (0.34, 0.16, 0.38), (0.24, 0.10, 0.28))
    draw_foreground_wing_hill(right_hill_back, (0.34, 0.16, 0.38), (0.24, 0.10, 0.28))

    # Front-tier foreground wing hills on the lower-left and lower-right page (y_base = 845, matching v3!)
    left_hill_front = [
        (64.0, 845.0), (96.0, 765.0), (185.0, 718.0), (285.0, 762.0), (395.0, 845.0)
    ]
    right_hill_front = [
        (W - 540.0, 845.0), (W - 455.0, 770.0), (W - 350.0, 732.0),
        (W - 245.0, 765.0), (W - 155.0, 725.0), (W - 92.0, 775.0), (W - 64.0, 845.0)
    ]
    draw_foreground_wing_hill(left_hill_front, (0.27, 0.12, 0.32), (0.18, 0.07, 0.22))
    draw_foreground_wing_hill(right_hill_front, (0.27, 0.12, 0.32), (0.18, 0.07, 0.22))

    # Tiny Decorative Gold Foil 4-Point Paper Stars at the Book Page Corners (v3 detail!)
    for scx, scy, sr in [(68.0, 812.0, 14.0), (W - 112.0, 756.0, 10.0), (W - 68.0, 822.0, 15.0)]:
        b_ctx.save()
        create_four_point_star_path(b_ctx, scx, scy, sr, inner_r=sr * 0.30, rot=0.12)
        b_ctx.set_source_rgb(0.98, 0.84, 0.45)
        b_ctx.fill_preserve()
        b_ctx.set_source_rgba(1.0, 0.99, 0.92, 0.95)
        b_ctx.set_line_width(1.2)
        b_ctx.stroke()
        b_ctx.restore()

    current_pil.alpha_composite(cairo_surface_to_pil(book_surf))

    # Convert back to Cairo for Lanterns, Origami Cranes, Slime, and Sparkle Star
    base_surf = pil_to_cairo_surface(current_pil)
    ctx = cairo.Context(base_surf)

    # --------------------------------------------------------------------------
    # 5. Hanging Red & Gold Paper Lanterns (两侧垂挂红金折纸灯笼)
    # --------------------------------------------------------------------------
    # Rhythmic placement flanking the concentric golden sun (matching v3's 6 hanging lanterns!)
    lantern_specs = [
        (seam_screen_x - 610.0, 232.0, True, 24.0, 30.0),
        (seam_screen_x - 430.0, 326.0, True, 29.0, 36.0),
        (seam_screen_x - 238.0, 206.0, True, 19.0, 24.0),
        (seam_screen_x + 245.0, 212.0, True, 20.0, 25.0),
        (seam_screen_x + 432.0, 318.0, True, 29.0, 36.0),
        (seam_screen_x + 605.0, 242.0, True, 25.0, 31.0),
    ]

    for i, (lx_s, ly_s, is_lit, lrw, lrh) in enumerate(lantern_specs):
        sway = 0.05 * math.sin(t * 1.8 + i * 0.9)
        draw_paper_lantern(
            ctx, lx_s, ly_s, lrw, lrh,
            is_lit=is_lit, flicker=t * 3.0 + i,
            sway_angle=sway, wire_top_y=sky_top_y
        )

    # --------------------------------------------------------------------------
    # 6. Three Classic 3D Geometric Origami Paper Cranes + Paper-Cut Slime
    # --------------------------------------------------------------------------
    flap_c = math.sin(t * 3.2) * 0.35
    flap_l = math.sin(t * 3.2 + 0.8) * 0.40
    flap_r = math.sin(t * 3.2 - 0.7) * 0.40

    # Escort Crane 1 (Upper-Left): Sakura Pink Origami Crane (樱花粉折纸鹤)
    draw_origami_crane(
        ctx, seam_screen_x - 310.0, 442.0, scale=0.95,
        tilt=-0.06, wing_flap=flap_l, color_scheme="pink", has_rider=False
    )

    # Escort Crane 2 (Upper-Right): Celestial Cyan-Blue Origami Crane (天青蓝折纸鹤)
    draw_origami_crane(
        ctx, seam_screen_x + 318.0, 434.0, scale=0.95,
        tilt=-0.08, wing_flap=flap_r, color_scheme="blue", has_rider=False
    )

    # Center Lead Crane: Warm Ivory-Gold Origami Crane (暖金象牙白主鹤, carrying the Slime)
    lead_crane_x = seam_screen_x - 4.0
    lead_crane_y = 626.0
    draw_origami_crane(
        ctx, lead_crane_x, lead_crane_y, scale=1.40,
        tilt=-0.04, wing_flap=flap_c, color_scheme="white", has_rider=True
    )

    # --------------------------------------------------------------------------
    # 7. The 5-Layer Die-Cut Paper Slime (Sitting on Lead Crane's Diamond Saddle)
    # --------------------------------------------------------------------------
    slime_cfg = state.get("slime_pose", {})
    s_radius = slime_cfg.get("radius", 68.0)       # Diameter 136px (within 130~140px requirement!)
    s_squash = slime_cfg.get("squash_y", 0.96)     # Plump, volume-conserving cushion pose
    s_tilt   = slime_cfg.get("tilt", 0.02)
    s_look   = slime_cfg.get("look", (0.36, -0.20))
    s_mode   = slime_cfg.get("eye_mode", "pill")   # Pure white stencil capsule eyes

    slime_sx = lead_crane_x - 2.0
    slime_sy = lead_crane_y - 68.0

    draw_slime(
        ctx, slime_sx, slime_sy, s_radius,
        squash_y=s_squash, tilt=s_tilt, look=s_look,
        eye_mode=s_mode, blink=0.0, t=t
    )

    # --------------------------------------------------------------------------
    # 8. Gold Foil Paper-Cut Sparkle Star (✦) Leading / Crowning the Canyon
    # --------------------------------------------------------------------------
    # Positioned right above the Slime at the base of the concentric golden sun (matching v3!)
    star_sx = seam_screen_x + 2.0
    star_sy = 412.0 + 6.0 * math.sin(t * 2.2)
    if "star_pos_screen" in state:
        star_sx, star_sy = state["star_pos_screen"]

    draw_star(ctx, star_sx, star_sy, r=36.0, rot=0.0, t=t)

    # Floating golden paper confetti around the canyon
    np.random.seed(99)
    ctx.save()
    for _ in range(16):
        fx = seam_screen_x + np.random.uniform(-340.0, 340.0)
        fy = 480.0 + np.random.uniform(-160.0, 180.0)
        fr = np.random.uniform(2.0, 4.2)
        f_ang = np.random.uniform(0, math.tau)
        ctx.save()
        ctx.translate(fx, fy)
        ctx.rotate(f_ang)
        ctx.rectangle(-fr, -fr * 0.6, fr * 2, fr * 1.2)
        ctx.set_source_rgba(1.0, 0.92, 0.52, np.random.uniform(0.45, 0.88))
        ctx.fill()
        ctx.restore()
    ctx.restore()

    # --------------------------------------------------------------------------
    # 9. Tactile Cotton Paper Fiber Grain Overlay
    # --------------------------------------------------------------------------
    final_pil = cairo_surface_to_pil(base_surf).convert("RGB")
    paper_noise = get_paper_noise_texture(W, H)

    img_arr = np.array(final_pil, dtype=np.float32)
    noise_arr = (np.array(paper_noise, dtype=np.float32) - 128.0) * 0.075
    img_arr = np.clip(img_arr + noise_arr[:, :, np.newaxis], 0, 255).astype(np.uint8)

    return Image.fromarray(img_arr, mode="RGB")


# ------------------------------------------------------------------------------
# Contract API: render_keyframe
# ------------------------------------------------------------------------------
def render_keyframe() -> Image.Image:
    """
    Renders the signature v5 keyframe for World 04 · 纸雕立体书山谷.
    """
    cam_x = 4140.0
    cam_y = 540.0
    t = 9.8

    state = {
        "fold_progress": 1.0,
        "slime_pose": {
            "radius": 68.0,        # Diameter 136px (130~140px target)
            "squash_y": 0.96,      # Plump paper-cut sphere
            "tilt": 0.02,
            "look": (0.36, -0.20),
            "eye_mode": "pill",    # Pure white stencil capsule eyes (-30° tilt, 81% far eye)
        },
    }

    return render_world(cam_x, cam_y, t, state)


if __name__ == "__main__":
    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, "style_05_paper.png")
    print("Rendering World 05 keyframe (t=9.8s)...")
    img = render_keyframe()
    img.save(out_path, quality=95)
    print(f"Keyframe successfully saved to: {out_path}")

    # Also save lightweight preview jpg for inspection (<150KB)
    preview_path = "/tmp/preview_v5_05.jpg"
    preview_img = img.resize((1280, 720), Image.Resampling.LANCZOS)
    preview_img.save(preview_path, "JPEG", quality=80)
    print(f"Preview saved to: {preview_path} ({os.path.getsize(preview_path)} bytes)")
