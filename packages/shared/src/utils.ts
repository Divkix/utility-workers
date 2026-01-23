/**
 * Shared Utilities
 *
 * Common utilities used across workers.
 */

/**
 * Create a standardized error response
 */
export function createErrorResponse(error: string, status: number = 500): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * Measure execution time of an async function
 */
export async function withTiming<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = Math.round(performance.now() - start);
  return { result, durationMs };
}

/**
 * Validate that a value is a non-empty ArrayBuffer
 */
export function isValidArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer && value.byteLength > 0;
}

/**
 * Validate PDF magic number (%PDF-)
 */
export function isValidPdf(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 5) return false;
  const header = new Uint8Array(buffer.slice(0, 5));
  const magic = String.fromCharCode(...header);
  return magic.startsWith("%PDF-");
}
