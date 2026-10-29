#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
World 08 · 定格软陶手作书桌 · 15.0s 450帧高配成片渲染管线 (build_world_08.py)
=============================================================================
1. 启动本地静态 HTTP 容器服务
2. 使用 Playwright Headless Chromium (--use-gl=angle --use-angle=gl-egl) 渲染 450 帧 1920x1080 画面
3. 高速流式管道注入 FFmpeg，合入 world_08_clay.wav 生成 world_08_clay.mp4
4. 抽取 16 幅关键帧生成 4x4 质检分镜表 contact_sheet_08.png
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
AUDIO_PATH = os.path.join(BASE_DIR, "world_08_clay.wav")
OUTPUT_MP4 = os.path.join(BASE_DIR, "world_08_clay.mp4")
OUTPUT_SHEET = os.path.join(BASE_DIR, "contact_sheet_08.png")

PORT = 8088
FPS = 30
DURATION = 15.0
TOTAL_FRAMES = int(round(DURATION * FPS)) # 450 帧

# 16 帧覆盖六幕关键节拍与首尾转场
KEY_TIMESTAMPS = [
    0.20,  # 1. 喇叭口 Iris-In 展开
    0.80,  # 2. 喇叭膛内吹出史莱姆
    1.30,  # 3. 史莱姆落地晕眩翻滚
    2.20,  # 4. 停稳张望铅笔积木，引路星升空
    3.40,  # 5. 追击引路星奔向咖啡河
    4.20,  # 6. 焦糖咖啡河岸急刹压扁
    4.80,  # 7. 发现多米诺骨牌后退蓄力
    5.30,  # 8. 冲撞首块粉彩多米诺骨牌
    5.90,  # 9. 5 连骨牌倾倒跨河搭桥
    6.80,  # 10. 踏彩色骨牌桥笑眼过河
    8.20,  # 11. 薄荷马卡龙蹦床初跳
    9.20,  # 12. 樱粉马卡龙二次蓄力弹跳
    10.30, # 13. 柠檬黄马卡龙极限高抛
    11.80, # 14. 沿木尺斜坡加速冲向精装书
    12.70, # 15. 书本平台吸入指纹粘土星(✦ ✦)
    14.50  # 16. 跃入万花筒目镜与蓝图制图转场
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
    """生成 16 帧 4x4 网格的带时间码角标高保真画轴 Contact Sheet"""
    cols = 4
    rows = 4
    thumb_w = 480
    thumb_h = 270

    sheet = Image.new("RGB", (cols * thumb_w, rows * thumb_h), (26, 20, 28))
    draw = ImageDraw.Draw(sheet)

    font = None
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
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

        # 暖金粘土风格边框与时间码标签
        draw.rectangle([x0, y0, x0 + thumb_w - 1, y0 + thumb_h - 1], outline=(245, 180, 75), width=2)
        draw.rectangle([x0 + 10, y0 + 10, x0 + 130, y0 + 36], fill=(18, 14, 22, 220))
        draw.text((x0 + 16, y0 + 12), f"t = {t:.2f}s", fill=(255, 205, 90), font=font)

    sheet.save(out_path, quality=95)
    print(f"[OK] Contact sheet exported: {out_path} ({sheet.width}x{sheet.height})")


def render_all():
    # 1. 检查音频文件
    if not os.path.exists(AUDIO_PATH):
        print("[Audio] Synthesizing audio first...")
        subprocess.run([sys.executable, os.path.join(BASE_DIR, "audio_08_clay.py")], check=True)

    # 2. 启动 HTTP 服务
    httpd = start_server()
    time.sleep(1.0)

    # 3. 准备 FFmpeg 视频编码管道
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

    print(f"[Render] Starting 450 frames rendering to FFmpeg pipeline...")
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

            if f % 45 == 0 or f == TOTAL_FRAMES - 1:
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
