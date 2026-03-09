# RapidOCR Development Guide

## Goal

RapidOCR is integrated into AlgerClipboard as a downloadable runtime. It provides built-in offline OCR for Windows, macOS, and Linux without forcing OCR models and inference dependencies into the main app bundle.

## Key Files

- `src-tauri/src/ocr/runtime.rs`
  - runtime install, remove, status, SHA-256 verification, and version directory management
- `src-tauri/src/ocr/rapidocr.rs`
  - sidecar-backed OCR engine that converts runtime output into `OcrResult`
- `src-tauri/src/commands/ocr_cmd.rs`
  - engine availability, default engine selection, and Tauri commands for RapidOCR installation
- `src/pages/settings/OcrTab.tsx`
  - settings UI for install, reinstall, remove, and mirror URL input
- `scripts/rapidocr/`
  - mock runtime, real runtime wrapper, manifest generation, and release descriptor tooling

## Runtime Contract

The app currently expects the RapidOCR sidecar to support:

```bash
alger-rapidocr --input /path/to/image.png
```

On success it must print JSON to `stdout` only:

```json
{
  "lines": [
    {
      "text": "Hello",
      "x": 0.1,
      "y": 0.2,
      "width": 0.3,
      "height": 0.05
    }
  ],
  "image_width": 1920,
  "image_height": 1080
}
```

Requirements:

- `x` / `y` / `width` / `height` must be normalized coordinates in the `0.0 - 1.0` range
- the coordinate origin is top-left
- errors must go to `stderr`
- logs must not be mixed into `stdout`

## Install Flow

1. The frontend calls `get_rapidocr_runtime_status`
2. After the user clicks install, the backend downloads the manifest
3. It selects the artifact for the current platform
4. It downloads the zip and verifies SHA-256
5. It extracts the runtime into the app data directory
6. It writes `current.json`
7. The `rapidocr` engine becomes available

Runtime directory layout:

```text
<app_data>/ocr/rapidocr/
  current.json
  installing.json
  versions/
    <version>/
      bin/alger-rapidocr
      models/
```

## Network Strategy

- the manifest supports multiple fallback URLs
- each artifact supports multiple mirror URLs
- the settings page allows custom manifest URLs
- a failed install must not overwrite the currently installed runtime

## Local Development

### Mock Runtime

Use this to validate the installer flow without real OCR:

```bash
pnpm rapidocr:mock
node scripts/rapidocr/generate-manifest.mjs scripts/rapidocr/descriptor.mock.json artifacts/rapidocr/rapidocr-manifest.json
cd artifacts/rapidocr
python3 -m http.server 9000
```

Then point the settings page to:

```text
http://127.0.0.1:9000/rapidocr-manifest.json
```

### Real Local Runtime

The repo currently includes local packaging flows for macOS and Windows:

```bash
pnpm rapidocr:real
node scripts/rapidocr/generate-manifest.mjs scripts/rapidocr/descriptor.real.local.json artifacts/rapidocr-real/rapidocr-manifest.json
cd artifacts/rapidocr-real
python3 -m http.server 9001
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/rapidocr/build-real-runtime.ps1
node scripts/rapidocr/generate-manifest.mjs scripts/rapidocr/descriptor.real.local.json artifacts/rapidocr-real/rapidocr-manifest.json
cd artifacts/rapidocr-real
python -m http.server 9001
```

Then point the settings page to:

```text
http://127.0.0.1:9001/rapidocr-manifest.json
```

## Release Flow

Local release tools:

- `scripts/rapidocr/generate-manifest.mjs`
- `scripts/rapidocr/generate-release-descriptor.mjs`

GitHub Actions:

- `.github/workflows/build.yml`
  - automatically builds and uploads RapidOCR assets on tag releases
- `.github/workflows/rapidocr-manual.yml`
  - manually attaches RapidOCR assets to an existing release

Current automation scope:

- `macos-aarch64` is implemented
- `windows-x86_64` is implemented
- `macos-x86_64` and `linux-x86_64` still need real build pipelines
