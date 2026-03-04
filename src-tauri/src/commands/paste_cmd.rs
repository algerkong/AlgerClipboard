use crate::commands::clipboard_cmd::AppDatabase;
use crate::paste::simulator;
use crate::storage::blob::BlobStore;
use std::sync::Arc;
use tauri::State;

pub struct AppBlobStore(pub Arc<BlobStore>);

#[tauri::command]
pub fn paste_entry(
    window: tauri::WebviewWindow,
    db: State<'_, AppDatabase>,
    blob_store: State<'_, AppBlobStore>,
    id: String,
    mode: Option<String>,
) -> Result<(), String> {
    let entry = db
        .0
        .get_entry(&id)?
        .ok_or_else(|| "Entry not found".to_string())?;

    // Hide the window before pasting
    let _ = window.hide();

    let _mode = mode.unwrap_or_else(|| "default".to_string());

    match entry.content_type {
        crate::clipboard::entry::ContentType::PlainText
        | crate::clipboard::entry::ContentType::RichText
        | crate::clipboard::entry::ContentType::FilePaths => {
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
