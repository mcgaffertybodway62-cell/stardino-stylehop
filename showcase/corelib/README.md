# `corelib/` —— showcase 九界短片共用的 Python 纯工具层

## 核心设计原则

1. **基层绝对中立，只做纯工程提效，零审美预设**：`math_ops.py` / `camera.py` / `pipeline.py` / `audio_dsp.py` 只提供数学缓动、2D 摄像机、编码推流与 48kHz 声学 DSP，不含任何固定画面风格、配色或片尾包装。视觉效果全部写在 `showcase/styles/*.py` 与 `showcase/worlds/*`。
2. **仅供 `showcase/` 使用**：画廊本体（`styles/` `engine/` `tools/` `gallery/`）不依赖本目录。

## 目录结构

```text
corelib/
├── __init__.py      # 导出纯工具层 API
├── math_ops.py      # clamp, lerp, smoothstep, ease_out_*, spring_val
├── camera.py        # Camera2D（推拉摇移 / 震动 / 世界↔屏幕投影）+ get_font 字体缓存
├── pipeline.py      # 单流与多进程分片推流 (render_video_parallel)、缩略图网格 (generate_contact_sheet)
└── audio_dsp.py     # 48kHz 声学 DSP：滤波器、包络、噪声、混响 IR、模态共振、母带导出
```

## 调用方式

```python
from corelib import (
    clamp, lerp, smoothstep, smootherstep, ease_out_cubic, ease_out_back, spring_val,
    Camera2D, get_font,
    render_video_streaming, render_video_parallel, generate_contact_sheet,
    SR, make_env, exp_decay, butter_filter, pink_noise, brown_noise,
    pan_stereo, mix_into, build_reverb_ir, apply_reverb, modal_strike, master_and_export_wav,
)
```

九界短片的完整用法见各 `showcase/worlds/world_XX/build_world_XX.py`。

## 关于 Web 渲染管线

本目录曾同时承载 `html_canvas/`（`dom_shader.js` / `browser.mjs` / `render.mjs`）这一早期 WebGL2 排版管线，**该目录未随仓库分发**。现行 HTML-in-Canvas 管线在仓库根的 `engine/` 与 `tools/`：

```bash
# 渲染任一融合旗舰页的分镜表与 MP4
node tools/render.mjs --page showcase/fusion/inkwash-paper-scroll \
  --sheet <work-dir>/inkwash-paper-scroll_contact_sheet.jpg \
  --video <work-dir>/inkwash-paper-scroll.mp4
```

融合页自带的着色器入口见 [`../fusion/dom_shader.js`](../fusion/dom_shader.js)（`createDomShaderStage(canvas, domElement, fragmentShaderSource, uniformNames)`）。
