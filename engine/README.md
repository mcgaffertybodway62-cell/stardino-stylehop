# engine/ — HTML-in-Canvas × WebGL2 × Three.js × Deterministic Cinematography Core Engine

`engine/` provides the deterministic runtime that turns multi-scene live HTML/CSS/SVG inside `<canvas id="stage" content="drawable" layoutsubtree>` and Three.js / Canvas2D `world.js` stages into GPU-composited 3D layers, deterministic camera choreography, optical post-processing passes, and frame-accurate audio cue sheets.

| File | Responsibility |
| :-- | :-- |
| [`camera.js`](./camera.js) | **Unified Deterministic Cinematography & Camera Rig Engine**: 8 composable camera moves (`push`, `pull`, `orbit`, `crane`, `track`, `dolly-zoom`, `whip`, `static`), secondary camera physics (`evalImpactShake`, `evalHandheldSway`, `evalStopMotionBoil`), aspect-ratio framing compensation (`resolveAspectFraming`), Three.js adapter (`applyThreeCamera`), and 2D DOM camera adapter (`evalCamera2D` / `[data-cam]`) |
| [`html_in_canvas.js`](./html_in_canvas.js) | **HTML-in-Canvas compatibility layer**: `ensureCanvasDrawable()` / `markDrawable()`, feature detection, `texElementSubImage2D` + explicit `RGBA8` storage (Chrome 157+), legacy `texElementImage2D` fallback (Chrome 151–154), and `updateElementGeometry()` helpers. Keeps browser-version branches out of the render loop |
| [`stage.js`](./stage.js) | Per-frame pipeline: optional `world.render(...)` 3D/Canvas backdrop upload (`worldTex`) → `requestPaint()` → `onpaint` → `gl.texElementSubImage2D` (Chrome 157+; legacy `texElementImage2D` on 151–154) on the active `.frame.scene` layer and active `[data-layer]` floating cards → alpha/3D perspective composite with soft drop shadows → ping-pong WebGL2 shader pass chain (`u_paper` tactile texture on `TEXTURE2`, `u_sceneMix` transition pulse) → screen |
| [`motion.js`](./motion.js) | Deterministic `data-*` motion (`springStep`, `smootherstep`, `prepareMotion`, `applyMotion`, `settleTime`) + `[data-cam]` 2D camera transforms + **Multi-Scene Sequencer** (`prepareScenes`, `applyScene`) + **Deterministic Sound Cue Extractor** (`extractCues` → `window.CUES`, supporting declarative `data-cues` on pure 3D scenes) |
| [`studio3d.js`](./studio3d.js) | **Style-agnostic 3D Studio**: `createStudio3D(THREE, { width, height, look, presets, scenes, maxDist })` → renderer, aspect-adapted camera, look rig + per-scene look timeline, `applyShot`, `director()`, `render(frame)`. A 3D style kernel calls it and adds only its medium (palette, textures, materials, set floor) |
| [`studio2d.js`](./studio2d.js) | **Style-agnostic 2D Painted Scroll / Canvas Studio**: `createStudio2D({ width, height, designWidth, designHeight, scenes, getLookState, drawBackdrop })` → full-frame `1.0x` optical baseline (`evalSceneCamera2D`), one continuous single-direction camera move per scene (`static`, `push`, `pull`, `pan`, `rise`, `drop`, `drift`, eliminating zoom ping-pong), multi-plane parallax (`beginLayer(p)` / `endLayer()`), and 2D storyboard exporter (`is2D: true`) |
| [`puppet.js`](./puppet.js) | **Style-agnostic Character Puppet**: joint contract (`root > hips > spine > chest > neck > head`, arms, legs) that a style skins with its own meshes, plus deterministic acting `puppet.act(localT, actions)` — `walk` / `run` (no foot sliding), `face`, `look`, `nod`, `shake`, `wave`, `point`, `carry`, `hug`, `cheer`, `droop`, `surprise`, `lean`, `hop`, `pose`, `mood` (face: brows / eyes / mouth via `parts`), idle breathing, blinks and joint limits; `captureRest()` after a skin moves pivots to its body surface, `limbClearance()` (with `parts.body`) feeds the director's render-time "arm passes into its body" warning. Tells the director to frame `close` on the head, `medium` on the upper body, follow it and use character-relative angles |
| [`puppet2d.js`](./puppet2d.js) | **Style-agnostic 2D Character Puppet & Skeleton Solver**: 26-joint 2D Forward Kinematics (`root -> pelvis -> lumbar -> thorax -> neckBase -> headPivot -> headTop -> topKnotTip`, bilateral `sh -> el -> wr -> handTip`, bilateral `hip -> knee -> ankle -> heel/toe`, plus secondary cloth/sleeve/ribbon/rod chains) with a natural vertical `0 rad` (`Math.PI * 0.5`) limb convention, Spine2D/Blender bone-diamond blueprint renderer (`drawSkeleton2D`), and deterministic acting `puppet.act(localT, actions)` (`walk`, `drink`, `toast`, `sigh`, `castRod`, `wieldSword`, `bow`, `wave`, `pose`, `mood`). 2D styles (`ink-wash`, shadow-puppet, paper-cut, flat-vector) pass only their `skin(ctx, skel, state, t)` callback |
| [`director.js`](./director.js) | **Shot-List Director**: scenes as lists of cut shots (`subject`, `size` wide→extreme-close, `angle`, `height`, `move`, `follow`); measures each subject once and solves the camera distance by exact perspective fit for the real aspect ratio; `storyboard()` feeds `render.mjs --storyboard` with per-shot times and continuity warnings |
| [`look.js`](./look.js) | **Three.js Look Profile & Light Energy Budget**: one declarative `look` (colour pipeline, key / hemi / bounce / IBL budget, backdrop & fog, contact shadows) applied by `createLookRig`; ambient sources *share* a fixed illuminance budget so enabling an effect changes light quality, not exposure. `createLookTimeline` + `rig.apply()` switch / blend looks per scene from `data-look` (IBL cached per state). Verify with `tools/lookcheck.py` |
| [`vendor/three.min.js`](./vendor/three.min.js) | Bundled offline Three.js r147 runtime for procedural/parametric 3D `kernel.js` & `world.js` scenes (`window.THREE`) |
| [`three_bridge.js`](./three_bridge.js) | **Three.js + Optional `.glb` + `HTML-in-Canvas` Bridge**: `createDomTexture(gl, domEl)` wraps live DOM layers into WebGL2 / `THREE.Texture` slots; `createProceduralStudioLights(THREE, scene, preset)`; `loadBlenderGlb(loader, url, { domTargets })` |
| [`passes/`](./passes/index.js) | Composable full-screen WebGL2 shader passes: [`lens.js`](./passes/lens.js), [`spotlight.js`](./passes/spotlight.js), [`clay.js`](./passes/clay.js), [`riso.js`](./passes/riso.js), [`inkbleed.js`](./passes/inkbleed.js), [`crt.js`](./passes/crt.js), [`grain.js`](./passes/grain.js) |
| [`base.css`](./base.css) | Semantic typography & layout contract (`.frame.scene`, `#stage[data-world="true"] .frame`, `[data-layer]`, `.kicker`, `.title`, `.card`, `.metric`, `.vertical`, `.figure`) scaled via `--u` (`1%` of short canvas edge) for `16:9`, `9:16`, and `1:1` |
| [`components/data.css`](./components/data.css) | **Opt-in, not loaded by default**: `.formula` (MathML) and `table.data`. A style imports it from its `theme.css` only when formulas or tables belong to its own medium |
| [`serve.mjs`](./serve.mjs) / [`server.mjs`](./server.mjs) | Local static server (`--open` launches the detected Chrome; 157+ needs no flag, 151–154 gets `CanvasDrawElement`) |
| [`browser.mjs`](./browser.mjs) | Headless Chromium launcher with deterministic sRGB and the legacy `CanvasDrawElement` flag; honors `CHROME_BIN` / `PLAYWRIGHT_CHROME` |
| [`render.mjs`](./render.mjs) | Thin compatibility wrapper forwarding to [`tools/render.mjs`](../tools/render.mjs) |

## Multi-Scene, Pure 3D Stage & Audio Cue Architecture (`motion.js` + `camera.js` + `stage.js`)

A style's `styles/<id>/scenes.html` defines multiple scenes inside `<canvas id="stage" content="drawable" layoutsubtree>`.
For **pure 3D styles (`stageMode: '3d-pure'`)**, `scenes.html` contains zero developer-inspection text cards so the 3D stage is 100% unobstructed, using `data-cues` to drive foley audio:

```html
<section class="frame scene"
         data-scene="scene-01"
         data-title="01 · Act I"
         data-dur="4.2"
         data-look="golden"
         data-cues="0.18:enter:act1_start:0.85, 0.62:impact:shell_snap:0.95, 1.35:float:stream_pour:0.80">
</section>
```

- **Style Kernel vs. Story World (`kernel.js` vs `world.js`)**: Reusable medium materials, procedural textures, lighting, and physics live in `styles/<id>/kernel.js`; story-specific 3D props and camera choreography live in `styles/<id>/world.js` (or an external module passed via `?world=` / `--world`).
- **Shot-List Director (`engine/director.js`)**: each scene is a list of framed shots with hard cuts; worlds call `director.update(frame)` then `studio.render(frame)` and return `storyboard: director.storyboard`.
- **Deterministic Camera Rig (`engine/camera.js`)**: `evalCameraShot(shotSpec, u, localT)` and `applyThreeCamera(camera, state, { distScale })` evaluate smooth orbital, crane, tracking, push/pull, whip-pan, and dolly-zoom moves plus impact shakes and stop-motion boil as pure functions of time.
- **`extractCues(root)`**: Parses `data-cues` on each `.frame.scene` (plus any DOM `[data-enter]` / `[data-draw]` / `[data-count]` / `[data-layer]` elements) into `window.CUES`, consumed by `tools/sound.py`.
