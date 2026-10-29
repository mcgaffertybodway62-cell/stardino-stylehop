#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
World 05 · 立体书与千纸鹤之谷 · 30.0s 900帧成片渲染管线 (build_world_05.py)
=============================================================================
1. 检查并生成 30.0s 48kHz 立体声音轨 (world_05_paper.wav)
2. 启动本地静止 HTTP 容器服务托管 split/ 目录
3. 使用 Playwright Headless Chromium (--use-gl=angle --use-angle=gl-egl)
   逐帧执行 window.stepFrame(t)，截取 900 帧 1920x1080 画面
4. 高速流式管道实时注入 FFmpeg 合成高码率 world_05_paper.mp4
5. 抽取 16 幅代表性关键帧生成 4x4 分镜表 contact_sheet_05.png
"""

import os
import sys
import time
import subprocess
import threading
import http.server
import socketserver
import io
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WORLD_DIR = str(Path(__file__).resolve().parent)
REPO_ROOT = str(Path(__file__).resolve().parents[2])
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

BASE_DIR = WORLD_DIR
SPLIT_DIR = os.path.join(BASE_DIR, "split")
AUDIO_PATH = os.path.join(BASE_DIR, "world_05_paper.wav")
OUTPUT_MP4 = os.path.join(BASE_DIR, "world_05_paper.mp4")
OUTPUT_SHEET = os.path.join(BASE_DIR, "contact_sheet_05.png")

PORT = 8055
FPS = 30
DURATION = 30.0
TOTAL_FRAMES = int(round(DURATION * FPS))  # 900 帧

KEY_TIMESTAMPS = [
    0.1, 0.8, 1.6, 4.5,
    6.2, 9.5, 11.4, 13.8,
    16.0, 20.2, 22.6, 24.2,
    25.8, 26.8, 28.9, 29.8
]

BEAT_NAMES = {
    0.1: "Handover: Cinnabar Cover",
    0.8: "Beat 1: Cover Peel & Rise",
    1.6: "Beat 1: Awake Facing Center",
    4.5: "Beat 2: Peer Down Equal Eyes",
    6.2: "Beat 2: Call & Response (♪)",
    9.5: "Beat 3: Crane Floats Up",
    11.4: "Beat 3: Leap on Crane (♥)",
    13.8: "Beat 3: Crane Out of Screen",
    16.0: "Beat 4: 180° Clean Page Flip",
    20.2: "Beat 5: Fly Back from Sky",
    22.6: "Beat 5: Bow Farewell & Gift (♥ ✦)",
    24.2: "Beat 5: Crane Flies Away Out",
    25.8: "Beat 6: Slime Leaps Up Bridge",
    26.8: "Beat 6: Arch Bridge Star (✦)",
    28.9: "Beat 6: Dash toward Pavilion",
    29.8: "Handover: Zoetrope Glass"
}


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
    """生成 16 帧 4x4 网格的高保真分镜表 Contact Sheet (1920x1080)"""
    cols = 4
    rows = 4
    thumb_w = 480
    thumb_h = 270

    sheet = Image.new("RGB", (cols * thumb_w, rows * thumb_h), (18, 8, 10))
    draw = ImageDraw.Draw(sheet)

    font_label = None
    font_sub = None
    try:
        font_label = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
        font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
    except Exception:
        font_label = ImageFont.load_default()
        font_sub = ImageFont.load_default()

    for idx, t in enumerate(KEY_TIMESTAMPS):
        frame_bytes = keyframes_dict.get(t)
        if not frame_bytes:
            continue
        c = idx % cols
        r = idx // cols
        x0 = c * thumb_w
        y0 = r * thumb_h

        img = Image.open(io.BytesIO(frame_bytes)).convert("RGB")
        img_thumb = img.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(img_thumb, (x0, y0))

        # Gold / Warm border
        draw.rectangle([x0, y0, x0 + thumb_w - 1, y0 + thumb_h - 1], outline=(218, 165, 32), width=1)

        # Label tag background
        beat_title = BEAT_NAMES.get(t, "")
        draw.rectangle([x0 + 10, y0 + 10, x0 + 260, y0 + 52], fill=(15, 6, 8, 220))
        draw.rectangle([x0 + 10, y0 + 10, x0 + 260, y0 + 52], outline=(243, 210, 121), width=1)
        draw.text((x0 + 18, y0 + 14), f"t = {t:.1f}s", fill=(255, 235, 175), font=font_label)
        draw.text((x0 + 18, y0 + 33), beat_title, fill=(230, 200, 140), font=font_sub)

    sheet.save(out_path, quality=95)
    print(f"[OK] Contact sheet exported: {out_path} ({sheet.width}x{sheet.height})")


def render_all():
    # 1. 检查音频文件
    if not os.path.exists(AUDIO_PATH):
        print("[Audio] Synthesizing 30.0s soundtrack first...")
        subprocess.run([sys.executable, os.path.join(BASE_DIR, "audio_05_paper.py")], check=True)

    # 2. 启动 HTTP 服务
    httpd = start_server()
    time.sleep(1.0)

    # 3. 准备 FFmpeg 视频合成管道
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
        "-t", str(DURATION),
        OUTPUT_MP4
    ]
    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE)

    keyframes_dict = {}
    target_key_frames = {int(round(t * FPS)): t for t in KEY_TIMESTAMPS}

    # 4. 启动 Playwright Chromium
    from playwright.sync_api import sync_playwright

    print(f"[Render] Starting 900 frames rendering to FFmpeg pipeline...")
    t0 = time.time()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--use-gl=angle",
                "--use-angle=gl-egl",
                "--disable-accelerated-2d-canvas",
                "--disable-web-security",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        stage_url = f"http://127.0.0.1:{PORT}/split/render_stage.html"
        print(f"[Stage] Opening {stage_url} ...")
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

            if f % 90 == 0 or f == TOTAL_FRAMES - 1:
                fps_render = (f + 1) / max(0.001, time.time() - t0)
                eta = (TOTAL_FRAMES - (f + 1)) / max(0.001, fps_render)
                print(f"  -> Rendered frame {f+1:03d}/{TOTAL_FRAMES} (t={cur_t:.2f}s) @ {fps_render:.1f} fps (ETA: {eta:.1f}s)")

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
