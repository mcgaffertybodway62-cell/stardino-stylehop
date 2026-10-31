#!/usr/bin/env python3
"""
StyleHop voice track builder, vocal channel strip, auditioner, ASR QA & spectral mixer (`tools/voice.py`).

Turns a per-product `voice.json` into a deterministic 48 kHz voice track, a
timing manifest, word-level ASR timestamps (`voice.words.json`), a license
disclosure (`CREDITS.voice.txt`), and an SRT file.

Supported TTS Providers & Explicit License Tiers:
  - [免费可商用 · Apache-2.0]
      * `kokoro-zh` : `hexgrad/Kokoro-82M-v1.1-zh` (100 Mandarin voices `zm_*`/`zf_*` + custom voice blending like `zm_poet` or `0.5*zm_011+0.3*zm_010+0.2*zm_025`)
      * `kokoro`    : `hexgrad/Kokoro-82M` v1.0 ONNX
      * `command`   : External CLI template (`VOICE_CMD`), e.g. `CosyVoice2-0.5B` (Apache-2.0) or `IndexTTS-2` (Apache-2.0)
  - [免费在线 · 遵守服务商条款]
      * `edge`      : Microsoft `edge-tts` online Neural voices (preview / no-GPU fallback)
  - [开源/研究免费 · 权重不可商用 CC-BY-NC-4.0]
      * `f5`        : `SWivid/F5-TTS` (`F5TTS_v1_Base`) zero-shot reference audio cloning (`refAudio` + `refText`)
      * `chattts`   : `2Noise/ChatTTS` conversational neural TTS (`[uv_break]`, `[lbreak]`)

Subcommands:
  python3 tools/voice.py providers
  python3 tools/voice.py build --script <product>/voice.json [--cues cues.json] --out-dir <dir> [--asr]
  python3 tools/voice.py audition --text "国破山河在，城春草木深。" --out-dir <dir>
  python3 tools/voice.py qa --wav <dir>/voice.wav --timing <dir>/voice.timing.json [--asr]
  python3 tools/voice.py mix --bg <bg.wav|page.html|video.mp4> --voice <voice.wav> --out <mix.wav> [--video-in in.mp4 --video-out out.mp4]
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import importlib.util
import io
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
DEFAULT_OFFSET = 0.4
DEFAULT_GAP = 0.3
PEAK = 0.89  # -1.0 dBFS ceiling safety
FADE = 0.015
CJK = re.compile(r"[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]")
CLAUSE_SPLIT_RE = re.compile(r"([^，,；;。！？!?…—]+[，,；;。！？!?…—]?)")


def die(msg: str):
    sys.exit(f"voice.py: {msg}")


def db_to_amp(db: float) -> float:
    return float(10.0 ** (float(db) / 20.0))


def amp_to_db(amp: float) -> float:
    return float(20.0 * np.log10(max(float(amp), 1e-12)))


def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        die(f"file not found: {path}")
    except json.JSONDecodeError as e:
        die(f"{path} is not valid JSON: {e}")


def as_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def scene_end(scene: dict) -> float:
    if "end" in scene:
        return as_float(scene["end"])
    return as_float(scene.get("start", 0.0)) + as_float(scene.get("dur", 0.0))


def find_scene(scenes: list[dict], ref) -> dict:
    for s in scenes:
        if str(s.get("index")) == str(ref) or str(s.get("id")) == str(ref):
            return s
    known = ", ".join(str(s.get("index", s.get("id"))) for s in scenes) or "<none>"
    die(f"scene {ref!r} not found in cues (scenes: {known})")


def is_cjk(text: str) -> bool:
    return bool(CJK.search(text))


def default_lang(text: str) -> str:
    """Use the script of the line when the manifest does not say."""
    return "zh-CN" if is_cjk(text) else "en-us"


def normalize_kokoro_lang(lang: str) -> str:
    v = (lang or "en-us").lower()
    if v.startswith("zh"):
        return "cmn"
    if v in ("en", "en-us", "en_us"):
        return "en-us"
    return v


def normalize_edge_rate(value) -> str:
    if value is None:
        return "+0%"
    if isinstance(value, str) and re.fullmatch(r"\d+(?:\.\d+)?", value.strip()):
        value = float(value)
    if isinstance(value, (int, float)):
        return f"{round((float(value) - 1) * 100):+d}%"
    if not re.fullmatch(r"[+-]\d+%", str(value)):
        die(f"edge rate must look like '+10%' or '-5%' (or a speed number like 1.1), got {value!r}")
    return str(value)


def normalize_edge_pitch(value) -> str:
    if value is None:
        return "+0Hz"
    if isinstance(value, (int, float)):
        return f"{int(round(float(value))):+d}Hz"
    if not re.fullmatch(r"[+-]\d+Hz", str(value)):
        die(f"edge pitch must look like '-2Hz' or '+0Hz', got {value!r}")
    return str(value)


def shift_edge_rate(rate_str: str, delta_pct: int) -> str:
    m = re.fullmatch(r"([+-]?\d+)%", normalize_edge_rate(rate_str))
    base = int(m.group(1)) if m else 0
    return f"{max(-50, min(50, base + int(delta_pct))):+d}%"


def shift_edge_pitch(pitch_str: str, delta_hz: int) -> str:
    m = re.fullmatch(r"([+-]?\d+)Hz", normalize_edge_pitch(pitch_str))
    base = int(m.group(1)) if m else 0
    return f"{max(-30, min(30, base + int(delta_hz))):+d}Hz"


def decode_to_mono(path: Path) -> np.ndarray:
    """Decode any ffmpeg-readable file to 48 kHz mono float32."""
    proc = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(path),
            "-f",
            "wav",
            "-ar",
            str(SR),
            "-ac",
            "1",
            "pipe:1",
        ],
        capture_output=True,
    )
    if proc.returncode != 0:
        tail = proc.stderr.decode("utf-8", "replace").strip().splitlines()[-2:]
        die(f"could not decode {path}: {' '.join(tail)}")
    audio, sr = sf.read(io.BytesIO(proc.stdout), dtype="float32", always_2d=False)
    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    if sr != SR and audio.size:
        audio = signal.resample_poly(audio, SR, sr).astype(np.float32)
    return audio


# =============================================================================
# 1. VOCAL CHANNEL STRIP (Breath-Safe Trim, Parametric EQ, De-Esser, Leveler, Space)
# =============================================================================


def trim_silence(
    audio: np.ndarray,
    onset_db: float = -38.0,
    release_db: float = -48.0,
    pre_roll_s: float = 0.045,
    post_roll_s: float = 0.220,
) -> np.ndarray:
    """
    Breath-safe silence trimmer: uses 5 ms windowed RMS with a relaxed release threshold
    (-48 dBFS below peak) and a 220 ms tail guard so vowel decays and poetic sighs are never clipped.
    """
    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    if audio.size == 0:
        die("TTS returned an empty audio buffer")
    peak = float(np.max(np.abs(audio)))
    if peak < 1e-4:
        die("TTS returned silence")

    hop = max(1, int(0.005 * SR))
    n_frames = max(1, audio.size // hop)
    framed = audio[: n_frames * hop].reshape(n_frames, hop)
    rms = np.sqrt(np.mean(framed ** 2, axis=1) + 1e-12)
    rms_peak = float(np.max(rms))

    onset_thr = rms_peak * db_to_amp(onset_db)
    rel_thr = rms_peak * db_to_amp(release_db)

    onset_frames = np.flatnonzero(rms > onset_thr)
    rel_frames = np.flatnonzero(rms > rel_thr)
    if onset_frames.size == 0:
        idx = np.flatnonzero(np.abs(audio) > peak * 0.015)
        if idx.size == 0:
            die("TTS returned silence")
        start = max(0, int(idx[0]) - int(pre_roll_s * SR))
        end = min(audio.size, int(idx[-1]) + int(post_roll_s * SR))
    else:
        f_start = int(onset_frames[0])
        f_end = int(rel_frames[-1]) if rel_frames.size else int(onset_frames[-1])
        start = max(0, f_start * hop - int(pre_roll_s * SR))
        end = min(audio.size, (f_end + 1) * hop + int(post_roll_s * SR))

    out = audio[start:end].copy()
    # Raised-cosine micro fades at boundaries (25 ms lead-in, 85 ms natural tail release)
    n_in = min(out.size // 3, int(0.025 * SR))
    n_out = min(out.size // 3, int(0.085 * SR))
    if n_in > 1:
        w_in = 0.5 - 0.5 * np.cos(np.pi * np.linspace(0.0, 1.0, n_in, dtype=np.float32))
        out[:n_in] *= w_in
    if n_out > 1:
        w_out = 0.5 + 0.5 * np.cos(np.pi * np.linspace(0.0, 1.0, n_out, dtype=np.float32))
        out[-n_out:] *= w_out
    return out


def _peaking_biquad_sos(f0: float, gain_db: float, q: float = 1.2, sr: int = SR) -> np.ndarray:
    """RBJ Audio EQ Cookbook peaking equalizer section in SOS format."""
    if abs(gain_db) < 1e-3:
        return np.array([[1.0, 0.0, 0.0, 1.0, 0.0, 0.0]], dtype=np.float64)
    A = 10.0 ** (gain_db / 40.0)
    w0 = 2.0 * np.pi * f0 / sr
    alpha = np.sin(w0) / (2.0 * max(q, 0.1))
    b0 = 1.0 + alpha * A
    b1 = -2.0 * np.cos(w0)
    b2 = 1.0 - alpha * A
    a0 = 1.0 + alpha / A
    a1 = -2.0 * np.cos(w0)
    a2 = 1.0 - alpha / A
    return np.array([[b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0]], dtype=np.float64)


def apply_vocal_eq(audio: np.ndarray, profile: str = "recite") -> np.ndarray:
    """
    Shapes neural TTS vocals:
      - 92 Hz high-pass to clean sub-rumble
      - +0.8 dB @ 165 Hz gentle chest warmth
      - -2.8 dB @ 285 Hz & -1.6 dB @ 420 Hz low-mid mud / barrel boxiness cut
      - +1.8 dB @ 1680 Hz & +1.4 dB @ 2650 Hz natural vocal articulation & presence
      - -1.8 dB @ 3650 Hz nasal harshness dip
      - +1.0 dB @ 7600 Hz delicate silk breath air
    """
    if profile == "raw":
        return audio
    x = np.asarray(audio, dtype=np.float64)
    sos_hp = signal.butter(2, 92.0 / (0.5 * SR), btype="high", output="sos")
    x = signal.sosfilt(sos_hp, x)

    if profile in ("recite", "classical_poem", "ink_poem"):
        sections = [
            _peaking_biquad_sos(165.0, +0.8, q=1.15),
            _peaking_biquad_sos(285.0, -2.8, q=1.35),
            _peaking_biquad_sos(420.0, -1.6, q=1.40),
            _peaking_biquad_sos(1680.0, +1.8, q=1.10),
            _peaking_biquad_sos(2650.0, +1.4, q=1.20),
            _peaking_biquad_sos(3650.0, -1.8, q=1.50),
            _peaking_biquad_sos(7600.0, +1.0, q=0.90),
        ]
    else:
        sections = [
            _peaking_biquad_sos(175.0, +0.9, q=1.15),
            _peaking_biquad_sos(295.0, -2.2, q=1.40),
            _peaking_biquad_sos(1850.0, +1.4, q=1.15),
            _peaking_biquad_sos(3500.0, -1.5, q=1.45),
        ]
    sos_eq = np.vstack(sections)
    return signal.sosfilt(sos_eq, x).astype(np.float32)


def apply_deesser(audio: np.ndarray, max_reduction_db: float = 3.5) -> np.ndarray:
    """
    Phase-linear broadband dynamic sibilance tamer (5.5 kHz – 9.5 kHz detector):
    Uses a smooth 20 ms detector window (50 ms release) to gently attenuate full-band gain
    only during sharp sibilant bursts, avoiding non-linear-phase band-subtraction notches
    and fast AM modulation sidebands ("电音").
    """
    x = np.asarray(audio, dtype=np.float64)
    if x.size < 256 or max_reduction_db <= 0:
        return audio.astype(np.float32)

    sos_sib = signal.butter(2, [5500.0 / (0.5 * SR), 9500.0 / (0.5 * SR)], btype="band", output="sos")
    sib_band = signal.sosfilt(sos_sib, x)
    sos_mid = signal.butter(2, [200.0 / (0.5 * SR), 4000.0 / (0.5 * SR)], btype="band", output="sos")
    mid_band = signal.sosfilt(sos_mid, x)

    hop = max(1, int(0.015 * SR))  # 15 ms smooth detection window (no audio-rate AM sidebands)
    frames = x.size // hop
    if frames <= 1:
        return audio.astype(np.float32)

    sib_rms = np.sqrt(np.mean(sib_band[: frames * hop].reshape(frames, hop) ** 2, axis=1) + 1e-12)
    mid_rms = np.sqrt(np.mean(mid_band[: frames * hop].reshape(frames, hop) ** 2, axis=1) + 1e-12)
    abs_thr = float(np.percentile(sib_rms, 75)) * 1.25 + 1e-5

    ratio = sib_rms / (mid_rms * 0.55 + abs_thr)
    over_db = np.maximum(0.0, 20.0 * np.log10(np.maximum(ratio, 1.0)))
    gain_red_db = np.minimum(float(max_reduction_db), over_db * 0.50)

    ca = 1.0 - np.exp(-hop / (0.015 * SR))
    cr = 1.0 - np.exp(-hop / (0.065 * SR))
    smooth_db = np.empty_like(gain_red_db)
    y = 0.0
    for i, g in enumerate(gain_red_db):
        y += (g - y) * (ca if g > y else cr)
        smooth_db[i] = y

    gain_lin = 10.0 ** (-np.repeat(smooth_db, hop) / 20.0)
    if gain_lin.size < x.size:
        gain_lin = np.pad(gain_lin, (0, x.size - gain_lin.size), constant_values=1.0)
    return (x * gain_lin[: x.size]).astype(np.float32)


def _soft_limit_to_peak(x: np.ndarray, ceiling: float = PEAK, knee_ratio: float = 0.90) -> np.ndarray:
    """Transparent soft-knee peak guard (high 0.90 knee so vowel peaks never suffer tanh harmonic distortion)."""
    arr = np.asarray(x, dtype=np.float64).copy()
    knee = float(ceiling) * float(knee_ratio)
    mag = np.abs(arr)
    over = mag > knee
    if np.any(over):
        sign = np.sign(arr[over])
        excess = (mag[over] - knee) / max(float(ceiling) - knee, 1e-6)
        arr[over] = sign * (knee + (float(ceiling) - knee) * np.tanh(excess))
    peak = float(np.max(np.abs(arr)))
    if peak > ceiling:
        arr *= ceiling / peak
    return arr.astype(np.float32)


def level_vocal(
    audio: np.ndarray,
    target_rms_db: float = -16.8,
    gain_offset_db: float = 0.0,
    ratio: float = 2.0,
) -> np.ndarray:
    """
    Gentle, transparent RMS vocal leveler (35 ms attack, 240 ms release) without fast waveshaping.
    Preserves 100% of the neural voice's natural timbre without metallic intermodulation.
    """
    x = np.asarray(audio, dtype=np.float64)
    if x.size == 0:
        return audio.astype(np.float32)

    hop = max(1, int(0.015 * SR))
    frames = max(1, x.size // hop)
    f_rms = np.sqrt(np.mean(x[: frames * hop].reshape(frames, hop) ** 2, axis=1) + 1e-12)
    f_peak = float(np.max(f_rms))
    if f_peak < 1e-6:
        return audio.astype(np.float32)

    ca = 1.0 - np.exp(-hop / (0.035 * SR))
    cr = 1.0 - np.exp(-hop / (0.240 * SR))
    env_db = np.empty(frames, dtype=np.float64)
    y = 20.0 * np.log10(f_rms[0] + 1e-9)
    for i, r in enumerate(f_rms):
        db = 20.0 * np.log10(r + 1e-9)
        y += (db - y) * (ca if db > y else cr)
        env_db[i] = y

    active_frames = f_rms > f_peak * db_to_amp(-26.0)
    thresh_db = float(np.percentile(env_db[active_frames], 45)) if np.any(active_frames) else -22.0
    knee_db = 8.0
    slope = 1.0 - 1.0 / max(float(ratio), 1.0)
    delta = env_db - thresh_db
    gr_db = np.zeros_like(delta)
    in_knee = np.abs(delta) < (knee_db * 0.5)
    above = delta >= (knee_db * 0.5)
    gr_db[in_knee] = slope * ((delta[in_knee] + knee_db * 0.5) ** 2) / (2.0 * knee_db)
    gr_db[above] = slope * delta[above]

    gain_curve = 10.0 ** (-np.repeat(gr_db, hop) / 20.0)
    if gain_curve.size < x.size:
        gain_curve = np.pad(gain_curve, (0, x.size - gain_curve.size), constant_values=float(gain_curve[-1]))
    x = x * gain_curve[: x.size]

    f_rms2 = np.sqrt(np.mean(x[: frames * hop].reshape(frames, hop) ** 2, axis=1) + 1e-12)
    active2 = f_rms2 > float(np.max(f_rms2)) * db_to_amp(-18.0)
    active_rms = float(np.sqrt(np.mean(f_rms2[active2] ** 2))) if np.any(active2) else float(np.sqrt(np.mean(x ** 2)))
    target_amp = db_to_amp(float(target_rms_db) + float(gain_offset_db))
    if active_rms > 1e-7:
        x = x * (target_amp / active_rms)

    return _soft_limit_to_peak(x, ceiling=PEAK, knee_ratio=0.90)


_VOCAL_IR_CACHE: dict[str, np.ndarray] = {}


def _get_vocal_space_ir(kind: str = "canyon_silk") -> np.ndarray:
    """
    Pure velvet diffused acoustic tail (45 ms pre-delay, ZERO discrete slapback spikes
    so the vocal midrange never suffers metallic comb-filtering).
    """
    if kind in _VOCAL_IR_CACHE:
        return _VOCAL_IR_CACHE[kind]
    rng = np.random.default_rng(20261030 if kind == "canyon_silk" else 20261031)
    rt60 = 0.78 if kind == "canyon_silk" else 0.45
    n = int(round((rt60 + 0.10) * SR))
    ir = np.zeros(n, dtype=np.float64)

    pre = int(0.045 * SR)
    t_tail = np.arange(n - pre, dtype=np.float64) / SR
    env = (1.0 - np.exp(-t_tail / 0.038)) * np.exp(-6.9078 * t_tail / rt60)
    tail = rng.standard_normal(n - pre) * env * 0.14
    ir[pre:] += tail

    sos = signal.butter(2, [220.0 / (0.5 * SR), 1950.0 / (0.5 * SR)], btype="band", output="sos")
    ir = signal.sosfilt(sos, ir)

    norm = float(np.sqrt(np.sum(ir ** 2) + 1e-12))
    ir = (ir / max(norm, 1e-6)).astype(np.float32)
    _VOCAL_IR_CACHE[kind] = ir
    return ir


def apply_vocal_space(
    audio: np.ndarray,
    base_wet: float = 0.09,
    tail_wet: float = 0.24,
    tail_extend_s: float = 0.22,
    space_kind: str = "canyon_silk",
) -> np.ndarray:
    """
    Applies subtle spatial early reflections during speech (`base_wet`) and dynamically blooms
    the reverb send across the final syllable + `tail_extend_s` (`tail_wet`) so poetic endings
    dissolve naturally into the scroll's acoustic space instead of cutting off dry.
    """
    if base_wet <= 0.0 and tail_wet <= 0.0:
        return audio.astype(np.float32)
    x = np.asarray(audio, dtype=np.float32).reshape(-1)
    n_ext = max(0, int(round(float(tail_extend_s) * SR)))
    padded = np.pad(x, (0, n_ext)) if n_ext > 0 else x.copy()

    ir = _get_vocal_space_ir(space_kind)
    wet_sig = signal.fftconvolve(padded, ir, mode="full")[: padded.size].astype(np.float32)

    # Dynamic send envelope: stays at `base_wet` during body, blooms to `tail_wet` in last 0.28s of speech
    send_env = np.full(padded.size, float(base_wet), dtype=np.float32)
    bloom_start = max(0, x.size - int(0.28 * SR))
    if padded.size > bloom_start:
        ramp_len = padded.size - bloom_start
        u = np.linspace(0.0, 1.0, ramp_len, dtype=np.float32)
        bloom_curve = 0.5 - 0.5 * np.cos(np.pi * np.minimum(1.0, u * 1.6))
        send_env[bloom_start:] = float(base_wet) + (float(tail_wet) - float(base_wet)) * bloom_curve

    out = padded + wet_sig * send_env
    # Smooth cosine fade-out on the extended reverb tail
    if n_ext > 16:
        fade_len = min(padded.size // 2, max(n_ext, int(0.12 * SR)))
        w_out = 0.5 + 0.5 * np.cos(np.pi * np.linspace(0.0, 1.0, fade_len, dtype=np.float32))
        out[-fade_len:] *= w_out

    return _soft_limit_to_peak(out, ceiling=PEAK, knee_ratio=0.70)


def synth_gentle_breath(dur_s: float = 0.14, gain: float = 0.014, seed: int = 42) -> np.ndarray:
    """Synthesizes a subtle, organic soft inhalation/sigh bridges for poetic caesura pauses."""
    n = max(1, int(round(float(dur_s) * SR)))
    if gain <= 0.0 or n < 64:
        return np.zeros(n, dtype=np.float32)
    rng = np.random.default_rng(seed)
    t = np.linspace(0.0, 1.0, n, dtype=np.float64)
    env = (np.sin(np.pi * t) ** 1.6) * np.exp(-1.4 * t)
    noise = rng.standard_normal(n)
    sos1 = signal.butter(2, [420.0 / (0.5 * SR), 1150.0 / (0.5 * SR)], btype="band", output="sos")
    sos2 = signal.butter(2, [1450.0 / (0.5 * SR), 2850.0 / (0.5 * SR)], btype="band", output="sos")
    formant = 0.65 * signal.sosfilt(sos1, noise) + 0.35 * signal.sosfilt(sos2, noise)
    peak = float(np.max(np.abs(formant))) + 1e-9
    return ((formant / peak) * env * float(gain)).astype(np.float32)


def finish_line(
    audio: np.ndarray,
    profile: str = "narrator",
    gain_db: float = 0.0,
    base_wet: float | None = None,
    tail_wet: float | None = None,
    tail_extend_s: float | None = None,
    target_rms_db: float = -16.8,
    post_roll_s: float | None = None,
) -> np.ndarray:
    """Runs the complete 5-stage vocal channel strip on a raw synthesized clause or line."""
    is_recite = profile in ("recite", "classical_poem", "ink_poem")
    p_roll = (0.180 if is_recite else 0.120) if post_roll_s is None else float(post_roll_s)
    trimmed = trim_silence(
        audio,
        onset_db=-38.0,
        release_db=-48.0 if is_recite else -42.0,
        pre_roll_s=0.038,
        post_roll_s=p_roll,
    )
    if profile == "raw":
        peak = float(np.max(np.abs(trimmed)))
        if peak <= 1e-9:
            die("TTS line has no signal")
        out = trimmed * (PEAK / peak)
        n = min(out.size // 2, int(FADE * SR))
        if n > 0:
            out[:n] *= np.linspace(0.0, 1.0, n, dtype=np.float32)
            out[-n:] *= np.linspace(1.0, 0.0, n, dtype=np.float32)
        return out

    eq_sig = apply_vocal_eq(trimmed, profile=profile)
    deessed = apply_deesser(eq_sig, max_reduction_db=3.0 if is_recite else 2.5)
    leveled = level_vocal(deessed, target_rms_db=target_rms_db, gain_offset_db=gain_db)

    bw = (0.02 if is_recite else 0.0) if base_wet is None else float(base_wet)
    tw = (0.08 if is_recite else 0.03) if tail_wet is None else float(tail_wet)
    te = (0.12 if is_recite else 0.04) if tail_extend_s is None else float(tail_extend_s)
    space_kind = "canyon_silk" if is_recite else "studio_warm"
    return apply_vocal_space(leveled, base_wet=bw, tail_wet=tw, tail_extend_s=te, space_kind=space_kind)


def compute_vocal_metrics(audio: np.ndarray) -> dict:
    """Computes objective acoustic metrics (duration, peak, active RMS, crest factor, sibilance ratio)."""
    x = np.asarray(audio, dtype=np.float64).reshape(-1)
    if x.size == 0 or np.max(np.abs(x)) < 1e-6:
        return {"dur": 0.0, "peakDbfs": -96.0, "activeRmsDbfs": -96.0, "crestDb": 0.0, "sibilanceRatioDb": -40.0}
    peak = float(np.max(np.abs(x)))
    peak_db = amp_to_db(peak)
    hop = max(1, int(0.01 * SR))
    frames = max(1, x.size // hop)
    f_rms = np.sqrt(np.mean(x[: frames * hop].reshape(frames, hop) ** 2, axis=1) + 1e-12)
    active = f_rms > float(np.max(f_rms)) * db_to_amp(-18.0)
    act_rms = float(np.sqrt(np.mean(f_rms[active] ** 2))) if np.any(active) else float(np.sqrt(np.mean(x ** 2)))
    act_rms_db = amp_to_db(act_rms)

    sos_sib = signal.butter(2, [5200.0 / (0.5 * SR), 9600.0 / (0.5 * SR)], btype="band", output="sos")
    sib_rms = float(np.sqrt(np.mean(signal.sosfilt(sos_sib, x) ** 2) + 1e-12))
    sib_ratio_db = amp_to_db(sib_rms / max(act_rms, 1e-9))
    return {
        "dur": round(x.size / SR, 3),
        "peakDbfs": round(peak_db, 2),
        "activeRmsDbfs": round(act_rms_db, 2),
        "crestDb": round(peak_db - act_rms_db, 2),
        "sibilanceRatioDb": round(sib_ratio_db, 2),
    }


# =============================================================================
# 2. TTS PROVIDERS, LICENSE REGISTRY & RAW LINE CACHING
# =============================================================================

VOICE312_PY = Path(os.environ.get("VOICE_GPU_PYTHON", "/root/tts/voice312/bin/python"))
CHATTTS_PY = Path(os.environ.get("CHATTTS_PYTHON", "/root/tts/venv/bin/python"))
DEFAULT_POET_REF_WAV = Path(os.environ.get("VOICE_DEFAULT_REF_WAV", "/root/tts/refs/poet_baritone_ref.wav"))
DEFAULT_POET_REF_TEXT = os.environ.get("VOICE_DEFAULT_REF_TEXT", "国破，山河在。")

# Named Kokoro-82M-v1.1-zh speaker blend presets (Apache-2.0)
KOKORO_ZH_PRESETS: dict[str, str] = {
    "zm_poet": "0.50*zm_011+0.30*zm_010+0.20*zm_025",
    "zm_epic": "0.55*zm_037+0.45*zm_011",
    "zm_scholar": "0.60*zm_034+0.40*zm_029",
    "zf_narrator": "0.60*zf_001+0.40*zf_002",
}

# Explicit Open-Source / Commercial License Tier Registry
PROVIDER_LICENSES: dict[str, dict] = {
    "kokoro-zh": {
        "tier": "commercial_free",
        "badge": "[免费可商用 · Apache-2.0]",
        "model": "hexgrad/Kokoro-82M-v1.1-zh (LongMaoData 100-speaker Mandarin + StyleTTS2)",
        "codeLicense": "Apache-2.0",
        "weightsLicense": "Apache-2.0",
        "commercialUse": True,
        "notes": "完全免费可商用；支持 100 款中文音色 (zm_*/zf_*) 及多音色线性混合 (如 zm_poet)。",
    },
    "kokoro": {
        "tier": "commercial_free",
        "badge": "[免费可商用 · Apache-2.0]",
        "model": "hexgrad/Kokoro-82M v1.0 (ONNX)",
        "codeLicense": "Apache-2.0",
        "weightsLicense": "Apache-2.0",
        "commercialUse": True,
        "notes": "完全免费可商用；适合英文及多语种轻量合成。",
    },
    "indextts2": {
        "tier": "commercial_free",
        "badge": "[开源情感解耦大模型 · IndexTeam/IndexTTS-2]",
        "model": "IndexTeam/IndexTTS-2 (Speaker-Emotion Disentangled Autoregressive + BigVGAN)",
        "codeLicense": "Apache-2.0 / IndexTTS License",
        "weightsLicense": "IndexTTS Model License",
        "commercialUse": True,
        "notes": "支持声纹与悲怆/吟诵情感参考音频独立解耦 (emoAudioPrompt) 及 QwenEmotion 8维情感控制。",
    },
    "f5": {
        "tier": "non_commercial",
        "badge": "[开源/研究免费 · 权重不可商用 CC-BY-NC-4.0]",
        "model": "SWivid/F5-TTS (F5TTS_v1_Base Flow-Matching Zero-Shot)",
        "codeLicense": "MIT",
        "weightsLicense": "CC-BY-NC-4.0",
        "commercialUse": False,
        "notes": "代码 MIT 开源，预训练权重遵循 CC-BY-NC-4.0（开源演示/非商业免费，商业使用需自行训练或获授权）。",
    },
    "chattts": {
        "tier": "non_commercial",
        "badge": "[开源/研究免费 · 权重不可商用 CC-BY-NC-4.0]",
        "model": "2Noise/ChatTTS",
        "codeLicense": "AGPL-3.0",
        "weightsLicense": "CC-BY-NC-4.0",
        "commercialUse": False,
        "notes": "预训练权重仅限非商业/学术研究使用；适合口语化旁白与带气口对话 ([uv_break], [lbreak])。",
    },
    "edge": {
        "tier": "online_tos",
        "badge": "[免费在线 · 遵守服务商条款]",
        "model": "Microsoft Edge Read-Aloud Neural TTS (edge-tts)",
        "codeLicense": "LGPL-3.0",
        "weightsLicense": "Microsoft Online Service Terms",
        "commercialUse": False,
        "notes": "免显卡在线预览兜底；受微软在线服务条款约束，不建议用于商业发行。",
    },
    "command": {
        "tier": "custom",
        "badge": "[外部命令 · 取决于所调模型协议]",
        "model": "External CLI via VOICE_CMD (e.g. CosyVoice2-0.5B Apache-2.0 / IndexTTS-2 Apache-2.0)",
        "codeLicense": "Custom",
        "weightsLicense": "Custom (CosyVoice2 & IndexTTS-2 are Apache-2.0 commercial-free)",
        "commercialUse": True,
        "notes": "通过 VOICE_CMD 调用外部模型；若使用 FunAudioLLM/CosyVoice2-0.5B 或 IndexTeam/IndexTTS-2 则为 Apache-2.0 可商用。",
    },
}

_KOKORO = None
_KOKORO_ZH_PIPE = None
_F5_ENGINE = None


def kokoro_available() -> bool:
    if importlib.util.find_spec("kokoro_onnx") is None:
        return False
    return kokoro_model_paths()[0].is_file() and kokoro_model_paths()[1].is_file()


def kokoro_zh_available() -> bool:
    if importlib.util.find_spec("kokoro") is not None:
        return True
    return VOICE312_PY.is_file()


def f5_available() -> bool:
    if importlib.util.find_spec("f5_tts") is not None:
        return True
    return VOICE312_PY.is_file()


def chattts_available() -> bool:
    if importlib.util.find_spec("ChatTTS") is not None:
        return True
    return CHATTTS_PY.is_file()


def kokoro_model_paths() -> tuple[Path, Path]:
    here = Path(__file__).resolve().parent
    model_dir = Path(os.environ.get("VOICE_MODEL_DIR", here / "voice"))
    model = Path(os.environ.get("KOKORO_MODEL", model_dir / "kokoro-v1.0.onnx"))
    voices = Path(os.environ.get("KOKORO_VOICES", model_dir / "voices-v1.0.bin"))
    return model, voices


def kokoro_synth(text: str, voice: str, speed: float, lang: str) -> np.ndarray:
    global _KOKORO
    try:
        from kokoro_onnx import Kokoro
    except ImportError:
        die("kokoro-onnx is missing; install the optional voice tier or use --provider kokoro-zh")
    model, voices = kokoro_model_paths()
    if not model.is_file() or not voices.is_file():
        die(
            f"Kokoro model not found ({model} / {voices}); download kokoro-v1.0.onnx and "
            "voices-v1.0.bin, or set KOKORO_MODEL and KOKORO_VOICES"
        )
    if _KOKORO is None:
        _KOKORO = Kokoro(str(model), str(voices))
    try:
        audio, sr = _KOKORO.create(text, voice=voice, speed=float(speed), lang=lang)
    except Exception as e:
        die(f"Kokoro failed for voice {voice!r} / lang {lang!r}: {e}")
    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    if sr != SR and audio.size:
        audio = signal.resample_poly(audio, SR, sr).astype(np.float32)
    return audio


def _resolve_kokoro_zh_voice(pipe, voice_spec: str):
    """Resolves a single voice name ('zm_011'), a preset ('zm_poet'), or a linear blend ('0.5*zm_011+0.5*zm_010')."""
    spec = KOKORO_ZH_PRESETS.get(voice_spec.strip(), voice_spec.strip())
    if "+" not in spec and "*" not in spec:
        return spec
    blended = None
    for term in spec.split("+"):
        term = term.strip()
        if not term:
            continue
        if "*" in term:
            w_str, v_name = term.split("*", 1)
            weight = float(w_str.strip())
            v_name = v_name.strip()
        else:
            weight = 1.0
            v_name = term
        v_tensor = pipe.load_voice(v_name)
        blended = v_tensor * weight if blended is None else blended + v_tensor * weight
    return blended


def kokoro_zh_synth(text: str, voice: str, speed: float) -> np.ndarray:
    """
    Synthesizes Mandarin Chinese (and mixed English) using `hexgrad/Kokoro-82M-v1.1-zh` (Apache-2.0).
    Supports 100 speakers (`zm_*`, `zf_*`) and custom speaker tensor blends (`zm_poet`).
    Automatically delegates to `VOICE312_PY` if invoked from an environment without `kokoro`.
    """
    global _KOKORO_ZH_PIPE
    if importlib.util.find_spec("kokoro") is None:
        if not VOICE312_PY.is_file():
            die("kokoro>=0.9 is not installed and /root/tts/voice312/bin/python was not found")
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
            tmp_wav = Path(tf.name)
        try:
            code = (
                "import sys, torch, numpy as np, soundfile as sf\n"
                "from kokoro import KModel, KPipeline\n"
                "repo = 'hexgrad/Kokoro-82M-v1.1-zh'\n"
                "dev = 'cuda' if torch.cuda.is_available() else 'cpu'\n"
                "m = KModel(repo_id=repo).to(dev).eval()\n"
                "p = KPipeline(lang_code='z', repo_id=repo, model=m)\n"
                "spec = sys.argv[2]\n"
                "v = None\n"
                "if '+' in spec or '*' in spec:\n"
                "    for t in spec.split('+'):\n"
                "        w, vn = (t.split('*',1) if '*' in t else ('1.0', t))\n"
                "        vt = p.load_voice(vn.strip()) * float(w)\n"
                "        v = vt if v is None else v + vt\n"
                "else:\n"
                "    v = spec\n"
                "gen = p(sys.argv[1], voice=v, speed=float(sys.argv[3]))\n"
                "wav = np.concatenate([r.audio.cpu().numpy() for r in gen])\n"
                "sf.write(sys.argv[4], wav, 24000)\n"
            )
            resolved_spec = KOKORO_ZH_PRESETS.get(voice.strip(), voice.strip())
            proc = subprocess.run(
                [str(VOICE312_PY), "-c", code, text, resolved_spec, str(float(speed)), str(tmp_wav)],
                capture_output=True,
                text=True,
                timeout=180,
            )
            if proc.returncode != 0:
                tail = (proc.stderr or proc.stdout).strip().splitlines()[-3:]
                die(f"kokoro-zh subprocess failed: {' '.join(tail)}")
            return decode_to_mono(tmp_wav)
        finally:
            tmp_wav.unlink(missing_ok=True)

    import torch
    from kokoro import KModel, KPipeline

    repo = "hexgrad/Kokoro-82M-v1.1-zh"
    if _KOKORO_ZH_PIPE is None:
        dev = "cuda" if torch.cuda.is_available() else "cpu"
        kmodel = KModel(repo_id=repo).to(dev).eval()
        _KOKORO_ZH_PIPE = KPipeline(lang_code="z", repo_id=repo, model=kmodel)
    v_obj = _resolve_kokoro_zh_voice(_KOKORO_ZH_PIPE, voice or "zm_poet")
    gen = _KOKORO_ZH_PIPE(text, voice=v_obj, speed=float(speed))
    chunks = [r.audio.cpu().numpy() for r in gen]
    if not chunks:
        die(f"kokoro-zh produced no audio for {text!r}")
    wav24 = np.concatenate(chunks).astype(np.float32)
    return signal.resample_poly(wav24, SR, 24000).astype(np.float32)


def f5_synth(
    text: str,
    speed: float = 0.92,
    ref_audio: str | None = None,
    ref_text: str | None = None,
    seed: int = 42,
) -> np.ndarray:
    """
    Zero-shot Flow-Matching synthesis via `SWivid/F5-TTS` (`F5TTS_v1_Base`, CC-BY-NC-4.0 weights).
    Clones the timbre and cadence of `ref_audio` (defaults to `/root/tts/refs/poet_baritone_ref.wav`).
    """
    global _F5_ENGINE
    ref_wav_path = Path(ref_audio).resolve() if ref_audio else DEFAULT_POET_REF_WAV
    ref_txt = str(ref_text if ref_text is not None else DEFAULT_POET_REF_TEXT)
    if not ref_wav_path.is_file():
        die(f"F5-TTS reference audio not found: {ref_wav_path}")

    if importlib.util.find_spec("f5_tts") is None:
        if not VOICE312_PY.is_file():
            die("f5-tts is not installed and /root/tts/voice312/bin/python was not found")
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
            tmp_wav = Path(tf.name)
        try:
            code = (
                "import sys, torch, soundfile as sf, torchaudio\n"
                "from f5_tts.api import F5TTS\n"
                "def _sf_load(u, *a, **k):\n"
                "    d, sr = sf.read(str(u), dtype='float32', always_2d=True)\n"
                "    return torch.from_numpy(d.T.copy()), sr\n"
                "torchaudio.load = _sf_load\n"
                "f5 = F5TTS(model='F5TTS_v1_Base', device='cuda' if torch.cuda.is_available() else 'cpu')\n"
                "wav, sr, _ = f5.infer(ref_file=sys.argv[1], ref_text=sys.argv[2], gen_text=sys.argv[3], "
                "speed=float(sys.argv[4]), nfe_step=32, cfg_strength=2.0, seed=int(sys.argv[5]), show_info=lambda *a: None)\n"
                "sf.write(sys.argv[6], wav, sr)\n"
            )
            proc = subprocess.run(
                [str(VOICE312_PY), "-c", code, str(ref_wav_path), ref_txt, text, str(float(speed)), str(int(seed)), str(tmp_wav)],
                capture_output=True,
                text=True,
                timeout=240,
            )
            if proc.returncode != 0:
                tail = (proc.stderr or proc.stdout).strip().splitlines()[-3:]
                die(f"f5-tts subprocess failed: {' '.join(tail)}")
            return decode_to_mono(tmp_wav)
        finally:
            tmp_wav.unlink(missing_ok=True)

    import torch
    import torchaudio
    from f5_tts.api import F5TTS

    def _sf_load(uri, *a, **kw):
        data, sr_in = sf.read(str(uri), dtype="float32", always_2d=True)
        return torch.from_numpy(data.T.copy()), sr_in

    torchaudio.load = _sf_load
    if _F5_ENGINE is None:
        dev = "cuda" if torch.cuda.is_available() else "cpu"
        _F5_ENGINE = F5TTS(model="F5TTS_v1_Base", device=dev)
    wav, sr_out, _ = _F5_ENGINE.infer(
        ref_file=str(ref_wav_path),
        ref_text=ref_txt,
        gen_text=text,
        speed=float(speed),
        nfe_step=32,
        cfg_strength=2.0,
        seed=int(seed),
        show_info=lambda *a: None,
    )
    wav = np.asarray(wav, dtype=np.float32).reshape(-1)
    if sr_out != SR and wav.size:
        wav = signal.resample_poly(wav, SR, sr_out).astype(np.float32)
    return wav


def indextts2_available() -> bool:
    return Path("/root/tts/index-tts/checkpoints/gpt.pth").is_file() and VOICE312_PY.is_file()


def indextts2_synth(
    text: str,
    ref_audio: str | None = None,
    emo_audio: str | None = None,
    emo_text: str | None = None,
    emo_alpha: float = 0.9,
    profile: str = "narrator",
) -> np.ndarray:
    """
    Synthesizes speech via local IndexTTS-2.
    - When `profile` is `recite` / `classical_poem` (or `emo_audio` is explicitly provided), uses
      disentangled `emo_audio_prompt` (defaulting to `/root/tts/refs/poet_master_emo_tragic.wav` for poetry).
    - When `profile` is `narrator` / `story` / `monologue` (e.g., explaining a topic in `ink-wash`),
      does NOT inject the tragic poetry emotion prompt unless `emo_audio` or `emo_text` is explicitly given,
      ensuring calm, natural narrative prosody without poetic dragging.
    """
    spk_wav = Path(ref_audio).resolve() if ref_audio else Path("/root/tts/refs/poet_master_spk.wav")
    if not spk_wav.is_file():
        spk_wav = DEFAULT_POET_REF_WAV

    is_poetic = str(profile or "").lower().strip() in ("recite", "classical_poem", "ink_poem")
    if emo_audio:
        emo_wav_path = Path(emo_audio).resolve()
        emo_arg = str(emo_wav_path) if emo_wav_path.is_file() else ""
    elif is_poetic and not emo_text:
        default_emo = Path("/root/tts/refs/poet_master_emo_tragic.wav")
        emo_arg = str(default_emo) if default_emo.is_file() else ""
    else:
        emo_arg = ""

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        tmp_wav = Path(tf.name)
    try:
        code = (
            "import sys, torch, soundfile as sf, torchaudio\n"
            "def _sf_load(u, *a, **k):\n"
            "    d, sr = sf.read(str(u), dtype='float32', always_2d=True)\n"
            "    return torch.from_numpy(d.T.copy()), sr\n"
            "torchaudio.load = _sf_load\n"
            "from indextts.infer_v2 import IndexTTS2\n"
            "tts = IndexTTS2(cfg_path='/root/tts/index-tts/checkpoints/config.yaml', "
            "model_dir='/root/tts/index-tts/checkpoints', use_fp16=True, device='cuda:0', use_cuda_kernel=False)\n"
            "emo_wav = sys.argv[3] if sys.argv[3] else None\n"
            "emo_txt = sys.argv[4] if sys.argv[4] else None\n"
            "tts.infer(spk_audio_prompt=sys.argv[1], text=sys.argv[2], output_path=sys.argv[6], "
            "emo_audio_prompt=None if emo_txt else emo_wav, use_emo_text=bool(emo_txt), emo_text=emo_txt, "
            "emo_alpha=float(sys.argv[5]), interval_silence=350 if emo_wav else 220)\n"
        )
        env = os.environ.copy()
        env["PYTHONPATH"] = f"/root/tts/index-tts:{env.get('PYTHONPATH', '')}"
        proc = subprocess.run(
            [str(VOICE312_PY), "-c", code, str(spk_wav), text, emo_arg, str(emo_text or ""), str(float(emo_alpha)), str(tmp_wav)],
            capture_output=True,
            text=True,
            env=env,
            timeout=300,
        )
        if proc.returncode != 0:
            tail = (proc.stderr or proc.stdout).strip().splitlines()[-3:]
            die(f"IndexTTS-2 failed: {' '.join(tail)}")
        return decode_to_mono(tmp_wav)
    finally:
        tmp_wav.unlink(missing_ok=True)


def chattts_synth(text: str, voice_seed: str = "42") -> np.ndarray:
    """Synthesizes conversational speech via `2Noise/ChatTTS` (CC-BY-NC-4.0 weights) in `/root/tts/venv`."""
    py_bin = CHATTTS_PY if CHATTTS_PY.is_file() else Path(sys.executable)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        tmp_wav = Path(tf.name)
    try:
        m = re.search(r"\d+", str(voice_seed or "42"))
        seed_int = int(m.group(0)) if m else 42
        code = (
            "import sys, torch, ChatTTS, soundfile as sf\n"
            "torch.manual_seed(int(sys.argv[2]))\n"
            "chat = ChatTTS.Chat()\n"
            "chat.load(source='huggingface', compile=False)\n"
            "spk = chat.sample_random_speaker()\n"
            "params = ChatTTS.Chat.InferCodeParams(spk_emb=spk, temperature=0.25, top_P=0.7, top_K=20)\n"
            "w = chat.infer([sys.argv[1]], skip_refine_text=True, use_decoder=True, params_infer_code=params)\n"
            "sf.write(sys.argv[3], w[0], 24000)\n"
        )
        proc = subprocess.run(
            [str(py_bin), "-c", code, text, str(seed_int), str(tmp_wav)],
            capture_output=True,
            text=True,
            timeout=180,
        )
        if proc.returncode != 0:
            tail = (proc.stderr or proc.stdout).strip().splitlines()[-3:]
            die(f"ChatTTS failed: {' '.join(tail)}")
        return decode_to_mono(tmp_wav)
    finally:
        tmp_wav.unlink(missing_ok=True)


def edge_synth(text: str, voice: str, rate: str, pitch: str) -> np.ndarray:
    try:
        import edge_tts
    except ImportError:
        die("edge-tts is missing; install the optional voice tier")
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        mp3 = Path(f.name)

    async def run():
        last = None
        for attempt in range(3):
            try:
                await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(str(mp3))
                if mp3.stat().st_size == 0:
                    raise RuntimeError("the service returned an empty file")
                return
            except Exception as e:
                last = e
                if attempt < 2:
                    await asyncio.sleep(1.5 * (attempt + 1))
        raise last

    try:
        asyncio.run(run())
        return decode_to_mono(mp3)
    except Exception as e:
        die(
            f"edge-tts failed for voice {voice!r}: {type(e).__name__}: {e}. "
            "edge-tts needs a network connection; use --provider kokoro-zh for offline."
        )
    finally:
        mp3.unlink(missing_ok=True)


def command_synth(text: str, voice: str, rate: str, pitch: str, lang: str) -> np.ndarray:
    template = os.environ.get("VOICE_CMD", "").strip()
    if not template:
        die(
            "provider 'command' needs VOICE_CMD, e.g. "
            "VOICE_CMD='cosyvoice --text {text_file} --out {out} --voice {voice}'"
        )
    with tempfile.TemporaryDirectory(prefix="stylehop-voice-") as td:
        text_file = Path(td) / "line.txt"
        text_file.write_text(text, encoding="utf-8")
        out = Path(td) / "line.wav"
        fields = {
            "text": text,
            "text_file": str(text_file),
            "out": str(out),
            "voice": voice or "",
            "rate": rate or "",
            "pitch": pitch or "",
            "lang": lang or "",
        }
        try:
            args = [part.format(**fields) for part in shlex.split(template)]
            proc = subprocess.run(args, capture_output=True, text=True, timeout=300)
        except (ValueError, OSError) as e:
            die(f"VOICE_CMD could not be run: {e}")
        if proc.returncode != 0:
            tail = (proc.stderr or proc.stdout).strip().splitlines()[-3:]
            die(f"VOICE_CMD failed ({proc.returncode}): {' '.join(tail)}")
        if not out.is_file() or out.stat().st_size == 0:
            die(f"VOICE_CMD did not write {out}")
        return decode_to_mono(out)


def choose_provider(manifest: dict) -> str:
    p = str(manifest.get("provider") or "auto").lower().strip()
    if p in ("indextts2", "indextts-2", "index-tts-2", "indextts"):
        return "indextts2"
    if p in ("kokoro-zh", "kokoro_zh", "kokoro-v1.1-zh"):
        return "kokoro-zh"
    if p in ("f5", "f5-tts", "f5_tts", "f5tts"):
        return "f5"
    if p in ("chattts", "chat-tts", "chat_tts"):
        return "chattts"
    if p in ("edge", "edge-tts", "edge_tts"):
        return "edge"
    if p in ("kokoro", "kokoro-onnx", "kokoro_onnx"):
        return "kokoro"
    if p == "command":
        return "command"
    if p != "auto":
        die(f"unknown provider {p!r} (auto, indextts2, kokoro-zh, f5, chattts, edge, kokoro, command)")
    profile = str(manifest.get("profile") or manifest.get("style") or "").lower().strip()
    if profile in ("recite", "classical_poem", "ink_poem") and indextts2_available():
        return "indextts2"
    if kokoro_zh_available():
        return "kokoro-zh"
    if indextts2_available():
        return "indextts2"
    if kokoro_available():
        return "kokoro"
    if importlib.util.find_spec("edge_tts") is not None:
        return "edge"
    if os.environ.get("VOICE_CMD"):
        return "command"
    die("no TTS backend available; install indextts2, kokoro, f5-tts, edge-tts, or set VOICE_CMD")


def cache_path(cache_dir: Path, payload: dict) -> Path:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return cache_dir / (hashlib.sha256(raw).hexdigest()[:20] + ".wav")


def read_cached(path: Path) -> np.ndarray | None:
    try:
        audio, sr = sf.read(path, dtype="float32", always_2d=False)
    except Exception:
        path.unlink(missing_ok=True)
        return None
    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    if sr != SR and audio.size:
        audio = signal.resample_poly(audio, SR, sr).astype(np.float32)
    return audio


def write_cached(path: Path, audio: np.ndarray):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".voice-", suffix=".wav", dir=str(path.parent))
    os.close(fd)
    try:
        sf.write(tmp, audio, SR, subtype="PCM_16")
        os.replace(tmp, path)
    finally:
        Path(tmp).unlink(missing_ok=True)


def synthesize_raw_utterance(
    backend: str,
    text: str,
    voice: str,
    rate: str,
    pitch: str,
    lang: str,
    speed: float,
    cache_dir: Path,
    force: bool,
    ref_audio: str | None = None,
    ref_text: str | None = None,
    emo_audio: str | None = None,
    emo_text: str | None = None,
    emo_alpha: float = 0.90,
    profile: str = "narrator",
) -> np.ndarray:
    """Synthesizes and caches the raw decoded 48 kHz mono utterance prior to DSP shaping."""
    payload = {
        "raw_v": 5,
        "backend": backend,
        "text": text,
        "voice": voice,
        "rate": rate,
        "pitch": pitch,
        "lang": lang,
        "speed": speed,
        "profile": profile,
        "ref_audio": str(ref_audio or ""),
        "ref_text": str(ref_text or ""),
        "emo_audio": str(emo_audio or ""),
        "emo_text": str(emo_text or ""),
        "emo_alpha": round(float(emo_alpha), 3),
    }
    if backend == "kokoro":
        model, voices = kokoro_model_paths()
        payload["model"] = str(model.resolve()) if model.exists() else str(model)
        payload["voices"] = str(voices.resolve()) if voices.exists() else str(voices)
    elif backend == "kokoro-zh":
        payload["preset_resolved"] = KOKORO_ZH_PRESETS.get(voice.strip(), voice.strip())
    path = cache_path(cache_dir, payload)
    if not force and path.is_file():
        cached = read_cached(path)
        if cached is not None:
            return cached

    if backend == "edge":
        audio = edge_synth(text, voice, rate, pitch)
    elif backend == "kokoro":
        audio = kokoro_synth(text, voice, speed, lang)
    elif backend == "kokoro-zh":
        audio = kokoro_zh_synth(text, voice, speed)
    elif backend == "f5":
        audio = f5_synth(text, speed=speed, ref_audio=ref_audio, ref_text=ref_text)
    elif backend == "indextts2":
        audio = indextts2_synth(
            text,
            ref_audio=ref_audio,
            emo_audio=emo_audio or (ref_text if (ref_text and Path(ref_text).is_file()) else None),
            emo_text=emo_text,
            emo_alpha=emo_alpha,
            profile=profile,
        )
    elif backend == "chattts":
        audio = chattts_synth(text, voice_seed=voice)
    elif backend == "command":
        audio = command_synth(text, voice, rate, pitch, lang)
    else:
        die(f"unsupported provider {backend!r}")

    write_cached(path, audio)
    return audio


def _expand_line_clauses(
    line: dict,
    default_say: str,
    base_rate: str,
    base_pitch: str,
    base_speed: float,
    profile: str,
) -> list[dict]:
    """
    Resolves sub-clause prosody (`clauses`) for a line.
    When `clauses` is explicitly provided in `voice.json`, uses it directly.
    When `profile` is `recite`/`classical_poem` (or `caesura` is set) and the line contains
    a medial comma/semicolon, automatically splits the couplet into opening & closing hemistichs
    with a breathing pause and a deeper, slower cadence on the closing clause.
    """
    raw_clauses = line.get("clauses") or line.get("segments")
    if isinstance(raw_clauses, list) and raw_clauses:
        out = []
        n_c = len(raw_clauses)
        for idx, c in enumerate(raw_clauses):
            if isinstance(c, str):
                c = {"say": c}
            if not isinstance(c, dict):
                die(f"clause #{idx + 1} in line {line.get('id')!r} must be an object or string")
            c_say = str(c.get("say") or c.get("text") or "").strip()
            if not c_say:
                die(f"clause #{idx + 1} in line {line.get('id')!r} has no speakable text")
            is_last = idx == n_c - 1
            out.append(
                {
                    "say": c_say,
                    "voice": c.get("voice"),
                    "rate": normalize_edge_rate(c["rate"]) if "rate" in c else base_rate,
                    "pitch": normalize_edge_pitch(c["pitch"]) if "pitch" in c else base_pitch,
                    "speed": float(c.get("speed", base_speed)),
                    "pause": float(c.get("pause", 0.0 if is_last else line.get("caesura", 0.34))),
                    "gainDb": float(c.get("gainDb", -0.5 if (is_last and n_c > 1 and profile == "recite") else 0.0)),
                    "baseReverb": c.get("baseReverb", line.get("baseReverb")),
                    "tailReverb": c.get("tailReverb", line.get("tailReverb", 0.24 if is_last else 0.12)),
                    "tailExtend": float(c.get("tailExtend", line.get("tailExtend", 0.24 if is_last else 0.08))),
                    "breath": bool(c.get("breath", False)),
                }
            )
        return out

    # Only split hemistichs when `caesura` is explicitly requested on the line; otherwise preserve native full-sentence TTS prosody
    caesura = line.get("caesura")
    if caesura is not None and ("，" in default_say or "；" in default_say):
        parts = [p.strip() for p in CLAUSE_SPLIT_RE.findall(default_say) if p.strip()]
        if len(parts) >= 2:
            out = []
            for idx, part in enumerate(parts):
                is_last = idx == len(parts) - 1
                # Ensure each clause ends with terminal punctuation so TTS gives a clean clause contour
                spoken = re.sub(r"[，,；;]$", "。", part)
                out.append(
                    {
                        "say": spoken,
                        "voice": None,
                        "rate": shift_edge_rate(base_rate, -4 if is_last else 0),
                        "pitch": shift_edge_pitch(base_pitch, -2 if is_last else 0),
                        "speed": base_speed * (0.95 if is_last else 1.0),
                        "pause": 0.0 if is_last else float(caesura if caesura is not None else 0.36),
                        "gainDb": -0.5 if is_last else 0.0,
                        "baseReverb": line.get("baseReverb"),
                        "tailReverb": line.get("tailReverb", 0.24 if is_last else 0.12),
                        "tailExtend": float(line.get("tailExtend", 0.24 if is_last else 0.08)),
                        "breath": is_last,
                    }
                )
            return out

    return [
        {
            "say": default_say,
            "voice": None,
            "rate": base_rate,
            "pitch": base_pitch,
            "speed": base_speed,
            "pause": 0.0,
            "gainDb": float(line.get("gainDb", 0.0)),
            "baseReverb": line.get("baseReverb"),
            "tailReverb": line.get("tailReverb"),
            "tailExtend": float(line.get("tailExtend", 0.18 if profile == "recite" else 0.08)),
            "breath": False,
        }
    ]


def synthesize_line(
    backend: str,
    text: str,
    voice: str,
    rate: str,
    pitch: str,
    lang: str,
    speed: float,
    cache_dir: Path,
    force: bool,
    line_cfg: dict | None = None,
    profile: str = "narrator",
    target_rms_db: float = -16.8,
    ref_audio: str | None = None,
    ref_text: str | None = None,
    emo_audio: str | None = None,
    emo_text: str | None = None,
    emo_alpha: float = 0.90,
) -> np.ndarray:
    """
    Synthesizes a complete line (single utterance or multi-clause micro-assembly) with vocal DSP.
    For multi-clause lines, each non-final clause's reverb tail (`tailExtend`) rings naturally
    *inside* the inter-clause `pause` window via overlap-add, and any inhalation `breath` sits
    at the end of the pause just before the next clause begins.
    """
    line_cfg = line_cfg or {}
    clauses = _expand_line_clauses(line_cfg, text, rate, pitch, speed, profile)
    n_clauses = len(clauses)
    line_ref_audio = line_cfg.get("refAudio") or ref_audio
    line_ref_text = line_cfg.get("refText") or ref_text
    line_emo_audio = line_cfg.get("emoAudio") or emo_audio
    line_emo_text = line_cfg.get("emoText") or emo_text
    line_emo_alpha = float(line_cfg.get("emoAlpha", emo_alpha))

    clause_buffers: list[tuple[np.ndarray, int, float, bool]] = []
    for idx, cl in enumerate(clauses):
        is_last = idx == n_clauses - 1
        c_voice = str(cl.get("voice") or voice)
        raw = synthesize_raw_utterance(
            backend=backend,
            text=cl["say"],
            voice=c_voice,
            rate=cl["rate"],
            pitch=cl["pitch"],
            lang=lang,
            speed=cl["speed"],
            cache_dir=cache_dir,
            force=force,
            ref_audio=line_ref_audio,
            ref_text=line_ref_text,
            emo_audio=line_emo_audio,
            emo_text=line_emo_text,
            emo_alpha=line_emo_alpha,
            profile=profile,
        )
        tail_ext_s = float(cl.get("tailExtend", 0.20 if is_last else 0.16))
        post_roll_s = 0.160 if is_last else 0.085
        processed = finish_line(
            raw,
            profile=profile,
            gain_db=float(cl.get("gainDb", 0.0)) + float(line_cfg.get("gainDb", 0.0)),
            base_wet=cl.get("baseReverb"),
            tail_wet=cl.get("tailReverb"),
            tail_extend_s=tail_ext_s,
            target_rms_db=target_rms_db,
            post_roll_s=post_roll_s,
        )
        dry_len = max(1, processed.size - int(round(tail_ext_s * SR)))
        pause_s = float(cl.get("pause", 0.0)) if not is_last else 0.0
        clause_buffers.append((processed, dry_len, pause_s, bool(cl.get("breath", False))))

    if not clause_buffers:
        die(f"line {line_cfg.get('id', text)!r} produced no audio")
    if len(clause_buffers) == 1:
        return clause_buffers[0][0]

    # Compute overlap-add start positions so non-final reverb tails decay inside `pause_s`
    starts = [0]
    for idx in range(len(clause_buffers) - 1):
        proc, dry_len, pause_s, _ = clause_buffers[idx]
        next_start = starts[idx] + dry_len + int(round(pause_s * SR))
        starts.append(next_start)

    total_len = max(s + buf.size for s, (buf, _, _, _) in zip(starts, clause_buffers))
    out = np.zeros(total_len, dtype=np.float32)
    for idx, (s, (buf, _, _, has_breath)) in enumerate(zip(starts, clause_buffers)):
        if has_breath and idx > 0:
            breath = synth_gentle_breath(dur_s=0.12, gain=0.011, seed=100 + idx)
            b_start = max(0, s - breath.size - int(0.015 * SR))
            b_end = min(total_len, b_start + breath.size)
            out[b_start:b_end] += breath[: b_end - b_start]
        out[s : s + buf.size] += buf

    peak = float(np.max(np.abs(out)))
    if peak > PEAK:
        out *= PEAK / peak
    return out


def run_asr_check_and_words(wav_path: Path, sliced_lines: list[dict]) -> dict:
    """
    `lemo-opuscar`-style Whisper ASR verification and word-level timestamp extractor (`voice.words.json`).
    Transcribes each line window, computes character recall against `text`/`subtitle`, and outputs
    per-line and global word timestamps (`E.word(id, k)` compatible).
    """
    code = (
        "import sys, json, re, numpy as np, soundfile as sf\n"
        "from scipy import signal\n"
        "from faster_whisper import WhisperModel\n"
        "wav, sr = sf.read(sys.argv[1], dtype='float32', always_2d=False)\n"
        "wav = np.asarray(wav, dtype='float32').reshape(-1)\n"
        "lines = json.loads(open(sys.argv[2], encoding='utf-8').read())\n"
        "prompt = ' '.join(l.get('subtitle') or l.get('text') or '' for l in lines)\n"
        "try:\n"
        "    model = WhisperModel('medium', device='cuda', compute_type='float16', local_files_only=True)\n"
        "except Exception:\n"
        "    model = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=4, local_files_only=True)\n"
        "out_lines = {}\n"
        "all_words = []\n"
        "reports = []\n"
        "cjk_re = re.compile(r'[\\u4e00-\\u9fffA-Za-z0-9]')\n"
        "for l in lines:\n"
        "    lid = l['id']\n"
        "    s0 = max(0, int(round(l['start'] * sr)))\n"
        "    s1 = min(len(wav), int(round(l['end'] * sr)))\n"
        "    seg = wav[s0:s1]\n"
        "    seg16 = signal.resample_poly(seg, 16000, sr).astype('float32') if len(seg) > 0 else np.zeros(160, dtype='float32')\n"
        "    segs, _ = model.transcribe(seg16, language='zh', initial_prompt=prompt, word_timestamps=True)\n"
        "    w_list = []\n"
        "    for s in segs:\n"
        "        for w in (s.words or []):\n"
        "            wt = w.word.strip()\n"
        "            if not wt:\n"
        "                continue\n"
        "            item = {'w': wt, 's': round(l['start'] + float(w.start), 3), 'e': round(l['start'] + float(w.end), 3), 'p': round(float(w.probability), 3)}\n"
        "            w_list.append(item)\n"
        "            all_words.append({'line': lid, **item})\n"
        "    out_lines[lid] = w_list\n"
        "    heard = ''.join(x['w'] for x in w_list)\n"
        "    expected_chars = cjk_re.findall(l.get('text') or '')\n"
        "    heard_chars = set(cjk_re.findall(heard))\n"
        "    recall = round(sum(1 for c in expected_chars if c in heard_chars) / max(len(expected_chars), 1), 3)\n"
        "    avg_p = round(float(np.mean([x['p'] for x in w_list])), 3) if w_list else 0.0\n"
        "    reports.append({'id': lid, 'expected': l.get('text'), 'heard': heard, 'charRecall': recall, 'avgProb': avg_p, 'wordCount': len(w_list)})\n"
        "print(json.dumps({'lines': out_lines, 'words': all_words, 'reports': reports}, ensure_ascii=False))\n"
    )
    py_bin = VOICE312_PY if VOICE312_PY.is_file() else Path(sys.executable)
    env = os.environ.copy()
    site_nvidia = py_bin.parent.parent / "lib" / "python3.12" / "site-packages" / "nvidia"
    if site_nvidia.is_dir():
        cuda_libs = [str(p) for p in site_nvidia.glob("*/lib") if p.is_dir()]
        if cuda_libs:
            env["LD_LIBRARY_PATH"] = ":".join(cuda_libs + ([env["LD_LIBRARY_PATH"]] if env.get("LD_LIBRARY_PATH") else []))
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", encoding="utf-8", delete=False) as tf:
        json.dump(sliced_lines, tf, ensure_ascii=False)
        lines_tmp = Path(tf.name)
    try:
        proc = subprocess.run(
            [str(py_bin), "-c", code, str(wav_path), str(lines_tmp)],
            capture_output=True,
            text=True,
            env=env,
            timeout=120,
        )
        if proc.returncode != 0:
            tail = (proc.stderr or proc.stdout).strip().splitlines()[-2:]
            return {"error": " ".join(tail), "lines": {}, "words": [], "reports": []}
        lines_out = [ln.strip() for ln in proc.stdout.splitlines() if ln.strip().startswith("{")]
        return json.loads(lines_out[-1]) if lines_out else {"lines": {}, "words": [], "reports": []}
    finally:
        lines_tmp.unlink(missing_ok=True)


def write_credits_disclosure(out_dir: Path, provider: str, voice: str) -> Path:
    """Writes a transparent license disclosure file (`CREDITS.voice.txt`) following `lemo-opuscar` conventions."""
    info = PROVIDER_LICENSES.get(provider, PROVIDER_LICENSES["command"])
    resolved_preset = KOKORO_ZH_PRESETS.get(voice, "")
    voice_desc = f"{voice} ({resolved_preset})" if resolved_preset else voice
    text = (
        f"# Voice Synthesis & License Disclosure (CREDITS)\n\n"
        f"- **Provider**: `{provider}`\n"
        f"- **License Tier**: {info['badge']}\n"
        f"- **Model**: {info['model']}\n"
        f"- **Voice / Speaker**: `{voice_desc}`\n"
        f"- **Code License**: `{info['codeLicense']}`\n"
        f"- **Weights License**: `{info['weightsLicense']}`\n"
        f"- **Commercial Use Allowed**: `{'YES (可商用)' if info['commercialUse'] else 'NO (仅限开源演示/学术研究/非商业用途)'}`\n"
        f"- **Notes**: {info['notes']}\n"
    )
    credits_path = out_dir / "CREDITS.voice.txt"
    credits_path.write_text(text, encoding="utf-8")
    return credits_path


def fit_line_to_window(audio: np.ndarray, max_dur: float) -> np.ndarray:
    """
    If a multi-clause poetic line slightly exceeds `max_dur` (up to 22%), first tightens
    low-energy pause/tail regions (< -40 dBFS) and then gently time-tightens if needed.
    """
    target_n = int(round(float(max_dur) * SR))
    if audio.size <= target_n:
        return audio
    excess = audio.size - target_n
    low_mask = np.abs(audio) < db_to_amp(-40.0)
    low_count = int(np.sum(low_mask))
    if low_count > 64 and excess <= int(0.65 * SR):
        removable = min(excess, int(low_count * 0.72))
        if removable > 0:
            step = low_count / removable
            keep = np.ones(audio.size, dtype=bool)
            low_indices = np.flatnonzero(low_mask)
            drop_idx = low_indices[np.minimum(low_count - 1, (np.arange(removable) * step).astype(int))]
            keep[drop_idx] = False
            audio = audio[keep]

    if audio.size > target_n and audio.size <= int(target_n * 1.18):
        audio = signal.resample(audio, target_n).astype(np.float32)
        n_out = min(audio.size // 4, int(0.06 * SR))
        if n_out > 1:
            audio[-n_out:] *= 0.5 + 0.5 * np.cos(np.pi * np.linspace(0.0, 1.0, n_out, dtype=np.float32))
    return audio


def fmt_srt_time(t: float) -> str:
    ms = max(0, int(round(float(t) * 1000.0)))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(path: Path, lines: list[dict]):
    blocks = []
    for i, line in enumerate(lines, 1):
        blocks.append(
            f"{i}\n{fmt_srt_time(line['start'])} --> {fmt_srt_time(line['end'])}\n"
            f"{line['subtitle']}\n"
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(blocks), encoding="utf-8")


def resolve_start(line: dict, scenes: list[dict], last_end: float, scene_ends: dict, default_gap: float) -> tuple[float, dict | None]:
    at = line.get("at")
    ref = line.get("scene")
    if ref is None:
        ref = line.get("anchor")
    if isinstance(ref, str) and ref.startswith("scene:"):
        ref = ref.split(":", 1)[1]
    offset = float(line.get("offset", DEFAULT_OFFSET))
    if at is not None:
        return float(at), None
    if ref is not None:
        scene = find_scene(scenes, ref)
        key = str(scene.get("index", scene.get("id")))
        start = float(scene.get("start", 0.0)) + offset
        if key in scene_ends:
            start = max(start, scene_ends[key] + float(line.get("gap", default_gap)))
        return start, scene
    if last_end > 0.0:
        return last_end + float(line.get("gap", default_gap)), None
    return offset, None


# =============================================================================
# 3. SPECTRAL MID-SIDE DUCKING & TWO-PASS LINEAR LOUDNORM (`voice.py mix`)
# =============================================================================


def load_stereo_48k(path: Path) -> np.ndarray:
    """Loads WAV/MP4/M4A or extracts `<audio id='bg-audio' src='data:audio/mp4;base64,...'>` from HTML."""
    if not path.is_file():
        die(f"background file not found: {path}")
    if path.suffix.lower() in (".html", ".htm"):
        html = path.read_text(encoding="utf-8")
        m = re.search(r"data:audio/[a-zA-Z0-9+-]+;base64,([A-Za-z0-9+/=]+)", html)
        if not m:
            die(f"no embedded base64 <audio> found in {path}")
        with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as tf:
            tf.write(base64.b64decode(m.group(1)))
            tmp_media = Path(tf.name)
        try:
            return load_stereo_48k(tmp_media)
        finally:
            tmp_media.unlink(missing_ok=True)

    proc = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(path),
            "-f",
            "wav",
            "-ar",
            str(SR),
            "-ac",
            "2",
            "pipe:1",
        ],
        capture_output=True,
    )
    if proc.returncode != 0:
        tail = proc.stderr.decode("utf-8", "replace").strip().splitlines()[-2:]
        die(f"could not decode stereo audio from {path}: {' '.join(tail)}")
    audio, sr = sf.read(io.BytesIO(proc.stdout), dtype="float32", always_2d=True)
    if sr != SR and audio.shape[0]:
        audio = signal.resample_poly(audio, SR, sr, axis=0).astype(np.float32)
    return np.asarray(audio, dtype=np.float32)


def spectral_duck_and_mix(
    bg_stereo: np.ndarray,
    voice_mono: np.ndarray,
    duck_mid_db: float = -9.5,
    duck_low_db: float = -3.5,
    duck_side_db: float = -3.8,
    bg_trim_db: float = -4.5,
    voice_gain_db: float = 1.8,
    stereo_tail_width: float = 0.22,
    ceiling_db: float = -1.2,
) -> np.ndarray:
    """
    `lemo-opuscar` + Mid-Side Spectral Ducking Mixer:
      1. Attenuates pre-mastered background score by `bg_trim_db` (-4.5 dB) so active speech sits
         ~9.5-10 dB above background music/ambience (`-18 dB` voice vs `-27.5 dB` background).
      2. Decomposes background into Mid `M = (L+R)/2` and Side `S = (L-R)/2`.
      3. Splits `M` into Vocal Formant Core (200 Hz – 4200 Hz), Sub/Bass (<200 Hz), and Wind/Water Hiss (>4200 Hz).
      4. Lookahead (22 ms) vocal envelope with 250 ms attack / 380 ms release ducks `M_formant` by `duck_mid_db`
         (-9.5 dB), high-frequency wind/water noise by `-5.5 dB` (so consonants aren't masked by river/wind),
         bass by `duck_low_db` (-3.5 dB), and stereo Side ambience by `duck_side_db` (-3.8 dB).
      5. Adds centered vocal + subtle decorrelated stereo canyon halo (`stereo_tail_width`), then applies
         soft-knee true-peak limiting (no single-pass dynamic loudnorm pumping!).
    """
    n = bg_stereo.shape[0]
    v = np.asarray(voice_mono, dtype=np.float64).reshape(-1)
    if v.size < n:
        v = np.pad(v, (0, n - v.size))
    else:
        v = v[:n]

    lookahead = int(0.022 * SR)
    v_det = np.pad(v[lookahead:], (0, min(lookahead, v.size)))
    hop = max(1, int(0.010 * SR))
    frames = max(1, n // hop)
    rms = np.sqrt(np.mean(v_det[: frames * hop].reshape(frames, hop) ** 2, axis=1) + 1e-12)
    ref = float(np.percentile(rms, 96))
    if ref < 1e-5:
        return bg_stereo.astype(np.float32)

    target = np.clip((rms / ref - 0.025) / 0.975, 0.0, 1.0)
    ca = 1.0 - np.exp(-hop / (0.022 * SR))
    cr = 1.0 - np.exp(-hop / (0.380 * SR))
    env = np.empty_like(target)
    y = 0.0
    for i, x_val in enumerate(target):
        y += (x_val - y) * (ca if x_val > y else cr)
        env[i] = y
    env_full = np.repeat(env, hop)
    if env_full.size < n:
        env_full = np.pad(env_full, (0, n - env_full.size), constant_values=float(env_full[-1]))
    env_full = env_full[:n]

    # Pre-attenuate already-mastered background so voice leads by ~9.5 dB RMS
    bg = np.asarray(bg_stereo, dtype=np.float64) * db_to_amp(float(bg_trim_db))
    mid = 0.5 * (bg[:, 0] + bg[:, 1])
    side = 0.5 * (bg[:, 0] - bg[:, 1])

    # Split Mid into Low (<125 Hz), Vocal Formant (125 - 4200 Hz), and High Wind/Water Hiss (>4200 Hz)
    sos_low = signal.butter(2, 125.0 / (0.5 * SR), btype="low", output="sos")
    sos_high = signal.butter(2, 4200.0 / (0.5 * SR), btype="high", output="sos")
    mid_low = signal.sosfilt(sos_low, mid)
    mid_high = signal.sosfilt(sos_high, mid)
    mid_formant = mid - mid_low - mid_high

    g_formant = 1.0 - (1.0 - db_to_amp(min(0.0, float(duck_mid_db)))) * env_full
    g_low = 1.0 - (1.0 - db_to_amp(min(0.0, float(duck_low_db)))) * env_full
    g_high = 1.0 - (1.0 - db_to_amp(min(0.0, float(duck_mid_db) * 0.65))) * env_full
    g_side = 1.0 - (1.0 - db_to_amp(min(0.0, float(duck_side_db)))) * env_full

    mid_ducked = mid_formant * g_formant + mid_low * g_low + mid_high * g_high
    side_ducked = side * g_side

    out_l = mid_ducked + side_ducked
    out_r = mid_ducked - side_ducked

    # Add centered vocal (no short Haas delay by default to prevent metallic comb-filtering)
    v_scaled = v * db_to_amp(float(voice_gain_db))
    mix = np.column_stack((out_l + v_scaled, out_r + v_scaled))

    # Soft-knee true-peak transparent limiter
    ceiling = db_to_amp(float(ceiling_db))
    knee = ceiling * 0.78
    mag = np.abs(mix)
    over = mag > knee
    if np.any(over):
        sign = np.sign(mix[over])
        excess = (mag[over] - knee) / max(ceiling - knee, 1e-6)
        mix[over] = sign * (knee + (ceiling - knee) * np.tanh(excess))
    peak = float(np.max(np.abs(mix)))
    if peak > ceiling:
        mix *= ceiling / peak
    return mix.astype(np.float32)


def two_pass_loudnorm_mux(v_in: Path, wav_in: Path, v_out: Path, target_i: float = -16.0, target_tp: float = -1.5, target_lra: float = 11.0) -> dict:
    """
    `lemo-opuscar/core/render/mux.sh` Two-Pass Linear EBU R128 Loudnorm + `ebur128` verification:
      - Pass 1: Measures `input_i`, `input_tp`, `input_lra`, `input_thresh`, `target_offset`.
      - Pass 2: Applies `loudnorm=...:linear=true` so the entire mix is shifted linearly without dynamic pumping.
      - Pass 3: Verifies final MP4 audio stream with `ebur128=peak=true`.
    """
    p1 = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            "-i",
            str(wav_in),
            "-af",
            f"loudnorm=I={target_i}:TP={target_tp}:LRA={target_lra}:print_format=json",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
    )
    m_json = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p1.stderr, re.DOTALL)
    af_filter = f"loudnorm=I={target_i}:TP={target_tp}:LRA={target_lra}"
    if m_json:
        stats = json.loads(m_json.group(0))
        af_filter = (
            f"loudnorm=I={target_i}:TP={target_tp}:LRA={target_lra}:"
            f"measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:"
            f"measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:"
            f"offset={stats['target_offset']}:linear=true"
        )

    fd, tmp_mp4 = tempfile.mkstemp(prefix=".mux-", suffix=".mp4", dir=str(v_out.parent))
    os.close(fd)
    try:
        proc = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-i",
                str(v_in),
                "-i",
                str(wav_in),
                "-map",
                "0:v:0",
                "-map",
                "1:a:0",
                "-c:v",
                "copy",
                "-af",
                af_filter,
                "-ar",
                str(SR),
                "-c:a",
                "aac",
                "-b:a",
                "256k",
                "-movflags",
                "+faststart",
                "-shortest",
                tmp_mp4,
            ],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            die(f"ffmpeg two-pass mux failed: {proc.stderr.strip()}")
        os.chmod(tmp_mp4, 0o644)
        os.replace(tmp_mp4, v_out)
    finally:
        Path(tmp_mp4).unlink(missing_ok=True)

    # Verify with ebur128
    eb = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(v_out), "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True,
        text=True,
    )
    mi = re.findall(r"I:\s*([-\d.]+)\s*LUFS", eb.stderr)
    mtp = re.findall(r"Peak:\s*([-\d.]+)\s*dBFS", eb.stderr)
    mlra = re.findall(r"LRA:\s*([-\d.]+)\s*LU", eb.stderr)
    return {
        "integratedLufs": float(mi[-1]) if mi else None,
        "truePeakDbtp": float(mtp[-1]) if mtp else None,
        "lraLu": float(mlra[-1]) if mlra else None,
        "twoPassLinear": bool(m_json),
    }


# =============================================================================
# 4. CLI COMMANDS (`providers`, `build`, `audition`, `qa`, `mix`)
# =============================================================================


def providers_cmd(_args):
    """Prints the TTS provider registry with explicit commercial vs. non-commercial license badges."""
    rows = []
    for name, info in PROVIDER_LICENSES.items():
        avail = (
            indextts2_available()
            if name == "indextts2"
            else kokoro_zh_available()
            if name == "kokoro-zh"
            else kokoro_available()
            if name == "kokoro"
            else f5_available()
            if name == "f5"
            else chattts_available()
            if name == "chattts"
            else (importlib.util.find_spec("edge_tts") is not None)
            if name == "edge"
            else bool(os.environ.get("VOICE_CMD"))
        )
        rows.append({"provider": name, "available": avail, **info})
    print(json.dumps({"providers": rows, "presets": KOKORO_ZH_PRESETS}, ensure_ascii=False, indent=2))


def build(args):
    script = Path(args.script).resolve()
    manifest = read_json(script)
    if isinstance(manifest, list):
        manifest = {"lines": manifest}
    if not isinstance(manifest, dict):
        die(f"{script} must contain an object or an array of lines")
    lines = manifest.get("lines")
    if not isinstance(lines, list) or not lines:
        die(f"{script} has no 'lines' array")

    cues = read_json(Path(args.cues).resolve()) if args.cues else {}
    scenes = cues.get("scenes", []) if isinstance(cues, dict) else []
    if args.provider and args.provider != "auto":
        provider = choose_provider({**manifest, "provider": args.provider})
    else:
        provider = choose_provider(manifest)

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = Path(args.cache_dir).resolve() if args.cache_dir else script.parent / ".cache" / "voice"
    cache_dir.mkdir(parents=True, exist_ok=True)

    manifest_profile = str(
        getattr(args, "profile", None) or manifest.get("profile") or manifest.get("style") or "narrator"
    ).lower()
    target_rms_db = float(manifest.get("targetRmsDb", -16.5 if manifest_profile in ("recite", "classical_poem") else -16.8))
    gap_default = float(manifest.get("gap", DEFAULT_GAP))
    manifest_ref_audio = manifest.get("refAudio")
    manifest_ref_text = manifest.get("refText")
    manifest_emo_audio = manifest.get("emoAudio")
    manifest_emo_text = manifest.get("emoText")
    manifest_emo_alpha = float(manifest.get("emoAlpha", 0.90))
    entries = []
    seen = set()
    last_end = 0.0
    scene_ends: dict[str, float] = {}

    for i, line in enumerate(lines):
        if not isinstance(line, dict):
            die(f"line #{i + 1} is not an object")
        lid = str(line.get("id", "")).strip()
        if not lid:
            die(f"line #{i + 1} has no id")
        if lid in seen:
            die(f"duplicate line id {lid!r}")
        seen.add(lid)
        text = line.get("text")
        if not isinstance(text, str) or not text.strip():
            die(f"line {lid!r} has no text")
        say = line.get("say", text)
        if not isinstance(say, str) or not say.strip():
            die(f"line {lid!r} has no speakable text")

        lang = str(line.get("lang") or args.lang or manifest.get("lang") or default_lang(text))
        line_profile = str(line.get("profile") or line.get("style") or manifest_profile).lower()
        start, scene = resolve_start(line, scenes, last_end, scene_ends, gap_default)
        if start < 0:
            die(f"line {lid!r} starts before 0 ({start:.3f}s)")

        if provider == "edge":
            default_zh_voice = "zh-CN-YunjianNeural" if line_profile in ("recite", "classical_poem") else "zh-CN-XiaoxiaoNeural"
            voice = str(line.get("voice") or args.voice or manifest.get("voice") or (default_zh_voice if lang.lower().startswith("zh") else "en-US-EmmaMultilingualNeural"))
            rate = normalize_edge_rate(line.get("rate") or args.rate or manifest.get("rate") or line.get("speed") or manifest.get("speed"))
            pitch = normalize_edge_pitch(line.get("pitch") or args.pitch or manifest.get("pitch"))
            speed = 1.0
        elif provider == "kokoro-zh":
            default_kzh = "zm_poet" if line_profile in ("recite", "classical_poem") else "zf_001"
            voice = str(line.get("voice") or args.voice or manifest.get("voice") or default_kzh)
            speed = float(line.get("speed") or args.speed or manifest.get("speed") or (0.86 if line_profile in ("recite", "classical_poem") else 0.95))
            rate = "+0%"
            pitch = "+0Hz"
        elif provider == "indextts2":
            voice = str(line.get("voice") or args.voice or manifest.get("voice") or "indextts2_poet_master")
            speed = float(line.get("speed") or args.speed or manifest.get("speed") or 1.0)
            rate = "+0%"
            pitch = "+0Hz"
        elif provider == "f5":
            voice = str(line.get("voice") or args.voice or manifest.get("voice") or "f5_poet_baritone")
            speed = float(line.get("speed") or args.speed or manifest.get("speed") or 0.92)
            rate = "+0%"
            pitch = "+0Hz"
        elif provider == "chattts":
            voice = str(line.get("voice") or args.voice or manifest.get("voice") or "42")
            speed = float(line.get("speed") or args.speed or manifest.get("speed") or 1.0)
            rate = "+0%"
            pitch = "+0Hz"
        elif provider == "kokoro":
            voice = str(line.get("voice") or args.voice or manifest.get("voice") or ("zf_xiaoxiao" if lang.lower().startswith("zh") else "af_bella"))
            lang = normalize_kokoro_lang(lang)
            speed = float(line.get("speed") or args.speed or manifest.get("speed") or 0.95)
            rate = "+0%"
            pitch = "+0Hz"
        else:
            voice = str(line.get("voice") or args.voice or manifest.get("voice") or "")
            rate = str(line.get("rate") or args.rate or manifest.get("rate") or "+0%")
            pitch = str(line.get("pitch") or args.pitch or manifest.get("pitch") or "+0Hz")
            speed = float(line.get("speed") or args.speed or manifest.get("speed") or 0.95)

        audio = synthesize_line(
            backend=provider,
            text=say,
            voice=voice,
            rate=rate,
            pitch=pitch,
            lang=lang,
            speed=speed,
            cache_dir=cache_dir,
            force=args.force,
            line_cfg=line,
            profile=line_profile,
            target_rms_db=target_rms_db,
            ref_audio=manifest_ref_audio,
            ref_text=manifest_ref_text,
            emo_audio=manifest_emo_audio,
            emo_text=manifest_emo_text,
            emo_alpha=manifest_emo_alpha,
        )
        max_dur = line.get("maxDur")
        if max_dur is None and scene is not None:
            max_dur = max(0.0, scene_end(scene) - start - 0.08)
        if max_dur is not None:
            max_dur = float(max_dur)
            if max_dur <= 0:
                die(f"line {lid!r} has no room ({max_dur:.3f}s) at {start:.3f}s")
            audio = fit_line_to_window(audio, max_dur)
            dur = len(audio) / SR
            if dur > max_dur + 0.03:
                die(
                    f"line {lid!r} is {dur:.2f}s but its window is {max_dur:.2f}s "
                    f"(start {start:.2f}s); shorten the text, reduce pause, or raise its rate"
                )
        else:
            dur = len(audio) / SR

        metrics = compute_vocal_metrics(audio)
        subtitle = line.get("subtitle", text)
        entry = {
            "id": lid,
            "text": text,
            "subtitle": subtitle,
            "start": start,
            "end": start + dur,
            "dur": dur,
            "scene": scene.get("index", scene.get("id")) if scene is not None else None,
            "voice": voice,
            "profile": line_profile,
            "metrics": metrics,
            "audio": audio,
            "_scene_key": str(scene.get("index", scene.get("id"))) if scene is not None else None,
            "_scene_end": scene_end(scene) if scene is not None else None,
        }
        entries.append(entry)
        last_end = max(last_end, entry["end"])
        if entry["_scene_key"] is not None:
            scene_ends[entry["_scene_key"]] = max(scene_ends.get(entry["_scene_key"], 0.0), entry["end"])

    entries.sort(key=lambda e: e["start"])
    prev_end = -1.0
    for e in entries:
        if e["start"] < prev_end - 0.02:
            die(f"line {e['id']!r} overlaps the previous line ({e['start']:.3f}s < {prev_end:.3f}s)")
        prev_end = max(prev_end, e["end"])
        if e["_scene_end"] is not None and e["end"] > e["_scene_end"] + 0.03:
            die(f"line {e['id']!r} ends at {e['end']:.3f}s, after its scene ends at {e['_scene_end']:.3f}s")

    full_dur = max(
        as_float(cues.get("dur", 0.0)) if isinstance(cues, dict) else 0.0,
        as_float(manifest.get("dur", 0.0)),
        max((e["end"] for e in entries), default=0.0) + 0.25,
        0.08,
    )
    start = float(args.start or 0.0)
    dur = float(args.dur) if args.dur is not None else full_dur - start
    if start < 0 or dur <= 0:
        die(f"invalid slice start={start:.3f}s dur={dur:.3f}s")
    if start > full_dur + 0.05:
        die(f"slice starts at {start:.3f}s, after the film ends at {full_dur:.3f}s")

    n0 = int(round(start * SR))
    n1 = int(round((start + dur) * SR))
    if n1 <= n0:
        n1 = n0 + 1
    mix = np.zeros(n1 - n0, dtype=np.float32)
    sliced = []
    for e in entries:
        source = e["audio"]
        s0 = int(round(e["start"] * SR))
        s1 = s0 + source.size
        a0, a1 = max(s0, n0), min(s1, n1)
        if a1 <= a0:
            continue
        mix[a0 - n0 : a1 - n0] += source[a0 - s0 : a1 - s0]
        start_rel = (a0 - n0) / SR
        end_rel = (a1 - n0) / SR
        sliced.append(
            {
                "id": e["id"],
                "text": e["text"],
                "subtitle": e["subtitle"] if e["subtitle"] not in (None, False, "") else "",
                "start": round(start_rel, 3),
                "end": round(end_rel, 3),
                "dur": round(end_rel - start_rel, 3),
                "scene": e["scene"],
                "voice": e["voice"],
                "profile": e["profile"],
                "metrics": e["metrics"],
            }
        )

    wav_path = out_dir / "voice.wav"
    timing_path = out_dir / "voice.timing.json"
    words_path = out_dir / "voice.words.json"
    srt_path = out_dir / "voice.srt"
    sf.write(wav_path, mix, SR, subtype="PCM_16")

    primary_voice = sliced[0]["voice"] if sliced else str(manifest.get("voice", ""))
    lic_info = PROVIDER_LICENSES.get(provider, PROVIDER_LICENSES["command"])
    credits_path = write_credits_disclosure(out_dir, provider, primary_voice)

    asr_summary = None
    if getattr(args, "asr", False) or manifest.get("asrCheck", True):
        asr_data = run_asr_check_and_words(wav_path, sliced)
        words_path.write_text(json.dumps(asr_data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        rep = asr_data.get("reports", [])
        asr_summary = {
            "wordsFile": str(words_path),
            "avgCharRecall": round(float(np.mean([r["charRecall"] for r in rep])), 3) if rep else 0.0,
            "avgWordProb": round(float(np.mean([r["avgProb"] for r in rep])), 3) if rep else 0.0,
        }

    timing = {
        "version": 3,
        "provider": provider,
        "licenseBadge": lic_info["badge"],
        "commercialUse": lic_info["commercialUse"],
        "model": lic_info["model"],
        "voice": primary_voice,
        "profile": manifest_profile,
        "start": round(start, 3),
        "dur": round(dur, 3),
        "fullDur": round(full_dur, 3),
        "asr": asr_summary,
        "lines": sliced,
    }
    timing_path.write_text(json.dumps(timing, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    write_srt(srt_path, [line for line in sliced if line["subtitle"]])

    print(
        json.dumps(
            {
                "out": str(wav_path),
                "timing": str(timing_path),
                "words": str(words_path) if asr_summary else None,
                "credits": str(credits_path),
                "srt": str(srt_path),
                "provider": provider,
                "licenseBadge": lic_info["badge"],
                "commercialUse": lic_info["commercialUse"],
                "voice": primary_voice,
                "profile": manifest_profile,
                "asr": asr_summary,
                "start": round(start, 3),
                "dur": round(dur, 3),
                "lines": len(sliced),
            },
            ensure_ascii=False,
        )
    )


def audition(args):
    """Synthesizes candidate voices across commercial-free (`kokoro-zh`) and zero-shot (`f5`) models for A/B comparison."""
    text = args.text or "国破山河在，城春草木深。"
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = out_dir / ".cache"

    candidates = [
        {
            "label": "kokoro_zh_zm_poet_apache2",
            "provider": "kokoro-zh",
            "voice": "zm_poet",
            "profile": "recite",
            "speed": 0.88,
            "line_cfg": {
                "id": "aud_kzh_poet",
                "clauses": [
                    {"say": "国破，山河在。", "speed": 0.90, "pause": 0.36, "tailReverb": 0.14},
                    {"say": "城春，草木深。", "speed": 0.85, "gainDb": -0.5, "tailReverb": 0.24, "tailExtend": 0.24, "breath": True},
                ],
            },
        },
        {
            "label": "f5_tts_zero_shot_cc_by_nc",
            "provider": "f5",
            "voice": "f5_poet_baritone",
            "profile": "recite",
            "speed": 0.92,
            "line_cfg": {
                "id": "aud_f5_poet",
                "clauses": [
                    {"say": "国破，山河在。", "speed": 0.92, "pause": 0.36, "tailReverb": 0.14},
                    {"say": "城春，草木深。", "speed": 0.90, "gainDb": -0.5, "tailReverb": 0.24, "tailExtend": 0.24, "breath": True},
                ],
            },
        },
        {
            "label": "edge_yunjian_online_fallback",
            "provider": "edge",
            "voice": "zh-CN-YunjianNeural",
            "profile": "recite",
            "speed": 1.0,
            "line_cfg": {
                "id": "aud_edge",
                "clauses": [
                    {"say": "国破，山河在。", "rate": "-8%", "pitch": "-4Hz", "pause": 0.38, "tailReverb": 0.14},
                    {"say": "城春，草木深。", "rate": "-13%", "pitch": "-7Hz", "gainDb": -0.5, "tailReverb": 0.24, "tailExtend": 0.24, "breath": True},
                ],
            },
        },
    ]

    results = []
    stitched = []
    gap = np.zeros(int(0.65 * SR), dtype=np.float32)
    for c in candidates:
        prov = c["provider"]
        lic = PROVIDER_LICENSES.get(prov, PROVIDER_LICENSES["command"])
        audio = synthesize_line(
            backend=prov,
            text=text,
            voice=c["voice"],
            rate="+0%",
            pitch="+0Hz",
            lang="zh-CN",
            speed=c["speed"],
            cache_dir=cache_dir,
            force=args.force,
            line_cfg=c["line_cfg"],
            profile=c["profile"],
        )
        wav_file = out_dir / f"audition_{c['label']}.wav"
        sf.write(wav_file, audio, SR, subtype="PCM_16")
        metrics = compute_vocal_metrics(audio)
        results.append(
            {
                "label": c["label"],
                "provider": prov,
                "licenseBadge": lic["badge"],
                "commercialUse": lic["commercialUse"],
                "voice": c["voice"],
                "profile": c["profile"],
                "wav": str(wav_file),
                **metrics,
            }
        )
        stitched.extend([audio, gap])

    if stitched:
        sf.write(out_dir / "audition_comparison_all.wav", np.concatenate(stitched), SR, subtype="PCM_16")
    print(json.dumps({"text": text, "candidates": results}, ensure_ascii=False, indent=2))


def qa(args):
    """Runs acoustic, timing, and Whisper ASR quality checks on a built voice track + timing manifest."""
    wav_path = Path(args.wav).resolve()
    timing_path = Path(args.timing).resolve()
    audio, sr = sf.read(wav_path, dtype="float32", always_2d=False)
    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    if sr != SR:
        audio = signal.resample_poly(audio, SR, sr).astype(np.float32)
    timing = read_json(timing_path)

    issues = []
    rms_values = []
    line_reports = []
    sliced_lines = timing.get("lines", [])
    asr_map = {}
    if getattr(args, "asr", True):
        asr_res = run_asr_check_and_words(wav_path, sliced_lines)
        for r in asr_res.get("reports", []):
            asr_map[r["id"]] = r
            if r["charRecall"] < 0.75:
                issues.append(f"{r['id']}: low ASR character recall ({r['charRecall']} < 0.75, heard {r['heard']!r})")

    for line in sliced_lines:
        s0 = int(round(float(line["start"]) * SR))
        s1 = int(round(float(line["end"]) * SR))
        seg = audio[max(0, s0) : min(audio.size, s1)]
        m = compute_vocal_metrics(seg)
        rms_values.append(m["activeRmsDbfs"])
        if m["peakDbfs"] > -0.2:
            issues.append(f"{line['id']}: peak too hot ({m['peakDbfs']} dBFS)")
        if m["crestDb"] > 15.5:
            issues.append(f"{line['id']}: crest factor too wide ({m['crestDb']} dB > 15.5 dB)")
        if m["sibilanceRatioDb"] > -7.5:
            issues.append(f"{line['id']}: harsh sibilance ({m['sibilanceRatioDb']} dB)")
        rep_entry = {"id": line["id"], "text": line["text"], **m}
        if line["id"] in asr_map:
            rep_entry["asrHeard"] = asr_map[line["id"]]["heard"]
            rep_entry["asrCharRecall"] = asr_map[line["id"]]["charRecall"]
            rep_entry["asrProb"] = asr_map[line["id"]]["avgProb"]
        line_reports.append(rep_entry)

    rms_spread = round(max(rms_values) - min(rms_values), 2) if len(rms_values) >= 2 else 0.0
    if rms_spread > 3.5:
        issues.append(f"inter-line active RMS spread is {rms_spread} dB (> 3.5 dB)")

    print(
        json.dumps(
            {
                "ok": len(issues) == 0,
                "provider": timing.get("provider"),
                "licenseBadge": timing.get("licenseBadge"),
                "rmsSpreadDb": rms_spread,
                "issues": issues,
                "lines": line_reports,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    if issues:
        sys.exit(1)


def mix_cmd(args):
    """Mixes a processed voice WAV with a background audio/HTML/MP4 source via Mid-Side Spectral Ducking & Two-Pass Loudnorm."""
    bg_stereo = load_stereo_48k(Path(args.bg).resolve())
    voice_path = Path(args.voice).resolve()
    if not voice_path.is_file():
        die(f"voice file not found: {voice_path}")
    voice_audio, sr = sf.read(voice_path, dtype="float32", always_2d=False)
    voice_audio = np.asarray(voice_audio, dtype=np.float32)
    if voice_audio.ndim > 1:
        voice_audio = voice_audio.mean(axis=1)
    if sr != SR and voice_audio.size:
        voice_audio = signal.resample_poly(voice_audio, SR, sr).astype(np.float32)

    mixed = spectral_duck_and_mix(
        bg_stereo,
        voice_audio,
        duck_mid_db=args.duck_db,
        duck_low_db=args.duck_low_db,
        duck_side_db=args.duck_side_db,
        bg_trim_db=args.bg_trim_db,
        voice_gain_db=args.voice_gain,
        stereo_tail_width=args.stereo_width,
        ceiling_db=-1.2,
    )
    out_wav = Path(args.out).resolve()
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    sf.write(out_wav, mixed, SR, subtype="PCM_16")

    result = {
        "out": str(out_wav),
        "dur": round(mixed.shape[0] / SR, 3),
        "peakDbfs": round(amp_to_db(float(np.max(np.abs(mixed)))), 2),
        "rmsDbfs": round(amp_to_db(float(np.sqrt(np.mean(mixed ** 2)))), 2),
    }

    if args.video_in and args.video_out:
        v_in = Path(args.video_in).resolve()
        v_out = Path(args.video_out).resolve()
        v_out.parent.mkdir(parents=True, exist_ok=True)
        ebur = two_pass_loudnorm_mux(v_in, out_wav, v_out, target_i=-16.0, target_tp=-1.5, target_lra=11.0)
        result["videoOut"] = str(v_out)
        result["ebur128"] = ebur

    print(json.dumps(result, ensure_ascii=False, indent=2))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("providers", help="List available TTS providers and their commercial / non-commercial license badges")

    b = sub.add_parser("build", help="Synthesize a voice track from a voice.json manifest")
    b.add_argument("--script", required=True, help="voice.json manifest")
    b.add_argument("--cues", default=None, help="cues.json from render.mjs (needed for scene anchors)")
    b.add_argument("--out-dir", required=True, help="where voice.wav, voice.timing.json, voice.words.json, CREDITS.voice.txt and voice.srt go")
    b.add_argument("--start", type=float, default=0.0, help="slice start in seconds (single-scene renders)")
    b.add_argument("--dur", type=float, default=None, help="slice duration in seconds")
    b.add_argument("--provider", choices=("auto", "indextts2", "kokoro-zh", "f5", "chattts", "edge", "kokoro", "command"), default=None)
    b.add_argument("--voice", default=None)
    b.add_argument("--profile", default=None, help="Vocal DSP profile: recite | narrator | clean | raw")
    b.add_argument("--rate", default=None)
    b.add_argument("--pitch", default=None)
    b.add_argument("--lang", default=None)
    b.add_argument("--speed", type=float, default=None)
    b.add_argument("--cache-dir", default=None)
    b.add_argument("--asr", action="store_true", default=True, help="Run faster-whisper ASR verification & export voice.words.json")
    b.add_argument("--force", action="store_true", help="ignore cached line audio")

    aud = sub.add_parser("audition", help="Compare candidate voices and prosody profiles on a line")
    aud.add_argument("--text", default="国破山河在，城春草木深。")
    aud.add_argument("--out-dir", required=True)
    aud.add_argument("--force", action="store_true")

    q = sub.add_parser("qa", help="Run acoustic, timing & Whisper ASR QA gates on a synthesized voice track")
    q.add_argument("--wav", required=True)
    q.add_argument("--timing", required=True)
    q.add_argument("--no-asr", dest="asr", action="store_false", default=True)

    m = sub.add_parser("mix", help="Spectral Mid-Side ducking mixer + Two-Pass EBU R128 linear loudnorm")
    m.add_argument("--bg", required=True, help="Background WAV, M4A, MP4, or HTML with embedded bg-audio")
    m.add_argument("--voice", required=True, help="Synthesized voice.wav")
    m.add_argument("--out", required=True, help="Output mixed stereo WAV")
    m.add_argument("--duck-db", type=float, default=-9.5, help="Mid-channel vocal formant (200-4200Hz) ducking in dB")
    m.add_argument("--duck-low-db", type=float, default=-3.5, help="Bass (<200Hz) ducking in dB")
    m.add_argument("--duck-side-db", type=float, default=-3.8, help="Stereo Side ambience ducking in dB")
    m.add_argument("--bg-trim-db", type=float, default=-4.5, help="Pre-attenuation of pre-mastered background score so voice leads by ~9.5 dB")
    m.add_argument("--voice-gain", type=float, default=1.8, help="Voice gain in dB")
    m.add_argument("--stereo-width", type=float, default=0.22, help="Decorrelated stereo canyon reflection width")
    m.add_argument("--video-in", default=None, help="Optional input MP4 whose video stream will be muxed")
    m.add_argument("--video-out", default=None, help="Optional output MP4 path")

    args = parser.parse_args(argv)
    if args.cmd == "providers":
        providers_cmd(args)
    elif args.cmd == "build":
        build(args)
    elif args.cmd == "audition":
        audition(args)
    elif args.cmd == "qa":
        qa(args)
    elif args.cmd == "mix":
        mix_cmd(args)


if __name__ == "__main__":
    main()
