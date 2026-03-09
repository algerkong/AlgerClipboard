# AlgerClipboard OCR 集成指南

## 目录

- [概述](#概述)
- [支持的 OCR 引擎](#支持的-ocr-引擎)
- [引擎配置](#引擎配置)
  - [原生 OCR](#原生-ocr)
  - [百度 OCR](#百度-ocr)
  - [Google Cloud Vision](#google-cloud-vision)
  - [腾讯 OCR](#腾讯-ocr)
  - [本地模型](#本地模型)
  - [在线模型](#在线模型)
  - [AI 视觉](#ai-视觉)
- [切换引擎](#切换引擎)
- [开发者指南](#开发者指南)
  - [架构概述](#架构概述)
  - [RapidOCR 开发说明](#rapidocr-开发说明)
  - [添加新引擎](#添加新引擎)
  - [关键类型](#关键类型)
  - [坐标系统](#坐标系统)

---

## 概述

AlgerClipboard 支持多种 OCR 引擎，用户可以根据需求选择本地（操作系统原生）OCR 或在线服务以获得更高的识别准确率。所有引擎通过统一接口集成，支持运行时切换。

## 支持的 OCR 引擎

| 引擎 | 类型 | 所需配置 | 说明 |
|------|------|---------|------|
| 原生 OCR | 本地 | 无 | 使用 Windows OCR / macOS Vision / Linux Tesseract，内置离线可用 |
| 百度 OCR | 在线 API | API Key + Secret Key | 中文识别准确率高。免费额度：标准版 50,000 次/月，精确版 500 次/天 |
| Google Cloud Vision | 在线 API | API Key | 多语言支持出色。免费额度：1,000 次/月 |
| 腾讯 OCR | 在线 API | SecretId + SecretKey | 中文支持好。免费额度：1,000 次/月 |
| 本地模型 | 本地模型 | 命令路径 | 运行本地 OCR 模型（如 PaddleOCR、RapidOCR），需手动安装 |
| 在线模型 | 自定义 API | 端点 URL + 可选 API Key | 连接自托管的 OCR 服务 |
| AI 视觉 | AI 模型 | 端点 + API Key + 模型名 | 通过 OpenAI 兼容 API 使用 AI 模型（GPT-4o、Claude、Qwen-VL）进行 OCR |

---

## 引擎配置

### 原生 OCR

原生 OCR 无需额外配置，开箱即用。它使用操作系统内置的 OCR 能力：

- **Windows**：Windows.Media.Ocr API
- **macOS**：Vision 框架
- **Linux**：Tesseract OCR

如果系统中未安装对应语言包，识别准确率可能较低。Windows 用户可在 **设置** → **时间和语言** → **语言和区域** 中添加所需语言包。

### 百度 OCR

1. 访问 [百度智能云 OCR](https://cloud.baidu.com/product/ocr)
2. 注册账号并创建应用，获取 **API Key** 和 **Secret Key**
3. 在 AlgerClipboard 中：**设置** → **OCR** → 启用百度 OCR
4. 填写 API Key 和 Secret Key，点击 **保存**

**免费额度说明：**
- 通用文字识别（标准版）：50,000 次/月
- 通用文字识别（高精度版）：500 次/天
- 超出后按量计费

### Google Cloud Vision

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 启用 **Cloud Vision API**
3. 创建 API Key：**API 和服务** → **凭证** → **创建凭证** → **API 密钥**
4. 在 AlgerClipboard 中：**设置** → **OCR** → 启用 Google Vision
5. 填写 API Key，点击 **保存**

**免费额度说明：**
- 每月前 1,000 次调用免费
- 超出后按量计费

### 腾讯 OCR

1. 访问 [腾讯云 OCR 控制台](https://console.cloud.tencent.com/ocr)
2. 开通 OCR 服务
3. 在 [访问管理](https://console.cloud.tencent.com/cam/capi) 获取 SecretId 和 SecretKey
4. 在 AlgerClipboard 中：**设置** → **OCR** → 启用腾讯 OCR
5. 填写 API Key（SecretId）和 API Secret（SecretKey），点击 **保存**

**免费额度说明：**
- 通用印刷体识别：1,000 次/月
- 超出后按量计费

### 本地模型

本地模型允许你运行如 PaddleOCR、RapidOCR 等本地 OCR 引擎。

**以 PaddleOCR 为例：**

1. 安装 Python 和 PaddleOCR：
   ```bash
   pip install paddleocr
   ```

2. 创建包装脚本，从 stdin 读取 base64 编码的图片数据，将结果以 JSON 格式输出到 stdout

3. 在 AlgerClipboard 中：**设置** → **OCR** → 启用本地模型，填写命令路径，点击 **保存**

**输入/输出协议：**

- 输入：stdin 接收 base64 编码的图片数据
- 输出：stdout 输出 JSON，支持两种格式：

完整格式（包含位置信息）：
```json
{
  "lines": [
    {
      "text": "识别的文字",
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

简单格式（仅文字）：
```json
{
  "text": "所有识别到的文字"
}
```

### 在线模型

在线模型用于连接自托管的 OCR 服务。

1. 部署一个提供 HTTP API 的 OCR 服务
2. 服务应接受 POST 请求，请求体为 JSON：`{"image": "<base64>"}`
3. 如需认证，设置 API Key（以 `Authorization: Bearer <key>` 头发送）
4. 响应格式与本地模型相同
5. 在 AlgerClipboard 中：**设置** → **OCR** → 启用在线模型，填写端点 URL 和可选的 API Key

### AI 视觉

AI 视觉使用 AI 大模型（如 GPT-4o、Claude、Qwen-VL）通过 OpenAI 兼容 API 进行 OCR。

1. 从 AI 服务提供商获取 API Key（OpenAI、Anthropic 代理等）
2. 使用 OpenAI 兼容的端点（如 `https://api.openai.com/v1`）
3. 在 AlgerClipboard 中：**设置** → **OCR** → 启用 AI 视觉
4. 填写端点 URL、API Key 和模型名称（如 `gpt-4o`）
5. 点击 **保存**

**注意：** AI 视觉的调用速度较慢，单次成本较高，但擅长处理复杂排版和提供上下文理解。

---

## 切换引擎

- 在图片预览界面，使用缩放控件旁边的引擎下拉菜单切换 OCR 引擎
- 下拉菜单仅显示已启用且配置正确的引擎
- 默认引擎可在 **设置** → **OCR** → **默认 OCR 引擎** 中设置

---

## 开发者指南

本节面向希望扩展 OCR 功能的开发者。

### 架构概述

- 所有引擎实现 `src-tauri/src/ocr/engine.rs` 中定义的 `OcrEngine` trait
- 引擎配置以 JSON 形式存储在 SQLite settings 表中（key: `ocr_engines`）
- `ocr_cmd.rs` 负责配置加载、引擎构建和调度分发

### RapidOCR 开发说明

RapidOCR 的开发和发布说明已经收敛到单独文档：

- [RapidOCR 开发说明](/Users/alger/code/Project/AlgerClipboard/docs/zh-CN/rapidocr-development.md)

### 添加新引擎

按以下步骤添加新的 OCR 引擎：

**1. 创建引擎实现文件 `src-tauri/src/ocr/my_engine.rs`：**

```rust
use async_trait::async_trait;
use super::engine::OcrEngine;
use super::{OcrResult, OcrTextLine};

pub struct MyEngine { /* 字段 */ }

impl MyEngine {
    pub fn new(/* 参数 */) -> Self { /* ... */ }
}

#[async_trait]
impl OcrEngine for MyEngine {
    fn engine_type(&self) -> &str { "my_engine" }
    fn name(&self) -> &str { "My Engine" }
    async fn recognize(&self, image_data: &[u8]) -> Result<OcrResult, String> {
        // 你的实现
    }
}
```

**2. 在 `src-tauri/src/ocr/mod.rs` 中注册模块：**

```rust
pub mod my_engine;
```

**3. 在 `src-tauri/src/commands/ocr_cmd.rs` 中添加引擎支持：**

- 在 `is_config_usable()` 中添加 `"my_engine"` 的匹配分支，检查必要字段
- 在 `build_engine()` 中添加匹配分支，构造 `MyEngine` 实例
- 在 `engine_label()` 中添加匹配分支，返回显示名称

**4. 在前端 `src/pages/settings/shared.tsx` 中注册：**

```typescript
// 在 OCR_ENGINE_LIST 中添加：
{ id: "my_engine", label: "My Engine", fields: ["apiKey"] as const },
```

**5. 按需添加 i18n 翻译：**

在 `src/i18n/locales/zh-CN.json` 和 `en.json` 中添加对应的翻译键。

### 关键类型

| 类型 | 说明 |
|------|------|
| `OcrEngineConfig` | 可序列化的引擎配置，存储在数据库中 |
| `OcrEngine` trait | 异步 `recognize()` 方法，接收原始图片字节，返回 `OcrResult` |
| `OcrResult` | 包含 `lines: Vec<OcrTextLine>` 和图片尺寸信息 |
| `OcrTextLine` | 识别文本 + 归一化边界框（0.0-1.0） |

### 坐标系统

所有坐标值归一化到 0.0-1.0 范围：

- 原点在图片左上角
- `x`：文本区域左边缘占图片宽度的比例
- `y`：文本区域上边缘占图片高度的比例
- `width`：文本区域宽度占图片宽度的比例
- `height`：文本区域高度占图片高度的比例

示例：一个位于图片中央、宽度为图片一半的文本区域：
```
x: 0.25, y: 0.45, width: 0.5, height: 0.1
```
