import { AiPlanSchema } from "@/lib/contracts";
import type { AiPlan } from "@/lib/contracts";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Drops `dependsOn` entries that do not name another task in the list (and self-references),
 * de-duplicates them and keeps at most five. Works on raw model output before Zod parsing.
 */
export function sanitizeDependsOn(raw: unknown): unknown {
  if (!isRecord(raw) || !Array.isArray(raw.tasks)) return raw;
  const ids = new Set(raw.tasks.filter(isRecord).map((t) => t.id).filter((id) => typeof id === "string"));
  const tasks = raw.tasks.map((t) => {
    if (!isRecord(t) || !Array.isArray(t.dependsOn)) return t;
    const deps = t.dependsOn.filter((d): d is string => typeof d === "string" && d !== t.id && ids.has(d));
    return { ...t, dependsOn: [...new Set(deps)].slice(0, 5) };
  });
  return { ...raw, tasks };
}

/** Parses and validates model text into an `AiPlan`, or returns a short error summary. */
export function parseAiPlan(text: string | undefined): { ok: true; ai: AiPlan } | { ok: false; error: string } {
  const body = (text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!body) return { ok: false, error: "The reply was empty." };
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return { ok: false, error: "The reply was not valid JSON." };
  }
  const parsed = AiPlanSchema.safeParse(sanitizeDependsOn(raw));
  if (parsed.success) return { ok: true, ai: parsed.data };
  const issues = parsed.error.issues
    .slice(0, 12)
    .map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`);
  return { ok: false, error: issues.join("; ") };
}
