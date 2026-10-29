---
name: blueprint-island-tear
description: StyleHop × HTML-in-Canvas 旗舰融合画风：工程蓝图撕裂升维 3D 马卡龙浮岛（普鲁士蓝氰版 CAD 制图图框 + SECTION A-A 浮空岛正交剖面标注 + ELEVATION E-1 建筑立面 + 极坐标罗盘标尺 × WebGL2 正弦撕纸波前、卷曲纸边阴影与 3D 马卡龙浮岛/通天星光柱升维着色器）。完全去固有化主体，适合建筑工程、工业设计、产品结构拆解与概念升维演示。
version: 1.0.0
category: stylehop-fusion
stack:
  - html-in-canvas
  - webgl2
  - cad-typography
  - svg
  - analytical-spring
---

# Gallery A1 (StyleHop Fusion) · 工程蓝图撕裂升维 3D 浮岛 (`blueprint-island-tear`)

- **画廊复用入口 (`fusion/`)**：[`fusion/blueprint-island-tear/index.html`](../../fusion/blueprint-island-tear/index.html)
- **底层渲染引擎**：[`fusion/dom_shader.js`](../../fusion/dom_shader.js)（`corelib/html_canvas/render.mjs` 未随仓库分发）
- **分镜预览图**：[`fusion/blueprint-island-tear/contact_sheet.jpg`](../../fusion/blueprint-island-tear/contact_sheet.jpg)
- **关联九界画风与剧场 (`Series B`)**：[`world-09-blueprint`](../world-09-blueprint/SKILL.md) · [`styles/style_09_blueprint.py`](../../styles/style_09_blueprint.py) · [`worlds/world_09_blueprint/`](../../worlds/world_09_blueprint/)
- **成片规格**：4.0s / 96f–120f（1920×1080）；Chrome 151 `<canvas layoutsubtree>` + WebGL2 蓝图正弦撕裂与 3D 马卡龙浮岛升维着色器。

---

## 1. 视觉定位与为什么用 `HTML-in-Canvas × WebGL2`

- **定位**：源自九界第 09 界 **「工程蓝图 ↔ 3D 浮岛」** 的黄金左右分屏旗舰融合风格，采用**去固有化主体原则（Content-Agnostic）**，将「2D 普鲁士蓝 CAD 工程图纸 ↔ 3D 低多边形实体浮岛」凝练为通用视觉配方。
- **为什么用 `HTML-in-Canvas`**：
  - **DOM 层负责「毫米级精度的 CAD 工程制图图框与参数表格」**：国标工程图框（`1..8` / `A..D` 分区标尺）、`SECTION A-A 浮空岛正交剖面 1:50`（`Ø 3600`、`2050` 引出标注）、`ELEVATION E-1` 建筑立面、极坐标罗盘测绘站（`120° / 150° / 60° / 30° / R 120`）以及右下角多栏工程标题块与 `[ BUILT ✓ ]` 印章，全部由浏览器 CSS Grid / Table / SVG 原生排版，零重叠、零错位。
  - **WebGL2 层负责「正弦撕纸波前与 3D 空间材质升维」**：片元着色器通过 `gl.texElementImage2D(gl.TEXTURE_2D, gl.RGBA8, domScene)` 零拷贝捕获整张 DOM 画布纹理 `u_dom`，沿动态推进的正弦撕裂曲线 `tearX(y, t)` 将画面一分为二：左侧叠加氰版晒图纸纤维斑驳感与扫描波前辉光；撕裂边缘渲染真实的白色毛边纸带、卷曲高光与投射暗影；右侧展现薰衣草粉紫渐变天空、薄荷绿切面 3D 马卡龙浮岛群、水晶锥底座与通天白金星光柱。

---

## 2. 视觉主体材质与构图映射 (`Visual Subject Mapping`)

本风格不绑定任何固定角色，任意业务主体（建筑、工业产品、芯片架构、载具或抽象几何体）接入本风格时，遵循以下双界映射规范：

| 画面区域 | 媒介属性 | 任意视觉主体的转译法则 |
| :-- | :-- | :-- |
| **左半幅：2D 氰版蓝图界 (`#blueprint-world`)** | 普鲁士蓝底 (`#072247`) + 双层坐标网格 + 纯白 CAD 线框 | 将主体的**三视图 / 正交剖面图**以 `1.5px` 纯白实线、`6 4` 虚线中心轴与 `45°` 剖面线 (`url(#cadHatch)`) 绘制；关键内部结构打开 `90°` 等轴测剖面缺口，辅以引出线标注尺寸公差与极坐标角度。 |
| **中央：正弦撕裂波前 (`#tear-overlay-svg` + Shader)** | 手撕毛边白纸带 (`#F4F8FF`) + 青白扫描辉光 + 投射阴影 | 跨界主体在此处发生**「半边白线框 ↔ 半边 3D 着色实体」**的实时裁切过渡，展现从工程图纸向物理实体升维的瞬间。 |
| **右半幅：3D 马卡龙等轴界 (`#iso-world`)** | 粉紫天空 + 30° 等轴网格 + 明快低多边形切面 | 主体脱去蓝图线框，填充高明度低多边形切面色块（薄荷青 `#89EED3`、暖奶油 `#F5EEE0`、紫水晶 `#645386`、珊瑚粉 `#F58DA8`），顶部叠加垂直星光柱与同心波纹。 |

---

## 3. 核心技术实现

### 3.1 声明式 CAD 工程图框与双层世界裁切 (`index.html`)
- **国标 CAD 图框与标题栏**：外围 `1..8` 与 `A..D` 坐标边框、左侧 `SECTION A-A` 与 `ELEVATION E-1` 工程视图、中央极坐标罗盘测绘站以及右下角 `.cad-title-block` 表格，全部采用原生 HTML `<table>` 与 SVG 构建。
- **确定性弹簧动效**：`window.render(t)` 根据二阶欠阻尼弹簧 `springStep` 驱动罗盘雷达指针扫描、正弦撕裂锋面推进、右侧 3D 浮岛群悬浮呼吸以及 `[ BUILT ✓ ]` 绿色工程验收印章盖落。

### 3.2 WebGL2 正弦撕裂波前与氰版纸肌理着色器 (`FRAG_SOURCE`)
- **解析撕裂边界曲线**：
  $$x_{\text{tear}}(y, t) = x_0(t) + \sum_{k} A_k \exp\left(-\frac{(y_n - c_k)^2}{\sigma_k^2}\right) + \text{microWave}(y, t)$$
  通过 DOM 裁切与片元着色器同步计算撕裂位置，叠加纸张纤维噪声、撕裂边缘立体投影与右侧星光柱的柔和径向辉光。

---

## 4. 时间轴与分镜锚点 (`stills: 0.5, 1.5, 2.5, 3.5`)

- `0.5s`：普鲁士蓝 CAD 图框与极坐标罗盘点亮，雷达扫描指针扫过 `SECTION A-A` 浮空岛正交剖面图。
- `1.5s`：正弦撕裂波前向左推进，右侧 3D 马卡龙浮岛群与紫水晶岩锥从撕开的图纸裂缝中立体显现。
- `2.5s`：撕裂锋面抵达黄金分割位，跨界浮岛呈现「左半幅 CAD 白色三角线框 ↔ 右半幅 3D 彩色实体」的同屏对照。
- `3.5s`：右侧通天白金星光柱与罗盘星徽全面点亮，右下角 CAD 标题栏盖下 `[ BUILT ✓ ]` 验收印章完成定格。

---

## 5. 快速复用与渲染命令

```bash
# 生成 2x2 分镜预览图与 MP4 成片（输出写到仓库外的工作目录）
node tools/render.mjs --page showcase/fusion/blueprint-island-tear \
  --stills 0.5,1.5,2.5,3.5 \
  --sheet <work-dir>/blueprint-island-tear_contact_sheet.jpg \
  --video <work-dir>/blueprint-island-tear.mp4
```

### 复用与改装要点
1. **替换工程主体与图纸参数**：直接修改 `fusion/blueprint-island-tear/index.html` 中 `.cad-title-block` 的工程名称、图号、比例尺，并将左右两侧 SVG 替换为目标产品/建筑的 2D 剖面线框与 3D 等轴测图。
2. **控制撕裂曲线位置与推进速度**：调整 `tearXAtY(y, sec)` 中的推进偏移量，即可定制从全屏 2D 蓝图撕开至全屏 3D 实体的转场节奏。
3. **跨栈联动**：如需 Python / PyCairo 离线渲染版，见 [`styles/style_09_blueprint.py`](../../styles/style_09_blueprint.py)；如需带画廊吉祥物导览的 34 秒叙事样片，见 [`worlds/world_09_blueprint/`](../../worlds/world_09_blueprint/)。

## 相关文件

- [`fusion/blueprint-island-tear/index.html`](../../fusion/blueprint-island-tear/index.html)
- [`fusion/blueprint-island-tear/contact_sheet.jpg`](../../fusion/blueprint-island-tear/contact_sheet.jpg)
- [`skills/world-09-blueprint/SKILL.md`](../world-09-blueprint/SKILL.md)
- [`styles/style_09_blueprint.py`](../../styles/style_09_blueprint.py)
- [`fusion/dom_shader.js`](../../fusion/dom_shader.js)
