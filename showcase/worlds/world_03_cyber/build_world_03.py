#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
World 03 · 赛博霓虹疾驰列车 · 24.0s 720帧高配成片渲染管线 (build_world_03.py)
=============================================================================
1. 启动本地静止 HTTP 容器服务
2. 使用 Playwright Headless Chromium (--use-gl=angle --use-angle=gl-egl) 渲染 720 帧 1920x1080 画面
3. 高速流式管道注入 FFmpeg，合入 audio_03_cyber.wav 生成 world_03_cyber.mp4
4. 抽取 15 幅代表性关键帧生成 contact_sheet_03.png
"""

import os
import sys
import time
import subprocess
import threading
import http.server
import socketserver
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WORLD_DIR = str(Path(__file__).resolve().parent)
REPO_ROOT = str(Path(__file__).resolve().parents[2])
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

BASE_DIR = WORLD_DIR
SPLIT_DIR = os.path.join(BASE_DIR, "split")
AUDIO_PATH = os.path.join(BASE_DIR, "audio_03_cyber.wav")
OUTPUT_MP4 = os.path.join(BASE_DIR, "world_03_cyber.mp4")
OUTPUT_SHEET = os.path.join(BASE_DIR, "contact_sheet_03.png")

PORT = 8033
FPS = 30
DURATION = 24.0
TOTAL_FRAMES = int(round(DURATION * FPS)) # 720 帧

KEY_TIMESTAMPS = [
    2.4, 5.2, 6.3, 8.80, 10.10,
    11.88, 13.68, 15.10, 15.45, 16.15,
    16.90, 18.25, 19.40, 20.05, 21.15
]


class QuietHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def start_server():
    os.chdir(BASE_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("", PORT), QuietHTTPHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    print(f"[HTTP] Static server running on http://127.0.0.1:{PORT}")
    return httpd


def build_contact_sheet(keyframes_dict: dict, out_path: str):
    """生成 15 帧 5x3 网格的带时间码角标高保真画轴 Contact Sheet"""
    cols = 5
    rows = (len(KEY_TIMESTAMPS) + cols - 1) // cols
    thumb_w = 384
    thumb_h = 216

    sheet = Image.new("RGB", (cols * thumb_w, rows * thumb_h), (12, 14, 20))
    draw = ImageDraw.Draw(sheet)

    font = None
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
    except Exception:
        font = ImageFont.load_default()

    for idx, t in enumerate(KEY_TIMESTAMPS):
        frame_bytes = keyframes_dict.get(t)
        if not frame_bytes:
            continue
        c = idx % cols
        r = idx // cols
        x0 = c * thumb_w
        y0 = r * thumb_h

        import io
        img = Image.open(io.BytesIO(frame_bytes)).convert("RGB")
        img_thumb = img.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(img_thumb, (x0, y0))

        # 边框与标签
        draw.rectangle([x0, y0, x0 + thumb_w - 1, y0 + thumb_h - 1], outline=(0, 240, 255), width=1)
        draw.rectangle([x0 + 8, y0 + 8, x0 + 115, y0 + 30], fill=(0, 0, 0, 200))
        draw.text((x0 + 14, y0 + 10), f"t = {t:.2f}s", fill=(0, 240, 255), font=font)

    sheet.save(out_path, quality=95)
    print(f"[OK] Contact sheet exported: {out_path} ({sheet.width}x{sheet.height})")


def render_all():
    # 1. 合成最新 24.0s 音频文件
    print("[Audio] Synthesizing 24.0s audio_03_cyber.wav...")
    subprocess.run([sys.executable, os.path.join(BASE_DIR, "audio_03_cyber.py")], check=True)

    # 2. 启动 HTTP 服务
    httpd = start_server()
    time.sleep(1.0)

    # 3. 准备 FFmpeg 子进程
    ffmpeg_cmd = [
        "ffmpeg", "-y", "-hide_banner",
        "-f", "image2pipe",
        "-vcodec", "mjpeg",
        "-r", str(FPS),
        "-i", "-",
        "-i", AUDIO_PATH,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "17",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "256k",
        "-shortest",
        OUTPUT_MP4
    ]
    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE)

    keyframes_dict = {}
    target_key_frames = {int(round(t * FPS)): t for t in KEY_TIMESTAMPS}

    # 4. 启动 Playwright Chromium
    from playwright.sync_api import sync_playwright

    print(f"[Render] Starting {TOTAL_FRAMES} frames rendering to FFmpeg pipeline...")
    t0 = time.time()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--use-gl=angle",
                "--use-angle=gl-egl",
                "--disable-web-security",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        stage_url = f"http://127.0.0.1:{PORT}/split/render_stage.html"
        page.goto(stage_url)
        page.wait_for_function("() => window.__STAGE_READY__ === true", timeout=30000)
        print("[Stage] Stage loaded and initialized successfully!")

        # 预热首帧
        page.evaluate("(t) => window.stepFrame(t)", 0.0)
        time.sleep(0.5)

        for f in range(TOTAL_FRAMES):
            cur_t = f / float(FPS)
            page.evaluate("(t) => window.stepFrame(t)", cur_t)

            frame_data = page.screenshot(type="jpeg", quality=95)
            proc.stdin.write(frame_data)

            if f in target_key_frames:
                target_sec = target_key_frames[f]
                keyframes_dict[target_sec] = frame_data

            if f % 60 == 0 or f == TOTAL_FRAMES - 1:
                fps_render = (f + 1) / max(0.001, time.time() - t0)
                print(f"  -> Rendered frame {f+1:03d}/{TOTAL_FRAMES} (t={cur_t:.2f}s) @ {fps_render:.1f} fps")

        proc.stdin.close()
        proc.wait()
        browser.close()

    httpd.shutdown()
    render_dur = time.time() - t0
    print(f"[Done] Video rendered in {render_dur:.1f}s ({TOTAL_FRAMES/render_dur:.1f} fps)!")

    # 5. 生成质检一览图
    build_contact_sheet(keyframes_dict, OUTPUT_SHEET)

    mp4_size = os.path.getsize(OUTPUT_MP4) / (1024 * 1024)
    print(f"[Complete] Output MP4: {OUTPUT_MP4} ({mp4_size:.2f} MB)")


if __name__ == "__main__":
    render_all()
