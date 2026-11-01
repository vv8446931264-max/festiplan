// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { POST as createPlanRoute } from "@/app/api/plan/route";
import { POST as refine } from "@/app/api/plan/[id]/refine/route";
import { GET as ics } from "@/app/plan/[id]/calendar.ics/route";
import { TEMPLATE_ANSWER_PREFIX } from "@/lib/ai/refine";
import type { CreatedPlan } from "@/lib/contracts";
import { ORIGIN, futureInput, idCtx, jsonRequest, noCtx, offlineEnv } from "./request";

beforeEach(offlineEnv);
afterEach(() => vi.unstubAllEnvs());

async function planId(): Promise<string> {
  const res = await createPlanRoute(jsonRequest("/api/plan", futureInput()), noCtx);
  return ((await res.json()) as CreatedPlan).plan.id;
}

describe("POST /api/plan/[id]/refine", () => {
  it("streams a plain-text answer (template mode)", async () => {
    const id = await planId();
    const res = await refine(
      jsonRequest(`/api/plan/${id}/refine`, { question: "Make it zero-waste" }),
      idCtx(id),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await res.text()).startsWith(TEMPLATE_ANSWER_PREFIX)).toBe(true);
  });

  it("validates the question, the plan and the 2 KB cap", async () => {
    const id = await planId();
    expect(
      (await refine(jsonRequest(`/api/plan/${id}/refine`, { question: "?" }), idCtx(id))).status,
    ).toBe(400);
    expect(
      (
        await refine(
          jsonRequest(`/api/plan/${id}/refine`, { question: "x".repeat(3000) }),
          idCtx(id),
        )
      ).status,
    ).toBe(413);
    expect(
      (
        await refine(
          jsonRequest("/api/plan/unknown-plan/refine", { question: "Ideas?" }),
          idCtx("unknown-plan"),
        )
      ).status,
    ).toBe(404);
    expect(
      (await refine(jsonRequest("/api/plan/!/refine", { question: "Ideas?" }), idCtx("!"))).status,
    ).toBe(404);
  });

  it("allows 10 questions per minute per IP", async () => {
    const id = await planId();
    const headers = { "x-forwarded-for": "192.0.2.44" };
    for (let i = 0; i < 10; i++) {
      const res = await refine(
        jsonRequest(`/api/plan/${id}/refine`, { question: "Ideas?" }, { headers }),
        idCtx(id),
      );
      await res.text();
      expect(res.status).toBe(200);
    }
    expect(
      (
        await refine(
          jsonRequest(`/api/plan/${id}/refine`, { question: "Ideas?" }, { headers }),
          idCtx(id),
        )
      ).status,
    ).toBe(429);
  });
});

describe("GET /api/health", () => {
  it("reports template mode and the memory store without caching", async () => {
    const res = health();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      status: "ok",
      ai: "template",
      store: "memory",
      model: "template",
    });
  });

  it("reports the configured backend and model", async () => {
    vi.stubEnv("GEMINI_API_KEY", "dev-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.5-flash");
    expect(await health().json()).toMatchObject({
      ai: "gemini-api",
      model: "gemini-3.5-flash",
    });
  });
});

describe("GET /plan/[id]/calendar.ics", () => {
  it("downloads an RFC 5545 calendar", async () => {
    const id = await planId();
    const res = await ics(new Request(`${ORIGIN}/plan/${id}/calendar.ics`), idCtx(id));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="festiplan-${id}.ics"`,
    );
    const text = await res.text();
    expect(text.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(text).toContain(`URL:${ORIGIN}/plan/${id}`);
    expect(text).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });

  it("404s for unknown or malformed ids", async () => {
    expect(
      (await ics(new Request(`${ORIGIN}/plan/x/calendar.ics`), idCtx("unknown-plan"))).status,
    ).toBe(404);
    expect((await ics(new Request(`${ORIGIN}/plan/x/calendar.ics`), idCtx("a b"))).status).toBe(
      404,
    );
  });
});
