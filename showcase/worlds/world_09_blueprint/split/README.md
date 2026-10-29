# World 09 (World 05 Blueprint) — 模块化无损拆分说明

本目录由 `../world_05_3d_three_js_34s.html`（共 3410 行）100% 无损拆分生成。原文件通过 `<head>` 中的 CDN `<script>` 全局引入 `THREE`（Three.js r128），所有业务逻辑均位于顶层全局作用域，因此按章节顺序拆分为独立 `.js` 脚本并在 `index.html` 中按序加载，即可保持 100% 原生运行行为与数据状态互通。

---

## 目录文件与原文件行号映射总览

| 文件名 | 原文件行号范围 (1-indexed) | 行数 | 模块职责与核心内容 |
| :--- | :---: | :---: | :--- |
| `index.html` | `1–9`, `57–380`, `3409–3410` | 343 | 页面骨架、Tailwind & Three.js CDN 引用、顶部模式切换栏、1920×1080 蓝图/3D 双层画布容器、右侧参数控制面板与脚本按序挂载 |
| `style.css` | `11–55` | 45 | 工程蓝图主题配色变量 (`--bp-bg`, `--bp-grid`, `--slime-*`)、毛玻璃面板 (`.bp-panel`)、蓝图坐标网格背景 (`.bp-grid-bg`) 与激活态渐变样式 |
| `01_core_math_and_audio.js` | `382–564` | 183 | **Section 1 & 2**：核心数学插值 (`clamp`, `lerp`, `smoothstep`, `evalKeyframes`)、果冻体积守恒挤压物理 (`computeJellySquashY`)、图纸正弦撕裂边界曲线 (`getBoundaryXAtY`)，以及基于 Web Audio API 的合成器音效引擎 (`BlueprintSoundEngine`) |
| `02_state_and_cyanotype_paper.js` | `565–702` | 138 | **Section 3 & 4**：全局状态机 `state`（时间轴 `t`、撕裂比例 `splitRatio`、2D→3D 拔起系数 `extrude`、2D 史莱姆状态 `leftSlime`、`starThrow`/`gazeReticle` 字段、波纹队列 `ripples`、相机球坐标等）与离屏预渲染普鲁士蓝晒图纸纹理 (`createCyanotypePaperCanvas`)；**成片未使用 `starThrow`/`gazeReticle` 的可见表演** |
| `03_three_scene_and_3d_assets.js` | `703–1260` | 558 | **Section 5**：Three.js 渲染器/透视相机/多光源初始化，以及 4 大核心高精低多边形马卡龙 3D 资产构建器（见下方详情） |
| `04_scene_hierarchy_and_ripples.js` | `1261–1390` | 130 | **Section 6**：Three.js 场景图 (`worldGroup`) 组装：主浮岛 (`heroIsland`)、3 座远景浮岛 (`island0`~`island2`)、主角/剖面 3D 史莱姆 (`heroSlime3D`, `cutawaySlime3D`)、星光升降柱 (`heroStarPillar`)、罗盘星 (`heroCompassStar`)、落脚波纹环 (`rippleGroup`, `trigger3DRipple`) |
| `05_blueprint_2d_slime.js` | `1391–1809` | 419 | **Section 7**：左侧 2D 矢量工程蓝图史莱姆绘制器 (`drawFourPointStar2D`, `drawBlueprint2DSlime`)，包含体积守恒轮廓、内部 CAD 尺寸标注线、眼部投影与意念脑波环；**成片用圆形表盘 + 单根指针表现视线扫描，没有 3D 球面转头/可摘除头顶圆规** |
| `06_composite_blueprint_renderer.js` | `1810–2426` | 617 | **Section 8**：2D/3D 混合主合成渲染器 (`project3DTo2D`, `drawLeftBlueprintWorld`, `renderCompositeFrame`)，负责绘制蓝图网格、2D 线框浮岛投影、`SECTION A-A` 剖面图、`ELEVATION E-1` 立面图、ISO-9001 图签栏、表盘指针，以及左右波浪撕裂边界裁切与合成；**成片没有视线准星/抛星跨界轨迹** |
| `07_choreography_34s_timeline.js` | `2427–3029` | 603 | **Section 9**：34.0 秒五幕完整剧情动作编排 (`STORY_ACTS`, `evalStoryChoreography`) 与场景/相机动态调度 (`updateSceneForTimeAndState`) |
| `08_ui_controls_export_and_main.js` | `3030–3407` | 378 | **Section 10, 11 & 12**：UI 控件绑定、3D 鼠标轨道旋转/缩放交互、1920×1080 合成帧/纯 3D 透明图层 PNG 导出、JSON 规范导出、Python 自动化渲染管线接口 (`window.World05BlueprintAPI`) 及 `requestAnimationFrame` 主循环 |

---

## 核心场景对象与模块详细对照

### 1. 蓝图网格与工程制图要素 (`02_state_and_cyanotype_paper.js` + `06_composite_blueprint_renderer.js`)
- **蓝晒底纹与坐标网格**：`createCyanotypePaperCanvas()`（`640–701` 行）预生成 1920×1080 普鲁士蓝晒纸张肌理、120px 主网格、24px 次网格与工程图框刻度（A–H / 1–12）。
- **实时工程图纸视图**：`drawLeftBlueprintWorld()`（`1829–2254` 行）实时将 3D 浮岛顶点通过 `project3DTo2D()` 投影为左侧 2D CAD 线框，并绘制左下角 `SECTION A-A` 地质剖面图（`1962–2013` 行）、左上角 `ELEVATION E-1` 立面图（`2016–2079` 行）、右下角 ISO-9001 工程图签栏与意念公式推导（`2125–2171` 行）。
- **图纸撕裂波浪分界线**：`getBoundaryXAtY()`（`438–446` 行）计算动态正弦撕裂边界，`renderCompositeFrame()`（`2259–2425` 行）严格将 3D 渲染画面裁切至分界线右侧、2D 蓝图裁切至分界线左侧，并绘制发光撕裂边缘。

### 2. 2D→3D 浮岛与村庄道具资产 (`03_three_scene_and_3d_assets.js` + `04_scene_hierarchy_and_ripples.js`)
- **多面体马卡龙水晶浮岛**：`buildMacaronFloatingIsland()`（`1037–1163` 行）构建分层岩体、草坪顶盖、悬浮能量晶簇，并提供 `setExtrude(e, wfAlpha, propExtrudeVal)` 方法实现 `extrude: 0.0 -> 1.0+` 从扁平蓝图线框拔起为 3D 实体的平滑形变。
- **低多边形景观道具**：`buildLowPolyPineTree()`（`917–941` 行）、`buildSakuraTree()`（`943–967` 行）、`buildMacaronCottage()`（`969–1003` 行）、`buildWindmill()`（`1005–1033` 行，含可旋转风车叶片 `blades`）。
- **主浮岛与远景浮岛群**：在 `04_scene_hierarchy_and_ripples.js`（`1264–1332` 行）中实例化主浮岛 `heroIsland` 及 3 座背景浮岛 `island0`、`island1`、`island2`。

### 3. 波纹触发与落脚反馈 (`04_scene_hierarchy_and_ripples.js` + `01_core_math_and_audio.js`)
- **3D 落脚冲击波纹环**：`rippleGroup` 与 `rippleMeshes`（`1349–1367` 行）在浮岛草坪表面构建多重透明扩散圆环；`trigger3DRipple()`（`1369–1390` 行）触发 3D 与 2D 双重落脚波纹，并在 `updateSceneForTimeAndState()`（`2951–2962` 行）中驱动扩散缩放与透明度衰减。

### 4. 星光升降柱与罗盘星 ✦ (`03_three_scene_and_3d_assets.js` + `04_scene_hierarchy_and_ripples.js`)
- **四角星 compass-star ✦**：`buildCompassStar3D()`（`1167–1204` 行）构建带白色工程线框的 3D 挤压四角星 `heroCompassStar`（外加双环，不是两脚圆规）。
- **星光升降柱**：`buildStarlightPillar()`（`1206–1260` 行）构建双层反向旋转符文环、垂直光束柱与底座构成的 `heroStarPillar`，通过 `setActivation(a)` 控制激活发光与上升能量流。

### 5. 2D 蓝图史莱姆与 3D 柔体史莱姆 (`03_three_scene_and_3d_assets.js` + `05_blueprint_2d_slime.js`)
- **3D 史莱姆 (`buildSlime3DAsset`)**：位于 `03_three_scene_and_3d_assets.js`（`780–913` 行），支持柔体体积守恒缩放 (`sx = sz = 1/sqrt(sy)`)、3D 球面转头 (`yaw`/`pitch`)、五种眼型 (`pill`/`happy`/`sparkle`/`curious`/`surprised`/`flat`)、眨眼与半剖发光核心模式 (`isCutaway`)。
- **2D 蓝图史莱姆 (`drawBlueprint2DSlime`)**：位于 `05_blueprint_2d_slime.js`（`1414–1809` 行），在 2D 蓝图上绘制 CAD 尺寸标注线 (`s_y`/`s_x`) 与意念脑波环；**成片审图表演是 2D 表盘指针，不是 3D 球面转头，也没有可摘除的头顶圆规**。

### 6. 34.0s 分镜编排与相机轨迹 (`07_choreography_34s_timeline.js`)
- **五幕分镜时间轴 (`STORY_ACTS` & `evalStoryChoreography`)**：
  1. `0.0s–2.5s`：蓝图入场与右侧图框碰撞回弹；
  2. `2.5s–5.2s`：笃笃轻敲中缝、疑惑歪头；
  3. `5.2s–14.8s`：2D 表盘指针/眼位右上 → 左 → 下/右下扫描；成片无 3D 大幅转头、无准星、无三块图框逐行高亮；
  4. `14.8s–23.2s`：闭眼蓄力意念补全图纸参数，撕开中缝将 2D 线框拔起为 3D 马卡龙浮岛；
  5. `23.2s–34.0s`：成片无可见“摘圆规/抛投”→ `26.0s` 起 3D compass-star（四角星+双环）越界落岛 → 27.0–30.0s 3D 史莱姆成形 → 30.0–31.5s 环顾/轻跳 → 跃入星光柱随 compass-star 飞升。
- **相机轨迹调度 (`updateSceneForTimeAndState`)**：位于 `2865–3029` 行，根据当前模式 (`story` / `split` / `sandbox` / `inspector`) 及时间轴 `state.t` 动态插值相机球坐标 (`camTheta`, `camPhi`, `camRadius`, `camTarget`)，在 31.5s–34.0s 飞升阶段平滑跟拍史莱姆与罗盘星升空。
