/** Result of reading a JSON request body under a byte cap. */
export type ReadJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; status: 400 | 413 | 415; error: string };

const tooLarge = (maxBytes: number): ReadJsonResult => ({
  ok: false,
  status: 413,
  error: `That request is too large (limit ${Math.round(maxBytes / 1024)} KB). Please shorten it and try again.`,
});

/** True when the Content-Type media type is exactly `application/json`. */
export function isJsonContentType(header: string | null): boolean {
  return (header ?? "").split(";")[0]?.trim().toLowerCase() === "application/json";
}

async function readCapped(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

/**
 * Reads a JSON body without ever buffering more than `maxBytes`: checks Content-Type (415),
 * a declared Content-Length (413), then streams the body and aborts past the cap (413).
 * Empty, non-UTF-8 or malformed JSON → 400.
 */
export async function readJson(req: Request, maxBytes: number): Promise<ReadJsonResult> {
  if (!isJsonContentType(req.headers.get("content-type"))) {
    return { ok: false, status: 415, error: "Send the request as JSON (Content-Type: application/json)." };
  }
  const declared = req.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared.trim()) || Number(declared) > maxBytes)) {
    return /^\d+$/.test(declared.trim()) ? tooLarge(maxBytes) : { ok: false, status: 400, error: "Invalid Content-Length." };
  }
  if (!req.body) return { ok: false, status: 400, error: "The request body is empty." };
  let bytes: Uint8Array | null;
  try {
    bytes = await readCapped(req.body, maxBytes);
  } catch {
    return { ok: false, status: 400, error: "The request body could not be read." };
  }
  if (!bytes) return tooLarge(maxBytes);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!text.trim()) return { ok: false, status: 400, error: "The request body is empty." };
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, error: "The request body isn't valid JSON." };
  }
}
