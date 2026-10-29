---
name: world-02-pixel
description: 16-Bit 像素横版画风与复古游戏媒介管线（320×180 原生低分画布 + 4×4 Bayer 矩阵有序抖动天空 + 6× NEAREST 整数倍锐利放大 + 视差像素云山 + 弹簧跳板/问号砖/像素HUD）；支持 styles/style_02_pixel.py 去固有化纯画风复用与 worlds/world_02_pixel 基准剧场管线。
version: 1.0.0
category: procedural-medium
stack:
  - python
  - pycairo
  - pillow
  - numpy
  - audio-dsp
---

# World 02 · 16-Bit 像素艺术媒介 (`style_02_pixel` / `world_02_pixel`)

- **画廊纯风格复用入口 (Content-Agnostic Style Entry)**：[`styles/style_02_pixel.py`](../../styles/style_02_pixel.py) — 调用 `render_keyframe()` 或 `get_static_world_background()` 可脱离特定剧情，直接生成 1920×1080（由 320×180 原生像素 6× NEAREST 放大）的 16-Bit 黄金时代像素风场景、Bayer 抖动渐变天空与像素游戏 HUD。
- **基准剧场样片入口 (Benchmark Theatre Entry)**：[`worlds/world_02_pixel/`](../../worlds/world_02_pixel/) — 使用画廊材质试金石演练 28.0s / 840f 横版闯关物理与 SNES 芯片配乐：`sim_02_pixel.simulate_world_02()` → `level_02_pixel.render_frame_from_state(state)` → `build_world_02.py`。
- **定位**：90 年代 16-Bit 主机（SNES / Mega Drive）原生低分辨率像素美学；严格禁止双线性模糊与半透明抗锯齿杂边。

---

## 1. 视觉主体材质与构图映射 (`Visual Subject Mapping`)

本风格遵循**去固有化内容原则**。当将任意用户主体（如产品图标、复古 UI 窗口、载具、建筑地标或游戏精灵）放入本风格时，遵循以下像素化法则：

| 视觉要素 | 分辨率与调色板契约 | 任意主体的 16-Bit 像素转译法则 |
| :-- | :-- | :-- |
| **画布与视口层** | 原生 `320×180` 逻辑网格 → `6×` `Image.Resampling.NEAREST` 放大至 `1920×1080` | 严禁在 `1920×1080` 上直接画粗线条伪装像素！一切几何与精灵必须在 `320×180`（或高精视口层）按整数像素格对齐绘制，再做最近邻无损放大。 |
| **大面积背景与渐变层** | 4×4 Bayer 有序抖动矩阵 (`Bayer Dithering`) + 三层视差卷轴 | 天空、水体或光晕严禁使用连续平滑渐变，必须通过 4×4 Bayer 阈值矩阵量化为阶梯状交错像素点阵，搭配远山、云层与草地砖块的差异化水平视差系数。 |
| **前景主体与 UI 层** | `1px` 深色外轮廓 (`#141020`) + 阶梯色带 (`Step Ramp`) + 顶部等宽像素 HUD | 任何前景主体均采用硬边索引色填充、左上角 `1~2px` 纯白高光点与底部贴地阴影；挤压形变时底部接触行（`foot_y`）必须锚定地面，防止产生半像素悬浮。 |

---

## 2. 核心实现与工程复用要点

- **核心函数**：
  - `styles.style_02_pixel.get_static_world_background()`：生成并缓存 5 屏宽 Bayer 矩阵抖动天空、远景像素山脉与砖块地形底图。
  - `styles.style_02_pixel.render_keyframe()`：独立渲染 1920×1080 16-Bit 像素画风代表作关键帧（零音频依赖）。
  - `level_02_pixel.render_frame_from_state(state)`：单帧合成管线（静态视差层 → 动态机关/精灵层 → 视口平滑裁切 → 顶部 `SCORE / COINS / WORLD / TIME` 像素 HUD）。
  - `audio_02_pixel.render_world_02_audio(events, out_wav)`：SNES 采样管弦/方波混合 BGM + 弹簧/顶砖/金币/烟花拟音，母带 `-14.0 LUFS`。
- **基准剧场时间锚点 (`worlds/world_02_pixel`)**：`0.0–4.2s` 像素方块拼合绿管 → `4.2–8.8s` 弹簧跳板飞越尖刺坑 → `8.8–14.5s` 触发隐藏砖生长云梯 → `14.5–19.2s` 登云梯顶开 `[?]` 砖释放无敌星 → `19.2–24.8s` 彩虹残影冲刺、降旗与三朵像素烟花 → `24.8–28.0s` 城堡黑门与赛博裂缝转场。
- **工程避坑指南**：
  1. **抗锯齿禁令**：Cairo 绘制低分像素图层时需使用 `cairo.ANTIALIAS_NONE` 或在 Pillow 整数网格中操作，避免产生半透明灰边。
  2. **字体回退机制**：像素 HUD 与飘字统一走 `get_pil_font()`，不硬编码宿主机字体路径。
  3. **底部锚定法则**：对任何像素精灵做垂直挤压拉伸时，必须以脚底 `foot_y` 为不动点向上缩放，否则会出现穿地或浮空 1 像素的视觉瑕疵。

## 相关文件

- [`../../styles/style_02_pixel.py`](../../styles/style_02_pixel.py)
- [`STORY.md`](../../worlds/world_02_pixel/STORY.md)
- [`sim_02_pixel.py`](../../worlds/world_02_pixel/sim_02_pixel.py)
- [`level_02_pixel.py`](../../worlds/world_02_pixel/level_02_pixel.py)
- [`audio_02_pixel.py`](../../worlds/world_02_pixel/audio_02_pixel.py)
- [`build_world_02.py`](../../worlds/world_02_pixel/build_world_02.py)
