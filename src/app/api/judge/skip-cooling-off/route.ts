import { z } from "zod";
import { backTo, judgeOff } from "@/lib/demo/guard";
import { GateError, getGate } from "@/lib/gate";
import { errorResponse } from "@/lib/http";

// Judge Mode only: end a 24-hour cooling-off timer now. Recorded in the audit log as "judge".
// Accepts JSON ({ holdId }) or a form post from the Judge page.
export async function POST(request: Request) {
  const off = judgeOff();
  if (off) return off;
  const isForm = request.headers.get("content-type")?.includes("form") ?? false;
  try {
    const raw = isForm ? Object.fromEntries(await request.formData()) : await request.json();
    const { holdId } = z.object({ holdId: z.uuid() }).parse(raw);
    try {
      const hold = await (await getGate()).skipCoolingOff(holdId);
      if (!isForm) return Response.json({ state: hold.state });
    } catch (e) {
      if (e instanceof GateError || !isForm) throw e;
      console.error("Release after skipping cooling-off failed; sweeper will retry", e);
    }
    return backTo(request, "/judge");
  } catch (e) {
    return errorResponse(e);
  }
}
