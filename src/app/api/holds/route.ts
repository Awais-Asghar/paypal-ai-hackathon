import { z } from "zod";
import { isScenarioId, judgeMode } from "@/lib/demo/scenarios";
import { getGate } from "@/lib/gate";
import { errorResponse } from "@/lib/http";

const CreateHold = z.object({
  circleId: z.uuid(),
  payeeId: z.uuid(),
  amountCents: z.number().int().positive().max(1_000_000),
  purpose: z.enum(["family", "bills", "shopping", "other"]),
  namedMemberId: z.uuid().nullish(),
  story: z.string().max(4000).nullish(),
  scenario: z.string().nullish(),
});

// Step 1, hold don't send: creates an intent=AUTHORIZE order and returns the PayPal approval link.
export async function POST(request: Request) {
  try {
    const { scenario, ...input } = CreateHold.parse(await request.json());
    const demoScenario = judgeMode() && isScenarioId(scenario) ? scenario : null;
    const { hold, approveUrl } = await (await getGate()).createHold({ ...input, demoScenario });
    return Response.json({ holdId: hold.id, state: hold.state, approveUrl }, { status: 201 });
  } catch (e) {
    return errorResponse(e, "Couldn't reach PayPal. Nothing was sent; please try again.");
  }
}
