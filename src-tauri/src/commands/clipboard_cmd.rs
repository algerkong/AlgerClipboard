use crate::storage::database::Database;
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
) -> Result<Vec<crate::clipboard::entry::ClipboardEntry>, String> {
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);
    db.0.get_history(limit, offset, type_filter, keyword)
}

#[tauri::command]
pub fn get_entry(
    db: State<'_, AppDatabase>,
    id: String,
) -> Result<Option<crate::clipboard::entry::ClipboardEntry>, String> {
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
pub fn clear_history(
    db: State<'_, AppDatabase>,
    keep_favorites: Option<bool>,
) -> Result<(), String> {
    db.0.clear_history(keep_favorites.unwrap_or(true))
}
