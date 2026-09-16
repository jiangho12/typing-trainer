'use strict';

/* ============ 练习引擎：英文逐字符 / 中文 composition，实时统计与结算 ============ */

var Practice = {
  state: null,
  timer: null,

  start: function (mode, index) {
    var m = MODES[mode];
    if (!m) return;
    if (index == null) index = 0;
    var built = buildText(mode, index);
    var isCn = !!m.cn;

    this.state = {
      mode: mode, index: index, cn: isCn,
      target: isCn ? built.text.map(function (p) { return p[0]; }).join('') : built.text,
      cnData: isCn ? built.text : null,
      label: built.label,
      pos: 0, started: false, finished: false,
      startTime: 0,
      correct: 0, errors: 0, weak: {},
      cnBuffer: ''
    };

    document.getElementById('pracTitle').textContent = m.name;
    document.getElementById('pracSub').textContent = m.sub + (built.label ? ' · ' + built.label : '');
    document.querySelector('#page-practice .page-head').setAttribute('data-eyebrow', m.eyebrow);
    document.getElementById('wpmLabel').textContent = isCn ? '速度 字/分' : '速度 WPM';
    document.getElementById('cnText').classList.toggle('hidden', !isCn);
    document.getElementById('cnInput').classList.toggle('hidden', !isCn);
    document.getElementById('typeText').classList.toggle('hidden', isCn);

    this.renderChips();
    if (isCn) this.renderCn(); else this.renderText();
    KB.hint(isCn ? null : this.state.target[0]);
    this.showOverlay(true);
    document.getElementById('ovTitle').textContent = '准备开始 · ' + (built.label || m.name);
    document.getElementById('ovDesc').innerHTML = isCn
      ? '点击开始后，请切换到<b style="color:var(--yellow)">中文输入法</b>在下方输入框打字<br>打错可用退格修正，汉字上方有拼音提示'
      : '点击开始或直接按下任意键启动训练<br>输入错误不会跳过，按对才能继续';
    this.resetMetrics();
    clearInterval(this.timer);
  },

  renderChips: function () {
    var s = this.state, row = document.getElementById('chipRow');
    var chips = [];
    if (s.mode === 'keys') chips = LESSONS.map(function (l, i) { return { i: i, t: l.name }; });
    else if (s.mode === 'article') chips = ARTICLES.map(function (_, i) { return { i: i, t: '短文 ' + (i + 1) }; });
    else if (s.mode === 'chinese') chips = CHINESE.map(function (_, i) { return { i: i, t: '段落 ' + (i + 1) }; });
    else if (s.mode === 'code') chips = CODES.map(function (_, i) { return { i: i, t: '代码 ' + (i + 1) }; });
    row.style.display = chips.length ? 'flex' : 'none';
    row.innerHTML = chips.map(function (c) {
      return '<button class="chip' + (c.i === s.index ? ' on' : '') + '" data-i="' + c.i + '">' + c.t + '</button>';
    }).join('');
    var self = this;
    row.querySelectorAll('.chip').forEach(function (b) {
      b.onclick = function () { self.start(self.state.mode, Number(b.dataset.i)); };
    });
  },

  renderText: function () {
    var s = this.state;
    var box = document.getElementById('typeText');
    box.innerHTML = s.target.split('').map(function (ch, i) {
      var cls = 'ch';
      if (ch === ' ') cls += ' space';
      if (ch === '\n') cls += ' newline';
      var shown = ch === '\n' ? '↵\n' : (ch === ' ' ? '\u00A0' : ch);
      return '<span class="' + cls + '" data-i="' + i + '">' + shown + '</span>';
    }).join('');
  },
  renderCn: function () {
    var s = this.state;
    document.getElementById('cnText').innerHTML = s.cnData.map(function (p, i) {
      return '<span class="cw" data-i="' + i + '"><py>' + (p[1] || '') + '</py><hz>' + p[0] + '</hz></span>';
    }).join('');
  },
  paintText: function () {
    var s = this.state;
    var spans = document.getElementById('typeText').querySelectorAll('.ch');
    spans.forEach(function (el, i) {
      el.classList.toggle('ok', i < s.pos);
      el.classList.toggle('cur', i === s.pos);
      el.classList.remove('bad');
    });
  },
  paintCn: function (badPos) {
    var s = this.state;
    var cws = document.getElementById('cnText').querySelectorAll('.cw');
    cws.forEach(function (el, i) {
      el.classList.toggle('ok', i < s.pos);
      el.classList.toggle('cur', i === s.pos);
      el.classList.toggle('bad', i === badPos);
    });
  },

  showOverlay: function (v) {
    document.getElementById('startOverlay').classList.toggle('hidden', !v);
  },
  resetMetrics: function () {
    document.getElementById('mWpm').textContent = '0';
    document.getElementById('mAcc').textContent = '100%';
    document.getElementById('mTime').textContent = '0:00';
    document.getElementById('mDone').textContent = '0/' + this.state.target.length;
    document.getElementById('mErr').textContent = '0';
    document.getElementById('progBar').style.width = '0%';
  },

  begin: function () {
    var s = this.state;
    if (s.started || s.finished) return;
    s.started = true;
    s.startTime = Date.now();
    this.showOverlay(false);
    document.getElementById('sysState').textContent = 'IN SESSION';
    if (s.cn) {
      var inp = document.getElementById('cnInput');
      inp.value = ''; inp.focus();
    }
    var self = this;
    clearInterval(this.timer);
    this.timer = setInterval(function () { self.updateMetrics(false); }, 250);
  },

  /* 英文逐字符输入 */
  onKey: function (e) {
    var s = this.state;
    if (!s || App.state.activePage !== 'practice') return;
    if (s.cn) return; // 中文交给 input/composition
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Escape') { e.preventDefault(); this.start(s.mode, s.index); return; }
    if (!s.started) {
      if (e.key === 'Enter' || e.key.length === 1 || ['Tab'].indexOf(e.key) >= 0) { e.preventDefault(); this.begin(); }
      return;
    }
    if (s.finished) return;
    if (e.key === 'Escape') { e.preventDefault(); this.start(s.mode, s.index); return; }

    var expected = s.target[s.pos];
    var physical = KB.physicalFromEvent(e);

    // Tab / Enter 在训练文本里才拦截，其余功能键放行
    var isChar = e.key.length === 1;
    if (!isChar) {
      if (expected === '\n' && (e.key === 'Enter' || e.code === 'NumpadEnter')) { /* 换行字符，继续判定 */ }
      else if (expected === '\t' && e.key === 'Tab') { e.preventDefault(); }
      else return;
    }
    // KeyboardEvent.key 是只读属性，严格模式下赋值会抛 TypeError，故用局部变量承载归一化结果
    var typed = e.key;
    if (expected === '\t' && e.key === 'Tab') { e.preventDefault(); typed = '\t'; }
    if (expected === '\n' && (e.key === 'Enter' || e.code === 'NumpadEnter')) typed = '\n';

    if (typed === expected) {
      s.pos++; s.correct++;
      KB.flash(physical, false);
      this.paintText();
      KB.hint(s.target[s.pos]);
      this.updateMetrics(false);
      if (s.pos >= s.target.length) this.finish();
    } else if (isChar || expected === '\n' || expected === '\t') {
      e.preventDefault();
      s.errors++;
      var badKey = expected === ' ' ? 'Space' : expected;
      s.weak[badKey] = (s.weak[badKey] || 0) + 1;
      KB.flash(CHAR2KEY[expected] || physical, true);
      KB.hint(expected);
      var panel = document.getElementById('typePanel');
      panel.classList.remove('shake'); void panel.offsetWidth; panel.classList.add('shake');
      var cur = document.querySelector('.type-text .ch[data-i="' + s.pos + '"]');
      if (cur) { cur.classList.add('bad'); setTimeout(function () { cur && cur.classList.remove('bad'); }, 220); }
      this.updateMetrics(false);
    }
  },

  /* 中文输入：composition 结束后与目标前缀比对 */
  onCnInput: function () {
    var s = this.state;
    if (!s || !s.cn) return;
    if (!s.started) this.begin();
    if (s.finished) return;
    var inp = document.getElementById('cnInput');
    s.cnBuffer = inp.value;
    var matched = 0;
    while (matched < s.cnBuffer.length && matched < s.target.length && s.cnBuffer[matched] === s.target[matched]) matched++;

    if (matched > s.pos) { s.correct += matched - s.pos; s.pos = matched; }
    var badPos = -1;
    if (s.cnBuffer.length > matched) {
      // 出现错误上屏：计一次错误，定位到第一个错字
      s.errors++;
      badPos = matched;
      // matched 可能已越过目标末尾，此时没有可归因的期望字，跳过薄弱键统计（否则会写入 undefined 键）
      if (matched < s.target.length) {
        var expected = s.target[matched];
        s.weak[expected] = (s.weak[expected] || 0) + 1;
      }
    }
    this.paintCn(badPos);
    KB.hint(null);
    this.updateMetrics(false);
    if (s.pos >= s.target.length && s.cnBuffer.length >= s.target.length) this.finish();
  },

  updateMetrics: function () {
    var s = this.state;
    if (!s) return;
    var elapsed = s.started ? (Date.now() - s.startTime) / 1000 : 0;
    var mins = elapsed / 60;
    var wpm = 0;
    if (mins > 0.005) {
      wpm = s.cn ? s.pos / mins : (s.correct / 5) / mins;
    }
    var total = s.correct + s.errors;
    var acc = total ? Math.round((s.correct / total) * 100) : 100;
    document.getElementById('mWpm').textContent = String(Math.round(wpm));
    document.getElementById('mAcc').textContent = acc + '%';
    document.getElementById('mTime').textContent = App.fmtTime(elapsed);
    document.getElementById('mDone').textContent = s.pos + '/' + s.target.length;
    document.getElementById('mErr').textContent = String(s.errors);
    document.getElementById('progBar').style.width = (s.pos / s.target.length * 100) + '%';
  },

  finish: function () {
    var s = this.state;
    if (s.finished) return;
    s.finished = true; s.started = false;
    clearInterval(this.timer);
    this.updateMetrics();
    document.getElementById('sysState').textContent = 'REPORT';
    var duration = Math.max(1, Math.round((Date.now() - s.startTime) / 1000));
    var mins = duration / 60;
    var wpm = s.cn ? Math.round(s.pos / mins) : Math.round((s.correct / 5) / mins);
    var total = s.correct + s.errors;
    var acc = total ? Math.round((s.correct / total) * 100) : 100;

    var record = {
      mode: s.mode, modeLabel: MODES[s.mode].name, lessonLabel: s.label,
      wpm: wpm, acc: acc, duration: duration, errors: s.errors,
      chars: s.target.length, weak: s.weak, cn: s.cn, finishedAt: new Date().toISOString()
    };
    this.lastRecord = record;
    window.api.store.create('records', record).then(function (res) {
      if (window.Stats) Stats.invalidate();
      if (window.Home) Home.invalidate();
      // 已登录时顺手把这条成绩推到云端，失败不影响本地记录
      if (window.Cloud && res && res.data) Cloud.pushOne(res.data);
    });
    Results.show(record);
    App.navigate('result');
  },

  /* 换一段：课程/文章/代码/中文顺序后移，单词/数字随机重出 */
  next: function () {
    var s = this.state;
    var len = { keys: LESSONS.length, article: ARTICLES.length, chinese: CHINESE.length, code: CODES.length }[s.mode];
    var ni = len ? (s.index + 1) % len : 0;
    this.start(s.mode, ni);
  }
};

/* ============ 结算报告 ============ */
var Results = {
  drawRing: function (acc) {
    var c = document.getElementById('ringCanvas'), ctx = c.getContext('2d');
    var w = c.width, cx = w / 2, r = 62, lw = 11;
    ctx.clearRect(0, 0, w, w);
    ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#2a2f36'; ctx.lineWidth = lw; ctx.stroke();
    var color = acc >= 95 ? '#8eef5b' : acc >= 85 ? '#f5a623' : '#ff625d';
    ctx.beginPath();
    ctx.arc(cx, cx, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * acc / 100);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
  },
  show: function (r) {
    document.getElementById('rAcc').textContent = r.acc + '%';
    document.getElementById('rWpm').textContent = String(r.wpm);
    document.getElementById('rWpmLabel').textContent = r.cn ? '字 / 分钟' : 'WPM 词/分';
    document.getElementById('rKeys').textContent = String(r.chars);
    document.getElementById('rTime').textContent = App.fmtTime(r.duration);
    document.getElementById('rErr').textContent = String(r.errors);
    document.getElementById('resultTitle').textContent = r.modeLabel + ' · 训练完成';
    var comment = r.acc >= 98 ? '近乎完美，保持这个节奏！' : r.acc >= 95 ? '非常出色，可以尝试提速。' : r.acc >= 85 ? '不错，注意标红的薄弱键。' : '先放慢速度，把每个键按准确。';
    document.getElementById('resultSub').textContent = comment;
    this.drawRing(r.acc);

    var entries = Object.keys(r.weak || {}).map(function (k) { return [k, r.weak[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
    var box = document.getElementById('weakList');
    if (!entries.length) {
      box.innerHTML = '<div class="no-data">本次零失误，没有薄弱键记录</div>';
    } else {
      var max = entries[0][1];
      box.innerHTML = entries.map(function (en) {
        var pct = Math.round(en[1] / max * 100);
        var keyShow = en[0] === 'Space' ? '空格' : (en[0] === '\n' ? '回车' : en[0]);
        return '<div class="weak-row"><div class="wk">' + keyShow + '</div><div class="wbar"><i style="width:' + pct + '%"></i></div><div class="wn">' + en[1] + ' 次失误</div></div>';
      }).join('');
    }
  }
};

document.addEventListener('DOMContentLoaded', function () {
  KB.build();
  document.addEventListener('keydown', function (e) { return Practice.onKey(e); });
  var cnInput = document.getElementById('cnInput');
  cnInput.addEventListener('compositionend', function () { setTimeout(function () { Practice.onCnInput(); }, 0); });
  cnInput.addEventListener('input', function (e) { if (!e.isComposing && e.data != null && !/[a-zA-Z']/.test(e.data)) Practice.onCnInput(); });
  cnInput.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); Practice.start(Practice.state.mode, Practice.state.index); } });

  document.getElementById('startBtn').onclick = function () { Practice.begin(); };
  document.getElementById('restartBtn').onclick = function () { Practice.start(Practice.state.mode, Practice.state.index); };
  document.getElementById('newTextBtn').onclick = function () { Practice.next(); };
  document.getElementById('againBtn').onclick = function () {
    App.navigate('practice'); // navigate 会用 Practice.state 重开同一段
  };
  document.getElementById('nextTextBtn').onclick = function () {
    App.navigate('practice');
    Practice.next();
  };
  document.getElementById('resultStatsBtn').onclick = function () { App.navigate('stats'); };
  document.getElementById('resultHomeBtn').onclick = function () { App.navigate('home'); };
});
