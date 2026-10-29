---
name: world-04-inkwash
description: 宋代水墨宣纸千里长卷画风与传统国画媒介管线（生宣纸植物纤维肌理 + 墨分五色枯笔飞白 + 计白当黑留白断桥 + 悬空巨笔挥毫 + 朱砂双鲤与泥金墨荷 + 朱砂篆印转场）；支持 styles/style_04_inkwash.py 去固有化纯画风复用与 worlds/world_04_inkwash 基准剧场管线。
version: 1.0.0
category: procedural-medium
stack:
  - python
  - pycairo
  - scipy
  - numpy
  - pillow
  - audio-dsp
---

# World 04 · 宋代水墨宣纸千里长卷媒介 (`style_04_inkwash` / `world_04_inkwash`)

- **画廊纯风格复用入口 (Content-Agnostic Style Entry)**：[`styles/style_04_inkwash.py`](../../styles/style_04_inkwash.py) — 调用 `render_keyframe()` 或 `render_world(cam_x, cam_y, t, state=None)` 可脱离特定角色，直接生成 1920×1080 宋代设色水墨代表帧与 7680×1080 四屏水墨山水长卷（含生宣纸帘纹纤维、浓淡青竹、留白石拱桥、泼墨泥金荷叶与朱砂游鱼）。
- **HTML-in-Canvas × WebGL2 融合画廊入口**：[`skills/inkwash-paper-scroll/SKILL.md`](../inkwash-paper-scroll/SKILL.md)（[`fusion/inkwash-paper-scroll/`](../../fusion/inkwash-paper-scroll/)）— 结合原生 `vertical-rl` 竖排书法题跋、朱砂藏书印与 WebGL2 宣纸纤维毛细渗化着色器的去固有化东方长卷模板。
- **基准剧场样片入口 (Benchmark Theatre Entry)**：[`worlds/world_04_inkwash/`](../../worlds/world_04_inkwash/) — 使用画廊材质试金石演练 28.0s / 840f 竹枝弹性悬臂、巨笔补桥、太极化荷与古琴竹笛配乐：`sim_04_inkwash.run_simulation` → `level_04_inkwash.render_frame_from_state` → `build_world_04.py`（[`contact_sheet_04.png`](../../worlds/world_04_inkwash/contact_sheet_04.png)）。

---

## 1. 视觉主体材质与构图映射 (`Visual Subject Mapping`)

本风格遵循**去固有化内容原则**。当将任意用户主体（山水亭台、桥梁舟楫、飞鸟游鱼、器物或叙事焦点）放入本风格时，遵循以下宋代院体与文人水墨转译法则：

| 视觉要素 | 纸墨材质与矿物色板 | 任意主体的水墨宣纸转译法则 |
| :-- | :-- | :-- |
| **宣纸基底与留白构图** | 仿古生宣纸 (`#F2EDE2 → #DDD3C0`) + 多尺度帘纹植物纤维噪点 | 画面必须保留 **$\ge 40\%$ 的呼吸感留白（计白当黑）**，远景山峦以极淡湿墨渲染，云雾与水面不涂死颜色，直接借宣纸底色与几道微弱水纹线表达。 |
| **墨分五色与枯笔飞白** | 焦墨 `#1A1917`、浓墨 `#2E2D2A`、重墨 `#4A4843`、淡墨 `#7A7770`、清墨 `#B5B0A6` | 主体轮廓与结构线严禁用均匀等宽矢量线！必须通过分段变化的笔压宽度、边缘高频毛刺扰动（模拟生宣纸毛细渗化）与速度段内部留白条纹（枯笔飞白）绘制。 |
| **传统矿物设色点睛** | 花青 `#2B5B84`、青莲 `#5E3A73`、胭脂朱砂 `#C84B31`、泥金 `#C8A858` | 遵循「水墨为主、重彩点睛」：大面积荷叶用泼墨配泥金叶脉，运动焦点或印章信物使用高纯度朱砂红与花青蓝，主体内部高光采用**宣纸留白负空间**而非数码白漆。 |

---

## 2. 核心实现与工程复用要点

- **独立画风层 (`styles/style_04_inkwash.py`)**：
  - 生宣纸纹理合成、远近景浓淡青竹、泼墨泥金荷塘、朱砂双鲤与水墨晕染笔触原语。
- **长卷机关原语 (`worlds/world_04_inkwash/level_04_inkwash.py`)**：
  - `draw_zone1_bamboo_grove`（单自由度弹性悬臂竹枝）、`draw_poetic_stone_arch_bridge`（用「未画完的宣纸留白」表达断桥阻隔）、`draw_master_calligraphy_brush`（悬空巨笔实时挥毫补全桥拱）；
  - `draw_lotus_pond_and_koi`、`draw_taiji_yinyang_array`（墨涡净化旋转并逐瓣绽放为白描红荷）；
  - `draw_cinnabar_gold_star_mandala`、`draw_cinnabar_book_cover_transition`（朱砂方印盖落转场）。
- **基准剧场时间锚点 (`worlds/world_04_inkwash`)**：`0–4.5s` 开卷与竹枝弹射 → `4.5–10.2s` 留白断桥与巨笔补桥（`9.2s` 桥拱合拢）→ `10.2–15.2s` 荷塘与朱砂双鲤 → `15.2–21.0s` 太极墨涡化荷与莲心星徽（`20.8s`）→ `21.0–24.8s` 登云山印门 → `24.8–27.0s` 朱砂方印翻转（`27.0s` 全屏朱红）。
- **工程避坑指南**：
  1. 宣纸底纹应当作为全局固定世界坐标或视口缓存层叠底，避免每帧重新生成高频随机噪声导致画面闪烁（boiling）。
  2. 留白断桥的物理高度场随毛笔挥毫进度 $p \in [0, 1]$ 动态解锁，渲染层笔触末端坐标需与碰撞解锁锋面严格同步。

## 相关文件

- [`../../styles/style_04_inkwash.py`](../../styles/style_04_inkwash.py)
- [`../inkwash-paper-scroll/SKILL.md`](../inkwash-paper-scroll/SKILL.md)
- [`STORY.md`](../../worlds/world_04_inkwash/STORY.md)
- [`build_world_04.py`](../../worlds/world_04_inkwash/build_world_04.py)
- [`sim_04_inkwash.py`](../../worlds/world_04_inkwash/sim_04_inkwash.py)
- [`level_04_inkwash.py`](../../worlds/world_04_inkwash/level_04_inkwash.py)
- [`audio_04_inkwash.py`](../../worlds/world_04_inkwash/audio_04_inkwash.py)
- [`contact_sheet_04.png`](../../worlds/world_04_inkwash/contact_sheet_04.png)
