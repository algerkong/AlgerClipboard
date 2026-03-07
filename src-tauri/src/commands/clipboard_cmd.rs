use crate::clipboard::entry::ClipboardEntry;
use crate::commands::paste_cmd::AppBlobStore;
use crate::storage::blob::{BlobStore, CacheInfo, MigrationResult};
use crate::storage::database::{Database, ClipboardStats};
use base64::Engine;
use std::sync::Arc;
use tauri::State;

pub struct AppDatabase(pub Arc<Database>);

#[tauri::command]
pub fn get_clipboard_history(
    db: State<'_, AppDatabase>,
    limit: Option<i64>,
    offset: Option<i64>,
    type_filter: Option<String>,
    keyword: Option<String>,
    tag_filter: Option<String>,
) -> Result<Vec<ClipboardEntry>, String> {
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);
    db.0.get_history(limit, offset, type_filter, keyword, tag_filter)
}

#[tauri::command]
pub fn get_entry(
    db: State<'_, AppDatabase>,
    id: String,
) -> Result<Option<ClipboardEntry>, String> {
    db.0.get_entry(&id)
}

#[tauri::command]
pub fn delete_entries(
    db: State<'_, AppDatabase>,
    ids: Vec<String>,
) -> Result<(), String> {
    db.0.delete_entries(&ids)
}

#[tauri::command]
pub fn toggle_favorite(
    db: State<'_, AppDatabase>,
    id: String,
) -> Result<bool, String> {
    db.0.toggle_favorite(&id)
}

#[tauri::command]
pub fn toggle_pin(
    db: State<'_, AppDatabase>,
    id: String,
) -> Result<bool, String> {
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
pub fn export_data(
    db: State<'_, AppDatabase>,
) -> Result<String, String> {
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
pub fn import_data(
    db: State<'_, AppDatabase>,
    json_data: String,
) -> Result<usize, String> {
    #[derive(serde::Deserialize)]
    struct ImportData {
        entries: Vec<ClipboardEntry>,
    }

    let data: ImportData = serde_json::from_str(&json_data)
        .map_err(|e| format!("Failed to parse import data: {}", e))?;

    db.0.import_entries(&data.entries)
}

#[tauri::command]
pub fn get_entry_count(
    db: State<'_, AppDatabase>,
) -> Result<i64, String> {
    db.0.get_entry_count()
}

#[tauri::command]
pub fn get_clipboard_stats(
    db: State<'_, AppDatabase>,
) -> Result<ClipboardStats, String> {
    db.0.get_clipboard_stats()
}

#[tauri::command]
pub fn add_tag(
    db: State<'_, AppDatabase>,
    entry_id: String,
    tag: String,
) -> Result<(), String> {
    db.0.add_tag(&entry_id, &tag)
}

#[tauri::command]
pub fn remove_tag(
    db: State<'_, AppDatabase>,
    entry_id: String,
    tag: String,
) -> Result<(), String> {
    db.0.remove_tag(&entry_id, &tag)
}

#[tauri::command]
pub fn get_all_tags(
    db: State<'_, AppDatabase>,
) -> Result<Vec<String>, String> {
    db.0.get_all_tags()
}

#[tauri::command]
pub fn get_thumbnail_base64(
    blob_store: State<'_, AppBlobStore>,
    relative_path: String,
) -> Result<String, String> {
    let full_path = blob_store.0.get_blob_path(&relative_path);
    let data = std::fs::read(&full_path)
        .map_err(|e| format!("Failed to read image: {}", e))?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:image/png;base64,{}", b64))
}

#[tauri::command]
pub async fn extract_text_from_image(
    blob_store: State<'_, AppBlobStore>,
    relative_path: String,
) -> Result<crate::ocr::OcrResult, String> {
    let full_path = blob_store.0.get_blob_path(&relative_path);
    let path_str = full_path.to_string_lossy().to_string();
    tokio::task::spawn_blocking(move || crate::ocr::extract_text(&path_str))
        .await
        .map_err(|e| format!("OCR task failed: {}", e))?
}

#[tauri::command]
pub fn get_cache_info(
    blob_store: State<'_, AppBlobStore>,
) -> Result<CacheInfo, String> {
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
pub fn set_cache_dir(
    db: State<'_, AppDatabase>,
    new_path: String,
) -> Result<(), String> {
    // Verify the path is writable
    let path = std::path::Path::new(&new_path);
    std::fs::create_dir_all(path)
        .map_err(|e| format!("Cannot create directory: {}", e))?;
    let test_file = path.join(".write_test");
    std::fs::write(&test_file, b"test")
        .map_err(|e| format!("Path is not writable: {}", e))?;
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

    std::fs::create_dir_all(new_base)
        .map_err(|e| format!("Cannot create directory: {}", e))?;

    let result = BlobStore::migrate(&old_base, new_base)?;
    db.0.set_setting("cache_dir", &new_path)?;
    Ok(result)
}

#[tauri::command]
pub fn set_cache_max_size(
    db: State<'_, AppDatabase>,
    max_size_mb: i64,
) -> Result<(), String> {
    db.0.set_setting("cache_max_size_mb", &max_size_mb.to_string())
}

#[tauri::command]
pub fn get_cache_max_size(
    db: State<'_, AppDatabase>,
) -> Result<i64, String> {
    Ok(db.0.get_setting("cache_max_size_mb")?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0))
}

#[tauri::command]
pub fn cleanup_cache_by_size(
    db: State<'_, AppDatabase>,
    blob_store: State<'_, AppBlobStore>,
) -> Result<u64, String> {
    let max_mb = db.0.get_setting("cache_max_size_mb")?
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
    db: State<'_, AppDatabase>,
    id: String,
    text: String,
) -> Result<(), String> {
    db.0.update_entry_text(&id, &text)
}
