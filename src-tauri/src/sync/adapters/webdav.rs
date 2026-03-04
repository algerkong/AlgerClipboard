use super::{CloudStorageAdapter, RemoteFile};
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

    fn parse_propfind_response(&self, xml: &str, base_dir: &str) -> Vec<RemoteFile> {
        let mut files = Vec::new();

        // Split on <d:response> or <D:response> blocks
        let responses: Vec<&str> = xml.split("<d:response>")
            .chain(xml.split("<D:response>"))
            .collect();

        // Deduplicate: we get double results from the chained iterators
        // Instead, let's use a case-insensitive approach
        let response_blocks = split_response_blocks(xml);

        for block in response_blocks.iter().skip(1) {
            // Skip the first block (before the first <d:response>)
            let href = extract_tag_content(block, "href").unwrap_or_default();
            let content_length = extract_tag_content(block, "getcontentlength")
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);
            let last_modified = extract_tag_content(block, "getlastmodified");
            let is_collection = block.contains("<d:collection") || block.contains("<D:collection");

            // Skip the base directory itself
            let decoded_href = urlencoding::decode(&href).unwrap_or_else(|_| href.clone().into());
            let decoded_href = decoded_href.trim_end_matches('/');
            let base_trimmed = base_dir.trim_end_matches('/');

            if decoded_href == base_trimmed || href.trim_end_matches('/') == base_trimmed {
                continue;
            }

            // Extract the filename from href
            let path = decoded_href.split('/').last().unwrap_or("").to_string();
            if path.is_empty() {
                continue;
            }

            files.push(RemoteFile {
                path,
                size: content_length,
                modified: last_modified,
                is_dir: is_collection,
            });
        }

        let _ = responses; // suppress unused warning
        files
    }
}

/// Split XML into response blocks, handling both lowercase and uppercase DAV namespace prefixes.
fn split_response_blocks(xml: &str) -> Vec<String> {
    let mut blocks = Vec::new();
    let lower = xml.to_lowercase();
    let tag_open = "<d:response>";
    let tag_close = "</d:response>";

    let mut start = 0;
    while let Some(begin) = lower[start..].find(tag_open) {
        let abs_begin = start + begin;
        if let Some(end) = lower[abs_begin..].find(tag_close) {
            let abs_end = abs_begin + end + tag_close.len();
            blocks.push(xml[abs_begin..abs_end].to_string());
            start = abs_end;
        } else {
            break;
        }
    }
    blocks
}

/// Extract content from a DAV XML tag, handling both d: and D: prefixes.
fn extract_tag_content(block: &str, tag_name: &str) -> Option<String> {
    // Try d:tagname and D:tagname variants
    for prefix in &["d:", "D:", "lp1:", "lp2:", ""] {
        let open_tag = format!("<{}{}>", prefix, tag_name);
        let close_tag = format!("</{}{}>", prefix, tag_name);
        if let Some(start) = block.find(&open_tag) {
            let content_start = start + open_tag.len();
            if let Some(end) = block[content_start..].find(&close_tag) {
                return Some(block[content_start..content_start + end].to_string());
            }
        }
    }
    None
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

    async fn list(&self, remote_dir: &str) -> Result<Vec<RemoteFile>, String> {
        let url = self.url(remote_dir);
        let method = reqwest::Method::from_bytes(b"PROPFIND")
            .map_err(|e| format!("Invalid method: {}", e))?;

        let resp = self.client
            .request(method, &url)
            .basic_auth(&self.username, Some(&self.password))
            .header("Depth", "1")
            .send()
            .await
            .map_err(|e| format!("List failed: {}", e))?;

        if !resp.status().is_success() && resp.status().as_u16() != 207 {
            return Err(format!("List failed with status: {}", resp.status()));
        }

        let body = resp.text()
            .await
            .map_err(|e| format!("Read response failed: {}", e))?;

        Ok(self.parse_propfind_response(&body, &url))
    }

    async fn exists(&self, remote_path: &str) -> Result<bool, String> {
        let url = self.url(remote_path);
        let resp = self.client
            .head(&url)
            .basic_auth(&self.username, Some(&self.password))
            .send()
            .await
            .map_err(|e| format!("Exists check failed: {}", e))?;

        Ok(resp.status().is_success())
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
