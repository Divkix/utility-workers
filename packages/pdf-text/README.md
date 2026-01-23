# @utility-workers/pdf-text

Cloudflare Worker for extracting text from PDF files using [unpdf](https://github.com/unjs/unpdf) (based on Mozilla's pdf.js).

## API

### `POST /extract`

Extract text content from a PDF file.

**Request:**
- Content-Type: `application/pdf` or `application/octet-stream`
- Body: PDF file as binary

**Response:**
```json
{
  "success": true,
  "text": "Extracted text content...",
  "pageCount": 5,
  "processingTimeMs": 234
}
```

**Error Response:**
```json
{
  "success": false,
  "text": "",
  "pageCount": 0,
  "error": "Error message"
}
```

### `GET /health`

Health check endpoint.

```json
{ "status": "ok", "service": "pdf-text" }
```

## Usage

### HTTP (curl)

```bash
curl -X POST https://pdf-text-worker.your-domain.workers.dev/extract \
  -H "Content-Type: application/pdf" \
  --data-binary @document.pdf
```

### From Another Worker (Service Binding)

Add to your `wrangler.jsonc`:
```jsonc
{
  "services": [
    {
      "binding": "PDF_WORKER",
      "service": "pdf-text-worker"
    }
  ]
}
```

**Typed client (recommended):**
```typescript
import { hc } from "hono/client";
import type { PdfTextApp } from "@utility-workers/pdf-text";

const client = hc<PdfTextApp>("http://internal", {
  fetch: env.PDF_WORKER.fetch.bind(env.PDF_WORKER),
});

const res = await client.extract.$post({
  body: pdfArrayBuffer,
});
const { text, pageCount } = await res.json();
```

**Raw fetch:**
```typescript
const response = await env.PDF_WORKER.fetch("http://internal/extract", {
  method: "POST",
  body: pdfBuffer,
});
const { text, pageCount } = await response.json();
```

## Limits

| Limit | Value |
|-------|-------|
| Max file size | 50 MB |

## Development

```bash
# Run locally
bun run dev

# Deploy
bun run deploy

# Tail logs
bun run tail
```
