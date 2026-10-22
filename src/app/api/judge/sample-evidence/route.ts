import { z } from "zod";
import { getCheckin } from "@/lib/checkin";
import { judgeOff } from "@/lib/demo/guard";
import { isScenarioId, SCENARIOS } from "@/lib/demo/scenarios";
import { getGate } from "@/lib/gate";
import { errorResponse } from "@/lib/http";

// Adds the scenario's sample voicemail or screenshot text to the check-in, as if Nana had shared it.
export async function POST(request: Request) {
  const off = judgeOff();
  if (off) return off;
  try {
    const { holdId } = z.object({ holdId: z.uuid() }).parse(await request.json());
    const hold = await (await getGate()).getHold(holdId);
    const evidence = isScenarioId(hold.demoScenario) ? SCENARIOS[hold.demoScenario].evidence : null;
    if (!evidence) return Response.json({ error: "This payment has no sample evidence" }, { status: 400 });
    const text = await (await getCheckin()).addEvidenceText(holdId, evidence.kind, evidence.text);
    return Response.json({ kind: evidence.kind, read: true, text });
  } catch (e) {
    return errorResponse(e);
  }
}
