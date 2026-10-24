import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decisions, holds } from "@/lib/db/schema";
import { GateError } from "@/lib/gate/payment-gate";
import { ETHAN_PAYER_ID, setup } from "./helpers";

const GRANDPARENT_SCAM = "Nana, it's Ethan. I got arrested and need $2,500 for bail right now. I lost my phone, this is my new number. Please don't tell Mom.";

let t: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

describe("normal life still works", () => {
  it("pays rent to a known payee straight away", async () => {
    const held = await t.heldPayment({ payee: "Robert", amountCents: 90000, purpose: "bills", story: "November rent" });
    expect(held.state).toBe("HELD");
    expect(held.expiresAt!.getTime() - held.authorizedAt!.getTime()).toBe(60 * 3600_000);

    const { hold } = await t.gate.assess(held.id, { text: "", llm: { risk: "LOW" } });
    expect(hold.state).toBe("RELEASED");
    expect(await t.states(held.id)).toEqual(["DRAFT", "HELD", "ASSESSING", "APPROVED", "RELEASED"]);
    expect(t.paypal.ops()).toEqual(["createOrder", "authorize", "capture", "payout"]);
    expect(t.paypal.calls.at(-1)!.receiver).toEqual({ type: "EMAIL", value: "robert@sandbox.test" });
  });
});

describe("the grandparent voice-clone scam", () => {
  it("holds, asks the real Ethan, and voids when he says it was not him", async () => {
    const held = await t.heldPayment({ payee: "Ethan", amountCents: 250000, purpose: "family", named: "Ethan", story: GRANDPARENT_SCAM });
    // The model is fooled, but the hard rules are not.
    const { hold, verification } = await t.gate.assess(held.id, { text: "", llm: { risk: "LOW" } });
    expect(hold.state).toBe("VERIFYING");
    expect(hold.risk).toBe("HIGH");
    expect(hold.redFlags).toEqual(expect.arrayContaining(["secrecy", "new_number", "urgent_emergency"]));
    expect(verification!.member.name).toBe("Ethan Collins");

    // Someone else logs in with PayPal: no match, nothing unlocks.
    expect(await t.gate.recordIdentity(verification!.token, "SCAMMERPAYERID")).toBe("identity_mismatch");
    await expect(t.gate.answerVerification(verification!.token, "it_was_me")).rejects.toThrow("Log in with PayPal first");

    expect(await t.gate.recordIdentity(verification!.token, ETHAN_PAYER_ID)).toBe("identity_matched");
    const final = await t.gate.answerVerification(verification!.token, "not_me");

    expect(final.state).toBe("VOIDED");
    expect(t.paypal.ops()).not.toContain("capture");
    expect(t.paypal.ops()).not.toContain("payout");
    expect(await t.states(held.id)).toEqual(["DRAFT", "HELD", "ASSESSING", "VERIFYING", "DENIED", "VOIDED"]);
  });

  it("pays only Ethan's verified PayPal ID when he confirms", async () => {
    const held = await t.heldPayment({ payee: "Ethan", amountCents: 250000, purpose: "family", named: "Ethan", story: GRANDPARENT_SCAM });
    const { verification } = await t.gate.assess(held.id, { text: "", llm: { risk: "HIGH" } });
    await t.gate.recordIdentity(verification!.token, ETHAN_PAYER_ID);
    const final = await t.gate.answerVerification(verification!.token, "it_was_me");
    expect(final.state).toBe("RELEASED");
    expect(t.paypal.calls.at(-1)!.receiver).toEqual({ type: "PAYPAL_ID", value: ETHAN_PAYER_ID });
  });

  it("rejects an expired verification link", async () => {
    const held = await t.heldPayment({ payee: "Ethan", amountCents: 250000, purpose: "family", named: "Ethan", story: GRANDPARENT_SCAM });
    const { verification } = await t.gate.assess(held.id, { text: "", llm: null });
    t.clock.now = new Date(t.clock.now.getTime() + 25 * 3600_000);
    expect(await t.gate.recordIdentity(verification!.token, ETHAN_PAYER_ID)).toBe("expired");
  });
});

describe("pay only the verified payee", () => {
  it("refuses a family story paid to someone else, even with a family approval", async () => {
    const held = await t.heldPayment({ payee: "Officer", amountCents: 250000, purpose: "family", named: "Ethan", story: "Ethan needs bail, pay the bail office" });
    const { hold } = await t.gate.assess(held.id, { text: "", llm: { risk: "MEDIUM" } });
    expect(hold.state).toBe("VERIFYING");
    expect(hold.redFlags).toContain("different_account");

    const final = await t.gate.decide(held.id, t.member("Sarah").id, "approve");
    expect(final.state).toBe("VOIDED");
    expect(t.paypal.ops()).not.toContain("payout");
  });

  it("lets the protected person stop a payment before and during the check-in", async () => {
    const before = await t.heldPayment({ payee: "Robert", amountCents: 90000, purpose: "bills" });
    expect((await t.gate.decide(before.id, t.member("Margaret").id, "deny", "Stopped by the sender")).state).toBe("VOIDED");

    const during = await t.heldPayment({ payee: "Ethan", amountCents: 250000, purpose: "family", named: "Ethan", story: GRANDPARENT_SCAM });
    await t.gate.beginCheckin(during.id);
    // Nobody can approve mid check-in; the check-in has to route it first.
    await expect(t.gate.decide(during.id, t.member("Ethan").id, "approve")).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await t.gate.decide(during.id, t.member("Margaret").id, "deny", "Stopped by the sender")).state).toBe("VOIDED");
    expect(await t.states(during.id)).toEqual(["DRAFT", "HELD", "ASSESSING", "DENIED", "VOIDED"]);
    expect(t.paypal.ops()).not.toContain("capture");
  });

  it("does not let a stop land on a hold that is already going out", async () => {
    const held = await t.heldPayment({ payee: "Robert", amountCents: 90000, purpose: "bills" });
    await t.gate.assess(held.id, { text: "", llm: null });
    expect((await t.gate.getHold(held.id)).state).toBe("COOLING_OFF");

    // The scheduler approves the payment between the stop's first read and its write.
    const read = t.gate.getHold.bind(t.gate);
    let raced = false;
    t.gate.getHold = async (id: string) => {
      const seen = await read(id);
      if (!raced) {
        raced = true;
        await t.db.update(holds).set({ state: "APPROVED" }).where(eq(holds.id, id));
      }
      return seen;
    };

    await expect(t.gate.decide(held.id, t.member("Margaret").id, "deny")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await t.db.select().from(decisions).where(eq(decisions.holdId, held.id))).toHaveLength(0);
    expect(t.paypal.ops()).not.toContain("void");
  });

  it("does not let the protected person approve their own held payment", async () => {
    const held = await t.heldPayment({ payee: "Ethan", amountCents: 250000, purpose: "family", named: "Ethan", story: GRANDPARENT_SCAM });
    await t.gate.assess(held.id, { text: "", llm: null });
    await expect(t.gate.decide(held.id, t.member("Margaret").id, "approve")).rejects.toThrow(GateError);
    expect((await t.gate.decide(held.id, t.member("Margaret").id, "deny", "Changed my mind")).state).toBe("VOIDED");
  });
});

describe("fail safe", () => {
  it("waits out the cooling-off timer when the AI is unavailable", async () => {
    const held = await t.heldPayment({ payee: "Robert", amountCents: 90000, purpose: "bills" });
    const { hold } = await t.gate.assess(held.id, { text: "", llm: null });
    expect(hold.state).toBe("COOLING_OFF");

    await t.gate.sweep();
    expect((await t.gate.getHold(held.id)).state).toBe("COOLING_OFF");

    t.clock.now = new Date(t.clock.now.getTime() + 24 * 3600_000);
    await t.gate.sweep();
    expect((await t.gate.getHold(held.id)).state).toBe("RELEASED");
  });

  it("voids a hold nobody decided on before the honor period ends", async () => {
    const held = await t.heldPayment({ payee: "Ethan", amountCents: 250000, purpose: "family", named: "Ethan", story: GRANDPARENT_SCAM });
    await t.gate.assess(held.id, { text: "", llm: null });
    t.clock.now = new Date(t.clock.now.getTime() + 61 * 3600_000);
    const results = await t.gate.sweep();
    expect(results).toContainEqual({ holdId: held.id, action: "void_expiring" });
    expect((await t.gate.getHold(held.id)).state).toBe("VOIDED");
  });

  it("keeps the hold DENIED when PayPal fails to void, then retries", async () => {
    const held = await t.heldPayment({ payee: "Robert", amountCents: 90000, purpose: "bills" });
    await t.gate.assess(held.id, { text: "", llm: null });
    t.paypal.failVoid = true;
    await expect(t.gate.decide(held.id, t.member("Margaret").id, "deny")).rejects.toThrow("PayPal unavailable");
    expect((await t.gate.getHold(held.id)).state).toBe("DENIED");

    t.paypal.failVoid = false;
    await t.gate.sweep();
    expect((await t.gate.getHold(held.id)).state).toBe("VOIDED");
  });

  it("refuses to skip states", async () => {
    const held = await t.heldPayment({ payee: "Robert", amountCents: 90000, purpose: "bills" });
    await expect(t.gate.release(held.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("idempotency and webhooks", () => {
  it("never captures or pays twice", async () => {
    const held = await t.heldPayment({ payee: "Robert", amountCents: 90000, purpose: "bills" });
    await t.gate.assess(held.id, { text: "", llm: { risk: "LOW" } });
    await t.gate.release(held.id);
    await t.gate.sweep();
    expect(t.paypal.ops().filter((o) => o === "capture")).toHaveLength(1);
    expect(t.paypal.ops().filter((o) => o === "payout")).toHaveLength(1);
  });

  it("de-duplicates events and follows PayPal when an authorization is voided", async () => {
    const held = await t.heldPayment({ payee: "Ethan", amountCents: 250000, purpose: "family", named: "Ethan", story: GRANDPARENT_SCAM });
    await t.gate.assess(held.id, { text: "", llm: null });
    const event = { id: "WH-1", event_type: "PAYMENT.AUTHORIZATION.VOIDED", resource: { id: held.paypalAuthorizationId! } };
    expect(await t.gate.handleWebhookEvent(event)).toBe(true);
    expect(await t.gate.handleWebhookEvent(event)).toBe(false);
    expect((await t.gate.getHold(held.id)).state).toBe("VOIDED");
  });
});
