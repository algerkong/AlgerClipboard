# AlgerClipboard

中文 | [English](./README.md)

基于 Tauri 2 + React 19 构建的智能剪贴板管理工具，支持云同步、翻译和模板功能。

## 功能特性

- **剪贴板历史** - 自动捕获文本、图片和文件复制，支持搜索和分类筛选
- **云同步** - 通过 WebDAV、Google Drive 或 OneDrive 跨设备同步，支持端到端加密
- **翻译** - 内置翻译功能，支持百度、有道、Google 翻译引擎
- **模板** - 创建可复用模板，支持变量替换
- **置顶和收藏** - 置顶重要条目，标记收藏快速访问
- **键盘操作** - 全局快捷键（`Ctrl+Shift+V`）、方向键导航、快速粘贴
- **个性化** - 深色/浅色/跟随系统主题、字体大小、语言（中文/English）、开机自启
- **隐私安全** - 数据本地存储，同步支持 AES-256-GCM 加密

## 截图

<!-- 在此添加截图 -->

## 安装

从 [GitHub Releases](https://github.com/algerkong/AlgerClipboard/releases) 下载最新版本。

### 支持平台

| 平台 | 格式 |
|------|------|
| Windows | `.msi` / `.exe` |
| macOS | `.dmg` |
| Linux | `.deb` / `.AppImage` |

## 开发

### 环境要求

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- [Rust](https://www.rust-lang.org/tools/install) >= 1.77
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### 开始开发

```bash
# 安装依赖
pnpm install

# 开发模式运行
pnpm tauri dev

# 构建生产版本
pnpm tauri build
```

### 项目结构

```
src/                    # React 前端
├── components/         # UI 组件（EntryCard、SearchBar、TypeFilter 等）
├── pages/              # 页面（ClipboardPanel、Settings、TemplateManager）
├── stores/             # Zustand 状态管理
├── services/           # Tauri IPC 服务层
├── i18n/               # 国际化（中文、英文）
└── types/              # TypeScript 类型定义

src-tauri/              # Rust 后端
├── src/
│   ├── clipboard/      # 剪贴板监控和数据模型
│   ├── commands/       # Tauri IPC 命令处理
│   ├── storage/        # SQLite 数据库和 Blob 存储
│   ├── sync/           # 云同步引擎、适配器、加密
│   ├── translate/      # 翻译引擎集成
│   └── paste/          # 系统粘贴模拟
└── icons/              # 应用图标
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | [Tauri 2](https://v2.tauri.app/) |
| 前端 | React 19 + TypeScript |
| 样式 | Tailwind CSS 4 |
| 状态管理 | Zustand |
| 后端 | Rust |
| 数据库 | SQLite |
| 加密 | AES-256-GCM + Argon2id |

## 云同步配置

详见 [云同步配置指南](./docs/cloud-sync-guide.md)。

## 许可证

MIT
