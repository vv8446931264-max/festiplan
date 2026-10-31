import { vi } from "vitest";

/** A JSON response, as the API routes send them. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** A fetch stub that answers every call with a fresh response from `respond`. */
export function respondWith(respond: () => Response) {
  return vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(respond()));
}

/** A fetch stub that fails every call, like a dropped connection. */
export function failWith(error: Error) {
  return vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.reject(error));
}

/** The parsed JSON body of a request made by the client API (which always sends a string). */
export function requestBody(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== "string") throw new Error("Expected a JSON string request body");
  return JSON.parse(init.body);
}
