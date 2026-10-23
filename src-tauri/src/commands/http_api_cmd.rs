use crate::commands::clipboard_cmd::AppDatabase;
use crate::commands::paste_cmd::AppBlobStore;
use crate::http_api::server::{HttpApiConfig, HttpApiManager, HttpApiStatus};
use std::sync::Arc;
use tauri::State;

pub struct HttpApiManagerState(pub Arc<HttpApiManager>);

#[tauri::command]
pub fn get_http_api_status(
    db: State<'_, AppDatabase>,
    manager: State<'_, HttpApiManagerState>,
) -> Result<HttpApiStatus, String> {
    let config = HttpApiConfig::load(&db.0);
    let mut status = manager.0.status();
    status.enabled = config.enabled;
    status.api_key = config.api_key;
    status.allow_write = config.allow_write;
    if !config.enabled {
        status.running = false;
        status.port = config.port;
        status.error = None;
    } else if !status.running {
        status.port = config.port;
    }
    Ok(status)
}

#[tauri::command]
pub async fn apply_http_api_config(
    app: tauri::AppHandle,
    db: State<'_, AppDatabase>,
    blob_store: State<'_, AppBlobStore>,
    manager: State<'_, HttpApiManagerState>,
    mut config: HttpApiConfig,
) -> Result<HttpApiStatus, String> {
    if config.port == 0 {
        config.port = crate::http_api::server::DEFAULT_PORT;
    }
    if config.enabled && config.api_key.trim().is_empty() {
        config.api_key = uuid::Uuid::new_v4().to_string();
    }
    config.save(&db.0)?;

    let manager = manager.0.clone();
    let db = db.0.clone();
    let blob_store = blob_store.0.clone();
    manager.apply(app, db, blob_store, config).await
}

#[tauri::command]
pub async fn regenerate_http_api_key(
    app: tauri::AppHandle,
    db: State<'_, AppDatabase>,
    blob_store: State<'_, AppBlobStore>,
    manager: State<'_, HttpApiManagerState>,
) -> Result<HttpApiStatus, String> {
    let mut config = HttpApiConfig::load(&db.0);
    config.api_key = uuid::Uuid::new_v4().to_string();
    config.save(&db.0)?;

    let manager = manager.0.clone();
    let db = db.0.clone();
    let blob_store = blob_store.0.clone();
    manager.apply(app, db, blob_store, config).await
}
