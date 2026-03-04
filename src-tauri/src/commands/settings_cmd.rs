use crate::commands::clipboard_cmd::AppDatabase;
use tauri::State;

#[tauri::command]
pub fn get_settings(
    db: State<'_, AppDatabase>,
    key: String,
) -> Result<Option<String>, String> {
    db.0.get_setting(&key)
}

#[tauri::command]
pub fn update_settings(
    db: State<'_, AppDatabase>,
    key: String,
    value: String,
) -> Result<(), String> {
    db.0.set_setting(&key, &value)
}
