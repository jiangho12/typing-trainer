'use strict';

/* ============ 虚拟键盘：渲染、指法配色、按键高亮 ============ */

var KB_ROWS = [
  [{ k: '`', s: '~', f: 'L5' }, { k: '1', s: '!', f: 'L5' }, { k: '2', s: '@', f: 'L4' }, { k: '3', s: '#', f: 'L3' }, { k: '4', s: '$', f: 'L2' }, { k: '5', s: '%', f: 'L2' }, { k: '6', s: '^', f: 'R2' }, { k: '7', s: '&', f: 'R2' }, { k: '8', s: '*', f: 'R3' }, { k: '9', s: '(', f: 'R4' }, { k: '0', s: ')', f: 'R5' }, { k: '-', s: '_', f: 'R5' }, { k: '=', s: '+', f: 'R5' }, { k: 'Backspace', w: 'w92', f: 'R5' }],
  [{ k: 'Tab', w: 'w76', f: 'L5' }, { k: 'Q', f: 'L5' }, { k: 'W', f: 'L4' }, { k: 'E', f: 'L3' }, { k: 'R', f: 'L2' }, { k: 'T', f: 'L2' }, { k: 'Y', f: 'R2' }, { k: 'U', f: 'R2' }, { k: 'I', f: 'R3' }, { k: 'O', f: 'R4' }, { k: 'P', f: 'R5' }, { k: '[', s: '{', f: 'R5' }, { k: ']', s: '}', f: 'R5' }, { k: '\\', s: '|', f: 'R5' }],
  [{ k: 'Caps', w: 'w92', f: 'L5' }, { k: 'A', f: 'L5' }, { k: 'S', f: 'L4' }, { k: 'D', f: 'L3' }, { k: 'F', f: 'L2' }, { k: 'G', f: 'L2' }, { k: 'H', f: 'R2' }, { k: 'J', f: 'R2' }, { k: 'K', f: 'R3' }, { k: 'L', f: 'R4' }, { k: ';', s: ':', f: 'R5' }, { k: "'", s: '"', f: 'R5' }, { k: 'Enter', w: 'w92', f: 'R5' }],
  [{ k: 'Shift', w: 'w92', f: 'L5' }, { k: 'Z', f: 'L5' }, { k: 'X', f: 'L4' }, { k: 'C', f: 'L3' }, { k: 'V', f: 'L2' }, { k: 'B', f: 'L2' }, { k: 'N', f: 'R2' }, { k: 'M', f: 'R2' }, { k: ',', s: '<', f: 'R3' }, { k: '.', s: '>', f: 'R4' }, { k: '/', s: '?', f: 'R5' }, { k: 'Shift', w: 'w92', f: 'R5' }],
  [{ k: 'Space', w: 'w320' }]
];

var CHAR2KEY = {};
KB_ROWS.forEach(function (row) {
  row.forEach(function (it) {
    CHAR2KEY[it.k.toLowerCase()] = it.k;
    if (it.s) CHAR2KEY[it.s] = it.k;
  });
});
CHAR2KEY[' '] = 'Space';
CHAR2KEY['\n'] = 'Enter';
CHAR2KEY['\t'] = 'Tab';

var KB = {
  colorOn: true,
  build: function () {
    var kb = document.getElementById('keyboard');
    kb.innerHTML = '';
    KB_ROWS.forEach(function (row) {
      var r = document.createElement('div');
      r.className = 'kb-row';
      row.forEach(function (it) {
        var b = document.createElement('div');
        b.className = 'key' + (it.w ? ' ' + it.w : '');
        b.dataset.key = it.k;
        b.innerHTML = (it.s ? '<small>' + it.s + '</small>' : '') + '<span>' + it.k + '</span>' + (it.f ? '<i class="finger f-' + it.f + '"></i>' : '');
        r.appendChild(b);
      });
      kb.appendChild(r);
    });
    var fingers = [['L5', '左手小指'], ['L4', '左手无名指'], ['L3', '左手中指'], ['L2', '左手食指'], ['R2', '右手食指'], ['R3', '右手中指'], ['R4', '右手无名指'], ['R5', '右手小指']];
    document.getElementById('kbLegend').innerHTML = fingers.map(function (p) {
      return '<span><i class="f-' + p[0] + '"></i>' + p[1] + '</span>';
    }).join('');
  },
  /* 高亮“下一个该按的键” */
  hint: function (ch) {
    document.querySelectorAll('.key.need,.key.wrong').forEach(function (el) { el.classList.remove('need', 'wrong'); });
    if (!ch) return;
    var name = CHAR2KEY[ch] || CHAR2KEY[ch.toLowerCase()] || CHAR2KEY[ch.toUpperCase()];
    var el = name && document.querySelector('.key[data-key="' + name + '"]');
    if (el) el.classList.add('need');
  },
  /* 物理击键闪烁（wrong=true 标红） */
  flash: function (physicalKey, wrong) {
    var el = document.querySelector('.key[data-key="' + physicalKey + '"]');
    if (!el) return;
    el.classList.add('pressed');
    if (wrong) el.classList.add('wrong');
    setTimeout(function () { el.classList.remove('pressed', 'wrong'); }, 140);
  },
  physicalFromEvent: function (e) {
    if (e.code === 'Space') return 'Space';
    if (e.code === 'Enter' || e.code === 'NumpadEnter') return 'Enter';
    if (e.code === 'Backspace') return 'Backspace';
    if (e.code === 'Tab') return 'Tab';
    if (e.code && e.code.indexOf('Shift') === 0) return 'Shift';
    if (e.code && e.code.indexOf('Caps') === 0) return 'Caps';
    return e.key ? e.key.toUpperCase() : '';
  },
  toggleColor: function () {
    KB.colorOn = !KB.colorOn;
    document.querySelectorAll('.key .finger').forEach(function (el) { el.style.display = KB.colorOn ? '' : 'none'; });
    document.getElementById('kbToggle').textContent = KB.colorOn ? '隐藏指法配色' : '显示指法配色';
  }
};

document.addEventListener('DOMContentLoaded', function () {
  var t = document.getElementById('kbToggle');
  if (t) t.addEventListener('click', KB.toggleColor);
});
