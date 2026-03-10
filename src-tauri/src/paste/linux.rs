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

/// Set clipboard to a file list (x-special/gnome-copied-files) and simulate paste.
///
/// Tries xclip first (X11), falls back to wl-copy (Wayland).
pub fn paste_files(paths: &[&str]) -> Result<(), String> {
    crate::paste::begin_paste();
    let content = format!(
        "copy\n{}",
        paths
            .iter()
            .map(|p| format!("file://{}", p.trim()))
            .collect::<Vec<_>>()
            .join("\n")
    );

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
            // Wayland fallback
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

/// Activate the target window by its X11 window ID using xdotool.
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

/// Simulate a paste keystroke for the active window.
///
/// Detects terminal emulators and uses Ctrl+Shift+V or Shift+Insert as needed.
/// Tries xdotool (X11) first, falls back to wtype (Wayland).
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
