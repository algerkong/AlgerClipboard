# AlgerClipboard

[中文](./README.zh-CN.md) | English

A smart clipboard manager built with Tauri 2 + React 19, featuring cloud sync, translation, and templates.

## Features

- **Clipboard History** - Auto-capture text, images, and file copies with search and filtering
- **Cloud Sync** - Sync across devices via WebDAV, Google Drive, or OneDrive with optional E2E encryption
- **Translation** - Built-in translation with Baidu, Youdao, and Google engine support
- **Templates** - Create reusable templates with variable substitution
- **Pin & Favorites** - Pin important entries to top, mark favorites for quick access
- **Keyboard Driven** - Global hotkey (`Ctrl+Shift+V`), arrow key navigation, quick paste
- **Personalization** - Dark/Light/System theme, font size, language (中文/English), auto-start
- **Privacy** - All data stored locally, optional AES-256-GCM encrypted sync

## Screenshots

<!-- Add screenshots here -->

## Installation

Download the latest release from [GitHub Releases](https://github.com/algerkong/AlgerClipboard/releases).

### Supported Platforms

| Platform | Format |
|----------|--------|
| Windows  | `.msi` / `.exe` |
| macOS    | `.dmg` |
| Linux    | `.deb` / `.AppImage` |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- [Rust](https://www.rust-lang.org/tools/install) >= 1.77
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### Setup

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
├── components/         # UI components (EntryCard, SearchBar, TypeFilter, etc.)
├── pages/              # Pages (ClipboardPanel, Settings, TemplateManager)
├── stores/             # Zustand state management
├── services/           # Tauri IPC service layer
├── i18n/               # Internationalization (zh-CN, en)
└── types/              # TypeScript type definitions

src-tauri/              # Rust backend
├── src/
│   ├── clipboard/      # Clipboard monitor and entry models
│   ├── commands/       # Tauri IPC command handlers
│   ├── storage/        # SQLite database and blob storage
│   ├── sync/           # Cloud sync engine, adapters, encryption
│   ├── translate/      # Translation engine integrations
│   └── paste/          # System paste simulation
└── icons/              # App icons
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Tauri 2](https://v2.tauri.app/) |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| State | Zustand |
| Backend | Rust |
| Database | SQLite |
| Encryption | AES-256-GCM + Argon2id |

## Cloud Sync Setup

See the [Cloud Sync Guide](./docs/cloud-sync-guide.md) for detailed configuration instructions (Chinese).

## License

MIT
