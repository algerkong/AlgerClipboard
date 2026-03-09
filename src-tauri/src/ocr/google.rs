use async_trait::async_trait;
use base64::Engine as _;
use reqwest::Client;
use serde::Deserialize;

use super::baidu::get_image_dimensions;
use super::engine::OcrEngine;
use super::{OcrResult, OcrTextLine};

/// Google Cloud Vision OCR engine.
pub struct GoogleVisionEngine {
    api_key: String,
    client: Client,
}

impl GoogleVisionEngine {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: Client::new(),
        }
    }
}

#[derive(Deserialize)]
struct VisionResponse {
    #[serde(default)]
    responses: Vec<AnnotateImageResponse>,
}

#[derive(Deserialize)]
struct AnnotateImageResponse {
    #[serde(default, rename = "textAnnotations")]
    text_annotations: Vec<TextAnnotation>,
    #[serde(default)]
    error: Option<VisionError>,
}

#[derive(Deserialize)]
struct TextAnnotation {
    description: String,
    #[serde(rename = "boundingPoly")]
    bounding_poly: Option<BoundingPoly>,
}

#[derive(Deserialize)]
struct BoundingPoly {
    vertices: Vec<Vertex>,
}

#[derive(Deserialize)]
struct Vertex {
    #[serde(default)]
    x: f64,
    #[serde(default)]
    y: f64,
}

#[derive(Deserialize)]
struct VisionError {
    message: String,
}

#[async_trait]
impl OcrEngine for GoogleVisionEngine {
    fn engine_type(&self) -> &str {
        "google"
    }

    fn name(&self) -> &str {
        "Google Cloud Vision"
    }

    async fn recognize(&self, image_data: &[u8]) -> Result<OcrResult, String> {
        let (img_w, img_h) = get_image_dimensions(image_data)?;

        let b64 = base64::engine::general_purpose::STANDARD.encode(image_data);

        let url = format!(
            "https://vision.googleapis.com/v1/images:annotate?key={}",
            self.api_key
        );

        let body = serde_json::json!({
            "requests": [{
                "image": { "content": b64 },
                "features": [{ "type": "TEXT_DETECTION" }]
            }]
        });

        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Google Vision request failed: {}", e))?;

        let result: VisionResponse = resp
            .json()
            .await
            .map_err(|e| format!("Google Vision response parse failed: {}", e))?;

        let annotate = result
            .responses
            .into_iter()
            .next()
            .ok_or_else(|| "Google Vision returned empty responses".to_string())?;

        if let Some(err) = annotate.error {
            return Err(format!("Google Vision error: {}", err.message));
        }

        let w = img_w as f64;
        let h = img_h as f64;

        // First annotation is the full concatenated text; skip it.
        let lines = annotate
            .text_annotations
            .into_iter()
            .skip(1)
            .filter_map(|ann| {
                let poly = ann.bounding_poly?;
                if poly.vertices.len() < 4 {
                    return None;
                }
                // vertices: top-left, top-right, bottom-right, bottom-left
                let tl = &poly.vertices[0];
                let br = &poly.vertices[2];
                let x = tl.x / w;
                let y = tl.y / h;
                let width = (br.x - tl.x) / w;
                let height = (br.y - tl.y) / h;
                Some(OcrTextLine {
                    text: ann.description,
                    x,
                    y,
                    width,
                    height,
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
