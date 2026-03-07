use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslateResult {
    pub text: String,
    pub translated: String,
    pub from_lang: String,
    pub to_lang: String,
    pub engine: String,
}

#[async_trait]
pub trait TranslateEngine: Send + Sync {
    fn name(&self) -> &str;
    async fn translate(&self, text: &str, from: &str, to: &str) -> Result<String, String>;
}

pub async fn dispatch_translate(
    engines: &[Box<dyn TranslateEngine>],
    text: &str,
    from: &str,
    to: &str,
) -> Result<TranslateResult, String> {
    if engines.is_empty() {
        return Err("No translation engines configured".to_string());
    }

    let mut last_error = String::new();

    for engine in engines {
        match engine.translate(text, from, to).await {
            Ok(translated) => {
                return Ok(TranslateResult {
                    text: text.to_string(),
                    translated,
                    from_lang: from.to_string(),
                    to_lang: to.to_string(),
                    engine: engine.name().to_string(),
                });
            }
            Err(e) => {
                log::warn!("Translation engine '{}' failed: {}", engine.name(), e);
                last_error = format!("{}: {}", engine.name(), e);
            }
        }
    }

    Err(format!(
        "All translation engines failed. Last error: {}",
        last_error
    ))
}
