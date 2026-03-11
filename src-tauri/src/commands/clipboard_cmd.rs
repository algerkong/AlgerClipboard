use crate::clipboard::entry::ClipboardEntry;
use crate::commands::paste_cmd::AppBlobStore;
use crate::storage::blob::{BlobStore, CacheInfo, MigrationResult};
use crate::storage::database::{ClipboardStats, Database, TagSummary};
use base64::Engine;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

pub struct AppDatabase(pub Arc<Database>);

#[derive(Clone, serde::Serialize)]
struct TagChangePayload {
    action: &'static str,
    entry_id: Option<String>,
    tag: Option<String>,
    old_tag: Option<String>,
    new_tag: Option<String>,
}

#[tauri::command]
pub fn get_clipboard_history(
    db: State<'_, AppDatabase>,
    limit: Option<i64>,
    offset: Option<i64>,
    type_filter: Option<String>,
    keyword: Option<String>,
    tag_filter: Option<String>,
    tagged_only: Option<bool>,
) -> Result<Vec<ClipboardEntry>, String> {
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);
    db.0.get_history(
        limit,
        offset,
        type_filter,
        keyword,
        tag_filter,
        tagged_only.unwrap_or(false),
    )
}

#[tauri::command]
pub fn get_entry(db: State<'_, AppDatabase>, id: String) -> Result<Option<ClipboardEntry>, String> {
    db.0.get_entry(&id)
}

#[tauri::command]
pub fn delete_entries(db: State<'_, AppDatabase>, ids: Vec<String>) -> Result<(), String> {
    db.0.delete_entries(&ids)
}

#[tauri::command]
pub fn toggle_favorite(db: State<'_, AppDatabase>, id: String) -> Result<bool, String> {
    db.0.toggle_favorite(&id)
}

#[tauri::command]
pub fn toggle_pin(db: State<'_, AppDatabase>, id: String) -> Result<bool, String> {
    db.0.toggle_pin(&id)
}

#[tauri::command]
pub fn clear_history(
    db: State<'_, AppDatabase>,
    keep_favorites: Option<bool>,
) -> Result<(), String> {
    db.0.clear_history(keep_favorites.unwrap_or(true))
}

#[tauri::command]
pub fn export_data(db: State<'_, AppDatabase>) -> Result<String, String> {
    let entries = db.0.export_all_entries()?;
    let templates = db.0.get_templates(None)?;

    #[derive(serde::Serialize)]
    struct ExportData {
        version: String,
        entries: Vec<ClipboardEntry>,
        templates: Vec<crate::storage::database::Template>,
    }

    let data = ExportData {
        version: "1.0".to_string(),
        entries,
        templates,
    };

    serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize export data: {}", e))
}

#[tauri::command]
pub fn import_data(db: State<'_, AppDatabase>, json_data: String) -> Result<usize, String> {
    #[derive(serde::Deserialize)]
    struct ImportData {
        entries: Vec<ClipboardEntry>,
    }

    let data: ImportData = serde_json::from_str(&json_data)
        .map_err(|e| format!("Failed to parse import data: {}", e))?;

    db.0.import_entries(&data.entries)
}

#[tauri::command]
pub fn get_entry_count(db: State<'_, AppDatabase>) -> Result<i64, String> {
    db.0.get_entry_count()
}

#[tauri::command]
pub fn get_clipboard_stats(db: State<'_, AppDatabase>) -> Result<ClipboardStats, String> {
    db.0.get_clipboard_stats()
}

#[tauri::command]
pub fn create_tag(app: AppHandle, db: State<'_, AppDatabase>, tag: String) -> Result<(), String> {
    db.0.create_tag(&tag)?;
    let _ = app.emit(
        "tags-changed",
        TagChangePayload {
            action: "create",
            entry_id: None,
            tag: Some(tag),
            old_tag: None,
            new_tag: None,
        },
    );
    Ok(())
}

#[tauri::command]
pub fn add_tag(
    app: AppHandle,
    db: State<'_, AppDatabase>,
    entry_id: String,
    tag: String,
) -> Result<(), String> {
    db.0.add_tag(&entry_id, &tag)?;
    let _ = app.emit(
        "tags-changed",
        TagChangePayload {
            action: "add",
            entry_id: Some(entry_id),
            tag: Some(tag),
            old_tag: None,
            new_tag: None,
        },
    );
    Ok(())
}

#[tauri::command]
pub fn remove_tag(
    app: AppHandle,
    db: State<'_, AppDatabase>,
    entry_id: String,
    tag: String,
) -> Result<(), String> {
    db.0.remove_tag(&entry_id, &tag)?;
    let _ = app.emit(
        "tags-changed",
        TagChangePayload {
            action: "remove",
            entry_id: Some(entry_id),
            tag: Some(tag),
            old_tag: None,
            new_tag: None,
        },
    );
    Ok(())
}

#[tauri::command]
pub fn get_all_tags(db: State<'_, AppDatabase>) -> Result<Vec<String>, String> {
    db.0.get_all_tags()
}

#[tauri::command]
pub fn get_tag_summaries(db: State<'_, AppDatabase>) -> Result<Vec<TagSummary>, String> {
    db.0.get_tag_summaries()
}

#[tauri::command]
pub fn rename_tag(
    app: AppHandle,
    db: State<'_, AppDatabase>,
    old_tag: String,
    new_tag: String,
) -> Result<(), String> {
    db.0.rename_tag(&old_tag, &new_tag)?;
    let _ = app.emit(
        "tags-changed",
        TagChangePayload {
            action: "rename",
            entry_id: None,
            tag: None,
            old_tag: Some(old_tag),
            new_tag: Some(new_tag),
        },
    );
    Ok(())
}

#[tauri::command]
pub fn delete_tag_everywhere(
    app: AppHandle,
    db: State<'_, AppDatabase>,
    tag: String,
) -> Result<(), String> {
    db.0.delete_tag_everywhere(&tag)?;
    let _ = app.emit(
        "tags-changed",
        TagChangePayload {
            action: "delete",
            entry_id: None,
            tag: Some(tag),
            old_tag: None,
            new_tag: None,
        },
    );
    Ok(())
}

#[tauri::command]
pub fn get_thumbnail_base64(
    blob_store: State<'_, AppBlobStore>,
    relative_path: String,
) -> Result<String, String> {
    let full_path = blob_store.0.get_blob_path(&relative_path);
    let data = std::fs::read(&full_path).map_err(|e| format!("Failed to read image: {}", e))?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:image/png;base64,{}", b64))
}

#[tauri::command]
pub async fn extract_text_from_image(
    app: tauri::AppHandle,
    db: State<'_, AppDatabase>,
    blob_store: State<'_, AppBlobStore>,
    relative_path: String,
) -> Result<crate::ocr::OcrResult, String> {
    let full_path = blob_store.0.get_blob_path(&relative_path);
    let image_data = std::fs::read(&full_path)
        .map_err(|e| format!("Failed to read image '{}': {}", relative_path, e))?;
    crate::commands::ocr_cmd::run_ocr_with_app(&app, &db, image_data, None).await
}

#[tauri::command]
pub fn get_cache_info(blob_store: State<'_, AppBlobStore>) -> Result<CacheInfo, String> {
    blob_store.0.get_cache_info()
}

#[tauri::command]
pub fn cleanup_cache(
    db: State<'_, AppDatabase>,
    blob_store: State<'_, AppBlobStore>,
) -> Result<u64, String> {
    // Clean up orphaned files
    let (blob_paths, thumb_paths) = db.0.get_all_blob_paths()?;
    let freed = blob_store.0.cleanup_orphans(&blob_paths, &thumb_paths)?;

    // Also clean up blobs/thumbnails of soft-deleted entries
    // (entries with deleted = 1 still have files on disk)
    Ok(freed)
}

#[tauri::command]
pub fn set_cache_dir(db: State<'_, AppDatabase>, new_path: String) -> Result<(), String> {
    // Verify the path is writable
    let path = std::path::Path::new(&new_path);
    std::fs::create_dir_all(path).map_err(|e| format!("Cannot create directory: {}", e))?;
    let test_file = path.join(".write_test");
    std::fs::write(&test_file, b"test").map_err(|e| format!("Path is not writable: {}", e))?;
    let _ = std::fs::remove_file(&test_file);

    db.0.set_setting("cache_dir", &new_path)
}

#[tauri::command]
pub fn migrate_cache(
    db: State<'_, AppDatabase>,
    blob_store: State<'_, AppBlobStore>,
    new_path: String,
) -> Result<MigrationResult, String> {
    let old_base = blob_store.0.base_dir().to_path_buf();
    let new_base = std::path::Path::new(&new_path);

    std::fs::create_dir_all(new_base).map_err(|e| format!("Cannot create directory: {}", e))?;

    let result = BlobStore::migrate(&old_base, new_base)?;
    db.0.set_setting("cache_dir", &new_path)?;
    Ok(result)
}

#[tauri::command]
pub fn set_cache_max_size(db: State<'_, AppDatabase>, max_size_mb: i64) -> Result<(), String> {
    db.0.set_setting("cache_max_size_mb", &max_size_mb.to_string())
}

#[tauri::command]
pub fn get_cache_max_size(db: State<'_, AppDatabase>) -> Result<i64, String> {
    Ok(db
        .0
        .get_setting("cache_max_size_mb")?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0))
}

#[tauri::command]
pub fn cleanup_cache_by_size(
    db: State<'_, AppDatabase>,
    blob_store: State<'_, AppBlobStore>,
) -> Result<u64, String> {
    let max_mb =
        db.0.get_setting("cache_max_size_mb")?
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(0);
    if max_mb <= 0 {
        return Ok(0);
    }
    let max_bytes = max_mb as u64 * 1024 * 1024;
    let oldest = db.0.get_blobs_oldest_first()?;
    blob_store.0.cleanup_by_size_limit(max_bytes, &oldest)
}

#[tauri::command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn update_entry_text(
    app: AppHandle,
    db: State<'_, AppDatabase>,
    id: String,
    text: String,
) -> Result<(), String> {
    db.0.update_entry_text(&id, &text)?;
    let _ = app.emit("entry-updated", &id);
    Ok(())
}

#[tauri::command]
pub fn write_export_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content.as_bytes()).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn set_incognito(enabled: bool) {
    crate::clipboard::monitor::set_incognito(enabled);
}

#[tauri::command]
pub fn get_incognito() -> bool {
    crate::clipboard::monitor::is_incognito()
}

#[tauri::command]
pub fn save_temp_blob(
    blob_store: State<'_, AppBlobStore>,
    base64_data: String,
) -> Result<String, String> {
    let raw_b64 = if let Some(pos) = base64_data.find(',') {
        &base64_data[pos + 1..]
    } else {
        &base64_data
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(raw_b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    let id = format!("qrcode-{}", uuid::Uuid::new_v4());
    let relative_path = blob_store
        .0
        .save_blob(&id, &bytes, "png")
        .map_err(|e| format!("Save blob error: {}", e))?;

    Ok(relative_path)
}

#[tauri::command]
pub fn copy_image_to_clipboard(base64_data: String) -> Result<(), String> {
    let raw_b64 = if let Some(pos) = base64_data.find(',') {
        &base64_data[pos + 1..]
    } else {
        &base64_data
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(raw_b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    let img = image::load_from_memory(&bytes)
        .map_err(|e| format!("Image decode error: {}", e))?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();

    let img_data = arboard::ImageData {
        width: w as usize,
        height: h as usize,
        bytes: std::borrow::Cow::Owned(rgba.into_raw()),
    };

    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| format!("Clipboard error: {}", e))?;
    clipboard
        .set_image(img_data)
        .map_err(|e| format!("Set image error: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn save_image_to_file(base64_data: String, path: String) -> Result<(), String> {
    let raw_b64 = if let Some(pos) = base64_data.find(',') {
        &base64_data[pos + 1..]
    } else {
        &base64_data
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(raw_b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    std::fs::write(&path, &bytes).map_err(|e| format!("Failed to write file: {}", e))
}
