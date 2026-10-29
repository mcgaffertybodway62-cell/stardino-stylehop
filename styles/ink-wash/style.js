export default {
  id: 'ink-wash',
  name: 'Ink Wash Scroll',
  zh: '水墨丹青',
  description:
    'Song-Dynasty raw Xuan-paper ink-wash & mineral-pigment handscroll style (`计白当黑 · 墨分五色 · 青绿设色`). Separates its reusable 2D/2.5D calligraphic brush, wet-ink wash, cun-fa texture, multi-plane atmosphere, character puppet, and shot-list director kernel (`./kernel.js`) from any story-specific scroll world (`./world.js`).',
  stageMode: '3d-pure',
  defaultOverlay: 'none',
  kernel: './kernel.js',
  world: './world.js',
  soundPreset: 'ink',
  paperTexture: '../assets/textures/paper_fiber.png',
  bestFor: [
    '国风意境 / 古诗词可视化 / 山水画卷 / 东方美学叙事',
    '茶道咖啡 / 瓷器非遗 / 传统手作工艺 / 节气文化与东方好物',
    '武侠江湖 / 文人雅集 / 神话寓言 / 历史人物故事短片',
    '水墨花鸟 / 仙鹤锦鲤 / 哲理禅意 / 书法挥毫与解谜小剧场',
  ],
  avoidFor: [
    '高密度现代金融K线与财务报表',
    '赛博朋克霓虹代码终端演示',
  ],
  cameraPresets: [
    'macroPush',
    'widePull',
    'craneReveal',
    'lateralTrack',
    'finaleOrbit',
    'vertigoZoom',
  ],
  // Subtle film & fiber finishing pass; core Xuan-paper fibers and wet-ink halos are rendered
  // in world space inside `kernel.js` so they pan naturally with the camera rather than sticking
  // to the lens like dirty glass.
  passes: [
    ['inkbleed', { bleed: 0.22, fiber: 0.12, desaturate: 0.02, wet: 0.14 }],
    ['grain', { amount: 0.014, paper: 0.02, vignette: 0.16, warm: 0.02 }],
  ],
  look: {},
  layers: { tilt: 0.16, lift: 28, shadow: 0.36 },
};
