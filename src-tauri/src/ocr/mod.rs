#[cfg(target_os = "windows")]
mod windows_ocr;

#[cfg(target_os = "windows")]
pub use windows_ocr::extract_text;

#[cfg(not(target_os = "windows"))]
pub fn extract_text(_image_path: &str) -> Result<String, String> {
    Err("OCR is only supported on Windows".to_string())
}
