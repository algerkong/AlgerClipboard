use async_trait::async_trait;
use base64::Engine as _;
use reqwest::Client;
use serde::Deserialize;
use std::sync::Mutex;

use super::engine::OcrEngine;
use super::{OcrResult, OcrTextLine};

/// Decode image bytes to get (width, height) using the `image` crate.
pub(crate) fn get_image_dimensions(data: &[u8]) -> Result<(u32, u32), String> {
    let reader = image::ImageReader::new(std::io::Cursor::new(data))
        .with_guessed_format()
        .map_err(|e| format!("Failed to guess image format: {}", e))?;
    let dims = reader
        .into_dimensions()
        .map_err(|e| format!("Failed to read image dimensions: {}", e))?;
    Ok(dims)
}

/// Baidu Cloud OCR engine (高精度版).
pub struct BaiduOcrEngine {
    api_key: String,
    secret_key: String,
    client: Client,
    /// Cached access token; refreshed on demand.
    access_token: Mutex<Option<String>>,
}

impl BaiduOcrEngine {
    pub fn new(api_key: String, secret_key: String) -> Self {
        Self {
            api_key,
            secret_key,
            client: Client::new(),
            access_token: Mutex::new(None),
        }
    }

    /// Fetch (or return cached) access token via client_credentials grant.
    async fn get_access_token(&self) -> Result<String, String> {
        // Check cache first.
        {
            let guard = self.access_token.lock().unwrap();
            if let Some(ref token) = *guard {
                return Ok(token.clone());
            }
        }

        let url = format!(
            "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id={}&client_secret={}",
            self.api_key, self.secret_key
        );

        let resp = self
            .client
            .post(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| format!("Baidu token request failed: {}", e))?;

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("Baidu token parse failed: {}", e))?;

        let token = body["access_token"]
            .as_str()
            .ok_or_else(|| format!("Baidu token response missing access_token: {}", body))?
            .to_string();

        // Cache it.
        {
            let mut guard = self.access_token.lock().unwrap();
            *guard = Some(token.clone());
        }

        Ok(token)
    }
}

#[derive(Deserialize)]
struct BaiduOcrResponse {
    #[serde(default)]
    words_result: Vec<BaiduWord>,
    #[serde(default)]
    error_msg: Option<String>,
    #[serde(default)]
    error_code: Option<i64>,
}

#[derive(Deserialize)]
struct BaiduWord {
    words: String,
    location: BaiduLocation,
}

#[derive(Deserialize)]
struct BaiduLocation {
    left: f64,
    top: f64,
    width: f64,
    height: f64,
}

#[async_trait]
impl OcrEngine for BaiduOcrEngine {
    fn engine_type(&self) -> &str {
        "baidu"
    }

    fn name(&self) -> &str {
        "Baidu OCR"
    }

    async fn recognize(&self, image_data: &[u8]) -> Result<OcrResult, String> {
        let (img_w, img_h) = get_image_dimensions(image_data)?;

        let token = self.get_access_token().await?;

        let b64 = base64::engine::general_purpose::STANDARD.encode(image_data);

        let url = format!(
            "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate?access_token={}",
            token
        );

        let resp = self
            .client
            .post(&url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(format!("image={}", urlencoding::encode(&b64)))
            .send()
            .await
            .map_err(|e| format!("Baidu OCR request failed: {}", e))?;

        let result: BaiduOcrResponse = resp
            .json()
            .await
            .map_err(|e| format!("Baidu OCR response parse failed: {}", e))?;

        // If the token expired, clear cache and return error so dispatch can retry.
        if let Some(code) = result.error_code {
            if code == 110 || code == 111 {
                let mut guard = self.access_token.lock().unwrap();
                *guard = None;
            }
            return Err(format!(
                "Baidu OCR error {}: {}",
                code,
                result.error_msg.unwrap_or_default()
            ));
        }

        let w = img_w as f64;
        let h = img_h as f64;

        let lines = result
            .words_result
            .into_iter()
            .map(|word| OcrTextLine {
                text: word.words,
                x: word.location.left / w,
                y: word.location.top / h,
                width: word.location.width / w,
                height: word.location.height / h,
            })
            .collect();

        Ok(OcrResult {
            lines,
            image_width: img_w,
            image_height: img_h,
        })
    }
}
