use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::ai::engine::{AiEngine, ChatMessage, ChatResponse, ModelInfo, TokenUsage};

pub struct OpenAiCompatibleEngine {
    base_url: String,
    api_key: String,
    client: reqwest::Client,
}

impl OpenAiCompatibleEngine {
    pub fn new(base_url: String, api_key: String) -> Self {
        Self {
            base_url,
            api_key,
            client: reqwest::Client::new(),
        }
    }
}

#[derive(Serialize)]
struct OpenAiRequest<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
}

#[derive(Deserialize)]
struct OpenAiResponse {
    choices: Vec<OpenAiChoice>,
    model: Option<String>,
    usage: Option<OpenAiUsage>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessage,
}

#[derive(Deserialize)]
struct OpenAiMessage {
    content: Option<String>,
}

#[derive(Deserialize)]
struct OpenAiUsage {
    prompt_tokens: Option<u32>,
    completion_tokens: Option<u32>,
    total_tokens: Option<u32>,
}

#[derive(Deserialize)]
struct OpenAiError {
    error: Option<OpenAiErrorDetail>,
}

#[derive(Deserialize)]
struct OpenAiErrorDetail {
    message: Option<String>,
}

#[async_trait]
impl AiEngine for OpenAiCompatibleEngine {
    fn name(&self) -> &str {
        "openai_compatible"
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, String> {
        let url = format!("{}/models", self.base_url.trim_end_matches('/'));

        let mut req = self.client.get(&url);
        if !self.api_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", self.api_key));
        }

        let resp = req
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;
        let status = resp.status();
        let body = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        if !status.is_success() {
            return Err(format!("API error ({}): {}", status, body));
        }

        #[derive(Deserialize)]
        struct ModelsResponse {
            data: Option<Vec<ModelItem>>,
        }
        #[derive(Deserialize)]
        struct ModelItem {
            id: String,
        }

        let parsed: ModelsResponse = serde_json::from_str(&body)
            .map_err(|e| format!("Failed to parse models response: {}", e))?;

        let models = parsed
            .data
            .unwrap_or_default()
            .into_iter()
            .map(|m| ModelInfo {
                id: m.id.clone(),
                name: Some(m.id),
            })
            .collect();

        Ok(models)
    }

    async fn chat(&self, messages: &[ChatMessage], model: &str) -> Result<ChatResponse, String> {
        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));

        let request_body = OpenAiRequest { model, messages };

        let mut req = self
            .client
            .post(&url)
            .header("Content-Type", "application/json");

        if !self.api_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", self.api_key));
        }

        let resp = req
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        let status = resp.status();
        let body = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        if !status.is_success() {
            if let Ok(err) = serde_json::from_str::<OpenAiError>(&body) {
                if let Some(detail) = err.error {
                    if let Some(msg) = detail.message {
                        return Err(format!("API error ({}): {}", status, msg));
                    }
                }
            }
            return Err(format!("API error ({}): {}", status, body));
        }

        let parsed: OpenAiResponse = serde_json::from_str(&body)
            .map_err(|e| format!("Failed to parse response: {} body: {}", e, body))?;

        let content = parsed
            .choices
            .first()
            .and_then(|c| c.message.content.clone())
            .unwrap_or_default();

        let usage = parsed.usage.map(|u| TokenUsage {
            prompt_tokens: u.prompt_tokens.unwrap_or(0),
            completion_tokens: u.completion_tokens.unwrap_or(0),
            total_tokens: u.total_tokens.unwrap_or(0),
        });

        Ok(ChatResponse {
            content,
            model: parsed.model.unwrap_or_else(|| model.to_string()),
            usage,
        })
    }
}
