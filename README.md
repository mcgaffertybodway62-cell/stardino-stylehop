# StarDino StyleHop · HTML-in-Canvas × Three.js × WebGL2 多场景风格工作台

> **一风格一多场景样片（Multi-Scene Style Showreel）× 浏览器原生富排版（HTML-in-Canvas）× Three.js 三维舞台 × WebGL2 实时光学合成。**  
> 工具链与工程流程标准化，场景内容随风格媒介专有化定制。  
> Created by **Star Dinosaur (星星恐龙)** · MIT

![clay-macaron 多场景样片示例](styles/clay-macaron/contact_sheet.jpg)

---

## 核心架构与工具链特性

`StyleHop` 基于 Blink 原生特性 **`HTML-in-Canvas` (`CanvasDrawElement`)** 与 **Three.js / WebGL2** 构建了一套从多场景编排、3D 舞台合成、程序化质感/声学生成、交互调参到自动化门禁的完整工程体系：

| 核心模块 | 工程能力说明 |
| :-- | :-- |
| **多场景时间轴与去固化内容架构 (`[data-scene]`)** | 每个风格（`styles/<id>/`）由 3–5 个分镜组成。框架只提供标准化时间轴与合成工具链，**不绑定任何固定内容模板**——动画类风格可全屏运行多机位 3D/2D 镜头演出，版式类风格可编排图文海报，手稿类风格可推演图解。 |
| **Three.js 3D 世界与 HTML-in-Canvas 混合舞台 (`engine/stage.js` + `three_bridge.js`)** | 内置离线 `engine/vendor/three.min.js`，支持在 `styles/<id>/world.js` 中用参数化代码构建 3D 场景、软体/刚体物理与相机运镜，并与 `<canvas layoutsubtree>` 的透明 DOM 图层、独立 3D 浮层（`[data-layer]`）或 3D 表面活体贴图（`createDomTexture`）零延迟同台合成。 |
| **可组合 WebGL2 材质与光学 Pass 链 (`engine/passes/`)** | 内置 `lens`（斯涅尔色散透镜）、`clay`（软陶指纹浮雕与移轴景深）、`riso`（孔版双滚筒网点）、`spotlight`（双锥聚光灯）、`inkbleed`（宣纸毛细洇墨）、`crt`（阴极射线荧光）、`grain`（表面肌理与暗角）等可插拔着色器。 |
| **DOM 原生自动化体检门禁 (`tools/audit.mjs`)** | 在无头 Chrome 151 中默认同时遍历 16:9 与 9:16 双画幅下的全部场景，自动拦截运行时报错、文字越界/裁切、过小字号（`<12px`）、文案停留时长不足与浮层恶意遮挡。 |
| **交互式 Studio 调试工作台 (`gallery/`)** | 支持分镜单跳/循环锁定、逐帧时间轴 Scrubbing、声学事件轨预览、DOM 版面体检框实时叠加（Audit Overlay）、画布原位点击改字（`contenteditable`）与 Shader Uniform 滑杆调参。 |
| **程序化物理贴图与画面驱动声学 (`tools/textures.py` + `tools/sound.py`)** | `textures.py` 生成宣纸纤维、软陶拇指指纹、半调网屏、拉丝金属、晒图折痕等 512×512 无缝贴图（`u_paper`）；`motion.js` 自动提取 `window.CUES` 时间码，驱动 `sound.py` 合成 48kHz 立体声拟音，由 `render.mjs` 归一至 `-14 LUFS` 母带。 |

---

## 快速开始

```bash
npm install                      # 仅依赖 playwright-core
# 需要 Chrome 151+；可通过 CHROME_BIN 或 PLAYWRIGHT_CHROME 指定可执行文件路径

# 1. 启动 StyleHop Studio 交互式调试工作台
npm run serve                    # 打开 http://127.0.0.1:8080/gallery/
                                 # 手动启动 Chrome 时请附带 --enable-blink-features=CanvasDrawElement

# 2. 执行自动化体检门禁（默认同时检验 16:9 与 9:16 双画幅）
node tools/audit.mjs --style <style-id>

# 3. 确定性并发渲染：生成 2x2 多场景检视表与带 -14 LUFS 音效的 MP4 母带
node tools/render.mjs --style <style-id> --sheet styles/<style-id>/contact_sheet.jpg
node tools/render.mjs --style <style-id> --video <work-dir>/<style-id>/<product-slug>-v1/<product-slug>.mp4 --fps 30

# 4. 素材管线：生成无缝物理质感贴图 / 合成声学音轨
python3 tools/textures.py
python3 tools/sound.py --preset glass --out <work-dir>/demo.wav
```

在不支持 `CanvasDrawElement` 的普通浏览器中，舞台会自动优雅降级为 DOM + 3D/Canvas 视图，页面不会白屏。

---

## 仓库目录结构

```text
engine/            核心引擎：
                   - stage.js（3D/Canvas 世界基底 + 多场景 [data-scene] + 浮层 [data-layer] + u_paper + Pass 链）
                   - motion.js（闭式弹簧动效 + 多分镜时间轴 + window.CUES 声学事件提取）
                   - three_bridge.js（Three.js 与 HTML-in-Canvas 活体 DOM 贴图桥接）
                   - vendor/three.min.js（内置离线 Three.js 引擎，零外网 CDN 依赖）
                   - passes/（可组合 WebGL2 光学与材质着色器：lens, clay, riso, spotlight, inkbleed, crt, grain）
                   - base.css（基础排版与透明舞台覆盖层契约）
                   - components/（可选组件，默认不加载：data.css 提供公式与数据表，按需在 theme.css 中引入）
tools/             风格工程工具链：
                   - textures.py（程序化 512x512 无缝物理质感贴图生成器 → assets/textures/）
                   - sound.py（基于 window.CUES 的多预设声学拟音与配乐合成器 → 48kHz WAV）
                   - audit.mjs（自动化体检门禁：零报错、文字越界/裁切、最小字号、阅读时长、浮层遮挡检测）
                   - render.mjs（多 Worker 并发分片无头渲染 + 自动音效合成与 -14 LUFS 母带混流 → contact_sheet.jpg / MP4）
assets/textures/   物理质感贴图库（paper_fiber.png, clay_thumbprint.png, halftone_screen.png, brushed_metal.png, blueprint_cyanotype.png）
gallery/           StyleHop Studio 交互式调试工作台（index.html, player.html, catalog.js）
styles/            多场景风格目录：
                   - _template/（去固化内容的标准风格脚手架：SPEC.md + theme.css + style.js + scenes.html）
                   - clay-macaron/（3D 软陶定格 · kernel.js 介质 + world.js 示例故事 + 角色 / 布景零件）
showcase/          宣发物料与历史归档（画廊吉祥物「星芒史莱姆」九界短片等，与 styles/ 完全解耦）
```

---

## 吉祥物「星芒史莱姆」与去固有化原则

星芒史莱姆（Star-Spark Slime）是 StyleHop 的画廊宣传吉祥物，**仅出现在宣发物料与 [`showcase/`](showcase/README.md) 历史短片归档中，绝不进入任何 `styles/` 风格定义与制作流程**。

![World 09 · Blueprint](showcase/worlds/world_09_blueprint/contact_sheet_09.png)

---

## 致谢与许可

MIT，详见 [`LICENSE`](LICENSE)。第三方组件与字体许可声明见 [`CREDITS.md`](CREDITS.md) 与 [`LICENSE-THIRD-PARTY`](LICENSE-THIRD-PARTY)。
