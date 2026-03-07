use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub content: String,
    pub model: String,
    pub usage: Option<TokenUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[async_trait]
pub trait AiEngine: Send + Sync {
    fn name(&self) -> &str;
    async fn chat(&self, messages: &[ChatMessage], model: &str) -> Result<ChatResponse, String>;
    async fn test_connection(&self, model: &str) -> Result<String, String> {
        let msg = ChatMessage {
            role: "user".to_string(),
            content: "Hi".to_string(),
        };
        let resp = self.chat(&[msg], model).await?;
        Ok(resp.content)
    }
}
