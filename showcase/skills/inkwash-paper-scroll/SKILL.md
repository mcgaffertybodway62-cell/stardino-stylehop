---
name: inkwash-paper-scroll
description: StyleHop × HTML-in-Canvas 旗舰融合画风：水墨宣纸千里长卷 × 纸雕立体书山谷（中日韩 vertical-rl 竖排书法题跋 + 朱砂藏书方印 + 留白断桥/悬空毛笔/朱砂双鲤/白描墨荷 + 四层同心暖金纸雕日轮/六层模切群山/折纸千纸鹤 × WebGL2 生宣纸纤维渗化与立体书脊折痕光影着色器）。完全去固有化主体，适合国风文化叙事、诗词典籍展陈、非遗工艺与东方美学视觉包装。
version: 1.0.0
category: stylehop-fusion
stack:
  - html-in-canvas
  - webgl2
  - cjk-vertical
  - svg
  - paper-ink-shader
---

# Gallery A3 (StyleHop Fusion) · 水墨宣纸长卷 × 纸雕立体书 (`inkwash-paper-scroll`)

- **画廊复用入口 (`fusion/`)**：[`fusion/inkwash-paper-scroll/index.html`](../../fusion/inkwash-paper-scroll/index.html)
- **底层渲染引擎**：[`fusion/dom_shader.js`](../../fusion/dom_shader.js)（`corelib/html_canvas/render.mjs` 未随仓库分发）
- **分镜预览图**：[`fusion/inkwash-paper-scroll/contact_sheet.jpg`](../../fusion/inkwash-paper-scroll/contact_sheet.jpg)
- **关联九界画风与剧场 (`Series B`)**：
  - [`world-04-inkwash`](../world-04-inkwash/SKILL.md) · [`styles/style_04_inkwash.py`](../../styles/style_04_inkwash.py) · [`worlds/world_04_inkwash/`](../../worlds/world_04_inkwash/)
  - [`world-05-paper`](../world-05-paper/SKILL.md) · [`styles/style_05_paper.py`](../../styles/style_05_paper.py) · [`worlds/world_05_paper/`](../../worlds/world_05_paper/)
- **成片规格**：4.0s / 96f–120f（1920×1080）；Chrome 157+ `<canvas content="drawable">` + WebGL2 宣纸水墨晕染与立体书折纸浮雕着色器。

---

## 1. 视觉定位与为什么用 `HTML-in-Canvas × WebGL2`

- **定位**：将九界第 04 界 **「宋代水墨宣纸千里长卷」** 与第 05 界 **「纸雕立体书山谷」** 跨界合璧的东方纸本美学旗舰风格，采用**去固有化主体原则（Content-Agnostic）**，在一本于胡桃木桌面上摊开的双联古籍立体书中，展现「左页写意水墨山水 ↔ 右页模切纸雕山谷」的纸艺奇观。
- **为什么用 `HTML-in-Canvas`**：
  - **DOM 层负责「纯正中式竖排题跋、朱砂印谱与双纸本矢量构图」**：利用浏览器原生 `writing-mode: vertical-rl; text-orientation: upright;` 排版宋明画卷引首题识、句读朱砂点 (`・`) 与阳文朱砂方印（`#cinnabar-seal-box`），完全无需手算竖排字距；同时在双联古籍 SVG 中精细绘制左页的远山淡墨、潇湘翠竹、留白石拱桥、悬空毛笔、朱砂双鲤、泥金墨荷，以及右页的四层同心暖金纸雕日轮、五重模切卡纸群山、八角走马灯亭、六盏红金纸灯笼与三只 3D 几何折纸千纸鹤。
  - **WebGL2 层负责「生宣纸帘纹纤维、水波微扰、书脊折痕阴影与日轮柔光」**：片元着色器通过 `gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, domScene)` 实时捕获 DOM 画面，在左页叠加生宣纸帘纹纤维与荷塘水波微位移，在书脊中缝 `x = 960` 处渲染真实的 3D 凹陷折痕阴影与受光脊线，并围绕暖金纸雕日轮与四角折纸星徽施加温润的径向漫射光晕。

---

## 2. 视觉主体材质与构图映射 (`Visual Subject Mapping`)

本风格不绑定任何固定角色，任意东方美学主体（楼阁建筑、山水舟楫、瑞兽飞鸟、器物文物或诗词意境）接入本风格时，遵循以下双页纸本映射规范：

| 书页分区 | 纸本材质与色板 | 任意视觉主体的转译法则 |
| :-- | :-- | :-- |
| **左联：宋代水墨宣纸页 (`x < 960`)** | 仿古生宣纸 (`#F2EDE2 → #DDD3C0`) + 墨分五色 + 花青 `#2E6B9E` + 朱砂 `#C83228` | 主体采用**「计白当黑 + 枯笔飞白 + 局部设色」**：山石远景用半透明水墨渐变，近景主体（如拱桥、扁舟、荷叶）辅以洒金叶脉与一抹高饱和朱砂点睛（如朱砂游鲤、朱砂印章），左上留白处配竖排题跋。 |
| **中缝：书脊跨界枢纽 (`x = 960`)** | 四层同心暖金模切日轮 (`#EBB057 → #FFF8D6`) + 折纸支撑卡榫 | 跨页核心视觉母题（如日轮、明月、主峰或飞鹤）横跨 `x = 960` 书脊中缝，左半受宣纸墨韵浸染，右半呈立体模切层叠。 |
| **右联：模切纸雕立体书页 (`x > 960`)** | 暮光紫卡纸夜空 (`#3F1E66`) + 琥珀/赤陶/绛紫五层群山 + `#FCEFD9` 模切白边 | 主体拆解为 **3～5 层平行景深卡纸切片** 或 **三角折面折纸结构（Origami Facets）**，每一层边缘强制勾勒 `1.5px ~ 2.2px` 象牙白模切刀口线，层与层之间拉开明度对比并点缀暖光灯笼。 |

---

## 3. 核心技术实现

### 3.1 原生竖排书法题跋与双联立体书舞台 (`index.html`)
- **竖排题识与朱砂印章**：`#ink-colophon` 使用 `writing-mode: vertical-rl` 与衬线宋体排印诗词题跋，搭配 `#cinnabar-seal-box` 双排田字格阳文篆印与同心朱砂声波纹。
- **确定性时间轴演化**：`window.render(t)` 通过 `smootherstep` 与 `springStep` 同步驱动悬空毛笔挥毫补全桥面笔画 (`stroke-dasharray`)、双鲤游弋、墨荷摇曳、走马灯亭内芯旋转、六盏纸灯笼随风轻摆以及三只折纸千纸鹤展翅升降。

### 3.2 WebGL2 宣纸纤维、水波微扰与书脊光影着色器 (`FRAG_SOURCE`)
- **双材质纸张纹理合成**：对 `px.x < 960.0`（左页生宣纸）施加较高强度的横纵向交织植物纤维噪点（`grainStrength = 0.042`），对 `px.x >= 960.0`（右页重磅卡纸）施加细腻卡纸纹理（`grainStrength = 0.028`）。
- **书脊 3D 折痕 (`dSpine = px.x - 960.0`)**：通过高斯衰减项 `exp(-pow(dSpine / 22.0, 2.0))` 模拟双页古籍在中心装订线处的自然立体折痕与右侧翻页高光。

---

## 4. 时间轴与分镜锚点 (`stills: 0.5, 1.5, 2.5, 3.5`)

- `0.5s`：双联立体书于深色木桌上展开，左页竖排题跋与朱砂方印亮起，悬空毛笔自断桥左端起笔。
- `1.5s`：毛笔挥毫向右延伸朱墨桥拱，荷塘中朱砂双鲤绕白描墨荷游动，右页同心金日轮逐层舒展。
- `2.5s`：书脊中缝立体折纸卡榫托起象牙金主鹤与粉/蓝护航千纸鹤，右页六盏红金灯笼与八角走马灯亭流光溢彩。
- `3.5s`：左页千里水墨桥道与右页立体纸雕山谷在书脊金日轮下完全贯通，定格为典雅的东方纸艺长卷。

---

## 5. 快速复用与渲染命令

```bash
# 生成 2x2 分镜预览图与 MP4 成片（输出写到仓库外的工作目录）
node tools/render.mjs --page showcase/fusion/inkwash-paper-scroll \
  --stills 0.5,1.5,2.5,3.5 \
  --sheet <work-dir>/inkwash-paper-scroll_contact_sheet.jpg \
  --video <work-dir>/inkwash-paper-scroll.mp4
```

### 复用与改装要点
1. **替换诗词题跋、印章与画面主题**：直接修改 `fusion/inkwash-paper-scroll/index.html` 中 `#ink-colophon` 的竖排诗文与 `#cinnabar-seal-box` 的四字印文，浏览器自动处理竖排标点对齐。
2. **独立使用水墨或纸雕半幅**：只需将 `#leftSpreadClip` 或 `#rightSpreadClip` 扩展至全幅 `1920×1080`，即可单独作为纯正宋代水墨画卷或全屏立体书绘本模板使用。
3. **跨栈联动**：如需 Python / PyCairo 四屏水墨长卷与纸雕画风渲染器，见 [`styles/style_04_inkwash.py`](../../styles/style_04_inkwash.py) 与 [`styles/style_05_paper.py`](../../styles/style_05_paper.py)；如需带画廊吉祥物导览的完整叙事样片，见 [`worlds/world_04_inkwash/`](../../worlds/world_04_inkwash/) 与 [`worlds/world_05_paper/`](../../worlds/world_05_paper/)。

## 相关文件

- [`fusion/inkwash-paper-scroll/index.html`](../../fusion/inkwash-paper-scroll/index.html)
- [`fusion/inkwash-paper-scroll/contact_sheet.jpg`](../../fusion/inkwash-paper-scroll/contact_sheet.jpg)
- [`skills/world-04-inkwash/SKILL.md`](../world-04-inkwash/SKILL.md)
- [`skills/world-05-paper/SKILL.md`](../world-05-paper/SKILL.md)
- [`styles/style_04_inkwash.py`](../../styles/style_04_inkwash.py)
- [`styles/style_05_paper.py`](../../styles/style_05_paper.py)
- [`fusion/dom_shader.js`](../../fusion/dom_shader.js)
