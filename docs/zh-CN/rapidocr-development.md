# RapidOCR 开发说明

## 目标

RapidOCR 在 AlgerClipboard 中以“可下载运行时”的方式集成，用来为 Windows、macOS 和 Linux 提供内置离线 OCR 能力，同时避免把模型和推理依赖直接塞进主安装包。

## 关键文件

- `src-tauri/src/ocr/runtime.rs`
  - 负责运行时安装、移除、状态查询、SHA-256 校验和版本目录管理
- `src-tauri/src/ocr/rapidocr.rs`
  - 负责调用 sidecar 可执行文件，并把结果转换成 `OcrResult`
- `src-tauri/src/commands/ocr_cmd.rs`
  - 负责引擎可用性判断、默认引擎选择、RapidOCR 安装相关 Tauri 命令
- `src/pages/settings/OcrTab.tsx`
  - 负责设置页中的安装、重装、移除和镜像源输入
- `scripts/rapidocr/`
  - 包含本地 mock 运行时、真实运行时包装器、manifest 生成和 release descriptor 工具

## 运行时协议

应用当前要求 RapidOCR sidecar 支持：

```bash
alger-rapidocr --input /path/to/image.png
```

成功时只向 `stdout` 输出 JSON：

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

要求：

- `x` / `y` / `width` / `height` 为 `0.0 - 1.0` 的归一化坐标
- 原点为左上角
- 错误信息输出到 `stderr`
- 不要把日志混入 `stdout`

## 安装流程

1. 前端调用 `get_rapidocr_runtime_status`
2. 用户点击安装后，后端下载 manifest
3. 根据当前平台选择 artifact
4. 下载 zip 并校验 SHA-256
5. 解压到应用数据目录
6. 写入 `current.json`
7. `rapidocr` 引擎变为可用

运行时目录结构：

```text
<app_data>/ocr/rapidocr/
  current.json
  installing.json
  versions/
    <version>/
      bin/alger-rapidocr
      models/
```

## 网络策略

- manifest 支持多个 URL，按顺序回退
- artifact 支持多个镜像 URL，按顺序回退
- 设置页允许用户手动配置 manifest 地址
- 安装失败不能覆盖当前已安装版本

## 本地联调

### Mock 运行时

用于验证安装链路，不提供真实 OCR：

```bash
pnpm rapidocr:mock
node scripts/rapidocr/generate-manifest.mjs scripts/rapidocr/descriptor.mock.json artifacts/rapidocr/rapidocr-manifest.json
cd artifacts/rapidocr
python3 -m http.server 9000
```

然后在设置页把 manifest 改成：

```text
http://127.0.0.1:9000/rapidocr-manifest.json
```

### 真实本地运行时

当前仓库提供了 macOS 和 Windows 的本地打包脚本：

```bash
pnpm rapidocr:real
node scripts/rapidocr/generate-manifest.mjs scripts/rapidocr/descriptor.real.local.json artifacts/rapidocr-real/rapidocr-manifest.json
cd artifacts/rapidocr-real
python3 -m http.server 9001
```

Windows PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/rapidocr/build-real-runtime.ps1
node scripts/rapidocr/generate-manifest.mjs scripts/rapidocr/descriptor.real.local.json artifacts/rapidocr-real/rapidocr-manifest.json
cd artifacts/rapidocr-real
python -m http.server 9001
```

然后在设置页把 manifest 改成：

```text
http://127.0.0.1:9001/rapidocr-manifest.json
```

## 发布

本地发布工具：

- `scripts/rapidocr/generate-manifest.mjs`
- `scripts/rapidocr/generate-release-descriptor.mjs`

GitHub Actions：

- `.github/workflows/build.yml`
  - tag 发版时自动构建并上传 RapidOCR 资产
- `.github/workflows/rapidocr-manual.yml`
  - 手动给已有 release 补传 RapidOCR 资产

当前自动化范围：

- 已支持 `macos-aarch64`
- 已支持 `windows-x86_64`
- `macos-x86_64` 和 `linux-x86_64` 仍需要补充真实构建链路
