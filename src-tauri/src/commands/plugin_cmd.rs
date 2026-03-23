use crate::commands::clipboard_cmd::AppDatabase;
use crate::plugin_system::manifest::PluginInfo;
use crate::plugin_system::manager::PluginManager;
use crate::plugin_system::permissions;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

pub type PluginManagerState = Arc<Mutex<PluginManager>>;

#[tauri::command]
pub fn list_plugins(
    pm: tauri::State<'_, PluginManagerState>,
) -> Result<Vec<PluginInfo>, String> {
    let manager = pm.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(manager.list_plugins())
}

#[tauri::command]
pub fn scan_plugins(
    pm: tauri::State<'_, PluginManagerState>,
) -> Result<Vec<PluginInfo>, String> {
    let mut manager = pm.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.scan();
    Ok(manager.list_plugins())
}

#[tauri::command]
pub fn enable_plugin(
    app: tauri::AppHandle,
    pm: tauri::State<'_, PluginManagerState>,
    plugin_id: String,
) -> Result<(), String> {
    let mut manager = pm.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.load(&plugin_id)?;
    let _ = app.emit("plugins-changed", ());
    Ok(())
}

#[tauri::command]
pub fn disable_plugin(
    app: tauri::AppHandle,
    pm: tauri::State<'_, PluginManagerState>,
    db: tauri::State<'_, AppDatabase>,
    plugin_id: String,
) -> Result<(), String> {
    let mut manager = pm.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.unload(&plugin_id)?;
    let _ = db.0.set_setting(&format!("plugin_enabled:{}", plugin_id), "false");
    let _ = app.emit("plugins-changed", ());
    Ok(())
}

#[tauri::command]
pub fn remove_plugin(
    app: tauri::AppHandle,
    pm: tauri::State<'_, PluginManagerState>,
    plugin_id: String,
) -> Result<(), String> {
    let mut manager = pm.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.remove_plugin(&plugin_id)?;
    let _ = app.emit("plugins-changed", ());
    Ok(())
}

#[tauri::command]
pub fn invoke_plugin_command(
    pm: tauri::State<'_, PluginManagerState>,
    plugin_id: String,
    command: String,
    args: String,
) -> Result<String, String> {
    let manager = pm.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.call_command(&plugin_id, &command, &args)
}

#[tauri::command]
pub fn get_plugin_settings(
    db: tauri::State<'_, AppDatabase>,
    pm: tauri::State<'_, PluginManagerState>,
    plugin_id: String,
) -> Result<std::collections::HashMap<String, String>, String> {
    let manager = pm.lock().map_err(|e| format!("Lock error: {}", e))?;
    let plugins = manager.list_plugins();
    let info = plugins.iter().find(|p| p.id == plugin_id);
    let mut settings = std::collections::HashMap::new();
    if let Some(info) = info {
        for key in info.settings.keys() {
            let full_key = format!("plugin:{}:{}", plugin_id, key);
            if let Ok(Some(val)) = db.0.get_setting(&full_key) {
                settings.insert(key.clone(), val);
            }
        }
    }
    Ok(settings)
}

#[tauri::command]
pub fn set_plugin_setting(
    db: tauri::State<'_, AppDatabase>,
    plugin_id: String,
    key: String,
    value: String,
) -> Result<(), String> {
    let full_key = format!("plugin:{}:{}", plugin_id, key);
    db.0.set_setting(&full_key, &value)
}

#[tauri::command]
pub fn grant_plugin_permissions(
    db: tauri::State<'_, AppDatabase>,
    plugin_id: String,
    perms: Vec<String>,
) -> Result<(), String> {
    permissions::grant_all_declared(&db.0, &plugin_id, &perms);
    Ok(())
}

#[tauri::command]
pub fn get_plugin_permissions(
    db: tauri::State<'_, AppDatabase>,
    plugin_id: String,
) -> Result<Vec<String>, String> {
    let granted = permissions::load_granted_permissions(&db.0, &plugin_id);
    Ok(granted.into_iter().collect())
}

#[tauri::command]
pub fn get_plugin_dir(
    pm: tauri::State<'_, PluginManagerState>,
) -> Result<String, String> {
    let manager = pm.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(manager.plugin_dir().to_string_lossy().into_owned())
}
