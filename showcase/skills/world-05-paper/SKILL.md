---
name: world-05-paper
description: 纸雕立体书山谷画风与折纸手工媒介管线（双页立体书外框 + 6 层模切白边卡纸群山 + 4 层同心暖金纸雕日轮 + 3D 几何三角折面千纸鹤 + 180° 净空大翻页 + 八角折纸走马灯亭）；支持 styles/style_05_paper.py 去固有化纯画风复用与 worlds/world_05_paper 基准剧场管线。
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

# World 05 · 纸雕立体书与几何折纸媒介 (`style_05_paper` / `world_05_paper`)

- **画廊纯风格复用入口 (Content-Agnostic Style Entry)**：[`styles/style_05_paper.py`](../../styles/style_05_paper.py) — 调用 `render_keyframe()`、`render_world(cam_x, cam_y, t, state=None)` 或 `draw_origami_crane()` 可脱离特定角色，直接生成 1920×1080 纸雕立体书山谷代表作单帧与 7680×1080 四屏长卷（含胡桃木桌面立体书外框、四层同心暖金纸雕日轮、多层模切白边群山、红金峡谷纸灯笼、折纸千纸鹤编队与八角走马灯亭）。
- **HTML-in-Canvas × WebGL2 融合画廊入口**：[`skills/inkwash-paper-scroll/SKILL.md`](../inkwash-paper-scroll/SKILL.md)（[`fusion/inkwash-paper-scroll/`](../../fusion/inkwash-paper-scroll/)）— 将宋代水墨长卷与本关的多层模切立体书合璧的去固有化双联古籍画廊模板。
- **基准剧场样片入口 (Benchmark Theatre Entry)**：[`worlds/world_05_paper/`](../../worlds/world_05_paper/) — 使用画廊材质试金石演练 30.0s / 900f 立体书开合、乘鹤穿谷与 180° 净空翻页（[`split/render_stage.html`](../../worlds/world_05_paper/split/render_stage.html) + [`build_world_05.py`](../../worlds/world_05_paper/build_world_05.py) + [`contact_sheet_05.png`](../../worlds/world_05_paper/contact_sheet_05.png)）。

---

## 1. 视觉主体材质与构图映射 (`Visual Subject Mapping`)

本风格遵循**去固有化内容原则**。当将任意用户主体（自然山川、古建亭台、飞鸟瑞兽、产品包装或几何徽标）接入本风格时，遵循以下两类手工纸艺转译法则：

| 纸艺类别 | 几何与光影契约 | 任意主体的纸雕/折纸转译法则 |
| :-- | :-- | :-- |
| **1. 层叠模切卡纸 (Layered Die-Cut Cardstock)** | 3～6 层平行或斜切曲线卡纸 + `1.8px` 奶油白模切刀口边 (`#FCF7ED`) + 层间高斯投影 (`create_blurred_drop_shadow`) | 适用于山峦、云海、日轮、建筑剪影与圆润主体：将主体沿景深或对角线拆分为多层独立色卡（如琥珀金 → 赤陶红 → 绛紫 → 深梅紫；或天青 → 蔚蓝 → 鸢尾紫 → 珊瑚粉），每层边缘强制保留亮白纸张切口厚度线，并向下一层投射柔和阴影。 |
| **2. 3D 几何折纸 (Origami Polyhedral Facets)** | 硬朗三角形平面切面 + 向阳面暖白高光 / 背光面暖灰暗部 + `1.5px` 纯白折痕脊线 | 适用于飞鸟（千纸鹤）、走马灯亭、星芒与立体道具：严禁使用平滑曲面过渡，全部体积由硬边三角形折面拼合（如千纸鹤 55° 仰颈、菱形胸腔与高扬三角翼），主折痕处描绘清晰白线。 |
| **3. 立体书舞台外框 (Pop-Up Book Stage)** | 胡桃木桌面暗角 + 勃艮第红烫金精装书壳 + 书脊 V 型峡谷中缝 + 折纸支撑卡榫 (`Support Tabs`) | 画面四周保留精装立体书摊开的透视页边与纸页厚度叠层，中央垂直书脊折痕贯穿上下，赋予强烈的实物手作书本摄影感。 |

---

## 2. 核心实现与工程复用要点

- **独立画风层 (`styles/style_05_paper.py`)**：
  - `get_paper_noise_texture` + `create_blurred_drop_shadow`：棉浆卡纸颗粒缓存与真实层间偏移高斯投影。
  - `draw_origami_crane(ctx, cx, cy, scale, tilt, wing_flap, color_scheme)`：经典 3D 几何折纸千纸鹤绘制器（支持象牙金 `"white"`、樱花粉 `"pink"`、天青蓝 `"blue"` 三种纸张配色与拍翼相位）。
  - `draw_star`：8 折面烫金珠宝折纸四角星芒 `✦`，带奶油白模切底板。
- **3D 叙事舞台层 (`worlds/world_05_paper/split/`)**：
  - `createPopUpBookStage`：双页立体书基地 + `flipPagePivot` 180° 翻页旋转轴 + `setFoldState` 折纸联动（翻页过程中旧山谷平折收起、背面新世界同步立起，零穿模）。
  - `createOrigamiCrane`、`createLanternStarToken`、`createZoetropePavilion`（八角旋转走马灯亭）。
  - 节奏锚点：`0–4.2s` 6 层群山立起与 6 盏灯笼（4 金 2 红）点亮 → `4.2–7.8s` 书脊崖边千纸鹤接驾 → `7.8–14.8s` 乘鹤穿云谷 → `15.8s` 180° 白色大翻页（`16.5s` 新页完全展开）→ `21.6–22.4s` 鞠躬致意 → `25.5–27.0s` 桥面灯笼星徽 → `27.0–30.0s` 走马灯亭收尾。
- **工程避坑指南**：
  1. 绘制折纸千纸鹤时，双翼三角形切面必须向斜上方高扬展开，严禁画成向下耷拉的垂翼或分叉兔耳。
  2. 立体书多层卡纸叠加时，务必开启层间投影与白色模切描边，否则同色系山峦会糊成一片平面色块。

## 相关文件

- [`../../styles/style_05_paper.py`](../../styles/style_05_paper.py)
- [`../inkwash-paper-scroll/SKILL.md`](../inkwash-paper-scroll/SKILL.md)
- [`STORY.md`](../../worlds/world_05_paper/STORY.md)
- [`build_world_05.py`](../../worlds/world_05_paper/build_world_05.py)
- [`split/render_stage.html`](../../worlds/world_05_paper/split/render_stage.html)
- [`split/06_story_choreography.js`](../../worlds/world_05_paper/split/06_story_choreography.js)
- [`split/03_paper_assets_factory.js`](../../worlds/world_05_paper/split/03_paper_assets_factory.js)
- [`audio_05_paper.py`](../../worlds/world_05_paper/audio_05_paper.py)
- [`contact_sheet_05.png`](../../worlds/world_05_paper/contact_sheet_05.png)
