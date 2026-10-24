import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { GateError, getGate } from "@/lib/gate";
import { backTo, errorResponse } from "@/lib/http";

// "Stop this payment" for the protected person. Stopping is always allowed; it can only void.
export async function POST(_request: Request, ctx: RouteContext<"/api/holds/[id]/stop">) {
  const { id } = await ctx.params;
  try {
    const gate = await getGate();
    const hold = await gate.getHold(id);
    const db = await getDb();
    const [sender] = await db.select().from(members).where(and(eq(members.circleId, hold.circleId), eq(members.role, "protected")));
    if (!sender) throw new GateError("NOT_FOUND", "No protected member in this circle");
    await gate.decide(id, sender.id, "deny", "Stopped by the sender");
  } catch (e) {
    // Already decided or sent: the hold page shows what actually happened.
    if (e instanceof GateError && e.code === "CONFLICT") return backTo(`/holds/${id}`);
    if (e instanceof GateError) return errorResponse(e);
    // The decision is recorded; only the PayPal void failed, and the sweeper retries it.
    console.error("Void after stop failed; sweeper will retry", e);
  }
  return backTo(`/holds/${id}`);
}
