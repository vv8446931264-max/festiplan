/** Result of reading a JSON request body under a byte cap. */
export type ReadJsonResult =
  { ok: true; data: unknown } | { ok: false; status: 400 | 413 | 415; error: string };

const BYTES_PER_KB = 1024;
const DIGITS_ONLY = /^\d+$/;

const badRequest = (error: string): ReadJsonResult => ({ ok: false, status: 400, error });

const tooLarge = (maxBytes: number): ReadJsonResult => ({
  ok: false,
  status: 413,
  error: `That request is too large (limit ${Math.round(maxBytes / BYTES_PER_KB)} KB). Please shorten it and try again.`,
});

/** True when the Content-Type media type is exactly `application/json`. */
export function isJsonContentType(header: string | null): boolean {
  return (header ?? "").split(";")[0]?.trim().toLowerCase() === "application/json";
}

/** Rejects a malformed (400) or over-cap (413) Content-Length; null when absent or fine. */
function declaredLengthProblem(header: string | null, maxBytes: number): ReadJsonResult | null {
  if (header === null) return null;
  const declared = header.trim();
  if (!DIGITS_ONLY.test(declared)) return badRequest("Invalid Content-Length.");
  return Number(declared) > maxBytes ? tooLarge(maxBytes) : null;
}

/** Joins byte chunks into one array of `totalBytes` bytes. */
function concatBytes(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const joined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

/** Streams a body into memory, cancelling the stream and returning null past `maxBytes`. */
async function readCapped(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return concatBytes(chunks, totalBytes);
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
}

/** Decodes strict UTF-8 and parses JSON; blank, non-UTF-8 or malformed input → 400. */
function parseJsonBytes(bytes: Uint8Array): ReadJsonResult {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!text.trim()) return badRequest("The request body is empty.");
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return badRequest("The request body isn't valid JSON.");
  }
}

/**
 * Reads a JSON body without ever buffering more than `maxBytes`: checks Content-Type (415),
 * a declared Content-Length (413), then streams the body and aborts past the cap (413).
 * Empty, non-UTF-8 or malformed JSON → 400.
 */
export async function readJson(req: Request, maxBytes: number): Promise<ReadJsonResult> {
  if (!isJsonContentType(req.headers.get("content-type"))) {
    return {
      ok: false,
      status: 415,
      error: "Send the request as JSON (Content-Type: application/json).",
    };
  }
  const lengthProblem = declaredLengthProblem(req.headers.get("content-length"), maxBytes);
  if (lengthProblem) return lengthProblem;
  if (!req.body) return badRequest("The request body is empty.");
  let bytes: Uint8Array | null;
  try {
    bytes = await readCapped(req.body, maxBytes);
  } catch {
    return badRequest("The request body could not be read.");
  }
  return bytes ? parseJsonBytes(bytes) : tooLarge(maxBytes);
}
