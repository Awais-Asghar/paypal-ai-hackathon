import { getCheckin } from "@/lib/checkin";
import { errorResponse } from "@/lib/http";

// Kept for API clients: same as /checkin/finish. A risk verdict is never accepted from the client;
// the AI verdict is produced server-side and the hard rules apply in the gate.
export async function POST(_request: Request, ctx: RouteContext<"/api/holds/[id]/assess">) {
  const { id } = await ctx.params;
  try {
    const checkin = await getCheckin();
    await checkin.start(id);
    const { hold, verification } = await checkin.finish(id);
    return Response.json({ state: hold.state, risk: hold.risk, redFlags: hold.redFlags, reasons: hold.riskReasons, verificationSentTo: verification?.member.name ?? null });
  } catch (e) {
    return errorResponse(e);
  }
}
