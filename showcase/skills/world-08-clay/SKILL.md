---
name: world-08-clay
description: 移轴微缩粘土书桌画风与定格软陶媒介管线（手工捏塑软陶指纹涡旋肌理 + 铜丝/竹签盘绕粘土树云 + 倾倒赤陶杯 S 形焦糖拿铁小溪 + 多米诺骨牌五连倒搭桥 + 马卡龙三连弹簧蹦床 + 移轴浅景深遮罩）；支持 styles/style_08_clay.py 去固有化纯画风复用与 worlds/world_08_clay 基准剧场管线。
version: 1.0.0
category: procedural-medium
stack:
  - python
  - pycairo
  - threejs
  - playwright
  - pillow
  - audio-dsp
---

# World 08 · 移轴微缩书桌与定格软陶粘土媒介 (`style_08_clay` / `world_08_clay`)

- **画廊纯风格复用入口 (Content-Agnostic Style Entry)**：[`styles/style_08_clay.py`](../../styles/style_08_clay.py) — 调用 `render_keyframe()`、`render_world(cam_x, cam_y, t, state=None)` 或 `draw_clay_tabletop_and_backdrop()` / `draw_s_curve_caramel_latte_stream_and_mug()` 可脱离特定角色，直接生成 1920×1080 阳光移轴微缩粘土手工书桌单帧与 7680×1080 长卷（含粉彩波浪粘土山丘、铜丝/竹签支起的手搓螺旋粘土树云、倾倒赤陶马克杯、S 形焦糖奶油拿铁小溪、多米诺骨牌桥、法式马卡龙与多肉盆栽）。
- **基准剧场样片入口 (Benchmark Theatre Entry)**：[`worlds/world_08_clay/`](../../worlds/world_08_clay/) — 使用画廊材质试金石演练 15.0s / 450f 多米诺骨牌连锁搭桥、马卡龙弹簧蹦床与木琴拨弦配乐（[`split/render_stage.html`](../../worlds/world_08_clay/split/render_stage.html) + [`build_world_08.py`](../../worlds/world_08_clay/build_world_08.py) + [`contact_sheet_08.png`](../../worlds/world_08_clay/contact_sheet_08.png)）。

---

## 1. 视觉主体材质与构图映射 (`Visual Subject Mapping`)

本风格遵循**去固有化内容原则**。当将任意用户主体（文具器物、甜点美食、微缩建筑、自然植物或定格动画模型）放入本风格时，遵循以下阿德曼（Aardman）/ 定格软陶（Polymer Claymation）转译法则：

| 视觉要素 | 材质表面与光学契约 | 任意主体的软陶粘土转译法则 |
| :-- | :-- | :-- |
| **1. 手工捏塑软陶与指纹涡旋 (`Thumbprint Whorls`)** | 哑光次表面散射漫反射 + 大理石揉捏色带 (`Marbled Seams`) + 同心椭圆指纹凹槽与塑形工具压痕 (`Dimples`) | 严禁出现锋利的几何直角或镜面金属高光！所有物体边缘必须倒大圆角，表面叠加暖桃色桌面漫反射光（Bounce Light）、揉面未完全混匀的流线色带，以及 2～3 组由明暗双弧线构成的雕塑师拇指指纹涡旋。 |
| **2. 手作微缩支架外露 (`Exposed Stop-Motion Armatures`)** | 扭结黄铜丝 (`#C7995C`) + 原木竹签 (`#D1B284`) + 厚泥片层叠山丘 | 背景云朵、树冠或悬浮星标不凭空漂浮，而是显式插在扭结黄铜丝或木质牙签支架上；树冠与云朵由一圈圈手搓粘土泥条盘绕（Coiled Clay Ropes）而成。 |
| **3. 移轴微缩景深与流体拉花 (`Tilt-Shift & Epoxy Stream`)** | 上下渐晕移轴模糊遮罩 + 焦糖拿铁双色拉花漩涡 | 桌面流体（如倾倒的咖啡/热可可）塑造为具有厚度的 S 形奶油焦糖色粘土带，表面绘制浓缩咖啡深棕与奶泡白交织的拉花纹理；镜头上下边缘施加移轴微缩虚化。 |

---

## 2. 核心实现与工程复用要点

- **独立画风层 (`styles/style_08_clay.py`)**：
  - `make_clay_noise`：生成全画幅微米级软陶颗粒凹凸场。
  - `draw_clay_tabletop_and_backdrop`：阳光手作桌面、三层粉彩粘土波浪山丘（薰衣草紫、鼠尾草薄荷绿、杏桃粉）与铜丝/牙签粘土树云。
  - `draw_s_curve_caramel_latte_stream_and_mug`：Catmull-Rom 样条驱动的 S 形焦糖奶油拿铁小溪与倾倒赤陶马克杯。
  - `draw_star`：带黄铜定格支架与中心拇指指纹印的手捏软陶四角星 `✦`。
- **3D 叙事舞台层 (`worlds/world_08_clay/split/`)**：
  - `01_constants_and_materials.js`：程序化指纹凹凸贴图（Bump Map）与移轴景深遮罩。
  - `05_props_trumpet_mug_domino_macaron.js`：黄铜小喇叭、倾倒咖啡杯、五连多米诺骨牌、三色马卡龙弹簧蹦床。
  - `07_surface_heightfield_and_flight_engine.js`：`getAnalyticalSurfaceY(x, t)` 解析连续高度场，确保任何滚动或跳跃物体在骨牌桥、马卡龙与木尺斜坡上 100% 零穿模。
  - 节奏锚点：`0–2.4s` 小喇叭口 Iris-In 滚落桌面 → `2.4–4.5s` 咖啡溪受阻 → `4.5–7.5s` 五枚多米诺骨牌连锁倾倒合拢成桥（`6.0s`）→ `7.5–11.2s` 三座马卡龙蹦床连续弹跃（`9.35s` 腾空）→ `11.2–13.6s` 沿木尺斜坡登精装书顶平台 → `13.6–15.0s` 万花筒折光切入普鲁士蓝工程网格（`14.9s`）。

## 相关文件

- [`../../styles/style_08_clay.py`](../../styles/style_08_clay.py)
- [`STORY.md`](../../worlds/world_08_clay/STORY.md)
- [`build_world_08.py`](../../worlds/world_08_clay/build_world_08.py)
- [`split/render_stage.html`](../../worlds/world_08_clay/split/render_stage.html)
- [`split/08_storyboard_timeline_director.js`](../../worlds/world_08_clay/split/08_storyboard_timeline_director.js)
- [`split/05_props_trumpet_mug_domino_macaron.js`](../../worlds/world_08_clay/split/05_props_trumpet_mug_domino_macaron.js)
- [`split/07_surface_heightfield_and_flight_engine.js`](../../worlds/world_08_clay/split/07_surface_heightfield_and_flight_engine.js)
- [`audio_08_clay.py`](../../worlds/world_08_clay/audio_08_clay.py)
- [`contact_sheet_08.png`](../../worlds/world_08_clay/contact_sheet_08.png)
