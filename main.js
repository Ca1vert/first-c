const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// ==================== 数据文件管理 ====================
const dataFilePath = path.join(app.getPath('userData'), 'checkin-data.json');
const dataDir = path.dirname(dataFilePath);

let dataCache = null; // 内存缓存，避免重复 I/O

function readData() {
  if (dataCache) return dataCache;
  try {
    if (fs.existsSync(dataFilePath)) {
      dataCache = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
      return dataCache;
    }
  } catch (e) {
    console.error('读取数据文件失败:', e);
  }
  dataCache = { records: {} };
  return dataCache;
}

function writeData(data) {
  dataCache = data;
  const tmpPath = dataFilePath + '.tmp';
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, dataFilePath);
}

// ==================== 全局状态 ====================
let mainWindow = null;
let tray = null;
let isQuitting = false;

// ==================== 单实例锁 ====================
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showAndFocusWindow();
  });
}

// ==================== 窗口辅助 ====================
function showAndFocusWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// ==================== 创建窗口 ====================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 740,
    minWidth: 400,
    minHeight: 680,
    maxWidth: 600,
    maxHeight: 900,
    resizable: true,
    frame: true,
    autoHideMenuBar: true,
    backgroundColor: '#0f0f1a',
    title: '每日打卡',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 关闭窗口 → 隐藏到托盘
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// ==================== 系统托盘 ====================

// 预计算托盘图标 data URL（静态资源，仅需生成一次）
const TRAY_ICON_DATA_URL = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <circle cx="16" cy="16" r="14" fill="#6c63ff"/>
    <path d="M9 16l5 5 9-9" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
})();

function createTray() {
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);

  tray = new Tray(icon);
  tray.setToolTip('每日打卡');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => showAndFocusWindow(),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 左键点击托盘图标 → 切换窗口显示/隐藏
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showAndFocusWindow();
    }
  });
}

// ==================== IPC 处理 ====================
ipcMain.handle('load-data', () => {
  return readData();
});

ipcMain.handle('save-data', (_event, data) => {
  writeData(data);
  return true;
});

// ==================== 应用生命周期 ====================
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
