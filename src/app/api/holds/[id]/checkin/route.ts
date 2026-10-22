import { getCheckin } from "@/lib/checkin";
import { errorResponse } from "@/lib/http";

// Starts (or resumes) the AI check-in and returns the conversation so far.
export async function POST(_request: Request, ctx: RouteContext<"/api/holds/[id]/checkin">) {
  const { id } = await ctx.params;
  try {
    return Response.json(await (await getCheckin()).start(id));
  } catch (e) {
    return errorResponse(e);
  }
}
