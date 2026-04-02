# DeskPet - 绿幕视频桌面宠物

基于 Electron + HTML/CSS/JS + GSAP 开发的绿幕视频桌面宠物应用。

## 功能特性

- **绿幕抠图透明悬浮** - 实时绿幕抠图，实现透明背景效果
- **智能宠物行为** - 自动切换坐着/走路动画，智能移动和边界检测
- **跨平台支持** - Windows 10+ / macOS 12+ / Linux Ubuntu 20.04+
- **视频播放控制** - 循环播放、暂停、动画切换
- **鼠标交互** - 右键显示控制按钮，双击打开设置
- **视频拖动** - 支持拖动视频窗口位置
- **系统托盘管理** - 托盘图标菜单控制
- **自定义设置** - 透明度、缩放、视频选择、绿幕参数
- **GSAP 动画** - 流畅的动画效果
- **异常捕获日志** - 完整的错误处理和日志记录

## 系统要求

- **Windows**: Windows 10 或更高版本 (x64/ia32)
- **macOS**: macOS 12.0 或更高版本 (Intel/Apple Silicon)
- **Linux**: Ubuntu 20.04 或兼容发行版 (x64)
- **Node.js**: 18.0.0 或更高版本
- **pnpm**: 10.0.0 或更高版本

## 安装

```bash
# 克隆仓库
git clone <repository-url>
cd Desk_Pet

# 安装依赖 (使用 pnpm)
pnpm install

# 开发模式运行
pnpm dev
```

## 使用说明

### 基本操作

- **右键宠物**: 显示控制按钮（切换动画/设置）
- **双击宠物**: 打开设置窗口
- **拖动宠物**: 按住视频拖动可移动窗口位置
- **托盘图标**: 右键菜单控制

### 智能宠物行为

宠物会自动执行以下行为：

1. **状态循环**: 坐着 (3-6秒) → 走路 (3-5秒) → 坐着 → ...
2. **智能移动**: 走路时窗口会跟随移动，碰到屏幕边缘会自动转身
3. **动画镜像**: 如果没有对应方向的动画，会自动镜像翻转
4. **边界检测**: 宠物不会走出屏幕，靠近边缘时会智能选择方向

### 视频命名规则

为实现智能行为，视频文件需要按以下规则命名：

- **坐着动画**: 文件名包含 `-坐`，如 `小猫-坐.mp4`
- **向左走**: 文件名包含 `-走` 和 `-左`，如 `小猫-走-左.mp4`
- **向右走**: 文件名包含 `-走`（不含 `-左`），如 `小猫-走.mp4` 或 `小猫-走-右.mp4`

示例：
```
videos/
├── 小猫-坐.mp4      # 坐着动画
├── 小猫-走-左.mp4   # 向左走
└── 小猫-走-右.mp4   # 向右走
```

### 添加视频

1. 将绿幕视频文件放入 `src/assets/videos/` 目录
2. 支持的格式: MP4, WebM, MOV, MKV, AVI
3. 在设置面板中选择视频目录

### 绿幕设置

- **启用绿幕**: 开启/关闭绿幕抠图效果
- **抠图颜色**: 选择绿幕背景颜色（默认绿色 #00ff00）
- **相似度**: 控制抠图范围（0-1）
- **平滑度**: 控制边缘平滑程度（0-1）

### 窗口设置

- **透明度**: 调整窗口透明度（10%-100%）
- **缩放**: 调整宠物大小（0.5x - 2.0x），保持原始比例
- **窗口置顶**: 窗口始终保持在最上层
- **点击穿透**: 鼠标点击穿透窗口
- **闲置动画**: 开启/关闭宠物呼吸动画效果

### 交互设置

- **单击动作**: 设置单击视频时的行为（播放/暂停/切换视频）
- **双击动作**: 设置双击视频时的行为（打开设置/无）

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
├── out/                   # 构建输出目录
├── package.json
└── README.md
```

## 开发

```bash
# 启动开发服务器（热重载）
pnpm dev

# 仅打包应用（不生成安装程序）
pnpm package

# 构建完整安装包（所有平台）
pnpm make

# 构建特定平台
pnpm make:win      # Windows (.exe, .msi)
pnpm make:mac      # macOS (.dmg, .zip)
pnpm make:linux    # Linux (.deb, .rpm, .AppImage)

# 发布到 GitHub
pnpm publish
```

## 命令参考

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装依赖 |
| `pnpm add <pkg>` | 添加依赖 |
| `pnpm add -D <pkg>` | 添加开发依赖 |
| `pnpm remove <pkg>` | 移除依赖 |
| `pnpm dev` | 开发模式（热重载） |
| `pnpm package` | 打包应用 |
| `pnpm make` | 构建安装包 |
| `pnpm make:win` | 构建 Windows 安装包 |
| `pnpm make:mac` | 构建 macOS 安装包 |
| `pnpm make:linux` | 构建 Linux 安装包 |

## 输出文件

构建完成后，安装包位于 `out/make/` 目录：

- **Windows**: `out/make/squirrel.windows/x64/` - 包含 `.exe` 和 `.msi`
- **macOS**: `out/make/` - 包含 `.dmg` 和 `.zip`
- **Linux**: `out/make/` - 包含 `.deb`, `.rpm`, `.AppImage`

## 配置说明

配置文件位于 `config/settings.json`，包含以下选项：

```json
{
  "window": {
    "scale": 1.0,           // 窗口缩放比例（0.5 - 2.0）
    "x": null,              // 窗口X位置（null为默认）
    "y": null,              // 窗口Y位置（null为默认）
    "opacity": 1.0,         // 透明度
    "alwaysOnTop": true,    // 始终置顶
    "clickThrough": false   // 点击穿透
  },
  "video": {
    "folder": "...",        // 视频文件夹路径
    "currentVideo": null,   // 当前播放的视频
    "loop": true,           // 循环播放
    "volume": 0,            // 音量
    "playbackRate": 1.0,    // 播放速度
    "chromaKey": {
      "enabled": true,      // 启用绿幕
      "color": "#00ff00",   // 抠图颜色
      "similarity": 0.4,    // 相似度
      "smoothness": 0.1     // 平滑度
    }
  },
  "interaction": {
    "singleClickAction": "switch",  // 单击动作（switch/playpause/none）
    "doubleClickAction": "settings", // 双击动作（settings/switch/playpause/none）
    "dragEnabled": true              // 启用拖动
  },
  "animation": {
    "enabled": false,       // 启用GSAP动画效果
    "idleAnimation": false, // 闲置呼吸动画
    "idleInterval": 30      // 闲置动画间隔（秒）
  }
}
```

## 技术栈

- **Electron** ^29.1.1 - 跨平台桌面应用框架
- **Electron Forge** - 应用构建和打包工具
- **GSAP** ^3.12.5 - 专业动画库
- **Canvas API** - 绿幕抠图渲染
- **electron-log** ^5.3.2 - 日志记录
- **electron-squirrel-startup** - Windows 安装程序支持
- **pnpm** - 包管理器

## 许可证

MIT License
