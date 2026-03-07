use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPreset {
    pub id: String,
    pub name: String,
    pub adapter: String,
    pub base_url: String,
    pub default_model: String,
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
            default_model: "gpt-4o-mini".to_string(),
            category: "international".to_string(),
        },
        ProviderPreset {
            id: "anthropic".to_string(),
            name: "Anthropic (Claude)".to_string(),
            adapter: "anthropic".to_string(),
            base_url: "https://api.anthropic.com".to_string(),
            default_model: "claude-sonnet-4-20250514".to_string(),
            category: "international".to_string(),
        },
        ProviderPreset {
            id: "gemini".to_string(),
            name: "Google Gemini".to_string(),
            adapter: "gemini".to_string(),
            base_url: "https://generativelanguage.googleapis.com".to_string(),
            default_model: "gemini-2.0-flash".to_string(),
            category: "international".to_string(),
        },
        // Domestic CN
        ProviderPreset {
            id: "deepseek".to_string(),
            name: "DeepSeek".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: "https://api.deepseek.com/v1".to_string(),
            default_model: "deepseek-chat".to_string(),
            category: "domestic".to_string(),
        },
        ProviderPreset {
            id: "qwen".to_string(),
            name: "Qwen (Alibaba)".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
            default_model: "qwen-turbo".to_string(),
            category: "domestic".to_string(),
        },
        ProviderPreset {
            id: "kimi".to_string(),
            name: "Kimi (Moonshot)".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: "https://api.moonshot.cn/v1".to_string(),
            default_model: "moonshot-v1-8k".to_string(),
            category: "domestic".to_string(),
        },
        ProviderPreset {
            id: "glm".to_string(),
            name: "GLM (Zhipu)".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: "https://open.bigmodel.cn/api/paas/v4".to_string(),
            default_model: "glm-4-flash".to_string(),
            category: "domestic".to_string(),
        },
        ProviderPreset {
            id: "ernie".to_string(),
            name: "ERNIE (Baidu)".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: "https://qianfan.baidubce.com/v2".to_string(),
            default_model: "ernie-4.0-8k".to_string(),
            category: "domestic".to_string(),
        },
        ProviderPreset {
            id: "doubao".to_string(),
            name: "Doubao (ByteDance)".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: "https://ark.cn-beijing.volces.com/api/v3".to_string(),
            default_model: "doubao-pro-4k".to_string(),
            category: "domestic".to_string(),
        },
        // Local
        ProviderPreset {
            id: "ollama".to_string(),
            name: "Ollama".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: "http://localhost:11434/v1".to_string(),
            default_model: "llama3".to_string(),
            category: "local".to_string(),
        },
        // Custom
        ProviderPreset {
            id: "custom".to_string(),
            name: "Custom".to_string(),
            adapter: "openai_compatible".to_string(),
            base_url: String::new(),
            default_model: String::new(),
            category: "custom".to_string(),
        },
    ]
}
