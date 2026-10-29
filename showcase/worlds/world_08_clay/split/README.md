# World 08 (Clay / World 10 Three.js 3D) 模块化无损拆分说明

本目录（`worlds/world_08_clay/split/`）由单文件 `stylehop_v5_world_10_three_js_3d.html`（共 3051/3052 行，未随仓库分发）**100% 字节级无损拆分**生成。

## 1. 运行机制与架构说明

- **全局变量与依赖**：原文件通过 CDN 引入 Tailwind CSS 与 `Three.js r128`（全局 `window.THREE`），所有逻辑运行在同一全局词法作用域下，未使用 ES Module (`import` / `export`)。
- **加载顺序保障**：[`index.html`](./index.html) 保留了原文件的 `<head>`、顶栏 HUD、底部时间轴控制栏与 3D 资产检视器 Modal DOM 结构，通过 `<link rel="stylesheet" href="style.css">` 引入样式，并按原脚本的精确定义顺序依次通过 `<script src="01_...js"></script>` 至 `<script src="12_...js"></script>` 同步加载执行，确保 100% 无损可运行且零穿模物理表现完全一致。

---

## 2. 模块文件与原文件行号映射总览

| 拆分文件名 | 原文件行号范围 | 行数 | 核心职责与包含的场景对象 |
| :--- | :---: | :---: | :--- |
| [`index.html`](./index.html) | `1–9`, `122–306`, `3051–3052` | 209 | 页面骨架、Tailwind & Three.js r128 引入、顶部状态栏/镜头切换 HUD、底部 15s 分镜进度条与沙盒控制栏、3D 资产检视器弹窗 DOM 及模块脚本挂载 |
| [`style.css`](./style.css) | `11–120` | 110 | 移轴浅景深固定遮罩（`.tilt-shift-overlay`）、午后暖阳暗角（`.sunlight-vignette`）、毛玻璃面板（`.clay-hud`）及自定义进度滑块样式 |
| [`01_constants_and_materials.js`](./01_constants_and_materials.js) | `308–496` | 189 | **物理与几何常量 + 程序化粘土材质库**：微缩比例常量（`SLIME_R=0.72`、`DESK_Y=0.0`、`COFFEE_RIVER_X`、`DOMINO_SPECS`、`MACARON_SPECS` 等）、Canvas 程序化指纹凹凸贴图生成器（`createClayTexturePack`）及全局粘土材质集合（`clayMats`） |
| [`02_web_audio_synth.js`](./02_web_audio_synth.js) | `497–592` | 96 | **Web Audio 程序化音效合成器（`SoundFX`）**：实时合成软陶挤压声（`squish`）、小喇叭吹奏（`trumpet`）、咖啡河飞溅（`splash`）、多米诺骨牌清脆碰撞（`domino`）、马卡龙弹簧回弹（`macaron`）、星芒拾取与万花筒共鸣音效 |
| [`03_scene_and_desk_env.js`](./03_scene_and_desk_env.js) | `593–775` | 183 | **Three.js 场景与 4 屏微缩粘土书桌环境**：场景/透视相机/阴影渲染器、午后暖阳三点光源与动态阴影跟随、**粘土书桌木纹桌面**（`y = 0.000`）、背景多层粉彩波浪粘土山丘、黄铜丝/竹签支撑的螺旋粘土树与云朵 |
| [`04_hero_slime_and_guide_star.js`](./04_hero_slime_and_guide_star.js) | `776–1064` | 289 | **核心角色与粒子系统**：手作指纹粘土四芒星生成器（`buildClayStar`）、**星芒软陶史莱姆主角**（`slimeRoot` / `slimeSqueezeGroup` / `slimeRollGroup`、指纹凹痕、红润脸颊与眼睛）、**独立飞行引路星芒**（`guideStar`）与可收集指纹粘土星信物（`starToken`）、星尘粒子尾迹与触感水花环池 |
| [`05_props_trumpet_mug_domino_macaron.js`](./05_props_trumpet_mug_domino_macaron.js) | `1065–1406` | 342 | **第 1–3 屏核心交互道具**：① **中空黄色粘土小喇叭**（Screen 1 零穿模出生点 `trumpetGroup`）；② **赤陶马克杯与 S 型焦糖拿铁咖啡河**（`mugRiverGroup`、棉花糖垫脚石与双色漩涡彩带）；③ **多米诺骨牌刚体连锁桥面**（`dominoChainSim` 5 枚粉彩骨牌）；④ **马卡龙软体蹦床**（`macaronTrampoline` 3 座双层夹心马卡龙） |
| [`06_props_stationery_succulent_kaleidoscope.js`](./06_props_stationery_succulent_kaleidoscope.js) | `1407–1678` | 272 | **文具点缀与第 4 屏终点万花筒**：① **巨型粘土铅笔、粉彩粘土骰子与字母积木**（`stationeryGroup`）；② **赤陶迷你多肉粘土盆栽**（`succulentGroup` 莲座叶序）；③ **齐平木尺斜坡、粘土精装书平台与中空万花筒**（`kaleidoscopeGroup`，含黄铜目镜环与内部彩色玻璃棱镜片） |
| [`07_surface_heightfield_and_flight_engine.js`](./07_surface_heightfield_and_flight_engine.js) | `1679–1906` | 228 | **解析高度场与引路星芒飞行引擎**：统一解析表面高度场函数 `getAnalyticalSurfaceY(x, z, dominoAngles, macaronComp)`（保障书桌、多米诺倾倒桥面、马卡龙顶面、木尺斜坡与书本平台 100% 零穿模）、引路星芒独立空中 8 字/盘旋飞行引擎（`updateGuideStarFlight`）、二阶弹簧阻尼软体振荡器与纯滚动追踪器 |
| [`08_storyboard_timeline_director.js`](./08_storyboard_timeline_director.js) | `1907–2374` | 468 | **15.0 秒分镜时间轴导演系统（`applyTimelineAt(t, dt)`）**：驱动 6 大叙事节拍、多米诺骨牌精确连锁倾倒角度、史莱姆全路径解析坐标与挤压/俯仰形变、无滑移纯滚动（$\omega = -\Delta x / R$）、星芒信物拾取，以及 **4 种相机轨迹预设**（`follow` 横移跟拍、`cinematic` 电影感运镜、`overview` 4 屏全景鸟瞰、`closeup` 微距特写） |
| [`09_sandbox_physics_engine.js`](./09_sandbox_physics_engine.js) | `2375–2558` | 184 | **子步进自由沙盒物理引擎（`updateSandboxPhysics(dt)`）**：8 子步/帧高精度物理积分，支持 WASD/方向键/跳跃操控史莱姆在 4 屏粘土书桌上自由探索，实时触发多米诺骨牌连锁、马卡龙软体蹦床高弹跳、咖啡河漩涡减速与万花筒终点进入 |
| [`10_transition_overlays_2d.js`](./10_transition_overlays_2d.js) | `2559–2661` | 103 | **2D 转场覆盖层渲染（`renderTransitionOverlay(t)`）**：负责 `0.0–0.8s` 从小喇叭口展开的 Iris-In 光圈转场，以及 `13.8–15.0s` 跃入万花筒后的对数螺旋与青色几何蓝图折射转场（衔接 World 05） |
| [`11_ui_controls_and_inspector.js`](./11_ui_controls_and_inspector.js) | `2662–2981` | 320 | **UI 交互、射线拾取与 3D 资产检视导出器**：绑定模式切换（分镜/沙盒）、相机预设切换、倍速、移轴模糊开关、时间轴拖拽、屏幕点击 Raycaster 戳揉史莱姆/弹跳马卡龙，以及 **3D 外部资产独立预览窗口（Asset Inspector Modal）与 Wavefront `.obj` / Scene `.json` 导出功能** |
| [`12_main_loop.js`](./12_main_loop.js) | `2982–3049` | 68 | **主动画循环与窗口自适应（`animate` & `resize`）**：统一调度背景云朵微摆、咖啡河漩涡旋转、万花筒内芯旋转、星尘粒子与水花环池更新、分镜/沙盒状态更新及主场景与检视器双渲染器绘制 |

---

## 3. 核心场景对象索引（快速定位）

1. **粘土书桌（Craft Desk & Hills）**：[`03_scene_and_desk_env.js`](./03_scene_and_desk_env.js)（原文件 `665–775` 行）
2. **软陶史莱姆与引路星芒（Polymer Clay Slime & Guide Star）**：[`04_hero_slime_and_guide_star.js`](./04_hero_slime_and_guide_star.js)（原文件 `776–1064` 行）
3. **小喇叭（Hollow Yellow Clay Toy Trumpet）**：[`05_props_trumpet_mug_domino_macaron.js`](./05_props_trumpet_mug_domino_macaron.js)（原文件 `1065–1111` 行）
4. **咖啡河与赤陶马克杯（Terracotta Mug & Caramel-Latte Stream）**：[`05_props_trumpet_mug_domino_macaron.js`](./05_props_trumpet_mug_domino_macaron.js)（原文件 `1112–1221` 行）
5. **多米诺骨牌（DominoChainSim）**：[`05_props_trumpet_mug_domino_macaron.js`](./05_props_trumpet_mug_domino_macaron.js)（原文件 `1222–1314` 行）
6. **马卡龙软体蹦床（MacaronTrampoline）**：[`05_props_trumpet_mug_domino_macaron.js`](./05_props_trumpet_mug_domino_macaron.js)（原文件 `1315–1406` 行）
7. **万花筒与木尺书本斜坡（Hollow Kaleidoscope & Book Platform）**：[`06_props_stationery_succulent_kaleidoscope.js`](./06_props_stationery_succulent_kaleidoscope.js)（原文件 `1558–1678` 行）
8. **相机轨迹与 15s 分镜导演（Camera Trajectory & Storyboard Director）**：[`08_storyboard_timeline_director.js`](./08_storyboard_timeline_director.js)（原文件 `1907–2374` 行）
