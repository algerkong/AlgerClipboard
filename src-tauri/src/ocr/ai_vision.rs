use async_trait::async_trait;
use base64::Engine as _;
use reqwest::Client;
use serde::Deserialize;

use super::baidu::get_image_dimensions;
use super::engine::OcrEngine;
use super::{OcrResult, OcrTextLine};

/// OCR engine that uses an OpenAI-compatible vision model (chat completions API).
pub struct AiVisionEngine {
    endpoint: String,
    api_key: String,
    model: String,
    client: Client,
}

impl AiVisionEngine {
    pub fn new(endpoint: String, api_key: String, model: String) -> Self {
        let model = if model.is_empty() {
            "gpt-4o".to_string()
        } else {
            model
        };
        Self {
            endpoint,
            api_key,
            model,
            client: Client::new(),
        }
    }
}

/// Detect MIME type from magic bytes.
fn detect_mime(data: &[u8]) -> &'static str {
    if data.len() >= 4 && data[0..4] == [0x89, 0x50, 0x4E, 0x47] {
        "image/png"
    } else if data.len() >= 2 && data[0..2] == [0xFF, 0xD8] {
        "image/jpeg"
    } else if data.len() >= 3 && &data[0..3] == b"GIF" {
        "image/gif"
    } else if data.len() >= 4 && &data[0..4] == b"RIFF" && data.len() >= 12 && &data[8..12] == b"WEBP" {
        "image/webp"
    } else {
        "image/png" // fallback
    }
}

/// Build the chat completions URL, appending `/chat/completions` if not present.
fn build_url(endpoint: &str) -> String {
    let trimmed = endpoint.trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else {
        format!("{}/chat/completions", trimmed)
    }
}

/// Strip markdown code fences (```json ... ```) from model output.
fn strip_code_fences(s: &str) -> &str {
    let trimmed = s.trim();
    if let Some(rest) = trimmed.strip_prefix("```") {
        // Skip optional language tag on the first line.
        let rest = if let Some(pos) = rest.find('\n') {
            &rest[pos + 1..]
        } else {
            rest
        };
        // Strip trailing ```
        let rest = rest.trim_end();
        rest.strip_suffix("```").unwrap_or(rest)
    } else {
        trimmed
    }
}

const OCR_PROMPT: &str = "\
You are an OCR engine. Extract all visible text from this image and return the result as JSON. \
Use this exact format:\n\
{\"lines\":[{\"text\":\"line text\",\"x\":0.0,\"y\":0.0,\"width\":1.0,\"height\":0.05}],\"image_width\":0,\"image_height\":0}\n\
\n\
Rules:\n\
- Each element in \"lines\" represents one line of text.\n\
- Coordinates (x, y, width, height) are normalised to 0.0–1.0 relative to image dimensions.\n\
- Set image_width and image_height to 0 (the caller will fill them in).\n\
- Return ONLY the JSON object, no markdown fences, no extra text.\n\
- If no text is found, return {\"lines\":[],\"image_width\":0,\"image_height\":0}.";

// ---------- response deserialization ----------

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: Message,
}

#[derive(Deserialize)]
struct Message {
    content: String,
}

#[derive(Deserialize)]
struct FullResponse {
    lines: Vec<FullLine>,
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

/// Convert plain text into an OcrResult with estimated positions.
fn text_to_ocr_result(text: &str, img_w: u32, img_h: u32) -> OcrResult {
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
impl OcrEngine for AiVisionEngine {
    fn engine_type(&self) -> &str {
        "ai_vision"
    }

    fn name(&self) -> &str {
        "AI Vision"
    }

    async fn recognize(&self, image_data: &[u8]) -> Result<OcrResult, String> {
        let (img_w, img_h) = get_image_dimensions(image_data)?;

        let mime = detect_mime(image_data);
        let b64 = base64::engine::general_purpose::STANDARD.encode(image_data);
        let data_url = format!("data:{};base64,{}", mime, b64);

        let url = build_url(&self.endpoint);

        let body = serde_json::json!({
            "model": self.model,
            "messages": [{
                "role": "user",
                "content": [
                    { "type": "text", "text": OCR_PROMPT },
                    { "type": "image_url", "image_url": { "url": data_url } }
                ]
            }],
            "max_tokens": 4096
        });

        let resp = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("AI Vision request failed: {}", e))?;

        let status = resp.status();
        let resp_body = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read AI Vision response: {}", e))?;

        if !status.is_success() {
            return Err(format!(
                "AI Vision returned HTTP {}: {}",
                status,
                resp_body.chars().take(300).collect::<String>()
            ));
        }

        let chat_resp: ChatCompletionResponse = serde_json::from_str(&resp_body).map_err(|e| {
            format!(
                "Failed to parse AI Vision chat completion response: {}",
                e
            )
        })?;

        let content = chat_resp
            .choices
            .first()
            .map(|c| c.message.content.as_str())
            .unwrap_or("");

        let cleaned = strip_code_fences(content);

        // Try structured JSON first, fall back to plain text.
        if let Ok(full) = serde_json::from_str::<FullResponse>(cleaned) {
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
                image_width: img_w,
                image_height: img_h,
            })
        } else {
            // Treat the whole content as plain text.
            Ok(text_to_ocr_result(content, img_w, img_h))
        }
    }
}
