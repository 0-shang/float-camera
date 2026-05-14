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
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAABGBJREFUWEftl01oXFUUx3/nzryZJJNMko6NTdJqUhVbP1BR3Igi4kJEEBcuRBB0IYgbwY2CuBEXbnQhIiIuXIkgFEVQEQQR/EBRtEVrq9ZqbZJm0nxkMpN5c+/xnDczmWkmTYUKurjMzL33nP/5n/85c8XfPOTvrp//AXa3Avkf4H+A/4tCf6cLJK8fcj6eQXgfkXFU+kG6gWMoFxA5jep7FDqXS38q33nulwK8gcjDIA8BxzYBsRnE3xB5DfRl8qlT/HKle8bv7wN0IM2DfACyMl/Axjo3Qp0L8wXgJ8YA1hpLnv+Bf2VWzqnY/EwIPcgcuYGFNidqOxBOAl8Lp76PPMXD3vO3TcT3/wPNK5sUH/SnCSTJ6wE+kHOARchsqVfwdg15gDGaL7tPlIbD8J2H8FYhBkACXfVMhqkNEf/FDaV6/bDvjuAFQeQeUCcB2wt87BOLQGi4/kVJvU1OlReQp4HhFf4zY0Q/4+xn7z11YuJ35oOh4G6QPZY+VU8CuhbY2SrIWxiT3Y1yWfVBZx/N/P4PAFPAhEUrfS2AdxE5B/KhW+yuvp5cbh2kBWIk8DtwSZO5BuEKymhpjJ4yAjW2fhmAjgJHAY+YuXS/0y49aWD5YecIvIU8AJwsInEn6j8BPwCzKE6h+p3wFeJ3Ee5RuyOhNjBJCrXdxQ+aR7c6feSl1m5/EncQmR0y+i3g/QC3cAOlMNhIE/s2oWSy+m1xCQmQQZBRlG5BuWwyBcoR3CuT6YwDqsBYQjKHuBvs0mNV8h8inlUBrhA5Qn7z+SbXjEMOAnkPlN9xPUn0DkIY6uivFZ9ckk2kBxA/D1BJWLA0jHAXuBJ1qVWqyg+gJV36nP8qN5KjGAB+C7wCdRHTeLuZzgHPAb+SDhYjdWC6wCPgSlYf1LnnC++HecCrIwzuAfYYEGlGpR94CfQRVD7FuetKP/oO3TcT5jEMsBe4DerZn9N5BpXDqq6A+oy1YlPmvJjz6bkMSKPAMO7HGINkE8Qf4/iw+bT1c20X/AOYB9OyJMj9J3r2SPYCqngdPp8n7hc/tHuH4dqvwvOo9l8gnCVxjr/lE/fhNgN47K5VFgQ+AO4DdIG3rCMr34PLpFZCprSLMJ13ERlHvB/5hkfh/0CeAU+0lpx8qp8djF1pFZbdYKYl8CnwA/CyV5yofFT9qPTJdDPUjNt9xVfBz4HprIwE0c+AWIy8AXmJd16P7c9eMBXjpNRiuDpb8nTpQ+dPO2Y7CY2RKdE6d/h3kb0SfNx5hPrJ8ROwJ3gMd3aSJhQfQq/HuS9MU/eRG0bMQDCEa/4ue7j8pLFKH2AWiJQ9hJ4Kv3uU9UHqo9WLBkl3rI+0RWfh/kBebQVxpxHIHKqmQV9B/RuVz4BvGvmZnQbwdsNAqGLMbVCfcMf1Zfsr7L77N9m2rQb3Dv3fB3A5sv0NR5MAAAAASUVORK5CYII='
  );

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
