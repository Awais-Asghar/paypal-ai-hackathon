import { describe, expect, it } from "vitest";
import { combineRisk, detectRedFlags, type RuleInput } from "@/lib/risk/rules";

const family = (text: string): RuleInput => ({ text, purpose: "family", payee: { known: true, memberId: "ethan" }, namedMemberId: "ethan" });

describe("hard red flags", () => {
  it("catches the grandparent voice-clone script", () => {
    const flags = detectRedFlags(family("Nana it's Ethan, I got arrested and need bail right now. I lost my phone, this is my new number. Please don't tell Mom."));
    expect(flags).toEqual(expect.arrayContaining(["secrecy", "new_number", "urgent_emergency"]));
    expect(combineRisk(flags, { risk: "LOW" }).risk).toBe("HIGH");
  });

  it("catches a fake CRA threat and gift cards", () => {
    const flags = detectRedFlags({ text: "This is the CRA. You owe tax and there is a warrant for your arrest. Pay with Google Play cards.", purpose: "other", payee: { known: false, memberId: null }, namedMemberId: null });
    expect(flags).toEqual(expect.arrayContaining(["authority_threat", "gift_cards_crypto", "new_payee"]));
  });

  it("flags a family story that pays someone other than the family member", () => {
    const flags = detectRedFlags({ text: "Send it to my lawyer", purpose: "family", payee: { known: false, memberId: null }, namedMemberId: "ethan" });
    expect(flags).toContain("different_account");
  });

  it("flags a family payee that is a different family member than the one named", () => {
    expect(detectRedFlags({ text: "", purpose: "family", payee: { known: true, memberId: "sarah" }, namedMemberId: "ethan" })).toContain("different_account");
  });

  it("leaves an ordinary rent payment alone", () => {
    const flags = detectRedFlags({ text: "November rent for the apartment", purpose: "bills", payee: { known: true, memberId: null }, namedMemberId: null });
    expect(flags).toEqual([]);
    expect(combineRisk(flags, { risk: "LOW" }).risk).toBe("LOW");
  });

  it("needs urgency and an emergency together", () => {
    expect(detectRedFlags(family("Happy birthday, see you at the hospital fundraiser"))).toEqual([]);
  });
});

describe("combineRisk", () => {
  it("never lets the model lower a hard-rule floor", () => {
    expect(combineRisk(["secrecy"], { risk: "LOW" }).risk).toBe("HIGH");
  });
  it("lets the model raise risk", () => {
    expect(combineRisk([], { risk: "HIGH", reasonsPlain: ["Romance scam pattern"] })).toMatchObject({ risk: "HIGH", reasons: ["Romance scam pattern"] });
  });
  it("fails safe to at least MEDIUM without a model verdict", () => {
    expect(combineRisk([], null)).toMatchObject({ risk: "MEDIUM", source: "rules-only" });
  });
});
