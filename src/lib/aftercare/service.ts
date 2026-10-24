import { and, eq } from "drizzle-orm";
import { SCAM_TYPE_LABELS } from "@/lib/ai/checkin-agent";
import type { JsonModel } from "@/lib/ai/llm";
import { draftReport, templateReport, type ReportFacts } from "@/lib/ai/report-writer";
import type { Db } from "@/lib/db";
import { checkins, members, payees, reports, type Hold } from "@/lib/db/schema";
import { money } from "@/lib/format";
import { GateError } from "@/lib/gate/payment-gate";
import { RED_FLAG_LABELS, type RedFlag } from "@/lib/risk/rules";

/** A report is offered once the safety check found something, and the payment went past the draft stage. */
export const canReport = (hold: Pick<Hold, "state" | "risk">) =>
  (hold.risk === "HIGH" || hold.risk === "MEDIUM") && hold.state !== "DRAFT" && hold.state !== "CANCELLED";

/** The outcome in plain words, from the hold's state. Never written by the model. */
export function outcomeOf(hold: Pick<Hold, "state" | "amountCents" | "currency">, payeeLabel: string) {
  const amount = money(hold.amountCents, hold.currency);
  if (hold.state === "VOIDED" || hold.state === "DENIED") return `SureSend held the payment in PayPal and cancelled it, so the ${amount} never left the account. Nothing was lost.`;
  if (hold.state === "RELEASED") return `After the safety check, the ${amount} was sent to ${payeeLabel}.`;
  return `The ${amount} is still on hold in PayPal while the family checks it. No money has moved.`;
}

export const moneyLost = (hold: Pick<Hold, "state">) => hold.state === "RELEASED";

const reportDate = (d: Date) => d.toLocaleDateString("en-CA", { dateStyle: "long", timeZone: "America/Toronto" });

/** Aftercare: drafts and stores the scam report for a hold. It reads holds; it never changes them. */
export class ReportService {
  constructor(
    private readonly db: Db,
    private readonly model: JsonModel,
  ) {}

  async get(holdId: string) {
    const [row] = await this.db.select().from(reports).where(eq(reports.holdId, holdId));
    return row ?? null;
  }

  async facts(hold: Hold): Promise<ReportFacts> {
    const [[payee], [sender], [checkin]] = await Promise.all([
      this.db.select().from(payees).where(eq(payees.id, hold.payeeId)),
      this.db.select().from(members).where(and(eq(members.circleId, hold.circleId), eq(members.role, "protected"))),
      this.db.select().from(checkins).where(eq(checkins.holdId, hold.id)),
    ]);
    const verdict = (checkin?.verdict ?? null) as { scamType?: string } | null;
    const scamType = verdict?.scamType && verdict.scamType in SCAM_TYPE_LABELS ? SCAM_TYPE_LABELS[verdict.scamType as keyof typeof SCAM_TYPE_LABELS] : null;
    return {
      senderName: sender?.name ?? "The sender",
      amount: money(hold.amountCents, hold.currency),
      payeeLabel: payee.label,
      date: reportDate(hold.createdAt),
      outcome: outcomeOf(hold, payee.label),
      scamType,
      redFlags: (hold.redFlags ?? []).map((f) => RED_FLAG_LABELS[f as RedFlag] ?? f),
      story: hold.story,
      answers: (checkin?.transcript ?? []).filter((t) => t.role === "user").map((t) => t.text),
      evidence: (checkin?.evidence ?? []).map((e) => ({ kind: e.kind, text: e.ref })),
    };
  }

  /** Drafts the report once. With no model answering, a template built from the facts stands in. */
  async prepare(hold: Hold) {
    const existing = await this.get(hold.id);
    if (existing) return existing;
    if (!canReport(hold)) throw new GateError("CONFLICT", "This payment doesn't need a scam report");
    const facts = await this.facts(hold);
    const ai = await draftReport(this.model, facts);
    await this.db
      .insert(reports)
      .values({ holdId: hold.id, body: ai ?? templateReport(facts), source: ai ? "ai" : "template" })
      .onConflictDoNothing();
    return (await this.get(hold.id))!;
  }
}
