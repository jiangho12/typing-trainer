'use strict';

/* ============ 云端客户端：邮箱验证码登录 + 成绩云同步 ============ */

var Cloud = {
  /* 云端 API 地址（独立端口 8788，与 ClassManager 的 8787 互不影响） */
  API_BASE: 'http://103.231.56.158:8788',

  /* 登录凭证保存在本机 localStorage，仅存令牌与账号展示信息 */
  TOKEN_KEY: 'typing-trainer.auth.v1',

  auth: null,
  syncing: false,
  lastSyncAt: null,
  lastError: '',

  /* ---------------- 本地凭证 ---------------- */

  loadAuth: function () {
    if (this.auth) return this.auth;
    try {
      var raw = localStorage.getItem(this.TOKEN_KEY);
      this.auth = raw ? JSON.parse(raw) : null;
    } catch (e) {
      this.auth = null;
    }
    return this.auth;
  },

  saveAuth: function (data) {
    this.auth = data || null;
    try {
      if (data) localStorage.setItem(this.TOKEN_KEY, JSON.stringify(data));
      else localStorage.removeItem(this.TOKEN_KEY);
    } catch (e) { /* 写入失败只影响下次免登录，不阻断使用 */ }
  },

  isLoggedIn: function () {
    var a = this.loadAuth();
    return !!(a && a.token);
  },

  token: function () {
    var a = this.loadAuth();
    return a ? a.token : '';
  },

  /* ---------------- 请求封装 ---------------- */

  request: async function (path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json; charset=utf-8' };
    if (this.token()) headers.Authorization = 'Bearer ' + this.token();

    var res;
    try {
      res = await fetch(this.API_BASE + path, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
    } catch (e) {
      var netErr = new Error('无法连接云端服务器，请检查网络后重试');
      netErr.offline = true;
      throw netErr;
    }

    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }

    if (!data || data.ok !== true) {
      var err = new Error((data && data.error) || ('云端返回错误（HTTP ' + res.status + '）'));
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /* ---------------- 认证 ---------------- */

  sendCode: function (email, purpose) {
    return this.request('/api/auth/send-code', {
      method: 'POST',
      body: { email: email, purpose: purpose }
    });
  },

  register: async function (email, code, nickname) {
    var d = await this.request('/api/auth/register', {
      method: 'POST',
      body: { email: email, code: code, nickname: nickname || '' }
    });
    this.saveAuth({ token: d.token, id: d.user.id, email: d.user.email, nickname: d.user.nickname });
    return d;
  },

  login: async function (email, code) {
    var d = await this.request('/api/auth/login', {
      method: 'POST',
      body: { email: email, code: code }
    });
    this.saveAuth({ token: d.token, id: d.user.id, email: d.user.email, nickname: d.user.nickname });
    return d;
  },

  logout: async function () {
    try { await this.request('/api/auth/logout', { method: 'POST' }); }
    catch (e) { /* 云端注销失败也要清掉本地凭证 */ }
    this.saveAuth(null);
    this.lastSyncAt = null;
    this.lastError = '';
  },

  me: function () {
    return this.request('/api/me');
  },

  /* ---------------- 成绩同步 ---------------- */

  /* 本地记录 -> 云端字段 */
  toCloud: function (r) {
    return {
      clientId: r.id,
      mode: r.mode || '',
      modeLabel: r.modeLabel || '',
      lessonLabel: r.lessonLabel || '',
      wpm: Number(r.wpm) || 0,
      acc: Number(r.acc) || 0,
      duration: Number(r.duration) || 0,
      errors: Number(r.errors) || 0,
      chars: Number(r.chars) || 0,
      weak: r.weak || {},
      cn: !!r.cn,
      finishedAt: r.finishedAt || r.createdAt || new Date().toISOString()
    };
  },

  /* 推送记录（服务端按 clientId 幂等，重复推送不会产生重复数据） */
  pushRecords: async function (records) {
    if (!this.isLoggedIn() || !records || !records.length) return { accepted: 0 };
    return this.request('/api/records', {
      method: 'POST',
      body: { records: records.map(this.toCloud.bind(this)) }
    });
  },

  /* 拉取云端记录并合并进本地（按 id 去重，只补本地缺失的） */
  pullRecords: async function () {
    if (!this.isLoggedIn()) return { added: 0 };
    var d = await this.request('/api/records?limit=2000');
    var localRes = await window.api.store.list('records');
    var localList = (localRes && localRes.data) || [];

    var have = {};
    localList.forEach(function (r) { have[r.id] = true; });

    var added = 0;
    for (var i = 0; i < d.records.length; i++) {
      var c = d.records[i];
      if (!c.clientId || have[c.clientId]) continue;
      await window.api.store.create('records', {
        id: c.clientId,
        mode: c.mode,
        modeLabel: c.modeLabel,
        lessonLabel: c.lessonLabel,
        wpm: c.wpm,
        acc: c.acc,
        duration: c.duration,
        errors: c.errors,
        chars: c.chars,
        weak: c.weak || {},
        cn: c.cn,
        finishedAt: c.finishedAt,
        createdAt: c.finishedAt
      });
      have[c.clientId] = true;
      added++;
    }
    return { added: added };
  },

  /* 全量同步：先上传本地全部记录，再把云端新增的拉回本地 */
  syncAll: async function () {
    if (!this.isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    if (this.syncing) return { ok: false, reason: 'busy' };

    this.syncing = true;
    this.lastError = '';
    try {
      var localRes = await window.api.store.list('records');
      var pushed = await this.pushRecords((localRes && localRes.data) || []);
      var pulled = await this.pullRecords();

      this.lastSyncAt = new Date();
      if (window.Stats) Stats.invalidate();
      if (window.Home) Home.invalidate();
      return { ok: true, pushed: pushed.accepted, pulled: pulled.added };
    } catch (e) {
      this.lastError = e.message;
      if (e.status === 401) this.saveAuth(null);
      return { ok: false, error: e.message };
    } finally {
      this.syncing = false;
    }
  },

  /* 训练结束后单条上报：失败静默，下次全量同步会补上 */
  pushOne: function (record) {
    if (!this.isLoggedIn() || !record || !record.id) return;
    this.pushRecords([record]).catch(function () { /* 静默重试交给下次同步 */ });
  },

  /* 与云端对时，用于“上次同步”展示 */
  fmtSyncTime: function () {
    if (!this.lastSyncAt) return '尚未同步';
    var d = this.lastSyncAt;
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
};

window.Cloud = Cloud;
