# -*- coding: utf-8 -*-
"""
StyleHop v5 · World 10: 移轴微缩粘土书桌 (Tilt-Shift Miniature Claymation Desk)
================================================================================
融合 v3 的阳光马卡龙粘土背景（远景多层波浪彩色粘土山丘、铁丝/牙签螺旋粘土小树与云朵、
细腻指纹肌理大史莱姆、精致马卡龙、铅笔、多肉盆栽与骰子）与 v4 的故事瞬间（左上方倾倒赤陶马克杯
流出优雅 S 形斜向蜿蜒的焦糖奶油色粘土咖啡小溪、粉彩多米诺骨牌连锁倾倒搭桥、史莱姆跃上骨牌桥、
对岸带拇指指纹印的粘土四角星芒 ✦）。

模块接口合同：
  - W, H = 1920, 1080
  - WORLD_W, WORLD_H = 7680, 1080
  - draw_star(ctx, cx, cy, r, *, rot=0.0, t=0.0, **style_kw)
  - draw_slime(ctx, cx, cy, radius, *, squash_y=1.0, tilt=0.0, look=(0.0, 0.0), eye_mode="pill", blink=0.0, t=0.0, **style_kw)
  - render_world(cam_x, cam_y, t, state=None) -> PIL.Image.Image
  - render_keyframe() -> PIL.Image.Image
"""

import os
import sys
import math
import numpy as np
import cairo
from PIL import Image, ImageFilter

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from slime_engine import (
    SlimePose,
    compute_slime_contour,
    draw_slime_path,
    draw_four_point_star,
    draw_capsule_pill,
    cairo_to_pil,
)

# ---------------------------------------------------------------------------
# 规格合同常量 (Contract Constants)
# ---------------------------------------------------------------------------
W, H = 1920, 1080
WORLD_W, WORLD_H = 7680, 1080
OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "style_08_clay.png")


def _hex_to_rgb(hex_str: str) -> tuple:
    h = hex_str.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def _rounded_rect(ctx: cairo.Context, x: float, y: float, w: float, h: float, r: float):
    r = min(r, w / 2.0, h / 2.0)
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.arc(x + r, y + r, r, math.pi, 3 * math.pi / 2)
    ctx.close_path()


def make_clay_noise(w: int, h: int, seed: int = 101) -> np.ndarray:
    """Fast procedural clay grain texture field in [-1, +1]."""
    rng = np.random.default_rng(seed)
    micro = rng.uniform(-1.0, 1.0, (h // 2, w // 2)).astype(np.float32)
    im = Image.fromarray(micro).resize((w, h), Image.Resampling.BILINEAR)
    return np.asarray(im, dtype=np.float32)


# ---------------------------------------------------------------------------
# API Contract 1: draw_star (带拇指指纹印与圆润捏塑边缘的粘土四角星芒 ✦)
# ---------------------------------------------------------------------------
def draw_star(
    ctx: cairo.Context,
    cx: float,
    cy: float,
    r: float,
    *,
    rot: float = 0.0,
    t: float = 0.0,
    **style_kw,
):
    """
    Renders a hand-pinched polymer clay 4-point concave star (✦) with:
      - Soft tabletop contact drop shadow
      - Golden-Coral-Blue or Warm Amber-Gold pinched clay gradient
      - Rounded clay bevel edges & pinched center ridges
      - Distinct concentric sculptor's thumbprint whorl ridges (拇指指纹印)
    """
    ctx.save()

    # Optional stop-motion brass armature wire if crown_pos is provided
    crown_pos = style_kw.get("crown_pos", None)
    if crown_pos is not None:
        crown_x, crown_y = crown_pos
        ctx.save()
        ctx.set_source_rgba(0.35, 0.24, 0.30, 0.35)
        ctx.set_line_width(2.2)
        ctx.move_to(cx + 3, cy + r * 0.7)
        ctx.line_to(crown_x + 3, crown_y)
        ctx.stroke()
        ctx.set_line_width(1.5)
        ctx.set_source_rgb(0.86, 0.72, 0.38)
        ctx.move_to(cx, cy + r * 0.7)
        ctx.line_to(crown_x, crown_y)
        ctx.stroke()
        ctx.restore()

    # 1. Soft contact shadow
    ctx.save()
    ctx.translate(cx + r * 0.18, cy + r * 0.32)
    draw_four_point_star(ctx, 0, 0, r * 1.02, r * 0.28, rot=rot)
    ctx.set_source_rgba(0.28, 0.16, 0.22, 0.38)
    ctx.fill()
    ctx.restore()

    # 2. Star Body: Hand-Pinched Golden-Coral-Blue Polymer Clay with Rounded Clay Edges
    ctx.save()
    ctx.translate(cx, cy)
    draw_four_point_star(ctx, 0, 0, r, r * 0.28, rot=rot)

    star_g = cairo.LinearGradient(-r * 0.8, -r * 0.8, r * 0.8, r * 0.8)
    star_g.add_color_stop_rgb(0.00, 0.48, 0.78, 1.00)  # Pinched Sky Blue tip
    star_g.add_color_stop_rgb(0.38, 1.00, 0.86, 0.36)  # Warm Buttercup Gold core
    star_g.add_color_stop_rgb(0.75, 0.96, 0.56, 0.42)  # Pinched Dawn Coral
    star_g.add_color_stop_rgb(1.00, 0.88, 0.40, 0.48)  # Pinched Rose Coral tip
    ctx.set_source(star_g)
    ctx.fill_preserve()

    # Rounded clay edge bevel stroke
    ctx.set_source_rgba(1.0, 0.95, 0.82, 0.90)
    ctx.set_line_width(max(2.0, r * 0.075))
    ctx.stroke_preserve()

    # Clip to star body for thumbprint whorls & pinched ridges
    ctx.clip()

    # 3. Pinched center ridges
    for i in range(4):
        ang_w = rot + i * (math.pi / 2.0) - math.pi / 4.0
        wx = r * 0.28 * math.cos(ang_w)
        wy = r * 0.28 * math.sin(ang_w)
        ctx.new_path()
        ctx.move_to(0, 0)
        ctx.line_to(wx, wy)
        ctx.set_source_rgba(0.45, 0.24, 0.30, 0.45)
        ctx.set_line_width(max(1.4, r * 0.045))
        ctx.stroke()

    # 4. Sculptor's Thumbprint Whorl Ridges (拇指指纹印) at center of star
    ctx.save()
    ctx.rotate(rot + 0.28)
    ctx.scale(1.0, 0.82)
    for w_idx in range(1, 6):
        cur_r = w_idx * (r * 0.085)
        ctx.new_path()
        ctx.arc(0, 0, cur_r, 0.2, math.tau - 0.3)
        ctx.set_source_rgba(0.38, 0.18, 0.12, 0.26)
        ctx.set_line_width(max(1.0, r * 0.035))
        ctx.stroke()
        ctx.new_path()
        ctx.arc(-0.8, -0.8, cur_r, 0.4, math.pi * 1.5)
        ctx.set_source_rgba(1.0, 0.98, 0.88, 0.38)
        ctx.set_line_width(max(0.8, r * 0.028))
        ctx.stroke()
    ctx.restore()

    # Soft glowing star core highlight
    core_g = cairo.RadialGradient(-r * 0.12, -r * 0.12, 1, 0, 0, r * 0.36)
    core_g.add_color_stop_rgba(0.0, 1.0, 0.99, 0.92, 0.78)
    core_g.add_color_stop_rgba(1.0, 1.0, 0.85, 0.45, 0.0)
    ctx.set_source(core_g)
    ctx.arc(0, 0, r * 0.36, 0, math.tau)
    ctx.fill()

    ctx.restore()
    ctx.restore()


# ---------------------------------------------------------------------------
# API Contract 2: draw_slime (v3 细腻指纹肌理粘土史莱姆 · 直径约 130~140px)
# ---------------------------------------------------------------------------
def draw_slime(
    ctx: cairo.Context,
    cx: float = 695.0,
    cy: float = 550.0,
    radius: float = 68.0,
    *,
    squash_y: float = 0.88,
    tilt: float = 0.15,
    look: tuple = (0.52, -0.22),
    eye_mode: str = "pill",
    blink: float = 0.0,
    t: float = 0.0,
    **style_kw,
):
    """
    Renders the Star-Spark Slime translated into authentic hand-kneaded polymer clay:
      - Opaque rich marbled seams of Sky Blue (#4FADFF), Iris Violet (#7559E8), and Dawn Coral (#D96570)
      - Soft matte subsurface-scattering clay shading with warm peach bounce
      - Concentric sculptor's thumbprint whorl ridges (指纹肌理) and clay dimples
      - MOUTHLESS: Supports both thick hand-rolled pure-white clay capsule pills ("pill") and
        happy pressed clay arches ("happy", ^ ^), with -30 deg cant and far eye 81% width
      - Optional overhead 4-point concave clay star (✦) on a micro-fine stop-motion armature wire
    """
    sy = max(0.25, squash_y)
    sx = 1.0 / math.sqrt(sy)
    R = radius
    scale_ratio = R / 125.0

    look_x = look[0] if isinstance(look, (tuple, list)) else 0.52
    look_y = look[1] if isinstance(look, (tuple, list)) else -0.22

    pose = SlimePose(
        x=cx,
        y=cy,
        radius=R,
        squash_y=sy,
        tilt=tilt,
        look_x=look_x,
        look_y=look_y,
    )
    pts = compute_slime_contour(pose, n_pts=128)

    # 1. Soft Floor Contact Shadow
    sh_x = cx + 8.0 * scale_ratio
    sh_y = cy + R * sy * 0.94
    sh_rx = R * sx * 1.06
    sh_ry = R * 0.25
    ctx.save()
    ctx.translate(sh_x, sh_y)
    ctx.scale(sh_rx, sh_ry)
    sh_grad = cairo.RadialGradient(0, 0, 0.05, 0, 0, 1.0)
    sh_grad.add_color_stop_rgba(0.00, 0.28, 0.16, 0.25, 0.65)
    sh_grad.add_color_stop_rgba(0.55, 0.44, 0.26, 0.36, 0.35)
    sh_grad.add_color_stop_rgba(1.00, 0.44, 0.26, 0.36, 0.0)
    ctx.set_source(sh_grad)
    ctx.arc(0, 0, 1.0, 0, math.tau)
    ctx.fill()
    ctx.restore()

    # 2. Body Base Fill (Rich Opaque Polymer Clay Gradient Base)
    ctx.save()
    draw_slime_path(ctx, pts)

    body_base_g = cairo.RadialGradient(
        cx - R * 0.35 * sx, cy - R * 0.38 * sy, R * 0.08,
        cx + R * 0.20 * sx, cy + R * 0.30 * sy, R * 1.30
    )
    body_base_g.add_color_stop_rgb(0.00, 0.35, 0.72, 1.00)  # #4FADFF Sky Blue lit
    body_base_g.add_color_stop_rgb(0.35, 0.30, 0.55, 0.96)  # #3C78F5 Gemini Blue
    body_base_g.add_color_stop_rgb(0.65, 0.48, 0.36, 0.92)  # #7559E8 Iris Violet
    body_base_g.add_color_stop_rgb(0.85, 0.74, 0.38, 0.76)  # Orchid transition
    body_base_g.add_color_stop_rgb(1.00, 0.88, 0.42, 0.46)  # #D96570 Dawn Coral
    ctx.set_source(body_base_g)
    ctx.fill_preserve()

    ctx.clip()

    # 3. Organic Polymer Clay Marbled Swirl Seams
    cos_t, sin_t = math.cos(tilt), math.sin(tilt)

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(tilt)
    ctx.scale(sx, sy)

    # Broad flowing marbled swirl ribbon 1: Sky Blue folding down
    ctx.new_path()
    ctx.move_to(-R * 0.90, -R * 0.20)
    ctx.curve_to(-R * 0.30, -R * 0.55, R * 0.20, R * 0.10, R * 0.80, -R * 0.35)
    ctx.line_to(R * 0.88, -R * 0.12)
    ctx.curve_to(R * 0.25, R * 0.30, -R * 0.25, -R * 0.30, -R * 0.85, 0.05)
    ctx.close_path()
    s1_g = cairo.LinearGradient(-R * 0.5, -R * 0.3, R * 0.5, 0.0)
    s1_g.add_color_stop_rgba(0.0, 0.45, 0.80, 1.00, 0.85)
    s1_g.add_color_stop_rgba(1.0, 0.56, 0.46, 0.95, 0.65)
    ctx.set_source(s1_g)
    ctx.fill()

    # Swirl ribbon 2: Dawn Coral folding up across belly
    ctx.new_path()
    ctx.move_to(-R * 0.50, R * 0.35)
    ctx.curve_to(-R * 0.12, R * 0.02, R * 0.48, R * 0.42, R * 0.88, R * 0.10)
    ctx.line_to(R * 0.92, R * 0.32)
    ctx.curve_to(R * 0.48, R * 0.68, -R * 0.08, R * 0.28, -R * 0.45, R * 0.58)
    ctx.close_path()
    s2_g = cairo.LinearGradient(0, R * 0.1, R * 0.6, R * 0.5)
    s2_g.add_color_stop_rgba(0.0, 0.94, 0.48, 0.54, 0.90)
    s2_g.add_color_stop_rgba(1.0, 0.84, 0.38, 0.44, 0.80)
    ctx.set_source(s2_g)
    ctx.fill()

    # Swirl seam highlight crease
    ctx.new_path()
    ctx.move_to(-R * 0.75, -R * 0.10)
    ctx.curve_to(-R * 0.22, -R * 0.42, R * 0.22, R * 0.15, R * 0.76, -R * 0.25)
    ctx.set_source_rgba(0.80, 0.92, 1.0, 0.55)
    ctx.set_line_width(max(1.8, 2.6 * scale_ratio))
    ctx.stroke()

    ctx.restore()

    # 4. Soft Matte Subsurface-Scattering Shading
    key_g = cairo.RadialGradient(
        cx - R * 0.42 * sx, cy - R * 0.45 * sy, R * 0.05,
        cx - R * 0.10 * sx, cy - R * 0.10 * sy, R * 1.15
    )
    key_g.add_color_stop_rgba(0.0, 1.0, 0.98, 0.92, 0.48)
    key_g.add_color_stop_rgba(0.5, 1.0, 0.95, 0.88, 0.18)
    key_g.add_color_stop_rgba(1.0, 1.0, 0.95, 0.88, 0.0)
    ctx.set_source(key_g)
    ctx.arc(cx, cy, R * 1.4, 0, math.tau)
    ctx.fill()

    bounce_g = cairo.RadialGradient(
        cx + R * 0.20 * sx, cy + R * 0.65 * sy, R * 0.08,
        cx + R * 0.15 * sx, cy + R * 0.40 * sy, R * 0.85
    )
    bounce_g.add_color_stop_rgba(0.00, 1.00, 0.78, 0.68, 0.52)
    bounce_g.add_color_stop_rgba(0.60, 0.94, 0.62, 0.56, 0.20)
    bounce_g.add_color_stop_rgba(1.00, 0.85, 0.50, 0.50, 0.0)
    ctx.set_source(bounce_g)
    ctx.arc(cx, cy, R * 1.4, 0, math.tau)
    ctx.fill()

    # Broad soft matte highlight on upper-left dome
    ctx.save()
    ctx.translate(cx - R * 0.38 * sx, cy - R * 0.40 * sy)
    ctx.rotate(-0.55 + tilt * 0.5)
    ctx.scale(1.0, 0.52)
    matte_hl = cairo.RadialGradient(0, 0, R * 0.02, 0, 0, R * 0.32)
    matte_hl.add_color_stop_rgba(0.0, 1.0, 1.0, 1.0, 0.46)
    matte_hl.add_color_stop_rgba(0.5, 0.88, 0.94, 1.0, 0.20)
    matte_hl.add_color_stop_rgba(1.0, 0.70, 0.80, 1.0, 0.0)
    ctx.set_source(matte_hl)
    ctx.arc(0, 0, R * 0.32, 0, math.tau)
    ctx.fill()
    ctx.restore()

    # 5. Sculptor's Thumbprint Whorl Ridges (指纹肌理) & Tiny Tool Dimples!
    thumbprints = [
        (cx - R * 0.30 * sx, cy - R * 0.16 * sy, 1.0, 1.35, -0.45, 10, 3.6 * scale_ratio),
        (cx + R * 0.38 * sx, cy + R * 0.20 * sy, 1.1, 1.45, 0.65, 11, 3.5 * scale_ratio),
        (cx - R * 0.02 * sx, cy + R * 0.48 * sy, 1.3, 0.95, 0.15, 8, 3.8 * scale_ratio),
    ]

    for tx, ty, t_sx, t_sy, t_rot, n_w, dr in thumbprints:
        ctx.save()
        ctx.translate(tx, ty)
        ctx.rotate(t_rot)
        ctx.scale(t_sx, t_sy)

        for w_idx in range(1, n_w + 1):
            cur_r = w_idx * dr
            ctx.new_path()
            ctx.arc(0, 0, cur_r, 0, math.tau)
            ctx.set_source_rgba(0.16, 0.08, 0.24, 0.19)  # Distinct dark thumbprint groove
            ctx.set_line_width(max(1.2, 1.6 * scale_ratio))
            ctx.stroke_preserve()
            ctx.set_source_rgba(1.0, 1.0, 1.0, 0.16)     # Distinct lit thumbprint ridge
            ctx.set_line_width(max(0.8, 1.0 * scale_ratio))
            ctx.stroke()
        ctx.restore()

    dimples = [
        (cx - R * 0.52 * sx, cy + R * 0.15 * sy, 3.2 * scale_ratio),
        (cx + R * 0.18 * sx, cy - R * 0.50 * sy, 2.8 * scale_ratio),
        (cx + R * 0.58 * sx, cy - R * 0.10 * sy, 3.4 * scale_ratio),
        (cx - R * 0.22 * sx, cy + R * 0.55 * sy, 3.0 * scale_ratio),
    ]
    for dx, dy, dr in dimples:
        ctx.save()
        ctx.arc(dx, dy, dr, 0, math.tau)
        ctx.set_source_rgba(0.25, 0.10, 0.28, 0.22)
        ctx.fill()
        ctx.new_path()
        ctx.arc(dx - 0.8, dy - 0.8, dr * 0.7, 0, math.tau)
        ctx.set_source_rgba(1.0, 1.0, 1.0, 0.20)
        ctx.fill()
        ctx.restore()

    ctx.restore()  # End body clip

    # 6. Smooth Plasticine Beveled Perimeter Edge
    draw_slime_path(ctx, pts)
    contour_g = cairo.LinearGradient(cx - R * sx, cy - R * sy, cx + R * sx, cy + R * sy)
    contour_g.add_color_stop_rgba(0.00, 0.25, 0.52, 0.88, 0.90)
    contour_g.add_color_stop_rgba(0.55, 0.40, 0.28, 0.80, 0.90)
    contour_g.add_color_stop_rgba(1.00, 0.76, 0.30, 0.38, 0.90)
    ctx.set_source(contour_g)
    ctx.set_line_width(max(2.2, 3.2 * scale_ratio))
    ctx.stroke()

    # 7. MOUTHLESS 3D SPHERICAL CLAY EYES (-30 deg cant, far eye 81% width)
    gaze_cx = look_x * R * 0.42 * sx
    gaze_cy = look_y * R * 0.42 * sy

    cant_angle = -0.5236  # Strictly -30 degrees (-pi/6)
    cos_c, sin_c = math.cos(cant_angle), math.sin(cant_angle)

    base_sep = R * 0.225
    w_base = R * 0.118
    h_base = R * 0.252 * max(0.1, 1.0 - blink)

    for side in (-1, +1):
        is_far_eye = (side == +1) if look_x >= 0 else (side == -1)
        persp_w = 0.81 if is_far_eye else 1.0   # Strictly 81% far eye width!
        persp_h = 0.94 if is_far_eye else 1.0

        local_dx = side * base_sep * (0.92 if is_far_eye else 1.0)
        local_dy = 0.0

        ex_sphere = gaze_cx + local_dx * cos_c - local_dy * sin_c
        ey_sphere = gaze_cy + local_dx * sin_c + local_dy * cos_c
        ex = cx + ex_sphere * cos_t - ey_sphere * sin_t
        ey = cy + ex_sphere * sin_t + ey_sphere * cos_t

        w_eye = w_base * persp_w
        h_eye = h_base * persp_h

        ctx.save()
        ctx.translate(ex, ey)
        ctx.rotate(tilt + cant_angle)

        if eye_mode == "happy":
            # ^ ^ Happy pressed white clay arches with AO crease and 3D clay ridge highlight
            arc_w = w_eye * 1.15
            arc_h = h_eye * 0.55
            lw = max(3.6, w_eye * 0.58)
            ctx.save()
            ctx.translate(1.4, 2.2)
            ctx.new_path()
            ctx.move_to(-arc_w, arc_h * 0.35)
            ctx.curve_to(-arc_w * 0.45, -arc_h, arc_w * 0.45, -arc_h, arc_w, arc_h * 0.35)
            ctx.set_line_cap(cairo.LINE_CAP_ROUND)
            ctx.set_line_width(lw + 2.0)
            ctx.set_source_rgba(0.18, 0.10, 0.26, 0.48)
            ctx.stroke()
            ctx.restore()

            ctx.new_path()
            ctx.move_to(-arc_w, arc_h * 0.35)
            ctx.curve_to(-arc_w * 0.45, -arc_h, arc_w * 0.45, -arc_h, arc_w, arc_h * 0.35)
            ctx.set_line_cap(cairo.LINE_CAP_ROUND)
            ctx.set_line_width(lw)
            ctx.set_source_rgb(0.99, 0.99, 1.0)
            ctx.stroke_preserve()
            ctx.set_line_width(lw * 0.35)
            ctx.set_source_rgba(1.0, 1.0, 1.0, 0.95)
            ctx.stroke()
        else:
            # Ambient-Occlusion Crease / Depression furrow in soft body clay
            draw_capsule_pill(ctx, 0.6 * scale_ratio, 2.2 * scale_ratio, w_eye + 4.0 * scale_ratio, h_eye + 4.0 * scale_ratio)
            ctx.set_source_rgba(0.18, 0.10, 0.26, 0.42)
            ctx.fill()

            draw_capsule_pill(ctx, 0.0, 1.2 * scale_ratio, w_eye + 2.2 * scale_ratio, h_eye + 2.2 * scale_ratio)
            ctx.set_source_rgba(0.30, 0.18, 0.38, 0.28)
            ctx.fill()

            # Pure-White Clay Capsule Pill (Hand-rolled, rounded capsule)
            draw_capsule_pill(ctx, 0, 0, w_eye, h_eye)
            eye_pill_g = cairo.RadialGradient(-w_eye * 0.3, -h_eye * 0.3, 1.5, 0, 0, h_eye * 1.1)
            eye_pill_g.add_color_stop_rgb(0.00, 1.00, 1.00, 1.00)
            eye_pill_g.add_color_stop_rgb(0.70, 0.98, 0.98, 0.99)
            eye_pill_g.add_color_stop_rgb(1.00, 0.88, 0.88, 0.92)
            ctx.set_source(eye_pill_g)
            ctx.fill_preserve()

            ctx.set_source_rgba(0.66, 0.62, 0.72, 0.50)
            ctx.set_line_width(max(1.1, 1.4 * scale_ratio))
            ctx.stroke()

            # Pinpoint Studio Catchlight
            ctx.new_path()
            ctx.arc(-w_eye * 0.25, -h_eye * 0.32, max(1.8, w_eye * 0.25), 0, math.tau)
            ctx.set_source_rgba(1.0, 1.0, 1.0, 0.95)
            ctx.fill()

            # Secondary soft bounce catchlight
            ctx.new_path()
            ctx.arc(w_eye * 0.20, h_eye * 0.30, max(1.0, w_eye * 0.15), 0, math.tau)
            ctx.set_source_rgba(1.0, 0.95, 0.90, 0.50)
            ctx.fill()

        ctx.restore()

    # 8. Overhead Pinched Polymer Star Satellite (✦) on micro-fine armature wire if requested
    if style_kw.get("draw_crown_star", True):
        star_cx = cx + 6.0 * scale_ratio
        star_cy = cy - R * sy - 46.0 * scale_ratio
        star_r = 30.0 * scale_ratio
        crown_x = cx - 4.0 * sin_t
        crown_y = cy - R * sy * cos_t
        draw_star(ctx, star_cx, star_cy, star_r, rot=0.08 + tilt, t=t, crown_pos=(crown_x, crown_y))


# ---------------------------------------------------------------------------
# World 10 Environment: v3 Pastel Clay Hills & Coiled Trees/Clouds + S-Curve Latte Stream & Domino Bridge
# ---------------------------------------------------------------------------
def _draw_cloud_coils(ctx: cairo.Context, r: float):
    """Draws a bumpy hand-rolled clay cloud/tree crown shape with overlapping round lobes."""
    lobes = [
        (-r * 0.62, r * 0.10, r * 0.48),
        (-r * 0.28, -r * 0.32, r * 0.58),
        (r * 0.25, -r * 0.28, r * 0.62),
        (r * 0.65, r * 0.12, r * 0.46),
        (r * 0.12, r * 0.28, r * 0.55),
        (-r * 0.30, r * 0.25, r * 0.50),
    ]
    ctx.new_path()
    for lx, ly, lr in lobes:
        ctx.arc(lx, ly, lr, 0, math.tau)


def draw_clay_tabletop_and_backdrop(ctx: cairo.Context, pan_dx: float = 0.0):
    """
    Renders v3's warm sunlit stop-motion studio tabletop diorama background:
      - Multi-layer pastel wave clay hills (lavender, sage-mint, apricot peach)
      - Coiled spiral clay trees & clouds held up by twisted brass wires and wooden toothpicks
      - Sunlit craft tabletop surface
    """
    # 1. Warm studio gradient backdrop
    bg = cairo.LinearGradient(0, 0, W, H)
    bg.add_color_stop_rgb(0.00, 0.97, 0.92, 0.85)  # Warm sunlit cream
    bg.add_color_stop_rgb(0.35, 0.93, 0.86, 0.80)  # Apricot taupe
    bg.add_color_stop_rgb(0.65, 0.84, 0.77, 0.78)  # Soft studio mauve
    bg.add_color_stop_rgb(1.00, 0.78, 0.70, 0.74)
    ctx.set_source(bg)
    ctx.paint()

    # 2. Studio soft key light beam from upper-left
    spot = cairo.RadialGradient(280, 100, 50, 520, 380, 980)
    spot.add_color_stop_rgba(0.0, 1.0, 0.98, 0.92, 0.42)
    spot.add_color_stop_rgba(0.55, 1.0, 0.95, 0.88, 0.16)
    spot.add_color_stop_rgba(1.0, 1.0, 0.95, 0.88, 0.0)
    ctx.set_source(spot)
    ctx.paint()

    # 3. Layered Clay Hills in the Background (Hand-rolled pastel clay slabs)
    h_dx1 = pan_dx * 0.15
    h_dx2 = pan_dx * 0.25
    h_dx3 = pan_dx * 0.35

    # Far hill (dusty lavender clay)
    ctx.save()
    ctx.new_path()
    ctx.move_to(-150 - h_dx1, 355)
    ctx.curve_to(350 - h_dx1, 255, 750 - h_dx1, 335, 1150 - h_dx1, 265)
    ctx.curve_to(1450 - h_dx1, 215, 1750 - h_dx1, 305, W + 150 - h_dx1, 245)
    ctx.line_to(W + 150, 600)
    ctx.line_to(-150, 600)
    ctx.close_path()
    hill1_g = cairo.LinearGradient(0, 220, 0, 420)
    hill1_g.add_color_stop_rgb(0.0, 0.76, 0.69, 0.82)
    hill1_g.add_color_stop_rgb(1.0, 0.65, 0.58, 0.73)
    ctx.set_source(hill1_g)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.92, 0.88, 0.96, 0.70)
    ctx.set_line_width(6.0)
    ctx.stroke()
    ctx.restore()

    # Mid hill (pastel sage-mint green clay)
    ctx.save()
    ctx.new_path()
    ctx.move_to(-150 - h_dx2, 425)
    ctx.curve_to(300 - h_dx2, 325, 680 - h_dx2, 435, 1020 - h_dx2, 345)
    ctx.curve_to(1380 - h_dx2, 265, 1680 - h_dx2, 385, W + 150 - h_dx2, 325)
    ctx.line_to(W + 150, 650)
    ctx.line_to(-150, 650)
    ctx.close_path()
    hill2_g = cairo.LinearGradient(0, 280, 0, 460)
    hill2_g.add_color_stop_rgb(0.0, 0.68, 0.82, 0.76)
    hill2_g.add_color_stop_rgb(1.0, 0.55, 0.70, 0.64)
    ctx.set_source(hill2_g)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.86, 0.96, 0.90, 0.75)
    ctx.set_line_width(7.0)
    ctx.stroke()
    ctx.restore()

    # Near hill (warm apricot peach clay)
    ctx.save()
    ctx.new_path()
    ctx.move_to(-150 - h_dx3, 498)
    ctx.curve_to(280 - h_dx3, 410, 620 - h_dx3, 480, 960 - h_dx3, 420)
    ctx.curve_to(1320 - h_dx3, 360, 1650 - h_dx3, 450, W + 150 - h_dx3, 410)
    ctx.line_to(W + 150, 680)
    ctx.line_to(-150, 680)
    ctx.close_path()
    hill3_g = cairo.LinearGradient(0, 370, 0, 510)
    hill3_g.add_color_stop_rgb(0.0, 0.96, 0.76, 0.68)
    hill3_g.add_color_stop_rgb(1.0, 0.85, 0.63, 0.55)
    ctx.set_source(hill3_g)
    ctx.fill_preserve()
    ctx.set_source_rgba(1.0, 0.90, 0.84, 0.80)
    ctx.set_line_width(7.5)
    ctx.stroke()
    ctx.restore()

    # 4. Coiled Spiral Clay Trees & Clouds on Twisted Wire / Wooden Toothpick Trunks
    # Planted along the pastel clay hills!
    tree_and_cloud_defs = [
        # (cx, cy, r, scale, trunk_bottom_y, palette_type)
        (220 - h_dx2, 265, 42, 0.95, 415, "mint_tree"),
        (430 - h_dx1, 145, 54, 1.05, 335, "cream_cloud"),
        (820 - h_dx2, 235, 46, 1.02, 410, "pink_tree"),
        (1160 - h_dx1, 118, 66, 1.28, 315, "cream_cloud"),
        (1430 - h_dx2, 225, 48, 1.05, 395, "mint_tree"),
        (1660 - h_dx1, 155, 46, 0.95, 360, "cream_cloud"),
    ]

    for ccx, ccy, cr, csc, stick_bottom, ptype in tree_and_cloud_defs:
        ctx.save()
        # Shadow of wire/toothpick trunk
        ctx.set_source_rgba(0.40, 0.32, 0.36, 0.28)
        ctx.set_line_width(4.0)
        ctx.move_to(ccx + 4, ccy + cr * 0.65)
        ctx.line_to(ccx + 8, stick_bottom + 8)
        ctx.stroke()

        # Twisted brass wire / wooden toothpick shaft
        ctx.set_line_width(3.4)
        if ptype == "cream_cloud":
            ctx.set_source_rgb(0.82, 0.70, 0.52)  # Bamboo toothpick
        else:
            ctx.set_source_rgb(0.78, 0.60, 0.36)  # Twisted brass armature wire
        ctx.move_to(ccx, ccy + cr * 0.65)
        ctx.line_to(ccx, stick_bottom)
        ctx.stroke()

        # Highlight on left edge of shaft
        ctx.set_line_width(1.2)
        ctx.set_source_rgba(0.98, 0.94, 0.84, 0.90)
        ctx.move_to(ccx - 1.0, ccy + cr * 0.65)
        ctx.line_to(ccx - 1.0, stick_bottom)
        ctx.stroke()
        ctx.restore()

        # Coiled clay canopy / cloud body
        ctx.save()
        ctx.translate(ccx, ccy)
        ctx.scale(csc, csc * 0.84)

        # Soft drop shadow
        ctx.save()
        ctx.translate(9, 15)
        _draw_cloud_coils(ctx, cr)
        ctx.set_source_rgba(0.36, 0.30, 0.40, 0.22)
        ctx.fill()
        ctx.restore()

        _draw_cloud_coils(ctx, cr)
        c_grad = cairo.RadialGradient(-cr * 0.3, -cr * 0.3, cr * 0.1, 0, cr * 0.2, cr * 1.4)
        if ptype == "mint_tree":
            c_grad.add_color_stop_rgb(0.00, 0.82, 0.96, 0.88)
            c_grad.add_color_stop_rgb(0.65, 0.64, 0.86, 0.76)
            c_grad.add_color_stop_rgb(1.00, 0.48, 0.70, 0.60)
            seam_col = (0.42, 0.62, 0.52, 0.58)
        elif ptype == "pink_tree":
            c_grad.add_color_stop_rgb(0.00, 1.00, 0.88, 0.90)
            c_grad.add_color_stop_rgb(0.65, 0.95, 0.72, 0.78)
            c_grad.add_color_stop_rgb(1.00, 0.82, 0.56, 0.64)
            seam_col = (0.72, 0.48, 0.55, 0.55)
        else:
            c_grad.add_color_stop_rgb(0.00, 1.00, 1.00, 0.98)
            c_grad.add_color_stop_rgb(0.65, 0.96, 0.93, 0.88)
            c_grad.add_color_stop_rgb(1.00, 0.85, 0.80, 0.78)
            seam_col = (0.70, 0.64, 0.62, 0.60)

        ctx.set_source(c_grad)
        ctx.fill_preserve()

        ctx.set_source_rgba(*seam_col)
        ctx.set_line_width(2.6)
        ctx.stroke()

        # Inner spiral coil rope accents
        for r_in, th_start, th_end in [
            (cr * 0.68, 0.2, 3.4),
            (cr * 0.42, 1.8, 5.2),
            (cr * 0.22, 3.2, 7.0),
        ]:
            ctx.new_path()
            ctx.arc(0, 0, r_in, th_start, th_end)
            ctx.set_source_rgba(*seam_col)
            ctx.set_line_width(2.2)
            ctx.stroke()
            ctx.new_path()
            ctx.arc(-1.4, -1.4, r_in, th_start + 0.1, th_end - 0.1)
            ctx.set_source_rgba(1.0, 1.0, 1.0, 0.65)
            ctx.set_line_width(1.4)
            ctx.stroke()

        ctx.restore()

    # 5. Tabletop Surface (Soft matte clay craft desk)
    ctx.save()
    ctx.new_path()
    ctx.move_to(-50, 478)
    ctx.curve_to(450, 488, 1200, 473, W + 50, 483)
    ctx.line_to(W + 50, H + 50)
    ctx.line_to(-50, H + 50)
    ctx.close_path()
    desk_g = cairo.LinearGradient(0, 478, 0, H)
    desk_g.add_color_stop_rgb(0.00, 0.94, 0.87, 0.79)
    desk_g.add_color_stop_rgb(0.35, 0.90, 0.82, 0.73)
    desk_g.add_color_stop_rgb(0.75, 0.83, 0.74, 0.65)
    desk_g.add_color_stop_rgb(1.00, 0.74, 0.64, 0.55)
    ctx.set_source(desk_g)
    ctx.fill()
    ctx.restore()


def draw_s_curve_caramel_latte_stream_and_mug(ctx: cairo.Context, pan_dx: float = 0.0):
    """
    Renders the toppled terracotta clay mug in the upper-left desk area spilling an
    elegant, S-curved diagonal caramel-cream clay coffee stream (焦糖奶油色粘土咖啡小溪):
      - Graceful S-shaped meandering curve (NOT a vertical dark brown trench splitting the frame!)
      - Warm butterscotch-caramel & milk-coffee clay tones with 3D latte-art cream foam swirls
      - Glossy epoxy specular highlights and curling pastel clay ribbons at the stream edges
    """
    ctx.save()
    ctx.translate(-pan_dx, 0)

    cup_x, cup_y = 290.0, 525.0

    # Define the S-curved caramel-latte stream centerline & half-widths:
    # Starts narrow at the cup mouth (335, 530), sweeps right to (620, 555),
    # curves diagonally down-right through the domino bridge zone (825, 650),
    # and winds into a gentle S-tail in the lower center-left (755, 790) -> (880, 885)
    stream_nodes = [
        (335.0, 528.0, 26.0),
        (465.0, 532.0, 54.0),
        (635.0, 555.0, 66.0),
        (775.0, 608.0, 74.0),
        (845.0, 665.0, 78.0),   # Domino bridge crossing zone!
        (810.0, 745.0, 72.0),
        (765.0, 815.0, 62.0),
        (835.0, 875.0, 46.0),
        (925.0, 905.0, 22.0),
    ]

    def eval_catmull(pts_list, t_val):
        n = len(pts_list) - 1
        idx = min(n - 1, max(0, int(t_val * n)))
        lt = t_val * n - idx
        p0 = pts_list[max(0, idx - 1)]
        p1 = pts_list[idx]
        p2 = pts_list[min(n, idx + 1)]
        p3 = pts_list[min(n, idx + 2)]
        tt = lt * lt
        ttt = tt * lt
        res = []
        for d in range(3):
            v = 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * lt +
                       (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * tt +
                       (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * ttt)
            res.append(v)
        return res[0], res[1], res[2]

    n_samples = 64
    left_pts = []
    right_pts = []
    spine_pts = []
    for i in range(n_samples + 1):
        t_s = i / float(n_samples)
        cx_s, cy_s, hw_s = eval_catmull(stream_nodes, t_s)
        t_next = min(1.0, t_s + 0.01)
        t_prev = max(0.0, t_s - 0.01)
        nx1, ny1, _ = eval_catmull(stream_nodes, t_next)
        nx0, ny0, _ = eval_catmull(stream_nodes, t_prev)
        dx, dy = nx1 - nx0, ny1 - ny0
        seg = math.hypot(dx, dy)
        if seg < 1e-4:
            norm_x, norm_y = 0.0, 1.0
        else:
            norm_x, norm_y = -dy / seg, dx / seg
        # Add organic clay wobble along the banks
        wobble = 4.5 * math.sin(i * 0.55)
        hw_l = hw_s + wobble
        hw_r = hw_s - wobble * 0.7
        left_pts.append((cx_s + norm_x * hw_l, cy_s + norm_y * hw_l))
        right_pts.append((cx_s - norm_x * hw_r, cy_s - norm_y * hw_r))
        spine_pts.append((cx_s, cy_s, hw_s))

    def build_stream_path():
        ctx.new_path()
        ctx.move_to(left_pts[0][0], left_pts[0][1])
        for px, py in left_pts[1:]:
            ctx.line_to(px, py)
        for px, py in reversed(right_pts):
            ctx.line_to(px, py)
        ctx.close_path()

    # 1. Soft cast shadow of the raised clay stream on the tabletop
    ctx.save()
    ctx.translate(7.0, 12.0)
    build_stream_path()
    ctx.set_source_rgba(0.32, 0.20, 0.16, 0.36)
    ctx.fill()
    ctx.restore()

    # 2. Warm Caramel-Butterscotch & Latte Clay Stream Body
    build_stream_path()
    stream_g = cairo.LinearGradient(340, 520, 880, 880)
    stream_g.add_color_stop_rgb(0.00, 0.62, 0.34, 0.18)  # Rich espresso caramel at cup mouth
    stream_g.add_color_stop_rgb(0.30, 0.78, 0.46, 0.24)  # Warm golden butterscotch caramel
    stream_g.add_color_stop_rgb(0.65, 0.84, 0.54, 0.30)  # Creamy caramel latte
    stream_g.add_color_stop_rgb(1.00, 0.72, 0.42, 0.22)  # Toffee amber tail
    ctx.set_source(stream_g)
    ctx.fill_preserve()

    # Thick rolled clay perimeter bevel edge
    ctx.set_source_rgba(0.48, 0.24, 0.12, 0.75)
    ctx.set_line_width(4.2)
    ctx.stroke_preserve()

    # Clip inside stream for latte cream ribbons, foam whorls & glossy highlights
    ctx.save()
    ctx.clip()

    # 3. Continuous S-curved Latte Cream Ribbon flowing down the center of the stream!
    ctx.new_path()
    for idx, (sx, sy, shw) in enumerate(spine_pts):
        off_x = 12.0 * math.sin(idx * 0.32)
        off_y = 6.0 * math.cos(idx * 0.32)
        if idx == 0:
            ctx.move_to(sx + off_x, sy + off_y)
        else:
            ctx.line_to(sx + off_x, sy + off_y)
    ctx.set_source_rgba(0.96, 0.86, 0.72, 0.65)
    ctx.set_line_width(28.0)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.stroke_preserve()
    ctx.set_source_rgba(1.00, 0.96, 0.88, 0.85)
    ctx.set_line_width(12.0)
    ctx.stroke()

    # 4. 3D Coiled Clay Latte-Art Foam Swirls (立体奶泡漩涡)
    foam_whorls = [
        (525.0, 542.0, 26.0, -0.25),
        (695.0, 578.0, 32.0, 0.35),
        (805.0, 725.0, 34.0, -0.30),
        (790.0, 835.0, 28.0, 0.20),
    ]
    for fx, fy, fr, frot in foam_whorls:
        ctx.save()
        ctx.translate(fx, fy)
        ctx.rotate(frot)
        ctx.scale(1.22, 0.68)
        # Whorl shadow
        ctx.arc(2.0, 3.0, fr, 0, math.tau)
        ctx.set_source_rgba(0.42, 0.22, 0.10, 0.38)
        ctx.fill()
        # Cream clay disk
        ctx.arc(0, 0, fr, 0, math.tau)
        fg = cairo.RadialGradient(-fr * 0.25, -fr * 0.25, 2, 0, 0, fr)
        fg.add_color_stop_rgb(0.0, 1.00, 0.98, 0.93)
        fg.add_color_stop_rgb(0.7, 0.96, 0.88, 0.76)
        fg.add_color_stop_rgb(1.0, 0.86, 0.72, 0.56)
        ctx.set_source(fg)
        ctx.fill()
        # Spiral caramel groove inside the cream whorl
        ctx.new_path()
        ctx.arc(0, 0, fr * 0.55, 0.3, math.pi * 1.65)
        ctx.set_source_rgba(0.62, 0.34, 0.16, 0.65)
        ctx.set_line_width(3.0)
        ctx.stroke()
        ctx.new_path()
        ctx.arc(0, 0, fr * 0.26, 1.0, math.pi * 2.1)
        ctx.stroke()
        ctx.restore()

    # 5. Glossy Specular Highlights along the upper-left rim of the caramel stream
    for hx, hy, hrx, hry, hrot in [
        (430.0, 522.0, 38.0, 9.0, 0.08),
        (615.0, 542.0, 44.0, 10.0, 0.22),
        (765.0, 595.0, 42.0, 11.0, 0.52),
        (825.0, 765.0, 36.0, 9.0, -0.45),
    ]:
        ctx.save()
        ctx.translate(hx, hy)
        ctx.rotate(hrot)
        ctx.scale(hrx, hry)
        ctx.arc(0, 0, 1.0, 0, math.tau)
        hg = cairo.RadialGradient(0, -0.2, 0.1, 0, 0, 1.0)
        hg.add_color_stop_rgba(0.0, 1.0, 0.99, 0.95, 0.78)
        hg.add_color_stop_rgba(0.6, 1.0, 0.96, 0.88, 0.28)
        hg.add_color_stop_rgba(1.0, 1.0, 0.96, 0.88, 0.0)
        ctx.set_source(hg)
        ctx.fill()
        ctx.restore()

    ctx.restore()  # End stream clip

    # 6. v3 Signature Swirling Pastel Clay Ribbons curling off the stream!
    ribbons = [
        (
            [(480, 515), (545, 495), (610, 512), (655, 535)],
            (0.31, 0.68, 1.00), (0.72, 0.88, 1.00), 10.5
        ),
        (
            [(855, 868), (925, 855), (985, 878), (1015, 912)],
            (0.88, 0.42, 0.46), (1.00, 0.74, 0.76), 10.0
        ),
        (
            [(785, 835), (725, 865), (685, 905)],
            (0.46, 0.35, 0.91), (0.78, 0.68, 1.00), 9.5
        ),
    ]
    for pts, col_base, col_lit, r_w in ribbons:
        ctx.save()
        ctx.set_source_rgba(0.32, 0.22, 0.25, 0.35)
        ctx.set_line_width(r_w + 3.5)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        ctx.move_to(pts[0][0] + 4, pts[0][1] + 7)
        for p in pts[1:]:
            ctx.line_to(p[0] + 4, p[1] + 7)
        ctx.stroke()

        ctx.set_source_rgb(*col_base)
        ctx.set_line_width(r_w)
        ctx.move_to(pts[0][0], pts[0][1])
        for p in pts[1:]:
            ctx.line_to(p[0], p[1])
        ctx.stroke()

        ctx.set_source_rgba(col_lit[0], col_lit[1], col_lit[2], 0.85)
        ctx.set_line_width(r_w * 0.35)
        ctx.move_to(pts[0][0] - 1.2, pts[0][1] - 1.6)
        for p in pts[1:]:
            ctx.line_to(p[0] - 1.2, p[1] - 1.6)
        ctx.stroke()
        ctx.restore()

    # 7. The Toppled Terracotta Clay Mug / Espresso Cup at the stream source
    ctx.save()
    ctx.translate(cup_x, cup_y)
    ctx.rotate(0.28)

    # Cup cast drop shadow
    ctx.save()
    ctx.translate(12, 18)
    ctx.scale(1.30, 0.76)
    ctx.arc(0, 0, 48, 0, math.tau)
    ctx.set_source_rgba(0.26, 0.16, 0.20, 0.46)
    ctx.fill()
    ctx.restore()

    # Cup handle (coiled clay loop on top/back)
    ctx.new_path()
    ctx.arc(-30, -4, 21, math.pi * 0.45, math.pi * 1.55)
    ctx.set_source_rgb(0.88, 0.52, 0.40)
    ctx.set_line_width(10.0)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.stroke_preserve()
    ctx.set_source_rgba(1.0, 0.78, 0.68, 0.82)
    ctx.set_line_width(3.2)
    ctx.stroke()

    # Cup cylindrical body (hand-sculpted terracotta cup)
    ctx.new_path()
    ctx.move_to(-28, -31)
    ctx.line_to(32, -26)
    ctx.curve_to(41, -24, 41, 24, 32, 26)
    ctx.line_to(-28, 31)
    ctx.curve_to(-36, 31, -36, -31, -28, -31)
    ctx.close_path()

    cup_body_g = cairo.LinearGradient(0, -31, 0, 31)
    cup_body_g.add_color_stop_rgb(0.00, 0.96, 0.68, 0.54)
    cup_body_g.add_color_stop_rgb(0.42, 0.90, 0.50, 0.38)
    cup_body_g.add_color_stop_rgb(0.92, 0.72, 0.34, 0.25)
    ctx.set_source(cup_body_g)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.46, 0.22, 0.16, 0.70)
    ctx.set_line_width(2.4)
    ctx.stroke()

    # Decorative cream clay stripe around the mug barrel
    ctx.new_path()
    ctx.move_to(2, -28)
    ctx.curve_to(8, 0, 8, 0, 2, 28)
    ctx.set_source_rgba(0.98, 0.92, 0.84, 0.85)
    ctx.set_line_width(5.5)
    ctx.stroke()

    # Cup mouth ellipse (open, showing rich caramel coffee interior)
    ctx.save()
    ctx.translate(32, 0)
    ctx.scale(0.55, 1.0)
    ctx.arc(0, 0, 26, 0, math.tau)
    mouth_g = cairo.RadialGradient(-4, 0, 2, 0, 0, 26)
    mouth_g.add_color_stop_rgb(0.0, 0.28, 0.12, 0.06)
    mouth_g.add_color_stop_rgb(0.75, 0.58, 0.30, 0.16)
    mouth_g.add_color_stop_rgb(1.0, 0.94, 0.62, 0.48)
    ctx.set_source(mouth_g)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.98, 0.86, 0.76, 0.90)
    ctx.set_line_width(3.2)
    ctx.stroke()
    ctx.restore()

    ctx.restore()  # End mug
    ctx.restore()


def _draw_clay_domino(
    ctx: cairo.Context,
    dx: float,
    dy: float,
    w: float,
    h: float,
    thickness: float,
    angle_deg: float,
    pips: tuple = (3, 4),
    color: str = "#FAF5EB",
    pip_color: str = "#423232",
    is_flat: bool = False,
):
    """
    Renders a 3D pastel clay domino tile with rounded corners, 3D side thickness,
    beveled rim lighting, center dividing groove, and pressed colored pips.
    """
    ctx.save()
    ctx.translate(dx, dy)
    rad_angle = angle_deg * math.pi / 180.0
    ctx.rotate(rad_angle)

    col = _hex_to_rgb(color)
    p_col = _hex_to_rgb(pip_color)

    # 1. Cast shadow
    ctx.save()
    ctx.translate(8, 14)
    _rounded_rect(ctx, -w / 2, -h / 2, w, h, 9)
    ctx.set_source_rgba(0.22, 0.14, 0.12, 0.42)
    ctx.fill()
    ctx.restore()

    # 2. 3D Side Thickness
    ctx.save()
    off_x = thickness * 0.55 if not is_flat else 3.0
    off_y = thickness * 0.55 if not is_flat else 5.5
    ctx.translate(off_x, off_y)
    _rounded_rect(ctx, -w / 2, -h / 2, w, h, 9)
    ctx.set_source_rgb(col[0] * 0.72, col[1] * 0.72, col[2] * 0.72)
    ctx.fill()
    ctx.restore()

    # 3. Front Face Body (soft matte clay finish)
    _rounded_rect(ctx, -w / 2, -h / 2, w, h, 9)
    pat_domino = cairo.LinearGradient(-w / 2, -h / 2, w / 2, h / 2)
    pat_domino.add_color_stop_rgb(0.0, min(1.0, col[0] + 0.15), min(1.0, col[1] + 0.15), min(1.0, col[2] + 0.15))
    pat_domino.add_color_stop_rgb(0.6, col[0], col[1], col[2])
    pat_domino.add_color_stop_rgb(1.0, max(0.0, col[0] - 0.10), max(0.0, col[1] - 0.10), max(0.0, col[2] - 0.10))
    ctx.set_source(pat_domino)
    ctx.fill_preserve()

    ctx.set_line_width(2.2)
    ctx.set_source_rgba(col[0] * 0.65, col[1] * 0.65, col[2] * 0.65, 0.75)
    ctx.stroke()

    # Top-left bevel highlight
    ctx.save()
    ctx.set_line_width(1.5)
    ctx.set_source_rgba(1.0, 1.0, 1.0, 0.65)
    ctx.new_path()
    ctx.move_to(-w / 2 + 4, h / 2 - 4)
    ctx.line_to(-w / 2 + 4, -h / 2 + 4)
    ctx.line_to(w / 2 - 4, -h / 2 + 4)
    ctx.stroke()
    ctx.restore()

    # 4. Center pressed dividing groove
    ctx.save()
    ctx.set_line_width(2.4)
    ctx.set_source_rgba(0.25, 0.18, 0.18, 0.45)
    ctx.move_to(-w * 0.38, 0)
    ctx.line_to(w * 0.38, 0)
    ctx.stroke()
    ctx.set_source_rgba(1.0, 1.0, 1.0, 0.55)
    ctx.move_to(-w * 0.38, 1.6)
    ctx.line_to(w * 0.38, 1.6)
    ctx.stroke()
    ctx.restore()

    # 5. Stamped indentation dots (pips)
    def _draw_half_pips(count, center_y):
        pip_r = max(2.8, w * 0.085)
        coords = []
        if count == 1:
            coords = [(0, 0)]
        elif count == 2:
            coords = [(-w * 0.21, -h * 0.14), (w * 0.21, h * 0.14)]
        elif count == 3:
            coords = [(-w * 0.21, -h * 0.14), (0, 0), (w * 0.21, h * 0.14)]
        elif count == 4:
            coords = [(-w * 0.21, -h * 0.14), (w * 0.21, -h * 0.14),
                      (-w * 0.21, h * 0.14), (w * 0.21, h * 0.14)]
        elif count == 5:
            coords = [(-w * 0.21, -h * 0.14), (w * 0.21, -h * 0.14), (0, 0),
                      (-w * 0.21, h * 0.14), (w * 0.21, h * 0.14)]
        elif count == 6:
            coords = [(-w * 0.21, -h * 0.15), (w * 0.21, -h * 0.15),
                      (-w * 0.21, 0), (w * 0.21, 0),
                      (-w * 0.21, h * 0.15), (w * 0.21, h * 0.15)]

        for px, py in coords:
            ctx.arc(px + 0.8, center_y + py + 1.0, pip_r, 0, math.tau)
            ctx.set_source_rgba(0.15, 0.10, 0.10, 0.45)
            ctx.fill()
            ctx.arc(px, center_y + py, pip_r, 0, math.tau)
            ctx.set_source_rgb(*p_col)
            ctx.fill_preserve()
            ctx.set_line_width(0.8)
            ctx.set_source_rgba(1.0, 1.0, 1.0, 0.40)
            ctx.stroke()

    _draw_half_pips(pips[0], -h * 0.24)
    _draw_half_pips(pips[1], h * 0.24)

    ctx.restore()


def draw_domino_cascade_and_bridge(ctx: cairo.Context, pan_dx: float = 0.0):
    """
    Renders the chain of toppling pastel clay dominoes on the left bank leading into
    an adorable colorful clay domino bridge spanning across the S-curved caramel-latte stream!
    """
    ctx.save()
    ctx.translate(-pan_dx, 0)

    # 1. Left Bank Domino Cascade (chain reaction toppling toward the stream)
    cascade_dominoes = [
        # (x, y, angle_deg, pips, body_hex, pip_hex)
        (465.0, 648.0, 68.0, (5, 3), "#FAF5EB", "#D94B4B"),
        (532.0, 646.0, 50.0, (2, 6), "#A6DFCE", "#2D6A58"),
        (598.0, 645.0, 34.0, (4, 1), "#F6AAB8", "#9E2B48"),
        (662.0, 645.0, 18.0, (6, 5), "#F8DE82", "#B8621B"),
    ]
    for dx, dy, ang, pips, col, pcol in cascade_dominoes:
        _draw_clay_domino(ctx, dx, dy, w=42, h=86, thickness=15,
                          angle_deg=ang, pips=pips, color=col, pip_color=pcol, is_flat=False)

    # 2. Domino Bridge spanning across the S-curved caramel-latte stream (x: 730 -> 975)
    bridge_dominoes = [
        # (x, y, angle_deg, pips, body_hex, pip_hex)
        (735.0, 650.0, 84.0, (3, 5), "#88CDE8", "#1F5678"),   # Near bank bridgehead
        (812.0, 655.0, 88.0, (1, 4), "#D0C2EA", "#4B3678"),   # Mid stream arch 1
        (890.0, 658.0, 91.0, (5, 2), "#F8B0A0", "#8F3224"),   # Mid stream arch 2
        (968.0, 660.0, 93.0, (2, 4), "#92DFD4", "#24665C"),   # Far bank landing!
    ]
    for bx, by, bang, bpips, bcol, bpcol in bridge_dominoes:
        # Creamy caramel displacement ripple around bridge tiles resting in the stream
        ctx.save()
        ctx.translate(bx, by + 4.0)
        ctx.scale(1.32, 0.48)
        ctx.arc(0, 0, 44.0, 0, math.tau)
        ctx.set_source_rgba(0.98, 0.88, 0.74, 0.55)
        ctx.set_line_width(3.5)
        ctx.stroke()
        ctx.restore()

        _draw_clay_domino(ctx, bx, by, w=42, h=86, thickness=14,
                          angle_deg=bang, pips=bpips, color=bcol, pip_color=bpcol, is_flat=True)

    ctx.restore()


def draw_clay_macaron(
    ctx: cairo.Context,
    cx: float,
    cy: float,
    radius: float,
    tilt: float,
    shell_rgb: tuple,
    cream_rgb: tuple,
    is_airborne: bool = False,
):
    """
    Renders v3's authentic tactile French clay macaron with rounded cookie shells,
    frilly ruffled "pied" (clay foot frills), and thick creamy plasticine filling.
    """
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(tilt)

    sh_dist = 36 if is_airborne else 14
    sh_alpha = 0.25 if is_airborne else 0.48
    ctx.save()
    ctx.translate(sh_dist * 0.4, sh_dist)
    ctx.scale(1.0, 0.45)
    ctx.arc(0, 0, radius * 1.08, 0, math.tau)
    ctx.set_source_rgba(0.24, 0.15, 0.20, sh_alpha)
    ctx.fill()
    ctx.restore()

    # Bottom shell
    ctx.save()
    ctx.translate(0, radius * 0.22)
    ctx.scale(1.0, 0.42)
    ctx.arc(0, 0, radius, 0, math.tau)
    b_grad = cairo.RadialGradient(-radius * 0.2, -radius * 0.3, radius * 0.1, 0, radius * 0.2, radius)
    b_grad.add_color_stop_rgb(0.0, min(1.0, shell_rgb[0] * 1.18), min(1.0, shell_rgb[1] * 1.18), min(1.0, shell_rgb[2] * 1.18))
    b_grad.add_color_stop_rgb(0.7, shell_rgb[0], shell_rgb[1], shell_rgb[2])
    b_grad.add_color_stop_rgb(1.0, shell_rgb[0] * 0.70, shell_rgb[1] * 0.70, shell_rgb[2] * 0.70)
    ctx.set_source(b_grad)
    ctx.fill()
    ctx.restore()

    # Bottom ruffled foot / pied
    ctx.save()
    ctx.set_source_rgb(shell_rgb[0] * 0.85, shell_rgb[1] * 0.85, shell_rgb[2] * 0.85)
    for fx in np.linspace(-radius * 0.88, radius * 0.88, 14):
        fy = radius * 0.16 + 2.0 * math.sin(fx * 0.25)
        ctx.arc(fx, fy, 4.4, 0, math.tau)
        ctx.fill()
    ctx.restore()

    # Thick round clay cream filling
    ctx.save()
    ctx.scale(0.92, 0.28)
    ctx.arc(0, 0, radius * 0.94, 0, math.tau)
    cr_grad = cairo.RadialGradient(-radius * 0.2, -radius * 0.2, 5, 0, 0, radius)
    cr_grad.add_color_stop_rgb(0.0, min(1.0, cream_rgb[0] * 1.25), min(1.0, cream_rgb[1] * 1.25), min(1.0, cream_rgb[2] * 1.25))
    cr_grad.add_color_stop_rgb(1.0, cream_rgb[0] * 0.80, cream_rgb[1] * 0.80, cream_rgb[2] * 0.80)
    ctx.set_source(cr_grad)
    ctx.fill()
    ctx.restore()

    # Top ruffled foot / pied
    ctx.save()
    ctx.set_source_rgb(shell_rgb[0] * 0.90, shell_rgb[1] * 0.90, shell_rgb[2] * 0.90)
    for fx in np.linspace(-radius * 0.88, radius * 0.88, 14):
        fy = -radius * 0.08 + 2.0 * math.sin(fx * 0.25 + 1.2)
        ctx.arc(fx, fy, 4.4, 0, math.tau)
        ctx.fill()
    ctx.restore()

    # Top shell
    ctx.save()
    ctx.translate(0, -radius * 0.24)
    ctx.scale(1.0, 0.44)
    ctx.arc(0, 0, radius, 0, math.tau)
    t_grad = cairo.RadialGradient(-radius * 0.25, -radius * 0.35, radius * 0.1, 0, 0, radius * 1.1)
    t_grad.add_color_stop_rgb(0.00, min(1.0, shell_rgb[0] * 1.28), min(1.0, shell_rgb[1] * 1.28), min(1.0, shell_rgb[2] * 1.28))
    t_grad.add_color_stop_rgb(0.55, shell_rgb[0], shell_rgb[1], shell_rgb[2])
    t_grad.add_color_stop_rgb(1.00, shell_rgb[0] * 0.68, shell_rgb[1] * 0.68, shell_rgb[2] * 0.68)
    ctx.set_source(t_grad)
    ctx.fill_preserve()
    ctx.set_source_rgba(shell_rgb[0] * 0.50, shell_rgb[1] * 0.50, shell_rgb[2] * 0.50, 0.60)
    ctx.set_line_width(2.0)
    ctx.stroke()

    ctx.save()
    ctx.translate(-radius * 0.3, -radius * 0.2)
    ctx.scale(0.55, 0.28)
    hl_g = cairo.RadialGradient(0, 0, 2, 0, 0, radius * 0.5)
    hl_g.add_color_stop_rgba(0.0, 1.0, 1.0, 1.0, 0.52)
    hl_g.add_color_stop_rgba(1.0, 1.0, 1.0, 1.0, 0.0)
    ctx.set_source(hl_g)
    ctx.arc(0, 0, radius * 0.5, 0, math.tau)
    ctx.fill()
    ctx.restore()

    ctx.restore()
    ctx.restore()


def draw_clay_block(
    ctx: cairo.Context,
    cx: float,
    cy: float,
    size: float,
    tilt: float,
    color_rgb: tuple,
    letter: str = "",
    is_airborne: bool = False,
):
    """Renders a hand-pinched, rounded-corner colorful clay play block."""
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(tilt)

    s = size * 0.5
    r_corn = size * 0.16

    sh_dist = 38 if is_airborne else 15
    sh_alpha = 0.24 if is_airborne else 0.45
    ctx.save()
    ctx.translate(sh_dist * 0.5, sh_dist)
    ctx.scale(1.1, 0.55)
    ctx.arc(0, 0, s * 1.15, 0, math.tau)
    ctx.set_source_rgba(0.24, 0.15, 0.20, sh_alpha)
    ctx.fill()
    ctx.restore()

    ctx.new_path()
    ctx.arc(-s + r_corn, -s + r_corn, r_corn, math.pi, math.pi * 1.5)
    ctx.arc(s - r_corn, -s + r_corn, r_corn, math.pi * 1.5, 0)
    ctx.arc(s - r_corn, s - r_corn, r_corn, 0, math.pi * 0.5)
    ctx.arc(-s + r_corn, s - r_corn, r_corn, math.pi * 0.5, math.pi)
    ctx.close_path()

    b_grad = cairo.LinearGradient(-s, -s, s, s)
    b_grad.add_color_stop_rgb(0.00, min(1.0, color_rgb[0] * 1.28), min(1.0, color_rgb[1] * 1.28), min(1.0, color_rgb[2] * 1.28))
    b_grad.add_color_stop_rgb(0.55, color_rgb[0], color_rgb[1], color_rgb[2])
    b_grad.add_color_stop_rgb(1.00, color_rgb[0] * 0.70, color_rgb[1] * 0.70, color_rgb[2] * 0.70)
    ctx.set_source(b_grad)
    ctx.fill_preserve()

    ctx.set_source_rgba(min(1.0, color_rgb[0] * 1.35), min(1.0, color_rgb[1] * 1.35), min(1.0, color_rgb[2] * 1.35), 0.80)
    ctx.set_line_width(3.2)
    ctx.stroke()

    if letter:
        ctx.save()
        if letter == "✦":
            draw_four_point_star(ctx, 1.5, 2.0, s * 0.45, s * 0.12, rot=0.1)
            ctx.set_source_rgba(0.25, 0.14, 0.18, 0.40)
            ctx.fill()
            draw_four_point_star(ctx, 0, 0, s * 0.45, s * 0.12, rot=0.1)
            ctx.set_source_rgba(1.0, 1.0, 1.0, 0.92)
            ctx.fill()
        else:
            ctx.select_font_face("DejaVu Sans", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
            ctx.set_font_size(size * 0.52)
            ctx.move_to(-s * 0.28 + 1.5, s * 0.28 + 2.0)
            ctx.set_source_rgba(0.22, 0.14, 0.18, 0.38)
            ctx.show_text(letter)
            ctx.move_to(-s * 0.28, s * 0.28)
            ctx.set_source_rgba(1.0, 1.0, 1.0, 0.95)
            ctx.show_text(letter)
        ctx.restore()

    ctx.restore()


def draw_clay_dice(
    ctx: cairo.Context,
    cx: float,
    cy: float,
    size: float,
    tilt: float,
    body_rgb: tuple = (0.98, 0.96, 0.91),
    pip_rgb: tuple = (0.88, 0.35, 0.40),
):
    """Renders a soft, hand-pinched polymer clay die with pressed round indentation pips."""
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(tilt)

    s = size * 0.5
    r_corn = size * 0.20

    ctx.save()
    ctx.translate(12, 16)
    ctx.scale(1.1, 0.5)
    ctx.arc(0, 0, s * 1.18, 0, math.tau)
    ctx.set_source_rgba(0.24, 0.15, 0.20, 0.46)
    ctx.fill()
    ctx.restore()

    ctx.new_path()
    ctx.arc(-s + r_corn, -s + r_corn, r_corn, math.pi, math.pi * 1.5)
    ctx.arc(s - r_corn, -s + r_corn, r_corn, math.pi * 1.5, 0)
    ctx.arc(s - r_corn, s - r_corn, r_corn, 0, math.pi * 0.5)
    ctx.arc(-s + r_corn, s - r_corn, r_corn, math.pi * 0.5, math.pi)
    ctx.close_path()

    d_grad = cairo.RadialGradient(-s * 0.4, -s * 0.4, 4, 0, 0, s * 1.4)
    d_grad.add_color_stop_rgb(0.00, min(1.0, body_rgb[0] * 1.05), min(1.0, body_rgb[1] * 1.05), min(1.0, body_rgb[2] * 1.05))
    d_grad.add_color_stop_rgb(0.65, body_rgb[0], body_rgb[1], body_rgb[2])
    d_grad.add_color_stop_rgb(1.00, body_rgb[0] * 0.84, body_rgb[1] * 0.84, body_rgb[2] * 0.84)
    ctx.set_source(d_grad)
    ctx.fill_preserve()
    ctx.set_source_rgba(body_rgb[0] * 0.68, body_rgb[1] * 0.68, body_rgb[2] * 0.68, 0.60)
    ctx.set_line_width(2.4)
    ctx.stroke()

    pip_r = size * 0.09
    pips = [
        (-s * 0.48, -s * 0.48),
        (s * 0.48, -s * 0.48),
        (0.0, 0.0),
        (-s * 0.48, s * 0.48),
        (s * 0.48, s * 0.48),
    ]
    for px, py in pips:
        ctx.save()
        ctx.arc(px, py, pip_r, 0, math.tau)
        ctx.set_source_rgb(*pip_rgb)
        ctx.fill_preserve()
        ctx.set_source_rgba(0.35, 0.12, 0.16, 0.55)
        ctx.set_line_width(1.6)
        ctx.stroke()
        ctx.new_path()
        ctx.arc(px, py + 1.0, pip_r, 0.2, math.pi * 0.8)
        ctx.set_source_rgba(1.0, 1.0, 1.0, 0.78)
        ctx.set_line_width(1.1)
        ctx.stroke()
        ctx.restore()

    ctx.restore()


def draw_clay_pencil(ctx: cairo.Context, px: float, py: float, length: float = 280.0, angle: float = 0.22):
    """Renders a sculpted miniature polymer clay pencil with pink eraser, brass ferrule, and wood tip."""
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(angle)

    h_body = 24.0
    w_body = length * 0.70

    # Drop shadow
    ctx.save()
    ctx.translate(8, 14)
    _rounded_rect(ctx, -w_body * 0.65, -h_body * 0.5, length * 0.95, h_body, 8)
    ctx.set_source_rgba(0.24, 0.15, 0.20, 0.40)
    ctx.fill()
    ctx.restore()

    # Hexagonal yellow/mint clay barrel
    _rounded_rect(ctx, -w_body * 0.5, -h_body * 0.5, w_body, h_body, 5)
    pat_p = cairo.LinearGradient(0, -h_body * 0.5, 0, h_body * 0.5)
    pat_p.add_color_stop_rgb(0.0, 1.00, 0.88, 0.38)
    pat_p.add_color_stop_rgb(0.45, 0.95, 0.78, 0.24)
    pat_p.add_color_stop_rgb(1.0, 0.78, 0.56, 0.14)
    ctx.set_source(pat_p)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.62, 0.42, 0.10, 0.55)
    ctx.set_line_width(1.8)
    ctx.stroke()

    # Facet highlight line
    ctx.move_to(-w_body * 0.48, -h_body * 0.18)
    ctx.line_to(w_body * 0.48, -h_body * 0.18)
    ctx.set_source_rgba(1.0, 1.0, 1.0, 0.48)
    ctx.set_line_width(1.6)
    ctx.stroke()

    # Wood cone & colored lead tip
    tip_x = w_body * 0.5 + 46.0
    ctx.new_path()
    ctx.move_to(w_body * 0.5, -h_body * 0.48)
    ctx.line_to(tip_x, 0)
    ctx.line_to(w_body * 0.5, h_body * 0.48)
    ctx.close_path()
    ctx.set_source_rgb(0.94, 0.84, 0.70)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.68, 0.54, 0.40, 0.60)
    ctx.set_line_width(1.5)
    ctx.stroke()

    ctx.new_path()
    ctx.move_to(tip_x - 15.0, -h_body * 0.16)
    ctx.line_to(tip_x, 0)
    ctx.line_to(tip_x - 15.0, h_body * 0.16)
    ctx.close_path()
    ctx.set_source_rgb(0.28, 0.26, 0.32)
    ctx.fill()

    # Brass ferrule & coral-pink clay eraser
    ferrule_w = 18.0
    ferrule_x = -w_body * 0.5 - ferrule_w
    _rounded_rect(ctx, ferrule_x, -h_body * 0.5 + 1, ferrule_w, h_body - 2, 3)
    ctx.set_source_rgb(0.86, 0.76, 0.46)
    ctx.fill()

    eraser_w = 26.0
    eraser_x = ferrule_x - eraser_w
    _rounded_rect(ctx, eraser_x, -h_body * 0.5 + 1.5, eraser_w, h_body - 3, 7)
    ctx.set_source_rgb(0.95, 0.58, 0.66)
    ctx.fill()

    ctx.restore()


def draw_desk_props_left_and_right(ctx: cairo.Context, pan_dx: float = 0.0):
    """
    Renders v3's signature tabletop props across the left and right banks:
      - Left bank: colorful clay blocks ("4", "✦"), vanilla clay die, rose macaron
      - Right bank & foreground: pastel macarons (mint, sakura pink, lemon-vanilla),
        sky-blue clay die, clay pencil, miniature clay succulent in terracotta pot,
        and scattered mini clay stars!
    """
    ctx.save()
    ctx.translate(-pan_dx, 0)

    # --- Left Bank Props (Framing the mug & domino cascade) ---
    draw_clay_block(ctx, 415.0, 458.0, size=62, tilt=-0.38, color_rgb=(1.00, 0.86, 0.35), letter="✦", is_airborne=True)
    draw_clay_macaron(
        ctx, cx=505.0, cy=420.0, radius=32, tilt=0.32,
        shell_rgb=(0.74, 0.62, 0.90), cream_rgb=(1.00, 0.98, 0.90), is_airborne=True
    )
    draw_clay_dice(ctx, cx=390.0, cy=585.0, size=56, tilt=-0.18)
    draw_clay_block(ctx, 325.0, 655.0, size=62, tilt=-0.15, color_rgb=(0.32, 0.68, 0.98), letter="4", is_airborne=False)
    draw_clay_macaron(
        ctx, cx=375.0, cy=735.0, radius=36, tilt=0.12,
        shell_rgb=(0.95, 0.58, 0.66), cream_rgb=(1.00, 1.00, 0.96), is_airborne=False
    )

    # --- Right Bank & Foreground Props (Macaron stepping stones, dice, succulent, pencil) ---
    # 1. Lemon-Vanilla Macaron stepping stone at (1235, 675)
    draw_clay_macaron(
        ctx, cx=1235.0, cy=675.0, radius=42, tilt=-0.08,
        shell_rgb=(0.98, 0.86, 0.55), cream_rgb=(0.58, 0.32, 0.20), is_airborne=False
    )
    # 2. Pistachio-Mint Macaron stepping stone at (1375, 710)
    draw_clay_macaron(
        ctx, cx=1375.0, cy=710.0, radius=38, tilt=0.16,
        shell_rgb=(0.62, 0.86, 0.75), cream_rgb=(1.00, 0.98, 0.92), is_airborne=False
    )
    # 3. Sakura-Pink Macaron at (1305, 765)
    draw_clay_macaron(
        ctx, cx=1305.0, cy=765.0, radius=35, tilt=-0.14,
        shell_rgb=(0.96, 0.64, 0.72), cream_rgb=(1.00, 0.98, 0.94), is_airborne=False
    )
    # 4. Pastel Sky-Blue Clay Die at (1130, 735)
    draw_clay_dice(
        ctx, cx=1130.0, cy=735.0, size=54, tilt=-0.28,
        body_rgb=(0.68, 0.88, 0.96), pip_rgb=(0.18, 0.38, 0.58)
    )
    # 5. Dawn-Coral Block "G" at (1485, 685)
    draw_clay_block(ctx, 1485.0, 685.0, size=62, tilt=0.35, color_rgb=(0.88, 0.42, 0.46), letter="G", is_airborne=False)

    # 6. Hand-pinched Clay Succulent in Terracotta Mini-Pot at (1585, 585)
    pot_x, pot_y = 1585.0, 585.0
    ctx.save()
    ctx.translate(pot_x + 18, pot_y + 55)
    ctx.scale(1.25, 0.48)
    ctx.arc(0, 0, 55, 0, math.tau)
    ctx.set_source_rgba(0.24, 0.15, 0.20, 0.46)
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.new_path()
    ctx.move_to(pot_x - 46, pot_y)
    ctx.line_to(pot_x + 46, pot_y)
    ctx.line_to(pot_x + 34, pot_y + 58)
    ctx.line_to(pot_x - 34, pot_y + 58)
    ctx.close_path()
    pot_g = cairo.LinearGradient(pot_x - 46, pot_y, pot_x + 46, pot_y + 58)
    pot_g.add_color_stop_rgb(0.00, 0.94, 0.60, 0.46)
    pot_g.add_color_stop_rgb(1.00, 0.66, 0.32, 0.24)
    ctx.set_source(pot_g)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.48, 0.22, 0.16, 0.65)
    ctx.set_line_width(2.4)
    ctx.stroke()

    ctx.save()
    ctx.scale(1.0, 0.35)
    ctx.arc(pot_x, pot_y / 0.35, 50, 0, math.tau)
    ctx.set_source_rgb(0.96, 0.66, 0.52)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.48, 0.22, 0.16, 0.70)
    ctx.set_line_width(2.2)
    ctx.stroke()
    ctx.restore()

    petal_angles = np.linspace(0, math.tau, 10, endpoint=False)
    for a in petal_angles:
        px = pot_x + 28 * math.cos(a)
        py = pot_y - 14 + 18 * math.sin(a)
        ctx.save()
        ctx.translate(px, py)
        ctx.rotate(a + math.pi * 0.5)
        ctx.scale(0.70, 1.25)
        ctx.arc(0, 0, 16, 0, math.tau)
        pet_g = cairo.RadialGradient(0, 6, 2, 0, -9, 18)
        pet_g.add_color_stop_rgb(0.0, 0.68, 0.88, 0.78)
        pet_g.add_color_stop_rgb(0.7, 0.58, 0.80, 0.70)
        pet_g.add_color_stop_rgb(1.0, 0.94, 0.55, 0.64)
        ctx.set_source(pet_g)
        ctx.fill_preserve()
        ctx.set_source_rgba(0.38, 0.60, 0.50, 0.50)
        ctx.set_line_width(1.4)
        ctx.stroke()
        ctx.restore()

    for a in petal_angles[:5] + 0.35:
        px = pot_x + 14 * math.cos(a)
        py = pot_y - 20 + 9 * math.sin(a)
        ctx.save()
        ctx.translate(px, py)
        ctx.scale(0.55, 0.95)
        ctx.arc(0, 0, 12, 0, math.tau)
        ctx.set_source_rgb(0.86, 0.96, 0.84)
        ctx.fill()
        ctx.restore()
    ctx.restore()

    # 7. Clay Pencil / Modeling Tool resting in foreground right at (1330, 825)
    draw_clay_pencil(ctx, px=1330.0, py=825.0, length=270.0, angle=0.18)

    # 8. Scattered mini pastel clay stars and crumbs
    stars_data = [
        (1145, 595, 13.0, (1.00, 0.85, 0.35)),
        (1205, 785, 11.0, (0.88, 0.42, 0.46)),
        (1545, 735, 12.0, (0.32, 0.68, 0.98)),
        (1680, 665, 14.0, (0.74, 0.62, 0.90)),
    ]
    for sx_s, sy_s, sr_s, sc_s in stars_data:
        ctx.save()
        draw_four_point_star(ctx, sx_s + 2, sy_s + 4, sr_s, sr_s * 0.28, rot=0.2)
        ctx.set_source_rgba(0.24, 0.15, 0.20, 0.35)
        ctx.fill()
        draw_four_point_star(ctx, sx_s, sy_s, sr_s, sr_s * 0.28, rot=0.2)
        ctx.set_source_rgb(*sc_s)
        ctx.fill_preserve()
        ctx.set_source_rgba(1.0, 1.0, 1.0, 0.75)
        ctx.set_line_width(1.4)
        ctx.stroke()
        ctx.restore()

    ctx.restore()


def apply_tilt_shift_dof(pil_img: Image.Image) -> Image.Image:
    """
    Applies gentle, realistic macro tilt-shift depth-of-field blur:
      - Keeps the pastel clay hills (y: 230..480) and entire desktop action zone (y: 480..850)
        clear and recognizable while softly blurring the extreme top (y < 220) and bottom (y > 860).
    """
    blur_img = pil_img.filter(ImageFilter.GaussianBlur(radius=16))

    arr_crisp = np.asarray(pil_img, dtype=np.float32)
    arr_blur = np.asarray(blur_img, dtype=np.float32)

    y_coords = np.arange(H, dtype=np.float32)[:, None]

    # Top blur: gentle transition from y=220 up to y=0
    top_t = np.clip((220.0 - y_coords) / 220.0, 0.0, 1.0)
    top_mask = top_t * top_t * (3.0 - 2.0 * top_t) * 0.85

    # Bottom blur: gentle transition from y=860 down to y=1080
    bot_t = np.clip((y_coords - 860.0) / (H - 860.0), 0.0, 1.0)
    bot_mask = bot_t * bot_t * (3.0 - 2.0 * bot_t) * 0.85

    total_mask = np.clip(top_mask + bot_mask, 0.0, 1.0)[..., None]

    arr_out = arr_crisp * (1.0 - total_mask) + arr_blur * total_mask
    return Image.fromarray(np.clip(arr_out, 0, 255).astype(np.uint8), mode="RGBA")


# ---------------------------------------------------------------------------
# API Contract 3: render_world
# ---------------------------------------------------------------------------
def render_world(cam_x: float, cam_y: float, t: float, state: dict = None) -> Image.Image:
    """
    Renders the 1920x1080 viewport for World 10 at (cam_x, cam_y) and timestamp t.
    Returns RGB PIL Image (1920x1080) with Tilt-Shift Shallow Depth of Field and NO UI badge.
    """
    if state is None:
        state = {}

    pan_dx = (cam_x - 2880.0) * 0.55

    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surface)

    # 1. Background studio diorama: layered pastel clay hills & coiled clay trees/clouds on wires/toothpicks
    draw_clay_tabletop_and_backdrop(ctx, pan_dx=pan_dx)

    # 2. Toppled Terracotta Clay Mug & S-Curved Caramel-Latte Stream with 3D Foam Swirls
    draw_s_curve_caramel_latte_stream_and_mug(ctx, pan_dx=pan_dx)

    # 3. Domino Cascade on Left Bank + Colorful Domino Bridge across the Caramel Stream
    draw_domino_cascade_and_bridge(ctx, pan_dx=pan_dx)

    # 4. Left & Right Tabletop Props (v3 Macarons, Clay Blocks, Dice, Succulent Pot, Clay Pencil)
    draw_desk_props_left_and_right(ctx, pan_dx=pan_dx)

    # 5. Far Bank Clay Star ✦ with Thumbprint Impression waiting across the Domino Bridge!
    far_star_x = state.get("star_cx", 1048.0 - pan_dx)
    far_star_y = state.get("star_cy", 615.0)
    draw_star(ctx, far_star_x, far_star_y, r=36.0, rot=0.14, t=t)

    # 6. Fingerprint-Textured Polymer Clay Slime (diameter ~138px, radius=69px) leaping onto the Domino Bridge!
    slime_cx = state.get("slime_cx", 695.0 - pan_dx)
    slime_cy = state.get("slime_cy", 548.0)
    slime_r = state.get("slime_r", 69.0)  # Diameter = 138px (130~140px target!)
    squash_y = state.get("slime_squash_y", 0.88)
    tilt = state.get("slime_tilt", 0.15)
    eye_mode = state.get("slime_eye_mode", "pill")

    draw_slime(
        ctx,
        cx=slime_cx,
        cy=slime_cy,
        radius=slime_r,
        squash_y=squash_y,
        tilt=tilt,
        look=(0.52, -0.22),
        eye_mode=eye_mode,
        t=t,
        draw_crown_star=True,
    )

    surface.flush()
    pil_img = cairo_to_pil(surface)

    # 7. Apply subtle global clay surface tactile grain
    arr = np.asarray(pil_img, dtype=np.float32) / 255.0
    clay_grain = make_clay_noise(W, H, seed=101)
    arr[..., :3] = np.clip(arr[..., :3] + clay_grain[..., None] * 0.012, 0.0, 1.0)
    pil_grain = Image.fromarray((arr * 255.0).astype(np.uint8), mode="RGBA")

    # 8. Apply gentle Macro Tilt-Shift Depth-of-Field blur (NO UI badge!)
    pil_tilt_shift = apply_tilt_shift_dof(pil_grain)

    return pil_tilt_shift.convert("RGB")


# ---------------------------------------------------------------------------
# API Contract 4: render_keyframe
# ---------------------------------------------------------------------------
def render_keyframe() -> Image.Image:
    """Renders the canonical World 10 keyframe (1920x1080 RGB PIL Image)."""
    return render_world(cam_x=2880.0, cam_y=540.0, t=6.0)


if __name__ == "__main__":
    os.makedirs(os.path.dirname(os.path.abspath(OUT_PATH)), exist_ok=True)
    img = render_keyframe()
    img.save(OUT_PATH, format="PNG", quality=96)
    print(f"Successfully rendered World 10 Claymation v5 Keyframe -> {OUT_PATH}")
