use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::ai::engine::{AiEngine, ChatMessage, ChatResponse, ModelInfo, TokenUsage};

pub struct GeminiEngine {
    api_key: String,
    base_url: String,
    client: reqwest::Client,
}

impl GeminiEngine {
    pub fn new(base_url: String, api_key: String) -> Self {
        Self {
            api_key,
            base_url,
            client: reqwest::Client::new(),
        }
    }
}

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
}

#[derive(Serialize, Deserialize)]
struct GeminiContent {
    role: String,
    parts: Vec<GeminiPart>,
}

#[derive(Serialize, Deserialize)]
struct GeminiPart {
    text: String,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
    #[serde(rename = "usageMetadata")]
    usage_metadata: Option<GeminiUsageMetadata>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContent>,
}

#[derive(Deserialize)]
struct GeminiUsageMetadata {
    #[serde(rename = "promptTokenCount")]
    prompt_token_count: Option<u32>,
    #[serde(rename = "candidatesTokenCount")]
    candidates_token_count: Option<u32>,
    #[serde(rename = "totalTokenCount")]
    total_token_count: Option<u32>,
}

#[derive(Deserialize)]
struct GeminiError {
    error: Option<GeminiErrorDetail>,
}

#[derive(Deserialize)]
struct GeminiErrorDetail {
    message: Option<String>,
}

#[async_trait]
impl AiEngine for GeminiEngine {
    fn name(&self) -> &str {
        "gemini"
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, String> {
        let url = format!(
            "{}/v1beta/models?key={}",
            self.base_url.trim_end_matches('/'),
            self.api_key
        );

        let resp = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        let status = resp.status();
        let body = resp.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

        if !status.is_success() {
            return Err(format!("API error ({}): {}", status, body));
        }

        #[derive(Deserialize)]
        struct ModelsResponse {
            models: Option<Vec<GeminiModel>>,
        }
        #[derive(Deserialize)]
        struct GeminiModel {
            name: Option<String>,
            #[serde(rename = "displayName")]
            display_name: Option<String>,
        }

        let parsed: ModelsResponse = serde_json::from_str(&body)
            .map_err(|e| format!("Failed to parse models response: {}", e))?;

        let models = parsed.models.unwrap_or_default()
            .into_iter()
            .filter_map(|m| {
                // Gemini model names are like "models/gemini-2.0-flash" — strip prefix
                let id = m.name?.strip_prefix("models/")?.to_string();
                // Only include generateContent-capable models (skip embedding etc.)
                if id.contains("embed") || id.contains("aqa") || id.contains("retrieval") {
                    return None;
                }
                Some(ModelInfo { id: id.clone(), name: m.display_name.or(Some(id)) })
            })
            .collect();

        Ok(models)
    }

    async fn chat(&self, messages: &[ChatMessage], model: &str) -> Result<ChatResponse, String> {
        let url = format!(
            "{}/v1beta/models/{}:generateContent?key={}",
            self.base_url.trim_end_matches('/'),
            model,
            self.api_key
        );

        // Convert messages to Gemini format
        // System messages are prefixed with "[System] " and converted to user role
        let mut contents: Vec<GeminiContent> = Vec::new();

        for msg in messages {
            let (role, text) = if msg.role == "system" {
                ("user".to_string(), format!("[System] {}", msg.content))
            } else if msg.role == "assistant" {
                ("model".to_string(), msg.content.clone())
            } else {
                ("user".to_string(), msg.content.clone())
            };

            // Gemini requires alternating roles; merge consecutive same-role messages
            if let Some(last) = contents.last_mut() {
                if last.role == role {
                    last.parts.push(GeminiPart { text });
                    continue;
                }
            }

            contents.push(GeminiContent {
                role,
                parts: vec![GeminiPart { text }],
            });
        }

        let request_body = GeminiRequest { contents };

        let resp = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        let status = resp.status();
        let body = resp.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

        if !status.is_success() {
            if let Ok(err) = serde_json::from_str::<GeminiError>(&body) {
                if let Some(detail) = err.error {
                    if let Some(msg) = detail.message {
                        return Err(format!("Gemini API error ({}): {}", status, msg));
                    }
                }
            }
            return Err(format!("Gemini API error ({}): {}", status, body));
        }

        let parsed: GeminiResponse = serde_json::from_str(&body)
            .map_err(|e| format!("Failed to parse response: {} body: {}", e, body))?;

        let content = parsed
            .candidates
            .as_ref()
            .and_then(|c| c.first())
            .and_then(|c| c.content.as_ref())
            .and_then(|c| c.parts.first())
            .map(|p| p.text.clone())
            .unwrap_or_default();

        let usage = parsed.usage_metadata.map(|u| TokenUsage {
            prompt_tokens: u.prompt_token_count.unwrap_or(0),
            completion_tokens: u.candidates_token_count.unwrap_or(0),
            total_tokens: u.total_token_count.unwrap_or(0),
        });

        Ok(ChatResponse {
            content,
            model: model.to_string(),
            usage,
        })
    }
}
