use crate::commands::clipboard_cmd::AppDatabase;
use crate::commands::paste_cmd::AppBlobStore;
use crate::ocr::engine::{dispatch_ocr, OcrEngine, OcrEngineConfig};
use crate::ocr::native::NativeOcrEngine;
use crate::ocr::OcrResult;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::State;

// ---------------------------------------------------------------------------
// OcrEngineInfo – lightweight struct for frontend dropdowns
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrEngineInfo {
    pub engine_type: String,
    pub label: String,
    pub enabled: bool,
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

fn load_ocr_configs(db: &AppDatabase) -> Vec<OcrEngineConfig> {
    let json_str = db.0.get_setting("ocr_engines").unwrap_or(None);
    match json_str {
        Some(s) => serde_json::from_str(&s).unwrap_or_default(),
        None => Vec::new(),
    }
}

fn save_ocr_configs(db: &AppDatabase, configs: &[OcrEngineConfig]) -> Result<(), String> {
    let json = serde_json::to_string(configs)
        .map_err(|e| format!("Failed to serialize OCR engine configs: {}", e))?;
    db.0.set_setting("ocr_engines", &json)
}

/// Ensure a native engine entry always exists in the config list.
fn ensure_native_config(configs: &mut Vec<OcrEngineConfig>) {
    if !configs.iter().any(|c| c.engine_type == "native") {
        configs.insert(
            0,
            OcrEngineConfig {
                engine_type: "native".to_string(),
                enabled: true,
                api_key: String::new(),
                api_secret: String::new(),
                endpoint: String::new(),
                model: String::new(),
                command: String::new(),
                extra: String::new(),
            },
        );
    }
}

/// Check whether a config has the required fields filled and is enabled.
fn is_config_usable(cfg: &OcrEngineConfig) -> bool {
    if !cfg.enabled {
        return false;
    }
    match cfg.engine_type.as_str() {
        "native" => true,
        "baidu" => !cfg.api_key.trim().is_empty() && !cfg.api_secret.trim().is_empty(),
        "google" => !cfg.api_key.trim().is_empty(),
        "tencent" => !cfg.api_key.trim().is_empty() && !cfg.api_secret.trim().is_empty(),
        "local_model" => !cfg.command.trim().is_empty(),
        "online_model" => !cfg.endpoint.trim().is_empty(),
        "ai_vision" => !cfg.endpoint.trim().is_empty() && !cfg.api_key.trim().is_empty(),
        _ => false,
    }
}

/// Construct a boxed OcrEngine from a config. Returns None for unknown types
/// or configs missing required fields.
fn build_engine(cfg: &OcrEngineConfig) -> Option<Box<dyn OcrEngine>> {
    if !is_config_usable(cfg) {
        return None;
    }
    match cfg.engine_type.as_str() {
        "native" => Some(Box::new(NativeOcrEngine::new())),
        "baidu" => Some(Box::new(crate::ocr::baidu::BaiduOcrEngine::new(
            cfg.api_key.clone(),
            cfg.api_secret.clone(),
        ))),
        "google" => Some(Box::new(crate::ocr::google::GoogleVisionEngine::new(
            cfg.api_key.clone(),
        ))),
        "tencent" => Some(Box::new(crate::ocr::tencent::TencentOcrEngine::new(
            cfg.api_key.clone(),
            cfg.api_secret.clone(),
        ))),
        "local_model" => Some(Box::new(crate::ocr::local_model::LocalModelEngine::new(
            cfg.command.clone(),
        ))),
        "online_model" => Some(Box::new(crate::ocr::online_model::OnlineModelEngine::new(
            cfg.endpoint.clone(),
            cfg.api_key.clone(),
        ))),
        "ai_vision" => Some(Box::new(crate::ocr::ai_vision::AiVisionEngine::new(
            cfg.endpoint.clone(),
            cfg.api_key.clone(),
            cfg.model.clone(),
        ))),
        _ => {
            log::warn!("Unknown OCR engine type: {}", cfg.engine_type);
            None
        }
    }
}

/// Build a list of engines from configs. If `engine_type` is specified, put
/// that engine first (with the rest as fallbacks).
fn build_engines_for(
    configs: &[OcrEngineConfig],
    engine_type: Option<&str>,
) -> Vec<Box<dyn OcrEngine>> {
    let mut primary: Vec<Box<dyn OcrEngine>> = Vec::new();
    let mut fallbacks: Vec<Box<dyn OcrEngine>> = Vec::new();

    for cfg in configs {
        if let Some(engine) = build_engine(cfg) {
            match engine_type {
                Some(et) if cfg.engine_type == et => primary.push(engine),
                _ => fallbacks.push(engine),
            }
        }
    }

    primary.extend(fallbacks);
    primary
}

/// Human-readable label for an engine type.
fn engine_label(engine_type: &str) -> &str {
    match engine_type {
        "native" => "Native OS OCR",
        "baidu" => "Baidu OCR",
        "google" => "Google Cloud Vision",
        "tencent" => "Tencent Cloud OCR",
        "local_model" => "Local Model",
        "online_model" => "Online Model",
        "ai_vision" => "AI Vision",
        _ => "Unknown",
    }
}

// ---------------------------------------------------------------------------
// Core OCR function
// ---------------------------------------------------------------------------

async fn run_ocr(
    db: &AppDatabase,
    image_data: Vec<u8>,
    engine_type: Option<String>,
) -> Result<OcrResult, String> {
    let mut configs = load_ocr_configs(db);
    ensure_native_config(&mut configs);

    // Determine which engine to prefer
    let preferred = engine_type.or_else(|| {
        db.0.get_setting("ocr_default_engine")
            .unwrap_or(None)
    });

    // Compute content hash for caching
    let mut hasher = Sha256::new();
    hasher.update(&image_data);
    let content_hash = format!("{:x}", hasher.finalize());
    let cache_engine = preferred.as_deref().unwrap_or("default");

    // Check cache
    if let Ok(Some(cached_json)) = db.0.get_ocr_cache(&content_hash, cache_engine) {
        if let Ok(cached_result) = serde_json::from_str::<OcrResult>(&cached_json) {
            return Ok(cached_result);
        }
    }

    let engines = build_engines_for(&configs, preferred.as_deref());
    let result = dispatch_ocr(&engines, &image_data).await?;

    // Store in cache
    if let Ok(json) = serde_json::to_string(&result) {
        let _ = db.0.set_ocr_cache(&content_hash, cache_engine, &json);
    }

    Ok(result)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Recognize text from a clipboard image (stored as a blob).
#[tauri::command]
pub async fn ocr_recognize(
    db: State<'_, AppDatabase>,
    blob_store: State<'_, AppBlobStore>,
    relative_path: String,
    engine: Option<String>,
) -> Result<OcrResult, String> {
    let path = blob_store.0.get_blob_path(&relative_path);
    let image_data = std::fs::read(&path)
        .map_err(|e| format!("Failed to read blob '{}': {}", relative_path, e))?;
    run_ocr(&db, image_data, engine).await
}

/// Recognize text from an arbitrary file path.
#[tauri::command]
pub async fn ocr_recognize_file(
    db: State<'_, AppDatabase>,
    path: String,
    engine: Option<String>,
) -> Result<OcrResult, String> {
    let image_data =
        std::fs::read(&path).map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
    run_ocr(&db, image_data, engine).await
}

/// Return all OCR engine configs (ensuring native is always present).
#[tauri::command]
pub fn get_ocr_engines(db: State<'_, AppDatabase>) -> Result<Vec<OcrEngineConfig>, String> {
    let mut configs = load_ocr_configs(&db);
    ensure_native_config(&mut configs);
    Ok(configs)
}

/// Update or add an OCR engine configuration.
#[tauri::command]
pub fn configure_ocr_engine(
    db: State<'_, AppDatabase>,
    config: OcrEngineConfig,
) -> Result<(), String> {
    let mut configs = load_ocr_configs(&db);
    ensure_native_config(&mut configs);

    if let Some(existing) = configs.iter_mut().find(|c| c.engine_type == config.engine_type) {
        *existing = config;
    } else {
        configs.push(config);
    }

    save_ocr_configs(&db, &configs)
}

/// Get the default OCR engine type (falls back to "native").
#[tauri::command]
pub fn get_default_ocr_engine(db: State<'_, AppDatabase>) -> Result<String, String> {
    let default = db
        .0
        .get_setting("ocr_default_engine")
        .unwrap_or(None)
        .unwrap_or_else(|| "native".to_string());
    Ok(default)
}

/// Set the default OCR engine type.
#[tauri::command]
pub fn set_default_ocr_engine(
    db: State<'_, AppDatabase>,
    engine_type: String,
) -> Result<(), String> {
    db.0.set_setting("ocr_default_engine", &engine_type)
}

/// Return only usable (enabled + configured) engines with labels for frontend.
#[tauri::command]
pub fn get_enabled_ocr_engines(
    db: State<'_, AppDatabase>,
) -> Result<Vec<OcrEngineInfo>, String> {
    let mut configs = load_ocr_configs(&db);
    ensure_native_config(&mut configs);

    let infos = configs
        .iter()
        .filter(|c| is_config_usable(c))
        .map(|c| OcrEngineInfo {
            engine_type: c.engine_type.clone(),
            label: engine_label(&c.engine_type).to_string(),
            enabled: c.enabled,
        })
        .collect();

    Ok(infos)
}

/// Clear all cached OCR results.
#[tauri::command]
pub fn clear_ocr_cache(db: State<'_, AppDatabase>) -> Result<(), String> {
    db.0.clear_ocr_cache()
}
