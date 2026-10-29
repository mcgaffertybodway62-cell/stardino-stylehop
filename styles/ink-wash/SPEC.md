# Ink Wash Scroll · 水墨丹青 (`styles/ink-wash`)

> **Xieyi & Song-Yuan Ink Painting on Handmade Rice Paper, Animated (`气韵生动 · 计白当黑 · 没骨写意`)**:
> Blank paper is space (water, sky, mist, silence); one loaded brushstroke is a mountain ridge, a surging wave, a figure's robe, a gesture, or a scene transition.
> References (grammar only): Shanghai Animation Film Studio's *Feelings of Mountains and Water* (*山水情*, 1988 — blank-paper space, ink bloom, guqin pacing, figures in a few strokes), Liang Kai's xieyi brushwork, and Song-Yuan handscrolls. Copy none of their fixed compositions.

---

## 1. Essence, and What It Is Not (`水墨本质与反贴纸铁律`)

1. **Blank Paper Is Matter (`计白当黑`)**:
   - 60%–80% of the frame is **empty handmade Xuan paper (`留白`)**: water, sky, clouds, silence. Do not clutter the canvas from edge to edge.
2. **Forms Painted by Loaded Brushstrokes & Wet Masses (`没骨侧锋与水墨晕染`)**:
   - Real ink-wash forms are created by **loaded brushstrokes (`LOAD`: 笔尖浓、笔根淡，浓的一侧即轮廓，淡的一侧自然晕染成体积)**, **wet ink masses (`drawInkMass`: 边缘抖动、渐变消融、积墨水线)**, and **dry bristle tracks (`mkStroke` / `stroke`: 干笔飞白，露出纸纹)**—where things are *painted into existence* (`reveal: 0..1`).
3. **What It Is NOT (`严禁做成预制件拼贴画`)**:
   - **Never treat `kernel.js` as a static sticker pack.** Do NOT assemble every video from the same horizontal wave mountains + the same flat-topped rock + the same tilted pine tree + a side-view figure standing on the rock.
   - Compose each scene's geometry, horizon height, camera perspective (high wide looking down a chasm, low-angle towering cliff/wave, over-the-shoulder `back` view, frontal `front` view, or extreme close-up on a brush/vessel/hand), and brushstroke choreography **specifically for the user's story**.
   - **Zero Mascot Rule**: The gallery mascot (*Star-Spark Slime / 星芒史莱姆*) is strictly excluded from `styles/ink-wash/`.

---

## 2. Directing Workflow: Treatment First, Code Later (`先写导演阐述 TREATMENT.md，后写代码`)

Before writing `<work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-world.js` or reading `styles/ink-wash/world.js`:

1. **Write `<work-dir>/<style-id>/<product-slug>-v<N>/TREATMENT.md` First**:
   - **Three Candidate Structures**: Propose 3 distinct narrative/visual structures tailored to the user's topic (e.g., *One stroke is everything*, *A hanging scroll tilting from sky to abyss*, *Two brushes in dialogue*, *A solitary journey confronting a towering obstacle*, *Macro-to-micro craft metamorphosis*), then select the strongest one and explain why. **The first idea that comes to mind is usually a cliché—push past it.**
   - **Logline & Emotional Arc**: One sentence (`One subject, one goal, one turn`: setup → turn → ending).
   - **One Native Move**: Pick or invent one transition/climax that *only* ink on paper can do (see §6 below) and place it at the emotional peak.
   - **Shot-by-Shot Table**: For every shot, specify framing (`wide / full / medium / close / extreme-close`), camera angle/view (`side / front / back`, high angle, low angle), camera move, duration (`>= 1.5s`), and **why** it is shot that way.
2. **Anti-Cliché 6-Dimension Self-Check**:
   - Compare your `TREATMENT.md` against the default showcase (`styles/ink-wash/world.js`) across 6 dimensions: **Structure, Opening, Signature Shot, Camera Path, Look Progression, Ending**.
   - **At least 4 of the 6 dimensions MUST differ.**
3. **Verbatim Classical Text Rule (`古诗词原文铁律`)**:
   - If the film quotes classical Chinese poetry or prose, every verse MUST be the authentic verbatim original text. Never invent pseudo-classical lines, and never put horizontal `《》` brackets inside vertical inscriptions (`drawVerticalColophon`).

---

## 3. Materials, Five-Tone Ink & Colour Logic (`墨分五色与一点朱砂`)

### Five-Tone Sumi Ink (`TONE`)
Ink density is multiplied onto warm Xuan paper in five classical tones:

| Token | Opacity (`TONE`) | Traditional Use |
| :--- | :--- | :--- |
| **`TONE.jiao` (焦墨)** | `0.96` | Calligraphy, sword blades, hat brims, sharpest accents, moss dots (`点苔`) |
| **`TONE.nong` (浓墨)** | `0.82` | Near contours, dark edge of loaded brushstrokes (`LOAD`) |
| **`TONE.zhong` (重墨)** | `0.60` | Secondary structure lines, robe folds, scabbards, near branches |
| **`TONE.dan` (淡墨)** | `0.34` | Midground mountain bodies, robe base washes, rock shadow facets |
| **`TONE.qing` (清墨)** | `0.16` | Far mountain silhouettes, faces, distant mist, subtle water streaks |

### Colour Logic & Per-Scene Look Presets (`data-look`)
- **Values carry depth**: Far = pale and soft (`qing` / `dan`); Near = dark and textured (`nong` / `jiao`). If a frame looks busy, **remove ink rather than adding tone**.
- **One Vermilion Accent (`INK_PALETTE.zhuSha` `#C93524`)**: In pure xieyi ink scenes, keep the world monochrome sumi ink on warm rice paper plus **one vermilion accent** (the cinnabar seal + at most one tiny focal detail on the protagonist, such as a sword tassel `朱砂剑穗`, a cinnabar gourd, or a red plum blossom) that locates the protagonist in wide shots and rhymes with the closing seal.
- **Mineral Looks (`scenes.html -> data-look`)**:
  - `shanshui` (`#EFE5D2` warm Xuan paper, sumi ink & indigo washes)
  - `qinglv` (`#EAD6B0` aged gold silk, azurite `石青` & malachite `石绿` with mud-gold ridges)
  - `xieyi` (`#EEDAC0` dusk amber paper, burnt sienna & rouge washes)
  - `night` (`#30435A` moonlit indigo scroll, calibrated so `lookcheck.py` readability floors `L >= 35` pass)
  - `snow` (`#EAE8E0` winter alum paper, stark charcoal ink crags & clam-white snow)

---

## 4. Core Painting Primitives (`styles/ink-wash/kernel.js`)

Build your scene's cliffs, gorges, waves, trees, architecture, and props from **brushstroke & wash primitives** first:

1. **Multi-Bristle & Loaded Brushstroke Engine (`stroke`, `mkStroke`, `drawStroke`, `LOAD`)**:
   ```js
   // 1. Loaded side-brush stroke (没骨侧锋: dark edge on `darkDir` side, pale wash on the other):
   stroke(ctx, [[x0, y0], [x1, y1], [x2, y2]], LOAD(18, TONE.nong, [-1, 0], {
     dry: 0.45,       // 0 = wet solid stroke, 0.35 = textured, 0.65+ = flying white (飞白)
     prof: 'robe',    // 'brush'|'even'|'tip'|'lens'|'nail'|'na'|'press'|'fan'|'robe'|'rise'|'cone'|'dot'
     seed: 42,
   }), revealProgress, alpha);

   // 2. Crisp or dry-brush calligraphic stroke (中锋/飞白, with progressive drawing `revealProgress` 0..1):
   stroke(ctx, pts, { w: 4.5, tone: TONE.jiao, dry: 0.55, wet: 0.2, prof: 'nail', seed: 19 }, revealProgress);
   ```
2. **Organic Wet Ink Mass & Ink Blots (`drawInkMass`, `drawInkBlot`)**:
   ```js
   // Soft jittered-edge polygon wash with gradient falloff & wet pigment rim (积墨水线):
   drawInkMass(ctx, polyPts, {
     tone: TONE.dan,
     color: INK_PALETTE.inkNong,
     jitter: 2.5,
     seed: 11,
     grad: [x0, y0, x1, y1, 1.0, 0.05], // fades smoothly into blank paper
   });
   // Irregular wet blot / moss dot / ink splatter:
   drawInkBlot(ctx, x, y, radius, TONE.jiao, angle, 0.7, seed);
   ```
3. **Composable Landscapes, Cliffs & Gestural Waves (`ridgeFn`, `drawRidgeLayer`, `drawCliffFace`, `drawGesturalWave`)**:
   - `const ridge = ridgeFn([[peakX, height, width], ...], baseY, seed, roughness)`: Define your own custom mountain silhouette (a single towering peak, a V-shaped chasm, or receding ridges).
   - `drawRidgeLayer(ctx, { ridge, depth: 280, tone: TONE.dan, rim: true, cun: 1.2, moss: 1.4, seed })`: Renders the mountain body dissolving downward into blank paper mist, with loaded crest strokes, `披麻皴` texture strokes, and `苔点` moss dots.
   - `drawCliffFace(ctx, x, y, scale, { flip: 1 | -1, seed })`: Renders an overhanging craggy cliff face using traditional `勾、皴、染、点` loaded brushwork.
   - `drawGesturalWave(ctx, x, y, scale, t, { flip: 1 | -1, seed })`: Renders a towering wall of surging water (`巨浪排空`) from wet ink mass + huge curling loaded strokes.
4. **Auxiliary Motif Helpers**:
   - `drawInkBloom`, `drawInkSplatter`, `drawQiYunTrail`, `drawMaYuanWaves`, `drawInkRipples`, `drawWeatherParticles`, `drawCinnabarSeal`, `drawVerticalColophon`, and optional kit helpers (`drawInkPine`, `drawInkBamboo`, `drawInkPlumBranch`, `drawInkReeds`, `drawInkBoat`, `drawInkBird`, `drawInkFish`, `drawInkVessel`).

---

## 5. Multi-View Character Puppet & Pose System (`engine/puppet2d.js` + `createInkCharacter`)

`createInkCharacter` wraps the style-agnostic 26-joint 2D skeleton solver ([`engine/puppet2d.js`](../../engine/puppet2d.js)) with **two rendering modes** and **three camera views**:

```js
const hero = createInkCharacter({
  archetype: 'swordsman',   // 'scholar' | 'angler' | 'swordsman' | 'musician' | 'child' | 'monk'
  renderMode: 'xieyi',      // 'xieyi' (loaded brush + ink mass + vermilion tassel) | 'baimiao' (fine line art)
  view: 'side',             // 'side' (profile) | 'front' (frontal) | 'back' (over-the-shoulder rear view)
  x: 520, y: 720, scale: 1.05, facing: 1,
  hat: 'bamboo',            // 'bamboo' | 'scholar' | 'topknot' | 'none'
  heldProp: 'sword',        // 'sword' | 'cup' | 'rod' | 'brush' | 'staff' | 'fan' | 'scroll' | 'none'
});
```

- **Built-in Actions (`hero.act(localT, actions)`)**:
  - `walk`: Natural bipedal gait (`fromX`, `toX`, `fromY`, `toY`).
  - `leap`: Qinggong water-skimming / treetop leap (`fromX`, `toX`, `height`, `cadence`), body pitched forward, front knee tucked, rear leg trailing, sleeves streaming.
  - `writeAir`: Raises sword or brush high to write/slash in the air (ideal with `view: 'back'` for over-the-shoulder shots).
  - `wieldSword`, `drink`, `toast`, `sigh`, `castRod`, `bow` (ideal with `view: 'front'`), `wave`, `playQin`, `row`.
- **Custom Story Poses (`{ do: 'pose', view, joints }`)**:
  - Do not limit characters to preset actions! Keyframe any custom posture for your story by blending joint angles (`0 rad` = straight down `Math.PI * 0.5`):
    ```js
    hero.act(localT, [
      {
        do: 'pose', from: 0.4, to: 2.6, hold: true, view: 'back',
        joints: { spineAngle: -0.08, headAngle: -0.25, shRAng: -1.95, elRAng: 0.25, thighLAng: 0.16, thighRAng: -0.16 }
      }
    ]);
    ```

---

## 6. 2D Camera Grammar (`engine/studio2d.js`) & Native Moves

### Core 2D Law: One Scene = One Painting, One Scene = One Continuous Move (`一幕一构图 · 一场一单向微镜`)
Unlike 3D styles (`engine/studio3d.js` + `engine/director.js`) which build a persistent 3D set and cut between multiple virtual cameras inside one scene, **2D Ink-Wash is built on [`engine/studio2d.js`](../../engine/studio2d.js)**:
1. **Never Zoom the Canvas to Fake Shot Size**: The 2D canvas baseline is always locked to `1.0x` full-frame (`1920×1080`, centered at `(960, 540)`). Do **not** slice a single scene into multiple `wide -> close` sub-shots that zoom the canvas in and out (`呼吸风箱效应`).
2. **Change Shot Size by Re-Composing the Next Scene**:
   - Want a **wide shot (`wide`)**? In Scene 1, draw distant ridges (`drawRidgeLayer`) and a small character (`scale: 0.55`).
   - Want a **close-up (`close`)** or **over-the-shoulder (`view: 'back'`)**? In Scene 2, compose a close-up painting where the character or vessel is drawn large (`scale: 1.5` or `view: 'back', scale: 1.65`)!
3. **One Single-Direction Camera Move Per Scene**:
   ```js
   const director = studio.director({
     shots: {
       'act1-peaks':  { size: 'wide',   move: 'static', subject: 'mountainValley' },
       'act2-cliff':  { size: 'medium', move: 'pan',    amount: 0.45, subject: 'cliffPath' },
       'act3-skiff':  { size: 'close',  move: 'push',   amount: 0.40, subject: 'anglerSkiff' },
       'act4-finale': { size: 'wide',   move: 'pull',   amount: 0.40, subject: 'snowRiver' },
     },
   });
   ```
   Supported single-direction `move` values: `'static'` (locked frame), `'push'` (`1.00 -> 1.03` gentle push), `'pull'` (`1.03 -> 1.00` gentle pull), `'pan'` / `'track'` (horizontal handscroll glide), `'rise'` / `'drop'` (vertical hanging-scroll glide), `'drift'`.

### Camera Vocabulary (A Menu, Not a Fixed Route)

| Camera Move | Expresses | Fits Beats Like |
| :--- | :--- | :--- |
| **Locked frame on blank paper** | The paper is the stage; strokes paint the world into being | Opening creation; a single brushstroke forming a ridge or branch |
| **Right-to-left pan (handscroll)** | Time and distance unrolling as one painting | A journey; a river's course; a historical progression |
| **Vertical tilt (hanging scroll)** | Height, realms stacked from sky to abyss | A waterfall plunging; climbing a peak; heaven to earth |
| **Lateral tracking with lead room** | Motion through a vast world | Qinggong run across water; riding through bamboo |
| **High wide, tiny figure in blank paper** | Smallness, solitude, scale of nature | Loneliness; vast snow river; one life among mountains |
| **Low angle, dark mass towering** | Weight, threat, awe | A towering wave (`drawGesturalWave`); an overhanging cliff (`drawCliffFace`) |
| **Over-the-shoulder (`view: 'back'`)** | Putting the hero, their gesture, and the obstacle on one axis | Facing a giant wave, writing a character in the air, gazing at a chasm |
| **Hard cut to extreme close-up** | A sudden break in the flow (stillness before action) | Brim of a bamboo hat; fingers tightening on a hilt or teacup |
| **Push into an ink bloom** | Passing between states | Memory; dream; season turning (`drawInkBloom`) |
| **Pull back until the mark joins the whole** | The part was inside something larger | Closing scale reveal; final vermilion seal (`drawCinnabarSeal`) |

### Native Moves (Spend At Least One at the Emotional Peak)
1. **One stroke is everything (`一笔万象`)**: A single live brushstroke (`stroke(..., reveal)`) crosses blank paper and becomes a horizon, a bridge, a sword cut, or a branch.
2. **Emptiness is matter (`计白当黑`)**: Unpainted paper *is* the river, the fog, or the snowfield, defined only by a few faint ripples or a tiny boat/figure.
3. **Brush = gesture = action (`笔势即动势`)**: The hero's sword slash, sleeve sweep, or dance phrase literally leaves a flying-white calligraphic stroke in the air.
4. **Flying white (`飞白破寂`)**: After a moment of stillness, one fast dry-brush stroke (`dry: 0.72`) tears across the frame.
5. **Ink bloom transition (`墨晕化境`)**: A wet drop of ink (`drawInkBloom`) spreads across the paper to usher in the next scene.
6. **Splitting a mass (`破墨分形`)**: A decisive stroke cleaves a dark ink wave or cloud mass apart, scattering wet ink blots (`drawInkBlot`).

---

## 7. Output Directory & Verification Checklist
- [ ] Write `<work-dir>/<style-id>/<product-slug>-v<N>/TREATMENT.md` **before** coding `<work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-world.js` (3 candidate structures → chosen structure, native move, shot list, and 6-dimension diff check against demo).
- [ ] All topic files live in `<work-dir>/<style-id>/<product-slug>-v<N>/` (`TREATMENT.md`, `<product-slug>-world.js`, `<product-slug>-scenes.html`, `<product-slug>_storyboard.jpg`, `<product-slug>.mp4`).
- [ ] `node tools/audit.mjs --style ink-wash --world <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-world.js --content <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-scenes.html --all-sizes` passes with **0 issues**.
- [ ] `node tools/render.mjs --style ink-wash --world <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-world.js --content <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-scenes.html --storyboard <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>_storyboard.jpg` prints **0 warnings** and shows distinct compositions across scenes (no copy-pasted sticker layout).
- [ ] `python3 tools/lookcheck.py --style ink-wash --world <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-world.js --content <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-scenes.html` passes all `READABILITY` floors (`L in [35, 92]`, `p95 >= 55`, `contrast >= 7`, `range >= 18`).
