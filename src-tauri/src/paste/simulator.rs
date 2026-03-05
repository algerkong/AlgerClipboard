use std::thread;
use std::time::Duration;

/// Set clipboard text and simulate Ctrl+V paste
pub fn paste_text(text: &str) -> Result<(), String> {
    let mut clipboard =
        arboard::Clipboard::new().map_err(|e| format!("Failed to open clipboard: {}", e))?;

    clipboard
        .set_text(text)
        .map_err(|e| format!("Failed to set clipboard text: {}", e))?;

    thread::sleep(Duration::from_millis(50));
    simulate_paste()?;

    Ok(())
}

/// Set clipboard to file list (CF_HDROP) and simulate Ctrl+V paste
#[cfg(target_os = "windows")]
pub fn paste_files(paths: &[&str]) -> Result<(), String> {
    use windows_sys::Win32::Foundation::{HWND, FALSE};
    use windows_sys::Win32::System::DataExchange::{
        OpenClipboard, CloseClipboard, EmptyClipboard, SetClipboardData,
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
        std::ptr::copy_nonoverlapping(
            &(dropfiles_size as u32) as *const u32 as *const u8,
            buf,
            4,
        );
        // pt.x = 0, pt.y = 0 (bytes 4-11) - already zeroed
        // fNC = 0 (bytes 12-15) - already zeroed
        // fWide = 1 (bytes 16-19)
        let f_wide: i32 = 1;
        std::ptr::copy_nonoverlapping(
            &f_wide as *const i32 as *const u8,
            buf.add(16),
            4,
        );

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
        .args(["-selection", "clipboard", "-t", "x-special/gnome-copied-files", "-i"])
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

    thread::sleep(Duration::from_millis(50));
    simulate_paste()?;

    Ok(())
}

/// Platform-specific paste simulation
#[cfg(target_os = "windows")]
fn simulate_paste() -> Result<(), String> {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_CONTROL, VK_V,
    };

    unsafe {
        let mut inputs: [INPUT; 4] = std::mem::zeroed();

        // Ctrl key down
        inputs[0].r#type = INPUT_KEYBOARD;
        inputs[0].Anonymous.ki = KEYBDINPUT {
            wVk: VK_CONTROL,
            wScan: 0,
            dwFlags: 0,
            time: 0,
            dwExtraInfo: 0,
        };

        // V key down
        inputs[1].r#type = INPUT_KEYBOARD;
        inputs[1].Anonymous.ki = KEYBDINPUT {
            wVk: VK_V,
            wScan: 0,
            dwFlags: 0,
            time: 0,
            dwExtraInfo: 0,
        };

        // V key up
        inputs[2].r#type = INPUT_KEYBOARD;
        inputs[2].Anonymous.ki = KEYBDINPUT {
            wVk: VK_V,
            wScan: 0,
            dwFlags: KEYEVENTF_KEYUP,
            time: 0,
            dwExtraInfo: 0,
        };

        // Ctrl key up
        inputs[3].r#type = INPUT_KEYBOARD;
        inputs[3].Anonymous.ki = KEYBDINPUT {
            wVk: VK_CONTROL,
            wScan: 0,
            dwFlags: KEYEVENTF_KEYUP,
            time: 0,
            dwExtraInfo: 0,
        };

        let result = SendInput(4, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32);
        if result != 4 {
            return Err("Failed to simulate paste keystroke".to_string());
        }
    }

    Ok(())
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
    // Try xdotool first, fall back to wtype (for Wayland)
    let result = std::process::Command::new("xdotool")
        .args(["key", "ctrl+v"])
        .output();

    match result {
        Ok(output) if output.status.success() => Ok(()),
        _ => {
            std::process::Command::new("wtype")
                .args(["-M", "ctrl", "-P", "v", "-m", "ctrl", "-p", "v"])
                .output()
                .map_err(|e| format!("Failed to simulate paste (tried xdotool and wtype): {}", e))?;
            Ok(())
        }
    }
}
