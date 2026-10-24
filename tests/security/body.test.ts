// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isJsonContentType, readJson } from "@/lib/security/body";

const JSON_HEADERS = { "content-type": "application/json" };

function streamOf(chunks: string[], onPull?: () => void): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      onPull?.();
      const chunk = chunks[i++];
      if (chunk === undefined) controller.close();
      else controller.enqueue(enc.encode(chunk));
    },
  });
}

const streamingRequest = (body: ReadableStream<Uint8Array>, headers: Record<string, string> = JSON_HEADERS) =>
  new Request("http://localhost/api", { method: "POST", headers, body, duplex: "half" } as RequestInit);

describe("readJson", () => {
  it("parses a JSON body under the cap", async () => {
    const req = new Request("http://localhost/api", { method: "POST", headers: JSON_HEADERS, body: '{"a":1}' });
    expect(await readJson(req, 100)).toEqual({ ok: true, data: { a: 1 } });
  });

  it("rejects the wrong content type with 415", async () => {
    const req = new Request("http://localhost/api", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    expect(await readJson(req, 100)).toMatchObject({ ok: false, status: 415 });
  });

  it("rejects a declared Content-Length over the cap with 413", async () => {
    const req = new Request("http://localhost/api", { method: "POST", headers: { ...JSON_HEADERS, "content-length": "5000" }, body: "{}" });
    expect(await readJson(req, 100)).toMatchObject({ ok: false, status: 413 });
  });

  it("aborts an oversize stream without Content-Length after the cap", async () => {
    let pulls = 0;
    const chunk = "x".repeat(64);
    const req = streamingRequest(streamOf(Array.from({ length: 1000 }, () => chunk), () => (pulls += 1)));
    expect(req.headers.get("content-length")).toBeNull();
    const result = await readJson(req, 256);
    expect(result).toMatchObject({ ok: false, status: 413 });
    expect(pulls).toBeLessThan(20);
  });

  it("accepts a streamed body exactly at the cap", async () => {
    const req = streamingRequest(streamOf(['{"k":"', "y".repeat(10), '"}']));
    expect(await readJson(req, 18)).toEqual({ ok: true, data: { k: "yyyyyyyyyy" } });
  });

  it("rejects malformed, empty and non-UTF-8 bodies with 400", async () => {
    const bad = new Request("http://localhost/api", { method: "POST", headers: JSON_HEADERS, body: "{nope" });
    const empty = new Request("http://localhost/api", { method: "POST", headers: JSON_HEADERS, body: "  " });
    const none = new Request("http://localhost/api", { method: "POST", headers: JSON_HEADERS });
    const binary = new Request("http://localhost/api", { method: "POST", headers: JSON_HEADERS, body: new Uint8Array([0xff, 0xfe]) });
    const badLength = new Request("http://localhost/api", { method: "POST", headers: { ...JSON_HEADERS, "content-length": "abc" }, body: "{}" });
    for (const req of [bad, empty, none, binary, badLength]) expect(await readJson(req, 100)).toMatchObject({ ok: false, status: 400 });
  });

  it("reports an unreadable stream as 400", async () => {
    const broken = new ReadableStream<Uint8Array>({ pull: (c) => c.error(new Error("reset")) });
    expect(await readJson(streamingRequest(broken), 100)).toMatchObject({ ok: false, status: 400 });
  });
});

describe("isJsonContentType", () => {
  it("accepts parameters and casing", () => {
    expect(isJsonContentType("Application/JSON; charset=utf-8")).toBe(true);
    expect(isJsonContentType("application/json-patch+json")).toBe(false);
    expect(isJsonContentType(null)).toBe(false);
  });
});
