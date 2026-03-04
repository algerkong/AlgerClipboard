mod clipboard;
mod commands;
mod paste;
mod storage;

use clipboard::monitor::ClipboardMonitor;
use commands::clipboard_cmd::AppDatabase;
use commands::paste_cmd::AppBlobStore;
use storage::blob::BlobStore;
use storage::database::Database;
use std::sync::Arc;
use tauri::Emitter;
use tauri::Manager;

fn get_device_id() -> String {
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    format!("{}-{}", hostname, &uuid::Uuid::new_v4().to_string()[..8])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");

            let db_path = app_data_dir.join("clipboard.db");
            let db = Arc::new(Database::new(&db_path).expect("Failed to init database"));
            app.manage(AppDatabase(db.clone()));

            let blob_store = Arc::new(BlobStore::new(&app_data_dir).expect("Failed to init blob store"));
            app.manage(AppBlobStore(blob_store.clone()));

            let device_id = match db.get_setting("device_id") {
                Ok(Some(id)) => id,
                _ => {
                    let id = get_device_id();
                    let _ = db.set_setting("device_id", &id);
                    id
                }
            };

            let monitor = ClipboardMonitor::new(device_id);
            let app_handle = app.handle().clone();
            monitor.start(db.clone(), blob_store, move |entry| {
                let _ = app_handle.emit("clipboard-changed", &entry);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::clipboard_cmd::get_clipboard_history,
            commands::clipboard_cmd::get_entry,
            commands::clipboard_cmd::delete_entries,
            commands::clipboard_cmd::toggle_favorite,
            commands::clipboard_cmd::clear_history,
            commands::settings_cmd::get_settings,
            commands::settings_cmd::update_settings,
            commands::paste_cmd::paste_entry,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
