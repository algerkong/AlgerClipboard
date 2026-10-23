use crate::clipboard::entry::{ClipboardEntry, ContentType, SyncStatus};
use crate::clipboard::monitor;
use crate::http_api::auth::RateLimiter;
use crate::http_api::server::HttpApiConfig;
use crate::paste::simulator;
use crate::storage::blob::BlobStore;
use crate::storage::database::{compute_hash, Database};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tauri::Emitter;

#[derive(Clone)]
pub struct ApiState {
    pub app: tauri::AppHandle,
    pub db: Arc<Database>,
    pub blob_store: Arc<BlobStore>,
    pub api_key: String,
    pub allow_write: bool,
    pub rate: Arc<Mutex<RateLimiter>>,
}

pub fn build_router(
    app: tauri::AppHandle,
    db: Arc<Database>,
    blob_store: Arc<BlobStore>,
    config: &HttpApiConfig,
) -> Router {
    let state = ApiState {
        app,
        db,
        blob_store,
        api_key: config.api_key.clone(),
        allow_write: config.allow_write,
        rate: Arc::new(Mutex::new(RateLimiter::new())),
    };

    Router::new()
        .route("/api/v1/entries", get(list_entries).post(create_entry))
        .route(
            "/api/v1/entries/:id",
            get(get_entry).delete(delete_entry),
        )
        .route("/api/v1/entries/:id/tags", post(add_entry_tag))
        .route("/api/v1/clipboard/write", post(write_clipboard))
        .route("/api/v1/clipboard/current", get(get_clipboard))
        .route("/api/v1/paste/:id", post(paste_entry_handler))
        .route("/api/v1/tags", get(list_tags))
        .route("/api/v1/templates", get(list_templates))
        .route("/api/v1/status", get(status))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            crate::http_api::auth::auth_middleware,
        ))
        .with_state(state)
}

pub struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: message.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: message.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        error_response(self.status, self.message)
    }
}

pub fn error_response(status: StatusCode, message: impl Into<String>) -> Response {
    (
        status,
        Json(json!({
            "success": false,
            "data": null,
            "error": message.into(),
        })),
    )
        .into_response()
}

type ApiResult = Result<Json<Value>, ApiError>;

fn ok(data: impl Serialize) -> Json<Value> {
    Json(json!({
        "success": true,
        "data": data,
        "error": null,
    }))
}

fn internal<T>(result: Result<T, String>) -> Result<T, ApiError> {
    result.map_err(ApiError::internal)
}

#[derive(Debug, Deserialize)]
struct ListParams {
    limit: Option<i64>,
    offset: Option<i64>,
    search: Option<String>,
    #[serde(rename = "type")]
    content_type: Option<String>,
}

async fn list_entries(
    State(state): State<ApiState>,
    Query(params): Query<ListParams>,
) -> ApiResult {
    let limit = params.limit.unwrap_or(50).clamp(1, 200);
    let offset = params.offset.unwrap_or(0).max(0);
    let entries = internal(state.db.get_history(
        limit,
        offset,
        params.content_type,
        params.search,
        None,
        false,
    ))?;
    Ok(ok(entries))
}

async fn get_entry(State(state): State<ApiState>, Path(id): Path<String>) -> ApiResult {
    let entry = internal(state.db.get_entry(&id))?
        .ok_or_else(|| ApiError::not_found("Entry not found"))?;
    Ok(ok(entry))
}

#[derive(Debug, Deserialize)]
struct CreateEntryBody {
    content: String,
    #[serde(default)]
    html: Option<String>,
    #[serde(default)]
    content_type: Option<String>,
}

async fn create_entry(
    State(state): State<ApiState>,
    Json(body): Json<CreateEntryBody>,
) -> ApiResult {
    if body.content.trim().is_empty() {
        return Err(ApiError::bad_request("Content must not be empty"));
    }

    let content_type = body
        .content_type
        .as_deref()
        .and_then(ContentType::from_str)
        .unwrap_or(ContentType::PlainText);
    let now = chrono::Utc::now().to_rfc3339();
    let device_id = state
        .db
        .get_setting("device_id")
        .ok()
        .flatten()
        .unwrap_or_else(|| "http-api".to_string());
    let entry = ClipboardEntry {
        id: uuid::Uuid::new_v4().to_string(),
        content_type,
        text_content: Some(body.content.clone()),
        html_content: body.html,
        blob_path: None,
        thumbnail_path: None,
        content_hash: compute_hash(body.content.as_bytes()),
        source_app: Some("HTTP API".to_string()),
        source_url: None,
        source_icon: None,
        device_id,
        is_favorite: false,
        is_pinned: false,
        tags: Vec::new(),
        created_at: now.clone(),
        updated_at: now,
        synced_at: None,
        sync_status: SyncStatus::Local,
        sync_version: 0,
        ai_summary: None,
        content_category: None,
        detected_language: None,
        file_meta: None,
        ocr_text: None,
        is_sensitive: false,
        sensitive_types: None,
        link_preview: None,
    };

    internal(state.db.insert_entry(&entry))?;
    let _ = state
        .app
        .emit("entry-updated", serde_json::json!({ "id": entry.id }));

    Ok(ok(entry))
}

async fn delete_entry(State(state): State<ApiState>, Path(id): Path<String>) -> ApiResult {
    internal(state.db.delete_entries(&[id.clone()]))?;
    let _ = state.app.emit("entry-updated", serde_json::json!({ "id": id }));
    Ok(ok(json!({ "deleted": true })))
}

#[derive(Debug, Deserialize)]
struct AddTagBody {
    tag: String,
}

async fn add_entry_tag(
    State(state): State<ApiState>,
    Path(id): Path<String>,
    Json(body): Json<AddTagBody>,
) -> ApiResult {
    let tag = body.tag.trim();
    if tag.is_empty() {
        return Err(ApiError::bad_request("Tag must not be empty"));
    }
    internal(state.db.add_tag(&id, tag))?;
    let _ = state.app.emit("entry-updated", serde_json::json!({ "id": id }));
    Ok(ok(json!({ "tagged": true })))
}

#[derive(Debug, Deserialize)]
struct WriteClipboardBody {
    text: String,
    #[serde(default)]
    paste: bool,
}

async fn write_clipboard(
    Json(body): Json<WriteClipboardBody>,
) -> ApiResult {
    if body.text.len() > 1024 * 1024 {
        return Err(ApiError::bad_request("Text is too large"));
    }

    if body.paste {
        simulator::paste_text(&body.text).map_err(ApiError::internal)?;
    } else {
        let mut clipboard = arboard::Clipboard::new()
            .map_err(|error| ApiError::internal(format!("Failed to open clipboard: {}", error)))?;
        clipboard
            .set_text(&body.text)
            .map_err(|error| ApiError::internal(format!("Failed to write clipboard: {}", error)))?;
    }

    Ok(ok(json!({ "written": true, "pasted": body.paste })))
}

async fn get_clipboard() -> ApiResult {
    let mut clipboard = arboard::Clipboard::new()
        .map_err(|error| ApiError::internal(format!("Failed to open clipboard: {}", error)))?;
    let text = clipboard.get_text().unwrap_or_default();
    Ok(ok(json!({ "text": text })))
}

async fn paste_entry_handler(
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> ApiResult {
    let entry = internal(state.db.get_entry(&id))?
        .ok_or_else(|| ApiError::not_found("Entry not found"))?;

    match entry.content_type {
        ContentType::PlainText | ContentType::RichText => {
            let text = entry
                .text_content
                .as_deref()
                .ok_or_else(|| ApiError::bad_request("No text content"))?;
            simulator::paste_text(text).map_err(ApiError::internal)?;
        }
        ContentType::FilePaths => {
            let text = entry
                .text_content
                .as_deref()
                .ok_or_else(|| ApiError::bad_request("No file paths"))?;
            let paths: Vec<&str> = text
                .lines()
                .map(str::trim)
                .filter(|path| !path.is_empty())
                .collect();
            if paths.is_empty() {
                return Err(ApiError::bad_request("No file paths"));
            }
            simulator::paste_files(&paths).map_err(ApiError::internal)?;
        }
        ContentType::Image => {
            let blob_path = entry
                .blob_path
                .as_deref()
                .ok_or_else(|| ApiError::bad_request("No image blob"))?;
            let full_path = state.blob_store.get_blob_path(blob_path);
            let full_path = full_path
                .to_str()
                .ok_or_else(|| ApiError::bad_request("Invalid image path"))?;
            simulator::paste_image(full_path).map_err(ApiError::internal)?;
        }
    }

    Ok(ok(json!({ "pasted": true })))
}

async fn list_tags(State(state): State<ApiState>) -> ApiResult {
    let tags = internal(state.db.get_all_tags())?;
    Ok(ok(tags))
}

async fn list_templates(State(state): State<ApiState>) -> ApiResult {
    let templates = internal(state.db.get_templates(None))?;
    Ok(ok(templates))
}

async fn status(State(state): State<ApiState>) -> ApiResult {
    let entries = state.db.get_entry_count().unwrap_or(0);
    Ok(ok(json!({
        "version": env!("CARGO_PKG_VERSION"),
        "entries": entries,
        "incognito": monitor::is_incognito(),
    })))
}
