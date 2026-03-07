use std::thread;
use std::time::Duration;

/// Set clipboard text and simulate Ctrl+V paste
pub fn paste_text(text: &str) -> Result<(), String> {
    {
        let mut clipboard =
            arboard::Clipboard::new().map_err(|e| format!("Failed to open clipboard: {}", e))?;
        clipboard
            .set_text(text)
            .map_err(|e| format!("Failed to set clipboard text: {}", e))?;
    }

    thread::sleep(Duration::from_millis(50));
    simulate_paste()?;

    Ok(())
}

/// Set clipboard to file list (CF_HDROP) and simulate Ctrl+V paste
#[cfg(target_os = "windows")]
pub fn paste_files(paths: &[&str]) -> Result<(), String> {
    use windows_sys::Win32::Foundation::{FALSE, HWND};
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
    };
    use windows_sys::Win32::System::Memory::{
        GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE, GMEM_ZEROINIT,
    };
    use windows_sys::Win32::System::Ole::CF_HDROP;

    // Build wide-char file paths: each null-terminated, double-null at end
    let mut wide_paths: Vec<u16> = Vec::new();
    for path in paths {
        let path = path.trim();
        if path.is_empty() {
            continue;
        }
        for c in path.encode_utf16() {
            wide_paths.push(c);
        }
        wide_paths.push(0); // null terminator for this path
    }
    wide_paths.push(0); // double-null terminator

    // DROPFILES struct: 20 bytes header
    // pFiles (u32) = offset to file list = 20
    // pt.x (i32) = 0, pt.y (i32) = 0
    // fNC (i32) = 0
    // fWide (i32) = 1 (wide chars)
    let dropfiles_size: usize = 20;
    let total_size = dropfiles_size + wide_paths.len() * 2;

    unsafe {
        let hmem = GlobalAlloc(GMEM_MOVEABLE | GMEM_ZEROINIT, total_size);
        if hmem.is_null() {
            return Err("Failed to allocate global memory".to_string());
        }

        let ptr = GlobalLock(hmem);
        if ptr.is_null() {
            return Err("Failed to lock global memory".to_string());
        }

        // Write DROPFILES header
        let buf = ptr as *mut u8;
        // pFiles = 20 (offset to file list)
        std::ptr::copy_nonoverlapping(&(dropfiles_size as u32) as *const u32 as *const u8, buf, 4);
        // pt.x = 0, pt.y = 0 (bytes 4-11) - already zeroed
        // fNC = 0 (bytes 12-15) - already zeroed
        // fWide = 1 (bytes 16-19)
        let f_wide: i32 = 1;
        std::ptr::copy_nonoverlapping(&f_wide as *const i32 as *const u8, buf.add(16), 4);

        // Write file paths after header
        std::ptr::copy_nonoverlapping(
            wide_paths.as_ptr() as *const u8,
            buf.add(dropfiles_size),
            wide_paths.len() * 2,
        );

        GlobalUnlock(hmem);

        if OpenClipboard(0 as HWND) == FALSE {
            return Err("Failed to open clipboard".to_string());
        }

        EmptyClipboard();

        let result = SetClipboardData(CF_HDROP as u32, hmem);
        CloseClipboard();

        if result.is_null() {
            return Err("Failed to set clipboard data".to_string());
        }
    }

    thread::sleep(Duration::from_millis(50));
    simulate_paste()?;

    Ok(())
}

#[cfg(target_os = "macos")]
pub fn paste_files(paths: &[&str]) -> Result<(), String> {
    let paths_str = paths
        .iter()
        .map(|p| format!("\"{}\"", p.trim()))
        .collect::<Vec<_>>()
        .join(", ");
    let script = format!(
        r#"
use framework "AppKit"
set pb to current application's NSPasteboard's generalPasteboard()
pb's clearContents()
set fileURLs to current application's NSMutableArray's new()
repeat with f in {{{}}}
    set fileURL to current application's NSURL's fileURLWithPath:f
    (fileURLs's addObject:fileURL)
end repeat
pb's writeObjects:fileURLs
"#,
        paths_str
    );
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to run osascript: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to set file clipboard: {}", stderr));
    }
    thread::sleep(Duration::from_millis(50));
    simulate_paste()
}

#[cfg(target_os = "linux")]
pub fn paste_files(paths: &[&str]) -> Result<(), String> {
    let content = format!(
        "copy\n{}",
        paths
            .iter()
            .map(|p| format!("file://{}", p.trim()))
            .collect::<Vec<_>>()
            .join("\n")
    );

    // Try X11 first (xclip)
    let xclip_result = std::process::Command::new("xclip")
        .args([
            "-selection",
            "clipboard",
            "-t",
            "x-special/gnome-copied-files",
            "-i",
        ])
        .stdin(std::process::Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            if let Some(ref mut stdin) = child.stdin {
                stdin.write_all(content.as_bytes())?;
            }
            child.wait()
        });

    match xclip_result {
        Ok(status) if status.success() => {}
        _ => {
            // Wayland fallback (wl-copy)
            let mut child = std::process::Command::new("wl-copy")
                .args(["-t", "x-special/gnome-copied-files"])
                .stdin(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to run wl-copy (tried xclip first): {}", e))?;
            {
                use std::io::Write;
                if let Some(ref mut stdin) = child.stdin {
                    stdin
                        .write_all(content.as_bytes())
                        .map_err(|e| format!("Failed to write to wl-copy stdin: {}", e))?;
                }
            }
            let status = child
                .wait()
                .map_err(|e| format!("Failed to wait for wl-copy: {}", e))?;
            if !status.success() {
                return Err("wl-copy failed to set file clipboard".to_string());
            }
        }
    }

    thread::sleep(Duration::from_millis(50));
    simulate_paste()
}

/// Load image from path, set on clipboard, and simulate Ctrl+V paste
pub fn paste_image(path: &str) -> Result<(), String> {
    let img = image::open(path).map_err(|e| format!("Failed to open image: {}", e))?;
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();

    {
        let mut clipboard =
            arboard::Clipboard::new().map_err(|e| format!("Failed to open clipboard: {}", e))?;
        let img_data = arboard::ImageData {
            width: width as usize,
            height: height as usize,
            bytes: std::borrow::Cow::Owned(rgba.into_raw()),
        };
        clipboard
            .set_image(img_data)
            .map_err(|e| format!("Failed to set clipboard image: {}", e))?;
    }

    thread::sleep(Duration::from_millis(50));
    simulate_paste()?;

    Ok(())
}

#[cfg(target_os = "windows")]
pub fn prepare_paste_target(target_hwnd: Option<isize>, source_hwnd: Option<isize>) {
    use windows_sys::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_MENU,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId, IsWindow, SetForegroundWindow, ShowWindow,
        SW_SHOWNOACTIVATE,
    };

    let Some(target_hwnd) = target_hwnd else {
        log::warn!("No target HWND saved for paste");
        return;
    };

    if Some(target_hwnd) == source_hwnd {
        return;
    }

    unsafe {
        let hwnd = target_hwnd as *mut std::ffi::c_void;
        if hwnd.is_null() || IsWindow(hwnd) == 0 {
            log::warn!("Target HWND is invalid or destroyed");
            return;
        }

        // Ensure target window is visible (in case it was minimized)
        let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);

        // ALT key trick: sending a synthetic ALT press unlocks SetForegroundWindow
        // This is the most reliable technique documented by the Windows community.
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
        let alt_inputs = [alt_down, alt_up];
        SendInput(2, alt_inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32);

        // Also use AttachThreadInput as a belt-and-suspenders approach
        let cur_thread_id = GetCurrentThreadId();
        let target_thread_id = GetWindowThreadProcessId(hwnd, std::ptr::null_mut());

        let attached = if cur_thread_id != target_thread_id && target_thread_id != 0 {
            AttachThreadInput(cur_thread_id, target_thread_id, 1) != 0
        } else {
            false
        };

        let result = SetForegroundWindow(hwnd);
        log::info!(
            "SetForegroundWindow result: {}, target: {:?}",
            result,
            target_hwnd
        );

        // Wait for focus transfer (up to 250ms)
        let mut focused = false;
        for _ in 0..50 {
            if GetForegroundWindow() == hwnd {
                focused = true;
                break;
            }
            thread::sleep(Duration::from_millis(5));
        }

        if !focused {
            log::warn!(
                "Focus transfer may have failed. Current fg: {:?}, target: {:?}",
                GetForegroundWindow(),
                hwnd
            );
        }

        if attached {
            AttachThreadInput(cur_thread_id, target_thread_id, 0);
        }

        // Settle time for the target window to be ready for input
        thread::sleep(Duration::from_millis(30));
    }
}

#[cfg(target_os = "macos")]
pub fn prepare_paste_target(target_bundle_id: Option<String>) {
    let Some(bundle_id) = target_bundle_id else {
        return;
    };
    if bundle_id.is_empty() {
        return;
    }

    let script = format!("tell application id \"{}\" to activate", bundle_id);
    let _ = std::process::Command::new("osascript")
        .args(["-e", script.as_str()])
        .output();
    // Wait for macOS to complete the app switch animation and focus transfer
    thread::sleep(Duration::from_millis(80));
}

#[cfg(target_os = "linux")]
pub fn prepare_paste_target(target_window_id: Option<String>) {
    let Some(window_id) = target_window_id else {
        return;
    };
    if window_id.is_empty() {
        return;
    }

    let _ = std::process::Command::new("xdotool")
        .args(["windowactivate", "--sync", window_id.as_str()])
        .output();
    thread::sleep(Duration::from_millis(50));
}

/// Platform-specific paste simulation
#[cfg(target_os = "windows")]
fn simulate_paste() -> Result<(), String> {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, MapVirtualKeyW, SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT,
        KEYEVENTF_KEYUP, MAPVK_VK_TO_VSC, VK_CONTROL, VK_INSERT, VK_LCONTROL, VK_LMENU, VK_LWIN,
        VK_MENU, VK_RCONTROL, VK_RMENU, VK_RWIN, VK_SHIFT, VK_V,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetClassNameW, GetForegroundWindow, SendMessageW,
    };

    /// Paste method to use, depending on the target window class.
    enum PasteMethod {
        CtrlV,
        ShiftInsert,
        /// Legacy console: use undocumented WM_COMMAND with ID 0xfff1 (Edit > Paste)
        ConsolePaste,
    }

    /// Release all modifier keys that are currently pressed to prevent contamination.
    fn release_all_modifiers() {
        unsafe {
            let modifiers: &[u16] = &[
                VK_CONTROL,
                VK_LCONTROL,
                VK_RCONTROL,
                VK_SHIFT,
                0xA0, /* VK_LSHIFT */
                0xA1, /* VK_RSHIFT */
                VK_MENU,
                VK_LMENU,
                VK_RMENU,
                VK_LWIN,
                VK_RWIN,
            ];

            let mut ups: Vec<INPUT> = Vec::new();
            for &vk in modifiers {
                if GetAsyncKeyState(vk as i32) < 0 {
                    let scan = MapVirtualKeyW(vk as u32, MAPVK_VK_TO_VSC) as u16;
                    let mut input: INPUT = std::mem::zeroed();
                    input.r#type = INPUT_KEYBOARD;
                    input.Anonymous.ki = KEYBDINPUT {
                        wVk: vk,
                        wScan: scan,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    };
                    ups.push(input);
                }
            }

            if !ups.is_empty() {
                log::info!("Releasing {} stuck modifier key(s) before paste", ups.len());
                SendInput(
                    ups.len() as u32,
                    ups.as_ptr(),
                    std::mem::size_of::<INPUT>() as i32,
                );
                thread::sleep(Duration::from_millis(20));
            }
        }
    }

    /// Wait until all physical modifier keys are released (max ~300ms)
    fn wait_for_modifiers_release() {
        unsafe {
            let check_keys: &[u16] = &[VK_CONTROL, VK_SHIFT, VK_MENU, VK_LWIN, VK_RWIN];
            for _ in 0..30 {
                let any_down = check_keys.iter().any(|&vk| GetAsyncKeyState(vk as i32) < 0);
                if !any_down {
                    return;
                }
                thread::sleep(Duration::from_millis(10));
            }
        }
    }

    fn send_key_chord(modifiers: &[u16], key: u16) -> Result<(), String> {
        unsafe {
            let mut inputs: Vec<INPUT> = Vec::with_capacity(modifiers.len() * 2 + 2);

            for &modifier in modifiers {
                let scan = MapVirtualKeyW(modifier as u32, MAPVK_VK_TO_VSC) as u16;
                let mut input: INPUT = std::mem::zeroed();
                input.r#type = INPUT_KEYBOARD;
                input.Anonymous.ki = KEYBDINPUT {
                    wVk: modifier,
                    wScan: scan,
                    dwFlags: 0,
                    time: 0,
                    dwExtraInfo: 0,
                };
                inputs.push(input);
            }

            let key_scan = MapVirtualKeyW(key as u32, MAPVK_VK_TO_VSC) as u16;

            let mut key_down: INPUT = std::mem::zeroed();
            key_down.r#type = INPUT_KEYBOARD;
            key_down.Anonymous.ki = KEYBDINPUT {
                wVk: key,
                wScan: key_scan,
                dwFlags: 0,
                time: 0,
                dwExtraInfo: 0,
            };
            inputs.push(key_down);

            let mut key_up: INPUT = std::mem::zeroed();
            key_up.r#type = INPUT_KEYBOARD;
            key_up.Anonymous.ki = KEYBDINPUT {
                wVk: key,
                wScan: key_scan,
                dwFlags: KEYEVENTF_KEYUP,
                time: 0,
                dwExtraInfo: 0,
            };
            inputs.push(key_up);

            for &modifier in modifiers.iter().rev() {
                let scan = MapVirtualKeyW(modifier as u32, MAPVK_VK_TO_VSC) as u16;
                let mut input: INPUT = std::mem::zeroed();
                input.r#type = INPUT_KEYBOARD;
                input.Anonymous.ki = KEYBDINPUT {
                    wVk: modifier,
                    wScan: scan,
                    dwFlags: KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                };
                inputs.push(input);
            }

            let expected = inputs.len() as u32;
            let sent = SendInput(
                expected,
                inputs.as_ptr(),
                std::mem::size_of::<INPUT>() as i32,
            );
            if sent != expected {
                return Err("Failed to simulate paste keystroke".to_string());
            }

            Ok(())
        }
    }

    /// Get foreground window HWND and class name
    fn get_foreground_info() -> (Option<*mut std::ffi::c_void>, Option<String>) {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return (None, None);
            }

            let mut buf = [0u16; 256];
            let len = GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
            let class_name = if len > 0 {
                Some(String::from_utf16_lossy(&buf[..len as usize]))
            } else {
                None
            };
            (Some(hwnd), class_name)
        }
    }

    // Step 1: Wait for physical modifier keys to be released
    wait_for_modifiers_release();

    // Step 2: Force-release any logically stuck modifier keys
    release_all_modifiers();

    let (fg_hwnd, target_class) = get_foreground_info();
    log::info!(
        "Windows paste target class: {:?}, hwnd: {:?}",
        target_class,
        fg_hwnd
    );

    let method = match target_class.as_deref() {
        // PuTTY / mintty (Git Bash): Shift+Insert
        Some("PuTTY") | Some("mintty") => PasteMethod::ShiftInsert,
        // Legacy console host (cmd.exe, old PowerShell): use WM_COMMAND paste
        Some("ConsoleWindowClass") => PasteMethod::ConsolePaste,
        // Everything else (including Windows Terminal CASCADIA_HOSTING_WINDOW_CLASS): Ctrl+V
        _ => PasteMethod::CtrlV,
    };

    // Step 3: Send the paste
    match method {
        PasteMethod::CtrlV => send_key_chord(&[VK_CONTROL], VK_V),
        PasteMethod::ShiftInsert => send_key_chord(&[VK_SHIFT], VK_INSERT),
        PasteMethod::ConsolePaste => {
            // Legacy console windows don't reliably process SendInput Ctrl+V.
            // Use the undocumented WM_COMMAND with ID 0xfff1 which triggers
            // the console's internal Edit > Paste command. This is the technique
            // used by Ditto and other clipboard managers.
            if let Some(hwnd) = fg_hwnd {
                unsafe {
                    const WM_COMMAND: u32 = 0x0111;
                    const CONSOLE_PASTE_CMD: usize = 0xfff1;
                    SendMessageW(hwnd, WM_COMMAND, CONSOLE_PASTE_CMD, 0);
                }
                log::info!("Used WM_COMMAND console paste for ConsoleWindowClass");
                Ok(())
            } else {
                // Fallback to Ctrl+V if we can't get the HWND
                send_key_chord(&[VK_CONTROL], VK_V)
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn simulate_paste() -> Result<(), String> {
    std::process::Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to keystroke \"v\" using command down")
        .output()
        .map_err(|e| format!("Failed to simulate paste: {}", e))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn simulate_paste() -> Result<(), String> {
    #[derive(Clone, Copy)]
    enum Shortcut {
        CtrlV,
        CtrlShiftV,
        ShiftInsert,
    }

    fn active_window_class_name() -> Option<String> {
        let window = std::process::Command::new("xdotool")
            .arg("getactivewindow")
            .output()
            .ok()?;
        if !window.status.success() {
            return None;
        }
        let window_id = String::from_utf8_lossy(&window.stdout).trim().to_string();
        if window_id.is_empty() {
            return None;
        }

        let class = std::process::Command::new("xdotool")
            .args(["getwindowclassname", window_id.as_str()])
            .output()
            .ok()?;
        if !class.status.success() {
            return None;
        }
        let value = String::from_utf8_lossy(&class.stdout).trim().to_lowercase();
        if value.is_empty() {
            None
        } else {
            Some(value)
        }
    }

    fn pick_shortcut() -> Shortcut {
        let Some(class_name) = active_window_class_name() else {
            return Shortcut::CtrlV;
        };

        if class_name.contains("putty") || class_name.contains("mintty") {
            Shortcut::ShiftInsert
        } else if class_name.contains("terminal")
            || class_name.contains("kitty")
            || class_name.contains("wezterm")
            || class_name.contains("alacritty")
            || class_name.contains("xterm")
            || class_name.contains("konsole")
            || class_name.contains("tilix")
            || class_name.contains("terminator")
        {
            Shortcut::CtrlShiftV
        } else {
            Shortcut::CtrlV
        }
    }

    fn send_with_xdotool(shortcut: Shortcut) -> Result<(), String> {
        let chord = match shortcut {
            Shortcut::CtrlV => "ctrl+v",
            Shortcut::CtrlShiftV => "ctrl+shift+v",
            Shortcut::ShiftInsert => "shift+insert",
        };
        let output = std::process::Command::new("xdotool")
            .args(["key", "--clearmodifiers", chord])
            .output()
            .map_err(|e| format!("Failed to run xdotool: {}", e))?;
        if output.status.success() {
            Ok(())
        } else {
            Err("xdotool failed to send paste key".to_string())
        }
    }

    fn send_with_wtype(shortcut: Shortcut) -> Result<(), String> {
        let args: &[&str] = match shortcut {
            Shortcut::CtrlV => &["-M", "ctrl", "-P", "v", "-m", "ctrl", "-p", "v"],
            Shortcut::CtrlShiftV => &[
                "-M", "ctrl", "-M", "shift", "-P", "v", "-m", "shift", "-m", "ctrl", "-p", "v",
            ],
            Shortcut::ShiftInsert => {
                &["-M", "shift", "-P", "insert", "-m", "shift", "-p", "insert"]
            }
        };
        let output = std::process::Command::new("wtype")
            .args(args)
            .output()
            .map_err(|e| format!("Failed to run wtype: {}", e))?;
        if output.status.success() {
            Ok(())
        } else {
            Err("wtype failed to send paste key".to_string())
        }
    }

    let shortcut = pick_shortcut();
    match send_with_xdotool(shortcut) {
        Ok(()) => Ok(()),
        Err(_) => send_with_wtype(shortcut),
    }
}
