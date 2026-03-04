use std::path::{Path, PathBuf};

pub struct BlobStore {
    base_dir: PathBuf,
}

#[derive(serde::Serialize)]
pub struct CacheInfo {
    pub cache_dir: String,
    pub total_size_bytes: u64,
    pub file_count: u64,
    pub blob_count: u64,
    pub thumbnail_count: u64,
}

impl BlobStore {
    pub fn new(base_dir: &Path) -> Result<Self, String> {
        let blobs_dir = base_dir.join("blobs");
        let thumbnails_dir = base_dir.join("thumbnails");

        std::fs::create_dir_all(&blobs_dir)
            .map_err(|e| format!("Failed to create blobs dir: {}", e))?;
        std::fs::create_dir_all(&thumbnails_dir)
            .map_err(|e| format!("Failed to create thumbnails dir: {}", e))?;

        Ok(BlobStore {
            base_dir: base_dir.to_path_buf(),
        })
    }

    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }

    pub fn save_blob(&self, id: &str, data: &[u8], ext: &str) -> Result<String, String> {
        let relative_path = format!("blobs/{}.{}", id, ext);
        let full_path = self.base_dir.join(&relative_path);

        std::fs::write(&full_path, data)
            .map_err(|e| format!("Failed to save blob: {}", e))?;

        Ok(relative_path)
    }

    pub fn save_thumbnail(&self, id: &str, data: &[u8]) -> Result<String, String> {
        let relative_path = format!("thumbnails/{}.png", id);
        let full_path = self.base_dir.join(&relative_path);

        std::fs::write(&full_path, data)
            .map_err(|e| format!("Failed to save thumbnail: {}", e))?;

        Ok(relative_path)
    }

    pub fn get_blob_path(&self, relative_path: &str) -> PathBuf {
        self.base_dir.join(relative_path)
    }

    pub fn delete_blob(&self, relative_path: &str) -> Result<(), String> {
        let full_path = self.base_dir.join(relative_path);
        if full_path.exists() {
            std::fs::remove_file(&full_path)
                .map_err(|e| format!("Failed to delete blob: {}", e))?;
        }
        Ok(())
    }

    /// Get cache statistics
    pub fn get_cache_info(&self) -> Result<CacheInfo, String> {
        let blobs_dir = self.base_dir.join("blobs");
        let thumbs_dir = self.base_dir.join("thumbnails");

        let (blob_size, blob_count) = dir_stats(&blobs_dir);
        let (thumb_size, thumb_count) = dir_stats(&thumbs_dir);

        Ok(CacheInfo {
            cache_dir: self.base_dir.to_string_lossy().to_string(),
            total_size_bytes: blob_size + thumb_size,
            file_count: blob_count + thumb_count,
            blob_count,
            thumbnail_count: thumb_count,
        })
    }

    /// Delete blob and thumbnail files for given entry IDs
    pub fn delete_blobs_for_entries(&self, blob_paths: &[String], thumbnail_paths: &[String]) -> Result<u64, String> {
        let mut freed: u64 = 0;

        for bp in blob_paths {
            let full = self.base_dir.join(bp);
            if full.exists() {
                if let Ok(meta) = std::fs::metadata(&full) {
                    freed += meta.len();
                }
                let _ = std::fs::remove_file(&full);
            }
        }

        for tp in thumbnail_paths {
            let full = self.base_dir.join(tp);
            if full.exists() {
                if let Ok(meta) = std::fs::metadata(&full) {
                    freed += meta.len();
                }
                let _ = std::fs::remove_file(&full);
            }
        }

        Ok(freed)
    }

    /// Clean up orphaned files (blobs/thumbnails not referenced by any DB entry)
    pub fn cleanup_orphans(&self, known_blob_paths: &[String], known_thumb_paths: &[String]) -> Result<u64, String> {
        let mut freed: u64 = 0;

        // Clean orphan blobs
        let blobs_dir = self.base_dir.join("blobs");
        if let Ok(entries) = std::fs::read_dir(&blobs_dir) {
            for entry in entries.flatten() {
                let relative = format!("blobs/{}", entry.file_name().to_string_lossy());
                if !known_blob_paths.contains(&relative) {
                    if let Ok(meta) = entry.metadata() {
                        freed += meta.len();
                    }
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }

        // Clean orphan thumbnails
        let thumbs_dir = self.base_dir.join("thumbnails");
        if let Ok(entries) = std::fs::read_dir(&thumbs_dir) {
            for entry in entries.flatten() {
                let relative = format!("thumbnails/{}", entry.file_name().to_string_lossy());
                if !known_thumb_paths.contains(&relative) {
                    if let Ok(meta) = entry.metadata() {
                        freed += meta.len();
                    }
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }

        Ok(freed)
    }
}

fn dir_stats(dir: &Path) -> (u64, u64) {
    let mut size = 0u64;
    let mut count = 0u64;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    size += meta.len();
                    count += 1;
                }
            }
        }
    }
    (size, count)
}
