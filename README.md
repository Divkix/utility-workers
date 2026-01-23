# Utility Workers

Reusable Cloudflare Workers for common tasks. Each worker is a standalone microservice that can be called via HTTP or service bindings.

## Workers

| Worker | Description | Docs |
|--------|-------------|------|
| [@utility-workers/pdf-text](./packages/pdf-text) | Extract text from PDFs using unpdf | [README](./packages/pdf-text/README.md) |
| [@utility-workers/ai-parser](./packages/ai-parser) | Parse text to structured JSON via AI | [README](./packages/ai-parser/README.md) |
| @utility-workers/shared | Shared types and utilities | - |

## Quick Start

```bash
# Install dependencies
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
```

See [ai-parser README](./packages/ai-parser/README.md#configuration) for required secrets.

## Using from Another Worker

### 1. Add service bindings to your wrangler.jsonc

```jsonc
{
  "services": [
    {
      "binding": "PDF_WORKER",
      "service": "pdf-text-worker"
    },
    {
      "binding": "AI_PARSER",
      "service": "ai-parser-worker"
    }
  ]
}
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

See individual worker READMEs for more usage examples.

## Project Structure

```
utility-workers/
├── package.json          # Workspace root
├── biome.json            # Linting/formatting
├── tsconfig.json         # Base TypeScript config
├── turbo.json            # Task orchestration
└── packages/
    ├── shared/           # Shared types and utilities
    ├── pdf-text/         # PDF extraction worker
    └── ai-parser/        # AI parsing worker
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

## License

[MIT](./LICENSE)
