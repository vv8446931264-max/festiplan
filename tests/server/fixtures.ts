import type { Content, GenerateContentParameters } from "@google/genai";
import type { AiHandle, AiModels, AiResponse } from "@/lib/ai/client";
import type { Allocation, PlanInput } from "@/lib/contracts";
import { createPlan } from "@/lib/server/plan-service";
import { MemoryStore } from "@/lib/store";

/** A fixed "today" for engine-facing tests. */
export const TODAY = "2026-10-24";

/** A fixed clock for plans created in tests. */
export const NOW = new Date("2026-10-24T06:30:00Z");

/** A valid wedding brief (Riya & Arjun's sangeet). */
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

/** The rupees allocated across a budget's lines (contingency excluded). */
export const budgetTotal = (budget: Allocation[]): number =>
  budget.reduce((sum, line) => sum + line.amountINR, 0);

/** A template plan for `sampleInput()`, stored in a fresh in-memory store at `NOW`. */
export async function storedPlan() {
  const store = new MemoryStore(() => NOW.getTime());
  const created = await createPlan(sampleInput(), TODAY, { store, ai: null, now: NOW });
  return { store, ...created };
}

/** A canned model reply, or the error the call should fail with. */
export type Reply = AiResponse | Error;
/** One streamed chunk of text, or the error the stream should fail with. */
export type StreamPart = string | Error;

const settle = <T>(value: T | Error): Promise<T> =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

/** Replays streamed chunks asynchronously, like a network stream, failing where told to. */
async function* replay(parts: readonly StreamPart[]): AsyncGenerator<AiResponse> {
  for (const part of parts) yield { text: await settle(part) };
}

/** A fake Gemini handle that replays canned replies and records every call. */
export function fakeAi(
  replies: Reply[] = [],
  stream: StreamPart[] = [],
  model = "gemini-3.5-flash",
) {
  const calls: GenerateContentParameters[] = [];
  const streamCalls: GenerateContentParameters[] = [];
  const models: AiModels = {
    generateContent(params) {
      calls.push(params);
      // Past the last canned reply, keep answering with the last one.
      const reply = replies.at(Math.min(calls.length, replies.length) - 1);
      return settle(reply ?? new Error("no reply configured"));
    },
    generateContentStream(params) {
      streamCalls.push(params);
      return Promise.resolve(replay(stream));
    },
  };
  const handle: AiHandle = { client: { models }, backend: "gemini-api", model };
  return { handle, calls, streamCalls };
}

/** A reply whose text is the JSON of `value`. */
export const jsonReply = (value: unknown): AiResponse => ({ text: JSON.stringify(value) });

const isContent = (item: unknown): item is Content =>
  typeof item === "object" && item !== null && "parts" in item;

/** The text of a string or `{ text }` part; anything else has none. */
function partText(part: unknown): string {
  if (typeof part === "string") return part;
  if (typeof part === "object" && part !== null && "text" in part) {
    return typeof part.text === "string" ? part.text : "";
  }
  return "";
}

/** Every text part of a request's `contents`, joined — for prompt assertions. */
export function promptText(params: GenerateContentParameters | undefined): string {
  const contents = params?.contents;
  if (contents === undefined) return "";
  const items: unknown[] = Array.isArray(contents) ? contents : [contents];
  return items
    .flatMap((item) => (isContent(item) ? (item.parts ?? []) : [item]))
    .map(partText)
    .join("\n");
}

/** Reads a whole byte stream as UTF-8 text. */
export async function readText(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

/** Deterministic PRNG (mulberry32) for property-style tests. */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
