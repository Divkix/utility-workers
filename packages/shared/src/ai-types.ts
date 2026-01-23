/**
 * AI Schema Parser Types
 *
 * Types for the @utility-workers/ai-parser worker.
 */

/**
 * Request body for AI parsing
 */
export interface AiParseRequest {
  /** Text content to parse */
  text: string;
  /** JSON Schema defining the expected output structure */
  schema: Record<string, unknown>;
  /** Optional system prompt for the AI model */
  systemPrompt?: string;
  /** Model to use (default: google/gemini-2.5-flash-lite) */
  model?: string;
  /** Temperature for response variability (default: 0) */
  temperature?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
}

/**
 * Response from AI parsing
 */
export interface AiParseResponse {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed data matching the provided schema (null on failure) */
  data: unknown;
  /** Token usage statistics */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Error message if parsing failed */
  error?: string;
  /** Processing time in milliseconds */
  processingTimeMs?: number;
}

/**
 * Supported AI models via OpenRouter
 */
export type SupportedModel =
  | "google/gemini-2.5-flash-lite"
  | "google/gemini-2.5-flash"
  | "google/gemini-2.5-pro"
  | "anthropic/claude-3.5-sonnet"
  | "anthropic/claude-3.5-haiku"
  | "openai/gpt-4o"
  | "openai/gpt-4o-mini";

/**
 * Hono app type for the AI parser worker
 * Used with hc() client for typed requests
 *
 * Note: For full type safety, import the app type directly:
 * import type { AiParserApp } from "@utility-workers/ai-parser";
 */
export type AiParserAppRoutes = {
  "/parse": {
    $post: {
      input: { json: AiParseRequest };
      output: AiParseResponse;
    };
  };
  "/health": {
    $get: {
      // biome-ignore lint/complexity/noBannedTypes: Hono route input type convention
      input: {};
      output: { status: "ok"; service: "ai-parser" };
    };
  };
};
