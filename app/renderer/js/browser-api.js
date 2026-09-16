'use strict';

/*
 * 浏览器预览兼容层
 * Electron 由 preload.js 注入 window.api；普通浏览器（双击 html）没有，
 * 此适配器用 localStorage 提供相同形态的 API，保证同一份代码两种环境都能跑。
 */
(function installBrowserApi() {
  if (window.api && window.api.store) return;

  var STORAGE_KEY = 'typing-trainer.browser.v1';
  var DOMAINS = ['records', 'settings'];
  var clone = function (v) { return JSON.parse(JSON.stringify(v)); };
  var iso = function () { return new Date().toISOString(); };
  var newId = function () { return (crypto.randomUUID ? crypto.randomUUID() : 'web-' + Date.now() + '-' + Math.random().toString(16).slice(2)); };

  function seed() {
    return { records: [], settings: [{ id: 'settings' }] };
  }
  function loadAll() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (parsed && typeof parsed === 'object') {
        DOMAINS.forEach(function (d) { if (!Array.isArray(parsed[d])) parsed[d] = []; });
        return parsed;
      }
    } catch (e) { console.warn('[browser-api] 本地数据重置:', e); }
    var s = seed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return s;
  }
  var db = loadAll();
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
  function ref(domain) {
    if (DOMAINS.indexOf(domain) < 0) throw new Error('未知数据域: ' + domain);
    return db[domain];
  }
  function overview() {
    var records = ref('records').filter(function (r) { return r.mode !== 'game'; });
    var games = ref('records').filter(function (r) { return r.mode === 'game'; });
    var total = records.length;
    var best = records.reduce(function (m, r) { return Math.max(m, Number(r.wpm) || 0); }, 0);
    var seconds = Math.round(records.reduce(function (s, r) { return s + (Number(r.duration) || 0); }, 0));
    var avgAcc = total ? Math.round(records.reduce(function (s, r) { return s + (Number(r.acc) || 0); }, 0) / total) : 0;
    var bestGame = games.reduce(function (m, r) { return Math.max(m, Number(r.wpm) || 0); }, 0);
    var bestByMode = {};
    records.forEach(function (r) { bestByMode[r.mode] = Math.max(bestByMode[r.mode] || 0, Number(r.wpm) || 0); });
    return { total: total, best: best, seconds: seconds, avgAcc: avgAcc, bestGame: bestGame, gamesPlayed: games.length, bestByMode: bestByMode };
  }
  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  var store = {
    list: async function (domain) { return { ok: true, data: clone(ref(domain)) }; },
    create: async function (domain, record) {
      var item = Object.assign({ id: newId(), createdAt: iso() }, clone(record));
      ref(domain).push(item);
      if (domain === 'records' && ref(domain).length > 500) ref(domain).splice(0, ref(domain).length - 500);
      save();
      return { ok: true, data: clone(item) };
    },
    remove: async function (domain, id) {
      var items = ref(domain);
      var i = items.findIndex(function (x) { return x.id === id; });
      if (i < 0) return { ok: true, data: false };
      items.splice(i, 1); save();
      return { ok: true, data: true };
    },
    clear: async function (domain) { ref(domain).length = 0; save(); return { ok: true, data: true }; },
    getSettings: async function () { return clone(db.settings[0] || {}); },
    saveSettings: async function (patch) {
      db.settings[0] = Object.assign(db.settings[0] || { id: 'settings' }, clone(patch));
      save(); return clone(db.settings[0]);
    },
    overview: async function () { return overview(); },
    getDataDir: async function () { return '浏览器本地存储（Local Storage）'; },
    openDataDir: async function () { return false; },
    exportBackup: async function () {
      var payload = { app: 'typing-trainer', exportedAt: iso(), records: clone(ref('records')), settings: clone(db.settings[0] || {}) };
      downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), '打字练习成绩备份-' + iso().slice(0, 10) + '.json');
      return { ok: true };
    }
  };

  window.api = {
    app: { getVersion: async function () { return { version: 'browser', platform: 'web' }; } },
    store: store,
    shell: { openExternal: async function (url) { window.open(url, '_blank', 'noopener'); return true; } }
  };
  window.__BROWSER_PREVIEW__ = true;
})();
