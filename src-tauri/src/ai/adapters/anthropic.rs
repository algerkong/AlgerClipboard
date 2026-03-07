use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::ai::engine::{AiEngine, ChatMessage, ChatResponse, TokenUsage};

pub struct AnthropicEngine {
    api_key: String,
    base_url: String,
    client: reqwest::Client,
}

impl AnthropicEngine {
    pub fn new(base_url: String, api_key: String) -> Self {
        Self {
            api_key,
            base_url,
            client: reqwest::Client::new(),
        }
    }
}

#[derive(Serialize)]
struct AnthropicRequest<'a> {
    model: &'a str,
    max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    messages: Vec<AnthropicMessage>,
}

#[derive(Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
    model: Option<String>,
    usage: Option<AnthropicUsage>,
}

#[derive(Deserialize)]
struct AnthropicContent {
    text: Option<String>,
}

#[derive(Deserialize)]
struct AnthropicUsage {
    input_tokens: Option<u32>,
    output_tokens: Option<u32>,
}

#[derive(Deserialize)]
struct AnthropicError {
    error: Option<AnthropicErrorDetail>,
}

#[derive(Deserialize)]
struct AnthropicErrorDetail {
    message: Option<String>,
}

#[async_trait]
impl AiEngine for AnthropicEngine {
    fn name(&self) -> &str {
        "anthropic"
    }

    async fn chat(&self, messages: &[ChatMessage], model: &str) -> Result<ChatResponse, String> {
        let url = format!("{}/v1/messages", self.base_url.trim_end_matches('/'));

        // Extract system message if present, and collect non-system messages
        let mut system_text: Option<String> = None;
        let mut api_messages: Vec<AnthropicMessage> = Vec::new();

        for msg in messages {
            if msg.role == "system" {
                system_text = Some(msg.content.clone());
            } else {
                api_messages.push(AnthropicMessage {
                    role: msg.role.clone(),
                    content: msg.content.clone(),
                });
            }
        }

        let request_body = AnthropicRequest {
            model,
            max_tokens: 4096,
            system: system_text,
            messages: api_messages,
        };

        let resp = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        let status = resp.status();
        let body = resp.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

        if !status.is_success() {
            if let Ok(err) = serde_json::from_str::<AnthropicError>(&body) {
                if let Some(detail) = err.error {
                    if let Some(msg) = detail.message {
                        return Err(format!("Anthropic API error ({}): {}", status, msg));
                    }
                }
            }
            return Err(format!("Anthropic API error ({}): {}", status, body));
        }

        let parsed: AnthropicResponse = serde_json::from_str(&body)
            .map_err(|e| format!("Failed to parse response: {} body: {}", e, body))?;

        let content = parsed
            .content
            .first()
            .and_then(|c| c.text.clone())
            .unwrap_or_default();

        let usage = parsed.usage.map(|u| {
            let input = u.input_tokens.unwrap_or(0);
            let output = u.output_tokens.unwrap_or(0);
            TokenUsage {
                prompt_tokens: input,
                completion_tokens: output,
                total_tokens: input + output,
            }
        });

        Ok(ChatResponse {
            content,
            model: parsed.model.unwrap_or_else(|| model.to_string()),
            usage,
        })
    }
}
