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

#[cfg(not(target_os = "windows"))]
fn get_clipboard_file_paths() -> Option<Vec<String>> {
    None
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
                                        let now = chrono::Utc::now().to_rfc3339();
                                        let entry = ClipboardEntry {
                                            id: uuid::Uuid::new_v4().to_string(),
                                            content_type: ContentType::PlainText,
                                            text_content: Some(text),
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
                                            log::error!("Failed to insert text entry: {}", e);
                                        } else {
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
