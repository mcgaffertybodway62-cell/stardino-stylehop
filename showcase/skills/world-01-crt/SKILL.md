---
name: world-01-crt
description: CRT 曲面磷光字符画风与终端媒介管线（桶形畸变 + RGB 色差 + 扫描线辉光 + ASCII 字符局部坐标映射 + 交互式报错弹窗/按键编译/窗口阶梯）；支持 styles/style_01_crt.py 去固有化纯画风复用与 worlds/world_01_crt 基准剧场管线。
version: 1.0.0
category: procedural-medium
stack:
  - python
  - pycairo
  - numpy
  - pillow
  - audio-dsp
---

# World 01 · 矩阵终端磷光媒介 (`style_01_crt` / `world_01_crt`)

- **画廊纯风格复用入口 (Content-Agnostic Style Entry)**：[`styles/style_01_crt.py`](../../styles/style_01_crt.py) — 调用 `render_keyframe()`、`render_world(cam_x, cam_y, t, state=None)` 或 `_apply_crt_post_processing(img)` 可脱离剧情状态机与特定角色，直接将任意几何/文字排版渲染为 1920×1080 单色/局部彩色 CRT 磷光显像管画面。
- **基准剧场样片入口 (Benchmark Theatre Entry)**：[`worlds/world_01_crt/`](../../worlds/world_01_crt/) — 使用画廊材质试金石演练 26.0s / 780f 完整状态机与 48kHz 音频同步：`sim_01_crt.run_simulation()` → `level_01_crt.render_frame_from_state(state)` → `build_world_01.py`。
- **定位**：单色磷光 CRT 显像管内部空间；终端命令行、报错弹窗、立体窗口阶梯与机械键帽均为可交互物理实体。

---

## 1. 视觉主体材质与构图映射 (`Visual Subject Mapping`)

本风格遵循**去固有化内容原则**。当将任意用户主体（如代码架构图、科技产品、几何徽标、数据终端或引导主体）放入本风格时，遵循以下媒介转译法则：

| 视觉要素 | 媒介材质与色板 | 任意主体的 CRT 磷光转译法则 |
| :-- | :-- | :-- |
| **环境与命令界面层** | 暗底 `#030A05` + P31 磷光绿 (`#18FF62` / `#087830`) + 琥珀告警色 (`#FFB000` / `#FF3B30`) | 背景由高对比等宽终端代码流、ASCII 边框窗口 (`+---+`)、`ERR_403` 权限拦截弹窗与三维透视机械键帽 (`[ ./compile ]`, `[ ENTER ↵ ]`) 构成。 |
| **核心焦点主体层** | 局部 UV 绑定的 ASCII 字符阵列 (`@ # * + : .`) + 唯一高饱和三色极光特权 | 焦点主体不画平滑纯色填充，而是将主体表面拆解为**绑定在局部坐标 `(du, dv)` 上的高密度发光 ASCII 字符网格**；主体运动或旋转时，字符随表面法线做透视偏移，避免沦为静态背景贴图。 |
| **全局显像管光学层 (`_apply_crt_post_processing`)** | 径向桶形畸变 (`k = 0.14`) + 边缘 RGB 色差 + 2px 水平扫描线 + 玻璃暗角与辉光 | 所有图形先在标准 1920×1080 平面绘制，最后统一经过一次桶形重映射与高斯荧光 Bloom，赋予真实的球面显像管玻璃厚度感。 |

---

## 2. 核心实现与工程复用要点

- **核心函数**：
  - `styles.style_01_crt._apply_crt_post_processing(img)`：桶形坐标重映射 + RGB 通道径向色散 + 偶数年扫描线压暗 + 3D 显像管外框 + 荧光辉光，是全部 CRT 观感的唯一出口（可直接套用于任何 PIL Image）。
  - `styles.style_01_crt.render_world(cam_x, cam_y, t, state)` / `render_keyframe()`：不依赖 sim 的自洽场景渲染，可直接出单帧。
  - `level_01_crt.draw_firewall` / `draw_staircase_windows` / `draw_giant_enter_key`：终端弹窗、窗口阶梯与巨型键帽实体在屏幕空间的绘制原语。
  - `audio_01_crt.render_audio(events, out_wav_path)`：事件驱动 DSP、机械轴体敲击声与合成器总线侧链 ducking，母带 `-14.0 LUFS`。
- **基准剧场时间锚点 (`worlds/world_01_crt`)**：`0–1.0s` 扫描线开机 → `2.8s` 磷光激发 → `6.2–8.5s` `ERR_403` 防火墙拦截（音乐 stop-down）→ `8.5–13.8s` 三连踩键 `./compile --jump --overclock` 编译过载 → `13.8–18.8s` 3D 窗口阶梯爬升与击碎 `ERR_404` → `18.8–22.5s` 光标滑索与 `[ ↵ ]` 键帽信物 → `24.0–24.25s` 巨型 ENTER 键砸底。
- **工程避坑指南**：
  1. **状态与渲染解耦**：`sim` 只产出纯字典 `frames_state[]`，`render_frame_from_state` 是纯函数，任意时间戳 `t` 可单帧复现。
  2. **CRT 畸变网格缓存**：桶形重映射坐标图按 `(w, h, k)` 缓存在内存中，多进程分片时每个 Worker 首帧预热一次，切勿逐帧重建 `meshgrid`。
  3. **局部坐标字符绑定**：主体内部字符必须按相对于主体中心的局部坐标 `(du, dv)` 采样，否则主体平移时字符会像固定百叶窗一样闪烁。
  4. **音频上游检查**：`audio_01_crt.py` 需先通过 `require_audio_upstream()` 校验 `LEMO_OPUSCAR_ROOT` 与 `EARSHOT_ROOT`。

## 相关文件

- [`../../styles/style_01_crt.py`](../../styles/style_01_crt.py)
- [`STORY.md`](../../worlds/world_01_crt/STORY.md)
- [`sim_01_crt.py`](../../worlds/world_01_crt/sim_01_crt.py)
- [`level_01_crt.py`](../../worlds/world_01_crt/level_01_crt.py)
- [`audio_01_crt.py`](../../worlds/world_01_crt/audio_01_crt.py)
- [`build_world_01.py`](../../worlds/world_01_crt/build_world_01.py)
