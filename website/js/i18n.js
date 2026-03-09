// i18n data
const translations = {
    'en': {
        'pageTitle': 'AlgerClipboard - The Smartest Clipboard Manager',
        'heroBadge': 'Open Source · Tauri 2 + React · v1.6.0',
        'heroSlogans': [
            ['Recall every digital', 'fragment.'],
            ['Make every copy', 'count.'],
            ['More than a clipboard,', 'your content hub.'],
            ['Copy once,', 'organize smarter.'],
            ['Capture ideas,', 'boost efficiency.'],
            ['Smarter clipboard,', 'faster workflow.'],
            ['Turn fragments into', 'reusable assets.'],
            ['From copy to organize,', 'in one step.']
        ],
        'heroSubtitle': 'An obsessively refined clipboard manager. Auto-capture text, images, and files with built-in AI summary, translation & multi-service Ask AI panel, code highlighting, rich text editing, and E2E encrypted cloud sync.',
        'downloadBtn': 'Download v1.6.0',
        'viewGithubBtn': 'View on GitHub',

        // Nav
        'navFeatures': 'Features',
        'navDownload': 'Download',
        'navChangelog': 'Changelog',

        // Core Features
        'featuresSectionTitle': 'Built for Power Users',
        'featuresSectionSubtitle': 'Everything you need to capture, organize, edit, and share clipboard content — powered by AI.',
        'featHistoryTitle': 'Smart Clipboard',
        'featHistoryDesc': 'Auto-capture text, images, rich text, and files. SHA-256 deduplication, instant search, type filtering, smart content classification, and 19-language code detection.',
        'featAiTitle': 'AI Integration',
        'featAiDesc': 'Multi-provider AI support (OpenAI, Claude, Gemini, DeepSeek, Ollama). One-click "Ask AI" sends clipboard content to any service with customizable presets. Auto-summary and AI translation.',
        'featEditorTitle': 'Rich Editing',
        'featEditorDesc': 'CodeMirror 6 code editor with 12+ language syntax highlighting, font size control, and toolbar. TipTap 2 WYSIWYG rich text editor. Draggable split view for simultaneous editing and preview.',
        'featMarkdownTitle': 'Markdown & Rendering',
        'featMarkdownDesc': 'GitHub Flavored Markdown with KaTeX math formulas, Shiki code block syntax highlighting, and Mermaid diagram rendering. Smart auto-detection of content type (code, markdown, rich text, plain text).',

        // More Features
        'moreFeaturesTitle': 'And Much More',
        'moreEncSyncTitle': 'Encrypted Cloud Sync',
        'moreEncSyncDesc': 'AES-256-GCM end-to-end encryption. Sync via WebDAV, Google Drive, or OneDrive. Settings sync across devices.',
        'moreTransTitle': 'Multi-Engine Translation',
        'moreTransDesc': 'Baidu, Youdao, Google engines plus AI translation mode. Auto-detect language with one-click copy.',
        'moreAskAiTitle': 'Ask AI Panel',
        'moreAskAiDesc': 'Browser-style multi-tab AI panel. ChatGPT, Claude, Gemini, DeepSeek, Kimi, Doubao and more. Per-service session isolation.',
        'moreTagTitle': 'Tags & Organization',
        'moreTagDesc': 'Full tag system with create, rename, delete. Pin important entries, mark favorites, filter by tags or content type.',
        'moreSourceTitle': 'Source Tracking',
        'moreSourceDesc': 'Shows source app name, icon, and URL for every clipboard entry. Click to open the original source link.',
        'moreTemplateTitle': 'Templates & OCR',
        'moreTemplateDesc': 'Reusable text templates with variable substitution. Built-in OCR to extract text from images (Windows).',
        'moreWindowTitle': 'Smart Windows',
        'moreWindowDesc': 'All windows remember their size. Smart positioning near text caret. Global hotkey, arrow key navigation, quick paste.',
        'moreThemeTitle': 'Personalization',
        'moreThemeDesc': 'Dark / Light / System theme. Custom fonts and UI scaling. i18n (Chinese & English). Auto-start on boot.',
        'morePrivacyTitle': 'Privacy First',
        'morePrivacyDesc': 'All data stored locally. No telemetry, no tracking. Optional encrypted sync — your data stays yours.',

        // Tech Stack
        'techTitle': 'Tech Stack',
        'techStyleLabel': 'Styling',
        'techCodeEditorLabel': 'Code Editor',
        'techRichEditorLabel': 'Rich Editor',
        'techDbLabel': 'Database',
        'techEncLabel': 'Encryption',

        // Downloads
        'dlSectionTitle': 'Get AlgerClipboard',
        'dlSectionDesc': 'Available for all major desktop platforms. 100% free and open source.',

        // Donate
        'donateTitle': 'Support the Project',
        'donateDesc': 'If you find AlgerClipboard useful, consider buying the developer a coffee.',
        'donateBtn': 'Donate',

        // Footer
        'footerText': 'AlgerClipboard is open source software licensed under GPL-3.0.',
        'footerDonate': 'Donate',

        // Changelog page
        'backToHome': 'Back to Home',
        'changelogTitle': 'Changelog',

        // SEO
        'seoTitle': 'AlgerClipboard - Smart Clipboard Manager with AI, Rich Editing & Cloud Sync',
        'seoDesc': 'Open-source clipboard manager built with Tauri 2 + React. AI integration, CodeMirror 6 code editor, TipTap 2 rich text, Markdown preview, encrypted cloud sync, and multi-engine translation.',
        'seoKeywords': 'clipboard manager, clipboard history, AI clipboard, code editor, markdown preview, open source clipboard, sync clipboard, encrypt clipboard, tauri clipboard, AlgerClipboard, productivity tool'
    },
    'zh-CN': {
        'pageTitle': 'AlgerClipboard - 新一代智能剪贴板管理器',
        'heroBadge': '开源免费 · Tauri 2 + React · v1.6.0',
        'heroSlogans': [
            ['为您记忆每一段', '数字碎片。'],
            ['让每一次复制，都', '更有价值。'],
            ['不止是剪贴板，', '更是内容中枢。'],
            ['复制即留存，', '整理更智能。'],
            ['记录灵感，', '连接效率。'],
            ['更聪明的剪贴板，', '更高效的工作流。'],
            ['把碎片内容，变成', '可复用资产。'],
            ['从复制到整理，', '一步到位。']
        ],
        'heroSubtitle': '极致打磨的智能剪贴板管理工具。自动记录文本、图片和文件历史，内置 AI 摘要翻译与多服务问答面板，搭配代码高亮、富文本编辑与 Markdown 渲染，端到端加密云同步。',
        'downloadBtn': '下载 v1.6.0',
        'viewGithubBtn': '访问 GitHub',

        // Nav
        'navFeatures': '功能',
        'navDownload': '下载',
        'navChangelog': '更新日志',

        // Core Features
        'featuresSectionTitle': '为高阶效率而生',
        'featuresSectionSubtitle': '捕获、整理、编辑、分享剪贴板内容 — 一切由 AI 驱动。',
        'featHistoryTitle': '智能剪贴板',
        'featHistoryDesc': '自动捕获文本、图片、富文本和文件。SHA-256 去重、即时搜索、类型筛选、智能内容分类、19 种编程语言检测。',
        'featAiTitle': 'AI 集成',
        'featAiDesc': '多服务商 AI 支持（OpenAI、Claude、Gemini、DeepSeek、Ollama）。一键「问 AI」将内容发送到任意 AI 服务，支持自定义预设。自动摘要和 AI 翻译。',
        'featEditorTitle': '富文本编辑',
        'featEditorDesc': 'CodeMirror 6 代码编辑器，支持 12+ 种语言语法高亮、字体大小调节和工具栏。TipTap 2 所见即所得编辑器。可拖拽分屏视图，编辑与预览同步。',
        'featMarkdownTitle': 'Markdown 渲染',
        'featMarkdownDesc': '支持 GFM 语法、KaTeX 数学公式、Shiki 代码块高亮和 Mermaid 流程图。智能自动检测内容类型（代码/Markdown/富文本/纯文本）。',

        // More Features
        'moreFeaturesTitle': '更多特性',
        'moreEncSyncTitle': '加密云同步',
        'moreEncSyncDesc': 'AES-256-GCM 端到端加密。支持 WebDAV、Google Drive、OneDrive 同步。跨设备设置同步。',
        'moreTransTitle': '多引擎翻译',
        'moreTransDesc': '百度、有道、Google 翻译引擎，以及 AI 翻译模式。语言自动检测，一键复制。',
        'moreAskAiTitle': 'Ask AI 面板',
        'moreAskAiDesc': '浏览器风格多标签页 AI 面板。ChatGPT、Claude、Gemini、DeepSeek、Kimi、豆包等。每个服务独立会话。',
        'moreTagTitle': '标签管理',
        'moreTagDesc': '完整标签系统，支持创建、重命名、删除。置顶重要条目、收藏、按标签或类型筛选。',
        'moreSourceTitle': '来源追踪',
        'moreSourceDesc': '显示每条记录的来源应用名称、图标和 URL。点击可打开原始来源链接。',
        'moreTemplateTitle': '模板与 OCR',
        'moreTemplateDesc': '支持变量替换的可复用文本模板。内置 OCR 从图片中提取文字（Windows）。',
        'moreWindowTitle': '智能窗口',
        'moreWindowDesc': '所有窗口记忆尺寸。智能定位到光标附近。全局快捷键、方向键导航、快速粘贴。',
        'moreThemeTitle': '个性化',
        'moreThemeDesc': '深色/浅色/跟随系统主题。自定义字体和界面缩放。中英双语。开机自启。',
        'morePrivacyTitle': '隐私优先',
        'morePrivacyDesc': '所有数据本地存储。无遥测、无追踪。可选加密同步 — 数据始终归你所有。',

        // Tech Stack
        'techTitle': '技术栈',
        'techStyleLabel': '样式',
        'techCodeEditorLabel': '代码编辑器',
        'techRichEditorLabel': '富文本编辑器',
        'techDbLabel': '数据库',
        'techEncLabel': '加密',

        // Downloads
        'dlSectionTitle': '获取 AlgerClipboard',
        'dlSectionDesc': '支持主流桌面操作系统。完全开源免费。',

        // Donate
        'donateTitle': '支持项目',
        'donateDesc': '如果你觉得 AlgerClipboard 好用，欢迎请开发者喝杯咖啡。',
        'donateBtn': '捐赠支持',

        // Footer
        'footerText': 'AlgerClipboard 遵循 GPL-3.0 开源协议。',
        'footerDonate': '捐赠',

        // Changelog page
        'backToHome': '返回首页',
        'changelogTitle': '更新日志',

        // SEO
        'seoTitle': 'AlgerClipboard - 集成 AI、富文本编辑与云同步的智能剪贴板',
        'seoDesc': '开源智能剪贴板管理工具，基于 Tauri 2 + React 构建。集成 AI 助手、CodeMirror 6 代码编辑器、TipTap 2 富文本、Markdown 预览、端到端加密云同步与多引擎翻译。',
        'seoKeywords': '剪贴板管理器, AI剪贴板, 代码编辑器, Markdown预览, 剪切板历史, 开源剪贴板, 跨端同步, 加密同步, Tauri, 翻译效率'
    }
};

class I18nManager {
    constructor() {
        this.currentLang = localStorage.getItem('ac_lang') || this.getDefaultLang();
        this.cacheDOM();
        this.bindEvents();
        this.render();
    }

    getDefaultLang() {
        const userLang = navigator.language || navigator.userLanguage;
        return userLang.startsWith('zh') ? 'zh-CN' : 'en';
    }

    cacheDOM() {
        this.elements = document.querySelectorAll('[data-i18n]');
        this.toggleBtn = document.getElementById('lang-toggle');
    }

    bindEvents() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => {
                this.currentLang = this.currentLang === 'zh-CN' ? 'en' : 'zh-CN';
                localStorage.setItem('ac_lang', this.currentLang);
                this.render();
            });
        }
    }

    render() {
        document.documentElement.lang = this.currentLang;

        if (this.toggleBtn) {
            this.toggleBtn.textContent = this.currentLang === 'zh-CN' ? 'EN' : '中';
        }

        const dict = translations[this.currentLang] || translations['en'];

        this.elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const targetAttr = el.getAttribute('data-i18n-target');
            if (dict[key]) {
                if (targetAttr) {
                    el.setAttribute(targetAttr, dict[key]);
                } else {
                    el.innerHTML = dict[key];
                }
            }
        });

        // Notify hero rotator if present
        if (window.heroRotator) {
            window.heroRotator.setLang(this.currentLang);
        }

        // Notify changelog renderer if present
        if (window.changelogRenderer) {
            window.changelogRenderer.setLang(this.currentLang);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.i18n = new I18nManager();
});
