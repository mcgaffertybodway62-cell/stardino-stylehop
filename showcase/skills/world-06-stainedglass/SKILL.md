---
name: world-06-stainedglass
description: 哥特玫瑰彩窗圣殿画风与 Voronoi 彩绘琉璃媒介管线（-10° 倾斜哥特拱廊 + 24 瓣玫瑰花窗 + Voronoi 多边形琉璃切面与粗黑铅条 + 33° 丁达尔体积光束 + 棱镜色散与声波彩虹桥）；支持 styles/style_06_stainedglass.py 去固有化纯画风复用与 worlds/world_06_stainedglass 基准剧场管线。
version: 1.0.0
category: procedural-medium
stack:
  - python
  - pycairo
  - scipy-voronoi
  - numpy
  - pillow
  - audio-dsp
---

# World 06 · 哥特玫瑰彩窗与 Voronoi 琉璃媒介 (`style_06_stainedglass` / `world_06_stainedglass`)

- **画廊纯风格复用入口 (Content-Agnostic Style Entry)**：[`styles/style_06_stainedglass.py`](../../styles/style_06_stainedglass.py) — 调用 `render_keyframe()` 或 `render_world(cam_x, cam_y, t, state=None)` 可脱离特定角色，直接生成 1920×1080 哥特玫瑰彩窗大教堂代表作单帧（含 24 瓣巨型玫瑰花窗、尖拱柳叶窗、33° 丁达尔透射体积光束、水晶棱镜色散与声波光环）。
- **基准剧场样片入口 (Benchmark Theatre Entry)**：[`worlds/world_06_stainedglass/`](../../worlds/world_06_stainedglass/) — 使用画廊材质试金石演练 26.0s / 780f（4 幕）棱镜折射台阶、拉绳敲钟、声波架桥与管风琴圣咏配乐：`sim_06_stainedglass.run_simulation` → `level_06_stainedglass.render_frame_from_state` → `build_world_06.py`（[`contact_sheet_06.png`](../../worlds/world_06_stainedglass/contact_sheet_06.png)）。

---

## 1. 视觉主体材质与构图映射 (`Visual Subject Mapping`)

本风格遵循**去固有化内容原则**。当将任意用户主体（建筑徽标、神圣器物、几何图腾、光路系统或运动焦点）放入本风格时，遵循以下中世纪彩绘琉璃与光学转译法则：

| 视觉要素 | 几何算法与光学契约 | 任意主体的彩窗琉璃转译法则 |
| :-- | :-- | :-- |
| **1. Voronoi 琉璃切面与铅条 (`Lead Cames`)** | `scipy.spatial.Voronoi` 镶嵌剖分 + `2.8px ~ 3.5px` 炭黑铅条描边 (`#120E18`) + 铅条拉丝高光 | 任何前景或背景主体均不画平滑过渡色块，而是将其内部区域通过 Voronoi 或径向几何网格剖分为 **20～40 个独立彩色玻璃晶胞（Facet Cells）**；每个晶胞内部施加宝石级径向渐变（钴蓝 `#1E56D8`、紫水晶 `#7B3FE4`、红宝石 `#D9385A`、琥珀金 `#F5A623`）与斜向硬边玻璃反光条。 |
| **2. 哥特尖拱与玫瑰花窗构图** | `-10°` 戏剧化镜头倾斜 + 双圆心尖拱 (`Pointed Lancet Arch`) + 三层同心 24 瓣玫瑰窗 | 背景采用深邃石砌肋拱暗部 (`#090710`) 衬托高发光度彩窗，利用强烈的明暗对比（Chiaroscuro）凸显玻璃的背光通透感。 |
| **3. 丁达尔体积光与色散 (`God Rays & Prism`)** | `33°` 斜向半透明叠加光束 + 牛顿七彩棱镜扇面 + 同心声波碎晶环 | 光线穿过彩窗或水晶棱镜时，在空气中投射出带微尘颗粒的彩色丁达尔体积光柱，并在地面与主体表面印出彩色投射光斑。 |

---

## 2. 核心实现与工程复用要点

- **独立画风层 (`styles/style_06_stainedglass.py`)**：
  - `render_keyframe()` / `render_world(cam_x, cam_y, t, state=None)`：独立生成哥特彩窗圣殿与丁达尔光束场景。
  - Voronoi 晶胞生成与铅条镶嵌绘制原语：可将任意闭合轮廓自动切分为带粗黑铅条与玻璃高光的彩窗材质。
- **长卷机关原语 (`worlds/world_06_stainedglass/level_06_stainedglass.py`)**：
  - `draw_pointed_lancet_window`、`draw_grand_gothic_rose_window`、`draw_expansive_cathedral_background`；
  - `draw_crystal_prism_and_refraction`（棱镜将白光分解为 4 级彩色玻璃实体台阶）；
  - `draw_golden_bell_rope`、`draw_dynamic_shockwaves`、`draw_dynamic_ribbon_bridge`（敲钟声波具象化为七彩琉璃光带桥）。
- **基准剧场时间锚点 (`worlds/world_06_stainedglass`)**：`0–5.2s` 三扇柳叶窗与丁达尔光束入场 → `5.2–12.0s` 水晶棱镜折射出 4 级玻璃台阶 → `12.0–19.4s` 拉动金绳敲响教堂大钟、声波环震碎暗影并凝结七彩光带桥 → `19.4–26.0s` 跨越彩虹桥直抵巨型玫瑰花窗（`25.2s` 切入黑白胶片倒计时转场）。
- **工程避坑指南**：
  1. 动态主体的 Voronoi 种子点必须定义在主体的**局部归一化坐标系**中预计算一次，随帧渲染时仅对多边形顶点做仿射/球面变换，严禁每帧重新跑 `Voronoi()` 导致琉璃切面拓扑乱跳。
  2. 丁达尔光束使用线性渐变 alpha 叠加，注意控制多道光束交汇处的最大曝光度，防止冲掉底层玫瑰窗铅条细节。

## 相关文件

- [`../../styles/style_06_stainedglass.py`](../../styles/style_06_stainedglass.py)
- [`STORY.md`](../../worlds/world_06_stainedglass/STORY.md)
- [`build_world_06.py`](../../worlds/world_06_stainedglass/build_world_06.py)
- [`sim_06_stainedglass.py`](../../worlds/world_06_stainedglass/sim_06_stainedglass.py)
- [`level_06_stainedglass.py`](../../worlds/world_06_stainedglass/level_06_stainedglass.py)
- [`audio_06_stainedglass.py`](../../worlds/world_06_stainedglass/audio_06_stainedglass.py)
- [`contact_sheet_06.png`](../../worlds/world_06_stainedglass/contact_sheet_06.png)
