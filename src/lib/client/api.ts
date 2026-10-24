import type { PlanInput, PlanPatch, PublicPlan, VendorQuery, VendorResult } from "../contracts";

export type Issue = { path: string; message: string };
export type ApiError = { ok: false; status: number; error: string; issues?: Issue[] };
type Ok<T> = { ok: true } & T;

const NETWORK_ERROR = "We couldn't reach FestiPlan. Check your connection and try again.";

async function call<T>(url: string, init: RequestInit): Promise<Ok<T> | ApiError> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
    });
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) return toError(res, body);
  return { ok: true, ...(body as T) };
}

function toError(res: Response, body: unknown): ApiError {
  const data = (body ?? {}) as { error?: unknown; issues?: unknown };
  const error =
    typeof data.error === "string"
      ? data.error
      : res.status === 429
        ? "That's a lot of planning at once. Wait a minute and try again."
        : "Something went wrong on our side. Please try again.";
  const issues = Array.isArray(data.issues) ? (data.issues as Issue[]) : undefined;
  return { ok: false, status: res.status, error, issues };
}

/** POST /api/plan — generates and stores a plan. */
export function createPlan(input: PlanInput) {
  return call<{ plan: PublicPlan; editKey: string }>("/api/plan", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * PATCH /api/plan/[id] — saves checklist state, actuals and budget edits.
 * `keepalive` lets the request finish while the page is being left.
 */
export function savePlan(id: string, editKey: string, patch: PlanPatch, keepalive = false) {
  return call<{ plan: PublicPlan }>(`/api/plan/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "x-edit-key": editKey },
    body: JSON.stringify(patch),
    keepalive,
  });
}

/** POST /api/vendors — real places from Grounding with Google Maps. */
export function findVendors(query: VendorQuery) {
  return call<VendorResult>("/api/vendors", { method: "POST", body: JSON.stringify(query) });
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
  let res: Response;
  try {
    res = await fetch(`/api/plan/${encodeURIComponent(id)}/refine`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
      signal,
    });
  } catch {
    return signal?.aborted ? null : NETWORK_ERROR;
  }
  if (!res.ok || !res.body) return toError(res, await res.json().catch(() => null)).error;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return null;
    text += value;
    onText(text);
  }
}
