use super::{OcrResult, OcrTextLine};
use std::process::Command;

pub fn extract_text(image_path: &str) -> Result<OcrResult, String> {
    // Get image dimensions via `identify` (ImageMagick) or fallback to tesseract info
    let (img_w, img_h) = get_image_dimensions(image_path)?;

    // Use TSV output to get bounding boxes
    let output = run_tesseract_tsv(image_path, "eng+chi_sim")
        .or_else(|_| run_tesseract_tsv(image_path, "eng"))?;

    let lines = parse_tsv_to_lines(&output, img_w, img_h);

    Ok(OcrResult {
        lines,
        image_width: img_w,
        image_height: img_h,
    })
}

fn run_tesseract_tsv(image_path: &str, lang: &str) -> Result<String, String> {
    let output = Command::new("tesseract")
        .args([image_path, "stdout", "-l", lang, "tsv"])
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "Tesseract is not installed. Install with: sudo apt install tesseract-ocr tesseract-ocr-chi-sim".to_string()
            } else {
                format!("Failed to run Tesseract: {}", e)
            }
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Tesseract failed: {}", stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn get_image_dimensions(image_path: &str) -> Result<(u32, u32), String> {
    // Try Python (most likely available)
    if let Ok(output) = Command::new("python3")
        .args([
            "-c",
            &format!(
                "from PIL import Image; img=Image.open('{}'); print(img.width, img.height)",
                image_path.replace('\'', "\\'")
            ),
        ])
        .output()
    {
        if output.status.success() {
            let s = String::from_utf8_lossy(&output.stdout);
            let parts: Vec<&str> = s.trim().split_whitespace().collect();
            if parts.len() == 2 {
                if let (Ok(w), Ok(h)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                    return Ok((w, h));
                }
            }
        }
    }

    // Try ImageMagick identify
    if let Ok(output) = Command::new("identify")
        .args(["-format", "%w %h", image_path])
        .output()
    {
        if output.status.success() {
            let s = String::from_utf8_lossy(&output.stdout);
            let parts: Vec<&str> = s.trim().split_whitespace().collect();
            if parts.len() == 2 {
                if let (Ok(w), Ok(h)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                    return Ok((w, h));
                }
            }
        }
    }

    // Try file command as last resort - parse dimensions from output
    // Fallback: use dimensions from tesseract TSV (page-level row)
    Err("Cannot determine image dimensions. Install python3-pil or imagemagick.".to_string())
}

/// Parse tesseract TSV output into OcrTextLines.
/// TSV columns: level, page_num, block_num, par_num, line_num, word_num,
///              left, top, width, height, conf, text
/// We aggregate words into lines (same line_num within same block/paragraph).
fn parse_tsv_to_lines(tsv: &str, img_w: u32, img_h: u32) -> Vec<OcrTextLine> {
    let w = img_w as f64;
    let h = img_h as f64;
    if w == 0.0 || h == 0.0 {
        return Vec::new();
    }

    struct LineAcc {
        text: String,
        min_x: f64,
        min_y: f64,
        max_x: f64,
        max_y: f64,
    }

    let mut current_line: Option<(i32, i32, i32, i32, LineAcc)> = None; // (block, par, line_num, LineAcc)
    let mut result: Vec<OcrTextLine> = Vec::new();

    for row in tsv.lines().skip(1) {
        // skip header
        let cols: Vec<&str> = row.split('\t').collect();
        if cols.len() < 12 {
            continue;
        }

        let level: i32 = cols[0].parse().unwrap_or(-1);
        if level != 5 {
            // Only process word-level entries
            // But flush current line if we see a new line/block/par
            if level <= 4 {
                if let Some((_, _, _, _, acc)) = current_line.take() {
                    if !acc.text.trim().is_empty() {
                        result.push(OcrTextLine {
                            text: acc.text.trim().to_string(),
                            x: acc.min_x / w,
                            y: acc.min_y / h,
                            width: (acc.max_x - acc.min_x) / w,
                            height: (acc.max_y - acc.min_y) / h,
                        });
                    }
                }
            }
            continue;
        }

        let block_num: i32 = cols[2].parse().unwrap_or(0);
        let par_num: i32 = cols[3].parse().unwrap_or(0);
        let line_num: i32 = cols[4].parse().unwrap_or(0);
        let left: f64 = cols[6].parse().unwrap_or(0.0);
        let top: f64 = cols[7].parse().unwrap_or(0.0);
        let word_w: f64 = cols[8].parse().unwrap_or(0.0);
        let word_h: f64 = cols[9].parse().unwrap_or(0.0);
        let conf: f64 = cols[10].parse().unwrap_or(-1.0);
        let text = cols[11].trim();

        if text.is_empty() || conf < 0.0 {
            continue;
        }

        let same_line = current_line
            .as_ref()
            .map(|(b, p, l, _, _)| *b == block_num && *p == par_num && *l == line_num)
            .unwrap_or(false);

        if same_line {
            let (_, _, _, _, ref mut acc) = current_line.as_mut().unwrap();
            acc.text.push(' ');
            acc.text.push_str(text);
            acc.min_x = acc.min_x.min(left);
            acc.min_y = acc.min_y.min(top);
            acc.max_x = acc.max_x.max(left + word_w);
            acc.max_y = acc.max_y.max(top + word_h);
        } else {
            // Flush previous line
            if let Some((_, _, _, _, acc)) = current_line.take() {
                if !acc.text.trim().is_empty() {
                    result.push(OcrTextLine {
                        text: acc.text.trim().to_string(),
                        x: acc.min_x / w,
                        y: acc.min_y / h,
                        width: (acc.max_x - acc.min_x) / w,
                        height: (acc.max_y - acc.min_y) / h,
                    });
                }
            }
            current_line = Some((
                block_num,
                par_num,
                line_num,
                0,
                LineAcc {
                    text: text.to_string(),
                    min_x: left,
                    min_y: top,
                    max_x: left + word_w,
                    max_y: top + word_h,
                },
            ));
        }
    }

    // Flush last line
    if let Some((_, _, _, _, acc)) = current_line {
        if !acc.text.trim().is_empty() {
            result.push(OcrTextLine {
                text: acc.text.trim().to_string(),
                x: acc.min_x / w,
                y: acc.min_y / h,
                width: (acc.max_x - acc.min_x) / w,
                height: (acc.max_y - acc.min_y) / h,
            });
        }
    }

    result
}
