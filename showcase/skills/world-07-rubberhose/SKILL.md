---
name: world-07-rubberhose
description: 1930s 橡皮管爵士舞台画风与复古赛璐璐胶片媒介管线（35mm 胶片齿孔边框 + 赛璐璐纵向划痕噪点 + 132 BPM 弹簧节拍呼吸 + S 型 3D 波浪钢琴键 + 拟人黄铜留声机 + Technicolor 三色声波环 + Iris-Out 收圈）；支持 styles/style_07_rubberhose.py 去固有化纯画风复用与 worlds/world_07_rubberhose 基准剧场管线。
version: 1.0.0
category: procedural-medium
stack:
  - python
  - pycairo
  - numpy
  - pillow
  - audio-dsp
---

# World 07 · 1930s 橡皮管卡通与 35mm 赛璐璐胶片媒介 (`style_07_rubberhose` / `world_07_rubberhose`)

- **画廊纯风格复用入口 (Content-Agnostic Style Entry)**：[`styles/style_07_rubberhose.py`](../../styles/style_07_rubberhose.py) — 调用 `render_keyframe()`、`render_world(cam_x, cam_y, t, state=None)` 或独立调用 `draw_35mm_sprocket_borders`、`apply_celluloid_film_grain_and_scratches`、`draw_rubber_hose_piano_keyboard`、`draw_rubber_hose_gramophone`，可直接将任意舞台场景或图形包装为 1930s Fleischer / 早期 Technicolor 复古赛璐璐胶片画面。
- **基准剧场样片入口 (Benchmark Theatre Entry)**：[`worlds/world_07_rubberhose/`](../../worlds/world_07_rubberhose/) — 使用画廊材质试金石演练 26.0s / 780f 爵士波浪琴键跳跃、留声机对抗与 Big Band 铜管配乐：`sim_07_rubberhose.run_simulation` → `level_07_rubberhose.render_frame_from_state` → `build_world_07.py`（[`contact_sheet_07.png`](../../worlds/world_07_rubberhose/contact_sheet_07.png)）。

---

## 1. 视觉主体材质与构图映射 (`Visual Subject Mapping`)

本风格遵循**去固有化内容原则**。当将任意用户主体（乐器道具、复古海报字标、舞台机械、音符符号或卡通主体）放入本风格时，遵循以下 1930s 黄金时代赛璐璐卡通转译法则：

| 视觉要素 | 线条、色彩与节拍契约 | 任意主体的 1930s 橡皮管转译法则 |
| :-- | :-- | :-- |
| **1. 橡皮管无骨曲线与节拍呼吸 (`132 BPM Bounce`)** | 均匀粗黑蘸水笔墨线 (`3.5px ~ 5.0px`, `#181412`) + 全场锁定 `132 BPM` ($2.2\text{ Hz}$) 正弦挤压节拍 | 场景中的一切静物（舞台帷幕、立柱、钢琴、留声机喇叭乃至文字标牌）均非死板刚体，而是采用无关节拐角的连续贝塞尔 S 型弧线（Rubber-Hose Curves）绘制，并随 `sin(2π · 2.2 · t)` 做同步的垂直微蹲与回弹呼吸。 |
| **2. 早期两色/三色 Technicolor 复古调色盘** | 暖羊皮纸米黄底 (`#F4E8D1`) + 剧院绛红帷幕 (`#8C242B`) + 复古黄铜 (`#D89E3A`) + 青/洋红/金三色声波环 | 避免现代荧光高饱和色；阴影采用复古暖褐色半透明叠底，高光采用老式赛璐璐片上的月牙形纯白留白与经典 **Pie-Cut（扇形缺口）** 反光。 |
| **3. 35mm 物理胶片后处理层** | 左右两侧胶片齿孔黑边 (`draw_35mm_sprocket_borders`) + 胶片门抖动 (`Gate Weave`) + 纵向银盐划痕 + 片尾圆形 `Iris-Out` | 画面最终统一叠加椭圆暗角、帧间随机灰尘斑点与 1～2 道纵向贯穿的微弱白色胶片划痕，片头可配 SMPTE 复古胶片倒计时盘，片尾以聚焦于关键道具的圆形黑幕收圈（Iris-Out）结束。 |

---

## 2. 核心实现与工程复用要点

- **独立画风层 (`styles/style_07_rubberhose.py`)**：
  - `draw_35mm_sprocket_borders` / `apply_celluloid_film_grain_and_scratches`：即插即用的 35mm 复古电影胶片滤镜与齿孔外框组件。
  - `draw_vintage_theater_curtains` / `draw_stage_floorboards_and_spotlights`：带木纹透视与暖黄剧场追光灯的百老汇爵士舞台底座。
  - `draw_rubber_hose_piano_keyboard`：解析连续正弦波浪 3D 钢琴键盘高度场（黑白琴键随触压产生局部凹陷与邻键联动）。
  - `draw_rubber_hose_gramophone` / `draw_technicolor_jazz_soundwave_ring`：8 瓣黄铜大喇叭留声机与 Technicolor 彩色声波扩音环。
- **长卷机关原语 (`worlds/world_07_rubberhose/level_07_rubberhose.py`)**：
  - `draw_note_critter`（长着橡皮管小腿的八分音符精灵）、`draw_pop_icon`（漫画爆发星标）、`draw_35mm_countdown`、`draw_iris_out`。
- **基准剧场时间锚点 (`worlds/world_07_rubberhose`)**：`0–4.0s` 35mm 胶片倒计时与帷幕拉开 → `4.0–8.8s` 波浪钢琴键与黑音符追逐 → `8.8–14.2s` 三连重音踩键激发出 Technicolor 彩色声波环 → `14.0–15.0s` 黄金黑胶唱片信物浮现 → `14.2–19.5s` 逆向声波反击留声机 → `19.5–23.0s` 留声机眩晕旋转 → `25.0–25.75s` 聚焦于喇叭口的经典圆形 Iris-Out 收圈。

## 相关文件

- [`../../styles/style_07_rubberhose.py`](../../styles/style_07_rubberhose.py)
- [`STORY.md`](../../worlds/world_07_rubberhose/STORY.md)
- [`build_world_07.py`](../../worlds/world_07_rubberhose/build_world_07.py)
- [`sim_07_rubberhose.py`](../../worlds/world_07_rubberhose/sim_07_rubberhose.py)
- [`level_07_rubberhose.py`](../../worlds/world_07_rubberhose/level_07_rubberhose.py)
- [`audio_07_rubberhose.py`](../../worlds/world_07_rubberhose/audio_07_rubberhose.py)
- [`contact_sheet_07.png`](../../worlds/world_07_rubberhose/contact_sheet_07.png)
