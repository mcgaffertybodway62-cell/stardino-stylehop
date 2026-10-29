#!/usr/bin/env python3
"""
World 03 — Cyberpunk Blade-Runner Neon Transit ("赛博霓虹 · 飞跃天际")
Audio Designer & Master Engineer: 24.0s @ 48kHz Stereo (-14.0 LUFS, -2.27 dBTP)

Revision 3 (2026-10-19) — 回归系列音色语法 + 音乐动态跟随画面能量
================================================================================
R2 的失败教训（已回滚）：R2 为了"赛博朋克感"加了 4/4 电音底鼓、连续 16 分贝斯墙、
高八度 supersaw 主奏、4-bit 方波 bleep、噪声 stutter 和层层高频 shelf。
这恰好是 World 02 文档里明确点名要消灭的三件事：

    "Design Principles (Addressing 好吵的音效):
     Eliminates harsh square waves, high-shelf boosts, and continuous 16th-note
     wall-of-sound."

R2 把这三样全加回来了，频谱质心被推到 1535Hz（其余 9 个世界是 477~888Hz），
2~5kHz 占到 11.1%（其余最高 6.6%），听感变成"吵闹的 EDM"而不是"赛博朋克电影配乐"。
R3 全部删除，改回本系列一贯的做法：**真实采样乐器为骨、合成器只做暗色低通铺底、
稀疏留白、大量 stop-down**。

--------------------------------------------------------------------------------
A. 音乐动态跟随画面能量（本次的核心修正）
   逐帧测量成片（720 帧，motion + 饱和度 + 亮度合成）得到画面自身的能量曲线：
        3.5 ~ 4.5s  0.84  ← 全片第一幕最亮的视觉峰值（180° 环绕揭示整列车）
        6.0 ~ 6.5s  0.21  ← 真正的静止（2D 刀锋眼分镜定格）
       10.5 ~ 11.5s 0.73  ← 全片动作峰值（三级蹬墙跳）
       15.5 ~ 16.5s 0.31  ← 吞星芒后拉远 / 正面特写 / 眨眼
       21.0 ~ 24.0s 0.20  ← 纯白空间（全片最静）
   R2 的音乐在 7.0~19.5s 是一堵 12.5 秒不变的音墙，画面在呼吸、音乐没有呼吸，
   所以"对不上号"。R3 的音乐总线由 CONTOUR 曲线驱动，峰值落在 3.95s 与 11.50s，
   并在 5.70~6.90 / 15.70~17.05 / 19.30~19.52 / 21.0~24.0 真正让开。

B. 卡点（沿用 R2 已核验的对齐，30 个画面事件 28 个在 ±45ms 内有音频瞬态）
   CUE 表 = `split/10_story_director_18s.js` 导演轨真实时刻：
   0.00 超空间闪光 / 1.15 六角星门 / 2.40 重砸 Car#4 / 3.20~5.60 环绕揭示
   5.60~7.00 蓄力 + 5.88 刀锋眼分镜 / 7.00 弹射 / 8.15·8.80(踩无人机)·9.45·10.35 落脚
   11.08 / 11.88 / 12.68 三级蹬墙跳台 / 13.68 踏锦鲤 / 14.70 落车头
   15.32 吞星芒 ✦✦ / 15.70·16.55 切镜 / 16.78 眨眼 / 17.06 蓄力
   17.50 超频爆发 / 18.45 线框坍缩 / 19.30~19.52 撞击冻结(绝对静音)
   19.52 画框爆炸 + 2D 正侧视黑白狂飙 / 20.68 纯白空间 / 22.85 惊觉[!] / 23.12 坠落

C. 保留 R2 的正确部分：雨/霓虹/磁浮 ambience、低频清理（不再有 36Hz 废能量）、
   冻结帧数字零、开场电平提升。

Toolchain: earshot.forge.bank (fitted Foley) + lemo-opuscar sampler/pluck (real instruments)
"""

import os
import sys
import numpy as np
import soundfile as sf
from scipy import signal
from scipy.signal import resample_poly

# Repository root derived from __file__ (no absolute paths)
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from audio_deps import require_audio_upstream
require_audio_upstream()   # 缺失时抛出带安装指引的错误，绝不静默降级

from core.audio import sampler as S, pluck as P
from earshot.forge import bank
import master

SR = 48000
DURATION = 24.0
N_SAMPLES = int(SR * DURATION)

# ---------------------------------------------------------------------------
# Music dynamic contour — breakpoints measured from the render's own frame
# energy (see docstring §A). Linear interpolation between points.
# ---------------------------------------------------------------------------
CONTOUR = [
    # Music macro contour:
    #   - 5.60~7.00s: taut cold-blooded duck (0.28 -> 0.78 launch build-up)
    #   - 9.92~10.65s: HARD BRAKE STOP-DOWN at Red-X Laser Wall ([?] -> [!])
    #   - 15.70~17.05s: close-up blink stop-down (near-silent during 16.55~17.05s blink!)
    #   - 17.50~19.28s: rising overdrive + wireframe singularity implosion
    #   - 19.30~19.51s: 100% digital zero singularity freeze
    #   - 19.52~20.68s: ZERO-PITCH-SHIFT SUSTAINED CLIMAX DRONE locked at 1.00!
    #   - 20.68~24.00s: Cross-world cadence resolve into ink-wash void & dissolve
    (0.00, 0.42), (0.60, 0.48), (1.50, 0.56), (2.30, 0.42),
    (2.40, 1.00),                                   # SLAM
    (2.80, 0.62), (3.20, 0.68), (3.95, 0.90),       # orbit reveal + spinner #1
    (4.60, 0.78), (5.20, 0.70),
    (5.64, 0.30), (5.88, 0.28), (6.55, 0.34), (6.95, 0.80),
    (7.00, 1.00), (7.60, 0.88), (8.15, 0.92), (8.80, 0.98), (9.45, 0.90), (9.88, 0.92),
    # STOP-DOWN #2 (9.92~10.65s): Hard skid-brake in front of Red-X Laser Wall ([?] -> [!])
    (9.93, 0.12), (10.45, 0.14), (10.64, 0.65), (10.68, 1.00),
    (11.50, 1.00), (12.20, 0.94), (12.68, 0.88), (13.68, 0.85), (14.30, 0.76),
    (14.70, 0.88), (15.32, 0.96),                   # STAR ✦✦
    (15.68, 0.32), (16.45, 0.22), (16.55, 0.06), (17.04, 0.06), (17.08, 0.68),
    (17.50, 0.95), (18.45, 0.98), (19.25, 1.00),    # OVERDRIVE + SINGULARITY IMPLOSION
    (19.30, 0.00), (19.51, 0.00),                   # FREEZE (enforced digital zero)
    (19.52, 1.00), (20.66, 1.00),                   # SUSTAINED B&W CLIMAX DRONE!
    # Cross-world resolve at 20.68s, then gradual fade into ink-wash silence
    (20.68, 0.82), (21.35, 0.42), (22.30, 0.16), (22.80, 0.04), (24.00, 0.02),
]


def contour_gain(n: int, pts=CONTOUR, floor: float = 0.0) -> np.ndarray:
    """Piecewise-linear gain curve over the whole timeline.

    `floor` lifts the curve's bottom: the music goes all the way down (floor=0) while the
    Foley/ambience bed only follows part way (floor~0.32), so the whole world still breathes
    but a key hit inside a stop-down stays audible.
    """
    ts = np.array([p[0] for p in pts], dtype=np.float64)
    vs = np.array([p[1] for p in pts], dtype=np.float64)
    t = np.arange(n, dtype=np.float64) / SR
    g = np.interp(t, ts, vs)
    return (floor + (1.0 - floor) * g).astype(np.float32)[:, None]


# ---------------------------------------------------------------------------
# DSP & Mixing Helpers
# ---------------------------------------------------------------------------

def pan_mono(x: np.ndarray, pan: float = 0.0) -> np.ndarray:
    """Constant-power stereo panner (-1.0 left .. +1.0 right)."""
    x = np.asarray(x, dtype=np.float32)
    if x.ndim == 2:
        return x
    theta = (np.clip(pan, -1.0, 1.0) + 1.0) * (np.pi / 4.0)
    return np.column_stack([x * np.cos(theta), x * np.sin(theta)]).astype(np.float32)


def add_at(buf: np.ndarray, sig: np.ndarray, t_sec: float, gain: float = 1.0, pan: float = 0.0):
    """Safely mix mono or stereo signal `sig` into stereo `buf` at `t_sec`."""
    if sig is None or len(sig) == 0:
        return
    idx = int(round(t_sec * SR))
    if idx >= len(buf):
        return
    if sig.ndim == 1:
        st = pan_mono(sig * float(gain), pan)
    else:
        theta_l = 1.0 - max(0.0, pan) * 0.4
        theta_r = 1.0 + min(0.0, pan) * 0.4
        st = np.column_stack([sig[:, 0] * float(gain) * theta_l,
                              sig[:, 1] * float(gain) * theta_r]).astype(np.float32)
    if idx < 0:
        st = st[-idx:]
        idx = 0
    end = min(len(buf), idx + len(st))
    if end > idx:
        buf[idx:end] += st[: end - idx]


def lp(x: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, min(fc, SR * 0.48), btype='low', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


def hp(x: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, max(fc, 15.0), btype='high', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


def bp(x: np.ndarray, f_lo: float, f_hi: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, [max(f_lo, 20.0), min(f_hi, SR * 0.48)], btype='band', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


def peak_eq(x: np.ndarray, f0: float, q: float, db: float) -> np.ndarray:
    """Peaking EQ (positive db = boost)."""
    A = 10.0 ** (db / 40.0)
    w0 = 2.0 * np.pi * f0 / SR
    alpha = np.sin(w0) / (2.0 * q)
    b0, b1, b2 = 1.0 + alpha * A, -2.0 * np.cos(w0), 1.0 - alpha * A
    a0, a1, a2 = 1.0 + alpha / A, -2.0 * np.cos(w0), 1.0 - alpha / A
    b = np.array([b0 / a0, b1 / a0, b2 / a0])
    a = np.array([1.0, a1 / a0, a2 / a0])
    return signal.lfilter(b, a, x, axis=0).astype(np.float32)


def air_shelf(x: np.ndarray, fc: float = 4000.0, db: float = 2.0) -> np.ndarray:
    """Gentle high shelf. Kept small on purpose — this series has already rejected
    stacked high-shelf boosts once (see World 02's design notes)."""
    sos = signal.butter(1, min(fc, SR * 0.45), btype='high', fs=SR, output='sos')
    return (x + signal.sosfilt(sos, x, axis=0) * (10.0 ** (db / 20.0) - 1.0)).astype(np.float32)


def low_shelf(x: np.ndarray, fc: float = 55.0, db: float = -9.0) -> np.ndarray:
    """Low shelf: trim true sub-rumble while leaving the bass fundamentals untouched."""
    sos = signal.butter(2, max(fc, 20.0), btype='low', fs=SR, output='sos')
    low = signal.sosfilt(sos, x, axis=0)
    return (x + low * (10.0 ** (db / 20.0) - 1.0)).astype(np.float32)


def drive_os(x: np.ndarray, amount: float = 2.0, drive_mix: float = 1.0) -> np.ndarray:
    """2x-oversampled tanh waveshaper. `amount` stays low here: just enough to give the
    dark bass some harmonics, nowhere near a distorted-lead sound."""
    if amount <= 1.0:
        return np.asarray(x, dtype=np.float32)
    shape = x.shape
    up = resample_poly(x, 2, 1, axis=0)
    up = np.tanh(up * amount) / np.tanh(amount)
    dn = resample_poly(up, 1, 2, axis=0)[: shape[0]]
    out = np.asarray(x, dtype=np.float32) * (1.0 - drive_mix) + dn.astype(np.float32) * drive_mix
    return out


def bl_saw(freq: float, dur: float, nh_max: int = 28, phase: float = 0.0) -> np.ndarray:
    """Band-limited additive sawtooth (no aliasing): sum of harmonics below 14 kHz."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    t = np.arange(n, dtype=np.float32) / SR
    nh = int(min(nh_max, max(1, 14000.0 / max(freq, 1.0))))
    y = np.zeros(n, dtype=np.float32)
    for k in range(1, nh + 1):
        y += (np.sin(2.0 * np.pi * freq * k * t + phase * k) / k).astype(np.float32)
    return y * (2.0 / np.pi)


def env_ad(n: int, attack: float, decay: float, curve: float = 1.6) -> np.ndarray:
    """Simple attack/decay amplitude envelope."""
    a = max(1, min(int(attack * SR), n))
    e = np.ones(n, dtype=np.float32)
    e[:a] = np.linspace(0.0, 1.0, a, dtype=np.float32)
    rest = n - a
    if rest > 0:
        e[a:] = np.exp(-np.arange(rest, dtype=np.float32) / (SR * max(decay, 1e-4))) ** curve
    return e


def bank_sfx(sound_id: str, dur: float = None, apex: float = None,
             pitch=None, weight: float = None, seed: int = 7) -> np.ndarray:
    """Render a clean sound from earshot.forge.bank."""
    try:
        y, _ = bank.render(sound_id, seed=seed, dur=dur, apex=apex,
                           pitch=pitch, peak_db=-1.5, weight=weight, checks=False)
    except Exception:
        y, _ = bank.render(sound_id, seed=seed, peak_db=-1.5, checks=False)
    return np.asarray(y, dtype=np.float32)


def gate_envelope(n_samples: int, windows) -> np.ndarray:
    """Smooth multiplier envelope ducking/zeroing (t0, t1, level, fade_s) windows."""
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
            ramp = np.linspace(1.0, float(level), i0 - fi0, dtype=np.float32)
            g[fi0:i0] = np.minimum(g[fi0:i0], ramp)
        fo1 = min(n_samples, i1 + nf)
        if fo1 > i1:
            ramp = np.linspace(float(level), 1.0, fo1 - i1, dtype=np.float32)
            g[i1:fo1] = np.minimum(g[i1:fo1], ramp)
    return g[:, None]


def freq_to_pitch(f: float) -> str:
    """Hz -> note name (C4 = 60), so synth lines can drive sampled instruments."""
    return S.name(69.0 + 12.0 * np.log2(max(f, 1.0) / 440.0))


# ---------------------------------------------------------------------------
# The only synthesizers in this cue — both dark, both low-passed, both sparse
# ---------------------------------------------------------------------------

def dark_bass(freq: float, dur: float, vel: float = 0.8, cutoff: float = 1150.0) -> np.ndarray:
    """Cyberpunk low end: saw pair + sine fundamental, light overdrive, low-passed at ~1.1 kHz.

    Deliberately NOT a bright growl lead — it supplies weight and a little harmonic
    edge under the orchestral bass drum, and stays under the strings.
    """
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    t = np.arange(n, dtype=np.float32) / SR
    a = bl_saw(freq, dur, nh_max=20, phase=0.0)
    b = bl_saw(freq * 1.005, dur, nh_max=20, phase=0.4)
    sub = np.sin(2.0 * np.pi * freq * t).astype(np.float32)
    raw = (0.42 * a + 0.34 * b + 0.55 * sub).astype(np.float32)
    raw *= env_ad(n, 0.010, dur * 0.45)
    out = drive_os(raw, 1.9, 0.55)
    return (lp(out, cutoff, 2) * vel * 0.34).astype(np.float32)


def dark_pad(freqs, dur: float, amp: float = 0.13, cutoff: float = 1900.0) -> np.ndarray:
    """Wide, slow analog pad — the cyber colour under the orchestra. Low-passed, no drive wall."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros((0, 2), dtype=np.float32)
    t = np.arange(n, dtype=np.float32) / SR
    att = min(int(0.35 * SR), n // 3)
    rel = min(int(0.45 * SR), n // 3)
    env = np.ones(n, dtype=np.float32)
    if att > 0:
        env[:att] = np.sin(np.linspace(0.0, np.pi / 2.0, att, dtype=np.float32))
    if rel > 0:
        env[-rel:] = np.cos(np.linspace(0.0, np.pi / 2.0, rel, dtype=np.float32))
    left = np.zeros(n, dtype=np.float32)
    right = np.zeros(n, dtype=np.float32)
    for i, f in enumerate(freqs):
        det = 1.0025 if (i % 2 == 0) else 0.9976
        left += (bl_saw(f, dur, nh_max=22) + 0.28 * np.sin(2.0 * np.pi * f * 2.0 * t)).astype(np.float32)
        right += (bl_saw(f * det, dur, nh_max=22) + 0.28 * np.sin(2.0 * np.pi * f * det * 2.0 * t)).astype(np.float32)
    scale = amp / max(1, len(freqs))
    trem_l = (0.90 + 0.10 * np.sin(2.0 * np.pi * 0.23 * t)).astype(np.float32)
    trem_r = (0.90 + 0.10 * np.sin(2.0 * np.pi * 0.29 * t + 1.7)).astype(np.float32)
    st = np.column_stack([left * env * scale * trem_l, right * env * scale * trem_r]).astype(np.float32)
    st = drive_os(st, 1.4, 0.25)
    return lp(st, cutoff)


def riser_tone(f0: float, f1: float, dur: float, vel: float = 0.6, seed: int = 21) -> np.ndarray:
    """Filtered-noise sweep with a rising band-pass centre — tension into a hit."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    rng = np.random.default_rng(seed)
    y = rng.standard_normal(n).astype(np.float32)
    out = np.zeros(n, dtype=np.float32)
    slices = 24
    for i in range(slices):
        i0, i1 = int(n * i / slices), int(n * (i + 1) / slices)
        if i1 <= i0:
            continue
        fc = f0 * (f1 / f0) ** (i / max(1, slices - 1))
        out[i0:i1] = bp(y[i0:i1], fc * 0.55, min(fc * 1.7, SR * 0.47))[: i1 - i0]
    out *= np.linspace(0.0, 1.0, n, dtype=np.float32) ** 1.5
    out *= env_ad(n, 0.02, dur * 0.7)
    return (lp(out, 9000.0) * vel * 0.30).astype(np.float32)


def maglev_pass(dur: float = 1.4, vel: float = 0.5, pan_from: float = -0.9,
                pan_to: float = 0.9, seed: int = 33) -> np.ndarray:
    """Doppler pass-by of a maglev train: band-limited noise with a moving centre."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros((0, 2), dtype=np.float32)
    rng = np.random.default_rng(seed)
    y = rng.standard_normal(n).astype(np.float32)
    out = np.zeros(n, dtype=np.float32)
    slices = 32
    for i in range(slices):
        i0, i1 = int(n * i / slices), int(n * (i + 1) / slices)
        if i1 <= i0:
            continue
        u = i / max(1, slices - 1)
        fc = 1400.0 * np.exp(-((u - 0.5) ** 2) / 0.045) + 320.0
        out[i0:i1] = bp(y[i0:i1], fc * 0.5, min(fc * 2.2, SR * 0.47))[: i1 - i0]
    out *= (np.clip(np.sin(np.linspace(0.0, np.pi, n, dtype=np.float32)), 0.0, None) ** 1.6)
    mono = out * vel * 0.30
    pan = np.linspace(pan_from, pan_to, n, dtype=np.float32)
    theta = (pan + 1.0) * (np.pi / 4.0)
    return np.column_stack([mono * np.cos(theta), mono * np.sin(theta)]).astype(np.float32)



def cyber_pluck_bass(freq: float, dur: float, vel: float = 0.82) -> np.ndarray:
    """Punchy Cyberpunk 2077 / Synthwave 8th-note pluck bass.

    Uses a fast filter envelope (attack cutoff ~1850 Hz decaying to 540 Hz in 60ms)
    so every note has a crisp electronic pluck transient without any steady 2~5 kHz harshness.
    """
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    t = np.arange(n, dtype=np.float32) / SR
    saw1 = bl_saw(freq, dur, nh_max=18, phase=0.0)
    saw2 = bl_saw(freq * 1.006, dur, nh_max=18, phase=0.35)
    sub = np.sin(2.0 * np.pi * freq * t).astype(np.float32)
    raw = drive_os(0.45 * saw1 + 0.35 * saw2 + 0.65 * sub, amount=2.2, drive_mix=0.65)

    # Two-band dynamic filter envelope: transient bite (500~1850 Hz) + warm body (<540 Hz)
    body = lp(raw, 540.0, order=2)
    bite = bp(raw, 540.0, 1850.0, order=2) * np.exp(-t / 0.055).astype(np.float32)
    env = env_ad(n, 0.004, dur * 0.62, curve=1.4)
    return ((body + 0.75 * bite) * env * vel * 0.38).astype(np.float32)


def cyber_lead_voice(freq: float, dur: float, vel: float = 0.72) -> np.ndarray:
    """Warm, stereo-detuned analog cyberpunk lead (low-passed at 2350 Hz, zero ear fatigue)."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros((0, 2), dtype=np.float32)
    t = np.arange(n, dtype=np.float32) / SR
    vib = 1.0 + 0.0035 * np.sin(2.0 * np.pi * 5.8 * t) * np.clip((t - 0.05) / 0.12, 0.0, 1.0)
    ph_c = 2.0 * np.pi * np.cumsum(freq * vib) / SR
    ph_l = 2.0 * np.pi * np.cumsum(freq * 1.0035 * vib) / SR
    ph_r = 2.0 * np.pi * np.cumsum(freq * 0.9965 * vib) / SR
    tri_c = (2.0 / np.pi) * np.arcsin(np.sin(ph_c)).astype(np.float32)
    saw_l = bl_saw(freq * 1.003, dur, nh_max=14, phase=0.1)
    saw_r = bl_saw(freq * 0.997, dur, nh_max=14, phase=0.6)
    env = env_ad(n, 0.010, dur * 0.85, curve=1.3)
    st = np.column_stack([(0.55 * saw_l + 0.45 * tri_c) * env,
                          (0.55 * saw_r + 0.45 * tri_c) * env]).astype(np.float32)
    st = lp(drive_os(st, 1.45, 0.40), 2350.0, order=2)
    return (st * vel * 0.24).astype(np.float32)


def holo_visor_hud_scan(dur: float = 0.22, f0: float = 1480.0, f1: float = 2120.0,
                        vel: float = 0.55, seed: int = 40) -> np.ndarray:
    """Tactical Holo-Visor HUD telemetry scan & target lock-on bleep."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    t = np.arange(n, dtype=np.float32) / SR
    # Rapid 3-step telemetry frequency hop + FM sideband
    f_step = np.where(t < dur * 0.33, f0, np.where(t < dur * 0.66, (f0 + f1) * 0.5, f1)).astype(np.float32)
    mod = np.sin(2.0 * np.pi * 42.0 * t).astype(np.float32)
    ph = 2.0 * np.pi * np.cumsum(f_step * (1.0 + 0.04 * mod)) / SR
    sig = (0.70 * np.sin(ph) + 0.30 * np.sin(ph * 1.5)).astype(np.float32)
    # Gate into crisp digital micro-pulses
    gate = (0.65 + 0.35 * np.sign(np.sin(2.0 * np.pi * 28.0 * t))).astype(np.float32)
    env = env_ad(n, 0.004, dur * 0.72, curve=1.5)
    return (lp(sig * gate * env, 2650.0, order=2) * vel * 0.28).astype(np.float32)


def electric_arc_burst(dur: float = 0.48, vel: float = 0.75, seed: int = 77) -> np.ndarray:
    """High-voltage cyberpunk electric arc / plasma zap (刀锋眼与特斯拉电弧电流声).

    Combines stochastic plasma crackle bursts + FM sawtooth electrical buzz + sub-snap,
    with a gentle notch around 3.2 kHz so it sounds intensely electric without harshness.
    """
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros((0, 2), dtype=np.float32)
    rng = np.random.default_rng(seed)
    t = np.arange(n, dtype=np.float32) / SR

    # 1. FM electrical buzz core (120 Hz + 240 Hz harmonics modulated by jagged plasma LFO)
    jitter = lp(rng.standard_normal(n).astype(np.float32), 65.0) * 8.5
    f_arc = 165.0 + 190.0 * np.sin(2.0 * np.pi * 19.0 * t + jitter)
    ph = 2.0 * np.pi * np.cumsum(np.clip(f_arc, 70.0, 900.0)) / SR
    zap_core = drive_os(np.sin(ph) + 0.55 * np.sin(ph * 2.02) + 0.35 * np.cos(ph * 3.05), 2.6, 0.80)
    zap_core = bp(zap_core, 140.0, 2200.0, order=2)

    # 2. Sparse high-voltage spark snaps (stereo micro-discharges)
    sparks_l = np.zeros(n, dtype=np.float32)
    sparks_r = np.zeros(n, dtype=np.float32)
    n_sparks = max(5, int(dur * 38))
    for _ in range(n_sparks):
        pos = int(rng.integers(0, max(1, n - 960)))
        slen = int(rng.integers(240, min(960, n - pos)))
        st = np.arange(slen, dtype=np.float32) / SR
        f_sp = float(rng.uniform(750.0, 2450.0)) * np.exp(-st * 18.0)
        sp_wave = ( np.sin(2.0 * np.pi * f_sp * st) * 0.65
                  + bp(rng.standard_normal(slen).astype(np.float32), 900.0, 3800.0) * 0.55 )
        sp_wave *= env_ad(slen, 0.0005, slen / SR * 0.45, curve=1.8)
        if rng.random() < 0.5:
            sparks_l[pos:pos + slen] += sp_wave
            sparks_r[pos:pos + slen] += sp_wave * 0.45
        else:
            sparks_r[pos:pos + slen] += sp_wave
            sparks_l[pos:pos + slen] += sp_wave * 0.45

    env = env_ad(n, 0.005, dur * 0.78, curve=1.35)
    left = (zap_core * 0.52 + sparks_l * 0.68) * env
    right = (np.roll(zap_core, 19) * 0.52 + sparks_r * 0.68) * env
    st_out = np.column_stack([left, right]).astype(np.float32)
    st_out = peak_eq(st_out, 3150.0, 1.4, -4.5)  # keep upper-mid smooth
    return (lp(st_out, 4600.0, order=2) * vel * 0.42).astype(np.float32)


def spinner_doppler_flyby(dur: float = 0.95, f_engine: float = 420.0,
                          pan_from: float = 0.92, pan_to: float = -0.92,
                          with_siren: bool = True, vel: float = 0.78, seed: int = 99) -> np.ndarray:
    """Overhead Cyberpunk Spinner Doppler Flyby (头顶飞车高速呼啸掠过音效).

    Combines:
      1. True acoustic Doppler pitch drop across the overhead apex (t = dur * 0.5)
      2. Dual-turbine harmonic roar + optional cyberpunk police spinner siren warble
      3. Sub-bass aerodynamic shockwave thump at the exact overhead pass moment
    """
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros((0, 2), dtype=np.float32)
    rng = np.random.default_rng(seed)
    t = np.arange(n, dtype=np.float32) / SR
    apex = dur * 0.48
    # Smooth acoustic Doppler ratio: approaches at ~1.36x pitch, drops to ~0.64x after passing overhead
    doppler = (1.0 - 0.36 * np.tanh((t - apex) / 0.11)).astype(np.float32)

    # 1. Turbine harmonic engine core
    f_inst = f_engine * doppler
    ph = 2.0 * np.pi * np.cumsum(f_inst) / SR
    turb = (0.55 * np.sin(ph) + 0.35 * np.sin(ph * 1.5) + 0.25 * np.cos(ph * 2.0)).astype(np.float32)
    turb = drive_os(turb, 1.8, 0.55)

    # 2. Optional Cyberpunk Police Siren warble (shifts down with the same Doppler curve!)
    siren = np.zeros(n, dtype=np.float32)
    if with_siren:
        warble = 0.5 + 0.5 * np.sin(2.0 * np.pi * 6.5 * t)
        f_sir = (620.0 + 260.0 * warble) * doppler
        ph_s = 2.0 * np.pi * np.cumsum(f_sir) / SR
        siren = lp((0.65 * np.sin(ph_s) + 0.25 * np.sin(ph_s * 2.0)).astype(np.float32), 2100.0) * 0.32

    # 3. Aerodynamic jet rush + overhead sub-bass air buffet at apex
    jet_noise = maglev_pass(dur=dur, vel=1.0, pan_from=pan_from, pan_to=pan_to, seed=seed)
    bell = np.exp(-((t - apex) ** 2) / (2.0 * (0.19 ** 2))).astype(np.float32)
    sub_thump = np.sin(2.0 * np.pi * (88.0 * doppler) * t).astype(np.float32) * np.exp(-((t - apex) ** 2) / 0.012)

    mono_tonal = (turb * 0.42 + siren + sub_thump * 0.65) * (0.25 + 0.75 * bell) * np.sin(np.linspace(0.0, np.pi, n, dtype=np.float32))
    mono_tonal = lp(mono_tonal, 2500.0, order=2)
    pan = np.linspace(pan_from, pan_to, n, dtype=np.float32)
    theta = (np.clip(pan, -1.0, 1.0) + 1.0) * (np.pi / 4.0)
    st_tonal = np.column_stack([mono_tonal * np.cos(theta), mono_tonal * np.sin(theta)]).astype(np.float32)
    return ((st_tonal + jet_noise * 0.85) * vel * 0.52).astype(np.float32)


def rail_joint_clack(vel: float = 0.78, seed: int = 201) -> np.ndarray:
    """Realistic train bogie crossing a steel rail expansion joint ('哐当-哐当' double clack).

    Two bogie axles hit the joint 56ms apart:
      - Low-frequency steel wheel/chassis thump (92 Hz -> 46 Hz)
      - Mid-range rail joint metallic clack (340~1350 Hz band-passed impulse)
      - Short bogie suspension spring resonance (235 Hz & 520 Hz)
    """
    dur = 0.22
    n = int(round(dur * SR))
    rng = np.random.default_rng(seed)
    out = np.zeros((n, 2), dtype=np.float32)

    for axle_i, (t_off, a_gain, pan_a) in enumerate([(0.000, 1.00, -0.18), (0.056, 0.84, 0.18)]):
        i0 = int(round(t_off * SR))
        slen = n - i0
        if slen <= 0:
            continue
        t = np.arange(slen, dtype=np.float32) / SR
        # 1. Heavy wheel-on-rail low thud
        f_thud = 94.0 * np.exp(-t * 26.0) + 46.0
        thud = np.sin(2.0 * np.pi * np.cumsum(f_thud) / SR).astype(np.float32) * env_ad(slen, 0.001, 0.038, curve=1.6)
        # 2. Steel joint clack transient
        noise = rng.standard_normal(slen).astype(np.float32)
        clack = bp(noise, 340.0, 1450.0, order=2) * env_ad(slen, 0.0006, 0.016, curve=1.9)
        # 3. Chassis & bogie spring metallic ring
        ring = (0.60 * np.sin(2.0 * np.pi * 238.0 * t) +
                0.40 * np.sin(2.0 * np.pi * 535.0 * t)).astype(np.float32) * env_ad(slen, 0.002, 0.055, curve=1.5)
        hit_mono = (thud * 0.68 + clack * 0.62 + ring * 0.28) * a_gain * vel * 0.36
        out[i0:] += pan_mono(hit_mono, pan_a)
    return out


def gantry_whoosh(dur: float = 0.46, vel: float = 0.76, pan_from: float = -0.85,
                  pan_to: float = 0.85, seed: int = 202) -> np.ndarray:
    """High-speed train passing under a steel skybridge/gantry ('呼——' low-mid wind slap)."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros((0, 2), dtype=np.float32)
    rng = np.random.default_rng(seed)
    t = np.arange(n, dtype=np.float32) / SR
    apex = dur * 0.46
    bell = np.exp(-((t - apex) ** 2) / (2.0 * (0.11 ** 2))).astype(np.float32)
    doppler = (1.0 - 0.34 * np.tanh((t - apex) / 0.08)).astype(np.float32)
    noise = rng.standard_normal(n).astype(np.float32)
    whoosh_lo = bp(noise, 85.0, 520.0, order=2) * bell
    whoosh_mid = bp(noise, 320.0, 1250.0, order=2) * (bell ** 1.4) * 0.55
    air_punch = np.sin(2.0 * np.pi * (74.0 * doppler) * t).astype(np.float32) * (bell ** 1.8) * 0.50
    mono = (whoosh_lo + whoosh_mid + air_punch) * vel * 0.38
    pan = np.linspace(pan_from, pan_to, n, dtype=np.float32)
    theta = (np.clip(pan, -1.0, 1.0) + 1.0) * (np.pi / 4.0)
    return np.column_stack([mono * np.cos(theta), mono * np.sin(theta)]).astype(np.float32)


def rail_brake_skid(dur: float = 0.42, vel: float = 0.85, seed: int = 205) -> np.ndarray:
    """Hard skid-brake friction + magnetic eddy-brake screech on train roof at 9.92s."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros((0, 2), dtype=np.float32)
    rng = np.random.default_rng(seed)
    t = np.arange(n, dtype=np.float32) / SR
    # Downward-sliding metallic friction + filtered noise scrape
    f_skid = 920.0 * np.exp(-t * 3.8) + 240.0
    ph = 2.0 * np.pi * np.cumsum(f_skid) / SR
    scrape_tone = (0.60 * np.sin(ph) + 0.40 * np.sin(ph * 1.48)).astype(np.float32)
    scrape_noise = bp(rng.standard_normal(n).astype(np.float32), 450.0, 2400.0, order=2)
    env = env_ad(n, 0.005, dur * 0.68, curve=1.4)
    mono = lp(drive_os((scrape_tone * 0.45 + scrape_noise * 0.65) * env, 1.8, 0.6), 2450.0) * vel * 0.38
    return pan_mono(mono, 0.05)


def singularity_implosion_drone(dur: float = 0.85, vel: float = 0.90) -> np.ndarray:
    """18.45s ~ 19.30s: 3D wireframe world collapsing inward into a single point.

    Stereo width narrows from 100% wide down to 0% dead-centre mono while pitch and
    resonant filter converge upward into the singularity freeze at 19.30s.
    """
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros((0, 2), dtype=np.float32)
    t = np.arange(n, dtype=np.float32) / SR
    u = t / max(dur, 1e-4)
    # Converging pitch glide: A2 (110 Hz) -> D3 (146.83 Hz) locked into the singularity
    f_glide = 110.0 * (146.83 / 110.0) ** (u ** 1.65)
    ph_l = 2.0 * np.pi * np.cumsum(f_glide * (1.0 + 0.010 * (1.0 - u))) / SR
    ph_r = 2.0 * np.pi * np.cumsum(f_glide * (1.0 - 0.010 * (1.0 - u))) / SR
    ph_sub = 2.0 * np.pi * np.cumsum(f_glide * 0.5) / SR

    core_l = np.sin(ph_l) + 0.55 * np.sin(ph_l * 2.0) + 0.35 * np.cos(ph_l * 3.0)
    core_r = np.sin(ph_r) + 0.55 * np.sin(ph_r * 2.0) + 0.35 * np.cos(ph_r * 3.0)
    sub = np.sin(ph_sub) * 0.75

    # Reverse-vacuum whoosh texture being sucked inward
    rng = np.random.default_rng(1845)
    vac = bp(rng.standard_normal(n).astype(np.float32), 240.0, 2600.0, order=2) * (u ** 1.5) * 0.45

    raw_l = drive_os((core_l * 0.55 + sub + vac).astype(np.float32), 2.1, 0.65)
    raw_r = drive_os((core_r * 0.55 + sub + np.roll(vac, 37)).astype(np.float32), 2.1, 0.65)

    # Collapse stereo width from wide (1.0) to pure mono (0.0) as the world shrinks to a dot
    mid = 0.5 * (raw_l + raw_r)
    side = 0.5 * (raw_l - raw_r) * ((1.0 - u) ** 1.8)
    env = (0.38 + 0.62 * (u ** 1.25)) * env_ad(n, 0.02, dur * 0.15, curve=1.2)
    # Cut off cleanly right at the end (19.30s freeze)
    cut_tail = min(int(0.012 * SR), n // 4)
    if cut_tail > 0:
        env[-cut_tail:] *= np.linspace(1.0, 0.0, cut_tail, dtype=np.float32)

    st = np.column_stack([(mid + side) * env, (mid - side) * env]).astype(np.float32)
    return (lp(st, 2850.0, order=2) * vel * 0.38).astype(np.float32)


def climax_mono_pitch_drone(dur: float = 1.16, vel: float = 0.96) -> np.ndarray:
    """19.52s ~ 20.68s: Zero-pitch-shift sustained climax roar ('持续的高潮嗡') for 2D B&W charge,
    with an inward dimensional-barrier implosion filter & stereo convergence during 20.46~20.68s!

    Strictly locked to pure D power harmonics (D1=36.71, D2=73.42, A2=110.0, D3=146.83,
    A3=220.0, D4=293.66 Hz) — ZERO pitch bends, ZERO melody changes, pure unstoppable momentum.
    """
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros((0, 2), dtype=np.float32)
    t = np.arange(n, dtype=np.float32) / SR

    # Unwavering harmonic stack in D (zero pitch modulation)
    freqs = [
        (36.71, 0.48),   # D1 sub anchor
        (73.42, 1.00),   # D2 fundamental bass roar
        (110.00, 0.72),  # A2 fifth power lock
        (146.83, 0.85),  # D3 octave body
        (220.00, 0.54),  # A3 upper fifth
        (293.66, 0.60),  # D4 heroic top anchor
    ]
    left = np.zeros(n, dtype=np.float32)
    right = np.zeros(n, dtype=np.float32)
    for idx_f, (f, w) in enumerate(freqs):
        if idx_f < 2:
            # Sub & bass locked phase
            s_c = bl_saw(f, dur, nh_max=18, phase=0.0) + 0.65 * np.sin(2.0 * np.pi * f * t).astype(np.float32)
            left += s_c * w
            right += s_c * w
        else:
            # Constant ultra-tight stereo chorus (+/- 0.18% fixed detune, no LFO pitch wobble)
            s_l = bl_saw(f * 1.0018, dur, nh_max=16, phase=0.12 * idx_f)
            s_r = bl_saw(f * 0.9982, dur, nh_max=16, phase=0.47 * idx_f)
            left += s_l * w
            right += s_r * w

    st = np.column_stack([left, right]).astype(np.float32) / 3.6
    st = drive_os(st, amount=2.35, drive_mix=0.72)

    # Split into warm low-mid body (<520 Hz) and upper harmonic roar (520~2750 Hz)
    lo_body = lp(st, 520.0, order=2)
    hi_roar = bp(st, 520.0, 2750.0, order=2)

    # 0.00 ~ 0.94s (19.52 ~ 20.46s): Full sustained climax wall-of-momentum
    # 0.94 ~ 1.16s (20.46 ~ 20.68s): Rapid inward filter & stereo convergence ('音乐收束')
    conv_t = np.clip((t - 0.92) / max(dur - 0.92, 1e-4), 0.0, 1.0).astype(np.float32)
    hi_env = (1.0 - 0.88 * (conv_t ** 1.4)).astype(np.float32)
    lo_env = (1.0 - 0.45 * (conv_t ** 2.2)).astype(np.float32)

    combined = lo_body * lo_env[:, None] + hi_roar * hi_env[:, None]

    # Stereo width narrows into the center portal point during 20.46~20.68s
    width = (1.0 - 0.85 * (conv_t ** 1.5)).astype(np.float32)
    mid = 0.5 * (combined[:, 0] + combined[:, 1])
    side = 0.5 * (combined[:, 0] - combined[:, 1]) * width

    # Crisp 5ms attack at 19.52s and clean 15ms release right into 20.68s cross-world resolve
    amp_env = np.ones(n, dtype=np.float32)
    n_att = min(int(0.005 * SR), n // 4)
    n_rel = min(int(0.018 * SR), n // 4)
    if n_att > 0:
        amp_env[:n_att] = np.linspace(0.0, 1.0, n_att, dtype=np.float32)
    if n_rel > 0:
        amp_env[-n_rel:] = np.linspace(1.0, 0.0, n_rel, dtype=np.float32)

    out = np.column_stack([(mid + side) * amp_env, (mid - side) * amp_env]).astype(np.float32)
    return (out * vel * 0.46).astype(np.float32)


def xiao_plunge_breath(dur: float = 0.86, vel: float = 0.72, seed: int = 2312) -> np.ndarray:
    """23.12s ~ 23.98s: Organic bamboo-flute (Xiao) downward breath glide + paper wind
    as Slime falls vertically out of the white ink-wash space into World 04's bamboo grove.
    Replaces the artificial sine-wave whistle with authentic ink-wash timbre.
    """
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros((0, 2), dtype=np.float32)
    rng = np.random.default_rng(seed)
    t = np.arange(n, dtype=np.float32) / SR
    u = t / max(dur, 1e-4)

    # Smooth downward pentatonic pitch glide from A5 (880 Hz) -> D4 (293.66 Hz) with natural Xiao overtones
    f_glide = 880.0 * ((293.66 / 880.0) ** (u ** 1.15))
    vib = 1.0 + 0.006 * np.sin(2.0 * np.pi * 5.2 * t)
    ph = 2.0 * np.pi * np.cumsum(f_glide * vib) / SR

    # Warm woody flute harmonic profile (fundamental + soft 2nd & 3rd harmonics, low-passed)
    flute_body = (0.72 * np.sin(ph) + 0.22 * np.sin(ph * 2.0) + 0.08 * np.cos(ph * 3.0)).astype(np.float32)
    flute_body = lp(flute_body, 2100.0, order=2)

    # Bamboo embouchure air & silk-scroll falling breeze
    air_hi = bp(rng.standard_normal(n).astype(np.float32), 680.0, 2200.0, order=2) * 0.34
    air_lo = bp(rng.standard_normal(n).astype(np.float32), 180.0, 680.0, order=2) * 0.38

    env = np.sin(np.pi * u) ** 0.85 * np.exp(-u * 0.95)
    mono = (flute_body * 0.38 + air_hi + air_lo) * env * vel * 0.42
    return pan_mono(mono, -0.06)
def rain_bed(n: int, vel: float = 1.0, seed: int = 55) -> np.ndarray:
    """Neon night rain: 1.5~11 kHz noise with slow gust modulation + sparse droplet ticks."""
    rng = np.random.default_rng(seed)
    raw = rng.standard_normal(n).astype(np.float32)
    body = bp(raw, 1500.0, 11000.0)
    t = np.arange(n, dtype=np.float32) / SR
    gust = (0.62 + 0.38 * (0.5 + 0.5 * np.sin(2.0 * np.pi * 0.17 * t))
            * (0.6 + 0.4 * np.sin(2.0 * np.pi * 0.43 * t + 1.1))).astype(np.float32)
    body = body * gust
    drops = np.zeros(n, dtype=np.float32)
    for _ in range(int(n / SR * 34)):
        pos = int(rng.integers(0, max(1, n - 2400)))
        d = rng.standard_normal(2400).astype(np.float32) * env_ad(2400, 0.0002, 0.004)
        drops[pos:pos + 2400] += hp(d, 2600.0) * (0.35 + 0.65 * rng.random())
    return ((body * 0.030 + drops * 0.020) * vel).astype(np.float32)


def neon_buzz(n: int, vel: float = 1.0, seed: int = 66) -> np.ndarray:
    """Neon-tube hum: 100 Hz mains + odd harmonics + a faint gas buzz + crackle."""
    rng = np.random.default_rng(seed)
    t = np.arange(n, dtype=np.float32) / SR
    hum = (np.sin(2.0 * np.pi * 100.0 * t) * 0.50 +
           np.sin(2.0 * np.pi * 300.0 * t) * 0.22 +
           np.sin(2.0 * np.pi * 500.0 * t) * 0.12).astype(np.float32)
    am = (0.80 + 0.20 * np.sin(2.0 * np.pi * 7.3 * t)).astype(np.float32)
    buzz = (np.sin(2.0 * np.pi * 2900.0 * t) * 0.022 +
            np.sin(2.0 * np.pi * 4150.0 * t) * 0.012).astype(np.float32)
    buzz *= (0.6 + 0.4 * np.sin(2.0 * np.pi * 11.0 * t + 0.4)).astype(np.float32)
    crackle = np.zeros(n, dtype=np.float32)
    for _ in range(int(n / SR * 4)):
        pos = int(rng.integers(0, max(1, n - 1200)))
        crackle[pos:pos + 1200] += hp(rng.standard_normal(1200).astype(np.float32)
                                      * env_ad(1200, 0.0002, 0.003), 3200.0) * 0.5
    return ((hum * am * 0.016 + buzz * 0.8 + crackle * 0.035) * vel).astype(np.float32)


# ---------------------------------------------------------------------------
# 1. Music Stem — orchestral + restrained cyber colour, dynamic follows the picture
# ---------------------------------------------------------------------------

def build_music_stem() -> np.ndarray:
    S.seed(11)
    music = np.zeros((N_SAMPLES, 2), dtype=np.float32)
    orch = np.zeros((N_SAMPLES, 2), dtype=np.float32)   # real sampled orchestra / percussion
    synth = np.zeros((N_SAMPLES, 2), dtype=np.float32)  # dark synth colour only

    # ================= ACT A (0.00 ~ 2.40s): hyperspace tail + 76m dive =================
    add_at(synth, dark_pad([73.42, 110.00, 146.83], 2.6, amp=0.13, cutoff=1500.0), 0.00)
    add_at(orch, S.note('cellos', 'D2', 2.3, vel=0.50, attack=0.45), 0.10, gain=0.26, pan=-0.20)
    add_at(orch, S.note('contrabass', 'D2', 2.3, vel=0.46, attack=0.50), 0.10, gain=0.22, pan=0.16)
    add_at(orch, S.note('violins_trem', 'D4', 1.45, vel=0.32, attack=0.60), 0.95, gain=0.16, pan=0.25)
    add_at(synth, dark_bass(55.00, 1.90, vel=0.50, cutoff=900.0), 0.50)
    add_at(orch, S.hit('sus_cymbal', 'cresc', vel=0.34, dur=1.5), 0.85, gain=0.14, pan=0.22)

    # ================= ACT B (2.40 ~ 5.60s): SLAM + 180° orbit reveal =================
    # 3.95s is the act's visual peak (measured 0.84) — the theme states here, not earlier.
    add_at(orch, S.hit('gran_cassa', 'hit', vel=0.88, dur=1.5), 2.40, gain=0.34)
    add_at(orch, S.hit('timpani', 1, vel=0.80, dur=1.3), 2.40, gain=0.26)
    add_at(synth, dark_pad([73.42, 146.83, 220.00], 3.1, amp=0.15, cutoff=1700.0), 2.45)
    add_at(orch, S.note('cellos', 'D2', 3.0, vel=0.54, attack=0.30), 2.55, gain=0.26, pan=-0.20)
    add_at(orch, S.note('contrabass', 'B1', 3.0, vel=0.44, attack=0.35), 2.55, gain=0.18, pan=0.18)
    add_at(orch, S.note('vibraphone_bowed', 'A4', 2.7, vel=0.44, attack=0.40), 3.30, gain=0.22, pan=0.25)
    # The reveal: strings swell + timpani roll + cymbal into the star tease
    add_at(orch, S.note('violins', 'D4', 2.2, vel=0.42, attack=0.75), 3.15, gain=0.20, pan=0.20)
    add_at(orch, S.note('violas', 'F4', 2.1, vel=0.38, attack=0.80), 3.20, gain=0.18, pan=-0.22)
    add_at(orch, S.note('horn', 'A4', 2.0, vel=0.48, attack=0.35), 3.35, gain=0.22, pan=0.10)
    add_at(orch, S.hit('gran_cassa', 'roll', vel=0.44, dur=0.9), 3.20, gain=0.16)
    add_at(orch, S.hit('crash', vel=0.44, dur=1.2), 3.92, gain=0.16, pan=0.24)
    for t_n, pitch, vel, pan in [
        (3.35, 'D4', 0.54, -0.25), (3.85, 'A4', 0.52, 0.20), (4.30, 'C5', 0.55, -0.15),
        (4.75, 'D5', 0.60, 0.25), (5.15, 'F5', 0.62, -0.20),
    ]:
        add_at(orch, S.note('harp', pitch, 1.1, vel=vel), t_n, gain=0.26, pan=pan)
        add_at(orch, S.note('marimba', pitch, 0.8, vel=vel * 0.72), t_n + 0.01, gain=0.16, pan=-pan)
    # Driving 8th-note cyber pluck bass under the orbit reveal & holo-visor scan (3.20 ~ 5.55s)
    for idx_p, t_p in enumerate(np.arange(3.20, 5.55, 0.24)):
        p_root = 'D2' if idx_p < 6 else ('F2' if idx_p < 8 else 'A2')
        add_at(synth, cyber_pluck_bass(S.hz(p_root), 0.22, vel=0.58 + 0.02 * idx_p), float(t_p), gain=0.82)

    # ================= ACT C (5.60 ~ 7.00s): Cold-Blooded Blade-Eye Awakening ============
    # Stripped of cluttered snare rolls/melody: taut low capacitor drone during the 5.88s
    # blade-eye freeze, followed by a tight 3-pulse pickup in the final 0.32s (6.68~6.92s)
    add_at(synth, dark_pad([73.42, 110.00, 146.83], 1.40, amp=0.11, cutoff=980.0), 5.60)
    add_at(synth, dark_bass(55.00, 1.35, vel=0.52, cutoff=720.0), 5.62)
    add_at(orch, S.note('cellos', 'D2', 1.35, vel=0.40, attack=0.30), 5.64, gain=0.20, pan=-0.20)
    add_at(synth, riser_tone(220.0, 2400.0, 0.45, vel=0.58, seed=23), 6.52)
    for b_i, (t_b, p_b) in enumerate([(6.68, 'D2'), (6.80, 'F2'), (6.91, 'A2')]):
        v_b = 0.56 + 0.12 * b_i
        add_at(orch, S.hit('snare2', 'stick', vel=v_b, dur=0.14), t_b, gain=0.24, pan=(-0.15 if b_i % 2 == 0 else 0.15))
        add_at(synth, cyber_pluck_bass(S.hz(p_b), 0.12, vel=v_b), t_b, gain=0.72)
    # ================= ACT D (7.00 ~ 14.70s): High-Octane Cyberpunk Parkour Groove ==========
    # ================= ACT D (7.00 ~ 14.70s): High-Octane Parkour + 9.92~10.68s Brake Pause ==
    add_at(synth, dark_pad([73.42, 146.83, 220.00, 293.66], 1.6, amp=0.15, cutoff=1850.0), 7.02)
    add_at(synth, dark_pad([58.27, 116.54, 174.61, 233.08], 1.28, amp=0.15, cutoff=1800.0), 8.62)
    # 9.92 ~ 10.68s: Music cuts out for the Red-X Laser Wall hard brake ([?] -> [!])!
    # At 10.68s: Explosive re-entry on Fmaj7 / C / G for the 3-step Wall-Run!
    add_at(synth, dark_pad([87.31, 174.61, 261.63, 349.23], 1.15, amp=0.17, cutoff=2050.0), 10.68)
    add_at(synth, dark_pad([65.41, 130.81, 196.00, 261.63], 1.6, amp=0.16, cutoff=1900.0), 11.82)
    add_at(synth, dark_pad([98.00, 146.83, 196.00, 293.66], 1.3, amp=0.16, cutoff=1900.0), 13.42)

    # Bass: sustained low-end anchors (pauses during 9.92~10.68s brake window!)
    for t_b, dur_b, pitch, vel in [
        (7.02, 1.50, 'D2', 0.68),
        (8.62, 1.25, 'Bb1', 0.68),
        (10.68, 1.12, 'F2', 0.76),
        (11.82, 1.50, 'C2', 0.72),
        (13.42, 1.25, 'G2', 0.70),
    ]:
        add_at(synth, dark_bass(S.hz(pitch), dur_b, vel=vel), t_b, gain=0.80)
        add_at(orch, S.note('contrabass', pitch, dur_b * 0.96, vel=0.50, attack=0.05), t_b, gain=0.22, pan=0.18)
        add_at(orch, S.note('cellos', S.name(S.midi(pitch) + 12), dur_b * 0.96, vel=0.50, attack=0.06),
               t_b, gain=0.22, pan=-0.20)

    # 8th-note Cyber Pluck Bass + Kick/Snare/HiHat groove (with hard stop during 9.90~10.66s!)
    for idx_g, t_o in enumerate(np.arange(7.00, 14.60, 0.20)):
        if 9.90 <= t_o < 10.66:
            continue
        root = 73.42
        for t0, t1, f in [(7.00, 8.62, 73.42), (8.62, 9.90, 58.27), (10.66, 11.82, 87.31),
                          (11.82, 13.42, 65.41), (13.42, 14.70, 98.00)]:
            if t0 <= t_o < t1:
                root = f
                break
        b_mult = 1.0 if (idx_g % 2 == 0) else (2.0 if idx_g % 4 == 1 else 1.5)
        add_at(synth, cyber_pluck_bass(root * b_mult, 0.18, vel=0.80 if idx_g % 2 == 0 else 0.64),
               float(t_o), gain=0.90, pan=(-0.10 if idx_g % 2 == 0 else 0.10))
        if idx_g % 4 == 0:
            add_at(orch, S.hit('drum_kit', 'kick', vel=0.86, dur=0.28), float(t_o), gain=0.38)
        elif idx_g % 4 == 2:
            add_at(orch, S.hit('drum_kit', 'snare', vel=0.78, dur=0.24), float(t_o), gain=0.32)
        add_at(orch, lp(S.hit('hihat', 'closed', vel=0.46 if idx_g % 2 == 0 else 0.35, dur=0.07), 5500.0),
               float(t_o), gain=0.14, pan=(0.20 if idx_g % 2 == 0 else -0.20))
        if idx_g % 2 == 0:
            add_at(orch, S.note('cellos_spic', freq_to_pitch(root * 2.0), 0.22,
                                vel=0.45 if idx_g % 4 == 0 else 0.32), float(t_o), gain=0.16,
                   pan=(-0.22 if idx_g % 4 == 0 else 0.22))

    # 10.46 ~ 10.66s: Tight 3-hit drum & bass pickup fill after [!] right into 10.68s wall-launch!
    for f_i, (t_fill, p_fill) in enumerate([(10.46, 'C2'), (10.54, 'D2'), (10.61, 'E2')]):
        add_at(orch, S.hit('drum_kit', 'snare', vel=0.68 + 0.10 * f_i, dur=0.18), t_fill, gain=0.32)
        add_at(orch, S.hit('toms', 'high_mallet', vel=0.70 + 0.08 * f_i, dur=0.22), t_fill, gain=0.24, pan=-0.2 + 0.2 * f_i)
        add_at(synth, cyber_pluck_bass(S.hz(p_fill), 0.12, vel=0.78), t_fill, gain=0.85)

    # Contact-frame percussion aligned with new 9.92s brake & 10.68s wall-launch
    landings = [(7.00, 'launch'), (8.15, 'land'), (8.80, 'stomp'), (9.45, 'land'),
                (9.92, 'brake'), (10.68, 'launch'), (11.08, 'pad'), (11.88, 'pad'),
                (12.68, 'pad'), (13.68, 'koi'), (14.70, 'head')]
    for t_l, kind in landings:
        if kind in ('launch', 'head'):
            add_at(orch, S.hit('gran_cassa', 'hit', vel=0.88, dur=1.2), t_l, gain=0.32)
            add_at(orch, S.hit('timpani', 2, vel=0.76, dur=1.0), t_l, gain=0.24)
            add_at(synth, dark_bass(55.00, 0.9, vel=0.72, cutoff=1050.0), t_l, gain=0.92)
        elif kind == 'brake':
            add_at(orch, S.hit('gran_cassa', 'hit', vel=0.84, dur=0.6), t_l, gain=0.30)
            add_at(orch, S.hit('snare2', 'on', vel=0.82, dur=0.25), t_l, gain=0.28)
        elif kind == 'stomp':
            add_at(orch, S.hit('gran_cassa', 'hit', vel=0.82, dur=1.0), t_l, gain=0.28)
            add_at(orch, S.hit('toms', 'low_mallet', vel=0.72, dur=0.5), t_l, gain=0.22)
            add_at(orch, S.hit('cowbell', vel=0.40, dur=0.3), t_l + 0.02, gain=0.12, pan=0.2)
        elif kind == 'koi':
            add_at(orch, S.hit('gran_cassa', 'hit', vel=0.52, dur=1.4), t_l, gain=0.20)
            add_at(orch, S.note('tubular_bells', 'D5', 1.6, vel=0.62), t_l + 0.02, gain=0.22, pan=-0.18)
        else:
            add_at(orch, S.hit('toms', 'low_mallet', vel=0.64, dur=0.45), t_l, gain=0.20)
            add_at(orch, S.hit('log_drum', 'lo', vel=0.44, dur=0.20), t_l, gain=0.12, pan=0.24)
            add_at(orch, S.hit('timpani', 3, vel=0.48, dur=0.8), t_l, gain=0.15)

    # The wall-run peak (10.68~12.68s) brass + cymbal + rising strings statement
    add_at(orch, S.hit('sus_cymbal', 'cresc', vel=0.52, dur=1.2), 10.62, gain=0.18, pan=-0.24)
    add_at(orch, S.note('horn', 'F4', 1.3, vel=0.64, attack=0.08), 10.68, gain=0.26, pan=0.16)
    add_at(orch, S.note('trombone', 'F3', 1.3, vel=0.56, attack=0.10), 10.68, gain=0.22, pan=-0.16)
    add_at(orch, S.note('violins', 'F5', 1.3, vel=0.52, attack=0.08), 10.70, gain=0.22, pan=0.22)
    add_at(orch, S.hit('gong', vel=0.44, dur=2.4), 11.08, gain=0.15, pan=0.24)
    add_at(orch, S.note('horn', 'A4', 1.4, vel=0.64, attack=0.10), 11.88, gain=0.26, pan=0.16)
    add_at(orch, S.note('violins', 'A5', 1.4, vel=0.50, attack=0.10), 11.92, gain=0.22, pan=-0.22)

    # Heroic motif (pauses cleanly during 9.92~10.68s brake window, then resumes on F4 -> A4 -> C5 -> D5!)
    motif = [
        (7.02, 'D4', 0.38), (7.42, 'F4', 0.35), (7.82, 'A4', 0.42), (8.22, 'C5', 0.45),
        (8.62, 'D5', 0.48), (9.02, 'C5', 0.38), (9.42, 'A4', 0.42),
        (10.68, 'F4', 0.36), (11.08, 'A4', 0.38), (11.48, 'C5', 0.38),
        (11.88, 'E5', 0.44), (12.28, 'G5', 0.40), (12.68, 'E5', 0.42), (13.08, 'C5', 0.44),
        (13.48, 'D5', 0.44), (13.86, 'F5', 0.46), (14.24, 'A5', 0.52),
    ]
    for t_m, p_m, d_m in motif:
        add_at(orch, S.note('vibraphone', p_m, d_m * 1.4, vel=0.66), t_m, gain=0.22, pan=0.18)
        add_at(orch, S.note('marimba', p_m, d_m, vel=0.62), t_m, gain=0.18, pan=-0.18)
        add_at(synth, cyber_lead_voice(S.hz(p_m), d_m * 1.05, vel=0.74), t_m, gain=0.85)
        add_at(orch, lp(S.note('electric_guitar', p_m, d_m * 0.95, vel=0.58), 2400.0), t_m, gain=0.15, pan=0.12)
    add_at(orch, P.strum('harp', ['D4', 'F4', 'A4', 'C5', 'D5', 'F5'], 1.5, vel=0.78, spread=0.035),
           13.68, gain=0.30, pan=0.15)
    add_at(orch, S.note('dan_tranh', 'A5', 1.3, vel=0.68), 14.00, gain=0.24, pan=-0.20)
    add_at(orch, S.note('hand_chimes', 'D6', 1.5, vel=0.60), 14.05, gain=0.20, pan=0.20)
    add_at(synth, riser_tone(320.0, 3400.0, 1.00, vel=0.48, seed=27), 13.70)

    # ================= ACT E (14.70 ~ 15.32s): land on Car #0 -> EAT THE STAR =========
    add_at(synth, dark_pad([87.31, 174.61, 261.63, 349.23], 1.05, amp=0.15, cutoff=1900.0), 14.70)
    add_at(orch, S.note('horn', 'F4', 0.95, vel=0.60, attack=0.08), 14.70, gain=0.24, pan=0.20)
    add_at(orch, S.note('cellos', 'F2', 0.95, vel=0.52, attack=0.08), 14.70, gain=0.22, pan=-0.20)
    add_at(synth, dark_bass(S.hz('F2'), 0.90, vel=0.66), 14.70, gain=0.85)
    # 15.32 STAR ABSORBED — golden bloom, bright but brief; the picture goes quiet right after.
    add_at(synth, dark_pad([87.31, 174.61, 261.63, 440.00], 0.52, amp=0.15, cutoff=2200.0), 15.32)
    add_at(orch, P.strum('harp', ['D4', 'A4', 'D5', 'F#5', 'A5', 'D6'], 0.62, vel=0.80, spread=0.025),
           15.32, gain=0.28)
    add_at(orch, S.note('hand_chimes', 'D6', 0.58, vel=0.68), 15.35, gain=0.20, pan=-0.22)

    # ================= ACT F (15.70 ~ 17.50s): Building Threat -> Cute Blink -> Brace ====
    # Shot 2 (15.70~16.55s): Camera cuts to the solid Red-X sealed skyscraper ahead -> dark ominous low brass/drone
    add_at(synth, dark_pad([58.27, 116.54], 0.82, amp=0.12, cutoff=780.0), 15.70)
    add_at(synth, dark_bass(58.27, 0.78, vel=0.54, cutoff=680.0), 15.70)
    add_at(orch, S.note('trombone', 'Bb1', 0.78, vel=0.48, attack=0.06), 15.72, gain=0.20, pan=-0.16)
    add_at(orch, S.hit('gran_cassa', 'hit', vel=0.52, dur=0.70), 15.70, gain=0.20)
    # Shot 3A (16.55~17.06s): Frontal close-up & cute double-blink (16.78~17.06s) -> COMPLETE MUSICAL SILENCE!
    # Shot 3B (17.06~17.50s): Eyes snap to Blade-Eyes at 17.06s -> sudden electric charge & riser into 17.50s!
    add_at(synth, dark_pad([73.42, 146.83, 220.00], 0.44, amp=0.14, cutoff=1450.0), 17.06)
    add_at(synth, dark_bass(73.42, 0.42, vel=0.68, cutoff=950.0), 17.06)
    add_at(synth, riser_tone(280.0, 3800.0, 0.44, vel=0.64, seed=29), 17.06)
    add_at(orch, S.note('violins_trem', 'D4', 0.42, vel=0.48, attack=0.06), 17.06, gain=0.20, pan=0.20)
    add_at(orch, S.hit('snare2', 'on', vel=0.72, dur=0.20), 17.36, gain=0.26)

    # ================= ACT G (17.50 ~ 19.30s): Overdrive Burst -> 18.45s Wireframe Implosion
    # Phase G1 (17.50 ~ 18.45s): Full-throttle star-overdrive charge (Dm -> F)
    add_at(orch, S.hit('gran_cassa', 'hit', vel=0.94, dur=1.4), 17.50, gain=0.38)
    add_at(orch, S.hit('gong', vel=0.56, dur=2.2), 17.50, gain=0.20, pan=0.22)
    add_at(orch, S.hit('timpani', 1, vel=0.86, dur=1.2), 17.50, gain=0.28)

    for t_st, d_st, st_freqs, b_note, h_note, v_note, cut_f in [
        (17.50, 0.48, [73.42, 146.83, 220.00, 293.66], 'D2', 'D5', 'F5', 2100.0),
        (17.98, 0.47, [87.31, 174.61, 261.63, 349.23], 'F2', 'F5', 'A5', 2400.0),
    ]:
        add_at(synth, dark_pad(st_freqs, d_st * 1.02, amp=0.17, cutoff=cut_f), t_st)
        add_at(synth, dark_bass(S.hz(b_note), d_st, vel=0.82, cutoff=1350.0), t_st, gain=0.92)
        add_at(orch, S.note('horn', h_note, d_st, vel=0.72, attack=0.04), t_st, gain=0.28, pan=0.20)
        add_at(orch, S.note('trombone', b_note, d_st, vel=0.66, attack=0.05), t_st, gain=0.24, pan=-0.20)
        add_at(orch, S.note('violins', v_note, d_st, vel=0.64, attack=0.05), t_st, gain=0.24, pan=0.24)
        add_at(synth, cyber_lead_voice(S.hz(h_note), d_st * 0.95, vel=0.84), t_st, gain=0.88)

    # Driving pulse during 17.50 ~ 18.42s ONLY (stops cleanly at 18.45s when wireframe collapse begins!)
    for step_r, t_roll in enumerate(np.arange(17.50, 18.42, 0.15)):
        r_freq = 73.42 if t_roll < 17.98 else 87.31
        add_at(synth, cyber_pluck_bass(r_freq * (2.0 if step_r % 2 == 1 else 1.0), 0.13, vel=0.82),
               float(t_roll), gain=0.88)
        if step_r % 2 == 0:
            add_at(orch, S.hit('drum_kit', 'kick', vel=0.86, dur=0.22), float(t_roll), gain=0.36)
        else:
            add_at(orch, S.hit('drum_kit', 'snare', vel=0.78, dur=0.18), float(t_roll), gain=0.30)

    # Phase G2 (18.45 ~ 19.30s): 3D World strips to B&W Wireframe & collapses into a single point!
    # No drum kit beats — pure inward-converging orchestral & analog implosion into the 19.30s singularity!
    add_at(synth, singularity_implosion_drone(dur=0.85, vel=0.95), 18.45, gain=1.00)
    add_at(orch, S.note('violins_trem', 'A5', 0.84, vel=0.72, attack=0.18), 18.45, gain=0.26, pan=0.0)
    add_at(orch, S.note('horn', 'A4', 0.84, vel=0.76, attack=0.15), 18.45, gain=0.28, pan=0.0)
    add_at(orch, S.note('cellos', 'A2', 0.84, vel=0.74, attack=0.12), 18.45, gain=0.26, pan=0.0)
    add_at(orch, S.hit('sus_cymbal', 'cresc', vel=0.82, dur=0.85), 18.45, gain=0.26, pan=0.0)
    add_at(orch, S.hit('gran_cassa', 'roll', vel=0.76, dur=0.84), 18.45, gain=0.28, pan=0.0)

    # ================= 19.30 ~ 19.52s: absolute digital zero (enforced below) ==========

    # ================= ACT H (19.52 ~ 20.68s): SUSTAINED B&W CLIMAX DRONE ('持续的高潮嗡')
    # Zero pitch changes! Unbroken, monolithic D-power sustained climax roar across the entire
    # 2D B&W side-profile charge, tightening inward during 20.46~20.68s into the portal resolve!
    add_at(orch, S.hit('gran_cassa', 'hit', vel=0.98, dur=1.4), 19.52, gain=0.46)
    add_at(orch, S.hit('timpani', 1, vel=0.92, dur=1.2), 19.52, gain=0.34)
    add_at(orch, S.hit('gong', vel=0.68, dur=1.4), 19.52, gain=0.22, pan=-0.18)
    add_at(orch, S.hit('crash', vel=0.75, dur=1.2), 19.52, gain=0.22, pan=0.18)

    # Core sustained zero-pitch-shift climax drone (19.52 ~ 20.68s)
    add_at(synth, climax_mono_pitch_drone(dur=1.16, vel=0.98), 19.52, gain=1.05)

    # Unwavering orchestral tutti pedal locked on D (D1 + D2 + A2 + D3 + A4 + D5, zero note switching!)
    add_at(orch, S.note('contrabass', 'D1', 1.15, vel=0.88, attack=0.015), 19.52, gain=0.34, pan=0.0)
    add_at(orch, S.note('cellos', 'D2', 1.15, vel=0.88, attack=0.015), 19.52, gain=0.34, pan=-0.18)
    add_at(orch, S.note('trombone', 'D3', 1.14, vel=0.84, attack=0.02), 19.52, gain=0.32, pan=0.18)
    add_at(orch, S.note('horn', 'A3', 1.14, vel=0.86, attack=0.02), 19.52, gain=0.32, pan=-0.20)
    add_at(orch, S.note('horn', 'D4', 1.14, vel=0.86, attack=0.02), 19.52, gain=0.32, pan=0.20)
    add_at(orch, S.note('violins', 'D5', 1.12, vel=0.80, attack=0.02), 19.52, gain=0.26, pan=-0.22)
    add_at(orch, S.note('violas', 'A4', 1.12, vel=0.80, attack=0.02), 19.52, gain=0.26, pan=0.22)

    # Short inward reverse-cymbal / filter convergence swell (20.38 ~ 20.68s) pulling into the white void
    add_at(orch, S.hit('sus_cymbal', 'cresc', vel=0.68, dur=0.32), 20.36, gain=0.24, pan=0.0)

    # ================= ACT I (20.68 ~ 24.00s): Cross-World Cadence Resolve -> Dissolve & Plunge
    # At 20.68s: All cyber synths cut 100% off! A single, luminous cross-world cadence chord
    # (Guqin open D2 + D4/A4 harmonics + bowed vibraphone D5) marks arrival in the ink-wash void,
    # then naturally decays into silence as the black line dissolves (21.45~22.85s).
    add_at(orch, P.pluck('guqin', 'D2', 2.20, vel=0.84), 20.68, gain=0.40, pan=-0.08)
    add_at(orch, P.pluck('guqin', 'A4', 2.10, vel=0.78, harmonic=True), 20.68, gain=0.38, pan=0.12)
    add_at(orch, P.pluck('guqin', 'D5', 2.00, vel=0.74, harmonic=True), 20.72, gain=0.34, pan=-0.12)
    add_at(orch, S.note('vibraphone_bowed', 'D5', 1.95, vel=0.58, attack=0.18, release=0.85),
           20.68, gain=0.24, pan=0.15)
    add_at(orch, S.note('tubular_bells', 'D5', 1.65, vel=0.48), 20.68, gain=0.16, pan=-0.16)
    # --- Bus processing -------------------------------------------------------
    # House style: keep the top end but do NOT stack shelves. World 02's notes call out
    # high-shelf boosts as a rejected failure mode, so this is one gentle 2 dB lift and
    # a soft ceiling, nothing more.
    orch = low_shelf(orch, 55.0, -8.0)
    synth = low_shelf(synth, 50.0, -8.0)
    synth = lp(synth, 6000.0, 2)
    orch = air_shelf(orch, 4500.0, 2.0)
    orch = lp(orch, 13000.0, 2)

    # Gate dry stems BEFORE room reverb so Act G never bleeds reverb tail into 19.52s,
    # and cut all cyber synths at 20.68s so the ink-wash void is 100% acoustic!
    orch *= gate_envelope(N_SAMPLES, [(19.30, 19.52, 0.0, 0.008)])
    synth *= gate_envelope(N_SAMPLES, [(19.30, 19.52, 0.0, 0.008), (20.68, 24.00, 0.0, 0.020)])

    orch_wet = S.room(orch, size=0.60, mix=0.24, predelay=0.018, damp=0.42)
    synth_wet = S.room(synth, size=0.45, mix=0.14, predelay=0.012, damp=0.50)
    music = orch_wet + synth_wet

    # NOTE: the macro contour is applied to the SUM in main(), not here. Applying it to the
    # music alone let the Foley/ambience hold every quiet section at full level (LRA 3.5),
    # while applying a second contour to the bed muted the very hits the stop-downs exist to
    # expose (sync fell from 28/30 to 25/30). One contour on the sum, as the original did:
    # the world goes quiet, and a key hit inside it is still the loudest thing around.
    # Freeze frame the picture actually has.
    music *= gate_envelope(N_SAMPLES, [(19.30, 19.52, 0.0, 0.008)])
    return music


# ---------------------------------------------------------------------------
# 2. SFX & Foley Stem — every hit sits on a director-track timestamp
# ---------------------------------------------------------------------------

def build_sfx_stem():
    sfx = np.zeros((N_SAMPLES, 2), dtype=np.float32)
    sc_hits = []  # (t_sec, weight) for sidechain ducking of the music stem

    # --- 0.00 ~ 1.15s: 02 -> 03 hyperspace flash + hex star-gate tunnel ---
    add_at(sfx, bank_sfx('pro_impact/deep', dur=1.20, seed=1), 0.00, gain=0.46)
    add_at(sfx, bank_sfx('logo_sting/whoosh_glass', dur=1.30, seed=2), 0.02, gain=0.40)
    add_at(sfx, bank_sfx('riser/air', dur=1.30, seed=3), 0.08, gain=0.24, pan=-0.18)
    sc_hits.append((0.02, 0.55))

    # --- 0.60 ~ 2.40s: freefall dive (76m) into the slam ---
    add_at(sfx, bank_sfx('downlifter/air_fall', dur=1.60, seed=11), 0.72, gain=0.28)
    add_at(sfx, bank_sfx('pro_whoosh_big/windy', dur=1.30, seed=12), 1.05, gain=0.26, pan=-0.10)
    add_at(sfx, bank_sfx('riser/rush', dur=1.10, seed=13), 1.30, gain=0.22)
    sc_hits.append((1.60, 0.30))

    # --- 2.40s: SLAM onto Car #4 (squash sy=0.56) + 2.40~3.20 Q-bounce ---
    add_at(sfx, bank_sfx('impact/deep', dur=1.60, seed=21), 2.40, gain=0.58)
    add_at(sfx, bank_sfx('pro_impact/short', dur=0.60, seed=22), 2.40, gain=0.50)
    add_at(sfx, bank_sfx('impact/metal', dur=1.20, seed=23), 2.40, gain=0.30, pan=0.12)
    add_at(sfx, S.hit('toms', 'low_mallet', vel=0.82, dur=0.45), 2.40, gain=0.32)
    add_at(sfx, bank_sfx('sub_drop/gritty', dur=1.10, seed=25), 2.40, gain=0.32)
    sc_hits.append((2.40, 1.0))
    add_at(sfx, bank_sfx('pro_pop_in/round', seed=26), 2.57, gain=0.34, pan=0.08)
    add_at(sfx, P.pluck('kalimba', 'D4', 0.45, vel=0.75, bend=[(0.12, 3)]), 2.58, gain=0.28)
    add_at(sfx, bank_sfx('pro_pop/thup', seed=27), 2.86, gain=0.24, pan=-0.10)
    add_at(sfx, P.pluck('kalimba', 'A4', 0.35, vel=0.60, bend=[(0.10, 2)]), 2.87, gain=0.20)
    sc_hits.append((2.57, 0.45))

    # --- 3.20 ~ 5.60s: 180° orbit reveal + Spinner #1 Overhead Flyby + Holo-Visor Tactical Scan ---
    add_at(sfx, bank_sfx('whoosh_big/swell', dur=1.50, apex=0.72, seed=31), 3.24, gain=0.22)
    # Overhead Spinner #1 (apex at 4.05s): crisp aerodynamic jet pass without distracting siren warble
    add_at(sfx, spinner_doppler_flyby(dur=0.58, f_engine=360.0, pan_from=0.92, pan_to=-0.92,
                                      with_siren=False, vel=0.68, seed=301), 3.76, gain=0.62)
    sc_hits.append((4.05, 0.50))
    # 3.60s: Slime equips 3D Holo-Visor (magnetic snap + subtle HUD boot)
    add_at(sfx, bank_sfx('fit/snap/switch_flip', seed=34), 3.60, gain=0.36, pan=-0.15)
    add_at(sfx, holo_visor_hud_scan(dur=0.20, f0=1240.0, f1=1820.0, vel=0.52, seed=35), 3.62, gain=0.65, pan=-0.10)
    # 4.18s / 4.52s / 4.86s: 3D HUD Target Lock-On Scans (OBJ-01 Laser, OBJ-02 Drone, OBJ-03 Pad)
    for t_lock, f_lo, f_hi, pan_l, s_id in [
        (4.18, 1380.0, 1960.0, -0.25, 37),
        (4.52, 1520.0, 2180.0,  0.22, 38),
        (4.86, 1680.0, 2380.0, -0.18, 39),
    ]:
        add_at(sfx, holo_visor_hud_scan(dur=0.18, f0=f_lo, f1=f_hi, vel=0.55, seed=s_id), t_lock, gain=0.68, pan=pan_l)
    for t_d, sid, chime in [(4.45, 'pro_notify/ding_1930', 'A5'), (4.80, 'pro_notify/ding_2167', 'D6')]:
        add_at(sfx, bank_sfx(sid, seed=int(t_d * 10)), t_d, gain=0.32, pan=(0.22 if t_d < 4.6 else -0.18))
        add_at(sfx, S.note('hand_chimes', chime, 0.9, vel=0.68), t_d, gain=0.22,
               pan=(0.22 if t_d < 4.6 else -0.18))
        sc_hits.append((t_d, 0.45))

    # --- 5.60 ~ 7.00s: Cold-Blooded 2D Blade-Eye Cut-In (5.88s) ---
    # Clean, surgical, high-contrast: 5.88s razor slash + sub-drop + controlled high-voltage hum
    add_at(sfx, bank_sfx('swish/blade', dur=0.34, seed=42), 5.88, gain=0.76, pan=-0.10)
    add_at(sfx, bank_sfx('fit/snap/switch_flip', seed=43), 5.88, gain=0.52, pan=0.10)
    add_at(sfx, bank_sfx('pro_sub_drop/quick', dur=0.52, seed=45), 5.88, gain=0.52)
    add_at(sfx, electric_arc_burst(dur=0.45, vel=0.76, seed=46), 5.88, gain=0.78)
    # Subtle second arc crackle as the blade eyes narrow before 7.00s launch
    add_at(sfx, electric_arc_burst(dur=0.36, vel=0.58, seed=47), 6.50, gain=0.62)
    sc_hits.append((5.88, 0.95))
    # --- 7.00s: LAUNCH (Arc 1 begins) ---
    add_at(sfx, bank_sfx('pro_sub_drop/quick', dur=0.60, seed=51), 7.00, gain=0.56)
    add_at(sfx, bank_sfx('pro_impact/short', dur=0.40, seed=52), 7.00, gain=0.48)
    add_at(sfx, bank_sfx('whoosh_fast/tight', dur=0.44, apex=0.18, seed=53), 7.00, gain=0.48)
    add_at(sfx, bank_sfx('pro_glitch/fastroll', dur=0.58, seed=55), 7.02, gain=0.30, pan=0.18)
    add_at(sfx, electric_arc_burst(dur=0.35, vel=0.70, seed=56), 7.00, gain=0.78)
    sc_hits.append((7.00, 0.95))

    # --- 7.00 ~ 8.15s: Arc 1 — vault the laser hurdles over Car #3 ---
    add_at(sfx, bank_sfx('pro_zip/up_hi', dur=0.30, seed=61), 7.42, gain=0.36, pan=-0.20)
    add_at(sfx, P.pluck('kalimba', 'A4', 0.40, vel=0.72, bend=[(0.12, 3)]), 7.43, gain=0.24, pan=-0.15)
    add_at(sfx, bank_sfx('whoosh_fast/crisp', dur=0.34, apex=0.14, seed=62), 7.72, gain=0.38, pan=0.20)
    add_at(sfx, P.pluck('kalimba', 'C5', 0.42, vel=0.74, bend=[(0.12, 2)]), 7.73, gain=0.24, pan=0.15)
    sc_hits.append((7.42, 0.55))
    sc_hits.append((7.72, 0.55))

    # --- 8.15s: Arc 1 -> Arc 2 landing ---
    add_at(sfx, bank_sfx('pro_impact/short', dur=0.36, seed=63), 8.15, gain=0.46)
    add_at(sfx, bank_sfx('fit/hit/bamboo_tok', seed=64), 8.15, gain=0.34, pan=0.10)
    add_at(sfx, S.hit('toms', 'low', vel=0.62, dur=0.28), 8.15, gain=0.22)
    sc_hits.append((8.15, 0.80))

    # --- 8.80s: DRONE STOMP (squash 0.58) + Electric Short-Circuit + Overhead Spinner #2 (9.15s) ---
    add_at(sfx, bank_sfx('pro_impact/short', dur=0.38, seed=71), 8.80, gain=0.54)
    add_at(sfx, bank_sfx('impact/punch', dur=0.60, seed=72), 8.80, gain=0.46)
    add_at(sfx, bank_sfx('impact/metal', dur=0.90, seed=73), 8.80, gain=0.32, pan=-0.12)
    add_at(sfx, S.hit('snare2', 'on', vel=0.85, dur=0.28), 8.80, gain=0.32)
    add_at(sfx, P.pluck('shamisen', 'D3', 0.50, vel=0.88, buzz=0.5), 8.81, gain=0.34)
    add_at(sfx, electric_arc_burst(dur=0.48, vel=0.88, seed=74), 8.80, gain=0.92)
    sc_hits.append((8.80, 1.0))
    add_at(sfx, bank_sfx('pro_glitch/crunchy', dur=0.70, seed=75), 8.92, gain=0.28, pan=0.14)
    # Overhead Spinner #2 (apex at 9.15s right after drone stomp): short aerodynamic whoosh, no siren
    add_at(sfx, spinner_doppler_flyby(dur=0.54, f_engine=380.0, pan_from=-0.92, pan_to=0.92,
                                      with_siren=False, vel=0.65, seed=302), 8.88, gain=0.58)
    sc_hits.append((9.15, 0.48))

    # --- 9.45s: Arc 2 -> Arc 3 landing (past the drone) ---
    add_at(sfx, bank_sfx('pro_impact/short', dur=0.34, seed=81), 9.45, gain=0.44)
    add_at(sfx, bank_sfx('fit/hit/bamboo_tok', seed=82), 9.45, gain=0.30, pan=-0.10)
    sc_hits.append((9.45, 0.75))

    # --- 9.45 ~ 9.92s: Arc 3A — vault the twin Tesla arc coils (High-Voltage Plasma Arcs!) ---
    add_at(sfx, bank_sfx('pro_zip/arc', dur=0.42, seed=83), 9.62, gain=0.45, pan=0.18)
    add_at(sfx, electric_arc_burst(dur=0.44, vel=0.86, seed=84), 9.60, gain=0.90)
    add_at(sfx, S.note('glass', 'A5', 0.45, vel=0.44), 9.66, gain=0.18, pan=-0.20)
    sc_hits.append((9.65, 0.65))

    # --- 9.92 ~ 10.68s: HARD SKID-BRAKE AT RED-X LASER WALL ([?] -> [!]) ---
    # 9.92s: Heavy landing + metallic skid-brake screech + Red-X barrier alarm + [?] emote!
    add_at(sfx, bank_sfx('pro_impact/short', dur=0.36, seed=85), 9.92, gain=0.52)
    add_at(sfx, rail_brake_skid(dur=0.42, vel=0.90, seed=205), 9.92, gain=0.95)
    add_at(sfx, electric_arc_burst(dur=0.30, vel=0.72, seed=206), 9.93, gain=0.78)
    # Urgent Red-X Laser Barrier double hazard beep + [?] rising question pluck
    add_at(sfx, holo_visor_hud_scan(dur=0.16, f0=880.0, f1=660.0, vel=0.75, seed=207), 9.96, gain=0.88, pan=-0.20)
    add_at(sfx, bank_sfx('pro_pop_in/round', seed=208), 10.00, gain=0.45, pan=-0.15)
    add_at(sfx, P.pluck('kalimba', 'F4', 0.42, vel=0.85, bend=[(0.14, 4)]), 10.01, gain=0.42, pan=-0.15)
    sc_hits.append((9.92, 0.95))

    # 10.35s: Spots Wall-Run Pads [!] — Holo-Visor lock-on + crisp [!] chime + Blade-Eye electric snap!
    add_at(sfx, bank_sfx('pro_notify/ding_2167', seed=209), 10.35, gain=0.48, pan=0.22)
    add_at(sfx, S.note('vibraphone', 'A5', 0.65, vel=0.86), 10.35, gain=0.34, pan=0.20)
    add_at(sfx, holo_visor_hud_scan(dur=0.20, f0=1580.0, f1=2360.0, vel=0.78, seed=210), 10.36, gain=0.92, pan=0.25)
    add_at(sfx, electric_arc_burst(dur=0.32, vel=0.80, seed=211), 10.38, gain=0.85)
    sc_hits.append((10.35, 0.85))

    # 10.68s: Explosive diagonal launch from Car #1 jump pad onto Wall-Run Pad #1!
    add_at(sfx, bank_sfx('pro_sub_drop/quick', dur=0.50, seed=212), 10.68, gain=0.50)
    add_at(sfx, bank_sfx('whoosh_fast/heavy', dur=0.55, apex=0.18, seed=87), 10.68, gain=0.44, pan=0.25)
    add_at(sfx, bank_sfx('pro_tap/glass', seed=86), 10.68, gain=0.38, pan=0.15)
    sc_hits.append((10.68, 0.90))
    # --- 11.08 / 11.88 / 12.68s: the three wall-run pads ---
    for t_w, p_w, pan_w, seed_w in [(11.08, 'D5', -0.35, 91), (11.88, 'F5', 0.35, 92), (12.68, 'A5', -0.25, 93)]:
        add_at(sfx, bank_sfx('pro_tap/glass', seed=seed_w), t_w, gain=0.44, pan=pan_w)
        add_at(sfx, bank_sfx('pluck/kalimba', seed=seed_w + 10), t_w, gain=0.36, pan=pan_w)
        add_at(sfx, S.note('marimba', p_w, 0.45, vel=0.78), t_w + 0.01, gain=0.28, pan=-pan_w * 0.5)
        add_at(sfx, bank_sfx('swish/soft', dur=0.26, seed=seed_w + 20), t_w + 0.04, gain=0.26, pan=pan_w)
        sc_hits.append((t_w, 0.72))
    # Overhead Spinner #3 (apex at 12.20s during the 3-step wall-run): subtle aerodynamic pass
    add_at(sfx, spinner_doppler_flyby(dur=0.54, f_engine=350.0, pan_from=0.92, pan_to=-0.90,
                                      with_siren=False, vel=0.64, seed=303), 11.93, gain=0.56)
    sc_hits.append((12.20, 0.45))

    # --- 13.68s: land on the holographic koi's golden lotus pad ---
    add_at(sfx, bank_sfx('pro_whoosh_big/swell', dur=0.95, apex=0.38, seed=101), 13.60, gain=0.42)
    add_at(sfx, bank_sfx('pro_sub_drop/soft', dur=0.70, seed=102), 13.68, gain=0.42)
    add_at(sfx, bank_sfx('pro_tap/glass', seed=103), 13.68, gain=0.38, pan=0.15)
    add_at(sfx, S.note('dan_tranh', 'A5', 1.3, vel=0.76), 13.70, gain=0.28, pan=-0.20)
    add_at(sfx, S.note('hand_chimes', 'D6', 1.4, vel=0.72), 13.74, gain=0.24, pan=0.22)
    sc_hits.append((13.68, 0.90))

    # --- 13.68 ~ 14.70s: koi launch back to Car #0 ---
    add_at(sfx, bank_sfx('riser/rush', dur=1.05, seed=104), 13.72, gain=0.26)
    add_at(sfx, S.note('dan_tranh', 'D6', 0.85, vel=0.70), 14.10, gain=0.24, pan=0.20)
    sc_hits.append((14.10, 0.45))

    # --- 14.70s: land on the Car #0 nose ---
    add_at(sfx, bank_sfx('pro_impact/short', dur=0.40, seed=111), 14.70, gain=0.50)
    add_at(sfx, bank_sfx('impact/metal', dur=0.90, seed=112), 14.70, gain=0.30, pan=-0.14)
    add_at(sfx, S.hit('toms', 'high_mallet', vel=0.66, dur=0.30), 14.70, gain=0.24)
    sc_hits.append((14.70, 0.92))

    # --- 15.32s: EAT THE STAR ✦ -> ✦✦ star eyes ---
    # Durations kept short on purpose: the bloom, harp and chimes also live in the music
    # stem, and long Foley tails here were bleeding straight through the 15.76~17.02
    # stop-down, flattening the whole cue's dynamic range.
    add_at(sfx, bank_sfx('logo_sting/soft_bloom', dur=0.55, seed=121), 15.32, gain=0.48)
    add_at(sfx, bank_sfx('pro_shimmer/m2', dur=0.48, seed=122), 15.34, gain=0.26, pan=0.20)
    add_at(sfx, P.strum('harp', ['D4', 'A4', 'D5', 'F#5', 'A5', 'D6'], 0.58, vel=0.84, spread=0.025),
           15.32, gain=0.28)
    add_at(sfx, S.note('hand_chimes', 'D6', 0.55, vel=0.76), 15.35, gain=0.22, pan=-0.22)
    add_at(sfx, bank_sfx('sub_drop/808', dur=0.50, seed=123), 15.32, gain=0.36)
    sc_hits.append((15.32, 1.0))

    # --- 15.70s / 16.55s: two camera cuts; 16.78s ~ 17.06s the cute frontal double-blink ---
    add_at(sfx, bank_sfx('whoosh_fast/reverse', dur=0.42, seed=131), 15.70, gain=0.34)
    add_at(sfx, bank_sfx('pro_sub_drop/soft', dur=0.55, seed=130), 15.72, gain=0.36)
    add_at(sfx, bank_sfx('swish/soft', dur=0.35, seed=132), 16.55, gain=0.28, pan=-0.10)
    # 16.78s & 16.92s: Exposed cute eyelash blink + Q-nod in the silent close-up!
    add_at(sfx, bank_sfx('pro_pop_in/round', seed=133), 16.78, gain=0.44, pan=-0.06)
    add_at(sfx, P.pluck('kalimba', 'A5', 0.18, vel=0.72), 16.78, gain=0.34, pan=-0.06)
    add_at(sfx, bank_sfx('pro_click/glass', seed=134), 16.92, gain=0.38, pan=0.06)
    add_at(sfx, P.pluck('kalimba', 'D6', 0.20, vel=0.76), 16.92, gain=0.36, pan=0.06)

    # --- 17.06 ~ 17.50s: Eyes snap to Blade-Eyes at 17.06s -> Holo-Visor + High-Voltage Charge ---
    add_at(sfx, bank_sfx('fit/snap/switch_flip', seed=135), 17.06, gain=0.52)
    add_at(sfx, holo_visor_hud_scan(dur=0.18, f0=1480.0, f1=2220.0, vel=0.68, seed=136), 17.06, gain=0.82)
    add_at(sfx, electric_arc_burst(dur=0.42, vel=0.86, seed=137), 17.06, gain=0.92)
    add_at(sfx, bank_sfx('pro_riser/roll', dur=0.44, seed=138), 17.06, gain=0.38)
    sc_hits.append((17.06, 0.85))

    # --- 17.50s: star-overdrive burst -> 18.45 wireframe collapse -> 19.30 freeze ---
    add_at(sfx, bank_sfx('logo_sting/spark', dur=1.10, seed=141), 17.50, gain=0.48)
    add_at(sfx, bank_sfx('pro_impact/deep', dur=1.10, seed=142), 17.50, gain=0.50)
    add_at(sfx, bank_sfx('sub_drop/pro', dur=1.20, seed=143), 17.50, gain=0.44)
    add_at(sfx, S.hit('gran_cassa', 'hit', vel=0.86, dur=1.1), 17.50, gain=0.34)
    sc_hits.append((17.50, 1.0))
    # 18.45 ~ 19.30s: Inward vacuum implosion as the 3D wireframe world shrinks to a single point
    add_at(sfx, bank_sfx('whoosh_fast/reverse', dur=0.84, seed=145), 18.45, gain=0.52)
    add_at(sfx, bank_sfx('riser/rush', dur=0.84, seed=146), 18.45, gain=0.42)
    add_at(sfx, electric_arc_burst(dur=0.82, vel=0.72, seed=147), 18.46, gain=0.75)
    sc_hits.append((18.45, 0.70))

    # --- 19.30 ~ 19.52s: impact freeze (enforced to digital zero below) ---

    # --- 19.52 ~ 20.68s: Singularity ignition + Sustained B&W Climax Roar (ZERO pitch shift!) ---
    add_at(sfx, bank_sfx('pro_impact/deep', dur=0.95, seed=151), 19.52, gain=0.64)
    add_at(sfx, bank_sfx('pro_sub_drop/ref', dur=1.10, seed=152), 19.52, gain=0.60)
    add_at(sfx, bank_sfx('logo_sting/whoosh_glass', dur=0.85, seed=153), 19.52, gain=0.44)
    add_at(sfx, S.hit('gran_cassa', 'hit', vel=0.92, dur=1.2), 19.52, gain=0.42)
    sc_hits.append((19.52, 1.0))
    # Continuous un-pitched supersonic slipstream roar + sustained high-voltage plasma buzz (19.52 ~ 20.66s)
    add_at(sfx, electric_arc_burst(dur=1.12, vel=0.82, seed=155), 19.53, gain=0.78)
    # 20.42 ~ 20.68s: Reverse air-implosion whoosh pulling the climax roar into the cross-world boundary
    add_at(sfx, bank_sfx('whoosh_fast/reverse', dur=0.28, seed=158), 20.40, gain=0.54)

    # --- 20.68s: Cross-World Arrival & Musical Resolve in the Ink-Wash White Void (#FAF6EE) ---
    # Soft ink-air shockwave release + silk scroll brush + crystalline harmonic shimmer
    add_at(sfx, bank_sfx('whoosh_big/swell', dur=1.15, apex=0.18, seed=161), 20.66, gain=0.38)
    add_at(sfx, bank_sfx('logo_sting/soft_bloom', dur=1.25, seed=162), 20.68, gain=0.36)
    sc_hits.append((20.68, 0.75))

    # --- 21.45 ~ 22.80s: Black train-line disintegrating into floating ink dots (delicate decay to silence) ---
    for idx_d, (t_diss, p_diss, pan_d) in enumerate([
        (21.48, 'D6', -0.28),
        (21.78, 'A5',  0.24),
        (22.08, 'F#5', -0.18),
        (22.38, 'D5',  0.14),
        (22.64, 'A4', -0.08),
    ]):
        fade_d = 0.85 ** idx_d
        add_at(sfx, bank_sfx('swish/soft', dur=0.24, seed=170 + idx_d), t_diss, gain=0.18 * fade_d, pan=pan_d)
        add_at(sfx, P.pluck('guqin', p_diss, 0.65, vel=0.48 * fade_d, harmonic=True),
               t_diss + 0.01, gain=0.22 * fade_d, pan=-pan_d)

    # --- 22.85s: Coyote-time hover & [!] realization in pure silence ---
    add_at(sfx, bank_sfx('pro_pop_in/round', seed=163), 22.85, gain=0.46, pan=0.08)
    add_at(sfx, P.pluck('kalimba', 'A4', 0.42, vel=0.82, bend=[(0.0, 0), (0.14, 3)]), 22.86, gain=0.40, pan=0.08)
    add_at(sfx, S.note('vibraphone', 'D5', 0.55, vel=0.68), 22.86, gain=0.24, pan=-0.08)
    sc_hits.append((22.85, 0.90))

    # --- 23.12 ~ 24.00s: Vertical freefall plunge out of white space into World 04 bamboo grove ---
    add_at(sfx, bank_sfx('downlifter/air_fall', dur=0.88, seed=164), 23.12, gain=0.38)
    add_at(sfx, bank_sfx('fit/whoosh.short/bamboo_swish', seed=165), 23.16, gain=0.36, pan=0.08)
    add_at(sfx, xiao_plunge_breath(dur=0.86, vel=0.78, seed=2312), 23.12, gain=0.88)
    sc_hits.append((23.12, 0.80))
    # --- Bus processing ---
    sfx = low_shelf(sfx, 48.0, -9.0)
    sfx *= gate_envelope(N_SAMPLES, [(19.30, 19.52, 0.0, 0.006)])
    sfx_wet = S.room(sfx, size=0.34, mix=0.10, predelay=0.008, damp=0.50)
    sfx_wet *= gate_envelope(N_SAMPLES, [(19.30, 19.52, 0.0, 0.006)])
    return sfx_wet, sc_hits

# ---------------------------------------------------------------------------
# 3. Ambience Bed — neon rain, city hum, maglev drone (this is a rain night)
# ---------------------------------------------------------------------------

def build_ambience_stem() -> np.ndarray:
    amb = np.zeros((N_SAMPLES, 2), dtype=np.float32)
    rain = rain_bed(N_SAMPLES, vel=1.0, seed=303)
    buzz = neon_buzz(N_SAMPLES, vel=1.0, seed=304)
    t = np.arange(N_SAMPLES, dtype=np.float32) / SR

    # 1. Continuous physical train rolling steel rumble + traction motor hum
    rng = np.random.default_rng(305)
    roll_noise = bp(rng.standard_normal(N_SAMPLES).astype(np.float32), 68.0, 265.0, order=2)
    bogie_mod = (0.68 + 0.32 * np.sin(2.0 * np.pi * (1.0 / 0.42) * t)).astype(np.float32)
    traction_hum = (0.028 * np.sin(2.0 * np.pi * 55.0 * t) +
                    0.020 * np.sin(2.0 * np.pi * 110.0 * t) +
                    0.012 * np.sin(2.0 * np.pi * 165.0 * t)).astype(np.float32)
    train_body = roll_noise * bogie_mod * 0.055 + traction_hum

    amb[:, 0] = train_body + rain * 0.55 + buzz * 0.52
    amb[:, 1] = np.roll(train_body, 113) + np.roll(rain, 977) * 0.55 + buzz * 0.70

    # 2. Rhythmic Track-Joint Double-Clacks ('哐当-哐当' every 0.42s, synced with camera shudder;
    #    accelerates to 0.21s during 17.50~19.25s Overdrive!)
    clack_t = 2.42
    c_idx = 0
    while clack_t < 19.22:
        is_overdrive = clack_t >= 17.50
        c_vel = 0.88 if is_overdrive else (0.76 if (9.90 <= clack_t <= 10.68 or clack_t < 5.60) else 0.64)
        add_at(amb, rail_joint_clack(vel=c_vel, seed=400 + c_idx), clack_t, gain=1.0)
        clack_t += (0.21 if is_overdrive else 0.42)
        c_idx += 1

    # 3. Skybridge / Gantry & Oncoming Train Wind-Pressure Whooshes ('呼——' aerodynamic slaps)
    gantry_passes = [
        (1.65, 0.50, -0.80,  0.80, 0.72),
        (3.05, 0.48,  0.85, -0.85, 0.78),
        (4.95, 0.46, -0.85,  0.85, 0.75),
        (7.60, 0.44,  0.80, -0.80, 0.76),
        (10.15, 0.52, -0.90, 0.90, 0.85),  # prominent pass during the brake pause!
        (13.05, 0.46,  0.85, -0.85, 0.74),
        (16.05, 0.52, -0.85, 0.85, 0.82),  # prominent pass during the quiet building shot!
        (18.05, 0.36,  0.90, -0.90, 0.88),
        (18.75, 0.34, -0.90, 0.90, 0.92),
    ]
    for g_i, (t_g, d_g, p0, p1, v_g) in enumerate(gantry_passes):
        add_at(amb, gantry_whoosh(dur=d_g, vel=v_g, pan_from=p0, pan_to=p1, seed=500 + g_i), t_g, gain=0.95)

    amb *= gate_envelope(N_SAMPLES, [
        (0.00, 0.30, 0.35, 0.15),      # fade in from the 02 hyperspace flash
        (16.55, 17.05, 0.12, 0.05),    # quiet frontal blink close-up
        (18.55, 19.30, 0.18, 0.15),    # wireframe collapse narrows to singularity
        (19.30, 19.52, 0.0, 0.006),    # freeze frame
        (20.68, 24.00, 0.0, 0.08),     # instant cut into tranquil ink-wash white void!
    ])
    return amb


# ---------------------------------------------------------------------------
# 4. Full Mix, Sidechain Ducking & Broadcast Mastering (-14.0 LUFS)
# ---------------------------------------------------------------------------

def main():
    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_wav = os.path.join(out_dir, 'audio_03_cyber.wav')

    print('[World 03 Audio] Building orchestral + cyber music stem (picture-driven dynamics)...')
    music = build_music_stem()

    print('[World 03 Audio] Building earshot.forge.bank + lemo-opuscar SFX stem...')
    sfx, sc_hits = build_sfx_stem()

    print('[World 03 Audio] Building neon-rain ambience stem...')
    amb = build_ambience_stem()

    sc_gain = master.sidechain_times(sc_hits, N_SAMPLES, depth=0.40, tau=0.13).astype(np.float32)
    music_contour = contour_gain(N_SAMPLES, CONTOUR, floor=0.0)
    amb_contour = contour_gain(N_SAMPLES, CONTOUR, floor=0.18)
    raw_mix = music * sc_gain * music_contour + sfx * 0.68 + amb * 0.52 * amb_contour
    # Modest low-end trim only. R2 cut 7.5 dB below 240 Hz, which made the mix thin;
    # the balance is fixed at the source now (no sub-octave bass, no 36 Hz notes).
    raw_mix = low_shelf(raw_mix, 220.0, -2.5)

    # Enforce the freeze-frame silence at 19.30 ~ 19.52s
    i_z0, i_z1 = int(19.30 * SR), int(19.515 * SR)
    raw_mix[i_z0:i_z1] = 0.0

    print('[World 03 Audio] Running master.finish (target = -14.0 LUFS, ceiling = 0.77)...')
    mastered, info = master.finish(
        raw_mix,
        lufs=-14.0,
        ceiling=0.77,
        mono_hz=120.0,
        comp=False,
        drive=1.10,        # light glue only — no saturation stage this time
        air=0.12,
        hp_hz=28.0,
        end_fade=0.08,
        tail_zero=480,
    )

    # Guarantee 100% digital zero during the 19.31 ~ 19.51s impact-frame freeze
    fz0, fz1 = int(19.31 * SR), int(19.51 * SR)
    fade_n = int(0.006 * SR)
    for ch in range(2):
        mastered[fz0 - fade_n:fz0, ch] *= np.linspace(1.0, 0.0, fade_n)
        mastered[fz0:fz1, ch] = 0.0
        mastered[fz1:fz1 + fade_n, ch] *= np.linspace(0.0, 1.0, fade_n)

    sf.write(out_wav, mastered.astype(np.float32), SR, subtype='PCM_16')
    final_metrics = master.measure(mastered)
    print(f'[World 03 Audio] Saved -> {out_wav}')
    print(f'[World 03 Audio] Master Metrics: {final_metrics}')


if __name__ == '__main__':
    main()
