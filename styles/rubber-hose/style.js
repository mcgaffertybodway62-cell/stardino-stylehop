export default {
  id: 'rubber-hose',
  name: '1930s Rubber-Hose Cartoon',
  zh: '复古橡皮管',
  description:
    '1930s Fleischer / UB Iwerks / Silly Symphonies celluloid rubber-hose animation style (`132 BPM 万物弹簧律动 · 无关节面条四肢 · 扇形缺口眼 · 特艺三色彩环`). Separates its rule-based generative dip-pen line boil, Ben-Day halftone, rubber-hose limb solver, anthropomorphic brass instrument kit, and 2D stage kernel (`./kernel.js`) from any story-specific world (`./world.js`).',
  stageMode: '3d-pure',
  defaultOverlay: 'none',
  kernel: './kernel.js',
  world: './world.js',
  soundPreset: 'jazz',
  paperTexture: '../assets/textures/halftone_screen.png',
  bestFor: [
    '爵士音乐 / 摇摆舞曲 / 黑胶唱片 / 复古百老汇舞台短片',
    '1930s 美式复古卡通 / 荒诞喜剧 / 夸张物理弹性小剧场',
    '咖啡烘焙 / 潮玩手作 / 乐器演奏 / 拟人化器物觉醒故事',
    '复古海报 / 老电影胶片开场 / 品牌角色欢快叙事',
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
    'tabletopOrbit',
    'finaleOrbit',
  ],
  passes: [
    ['grain', { amount: 0.02, paper: 0.022, vignette: 0.20, warm: 0.10, animate: 1.0 }],
  ],
  look: {},
  layers: { tilt: 0.14, lift: 24, shadow: 0.34 },
};
