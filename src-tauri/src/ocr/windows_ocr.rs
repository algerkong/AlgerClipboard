use super::{OcrResult, OcrTextLine};
use windows::Graphics::Imaging::BitmapDecoder;
use windows::Media::Ocr::{OcrEngine, OcrResult as WinOcrResult};
use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};

/// Remove spaces between CJK characters that Windows OCR inserts.
/// Windows.Media.Ocr treats each CJK character as a separate "word" and
/// joins them with spaces, producing output like "你 好 世 界".
fn strip_cjk_spaces(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    if chars.len() <= 2 {
        return s.to_string();
    }
    let mut result = String::with_capacity(s.len());
    result.push(chars[0]);
    for i in 1..chars.len() {
        let c = chars[i];
        if c == ' ' {
            // Look at previous non-space and next non-space
            let prev = chars[..i].iter().rev().find(|&&ch| ch != ' ');
            let next = chars[i + 1..].iter().find(|&&ch| ch != ' ');
            if let (Some(&p), Some(&n)) = (prev, next) {
                if is_cjk(p) && is_cjk(n) {
                    continue; // skip space between CJK chars
                }
            }
        }
        result.push(c);
    }
    result
}

fn is_cjk(c: char) -> bool {
    matches!(c,
        '\u{4E00}'..='\u{9FFF}'   // CJK Unified Ideographs
        | '\u{3400}'..='\u{4DBF}' // CJK Unified Ideographs Extension A
        | '\u{F900}'..='\u{FAFF}' // CJK Compatibility Ideographs
        | '\u{3000}'..='\u{303F}' // CJK Symbols and Punctuation
        | '\u{3040}'..='\u{309F}' // Hiragana
        | '\u{30A0}'..='\u{30FF}' // Katakana
        | '\u{AC00}'..='\u{D7AF}' // Hangul Syllables
        | '\u{FF00}'..='\u{FFEF}' // Halfwidth and Fullwidth Forms
        | '\u{2E80}'..='\u{2EFF}' // CJK Radicals Supplement
        | '\u{20000}'..='\u{2A6DF}' // CJK Unified Ideographs Extension B
        | '\u{2A700}'..='\u{2B73F}' // Extension C
        | '\u{2B740}'..='\u{2B81F}' // Extension D
    )
}

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
        let raw_text = line
            .Text()
            .map_err(|e| format!("Failed to get line text: {}", e))?
            .to_string();
        let line_text = strip_cjk_spaces(&raw_text);

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
