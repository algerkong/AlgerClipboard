use super::CloudStorageAdapter;
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OneDriveTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64,
}

pub struct OneDriveAdapter {
    client: Client,
    client_id: String,
    tokens: Mutex<OneDriveTokens>,
}

impl OneDriveAdapter {
    pub fn new(client_id: &str, tokens: OneDriveTokens) -> Self {
        Self {
            client: Client::new(),
            client_id: client_id.to_string(),
            tokens: Mutex::new(tokens),
        }
    }

    pub async fn exchange_code(
        client_id: &str,
        code: &str,
        redirect_uri: &str,
    ) -> Result<OneDriveTokens, String> {
        let client = Client::new();
        let resp = client
            .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
            .form(&[
                ("code", code),
                ("client_id", client_id),
                ("redirect_uri", redirect_uri),
                ("grant_type", "authorization_code"),
                ("scope", "Files.ReadWrite.All offline_access"),
            ])
            .send()
            .await
            .map_err(|e| format!("Token exchange failed: {}", e))?;

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("Parse error: {}", e))?;

        Ok(OneDriveTokens {
            access_token: body["access_token"].as_str().unwrap_or("").to_string(),
            refresh_token: body["refresh_token"].as_str().unwrap_or("").to_string(),
            expires_at: chrono::Utc::now().timestamp()
                + body["expires_in"].as_i64().unwrap_or(3600),
        })
    }

    async fn ensure_token(&self) -> Result<String, String> {
        let tokens = self.tokens.lock().await;
        if chrono::Utc::now().timestamp() < tokens.expires_at - 60 {
            return Ok(tokens.access_token.clone());
        }
        let refresh_token = tokens.refresh_token.clone();
        drop(tokens);

        let resp = self
            .client
            .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
            .form(&[
                ("refresh_token", refresh_token.as_str()),
                ("client_id", self.client_id.as_str()),
                ("grant_type", "refresh_token"),
                ("scope", "Files.ReadWrite.All offline_access"),
            ])
            .send()
            .await
            .map_err(|e| format!("Token refresh failed: {}", e))?;

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("Parse error: {}", e))?;

        let new_access = body["access_token"].as_str().unwrap_or("").to_string();
        let expires_in = body["expires_in"].as_i64().unwrap_or(3600);

        let mut tokens = self.tokens.lock().await;
        tokens.access_token = new_access.clone();
        tokens.expires_at = chrono::Utc::now().timestamp() + expires_in;
        if let Some(rt) = body["refresh_token"].as_str() {
            tokens.refresh_token = rt.to_string();
        }

        Ok(new_access)
    }

    fn graph_path(&self, remote_path: &str) -> String {
        let path = remote_path.trim_start_matches('/');
        format!(
            "https://graph.microsoft.com/v1.0/me/drive/root:/AlgerClipboard/{}:",
            path
        )
    }
}

#[async_trait]
impl CloudStorageAdapter for OneDriveAdapter {
    async fn test_connection(&self) -> Result<bool, String> {
        let token = self.ensure_token().await?;
        let resp = self
            .client
            .get("https://graph.microsoft.com/v1.0/me/drive")
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| format!("Test failed: {}", e))?;
        Ok(resp.status().is_success())
    }

    async fn upload(&self, remote_path: &str, data: &[u8]) -> Result<(), String> {
        let token = self.ensure_token().await?;
        let url = format!(
            "{}/content",
            self.graph_path(remote_path).trim_end_matches(':')
        );
        let resp = self
            .client
            .put(&url)
            .bearer_auth(&token)
            .header("Content-Type", "application/octet-stream")
            .body(data.to_vec())
            .send()
            .await
            .map_err(|e| format!("Upload failed: {}", e))?;
        if resp.status().is_success() || resp.status().as_u16() == 201 {
            Ok(())
        } else {
            Err(format!("Upload failed with status: {}", resp.status()))
        }
    }

    async fn download(&self, remote_path: &str) -> Result<Vec<u8>, String> {
        let token = self.ensure_token().await?;
        let url = format!(
            "{}/content",
            self.graph_path(remote_path).trim_end_matches(':')
        );
        let resp = self
            .client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| format!("Download failed: {}", e))?;
        if !resp.status().is_success() {
            return Err(format!("Download failed with status: {}", resp.status()));
        }
        resp.bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| format!("Read failed: {}", e))
    }

    async fn delete(&self, remote_path: &str) -> Result<(), String> {
        let token = self.ensure_token().await?;
        let url = self.graph_path(remote_path);
        let resp = self
            .client
            .delete(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| format!("Delete failed: {}", e))?;
        if resp.status().is_success()
            || resp.status().as_u16() == 204
            || resp.status().as_u16() == 404
        {
            Ok(())
        } else {
            Err(format!("Delete failed with status: {}", resp.status()))
        }
    }

    async fn mkdir(&self, remote_path: &str) -> Result<(), String> {
        let token = self.ensure_token().await?;
        let name = remote_path
            .trim_start_matches('/')
            .split('/')
            .last()
            .unwrap_or("AlgerClipboard");
        let resp = self
            .client
            .post("https://graph.microsoft.com/v1.0/me/drive/root/children")
            .bearer_auth(&token)
            .json(&serde_json::json!({
                "name": name,
                "folder": {},
                "@microsoft.graph.conflictBehavior": "rename"
            }))
            .send()
            .await
            .map_err(|e| format!("Mkdir failed: {}", e))?;
        if resp.status().is_success()
            || resp.status().as_u16() == 201
            || resp.status().as_u16() == 409
        {
            Ok(())
        } else {
            Err(format!("Mkdir failed with status: {}", resp.status()))
        }
    }
}
