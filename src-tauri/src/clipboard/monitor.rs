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

            // Initialize with current clipboard content to avoid capturing existing content on startup
            if let Ok(text) = clipboard.get_text() {
                if !text.is_empty() {
                    last_text_hash = compute_hash(text.as_bytes());
                }
            }
            if let Ok(img) = clipboard.get_image() {
                let hash = compute_hash(&img.bytes);
                last_image_hash = hash;
            }

            while running.load(Ordering::SeqCst) {
                // Check text clipboard
                if let Ok(text) = clipboard.get_text() {
                    if !text.is_empty() {
                        let hash = compute_hash(text.as_bytes());
                        if hash != last_text_hash {
                            last_text_hash = hash.clone();

                            match db.find_by_hash(&hash) {
                                Ok(Some(existing)) => {
                                    // Dedup: bump to top
                                    let _ = db.update_entry_timestamp(&existing.id);
                                    if let Ok(Some(updated)) = db.get_entry(&existing.id) {
                                        callback(updated);
                                    }
                                }
                                Ok(None) => {
                                    // New entry
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
                                        tags: Vec::new(),
                                        created_at: now.clone(),
                                        updated_at: now,
                                        synced_at: None,
                                        sync_status: SyncStatus::Local,
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

                // Check image clipboard
                if let Ok(img_data) = clipboard.get_image() {
                    let hash = compute_hash(&img_data.bytes);
                    if hash != last_image_hash {
                        last_image_hash = hash.clone();

                        match db.find_by_hash(&hash) {
                            Ok(Some(existing)) => {
                                let _ = db.update_entry_timestamp(&existing.id);
                                if let Ok(Some(updated)) = db.get_entry(&existing.id) {
                                    callback(updated);
                                }
                            }
                            Ok(None) => {
                                let entry_id = uuid::Uuid::new_v4().to_string();

                                // Convert to image and save
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

                                    let blob_path = match blob_store.save_blob(&entry_id, &png_bytes, "png") {
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
                                        blob_store.save_thumbnail(&entry_id, &thumb_bytes).ok()
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
                                        tags: Vec::new(),
                                        created_at: now.clone(),
                                        updated_at: now,
                                        synced_at: None,
                                        sync_status: SyncStatus::Local,
                                    };

                                    if let Err(e) = db.insert_entry(&entry) {
                                        log::error!("Failed to insert image entry: {}", e);
                                    } else {
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

                thread::sleep(Duration::from_millis(500));
            }
        });
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}
