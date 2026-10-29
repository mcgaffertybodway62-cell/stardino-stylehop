# World 04/05 · 纸雕立体书山谷 (`world_04_paper_threejs.html`) 模块化拆分说明

本目录将原本单文件 **2912 行** 的 `worlds/world_05_paper/world_04_paper_threejs.html` **100% 无损拆分**为独立的样式表、HTML 结构与 8 个按逻辑职责划分的 JavaScript 模块。所有 `.js` 模块通过标准 `<script src="./0X_*.js"></script>` 按原顺序同步加载，顶层常量、函数与全局单例（`PaperTextures`、`World04PaperAssets`、`SoundEngine` 等）完全共享，支持直接双击打开或通过 HTTP Server 零报错运行，且所有 `01_*.js ~ 08_*.js` 拼接后与原文件 `<script>` 内代码（第 298–2909 行）**字节级 100% 一致**。

---

## 一、文件结构与原文件行号映射总表

| 拆分后文件名 | 原文件行号范围 (1-indexed) | 行数 | 核心职责简述 |
| :--- | :---: | :---: | :--- |
| `index.html` | `1–11`, `81–296`, `2911–2912` | 238 | 页面骨架、顶部导航栏、左侧摄影棚资产面板、底部时间轴控制栏、代码导出弹窗与脚本按序引入 |
| `style.css` | `13–79` | 67 | 全局字体、深紫红纸艺背景渐变、毛玻璃卡片（`.glass-panel`）、激活按钮发光态、自定义滑块与滚动条样式 |
| `01_math_and_physics.js` | `298–386` | 89 | 数学插值函数、连续多段跳跃抛物线物理链（`evalContinuousHopChain`）、定点弧线跳跃（`evalTargetedJump`）与 Toast 提示 |
| `02_paper_textures.js` | `387–648` | 262 | 静态缓存 Canvas 2D 纸张纹理模块（`PaperTextures`），零每帧上传开销锁 60 FPS |
| `03_paper_assets_factory.js` | `649–1770` | 1122 | 核心 3D 纸雕与立体书资产工厂（`World04PaperAssets`），含史莱姆、千纸鹤、灯笼、走马灯亭、立体书双页山谷等 9 大类资产 |
| `04_sound_engine.js` | `1771–1836` | 66 | Web Audio API 程序化合成音效引擎（`SoundEngine`），含八音盒单音、折纸立起清脆声与古筝五声滑音 |
| `05_scene_and_camera.js` | `1837–2049` | 213 | Three.js 渲染器、光影、主舞台（`stageRoot`）与摄影棚转盘（`studioRoot`）实例化组装、全景/近景相机轨道控制器 |
| `06_story_choreography.js` | `2050–2599` | 550 | 30.0 秒六幕剧情编排与相机运镜跟随引擎（`evaluateStoryChoreography`：Beat 1 ~ Beat 6） |
| `07_ui_and_exporter.js` | `2600–2837` | 238 | 舞台/摄影棚模式切换、表情/折纸角度手动覆盖、时间轴播放控制、`.obj` 3D 模型导出与独立 JS 模块代码导出 |
| `08_render_loop.js` | `2838–2909` | 72 | 60 FPS 渲染主循环（`animate`）、FPS 计数器刷新与窗口 `resize` 自适应处理 |

---

## 二、各 `.js` 模块详细职责与包含的场景对象

### 1. `01_math_and_physics.js`（原第 298–386 行）
- **数学插值与缓动**：`clamp`、`lerp`、`smoothstep`、`easeOutBack`（立体书折纸弹出回弹曲线）、`easeInOutCubic`。
- **物理跳跃与挤压拉伸（Squash & Stretch）**：
  - `evalContinuousHopChain(u, numHops, jumpHeight)`：计算史莱姆连续多跳周期中的蓄力下蹲（crouch）、腾空抛物线与落地缓冲挤压形变系数（`sx`, `sy`, `sz`, `y`, `pitch`）。
  - `evalTargetedJump(u, startPos, endPos, arcHeight)`：计算从起点到终点的精准抛物线跳跃轨迹与三维缩放姿态（如跳上鹤背、跳下高台、跃上拱桥）。
- **UI 轻提示**：`showToast(msg)` 状态通知横幅。

### 2. `02_paper_textures.js`（原第 387–648 行）
导出全局 `PaperTextures` 单例，所有 Canvas 纹理在首次调用时生成并缓存：
- `getRadialGlowTexture()`：暖金径向辉光贴图（用于星星、灯笼、太阳光晕 Sprite）。
- `getBookPageTexture()`：米白瓦楞卡纸颗粒、微纤维与装订折痕贴图。
- `getSkyBackdropTexture()`：背景暖金至紫暮色渐变与宣纸云丝贴图。
- `getSlimeBodyWaveTexture()`：5 层模切卡纸史莱姆专属贴图（顶部珊瑚粉糖霜滴落、中段金箔波浪、底部奶油条纹）。
- `getEmotionBubbleTexture(symbol)`：角色头顶折纸对话气泡贴图（支持 `?`、`!`、`♪`、`♥` 四种符号）。
- `createZoetropePanelTexture(panelType, isGlass)`：走马灯亭八角窗花剪纸贴图（奔跑史莱姆、展翅千纸鹤、祥云星辰、流苏团扇）与半透明宣纸背板贴图。

### 3. `03_paper_assets_factory.js`（原第 649–1770 行）
导出全局 `World04PaperAssets`（挂载至 `window.World04PaperAssets`），包含材质/白边辅助函数与 **9 大场景资产构造器**：
- **基础材质与白边折痕（第 653–676 行）**：`makeCardstockMaterial`（双面哑光卡纸材质缓存）、`addWhitePaperEdge`（`paperCreaseLine` 折纸白边轮廓线）。
- **Asset 1 · 5 层模切卡纸史莱姆 `createPaperSlime`（第 678–864 行）**：底部零穿模锚点（`y=0`）、5 层叠层立体切片、奶油皇冠、瓦楞底座，以及 5 种可切换纸片眼神（`pill` 胶囊眼、`happy` 弯月笑眼、`wince` 闭眼蓄力、`sparkle` 星芒眼、`blink`/`focus`）与头顶情绪气泡。
- **Asset 2 · 八面宝石引路星与灯笼星徽 `createSparkleStar` / `createLanternStarToken`（第 866–959 行）**：双四棱锥交错宝石星、金箔星环与暖光 Sprite。
- **Asset 3 · 三维几何折纸千纸鹤 `createOrigamiCrane`（第 961–1093 行）**：支持 `white`（领航大白鹤，带背部马鞍锚点 `saddleMount`）、`pink`、`blue` 配色，具备双关节拍翼（内翼 + 外翼尖折叠）、可俯仰颈部与头部（`neckPivot`、`headHookPivot`）及对话气泡。
- **Asset 4 · 红金折纸灯笼 `createPaperLantern`（第 1095–1158 行）**：八角红纸灯身、上下金箍、底部穗子，支持点亮方法 `setLit(intensity)` 动态调节内芯发光与点光源强度。
- **Asset 5 · 八角旋转走马灯亭 `createZoetropePavilion`（第 1160–1270 行）**：3 层金顶六角基座、双飞檐、内部八角旋转剪纸画芯（`carousel`）、环绕纸灯笼与迎宾阶梯。
- **Asset 6 · 四层同心金箔剪纸太阳 `createConcentricPaperSun`（第 1272–1301 行）**：正反交替旋转的 16 芒放射齿环与暖光光晕。
- **Asset 7 · 五层古风纸宝塔与折纸松树 `createPaperPagoda` / `createPaperPineTree`（第 1303–1346 行）**：飞檐宝塔与十字交错剪纸松树。
- **Asset 8 · 立体书联动三角折纸支座与拱形折纸云桥 `createPopupSupportPedestal` / `createOrigamiCloudBridge`（第 1348–1405 行）**：随立起进度折叠的机械纸结构与连接高台/走马灯的金色栏杆拱桥。
- **Asset 9 · 双世界全景立体书舞台 `createPopUpBookStage`（第 1407–1751 行）**：
  - 装订硬壳封面、书脊凹槽与多层书页阶梯。
  - **第一页世界（第 1461–1583 行）**：6 层剪纸崇山峻岭、深邃书脊灯笼大峡谷、右侧史莱姆出发悬崖平台、左侧高空纸宝塔。
  - **第二页世界（第 1584–1678 行）**：180° 翻转展开的新世界——4 层青绿山水远景、右侧云桥高台（千纸鹤降落台）、中央折纸拱桥、左侧大型走马灯亭。
  - **3D 翻转书页 `flipPagePivot`（第 1680–1750 行）**：带双面立体折纸浮雕与实时折叠联动函数 `setFoldState(act1Progress, pageTurnProgress, act2Progress, elapsedTime)`。

### 4. `04_sound_engine.js`（原第 1771–1836 行）
导出全局 `SoundEngine` 单例：
- `playMusicBoxNote`：正弦波 + 泛音八音盒音色。
- `playPaperPopSnap`：白噪声带通滤波模拟卡纸折痕立起声。
- `playGuzhengGlissando`：翻页转场时的五声音阶古筝拂弦滑音。
- `triggerStorySound(t)`：根据 6 幕剧情时间节点自动触发对应配乐音效。

### 5. `05_scene_and_camera.js`（原第 1837–2049 行）
- **场景与灯光初始化（第 1840–1874 行）**：`renderer`（ACESFilmic 色调映射、PCFSoftShadowMap）、`scene`、34° 透视相机 `camera`、半球光与暖金主逆光 `sunBackLight`。
- **舞台实例组装（第 1876–1922 行）**：实例化立体书 `bookStage`、同心太阳 `concentricSun`、折纸支座 `supportPedestal`、**6 盏峡谷悬吊灯笼（4 金 2 红）** `stageLanterns`、3 只千纸鹤（`leadCrane`、`pinkCrane`、`blueCrane`）、主角史莱姆 `paperSlime`、引路星 `sparkleStar` 与灯笼星徽 `lanternStarToken`。
- **摄影棚独立资产检视台（第 1924–1983 行）**：构建旋转展台 `turntable` 与 `studioAssets` 字典（9 个独立可检视/导出的资产副本）。
- **相机控制器（第 1984–2049 行）**：管理 `camState`，提供 `setCameraPreset`（`panorama` 全景、`director` 近景跟随、`crane` 鹤背视角、`zoetrope` 走马灯视角）及鼠标拖拽旋转、Shift/右键平移、滚轮缩放交互。

### 6. `06_story_choreography.js`（原第 2050–2599 行）
定义 30.0 秒完整叙事动画函数 `evaluateStoryChoreography(t)`，驱动以下六幕演出与导演运镜：
- **Beat 1（`0.0s - 4.2s`，第 2122–2180 行）**：群山立起 · 星星点亮 **6 盏峡谷灯笼（4 金 2 红）** 率先飞去第二页 · 史莱姆苏醒追到悬崖边。
- **Beat 2（`4.2s - 7.8s`，第 2181–2242 行）**：史莱姆在崖边低头发现谷底休息的千纸鹤 · 俯仰呼应交流（`?` -> `!` <-> `♪`）。
- **Beat 3（`7.8s - 14.8s`，第 2243–2329 行）**：千纸鹤从谷底盘旋升起在崖边悬停 · 史莱姆精准跳上鹤背（`♥`）· 乘鹤缓缓拉升没入云端。
- **Beat 4（`14.8s - 18.6s`，第 2330–2354 行）**：净空大翻页转场（180° 书页翻转收起旧山谷、立起走马灯新世界）· 展示新世界拱桥中央等待的星星 `✦`。
- **Beat 5（`18.6s - 25.0s`，第 2355–2439 行）**：千纸鹤载着史莱姆从右侧云端缓降停靠云桥高台 · 史莱姆跳下高台转身致谢 · 千纸鹤挥翼从容飞向远方。
- **Beat 6（`25.0s - 30.0s`，第 2440–2555 行）**：史莱姆转身向前跃上拱桥中央触碰星星 `✦` · 欢快连跳跑下阶梯冲进左侧旋转走马灯亭新世界。
- **导演运镜与 UI 同步（第 2557–2599 行）**：`director` 近景相机平滑跟随、字幕横幅与底部六幕章节胶囊高亮同步。

### 7. `07_ui_and_exporter.js`（原第 2600–2837 行）
- 顶部“舞台剧场模式 / 资产摄影棚”切换、摄影棚 9 大资产卡片切换与表情/折页进度/全亮灯笼调试控件。
- 视角切换按钮、折痕白边显隐开关、音效开关、时间轴拖拽与倍速（`1.0x`/`0.5x`/`1.5x`）控制。
- `exportObjectToOBJ(rootObj, filename)`：将当前选中的 3D 资产或整个立体书舞台实时序列化导出为标准 `.obj` 模型文件。
- `getStandaloneModuleSource()`：通过 `PaperTextures.toString()` 与 `World04PaperAssets.toString()` 动态生成可独立复用的 ES Module 资产代码，支持一键复制或下载 `world_04_paper_assets.js`。

### 8. `08_render_loop.js`（原第 2838–2909 行）
- 启动初始状态 `evaluateStoryChoreography(0)`，运行 `animate(now)` 60 FPS 主循环（更新舞台时间轴或摄影棚展台自转与资产微动画、插值相机位置、执行 `renderer.render(scene, camera)`），并监听窗口 `resize` 事件。
