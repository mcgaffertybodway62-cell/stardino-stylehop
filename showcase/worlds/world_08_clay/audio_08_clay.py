#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
World 08 · 移轴微缩粘土书桌 (audio_08_clay.py)
Generates a handcrafted 15.0s 48kHz stereo Stop-Motion Claymation soundtrack
(Aardman / Yoshi's Crafted World / lemo-opuscar tilt-shift & brick-toy aesthetic).

Overhauled with Real Acoustic Sample Libraries (`lemo-opuscar`: VSCO2, VCSL, FreePats)
+ Physical Waveguide Plucks (`pluck.py`) + Fitted Public-Domain Foley (`earshot.forge.bank`)
+ Broadcast -14.0 LUFS Mastering (`master.py`):

1. Authentic Sampled Miniature Desk Ensemble (`core.audio.sampler` & `core.audio.pluck`):
   - `marimba` (VCSL rosewood marimba) & `xylophone` for warm, woody stop-motion melodies.
   - `kalimba` / `mbira` & `pluck/kalimba_soft` (`earshot.forge.bank`) for thumb-piano sparkle.
   - `ukulele` & `guitar_nylon` (`sampler.py` + `pluck.py`) for sunny afternoon desk strums.
   - `contrabass_pizz` / `jazz_bass` & `cellos_pizz` for bouncy acoustic bass foundation.
   - `world_perc`, `cajon`, `woodblock`, `claves`, and `shaker` for light, sparse craft percussion
     (no continuous high-frequency white-noise shaker hiss!).
2. Narrative Breathing Room & Stop-Downs (LRA >= 5.5 LU):
   - Beat 1 (0.00 ~ 1.45s): Sparse Toy Trumpet Cold Open — No BGM yet! Only the warm muted
     trumpet/trombone puff out of the clay trumpet at 0.80s and tactile clay landing squishes
     at 1.12s & 1.38s before the sunny desk groove begins at 1.50s.
   - Beat 2 -> 3 Stop-Down (3.65 ~ 6.15s): Music stops down completely (`gate_zero`) when the
     Slime brakes at the Caramel Coffee River (3.68s) and crouches to inspect the 5 Pastel
     Dominoes! The headbutt (5.31s) and the 5-domino chain clack (`fit/tick/domino` + `woodblock`
     + `marimba` at 5.34, 5.45, 5.56, 5.67, 5.78s) ring out in crystal-clear desktop silence!
   - Beat 5 -> 6 Pre-Token Breath (11.95 ~ 12.30s): Brief hush on the hardcover book platform
     before the Thumbprint Clay Star Token absorption chime at 12.32s.
3. Sidechain Ducking & -14.0 LUFS Mastering (`master.sidechain_times` + `master.finish`).
"""

import os
import sys
import math
import numpy as np
import soundfile as sf
from scipy import signal

# Repository root derived from __file__ (no absolute paths)
WORLD_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(WORLD_DIR))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from audio_deps import require_audio_upstream
require_audio_upstream()   # 缺失时抛出带安装指引的错误，绝不静默降级

from core.audio import sampler as S, pluck as P, sfx as lemo_sfx
from earshot.forge import bank
import master

SR = 48000
DURATION_S = 15.0
TOTAL_SAMPLES = int(round(DURATION_S * SR))
BPM = 124.0
BEAT = 60.0 / BPM  # 0.48387s


def lp(x: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    if len(x) < 12:
        return x
    sos = signal.butter(order, min(fc, SR * 0.47), btype="low", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


def bp(x: np.ndarray, f_lo: float, f_hi: float, order: int = 2) -> np.ndarray:
    if len(x) < 12:
        return x
    sos = signal.butter(order, [max(f_lo, 20.0), min(f_hi, SR * 0.47)], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


def pan_mono(x: np.ndarray, pan: float = 0.0) -> np.ndarray:
    x = np.asarray(x, dtype=np.float32)
    if x.ndim == 2:
        return x
    theta = (float(np.clip(pan, -1.0, 1.0)) + 1.0) * (math.pi / 4.0)
    return np.column_stack([x * math.cos(theta), x * math.sin(theta)]).astype(np.float32)


def add_at(buf: np.ndarray, sig: np.ndarray, t_sec: float, gain: float = 1.0, pan: float = 0.0):
    if sig is None or len(sig) == 0:
        return
    idx = int(round(float(t_sec) * SR))
    if idx >= len(buf):
        return
    if sig.ndim == 1:
        st = pan_mono(sig * float(gain), pan)
    else:
        theta_l = 1.0 - max(0.0, float(pan)) * 0.4
        theta_r = 1.0 + min(0.0, float(pan)) * 0.4
        st = np.column_stack([
            sig[:, 0] * float(gain) * theta_l,
            sig[:, 1] * float(gain) * theta_r,
        ]).astype(np.float32)
    if idx < 0:
        st = st[-idx:]
        idx = 0
    end = min(len(buf), idx + len(st))
    if end > idx:
        buf[idx:end] += st[:end - idx]


def gate_envelope(n_samples: int, windows: list) -> np.ndarray:
    g = np.ones(n_samples, dtype=np.float32)
    for t0, t1, level, fade_s in windows:
        i0 = max(0, int(round(t0 * SR)))
        i1 = min(n_samples, int(round(t1 * SR)))
        if i1 <= i0:
            continue
        g[i0:i1] = np.minimum(g[i0:i1], float(level))
        nf = max(1, int(round(fade_s * SR)))
        fi0 = max(0, i0 - nf)
        if i0 > fi0:
            g[fi0:i0] = np.minimum(g[fi0:i0], np.linspace(1.0, float(level), i0 - fi0, dtype=np.float32))
        fo1 = min(n_samples, i1 + nf)
        if fo1 > i1:
            g[i1:fo1] = np.minimum(g[i1:fo1], np.linspace(float(level), 1.0, fo1 - i1, dtype=np.float32))
    return g[:, None]


def render_bank(sound_id: str, seed: int = 7, **kwargs) -> np.ndarray:
    try:
        y, _ = bank.render(sound_id, seed=seed, peak_db=-1.5, checks=False, **kwargs)
    except Exception:
        y, _ = bank.render(sound_id, seed=seed, peak_db=-1.5, checks=False)
    return np.asarray(y, dtype=np.float32)


# =============================================================================
# 1. Real Acoustic Miniature Desk Score Builder (Marimba, Kalimba, Ukulele, Pizz)
# =============================================================================

def build_clay_music_bus() -> np.ndarray:
    """
    Composes the 15.0s stop-motion miniature desk score using real acoustic samples:
      - 0.00 ~ 1.45s: Cold Open Silence (lets the toy clay trumpet puff at 0.80s and
        clay landing squishes at 1.12s/1.38s speak in intimate desktop room air).
      - 1.50 ~ 3.62s: Act I — Sunny Desk Awakening & Guide Star Flight (sampled marimba,
        kalimba, ukulele strums, and contrabass pizzicato).
      - 3.65 ~ 6.15s: MANDATORY STOP-DOWN — Coffee River Brake, Curious Crouch & 5-Domino
        Cascade! Music gates down so the 5 domino clacks (5.34~5.78s) take center stage.
      - 6.20 ~ 11.90s: Act II — Domino Bridge Crossing & 3 Ascending Macaron Trampoline
        Bounces (marimba + xylophone + ukulele + flute + warm pizzicato bass).
      - 11.95 ~ 12.30s: Brief hush before Star Token absorption.
      - 12.32 ~ 15.00s: Act III — Thumbprint Clay Star Chime & Crystalline Kaleidoscope
        Transition into World 09 Blueprint.
    """
    S.seed(808)
    music = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)

    # -------------------------------------------------------------------------
    # ACT I (1.50s ~ 3.62s): Sunny Desk Awakening (C major -> G6)
    # -------------------------------------------------------------------------
    act1_mel = [
        (1.50, "C5", "E4", "C2"),
        (1.92, "E5", "G4", "G2"),
        (2.34, "G5", "C5", "A2"),
        (2.76, "A5", "E5", "E2"),
        (3.18, "G5", "D5", "G2"),
    ]
    for idx_m, (tm, m_hi, m_lo, b_nt) in enumerate(act1_mel):
        add_at(music, S.note("marimba", m_hi, dur=0.45, vel=0.72), tm, gain=0.42, pan=-0.15)
        add_at(music, P.pluck("kalimba", m_lo, dur=0.42, vel=0.68), tm + 0.20, gain=0.30, pan=0.20)
        add_at(music, S.note("contrabass_pizz", b_nt, dur=0.42, vel=0.70), tm, gain=0.38, pan=-0.10)
        if idx_m in (0, 2, 4):
            ch_uku = ["G4", "C4", "E4", "C5"] if idx_m != 4 else ["G4", "D4", "G4", "B4"]
            add_at(music, S.chord("ukulele", ch_uku, dur=0.45, vel=0.65, strum=0.014), tm, gain=0.28, pan=-0.28)
            add_at(music, S.hit("woodblock", "a", vel=0.48), tm + 0.21, gain=0.16, pan=0.22)

    # -------------------------------------------------------------------------
    # STOP-DOWN (3.65s ~ 6.15s): Caramel Coffee River Brake & 5-Domino Cascade
    # Enforced via gate_envelope below so the 5 domino clacks shine in silence!
    # -------------------------------------------------------------------------

    # -------------------------------------------------------------------------
    # ACT II (6.20s ~ 11.90s): Domino Bridge Hops, 3 Macaron Bounces & Ruler Sprint
    # -------------------------------------------------------------------------
    # 6.20s ~ 7.85s: Playful Domino Bridge Crossing (Fmaj7 -> G6)
    bridge_mel = [
        (6.25, "F5", "A4", "F2", ["F4", "A4", "C5", "F5"]),
        (6.65, "A5", "C5", "C3", None),
        (7.05, "G5", "B4", "G2", ["G4", "B4", "D5", "G5"]),
        (7.45, "C6", "E5", "D3", None),
    ]
    for tm, m_hi, m_lo, b_nt, uku_ch in bridge_mel:
        add_at(music, S.note("marimba", m_hi, dur=0.42, vel=0.74), tm, gain=0.42, pan=-0.12)
        add_at(music, P.pluck("kalimba", m_lo, dur=0.38, vel=0.70), tm + 0.18, gain=0.30, pan=0.18)
        add_at(music, S.note("contrabass_pizz", b_nt, dur=0.40, vel=0.72), tm, gain=0.38, pan=-0.08)
        if uku_ch:
            add_at(music, S.chord("ukulele", uku_ch, dur=0.45, vel=0.68, strum=0.012), tm, gain=0.28, pan=-0.25)

    # 7.95s ~ 11.85s: 3 Ascending Macaron Trampoline Bounces & Wooden Ruler Sprint!
    # Soaring marimba + flute + ukulele + pizzicato strings progression (C -> Am7 -> Fmaj7 -> G13)
    macaron_bars = [
        (8.00,  "C2", "G2", ["G4", "C4", "E4", "C5"], "E5", "G5"),
        (8.90,  "A2", "E2", ["A4", "C4", "E4", "A4"], "A5", "C6"),
        (9.80,  "F2", "C3", ["F4", "A4", "C5", "F5"], "C6", "D6"),
        (10.80, "G2", "D3", ["G4", "B4", "D5", "G5"], "B5", "D6"),
    ]
    for t_bar, b1, b2, uku_ch, fl_1, fl_2 in macaron_bars:
        add_at(music, S.note("contrabass_pizz", b1, dur=0.45, vel=0.76), t_bar, gain=0.42, pan=-0.10)
        add_at(music, S.note("contrabass_pizz", b2, dur=0.45, vel=0.72), t_bar + 0.45, gain=0.38, pan=-0.10)
        add_at(music, S.chord("ukulele", uku_ch, dur=0.50, vel=0.72, strum=0.012), t_bar, gain=0.30, pan=-0.28)
        add_at(music, P.strum("nylon_guitar", uku_ch, dur=0.45, vel=0.66, spread=0.014), t_bar + 0.45, gain=0.24, pan=0.25)
        add_at(music, lp(S.note("flute", fl_1, dur=0.45, vel=0.68, attack=0.04), 2900.0), t_bar, gain=0.32, pan=0.18)
        add_at(music, lp(S.note("flute", fl_2, dur=0.45, vel=0.72, attack=0.04), 2900.0), t_bar + 0.45, gain=0.34, pan=0.22)
        add_at(music, S.note("marimba", fl_1, dur=0.40, vel=0.74), t_bar + 0.22, gain=0.36, pan=-0.15)
        add_at(music, S.note("marimba", fl_2, dur=0.40, vel=0.76), t_bar + 0.68, gain=0.38, pan=-0.12)
        add_at(music, lp(S.hit("cajon", "bass", vel=0.62), 220.0), t_bar, gain=0.24, pan=0.0)
        add_at(music, S.hit("shaker", "down", vel=0.45), t_bar + 0.45, gain=0.14, pan=0.28)

    # -------------------------------------------------------------------------
    # ACT III (12.32s ~ 15.00s): Star Token Resolution & Kaleidoscope -> Blueprint
    # -------------------------------------------------------------------------
    # 12.32s ~ 13.60s: Radiant Cmaj9 Chord (Piano + Harp + Vibraphone + Cello)
    add_at(music, S.note("cellos", "C2", dur=1.35, vel=0.72, attack=0.06), 12.32, gain=0.38, pan=-0.15)
    for i, nt in enumerate(["C4", "E4", "G4", "B4", "D5"]):
        add_at(music, S.note("piano", nt, dur=1.20, vel=0.70), 12.32 + i * 0.03, gain=0.32, pan=-0.20 + i * 0.10)
        add_at(music, S.note("vibraphone", nt, dur=1.25, vel=0.68), 12.34 + i * 0.03, gain=0.26, pan=0.20 - i * 0.10)

    # 13.65s ~ 15.00s: Crystalline Kaleidoscope Mandala (Glass Harp + Harpsichord + Hand Chimes)
    # bridging seamlessly into World 09's Baroque Blueprint harpsichord/pizzicato!
    kal_notes = ["C5", "E5", "G5", "B5", "C6", "G5", "E5", "C5"]
    for i_k, nk in enumerate(kal_notes):
        tk = 13.68 + i_k * 0.14
        if tk >= 14.88:
            break
        pan_k = 0.40 * math.sin(i_k * 1.1)
        add_at(music, S.note("glass", nk, dur=0.65, vel=0.64), tk, gain=0.28, pan=pan_k)
        add_at(music, S.note("harpsichord", nk, dur=0.45, vel=0.60), tk, gain=0.24, pan=-pan_k * 0.7)

    # Spatialize music in a cozy wooden craft studio room
    music_wet = S.room(music, size=0.38, mix=0.18, predelay=0.012, damp=0.58)[:TOTAL_SAMPLES]

    # Enforce structural stop-downs for wide dynamic range (LRA >= 5.5 LU)
    music_wet *= gate_envelope(TOTAL_SAMPLES, [
        (0.00, 1.45, 0.00, 0.02),   # Cold open silence for toy trumpet & clay roll
        (3.65, 6.18, 0.00, 0.04),   # Mandatory Stop-Down: Coffee river brake & 5-Domino cascade!
        (11.92, 12.30, 0.08, 0.04), # Pre-Token breath on book platform
        (14.82, 15.00, 0.00, 0.10), # Clean end taper
    ])
    return music_wet


# =============================================================================
# 2. Tactile Stop-Motion Clay & Desktop Craft Foley Bus
# =============================================================================

def build_clay_foley_bus() -> tuple[np.ndarray, list]:
    sfx = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)
    sc_hits = []

    def clay_squish(t_s: float, pitch_kal: str = "C4", gain: float = 0.40, pan: float = 0.0, seed: int = 1):
        """Tactile matte polymer clay squish + wooden tabletop thump."""
        add_at(sfx, render_bank("fit/land.light/fingertip_book", seed=seed), t_s, gain=gain * 0.85, pan=pan)
        add_at(sfx, render_bank("fit/pop/lip_pop", seed=seed + 100), t_s + 0.008, gain=gain * 0.70, pan=pan)
        add_at(sfx, lp(lemo_sfx.thump(0.28, 95.0), 180.0), t_s, gain=gain * 0.45, pan=pan)
        add_at(sfx, P.pluck("kalimba", pitch_kal, dur=0.22, vel=0.55), t_s + 0.005, gain=gain * 0.42, pan=pan)

    # --- Beat 1 (0.00 ~ 2.40s): Iris-In Knead, Toy Trumpet Puff (0.80s) & Clay Roll ---
    # 0.06s: Subtle clay iris opening & soft wooden wheel turn
    add_at(sfx, lp(render_bank("swipe/cloth", dur=0.55, seed=801), 1600.0), 0.06, gain=0.26, pan=-0.35)
    for bt, bp_n in [(0.14, "G4"), (0.32, "A4"), (0.50, "C5")]:
        add_at(sfx, render_bank("pluck/kalimba_soft", pitch=bp_n, seed=int(bt * 100)), bt, gain=0.24, pan=-0.35)

    # 0.80s: Yellow Clay Toy Trumpet Puff ("噗——！" — real muted trumpet + trombone + mouth_plop!)
    add_at(sfx, render_bank("fit/pop/mouth_plop", seed=802), 0.80, gain=0.58, pan=-0.40)
    add_at(sfx, lp(S.note("trumpet_mute", "G4", dur=0.42, vel=0.82), 2400.0), 0.81, gain=0.46, pan=-0.40)
    add_at(sfx, lp(S.note("trombone_stac", "C4", dur=0.35, vel=0.78), 1800.0), 0.81, gain=0.38, pan=-0.38)
    add_at(sfx, lp(S.note("trumpet_mute", "C5", dur=0.32, vel=0.84), 2500.0), 0.98, gain=0.44, pan=-0.36)
    sc_hits.append((0.80, 0.95))

    # 1.12s & 1.38s: Clay Slime bounces & rolls on wooden desk
    clay_squish(1.12, "D4", gain=0.48, pan=-0.32, seed=803)
    clay_squish(1.38, "G4", gain=0.42, pan=-0.28, seed=804)
    sc_hits.extend([(1.12, 0.75), (1.38, 0.65)])

    # 1.92s: Guide Star ✦ rises from behind clay dice (glockenspiel + hand_chimes)
    add_at(sfx, S.note("glockenspiel", "C6", dur=0.65, vel=0.68), 1.92, gain=0.28, pan=-0.18)
    add_at(sfx, S.note("hand_chimes", "G6", dur=0.80, vel=0.65), 1.96, gain=0.24, pan=-0.15)
    clay_squish(1.98, "E4", gain=0.34, pan=-0.20, seed=805)
    clay_squish(2.32, "G4", gain=0.34, pan=-0.16, seed=806)

    # --- Beat 2 (2.40 ~ 4.50s): Chasing Star to Coffee River, Brake & Spotting Dominoes ---
    for idx_p, pat_t in enumerate([3.08, 3.28, 3.48]):
        clay_squish(pat_t, ["A4", "B4", "C5"][idx_p], gain=0.30, pan=-0.14, seed=810 + idx_p)

    # 3.62s: Screech brake at Caramel Coffee River bank (inside the 3.65~6.18s Stop-Down!)
    add_at(sfx, lp(render_bank("swipe/paper", dur=0.35, seed=815), 2100.0), 3.62, gain=0.38, pan=-0.12)
    add_at(sfx, render_bank("fit/pop/lip_pop", seed=816), 3.68, gain=0.42, pan=-0.12)
    sc_hits.append((3.65, 0.85))

    # 4.42s & 4.56s: Spotting the 5 Pastel Dominoes & crouching back to charge (`= =`)
    add_at(sfx, render_bank("pluck/kalimba_soft", pitch="D5", seed=817), 4.42, gain=0.38, pan=-0.10)
    add_at(sfx, render_bank("pluck/kalimba_soft", pitch="G5", seed=818), 4.56, gain=0.42, pan=-0.08)
    clay_squish(4.82, "C4", gain=0.38, pan=-0.10, seed=819)

    # --- Beat 3 (4.50 ~ 7.50s): 5-Domino Chain Topple (in pure Stop-Down Silence!) & Bridge Hops ---
    # 5.31s: Slime headbutts Domino #1 ("咚！")
    add_at(sfx, render_bank("fit/hit/bamboo_tok", seed=820), 5.31, gain=0.52, pan=-0.08)
    add_at(sfx, render_bank("fit/land.light/finger_wood", seed=821), 5.31, gain=0.46, pan=-0.08)
    sc_hits.append((5.31, 0.95))

    # 5.34s ~ 5.78s: 5 Pastel Dominoes clacking in ascending pentatonic pitches ("嗒、嗒、嗒、嗒、嗒！")
    domino_Notes = ["C5", "D5", "E5", "G5", "A5"]
    domino_times = [5.34, 5.45, 5.56, 5.67, 5.78]
    for d_idx, (dt_s, d_nt) in enumerate(zip(domino_times, domino_Notes)):
        d_pan = -0.06 + d_idx * 0.04
        add_at(sfx, render_bank("fit/tick/domino", seed=830 + d_idx), dt_s, gain=0.52, pan=d_pan)
        add_at(sfx, S.hit("woodblock", ["a", "b", "c"][d_idx % 3], vel=0.72), dt_s + 0.004, gain=0.32, pan=d_pan)
        add_at(sfx, S.note("marimba", d_nt, dur=0.32, vel=0.74), dt_s, gain=0.36, pan=d_pan)
        if d_idx >= 1:
            # Gentle creamy latte splash as each domino bridges the coffee river
            add_at(sfx, render_bank("fit/pop/mouth_plop", seed=840 + d_idx), dt_s + 0.12, gain=0.30, pan=d_pan + 0.02)

    # 6.52s, 6.85s, 7.18s, 7.46s: 4 Happy Hops across the Domino Bridge (`^ ^`)
    for h_i, (h_time, h_nt, h_pan) in enumerate([
        (6.52, "C5", -0.02),
        (6.85, "E5", 0.03),
        (7.18, "G5", 0.08),
        (7.46, "C6", 0.12),
    ]):
        clay_squish(h_time, h_nt, gain=0.36, pan=h_pan, seed=850 + h_i)
        add_at(sfx, render_bank("fit/land.light/finger_wood", seed=860 + h_i), h_time, gain=0.32, pan=h_pan)
        add_at(sfx, S.note("xylophone", h_nt, dur=0.25, vel=0.70), h_time, gain=0.28, pan=h_pan)
        sc_hits.append((h_time, 0.65))

    # --- Beat 4 (7.50 ~ 11.20s): 3 Double-Decker Macaron Trampoline Bounces! ---
    macaron_specs = [
        (8.05,  "C5", "G5", 0.14, 871),  # Mint Macaron
        (8.75,  "E5", "B5", 0.18, 872),  # Pink Macaron
        (9.45,  "G5", "D6", 0.22, 873),  # Lemon Macaron
        (10.15, "C6", "G6", 0.26, 874),  # High Apex Bounce!
    ]
    for m_time, p_lo, p_hi, m_pan, m_seed in macaron_specs:
        # Soft meringue squish (`pro_pop_in/round` + `fit/pop/mouth_plop`) + upward harp/kalimba boing!
        add_at(sfx, render_bank("pro_pop_in/round", seed=m_seed), m_time, gain=0.44, pan=m_pan)
        add_at(sfx, render_bank("fit/pop/mouth_plop", seed=m_seed + 10), m_time + 0.015, gain=0.40, pan=m_pan)
        add_at(sfx, P.pluck("kalimba", p_lo, dur=0.38, vel=0.75), m_time, gain=0.34, pan=m_pan)
        add_at(sfx, S.note("vibraphone", p_hi, dur=0.50, vel=0.72), m_time + 0.04, gain=0.30, pan=m_pan)
        sc_hits.append((m_time, 0.85))

    # --- Beat 5 (11.20 ~ 13.60s): Wooden Ruler Slope Sprint & Thumbprint Clay Star Token ---
    # 10.95s: Touchdown on wooden ruler start
    clay_squish(10.95, "G4", gain=0.42, pan=0.28, seed=880)
    add_at(sfx, render_bank("fit/land.light/finger_wood", seed=881), 10.95, gain=0.38, pan=0.28)

    # 11.08s ~ 11.80s: Rolling up the wooden ruler markings (gentle domino ticks + ascending marimba)
    ruler_notes = ["C5", "D5", "E5", "F5", "G5", "A5", "B5"]
    for r_i, r_nt in enumerate(ruler_notes):
        t_tick = 11.08 + r_i * 0.11
        add_at(sfx, render_bank("fit/tick/domino", seed=890 + r_i), t_tick, gain=0.26, pan=0.28 + r_i * 0.01)
        add_at(sfx, P.pluck("kalimba", r_nt, dur=0.25, vel=0.62), t_tick, gain=0.22, pan=0.28 + r_i * 0.01)

    # 12.15s & 12.32s: Absorbing the Thumbprint Clay Star Token (`✦ ✦`) right after the 11.92~12.30s breath!
    add_at(sfx, render_bank("fit/pop/mouth_plop", seed=898), 12.15, gain=0.42, pan=0.32)
    add_at(sfx, render_bank("fit/bell/small_bell", seed=899), 12.32, gain=0.44, pan=0.30)
    add_at(sfx, P.strum("harp", ["C5", "E5", "G5", "B5", "D6", "G6"], dur=1.10, vel=0.80, spread=0.040), 12.32, gain=0.38, pan=0.28)
    for i_s, nt_s in enumerate(["C6", "E6", "G6", "B6", "C7"]):
        add_at(sfx_bus_buf := sfx, S.note("glockenspiel", nt_s, dur=0.65, vel=0.70), 12.34 + i_s * 0.06, gain=0.24, pan=0.25)
    sc_hits.append((12.32, 0.90))

    # --- Beat 6 (13.60 ~ 15.00s): Dive into Brass Kaleidoscope Eyepiece & Blueprint Morph ---
    clay_squish(13.04, "G4", gain=0.36, pan=0.30, seed=901)
    # 13.58s: Pop into the hollow brass kaleidoscope eyepiece ("啵！")
    add_at(sfx, render_bank("fit/pop/mouth_plop", seed=902), 13.58, gain=0.52, pan=0.20)
    add_at(sfx, lp(render_bank("logo_sting/whoosh_glass", seed=903), 4800.0), 13.62, gain=0.30, pan=0.0)
    sc_hits.append((13.58, 0.85))

    # 13.70s ~ 14.85s: Rotating glass kaleidoscope beads clinking + subtle drafting compass clicks
    for b_i, (bt, b_nt) in enumerate([(13.72, "E6"), (13.90, "G6"), (14.10, "B6"), (14.32, "C6"), (14.55, "G6")]):
        add_at(sfx, S.note("hand_chimes", b_nt, dur=0.55, vel=0.64), bt, gain=0.24, pan=-0.25 + b_i * 0.12)
        add_at(sfx, render_bank("pro_hover_tick/soft", seed=910 + b_i), bt + 0.05, gain=0.18, pan=0.20 - b_i * 0.08)

    sfx_wet = S.room(lp(sfx, 5400.0), size=0.30, mix=0.14, predelay=0.009, damp=0.60)[:TOTAL_SAMPLES]
    return sfx_wet, sc_hits


def render_world_08_audio(out_wav_path: str = None) -> dict:
    if out_wav_path is None:
        out_wav_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "world_08_clay.wav")

    print("[Audio 08 Clay] Building 15.0s stop-motion miniature desk score & tactile clay Foley...")
    music_bus = build_clay_music_bus()
    sfx_bus, sc_hits = build_clay_foley_bus()

    # Whisper-quiet warm afternoon room tone
    amb_bus = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)
    warm_room = lp(lemo_sfx.brown(DURATION_S), 280.0) * 0.006
    amb_bus[:, 0] = warm_room[:TOTAL_SAMPLES]
    amb_bus[:, 1] = np.roll(warm_room[:TOTAL_SAMPLES], 320)

    # Sidechain duck music under foreground clay/domino/macaron Foley
    sc_env = master.sidechain_times(sc_hits, TOTAL_SAMPLES, depth=0.45, tau=0.14).astype(np.float32)
    raw_mix = music_bus * sc_env + sfx_bus + amb_bus

    # Macro-dynamic contour across 15s: intimate quiet opening & coffee-river stop-down (0.0~6.2s)
    # blossoming into the joyful 3-Macaron Trampoline & Star Token climax (7.8~13.6s) for LRA >= 5.5 LU!
    macro_env = np.ones(TOTAL_SAMPLES, dtype=np.float32)
    for t0, t1, g_val in [(0.0, 3.60, 0.44), (3.60, 6.20, 0.30), (6.20, 7.85, 0.62), (13.70, 15.00, 0.48)]:
        i0, i1 = int(t0 * SR), int(t1 * SR)
        macro_env[i0:i1] = g_val
    macro_env = signal.sosfilt(signal.butter(1, 3.0, btype="low", fs=SR, output="sos"), macro_env).astype(np.float32)
    raw_mix *= macro_env[:, None]

    # Master to exact -14.0 LUFS and <= -2.27 dBTP (ceiling=0.77)
    mastered, _ = master.finish(
        raw_mix,
        lufs=-14.0,
        ceiling=0.77,
        mono_hz=120.0,
        comp=False,
        drive=1.06,
        air=0.10,
        hp_hz=28.0,
        end_fade=0.06,
        tail_zero=480,
    )
    mastered = mastered[:TOTAL_SAMPLES].astype(np.float32)

    os.makedirs(os.path.dirname(os.path.abspath(out_wav_path)), exist_ok=True)
    sf.write(out_wav_path, mastered, SR, subtype="PCM_24")
    metrics = master.measure(mastered)
    print(f"[Audio 08 Clay] Mastered {out_wav_path} -> {metrics}")
    return metrics


if __name__ == "__main__":
    out_path = os.path.join(WORLD_DIR, "world_08_clay.wav")
    render_world_08_audio(out_path)
