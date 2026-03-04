use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ContentType {
    PlainText,
    RichText,
    Image,
    FilePaths,
}

impl ContentType {
    pub fn as_str(&self) -> &str {
        match self {
            ContentType::PlainText => "PlainText",
            ContentType::RichText => "RichText",
            ContentType::Image => "Image",
            ContentType::FilePaths => "FilePaths",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "PlainText" => Some(ContentType::PlainText),
            "RichText" => Some(ContentType::RichText),
            "Image" => Some(ContentType::Image),
            "FilePaths" => Some(ContentType::FilePaths),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SyncStatus {
    Local,
    Synced,
    PendingSync,
    Conflict,
}

impl SyncStatus {
    pub fn as_str(&self) -> &str {
        match self {
            SyncStatus::Local => "local",
            SyncStatus::Synced => "synced",
            SyncStatus::PendingSync => "pending",
            SyncStatus::Conflict => "conflict",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "synced" => SyncStatus::Synced,
            "pending" => SyncStatus::PendingSync,
            "conflict" => SyncStatus::Conflict,
            _ => SyncStatus::Local,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardEntry {
    pub id: String,
    pub content_type: ContentType,
    pub text_content: Option<String>,
    pub html_content: Option<String>,
    pub blob_path: Option<String>,
    pub thumbnail_path: Option<String>,
    pub content_hash: String,
    pub source_app: Option<String>,
    pub device_id: String,
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub synced_at: Option<String>,
    pub sync_status: SyncStatus,
    pub sync_version: i64,
}
