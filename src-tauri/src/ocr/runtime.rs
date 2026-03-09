use crate::commands::clipboard_cmd::AppDatabase;
use chrono::Utc;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

const DEFAULT_MANIFEST_URLS: [&str; 2] = [
    "https://github.com/algerkong/AlgerClipboard/releases/latest/download/rapidocr-manifest.json",
    "https://mirror.ghproxy.com/https://github.com/algerkong/AlgerClipboard/releases/latest/download/rapidocr-manifest.json",
];
const STATUS_FILE_NAME: &str = "current.json";
const LOCK_FILE_NAME: &str = "installing.json";
const MANIFEST_TIMEOUT_SECS: u64 = 12;
const ARTIFACT_TIMEOUT_SECS: u64 = 180;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RapidOcrRuntimeStatus {
    pub supported: bool,
    pub installed: bool,
    pub installing: bool,
    pub version: Option<String>,
    pub executable_path: Option<String>,
    pub install_dir: Option<String>,
    pub configured_urls: Vec<String>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RapidOcrRuntimeManifest {
    version: String,
    artifacts: Vec<RapidOcrArtifact>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RapidOcrArtifact {
    target: String,
    urls: Vec<String>,
    sha256: String,
    executable_relpath: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct InstalledRuntimeInfo {
    version: String,
    target: String,
    executable_relpath: String,
    installed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct InstallLockInfo {
    started_at: String,
}

pub fn is_rapidocr_supported() -> bool {
    matches!(
        (std::env::consts::OS, std::env::consts::ARCH),
        ("macos", "aarch64")
            | ("macos", "x86_64")
            | ("linux", "x86_64")
            | ("linux", "aarch64")
            | ("windows", "x86_64")
            | ("windows", "aarch64")
    )
}

pub fn resolve_rapidocr_executable(app: &AppHandle) -> Result<Option<PathBuf>, String> {
    let info = match read_installed_info(app)? {
        Some(info) => info,
        None => return Ok(None),
    };
    let path = runtime_root(app)
        .join("versions")
        .join(&info.version)
        .join(&info.executable_relpath);
    if path.is_file() {
        Ok(Some(path))
    } else {
        Ok(None)
    }
}

pub fn get_rapidocr_status(
    app: &AppHandle,
    db: &AppDatabase,
    configured_urls: Option<Vec<String>>,
) -> Result<RapidOcrRuntimeStatus, String> {
    let configured_urls = configured_urls.unwrap_or_else(default_manifest_urls);
    let lock_exists = runtime_root(app).join(LOCK_FILE_NAME).exists();
    let executable = resolve_rapidocr_executable(app)?;
    let info = read_installed_info(app)?;

    Ok(RapidOcrRuntimeStatus {
        supported: is_rapidocr_supported(),
        installed: executable.is_some(),
        installing: lock_exists,
        version: info.as_ref().map(|item| item.version.clone()),
        executable_path: executable.map(|path| path.to_string_lossy().to_string()),
        install_dir: info.map(|item| {
            runtime_root(app)
                .join("versions")
                .join(item.version)
                .to_string_lossy()
                .to_string()
        }),
        configured_urls,
        last_error: db.0.get_setting("rapidocr_last_error").unwrap_or(None),
    })
}

pub async fn install_rapidocr(
    app: &AppHandle,
    db: &AppDatabase,
    configured_urls: Option<Vec<String>>,
) -> Result<RapidOcrRuntimeStatus, String> {
    if !is_rapidocr_supported() {
        return Err("RapidOCR runtime is not supported on this platform".to_string());
    }

    let configured_urls = configured_urls.unwrap_or_else(default_manifest_urls);
    let root = runtime_root(app);
    fs::create_dir_all(&root).map_err(|e| format!("Failed to create runtime directory: {}", e))?;

    let lock_path = root.join(LOCK_FILE_NAME);
    if lock_path.exists() {
        return Err("RapidOCR install is already running".to_string());
    }

    write_json_file(
        &lock_path,
        &InstallLockInfo {
            started_at: Utc::now().to_rfc3339(),
        },
    )?;

    let install_result = install_rapidocr_inner(app, &configured_urls).await;
    let _ = fs::remove_file(&lock_path);

    match install_result {
        Ok(()) => {
            let _ = db.0.set_setting("rapidocr_last_error", "");
            get_rapidocr_status(app, db, Some(configured_urls))
        }
        Err(err) => {
            let _ = db.0.set_setting("rapidocr_last_error", &err);
            Err(err)
        }
    }
}

pub fn remove_rapidocr(app: &AppHandle, db: &AppDatabase) -> Result<RapidOcrRuntimeStatus, String> {
    let root = runtime_root(app);
    if root.exists() {
        fs::remove_dir_all(&root)
            .map_err(|e| format!("Failed to remove RapidOCR runtime files: {}", e))?;
    }
    let _ = db.0.set_setting("rapidocr_last_error", "");
    get_rapidocr_status(app, db, None)
}

fn runtime_root(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("Failed to resolve app data dir")
        .join("ocr")
        .join("rapidocr")
}

fn default_manifest_urls() -> Vec<String> {
    DEFAULT_MANIFEST_URLS
        .iter()
        .map(|item| item.to_string())
        .collect()
}

fn parse_configured_urls(raw: &str) -> Vec<String> {
    let raw = raw.trim();
    if raw.is_empty() {
        return Vec::new();
    }

    if let Ok(json) = serde_json::from_str::<Vec<String>>(raw) {
        return json
            .into_iter()
            .map(|item| item.trim().to_string())
            .filter(|item| !item.is_empty())
            .collect();
    }

    raw.lines()
        .flat_map(|line| line.split(','))
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .collect()
}

pub fn manifest_urls_from_engine_extra(extra: &str) -> Vec<String> {
    let parsed = parse_configured_urls(extra);
    if parsed.is_empty() {
        default_manifest_urls()
    } else {
        parsed
    }
}

fn read_installed_info(app: &AppHandle) -> Result<Option<InstalledRuntimeInfo>, String> {
    let path = runtime_root(app).join(STATUS_FILE_NAME);
    if !path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read runtime status file: {}", e))?;
    let info = serde_json::from_str(&raw)
        .map_err(|e| format!("Failed to parse runtime status file: {}", e))?;
    Ok(Some(info))
}

async fn install_rapidocr_inner(app: &AppHandle, configured_urls: &[String]) -> Result<(), String> {
    let client = build_http_client(ARTIFACT_TIMEOUT_SECS)?;
    let manifest = fetch_manifest(&client, configured_urls).await?;
    let target = current_target();
    let artifact = manifest
        .artifacts
        .into_iter()
        .find(|artifact| artifact.target == target)
        .ok_or_else(|| format!("No RapidOCR artifact found for target '{}'", target))?;

    let archive_bytes = download_artifact(&client, &artifact.urls, &artifact.sha256).await?;
    let root = runtime_root(app);
    let versions_dir = root.join("versions");
    fs::create_dir_all(&versions_dir)
        .map_err(|e| format!("Failed to create versions directory: {}", e))?;

    let temp_dir = versions_dir.join(format!("{}.tmp", manifest.version));
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to clear temporary runtime directory: {}", e))?;
    }
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temporary runtime directory: {}", e))?;

    let unpack_result =
        unpack_runtime_archive(&archive_bytes, &temp_dir, &artifact.executable_relpath);
    if let Err(err) = unpack_result {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err(err);
    }

    let final_dir = versions_dir.join(&manifest.version);
    if final_dir.exists() {
        fs::remove_dir_all(&final_dir)
            .map_err(|e| format!("Failed to replace existing runtime version: {}", e))?;
    }
    fs::rename(&temp_dir, &final_dir)
        .map_err(|e| format!("Failed to activate RapidOCR runtime: {}", e))?;

    write_json_file(
        &root.join(STATUS_FILE_NAME),
        &InstalledRuntimeInfo {
            version: manifest.version.clone(),
            target,
            executable_relpath: artifact.executable_relpath,
            installed_at: Utc::now().to_rfc3339(),
        },
    )?;

    prune_old_versions(&versions_dir, &manifest.version)?;

    Ok(())
}

fn prune_old_versions(versions_dir: &Path, keep_version: &str) -> Result<(), String> {
    if !versions_dir.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(versions_dir)
        .map_err(|e| format!("Failed to read versions directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to inspect versions directory: {}", e))?;
        let path = entry.path();
        if path.file_name().and_then(|name| name.to_str()) == Some(keep_version) {
            continue;
        }
        if path.is_dir() {
            fs::remove_dir_all(&path)
                .map_err(|e| format!("Failed to remove old runtime version: {}", e))?;
        }
    }
    Ok(())
}

fn unpack_runtime_archive(
    archive_bytes: &[u8],
    destination: &Path,
    executable_relpath: &str,
) -> Result<(), String> {
    let reader = Cursor::new(archive_bytes);
    let mut archive =
        ZipArchive::new(reader).map_err(|e| format!("Failed to open RapidOCR archive: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read RapidOCR archive entry: {}", e))?;
        let enclosed = file
            .enclosed_name()
            .ok_or_else(|| "RapidOCR archive contains an invalid path".to_string())?
            .to_path_buf();
        let out_path = destination.join(enclosed);

        if file.name().ends_with('/') {
            fs::create_dir_all(&out_path)
                .map_err(|e| format!("Failed to create runtime directory: {}", e))?;
            continue;
        }

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create runtime parent directory: {}", e))?;
        }

        let mut out_file =
            fs::File::create(&out_path).map_err(|e| format!("Failed to create file: {}", e))?;
        std::io::copy(&mut file, &mut out_file)
            .map_err(|e| format!("Failed to extract runtime file: {}", e))?;
    }

    let executable_path = destination.join(executable_relpath);
    if !executable_path.is_file() {
        return Err(format!(
            "RapidOCR archive is missing executable '{}'",
            executable_relpath
        ));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let mut perms = fs::metadata(&executable_path)
            .map_err(|e| format!("Failed to read runtime executable metadata: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&executable_path, perms)
            .map_err(|e| format!("Failed to mark runtime executable: {}", e))?;
    }

    Ok(())
}

async fn fetch_manifest(
    client: &reqwest::Client,
    configured_urls: &[String],
) -> Result<RapidOcrRuntimeManifest, String> {
    let mut failures = Vec::new();
    for url in configured_urls {
        match fetch_json::<RapidOcrRuntimeManifest>(client, url).await {
            Ok(manifest) => return Ok(manifest),
            Err(err) => failures.push(format!("{} -> {}", url, err)),
        }
    }

    Err(format!(
        "Failed to fetch RapidOCR manifest from all sources: {}",
        failures.join(" | ")
    ))
}

async fn download_artifact(
    client: &reqwest::Client,
    urls: &[String],
    expected_sha256: &str,
) -> Result<Vec<u8>, String> {
    let mut failures = Vec::new();
    for url in urls {
        match fetch_bytes(client, url).await {
            Ok(bytes) => {
                let digest = hex::encode(Sha256::digest(&bytes));
                if digest.eq_ignore_ascii_case(expected_sha256) {
                    return Ok(bytes);
                }
                failures.push(format!("{} -> sha256 mismatch", url));
            }
            Err(err) => failures.push(format!("{} -> {}", url, err)),
        }
    }

    Err(format!(
        "Failed to download RapidOCR package from all sources: {}",
        failures.join(" | ")
    ))
}

async fn fetch_json<T: for<'de> Deserialize<'de>>(
    client: &reqwest::Client,
    url: &str,
) -> Result<T, String> {
    let response = client
        .get(url)
        .timeout(std::time::Duration::from_secs(MANIFEST_TIMEOUT_SECS))
        .send()
        .await
        .map_err(|e| format!("request failed: {}", e))?;
    ensure_success(url, response.status())?;
    response
        .json::<T>()
        .await
        .map_err(|e| format!("invalid JSON: {}", e))
}

async fn fetch_bytes(client: &reqwest::Client, url: &str) -> Result<Vec<u8>, String> {
    let response = client
        .get(url)
        .timeout(std::time::Duration::from_secs(ARTIFACT_TIMEOUT_SECS))
        .send()
        .await
        .map_err(|e| format!("request failed: {}", e))?;
    ensure_success(url, response.status())?;
    response
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|e| format!("failed to read body: {}", e))
}

fn ensure_success(url: &str, status: StatusCode) -> Result<(), String> {
    if status.is_success() {
        Ok(())
    } else {
        Err(format!("HTTP {} for {}", status.as_u16(), url))
    }
}

fn build_http_client(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(format!(
            "AlgerClipboard/{}/RapidOCR",
            env!("CARGO_PKG_VERSION")
        ))
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))
}

fn current_target() -> String {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => "macos-aarch64",
        ("macos", "x86_64") => "macos-x86_64",
        ("linux", "x86_64") => "linux-x86_64",
        ("linux", "aarch64") => "linux-aarch64",
        ("windows", "x86_64") => "windows-x86_64",
        ("windows", "aarch64") => "windows-aarch64",
        (os, arch) => return format!("{}-{}", os, arch),
    }
    .to_string()
}

fn write_json_file<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let data = serde_json::to_vec_pretty(value)
        .map_err(|e| format!("Failed to serialize JSON file: {}", e))?;
    fs::write(path, data).map_err(|e| format!("Failed to write JSON file: {}", e))
}
