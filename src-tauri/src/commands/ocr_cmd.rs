use crate::commands::clipboard_cmd::AppDatabase;
use crate::commands::paste_cmd::AppBlobStore;
use crate::ocr::engine::{dispatch_ocr, OcrEngine, OcrEngineConfig};
use crate::ocr::runtime::{
    get_rapidocr_status, install_rapidocr, manifest_urls_from_engine_extra, remove_rapidocr,
    resolve_rapidocr_executable, RapidOcrRuntimeStatus,
};
use crate::ocr::OcrResult;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, State};

#[cfg(target_os = "windows")]
use crate::ocr::native::NativeOcrEngine;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrEngineInfo {
    pub engine_type: String,
    pub label: String,
    pub enabled: bool,
}

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

fn builtin_config(engine_type: &str, enabled: bool) -> OcrEngineConfig {
    OcrEngineConfig {
        engine_type: engine_type.to_string(),
        enabled,
        api_key: String::new(),
        api_secret: String::new(),
        endpoint: String::new(),
        model: String::new(),
        command: String::new(),
        extra: String::new(),
    }
}

fn default_engine_type() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "native"
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        "rapidocr"
    }
}

fn ensure_builtin_ocr_configs(configs: &mut Vec<OcrEngineConfig>) {
    #[cfg(target_os = "windows")]
    if !configs.iter().any(|c| c.engine_type == "native") {
        configs.insert(0, builtin_config("native", true));
    }

    if !configs.iter().any(|c| c.engine_type == "rapidocr") {
        configs.insert(0, builtin_config("rapidocr", true));
    }
}

fn find_engine_config<'a>(
    configs: &'a [OcrEngineConfig],
    engine_type: &str,
) -> Option<&'a OcrEngineConfig> {
    configs.iter().find(|cfg| cfg.engine_type == engine_type)
}

fn rapidocr_manifest_urls(configs: &[OcrEngineConfig]) -> Vec<String> {
    find_engine_config(configs, "rapidocr")
        .map(|cfg| manifest_urls_from_engine_extra(&cfg.extra))
        .unwrap_or_else(|| manifest_urls_from_engine_extra(""))
}

fn is_config_usable(app: &AppHandle, cfg: &OcrEngineConfig) -> bool {
    if !cfg.enabled {
        return false;
    }
    match cfg.engine_type.as_str() {
        #[cfg(target_os = "windows")]
        "native" => true,
        #[cfg(not(target_os = "windows"))]
        "native" => false,
        "rapidocr" => resolve_rapidocr_executable(app).ok().flatten().is_some(),
        "baidu" => !cfg.api_key.trim().is_empty() && !cfg.api_secret.trim().is_empty(),
        "google" => !cfg.api_key.trim().is_empty(),
        "tencent" => !cfg.api_key.trim().is_empty() && !cfg.api_secret.trim().is_empty(),
        "local_model" => !cfg.command.trim().is_empty(),
        "online_model" => !cfg.endpoint.trim().is_empty(),
        "ai_vision" => !cfg.endpoint.trim().is_empty() && !cfg.api_key.trim().is_empty(),
        _ => false,
    }
}

fn build_engine(app: &AppHandle, cfg: &OcrEngineConfig) -> Option<Box<dyn OcrEngine>> {
    if !is_config_usable(app, cfg) {
        return None;
    }

    match cfg.engine_type.as_str() {
        #[cfg(target_os = "windows")]
        "native" => Some(Box::new(NativeOcrEngine::new())),
        "rapidocr" => resolve_rapidocr_executable(app).ok().flatten().map(|path| {
            Box::new(crate::ocr::rapidocr::RapidOcrEngine::new(
                path.to_string_lossy().to_string(),
            )) as Box<dyn OcrEngine>
        }),
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

fn build_engines_for(
    app: &AppHandle,
    configs: &[OcrEngineConfig],
    engine_type: Option<&str>,
) -> Vec<Box<dyn OcrEngine>> {
    let mut primary: Vec<Box<dyn OcrEngine>> = Vec::new();
    let mut fallbacks: Vec<Box<dyn OcrEngine>> = Vec::new();

    for cfg in configs {
        if let Some(engine) = build_engine(app, cfg) {
            match engine_type {
                Some(et) if cfg.engine_type == et => primary.push(engine),
                _ => fallbacks.push(engine),
            }
        }
    }

    primary.extend(fallbacks);
    primary
}

fn engine_label(engine_type: &str) -> &str {
    match engine_type {
        "native" => "Native OS OCR",
        "rapidocr" => "RapidOCR",
        "baidu" => "Baidu OCR",
        "google" => "Google Cloud Vision",
        "tencent" => "Tencent Cloud OCR",
        "local_model" => "Local Model",
        "online_model" => "Online Model",
        "ai_vision" => "AI Vision",
        _ => "Unknown",
    }
}

pub(crate) async fn run_ocr_with_app(
    app: &AppHandle,
    db: &AppDatabase,
    image_data: Vec<u8>,
    engine_type: Option<String>,
) -> Result<OcrResult, String> {
    let mut configs = load_ocr_configs(db);
    ensure_builtin_ocr_configs(&mut configs);

    let preferred = engine_type
        .or_else(|| db.0.get_setting("ocr_default_engine").unwrap_or(None))
        .or_else(|| Some(default_engine_type().to_string()));

    let mut hasher = Sha256::new();
    hasher.update(&image_data);
    let content_hash = format!("{:x}", hasher.finalize());
    let cache_engine = preferred.as_deref().unwrap_or("default");

    if let Ok(Some(cached_json)) = db.0.get_ocr_cache(&content_hash, cache_engine) {
        if let Ok(cached_result) = serde_json::from_str::<OcrResult>(&cached_json) {
            return Ok(cached_result);
        }
    }

    let engines = build_engines_for(app, &configs, preferred.as_deref());
    let result = dispatch_ocr(&engines, &image_data).await?;

    if let Ok(json) = serde_json::to_string(&result) {
        let _ = db.0.set_ocr_cache(&content_hash, cache_engine, &json);
    }

    Ok(result)
}

#[tauri::command]
pub async fn ocr_recognize(
    app: AppHandle,
    db: State<'_, AppDatabase>,
    blob_store: State<'_, AppBlobStore>,
    relative_path: String,
    engine: Option<String>,
) -> Result<OcrResult, String> {
    let path = blob_store.0.get_blob_path(&relative_path);
    let image_data = std::fs::read(&path)
        .map_err(|e| format!("Failed to read blob '{}': {}", relative_path, e))?;
    run_ocr_with_app(&app, &db, image_data, engine).await
}

#[tauri::command]
pub async fn ocr_recognize_file(
    app: AppHandle,
    db: State<'_, AppDatabase>,
    path: String,
    engine: Option<String>,
) -> Result<OcrResult, String> {
    let image_data =
        std::fs::read(&path).map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
    run_ocr_with_app(&app, &db, image_data, engine).await
}

#[tauri::command]
pub fn get_ocr_engines(db: State<'_, AppDatabase>) -> Result<Vec<OcrEngineConfig>, String> {
    let mut configs = load_ocr_configs(&db);
    ensure_builtin_ocr_configs(&mut configs);
    Ok(configs)
}

#[tauri::command]
pub fn configure_ocr_engine(
    db: State<'_, AppDatabase>,
    config: OcrEngineConfig,
) -> Result<(), String> {
    let mut configs = load_ocr_configs(&db);
    ensure_builtin_ocr_configs(&mut configs);

    if let Some(existing) = configs
        .iter_mut()
        .find(|c| c.engine_type == config.engine_type)
    {
        *existing = config;
    } else {
        configs.push(config);
    }

    save_ocr_configs(&db, &configs)
}

#[tauri::command]
pub fn get_default_ocr_engine(db: State<'_, AppDatabase>) -> Result<String, String> {
    let default =
        db.0.get_setting("ocr_default_engine")
            .unwrap_or(None)
            .unwrap_or_else(|| default_engine_type().to_string());
    Ok(default)
}

#[tauri::command]
pub fn set_default_ocr_engine(
    db: State<'_, AppDatabase>,
    engine_type: String,
) -> Result<(), String> {
    db.0.set_setting("ocr_default_engine", &engine_type)
}

#[tauri::command]
pub fn get_enabled_ocr_engines(
    app: AppHandle,
    db: State<'_, AppDatabase>,
) -> Result<Vec<OcrEngineInfo>, String> {
    let mut configs = load_ocr_configs(&db);
    ensure_builtin_ocr_configs(&mut configs);

    let infos = configs
        .iter()
        .filter(|c| is_config_usable(&app, c))
        .map(|c| OcrEngineInfo {
            engine_type: c.engine_type.clone(),
            label: engine_label(&c.engine_type).to_string(),
            enabled: c.enabled,
        })
        .collect();

    Ok(infos)
}

#[tauri::command]
pub fn get_rapidocr_runtime_status(
    app: AppHandle,
    db: State<'_, AppDatabase>,
) -> Result<RapidOcrRuntimeStatus, String> {
    let mut configs = load_ocr_configs(&db);
    ensure_builtin_ocr_configs(&mut configs);
    let manifest_urls = rapidocr_manifest_urls(&configs);
    get_rapidocr_status(&app, &db, Some(manifest_urls))
}

#[tauri::command]
pub async fn install_rapidocr_runtime(
    app: AppHandle,
    db: State<'_, AppDatabase>,
) -> Result<RapidOcrRuntimeStatus, String> {
    let mut configs = load_ocr_configs(&db);
    ensure_builtin_ocr_configs(&mut configs);
    let manifest_urls = rapidocr_manifest_urls(&configs);
    install_rapidocr(&app, &db, Some(manifest_urls)).await
}

#[tauri::command]
pub fn remove_rapidocr_runtime(
    app: AppHandle,
    db: State<'_, AppDatabase>,
) -> Result<RapidOcrRuntimeStatus, String> {
    remove_rapidocr(&app, &db)
}

#[tauri::command]
pub fn clear_ocr_cache(db: State<'_, AppDatabase>) -> Result<(), String> {
    db.0.clear_ocr_cache()
}

#[tauri::command]
pub fn get_ocr_trigger_mode(db: State<'_, AppDatabase>) -> Result<String, String> {
    let mode = db
        .0
        .get_setting("ocr_auto_trigger")
        .unwrap_or(None)
        .unwrap_or_else(|| "on_clipboard".to_string());
    Ok(mode)
}

#[tauri::command]
pub fn set_ocr_trigger_mode(
    db: State<'_, AppDatabase>,
    mode: String,
) -> Result<(), String> {
    db.0.set_setting("ocr_auto_trigger", &mode)
}
