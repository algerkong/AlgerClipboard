# Local HTTP API

AlgerClipboard can expose a local REST API bound to `127.0.0.1` only, allowing other applications to read clipboard history, create entries, and interact with the system clipboard.

## Enabling

1. Open **Settings → Data**.
2. Find the **Local HTTP API** section.
3. Turn on **Enable HTTP API**, configure the port (default `25483`) and **Allow Write Operations** as needed.
4. Click **Save & Apply**.

When write access is enabled or the API is enabled for the first time, the app generates an API key automatically. The server never binds to a non-loopback address.

## Authentication

Send the API key in a request header:

```
X-API-Key: <your-api-key>
```

The query parameter `?api_key=<your-api-key>` is also accepted.

Rules:

- No API key configured: only read-only (GET) requests are allowed.
- API key configured: every request must include the correct key.
- If **Allow Write Operations** is off, all non-GET requests are rejected.
- Rate limit: 100 requests per minute per server instance.

## Response format

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

On failure:

```json
{
  "success": false,
  "data": null,
  "error": "Entry not found"
}
```

## Endpoints

### Status

```bash
curl -H "X-API-Key: <key>" http://127.0.0.1:25483/api/v1/status
```

### List history

```bash
curl -H "X-API-Key: <key>" \
  "http://127.0.0.1:25483/api/v1/entries?limit=20&offset=0&search=keyword&type=PlainText"
```

Parameters: `limit` (default 50, max 200), `offset`, `search`, `type` (`PlainText` / `RichText` / `Image` / `FilePaths`).

### Get an entry

```bash
curl -H "X-API-Key: <key>" http://127.0.0.1:25483/api/v1/entries/<id>
```

### Create an entry (does not write to the system clipboard)

```bash
curl -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  -d '{"content":"hello","content_type":"PlainText"}' \
  http://127.0.0.1:25483/api/v1/entries
```

Optional fields: `html` (rich text content), `content_type`.

### Delete an entry

```bash
curl -X DELETE -H "X-API-Key: <key>" http://127.0.0.1:25483/api/v1/entries/<id>
```

### Add a tag

```bash
curl -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  -d '{"tag":"work"}' \
  http://127.0.0.1:25483/api/v1/entries/<id>/tags
```

### Write to the system clipboard

```bash
curl -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  -d '{"text":"hello"}' \
  http://127.0.0.1:25483/api/v1/clipboard/write
```

Optional `paste: true` writes to the clipboard and simulates a paste into the current foreground window.

### Read the system clipboard

```bash
curl -H "X-API-Key: <key>" http://127.0.0.1:25483/api/v1/clipboard/current
```

### Paste an entry

```bash
curl -X POST -H "X-API-Key: <key>" http://127.0.0.1:25483/api/v1/paste/<id>
```

### Tags

```bash
curl -H "X-API-Key: <key>" http://127.0.0.1:25483/api/v1/tags
```
