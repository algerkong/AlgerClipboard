use super::CloudStorageAdapter;
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64,
}

pub struct GoogleDriveAdapter {
    client: Client,
    client_id: String,
    client_secret: String,
    tokens: Mutex<GoogleTokens>,
    /// Cache: folder path → Drive folder ID
    folder_cache: Mutex<HashMap<String, String>>,
}

impl GoogleDriveAdapter {
    pub fn new(client_id: &str, client_secret: &str, tokens: GoogleTokens) -> Self {
        Self {
            client: Client::new(),
            client_id: client_id.to_string(),
            client_secret: client_secret.to_string(),
            tokens: Mutex::new(tokens),
            folder_cache: Mutex::new(HashMap::new()),
        }
    }

    pub async fn exchange_code(client_id: &str, client_secret: &str, code: &str, redirect_uri: &str) -> Result<GoogleTokens, String> {
        let client = Client::new();
        let resp = client.post("https://oauth2.googleapis.com/token")
            .form(&[
                ("code", code),
                ("client_id", client_id),
                ("client_secret", client_secret),
                ("redirect_uri", redirect_uri),
                ("grant_type", "authorization_code"),
            ])
            .send()
            .await
            .map_err(|e| format!("Token exchange failed: {}", e))?;

        let body: serde_json::Value = resp.json().await
            .map_err(|e| format!("Parse error: {}", e))?;

        Ok(GoogleTokens {
            access_token: body["access_token"].as_str().unwrap_or("").to_string(),
            refresh_token: body["refresh_token"].as_str().unwrap_or("").to_string(),
            expires_at: chrono::Utc::now().timestamp() + body["expires_in"].as_i64().unwrap_or(3600),
        })
    }

    async fn ensure_token(&self) -> Result<String, String> {
        let tokens = self.tokens.lock().await;
        if chrono::Utc::now().timestamp() < tokens.expires_at - 60 {
            return Ok(tokens.access_token.clone());
        }
        let refresh_token = tokens.refresh_token.clone();
        drop(tokens);

        let resp = self.client.post("https://oauth2.googleapis.com/token")
            .form(&[
                ("refresh_token", refresh_token.as_str()),
                ("client_id", self.client_id.as_str()),
                ("client_secret", self.client_secret.as_str()),
                ("grant_type", "refresh_token"),
            ])
            .send()
            .await
            .map_err(|e| format!("Token refresh failed: {}", e))?;

        let body: serde_json::Value = resp.json().await
            .map_err(|e| format!("Parse error: {}", e))?;

        let new_access = body["access_token"].as_str().unwrap_or("").to_string();
        let expires_in = body["expires_in"].as_i64().unwrap_or(3600);

        let mut tokens = self.tokens.lock().await;
        tokens.access_token = new_access.clone();
        tokens.expires_at = chrono::Utc::now().timestamp() + expires_in;

        Ok(new_access)
    }

    /// Resolve a folder path like "AlgerClipboard/entries" to a Drive folder ID,
    /// creating folders as needed along the way.
    async fn resolve_folder_id(&self, folder_path: &str) -> Result<String, String> {
        let path = folder_path.trim_matches('/');

        // Check cache first
        {
            let cache = self.folder_cache.lock().await;
            if let Some(id) = cache.get(path) {
                return Ok(id.clone());
            }
        }

        let token = self.ensure_token().await?;
        let parts: Vec<&str> = path.split('/').collect();

        // Walk the path from root, resolving or creating each folder
        let mut parent_id = "root".to_string();
        let mut built_path = String::new();

        for part in &parts {
            if !built_path.is_empty() {
                built_path.push('/');
            }
            built_path.push_str(part);

            // Check cache for this sub-path
            {
                let cache = self.folder_cache.lock().await;
                if let Some(id) = cache.get(&built_path) {
                    parent_id = id.clone();
                    continue;
                }
            }

            // Search for folder with this name under parent
            let resp = self.client.get("https://www.googleapis.com/drive/v3/files")
                .bearer_auth(&token)
                .query(&[
                    ("q", &format!("name='{}' and '{}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false", part, parent_id)),
                    ("fields", &"files(id)".to_string()),
                ])
                .send()
                .await
                .map_err(|e| format!("Search folder failed: {}", e))?;

            let body: serde_json::Value = resp.json().await
                .map_err(|e| format!("Parse error: {}", e))?;

            let folder_id = if let Some(file) = body["files"].as_array().and_then(|a| a.first()) {
                file["id"].as_str().unwrap_or("").to_string()
            } else {
                // Create the folder
                let resp = self.client.post("https://www.googleapis.com/drive/v3/files")
                    .bearer_auth(&token)
                    .json(&serde_json::json!({
                        "name": part,
                        "mimeType": "application/vnd.google-apps.folder",
                        "parents": [parent_id]
                    }))
                    .send()
                    .await
                    .map_err(|e| format!("Create folder failed: {}", e))?;

                let body: serde_json::Value = resp.json().await
                    .map_err(|e| format!("Parse error: {}", e))?;
                body["id"].as_str().unwrap_or("").to_string()
            };

            self.folder_cache.lock().await.insert(built_path.clone(), folder_id.clone());
            parent_id = folder_id;
        }

        Ok(parent_id)
    }

    /// Get the parent folder ID for a file path.
    /// e.g. "AlgerClipboard/entries/abc.json" → folder ID of "AlgerClipboard/entries"
    async fn resolve_parent_folder(&self, remote_path: &str) -> Result<(String, String), String> {
        let path = remote_path.trim_matches('/');
        let parts: Vec<&str> = path.split('/').collect();
        let file_name = parts.last().unwrap_or(&path).to_string();
        let parent_path = if parts.len() > 1 {
            parts[..parts.len() - 1].join("/")
        } else {
            return Ok(("root".to_string(), file_name));
        };
        let parent_id = self.resolve_folder_id(&parent_path).await?;
        Ok((parent_id, file_name))
    }

    /// Find a file by name within a specific parent folder.
    async fn find_file_in_folder(&self, name: &str, parent_id: &str) -> Result<Option<String>, String> {
        let token = self.ensure_token().await?;
        let resp = self.client.get("https://www.googleapis.com/drive/v3/files")
            .bearer_auth(&token)
            .query(&[
                ("q", &format!("name='{}' and '{}' in parents and trashed=false", name, parent_id)),
                ("fields", &"files(id)".to_string()),
            ])
            .send()
            .await
            .map_err(|e| format!("Search failed: {}", e))?;

        let body: serde_json::Value = resp.json().await
            .map_err(|e| format!("Parse error: {}", e))?;

        Ok(body["files"].as_array()
            .and_then(|a| a.first())
            .and_then(|f| f["id"].as_str())
            .map(|s| s.to_string()))
    }
}

#[async_trait]
impl CloudStorageAdapter for GoogleDriveAdapter {
    async fn test_connection(&self) -> Result<bool, String> {
        let token = self.ensure_token().await?;
        let resp = self.client.get("https://www.googleapis.com/drive/v3/about")
            .bearer_auth(&token)
            .query(&[("fields", "user")])
            .send()
            .await
            .map_err(|e| format!("Test failed: {}", e))?;
        Ok(resp.status().is_success())
    }

    async fn upload(&self, remote_path: &str, data: &[u8]) -> Result<(), String> {
        let token = self.ensure_token().await?;
        let (parent_id, file_name) = self.resolve_parent_folder(remote_path).await?;

        // Check if file already exists in the correct folder
        if let Some(file_id) = self.find_file_in_folder(&file_name, &parent_id).await? {
            // Update existing file
            let resp = self.client.patch(&format!("https://www.googleapis.com/upload/drive/v3/files/{}?uploadType=media", file_id))
                .bearer_auth(&token)
                .header("Content-Type", "application/octet-stream")
                .body(data.to_vec())
                .send()
                .await
                .map_err(|e| format!("Upload failed: {}", e))?;
            if !resp.status().is_success() {
                return Err(format!("Upload update failed: {}", resp.status()));
            }
        } else {
            // Create new file
            let boundary = "alger_boundary_12345";
            let metadata = serde_json::json!({ "name": file_name, "parents": [parent_id] });
            let header = format!(
                "--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{}\r\n--{boundary}\r\nContent-Type: application/octet-stream\r\n\r\n",
                metadata, boundary = boundary
            );
            let mut full_body = header.into_bytes();
            full_body.extend_from_slice(data);
            full_body.extend_from_slice(format!("\r\n--{}--", boundary).as_bytes());

            let resp = self.client.post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
                .bearer_auth(&token)
                .header("Content-Type", format!("multipart/related; boundary={}", boundary))
                .body(full_body)
                .send()
                .await
                .map_err(|e| format!("Upload failed: {}", e))?;
            if !resp.status().is_success() {
                return Err(format!("Upload create failed: {}", resp.status()));
            }
        }
        Ok(())
    }

    async fn download(&self, remote_path: &str) -> Result<Vec<u8>, String> {
        let (parent_id, file_name) = self.resolve_parent_folder(remote_path).await?;
        let file_id = self.find_file_in_folder(&file_name, &parent_id).await?
            .ok_or_else(|| format!("File not found: {}", remote_path))?;
        let token = self.ensure_token().await?;

        let resp = self.client.get(&format!("https://www.googleapis.com/drive/v3/files/{}?alt=media", file_id))
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| format!("Download failed: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Download failed: {}", resp.status()));
        }

        resp.bytes().await
            .map(|b| b.to_vec())
            .map_err(|e| format!("Read failed: {}", e))
    }

    async fn delete(&self, remote_path: &str) -> Result<(), String> {
        let (parent_id, file_name) = self.resolve_parent_folder(remote_path).await?;
        if let Some(file_id) = self.find_file_in_folder(&file_name, &parent_id).await? {
            let token = self.ensure_token().await?;
            self.client.delete(&format!("https://www.googleapis.com/drive/v3/files/{}", file_id))
                .bearer_auth(&token)
                .send()
                .await
                .map_err(|e| format!("Delete failed: {}", e))?;
        }
        Ok(())
    }

    async fn mkdir(&self, remote_path: &str) -> Result<(), String> {
        self.resolve_folder_id(remote_path).await?;
        Ok(())
    }
}
