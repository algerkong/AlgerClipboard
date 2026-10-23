use crate::clipboard::link_preview;
use crate::commands::clipboard_cmd::AppDatabase;
use crate::commands::paste_cmd::AppBlobStore;
use tauri::{Emitter, State};

#[tauri::command]
pub async fn refresh_link_preview(
    app: tauri::AppHandle,
    db: State<'_, AppDatabase>,
    blob_store: State<'_, AppBlobStore>,
    id: String,
) -> Result<Option<String>, String> {
    let db = db.0.clone();
    let blob_store = blob_store.0.clone();

    let entry = db
        .get_entry(&id)?
        .ok_or_else(|| "Entry not found".to_string())?;
    let url = entry
        .text_content
        .as_deref()
        .and_then(link_preview::extract_first_url)
        .ok_or_else(|| "No URL found in entry".to_string())?;

    let preview = link_preview::fetch_link_preview(&url, &blob_store).await?;
    let json = serde_json::to_string(&preview).map_err(|e| e.to_string())?;
    db.update_link_preview(&id, Some(&json))?;

    let _ = app.emit(
        "entry-link-preview-updated",
        serde_json::json!({ "id": id, "link_preview": json }),
    );

    Ok(Some(json))
}
