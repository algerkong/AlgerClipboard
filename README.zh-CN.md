<div align="center">

# <img src="src-tauri/icons/icon.png" width="28" /> AlgerClipboard

**基于 Tauri 2 + React 19 的智能剪贴板管理工具**

云同步 &bull; AI 摘要 &bull; 翻译 &bull; 富文本编辑 &bull; 模板

[![GitHub Release](https://img.shields.io/github/v/release/algerkong/AlgerClipboard?style=flat-square&color=blue)](https://github.com/algerkong/AlgerClipboard/releases)
[![License](https://img.shields.io/github/license/algerkong/AlgerClipboard?style=flat-square&color=green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)]()
[![Tauri](https://img.shields.io/badge/Tauri-2.x-blue?style=flat-square&logo=tauri&logoColor=white)]()

中文 | [English](./README.md)

</div>

---

## 亮点

<table>
<tr>
<td width="50%">

### 剪贴板历史
自动捕获文本、图片、富文本和文件复制，支持即时搜索、类型筛选、智能分类和编程语言检测。

</td>
<td width="50%">

### 云同步
通过 WebDAV、Google Drive 或 OneDrive 跨设备同步，可选 AES-256-GCM 端到端加密。

</td>
</tr>
<tr>
<td width="50%">

### AI 集成
多服务商 AI 支持（OpenAI、Claude、Gemini、DeepSeek、Ollama）。自动摘要长文本、AI 翻译、Ask AI 面板内置网页访问。

</td>
<td width="50%">

### 富文本编辑
CodeMirror 6 代码编辑器支持 12+ 种语言语法高亮，TipTap 2 所见即所得编辑器，Markdown 预览支持 KaTeX 数学公式和 Mermaid 流程图。

</td>
</tr>
</table>

## 功能特性

| 分类 | 详情 |
|------|------|
| **剪贴板** | 自动捕获文本、图片、富文本、文件 &bull; SHA-256 去重 &bull; 搜索和类型筛选 &bull; 智能内容分类 |
| **编辑** | CodeMirror 6 带工具栏（字体大小、行号、自动换行） &bull; TipTap 2 富文本编辑 &bull; 分屏视图（编辑器 / 分屏 / 预览） |
| **渲染** | Markdown (GFM) &bull; KaTeX 数学公式 &bull; Shiki 代码高亮 &bull; Mermaid 流程图 &bull; 富文本（简洁/完整模式） |
| **AI** | 多服务商（OpenAI、Claude、Gemini、DeepSeek、Ollama、自定义） &bull; 自动摘要 &bull; AI 翻译 &bull; Ask AI 面板 |
| **云同步** | WebDAV / Google Drive / OneDrive &bull; AES-256-GCM 加密 &bull; 设置同步 &bull; 文件大小限制 |
| **翻译** | 百度 / 有道 / Google 翻译引擎 &bull; AI 翻译模式 &bull; 语言自动检测 &bull; 一键复制 |
| **模板** | 可复用模板，支持变量替换 |
| **组织** | 置顶和收藏 &bull; 标签系统 &bull; 内容分类 &bull; 编程语言检测（19 种语言） |
| **体验** | 全局快捷键（`Ctrl+Shift+V`） &bull; 方向键导航 &bull; 智能窗口定位 &bull; 窗口尺寸记忆 &bull; OCR |
| **个性化** | 深色 / 浅色 / 跟随系统主题 &bull; 自定义字体 &bull; 界面缩放 &bull; 中文 / English &bull; 开机自启 |
| **隐私** | 数据本地存储 &bull; 可选加密同步 &bull; 无遥测 |

## 安装

从 [**GitHub Releases**](https://github.com/algerkong/AlgerClipboard/releases) 下载最新版本。

| 平台 | 格式 | 架构 |
|------|------|------|
| Windows | `.msi` / `.exe` | x64 |
| macOS | `.dmg` | Universal |
| Linux | `.deb` / `.AppImage` | x64 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | [Tauri 2](https://v2.tauri.app/) |
| 前端 | React 19 + TypeScript |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 状态管理 | Zustand |
| 代码编辑器 | CodeMirror 6 |
| 富文本编辑器 | TipTap 2 |
| Markdown | react-markdown + Shiki + KaTeX + Mermaid |
| 后端 | Rust |
| 数据库 | SQLite (WAL 模式) |
| 加密 | AES-256-GCM + Argon2id |

## 开发

### 环境要求

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- [Rust](https://www.rust-lang.org/tools/install) >= 1.77
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### 快速开始

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
├── components/         # UI 组件
│   ├── editor/         # CodeMirror、RichEditor、MarkdownPreview、SplitView
│   └── ui/             # shadcn/ui 基础组件
├── pages/              # ClipboardPanel、DetailPage、Settings、AskAiPanel
├── stores/             # Zustand 状态管理
├── services/           # Tauri IPC 服务层
├── lib/                # 工具函数（contentDetect、windowSize、richText）
├── i18n/               # 国际化（中文、英文）
└── types/              # TypeScript 类型定义

src-tauri/              # Rust 后端
├── src/
│   ├── clipboard/      # 剪贴板监控和数据模型
│   ├── commands/       # Tauri IPC 命令处理
│   ├── storage/        # SQLite 数据库和 Blob 存储
│   ├── sync/           # 云同步引擎、适配器、加密
│   ├── translate/      # 翻译引擎集成
│   ├── ocr/            # Windows OCR (Windows.Media.Ocr API)
│   └── paste/          # 系统粘贴模拟
└── icons/              # 应用图标
```

## 云同步配置

详见 [云同步配置指南](./docs/zh-CN/cloud-sync-guide.md)。

## OCR 开发

RapidOCR 运行时打包、安装链路和发布流程说明见 [RapidOCR 开发说明](./docs/zh-CN/rapidocr-development.md)。

## 捐赠

如果你觉得 AlgerClipboard 好用，欢迎支持项目发展：

<div align="center">

**[捐赠支持](https://donate.alger.fun/donate)**

</div>

## 许可证

[GPL-3.0](LICENSE)
