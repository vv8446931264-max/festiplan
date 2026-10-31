import { CATEGORY_LABELS } from "@/lib/contracts";
import type { PublicPlan } from "@/lib/contracts";
import { formatDate, formatINR, nextActions } from "@/lib/engine";
import { getAi, thinkingFor } from "./client";
import type { AiHandle } from "./client";
import { SYSTEM_REFINE, dataBlock, languageName } from "./prompts";

/** Injectable dependencies (tests pass a fake client). */
export type RefineDeps = { ai?: AiHandle | null; timeoutMs?: number };

/** Deadline for one streamed answer, first token to last. */
export const REFINE_TIMEOUT_MS = 30_000;
/** First line of every deterministic answer, so readers (and tests) can tell it apart. */
export const TEMPLATE_ANSWER_PREFIX = "Template answer — AI unavailable.";

/** Output ceiling for one answer; the prompt asks for at most 180 words. */
const REFINE_MAX_TOKENS = 1024;
/** Open tasks the model sees: enough context without sending the whole timeline. */
const MAX_OPEN_TASKS = 15;
/** Budget lines and next tasks the template answer lists. */
const TEMPLATE_LIST_LENGTH = 3;

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
    budget: plan.budget.map((line) => ({
      category: line.category,
      amountINR: line.amountINR,
      percent: line.percent,
      perGuestINR: line.perGuestINR,
      locked: line.locked,
      actualINR: line.actualINR,
    })),
    ideas: plan.ai.ideas.map((idea) => ({ name: idea.name, concept: idea.concept })),
    openTasks: nextActions(plan.timeline, MAX_OPEN_TASKS).map((task) => ({
      title: task.title,
      due: task.due,
      phase: task.phase,
      overdue: task.overdue,
    })),
    tasksDone: plan.timeline.filter((task) => task.done).length,
    vendors: plan.vendors.map((item) => ({
      category: item.category,
      bookBy: item.bookBy,
      done: item.done,
    })),
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
  const biggest = [...plan.budget]
    .sort((a, b) => b.amountINR - a.amountINR)
    .slice(0, TEMPLATE_LIST_LENGTH)
    .map((line) => `${CATEGORY_LABELS[line.category]} (${formatINR(line.amountINR)})`);
  const nextUp = nextActions(plan.timeline, TEMPLATE_LIST_LENGTH).map(
    (task) => `- ${task.title} — due ${formatDate(task.due)}`,
  );
  return [
    TEMPLATE_ANSWER_PREFIX,
    "",
    `Your biggest budget lines are ${biggest.join(", ")}, with ${formatINR(plan.contingencyINR)} held back as contingency. To move money between categories, drag the budget sliders — the totals rebalance automatically.`,
    "",
    nextUp.length > 0 ? `Next up:\n${nextUp.join("\n")}` : "Every task is ticked off — well done!",
    "",
    "Ask again in a minute for a personalised answer.",
  ].join("\n");
}

/** The model's answer as it streams in, skipping empty chunks. */
async function* modelChunks(
  handle: AiHandle,
  prompt: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const stream = await handle.client.models.generateContentStream({
    model: handle.model,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_REFINE,
      thinkingConfig: thinkingFor(handle.model),
      maxOutputTokens: REFINE_MAX_TOKENS,
      abortSignal: signal,
    },
  });
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}

/** The model's answer, falling back to (or finishing with) the template answer on failure. */
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
export function refineStream(
  plan: PublicPlan,
  question: string,
  deps: RefineDeps = {},
): ReadableStream<Uint8Array> {
  const handle = deps.ai === undefined ? getAi() : deps.ai;
  const abort = new AbortController();
  const signal = AbortSignal.any([
    abort.signal,
    AbortSignal.timeout(deps.timeoutMs ?? REFINE_TIMEOUT_MS),
  ]);
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
