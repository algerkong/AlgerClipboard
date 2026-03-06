use super::CloudStorageAdapter;
use async_trait::async_trait;
use reqwest::Client;

pub struct WebDavAdapter {
    client: Client,
    base_url: String,
    username: String,
    password: String,
}

impl WebDavAdapter {
    pub fn new(base_url: &str, username: &str, password: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            username: username.to_string(),
            password: password.to_string(),
        }
    }

    fn url(&self, path: &str) -> String {
        let path = path.trim_start_matches('/');
        if path.is_empty() {
            self.base_url.clone()
        } else {
            format!("{}/{}", self.base_url, path)
        }
    }

}

#[async_trait]
impl CloudStorageAdapter for WebDavAdapter {
    async fn test_connection(&self) -> Result<bool, String> {
        let method = reqwest::Method::from_bytes(b"PROPFIND")
            .map_err(|e| format!("Invalid method: {}", e))?;

        let resp = self.client
            .request(method, &self.base_url)
            .basic_auth(&self.username, Some(&self.password))
            .header("Depth", "0")
            .send()
            .await
            .map_err(|e| format!("Connection test failed: {}", e))?;

        Ok(resp.status().is_success() || resp.status().as_u16() == 207)
    }

    async fn upload(&self, remote_path: &str, data: &[u8]) -> Result<(), String> {
        let url = self.url(remote_path);
        let resp = self.client
            .put(&url)
            .basic_auth(&self.username, Some(&self.password))
            .header("Content-Type", "application/octet-stream")
            .body(data.to_vec())
            .send()
            .await
            .map_err(|e| format!("Upload failed: {}", e))?;

        if resp.status().is_success() || resp.status().as_u16() == 201 || resp.status().as_u16() == 204 {
            Ok(())
        } else {
            Err(format!("Upload failed with status: {}", resp.status()))
        }
    }

    async fn download(&self, remote_path: &str) -> Result<Vec<u8>, String> {
        let url = self.url(remote_path);
        let resp = self.client
            .get(&url)
            .basic_auth(&self.username, Some(&self.password))
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
        let url = self.url(remote_path);
        let resp = self.client
            .delete(&url)
            .basic_auth(&self.username, Some(&self.password))
            .send()
            .await
            .map_err(|e| format!("Delete failed: {}", e))?;

        if resp.status().is_success() || resp.status().as_u16() == 204 || resp.status().as_u16() == 404 {
            Ok(())
        } else {
            Err(format!("Delete failed with status: {}", resp.status()))
        }
    }

    async fn mkdir(&self, remote_path: &str) -> Result<(), String> {
        let url = self.url(remote_path);
        let method = reqwest::Method::from_bytes(b"MKCOL")
            .map_err(|e| format!("Invalid method: {}", e))?;

        let resp = self.client
            .request(method, &url)
            .basic_auth(&self.username, Some(&self.password))
            .send()
            .await
            .map_err(|e| format!("Mkdir failed: {}", e))?;

        if resp.status().is_success() || resp.status().as_u16() == 201 || resp.status().as_u16() == 405 {
            // 405 means directory already exists on some WebDAV servers
            Ok(())
        } else {
            Err(format!("Mkdir failed with status: {}", resp.status()))
        }
    }
}
