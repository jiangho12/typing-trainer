'use strict';

/**
 * 本地数据存储层
 * 每个数据域一个 JSON 文件，保存在 Electron userData/data 目录下，全部数据严格本地存储。
 * 写入采用「临时文件 + 原子重命名」，避免写一半导致文件损坏。
 */
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DOMAINS = ['records', 'settings'];

const memoryCache = {};

function dataDir() {
  const dir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function fileFor(domain) {
  return path.join(dataDir(), `${domain}.json`);
}

function ensureDomain(domain) {
  if (!DOMAINS.includes(domain)) throw new Error(`未知数据域: ${domain}`);
}

function load(domain) {
  ensureDomain(domain);
  if (memoryCache[domain]) return memoryCache[domain];
  const fp = fileFor(domain);
  let data = [];
  if (fs.existsSync(fp)) {
    try {
      const raw = fs.readFileSync(fp, 'utf-8');
      data = raw.trim() ? JSON.parse(raw) : [];
    } catch (e) {
      console.error(`[store] 读取 ${domain} 失败，使用空数据:`, e.message);
      data = [];
    }
  }
  memoryCache[domain] = data;
  return data;
}

function persist(domain) {
  const data = memoryCache[domain] || [];
  const fp = fileFor(domain);
  const tmp = `${fp}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, fp);
}

function newId() {
  return crypto.randomUUID();
}

/* ---------------- 通用 CRUD ---------------- */

function list(domain) {
  return load(domain);
}

function create(domain, record) {
  const listRef = load(domain);
  const item = { id: newId(), createdAt: new Date().toISOString(), ...record };
  listRef.push(item);
  // 成绩表只保留最近 500 条，避免长期使用后文件无限膨胀
  if (domain === 'records' && listRef.length > 500) listRef.splice(0, listRef.length - 500);
  persist(domain);
  return item;
}

function remove(domain, id) {
  const listRef = load(domain);
  const idx = listRef.findIndex((x) => x.id === id);
  if (idx === -1) return false;
  listRef.splice(idx, 1);
  persist(domain);
  return true;
}

function clearDomain(domain) {
  ensureDomain(domain);
  memoryCache[domain] = [];
  persist(domain);
  return true;
}

/* ---------------- 设置（单例） ---------------- */

function getSettings() {
  const s = load('settings');
  return s && s.length ? s[0] : {};
}

function saveSettings(patch) {
  const cur = getSettings();
  const merged = { ...cur, ...patch };
  const listRef = load('settings');
  if (listRef.length === 0) listRef.push({ id: 'settings', ...merged });
  else listRef[0] = { ...listRef[0], ...merged };
  persist('settings');
  return listRef[0];
}

/* ---------------- 汇总统计（首页/统计页） ---------------- */

function overview() {
  const records = load('records').filter((r) => r.mode !== 'game');
  const games = load('records').filter((r) => r.mode === 'game');
  const total = records.length;
  const best = records.reduce((m, r) => Math.max(m, Number(r.wpm) || 0), 0);
  const seconds = Math.round(records.reduce((s, r) => s + (Number(r.duration) || 0), 0));
  const avgAcc = total ? Math.round(records.reduce((s, r) => s + (Number(r.acc) || 0), 0) / total) : 0;
  const bestGame = games.reduce((m, r) => Math.max(m, Number(r.wpm) || 0), 0);
  // 各模式最佳速度
  const bestByMode = {};
  records.forEach((r) => { bestByMode[r.mode] = Math.max(bestByMode[r.mode] || 0, Number(r.wpm) || 0); });
  return { total, best, seconds, avgAcc, bestGame, gamesPlayed: games.length, bestByMode };
}

/* ---------------- 数据目录 / 备份 ---------------- */

function getDataDirPath() {
  return dataDir();
}

function backupAll() {
  const dir = dataDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(app.getPath('userData'), 'backups', `backup-${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  DOMAINS.forEach((d) => {
    const fp = fileFor(d);
    if (fs.existsSync(fp)) fs.copyFileSync(fp, path.join(backupDir, `${d}.json`));
  });
  return backupDir;
}

module.exports = {
  DOMAINS,
  list, create, remove, clearDomain,
  getSettings, saveSettings,
  overview,
  getDataDirPath, backupAll,
  dataDir
};
