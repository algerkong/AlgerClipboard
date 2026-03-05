mod clipboard;
mod commands;
mod ocr;
mod paste;
mod storage;
mod translate;
mod sync;

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
use tauri_plugin_autostart::MacosLauncher;

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
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");

            let db_path = app_data_dir.join("clipboard.db");
            let db = Arc::new(Database::new(&db_path).expect("Failed to init database"));
            app.manage(AppDatabase(db.clone()));

            // Initialize BlobStore: use custom cache_dir if set, otherwise default
            let blob_base = match db.get_setting("cache_dir") {
                Ok(Some(custom_dir)) => {
                    let p = std::path::PathBuf::from(&custom_dir);
                    if p.exists() || std::fs::create_dir_all(&p).is_ok() {
                        p
                    } else {
                        log::warn!("Custom cache dir unavailable, falling back to default");
                        app_data_dir.clone()
                    }
                }
                _ => app_data_dir.clone(),
            };
            let blob_store = Arc::new(BlobStore::new(&blob_base).expect("Failed to init blob store"));
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
            let shortcut_str = "CmdOrCtrl+Shift+V";
            match shortcut_str.parse::<Shortcut>() {
                Ok(shortcut) => {
                    log::info!("Registering global shortcut: {}", shortcut_str);
                    match app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            log::info!("Global shortcut triggered");
                            if shortcut_window.is_visible().unwrap_or(false) {
                                let _ = shortcut_window.hide();
                            } else {
                                let _ = shortcut_window.show();
                                let _ = shortcut_window.set_focus();
                            }
                        }
                    }) {
                        Ok(_) => log::info!("Global shortcut registered successfully"),
                        Err(e) => log::error!("Failed to register global shortcut: {:?}", e),
                    }
                }
                Err(e) => log::error!("Failed to parse shortcut '{}': {:?}", shortcut_str, e),
            }

            // System tray with Show + Quit menu
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let tray_window = app.get_webview_window("main").unwrap();
            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap())
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
            commands::clipboard_cmd::toggle_pin,
            commands::clipboard_cmd::clear_history,
            commands::clipboard_cmd::export_data,
            commands::clipboard_cmd::import_data,
            commands::clipboard_cmd::get_entry_count,
            commands::clipboard_cmd::get_clipboard_stats,
            commands::clipboard_cmd::add_tag,
            commands::clipboard_cmd::remove_tag,
            commands::clipboard_cmd::get_all_tags,
            commands::clipboard_cmd::get_thumbnail_base64,
            commands::clipboard_cmd::extract_text_from_image,
            commands::clipboard_cmd::get_cache_info,
            commands::clipboard_cmd::cleanup_cache,
            commands::clipboard_cmd::set_cache_dir,
            commands::clipboard_cmd::migrate_cache,
            commands::clipboard_cmd::set_cache_max_size,
            commands::clipboard_cmd::get_cache_max_size,
            commands::clipboard_cmd::cleanup_cache_by_size,
            commands::clipboard_cmd::open_in_explorer,
            commands::settings_cmd::get_settings,
            commands::settings_cmd::update_settings,
            commands::settings_cmd::set_auto_start,
            commands::settings_cmd::get_auto_start,
            commands::paste_cmd::paste_entry,
            commands::template_cmd::get_templates,
            commands::template_cmd::create_template,
            commands::template_cmd::update_template,
            commands::template_cmd::delete_template,
            commands::template_cmd::apply_template,
            commands::translate_cmd::translate_text,
            commands::translate_cmd::get_translate_engines,
            commands::translate_cmd::configure_translate_engine,
            commands::sync_cmd::get_sync_accounts,
            commands::sync_cmd::create_sync_account,
            commands::sync_cmd::update_sync_account,
            commands::sync_cmd::delete_sync_account,
            commands::sync_cmd::test_sync_connection,
            commands::sync_cmd::trigger_sync,
            commands::sync_cmd::set_sync_passphrase,
            commands::sync_cmd::resolve_sync_conflict,
            commands::sync_cmd::start_oauth_flow,
            commands::sync_cmd::set_settings_sync_enabled,
            commands::sync_cmd::get_settings_sync_enabled,
            commands::sync_cmd::set_sync_max_file_size,
            commands::sync_cmd::get_sync_max_file_size,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
