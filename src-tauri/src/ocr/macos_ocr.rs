use super::{OcrResult, OcrTextLine};
use std::process::Command;

fn simplify_swift_ocr_error(stderr: &str) -> String {
    if stderr.contains("this SDK is not supported by the compiler")
        || stderr.contains("redefinition of module 'SwiftBridging'")
    {
        return "macOS native OCR could not start because the active Apple developer tools are inconsistent. Reinstall Command Line Tools with `sudo rm -rf /Library/Developer/CommandLineTools && xcode-select --install`, or switch to a full Xcode toolchain with `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.".to_string();
    }

    stderr.trim().to_string()
}

pub fn extract_text(image_path: &str) -> Result<OcrResult, String> {
    // Swift script that uses Vision framework and outputs JSON with bounding boxes.
    // Vision's boundingBox uses normalized coords with origin at bottom-left,
    // so we flip y to top-left origin.
    let swift_script = r#"
import Foundation
import Vision

let args = CommandLine.arguments
guard args.count > 1 else {
    fputs("Usage: ocr <image_path>\n", stderr)
    exit(1)
}
let imagePath = args[1]
guard let url = URL(fileURLWithPath: imagePath) as URL?,
      let imageSource = CGImageSourceCreateWithURL(url as CFURL, nil),
      let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
    fputs("Failed to load image\n", stderr)
    exit(1)
}

let imgWidth = CGImageGetWidth(cgImage)
let imgHeight = CGImageGetHeight(cgImage)

let semaphore = DispatchSemaphore(value: 0)
var jsonLines: [[String: Any]] = []

let request = VNRecognizeTextRequest { request, error in
    if let error = error {
        fputs("OCR error: \(error.localizedDescription)\n", stderr)
        semaphore.signal()
        return
    }
    guard let observations = request.results as? [VNRecognizedTextObservation] else {
        semaphore.signal()
        return
    }
    for obs in observations {
        guard let candidate = obs.topCandidates(1).first else { continue }
        let bb = obs.boundingBox
        // Vision: origin bottom-left, flip y to top-left
        let entry: [String: Any] = [
            "text": candidate.string,
            "x": bb.origin.x,
            "y": 1.0 - bb.origin.y - bb.size.height,
            "width": bb.size.width,
            "height": bb.size.height
        ]
        jsonLines.append(entry)
    }
    semaphore.signal()
}

request.recognitionLevel = .accurate
if #available(macOS 12.0, *) {
    request.revision = VNRecognizeTextRequestRevision3
    request.recognitionLanguages = ["en", "zh-Hans", "zh-Hant", "ja", "ko"]
} else {
    request.recognitionLanguages = ["en", "zh-Hans", "zh-Hant"]
}

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
} catch {
    fputs("Failed to perform OCR: \(error.localizedDescription)\n", stderr)
    exit(1)
}

semaphore.wait()

let result: [String: Any] = [
    "lines": jsonLines,
    "image_width": imgWidth,
    "image_height": imgHeight
]
if let data = try? JSONSerialization.data(withJSONObject: result),
   let str = String(data: data, encoding: .utf8) {
    print(str)
}
"#;

    let output = Command::new("swift")
        .arg("-")
        .arg(image_path)
        .env_remove("SDKROOT")
        .env_remove("DEVELOPER_DIR")
        .env_remove("TOOLCHAINS")
        .env_remove("CPATH")
        .env_remove("C_INCLUDE_PATH")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            if let Some(ref mut stdin) = child.stdin {
                stdin.write_all(swift_script.as_bytes())?;
            }
            child.wait_with_output()
        })
        .map_err(|e| format!("Failed to run Swift OCR: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("OCR failed: {}", simplify_swift_ocr_error(&stderr)));
    }

    let json_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if json_str.is_empty() {
        return Ok(OcrResult {
            lines: Vec::new(),
            image_width: 0,
            image_height: 0,
        });
    }

    // Parse JSON output
    let parsed: serde_json::Value =
        serde_json::from_str(&json_str).map_err(|e| format!("Failed to parse OCR JSON: {}", e))?;

    let image_width = parsed["image_width"].as_u64().unwrap_or(0) as u32;
    let image_height = parsed["image_height"].as_u64().unwrap_or(0) as u32;

    let lines = parsed["lines"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    Some(OcrTextLine {
                        text: item["text"].as_str()?.to_string(),
                        x: item["x"].as_f64()?,
                        y: item["y"].as_f64()?,
                        width: item["width"].as_f64()?,
                        height: item["height"].as_f64()?,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(OcrResult {
        lines,
        image_width,
        image_height,
    })
}
