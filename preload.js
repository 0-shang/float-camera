const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  resizeWindow: (shape) => ipcRenderer.send('resize-window', shape),
  setSize: (width, height) => ipcRenderer.send('set-size', { width, height }),
  closeApp: () => ipcRenderer.send('close-app'),
  minimizeApp: () => ipcRenderer.send('minimize-app'),
  openSettings: () => ipcRenderer.send('open-settings'),
  moveWindow: (deltaX, deltaY) => ipcRenderer.send('move-window', { deltaX, deltaY }),
  // Listen for settings changes from settings window
  onApplySettings: (callback) => ipcRenderer.on('apply-settings', (event, data) => callback(data)),
  // State sync
  onGetState: (callback) => ipcRenderer.on('get-state', (event) => callback()),
  sendCurrentState: (stateData) => ipcRenderer.send('current-state', stateData),
});
