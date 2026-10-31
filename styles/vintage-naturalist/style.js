export default {
  id: 'vintage-naturalist',
  name: 'Vintage Naturalist',
  zh: '复古博物学',
  description:
    '19th-century natural-history plate & hardcore science explainer style (`羊皮纸 · 铜版画排线 · 超大字号 · 黄铜机制仪表`). The kernel (`./kernel.js`) is a rule-based etching toolbox: parchment grounds, parameterised hatching/stipple, etched medallions, brass dials / balance scales and a generative tree of life — no fixed specimen stickers. `./world.js` is a 15-second finch-plate sample, not a template.',
  // 2D Canvas illustration + DOM typography overlay. The typography is part of the medium:
  // chapter bar, oversized titles, capsule badges and the subtitle dock.
  stageMode: 'hybrid',
  defaultOverlay: 'typography',
  kernel: './kernel.js',
  world: './world.js',
  soundPreset: 'naturalist',
  paperTexture: '../assets/textures/paper_fiber.png',
  bestFor: [
    '科学史 / 博物学 / 演化与自然选择 / 生物学机制拆解',
    '论文解读 / 顶刊成果 / 实验与证据链 / 辟谣与科学边界',
    '天文地质 / 古生物化石 / 标本档案 / 博物馆与田野笔记',
    '医学与神经科学 / 分子机制 / 工程原理 / 硬核知识科普',
  ],
  avoidFor: [
    '高密度金融K线与财务报表',
    '纯命令行代码终端演示',
    '无旁白的抽象情绪短片 / 纯氛围音乐可视化',
  ],
  cameraPresets: [
    'macroPush',
    'widePull',
    'craneReveal',
    'lateralTrack',
    'finalePull',
  ],
  passes: [
    ['grain', { amount: 0.013, paper: 0.018, vignette: 0.12, warm: 0.03 }],
  ],
  look: {},
  layers: { tilt: 0.1, lift: 18, shadow: 0.24 },
};
