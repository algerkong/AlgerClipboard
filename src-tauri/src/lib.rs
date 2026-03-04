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
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState};
use tauri::menu::{Menu, MenuItem};

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

            // Global shortcut: CmdOrCtrl+Shift+V to toggle window visibility
            let shortcut_window = app.get_webview_window("main").unwrap();
            let shortcut: Shortcut = "CmdOrCtrl+Shift+V".parse().unwrap();
            app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if shortcut_window.is_visible().unwrap_or(false) {
                        let _ = shortcut_window.hide();
                    } else {
                        let _ = shortcut_window.show();
                        let _ = shortcut_window.set_focus();
                    }
                }
            })?;

            // System tray with Show + Quit menu
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let tray_window = app.get_webview_window("main").unwrap();
            TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(move |app: &tauri::AppHandle, event| {
                    match event.id.as_ref() {
                        "quit" => app.exit(0),
                        "show" => {
                            let _ = tray_window.show();
                            let _ = tray_window.set_focus();
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

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
