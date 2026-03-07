use crate::ai::adapters::anthropic::AnthropicEngine;
use crate::ai::adapters::gemini::GeminiEngine;
use crate::ai::adapters::openai_compatible::OpenAiCompatibleEngine;
use crate::ai::classifier::{classify_content, ContentCategory};
use crate::ai::engine::{AiEngine, ChatMessage, ChatResponse, ModelInfo};
use crate::ai::language::detect_language;
use crate::ai::providers::{get_provider_presets, ProviderPreset};
use crate::commands::clipboard_cmd::AppDatabase;
use serde::{Deserialize, Serialize};
use tauri::State;

pub const DEFAULT_SUMMARY_PROMPT: &str = "Summarize the following text concisely in {language}. Keep the summary under {max_length} characters:";
pub const DEFAULT_TRANSLATE_PROMPT: &str = "Translate the following text from {from_lang} to {to_lang}. Only output the translation, no explanations:";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub provider: String,
    pub api_key: String,
    pub model: String,
    pub base_url: String,
    pub enabled: bool,
    pub auto_summary: bool,
    pub summary_min_length: u32,
    pub summary_max_length: u32,
    pub summary_language: String,
    pub summary_prompt: String,
    pub translate_prompt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureAvailability {
    pub has_translate_engine: bool,
    pub has_ai: bool,
    pub can_translate: bool,
    pub translate_uses_ai_by_default: bool,
}

/// Public wrapper for loading AI config from a raw Database reference (used by auto-summary in lib.rs)
pub fn load_ai_config_pub(db: &crate::storage::database::Database) -> AiConfig {
    let provider = db
        .get_setting("ai_provider")
        .unwrap_or(None)
        .unwrap_or_default();
    let api_key = db
        .get_setting("ai_api_key")
        .unwrap_or(None)
        .unwrap_or_default();
    let model = db
        .get_setting("ai_model")
        .unwrap_or(None)
        .unwrap_or_default();
    let base_url = db
        .get_setting("ai_base_url")
        .unwrap_or(None)
        .unwrap_or_default();
    let enabled = db
        .get_setting("ai_enabled")
        .unwrap_or(None)
        .map(|v| v == "true")
        .unwrap_or(false);
    let auto_summary = db
        .get_setting("ai_auto_summary")
        .unwrap_or(None)
        .map(|v| v == "true")
        .unwrap_or(false);
    let summary_min_length = db
        .get_setting("ai_summary_min_length")
        .unwrap_or(None)
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(200);
    let summary_max_length = db
        .get_setting("ai_summary_max_length")
        .unwrap_or(None)
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(100);
    let summary_language = db
        .get_setting("ai_summary_language")
        .unwrap_or(None)
        .unwrap_or_else(|| "same".to_string());
    let summary_prompt = db
        .get_setting("ai_summary_prompt")
        .unwrap_or(None)
        .unwrap_or_else(|| DEFAULT_SUMMARY_PROMPT.to_string());
    let translate_prompt = db
        .get_setting("ai_translate_prompt")
        .unwrap_or(None)
        .unwrap_or_else(|| DEFAULT_TRANSLATE_PROMPT.to_string());

    AiConfig {
        provider,
        api_key,
        model,
        base_url,
        enabled,
        auto_summary,
        summary_min_length,
        summary_max_length,
        summary_language,
        summary_prompt,
        translate_prompt,
    }
}

/// Public wrapper for building an AI engine from config (used by auto-summary in lib.rs)
pub fn build_engine_pub(config: &AiConfig) -> Result<Box<dyn AiEngine>, String> {
    build_engine(config)
}

pub fn is_ai_config_ready(config: &AiConfig) -> bool {
    if !config.enabled || config.model.trim().is_empty() {
        return false;
    }

    if config.provider != "ollama" && config.api_key.trim().is_empty() {
        return false;
    }

    build_engine(config).is_ok()
}

pub async fn run_ai_translate(
    config: &AiConfig,
    text: &str,
    from_lang: &str,
    to_lang: &str,
) -> Result<String, String> {
    if !is_ai_config_ready(config) {
        return Err("AI is not configured".to_string());
    }

    let engine = build_engine(config)?;

    let from_display = if from_lang == "auto" {
        "auto-detected language"
    } else {
        from_lang
    };
    let system_prompt = config
        .translate_prompt
        .replace("{from_lang}", from_display)
        .replace("{to_lang}", to_lang);

    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_prompt,
        },
        ChatMessage {
            role: "user".to_string(),
            content: text.to_string(),
        },
    ];

    let resp = engine.chat(&messages, &config.model).await?;
    Ok(resp.content)
}

fn load_ai_config(db: &AppDatabase) -> AiConfig {
    let provider =
        db.0.get_setting("ai_provider")
            .unwrap_or(None)
            .unwrap_or_default();
    let api_key =
        db.0.get_setting("ai_api_key")
            .unwrap_or(None)
            .unwrap_or_default();
    let model =
        db.0.get_setting("ai_model")
            .unwrap_or(None)
            .unwrap_or_default();
    let base_url =
        db.0.get_setting("ai_base_url")
            .unwrap_or(None)
            .unwrap_or_default();
    let enabled =
        db.0.get_setting("ai_enabled")
            .unwrap_or(None)
            .map(|v| v == "true")
            .unwrap_or(false);
    let auto_summary =
        db.0.get_setting("ai_auto_summary")
            .unwrap_or(None)
            .map(|v| v == "true")
            .unwrap_or(false);
    let summary_min_length =
        db.0.get_setting("ai_summary_min_length")
            .unwrap_or(None)
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(200);
    let summary_max_length =
        db.0.get_setting("ai_summary_max_length")
            .unwrap_or(None)
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(100);
    let summary_language =
        db.0.get_setting("ai_summary_language")
            .unwrap_or(None)
            .unwrap_or_else(|| "same".to_string());
    let summary_prompt =
        db.0.get_setting("ai_summary_prompt")
            .unwrap_or(None)
            .unwrap_or_else(|| DEFAULT_SUMMARY_PROMPT.to_string());
    let translate_prompt =
        db.0.get_setting("ai_translate_prompt")
            .unwrap_or(None)
            .unwrap_or_else(|| DEFAULT_TRANSLATE_PROMPT.to_string());

    AiConfig {
        provider,
        api_key,
        model,
        base_url,
        enabled,
        auto_summary,
        summary_min_length,
        summary_max_length,
        summary_language,
        summary_prompt,
        translate_prompt,
    }
}

fn save_ai_config_to_db(db: &AppDatabase, config: &AiConfig) -> Result<(), String> {
    db.0.set_setting("ai_provider", &config.provider)?;
    db.0.set_setting("ai_api_key", &config.api_key)?;
    db.0.set_setting("ai_model", &config.model)?;
    db.0.set_setting("ai_base_url", &config.base_url)?;
    db.0.set_setting("ai_enabled", if config.enabled { "true" } else { "false" })?;
    db.0.set_setting(
        "ai_auto_summary",
        if config.auto_summary { "true" } else { "false" },
    )?;
    db.0.set_setting(
        "ai_summary_min_length",
        &config.summary_min_length.to_string(),
    )?;
    db.0.set_setting(
        "ai_summary_max_length",
        &config.summary_max_length.to_string(),
    )?;
    db.0.set_setting("ai_summary_language", &config.summary_language)?;
    db.0.set_setting("ai_summary_prompt", &config.summary_prompt)?;
    db.0.set_setting("ai_translate_prompt", &config.translate_prompt)?;
    Ok(())
}

fn build_engine(config: &AiConfig) -> Result<Box<dyn AiEngine>, String> {
    let presets = get_provider_presets();
    let preset = presets.iter().find(|p| p.id == config.provider);

    let adapter = preset
        .map(|p| p.adapter.as_str())
        .unwrap_or("openai_compatible");
    let base_url = if config.base_url.is_empty() {
        preset.map(|p| p.base_url.clone()).unwrap_or_default()
    } else {
        config.base_url.clone()
    };

    if base_url.is_empty() {
        return Err("No base URL configured and no preset found".to_string());
    }

    match adapter {
        "anthropic" => Ok(Box::new(AnthropicEngine::new(
            base_url,
            config.api_key.clone(),
        ))),
        "gemini" => Ok(Box::new(GeminiEngine::new(
            base_url,
            config.api_key.clone(),
        ))),
        _ => Ok(Box::new(OpenAiCompatibleEngine::new(
            base_url,
            config.api_key.clone(),
        ))),
    }
}

#[tauri::command]
pub fn get_ai_providers() -> Vec<ProviderPreset> {
    get_provider_presets()
}

#[tauri::command]
pub fn get_ai_config(db: State<'_, AppDatabase>) -> Result<AiConfig, String> {
    Ok(load_ai_config(&db))
}

#[tauri::command]
pub fn save_ai_config(db: State<'_, AppDatabase>, config: AiConfig) -> Result<(), String> {
    save_ai_config_to_db(&db, &config)
}

#[tauri::command]
pub async fn fetch_ai_models(db: State<'_, AppDatabase>) -> Result<Vec<ModelInfo>, String> {
    let config = load_ai_config(&db);
    let engine = build_engine(&config)?;
    log::debug!("Fetching AI models via engine '{}'", engine.name());
    engine.list_models().await
}

#[tauri::command]
pub async fn test_ai_connection(db: State<'_, AppDatabase>) -> Result<String, String> {
    let config = load_ai_config(&db);
    if !is_ai_config_ready(&config) {
        return Err("AI is not enabled".to_string());
    }
    let engine = build_engine(&config)?;
    let model = &config.model;
    log::debug!(
        "Testing AI connection via engine '{}' with model '{}'",
        engine.name(),
        model
    );
    engine.test_connection(model).await
}

#[tauri::command]
pub async fn ai_chat(
    db: State<'_, AppDatabase>,
    messages: Vec<ChatMessage>,
) -> Result<ChatResponse, String> {
    let config = load_ai_config(&db);
    if !is_ai_config_ready(&config) {
        return Err("AI is not enabled".to_string());
    }
    let engine = build_engine(&config)?;
    log::debug!("Running AI chat via engine '{}'", engine.name());
    engine.chat(&messages, &config.model).await
}

#[tauri::command]
pub async fn ai_summarize(db: State<'_, AppDatabase>, text: String) -> Result<String, String> {
    let config = load_ai_config(&db);
    if !is_ai_config_ready(&config) {
        return Err("AI is not enabled".to_string());
    }
    let engine = build_engine(&config)?;

    let language_str = if config.summary_language == "same" {
        "the same language as the original text".to_string()
    } else {
        config.summary_language.clone()
    };
    let system_prompt = config
        .summary_prompt
        .replace("{language}", &language_str)
        .replace("{max_length}", &config.summary_max_length.to_string());

    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_prompt,
        },
        ChatMessage {
            role: "user".to_string(),
            content: text,
        },
    ];

    let resp = engine.chat(&messages, &config.model).await?;
    Ok(resp.content)
}

#[tauri::command]
pub async fn ai_translate(
    db: State<'_, AppDatabase>,
    text: String,
    from_lang: String,
    to_lang: String,
) -> Result<String, String> {
    let config = load_ai_config(&db);
    run_ai_translate(&config, &text, &from_lang, &to_lang).await
}

#[tauri::command]
pub fn get_feature_availability(db: State<'_, AppDatabase>) -> Result<FeatureAvailability, String> {
    let translate_configs = crate::commands::translate_cmd::load_engine_configs_from_db(&db);
    let has_translate_engine =
        crate::commands::translate_cmd::has_usable_translate_engine_configs(&translate_configs);
    let ai_config = load_ai_config(&db);
    let has_ai = is_ai_config_ready(&ai_config);

    Ok(FeatureAvailability {
        has_translate_engine,
        has_ai,
        can_translate: has_translate_engine || has_ai,
        translate_uses_ai_by_default: !has_translate_engine && has_ai,
    })
}

#[tauri::command]
pub fn classify_text(text: String) -> ContentCategory {
    classify_content(&text)
}

#[tauri::command]
pub fn detect_code_language(text: String) -> String {
    detect_language(&text).as_str().to_string()
}

#[tauri::command]
pub fn update_ai_summary(
    db: State<'_, AppDatabase>,
    id: String,
    summary: String,
) -> Result<(), String> {
    db.0.update_entry_summary(&id, &summary)
}
