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
2. **`world.js`（默认样片）**：单缸四冲程。常数 `K`（缸径 84 / 曲柄 43 / 连杆 143 / 压缩高 24 / 缸面 210 / CR 9.5）→ 滑块曲柄闭式解 + 气门升程窗；`update(th, ops)` 摆位。删除本文件后，kernel 仍应能构建另一台机器。
   样件按「正在被标定的样机」建：机匣是 16 mm 壁厚的空腔（只有剖切能打开），缸套是**空心**铝铸件（内孔 Ø86 + 4 道**剖面台阶式**散热鳍 + 安装法兰，外表面封闭；鳍是轮廓的一部分，不是套在筒身上的圆环），缸盖是开放铸件（后壁 / 两侧壁 / 顶盖 / 缸面，前向敞开，凸轮在盖内）。活塞是亮钢、活塞环是结构黑——缸内无光，深色活塞在剖切里会糊成一根黑筒。
3. **零复用规则**：新题材必须重写 `world.js`，不得把本样片的道具当贴纸拼贴（ADR-013）。

---

## 3. Rendering Pipeline, Camera Grammar & Shader Recipe

- **运镜（`engine/director.js` shot list）**：`push` / `pull` / `orbit` / `rise`，恒定 26–31° 焦段；**无抖**。特写只给刻线、配合面与读数。取景用**实测**包围盒（机体 −0.003…2.39 世界单位、宽 1.95、深 1.5）。
- **相机距离不设上限**：`createCalLabStudio({ maxDist: null })`。影棚无缝、雾 0.006，本来没有可撞的东西；一旦设上限（曾为 9），`director` 的 `Math.min(dist, maxDist)` 会静默改写每个镜头的 `fill`——爆炸镜需要 13.4–13.8、剖切拉远需要 11.3，被截到 9 后「拉远」只剩 2.7% 位移，爆炸堆叠被顶到画框上下沿。
- **Pass Chain**：`['grain', { amount: 0.014, paper: 0.0, vignette: 0.16 }]`。材质感来自 kernel 的 PBR（阳极铝 / 钢 / 石墨 / 白喷粉），不用屏幕空间贴图。
- **剖切**：`renderer.localClippingEnabled = true`；`THREE.Plane((-1,0,0), c)` 沿 X 轴在世界空间扫过（**0.92 → 0.02**，0.1–1.7s）。`shells` 覆盖缸套 / 缸盖 / 机匣六面壁 / 气门组，曲轴与连杆保持完整——但在 0.02 处机匣近侧壁与缸套近侧壁已被完全切掉，所以「为什么这么动」看得见曲柄销、连杆与活塞。
  剖切镜头切到**侧视**（yaw 70° → 82°）：机构在 XY 平面内摆动，侧视才把它读成一张机构图；正斜视只能看到半根立柱。剖切终点停在 0.02 而非 0：停在 0 会把整机对半劈开，机构看起来像残骸。
  截面盖不走 stencil（无头渲染的默认帧缓冲没有 stencil），改为**解析生成**并随 `cutConst` 每帧平移（`placeCap()`）：机匣用 16 mm 壁厚框、缸套用 43→69 mm 的壁带（切面跨过缸孔时拆成左右两条）、**缸盖不封盖**（它是开放铸件，封盖会盖住气门组）。盖板用比本体深的 `#5C636C`，浅色盖会被读成「立在样件上的白色柱」。
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
| cut stock | `#5C636C` | 解析截面盖（切面） |
| `--font-body` | Inter | 标题与说明 |

材质：阳极铝 `metalness .88 / roughness .34`；哑光白 `#E9EAEC / roughness .62`；结构黑 `#1A1C1F / roughness .36 / clearcoat .4`；钢 `metalness 1 / roughness .28`；石墨 `#464C53 / metalness .55 / roughness .46`（活塞与连杆：白壳里唯一读得出的深色值）；青铜 `#B08A5A`；聚碳酸酯 `opacity .18 / depthWrite false`。

**HUD 只画一次测量**：标题 + 一个字读数 + 相位条；升程曲线只出现在 04。此前的 3 行读数、公式、`1 DOF · DERIVED` 角标、进度条与示功图（340 px、无刻度、两个点）合计占画面约 1/3，却不解释任何机械动作。

---

## 5. Multi-Scene Timeline & Camera Sheet

| Scene | ID | Window | Camera | Action | Cues |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **01** | `lab-run` | 0.0–4.2s | `orbit` 34° → `push` 14° | 样件在台面上运行；前端同步轮与飞轮在转，缸盖敞口里凸轮压弹簧 | `brass_ratchet` ×3 |
| **02** | `lab-section` | 4.2–8.2s | 切到侧视 `pull`（70°）→ `push`（82°） | 切面 1.6s 内从侧壁扫到缸孔：机匣近壁与缸套近壁消失，曲柄销 / 连杆 / 活塞成一张机构图 | `scale_tilt`, `count_tick` |
| **03** | `lab-explode` | 8.2–12.2s | `rise`（26°） | 缸套抬 205 mm 越过活塞冠面，缸盖（凸轮随盖）抬 300 mm；曲柄连杆活塞留在机匣上继续转 | `card_enter` ×4 |
| **04** | `lab-valves` | 12.2–16.0s | `wide` → 推近缸盖（18°） | 回装（**solid**）；开放缸盖让凸轮压在弹簧 / 气门杆上，配升程曲线 | `count_tick` ×2 |

---

## 6. Tactile Assets & Sound Preset

- **Tactile Surface Texture**：`../assets/textures/brushed_metal.png`（台面/图版底色参考）。
- **Sound Preset**：`terminal`；cue 只落在机构节点（曲轴过点、剖切扫过、层分离、气门峰值），连续运动保持安静。
- **采样层（可选）**：`samples.json` 把 cue kind 绑到真实 one-shot（`brass_ratchet → ratchet-crank`、`count_tick → claves-hit`、`scale_tilt → brake-hammer`、`card_enter → slapstick`、`layer_float → anvil-hit`），床用 `cello-bed` 低八度；绑定后**替换**该 kind 的合成拟音，避免双重触发。缓存缺失时自动回退纯合成。

---

## 7. Verification Checklist

- [x] `kernel.js` 只含题材无关的材质/几何/影棚/仪表；`world.js` 只含默认样片
- [x] `stageMode: '3d-pure'`，`scenes.html` 无任何文字卡
- [x] `node tools/audit.mjs --style calibration-lab --all-sizes` → **PASSED (0 issues)** on 1920×1080 / 1080×1920 / 1080×1080（3D-pure 无 DOM 文字，规则 2–5 空过，规则 1 零报错）
- [x] `node tools/render.mjs --style calibration-lab --sheet styles/calibration-lab/contact_sheet.jpg` 已生成并逐格读图（2026-11-01，v4 重出）
- [x] `node tools/render.mjs --style calibration-lab --storyboard …` 零告警（8 个镜头：01×2 / 02×2 / 03×2 / 04×2，无 jump-cut、无镜头序列重复、无超长单镜）
- [x] `python3 tools/lookcheck.py --style calibration-lab` → 地板检查 OK，基线已存 `styles/calibration-lab/look_baseline.jpg`
  - 该风格在 `tools/lookcheck.py` 中有一条**有注释的**地板覆盖：`half_void_max 0.80`（默认 0.72）。无缝浅灰影棚 + 单件样机没有布景可填上部画框，空的上半幅就是这个媒介本身（无地平线、无道具），HUD 在左上角提供视觉锚点。
- [x] `gallery/catalog.js` 已注册 `stageMode` / `bestFor` / `avoidFor` / `cameraPresets`

细节层：凸轮室由后壁 + 两根前立柱与轴承盖围出（前向开放）；缸盖做成**开放机体**（后壁 / 两侧壁 / 缸面 / 顶板，前面敞开），所以 solid 视角也能直接读到气门与弹簧，不必为了“看得见”而在每一镜都剖切；后端正时链轮随凸轮转动，机匣前脸有铆接铭牌，排气歧管按 CatmullRom 扫管生成。

已知短板：切面盖是盒体近似（缸套壁带不随锥度收窄、机匣圆角被抹平）；气门杆在弹簧内几乎不可见（缺摇臂与弹簧座细节），缸盖读作“校具盒”而非铸造缸盖；排气歧管只有出口法兰，缺管夹与吊架；**运行镜看不到活塞**（缸套封闭，活塞只在剖切 / 爆炸两镜出现），试过 72° 开口外套与玻璃缸套，都会在画面上变成“白柱子”或“奶白罩”，故放弃；相位条在 1080p 下偏小。
