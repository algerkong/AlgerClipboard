use crate::commands::clipboard_cmd::AppDatabase;
use crate::storage::database::SyncAccount;
use crate::sync::adapters::CloudStorageAdapter;
use tauri::State;

#[tauri::command]
pub fn get_sync_accounts(db: State<'_, AppDatabase>) -> Result<Vec<SyncAccount>, String> {
    db.0.get_sync_accounts()
}

#[tauri::command]
pub fn create_sync_account(
    db: State<'_, AppDatabase>,
    provider: String,
    config: String,
    sync_frequency: String,
    interval_minutes: Option<i64>,
) -> Result<SyncAccount, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let account = SyncAccount {
        id: uuid::Uuid::new_v4().to_string(),
        provider,
        config,
        sync_frequency,
        interval_minutes,
        encryption_enabled: false,
        last_sync_at: None,
        last_sync_version: 0,
        enabled: true,
        created_at: now.clone(),
        updated_at: now,
    };
    db.0.create_sync_account(&account)?;
    Ok(account)
}

#[tauri::command]
pub fn update_sync_account(
    db: State<'_, AppDatabase>,
    id: String,
    config: String,
    sync_frequency: String,
    interval_minutes: Option<i64>,
    encryption_enabled: bool,
    enabled: bool,
) -> Result<(), String> {
    let existing = db.0.get_sync_account(&id)?
        .ok_or_else(|| "Account not found".to_string())?;

    let updated = SyncAccount {
        config,
        sync_frequency,
        interval_minutes,
        encryption_enabled,
        enabled,
        updated_at: chrono::Utc::now().to_rfc3339(),
        ..existing
    };
    db.0.update_sync_account(&updated)
}

#[tauri::command]
pub fn delete_sync_account(
    db: State<'_, AppDatabase>,
    id: String,
) -> Result<(), String> {
    db.0.delete_sync_account(&id)
}

#[tauri::command]
pub async fn test_sync_connection(
    provider: String,
    config: String,
) -> Result<bool, String> {
    let config_val: serde_json::Value = serde_json::from_str(&config)
        .map_err(|e| format!("Invalid config JSON: {}", e))?;

    match provider.as_str() {
        "webdav" => {
            let url = config_val["url"].as_str().unwrap_or("");
            let username = config_val["username"].as_str().unwrap_or("");
            let password = config_val["password"].as_str().unwrap_or("");
            let adapter = crate::sync::adapters::webdav::WebDavAdapter::new(url, username, password);
            adapter.test_connection().await
        }
        _ => Err(format!("OAuth providers require authorization first")),
    }
}

#[tauri::command]
pub async fn trigger_sync(
    app: tauri::AppHandle,
    db: State<'_, AppDatabase>,
    blob_store: State<'_, crate::commands::paste_cmd::AppBlobStore>,
    account_id: String,
) -> Result<crate::sync::engine::SyncResult, String> {
    use tauri::Emitter;

    let account = db.0.get_sync_account(&account_id)?
        .ok_or_else(|| "Account not found".to_string())?;

    let config_val: serde_json::Value = serde_json::from_str(&account.config)
        .map_err(|e| format!("Invalid config: {}", e))?;

    // Create adapter based on provider
    let adapter: Box<dyn CloudStorageAdapter> = match account.provider.as_str() {
        "webdav" => {
            let url = config_val["url"].as_str().unwrap_or("");
            let username = config_val["username"].as_str().unwrap_or("");
            let password = config_val["password"].as_str().unwrap_or("");
            Box::new(crate::sync::adapters::webdav::WebDavAdapter::new(url, username, password))
        }
        "google_drive" => {
            let tokens = serde_json::from_value(config_val["tokens"].clone())
                .map_err(|e| format!("Invalid tokens: {}", e))?;
            let client_id = config_val["client_id"].as_str().unwrap_or("");
            let client_secret = config_val["client_secret"].as_str().unwrap_or("");
            Box::new(crate::sync::adapters::google_drive::GoogleDriveAdapter::new(client_id, client_secret, tokens))
        }
        "onedrive" => {
            let tokens = serde_json::from_value(config_val["tokens"].clone())
                .map_err(|e| format!("Invalid tokens: {}", e))?;
            let client_id = config_val["client_id"].as_str().unwrap_or("");
            Box::new(crate::sync::adapters::onedrive::OneDriveAdapter::new(client_id, tokens))
        }
        _ => return Err(format!("Unknown provider: {}", account.provider)),
    };

    // Optional encryption
    let encryption = if account.encryption_enabled {
        let passphrase = db.0.get_setting("sync_passphrase")?
            .ok_or_else(|| "Encryption enabled but no passphrase set".to_string())?;
        let salt = db.0.get_setting("sync_salt")?
            .map(|s| base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &s)
                .unwrap_or_default())
            .unwrap_or_else(|| {
                let salt = crate::sync::encryption::SyncEncryption::generate_salt();
                let encoded = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &salt);
                let _ = db.0.set_setting("sync_salt", &encoded);
                salt
            });
        Some(crate::sync::encryption::SyncEncryption::from_passphrase(&passphrase, &salt)?)
    } else {
        None
    };

    let device_id = db.0.get_setting("device_id")?.unwrap_or_default();

    let _ = app.emit("sync-status-changed", serde_json::json!({ "status": "syncing" }));

    let engine = crate::sync::engine::SyncEngine::new(
        db.0.clone(),
        blob_store.0.clone(),
        adapter,
        device_id,
        encryption,
    );

    match engine.sync(account.last_sync_version).await {
        Ok(sync_result) => {
            // Update account's last sync info
            let mut updated = account.clone();
            updated.last_sync_at = Some(chrono::Utc::now().to_rfc3339());
            updated.last_sync_version = account.last_sync_version + sync_result.pushed as i64;
            updated.updated_at = chrono::Utc::now().to_rfc3339();
            let _ = db.0.update_sync_account(&updated);

            let _ = app.emit("sync-status-changed", serde_json::json!({ "status": "synced" }));
            Ok(sync_result)
        }
        Err(e) => {
            let _ = app.emit("sync-status-changed", serde_json::json!({
                "status": "error",
                "message": e.clone()
            }));
            Err(e)
        }
    }
}

#[tauri::command]
pub fn set_sync_passphrase(
    db: State<'_, AppDatabase>,
    passphrase: String,
) -> Result<(), String> {
    db.0.set_setting("sync_passphrase", &passphrase)
}

#[tauri::command]
pub fn resolve_sync_conflict(
    db: State<'_, AppDatabase>,
    entry_id: String,
    resolution: String,
) -> Result<(), String> {
    match resolution.as_str() {
        "keep_local" => {
            db.0.update_entry_sync_status(&entry_id, "pending", &chrono::Utc::now().to_rfc3339())
        }
        "keep_remote" | "keep_both" => {
            // For keep_remote: the remote version will be pulled on next sync
            // For keep_both: mark as resolved, both versions remain
            db.0.update_entry_sync_status(&entry_id, "local", &chrono::Utc::now().to_rfc3339())
        }
        _ => Err("Invalid resolution".to_string()),
    }
}

#[tauri::command]
pub async fn start_oauth_flow(
    provider: String,
    client_id: String,
    client_secret: Option<String>,
) -> Result<serde_json::Value, String> {
    use crate::sync::adapters::oauth;

    match provider.as_str() {
        "google_drive" => {
            let secret = client_secret.unwrap_or_default();
            let auth_url = format!(
                "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri=http://127.0.0.1:{{REDIRECT_PORT}}/callback&response_type=code&scope=https://www.googleapis.com/auth/drive.file&access_type=offline&prompt=consent",
                client_id
            );
            let result = oauth::oauth_localhost_flow(&auth_url)?;
            let redirect_uri = format!("http://127.0.0.1:{}/callback", result.port);

            let tokens = crate::sync::adapters::google_drive::GoogleDriveAdapter::exchange_code(
                &client_id, &secret, &result.code, &redirect_uri
            ).await?;
            serde_json::to_value(&tokens).map_err(|e| format!("Serialize: {}", e))
        }
        "onedrive" => {
            let auth_url = format!(
                "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id={}&redirect_uri=http://127.0.0.1:{{REDIRECT_PORT}}/callback&response_type=code&scope=Files.ReadWrite.All offline_access",
                client_id
            );
            let result = oauth::oauth_localhost_flow(&auth_url)?;
            let redirect_uri = format!("http://127.0.0.1:{}/callback", result.port);

            let tokens = crate::sync::adapters::onedrive::OneDriveAdapter::exchange_code(
                &client_id, &result.code, &redirect_uri
            ).await?;
            serde_json::to_value(&tokens).map_err(|e| format!("Serialize: {}", e))
        }
        _ => Err(format!("OAuth not supported for provider: {}", provider)),
    }
}
