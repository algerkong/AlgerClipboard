# 本地 HTTP API

AlgerClipboard 可以启动一个仅监听 `127.0.0.1` 的本地 REST API，供其他程序读取剪贴板历史、写入条目或操作系统剪贴板。

## 启用

1. 打开「设置 → 数据」。
2. 找到「本地 HTTP API」区域。
3. 打开「启用 HTTP API」，按需设置端口（默认 `25483`）和「允许写入操作」。
4. 点击「保存并应用」。

启用写入或首次启用时，应用会自动生成 API Key。服务只监听本机回环地址，不会暴露到局域网。

## 鉴权

API Key 通过请求头传递：

```
X-API-Key: <your-api-key>
```

也支持查询参数 `?api_key=<your-api-key>`。

规则：

- 未配置 API Key：仅允许只读请求（GET）。
- 已配置 API Key：所有请求都必须携带正确的 Key。
- 关闭「允许写入操作」时，所有非 GET 请求都会被拒绝。
- 频率限制：每个服务实例 100 请求/分钟。

## 响应格式

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

失败时：

```json
{
  "success": false,
  "data": null,
  "error": "Entry not found"
}
```

## 接口

### 服务状态

```bash
curl -H "X-API-Key: <key>" http://127.0.0.1:25483/api/v1/status
```

### 查询历史

```bash
curl -H "X-API-Key: <key>" \
  "http://127.0.0.1:25483/api/v1/entries?limit=20&offset=0&search=keyword&type=PlainText"
```

参数：`limit`（默认 50，最大 200）、`offset`、`search`、`type`（`PlainText` / `RichText` / `Image` / `FilePaths`）。

### 获取单条条目

```bash
curl -H "X-API-Key: <key>" http://127.0.0.1:25483/api/v1/entries/<id>
```

### 新增条目（不写入系统剪贴板）

```bash
curl -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  -d '{"content":"hello","content_type":"PlainText"}' \
  http://127.0.0.1:25483/api/v1/entries
```

可选字段：`html`（富文本内容）、`content_type`。

### 删除条目

```bash
curl -X DELETE -H "X-API-Key: <key>" http://127.0.0.1:25483/api/v1/entries/<id>
```

### 给条目打标签

```bash
curl -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  -d '{"tag":"work"}' \
  http://127.0.0.1:25483/api/v1/entries/<id>/tags
```

### 写入系统剪贴板

```bash
curl -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  -d '{"text":"hello"}' \
  http://127.0.0.1:25483/api/v1/clipboard/write
```

可选字段 `paste: true` 会写入剪贴板并模拟粘贴到当前前台窗口。

### 读取系统剪贴板

```bash
curl -H "X-API-Key: <key>" http://127.0.0.1:25483/api/v1/clipboard/current
```

### 粘贴指定条目

```bash
curl -X POST -H "X-API-Key: <key>" http://127.0.0.1:25483/api/v1/paste/<id>
```

### 标签与模板

```bash
curl -H "X-API-Key: <key>" http://127.0.0.1:25483/api/v1/tags
curl -H "X-API-Key: <key>" http://127.0.0.1:25483/api/v1/templates
```
