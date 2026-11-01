import { AI_COUNTS, AiPlanSchema } from "@/lib/contracts";
import type { AiPlan } from "@/lib/contracts";

/** Validation issues quoted back to the model in its correction turn. */
const MAX_REPORTED_ISSUES = 12;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Drops `dependsOn` entries that do not name another task in the list (and self-references),
 * de-duplicates them and keeps at most `AI_COUNTS.dependsOn.max`. Works on raw model output
 * before Zod parsing.
 */
export function sanitizeDependsOn(raw: unknown): unknown {
  if (!isRecord(raw) || !Array.isArray(raw.tasks)) return raw;
  const tasks: unknown[] = raw.tasks;
  const ids = new Set(
    tasks
      .filter(isRecord)
      .map((task) => task.id)
      .filter((id) => typeof id === "string"),
  );
  const cleaned = tasks.map((task): unknown => {
    if (!isRecord(task) || !Array.isArray(task.dependsOn)) return task;
    const dependsOn: unknown[] = task.dependsOn;
    const known = dependsOn.filter(
      (dep): dep is string => typeof dep === "string" && dep !== task.id && ids.has(dep),
    );
    return { ...task, dependsOn: [...new Set(known)].slice(0, AI_COUNTS.dependsOn.max) };
  });
  return { ...raw, tasks: cleaned };
}

/** Removes a Markdown code fence the model may wrap its JSON in. */
function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

/** Parses and validates model text into an `AiPlan`, or returns a short error summary. */
export function parseAiPlan(
  text: string | undefined,
): { ok: true; ai: AiPlan } | { ok: false; error: string } {
  const body = stripCodeFence(text ?? "");
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
    .slice(0, MAX_REPORTED_ISSUES)
    .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`);
  return { ok: false, error: issues.join("; ") };
}
