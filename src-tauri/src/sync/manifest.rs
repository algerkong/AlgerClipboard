use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncManifest {
    pub version: i64,
    pub device_id: String,
    pub updated_at: String,
    pub entries: HashMap<String, ManifestEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestEntry {
    pub content_hash: String,
    pub version: i64,
    pub updated_at: String,
    pub deleted: bool,
    pub has_blob: bool,
}

impl SyncManifest {
    pub fn new(device_id: &str) -> Self {
        Self {
            version: 0,
            device_id: device_id.to_string(),
            updated_at: chrono::Utc::now().to_rfc3339(),
            entries: HashMap::new(),
        }
    }

    pub fn to_json(&self) -> Result<Vec<u8>, String> {
        serde_json::to_vec_pretty(self)
            .map_err(|e| format!("Serialize manifest failed: {}", e))
    }

    pub fn from_json(data: &[u8]) -> Result<Self, String> {
        serde_json::from_slice(data)
            .map_err(|e| format!("Deserialize manifest failed: {}", e))
    }
}
