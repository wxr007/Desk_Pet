/**
 * DeskPet - 预加载脚本
 * Preload Script - 提供安全的 IPC 通信桥接
 */

const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 配置相关
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  previewConfig: (config) => ipcRenderer.invoke('preview-config', config),

  // 视频相关
  getVideos: () => ipcRenderer.invoke('get-videos'),
  selectVideoFolder: () => ipcRenderer.invoke('select-video-folder'),

  // 窗口控制
  moveWindow: (x, y) => ipcRenderer.invoke('window-move', { x, y }),
  moveWindowEnd: () => ipcRenderer.invoke('window-move-end'),
  resizeWindow: (width, height) => ipcRenderer.invoke('window-resize', { width, height }),
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.invoke('set-ignore-mouse-events', ignore),
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),

  // 事件监听
  onConfigUpdated: (callback) => {
    ipcRenderer.on('config-updated', (event, config) => callback(config));
  },
  onOpenSettings: (callback) => {
    ipcRenderer.on('open-settings', () => callback());
  },
  onTogglePlayPause: (callback) => {
    ipcRenderer.on('toggle-play-pause', () => callback());
  },
  onSwitchAnimation: (callback) => {
    ipcRenderer.on('switch-animation', () => callback());
  },

  // 日志
  log: (level, message, data) => {
    ipcRenderer.send('log', { level, message, data });
  },

  // 平台信息
  platform: process.platform,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome
  }
});
