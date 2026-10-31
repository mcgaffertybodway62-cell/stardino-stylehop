# StarDino StyleHop 架构核实与系统性修复报告（2026-10-31）

本文档记录对 StarDino StyleHop 工程管线、通用骨骼层、风格内核（`styles/*/kernel.js`）、默认样片（`styles/*/world.js`）以及展示级世界（`showcase/worlds/`）的全面代码核实结论、跨风格横向排查矩阵，以及逐项工程修复方案。

---

## 一、六大核心问题逐项代码核实（Verified Findings）

### 1. 静态抽帧体检（`76%` 定格点 + `half_void` / `com_y`）倒逼画面“摆拍成四宫格动态海报”

- **核实结果**：**完全属实**。
- **代码定位**：
  - [`tools/render.mjs`（第 225–232 行）](../tools/render.mjs#L225-L232)：`pickRepresentativeStills(timeline)` 硬编码按 `const t = s.settle ?? +(s.start + s.dur * 0.76).toFixed(2)` 截取单帧合成 2×2 四宫格（`contact_sheet.jpg`）。
  - [`engine/motion.js`（第 218–219 行）](../engine/motion.js#L218-L219)：`prepareScenes()` 内部将 `localSettle` 强制夹紧在 `[dur * 0.72, dur * 0.86]` 区间，且此前未向 `scenes.html` 暴露 `data-settle` / `data-keyframe` 属性覆写接口。
  - [`tools/lookcheck.py`（第 64–87 行）](../tools/lookcheck.py#L64-L87)：`ABSOLUTE_FLOOR` 对所有分镜单帧强制执行 `half_void_max: 0.72`（上下半幅最大允许留白率）与 `com_y: (0.36, 0.66)`（明度边缘重心必须居中），此前仅 `ink-wash` 配置了 `STYLE_ABS_OVERRIDES`。
- **机理性后果**：
  1. 为了保证第 `76%` 时间点（如 4 秒镜头的第 `2.88s`）截出的静态图主体完整且重心居中，分镜内的入场、跳跃或敲击动作被迫在前 `0.8s` 内匆匆结束，剩余 `3s` 只能停在原地靠 `Math.sin(t)` 微晃摆 Pose；
  2. 为了防止上半幅（天空/桌面背景/舞台聚光区）触发 `half_void > 0.72` 报警，创作者被迫在空中塞满漂浮音符、五线谱、黑胶盘、齿轮等无关装饰，破坏了视觉焦点与留白呼吸感。

---

### 2. `styles/rubber-hose/kernel.js` 固化为“百老汇爵士贴纸包”，缺乏通用变形与物理交互原语

- **核实结果**：**完全属实**。
- **代码定位**：
  - [`styles/rubber-hose/kernel.js`（第 1895–3026 行）](../styles/rubber-hose/kernel.js#L1895-L3026)：Tier 3 组件库写死了 `drawElasticKeyboardRoad`（弯曲钢琴键道路）、`drawAnthropomorphicGramophone`（固定黄铜留声机）、`drawAnthropomorphicInstrument`（原地摇晃的 `contrabass` / `saxophone` / `microphone`；且第 168 行注释声明了 `'drumkit'`，但第 2407–2522 行实现中甚至遗漏了 `'drumkit'` 分支）、`drawNoteCritter`（仅有 `walk` / `airborne` / `squashed` 三种固定姿态的八分音符）。
  - [`styles/rubber-hose/world.js`（第 264–565 行）](../styles/rubber-hose/world.js#L264-L565)：四个分镜反复堆叠同一套琴键路、留声机与漫天音符；动作交互缺乏真实的末端接触求解（2-Bone IK），只能靠 `drawComicBurst(..., 'CLANG!' / 'POW!')` 爆炸框假装发生碰撞。

---

### 3. `engine/puppet2d.js` 与 `createRubberHoseCharacter` 角色比例过小，毫无表演可读性

- **核实结果**：**完全属实**。
- **代码定位**：
  - [`styles/rubber-hose/kernel.js`（第 3289–3300 行）](../styles/rubber-hose/kernel.js#L3289-L3300)：`RUBBER_HUMANOID_DIMS` 定义 `headR: 32, torsoRx: 29, torsoRy: 38, upperArm: 42, foreArm: 38, thigh: 44, shin: 42`。
  - [`styles/rubber-hose/kernel.js`（第 3440–3452 行）](../styles/rubber-hose/kernel.js#L3440-L3452)：肢体线宽仅 `limbWidth = 12 * scale`，眼睛半径仅 `10.5 * scale`（第 3610 行）。
- **机理性后果**：
  - 在 `1920×1080` 画布上，`scale = 1.0` 的角色总高仅约 `190 px`（不足画面高度的 `18%`），躯干仅 `29×38 px`，眼睛仅 `10.5 px`。
  - 黄金时代 1930s 橡皮管动画（Fleischer / Iwerks / 早期 Disney）的核心生命力在于**大头大眼二头身比例、占画面 40%–60% 的近景/特写面部夸张反应（Take：眼珠弹出 Eye-Pop、下巴砸地 Jaw-Drop、蓄力扭曲 Anticipation Wind-up）以及真实的双手抓取/敲击接触**。火柴人尺寸与仅有 `walk` / `wave` 的固定动作让观众无法看清角色表情与意图。

---

### 4. 全场 132 BPM 同频共振与视觉焦点过载（“当所有东西都在动，就等于没有东西在动”）

- **核实结果**：**完全属实**。
- **代码定位**：
  - [`styles/rubber-hose/kernel.js`（第 227–238 行）](../styles/rubber-hose/kernel.js#L227-L238)：`evalSwingBounce(t, bpm = 132)` 生成 `2.2 Hz` 的全场节拍弹跳；
  - 该函数被无差别注入到背景五线谱（第 1844 行）、舞台幕布（第 1924 行）、弯曲琴键路（第 2059 行）、留声机（第 2201 行）、所有乐器（第 2418 行）、音符小怪（第 2607 行）与角色（第 3399 行）。
- **机理性后果**：
  - 静物背景与前景角色以完全相同的频率上下颠簸，缺乏「静物舞台衬托动体、主次分明」的视觉锚点；
  - 四个分镜之间缺少「起因 → 蓄力（Anticipation）→ 触发接触（Impact）→ 夸张反应（Take / Follow-through）」的因果链条。

---

### 5. `styles/paper-popup/` 与 `showcase/worlds/world_05_paper/` 严重割裂，内核物理阉割、模型粗糙、假折叠与假翻页

- **核实结果**：**完全属实**。
- **代码定位**：
  1. **展示级资产与标准风格库割裂**：
     - [`showcase/worlds/world_05_paper/split/02_paper_textures.js`](../showcase/worlds/world_05_paper/split/02_paper_textures.js) 与 [`03_paper_assets_factory.js`](../showcase/worlds/world_05_paper/split/03_paper_assets_factory.js) 封装在非模块化的 `window.World04PaperAssets`（Three.js r128 全局脚本）中，包含多层浮雕卡纸、精密折纸动物（带四肢/耳朵/眼睛/白芯描边）、拱桥、风车、宝塔、折扇树等高质量程序化生成逻辑，未向 [`styles/paper-popup/kernel.js`](../styles/paper-popup/kernel.js) 同步其规则化建模能力。
  2. **物理跳跃函数被阉割为死板正弦波**：
     - [`showcase/worlds/world_05_paper/split/01_math_and_physics.js`（第 27–84 行）](../showcase/worlds/world_05_paper/split/01_math_and_physics.js#L27-L84) 的 `evalContinuousHopChain` 与 `evalTargetedJump` 原本具备完整的「起跳前蓄力下蹲（`squashY = 1 - 0.25 * crouch`）→ 腾空拉伸与俯仰角（`pitch`）→ 落地挤压缓冲（`squashY = 1 - 0.30 * impact`）」三段式物理；
     - 但在 [`styles/paper-popup/kernel.js`（第 188–206 行）](../styles/paper-popup/kernel.js#L188-L206) 中被删减为简单 `Math.sin(u * Math.PI)`，并硬编码返回 `squashY: 1.0, pitch: 0.0`。
  3. **内置折纸模型过于粗糙**：
     - [`styles/paper-popup/kernel.js`（第 2074–2134 行）](../styles/paper-popup/kernel.js#L2074-L2134) 的 `createOrigamiFox` 仅手写了 16 个三角面（无腿、无眼、无独立关节、无白芯纸边，连 `act(t)` 动画接口都未提供）；
     - `createPaperBoat`（第 1749–1829 行）仅 10 个三角面。
  4. **假折叠动画（缩放代替折痕铰链旋转）**：
     - [`styles/paper-popup/kernel.js`（第 129–139 行）](../styles/paper-popup/kernel.js#L129-L139) 的 `evalPaperFold` 将 `scaleY` 压到 `0.02`；
     - `buildPaperGround`（第 1609 行）与 `createPaperBoat`（第 1818 行）的 `setFold(f)` 只改 `scale.y` 完全未改 `rotation.x`，展开时像拉扯橡皮泥而非硬卡纸绕书页折痕做 3D 铰链立起。
  5. **前后幕局部道具未完全隔离 & 机位全程锁定远景高俯拍**：
     - [`styles/paper-popup/world.js`（第 259–299 行）](../styles/paper-popup/world.js#L259-L299) 将空中的千纸鹤与蝴蝶直接挂在全局 `scene` 上，翻页时既不随旧页折收也不随新页弹出；
     - `createPopupBookDirector`（第 306–386 行）相机在 14.8 秒内全程锁死在 `y = 7.4~9.0, z = 15.0~18.2` 的大远景俯拍，缺少推近展示折纸结构细节与角色表演的中近景/微距镜头。

---

### 6. `showcase/worlds/` 外部 CDN 依赖脆弱性与管线断层

- **核实结果**：**完全属实**。
- **代码定位**：
  - [`showcase/worlds/world_05_paper/split/index.html`（第 7–8 行）](../showcase/worlds/world_05_paper/split/index.html#L7-L8)（以及 `world_03_cyber`、`world_08_clay`、`world_09_blueprint`）直接引用了 `<script src="https://cdn.tailwindcss.com/3.4.17"></script>` 与 `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`；
  - [`showcase/worlds/world_05_paper/split/style.css`](../showcase/worlds/world_05_paper/split/style.css) 未对 `.hidden`、`.flex`、`.fixed`、`.inset-0` 等 Tailwind 布局与隐藏类做本地 CSS 兜底，离线或沙盒断网时 Three.js 无法启动且隐藏弹窗全部裸露堆叠。

---

## 二、全风格横向排查矩阵（Cross-Style Audit Matrix）

对 [`gallery/catalog.js`](../gallery/catalog.js) 注册的全部 6 个风格进行同类问题排查：

| 风格 ID | 轨道类型 | 内核原语化程度（ADR-013） | 角色/生灵可读性与关节接触 | 镜头景别跨度与叙事因果 | 静态门禁适配度 | 待修复重点 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`rubber-hose`** | 2D 卡通剧场 | ❌ 固化百老汇爵士贴纸包，缺 `'drumkit'` 与通用道具/室内外舞台原语 | ❌ `29×38px` 躯干、`10.5px` 眼睛，无特写夸张表情（Take）与 IK 抓取接触 | ❌ 132 BPM 万物同频抖动，4 幕堆满 6–8 个摇摆道具，无焦点与因果链 | ❌ 受 `0.72 half_void` 逼迫塞满漂浮音符 | **全面重构 `kernel.js` + `world.js` + `puppet2d.js` 卡通比例与 IK** |
| **`paper-popup`** | 3D 立体书箱庭 | ⚠️ 有 V-fold/风琴折底座，但 `evalContinuousHopChain` 被阉割、`createOrigamiFox` 仅 16 三角面、部分 `setFold` 用 `scale.y` 假折叠 | ⚠️ 折纸狐狸无四肢/眼睛/关节动画；空中鹤/蝶未归属书页 | ⚠️ 相机全程 `z=15~18` 远景俯拍，缺立卡展开微距特写 | ❌ 桌面与书页留白易触碰 `half_void` 阈值 | **恢复三段式跳跃物理、真 3D 折痕铰链旋转、升级多层折纸生灵与远近交替运镜** |
| **`clay-macaron`** | 3D 桌面玩偶剧场 | ✅ 具备 SDF 软陶圆角构件、指纹置换与 PBR 材质规则 | ✅ 使用 `engine/puppet.js` 二头身 3D 玩偶（头身比约 1:1.1），可读性好 | ⚠️ 4 个镜头偏静态陈列展示，主角跨镜头动作因果与手部接触可进一步强化 | ✅ 良好 | **强化 `world.js` 四幕动作连续性与角色互动表演** |
| **`ink-wash`** | 2D 宣纸水墨画卷 | ✅ **标杆级生成原语**（分形山脊、披麻皴、飞白笔锋、`drawWuxiaHeroPose`、`drawCalligraphicVerse`） | ⚠️ 内核已有高张力武侠特写原语，但默认 `styles/ink-wash/world.js` 仍在使用旧版火柴人小舟静态明信片 | ⚠️ 默认 `world.js` 相机推拉与人物表演未充分发挥内核的三拍子戏剧能力 | ✅ 已有 `STYLE_ABS_OVERRIDES['ink-wash']` | **升级默认 `styles/ink-wash/world.js` 的人物戏剧张力与景别对比** |
| **`twilight-fable`** | 2.5D 柔焦绘本 | ✅ 已完成 ADR-015/016 重构（`engine/critter2d.js` 120Hz 弹簧 Q 版骨架 + `MATERIAL_ROLES` + 2.5D 纵深相机） | ✅ 大头大眼主角猫 + 臀腿/臀尾联动 + 越肩背视/正颜特写 | ✅ 单主角追光寻鹿 4 幕连续因果叙事 | ⚠️ 暗夜天际留白建议在 `lookcheck.py` 增设合理阈值 | **在 `lookcheck.py` 补充 `twilight-fable` 阈值配置并回归验证** |
| **`vintage-naturalist`** | 2D 博物学铜版画 | ✅ 规则化植物分枝、羽毛覆瓦排布、铜版排线 hatching 与双页标本台账原语 | ✅ 翠鸟俯冲捕鱼具备 `perch → hover → dive → catch` 完整动作弧 | ✅ 4 幕聚焦单一翠鸟标本与折页解剖图 | ✅ 良好 | **回归验证保持全绿** |

---

## 三、系统性工程修复方案（Remediation Plan）

### Phase 1：工具链与通用骨骼层地基修复（`engine/motion.js`、`tools/render.mjs`、`tools/lookcheck.py`、`engine/puppet2d.js`）
1. **支持分镜自定义高潮抽帧时间点（`data-settle` / `data-keyframe`）**：
   - 在 [`engine/motion.js`](../engine/motion.js) 的 `prepareScenes()` 中解析 `.frame` 元素上的 `data-settle`（或 `data-keyframe`）属性（支持秒数或 `[0.15, 0.92]` 比例），不再将所有分镜强行锁死在 `0.76 * dur`，让四宫格能够直接截取每一幕真正的动作高潮帧（如碰撞瞬间、特写惊讶反应、立卡完全展开瞬间）。
2. **校准 `tools/lookcheck.py` 风格美学阈值（`STYLE_ABS_OVERRIDES`）**：
   - 为 `paper-popup`（桌面与立体书页自然留白）、`rubber-hose`（聚光灯舞台与单焦点构图）、`twilight-fable`（幽暗森林夜空留白）配置符合各自媒介美学的 `half_void_max` 与 `com_y` 区间，彻底消除“为了凑满 `half_void <= 0.72` 而往天上乱塞漂浮零件”的倒逼机制。
3. **升级 `engine/puppet2d.js` 卡通头身比、面部表情与末端 IK 接触能力**：
   - 支持可配置的二头身/大头大眼比例覆盖（`headScale`、`eyeScale`、`limbWidth`）；
   - 支持 2-Bone IK 手部目标点求解绑定（`reachTargetL` / `reachTargetR`），让 2D 角色的手掌/工具能够精确触碰、抓取或敲击场景中的目标坐标。

### Phase 2：`styles/paper-popup/` 内核与样片重构（对齐 `world_05_paper` 精工标准 + ADR-013 参数化原语）
1. **恢复完整三段式跳跃物理**：
   - 在 [`styles/paper-popup/kernel.js`](../styles/paper-popup/kernel.js) 中完整恢复 `evalContinuousHopChain` 与 `evalTargetedJump` 的「蓄力下蹲挤压（Anticipation Crouch）→ 腾空拉伸与俯仰角（Airborne Stretch & Pitch）→ 落地缓冲挤压（Landing Squash）」物理曲线。
2. **修复真 3D 折痕铰链旋转（True Crease-Hinge Rotation）**：
   - 修复 `evalPaperFold`、`buildPaperGround`、`createPaperBoat`、`createPopUpBookBase.applySpreadFold`，确保所有立体组件绕书页折痕轴做真实的 `rotation.x` 铰链旋转立起，彻底淘汰“只缩放 `scale.y` 压扁拉长”的假折叠。
3. **升级精细折纸生灵与多层浮雕机关原语**：
   - 重构 `createOrigamiFox`：具备多层折面躯干、头部、双耳、吻部、白芯折痕描边、四条独立关节折纸腿、蓬松折纸尾、眼睛，以及内置 `act(localT, mode)` 欢跳/招手/蓄力跳跃动画与 `setFold(f)` 铰链立起；
   - 重构 `createPaperBoat`：具备立体船体折面、船舱乌篷、船头暖光折纸小灯笼与白芯折边；
   - 新增参数化多层卡纸阶梯拱桥/水车/层叠荷叶锦鲤原语，确保既有 `world_05_paper` 的工艺精致度，又完全支持参数化定制。
4. **修复 `styles/paper-popup/world.js` 书页隔离与远近景交替运镜**：
   - 将所有空中飞鸟/纸蝶严格挂入所属跨页容器（`spread1` / `spread2`），翻页前旧页机关 100% 折收贴平书页，翻页后新页逐层立起；
   - 升级相机调度：开篇与翻页幕采用展现桌面立体书全貌的箱庭机位，非翻页叙事幕平滑推入中近景/微距视角（`y ~ 3.8..5.0, z ~ 8.8..11.5`），近距离展现折纸小狐狸跳跃过溪、纸鹤围绕灯塔盘旋的精巧折纸细节。

### Phase 3：`styles/rubber-hose/` 去贴纸化、大比例角色表演与强因果叙事重构
1. **内核去同频抖动与新增通用 1930s 卡通表演原语（`styles/rubber-hose/kernel.js`）**：
   - 解耦 `evalSwingBounce`：背景墙面、地板、窗框与静止家具默认保持稳定（`bounce: false`），仅正在演奏或运动的生物/弹性道具按节拍律动，恢复“静物衬托动体”的视觉锚点；
   - 新增 1930s 卡通夸张反应曲线 `evalCartoonTake(localT, triggerT, opts)`（蓄力缩身 → 眼珠弹出 `eyePop` / 下巴脱臼 `jawDrop` / 头顶冲起 → 弹簧回落）与通用场景道具原语（`drawCartoonPropTable`、`drawCartoonClockworkMachine`、补齐 `drawAnthropomorphicInstrument` 的 `'drumkit'` 分支）；
   - 升级 `createRubberHoseCharacter`：增大头部（`headR: 48`）、增大缺口饼干眼（`eyeR: 16`）、加粗橡皮管四肢（`limbWidth: 16`），新增夸张表情模式（`'take'` / `'anticipation'` / `'shock'` / `'proud'`）与手部 2-Bone IK 精确触碰目标点（`reachL` / `reachR`）。
2. **重构 `styles/rubber-hose/world.js` 为单焦点、强因果、有大特写的四幕动画**：
   - 摒弃“满屏 8 个道具原地同频乱晃”，围绕单一主角（发条咖啡馆的橡皮管店员 Felix）与一台暴走浓缩咖啡机/留声机展开清晰的四幕因果故事：
     - **Scene 1（起因 · 中景单焦点）**：店员手握摇柄（真实 IK 接触）费力给巨大的黄铜蒸汽留声咖啡机上发条，气压表指针飙红；
     - **Scene 2（蓄力与惊吓特写 · 占画面 50% 大特写）**：机器剧烈膨胀颤抖，镜头切至店员占画面半屏的大特写脸部表演（Classic 1930s Take：蓄力屏息 → 蒸汽阀炸响瞬间眼珠弹出、下巴掉到胸口、礼帽飞起）；
     - **Scene 3（动作追逐与物理敲击 · 全景动态横移）**：长出橡皮管双腿的调皮八分音符从机器喷出沿琴键逃跑，店员跨步追赶并挥动木槌真实砸中音符（IK 接触 + 音符压扁反弹）；
     - **Scene 4（收束余韵 · 舞台聚光谢幕）**：被驯服的音符化作规整旋律驱动留声机缓缓流淌爵士乐，店员擦汗得意敬礼，虹膜收束（Iris Out）。

### Phase 4：`showcase/worlds/` 离线韧性修复与全风格门禁回归
1. **修复 `showcase/worlds/*/split/index.html` 与 `style.css`**：
   - 将外部 Cloudflare Three.js r128 CDN 替换为仓库内本地 `../../../../engine/vendor/three.min.js`（并注入 `*BufferGeometry -> *Geometry` 兼容别名）；
   - 将失效的 `<script src="https://cdn.tailwindcss.com/3.4.17"></script>` 修正为 `<script src="https://cdn.tailwindcss.com"></script>`，并在各 `split/style.css` 中补齐 `.hidden { display: none !important; }`、`.flex`、`.fixed`、`.inset-0` 等核心布局兜底样式，确保无外网或沙盒环境下零破版、零报错。
2. **升级 `styles/ink-wash/world.js` 与 `styles/clay-macaron/world.js` 叙事焦点与跨镜因果，并执行全量 6 风格自动化审计与视觉验收**。

---

## 四、落地修复清单与验收结果（Completed Remediations）

| 阶段 | 修改文件 | 核心修复内容 | 状态 |
| :--- | :--- | :--- | :--- |
| **Phase 1 · 工具链与骨骼层** | [`engine/motion.js`](../engine/motion.js)<br>[`tools/render.mjs`](../tools/render.mjs)<br>[`tools/lookcheck.py`](../tools/lookcheck.py)<br>[`engine/puppet2d.js`](../engine/puppet2d.js) | 1. `prepareScenes()` 与 `extractCues()` 支持 `.frame` 自定义 `data-settle` 与 `data-keyframe`（秒数、小数或百分比），`render.mjs` 优先按 `s.keyframe ?? s.settle` 抽取四宫格代表帧；<br>2. `lookcheck.py` 新增 `STYLE_ABS_OVERRIDES`（覆盖 `paper-popup`、`rubber-hose`、`twilight-fable`、`ink-wash`）与默认样片 `is_showcase` 原创度隔离；<br>3. `puppet2d.js` 新增 1930s 夸张惊愕反应 `do: 'take'`（`eyePop` / `jawDrop` / `hatJump`）、圆周摇柄 IK 动作 `do: 'crank'`（手部锁定旋转把柄 `hub`）与三段式蓄力挥锤敲击 IK 动作 `do: 'malletStrike'`（木槌头精确落向 `target`）。 | **已完成并通过验证** |
| **Phase 2 · `paper-popup` 内核与样片** | [`styles/paper-popup/kernel.js`](../styles/paper-popup/kernel.js)<br>[`styles/paper-popup/world.js`](../styles/paper-popup/world.js)<br>[`styles/paper-popup/scenes.html`](../styles/paper-popup/scenes.html) | 1. `evalPaperFold`、`applySpreadFold`、`buildPaperGround`、`createPaperBoat`、`createPaperPineTree` 全面升级为真 3D 折痕铰链旋转（`rotation.x = (1 - fold) * 1.48`）；<br>2. 完整恢复 `evalContinuousHopChain` 与 `evalTargetedJump` 的蓄力下蹲（Anticipation）、腾空拉伸与俯仰角、落地缓冲挤压（Squash & Stretch）；<br>3. `createOrigamiFox` 重构为多折面躯干、白胸脯、黑鼻尖、带高光折纸眼、四条独立关节折纸腿与八面菱形折纸尾，支持 `act('hop' \| 'jump' \| 'look')`；<br>4. `world.js` 严格按跨页容器隔离所有道具与生灵，并采用桌面立体书远景（`z=17.6`）与折纸微距中近景（`z=11.2`）交替运镜。 | **已完成并通过 `audit.mjs` + `lookcheck.py`** |
| **Phase 3 · `rubber-hose` 内核与样片** | [`styles/rubber-hose/kernel.js`](../styles/rubber-hose/kernel.js)<br>[`styles/rubber-hose/world.js`](../styles/rubber-hose/world.js)<br>[`styles/rubber-hose/scenes.html`](../styles/rubber-hose/scenes.html) | 1. 解耦背景与次要道具的 132 BPM 同频抖动（`drawAnthropomorphicGramophone`、`drawAnthropomorphicInstrument` 支持 `bounce: false`，大幅降低五线谱背景晃动）；<br>2. 新增 `evalCartoonTake`、`getGramophoneSockets`、补齐 `drawAnthropomorphicInstrument` 的 `kind === 'drumkit'` 分支；<br>3. 升级 `RUBBER_HUMANOID_DIMS` 与 `createRubberHoseCharacter`（加大头身比、粗四肢、大饼干眼，支持望远镜式眼珠弹出 `eyePop`、下巴脱臼 `jawDrop`、礼帽飞起 `hatJump`）；<br>4. 重构 `world.js` 为四幕单焦点强因果故事：摇柄蓄压（真实 IK 握持摇柄）→ 号角喷发与占画面 50% 高的大特写惊愕 Take → 追逐与木槌物理砸扁音符（真实 IK 敲击触发三色彩环）→ 驯服合奏与圆圈收尾。 | **已完成并通过 `audit.mjs` + `lookcheck.py`** |
| **Phase 4 · `showcase/worlds/` 离线韧性** | `showcase/worlds/world_05_paper/split/*`<br>`showcase/worlds/world_08_clay/split/*`<br>`showcase/worlds/world_09_blueprint/split/*`<br>`showcase/worlds/world_03_cyber/split/*` | 替换外部 Three.js CDN 为本地 `../../../../engine/vendor/three.min.js` + `BufferGeometry` 兼容层，修复 Tailwind CDN URL 并在各 `style.css` 注入 `.hidden { display: none !important; }` 等离线布局兜底规则。 | **已完成并通过验证** |
