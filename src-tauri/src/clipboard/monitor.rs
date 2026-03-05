use crate::clipboard::entry::{ClipboardEntry, ContentType, SyncStatus};
use crate::storage::blob::BlobStore;
use crate::storage::database::{compute_hash, Database};
use image::DynamicImage;
use std::io::Cursor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

pub struct ClipboardMonitor {
    running: Arc<AtomicBool>,
    device_id: String,
}

/// Read HTML content from Windows clipboard (CF_HTML format)
#[cfg(target_os = "windows")]
fn get_clipboard_html() -> Option<String> {
    use windows_sys::Win32::Foundation::{HWND, FALSE};
    use windows_sys::Win32::System::DataExchange::{
        OpenClipboard, CloseClipboard, GetClipboardData, RegisterClipboardFormatW,
    };
    use windows_sys::Win32::System::Memory::{GlobalLock, GlobalUnlock, GlobalSize};

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

        // CF_HTML format has a header with StartFragment/EndFragment markers
        // Extract the actual HTML fragment
        let start_marker = "StartFragment:";
        let end_marker = "EndFragment:";

        let start_offset = raw.find(start_marker).and_then(|pos| {
            let after = &raw[pos + start_marker.len()..];
            after.trim_start().split_whitespace().next()?.parse::<usize>().ok()
        });

        let end_offset = raw.find(end_marker).and_then(|pos| {
            let after = &raw[pos + end_marker.len()..];
            after.trim_start().split_whitespace().next()?.parse::<usize>().ok()
        });

        match (start_offset, end_offset) {
            (Some(start), Some(end)) if start < end && end <= raw.len() => {
                let fragment = &raw[start..end];
                let trimmed = fragment.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                }
            }
            _ => None,
        }
    }
}

#[cfg(target_os = "macos")]
fn get_clipboard_html() -> Option<String> {
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(r#"
use framework "AppKit"
set pb to current application's NSPasteboard's generalPasteboard()
set htmlData to pb's dataForType:"public.html"
if htmlData is not missing value then
    set htmlStr to (current application's NSString's alloc()'s initWithData:htmlData encoding:4)
    return htmlStr as text
end if
"#)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let html = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if html.is_empty() { None } else { Some(html) }
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

/// Read copied file paths from Windows clipboard (CF_HDROP format)
#[cfg(target_os = "windows")]
fn get_clipboard_file_paths() -> Option<Vec<String>> {
    use windows_sys::Win32::Foundation::{HWND, FALSE};
    use windows_sys::Win32::System::DataExchange::{
        OpenClipboard, CloseClipboard, GetClipboardData,
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
        .arg(r#"
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
"#)
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
    if paths.is_empty() { None } else { Some(paths) }
}

#[cfg(target_os = "linux")]
fn get_clipboard_file_paths() -> Option<Vec<String>> {
    // Try X11 first (xclip with gnome-copied-files MIME)
    if let Ok(output) = std::process::Command::new("xclip")
        .args(["-selection", "clipboard", "-t", "x-special/gnome-copied-files", "-o"])
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
            if let Ok(val) = u8::from_str_radix(
                &String::from_utf8_lossy(&bytes[i + 1..i + 3]),
                16,
            ) {
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
    let max_count = db.get_setting("max_history")
        .ok()
        .flatten()
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(500);

    let expire_days = db.get_setting("expire_days")
        .ok()
        .flatten()
        .and_then(|v| v.parse::<i64>().ok());

    if let Err(e) = db.auto_cleanup(max_count, expire_days) {
        log::error!("Auto-cleanup failed: {}", e);
    }

    // Cache size limit cleanup
    let max_mb = db.get_setting("cache_max_size_mb")
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
            let mut clipboard = match arboard::Clipboard::new() {
                Ok(cb) => cb,
                Err(e) => {
                    log::error!("Failed to create clipboard instance: {}", e);
                    return;
                }
            };

            let mut last_text_hash = String::new();
            let mut last_image_hash = String::new();
            let mut last_files_hash = String::new();

            // Initialize with current clipboard content to avoid capturing existing content on startup
            if let Ok(text) = clipboard.get_text() {
                if !text.is_empty() {
                    last_text_hash = compute_hash(text.as_bytes());
                }
            }
            if let Ok(img) = clipboard.get_image() {
                last_image_hash = compute_hash(&img.bytes);
            }
            if let Some(paths) = get_clipboard_file_paths() {
                let joined = paths.join("\n");
                last_files_hash = compute_hash(joined.as_bytes());
            }

            while running.load(Ordering::SeqCst) {
                let mut captured = false;

                // 1. Check file paths FIRST (highest priority - file copies)
                if let Some(paths) = get_clipboard_file_paths() {
                    let joined = paths.join("\n");
                    let hash = compute_hash(joined.as_bytes());
                    if hash != last_files_hash {
                        last_files_hash = hash.clone();
                        captured = true;

                        match db.find_by_hash(&hash) {
                            Ok(Some(existing)) => {
                                let _ = db.update_entry_timestamp(&existing.id);
                                if let Ok(Some(updated)) = db.get_entry(&existing.id) {
                                    callback(updated);
                                }
                            }
                            Ok(None) => {
                                let now = chrono::Utc::now().to_rfc3339();
                                let entry = ClipboardEntry {
                                    id: uuid::Uuid::new_v4().to_string(),
                                    content_type: ContentType::FilePaths,
                                    text_content: Some(joined),
                                    html_content: None,
                                    blob_path: None,
                                    thumbnail_path: None,
                                    content_hash: hash,
                                    source_app: None,
                                    device_id: device_id.clone(),
                                    is_favorite: false,
                                    is_pinned: false,
                                    tags: Vec::new(),
                                    created_at: now.clone(),
                                    updated_at: now,
                                    synced_at: None,
                                    sync_status: SyncStatus::Local,
                                    sync_version: 0,
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
                    if let Ok(img_data) = clipboard.get_image() {
                        let hash = compute_hash(&img_data.bytes);
                        if hash != last_image_hash {
                            last_image_hash = hash.clone();
                            captured = true;

                            match db.find_by_hash(&hash) {
                                Ok(Some(existing)) => {
                                    let _ = db.update_entry_timestamp(&existing.id);
                                    if let Ok(Some(updated)) = db.get_entry(&existing.id) {
                                        callback(updated);
                                    }
                                }
                                Ok(None) => {
                                    let entry_id = uuid::Uuid::new_v4().to_string();

                                    if let Some(rgba) = image::RgbaImage::from_raw(
                                        img_data.width as u32,
                                        img_data.height as u32,
                                        img_data.bytes.to_vec(),
                                    ) {
                                        let dyn_image = DynamicImage::ImageRgba8(rgba);

                                        // Save full image as PNG
                                        let mut png_bytes = Vec::new();
                                        if let Err(e) = dyn_image.write_to(
                                            &mut Cursor::new(&mut png_bytes),
                                            image::ImageFormat::Png,
                                        ) {
                                            log::error!("Failed to encode image as PNG: {}", e);
                                            thread::sleep(Duration::from_millis(500));
                                            continue;
                                        }

                                        let blob_path =
                                            match blob_store.save_blob(&entry_id, &png_bytes, "png")
                                            {
                                                Ok(p) => p,
                                                Err(e) => {
                                                    log::error!("Failed to save blob: {}", e);
                                                    thread::sleep(Duration::from_millis(500));
                                                    continue;
                                                }
                                            };

                                        // Generate and save thumbnail
                                        let thumb = dyn_image.thumbnail(200, 200);
                                        let mut thumb_bytes = Vec::new();
                                        let thumbnail_path = if thumb
                                            .write_to(
                                                &mut Cursor::new(&mut thumb_bytes),
                                                image::ImageFormat::Png,
                                            )
                                            .is_ok()
                                        {
                                            blob_store
                                                .save_thumbnail(&entry_id, &thumb_bytes)
                                                .ok()
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
                                            source_app: None,
                                            device_id: device_id.clone(),
                                            is_favorite: false,
                                            is_pinned: false,
                                            tags: Vec::new(),
                                            created_at: now.clone(),
                                            updated_at: now,
                                            synced_at: None,
                                            sync_status: SyncStatus::Local,
                                            sync_version: 0,
                                        };

                                        if let Err(e) = db.insert_entry(&entry) {
                                            log::error!("Failed to insert image entry: {}", e);
                                        } else {
                                            log::info!("Captured image ({}x{})", img_data.width, img_data.height);
                                            run_auto_cleanup(&db, &blob_store);
                                            callback(entry);
                                        }
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
                    if let Ok(text) = clipboard.get_text() {
                        if !text.is_empty() {
                            let hash = compute_hash(text.as_bytes());
                            if hash != last_text_hash {
                                last_text_hash = hash.clone();

                                match db.find_by_hash(&hash) {
                                    Ok(Some(existing)) => {
                                        let _ = db.update_entry_timestamp(&existing.id);
                                        if let Ok(Some(updated)) = db.get_entry(&existing.id) {
                                            callback(updated);
                                        }
                                    }
                                    Ok(None) => {
                                        // Check if HTML content is available
                                        let html_content = get_clipboard_html();
                                        let content_type = if html_content.is_some() {
                                            ContentType::RichText
                                        } else {
                                            ContentType::PlainText
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
                                            source_app: None,
                                            device_id: device_id.clone(),
                                            is_favorite: false,
                                            is_pinned: false,
                                            tags: Vec::new(),
                                            created_at: now.clone(),
                                            updated_at: now,
                                            synced_at: None,
                                            sync_status: SyncStatus::Local,
                                            sync_version: 0,
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

                thread::sleep(Duration::from_millis(500));
            }
        });
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}
