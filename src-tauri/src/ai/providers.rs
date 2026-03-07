use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPreset {
    pub id: String,
    pub name: String,
    pub adapter: String,
    pub base_url: String,
    pub models: Vec<String>,
    pub category: String,
}

pub fn get_provider_presets() -> Vec<ProviderPreset> {
    vec![
        // International
        ProviderPreset {
            id: "openai".to_string(),
            name: "OpenAI".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            models: vec![
                "gpt-4o".to_string(),
                "gpt-4o-mini".to_string(),
                "gpt-4-turbo".to_string(),
                "gpt-3.5-turbo".to_string(),
            ],
            category: "international".to_string(),
        },
        ProviderPreset {
            id: "anthropic".to_string(),
            name: "Anthropic (Claude)".to_string(),
            adapter: "anthropic".to_string(),
            base_url: "https://api.anthropic.com".to_string(),
            models: vec![
                "claude-sonnet-4-20250514".to_string(),
                "claude-haiku-4-5-20251001".to_string(),
                "claude-3-5-sonnet-20241022".to_string(),
            ],
            category: "international".to_string(),
        },
        ProviderPreset {
            id: "gemini".to_string(),
            name: "Google Gemini".to_string(),
            adapter: "gemini".to_string(),
            base_url: "https://generativelanguage.googleapis.com".to_string(),
            models: vec![
                "gemini-2.0-flash".to_string(),
                "gemini-1.5-pro".to_string(),
                "gemini-1.5-flash".to_string(),
            ],
            category: "international".to_string(),
        },
        // Domestic CN
        ProviderPreset {
            id: "deepseek".to_string(),
            name: "DeepSeek".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: "https://api.deepseek.com/v1".to_string(),
            models: vec![
                "deepseek-chat".to_string(),
                "deepseek-reasoner".to_string(),
            ],
            category: "domestic".to_string(),
        },
        ProviderPreset {
            id: "qwen".to_string(),
            name: "Qwen (Alibaba)".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
            models: vec![
                "qwen-turbo".to_string(),
                "qwen-plus".to_string(),
                "qwen-max".to_string(),
            ],
            category: "domestic".to_string(),
        },
        ProviderPreset {
            id: "kimi".to_string(),
            name: "Kimi (Moonshot)".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: "https://api.moonshot.cn/v1".to_string(),
            models: vec![
                "moonshot-v1-8k".to_string(),
                "moonshot-v1-32k".to_string(),
                "moonshot-v1-128k".to_string(),
            ],
            category: "domestic".to_string(),
        },
        ProviderPreset {
            id: "glm".to_string(),
            name: "GLM (Zhipu)".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: "https://open.bigmodel.cn/api/paas/v4".to_string(),
            models: vec![
                "glm-4-flash".to_string(),
                "glm-4".to_string(),
                "glm-4-plus".to_string(),
            ],
            category: "domestic".to_string(),
        },
        ProviderPreset {
            id: "ernie".to_string(),
            name: "ERNIE (Baidu)".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: "https://qianfan.baidubce.com/v2".to_string(),
            models: vec![
                "ernie-4.0-8k".to_string(),
                "ernie-3.5-8k".to_string(),
                "ernie-speed-8k".to_string(),
            ],
            category: "domestic".to_string(),
        },
        ProviderPreset {
            id: "doubao".to_string(),
            name: "Doubao (ByteDance)".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: "https://ark.cn-beijing.volces.com/api/v3".to_string(),
            models: vec![
                "doubao-pro-4k".to_string(),
                "doubao-lite-4k".to_string(),
            ],
            category: "domestic".to_string(),
        },
        // Local
        ProviderPreset {
            id: "ollama".to_string(),
            name: "Ollama".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: "http://localhost:11434/v1".to_string(),
            models: vec![
                "llama3".to_string(),
                "mistral".to_string(),
                "codellama".to_string(),
                "qwen2".to_string(),
            ],
            category: "local".to_string(),
        },
        // Custom
        ProviderPreset {
            id: "custom".to_string(),
            name: "Custom".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: String::new(),
            models: Vec::new(),
            category: "custom".to_string(),
        },
    ]
}
