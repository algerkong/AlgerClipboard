Param(
  [string]$PythonExe = "py"
)

$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$VenvDir = Join-Path $RootDir ".rapidocr-real-venv-windows"
$BuildDir = Join-Path $RootDir "artifacts\rapidocr-real-build-windows"
$DistRoot = Join-Path $RootDir "artifacts\rapidocr-real\windows-x86_64\runtime"
$ScriptPath = Join-Path $RootDir "scripts\rapidocr\real-runtime\alger_rapidocr.py"
$ZipPath = Join-Path $RootDir "artifacts\rapidocr-real\windows-x86_64\rapidocr-windows-x86_64.zip"
$DescriptorPath = Join-Path $RootDir "scripts\rapidocr\descriptor.real.local.json"

if (-not (Test-Path $VenvDir)) {
  & $PythonExe -3.12 -m venv $VenvDir
}

$PipPath = Join-Path $VenvDir "Scripts\pip.exe"
$PyInstallerPath = Join-Path $VenvDir "Scripts\pyinstaller.exe"
$SitePackages = Join-Path $VenvDir "Lib\site-packages"
$ModelsDir = Join-Path $SitePackages "rapidocr\models"

& $PipPath install rapidocr onnxruntime pillow pyinstaller

if (Test-Path $BuildDir) {
  Remove-Item $BuildDir -Recurse -Force
}
if (Test-Path $DistRoot) {
  Remove-Item $DistRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path (Join-Path $DistRoot "bin") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $DistRoot "models") | Out-Null

& $PyInstallerPath `
  --noconfirm `
  --clean `
  --onedir `
  --name alger-rapidocr `
  --distpath (Join-Path $BuildDir "dist") `
  --workpath (Join-Path $BuildDir "work") `
  --specpath (Join-Path $BuildDir "spec") `
  --collect-data rapidocr `
  --copy-metadata rapidocr `
  --hidden-import rapidocr `
  --hidden-import rapidocr.main `
  $ScriptPath

Copy-Item -Path (Join-Path $BuildDir "dist\alger-rapidocr\*") -Destination (Join-Path $DistRoot "bin") -Recurse -Force
Copy-Item -Path (Join-Path $ModelsDir "*") -Destination (Join-Path $DistRoot "models") -Recurse -Force

if (Test-Path $ZipPath) {
  Remove-Item $ZipPath -Force
}
Compress-Archive -Path (Join-Path $DistRoot "bin"), (Join-Path $DistRoot "models") -DestinationPath $ZipPath -CompressionLevel Optimal

$descriptor = @"
{
  "version": "real-local-0.1.0",
  "artifacts": [
    {
      "target": "windows-x86_64",
      "file": "../../artifacts/rapidocr-real/windows-x86_64/rapidocr-windows-x86_64.zip",
      "urls": [
        "http://127.0.0.1:9001/windows-x86_64/rapidocr-windows-x86_64.zip"
      ],
      "executable_relpath": "bin/alger-rapidocr.exe"
    }
  ]
}
"@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($DescriptorPath, $descriptor, $utf8NoBom)

Write-Host "Built runtime zip: $ZipPath"
Write-Host "Descriptor: $DescriptorPath"
Write-Host "Next:"
Write-Host "  node scripts/rapidocr/generate-manifest.mjs scripts/rapidocr/descriptor.real.local.json artifacts/rapidocr-real/rapidocr-manifest.json"
