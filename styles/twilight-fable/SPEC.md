# Twilight Bioluminescent Fable · 暮光柔焦绘本 (`styles/twilight-fable`)

> 大光圈奶油散景 · 双层法线边缘光 · 120Hz 弹簧骨架生灵 · 可生成的地形、水与室内
> Creamy optical bokeh, dual-pass normal-dot-light rim shading, 120Hz spring-rigged creatures with
> parametric body plans, and **generative places** (meadows, forest floors, brooks, ponds, burrows, rooms).

---

## 1. Essence & the De-Solidification Law (`本质与反固化铁律`)

What makes it *twilight-fable* is **how things are lit and how they move**, never *what* is on screen:

1. **Light sculpts every form.** Characters, stones, trunks and canopies are drawn through
   `drawLitOrganicShape` (soft subsurface Pass A + crisp directional rim Pass B from up to 3 scene lights).
2. **Creatures move continuously.** `simulateCritterRig` integrates a 120Hz spring skeleton with hard
   anatomical clamps; `if (pose === …)` shape swapping is forbidden.
3. **Soft optics.** Bokeh fields, ambient colour washes, fog and light shafts give the picture-book depth.

The kernel is a **toolbox, not a set**. These rules are enforced by the kernel and by the tools:

| Rule | Enforcement |
|---|---|
| No primitive has a default on-screen placement. Mushrooms, pads, stones, trees, windows, ground, streams and `createTwilightCritter` must receive explicit coordinates composed for the shot. | Kernel prints `console.error('[twilight-fable] …')` and draws nothing → `tools/audit.mjs` FAILS. |
| Atmosphere (washes, aurora, sheen, bokeh) is generated from `seed` + look. **Give each scene its own seed.** | Same seed everywhere = same sky; the originality gate notices. |
| Water is optional. Use it only if the story's place has water. | — |
| `data-look` must be a preset or a look registered via `createTwilightStage({ looks })`. | Unknown look → `console.error` → audit FAILS. |
| Do not copy code or numbers from `styles/twilight-fable/world.js`. | `tools/audit.mjs` originality scan (shared-line ratio). |
| A topic must not look like the showcase or like earlier topics of this style. | `tools/lookcheck.py` ORIGINALITY gate (exit 3 on CLONE). |

**De-IP:** never copy the external reference's specific designs: a pure-black cat with white crescent / white-ringed
eyes, sun-emblem sky lanterns, goldfish, a striped-scarf snowman. **The principle behind them stays allowed and is
encouraged:** a dark subject whose eyes are the highest-contrast spot in the frame (design your own eyes — e.g. large
amber / jade irises with a light lid line), lit by one warm light; original glowing fish / lantern forms.

**Staging (learned from the original prototype):** the picture is *one dark-or-white subject + one warm key light +
one weaker cool counter-rim* (`lights.push(counterRimLight(key, [subjectX, subjectY]))` — opposite the key, a little
below, ~0.55× its intensity, rims only), not a diorama. Without the counter-rim a dark subject's shadow side melts
into the night. Terrain and props are background: keep them low-contrast and soft (fog, `drawFogLayer`, low `rimAlpha`,
`drawSoftLayer(ctx, (c) => { … }, { softness })` on far layers — never `ctx.filter = 'blur(…)'`, which stalls headless rendering for minutes; rim falloffs use the same low-res trick internally, `featherEraseShifted`), let bokeh carry depth, and never let crisp set-dressing compete with
the subject's rim light. Relative size must follow depth: a far creature is small because it is far, not because its
`scale` was shrunk on the same ground plane.

**Product / object stories** (aroma oil, tea, lamp, room décor): the product is the hero. You may light it with
`drawLitOrganicShape` + your own silhouette path and use creatures only as companions — or not at all.

### 1b. Material roles (`材质角色` — how a part is treated is decided by its material, not its species)

The kernel knows three material roles (`MATERIAL_ROLES`); a creature's `build.materials` only declares which
role each part plays (`body`, `accents` = ear/tail tips & paws, `horn`). Defaults: `{ body: 'fur', accents: <body>, horn: 'hard' }`.

| Role | Treatment (enforced by the kernel) |
|---|---|
| `spirit` | Emissive: near-white albedo (saturation auto-capped), soft outer halo, full-strength glowing accents. **At most one per shot.** |
| `fur` | Receives light only: natural albedo colour (black, cream, ginger, fawn … saturation ≤ 0.68), rim + bounce from scene lights, accents are tints (no glow). |
| `hard` | Horn / hoof / claw / shell: matte, crisp edge, one thin specular crescent toward the strongest light. No rim bloom, no glow. Value is relative to the host body (`hostLift`: at most body mid + 0.08), so it never becomes the brightest thing on a non-emissive animal; far-side hard parts are darkened like far legs. |

Colour rules behind the roles (`governMaterialColor`):
1. **Saturation and glow are mutually exclusive** — the more a part emits, the closer to white it is forced.
2. **Non-emissive albedo keeps its natural colour and a real value range** — do not grey everything out. A black cat
   is near-black with a light rim; a cream cat is cream. Only emission forces desaturation. Scene lights add hue on top.
3. **One emissive subject per shot.** Give the story's light-bearer `materials: { body: 'spirit' }`; everyone else stays `fur`.
4. Never fake a material by tuning species numbers; pick the role. Saturated palette values are allowed as input — the role governs them.

```js
createTwilightCritter({ x, groundY, species: '<base>', build: { materials: { body: 'spirit' } } }); // the light-bearer
createTwilightCritter({ x, groundY, species: '<base>', build: { horn: 'antlers' } });               // fur body, hard antlers by default
```

---

## 2. Workflow: Treatment First (`先写 TREATMENT.md，后写代码`)

Before writing `<work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-world.js` (and before opening `styles/twilight-fable/world.js`):

1. **Three candidate structures** for THIS topic → pick one and say why.
2. **Logline & arc** — one subject, one goal, one turn.
3. **One Native Move** invented for this story from the grammar in §6.
4. **Place design** — for every scene: what kind of ground (meadow slope / forest floor / bank / floorboards /
   table top / open water …), horizon height as a fraction of frame height, which set-dressing primitives, which look.
5. **Shot table** — per scene: framing, subject screen height %, view (`side | 3q | front | back`),
   one camera move, duration, and *why*.
6. **Anti-cliché check (two tables, both required):**
   - *Narrative* (6 dims vs the showcase): Structure, Opening, Signature shot, Camera path, Look progression, Ending.
     ≥ 4 must differ.
   - *Visual invariants* (vs the showcase AND the style's earlier topic films):
     horizon height, ground type, protagonist screen position & size, protagonist silhouette (species + `build`),
     prop set, dominant hue (look). ≥ 4 must differ. Narrative labels alone do not count.
   - **Historically over-used beat chain — do not reproduce:** glowing orb appears → creature touches it and it
     blooms → creature leaps with a water splash → wide finale of two creatures with rising particles / lantern boats.

---

## 3. Looks (`光色预设`)

`tools/lookcheck.py` enforces `L in [35, 92]`, `p95 >= 55`, `contrast >= 7`, `range >= 18`.

| Preset (aliases) | Character |
|---|---|
| `twilight` (`dusk`) | periwinkle-violet dusk |
| `aurora` (`night`) | cyan-violet night |
| `amber` (`golden`) | golden-hour rose |
| `dawn` (`day`) | lavender-rose dawn |
| `glade` (`indoor`) | emerald-indigo glade |
| `honey` (`warm`, `room`) | lamp-lit interior, burrow, tea room |
| `mintmist` (`morning`) | pale mint morning mist |
| `deepwood` (`forest`) | deep teal under-canopy woodland |

Every look has `sky*`, `water*`, `ground*`, `foliage*`, `stone*`, `warmGlow/warmMid/coolGlow/mistColor` and
`critter*` keys. Prefer authoring a story look:

```js
const stage = createTwilightStage({
  width, height, scenes,
  looks: { lanternRoom: defineTwilightLook('honey', { skyHorizon: '<hex>', warmGlow: '<hex>' }) },
});
// scenes.html: <section … data-look="lanternRoom" data-look-blend="1.2">
const look = stage.resolveLook(frame);
```

---

## 4. Building a Place (`为故事搭一个地方`)

All coordinates below are placeholders — derive them from YOUR composition.

```js
// Sky / wall
drawDreamyBackdrop(ctx, w, h, look, lights, t, { horizonY: <y>, seed: <scene seed>, washCount: <0..4> });
drawStarfieldAndMeteors(ctx, w, h, t, { seed: <n>, maxY: <y>, starCount: <n> });
drawAuroraRibbons(ctx, w, h, t, { mode: 'bands' | 'curtains' | 'arc', look, seed: <n>, maxY: <y> });
drawLightShafts(ctx, <x>, <y>, { angle, spread, count, length, color: look.warmGlow, seed }, t);
drawFogLayer(ctx, w, <y>, <bandH>, { color: look.mistColor, seed }, t);

// Land: design the silhouette for the shot (hill, bank, slope, floor, table edge)
const ground = groundProfile([[<x>, <y>], [<x>, <y>], …], { rough: <px>, seed: <n> });
drawGroundMass(ctx, w, h, ground, look, lights, t, { depth: 0..1, valleyMist: true, folds: 3, colors: {…}, seed });
drawGrassTufts(ctx, ground, <x0>, <x1>, { density, height: [min, max], colors: [base, tip], glowTips, seed }, t);
drawStoneMass(ctx, <x>, <y>, <w>, <h>, look, lights, { flatTop, moss: { coverage }, cracks, haze, seed });
drawTrunk(ctx, <x>, <baseY>, <topY>, look, lights, { width: [base, top], lean, bend, roots, haze, seed });
drawCanopyMass(ctx, <cx>, <cy>, <rx>, <ry>, look, lights, t, { lumps, glints, haze, seed });
drawWoodlandRow(ctx, ground, <x0>, <x1>, look, lights, t, { kind: 'pines' | 'grove' | 'bushes', depth: 0..1, gap: [gx0, gx1], haze, seed });
drawDistantBeacon(ctx, <x>, <y>, <r>, look, t, { kind: 'lanternTree' | 'shrineWindow' | 'starlightPillar' | 'crownStag', glowColor, coreColor, seed });
drawWindowGlow(ctx, <x>, <y>, <w>, <h>, look, t, { arch, panes: [c, r], moon: { x, y }, spillTo: <floorY> });

// Water (only if the place has water)
drawWaterSurface(ctx, w, h, <horizonY>, look, lights, t, { seed });       // open lake / sea
drawPond(ctx, <cx>, <cy>, <rx>, <ry>, look, lights, t, { seed });        // puddle, pond, basin
drawStreamPath(ctx, [[x, y], …], <halfWidth | (u) => px>, look, lights, t, { seed }); // brook in any direction
drawLightWaterReflection(…); drawStreamRipples(…); drawCritterWaterReflection(ctx, sim, waterY, t);

// Props (single instances — compose them yourself)
drawGlowMushroom(ctx, x, y, s, t, { c1, c2, cap: 'dome' | 'bell' | 'flat', lean });
drawLilyPad(ctx, x, y, rx, ry, t, { color });
drawBiolumDandelion(ctx, x, y, r, t, { colors: { … } });   drawDandelionSeed(…);
drawCrystalDewdrop(…);  drawLotusLanternBoat(…);  drawDefocusedFlora(ctx, stems, t);
drawGlowingMushrooms(ctx, t, { clusters: [...], pads: [...] });  // batch helper — no default layout
```

Custom silhouettes (a teapot, a lamp, a bird, a fish, a scarf) can share the rim shader:
`drawLitOrganicShape(ctx, (c) => { /* trace + c.fill() */ }, { cx, cy, radius, baseDark, baseMid, bounceColor }, lights)`,
with `traceSmoothChainRibbon`, `sampleSmoothChain` and `tracePlushLimbPath` exported for building shapes.

---

## 5. Creatures: Species × Build × View (`生灵：物种 × 体型 × 视角`)

```js
const sim = simulateCritterRig(localT, (t) => ({
  facing: ±1,                     // screen direction of the muzzle
  view: 'side' | '3q' | 'front' | 'back',
  pelvisX, pelvisY,               // standing: pelvisY ≈ groundY - 38 * s * build.legLen
  chestOffsetX, chestOffsetY,     // spine clamped to [0.72, 1.22] × 68 · s · bodyLen
  headOffsetX, headOffsetY,       // neck clamped to [28, 52] · s · (0.6 + 0.4 · headR)
  spineArch, headYaw, headTilt, headPitch,
  earAngleL, earAngleR, tailAngle, tailWagAmp,
  eyeSquint, mouthOpen,
  feet: { hindL: [x, y], hindR: [x, y], frontL: [x, y], frontR: [x, y] },
  lookAt: [x, y],
}), s, { species: '<preset>', build: { /* overrides */ }, paletteOverrides: { /* colours */ } });
drawTwilightCritter(ctx, sim, lights, localT);
```

**Motion vocabulary (`HERO_MOVES`, `critter.perform`) — compose beats, do not hand-write rigs.** The spring rig gives
follow-through, overshoot and ear / tail lag; the prototype's choreography vocabulary is in the kernel as composable
intent layers, applied in order on top of the neutral pose:

```js
const cat = createTwilightCritter({ x, groundY, scale, species: 'meadowCat', facing, … });
const sim = cat.simulate(localT, (time) => cat.perform(time, [
  ['idle'],                                                        // breathing, head sway, tail sway, ear flick
  ['look',   { t0, t1, target: [x, y], hold }],                    // head + eyes follow a target
  ['trot',   { t0, t1, fromX, toX, stride }],                      // bouncy trot, moves the base
  ['brake',  { t0, dur }],                                         // torso pitches past the hips, springs back
  ['reach',  { t0, t1, paw: 'frontL', target: [x, y], hold, stretch }], // paw lifts past the cheek, chest leans in
  ['crouch', { t0, t1, depth, wiggle }],                           // anticipation: hips drop, ears flatten
  ['leap',   { t0, t1, toX, toGroundY, height }],                  // chest leads, arch, mittens reach, tail streams
  ['land',   { t0, dur }],                                         // squash, head bob, impact blink
  ['earShake', { t0, dur }],
], { groundAt: (x) => groundY(x) }));                              // optional uneven ground (not across a leap)
```
Rules the moves keep (values ported from the prototype bunny, `rig-test-world.js`): every move fades in / out (no pose
switching); `trot` derives its footfall phase from distance covered (no paddling or skating) and picks a calm `walk`
below ~260 px/s; `leap` has the chest leading the pelvis, a push-off with the hind feet still planted, a level stretched
body in flight and an apex of 195 px by default; `land` / `brake` work through impact FORCES and asymmetric ear / tail
reactions; a reach target belongs beside the head, not behind it. Proportions matter as much as moves: the hero needs
legs about as long as its head is wide (`meadowCat`: headR 1.12, legLen 1.0) — a 1.3 head on 0.8 legs is unreadable in
motion. Body, neck, and limbs form a continuous 3-ball spine + 4-limb topology with volume-conserving leap extension
and smooth IK paw ground placement across all poses.
Check motion with a dense still sheet (`--stills t1,…,t9`) next to the prototype's, then mp4.

**Build** (`CRITTER_BUILD_DEFAULTS`): `bodyLen, girth, headR, muzzle (0..1), legLen, legGirth,
earType ('long' | 'leaf' | 'tri' | 'round' | 'none'), earLen, earWidth, earSplay,
tailType ('plume' | 'pom' | 'stub' | 'thin' | 'none'), tailLen, tailWidth, horn ('none' | 'buds' | 'antlers'),
hornColor, cheekTufts, eyeSize, eyeGap, irisColors[4], blush, noseColor`.

**Face rules (`drawCritterFace` / `drawEye`, every species and view) — use the kernel's eyes, do not paint your own over them:**
- *Eye spacing:* the gap between the eyes is `eyeGap` eye-widths (default 0.4). A big `eyeSize` shrinks the eyes to
  fit the face; the gap never collapses.
- *Turning:* `3q` and `headYaw` move eyes, blush and nose on a face sphere — the far eye narrows and slides toward
  the contour while the pair keeps its spacing.
- *Lids, never squash:* a blink is the upper lid closing to a "‿"; `eyeSquint` is the cheek pushing the lower lid up
  (content / smiling), with the upper lid barely lowered. The eye shows through the lid aperture; the face shows around it.
- *Derived from the skin:* sclera, socket, lid line and mouth line come from the body colour — a dark body shows no
  white crescent, its lid line hugs the eye's edge (never an arc floating above it: that reads as a raised eyebrow)
  and its mouth is barely there; a pale body gets dark lines. An emissive (`spirit`) body has no black pupil.
- *Mouthless by default (`build.mouth: false`):* the eyes carry the face, as in the prototype; no nose, no mouth line.
  Only an animated `mouthOpen > 0.25` (a meow, a gasp) shows a small dark oval. `mouth: true` restores nose + mouth.
- *No one-eyed hero:* `view: 'side'` on the plush face is drawn as a strong three-quarter turn with the far eye
  narrowed; true profiles belong to `world` forms.
- *Green–yellow guard (`tameGreenYellow`):* lime/chartreuse is always muted, and green beside a saturated yellow is
  pushed to dark jade (iris colours, ear / tail tip accents). Neon green + yellow reads as poison and is forbidden.

**Plush anatomy & table-driven tail topology (`CRITTER_TAIL_TYPES`):**
- *Round rump as thigh + vertical-strip lower legs:* Plush limbs stay clean vertical strips (`tracePlushLimbPath`), with hind paws resting directly beneath the rump (`pelvis.x - facing * 6..18 * s`) and front/hind stride separating forward/backward during `walk`/`trot`. The ventral pelvis contour tucks up to make room for the vertical-strip hind legs and shifts with the near hind foot (**haunch-to-leg linkage**), while the dorsal back stays full and convex across both horizontal gaits and upright sitting poses (`sitK > 0`).
- *Table-driven tail (`CRITTER_TAIL_TYPES`):* Tail attachment and J/S-curve droop are 100% table-driven (`rootX`, `rootY: [ground, air]`, `dropAngle: [ground, air]`, `restCurl: [c0, c1, c2]`) without conditional branches. Thin feline tails (`thin`) emerge from the lower-back rump (`rootY: [10, 2]`), droop naturally (`dropAngle: [0.68, 0.22]`), and curl upward toward the tip (`restCurl: [-0.28, -0.42, -0.45]`); in `view: 'back'`, the tail root sits at the base of the rump along the ground (`nPelvis.y + 36 * s`).

**Species presets are starting points**, each with a distinct silhouette: `fennec` (long ears, plume tail),
`moonBunny` (upright long ears, pom tail, compact), `mossDeer` (leaf ears, antlers, long legs, snout), `cubBear`
(round ears, stout, stub tail), `meadowCat` (triangle ears, thin tail). Tune `build` and palette so the cast is
this story's own; two characters in one film must differ in silhouette, not only colour.

**Certified body plan (`plush`) — what this rig is good at:** flat-faced, round-headed small creatures — cats,
kittens, bunnies, bear cubs, hamsters, owl-like round birds. All `plush` kinematics, 120Hz springs, and path tracers
live in Layer 1 `engine/critter2d.js`, while `styles/twilight-fable/kernel.js` provides Layer 2 optical &
material shading (`MATERIAL_ROLES`: `spirit`, `fur`, `hard`).

**Not certified yet:** long-snouted, long-legged animals (deer, horse, fox with a real snout). The plush rig turns
them into cotton-ball bodies with stilt legs and bolted-on muzzles. Until a `sleek` body plan ships in
`engine/critter2d.js`, use such animals only as **`spirit` apparitions at medium/far framing**
(`materials: { body: 'spirit' }`, `muzzle ≤ 0.3`, subject height ≤ 30 % of frame), never as a close-up face, or leave them out.

**Ears — two classes (`CRITTER_EAR_TYPES`):** *contour* ears (`tri` cat, `round` bear) are part of the head
silhouette, defined in head-radius units, so they keep cat/bear proportions at any `headR` (`earLen` = apex height,
`earWidth` = root spread; choreographed `earAngleL/R` swings twist them, e.g. flattened "airplane" ears). *Chain*
ears (`long`, `leaf`) are 3-segment spring ribbons for ears that swing; their length is also in head units.
The `meadowCat` preset carries plush-kitten proportions (big round head, compact body, short legs, flat face).

**Form roles — `hero` vs `world`:** only the film's protagonist (or its own kind)
uses the plush rig above. Every other creature is a `world` form drawn by `drawProfileQuadruped` (or an original
profile primitive like a fish): real proportions, silhouette first, small almond eyes, shown in profile / far 3q,
never a cute face close-up. All `world` quadruped profiles and pose generators reside in `engine/critter2d.js`.

```js
drawProfileQuadruped(ctx, {
  kind: 'deer' | 'horse' | 'fox' | 'wolf' | 'bear', profile: { /* override axes or proportions */ },
  x, groundY, pxPerM /* real-size shot: one value per depth plane */ | size /* px per body unit */, facing: ±1,
  pose: { gait /* stride phase */, stride /* 0 stand … 0.5 walk/trot */, graze, lift, nod, breathe },
  materials: { body: 'spirit' | 'fur', horn }, colors: { dark, mid, far, horn, eye, markDark, markPale }, alpha,
  ambient: { level, color } /* sky light, default dusk 0.45 */, haze: { color, amount } /* aerial perspective */,
}, lights);
```

**Light rules for `world` forms (kernel-enforced):**
- *Received light:* a non-emissive body is exposed at `ambient.level` + the scene lights that reach it. Fur far from
  every light is dim at dusk, so a ginger fox on a dark bank does not read as a sticker. `spirit` ignores this.
- *Core shadow:* every part (each leg, the neck, the tail) darkens on the edge turned away from the key light
  (blended with sky-from-above), so thin parts read as volumes. Generic option `coreShade` of `drawLitOrganicShape`.
- *Aerial perspective:* give far creatures `haze: { color: <the air in front of what they stand on>, amount }` and
  put them in the same `drawSoftLayer` as their ground. Haze toward a bright mist only when they stand against it.
- *Layers:* the tail is its own lit layer over the haunch; standing far legs step off the near legs so all four read.

Geometry comes from `engine/critter2d.js`. A species is a **combination of body-plan axes**, not a
drawing: `stance` (unguligrade hoof · digitigrade paw · plantigrade sole), `skull` (grazer · canid · ursid),
`trunk` (barrel · tucked · heavy), `coat` (sleek · short · plush · shaggy — silhouette tufts, how much muscle
shows), `tail` (flag · brush · hair · stub), `gait` (walk · trot), `markings` by landmark (stockings, bib, chin,
rump, tailTip, earBacks, blaze, mane, saddle, nose) and `withersM` (real shoulder height). A new animal = a new
combination plus proportions in `PROFILE_SPECIES`; if it cannot be expressed, add an axis value — never a
per-species branch. Use `pxPerM` whenever two species share a shot, so their relative size is real.

**Views:** `side` = profile (one eye, snout along `facing`); `3q` = three-quarter (default); `front` = frontal,
foreshortened body, legs spread; `back` = rear (no face, tail over the body) for over-the-shoulder shots.

`createTwilightCritter({ x, groundY, scale, species, build, view, facing })` gives `restPose(t)` as a neutral
starting intent and `simulate(t, choreo?)`. `x` and `groundY` are required.

---

## 6. 2D Camera Grammar & Native Moves (`镜头语法与原生手法`)

### 6a. Camera Modes (`Flat Stage vs 2.5D Multi-Plane Depth Vista`)
A scene follows **one composition = one single-direction move** (`engine/studio2d.js`). Never cut inside a scene; never zoom the canvas to fake shot sizes.

1. **Mode A · Single-Plane / Flat Stage (`flat`)**:
   - Moves: `static | push | pull | pan | track | rise | crane | drop | drift`.
2. **Mode B · 2.5D Multi-Plane Depth Vista & Winding Depth Traversal (`depth` / `multiplane`)**:
   - **2.5D Depth Moves**:
     - `depth-push`: Stronger 2.5D dolly into vanishing goal `[vanishX, vanishY]`. Scaled by layer `parallax`, so foreground opens outward at 1.15x while mid ridges slide past at 1.06x and the distant horizon beacon holds steady at 1.02x!
     - `depth-pull`: Reverse 2.5D dolly out of vanishing goal.
     - `depth-crane`: Camera rises/drops over foreground promontory to reveal the distant beacon behind layered hills.
     - `depth-pan`: Lateral parallax sweep across depth planes.
     - Combinable with `+`, e.g. `move: 'depth-push+depth-crane'`.
     - `sceneMoveSpec.vanish = [vx, vy]` (default `[designWidth * 0.5, designHeight * 0.42]`).
   - **Traversal & Occlusion Pipeline**:
     - `evalDepthTraversal(t, waypoints)`: Models character travelling across depth planes with natural occlusion disappearance (`exitHideY`) behind nearer ridge lines and foreground re-emergence (`enterHideY`).
     - `renderDepthPlanes(ctx, studio, planes, { drawSoftLayer })`: Back-to-front layer rendering (`parallax` ascending) with automatic optical defocus (`softness`), per-plane actors, and physical occlusion ordering.

Shot size comes from **re-composing** the artwork. Judge by the protagonist's on-screen height
(measure your creature: its height grows with `scale`, `legLen`, `headR`, `earLen`):

| Framing | Protagonist height / frame height | Place |
|---|---|---|
| wide | ≤ 25 % | the place reads first |
| full | 35–55 % | whole body + immediate surroundings |
| medium | 55–80 % (may crop legs) | action and gesture |
| close | head ≥ 30 % | eyes, ears, paws, the touched object |
| extreme-close | detail fills frame | a dewdrop, a seed, an eye highlight, the product |

**Native-move grammar** — invent ONE per story from these principles (do not reuse the showcase's):

- *Light hand-off* — a light source passes its glow to another object/character; rims change colour live.
- *Scale reveal* — something small in one composition becomes the world of the next.
- *View turn* — `back` → `3q`/`front` across scenes to reveal a face or a feeling.
- *Focus breath* — foreground bokeh swells to bridge a look change (`data-look-blend`).
- *Surface mirror* — only when the place has water or glass: the reflection carries the turn.
- *Weather / particle state change* — fog lifts, pollen falls, fireflies gather, snow starts.
- *Silhouette against light* — the subject read purely as a rim-lit shape against a window, moon or shaft.

---

## 7. Output & Verification (`输出与校验`)

- [ ] `<work-dir>/<style-id>/<product-slug>-v<N>/TREATMENT.md` written **before** code (incl. both anti-cliché tables).
- [ ] Topic files live in `<work-dir>/<style-id>/<product-slug>-v<N>/` (`TREATMENT.md`, `<product-slug>-world.js`, `<product-slug>-scenes.html`,
      `<product-slug>_storyboard.jpg`, `<product-slug>.mp4`).
- [ ] `node tools/audit.mjs --style twilight-fable --world <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-world.js --content <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-scenes.html --all-sizes`
      → 0 issues (includes kernel contract errors and the originality scan).
- [ ] `node tools/render.mjs --style twilight-fable --world … --content … --storyboard <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>_storyboard.jpg`
      → inspect every frame yourself.
- [ ] `python3 tools/lookcheck.py --style twilight-fable --world … --content …`
      → readability floors OK **and** `ORIGINALITY: OK` (no CLONE vs showcase or other topics).
