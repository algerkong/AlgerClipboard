use std::thread;
use std::time::Duration;

/// Set clipboard text and simulate Ctrl+V paste.
pub fn paste_text(text: &str) -> Result<(), String> {
    crate::paste::begin_paste();
    {
        let mut clipboard =
            arboard::Clipboard::new().map_err(|e| format!("Failed to open clipboard: {}", e))?;
        clipboard
            .set_text(text)
            .map_err(|e| format!("Failed to set clipboard text: {}", e))?;
    }
    thread::sleep(Duration::from_millis(50));
    simulate_paste()
}

/// Set clipboard to a file list (CF_HDROP) and simulate Ctrl+V paste.
pub fn paste_files(paths: &[&str]) -> Result<(), String> {
    crate::paste::begin_paste();
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

    // DROPFILES struct: 20-byte header
    //   pFiles (u32) = 20  — offset to file list
    //   pt.x / pt.y (i32) = 0
    //   fNC (i32) = 0
    //   fWide (i32) = 1    — wide-char paths
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

        let buf = ptr as *mut u8;
        // pFiles = 20
        std::ptr::copy_nonoverlapping(&(dropfiles_size as u32) as *const u32 as *const u8, buf, 4);
        // fWide = 1 at offset 16
        let f_wide: i32 = 1;
        std::ptr::copy_nonoverlapping(&f_wide as *const i32 as *const u8, buf.add(16), 4);
        // file paths after header
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
    simulate_paste()
}

/// Load image from path, set on clipboard, and simulate Ctrl+V paste.
pub fn paste_image(path: &str) -> Result<(), String> {
    crate::paste::begin_paste();
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
    simulate_paste()
}

/// Bring the target window to the foreground so it receives the paste.
///
/// IMPORTANT: Call this *before* hiding our window so that we are still the
/// foreground process when `SetForegroundWindow` is called — Windows only allows
/// foreground processes to steal focus.
pub fn prepare_paste_target(target_hwnd: Option<isize>, source_hwnd: Option<isize>) {
    use windows_sys::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId, IsIconic, IsWindow, IsWindowVisible,
        SetForegroundWindow, ShowWindow, SW_RESTORE, SW_SHOWNOACTIVATE,
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

        // Restore minimized windows; show hidden windows without activating.
        // For already-visible windows (including maximized) do nothing so their
        // state is preserved.
        if IsIconic(hwnd) != 0 {
            let _ = ShowWindow(hwnd, SW_RESTORE);
        } else if IsWindowVisible(hwnd) == 0 {
            let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
        }

        // AttachThreadInput lets us call SetForegroundWindow from a non-foreground
        // thread.  The ALT-key trick was removed because it caused the target
        // window's system menu to appear.
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

        // Poll until focus is confirmed transferred (max ~250ms)
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

        // Give the target window a moment to settle before we inject input
        thread::sleep(Duration::from_millis(30));
    }
}

/// Simulate a paste keystroke appropriate for the foreground window class.
///
/// * Regular apps → Ctrl+V
/// * PuTTY / mintty → Shift+Insert
/// * Legacy console (cmd.exe / old PowerShell) → WM_COMMAND 0xfff1
fn simulate_paste() -> Result<(), String> {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, MapVirtualKeyW, SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT,
        KEYEVENTF_KEYUP, MAPVK_VK_TO_VSC, VK_CONTROL, VK_INSERT, VK_LCONTROL, VK_LMENU, VK_LWIN,
        VK_MENU, VK_RCONTROL, VK_RMENU, VK_RWIN, VK_SHIFT, VK_V,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetClassNameW, GetForegroundWindow, SendMessageW,
    };

    enum PasteMethod {
        CtrlV,
        ShiftInsert,
        /// Legacy console: WM_COMMAND 0xfff1 (Edit > Paste)
        ConsolePaste,
    }

    /// Release all logically-stuck modifier keys before injecting Ctrl+V.
    fn release_all_modifiers() {
        unsafe {
            let modifiers: &[u16] = &[
                VK_CONTROL, VK_LCONTROL, VK_RCONTROL,
                VK_SHIFT, 0xA0 /* VK_LSHIFT */, 0xA1 /* VK_RSHIFT */,
                VK_MENU, VK_LMENU, VK_RMENU,
                VK_LWIN, VK_RWIN,
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

    /// Wait until all physical modifier keys are released (max ~300ms).
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

    // 1. Wait for physical modifiers to be released
    wait_for_modifiers_release();
    // 2. Force-release any logically stuck modifiers
    release_all_modifiers();

    let (fg_hwnd, target_class) = get_foreground_info();
    log::info!(
        "Windows paste target class: {:?}, hwnd: {:?}",
        target_class,
        fg_hwnd
    );

    let method = match target_class.as_deref() {
        Some("PuTTY") | Some("mintty") => PasteMethod::ShiftInsert,
        Some("ConsoleWindowClass") => PasteMethod::ConsolePaste,
        _ => PasteMethod::CtrlV,
    };

    // 3. Send the paste
    match method {
        PasteMethod::CtrlV => send_key_chord(&[VK_CONTROL], VK_V),
        PasteMethod::ShiftInsert => send_key_chord(&[VK_SHIFT], VK_INSERT),
        PasteMethod::ConsolePaste => {
            if let Some(hwnd) = fg_hwnd {
                unsafe {
                    const WM_COMMAND: u32 = 0x0111;
                    const CONSOLE_PASTE_CMD: usize = 0xfff1;
                    SendMessageW(hwnd, WM_COMMAND, CONSOLE_PASTE_CMD, 0);
                }
                log::info!("Used WM_COMMAND console paste for ConsoleWindowClass");
                Ok(())
            } else {
                send_key_chord(&[VK_CONTROL], VK_V)
            }
        }
    }
}
