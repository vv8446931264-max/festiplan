import { vi } from "vitest";
import { addDays } from "@/lib/engine";
import type { PlanInput } from "@/lib/contracts";
import { resetRateLimits } from "@/lib/security/rate-limit";
import { todayIST } from "@/lib/time";
import { sampleInput } from "../server/fixtures";

export const ORIGIN = "http://localhost:3000";

/** Template mode + memory store, fresh rate-limit windows. */
export function offlineEnv(): void {
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("GOOGLE_GENAI_USE_VERTEXAI", "");
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "");
  vi.stubEnv("RATE_LIMIT_SCALE", "");
  resetRateLimits();
}

/** A same-origin JSON request to a route. */
export function jsonRequest(
  path: string,
  body: unknown,
  init: { method?: string; headers?: Record<string, string> } = {},
): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: init.method ?? "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      host: "localhost:3000",
      ...init.headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** A valid brief dated 90 days after today in India. */
export function futureInput(overrides: Partial<PlanInput> = {}) {
  return sampleInput({ eventDate: addDays(todayIST(), 90), ...overrides });
}

/** The JSON body of every error response: `{ error }`, plus field `issues` for a 400. */
export type ErrorBody = { error: string; issues?: { path: string; message: string }[] };

/** Reads a response's JSON body as `T` (the route's documented response shape). */
export async function bodyOf<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/** Route context for `[id]` handlers. */
export const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });

/** Route context for handlers without dynamic segments. */
export const noCtx = { params: Promise.resolve({}) };
