# Calibration Lab · 计量实验室（`styles/calibration-lab/SPEC.md`）

> 一句话：**机器不是展品，是正在被标定的样件。** 浅色无缝影棚、阳极铝与哑光白、刻线与尺寸标注、一个安全橙的强调；读数与姿态来自同一个函数。
> 私有设计背景见 `stardino-stylehop-devdocs/STYLE_PROPOSAL_CALIBRATION_LAB.md`。

---

## 1. Visual Medium, Stage Mode & Topic Routing（视觉媒介与题材路由）

- **Style ID**: `calibration-lab`
- **Display Name**: Calibration Lab / 计量实验室
- **Stage Mode**: `'3d-pure'`（`defaultOverlay: 'none'`）。`scenes.html` 只含时间轴容器，**零检视文字卡**；仪表在 3D 画布内绘制。
- **Best-Fit Topics**: 机械原理与结构拆解（发动机 / 泵 / 减速箱 / 连杆机构）；量具、标定与公差；工程教学与“它为什么这么动”；专利与论文机制可视化。
- **Avoid For**: 需要情绪与角色的故事短片；高密度金融 K 线与报表；纯命令行终端演示。

---

## 2. Style Kernel vs. Story World Separation

1. **`kernel.js`（可复用媒介）**：`CAL_PALETTE` / `CAL_LOOK` 令牌、`createMaterials`、规则化几何原语（`blockGeometry` / `gearGeometry` / `helixGeometry` / `boltGeometry`）、`createCalLabStudio`（包装 `engine/studio3d.js`，含刻线台面）、`createGaugeHud`（声明式仪表画布）、`layerEase`（分阶段爆炸）。**不含任何具体零件尺寸。**
2. **`world.js`（默认样片）**：单缸四冲程。常数 `K`（缸径 84 / 曲柄 43 / 连杆 143 / 压缩高 24 / 缸面 210 / CR 9.5）→ 滑块曲柄闭式解、气门升程窗、多变压缩压力模型；`update(th, ops)` 摆位。删除本文件后，kernel 仍应能构建另一台机器。
3. **零复用规则**：新题材必须重写 `world.js`，不得把本样片的道具当贴纸拼贴（ADR-013）。

---

## 3. Rendering Pipeline, Camera Grammar & Shader Recipe

- **运镜（`engine/director.js` shot list）**：`push` / `pull` / `orbit` / `rise`，恒定 26–31° 焦段；**无抖**。特写只给刻线、配合面与读数。取景用显式包围盒（含台面抬升），竖屏另用更窄的 HERO 盒补偿宽度约束。
- **Pass Chain**：`['grain', { amount: 0.014, paper: 0.0, vignette: 0.16 }]`。材质感来自 kernel 的 PBR（阳极铝 / 钢 / 玻璃），不用屏幕空间贴图。
- **剖切**：`renderer.localClippingEnabled = true`；`THREE.Plane((-1,0,0), c)` 沿 X 轴在世界空间扫过（0.9 → 0），只裁缸套 / 缸盖 / 阀组，机匣与曲轴保持完整；斜视 30–40° 才看得出半个圆柱的开口（正视时半圆柱投影仍是整圆）。截面盖不走 stencil（无头渲染的默认帧缓冲没有 stencil，teardown 式 cap 会整片绘制），改为**按机体形状解析生成**：缸套用两条随切面移动的壁厚竖条，缸盖用矩形边框，cap 面随 `cutConst` 每帧平移（`placeCap()`）。切面因此有材料感与壁厚，而不是半透明壳。
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
| `--font-body` | Inter | 标题与说明 |

材质：阳极铝 `metalness .88 / roughness .34`；哑光白 `#E9EAEC / roughness .62`；结构黑 `#1A1C1F / roughness .36 / clearcoat .4`；钢 `metalness 1 / roughness .28`；青铜 `#B08A5A`；聚碳酸酯 `opacity .18 / depthWrite false`。

---

## 5. Multi-Scene Timeline & Camera Sheet

| Scene | ID | Window | Camera | Action | Cues |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **01** | `lab-run` | 0.0–4.2s | `orbit` → `push`（低位） | 样件在台面上运行，读数已经在跳 | `brass_ratchet` ×3 |
| **02** | `lab-section` | 4.2–8.2s | `pull` → `push` 进缸 | 剖切面 1.4s 内扫过，缸内与示功图同时可读 | `scale_tilt`, `count_tick` |
| **03** | `lab-explode` | 8.2–12.2s | `rise` → `orbit` | 按装配顺序分层：曲轴 → 活塞 → 缸盖 → 凸轮 | `card_enter` ×4 |
| **04** | `lab-valves` | 12.2–16.0s | 推近缸盖 | 回装（**solid**，不剖切）；开放缸盖让气门、弹簧与凸轮直接可见，配升程曲线 | `count_tick` ×2 |

---

## 6. Tactile Assets & Sound Preset

- **Tactile Surface Texture**：`../assets/textures/brushed_metal.png`（台面/图版底色参考）。
- **Sound Preset**：`terminal`；cue 只落在机构节点（曲轴过点、剖切扫过、层分离、气门峰值），连续运动保持安静。

---

## 7. Verification Checklist

- [x] `kernel.js` 只含题材无关的材质/几何/影棚/仪表；`world.js` 只含默认样片
- [x] `stageMode: '3d-pure'`，`scenes.html` 无任何文字卡
- [x] `node tools/audit.mjs --style calibration-lab --all-sizes` → **PASSED (0 issues)** on 1920×1080 / 1080×1920 / 1080×1080（3D-pure 无 DOM 文字，规则 2–5 空过，规则 1 零报错）
- [x] `node tools/render.mjs --style calibration-lab --sheet styles/calibration-lab/contact_sheet.jpg` 已生成并逐格读图（2026-11-01）
- [x] `gallery/catalog.js` 已注册 `stageMode` / `bestFor` / `avoidFor` / `cameraPresets`

细节层：凸轮室由后壁 + 两根前立柱与轴承盖围出（前向开放）；缸盖做成**开放机体**（后壁 / 两侧壁 / 缸面 / 顶板，前面敞开），所以 solid 视角也能直接读到气门与弹簧，不必为了“看得见”而在每一镜都剖切；后端正时链轮随凸轮转动，机匣前脸有铆接铭牌，排气歧管按 CatmullRom 扫管生成。

已知短板：cap 只覆盖缸套与缸盖两类形状（排气歧管、气门与弹簧的切面无盖）；爆炸镜头垂直节奏偏稀；仪表相位条在 1080p 下偏小；缸盖开放后 solid 视角略“教学模型”而非整机质感。
