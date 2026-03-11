mod ai;
mod clipboard;
mod commands;
mod ocr;
mod paste;
mod storage;
mod sync;
mod translate;
mod search;

use clipboard::entry::ContentType;
use clipboard::monitor::ClipboardMonitor;
use commands::clipboard_cmd::AppDatabase;
use commands::paste_cmd::{AppBlobStore, AppPasteTargetState, PasteTargetSnapshot};
use commands::settings_cmd::{
    register_toggle_shortcut, remember_current_foreground_window, show_and_focus_main_window,
    DEFAULT_TOGGLE_SHORTCUT,
};
use std::sync::Arc;
use storage::blob::BlobStore;
use storage::database::Database;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder};
use tauri::Emitter;
use tauri::Manager;
use tauri::WebviewUrl;
use tauri_plugin_autostart::MacosLauncher;

#[cfg(target_os = "macos")]
use objc2_app_kit::{NSWindow, NSWindowTitleVisibility};

fn get_device_id() -> String {
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    format!("{}-{}", hostname, &uuid::Uuid::new_v4().to_string()[..8])
}

pub fn read_saved_window_size(db: &Database, key: &str, default_w: f64, default_h: f64) -> (f64, f64) {
    let size_key = format!("window_size_{}", key);
    match db.get_setting(&size_key) {
        Ok(Some(val)) => {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&val) {
                let w = parsed["width"].as_f64().unwrap_or(default_w);
                let h = parsed["height"].as_f64().unwrap_or(default_h);
                if w > 0.0 && h > 0.0 {
                    return (w, h);
                }
            }
            (default_w, default_h)
        }
        _ => (default_w, default_h),
    }
}

fn save_window_size(db: &Database, key: &str, width: f64, height: f64) {
    let size_key = format!("window_size_{}", key);
    let val = serde_json::json!({ "width": width, "height": height }).to_string();
    let _ = db.set_setting(&size_key, &val);
}

fn create_main_window<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    db: Option<&Database>,
) -> tauri::Result<tauri::WebviewWindow<R>> {
    let (w, h) = db
        .map(|d| read_saved_window_size(d, "main", 420.0, 480.0))
        .unwrap_or((420.0, 480.0));

    let mut builder = tauri::WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .title("AlgerClipboard")
        .inner_size(w, h)
        .min_inner_size(320.0, 400.0)
        .resizable(true)
        .always_on_top(true)
        .visible(false)
        .skip_taskbar(true)
        .center()
        .shadow(true);

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .decorations(true)
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true);
    }

    #[cfg(not(target_os = "macos"))]
    {
        builder = builder.decorations(false);
    }

    builder.build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    if window.label() == "main" {
                        #[cfg(not(debug_assertions))]
                        {
                            api.prevent_close();
                            let _ = window.hide();
                        }

                        #[cfg(debug_assertions)]
                        {
                            let _ = api;
                        }
                    }
                }
                tauri::WindowEvent::Resized(size) => {
                    // Save window size to DB on resize
                    if let Ok(scale) = window.scale_factor() {
                        let logical_w = size.width as f64 / scale;
                        let logical_h = size.height as f64 / scale;
                        // Skip saving if window is minimized (size 0)
                        if logical_w > 0.0 && logical_h > 0.0 {
                            // Map multi-instance labels (detail-1, detail-2, ...) to base key
                            let label = window.label();
                            let size_key = if label.starts_with("detail-") {
                                "detail"
                            } else if label.starts_with("image-viewer-") {
                                "image-viewer"
                            } else if label.starts_with("file-viewer-") {
                                "file-viewer"
                            } else {
                                label
                            };
                            if let Some(db) = window.try_state::<AppDatabase>() {
                                save_window_size(&db.0, size_key, logical_w, logical_h);
                            }
                        }
                    }
                }
                _ => {}
            }
        })
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init());

    #[cfg(not(debug_assertions))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                remember_current_foreground_window(app);
                show_and_focus_main_window(app, &win);
            }
        }));
    }

    builder
        .setup(|app| {
            // Initialize database first so we can read saved window sizes
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");

            let db_path = app_data_dir.join("clipboard.db");
            let db = Arc::new(Database::new(&db_path).expect("Failed to init database"));
            app.manage(AppDatabase(db.clone()));

            let main_window = create_main_window(&app.handle(), Some(&db))?;

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
            let blob_store =
                Arc::new(BlobStore::new(&blob_base).expect("Failed to init blob store"));
            app.manage(AppBlobStore(blob_store.clone()));
            app.manage(AppPasteTargetState(std::sync::Mutex::new(
                PasteTargetSnapshot::default(),
            )));

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
            let db_for_ai = db.clone();
            let db_for_ocr = db.clone();
            let blob_for_ocr = blob_store.clone();
            monitor.start(db.clone(), blob_store, move |entry| {
                let _ = app_handle.emit("clipboard-changed", &entry);

                // Auto-summarize text entries if AI is configured
                let has_text = entry.text_content.as_ref().map_or(false, |t| !t.is_empty());
                if has_text && entry.ai_summary.is_none() {
                    let db = db_for_ai.clone();
                    let entry_id = entry.id.clone();
                    let text = entry.text_content.clone().unwrap_or_default();
                    let handle = app_handle.clone();

                    tauri::async_runtime::spawn(async move {
                        // Check if auto-summary is enabled
                        let enabled = db
                            .get_setting("ai_enabled")
                            .unwrap_or(None)
                            .map(|v| v == "true")
                            .unwrap_or(false);
                        let auto_summary = db
                            .get_setting("ai_auto_summary")
                            .unwrap_or(None)
                            .map(|v| v == "true")
                            .unwrap_or(false);
                        let min_length = db
                            .get_setting("ai_summary_min_length")
                            .unwrap_or(None)
                            .and_then(|v| v.parse::<usize>().ok())
                            .unwrap_or(200);

                        if !enabled || !auto_summary || text.len() < min_length {
                            return;
                        }

                        let config = commands::ai_cmd::load_ai_config_pub(&db);
                        let engine = match commands::ai_cmd::build_engine_pub(&config) {
                            Ok(e) => e,
                            Err(e) => {
                                log::error!("Auto-summary engine error: {}", e);
                                return;
                            }
                        };

                        let language_str = if config.summary_language == "same" {
                            "the same language as the original text".to_string()
                        } else {
                            config.summary_language.clone()
                        };
                        let system_prompt = config
                            .summary_prompt
                            .replace("{language}", &language_str)
                            .replace("{max_length}", &config.summary_max_length.to_string());

                        let messages = vec![
                            crate::ai::engine::ChatMessage {
                                role: "system".to_string(),
                                content: system_prompt,
                            },
                            crate::ai::engine::ChatMessage {
                                role: "user".to_string(),
                                content: text,
                            },
                        ];

                        match engine.chat(&messages, &config.model).await {
                            Ok(resp) => {
                                let _ = db.update_entry_summary(&entry_id, &resp.content);
                                let _ = handle.emit(
                                    "entry-summary-updated",
                                    serde_json::json!({
                                        "id": entry_id,
                                        "ai_summary": resp.content,
                                    }),
                                );
                            }
                            Err(e) => {
                                log::warn!("Auto-summary failed: {}", e);
                            }
                        }
                    });
                }

                // Auto-OCR for image entries when trigger mode is "on_clipboard"
                if entry.content_type == ContentType::Image {
                    if let Some(ref blob_path) = entry.blob_path {
                        let db = db_for_ocr.clone();
                        let blob = blob_for_ocr.clone();
                        let handle = app_handle.clone();
                        let blob_path = blob_path.clone();
                        let entry_id = entry.id.clone();

                        tauri::async_runtime::spawn(async move {
                            let trigger_mode = db
                                .get_setting("ocr_auto_trigger")
                                .unwrap_or(None)
                                .unwrap_or_else(|| "on_clipboard".to_string());

                            if trigger_mode != "on_clipboard" {
                                return;
                            }

                            let full_path = blob.get_blob_path(&blob_path);
                            let image_data = match std::fs::read(&full_path) {
                                Ok(data) => data,
                                Err(e) => {
                                    log::warn!("Auto-OCR: failed to read blob '{}': {}", blob_path, e);
                                    return;
                                }
                            };

                            let app_db = AppDatabase(db.clone());
                            match commands::ocr_cmd::run_ocr_with_app(&handle, &app_db, image_data, None).await {
                                Ok(result) => {
                                    log::info!("Auto-OCR completed for {}", blob_path);
                                    // Save OCR text to entry for FTS indexing
                                    let ocr_text: String = result.lines.iter().map(|l| l.text.as_str()).collect::<Vec<_>>().join("\n");
                                    if !ocr_text.is_empty() {
                                        let _ = db.update_ocr_text(&entry_id, &ocr_text);
                                    }
                                }
                                Err(e) => {
                                    log::warn!("Auto-OCR failed for {}: {}", blob_path, e);
                                }
                            }
                        });
                    }
                }
            });

            let shortcut_str = db
                .get_setting("toggle_shortcut")
                .ok()
                .flatten()
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| DEFAULT_TOGGLE_SHORTCUT.to_string());

            match register_toggle_shortcut(app.handle(), &shortcut_str) {
                Ok(_) => {
                    log::info!("Global shortcut registered: {}", shortcut_str);
                }
                Err(e) => {
                    log::error!(
                        "Failed to register global shortcut '{}': {}",
                        shortcut_str,
                        e
                    );
                    if shortcut_str != DEFAULT_TOGGLE_SHORTCUT {
                        if let Err(default_err) =
                            register_toggle_shortcut(app.handle(), DEFAULT_TOGGLE_SHORTCUT)
                        {
                            log::error!(
                                "Failed to fallback to default shortcut '{}': {}",
                                DEFAULT_TOGGLE_SHORTCUT,
                                default_err
                            );
                        } else {
                            let _ = db.set_setting("toggle_shortcut", DEFAULT_TOGGLE_SHORTCUT);
                            log::warn!(
                                "Fell back to default shortcut: {}",
                                DEFAULT_TOGGLE_SHORTCUT
                            );
                        }
                    }
                }
            }

            // System tray with Show + Quit menu
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let tray_window = main_window.clone();
            let mut tray_builder = TrayIconBuilder::new();
            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }
            tray_builder
                .menu(&menu)
                .on_menu_event(
                    move |app: &tauri::AppHandle, event| match event.id.as_ref() {
                        "quit" => app.exit(0),
                        "show" => {
                            remember_current_foreground_window(app);
                            show_and_focus_main_window(app, &tray_window);
                        }
                        _ => {}
                    },
                )
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            remember_current_foreground_window(&app);
                            show_and_focus_main_window(&app, &win);
                        }
                    }
                })
                .build(app)?;

            #[cfg(target_os = "macos")]
            {
                if let Ok(ns_window) = main_window.ns_window() {
                    let window: &NSWindow = unsafe { &*ns_window.cast() };
                    window.setTitleVisibility(NSWindowTitleVisibility::Hidden);
                    window.setTitlebarAppearsTransparent(true);
                }
            }

            // Apply rounded corners and remove system menu on Windows 11+
            #[cfg(target_os = "windows")]
            {
                if let Some(win) = app.get_webview_window("main") {
                    if let Ok(hwnd) = win.hwnd() {
                        use windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute;
                        use windows_sys::Win32::UI::WindowsAndMessaging::{
                            GetWindowLongW, SetWindowLongW, GWL_STYLE, WS_SYSMENU,
                        };
                        const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33;
                        const DWMWCP_ROUND: u32 = 2;
                        unsafe {
                            let _ = DwmSetWindowAttribute(
                                hwnd.0,
                                DWMWA_WINDOW_CORNER_PREFERENCE,
                                &DWMWCP_ROUND as *const u32 as *const std::ffi::c_void,
                                std::mem::size_of::<u32>() as u32,
                            );

                            // Remove WS_SYSMENU to prevent the system menu from
                            // appearing when ALT + arrow keys are pressed.
                            let style = GetWindowLongW(hwnd.0, GWL_STYLE);
                            SetWindowLongW(hwnd.0, GWL_STYLE, style & !(WS_SYSMENU as i32));
                        }
                    }
                }
            }

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
            commands::clipboard_cmd::create_tag,
            commands::clipboard_cmd::add_tag,
            commands::clipboard_cmd::remove_tag,
            commands::clipboard_cmd::get_all_tags,
            commands::clipboard_cmd::get_tag_summaries,
            commands::clipboard_cmd::rename_tag,
            commands::clipboard_cmd::delete_tag_everywhere,
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
            commands::clipboard_cmd::update_entry_text,
            commands::notification_cmd::show_system_notification,
            commands::settings_cmd::get_settings,
            commands::settings_cmd::update_settings,
            commands::settings_cmd::update_toggle_shortcut,
            commands::settings_cmd::open_url,
            commands::settings_cmd::set_auto_start,
            commands::settings_cmd::get_auto_start,
            commands::settings_cmd::focus_main_window,
            commands::settings_cmd::get_window_size,
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
            commands::sync_cmd::set_sync_write_clipboard,
            commands::sync_cmd::get_sync_write_clipboard,
            commands::sync_cmd::set_sync_realtime_poll_seconds,
            commands::sync_cmd::get_sync_realtime_poll_seconds,
            commands::sync_cmd::write_to_system_clipboard,
            commands::ai_cmd::get_ai_providers,
            commands::ai_cmd::get_ai_config,
            commands::ai_cmd::save_ai_config,
            commands::ai_cmd::fetch_ai_models,
            commands::ai_cmd::test_ai_connection,
            commands::ai_cmd::ai_chat,
            commands::ai_cmd::ai_summarize,
            commands::ai_cmd::ai_translate,
            commands::ai_cmd::get_feature_availability,
            commands::ai_cmd::classify_text,
            commands::ai_cmd::detect_code_language,
            commands::ai_cmd::update_ai_summary,
            commands::favicon_cmd::fetch_favicon,
            commands::webview_cmd::create_ask_ai_panel,
            commands::webview_cmd::resize_tab_bar,
            commands::webview_cmd::eval_webview_js,
            commands::webview_cmd::webview_exists,
            commands::webview_cmd::create_ai_child_webview,
            commands::webview_cmd::show_ai_webview,
            commands::webview_cmd::hide_ai_webview,
            commands::webview_cmd::resize_ai_webview,
            commands::webview_cmd::bring_tab_bar_to_front,
            commands::file_cmd::read_file_preview,
            commands::file_cmd::get_directory_tree,
            commands::file_cmd::open_file_default,
            commands::file_cmd::open_in_file_explorer,
            commands::file_cmd::collect_file_metas,
            commands::file_cmd::list_archive_contents,
            commands::file_cmd::check_paths_exist,
            commands::file_cmd::ocr_from_file_path,
            commands::ocr_cmd::ocr_recognize,
            commands::ocr_cmd::ocr_recognize_file,
            commands::ocr_cmd::get_ocr_engines,
            commands::ocr_cmd::configure_ocr_engine,
            commands::ocr_cmd::get_default_ocr_engine,
            commands::ocr_cmd::set_default_ocr_engine,
            commands::ocr_cmd::get_enabled_ocr_engines,
            commands::ocr_cmd::get_rapidocr_runtime_status,
            commands::ocr_cmd::install_rapidocr_runtime,
            commands::ocr_cmd::remove_rapidocr_runtime,
            commands::ocr_cmd::clear_ocr_cache,
            commands::ocr_cmd::get_ocr_trigger_mode,
            commands::ocr_cmd::set_ocr_trigger_mode,
            commands::search_cmd::search_entries,
            commands::search_cmd::add_search_history,
            commands::search_cmd::get_search_history,
            commands::search_cmd::delete_search_history,
            commands::search_cmd::clear_search_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
