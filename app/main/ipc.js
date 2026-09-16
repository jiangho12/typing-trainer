'use strict';

/**
 * IPC 通道注册
 * 渲染进程通过 preload 暴露的白名单 API 与主进程通信，所有数据均落盘本地。
 */
const { ipcMain, dialog, app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const store = require('./store');

function registerIpc() {
  /* ---------- 通用 ---------- */
  ipcMain.handle('app:getVersion', () => ({ version: app.getVersion(), platform: process.platform }));
  ipcMain.handle('app:quit', () => { app.quit(); return { ok: true }; });

  /* ---------- 数据 CRUD ---------- */
  ipcMain.handle('store:list', (e, domain) => {
    try { return { ok: true, data: store.list(domain) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('store:create', (e, domain, record) => {
    try { return { ok: true, data: store.create(domain, record) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('store:remove', (e, domain, id) => {
    try { return { ok: true, data: store.remove(domain, id) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('store:clear', (e, domain) => {
    try { return { ok: true, data: store.clearDomain(domain) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('store:getSettings', () => store.getSettings());
  ipcMain.handle('store:saveSettings', (e, patch) => store.saveSettings(patch || {}));
  ipcMain.handle('store:overview', () => store.overview());
  ipcMain.handle('store:getDataDir', () => store.getDataDirPath());
  ipcMain.handle('store:openDataDir', () => shell.openPath(store.getDataDirPath()));

  /* ---------- 导出备份（JSON） ---------- */
  ipcMain.handle('store:exportBackup', async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const win = BrowserWindowFocused();
    const res = await dialog.showSaveDialog(win, {
      title: '导出成绩备份',
      defaultPath: path.join(app.getPath('documents'), `打字练习成绩备份-${stamp}.json`),
      filters: [{ name: 'JSON 备份', extensions: ['json'] }]
    });
    if (res.canceled || !res.filePath) return { ok: false, canceled: true };
    const payload = {
      app: 'typing-trainer',
      exportedAt: new Date().toISOString(),
      records: store.list('records'),
      settings: store.getSettings()
    };
    fs.writeFileSync(res.filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return { ok: true, filePath: res.filePath };
  });

  /* ---------- 外部链接 ---------- */
  ipcMain.handle('shell:openExternal', (e, url) => {
    if (typeof url === 'string' && url.startsWith('http')) shell.openExternal(url);
    return { ok: true };
  });
}

function BrowserWindowFocused() {
  // 延迟 require，避免循环依赖问题
  return require('electron').BrowserWindow.getFocusedWindow() ||
    require('electron').BrowserWindow.getAllWindows()[0];
}

module.exports = { registerIpc };
