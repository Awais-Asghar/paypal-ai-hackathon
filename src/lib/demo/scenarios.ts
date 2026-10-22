// Judge Mode scenarios from docs/DEMO_PLAN.md. Each one prefills the Send form and carries a
// sample piece of evidence, so the demo plays the same way every time.

export type ScenarioId = "grandparent" | "cra" | "rent";

export type Scenario = {
  id: ScenarioId;
  title: string;
  blurb: string;
  payeeLabelPrefix: string;
  amountCents: number;
  purpose: "family" | "bills" | "shopping" | "other";
  namedMemberPrefix: string | null;
  story: string;
  evidence: { kind: "voicemail" | "screenshot"; label: string; text: string } | null;
};

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  grandparent: {
    id: "grandparent",
    title: "Grandparent voice-clone scam",
    blurb: "A cloned voice says Ethan was arrested and needs bail. Expect: held, the real Ethan is asked, voided.",
    payeeLabelPrefix: "Ethan",
    amountCents: 250_000,
    purpose: "family",
    namedMemberPrefix: "Ethan",
    story: "Ethan called me. He was arrested and needs bail money.",
    evidence: {
      kind: "voicemail",
      label: "sample voicemail",
      text: "Nana? It's Ethan. I'm in trouble, I got arrested and I need $2,500 for bail right now. Please don't tell Mom. I lost my phone, so this is my new number.",
    },
  },
  cra: {
    id: "cra",
    title: "Fake CRA threat",
    blurb: "A 'tax agency' text threatens arrest unless she pays a new payee. Expect: held as high risk.",
    payeeLabelPrefix: "CRA",
    amountCents: 180_000,
    purpose: "other",
    namedMemberPrefix: null,
    story: "The Canada Revenue Agency says I owe back taxes.",
    evidence: {
      kind: "screenshot",
      label: "sample text message",
      text: "CANADA REVENUE AGENCY - FINAL NOTICE. You owe $1,800 in unpaid tax. A warrant for your arrest will be issued in 24 hours. Pay today. Google Play cards are accepted.\n(Claims to be from: Canada Revenue Agency)",
    },
  },
  rent: {
    id: "rent",
    title: "Normal rent payment",
    blurb: "Monthly rent to her usual landlord. Expect: one question, then paid out in seconds.",
    payeeLabelPrefix: "Robert",
    amountCents: 90_000,
    purpose: "bills",
    namedMemberPrefix: null,
    story: "November rent",
    evidence: null,
  },
};

export const isScenarioId = (v: unknown): v is ScenarioId => typeof v === "string" && v in SCENARIOS;

export const judgeMode = () => process.env.JUDGE_MODE === "1";
