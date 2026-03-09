#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
VENV_DIR="$ROOT_DIR/.rapidocr-real-venv"
BUILD_DIR="$ROOT_DIR/artifacts/rapidocr-real-build"
DIST_ROOT="$ROOT_DIR/artifacts/rapidocr-real/macos-aarch64/runtime"
SCRIPT_PATH="$ROOT_DIR/scripts/rapidocr/real-runtime/alger_rapidocr.py"
ZIP_PATH="$ROOT_DIR/artifacts/rapidocr-real/macos-aarch64/rapidocr-macos-aarch64.zip"

if [[ ! -d "$VENV_DIR" ]]; then
  python3 -m venv "$VENV_DIR"
fi

"$VENV_DIR/bin/pip" install rapidocr onnxruntime pillow pyinstaller

rm -rf "$BUILD_DIR" "$DIST_ROOT"
mkdir -p "$BUILD_DIR" "$DIST_ROOT/bin" "$DIST_ROOT/models"

"$VENV_DIR/bin/pyinstaller" \
  --noconfirm \
  --clean \
  --onedir \
  --name alger-rapidocr \
  --distpath "$BUILD_DIR/dist" \
  --workpath "$BUILD_DIR/work" \
  --specpath "$BUILD_DIR/spec" \
  --collect-data rapidocr \
  --copy-metadata rapidocr \
  --hidden-import rapidocr \
  --hidden-import rapidocr.main \
  "$SCRIPT_PATH"

cp -R "$BUILD_DIR/dist/alger-rapidocr/." "$DIST_ROOT/bin/"
cp -R "$VENV_DIR/lib/python3.12/site-packages/rapidocr/models/." "$DIST_ROOT/models/"

rm -f "$ZIP_PATH"
(
  cd "$DIST_ROOT"
  zip -qr "$ZIP_PATH" bin models
)

cat > "$ROOT_DIR/scripts/rapidocr/descriptor.real.local.json" <<EOF
{
  "version": "real-local-0.1.0",
  "artifacts": [
    {
      "target": "macos-aarch64",
      "file": "../../artifacts/rapidocr-real/macos-aarch64/rapidocr-macos-aarch64.zip",
      "urls": [
        "http://127.0.0.1:9001/macos-aarch64/rapidocr-macos-aarch64.zip"
      ],
      "executable_relpath": "bin/alger-rapidocr"
    }
  ]
}
EOF

echo "Built runtime zip: $ZIP_PATH"
echo "Descriptor: $ROOT_DIR/scripts/rapidocr/descriptor.real.local.json"
echo "Next:"
echo "  node scripts/rapidocr/generate-manifest.mjs scripts/rapidocr/descriptor.real.local.json artifacts/rapidocr-real/rapidocr-manifest.json"
