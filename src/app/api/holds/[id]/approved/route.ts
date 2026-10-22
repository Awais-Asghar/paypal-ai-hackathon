import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getGate } from "@/lib/gate";
import { errorResponse } from "@/lib/http";

// PayPal return URL after the protected person approves. PayPal appends ?token=<order id>.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/holds/[id]/approved">) {
  const { id } = await ctx.params;
  try {
    const gate = await getGate();
    const hold = await gate.getHold(id);
    if (request.nextUrl.searchParams.get("token") !== hold.paypalOrderId) {
      return Response.json({ error: "Order does not match this hold" }, { status: 400 });
    }
    await gate.onBuyerApproved(id);
  } catch (e) {
    return errorResponse(e);
  }
  redirect(`/holds/${id}`);
}
