use async_trait::async_trait;
use base64::Engine as _;
use reqwest::Client;
use serde::Deserialize;

use super::baidu::get_image_dimensions;
use super::engine::OcrEngine;
use super::{OcrResult, OcrTextLine};

/// OCR engine that calls a user-provided HTTP endpoint.
///
/// The endpoint receives a JSON POST body `{"image": "<base64>"}` and must
/// return a JSON response in one of two formats:
///
/// **Full format** (with bounding boxes, coordinates normalised 0.0–1.0):
/// ```json
/// {"lines":[{"text":"...","x":0.1,"y":0.2,"width":0.5,"height":0.05}],
///  "image_width":800,"image_height":600}
/// ```
///
/// **Simple format** (plain text only):
/// ```json
/// {"text":"line1\nline2\nline3"}
/// ```
pub struct OnlineModelEngine {
    endpoint: String,
    api_key: String,
    client: Client,
}

impl OnlineModelEngine {
    pub fn new(endpoint: String, api_key: String) -> Self {
        Self {
            endpoint,
            api_key,
            client: Client::new(),
        }
    }
}

// ---------- response deserialization ----------

#[derive(Deserialize)]
struct FullResponse {
    lines: Vec<FullLine>,
    image_width: u32,
    image_height: u32,
}

#[derive(Deserialize)]
struct FullLine {
    text: String,
    #[serde(default)]
    x: f64,
    #[serde(default)]
    y: f64,
    #[serde(default)]
    width: f64,
    #[serde(default)]
    height: f64,
}

#[derive(Deserialize)]
struct SimpleResponse {
    text: String,
}

/// Convert a simple text response into an OcrResult with estimated positions.
fn simple_to_ocr_result(text: &str, img_w: u32, img_h: u32) -> OcrResult {
    let raw_lines: Vec<&str> = text.lines().filter(|l| !l.is_empty()).collect();
    let count = raw_lines.len().max(1) as f64;
    let line_height = 1.0 / count;

    let lines = raw_lines
        .into_iter()
        .enumerate()
        .map(|(i, l)| OcrTextLine {
            text: l.to_string(),
            x: 0.0,
            y: i as f64 * line_height,
            width: 1.0,
            height: line_height,
        })
        .collect();

    OcrResult {
        lines,
        image_width: img_w,
        image_height: img_h,
    }
}

#[async_trait]
impl OcrEngine for OnlineModelEngine {
    fn engine_type(&self) -> &str {
        "online_model"
    }

    fn name(&self) -> &str {
        "Online Model"
    }

    async fn recognize(&self, image_data: &[u8]) -> Result<OcrResult, String> {
        let (img_w, img_h) = get_image_dimensions(image_data)?;

        let b64 = base64::engine::general_purpose::STANDARD.encode(image_data);

        let mut req = self
            .client
            .post(&self.endpoint)
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({ "image": b64 }));

        if !self.api_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", self.api_key));
        }

        let resp = req
            .send()
            .await
            .map_err(|e| format!("Online model request failed: {}", e))?;

        let status = resp.status();
        let body = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read online model response: {}", e))?;

        if !status.is_success() {
            return Err(format!(
                "Online model returned HTTP {}: {}",
                status,
                body.chars().take(300).collect::<String>()
            ));
        }

        // Try full format first, then simple format.
        if let Ok(full) = serde_json::from_str::<FullResponse>(&body) {
            let lines = full
                .lines
                .into_iter()
                .map(|l| OcrTextLine {
                    text: l.text,
                    x: l.x,
                    y: l.y,
                    width: l.width,
                    height: l.height,
                })
                .collect();
            Ok(OcrResult {
                lines,
                image_width: full.image_width,
                image_height: full.image_height,
            })
        } else if let Ok(simple) = serde_json::from_str::<SimpleResponse>(&body) {
            Ok(simple_to_ocr_result(&simple.text, img_w, img_h))
        } else {
            Err(format!(
                "Online model returned invalid JSON. Expected either \
                 {{\"lines\":[...],\"image_width\":N,\"image_height\":N}} or \
                 {{\"text\":\"...\"}}. Got: {}",
                body.chars().take(200).collect::<String>()
            ))
        }
    }
}
