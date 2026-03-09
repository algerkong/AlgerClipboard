use async_trait::async_trait;
use base64::Engine as _;
use serde::Deserialize;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use super::baidu::get_image_dimensions;
use super::engine::OcrEngine;
use super::{OcrResult, OcrTextLine};

/// OCR engine that delegates to a user-configured external command.
///
/// The command receives base64-encoded image data on stdin and must print
/// a JSON result on stdout.  Two response formats are accepted:
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
pub struct LocalModelEngine {
    command: String,
}

impl LocalModelEngine {
    pub fn new(command: String) -> Self {
        Self { command }
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
impl OcrEngine for LocalModelEngine {
    fn engine_type(&self) -> &str {
        "local_model"
    }

    fn name(&self) -> &str {
        "Local Model"
    }

    async fn recognize(&self, image_data: &[u8]) -> Result<OcrResult, String> {
        let (img_w, img_h) = get_image_dimensions(image_data)?;

        // Split command string into program + args.
        let parts: Vec<&str> = self.command.split_whitespace().collect();
        if parts.is_empty() {
            return Err("Local model command is empty".to_string());
        }
        let program = parts[0];
        let args = &parts[1..];

        let mut child = Command::new(program)
            .args(args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| {
                format!(
                    "Failed to start local model command '{}': {}. \
                     Please check that the program is installed and available in your PATH.",
                    program, e
                )
            })?;

        // Write base64-encoded image to stdin.
        let b64 = base64::engine::general_purpose::STANDARD.encode(image_data);
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(b64.as_bytes())
                .await
                .map_err(|e| format!("Failed to write to local model stdin: {}", e))?;
            // Drop stdin to signal EOF.
        }

        let output = child
            .wait_with_output()
            .await
            .map_err(|e| format!("Local model command failed: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!(
                "Local model command exited with {}: {}",
                output.status, stderr
            ));
        }

        let stdout =
            String::from_utf8(output.stdout).map_err(|e| format!("Invalid UTF-8 output: {}", e))?;

        // Try full format first, then simple format.
        if let Ok(full) = serde_json::from_str::<FullResponse>(&stdout) {
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
        } else if let Ok(simple) = serde_json::from_str::<SimpleResponse>(&stdout) {
            Ok(simple_to_ocr_result(&simple.text, img_w, img_h))
        } else {
            Err(format!(
                "Local model returned invalid JSON. Expected either \
                 {{\"lines\":[...],\"image_width\":N,\"image_height\":N}} or \
                 {{\"text\":\"...\"}}. Got: {}",
                stdout.chars().take(200).collect::<String>()
            ))
        }
    }
}
