import type { Health } from "@/lib/contracts";
import { getAi } from "@/lib/ai/client";
import { json } from "@/lib/server/http";
import { storeKind } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/health — which AI backend and store are live. Never cached. */
export function GET(): Response {
  const ai = getAi();
  const health: Health = {
    status: "ok",
    ai: ai?.backend ?? "template",
    store: storeKind(),
    model: ai?.model ?? "template",
  };
  return json(health);
}
