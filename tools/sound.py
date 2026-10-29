#!/usr/bin/env python3
"""
StyleHop Cue-Driven Procedural Sound, Physical Modeling & Score Synthesizer (`tools/sound.py`).

Pure Python (NumPy + SciPy + stdlib `wave`) synthesizer that turns a deterministic
DOM & runtime motion cue sheet (`window.CUES` -> `cues.json`) into a mastered 48kHz 16-bit
stereo WAV soundtrack with medium-specific physical modeling instruments, rhythmic
sequencers, acoustic body Impulse Response (IR) convolution, and frame-accurate foley:

  - `ink` (`ink-wash`): Extended Karplus-Strong Guqin waveguide (`散音` open bass, `泛音`
    crystalline harmonics, `走手音/吟猱` sliding press notes) convolved with a Paulownia
    wooden soundbox IR + overblown bamboo Xiao flute (`洞箫`) + water/silk/sword foley.
  - `jazz` (`rubber-hose`): 1930s 126-BPM Swing sequencer (2:1 swing ratio) with walking
    upright bass, wire-brush snare groove, nonlinear waveshaped Wah-Wah plunger-muted brass
    stabs & trombone glissando, cartoon foley, and 1930s optical film / 78rpm shellac patina.
  - `clay` (`clay-macaron`): Euler-Bernoulli modal synthesis rosewood marimba & kalimba tine
    arpeggiator + matte polymer clay squish & woodblock tabletop foley.
  - `paper` (`paper-popup`): Plucked acoustic harp/guitar harmonics + multi-stage cardstock
    crease, pop-up snap, and page-turn foley.
  - `twilight` (`twilight-fable`): Celesta bell-tine modal synth + warm felt-piano chords +
    bioluminescent night-forest breeze shimmer.
  - `glass` / `cyber` / `terminal`: Modern crystalline / synth harmonic beds & UI foley.

Usage:
  python3 tools/sound.py --cues cues.json --out <work-dir>/mix.wav [--preset ink|jazz|clay|paper|twilight|glass|cyber|terminal]
"""

import argparse
import json
from pathlib import Path
import wave
import numpy as np
from scipy import signal

SR = 48000

PRESETS = {
    "ink": {
        "scale": [146.83, 164.81, 196.00, 220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33],  # D/G Guqin pentatonic
        "chords": [
            [98.00, 146.83, 196.00, 293.66, 392.00],   # G2 - D3 - G3 - D4 - G4 (散音五度)
            [110.00, 164.81, 220.00, 329.63, 440.00],  # A2 - E3 - A3 - E4 - A4
            [82.41, 123.47, 164.81, 246.94, 329.63],   # E2 - B2 - E3 - B3 - E4
            [98.00, 146.83, 220.00, 293.66, 440.00],   # G2 - D3 - A3 - D4 - A4
        ],
        "pad_gain": 0.14,
        "chime_freqs": [587.33, 880.00, 1174.66, 1567.98],
        "tap_freq": 340.0,
        "tick_freq": 1180.0,
    },
    "jazz": {
        "bpm": 126.0,
        "chords": [
            [116.54, 146.83, 174.61, 207.65, 261.63],  # Bb6/7
            [98.00, 123.47, 146.83, 174.61, 220.00],   # G7
            [130.81, 155.56, 196.00, 233.08, 293.66],  # Cm9
            [174.61, 220.00, 261.63, 311.13, 392.00],  # F13
        ],
        "bass_walk": [
            [116.54, 146.83, 174.61, 185.00],  # Bb2 - D3 - F3 - F#3
            [196.00, 164.81, 146.83, 123.47],  # G3 - E3 - D3 - B2
            [130.81, 146.83, 155.56, 164.81],  # C3 - D3 - Eb3 - E3
            [174.61, 146.83, 130.81, 110.00],  # F3 - D3 - C3 - A2
        ],
        "pad_gain": 0.16,
        "chime_freqs": [466.16, 587.33, 698.46, 880.00],
        "tap_freq": 480.0,
        "tick_freq": 1850.0,
    },
    "clay": {
        "chords": [
            [261.63, 329.63, 392.00, 523.25, 659.25],  # Sunny Cmaj6/9
            [349.23, 440.00, 523.25, 659.25],          # Fmaj7
            [293.66, 392.00, 493.88, 587.33],          # G6
            [220.00, 329.63, 392.00, 493.88, 587.33],  # Am9 -> C
        ],
        "pad_gain": 0.14,
        "chime_freqs": [659.25, 783.99, 1046.50, 1318.51],
        "tap_freq": 520.0,
        "tick_freq": 1680.0,
    },
    "paper": {
        "chords": [
            [293.66, 369.99, 440.00, 587.33, 659.25],  # Dadd9
            [246.94, 329.63, 392.00, 493.88, 587.33],  # Em7
            [196.00, 293.66, 392.00, 493.88, 659.25],  # Gmaj9
            [220.00, 293.66, 369.99, 440.00, 587.33],  # A6sus4
        ],
        "pad_gain": 0.13,
        "chime_freqs": [783.99, 987.77, 1174.66, 1567.98],
        "tap_freq": 420.0,
        "tick_freq": 1350.0,
    },
    "twilight": {
        "chords": [
            [261.63, 329.63, 392.00, 493.88, 587.33],  # Cmaj9
            [220.00, 261.63, 329.63, 392.00, 493.88],  # Am9
            [174.61, 220.00, 261.63, 349.23, 440.00],  # Fmaj13
            [196.00, 246.94, 293.66, 392.00, 587.33],  # Gadd9
        ],
        "pad_gain": 0.14,
        "chime_freqs": [1046.50, 1318.51, 1567.98, 1975.53],
        "tap_freq": 620.0,
        "tick_freq": 1950.0,
    },
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
}

PRESET_ALIASES = {
    "glass_bento": "glass",
    "clay_desk": "clay",
    "claymation": "clay",
    "clay-macaron": "clay",
    "riso_press": "paper",
    "paper-popup": "paper",
    "ink_scroll": "ink",
    "ink-wash": "ink",
    "rubber-hose": "jazz",
    "swing": "jazz",
    "twilight-fable": "twilight",
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


# =============================================================================
# 1. ACOUSTIC BODY & SPACE IMPULSE RESPONSE (IR) CONVOLUTION ENGINE
# =============================================================================

_IR_CACHE = {}


def build_body_ir(ir_kind: str) -> np.ndarray:
    """Builds a procedural physical-cavity + room early-reflection Impulse Response."""
    if ir_kind in _IR_CACHE:
        return _IR_CACHE[ir_kind]

    rng = np.random.default_rng(abs(hash(ir_kind)) % 100000)
    if ir_kind == "guqin_wood":
        # Hollowed aged Paulownia & Catalpa wood cavity (桐木梓木琴腔) + mountain canyon air tail
        n = int(0.85 * SR)
        t = np.arange(n, dtype=np.float64) / SR
        ir = np.zeros(n, dtype=np.float64)
        ir[0] = 0.55
        modes = [
            (116.0, 0.22, 0.085),
            (238.0, 0.30, 0.068),
            (412.0, 0.26, 0.052),
            (740.0, 0.18, 0.036),
            (1320.0, 0.12, 0.024),
            (2380.0, 0.07, 0.015),
        ]
        for freq, amp, tau in modes:
            ir += amp * np.sin(2.0 * np.pi * freq * t) * np.exp(-t / tau)
        # Early canyon reflections + airy silk tail
        for delay_ms, gain in [(19.0, 0.16), (43.0, -0.11), (88.0, 0.08), (154.0, 0.05)]:
            idx = int(delay_ms * 0.001 * SR)
            if idx < n:
                ir[idx] += gain
        tail = rng.standard_normal(n) * np.exp(-t / 0.28) * 0.012
        sos = signal.butter(2, [180.0 / (0.5 * SR), 3200.0 / (0.5 * SR)], btype="band", output="sos")
        ir += signal.sosfilt(sos, tail)
    elif ir_kind == "vintage_horn":
        # 1930s acoustic brass / gramophone horn formant + studio slapback
        n = int(0.28 * SR)
        t = np.arange(n, dtype=np.float64) / SR
        ir = np.zeros(n, dtype=np.float64)
        ir[0] = 0.62
        for freq, amp, tau in [(510.0, 0.28, 0.018), (1180.0, 0.34, 0.014), (2150.0, 0.24, 0.011), (3100.0, 0.14, 0.008)]:
            ir += amp * np.sin(2.0 * np.pi * freq * t) * np.exp(-t / tau)
        for delay_ms, gain in [(14.0, -0.18), (38.0, 0.14), (72.0, 0.07)]:
            idx = int(delay_ms * 0.001 * SR)
            if idx < n:
                ir[idx] += gain
    elif ir_kind == "marimba_resonator":
        # Warm rosewood resonator tube + cozy tabletop reflection
        n = int(0.32 * SR)
        t = np.arange(n, dtype=np.float64) / SR
        ir = np.zeros(n, dtype=np.float64)
        ir[0] = 0.68
        for freq, amp, tau in [(262.0, 0.26, 0.042), (524.0, 0.18, 0.028), (1048.0, 0.09, 0.016)]:
            ir += amp * np.sin(2.0 * np.pi * freq * t) * np.exp(-t / tau)
        for delay_ms, gain in [(11.0, 0.14), (27.0, -0.09)]:
            idx = int(delay_ms * 0.001 * SR)
            if idx < n:
                ir[idx] += gain
    else:
        # `forest_canyon`: Dreamy twilight glade early reflections + lush shimmer tail
        n = int(0.95 * SR)
        t = np.arange(n, dtype=np.float64) / SR
        ir = np.zeros(n, dtype=np.float64)
        ir[0] = 0.60
        for delay_ms, gain in [(23.0, 0.18), (51.0, 0.14), (108.0, 0.10), (195.0, 0.07), (310.0, 0.045)]:
            idx = int(delay_ms * 0.001 * SR)
            if idx < n:
                ir[idx] += gain
        tail = rng.standard_normal(n) * np.exp(-t / 0.36) * 0.014
        sos = signal.butter(2, [240.0 / (0.5 * SR), 4200.0 / (0.5 * SR)], btype="band", output="sos")
        ir += signal.sosfilt(sos, tail)

    energy = np.sqrt(np.sum(ir ** 2) + 1e-12)
    ir = ir / max(energy, 1.0)
    _IR_CACHE[ir_kind] = ir
    return ir


def convolve_body_ir(sig: np.ndarray, ir_kind: str, wet: float = 0.45) -> np.ndarray:
    """Convolves a 1D or 2D audio signal with a physical body/space IR via `fftconvolve`."""
    ir = build_body_ir(ir_kind)
    if sig.ndim == 1:
        conv = signal.fftconvolve(sig, ir, mode="full")[: len(sig)]
        return (1.0 - wet) * sig + wet * conv
    out = np.zeros_like(sig)
    out[:, 0] = (1.0 - wet) * sig[:, 0] + wet * signal.fftconvolve(sig[:, 0], ir, mode="full")[: sig.shape[0]]
    # Slightly decorrelated right channel IR for natural stereo width
    ir_r = np.roll(ir, 11)
    out[:, 1] = (1.0 - wet) * sig[:, 1] + wet * signal.fftconvolve(sig[:, 1], ir_r, mode="full")[: sig.shape[0]]
    return out


# =============================================================================
# 2. MEDIUM-SPECIFIC PHYSICAL MODELING & SCORE ENGINES
# =============================================================================


def synth_guqin_note(
    freq: float,
    dur: float,
    mode: str,
    rng: np.random.Generator,
    slide_ratio: float = 1.125,
) -> np.ndarray:
    """
    Extended Karplus-Strong & modal waveguide for Chinese seven-string Guqin (`古琴`):
      - `open` (`散音`): Deep silk-string pluck with strong fundamental & woody resonance
      - `harmonic` (`泛音`): Crystalline 7th/9th-hui octave/fifth harmonic chime
      - `slide` (`走手音 / 吟猱`): Expressive pitch-gliding press note with silk fingerboard friction
    """
    n = int(round(dur * SR))
    t = np.arange(n, dtype=np.float64) / SR

    if mode == "harmonic":
        # 泛音: Pure high-order harmonic nodes (octave + 12th + double octave) with fingernail transient
        f0 = freq * 2.0
        pluck_click = rng.standard_normal(n) * np.exp(-t / 0.004) * 0.14
        sos_click = signal.butter(2, [900.0 / (0.5 * SR), 4200.0 / (0.5 * SR)], btype="band", output="sos")
        click = signal.sosfilt(sos_click, pluck_click)
        env = np.clip(t / 0.006, 0.0, 1.0) * np.exp(-t / (dur * 0.58))
        harm = (
            0.68 * np.sin(2.0 * np.pi * f0 * t)
            + 0.28 * np.sin(2.0 * np.pi * (f0 * 1.5008) * t + 0.3) * np.exp(-t / (dur * 0.35))
            + 0.14 * np.sin(2.0 * np.pi * (f0 * 2.002) * t + 0.7) * np.exp(-t / (dur * 0.22))
        )
        return (harm * env + click) * 0.38

    if mode == "slide":
        # 走手音 + 吟猱: Pitch glides smoothly from `freq` to `freq * slide_ratio` with 5.4 Hz Yin-Nao vibrato
        glide_curve = 0.5 - 0.5 * np.cos(np.pi * np.clip((t - 0.08) / max(0.18, dur * 0.42), 0.0, 1.0))
        yin_nao = 0.008 * np.sin(2.0 * np.pi * 5.4 * t) * np.clip((t - 0.15) / 0.25, 0.0, 1.0)
        inst_freq = freq * (1.0 + (slide_ratio - 1.0) * glide_curve + yin_nao)
        phase = 2.0 * np.pi * np.cumsum(inst_freq) / SR

        out = np.zeros(n, dtype=np.float64)
        for k in range(1, 9):
            # Inharmonicity of silk string + faster high-partial damping
            harm_decay = np.exp(-t / (dur * (0.68 / (k ** 0.65))))
            amp = (0.58 / (k ** 1.15)) * (1.0 + 0.25 * np.sin(k * 1.3))
            out += amp * np.sin(k * phase) * harm_decay

        # Silk string sliding friction (`走手擦弦声`) during the pitch glide window
        slide_win = np.exp(-((t - 0.22) / 0.14) ** 2)
        friction = rng.standard_normal(n) * slide_win * 0.055
        sos_fr = signal.butter(2, [700.0 / (0.5 * SR), 2900.0 / (0.5 * SR)], btype="band", output="sos")
        out += signal.sosfilt(sos_fr, friction)
        attack = np.clip(t / 0.005, 0.0, 1.0)
        return out * attack * 0.46

    # Default `open` (`散音`): Extended Karplus-Strong delay-line waveguide
    delay_samples = max(8, int(round(SR / max(freq, 45.0))))
    # Pluck excitation: filtered noise burst + warm fundamental half-sine pluck shape
    excite = rng.standard_normal(delay_samples) * 0.65
    u = np.linspace(0.0, 1.0, delay_samples)
    excite += 0.85 * np.sin(np.pi * u) + 0.35 * np.sin(2.0 * np.pi * u)
    excite -= np.mean(excite)

    buf = np.zeros(n, dtype=np.float64)
    buf[:delay_samples] = excite
    # Silk string low-pass loop damping
    damping = 0.9965 if freq < 180.0 else 0.9945
    blend = 0.32  # silk string warmth (more lowpass than steel string)
    for i in range(delay_samples, n):
        prev0 = buf[i - delay_samples]
        prev1 = buf[i - delay_samples + 1] if (i - delay_samples + 1) < i else prev0
        buf[i] = damping * ((1.0 - blend) * prev0 + blend * prev1)

    # Layer subtle sub-body warmth for Guqin open bass
    body_sub = 0.24 * np.sin(2.0 * np.pi * freq * t) * np.exp(-t / (dur * 0.65))
    return (buf * 0.42 + body_sub) * np.clip(t / 0.003, 0.0, 1.0)


def synth_xiao_phrase(freq: float, dur: float, rng: np.random.Generator) -> np.ndarray:
    """Synthesizes an airy Chinese vertical bamboo flute (`洞箫`) phrase with breath turbulence & vibrato."""
    n = int(round(dur * SR))
    t = np.arange(n, dtype=np.float64) / SR
    attack = np.clip(t / 0.32, 0.0, 1.0)
    release = np.clip((dur - t) / 0.42, 0.0, 1.0)
    env = (np.sin(0.5 * np.pi * attack) ** 1.4) * np.sin(0.5 * np.pi * release)

    # Abdominal vibrato (`腹震音`) that blooms after 0.35s
    vib = 0.0055 * np.sin(2.0 * np.pi * 4.8 * t) * np.clip((t - 0.35) / 0.3, 0.0, 1.0)
    phase = 2.0 * np.pi * np.cumsum(freq * (1.0 + vib)) / SR

    pipe = (
        0.62 * np.sin(phase)
        + 0.24 * np.sin(2.0 * phase + 0.4)
        + 0.14 * np.sin(3.0 * phase + 1.1)
        + 0.05 * np.sin(4.0 * phase)
    )
    # Chiff / edge-tone breath noise around 1.2kHz - 3.4kHz
    breath = rng.standard_normal(n) * (0.045 + 0.035 * np.exp(-t / 0.18))
    sos = signal.butter(2, [950.0 / (0.5 * SR), 3200.0 / (0.5 * SR)], btype="band", output="sos")
    breath_filt = signal.sosfilt(sos, breath)
    return (pipe + breath_filt) * env * 0.22


def synth_taiko_impact(intensity: float, rng: np.random.Generator) -> np.ndarray:
    """
    Synthesizes a heavy Chinese Da-Tang-Gu / War Taiko drum slam (`重低音大堂鼓/太鼓轰击`):
      - Pitch-dropping sub-bass skin membrane fundamental (92Hz -> 44Hz)
      - Inharmonic circular membrane modes (1.59x, 2.14x) + wooden shell cavity resonance
      - Heavy leather mallet transient & rim crack
    """
    dur = 1.45
    n = int(round(dur * SR))
    t = np.arange(n, dtype=np.float64) / SR
    f_env = 44.0 + 52.0 * np.exp(-t / 0.045)
    phase = 2.0 * np.pi * np.cumsum(f_env) / SR

    sub_skin = np.sin(phase) * np.exp(-t / 0.38) * 0.62
    mode2 = np.sin(1.59 * phase + 0.3) * np.exp(-t / 0.19) * 0.28
    mode3 = np.sin(2.14 * phase + 0.8) * np.exp(-t / 0.11) * 0.15

    # Mallet impact transient & drumhead roar
    noise = rng.standard_normal(n)
    sos_thump = signal.butter(2, [65.0 / (0.5 * SR), 420.0 / (0.5 * SR)], btype="band", output="sos")
    sos_crack = signal.butter(2, [950.0 / (0.5 * SR), 3400.0 / (0.5 * SR)], btype="band", output="sos")
    thump = signal.sosfilt(sos_thump, noise) * np.exp(-t / 0.055) * 0.32
    crack = signal.sosfilt(sos_crack, noise) * np.exp(-t / 0.014) * 0.22

    attack = np.clip(t / 0.0025, 0.0, 1.0)
    sig = (sub_skin + mode2 + mode3 + thump + crack) * attack
    return np.tanh(sig * 1.45) * 0.72 * intensity


def synth_qin_strumming_slash(chord: list, dur: float, intensity: float, rng: np.random.Generator) -> np.ndarray:
    """
    Synthesizes a fierce martial Guqin/Pipa strumming roll (`古琴滚拂 / 琵琶杀伐扫弦摧音`):
    Rapid 7-string cascade with fingernail scrape transient, metallic string buzz (`煞音`), and urgent tremolando.
    """
    n = int(round(dur * SR))
    out = np.zeros(n, dtype=np.float64)
    base_freqs = list(chord) + [chord[0] * 2.0, chord[1] * 2.0]

    # 1. Rapid initial 7-string sweep (`杀伐滚拂扫弦`, 16ms inter-string cascade)
    for s_idx, f_str in enumerate(base_freqs):
        s_off = int(round(s_idx * 0.016 * SR))
        if s_off >= n:
            break
        rem_dur = max(0.25, dur - s_idx * 0.016)
        note = synth_guqin_note(f_str, rem_dur, "open", rng)
        t_n = np.arange(len(note), dtype=np.float64) / SR
        # Add fierce Pipa/Guqin fingernail attack & string-fret buzz (`杀伐煞音`)
        nail = rng.standard_normal(len(note)) * np.exp(-t_n / 0.006) * 0.18
        sos_nail = signal.butter(2, [1400.0 / (0.5 * SR), 5800.0 / (0.5 * SR)], btype="band", output="sos")
        buzz = np.tanh(note * 2.8) * 0.38 + signal.sosfilt(sos_nail, nail)
        end_i = min(n, s_off + len(note))
        out[s_off:end_i] += (note[: end_i - s_off] * 0.75 + buzz[: end_i - s_off]) * (0.85 + 0.05 * s_idx)

    # 2. Secondary urgent martial tremolando / reverse sweep (`拂弦余威`) at +0.36s and +0.74s
    for accent_t, gain in [(0.36, 0.68), (0.74, 0.52)]:
        if accent_t + 0.3 < dur:
            for s_idx, f_str in enumerate(reversed(base_freqs[:5])):
                s_off = int(round((accent_t + s_idx * 0.012) * SR))
                if s_off >= n:
                    break
                note = synth_guqin_note(f_str * 1.5, min(0.95, dur - accent_t), "slide", rng, slide_ratio=1.06)
                end_i = min(n, s_off + len(note))
                out[s_off:end_i] += note[: end_i - s_off] * gain

    return out * 0.58 * intensity


def _infer_ink_scene_mood(sc: dict, idx: int, total_scenes: int, cues: list) -> str:
    """Resolves the dramatic score mood (`serene | suspend | kill_burst | vast_aftermath`) for an ink scene."""
    explicit = str(sc.get("mood") or "").strip().lower()
    if explicit in ("serene", "suspend", "kill_burst", "vast_aftermath"):
        return explicit

    sc_id = f"{sc.get('id', '')} {sc.get('title', '')}".lower()
    start_t = float(sc.get("start", 0.0))
    end_t = float(sc.get("end", start_t + float(sc.get("dur", 4.0))))
    sc_cues = [
        f"{c.get('kind', '')}:{c.get('label', '')}".lower()
        for c in (cues or [])
        if start_t - 0.05 <= float(c.get("t", -1.0)) <= end_t + 0.05
    ]
    joined_cues = " ".join(sc_cues)

    if any(k in joined_cues for k in ("blade_cleave", "blood_splatter", "calligraphy_slam", "taiko_impact")) or any(
        k in sc_id for k in ("kill", "burst", "sha", "climax")
    ):
        return "kill_burst"
    if "blade_clique" in joined_cues or any(k in sc_id for k in ("suspend", "tense", "unsheathe", "heng", "kneel")):
        return "suspend"
    if "blade_sheathe" in joined_cues or any(k in sc_id for k in ("aftermath", "sheathe", "qianli", "gone")):
        return "vast_aftermath"
    return "serene"


def synth_ink_guqin_bed(
    dur: float,
    scenes: list,
    cfg: dict,
    rng: np.random.Generator,
    cues: list = None,
) -> np.ndarray:
    """
    Synthesizes a Scene-Dramatic Song-Yuan Guqin, Xiao Flute & Wuxia War-Drum Score (`Scene Dramatic Score Envelope`):
      - `serene` (`平缓疏朗`): Sparse Guqin open bass (`散音`), expressive sliding `走手吟猱`, and pine breeze breathing space.
      - `suspend` (`肃杀蓄力`): Tense press-slide decrescendo into a **0.45s–0.60s absolute breathless silence hold (`silence hold`)**.
      - `kill_burst` (`杀伐爆发`): **0.45s anticipation silence** followed by **Da-Tang-Gu war drum (`taiko_impact`) + fierce Guqin/Pipa strumming (`qin_strumming_slash`)**.
      - `vast_aftermath` (`收刀拉远 · 余韵`): Intimate quiet opening for sword sheathing -> deep open bass & cascading harmonics (`泛音`) dissolving into mountain wind.
    """
    n_samples = int(round(dur * SR))
    stereo = np.zeros((n_samples, 2), dtype=np.float64)
    climax_stereo = np.zeros((n_samples, 2), dtype=np.float64)
    silence_mask = np.ones(n_samples, dtype=np.float64)
    wind_mask = np.ones(n_samples, dtype=np.float64)

    if not scenes:
        scenes = [{"start": 0.0, "dur": dur, "end": dur}]

    chords = cfg["chords"]
    for idx, sc in enumerate(scenes):
        start_t = float(sc.get("start", 0.0))
        sc_dur = float(sc.get("dur", max(1.0, dur - start_t)))
        end_t = min(dur, start_t + sc_dur)
        chord = chords[idx % len(chords)]
        mood = _infer_ink_scene_mood(sc, idx, len(scenes), cues or [])

        if mood == "suspend":
            # Find `blade_clique` cue inside scene if present, else place silence window in the final third
            clique_t = None
            for c in cues or []:
                ct = float(c.get("t", -1.0))
                ck = f"{c.get('kind', '')}:{c.get('label', '')}".lower()
                if start_t <= ct <= end_t and ("blade_clique" in ck or "unsheathe" in ck):
                    clique_t = ct - start_t
                    break
            sil_end_local = clique_t if clique_t is not None else min(sc_dur - 0.45, sc_dur * 0.72)
            sil_start_local = max(0.65, sil_end_local - 0.56)

            # Opening tense Guqin open fifth + low sliding press note before the silence hold
            n_open = synth_guqin_note(chord[0], min(sil_start_local + 0.15, 1.65), "open", rng) * 0.85
            mix_into(stereo, int(round(start_t * SR)), n_open, pan=-0.20)
            if sil_start_local > 0.75:
                n_slide = synth_guqin_note(chord[1], sil_start_local - 0.35, "slide", rng, slide_ratio=16.0 / 15.0) * 0.78
                mix_into(stereo, int(round((start_t + 0.38) * SR)), n_slide, pan=0.18)

            # Carve out the 0.55s breathless silence hold (`绝对屏息死寂`)
            s0 = max(0, int(round((start_t + sil_start_local) * SR)))
            s1 = min(n_samples, int(round((start_t + min(sc_dur, sil_end_local + 0.25)) * SR)))
            fade_len = min(int(0.12 * SR), max(1, (s1 - s0) // 4))
            if s1 > s0:
                silence_mask[s0:s1] = 0.0
                if s0 - fade_len >= 0:
                    silence_mask[s0 - fade_len : s0] = np.linspace(1.0, 0.0, fade_len)
                wind_mask[max(0, s0 - fade_len) : min(n_samples, int(round(end_t * SR)))] = 0.05

        elif mood == "kill_burst":
            # Find burst timestamp (default +0.45s anticipation stillness -> burst!)
            burst_local = 0.46
            for c in cues or []:
                ct = float(c.get("t", -1.0))
                ck = f"{c.get('kind', '')}:{c.get('label', '')}".lower()
                if start_t + 0.15 <= ct <= end_t and any(
                    w in ck for w in ("blade_cleave", "taiko_impact", "kill", "burst")
                ):
                    burst_local = clamp_val = max(0.35, min(1.1, ct - start_t))
                    break

            # 1. 0.45s Anticipation Silence Hold (`蓄力绝对静默`)
            s0 = max(0, int(round(start_t * SR)))
            s1 = min(n_samples, int(round((start_t + burst_local) * SR)))
            if s1 > s0:
                silence_mask[s0:s1] = 0.0
                wind_mask[s0:s1] = 0.0

            # 2. Explosive Burst: Heavy Taiko War Drum + Fierce Guqin/Pipa Strumming Slash!
            burst_idx = int(round((start_t + burst_local) * SR))
            taiko_main = synth_taiko_impact(1.0, rng)
            mix_into(climax_stereo, burst_idx, taiko_main, pan=0.0)

            rem_dur = max(1.2, sc_dur - burst_local)
            qin_slash = synth_qin_strumming_slash(chord, rem_dur, 0.96, rng)
            mix_into(climax_stereo, burst_idx, qin_slash, pan=-0.12)
            mix_into(climax_stereo, burst_idx + int(0.018 * SR), qin_slash * 0.82, pan=0.22)

            # Secondary war-drum punctuation hits syncing with calligraphy slam
            for sub_off, sub_int, sub_pan in [(0.42, 0.78, -0.18), (0.88, 0.85, 0.18)]:
                if burst_local + sub_off + 0.3 < sc_dur:
                    mix_into(
                        climax_stereo,
                        int(round((start_t + burst_local + sub_off) * SR)),
                        synth_taiko_impact(sub_int, rng),
                        pan=sub_pan,
                    )

        elif mood == "vast_aftermath":
            # Keep first ~1.15s quiet & intimate so close-up slow-motion `blade_sheathe` rings out clearly
            sheathe_window = min(1.15, sc_dur * 0.32)
            s0 = max(0, int(round(start_t * SR)))
            s1 = min(n_samples, int(round((start_t + sheathe_window * 0.85) * SR)))
            if s1 > s0:
                silence_mask[s0:s1] = 0.18

            # At `start_t + sheathe_window`, as camera pulls back (2.4x -> 1.0x), bloom deep Guqin open bass + cascading harmonics + lone Xiao flute
            reveal_t = start_t + sheathe_window
            rem = max(1.5, end_t - reveal_t)
            n_open = synth_guqin_note(chord[0], min(3.8, rem), "open", rng) * 0.95
            mix_into(stereo, int(round(reveal_t * SR)), n_open, pan=-0.18)

            if rem > 1.4:
                n_slide = synth_guqin_note(chord[2], min(3.0, rem - 0.3), "slide", rng, slide_ratio=9.0 / 8.0) * 0.85
                mix_into(stereo, int(round((reveal_t + 0.45) * SR)), n_slide, pan=0.16)

            for h_i, h_off in enumerate([0.25, 0.92, 1.65, 2.38, 3.10]):
                if sheathe_window + h_off + 0.3 < sc_dur:
                    h_freq = chord[(h_i + 1) % len(chord)]
                    n_harm = synth_guqin_note(h_freq, 1.95, "harmonic", rng) * (0.92 - 0.1 * h_i)
                    pan = -0.35 if (h_i % 2 == 0) else 0.35
                    mix_into(stereo, int(round((reveal_t + h_off) * SR)), n_harm, pan=pan)

            if rem > 1.6:
                xiao = synth_xiao_phrase(chord[3], min(3.2, rem - 0.4), rng) * 0.92
                mix_into(stereo, int(round((reveal_t + 0.55) * SR)), xiao, pan=0.24)

        else:
            # Default `serene`: Unhurried Song-Yuan mountain scroll (`古琴散音/走手吟猱 + 松风留白`)
            n_open = synth_guqin_note(chord[0], min(3.4, sc_dur * 0.95), "open", rng)
            mix_into(stereo, int(round(start_t * SR)), n_open, pan=-0.22)

            if sc_dur > 1.2:
                n_slide = synth_guqin_note(chord[2], min(2.8, sc_dur - 0.5), "slide", rng, slide_ratio=9.0 / 8.0)
                mix_into(stereo, int(round((start_t + 0.68) * SR)), n_slide, pan=0.18)

            # Sparse, unhurried harmonics (2 gentle notes instead of a mechanical 4-note metronome)
            for h_i, h_off in enumerate([1.55, 2.68]):
                if h_off + 0.35 < sc_dur:
                    h_freq = chord[(h_i + 2) % len(chord)]
                    n_harm = synth_guqin_note(h_freq, 1.75, "harmonic", rng) * 0.85
                    pan = -0.30 if (h_i % 2 == 0) else 0.30
                    mix_into(stereo, int(round((start_t + h_off) * SR)), n_harm, pan=pan)

            if sc_dur > 1.9:
                xiao_freq = chord[3] if idx % 2 == 0 else chord[4]
                xiao = synth_xiao_phrase(xiao_freq, min(2.5, sc_dur - 0.8), rng) * 0.85
                mix_into(stereo, int(round((start_t + 0.95) * SR)), xiao, pan=0.25 if idx % 2 == 0 else -0.25)

    # Convolve melodic Guqin/Xiao stems with Paulownia wood cavity IR, then enforce `silence_mask`
    stereo = convolve_body_ir(stereo, "guqin_wood", wet=0.46)
    stereo *= silence_mask[:, None]

    # Add climax war-drum & martial strumming with lighter canyon room reflection so transients stay razor-sharp
    if np.max(np.abs(climax_stereo)) > 1e-6:
        climax_stereo = convolve_body_ir(climax_stereo, "guqin_wood", wet=0.22)
        stereo += climax_stereo

    # Mountain pine wind & silk stream ambience (`松风呼吸`), gated by `wind_mask * silence_mask`
    t_all = np.arange(n_samples, dtype=np.float64) / SR
    breeze_mod = 0.55 + 0.45 * np.sin(2.0 * np.pi * 0.19 * t_all)
    wind = rng.standard_normal((n_samples, 2)) * 0.0032 * breeze_mod[:, None]
    sos_wind = signal.butter(2, [220.0 / (0.5 * SR), 1450.0 / (0.5 * SR)], btype="band", output="sos")
    stereo += signal.sosfilt(sos_wind, wind, axis=0) * (wind_mask * silence_mask)[:, None]
    return stereo


def synth_wah_brass_note(freq: float, dur: float, wah_open: float, rng: np.random.Generator, gliss: float = 0.0) -> np.ndarray:
    """
    Synthesizes a 1930s Fleischer-style Wah-Wah plunger-muted trumpet/trombone note:
    Nonlinear brass lip-reed waveshaper + dynamic formant bandpass swept by the plunger mute.
    """
    n = int(round(dur * SR))
    t = np.arange(n, dtype=np.float64) / SR
    # Optional trombone glissando + playful vibrato
    vib = 0.007 * np.sin(2.0 * np.pi * 6.2 * t) * np.clip((t - 0.08) / 0.12, 0.0, 1.0)
    glide = gliss * (1.0 - np.exp(-t / max(0.06, dur * 0.4)))
    inst_f = freq * (1.0 + glide + vib)
    phase = 2.0 * np.pi * np.cumsum(inst_f) / SR

    # Rich brass sawtooth/lip-reed excitation via tanh waveshaping
    raw = np.sin(phase) + 0.55 * np.sin(2.0 * phase + 0.2) + 0.35 * np.sin(3.0 * phase)
    brass = np.tanh(raw * 2.4)

    # Two-stage plunger-mute formant (closed "doo" ~520Hz + open "wah" ~1850Hz)
    sos_closed = signal.butter(2, [340.0 / (0.5 * SR), 820.0 / (0.5 * SR)], btype="band", output="sos")
    sos_open = signal.butter(2, [950.0 / (0.5 * SR), 2650.0 / (0.5 * SR)], btype="band", output="sos")
    closed_sig = signal.sosfilt(sos_closed, brass)
    open_sig = signal.sosfilt(sos_open, brass)

    # Plunger envelope sweeps from closed -> open -> closed ("dwaa-ooh")
    wah_env = np.clip(wah_open * np.sin(np.pi * np.clip(t / max(0.08, dur * 0.78), 0.0, 1.0)) ** 1.3, 0.0, 1.0)
    voiced = (1.0 - wah_env) * closed_sig + wah_env * open_sig * 1.35

    # Breath attack transient
    lip_buzz = rng.standard_normal(n) * np.exp(-t / 0.012) * 0.08
    amp_env = np.clip(t / 0.012, 0.0, 1.0) * np.exp(-t / (dur * 0.72)) * np.clip((dur - t) / 0.025, 0.0, 1.0)
    return (voiced + lip_buzz) * amp_env * 0.32


def synth_upright_bass_note(freq: float, dur: float, rng: np.random.Generator) -> np.ndarray:
    """Synthesizes a woody pizzicato upright double-bass quarter note with fingerboard slap."""
    n = int(round(dur * SR))
    t = np.arange(n, dtype=np.float64) / SR
    env = np.clip(t / 0.006, 0.0, 1.0) * np.exp(-t / 0.24)
    body = (
        0.72 * np.sin(2.0 * np.pi * freq * t)
        + 0.42 * np.sin(4.0 * np.pi * freq * t + 0.3) * np.exp(-t / 0.14)
        + 0.18 * np.sin(6.0 * np.pi * freq * t) * np.exp(-t / 0.08)
    )
    # Woody finger slap at attack
    slap = rng.standard_normal(n) * np.exp(-t / 0.008) * 0.12
    sos = signal.butter(2, [650.0 / (0.5 * SR), 2200.0 / (0.5 * SR)], btype="band", output="sos")
    return body * env * 0.38 + signal.sosfilt(sos, slap)


def synth_jazz_swing_bed(dur: float, scenes: list, cfg: dict, rng: np.random.Generator) -> np.ndarray:
    """
    Synthesizes a 1930s Fleischer / Broadway 126 BPM Swing band score:
      - Walking Upright Bass on every beat (1 - 2 - 3 - 4)
      - Wire-Brush Snare & Swung Ride/Hi-Hat groove (2:1 triplet swing grid: `1, 2-and, 3, 4-and`)
      - Syncopated Wah-Wah Plunger-Muted Brass section stabs & playful melody hooks
      - 1930s optical sound-on-film horn character & subtle 78rpm shellac crackle
    """
    n_samples = int(round(dur * SR))
    stereo = np.zeros((n_samples, 2), dtype=np.float64)
    bpm = float(cfg.get("bpm", 126.0))
    beat_sec = 60.0 / bpm
    swing_off = beat_sec * 0.667  # 2:1 triplet swing subdivision

    bass_bars = cfg["bass_walk"]
    chords = cfg["chords"]
    total_beats = int(np.ceil(dur / beat_sec))

    # Pre-build wire-brush snare & hi-hat filters
    sos_brush = signal.butter(2, [1400.0 / (0.5 * SR), 6800.0 / (0.5 * SR)], btype="band", output="sos")
    sos_hat = signal.butter(2, 5200.0 / (0.5 * SR), btype="high", output="sos")

    for b in range(total_beats):
        t_beat = b * beat_sec
        if t_beat >= dur:
            break
        bar_idx = (b // 4) % len(bass_bars)
        beat_in_bar = b % 4

        # 1. Walking Upright Bass on every beat
        bass_f = bass_bars[bar_idx][beat_in_bar]
        bass_note = synth_upright_bass_note(bass_f, beat_sec * 0.92, rng)
        mix_into(stereo, int(round(t_beat * SR)), bass_note, pan=-0.15)

        # 2. Wire-Brush Snare & Hi-Hat Swing Groove
        # Downbeat brush tap
        n_tap = int(0.11 * SR)
        t_tap = np.arange(n_tap, dtype=np.float64) / SR
        brush_hit = signal.sosfilt(sos_brush, rng.standard_normal(n_tap)) * np.exp(-t_tap / 0.032) * 0.085
        if beat_in_bar in (1, 3):
            # Accent backbeat on 2 and 4 with crisp snare wire + foot hi-hat chick
            snare_body = np.sin(2.0 * np.pi * 185.0 * t_tap * np.exp(-t_tap * 6.0)) * np.exp(-t_tap / 0.038) * 0.14
            hat_chick = signal.sosfilt(sos_hat, rng.standard_normal(n_tap)) * np.exp(-t_tap / 0.018) * 0.075
            mix_into(stereo, int(round(t_beat * SR)), brush_hit * 1.35 + snare_body + hat_chick, pan=0.18)
        else:
            mix_into(stereo, int(round(t_beat * SR)), brush_hit, pan=0.16)

        # Swung triplet upbeat ("skip" note on 2-and, 4-and)
        if beat_in_bar in (1, 3) and (t_beat + swing_off) < dur:
            skip_hit = signal.sosfilt(sos_hat, rng.standard_normal(n_tap)) * np.exp(-t_tap / 0.024) * 0.078
            mix_into(stereo, int(round((t_beat + swing_off) * SR)), skip_hit, pan=0.22)

        # 3. Syncopated Wah-Wah Plunger-Muted Brass Stabs & Melody Hooks
        chord = chords[bar_idx]
        if beat_in_bar == 0:
            # Downbeat muted horn chord stab ("dwaa!")
            for v_i, f_v in enumerate(chord[1:4]):
                horn = synth_wah_brass_note(f_v * 2.0, beat_sec * 0.58, wah_open=0.85, rng=rng)
                mix_into(stereo, int(round(t_beat * SR)), horn * 0.42, pan=-0.28 + 0.22 * v_i)
        elif beat_in_bar == 1 and (t_beat + swing_off) < dur:
            # Swung upbeat brass answer on "2-and"
            lead_f = chord[3] * 2.0
            horn = synth_wah_brass_note(lead_f, beat_sec * 0.65, wah_open=0.95, rng=rng, gliss=0.06)
            mix_into(stereo, int(round((t_beat + swing_off) * SR)), horn * 0.55, pan=0.26)
        elif beat_in_bar == 3:
            # Playful trombone turnaround glissando at end of bar
            tb_f = chord[2] * 1.5
            gliss_dir = 0.12 if (bar_idx % 2 == 0) else -0.10
            tb = synth_wah_brass_note(tb_f, beat_sec * 0.78, wah_open=0.75, rng=rng, gliss=gliss_dir)
            mix_into(stereo, int(round(t_beat * SR)), tb * 0.48, pan=-0.24)

    # Convolve with 1930s vintage horn & studio slapback IR
    stereo = convolve_body_ir(stereo, "vintage_horn", wet=0.36)

    # 4. Subtle 78rpm shellac record warmth & micro-crackle
    crackle_mask = rng.random(n_samples) < 0.0018
    crackle = crackle_mask.astype(np.float64) * rng.normal(0.0, 0.018, n_samples)
    sos_cr = signal.butter(2, [1200.0 / (0.5 * SR), 5500.0 / (0.5 * SR)], btype="band", output="sos")
    crackle = signal.sosfilt(sos_cr, crackle)
    stereo[:, 0] += crackle
    stereo[:, 1] += crackle * 0.9
    return stereo


def synth_marimba_note(freq: float, dur: float, rng: np.random.Generator) -> np.ndarray:
    """Euler-Bernoulli modal synthesis for a rosewood Marimba bar (`1 : 3.98 : 9.18` overtones)."""
    n = int(round(dur * SR))
    t = np.arange(n, dtype=np.float64) / SR
    # Yarn mallet strike transient
    strike = rng.standard_normal(n) * np.exp(-t / 0.0035) * 0.09
    sos = signal.butter(2, [400.0 / (0.5 * SR), 3200.0 / (0.5 * SR)], btype="band", output="sos")
    strike = signal.sosfilt(sos, strike)

    modes = (
        0.74 * np.sin(2.0 * np.pi * freq * t) * np.exp(-t / 0.26)
        + 0.22 * np.sin(2.0 * np.pi * (freq * 3.98) * t + 0.4) * np.exp(-t / 0.055)
        + 0.06 * np.sin(2.0 * np.pi * (freq * 9.18) * t + 1.1) * np.exp(-t / 0.018)
    )
    return (modes * np.clip(t / 0.002, 0.0, 1.0) + strike) * 0.34


def synth_clay_marimba_bed(dur: float, scenes: list, cfg: dict, rng: np.random.Generator) -> np.ndarray:
    """Synthesizes a cozy stop-motion Rosewood Marimba & Kalimba arpeggiated score (`clay-macaron`)."""
    n_samples = int(round(dur * SR))
    stereo = np.zeros((n_samples, 2), dtype=np.float64)
    step_sec = 60.0 / 112.0 / 2.0  # 112 BPM eighth-note grid
    chords = cfg["chords"]
    total_steps = int(np.ceil(dur / step_sec))
    arp_pattern = [0, 2, 1, 3, 2, 4, 1, 2]

    for s in range(total_steps):
        t_s = s * step_sec
        if t_s >= dur:
            break
        bar_idx = (s // 8) % len(chords)
        chord = chords[bar_idx]
        deg = arp_pattern[s % len(arp_pattern)] % len(chord)
        freq = chord[deg]
        note = synth_marimba_note(freq, 0.42, rng)
        pan = -0.26 + 0.13 * (s % 5)
        mix_into(stereo, int(round(t_s * SR)), note, pan=pan)

        # Every 4th step, add a warm bass marimba root
        if s % 4 == 0:
            bass = synth_marimba_note(chord[0] * 0.5, 0.58, rng) * 0.85
            mix_into(stereo, int(round(t_s * SR)), bass, pan=0.0)

    return convolve_body_ir(stereo, "marimba_resonator", wet=0.40)


def synth_paper_harp_bed(dur: float, scenes: list, cfg: dict, rng: np.random.Generator) -> np.ndarray:
    """Synthesizes an acoustic plucked harp/guitar harmonic bed for `paper-popup`."""
    n_samples = int(round(dur * SR))
    stereo = np.zeros((n_samples, 2), dtype=np.float64)
    step_sec = 0.34
    chords = cfg["chords"]
    total_steps = int(np.ceil(dur / step_sec))

    for s in range(total_steps):
        t_s = s * step_sec
        if t_s >= dur:
            break
        chord = chords[(s // 6) % len(chords)]
        freq = chord[s % len(chord)]
        pluck = synth_guqin_note(freq, 0.95, "open", rng) * 0.68
        pan = -0.30 if (s % 2 == 0) else 0.30
        mix_into(stereo, int(round(t_s * SR)), pluck, pan=pan)

    return convolve_body_ir(stereo, "marimba_resonator", wet=0.35)


def synth_twilight_celesta_bed(dur: float, scenes: list, cfg: dict, rng: np.random.Generator) -> np.ndarray:
    """Synthesizes a dreamy Celesta bell-tine + warm felt-piano lullaby for `twilight-fable`."""
    # Start with warm low-passed felt-piano harmonic pad
    stereo = synth_ambient_bed(dur, scenes, cfg, rng) * 0.82
    chords = cfg["chords"]
    step_sec = 0.48
    total_steps = int(np.ceil(dur / step_sec))

    for s in range(total_steps):
        t_s = s * step_sec
        if t_s >= dur:
            break
        chord = chords[(s // 6) % len(chords)]
        f0 = chord[(s * 2) % len(chord)] * 2.0
        n = int(0.88 * SR)
        t = np.arange(n, dtype=np.float64) / SR
        # Celesta bell-tine modal overtones (fundamental + 5th + inharmonic bell partial 2.76x)
        env = np.clip(t / 0.005, 0.0, 1.0) * np.exp(-t / 0.34)
        tine = (
            0.65 * np.sin(2.0 * np.pi * f0 * t)
            + 0.24 * np.sin(2.0 * np.pi * (f0 * 2.0) * t) * np.exp(-t / 0.18)
            + 0.11 * np.sin(2.0 * np.pi * (f0 * 2.756) * t) * np.exp(-t / 0.09)
        ) * env * 0.18
        pan = np.sin(s * 0.9) * 0.35
        mix_into(stereo, int(round(t_s * SR)), tine, pan=pan)

    return convolve_body_ir(stereo, "forest_canyon", wet=0.46)


def synth_ambient_bed(dur: float, scenes: list, cfg: dict, rng: np.random.Generator) -> np.ndarray:
    """Synthesizes a warm evolving stereo harmonic pad across scenes (for glass/cyber/terminal)."""
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

        sos = signal.butter(2, 1600.0 / (0.5 * SR), btype="low", output="sos")
        left = signal.sosfilt(sos, left) * env * cfg["pad_gain"]
        right = signal.sosfilt(sos, right) * env * cfg["pad_gain"]

        s0 = int(round(start_t * SR))
        s1 = min(n_samples, s0 + n)
        stereo[s0:s1, 0] += left[: s1 - s0]
        stereo[s0:s1, 1] += right[: s1 - s0]

    air = rng.standard_normal((n_samples, 2)) * 0.0012
    sos_air = signal.butter(2, [250.0 / (0.5 * SR), 3800.0 / (0.5 * SR)], btype="band", output="sos")
    stereo += signal.sosfilt(sos_air, air, axis=0)
    return stereo


# =============================================================================
# 3. FRAME-ACCURATE SEMANTIC FOLEY & SCENE TRANSITION CUES
# =============================================================================


def synth_scene_cut(cfg: dict, preset: str, intensity: float, idx: int, rng: np.random.Generator) -> np.ndarray:
    """Medium-authentic scene transition cue: Guqin harmonic gliss, Jazz rimshot/brass, or multi-stage cardstock fold."""
    if preset == "ink":
        # Guqin 7th-hui harmonic chime + soft Xuan-paper scroll unfurl
        chord = cfg["chords"][idx % len(cfg["chords"])]
        harm = synth_guqin_note(chord[2], 1.15, "harmonic", rng)
        n = len(harm)
        t = np.arange(n, dtype=np.float64) / SR
        scroll = rng.standard_normal(n) * (np.sin(np.pi * np.clip(t / 0.45, 0.0, 1.0)) ** 2) * 0.055
        sos = signal.butter(2, [280.0 / (0.5 * SR), 1900.0 / (0.5 * SR)], btype="band", output="sos")
        return (harm + signal.sosfilt(sos, scroll)) * intensity

    if preset == "jazz":
        # Crisp drum rimshot + muted brass flourish
        f0 = cfg["chime_freqs"][idx % len(cfg["chime_freqs"])]
        brass = synth_wah_brass_note(f0, 0.48, wah_open=0.92, rng=rng, gliss=0.08)
        n = len(brass)
        t = np.arange(n, dtype=np.float64) / SR
        rim = np.sin(2.0 * np.pi * 390.0 * t * np.exp(-t * 14.0)) * np.exp(-t / 0.022) * 0.25
        return (brass + rim) * intensity

    if preset == "paper":
        # Multi-layered cardstock page turn & pop-up snap (`立体书翻页与卡纸弹起`)
        dur = 0.62
        n = int(round(dur * SR))
        t = np.arange(n, dtype=np.float64) / SR
        noise = rng.standard_normal(n)
        sos = signal.butter(2, [550.0 / (0.5 * SR), 3600.0 / (0.5 * SR)], btype="band", output="sos")
        # Three distinct paper-fold friction bursts + crisp pop-up lock snap
        env = (
            0.7 * np.exp(-((t - 0.08) / 0.045) ** 2)
            + 1.0 * np.exp(-((t - 0.24) / 0.08) ** 2)
            + 0.85 * np.exp(-((t - 0.42) / 0.035) ** 2)
        )
        paper_turn = signal.sosfilt(sos, noise) * env * 0.16
        f0 = cfg["chime_freqs"][idx % len(cfg["chime_freqs"])]
        snap = np.sin(2.0 * np.pi * f0 * t) * np.exp(-t / 0.14) * 0.14
        return (paper_turn + snap) * intensity

    dur = 0.68
    n = int(round(dur * SR))
    t = np.arange(n, dtype=np.float64) / SR
    phase = 2.0 * np.pi * (44.0 * t + 48.0 * (1.0 - np.exp(-t / 0.14)) * 0.14)
    sub = np.sin(phase) * np.exp(-t / 0.22) * np.clip(t / 0.012, 0.0, 1.0) * 0.36
    noise = rng.standard_normal(n)
    sos = signal.butter(2, [180.0 / (0.5 * SR), 2800.0 / (0.5 * SR)], btype="band", output="sos")
    whoosh_env = np.sin(np.pi * np.clip(t / 0.32, 0.0, 1.0)) ** 2
    whoosh = signal.sosfilt(sos, noise) * whoosh_env * 0.11
    f0 = cfg["chime_freqs"][idx % len(cfg["chime_freqs"])]
    bell = (
        np.sin(2.0 * np.pi * f0 * t) * np.exp(-t / 0.28)
        + 0.42 * np.sin(2.0 * np.pi * (f0 * 1.5) * t) * np.exp(-t / 0.16)
        + 0.22 * np.sin(2.0 * np.pi * (f0 * 2.02) * t) * np.exp(-t / 0.09)
    ) * np.clip(t / 0.005, 0.0, 1.0) * 0.18
    return (sub + whoosh + bell) * intensity


def synth_card_enter(cfg: dict, intensity: float, idx: int, rng: np.random.Generator) -> np.ndarray:
    """Soft damped felt tap / woodblock / resonant tick."""
    dur = 0.16
    n = int(round(dur * SR))
    t = np.arange(n, dtype=np.float64) / SR
    f0 = cfg["tap_freq"] * (1.0 + (idx % 5) * 0.055)
    body = np.sin(2.0 * np.pi * f0 * t * np.exp(-t * 8.0)) * np.exp(-t / 0.032) * 0.22
    click = rng.standard_normal(n) * np.exp(-t / 0.004) * 0.06
    sos = signal.butter(2, 2600.0 / (0.5 * SR), btype="low", output="sos")
    return signal.sosfilt(sos, body + click) * intensity


def synth_layer_float(cfg: dict, intensity: float, idx: int, rng: np.random.Generator) -> np.ndarray:
    """Airy magnetic lift shimmer for floating [data-layer] cards."""
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
    """Calligraphic wolf-hair brush sweep on raw Xuan paper (`毛笔扫纸沙沙声`) or stylus friction."""
    dur = 0.38
    n = int(round(dur * SR))
    t = np.arange(n, dtype=np.float64) / SR
    noise = rng.standard_normal(n)
    band = [480.0 / (0.5 * SR), 3200.0 / (0.5 * SR)] if preset in ("paper", "ink") else [900.0 / (0.5 * SR), 4800.0 / (0.5 * SR)]
    sos = signal.butter(2, band, btype="band", output="sos")
    env = np.sin(np.pi * np.clip(t / dur, 0.0, 1.0)) ** 1.3
    return signal.sosfilt(sos, noise) * env * 0.075 * intensity


def synth_runtime_foley(kind: str, preset: str, intensity: float, rng: np.random.Generator) -> np.ndarray:
    """Synthesizes semantic action foley emitted at runtime by 2D/3D characters and world primitives."""
    if kind == "blade_clique":
        # Thumb pushes sword guard open an inch of cold steel (`拇指推锷寸许出鞘寒鸣`)
        dur = 0.56
        n = int(round(dur * SR))
        t = np.arange(n, dtype=np.float64) / SR
        # 1. Bronze sword-guard (`剑格/吞口`) thumb-release mechanical click at t=0..0.025s
        guard_click = (
            np.sin(2.0 * np.pi * 940.0 * t * np.exp(-t * 18.0)) * np.exp(-t / 0.014) * 0.24
            + np.sin(2.0 * np.pi * 2480.0 * t) * np.exp(-t / 0.008) * 0.18
        )
        # 2. 1-inch cold steel sliding against scabbard mouth (`寸许出鞘金属刮擦`) at t=0.012..0.12s
        scrape_env = np.exp(-((t - 0.052) / 0.034) ** 2) * np.clip((t - 0.008) / 0.012, 0.0, 1.0)
        sos_scrape = signal.butter(2, [2200.0 / (0.5 * SR), 6800.0 / (0.5 * SR)], btype="band", output="sos")
        scrape = signal.sosfilt(sos_scrape, rng.standard_normal(n)) * scrape_env * 0.22
        # 3. High-Q forged steel crystalline modal ring (`寒芒清越余鸣`) hanging in the silence
        ring_env = np.clip((t - 0.018) / 0.006, 0.0, 1.0) * np.exp(-np.maximum(0.0, t - 0.018) / 0.24)
        f_sweep = 1.0 + 0.018 * np.exp(-np.maximum(0.0, t - 0.018) / 0.04)
        ring = (
            0.28 * np.sin(2.0 * np.pi * 2640.0 * f_sweep * t)
            + 0.22 * np.sin(2.0 * np.pi * 4180.0 * f_sweep * t + 0.4)
            + 0.14 * np.sin(2.0 * np.pi * 6850.0 * t) * np.exp(-t / 0.15)
            + 0.08 * np.sin(2.0 * np.pi * 9120.0 * t) * np.exp(-t / 0.09)
        ) * ring_env
        return (guard_click + scrape + ring) * intensity

    if kind == "blade_cleave":
        # Lethal Wuxia heavy blade air-cleave + high-frequency metallic ring + low-frequency air shockwave (`破空斩击+高频金属铮鸣+低频气浪`)
        dur = 0.68
        n = int(round(dur * SR))
        t = np.arange(n, dtype=np.float64) / SR
        noise = rng.standard_normal(n)
        # 1. Low-frequency air displacement shockwave (`低频破空气浪`)
        f_sub = 54.0 + 135.0 * np.exp(-t / 0.042)
        phase_sub = 2.0 * np.pi * np.cumsum(f_sub) / SR
        sub_wave = np.sin(phase_sub) * np.exp(-t / 0.14) * np.clip(t / 0.003, 0.0, 1.0) * 0.42
        # 2. Fast Doppler air-cleave whip (`凌厉刀风破空`)
        sos_low_whip = signal.butter(2, [280.0 / (0.5 * SR), 1850.0 / (0.5 * SR)], btype="band", output="sos")
        sos_hi_whip = signal.butter(2, [1800.0 / (0.5 * SR), 6400.0 / (0.5 * SR)], btype="band", output="sos")
        whip_env = np.exp(-((t - 0.055) / 0.045) ** 2) + 0.45 * np.exp(-((t - 0.12) / 0.075) ** 2)
        whip = (
            signal.sosfilt(sos_low_whip, noise) * whip_env * 0.30
            + signal.sosfilt(sos_hi_whip, noise) * np.exp(-((t - 0.048) / 0.032) ** 2) * 0.26
        )
        # 3. High-frequency forged blade lethal ring (`高频白刃铮鸣`)
        ring_env = np.clip((t - 0.02) / 0.004, 0.0, 1.0) * (0.65 * np.exp(-t / 0.26) + 0.35 * np.exp(-t / 0.48))
        shimmer = 1.0 + 0.18 * np.sin(2.0 * np.pi * 24.0 * t)
        steel_ring = (
            0.24 * np.sin(2.0 * np.pi * 1920.0 * t)
            + 0.20 * np.sin(2.0 * np.pi * 3140.0 * t + 0.7)
            + 0.15 * np.sin(2.0 * np.pi * 5120.0 * t + 1.3)
            + 0.09 * np.sin(2.0 * np.pi * 7480.0 * t) * np.exp(-t / 0.16)
        ) * ring_env * shimmer
        return (sub_wave + whip + steel_ring) * intensity

    if kind == "blood_splatter":
        # Explosive thick ink / arterial splatter + heavy body collapse onto ground (`浓墨朱砂飞溅与敌手重物坠地`)
        dur = 0.62
        n = int(round(dur * SR))
        t = np.arange(n, dtype=np.float64) / SR
        noise = rng.standard_normal(n)
        # 1. Arterial / wet ink burst (`朱砂浓墨喷溅`, t=0.00..0.24s)
        sos_wet = signal.butter(2, [620.0 / (0.5 * SR), 4800.0 / (0.5 * SR)], btype="band", output="sos")
        wet_env = np.exp(-((t - 0.035) / 0.028) ** 2)
        for drop_t, drop_g in ((0.075, 0.65), (0.115, 0.48), (0.165, 0.32), (0.21, 0.22)):
            wet_env += drop_g * np.exp(-((t - drop_t) / 0.014) ** 2)
        splatter = signal.sosfilt(sos_wet, noise) * wet_env * 0.28
        # 2. Heavy struck silhouette collapsing to the ground (`受创剪影倾倒坠地闷响`, t=0.15..0.55s)
        t_fall = np.maximum(0.0, t - 0.15)
        fall_gate = (t >= 0.15).astype(np.float64) * np.clip(t_fall / 0.006, 0.0, 1.0)
        f_thud = 46.0 + 78.0 * np.exp(-t_fall / 0.045)
        phase_thud = 2.0 * np.pi * np.cumsum(f_thud) / SR
        body_thud = np.sin(phase_thud) * np.exp(-t_fall / 0.13) * fall_gate * 0.36
        sos_cloth = signal.butter(2, [180.0 / (0.5 * SR), 1200.0 / (0.5 * SR)], btype="band", output="sos")
        cloth_rustle = signal.sosfilt(sos_cloth, noise) * np.exp(-((t - 0.19) / 0.08) ** 2) * 0.16
        return (splatter + body_thud + cloth_rustle) * intensity

    if kind == "calligraphy_slam":
        # Wild cursive heavy brush slamming onto Xuan paper + flying-white bristle tear (`狂草重笔砸纸+飞白裂痕扫擦`)
        dur = 0.54
        n = int(round(dur * SR))
        t = np.arange(n, dtype=np.float64) / SR
        noise = rng.standard_normal(n)
        # 1. Heavy brush-heel impact onto stretched Xuan paper (`重笔砸纸闷响`)
        f_slam = 62.0 + 95.0 * np.exp(-t / 0.030)
        phase_slam = 2.0 * np.pi * np.cumsum(f_slam) / SR
        slam_thud = np.sin(phase_slam) * np.exp(-t / 0.075) * np.clip(t / 0.003, 0.0, 1.0) * 0.34
        # 2. Aggressive flying-white wolf-hair bristle tear (`焦墨飞白疾扫裂纸声`)
        sos_body = signal.butter(2, [420.0 / (0.5 * SR), 1900.0 / (0.5 * SR)], btype="band", output="sos")
        sos_bristle = signal.butter(2, [2100.0 / (0.5 * SR), 6400.0 / (0.5 * SR)], btype="band", output="sos")
        ripple = 0.78 + 0.22 * np.sin(2.0 * np.pi * 32.0 * t)
        sweep_env = np.clip(t / 0.015, 0.0, 1.0) * np.exp(-np.maximum(0.0, t - 0.04) / 0.18) * ripple
        tear = (
            signal.sosfilt(sos_body, noise) * sweep_env * 0.24
            + signal.sosfilt(sos_bristle, noise) * sweep_env * 0.20
        )
        return (slam_thud + tear) * intensity

    if kind == "blade_sheathe":
        # Slow-motion metallic slide into scabbard + crisp collar lock snap (`慢动作金属滑入剑鞘+归鞘入扣脆响`)
        dur = 0.78
        n = int(round(dur * SR))
        t = np.arange(n, dtype=np.float64) / SR
        noise = rng.standard_normal(n)
        # 1. Smooth metallic glide along wooden/lacquered scabbard (`慢动作滑入剑鞘`, t=0.00..0.44s)
        glide_win = np.sin(np.pi * np.clip(t / 0.44, 0.0, 1.0)) ** 0.85 * (t <= 0.44).astype(np.float64)
        sos_glide = signal.butter(2, [1400.0 / (0.5 * SR), 5200.0 / (0.5 * SR)], btype="band", output="sos")
        f_slide = 1520.0 + 1680.0 * np.clip(t / 0.44, 0.0, 1.0) ** 1.2
        phase_slide = 2.0 * np.pi * np.cumsum(f_slide) / SR
        glide = (
            signal.sosfilt(sos_glide, noise) * 0.13
            + np.sin(phase_slide) * 0.075
            + np.sin(phase_slide * 1.58) * 0.045
        ) * glide_win
        # 2. Crisp bronze collar lock snap (`归鞘入扣清脆卡扣声`, t=0.47..0.76s)
        t_lock = np.maximum(0.0, t - 0.47)
        lock_gate = (t >= 0.47).astype(np.float64) * np.clip(t_lock / 0.002, 0.0, 1.0)
        wood_knock = np.sin(2.0 * np.pi * 760.0 * t_lock * np.exp(-t_lock * 14.0)) * np.exp(-t_lock / 0.026) * 0.30
        metal_clasp = (
            np.sin(2.0 * np.pi * 2920.0 * t_lock) * np.exp(-t_lock / 0.048) * 0.24
            + np.sin(2.0 * np.pi * 4680.0 * t_lock + 0.5) * np.exp(-t_lock / 0.032) * 0.16
            + rng.standard_normal(n) * np.exp(-t_lock / 0.005) * 0.14
        )
        return (glide + (wood_knock + metal_clasp) * lock_gate) * intensity

    if kind == "cinnabar_seal_stamp":
        # Heavy stone seal stamp onto Xuan paper (`朱砂方印落定`)
        dur = 0.32
        n = int(round(dur * SR))
        t = np.arange(n, dtype=np.float64) / SR
        f_stone = 88.0 + 110.0 * np.exp(-t / 0.022)
        phase_stone = 2.0 * np.pi * np.cumsum(f_stone) / SR
        stone_thud = np.sin(phase_stone) * np.exp(-t / 0.065) * 0.32
        sos_grit = signal.butter(2, [950.0 / (0.5 * SR), 4200.0 / (0.5 * SR)], btype="band", output="sos")
        grit = signal.sosfilt(sos_grit, rng.standard_normal(n)) * np.exp(-t / 0.028) * 0.14
        return (stone_thud + grit) * intensity

    if kind == "taiko_impact":
        return synth_taiko_impact(intensity, rng)

    if kind == "qin_strumming_slash":
        chord = PRESETS.get(preset, PRESETS["ink"]).get("chords", [[146.83, 196.00, 220.00, 293.66, 329.63]])[2 % 4]
        return synth_qin_strumming_slash(chord, 1.35, intensity, rng)

    if kind == "wave_surge":
        # Cresting river/sea wave roar + foam spray (`惊涛拍岸水声`)
        dur = 0.92
        n = int(round(dur * SR))
        t = np.arange(n, dtype=np.float64) / SR
        noise = rng.standard_normal(n)
        sos_low = signal.butter(2, [90.0 / (0.5 * SR), 580.0 / (0.5 * SR)], btype="band", output="sos")
        sos_spray = signal.butter(2, [1100.0 / (0.5 * SR), 4400.0 / (0.5 * SR)], btype="band", output="sos")
        env_low = np.sin(np.pi * np.clip(t / dur, 0.0, 1.0)) ** 1.2
        env_spray = np.exp(-((t - 0.38) / 0.24) ** 2)
        wave_sig = signal.sosfilt(sos_low, noise) * env_low * 0.16 + signal.sosfilt(sos_spray, noise) * env_spray * 0.09
        return wave_sig * intensity

    if kind == "sword_slash":
        # Wuxia bamboo/steel sword air-cleave whoosh + metallic ring (`剑锋破空铮鸣`)
        dur = 0.36
        n = int(round(dur * SR))
        t = np.arange(n, dtype=np.float64) / SR
        noise = rng.standard_normal(n)
        sos = signal.butter(2, [750.0 / (0.5 * SR), 4600.0 / (0.5 * SR)], btype="band", output="sos")
        whoosh = signal.sosfilt(sos, noise) * np.exp(-((t - 0.09) / 0.065) ** 2) * 0.18
        ring = (
            np.sin(2.0 * np.pi * 1760.0 * t) * np.exp(-t / 0.18) * 0.09
            + np.sin(2.0 * np.pi * 2840.0 * t) * np.exp(-t / 0.11) * 0.06
        )
        return (whoosh + ring) * intensity

    if kind == "drink_sip":
        # Delicate porcelain wine cup clink / liquid droplet (`执盏微酌水滴声`)
        dur = 0.24
        n = int(round(dur * SR))
        t = np.arange(n, dtype=np.float64) / SR
        # Rising water-droplet bubble pitch (520Hz -> 980Hz) + porcelain rim chime
        f_drop = 520.0 + 460.0 * np.clip(t / 0.09, 0.0, 1.0)
        phase = 2.0 * np.pi * np.cumsum(f_drop) / SR
        drop = np.sin(phase) * np.exp(-t / 0.045) * 0.16
        porcelain = np.sin(2.0 * np.pi * 2180.0 * t) * np.exp(-t / 0.085) * 0.08
        return (drop + porcelain) * intensity

    if kind == "boing_hop":
        # Playful 1930s rubber-hose / clay spring hop (`弹簧跳跃音`)
        dur = 0.28
        n = int(round(dur * SR))
        t = np.arange(n, dtype=np.float64) / SR
        f_curve = 220.0 * (1.0 + 0.85 * (1.0 - np.exp(-t / 0.09)) + 0.14 * np.sin(2.0 * np.pi * 19.0 * t))
        phase = 2.0 * np.pi * np.cumsum(f_curve) / SR
        return np.sin(phase) * np.exp(-t / 0.14) * 0.18 * intensity

    if kind == "foot_step":
        # Soft cloth/straw shoe step on stone/wood (`轻步踏地`)
        dur = 0.11
        n = int(round(dur * SR))
        t = np.arange(n, dtype=np.float64) / SR
        thud = np.sin(2.0 * np.pi * 135.0 * t * np.exp(-t * 12.0)) * np.exp(-t / 0.028) * 0.14
        scuff = rng.standard_normal(n) * np.exp(-t / 0.018) * 0.04
        sos = signal.butter(2, 1400.0 / (0.5 * SR), btype="low", output="sos")
        return signal.sosfilt(sos, thud + scuff) * intensity

    # Default `brush_sweep`
    return synth_stroke_draw(preset, intensity, rng)


def _resolve_cue_semantic_action(kind: str, label: str, preset: str) -> str:
    """Maps (kind, label) from HTML data-cues and runtime cues to exact acoustic synthesis primitives."""
    k = (kind or "").strip().lower()
    lbl = (label or "").strip().lower()

    direct_foley = {
        "blade_clique",
        "blade_cleave",
        "blood_splatter",
        "calligraphy_slam",
        "blade_sheathe",
        "cinnabar_seal_stamp",
        "taiko_impact",
        "qin_strumming_slash",
        "wave_surge",
        "sword_slash",
        "drink_sip",
        "brush_sweep",
        "foot_step",
        "boing_hop",
    }
    if k in direct_foley:
        return k
    if lbl in direct_foley:
        return lbl

    # Semantic substring matching on label so `0.95:impact:cinnabar_seal_stamp:0.98` or `0.50:impact:blade_cleave:1.0` routes accurately
    for token in (lbl, k):
        if not token:
            continue
        if any(w in token for w in ("blade_clique", "clique", "unsheathe", "thumb_hilt", "guard_push")):
            return "blade_clique"
        if any(w in token for w in ("blade_cleave", "cleave", "kill_slash", "crescent_slash")):
            return "blade_cleave"
        if any(w in token for w in ("blood_splatter", "blood", "splatter", "crimson_burst")):
            return "blood_splatter"
        if any(w in token for w in ("calligraphy_slam", "kuangcao", "verse_slam", "brush_slam")):
            return "calligraphy_slam"
        if any(w in token for w in ("blade_sheathe", "sheathe", "scabbard_lock")):
            return "blade_sheathe"
        if any(w in token for w in ("cinnabar", "seal_stamp", "seal")):
            return "cinnabar_seal_stamp"
        if any(w in token for w in ("taiko", "war_drum", "drum_slam")):
            return "taiko_impact"
        if any(w in token for w in ("qin_strumming", "strumming_slash", "pipa_slash")):
            return "qin_strumming_slash"
        if "sword" in token or "slash" in token:
            return "sword_slash"
        if "wave" in token or "surge" in token:
            return "wave_surge"
        if "drink" in token or "wine" in token or "sip" in token:
            return "drink_sip"
        if "step" in token or "walk" in token or "stride" in token:
            return "foot_step"
        if any(w in token for w in ("xingcao", "verse", "colophon", "brush", "stroke", "inscription")):
            return "stroke_draw"

    if k in ("scene_cut", "cut"):
        return "scene_cut"
    if k in ("layer_float", "float", "mist"):
        return "layer_float"
    if k in ("count_tick", "tick"):
        return "count_tick"
    if k in ("stroke_draw", "stroke"):
        return "stroke_draw"
    if k in ("impact", "hit", "slam"):
        return "cinnabar_seal_stamp" if preset == "ink" else "card_enter"
    if k in ("enter", "card_enter"):
        return "stroke_draw" if preset == "ink" else "card_enter"

    return "card_enter"


def master_bus(stereo: np.ndarray, preset: str = "glass", ceiling_db: float = -1.2) -> np.ndarray:
    """Applies medium-appropriate tonal shaping, DC block, dynamic-range-preserving leveling, and true-peak limiting."""
    # High-pass to remove DC/rumble (1930s optical film rolls off below 95Hz; modern/ink keeps deep Taiko sub-bass down to 26Hz)
    hp_hz = 95.0 if preset == "jazz" else 26.0
    sos_hp = signal.butter(2, hp_hz / (0.5 * SR), btype="high", output="sos")
    out = signal.sosfilt(sos_hp, stereo, axis=0)

    if preset == "jazz":
        # Vintage 1930s optical sound-on-film high roll-off at 5.6 kHz for authentic warm celluloid tone
        sos_lp = signal.butter(2, 5600.0 / (0.5 * SR), btype="low", output="sos")
        out = signal.sosfilt(sos_lp, out, axis=0)

    # Measure RMS only on active (non-silent) regions so dramatic silence holds are never pumped up
    mono_abs = np.max(np.abs(out), axis=1)
    active_mask = mono_abs > 1.5e-3
    if np.any(active_mask):
        active_rms = np.sqrt(np.mean(out[active_mask] ** 2) + 1e-12)
    else:
        active_rms = np.sqrt(np.mean(out ** 2) + 1e-12)

    # Preserve wide Crest Factor for dramatic ink-wash scores while keeping healthy loudness
    target_rms = 0.115 if preset == "ink" else 0.135
    max_gain = 2.4 if preset == "ink" else 3.6
    gain = float(np.clip(target_rms / active_rms, 0.55, max_gain))
    out = out * gain

    # Soft-knee transparent limiting only above knee_thresh (0.68 ~ -3.3 dBFS) so silence & quiet passages stay linear
    knee_thresh = 0.68
    mag = np.abs(out)
    over = mag > knee_thresh
    if np.any(over):
        sign = np.sign(out[over])
        excess = (mag[over] - knee_thresh) / (1.0 - knee_thresh)
        out[over] = sign * (knee_thresh + (1.0 - knee_thresh) * np.tanh(excess))

    # True-peak ceiling at ceiling_db (-1.2 dBTP)
    ceiling = 10.0 ** (ceiling_db / 20.0)
    peak = float(np.max(np.abs(out)))
    if peak > ceiling:
        out *= ceiling / peak
    elif peak > 1e-5:
        out *= min(1.22, ceiling / peak)

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

    if preset == "ink":
        stereo = synth_ink_guqin_bed(dur, scenes, cfg, rng, cues=cues)
    elif preset == "jazz":
        stereo = synth_jazz_swing_bed(dur, scenes, cfg, rng)
    elif preset == "clay":
        stereo = synth_clay_marimba_bed(dur, scenes, cfg, rng)
    elif preset == "paper":
        stereo = synth_paper_harp_bed(dur, scenes, cfg, rng)
    elif preset == "twilight":
        stereo = synth_twilight_celesta_bed(dur, scenes, cfg, rng)
    else:
        stereo = synth_ambient_bed(dur, scenes, cfg, rng)

    foley_actions = {
        "blade_clique",
        "blade_cleave",
        "blood_splatter",
        "calligraphy_slam",
        "blade_sheathe",
        "cinnabar_seal_stamp",
        "taiko_impact",
        "qin_strumming_slash",
        "wave_surge",
        "sword_slash",
        "drink_sip",
        "brush_sweep",
        "foot_step",
        "boing_hop",
    }

    for idx, cue in enumerate(cues):
        t = float(cue.get("t", 0.0))
        kind = str(cue.get("kind", "card_enter"))
        label = str(cue.get("label", ""))
        intensity = float(cue.get("intensity", 0.75))
        start_sample = int(round(t * SR))
        pan = float(((idx * 37) % 100 - 50) / 140.0)  # subtle stereo placement (-0.35 .. +0.35)

        action = _resolve_cue_semantic_action(kind, label, preset)

        if action == "scene_cut":
            # If this cut lands at the start of an ink `kill_burst` scene, suppress the bright chime
            # so the 0.45s pre-strike anticipation silence hold remains dead silent.
            if preset == "ink":
                cut_mood = ""
                for s_idx, s in enumerate(scenes):
                    if abs(float(s.get("start", 0.0)) - t) < 0.08:
                        cut_mood = _infer_ink_scene_mood(s, s_idx, len(scenes), cues)
                        break
                if cut_mood == "kill_burst":
                    continue
                if cut_mood == "suspend":
                    intensity *= 0.45
            mono = synth_scene_cut(cfg, preset, intensity, idx, rng)
            pan = 0.0
        elif action == "layer_float":
            mono = synth_layer_float(cfg, intensity, idx, rng)
        elif action == "count_tick":
            mono = synth_count_tick(cfg, intensity, idx)
        elif action == "stroke_draw":
            mono = synth_stroke_draw(preset, intensity, rng)
        elif action in foley_actions:
            mono = synth_runtime_foley(action, preset, intensity, rng)
            if action in ("taiko_impact", "blade_cleave", "blade_clique", "blade_sheathe"):
                pan = 0.0
        else:
            mono = synth_card_enter(cfg, intensity, idx, rng)

        mix_into(stereo, start_sample, mono, pan=pan)

    return master_bus(stereo, preset=preset, ceiling_db=-1.2)


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
            {"t": 1.6, "kind": "drink_sip", "intensity": 0.72},
            {"t": 3.5, "kind": "scene_cut", "intensity": 1.0},
            {"t": 3.72, "kind": "card_enter", "intensity": 0.75},
            {"t": 3.95, "kind": "count_tick", "intensity": 0.55},
            {"t": 4.5, "kind": "sword_slash", "intensity": 0.85},
            {"t": 7.2, "kind": "scene_cut", "intensity": 1.0},
            {"t": 7.45, "kind": "card_enter", "intensity": 0.75},
            {"t": 7.8, "kind": "wave_surge", "intensity": 0.8},
            {"t": 8.3, "kind": "layer_float", "intensity": 0.85},
            {"t": 10.8, "kind": "scene_cut", "intensity": 1.0},
            {"t": 11.05, "kind": "card_enter", "intensity": 0.75},
            {"t": 12.0, "kind": "layer_float", "intensity": 0.85},
        ],
    }


def main():
    parser = argparse.ArgumentParser(description="Cue-driven procedural sound & physical modeling score synthesizer for StyleHop.")
    parser.add_argument("--cues", required=False, default=None, help="Path to cues.json extracted from window.CUES")
    parser.add_argument("--out", required=True, help="Output 48kHz stereo WAV path")
    parser.add_argument(
        "--preset",
        default="glass",
        help="Sonic palette preset (ink, jazz, clay, paper, twilight, glass, cyber, terminal, or style aliases)",
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
