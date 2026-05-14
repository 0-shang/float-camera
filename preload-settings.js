const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  closeSettings: () => ipcRenderer.send('close-settings'),
  sendSettingsChange: (data) => ipcRenderer.send('settings-changed', data),
  resizeWindow: (shape) => ipcRenderer.send('resize-window', shape),
  setSize: (width, height) => ipcRenderer.send('set-size', { width, height }),
  moveSettingsWindow: (deltaX, deltaY) => ipcRenderer.send('move-settings-window', { deltaX, deltaY }),
  requestCurrentState: () => ipcRenderer.send('request-current-state'),
  onSyncState: (callback) => ipcRenderer.on('sync-state', (event, data) => callback(data)),
});
