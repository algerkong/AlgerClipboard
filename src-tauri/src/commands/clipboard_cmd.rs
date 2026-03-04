use crate::clipboard::entry::ClipboardEntry;
use crate::commands::paste_cmd::AppBlobStore;
use crate::storage::blob::CacheInfo;
use crate::storage::database::Database;
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
) -> Result<Vec<ClipboardEntry>, String> {
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);
    db.0.get_history(limit, offset, type_filter, keyword)
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
