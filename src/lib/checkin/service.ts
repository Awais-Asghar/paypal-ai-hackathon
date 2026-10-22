import { and, eq } from "drizzle-orm";
import type { CheckinAgent, Evidence, HoldContext, Turn } from "@/lib/ai/checkin-agent";
import { openingLine } from "@/lib/ai/checkin-agent";
import type { Db } from "@/lib/db";
import { checkins, members, payees, type Checkin } from "@/lib/db/schema";
import { money } from "@/lib/format";
import { GateError, type PaymentGate } from "@/lib/gate/payment-gate";

const MAX_ANSWER = 2000;

type Transcribe = (file: Blob, filename: string) => Promise<string | null>;

/**
 * Runs the AI check-in for one hold and hands the result to the Payment Gate.
 * It never moves money itself: finish() calls gate.assess(), where the hard rules apply.
 */
export class CheckinService {
  constructor(
    private readonly db: Db,
    private readonly gate: PaymentGate,
    private readonly agent: CheckinAgent,
    private readonly transcribe: Transcribe,
  ) {}

  async context(holdId: string): Promise<HoldContext> {
    const hold = await this.gate.getHold(holdId);
    const [payee] = await this.db.select().from(payees).where(eq(payees.id, hold.payeeId));
    const [sender] = await this.db.select().from(members).where(and(eq(members.circleId, hold.circleId), eq(members.role, "protected")));
    const named = hold.namedMemberId ? (await this.db.select().from(members).where(eq(members.id, hold.namedMemberId)))[0] : undefined;
    return {
      senderName: sender?.name ?? "there",
      amount: money(hold.amountCents, hold.currency),
      payeeLabel: payee.label,
      payeeKnown: payee.known,
      payeeIsFamily: !!payee.memberId,
      purpose: hold.purpose,
      namedMemberName: named?.name ?? null,
      story: hold.story,
    };
  }

  private async load(holdId: string): Promise<Checkin> {
    const [row] = await this.db.select().from(checkins).where(eq(checkins.holdId, holdId));
    if (!row) throw new GateError("NOT_FOUND", "Check-in has not started");
    return row;
  }

  private async append(checkinId: string, turn: Turn) {
    await this.db.transaction(async (t) => {
      const [row] = await t.select().from(checkins).where(eq(checkins.id, checkinId)).for("update");
      await t.update(checkins).set({ transcript: [...row.transcript, turn] }).where(eq(checkins.id, checkinId));
    });
  }

  private evidenceOf(row: Checkin): Evidence[] {
    return row.evidence.map((e) => ({ kind: e.kind as Evidence["kind"], text: e.ref }));
  }

  async start(holdId: string) {
    const hold = await this.gate.beginCheckin(holdId);
    let [row] = await this.db.select().from(checkins).where(eq(checkins.holdId, holdId));
    if (!row) {
      const opening: Turn = { role: "assistant", text: openingLine(await this.context(holdId)) };
      [row] = await this.db.insert(checkins).values({ holdId, transcript: [opening] }).onConflictDoNothing().returning();
      row ??= await this.load(holdId);
    }
    return { state: hold.state, transcript: row.transcript };
  }

  async say(holdId: string, text: string) {
    const answer = text.trim().slice(0, MAX_ANSWER);
    if (!answer) throw new GateError("INVALID", "Please type an answer");
    await this.requireAssessing(holdId);
    const row = await this.load(holdId);
    await this.append(row.id, { role: "user", text: answer });

    const turns = [...row.transcript, { role: "user" as const, text: answer }];
    const next = await this.agent.nextTurn(await this.context(holdId), turns, this.evidenceOf(row));
    await this.append(row.id, { role: "assistant", text: next.reply });
    return next;
  }

  async addEvidence(holdId: string, kind: Evidence["kind"], file: File) {
    await this.requireAssessing(holdId);
    const row = await this.load(holdId);
    const text =
      kind === "voicemail"
        ? await this.transcribe(file, file.name || "voicemail")
        : await this.agent.readScreenshot({ mimeType: file.type, base64: Buffer.from(await file.arrayBuffer()).toString("base64") });
    if (!text) return null;
    await this.db.transaction(async (t) => {
      const [locked] = await t.select().from(checkins).where(eq(checkins.id, row.id)).for("update");
      await t.update(checkins).set({ evidence: [...locked.evidence, { kind, ref: text }] }).where(eq(checkins.id, row.id));
    });
    return text;
  }

  /** Gets the AI verdict and lets the gate decide. No verdict (AI down) is passed on as null: the gate fails safe. */
  async finish(holdId: string) {
    await this.requireAssessing(holdId);
    const row = await this.load(holdId);
    const evidence = this.evidenceOf(row);
    const verdict = await this.agent.verdict(await this.context(holdId), row.transcript, evidence);

    // Hard rules see only what the person and the requester said, never the agent's own questions.
    const text = [...row.transcript.filter((t) => t.role === "user").map((t) => t.text), ...evidence.map((e) => e.text)].join("\n");
    await this.db.update(checkins).set({ verdict: verdict ?? { unavailable: true } }).where(eq(checkins.id, row.id));
    return this.gate.assess(holdId, { text, llm: verdict });
  }

  private async requireAssessing(holdId: string) {
    const hold = await this.gate.getHold(holdId);
    if (hold.state !== "ASSESSING") throw new GateError("CONFLICT", `Hold is ${hold.state}; the check-in is closed`);
  }
}
