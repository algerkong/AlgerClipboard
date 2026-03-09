pub mod ai_vision;
pub mod baidu;
pub mod engine;
pub mod google;
pub mod local_model;
pub mod online_model;
pub mod rapidocr;
pub mod runtime;
pub mod tencent;

#[cfg(target_os = "windows")]
pub mod native;

use serde::{Deserialize, Serialize};

/// A single line of OCR text with its bounding box in normalized coordinates (0.0–1.0).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrTextLine {
    pub text: String,
    /// Left edge as fraction of image width
    pub x: f64,
    /// Top edge as fraction of image height
    pub y: f64,
    /// Width as fraction of image width
    pub width: f64,
    /// Height as fraction of image height
    pub height: f64,
}

/// OCR result containing positioned text lines.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrResult {
    pub lines: Vec<OcrTextLine>,
    pub image_width: u32,
    pub image_height: u32,
}

#[cfg(target_os = "windows")]
mod windows_ocr;
#[cfg(target_os = "windows")]
pub use windows_ocr::extract_text;
