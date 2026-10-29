#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
World 09 · 建筑蓝图升维剧场 · 34.0s 1020帧高保真成片渲染管线 (build_world_09.py)
=============================================================================
1. 启动本地静态 HTTP 容器服务
2. 使用 Playwright Headless Chromium (--use-gl=angle --use-angle=gl-egl) 渲染 1020 帧 1920x1080 画面
3. 高速流式管道注入 FFmpeg，合入 world_09_blueprint.wav 生成 world_09_blueprint.mp4
4. 抽取 20 幅代表性关键帧生成 contact_sheet_09.png (5x4 网格)
"""

import os
import sys
import io
import time
import subprocess
import threading
import http.server
import socketserver
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WORLD_DIR = str(Path(__file__).resolve().parent)
REPO_ROOT = str(Path(__file__).resolve().parents[2])
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

BASE_DIR = WORLD_DIR
SPLIT_DIR = os.path.join(BASE_DIR, "split")
AUDIO_PATH = os.path.join(BASE_DIR, "world_09_blueprint.wav")
OUTPUT_MP4 = os.path.join(BASE_DIR, "world_09_blueprint.mp4")
OUTPUT_SHEET = os.path.join(BASE_DIR, "contact_sheet_09.png")

PORT = 8039
FPS = 30
DURATION = 34.0
TOTAL_FRAMES = int(round(DURATION * FPS))  # 1020 帧

KEY_TIMESTAMPS = [
    0.8, 2.2, 2.5, 4.2, 5.2,
    7.2, 9.5, 11.8, 14.2, 16.5,
    18.8, 20.8, 22.5, 24.4, 25.5,
    27.2, 29.2, 30.8, 32.2, 33.6
]

KEY_LABELS = {
    0.8: "Act I · 蓝图左侧原点入场",
    2.2: "Act I · 追星连跳向右冲刺",
    2.5: "Act I · 咚！撞击中缝边界回弹",
    4.2: "Act II · 凑近中缝笃笃轻敲",
    5.2: "Act II · 歪头思考为何过不去",
    7.2: "Act III · 准备审读图纸参数",
    9.5: "Act III · 仰看左上立面图ELEVATION",
    11.8: "Act III · 俯看左下剖面图SECTION",
    14.2: "Act III · 读懂ISO图签公式顿悟",
    16.5: "Act IV · 闭眼蓄力发射制图脑波",
    18.8: "Act IV · 图签盖章APPROVED通过",
    20.8: "Act IV · 撕开中缝拔起远景浮岛",
    22.5: "Act IV · 3D马卡龙主浮岛拔地长成",
    24.4: "Act V · 摘下八角罗盘星高抛跨界",
    25.5: "Act V · 罗盘星点亮升降柱+自我注入",
    27.2: "Act V · 坍缩登岛3D落地激荡波纹",
    29.2: "Act V · 登岛好奇转头环顾风车樱花",
    30.8: "Act V · 草坪开怀原地欢跳两下",
    32.2: "Act V · 跃入通天星光升降柱",
    33.6: "Act V · 随星垂直飞升冲向终章云海"
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
    """生成 20 帧 5x4 网格的带时间码与剧情角标高保真画轴 Contact Sheet"""
    cols = 5
    rows = (len(KEY_TIMESTAMPS) + cols - 1) // cols
    thumb_w = 384
    thumb_h = 216

    sheet = Image.new("RGB", (cols * thumb_w, rows * thumb_h), (9, 30, 62))
    draw = ImageDraw.Draw(sheet)

    font = None
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
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

        img = Image.open(io.BytesIO(frame_bytes)).convert("RGB")
        img_thumb = img.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(img_thumb, (x0, y0))

        # 普鲁士蓝晒边框与标签
        draw.rectangle([x0, y0, x0 + thumb_w - 1, y0 + thumb_h - 1], outline=(144, 213, 255), width=2)
        draw.rectangle([x0 + 6, y0 + 6, x0 + 130, y0 + 28], fill=(9, 30, 62, 220))
        draw.text((x0 + 12, y0 + 9), f"t = {t:.2f}s", fill=(190, 235, 255), font=font)

    sheet.save(out_path, quality=95)
    print(f"[OK] Contact sheet exported: {out_path} ({sheet.width}x{sheet.height})")


def render_all():
    # 1. 检查音频文件
    if not os.path.exists(AUDIO_PATH):
        print("[Audio] Synthesizing audio first...")
        subprocess.run([sys.executable, os.path.join(BASE_DIR, "audio_09_blueprint.py")], check=True)

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
                "--disable-accelerated-2d-canvas",
                "--disable-web-security",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        stage_url = f"http://127.0.0.1:{PORT}/split/render_stage.html"
        page.goto(stage_url, wait_until="domcontentloaded")
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

            if f % 100 == 0 or f == TOTAL_FRAMES - 1:
                fps_render = (f + 1) / max(0.001, time.time() - t0)
                print(f"  -> Rendered frame {f+1:04d}/{TOTAL_FRAMES} (t={cur_t:.2f}s) @ {fps_render:.1f} fps")

        proc.stdin.close()
        proc.wait()
        browser.close()

    httpd.shutdown()
    render_dur = time.time() - t0
    print(f"[Done] Video rendered in {render_dur:.1f}s ({TOTAL_FRAMES/render_dur:.1f} fps)!")

    # 5. 生成质检分镜一览图
    build_contact_sheet(keyframes_dict, OUTPUT_SHEET)

    mp4_size = os.path.getsize(OUTPUT_MP4) / (1024 * 1024)
    print(f"[Complete] Output MP4: {OUTPUT_MP4} ({mp4_size:.2f} MB)")


if __name__ == "__main__":
    render_all()
