import type { GenerateContentParameters } from "@google/genai";
import type { AiHandle, AiModels, AiResponse } from "@/lib/ai/client";
import type { PlanInput } from "@/lib/contracts";

/** A fixed "today" for engine-facing tests. */
export const TODAY = "2026-10-24";

/** A valid wedding brief (Priya's sangeet). */
export function sampleInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    eventType: "wedding",
    title: "Riya & Arjun's sangeet",
    eventDate: "2027-02-14",
    city: "Jaipur",
    guests: 180,
    budgetINR: 1_200_000,
    vibe: "Rajasthani folk, marigolds, family performances",
    constraints: ["vegetarian", "wheelchair access"],
    language: "en",
    ...overrides,
  };
}

export type Reply = AiResponse | Error;
export type StreamPart = string | Error;

/** A fake Gemini handle that replays canned replies and records every call. */
export function fakeAi(replies: Reply[] = [], stream: StreamPart[] = [], model = "gemini-3.5-flash") {
  const calls: GenerateContentParameters[] = [];
  const streamCalls: GenerateContentParameters[] = [];
  const models: AiModels = {
    async generateContent(params) {
      calls.push(params);
      const reply = replies[Math.min(calls.length, replies.length) - 1];
      if (reply === undefined) throw new Error("no reply configured");
      if (reply instanceof Error) throw reply;
      return reply;
    },
    async generateContentStream(params) {
      streamCalls.push(params);
      async function* parts(): AsyncGenerator<AiResponse> {
        for (const part of stream) {
          if (part instanceof Error) throw part;
          yield { text: part };
        }
      }
      return parts();
    },
  };
  const handle: AiHandle = { client: { models }, backend: "gemini-api", model };
  return { handle, calls, streamCalls };
}

/** A reply whose text is the JSON of `value`. */
export const jsonReply = (value: unknown): AiResponse => ({ text: JSON.stringify(value) });

/** Every text part of a request's `contents`, joined — for prompt assertions. */
export function promptText(params: GenerateContentParameters | undefined): string {
  const contents = params?.contents;
  if (typeof contents === "string") return contents;
  if (!Array.isArray(contents)) return "";
  return contents
    .flatMap((c) => (typeof c === "object" && c !== null && "parts" in c && Array.isArray(c.parts) ? c.parts : []))
    .map((p) => (typeof p === "object" && p !== null && "text" in p && typeof p.text === "string" ? p.text : ""))
    .join("\n");
}

/** Reads a whole byte stream as UTF-8 text. */
export async function readText(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

/** Deterministic PRNG (mulberry32) for property-style tests. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
