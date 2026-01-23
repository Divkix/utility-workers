/**
 * PDF Text Extraction Worker
 *
 * A Cloudflare Worker that extracts text content from PDF files.
 * Uses unpdf (based on Mozilla's pdf.js) for reliable text extraction.
 *
 * @example
 * // Via HTTP
 * const response = await fetch("https://pdf-text-worker.example.com/extract", {
 *   method: "POST",
 *   body: pdfArrayBuffer,
 *   headers: { "Content-Type": "application/pdf" }
 * });
 * const { text, pageCount } = await response.json();
 *
 * @example
 * // Via Hono RPC client (from another worker)
 * import { hc } from "hono/client";
 * import type { PdfTextApp } from "@utility-workers/pdf-text";
 *
 * const client = hc<PdfTextApp>("http://internal", {
 *   fetch: env.PDF_WORKER.fetch.bind(env.PDF_WORKER)
 * });
 * const res = await client.extract.$post({ body: pdfBuffer });
 */

import type { PdfExtractResponse } from "@utility-workers/shared";
import { isValidPdf, withTiming } from "@utility-workers/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { extractText, getDocumentProxy } from "unpdf";

// Worker has no bindings required
type Bindings = Record<string, never>;

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
  return c.json({ status: "ok", service: "pdf-text" });
});

/**
 * Extract text from PDF
 *
 * POST /extract
 * Content-Type: application/pdf (or application/octet-stream)
 * Body: PDF file as binary
 *
 * Returns: PdfExtractResponse
 */
app.post("/extract", async (c) => {
  const startTime = performance.now();

  try {
    // Get PDF buffer from request body
    const buffer = await c.req.arrayBuffer();

    // Validate input
    if (!buffer || buffer.byteLength === 0) {
      const response: PdfExtractResponse = {
        success: false,
        text: "",
        pageCount: 0,
        error: "No PDF data provided",
      };
      return c.json(response, 400);
    }

    // Validate PDF magic number
    if (!isValidPdf(buffer)) {
      const response: PdfExtractResponse = {
        success: false,
        text: "",
        pageCount: 0,
        error: "Invalid PDF format: missing PDF header",
      };
      return c.json(response, 400);
    }

    // Check size limit (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (buffer.byteLength > maxSize) {
      const response: PdfExtractResponse = {
        success: false,
        text: "",
        pageCount: 0,
        error: `PDF too large: ${Math.round(buffer.byteLength / 1024 / 1024)}MB exceeds 50MB limit`,
      };
      return c.json(response, 413);
    }

    // Extract text using unpdf
    const { result: extractionResult, durationMs } = await withTiming(async () => {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text, totalPages } = await extractText(pdf, { mergePages: true });
      return { text: text ?? "", pageCount: totalPages };
    });

    const response: PdfExtractResponse = {
      success: true,
      text: extractionResult.text,
      pageCount: extractionResult.pageCount,
      processingTimeMs: durationMs,
    };

    return c.json(response);
  } catch (error) {
    const processingTimeMs = Math.round(performance.now() - startTime);
    const errorMessage = error instanceof Error ? error.message : "Unknown extraction error";

    console.error("PDF extraction failed:", errorMessage);

    const response: PdfExtractResponse = {
      success: false,
      text: "",
      pageCount: 0,
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
      availableEndpoints: ["GET /health", "POST /extract"],
    },
    404,
  );
});

// Export for Hono RPC client typing
export type PdfTextApp = typeof app;

export default app;
