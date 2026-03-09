<div align="center">

# <img src="src-tauri/icons/icon.png" width="28" /> AlgerClipboard

**A smart clipboard manager built with Tauri 2 + React 19**

Cloud Sync &bull; AI Summary &bull; Translation &bull; Rich Text Editing &bull; Templates

[![GitHub Release](https://img.shields.io/github/v/release/algerkong/AlgerClipboard?style=flat-square&color=blue)](https://github.com/algerkong/AlgerClipboard/releases)
[![License](https://img.shields.io/github/license/algerkong/AlgerClipboard?style=flat-square&color=green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)]()
[![Tauri](https://img.shields.io/badge/Tauri-2.x-blue?style=flat-square&logo=tauri&logoColor=white)]()

[中文](./README.zh-CN.md) | English

</div>

---

## Highlights

<table>
<tr>
<td width="50%">

### Clipboard History
Auto-capture text, images, rich text and file copies with instant search, type filtering, smart classification, and programming language detection.

</td>
<td width="50%">

### Cloud Sync
Sync across devices via WebDAV, Google Drive, or OneDrive with optional AES-256-GCM end-to-end encryption.

</td>
</tr>
<tr>
<td width="50%">

### AI Integration
Multi-provider AI support (OpenAI, Claude, Gemini, DeepSeek, Ollama). Auto-summarize long text, AI-powered translation, and Ask AI panel with built-in web access.

</td>
<td width="50%">

### Rich Text Editing
CodeMirror 6 code editor with 12+ language syntax highlighting, TipTap 2 WYSIWYG editor, Markdown preview with KaTeX math & Mermaid diagrams.

</td>
</tr>
</table>

## Features

| Category | Details |
|----------|---------|
| **Clipboard** | Auto-capture text, images, rich text, files &bull; SHA-256 deduplication &bull; Search & type filtering &bull; Smart content classification |
| **Editing** | CodeMirror 6 with toolbar (font size, line numbers, word wrap) &bull; TipTap 2 rich text WYSIWYG &bull; Split view (editor / split / preview) |
| **Rendering** | Markdown (GFM) &bull; KaTeX math formulas &bull; Shiki code highlighting &bull; Mermaid diagrams &bull; Rich text (clean/full mode) |
| **AI** | Multi-provider (OpenAI, Claude, Gemini, DeepSeek, Ollama, custom) &bull; Auto-summary &bull; AI translation &bull; Ask AI panel |
| **Cloud Sync** | WebDAV / Google Drive / OneDrive &bull; AES-256-GCM encryption &bull; Settings sync &bull; File size limits |
| **Translation** | Baidu / Youdao / Google engines &bull; AI translation mode &bull; Language auto-detect &bull; One-click copy |
| **Templates** | Reusable templates with variable substitution |
| **Organization** | Pin & favorites &bull; Tag system with CRUD &bull; Content categories &bull; Language detection (19 languages) |
| **UX** | Global hotkey (`Ctrl+Shift+V`) &bull; Arrow key navigation &bull; Smart window positioning &bull; Window size memory &bull; OCR |
| **Personalization** | Dark / Light / System theme &bull; Custom fonts &bull; UI scaling &bull; i18n (中文 / English) &bull; Auto-start |
| **Privacy** | All data stored locally &bull; Optional encrypted sync &bull; No telemetry |

## Installation

Download the latest release from [**GitHub Releases**](https://github.com/algerkong/AlgerClipboard/releases).

| Platform | Format | Architecture |
|----------|--------|--------------|
| Windows  | `.msi` / `.exe` | x64 |
| macOS    | `.dmg` | Universal |
| Linux    | `.deb` / `.AppImage` | x64 |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Tauri 2](https://v2.tauri.app/) |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| State | Zustand |
| Code Editor | CodeMirror 6 |
| Rich Editor | TipTap 2 |
| Markdown | react-markdown + Shiki + KaTeX + Mermaid |
| Backend | Rust |
| Database | SQLite (WAL mode) |
| Encryption | AES-256-GCM + Argon2id |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- [Rust](https://www.rust-lang.org/tools/install) >= 1.77
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### Quick Start

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

### Project Structure

```
src/                    # React frontend
├── components/         # UI components
│   ├── editor/         # CodeMirror, RichEditor, MarkdownPreview, SplitView
│   └── ui/             # shadcn/ui base components
├── pages/              # ClipboardPanel, DetailPage, Settings, AskAiPanel
├── stores/             # Zustand state management
├── services/           # Tauri IPC service layer
├── lib/                # Utilities (contentDetect, windowSize, richText)
├── i18n/               # Internationalization (zh-CN, en)
└── types/              # TypeScript type definitions

src-tauri/              # Rust backend
├── src/
│   ├── clipboard/      # Clipboard monitor and entry models
│   ├── commands/       # Tauri IPC command handlers
│   ├── storage/        # SQLite database and blob storage
│   ├── sync/           # Cloud sync engine, adapters, encryption
│   ├── translate/      # Translation engine integrations
│   ├── ocr/            # Windows OCR (Windows.Media.Ocr API)
│   └── paste/          # System paste simulation
└── icons/              # App icons
```

## Cloud Sync Setup

See the [Cloud Sync Guide](./docs/cloud-sync-guide.md) for detailed configuration instructions.

## Donate

If you find AlgerClipboard useful, consider supporting the project:

<div align="center">

**[Donate](https://donate.alger.fun/donate)**

</div>

## License

[GPL-3.0](LICENSE)
