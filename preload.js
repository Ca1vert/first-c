const { contextBridge, ipcRenderer } = require('electron');

// 通过 contextBridge 安全地向渲染进程暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
});
