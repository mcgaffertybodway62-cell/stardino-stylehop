# showcase/ · 宣发与历史作品

这里收录的是**宣发物料和早期作品**，不属于风格画廊本体。画廊本体（`engine/` `styles/` `gallery/` `tools/`）不依赖本目录的任何文件。

| 目录 | 内容 |
| :-- | :-- |
| `worlds/` `styles/` `slime_engine.py` `corelib/` `audio_deps.py` | 吉祥物「星芒史莱姆」的九界短片：PyCairo / Three.js 画面 + 程序化配乐。仅用于宣发 |
| `fusion/` | 早期三张 HTML-in-Canvas 融合旗舰页（蓝图撕裂、赛博破框、水墨长卷），主体直接画在着色器里，作为单页演示保留 |
| `skills/` | 上述作品对应的技能卡：复用入口、渲染命令与改装要点 |

## 运行

```bash
# 九界短片（Python，详见各 world 的 build_world_XX.py）
cd showcase && pip install -r requirements.txt
python worlds/world_04_inkwash/build_world_04.py

# 融合旗舰页
node engine/render.mjs --page showcase/fusion/inkwash-paper-scroll --sheet <work-dir>/fusion-inkwash.jpg
```

`world_01` / `world_02` 的分镜图因版权原因不公开，`world_10_finale` 不纳入本仓库。
