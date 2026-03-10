use crate::clipboard::entry::ClipboardEntry;
use crate::commands::clipboard_cmd::AppDatabase;
use crate::storage::database::SearchHistoryItem;
use tauri::State;

#[tauri::command]
pub fn search_entries(
    db: State<'_, AppDatabase>,
    keyword: String,
    limit: Option<i64>,
    offset: Option<i64>,
    type_filter: Option<String>,
    time_range: Option<String>,
    tag_filter: Option<String>,
    tagged_only: Option<bool>,
) -> Result<Vec<ClipboardEntry>, String> {
    db.0.search_entries(
        &keyword,
        limit.unwrap_or(200),
        offset.unwrap_or(0),
        type_filter,
        time_range,
        tag_filter,
        tagged_only.unwrap_or(false),
    )
}

#[tauri::command]
pub fn add_search_history(db: State<'_, AppDatabase>, keyword: String) -> Result<(), String> {
    db.0.add_search_history(&keyword)
}

#[tauri::command]
pub fn get_search_history(
    db: State<'_, AppDatabase>,
    limit: Option<i64>,
) -> Result<Vec<SearchHistoryItem>, String> {
    db.0.get_search_history(limit.unwrap_or(8))
}

#[tauri::command]
pub fn delete_search_history(db: State<'_, AppDatabase>, id: i64) -> Result<(), String> {
    db.0.delete_search_history(id)
}

#[tauri::command]
pub fn clear_search_history(db: State<'_, AppDatabase>) -> Result<(), String> {
    db.0.clear_search_history()
}
