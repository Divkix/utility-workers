# Utility Workers

Reusable Cloudflare Workers for common tasks. Each worker is a standalone microservice that can be called via HTTP or service bindings.

## Workers

| Worker | Description | Size | Deps |
|--------|-------------|------|------|
| `@utility-workers/pdf-text` | Extract text from PDFs | ~1.5MB | unpdf |
| `@utility-workers/ai-parser` | Parse text to structured JSON via AI | ~50KB | none |
| `@utility-workers/shared` | Shared types and utilities | - | - |

## Quick Start

```bash
# Install dependencies
cd workers  # (or utility-workers after extraction)
bun install

# Run all workers locally
bun run dev:all

# Or run individually
bun run dev:pdf   # PDF worker at http://localhost:8787
bun run dev:ai    # AI parser at http://localhost:8788
```

## Deployment

```bash
# Deploy all workers
bun run deploy

# Or deploy individually
bun run deploy:pdf
bun run deploy:ai

# Set secrets for AI parser
cd packages/ai-parser
bunx wrangler secret put CF_AI_GATEWAY_ACCOUNT_ID
bunx wrangler secret put CF_AI_GATEWAY_ID
bunx wrangler secret put CF_AIG_AUTH_TOKEN
```

## Usage

### PDF Text Extraction

```bash
# Extract text from a PDF file
curl -X POST https://pdf-text-worker.your-domain.workers.dev/extract \
  -H "Content-Type: application/pdf" \
  --data-binary @document.pdf
```

Response:
```json
{
  "success": true,
  "text": "Extracted text content...",
  "pageCount": 5,
  "processingTimeMs": 234
}
```

### AI Schema Parsing

```bash
# Parse text into structured JSON
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
    },
    "systemPrompt": "Extract person information from the resume"
  }'
```

Response:
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

#### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | `google/gemini-2.5-flash-lite` | AI model to use (see supported models below) |
| `systemPrompt` | string | Generic extraction prompt | Custom instructions for the AI |
| `temperature` | number | `0` | Response variability (0-2) |
| `maxTokens` | number | `4096` | Maximum tokens in response |

#### Limits

- **PDF worker**: 50MB max file size
- **AI parser**: 100KB max text size

## Using from Another Worker (Service Bindings)

### 1. Add service bindings to your wrangler.toml/jsonc

```toml
[[services]]
binding = "PDF_WORKER"
service = "pdf-text-worker"

[[services]]
binding = "AI_PARSER"
service = "ai-parser-worker"
```

### 2. Use with Hono RPC client (typed)

```typescript
import { hc } from "hono/client";
import type { PdfTextApp } from "@utility-workers/pdf-text";
import type { AiParserApp } from "@utility-workers/ai-parser";

type Env = {
  PDF_WORKER: Fetcher;
  AI_PARSER: Fetcher;
};

export default {
  async fetch(request: Request, env: Env) {
    // Create typed clients
    const pdfClient = hc<PdfTextApp>("http://internal", {
      fetch: env.PDF_WORKER.fetch.bind(env.PDF_WORKER),
    });

    const aiClient = hc<AiParserApp>("http://internal", {
      fetch: env.AI_PARSER.fetch.bind(env.AI_PARSER),
    });

    // Extract text from PDF
    const pdfRes = await pdfClient.extract.$post({
      body: await request.arrayBuffer(),
    });
    const { text, pageCount } = await pdfRes.json();

    // Parse with AI
    const aiRes = await aiClient.parse.$post({
      json: {
        text,
        schema: { /* your schema */ },
      },
    });
    const { data } = await aiRes.json();

    return Response.json(data);
  },
};
```

### 3. Or use raw fetch

```typescript
// PDF extraction
const pdfResponse = await env.PDF_WORKER.fetch("http://internal/extract", {
  method: "POST",
  body: pdfBuffer,
});
const { text } = await pdfResponse.json();

// AI parsing
const aiResponse = await env.AI_PARSER.fetch("http://internal/parse", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text, schema: mySchema }),
});
const { data } = await aiResponse.json();
```

## Configuration

### AI Parser Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CF_AI_GATEWAY_ACCOUNT_ID` | Yes* | Cloudflare account ID |
| `CF_AI_GATEWAY_ID` | Yes* | AI Gateway ID |
| `CF_AIG_AUTH_TOKEN` | Yes* | AI Gateway auth token |
| `OPENROUTER_API_KEY` | Yes* | Direct OpenRouter key (fallback) |

*Either AI Gateway OR OpenRouter key required.

### Supported AI Models

- `google/gemini-2.5-flash-lite` (default, fast & cheap)
- `google/gemini-2.5-flash`
- `google/gemini-2.5-pro`
- `anthropic/claude-3.5-sonnet`
- `anthropic/claude-3.5-haiku`
- `openai/gpt-4o`
- `openai/gpt-4o-mini`

## Project Structure

```
utility-workers/
├── package.json          # Workspace root
├── biome.json            # Linting/formatting
├── tsconfig.json         # Base TypeScript config
├── turbo.json            # Task orchestration
├── README.md             # This file
└── packages/
    ├── shared/           # Shared types and utilities
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── pdf-types.ts
    │   │   ├── ai-types.ts
    │   │   └── utils.ts
    │   └── package.json
    ├── pdf-text/         # PDF extraction worker
    │   ├── src/
    │   │   └── index.ts
    │   ├── wrangler.toml
    │   └── package.json
    └── ai-parser/        # AI parsing worker
        ├── src/
        │   └── index.ts
        ├── wrangler.toml
        └── package.json
```

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Run all workers |
| `bun run dev:pdf` | Run PDF worker only |
| `bun run dev:ai` | Run AI parser only |
| `bun run dev:all` | Run all workers in single process |
| `bun run build` | Build all packages |
| `bun run deploy` | Deploy all workers |
| `bun run lint` | Lint all code |
| `bun run fix` | Auto-fix lint issues |
| `bun run type-check` | TypeScript check |
| `bun run clean` | Remove build artifacts |

## Extracting to Separate Repository

This folder is designed to be extracted as-is:

```bash
# From webresume.now root
mv workers ../utility-workers
cd ../utility-workers
bun install
bun run dev:all
```

No changes required - all paths and configs are self-contained.

## License

MIT
