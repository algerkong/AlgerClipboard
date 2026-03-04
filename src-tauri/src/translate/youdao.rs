use async_trait::async_trait;
use sha2::{Sha256, Digest};

use super::engine::TranslateEngine;

pub struct YoudaoTranslator {
    app_key: String,
    app_secret: String,
}

#[derive(serde::Deserialize)]
struct YoudaoResponse {
    #[serde(rename = "errorCode")]
    error_code: String,
    translation: Option<Vec<String>>,
}

impl YoudaoTranslator {
    pub fn new(app_key: String, app_secret: String) -> Self {
        Self { app_key, app_secret }
    }

    fn truncate(text: &str) -> String {
        let len = text.len();
        if len <= 20 {
            text.to_string()
        } else {
            format!(
                "{}{}{}",
                &text[..10],
                len,
                &text[len - 10..]
            )
        }
    }
}

#[async_trait]
impl TranslateEngine for YoudaoTranslator {
    fn name(&self) -> &str {
        "youdao"
    }

    async fn translate(&self, text: &str, from: &str, to: &str) -> Result<String, String> {
        let salt = uuid::Uuid::new_v4().to_string();
        let curtime = chrono::Utc::now().timestamp().to_string();
        let truncated = Self::truncate(text);

        let sign_str = format!(
            "{}{}{}{}{}",
            self.app_key, truncated, salt, curtime, self.app_secret
        );
        let mut hasher = Sha256::new();
        hasher.update(sign_str.as_bytes());
        let sign = hex::encode(hasher.finalize());

        let params = [
            ("q", text),
            ("from", from),
            ("to", to),
            ("appKey", &self.app_key),
            ("salt", &salt),
            ("sign", &sign),
            ("signType", "v3"),
            ("curtime", &curtime),
        ];

        let client = reqwest::Client::new();
        let resp = client
            .post("https://openapi.youdao.com/api")
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("Youdao API request failed: {}", e))?;

        let body: YoudaoResponse = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse Youdao response: {}", e))?;

        if body.error_code != "0" {
            return Err(format!("Youdao API error code: {}", body.error_code));
        }

        let translations = body
            .translation
            .ok_or_else(|| "No translation results from Youdao".to_string())?;

        Ok(translations.join("\n"))
    }
}
