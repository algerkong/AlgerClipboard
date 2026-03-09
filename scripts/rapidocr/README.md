# RapidOCR Release Tooling

This folder contains helper files for producing the runtime artifacts consumed by AlgerClipboard's in-app OCR installer.

## Files

- `descriptor.example.json`: Example input that describes each platform artifact.
- `generate-manifest.mjs`: Computes SHA-256 for each artifact zip and emits `rapidocr-manifest.json`.
- `build-mock-runtime.mjs`: Builds a local mock runtime zip set for end-to-end installer testing.
- `mock-runtime/`: Minimal mock sidecar implementation used by the local test flow.
- `real-runtime/alger_rapidocr.py`: Real Python RapidOCR wrapper that outputs AlgerClipboard JSON.
- `build-real-runtime.sh`: Builds a macOS standalone runtime zip with PyInstaller on the current macOS machine.
- `build-real-runtime.ps1`: Builds a Windows standalone runtime zip with PyInstaller on a Windows runner or local Windows machine.
- `generate-release-descriptor.mjs`: Generates a CI/release descriptor using GitHub release asset URLs.

## Generate a Manifest

1. Build each platform runtime zip.
2. Copy `descriptor.example.json` and update:
   - `version`
   - `file`
   - `urls`
   - `executable_relpath`
3. Run:

```bash
node scripts/rapidocr/generate-manifest.mjs scripts/rapidocr/descriptor.local.json dist/rapidocr-manifest.json
```

The generated manifest can be uploaded alongside the runtime zips.

## Local E2E Test

Build a mock runtime and descriptor:

```bash
node scripts/rapidocr/build-mock-runtime.mjs
node scripts/rapidocr/generate-manifest.mjs scripts/rapidocr/descriptor.mock.json artifacts/rapidocr/rapidocr-manifest.json
```

Then serve `artifacts/rapidocr` over HTTP and point the app's RapidOCR source to the local manifest.

## Build a Real Local Runtime

For macOS:

```bash
bash scripts/rapidocr/build-real-runtime.sh
node scripts/rapidocr/generate-manifest.mjs scripts/rapidocr/descriptor.real.local.json artifacts/rapidocr-real/rapidocr-manifest.json
```

For Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/rapidocr/build-real-runtime.ps1
node scripts/rapidocr/generate-manifest.mjs scripts/rapidocr/descriptor.real.local.json artifacts/rapidocr-real/rapidocr-manifest.json
```

## GitHub Actions

- Tag pushes (`v*`) build the supported RapidOCR runtimes and attach:
  - `rapidocr-manifest.json`
  - `rapidocr-macos-aarch64.zip`
  - `rapidocr-windows-x86_64.zip`
- Manual workflow `RapidOCR Assets` can attach those assets to an existing release tag.
