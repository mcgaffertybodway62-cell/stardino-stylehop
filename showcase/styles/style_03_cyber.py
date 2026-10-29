#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StyleHop · World 03 · 霓虹破界疾驰列车 · 极简 3D→2D 潮流涂鸦 (style_03_cyber.py)
-----------------------------------------------------------------------------
Visual Concept:
- Minimalist 3D -> 2D trendy anime visual: low-poly geometry hard facets + cel-shading
  flat color + strong low-angle perspective.
- Deep blue background, few geometric buildings & neon lines, >= 35% negative space.
- Central purple & fluorescent yellow street graffiti frame.
- Train rushes out of frame towards front-right, giant train head breaking frame borders.
- 3D -> 2D dimension transition via vertex interpolation lerp(persp, flat, k).
  Inside frame: flat 2D poster style, fewer tones, thicker outlines.
  Outside frame: full 3D faceted volume with 3-tone cel shading.
- Two-pass outline: pass 1 silhouette thick outline, pass 2 facet fill + internal crease lines.
- Strict 5 colors (#0B0B14, #F4F4EE, #8A3CFF, #E6FF1F, #00E5FF) + deep blue bg (#070C2E/#0D1748/#16236A).
- Protagonist exception: 3-tone hard-edge cel (#4FADFF / #7559E8 / #D96570 - only warm pink in scene).
- Strictly mouthless, noseless, blushless; -30° pill eyes, far eye 81% width of near eye.
- Escaping guiding star ✦.

Produces:
1. styles/style_03_cyber.png (Hero Breakout Frame A)
2. styles/style_03_cyber_parkour.png (Parkour 3/4 View Frame B)
"""

import math
import os
import sys
import time
import numpy as np
import cairo
from PIL import Image, ImageDraw

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from corelib.math_ops import clamp, lerp
from corelib.camera import get_font

# -----------------------------------------------------------------------------
# Constants & Color Palette
# -----------------------------------------------------------------------------
W, H = 1920, 1080

# Strictly 5 colors
COLOR_BLACK = (11 / 255.0, 11 / 255.0, 20 / 255.0)       # #0B0B14
COLOR_WHITE = (244 / 255.0, 244 / 255.0, 238 / 255.0)    # #F4F4EE
COLOR_PURPLE = (138 / 255.0, 60 / 255.0, 255 / 255.0)    # #8A3CFF
COLOR_YELLOW = (230 / 255.0, 255 / 255.0, 31 / 255.0)    # #E6FF1F
COLOR_CYAN = (0 / 255.0, 229 / 255.0, 255 / 255.0)       # #00E5FF

# Deep blue background steps (flat cel-shaded)
BG_DARK = (7 / 255.0, 12 / 255.0, 46 / 255.0)            # #070C2E
BG_MID = (13 / 255.0, 23 / 255.0, 72 / 255.0)            # #0D1748
BG_LIGHT = (22 / 255.0, 35 / 255.0, 106 / 255.0)         # #16236A

# Protagonist Slime exception (Brand 3 colors, 3-step hard-edge cel)
SLIME_SKY = (79 / 255.0, 173 / 255.0, 255 / 255.0)       # #4FADFF (top-left)
SLIME_IRIS = (117 / 255.0, 89 / 255.0, 232 / 255.0)     # #7559E8 (mid)
SLIME_CORAL = (217 / 255.0, 101 / 255.0, 112 / 255.0)   # #D96570 (bottom-right - ONLY warm pink!)


# -----------------------------------------------------------------------------
# 1. 3D Camera & Minimal Polygon Pipeline
# -----------------------------------------------------------------------------

class Camera3D:
    def __init__(self, eye, target, up=np.array([0.0, 1.0, 0.0]), fov_deg=60.0, roll_deg=0.0):
        self.eye = np.array(eye, dtype=np.float64)
        self.target = np.array(target, dtype=np.float64)
        self.fov = math.radians(fov_deg)
        self.focal = (W * 0.5) / math.tan(self.fov * 0.5)

        # Build view matrix: forward points from eye to target
        fwd = self.target - self.eye
        norm_fwd = np.linalg.norm(fwd)
        self.forward = fwd / (norm_fwd if norm_fwd > 1e-6 else 1.0)

        up = np.array(up, dtype=np.float64)
        r = np.cross(up, self.forward)
        norm_r = np.linalg.norm(r)
        self.right = r / (norm_r if norm_r > 1e-6 else 1.0)

        self.true_up = np.cross(self.forward, self.right)

        # Apply roll around forward axis
        if roll_deg != 0.0:
            rad = math.radians(roll_deg)
            cr, sr = math.cos(rad), math.sin(rad)
            new_r = cr * self.right + sr * self.true_up
            new_u = -sr * self.right + cr * self.true_up
            self.right = new_r
            self.true_up = new_u

        # Camera coordinate transformation matrix
        self.R = np.vstack([self.right, self.true_up, self.forward])

    def to_cam(self, p_world):
        """Transform world coordinate to camera space."""
        return self.R @ (np.array(p_world, dtype=np.float64) - self.eye)


def clip_polygon_near(poly_cam, near_z=0.6):
    """Sutherland-Hodgman polygon clipping against camera near plane z >= near_z."""
    n = len(poly_cam)
    if n < 3:
        return []
    clipped = []
    for i in range(n):
        p1 = poly_cam[i]
        p2 = poly_cam[(i + 1) % n]
        z1, z2 = p1[2], p2[2]
        in1 = (z1 >= near_z)
        in2 = (z2 >= near_z)
        if in1 and in2:
            clipped.append(p2)
        elif in1 and not in2:
            t = (near_z - z1) / (z2 - z1 + 1e-9)
            inter = p1 + t * (p2 - p1)
            clipped.append(inter)
        elif not in1 and in2:
            t = (near_z - z1) / (z2 - z1 + 1e-9)
            inter = p1 + t * (p2 - p1)
            clipped.append(inter)
            clipped.append(p2)
    return clipped


def project_vertex_hybrid(p_cam, focal, z_flat_ref=16.0, k_flat=0.0):
    """
    Project 3D camera-space vertex to 2D screen coordinates with 3D->2D lerp.
    k_flat in [0, 1]: 0 = full 3D perspective, 1 = flat orthographic/poster projection.
    """
    xc, yc, zc = p_cam[0], p_cam[1], max(0.2, p_cam[2])

    # Perspective projection
    xp = W * 0.5 + (xc / zc) * focal
    yp = H * 0.5 - (yc / zc) * focal

    # Flat poster projection (orthogonal compression against frame reference depth)
    xf = W * 0.5 + (xc / z_flat_ref) * focal
    yf = H * 0.5 - (yc / z_flat_ref) * focal

    # Lerp
    xs = (1.0 - k_flat) * xp + k_flat * xf
    ys = (1.0 - k_flat) * yp + k_flat * yf
    return (xs, ys)


# -----------------------------------------------------------------------------
# 2. Train Mesh Generator
# -----------------------------------------------------------------------------

def build_train_mesh(n_cars=4, car_len=10.0, car_w=3.8, car_h=3.6, gap=2.2, z_offset=0.0):
    """
    Builds a clean low-poly train mesh.
    Train runs along Z axis:
    Car 0 (Head): Front nose at +Z, facing forward-right
    Cars 1..n-1: Passenger cars connected with accordion gangways
    """
    faces = []
    hw = car_w * 0.5
    y_skirt = 0.5
    y_floor = 1.0
    y_stripe_bot = 2.0
    y_stripe_top = 2.6
    y_eave = 3.9
    y_roof = 4.4
    rw = hw * 0.80

    for c in range(n_cars):
        # Car positioning: Car 0 is at front (positive Z), Car c is at -(c)*(car_len + gap)
        z_start = z_offset - c * (car_len + gap)
        z_end = z_start + car_len
        is_head = (c == 0)

        # Accordion gangway between cars (风挡连接器，保证车身连续性)
        if c > 0:
            z_gw_start = z_end
            z_gw_end = z_end + gap
            gw_hw = hw * 0.75
            gw_y_top = y_eave * 0.95
            faces.append(dict(
                mat="gangway",
                pts=[[-gw_hw, y_floor, z_gw_start], [-gw_hw, y_floor, z_gw_end],
                     [-gw_hw, gw_y_top, z_gw_end], [-gw_hw, gw_y_top, z_gw_start]]
            ))
            faces.append(dict(
                mat="gangway",
                pts=[[gw_hw, y_floor, z_gw_end], [gw_hw, y_floor, z_gw_start],
                     [gw_hw, gw_y_top, z_gw_start], [gw_hw, gw_y_top, z_gw_end]]
            ))
            faces.append(dict(
                mat="gangway",
                pts=[[-gw_hw, gw_y_top, z_gw_start], [-gw_hw, gw_y_top, z_gw_end],
                     [gw_hw, gw_y_top, z_gw_end], [gw_hw, gw_y_top, z_gw_start]]
            ))

        if not is_head:
            # Passenger Car
            # Roof Top
            faces.append(dict(
                mat="roof",
                pts=[[-rw, y_roof, z_start], [-rw, y_roof, z_end], [rw, y_roof, z_end], [rw, y_roof, z_start]]
            ))
            # Roof Chamfers
            faces.append(dict(
                mat="roof_slant",
                pts=[[-hw, y_eave, z_start], [-hw, y_eave, z_end], [-rw, y_roof, z_end], [-rw, y_roof, z_start]]
            ))
            faces.append(dict(
                mat="roof_slant",
                pts=[[rw, y_roof, z_start], [rw, y_roof, z_end], [hw, y_eave, z_end], [hw, y_eave, z_start]]
            ))
            # Left Side (X = -hw)
            faces.append(dict(
                mat="skirt",
                pts=[[-hw, y_skirt, z_start], [-hw, y_skirt, z_end], [-hw, y_floor, z_end], [-hw, y_floor, z_start]]
            ))
            faces.append(dict(
                mat="body",
                pts=[[-hw, y_floor, z_start], [-hw, y_floor, z_end], [-hw, y_stripe_bot, z_end], [-hw, y_stripe_bot, z_start]]
            ))
            faces.append(dict(
                mat="stripe",
                pts=[[-hw, y_stripe_bot, z_start], [-hw, y_stripe_bot, z_end], [-hw, y_stripe_top, z_end], [-hw, y_stripe_top, z_start]]
            ))
            faces.append(dict(
                mat="body",
                pts=[[-hw, y_stripe_top, z_start], [-hw, y_stripe_top, z_end], [-hw, y_eave, z_end], [-hw, y_eave, z_start]]
            ))
            # 2 Windows on left side
            w_len = (car_len - 2.0) / 2.0
            for wi in range(2):
                w_a = z_start + 1.0 + wi * w_len + 0.3
                w_b = w_a + w_len - 0.6
                faces.append(dict(
                    mat="window",
                    pts=[[-hw, y_stripe_top, w_a], [-hw, y_stripe_top, w_b], [-hw, y_eave, w_b], [-hw, y_eave, w_a]]
                ))

            # Right Side (X = +hw)
            faces.append(dict(
                mat="skirt",
                pts=[[hw, y_skirt, z_end], [hw, y_skirt, z_start], [hw, y_floor, z_start], [hw, y_floor, z_end]]
            ))
            faces.append(dict(
                mat="body",
                pts=[[hw, y_floor, z_end], [hw, y_floor, z_start], [hw, y_stripe_bot, z_start], [hw, y_stripe_bot, z_end]]
            ))
            faces.append(dict(
                mat="stripe",
                pts=[[hw, y_stripe_bot, z_end], [hw, y_stripe_bot, z_start], [hw, y_stripe_top, z_start], [hw, y_stripe_top, z_end]]
            ))
            faces.append(dict(
                mat="body",
                pts=[[hw, y_stripe_top, z_end], [hw, y_stripe_top, z_start], [hw, y_eave, z_start], [hw, y_eave, z_end]]
            ))
            for wi in range(2):
                w_a = z_start + 1.0 + wi * w_len + 0.3
                w_b = w_a + w_len - 0.6
                faces.append(dict(
                    mat="window",
                    pts=[[hw, y_stripe_top, w_b], [hw, y_stripe_top, w_a], [hw, y_eave, w_a], [hw, y_eave, w_b]]
                ))

        else:
            # --- Car 0: The Aerodynamic High-Speed Train Head ---
            # Rear body: z_start .. z_start + 5.0
            # Nose front section: z_start + 5.0 .. z_end + 3.0
            z_mid = z_start + 5.0
            z_nose = z_end + 3.2
            z_windshield_top = z_end + 0.8
            hw_nose = hw * 0.76
            y_nose_floor = 1.1
            y_nose_skirt = 0.5
            y_nose_stripe = 2.4
            y_nose_roof = 3.8

            # Rear roof
            faces.append(dict(
                mat="roof",
                pts=[[-rw, y_roof, z_start], [-rw, y_roof, z_mid], [rw, y_roof, z_mid], [rw, y_roof, z_start]]
            ))
            faces.append(dict(
                mat="roof_slant",
                pts=[[-hw, y_eave, z_start], [-hw, y_eave, z_mid], [-rw, y_roof, z_mid], [-rw, y_roof, z_start]]
            ))
            faces.append(dict(
                mat="roof_slant",
                pts=[[rw, y_roof, z_start], [rw, y_roof, z_mid], [hw, y_eave, z_mid], [hw, y_eave, z_start]]
            ))

            # Sloping Nose Roof (from z_mid to z_windshield_top)
            faces.append(dict(
                mat="roof",
                pts=[[-rw, y_roof, z_mid], [-rw * 0.85, y_nose_roof, z_windshield_top],
                     [rw * 0.85, y_nose_roof, z_windshield_top], [rw, y_roof, z_mid]]
            ))

            # Left side rear: z_start .. z_mid
            faces.append(dict(
                mat="skirt",
                pts=[[-hw, y_skirt, z_start], [-hw, y_skirt, z_mid], [-hw, y_floor, z_mid], [-hw, y_floor, z_start]]
            ))
            faces.append(dict(
                mat="body",
                pts=[[-hw, y_floor, z_start], [-hw, y_floor, z_mid], [-hw, y_stripe_bot, z_mid], [-hw, y_stripe_bot, z_start]]
            ))
            faces.append(dict(
                mat="stripe",
                pts=[[-hw, y_stripe_bot, z_start], [-hw, y_stripe_bot, z_mid], [-hw, y_stripe_top, z_mid], [-hw, y_stripe_top, z_start]]
            ))
            faces.append(dict(
                mat="body",
                pts=[[-hw, y_stripe_top, z_start], [-hw, y_stripe_top, z_mid], [-hw, y_eave, z_mid], [-hw, y_eave, z_start]]
            ))
            # Left window
            faces.append(dict(
                mat="window",
                pts=[[-hw, y_stripe_top, z_start + 1.2], [-hw, y_stripe_top, z_start + 3.8],
                     [-hw, y_eave, z_start + 3.8], [-hw, y_eave, z_start + 1.2]]
            ))

            # Left nose tapering side: z_mid .. z_nose
            faces.append(dict(
                mat="skirt",
                pts=[[-hw, y_skirt, z_mid], [-hw_nose, y_nose_skirt, z_nose],
                     [-hw_nose, y_nose_floor, z_nose], [-hw, y_floor, z_mid]]
            ))
            faces.append(dict(
                mat="body",
                pts=[[-hw, y_floor, z_mid], [-hw_nose, y_nose_floor, z_nose],
                     [-hw_nose, y_nose_stripe, z_nose], [-hw, y_stripe_bot, z_mid]]
            ))
            faces.append(dict(
                mat="stripe",
                pts=[[-hw, y_stripe_bot, z_mid], [-hw_nose, y_nose_stripe, z_nose],
                     [-hw_nose * 0.9, y_nose_stripe + 0.6, z_nose - 0.4], [-hw, y_stripe_top, z_mid]]
            ))

            # Right side rear: z_start .. z_mid
            faces.append(dict(
                mat="skirt",
                pts=[[hw, y_skirt, z_mid], [hw, y_skirt, z_start], [hw, y_floor, z_start], [hw, y_floor, z_mid]]
            ))
            faces.append(dict(
                mat="body",
                pts=[[hw, y_floor, z_mid], [hw, y_floor, z_start], [hw, y_stripe_bot, z_start], [hw, y_stripe_bot, z_mid]]
            ))
            faces.append(dict(
                mat="stripe",
                pts=[[hw, y_stripe_bot, z_mid], [hw, y_stripe_bot, z_start], [hw, y_stripe_top, z_start], [hw, y_stripe_top, z_mid]]
            ))
            faces.append(dict(
                mat="body",
                pts=[[hw, y_stripe_top, z_mid], [hw, y_stripe_top, z_start], [hw, y_eave, z_start], [hw, y_eave, z_mid]]
            ))
            # Right window
            faces.append(dict(
                mat="window",
                pts=[[hw, y_stripe_top, z_start + 3.8], [hw, y_stripe_top, z_start + 1.2],
                     [hw, y_eave, z_start + 1.2], [hw, y_eave, z_start + 3.8]]
            ))

            # Right nose tapering side: z_mid .. z_nose
            faces.append(dict(
                mat="skirt",
                pts=[[hw_nose, y_nose_skirt, z_nose], [hw, y_skirt, z_mid],
                     [hw, y_floor, z_mid], [hw_nose, y_nose_floor, z_nose]]
            ))
            faces.append(dict(
                mat="body",
                pts=[[hw_nose, y_nose_floor, z_nose], [hw, y_floor, z_mid],
                     [hw, y_stripe_bot, z_mid], [hw_nose, y_nose_stripe, z_nose]]
            ))
            faces.append(dict(
                mat="stripe",
                pts=[[hw_nose, y_nose_stripe, z_nose], [hw, y_stripe_bot, z_mid],
                     [hw, y_stripe_top, z_mid], [hw_nose * 0.9, y_nose_stripe + 0.6, z_nose - 0.4]]
            ))

            # =========================================================================
            # PROMINENT TRAIN HEAD FRONT FACES (Windshield, Cowcatcher, Headlights)
            # Facing forward (+Z) directly towards viewer!
            # =========================================================================

            # 1. Front Cowcatcher / Bumper Skirt (Black, lowest front face)
            faces.append(dict(
                mat="skirt",
                pts=[
                    [-hw_nose, y_nose_skirt, z_nose],
                    [hw_nose, y_nose_skirt, z_nose],
                    [hw_nose, y_nose_floor, z_nose],
                    [-hw_nose, y_nose_floor, z_nose]
                ]
            ))

            # 2. Front Nose Lower Body (Midtone / Dark Purple-Gray)
            faces.append(dict(
                mat="body_front",
                pts=[
                    [-hw_nose, y_nose_floor, z_nose],
                    [hw_nose, y_nose_floor, z_nose],
                    [hw_nose, y_nose_stripe, z_nose],
                    [-hw_nose, y_nose_stripe, z_nose]
                ]
            ))

            # 3. Front Nose Fluorescent Yellow Stripe Band (Wraps under windshield)
            faces.append(dict(
                mat="stripe",
                pts=[
                    [-hw_nose, y_nose_stripe, z_nose],
                    [hw_nose, y_nose_stripe, z_nose],
                    [hw_nose * 0.9, y_nose_stripe + 0.55, z_nose - 0.3],
                    [-hw_nose * 0.9, y_nose_stripe + 0.55, z_nose - 0.3]
                ]
            ))

            # 4. Giant Aerodynamic Tinted Windshield (Slanted back from z_nose to z_windshield_top)
            # Left Windshield Pane (Cyan)
            faces.append(dict(
                mat="windshield",
                pts=[
                    [-hw_nose * 0.88, y_nose_stripe + 0.55, z_nose - 0.3],
                    [-0.08, y_nose_stripe + 0.55, z_nose - 0.1],
                    [-0.08, y_nose_roof, z_windshield_top],
                    [-rw * 0.85, y_nose_roof, z_windshield_top]
                ]
            ))
            # Right Windshield Pane (Cyan)
            faces.append(dict(
                mat="windshield",
                pts=[
                    [0.08, y_nose_stripe + 0.55, z_nose - 0.1],
                    [hw_nose * 0.88, y_nose_stripe + 0.55, z_nose - 0.3],
                    [rw * 0.85, y_nose_roof, z_windshield_top],
                    [0.08, y_nose_roof, z_windshield_top]
                ]
            ))
            # Center Windshield Pillar (Black Divider)
            faces.append(dict(
                mat="skirt",
                pts=[
                    [-0.08, y_nose_stripe + 0.55, z_nose - 0.1],
                    [0.08, y_nose_stripe + 0.55, z_nose - 0.1],
                    [0.08, y_nose_roof, z_windshield_top],
                    [-0.08, y_nose_roof, z_windshield_top]
                ]
            ))

            # 5. Dual Angular Diamond Headlights (Bright Yellow + White)
            hl_w = 0.42
            hl_h = 0.32
            hl_y = (y_nose_floor + y_nose_stripe) * 0.5
            hl_z = z_nose + 0.08
            # Left Diamond Headlight
            hl_lx = -hw_nose * 0.52
            faces.append(dict(
                mat="headlight",
                pts=[
                    [hl_lx - hl_w, hl_y, hl_z],
                    [hl_lx, hl_y + hl_h, hl_z],
                    [hl_lx + hl_w, hl_y, hl_z],
                    [hl_lx, hl_y - hl_h, hl_z]
                ]
            ))
            # Right Diamond Headlight
            hl_rx = hw_nose * 0.52
            faces.append(dict(
                mat="headlight",
                pts=[
                    [hl_rx - hl_w, hl_y, hl_z],
                    [hl_rx, hl_y + hl_h, hl_z],
                    [hl_rx + hl_w, hl_y, hl_z],
                    [hl_rx, hl_y - hl_h, hl_z]
                ]
            ))

    return faces


# -----------------------------------------------------------------------------
# 3. Environment & Background Geometry Builders
# -----------------------------------------------------------------------------

def build_geometric_buildings():
    """Builds clean low-poly skyscraper towers in the background."""
    buildings = []
    # Building 1 (Far Left Tower): X = -32 .. -18, Y = 0 .. 34, Z = 25 .. 45
    buildings.append(dict(
        mat="building_dark",
        pts=[[-32, 0, 25], [-18, 0, 25], [-18, 34, 25], [-32, 34, 25]]
    ))
    buildings.append(dict(
        mat="building_side",
        pts=[[-18, 0, 25], [-18, 0, 45], [-18, 34, 45], [-18, 34, 25]]
    ))
    # Building 2 (Mid Tower with chamfered roof): X = -15 .. -5, Y = 0 .. 28, Z = 30 .. 50
    buildings.append(dict(
        mat="building_dark",
        pts=[[-15, 0, 30], [-5, 0, 30], [-5, 25, 30], [-10, 28, 30], [-15, 25, 30]]
    ))
    # Building 3 (Right Tower): X = 16 .. 28, Y = 0 .. 30, Z = 35 .. 55
    buildings.append(dict(
        mat="building_side",
        pts=[[16, 0, 35], [28, 0, 35], [28, 30, 35], [16, 30, 35]]
    ))
    return buildings


def build_catenary_poles(z_positions):
    """Builds overhead wire support gantries (接触网立柱) across the track."""
    faces = []
    for z in z_positions:
        # Left post: X = -5.2 .. -4.8, Y = 0 .. 7.8
        faces.append(dict(
            mat="skirt",
            pts=[[-5.2, 0.0, z], [-4.8, 0.0, z], [-4.8, 7.8, z], [-5.2, 7.8, z]],
            two_sided=True
        ))
        # Right post: X = 4.8 .. 5.2, Y = 0 .. 7.8
        faces.append(dict(
            mat="skirt",
            pts=[[4.8, 0.0, z], [5.2, 0.0, z], [5.2, 7.8, z], [4.8, 7.8, z]],
            two_sided=True
        ))
        # Overhead Crossbeam: X = -5.4 .. 5.4, Y = 7.2 .. 7.7
        faces.append(dict(
            mat="stripe",
            pts=[[-5.4, 7.2, z], [5.4, 7.2, z], [5.4, 7.7, z], [-5.4, 7.7, z]],
            two_sided=True
        ))
    return faces


def build_signal_gantry(z_pos=5.0):
    """
    Low geometric signal gantry (信号龙门架) crossing the track.
    Used in Frame B to hint the next parkour squash/duck move!
    """
    faces = []
    # Left & Right low brackets
    faces.append(dict(
        mat="skirt",
        pts=[[-3.8, 0.0, z_pos], [-3.4, 0.0, z_pos], [-3.4, 5.8, z_pos], [-3.8, 5.8, z_pos]],
        two_sided=True
    ))
    faces.append(dict(
        mat="skirt",
        pts=[[3.4, 0.0, z_pos], [3.8, 0.0, z_pos], [3.8, 5.8, z_pos], [3.4, 5.8, z_pos]],
        two_sided=True
    ))
    # Low Warning Crossbeam (height Y = 5.2 .. 5.8, directly above train roof Y = 4.4!)
    faces.append(dict(
        mat="stripe",
        pts=[[-3.8, 5.2, z_pos], [3.8, 5.2, z_pos], [3.8, 5.8, z_pos], [-3.8, 5.8, z_pos]],
        two_sided=True
    ))
    # Signal light boxes (Electric Cyan and Yellow diamonds)
    faces.append(dict(
        mat="window",
        pts=[[-1.2, 5.3, z_pos + 0.1], [-0.6, 5.3, z_pos + 0.1], [-0.6, 5.7, z_pos + 0.1], [-1.2, 5.7, z_pos + 0.1]],
        two_sided=True
    ))
    faces.append(dict(
        mat="headlight",
        pts=[[0.6, 5.3, z_pos + 0.1], [1.2, 5.3, z_pos + 0.1], [1.2, 5.7, z_pos + 0.1], [0.6, 5.7, z_pos + 0.1]],
        two_sided=True
    ))
    return faces


# -----------------------------------------------------------------------------
# 4. Cel Shading & Two-Pass Rendering Engine
# -----------------------------------------------------------------------------

def shade_face(mat, normal_cam, light_dir_cam, k_flat):
    """
    Returns quantized cel color for a given material and normal.
    Strictly adheres to the 5 colors palette!
    """
    dot = np.dot(normal_cam, light_dir_cam) if np.linalg.norm(normal_cam) > 1e-6 else 0.0

    if mat == "body":
        if k_flat > 0.5:
            # Flattened 2D poster inside frame: 2-tone only!
            return COLOR_WHITE if dot > 0.0 else COLOR_PURPLE
        else:
            # 3D faceted volume outside frame: 3-tone cel
            if dot > 0.32:
                return COLOR_WHITE
            elif dot > -0.25:
                # Midtone purple-gray cel
                return (165 / 255.0, 138 / 255.0, 225 / 255.0)
            else:
                # Deep shadow cel
                return (40 / 255.0, 30 / 255.0, 80 / 255.0)

    elif mat == "body_front":
        # Front nose lower body: crisp dark/midtone contrast
        return (60 / 255.0, 45 / 255.0, 110 / 255.0)

    elif mat == "stripe":
        return COLOR_YELLOW

    elif mat == "window":
        return COLOR_CYAN if k_flat <= 0.5 else (0 / 255.0, 160 / 255.0, 210 / 255.0)

    elif mat == "windshield":
        # Prominent Electric Cyan windshield with crisp visibility
        return COLOR_CYAN

    elif mat == "roof":
        if dot > 0.2:
            return (235 / 255.0, 235 / 255.0, 245 / 255.0)
        else:
            return (145 / 255.0, 110 / 255.0, 220 / 255.0)

    elif mat == "roof_slant":
        return (160 / 255.0, 125 / 255.0, 230 / 255.0)

    elif mat == "skirt" or mat == "gangway":
        return COLOR_BLACK

    elif mat == "headlight":
        return COLOR_YELLOW if dot > -0.2 else COLOR_WHITE

    elif mat == "building_dark":
        return (18 / 255.0, 26 / 255.0, 80 / 255.0)

    elif mat == "building_side":
        return (28 / 255.0, 38 / 255.0, 110 / 255.0)

    return COLOR_BLACK


def render_mesh_group(ctx: cairo.Context, cam: Camera3D, faces: list,
                      light_dir_world=np.array([0.4, 0.7, -0.6]),
                      z_trans_start=8.0, z_trans_end=22.0, z_flat_ref=16.0):
    """
    Renders 3D mesh faces with near-plane clipping, depth sorting, 3D->2D lerp,
    and the required Two-Pass Cel Outlining:
    Pass 1: Silhouette / visible faces black outline (10~14px)
    Pass 2: Cel fill + internal creases (2.5px)
    """
    # Transform light to camera space
    l_dir = light_dir_world / np.linalg.norm(light_dir_world)
    l_cam = cam.R @ l_dir
    l_cam = l_cam / (np.linalg.norm(l_cam) + 1e-9)

    prepared = []
    for f in faces:
        pts_cam = [cam.to_cam(p) for p in f["pts"]]

        # Near plane clip
        clipped_cam = clip_polygon_near(pts_cam, near_z=0.6)
        if len(clipped_cam) < 3:
            continue

        # Average depth for sorting
        avg_z = sum(p[2] for p in clipped_cam) / len(clipped_cam)

        # Dimension transition factor k in [0, 1]
        k_flat = clamp((avg_z - z_trans_start) / max(0.1, (z_trans_end - z_trans_start)), 0.0, 1.0)

        # Project vertices to screen
        screen_pts = [project_vertex_hybrid(p, cam.focal, z_flat_ref=z_flat_ref, k_flat=k_flat) for p in clipped_cam]

        # Normal in camera space
        v0 = clipped_cam[0]
        v1 = clipped_cam[1]
        v2 = clipped_cam[2]
        n_cam = np.cross(v1 - v0, v2 - v1)
        norm_len = np.linalg.norm(n_cam)
        if norm_len > 1e-6:
            n_cam = n_cam / norm_len
        else:
            n_cam = np.array([0.0, 0.0, 1.0])

        fill_color = shade_face(f["mat"], n_cam, l_cam, k_flat)

        prepared.append({
            "depth": avg_z,
            "pts": screen_pts,
            "color": fill_color,
            "k_flat": k_flat,
            "mat": f["mat"]
        })

    # Sort faces from back to front (Painter's Algorithm)
    prepared.sort(key=lambda item: item["depth"], reverse=True)

    # --- Pass 1: Silhouette / Thick Outer Outlines ---
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.set_source_rgb(*COLOR_BLACK)

    for item in prepared:
        pts = item["pts"]
        outline_w = lerp(8.0, 13.0, item["k_flat"])
        ctx.set_line_width(outline_w)
        ctx.new_path()
        ctx.move_to(pts[0][0], pts[0][1])
        for p in pts[1:]:
            ctx.line_to(p[0], p[1])
        ctx.close_path()
        ctx.stroke()

    # --- Pass 2: Cel Color Fill & Internal Crease Lines ---
    for item in prepared:
        pts = item["pts"]
        ctx.new_path()
        ctx.move_to(pts[0][0], pts[0][1])
        for p in pts[1:]:
            ctx.line_to(p[0], p[1])
        ctx.close_path()

        # Fill with cel color
        ctx.set_source_rgb(*item["color"])
        ctx.fill_preserve()

        # Internal crisp black crease line (2.5px)
        ctx.set_source_rgb(*COLOR_BLACK)
        ctx.set_line_width(2.5)
        ctx.stroke()


# -----------------------------------------------------------------------------
# 5. Graffiti Frame & Shards
# -----------------------------------------------------------------------------

def draw_graffiti_frame(ctx: cairo.Context, quad, seed=42, t=0.0, ruptured=True):
    """
    Draws the street graffiti frame with purple main stroke, fluorescent yellow
    overlay, deterministic jagged noise edges, drips, splatters, and crown tag.
    quad: [TL, TR, BR, BL] 2D coordinates.
    seed changes at 12fps: seed = base + int(t * 12).
    """
    frame_seed = seed + int(t * 12.0)
    rng = np.random.RandomState(frame_seed)

    tl, tr, br, bl = [np.array(p, dtype=np.float64) for p in quad]

    def make_noisy_edge(p_start, p_end, n_segs=16, amp=6.0):
        pts = [p_start]
        delta = (p_end - p_start) / float(n_segs)
        normal = np.array([-delta[1], delta[0]])
        norm_len = np.linalg.norm(normal)
        if norm_len > 1e-6:
            normal = normal / norm_len
        for i in range(1, n_segs):
            base = p_start + i * delta
            jitter = rng.uniform(-amp, amp) * normal
            pts.append(base + jitter)
        pts.append(p_end)
        return pts

    top_pts = make_noisy_edge(tl, tr, 16, 7.0)
    left_pts = make_noisy_edge(bl, tl, 14, 7.0)

    if ruptured:
        # Train bursts out through right and bottom-right edge!
        right_pts = make_noisy_edge(tr, tr + (br - tr) * 0.32, 8, 8.0)
        rupture_tip = tr + (br - tr) * 0.38 + np.array([-35.0, 15.0])
        right_pts.append(rupture_tip)

        bot_rupture_tip = bl + (br - bl) * 0.65 + np.array([25.0, -25.0])
        bot_pts = make_noisy_edge(bl, bl + (br - bl) * 0.62, 12, 8.0)
        bot_pts.append(bot_rupture_tip)
    else:
        right_pts = make_noisy_edge(tr, br, 14, 7.0)
        bot_pts = make_noisy_edge(bl, br, 16, 7.0)

    # 1. Purple Main Frame Stroke (width ~38px)
    ctx.set_line_cap(cairo.LINE_CAP_SQUARE)
    ctx.set_line_join(cairo.LINE_JOIN_BEVEL)

    for edge in [top_pts, left_pts, bot_pts, right_pts]:
        ctx.new_path()
        ctx.move_to(edge[0][0], edge[0][1])
        for p in edge[1:]:
            ctx.line_to(p[0], p[1])
        # Outer black backing
        ctx.set_source_rgb(*COLOR_BLACK)
        ctx.set_line_width(44.0)
        ctx.stroke_preserve()
        # Purple graffiti fill
        ctx.set_source_rgb(*COLOR_PURPLE)
        ctx.set_line_width(34.0)
        ctx.stroke()

    # 2. Fluorescent Yellow Graffiti Overlay Stroke (width ~18px)
    for edge in [top_pts, left_pts, bot_pts, right_pts]:
        ctx.new_path()
        ctx.move_to(edge[0][0], edge[0][1])
        for p in edge[1:]:
            ctx.line_to(p[0] + rng.uniform(-4, 4), p[1] + rng.uniform(-4, 4))
        ctx.set_source_rgb(*COLOR_YELLOW)
        ctx.set_line_width(18.0)
        ctx.stroke()

    # 3. Downward Paint Drips (3~4 vertical drips with rounded tips)
    drip_xs = [0.18, 0.34, 0.48]
    for frac in drip_xs:
        drip_root = bl + (br - bl) * frac
        drip_len = rng.uniform(45.0, 100.0)
        drip_w = rng.uniform(10.0, 16.0)

        ctx.new_path()
        ctx.move_to(drip_root[0], drip_root[1])
        ctx.line_to(drip_root[0], drip_root[1] + drip_len)
        ctx.arc(drip_root[0], drip_root[1] + drip_len, drip_w * 0.5, 0, math.pi)
        ctx.line_to(drip_root[0] + drip_w, drip_root[1])
        ctx.close_path()
        ctx.set_source_rgb(*COLOR_BLACK)
        ctx.set_line_width(4.0)
        ctx.stroke_preserve()
        ctx.set_source_rgb(*COLOR_PURPLE)
        ctx.fill()

        # Yellow droplet tip
        ctx.new_path()
        ctx.arc(drip_root[0] + drip_w * 0.5, drip_root[1] + drip_len - 2.0, drip_w * 0.45, 0, 2 * math.pi)
        ctx.set_source_rgb(*COLOR_YELLOW)
        ctx.fill()

    # 4. Street Art 3-Point Crown Tag (Top-Left corner)
    crown_x = tl[0] + 55.0
    crown_y = tl[1] - 45.0
    crown_w = 58.0
    crown_h = 40.0

    ctx.save()
    ctx.translate(crown_x, crown_y)
    ctx.rotate(math.radians(-14.0))
    ctx.new_path()
    ctx.move_to(-crown_w * 0.5, crown_h * 0.5)
    ctx.line_to(-crown_w * 0.5, -crown_h * 0.3)
    ctx.line_to(-crown_w * 0.2, 0.0)
    ctx.line_to(0.0, -crown_h * 0.5)
    ctx.line_to(crown_w * 0.2, 0.0)
    ctx.line_to(crown_w * 0.5, -crown_h * 0.3)
    ctx.line_to(crown_w * 0.5, crown_h * 0.5)
    ctx.close_path()

    ctx.set_source_rgb(*COLOR_BLACK)
    ctx.set_line_width(5.0)
    ctx.stroke_preserve()
    ctx.set_source_rgb(*COLOR_YELLOW)
    ctx.fill()
    ctx.restore()


def draw_shards(ctx: cairo.Context, origin=(1020, 680), n_shards=20, seed=101):
    """
    Draws sharp triangular shards bursting outward where the train shatters the frame.
    Strictly uses white, purple, fluorescent yellow, cyan, with black outlines.
    """
    rng = np.random.RandomState(seed)
    colors = [COLOR_WHITE, COLOR_PURPLE, COLOR_YELLOW, COLOR_CYAN, COLOR_WHITE]

    for i in range(n_shards):
        ang = rng.uniform(-0.9, 1.3)
        dist = rng.uniform(70.0, 360.0)
        cx = origin[0] + dist * math.cos(ang)
        cy = origin[1] + dist * math.sin(ang)

        size = rng.uniform(16.0, 65.0)
        rot = rng.uniform(0.0, 2 * math.pi)

        # Sharp triangle
        p0 = (cx + size * math.cos(rot), cy + size * math.sin(rot))
        p1 = (cx + size * 0.4 * math.cos(rot + 2.2), cy + size * 0.4 * math.sin(rot + 2.2))
        p2 = (cx + size * 0.35 * math.cos(rot - 2.2), cy + size * 0.35 * math.sin(rot - 2.2))

        ctx.new_path()
        ctx.move_to(p0[0], p0[1])
        ctx.line_to(p1[0], p1[1])
        ctx.line_to(p2[0], p2[1])
        ctx.close_path()

        ctx.set_source_rgb(*colors[i % len(colors)])
        ctx.fill_preserve()
        ctx.set_source_rgb(*COLOR_BLACK)
        ctx.set_line_width(2.5)
        ctx.stroke()


# -----------------------------------------------------------------------------
# 6. Protagonist Gemini Slime (Cel-Shaded) & Sparkle Star
# -----------------------------------------------------------------------------

def draw_four_point_star(ctx: cairo.Context, cx: float, cy: float, outer_r: float,
                         inner_r: float = None, rot: float = 0.0,
                         fill_rgb=COLOR_YELLOW, stroke_rgb=COLOR_BLACK, stroke_w=2.5):
    """Signature Gemini 4-pointed curved sparkle star with smooth concave Bezier arcs."""
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

    ctx.set_source_rgb(*fill_rgb)
    ctx.fill_preserve()
    if stroke_w > 0:
        ctx.set_source_rgb(*stroke_rgb)
        ctx.set_line_width(stroke_w)
        ctx.stroke()


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


def draw_slime_cel(ctx: cairo.Context, cx: float, cy: float, radius: float, *,
                   squash_y: float = 0.88, tilt: float = 0.0,
                   look: tuple = (0.2, 0.1), eye_mode: str = "pill",
                   outline_w: float = 5.0, rim_glow: bool = True):
    """
    Draws the Gemini Star-Spark Slime in Minimal Cel-Shading Style:
    1. Volume conservation: s_x = 1.0 / sqrt(squash_y)
    2. Strictly mouthless, noseless, blushless!
    3. Pure white capsule eyes:
       - Height is ~22% of sphere diameter (2*radius)
       - Tilt strictly -30°
       - Far eye strictly 81% width of near eye
    4. 3-step hard-edge cel color blocks:
       Top-Left Sky Blue (#4FADFF) -> Mid Iris Purple (#7559E8) -> Bottom-Right Coral Pink (#D96570)
       ONLY warm pink in the entire scene!
    5. Thick black comic outline + small white hard-edge specular.
    """
    squash_y = max(0.25, float(squash_y))
    s_x = 1.0 / math.sqrt(squash_y)
    s_y = squash_y
    r = float(radius)

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(tilt)
    ctx.scale(s_x, s_y)

    # Optional contrast rim aura against dark blue background
    if rim_glow:
        ctx.new_path()
        ctx.arc(0, 0, r * 1.06, 0, 2 * math.pi)
        ctx.set_source_rgba(COLOR_YELLOW[0], COLOR_YELLOW[1], COLOR_YELLOW[2], 0.30)
        ctx.set_line_width(6.0)
        ctx.stroke()

    # --- 3-Step Hard-Edge Cel Color Blocks ---
    # 1. Base Circle Fill: Mid Iris Purple
    ctx.new_path()
    ctx.arc(0, 0, r, 0, 2 * math.pi)
    ctx.set_source_rgb(*SLIME_IRIS)
    ctx.fill()

    # 2. Top-Left Hard-Edge Sky Blue Block
    ctx.save()
    ctx.new_path()
    ctx.arc(0, 0, r, 0, 2 * math.pi)
    ctx.clip()

    ctx.new_path()
    ctx.arc(0.35 * r, 0.35 * r, 1.02 * r, math.pi * 0.88, math.pi * 1.62)
    ctx.line_to(-1.5 * r, -1.5 * r)
    ctx.close_path()
    ctx.set_source_rgb(*SLIME_SKY)
    ctx.fill()

    # 3. Bottom-Right Hard-Edge Coral Pink Block (The ONLY warm pink in scene!)
    ctx.new_path()
    ctx.arc(-0.40 * r, -0.40 * r, 1.02 * r, 0.0, math.pi * 0.58)
    ctx.line_to(1.5 * r, 1.5 * r)
    ctx.close_path()
    ctx.set_source_rgb(*SLIME_CORAL)
    ctx.fill()

    # 4. Top-Left White Specular Pill Highlight (Hard-Edge)
    ctx.save()
    ctx.translate(-0.38 * r, -0.38 * r)
    ctx.rotate(-math.pi * 0.25)
    draw_capsule_pill(ctx, 0, 0, 0.22 * r, 0.08 * r)
    ctx.set_source_rgb(*COLOR_WHITE)
    ctx.fill()
    ctx.restore()

    ctx.restore()  # end clip

    # --- Outer Black Comic Outline ---
    ctx.new_path()
    ctx.arc(0, 0, r, 0, 2 * math.pi)
    ctx.set_source_rgb(*COLOR_BLACK)
    ctx.set_line_width(outline_w)
    ctx.stroke()

    # Top-Left Thin White Rim Light Edge
    ctx.new_path()
    ctx.arc(0, 0, r - outline_w * 0.3, math.pi * 1.05, math.pi * 1.55)
    ctx.set_source_rgb(*COLOR_WHITE)
    ctx.set_line_width(2.5)
    ctx.stroke()

    # --- Pure White Capsule Eyes (Adhering strictly to Visual Iron Rules) ---
    look_x, look_y = look
    look_x = clamp(look_x, -1.0, 1.0)
    look_y = clamp(look_y, -1.0, 1.0)

    base_eye_x = 0.08 * r + look_x * 0.12 * r
    base_eye_y = -0.06 * r + look_y * 0.10 * r

    eye_tilt = -30.0 * math.pi / 180.0  # Strictly -30° tilt
    cos_e = math.cos(eye_tilt)
    sin_e = math.sin(eye_tilt)

    eye_spacing = 0.38 * r
    lx = base_eye_x - 0.5 * eye_spacing * cos_e
    ly = base_eye_y - 0.5 * eye_spacing * sin_e
    rx = base_eye_x + 0.5 * eye_spacing * cos_e
    ry = base_eye_y + 0.5 * eye_spacing * sin_e

    # Eye height is ~22% of sphere diameter (2*r) = ~0.44 * r (half_h = 0.22 * r)
    near_h = 0.22 * r
    near_w = near_h * 0.44
    far_w = near_w * 0.81  # Strictly 81% width!
    far_h = near_h * 0.90

    ctx.set_source_rgb(*COLOR_WHITE)

    for (ex, ey, ew, eh) in [(lx, ly, near_w, near_h), (rx, ry, far_w, far_h)]:
        ctx.save()
        ctx.translate(ex, ey)
        ctx.rotate(eye_tilt)
        draw_capsule_pill(ctx, 0, 0, ew, eh)
        ctx.fill_preserve()
        ctx.set_source_rgb(*COLOR_BLACK)
        ctx.set_line_width(1.8)
        ctx.stroke()
        ctx.restore()

    ctx.restore()


# -----------------------------------------------------------------------------
# 7. Speed Lines & Neon Sign Decor
# -----------------------------------------------------------------------------

def draw_speed_triangles(ctx: cairo.Context, count=8, seed=77):
    """Sharp triangular speed streaks in fluorescent yellow and electric cyan."""
    rng = np.random.RandomState(seed)
    for _ in range(count):
        y = rng.uniform(80, 1000)
        x = rng.uniform(1200, 1920)
        length = rng.uniform(140, 420)
        width = rng.uniform(8, 22)
        color = COLOR_YELLOW if rng.rand() > 0.4 else COLOR_CYAN

        ctx.new_path()
        ctx.move_to(x, y)
        ctx.line_to(x - length, y + rng.uniform(-10, 10))
        ctx.line_to(x, y + width)
        ctx.close_path()

        ctx.set_source_rgb(*color)
        ctx.fill_preserve()
        ctx.set_source_rgb(*COLOR_BLACK)
        ctx.set_line_width(2.0)
        ctx.stroke()


def draw_neon_signboard(img: Image.Image, text="下一站·未来", pos=(280, 180)):
    """Draws a vertical street neon signboard with Chinese characters using get_font."""
    draw = ImageDraw.Draw(img)
    font = get_font(30)

    x, y = pos
    char_spacing = 40

    box_w = 52
    box_h = len(text) * char_spacing + 20
    draw.rectangle([x - 10, y - 10, x - 10 + box_w, y - 10 + box_h], fill=(11, 11, 20), outline=(0, 229, 255), width=3)

    for i, ch in enumerate(text):
        cy = y + i * char_spacing
        draw.text((x, cy), ch, font=font, fill=(0, 229, 255))


# -----------------------------------------------------------------------------
# 8. Frame A: Hero Breakout Main Visual (style_03_graffiti.png)
# -----------------------------------------------------------------------------

def render_hero(t=0.0) -> Image.Image:
    """
    Renders Frame A (style_03_graffiti.png):
    - Low-angle upward camera with +5.0° roll.
    - Central-left tilted graffiti frame.
    - Train bursting out towards front-right, PROMINENT front nose facing camera:
      cyan tinted windshield, two bright diamond headlights, black cowcatcher skirt,
      yellow racing stripe, 3-tone flat shading (top white, side purple-gray, front dark).
    - 3D->2D transition visible across the frame.
    - Shards radiating from frame rupture.
    - Slime near-round (s_y≈0.85), large capsule eyes tilted -30°, far eye 81%, guiding star ✦ ahead.
    """
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surface)

    # 1. Clean Deep Blue Cel Background (>= 35% negative space)
    ctx.set_source_rgb(*BG_DARK)
    ctx.paint()

    # Step-shaded sky gradient blocks
    ctx.new_path()
    ctx.move_to(0, 0)
    ctx.line_to(W, 0)
    ctx.line_to(W, 360)
    ctx.line_to(0, 480)
    ctx.close_path()
    ctx.set_source_rgb(*BG_MID)
    ctx.fill()

    ctx.new_path()
    ctx.move_to(0, 0)
    ctx.line_to(W, 0)
    ctx.line_to(W, 160)
    ctx.line_to(0, 220)
    ctx.close_path()
    ctx.set_source_rgb(*BG_LIGHT)
    ctx.fill()

    # 2. Camera Setup for Prominent Train Head & Low Angle
    # Nose tip is at Z = 15.2, camera is in front-right at X=5.6, Y=1.2, Z=21.5
    # Looking at target X=-0.6, Y=2.6, Z=8.0
    cam = Camera3D(
        eye=np.array([5.6, 1.2, 21.5]),
        target=np.array([-0.6, 2.6, 8.0]),
        up=np.array([0.0, 1.0, 0.0]),
        fov_deg=58.0,
        roll_deg=5.0
    )

    # 3. Background Geometric Buildings
    buildings = build_geometric_buildings()
    render_mesh_group(ctx, cam, buildings, z_trans_start=24.0, z_trans_end=45.0)

    # 4. Continuous Train Mesh (4 cars connected with accordion gangways)
    # Extends from Z = -26.0 (deep inside graffiti frame) to Z = 15.2 (front nose)
    train_faces = build_train_mesh(n_cars=4, car_len=9.5, car_w=3.8, car_h=3.6, gap=2.0, z_offset=2.5)
    render_mesh_group(ctx, cam, train_faces,
                      z_trans_start=7.0, z_trans_end=19.0, z_flat_ref=15.0)

    # 5. Graffiti Frame Quad (Center-Left, slightly tilted)
    frame_quad = [
        (220, 100),   # Top-Left
        (1080, 160),  # Top-Right
        (1010, 920),  # Bottom-Right
        (150, 860)    # Bottom-Left
    ]

    # Street Graffiti Frame & Shards (ruptured where train nose bursts out)
    draw_graffiti_frame(ctx, frame_quad, seed=42, t=t, ruptured=True)
    draw_shards(ctx, origin=(1010, 660), n_shards=22, seed=101)

    # 6. Speed Triangles
    draw_speed_triangles(ctx, count=9, seed=88)

    # 7. Protagonist Slime (Mounted proudly on train hood above windshield)
    # Near-round sphere: squash_y = 0.86, height ~115px (11% of 1080)
    slime_cx = 1290.0
    slime_cy = 310.0
    slime_r = 62.0
    draw_slime_cel(
        ctx, slime_cx, slime_cy, slime_r,
        squash_y=0.86,
        tilt=math.radians(10.0),
        look=(0.5, 0.2),
        eye_mode="pill",
        outline_w=5.5
    )

    # 8. Escaping Guiding Star ✦ ahead of the train
    star_x = 1580.0
    star_y = 210.0
    draw_four_point_star(
        ctx, star_x, star_y, outer_r=48.0,
        inner_r=12.5, rot=math.radians(18.0),
        fill_rgb=COLOR_YELLOW, stroke_rgb=COLOR_BLACK, stroke_w=3.0
    )

    # Convert cairo surface to PIL Image
    buf = surface.get_data()
    img = Image.frombuffer("RGBA", (W, H), bytes(buf), "raw", "BGRA", 0, 1).convert("RGB")

    # 9. Chinese Neon Signboard decor
    draw_neon_signboard(img, "下一站·未来", pos=(240, 180))

    return img


# -----------------------------------------------------------------------------
# 9. Frame B: Parkour 3/4 Side View (style_03_graffiti_parkour.png)
# -----------------------------------------------------------------------------

def render_parkour(t=0.0) -> Image.Image:
    """
    Renders Frame B (style_03_graffiti_parkour.png):
    - 3/4 side view of train roof parkour.
    - Camera slightly below roof height, train roof line angle <= 15° with horizontal (~ -3.5°).
    - 4 visible cars with clear jump gaps (each car ~500-600px wide).
    - Slime mid-air jumping over the gap (s_y > 1, character height 7%~11% of frame height).
    - Low geometric signal gantry ahead on Car 1 roof (hinting next move to duck/squash).
    - Catenary poles, geometric buildings, horizontal speed streaks, and next graffiti portal.
    """
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surface)

    # 1. Clean Deep Blue Background
    ctx.set_source_rgb(*BG_DARK)
    ctx.paint()

    # Horizon cel steps
    ctx.new_path()
    ctx.move_to(0, 0)
    ctx.line_to(W, 0)
    ctx.line_to(W, 380)
    ctx.line_to(0, 460)
    ctx.close_path()
    ctx.set_source_rgb(*BG_MID)
    ctx.fill()

    # 2. Camera Setup (3/4 low side angle)
    # Camera pulled back to side, roof slope ~ -3.5° (<= 15°)
    cam = Camera3D(
        eye=np.array([28.0, 4.8, -13.0]),
        target=np.array([0.0, 4.0, 3.0]),
        up=np.array([0.0, 1.0, 0.0]),
        fov_deg=48.0,
        roll_deg=-2.8
    )

    # 3. Environment: Buildings & Catenary Poles
    buildings = build_geometric_buildings()
    render_mesh_group(ctx, cam, buildings, z_trans_start=20.0, z_trans_end=45.0)

    catenary = build_catenary_poles(z_positions=[-16.0, -2.0, 12.0])
    render_mesh_group(ctx, cam, catenary, z_trans_start=12.0, z_trans_end=35.0)

    # 4. Train with 4 Cars & Clear Gaps
    # Cars placed at:
    # Car 3: Z = -22 .. -12
    # Car 2: Z = -9.6 .. 0.4
    # Car 1: Z = 2.8 .. 12.8
    # Car 0: Z = 15.2 .. 25.2
    train_faces = []
    # Build 4 separate cars with clear gaps (jumping pits)
    car_specs = [
        (3, -22.0, -12.0, False),
        (2, -9.6, 0.4, False),
        (1, 2.8, 12.8, False),
        (0, 15.2, 25.2, True)
    ]
    hw = 1.9
    rw = hw * 0.80
    y_skirt, y_floor, y_stripe_bot, y_stripe_top, y_eave, y_roof = 0.5, 1.0, 2.0, 2.6, 3.9, 4.4

    for c_idx, z_start, z_end, is_head in car_specs:
        # Standard Car geometry
        train_faces.append(dict(
            mat="roof",
            pts=[[-rw, y_roof, z_start], [-rw, y_roof, z_end], [rw, y_roof, z_end], [rw, y_roof, z_start]]
        ))
        train_faces.append(dict(
            mat="roof_slant",
            pts=[[-hw, y_eave, z_start], [-hw, y_eave, z_end], [-rw, y_roof, z_end], [-rw, y_roof, z_start]]
        ))
        train_faces.append(dict(
            mat="roof_slant",
            pts=[[rw, y_roof, z_start], [rw, y_roof, z_end], [hw, y_eave, z_end], [hw, y_eave, z_start]]
        ))
        # Visible right side facing camera (X = +hw)
        train_faces.append(dict(
            mat="skirt",
            pts=[[hw, y_skirt, z_end], [hw, y_skirt, z_start], [hw, y_floor, z_start], [hw, y_floor, z_end]]
        ))
        train_faces.append(dict(
            mat="body",
            pts=[[hw, y_floor, z_end], [hw, y_floor, z_start], [hw, y_stripe_bot, z_start], [hw, y_stripe_bot, z_end]]
        ))
        train_faces.append(dict(
            mat="stripe",
            pts=[[hw, y_stripe_bot, z_end], [hw, y_stripe_bot, z_start], [hw, y_stripe_top, z_start], [hw, y_stripe_top, z_end]]
        ))
        train_faces.append(dict(
            mat="body",
            pts=[[hw, y_stripe_top, z_end], [hw, y_stripe_top, z_start], [hw, y_eave, z_start], [hw, y_eave, z_end]]
        ))
        # Windows on right side
        train_faces.append(dict(
            mat="window",
            pts=[[hw, y_stripe_top, z_start + 6.8], [hw, y_stripe_top, z_start + 3.2],
                 [hw, y_eave, z_start + 3.2], [hw, y_eave, z_start + 6.8]]
        ))
        # Front/Back car walls facing gaps
        train_faces.append(dict(
            mat="body_front",
            pts=[[hw, y_skirt, z_end], [-hw, y_skirt, z_end], [-hw, y_roof, z_end], [hw, y_roof, z_end]],
            two_sided=True
        ))
        train_faces.append(dict(
            mat="body_front",
            pts=[[-hw, y_skirt, z_start], [hw, y_skirt, z_start], [hw, y_roof, z_start], [-hw, y_roof, z_start]],
            two_sided=True
        ))

    render_mesh_group(ctx, cam, train_faces,
                      z_trans_start=12.0, z_trans_end=32.0, z_flat_ref=18.0)

    # 5. Low Geometric Signal Gantry ahead on Car 1 roof (at Z = 7.5)
    gantry = build_signal_gantry(z_pos=7.5)
    render_mesh_group(ctx, cam, gantry, z_trans_start=12.0, z_trans_end=32.0)

    # 6. Distant Graffiti Frame (Next World Portal teaser at top-right)
    portal_quad = [
        (1420, 180),
        (1780, 200),
        (1740, 500),
        (1380, 470)
    ]
    draw_graffiti_frame(ctx, portal_quad, seed=99, t=t, ruptured=False)

    # 7. Horizontal Cyan Speed Lines
    rng = np.random.RandomState(45)
    for _ in range(12):
        sy = rng.uniform(220, 950)
        sx = rng.uniform(80, 1720)
        slen = rng.uniform(180, 480)
        ctx.new_path()
        ctx.move_to(sx, sy)
        ctx.line_to(sx + slen, sy)
        ctx.set_source_rgb(*COLOR_CYAN)
        ctx.set_line_width(2.5)
        ctx.stroke()

    # 8. Protagonist Slime: In mid-air jumping over the gap between Car 2 and Car 1!
    # Elevated in mid-air (cy = 405 vs roof line at ~510), clearly suspended over the jumping pit!
    # Height requirement: 7% ~ 11% of frame height (1080 * 0.082 = 88.5px)
    slime_cx = 845.0
    slime_cy = 405.0
    slime_r = 34.0  # height = 2 * 34 * 1.30 = 88.4px (~8.2% of 1080)
    draw_slime_cel(
        ctx, slime_cx, slime_cy, radius=slime_r,
        squash_y=1.30,  # Jump stretch! (s_x = 1/sqrt(s_y) = 0.877)
        tilt=math.radians(18.0),  # Tilted forward along jump arc
        look=(0.6, 0.3),
        eye_mode="pill",
        outline_w=4.0
    )

    # 9. Escaping Guiding Star ✦ ahead of Slime
    star_x = 995.0
    star_y = 335.0
    draw_four_point_star(
        ctx, star_x, star_y, outer_r=32.0,
        inner_r=8.5, rot=math.radians(22.0),
        fill_rgb=COLOR_YELLOW, stroke_rgb=COLOR_BLACK, stroke_w=2.5
    )

    # Convert to PIL Image
    buf = surface.get_data()
    img = Image.frombuffer("RGBA", (W, H), bytes(buf), "raw", "BGRA", 0, 1).convert("RGB")

    return img


def render_keyframe(t: float = 0.0) -> Image.Image:
    """Renders the canonical World 03 keyframe (1920x1080 RGB PIL Image)."""
    return render_hero(t=t)


# -----------------------------------------------------------------------------
# 10. Main Execution & Performance Benchmark
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    out_dir = os.path.dirname(os.path.abspath(__file__))
    path_hero = os.path.join(out_dir, "style_03_cyber.png")
    path_parkour = os.path.join(out_dir, "style_03_cyber_parkour.png")

    print("[World 03 · 霓虹破界疾驰列车] 开始程序化渲染测试帧 (Round 2)...")

    # Benchmark Frame A (Hero Breakout)
    t0 = time.perf_counter()
    img_hero = render_keyframe(t=0.0)
    img_hero.save(path_hero, "PNG")
    t1 = time.perf_counter()
    hero_time = t1 - t0
    print(f"✓ 测试帧 A 已生成: {path_hero} (耗时: {hero_time:.3f}s)")

    # Benchmark Frame B (Parkour 3/4 View)
    t2 = time.perf_counter()
    img_parkour = render_parkour(t=0.0)
    img_parkour.save(path_parkour, "PNG")
    t3 = time.perf_counter()
    parkour_time = t3 - t2
    print(f"✓ 测试帧 B 已生成: {path_parkour} (耗时: {parkour_time:.3f}s)")

    print(f"\n全部渲染完成! 平均耗时: {(hero_time + parkour_time) * 0.5:.3f}s (目标 < 1.5s)")
