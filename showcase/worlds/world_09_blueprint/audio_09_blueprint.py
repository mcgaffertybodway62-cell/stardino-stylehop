#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
World 09 · 建筑蓝图升维剧场 (audio_09_blueprint.py)
Generates 34.0s 48kHz stereo WAV soundtrack (world_09_blueprint.wav).

Overhauled with Real Acoustic Sample Libraries (lemo-opuscar: VSCO2, VCSL, Salamander Grand Piano)
+ Fitted Public-Domain Foley & Tuned Kalimba Bank (earshot.forge.bank) + Broadcast -14.0 LUFS Mastering (master.py):

- Act I   (0.0 ~ 3.2s · Blueprint Entry & Centerline Collision):
  Delicate, contrapuntal Baroque-blueprint chamber ensemble (real harpsichord + pizzicato violins/cellos
  + bassoon + physical-modeled kalimba) as the 2D Slime hops across the Prussian-blue blueprint (0.8~2.2s),
  colliding with the centerline barrier at 2.50s (tactile wood/ruler thump + plucked harp/cello harmonic).
- Act II  (3.2 ~ 6.5s · Mandatory Stop-Down: Knocking on the Seam & Puzzlement):
  Music stops down completely (`gate_zero` 3.15~6.45s) so the two polite knuckle knocks on the dimensional
  glass seam (4.00s, 4.35s, `tap/knuckle` + `fit/land.light/finger_wood`) and the inquisitive [?] solo
  kalimba phrase (5.10s, `pluck/kalimba_soft`) speak in crystal-clear silence! Gentle acoustic nudges at 5.50s & 6.85s.
- Act III (6.5 ~ 14.8s · Inspecting Elevation, Section & ISO Formula):
  Refined chamber counterpoint (clarinet + bassoon + harpsichord + pizzicato strings) with ultra-light,
  sparse domino/drafting ticks (`fit/tick/domino` at -18 dB) and warm vibraphone/harp lock chimes at
  9.50s (SECTION A-A), 11.80s (ELEVATION E-1), and 13.50s (TITLE BLOCK), blossoming into a warm acoustic
  piano + harp + glockenspiel [!] Eureka chord at 13.95s.
- Act IV  (14.8 ~ 23.5s · Mind-Wave CAD Verification, 0.35s Breath of Silence, Stamp & 3D Island Bloom):
  15.0~18.25s: Warm cello + harp + piano arpeggio as CAD checks verify.
  18.25~18.60s: 0.35s Breath of Silence (`gate_zero`) before the stamp!
  18.60s: Authoritative engineering stamp (`pro_impact/short` + `fit/key.space/thock_space` + timpani C2).
  19.35~23.2s: Tactile paper curtain tear (`swipe/paper`) + blooming 3D Pastel Paradise orchestra
  (Salamander Grand Piano + Lush Violins/Violas/Cellos + Flute + Vibraphone + Marimba) with warm acoustic
  island pop-ups at 20.40s, 21.20s, and 22.00s.
- Act V   (23.5 ~ 34.0s · Cross-Dimensional Star Throw, 3D Island Landing & Radiant Transition to World 10):
  23.9~25.05s: Silky sleeve whoosh (`whoosh_fast/sleeve`) + harp/vibraphone arc -> Starlight Pillar ignition
  at 25.05s (`tubular_bells` + `piano` + `cellos`).
  26.08~27.10s: Gentle dimensional flight -> soft lawn touchdown bounce at 27.10s (`fit/land.light/fingertip_book`
  + `pluck/kalimba_soft` water ripples).
  28.0~31.4s: Joyful pastoral flute + grand piano + warm strings melody on the 3D island with two cute hops (30.05s, 30.65s).
  31.50~34.00s (09 -> 10 Seamless White-Light Handover): Starlight Pillar launch (`pro_sub_drop/soft` + `whoosh_big/swell`)
  + ascending real concert harp & grand piano glissando + radiant Cmaj9 strings & `shimmer/m0` bloom that
  bridges seamlessly into 0.00s of World 10!
"""

import os
import sys
import math
import numpy as np
import soundfile as sf

# Repository root derived from __file__ (no absolute paths)
WORLD_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(WORLD_DIR))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from audio_deps import require_audio_upstream
require_audio_upstream()   # 缺失时抛出带安装指引的错误，绝不静默降级

from core.audio import sampler, pluck, sfx as lemo_sfx
from earshot.forge import bank
import master

SR = 48000
DURATION_S = 34.0
TOTAL_SAMPLES = int(round(DURATION_S * SR))
OUT_WAV = os.path.join(WORLD_DIR, "world_09_blueprint.wav")


def gate_zero(bus: np.ndarray, t0: float, t1: float, fade: float = 0.04, sr: int = SR) -> np.ndarray:
    y = bus.copy()
    n = len(y)
    i0 = max(0, int(round(t0 * sr)))
    i1 = min(n, int(round(t1 * sr)))
    if i1 <= i0:
        return y
    fn = max(1, int(round(fade * sr)))
    y[i0:i1] = 0.0
    if i0 > fn:
        w = np.linspace(1.0, 0.0, fn, dtype=y.dtype)[:, None]
        y[i0 - fn:i0] *= w
    if i1 + fn <= n:
        w = np.linspace(0.0, 1.0, fn, dtype=y.dtype)[:, None]
        y[i1:i1 + fn] *= w
    return y

master.gate_zero = gate_zero

def add_stereo(bus: np.ndarray, sig: np.ndarray, t_sec: float, gain: float = 1.0, pan: float = 0.0) -> None:
    """Mix a mono or stereo signal into a (N, 2) float32/float64 bus with equal-power panning."""
    s = int(round(t_sec * SR))
    if s >= len(bus):
        return
    x = np.asarray(sig, dtype=np.float64)
    if x.ndim == 2:
        x = x.mean(axis=1)
    if s < 0:
        x = x[-s:]
        s = 0
    e = min(len(bus), s + len(x))
    if e <= s:
        return
    seg = x[:e - s] * float(gain)
    angle = ( float(np.clip(pan, -1.0, 1.0)) + 1.0 ) * (math.pi / 4.0)
    bus[s:e, 0] += seg * math.cos(angle) * 1.41421356
    bus[s:e, 1] += seg * math.sin(angle) * 1.41421356


def render_bank(sound_id: str, **kwargs) -> np.ndarray:
    """Render an earshot bank sound (returns float32 array normalized to -1 dBFS by default)."""
    y, _ = bank.render(sound_id, checks=False, **kwargs)
    return y


def generate_soundtrack() -> str:
    print(f"[Audio 09] Composing {DURATION_S:.1f}s soundtrack with real acoustic samples & earshot Foley bank...")
    music_bus = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float64)
    sfx_bus = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float64)
    sidechain_hits = []

    # =========================================================================
    # ACT I (0.0 ~ 3.2s): Blueprint Entry & Centerline Collision
    # Contrapuntal chamber ensemble: Harpsichord + Violins/Cellos Pizzicato + Bassoon + Kalimba
    # =========================================================================
    act1_events = [
        # Bassoon & Cello Pizzicato bass line (Cmaj7 -> G6)
        (0.05, 'cellos_pizz', 'C2', 0.85, 0.65, -0.15, 0.55),
        (0.05, 'bassoon', 'C3', 1.10, 0.58, -0.20, 0.42),
        (0.85, 'cellos_pizz', 'G2', 0.70, 0.60, -0.10, 0.50),
        (1.60, 'cellos_pizz', 'B2', 0.85, 0.65, 0.12, 0.55),
        (1.60, 'bassoon', 'G2', 0.90, 0.60, 0.18, 0.42),

        # Harpsichord & Pizzicato Violin geometric blueprint motif
        (0.18, 'harpsichord', 'C4', 0.45, 0.62, -0.30, 0.36),
        (0.18, 'violins_pizz', 'E4', 0.40, 0.65, 0.25, 0.48),
        (0.50, 'harpsichord', 'G4', 0.42, 0.60, -0.22, 0.34),
        (0.80, 'violins_pizz', 'C5', 0.40, 0.68, 0.20, 0.50),
        (1.12, 'harpsichord', 'B4', 0.42, 0.62, -0.15, 0.35),
        (1.42, 'violins_pizz', 'G4', 0.40, 0.62, 0.15, 0.46),
        (1.74, 'harpsichord', 'A4', 0.42, 0.64, -0.10, 0.35),
        (2.04, 'violins_pizz', 'B4', 0.40, 0.68, 0.22, 0.48),
        (2.26, 'harpsichord', 'D5', 0.35, 0.66, 0.10, 0.36),
    ]
    music_bus += sampler.render(act1_events, dur=DURATION_S, master=False)

    # Physical-modeled kalimba highlights on the 4 blueprint entry hops (0.80s, 1.28s, 1.76s, 2.20s)
    for ht, note_name, pan in [
        (0.80, 'C5', -0.25),
        (1.28, 'D5', -0.12),
        (1.76, 'E5', 0.02),
        (2.20, 'G5', 0.16),
    ]:
        kal = pluck.pluck('kalimba', note_name, dur=0.45, vel=0.68)
        add_stereo(music_bus, kal, ht, gain=0.28, pan=pan)
        # Soft tactile fingertip hop on paper blueprint
        hop_tap = render_bank('fit/land.light/fingertip_book', seed=int(ht * 100))
        add_stereo(sfx_bus, hop_tap, ht, gain=0.16, pan=pan)

    # 2.50s: Centerline barrier collision ("咚——嗡！" Elastic wooden/drafting-board thump + resonant cello/harp twang)
    bonk_impact = render_bank('pro_pop_in/round', seed=11)
    bonk_wood = render_bank('fit/hit/bamboo_tok', seed=5)
    add_stereo(sfx_bus, bonk_impact, 2.50, gain=0.48, pan=0.28)
    add_stereo(sfx_bus, bonk_wood, 2.51, gain=0.32, pan=0.30)
    # Resonant low-mid harp/cello pizzicato rebound chord
    bonk_twang = pluck.strum('harp', ['G2', 'D3', 'A3', 'B3'], dur=0.85, vel=0.72, spread=0.015)
    add_stereo(sfx_bus, bonk_twang, 2.52, gain=0.32, pan=0.28)
    sidechain_hits.append(2.50)

    # =========================================================================
    # ACT II (3.2 ~ 6.5s): MANDATORY STOP-DOWN — Knocking on the Seam & Puzzlement
    # Music stops down completely from 3.15s to 6.45s so the Foley knocks and [?]
    # melody happen in crystal-clear, un-cluttered space!
    # =========================================================================
    # 4.00s & 4.35s: Polite, tactile knuckle knocks on the dimensional glass/paper seam ("笃、笃")
    knock1 = render_bank('tap/knuckle', seed=101)
    knock1_wood = render_bank('fit/land.light/finger_wood', seed=201)
    add_stereo(sfx_bus, knock1, 4.00, gain=0.46, pan=0.32)
    add_stereo(sfx_bus, knock1_wood, 4.005, gain=0.34, pan=0.32)

    knock2 = render_bank('tap/knuckle', seed=102)
    knock2_wood = render_bank('fit/land.light/finger_wood', seed=202)
    add_stereo(sfx_bus, knock2, 4.35, gain=0.52, pan=0.32)
    add_stereo(sfx_bus, knock2_wood, 4.355, gain=0.38, pan=0.32)

    # 5.10s: Cute inquisitive [?] solo kalimba + vibraphone upward question motif in pure silence!
    for q_off, q_pitch, q_gain in [
        (0.00, 'G4', 0.34),
        (0.09, 'D5', 0.38),
        (0.19, 'E5', 0.42),
        (0.31, 'A5', 0.48),
    ]:
        q_kal = render_bank('pluck/kalimba_soft', pitch=q_pitch, seed=300 + int(q_off * 100))
        add_stereo(sfx_bus, q_kal, 5.10 + q_off, gain=q_gain, pan=0.20)
    add_stereo(sfx_bus, sampler.note('vibraphone', 'A5', 0.65, vel=0.62), 5.41, gain=0.26, pan=0.22)

    # 5.50s & 6.85s: Visual choreography gentle seam test nudge & rebound
    nudge1 = render_bank('pro_tap/knock', seed=14)
    add_stereo(sfx_bus, nudge1, 5.50, gain=0.34, pan=0.34)
    add_stereo(sfx_bus, pluck.pluck('upright_bass_pizz', 'A2', dur=0.55, vel=0.65), 5.51, gain=0.28, pan=0.30)

    nudge2 = render_bank('pro_tap/soft', seed=19)
    add_stereo(sfx_bus, nudge2, 6.85, gain=0.26, pan=0.34)

    # =========================================================================
    # ACT III (6.5 ~ 14.8s): Inspecting Elevation, Section & ISO Formula
    # Intelligent, breathable chamber counterpoint (Clarinet + Bassoon + Pizzicato
    # Strings + Harpsichord + Kalimba) — sparse, musical, never cluttered!
    # =========================================================================
    act3_events = [
        # Bar 1 (6.50 ~ 8.50s · Am9): Clarinet & Bassoon dialogue
        (6.50, 'cellos_pizz', 'A2', 1.10, 0.64, -0.15, 0.55),
        (6.50, 'bassoon', 'E3', 1.60, 0.58, -0.22, 0.40),
        (6.55, 'harpsichord', 'A3', 0.65, 0.58, -0.28, 0.30),
        (6.95, 'violins_pizz', 'C4', 0.45, 0.62, 0.20, 0.45),
        (7.35, 'clarinet', 'E4', 0.95, 0.62, 0.15, 0.42),
        (7.85, 'violins_pizz', 'G4', 0.45, 0.64, 0.25, 0.45),

        # Bar 2 (8.50 ~ 10.80s · Fmaj7#11 · Reticle scans Top-Left SECTION A-A)
        (8.50, 'cellos_pizz', 'F2', 1.10, 0.64, -0.15, 0.55),
        (8.50, 'bassoon', 'C3', 1.80, 0.60, -0.22, 0.42),
        (8.55, 'harpsichord', 'A3', 0.65, 0.58, -0.25, 0.30),
        (9.00, 'clarinet', 'G4', 0.85, 0.64, 0.12, 0.44),
        (9.50, 'harp', 'B4', 1.10, 0.68, -0.35, 0.46),
        (9.95, 'violins_pizz', 'E5', 0.45, 0.65, 0.22, 0.45),
        (10.35, 'clarinet', 'D5', 0.45, 0.62, 0.15, 0.40),

        # Bar 3 (10.80 ~ 13.00s · Cmaj9 · Reticle scans Bottom-Left ELEVATION E-1)
        (10.80, 'cellos_pizz', 'C2', 1.10, 0.66, -0.15, 0.55),
        (10.80, 'bassoon', 'G2', 1.80, 0.60, -0.20, 0.42),
        (10.85, 'harpsichord', 'E4', 0.65, 0.60, -0.25, 0.32),
        (11.30, 'clarinet', 'A4', 0.80, 0.65, 0.15, 0.45),
        (11.80, 'harp', 'C5', 1.10, 0.70, -0.32, 0.48),
        (12.25, 'violins_pizz', 'G5', 0.45, 0.66, 0.25, 0.46),
        (12.60, 'oboe', 'E5', 0.45, 0.62, 0.08, 0.38),

        # Bar 4 (13.00 ~ 13.90s · G13sus4 · Reticle scans Bottom TITLE BLOCK -> Pre-Eureka)
        (13.00, 'cellos_pizz', 'G2', 0.90, 0.68, -0.10, 0.58),
        (13.00, 'bassoon', 'D3', 0.85, 0.62, -0.18, 0.44),
        (13.05, 'harpsichord', 'F4', 0.55, 0.62, -0.22, 0.32),
        (13.38, 'clarinet', 'A4', 0.50, 0.66, 0.12, 0.44),

        # 13.95s ~ 14.80s: Bright [!] Eureka Acoustic Bloom (Grand Piano + Harp + Vibraphone + Strings)
        (13.95, 'piano', 'C3', 0.95, 0.74, -0.10, 0.52),
        (13.95, 'piano', 'G3', 0.95, 0.72, -0.05, 0.48),
        (13.95, 'piano', 'E4', 0.95, 0.75, 0.05, 0.52),
        (13.95, 'piano', 'B4', 0.95, 0.76, 0.12, 0.52),
        (13.95, 'piano', 'D5', 0.95, 0.78, 0.18, 0.55),
        (13.95, 'violins', 'G5', 0.85, 0.68, 0.25, 0.42),
        (13.95, 'vibraphone', 'C6', 0.95, 0.72, -0.20, 0.40),
    ]
    music_bus += sampler.render(act3_events, dur=DURATION_S, master=False)

    # Sparse, delicate kalimba discovery motif (every ~0.48s instead of machine-gun 0.24s!)
    for ts, pitch_nm, pan in [
        (6.75, 'E5', -0.25), (7.25, 'G5', 0.20), (7.75, 'A5', -0.18), (8.25, 'B5', 0.22),
        (8.75, 'C5', -0.28), (9.25, 'E5', 0.18), (10.15, 'G5', -0.20),
        (11.05, 'D5', 0.22), (11.55, 'G5', -0.22), (12.45, 'A5', 0.20),
        (13.15, 'B5', -0.15), (13.65, 'D6', 0.15),
    ]:
        add_stereo(music_bus, pluck.pluck('kalimba', pitch_nm, dur=0.42, vel=0.64), ts, gain=0.24, pan=pan)

    # Ultra-gentle HUD reticle ticks (`pro_hover_tick/soft` & `fit/tick/domino` at very low gain)
    for st, pan in [(7.40, -0.45), (8.60, -0.48), (10.30, -0.42), (11.00, -0.40), (12.70, -0.35)]:
        tick = render_bank('pro_hover_tick/soft', seed=int(st * 10))
        add_stereo(sfx_bus, tick, st, gain=0.11, pan=pan)

    # Inspection Lock Chimes (9.50s SECTION A-A, 11.80s ELEVATION E-1, 13.50s TITLE BLOCK)
    add_stereo(sfx_bus, sampler.note('vibraphone', 'E5', 0.80, vel=0.68), 9.50, gain=0.34, pan=-0.42)
    add_stereo(sfx_bus, sampler.note('glockenspiel', 'A5', 0.65, vel=0.60), 9.52, gain=0.22, pan=-0.38)

    add_stereo(sfx_bus, sampler.note('vibraphone', 'G5', 0.80, vel=0.70), 11.80, gain=0.36, pan=-0.38)
    add_stereo(sfx_bus, sampler.note('glockenspiel', 'C6', 0.65, vel=0.62), 11.82, gain=0.24, pan=-0.34)

    add_stereo(sfx_bus, sampler.note('vibraphone', 'A5', 0.75, vel=0.70), 13.50, gain=0.35, pan=-0.18)
    add_stereo(sfx_bus, sampler.note('glockenspiel', 'D6', 0.65, vel=0.64), 13.52, gain=0.24, pan=-0.15)

    # 13.90s: Eureka [!] Concert Harp Arpeggio + Soft Chime
    eureka_harp = pluck.strum('harp', ['C4', 'E4', 'G4', 'B4', 'D5', 'G5', 'C6'], dur=1.10, vel=0.78, spread=0.045)
    add_stereo(sfx_bus, eureka_harp, 13.90, gain=0.38, pan=0.08)
    add_stereo(sfx_bus, render_bank('notify/m2', seed=41), 13.95, gain=0.24, pan=0.15)
    sidechain_hits.append(13.95)

    # =========================================================================
    # ACT IV (14.8 ~ 23.5s): Mind-Wave CAD Verification, 0.35s Breath of Silence,
    # Authoritative Engineering Stamp (18.60s) & 3D Floating Island Bloom!
    # =========================================================================
    act4_pre_stamp = [
        # 15.0 ~ 18.20s: Warm Cello + Piano + Harp CAD verification build (Dm9 -> G13sus4)
        (15.00, 'cellos', 'D2', 1.65, 0.66, -0.15, 0.45),
        (15.00, 'violas', 'A3', 1.65, 0.60, 0.15, 0.38),
        (15.00, 'piano', 'F4', 0.80, 0.66, -0.20, 0.40),
        (15.55, 'piano', 'A4', 0.80, 0.68, -0.08, 0.42),
        (16.05, 'vibraphone', 'E5', 0.75, 0.70, -0.32, 0.36),  # SECTION A-A VERIFIED ✓
        (16.70, 'cellos', 'G2', 1.45, 0.68, -0.10, 0.46),
        (16.70, 'violas', 'B3', 1.45, 0.64, 0.15, 0.40),
        (16.75, 'piano', 'G4', 0.70, 0.70, 0.05, 0.42),
        (17.10, 'vibraphone', 'G5', 0.70, 0.72, -0.28, 0.38),  # ELEVATION E-1 VERIFIED ✓
        (17.45, 'piano', 'B4', 0.65, 0.72, 0.15, 0.44),
        (17.85, 'vibraphone', 'C6', 0.40, 0.74, -0.15, 0.38),  # R 120 BUILT ✓
    ]
    music_bus += sampler.render(act4_pre_stamp, dur=DURATION_S, master=False)

    # Subtle confirmation chimes at 16.05s, 17.10s, 17.85s
    add_stereo(sfx_bus, render_bank('pro_click/soft', seed=61), 16.05, gain=0.18, pan=-0.35)
    add_stereo(sfx_bus, render_bank('pro_click/soft', seed=62), 17.10, gain=0.18, pan=-0.30)
    add_stereo(sfx_bus, render_bank('fit/key/thock', seed=63), 17.85, gain=0.24, pan=-0.15)

    # 18.25 ~ 18.60s: MANDATORY 0.35s BREATH OF SILENCE before the APPROVED Stamp!
    # (Enforced via master.gate_zero below!)

    # 18.60s: Heavy Authoritative Engineering Stamp ("APPROVED 哐当！")
    stamp_hit = render_bank('pro_impact/short', seed=77)
    stamp_thock = render_bank('fit/key.space/thock_space', seed=88)
    stamp_timp = sampler.note('timpani', 'C2', 1.10, vel=0.82)
    add_stereo(sfx_bus, stamp_hit, 18.60, gain=0.58, pan=0.06)
    add_stereo(sfx_bus, stamp_thock, 18.605, gain=0.46, pan=0.08)
    add_stereo(sfx_bus, stamp_timp, 18.60, gain=0.45, pan=0.0)
    # 18.78s: Cute Slime self-build elastic pop
    add_stereo(sfx_bus, render_bank('fit/pop/mouth_plop', seed=91), 18.78, gain=0.34, pan=0.0)
    sidechain_hits.append(18.60)

    # 19.35 ~ 21.35s: Tactile Blueprint Paper Curtain Tear (Real fitted/forge paper & cloth swipes, NO harsh pink noise!)
    tear_paper1 = render_bank('swipe/paper', dur=1.10, seed=105)
    tear_cloth = render_bank('swipe/cloth', dur=1.20, seed=106)
    add_stereo(sfx_bus, tear_paper1, 19.35, gain=0.38, pan=0.10)
    add_stereo(sfx_bus, tear_cloth, 20.05, gain=0.32, pan=0.18)

    # 19.50 ~ 23.50s: Blooming 3D Pastel Paradise Full Chamber Orchestra!
    # (Salamander Grand Piano + Lush Violins/Violas/Cellos + Contrabass + Flute + Vibraphone + Marimba)
    act4_bloom_events = [
        # Chord 1: Fmaj9 (19.50 ~ 20.80s)
        dict(t=19.50, inst='contrabass', pitch='F1', dur=1.28, vel=0.72, pan=-0.10, gain=0.48, attack=0.08),
        dict(t=19.50, inst='cellos', pitch='F2', dur=1.28, vel=0.74, pan=-0.18, gain=0.50, attack=0.08),
        dict(t=19.50, inst='violas', pitch='C3', dur=1.28, vel=0.70, pan=0.12, gain=0.44, attack=0.10),
        dict(t=19.50, inst='violins', pitch='A4', dur=1.28, vel=0.74, pan=-0.25, gain=0.46, attack=0.12),
        dict(t=19.50, inst='violins', pitch='E5', dur=1.28, vel=0.74, pan=0.25, gain=0.44, attack=0.12),
        dict(t=19.52, inst='piano', pitch='F3', dur=1.10, vel=0.74, pan=-0.15, gain=0.48),
        dict(t=19.52, inst='piano', pitch='A3', dur=1.10, vel=0.72, pan=-0.05, gain=0.45),
        dict(t=19.52, inst='piano', pitch='E4', dur=1.10, vel=0.75, pan=0.08, gain=0.48),
        dict(t=19.52, inst='piano', pitch='G4', dur=1.10, vel=0.76, pan=0.18, gain=0.48),

        # Chord 2: G6/9 (20.80 ~ 22.10s)
        dict(t=20.80, inst='contrabass', pitch='G1', dur=1.28, vel=0.74, pan=-0.10, gain=0.48, attack=0.08),
        dict(t=20.80, inst='cellos', pitch='G2', dur=1.28, vel=0.76, pan=-0.18, gain=0.52, attack=0.08),
        dict(t=20.80, inst='violas', pitch='D3', dur=1.28, vel=0.72, pan=0.12, gain=0.45, attack=0.10),
        dict(t=20.80, inst='violins', pitch='B4', dur=1.28, vel=0.76, pan=-0.25, gain=0.48, attack=0.12),
        dict(t=20.80, inst='violins', pitch='E5', dur=1.28, vel=0.76, pan=0.25, gain=0.46, attack=0.12),
        dict(t=20.82, inst='piano', pitch='G3', dur=1.10, vel=0.76, pan=-0.15, gain=0.48),
        dict(t=20.82, inst='piano', pitch='B3', dur=1.10, vel=0.74, pan=-0.05, gain=0.45),
        dict(t=20.82, inst='piano', pitch='E4', dur=1.10, vel=0.76, pan=0.08, gain=0.48),
        dict(t=20.82, inst='piano', pitch='A4', dur=1.10, vel=0.78, pan=0.18, gain=0.50),

        # Chord 3: Cmaj9 (22.10 ~ 23.50s)
        dict(t=22.10, inst='contrabass', pitch='C2', dur=1.38, vel=0.76, pan=-0.10, gain=0.50, attack=0.08),
        dict(t=22.10, inst='cellos', pitch='G2', dur=1.38, vel=0.78, pan=-0.18, gain=0.52, attack=0.08),
        dict(t=22.10, inst='violas', pitch='E3', dur=1.38, vel=0.74, pan=0.12, gain=0.46, attack=0.10),
        dict(t=22.10, inst='horn', pitch='G3', dur=1.35, vel=0.70, pan=-0.20, gain=0.38, attack=0.12),
        dict(t=22.10, inst='violins', pitch='B4', dur=1.38, vel=0.78, pan=-0.25, gain=0.48, attack=0.12),
        dict(t=22.10, inst='violins', pitch='D5', dur=1.38, vel=0.80, pan=0.25, gain=0.50, attack=0.12),
        dict(t=22.12, inst='piano', pitch='C4', dur=1.25, vel=0.78, pan=-0.12, gain=0.50),
        dict(t=22.12, inst='piano', pitch='E4', dur=1.25, vel=0.76, pan=0.0, gain=0.48),
        dict(t=22.12, inst='piano', pitch='G4', dur=1.25, vel=0.78, pan=0.12, gain=0.50),
        dict(t=22.12, inst='piano', pitch='D5', dur=1.25, vel=0.80, pan=0.22, gain=0.52),

        # Sparkling Marimba + Flute + Glockenspiel counter-melody during 3D island rise
        (19.80, 'marimba', 'C5', 0.45, 0.72, -0.20, 0.42),
        (20.10, 'marimba', 'E5', 0.45, 0.72, -0.10, 0.42),
        (20.40, 'flute', 'G5', 0.65, 0.72, 0.15, 0.42),
        (21.10, 'flute', 'A5', 0.65, 0.74, 0.20, 0.44),
        (21.80, 'flute', 'B5', 0.55, 0.74, 0.22, 0.44),
        (22.15, 'flute', 'C6', 0.95, 0.78, 0.18, 0.46),
        (22.15, 'glockenspiel', 'G6', 0.95, 0.68, -0.22, 0.28),
    ]
    music_bus += sampler.render(act4_bloom_events, dur=DURATION_S, master=False)

    # Springy architectural 3D Island extrusion pops at 20.40s, 21.20s, 22.00s
    for p_ts, p_pitch, p_pan, p_seed in [
        (20.40, 'G4', 0.25, 204),
        (21.20, 'C5', 0.35, 212),
        (22.00, 'E5', 0.40, 220),
    ]:
        add_stereo(sfx_bus, render_bank('pro_pop_in/round', seed=p_seed), p_ts, gain=0.40, pan=p_pan)
        add_stereo(sfx_bus, render_bank('fit/pop/mouth_plop', seed=p_seed + 1), p_ts + 0.02, gain=0.32, pan=p_pan)
        add_stereo(sfx_bus, sampler.note('marimba', p_pitch, 0.55, vel=0.76), p_ts, gain=0.42, pan=p_pan)
        add_stereo(sfx_bus, sampler.note('vibraphone', p_pitch, 0.75, vel=0.70), p_ts + 0.03, gain=0.32, pan=p_pan)
        sidechain_hits.append(p_ts)

    # =========================================================================
    # ACT V (23.5 ~ 34.0s): Cross-Dimensional Star Throw, 3D Island Landing &
    #                       Starlight Pillar Ascent into World 10!
    # =========================================================================
    act5_events = [
        # 23.50 ~ 25.05s: Dm9 anticipation as Slime throws the 8-point Compass Star
        dict(t=23.50, inst='cellos', pitch='D2', dur=1.50, vel=0.68, pan=-0.15, gain=0.46, attack=0.10),
        dict(t=23.50, inst='violas', pitch='A3', dur=1.50, vel=0.64, pan=0.15, gain=0.40, attack=0.10),
        dict(t=23.55, inst='piano', pitch='F4', dur=1.20, vel=0.68, pan=-0.12, gain=0.42),
        dict(t=23.55, inst='piano', pitch='C5', dur=1.20, vel=0.70, pan=0.12, gain=0.42),

        # 25.05 ~ 27.10s: G13sus4 radiant bloom as Starlight Pillar ignites on 3D Island!
        dict(t=25.05, inst='contrabass', pitch='G1', dur=1.95, vel=0.74, pan=-0.10, gain=0.48, attack=0.05),
        dict(t=25.05, inst='cellos', pitch='G2', dur=1.95, vel=0.76, pan=-0.18, gain=0.50, attack=0.06),
        dict(t=25.05, inst='horn', pitch='D4', dur=1.80, vel=0.72, pan=-0.22, gain=0.40, attack=0.10),
        dict(t=25.05, inst='violins', pitch='A4', dur=1.95, vel=0.74, pan=-0.25, gain=0.46, attack=0.10),
        dict(t=25.05, inst='violins', pitch='E5', dur=1.95, vel=0.76, pan=0.25, gain=0.46, attack=0.10),

        # 27.10 ~ 29.30s: Cmaj9 warm pastoral arrival as Slime lands on the 3D Island lawn
        dict(t=27.10, inst='contrabass', pitch='C2', dur=2.15, vel=0.72, pan=-0.10, gain=0.48, attack=0.06),
        dict(t=27.10, inst='cellos', pitch='G2', dur=2.15, vel=0.74, pan=-0.18, gain=0.50, attack=0.08),
        dict(t=27.10, inst='violas', pitch='E3', dur=2.15, vel=0.70, pan=0.15, gain=0.42, attack=0.10),
        dict(t=27.10, inst='violins', pitch='B4', dur=2.15, vel=0.72, pan=-0.22, gain=0.44, attack=0.12),
        dict(t=27.12, inst='piano', pitch='C4', dur=1.80, vel=0.74, pan=-0.15, gain=0.46),
        dict(t=27.12, inst='piano', pitch='G4', dur=1.80, vel=0.74, pan=0.05, gain=0.46),
        dict(t=27.12, inst='piano', pitch='E5', dur=1.80, vel=0.76, pan=0.20, gain=0.48),

        # 29.30 ~ 31.50s: Fmaj9 -> G6/9 joyful island exploration & two happy jumps
        dict(t=29.30, inst='cellos', pitch='F2', dur=1.15, vel=0.72, pan=-0.15, gain=0.48, attack=0.08),
        dict(t=29.30, inst='violins', pitch='A4', dur=1.15, vel=0.72, pan=0.20, gain=0.44, attack=0.10),
        dict(t=29.32, inst='piano', pitch='F3', dur=1.05, vel=0.72, pan=-0.12, gain=0.45),
        dict(t=29.32, inst='piano', pitch='C4', dur=1.05, vel=0.72, pan=0.08, gain=0.45),
        dict(t=30.45, inst='cellos', pitch='G2', dur=1.05, vel=0.74, pan=-0.15, gain=0.48, attack=0.08),
        dict(t=30.45, inst='violins', pitch='B4', dur=1.05, vel=0.74, pan=0.20, gain=0.46, attack=0.10),
        dict(t=30.47, inst='piano', pitch='G3', dur=0.95, vel=0.74, pan=-0.12, gain=0.46),
        dict(t=30.47, inst='piano', pitch='D4', dur=0.95, vel=0.74, pan=0.08, gain=0.46),

        # 28.05 ~ 31.35s: Joyful Pastoral Flute + Grand Piano + Vibraphone Melody on the 3D Island
        (28.05, 'flute', 'C5', 0.42, 0.72, -0.15, 0.46),
        (28.45, 'flute', 'E5', 0.42, 0.74, -0.20, 0.46),
        (28.85, 'flute', 'G5', 0.45, 0.76, -0.22, 0.48),
        (29.30, 'flute', 'A5', 0.45, 0.78, 0.15, 0.48),
        (29.72, 'flute', 'G5', 0.38, 0.74, 0.22, 0.46),
        (30.05, 'flute', 'C6', 0.48, 0.78, 0.20, 0.48),
        (30.65, 'flute', 'D6', 0.48, 0.80, 0.24, 0.48),
        (31.10, 'flute', 'E6', 0.42, 0.78, 0.10, 0.46),

        # 31.50 ~ 34.00s: Radiant Cmaj9 Orchestral Crescendo into World 10 White-Light Handover!
        dict(t=31.50, inst='contrabass', pitch='C2', dur=2.50, vel=0.80, pan=0.0, gain=0.52, attack=0.12, release=0.05),
        dict(t=31.50, inst='cellos', pitch='G2', dur=2.50, vel=0.82, pan=-0.18, gain=0.54, attack=0.12, release=0.05),
        dict(t=31.50, inst='violas', pitch='E3', dur=2.50, vel=0.78, pan=0.18, gain=0.48, attack=0.15, release=0.05),
        dict(t=31.50, inst='horn', pitch='G3', dur=2.50, vel=0.78, pan=-0.22, gain=0.44, attack=0.18, release=0.05),
        dict(t=31.50, inst='horn', pitch='D4', dur=2.50, vel=0.78, pan=0.22, gain=0.44, attack=0.18, release=0.05),
        dict(t=31.50, inst='violins', pitch='E5', dur=2.50, vel=0.82, pan=-0.28, gain=0.52, attack=0.15, release=0.05),
        dict(t=31.50, inst='violins', pitch='B5', dur=2.50, vel=0.84, pan=0.28, gain=0.52, attack=0.15, release=0.05),
        dict(t=31.52, inst='piano', pitch='C3', dur=2.45, vel=0.82, pan=-0.15, gain=0.50),
        dict(t=31.52, inst='piano', pitch='G3', dur=2.45, vel=0.80, pan=-0.05, gain=0.48),
        dict(t=31.52, inst='piano', pitch='E4', dur=2.45, vel=0.82, pan=0.05, gain=0.50),
        dict(t=31.52, inst='piano', pitch='B4', dur=2.45, vel=0.84, pan=0.15, gain=0.52),
        dict(t=31.52, inst='piano', pitch='D5', dur=2.45, vel=0.85, pan=0.22, gain=0.54),
    ]
    music_bus += sampler.render(act5_events, dur=DURATION_S, master=False)

    # 23.90 ~ 25.05s: Star throw trajectory whoosh + harp arc
    add_stereo(sfx_bus, render_bank('whoosh_fast/sleeve', dur=0.95, seed=239), 23.95, gain=0.32, pan=0.10)
    throw_harp = pluck.strum('harp', ['D4', 'F4', 'A4', 'C5', 'E5', 'G5', 'A5', 'D6'], dur=0.95, vel=0.74, spread=0.11)
    add_stereo(sfx_bus, throw_harp, 23.95, gain=0.36, pan=0.15)

    # 25.05s: Starlight Pillar Ignition on 3D Island (Tubular Bells + Hand Chimes + Soft Sub Bloom)
    add_stereo(sfx_bus, sampler.note('tubular_bells', 'G4', 1.60, vel=0.76), 25.05, gain=0.42, pan=0.30)
    add_stereo(sfx_bus, sampler.note('hand_chimes', 'D6', 1.35, vel=0.72), 25.06, gain=0.32, pan=0.34)
    add_stereo(sfx_bus, render_bank('pro_sub_drop/soft', seed=250), 25.05, gain=0.36, pan=0.20)
    sidechain_hits.append(25.05)

    # 25.40 ~ 27.05s: Self-parameter injection kalimba notes & smooth dimensional flight whoosh
    for inj_t, inj_p in [(25.40, 'E5'), (25.62, 'G5'), (25.84, 'B5'), (26.05, 'D6')]:
        add_stereo(sfx_bus, render_bank('pluck/kalimba_soft', pitch=inj_p, seed=int(inj_t * 100)), inj_t, gain=0.28, pan=-0.10)
    add_stereo(sfx_bus, render_bank('swipe/velvet', dur=0.90, seed=261), 26.12, gain=0.32, pan=0.15)

    # 27.10s: Juicy 3D Island Lawn Touchdown Bounce + Expanding Kalimba/Vibraphone Ripple Chimes
    add_stereo(sfx_bus, render_bank('fit/land.light/fingertip_book', seed=271), 27.10, gain=0.42, pan=0.28)
    add_stereo(sfx_bus, render_bank('fit/pop/mouth_plop', seed=272), 27.12, gain=0.36, pan=0.28)
    sidechain_hits.append(27.10)
    for r_ts, r_p, r_pan in [(27.20, 'E5', 0.22), (27.45, 'A5', 0.32), (27.70, 'B5', 0.38), (27.95, 'E6', 0.28)]:
        add_stereo(sfx_bus, render_bank('pluck/kalimba_ring', pitch=r_p, seed=int(r_ts * 100)), r_ts, gain=0.24, pan=r_pan)

    # 30.05s & 30.65s: Two joyful lawn jumps
    for j_ts, j_p in [(30.05, 'E5'), (30.65, 'G5')]:
        add_stereo(sfx_bus, render_bank('fit/pop/lip_pop', seed=int(j_ts * 100)), j_ts, gain=0.28, pan=0.25)
        add_stereo(sfx_bus, pluck.pluck('kalimba', j_p, dur=0.40, vel=0.72), j_ts, gain=0.30, pan=0.25)

    # 31.50 ~ 34.00s (09 -> 10 Seamless White-Light Transition):
    # Starlight Pillar Launch + Ascending Real Concert Harp & Piano Glissando + Angelic Shimmer!
    add_stereo(sfx_bus, render_bank('pro_sub_drop/soft', seed=315), 31.50, gain=0.42, pan=0.0)
    add_stereo(sfx_bus, render_bank('whoosh_big/swell', dur=1.60, seed=316), 31.50, gain=0.30, pan=0.0)
    add_stereo(sfx_bus, sampler.note('tubular_bells', 'C5', 1.80, vel=0.76), 31.50, gain=0.38, pan=-0.10)
    sidechain_hits.append(31.50)

    # 2-Octave Real Concert Harp + Grand Piano Glissando ascending into the white-gold flash (31.55 ~ 33.85s)
    gliss_pitches = [
        'C4', 'D4', 'E4', 'G4', 'A4', 'B4',
        'C5', 'D5', 'E5', 'G5', 'A5', 'B5',
        'C6', 'D6', 'E6', 'G6', 'A6', 'B6', 'C7'
    ]
    for g_i, g_p in enumerate(gliss_pitches):
        g_ts = 31.55 + g_i * 0.12
        if g_ts < 33.90:
            g_pan = -0.40 + 0.80 * (g_i / max(1, len(gliss_pitches) - 1))
            add_stereo(music_bus, sampler.note('harp', g_p, 0.90, vel=0.74), g_ts, gain=0.34, pan=g_pan)
            if g_i % 2 == 0 and g_i <= 14:
                add_stereo(music_bus, sampler.note('piano', g_p, 0.85, vel=0.72), g_ts + 0.02, gain=0.30, pan=-g_pan * 0.6)

    # 32.85 ~ 34.00s: Radiant white-light transition shimmer (`shimmer/m0` + `hand_chimes`)
    add_stereo(sfx_bus, render_bank('shimmer/m0', seed=330), 32.85, gain=0.28, pan=0.0)
    add_stereo(music_bus, sampler.note('hand_chimes', 'G6', 1.10, vel=0.70), 32.90, gain=0.26, pan=0.15)

    # =========================================================================
    # Mandatory Stop-Downs & Dynamic Shaping
    # =========================================================================
    # 1. Act II Mandatory Stop-Down (3.15s ~ 6.45s): Silence the music bus so the knocks (4.0s, 4.35s)
    #    and inquisitive [?] solo kalimba (5.10s) happen in crystal-clear silence!
    music_bus = master.gate_zero(music_bus, 3.15, 6.45, fade=0.06, sr=SR)

    # 2. Act IV Pre-Stamp Breath of Silence (18.25s ~ 18.60s): 0.35s stop-down right before APPROVED stamp!
    music_bus = master.gate_zero(music_bus, 18.25, 18.60, fade=0.04, sr=SR)
    sfx_bus = master.gate_zero(sfx_bus, 18.28, 18.59, fade=0.03, sr=SR)

    # 3. Natural concert hall room on music bus & subtle room on SFX bus
    music_rev = sampler.room(music_bus.astype(np.float32), size=0.46, mix=0.22, predelay=0.016, damp=0.55).astype(np.float64)
    sfx_rev = sampler.room(sfx_bus.astype(np.float32), size=0.30, mix=0.12, predelay=0.010, damp=0.60).astype(np.float64)

    # Re-enforce the stop-downs after reverb tail so silence is genuinely clean
    music_rev = master.gate_zero(music_rev, 3.30, 6.42, fade=0.08, sr=SR)
    music_rev = master.gate_zero(music_rev, 18.30, 18.59, fade=0.04, sr=SR)

    # 4. Sidechain ducking: music ducks cleanly under key Foley hits
    sc_gain = master.sidechain_times([(float(t_h), 1.0) for t_h in sidechain_hits], TOTAL_SAMPLES, depth=0.45, tau=0.14)
    music_rev *= sc_gain

    # 5. Final Broadcast Mastering (-14.0 LUFS, -2.27 dBTP ceiling=0.77, wide LRA)
    mix_stereo = music_rev * 1.00 + sfx_rev * 0.88
    finished, _ = master.finish(mix_stereo, lufs=-14.0, ceiling=0.77, hp_hz=28.0)

    os.makedirs(os.path.dirname(OUT_WAV), exist_ok=True)
    sf.write(OUT_WAV, finished.astype(np.float32), SR, subtype="PCM_24")
    metrics = master.measure(finished)
    print(f"[OK] World 09 Audio generated: {OUT_WAV} -> {metrics}")
    return OUT_WAV


if __name__ == "__main__":
    generate_soundtrack()
