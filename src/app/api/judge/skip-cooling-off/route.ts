import { z } from "zod";
import { getGate } from "@/lib/gate";
import { errorResponse } from "@/lib/http";

// Judge Mode only (JUDGE_MODE=1): end a 24-hour cooling-off timer now. Recorded in the audit log as "judge".
export async function POST(request: Request) {
  if (process.env.JUDGE_MODE !== "1") return Response.json({ error: "Judge Mode is off" }, { status: 404 });
  try {
    const { holdId } = z.object({ holdId: z.uuid() }).parse(await request.json());
    const hold = await (await getGate()).skipCoolingOff(holdId);
    return Response.json({ state: hold.state });
  } catch (e) {
    return errorResponse(e);
  }
}
