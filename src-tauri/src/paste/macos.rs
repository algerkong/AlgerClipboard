use std::thread;
use std::time::Duration;

/// Set clipboard text and simulate Cmd+V paste.
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

/// Set clipboard to a file list via AppKit and simulate Cmd+V paste.
pub fn paste_files(paths: &[&str]) -> Result<(), String> {
    crate::paste::begin_paste();
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

/// Load image from path, set on clipboard, and simulate Cmd+V paste.
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

/// Activate the target application by bundle ID so it receives the paste.
///
/// IMPORTANT: The caller must hide our window *before* calling this function so
/// that any pending async focus-pulse tasks (from `show_and_focus_main_window`)
/// detect the invisible window and abort — preventing them from stealing focus
/// back from the target app during the osascript `activate` call.
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
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map(|mut child| {
            // Wait up to 500ms; kill if osascript hangs (System Events busy)
            let deadline = std::time::Instant::now() + Duration::from_millis(500);
            loop {
                match child.try_wait() {
                    Ok(Some(_)) => break,
                    Ok(None) => {
                        if std::time::Instant::now() >= deadline {
                            let _ = child.kill();
                            break;
                        }
                        thread::sleep(Duration::from_millis(10));
                    }
                    Err(_) => break,
                }
            }
        });
    // Allow macOS to complete the app-switch animation and transfer focus
    thread::sleep(Duration::from_millis(80));
}

/// Simulate Cmd+V via System Events.
///
/// Uses `wait_with_output()` so stderr is fully captured in one shot.
/// Returns `Err("ACCESSIBILITY_REQUIRED")` for any non-timeout failure —
/// the only realistic failure mode for this hardcoded keystroke script on
/// macOS is a missing Accessibility permission.
fn simulate_paste() -> Result<(), String> {
    use std::process::Stdio;

    let child = std::process::Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to keystroke \"v\" using command down")
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn osascript for paste: {}", e))?;

    // Run in a thread so we can enforce a hard timeout without blocking the
    // Tauri command thread or the Tokio runtime.
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let result = child.wait_with_output();
        let _ = tx.send(result);
    });

    match rx.recv_timeout(Duration::from_millis(3000)) {
        Ok(Ok(output)) => {
            if output.status.success() {
                return Ok(());
            }

            let stderr = String::from_utf8_lossy(&output.stderr);
            // Log the raw error so it shows up in `tauri dev` output / log files,
            // which makes it much easier to diagnose unexpected failures.
            log::warn!("osascript keystroke failed — stderr: {:?}", stderr.trim());

            // The script itself is correct and hardcoded. The only realistic
            // reason it exits non-zero on macOS is a missing Accessibility
            // permission (error 1002 / -1743). Treat all non-timeout failures
            // as such so the user gets an actionable message.
            Err("ACCESSIBILITY_REQUIRED".to_string())
        }
        Ok(Err(e)) => Err(format!("Failed to wait for osascript: {}", e)),
        Err(_) => {
            // Timeout — the spawned thread will clean up the child eventually.
            Err("osascript keystroke timed out after 3s".to_string())
        }
    }
}
