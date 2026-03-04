use std::path::{Path, PathBuf};

pub struct BlobStore {
    base_dir: PathBuf,
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
}
