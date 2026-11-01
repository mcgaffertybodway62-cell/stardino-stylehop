#!/usr/bin/env python3
"""Sample-library fetcher and indexer for StyleHop (`tools/samples.py`).

The repository never contains audio (`.gitignore` drops *.wav/*.mp3/*.ogg). This tool keeps
that promise while still letting a score use real recordings:

  * `fetch`   -- download the curated CC0 files listed in `tools/samples.manifest.json`,
                 verify their sha256, resample to 48 kHz stereo and write an index.
  * `import`  -- register a manually downloaded pack (e.g. the Sonniss GDC bundle, which is
                 gigabyte-scale behind a Cloudflare gate) from a folder you point at.
  * `verify`  -- re-check that every indexed file still exists and still matches its hash.
  * `list`    -- print what is available and under which licence.

Everything lands in `../out/samples-cache/` (next to the repo, like every other artifact):

  out/samples-cache/raw/<pack>/<original path>   verified downloads, untouched
  out/samples-cache/wav/<id>.wav                 48 kHz stereo s16, what `sound.py` reads
  out/samples-cache/index.json                   id -> file, licence, duration, peak, tags

`tools/sound.py --samples <style samples.json>` overlays indexed one-shots on the synthesized
score, so a missing cache degrades to pure synthesis instead of failing the render.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
from scipy.io import wavfile

REPO_ROOT = Path(__file__).resolve().parent.parent
MANIFEST = Path(__file__).resolve().parent / "samples.manifest.json"
CACHE = (REPO_ROOT.parent / "out" / "samples-cache").resolve()
RAW = CACHE / "raw"
WAV = CACHE / "wav"
INDEX = CACHE / "index.json"

SR = 48000
RAW_BASE = {
    "vcsl": "https://raw.githubusercontent.com/sgossner/VCSL/master",
    "vsco2": "https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master",
}


def load_manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def pack_by_id(manifest: dict, pack_id: str) -> dict:
    for p in manifest["packs"]:
        if p["id"] == pack_id:
            return p
    raise SystemExit(f"samples.py: unknown pack {pack_id!r}")


def slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return re.sub(r"-{2,}", "-", s)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, dest: Path) -> None:
    """curl first (much faster and more reliable on this host), urllib as the fallback."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    if shutil.which("curl"):
        rc = subprocess.run(
            ["curl", "-sSL", "--fail", "--max-time", "300", "-o", str(tmp), url],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        ).returncode
        if rc == 0 and tmp.is_file() and tmp.stat().st_size > 0:
            tmp.replace(dest)
            return
    with urllib.request.urlopen(url, timeout=120) as resp, tmp.open("wb") as fh:
        shutil.copyfileobj(resp, fh)
    tmp.replace(dest)


def decode(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-ac", "2", "-ar", str(SR), "-c:a", "pcm_s16le", str(dest)],
        check=True,
    )


def stats(path: Path) -> tuple[float, float]:
    rate, data = wavfile.read(str(path))
    if data.ndim == 1:
        data = np.stack([data, data], axis=1)
    peak = float(np.max(np.abs(data.astype(np.float32))) / 32768.0) if data.size else 0.0
    return len(data) / float(rate), peak


def normalize_wav(path: Path, target: float = 0.9) -> tuple[float, float]:
    """Recorded velocity layers differ by 30 dB; normalise the cache so `gain` means intent."""
    rate, data = wavfile.read(str(path))
    if data.ndim == 1:
        data = np.stack([data, data], axis=1)
    peak = float(np.max(np.abs(data.astype(np.float32))) / 32768.0) if data.size else 0.0
    if peak > 1e-6:
        data = np.clip(data.astype(np.float32) * (target / peak), -32768, 32767).astype(np.int16)
        wavfile.write(str(path), rate, data)
    return len(data) / float(rate), peak


def read_index() -> dict:
    if INDEX.is_file():
        return json.loads(INDEX.read_text(encoding="utf-8"))
    return {"version": 1, "samples": {}}


def write_index(index: dict) -> None:
    index["version"] = 1
    index["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    index["cache"] = str(CACHE)
    INDEX.parent.mkdir(parents=True, exist_ok=True)
    INDEX.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def register(index: dict, entry: dict) -> None:
    index["samples"][entry["id"]] = entry


def fetch(args) -> None:
    manifest = load_manifest()
    index = read_index()
    packs = [pack_by_id(manifest, args.pack)] if args.pack else [p for p in manifest["packs"] if not p.get("manual")]
    added = 0
    for pack in packs:
        base = RAW_BASE.get(pack["id"])
        if not base:
            print(f"[skip] {pack['id']}: no raw base URL (manual pack)", file=sys.stderr)
            continue
        for f in pack.get("files", []):
            raw = RAW / pack["id"] / f["path"]
            wav = WAV / f"{f['id']}.wav"
            if not raw.is_file() or args.force:
                url = base + "/" + urllib.request.quote(f["path"])
                print(f"[get ] {pack['id']}/{f['id']} <- {url}", flush=True)
                download(url, raw)
            got = sha256_file(raw)
            if f.get("sha256") and got != f["sha256"]:
                raise SystemExit(f"samples.py: sha256 mismatch for {raw}\n  want {f['sha256']}\n  got  {got}")
            if not wav.is_file() or args.force:
                decode(raw, wav)
            dur, peak_raw = normalize_wav(wav)
            peak = round(min(1.0, 0.9), 3)
            register(
                index,
                {
                    "id": f["id"],
                    "file": str(wav.relative_to(CACHE)),
                    "pack": pack["id"],
                    "license": pack["license"],
                    "licenseUrl": pack["licenseUrl"],
                    "redistributable": pack["redistributable"],
                    "attribution": pack.get("attribution", ""),
                    "sha256": f.get("sha256", ""),
                    "raw": str(raw.relative_to(CACHE)),
                    "dur": round(dur, 3),
                    "peak": peak,
                    "peakRaw": round(peak_raw, 5),
                    "tags": f.get("tags", []),
                    "gain": f.get("gain", 1.0),
                },
            )
            added += 1
            print(f"[ok  ] {f['id']:<16} {dur:6.2f}s peak {peak:.2f}")
    write_index(index)
    print(f"samples.py: {added} file(s) registered, index -> {INDEX}")


def import_pack(args) -> None:
    manifest = load_manifest()
    pack = pack_by_id(manifest, args.pack)
    src = Path(args.src).expanduser().resolve()
    if not src.is_dir():
        raise SystemExit(f"samples.py: not a folder: {src}")
    index = read_index()
    exts = {".wav", ".flac", ".aif", ".aiff", ".mp3", ".ogg"}
    files = sorted(p for p in src.rglob("*") if p.suffix.lower() in exts)
    if not files:
        raise SystemExit(f"samples.py: no audio under {src}")
    registered = 0
    for path in files:
        ident = slug(args.prefix + path.stem)
        wav = WAV / f"{ident}.wav"
        decode(path, wav)
        dur, peak = stats(wav)
        register(
            index,
            {
                "id": ident,
                "file": str(wav.relative_to(CACHE)),
                "pack": pack["id"],
                "license": pack["license"],
                "licenseUrl": pack["licenseUrl"],
                "redistributable": False,
                "attribution": pack.get("attribution", ""),
                "sha256": "",
                "dur": round(dur, 3),
                "peak": round(peak, 4),
                "tags": [slug(t) for t in args.tag],
                "gain": 1.0,
                "sourceFile": str(path),
            },
        )
        registered += 1
    write_index(index)
    print(f"samples.py: imported {registered} file(s) from {src} into pack {pack['id']}")


def verify(args) -> None:
    index = read_index()
    missing, bad = [], []
    for ident, entry in index.get("samples", {}).items():
        wav = CACHE / entry["file"]
        if not wav.is_file():
            missing.append(ident)
            continue
        raw_rel = entry.get("raw")
        if raw_rel and entry.get("sha256"):
            raw = CACHE / raw_rel
            if raw.is_file() and sha256_file(raw) != entry["sha256"]:
                bad.append(ident)
    present = len(index.get("samples", {})) - len(missing)
    print(json.dumps({"index": str(INDEX), "present": present, "missing": missing, "hashMismatch": bad}, indent=2))
    if missing or bad:
        raise SystemExit(1)


def list_samples(args) -> None:
    index = read_index()
    rows = index.get("samples", {})
    if not rows:
        print("samples.py: cache is empty; run `python3 tools/samples.py fetch`")
        return
    for ident, entry in sorted(rows.items()):
        print(f"{ident:<22} {entry['pack']:<12} {entry['dur']:6.2f}s  {entry.get('license',''):<52} {entry.get('file','')}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Fetch/index the sample sources used by tools/sound.py")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_fetch = sub.add_parser("fetch", help="download and verify the curated CC0 files")
    p_fetch.add_argument("--pack", default=None, help="only this pack id")
    p_fetch.add_argument("--force", action="store_true", help="re-download even if cached")
    p_fetch.set_defaults(func=fetch)

    p_imp = sub.add_parser("import", help="register a manually downloaded pack folder")
    p_imp.add_argument("--pack", required=True)
    p_imp.add_argument("--src", required=True)
    p_imp.add_argument("--prefix", default="")
    p_imp.add_argument("--tag", action="append", default=[])
    p_imp.set_defaults(func=import_pack)

    p_ver = sub.add_parser("verify", help="check the cache against the index")
    p_ver.set_defaults(func=verify)

    p_list = sub.add_parser("list", help="print the indexed samples")
    p_list.set_defaults(func=list_samples)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
