const { app, BrowserWindow, ipcMain, screen, Menu, Tray, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let settingsWindow = null;
let tray = null;

// Window shape presets
const SHAPES = {
  circle: { width: 200, height: 200 },
  rectangle: { width: 320, height: 240 },
  square: { width: 240, height: 240 },
};

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: SHAPES.circle.width,
    height: SHAPES.circle.height,
    x: screenWidth - SHAPES.circle.width - 40,
    y: screenHeight - SHAPES.circle.height - 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    icon: path.join(__dirname, 'build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Close settings window if main window is closed
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
  });
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  const mainBounds = mainWindow ? mainWindow.getBounds() : { x: 200, y: 200 };

  settingsWindow = new BrowserWindow({
    width: 380,
    height: 560,
    x: mainBounds.x - 400,
    y: mainBounds.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
    parent: mainWindow,
    icon: path.join(__dirname, 'build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.loadFile('settings.html');
  settingsWindow.setAlwaysOnTop(true, 'screen-saver');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createTray() {
  // Create a simple tray icon using nativeImage
  const icon = nativeImage.createFromPath(path.join(__dirname, 'build/icon.png')).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示/隐藏', click: () => toggleVisibility() },
    { label: '设置', click: () => createSettingsWindow() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  tray.setToolTip('FloatCamera');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => toggleVisibility());
}

function toggleVisibility() {
  if (mainWindow) {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  }
}

// IPC handlers
ipcMain.on('resize-window', (event, shape) => {
  if (mainWindow && SHAPES[shape]) {
    const bounds = mainWindow.getBounds();
    const newSize = SHAPES[shape];
    mainWindow.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: newSize.width,
      height: newSize.height,
    });
  }
});

ipcMain.on('set-size', (event, { width, height }) => {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: Math.round(width),
      height: Math.round(height),
    });
  }
});

ipcMain.on('close-app', () => {
  app.quit();
});

ipcMain.on('minimize-app', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

// Open settings window from renderer
ipcMain.on('open-settings', () => {
  createSettingsWindow();
});

ipcMain.on('close-settings', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
});

// Forward settings changes from settings window to main window
ipcMain.on('settings-changed', (event, data) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('apply-settings', data);
  }
});

// Forward shape/size changes to settings window for UI sync
ipcMain.on('request-current-state', (event) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('get-state');
  }
});

ipcMain.on('current-state', (event, stateData) => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('sync-state', stateData);
  }
});

// Manual drag support for the camera window
ipcMain.on('start-drag', (event) => {
  if (mainWindow) {
    // Use the built-in drag method
    mainWindow.webContents.executeJavaScript('void(0)');
  }
});

// Window move via IPC
ipcMain.on('move-window', (event, { deltaX, deltaY }) => {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({
      x: bounds.x + deltaX,
      y: bounds.y + deltaY,
      width: bounds.width,
      height: bounds.height,
    });
  }
});

// Settings window drag
ipcMain.on('move-settings-window', (event, { deltaX, deltaY }) => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    const bounds = settingsWindow.getBounds();
    settingsWindow.setBounds({
      x: bounds.x + deltaX,
      y: bounds.y + deltaY,
      width: bounds.width,
      height: bounds.height,
    });
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
