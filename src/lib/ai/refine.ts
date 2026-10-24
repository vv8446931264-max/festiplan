import { CATEGORY_LABELS } from "@/lib/contracts";
import type { PublicPlan } from "@/lib/contracts";
import { formatDate, formatINR, nextActions } from "@/lib/engine";
import { getAi, thinkingFor } from "./client";
import type { AiHandle } from "./client";
import { SYSTEM_REFINE, dataBlock, languageName } from "./prompts";

/** Injectable dependencies (tests pass a fake client). */
export type RefineDeps = { ai?: AiHandle | null; timeoutMs?: number };

export const REFINE_TIMEOUT_MS = 30_000;
export const TEMPLATE_ANSWER_PREFIX = "Template answer — AI unavailable.";

/** The plan facts the model may quote, kept small: numbers come from the engine, never the model. */
export function compactPlan(plan: PublicPlan) {
  const { input } = plan;
  return {
    event: {
      type: input.eventType,
      title: input.title ?? null,
      date: input.eventDate,
      city: input.city,
      guests: input.guests,
      totalBudgetINR: input.budgetINR,
      vibe: input.vibe,
      constraints: input.constraints,
    },
    contingencyINR: plan.contingencyINR,
    budget: plan.budget.map((a) => ({
      category: a.category,
      amountINR: a.amountINR,
      percent: a.percent,
      perGuestINR: a.perGuestINR,
      locked: a.locked,
      actualINR: a.actualINR,
    })),
    ideas: plan.ai.ideas.map((i) => ({ name: i.name, concept: i.concept })),
    openTasks: nextActions(plan.timeline, 15).map((t) => ({ title: t.title, due: t.due, phase: t.phase, overdue: t.overdue })),
    tasksDone: plan.timeline.filter((t) => t.done).length,
    vendors: plan.vendors.map((v) => ({ category: v.category, bookBy: v.bookBy, done: v.done })),
  };
}

/** The user turn: plan JSON and question inside data blocks, trusted instructions outside. */
export function refinePrompt(plan: PublicPlan, question: string): string {
  return [
    dataBlock("PLAN", JSON.stringify(compactPlan(plan))),
    dataBlock("QUESTION", question.trim()),
    `Answer the question using only the plan data. Reply in ${languageName(plan.input.language)}, in at most 180 words.`,
  ].join("\n\n");
}

/** Deterministic answer used when the model is unavailable: biggest budget lines and next tasks. */
export function templateAnswer(plan: PublicPlan): string {
  const top = [...plan.budget].sort((a, b) => b.amountINR - a.amountINR).slice(0, 3);
  const lines = top.map((a) => `${CATEGORY_LABELS[a.category]} (${formatINR(a.amountINR)})`);
  const next = nextActions(plan.timeline, 3).map((t) => `- ${t.title} — due ${formatDate(t.due)}`);
  return [
    TEMPLATE_ANSWER_PREFIX,
    "",
    `Your biggest budget lines are ${lines.join(", ")}, with ${formatINR(plan.contingencyINR)} held back as contingency. To move money between categories, drag the budget sliders — the totals rebalance automatically.`,
    "",
    next.length ? `Next up:\n${next.join("\n")}` : "Every task is ticked off — well done!",
    "",
    "Ask again in a minute for a personalised answer.",
  ].join("\n");
}

async function* modelChunks(handle: AiHandle, prompt: string, signal: AbortSignal): AsyncGenerator<string> {
  const stream = await handle.client.models.generateContentStream({
    model: handle.model,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_REFINE,
      thinkingConfig: thinkingFor(handle.model),
      maxOutputTokens: 1024,
      abortSignal: signal,
    },
  });
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}

async function* answerChunks(
  plan: PublicPlan,
  question: string,
  handle: AiHandle | null,
  signal: AbortSignal,
): AsyncGenerator<string> {
  if (!handle) {
    yield templateAnswer(plan);
    return;
  }
  let sent = false;
  try {
    for await (const text of modelChunks(handle, refinePrompt(plan, question), signal)) {
      sent = true;
      yield text;
    }
    if (!sent) yield templateAnswer(plan);
  } catch {
    yield `${sent ? "\n\n" : ""}${templateAnswer(plan)}`;
  }
}

/**
 * "Ask FestiPlan": a UTF-8 text stream answering `question` grounded in the plan JSON.
 * With no backend, an empty reply or an error (even mid-stream) it emits a deterministic
 * template answer prefixed "Template answer — AI unavailable.".
 */
export function refineStream(plan: PublicPlan, question: string, deps: RefineDeps = {}): ReadableStream<Uint8Array> {
  const handle = deps.ai === undefined ? getAi() : deps.ai;
  const abort = new AbortController();
  const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(deps.timeoutMs ?? REFINE_TIMEOUT_MS)]);
  const chunks = answerChunks(plan, question, handle, signal);
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await chunks.next();
      if (next.done) controller.close();
      else controller.enqueue(encoder.encode(next.value));
    },
    async cancel() {
      abort.abort();
      await chunks.return(undefined);
    },
  });
}
