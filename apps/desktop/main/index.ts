import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { registerIpcHandlers, initializeServices } from './ipc/handlers';
import { startAllServices, stopAllServices, getServicesStatus, healthCheck } from './services/serviceManager';
import { registerTerminalHandlers, shutdownTerminal } from './services/terminalHandlers';

// 是否开发环境
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: '需求自动化管理',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    // 隐藏默认菜单栏（Windows）
    autoHideMenuBar: true,
    // macOS 标题栏样式
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  if (isDev) {
    // 开发模式：加载Vite开发服务器
    mainWindow.loadURL('http://localhost:3499');
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用就绪
app.whenReady().then(async () => {
  // 启动微服务（AI服务）
  await startAllServices();

  // 初始化服务
  initializeServices();

  // 注册 IPC 处理器
  registerIpcHandlers();

  // 注册终端 IPC 处理器
  registerTerminalHandlers();

  createWindow();

  // 定期健康检查（每30秒）
  setInterval(() => {
    healthCheck();
  }, 30000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出（macOS除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前停止所有服务
app.on('before-quit', () => {
  shutdownTerminal();
  stopAllServices();
});

// 应用完全退出时确保服务已停止
app.on('quit', () => {
  shutdownTerminal();
  stopAllServices();
});

// IPC处理器：获取应用路径
ipcMain.handle('app:getPath', (_, name: string) => {
  return app.getPath(name as Parameters<typeof app.getPath>[0]);
});

// IPC处理器：获取应用版本
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// IPC处理器：获取服务状态
ipcMain.handle('services:getStatus', async () => {
  return await getServicesStatus();
});
