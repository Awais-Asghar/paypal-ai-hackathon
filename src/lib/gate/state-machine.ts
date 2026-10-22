import type { HoldState } from "@/lib/db/schema";

// DRAFT -> HELD -> ASSESSING -> (VERIFYING | COOLING_OFF) -> APPROVED -> RELEASED, or -> DENIED -> VOIDED.
// Every exit to DENIED leads to a void: when in doubt, the money stays with its owner.
export const TRANSITIONS: Record<HoldState, readonly HoldState[]> = {
  DRAFT: ["HELD", "CANCELLED"],
  HELD: ["ASSESSING", "DENIED"],
  ASSESSING: ["APPROVED", "COOLING_OFF", "VERIFYING", "DENIED"],
  COOLING_OFF: ["APPROVED", "DENIED"],
  VERIFYING: ["APPROVED", "DENIED"],
  APPROVED: ["RELEASED", "DENIED"],
  DENIED: ["VOIDED"],
  RELEASED: [],
  VOIDED: [],
  CANCELLED: [],
};

export const canTransition = (from: HoldState, to: HoldState) => TRANSITIONS[from].includes(to);

export const isTerminal = (s: HoldState) => TRANSITIONS[s].length === 0;

/** States where the authorization is live and must be voided if its deadline arrives. */
export const PENDING_STATES = ["HELD", "ASSESSING", "COOLING_OFF", "VERIFYING"] as const satisfies readonly HoldState[];
