---
name: world-03-cyber
description: 赛博霓虹疾驰列车画风与 3D→2D 潮流涂鸦媒介管线（框内 2D 扁平海报 ↔ 框外 3D 硬切面顶点插值 + 双遍粗黑轮廓描边 + 严格五色赛璐璐 + 斜切漫画 Cut-In 分镜 + 线框坍缩转场）；支持 styles/style_03_cyber.py 去固有化纯画风复用与 worlds/world_03_cyber 基准剧场管线。
version: 1.0.0
category: procedural-medium
stack:
  - python
  - pycairo
  - threejs
  - playwright
  - numpy
  - audio-dsp
---

# World 03 · 赛博霓虹与 3D→2D 涂鸦破框媒介 (`style_03_cyber` / `world_03_cyber`)

- **画廊纯风格复用入口 (Content-Agnostic Style Entry)**：[`styles/style_03_cyber.py`](../../styles/style_03_cyber.py) — 调用 `render_keyframe()`、`render_mesh_group()` 或 `draw_graffiti_frame()` 可脱离特定剧情角色，直接将任意 3D 多边形载具/建筑/几何体渲染为「涂鸦画框内 2D 海报平涂 ↔ 冲出画框 3D 硬切面三阶赛璐璐」的高冲击力画面。
- **HTML-in-Canvas × WebGL2 融合画廊入口**：[`skills/cyber-graffiti-cutin/SKILL.md`](../cyber-graffiti-cutin/SKILL.md)（[`fusion/cyber-graffiti-cutin/`](../../fusion/cyber-graffiti-cutin/)）— 零固有化主体的破框磁浮列车、斜切漫画分镜与 WebGL2 冲击波色散模板。
- **基准剧场样片入口 (Benchmark Theatre Entry)**：[`worlds/world_03_cyber/`](../../worlds/world_03_cyber/) — 使用画廊材质试金石演练 24.0s / 720f 3D 磁浮列车跑酷、全息锦鲤与黑白线框坍缩（[`split/render_stage.html`](../../worlds/world_03_cyber/split/render_stage.html) + [`build_world_03.py`](../../worlds/world_03_cyber/build_world_03.py) + [`contact_sheet_03.png`](../../worlds/world_03_cyber/contact_sheet_03.png)）。

---

## 1. 视觉主体材质与构图映射 (`Visual Subject Mapping`)

本风格遵循**去固有化内容原则**。当将任意用户主体（高速列车、赛博超跑、机甲、建筑群或运动焦点）接入本风格时，遵循以下维度跃迁与色彩法则：

| 视觉要素 | 算法与色板契约 | 任意主体的 3D→2D 赛璐璐转译法则 |
| :-- | :-- | :-- |
| **1. 严格五色环境与涂鸦画框** | 深渊黑 `#0B0B14`、海报白 `#F4F4EE`、街头紫 `#8A3CFF`、荧光黄 `#E6FF1F`、电光青 `#00E5FF` + 深蓝夜空三阶 `#070C2E / #0D1748 / #16236A` | 背景保持 $\ge 35\%$ 纯粹深蓝留白与极简几何摩天楼；中央偏左布置紫黄双层街头喷漆画框 (`draw_graffiti_frame`)，画框边缘按 12fps 抽帧抖动并在右下角炸裂开口。 |
| **2. 顶点级 3D→2D 维度插值 (`project_vertex_hybrid`)** | $P_{\text{screen}} = (1 - k_{\text{flat}}) P_{\text{persp}} + k_{\text{flat}} P_{\text{ortho}}$ | 任何 3D 网格主体跨越画框边界时，根据深度 $z$ 计算扁平化系数 $k_{\text{flat}} \in [0, 1]$：**框内部分 ($k_{\text{flat}} \to 1$)** 压缩为正交投影、仅保留 2 阶明暗与 `13px` 粗外轮廓；**冲出画框部分 ($k_{\text{flat}} \to 0$)** 展开为大广角透视、3 阶硬切面赛璐璐与 `8px` 轮廓。 |
| **3. 双遍描边与唯一暖色焦点** | Pass 1 外轮廓粗黑描边 (`8~13px`) + Pass 2 切面填色与内部折线 (`2.5px`) | 全场环境与载具严禁使用暖红/暖粉色；仅将高饱和暖珊瑚色 (`#D96570`) 赋予画面最核心的视觉焦点或高能高亮区，形成万绿丛中一点红的绝对视觉锚点。 |

---

## 2. 核心实现与工程复用要点

- **独立画风层 (`styles/style_03_cyber.py`)**：
  - `Camera3D` + `clip_polygon_near` + `project_vertex_hybrid`：轻量级纯 Python 3D 软光栅管线，支持近裁剪面 Sutherland-Hodgman 裁剪、画家算法深度排序与透视/正交混合投影。
  - `build_train_mesh` / `build_geometric_buildings` / `build_signal_gantry`：模块化低多边形资产生成器，可直接替换为任意自定义多边形网格列表 `faces = [dict(mat=..., pts=[[x,y,z], ...])]`。
  - `draw_graffiti_frame`：12fps 确定性随机种子驱动的锯齿喷漆画框、油漆滴落与破框飞溅碎片。
- **3D 叙事舞台层 (`worlds/world_03_cyber/split/`)**：
  - `split/render_stage.html`（加载本地离线 `../../../corelib/vendor/three.min.js`）+ `10_story_director_18s.js`（24.0s 完整时间轴编排）。
  - 节奏锚点：`5.8–6.95s` 2D 刀锋斜切分镜 → `7.3–12.2s` 激光栏与无人机障碍 → `12.2–15.2s` 全息巨屏蹬墙与全息锦鲤 → `19.0s` 线框坍缩 → `19.30–19.50s` 准星冻结 + 56 道黑白放射速度线 → `20.68–24.0s` 米白虚空转场。
- **工程避坑指南**：
  1. 软光栅绘制穿过镜头近裁剪面的长物体（如铁轨、车厢）时，必须先调 `clip_polygon_near(pts_cam, near_z=0.6)`，否则 $z \le 0$ 的顶点会导致透视除法翻转。
  2. 3D 舞台高潮段的准星冻结精确发生在 `19.30–19.50s`，使用固定 `effTime` 冻结物理形变。

## 相关文件

- [`../../styles/style_03_cyber.py`](../../styles/style_03_cyber.py)
- [`../cyber-graffiti-cutin/SKILL.md`](../cyber-graffiti-cutin/SKILL.md)
- [`STORY.md`](../../worlds/world_03_cyber/STORY.md)
- [`build_world_03.py`](../../worlds/world_03_cyber/build_world_03.py)
- [`split/render_stage.html`](../../worlds/world_03_cyber/split/render_stage.html)
- [`split/10_story_director_18s.js`](../../worlds/world_03_cyber/split/10_story_director_18s.js)
- [`audio_03_cyber.py`](../../worlds/world_03_cyber/audio_03_cyber.py)
- [`contact_sheet_03.png`](../../worlds/world_03_cyber/contact_sheet_03.png)
