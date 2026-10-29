#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
World 05 · 立体书与千纸鹤之谷 (audio_05_paper.py)
Generates 30.0s 48kHz stereo WAV soundtrack (world_05_paper.wav).

Built with the Lemo-OpusCar + Earshot Real-Sound Architecture:
1. Authentic Sampled Instruments (core.audio.sampler) & Physical Models (core.audio.pluck):
   - Delicate Music Box (pluck.pluck('music_box')), Kalimba (pluck.pluck('kalimba')),
     and Glockenspiel (sampler.note('glockenspiel')) for intimate, toy-like melodies.
   - Concert Harp (sampler.note('harp')) & Nylon Guitar (pluck.pluck('nylon_guitar')) for warm arpeggios.
   - Lyrical Flute (sampler.note('flute')) & Clarinet (sampler.note('clarinet')) for the soaring
     Origami Crane flight theme (7.8-14.4s and 17.2-23.2s).
   - Warm Chamber Strings (sampler.note('violins'), sampler.note('cellos'), sampler.note('violin'))
     and Upright Bass Pizzicato (pluck.pluck('upright_bass_pizz')).
   - Vietnamese/Chinese Zither (sampler.note('dan_tranh')) for the book-open & 180° page-turn flourishes.
2. Musical Breathing Room (Stop-Downs) & Sidechain Ducking:
   - Beat 2 (4.2-7.6s): Accompaniment drops down to near-silence at the canyon edge so the musical
     call-and-response ('♪') between the Slime (solo flute/music-box) and the Lead Crane (solo harp/zither)
     breathes in quiet air.
   - Beat 4 (14.4-16.0s): Orchestra pauses during the Grand 180° Pop-Up Page Turn so the tactile cardstock
     page swipe (bank.render('swipe/paper') + fingertip_book taps) and a single shimmering dan_tranh
     glissando take center stage before the Star chime (15.96s).
   - Crane wing flaps use whisper-soft low-passed cloth/bamboo swishes (bank.render('swipe/cloth') low-passed
     at 2.3 kHz, mixed at -16 dB under the music — zero harsh white-noise bursts).
3. Mastering to Exact -14.0 LUFS (master.finish):
   - Music bus ducks smoothly around key Foley impacts via master.sidechain_times().
   - Final mix finished via master.finish(mix, lufs=-14.0, ceiling=0.77) with expressive LRA (5-9 LU).
"""

import os
import sys
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

# Repository root derived from __file__ (no absolute paths)
WORLD_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(WORLD_DIR))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from audio_deps import require_audio_upstream
require_audio_upstream()   # 缺失时抛出带安装指引的错误，绝不静默降级

from core.audio import sampler as S
from core.audio import pluck as P
from core.audio import sfx as lemo_sfx
from earshot.forge import bank
from earshot import api as earshot_api
import master

DURATION_S = 30.0
SR = 48000
TOTAL_SAMPLES = int(round(DURATION_S * SR))


def lp(x: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x).astype(np.float32)


def bp(x: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x).astype(np.float32)


def pan_st(mono: np.ndarray, pan: float = 0.0) -> np.ndarray:
    mono = np.asarray(mono, dtype=np.float32)
    if mono.ndim == 2:
        mono = mono.mean(axis=1)
    p = float(np.clip(pan, -1.0, 1.0))
    th = (p + 1.0) * (np.pi / 4.0)
    return np.column_stack((mono * np.cos(th), mono * np.sin(th))).astype(np.float32)


def put(buf: np.ndarray, t_sec: float, clip: np.ndarray, gain: float = 1.0, pan: float = None):
    if pan is not None or clip.ndim == 1:
        clip_st = pan_st(clip, pan or 0.0)
    else:
        clip_st = np.asarray(clip, dtype=np.float32)
    i0 = int(round(float(t_sec) * SR))
    if i0 < 0:
        clip_st = clip_st[-i0:]
        i0 = 0
    if i0 >= TOTAL_SAMPLES or len(clip_st) == 0:
        return
    i1 = min(TOTAL_SAMPLES, i0 + len(clip_st))
    buf[i0:i1] += clip_st[:i1 - i0] * float(gain)


def envelope_window(buf: np.ndarray, t0: float, t1: float, gain: float, fade_s: float = 0.25):
    """Smoothly attenuates a stereo buffer between t0 and t1 for natural stop-downs / breathing room."""
    n = len(buf)
    i0 = max(0, int(round(t0 * SR)))
    i1 = min(n, int(round(t1 * SR)))
    fn = int(round(fade_s * SR))
    env = np.ones(n, dtype=np.float32)
    env[i0:i1] = gain
    if fn > 0 and i0 >= fn:
        w = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, fn))
        env[i0 - fn:i0] = 1.0 - (1.0 - gain) * w
    if fn > 0 and i1 + fn <= n:
        w = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, fn))
        env[i1:i1 + fn] = gain + (1.0 - gain) * w
    buf *= env[:, None]


def generate_soundtrack():
    print(f"[Audio 05] Composing intimate Paper Pop-Up Book soundtrack ({DURATION_S}s @ {SR}Hz)...")
    S.seed(505)
    rng = np.random.default_rng(505)

    # Separate Music, Foley, and Ambience buses for clean sidechain ducking & room acoustics
    mus_events = []
    mus_direct = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)
    sfx_bus = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)
    amb_bus = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)
    sc_hits = []  # (t_sec, weight) for master.sidechain_times

    def add_p_note(preset: str, t_sec: float, pitch: str, dur: float, vel: float = 0.65, pan: float = 0.0, gain: float = 1.0, **kw):
        y = P.pluck(preset, pitch, dur=dur, vel=vel, **kw)
        put(mus_direct, t_sec, y, gain=gain, pan=pan)

    def add_s_note(inst: str, t_sec: float, pitch: str, dur: float, vel: float = 0.6, pan: float = 0.0, gain: float = 1.0, **kw):
        ev = dict(t=float(t_sec), inst=inst, pitch=pitch, dur=float(dur), vel=float(vel), pan=float(pan), gain=float(gain))
        ev.update(kw)
        mus_events.append(ev)

    # =========================================================================
    # 1. BEAT 1 (0.00 - 4.20s): Book Cover Peels Open, Mountains Pop Up, 5 Lanterns & Cliff Chase
    # =========================================================================
    # Warm Fmaj9 -> G6 -> Cmaj9 chamber strings & harp foundation
    for p, pan in [("F3", -0.25), ("A3", 0.15), ("C4", -0.15), ("E4", 0.25)]:
        add_s_note("cellos" if "3" in p else "violins", 0.12, p, 2.0, vel=0.46, pan=pan, gain=0.65, attack=0.45)
    for p, pan in [("G3", -0.25), ("B3", 0.15), ("D4", -0.15), ("G4", 0.25)]:
        add_s_note("cellos" if "3" in p else "violins", 2.10, p, 2.0, vel=0.48, pan=pan, gain=0.65, attack=0.40)

    # Opening Dan Tranh (Guzheng kin) + Concert Harp pentatonic unfold blossom (0.12s)
    unfold_pitches = ["F4", "G4", "A4", "C5", "D5", "F5", "G5", "A5", "C6"]
    for i, p in enumerate(unfold_pitches):
        t_n = 0.12 + i * 0.055
        add_s_note("dan_tranh", t_n, p, 1.4, vel=0.52, pan=-0.3 + i * 0.07, gain=0.55)
        if i % 2 == 0:
            add_s_note("harp", t_n + 0.01, p, 1.5, vel=0.55, pan=0.25 - i * 0.05, gain=0.65)

    # Upright pizzicato bass & nylon guitar gentle pulse in Beat 1
    for t_b, p_b in [(0.15, "F2"), (1.10, "C3"), (2.05, "G2"), (2.90, "D3"), (3.70, "G2")]:
        add_p_note("upright_bass_pizz", t_b, p_b, 0.65, vel=0.58, pan=0.0, gain=0.70)

    # Delicate Music Box & Glockenspiel melody in Beat 1
    b1_mel = [
        (0.25, "A5", 0.55), (0.65, "C6", 0.58), (1.10, "D6", 0.60), (1.52, "F6", 0.65),
        (2.05, "E6", 0.58), (2.46, "D6", 0.58), (2.90, "C6", 0.60), (3.34, "A5", 0.56), (3.78, "G5", 0.55),
    ]
    for t_m, p_m, v_m in b1_mel:
        add_p_note("music_box", t_m, p_m, 0.85, vel=v_m, pan=-0.18, gain=0.58)
        add_s_note("harp", t_m, p_m[:-1] + str(int(p_m[-1]) - 1), 1.1, vel=v_m * 0.85, pan=0.20, gain=0.55)

    # =========================================================================
    # 2. BEAT 2 (4.20 - 7.80s): STOP-DOWN AT CANYON EDGE & CALL-AND-RESPONSE ('♪')
    # =========================================================================
    # Quiet breathing room: only a single soft sustained cello fifth + solo call-and-response!
    add_s_note("cellos", 4.25, "D3", 3.3, vel=0.32, pan=-0.15, gain=0.45, attack=0.6)
    add_s_note("cellos", 4.25, "A3", 3.3, vel=0.28, pan=0.15, gain=0.40, attack=0.6)

    # 4.26s '?' curious pizzicato & ocarina inflection; 5.00s '!' glockenspiel & harp discovery
    add_s_note("violins_pizz", 4.26, "A4", 0.35, vel=0.55, pan=-0.20, gain=0.65)
    add_s_note("ocarina", 4.34, "D5", 0.35, vel=0.45, pan=-0.18, gain=0.55, attack=0.04)
    add_s_note("glockenspiel", 5.00, "A5", 0.8, vel=0.58, pan=-0.12, gain=0.60)
    add_s_note("harp", 5.00, "D5", 1.1, vel=0.62, pan=-0.12, gain=0.68)

    # Slime's Call (5.48 - 6.45s, '♪'): Solo Flute + Music Box playing tender pentatonic call
    slime_call = [(5.48, "E5", 0.26), (5.75, "G5", 0.26), (6.04, "A5", 0.26), (6.32, "C6", 0.42)]
    for t_c, p_c, d_c in slime_call:
        add_s_note("flute", t_c, p_c, d_c, vel=0.58, pan=-0.22, gain=0.72, attack=0.03)
        add_p_note("music_box", t_c, p_c, d_c + 0.3, vel=0.52, pan=-0.18, gain=0.48)

    # Lead Crane's Response in Canyon (6.68 - 7.72s, '♪'): Solo Concert Harp + Dan Tranh + Kalimba
    crane_resp = [(6.68, "D6", 0.26), (6.94, "C6", 0.26), (7.18, "A5", 0.26), (7.42, "G5", 0.26), (7.65, "E5", 0.45)]
    for t_r, p_r, d_r in crane_resp:
        add_s_note("harp", t_r, p_r[:-1] + str(int(p_r[-1]) - 1), d_r + 0.6, vel=0.62, pan=0.12, gain=0.75)
        add_s_note("dan_tranh", t_r, p_r, d_r + 0.5, vel=0.52, pan=0.18, gain=0.55)
        add_p_note("kalimba", t_r, p_r, d_r + 0.3, vel=0.50, pan=0.08, gain=0.45)

    # =========================================================================
    # 3. BEAT 3 (7.80 - 14.40s): Cranes Spiral Up, Slime Leaps onto Saddle & Soars into Clouds
    # =========================================================================
    # Warm Ghibli String & Horn Swell: Cmaj9 (7.8-10.6s) -> Fmaj7 (10.6-11.9s) -> G6/9 -> Cmaj9 (11.9-14.4s)
    b3_chords = [
        (7.80, 2.75, [("C3", "cellos"), ("G3", "cellos"), ("E4", "violas"), ("G4", "violins"), ("D5", "violins")], 0.54),
        (10.60, 1.30, [("F2", "contrabass"), ("C3", "cellos"), ("A3", "violas"), ("C4", "violins"), ("F4", "horn")], 0.58),
        (11.90, 2.45, [("G2", "contrabass"), ("D3", "cellos"), ("B3", "violas"), ("D4", "horn"), ("G4", "violins"), ("B4", "violins")], 0.64),
    ]
    for t0, dur_c, notes_c, vel_c in b3_chords:
        for p_c, inst_c in notes_c:
            pan_c = -0.25 if inst_c in ("cellos", "contrabass") else (0.25 if inst_c == "violins" else 0.0)
            add_s_note(inst_c, t0, p_c, dur_c, vel=vel_c, pan=pan_c, gain=0.68, attack=0.38)

    # Sweeping Harp Arpeggios & Pizzicato Bass during Crane Ascent & Flight (7.85 - 14.30s)
    arp_b3 = ["C4", "E4", "G4", "A4", "C5", "D5", "E5", "G5"]
    for i in range(16):
        t_a = 7.85 + i * 0.17
        add_s_note("harp", t_a, arp_b3[i % len(arp_b3)], 0.9, vel=0.55, pan=-0.25 + (i % 4) * 0.15, gain=0.65)
    for t_b, p_b in [(7.85, "C2"), (8.75, "G2"), (9.65, "A2"), (10.65, "F2"), (11.64, "D3"), (11.95, "G2"), (12.80, "E2"), (13.60, "C2")]:
        add_p_note("upright_bass_pizz", t_b, p_b, 0.70, vel=0.64, pan=0.0, gain=0.75)

    # Soaring Flute + Clarinet + Solo Violin Flight Melody (8.0 - 14.3s)
    flight_mel = [
        (8.00, "E5", 0.55, 0.58), (8.60, "G5", 0.55, 0.60), (9.20, "A5", 0.65, 0.62), (9.90, "C6", 0.65, 0.65),
        # 10.75s leap -> 11.64s joyful landing on crane back!
        (10.75, "D6", 0.40, 0.64), (11.20, "E6", 0.40, 0.66), (11.64, "G6", 0.55, 0.72),
        # 11.95 - 14.30s: Exhilarating soaring theme into golden clouds
        (11.98, "E6", 0.42, 0.68), (12.42, "D6", 0.42, 0.66), (12.86, "C6", 0.45, 0.68),
        (13.34, "D6", 0.45, 0.70), (13.82, "E6", 0.58, 0.72),
    ]
    for t_fm, p_fm, d_fm, v_fm in flight_mel:
        add_s_note("flute", t_fm, p_fm, d_fm, vel=v_fm, pan=0.12, gain=0.72, attack=0.03)
        add_s_note("clarinet", t_fm, p_fm[:-1] + str(int(p_fm[-1]) - 1), d_fm, vel=v_fm * 0.85, pan=-0.15, gain=0.58, attack=0.04)
        if t_fm >= 11.60:
            add_s_note("violin", t_fm, p_fm[:-1] + str(int(p_fm[-1]) - 1), d_fm + 0.1, vel=v_fm * 0.9, pan=0.22, gain=0.62, attack=0.05)

    # =========================================================================
    # 4. BEAT 4 (14.40 - 17.20s): STOP-DOWN FOR GRAND 180° PAGE TURN & STAR REVEAL (15.96s)
    # =========================================================================
    # Orchestra pauses from 14.40s to 15.90s so the tactile 3D page turn & single zither sweep shine!
    page_zither = ["D4", "E4", "G4", "A4", "B4", "D5", "E5", "G5", "A5", "B5", "D6", "E6"]
    for i, p_z in enumerate(page_zither):
        t_z = 14.55 + i * 0.095
        add_s_note("dan_tranh", t_z, p_z, 1.3, vel=0.56, pan=0.35 - i * 0.06, gain=0.62)
        if i % 2 == 1:
            add_s_note("harp", t_z, p_z, 1.4, vel=0.58, pan=-0.25 + i * 0.04, gain=0.65)

    # 15.96s: Radiant Star Reveal on the crown of the Red Arch Bridge!
    for p_st, pan_st in [("F3", -0.2), ("C4", 0.2), ("A4", -0.15), ("C5", 0.15), ("E5", 0.0)]:
        add_s_note("cellos" if "3" in p_st else "violins", 15.96, p_st, 1.25, vel=0.56, pan=pan_st, gain=0.68, attack=0.20)
    for i, p_sc in enumerate(["C5", "E5", "G5", "A5", "C6", "E6"]):
        add_s_note("hand_chimes", 15.96 + i * 0.06, p_sc, 1.4, vel=0.58, pan=-0.25 + i * 0.1, gain=0.62)
        add_p_note("music_box", 15.96 + i * 0.06, p_sc, 1.0, vel=0.60, pan=0.20 - i * 0.08, gain=0.55)

    # =========================================================================
    # 5. BEAT 5 (17.20 - 25.00s): Graceful Glide In, Hop-Off, Bow Duet ('♥' & '✦') & Departure
    # =========================================================================
    # 17.20 - 21.20s: Warm pastoral gliding arrival (Clarinet + Flute + Harp + Cellos)
    b5_chords = [
        (17.20, 2.0, [("C3", "cellos"), ("G3", "violas"), ("E4", "violins"), ("G4", "clarinet")], 0.52),
        (19.20, 2.0, [("F2", "cellos"), ("C3", "violas"), ("A3", "violins"), ("C4", "clarinet")], 0.52),
        # 22.00 - 23.20s: Tender chamber duet for Bow Farewell & Golden Token Gift
        (21.95, 1.35, [("D3", "cellos"), ("A3", "violas"), ("F4", "violin"), ("A4", "flute")], 0.55),
        (23.25, 1.70, [("G2", "cellos"), ("D3", "violas"), ("B3", "violins"), ("G4", "flute")], 0.50),
    ]
    for t0, dur_c, notes_c, vel_c in b5_chords:
        for p_c, inst_c in notes_c:
            add_s_note(inst_c, t0, p_c, dur_c, vel=vel_c, pan=0.15 if inst_c in ("violin", "flute") else -0.15, gain=0.64, attack=0.35)

    glide_mel = [
        (17.25, "E6", 0.45, 0.58), (17.75, "D6", 0.45, 0.56), (18.25, "C6", 0.45, 0.56), (18.75, "A5", 0.45, 0.54),
        (19.25, "C6", 0.45, 0.58), (19.75, "D6", 0.45, 0.58), (20.25, "A5", 0.45, 0.55), (20.75, "G5", 0.45, 0.54),
        # 22.05 - 23.15s: Heartwarming Farewell & Golden Token Duet ('♥' & '✦')
        (22.08, "A5", 0.35, 0.60), (22.42, "C6", 0.35, 0.62), (22.76, "D6", 0.35, 0.64), (23.08, "E6", 0.45, 0.65),
        # 23.50 - 24.75s: Poetic Crane Departure
        (23.50, "D6", 0.42, 0.56), (23.95, "C6", 0.42, 0.54), (24.40, "A5", 0.50, 0.52),
    ]
    for t_gm, p_gm, d_gm, v_gm in glide_mel:
        add_p_note("music_box", t_gm, p_gm, d_gm + 0.4, vel=v_gm, pan=0.20, gain=0.55)
        add_s_note("harp", t_gm, p_gm[:-1] + str(int(p_gm[-1]) - 1), d_gm + 0.6, vel=v_gm, pan=-0.18, gain=0.64)
        if 17.20 <= t_gm <= 20.80:
            add_s_note("flute", t_gm, p_gm[:-1] + str(int(p_gm[-1]) - 1), d_gm, vel=v_gm * 0.9, pan=0.25, gain=0.65, attack=0.04)

    for t_b, p_b in [(17.25, "C2"), (18.25, "G2"), (19.25, "F2"), (20.25, "C3"), (21.25, "D2"), (22.10, "A2"), (23.25, "G2"), (24.25, "D3")]:
        add_p_note("upright_bass_pizz", t_b, p_b, 0.65, vel=0.58, pan=0.0, gain=0.68)

    # =========================================================================
    # 6. BEAT 6 (25.00 - 30.00s): Ascending Bridge Hops, Star Fanfare, Pavilion Dash & Handover
    # =========================================================================
    # 25.00 - 26.64s: 3 Ascending Pentatonic Bridge Hops (Marimba + Pizzicato + Music Box)
    for i, (t_bh, p_bh) in enumerate([(25.06, "C5"), (25.70, "E5"), (26.34, "G5")]):
        add_s_note("marimba", t_bh, p_bh, 0.5, vel=0.64 + i * 0.05, pan=0.20 - i * 0.1, gain=0.70)
        add_s_note("violins_pizz", t_bh, p_bh, 0.35, vel=0.62, pan=-0.15, gain=0.65)
        add_p_note("upright_bass_pizz", t_bh, ["F2", "G2", "A2"][i], 0.55, vel=0.65, pan=0.0, gain=0.72)

    # 26.64s: Radiant Star Collection Fanfare on the Crown of the Arch Bridge!
    for p_f, inst_f in [("C2", "contrabass"), ("G2", "cellos"), ("E3", "cellos"), ("C4", "violas"), ("E4", "horn"), ("G4", "violins"), ("C5", "violins")]:
        add_s_note(inst_f, 26.64, p_f, 2.15, vel=0.66, pan=0.0, gain=0.72, attack=0.12)
    star_arp = ["C5", "E5", "G5", "A5", "C6", "D6", "E6", "G6"]
    for i, p_sa in enumerate(star_arp):
        t_sa = 26.64 + i * 0.048
        add_s_note("harp", t_sa, p_sa, 1.3, vel=0.68, pan=-0.3 + i * 0.08, gain=0.72)
        add_s_note("glockenspiel", t_sa, p_sa, 1.1, vel=0.60, pan=0.3 - i * 0.08, gain=0.58)
        add_s_note("dan_tranh", t_sa, p_sa, 1.2, vel=0.58, pan=0.0, gain=0.55)

    # 27.06 - 28.50s: 4 Joyful Pavilion Dash Hops
    for i, (t_ph, p_ph) in enumerate([(27.06, "C6"), (27.50, "D6"), (27.94, "E6"), (28.38, "G6")]):
        add_p_note("kalimba", t_ph, p_ph, 0.45, vel=0.64, pan=-0.10 - i * 0.10, gain=0.65)
        add_s_note("violins_pizz", t_ph, p_ph[:-1] + "5", 0.3, vel=0.58, pan=-0.15, gain=0.60)

    # 28.80 - 30.00s: Spinning Zoetrope Music-Box Acceleration -> Stained-Glass Cathedral Handover (29.20s)
    zoe_notes = ["G5", "A5", "C6", "D6", "E6", "G6", "A6"]
    t_zoe = 28.80
    for i in range(9):
        if t_zoe >= 29.42:
            break
        add_p_note("music_box", t_zoe, zoe_notes[i % len(zoe_notes)], 0.32, vel=0.60, pan=-0.3 + (i % 3) * 0.3, gain=0.58)
        t_zoe += max(0.045, 0.090 - i * 0.007)

    # 29.20 - 30.00s: Sacred Stained-Glass Harp + Hand Chimes + Soft Pipe Organ pre-echo into World 06!
    for p_sg, pan_sg in [("D3", -0.2), ("A3", 0.2), ("D4", -0.1), ("F4", 0.1), ("A4", 0.0)]:
        add_s_note("organ_soft", 29.18, p_sg, 0.80, vel=0.55, pan=pan_sg, gain=0.68, attack=0.12)
    for i, p_gl in enumerate(["D5", "A5", "D6", "F6", "A6"]):
        add_s_note("glass", 29.20 + i * 0.05, p_gl, 0.78 - i * 0.05, vel=0.58, pan=-0.3 + i * 0.15, gain=0.65)
        add_s_note("hand_chimes", 29.20 + i * 0.05, p_gl, 0.78 - i * 0.05, vel=0.52, pan=0.3 - i * 0.15, gain=0.58)

    # Render all sampled notes and combine with physical pluck notes into warm room reverb
    print("[Audio 05] Rendering 97-instrument sample bank & physical waveguide plucks...")
    mus_sampled = S.render(mus_events, dur=DURATION_S, master=False)[:TOTAL_SAMPLES]
    mus_bus = mus_sampled + mus_direct
    mus_bus = S.room(mus_bus, size=0.52, mix=0.22, predelay=0.015, damp=0.55)[:TOTAL_SAMPLES]

    # Enforce natural breathing room / stop-downs on the music bus
    envelope_window(mus_bus, 4.22, 5.45, gain=0.45, fade_s=0.22)   # Quiet canyon peer
    envelope_window(mus_bus, 14.42, 15.92, gain=0.52, fade_s=0.20)  # Page-turn spotlight

    # =========================================================================
    # 7. TACTILE, WARM PAPER FOLEY (earshot.forge.bank + lemo-opuscar recipes)
    # =========================================================================
    print("[Audio 05] Rendering tactile paper Foley & soft cloth wingbeats...")

    def foley_book_open(t_sec: float):
        # Warm wooden spine creak + soft paper swipe + fingertip book thump
        sw, _ = bank.render("swipe/paper", seed=11, dur=0.65)
        tb, _ = bank.render("fit/land.light/fingertip_book", seed=12)
        put(sfx_bus, t_sec, lp(sw, 3200.0), gain=0.28, pan=-0.20)
        put(sfx_bus, t_sec + 0.04, lp(tb, 1800.0), gain=0.32, pan=-0.25)
        sc_hits.append((t_sec, 0.35))

    def foley_popup_snap(t_sec: float, pitch_hz: float = 650.0, pan: float = 0.0, gain: float = 0.22):
        # Gentle pop-up card fold snap (low-passed fingertip_book + soft tonal pop, zero harsh noise)
        tb, _ = bank.render("fit/land.light/fingertip_book", seed=int(t_sec * 100) % 97 + 1)
        t = np.arange(int(0.11 * SR)) / SR
        f_sw = pitch_hz * (1.0 - 0.45 * (t / 0.11))
        pop_tone = np.sin(2.0 * np.pi * np.cumsum(f_sw) / SR) * np.exp(-t / 0.028) * 0.35
        put(sfx_bus, t_sec, lp(tb, 2800.0), gain=gain, pan=pan)
        put(sfx_bus, t_sec, pop_tone.astype(np.float32), gain=gain * 0.7, pan=pan)

    def foley_soft_wing(t_sec: float, pan: float = 0.0, gain: float = 0.14):
        # Whisper-soft low-passed cloth/paper wingbeat (-16 dB under music, never noisy!)
        cl, _ = bank.render("swipe/cloth", seed=int(t_sec * 100) % 89 + 1, dur=0.22)
        put(sfx_bus, t_sec, lp(cl, 2200.0), gain=gain, pan=pan)

    def foley_slime_hop(t_sec: float, f0: float = 420.0, f1: float = 820.0, pan: float = 0.0, gain: float = 0.20):
        # Warm Paper-Mario style soft boing + tiny book tap
        dur = 0.18
        t = np.arange(int(dur * SR)) / SR
        f = f0 + (f1 - f0) * (1.0 - np.exp(-t * 14.0))
        boing = (np.sin(2.0 * np.pi * np.cumsum(f) / SR) + 0.22 * np.sin(4.0 * np.pi * np.cumsum(f) / SR))
        boing *= np.minimum(1.0, t / 0.005) * np.exp(-np.maximum(0.0, t - 0.005) / 0.065)
        tb, _ = bank.render("fit/land.light/fingertip_book", seed=int(t_sec * 100) % 73 + 1)
        put(sfx_bus, t_sec, lp(boing.astype(np.float32), 2600.0), gain=gain, pan=pan)
        put(sfx_bus, t_sec, lp(tb, 2400.0), gain=gain * 0.65, pan=pan)

    # Beat 1 Foley: Cover peel (0.02s), mountain pop-ups (0.10-1.30s), 5 lanterns, wake-up & 5 cliff hops
    foley_book_open(0.02)
    for i, t_s in enumerate([0.10, 0.28, 0.48, 0.70, 0.95, 1.22]):
        foley_popup_snap(t_s, pitch_hz=520.0 + i * 45.0, pan=-0.40 + i * 0.15, gain=0.20)
    for i, (t_l, p_l) in enumerate(zip([0.55, 1.10, 1.65, 2.20, 2.75], ["D5", "E5", "G5", "A5", "C6"])):
        ch = S.note("hand_chimes", p_l, 0.9, vel=0.52)
        put(sfx_bus, t_l, ch, gain=0.48, pan=-0.45 + i * 0.22)
    foley_slime_hop(0.12, 360.0, 760.0, pan=-0.50, gain=0.20)
    for i, t_h in enumerate([2.04, 2.46, 2.90, 3.34, 3.78]):
        foley_slime_hop(t_h, 400.0 + i * 20.0, 820.0 + i * 25.0, pan=-0.48 + i * 0.08, gain=0.17)

    # Beat 2 Foley: Call hops (5.46s, 6.06s) & Lead Crane graceful wing spread (6.85s)
    foley_slime_hop(5.46, 440.0, 880.0, pan=-0.20, gain=0.18)
    foley_slime_hop(6.06, 460.0, 920.0, pan=-0.20, gain=0.18)
    foley_soft_wing(6.85, pan=0.05, gain=0.18)
    foley_soft_wing(7.35, pan=0.05, gain=0.15)
    sc_hits.extend([(5.00, 0.30), (5.48, 0.25), (6.68, 0.25)])

    # Beat 3 Foley: Soft crane wingbeats (7.95-10.15s), targeted leap (10.75s), saddle landing (11.64s) & flight (12.0-14.0s)
    for t_w in [7.95, 8.65, 9.35, 10.05]:
        foley_soft_wing(t_w, pan=-0.12, gain=0.13)
    foley_slime_hop(10.75, 420.0, 980.0, pan=-0.18, gain=0.24)
    foley_popup_snap(11.64, pitch_hz=680.0, pan=-0.10, gain=0.24)
    sc_hits.extend([(10.75, 0.35), (11.64, 0.40)])
    for i, t_w in enumerate([12.00, 12.65, 13.30, 13.95]):
        foley_soft_wing(t_w, pan=-0.05 + i * 0.12, gain=0.14)

    # Beat 4 Foley: Grand 180° Pop-Up Page Turn (14.45 - 16.65s)
    pg_sw1, _ = bank.render("swipe/paper", seed=41, dur=0.92)
    pg_sw2, _ = bank.render("swipe/cloth", seed=42, dur=0.85)
    put(sfx_bus, 14.48, lp(pg_sw1, 2800.0), gain=0.34, pan=0.15)
    put(sfx_bus, 15.45, lp(pg_sw2, 2500.0), gain=0.28, pan=-0.15)
    for i, t_u in enumerate([14.68, 15.12, 15.56, 16.25, 16.62]):
        foley_popup_snap(t_u, pitch_hz=480.0 + i * 50.0, pan=0.30 - i * 0.14, gain=0.22)
    sc_hits.extend([(14.48, 0.45), (15.96, 0.45)])

    # Beat 5 Foley: Gliding wingbeats (17.35-20.55s), hop-off (21.24s, 21.90s), bow & token (22.10-23.10s), departure
    for i, t_w in enumerate([17.35, 18.15, 18.95, 19.75, 20.55]):
        foley_soft_wing(t_w, pan=0.45 - i * 0.05, gain=0.12)
    foley_slime_hop(21.24, 440.0, 860.0, pan=0.30, gain=0.20)
    foley_popup_snap(21.90, pitch_hz=620.0, pan=0.25, gain=0.20)
    foley_slime_hop(22.18, 400.0, 780.0, pan=0.25, gain=0.16)
    foley_slime_hop(22.72, 420.0, 820.0, pan=0.25, gain=0.16)
    sb_bell, _ = bank.render("fit/bell/small_bell", seed=55)
    put(sfx_bus, 22.32, lp(sb_bell, 5500.0), gain=0.24, pan=0.30)
    sc_hits.extend([(21.24, 0.30), (22.32, 0.35)])
    for i, t_w in enumerate([23.35, 24.05, 24.75]):
        foley_soft_wing(t_w, pan=0.35 + i * 0.15, gain=0.12)

    # Beat 6 Foley: 3 Bridge hops (25.06, 25.70, 26.34s), Star fanfare (26.64s), 4 Pavilion hops, Zoetrope dive (28.82s)
    for i, t_h in enumerate([25.06, 25.70, 26.34]):
        foley_slime_hop(t_h, 440.0 + i * 45.0, 880.0 + i * 60.0, pan=0.20 - i * 0.10, gain=0.20)
    sc_hits.append((26.64, 0.45))
    for i, t_h in enumerate([27.06, 27.50, 27.94, 28.38]):
        foley_slime_hop(t_h, 480.0 + i * 20.0, 920.0 + i * 25.0, pan=-0.10 - i * 0.10, gain=0.16)
    foley_slime_hop(28.82, 520.0, 1080.0, pan=-0.45, gain=0.22)
    wg, _ = bank.render("logo_sting/whoosh_glass", seed=61)
    put(sfx_bus, 29.18, lp(wg, 5200.0), gain=0.28, pan=0.0)
    sc_hits.append((29.20, 0.40))

    # Place Foley in the same warm room space
    sfx_bus = S.room(sfx_bus, size=0.38, mix=0.18, predelay=0.010, damp=0.60)[:TOTAL_SAMPLES]

    # Subtle, warm room tone bed (paper-popup style)
    room_noise = lp(lemo_sfx.brown(DURATION_S), 320.0) * 0.008
    amb_bus[:, 0] = room_noise[:TOTAL_SAMPLES]
    amb_bus[:, 1] = np.roll(room_noise[:TOTAL_SAMPLES], 240)

    # =========================================================================
    # 8. SIDECHAIN DUCKING & -14.0 LUFS MASTERING (master.finish)
    # =========================================================================
    print("[Audio 05] Applying sidechain ducking & mastering to -14.0 LUFS...")
    duck_env = master.sidechain_times(sc_hits, TOTAL_SAMPLES, depth=0.38, tau=0.14)
    mix_stereo = mus_bus * duck_env + sfx_bus + amb_bus

    mastered, info = master.finish(
        mix_stereo,
        lufs=-14.0,
        ceiling=0.77,
        mono_hz=120,
        comp=True,
        drive=1.12,
        air=0.15,
        hp_hz=28,
        end_fade=0.06,
        tail_zero=480,
    )
    mastered = mastered[:TOTAL_SAMPLES]

    out_wav = os.path.join(WORLD_DIR, "world_05_paper.wav")
    sf.write(out_wav, mastered.astype(np.float32), SR, subtype="PCM_24")

    m_rep = master.measure(mastered)
    spec = np.abs(np.fft.rfft(mastered.mean(axis=1))) ** 2
    freqs = np.fft.rfftfreq(len(mastered), 1.0 / SR)
    tot_e = float(np.sum(spec)) + 1e-12
    lf_pct = 100.0 * float(np.sum(spec[freqs < 200.0])) / tot_e
    hf_pct = 100.0 * float(np.sum(spec[freqs > 4000.0])) / tot_e
    print(f"[Audio 05] master.measure: {m_rep}")
    print(f"[Audio 05] Spectral balance: LF(<200Hz)={lf_pct:.1f}% | HF(>4kHz)={hf_pct:.1f}%")


if __name__ == "__main__":
    generate_soundtrack()

