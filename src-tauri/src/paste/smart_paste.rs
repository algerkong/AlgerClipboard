use crate::clipboard::entry::{ClipboardEntry, ContentType};
use crate::storage::blob::BlobStore;
use crate::storage::database::Database;
use serde::{Deserialize, Serialize};

pub const SETTING_KEY: &str = "smart_paste_config";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartPasteRule {
    pub id: String,
    pub name: String,
    /// Process name / bundle id pattern. `*` is a wildcard, `|` separates alternatives.
    pub app_pattern: String,
    /// Optional window title pattern.
    #[serde(default)]
    pub title_pattern: Option<String>,
    /// `*` | `PlainText` | `RichText` | `Image` | `FilePaths`
    pub source_type: String,
    /// `original` | `plaintext` | `markdown` | `html` | `file`
    pub target_format: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub is_builtin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartPasteConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub rules: Vec<SmartPasteRule>,
}

fn default_true() -> bool {
    true
}

impl Default for SmartPasteConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            rules: builtin_rules(),
        }
    }
}

impl SmartPasteConfig {
    pub fn load(db: &Database) -> Self {
        let mut config = db
            .get_setting(SETTING_KEY)
            .ok()
            .flatten()
            .and_then(|value| serde_json::from_str::<SmartPasteConfig>(&value).ok())
            .unwrap_or_default();

        // Keep built-in rules in sync with the app version while preserving the
        // user's enabled/disabled choices.
        for builtin in builtin_rules() {
            if let Some(existing) = config.rules.iter_mut().find(|rule| rule.id == builtin.id) {
                existing.is_builtin = true;
                if existing.name.trim().is_empty() {
                    existing.name = builtin.name;
                }
            } else {
                config.rules.push(builtin);
            }
        }

        config
    }

    pub fn save(&self, db: &Database) -> Result<(), String> {
        let json = serde_json::to_string(self).map_err(|e| e.to_string())?;
        db.set_setting(SETTING_KEY, &json)
    }
}

#[derive(Debug, Clone, Default)]
pub struct TargetAppInfo {
    pub process_name: String,
    pub window_title: String,
    pub window_class: String,
}

#[derive(Debug, Clone)]
pub enum ResolvedContent {
    Text(String),
    Html { html: String, plain: String },
    Files(Vec<String>),
}

fn builtin(
    id: &str,
    name: &str,
    app_pattern: &str,
    title_pattern: Option<&str>,
    source_type: &str,
    target_format: &str,
) -> SmartPasteRule {
    SmartPasteRule {
        id: id.to_string(),
        name: name.to_string(),
        app_pattern: app_pattern.to_string(),
        title_pattern: title_pattern.map(str::to_string),
        source_type: source_type.to_string(),
        target_format: target_format.to_string(),
        enabled: true,
        is_builtin: true,
    }
}

pub fn builtin_rules() -> Vec<SmartPasteRule> {
    vec![
        builtin(
            "builtin-richtext-markdown-typora",
            "Typora: Rich Text to Markdown",
            "Typora.exe|abnerworks.Typora",
            None,
            "RichText",
            "markdown",
        ),
        builtin(
            "builtin-richtext-markdown-obsidian",
            "Obsidian: Rich Text to Markdown",
            "Obsidian.exe|md.obsidian",
            None,
            "RichText",
            "markdown",
        ),
        builtin(
            "builtin-richtext-markdown-vscode",
            "VS Code: Rich Text to Markdown",
            "Code.exe|Code - Insiders.exe|com.microsoft.VSCode|com.microsoft.VSCodeInsiders",
            Some("*.md*"),
            "RichText",
            "markdown",
        ),
        builtin(
            "builtin-richtext-markdown-jetbrains",
            "JetBrains IDEs: Rich Text to Markdown",
            "idea64.exe|pycharm64.exe|webstorm64.exe|goland64.exe|clion64.exe|rider64.exe|phpstorm64.exe|rubymine64.exe|datagrip64.exe|idea.exe|pycharm.exe",
            Some("*.md*"),
            "RichText",
            "markdown",
        ),
        builtin(
            "builtin-image-to-file",
            "File Manager: Image to File",
            "explorer.exe|dopus.exe|TOTALCMD64.EXE|TOTALCMD.EXE|XYplorer.exe|Files.exe|Finder|org.gnome.Nautilus|org.gnome.Files|dolphin|thunar",
            None,
            "Image",
            "file",
        ),
        builtin(
            "builtin-text-html-word",
            "Word / WPS: Text to Rich Text",
            "WINWORD.EXE|wps.exe",
            None,
            "*",
            "html",
        ),
        builtin(
            "builtin-text-html-google-docs",
            "Google Docs: Text to Rich Text",
            "chrome.exe|msedge.exe|firefox.exe|brave.exe|Google Chrome|com.google.Chrome|org.mozilla.firefox",
            Some("*Google Docs*|*Google 文档*|*Google ドキュメント*"),
            "*",
            "html",
        ),
        builtin(
            "builtin-text-html-outlook",
            "Outlook: Text to Rich Text",
            "OUTLOOK.EXE|outlook.exe",
            None,
            "PlainText",
            "html",
        ),
    ]
}

/// Case-insensitive wildcard match. `*` matches any run of characters.
fn wildcard_match(pattern: &str, value: &str) -> bool {
    let pattern = pattern.trim().to_lowercase();
    let value = value.to_lowercase();

    let parts: Vec<&str> = pattern.split('*').collect();
    if parts.len() == 1 {
        return pattern == value;
    }

    let mut position = 0usize;
    for (index, part) in parts.iter().enumerate() {
        if part.is_empty() {
            continue;
        }

        if index == 0 {
            if !value.starts_with(part) {
                return false;
            }
            position = part.len();
        } else if index == parts.len() - 1 {
            return value[position..].ends_with(part);
        } else if let Some(found) = value[position..].find(part) {
            position += found + part.len();
        } else {
            return false;
        }
    }

    true
}

fn pattern_matches(pattern: &str, value: &str) -> bool {
    pattern
        .split('|')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .any(|part| wildcard_match(part, value))
}

fn rule_matches(rule: &SmartPasteRule, entry: &ClipboardEntry, target: &TargetAppInfo) -> bool {
    let source_matches =
        rule.source_type == "*" || rule.source_type == entry.content_type.as_str();
    if !source_matches {
        return false;
    }

    let app_matches = pattern_matches(&rule.app_pattern, &target.process_name)
        || (!target.window_class.is_empty()
            && pattern_matches(&rule.app_pattern, &target.window_class));
    if !app_matches {
        return false;
    }

    match rule.title_pattern.as_deref() {
        Some(title_pattern) if !title_pattern.trim().is_empty() => {
            pattern_matches(title_pattern, &target.window_title)
        }
        _ => true,
    }
}

pub fn resolve_rule<'a>(
    entry: &ClipboardEntry,
    target: &TargetAppInfo,
    config: &'a SmartPasteConfig,
) -> Option<&'a SmartPasteRule> {
    if !config.enabled {
        return None;
    }

    // Custom rules take precedence over built-in rules.
    config
        .rules
        .iter()
        .filter(|rule| !rule.is_builtin)
        .chain(config.rules.iter().filter(|rule| rule.is_builtin))
        .find(|rule| rule.enabled && rule_matches(rule, entry, target))
}

pub fn apply_rule(
    entry: &ClipboardEntry,
    rule: &SmartPasteRule,
    blob_store: &BlobStore,
) -> Option<ResolvedContent> {
    match rule.target_format.as_str() {
        "original" => None,
        "plaintext" => entry
            .text_content
            .as_ref()
            .filter(|text| !text.is_empty())
            .map(|text| ResolvedContent::Text(text.clone())),
        "markdown" => {
            let markdown = entry
                .html_content
                .as_ref()
                .filter(|html| !html.trim().is_empty())
                .map(|html| html2md::parse_html(html))
                .or_else(|| entry.text_content.clone())?;

            if markdown.trim().is_empty() {
                None
            } else {
                Some(ResolvedContent::Text(markdown))
            }
        }
        "html" => {
            let html = if let Some(html) = entry
                .html_content
                .as_ref()
                .filter(|html| !html.trim().is_empty())
            {
                html.clone()
            } else if let Some(text) = entry
                .text_content
                .as_ref()
                .filter(|text| !text.trim().is_empty())
            {
                text_to_html(text)
            } else {
                return None;
            };

            let plain = entry
                .text_content
                .clone()
                .filter(|text| !text.trim().is_empty())
                .unwrap_or_else(|| strip_html(&html));
            Some(ResolvedContent::Html { html, plain })
        }
        "file" => {
            if entry.content_type == ContentType::Image {
                image_to_temp_file(entry, blob_store)
                    .map(|path| ResolvedContent::Files(vec![path]))
            } else {
                None
            }
        }
        _ => None,
    }
}

fn text_to_html(text: &str) -> String {
    if looks_like_markdown(text) {
        let mut html = String::new();
        pulldown_cmark::html::push_html(&mut html, pulldown_cmark::Parser::new(text));
        html
    } else {
        format!(
            "<div style=\"white-space: pre-wrap\">{}</div>",
            escape_html(text)
        )
    }
}

fn looks_like_markdown(text: &str) -> bool {
    text.lines().any(|line| {
        let line = line.trim_start();
        line.starts_with("# ")
            || line.starts_with("## ")
            || line.starts_with("### ")
            || line.starts_with("- ")
            || line.starts_with("* ")
            || line.starts_with("> ")
            || line.starts_with("```")
            || line.contains("](http")
            || line.contains("**")
    })
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn strip_html(html: &str) -> String {
    let mut output = String::new();
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => output.push(ch),
            _ => {}
        }
    }
    output.trim().to_string()
}

fn image_to_temp_file(entry: &ClipboardEntry, blob_store: &BlobStore) -> Option<String> {
    let blob_path = entry.blob_path.as_ref()?;
    let source = blob_store.get_blob_path(blob_path);
    if !source.exists() {
        return None;
    }

    let extension = std::path::Path::new(blob_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("png");
    let directory = std::env::temp_dir().join("AlgerClipboard").join("paste");
    std::fs::create_dir_all(&directory).ok()?;
    let destination = directory.join(format!("{}.{}", entry.id, extension));
    std::fs::copy(&source, &destination).ok()?;
    Some(destination.to_string_lossy().to_string())
}

#[cfg(target_os = "windows")]
pub fn target_app_info_from_hwnd(hwnd: isize) -> TargetAppInfo {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetClassNameW, GetWindowTextW, GetWindowThreadProcessId,
    };

    if hwnd == 0 {
        return TargetAppInfo::default();
    }

    unsafe {
        let hwnd = hwnd as *mut std::ffi::c_void;
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);

        let mut process_name = String::new();
        if pid != 0 {
            let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if !process.is_null() {
                let mut buffer = [0u16; 1024];
                let mut length = buffer.len() as u32;
                if QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut length) != 0 {
                    let full_path = String::from_utf16_lossy(&buffer[..length as usize]);
                    process_name = std::path::Path::new(&full_path)
                        .file_name()
                        .map(|name| name.to_string_lossy().to_string())
                        .unwrap_or(full_path);
                }
                CloseHandle(process);
            }
        }

        let mut title_buffer = [0u16; 512];
        let title_length =
            GetWindowTextW(hwnd, title_buffer.as_mut_ptr(), title_buffer.len() as i32);
        let window_title = if title_length > 0 {
            String::from_utf16_lossy(&title_buffer[..title_length as usize])
        } else {
            String::new()
        };

        let mut class_buffer = [0u16; 256];
        let class_length =
            GetClassNameW(hwnd, class_buffer.as_mut_ptr(), class_buffer.len() as i32);
        let window_class = if class_length > 0 {
            String::from_utf16_lossy(&class_buffer[..class_length as usize])
        } else {
            String::new()
        };

        TargetAppInfo {
            process_name,
            window_title,
            window_class,
        }
    }
}

#[cfg(target_os = "macos")]
pub fn target_app_info_from_bundle_id(bundle_id: Option<String>) -> TargetAppInfo {
    TargetAppInfo {
        process_name: bundle_id.unwrap_or_default(),
        ..Default::default()
    }
}

#[cfg(target_os = "linux")]
pub fn target_app_info_from_window_id(window_id: Option<String>) -> TargetAppInfo {
    let Some(window_id) = window_id else {
        return TargetAppInfo::default();
    };

    let window_title = std::process::Command::new("xdotool")
        .args(["getwindowname", &window_id])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .unwrap_or_default();

    let process_name = std::process::Command::new("xdotool")
        .args(["getwindowpid", &window_id])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| {
            String::from_utf8_lossy(&output.stdout)
                .trim()
                .parse::<u32>()
                .ok()
        })
        .and_then(|pid| std::fs::read_to_string(format!("/proc/{}/comm", pid)).ok())
        .map(|name| name.trim().to_string())
        .unwrap_or_default();

    TargetAppInfo {
        process_name,
        window_title,
        ..Default::default()
    }
}
