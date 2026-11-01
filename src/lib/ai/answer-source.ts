/**
 * Which part of an "Ask FestiPlan" answer came from where. Shared by the server stream
 * (refine.ts) and the browser (AskSection), so it imports nothing: no SDK, no Zod.
 */

/** First line of every deterministic answer, so readers (and tests) can tell it apart. */
export const TEMPLATE_ANSWER_PREFIX = "Template answer — AI unavailable.";

/** An answer split into the model's text (plan language) and the template fallback (English). */
export type AnswerParts = { model: string; template: string };

/**
 * Splits a streamed answer at the template prefix. The model's text comes first; a template
 * answer (the whole reply, or appended after a mid-stream failure) runs to the end.
 * @param answer The answer text received so far.
 */
export function splitTemplateAnswer(answer: string): AnswerParts {
  const at = answer.indexOf(TEMPLATE_ANSWER_PREFIX);
  if (at === -1) return { model: answer, template: "" };
  return { model: answer.slice(0, at), template: answer.slice(at) };
}
