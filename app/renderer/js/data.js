'use strict';

/* ============ 练习数据：课程 / 词库 / 文章 / 中文 / 数字 / 代码 ============ */

var LESSONS = [
  { name: '基准键·左手', keys: 'asdf' },
  { name: '基准键·右手', keys: 'jkl;' },
  { name: '基准键·综合', keys: 'asdfjkl;' },
  { name: '上排·左半', keys: 'qwert' },
  { name: '上排·右半', keys: 'yuiop' },
  { name: '下排·左半', keys: 'zxcvb' },
  { name: '下排·右半', keys: 'nm,./' },
  { name: '数字行', keys: '1234567890' },
  { name: '符号练习', keys: "'-=[];,./" },
  { name: '全键综合', keys: 'abcdefghijklmnopqrstuvwxyz' }
];

var WORDS = ('the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us world life hand part high place great small large own old right big long little next early young important few house school family friend water music book read write speak listen learn teach start begin end open close run walk sit stand turn move play help ask answer question change follow stop keep let seem show hear find tell feel try leave call number point line fact group idea problem side kind head home door table chair light color sound night morning afternoon evening').split(/\s+/).filter(function (v, i, a) { return a.indexOf(v) === i; });

var ARTICLES = [
  'Learning to type is a skill that pays you back every day for the rest of your life. At first, the keys feel strange under your fingers and you may wonder how anyone can type without looking at the keyboard. The secret is simple and rather boring: slow, regular practice. Keep your fingers on the home row, let each finger do its own job, and resist the urge to peek. Speed is not important in the beginning. Accuracy comes first, and speed follows on its own.',
  'The morning sun climbed over the hills and touched the quiet village. Smoke rose slowly from a few chimneys while birds called to one another in the old oak tree. A girl stepped outside with a basket on her arm, breathing the cool air and smiling. Today she would walk to the market across the river, sell the bread her mother had baked, and bring home a small bag of red apples. It was going to be a good day, and she meant to enjoy every step of the road.',
  'A good programmer spends more time reading code than writing it. When you read code carefully, you learn how other people break hard problems into small, clear pieces. You also learn to spot your own mistakes before they grow into bugs. Write code for humans first and for computers second. Give things honest names, keep functions short, and never be afraid to delete code that does not earn its place. Simplicity is not a lack of skill; it is the result of a great deal of careful thought.',
  'Forests cover nearly a third of the land on our planet. They clean the air, hold the soil in place, and give shelter to countless kinds of animals and plants. A single large tree can drink up hundreds of liters of water from the soil and breathe it back into the air. When forests disappear, the land grows dry and the weather becomes harder to predict. Protecting them is not only a task for scientists and governments. Every choice we make about paper, food, and wood can either help or harm the woods we all depend on.',
  'If you want to build a new habit, start absurdly small. Promise yourself just two minutes a day, so small that you cannot reasonably say no. The hard part of a habit is rarely the doing of it; the hard part is starting. Once you begin, momentum carries you further than you planned. Track every repetition on a calendar, because a visible chain of finished days becomes something you hate to break. Be patient with bad days. Missing once is an accident, but missing twice is the start of an entirely new and much worse habit.'
];

var CHINESE = [
  [['今','jīn'],['天','tiān'],['天','tiān'],['气','qì'],['真','zhēn'],['不','bù'],['错','cuò'],['，'],['阳','yáng'],['光','guāng'],['明','míng'],['媚','mèi'],['，'],['微','wēi'],['风','fēng'],['轻','qīng'],['拂','fú'],['。'],['我','wǒ'],['们','men'],['一','yì'],['起','qǐ'],['去','qù'],['公','gōng'],['园','yuán'],['散','sàn'],['步','bù'],['吧','ba'],['，'],['顺','shùn'],['便','biàn'],['活','huó'],['动','dòng'],['一','yí'],['下','xià'],['身','shēn'],['体','tǐ'],['。']],
  [['学','xué'],['习','xí'],['打','dǎ'],['字','zì'],['需','xū'],['要','yào'],['耐','nài'],['心','xīn'],['。'],['刚','gāng'],['开','kāi'],['始','shǐ'],['不','bú'],['要','yào'],['追','zhuī'],['求','qiú'],['速','sù'],['度','dù'],['，'],['先','xiān'],['把','bǎ'],['每','měi'],['个','gè'],['字','zì'],['敲','qiāo'],['对','duì'],['。'],['坚','jiān'],['持','chí'],['每','měi'],['天','tiān'],['练','liàn'],['习','xí'],['，'],['手','shǒu'],['指','zhǐ'],['就','jiù'],['会','huì'],['越','yuè'],['来','lái'],['越','yuè'],['灵','líng'],['活','huó'],['。']],
  [['读','dú'],['书','shū'],['是','shì'],['门','mén'],['槛','kǎn'],['最','zuì'],['低','dī'],['的','de'],['高','gāo'],['贵','guì'],['举','jǔ'],['动','dòng'],['。'],['翻','fān'],['开','kāi'],['一','yì'],['本','běn'],['书','shū'],['，'],['就','jiù'],['像','xiàng'],['和','hé'],['一','yí'],['位','wèi'],['好','hǎo'],['朋','péng'],['友','yǒu'],['交','jiāo'],['谈','tán'],['。'],['你','nǐ'],['读','dú'],['过','guò'],['的','de'],['每','měi'],['一','yì'],['本','běn'],['书','shū'],['，'],['都','dōu'],['在','zài'],['默','mò'],['默','mò'],['塑','sù'],['造','zào'],['着','zhe'],['你','nǐ'],['。']],
  [['电','diàn'],['脑','nǎo'],['是','shì'],['我','wǒ'],['们','men'],['学','xué'],['习','xí'],['和','hé'],['工','gōng'],['作','zuò'],['的','de'],['好','hǎo'],['帮','bāng'],['手','shǒu'],['。'],['练','liàn'],['好','hǎo'],['键','jiàn'],['盘','pán'],['打','dǎ'],['字','zì'],['，'],['可','kě'],['以','yǐ'],['大','dà'],['大','dà'],['提','tí'],['高','gāo'],['效','xiào'],['率','lǜ'],['。'],['双','shuāng'],['手','shǒu'],['放','fàng'],['在','zài'],['基','jī'],['准','zhǔn'],['键','jiàn'],['上','shàng'],['，'],['眼','yǎn'],['睛','jing'],['看','kàn'],['着','zhe'],['屏','píng'],['幕','mù'],['，'],['慢','màn'],['慢','màn'],['就','jiù'],['能','néng'],['学','xué'],['会','huì'],['盲','máng'],['打','dǎ'],['。']]
];

var CODES = [
  "function factorial(n) {\n    if (n <= 1) {\n        return 1;\n    }\n    return n * factorial(n - 1);\n}\n\nconsole.log(factorial(5)); // 120",
  "def is_prime(n):\n    if n < 2:\n        return False\n    i = 2\n    while i * i <= n:\n        if n % i == 0:\n            return False\n        i += 1\n    return True",
  "const nums = [1, 2, 3, 4, 5];\nconst sum = nums.reduce((a, b) => a + b, 0);\nconst avg = sum / nums.length;\nconsole.log('sum =', sum, 'avg =', avg);",
  "for (let i = 1; i <= 9; i++) {\n    for (let j = 1; j <= i; j++) {\n        process.stdout.write(j + '*' + i + ' ');\n    }\n    console.log();\n}"
];

function genKeyText(keys) {
  keys = keys.replace(/\s/g, '') || 'abcdefghijklmnopqrstuvwxyz';
  var out = [], n = 0;
  while (n < 200) {
    var len = 2 + Math.floor(Math.random() * 3), w = '';
    for (var i = 0; i < len; i++) w += keys[Math.floor(Math.random() * keys.length)];
    out.push(w); n += w.length + 1;
  }
  return out.join(' ');
}
function genWordsText(count) {
  count = count || 40;
  var ws = [];
  for (var i = 0; i < count; i++) {
    var w = WORDS[Math.floor(Math.random() * WORDS.length)];
    if (i === 0) w = w[0].toUpperCase() + w.slice(1);
    ws.push(w);
  }
  return ws.join(' ');
}
function genNumberText() {
  var parts = [];
  for (var g = 0; g < 9; g++) {
    var kind = Math.floor(Math.random() * 3), s = '';
    if (kind === 0) {
      s = '1' + '3579'[Math.floor(Math.random() * 4)];
      for (var i = 0; i < 9; i++) s += Math.floor(Math.random() * 10);
    } else if (kind === 1) {
      s = String(100 + Math.floor(Math.random() * 9000)) + '.' + String(Math.floor(Math.random() * 100)).padStart(2, '0');
    } else {
      var len = 5 + Math.floor(Math.random() * 5);
      for (var j = 0; j < len; j++) s += Math.floor(Math.random() * 10);
    }
    parts.push(s);
  }
  return parts.join('  ');
}

var MODES = {
  keys:    { name: '键位入门', sub: '分节掌握每一排按键，零基础首选', eyebrow: 'MODULE 01 / KEY LAYOUT', cn: false },
  words:   { name: '英文单词', sub: '高频常用单词，练熟连贯击键', eyebrow: 'MODULE 02 / WORDS', cn: false },
  article: { name: '英文文章', sub: '完整短文段落，练习语流输入', eyebrow: 'MODULE 03 / ARTICLES', cn: false },
  chinese: { name: '中文拼音', sub: '使用系统中文输入法，看拼音打汉字', eyebrow: 'MODULE 04 / PINYIN', cn: true },
  number:  { name: '数字专项', sub: '手机号、金额与随机数字串', eyebrow: 'MODULE 05 / NUMBERS', cn: false },
  code:    { name: '代码片段', sub: '符号、大小写与缩进混合训练', eyebrow: 'MODULE 06 / CODE', cn: false }
};
var MODE_ORDER = ['keys', 'words', 'article', 'chinese', 'number', 'code'];

var MODE_ICONS = {
  keys: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>',
  words: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
  article: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
  chinese: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h7M7 3v2c0 4-2 7-5 8"/><path d="M7 8c0 2.5 2 4.5 4.5 5"/><path d="M13 20l4-9 4 9M14.7 17h4.6"/></svg>',
  number: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>'
};

/* 根据模式与课次生成训练文本 */
function buildText(mode, index) {
  if (mode === 'keys') return { text: genKeyText(LESSONS[index].keys), label: LESSONS[index].name };
  if (mode === 'words') return { text: genWordsText(), label: '随机高频词' };
  if (mode === 'article') return { text: ARTICLES[index % ARTICLES.length], label: '短文 ' + ((index % ARTICLES.length) + 1) };
  if (mode === 'chinese') return { text: CHINESE[index % CHINESE.length], label: '拼音段落 ' + ((index % CHINESE.length) + 1) };
  if (mode === 'number') return { text: genNumberText(), label: '随机数字串' };
  if (mode === 'code') return { text: CODES[index % CODES.length], label: '代码片段 ' + ((index % CODES.length) + 1) };
  return { text: genWordsText(), label: '' };
}
