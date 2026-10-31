#!/usr/bin/env python3
"""
StyleHop Hybrid Acoustic Grain & Micro-Sample Generator (`tools/audio_grains.py`).

Generates 12 deterministic, 48kHz 16-bit WAV physical material micro-samples & impulse
textures in `assets/audio/` for `tools/sound.py` hybrid granular + physical modeling synthesis:

  1. `parchment_quill_grain.wav`   — Stick-slip steel nib / quill etching on parchment fibers
  2. `cardstock_fold_grain.wav`    — 300gsm cardstock crease buckling, fiber snap & page sweep
  3. `brass_escapement_grain.wav`  — Precision brass gear pawl click, spring detent & modal ring
  4. `foliage_paw_grain.wav`       — Moss/grass/leaf cellular rustle & soft paw pad compression
  5. `stream_bubble_grain.wav`     — Brook water turbulence + Minnaert bubble pinch-off cascade
  6. `ceramic_clink_grain.wav`     — Porcelain/borosilicate crystalline transient & beating modes
  7. `clay_squish_grain.wav`       — Viscoelastic polymer clay micro-suction & tabletop thud
  8. `silk_brush_grain.wav`        — Wolf-hair brush bristle sweep & flying-white paper tear
  9. `woodblock_mallet_grain.wav`  — Hollow rosewood/paulownia cavity strike transient
  10. `vinyl_optical_grain.wav`    — 1930s 78rpm shellac crackle, dust pops & optical flutter
  11. `crystal_shimmer_grain.wav`  — High-harmonic glass armonica / celesta bell dust
  12. `canyon_air_ir.wav`          — Stereo studio & natural space early-reflection IR

Usage:
  python3 tools/audio_grains.py [--out-dir assets/audio]
"""

import argparse
from pathlib import Path
import wave
import numpy as np
from scipy import signal

SR = 48000


def pink_noise(n: int, rng: np.random.Generator) -> np.ndarray:
    white = rng.standard_normal(n)
    spec = np.fft.rfft(white)
    freqs = np.fft.rfftfreq(n, d=1.0 / SR)
    scale = 1.0 / np.sqrt(np.maximum(freqs, 20.0))
    scale[0] = 0.0
    out = np.fft.irfft(spec * scale, n=n)
    return out / (np.max(np.abs(out)) + 1e-12)


def bp(sig: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    nyq = 0.5 * SR
    lo_n = float(np.clip(lo / nyq, 1e-4, 0.96))
    hi_n = float(np.clip(hi / nyq, lo_n + 1e-3, 0.99))
    sos = signal.butter(order, [lo_n, hi_n], btype="bandpass", output="sos")
    return signal.sosfilt(sos, sig)


def lp(sig: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, float(np.clip(fc / (0.5 * SR), 1e-4, 0.98)), btype="low", output="sos")
    return signal.sosfilt(sos, sig)


def hp(sig: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, float(np.clip(fc / (0.5 * SR), 1e-4, 0.98)), btype="high", output="sos")
    return signal.sosfilt(sos, sig)


def time_varying_bp(sig: np.ndarray, f_curve: np.ndarray, q: float = 3.0, block: int = 128) -> np.ndarray:
    n = len(sig)
    out = np.zeros(n, dtype=np.float64)
    nyq = 0.5 * SR
    zi = None
    for i in range(0, n, block):
        j = min(n, i + block)
        fc = float(np.clip(f_curve[(i + j) // 2], 40.0, nyq * 0.92))
        bw = max(fc / max(q, 0.5), 25.0)
        lo = np.clip((fc - 0.5 * bw) / nyq, 0.001, 0.94)
        hi = np.clip((fc + 0.5 * bw) / nyq, lo + 0.002, 0.97)
        sos = signal.butter(2, [lo, hi], btype="bandpass", output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2), dtype=np.float64)
        out[i:j], zi = signal.sosfilt(sos, sig[i:j], zi=zi)
    return out


def fade_norm(sig: np.ndarray, fi_s: float = 0.002, fo_s: float = 0.015, peak: float = 0.92) -> np.ndarray:
    n = len(sig)
    out = sig.copy()
    fi = min(int(fi_s * SR), n // 3)
    fo = min(int(fo_s * SR), n // 3)
    if fi > 1:
        w = 0.5 * (1.0 - np.cos(np.pi * np.arange(fi) / fi))
        out[:fi] *= w[:, None] if out.ndim == 2 else w
    if fo > 1:
        w = 0.5 * (1.0 + np.cos(np.pi * np.arange(fo) / fo))
        out[-fo:] *= w[:, None] if out.ndim == 2 else w
    mx = float(np.max(np.abs(out))) + 1e-12
    return out * (peak / mx)


def modal_cluster(f0: float, ratios, amps, decays, dur: float, rng: np.random.Generator, glide: float = 0.0) -> np.ndarray:
    n = int(round(dur * SR))
    t = np.arange(n, dtype=np.float64) / SR
    if abs(glide) > 1e-5:
        f_env = f0 * (1.0 + glide * np.exp(-t / 0.035))
        phase = 2.0 * np.pi * np.cumsum(f_env) / SR
    else:
        phase = 2.0 * np.pi * f0 * t
    att = 1.0 - np.exp(-t / 0.0007)
    out = np.zeros(n, dtype=np.float64)
    for r, a, d in zip(ratios, amps, decays):
        if f0 * r >= 0.46 * SR:
            continue
        det = 1.0 + rng.uniform(-0.0025, 0.0025)
        out += a * att * np.exp(-t / d) * np.sin(r * det * phase + rng.uniform(0, 0.4))
    return out


def minnaert_bubble(f0: float, dur: float = 0.034, mult: float = 2.15) -> np.ndarray:
    n = max(12, int(round(dur * SR)))
    t = np.arange(n, dtype=np.float64) / SR
    tau = dur * 0.74
    f_inst = f0 * (1.0 + (mult - 1.0) * np.power(np.clip(t / tau, 0.0, 1.2), 1.7))
    phase = 2.0 * np.pi * np.cumsum(f_inst) / SR
    env = (1.0 - np.exp(-t / 0.002)) * np.exp(-t / (dur * 0.34))
    return env * np.sin(phase)


def add_at(buf: np.ndarray, sig: np.ndarray, t_sec: float, gain: float = 1.0):
    i0 = int(round(t_sec * SR))
    if i0 < 0 or i0 >= len(buf):
        return
    i1 = min(len(buf), i0 + len(sig))
    buf[i0:i1] += sig[: i1 - i0] * gain


# =============================================================================
# GRAIN RECIPES
# =============================================================================

def gen_parchment_quill_grain(seed: int = 1001) -> np.ndarray:
    """Stick-slip steel nib / quill etching on cotton parchment fibers (1.1s)."""
    rng = np.random.default_rng(seed)
    dur = 1.10
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float64) / SR
    out = np.zeros(n, dtype=np.float64)

    # 4 distinct calligraphic/etching strokes with stick-slip micro-impulses
    strokes = [(0.02, 0.24, 1950.0, 3400.0), (0.29, 0.21, 2300.0, 3900.0), (0.54, 0.26, 1750.0, 3100.0), (0.83, 0.22, 2450.0, 4200.0)]
    for s_start, s_dur, f_lo, f_hi in strokes:
        sn = int(s_dur * SR)
        st = np.arange(sn, dtype=np.float64) / SR
        u = st / s_dur
        vel = np.sin(np.pi * np.power(u, 0.78)) ** 1.25
        f_sweep = f_lo + (f_hi - f_lo) * np.sin(np.pi * u * 0.85)
        # Stick-slip impulse train (rate proportional to nib velocity)
        slip_train = np.zeros(sn, dtype=np.float64)
        pos = 0.0
        while pos < s_dur - 0.003:
            v_loc = float(np.interp(pos, st, vel))
            rate = 110.0 + 380.0 * v_loc
            idx = int(pos * SR)
            if idx < sn - 16:
                f_nib = float(rng.uniform(2800.0, 6800.0))
                k_len = min(36, sn - idx)
                kt = np.arange(k_len) / SR
                slip_train[idx : idx + k_len] += (
                    np.sin(2.0 * np.pi * f_nib * kt) * np.exp(-kt / 0.00045) * rng.uniform(0.4, 1.0) * v_loc
                )
            pos += (1.0 / rate) * rng.uniform(0.75, 1.28)
        fiber_noise = time_varying_bp(pink_noise(sn, rng), f_sweep, q=3.8) * vel * 0.55
        nib_ring = bp(slip_train, 1600.0, 8200.0) * 0.75
        desk_body = bp(pink_noise(sn, rng), 220.0, 680.0) * vel * 0.18
        add_at(out, fiber_noise + nib_ring + desk_body, s_start, 1.0)

    return fade_norm(out, 0.004, 0.025)


def gen_cardstock_fold_grain(seed: int = 1002) -> np.ndarray:
    """Heavy 300gsm cardstock crease buckling, fiber snap & page turn sweep (0.95s)."""
    rng = np.random.default_rng(seed)
    dur = 0.95
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float64) / SR
    u = t / dur

    # Stage 1: Aerodynamic page lift whoosh (0.02..0.48s)
    env_whoosh = np.exp(-((t - 0.22) / 0.13) ** 2)
    f_curve = 280.0 + 1350.0 * np.sin(np.pi * np.clip(t / 0.50, 0.0, 1.0))
    whoosh = time_varying_bp(pink_noise(n, rng), f_curve, q=2.4) * env_whoosh * 0.65

    # Stage 2: Cardstock fiber buckling & crease crinkle micro-snaps (0.28..0.68s)
    crinkle = np.zeros(n, dtype=np.float64)
    for at in np.sort(rng.uniform(0.18, 0.72, 28)):
        f0 = float(rng.uniform(950.0, 4400.0))
        snap = modal_cluster(f0, [1.0, 1.85, 3.1], [1.0, 0.55, 0.28], [0.016, 0.009, 0.005], 0.04, rng, glide=0.22)
        add_at(crinkle, snap, float(at), float(rng.uniform(0.15, 0.55)))

    # Stage 3: Crisp pop-up lock snap & tabletop settle at t=0.64s
    lock_snap = modal_cluster(420.0, [1.0, 2.38, 4.12], [1.0, 0.48, 0.22], [0.055, 0.028, 0.012], 0.16, rng, glide=0.28)
    add_at(crinkle, lock_snap, 0.64, 0.85)
    add_at(crinkle, bp(rng.standard_normal(int(0.015 * SR)), 1200.0, 6200.0) * np.exp(-np.arange(int(0.015 * SR)) / (0.003 * SR)), 0.64, 0.65)

    return fade_norm(whoosh + crinkle, 0.003, 0.03)


def gen_brass_escapement_grain(seed: int = 1003) -> np.ndarray:
    """Precision brass gear pawl click train, spring detent & modal ring (0.85s)."""
    rng = np.random.default_rng(seed)
    dur = 0.85
    n = int(dur * SR)
    out = np.zeros(n, dtype=np.float64)

    # Accelerating then settling brass ratchet clicks
    tt = 0.015
    k = 0
    while tt < dur - 0.08:
        u = tt / dur
        rate = 14.0 + 22.0 * np.sin(np.pi * u)
        f_brass = float(rng.uniform(1850.0, 2950.0)) * (1.08 if k % 2 == 0 else 0.94)
        pawl = modal_cluster(
            f_brass,
            [1.0, 1.498, 2.003, 2.76, 3.88],
            [1.0, 0.58, 0.44, 0.26, 0.14],
            [0.048, 0.032, 0.022, 0.014, 0.008],
            0.09,
            rng,
        )
        transient = bp(rng.standard_normal(int(0.003 * SR)), 3800.0, 10500.0) * np.exp(-np.arange(int(0.003 * SR)) / (0.0007 * SR))
        pawl[: len(transient)] += transient * 0.55
        amp = (1.0 if k % 4 == 0 else 0.68) * float(rng.uniform(0.85, 1.08))
        add_at(out, pawl, tt, amp)
        if k % 4 == 0:
            detent = modal_cluster(240.0, [1.0, 2.15], [1.0, 0.45], [0.04, 0.02], 0.08, rng, glide=0.25)
            add_at(out, detent, tt, 0.45 * amp)
        tt += (1.0 / rate) * float(rng.uniform(0.94, 1.06))
        k += 1

    # Continuous subtle brass axle friction whirr
    whirr = bp(pink_noise(n, rng), 520.0, 2400.0) * np.sin(np.pi * np.arange(n) / n) * 0.12
    return fade_norm(out + whirr, 0.001, 0.025)


def gen_foliage_paw_grain(seed: int = 1004) -> np.ndarray:
    """Warm, soft velvet paw pad on damp moss (low-passed, zero harsh high-frequency hiss)."""
    rng = np.random.default_rng(seed)
    dur = 0.80
    n = int(dur * SR)
    out = np.zeros(n, dtype=np.float64)

    for idx, t0 in enumerate([0.02, 0.28, 0.54]):
        gn = int(0.22 * SR)
        gt = np.arange(gn, dtype=np.float64) / SR
        f_pad = 48.0 + 32.0 * np.exp(-gt / 0.022)
        pad = np.sin(2.0 * np.pi * np.cumsum(f_pad) / SR) * np.exp(-gt / 0.045) * (1.0 - np.exp(-gt / 0.004)) * 0.55
        swish = bp(pink_noise(gn, rng), 220.0, 1100.0) * np.exp(-((gt - 0.05) / 0.045) ** 2) * 0.18
        add_at(out, lp(pad + swish, 1300.0), t0, 1.0 - 0.08 * idx)

    return fade_norm(out, 0.005, 0.03, peak=0.48)


def gen_stream_bubble_grain(seed: int = 1005) -> np.ndarray:
    """Gentle, warm nocturnal lake ripple & soft low-mid water droplets (1.35s)."""
    rng = np.random.default_rng(seed)
    dur = 1.35
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float64) / SR

    lfo1 = np.sin(2.0 * np.pi * 1.4 * t + 0.3) * 0.5 + 0.5
    stream_lo = bp(pink_noise(n, rng), 180.0, 720.0) * (0.45 + 0.35 * lfo1) * 0.30
    out = stream_lo

    for at in np.sort(rng.uniform(0.05, dur - 0.08, 9)):
        f0 = float(rng.uniform(280.0, 620.0))
        bdur = float(rng.uniform(0.032, 0.058))
        bub = minnaert_bubble(f0, bdur, 1.42)
        add_at(out, bub, float(at), float(rng.uniform(0.20, 0.48)))

    return fade_norm(lp(out, 1500.0), 0.02, 0.04, peak=0.52)


def gen_ceramic_clink_grain(seed: int = 1006) -> np.ndarray:
    """Porcelain teacup / glass crystalline contact transient & beating modal ring (0.72s)."""
    rng = np.random.default_rng(seed)
    dur = 0.72
    n = int(dur * SR)
    out = np.zeros(n, dtype=np.float64)

    hits = [(0.005, 1320.0, 1.0), (0.022, 1985.0, 0.68), (0.34, 1580.0, 0.82)]
    for at, f0, amp in hits:
        ring = modal_cluster(
            f0,
            [1.0, 1.582, 2.374, 3.441, 4.918],
            [1.0, 0.62, 0.42, 0.25, 0.12],
            [0.26, 0.18, 0.11, 0.065, 0.035],
            0.36,
            rng,
        )
        click_n = int(0.0022 * SR)
        ring[:click_n] += bp(rng.standard_normal(click_n), 3200.0, 11500.0) * np.exp(-np.arange(click_n) / (0.0005 * SR)) * 0.65
        add_at(out, ring, at, amp)

    return fade_norm(out, 0.0004, 0.025)


def gen_clay_squish_grain(seed: int = 1007) -> np.ndarray:
    """Viscoelastic polymer clay compression, micro-suction release & tabletop thud (0.65s)."""
    rng = np.random.default_rng(seed)
    dur = 0.65
    n = int(dur * SR)
    out = np.zeros(n, dtype=np.float64)

    for idx, t0 in enumerate([0.01, 0.33]):
        sn = int(0.28 * SR)
        st = np.arange(sn, dtype=np.float64) / SR
        # 1. Matte polymer dough compression thump (pitch drops 165 -> 68 Hz, then rebounds -> 135 Hz)
        f_dough = 68.0 + 98.0 * np.exp(-st / 0.024) + 52.0 * np.exp(-((st - 0.085) / 0.032) ** 2)
        phase = 2.0 * np.pi * np.cumsum(f_dough) / SR
        dough = np.sin(phase) * np.exp(-st / 0.085) * (1.0 - np.exp(-st / 0.002)) * 0.68
        # 2. Viscoelastic micro-bubble suction pops during squeeze & release
        suction = time_varying_bp(pink_noise(sn, rng), 380.0 + 1450.0 * np.sin(np.pi * np.clip(st / 0.14, 0.0, 1.0)), q=4.2)
        suction *= np.exp(-((st - 0.055) / 0.042) ** 2) * 0.45
        for b_off, b_f in [(0.032, 520.0), (0.068, 780.0), (0.105, 960.0)]:
            add_at(suction, minnaert_bubble(b_f * (1.0 + 0.1 * idx), 0.024, 1.85), b_off, 0.38)
        add_at(out, dough + suction, t0, 1.0 if idx == 0 else 0.88)

    return fade_norm(out, 0.001, 0.02)


def gen_silk_brush_grain(seed: int = 1008) -> np.ndarray:
    """Wolf-hair calligraphic brush sweep & flying-white Xuan paper bristle friction (0.95s)."""
    rng = np.random.default_rng(seed)
    dur = 0.95
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float64) / SR
    u = t / dur

    env = np.sin(np.pi * np.power(u, 0.68)) ** 1.35 * (0.78 + 0.22 * np.sin(2.0 * np.pi * 19.0 * t))
    f_body = 420.0 + 920.0 * np.sin(np.pi * u)
    f_bristle = 2100.0 + 2800.0 * np.power(u, 0.85)
    body = time_varying_bp(pink_noise(n, rng), f_body, q=2.2) * env * 0.65
    bristle = time_varying_bp(pink_noise(n, rng), f_bristle, q=3.6) * env * 0.48
    return fade_norm(body + bristle, 0.008, 0.03)


def gen_woodblock_mallet_grain(seed: int = 1009) -> np.ndarray:
    """Hollow rosewood / paulownia tabletop woodblock & mallet strikes (0.55s)."""
    rng = np.random.default_rng(seed)
    dur = 0.55
    n = int(dur * SR)
    out = np.zeros(n, dtype=np.float64)

    for idx, (t0, f0) in enumerate([(0.005, 480.0), (0.18, 610.0), (0.35, 540.0)]):
        strike = modal_cluster(
            f0,
            [1.0, 2.42, 4.15, 6.30],
            [1.0, 0.46, 0.22, 0.08],
            [0.052, 0.026, 0.013, 0.006],
            0.16,
            rng,
            glide=0.14,
        )
        c_n = int(0.003 * SR)
        strike[:c_n] += bp(rng.standard_normal(c_n), 900.0, 3800.0) * np.exp(-np.arange(c_n) / (0.0008 * SR)) * 0.48
        add_at(out, strike, t0, 1.0 - 0.1 * idx)

    return fade_norm(out, 0.0004, 0.02)


def gen_vinyl_optical_grain(seed: int = 1010) -> np.ndarray:
    """1930s 78rpm shellac surface crackle, dust pops & optical film projector flutter (1.50s)."""
    rng = np.random.default_rng(seed)
    dur = 1.50
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float64) / SR

    # 24fps optical sprocket / lamp hum & warm hiss
    flutter = 0.65 + 0.35 * np.sin(2.0 * np.pi * 24.0 * t)
    hiss = bp(pink_noise(n, rng), 650.0, 4800.0) * flutter * 0.22

    # Fine shellac crackle + occasional dust pops
    crackle_mask = (rng.random(n) < 0.0032).astype(np.float64)
    crackle = bp(crackle_mask * rng.normal(0.0, 0.55, n), 1400.0, 6200.0)
    pops = np.zeros(n, dtype=np.float64)
    for at in rng.uniform(0.05, dur - 0.05, 14):
        plen = int(0.004 * SR)
        pt = np.arange(plen) / SR
        pop = np.sin(2.0 * np.pi * rng.uniform(420.0, 1100.0) * pt) * np.exp(-pt / 0.0009)
        add_at(pops, pop, float(at), float(rng.uniform(0.35, 0.90)))

    return fade_norm(hiss + crackle + pops, 0.01, 0.02, peak=0.85)


def gen_crystal_shimmer_grain(seed: int = 1011) -> np.ndarray:
    """Warm mid-register harmonic pad & soft wooden-bell shimmer (1.20s, zero high-frequency piercing)."""
    rng = np.random.default_rng(seed)
    dur = 1.20
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float64) / SR
    out = np.zeros(n, dtype=np.float64)

    env_rub = np.sin(np.pi * np.power(t / dur, 0.75)) ** 1.4
    for f_rub, amp in [(261.63, 0.42), (392.00, 0.34), (523.25, 0.26), (659.25, 0.18)]:
        vib = 1.0 + 0.0025 * np.sin(2.0 * np.pi * 4.5 * t + rng.uniform(0, 6.28))
        out += amp * env_rub * np.sin(2.0 * np.pi * np.cumsum(f_rub * vib) / SR)

    for at in np.sort(rng.uniform(0.08, dur - 0.22, 5)):
        f_bell = float(rng.choice([523.25, 659.25, 783.99, 987.77]) * rng.uniform(0.996, 1.004))
        ping = modal_cluster(f_bell, [1.0, 2.0], [1.0, 0.25], [0.28, 0.12], 0.32, rng)
        add_at(out, ping, float(at), float(rng.uniform(0.18, 0.35)))

    return fade_norm(lp(out, 1800.0), 0.015, 0.06, peak=0.50)


def gen_canyon_air_ir(seed: int = 1012) -> np.ndarray:
    """True stereo multi-tap early reflection & natural canyon/studio air tail IR (0.95s)."""
    rng = np.random.default_rng(seed)
    dur = 0.95
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float64) / SR
    ir = np.zeros((n, 2), dtype=np.float64)
    ir[0, 0] = 0.62
    ir[0, 1] = 0.62

    taps = [
        (7.3, 0.22, 0.18),
        (13.7, 0.16, 0.21),
        (21.9, 0.18, 0.14),
        (33.1, 0.13, 0.16),
        (48.7, 0.12, 0.10),
        (69.3, 0.09, 0.11),
        (97.1, 0.075, 0.065),
        (138.3, 0.055, 0.060),
        (194.7, 0.040, 0.038),
        (276.1, 0.026, 0.028),
    ]
    for ms, gl, gr in taps:
        idx = int(ms * 0.001 * SR)
        if idx < n:
            ir[idx, 0] += gl
            ir[min(n - 1, idx + 7), 1] += gr

    tail_l = bp(pink_noise(n, rng), 180.0, 4200.0) * np.exp(-t / 0.28) * 0.025
    tail_r = bp(pink_noise(n, rng), 180.0, 4200.0) * np.exp(-t / 0.29) * 0.025
    ir[:, 0] += tail_l
    ir[:, 1] += tail_r

    energy = np.sqrt(np.sum(ir ** 2) * 0.5 + 1e-12)
    return (ir / max(energy, 1.0)).astype(np.float64)


def save_wav(path: Path, data: np.ndarray):
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm16 = np.clip(np.round(data * 32767.0), -32768, 32767).astype(np.int16)
    nch = 2 if data.ndim == 2 else 1
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(nch)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm16.tobytes())


RECIPES = {
    "parchment_quill_grain.wav": gen_parchment_quill_grain,
    "cardstock_fold_grain.wav": gen_cardstock_fold_grain,
    "brass_escapement_grain.wav": gen_brass_escapement_grain,
    "foliage_paw_grain.wav": gen_foliage_paw_grain,
    "stream_bubble_grain.wav": gen_stream_bubble_grain,
    "ceramic_clink_grain.wav": gen_ceramic_clink_grain,
    "clay_squish_grain.wav": gen_clay_squish_grain,
    "silk_brush_grain.wav": gen_silk_brush_grain,
    "woodblock_mallet_grain.wav": gen_woodblock_mallet_grain,
    "vinyl_optical_grain.wav": gen_vinyl_optical_grain,
    "crystal_shimmer_grain.wav": gen_crystal_shimmer_grain,
    "canyon_air_ir.wav": gen_canyon_air_ir,
}


def ensure_audio_grains(out_dir: Path = None) -> Path:
    repo_root = Path(__file__).resolve().parent.parent
    target_dir = out_dir if out_dir is not None else (repo_root / "assets" / "audio")
    target_dir.mkdir(parents=True, exist_ok=True)
    for fname, fn in RECIPES.items():
        fpath = target_dir / fname
        if not fpath.exists():
            sig = fn()
            save_wav(fpath, sig)
    return target_dir


def main():
    parser = argparse.ArgumentParser(description="Generate hybrid physical audio grains in assets/audio/.")
    parser.add_argument("--out-dir", type=str, default="assets/audio", help="Output directory")
    parser.add_argument("--force", action="store_true", help="Overwrite existing grain files")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    out_dir = (repo_root / args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    total_bytes = 0
    for fname, fn in RECIPES.items():
        dest = out_dir / fname
        if args.force or not dest.exists():
            sig = fn()
            save_wav(dest, sig)
        sz = dest.stat().st_size
        total_bytes += sz
        print(f"[audio_grains] wrote {dest.relative_to(repo_root)} ({sz / 1024:.1f} KB)")
    print(f"[audio_grains] complete: {len(RECIPES)} files, {total_bytes / 1024:.1f} KB total")


if __name__ == "__main__":
    main()
