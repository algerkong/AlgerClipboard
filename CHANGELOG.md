# Changelog

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
