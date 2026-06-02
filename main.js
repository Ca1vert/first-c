const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

// ==================== 数据文件管理 ====================
const dataFilePath = path.join(app.getPath('userData'), 'checkin-data.json');

function readData() {
  try {
    if (fs.existsSync(dataFilePath)) {
      return JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
    }
  } catch (e) {
    console.error('读取数据文件失败:', e);
  }
  return { records: {} };
}

function writeData(data) {
  const dir = path.dirname(dataFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // 原子写入：先写临时文件，再重命名
  const tmpPath = dataFilePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, dataFilePath);
}

// ==================== 单实例锁 ====================
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 第二个实例启动时，聚焦已有窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ==================== 全局引用 ====================
let mainWindow = null;
let tray = null;

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

  // ===== 关闭窗口 → 隐藏到托盘 =====
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// ==================== 系统托盘 ====================
function createTray() {
  const icon = createTrayIconPNG();

  tray = new Tray(icon);
  tray.setToolTip('每日打卡');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 左键点击托盘图标 → 切换窗口显示/隐藏
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// 生成托盘图标（紫色圆形 + 白色勾，SVG → nativeImage）
function createTrayIconPNG() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <circle cx="16" cy="16" r="14" fill="#6c63ff"/>
    <path d="M9 16l5 5 9-9" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml,${encodeURIComponent(svg)}`
  );
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

app.on('window-all-closed', () => {
  // Windows 上不退出，留在托盘
});

app.on('before-quit', () => {
  // 确保退出时销毁托盘图标
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

// app.isQuitting 标记，用于区分"关闭窗口"和"退出应用"
app.isQuitting = false;
