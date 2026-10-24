import { randomUUID } from "node:crypto";
import { isSameOrigin } from "@/lib/security/origin";
import { clientIp } from "@/lib/security/ip";
import { rateLimit, scaledLimit } from "@/lib/security/rate-limit";
import { logEvent } from "./log";

type HeaderMap = Record<string, string>;

/** A JSON response that is never cached. */
export function json(data: unknown, init: { status?: number; headers?: HeaderMap } = {}): Response {
  return Response.json(data, {
    status: init.status ?? 200,
    headers: { "Cache-Control": "no-store", ...init.headers },
  });
}

/** A plain-language error response: `{ error }` with the given status. */
export function problem(status: number, message: string, extraHeaders: HeaderMap = {}): Response {
  return json({ error: message }, { status, headers: extraHeaders });
}

/** One field-level validation problem, e.g. `{ path: "guests", message: "…" }`. */
export type Issue = { path: string; message: string };

/** Flattens Zod issues into `{ path, message }` pairs (dotted paths). */
export function toIssues(error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> }): Issue[] {
  return error.issues.slice(0, 20).map((i) => ({ path: i.path.map(String).join("."), message: i.message }));
}

/** 400 with `{ error, issues }` for a body that failed schema validation. */
export function invalid(issues: Issue[], message = "Some details need another look."): Response {
  return json({ error: message, issues }, { status: 400 });
}

/** The Cloud Trace id when Cloud Run provides one, otherwise a fresh UUID. */
export function requestId(req: Request): string {
  const trace = req.headers.get("x-cloud-trace-context")?.split("/")[0] ?? "";
  return /^[0-9a-f]{32}$/i.test(trace) ? trace.toLowerCase() : randomUUID();
}

/** A request guard returns a response to short-circuit with, or null to continue. */
export type Guard = (req: Request) => Response | null;

/** Refuses state-changing requests that don't come from this site (CSRF guard). */
export const sameOrigin: Guard = (req) =>
  isSameOrigin(req) ? null : problem(403, "This request has to come from the FestiPlan site itself.");

/**
 * Per-IP fixed-window limit for one route, scaled by `RATE_LIMIT_SCALE`.
 * Over the limit → 429 with a `Retry-After` header.
 */
export function perIpLimit(name: string, baseLimit: number, windowMs = 60_000): Guard {
  return (req) => {
    const res = rateLimit(`${name}:${clientIp(req)}`, scaledLimit(baseLimit), windowMs);
    if (res.ok) return null;
    return problem(429, `You're going a little fast — please wait ${res.retryAfterSec} seconds and try again.`, {
      "Retry-After": String(res.retryAfterSec),
    });
  };
}

/** Runs guards in order; the first non-null response wins. */
export function runGuards(req: Request, ...guards: Guard[]): Response | null {
  for (const g of guards) {
    const res = g(req);
    if (res) return res;
  }
  return null;
}

/**
 * Wraps a route handler: request id header, structured access log (no user text),
 * and a plain-language 500 instead of a stack trace when something throws.
 */
export function withRoute<C>(
  route: string,
  handler: (req: Request, ctx: C) => Promise<Response>,
): (req: Request, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    const started = performance.now();
    const id = requestId(req);
    let res: Response;
    let errorName: string | undefined;
    try {
      res = await handler(req, ctx);
    } catch (err) {
      errorName = err instanceof Error ? err.name : "error";
      res = problem(500, "Something went wrong on our side. Please try again in a moment.");
    }
    try {
      res.headers.set("X-Request-Id", id);
    } catch {
      // Immutable headers (e.g. Response.redirect) — the log still carries the id.
    }
    const severity = res.status >= 500 ? "ERROR" : res.status >= 400 ? "WARNING" : "INFO";
    logEvent({ severity, message: "request", route, method: req.method, status: res.status, latencyMs: Math.round(performance.now() - started), requestId: id, errorName });
    return res;
  };
}
