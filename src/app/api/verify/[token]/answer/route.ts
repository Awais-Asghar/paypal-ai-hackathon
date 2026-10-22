import { GateError, getGate } from "@/lib/gate";
import { errorResponse } from "@/lib/http";

// The verified family member's answer, posted from the "Is this really you?" page.
export async function POST(request: Request, ctx: RouteContext<"/api/verify/[token]/answer">) {
  const { token } = await ctx.params;
  const answer = (await request.formData()).get("answer");
  if (answer !== "it_was_me" && answer !== "not_me") return Response.json({ error: "Invalid answer" }, { status: 400 });
  try {
    await (await getGate()).answerVerification(token, answer);
  } catch (e) {
    if (e instanceof GateError) return errorResponse(e);
    // The answer is recorded; only the PayPal step failed. The money stays held and the sweeper retries it.
    console.error("PayPal step after verification answer failed; sweeper will retry", e);
  }
  // 303 so the browser follows with a GET back to the page.
  return Response.redirect(new URL(`/verify/${encodeURIComponent(token)}`, request.url), 303);
}
