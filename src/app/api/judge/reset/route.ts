import { getDb } from "@/lib/db";
import { backTo, judgeOff } from "@/lib/demo/guard";
import { resetDemo } from "@/lib/demo/reset";
import { getGate } from "@/lib/gate";
import { errorResponse } from "@/lib/http";

export async function POST(request: Request) {
  const off = judgeOff();
  if (off) return off;
  try {
    const result = await resetDemo(await getDb(), await getGate());
    return backTo(request, `/judge?kept=${result.kept}`);
  } catch (e) {
    return errorResponse(e);
  }
}
