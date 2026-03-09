use async_trait::async_trait;
use serde::Deserialize;
use tokio::process::Command;
use uuid::Uuid;

use super::engine::OcrEngine;
use super::{OcrResult, OcrTextLine};

pub struct RapidOcrEngine {
    executable_path: String,
}

impl RapidOcrEngine {
    pub fn new(executable_path: String) -> Self {
        Self { executable_path }
    }
}

#[derive(Deserialize)]
struct RapidOcrResponse {
    lines: Vec<RapidOcrLine>,
    image_width: u32,
    image_height: u32,
}

#[derive(Deserialize)]
struct RapidOcrLine {
    text: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[async_trait]
impl OcrEngine for RapidOcrEngine {
    fn engine_type(&self) -> &str {
        "rapidocr"
    }

    fn name(&self) -> &str {
        "RapidOCR"
    }

    async fn recognize(&self, image_data: &[u8]) -> Result<OcrResult, String> {
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!("alger_rapidocr_{}.png", Uuid::new_v4()));
        std::fs::write(&temp_file, image_data)
            .map_err(|e| format!("Failed to write temp image file: {}", e))?;

        let output = Command::new(&self.executable_path)
            .arg("--input")
            .arg(&temp_file)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .output()
            .await
            .map_err(|e| format!("Failed to start RapidOCR runtime: {}", e))?;

        let _ = std::fs::remove_file(&temp_file);

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if stderr.is_empty() {
                format!("RapidOCR runtime exited with {}", output.status)
            } else {
                format!("RapidOCR runtime exited with {}: {}", output.status, stderr)
            });
        }

        let stdout = String::from_utf8(output.stdout)
            .map_err(|e| format!("RapidOCR runtime returned invalid UTF-8: {}", e))?;
        let parsed: RapidOcrResponse = serde_json::from_str(&stdout)
            .map_err(|e| format!("RapidOCR runtime returned invalid JSON: {}", e))?;

        Ok(OcrResult {
            lines: parsed
                .lines
                .into_iter()
                .map(|line| OcrTextLine {
                    text: line.text,
                    x: line.x,
                    y: line.y,
                    width: line.width,
                    height: line.height,
                })
                .collect(),
            image_width: parsed.image_width,
            image_height: parsed.image_height,
        })
    }
}
