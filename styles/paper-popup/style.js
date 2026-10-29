export default {
  id: 'paper-popup',
  name: 'Paper Pop-Up Book',
  zh: '3D 纸雕立体书',
  description:
    'Die-cut cardstock pop-up book, faceted origami craft & backlit washi lantern 3D cinema style. Separates its reusable paper-engineering/origami kernel (`./kernel.js`) from any story-specific 3D world (`./world.js`) and renders a pure, unobstructed 3D stage by default.',
  stageMode: '3d-pure',
  defaultOverlay: 'none',
  kernel: './kernel.js',
  world: './world.js',
  soundPreset: 'paper',
  bestFor: [
    '绘本故事 / 奇幻童话 / 节庆祝福 / 东方与世界民间故事',
    '折纸手作 / 文创礼盒 / 立体书机关 / 展览导览与建筑漫游',
    '文旅宣传 / 古镇灯会 / 城市地标巡礼 / 品牌故事短片',
  ],
  avoidFor: [
    '高密度金融K线报表',
    '纯命令行代码终端演示',
  ],
  cameraPresets: [
    'panorama',
    'craneReveal',
    'tabletopOrbit',
    'macroPush',
    'streetTrack',
    'finaleOrbit',
  ],
  passes: [
    ['grain', { amount: 0.016, paper: 0.0, vignette: 0.16, warm: 0.0 }],
  ],
  look: {},
  layers: { tilt: 0.16, lift: 28, shadow: 0.38 },
};
