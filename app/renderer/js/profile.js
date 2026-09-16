'use strict';

/* ============ 我的主页：账号信息与云端同步 ============ */

var Profile = {
  cloudStats: null,
  lastDetail: '',

  el: function (id) { return document.getElementById(id); },

  esc: function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  fmtTime: function (d) {
    if (!d) return '—';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  },

  /* 取数（只更新内存，不动 DOM） */
  fetch: async function () {
    var auth = Cloud.loadAuth();
    if (!auth || !auth.token) {
      this.cloudStats = null;
      return;
    }
    try {
      var d = await Cloud.me();
      this.cloudStats = d.stats;
      Cloud.lastError = '';
      Cloud.saveAuth({ token: Cloud.token(), id: d.user.id, email: d.user.email, nickname: d.user.nickname });
    } catch (e) {
      this.cloudStats = null;
      Cloud.lastError = e.message;
      if (e.status === 401) {
        Cloud.saveAuth(null);
        App.toast('登录已过期，请重新登录', 'error');
        Auth.show('login');
      }
    }
  },

  render: async function () {
    await this.fetch();
    await this.paint();
  },

  paint: async function () {
    var a = Cloud.loadAuth();
    var localRes = await window.api.store.list('records');
    var localCount = ((localRes && localRes.data) || []).length;
    var loggedIn = !!(a && a.token);

    /* ---- 账号卡片 ---- */
    if (!loggedIn) {
      this.el('profileAccount').innerHTML =
        '<div class="empty-state" style="padding:34px 20px">' +
        '<div>当前未登录，无法使用云端同步</div>' +
        '<button class="btn btn-primary" id="profileLoginBtn" style="margin-top:16px">去登录</button>' +
        '</div>';
      var lb = this.el('profileLoginBtn');
      if (lb) lb.onclick = function () { Auth.show('login'); };
    } else {
      this.el('profileAccount').innerHTML = [
        ['账号邮箱 EMAIL', this.esc(a.email || '—')],
        ['昵称 NICKNAME', this.esc(a.nickname || '未设置')],
        ['账号 ID', this.esc(a.id || '—')],
        ['登录状态', '<span class="tag ok">已登录</span>']
      ].map(function (row) {
        return '<div class="kv-row"><span class="kv-k">' + row[0] + '</span><span class="kv-v">' + row[1] + '</span></div>';
      }).join('');
    }

    /* ---- 云端同步卡片 ---- */
    var statusTag = !loggedIn ? '<span class="tag bad">未登录</span>'
      : Cloud.syncing ? '<span class="tag hl">同步中…</span>'
        : '<span class="tag ok">已连接</span>';

    var rows = [
      ['同步状态 STATUS', statusTag],
      ['上次同步 LAST SYNC', this.esc(Cloud.lastSyncAt ? this.fmtTime(Cloud.lastSyncAt) : '尚未同步')],
      ['本机成绩 LOCAL', localCount + ' 条'],
      ['云端地址 ENDPOINT', '<span class="mono-sm">' + this.esc(Cloud.API_BASE) + '</span>']
    ];

    if (this.cloudStats) {
      var s = this.cloudStats;
      rows.push(['云端成绩 CLOUD', (s.total + s.gamesPlayed) + ' 条']);
      rows.push(['云端最高速度 BEST', s.best + ' <span class="muted">WPM/字</span>']);
      rows.push(['云端平均准确率', s.avgAcc ? s.avgAcc + '%' : '—']);
      rows.push(['云端累计时长', Math.floor(s.seconds / 60) + ' 分钟']);
    }
    if (Cloud.lastError) {
      rows.push(['最近错误 ERROR', '<span style="color:var(--red)">' + this.esc(Cloud.lastError) + '</span>']);
    }

    this.el('profileCloud').innerHTML = rows.map(function (row) {
      return '<div class="kv-row"><span class="kv-k">' + row[0] + '</span><span class="kv-v">' + row[1] + '</span></div>';
    }).join('') + (this.lastDetail ? '<div class="profile-detail">' + this.esc(this.lastDetail) + '</div>' : '');

    /* ---- 按钮态 ---- */
    var syncBtn = this.el('profileSyncBtn');
    var outBtn = this.el('profileLogoutBtn');
    if (syncBtn) {
      syncBtn.disabled = !loggedIn || Cloud.syncing;
      syncBtn.textContent = Cloud.syncing ? '同步中…' : '立即同步';
    }
    if (outBtn) outBtn.disabled = !loggedIn;
  },

  sync: async function () {
    if (!Cloud.isLoggedIn()) { Auth.show('login'); return; }
    this.lastDetail = '正在同步…';
    await this.paint();
    var r = await Cloud.syncAll();
    this.lastDetail = (r && r.ok)
      ? '同步完成：上传 ' + r.pushed + ' 条，从云端新增 ' + r.pulled + ' 条'
      : '同步失败：' + ((r && r.error) || '未知原因');
    App.toast((r && r.ok) ? '同步完成' : this.lastDetail, (r && r.ok) ? 'ok' : 'error', 3600);
    await this.fetch();
    await this.paint();
  },

  logout: async function () {
    if (!confirm('确定退出当前账号？\n本机成绩会保留，重新登录后仍可同步。')) return;
    await Cloud.logout();
    this.cloudStats = null;
    this.lastDetail = '';
    App.toast('已退出登录', 'ok');
    Auth.show('login');
    await this.paint();
  }
};

document.addEventListener('DOMContentLoaded', function () {
  var s = document.getElementById('profileSyncBtn');
  var o = document.getElementById('profileLogoutBtn');
  if (s) s.onclick = function () { Profile.sync(); };
  if (o) o.onclick = function () { Profile.logout(); };
});
