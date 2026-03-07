use tauri::{AppHandle, Runtime};
use tauri_plugin_notification::NotificationExt;

#[cfg(target_os = "macos")]
fn show_macos_notification(title: &str, body: &str) -> Result<(), String> {
    log::info!("sending macOS notification: title='{}', body='{}'", title, body);
    let status = std::process::Command::new("osascript")
        .args([
            "-e",
            "on run argv",
            "-e",
            "display notification (item 2 of argv) with title (item 1 of argv)",
            "-e",
            "end run",
            "--",
            title,
            body,
        ])
        .status()
        .map_err(|err| format!("failed to launch osascript: {err}"))?;

    if status.success() {
        log::info!("macOS notification command completed successfully");
        Ok(())
    } else {
        let message = format!("osascript exited with status {status}");
        log::error!("{}", message);
        Err(message)
    }
}

#[tauri::command]
pub fn show_system_notification<R: Runtime>(
    app: AppHandle<R>,
    title: String,
    body: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        log::info!("sending desktop notification: title='{}', body='{}'", title, body);
        match app
            .notification()
            .builder()
            .title(title.clone())
            .body(body.clone())
            .show()
        {
            Ok(_) => Ok(()),
            Err(err) => {
                let message = err.to_string();
                log::warn!("desktop notification failed on macOS, falling back to osascript: {}", message);
                show_macos_notification(&title, &body)
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        log::info!("sending desktop notification: title='{}', body='{}'", title, body);
        app.notification()
            .builder()
            .title(title)
            .body(body)
            .show()
            .map_err(|err| {
                let message = err.to_string();
                log::error!("desktop notification failed: {}", message);
                message
            })
    }
}
