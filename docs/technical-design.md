# AlgerClipboard 技术设计文档

> 版本：v1.0.0
> 日期：2026-03-04
> 状态：已评审

---

## 1. 技术栈总览

| 层级       | 技术选型                         | 说明                              |
| ---------- | -------------------------------- | --------------------------------- |
| 桌面框架   | Tauri 2.x                       | Rust 后端，跨平台，包体小         |
| 前端框架   | React 18+ / TypeScript 5+       | UI 层，组合式开发                 |
| UI 组件库  | Shadcn/ui + Tailwind CSS        | 现代化 UI，易定制主题             |
| 状态管理   | Zustand                         | 轻量、TypeScript 友好             |
| 图片编辑   | Fabric.js                       | Canvas 标注编辑                   |
| 本地数据库 | SQLite (via rusqlite)            | 结构化数据存储                    |
| HTTP 客户端| reqwest                         | Rust 异步 HTTP（翻译/同步）       |
| WebDAV     | reqwest + 自实现 WebDAV 协议     | 或使用 webdav-rs crate            |
| 加密       | AES-256-GCM (ring/aes-gcm)      | 同步数据端到端加密                |
| 密钥存储   | keyring-rs                      | 跨平台系统密钥管理                |
| 构建工具   | Vite                            | 前端构建                          |
| 包管理     | pnpm                            | 前端依赖管理                      |

---

## 2. 系统架构

### 2.1 整体架构图

```
┌──────────────────────────────────────────────────────────┐
│                     UI Layer (React + TS)                 │
│                                                          │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌─────────┐ │
│  │ ClipboardPanel │ ImageEditor│ │Translate │ │Templates│ │
│  │ (历史/搜索/   │ (Fabric.js)│ │  Panel   │ │ Manager │ │
│  │  筛选/收藏)   │            │ │          │ │         │ │
│  └────────────┘ └────────────┘ └──────────┘ └─────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           Plugin UI Container (iframe 沙箱)          │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Zustand Store: clipboardStore / settingsStore / ... │ │
│  └──────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│                Tauri IPC (Commands + Events)              │
│  Commands: get_history, paste_entry, translate, sync...  │
│  Events: clipboard-changed, sync-status, plugin-event   │
├──────────────────────────────────────────────────────────┤
│                   Core Layer (Rust)                       │
│                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ ClipboardMon │ │  SyncEngine  │ │ TranslateEngine  │ │
│  │              │ │              │ │                   │ │
│  │ - 系统监听   │ │ - 增量同步   │ │ - 多引擎适配     │ │
│  │ - 去重处理   │ │ - 冲突合并   │ │ - 自动降级       │ │
│  │ - 内容解析   │ │ - 队列管理   │ │ - 语言检测       │ │
│  └──────────────┘ └──────────────┘ └──────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ HotkeyMgr    │ │ PluginEngine │ │  PasteSimulator  │ │
│  │              │ │              │ │                   │ │
│  │ - 全局注册   │ │ - 插件加载   │ │ - 模拟键盘输入   │ │
│  │ - 冲突检测   │ │ - 事件分发   │ │ - 跨平台适配     │ │
│  │ - 自定义绑定 │ │ - 沙箱管理   │ │ - 格式转换       │ │
│  └──────────────┘ └──────────────┘ └──────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           Storage Adapter Interface (Trait)           │ │
│  │                                                      │ │
│  │  ┌──────────┐  ┌────────────┐  ┌──────────────┐     │ │
│  │  │ WebDAV   │  │ GoogleDrive│  │  OneDrive    │     │ │
│  │  │ Adapter  │  │  Adapter   │  │  Adapter     │     │ │
│  │  └──────────┘  └────────────┘  └──────────────┘     │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │        Local Storage (SQLite + File System)           │ │
│  │  - entries.db: 条目元数据                            │ │
│  │  - blobs/: 图片和文件二进制                          │ │
│  │  - config.json: 用户配置                             │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 2.2 目录结构

```
AlgerClipboard/
├── docs/                          # 文档
│   ├── requirements.md            # 需求说明书
│   └── technical-design.md        # 技术设计文档
├── src-tauri/                     # Rust 后端
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs                # 入口
│   │   ├── lib.rs                 # 库入口
│   │   ├── clipboard/             # 剪贴板监听模块
│   │   │   ├── mod.rs
│   │   │   ├── monitor.rs         # 系统剪贴板监听
│   │   │   ├── entry.rs           # 条目数据结构
│   │   │   └── dedup.rs           # 去重逻辑
│   │   ├── sync/                  # 同步引擎
│   │   │   ├── mod.rs
│   │   │   ├── engine.rs          # 同步核心逻辑
│   │   │   ├── conflict.rs        # 冲突处理
│   │   │   ├── queue.rs           # 同步队列
│   │   │   └── adapters/          # 存储适配器
│   │   │       ├── mod.rs
│   │   │       ├── trait.rs       # StorageAdapter trait
│   │   │       ├── webdav.rs
│   │   │       ├── gdrive.rs
│   │   │       └── onedrive.rs
│   │   ├── translate/             # 翻译模块
│   │   │   ├── mod.rs
│   │   │   ├── engine.rs          # 翻译引擎调度
│   │   │   ├── baidu.rs
│   │   │   ├── youdao.rs
│   │   │   └── google.rs
│   │   ├── hotkey/                # 快捷键管理
│   │   │   ├── mod.rs
│   │   │   └── manager.rs
│   │   ├── paste/                 # 粘贴模拟
│   │   │   ├── mod.rs
│   │   │   └── simulator.rs
│   │   ├── plugin/                # 插件系统
│   │   │   ├── mod.rs
│   │   │   ├── loader.rs          # 插件加载
│   │   │   ├── registry.rs        # 插件注册
│   │   │   └── sandbox.rs         # 沙箱管理
│   │   ├── storage/               # 本地存储
│   │   │   ├── mod.rs
│   │   │   ├── database.rs        # SQLite 操作
│   │   │   └── blob.rs            # 文件存储
│   │   ├── commands/              # Tauri IPC Commands
│   │   │   ├── mod.rs
│   │   │   ├── clipboard_cmd.rs
│   │   │   ├── sync_cmd.rs
│   │   │   ├── translate_cmd.rs
│   │   │   └── settings_cmd.rs
│   │   └── config/                # 配置管理
│   │       ├── mod.rs
│   │       └── settings.rs
│   └── tauri.conf.json
├── src/                           # React 前端
│   ├── main.tsx                   # 入口
│   ├── App.tsx
│   ├── components/                # 通用组件
│   │   ├── ui/                    # Shadcn/ui 组件
│   │   ├── SearchBar.tsx
│   │   ├── EntryCard.tsx
│   │   └── Toast.tsx
│   ├── pages/                     # 页面
│   │   ├── ClipboardPanel.tsx     # 主面板
│   │   ├── ImageEditor.tsx        # 图片标注编辑器
│   │   ├── Settings.tsx           # 设置页面
│   │   └── TemplateManager.tsx    # 模板管理
│   ├── stores/                    # Zustand 状态
│   │   ├── clipboardStore.ts
│   │   ├── settingsStore.ts
│   │   ├── syncStore.ts
│   │   └── translateStore.ts
│   ├── hooks/                     # 自定义 Hooks
│   │   ├── useClipboard.ts
│   │   ├── useHotkey.ts
│   │   └── useTranslate.ts
│   ├── services/                  # Tauri IPC 封装
│   │   ├── clipboardService.ts
│   │   ├── syncService.ts
│   │   ├── translateService.ts
│   │   └── settingsService.ts
│   ├── types/                     # TypeScript 类型
│   │   └── index.ts
│   └── styles/                    # 样式
│       └── globals.css
├── plugins/                       # 插件目录
│   └── example-plugin/
│       ├── manifest.json
│       └── index.js
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── README.md
```

---

## 3. 核心模块设计

### 3.1 剪贴板监听模块

#### 3.1.1 平台适配

| 平台    | 监听方案                                     |
| ------- | -------------------------------------------- |
| Windows | `AddClipboardFormatListener` Win32 API       |
| macOS   | `NSPasteboard` 轮询 changeCount（50ms 间隔）  |
| Linux   | X11: `XFixes` 扩展 / Wayland: `wl-clipboard` 监听 |

#### 3.1.2 内容解析流程

```
系统剪贴板变化通知
  │
  ├─ 读取所有可用格式
  │   ├─ text/plain → 纯文本
  │   ├─ text/html → 富文本 (同时保留纯文本版本)
  │   ├─ image/png, image/bmp → 图片 (保存到 blobs/)
  │   └─ file list → 文件路径列表
  │
  ├─ 计算内容 hash (SHA-256)
  │
  ├─ 去重检查
  │   ├─ hash 存在 → 更新时间戳，置顶
  │   └─ hash 不存在 → 创建新 Entry
  │
  ├─ 图片生成缩略图 (最大 200x200)
  │
  └─ 写入 SQLite + 发送 Event 到前端
```

#### 3.1.3 Rust 核心 Trait

```rust
// 剪贴板内容类型
enum ContentType {
    PlainText,
    RichText,   // HTML 格式
    Image,
    FilePaths,
}

// 剪贴板条目
struct ClipboardEntry {
    id: Uuid,
    content_type: ContentType,
    text_content: Option<String>,       // 文本内容
    blob_path: Option<PathBuf>,         // 图片/文件的本地路径
    thumbnail_path: Option<PathBuf>,    // 缩略图路径
    content_hash: String,               // SHA-256 hash
    source_app: Option<String>,         // 来源应用
    device_id: String,                  // 设备标识
    is_favorite: bool,
    tags: Vec<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    synced_at: Option<DateTime<Utc>>,
    sync_status: SyncStatus,            // Synced / PendingSync / Conflict
}

// 剪贴板监听 trait (各平台实现)
trait ClipboardMonitor: Send + Sync {
    fn start(&mut self) -> Result<()>;
    fn stop(&mut self) -> Result<()>;
    fn on_change(&self, callback: Box<dyn Fn(ClipboardEntry) + Send>);
}
```

### 3.2 同步引擎

#### 3.2.1 Storage Adapter Trait

```rust
#[async_trait]
trait StorageAdapter: Send + Sync {
    /// 适配器名称
    fn name(&self) -> &str;

    /// 测试连接
    async fn test_connection(&self) -> Result<()>;

    /// 上传条目（含二进制数据）
    async fn upload_entry(&self, entry: &SyncPayload) -> Result<()>;

    /// 下载指定条目
    async fn download_entry(&self, entry_id: &str) -> Result<SyncPayload>;

    /// 获取远端变更列表（从指定时间戳开始）
    async fn list_changes(&self, since: DateTime<Utc>) -> Result<Vec<SyncMeta>>;

    /// 删除远端条目
    async fn delete_entry(&self, entry_id: &str) -> Result<()>;

    /// 获取远端存储使用情况
    async fn get_usage(&self) -> Result<StorageUsage>;
}
```

#### 3.2.2 同步流程

```
┌─────────┐     ┌─────────────┐     ┌─────────────────┐
│ 本地变更 │────→│  同步队列    │────→│  StorageAdapter  │
│ (SQLite) │     │ (优先级排序) │     │  (上传)          │
└─────────┘     └─────────────┘     └─────────────────┘
                                            │
                     ┌──────────────────────┘
                     ▼
              ┌─────────────┐
              │  远端存储    │
              │ (WebDAV等)  │
              └─────────────┘
                     │
                     ▼
              ┌─────────────┐     ┌─────────────┐
              │ 拉取变更    │────→│  冲突检测    │
              │ list_changes│     │  (hash比对)  │
              └─────────────┘     └──────┬──────┘
                                         │
                                    ┌────┴────┐
                                    ▼         ▼
                              无冲突:     有冲突:
                              合并到本地  保留双方副本
                                          标记为 Conflict
```

#### 3.2.3 同步数据格式

远端存储目录结构：

```
AlgerClipboard/
├── meta/
│   ├── device_registry.json       # 设备注册表
│   └── sync_state.json            # 同步状态
├── entries/
│   ├── {uuid}.json                # 条目元数据
│   └── ...
├── blobs/
│   ├── {uuid}.bin                 # 二进制数据 (加密后)
│   └── ...
└── conflicts/                     # 冲突副本
    └── {uuid}_{device_id}.json
```

#### 3.2.4 冲突解决策略

1. **无冲突**：远端和本地的 hash 一致，或本地无修改 → 直接合并
2. **时间戳优先**：远端和本地都有修改 → 保留时间戳更新的版本为主版本
3. **保留冲突副本**：被覆盖的版本保存到 `conflicts/`，用户可在 UI 中查看和手动选择
4. **设备优先级**：时间戳完全相同时，按用户配置的设备优先级决定

#### 3.2.5 WebDAV 适配器实现要点

- 使用 HTTP `PROPFIND`、`PUT`、`GET`、`DELETE` 方法
- 通过 `Last-Modified` 和 `ETag` 做增量检测
- 大文件使用 `Content-Range` 分块上传（单块 ≤ 5MB）
- 连接池管理，复用 TCP 连接

#### 3.2.6 Google Drive 适配器实现要点

- 使用 Google Drive REST API v3
- OAuth 2.0 授权（本地浏览器回调获取 token）
- 数据存储在 Application Data 文件夹（不占用户空间可见范围）
- 使用 `changes.list` API 做增量同步
- Token 自动刷新

#### 3.2.7 OneDrive 适配器实现要点

- 使用 Microsoft Graph API
- OAuth 2.0 授权（同 Google Drive 类似流程）
- 使用 `delta` API 做增量变更追踪
- 存储在 App Folder 中

### 3.3 翻译引擎

#### 3.3.1 翻译引擎 Trait

```rust
#[async_trait]
trait TranslateEngine: Send + Sync {
    fn name(&self) -> &str;
    fn supported_languages(&self) -> Vec<LanguagePair>;
    async fn translate(&self, text: &str, from: &str, to: &str) -> Result<TranslateResult>;
    async fn detect_language(&self, text: &str) -> Result<String>;
}
```

#### 3.3.2 各引擎对接

| 引擎       | API 端点                                         | 认证方式           |
| ---------- | ------------------------------------------------ | ------------------ |
| 百度翻译   | `https://fanyi-api.baidu.com/api/trans/vip/translate` | AppID + Secret Key + MD5 签名 |
| 有道翻译   | `https://openapi.youdao.com/api`                  | AppKey + AppSecret + SHA256 签名 |
| 谷歌翻译   | `https://translation.googleapis.com/language/translate/v2` | API Key |

#### 3.3.3 降级策略

```
用户选择的引擎
  │
  ├─ 成功 → 返回结果
  │
  └─ 失败 → 尝试备选引擎 1
              │
              ├─ 成功 → 返回结果 (标注实际使用的引擎)
              │
              └─ 失败 → 尝试备选引擎 2
                          │
                          ├─ 成功 → 返回结果
                          └─ 失败 → 返回错误
```

### 3.4 快捷键管理

#### 3.4.1 实现方案

- 使用 Tauri 2 内置的 `tauri-plugin-global-shortcut`
- 快捷键配置存储在 SQLite 的 settings 表中
- 应用启动时批量注册，配置变更时重新注册

#### 3.4.2 默认快捷键

| 功能             | Windows / Linux       | macOS                |
| ---------------- | --------------------- | -------------------- |
| 呼出/隐藏面板    | `Ctrl+Shift+V`        | `Cmd+Shift+V`       |
| 快速粘贴第 N 条  | `Ctrl+Alt+1~9`        | `Cmd+Alt+1~9`       |
| 翻译当前条目     | `Ctrl+Shift+T`        | `Cmd+Shift+T`       |
| 截图标注         | `Ctrl+Shift+A`        | `Cmd+Shift+A`       |

### 3.5 智能填充（Paste Simulator）

#### 3.5.1 平台实现

| 平台    | 方案                                          |
| ------- | --------------------------------------------- |
| Windows | `SendInput` Win32 API 模拟 `Ctrl+V` 按键     |
| macOS   | `CGEvent` 模拟 `Cmd+V` 按键                   |
| Linux   | `xdotool` (X11) / `wtype` (Wayland) 模拟按键  |

#### 3.5.2 填充流程

```
用户选择条目 → 写入系统剪贴板 → 隐藏窗口 → 等待 50ms →
恢复焦点到前一个窗口 → 模拟粘贴快捷键 → 完成
```

### 3.6 图片标注编辑器

#### 3.6.1 技术方案

- 基于 **Fabric.js** 的 Canvas 编辑器
- React 组件封装，通过 props 传入图片数据

#### 3.6.2 工具集

| 工具     | 实现方式                            |
| -------- | ----------------------------------- |
| 裁剪     | Fabric.js Crop 区域选择 + Canvas 裁剪 |
| 画笔     | `fabric.PencilBrush`               |
| 箭头     | 自定义 `fabric.Line` + 箭头端点     |
| 矩形框   | `fabric.Rect` (无填充，有边框)      |
| 椭圆框   | `fabric.Ellipse`                    |
| 文字     | `fabric.IText` (可编辑)             |
| 马赛克   | 像素化滤镜 (`pixelate`) 应用到选区  |

#### 3.6.3 状态管理

- 操作历史栈（用于撤销/重做）存储在组件内部状态
- 每次操作前保存 Canvas JSON 快照
- 撤销 = 恢复上一个快照，重做 = 恢复下一个快照

### 3.7 插件系统

#### 3.7.1 插件 Manifest

```json
{
  "name": "example-plugin",
  "version": "1.0.0",
  "description": "示例插件",
  "author": "Author Name",
  "main": "index.js",
  "permissions": [
    "clipboard:read",
    "clipboard:write",
    "ui:panel",
    "context-menu"
  ],
  "hooks": [
    "onClipboardChange",
    "onBeforePaste"
  ],
  "ui": {
    "panel": {
      "title": "示例面板",
      "icon": "icon.svg",
      "entry": "panel.html"
    }
  }
}
```

#### 3.7.2 插件 API（暴露给插件的接口）

```typescript
interface PluginAPI {
  clipboard: {
    getHistory(limit: number): Promise<ClipboardEntry[]>;
    getEntry(id: string): Promise<ClipboardEntry>;
    writeText(text: string): Promise<void>;
  };
  ui: {
    showToast(message: string, type: 'info' | 'success' | 'error'): void;
    registerContextMenu(item: MenuItem): void;
  };
  storage: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
  };
  events: {
    on(event: string, handler: Function): void;
    off(event: string, handler: Function): void;
  };
}
```

#### 3.7.3 沙箱隔离

- 前端插件通过 `<iframe sandbox="allow-scripts">` 加载
- 通过 `postMessage` 与主应用通信
- 插件只能访问 manifest 中声明的权限对应的 API
- 插件存储隔离，各插件独立的 localStorage 空间

---

## 4. 数据库设计

### 4.1 SQLite 表结构

#### entries 表（剪贴板条目）

```sql
CREATE TABLE entries (
    id              TEXT PRIMARY KEY,          -- UUID
    content_type    TEXT NOT NULL,             -- PlainText/RichText/Image/FilePaths
    text_content    TEXT,                      -- 文本内容
    html_content    TEXT,                      -- HTML 富文本内容
    blob_path       TEXT,                      -- 二进制文件路径 (相对路径)
    thumbnail_path  TEXT,                      -- 缩略图路径
    content_hash    TEXT NOT NULL,             -- SHA-256
    source_app      TEXT,                      -- 来源应用
    device_id       TEXT NOT NULL,             -- 设备 ID
    is_favorite     INTEGER DEFAULT 0,         -- 是否收藏
    created_at      TEXT NOT NULL,             -- ISO8601
    updated_at      TEXT NOT NULL,
    synced_at       TEXT,
    sync_status     TEXT DEFAULT 'local',      -- local/synced/pending/conflict
    deleted         INTEGER DEFAULT 0          -- 软删除标记
);

CREATE INDEX idx_entries_hash ON entries(content_hash);
CREATE INDEX idx_entries_created ON entries(created_at DESC);
CREATE INDEX idx_entries_type ON entries(content_type);
CREATE INDEX idx_entries_sync ON entries(sync_status);
CREATE INDEX idx_entries_favorite ON entries(is_favorite) WHERE is_favorite = 1;
```

#### tags 表

```sql
CREATE TABLE tags (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id    TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    tag         TEXT NOT NULL
);

CREATE INDEX idx_tags_entry ON tags(entry_id);
CREATE INDEX idx_tags_name ON tags(tag);
```

#### templates 表（模板）

```sql
CREATE TABLE templates (
    id          TEXT PRIMARY KEY,              -- UUID
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,                 -- 模板内容（含变量占位符）
    group_name  TEXT DEFAULT 'default',        -- 分组名称
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
```

#### settings 表

```sql
CREATE TABLE settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,                 -- JSON 序列化
    updated_at  TEXT NOT NULL
);
```

#### sync_log 表（同步日志）

```sql
CREATE TABLE sync_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id    TEXT,
    action      TEXT NOT NULL,                 -- upload/download/conflict/delete
    adapter     TEXT NOT NULL,                 -- webdav/gdrive/onedrive
    status      TEXT NOT NULL,                 -- success/failed
    message     TEXT,
    created_at  TEXT NOT NULL
);

CREATE INDEX idx_sync_log_time ON sync_log(created_at DESC);
```

---

## 5. IPC 接口设计

### 5.1 Tauri Commands

#### 剪贴板相关

| Command                  | 参数                           | 返回值               | 说明              |
| ------------------------ | ------------------------------ | -------------------- | ----------------- |
| `get_clipboard_history`  | `{ limit, offset, type_filter, keyword, tag }` | `Vec<ClipboardEntry>` | 获取历史记录 |
| `get_entry`              | `{ id }`                       | `ClipboardEntry`     | 获取单条详情      |
| `delete_entries`         | `{ ids }`                      | `()`                 | 批量删除          |
| `toggle_favorite`        | `{ id }`                       | `bool`               | 切换收藏状态      |
| `add_tag`                | `{ entry_id, tag }`            | `()`                 | 添加标签          |
| `remove_tag`             | `{ entry_id, tag }`            | `()`                 | 移除标签          |
| `paste_entry`            | `{ id, mode }`                 | `()`                 | 填充到活动窗口    |
| `clear_history`          | `{ keep_favorites }`           | `()`                 | 清空历史          |

#### 同步相关

| Command              | 参数                                       | 返回值           | 说明              |
| -------------------- | ------------------------------------------ | ---------------- | ----------------- |
| `configure_sync`     | `{ adapter, config }`                      | `()`             | 配置同步适配器    |
| `test_sync_connection` | `{ adapter }`                            | `Result<()>`     | 测试连接          |
| `trigger_sync`       | `()`                                       | `()`             | 手动触发同步      |
| `get_sync_status`    | `()`                                       | `SyncStatus`     | 获取同步状态      |
| `resolve_conflict`   | `{ entry_id, resolution }`                 | `()`             | 解决冲突          |

#### 翻译相关

| Command               | 参数                                     | 返回值             | 说明              |
| ---------------------- | ---------------------------------------- | ------------------ | ----------------- |
| `translate_text`       | `{ text, from, to, engine }`             | `TranslateResult`  | 翻译文本          |
| `detect_language`      | `{ text }`                               | `String`           | 检测语言          |
| `configure_translate`  | `{ engine, api_key, api_secret }`        | `()`               | 配置翻译引擎      |

#### 模板相关

| Command                | 参数                                    | 返回值             | 说明              |
| ---------------------- | --------------------------------------- | ------------------ | ----------------- |
| `get_templates`        | `{ group }`                             | `Vec<Template>`    | 获取模板列表      |
| `create_template`      | `{ title, content, group }`             | `Template`         | 创建模板          |
| `update_template`      | `{ id, title, content, group }`         | `Template`         | 更新模板          |
| `delete_template`      | `{ id }`                                | `()`               | 删除模板          |
| `apply_template`       | `{ id }`                                | `String`           | 应用模板（替换变量）|

#### 设置相关

| Command             | 参数              | 返回值           | 说明              |
| ------------------- | ----------------- | ---------------- | ----------------- |
| `get_settings`      | `()`              | `Settings`       | 获取所有设置      |
| `update_settings`   | `{ key, value }`  | `()`             | 更新设置项        |
| `export_data`       | `{ path }`        | `()`             | 导出数据          |
| `import_data`       | `{ path }`        | `()`             | 导入数据          |

### 5.2 Tauri Events（后端 → 前端）

| Event                 | Payload              | 说明                      |
| --------------------- | -------------------- | ------------------------- |
| `clipboard-changed`   | `ClipboardEntry`     | 剪贴板内容变化            |
| `sync-status-changed` | `SyncStatusPayload`  | 同步状态变更              |
| `sync-conflict`       | `ConflictPayload`    | 发现同步冲突              |
| `translate-auto`      | `TranslateResult`    | 自动翻译结果              |
| `plugin-event`        | `PluginEventPayload` | 插件事件                  |

---

## 6. 安全设计

### 6.1 敏感数据保护

- **API Key 存储**：使用 `keyring-rs` 存储到系统密钥管理器
  - macOS: Keychain
  - Windows: Credential Manager
  - Linux: Secret Service (GNOME Keyring / KWallet)
- **同步加密**：可选的端到端加密
  - 使用 AES-256-GCM 对称加密
  - 加密密钥由用户设置的密码 + PBKDF2 派生
  - 加密密钥本身不上传到云端

### 6.2 插件安全

- iframe sandbox 隔离，禁止直接访问主应用 DOM
- 权限声明制：插件只能调用 manifest 中声明的 API
- 网络访问受限：插件不能直接发起网络请求

---

## 7. 性能优化策略

### 7.1 内存管理

- 图片内容不加载到内存，只保存文件路径引用
- 列表使用虚拟滚动（`react-virtuoso`），只渲染可视区域
- 缩略图延迟加载

### 7.2 搜索优化

- SQLite FTS5 全文搜索索引（仅对文本内容）
- 类型/标签筛选走普通索引

### 7.3 同步优化

- 增量同步，基于时间戳 + hash
- 大文件分块上传，支持断点续传
- 同步队列优先级：文本 > 图片 > 文件
- 压缩传输（gzip）

### 7.4 启动优化

- 剪贴板监听和同步引擎异步启动
- UI 先渲染骨架屏，数据异步加载
- 数据库连接池（r2d2）

---

## 8. 测试策略

### 8.1 测试分层

| 层级       | 工具                     | 覆盖范围                |
| ---------- | ------------------------ | ----------------------- |
| Rust 单元  | `cargo test`             | 核心逻辑、数据处理、同步算法 |
| Rust 集成  | `cargo test` + mock 适配器 | 同步流程、翻译降级       |
| 前端单元   | Vitest + Testing Library | 组件渲染、Store 逻辑     |
| 前端集成   | Vitest                   | 页面交互流程             |
| E2E        | Tauri Driver (WebDriver) | 完整用户流程             |

### 8.2 关键测试场景

- 剪贴板监听：快速连续复制不丢数据
- 同步冲突：多设备同时修改同一条目
- 离线同步：断网后恢复连接的数据积压处理
- 翻译降级：主引擎超时后自动切换
- 大量数据：1000+ 条目的搜索和渲染性能

---

## 9. 构建与发布

### 9.1 CI/CD

- GitHub Actions 构建三平台安装包
- Windows: `.msi` + `.exe` (NSIS)
- macOS: `.dmg` + `.app`
- Linux: `.deb` + `.AppImage`

### 9.2 自动更新

- 使用 Tauri 内置的 `tauri-plugin-updater`
- 更新源托管在 GitHub Releases
- 支持增量更新

---

## 10. 里程碑规划

### M1 - 基础功能（MVP）
- 剪贴板监听与历史管理
- 全局快捷键呼出面板
- 智能填充
- 收藏功能
- 基础设置（主题/开机启动/快捷键配置）
- 本地 SQLite 存储

### M2 - 同步与翻译
- WebDAV 同步适配器
- 同步冲突处理
- 翻译模块（百度/有道/谷歌）
- 模板功能

### M3 - 图片编辑与更多云存储
- 图片标注编辑器
- Google Drive 适配器
- OneDrive 适配器
- 端到端加密

### M4 - 插件生态
- 插件引擎核心
- 插件 API
- 插件沙箱
- 示例插件
- 云存储适配器迁移为内置插件

---

## 附录 A：Rust Crate 依赖参考

| Crate                   | 用途                     |
| ----------------------- | ------------------------ |
| `tauri`                 | 桌面应用框架             |
| `tauri-plugin-global-shortcut` | 全局快捷键        |
| `tauri-plugin-updater`  | 自动更新                 |
| `tauri-plugin-shell`    | 系统交互                 |
| `rusqlite`              | SQLite 操作              |
| `r2d2`                  | 连接池                   |
| `reqwest`               | HTTP 客户端              |
| `serde` / `serde_json`  | 序列化                   |
| `uuid`                  | UUID 生成                |
| `sha2`                  | SHA-256 hash             |
| `aes-gcm`               | AES-256 加密             |
| `keyring`               | 系统密钥管理             |
| `arboard`               | 跨平台剪贴板读写         |
| `tokio`                 | 异步运行时               |
| `chrono`                | 时间处理                 |
| `image`                 | 图片处理/缩略图          |
| `log` / `env_logger`    | 日志                     |

## 附录 B：前端依赖参考

| 包                      | 用途                     |
| ----------------------- | ------------------------ |
| `react` / `react-dom`   | UI 框架                  |
| `@tauri-apps/api`       | Tauri 前端 API           |
| `zustand`               | 状态管理                 |
| `fabric`                | Canvas 图片编辑          |
| `tailwindcss`           | CSS 框架                 |
| `shadcn/ui`             | 组件库                   |
| `react-virtuoso`        | 虚拟滚动                 |
| `react-i18next`         | 国际化                   |
| `lucide-react`          | 图标库                   |
| `react-hotkeys-hook`    | 快捷键 (面板内)          |
| `sonner`                | Toast 通知               |
