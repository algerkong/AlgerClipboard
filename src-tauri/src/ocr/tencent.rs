use async_trait::async_trait;
use base64::Engine as _;
use chrono::Utc;
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde::Deserialize;
use sha2::{Digest, Sha256};

use super::baidu::get_image_dimensions;
use super::engine::OcrEngine;
use super::{OcrResult, OcrTextLine};

type HmacSha256 = Hmac<Sha256>;

/// Tencent Cloud OCR engine (GeneralBasicOCR).
pub struct TencentOcrEngine {
    secret_id: String,
    secret_key: String,
    client: Client,
}

impl TencentOcrEngine {
    pub fn new(secret_id: String, secret_key: String) -> Self {
        Self {
            secret_id,
            secret_key,
            client: Client::new(),
        }
    }

    /// Build TC3-HMAC-SHA256 authorization header.
    fn build_authorization(
        &self,
        timestamp: i64,
        date: &str,
        payload: &str,
    ) -> String {
        let service = "ocr";
        let host = "ocr.tencentcloudapi.com";
        let content_type = "application/json; charset=utf-8";

        // 1. Canonical request
        let hashed_payload = hex::encode(Sha256::digest(payload.as_bytes()));
        let canonical_request = format!(
            "POST\n/\n\ncontent-type:{}\nhost:{}\n\ncontent-type;host\n{}",
            content_type, host, hashed_payload
        );

        // 2. String to sign
        let credential_scope = format!("{}/{}/tc3_request", date, service);
        let hashed_canonical = hex::encode(Sha256::digest(canonical_request.as_bytes()));
        let string_to_sign = format!(
            "TC3-HMAC-SHA256\n{}\n{}\n{}",
            timestamp, credential_scope, hashed_canonical
        );

        // 3. Signing key chain
        let secret_date = hmac_sha256(
            format!("TC3{}", self.secret_key).as_bytes(),
            date.as_bytes(),
        );
        let secret_service = hmac_sha256(&secret_date, service.as_bytes());
        let secret_signing = hmac_sha256(&secret_service, b"tc3_request");

        // 4. Signature
        let signature = hex::encode(hmac_sha256(&secret_signing, string_to_sign.as_bytes()));

        format!(
            "TC3-HMAC-SHA256 Credential={}/{}, SignedHeaders=content-type;host, Signature={}",
            self.secret_id, credential_scope, signature
        )
    }
}

/// Compute HMAC-SHA256 and return raw bytes.
fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac =
        HmacSha256::new_from_slice(key).expect("HMAC can take key of any size");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

#[derive(Deserialize)]
struct TencentApiResponse {
    #[serde(rename = "Response")]
    response: TencentOcrResponseBody,
}

#[derive(Deserialize)]
struct TencentOcrResponseBody {
    #[serde(default, rename = "TextDetections")]
    text_detections: Vec<TencentTextDetection>,
    #[serde(rename = "Error")]
    error: Option<TencentError>,
}

#[derive(Deserialize)]
struct TencentTextDetection {
    #[serde(rename = "DetectedText")]
    detected_text: String,
    #[serde(rename = "ItemPolygon")]
    item_polygon: Option<TencentItemPolygon>,
}

#[derive(Deserialize)]
struct TencentItemPolygon {
    #[serde(rename = "X")]
    x: f64,
    #[serde(rename = "Y")]
    y: f64,
    #[serde(rename = "Width")]
    width: f64,
    #[serde(rename = "Height")]
    height: f64,
}

#[derive(Deserialize)]
struct TencentError {
    #[serde(rename = "Code")]
    code: String,
    #[serde(rename = "Message")]
    message: String,
}

#[async_trait]
impl OcrEngine for TencentOcrEngine {
    fn engine_type(&self) -> &str {
        "tencent"
    }

    fn name(&self) -> &str {
        "Tencent Cloud OCR"
    }

    async fn recognize(&self, image_data: &[u8]) -> Result<OcrResult, String> {
        let (img_w, img_h) = get_image_dimensions(image_data)?;

        let b64 = base64::engine::general_purpose::STANDARD.encode(image_data);

        let payload = serde_json::json!({
            "ImageBase64": b64
        })
        .to_string();

        let now = Utc::now();
        let timestamp = now.timestamp();
        let date = now.format("%Y-%m-%d").to_string();

        let authorization = self.build_authorization(timestamp, &date, &payload);

        let resp = self
            .client
            .post("https://ocr.tencentcloudapi.com")
            .header("Content-Type", "application/json; charset=utf-8")
            .header("Host", "ocr.tencentcloudapi.com")
            .header("Authorization", &authorization)
            .header("X-TC-Action", "GeneralBasicOCR")
            .header("X-TC-Version", "2018-11-19")
            .header("X-TC-Timestamp", timestamp.to_string())
            .body(payload)
            .send()
            .await
            .map_err(|e| format!("Tencent OCR request failed: {}", e))?;

        let result: TencentApiResponse = resp
            .json()
            .await
            .map_err(|e| format!("Tencent OCR response parse failed: {}", e))?;

        if let Some(err) = result.response.error {
            return Err(format!(
                "Tencent OCR error [{}]: {}",
                err.code, err.message
            ));
        }

        let w = img_w as f64;
        let h = img_h as f64;

        let lines = result
            .response
            .text_detections
            .into_iter()
            .filter_map(|det| {
                let poly = det.item_polygon?;
                Some(OcrTextLine {
                    text: det.detected_text,
                    x: poly.x / w,
                    y: poly.y / h,
                    width: poly.width / w,
                    height: poly.height / h,
                })
            })
            .collect();

        Ok(OcrResult {
            lines,
            image_width: img_w,
            image_height: img_h,
        })
    }
}
