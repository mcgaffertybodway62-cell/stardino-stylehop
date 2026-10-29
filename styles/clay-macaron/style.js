export default {
  id: 'clay-macaron',
  name: 'Clay Macaron',
  zh: '3D 马卡龙',
  description:
    'Sunlit 12fps stop-motion polymer-clay & burnished-brass 3D tabletop cinema style. Separates its reusable physical/material kernel (`./kernel.js`) from any story-specific 3D world (`./world.js`) and renders a pure, unobstructed 3D stage by default.',
  stageMode: '3d-pure',
  defaultOverlay: 'none',
  kernel: './kernel.js',
  world: './world.js',
  soundPreset: 'clay',
  paperTexture: '../assets/textures/clay_thumbprint.png',
  bestFor: [
    '治愈故事 / 绘本童话 / 奇幻微缩世界 / 角色小剧场',
    '甜品烘焙 / 咖啡茶饮 / 节日礼盒开箱 / 生活方式',
    '手作工艺 / 潮玩盲盒 / 机械八音盒 / 趣味物理科普',
  ],
  avoidFor: [
    '高密度金融K线报表',
    '纯命令行代码终端演示',
  ],
  cameraPresets: [
    'macroPush',
    'tabletopOrbit',
    'craneReveal',
    'streetTrack',
    'dollyVertigo',
    'finaleOrbit',
  ],
  // Screen-space passes are lens/film only. Material feel (thumbprint bump) lives on the 3D
  // materials and warmth lives in the light colours (`kernel.js -> CLAY_LOOK`); a screen-space
  // texture here would stay glued to the screen while the camera moves ("dirty glass").
  // Add the `clay` pass back only when DOM cards / title plates are on screen.
  passes: [
    ['grain', { amount: 0.018, paper: 0.0, vignette: 0.18, warm: 0.0 }],
  ],
  // Per-video look overrides, deep-merged over `CLAY_LOOK` (see `engine/look.js`).
  look: {},
  layers: { tilt: 0.18, lift: 32, shadow: 0.42 },
};
