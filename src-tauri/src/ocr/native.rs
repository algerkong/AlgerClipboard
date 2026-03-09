use async_trait::async_trait;
#[cfg(target_os = "windows")]
use uuid::Uuid;

use super::engine::OcrEngine;
use super::OcrResult;

/// OCR engine backed by the platform's native OCR API.
///
/// On Windows this uses Windows.Media.Ocr, on macOS it uses Vision framework,
/// and on Linux it falls back to tesseract (if available).
pub struct NativeOcrEngine;

impl NativeOcrEngine {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl OcrEngine for NativeOcrEngine {
    fn engine_type(&self) -> &str {
        "native"
    }

    fn name(&self) -> &str {
        "Native OS OCR"
    }

    async fn recognize(&self, image_data: &[u8]) -> Result<OcrResult, String> {
        #[cfg(not(target_os = "windows"))]
        {
            let _ = image_data;
            return Err("Native OCR is only supported on Windows in this build".to_string());
        }

        #[cfg(target_os = "windows")]
        {
            // Write image data to a temp file since the native API expects a file path.
            let temp_dir = std::env::temp_dir();
            let temp_file = temp_dir.join(format!("alger_ocr_{}.png", Uuid::new_v4()));
            let temp_path = temp_file.clone();

            // Copy data into owned Vec so we can move it into the blocking task.
            let data = image_data.to_vec();

            let result = tokio::task::spawn_blocking(move || {
                // Write temp file
                std::fs::write(&temp_path, &data)
                    .map_err(|e| format!("Failed to write temp image file: {}", e))?;

                // Call the existing platform-specific extract_text
                let ocr_result = super::extract_text(
                    temp_path
                        .to_str()
                        .ok_or_else(|| "Invalid temp file path".to_string())?,
                );

                // Clean up temp file (best effort)
                let _ = std::fs::remove_file(&temp_path);

                ocr_result
            })
            .await
            .map_err(|e| format!("OCR task panicked: {}", e))?;

            // Clean up in case spawn_blocking succeeded but we still have the path
            // (already cleaned inside the closure, this is a safety net)
            let _ = std::fs::remove_file(&temp_file);

            result
        }
    }
}
