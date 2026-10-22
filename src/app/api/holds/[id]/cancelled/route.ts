import { redirect } from "next/navigation";
import { getGate } from "@/lib/gate";
import { errorResponse } from "@/lib/http";

export async function GET(_request: Request, ctx: RouteContext<"/api/holds/[id]/cancelled">) {
  const { id } = await ctx.params;
  try {
    await (await getGate()).cancelDraft(id);
  } catch (e) {
    return errorResponse(e);
  }
  redirect(`/holds/${id}`);
}
