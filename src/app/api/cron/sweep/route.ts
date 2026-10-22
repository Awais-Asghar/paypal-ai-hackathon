import { getGate } from "@/lib/gate";
import { errorResponse, hasBearer } from "@/lib/http";

// Called by the scheduler (Render cron): ends cooling-off timers, voids holds near their deadline,
// retries stuck steps. Requires "Authorization: Bearer $CRON_SECRET".
export async function POST(request: Request) {
  if (!hasBearer(request, process.env.CRON_SECRET)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json({ results: await (await getGate()).sweep() });
  } catch (e) {
    return errorResponse(e);
  }
}
