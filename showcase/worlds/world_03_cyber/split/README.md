# World 03 Cyber (`v16_0_unrealbloom`) 模块化拆分说明

本目录将最新优化版 `worlds/world_03_cyber/v16_0_unrealbloom (1).html`（共 **4,350 行**，相比上一版 3,891 行净增 **+459 行** 视觉与架构升级）进行 **100% 无损模块化拆分**，并集成独立 3D 史莱姆核心角色资产（`09_slime_3d_asset.js` 与 `slime_3d_showcase.html`）。所有模块通过原生 `<script src="...">` 按原全局作用域顺序依次加载，零构建依赖、100% 零报错兼容（经逐行校验，8 个核心 JS 模块合并后与原 HTML 内 `<script>` 的 4,119 行代码 100% 逐字节一致）。

---

## 一、 拆分文件清单、原文件行号范围与核心全局变量 / Group

| 文件名 | 对应原 HTML 行号 | 拆分后行数 | 对应原章节 | 核心全局变量 / `THREE.Group` / 关键函数 |
| :--- | :--- | :--- | :--- | :--- |
| `index.html` | `L1-L15`, `L58-L227`, `L4348-L4350` | 200 行 | HTML 骨架与 HUD 控制台 | 顶部状态栏、5 大镜头切换按钮 (`btn-pov`/`btn-chase`/`btn-orbit`/`btn-tower`/`btn-curve`)、4 种全息奇观切换、5 种渲染风格切换、6 项实时滑块调节 |
| `style.css` | `L16-L57` | 40 行 | `<style>` 样式表 | `.glass-panel` 毛玻璃面板、`.cyber-btn` 霓虹交互按钮状态、`.key-badge` 键位提示样式 |
| `01_core_and_lights.js` | `L229-L362` | 136 行 | 第 1 ~ 3 节 | `scene`, `camera`, `renderer`, `composer`, `bloomPass`, `controls`；共享几何体池 `UNIT_BOX`, `UNIT_CYL`, `UNIT_OCT_CYL`, `UNIT_CONE`, `makeBox()`, `makeCylinder()`；`hemiLight`, `dirLight`, `cityGlow1/2/3`, `trainHeadLight`, `bridgeSweepLight` |
| `02_shaders_and_textures.js` | `L363-L1254` | 894 行 | 第 4 ~ 5 节 | `createHoloGlobeTexture()`, `createVolumetricBeamMaterial()` (`volBeamCyanMat/PinkMat/BlueMat/AmberMat`), `createWetGroundMaterial()`, `createAbyssCloudLayerMaterial()`；`createWindowTexture(styleType)` (5 套幕墙纹理)、`createBillboardTexture(type)` (6 套动态巨幅投屏) |
| `03_materials.js` | `L1255-L1442` | 190 行 | 第 6 节 | 全局材质库 `mats`（含建筑暗黑基底 `buildingDark/DarkAlt/DarkChrome`、5 套幕墙发光材质、6 套巨幅广告屏材质、轨道/龙门架材质、4 色高倍自发光霓虹灯条 `neonStripCyan/Pink/Amber/Blue`、列车碳素装甲与流光材质） |
| `04_tracks_and_bridges.js` | `L1443-L2034` | 594 行 | 第 7 ~ 9 节 | `tracksConfig`, `trackCurves`, `getTrackFrame()`, `getClosestTrackPoint()`；`trackGroup` (三轨立体高架桥与桥墩 `createSupportPillar`)；`bridgeGroup`, `bridgeColliders`, `pedestrianLights`, `bridgeEnergyPulses` (玻璃龙门廊桥、落地对接塔楼、桥底洗墙光幕) |
| `05_city_architecture.js` | `L2035-L2996` | 964 行 | 第 9B ~ 11 节 | 现代化建筑构件生成器 `addGrandModernSkyLoggia()`, `addSightseeingElevator()`, `addBillboardScreen()`, `addBuildingOpticalLines()`；`megaCrossTower` (265m 十字正交双层穿楼巨塔)；`cityGroup`, `wetGroundMat`, `abyssCloudLayers`, `animatedElevators`, `rotatingHolos`, `patrolBlimps` (8 座 500m 级远景泰瑞尔巨构、天际线逆光雾幕、高空探照飞艇、5 类近景摩天大楼群) |
| `06_holo_wonders_and_cars.js` | `L2997-L3248` | 254 行 | 第 12 ~ 13 节 | `holoWondersGroup`, `holoEarthGroup` (52m 全息地球与赤道星环), `skyIslandsGroup`, `floatingIslands` (3 座悬浮生态空岛与反重力引擎), `holoKoiFish` (6 条全息 3D 多关节摆尾游动巨型锦鲤)；`flyingCarGroup`, `flyingCars` (42 辆双层双向浮空飞车与警车流) |
| `07_trains_and_particles.js` | `L3249-L3536` | 290 行 | 第 14 ~ 16 节 | `trains` (3 列哑光碳素磁悬浮列车、流线破风车头、车顶受电弓、转向架), `trainSlipstreamParticles` (高速破风长尾流光粒子系统)；`rainSystem`, `rainGeo`, `rainVel` (赛博夜雨粒子)；`edgeGroup` (CyberWire 结构边缘线系统) |
| `08_camera_and_loop.js` | `L3537-L4347` | 813 行 | 第 17 节 | `holoModeBtns`, `styleBtns`, `camBtns`；`applyRenderStyle()` (Original / Clay / Wireframe / CyberWire / FullBright 五种渲染模式切换)；`setCamMode()`, `keys` (A/D 环绕、空格暂停)；`updateSingleTrain()`, `animate()` 主循环（含过弯物理减速、穿桥实时动态扫光、5 种电影级运镜平滑过渡） |
| `09_slime_3d_asset.js` | 独立扩展资产 | 767 行 | 3D 史莱姆模块 | `window.CyberSlime3D`（含 `createSlime3DAsset()`, `mountToTrainLeadCar()`, `updateSlime3DPhysics()`：程序化 64×48 水滴凝胶网格、果冻 Squash & Stretch 弹簧物理、内部悬浮核心与气泡、电弧触角与磁吸底座） |
| `slime_3d_showcase.html` | 独立预览画廊 | 382 行 | 3D 史莱姆检视器 | 独立交互式 3D 史莱姆特写实验室（支持果冻Q弹度、过弯G力、车速风压、电弧强度实时滑块测试与视角切换） |

---

## 二、 新版（4,350 行）相比旧版（3,891 行）核心新增与优化内容（+459 行）

通过逐模块 Diff 比对，最新优化版在以下 5 个核心模块进行了重点升级：

### 1. `02_shaders_and_textures.js`（+170 行：建筑幕墙黄金明暗比与巨幅投屏精修）
- **建筑幕墙“88% 暗面基底 + 9% 稀疏成簇窗户点亮率”黄金平衡**：重构 `createWindowTexture(styleType)`，将约 62% 的楼层设为全暗留白以形成自然的呼吸节奏，仅保留约 9% 的稀疏成簇真实窗户光点（明暗分级），彻底解决此前满铺亮窗导致的画面噪点过密与发光喧宾夺主问题。
- **差异化光学线条强化**：优化 5 类建筑幕墙的竖向/横向/斜向霓虹导光槽细节，使大楼暗面体积感与高对比霓虹轮廓更突出。

### 2. `03_materials.js`（+6 行：材质反射率与自发光配比微调）
- 配合新版稀疏暗面幕墙，微调建筑立面材质的 `emissiveIntensity` 与粗糙度/金属度，并强化 `buildingDarkChrome` 暗黑镀铬边框质感。

### 3. `04_tracks_and_bridges.js`（+47 行：消灭悬空走廊，新增桥底横担与落地对接塔楼）
- **轨道底部横担托梁与斜撑 (`underTrackGirder` / `portalLeg` / `legBrace`)**：在玻璃龙门廊桥下方新增重型横担托梁与门架立柱，让廊桥牢牢锚固在轨道梁体上，消除结构悬空感。
- **廊桥两端专属【落地对接塔楼 (`Bridge Terminal Bastion Tower`)】**：将廊桥总跨度扩展至 `totalSpan = 62.0`，在左右两端 (`±33.5m`) 建造直达地面的重型承重对接塔楼、高耸垂直电梯井光带、塔顶停机坪警示冠与 4 层加强箍环，并在 `±29.5m` 处增设 3D 实体对接门廊法兰圈 (`portalCollar` + `portalGlowRing`)，彻底消灭“空中走廊两头悬空切断”的穿帮问题。

### 4. `05_city_architecture.js`（+89 行：天际线逆光雾幕、500m 级泰瑞尔巨构拉近与高空探照飞艇）
- **巨幅投屏暗色背板与纤细发光画框 (`addBillboardScreen`)**：为大楼动态投屏增加 `buildingDarkChrome` 背板、上下发光边框与四角固定机械卡扣，使视觉焦点集中于投屏画面内部。
- **外围【天际线大气逆光雾幕 (`Horizon Atmospheric Backlight Cylinder`)】**：新增半径 410m、高 620m 的自定义 Shader 环绕大气逆光雾幕，采用“亮雾托暗山”技法（底部浓郁青紫/品红城市光污染逆光雾气向上渐隐），将远景深黑巨构剪影彻底从夜空中衬托出来。
- **8 座 500m 级超级巨构拉近至黄金视距 (`260m~350m`)**：底座加宽至 `210m~265m`、高度提升至 `480m~580m`（含泰瑞尔阶梯金字塔 `ziggurat`、双子连廊巨塔 `twin_arch`、斜切刀锋巨构 `monolith`），并增加巨构侧面高耸入云的巨型垂直光带、停机坪信标灯与刺破天际的 `megaBeam` 体积光柱。
- **高空巡航探照飞艇 (`patrolBlimps`)**：在 `170m~260m` 高空新增 6 艘缓慢巡航的赛博飞艇（带八边形气囊、底部发光吊舱、侧舷霓虹灯带与向下扫射的动态体积探照光锥 `searchCone`）。

### 5. `08_camera_and_loop.js`（+136 行：5 种渲染模式完善、探照飞艇动画与运镜调优）
- **全量接入新材质到 5 大渲染模式 (`applyRenderStyle`)**：在 Clay（素模）、Wireframe（纯线框）、CyberWire（赛博线框）、FullBright（全亮材质）与 Original（电影辉光）切换中完整接管新增的远景巨构、逆光雾幕与桥体结构材质。
- **高空巡航飞艇动画**：在 `animate()` 主循环中驱动 `patrolBlimps` 沿环线巡航、上下微幅悬浮，并让底部探照灯锥动态摇摆扫射城市深渊。
- **相机运镜与交互优化**：优化 POV、尾随、弯道特写与鸟瞰视角的构图及阻尼平滑度。

---

## 三、 预览与使用方式

1. **完整赛博城市预览**：启动本地静态服务器后访问 `worlds/world_03_cyber/split/index.html`。
2. **3D 史莱姆独立实验室**：访问 `worlds/world_03_cyber/split/slime_3d_showcase.html`。
3. **在主场景挂载 3D 史莱姆**：`index.html` 已默认引入 `09_slime_3d_asset.js`，可在控制台或脚本中直接调用：
   ```javascript
   const slimeApi = window.CyberSlime3D.mountToTrainLeadCar(trains[0], scene, camera);
   ```
