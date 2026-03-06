use crate::commands::clipboard_cmd::AppDatabase;
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub const DEFAULT_TOGGLE_SHORTCUT: &str = "CmdOrCtrl+Shift+V";

pub fn register_toggle_shortcut(app: &tauri::AppHandle, shortcut_str: &str) -> Result<(), String> {
    let normalized = shortcut_str.trim();
    if normalized.is_empty() {
        return Err("Shortcut cannot be empty".to_string());
    }

    let shortcut = normalized
        .parse::<Shortcut>()
        .map_err(|e| format!("Invalid shortcut '{}': {:?}", normalized, e))?;

    app.global_shortcut()
        .unregister_all()
        .map_err(|e| format!("Failed to unregister existing shortcuts: {:?}", e))?;

    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = app.emit("main-window-opened", serde_json::json!({}));
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .map_err(|e| format!("Failed to register shortcut '{}': {:?}", normalized, e))
}

#[tauri::command]
pub fn get_settings(db: State<'_, AppDatabase>, key: String) -> Result<Option<String>, String> {
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
pub fn update_toggle_shortcut(
    app: tauri::AppHandle,
    db: State<'_, AppDatabase>,
    shortcut: String,
) -> Result<(), String> {
    let normalized = shortcut.trim();
    register_toggle_shortcut(&app, normalized)?;
    db.0.set_setting("toggle_shortcut", normalized)
}

#[tauri::command]
pub fn set_auto_start(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let autostart = app.autolaunch();
    if enabled {
        autostart
            .enable()
            .map_err(|e| format!("Failed to enable autostart: {}", e))
    } else {
        autostart
            .disable()
            .map_err(|e| format!("Failed to disable autostart: {}", e))
    }
}

#[tauri::command]
pub fn get_auto_start(app: tauri::AppHandle) -> Result<bool, String> {
    let autostart = app.autolaunch();
    autostart
        .is_enabled()
        .map_err(|e| format!("Failed to check autostart: {}", e))
}
