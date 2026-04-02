/**
 * DeskPet - 绿幕视频桌面宠物主进程
 * Main Process Entry Point
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const ConfigManager = require('./config-manager');
const VideoManager = require('./video-manager');

// 配置日志
log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

class DeskPetApp {
  constructor() {
    this.mainWindow = null;
    this.settingsWindow = null;
    this.tray = null;
    this.configManager = new ConfigManager();
    this.videoManager = new VideoManager();
    this.isQuitting = false;
    this.expectedWindowSize = null; // 期望的窗口大小
    this.resizeDebounceTimer = null;
    this.isRestoringSize = false; // 是否正在恢复大小
    
    this.init();
  }

  init() {
    // 单实例锁
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      log.warn('应用程序已在运行，退出新实例');
      app.quit();
      return;
    }

    // 监听第二个实例启动
    app.on('second-instance', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) {
          this.mainWindow.restore();
        }
        this.mainWindow.focus();
      }
    });

    // 注册 IPC 处理程序（在 app ready 之前注册）
    this.setupIPC();

    app.on('ready', () => this.onReady());
    app.on('window-all-closed', () => this.onWindowAllClosed());
    app.on('activate', () => this.onActivate());
    app.on('before-quit', () => this.onBeforeQuit());

    // 全局错误处理
    process.on('uncaughtException', (error) => {
      log.error('未捕获的异常:', error);
      dialog.showErrorBox('错误', '应用程序发生错误，即将退出。');
      app.quit();
    });

    process.on('unhandledRejection', (reason, promise) => {
      log.error('未处理的 Promise 拒绝:', reason);
    });
  }

  async onReady() {
    log.info('应用程序启动');
    
    try {
      await this.configManager.load();
      await this.createMainWindow();
      await this.createTray();
      // IPC 已在 init() 中注册
      
      log.info('应用程序初始化完成');
    } catch (error) {
      log.error('初始化失败:', error);
      dialog.showErrorBox('初始化错误', error.message);
      app.quit();
    }
  }

  async createMainWindow() {
    const config = this.configManager.get();
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    
    this.mainWindow = new BrowserWindow({
      width: config.window.width,
      height: config.window.height,
      x: config.window.x ?? width - config.window.width - 20,
      y: config.window.y ?? height - config.window.height - 20,
      frame: false,
      transparent: true,
      alwaysOnTop: config.window.alwaysOnTop ?? true,
      skipTaskbar: true,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      closable: true,
      focusable: false,
      hasShadow: false,
      opacity: config.window.opacity ?? 1.0,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false,
        allowRunningInsecureContent: true,
        experimentalFeatures: false
      }
    });

    // 设置窗口忽略鼠标事件（点击穿透）
    this.updateIgnoreMouseEvents();

    // 加载渲染进程
    await this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // 窗口事件
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });



    // 窗口移动时不再自动保存位置，只在应用退出时保存

    // 开发工具 - 始终打开以便调试
    this.mainWindow.webContents.openDevTools({ mode: 'detach' });

    log.info('主窗口创建完成');
  }

  async createTray() {
    try {
      // 尝试加载托盘图标
      const trayIconPath = path.join(__dirname, '../assets/icons/tray-icon.png');
      const iconPath = path.join(__dirname, '../assets/icons/icon.png');
      
      let trayIcon;
      
      if (fs.existsSync(trayIconPath)) {
        trayIcon = nativeImage.createFromPath(trayIconPath);
      } else if (fs.existsSync(iconPath)) {
        trayIcon = nativeImage.createFromPath(iconPath);
      } else {
        // 创建默认图标
        trayIcon = this.createDefaultTrayIcon();
        log.info('使用默认托盘图标');
      }
      
      this.tray = new Tray(trayIcon);
    } catch (error) {
      log.error('托盘创建失败:', error);
      // 不创建托盘，继续运行
      return;
    }
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示/隐藏',
        click: () => this.toggleWindow()
      },
      {
        label: '设置',
        click: () => this.openSettings()
      },
      { type: 'separator' },
      {
        label: '播放/暂停',
        click: () => this.togglePlayPause()
      },
      {
        label: '切换动画',
        click: () => this.switchAnimation()
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          this.isQuitting = true;
          app.quit();
        }
      }
    ]);

    this.tray.setToolTip('DeskPet - 桌面宠物');
    this.tray.setContextMenu(contextMenu);
    
    this.tray.on('click', () => this.toggleWindow());
    this.tray.on('double-click', () => this.openSettings());

    log.info('系统托盘创建完成');
  }

  createDefaultTrayIcon() {
    // 创建一个简单的 16x16 绿色圆点图标（使用 Buffer）
    const size = 16;
    // 创建一个简单的 PNG 图像数据（16x16 绿色圆点）
    // 这是一个极简的 PNG 数据，表示一个绿色圆点
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0xF3, 0xFF, 0x61, 0x00, 0x00, 0x00,
      0x01, 0x73, 0x52, 0x47, 0x42, 0x00, 0xAE, 0xCE, 0x1C, 0xE9, 0x00, 0x00,
      0x00, 0x04, 0x67, 0x41, 0x4D, 0x41, 0x00, 0x00, 0xB1, 0x8F, 0x0B, 0xFC,
      0x61, 0x05, 0x00, 0x00, 0x00, 0x09, 0x70, 0x48, 0x59, 0x73, 0x00, 0x00,
      0x0E, 0xC3, 0x00, 0x00, 0x0E, 0xC3, 0x01, 0xC7, 0x6F, 0xA8, 0x64, 0x00,
      0x00, 0x00, 0x1A, 0x49, 0x44, 0x41, 0x54, 0x38, 0x4F, 0x63, 0x60, 0x18,
      0x05, 0xA3, 0x60, 0x14, 0x8C, 0x82, 0x51, 0x30, 0x0A, 0x46, 0xC1, 0x28,
      0x18, 0x05, 0xA3, 0x00, 0x00, 0x01, 0x00, 0x05, 0xFF, 0x0D, 0x0A, 0x2B,
      0x4E, 0x75, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
      0x60, 0x82
    ]);
    
    return nativeImage.createFromBuffer(pngBuffer);
  }

  setupIPC() {
    // 获取配置
    ipcMain.handle('get-config', () => {
      return this.configManager.get();
    });

    // 保存配置
    ipcMain.handle('save-config', async (event, config) => {
      try {
        await this.configManager.update(config);
        this.applyConfig();
        return { success: true };
      } catch (error) {
        log.error('保存配置失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 实时预览配置（不保存到文件）
    ipcMain.handle('preview-config', (event, config) => {
      try {
        // 只应用配置，不保存
        if (this.mainWindow) {
          this.mainWindow.webContents.send('config-updated', config);
        }
        return { success: true };
      } catch (error) {
        log.error('预览配置失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取视频列表
    ipcMain.handle('get-videos', async () => {
      log.info('收到获取视频列表请求');
      const videos = await this.videoManager.getVideoList();
      log.info(`返回 ${videos.length} 个视频`);
      return videos;
    });

    // 选择视频目录
    ipcMain.handle('select-video-folder', async () => {
      const parentWindow = this.settingsWindow || this.mainWindow;
      const result = await dialog.showOpenDialog(parentWindow, {
        properties: ['openDirectory'],
        title: '选择视频目录'
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        this.configManager.set('video.folder', folderPath);
        await this.configManager.save();
        return { success: true, path: folderPath };
      }
      return { success: false };
    });

    // 打开设置窗口
    ipcMain.handle('open-settings-window', () => {
      this.openSettings();
    });

    // 窗口控制
    // 拖动窗口
    ipcMain.handle('window-move', (event, { x, y }) => {
      if (this.mainWindow) {
        // 保存期望的大小（首次拖动时，从配置中获取）
        if (!this.expectedWindowSize) {
          const config = this.configManager.get();
          this.expectedWindowSize = {
            width: config.window.width,
            height: config.window.height
          };
          const currentBounds = this.mainWindow.getBounds();
          console.log('[主进程] 拖动开始 - 当前大小:', currentBounds.width, currentBounds.height);
          console.log('[主进程] 拖动开始 - 期望大小:', this.expectedWindowSize);
        }
        
        // 使用 setBounds 同时设置位置和大小，避免 Electron 自动调整
        this.mainWindow.setBounds({
          x: Math.round(x),
          y: Math.round(y),
          width: this.expectedWindowSize.width,
          height: this.expectedWindowSize.height
        });
      }
    });

    // 拖动结束
    ipcMain.handle('window-move-end', () => {
      console.log('[主进程] 拖动结束，清除期望大小');
      if (this.mainWindow) {
        const config = this.configManager.get();
        const currentBounds = this.mainWindow.getBounds();
        console.log('[主进程] 拖动结束当前大小:', currentBounds.width, currentBounds.height);
        console.log('[主进程] 期望大小:', config.window.width, config.window.height);
        
        // 恢复窗口大小
        if (currentBounds.width !== config.window.width || currentBounds.height !== config.window.height) {
          this.mainWindow.setSize(config.window.width, config.window.height);
          console.log('[主进程] 恢复窗口大小到:', config.window.width, config.window.height);
        }
      }
      this.expectedWindowSize = null;
    });

    ipcMain.handle('window-resize', (event, { width, height }) => {
      if (this.mainWindow) {
        this.mainWindow.setSize(width, height);
      }
    });

    ipcMain.handle('get-window-position', () => {
      if (this.mainWindow) {
        const pos = this.mainWindow.getPosition();
        return { x: pos[0], y: pos[1] };
      }
      return { x: 0, y: 0 };
    });

    // 鼠标穿透控制
    ipcMain.handle('set-ignore-mouse-events', (event, ignore) => {
      this.configManager.set('window.clickThrough', ignore);
      this.updateIgnoreMouseEvents();
    });

    // 日志记录
    ipcMain.on('log', (event, { level, message, data }) => {
      if (log[level]) {
        log[level](message, data);
      }
    });

    log.info('IPC 通信设置完成');
  }

  updateIgnoreMouseEvents() {
    if (!this.mainWindow) return;
    
    const config = this.configManager.get();
    const ignore = config.window.clickThrough ?? false;
    
    // 设置忽略鼠标事件，但保留拖拽区域
    this.mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }

  applyConfig() {
    if (!this.mainWindow) return;
    
    const config = this.configManager.get();
    
    // 应用窗口设置
    this.mainWindow.setAlwaysOnTop(config.window.alwaysOnTop ?? true);
    this.mainWindow.setOpacity(config.window.opacity ?? 1.0);
    
    // 应用缩放
    const scale = config.window.scale ?? 1.0;
    const baseWidth = 300;
    const baseHeight = 400;
    const newWidth = Math.round(baseWidth * scale);
    const newHeight = Math.round(baseHeight * scale);
    this.mainWindow.setSize(newWidth, newHeight);
    
    this.updateIgnoreMouseEvents();
    
    // 通知渲染进程更新
    this.mainWindow.webContents.send('config-updated', config);
  }

  toggleWindow() {
    if (!this.mainWindow) return;
    
    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
    } else {
      this.mainWindow.show();
    }
  }

  openSettings() {
    if (this.settingsWindow) {
      this.settingsWindow.focus();
      return;
    }

    const config = this.configManager.get();
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    
    // 使用保存的设置窗口位置，如果没有则使用默认位置
    let settingsX = config.settingsWindow?.x;
    let settingsY = config.settingsWindow?.y;
    
    // 如果没有保存位置，则根据主窗口位置计算
    if (settingsX === null || settingsY === null) {
      settingsX = config.window.x ? config.window.x - 470 : width - 470 - 20;
      settingsY = config.window.y ?? height - 650 - 20;
    }
    
    this.settingsWindow = new BrowserWindow({
      width: 450,
      height: 650,
      x: settingsX,
      y: settingsY,
      frame: false,
      title: 'DeskPet 设置',
      resizable: true,
      minimizable: false,
      maximizable: false,
      parent: this.mainWindow,
      transparent: true,
      backgroundColor: '#2d2d2d',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    this.settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));

    // 保存设置窗口位置
    const saveSettingsWindowPosition = () => {
      if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
        const pos = this.settingsWindow.getPosition();
        this.configManager.set('settingsWindow.x', pos[0]);
        this.configManager.set('settingsWindow.y', pos[1]);
        this.configManager.save();
      }
    };
    
    this.settingsWindow.on('moved', saveSettingsWindowPosition);

    // 在关闭前保存位置
    this.settingsWindow.on('close', () => {
      saveSettingsWindowPosition();
    });

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });

    // 通知主窗口设置窗口已打开
    if (this.mainWindow) {
      this.mainWindow.webContents.send('settings-window-opened');
    }
  }

  closeSettings() {
    if (this.settingsWindow) {
      this.settingsWindow.close();
      this.settingsWindow = null;
    }
  }

  togglePlayPause() {
    if (!this.mainWindow) return;
    this.mainWindow.webContents.send('toggle-play-pause');
  }

  switchAnimation() {
    if (!this.mainWindow) return;
    this.mainWindow.webContents.send('switch-animation');
  }

  onWindowAllClosed() {
    // macOS 上通常保持应用运行直到用户明确退出
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }

  onActivate() {
    if (this.mainWindow === null) {
      this.createMainWindow();
    }
  }

  onBeforeQuit() {
    this.isQuitting = true;
    log.info('应用程序即将退出');
  }
}

// 启动应用
new DeskPetApp();
