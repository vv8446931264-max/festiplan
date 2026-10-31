import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { FinishReason, GenerateContentParameters, ThinkingConfig } from "@google/genai";

/** Token counts Gemini reports for one call (numbers only — safe to log). */
export type AiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
};

/** The slice of a Gemini response FestiPlan reads. `GenerateContentResponse` satisfies it. */
export type AiResponse = {
  readonly text?: string | undefined;
  candidates?: {
    finishReason?: FinishReason;
    groundingMetadata?: {
      groundingChunks?: { maps?: { title?: string; uri?: string } }[];
    };
  }[];
  usageMetadata?: AiUsage;
};

/** The slice of `GoogleGenAI["models"]` FestiPlan calls — small enough to fake in tests. */
export type AiModels = {
  generateContent(params: GenerateContentParameters): Promise<AiResponse>;
  generateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<AiResponse>>;
};

/** Which Gemini endpoint a handle talks to: Vertex AI (production, ADC) or the Gemini API (dev). */
export type AiBackend = "vertex" | "gemini-api";

/** A ready-to-use Gemini client plus which backend and model it talks to. */
export type AiHandle = { client: { models: AiModels }; backend: AiBackend; model: string };

type Env = Record<string, string | undefined>;

/** The model used when `GEMINI_MODEL` is not set. */
export const DEFAULT_MODEL = "gemini-3.5-flash";

/** Smallest thinking budget Gemini 2.5 Pro accepts (it cannot switch thinking off). */
const PRO_MIN_THINKING_BUDGET = 128;

let cachedHandle: { signature: string; handle: AiHandle | null } | null = null;

/** The trimmed value, or undefined when the variable is unset or blank. */
function setting(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
}

function createHandle(env: Env, model: string): AiHandle | null {
  if (setting(env.GOOGLE_GENAI_USE_VERTEXAI)?.toLowerCase() === "true") {
    const client = new GoogleGenAI({
      vertexai: true,
      project: setting(env.GOOGLE_CLOUD_PROJECT),
      location: setting(env.GOOGLE_CLOUD_LOCATION) ?? "global",
    });
    return { client, backend: "vertex", model };
  }
  const apiKey = setting(env.GEMINI_API_KEY);
  if (!apiKey) return null;
  return { client: new GoogleGenAI({ apiKey }), backend: "gemini-api", model };
}

/**
 * Returns the Gemini client configured by the environment, or null for template mode.
 * `GOOGLE_GENAI_USE_VERTEXAI=true` → Vertex AI via Application Default Credentials;
 * else `GEMINI_API_KEY` → Gemini API; else null. Cached per process (per configuration).
 */
export function getAi(env: Env = process.env): AiHandle | null {
  const model = setting(env.GEMINI_MODEL) ?? DEFAULT_MODEL;
  const signature = JSON.stringify([
    env.GOOGLE_GENAI_USE_VERTEXAI,
    env.GOOGLE_CLOUD_PROJECT,
    env.GOOGLE_CLOUD_LOCATION,
    env.GEMINI_API_KEY,
    model,
  ]);
  if (cachedHandle?.signature === signature) return cachedHandle.handle;
  let handle: AiHandle | null;
  try {
    handle = createHandle(env, model);
  } catch {
    // A misconfigured client must not take the app down: fall back to template mode.
    handle = null;
  }
  cachedHandle = { signature, handle };
  return handle;
}

/**
 * Low-latency thinking settings for a model name: Gemini 3+ takes `thinkingLevel`,
 * Gemini 2.5 takes `thinkingBudget` (Pro cannot switch thinking off, so it gets the minimum).
 */
export function thinkingFor(model: string): ThinkingConfig | undefined {
  const match = /gemini-(\d+)(?:\.(\d+))?/.exec(model);
  if (!match) return undefined;
  const major = Number(match[1]);
  if (major >= 3) return { thinkingLevel: ThinkingLevel.LOW };
  if (major === 2 && match[2] === "5") {
    return { thinkingBudget: model.includes("pro") ? PRO_MIN_THINKING_BUDGET : 0 };
  }
  return undefined;
}
