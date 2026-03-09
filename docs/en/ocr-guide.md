# AlgerClipboard OCR Integration Guide

## Table of Contents

- [Overview](#overview)
- [Supported OCR Engines](#supported-ocr-engines)
- [Engine Configuration](#engine-configuration)
  - [Native OCR](#native-ocr)
  - [Baidu OCR](#baidu-ocr)
  - [Google Cloud Vision](#google-cloud-vision)
  - [Tencent OCR](#tencent-ocr)
  - [Local Model](#local-model)
  - [Online Model](#online-model)
  - [AI Vision](#ai-vision)
- [Switching Engines](#switching-engines)
- [Developer Guide](#developer-guide)
  - [Architecture Overview](#architecture-overview)
  - [Adding a New Engine](#adding-a-new-engine)
  - [Key Types](#key-types)
  - [Coordinate System](#coordinate-system)

---

## Overview

AlgerClipboard supports multiple OCR engines. Users can choose between local (native OS) OCR for offline convenience or online services for better accuracy. All engines are integrated through a unified interface and can be switched at runtime.

## Supported OCR Engines

| Engine | Type | Required Config | Notes |
|--------|------|-----------------|-------|
| Native OCR | Local | None | Uses Windows OCR / macOS Vision / Linux Tesseract. Built-in, works offline. |
| Baidu OCR | Online API | API Key + Secret Key | High accuracy for Chinese. Free tier: 50,000 calls/month (standard), 500 calls/day (accurate). |
| Google Cloud Vision | Online API | API Key | Excellent multi-language support. Free tier: 1,000 calls/month. |
| Tencent OCR | Online API | SecretId + SecretKey | Good Chinese support. Free tier: 1,000 calls/month. |
| Local Model | Local Model | Command | Run local OCR models like PaddleOCR, RapidOCR. Requires manual installation. |
| Online Model | Custom API | Endpoint URL + optional API Key | Connect to self-hosted OCR services. |
| AI Vision | AI Model | Endpoint + API Key + Model name | Use AI models (GPT-4o, Claude, Qwen-VL) for OCR via OpenAI-compatible API. |

---

## Engine Configuration

### Native OCR

Native OCR requires no additional configuration and works out of the box. It uses the operating system's built-in OCR capabilities:

- **Windows**: Windows.Media.Ocr API
- **macOS**: Vision framework
- **Linux**: Tesseract OCR

Recognition accuracy may be lower if the required language packs are not installed. Windows users can add language packs in **Settings** → **Time & Language** → **Language & Region**.

### Baidu OCR

1. Visit [Baidu Cloud OCR](https://cloud.baidu.com/product/ocr)
2. Register an account, create an app, and obtain your **API Key** and **Secret Key**
3. In AlgerClipboard: **Settings** → **OCR** → Enable Baidu OCR
4. Enter your API Key and Secret Key, then click **Save**

**Free tier details:**
- General text recognition (standard): 50,000 calls/month
- General text recognition (high accuracy): 500 calls/day
- Pay-per-use beyond the free quota

### Google Cloud Vision

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Cloud Vision API**
3. Create an API Key: **APIs & Services** → **Credentials** → **Create Credentials** → **API Key**
4. In AlgerClipboard: **Settings** → **OCR** → Enable Google Vision
5. Enter your API Key, then click **Save**

**Free tier details:**
- First 1,000 calls per month are free
- Pay-per-use beyond the free quota

### Tencent OCR

1. Visit [Tencent Cloud OCR Console](https://console.cloud.tencent.com/ocr)
2. Enable the OCR service
3. Get your SecretId and SecretKey from [Access Management](https://console.cloud.tencent.com/cam/capi)
4. In AlgerClipboard: **Settings** → **OCR** → Enable Tencent OCR
5. Enter API Key (SecretId) and API Secret (SecretKey), then click **Save**

**Free tier details:**
- General print recognition: 1,000 calls/month
- Pay-per-use beyond the free quota

### Local Model

Local Model lets you run OCR engines like PaddleOCR or RapidOCR on your machine.

**Example with PaddleOCR:**

1. Install Python and PaddleOCR:
   ```bash
   pip install paddleocr
   ```

2. Create a wrapper script that reads base64-encoded image data from stdin and outputs JSON to stdout

3. In AlgerClipboard: **Settings** → **OCR** → Enable Local Model, enter the command path, then click **Save**

**Input/Output Protocol:**

- Input: stdin receives base64-encoded image data
- Output: stdout must produce JSON in one of two formats:

Full format (with position data):
```json
{
  "lines": [
    {
      "text": "recognized text",
      "x": 0.1,
      "y": 0.2,
      "width": 0.5,
      "height": 0.03
    }
  ],
  "image_width": 800,
  "image_height": 600
}
```

Simple format (text only):
```json
{
  "text": "all recognized text"
}
```

### Online Model

Online Model connects to a self-hosted OCR service via HTTP.

1. Deploy an OCR service with an HTTP API
2. The service should accept POST requests with a JSON body: `{"image": "<base64>"}`
3. If authentication is required, set an API Key (sent as an `Authorization: Bearer <key>` header)
4. Response format is the same as Local Model
5. In AlgerClipboard: **Settings** → **OCR** → Enable Online Model, enter the endpoint URL and optional API Key

### AI Vision

AI Vision uses large AI models (such as GPT-4o, Claude, Qwen-VL) for OCR through an OpenAI-compatible API.

1. Get an API key from your AI provider (OpenAI, Anthropic proxy, etc.)
2. Use an OpenAI-compatible endpoint (e.g., `https://api.openai.com/v1`)
3. In AlgerClipboard: **Settings** → **OCR** → Enable AI Vision
4. Enter the endpoint URL, API Key, and model name (e.g., `gpt-4o`)
5. Click **Save**

**Note:** AI Vision is slower and costs more per call, but excels at handling complex layouts and providing contextual understanding.

---

## Switching Engines

- In the image preview window, use the engine dropdown next to the zoom controls to switch OCR engines
- The dropdown only shows engines that are enabled and properly configured
- The default engine can be set in **Settings** → **OCR** → **Default OCR Engine**

---

## Developer Guide

This section is for developers who want to extend the OCR functionality.

### Architecture Overview

- All engines implement the `OcrEngine` trait defined in `src-tauri/src/ocr/engine.rs`
- Engine configurations are stored as JSON in the SQLite settings table (key: `ocr_engines`)
- `ocr_cmd.rs` handles config loading, engine construction, and dispatch

### Adding a New Engine

Follow these steps to add a new OCR engine:

**1. Create the engine implementation at `src-tauri/src/ocr/my_engine.rs`:**

```rust
use async_trait::async_trait;
use super::engine::OcrEngine;
use super::{OcrResult, OcrTextLine};

pub struct MyEngine { /* fields */ }

impl MyEngine {
    pub fn new(/* params */) -> Self { /* ... */ }
}

#[async_trait]
impl OcrEngine for MyEngine {
    fn engine_type(&self) -> &str { "my_engine" }
    fn name(&self) -> &str { "My Engine" }
    async fn recognize(&self, image_data: &[u8]) -> Result<OcrResult, String> {
        // Your implementation
    }
}
```

**2. Register the module in `src-tauri/src/ocr/mod.rs`:**

```rust
pub mod my_engine;
```

**3. Add engine support in `src-tauri/src/commands/ocr_cmd.rs`:**

- In `is_config_usable()`: add a match arm for `"my_engine"` with required field checks
- In `build_engine()`: add a match arm to construct `MyEngine`
- In `engine_label()`: add a match arm for the display name

**4. Register in the frontend at `src/pages/settings/shared.tsx`:**

```typescript
// In OCR_ENGINE_LIST:
{ id: "my_engine", label: "My Engine", fields: ["apiKey"] as const },
```

**5. Add i18n keys as needed:**

Add corresponding translation keys in `src/i18n/locales/zh-CN.json` and `en.json`.

### Key Types

| Type | Description |
|------|-------------|
| `OcrEngineConfig` | Serializable engine config stored in the database |
| `OcrEngine` trait | Async `recognize()` method that takes raw image bytes and returns `OcrResult` |
| `OcrResult` | Contains `lines: Vec<OcrTextLine>` and image dimensions |
| `OcrTextLine` | Recognized text + normalized bounding box (0.0–1.0) |

### Coordinate System

All coordinate values are normalized to the 0.0–1.0 range:

- Origin is at the top-left corner of the image
- `x`: left edge of the text region as a fraction of image width
- `y`: top edge of the text region as a fraction of image height
- `width`: text region width as a fraction of image width
- `height`: text region height as a fraction of image height

Example — a text region centered horizontally, spanning half the image width:
```
x: 0.25, y: 0.45, width: 0.5, height: 0.1
```
