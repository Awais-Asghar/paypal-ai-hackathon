import { describe, expect, it } from "vitest";
import { HOLD_STATES } from "@/lib/db/schema";
import { canTransition, isTerminal, TRANSITIONS } from "@/lib/gate/state-machine";

describe("hold state machine", () => {
  it("only reaches RELEASED through APPROVED", () => {
    const into = HOLD_STATES.filter((s) => TRANSITIONS[s].includes("RELEASED"));
    expect(into).toEqual(["APPROVED"]);
  });
  it("only reaches VOIDED through DENIED", () => {
    expect(HOLD_STATES.filter((s) => TRANSITIONS[s].includes("VOIDED"))).toEqual(["DENIED"]);
  });
  it("cannot skip the check", () => {
    expect(canTransition("HELD", "APPROVED")).toBe(false);
    expect(canTransition("DRAFT", "RELEASED")).toBe(false);
  });
  it("has terminal end states", () => {
    expect(["RELEASED", "VOIDED", "CANCELLED"].every((s) => isTerminal(s as never))).toBe(true);
  });
});
