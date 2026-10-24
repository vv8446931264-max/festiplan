import { LIMITS, VendorQuerySchema } from "@/lib/contracts";
import { findVendors } from "@/lib/ai/vendors";
import { readJson } from "@/lib/security/body";
import { invalid, json, perIpLimit, problem, runGuards, sameOrigin, toIssues, withRoute } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limit = perIpLimit("vendors", 10);

/**
 * POST /api/vendors — Maps-grounded vendors. Body `{ city, category, eventType }`.
 * 200 `VendorResult` · 400 `{ error, issues }` · 403 · 413 · 415 · 429.
 */
export const POST = withRoute("POST /api/vendors", async (req: Request) => {
  const blocked = runGuards(req, sameOrigin, limit);
  if (blocked) return blocked;
  const body = await readJson(req, LIMITS.vendorBodyBytes);
  if (!body.ok) return problem(body.status, body.error);
  const parsed = VendorQuerySchema.safeParse(body.data);
  if (!parsed.success) return invalid(toIssues(parsed.error));
  return json(await findVendors(parsed.data));
});
