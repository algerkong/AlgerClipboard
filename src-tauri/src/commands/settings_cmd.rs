use crate::commands::clipboard_cmd::AppDatabase;
use tauri::State;
use tauri_plugin_autostart::ManagerExt;

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

#[tauri::command]
pub fn set_auto_start(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let autostart = app.autolaunch();
    if enabled {
        autostart.enable().map_err(|e| format!("Failed to enable autostart: {}", e))
    } else {
        autostart.disable().map_err(|e| format!("Failed to disable autostart: {}", e))
    }
}

#[tauri::command]
pub fn get_auto_start(app: tauri::AppHandle) -> Result<bool, String> {
    let autostart = app.autolaunch();
    autostart.is_enabled().map_err(|e| format!("Failed to check autostart: {}", e))
}
