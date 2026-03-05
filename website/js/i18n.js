// i18n data
const translations = {
    'en': {
        'pageTitle': 'AlgerClipboard - The Smartest Clipboard Manager',
        'heroBadge': 'Open Source · Tauri 2 + React',
        'heroTitleStart': 'Total Recall for Your',
        'heroTitleHighlight': 'Digital Life.',
        'heroSubtitle': 'An obsessively refined clipboard manager. Auto-capture text, images, and files with blazing fast search and E2E encrypted sync.',
        'downloadBtn': 'Download Release',
        'viewGithubBtn': 'View on GitHub',
        'featuresSectionTitle': 'Built for Power Users',
        'featHistoryTitle': 'Infinite Memory',
        'featHistoryDesc': 'Seamlessly logs text, file paths, and image data. Retrieve anything from weeks ago instantly via global hotkeys.',
        'featSyncTitle': 'Zero-Knowledge Sync',
        'featSyncDesc': 'AES-256-GCM encrypted persistence. Sync flawlessly across devices leveraging WebDAV, Google Drive, or OneDrive.',
        'featTransTitle': 'Inline Translation',
        'featTransDesc': 'Bridge language barriers on-the-fly. Built-in neural translation engines including Baidu, Youdao, and Google.',
        'featTempTitle': 'Dynamic Templates',
        'featTempDesc': 'Construct reusable snippet templates mapped to active variables. Boost your typing velocity dramatically.',
        'dlSectionTitle': 'Get AlgerClipboard',
        'dlSectionDesc': 'Available for all major desktop architectures. 100% free and open source.',
        'footerText': 'AlgerClipboard is open source software licensed under MIT.',
        'seoTitle': 'AlgerClipboard - The Smartest Clipboard Manager & Sync Tool',
        'seoDesc': 'An obsessively refined, open-source clipboard manager built with Tauri 2 and React. Features infinite memory, cross-device E2E encrypted sync, and inline translation.',
        'seoKeywords': 'clipboard manager, clipboard history, open source clipboard, sync clipboard, encrypt clipboard, tauri clipboard, AlgerClipboard, productivity tool, translation tool'
    },
    'zh-CN': {
        'pageTitle': 'AlgerClipboard - 新一代剪贴板管理利器',
        'heroBadge': '开源免费 · Tauri 2 + React 构建',
        'heroTitleStart': '为您记忆所有的',
        'heroTitleHighlight': '数字碎片。',
        'heroSubtitle': '极致打磨的剪贴板管理工具。自动记录文本、图片和文件历史，拥有极速检索与端到端加密同步功能。',
        'downloadBtn': '下载客户端',
        'viewGithubBtn': '访问 GitHub',
        'featuresSectionTitle': '为高阶效率而生',
        'featHistoryTitle': '无垠记忆',
        'featHistoryDesc': '无缝捕获所有的文本、图像与文件路径，凭借全局快捷键一击唤出数周前的完整记录。',
        'featSyncTitle': '零信任云同步',
        'featSyncDesc': '通过 AES-256-GCM 高强加密并持久化，利用 WebDAV、Google Drive 或 OneDrive 在不同设备间无阻同步。',
        'featTransTitle': '即时内联翻译',
        'featTransDesc': '飞速打破语言壁垒。深度集成百度翻译、有道翻译及谷歌神经机器引擎。',
        'featTempTitle': '动态文本模板',
        'featTempDesc': '构建支持变量动态替换的复用片段，呈指数级提升您的输入效率。',
        'dlSectionTitle': '获取 AlgerClipboard',
        'dlSectionDesc': '支持跨平台三大桌面主流操作系统。全量开源并且完全免费。',
        'footerText': 'AlgerClipboard 遵循 MIT 开源协议。',
        'seoTitle': 'AlgerClipboard - 新一代跨端同步智能剪贴板',
        'seoDesc': '开源、极速、安全的新一代剪贴板管理效率工具，基于 Tauri 2 和 React 构建。核心特性包含无限数据历史、端到端云同步以及内置神经翻译引擎。',
        'seoKeywords': '剪贴板管理器, 剪切板历史, 开源剪贴板, 跨多端同步, 剪贴板加密, Tauri 实用工具, 翻译效率, 文本模板'
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
        // Update document language
        document.documentElement.lang = this.currentLang;
        
        // Update language toggle button text
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
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.i18n = new I18nManager();
});
