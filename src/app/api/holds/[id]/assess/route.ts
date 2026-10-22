import { z } from "zod";
import { getGate } from "@/lib/gate";
import { errorResponse } from "@/lib/http";

const Assess = z.object({ text: z.string().max(20_000).default("") });

// Runs the hard rules on what the person shared. The AI check-in agent will supply its verdict
// server-side; a verdict is never accepted from the client. Without one the gate fails safe (MEDIUM or higher).
export async function POST(request: Request, ctx: RouteContext<"/api/holds/[id]/assess">) {
  const { id } = await ctx.params;
  try {
    const { text } = Assess.parse(await request.json());
    const { hold, verification } = await (await getGate()).assess(id, { text, llm: null });
    // Delivery to the saved contact is not built yet; until then the link goes to the dev server log only.
    if (verification && process.env.NODE_ENV !== "production") console.log(`[outbox] To ${verification.member.name}: ${verification.url}`);
    // The link itself is never returned to the caller: it goes only to the contact saved at setup.
    return Response.json({ state: hold.state, risk: hold.risk, redFlags: hold.redFlags, reasons: hold.riskReasons, verificationSentTo: verification?.member.name ?? null });
  } catch (e) {
    return errorResponse(e);
  }
}
