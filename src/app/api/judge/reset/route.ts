import { getDb } from "@/lib/db";
import { judgeOff } from "@/lib/demo/guard";
import { resetDemo } from "@/lib/demo/reset";
import { getGate } from "@/lib/gate";
import { backTo, errorResponse } from "@/lib/http";

export async function POST() {
  const off = judgeOff();
  if (off) return off;
  try {
    const result = await resetDemo(await getDb(), await getGate());
    return backTo(`/judge?kept=${result.kept}`);
  } catch (e) {
    return errorResponse(e);
  }
}
