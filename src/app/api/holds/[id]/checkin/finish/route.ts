import { getCheckin } from "@/lib/checkin";
import { errorResponse } from "@/lib/http";

// Ends the check-in: the AI verdict goes to the Payment Gate, which applies the hard rules and routes the hold.
export async function POST(_request: Request, ctx: RouteContext<"/api/holds/[id]/checkin/finish">) {
  const { id } = await ctx.params;
  try {
    const { hold, verification } = await (await getCheckin()).finish(id);
    return Response.json({ state: hold.state, risk: hold.risk, redFlags: hold.redFlags, reasons: hold.riskReasons, verificationSentTo: verification?.member.name ?? null });
  } catch (e) {
    return errorResponse(e);
  }
}
