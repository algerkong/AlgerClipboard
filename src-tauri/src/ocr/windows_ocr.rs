use windows::Graphics::Imaging::BitmapDecoder;
use windows::Media::Ocr::OcrEngine;
use windows::Storage::StorageFile;
use windows::Storage::Streams::RandomAccessStreamReference;

pub fn extract_text(image_path: &str) -> Result<String, String> {
    let path = windows::core::HSTRING::from(image_path);

    // Open the image file (blocking)
    let file = StorageFile::GetFileFromPathAsync(&path)
        .map_err(|e| format!("Failed to initiate file open: {}", e))?
        .get()
        .map_err(|e| format!("Failed to open image file: {}", e))?;

    // Open a random access stream from the file
    let stream = RandomAccessStreamReference::CreateFromFile(&file)
        .map_err(|e| format!("Failed to create stream reference: {}", e))?
        .OpenReadAsync()
        .map_err(|e| format!("Failed to initiate stream open: {}", e))?
        .get()
        .map_err(|e| format!("Failed to open stream: {}", e))?;

    // Create bitmap decoder
    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(|e| format!("Failed to initiate decoder: {}", e))?
        .get()
        .map_err(|e| format!("Failed to create bitmap decoder: {}", e))?;

    // Get software bitmap
    let bitmap = decoder
        .GetSoftwareBitmapAsync()
        .map_err(|e| format!("Failed to initiate bitmap read: {}", e))?
        .get()
        .map_err(|e| format!("Failed to get software bitmap: {}", e))?;

    // Try to create OCR engine
    let engine = if let Ok(engine) = OcrEngine::TryCreateFromUserProfileLanguages() {
        engine
    } else {
        let lang = windows::Globalization::Language::CreateLanguage(
            &windows::core::HSTRING::from("en-US"),
        )
        .map_err(|e| format!("Failed to create language: {}", e))?;
        OcrEngine::TryCreateFromLanguage(&lang)
            .map_err(|e| format!("Failed to create OCR engine: {}", e))?
    };

    // Run OCR (blocking)
    let result = engine
        .RecognizeAsync(&bitmap)
        .map_err(|e| format!("Failed to initiate OCR: {}", e))?
        .get()
        .map_err(|e| format!("OCR recognition failed: {}", e))?;

    // Extract text
    let text = result
        .Text()
        .map_err(|e| format!("Failed to get OCR text: {}", e))?;

    Ok(text.to_string())
}
