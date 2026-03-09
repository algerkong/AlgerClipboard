use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use super::OcrResult;

/// Configuration for a single OCR engine instance.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrEngineConfig {
    /// Engine type identifier (e.g. "native", "baidu", "tencent", "space_ocr")
    pub engine_type: String,
    /// Whether this engine is enabled
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// API key (for cloud engines)
    #[serde(default)]
    pub api_key: String,
    /// API secret (for cloud engines)
    #[serde(default)]
    pub api_secret: String,
    /// API endpoint URL (for cloud engines)
    #[serde(default)]
    pub endpoint: String,
    /// Model name (for AI-based engines)
    #[serde(default)]
    pub model: String,
    /// External command path (for CLI-based engines)
    #[serde(default)]
    pub command: String,
    /// Extra configuration as JSON string
    #[serde(default)]
    pub extra: String,
}

fn default_true() -> bool {
    true
}

/// Trait that all OCR engine implementations must satisfy.
#[async_trait]
pub trait OcrEngine: Send + Sync {
    /// Returns the engine type identifier (e.g. "native").
    fn engine_type(&self) -> &str;

    /// Returns a human-readable engine name.
    fn name(&self) -> &str;

    /// Perform OCR on raw image bytes (PNG/JPEG/BMP etc.).
    async fn recognize(&self, image_data: &[u8]) -> Result<OcrResult, String>;
}

/// Try each engine in order, returning the first successful result.
/// If all engines fail, returns the last error.
pub async fn dispatch_ocr(
    engines: &[Box<dyn OcrEngine>],
    image_data: &[u8],
) -> Result<OcrResult, String> {
    if engines.is_empty() {
        return Err("No OCR engines available".to_string());
    }

    let mut last_error = String::new();

    for engine in engines {
        match engine.recognize(image_data).await {
            Ok(result) => return Ok(result),
            Err(e) => {
                log::warn!(
                    "OCR engine '{}' ({}) failed: {}",
                    engine.name(),
                    engine.engine_type(),
                    e
                );
                last_error = format!("{} ({}): {}", engine.name(), engine.engine_type(), e);
            }
        }
    }

    Err(format!("All OCR engines failed. Last error: {}", last_error))
}
