import type { PublicPlan } from "./plan";

/*
 * Shapes the JSON API sends, declared once for the routes, the browser client and the tests.
 * Types only: nothing here loads Zod.
 */

/** One field-level validation problem; `path` is dot-separated, e.g. `"constraints.0"`. */
export type Issue = { path: string; message: string };

/** Body of every error response: a plain-language message, plus field `issues` on a 400. */
export type ErrorBody = { error: string; issues?: Issue[] };

/** Response of POST /api/plan (201): the stored plan and the edit key, shown to its owner once. */
export type CreatedPlan = { plan: PublicPlan; editKey: string };

/** Response of GET and PATCH /api/plan/[id]: the plan as it now stands. */
export type PlanResponse = { plan: PublicPlan };
