import type { PlanInput, PlanPatch, PublicPlan, VendorQuery, VendorResult } from "../contracts";

/** One field-level validation problem reported by the API. */
export type Issue = { path: string; message: string };

/** A failed call: HTTP status (0 when the network failed), a readable message, field issues. */
export type ApiError = { ok: false; status: number; error: string; issues?: Issue[] };

/** A successful call: the response body's fields plus `ok: true`. */
export type ApiSuccess<T> = { ok: true } & T;

/** Either outcome of an API call. */
export type ApiResult<T> = ApiSuccess<T> | ApiError;

/** Request options for the JSON API; headers are a plain record so the defaults merge simply. */
type JsonRequest = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };

const NETWORK_ERROR = "We couldn't reach FestiPlan. Check your connection and try again.";
const RATE_LIMITED = "That's a lot of planning at once. Wait a minute and try again.";
const SERVER_ERROR = "Something went wrong on our side. Please try again.";
const STREAM_DROPPED =
  "The answer was cut off — the connection dropped. Ask again to get the rest.";
const HTTP_TOO_MANY_REQUESTS = 429;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isIssue = (value: unknown): value is Issue =>
  isRecord(value) && typeof value.path === "string" && typeof value.message === "string";

/** The server's own message when it sent one, else a plain-language one for the status. */
function toApiError(status: number, body: unknown): ApiError {
  const data = isRecord(body) ? body : {};
  const fallback = status === HTTP_TOO_MANY_REQUESTS ? RATE_LIMITED : SERVER_ERROR;
  const error = typeof data.error === "string" ? data.error : fallback;
  const issues = Array.isArray(data.issues) ? data.issues.filter(isIssue) : undefined;
  return { ok: false, status, error, issues };
}

async function request<T>(url: string, init: JsonRequest): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
    });
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) return toApiError(response.status, body);
  // Our own API: each route handler defines the body shape this call is typed with.
  return { ok: true, ...(body as T) };
}

/** POST /api/plan — generates and stores a plan. */
export function createPlan(
  input: PlanInput,
): Promise<ApiResult<{ plan: PublicPlan; editKey: string }>> {
  return request("/api/plan", { method: "POST", body: JSON.stringify(input) });
}

/**
 * PATCH /api/plan/[id] — saves checklist state, actuals and budget edits.
 * `keepalive` lets the request finish while the page is being left.
 */
export function savePlan(
  id: string,
  editKey: string,
  patch: PlanPatch,
  keepalive = false,
): Promise<ApiResult<{ plan: PublicPlan }>> {
  return request(`/api/plan/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "x-edit-key": editKey },
    body: JSON.stringify(patch),
    keepalive,
  });
}

/** POST /api/vendors — real places from Grounding with Google Maps. */
export function findVendors(query: VendorQuery): Promise<ApiResult<VendorResult>> {
  return request("/api/vendors", { method: "POST", body: JSON.stringify(query) });
}

/**
 * POST /api/plan/[id]/refine — streams the "Ask FestiPlan" answer, calling
 * `onText` with the accumulated text. Resolves to an error message or null.
 */
export async function askPlan(
  id: string,
  question: string,
  onText: (text: string) => void,
  signal?: AbortSignal,
): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(`/api/plan/${encodeURIComponent(id)}/refine`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
      signal,
    });
  } catch {
    return signal?.aborted ? null : NETWORK_ERROR;
  }
  if (!response.ok || !response.body) {
    return toApiError(response.status, await response.json().catch(() => null)).error;
  }
  return readStream(response.body, onText, signal);
}

/** Accumulates a text stream; a mid-stream failure becomes a message, an abort is silent. */
async function readStream(
  body: NonNullable<Response["body"]>,
  onText: (text: string) => void,
  signal?: AbortSignal,
): Promise<string | null> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return null;
      text += value;
      onText(text);
    }
  } catch {
    return signal?.aborted ? null : STREAM_DROPPED;
  }
}
