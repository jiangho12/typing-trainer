'use strict';

/* ============ 应用核心：工具、Toast、页面导航、首页 ============ */

var App = {
  state: { activePage: 'home', settings: {} },

  el: function (id) { return document.getElementById(id); },

  esc: function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  fmtTime: function (sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  },

  toast: function (msg, type, ms) {
    ms = ms || 2600;
    var root = this.el('toastRoot');
    var t = document.createElement('div');
    t.className = 'toast ' + (type === 'error' ? 'err' : type === 'ok' ? 'ok' : '');
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, ms - 300);
    setTimeout(function () { t.remove(); }, ms);
  },

  navigate: function (page, opts) {
    opts = opts || {};
    // 离开游戏页：停止循环并复位
    if (this.state.activePage === 'game' && page !== 'game') {
      Game.running = false;
      cancelAnimationFrame(Game.raf);
      Game.el('gameInput').disabled = true;
    }

    this.state.activePage = page;
    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.toggle('active', p.id === 'page-' + page);
    });

    // 侧边栏高亮
    document.querySelectorAll('.nav-item').forEach(function (n) {
      var on = false;
      if (page === 'practice') on = n.dataset.page === 'practice' && n.dataset.mode === opts.mode;
      else on = n.dataset.page === page && !n.dataset.mode;
      n.classList.toggle('active', on);
    });

    document.querySelector('.main').scrollTop = 0;

    if (page === 'home') {
      Home.render();
      this.el('sysState').textContent = 'READY';
    } else if (page === 'stats') {
      Stats.render();
      this.el('sysState').textContent = 'DATA LOG';
    } else if (page === 'profile') {
      Profile.render();
      this.el('sysState').textContent = 'ACCOUNT';
    } else if (page === 'howto') {
      this.el('sysState').textContent = 'MANUAL';
    } else if (page === 'game') {
      // 进入游戏页：复位为待开始状态（不自动启动）
      Game.reset();
      Game.el('goTitle').textContent = '单词雨';
      Game.el('goDesc').innerHTML = '单词会不断从顶部落下，输入完整单词即可拦截消除<br>漏掉 3 个单词游戏结束，速度随等级提升';
      Game.el('gameStart').textContent = '开始游戏';
      Game.el('gameOverlay').classList.remove('hidden');
      this.el('sysState').textContent = 'STANDBY';
    } else if (page === 'result') {
      this.el('sysState').textContent = 'REPORT';
    } else if (page === 'practice') {
      var mode = opts.mode || (Practice.state && Practice.state.mode) || 'keys';
      var index = opts.index != null ? opts.index : ((Practice.state && Practice.state.mode === mode) ? Practice.state.index : 0);
      Practice.start(mode, index);
      this.el('sysState').textContent = 'STANDBY';
    }
  },

  /* ---------- 启动流程：加载页 → 免责公告 ---------- */
  runSplash: function () {
    var overlay = this.el('splashOverlay');
    var bar = this.el('splashBar');
    var pct = this.el('splashPct');
    var ms = window.TYPING_SPLASH_MS || (window.TYPING_SPLASH_HOLD ? 60000 : 1800);
    var start = Date.now();
    var tick = function () {
      var p = Math.min(100, Math.round((Date.now() - start) / ms * 100));
      bar.style.width = p + '%';
      pct.textContent = p + '%';
      if (p < 100) requestAnimationFrame(tick);
      else {
        overlay.classList.add('hide');
        setTimeout(function () { overlay.remove(); }, 420);
        App.afterSplash();
      }
    };
    tick();
  },

  /* 加载页结束后：先看免责公告，再校验登录态 */
  afterSplash: function () {
    if (window.TYPING_SHOW_DISCLAIMER || !this.state.settings.disclaimerAccepted) {
      this.el('disclaimerOverlay').classList.remove('hidden');
    } else {
      this.checkAuth();
    }
  },

  /* 登录门禁：没有凭证或凭证失效则强制登录 */
  checkAuth: async function () {
    if (!window.Cloud || !Cloud.isLoggedIn()) {
      Auth.show('login');
      return;
    }
    try {
      var d = await Cloud.me();
      Cloud.saveAuth({ token: Cloud.token(), id: d.user.id, email: d.user.email, nickname: d.user.nickname });
      Auth.hide();
      // 后台全量同步，不阻塞界面
      Cloud.syncAll().then(function (r) {
        if (r && r.ok && (r.pushed || r.pulled)) {
          App.toast('云端同步完成：上传 ' + r.pushed + ' 条，新增 ' + r.pulled + ' 条', 'ok', 3200);
          if (window.Home) Home.invalidate();
          if (window.Stats) Stats.invalidate();
          if (App.state.activePage === 'home') Home.render();
        } else if (r && r.error) {
          App.toast('云端同步失败：' + r.error, 'error', 4000);
        }
      });
    } catch (e) {
      if (e.status === 401) {
        Cloud.saveAuth(null);
        Auth.show('login');
      } else {
        // 临时网络异常不清除本地凭证，避免把用户锁在门外
        Auth.hide();
        App.toast('云端暂时不可用，已切换到本地模式：' + e.message, 'error', 5000);
      }
    }
  },

  init: async function () {
    try {
      var v = await window.api.app.getVersion();
      if (v && v.version && v.version !== 'browser') this.el('sysVer').textContent = 'v' + v.version;
      else this.el('sysVer').textContent = 'WEB';
      this.state.settings = await window.api.store.getSettings();
    } catch (e) { /* 版本信息失败不影响使用 */ }

    // 全局导航事件委托（侧边栏 + 首页卡片）
    document.addEventListener('click', function (e) {
      var item = e.target.closest('[data-page]');
      if (!item) return;
      var p = item.dataset.page;
      if (p === 'practice') App.navigate('practice', { mode: item.dataset.mode || 'keys', index: 0 });
      else App.navigate(p);
    });

    this.el('homeStartBtn').onclick = function () {
      // 有键位成绩则接着上一课往后练，否则从基准键第一课开始
      window.api.store.list('records').then(function (res) {
        var recs = (res && res.data) || [];
        var next = 0;
        for (var i = recs.length - 1; i >= 0; i--) {
          if (recs[i].mode === 'keys') {
            var at = LESSONS.findIndex(function (l) { return l.name === recs[i].lessonLabel; });
            if (at >= 0) next = (at + 1) % LESSONS.length;
            break;
          }
        }
        App.navigate('practice', { mode: 'keys', index: next });
      }).catch(function () {
        App.navigate('practice', { mode: 'keys', index: 0 });
      });
    };

    // 免责公告：同意则记住，下次启动不再打扰；退出则关闭应用
    this.el('disclaimAgree').onclick = async function () {
      try { App.state.settings.disclaimerAccepted = true; await window.api.store.saveSettings({ disclaimerAccepted: true }); }
      catch (e) { /* 保存失败也放行 */ }
      App.el('disclaimerOverlay').classList.add('hidden');
      App.checkAuth();
    };
    this.el('disclaimQuit').onclick = function () {
      if (window.api && window.api.app && window.api.app.quit) { window.api.app.quit(); return; }
      try { window.close(); } catch (e) { App.toast('请直接关闭本页面', 'error'); }
    };

    Auth.bind();
    KB.build();
    this.navigate('home');
    this.runSplash();
  }
};

window.App = App;
