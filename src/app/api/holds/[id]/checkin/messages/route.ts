import { z } from "zod";
import { getCheckin } from "@/lib/checkin";
import { errorResponse } from "@/lib/http";

export async function POST(request: Request, ctx: RouteContext<"/api/holds/[id]/checkin/messages">) {
  const { id } = await ctx.params;
  try {
    const { text } = z.object({ text: z.string().min(1).max(2000) }).parse(await request.json());
    const { reply, done } = await (await getCheckin()).say(id, text);
    return Response.json({ reply, done });
  } catch (e) {
    return errorResponse(e);
  }
}
