/**
 * AI Schema Parser Worker
 *
 * A Cloudflare Worker that parses text into structured JSON using AI models.
 * Supports multiple models via OpenRouter, with optional Cloudflare AI Gateway.
 *
 * @example
 * // Via HTTP
 * const response = await fetch("https://ai-parser-worker.example.com/parse", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({
 *     text: "John Doe is a software engineer at Acme Corp...",
 *     schema: { type: "object", properties: { name: { type: "string" } } },
 *     systemPrompt: "Extract person information"
 *   })
 * });
 * const { data } = await response.json();
 *
 * @example
 * // Via Hono RPC client (from another worker)
 * import { hc } from "hono/client";
 * import type { AiParserApp } from "@utility-workers/ai-parser";
 *
 * const client = hc<AiParserApp>("http://internal", {
 *   fetch: env.AI_PARSER.fetch.bind(env.AI_PARSER)
 * });
 * const res = await client.parse.$post({ json: { text, schema } });
 */

import type { AiParseRequest, AiParseResponse } from "@utility-workers/shared";
import { withTiming } from "@utility-workers/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";

/**
 * Environment bindings
 */
type Bindings = {
  // Cloudflare AI Gateway (recommended)
  CF_AI_GATEWAY_ACCOUNT_ID?: string;
  CF_AI_GATEWAY_ID?: string;
  CF_AIG_AUTH_TOKEN?: string;
  // Direct OpenRouter (fallback)
  OPENROUTER_API_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS for public access (if needed)
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

/**
 * Health check endpoint
 */
app.get("/health", (c) => {
  const hasGateway = !!(c.env.CF_AI_GATEWAY_ACCOUNT_ID && c.env.CF_AI_GATEWAY_ID);
  const hasDirectKey = !!c.env.OPENROUTER_API_KEY;

  return c.json({
    status: "ok",
    service: "ai-parser",
    config: {
      aiGateway: hasGateway,
      directOpenRouter: hasDirectKey,
    },
  });
});

/**
 * Build the API URL based on available configuration
 */
function buildApiUrl(env: Bindings): { url: string; authHeader: string; authValue: string } {
  // Prefer Cloudflare AI Gateway
  if (env.CF_AI_GATEWAY_ACCOUNT_ID && env.CF_AI_GATEWAY_ID && env.CF_AIG_AUTH_TOKEN) {
    const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${env.CF_AI_GATEWAY_ACCOUNT_ID}/${env.CF_AI_GATEWAY_ID}/openrouter`;
    return {
      url: `${gatewayUrl}/chat/completions`,
      authHeader: "cf-aig-authorization",
      authValue: `Bearer ${env.CF_AIG_AUTH_TOKEN}`,
    };
  }

  // Fallback to direct OpenRouter
  if (env.OPENROUTER_API_KEY) {
    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      authHeader: "Authorization",
      authValue: `Bearer ${env.OPENROUTER_API_KEY}`,
    };
  }

  throw new Error("No API configuration found. Set CF_AI_GATEWAY_* or OPENROUTER_API_KEY secrets.");
}

/**
 * Parse text into structured JSON using AI
 *
 * POST /parse
 * Content-Type: application/json
 * Body: AiParseRequest
 *
 * Returns: AiParseResponse
 */
app.post("/parse", async (c) => {
  const startTime = performance.now();

  try {
    // Parse request body
    const body = await c.req.json<AiParseRequest>();

    // Validate required fields
    if (!body.text || typeof body.text !== "string") {
      const response: AiParseResponse = {
        success: false,
        data: null,
        error: "Missing or invalid 'text' field",
      };
      return c.json(response, 400);
    }

    if (!body.schema || typeof body.schema !== "object") {
      const response: AiParseResponse = {
        success: false,
        data: null,
        error: "Missing or invalid 'schema' field",
      };
      return c.json(response, 400);
    }

    // Limit text size (100KB max)
    const maxTextSize = 100 * 1024;
    if (body.text.length > maxTextSize) {
      const response: AiParseResponse = {
        success: false,
        data: null,
        error: `Text too large: ${Math.round(body.text.length / 1024)}KB exceeds 100KB limit`,
      };
      return c.json(response, 413);
    }

    // Build API configuration
    let apiConfig: { url: string; authHeader: string; authValue: string };
    try {
      apiConfig = buildApiUrl(c.env);
    } catch (error) {
      const response: AiParseResponse = {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "API configuration error",
      };
      return c.json(response, 500);
    }

    // Extract parameters with defaults
    const {
      text,
      schema,
      systemPrompt = "Extract the requested information from the text and return valid JSON matching the schema.",
      model = "google/gemini-2.5-flash-lite",
      temperature = 0,
      maxTokens = 4096,
      providerSort,
    } = body;

    // Call OpenRouter API
    const { result: apiResult, durationMs } = await withTiming(async () => {
      const response = await fetch(apiConfig.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [apiConfig.authHeader]: apiConfig.authValue,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "extraction",
              strict: true,
              schema,
            },
          },
          temperature,
          max_tokens: maxTokens,
          ...(providerSort && {
            provider: {
              sort: providerSort,
              require_parameters: true,
              allow_fallbacks: false,
            },
          }),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      return response.json() as Promise<{
        choices: Array<{ message: { content: string | null } }>;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      }>;
    });

    // Extract and parse the response content
    const content = apiResult.choices?.[0]?.message?.content;

    if (!content) {
      const response: AiParseResponse = {
        success: false,
        data: null,
        error: "AI returned empty response",
        processingTimeMs: durationMs,
      };
      return c.json(response, 500);
    }

    // Parse the JSON response
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(content);
    } catch {
      const response: AiParseResponse = {
        success: false,
        data: null,
        error: `AI returned invalid JSON: ${content.slice(0, 100)}...`,
        processingTimeMs: durationMs,
      };
      return c.json(response, 500);
    }

    const response: AiParseResponse = {
      success: true,
      data: parsedData,
      usage: apiResult.usage
        ? {
            promptTokens: apiResult.usage.prompt_tokens,
            completionTokens: apiResult.usage.completion_tokens,
            totalTokens: apiResult.usage.total_tokens,
          }
        : undefined,
      processingTimeMs: durationMs,
    };

    return c.json(response);
  } catch (error) {
    const processingTimeMs = Math.round(performance.now() - startTime);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("AI parsing failed:", errorMessage);

    const response: AiParseResponse = {
      success: false,
      data: null,
      error: errorMessage,
      processingTimeMs,
    };

    return c.json(response, 500);
  }
});

/**
 * Catch-all for unsupported routes
 */
app.all("*", (c) => {
  return c.json(
    {
      error: "Not found",
      availableEndpoints: ["GET /health", "POST /parse"],
    },
    404,
  );
});

// Export for Hono RPC client typing
export type AiParserApp = typeof app;

export default app;
