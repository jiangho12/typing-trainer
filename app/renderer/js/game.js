'use strict';

/* ============ 单词雨游戏：输入拦截下落单词 ============ */

var Game = {
  running: false,
  words: [],
  score: 0, level: 1, combo: 0, lives: 3, killed: 0,
  raf: null, lastT: 0, spawnAt: 0,
  typed: '',

  el: function (id) { return document.getElementById(id); },

  reset: function () {
    this.words.forEach(function (w) { w.el.remove(); });
    this.words = [];
    this.score = 0; this.level = 1; this.combo = 0; this.lives = 3; this.killed = 0;
    this.typed = '';
    var input = this.el('gameInput');
    input.value = ''; input.disabled = true;
    this.syncHud();
  },

  start: function () {
    this.reset();
    this.running = true;
    this.el('gameOverlay').classList.add('hidden');
    var input = this.el('gameInput');
    input.disabled = false; input.focus();
    this.lastT = performance.now();
    this.spawnAt = this.lastT + 400;
    var self = this;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(function (t) { self.loop(t); });
    document.getElementById('sysState').textContent = 'GAME RUNNING';
  },

  stop: function (over) {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.el('gameInput').disabled = true;
    document.getElementById('sysState').textContent = over ? 'GAME OVER' : 'READY';
  },

  gameOver: function () {
    this.stop(true);
    var ov = this.el('gameOverlay');
    ov.classList.remove('hidden');
    this.el('goTitle').textContent = '游戏结束';
    this.el('goDesc').innerHTML = '最终得分 <b style="color:var(--yellow)">' + this.score + '</b>　拦截单词 ' + this.killed + ' 个　到达等级 ' + this.level + '<br>点击按钮重新开始';
    this.el('gameStart').textContent = '再来一局';
    // 成绩入库（mode=game，wpm 字段存分数）
    window.api.store.create('records', {
      mode: 'game', modeLabel: '单词雨', lessonLabel: '等级 ' + this.level,
      wpm: this.score, acc: 0, duration: 0, errors: 3 - this.lives,
      chars: this.killed, weak: {}, cn: false, finishedAt: new Date().toISOString()
    }).then(function (res) {
      if (window.Stats) Stats.invalidate();
      if (window.Home) Home.invalidate();
      // 已登录时顺手把这条成绩推到云端
      if (window.Cloud && res && res.data) Cloud.pushOne(res.data);
    });
  },

  spawnWord: function () {
    var stage = this.el('gameStage');
    var maxLen = Math.min(7, 3 + Math.floor(this.level / 2));
    var minLen = Math.min(4, 3 + Math.floor(this.level / 4));
    var pool = WORDS.filter(function (w) { return w.length >= minLen && w.length <= maxLen; });
    var word = pool[Math.floor(Math.random() * pool.length)] || pick(WORDS);
    var el = document.createElement('div');
    el.className = 'gword';
    el.innerHTML = '<span class="done"></span><span class="rest">' + word + '</span>';
    stage.appendChild(el);
    var width = el.offsetWidth || 90;
    var x = 8 + Math.random() * Math.max(10, stage.clientWidth - width - 16);
    el.style.left = x + 'px';
    el.style.top = '-34px';
    var speed = 0.42 + this.level * 0.09 + Math.random() * 0.12; // px/frame @60fps
    this.words.push({ el: el, word: word, x: x, y: -34, speed: speed, matched: 0 });
  },

  loop: function (t) {
    if (!this.running) return;
    var dt = Math.min(50, t - this.lastT) / (1000 / 60); // 归一化到 60fps 帧
    this.lastT = t;

    if (t >= this.spawnAt) {
      this.spawnWord();
      var interval = Math.max(850, 2700 - this.level * 230);
      this.spawnAt = t + interval;
    }

    var stageH = this.el('gameStage').clientHeight;
    for (var i = this.words.length - 1; i >= 0; i--) {
      var w = this.words[i];
      w.y += w.speed * dt;
      w.el.style.top = w.y + 'px';
      if (w.y > stageH - 46) {
        w.el.remove();
        this.words.splice(i, 1);
        this.lives--; this.combo = 0;
        this.syncHud();
        if (this.lives <= 0) { this.gameOver(); return; }
      } else if (w.y > stageH - 130) {
        w.el.classList.add('danger');
      }
    }
    var self = this;
    this.raf = requestAnimationFrame(function (t) { self.loop(t); });
  },

  syncHud: function () {
    this.el('gScore').innerHTML = this.score + '<small>得分 SCORE</small>';
    this.el('gLevel').innerHTML = this.level + '<small>等级 LEVEL</small>';
    this.el('gCombo').innerHTML = this.combo + '<small>连击 COMBO</small>';
    this.el('gLives').innerHTML = '◆'.repeat(Math.max(0, this.lives)) + '◇'.repeat(3 - Math.max(0, this.lives)) + '<small style="color:var(--faint);letter-spacing:.1em">生命 LIFE</small>';
  },

  onType: function () {
    if (!this.running) return;
    var input = this.el('gameInput');
    var typed = input.value.replace(/\s/g, '').toLowerCase();
    this.typed = typed;

    // 候选：以 typed 为前缀的单词，优先最靠下（最危险）的
    var candidate = null;
    this.words.forEach(function (w) {
      if (w.word.indexOf(typed) === 0 && (!candidate || w.y > candidate.y)) candidate = w;
    });

    if (typed && !candidate) {
      input.style.borderColor = 'var(--red)';
      input.style.boxShadow = '0 0 22px rgba(255,98,93,.25), 4px 4px 0 #000';
    } else {
      input.style.borderColor = 'var(--yellow)';
      input.style.boxShadow = '0 0 22px rgba(255,244,79,.18), 4px 4px 0 #000';
    }

    this.words.forEach(function (w) {
      if (w === candidate && typed) {
        w.el.querySelector('.done').textContent = typed;
        w.el.querySelector('.rest').textContent = w.word.slice(typed.length);
      } else {
        w.el.querySelector('.done').textContent = '';
        w.el.querySelector('.rest').textContent = w.word;
      }
    });

    if (candidate && typed === candidate.word) {
      this.kill(candidate);
      input.value = '';
      this.typed = '';
      input.style.borderColor = 'var(--yellow)';
    }
  },

  kill: function (w) {
    var idx = this.words.indexOf(w);
    if (idx >= 0) this.words.splice(idx, 1);
    w.el.remove();
    this.killed++;
    this.combo++;
    this.score += 10 + w.word.length * 2 + Math.min(this.combo, 10) * 2;
    var newLevel = 1 + Math.floor(this.killed / 7);
    if (newLevel > this.level) {
      this.level = newLevel;
      App.toast('等级提升至 ' + this.level + '，速度加快！', 'ok', 1400);
    }
    this.syncHud();
  }
};

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

document.addEventListener('DOMContentLoaded', function () {
  var input = document.getElementById('gameInput');
  input.addEventListener('input', function () { Game.onType(); });
  document.getElementById('gameStart').onclick = function () { Game.start(); };
  document.getElementById('gameRestart').onclick = function () {
    Game.el('gameStart').textContent = '开始游戏';
    Game.start();
  };
  // 点击舞台空白处聚焦输入框
  document.getElementById('gameStage').addEventListener('click', function (e) {
    if (Game.running && e.target === this) input.focus();
  });
});
