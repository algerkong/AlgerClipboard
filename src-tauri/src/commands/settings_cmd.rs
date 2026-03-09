use crate::commands::clipboard_cmd::AppDatabase;
use crate::commands::paste_cmd::AppPasteTargetState;
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub const DEFAULT_TOGGLE_SHORTCUT: &str = "CmdOrCtrl+Shift+V";

/// Force keyboard focus to the window using Win32 API.
/// Tauri's `set_focus()` alone is insufficient because Windows restricts
/// `SetForegroundWindow` for background processes. The ALT-key trick
/// temporarily satisfies the OS requirement, allowing focus steal.
#[cfg(target_os = "windows")]
fn force_window_focus(window: &tauri::WebviewWindow) {
    use windows_sys::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_MENU,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId, SetForegroundWindow,
    };

    let hwnd = match window.hwnd() {
        Ok(h) => h.0,
        Err(_) => return,
    };

    unsafe {
        // ALT key trick: sending a synthetic ALT press/release unlocks
        // SetForegroundWindow for the calling process.
        let mut alt_down: INPUT = std::mem::zeroed();
        alt_down.r#type = INPUT_KEYBOARD;
        alt_down.Anonymous.ki = KEYBDINPUT {
            wVk: VK_MENU,
            wScan: 0,
            dwFlags: 0,
            time: 0,
            dwExtraInfo: 0,
        };

        let mut alt_up: INPUT = std::mem::zeroed();
        alt_up.r#type = INPUT_KEYBOARD;
        alt_up.Anonymous.ki = KEYBDINPUT {
            wVk: VK_MENU,
            wScan: 0,
            dwFlags: KEYEVENTF_KEYUP,
            time: 0,
            dwExtraInfo: 0,
        };

        let inputs = [alt_down, alt_up];
        SendInput(2, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32);

        // Also attach to the foreground thread for extra reliability
        let cur_thread = GetCurrentThreadId();
        let fg_hwnd = GetForegroundWindow();
        let fg_thread = if !fg_hwnd.is_null() {
            GetWindowThreadProcessId(fg_hwnd, std::ptr::null_mut())
        } else {
            0
        };

        let attached = if cur_thread != fg_thread && fg_thread != 0 {
            AttachThreadInput(cur_thread, fg_thread, 1) != 0
        } else {
            false
        };

        SetForegroundWindow(hwnd);

        if attached {
            AttachThreadInput(cur_thread, fg_thread, 0);
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn force_window_focus(_window: &tauri::WebviewWindow) {
    // On macOS/Linux, Tauri's set_focus() works reliably
}

fn focus_window_webview(app: &tauri::AppHandle, window: &tauri::WebviewWindow) {
    if let Some(webview) = app.get_webview(window.label()) {
        let _ = webview.set_focus();
    }
}

pub fn show_and_focus_main_window(app: &tauri::AppHandle, window: &tauri::WebviewWindow) {
    let app_handle = app.clone();
    let window_label = window.label().to_string();

    let _ = window.show();
    let _ = window.set_focus();
    force_window_focus(window);
    focus_window_webview(app, window);
    let _ = window.set_focus();
    let _ = app.emit("main-window-opened", serde_json::json!({}));

    tauri::async_runtime::spawn(async move {
        for delay_ms in [24_u64, 96_u64, 180_u64] {
            tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;

            if let Some(window) = app_handle.get_webview_window(&window_label) {
                let _ = window.set_focus();
                force_window_focus(&window);
                focus_window_webview(&app_handle, &window);
            }
        }
    });
}

// === Platform-specific: get input position (physical screen coordinates) ===

/// Windows: try text caret via GetGUIThreadInfo, fall back to GetCursorPos.
#[cfg(target_os = "windows")]
fn get_input_position(_window: &tauri::WebviewWindow) -> Option<(i32, i32)> {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetCursorPos, GetForegroundWindow, GetGUIThreadInfo, GetWindowThreadProcessId,
        GUITHREADINFO,
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
                        let mut pt = POINT {
                            x: rc.left,
                            y: rc.bottom,
                        };
                        if ClientToScreen(focus_hwnd, &mut pt) != 0 {
                            return Some((pt.x, pt.y));
                        }
                    }
                }
            }
        }

        // Fallback: mouse cursor position
        let mut pt = POINT { x: 0, y: 0 };
        if GetCursorPos(&mut pt) != 0 {
            Some((pt.x, pt.y))
        } else {
            None
        }
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
fn clamp_to_screen(
    _window: &tauri::WebviewWindow,
    x: i32,
    y: i32,
    win_w: i32,
    win_h: i32,
) -> (i32, i32) {
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

            if ny + win_h > work.bottom {
                ny = y - win_h - 4;
            }
            if nx + win_w > work.right {
                nx = work.right - win_w;
            }
            if nx < work.left {
                nx = work.left;
            }
            if ny < work.top {
                ny = work.top;
            }

            (nx, ny)
        } else {
            (x, y + 4)
        }
    }
}

/// macOS / Linux: use Tauri's monitor API for screen bounds.
#[cfg(not(target_os = "windows"))]
fn clamp_to_screen(
    window: &tauri::WebviewWindow,
    x: i32,
    y: i32,
    win_w: i32,
    win_h: i32,
) -> (i32, i32) {
    if let Ok(monitors) = window.available_monitors() {
        for monitor in &monitors {
            let pos = monitor.position();
            let size = monitor.size();
            let (mx, my) = (pos.x, pos.y);
            let (mw, mh) = (size.width as i32, size.height as i32);

            if x >= mx && x < mx + mw && y >= my && y < my + mh {
                let mut nx = x;
                let mut ny = y + 4;

                if ny + win_h > my + mh {
                    ny = y - win_h - 4;
                }
                if nx + win_w > mx + mw {
                    nx = mx + mw - win_w;
                }
                if nx < mx {
                    nx = mx;
                }
                if ny < my {
                    ny = my;
                }

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
        let win_size = window.outer_size().unwrap_or(tauri::PhysicalSize {
            width: 420,
            height: 480,
        });
        let (fx, fy) = clamp_to_screen(window, x, y, win_size.width as i32, win_size.height as i32);
        let _ = window.set_position(tauri::PhysicalPosition::new(fx, fy));
    }
}

#[cfg(target_os = "windows")]
fn get_foreground_window_handle() -> Option<isize> {
    use windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            None
        } else {
            Some(hwnd as isize)
        }
    }
}

#[cfg(target_os = "macos")]
fn get_frontmost_bundle_id() -> Option<String> {
    let output = std::process::Command::new("osascript")
        .args([
            "-e",
            "tell application \"System Events\" to get bundle identifier of first process whose frontmost is true",
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

#[cfg(target_os = "linux")]
fn get_active_window_id() -> Option<String> {
    let output = std::process::Command::new("xdotool")
        .arg("getactivewindow")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

pub fn remember_current_foreground_window(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<AppPasteTargetState>() {
        #[cfg(target_os = "windows")]
        if let Some(hwnd) = get_foreground_window_handle() {
            state.remember_windows_hwnd(hwnd);
        }

        #[cfg(target_os = "macos")]
        if let Some(bundle_id) = get_frontmost_bundle_id() {
            state.remember_macos_bundle_id(bundle_id);
        }

        #[cfg(target_os = "linux")]
        if let Some(window_id) = get_active_window_id() {
            state.remember_linux_window_id(window_id);
        }
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
                        remember_current_foreground_window(app);
                        position_near_caret(&window);
                        show_and_focus_main_window(app, &window);
                    }
                }
            }
        })
        .map_err(|e| format!("Failed to register shortcut '{}': {:?}", normalized, e))
}

// === Open URL in browser ===

fn open_url_default(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", url])
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    Ok(())
}

fn open_url_with_browser(url: &str, browser: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let exe = match browser {
            "chrome" => "chrome",
            "firefox" => "firefox",
            "edge" => "msedge",
            "brave" => "brave",
            other => other,
        };
        std::process::Command::new(exe)
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open with {}: {}", browser, e))?;
    }
    #[cfg(target_os = "macos")]
    {
        let app = match browser {
            "chrome" => "Google Chrome",
            "firefox" => "Firefox",
            "edge" => "Microsoft Edge",
            "brave" => "Brave Browser",
            "safari" => "Safari",
            other => other,
        };
        std::process::Command::new("open")
            .args(["-a", app, url])
            .spawn()
            .map_err(|e| format!("Failed to open with {}: {}", browser, e))?;
    }
    #[cfg(target_os = "linux")]
    {
        let cmd = match browser {
            "chrome" => "google-chrome",
            "firefox" => "firefox",
            "edge" => "microsoft-edge",
            "brave" => "brave-browser",
            other => other,
        };
        std::process::Command::new(cmd)
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open with {}: {}", browser, e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_url(db: State<'_, AppDatabase>, url: String) -> Result<(), String> {
    // Basic URL validation to prevent command injection
    if !url.starts_with("http://") && !url.starts_with("https://") && !url.starts_with("ftp://") {
        return Err("Invalid URL scheme".to_string());
    }

    let browser =
        db.0.get_setting("default_browser")
            .ok()
            .flatten()
            .unwrap_or_default();

    let browser = browser.trim();
    if browser.is_empty() || browser == "system" {
        open_url_default(&url)
    } else {
        open_url_with_browser(&url, browser)
    }
}

#[tauri::command]
pub fn get_settings(db: State<'_, AppDatabase>, key: String) -> Result<Option<String>, String> {
    db.0.get_setting(&key)
}

#[tauri::command]
pub fn update_settings(
    app: tauri::AppHandle,
    db: State<'_, AppDatabase>,
    key: String,
    value: String,
) -> Result<(), String> {
    db.0.set_setting(&key, &value)?;
    let _ = app.emit("settings-changed", serde_json::json!({}));
    Ok(())
}

#[tauri::command]
pub fn update_toggle_shortcut(
    app: tauri::AppHandle,
    db: State<'_, AppDatabase>,
    shortcut: String,
) -> Result<(), String> {
    let normalized = shortcut.trim();
    register_toggle_shortcut(&app, normalized)?;
    db.0.set_setting("toggle_shortcut", normalized)?;
    let _ = app.emit("settings-changed", serde_json::json!({}));
    Ok(())
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

#[tauri::command]
pub fn focus_main_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        // Use simple show + set_focus instead of show_and_focus_main_window
        // to avoid the ALT key trick which can trigger the Windows system menu
        // when the user presses arrow keys or Space shortly after.
        let _ = window.show();
        let _ = window.set_focus();
        focus_window_webview(&app, &window);
    }
}
