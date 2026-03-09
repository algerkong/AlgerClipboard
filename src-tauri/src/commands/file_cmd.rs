use crate::clipboard::file_meta;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilePreview {
    pub content: String,
    pub size: u64,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirTreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub children: Option<Vec<DirTreeNode>>,
}

#[tauri::command]
pub fn read_file_preview(path: String, max_bytes: Option<usize>) -> Result<FilePreview, String> {
    let max = max_bytes.unwrap_or(100 * 1024); // default 100KB
    let p = Path::new(&path);

    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    if p.is_dir() {
        return Err("Cannot preview a directory".to_string());
    }

    let metadata = fs::metadata(p).map_err(|e| format!("Failed to read metadata: {}", e))?;
    let size = metadata.len();

    let bytes = if size as usize > max {
        let mut file = fs::File::open(p).map_err(|e| format!("Failed to open file: {}", e))?;
        let mut buf = vec![0u8; max];
        use std::io::Read;
        file.read_exact(&mut buf)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        buf
    } else {
        fs::read(p).map_err(|e| format!("Failed to read file: {}", e))?
    };

    let truncated = size as usize > max;
    let content = String::from_utf8_lossy(&bytes).to_string();

    Ok(FilePreview {
        content,
        size,
        truncated,
    })
}

fn build_tree(path: &Path, current_depth: u32, max_depth: u32) -> Result<DirTreeNode, String> {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    let metadata =
        fs::metadata(path).map_err(|e| format!("Failed to read metadata for {:?}: {}", path, e))?;
    let is_dir = metadata.is_dir();
    let size = metadata.len();

    let children = if is_dir && current_depth < max_depth {
        let mut entries: Vec<DirTreeNode> = Vec::new();
        let read_dir = fs::read_dir(path)
            .map_err(|e| format!("Failed to read directory {:?}: {}", path, e))?;
        for entry in read_dir {
            if let Ok(entry) = entry {
                if let Ok(child) = build_tree(&entry.path(), current_depth + 1, max_depth) {
                    entries.push(child);
                }
            }
        }
        entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
        Some(entries)
    } else if is_dir {
        // At max depth, indicate it's a directory but don't recurse
        Some(Vec::new())
    } else {
        None
    };

    Ok(DirTreeNode {
        name,
        path: path.to_string_lossy().to_string(),
        is_dir,
        size,
        children,
    })
}

#[tauri::command]
pub fn get_directory_tree(path: String, max_depth: Option<u32>) -> Result<DirTreeNode, String> {
    let max = max_depth.unwrap_or(3);
    let p = Path::new(&path);

    if !p.exists() {
        return Err(format!("Path not found: {}", path));
    }
    if !p.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    build_tree(p, 0, max)
}

#[tauri::command]
pub fn open_file_default(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn open_in_file_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("Failed to open explorer: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        let parent = Path::new(&path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or(path);
        std::process::Command::new("xdg-open")
            .arg(&parent)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn collect_file_metas(paths: Vec<String>) -> Vec<file_meta::FileMeta> {
    file_meta::collect_all_meta(&paths)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveEntry {
    pub name: String,
    pub size: u64,
    pub compressed_size: u64,
    pub is_dir: bool,
}

#[tauri::command]
pub fn list_archive_contents(path: String) -> Result<Vec<ArchiveEntry>, String> {
    let file = fs::File::open(&path).map_err(|e| format!("Failed to open archive: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read archive: {}", e))?;

    let mut entries = Vec::new();
    for i in 0..archive.len() {
        let file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read entry: {}", e))?;
        entries.push(ArchiveEntry {
            name: file.name().to_string(),
            size: file.size(),
            compressed_size: file.compressed_size(),
            is_dir: file.is_dir(),
        });
    }
    Ok(entries)
}

#[tauri::command]
pub fn check_paths_exist(paths: Vec<String>) -> Vec<bool> {
    paths.iter().map(|p| Path::new(p).exists()).collect()
}

#[tauri::command]
pub async fn ocr_from_file_path(
    app: tauri::AppHandle,
    db: State<'_, crate::commands::clipboard_cmd::AppDatabase>,
    path: String,
) -> Result<crate::ocr::OcrResult, String> {
    let image_data =
        std::fs::read(&path).map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
    crate::commands::ocr_cmd::run_ocr_with_app(&app, &db, image_data, None).await
}
