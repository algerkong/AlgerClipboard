use crate::ai::classifier::classify_content;
use crate::ai::language::detect_language;
use crate::clipboard::entry::{ClipboardEntry, ContentType, SyncStatus};
use crate::clipboard::file_meta;
use crate::storage::blob::BlobStore;
use crate::storage::database::{compute_hash, Database};
use base64::Engine;
use image::DynamicImage;
use std::collections::{HashMap, HashSet};
use std::sync::RwLock;
#[cfg(target_os = "linux")]
use std::fs;
use std::io::Cursor;
#[cfg(any(target_os = "linux", target_os = "windows"))]
use std::path::Path;
#[cfg(target_os = "linux")]
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

/// Global incognito flag — when `true` the clipboard monitor skips recording.
static INCOGNITO: AtomicBool = AtomicBool::new(false);

pub fn set_incognito(enabled: bool) {
    INCOGNITO.store(enabled, Ordering::SeqCst);
}

pub fn is_incognito() -> bool {
    INCOGNITO.load(Ordering::SeqCst)
}

/// Global excluded apps set — apps in this set are skipped during recording.
static EXCLUDED_APPS: OnceLock<RwLock<HashSet<String>>> = OnceLock::new();

fn excluded_apps() -> &'static RwLock<HashSet<String>> {
    EXCLUDED_APPS.get_or_init(|| RwLock::new(HashSet::new()))
}

pub fn set_excluded_apps(apps: Vec<String>) {
    if let Ok(mut set) = excluded_apps().write() {
        set.clear();
        for app in apps {
            set.insert(app.to_lowercase());
        }
    }
}

fn is_app_excluded(source_app: Option<&str>) -> bool {
    let app = match source_app {
        Some(a) if !a.is_empty() => a,
        _ => return false,
    };
    if let Ok(set) = excluded_apps().read() {
        set.contains(&app.to_lowercase())
    } else {
        false
    }
}

/// Sensitive detection mode: 0 = disabled, 1 = mark mode, 2 = auto-delete mode
static SENSITIVE_MODE: AtomicU8 = AtomicU8::new(0);
static SENSITIVE_DISABLED_RULES: OnceLock<RwLock<Vec<String>>> = OnceLock::new();

fn sensitive_disabled_rules() -> &'static RwLock<Vec<String>> {
    SENSITIVE_DISABLED_RULES.get_or_init(|| RwLock::new(Vec::new()))
}

pub fn set_sensitive_mode(mode: u8) {
    SENSITIVE_MODE.store(mode, Ordering::SeqCst);
}

pub fn set_sensitive_disabled_rules(rules: Vec<String>) {
    if let Ok(mut r) = sensitive_disabled_rules().write() {
        *r = rules;
    }
}

#[derive(Debug, Clone, Default)]
struct ClipboardSource {
    app_name: Option<String>,
    label: Option<String>,
    url: Option<String>,
    icon: Option<String>,
}

impl ClipboardSource {
    fn display_name(&self) -> Option<String> {
        self.label.clone().or_else(|| self.app_name.clone())
    }
}

fn normalize_app_name(name: &str) -> Option<String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return None;
    }

    let normalized = match trimmed.to_ascii_lowercase().as_str() {
        "code.exe" | "code" => "VS Code",
        "chrome.exe" | "chrome" | "google chrome" => "Google Chrome",
        "google-chrome" | "google-chrome-stable" => "Google Chrome",
        "msedge.exe" | "msedge" | "microsoft edge" => "Microsoft Edge",
        "microsoft-edge" => "Microsoft Edge",
        "brave.exe" | "brave browser" => "Brave",
        "brave-browser" => "Brave",
        "firefox.exe" | "firefox" => "Firefox",
        "chromium" => "Chromium",
        "safari" => "Safari",
        "arc" => "Arc",
        "finder" => "Finder",
        "explorer.exe" | "explorer" => "File Explorer",
        "wezterm-gui.exe" | "wezterm-gui" | "wezterm" => "WezTerm",
        "iterm2" => "iTerm",
        "terminal" => "Terminal",
        _ => trimmed,
    };

    Some(normalized.to_string())
}

fn is_browser_app(app_name: &str) -> bool {
    matches!(
        app_name,
        "Safari" | "Google Chrome" | "Chromium" | "Microsoft Edge" | "Brave" | "Firefox" | "Arc"
    )
}

fn normalize_window_title(title: &str, app_name: Option<&str>) -> Option<String> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut candidates = Vec::new();
    if let Some(app_name) = app_name {
        candidates.push(app_name.to_string());
    }
    candidates.extend([
        "Google Chrome".to_string(),
        "Chromium".to_string(),
        "Microsoft Edge".to_string(),
        "Brave".to_string(),
        "Firefox".to_string(),
        "Safari".to_string(),
        "Arc".to_string(),
    ]);

    for candidate in candidates {
        for separator in [" - ", " — ", " | ", " · "] {
            let suffix = format!("{separator}{candidate}");
            if let Some(value) = trimmed.strip_suffix(&suffix) {
                let normalized = value.trim();
                if !normalized.is_empty() {
                    return Some(normalized.to_string());
                }
            }
        }
    }

    Some(trimmed.to_string())
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn run_command(program: &str, args: &[&str]) -> Option<String> {
    let output = std::process::Command::new(program)
        .args(args)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn extract_url_from_text(text: &str) -> Option<String> {
    let trimmed = text.trim();
    let parsed = reqwest::Url::parse(trimmed).ok()?;
    match parsed.scheme() {
        "http" | "https" => Some(parsed.into()),
        _ => None,
    }
}

fn image_data_url(mime: &str, bytes: &[u8]) -> String {
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    format!("data:{mime};base64,{encoded}")
}

#[cfg(target_os = "macos")]
fn png_data_url_from_base64(raw: &str, max_dim: u32) -> Option<String> {
    let png_bytes = base64::engine::general_purpose::STANDARD
        .decode(raw.trim())
        .ok()?;
    let image = image::load_from_memory(&png_bytes).ok()?;
    let resized = image.thumbnail(max_dim, max_dim);
    let png_bytes = encode_png(&resized).ok()?;
    Some(image_data_url("image/png", &png_bytes))
}

fn cached_data_url(
    cache: &'static Mutex<HashMap<String, String>>,
    key: &str,
    loader: impl FnOnce() -> Option<String>,
) -> Option<String> {
    if let Ok(cache) = cache.lock() {
        if let Some(value) = cache.get(key) {
            return Some(value.clone());
        }
    }

    let value = loader()?;
    if let Ok(mut cache) = cache.lock() {
        cache.insert(key.to_string(), value.clone());
    }
    Some(value)
}

#[cfg(target_os = "macos")]
fn macos_app_icon_cache() -> &'static Mutex<HashMap<String, String>> {
    static CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[cfg(target_os = "macos")]
fn get_frontmost_macos_app_icon(app_name: &str) -> Option<String> {
    cached_data_url(macos_app_icon_cache(), app_name, || {
        let raw_icon = run_command(
            "osascript",
            &[
                "-l",
                "JavaScript",
                "-e",
                "ObjC.import('AppKit'); ObjC.import('Foundation'); const app = $.NSWorkspace.sharedWorkspace.frontmostApplication; if (!app) { '' } else { const path = ObjC.unwrap(app.bundleURL.path); const icon = $.NSWorkspace.sharedWorkspace.iconForFile(path); const tiff = icon.TIFFRepresentation; if (!tiff) { '' } else { const rep = $.NSBitmapImageRep.imageRepWithData(tiff); const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $.NSDictionary.dictionary); png ? ObjC.unwrap(png.base64EncodedStringWithOptions(0)) : ''; } }",
            ],
        )?;
        png_data_url_from_base64(&raw_icon, 32)
    })
}

#[cfg(target_os = "macos")]
fn get_frontmost_macos_app_name() -> Option<String> {
    run_command(
        "osascript",
        &[
            "-l",
            "JavaScript",
            "-e",
            "ObjC.import('AppKit'); const app = $.NSWorkspace.sharedWorkspace.frontmostApplication; app ? ObjC.unwrap(app.localizedName) : '';",
        ],
    )
    .and_then(|name| normalize_app_name(&name))
}

#[cfg(target_os = "macos")]
fn get_macos_browser_source(app_name: &str) -> (Option<String>, Option<String>) {
    let script = match app_name {
        "Safari" => {
            r#"tell application "Safari"
if (count of windows) > 0 then
    set tabTitle to name of current tab of front window
    set tabUrl to URL of current tab of front window
    return tabTitle & linefeed & tabUrl
end if
end tell"#
        }
        "Google Chrome" => {
            r#"tell application "Google Chrome"
if (count of windows) > 0 then
    set tabTitle to title of active tab of front window
    set tabUrl to URL of active tab of front window
    return tabTitle & linefeed & tabUrl
end if
end tell"#
        }
        "Chromium" => {
            r#"tell application "Chromium"
if (count of windows) > 0 then
    set tabTitle to title of active tab of front window
    set tabUrl to URL of active tab of front window
    return tabTitle & linefeed & tabUrl
end if
end tell"#
        }
        "Microsoft Edge" => {
            r#"tell application "Microsoft Edge"
if (count of windows) > 0 then
    set tabTitle to title of active tab of front window
    set tabUrl to URL of active tab of front window
    return tabTitle & linefeed & tabUrl
end if
end tell"#
        }
        "Brave" => {
            r#"tell application "Brave Browser"
if (count of windows) > 0 then
    set tabTitle to title of active tab of front window
    set tabUrl to URL of active tab of front window
    return tabTitle & linefeed & tabUrl
end if
end tell"#
        }
        "Arc" => {
            r#"tell application "Arc"
if (count of windows) > 0 then
    set tabTitle to title of active tab of front window
    set tabUrl to URL of active tab of front window
    return tabTitle & linefeed & tabUrl
end if
end tell"#
        }
        _ => return (None, None),
    };

    let Some(output) = run_command("osascript", &["-e", script]) else {
        return (None, None);
    };
    let mut lines = output.lines();
    let title = lines
        .next()
        .and_then(|value| normalize_window_title(value, Some(app_name)));
    let url = lines.next().and_then(extract_url_from_text);
    (title, url)
}

#[cfg(target_os = "macos")]
fn get_clipboard_source() -> ClipboardSource {
    let app_name = get_frontmost_macos_app_name();
    let icon = app_name.as_deref().and_then(get_frontmost_macos_app_icon);
    let (label, url) = app_name
        .as_deref()
        .filter(|name| is_browser_app(name))
        .map(get_macos_browser_source)
        .unwrap_or((None, None));

    ClipboardSource {
        app_name,
        label,
        url,
        icon,
    }
}

#[cfg(target_os = "windows")]
fn windows_app_icon_cache() -> &'static Mutex<HashMap<String, String>> {
    static CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[cfg(target_os = "windows")]
fn get_windows_app_icon(exe_path: &str) -> Option<String> {
    use image::RgbaImage;
    use std::mem::{size_of, zeroed};
    use windows_sys::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, RGBQUAD,
    };
    use windows_sys::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
    use windows_sys::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, ICONINFO};

    cached_data_url(windows_app_icon_cache(), exe_path, || unsafe {
        let wide_path: Vec<u16> = exe_path.encode_utf16().chain(std::iter::once(0)).collect();
        let mut info: SHFILEINFOW = zeroed();
        let result = SHGetFileInfoW(
            wide_path.as_ptr(),
            0,
            &mut info,
            size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        );
        if result == 0 || info.hIcon.is_null() {
            return None;
        }

        let hicon = info.hIcon;
        let mut icon_info: ICONINFO = zeroed();
        if GetIconInfo(hicon, &mut icon_info) == 0 {
            DestroyIcon(hicon);
            return None;
        }

        let bitmap_handle = if !icon_info.hbmColor.is_null() {
            icon_info.hbmColor
        } else {
            icon_info.hbmMask
        };

        let mut bitmap: BITMAP = zeroed();
        if GetObjectW(
            bitmap_handle as _,
            size_of::<BITMAP>() as i32,
            &mut bitmap as *mut _ as *mut _,
        ) == 0
        {
            if !icon_info.hbmColor.is_null() {
                DeleteObject(icon_info.hbmColor as _);
            }
            if !icon_info.hbmMask.is_null() {
                DeleteObject(icon_info.hbmMask as _);
            }
            DestroyIcon(hicon);
            return None;
        }

        let width = bitmap.bmWidth.max(1) as u32;
        let height = bitmap.bmHeight.max(1) as u32;
        let mut pixels = vec![0u8; (width * height * 4) as usize];
        let mut bitmap_info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width as i32,
                biHeight: -(height as i32),
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD {
                rgbBlue: 0,
                rgbGreen: 0,
                rgbRed: 0,
                rgbReserved: 0,
            }],
        };

        let dc = CreateCompatibleDC(std::ptr::null_mut());
        if dc.is_null() {
            if !icon_info.hbmColor.is_null() {
                DeleteObject(icon_info.hbmColor as _);
            }
            if !icon_info.hbmMask.is_null() {
                DeleteObject(icon_info.hbmMask as _);
            }
            DestroyIcon(hicon);
            return None;
        }

        let rows = GetDIBits(
            dc,
            bitmap_handle,
            0,
            height,
            pixels.as_mut_ptr() as *mut _,
            &mut bitmap_info,
            DIB_RGB_COLORS,
        );

        DeleteDC(dc);
        if !icon_info.hbmColor.is_null() {
            DeleteObject(icon_info.hbmColor as _);
        }
        if !icon_info.hbmMask.is_null() {
            DeleteObject(icon_info.hbmMask as _);
        }
        DestroyIcon(hicon);

        if rows == 0 {
            return None;
        }

        for chunk in pixels.chunks_exact_mut(4) {
            chunk.swap(0, 2);
        }

        let image = RgbaImage::from_raw(width, height, pixels)?;
        let resized = DynamicImage::ImageRgba8(image).thumbnail(32, 32);
        let png_bytes = encode_png(&resized).ok()?;
        Some(image_data_url("image/png", &png_bytes))
    })
}

#[cfg(target_os = "windows")]
fn get_clipboard_source() -> ClipboardSource {
    use windows_sys::Win32::Foundation::{CloseHandle, HWND, MAX_PATH};
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
    };

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return ClipboardSource::default();
        }

        let mut process_id = 0u32;
        GetWindowThreadProcessId(hwnd as HWND, &mut process_id);
        if process_id == 0 {
            return ClipboardSource::default();
        }

        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id);
        if process.is_null() {
            return ClipboardSource::default();
        }

        let mut buffer = vec![0u16; MAX_PATH as usize];
        let mut len = buffer.len() as u32;
        let ok = QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut len);
        CloseHandle(process);
        if ok == 0 || len == 0 {
            return ClipboardSource::default();
        }

        let exe_path = String::from_utf16_lossy(&buffer[..len as usize]);
        let icon = get_windows_app_icon(&exe_path);
        let app_name = Path::new(&exe_path)
            .file_name()
            .and_then(|name| name.to_str())
            .and_then(normalize_app_name);

        let title_len = GetWindowTextLengthW(hwnd as HWND);
        let window_title = if title_len > 0 {
            let mut title = vec![0u16; title_len as usize + 1];
            let written = GetWindowTextW(hwnd as HWND, title.as_mut_ptr(), title.len() as i32);
            if written > 0 {
                Some(String::from_utf16_lossy(&title[..written as usize]))
            } else {
                None
            }
        } else {
            None
        };

        let label = match (app_name.as_deref(), window_title.as_deref()) {
            (Some(app), Some(title)) if is_browser_app(app) => {
                normalize_window_title(title, Some(app))
            }
            _ => None,
        };

        ClipboardSource {
            app_name,
            label,
            url: get_clipboard_source_url(),
            icon,
        }
    }
}

#[cfg(target_os = "linux")]
#[derive(Clone, Debug)]
struct LinuxDesktopEntry {
    desktop_id: String,
    name: Option<String>,
    icon: Option<String>,
    startup_wm_class: Option<String>,
    exec: Option<String>,
}

#[cfg(target_os = "linux")]
fn linux_app_icon_cache() -> &'static Mutex<HashMap<String, String>> {
    static CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[cfg(target_os = "linux")]
fn linux_desktop_entries() -> &'static Vec<LinuxDesktopEntry> {
    static ENTRIES: OnceLock<Vec<LinuxDesktopEntry>> = OnceLock::new();
    ENTRIES.get_or_init(load_linux_desktop_entries)
}

#[cfg(target_os = "linux")]
fn load_linux_desktop_entries() -> Vec<LinuxDesktopEntry> {
    let mut files = Vec::new();
    for dir in linux_desktop_entry_dirs() {
        collect_desktop_files(&dir, &mut files);
    }

    files
        .into_iter()
        .filter_map(|path| parse_linux_desktop_entry(&path))
        .collect()
}

#[cfg(target_os = "linux")]
fn linux_desktop_entry_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(home) = std::env::var_os("HOME") {
        let home = PathBuf::from(home);
        dirs.push(home.join(".local/share/applications"));
        dirs.push(home.join(".local/share/flatpak/exports/share/applications"));
    }

    let data_home = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share")));
    if let Some(data_home) = data_home {
        dirs.push(data_home.join("applications"));
    }

    let data_dirs = std::env::var("XDG_DATA_DIRS")
        .unwrap_or_else(|_| "/usr/local/share:/usr/share".to_string());
    dirs.extend(
        data_dirs
            .split(':')
            .filter(|value| !value.is_empty())
            .map(|value| PathBuf::from(value).join("applications")),
    );
    dirs.push(PathBuf::from("/var/lib/flatpak/exports/share/applications"));

    dirs
}

#[cfg(target_os = "linux")]
fn collect_desktop_files(dir: &Path, output: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_desktop_files(&path, output);
        } else if path.extension().and_then(|ext| ext.to_str()) == Some("desktop") {
            output.push(path);
        }
    }
}

#[cfg(target_os = "linux")]
fn parse_linux_desktop_entry(path: &Path) -> Option<LinuxDesktopEntry> {
    let content = fs::read_to_string(path).ok()?;
    let mut in_desktop_entry = false;
    let mut entry_type = None;
    let mut name = None;
    let mut icon = None;
    let mut startup_wm_class = None;
    let mut exec = None;
    let mut hidden = false;

    for raw_line in content.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            in_desktop_entry = line == "[Desktop Entry]";
            continue;
        }
        if !in_desktop_entry {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let value = value.trim();
        match key {
            "Type" => entry_type = Some(value.to_string()),
            "Name" if name.is_none() => name = Some(value.to_string()),
            "Icon" => icon = Some(value.to_string()),
            "StartupWMClass" => startup_wm_class = Some(value.to_string()),
            "Exec" => exec = Some(value.to_string()),
            "Hidden" | "NoDisplay" if value.eq_ignore_ascii_case("true") => hidden = true,
            _ => {}
        }
    }

    if hidden {
        return None;
    }

    if !matches!(entry_type.as_deref(), None | Some("Application")) {
        return None;
    }

    Some(LinuxDesktopEntry {
        desktop_id: path.file_stem()?.to_string_lossy().to_string(),
        name,
        icon,
        startup_wm_class,
        exec,
    })
}

#[cfg(target_os = "linux")]
fn normalize_lookup_key(value: &str) -> Option<String> {
    let normalized: String = value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect();
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

#[cfg(target_os = "linux")]
fn linux_exec_key(exec: &str) -> Option<String> {
    let command = exec
        .split_whitespace()
        .next()
        .unwrap_or_default()
        .trim_matches('"');
    let command = command
        .trim_end_matches(|ch: char| matches!(ch, '%' | 'U' | 'u' | 'F' | 'f' | 'i' | 'c' | 'k'));
    let stem = Path::new(command)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(command);
    normalize_lookup_key(stem)
}

#[cfg(target_os = "linux")]
fn desktop_match_score(
    entry: &LinuxDesktopEntry,
    class_key: Option<&str>,
    app_key: Option<&str>,
    exe_key: Option<&str>,
) -> i32 {
    let mut candidates = Vec::new();
    if let Some(value) = normalize_lookup_key(&entry.desktop_id) {
        candidates.push(value);
    }
    if let Some(value) = entry.name.as_deref().and_then(normalize_lookup_key) {
        candidates.push(value);
    }
    if let Some(value) = entry
        .startup_wm_class
        .as_deref()
        .and_then(normalize_lookup_key)
    {
        candidates.push(value);
    }
    if let Some(value) = entry.exec.as_deref().and_then(linux_exec_key) {
        candidates.push(value);
    }

    let mut best = 0;
    for (needle, weight) in [(class_key, 120), (exe_key, 110), (app_key, 100)] {
        let Some(needle) = needle else {
            continue;
        };
        for candidate in &candidates {
            if candidate == needle {
                best = best.max(weight);
            } else if candidate.contains(needle) || needle.contains(candidate) {
                best = best.max(weight - 20);
            }
        }
    }

    best
}

#[cfg(target_os = "linux")]
fn linux_icon_search_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(home) = std::env::var_os("HOME") {
        let home = PathBuf::from(home);
        roots.push(home.join(".icons"));
        roots.push(home.join(".local/share/icons"));
        roots.push(home.join(".local/share/pixmaps"));
    }

    let data_dirs = std::env::var("XDG_DATA_DIRS")
        .unwrap_or_else(|_| "/usr/local/share:/usr/share".to_string());
    roots.extend(
        data_dirs
            .split(':')
            .filter(|value| !value.is_empty())
            .flat_map(|value| {
                let root = PathBuf::from(value);
                [root.join("icons"), root.join("pixmaps")]
            }),
    );

    roots.push(PathBuf::from("/usr/share/pixmaps"));
    roots.push(PathBuf::from("/var/lib/flatpak/exports/share/icons"));
    roots
}

#[cfg(target_os = "linux")]
fn find_icon_recursively(dir: &Path, icon_name: &str) -> Option<PathBuf> {
    let Ok(entries) = fs::read_dir(dir) else {
        return None;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_icon_recursively(&path, icon_name) {
                return Some(found);
            }
            continue;
        }

        let Some(stem) = path.file_stem().and_then(|value| value.to_str()) else {
            continue;
        };
        if stem != icon_name {
            continue;
        }

        match path.extension().and_then(|value| value.to_str()) {
            Some("png") | Some("svg") => return Some(path),
            _ => {}
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn resolve_linux_icon_data_url(icon: &str) -> Option<String> {
    let path = if Path::new(icon).is_absolute() {
        PathBuf::from(icon)
    } else {
        linux_icon_search_roots()
            .into_iter()
            .find_map(|root| find_icon_recursively(&root, icon))?
    };

    let bytes = fs::read(&path).ok()?;
    match path.extension().and_then(|value| value.to_str()) {
        Some("png") => Some(image_data_url("image/png", &bytes)),
        Some("svg") => Some(image_data_url("image/svg+xml", &bytes)),
        _ => None,
    }
}

#[cfg(target_os = "linux")]
fn get_linux_app_icon(
    class_name: Option<&str>,
    app_name: Option<&str>,
    exe_path: Option<&str>,
) -> Option<String> {
    let class_key = class_name.and_then(normalize_lookup_key);
    let app_key = app_name.and_then(normalize_lookup_key);
    let exe_key = exe_path
        .and_then(|value| Path::new(value).file_stem().and_then(|stem| stem.to_str()))
        .and_then(normalize_lookup_key);
    let cache_key = format!(
        "{}|{}|{}",
        class_key.as_deref().unwrap_or_default(),
        app_key.as_deref().unwrap_or_default(),
        exe_key.as_deref().unwrap_or_default()
    );

    cached_data_url(linux_app_icon_cache(), &cache_key, || {
        let (_, entry) = linux_desktop_entries()
            .iter()
            .filter_map(|entry| {
                let score = desktop_match_score(
                    entry,
                    class_key.as_deref(),
                    app_key.as_deref(),
                    exe_key.as_deref(),
                );
                (score > 0)
                    .then_some((score, entry))
                    .filter(|(_, entry)| entry.icon.is_some())
            })
            .max_by_key(|(score, _)| *score)?;
        resolve_linux_icon_data_url(entry.icon.as_deref()?)
    })
}

#[cfg(target_os = "linux")]
fn get_clipboard_source() -> ClipboardSource {
    let window_id = run_command("xdotool", &["getactivewindow"]);
    let Some(window_id) = window_id else {
        return ClipboardSource::default();
    };

    let class_name = run_command("xdotool", &["getwindowclassname", &window_id]);
    let window_title = run_command("xdotool", &["getwindowname", &window_id]);
    let exe_path = run_command("xdotool", &["getwindowpid", &window_id])
        .and_then(|pid| fs::read_link(format!("/proc/{pid}/exe")).ok())
        .map(|path| path.to_string_lossy().to_string());
    let app_name = class_name.as_deref().and_then(normalize_app_name);
    let icon = get_linux_app_icon(
        class_name.as_deref(),
        app_name.as_deref(),
        exe_path.as_deref(),
    );

    let label = match (app_name.as_deref(), window_title.as_deref()) {
        (Some(app), Some(title)) if is_browser_app(app) => normalize_window_title(title, Some(app)),
        _ => None,
    };

    ClipboardSource {
        app_name,
        label,
        url: get_clipboard_source_url(),
        icon,
    }
}

#[cfg(target_os = "windows")]
fn get_clipboard_png() -> Option<Vec<u8>> {
    use windows_sys::Win32::Foundation::{FALSE, HWND};
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, GetClipboardData, OpenClipboard, RegisterClipboardFormatW,
    };
    use windows_sys::Win32::System::Memory::{GlobalLock, GlobalSize, GlobalUnlock};

    unsafe {
        let format_name: Vec<u16> = "PNG\0".encode_utf16().collect();
        let cf_png = RegisterClipboardFormatW(format_name.as_ptr());
        if cf_png == 0 {
            return None;
        }

        if OpenClipboard(0 as HWND) == FALSE {
            return None;
        }

        let handle = GetClipboardData(cf_png);
        if handle.is_null() {
            CloseClipboard();
            return None;
        }

        let ptr = GlobalLock(handle);
        if ptr.is_null() {
            CloseClipboard();
            return None;
        }

        let size = GlobalSize(handle);
        if size == 0 {
            GlobalUnlock(handle);
            CloseClipboard();
            return None;
        }

        let data = std::slice::from_raw_parts(ptr as *const u8, size).to_vec();

        GlobalUnlock(handle);
        CloseClipboard();

        if data.is_empty() {
            None
        } else {
            Some(data)
        }
    }
}

#[cfg(target_os = "windows")]
fn get_clipboard_dib(format: u32) -> Option<Vec<u8>> {
    use windows_sys::Win32::Foundation::{FALSE, HWND};
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, GetClipboardData, OpenClipboard,
    };
    use windows_sys::Win32::System::Memory::{GlobalLock, GlobalSize, GlobalUnlock};

    unsafe {
        if OpenClipboard(0 as HWND) == FALSE {
            return None;
        }

        let handle = GetClipboardData(format);
        if handle.is_null() {
            CloseClipboard();
            return None;
        }

        let ptr = GlobalLock(handle);
        if ptr.is_null() {
            CloseClipboard();
            return None;
        }

        let size = GlobalSize(handle);
        if size == 0 {
            GlobalUnlock(handle);
            CloseClipboard();
            return None;
        }

        let dib = std::slice::from_raw_parts(ptr as *const u8, size).to_vec();

        GlobalUnlock(handle);
        CloseClipboard();

        if dib.is_empty() {
            None
        } else {
            Some(dib)
        }
    }
}

#[cfg(target_os = "windows")]
fn dib_to_image(dib: &[u8]) -> Option<DynamicImage> {
    if dib.len() < 40 {
        return None;
    }

    let header_size = u32::from_le_bytes(dib[0..4].try_into().ok()?) as usize;
    if header_size < 40 || dib.len() < header_size {
        return None;
    }

    let width = i32::from_le_bytes(dib[4..8].try_into().ok()?);
    let height = i32::from_le_bytes(dib[8..12].try_into().ok()?);
    let bit_count = u16::from_le_bytes(dib[14..16].try_into().ok()?);
    let compression = u32::from_le_bytes(dib[16..20].try_into().ok()?);
    let colors_used = u32::from_le_bytes(dib[32..36].try_into().ok()?);

    if width <= 0 || height == 0 {
        return None;
    }

    let width_u32 = width as u32;
    let height_abs = height.unsigned_abs();
    let top_down = height < 0;

    let masks_size = if header_size == 40 && compression == 3 {
        match bit_count {
            16 | 32 => 12,
            _ => 0,
        }
    } else {
        0
    };

    let palette_size = if bit_count <= 8 {
        let colors = if colors_used != 0 {
            colors_used
        } else {
            1u32 << bit_count
        };
        colors as usize * 4
    } else {
        0
    };

    let pixel_offset = header_size
        .checked_add(masks_size)?
        .checked_add(palette_size)?;
    if pixel_offset >= dib.len() {
        return None;
    }

    let mut bmp = Vec::with_capacity(dib.len() + 14);
    let file_size = (dib.len() + 14) as u32;
    bmp.extend_from_slice(b"BM");
    bmp.extend_from_slice(&file_size.to_le_bytes());
    bmp.extend_from_slice(&[0; 4]);
    bmp.extend_from_slice(&((pixel_offset + 14) as u32).to_le_bytes());
    bmp.extend_from_slice(dib);

    let image = image::load_from_memory_with_format(&bmp, image::ImageFormat::Bmp).ok()?;

    if image.width() != width_u32 || image.height() != height_abs || top_down {
        return Some(image);
    }

    Some(image)
}

#[cfg(target_os = "windows")]
fn get_clipboard_windows_image() -> Option<DynamicImage> {
    const CF_DIB: u32 = 8;
    const CF_DIBV5: u32 = 17;

    if let Some(png_bytes) = get_clipboard_png() {
        if let Ok(image) = image::load_from_memory(&png_bytes) {
            return Some(image);
        }
    }

    for format in [CF_DIBV5, CF_DIB] {
        if let Some(dib) = get_clipboard_dib(format) {
            if let Some(image) = dib_to_image(&dib) {
                return Some(image);
            }
        }
    }

    None
}

#[cfg(target_os = "macos")]
fn get_clipboard_macos_image() -> Option<DynamicImage> {
    let script = r#"
use framework "AppKit"
use framework "Foundation"
set pb to current application's NSPasteboard's generalPasteboard()
set imageData to pb's dataForType:"public.png"
if imageData is missing value then
    set imageData to pb's dataForType:"public.tiff"
end if
if imageData is missing value then
    return ""
end if
return (imageData's base64EncodedStringWithOptions:0) as text
"#;

    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let encoded = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if encoded.is_empty() {
        return None;
    }

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .ok()?;
    image::load_from_memory(&bytes).ok()
}

#[cfg(target_os = "linux")]
fn get_clipboard_linux_image() -> Option<DynamicImage> {
    for command in [
        (
            "xclip",
            vec!["-selection", "clipboard", "-t", "image/png", "-o"],
        ),
        ("wl-paste", vec!["-t", "image/png"]),
    ] {
        if let Ok(output) = std::process::Command::new(command.0)
            .args(command.1)
            .output()
        {
            if output.status.success() && !output.stdout.is_empty() {
                if let Ok(image) = image::load_from_memory(&output.stdout) {
                    return Some(image);
                }
            }
        }
    }

    None
}

fn get_clipboard_image() -> Option<DynamicImage> {
    let mut clipboard = arboard::Clipboard::new().ok()?;

    if let Ok(img_data) = clipboard.get_image() {
        let rgba = image::RgbaImage::from_raw(
            img_data.width as u32,
            img_data.height as u32,
            img_data.bytes.into_owned(),
        )?;
        return Some(DynamicImage::ImageRgba8(rgba));
    }

    #[cfg(target_os = "windows")]
    {
        return get_clipboard_windows_image();
    }

    #[cfg(target_os = "macos")]
    {
        return get_clipboard_macos_image();
    }

    #[cfg(target_os = "linux")]
    {
        return get_clipboard_linux_image();
    }

    #[allow(unreachable_code)]
    None
}

fn encode_png(image: &DynamicImage) -> Result<Vec<u8>, image::ImageError> {
    let mut png_bytes = Vec::new();
    image.write_to(&mut Cursor::new(&mut png_bytes), image::ImageFormat::Png)?;
    Ok(png_bytes)
}

pub struct ClipboardMonitor {
    running: Arc<AtomicBool>,
    device_id: String,
}

/// Read HTML content from Windows clipboard (CF_HTML format)
#[cfg(target_os = "windows")]
fn get_windows_clipboard_cf_html() -> Option<String> {
    use windows_sys::Win32::Foundation::{FALSE, HWND};
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, GetClipboardData, OpenClipboard, RegisterClipboardFormatW,
    };
    use windows_sys::Win32::System::Memory::{GlobalLock, GlobalSize, GlobalUnlock};

    unsafe {
        // Register CF_HTML format
        let format_name: Vec<u16> = "HTML Format\0".encode_utf16().collect();
        let cf_html = RegisterClipboardFormatW(format_name.as_ptr());
        if cf_html == 0 {
            return None;
        }

        if OpenClipboard(0 as HWND) == FALSE {
            return None;
        }

        let handle = GetClipboardData(cf_html);
        if handle.is_null() {
            CloseClipboard();
            return None;
        }

        let ptr = GlobalLock(handle);
        if ptr.is_null() {
            CloseClipboard();
            return None;
        }

        let size = GlobalSize(handle);
        if size == 0 {
            GlobalUnlock(handle);
            CloseClipboard();
            return None;
        }

        let data = std::slice::from_raw_parts(ptr as *const u8, size);
        let raw = String::from_utf8_lossy(data).to_string();

        GlobalUnlock(handle);
        CloseClipboard();

        Some(raw)
    }
}

#[cfg(target_os = "macos")]
fn get_clipboard_html() -> Option<String> {
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(
            r#"
use framework "AppKit"
set pb to current application's NSPasteboard's generalPasteboard()
set htmlData to pb's dataForType:"public.html"
if htmlData is not missing value then
    set htmlStr to (current application's NSString's alloc()'s initWithData:htmlData encoding:4)
    return htmlStr as text
end if
"#,
        )
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let html = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if html.is_empty() {
        None
    } else {
        Some(html)
    }
}

#[cfg(target_os = "linux")]
fn get_clipboard_html() -> Option<String> {
    // Try X11 first (xclip)
    if let Ok(output) = std::process::Command::new("xclip")
        .args(["-selection", "clipboard", "-t", "text/html", "-o"])
        .output()
    {
        if output.status.success() {
            let html = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !html.is_empty() {
                return Some(html);
            }
        }
    }
    // Wayland fallback (wl-paste)
    if let Ok(output) = std::process::Command::new("wl-paste")
        .args(["-t", "text/html"])
        .output()
    {
        if output.status.success() {
            let html = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !html.is_empty() {
                return Some(html);
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn parse_cf_html_fragment(raw: &str) -> Option<String> {
    let start_marker = "StartFragment:";
    let end_marker = "EndFragment:";

    let start_offset = raw.find(start_marker).and_then(|pos| {
        let after = &raw[pos + start_marker.len()..];
        after
            .trim_start()
            .split_whitespace()
            .next()?
            .parse::<usize>()
            .ok()
    });

    let end_offset = raw.find(end_marker).and_then(|pos| {
        let after = &raw[pos + end_marker.len()..];
        after
            .trim_start()
            .split_whitespace()
            .next()?
            .parse::<usize>()
            .ok()
    });

    match (start_offset, end_offset) {
        (Some(start), Some(end)) if start < end && end <= raw.len() => {
            let fragment = raw[start..end].trim();
            if fragment.is_empty() {
                None
            } else {
                Some(fragment.to_string())
            }
        }
        _ => None,
    }
}

#[cfg(target_os = "windows")]
fn parse_cf_html_source_url(raw: &str) -> Option<String> {
    raw.lines()
        .find_map(|line| line.strip_prefix("SourceURL:"))
        .and_then(extract_url_from_text)
}

#[cfg(target_os = "windows")]
fn get_clipboard_html() -> Option<String> {
    get_windows_clipboard_cf_html().and_then(|raw| parse_cf_html_fragment(&raw))
}

#[cfg(target_os = "windows")]
fn get_clipboard_source_url() -> Option<String> {
    get_windows_clipboard_cf_html().and_then(|raw| parse_cf_html_source_url(&raw))
}

#[cfg(target_os = "macos")]
fn get_clipboard_source_url() -> Option<String> {
    None
}

#[cfg(target_os = "linux")]
fn get_clipboard_source_url() -> Option<String> {
    None
}

/// Read copied file paths from Windows clipboard (CF_HDROP format)
#[cfg(target_os = "windows")]
fn get_clipboard_file_paths() -> Option<Vec<String>> {
    use windows_sys::Win32::Foundation::{FALSE, HWND};
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, GetClipboardData, OpenClipboard,
    };
    use windows_sys::Win32::System::Memory::GlobalLock;
    use windows_sys::Win32::System::Memory::GlobalUnlock;
    use windows_sys::Win32::System::Ole::CF_HDROP;
    use windows_sys::Win32::UI::Shell::DragQueryFileW;

    unsafe {
        if OpenClipboard(0 as HWND) == FALSE {
            return None;
        }

        let handle = GetClipboardData(CF_HDROP as u32);
        if handle.is_null() {
            CloseClipboard();
            return None;
        }

        let hdrop = GlobalLock(handle);
        if hdrop.is_null() {
            CloseClipboard();
            return None;
        }

        let count = DragQueryFileW(hdrop as _, u32::MAX, std::ptr::null_mut(), 0);
        if count == 0 {
            GlobalUnlock(handle);
            CloseClipboard();
            return None;
        }

        let mut paths = Vec::new();
        for i in 0..count {
            let len = DragQueryFileW(hdrop as _, i, std::ptr::null_mut(), 0);
            if len == 0 {
                continue;
            }
            let mut buf: Vec<u16> = vec![0u16; (len + 1) as usize];
            DragQueryFileW(hdrop as _, i, buf.as_mut_ptr(), len + 1);
            let path = String::from_utf16_lossy(&buf[..len as usize]);
            paths.push(path);
        }

        GlobalUnlock(handle);
        CloseClipboard();

        if paths.is_empty() {
            None
        } else {
            Some(paths)
        }
    }
}

#[cfg(target_os = "macos")]
fn get_clipboard_file_paths() -> Option<Vec<String>> {
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(
            r#"
use framework "AppKit"
set pb to current application's NSPasteboard's generalPasteboard()
set types to pb's types() as list
if types contains "NSFilenamesPboardType" or types contains "public.file-url" then
    set urls to (pb's propertyListForType:"NSFilenamesPboardType") as list
    set out to ""
    repeat with f in urls
        set out to out & (POSIX path of f) & linefeed
    end repeat
    return out
end if
"#,
        )
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout).to_string();
    let paths: Vec<String> = text
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();
    if paths.is_empty() {
        None
    } else {
        Some(paths)
    }
}

#[cfg(target_os = "linux")]
fn get_clipboard_file_paths() -> Option<Vec<String>> {
    // Try X11 first (xclip with gnome-copied-files MIME)
    if let Ok(output) = std::process::Command::new("xclip")
        .args([
            "-selection",
            "clipboard",
            "-t",
            "x-special/gnome-copied-files",
            "-o",
        ])
        .output()
    {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout).to_string();
            let paths = parse_linux_file_uris(&text);
            if !paths.is_empty() {
                return Some(paths);
            }
        }
    }
    // Wayland fallback (wl-paste with uri-list)
    if let Ok(output) = std::process::Command::new("wl-paste")
        .args(["-t", "text/uri-list"])
        .output()
    {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout).to_string();
            let paths = parse_linux_file_uris(&text);
            if !paths.is_empty() {
                return Some(paths);
            }
        }
    }
    None
}

/// Parse file URIs from Linux clipboard content.
/// Skips action lines like "copy"/"cut" and converts file:// URIs to local paths.
#[cfg(target_os = "linux")]
fn parse_linux_file_uris(text: &str) -> Vec<String> {
    text.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            if let Some(path) = line.strip_prefix("file://") {
                // URL-decode the path
                Some(url_decode(path))
            } else {
                None // Skip action lines like "copy"/"cut"
            }
        })
        .collect()
}

/// Simple percent-decoding for file paths (e.g. %20 -> space)
#[cfg(target_os = "linux")]
fn url_decode(s: &str) -> String {
    let mut result = Vec::new();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(val) = u8::from_str_radix(&String::from_utf8_lossy(&bytes[i + 1..i + 3]), 16)
            {
                result.push(val);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&result).to_string()
}

/// Run auto-cleanup based on stored settings
fn run_auto_cleanup(db: &Arc<Database>, blob_store: &Arc<BlobStore>) {
    let max_count = db
        .get_setting("max_history")
        .ok()
        .flatten()
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(500);

    let expire_days = db
        .get_setting("expire_days")
        .ok()
        .flatten()
        .and_then(|v| v.parse::<i64>().ok());

    if let Err(e) = db.auto_cleanup(max_count, expire_days) {
        log::error!("Auto-cleanup failed: {}", e);
    }

    // Cache size limit cleanup
    let max_mb = db
        .get_setting("cache_max_size_mb")
        .ok()
        .flatten()
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);
    if max_mb > 0 {
        let max_bytes = max_mb as u64 * 1024 * 1024;
        if let Ok(oldest) = db.get_blobs_oldest_first() {
            if let Err(e) = blob_store.cleanup_by_size_limit(max_bytes, &oldest) {
                log::error!("Cache size cleanup failed: {}", e);
            }
        }
    }
}

impl ClipboardMonitor {
    pub fn new(device_id: String) -> Self {
        ClipboardMonitor {
            running: Arc::new(AtomicBool::new(false)),
            device_id,
        }
    }

    pub fn start<F>(&self, db: Arc<Database>, blob_store: Arc<BlobStore>, callback: F)
    where
        F: Fn(ClipboardEntry) + Send + 'static,
    {
        let running = self.running.clone();
        let device_id = self.device_id.clone();

        running.store(true, Ordering::SeqCst);

        thread::spawn(move || {
            let mut last_text_hash = String::new();
            let mut last_image_hash = String::new();
            let mut last_files_hash = String::new();

            // Initialize with current clipboard content to avoid capturing existing content on startup
            if let Ok(mut clipboard) = arboard::Clipboard::new() {
                if let Ok(text) = clipboard.get_text() {
                    if !text.is_empty() {
                        last_text_hash = compute_hash(text.as_bytes());
                    }
                }
            } else {
                log::error!("Failed to create clipboard instance for text initialization");
            }

            if let Some(image) = get_clipboard_image() {
                if let Ok(png_bytes) = encode_png(&image) {
                    last_image_hash = compute_hash(&png_bytes);
                }
            }

            if let Some(paths) = get_clipboard_file_paths() {
                let joined = paths.join("\n");
                last_files_hash = compute_hash(joined.as_bytes());
            }

            while running.load(Ordering::SeqCst) {
                // Skip recording when incognito mode is active
                if INCOGNITO.load(Ordering::Relaxed) {
                    thread::sleep(Duration::from_millis(500));
                    continue;
                }

                let mut captured = false;

                // 1. Check file paths FIRST (highest priority - file copies)
                if let Some(paths) = get_clipboard_file_paths() {
                    captured = true;
                    let joined = paths.join("\n");
                    let hash = compute_hash(joined.as_bytes());
                    if hash != last_files_hash {
                        last_files_hash = hash.clone();
                        last_image_hash.clear();
                        last_text_hash.clear();

                        // Check app exclusion
                        let source = get_clipboard_source();
                        if is_app_excluded(source.display_name().as_deref()) {
                            thread::sleep(Duration::from_millis(500));
                            continue;
                        }

                        match db.find_by_hash(&hash) {
                            Ok(Some(existing)) => {
                                let source_label = source.display_name();
                                let _ = db.update_entry_timestamp(
                                    &existing.id,
                                    source_label.as_deref(),
                                    source.url.as_deref(),
                                    source.icon.as_deref(),
                                );
                                if let Ok(Some(updated)) = db.get_entry(&existing.id) {
                                    callback(updated);
                                }
                            }
                            Ok(None) => {
                                let source_label = source.display_name();

                                let file_metas = file_meta::collect_all_meta(&paths);
                                let file_meta_json = if file_metas.is_empty() {
                                    None
                                } else {
                                    serde_json::to_string(&file_metas).ok()
                                };

                                let mut thumb_path = None;
                                if paths.len() == 1 {
                                    if let Some(meta) = file_metas.first() {
                                        if matches!(meta.file_type, file_meta::FileType::Image) {
                                            if let Ok(img_data) = std::fs::read(&paths[0]) {
                                                if let Ok(img) = image::load_from_memory(&img_data)
                                                {
                                                    let thumb = img.thumbnail(200, 200);
                                                    let mut thumb_bytes = Vec::new();
                                                    let mut cursor = Cursor::new(&mut thumb_bytes);
                                                    if thumb
                                                        .write_to(
                                                            &mut cursor,
                                                            image::ImageFormat::Png,
                                                        )
                                                        .is_ok()
                                                    {
                                                        let thumb_id =
                                                            uuid::Uuid::new_v4().to_string();
                                                        if let Ok(rel) = blob_store
                                                            .save_thumbnail(&thumb_id, &thumb_bytes)
                                                        {
                                                            thumb_path = Some(rel);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                let now = chrono::Utc::now().to_rfc3339();
                                let entry = ClipboardEntry {
                                    id: uuid::Uuid::new_v4().to_string(),
                                    content_type: ContentType::FilePaths,
                                    text_content: Some(joined),
                                    html_content: None,
                                    blob_path: None,
                                    thumbnail_path: thumb_path,
                                    content_hash: hash,
                                    source_app: source_label.clone(),
                                    source_url: source.url.clone(),
                                    source_icon: source.icon.clone(),
                                    device_id: device_id.clone(),
                                    is_favorite: false,
                                    is_pinned: false,
                                    tags: Vec::new(),
                                    created_at: now.clone(),
                                    updated_at: now,
                                    synced_at: None,
                                    sync_status: SyncStatus::Local,
                                    sync_version: 0,
                                    ai_summary: None,
                                    content_category: Some("FilePath".to_string()),
                                    detected_language: None,
                                    file_meta: file_meta_json,
                                    ocr_text: None,
                                    is_sensitive: false,
                                    sensitive_types: None,
                                };

                                if let Err(e) = db.insert_entry(&entry) {
                                    log::error!("Failed to insert file paths entry: {}", e);
                                } else {
                                    log::info!("Captured {} file path(s)", paths.len());
                                    run_auto_cleanup(&db, &blob_store);
                                    callback(entry);
                                }
                            }
                            Err(e) => {
                                log::error!("Failed to check file paths hash: {}", e);
                            }
                        }
                    }
                }

                // 2. Check image clipboard (before text, to avoid text overshadowing images)
                if !captured {
                    if let Some(image) = get_clipboard_image() {
                        let png_bytes = match encode_png(&image) {
                            Ok(bytes) => bytes,
                            Err(e) => {
                                log::error!("Failed to encode clipboard image as PNG: {}", e);
                                thread::sleep(Duration::from_millis(500));
                                continue;
                            }
                        };

                        let hash = compute_hash(&png_bytes);
                        if hash != last_image_hash {
                            last_image_hash = hash.clone();
                            last_files_hash.clear();
                            last_text_hash.clear();
                            captured = true;

                            // Check app exclusion
                            let source = get_clipboard_source();
                            if is_app_excluded(source.display_name().as_deref()) {
                                thread::sleep(Duration::from_millis(500));
                                continue;
                            }

                            match db.find_by_hash(&hash) {
                                Ok(Some(existing)) => {
                                    let source_label = source.display_name();
                                    let _ = db.update_entry_timestamp(
                                        &existing.id,
                                        source_label.as_deref(),
                                        source.url.as_deref(),
                                        source.icon.as_deref(),
                                    );
                                    if let Ok(Some(updated)) = db.get_entry(&existing.id) {
                                        callback(updated);
                                    }
                                }
                                Ok(None) => {
                                    let source_label = source.display_name();
                                    let entry_id = uuid::Uuid::new_v4().to_string();

                                    let blob_path =
                                        match blob_store.save_blob(&entry_id, &png_bytes, "png") {
                                            Ok(p) => p,
                                            Err(e) => {
                                                log::error!("Failed to save blob: {}", e);
                                                thread::sleep(Duration::from_millis(500));
                                                continue;
                                            }
                                        };

                                    let thumb = image.thumbnail(200, 200);
                                    let thumbnail_path = if thumb.width() < image.width()
                                        || thumb.height() < image.height()
                                    {
                                        match encode_png(&thumb) {
                                            Ok(thumb_bytes)
                                                if thumb_bytes.len() < png_bytes.len() =>
                                            {
                                                blob_store
                                                    .save_thumbnail(&entry_id, &thumb_bytes)
                                                    .ok()
                                            }
                                            Ok(_) => None,
                                            Err(_) => None,
                                        }
                                    } else {
                                        None
                                    };

                                    let now = chrono::Utc::now().to_rfc3339();
                                    let entry = ClipboardEntry {
                                        id: entry_id,
                                        content_type: ContentType::Image,
                                        text_content: None,
                                        html_content: None,
                                        blob_path: Some(blob_path),
                                        thumbnail_path,
                                        content_hash: hash,
                                        source_app: source_label.clone(),
                                        source_url: source.url.clone(),
                                        source_icon: source.icon.clone(),
                                        device_id: device_id.clone(),
                                        is_favorite: false,
                                        is_pinned: false,
                                        tags: Vec::new(),
                                        created_at: now.clone(),
                                        updated_at: now,
                                        synced_at: None,
                                        sync_status: SyncStatus::Local,
                                        sync_version: 0,
                                        ai_summary: None,
                                        content_category: None,
                                        detected_language: None,
                                        file_meta: None,
                                        ocr_text: None,
                                        is_sensitive: false,
                                        sensitive_types: None,
                                    };

                                    if let Err(e) = db.insert_entry(&entry) {
                                        log::error!("Failed to insert image entry: {}", e);
                                    } else {
                                        log::info!(
                                            "Captured image ({}x{})",
                                            image.width(),
                                            image.height()
                                        );
                                        run_auto_cleanup(&db, &blob_store);
                                        callback(entry);
                                    }
                                }
                                Err(e) => {
                                    log::error!("Failed to check image hash: {}", e);
                                }
                            }
                        }
                    }
                }

                // 3. Check text clipboard (lowest priority)
                if !captured {
                    if let Ok(mut clipboard) = arboard::Clipboard::new() {
                        if let Ok(text) = clipboard.get_text() {
                            if !text.is_empty() {
                                let hash = compute_hash(text.as_bytes());
                                if hash != last_text_hash {
                                    last_text_hash = hash.clone();
                                    last_files_hash.clear();
                                    last_image_hash.clear();

                                    // Check app exclusion
                                    let source = get_clipboard_source();
                                    if is_app_excluded(source.display_name().as_deref()) {
                                        thread::sleep(Duration::from_millis(500));
                                        continue;
                                    }

                                    match db.find_by_hash(&hash) {
                                        Ok(Some(existing)) => {
                                            let source_label = source.display_name();
                                            let source_url = source
                                                .url
                                                .clone()
                                                .or_else(get_clipboard_source_url);
                                            let _ = db.update_entry_timestamp(
                                                &existing.id,
                                                source_label.as_deref(),
                                                source_url.as_deref(),
                                                source.icon.as_deref(),
                                            );
                                            if let Ok(Some(updated)) = db.get_entry(&existing.id) {
                                                callback(updated);
                                            }
                                        }
                                        Ok(None) => {
                                            let source_label = source.display_name();
                                            // Check if HTML content is available
                                            let html_content = get_clipboard_html();
                                            let source_url = source
                                                .url
                                                .clone()
                                                .or_else(get_clipboard_source_url)
                                                .or_else(|| extract_url_from_text(&text));
                                            let content_type = if html_content.is_some() {
                                                ContentType::RichText
                                            } else {
                                                ContentType::PlainText
                                            };

                                            // Classify content category and detect programming language
                                            let category = classify_content(&text);
                                            let language = if category
                                                == crate::ai::classifier::ContentCategory::Code
                                            {
                                                let lang = detect_language(&text);
                                                if lang != crate::ai::language::ProgrammingLanguage::Unknown {
                                                    Some(lang.as_str().to_string())
                                                } else {
                                                    None
                                                }
                                            } else {
                                                None
                                            };
                                            let category_str = Some(format!("{:?}", category));

                                            // Sensitive data detection
                                            let sensitive_mode = SENSITIVE_MODE.load(Ordering::Relaxed);
                                            let (is_sensitive, sensitive_types_json) = if sensitive_mode > 0 {
                                                let disabled = sensitive_disabled_rules().read().map(|r| r.clone()).unwrap_or_default();
                                                let types = crate::clipboard::sensitive::check_sensitive(&text, &disabled);
                                                if !types.is_empty() {
                                                    if sensitive_mode == 2 {
                                                        log::info!("Sensitive content detected ({}), skipping", types.join(", "));
                                                        thread::sleep(Duration::from_millis(500));
                                                        continue;
                                                    }
                                                    (true, Some(serde_json::to_string(&types).unwrap_or_default()))
                                                } else {
                                                    (false, None)
                                                }
                                            } else {
                                                (false, None)
                                            };

                                            let now = chrono::Utc::now().to_rfc3339();
                                            let entry = ClipboardEntry {
                                                id: uuid::Uuid::new_v4().to_string(),
                                                content_type,
                                                text_content: Some(text),
                                                html_content,
                                                blob_path: None,
                                                thumbnail_path: None,
                                                content_hash: hash,
                                                source_app: source_label.clone(),
                                                source_url,
                                                source_icon: source.icon.clone(),
                                                device_id: device_id.clone(),
                                                is_favorite: false,
                                                is_pinned: false,
                                                tags: Vec::new(),
                                                created_at: now.clone(),
                                                updated_at: now,
                                                synced_at: None,
                                                sync_status: SyncStatus::Local,
                                                sync_version: 0,
                                                ai_summary: None,
                                                content_category: category_str,
                                                detected_language: language,
                                                file_meta: None,
                                                ocr_text: None,
                                                is_sensitive,
                                                sensitive_types: sensitive_types_json,
                                            };

                                            if let Err(e) = db.insert_entry(&entry) {
                                                log::error!("Failed to insert text entry: {}", e);
                                            } else {
                                                run_auto_cleanup(&db, &blob_store);
                                                callback(entry);
                                            }
                                        }
                                        Err(e) => {
                                            log::error!("Failed to check hash: {}", e);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                thread::sleep(Duration::from_millis(500));
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_app_name, normalize_window_title};

    #[test]
    fn normalize_common_app_names() {
        assert_eq!(
            normalize_app_name("chrome.exe").as_deref(),
            Some("Google Chrome")
        );
        assert_eq!(
            normalize_app_name("Brave Browser").as_deref(),
            Some("Brave")
        );
        assert_eq!(
            normalize_app_name("google-chrome").as_deref(),
            Some("Google Chrome")
        );
        assert_eq!(normalize_app_name("  ").as_deref(), None);
    }

    #[test]
    fn normalize_browser_titles() {
        assert_eq!(
            normalize_window_title("ChatGPT - Google Chrome", Some("Google Chrome")),
            Some("ChatGPT".to_string())
        );
        assert_eq!(
            normalize_window_title("OpenAI API Docs | Microsoft Edge", Some("Microsoft Edge")),
            Some("OpenAI API Docs".to_string())
        );
    }
}
