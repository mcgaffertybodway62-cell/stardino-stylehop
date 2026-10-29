# Clay Macaron · 3D 马卡龙定格软陶 (`styles/clay-macaron`)

## 1. Visual Essence & Architectural Layering (`kernel.js` vs `world.js`)

**Clay Macaron (`clay-macaron`)** is a **3D Stop-Motion Polymer Clay & Burnished Brass Tabletop Cinema Style** (`stageMode: '3d-pure'`, `defaultOverlay: 'none'`). Inspired by Aardman / Laika stop-motion craft and miniature diorama filmmaking, it combines **hand-molded matte polymer clay (`roughness 0.72`, procedural fingerprint whorl normal relief)**, **burnished brass clockwork**, **puffy glaze accents**, and **12 fps stepped stop-motion physics** inside a sunlit afternoon tabletop studio.

### Strict Architectural Separation: Style Kernel vs. Story World
To enable AI agents to author **original 3D animations for any user topic** without copying demo props:
1. **`styles/clay-macaron/kernel.js` (Reusable Style Kernel — ALWAYS Import)**:
   - Encapsulates the subject-agnostic medium laws: `CLAY_PALETTE`, procedural textures (`createThumbprintBumpTexture`, `createMarbledClayTexture`, `createCaramelLatteTexture`), PBR material factory (`createClayMaterialFactory`), 12fps stop-motion physics primitives (`quantizeStopMotionTime`, `evalVolumePreservingSquash`, `evalHopArc`, `evalLayerStackSpring`, `evalBoxUnfold`, `evalPouringStream`, `evalCarouselWave`), and the turnkey sunlit studio, look timeline & shot-list director (`createClayStudioStage` with `director`, `render(frame)`).
2. **`styles/clay-macaron/world.js` (Default Showcase Story — Replace or Override via `--world` for New Topics)**:
   - Contains the default patisserie showcase story (*L'Atelier du Macaron*): 4 scenes of 3.4–4.4 s with 2 / 4 / 3 / 2 cut shots, a clay mouse patissier who walks out to meet the delivery cart, light going day → golden → dusk. Its scene count, durations and shot sizes are an example of the grammar, **not a template** — a new story sets its own.
   - **Treatment First & Zero Demo Asset Reuse Rule**: Before opening `styles/clay-macaron/world.js` or writing code for a new topic, you MUST write `<work-dir>/<style-id>/<product-slug>-v<N>/TREATMENT.md` proposing **3 distinct narrative structures**, selecting the best one, defining at least **1 stop-motion Native Move**, and passing the **6-Dimension Anti-Cliché Self-Check** against the default patisserie showcase (at least 4 of 6 dimensions — narrative structure, opening hook, signature hero shot, camera path, lighting arc, and ending beat — must be completely different).
3. **Pure 3D Visual Stage (`stageMode: '3d-pure'`, `defaultOverlay: 'none'`)**:
   - `scenes.html` contains ONLY `<section class="frame scene" data-scene="..." data-dur="..." data-look="..." data-cues="...">` timeline markers: duration per beat, per-scene light (`data-look` + optional `data-look-blend` / `data-look-at`) and foley cues.
   - **Never add developer-inspection text cards, parameter plaques, or telemetry badges** on top of the 3D stage unless the user explicitly requests subtitles or title cards.
4. **Mascot Separation Rule**: The gallery promotional mascot (*Star-Spark Slime / 星芒史莱姆*) is strictly excluded from `styles/`.

---

## 2. Best-Fit Topics & Selection Routing (`style.js` & `gallery/catalog.js`)

- **`bestFor`**:
  - 治愈故事 / 绘本童话 / 奇幻微缩世界 / 角色小剧场 (Cozy stories, picture-book fables, miniature dioramas, character shorts)
  - 甜品烘焙 / 咖啡茶饮 / 节日礼盒开箱 / 生活方式 (Food & beverage, gift unboxing, lifestyle product stories)
  - 手作工艺 / 潮玩盲盒 / 机械八音盒 / 趣味物理科普 (Craft, designer toys, clockwork mechanisms, playful physics explainers)
- **`avoidFor`**:
  - 高密度金融K线报表 (High-density financial charts)
  - 纯命令行代码终端演示 (Terminal / code-heavy dashboards)

---

## 3. Color & Material Standard (`kernel.js -> CLAY_PALETTE`)

| Token / Role | Hex | PBR Roughness / Metalness | Usage |
| :--- | :--- | :--- | :--- |
| **Warm Parchment Stage (`deskBg`)** | `#F6E9D7` | Matte (`0.84` / `0.02`) | Tabletop studio backdrop & soft warm fog (`FogExp2`) |
| **Tabletop Clay Slab (`deskSurface`)** | `#F3E1CA` | Matte (`0.84` / `0.02`) | Ground contact plane at `Y = 0.0` receiving soft shadows |
| **Pastel Diorama Hills** | `#E6D7F2` / `#D4ECDD` / `#FCE0D2` | Clay (`0.78` / `0.03`) | Layered lavender, sage, and peach background silhouettes |
| **Macaron Rose / Coral** | `#F5A3B8` / `#F79D84` | Clay (`0.72` / `0.03`) | Hero warm clay bodies, petals, awnings, characters |
| **Pistachio Mint / Sky** | `#9EDBC0` / `#98D4F2` | Clay (`0.72` / `0.03`) | Cool contrast clay bodies, foliage, vehicles, props |
| **Yuzu Lemon / Taro** | `#FADC8C` / `#C8A8E9` | Clay (`0.70` / `0.03`) | Bright accent props, stars, ribbons, balloons |
| **Cream White / Ganache Cocoa** | `#FFFDF7` / `#59382B` | Clay (`0.68` / `0.03`) | Whipped cream, clouds, eyes/details, chocolate accents |
| **Burnished Brass (`brassWire`)** | `#C99B5E` | Metallic (`0.34` / `0.62`) | Clockwork keys, armatures, scales, lamp posts, rims |

### Procedural Texture & Material Factory (`kernel.js` exports)
1. **`createThumbprintBumpTexture(size = 512, seed = 73)`**: Synthesizes concentric fingerprint whorl rings + micro-dimple pores in an offscreen 2D canvas (`bumpScale = 0.026`).
2. **`createMarbledClayTexture(colors, size = 512)`**: Generates folded sinusoidal bands simulating hand-kneaded multi-tone polymer clay.
3. **`createCaramelLatteTexture(size = 512)`**: Generates swirling milk-tea and caramel foam ripples.
4. **`createClayMaterialFactory(clayBumpTex)`**: Returns `{ makeClayMat, makeBrassWireMat }` with unified tactile PBR parameters.
5. **`createClayStudioStage({ width, height, baseFov, look, looks, scenes })`**: Returns `{ canvas, renderer, scene, camera, envGroup, deskMesh, framing, clayBumpTex, caramelTex, marbledTex, makeClayMat, makeBrassWireMat, director, applyShot, lookRig, render }`. Worlds pass `look: style.look, looks: style.looks, scenes` (from `createWorld`) and draw every frame with `studio.render(frame)` only — passing `frame` applies the per-scene look.
6. **`CLAY_LOOK`**: the style's look profile over `engine/look.js -> LOOK_DEFAULTS` — sRGB output + ACES, `illuminance 2.0`, `keyRatio 2.5`, IBL studio dome + key-aligned softbox (`env.share 0.5`), peach bounce (`share 0.2`), ground contact shadows. Lighting values are never set in `world.js`.
7. **`CLAY_LOOK_PRESETS`** (`day`, `golden`, `dusk`, `night`, `indoor`): complete light designs inside the same energy budget, selected per scene with `data-look="dusk"` (blend with `data-look-blend="2.0"`). Add or override presets per video with `style.looks`. Night stays readable (dark blue, not black); emissive props (lanterns, windows) carry the glow.

---

## 4. Stop-Motion Physics & Cinematography Grammar

### Stop-Motion Physics Primitives (`kernel.js`)
1. **`quantizeStopMotionTime(t, fps = 12, blend = 0.88)`**: Quantizes continuous time `t` to `12fps` so every prop exhibits authentic hand-animated stop-motion cadence while camera moves remain smooth.
2. **`evalVolumePreservingSquash(compression)`**: Enforces constant volume ($s_x \cdot s_y \cdot s_z = 1$) anchored at the bottom contact plane ($y = 0$).
3. **`evalHopArc(u, y0, y1, apexHeight)`**: Parabolic ballistic trajectory with pre-hop anticipation squash, mid-air stretch, and landing impact compression.
4. **`evalLayerStackSpring(qLocalT, staggerIndex, staggerStep)`** & **`evalBoxUnfold(qLocalT)`**: Staggered spring assembly and 4-stage hinged unboxing choreography.
5. **`evalPouringStream(qLocalT)`** & **`evalCarouselWave(qTime, index, totalCount)`**: Spout-pinned liquid stream pouring and non-interpenetrating circular domino wave.

### Shot-List Director (`engine/director.js` via `studio.director`)
A scene is a short list of **cut shots**, not one slow camera drift. Each shot names a subject and a size; the director measures the subject once and solves the camera distance for the real aspect ratio (16:9 / 9:16 / 1:1 all frame correctly).
```js
const director = studio.director({
  subjects: { bear, bearHead, door, forest: forestGroup, home: [house, path] },
  shots: {
    'lost': [                                   // key = data-scene id
      { dur: 1.6, size: 'wide',  subject: 'forest', height: 'high', move: 'push' },
      { dur: 1.0, size: 'close', subject: 'bearHead', angle: 25 },
      {           size: 'full',  subject: 'bear', angle: -40, move: 'orbit', follow: true },
    ],
  },
});
// render(frame): pose props ... then
director.update(frame);
studio.render(frame);
// createWorld returns { ..., storyboard: director.storyboard }
```
- `size`: `extreme-wide` · `wide` · `full` (whole subject) · `medium` · `close` · `extreme-close`, always relative to the named subject — for a face, name the head.
- `angle` (yaw°, 0 = front), `height` (`low` · `eye` · `high` · `top` or degrees), `move` (`push` · `pull` · `orbit` · `rise` · `drop` · `truck`, combine with `+`), `place` (`left` / `right` third), `follow` (track a moving subject), plus `sway` / `rollDeg`. **No camera shake**: whole-frame shake reads as a glitch; show impacts on the props (squash, bounce, wobble). `impacts` / `boil` are ignored unless a shot sets `shake: true` (then capped to a soft nudge).
- Subjects are measured when the director is created: **pose props first** the way their shots should see them (lid open, cart at its start mark); `render()` re-poses every frame anyway.
- Cut on action and change size or angle (≥ 30°) between neighbouring shots; `render.mjs --storyboard` renders one panel per shot and warns about jump cuts, over-long static holds and shots that fall past the scene end.
- **Know the hero**: in product / food / process stories the product is the hero — every transformation step gets a `close` / `extreme-close`, and the climax shot is the product (latte art blooming, the cake revealed), not a character. Characters there are supporting cast.
- **Vary the rhythm**: shot count, order and the size a scene ends on should differ between scenes (the demo uses 2, 4, 3 and 2 shots). The storyboard warns when most scenes share one pattern.
- **Wide shots show a world**: a `wide` of a lone prop on the empty desk reads as barren. Dress the set (ground, backdrop pieces, secondary props) or use `full` instead.
- `applyShot(shotSpec, u, localT)` (hand-placed `orbit` / `crane` / `track` moves from `engine/camera.js`) remains available for a single bespoke move.

### Characters (`buildClayCharacter` on `engine/puppet.js`)
```js
const bear = buildClayCharacter(makeClayMat, { species: 'bear', scarf: CLAY_PALETTE.strawberryRed, position: [-4, 2.5], heading: 90 });
stage.add(bear.root);
// render(frame):
bear.act(qLocalT, [
  { do: 'walk', from: 0.2, to: 2.4, dest: [0, 2.8] },   // or path: [[x,z], ...]; feet never slide
  { do: 'look', from: 2.3, to: 3.0, toward: [1, 1.6, 1] },
  { do: 'face', from: 2.7, to: 3.1, yaw: 15 },
  { do: 'wave', from: 3.0, to: 4.2, hand: 'R' },
  { do: 'hop', at: 3.3, dur: 0.55, height: 0.25 },
]);
```
- Species: `bear`, `bunny`, `cat`, `fox`, `mouse`, `pig`, `panda`, `frog`, `chick`, `kid` (a child: `hair`, `hairStyle: 'short'|'bob'|'pigtails'`, `outfit`, `pants`).
- **Make every character distinct** (silhouette first): `build` (`round` · `chubby` · `slim` · `tall` · `tiny` · `pear` · `egg` · `squat` · `kid`; each species has a default) changes the skeleton proportions, the lathe body profile and limb thickness — shoulders and hips are placed on that body's surface and the rest arm angle clears its widest point, so arms never sink into the body; colours (`fur`, `belly`, `limbs`, `outfit`), `eyes` (`dot` · `big` · `sleepy`), `earScale`, `scarf`, `apron`, `accessories` (`beret` · `beanie` · `chef` · `straw` · `bow` · `flower` · `glasses` · `backpack`) with `accent` colour. Two characters in one story should differ in species or build **and** in colour / accessory. Also `height`, `position`, `heading`, `ground`, resting `mouth`.
- Actions: `walk`, `run`, `face`, `look`, `nod`, `shake`, `wave`, `point`, `reach`, `carry`, `hug`, `cheer`, `droop`, `surprise`, `lean`, `hop`, `pose` (custom joint angles). Spans use `from`/`to`, moments `at` (+ `dur`); all fade in and out.
- Faces: `{ do: 'mood', from, to, mood: 'happy'|'sad'|'surprised'|'angry'|'worried'|'sleepy' }` moves brows, eyes and mouth. `cheer` / `hug` look happy, `droop` sad, `surprise` surprised, `shake` worried by themselves. Give every story beat a face.
- Director: `close` on a character frames its head, `medium` its upper body; shots follow it while it walks and `angle` is relative to its face (0 = from the front).
- **No wholesale interpenetration of main subjects.** Light overlap where things touch or stack (a cup on a saucer, squash on contact) is fine; a limb through a body, a character through a wall or a prop through a character is not. The storyboard's render-time check warns `arm passes into its body`.
- A bespoke character: `createPuppet(THREE, { height, proportions })` from `engine/puppet.js`, hang your own clay meshes on `puppet.joints` (sizes in `puppet.dims`); if your body is wider than the default, move `joints.shoulderL/R` / `hipL/R` to its surface and call `puppet.captureRest()`; set `puppet.parts.body` to the torso mesh (clipping check) and register `puppet.parts.eyes`, `parts.brows` ([L, R]) and `parts.mouths` ({ smile, grin, open, frown, flat }) for blinks and moods; it acts and frames exactly the same.

### Set dressing (kernel) — give wide shots a world
Wide shots of a lone prop on the bare desk read as empty. Build the place with these, then put props and characters on it:
```js
const ground = buildClayGround(makeClayMat, { center: [0, 0], radius: 7, color: '#B5D9A2' });   // irregular raised patch; stand things on ground.top
const brook = buildClayWater(makeClayMat, { path: [[-7, 0], [-2, 0.5], [3, -0.4], [7, 0.3]], width: 1.5, y: ground.top }); // or { pond: { center, radius } }
const stones = buildClayPath(makeClayMat, { path: [[0, 5], [0, 1]], style: 'stones', y: ground.top });                            // or style: 'dirt'
const grass = buildClayGrass(makeClayMat, { center: [0, 0], radius: 6.5, count: 70, flowers: 0.3, y: ground.top, avoid: [{ center: [0, 3], radius: 1.2 }] });
const rocks = buildClayRocks(makeClayMat, { center: [-3, 2.5], radius: 2, count: 6, y: ground.top });
const pine = buildClayTree(makeClayMat, { position: [-4, -3], kind: 'pine', height: 2.8, y: ground.top }); // kind: 'round' too
// each returns { group, update(qTime) }: add `.group` to the stage, call `.update(qTime)` per frame (water, grass and trees move)
```
All are seeded (`seed`) and deterministic. Recolour them per story (autumn grass, night water, snow ground) rather than building a flat slab or disc by hand.

### Hand-Molded Clay Sculpting Primitives (`kernel.js` — Avoid Raw CAD Boxes/Spheres)
When sculpting bespoke hero props for a new story (loaves, cottages, rockets, teacups, cushions, books, vines), **prefer these 4 hand-molded primitives over raw `THREE.BoxGeometry` / `SphereGeometry`** so edges and surfaces look pinched by human fingers:
```js
// 1. Hand-pinched organic clay lump / bread / cloud / pillow (with flattened contact base)
const loaf = createClayBlob(makeClayMat, { radius: 0.45, scale: [1.3, 0.85, 1.0], wobble: 0.08, flatBottom: 0.2, color: CLAY_PALETTE.terracotta, seed: 11 });

// 2. Hand-turned vessel / dome / mushroom cap / rocket hull from [r, y] spline points
const pot = createClayLathe(makeClayMat, { profile: [[0, 0], [0.35, 0.02], [0.48, 0.4], [0.36, 0.78], [0.42, 0.85]], wobble: 0.035, color: CLAY_PALETTE.macaronCoral });

// 3. Soft-beveled, thumb-pressed clay slab / board / roof tile / book / wall (replaces sharp BoxGeometry)
const board = createClaySlab(makeClayMat, { size: [1.6, 0.18, 1.0], bevel: 0.05, wobble: 0.02, color: CLAY_PALETTE.bambooStick });

// 4. Hand-rolled clay coil / piped cream / vine / handle / rope along 3D points
const swirl = createClayCoil(makeClayMat, { points: [[-0.4, 0, 0], [0, 0.25, 0.15], [0.4, 0, 0]], radius: 0.055, taper: 'both', color: CLAY_PALETTE.creamWhite });
```

### Stop-Motion Native Moves (`Native Move` — Choose ≥ 1 per Video in `TREATMENT.md`)
Instead of relying solely on hard cuts, design at least one **medium-native stop-motion transition** per video:
1. **Box-Unfold Diorama Reveal (`礼盒四面展开变场景`)**: Using `evalBoxUnfold(qLocalT)`, a closed gift box or suitcase unfolds its 4 walls flat onto the table, revealing the miniature diorama inside.
2. **Clay-Squash Morph (`软陶揉捏变形转场`)**: A prop squashes down (`evalVolumePreservingSquash(0.38)`) on a beat and springs back up transformed into the next stage of the product or a new prop.
3. **Layer-Stack Pop Assembly (`逐层弹跳叠装`)**: Using `evalLayerStackSpring(qLocalT, i, step)`, ingredients, building floors, or mechanical rings pop and settle into place one after another in 12fps rhythm.
4. **Turntable Set Flip (`微缩沙盘旋转换景`)**: The miniature ground patch (`buildClayGround`) rotates 180° like a stop-motion turntable to reveal the reverse side of the set (e.g., storefront exterior → cozy kitchen interior).
5. **Foreground Prop Wipe (`前景道具擦除转场`)**: A character carrying a tray or a passing miniature cart briefly fills the foreground (`close`), wiping seamlessly to the next scene.

---

## 5. Post-Processing & Audio Cues

- **Shader Stack (`style.js`)**: film-level only in `3d-pure` mode.
  - `grain` pass: `amount: 0.018, paper: 0.0, vignette: 0.18, warm: 0.0`
  - The `clay` screen-space relief / tilt-shift pass is **not** used on the pure 3D stage: its thumbprint texture is sampled in screen space and would stay glued to the screen while the camera moves. Re-enable it only when DOM title cards are on screen. Material relief comes from `clayBumpTex` on the 3D materials; warmth comes from `CLAY_LOOK` light colours.
- **Look regression guard**: `python3 tools/lookcheck.py --style clay-macaron` against `look_baseline.jpg`, plus absolute readability floors (exposure, highlights, contrast, tonal range) on every run.
- **Declarative Foley Cues (`scenes.html -> data-cues`)**:
  - Since `scenes.html` has zero DOM cards (`stageMode: '3d-pure'`), each `<section class="frame scene">` declares `data-cues="offset:kind:label:intensity, ..."` so `tools/sound.py` (`soundPreset: 'clay'`) synthesizes frame-accurate marimba, woodblock, and ceramic foley hits.
