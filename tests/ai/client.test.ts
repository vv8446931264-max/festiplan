// @vitest-environment node
import { describe, expect, it } from "vitest";
import { aiBackend, DEFAULT_MODEL, getAi, thinkingFor } from "@/lib/ai/client";

describe("getAi", () => {
  it("returns null (template mode) when nothing is configured", () => {
    expect(getAi({})).toBeNull();
    expect(getAi({ GEMINI_API_KEY: "  " })).toBeNull();
    expect(aiBackend({})).toBe("template");
  });

  it("uses the Gemini API with a key and the default model", () => {
    const ai = getAi({ GEMINI_API_KEY: "test-key" });
    expect(ai?.backend).toBe("gemini-api");
    expect(ai?.model).toBe(DEFAULT_MODEL);
    expect(DEFAULT_MODEL).toBe("gemini-3.5-flash");
    expect(aiBackend({ GEMINI_API_KEY: "test-key" })).toBe("gemini-api");
  });

  it("prefers Vertex AI when GOOGLE_GENAI_USE_VERTEXAI=true", () => {
    const env = { GOOGLE_GENAI_USE_VERTEXAI: "true", GOOGLE_CLOUD_PROJECT: "demo", GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-2.5-flash" };
    const ai = getAi(env);
    expect(ai?.backend).toBe("vertex");
    expect(ai?.model).toBe("gemini-2.5-flash");
  });

  it("caches the client per configuration", () => {
    const env = { GEMINI_API_KEY: "cache-key" };
    expect(getAi(env)).toBe(getAi({ ...env }));
    expect(getAi({ GEMINI_API_KEY: "other" })).not.toBe(getAi(env));
  });
});

describe("thinkingFor", () => {
  it("uses thinkingLevel for Gemini 3+", () => {
    expect(thinkingFor("gemini-3.5-flash")).toEqual({ thinkingLevel: "LOW" });
    expect(thinkingFor("gemini-3-pro-preview")).toEqual({ thinkingLevel: "LOW" });
  });

  it("uses thinkingBudget for Gemini 2.5", () => {
    expect(thinkingFor("gemini-2.5-flash")).toEqual({ thinkingBudget: 0 });
    expect(thinkingFor("gemini-2.5-pro")).toEqual({ thinkingBudget: 128 });
  });

  it("sets nothing for other models", () => {
    expect(thinkingFor("gemini-2.0-flash")).toBeUndefined();
    expect(thinkingFor("custom-model")).toBeUndefined();
  });
});
