# Paper Pop-Up Book · 3D 纸雕立体书与折纸奇境 (`styles/paper-popup`)

## 1. Visual Essence & Architectural Layering (`kernel.js` vs `world.js`)

**Paper Pop-Up Book (`paper-popup`)** is a **Rule-Based 3D Kirigami Pop-Up Book & Crease-Folded Origami Cinema Style** (`stageMode: '3d-pure'`, `defaultOverlay: 'none'`). It is built around a sculptural **3D hardcover pop-up book lying flat on a warm studio tabletop**, combining **rule-based kirigami contour cards with negative-space window cutouts (`paperProfileFn`, `createKirigamiCard`)**, **symmetric spine V-fold pop-up mechanisms (`createVFoldMechanism`)**, **multi-ring crease-hinged blooming origami meshes (`createOrigamiCreaseMesh` / `createOrigamiLotus`)**, **openwork laser-cut celestial arches (`createKirigamiMoonArch`)**, **crease-folded planar origami fauna (`createOrigamiCrane`, `createOrigamiButterfly`, `createOrigamiFox`, `createPaperBoat`)**, and **curving 180° book-page turns (`createPopUpBookBase`)**.

### Strict Architectural Separation: Style Kernel vs. Story World
1. **`styles/paper-popup/kernel.js` (Reusable Rule-Based Generative Kernel — ALWAYS Import)**:
   - Analogous to `styles/ink-wash/kernel.js` lines 3600–4159, `kernel.js` provides **rule-based generative paper-engineering & origami primitives** rather than fixed showcase sticker props:
     - **1D Contour & Silhouette Generator**: `paperProfileFn(peaks, baseH, seed, rough, mode)` (`'mountain' | 'wave' | 'cloud' | 'terraced'`).
     - **Kirigami Negative-Space Window Card**: `createKirigamiCard(makeCardstockMat, { width, profileFn, peaks, mode, cutouts, color, rimColor })` with `shape.holes` cutouts (`'circle' | 'arch' | 'diamond' | 'slit'`) and non-penetrating `setFold(u)`.
     - **Symmetric Spine V-Fold Mechanism**: `createVFoldMechanism(makeCardstockMat, { wingSpan, height, spineAngle, peaks, cutouts, color, accentColor })`.
     - **Radial Crease-Hinged Blooming Origami Mesh**: `createOrigamiCreaseMesh` / `createOrigamiLotus(makeCardstockMat, { petals, layers, radius, height })` with `setBloom(u)` and `setFold(u)`.
     - **Openwork Kirigami Crescent Moon & Astrolabe Arch**: `createKirigamiMoonArch(makeCardstockMat, { outerR, innerR, archColor, moonColor, foilColor })`.
     - **Tabletop 3D Pop-Up Book Base**: `createPopUpBookBase(makeCardstockMat, { coverWidth, coverDepth, spreadCount })` with burgundy cloth cover, gold-foil corner plates, stepped cream deckle page stack, and a parabolic-curving 180° turning page (`flippingPagePivot`).
     - **Set-Dressing & Crease-Folded Origami Fauna**: `buildPaperGround`, `buildPaperWater`, `buildPaperPath`, `createOrigamiCrane`, `createOrigamiButterfly`, `createOrigamiFox`, `createPaperBoat`, `createAccordionPleat`, `createPopupVFoldBuilding`, `createPaperGearWheel`.
2. **`styles/paper-popup/world.js` (Default Showcase Story — Replace or Override via `--world` for New Topics)**:
   - Contains the default 2-spread, 4-scene showcase story (*《春涧折莲与星夜镂空月：桌上的立体书》 / Spring Origami Lotus & Starlight Kirigami Moon*, 14.8s, 1 mid-film 180° page turn at `t = 7.4s`):
     - **Spread A · Scene 01 (`spring-valley-unfold`, 3.6s, `day`)**: Whole open pop-up book on the studio tabletop unfolds Spread A — celadon kirigami ridge with circular/arch cutouts (`z = -4.2`), coral V-fold canyon wings (`z = -1.9`), octagonal lily-pad & origami lotus bud (`z = +0.4`), scalloped mint stream (`z = +2.3`), and gliding origami cranes.
     - **Spread A · Scene 02 (`origami-lotus-bloom`, 3.8s, `golden`)**: Camera glides closer on Spread A as the 3-ring crease-folded Origami Lotus blooms petal by petal and releases 3 gold-foil origami butterflies, then pulls back as Spread A folds flat (`localT = 2.82..3.80s`) for the page turn.
     - **Spread B · Scene 03 (`page-turn-moon-arch`, 3.8s, `dusk`)**: Smooth 180° curving page turn from Spread A to Spread B (`localT = 0.0..1.45s`), popping up the twilight kirigami cloud card (`z = -3.9`), openwork Kirigami Crescent Moon & Astrolabe Arch (`z = -1.7`), indigo V-fold water-gate wings (`z = +0.3`), and foreground starlight stream (`z = +2.1`).
     - **Spread B · Scene 04 (`starlight-boat-finale`, 3.6s, `night`)**: Backlit Kirigami Crescent Moon Arch and gold-foil astrolabe wheel glow warmly as the luminous Origami Paper Boat sails across the open book page.
3. **Three Core Laws of the Tabletop Pop-Up Book Theater (`立体书箱庭剧场三大铁律`)**:
   - **Law 1 — Zero Humanoid `puppet.js` Characters**: Never import `engine/puppet.js` or use ball-jointed humanoid dolls with cartoon eyes/mouths. Life is expressed solely through crease-folded planar origami fauna and kinetic paper mechanisms.
   - **Law 2 — Clearly Visible Tabletop Book & Generous Negative Space (`>= 45%` Breathing Room)**: Never place a giant vertical wall behind the book that hides the tabletop, and never cram more than 4 elements onto a spread. Enforce `Z-spacing >= 1.8` units between card layers so nothing ever clips or interpenetrates.
   - **Law 3 — Continuous Book Camera & Unhurried Page Turn (`一页一世界 · 翻页即转场 · 呼吸推拉零硬切`)**: Drive the camera via `studio.bookDirector(...)` with zero multi-camera hard cuts. Perform only 1–2 narratively motivated 180° page turns per 15s film, always folding the outgoing spread flat onto the page before the curving page leaf sweeps across the spine.

---

## 2. Best-Fit Topics & Selection Routing (`style.js` & `gallery/catalog.js`)

- **`bestFor`**:
  - 绘本故事 / 奇幻童话 / 节庆祝福 / 东方与世界民间故事 (Picture-book stories, fairy tales, festive greetings, folklore)
  - 折纸手作 / 文创礼盒 / 立体书机关 / 展览导览与建筑漫游 (Origami craft, cultural gift boxes, pop-up mechanisms, architectural tours)
  - 文旅宣传 / 古镇灯会 / 城市地标巡礼 / 品牌故事短片 (Cultural tourism, lantern festivals, city landmarks, brand stories)
- **`avoidFor`**:
  - 高密度金融K线报表 (High-density financial charts)
  - 纯命令行代码终端演示 (Terminal / code-heavy dashboards)

---

## 3. Rule-Based Generative Primitives Quick Reference (`kernel.js`)

```js
// 1. Tabletop 3D Pop-Up Book Base (2 spreads, curving 180° page turn leaf)
const bookBase = createPopUpBookBase(makeCardstockMat, { coverWidth: 21.0, coverDepth: 13.2, spreadCount: 2 });
bookBase.addLayer(0, myKirigamiCard);
bookBase.setPageTurn(turnProgress, activeSpreadIdx, foldProgress, nextSpreadIdx);

// 2. 1D Contour Generator + Kirigami Negative-Space Window Card (`shape.holes`)
const ridge = createKirigamiCard(makeCardstockMat, {
  width: 16.6,
  baseHeight: 1.85,
  peaks: [[-4.8, 1.35, 2.7], [4.8, 1.48, 2.8]],
  mode: 'mountain', // 'mountain' | 'wave' | 'cloud' | 'terraced'
  cutouts: [
    { x: -4.8, y: 1.45, r: 0.58, kind: 'circle' },
    { x: 0.0, y: 0.55, w: 0.95, h: 1.35, kind: 'arch' },
  ],
  color: PAPER_PALETTE.celadonTeal,
  rimColor: PAPER_PALETTE.foilGold,
  y: bookBase.pageY,
  z: -4.2,
});

// 3. Symmetric Spine V-Fold Pop-Up Wings
const vWings = createVFoldMechanism(makeCardstockMat, {
  wingSpan: 6.2,
  height: 1.95,
  spineAngle: 0.26,
  cutouts: [{ x: 2.9, y: 1.05, rx: 0.38, ry: 0.52, kind: 'diamond' }],
  color: PAPER_PALETTE.ridgeCoral,
  accentColor: PAPER_PALETTE.canyonAmber,
  y: bookBase.pageY,
  z: -1.9,
});

// 4. Multi-Ring Crease-Hinged Blooming Origami Lotus
const lotus = createOrigamiLotus(makeCardstockMat, { petals: 8, layers: 3, radius: 1.65, height: 1.18 });
lotus.setBloom(bloomProgress);

// 5. Openwork Kirigami Crescent Moon & Celestial Astrolabe Arch
const moonArch = createKirigamiMoonArch(makeCardstockMat, { outerR: 3.1, innerR: 1.98, y: bookBase.pageY, z: -1.7 });
moonArch.update(t, glowLevel);
```
