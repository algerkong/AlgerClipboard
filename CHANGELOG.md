# Changelog

## [1.6.3] - 2026-03-10

### New Features

- **FTS5 Full-Text Search**: Completely replaced simple SQL LIKE search with SQLite FTS5 full-text search engine
  - **Multi-field search**: Searches across text content, AI summaries, file names, source app, tags, and OCR text simultaneously
  - **Pinyin matching**: Automatically indexes Chinese text as pinyin (full spelling + initials) for phonetic search (e.g. "nihao" matches "你好")
  - **Regex search**: Wrap search pattern in `/pattern/` for regex matching across all fields, with visual `.*` indicator
  - **Advanced query syntax**: Multi-keyword AND (`foo bar`), exact phrase (`"exact phrase"`), exclusion (`-word`), prefix matching (`token*`)
  - **Time range filter**: Hover-reveal calendar icon to filter by Today / 3 Days / Week / Month / 3 Months
  - **Search history**: Hover-reveal recent search dropdown with delete and clear all
  - **Fuzzy prefix matching**: Tokens automatically use prefix matching for broader results
- **Image OCR Text Search**: OCR-extracted text is now indexed in FTS5 for image search
  - Auto-OCR writes extracted text to entries for indexing
  - Image thumbnails show OCR text snippet with keyword highlighting when matched
- **Context-Aware Search Snippets**: Search result previews now show text around the match position instead of always showing the beginning of the text
- **Search Result Highlighting**: Keywords highlighted in text previews, AI summaries, file names, and OCR text with `<mark>` tags
- **Search Guide Documentation**: Added bilingual (Chinese/English) search usage guide at `docs/en/search-guide.md` and `docs/zh-CN/search-guide.md`

### Improvements

- **Main window UI redesign**: Redesigned clipboard main window layout and styling
- **Image viewer enhancements**: Added background mode toggle and fit/actual size toggle
- **Auto-update improvements**: Added system notification, confirmation dialog, and periodic check for auto-update
- **UI flash prevention**: Eliminated UI scale and font flash on window open by caching in localStorage
- **Theme flash prevention**: Eliminated theme flash on window open by caching theme in localStorage
- **i18n modularization**: Split i18n locale files into modular per-feature JSON files
- **Settings UI optimization**: Optimized settings page UI layout with shared components; replaced native select with custom StyledSelect
- **Detail page optimization**: Optimized detail page UI with custom StyledSelect component

### Bug Fixes

- **Single-instance windows**: Enforced single instance for settings, tag-manager, and template-manager windows
- **Window capabilities**: Added fixed window labels to capabilities for single-instance windows
- **Main window shortcut**: Prevented main window from auto-closing on shortcut invocation
- **Settings window**: Removed always-on-top and simplified pin button
- **Dark theme contrast**: Optimized dark theme contrast and throttle color picker during drag
- **OCR runtime unpacking**: Fixed backslash directory entries in OCR runtime archive unpacking
- **PowerShell compatibility**: Support PowerShell 5.1 in RapidOCR build script

---

## [1.6.3] - 2026-03-10 (中文)

### 新功能

- **FTS5 全文搜索**: 完全替换简单 SQL LIKE 搜索，升级为 SQLite FTS5 全文搜索引擎
  - **多字段搜索**: 同时搜索文本内容、AI 摘要、文件名、来源应用、标签和 OCR 文字
  - **拼音匹配**: 自动为中文文本建立拼音索引（全拼 + 首字母），支持拼音搜索（如输入 "nihao" 匹配 "你好"）
  - **正则搜索**: 用 `/pattern/` 包裹搜索模式进行正则匹配，搜索图标变为 `.*` 视觉提示
  - **高级查询语法**: 多关键词 AND（`foo bar`）、精确短语（`"exact phrase"`）、排除词（`-word`）、前缀匹配（`token*`）
  - **时间范围筛选**: 悬停搜索栏显示日历图标，可按今天 / 3天 / 本周 / 本月 / 3个月筛选
  - **搜索历史**: 悬停搜索栏显示最近搜索记录下拉框，支持单条删除和全部清除
  - **模糊前缀匹配**: 搜索词自动使用前缀匹配以获取更广泛的结果
- **图片 OCR 文字搜索**: OCR 提取的文字现已建立 FTS5 索引，支持搜索图片中的文字
  - 自动 OCR 完成后将文字写入条目以建立索引
  - 搜索匹配时在图片缩略图下方显示 OCR 文字片段并高亮关键词
- **上下文感知搜索预览**: 搜索结果预览现在显示匹配位置附近的文本上下文，而不是总显示文本开头
- **搜索结果高亮**: 关键词在文本预览、AI 摘要、文件名和 OCR 文字中以 `<mark>` 标签高亮
- **搜索指南文档**: 新增中英双语搜索使用指南，位于 `docs/en/search-guide.md` 和 `docs/zh-CN/search-guide.md`

### 改进

- **主窗口 UI 重设计**: 重新设计剪贴板主窗口布局和样式
- **图片查看器增强**: 新增背景模式切换和适应/实际尺寸切换
- **自动更新改进**: 新增系统通知、确认对话框和定期检查功能
- **UI 闪烁消除**: 通过 localStorage 缓存消除窗口打开时的 UI 缩放和字体闪烁
- **主题闪烁消除**: 通过 localStorage 缓存消除窗口打开时的主题闪烁
- **i18n 模块化**: 将国际化翻译文件按功能模块拆分为独立 JSON 文件
- **设置页 UI 优化**: 优化设置页面布局，使用共享组件；用自定义 StyledSelect 替换原生下拉框
- **详情页优化**: 优化详情页 UI，新增自定义 StyledSelect 组件

### Bug 修复

- **单实例窗口**: 强制设置、标签管理器、模板管理器窗口为单实例
- **窗口权限**: 为单实例窗口添加固定窗口标签到 capabilities
- **主窗口快捷键**: 修复快捷键触发时主窗口自动关闭的问题
- **设置窗口**: 移除置顶行为，简化固定按钮
- **暗色主题对比度**: 优化暗色主题对比度，拖拽时节流颜色选择器
- **OCR 运行时解压**: 修复 OCR 运行时归档解压时的反斜杠目录条目问题
- **PowerShell 兼容性**: 支持 PowerShell 5.1 运行 RapidOCR 构建脚本

---

## [1.6.2] - 2026-03-09

### New Features

- **RapidOCR Runtime Installer**: Added a downloadable RapidOCR runtime flow for macOS and Linux, including manifest-based installation, mirror fallback, SHA-256 verification, and runtime version management
- **RapidOCR Runtime for Windows**: Added Windows RapidOCR runtime packaging and release support so Windows users can install the same downloadable OCR runtime from Settings
- **RapidOCR Release Automation**: Added GitHub Actions and manifest tooling to build and publish RapidOCR runtime assets alongside tagged releases
- **Settings Version Display**: Added current app version display in Settings → General for easier support and troubleshooting
- **RapidOCR Development Docs**: Added a consolidated bilingual RapidOCR development guide and linked it from the project READMEs

### Improvements

- **OCR platform defaults**: macOS and Linux now use RapidOCR runtime distribution instead of relying on fragile native OCR environment setup, while Windows keeps native OCR as default and also supports RapidOCR runtime installation
- **Documentation links**: Updated README documentation links to point at the actual bilingual docs structure

---

## [1.6.2] - 2026-03-09 (中文)

### 新功能

- **RapidOCR 运行时安装器**: 为 macOS 和 Linux 增加可下载的 RapidOCR 运行时安装流程，支持基于 manifest 的安装、镜像回退、SHA-256 校验和运行时版本管理
- **Windows RapidOCR 支持**: 新增 Windows RapidOCR 运行时打包和发布支持，Windows 用户也可以在设置页安装同一套可下载 OCR 运行时
- **RapidOCR 发布自动化**: 新增 GitHub Actions 和 manifest 工具链，在 tag 发版时自动构建并上传 RapidOCR 运行时资产
- **设置页版本显示**: 在 设置 → 通用 中新增当前应用版本显示，便于排查问题和确认安装版本
- **RapidOCR 开发文档**: 新增整合后的中英文 RapidOCR 开发说明，并在项目 README 中提供入口

### 改进

- **OCR 平台默认策略**: macOS 和 Linux 改为使用 RapidOCR 运行时分发，不再依赖脆弱的系统原生 OCR 环境；Windows 保留原生 OCR 为默认引擎，同时支持安装 RapidOCR 运行时
- **文档链接**: 修正 README 中的文档链接，统一指向现有的中英文文档目录

---

## [1.6.1] - 2026-03-09

### New Features

- **Multi-Engine OCR System**: Completely redesigned OCR architecture with a unified `OcrEngine` trait and 7 engine support
  - **Native OCR**: Built-in OS-level OCR (Windows.Media.Ocr / macOS Vision / Linux Tesseract), works offline
  - **Baidu OCR**: High-accuracy Chinese text recognition via Baidu Cloud API (free tier: 50,000 calls/month)
  - **Google Cloud Vision**: Excellent multi-language OCR via Google Cloud API (free tier: 1,000 calls/month)
  - **Tencent OCR**: Chinese text recognition via Tencent Cloud API (free tier: 1,000 calls/month)
  - **Local Model**: Run local OCR models (PaddleOCR, RapidOCR, etc.) via stdin/stdout JSON protocol
  - **Online Model**: Connect to self-hosted OCR services via HTTP API
  - **AI Vision**: Use AI models (GPT-4o, Claude, Qwen-VL) for OCR through OpenAI-compatible API
- **OCR Settings Tab**: New settings tab for configuring OCR engines with auto-save (no manual save button needed)
  - Enable/disable engines individually with toggle switches
  - Configure API keys, endpoints, model names per engine
  - Set default OCR engine for all recognition tasks
- **OCR Engine Selector**: Dropdown in image preview title bar to switch OCR engines on-the-fly
- **OCR Result Caching**: OCR results are cached by image content hash + engine type in SQLite, avoiding redundant re-processing of the same image
  - Cache can be cleared from Settings → OCR → "Clear OCR Cache"
- **Bilingual Documentation**: Added comprehensive OCR integration guide and cloud sync guide in both Chinese and English (`docs/zh-CN/`, `docs/en/`)

### Bug Fixes

- **Windows OCR CJK spacing**: Fixed Windows.Media.Ocr inserting spaces between every CJK character (e.g. "你 好 世 界" → "你好世界"). Added post-processing to strip spurious spaces between CJK characters while preserving legitimate word spacing
- **OCR text overlay misalignment**: Fixed OCR selectable text layer being offset to the left with unselected area on the right. Replaced padding-based bounding box expansion with PDF.js-style `scaleX` approach — text is rendered at natural width then scaled horizontally to match the exact OCR bounding box
- **Image viewer height fitting**: Image preview now prioritizes fitting the full image height within the window, so the entire image is visible without scrolling on first open

### Improvements

- **OCR architecture**: All engines implement a unified `OcrEngine` async trait with `dispatch_ocr()` fallback chain — if the preferred engine fails, remaining engines are tried in order
- **Extensible engine system**: Adding a new OCR engine requires only 4 steps: create engine file, register module, add to command dispatch, add to frontend engine list

---

## [1.6.1] - 2026-03-09 (中文)

### 新功能

- **多引擎 OCR 系统**: 全面重构 OCR 架构，统一 `OcrEngine` trait，支持 7 种引擎
  - **原生 OCR**: 系统内置 OCR（Windows.Media.Ocr / macOS Vision / Linux Tesseract），离线可用
  - **百度 OCR**: 百度智能云高精度中文识别（免费额度：标准版 50,000 次/月）
  - **Google Cloud Vision**: Google 云多语言 OCR（免费额度：1,000 次/月）
  - **腾讯 OCR**: 腾讯云中文识别（免费额度：1,000 次/月）
  - **本地模型**: 运行本地 OCR 模型（PaddleOCR、RapidOCR 等），通过 stdin/stdout JSON 协议通信
  - **在线模型**: 连接自托管 OCR 服务的 HTTP API
  - **AI 视觉**: 通过 OpenAI 兼容 API 使用 AI 模型（GPT-4o、Claude、Qwen-VL）进行 OCR
- **OCR 设置标签页**: 新增 OCR 设置页，配置自动保存（无需手动点击保存按钮）
  - 独立的引擎启用/禁用开关
  - 每个引擎独立配置 API Key、端点、模型名等
  - 设置默认 OCR 引擎
- **OCR 引擎选择器**: 图片预览标题栏新增引擎下拉菜单，可实时切换 OCR 引擎
- **OCR 结果缓存**: 按图片内容哈希 + 引擎类型缓存 OCR 结果到 SQLite，避免重复识别同一张图片
  - 可在 设置 → OCR → "清除 OCR 缓存" 中清除缓存
- **双语文档**: 新增 OCR 集成指南和云同步指南的中英双语版本（`docs/zh-CN/`、`docs/en/`）

### Bug 修复

- **Windows OCR 中文字符间距**: 修复 Windows.Media.Ocr 在每个中文字符之间插入空格的问题（如 "你 好 世 界" → "你好世界"）。添加后处理逻辑，移除 CJK 字符间的多余空格，保留正常的单词间距
- **OCR 文字选区偏移**: 修复 OCR 可选文字层向左偏移、右侧有未选中区域的问题。将基于 padding 的边界框扩展替换为 PDF.js 风格的 `scaleX` 方案——文字以自然宽度渲染后水平缩放以精确匹配 OCR 检测到的边界框
- **图片预览高度适配**: 图片预览现在优先适配完整图片高度，首次打开时整张图片可见，无需滚动

### 改进

- **OCR 架构**: 所有引擎实现统一的 `OcrEngine` 异步 trait，通过 `dispatch_ocr()` 回退链——首选引擎失败时自动尝试其余引擎
- **可扩展引擎系统**: 添加新 OCR 引擎只需 4 步：创建引擎文件、注册模块、添加命令分发、添加前端引擎列表

---

## [1.6.0] - 2026-03-09

### New Features

- **Ask AI Panel**: Built-in AI assistant panel with multi-service WebView integration
  - **Multi-Service Tabs**: Browser-style tab bar supporting ChatGPT, Claude, Gemini, DeepSeek, Kimi, Doubao, Tongyi Qwen, and more
  - **One-Click Ask AI**: Sparkle button on each clipboard entry to instantly send content to any AI service with customizable presets
  - **Preset System**: Built-in presets (Summarize, Translate, Explain Code, etc.) with custom prompt support and icons
  - **Auto-Fill & Submit**: Injection scripts auto-fill prompts into AI service input fields and optionally auto-submit
  - **Per-Service Session Isolation**: Each AI service runs in an isolated WebView with separate cookies/sessions
  - **Favicon Support**: Auto-fetched service favicons with local caching
  - **Ask AI Settings Tab**: Enable/disable services, reorder tabs, manage presets from settings
- **Detail Page Redesign**: Completely rebuilt detail page with rich editing and rendering
  - **CodeMirror 6 Editor**: Full-featured code editor with syntax highlighting for 12+ languages, line numbers, bracket matching, code folding, and active line highlight
  - **Editor Toolbar**: Font size control (11–20px), line number toggle, word wrap toggle — all dynamically reconfigurable without losing editor state
  - **TipTap 2 Rich Text Editor**: WYSIWYG editor for rich text and plain text editing with formatting toolbar (bold, italic, underline, lists, tables, code blocks, links, etc.)
  - **Markdown Preview**: GitHub Flavored Markdown rendering with KaTeX math formulas, Shiki code block syntax highlighting, and Mermaid diagram support
  - **Split View**: Draggable split layout for simultaneous editing and preview (editor-only / split / preview-only modes)
  - **Smart Content Detection**: Automatic content type detection (code/markdown/richtext/plaintext) to select the appropriate editor and renderer
- **Clipboard Source Tracking**: Show source app name, icon, and URL for each clipboard entry with clickable links
- **Configurable Rich Text Rendering**: Choose between clean and full rendering modes for rich text content in detail view
- **Tag Manager**: Full tag management with create, rename, delete operations and tag-based filtering
- **Quick Paste Shortcuts**: Keyboard shortcuts for fast paste operations
- **Window Size Persistence**: All windows (main, detail, settings, image viewer, Ask AI) now remember their size between sessions
- **System Notifications**: Native OS notifications for app feedback (via tauri-plugin-notification)
- **License**: Project license changed to GPL-3.0

### Bug Fixes

- **Clipboard list not updating after detail edit**: Fixed by emitting `entry-updated` event from Rust backend when text is saved
- **Favicon URLs for Chinese AI services**: Fixed incorrect favicon paths for domestic services
- **AI WebView window decorations**: Use native window decorations for better cross-platform compatibility
- **macOS window chrome**: Unified toolbar styling with native mac window chrome
- **Rust compilation warnings**: Fixed macOS-only function annotations, null pointer type, and dev-mode improvements

### Improvements

- **Translate & AI config flows**: Streamlined translation engine and AI provider configuration
- **Sync backend adapters**: Refined WebDAV/Google Drive/OneDrive adapter implementations
- **Paste and OCR backend**: Cleaned up paste simulation and OCR processing flow

---

## [1.6.0] - 2026-03-09 (中文)

### 新功能

- **Ask AI 面板**: 内置 AI 助手面板，多服务 WebView 集成
  - **多服务标签页**: 浏览器风格标签栏，支持 ChatGPT、Claude、Gemini、DeepSeek、Kimi、豆包、通义千问等
  - **一键问 AI**: 每条剪贴板记录上的闪光按钮，可将内容即时发送到任意 AI 服务，支持自定义预设
  - **预设系统**: 内置预设（摘要、翻译、代码解释等），支持自定义提示词和图标
  - **自动填充提交**: 注入脚本自动将提示词填入 AI 服务的输入框，可选自动提交
  - **每服务独立会话**: 每个 AI 服务运行在隔离的 WebView 中，独立的 Cookie 和会话
  - **Favicon 支持**: 自动获取服务图标并本地缓存
  - **Ask AI 设置标签页**: 在设置中启用/禁用服务、调整顺序、管理预设
- **详情页全面重构**: 全新的富文本编辑和渲染系统
  - **CodeMirror 6 代码编辑器**: 支持 12+ 种语言语法高亮、行号、括号匹配、代码折叠、活动行高亮
  - **编辑器工具栏**: 字体大小调节（11–20px）、行号显示/隐藏、自动换行开关 — 动态切换不丢失编辑状态
  - **TipTap 2 富文本编辑器**: 所见即所得编辑器，支持格式工具栏（加粗、斜体、下划线、列表、表格、代码块、链接等），纯文本和富文本均可使用
  - **Markdown 预览**: 支持 GFM 语法、KaTeX 数学公式、Shiki 代码块语法高亮、Mermaid 流程图渲染
  - **分屏视图**: 可拖拽的分屏布局，支持编辑和预览同时显示（纯编辑器 / 分屏 / 纯预览三种模式）
  - **智能内容检测**: 自动识别内容类型（代码/Markdown/富文本/纯文本），自动选择合适的编辑器和渲染器
- **剪贴板来源追踪**: 显示每条记录的来源应用名称、图标和 URL，支持点击链接
- **可配置富文本渲染**: 在详情视图中选择简洁或完整的富文本渲染模式
- **标签管理器**: 完整的标签管理功能，支持创建、重命名、删除操作和基于标签的筛选
- **快捷粘贴**: 快捷键快速粘贴操作
- **窗口尺寸记忆**: 所有窗口（主窗口、详情、设置、图片查看器、Ask AI）均会记住用户调整的大小，下次打开时自动恢复
- **系统通知**: 使用原生系统通知进行应用反馈（通过 tauri-plugin-notification）
- **开源协议**: 项目许可证变更为 GPL-3.0

### Bug 修复

- **详情页编辑后列表不更新**: 通过 Rust 后端发出 `entry-updated` 事件，clipboardStore 监听后自动刷新
- **国内 AI 服务图标 URL**: 修复国内服务的 favicon 路径错误
- **AI WebView 窗口装饰**: 使用原生窗口装饰以提升跨平台兼容性
- **macOS 窗口样式**: 统一工具栏样式与原生 macOS 窗口风格
- **Rust 编译警告**: 修复 macOS 专用函数注解、空指针类型、开发模式改进

### 改进

- **翻译和 AI 配置流程**: 精简翻译引擎和 AI 服务商配置流程
- **同步后端适配器**: 优化 WebDAV/Google Drive/OneDrive 适配器实现
- **粘贴和 OCR 后端**: 清理粘贴模拟和 OCR 处理流程

---

## [1.5.2] - 2026-03-07

### New Features

- **AI Module**: Full AI integration with multi-provider support (OpenAI, Claude, Gemini, DeepSeek, Ollama, custom OpenAI-compatible)
  - **AI Auto-Summary**: Automatically summarize long clipboard text entries, with configurable minimum length and summary language
  - **AI Translation**: Use AI as an alternative to traditional translation APIs, toggle in the translate panel
  - **Custom Prompts**: Configurable prompt templates for summary and translation with variable placeholders (`{language}`, `{max_length}`, `{from_lang}`, `{to_lang}`), with reset-to-default support
  - **Dynamic Model Fetching**: Fetch available models from provider APIs instead of hardcoded lists
  - **Provider Presets**: Pre-configured API endpoints for major AI providers
- **Detail Window**: Standalone window for viewing, editing, translating, and summarizing clipboard entries. Replaces inline viewers with a dedicated 680x520 window featuring View/Translate/AI tabs
- **Smart Classification**: Auto-classify clipboard entries on capture with content category detection (Code, Email, URL, JSON, XML, Markdown, SQL, Command Line, etc.) and programming language detection (19 languages)
- **Settings in Separate Window**: Settings page now opens in its own window instead of inline, with a new AI configuration tab
- **Context Menu Improvements**: Portal-based rendering to prevent overflow clipping, smart auto-positioning (flip when near edges, scroll when too tall), keyboard navigation (arrow keys + Enter), modern Fluent-style design with scale-in animation

### Bug Fixes

- **Paste simulation**: Improved paste reliability and URL handling

---

## [1.5.2] - 2026-03-07 (中文)

### 新功能

- **AI 模块**: 完整的 AI 集成，支持多种服务商（OpenAI、Claude、Gemini、DeepSeek、Ollama、自定义 OpenAI 兼容接口）
  - **AI 自动摘要**: 自动为长文本剪贴板内容生成摘要，可配置最小长度和摘要语言
  - **AI 翻译**: 使用 AI 作为传统翻译 API 的替代方案，在翻译面板中切换
  - **自定义提示词**: 可配置摘要和翻译的提示词模板，支持变量占位符（`{language}`、`{max_length}`、`{from_lang}`、`{to_lang}`），支持重置为默认值
  - **动态模型获取**: 从服务商 API 动态获取可用模型列表，而非硬编码
  - **服务商预设**: 主流 AI 服务商的预配置 API 端点
- **详情窗口**: 独立窗口查看、编辑、翻译和摘要剪贴板内容。用 680x520 的专用窗口替代内嵌查看器，包含查看/翻译/AI 三个标签页
- **智能分类**: 剪贴板内容捕获时自动分类，包括内容类别检测（代码、邮件、URL、JSON、XML、Markdown、SQL、命令行等）和编程语言检测（19 种语言）
- **设置独立窗口**: 设置页面现在在独立窗口中打开，新增 AI 配置标签页
- **右键菜单优化**: 基于 Portal 渲染防止溢出裁切，智能自动定位（靠近边缘时自动翻转，过高时可滚动），键盘导航（方向键 + Enter），现代 Fluent 风格设计搭配缩放入场动画

### Bug 修复

- **粘贴模拟**: 改进粘贴可靠性和 URL 处理

---

## [1.5.1] - 2026-03-07

### New Features

- **Open URL in browser**: Clipboard entries containing URLs now show an "Open in Browser" button (hover action + context menu). Automatically detects `http://` and `https://` links in text content
- **Configurable default browser**: Choose which browser opens URLs — System Default, Chrome, Firefox, Edge, Brave, or Safari (macOS). Configurable in Settings > General
- **Smart window positioning**: Clipboard window now appears near the active text caret when triggered via shortcut. Falls back to mouse cursor position when caret is unavailable
  - Windows: Uses `GetGUIThreadInfo` for precise caret detection with `GetCursorPos` fallback
  - macOS/Linux: Uses Tauri cross-platform cursor position API

### Bug Fixes

- **macOS title bar**: Removed non-functional fullscreen (green) button, keeping only close and minimize
- **Windows rounded corners**: Enabled native DWM rounded corners on Windows 11+ via `DWMWA_WINDOW_CORNER_PREFERENCE` API

---

## [1.5.1] - 2026-03-07 (中文)

### 新功能

- **浏览器打开链接**: 剪贴板内容包含 URL 时，显示「在浏览器中打开」按钮（悬浮操作 + 右键菜单）。自动检测文本中的 `http://` 和 `https://` 链接
- **可配置默认浏览器**: 选择打开链接的浏览器 — 系统默认、Chrome、Firefox、Edge、Brave 或 Safari (macOS)。在 设置 > 通用 中配置
- **智能窗口定位**: 通过快捷键呼出剪贴板时，窗口会出现在当前文本光标附近。无法获取光标时回退到鼠标位置
  - Windows: 使用 `GetGUIThreadInfo` 精确获取光标位置，`GetCursorPos` 作为回退
  - macOS/Linux: 使用 Tauri 跨平台光标位置 API

### Bug 修复

- **macOS 标题栏**: 移除无功能的全屏（绿色）按钮，仅保留关闭和最小化
- **Windows 窗口圆角**: 通过 `DWMWA_WINDOW_CORNER_PREFERENCE` API 在 Windows 11+ 上启用原生 DWM 圆角

---

## [1.5.0] - 2026-03-06

### New Features

- **Multi-platform TitleBar adaptation**: The custom title bar now adapts to each platform's native conventions
  - **macOS**: Faux-native red/yellow/green traffic light buttons on the left side, with window blur dimming effect
  - **Linux**: Configurable window button position (left or right) via Settings > General
  - **Windows**: Unchanged — square icon buttons on the right side
- **Platform detection**: Added `tauri-plugin-os` for runtime OS detection, exposed via `usePlatform()` React hook

---

## [1.5.0] - 2026-03-06 (中文)

### 新功能

- **多平台标题栏适配**: 自定义标题栏现在根据不同平台的原生习惯自适应布局
  - **macOS**: 左侧仿原生红黄绿交通灯按钮，窗口失焦时按钮自动变灰
  - **Linux**: 可在 设置 > 通用 中配置窗口按钮位置（左侧或右侧）
  - **Windows**: 保持不变 — 右侧方形图标按钮
- **平台检测**: 新增 `tauri-plugin-os` 运行时系统检测，通过 `usePlatform()` React hook 提供

---

## [1.4.0] - 2026-03-06

### New Features

- **Configurable toggle shortcut**: Global shortcut to show/hide clipboard is now customizable in settings. Includes a key-recording UI — click and press any key combination to set your preferred shortcut
- **Dynamic shortcut registration**: Shortcut changes take effect immediately without restarting the app
- **Project website**: Added official project website with i18n support

### Bug Fixes

- **Cross-platform clipboard capture**: Improved image and file capture logic with better deduplication across platforms
- **Window reopen behavior**: Only reset to home view when the window is actually reopened (not on every focus). Improved toast notification and search bar behavior

### Maintenance

- **Code cleanup**: Removed compiler warnings and unused sync scheduler code

---

## [1.4.0] - 2026-03-06 (中文)

### 新功能

- **可配置切换快捷键**: 显示/隐藏剪贴板的全局快捷键现在可在设置中自定义。提供按键录制 UI — 点击后按下任意组合键即可设置
- **动态快捷键注册**: 修改快捷键后立即生效，无需重启应用
- **项目官网**: 新增项目官方网站，支持多语言

### Bug 修复

- **跨平台剪贴板捕获**: 改进图片和文件的捕获逻辑，优化跨平台去重策略
- **窗口重新打开行为**: 仅在窗口真正重新打开时才重置到首页（而非每次获得焦点时）。改进了 toast 通知和搜索框行为

### 维护

- **代码清理**: 移除编译器警告和未使用的同步调度器代码

---

## [1.3.1] - 2026-03-05

### Bug Fixes

- **Single instance enforcement**: Prevent multiple app instances from launching. Double-clicking the shortcut while the app is running now focuses the existing window instead of opening a blank new one
- **Installer icon**: Fixed NSIS installer not displaying the custom app icon
- **Tray icon**: Fixed system tray showing default Tauri icon instead of app logo

---

## [1.3.1] - 2026-03-05 (中文)

### Bug 修复

- **单实例限制**: 防止应用启动多个实例。应用运行时双击快捷方式现在会聚焦已有窗口，而不是打开一个空白新窗口
- **安装器图标**: 修复 NSIS 安装器未显示自定义应用图标的问题
- **托盘图标**: 修复系统托盘显示 Tauri 默认图标而非应用 logo 的问题

---

## [1.3.0] - 2026-03-05

### New Features

- **Native folder picker for cache path**: Cache directory configuration now opens a system folder selection dialog instead of requiring manual path input
- **Open cache directory button**: Added "Open" button next to cache path to quickly open it in the system file explorer

### Bug Fixes

- **Deleted entries reappearing after sync**: Fixed a critical bug where deleted clipboard entries would reappear after cloud sync. Deletions are now properly propagated to the remote manifest and applied across devices
- **Template manager window issues**: Fixed template manager window unable to close. Added proper window permissions, replaced shared TitleBar with a dedicated window header, and added Escape key support
- **Arrow keys blocked by search bar**: Left/Right arrow keys now correctly switch type filter tabs and Up/Down arrow keys navigate entries even when the search input is focused

### Improvements

- **Auto-select first entry on open**: Clipboard panel now automatically selects the first entry and scrolls to top when opened via hotkey
- **Reset to home on reopen**: Each time the clipboard is reopened, it resets to the main view (closes settings, clears search and filters)
- **Copy time display**: Each entry card now shows the actual copy time (HH:mm) in the bottom-right corner of the metadata line

---

## [1.3.0] - 2026-03-05 (中文)

### 新功能

- **缓存路径原生文件夹选择**: 缓存目录配置现在直接打开系统文件夹选择对话框，无需手动输入路径
- **打开缓存目录按钮**: 缓存路径旁新增"打开"按钮，可快速在系统文件管理器中打开缓存目录

### Bug 修复

- **删除的条目同步后重新出现**: 修复了剪贴板条目删除后经过云同步又重新出现的严重 bug。删除操作现在会正确同步到远端清单并在所有设备上生效
- **模板管理窗口问题**: 修复模板管理窗口无法关闭的问题。添加了正确的窗口权限，使用专用窗口标题栏替代共享 TitleBar，支持 Escape 键关闭
- **方向键被搜索框拦截**: 左右方向键现在可以在搜索框聚焦时正常切换类型筛选标签，上下方向键可正常切换条目

### 改进

- **打开后自动选中第一条**: 通过快捷键呼出剪贴板时自动选中第一条并滚动到顶部
- **重新打开时回到首页**: 每次重新打开剪贴板时自动回到主视图（关闭设置、清空搜索和筛选）
- **显示复制时间**: 每条记录的右下角现在显示实际复制时间（HH:mm 格式）

---

## [1.2.0] - 2026-03-05

### New Features

- **Configurable cache location**: Manually change the cache directory with an option to migrate existing files or change path only. Restart required after change.
- **Cache size limit**: Set a maximum cache size (100MB / 250MB / 500MB / 1GB / 2GB / Unlimited). Automatically cleans up oldest non-favorite blobs when the limit is exceeded.
- **Settings sync across devices**: New "Sync Settings" toggle in the Sync tab. Syncs user preferences (theme, language, font, UI scale, etc.) across devices via cloud storage. Platform-specific settings like cache path are excluded.
- **File sync size limit**: Configure a maximum file size for sync (1MB / 5MB / 10MB / 50MB / 100MB / Unlimited). Files exceeding the limit are skipped during sync while entry metadata is still synced.

### Improvements

- **Redesigned translation dialog**:
  - Added one-click copy button for translated text with visual feedback
  - Added "Copy & Close" button to copy translation and dismiss the dialog in one step
  - Moved language selectors to the top bar for a more intuitive top-down flow
  - Added language swap button (⇄) between source and target
  - Language names now displayed in native script (中文, 日本語, 한국어, etc.)
  - Fixed incorrect word breaking caused by `break-all`

---

## [1.2.0] - 2026-03-05 (中文)

### 新功能

- **缓存位置可配置**: 支持手动修改缓存目录，修改时可选择迁移已有文件或仅更改路径，修改后需重启应用生效
- **缓存大小上限**: 可配置缓存大小限制（100MB / 250MB / 500MB / 1GB / 2GB / 不限制），超限时自动清理最旧的非收藏文件
- **系统设置同步**: 在同步功能中添加"同步设置"开关，可跨设备同步主题、语言、字体、界面缩放等用户偏好（不同步缓存路径等平台特定设置）
- **文件同步大小限制**: 可配置同步文件大小上限（1MB / 5MB / 10MB / 50MB / 100MB / 不限制），超过限制的文件跳过同步（仍同步条目元数据）

### 改进

- **翻译对话框重新设计**:
  - 新增一键复制翻译结果按钮，带视觉反馈
  - 新增"复制并关闭"按钮，复制译文后自动关闭对话框
  - 语言选择器移至顶部工具栏，操作流程更直观
  - 新增语言互换按钮（⇄）
  - 语言名称改用原生文字显示（中文、日本語、한국어 等）
  - 修复 `break-all` 导致的不当断词问题

---

## [1.1.0] - 2025-12-01

### New Features / 新功能

- Paste files as CF_HDROP format / 文件粘贴支持 CF_HDROP 格式
- Usage statistics with type distribution and daily trend / 使用统计（类型分布、每日趋势）
- Auto-expiration with time and quantity cleanup / 自动过期清理（按时间和数量）
- Tag system with CRUD and filtering / 标签系统（CRUD + 过滤）
- Rich text capture and display / 富文本捕获和显示

## [1.0.0] - 2025-11-01

- Initial release / 初始发布
