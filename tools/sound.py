#!/usr/bin/env python3
"""
StyleHop Cue-Driven Procedural Sound & Score Synthesizer (`tools/sound.py`).

Pure Python (NumPy + SciPy + stdlib `wave`) synthesizer that turns a deterministic
DOM motion cue sheet (`window.CUES` -> `cues.json`) into a mastered 48kHz 16-bit
stereo WAV soundtrack with ambient harmonic bed + frame-accurate tactile foley.

Usage:
  python3 tools/sound.py --cues cues.json --out <work-dir>/mix.wav [--preset glass|paper|cyber|ink|terminal]
"""

import argparse
import json
from pathlib import Path
import wave
import numpy as np
from scipy import signal

SR = 48000

PRESETS = {
    "glass": {
        "chords": [
            [261.63, 329.63, 392.00, 493.88, 587.33],  # Cmaj9
            [220.00, 261.63, 329.63, 392.00, 493.88],  # Am9
            [174.61, 220.00, 261.63, 349.23, 392.00],  # Fmaj9
            [196.00, 246.94, 293.66, 392.00, 440.00],  # G6/9
        ],
        "pad_gain": 0.14,
        "chime_freqs": [1046.50, 1318.51, 1567.98, 1975.53],
        "tap_freq": 880.0,
        "tick_freq": 2100.0,
    },
    "paper": {
        "chords": [
            [293.66, 369.99, 440.00, 523.25],  # D7sus
            [246.94, 329.63, 392.00, 493.88],  # Em7
            [261.63, 329.63, 392.00, 493.88],  # Cmaj7
            [220.00, 293.66, 369.99, 440.00],  # A7sus4
        ],
        "pad_gain": 0.11,
        "chime_freqs": [783.99, 987.77, 1174.66, 1567.98],
        "tap_freq": 420.0,
        "tick_freq": 1350.0,
    },
    "cyber": {
        "chords": [
            [130.81, 196.00, 261.63, 311.13, 392.00],  # Cm9
            [103.83, 155.56, 207.65, 261.63, 311.13],  # Abmaj7
            [116.54, 174.61, 233.08, 293.66, 349.23],  # Bb6
            [98.00, 146.83, 196.00, 246.94, 293.66],   # Gm7
        ],
        "pad_gain": 0.16,
        "chime_freqs": [1046.50, 1244.51, 1567.98, 2093.00],
        "tap_freq": 640.0,
        "tick_freq": 2600.0,
    },
    "ink": {
        "chords": [
            [196.00, 293.66, 392.00, 440.00, 587.33],  # G pentatonic open fifths
            [220.00, 329.63, 440.00, 493.88, 659.25],
            [164.81, 246.94, 329.63, 392.00, 493.88],
            [196.00, 293.66, 392.00, 523.25, 587.33],
        ],
        "pad_gain": 0.12,
        "chime_freqs": [587.33, 880.00, 1174.66, 1760.00],
        "tap_freq": 360.0,
        "tick_freq": 1200.0,
    },
    "terminal": {
        "chords": [
            [146.83, 220.00, 293.66, 349.23, 440.00],  # Dm
            [130.81, 196.00, 261.63, 329.63, 392.00],  # C
            [116.54, 174.61, 233.08, 293.66, 349.23],  # Bb
            [110.00, 164.81, 220.00, 277.18, 329.63],  # A
        ],
        "pad_gain": 0.13,
        "chime_freqs": [880.00, 1174.66, 1318.51, 1760.00],
        "tap_freq": 720.0,
        "tick_freq": 2400.0,
    },
    "clay": {
        "chords": [
            [261.63, 329.63, 392.00, 523.25, 659.25],  # Sunny Cmaj (Marimba / Ukulele register)
            [349.23, 440.00, 523.25, 659.25],          # Fmaj7 (Domino bridge warmth)
            [293.66, 392.00, 493.88, 587.33],          # G6 (Macaron bounce lift)
            [220.00, 329.63, 392.00, 493.88, 587.33],  # Am9 -> C resolution
        ],
        "pad_gain": 0.125,
        "chime_freqs": [659.25, 783.99, 1046.50, 1318.51],  # Kalimba / Rosewood Marimba overtones
        "tap_freq": 520.0,   # Matte polymer clay squish / wooden tabletop tap
        "tick_freq": 1680.0, # Pastel domino clack / wooden ruler tick
    },
}

PRESET_ALIASES = {
    "glass_bento": "glass",
    "clay_desk": "clay",
    "claymation": "clay",
    "riso_press": "paper",
    "ink_scroll": "ink",
    "crt_synth": "terminal",
    "blueprint_mech": "cyber",
}


def resolve_preset(name: str) -> str:
    if not name:
        return "glass"
    key = PRESET_ALIASES.get(name, name)
    return key if key in PRESETS else "glass"


def mix_into(stereo: np.ndarray, start_idx: int, mono: np.ndarray, pan: float = 0.0):
    """Mixes a mono signal into stereo buffer at `start_idx` with constant-power pan (-1..+1)."""
    if start_idx >= stereo.shape[0] or len(mono) == 0:
        return
    if start_idx < 0:
        mono = mono[-start_idx:]
        start_idx = 0
    end_idx = min(stereo.shape[0], start_idx + len(mono))
    n = end_idx - start_idx
    if n <= 0:
        return
    angle = (np.clip(pan, -1.0, 1.0) + 1.0) * (np.pi / 4.0)
    l_gain = np.cos(angle)
    r_gain = np.sin(angle)
    stereo[start_idx:end_idx, 0] += mono[:n] * l_gain
    stereo[start_idx:end_idx, 1] += mono[:n] * r_gain


def synth_ambient_bed(dur: float, scenes: list, cfg: dict, rng: np.random.Generator) -> np.ndarray:
    """Synthesizes a warm evolving stereo harmonic pad across scenes."""
    n_samples = int(round(dur * SR))
    stereo = np.zeros((n_samples, 2), dtype=np.float64)

    if not scenes:
        scenes = [{"start": 0.0, "dur": dur, "end": dur}]

    chords = cfg["chords"]
    for idx, sc in enumerate(scenes):
        start_t = float(sc.get("start", 0.0))
        sc_dur = float(sc.get("dur", max(1.0, dur - start_t)))
        pad_len = min(dur - start_t, sc_dur + 0.45)
        if pad_len <= 0.05:
            continue
        n = int(round(pad_len * SR))
        t = np.arange(n, dtype=np.float64) / SR
        chord = chords[idx % len(chords)]

        # Smooth fade-in and release envelope
        attack = np.clip(t / 0.45, 0.0, 1.0)
        release = np.clip((pad_len - t) / 0.55, 0.0, 1.0)
        env = np.sin(0.5 * np.pi * attack) * np.sin(0.5 * np.pi * release)

        left = np.zeros(n, dtype=np.float64)
        right = np.zeros(n, dtype=np.float64)
        for v_i, freq in enumerate(chord):
            detune = 1.0 + (v_i - 2) * 0.0018
            lfo = 1.0 + 0.12 * np.sin(2.0 * np.pi * (0.28 + 0.07 * v_i) * t)
            sig_l = np.sin(2.0 * np.pi * freq * t) + 0.25 * np.sin(4.0 * np.pi * freq * t)
            sig_r = np.sin(2.0 * np.pi * (freq * detune) * t + 0.4) + 0.25 * np.sin(4.0 * np.pi * (freq * detune) * t)
            weight = 0.45 / (1.0 + 0.35 * v_i)
            left += sig_l * lfo * weight
            right += sig_r * lfo * weight

        # Gentle low-pass warmth
        sos = signal.butter(2, 1600.0 / (0.5 * SR), btype="low", output="sos")
        left = signal.sosfilt(sos, left) * env * cfg["pad_gain"]
        right = signal.sosfilt(sos, right) * env * cfg["pad_gain"]

        s0 = int(round(start_t * SR))
        s1 = min(n_samples, s0 + n)
        stereo[s0:s1, 0] += left[: s1 - s0]
        stereo[s0:s1, 1] += right[: s1 - s0]

    # Subtle room air
    air = rng.standard_normal((n_samples, 2)) * 0.0012
    sos_air = signal.butter(2, [250.0 / (0.5 * SR), 3800.0 / (0.5 * SR)], btype="band", output="sos")
    stereo += signal.sosfilt(sos_air, air, axis=0)
    return stereo


def synth_scene_cut(cfg: dict, preset: str, intensity: float, idx: int, rng: np.random.Generator) -> np.ndarray:
    """Low-end sub whoosh + crystalline chime or paper turn."""
    dur = 0.68
    n = int(round(dur * SR))
    t = np.arange(n, dtype=np.float64) / SR

    # Sub-bass pitch drop (92Hz -> 44Hz)
    phase = 2.0 * np.pi * (44.0 * t + 48.0 * (1.0 - np.exp(-t / 0.14)) * 0.14)
    sub = np.sin(phase) * np.exp(-t / 0.22) * np.clip(t / 0.012, 0.0, 1.0) * 0.36

    # Filtered whoosh / paper turn noise
    noise = rng.standard_normal(n)
    cutoff = 1900.0 if preset in ("paper", "ink") else 2800.0
    sos = signal.butter(2, [180.0 / (0.5 * SR), cutoff / (0.5 * SR)], btype="band", output="sos")
    whoosh_env = np.sin(np.pi * np.clip(t / 0.32, 0.0, 1.0)) ** 2
    whoosh = signal.sosfilt(sos, noise) * whoosh_env * 0.11

    # Crystalline harmonic bell
    f0 = cfg["chime_freqs"][idx % len(cfg["chime_freqs"])]
    bell = (
        np.sin(2.0 * np.pi * f0 * t) * np.exp(-t / 0.28)
        + 0.42 * np.sin(2.0 * np.pi * (f0 * 1.5) * t) * np.exp(-t / 0.16)
        + 0.22 * np.sin(2.0 * np.pi * (f0 * 2.02) * t) * np.exp(-t / 0.09)
    ) * np.clip(t / 0.005, 0.0, 1.0) * 0.18

    return (sub + whoosh + bell) * intensity


def synth_card_enter(cfg: dict, intensity: float, idx: int, rng: np.random.Generator) -> np.ndarray:
    """Soft damped felt tap / glass resonant tick."""
    dur = 0.16
    n = int(round(dur * SR))
    t = np.arange(n, dtype=np.float64) / SR
    f0 = cfg["tap_freq"] * (1.0 + (idx % 5) * 0.055)
    body = np.sin(2.0 * np.pi * f0 * t * np.exp(-t * 8.0)) * np.exp(-t / 0.032) * 0.22
    click = rng.standard_normal(n) * np.exp(-t / 0.004) * 0.06
    sos = signal.butter(2, 2600.0 / (0.5 * SR), btype="low", output="sos")
    return signal.sosfilt(sos, body + click) * intensity


def synth_layer_float(cfg: dict, intensity: float, idx: int, rng: np.random.Generator) -> np.ndarray:
    """Airy magnetic lift shimmer for 3D floating [data-layer] cards."""
    dur = 0.42
    n = int(round(dur * SR))
    t = np.arange(n, dtype=np.float64) / SR
    f1 = cfg["chime_freqs"][(idx + 1) % len(cfg["chime_freqs"])]
    f2 = f1 * 1.25
    env = np.sin(np.pi * np.clip(t / dur, 0.0, 1.0)) * np.exp(-t / 0.24)
    shimmer = (np.sin(2.0 * np.pi * f1 * t) + 0.65 * np.sin(2.0 * np.pi * f2 * t)) * env * 0.16
    return shimmer * intensity


def synth_count_tick(cfg: dict, intensity: float, idx: int) -> np.ndarray:
    """Micro mechanical / optical counter pulse."""
    dur = 0.045
    n = int(round(dur * SR))
    t = np.arange(n, dtype=np.float64) / SR
    f0 = cfg["tick_freq"] * (1.0 + (idx % 4) * 0.04)
    tick = np.sin(2.0 * np.pi * f0 * t) * np.exp(-t / 0.008) * 0.11
    return tick * intensity


def synth_stroke_draw(preset: str, intensity: float, rng: np.random.Generator) -> np.ndarray:
    """Subtle brush/stylus friction sweep for SVG [data-draw] paths."""
    dur = 0.36
    n = int(round(dur * SR))
    t = np.arange(n, dtype=np.float64) / SR
    noise = rng.standard_normal(n)
    band = [600.0 / (0.5 * SR), 3400.0 / (0.5 * SR)] if preset in ("paper", "ink") else [900.0 / (0.5 * SR), 4800.0 / (0.5 * SR)]
    sos = signal.butter(2, band, btype="band", output="sos")
    env = np.sin(np.pi * np.clip(t / dur, 0.0, 1.0)) ** 1.4
    return signal.sosfilt(sos, noise) * env * 0.055 * intensity


def master_bus(stereo: np.ndarray, ceiling_db: float = -1.5) -> np.ndarray:
    """Applies DC block, soft-knee bus compression, and true-peak limiting (-1.5 dBTP)."""
    # High-pass at 28Hz to remove DC/rumble
    sos_hp = signal.butter(2, 28.0 / (0.5 * SR), btype="high", output="sos")
    out = signal.sosfilt(sos_hp, stereo, axis=0)

    # Soft-knee tanh saturation / RMS leveling
    rms = np.sqrt(np.mean(out ** 2) + 1e-12)
    target_rms = 0.14  # approx -17 dBFS RMS before peak limiting
    gain = np.clip(target_rms / rms, 0.5, 4.5)
    out = np.tanh(out * gain * 1.15) / 1.15

    # True-peak ceiling at -1.5 dBTP
    ceiling = 10.0 ** (ceiling_db / 20.0)
    peak = np.max(np.abs(out))
    if peak > ceiling:
        out *= ceiling / peak
    else:
        out *= min(1.35, ceiling / max(peak, 1e-6))

    # Gentle 40ms fade-in and 120ms fade-out
    n = out.shape[0]
    fi = min(n, int(0.04 * SR))
    fo = min(n, int(0.12 * SR))
    if fi > 0:
        out[:fi] *= np.linspace(0.0, 1.0, fi)[:, None]
    if fo > 0:
        out[-fo:] *= np.linspace(1.0, 0.0, fo)[:, None]

    return out


def synthesize_from_cues(cue_data: dict, preset: str = "glass", seed: int = 77) -> np.ndarray:
    rng = np.random.default_rng(seed)
    preset = resolve_preset(preset)
    cfg = PRESETS[preset]
    dur = float(cue_data.get("dur", 6.0))
    scenes = cue_data.get("scenes", [])
    cues = cue_data.get("cues", [])

    stereo = synth_ambient_bed(dur, scenes, cfg, rng)

    for idx, cue in enumerate(cues):
        t = float(cue.get("t", 0.0))
        kind = cue.get("kind", "card_enter")
        intensity = float(cue.get("intensity", 0.75))
        start_sample = int(round(t * SR))
        pan = float(((idx * 37) % 100 - 50) / 140.0)  # subtle stereo placement (-0.35 .. +0.35)

        if kind == "scene_cut":
            mono = synth_scene_cut(cfg, preset, intensity, idx, rng)
            pan = 0.0
        elif kind == "layer_float":
            mono = synth_layer_float(cfg, intensity, idx, rng)
        elif kind == "count_tick":
            mono = synth_count_tick(cfg, intensity, idx)
        elif kind == "stroke_draw":
            mono = synth_stroke_draw(preset, intensity, rng)
        else:
            mono = synth_card_enter(cfg, intensity, idx, rng)

        mix_into(stereo, start_sample, mono, pan=pan)

    return master_bus(stereo, ceiling_db=-1.5)


def write_wav(path: Path, stereo: np.ndarray):
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm16 = np.clip(stereo * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm16.tobytes())


def default_cue_sheet() -> dict:
    """Fallback 4-scene cue sheet when --cues is omitted in standalone CLI invocations."""
    return {
        "dur": 14.0,
        "scenes": [
            {"index": 0, "id": "scene-01", "start": 0.0, "dur": 3.5, "end": 3.5},
            {"index": 1, "id": "scene-02", "start": 3.5, "dur": 3.7, "end": 7.2},
            {"index": 2, "id": "scene-03", "start": 7.2, "dur": 3.6, "end": 10.8},
            {"index": 3, "id": "scene-04", "start": 10.8, "dur": 3.2, "end": 14.0},
        ],
        "cues": [
            {"t": 0.0, "kind": "scene_cut", "intensity": 0.8},
            {"t": 0.18, "kind": "card_enter", "intensity": 0.78},
            {"t": 0.42, "kind": "stroke_draw", "intensity": 0.65},
            {"t": 1.1, "kind": "layer_float", "intensity": 0.85},
            {"t": 3.5, "kind": "scene_cut", "intensity": 1.0},
            {"t": 3.72, "kind": "card_enter", "intensity": 0.75},
            {"t": 3.95, "kind": "count_tick", "intensity": 0.55},
            {"t": 4.5, "kind": "layer_float", "intensity": 0.85},
            {"t": 7.2, "kind": "scene_cut", "intensity": 1.0},
            {"t": 7.45, "kind": "card_enter", "intensity": 0.75},
            {"t": 7.8, "kind": "stroke_draw", "intensity": 0.65},
            {"t": 8.3, "kind": "layer_float", "intensity": 0.85},
            {"t": 10.8, "kind": "scene_cut", "intensity": 1.0},
            {"t": 11.05, "kind": "card_enter", "intensity": 0.75},
            {"t": 12.0, "kind": "layer_float", "intensity": 0.85},
        ],
    }


def main():
    parser = argparse.ArgumentParser(description="Cue-driven procedural sound & score synthesizer for StyleHop.")
    parser.add_argument("--cues", required=False, default=None, help="Path to cues.json extracted from window.CUES")
    parser.add_argument("--out", required=True, help="Output 48kHz stereo WAV path")
    parser.add_argument(
        "--preset",
        default="glass",
        help="Sonic palette preset (glass, clay, paper, cyber, ink, terminal, or aliases like glass_bento, clay_desk)",
    )
    args = parser.parse_args()

    if args.cues:
        cue_path = Path(args.cues)
        cue_data = json.loads(cue_path.read_text(encoding="utf-8"))
    else:
        cue_data = default_cue_sheet()

    preset = resolve_preset(cue_data.get("soundPreset") or args.preset)

    stereo = synthesize_from_cues(cue_data, preset=preset)
    out_path = Path(args.out)
    write_wav(out_path, stereo)
    peak_db = 20.0 * np.log10(max(1e-9, float(np.max(np.abs(stereo)))))
    rms_db = 20.0 * np.log10(max(1e-9, float(np.sqrt(np.mean(stereo ** 2)))))
    print(
        json.dumps(
            {
                "out": str(out_path),
                "preset": preset,
                "dur": float(cue_data.get("dur", 0)),
                "cues": len(cue_data.get("cues", [])),
                "peak_dbtp": round(peak_db, 2),
                "rms_dbfs": round(rms_db, 2),
            }
        )
    )


if __name__ == "__main__":
    main()
