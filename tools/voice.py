#!/usr/bin/env python3
"""
StyleHop voice track builder (`tools/voice.py`).

Turns a per-product `voice.json` into a deterministic 48 kHz mono voice track, a
timing manifest, and an SRT file. TTS is a build step: it runs once, caches each
line, and the renderer only mixes the resulting WAV. No network is needed at
frame-render time.

Manifest (scene anchors are resolved against the renderer's `cues.json`):

  {
    "provider": "auto",                 // auto | edge | kokoro | command
    "voice": "zh-CN-XiaoxiaoNeural",    // provider default if omitted
    "rate": "+0%", "pitch": "+0Hz",     // edge / command
    "speed": 0.95,                      // kokoro / command
    "lang": "zh-CN",
    "lines": [
      {"id": "l1", "text": "一滴墨，落进整个春天。",
       "scene": 0, "offset": 0.45, "maxDur": 3.0,
       "say": "一滴墨，落进整个春天。",   // optional; text actually spoken
       "subtitle": "一滴墨，落进整个春天。"} // optional; false hides it from SRT
    ]
  }

`scene` accepts an index (0) or a scene id ("scene-01"); `anchor` is an alias
with the form "scene:<id>". `at` is an absolute second and overrides `scene`.
Lines without an anchor follow the previous line after `gap` (default 0.3 s).

Providers:
  edge     Microsoft Edge online voices (`edge-tts`); instant, needs network.
  kokoro   Local Kokoro ONNX (`kokoro-onnx`); set KOKORO_MODEL / KOKORO_VOICES.
  command  Any CLI through the VOICE_CMD template, e.g. CosyVoice / Azure CLI:
           VOICE_CMD='cosyvoice --text {text_file} --out {out} --voice {voice}'

Usage:
  python3 tools/voice.py build --script <product>/voice.json --cues cues.json \
      --out-dir <work-dir>/voice [--start 0] [--dur 14] [--provider edge]
  python3 tools/voice.py build --script voice.json --out-dir out   # lines use "at" or the default offset
"""

from __future__ import annotations

import argparse
import asyncio
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
PEAK = 0.89  # -1.0 dBFS per line; the final mix has its own limiter
FADE = 0.008
CJK = re.compile(r"[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]")


def die(msg: str):
    sys.exit(f"voice.py: {msg}")


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


def trim_silence(audio: np.ndarray) -> np.ndarray:
    if audio.size == 0:
        die("TTS returned an empty audio buffer")
    peak = float(np.max(np.abs(audio)))
    if peak < 1e-4:
        die("TTS returned silence")
    idx = np.flatnonzero(np.abs(audio) > peak * 0.02)
    if idx.size == 0:
        die("TTS returned silence")
    start = max(0, int(idx[0]) - int(0.03 * SR))
    end = min(audio.size, int(idx[-1]) + int(0.10 * SR))
    return audio[start:end]


def finish_line(audio: np.ndarray) -> np.ndarray:
    audio = trim_silence(np.asarray(audio, dtype=np.float32).reshape(-1))
    peak = float(np.max(np.abs(audio)))
    if peak <= 1e-9:
        die("TTS line has no signal")
    audio = audio * (PEAK / peak)
    n = min(audio.size // 2, int(FADE * SR))
    if n > 0:
        audio[:n] *= np.linspace(0.0, 1.0, n, dtype=np.float32)
        audio[-n:] *= np.linspace(1.0, 0.0, n, dtype=np.float32)
    return audio


_KOKORO = None


def kokoro_available() -> bool:
    if importlib.util.find_spec("kokoro_onnx") is None:
        return False
    return kokoro_model_paths()[0].is_file() and kokoro_model_paths()[1].is_file()


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
        die("kokoro-onnx is missing; install the optional voice tier or use --provider edge")
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
    except Exception as e:  # missing voice, unsupported lang, model error
        die(f"Kokoro failed for voice {voice!r} / lang {lang!r}: {e}")
    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    if sr != SR and audio.size:
        audio = signal.resample_poly(audio, SR, sr).astype(np.float32)
    return audio


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
            except Exception as e:  # transient network errors are worth one retry
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
            "edge-tts needs a network connection; use --provider kokoro for offline."
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
    p = str(manifest.get("provider") or "auto").lower()
    if p in ("edge", "edge-tts", "edge_tts"):
        return "edge"
    if p in ("kokoro", "kokoro-onnx", "kokoro_onnx"):
        return "kokoro"
    if p == "command":
        return "command"
    if p != "auto":
        die(f"unknown provider {p!r} (auto, edge, kokoro, command)")
    if kokoro_available():
        return "kokoro"
    if importlib.util.find_spec("edge_tts") is not None:
        return "edge"
    if os.environ.get("VOICE_CMD"):
        return "command"
    die("no TTS backend available; install edge-tts or kokoro-onnx, or set VOICE_CMD")


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
) -> np.ndarray:
    payload = {
        "backend": backend,
        "text": text,
        "voice": voice,
        "rate": rate,
        "pitch": pitch,
        "lang": lang,
        "speed": speed,
    }
    if backend == "kokoro":
        model, voices = kokoro_model_paths()
        payload["model"] = str(model.resolve()) if model.exists() else str(model)
        payload["voices"] = str(voices.resolve()) if voices.exists() else str(voices)
    path = cache_path(cache_dir, payload)
    if not force and path.is_file():
        cached = read_cached(path)
        if cached is not None:
            return cached

    if backend == "edge":
        audio = edge_synth(text, voice, rate, pitch)
    elif backend == "kokoro":
        audio = kokoro_synth(text, voice, speed, lang)
    elif backend == "command":
        audio = command_synth(text, voice, rate, pitch, lang)
    else:
        die(f"unsupported provider {backend!r}")

    audio = finish_line(audio)
    write_cached(path, audio)
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

    gap_default = float(manifest.get("gap", DEFAULT_GAP))
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
        start, scene = resolve_start(line, scenes, last_end, scene_ends, gap_default)
        if start < 0:
            die(f"line {lid!r} starts before 0 ({start:.3f}s)")

        if provider == "edge":
            voice = str(line.get("voice") or args.voice or manifest.get("voice") or ("zh-CN-XiaoxiaoNeural" if lang.lower().startswith("zh") else "en-US-EmmaMultilingualNeural"))
            rate = normalize_edge_rate(line.get("rate") or args.rate or manifest.get("rate") or line.get("speed") or manifest.get("speed"))
            pitch = normalize_edge_pitch(line.get("pitch") or args.pitch or manifest.get("pitch"))
            speed = 1.0
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

        audio = synthesize_line(provider, say, voice, rate, pitch, lang, speed, cache_dir, args.force)
        dur = len(audio) / SR
        max_dur = line.get("maxDur")
        if max_dur is None and scene is not None:
            max_dur = max(0.0, scene_end(scene) - start - 0.10)
        if max_dur is not None:
            max_dur = float(max_dur)
            if max_dur <= 0:
                die(f"line {lid!r} has no room ({max_dur:.3f}s) at {start:.3f}s")
            if dur > max_dur + 0.02:
                die(
                    f"line {lid!r} is {dur:.2f}s but its window is {max_dur:.2f}s "
                    f"(start {start:.2f}s); shorten the text or raise its rate"
                )

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
        if e["_scene_end"] is not None and e["end"] > e["_scene_end"] + 0.02:
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
            }
        )

    wav_path = out_dir / "voice.wav"
    timing_path = out_dir / "voice.timing.json"
    srt_path = out_dir / "voice.srt"
    sf.write(wav_path, mix, SR, subtype="PCM_16")
    timing = {
        "version": 1,
        "provider": provider,
        "voice": sliced[0]["voice"] if sliced else str(manifest.get("voice", "")),
        "start": round(start, 3),
        "dur": round(dur, 3),
        "fullDur": round(full_dur, 3),
        "lines": sliced,
    }
    timing_path.write_text(json.dumps(timing, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    write_srt(srt_path, [line for line in sliced if line["subtitle"]])

    print(
        json.dumps(
            {
                "out": str(wav_path),
                "timing": str(timing_path),
                "srt": str(srt_path),
                "provider": provider,
                "start": round(start, 3),
                "dur": round(dur, 3),
                "lines": len(sliced),
            },
            ensure_ascii=False,
        )
    )


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="Synthesize a voice track from a voice.json manifest")
    b.add_argument("--script", required=True, help="voice.json manifest")
    b.add_argument("--cues", default=None, help="cues.json from render.mjs (needed for scene anchors)")
    b.add_argument("--out-dir", required=True, help="where voice.wav, voice.timing.json and voice.srt go")
    b.add_argument("--start", type=float, default=0.0, help="slice start in seconds (single-scene renders)")
    b.add_argument("--dur", type=float, default=None, help="slice duration in seconds")
    b.add_argument("--provider", choices=("auto", "edge", "kokoro", "command"), default=None)
    b.add_argument("--voice", default=None)
    b.add_argument("--rate", default=None)
    b.add_argument("--pitch", default=None)
    b.add_argument("--lang", default=None)
    b.add_argument("--speed", type=float, default=None)
    b.add_argument("--cache-dir", default=None)
    b.add_argument("--force", action="store_true", help="ignore cached line audio")
    args = parser.parse_args(argv)
    if args.cmd == "build":
        build(args)


if __name__ == "__main__":
    main()
