use crate::clipboard::entry::ClipboardEntry;
use crate::storage::blob::BlobStore;
use crate::storage::database::Database;
use super::adapters::CloudStorageAdapter;
use super::encryption::SyncEncryption;
use super::manifest::{ManifestEntry, SyncManifest};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub pushed: usize,
    pub pulled: usize,
    pub conflicts: usize,
    pub errors: Vec<String>,
}

pub struct SyncEngine {
    db: Arc<Database>,
    blob_store: Arc<BlobStore>,
    adapter: Box<dyn CloudStorageAdapter>,
    device_id: String,
    encryption: Option<SyncEncryption>,
}

impl SyncEngine {
    pub fn new(
        db: Arc<Database>,
        blob_store: Arc<BlobStore>,
        adapter: Box<dyn CloudStorageAdapter>,
        device_id: String,
        encryption: Option<SyncEncryption>,
    ) -> Self {
        Self { db, blob_store, adapter, device_id, encryption }
    }

    pub async fn sync(&self, last_sync_version: i64) -> Result<SyncResult, String> {
        let mut result = SyncResult {
            pushed: 0,
            pulled: 0,
            conflicts: 0,
            errors: vec![],
        };

        // Ensure remote directory structure
        let _ = self.adapter.mkdir("AlgerClipboard").await;
        let _ = self.adapter.mkdir("AlgerClipboard/entries").await;
        let _ = self.adapter.mkdir("AlgerClipboard/blobs").await;

        // Load or create remote manifest
        let remote_manifest = self.load_remote_manifest().await?;

        // Get local changes since last sync
        let local_changes = self.db.get_entries_since_version(last_sync_version)
            .map_err(|e| format!("Failed to get local changes: {}", e))?;

        // Push local changes
        for entry in &local_changes {
            match self.push_entry(entry).await {
                Ok(_) => {
                    result.pushed += 1;
                    let _ = self.db.increment_sync_version(&entry.id);
                    let _ = self.db.update_entry_sync_status(
                        &entry.id, "synced", &chrono::Utc::now().to_rfc3339()
                    );
                }
                Err(e) => result.errors.push(format!("Push {}: {}", entry.id, e)),
            }
        }

        // Pull remote changes
        for (entry_id, manifest_entry) in &remote_manifest.entries {
            if manifest_entry.deleted {
                continue;
            }
            // Check if we have this entry locally
            match self.db.get_entry(entry_id) {
                Ok(Some(local)) => {
                    // Conflict check: different hash and both modified
                    if local.content_hash != manifest_entry.content_hash
                        && local.sync_version > last_sync_version
                    {
                        // Conflict — mark local as conflict
                        let _ = self.db.update_entry_sync_status(
                            entry_id, "conflict", &chrono::Utc::now().to_rfc3339()
                        );
                        result.conflicts += 1;
                    } else if local.content_hash != manifest_entry.content_hash {
                        // Remote is newer, pull it
                        match self.pull_entry(entry_id).await {
                            Ok(_) => result.pulled += 1,
                            Err(e) => result.errors.push(format!("Pull {}: {}", entry_id, e)),
                        }
                    }
                }
                Ok(None) => {
                    // New remote entry, pull it
                    match self.pull_entry(entry_id).await {
                        Ok(_) => result.pulled += 1,
                        Err(e) => result.errors.push(format!("Pull {}: {}", entry_id, e)),
                    }
                }
                Err(e) => result.errors.push(format!("Check {}: {}", entry_id, e)),
            }
        }

        // Update remote manifest with our changes
        let mut updated_manifest = remote_manifest;
        for entry in &local_changes {
            updated_manifest.entries.insert(entry.id.clone(), ManifestEntry {
                content_hash: entry.content_hash.clone(),
                version: entry.sync_version,
                updated_at: entry.updated_at.clone(),
                deleted: false,
                has_blob: entry.blob_path.is_some(),
            });
        }
        updated_manifest.version += 1;
        updated_manifest.device_id = self.device_id.clone();
        updated_manifest.updated_at = chrono::Utc::now().to_rfc3339();

        self.save_remote_manifest(&updated_manifest).await?;

        Ok(result)
    }

    async fn load_remote_manifest(&self) -> Result<SyncManifest, String> {
        match self.adapter.download("AlgerClipboard/manifest.json").await {
            Ok(data) => {
                let json_data = if let Some(ref enc) = self.encryption {
                    // Try to parse as encrypted wrapper
                    if let Ok(wrapper) = serde_json::from_slice::<super::encryption::EncryptedManifestWrapper>(&data) {
                        if wrapper.encrypted {
                            enc.decrypt_from_storage(&wrapper)?
                        } else {
                            data
                        }
                    } else {
                        data
                    }
                } else {
                    data
                };
                SyncManifest::from_json(&json_data)
            }
            Err(_) => {
                // No manifest exists yet, create a new one
                Ok(SyncManifest::new(&self.device_id))
            }
        }
    }

    async fn save_remote_manifest(&self, manifest: &SyncManifest) -> Result<(), String> {
        let json = manifest.to_json()?;
        let data = if let Some(ref enc) = self.encryption {
            let salt = SyncEncryption::generate_salt();
            let wrapper = enc.encrypt_for_storage(&json, &salt)?;
            serde_json::to_vec_pretty(&wrapper)
                .map_err(|e| format!("Serialize wrapper: {}", e))?
        } else {
            json
        };
        self.adapter.upload("AlgerClipboard/manifest.json", &data).await
    }

    async fn push_entry(&self, entry: &ClipboardEntry) -> Result<(), String> {
        // Serialize entry metadata
        let entry_json = serde_json::to_vec_pretty(entry)
            .map_err(|e| format!("Serialize entry: {}", e))?;

        let entry_data = if let Some(ref enc) = self.encryption {
            enc.encrypt(&entry_json)?.ciphertext
        } else {
            entry_json
        };

        let remote_path = format!("AlgerClipboard/entries/{}.json", entry.id);
        self.adapter.upload(&remote_path, &entry_data).await?;

        // Upload blob if exists
        if let Some(ref blob_path) = entry.blob_path {
            if let Ok(blob_data) = std::fs::read(blob_path) {
                let blob_remote = format!("AlgerClipboard/blobs/{}.bin", entry.content_hash);
                let blob_upload = if let Some(ref enc) = self.encryption {
                    enc.encrypt(&blob_data)?.ciphertext
                } else {
                    blob_data
                };
                self.adapter.upload(&blob_remote, &blob_upload).await?;
            }
        }

        Ok(())
    }

    async fn pull_entry(&self, entry_id: &str) -> Result<(), String> {
        let remote_path = format!("AlgerClipboard/entries/{}.json", entry_id);
        let data = self.adapter.download(&remote_path).await?;

        let json_data = if let Some(ref enc) = self.encryption {
            enc.decrypt(&super::encryption::EncryptedPayload {
                nonce: data[..12].to_vec(),
                ciphertext: data[12..].to_vec(),
            }).unwrap_or(data)
        } else {
            data
        };

        let entry: ClipboardEntry = serde_json::from_slice(&json_data)
            .map_err(|e| format!("Deserialize entry: {}", e))?;

        // Download blob if it has one
        if entry.blob_path.is_some() {
            let blob_remote = format!("AlgerClipboard/blobs/{}.bin", entry.content_hash);
            if let Ok(blob_data) = self.adapter.download(&blob_remote).await {
                let blob_content = if let Some(ref enc) = self.encryption {
                    enc.decrypt(&super::encryption::EncryptedPayload {
                        nonce: blob_data[..12].to_vec(),
                        ciphertext: blob_data[12..].to_vec(),
                    }).unwrap_or(blob_data)
                } else {
                    blob_data
                };
                // Save blob locally
                let _ = self.blob_store.save_blob(&entry.id, &blob_content, "bin");
            }
        }

        // Insert into local database
        self.db.insert_entry(&entry)
            .map_err(|e| format!("Insert entry: {}", e))?;
        let _ = self.db.update_entry_sync_status(
            &entry.id, "synced", &chrono::Utc::now().to_rfc3339()
        );

        Ok(())
    }
}
