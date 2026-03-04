pub mod webdav;
pub mod google_drive;
pub mod onedrive;
pub mod oauth;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteFile {
    pub path: String,
    pub size: u64,
    pub modified: Option<String>,
    pub is_dir: bool,
}

#[async_trait]
pub trait CloudStorageAdapter: Send + Sync {
    async fn test_connection(&self) -> Result<bool, String>;
    async fn upload(&self, remote_path: &str, data: &[u8]) -> Result<(), String>;
    async fn download(&self, remote_path: &str) -> Result<Vec<u8>, String>;
    async fn delete(&self, remote_path: &str) -> Result<(), String>;
    async fn list(&self, remote_dir: &str) -> Result<Vec<RemoteFile>, String>;
    async fn exists(&self, remote_path: &str) -> Result<bool, String>;
    async fn mkdir(&self, remote_path: &str) -> Result<(), String>;
}
