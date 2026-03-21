use crate::commands::ai_cmd::{is_ai_config_ready, load_ai_config_pub, run_ai_translate};
use crate::commands::clipboard_cmd::AppDatabase;
use crate::translate::baidu::BaiduTranslator;
use crate::translate::engine::{dispatch_translate, TranslateEngine, TranslateResult};
use crate::translate::google::GoogleTranslator;
use crate::translate::youdao::YoudaoTranslator;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    pub engine: String,
    pub api_key: String,
    pub api_secret: String,
    pub enabled: bool,
}

pub fn load_engine_configs_from_db(db: &AppDatabase) -> Vec<EngineConfig> {
    let json_str = db.0.get_setting("translate_engines").unwrap_or(None);
    match json_str {
        Some(s) => serde_json::from_str(&s).unwrap_or_default(),
        None => Vec::new(),
    }
}

fn is_engine_config_usable(cfg: &EngineConfig) -> bool {
    if !cfg.enabled || cfg.api_key.trim().is_empty() {
        return false;
    }

    match cfg.engine.as_str() {
        "baidu" | "youdao" => !cfg.api_secret.trim().is_empty(),
        _ => true,
    }
}

pub fn has_usable_translate_engine_configs(configs: &[EngineConfig]) -> bool {
    configs.iter().any(is_engine_config_usable)
}

fn save_engine_configs(db: &AppDatabase, configs: &[EngineConfig]) -> Result<(), String> {
    let json = serde_json::to_string(configs)
        .map_err(|e| format!("Failed to serialize engine configs: {}", e))?;
    db.0.set_setting("translate_engines", &json)
}

fn build_engines(configs: &[EngineConfig]) -> Vec<Box<dyn TranslateEngine>> {
    let mut engines: Vec<Box<dyn TranslateEngine>> = Vec::new();

    for cfg in configs {
        if !is_engine_config_usable(cfg) {
            continue;
        }
        match cfg.engine.as_str() {
            "baidu" => {
                engines.push(Box::new(BaiduTranslator::new(
                    cfg.api_key.clone(),
                    cfg.api_secret.clone(),
                )));
            }
            "youdao" => {
                engines.push(Box::new(YoudaoTranslator::new(
                    cfg.api_key.clone(),
                    cfg.api_secret.clone(),
                )));
            }
            "google" => {
                engines.push(Box::new(GoogleTranslator::new(cfg.api_key.clone())));
            }
            _ => {
                log::warn!("Unknown translation engine: {}", cfg.engine);
            }
        }
    }

    engines
}

fn build_engines_for_specific(
    configs: &[EngineConfig],
    engine_name: &str,
) -> Vec<Box<dyn TranslateEngine>> {
    // Put the requested engine first, then others as fallback
    let mut primary: Vec<Box<dyn TranslateEngine>> = Vec::new();
    let mut fallbacks: Vec<Box<dyn TranslateEngine>> = Vec::new();

    for cfg in configs {
        if !is_engine_config_usable(cfg) {
            continue;
        }
        let engine: Box<dyn TranslateEngine> = match cfg.engine.as_str() {
            "baidu" => Box::new(BaiduTranslator::new(
                cfg.api_key.clone(),
                cfg.api_secret.clone(),
            )),
            "youdao" => Box::new(YoudaoTranslator::new(
                cfg.api_key.clone(),
                cfg.api_secret.clone(),
            )),
            "google" => Box::new(GoogleTranslator::new(cfg.api_key.clone())),
            _ => continue,
        };

        if cfg.engine == engine_name {
            primary.push(engine);
        } else {
            fallbacks.push(engine);
        }
    }

    primary.extend(fallbacks);
    primary
}

#[tauri::command]
pub async fn translate_text(
    db: State<'_, AppDatabase>,
    text: String,
    from: String,
    to: String,
    engine: Option<String>,
) -> Result<TranslateResult, String> {
    let configs = load_engine_configs_from_db(&db);

    let engines = match engine {
        Some(ref name) => build_engines_for_specific(&configs, name),
        None => build_engines(&configs),
    };

    if engines.is_empty() {
        let ai_config = load_ai_config_pub(&db.0);
        if is_ai_config_ready(&ai_config) {
            let translated = run_ai_translate(&ai_config, &text, &from, &to).await?;
            return Ok(TranslateResult {
                text,
                translated,
                from_lang: from,
                to_lang: to,
                engine: "AI".to_string(),
            });
        }
    }

    dispatch_translate(&engines, &text, &from, &to).await
}

#[tauri::command]
pub async fn translate_all(
    db: State<'_, AppDatabase>,
    text: String,
    from: String,
    to: String,
) -> Result<Vec<TranslateResult>, String> {
    let configs = load_engine_configs_from_db(&db);
    let mut results = Vec::new();

    // Build individual engines and translate in parallel
    let mut handles = Vec::new();
    for cfg in &configs {
        if !is_engine_config_usable(cfg) {
            continue;
        }
        let engine: Box<dyn TranslateEngine> = match cfg.engine.as_str() {
            "baidu" => Box::new(BaiduTranslator::new(cfg.api_key.clone(), cfg.api_secret.clone())),
            "youdao" => Box::new(YoudaoTranslator::new(cfg.api_key.clone(), cfg.api_secret.clone())),
            "google" => Box::new(GoogleTranslator::new(cfg.api_key.clone())),
            _ => continue,
        };
        let text_clone = text.clone();
        let from_clone = from.clone();
        let to_clone = to.clone();
        handles.push(tokio::spawn(async move {
            match engine.translate(&text_clone, &from_clone, &to_clone).await {
                Ok(translated) => Some(TranslateResult {
                    text: text_clone,
                    translated,
                    from_lang: from_clone,
                    to_lang: to_clone,
                    engine: engine.name().to_string(),
                }),
                Err(e) => {
                    log::warn!("translate_all: {} failed: {}", engine.name(), e);
                    None
                }
            }
        }));
    }

    // Also try AI if configured
    let ai_config = load_ai_config_pub(&db.0);
    if is_ai_config_ready(&ai_config) {
        let text_clone = text.clone();
        let from_clone = from.clone();
        let to_clone = to.clone();
        handles.push(tokio::spawn(async move {
            match run_ai_translate(&ai_config, &text_clone, &from_clone, &to_clone).await {
                Ok(translated) => Some(TranslateResult {
                    text: text_clone,
                    translated,
                    from_lang: from_clone,
                    to_lang: to_clone,
                    engine: "AI".to_string(),
                }),
                Err(_) => None,
            }
        }));
    }

    for handle in handles {
        if let Ok(Some(result)) = handle.await {
            results.push(result);
        }
    }

    if results.is_empty() {
        return Err("All translation engines failed".to_string());
    }

    Ok(results)
}

#[tauri::command]
pub fn get_translate_engines(db: State<'_, AppDatabase>) -> Result<Vec<EngineConfig>, String> {
    Ok(load_engine_configs_from_db(&db))
}

#[tauri::command]
pub fn configure_translate_engine(
    db: State<'_, AppDatabase>,
    engine: String,
    api_key: String,
    api_secret: String,
    enabled: bool,
) -> Result<(), String> {
    let mut configs = load_engine_configs_from_db(&db);

    // Update existing or add new
    if let Some(cfg) = configs.iter_mut().find(|c| c.engine == engine) {
        cfg.api_key = api_key;
        cfg.api_secret = api_secret;
        cfg.enabled = enabled;
    } else {
        configs.push(EngineConfig {
            engine,
            api_key,
            api_secret,
            enabled,
        });
    }

    save_engine_configs(&db, &configs)
}
