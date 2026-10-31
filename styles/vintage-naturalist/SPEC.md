# Vintage Naturalist · 复古博物学 · 大众硬核科普风格规范

> 19 世纪博物学铜版画 + 超大字号信息排版 + 黄铜机制仪表。  
> 目标不是“复古滤镜”，而是让**论文机制**在一张可读的羊皮纸图版上讲清楚。

---

## 1. 视觉媒介、舞台模式与题材路由

- **Style ID**: `vintage-naturalist`
- **Display Name**: `Vintage Naturalist` / `复古博物学`
- **Stage Mode (`style.js -> stageMode`)**: `'hybrid'`
  - 2D Canvas 绘制铜版画/羊皮纸/仪表（`engine/studio2d.js`）；
  - DOM 排版层承载章节眉栏、超大标题、圆角胶囊标签与底部字幕坞；
  - `defaultOverlay: 'typography'`。
- **Best-Fit Topics (`style.js -> bestFor`)**:
  - 科学史 / 博物学 / 演化与自然选择 / 生物学机制拆解
  - 论文解读 / 顶刊成果 / 实验与证据链 / 辟谣与科学边界
  - 天文地质 / 古生物化石 / 标本档案 / 博物馆与田野笔记
  - 医学与神经科学 / 分子机制 / 工程原理 / 硬核知识科普
- **Avoid For (`style.js -> avoidFor`)**:
  - 高密度金融K线与财务报表
  - 纯命令行代码终端演示
  - 无旁白的抽象情绪短片 / 纯氛围音乐可视化

---

## 2. 风格内核与故事世界的边界（`kernel.js` vs `world.js`）

### 2.1 `kernel.js`：只提供媒介法则，不提供标本贴纸

| 层 | 导出 | 职责 |
| :-- | :-- | :-- |
| 纸张 | `VN_PALETTE` / `VN_LOOKS` / `drawParchmentBackdrop` | 羊皮纸底、竹帘纹、纸浆纤维、霉斑、边缘暗角 |
| 图版 | `drawPlateFrame` / `drawSpecimenPin` | 双线古典边框、黄铜角花、标本针 |
| 蚀刻 | `hatchShape` / `stippleShape` / `etchPath` / `washShape` / `drawMedallion` | 任意路径的平行排线、交叉排线、点刻、水彩罩染、标本圆窗 |
| 仪表 | `drawBrassRing` / `drawBrassDial` / `drawBalanceScale` | **值驱动**的黄铜旋钮、天平；`dial(value)` / `scale(tilt)`，不是固定隐喻贴纸 |
| 终幕 | `drawTreeOfLife` | 确定性递归分枝 + 叶簇 + 星场；`seed` / `height` / `reveal` 可参数化 |
| 舞台 | `createVintageStage` | 2D 多平面舞台、单场单向微镜、画幅自适应设计空间 |

**铁律（ADR-013）**：`kernel.js` 不出现雀、细胞、DNA、化石等具体标本。具体标本的轮廓一律在 `world.js` 提供，再用 `hatchShape` / `stippleShape` / `etchPath` 渲染。

### 2.2 `world.js`：默认 15 秒样片

- 主题：《同一片群岛 · 达尔文雀的喙》。
- 具体资产：雀的连续剪影、三种喙形、种子、树枝、四场构图。
- 默认样片只用于展示风格语法；未来题材必须重新绘制自己的标本轮廓与构图，禁止复制 `world.js` 的坐标与镜头表。

---

## 3. 渲染管线、运镜与画幅

- **舞台**：`engine/studio2d.js`，每场最多一个单向微运动（`push` / `pull` / `pan` / `drift`），不做来回变焦。
- **设计空间（画幅自适应）**：
  - `1920×1080` → 设计空间 `1920×1080`
  - `1080×1920` → 设计空间 `1080×1920`
  - `1080×1080` → 设计空间 `1080×1080`
  - 画布/设计空间 `1:1`，因此铜版画与 DOM 字号在三种画幅下按短边等比缩放。
- **Pass 链**：`grain`（`amount 0.013`, `paper 0.018`, `vignette 0.12`, `warm 0.03`）。
- **画布纹理**：`assets/textures/paper_fiber.png`。
- **声学预设**：`naturalist`（大提琴拨弦/长音 + 羽管键琴/古钢琴 + 玻璃琴泛音 + 铜版蚀刻/黄铜棘轮/天平砝码物理拟音）。
- **DOM 预绘制钩子**：`world.prepareDom(frame)` 在 `engine/stage.js` 的 `paint()` 之前更新字幕进度条，保证离线静帧与视频一致。

---

## 4. 配色、材质与字号

### 4.1 五色克制体系

| Token | 色值 | 用途 |
| :-- | :-- | :-- |
| Parchment | `#F4EAD5` / `#FAF3E4` | 羊皮纸底、面板 |
| Sepia Ink | `#2A211B` / `#4A3C31` | 轮廓、标题、深色胶囊 |
| Crimson | `#B22D25` | 警示、选择压力、辟谣/否定 |
| Teal | `#1F6E66` | 正常状态、存活、功能标签 |
| Brass | `#D4942A` / `#F5BD41` | 仪表、边框、神经脉冲、星点 |

### 4.2 1080p 字号红线（全部以 `--u` 表达，1u = 短边 1% = 10.8px）

| 元素 | `--u` | 1080p 实际 | 说明 |
| :-- | --: | --: | :-- |
| 主标题 `.vnh-title` | `4.6u` | 49.7px | 42–56px 区间；`text-wrap: balance` |
| 底部字幕 `.vnh-subtitle` | `3.38u` | 36.5px | 34–38px；深墨棕字幕坞 ≥ 94% 宽度 |
| 章节眉栏 `.vnh-chapter__title` | `3.15u` | 34.0px | 居中衬线体 |
| 出处徽章 `.vnh-chapter__source` | `2.35u` | 25.4px | 右对齐，金边深棕底 |
| 胶囊 `.vnh-pill` | `2.95u` | 31.9px | 30–38px；4–12 个汉字；100% 不透明 |
| 图版小标 `.vnh-kicker` | `2.3u` | 24.8px | 全片最低字号 ≥ 23px |

> 门禁命令必须带 `--min-font 23`；默认 `audit.mjs` 的 12px 下限适用于其他风格。

### 4.3 版式铁律

- 一屏一焦点：每场只保留 1 个主体（或 1 组左右对比），留白率 ≥ 45%。
- 胶囊标签不得遮挡插画；画布内的仪表不烘焙文字，文字全部走 DOM 以便审计。
- 禁止 PPT 文字墙、多栏论文摘要、英文副标题与拉丁文学名。

---

## 5. 多场时间轴与镜头表

| Scene | ID | Window | Look | Camera | Scene Action & Subject | Foley Cues |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| **01** | `specimen-plate` | `0.0–3.8s` | `plate` | `push` | 图版自己“印”出来：双线框、铜版排线、标本针依次出现；雀立于枝上 | `0.2 card_enter`, `0.8 stroke_draw`, `2.2 count_tick`, `3.0 layer_float` |
| **02** | `beak-tools` | `3.8–7.5s` | `amber` | `pan` | 三枚标本圆窗：粗喙/细喙/中喙，黄铜导轨与三枚胶囊 | `0.25 stroke_draw`, `0.9 count_tick`, `2.4 layer_float` |
| **03** | `drought-selection` | `7.5–11.3s` | `dusk` | `push` | 黄铜种子硬度旋钮从“雨季”扫到“旱季”；厚喙/薄喙对照与天平倾斜 | `0.3 stroke_draw`, `1.0 count_tick`, `2.0 impact`, `3.0 layer_float` |
| **04** | `tree-of-life` | `11.3–15.0s` | `starlight` | `pull` | 星空图版 + 递归生命之树；金色叶簇与四芒星逐级点亮 | `0.3 stroke_draw`, `1.4 layer_float`, `2.6 count_tick` |

总时长 **15.0s**；镜头表由 `studio.director` 提供，每场 2 个 storyboard 拍点、1 个连续运镜。

---

## 6. 质感资产与声音

- **Tactile Surface Texture**: `../assets/textures/paper_fiber.png`
- **Sound Preset**: `naturalist`
- **Voice（可选，默认关闭）**：样片不含 TTS。长片按 `tools/voice.py` 的 `voice.json` 逐场锚定；字幕坞已预留 4–12 字胶囊与 20–26 字旁白行。烧录字幕与 `voice.timing.json` 的逐行对齐属于 75s 科普长片阶段的扩展，不在本 15s 样片内。

---

## 7. 门禁与交付

```bash
STYLE=vintage-naturalist

# 1. 三画幅 DOM / 运行时 / 23px 字号红线 / 年份事实核对
node tools/audit.mjs --style $STYLE --all-sizes --min-font 23 \
  --facts "1835, 1977, 1859"

# 2. 逐镜分镜图 + 2x2 样片
node tools/render.mjs --style $STYLE \
  --storyboard /tmp/$STYLE-storyboard.jpg \
  --sheet /tmp/$STYLE-sheet.jpg

# 3. 视觉回归与原创性
python3 tools/lookcheck.py --style $STYLE
python3 tools/lookcheck.py --style $STYLE --accept   # 仅在有意改版后重建基线

# 4. 最终 15s MP4（验证用，产物不进仓库）
node tools/render.mjs --style $STYLE --video /tmp/$STYLE.mp4 --fps 30 --workers 4
```

- [ ] `kernel.js` 不含具体标本；标本轮廓只在 `world.js`
- [ ] 三种画幅 audit 0 issues，`--min-font 23` 通过
- [ ] 分镜图/四宫格已人工检查运镜、构图与遮挡
- [ ] `lookcheck` 通过绝对可读性底线与原创性门禁
- [ ] `gallery/catalog.js` 已注册 `bestFor` / `avoidFor` / `keywords` / `cameraPresets`
