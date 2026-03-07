use async_trait::async_trait;
use sha2::{Digest, Sha256};

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
        Self {
            app_key: app_key.trim().to_string(),
            app_secret: app_secret.trim().to_string(),
        }
    }

    fn truncate(text: &str) -> String {
        let char_count = text.chars().count();
        if char_count <= 20 {
            text.to_string()
        } else {
            let first10: String = text.chars().take(10).collect();
            let last10: String = text.chars().skip(char_count - 10).collect();
            format!("{}{}{}", first10, char_count, last10)
        }
    }

    fn map_lang(lang: &str) -> &str {
        match lang {
            "zh" => "zh-CHS",
            other => other,
        }
    }
}

#[async_trait]
impl TranslateEngine for YoudaoTranslator {
    fn name(&self) -> &str {
        "youdao"
    }

    async fn translate(&self, text: &str, from: &str, to: &str) -> Result<String, String> {
        // 有道API限制5000字符，超长时截断
        let char_count = text.chars().count();
        log::debug!(
            "Youdao translate: text length = {} chars, {} bytes",
            char_count,
            text.len()
        );
        let text = if char_count > 5000 {
            let truncated_text: String = text.chars().take(5000).collect();
            log::warn!("Text too long ({} chars), truncating to 5000", char_count);
            truncated_text
        } else {
            text.to_string()
        };
        let text = text.as_str();

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

        log::debug!(
            "Youdao sign params: appKey={}, input(truncated)={}, salt={}, curtime={}, sign={}",
            self.app_key,
            truncated,
            salt,
            curtime,
            sign
        );

        let from_mapped = Self::map_lang(from);
        let to_mapped = Self::map_lang(to);

        let params = [
            ("q", text),
            ("from", from_mapped),
            ("to", to_mapped),
            ("appKey", self.app_key.as_str()),
            ("salt", salt.as_str()),
            ("sign", sign.as_str()),
            ("signType", "v3"),
            ("curtime", curtime.as_str()),
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
            let hint = match body.error_code.as_str() {
                "101" => "缺少必填参数",
                "102" => "不支持的语言类型",
                "103" => "翻译文本过长（上限5000字符）",
                "108" => "应用ID无效，请检查应用ID（appKey）是否正确",
                "110" => "无相关服务的有效实例，请在有道智云后台绑定翻译服务实例",
                "111" => "开发者账号无效",
                "113" => "翻译文本不能为空",
                "202" => "签名校验失败，请确认：1) API Key 填写应用ID 2) API Secret 填写绑定后的应用密钥（绑定服务实例后密钥会更新）",
                "401" => "账户已欠费",
                "411" => "访问频率受限，请稍后重试",
                _ => "",
            };
            return Err(if hint.is_empty() {
                format!("有道API错误码: {}", body.error_code)
            } else {
                format!("有道API错误码 {}: {}", body.error_code, hint)
            });
        }

        let translations = body
            .translation
            .ok_or_else(|| "No translation results from Youdao".to_string())?;

        Ok(translations.join("\n"))
    }
}
