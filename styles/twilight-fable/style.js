export default {
  id: 'twilight-fable',
  name: 'Twilight Bioluminescent Fable',
  zh: '暮光柔焦绘本',
  description:
    'Dreamy twilight & bioluminescent picture-book animation style (`大光圈柔焦散景 · 法线双层边缘光 · 120Hz 弹簧骨架生灵 · 可生成的地形/水/室内`). The kernel (`./kernel.js`) is a toolbox with NO default placements: generative places (ground profiles, stones, trunks, canopies, ponds, brooks, windows, light shafts, fog), 8 looks + custom looks, and parametric creatures (species × build × side/3q/front/back views). `./world.js` is one example story, not a template.',
  stageMode: '3d-pure',
  defaultOverlay: 'none',
  kernel: './kernel.js',
  world: './world.js',
  soundPreset: 'twilight',
  paperTexture: null,
  bestFor: [
    '治愈绘本童话 / 奇幻森林冒险 / 萌宠与自然生灵温情故事',
    '星空许愿 / 仲夏夜萤火 / 极光漫游 / 梦境与情绪疗愈短片',
    '香氛精油 / 睡眠助眠 / 茶饮花果 / 温暖灯光与家居美学',
    '音乐MV视觉 / 节气夜游 / 绘本风科普与诗意寓言',
  ],
  avoidFor: [
    '高密度现代金融K线与财务报表',
    '纯命令行代码终端演示',
  ],
  cameraPresets: [
    'macroPush',
    'widePull',
    'craneReveal',
    'lateralTrack',
    'finaleOrbit',
    'tabletopOrbit',
  ],
  passes: [
    ['grain', { amount: 0.008, paper: 0.0, vignette: 0.08, warm: 0.02, animate: 1.0 }],
  ],
  look: {},
  layers: { tilt: 0.14, lift: 24, shadow: 0.28 },
};
