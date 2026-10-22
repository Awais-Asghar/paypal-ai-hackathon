import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CheckinAgent } from "@/lib/ai/checkin-agent";
import type { JsonModel } from "@/lib/ai/llm";
import { CheckinService } from "@/lib/checkin/service";
import { auditLog, holds, payees } from "@/lib/db/schema";
import { resetDemo } from "@/lib/demo/reset";
import { SCENARIOS, type ScenarioId } from "@/lib/demo/scenarios";
import { setup } from "./helpers";

// A model that is always fooled: it rates everything LOW. Only the hard rules stand in the way.
const fooled: JsonModel = {
  name: "fooled",
  json: async (req) =>
    req.schemaName === "risk_verdict" ? { risk: "LOW", scam_type: "none", red_flags: [], reasons_plain: [], family_summary: "" } : { reply: "Thanks", done: true },
};

let t: Awaited<ReturnType<typeof setup>>;
let checkin: CheckinService;
beforeEach(async () => {
  t = await setup();
  checkin = new CheckinService(t.db, t.gate, new CheckinAgent(fooled), async () => null);
});
afterEach(async () => {
  await t.close();
});

async function play(id: ScenarioId) {
  const s = SCENARIOS[id];
  const held = await t.heldPayment({ payee: s.payeeLabelPrefix, amountCents: s.amountCents, purpose: s.purpose, named: s.namedMemberPrefix ?? undefined, story: s.story });
  await checkin.start(held.id);
  await checkin.say(held.id, s.story);
  if (s.evidence) await checkin.addEvidenceText(held.id, s.evidence.kind, s.evidence.text);
  return (await checkin.finish(held.id)).hold;
}

describe("Judge Mode scenarios play out as the demo script says", () => {
  it("grandparent voice clone: held for Ethan to verify", async () => {
    const hold = await play("grandparent");
    expect(hold).toMatchObject({ state: "VERIFYING", risk: "HIGH" });
    expect(hold.redFlags).toEqual(expect.arrayContaining(["secrecy", "new_number", "urgent_emergency"]));
  });

  it("fake CRA threat: held as high risk", async () => {
    const hold = await play("cra");
    expect(hold).toMatchObject({ state: "VERIFYING", risk: "HIGH" });
    expect(hold.redFlags).toEqual(expect.arrayContaining(["authority_threat", "gift_cards_crypto", "new_payee"]));
  });

  it("normal rent: paid out straight away", async () => {
    const hold = await play("rent");
    expect(hold.state).toBe("RELEASED");
  });
});

describe("Reset demo", () => {
  it("voids open holds at PayPal before clearing activity, and keeps the family setup", async () => {
    const open = await play("grandparent");
    await play("rent");
    const before = (await t.db.select().from(payees)).length;

    const result = await resetDemo(t.db, t.gate);
    expect(result).toEqual({ voided: 1, kept: 0, cleared: 2 });
    expect(t.paypal.calls).toContainEqual({ op: "void", requestId: `${open.id}-void` });
    expect(await t.db.select().from(holds)).toHaveLength(0);
    expect(await t.db.select().from(auditLog)).toHaveLength(0);
    expect(await t.db.select().from(payees)).toHaveLength(before);
  });

  it("keeps a hold PayPal would not void, so nothing reserved is forgotten", async () => {
    const open = await play("grandparent");
    t.paypal.failVoid = true;
    expect(await resetDemo(t.db, t.gate)).toEqual({ voided: 0, kept: 1, cleared: 0 });
    const [kept] = await t.db.select().from(holds).where(eq(holds.id, open.id));
    expect(kept.state).toBe("DENIED");
  });
});
