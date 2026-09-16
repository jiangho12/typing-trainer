'use strict';

/**
 * 安全桥：向渲染进程暴露白名单 API（contextIsolation 开启，nodeIntegration 关闭）
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    quit: () => ipcRenderer.invoke('app:quit')
  },
  store: {
    list: (domain) => ipcRenderer.invoke('store:list', domain),
    create: (domain, record) => ipcRenderer.invoke('store:create', domain, record),
    remove: (domain, id) => ipcRenderer.invoke('store:remove', domain, id),
    clear: (domain) => ipcRenderer.invoke('store:clear', domain),
    getSettings: () => ipcRenderer.invoke('store:getSettings'),
    saveSettings: (patch) => ipcRenderer.invoke('store:saveSettings', patch),
    overview: () => ipcRenderer.invoke('store:overview'),
    getDataDir: () => ipcRenderer.invoke('store:getDataDir'),
    openDataDir: () => ipcRenderer.invoke('store:openDataDir'),
    exportBackup: () => ipcRenderer.invoke('store:exportBackup')
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
  }
});
