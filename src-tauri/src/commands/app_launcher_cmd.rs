use crate::app_launcher::scanner::AppScanner;
use crate::app_launcher::AppEntry;
use crate::commands::clipboard_cmd::AppDatabase;
use std::sync::Arc;
use tauri::State;

pub type AppScannerState = Arc<AppScanner>;

#[tauri::command]
pub async fn scan_applications(
    scanner: State<'_, AppScannerState>,
) -> Result<Vec<AppEntry>, String> {
    scanner.scan()
}

#[tauri::command]
pub async fn search_applications(
    keyword: String,
    scanner: State<'_, AppScannerState>,
) -> Result<Vec<AppEntry>, String> {
    if keyword.is_empty() {
        scanner.get_all()
    } else {
        scanner.search(&keyword)
    }
}

#[tauri::command]
pub async fn launch_application(
    app_path: String,
    app_id: Option<String>,
    db: State<'_, AppDatabase>,
) -> Result<(), String> {
    crate::app_launcher::launcher::launch(&app_path)?;
    if let Some(id) = app_id {
        let _ = db.0.increment_app_launch_count(&id);
    }
    Ok(())
}

#[tauri::command]
pub async fn add_custom_app(
    name: String,
    path: String,
    icon_path: Option<String>,
    db: State<'_, AppDatabase>,
) -> Result<(), String> {
    let id = uuid::Uuid::new_v4().to_string();
    db.0.add_custom_app(&id, &name, &path, icon_path.as_deref())
}

#[tauri::command]
pub async fn remove_custom_app(
    id: String,
    db: State<'_, AppDatabase>,
) -> Result<(), String> {
    db.0.remove_custom_app(&id)
}

#[tauri::command]
pub async fn get_custom_apps(
    db: State<'_, AppDatabase>,
) -> Result<Vec<AppEntry>, String> {
    db.0.get_custom_apps()
}
