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
