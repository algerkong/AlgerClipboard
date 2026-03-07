pub mod google_drive;
pub mod oauth;
pub mod onedrive;
pub mod webdav;

use async_trait::async_trait;

#[async_trait]
pub trait CloudStorageAdapter: Send + Sync {
    async fn test_connection(&self) -> Result<bool, String>;
    async fn upload(&self, remote_path: &str, data: &[u8]) -> Result<(), String>;
    async fn download(&self, remote_path: &str) -> Result<Vec<u8>, String>;
    async fn delete(&self, remote_path: &str) -> Result<(), String>;
    async fn mkdir(&self, remote_path: &str) -> Result<(), String>;
}
