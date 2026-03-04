use async_trait::async_trait;
use serde::Deserialize;

use super::engine::TranslateEngine;

pub struct GoogleTranslator {
    api_key: String,
}

#[derive(Deserialize)]
struct GoogleResponse {
    data: Option<GoogleData>,
    error: Option<GoogleError>,
}

#[derive(Deserialize)]
struct GoogleData {
    translations: Vec<GoogleTranslation>,
}

#[derive(Deserialize)]
struct GoogleTranslation {
    #[serde(rename = "translatedText")]
    translated_text: String,
}

#[derive(Deserialize)]
struct GoogleError {
    message: String,
}

impl GoogleTranslator {
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }
}

#[async_trait]
impl TranslateEngine for GoogleTranslator {
    fn name(&self) -> &str {
        "google"
    }

    async fn translate(&self, text: &str, from: &str, to: &str) -> Result<String, String> {
        let url = format!(
            "https://translation.googleapis.com/language/translate/v2?key={}",
            urlencoding::encode(&self.api_key)
        );

        let body = serde_json::json!({
            "q": text,
            "source": from,
            "target": to,
            "format": "text"
        });

        let client = reqwest::Client::new();
        let resp = client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Google Translate API request failed: {}", e))?;

        let result: GoogleResponse = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse Google Translate response: {}", e))?;

        if let Some(err) = result.error {
            return Err(format!("Google Translate API error: {}", err.message));
        }

        let data = result
            .data
            .ok_or_else(|| "No data in Google Translate response".to_string())?;

        let translated: Vec<String> = data
            .translations
            .into_iter()
            .map(|t| t.translated_text)
            .collect();

        Ok(translated.join("\n"))
    }
}
