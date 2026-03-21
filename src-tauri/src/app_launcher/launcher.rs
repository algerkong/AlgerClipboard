use std::process::Command;

/// Launch an application at the given path using platform-specific method.
pub fn launch(app_path: &str) -> Result<(), String> {
    launch_platform(app_path)
}

#[cfg(target_os = "windows")]
fn launch_platform(app_path: &str) -> Result<(), String> {
    Command::new("cmd")
        .args(["/C", "start", "", app_path])
        .spawn()
        .map_err(|e| format!("Failed to launch app: {}", e))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn launch_platform(app_path: &str) -> Result<(), String> {
    Command::new("open")
        .arg(app_path)
        .spawn()
        .map_err(|e| format!("Failed to launch app: {}", e))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn launch_platform(app_path: &str) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(app_path)
        .spawn()
        .map_err(|e| format!("Failed to launch app: {}", e))?;
    Ok(())
}
