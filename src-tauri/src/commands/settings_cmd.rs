use crate::commands::clipboard_cmd::AppDatabase;
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub const DEFAULT_TOGGLE_SHORTCUT: &str = "CmdOrCtrl+Shift+V";

// === Platform-specific: get input position (physical screen coordinates) ===

/// Windows: try text caret via GetGUIThreadInfo, fall back to GetCursorPos.
#[cfg(target_os = "windows")]
fn get_input_position(_window: &tauri::WebviewWindow) -> Option<(i32, i32)> {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetCursorPos, GetForegroundWindow, GetGUIThreadInfo,
        GetWindowThreadProcessId, GUITHREADINFO,
    };

    extern "system" {
        fn ClientToScreen(hwnd: *mut std::ffi::c_void, lppoint: *mut POINT) -> i32;
    }

    unsafe {
        let fg_hwnd = GetForegroundWindow();
        if !fg_hwnd.is_null() {
            let thread_id = GetWindowThreadProcessId(fg_hwnd, std::ptr::null_mut());
            if thread_id != 0 {
                let mut gui_info: GUITHREADINFO = std::mem::zeroed();
                gui_info.cbSize = std::mem::size_of::<GUITHREADINFO>() as u32;

                if GetGUIThreadInfo(thread_id, &mut gui_info) != 0 {
                    let rc = gui_info.rcCaret;
                    if rc.left != 0 || rc.top != 0 || rc.right != 0 || rc.bottom != 0 {
                        let focus_hwnd = if !gui_info.hwndFocus.is_null() {
                            gui_info.hwndFocus
                        } else {
                            fg_hwnd
                        };
                        let mut pt = POINT { x: rc.left, y: rc.bottom };
                        if ClientToScreen(focus_hwnd, &mut pt) != 0 {
                            return Some((pt.x, pt.y));
                        }
                    }
                }
            }
        }

        // Fallback: mouse cursor position
        let mut pt = POINT { x: 0, y: 0 };
        if GetCursorPos(&mut pt) != 0 { Some((pt.x, pt.y)) } else { None }
    }
}

/// macOS / Linux: use Tauri's cross-platform cursor_position API.
#[cfg(not(target_os = "windows"))]
fn get_input_position(window: &tauri::WebviewWindow) -> Option<(i32, i32)> {
    window
        .cursor_position()
        .ok()
        .map(|p| (p.x as i32, p.y as i32))
}

// === Platform-specific: clamp to screen bounds ===

/// Windows: use native work-area API (excludes taskbar).
#[cfg(target_os = "windows")]
fn clamp_to_screen(_window: &tauri::WebviewWindow, x: i32, y: i32, win_w: i32, win_h: i32) -> (i32, i32) {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };

    unsafe {
        let pt = POINT { x, y };
        let monitor = MonitorFromPoint(pt, MONITOR_DEFAULTTONEAREST);
        let mut info: MONITORINFO = std::mem::zeroed();
        info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;

        if GetMonitorInfoW(monitor, &mut info) != 0 {
            let work = info.rcWork;
            let mut nx = x;
            let mut ny = y + 4;

            if ny + win_h > work.bottom { ny = y - win_h - 4; }
            if nx + win_w > work.right { nx = work.right - win_w; }
            if nx < work.left { nx = work.left; }
            if ny < work.top { ny = work.top; }

            (nx, ny)
        } else {
            (x, y + 4)
        }
    }
}

/// macOS / Linux: use Tauri's monitor API for screen bounds.
#[cfg(not(target_os = "windows"))]
fn clamp_to_screen(window: &tauri::WebviewWindow, x: i32, y: i32, win_w: i32, win_h: i32) -> (i32, i32) {
    if let Ok(monitors) = window.available_monitors() {
        for monitor in &monitors {
            let pos = monitor.position();
            let size = monitor.size();
            let (mx, my) = (pos.x, pos.y);
            let (mw, mh) = (size.width as i32, size.height as i32);

            if x >= mx && x < mx + mw && y >= my && y < my + mh {
                let mut nx = x;
                let mut ny = y + 4;

                if ny + win_h > my + mh { ny = y - win_h - 4; }
                if nx + win_w > mx + mw { nx = mx + mw - win_w; }
                if nx < mx { nx = mx; }
                if ny < my { ny = my; }

                return (nx, ny);
            }
        }
    }
    (x, y + 4)
}

// === Cross-platform entry point ===

/// Position the window near the active text caret or mouse cursor.
fn position_near_caret(window: &tauri::WebviewWindow) {
    if let Some((x, y)) = get_input_position(window) {
        let win_size = window
            .outer_size()
            .unwrap_or(tauri::PhysicalSize { width: 420, height: 480 });
        let (fx, fy) = clamp_to_screen(window, x, y, win_size.width as i32, win_size.height as i32);
        let _ = window.set_position(tauri::PhysicalPosition::new(fx, fy));
    }
}

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
                        position_near_caret(&window);
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
