/**
 * PDF Text Extraction Types
 *
 * Types for the @utility-workers/pdf-text worker.
 */

/**
 * Request body for PDF text extraction
 * Send as ArrayBuffer in request body
 */
export interface PdfExtractRequest {
  /** PDF file as ArrayBuffer */
  pdf: ArrayBuffer;
}

/**
 * Response from PDF text extraction
 */
export interface PdfExtractResponse {
  /** Whether extraction succeeded */
  success: boolean;
  /** Extracted text content (empty string on failure) */
  text: string;
  /** Number of pages in the PDF */
  pageCount: number;
  /** Error message if extraction failed */
  error?: string;
  /** Processing time in milliseconds */
  processingTimeMs?: number;
}

/**
 * Hono app type for the PDF text worker
 * Used with hc() client for typed requests
 *
 * Note: For full type safety, import the app type directly:
 * import type { PdfTextApp } from "@utility-workers/pdf-text";
 */
export type PdfTextAppRoutes = {
  "/extract": {
    $post: {
      // biome-ignore lint/complexity/noBannedTypes: Hono route input type convention
      input: {};
      output: PdfExtractResponse;
    };
  };
  "/health": {
    $get: {
      // biome-ignore lint/complexity/noBannedTypes: Hono route input type convention
      input: {};
      output: { status: "ok"; service: "pdf-text" };
    };
  };
};
