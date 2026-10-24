import { getReports } from "@/lib/aftercare";
import { getGate } from "@/lib/gate";
import { backTo, errorResponse } from "@/lib/http";

// Aftercare: drafts the scam report for this hold (AI, with a template fallback), then shows it.
export async function POST(_request: Request, ctx: RouteContext<"/api/holds/[id]/report">) {
  const { id } = await ctx.params;
  try {
    const hold = await (await getGate()).getHold(id);
    await (await getReports()).prepare(hold);
  } catch (e) {
    return errorResponse(e);
  }
  return backTo(`/holds/${id}/report`);
}
