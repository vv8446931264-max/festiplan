import { randomUUID } from "node:crypto";
import type { ZodType } from "zod";
import type { ErrorBody, Issue } from "@/lib/contracts";
import { readJson } from "@/lib/security/body";
import { clientKey } from "@/lib/security/ip";
import { isSameOrigin } from "@/lib/security/origin";
import { rateLimit, scaledLimit } from "@/lib/security/rate-limit";
import { logEvent } from "./log";
import type { Severity } from "./log";

type HeaderMap = Record<string, string>;

const ONE_MINUTE_MS = 60_000;
/** Field issues reported per invalid request; enough to fix a form, small enough to read. */
const MAX_ISSUES = 20;

/** Route context for handlers under a dynamic `[id]` segment. */
export type IdRouteContext = { params: Promise<{ id: string }> };

/** A JSON response that is never cached. */
export function json(data: unknown, init: { status?: number; headers?: HeaderMap } = {}): Response {
  return Response.json(data, {
    status: init.status ?? 200,
    headers: { "Cache-Control": "no-store", ...init.headers },
  });
}

/** A plain-language error response: `{ error }` with the given status. */
export function problem(status: number, message: string, extraHeaders: HeaderMap = {}): Response {
  const body: ErrorBody = { error: message };
  return json(body, { status, headers: extraHeaders });
}

/** Flattens Zod issues into `{ path, message }` pairs (dotted paths). */
export function toIssues(error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}): Issue[] {
  return error.issues
    .slice(0, MAX_ISSUES)
    .map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
}

/** 400 with `{ error, issues }` for a body that failed schema validation. */
export function invalid(issues: Issue[], message = "Some details need another look."): Response {
  const body: ErrorBody = { error: message, issues };
  return json(body, { status: 400 });
}

/** Outcome of `readBody`: the validated body, or the error response to send instead. */
export type BodyResult<T> = { ok: true; data: T } | { ok: false; response: Response };

/**
 * Reads a JSON body of at most `maxBytes` and validates it against `schema`:
 * 400/413/415 when it can't be read, 400 `{ error, issues }` when the schema rejects it.
 */
export async function readBody<T>(
  req: Request,
  maxBytes: number,
  schema: ZodType<T>,
): Promise<BodyResult<T>> {
  const body = await readJson(req, maxBytes);
  if (!body.ok) return { ok: false, response: problem(body.status, body.error) };
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return { ok: false, response: invalid(toIssues(parsed.error)) };
  return { ok: true, data: parsed.data };
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
  isSameOrigin(req)
    ? null
    : problem(403, "This request has to come from the FestiPlan site itself.");

const retryAfter = (seconds: number): HeaderMap => ({ "Retry-After": String(seconds) });

/**
 * Per-client fixed-window limit for one route, scaled by `RATE_LIMIT_SCALE`. The client is
 * the IPv4 address or the IPv6 /64 network (`clientKey`).
 * Over the limit → 429 with a `Retry-After` header.
 */
export function perIpLimit(name: string, baseLimit: number, windowMs = ONE_MINUTE_MS): Guard {
  return (req) => {
    const verdict = rateLimit(`${name}:${clientKey(req)}`, scaledLimit(baseLimit), windowMs);
    if (verdict.ok) return null;
    const wait = verdict.retryAfterSec;
    return problem(
      429,
      `You're going a little fast — please wait ${wait} seconds and try again.`,
      retryAfter(wait),
    );
  };
}

/** AI-backed requests one instance accepts per minute across every client and AI route (before scaling). */
export const AI_GLOBAL_PER_MINUTE = 120;

/**
 * Per-instance ceiling on AI-backed requests (plan, refine, vendors) from all clients
 * together, scaled by `RATE_LIMIT_SCALE` — a cost backstop when many IPs each stay under
 * their own limit. Over the ceiling → 503 with a `Retry-After` header.
 */
export const aiGlobalLimit: Guard = () => {
  const verdict = rateLimit("ai:global", scaledLimit(AI_GLOBAL_PER_MINUTE), ONE_MINUTE_MS);
  if (verdict.ok) return null;
  const wait = verdict.retryAfterSec;
  return problem(
    503,
    `FestiPlan is very busy right now. Please try again in ${wait} seconds.`,
    retryAfter(wait),
  );
};

/** Runs guards in order; the first non-null response wins. */
export function runGuards(req: Request, ...guards: Guard[]): Response | null {
  for (const guard of guards) {
    const blocked = guard(req);
    if (blocked) return blocked;
  }
  return null;
}

/** Log severity for a response status: 5xx ERROR, 4xx WARNING, anything else INFO. */
function severityFor(status: number): Severity {
  if (status >= 500) return "ERROR";
  if (status >= 400) return "WARNING";
  return "INFO";
}

/** Runs the handler, turning anything it throws into a plain-language 500 (no stack trace). */
async function respond<C>(
  handler: (req: Request, ctx: C) => Response | Promise<Response>,
  req: Request,
  ctx: C,
): Promise<{ res: Response; errorName?: string }> {
  try {
    return { res: await handler(req, ctx) };
  } catch (err) {
    const errorName = err instanceof Error ? err.name : "error";
    const res = problem(500, "Something went wrong on our side. Please try again in a moment.");
    return { res, errorName };
  }
}

/**
 * Wraps a route handler: request id header, structured access log (no user text),
 * and a plain-language 500 instead of a stack trace when something throws.
 */
export function withRoute<C>(
  route: string,
  handler: (req: Request, ctx: C) => Response | Promise<Response>,
): (req: Request, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    const started = performance.now();
    const id = requestId(req);
    const { res, errorName } = await respond(handler, req, ctx);
    try {
      res.headers.set("X-Request-Id", id);
    } catch {
      // Immutable headers (e.g. Response.redirect) — the log still carries the id.
    }
    logEvent({
      severity: severityFor(res.status),
      message: "request",
      route,
      method: req.method,
      status: res.status,
      latencyMs: Math.round(performance.now() - started),
      requestId: id,
      errorName,
    });
    return res;
  };
}
