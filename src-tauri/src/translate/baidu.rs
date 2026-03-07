use async_trait::async_trait;
use md5::{Digest, Md5};
use serde::Deserialize;

use super::engine::TranslateEngine;

pub struct BaiduTranslator {
    app_id: String,
    secret_key: String,
}

#[derive(Deserialize)]
struct BaiduResponse {
    trans_result: Option<Vec<BaiduTransItem>>,
    error_code: Option<String>,
    error_msg: Option<String>,
}

#[derive(Deserialize)]
struct BaiduTransItem {
    dst: String,
}

impl BaiduTranslator {
    pub fn new(app_id: String, secret_key: String) -> Self {
        Self { app_id, secret_key }
    }
}

#[async_trait]
impl TranslateEngine for BaiduTranslator {
    fn name(&self) -> &str {
        "baidu"
    }

    async fn translate(&self, text: &str, from: &str, to: &str) -> Result<String, String> {
        let salt = uuid::Uuid::new_v4().to_string();
        let sign_str = format!("{}{}{}{}", self.app_id, text, salt, self.secret_key);
        let mut hasher = Md5::new();
        hasher.update(sign_str.as_bytes());
        let sign = hex::encode(hasher.finalize());

        let params = [
            ("q", text),
            ("from", from),
            ("to", to),
            ("appid", &self.app_id),
            ("salt", &salt),
            ("sign", &sign),
        ];

        let client = reqwest::Client::new();
        let resp = client
            .post("https://fanyi-api.baidu.com/api/trans/vip/translate")
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("Baidu API request failed: {}", e))?;

        let body: BaiduResponse = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse Baidu response: {}", e))?;

        if let Some(code) = &body.error_code {
            let msg = body.error_msg.as_deref().unwrap_or("Unknown error");
            return Err(format!("Baidu API error {}: {}", code, msg));
        }

        let results = body
            .trans_result
            .ok_or_else(|| "No translation results from Baidu".to_string())?;

        let translated: Vec<String> = results.into_iter().map(|item| item.dst).collect();
        Ok(translated.join("\n"))
    }
}
