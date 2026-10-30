// StyleHop Studio Catalog & Topic-to-Style Routing Matrix (`gallery/catalog.js`).
// Register each multi-scene style under `styles/<id>/` here so both the live studio
// and AI agents can select the best visual style & camera grammar for any user topic.
export const STYLES = [
  {
    id: 'clay-macaron',
    name: 'Clay Macaron',
    zh: '3D 马卡龙',
    scenes: 4,
    dur: 14.8,
    preset: 'clay',
    stageMode: '3d-pure',
    defaultOverlay: 'none',
    kernel: './kernel.js',
    bestFor: [
      '治愈故事 / 绘本童话 / 奇幻微缩世界',
      '甜品烘焙 / 咖啡茶饮 / 美食料理 / 节日礼盒开箱',
      '手作工艺 / 潮玩盲盒 / 角色小剧场 / 温馨日常',
      '物理机关 / 八音盒 / 多米诺骨牌 / 定格动画短片',
    ],
    avoidFor: [
      '高密度金融K线报表',
      '纯命令行代码终端演示',
    ],
    keywords: [
      '故事', '童话', '绘本', '甜品', '蛋糕', '马卡龙', '咖啡', '茶', '烘焙', '美食',
      '森林', '动物', '小熊', '兔子', '猫', '太空', '探险', '盲盒', '礼盒', '手作',
      '玩具', '八音盒', '微缩', '小镇', '温暖', '治愈', '定格', '黏土', '软陶', '动画',
      'clay', 'story', 'miniature', 'cute', 'cozy', 'stop-motion',
    ],
    cameraPresets: [
      'macroPush',
      'tabletopOrbit',
      'craneReveal',
      'streetTrack',
      'dollyVertigo',
      'finaleOrbit',
    ],
  },
  {
    id: 'ink-wash',
    name: 'Ink Wash Scroll',
    zh: '水墨丹青',
    scenes: 4,
    dur: 14.8,
    preset: 'ink',
    stageMode: '3d-pure',
    defaultOverlay: 'none',
    kernel: './kernel.js',
    bestFor: [
      '国风意境 / 古诗词可视化 / 山水画卷 / 东方美学叙事',
      '茶道咖啡 / 瓷器非遗 / 传统手作工艺 / 节气文化与东方好物',
      '武侠江湖 / 文人雅集 / 神话寓言 / 历史人物故事短片',
      '水墨花鸟 / 仙鹤锦鲤 / 哲理禅意 / 书法挥毫与解谜小剧场',
    ],
    avoidFor: [
      '高密度金融K线报表',
      '纯命令行代码终端演示',
    ],
    keywords: [
      '水墨', '国画', '国风', '丹青', '青绿', '千里江山', '宋代', '宣纸', '毛笔', '书法',
      '挥毫', '山水', '古诗', '诗词', '武侠', '江湖', '剑客', '竹林', '古琴', '抚琴',
      '茶道', '点茶', '煮茶', '泡茶', '龙井', '紫砂', '瓷器', '青花瓷', '汝窑', '非遗',
      '节气', '仙鹤', '白鹭', '锦鲤', '荷花', '墨荷', '梅花', '古亭', '泛舟', '扁舟',
      '印章', '朱砂', '太极', '禅意', '东方', 'ink', 'inkwash', 'calligraphy', 'chinese',
      'scroll', 'shanshui', 'wuxia', 'zen', 'porcelain',
    ],
    cameraPresets: [
      'macroPush',
      'widePull',
      'craneReveal',
      'lateralTrack',
      'finaleOrbit',
      'vertigoZoom',
    ],
  },
  {
    id: 'paper-popup',
    name: 'Paper Pop-Up Book',
    zh: '3D 纸雕立体书',
    scenes: 4,
    dur: 14.8,
    preset: 'paper',
    stageMode: '3d-pure',
    defaultOverlay: 'none',
    kernel: './kernel.js',
    bestFor: [
      '绘本故事 / 奇幻童话 / 节庆祝福 / 东方与世界民间故事',
      '折纸手作 / 文创礼盒 / 立体书机关 / 展览导览与建筑漫游',
      '文旅宣传 / 古镇灯会 / 城市地标巡礼 / 品牌故事短片',
    ],
    avoidFor: [
      '高密度金融K线报表',
      '纯命令行代码终端演示',
    ],
    keywords: [
      '纸雕', '立体书', '折纸', '剪纸', '千纸鹤', '走马灯', '灯笼', '灯会', '元宵', '中秋',
      '春节', '节庆', '翻页', '绘本', '手工', '卡纸', '文创', '古镇', '阁楼', '拱桥',
      '宝塔', 'paper', 'popup', 'origami', 'kirigami', 'lantern', 'crane', 'book',
    ],
    cameraPresets: [
      'panorama',
      'craneReveal',
      'tabletopOrbit',
      'macroPush',
      'streetTrack',
      'finaleOrbit',
    ],
  },
  {
    id: 'rubber-hose',
    name: '1930s Rubber-Hose Cartoon',
    zh: '复古橡皮管',
    scenes: 4,
    dur: 14.8,
    preset: 'jazz',
    stageMode: '3d-pure',
    defaultOverlay: 'none',
    kernel: './kernel.js',
    bestFor: [
      '爵士音乐 / 摇摆舞曲 / 黑胶唱片 / 复古百老汇舞台短片',
      '1930s 美式复古卡通 / 荒诞喜剧 / 夸张物理弹性小剧场',
      '咖啡烘焙 / 潮玩手作 / 乐器演奏 / 拟人化器物觉醒故事',
      '复古海报 / 老电影胶片开场 / 品牌角色欢快叙事',
    ],
    avoidFor: [
      '高密度金融K线报表',
      '纯命令行代码终端演示',
    ],
    keywords: [
      '橡皮管', '复古', '卡通', '爵士', '百老汇', '留声机', '黑胶', '唱片', '钢琴', '萨克斯',
      '小号', '铜管', '乐队', '摇摆', '喜剧', '拟人', '胶片', '老电影', '赛璐璐', '网点',
      '白手套', '大皮鞋', '音符', '老上海', '摩登', '歌舞', '剧院', '默片', '弹簧',
      'rubber', 'rubberhose', 'cartoon', 'jazz', 'swing', 'vintage', '1930s', 'celluloid',
      'gramophone', 'vinyl', 'piano', 'broadway', 'fleischer', 'technicolor', 'vaudeville',
    ],
    cameraPresets: [
      'macroPush',
      'widePull',
      'craneReveal',
      'lateralTrack',
      'tabletopOrbit',
      'finaleOrbit',
    ],
  },
  {
    id: 'twilight-fable',
    name: 'Twilight Bioluminescent Fable',
    zh: '暮光柔焦绘本',
    scenes: 4,
    dur: 14.0,
    preset: 'twilight',
    stageMode: '3d-pure',
    defaultOverlay: 'none',
    kernel: './kernel.js',
    bestFor: [
      '治愈绘本童话 / 奇幻森林冒险 / 萌宠与自然生灵温情故事',
      '星空许愿 / 仲夏夜萤火 / 极光漫游 / 梦境与情绪疗愈短片',
      '香氛精油 / 睡眠助眠 / 茶饮花果 / 温暖灯光与家居美学',
      '音乐MV视觉 / 节气夜游 / 绘本风科普与诗意寓言',
    ],
    avoidFor: [
      '高密度现代金融K线与财务报表',
      '纯命令行代码终端演示',
      '长吻长腿写实动物（鹿/马）的面部特写与主角戏（尚无 sleek 体型；仅可作中远景 spirit 灵影）',
    ],
    keywords: [
      '暮光', '柔焦', '散景', '绘本', '星光', '星空', '萤火', '萤火虫', '蒲公英', '极光',
      '森林', '雾林', '树洞', '暖窗', '浅滩', '溪流', '水波', '倒影', '灵兽', '萌宠',
      '小猫', '小熊', '小狐狸', '耳廓狐', '长耳兔', '小鹿', '蘑菇', '发光', '荧光', '夜空',
      '梦境', '睡眠', '晚安', '助眠', '香氛', '治愈', '唯美', '温暖', '许愿', '星河', '童话',
      'twilight', 'fable', 'bokeh', 'bioluminescent', 'starlight', 'aurora', 'firefly',
      'dandelion', 'dreamy', 'healing', 'storybook', 'lullaby', 'critter', 'kitten', 'bear', 'fox', 'bunny',
    ],
    cameraPresets: [
      'macroPush',
      'widePull',
      'craneReveal',
      'lateralTrack',
      'finaleOrbit',
      'tabletopOrbit',
    ],
  },
];

export const SIZES = [
  { id: '1920x1080', name: '16:9 横屏' },
  { id: '1080x1920', name: '9:16 竖屏' },
  { id: '1080x1080', name: '1:1 方画幅' },
];

/**
 * Recommends the best-matching StyleHop style for a free-form user topic string by scoring
 * each style's `keywords`. Returns null when no style matches at all: check `avoidFor` and tell
 * the user the topic is outside the current styles rather than forcing one.
 */
export function selectStyleForTopic(topic = '') {
  const text = String(topic).toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const s of STYLES) {
    const score = (s.keywords || []).reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}
