'use strict';

/* ============ 成绩统计页 ============ */

var Stats = {
  dirty: true,
  invalidate: function () { this.dirty = true; },

  accClass: function (acc) { return acc >= 95 ? 'acc-ok' : acc >= 85 ? 'acc-mid' : 'acc-low'; },
  fmtDateTime: function (iso) {
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  },

  render: async function () {
    var res = await window.api.store.list('records');
    var records = (res.data || []).slice().sort(function (a, b) {
      return new Date(b.createdAt || b.finishedAt) - new Date(a.createdAt || a.finishedAt);
    });
    var ov = await window.api.store.overview();

    var mins = Math.floor(ov.seconds / 60);
    document.getElementById('statsOverview').innerHTML = [
      [ov.total, '训练次数 SESSIONS', ''],
      [ov.best, '最高速度 BEST', ov.total ? '<span class="unit">WPM/字</span>' : '<span class="unit"></span>'],
      [ov.avgAcc + '%', '平均准确率 AVG ACC', ''],
      [mins, '累计训练分钟 MINUTES', '']
    ].map(function (c, i) {
      return '<div class="stat-card"><div class="lbl">' + c[1] + '</div><div class="num' + (i === 2 ? ' hl-green' : '') + '">' + c[0] + c[2] + '</div></div>';
    }).join('');

    var body = document.getElementById('recordsBody');
    var empty = document.getElementById('recordsEmpty');
    if (!records.length) {
      body.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      body.innerHTML = records.map(function (r) {
        var mode = r.modeLabel + (r.lessonLabel ? ' · ' + r.lessonLabel : '');
        var speed = r.mode === 'game'
          ? '<span class="tag hl">' + r.wpm + ' 分</span>'
          : r.wpm + ' <span class="muted">' + (r.cn ? '字/分' : 'WPM') + '</span>';
        var acc = r.mode === 'game' ? '<span class="muted">—</span>'
          : '<span class="' + this.accClass(r.acc) + '">' + r.acc + '%</span>';
        var dur = r.mode === 'game' ? '<span class="muted">—</span>' : App.fmtTime(r.duration);
        var err = r.mode === 'game' ? '拦截 ' + r.chars + ' 词' : r.errors + ' 次';
        return '<tr><td>' + this.fmtDateTime(r.createdAt || r.finishedAt) + '</td><td>' + mode + '</td>' +
          '<td class="num">' + speed + '</td><td class="num">' + acc + '</td>' +
          '<td class="num">' + dur + '</td><td class="num">' + err + '</td></tr>';
      }, this).join('');
    }
    this.dirty = false;
  }
};

/* ============ 首页概况 ============ */
var Home = {
  dirty: true,
  invalidate: function () { this.dirty = true; },

  render: async function () {
    var ov = await window.api.store.overview();
    var mins = Math.floor(ov.seconds / 60);
    document.getElementById('homeStats').innerHTML = [
      [ov.best || 0, '最高速度 BEST', ov.total ? 'WPM/字' : ''],
      [ov.avgAcc ? ov.avgAcc + '%' : '—', '平均准确率 AVG ACC', ''],
      [ov.total, '完成训练 SESSIONS', ''],
      [mins, '训练时长 MINUTES', '']
    ].map(function (c) {
      return '<div class="stat-card"><div class="lbl">' + c[1] + '</div><div class="num">' + c[0] +
        (c[2] ? '<span class="unit"> ' + c[2] + '</span>' : '') + '</div></div>';
    }).join('');

    var grid = document.getElementById('modeGrid');
    grid.innerHTML = MODE_ORDER.map(function (mode, i) {
      var m = MODES[mode];
      var best = ov.bestByMode[mode];
      var bestTag = best ? '<span class="mc-code">BEST ' + best + '</span>' : '<span class="mc-code">MODULE 0' + (i + 1) + '</span>';
      return '<button class="mode-card" data-page="practice" data-mode="' + mode + '">' +
        bestTag +
        '<span class="mc-ico">' + MODE_ICONS[mode] + '</span>' +
        '<h3>' + m.name + '</h3><p>' + m.sub + '</p></button>';
    }).join('');
    grid.querySelectorAll('.mode-card').forEach(function (c) {
      c.onclick = function () { App.navigate('practice', { mode: c.dataset.mode, index: 0 }); };
    });
    this.dirty = false;
  }
};

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('clearRecords').onclick = async function () {
    if (!confirm('确定清空全部训练与游戏成绩？此操作不可恢复（建议先导出备份）。')) return;
    await window.api.store.clear('records');
    Stats.invalidate(); Home.invalidate();
    App.toast('成绩已清空', 'ok');
    Stats.render();
  };
  document.getElementById('exportBtn').onclick = async function () {
    var r = await window.api.store.exportBackup();
    if (r && r.ok) App.toast('成绩备份已导出', 'ok');
  };
  document.getElementById('dataDirBtn').onclick = async function () {
    var dir = await window.api.store.getDataDir();
    var opened = await window.api.store.openDataDir();
    if (!opened) App.toast('数据位置：' + dir);
  };
});
