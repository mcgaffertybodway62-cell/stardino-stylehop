# Calibration Lab · 计量实验室（`styles/calibration-lab/SPEC.md`）

> 一句话：**机器不是展品，是正在被标定的样件。** 浅色无缝影棚、高反差工业反射灯带、程序化机加工法线/粗糙度微纹理、真 Stencil 剖切封盖、安全橙强调与 3D 尺寸公差引线；读数与姿态来自同一个函数。
> 设计迭代记录见本目录的 git 提交历史。

---

## 1. Visual Medium, Stage Mode & Topic Routing（视觉媒介与题材路由）

- **Style ID**: `calibration-lab`
- **Display Name**: Calibration Lab / 计量实验室
- **Stage Mode**: `'3d-pure'`（`defaultOverlay: 'none'`）。`scenes.html` 只含时间轴容器，**零检视文字卡**；仪表在 3D 画布内绘制。
- **Best-Fit Topics**: 机械原理与结构拆解（发动机 / 泵 / 减速箱 / 连杆机构 / 多自由度机械臂 / 仿生机构）；量具、标定与公差；工程教学与“它为什么这么动”；专利与论文机制可视化。
- **Avoid For**: 需要情绪与角色的故事短片；高密度金融 K 线与报表；纯命令行终端演示。

---

## 2. Style Kernel vs. Story World Separation

1. **`kernel.js`（可复用媒介）**：
   - **色彩与光影令牌（`CAL_PALETTE` / `CAL_LOOK`）**：启用 `env.studioStrips: true` 高反差工业影棚反射阵列（冷白高光窄灯带 + 深炭黑吸光挡板），让镀铬钢轴、轴承与阳极铝倒角呈现锐利冷峻的亮暗相间金属高光带。
   - **程序化工业微表面纹理与 PBR 材质工厂（`createSurfaceMaps` / `normalizeGeometryUVs` / `createMaterials`）**：确定性生成阳极氧化拉丝喷砂（`anodized`）、车床同心精密刀纹（`machined`）、压铸喷粉橘皮微颗粒（`cast`）法线与粗糙度贴图，以及 45° CNC 机械剖面线（`hatchMap`）与装配缝隙接触遮蔽贴图（`aoRadialTex`）；通过三平面毫米级 UV 归一化（`normalizeGeometryUVs`）保证所有几何体表面颗粒密度一致。
   - **工业 CSG-2D 孔槽特征与多轴/仿生几何原语**：
     - `blockGeometry`（圆角方盒）、`machinedPlateGeometry`（支持任意圆孔阵列 `holes` 与圆角矩形/腰形减重槽 `slots` 的 2D 布尔减挤出板/壳）、`counterboreBossGeometry`（沉头螺钉孔座 / 轴承法兰凸台）、`ribbedLinkGeometry`（带工字形腹板凹槽与大小头通孔的锻造/机加工连杆）；
     - `gearGeometry`（支持斜齿与减重孔阵 `lighteningHoles`）、`helixGeometry`（螺旋弹簧）、`boltGeometry`（内六角圆柱头螺钉 + 垫圈）；
     - `sweptProfileGeometry` + `updateSweptGeometry`（基于无翻转 Bishop 标架的 3D 样条变截面/椭圆扫掠，支持仿生触手、流线型歧管与实时变形软管）、`bellowsGeometry`（液压/气动波纹管）、`ballJointGeometry`（球铰万向节）；
     - `creviceAoRing` / `creviceAoBox`（零件咬合处的局部环境光遮蔽暗环/暗框）。
   - **真 Stencil 剖切封盖管理器（`createSectionCutManager`）**：基于 WebGL Stencil Buffer（背面递增 + 正面递减 + 45° 机械剖面线封盖平面）自动为任意闭合壳体生成严丝合缝的实时截面封盖，无需手写方盒凑坐标。
   - **多自由度运动学与次级联动求解器**：`solveFabrikChain`（带锥角约束的 3D 逆运动学）、`solveKinematicChain`（仿生行波相位滞后 + 末端鞭梢动量放大 + IK 混合链）、`solveTwoLinkIK2D`（平面二连杆解析 IK）、`poseActuator`（两端球铰液压缸/推杆对位）、`poseCompressedSpring`（体积守恒径向微膨胀弹簧压缩）、`layerEase`（分阶段爆炸）。
   - **物理场着色器与 3D 工程引线标注**：`createPressureFieldMaterial`（支持剖切平面的腔体热力学压力波与燃烧梯度场 Shader）、`createTorqueArc`（3D 扭矩/力流矢量弧带）、`createDimensionCallout`（3D 空间尺寸公差延伸线与动态读数牌）、`lerpFramingBox` / `weightedCoreBox`（动态变形插值取景盒与稀疏放射体核心加权取景盒）。
2. **`world.js`（默认样片）**：单缸四冲程。常数 `K`（缸径 84 / 曲柄 43 / 连杆 143 / 压缩高 24 / 缸面 210 / CR 9.5）→ 滑块曲柄闭式解 + 气门升程窗；`update(th, ops)` 摆位。删除本文件后，kernel 仍能构建任意机械或仿生机构。
3. **零复用规则**：新题材必须重写 `world.js`，不得把本样片的道具当贴纸拼贴（ADR-013）。

---

## 3. Rendering Pipeline, Camera Grammar & Shader Recipe

- **运镜（`engine/director.js` shot list）**：`push` / `pull` / `orbit` / `rise`，恒定 26–31° 焦段；**无抖**。支持 `{ from: HERO, to: EXPLODED }` 动态插值取景盒与 `coreBox / coreWeight` 稀疏主体核心加权取景。
- **相机距离不设上限**：`createCalLabStudio({ maxDist: null })`。
- **Pass Chain**：`['grain', { amount: 0.014, paper: 0.0, vignette: 0.16 }]`。
- **剖切（True Stencil Section Cut）**：`renderer.localClippingEnabled = true` 且 `WebGLRenderer({ stencil: true })`；`THREE.Plane((-1,0,0), c)` 沿 X 轴在世界空间扫过（**0.92 → 0.02**，0.1–1.7s）。通过 `createSectionCutManager` 自动为机匣、散热鳍缸套、缸盖与凸轮室生成带 45° CNC 剖面线的精确 Stencil 截面封盖，同时缸内保留 `createPressureFieldMaterial` 热力学压力波梯度场。
- **HUD**：相机子节点平面 + `CanvasTexture`，`depthTest:false / toneMapped:false`，每帧按 `camera.fov` 重算尺寸；`userData.skipContactShadow = true`。

---

## 4. Color, Material & Typography Tokens

| Token | Value | 用途 |
| :-- | :-- | :-- |
| `--bg` / backdrop | `#EDEFF1` | 无缝浅灰影棚 |
| `--surface` | `#FAFBFC` | HUD 面板底 |
| `--ink` | `#15181C` | 读数与轴线 |
| `--muted` | `#7C838C` | 微标签 |
| `--accent` | `#FF5A1F` | **唯一**强调色：正在工作/被测量的那件 |
| `--line` | `rgba(21,24,28,.12)` | 1px 分隔与面板边 |
| `--font-mono` | JetBrains Mono | 所有数字，`tabular-nums` |
| sectionCap | `#4A525C` + 45° CNC Hatch | Stencil 解析剖切截面封盖 |
| `--font-body` | Inter | 标题与说明 |

---

## 5. Multi-Scene Timeline & Camera Sheet

| Scene | ID | Window | Camera | Action | Cues |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **01** | `lab-run` | 0.0–4.2s | `orbit` 34° → `push` 14° | 样件在台面上运行；前端带减重孔斜齿轮与扭矩弧带旋转，右侧 3D 尺寸引线实时追踪活塞余隙 | `brass_ratchet` ×3 |
| **02** | `lab-section` | 4.2–8.2s | 切到侧视 `pull`（70°）→ `push`（82°） | Stencil 切面 1.6s 内扫到缸孔：散热鳍、机匣壁呈现精确 45° 剖面线，缸内热力学压力波场与工字连杆清晰可读 | `scale_tilt`, `count_tick` |
| **03** | `lab-explode` | 8.2–12.2s | `{from:HERO,to:EXPLODED}` → `rise` | 缸套抬 205 mm 越过活塞冠面，缸盖抬 300 mm；3D 尺寸引线切换为跟踪缸套分离行程 `ΔY` | `card_enter` ×4 |
| **04** | `lab-valves` | 12.2–16.0s | `wide` → 推近缸盖（18°） | 回装（**solid**）；开放缸盖内凸轮经摇臂压迫气门与体积守恒青铜弹簧，配升程曲线 | `count_tick` ×2 |

---

## 6. Tactile Assets & Sound Preset

- **Tactile Surface Texture**：`../assets/textures/brushed_metal.png`（台面/图版底色参考）+ 内核程序化生成法线/粗糙度微纹理。
- **Sound Preset**：`terminal`；绑定 `samples.json` 真实机械拟音采样。

---

## 7. Verification Checklist

- [x] `kernel.js` 只含题材无关的材质/微表面纹理/CSG与仿生几何/Stencil剖切/多自由度运动学/物理场与3D引线/影棚/仪表；`world.js` 只含默认样片
- [x] `stageMode: '3d-pure'`，`scenes.html` 无任何文字卡
- [x] `node tools/audit.mjs --style calibration-lab --all-sizes` → **PASSED (0 issues)** on 1920×1080 / 1080×1920 / 1080×1080
- [x] `node tools/render.mjs --style calibration-lab --sheet styles/calibration-lab/contact_sheet.jpg` 已生成并逐格读图（2026-11-01，v5 升级）
- [x] `node tools/render.mjs --style calibration-lab --storyboard …` 零告警
- [x] `python3 tools/lookcheck.py --style calibration-lab` → 地板检查 OK
