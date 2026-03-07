use super::adapters::CloudStorageAdapter;
use super::encryption::SyncEncryption;
use super::manifest::{ManifestEntry, SyncManifest};
use crate::clipboard::entry::ClipboardEntry;
use crate::storage::blob::BlobStore;
use crate::storage::database::Database;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Settings keys that are safe to sync across devices
const SYNCABLE_SETTINGS: &[&str] = &[
    "theme",
    "max_history",
    "expire_days",
    "paste_and_close",
    "locale",
    "ui_scale",
    "font_family",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsSyncResult {
    pub pushed: usize,
    pub pulled: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub pushed: usize,
    pub pulled: usize,
    pub conflicts: usize,
    pub errors: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settings_pushed: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settings_pulled: Option<usize>,
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
        Self {
            db,
            blob_store,
            adapter,
            device_id,
            encryption,
        }
    }

    pub async fn sync(&self, last_sync_version: i64) -> Result<SyncResult, String> {
        let mut result = SyncResult {
            pushed: 0,
            pulled: 0,
            conflicts: 0,
            errors: vec![],
            settings_pushed: None,
            settings_pulled: None,
        };

        // Ensure remote directory structure
        let _ = self.adapter.mkdir("AlgerClipboard").await;
        let _ = self.adapter.mkdir("AlgerClipboard/entries").await;
        let _ = self.adapter.mkdir("AlgerClipboard/blobs").await;

        // Load or create remote manifest
        let remote_manifest = self.load_remote_manifest().await?;

        // Get local changes since last sync
        let local_changes = self
            .db
            .get_entries_since_version(last_sync_version)
            .map_err(|e| format!("Failed to get local changes: {}", e))?;

        // Push local changes
        for entry in &local_changes {
            match self.push_entry(entry).await {
                Ok(_) => {
                    result.pushed += 1;
                    let _ = self.db.increment_sync_version(&entry.id);
                    let _ = self.db.update_entry_sync_status(
                        &entry.id,
                        "synced",
                        &chrono::Utc::now().to_rfc3339(),
                    );
                }
                Err(e) => result.errors.push(format!("Push {}: {}", entry.id, e)),
            }
        }

        // Pull remote changes
        for (entry_id, manifest_entry) in &remote_manifest.entries {
            if manifest_entry.deleted {
                // Remote says this entry was deleted — ensure it's deleted locally too
                let _ = self.db.delete_entries(&[entry_id.clone()]);
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
                            entry_id,
                            "conflict",
                            &chrono::Utc::now().to_rfc3339(),
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
                    // Entry not found with deleted=0; check if it was soft-deleted locally
                    if self.db.entry_exists(entry_id).unwrap_or(false) {
                        // Entry exists but is deleted locally — don't pull it back
                        continue;
                    }
                    // Genuinely new remote entry, pull it
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
            updated_manifest.entries.insert(
                entry.id.clone(),
                ManifestEntry {
                    content_hash: entry.content_hash.clone(),
                    version: entry.sync_version,
                    updated_at: entry.updated_at.clone(),
                    deleted: false,
                    has_blob: entry.blob_path.is_some(),
                },
            );
        }

        // Propagate local deletions to remote manifest
        let deleted_ids = self.db.get_deleted_synced_entry_ids().unwrap_or_default();
        for id in &deleted_ids {
            if let Some(manifest_entry) = updated_manifest.entries.get_mut(id) {
                manifest_entry.deleted = true;
            } else {
                // Entry was synced before but missing from manifest — add as deleted
                updated_manifest.entries.insert(
                    id.clone(),
                    ManifestEntry {
                        content_hash: String::new(),
                        version: 0,
                        updated_at: chrono::Utc::now().to_rfc3339(),
                        deleted: true,
                        has_blob: false,
                    },
                );
            }
            // Clean up remote entry file
            let remote_path = format!("AlgerClipboard/entries/{}.json", id);
            let _ = self.adapter.delete(&remote_path).await;
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
                    if let Ok(wrapper) =
                        serde_json::from_slice::<super::encryption::EncryptedManifestWrapper>(&data)
                    {
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
            serde_json::to_vec_pretty(&wrapper).map_err(|e| format!("Serialize wrapper: {}", e))?
        } else {
            json
        };
        self.adapter
            .upload("AlgerClipboard/manifest.json", &data)
            .await
    }

    async fn push_entry(&self, entry: &ClipboardEntry) -> Result<(), String> {
        // Serialize entry metadata
        let entry_json =
            serde_json::to_vec_pretty(entry).map_err(|e| format!("Serialize entry: {}", e))?;

        let entry_data = if let Some(ref enc) = self.encryption {
            enc.encrypt(&entry_json)?.ciphertext
        } else {
            entry_json
        };

        let remote_path = format!("AlgerClipboard/entries/{}.json", entry.id);
        self.adapter.upload(&remote_path, &entry_data).await?;

        // Upload blob if exists (check file size limit)
        if let Some(ref blob_path) = entry.blob_path {
            let full_path = self.blob_store.get_blob_path(blob_path);
            if let Ok(blob_data) = std::fs::read(&full_path) {
                // Check sync file size limit
                let max_file_mb = self
                    .db
                    .get_setting("sync_max_file_size_mb")
                    .ok()
                    .flatten()
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(0);

                let skip_blob =
                    max_file_mb > 0 && blob_data.len() as u64 > max_file_mb * 1024 * 1024;

                if !skip_blob {
                    let blob_remote = format!("AlgerClipboard/blobs/{}.bin", entry.content_hash);
                    let blob_upload = if let Some(ref enc) = self.encryption {
                        enc.encrypt(&blob_data)?.ciphertext
                    } else {
                        blob_data
                    };
                    self.adapter.upload(&blob_remote, &blob_upload).await?;
                }
            }
        }

        Ok(())
    }

    /// Sync settings: merge remote settings with local, remote wins on conflict
    pub async fn sync_settings(&self) -> Result<SettingsSyncResult, String> {
        let _ = self.adapter.mkdir("AlgerClipboard").await;

        // Load remote settings
        let remote_settings: std::collections::HashMap<String, String> =
            match self.adapter.download("AlgerClipboard/settings.json").await {
                Ok(data) => {
                    let json_data = if let Some(ref enc) = self.encryption {
                        if let Ok(wrapper) = serde_json::from_slice::<
                            super::encryption::EncryptedManifestWrapper,
                        >(&data)
                        {
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
                    serde_json::from_slice(&json_data).unwrap_or_default()
                }
                Err(_) => std::collections::HashMap::new(),
            };

        // Load local syncable settings
        let mut local_settings = std::collections::HashMap::new();
        for key in SYNCABLE_SETTINGS {
            if let Ok(Some(val)) = self.db.get_setting(key) {
                local_settings.insert(key.to_string(), val);
            }
        }

        // Merge: remote overrides local
        let mut pulled = 0usize;
        for (key, remote_val) in &remote_settings {
            if !SYNCABLE_SETTINGS.contains(&key.as_str()) {
                continue;
            }
            let local_val = local_settings.get(key);
            if local_val.map(|v| v.as_str()) != Some(remote_val.as_str()) {
                let _ = self.db.set_setting(key, remote_val);
                local_settings.insert(key.clone(), remote_val.clone());
                pulled += 1;
            }
        }

        // Push merged settings (local settings that remote doesn't have)
        let mut pushed = 0usize;
        for (key, _) in &local_settings {
            if !remote_settings.contains_key(key) {
                pushed += 1;
            }
        }

        // Save merged settings to remote
        let merged_json = serde_json::to_vec_pretty(&local_settings)
            .map_err(|e| format!("Serialize settings: {}", e))?;
        let upload_data = if let Some(ref enc) = self.encryption {
            let salt = SyncEncryption::generate_salt();
            let wrapper = enc.encrypt_for_storage(&merged_json, &salt)?;
            serde_json::to_vec_pretty(&wrapper).map_err(|e| format!("Serialize wrapper: {}", e))?
        } else {
            merged_json
        };
        self.adapter
            .upload("AlgerClipboard/settings.json", &upload_data)
            .await?;

        Ok(SettingsSyncResult { pushed, pulled })
    }

    async fn pull_entry(&self, entry_id: &str) -> Result<(), String> {
        let remote_path = format!("AlgerClipboard/entries/{}.json", entry_id);
        let data = self.adapter.download(&remote_path).await?;

        let json_data = if let Some(ref enc) = self.encryption {
            enc.decrypt(&super::encryption::EncryptedPayload {
                nonce: data[..12].to_vec(),
                ciphertext: data[12..].to_vec(),
            })
            .unwrap_or(data)
        } else {
            data
        };

        let entry: ClipboardEntry =
            serde_json::from_slice(&json_data).map_err(|e| format!("Deserialize entry: {}", e))?;

        // Download blob if it has one
        if entry.blob_path.is_some() {
            let blob_remote = format!("AlgerClipboard/blobs/{}.bin", entry.content_hash);
            if let Ok(blob_data) = self.adapter.download(&blob_remote).await {
                let blob_content = if let Some(ref enc) = self.encryption {
                    enc.decrypt(&super::encryption::EncryptedPayload {
                        nonce: blob_data[..12].to_vec(),
                        ciphertext: blob_data[12..].to_vec(),
                    })
                    .unwrap_or(blob_data)
                } else {
                    blob_data
                };
                // Save blob locally
                let _ = self.blob_store.save_blob(&entry.id, &blob_content, "bin");
            }
        }

        // Insert into local database
        self.db
            .insert_entry(&entry)
            .map_err(|e| format!("Insert entry: {}", e))?;
        let _ =
            self.db
                .update_entry_sync_status(&entry.id, "synced", &chrono::Utc::now().to_rfc3339());

        Ok(())
    }
}
