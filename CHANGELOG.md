# Changelog

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
