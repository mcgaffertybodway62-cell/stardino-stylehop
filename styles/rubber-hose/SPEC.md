# 1930s Rubber-Hose Cartoon · 复古橡皮管 (`styles/rubber-hose`)

> **1930s Fleischer / UB Iwerks / Silly Symphonies Celluloid & 3-Strip Technicolor Stage (`132 BPM 万物弹簧律动 · 无关节面条四肢 · 扇形缺口眼 · 特艺三色彩环`)**:
> Hand-inked Gillott dip-pen contours boiling at 12fps over warm aged celluloid paper (`#EFE6D2`), Ben-Day halftone dot shading, jointless S/C-curve rubber-hose limbs with 4-finger white gloves and bulbous shoes, anthropomorphic brass instruments, and expanding 3-Strip Technicolor soundwave rings.

---

## 1. Essence, and What It Is Not (`橡皮管本质与反贴纸铁律`)

1. **132 BPM Universal Swing Bounce (`万物同频摇摆`)**:
   - In 1930s rubber-hose animation, **nothing is ever static**: characters, wooden cabinets, upright basses, microphones, piano keys, and even the theater curtains dip and rebound in sync with `evalSwingBounce(t, 132)`.
2. **Jointless S/C-Curve Noodle Limbs & Pie-Cut Eyes (`无折角面条四肢与扇形缺口眼`)**:
   - Arms and legs are drawn with `drawRubberHoseLimb(ctx, p0, p1, opts)`—continuous, kink-free black India-ink tubes that bend into C-curves and S-waves, terminating in 4-finger white gloves (`drawCartoonGlove`) and bulbous shoes (`drawCartoonShoe`).
   - Eyes use authentic 1930s **Pie-Cut wedge pupils (`drawPieCutEyes`)** that morph into angry slant-brows (`'angry'`), wide-eyed surprise (`'shock'`), or spinning `X X` dizzy eyes (`'dizzy'`) with orbiting stars on impact.
3. **What It Is NOT (`严禁做成固定贴纸拼贴画`)**:
   - **Never treat `kernel.js` as a fixed sticker pack.** Compose each scene's geometry, perspective spline (`evalElasticRibbonSpline` / `drawElasticKeyboardRoad`), character scale (`wide / close / medium / full`), and camera angle (`view: 'side' | 'front' | 'back'`) specifically for the user's story.
   - **Zero Gallery Mascot Rule**: External gallery mascots are strictly forbidden in `styles/rubber-hose/` code, comments, or visuals; all characters must be authentic 1930s rubber-hose band performers or anthropomorphic instruments.

---

## 2. Directing Workflow: Treatment First, Code Later (`先写导演阐述 TREATMENT.md，后写代码`)

Before writing `<work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-world.js` or reading `styles/rubber-hose/world.js`:

1. **Write `<work-dir>/<style-id>/<product-slug>-v<N>/TREATMENT.md` First**:
   - **Three Candidate Structures**: Propose 3 distinct narrative/visual structures tailored to the user's topic (e.g., *Inanimate workshop awakening at midnight*, *A culinary assembly line bouncing to 132 BPM swing*, *A brass duel between two rival inventions*, *Macro-to-wide Rube Goldberg musical chain reaction*), then select the strongest one and explain why.
   - **Logline & Emotional Arc**: One sentence (`One subject, one goal, one turn`: setup → turn → ending).
   - **One Native Move**: Pick or invent one transition/climax that *only* 1930s rubber-hose animation can do (see §6 below) and place it at the emotional peak.
   - **Shot-by-Shot Table**: For every scene, specify framing (`wide / full / medium / close / extreme-close`), character/prop scale & view (`side / front / back`), single-direction camera move, duration (`>= 1.5s`), and **why** it is composed that way.
2. **Anti-Cliché 6-Dimension Self-Check**:
   - Compare your `TREATMENT.md` against the default showcase (`styles/rubber-hose/world.js`) across 6 dimensions: **Structure, Opening, Signature Shot, Camera Path, Look Progression, Ending**.
   - **At least 4 of the 6 dimensions MUST differ.**

---

## 3. Palette & Five Theatrical Look Presets (`色板与 5 套胶片光色预设`)

### Core Palette (`RUBBER_PALETTE`)
- **Sepia & India Ink**: `inkBlack` (`#1E1A17`), `sepiaDark` (`#3D3226`), `sepiaMid` (`#8C7A66`), `sepiaLight` (`#D2C4AC`), `agedPaper` (`#EFE6D2`), `paperCream` (`#FAF4E6`), `ivoryKey` (`#F6EFE0`).
- **Stage Brass, Wood & Velvet**: `brassGold` (`#E0B852`), `brassBright` (`#F7DC78`), `brassDark` (`#7A5C29`), `mahogany` (`#613020`), `velvetCrimson` (`#6E2428`).
- **3-Strip Technicolor Accents**: `tcBlue` (`#4285F4`), `tcViolet` (`#8B5CF6`), `tcCoral` (`#E05A64`), `tcGold` (`#FBBF24`), `tcCyan` (`#38BDF8`), `tcMint` (`#34D399`).

### Per-Scene Look Presets (`scenes.html -> data-look`)
All presets are calibrated so `tools/lookcheck.py` readability floors (`L in [35, 92]`, `p95 >= 55`, `contrast >= 7`, `range >= 18`) pass cleanly:
- `sepia` (alias `day`): Warm aged celluloid paper (`#FAF3E4 -> #D6C5A8`), sepia floorboards, warm cream spotlights.
- `vaudeville` (alias `dusk`): Amber vaudeville footlights, crimson velvet curtains, golden brass highlights.
- `technicolor` (alias `golden`): Full 3-Strip Technicolor bloom with chromatic highlights and lavender-gold stage bounce.
- `talkie` (alias `night`): Midnight Broadway revue (`#90A5C0 -> #5A708E`), bright conical spotlights (`spotAlpha: 0.58`) keeping mean lightness `L >= 48`.
- `matinee` (alias `indoor`): Crisp silver-screen afternoon matinee (`#FCF8EE -> #DDD0B8`).

---

## 4. Four-Tier Generative Primitives (`styles/rubber-hose/kernel.js`)

1. **Tier 1 · Rhythm & Elastic Physics (`evalSwingBounce`, `evalVolumeSquash`, `evalRubberWave`, `evalHopParabola`)**:
   ```js
   const swing = evalSwingBounce(t, 132, phaseOffset);
   // swing -> { beatPhase, bounce, squashY, squashX, footTap, sway }
   const hop = evalHopParabola(u, x0, y0, x1, y1, 130);
   ```
2. **Tier 2 · Dip-Pen Line Boil, Ben-Day Dots, Noodle Limbs & 1930s Expressions**:
   ```js
   // 12fps hand-drawn dip-pen stroke with double-ink rim:
   drawDipPenStroke(ctx, pts, { width: 5.5, profile: 'swell', doubleInk: true, boilAmp: 0.9, t });
   // Closed cel contour with Ben-Day halftone shading dots & specular gloss:
   drawInkCelShape(ctx, polyPts, { fill: RUBBER_PALETTE.tcCoral, benDay: true, dotSpacing: 8 });
   // Jointless S/C-curve rubber-hose limb + 4-finger white glove + bulbous shoe:
   drawRubberHoseLimb(ctx, [shX, shY], [wrX, wrY], { bend: -0.35, sCurve: 0.2, width: 12 });
   drawCartoonGlove(ctx, wrX, wrY, { rot: 0.2, pose: 'point', scale: 0.85 });
   drawCartoonShoe(ctx, ankX, ankY, { scale: 0.9, tapAngle: swing.footTap });
   // Pie-cut eyes, mouth, Technicolor soundwave rings & comic bursts:
   drawPieCutEyes(ctx, x, y, { mode: 'pie', radius: 14, lookX: 0.35, t });
   drawCartoonMouth(ctx, x, y + 22, { mode: 'sing', width: 26, height: 16, t });
   drawTechnicolorRing(ctx, cx, cy, radius, { alpha: 0.9 });
   drawComicBurst(ctx, x, y, 115, { scale: flash, label: 'CLANG!' });
   ```
3. **Tier 3 · Celluloid Stage, Elastic Piano Road & Anthropomorphic Kit**:
   - `drawCelluloidBackdrop(ctx, w, h, lookState, camOffset, frame)`
   - `drawTheaterCurtains(ctx, w, h, { openProg, bounceDy, look })`
   - `draw35mmSprocketOverlay(ctx, w, h, { t })`, `draw35mmCountdown(ctx, w, h, num, alpha)`, `drawIrisTransition(ctx, w, h, cx, cy, radius)`
   - `drawElasticKeyboardRoad(ctx, controlPts, { numKeys, keyWidth, contacts, rings, waveAmp, t })`
   - `drawAnthropomorphicGramophone(ctx, cx, cy, { scale, eyeMode, arm1Pose, arm2Pose, spitBlast, vortexStrength, impactFlash, t })`
   - `drawAnthropomorphicInstrument(ctx, cx, cy, { kind: 'contrabass' | 'microphone' | 'saxophone', scale, t })`
   - `drawNoteCritter(ctx, cx, cy, { state: 'walk' | 'airborne' | 'squashed', scale, t })`
   - `drawJazzNoteStream(ctx, x0, y0, x1, y1, t, { count, rings, vortex, technicolor })`
   - `drawSpinningVinyl(ctx, cx, cy, r, rot, opts)`

---

## 5. Multi-View Character Puppet (`engine/puppet2d.js` + `createRubberHoseCharacter`)

`createRubberHoseCharacter` wraps [`engine/puppet2d.js`](../../engine/puppet2d.js) with jointless rubber-hose limbs, 4-finger white gloves, bulbous shoes, Ben-Day halftone trousers/dresses, and Pie-Cut cartoon heads:

```js
const leader = createRubberHoseCharacter({
  archetype: 'jazzcat',     // 'jazzcat' | 'bandleader' | 'flapper' | 'mouse' | 'dog' | 'tinbot'
  view: 'side',             // 'side' | 'front' | 'back'
  x: 520, y: 760, scale: 1.15, facing: 1,
  hat: 'bowler',            // 'bowler' | 'topHat' | 'feather' | 'strawHat' | 'none'
  heldProp: 'trumpet',      // 'trumpet' | 'saxophone' | 'baton' | 'microphone' | 'cane' | 'mallet' | 'none'
  pantsColor: RUBBER_PALETTE.paperCream,
  accentColor: RUBBER_PALETTE.tcGold,
});
```

Use `leader.act(localT, actions)` with built-in verbs (`walk`, `hop`, `wave`, `bow`, `mood`, `view`) or custom keyframed postures (`{ do: 'pose', hold: true, joints: { spineAngle, headAngle, shRAng, elRAng, thighLAng, thighRAng } }`).

---

## 6. 2D Camera Grammar (`engine/studio2d.js`) & Native Moves

### Core 2D Law: One Scene = One Composition, One Scene = One Continuous Move (`一幕一构图 · 一场一单向微镜`)
Built on [`engine/studio2d.js`](../../engine/studio2d.js):
1. **Canvas optical baseline is locked to `1.0x` full-frame**: Never zoom the 2D canvas in and out inside a single scene (`呼吸风箱效应`).
2. **Change shot size across scenes by re-composing the artwork**:
   - For a `wide` establishing stage, draw characters at `scale: 0.90–0.96`.
   - For a `close` brass duel, re-compose the scene with characters/horns at `scale: 1.30–1.55`!
   - For a `medium` action beat or `full` ensemble finale, adjust `scale`, `view: 'front' | 'side' | 'back'`, and spline layout.
3. **One Single-Direction Camera Move Per Scene**:
   ```js
   const director = studio.director({
     shots: {
       'act1-curtain-up':       { size: 'wide',   move: 'push',  amount: 0.45, subject: 'broadwayStage' },
       'act2-horn-duel':        { size: 'close',  move: 'pan',   amount: 0.50, subject: 'hornDuelClose' },
       'act3-technicolor-keys': { size: 'medium', move: 'track', amount: 0.50, subject: 'technicolorKeys' },
       'act4-vortex-iris':      { size: 'full',   move: 'pull',  amount: 0.45, subject: 'vortexFinale' },
     },
   });
   ```

### Six Native Rubber-Hose Moves (`媒介原生高潮手法`)
1. **132 BPM Everything Bounces (`万物同频摇摆`)**: Every character, prop, building, and curtain bounces in phase via `evalSwingBounce(t, 132)`.
2. **Technicolor Soundwave Bloom (`特艺彩环破墨`)**: Expanding concentric `drawTechnicolorRing` waves convert sepia objects and black notes into vivid 3-Strip Technicolor (`tcBlue`, `tcViolet`, `tcCoral`, `tcGold`).
3. **Spline Road Trampoline (`琴键/道路流体化`)**: The ground (`drawElasticKeyboardRoad`) undulates like a wave and physically dips (`contacts`) with spring vibration ticks under every footstep or impact.
4. **Inanimate Awakening (`器物觉醒拟人`)**: Everyday objects or instruments (`drawAnthropomorphicGramophone`, `drawAnthropomorphicInstrument`) sprout Pie-Cut eyes, 4-finger white gloves, and tapping shoes.
5. **Noodle Stretch & Squash Pancake (`橡皮管无限拉伸与踩扁墨饼`)**: Characters stretch into exaggerated S-arcs or stomp obstacles into flat `X X`-eyed ink pancakes (`drawNoteCritter(..., { state: 'squashed' })`) bursting with parabolic stars.
6. **Logarithmic Vortex & Circular Iris-Out (`黄金螺旋旋涡与经典黑幕收尾`)**: A horn or portal spins up a golden logarithmic vortex (`vortexStrength`), culminating in a classic 1930s circular black `drawIrisTransition` closing onto the hero's wink or hat-tip (timed strictly after `0.80 * scene.dur` so contact-sheet & storyboard stills remain bright).

---

## 7. Output Directory & Verification Checklist
- [ ] Write `<work-dir>/<style-id>/<product-slug>-v<N>/TREATMENT.md` **before** coding `<work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-world.js` (3 candidate structures → chosen structure, native move, shot list, and 6-dimension diff check against demo).
- [ ] All topic files live in `<work-dir>/<style-id>/<product-slug>-v<N>/` (`TREATMENT.md`, `<product-slug>-world.js`, `<product-slug>-scenes.html`, `<product-slug>_storyboard.jpg`, `<product-slug>.mp4`).
- [ ] `node tools/audit.mjs --style rubber-hose --world <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-world.js --content <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-scenes.html --all-sizes` passes with **0 issues**.
- [ ] `node tools/render.mjs --style rubber-hose --world <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-world.js --content <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-scenes.html --storyboard <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>_storyboard.jpg` prints **0 warnings** and shows distinct shot sizes & compositions across scenes.
- [ ] `python3 tools/lookcheck.py --style rubber-hose --world <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-world.js --content <work-dir>/<style-id>/<product-slug>-v<N>/<product-slug>-scenes.html` passes all `READABILITY` floors (`L in [35, 92]`, `p95 >= 55`, `contrast >= 7`, `range >= 18`).
