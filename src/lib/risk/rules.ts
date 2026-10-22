import type { RiskLevel } from "@/lib/db/schema";

// Hard red flags (docs/ARCHITECTURE.md, safety rule 4). They are plain code, so no model
// verdict or prompt can lower them. Each one forces at least the risk shown.

export type RedFlag =
  | "secrecy"
  | "new_number"
  | "different_account"
  | "gift_cards_crypto"
  | "urgent_emergency"
  | "authority_threat"
  | "suspicious_instructions"
  | "new_payee";

export const RED_FLAG_LABELS: Record<RedFlag, string> = {
  secrecy: "Asked to keep it secret",
  new_number: "New number or no phone",
  different_account: "Money going to a different account",
  gift_cards_crypto: "Gift cards or crypto",
  urgent_emergency: "Urgent emergency (bail, hospital, arrest)",
  authority_threat: "Threat from a 'government' caller",
  suspicious_instructions: "The message tries to give orders to the safety check",
  new_payee: "New payee",
};

const FLAG_FLOOR: Record<RedFlag, RiskLevel> = {
  secrecy: "HIGH",
  new_number: "HIGH",
  different_account: "HIGH",
  gift_cards_crypto: "HIGH",
  urgent_emergency: "HIGH",
  authority_threat: "HIGH",
  suspicious_instructions: "HIGH",
  new_payee: "MEDIUM",
};

const SECRECY = /\b(don'?t|do not|never) (tell|say|mention)|keep (this|it) (a )?(secret|quiet|between)|between (us|you and me)|no ?one (can|must|should|needs to) know|don'?t (call|talk to|contact) (mom|dad|my (mom|dad|parents)|anyone|the police)/i;
const NEW_NUMBER = /new (phone|cell|number)|(lost|broke|dropped) my phone|(don'?t|do not) have my phone|no phone|my phone (is |was )?(broken|dead|lost|taken)|can'?t (call|talk)|(text|message) me (at|on) this/i;
const OTHER_ACCOUNT = /(different|another|other|new) (paypal |bank )?account|this account instead|(send|pay|transfer|wire) (it|the money)? ?(directly )?to (my |the )?(lawyer|attorney|friend|bondsman|bail bondsman|officer|agent|courier)/i;
const GIFT_CRYPTO = /gift ?cards?|itunes|google ?play card|steam card|apple card|bitcoin|crypto|\bbtc\b|\busdt\b|\beth(ereum)? wallet/i;
const URGENT = /urgent|right (now|away)|immediately|\basap\b|hurry|quick(ly)?|tonight|before (it'?s too late|tomorrow)|no time/i;
const EMERGENCY = /\bbail\b|jail|arrest(ed)?|police|hospital|accident|\bcourt\b|lawyer|surgery|kidnap/i;
const AUTHORITY = /\bcra\b|canada revenue|revenue agency|\birs\b|immigration|\brcmp\b|service canada|tax (office|department)/i;
// Text aimed at the AI check rather than at a person is itself a scam signal.
const INJECTION = /ignore (all |any |the )?(previous |prior |above )?(instructions|rules)|system prompt|you are (now )?(an? )?(ai|assistant|language model)|(mark|rate|classify) (this|it|the payment) (as )?(low|safe)|risk\s*[:=]\s*"?low/i;
const THREAT = /arrest|warrant|deport|fine|penalt(y|ies)|suspend|jail|police|lawsuit|seized?/i;

export type RuleInput = {
  /** Everything the person said or shared: story, chat answers, voicemail transcript, screenshot text. */
  text: string;
  purpose: "family" | "bills" | "shopping" | "other";
  payee: { known: boolean; memberId: string | null };
  namedMemberId: string | null;
};

export function detectRedFlags(input: RuleInput): RedFlag[] {
  const t = input.text;
  const flags = new Set<RedFlag>();
  if (SECRECY.test(t)) flags.add("secrecy");
  if (NEW_NUMBER.test(t)) flags.add("new_number");
  if (OTHER_ACCOUNT.test(t)) flags.add("different_account");
  if (GIFT_CRYPTO.test(t)) flags.add("gift_cards_crypto");
  if (URGENT.test(t) && EMERGENCY.test(t)) flags.add("urgent_emergency");
  if (AUTHORITY.test(t) && THREAT.test(t)) flags.add("authority_threat");
  if (INJECTION.test(t)) flags.add("suspicious_instructions");

  // Structural checks: a family story must pay that family member's own saved account.
  if (input.purpose === "family" && (!input.payee.memberId || (input.namedMemberId && input.payee.memberId !== input.namedMemberId))) {
    flags.add("different_account");
  }
  if (!input.payee.known && !input.payee.memberId) flags.add("new_payee");
  return [...flags];
}

const ORDER: RiskLevel[] = ["LOW", "MEDIUM", "HIGH"];
export const maxRisk = (...levels: RiskLevel[]) => levels.reduce((a, b) => (ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a), "LOW");

export function ruleFloor(flags: RedFlag[]): RiskLevel {
  return maxRisk("LOW", ...flags.map((f) => FLAG_FLOOR[f]));
}

export type LlmVerdict = {
  risk: RiskLevel;
  scamType?: string;
  redFlags?: string[];
  reasonsPlain?: string[];
};

export type FinalRisk = { risk: RiskLevel; flags: RedFlag[]; reasons: string[]; source: "rules+llm" | "rules-only" };

/**
 * Final risk = the higher of the hard-rule floor and the model's verdict. With no model verdict
 * (rate limit, error) we fail safe: at least MEDIUM, so the money waits instead of going out.
 */
export function combineRisk(flags: RedFlag[], llm: LlmVerdict | null): FinalRisk {
  const floor = ruleFloor(flags);
  const reasons = flags.map((f) => RED_FLAG_LABELS[f]);
  if (!llm) {
    return { risk: maxRisk(floor, "MEDIUM"), flags, reasons: [...reasons, "The AI check could not run, so SureSend is waiting to be safe"], source: "rules-only" };
  }
  return { risk: maxRisk(floor, llm.risk), flags, reasons: [...reasons, ...(llm.reasonsPlain ?? [])], source: "rules+llm" };
}
