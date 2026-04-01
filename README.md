# DeskPet - 绿幕视频桌面宠物

基于 Electron + HTML/CSS/JS + GSAP 开发的绿幕视频桌面宠物应用。

## 功能特性

- **绿幕抠图透明悬浮** - 实时绿幕抠图，实现透明背景效果
- **跨平台支持** - Windows 10+ / macOS 12+ / Linux Ubuntu 20.04+
- **视频播放控制** - 循环播放、暂停、动画切换
- **鼠标交互** - 单击切换、双击打开设置
- **系统托盘管理** - 托盘图标菜单控制
- **自定义设置** - 透明度、窗口大小、视频选择
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

- **单击宠物**: 切换动画
- **双击宠物**: 打开设置面板
- **拖拽顶部**: 移动窗口位置
- **托盘图标**: 右键菜单控制

### 添加视频

1. 将绿幕视频文件放入 `src/assets/videos/` 目录
2. 支持的格式: MP4, WebM, MOV, MKV, AVI
3. 在设置面板中选择视频目录

### 绿幕设置

- **抠图颜色**: 选择绿幕背景颜色（默认绿色 #00ff00）
- **相似度**: 控制抠图范围（0-1）
- **平滑度**: 控制边缘平滑程度（0-1）

## 项目结构

```
Desk_Pet/
├── src/
│   ├── main/           # 主进程代码
│   │   ├── main.js     # 入口文件
│   │   ├── preload.js  # 预加载脚本
│   │   ├── config-manager.js
│   │   └── video-manager.js
│   ├── renderer/       # 渲染进程代码
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── app.js
│   └── assets/         # 资源文件
│       ├── videos/     # 视频文件
│       └── icons/      # 图标文件
├── config/             # 配置文件
├── logs/               # 日志文件
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

## 性能指标

- **打包体积**: ≤ 150MB
- **内存占用**: ≤ 150MB
- **启动时间**: ≤ 3 秒

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **Electron Forge** - 应用构建和打包工具
- **GSAP** - 专业动画库
- **Canvas API** - 绿幕抠图渲染
- **electron-log** - 日志记录
- **pnpm** - 包管理器

## 许可证

MIT License
