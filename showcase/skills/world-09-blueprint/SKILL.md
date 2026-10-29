---
name: world-09-blueprint
description: 工程蓝图 ↔ 3D 马卡龙浮岛画风与跨维制图媒介管线（2D 普鲁士蓝氰版 CAD 剖面图 + 国标图框与极坐标罗盘标尺 + 正弦撕裂波前 + 3D 马卡龙低多边形浮岛群 + Compass-Star 星盘 + 通天星光升降柱）；支持 styles/style_09_blueprint.py 去固有化纯画风复用与 worlds/world_09_blueprint 基准剧场管线。
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

# World 09 · 工程蓝图 ↔ 3D 马卡龙浮岛跨维媒介 (`style_09_blueprint` / `world_09_blueprint`)

- **画廊纯风格复用入口 (Content-Agnostic Style Entry)**：[`styles/style_09_blueprint.py`](../../styles/style_09_blueprint.py) — 调用 `render_keyframe()`、`render_world(cam_x, cam_y, t, state=None)`、`boundary_x_at_y()` 或 `draw_blueprint_grids_and_sections()` 可脱离特定角色，直接生成 1920×1080 黄金左右分屏「左半幅普鲁士蓝 CAD 工程剖面图 ↔ 中央手绘正弦撕裂波前 ↔ 右半幅 3D 马卡龙低多边形浮岛与通天星光柱」画面。
- **HTML-in-Canvas × WebGL2 融合画廊入口**：[`skills/blueprint-island-tear/SKILL.md`](../blueprint-island-tear/SKILL.md)（[`fusion/blueprint-island-tear/`](../../fusion/blueprint-island-tear/)）— 结合原生 HTML CAD 标题栏表格、SVG 正交剖面与 WebGL2 撕纸升维着色器的去固有化工程美学模板。
- **基准剧场样片入口 (Benchmark Theatre Entry)**：[`worlds/world_09_blueprint/`](../../worlds/world_09_blueprint/) — 使用画廊材质试金石演练 34.0s / 1020f（5 幕）表盘雷达扫描、蓝图撕裂、3D 浮岛 `extrude` 升维与星光柱登顶（[`split/render_stage.html`](../../worlds/world_09_blueprint/split/render_stage.html) + [`build_world_09.py`](../../worlds/world_09_blueprint/build_world_09.py) + [`contact_sheet_09.png`](../../worlds/world_09_blueprint/contact_sheet_09.png)）。

---

## 1. 视觉主体材质与构图映射 (`Visual Subject Mapping`)

本风格遵循**去固有化内容原则**。当将任意用户主体（建筑群落、浮空岛屿、精密机械、数码产品或几何结构）放入本风格时，遵循以下「左 2D 工程制图 ↔ 右 3D 实体升维」双界映射法则：

| 视觉区域 | 制图与渲染契约 | 任意主体的 2D↔3D 跨维转译法则 |
| :-- | :-- | :-- |
| **1. 左半幅：普鲁士蓝氰版 CAD 界 (`x < boundary_x_at_y`)** | 氰版晒图底色 (`#0B2246`) + `24px / 120px` 双级坐标网格 + 国标图框 (`1..8` / `A..D`) | 主体拆解为**正交剖面图（`SECTION A-A`）**、**立面图（`ELEVATION E-1`）**与**极坐标罗盘测绘图**：内部填充 `45°` 工程剖面斜线，外围标注带箭头引出线的毫米级尺寸（如 `Ø 3600`、`2050`）与右下角标准工程标题栏。 |
| **2. 中央：正弦撕裂与扫描波前 (`boundary_x_at_y`)** | 宏观 S 曲线 + 微观手撕纸张毛边 + `project3DTo2D` 线框反投影 | 跨越分界线的 3D 主体（如左上过渡浮岛）被撕裂曲线精准一分为二：**落入左侧区域的部分渲染为纯白三角网格线框（Wireframe）**，落入右侧的部分立刻呈现为完整着色的 3D 低多边形实体。 |
| **3. 右半幅：3D 马卡龙等轴天空界 (`x > boundary_x_at_y`)** | 薰衣草粉紫渐变天空 + 30° 白色等轴透视网格 + 明快低多边形切面 + 通天白金星光柱 | 主体由低多边形硬切面构成（薄荷翠绿顶面、奶油白倒角边、紫水晶多面体锥底、樱花粉/柠檬黄/天青蓝尖顶小屋与折面松树），并伴随 `extrude 0→1` 的 `easeOutBack` 弹性升起动画。 |

---

## 2. 核心实现与工程复用要点

- **独立画风层 (`styles/style_09_blueprint.py`)**：
  - `boundary_x_at_y(y, offset_x)` + `build_boundary_clip_path(ctx, side)`：精确控制左右双界的正弦撕裂裁切路径。
  - `make_blueprint_surface` + `draw_blueprint_grids_and_sections`：生成带多尺度氰版纸斑驳纹理的普鲁士蓝底图、双层 CAD 网格、`SECTION A-A` 浮空岛剖面、`ELEVATION E-1` 建筑立面与极坐标罗盘。
  - `draw_star`：带圆规作图辅助虚线圆与十字准星的几何罗盘星 `✦`（Compass-Star）。
- **3D 叙事舞台层 (`worlds/world_09_blueprint/split/`)**：
  - `06_composite_blueprint_renderer.js`：`project3DTo2D` 将右侧 Three.js 3D 场景中的顶点实时反投影回左侧 2D Canvas 绘制工程线框，再用正弦撕裂边界将 2D 与 3D 双画布无接缝合成。
  - `03_three_scene_and_3d_assets.js`：`buildMacaronFloatingIsland`、`buildCompassStar3D`、`buildStarlightPillar`。
  - 节奏锚点：`0–5.2s` 2D 蓝图中缝受阻 → `5.2–14.8s` 表盘指针依次扫描右上/左/下三处建筑图纸 → `14.8–19.2s` 脉冲激发 → `19.2–23.2s` 正弦撕裂图纸、右侧 3D 马卡龙浮岛群 `extrude 0→1` 升维展开（`21.2s`）→ `26.0s` Compass-Star 星盘越界 → `27.0–30.0s` 3D 实体落岛 → `31.5–34.0s` 通天星光升降柱收尾。

## 相关文件

- [`../../styles/style_09_blueprint.py`](../../styles/style_09_blueprint.py)
- [`../blueprint-island-tear/SKILL.md`](../blueprint-island-tear/SKILL.md)
- [`STORY.md`](../../worlds/world_09_blueprint/STORY.md)
- [`build_world_09.py`](../../worlds/world_09_blueprint/build_world_09.py)
- [`split/render_stage.html`](../../worlds/world_09_blueprint/split/render_stage.html)
- [`split/07_choreography_34s_timeline.js`](../../worlds/world_09_blueprint/split/07_choreography_34s_timeline.js)
- [`split/06_composite_blueprint_renderer.js`](../../worlds/world_09_blueprint/split/06_composite_blueprint_renderer.js)
- [`audio_09_blueprint.py`](../../worlds/world_09_blueprint/audio_09_blueprint.py)
- [`contact_sheet_09.png`](../../worlds/world_09_blueprint/contact_sheet_09.png)
