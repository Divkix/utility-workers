# @utility-workers/ai-parser

Cloudflare Worker for parsing text into structured JSON using AI models via OpenRouter (with optional Cloudflare AI Gateway).

## API

### `POST /parse`

Parse text into structured JSON matching a provided schema.

**Request:**
```json
{
  "text": "John Doe is a software engineer with 5 years experience...",
  "schema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "role": { "type": "string" },
      "experience": { "type": "number" }
    },
    "required": ["name", "role"]
  },
  "systemPrompt": "Extract person information from the resume"
}
```

**Required Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | string | Text content to parse |
| `schema` | object | JSON Schema defining expected output structure |

**Optional Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | `google/gemini-2.5-flash-lite` | AI model to use |
| `systemPrompt` | string | Generic extraction prompt | Custom instructions for the AI |
| `temperature` | number | `0` | Response variability (0-2) |
| `maxTokens` | number | `4096` | Maximum tokens in response |

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "John Doe",
    "role": "software engineer",
    "experience": 5
  },
  "usage": {
    "promptTokens": 150,
    "completionTokens": 25,
    "totalTokens": 175
  },
  "processingTimeMs": 1234
}
```

**Error Response:**
```json
{
  "success": false,
  "data": null,
  "error": "Error message"
}
```

### `GET /health`

Health check endpoint.

```json
{
  "status": "ok",
  "service": "ai-parser",
  "config": {
    "aiGateway": true,
    "directOpenRouter": false
  }
}
```

## Usage

### HTTP (curl)

```bash
curl -X POST https://ai-parser-worker.your-domain.workers.dev/parse \
  -H "Content-Type: application/json" \
  -d '{
    "text": "John Doe is a software engineer with 5 years experience...",
    "schema": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "role": { "type": "string" },
        "experience": { "type": "number" }
      },
      "required": ["name", "role"]
    }
  }'
```

### From Another Worker (Service Binding)

Add to your `wrangler.toml`:
```toml
[[services]]
binding = "AI_PARSER"
service = "ai-parser-worker"
```

**Typed client (recommended):**
```typescript
import { hc } from "hono/client";
import type { AiParserApp } from "@utility-workers/ai-parser";

const client = hc<AiParserApp>("http://internal", {
  fetch: env.AI_PARSER.fetch.bind(env.AI_PARSER),
});

const res = await client.parse.$post({
  json: {
    text: "...",
    schema: { /* your schema */ },
    model: "google/gemini-2.5-flash", // optional
  },
});
const { data } = await res.json();
```

**Raw fetch:**
```typescript
const response = await env.AI_PARSER.fetch("http://internal/parse", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text, schema }),
});
const { data } = await response.json();
```

## Configuration

### Environment Variables

Set via `bunx wrangler secret put <NAME>`:

| Variable | Required | Description |
|----------|----------|-------------|
| `CF_AI_GATEWAY_ACCOUNT_ID` | Yes* | Cloudflare account ID |
| `CF_AI_GATEWAY_ID` | Yes* | AI Gateway ID |
| `CF_AIG_AUTH_TOKEN` | Yes* | AI Gateway auth token |
| `OPENROUTER_API_KEY` | Yes* | Direct OpenRouter key (fallback) |

*Either AI Gateway credentials OR OpenRouter key required.

### Supported Models

- `google/gemini-2.5-flash-lite` (default, fast & cheap)
- `google/gemini-2.5-flash`
- `google/gemini-2.5-pro`
- `anthropic/claude-3.5-sonnet`
- `anthropic/claude-3.5-haiku`
- `openai/gpt-4o`
- `openai/gpt-4o-mini`

## Limits

| Limit | Value |
|-------|-------|
| Max text size | 100 KB |

## Development

```bash
# Run locally
bun run dev

# Deploy
bun run deploy

# Tail logs
bun run tail

# Set secrets
bunx wrangler secret put CF_AI_GATEWAY_ACCOUNT_ID
bunx wrangler secret put CF_AI_GATEWAY_ID
bunx wrangler secret put CF_AIG_AUTH_TOKEN
```
