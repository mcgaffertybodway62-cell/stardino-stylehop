export default {
  id: '_template',
  name: 'Style Template',
  zh: '风格模板',
  description: 'Multi-scene starter skeleton for authoring new StyleHop styles (DOM-bento or pure 3D/Canvas stage).',
  // Set `stageMode` to `'3d-pure'` for 3D/Canvas animations (no inspection DOM cards),
  // or `'dom-bento'` for typography/data/HUD card layouts.
  stageMode: 'dom-bento',
  defaultOverlay: 'typography',
  // Optional: when `stageMode === '3d-pure'`, put reusable materials/lighting/physics in `./kernel.js`
  // and story-specific scene assembly in `./world.js`.
  // kernel: './kernel.js',
  // world: './world.js',
  soundPreset: 'glass',
  paperTexture: '../assets/textures/paper_fiber.png',
  bestFor: [
    '在此填写最适合该视觉风格的题材类型（供 AI 自动选型）',
  ],
  avoidFor: [
    '在此填写不适合该视觉风格的题材类型',
  ],
  cameraPresets: [
    'heroEstablish',
    'macroPush',
    'tabletopOrbit',
    'craneReveal',
    'streetTrack',
    'finaleOrbit',
  ],
  passes: [
    ['lens', { radius: 0.18, dispersion: 0.8 }],
    ['grain', { amount: 0.025, paper: 0.03, vignette: 0.25 }],
  ],
  layers: { tilt: 0.2, lift: 36, shadow: 0.45 },
};
