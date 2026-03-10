use crate::commands::clipboard_cmd::AppDatabase;
use crate::paste::simulator;
use crate::storage::blob::BlobStore;
use std::sync::Arc;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::State;

pub struct AppBlobStore(pub Arc<BlobStore>);
#[derive(Default)]
pub struct PasteTargetSnapshot {
    #[cfg(target_os = "windows")]
    pub windows_hwnd: Option<isize>,
    #[cfg(target_os = "macos")]
    pub mac_bundle_id: Option<String>,
    #[cfg(target_os = "linux")]
    pub linux_window_id: Option<String>,
}

pub struct AppPasteTargetState(pub Mutex<PasteTargetSnapshot>);

impl AppPasteTargetState {
    #[cfg(target_os = "windows")]
    pub fn remember_windows_hwnd(&self, hwnd: isize) {
        if let Ok(mut guard) = self.0.lock() {
            guard.windows_hwnd = Some(hwnd);
        }
    }

    #[cfg(target_os = "windows")]
    pub fn take_windows_hwnd(&self) -> Option<isize> {
        self.0
            .lock()
            .ok()
            .and_then(|mut guard| guard.windows_hwnd.take())
    }

    #[cfg(target_os = "macos")]
    pub fn remember_macos_bundle_id(&self, bundle_id: String) {
        if let Ok(mut guard) = self.0.lock() {
            guard.mac_bundle_id = Some(bundle_id);
        }
    }

    #[cfg(target_os = "macos")]
    pub fn take_macos_bundle_id(&self) -> Option<String> {
        self.0
            .lock()
            .ok()
            .and_then(|mut guard| guard.mac_bundle_id.take())
    }

    #[cfg(target_os = "linux")]
    pub fn remember_linux_window_id(&self, window_id: String) {
        if let Ok(mut guard) = self.0.lock() {
            guard.linux_window_id = Some(window_id);
        }
    }

    #[cfg(target_os = "linux")]
    pub fn take_linux_window_id(&self) -> Option<String> {
        self.0
            .lock()
            .ok()
            .and_then(|mut guard| guard.linux_window_id.take())
    }
}

#[tauri::command]
pub fn paste_entry(
    window: tauri::WebviewWindow,
    db: State<'_, AppDatabase>,
    blob_store: State<'_, AppBlobStore>,
    paste_target: State<'_, AppPasteTargetState>,
    id: String,
    mode: Option<String>,
) -> Result<(), String> {
    let entry =
        db.0.get_entry(&id)?
            .ok_or_else(|| "Entry not found".to_string())?;

    // CRITICAL: Transfer focus to target BEFORE hiding our window.
    // We must still be the foreground process for SetForegroundWindow to succeed.
    // If we hide first, we lose foreground status and SetForegroundWindow silently fails.
    //
    // On macOS: hide the window first so that any pending async set_focus pulses
    // (from show_and_focus_main_window) see an invisible window and abort, preventing
    // them from stealing focus back from the paste target during prepare_paste_target.
    // macOS does NOT require us to be the foreground process to call osascript activate.
    #[cfg(target_os = "windows")]
    {
        let target_hwnd = paste_target.take_windows_hwnd();
        let source_hwnd = window.hwnd().ok().map(|h| h.0 as isize);
        simulator::prepare_paste_target(target_hwnd, source_hwnd);
        let _ = window.hide();
        thread::sleep(Duration::from_millis(30));
    }
    #[cfg(target_os = "macos")]
    {
        let target_bundle_id = paste_target.take_macos_bundle_id();
        // Hide our window first so the async focus-pulse task (in show_and_focus_main_window)
        // detects the invisible window and aborts before stealing focus from the target app.
        let _ = window.hide();
        thread::sleep(Duration::from_millis(30));
        simulator::prepare_paste_target(target_bundle_id);
    }
    #[cfg(target_os = "linux")]
    {
        let target_window_id = paste_target.take_linux_window_id();
        simulator::prepare_paste_target(target_window_id);
        let _ = window.hide();
        thread::sleep(Duration::from_millis(30));
    }

    let _mode = mode.unwrap_or_else(|| "default".to_string());

    match entry.content_type {
        crate::clipboard::entry::ContentType::FilePaths => {
            if let Some(text) = &entry.text_content {
                let paths: Vec<&str> = text.lines().filter(|l| !l.trim().is_empty()).collect();
                if paths.is_empty() {
                    return Err("No file paths available".to_string());
                }
                simulator::paste_files(&paths)?;
            } else {
                return Err("No file paths available".to_string());
            }
        }
        crate::clipboard::entry::ContentType::PlainText
        | crate::clipboard::entry::ContentType::RichText => {
            if let Some(text) = &entry.text_content {
                simulator::paste_text(text)?;
            } else {
                return Err("No text content available".to_string());
            }
        }
        crate::clipboard::entry::ContentType::Image => {
            if let Some(blob_path) = &entry.blob_path {
                let full_path = blob_store.0.get_blob_path(blob_path);
                let path_str = full_path
                    .to_str()
                    .ok_or_else(|| "Invalid blob path".to_string())?;
                simulator::paste_image(path_str)?;
            } else {
                return Err("No image blob path available".to_string());
            }
        }
    }

    Ok(())
}
