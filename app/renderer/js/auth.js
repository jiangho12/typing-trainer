'use strict';

/* ============ 登录 / 注册：邮箱验证码 ============ */

var Auth = {
  mode: 'login',      // 'login' | 'register'
  countdown: 0,
  timer: null,
  busy: false,

  el: function (id) { return document.getElementById(id); },

  /* ---------------- 显示 / 隐藏 ---------------- */

  show: function (mode) {
    this.mode = mode || 'login';
    this.applyMode();
    this.el('authOverlay').classList.remove('hidden');
    setTimeout(function () { Auth.el('authEmail').focus(); }, 60);
  },

  hide: function () {
    this.el('authOverlay').classList.add('hidden');
    this.stopCountdown();
  },

  applyMode: function () {
    var isReg = this.mode === 'register';
    this.el('authTabLogin').classList.toggle('on', !isReg);
    this.el('authTabRegister').classList.toggle('on', isReg);
    this.el('authTitle').textContent = isReg ? '注册新账号' : '登录账号';
    this.el('authDesc').innerHTML = isReg
      ? '填写邮箱获取验证码，验证通过即完成注册'
      : '使用邮箱验证码登录，训练成绩自动同步到云端';
    this.el('authNicknameRow').classList.toggle('hidden', !isReg);
    this.el('authSubmit').textContent = isReg ? '注册并登录' : '登录';
    this.el('authCode').value = '';
    this.setMsg('');
    this.stopCountdown();
    this.el('authCodeBtn').textContent = '获取验证码';
    this.el('authCodeBtn').disabled = false;
  },

  setMsg: function (text, type) {
    var box = this.el('authMsg');
    box.textContent = text || '';
    box.className = 'auth-msg' + (text ? ' ' + (type || 'err') : '');
  },

  /* ---------------- 倒计时 ---------------- */

  startCountdown: function (seconds) {
    var self = this;
    this.countdown = seconds;
    this.el('authCodeBtn').disabled = true;
    var tick = function () {
      if (self.countdown <= 0) {
        self.stopCountdown();
        self.el('authCodeBtn').textContent = '获取验证码';
        self.el('authCodeBtn').disabled = false;
        return;
      }
      self.el('authCodeBtn').textContent = self.countdown + ' 秒后重发';
      self.countdown--;
    };
    tick();
    this.timer = setInterval(tick, 1000);
  },

  stopCountdown: function () {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.countdown = 0;
  },

  /* ---------------- 获取验证码 ---------------- */

  getCode: async function () {
    if (this.busy) return;
    var email = (this.el('authEmail').value || '').trim();
    if (!email) { this.setMsg('请先填写邮箱'); return; }

    this.busy = true;
    var btn = this.el('authCodeBtn');
    btn.disabled = true;
    btn.textContent = '发送中…';
    this.setMsg('');

    try {
      var d = await Cloud.sendCode(email, this.mode);
      this.startCountdown(60);
      this.setMsg('验证码已发送，' + Math.round((d.ttl || 600) / 60) + ' 分钟内有效', 'ok');
      if (d.devCode) {
        // 邮件通道尚未接入时的联调便利：自动填入验证码
        this.el('authCode').value = d.devCode;
        this.setMsg('邮件通道尚未接入，验证码已自动填入：' + d.devCode, 'warn');
      }
    } catch (e) {
      this.setMsg(e.message);
      btn.disabled = false;
      btn.textContent = '获取验证码';
    } finally {
      this.busy = false;
    }
  },

  /* ---------------- 提交 ---------------- */

  submit: async function () {
    if (this.busy) return;
    var email = (this.el('authEmail').value || '').trim();
    var code = (this.el('authCode').value || '').trim();
    var nickname = (this.el('authNickname').value || '').trim();

    if (!email) { this.setMsg('请填写邮箱'); return; }
    if (!/^\d{6}$/.test(code)) { this.setMsg('请填写 6 位数字验证码'); return; }

    this.busy = true;
    var btn = this.el('authSubmit');
    var original = btn.textContent;
    btn.disabled = true;
    btn.textContent = this.mode === 'register' ? '注册中…' : '登录中…';
    this.setMsg('');

    try {
      if (this.mode === 'register') await Cloud.register(email, code, nickname);
      else await Cloud.login(email, code);

      this.hide();
      App.toast('欢迎，' + (Cloud.loadAuth().nickname || Cloud.loadAuth().email), 'ok');

      // 首次登录/注册：把本机已有成绩迁移到云端，再拉回云端新增
      var r = await Cloud.syncAll();
      if (r && r.ok) {
        App.toast('云端同步完成：上传 ' + r.pushed + ' 条，新增 ' + r.pulled + ' 条', 'ok', 3200);
      } else if (r && r.error) {
        App.toast('云端同步失败：' + r.error, 'error', 4000);
      }
      if (window.Home) Home.invalidate();
      if (window.Stats) Stats.invalidate();
      App.navigate('home');
    } catch (e) {
      this.setMsg(e.message);
      btn.disabled = false;
      btn.textContent = original;
    } finally {
      this.busy = false;
    }
  },

  /* ---------------- 事件绑定 ---------------- */

  bind: function () {
    var self = this;
    this.el('authTabLogin').onclick = function () { self.mode = 'login'; self.applyMode(); };
    this.el('authTabRegister').onclick = function () { self.mode = 'register'; self.applyMode(); };
    this.el('authCodeBtn').onclick = function () { self.getCode(); };
    this.el('authSubmit').onclick = function () { self.submit(); };
    this.el('authEmail').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') self.getCode();
    });
    this.el('authCode').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') self.submit();
    });
    this.el('authNickname').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') self.submit();
    });
  }
};

window.Auth = Auth;
