use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileType {
    Image,
    Video,
    Audio,
    Document,
    Archive,
    Code,
    Executable,
    Font,
    Data,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMeta {
    pub path: String,
    pub name: String,
    pub extension: Option<String>,
    pub size: u64,
    pub is_dir: bool,
    pub modified: Option<i64>,
    pub file_type: FileType,
    pub child_count: Option<u32>,
}

pub fn classify_extension(ext: &str) -> FileType {
    match ext.to_ascii_lowercase().as_str() {
        // Image
        "png" | "jpg" | "jpeg" | "gif" | "bmp" | "svg" | "webp" | "ico" | "tiff" | "tif" => {
            FileType::Image
        }
        // Video
        "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" | "webm" | "m4v" => FileType::Video,
        // Audio
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" | "m4a" => FileType::Audio,
        // Document
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "rtf" | "odt"
        | "ods" | "odp" => FileType::Document,
        // Archive
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "zst" => FileType::Archive,
        // Code
        "rs" | "js" | "ts" | "tsx" | "jsx" | "py" | "java" | "c" | "cpp" | "h" | "hpp" | "go"
        | "rb" | "php" | "swift" | "kt" | "cs" | "html" | "css" | "scss" | "less" | "vue"
        | "svelte" | "sh" | "bash" | "zsh" | "ps1" | "bat" | "cmd" => FileType::Code,
        // Executable
        "exe" | "msi" | "com" | "app" | "dmg" => FileType::Executable,
        // Font
        "ttf" | "otf" | "woff" | "woff2" | "eot" => FileType::Font,
        // Data
        "json" | "xml" | "yaml" | "yml" | "csv" | "sql" | "db" | "sqlite" | "toml" | "ini"
        | "cfg" | "conf" | "log" => FileType::Data,
        // Other
        _ => FileType::Other,
    }
}

pub fn collect_file_meta(path: &str) -> Option<FileMeta> {
    let p = std::path::Path::new(path);
    let metadata = std::fs::metadata(p).ok()?;

    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let extension = p.extension().map(|e| e.to_string_lossy().to_string());

    let size = metadata.len();
    let is_dir = metadata.is_dir();

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64);

    let file_type = if is_dir {
        FileType::Other
    } else {
        extension
            .as_deref()
            .map(classify_extension)
            .unwrap_or(FileType::Other)
    };

    let child_count = if is_dir {
        std::fs::read_dir(p)
            .ok()
            .map(|entries| entries.count() as u32)
    } else {
        None
    };

    Some(FileMeta {
        path: path.to_string(),
        name,
        extension,
        size,
        is_dir,
        modified,
        file_type,
        child_count,
    })
}

pub fn collect_all_meta(paths: &[String]) -> Vec<FileMeta> {
    paths.iter().filter_map(|p| collect_file_meta(p)).collect()
}
