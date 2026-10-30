---
name: cyber-graffiti-cutin
description: StyleHop × HTML-in-Canvas 旗舰融合画风：赛博涂鸦破框列车与漫画斜切分镜（严格五色街头喷漆画框 + CSS 斜切漫画 Cut-In 分镜 + 全息磁浮遥测 HUD + 霓虹摩天楼天际线 × WebGL2 2D→3D 疾驰列车破框、RGB 故障色散、扫描线与放射速度线着色器）。完全去固有化主体，适合高燃预告片、载具/机甲破壁展示、电竞战报与潮流视觉包装。
version: 1.0.0
category: stylehop-fusion
stack:
  - html-in-canvas
  - webgl2
  - comic-cutin
  - svg
  - glitch-shader
---

# Gallery A2 (StyleHop Fusion) · 赛博涂鸦破框与斜切分镜 (`cyber-graffiti-cutin`)

- **画廊复用入口 (`fusion/`)**：[`fusion/cyber-graffiti-cutin/index.html`](../../fusion/cyber-graffiti-cutin/index.html)
- **底层渲染引擎**：[`fusion/dom_shader.js`](../../fusion/dom_shader.js)（`corelib/html_canvas/render.mjs` 未随仓库分发）
- **分镜预览图**：[`fusion/cyber-graffiti-cutin/contact_sheet.jpg`](../../fusion/cyber-graffiti-cutin/contact_sheet.jpg)
- **关联九界画风与剧场 (`Series B`)**：[`world-03-cyber`](../world-03-cyber/SKILL.md) · [`styles/style_03_cyber.py`](../../styles/style_03_cyber.py) · [`worlds/world_03_cyber/`](../../worlds/world_03_cyber/)
- **成片规格**：4.0s / 96f–120f（1920×1080）；Chrome 157+ `<canvas content="drawable">` + WebGL2 赛博霓虹破框、RGB 故障色散与高对比速度线着色器。

---

## 1. 视觉定位与为什么用 `HTML-in-Canvas × WebGL2`

- **定位**：源自九界第 03 界 **「赛博霓虹疾驰列车」** 的潮流涂鸦破框与漫画斜切分镜旗舰风格，采用**去固有化主体原则（Content-Agnostic）**，专注于「2D 涂鸦画框内扁平赛璐璐 ↔ 冲破画框右下角 3D 硬切面实体 + 斜切漫画 Cut-In 分镜」的高燃视觉语言。
- **为什么用 `HTML-in-Canvas`**：
  - **DOM 层负责「潮流漫画斜切分镜、竖排霓虹灯箱与全息遥测 HUD」**：利用 CSS `transform: skewX(-14deg)` 斜切分镜面板 (`#blade-cutin-panel`)、原生 `writing-mode: vertical-rl` 竖排电光青霓虹灯箱（`下一站·未来`）、右下角磁浮马赫数遥测卡片 (`#cyber-telemetry`) 以及带粗黑街头描边的破框磁浮列车与飞溅几何锐片 SVG，全部由浏览器原生排版引擎精确对齐。
  - **WebGL2 层负责「破框冲击波 RGB 色散、Unreal 级霓虹辉光与放射速度线」**：片元着色器通过 `gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, domScene)` 实时采样 DOM 纹理，以画框破裂点 `(u_impactPos)` 为中心激发径向冲击波 RGB 色差分离（Chromatic Aberration Shockwave）、高饱和荧光黄/电光青 9-tap 霓虹辉光，以及右上角斜切分镜专属的高频 CRT 扫描线与水平故障错位。

---

## 2. 视觉主体材质与构图映射 (`Visual Subject Mapping`)

本风格不绑定任何固定角色，任意高速运动主体（磁浮列车、超跑、机甲、滑板运动或潮流产品）接入本风格时，遵循以下三层映射规范：

| 视觉层级 | 配色与描边契约 | 任意视觉主体的转译法则 |
| :-- | :-- | :-- |
| **1. 街头喷漆破框层 (`#graffiti-frame-group`)** | 街头紫 `#8A3CFF` + 荧光黄 `#E6FF1F` + 粗黑底边 `#0B0B14` | 画框居中偏左，左上角点缀街头涂鸦皇冠与底部油漆滴落；**右下方框角必须呈炸裂开口状**，伴随飞溅的三角形/四边形破框锐片 (`#shattered-shards-group`)。 |
| **2. 2D→3D 破框主体层 (`#maglev-train-group`)** | 海报白 `#F4F4EE` + 电光青 `#00E5FF` + 深紫暗面 `#3B2878` + `4px` 粗黑轮廓线 | 主体后半段位于涂鸦框内部，采用 **2 阶扁平海报平涂**；主体前段（如车头/机甲前臂）直接冲出右下破框口，切换为 **3 阶硬切面低多边形透视体块**，形成强烈的破壁跃出感。 |
| **3. 斜切漫画 Cut-In 与 HUD 层 (`#blade-cutin-panel`)** | `-14°` 斜切框 + 半调网点底纹 + 青/黄/品红霓虹边框 | 画面右上角横贯一道斜切漫画特写条，用于展示主体的**局部高光特写**（如凌厉刀锋光束、引擎核心、仪表锁定）与实时遥测数据。 |

---

## 3. 核心技术实现

### 3.1 严格五色赛璐璐调色盘与声明式斜切排版 (`index.html`)
- **五色高对比基调**：深渊黑 `#0B0B14`、海报白 `#F4F4EE`、街头紫 `#8A3CFF`、荧光黄 `#E6FF1F`、电光青 `#00E5FF`（搭配深蓝三阶赛璐璐夜空 `#0D1956 / #08113C / #050A26` 与霓虹摩天楼剪影）。
- **解析弹簧驱动破框冲击**：`window.render(t)` 通过 `springStep` 驱动列车前冲与高频轨道震颤、破框锐片向外飞散、斜切 Cut-In 分镜面板滑入以及马赫数遥测读数跳动。

### 3.2 WebGL2 破框冲击波色散与速度线着色器 (`FRAG_SOURCE`)
- **径向冲击波色差 (`u_impactPos`, `u_shockwave`)**：从破框焦点向外发射周期性扩散波环，沿径向对 R 与 B 通道施加对称 UV 偏移，强化车头撞碎画框的物理冲击感。
- **极坐标放射速度线**：在破框外围区域叠加 `pow(max(0.0, sin(angle * 42.0 + u_time * 8.0)), 10.0)` 扇形电光青速度线。

---

## 4. 时间轴与分镜锚点 (`stills: 0.5, 1.5, 2.5, 3.5`)

- `0.5s`：深蓝赛博夜空与紫黄喷漆涂鸦画框亮起，竖排「下一站·未来」霓虹灯箱闪烁，右上斜切分镜面板切入。
- `1.5s`：磁浮列车车头冲破涂鸦画框右下角完成 2D→3D 维度跃迁，破框锐片与荧光黄速度楔形块向外迸发。
- `2.5s`：径向冲击波色散环扫过车头，右上角斜切 Cut-In 面板触发高频扫描线与微故障闪烁，马赫数攀升。
- `3.5s`：列车前冲姿态、飞散锐片与放射速度线定格于最高张力瞬间，形成完整的潮流破框海报。

---

## 5. 快速复用与渲染命令

```bash
# 生成 2x2 分镜预览图与 MP4 成片（输出写到仓库外的工作目录）
node tools/render.mjs --page showcase/fusion/cyber-graffiti-cutin \
  --stills 0.5,1.5,2.5,3.5 \
  --sheet <work-dir>/cyber-graffiti-cutin_contact_sheet.jpg \
  --video <work-dir>/cyber-graffiti-cutin.mp4
```

### 复用与改装要点
1. **改装为高燃预告片、机甲/汽车发布或电竞战报**：直接替换 `fusion/cyber-graffiti-cutin/index.html` 中竖排霓虹灯箱、右上斜切 Cut-In 面板与右下遥测卡片的文案，并将中央破框 SVG 替换为目标载具或主视觉图形。
2. **调节故障与冲击波强度**：修改着色器 uniform `u_shockwave` 与 `u_impactPos`，即可将冲击波焦点对准画面中任意破框部位。
3. **跨栈联动**：如需 Python / PyCairo 双遍描边 3D→2D 顶点插值渲染器，见 [`styles/style_03_cyber.py`](../../styles/style_03_cyber.py)；如需带画廊吉祥物导览的 24 秒 3D 磁浮列车跑酷样片，见 [`worlds/world_03_cyber/`](../../worlds/world_03_cyber/)。

## 相关文件

- [`fusion/cyber-graffiti-cutin/index.html`](../../fusion/cyber-graffiti-cutin/index.html)
- [`fusion/cyber-graffiti-cutin/contact_sheet.jpg`](../../fusion/cyber-graffiti-cutin/contact_sheet.jpg)
- [`skills/world-03-cyber/SKILL.md`](../world-03-cyber/SKILL.md)
- [`styles/style_03_cyber.py`](../../styles/style_03_cyber.py)
- [`fusion/dom_shader.js`](../../fusion/dom_shader.js)
