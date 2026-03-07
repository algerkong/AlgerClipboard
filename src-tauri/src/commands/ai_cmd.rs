use crate::ai::classifier::{classify_content, ContentCategory};
use crate::ai::language::detect_language;
use crate::ai::adapters::anthropic::AnthropicEngine;
use crate::ai::adapters::gemini::GeminiEngine;
use crate::ai::adapters::openai_compatible::OpenAiCompatibleEngine;
use crate::ai::engine::{AiEngine, ChatMessage, ChatResponse, ModelInfo};
use crate::ai::providers::{get_provider_presets, ProviderPreset};
use crate::commands::clipboard_cmd::AppDatabase;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub provider: String,
    pub api_key: String,
    pub model: String,
    pub base_url: String,
    pub enabled: bool,
}

fn load_ai_config(db: &AppDatabase) -> AiConfig {
    let provider = db.0.get_setting("ai_provider").unwrap_or(None).unwrap_or_default();
    let api_key = db.0.get_setting("ai_api_key").unwrap_or(None).unwrap_or_default();
    let model = db.0.get_setting("ai_model").unwrap_or(None).unwrap_or_default();
    let base_url = db.0.get_setting("ai_base_url").unwrap_or(None).unwrap_or_default();
    let enabled = db
        .0
        .get_setting("ai_enabled")
        .unwrap_or(None)
        .map(|v| v == "true")
        .unwrap_or(false);

    AiConfig {
        provider,
        api_key,
        model,
        base_url,
        enabled,
    }
}

fn save_ai_config_to_db(db: &AppDatabase, config: &AiConfig) -> Result<(), String> {
    db.0.set_setting("ai_provider", &config.provider)?;
    db.0.set_setting("ai_api_key", &config.api_key)?;
    db.0.set_setting("ai_model", &config.model)?;
    db.0.set_setting("ai_base_url", &config.base_url)?;
    db.0.set_setting("ai_enabled", if config.enabled { "true" } else { "false" })?;
    Ok(())
}

fn build_engine(config: &AiConfig) -> Result<Box<dyn AiEngine>, String> {
    let presets = get_provider_presets();
    let preset = presets.iter().find(|p| p.id == config.provider);

    let adapter = preset.map(|p| p.adapter.as_str()).unwrap_or("openai_compatible");
    let base_url = if config.base_url.is_empty() {
        preset
            .map(|p| p.base_url.clone())
            .unwrap_or_default()
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
    engine.list_models().await
}

#[tauri::command]
pub async fn test_ai_connection(db: State<'_, AppDatabase>) -> Result<String, String> {
    let config = load_ai_config(&db);
    if !config.enabled {
        return Err("AI is not enabled".to_string());
    }
    let engine = build_engine(&config)?;
    let model = &config.model;
    engine.test_connection(model).await
}

#[tauri::command]
pub async fn ai_chat(
    db: State<'_, AppDatabase>,
    messages: Vec<ChatMessage>,
) -> Result<ChatResponse, String> {
    let config = load_ai_config(&db);
    if !config.enabled {
        return Err("AI is not enabled".to_string());
    }
    let engine = build_engine(&config)?;
    engine.chat(&messages, &config.model).await
}

#[tauri::command]
pub async fn ai_summarize(db: State<'_, AppDatabase>, text: String) -> Result<String, String> {
    let config = load_ai_config(&db);
    if !config.enabled {
        return Err("AI is not enabled".to_string());
    }
    let engine = build_engine(&config)?;

    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: "Summarize the following text concisely in the same language:".to_string(),
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
pub fn classify_text(text: String) -> ContentCategory {
    classify_content(&text)
}

#[tauri::command]
pub fn detect_code_language(text: String) -> String {
    detect_language(&text).as_str().to_string()
}
