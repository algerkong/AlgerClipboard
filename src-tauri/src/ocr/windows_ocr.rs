use super::{OcrResult, OcrTextLine};
use windows::Graphics::Imaging::BitmapDecoder;
use windows::Media::Ocr::{OcrEngine, OcrResult as WinOcrResult};
use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};

pub fn extract_text(image_path: &str) -> Result<OcrResult, String> {
    // Read file using standard Rust I/O to avoid WinRT path limitations
    let file_bytes =
        std::fs::read(image_path).map_err(|e| format!("Failed to read image file: {}", e))?;

    // Create an in-memory stream and write the file bytes into it
    let stream = InMemoryRandomAccessStream::new()
        .map_err(|e| format!("Failed to create memory stream: {}", e))?;
    let writer = DataWriter::CreateDataWriter(&stream)
        .map_err(|e| format!("Failed to create data writer: {}", e))?;
    writer
        .WriteBytes(&file_bytes)
        .map_err(|e| format!("Failed to write image data: {}", e))?;
    writer
        .StoreAsync()
        .map_err(|e| format!("Failed to initiate store: {}", e))?
        .get()
        .map_err(|e| format!("Failed to store data: {}", e))?;
    writer
        .FlushAsync()
        .map_err(|e| format!("Failed to initiate flush: {}", e))?
        .get()
        .map_err(|e| format!("Failed to flush data: {}", e))?;
    writer
        .DetachStream()
        .map_err(|e| format!("Failed to detach stream: {}", e))?;

    // Seek back to the beginning
    stream
        .Seek(0)
        .map_err(|e| format!("Failed to seek stream: {}", e))?;

    // Create bitmap decoder
    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(|e| format!("Failed to initiate decoder: {}", e))?
        .get()
        .map_err(|e| format!("Failed to create bitmap decoder: {}", e))?;

    let img_width = decoder
        .PixelWidth()
        .map_err(|e| format!("Failed to get image width: {}", e))?;
    let img_height = decoder
        .PixelHeight()
        .map_err(|e| format!("Failed to get image height: {}", e))?;

    // Get software bitmap
    let bitmap = decoder
        .GetSoftwareBitmapAsync()
        .map_err(|e| format!("Failed to initiate bitmap read: {}", e))?
        .get()
        .map_err(|e| format!("Failed to get software bitmap: {}", e))?;

    // Create OCR engine
    let engine = if let Ok(engine) = OcrEngine::TryCreateFromUserProfileLanguages() {
        engine
    } else {
        let lang = windows::Globalization::Language::CreateLanguage(&windows::core::HSTRING::from(
            "en-US",
        ))
        .map_err(|e| format!("Failed to create language: {}", e))?;
        OcrEngine::TryCreateFromLanguage(&lang)
            .map_err(|e| format!("Failed to create OCR engine: {}", e))?
    };

    // Run OCR
    let ocr_result: WinOcrResult = engine
        .RecognizeAsync(&bitmap)
        .map_err(|e| format!("Failed to initiate OCR: {}", e))?
        .get()
        .map_err(|e| format!("OCR recognition failed: {}", e))?;

    // Extract lines with bounding boxes
    let ocr_lines = ocr_result
        .Lines()
        .map_err(|e| format!("Failed to get OCR lines: {}", e))?;

    let w = img_width as f64;
    let h = img_height as f64;
    let mut lines = Vec::new();

    for i in 0..ocr_lines.Size().unwrap_or(0) {
        let line = ocr_lines
            .GetAt(i)
            .map_err(|e| format!("Failed to get line at {}: {}", i, e))?;
        let line_text = line
            .Text()
            .map_err(|e| format!("Failed to get line text: {}", e))?
            .to_string();

        // Compute line bounding box from words
        let words = line
            .Words()
            .map_err(|e| format!("Failed to get words: {}", e))?;

        let mut min_x = f64::MAX;
        let mut min_y = f64::MAX;
        let mut max_x = 0.0_f64;
        let mut max_y = 0.0_f64;

        for j in 0..words.Size().unwrap_or(0) {
            let word = words
                .GetAt(j)
                .map_err(|e| format!("Failed to get word: {}", e))?;
            let rect = word
                .BoundingRect()
                .map_err(|e| format!("Failed to get word rect: {}", e))?;
            let wx = rect.X as f64;
            let wy = rect.Y as f64;
            let ww = rect.Width as f64;
            let wh = rect.Height as f64;

            min_x = min_x.min(wx);
            min_y = min_y.min(wy);
            max_x = max_x.max(wx + ww);
            max_y = max_y.max(wy + wh);
        }

        if w > 0.0 && h > 0.0 && min_x < f64::MAX {
            lines.push(OcrTextLine {
                text: line_text,
                x: min_x / w,
                y: min_y / h,
                width: (max_x - min_x) / w,
                height: (max_y - min_y) / h,
            });
        }
    }

    Ok(OcrResult {
        lines,
        image_width: img_width,
        image_height: img_height,
    })
}
