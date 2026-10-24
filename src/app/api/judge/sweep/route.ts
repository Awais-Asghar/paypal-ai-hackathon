import { judgeOff } from "@/lib/demo/guard";
import { getGate } from "@/lib/gate";
import { backTo, errorResponse } from "@/lib/http";

// "Simulate next event": runs the scheduler once, the same work the cron job does.
export async function POST() {
  const off = judgeOff();
  if (off) return off;
  try {
    console.log("Judge sweep", await (await getGate()).sweep());
  } catch (e) {
    return errorResponse(e);
  }
  return backTo("/judge");
}
