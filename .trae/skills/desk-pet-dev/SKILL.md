---
name: "desk-pet-dev"
description: "DeskPet 绿幕视频桌面宠物项目开发助手。包含项目架构、常见问题解决方案、Electron 窗口管理技巧。Invoke when working on the DeskPet project or when encountering Electron window dragging/resizing issues."
---

# DeskPet 开发助手

## 项目概述

DeskPet 是一个基于 Electron + HTML/CSS/JS + GSAP 开发的绿幕视频桌面宠物应用。

### 核心功能
- **绿幕抠图透明悬浮** - 实时绿幕抠图，实现透明背景效果
- **智能宠物行为** - 自动切换坐着/走路动画，智能移动和边界检测
- **视频播放控制** - 循环播放、暂停、动画切换
- **视频拖动** - 支持拖动视频窗口位置
- **系统托盘管理** - 托盘图标菜单控制
- **自定义设置** - 透明度、缩放、视频选择、绿幕参数

## 项目结构

```
Desk_Pet/
├── src/
│   ├── main/              # 主进程代码
│   │   ├── main.js        # 主进程入口
│   │   ├── preload.js     # 预加载脚本（IPC通信）
│   │   ├── config-manager.js  # 配置管理
│   │   └── video-manager.js   # 视频管理
│   ├── renderer/          # 渲染进程代码
│   │   ├── index.html     # 主窗口HTML
│   │   ├── app.js         # 主窗口逻辑
│   │   ├── styles.css     # 样式文件
│   │   ├── settings.html  # 设置窗口HTML
│   │   └── settings.js    # 设置窗口逻辑
│   └── assets/            # 资源文件
│       ├── videos/        # 视频文件
│       └── icons/         # 图标文件
├── config/                # 配置文件目录
│   └── settings.json      # 用户配置
└── package.json
```

## 关键技术实现

### 1. 绿幕抠图（Canvas API）

使用 Canvas API 实现实时绿幕抠图：

```javascript
// 核心逻辑在 app.js 的 renderChromaFrame 方法
renderChromaFrame() {
  const { canvas, video } = this.elements;
  const ctx = canvas.getContext('2d');
  
  // 绘制视频帧
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // 获取像素数据
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // 绿幕抠图算法
  const chromaColor = this.config.video.chromaKey.color;
  const similarity = this.config.video.chromaKey.similarity;
  const smoothness = this.config.video.chromaKey.smoothness;
  
  // 转换颜色
  const r = parseInt(chromaColor.slice(1, 3), 16);
  const g = parseInt(chromaColor.slice(3, 5), 16);
  const b = parseInt(chromaColor.slice(5, 7), 16);
  
  // 处理每个像素
  for (let i = 0; i < data.length; i += 4) {
    const pixelR = data[i];
    const pixelG = data[i + 1];
    const pixelB = data[i + 2];
    
    // 计算与绿幕颜色的相似度
    const diff = Math.sqrt(
      Math.pow(pixelR - r, 2) +
      Math.pow(pixelG - g, 2) +
      Math.pow(pixelB - b, 2)
    ) / 441.67; // 归一化
    
    // 根据相似度设置透明度
    if (diff < similarity) {
      const alpha = Math.min(1, diff / (similarity * (1 - smoothness)));
      data[i + 3] = Math.floor(alpha * 255);
    }
  }
  
  // 写回画布
  ctx.putImageData(imageData, 0, 0);
}
```

### 2. Electron 窗口拖动（Windows 平台问题）

**问题**：在 Windows 上使用 `setPosition` 拖动窗口时，窗口大小会自动增大。

**解决方案**：使用 `setBounds` 同时设置位置和大小：

```javascript
// main.js
ipcMain.handle('window-move', (event, { x, y }) => {
  if (this.mainWindow) {
    // 保存期望的大小（首次拖动时，从配置中获取）
    if (!this.expectedWindowSize) {
      const config = this.configManager.get();
      this.expectedWindowSize = {
        width: config.window.width,
        height: config.window.height
      };
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
  if (this.mainWindow) {
    const config = this.configManager.get();
    const currentBounds = this.mainWindow.getBounds();
    
    // 恢复窗口大小
    if (currentBounds.width !== config.window.width || 
        currentBounds.height !== config.window.height) {
      this.mainWindow.setSize(config.window.width, config.window.height);
    }
  }
  this.expectedWindowSize = null;
});
```

**渲染进程实现**（app.js）：

```javascript
// 视频拖动功能
this.elements.videoContainer.addEventListener('mousedown', async (e) => {
  if (e.target.closest('.controls')) return;
  if (this.config.interaction?.dragEnabled === false) return;
  
  isDragging = false;
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  
  // 获取当前窗口位置
  try {
    const pos = await window.electronAPI.getWindowPosition();
    windowStartX = pos.x;
    windowStartY = pos.y;
  } catch (error) {
    console.error('获取窗口位置失败:', error);
    return;
  }
  
  // 节流控制（约60fps）
  let lastMoveTime = 0;
  const moveThrottleMs = 16;
  
  const handleMouseMove = (e) => {
    const dx = e.screenX - dragStartX;
    const dy = e.screenY - dragStartY;
    
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      isDragging = true;
    }
    
    if (isDragging) {
      const now = Date.now();
      if (now - lastMoveTime >= moveThrottleMs) {
        const newX = windowStartX + dx;
        const newY = windowStartY + dy;
        lastMoveTime = now;
        window.electronAPI.moveWindow(newX, newY);
      }
    }
  };
  
  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    // 通知主进程拖动结束
    window.electronAPI.moveWindowEnd();
    setTimeout(() => { isDragging = false; }, 50);
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
});
```

### 3. 无边框设置窗口

创建无边框设置窗口：

```javascript
// main.js
openSettings() {
  if (this.settingsWindow) {
    this.settingsWindow.focus();
    return;
  }

  const config = this.configManager.get();
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  // 使用保存的设置窗口位置
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
    frame: false,           // 无边框
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
  this.settingsWindow.on('close', saveSettingsWindowPosition);

  this.settingsWindow.on('closed', () => {
    this.settingsWindow = null;
  });
}
```

### 4. 智能宠物行为系统

宠物行为状态机实现（app.js）：

```javascript
// 动画分类
this.videoCategories = {
  sit: [],      // 坐着动画（文件名包含"-坐"）
  walkLeft: [], // 向左走（文件名包含"-走"和"-左"）
  walkRight: [] // 向右走（文件名包含"-走"，不含"-左"）
};

// 宠物状态
this.petState = 'idle';     // 'idle' | 'walking'
this.petDirection = 'none'; // 'left' | 'right' | 'none'

// 行为循环
scheduleNextBehavior() {
  if (this.petState === 'idle') {
    // 坐着 3-6秒后开始走路
    const delay = 3000 + Math.random() * 3000;
    this.stateTimer = setTimeout(() => this.startWalking(), delay);
  } else {
    // 走路 3-5秒后坐下
    const delay = 3000 + Math.random() * 2000;
    this.stateTimer = setTimeout(() => this.startSitting(), delay);
  }
}

// 开始走路
startWalking() {
  // 根据位置智能选择方向
  const screenX = window.screenX;
  const screenWidth = window.screen.width;
  const isNearLeft = screenX < 100;
  const isNearRight = screenX > screenWidth - 100 - this.windowWidth;
  
  if (isNearLeft) {
    this.petDirection = 'right';
  } else if (isNearRight) {
    this.petDirection = 'left';
  } else {
    this.petDirection = Math.random() < 0.5 ? 'left' : 'right';
  }
  
  this.petState = 'walking';
  this.isMoving = true;
  this.moveStep();
}

// 移动步进（带边界检测）
moveStep() {
  if (!this.isMoving || this.petState !== 'walking') return;
  
  const speed = 0.5; // 移动速度（像素/帧）
  const currentX = window.screenX;
  const screenWidth = window.screen.width;
  
  let newX = currentX + (this.petDirection === 'left' ? -speed : speed);
  
  // 边界检测和转身
  if (newX < 0) {
    newX = 0;
    this.turnAround();
  } else if (newX > screenWidth - this.windowWidth) {
    newX = screenWidth - this.windowWidth;
    this.turnAround();
  }
  
  window.electronAPI.petMove(newX, window.screenY);
  requestAnimationFrame(() => this.moveStep());
}
```

### 5. 配置管理

配置管理器实现（config-manager.js）：

```javascript
class ConfigManager {
  constructor() {
    this.configPath = path.join(app.getAppPath(), 'config', 'settings.json');
    this.defaultConfig = {
      window: {
        scale: 1.0,           // 窗口缩放比例（替代固定宽高）
        x: null,
        y: null,
        opacity: 1.0,
        alwaysOnTop: true,
        clickThrough: false
      },
      video: {
        folder: path.join(app.getAppPath(), 'src', 'assets', 'videos'),
        currentVideo: null,
        loop: true,
        volume: 0,
        playbackRate: 1.0,
        chromaKey: {
          enabled: true,
          color: '#00ff00',
          similarity: 0.4,
          smoothness: 0.1
        }
      },
      interaction: {
        singleClickAction: 'switch',  // switch/playpause/none
        doubleClickAction: 'settings', // settings/switch/playpause/none
        dragEnabled: true
      },
      animation: {
        enabled: false,       // GSAP动画效果
        idleAnimation: false, // 闲置呼吸动画
        idleInterval: 30
      },
      settingsWindow: {
        x: null,
        y: null
      }
    };
    this.config = null;
  }

  async load() {
    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      const data = await fs.readFile(this.configPath, 'utf8');
      this.config = { ...this.defaultConfig, ...JSON.parse(data) };
    } catch (error) {
      this.config = { ...this.defaultConfig };
    }
    return this.config;
  }

  async save() {
    if (this.config) {
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    }
  }

  get(key) {
    if (!key) return this.config;
    return key.split('.').reduce((obj, k) => obj?.[k], this.config);
  }

  set(key, value) {
    if (!this.config) return;
    const keys = key.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, k) => {
      if (!obj[k]) obj[k] = {};
      return obj[k];
    }, this.config);
    target[lastKey] = value;
  }
}
```

## 常见问题及解决方案

### 问题1：视频无法播放 / 一直显示"加载中"

**原因**：
1. 视频路径错误
2. 视频格式不支持
3. 视频文件损坏
4. **事件监听器在视频加载后才绑定** - 导致第一个视频的 `loadeddata` 事件未被捕获

**解决方案**：
- 检查视频路径是否正确
- 确保视频格式为 MP4 (H.264编码)
- 检查视频文件是否完整
- **确保 `setupEventListeners` 在 `loadVideos` 之前调用**：

```javascript
async init() {
  // ... 其他初始化
  this.setupEventListeners();  // 必须在 loadVideos 之前
  await this.loadVideos();     // 内部会播放第一个视频
}
```

### 问题2：绿幕抠图效果不佳

**原因**：
1. 抠图颜色设置不正确
2. 相似度/平滑度参数不合适
3. 视频光线不均匀

**解决方案**：
- 使用颜色选择器选择正确的绿幕颜色
- 调整相似度（0.3-0.5）和平滑度（0.1-0.3）参数
- 确保视频光线均匀

### 问题3：拖动窗口后视频放大

**原因**：Electron 在 Windows 上使用 `setPosition` 会导致窗口大小自动调整。

**解决方案**：使用 `setBounds` 同时设置位置和大小（详见上文代码）。

### 问题4：设置窗口无法显示

**原因**：
1. 设置窗口被主窗口遮挡
2. 设置窗口位置计算错误

**解决方案**：
- 设置 `parent: this.mainWindow` 使设置窗口独立于主窗口
- 正确计算设置窗口位置

### 问题5：宠物行为不切换 / 视频不自动切换

**原因**：
1. 视频文件名不符合命名规则
2. 定时器未正确设置
3. `playVideo` 被重复调用，覆盖了定时器

**解决方案**：
- 确保视频文件名包含正确的标签（`-坐`、`-走`、`-左`）
- 检查 `scheduleNextBehavior` 是否正确调用
- **避免在 `init()` 中重复调用 `playVideo`**，让 `initializePetState` 处理初始播放：

```javascript
// 错误示例 - 会导致立即切换
async init() {
  await this.loadVideos();
  await this.playVideo(0);  // 重复调用！loadVideos 中已经调用了 initializePetState
}

// 正确示例
async init() {
  this.setupEventListeners();  // 先设置监听器
  await this.loadVideos();     // 内部调用 initializePetState 播放第一个视频
  // 不要再调用 playVideo
}
```

### 问题6：宠物移动时窗口不跟随

**原因**：
1. IPC 通信未正确设置
2. 使用了错误的 IPC 通道（`window-move` 用于用户拖动，`pet-move` 用于宠物自动移动）

**解决方案**：
- 使用专门的 `pet-move` IPC 通道处理宠物自动移动：

```javascript
// main.js
ipcMain.handle('pet-move', (event, { x, y }) => {
  if (this.mainWindow) {
    this.mainWindow.setPosition(Math.round(x), Math.round(y));
  }
});

// app.js
window.electronAPI.petMove(newX, newY);
```

## 开发命令

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 打包应用
pnpm package

# 构建安装包
pnpm make

# 构建特定平台
pnpm make:win
pnpm make:mac
pnpm make:linux
```

## 技术栈版本

- **Electron**: ^29.1.1
- **GSAP**: ^3.12.5
- **electron-log**: ^5.3.2
- **electron-squirrel-startup**: ^1.0.0
- **pnpm**: 10.0.0+

## 注意事项

1. **Windows 平台**：拖动窗口时使用 `setBounds` 代替 `setPosition`
2. **视频格式**：建议使用 MP4 (H.264编码) 格式以获得最佳兼容性
3. **性能优化**：绿幕抠图使用 Canvas API，建议控制视频分辨率在 720p 以下
4. **配置保存**：配置在应用退出时保存，拖动过程中不实时保存位置
