# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
bun install

# Development - run workers locally
bun run dev:pdf    # PDF worker at http://localhost:8787
bun run dev:ai     # AI parser at http://localhost:8788
bun run dev:all    # Both workers in single process

# Build and deploy
bun run build      # Build all packages
bun run deploy     # Deploy all workers
bun run deploy:pdf # Deploy PDF worker only
bun run deploy:ai  # Deploy AI parser only

# Code quality
bun run lint       # Biome check
bun run fix        # Biome auto-fix
bun run type-check # TypeScript check

# Set secrets for AI parser (required for deployment)
cd packages/ai-parser
bunx wrangler secret put CF_AI_GATEWAY_ACCOUNT_ID
bunx wrangler secret put CF_AI_GATEWAY_ID
bunx wrangler secret put CF_AIG_AUTH_TOKEN

# Tail worker logs
bunx wrangler tail --config packages/pdf-text/wrangler.jsonc
bunx wrangler tail --config packages/ai-parser/wrangler.jsonc
```

## Architecture

Monorepo with bun workspaces and turborepo containing Cloudflare Workers as microservices.

### Package Dependency Graph

```
@utility-workers/pdf-text   ─┐
                             ├──> @utility-workers/shared (types + utils)
@utility-workers/ai-parser  ─┘
```

### Workers

Both workers use Hono framework and export typed app definitions for RPC client usage:

- **pdf-text**: Extracts text from PDFs using `unpdf`. POST binary PDF to `/extract`, returns `{ text, pageCount }`.
- **ai-parser**: Parses text to structured JSON via OpenRouter/AI Gateway. POST JSON to `/parse` with `{ text, schema }`, returns `{ data }`.

### Service Bindings

Workers communicate via Cloudflare service bindings. Consumer workers configure bindings in `wrangler.jsonc`:

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

Then use Hono's typed RPC client:

```typescript
import { hc } from "hono/client";
import type { PdfTextApp } from "@utility-workers/pdf-text";

const client = hc<PdfTextApp>("http://internal", {
  fetch: env.PDF_WORKER.fetch.bind(env.PDF_WORKER),
});
const res = await client.extract.$post({ body: pdfBuffer });
```

### Shared Package

`@utility-workers/shared` contains:
- Type definitions (`AiParseRequest`, `AiParseResponse`, `PdfExtractResponse`)
- Utility functions (`withTiming`, `isValidPdf`, `createErrorResponse`)

Build shared package before workers (`turbo.json` handles dependency order).

## Code Style

- Biome for linting and formatting (2-space indent, double quotes, semicolons, trailing commas)
- TypeScript strict mode with ES2022 target
- Workers compatibility flag: `nodejs_compat`
