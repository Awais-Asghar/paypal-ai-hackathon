import { and, eq, inArray, lte } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import type { Db } from "@/lib/db";
import {
  auditLog,
  decisions,
  holds,
  members,
  outbox,
  payees,
  verifications,
  webhookEvents,
  type Hold,
  type HoldState,
  type Member,
  type Payee,
} from "@/lib/db/schema";
import { money } from "@/lib/format";
import { PayPalError, type PayoutReceiver, type PayPalGateway } from "@/lib/paypal/client";
import { combineRisk, detectRedFlags, type LlmVerdict } from "@/lib/risk/rules";
import { canTransition, PENDING_STATES } from "./state-machine";

// The Payment Gate is the only code that changes a hold's state or moves money
// (docs/ARCHITECTURE.md, safety rules). Every transition is checked against the state
// machine, made under a row lock, and written to the audit log in the same transaction.
// PayPal calls happen outside transactions and carry fixed PayPal-Request-Ids per hold,
// so any step can be retried without moving money twice.

export class GateError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID" | "REFUSED",
    message: string,
  ) {
    super(message);
    this.name = "GateError";
  }
}

export type GateConfig = {
  appBaseUrl: string;
  currency: string;
  coolingOffHours: number;
  /** Void deadline after authorizing; must stay inside PayPal's 3-day honor period. */
  voidAfterHours: number;
  verificationTtlHours: number;
};

export const DEFAULT_GATE_CONFIG: GateConfig = {
  appBaseUrl: "http://127.0.0.1:3000",
  currency: "CAD",
  coolingOffHours: 24,
  voidAfterHours: 60,
  verificationTtlHours: 24,
};

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Actor = "system" | "paypal-webhook" | "judge" | `member:${string}`;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const hours = (n: number) => n * 3600_000;

export class PaymentGate {
  readonly config: GateConfig;

  constructor(
    private readonly db: Db,
    private readonly paypal: PayPalGateway,
    config: Partial<GateConfig> = {},
    private readonly now: () => Date = () => new Date(),
  ) {
    this.config = { ...DEFAULT_GATE_CONFIG, ...config };
    if (this.config.voidAfterHours >= 72) throw new Error("voidAfterHours must be inside the 3-day honor period");
  }

  // ---------- reads ----------

  async getHold(holdId: string) {
    const [hold] = await this.db.select().from(holds).where(eq(holds.id, holdId));
    if (!hold) throw new GateError("NOT_FOUND", `Hold ${holdId} not found`);
    return hold;
  }

  private async getPayee(payeeId: string) {
    const [payee] = await this.db.select().from(payees).where(eq(payees.id, payeeId));
    if (!payee) throw new GateError("NOT_FOUND", `Payee ${payeeId} not found`);
    return payee;
  }

  private async getMember(memberId: string) {
    const [member] = await this.db.select().from(members).where(eq(members.id, memberId));
    if (!member) throw new GateError("NOT_FOUND", `Member ${memberId} not found`);
    return member;
  }

  // ---------- state changes ----------

  private async transition(
    holdId: string,
    to: HoldState,
    actor: Actor,
    detail: Record<string, unknown> = {},
    patch: Partial<Hold> = {},
    tx?: Tx,
  ): Promise<Hold> {
    const run = async (t: Tx) => {
      const [current] = await t.select().from(holds).where(eq(holds.id, holdId)).for("update");
      if (!current) throw new GateError("NOT_FOUND", `Hold ${holdId} not found`);
      if (!canTransition(current.state, to)) {
        throw new GateError("CONFLICT", `Hold ${holdId} cannot go from ${current.state} to ${to}`);
      }
      const [updated] = await t
        .update(holds)
        .set({ ...patch, state: to, updatedAt: this.now() })
        .where(eq(holds.id, holdId))
        .returning();
      await t.insert(auditLog).values({ holdId, fromState: current.state, toState: to, actor, detail, at: this.now() });
      return updated;
    };
    return tx ? run(tx) : this.db.transaction(run);
  }

  private async audit(holdId: string, actor: Actor, detail: Record<string, unknown>) {
    await this.db.insert(auditLog).values({ holdId, actor, detail, at: this.now() });
  }

  private async patch(holdId: string, patch: Partial<Hold>) {
    const [updated] = await this.db.update(holds).set({ ...patch, updatedAt: this.now() }).where(eq(holds.id, holdId)).returning();
    return updated;
  }

  // ---------- 1. hold, don't send ----------

  async createHold(input: {
    circleId: string;
    payeeId: string;
    amountCents: number;
    purpose: Hold["purpose"];
    namedMemberId?: string | null;
    story?: string | null;
    demoScenario?: string | null;
  }) {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new GateError("INVALID", "Amount must be a positive number of cents");
    const payee = await this.getPayee(input.payeeId);
    if (payee.circleId !== input.circleId) throw new GateError("INVALID", "Payee is not in this circle");
    if (input.namedMemberId) {
      const named = await this.getMember(input.namedMemberId);
      if (named.circleId !== input.circleId) throw new GateError("INVALID", "Named member is not in this circle");
    }

    const hold = await this.db.transaction(async (t) => {
      const [created] = await t
        .insert(holds)
        .values({
          circleId: input.circleId,
          payeeId: payee.id,
          amountCents: input.amountCents,
          currency: this.config.currency,
          purpose: input.purpose,
          namedMemberId: input.namedMemberId ?? null,
          story: input.story ?? null,
          demoScenario: input.demoScenario ?? null,
          state: "DRAFT",
          createdAt: this.now(),
          updatedAt: this.now(),
        })
        .returning();
      await t.insert(auditLog).values({ holdId: created.id, toState: "DRAFT", actor: "system", detail: { payee: payee.label }, at: this.now() });
      return created;
    });

    try {
      const base = `${this.config.appBaseUrl}/api/holds/${hold.id}`;
      const order = await this.paypal.createAuthorizeOrder({
        holdId: hold.id,
        amountCents: hold.amountCents,
        currency: hold.currency,
        description: `SureSend hold for ${payee.label} (held, not sent)`,
        returnUrl: `${base}/approved`,
        cancelUrl: `${base}/cancelled`,
      });
      const updated = await this.patch(hold.id, { paypalOrderId: order.orderId });
      return { hold: updated, approveUrl: order.approveUrl };
    } catch (e) {
      await this.transition(hold.id, "CANCELLED", "system", { reason: "order_create_failed", error: describe(e) });
      throw e;
    }
  }

  /** The protected person approved in PayPal: authorize the order. Funds are reserved, not moved. */
  async onBuyerApproved(holdId: string) {
    const hold = await this.getHold(holdId);
    if (hold.state !== "DRAFT") return hold; // Return URL reloaded; already handled.
    if (!hold.paypalOrderId) throw new GateError("INVALID", "Hold has no PayPal order");
    const auth = await this.paypal.authorizeOrder(hold.paypalOrderId, `${hold.id}-authorize`);
    const now = this.now();
    return this.transition(
      hold.id,
      "HELD",
      "system",
      { authorizationId: auth.id, paypalStatus: auth.status },
      { paypalAuthorizationId: auth.id, authorizedAt: now, expiresAt: new Date(now.getTime() + hours(this.config.voidAfterHours)) },
    );
  }

  async cancelDraft(holdId: string, actor: Actor = "system") {
    const hold = await this.getHold(holdId);
    if (hold.state !== "DRAFT") return hold;
    return this.transition(holdId, "CANCELLED", actor, { reason: "buyer_cancelled" });
  }

  // ---------- 2. assess ----------

  /** The AI check-in has started: the hold is being assessed. Safe to call again. */
  async beginCheckin(holdId: string) {
    let hold = await this.getHold(holdId);
    if (hold.state === "HELD") {
      try {
        return await this.transition(holdId, "ASSESSING", "system", { event: "checkin_started" });
      } catch (e) {
        // Lost a race with another start; fine if that one moved the hold to ASSESSING.
        if (!(e instanceof GateError && e.code === "CONFLICT")) throw e;
        hold = await this.getHold(holdId);
      }
    }
    if (hold.state !== "ASSESSING") throw new GateError("CONFLICT", `Hold is ${hold.state}, not ready for a check-in`);
    return hold;
  }

  /**
   * Combines the hard rules with the check-in agent's verdict and routes the hold:
   * LOW goes out now, MEDIUM waits out the cooling-off timer, HIGH needs verification.
   */
  async assess(holdId: string, input: { text: string; llm: LlmVerdict | null }) {
    let hold = await this.getHold(holdId);
    if (hold.state === "HELD") hold = await this.transition(holdId, "ASSESSING", "system");
    if (hold.state !== "ASSESSING") throw new GateError("CONFLICT", `Hold is ${hold.state}, not ready for assessment`);

    const payee = await this.getPayee(hold.payeeId);
    const flags = detectRedFlags({
      text: [hold.story ?? "", input.text].join("\n"),
      purpose: hold.purpose,
      payee: { known: payee.known, memberId: payee.memberId },
      namedMemberId: hold.namedMemberId,
    });
    const final = combineRisk(flags, input.llm);
    const riskPatch = { risk: final.risk, redFlags: final.flags, riskReasons: final.reasons };
    const detail = { risk: final.risk, flags: final.flags, source: final.source, llmRisk: input.llm?.risk ?? null };

    if (final.risk === "LOW") {
      await this.transition(holdId, "APPROVED", "system", detail, riskPatch);
      return { hold: await this.release(holdId), verification: null };
    }
    if (final.risk === "MEDIUM") {
      const until = new Date(this.now().getTime() + hours(this.config.coolingOffHours));
      return { hold: await this.transition(holdId, "COOLING_OFF", "system", detail, { ...riskPatch, coolingOffUntil: until }), verification: null };
    }
    const verifying = await this.transition(holdId, "VERIFYING", "system", detail, riskPatch);
    const target = hold.namedMemberId ?? payee.memberId;
    let verification = null;
    try {
      verification = target ? await this.startVerification(holdId, target) : null;
    } catch (e) {
      // No one can verify (say, no PayPal identity saved): the hold stays in VERIFYING for the trusted circle to decide.
      if (!(e instanceof GateError && e.code === "REFUSED")) throw e;
      await this.audit(holdId, "system", { event: "verification_unavailable", error: e.message });
    }
    return { hold: verifying, verification };
  }

  // ---------- 3. "Is this really you?" ----------

  /** Creates a one-time link for a saved family member. It is only ever sent to contacts saved at setup. */
  async startVerification(holdId: string, memberId: string) {
    const hold = await this.getHold(holdId);
    if (hold.state !== "VERIFYING") throw new GateError("CONFLICT", `Hold is ${hold.state}, not verifying`);
    const member = await this.getMember(memberId);
    if (member.circleId !== hold.circleId) throw new GateError("INVALID", "Member is not in this circle");
    if (!member.paypalPayerId) throw new GateError("REFUSED", `${member.name} has no PayPal identity saved, so they can't verify`);

    const token = randomBytes(32).toString("base64url");
    const ttlEnd = this.now().getTime() + hours(this.config.verificationTtlHours);
    const expiresAt = new Date(Math.min(ttlEnd, hold.expiresAt?.getTime() ?? ttlEnd));
    const url = `${this.config.appBaseUrl}/verify/${token}`;
    const [sender] = await this.db.select().from(members).where(and(eq(members.circleId, hold.circleId), eq(members.role, "protected")));
    const senderName = sender?.name.split(" ")[0] ?? "A family member";
    const amount = money(hold.amountCents, hold.currency);
    const to = member.contactEmail ?? member.contactPhone;

    await this.db.transaction(async (t) => {
      await t.insert(verifications).values({ holdId, memberId, tokenHash: hashToken(token), expiresAt, createdAt: this.now() });
      await t.insert(outbox).values({
        holdId,
        memberId,
        channel: member.contactEmail ? "email" : "sms",
        to,
        subject: `Is this really you? ${senderName} is about to send ${amount}`,
        body: `${senderName} is about to send ${amount}. Someone told them it was for you. The money is on hold until you answer. Log in with your own PayPal to confirm.`,
        link: url,
        createdAt: this.now(),
      });
      await t.insert(auditLog).values({ holdId, actor: "system", detail: { event: "verification_sent", memberId, to }, at: this.now() });
    });
    return { token, url, member: { id: member.id, name: member.name, contactEmail: member.contactEmail } };
  }

  async getVerification(token: string) {
    const [row] = await this.db
      .select({ verification: verifications, member: members, hold: holds })
      .from(verifications)
      .innerJoin(members, eq(members.id, verifications.memberId))
      .innerJoin(holds, eq(holds.id, verifications.holdId))
      .where(eq(verifications.tokenHash, hashToken(token)));
    if (!row) throw new GateError("NOT_FOUND", "This link is not valid");
    return row;
  }

  /** Log In with PayPal came back: does the PayPal account that logged in match the saved family record? */
  async recordIdentity(token: string, paypalPayerId: string | null) {
    const { verification, member, hold } = await this.getVerification(token);
    if (verification.status !== "pending" && verification.status !== "identity_mismatch") return verification.status;
    if (verification.expiresAt <= this.now()) {
      await this.db.update(verifications).set({ status: "expired" }).where(eq(verifications.id, verification.id));
      return "expired" as const;
    }
    const matched = !!paypalPayerId && paypalPayerId === member.paypalPayerId;
    const status = matched ? "identity_matched" : "identity_mismatch";
    await this.db.update(verifications).set({ status, paypalPayerIdSeen: paypalPayerId }).where(eq(verifications.id, verification.id));
    await this.audit(hold.id, `member:${member.id}`, { event: status });
    return status;
  }

  /** The verified family member answers. "Not me" voids the hold; "it was me" releases to them only. */
  async answerVerification(token: string, answer: "it_was_me" | "not_me") {
    const { verification, member, hold } = await this.getVerification(token);
    if (verification.status !== "identity_matched") throw new GateError("REFUSED", "Log in with PayPal first");
    if (hold.state !== "VERIFYING") throw new GateError("CONFLICT", `Hold is already ${hold.state}`);
    const actor = `member:${member.id}` as const;
    const deny = answer === "not_me";

    await this.db.transaction(async (t) => {
      await t.update(verifications).set({ status: deny ? "denied" : "confirmed", completedAt: this.now() }).where(eq(verifications.id, verification.id));
      await t.insert(decisions).values({ holdId: hold.id, memberId: member.id, actor, decision: deny ? "deny" : "approve", reason: deny ? "Not me" : "It was me", createdAt: this.now() });
      await this.transition(hold.id, deny ? "DENIED" : "APPROVED", actor, { via: "verification" }, {}, t);
    });
    return deny ? this.voidHold(hold.id, actor, "family member said it was not them") : this.release(hold.id);
  }

  // ---------- 4. trusted circle decides ----------

  async decide(holdId: string, memberId: string, decision: "approve" | "deny", reason?: string) {
    const hold = await this.getHold(holdId);
    const member = await this.getMember(memberId);
    if (member.circleId !== hold.circleId) throw new GateError("REFUSED", "Not a member of this circle");
    if (hold.state !== "VERIFYING" && hold.state !== "COOLING_OFF") throw new GateError("CONFLICT", `Hold is ${hold.state}`);
    // The protected person can always stop a payment, but approving a held payment needs someone else.
    if (decision === "approve" && member.role !== "trusted") throw new GateError("REFUSED", "Only a trusted family member can approve");

    const actor = `member:${member.id}` as const;
    await this.db.transaction(async (t) => {
      await t.insert(decisions).values({ holdId, memberId, actor, decision, reason: reason ?? null, createdAt: this.now() });
      await this.transition(holdId, decision === "approve" ? "APPROVED" : "DENIED", actor, { via: "decision", reason }, {}, t);
    });
    return decision === "approve" ? this.release(holdId) : this.voidHold(holdId, actor, reason ?? "denied by family");
  }

  // ---------- 5. outcome ----------

  /**
   * Safety rule 1: pay only the verified payee. A family payment goes to the PayPal ID that
   * family member verified at setup; anyone else must be a known payee. Otherwise refuse.
   */
  private async payoutReceiver(hold: Hold, payee: Payee): Promise<PayoutReceiver> {
    if (hold.purpose === "family" || payee.memberId) {
      if (!payee.memberId) throw new GateError("REFUSED", "Family payment to an account not linked to a family member");
      if (hold.namedMemberId && hold.namedMemberId !== payee.memberId) throw new GateError("REFUSED", "Payee is not the family member named in the story");
      const member: Member = await this.getMember(payee.memberId);
      if (!member.paypalPayerId || !member.verifiedAt) throw new GateError("REFUSED", `${member.name}'s PayPal account is not verified`);
      return { type: "PAYPAL_ID", value: member.paypalPayerId };
    }
    if (!payee.known) throw new GateError("REFUSED", "Payee is not known to the family");
    return { type: "EMAIL", value: payee.paypalEmail };
  }

  /** HIGH risk needs a confirmed verification or a trusted member's approval on record. */
  private async hasFamilyApproval(holdId: string) {
    const confirmed = await this.db
      .select({ id: verifications.id })
      .from(verifications)
      .where(and(eq(verifications.holdId, holdId), eq(verifications.status, "confirmed")));
    if (confirmed.length > 0) return true;
    const approvals = await this.db
      .select({ id: decisions.id })
      .from(decisions)
      .innerJoin(members, eq(members.id, decisions.memberId))
      .where(and(eq(decisions.holdId, holdId), eq(decisions.decision, "approve"), eq(members.role, "trusted")));
    return approvals.length > 0;
  }

  async release(holdId: string): Promise<Hold> {
    let hold = await this.getHold(holdId);
    if (hold.state === "RELEASED") return hold;
    if (hold.state !== "APPROVED") throw new GateError("CONFLICT", `Hold is ${hold.state}, not approved`);
    if (!hold.paypalAuthorizationId) throw new GateError("INVALID", "Hold has no authorization");

    let receiver: PayoutReceiver;
    try {
      if (hold.risk === "HIGH" && !(await this.hasFamilyApproval(holdId))) throw new GateError("REFUSED", "High-risk payment without family approval");
      receiver = await this.payoutReceiver(hold, await this.getPayee(hold.payeeId));
    } catch (e) {
      if (!(e instanceof GateError && e.code === "REFUSED")) throw e;
      // Fail safe: a refused release is a denial, and the money goes back to its owner.
      await this.transition(holdId, "DENIED", "system", { reason: "release_refused", error: e.message });
      return this.voidHold(holdId, "system", e.message);
    }

    if (!hold.paypalCaptureId) {
      const capture = await this.paypal.captureAuthorization(hold.paypalAuthorizationId, `${hold.id}-capture`);
      hold = await this.patch(holdId, { paypalCaptureId: capture.captureId });
      await this.audit(holdId, "system", { event: "captured", captureId: capture.captureId, paypalStatus: capture.status });
    }
    if (!hold.payoutBatchId) {
      const payout = await this.paypal.createPayout({
        senderBatchId: `suresend-${hold.id}`,
        requestId: `${hold.id}-payout`,
        receiver,
        amountCents: hold.amountCents,
        currency: hold.currency,
        note: "Sent with SureSend after a safety check",
      });
      hold = await this.patch(holdId, { payoutBatchId: payout.batchId, payoutStatus: payout.status });
    }
    return this.transition(holdId, "RELEASED", "system", { payoutBatchId: hold.payoutBatchId, receiverType: receiver.type });
  }

  /** Denies (if still pending) and voids the authorization. The money never leaves. */
  async voidHold(holdId: string, actor: Actor, reason: string): Promise<Hold> {
    let hold = await this.getHold(holdId);
    if (hold.state === "VOIDED") return hold;
    if (hold.state === "DRAFT") return this.cancelDraft(holdId, actor);
    if (hold.state !== "DENIED") hold = await this.transition(holdId, "DENIED", actor, { reason });
    if (!hold.paypalAuthorizationId) throw new GateError("INVALID", "Hold has no authorization");

    try {
      await this.paypal.voidAuthorization(hold.paypalAuthorizationId, `${hold.id}-void`);
    } catch (e) {
      // Already voided or expired at PayPal is the outcome we wanted; anything else stays DENIED for the sweeper to retry.
      const status = await this.paypal.getAuthorizationStatus(hold.paypalAuthorizationId).catch(() => null);
      if (status !== "VOIDED" && status !== "EXPIRED") throw e;
    }
    return this.transition(holdId, "VOIDED", actor, { reason });
  }

  // ---------- scheduler ----------

  /** Finishes cooling-off timers, voids holds near their deadline and retries stuck steps. Safe to run any time. */
  async sweep() {
    const now = this.now();
    const results: { holdId: string; action: string; error?: string }[] = [];
    const attempt = async (holdId: string, action: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
        results.push({ holdId, action });
      } catch (e) {
        results.push({ holdId, action, error: describe(e) });
      }
    };

    const expiring = await this.db.select().from(holds).where(and(inArray(holds.state, [...PENDING_STATES]), lte(holds.expiresAt, now)));
    for (const h of expiring) await attempt(h.id, "void_expiring", () => this.voidHold(h.id, "system", "authorization deadline reached"));

    const cooled = await this.db.select().from(holds).where(and(eq(holds.state, "COOLING_OFF"), lte(holds.coolingOffUntil, now)));
    for (const h of cooled) {
      await attempt(h.id, "release_after_cooling_off", async () => {
        await this.transition(h.id, "APPROVED", "system", { via: "cooling_off_elapsed" });
        await this.release(h.id);
      });
    }

    const stuck = await this.db.select().from(holds).where(inArray(holds.state, ["DENIED", "APPROVED"]));
    for (const h of stuck) {
      await attempt(h.id, h.state === "DENIED" ? "retry_void" : "retry_release", () =>
        h.state === "DENIED" ? this.voidHold(h.id, "system", "retry") : this.release(h.id),
      );
    }
    return results;
  }

  /** Judge Mode: end the cooling-off timer now instead of waiting 24 hours. */
  async skipCoolingOff(holdId: string) {
    const hold = await this.getHold(holdId);
    if (hold.state !== "COOLING_OFF") throw new GateError("CONFLICT", `Hold is ${hold.state}`);
    await this.patch(holdId, { coolingOffUntil: this.now() });
    await this.audit(holdId, "judge", { event: "cooling_off_skipped" });
    await this.transition(holdId, "APPROVED", "judge", { via: "cooling_off_skipped" });
    return this.release(holdId);
  }

  // ---------- webhooks (source of truth) ----------

  /** Call only after the signature is verified. Returns false for a duplicate delivery. */
  async handleWebhookEvent(event: { id: string; event_type: string; resource?: Record<string, unknown> }) {
    const resource = event.resource ?? {};
    const resourceId = typeof resource.id === "string" ? resource.id : null;
    const inserted = await this.db
      .insert(webhookEvents)
      .values({ eventId: event.id, eventType: event.event_type, resourceId, payload: event })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.eventId });
    if (inserted.length === 0) {
      // A retry of an event we failed to finish is processed again; a finished one is a duplicate.
      const [seen] = await this.db.select({ processedAt: webhookEvents.processedAt }).from(webhookEvents).where(eq(webhookEvents.eventId, event.id));
      if (seen?.processedAt) return false;
    }

    if (event.event_type === "PAYMENT.AUTHORIZATION.VOIDED" && resourceId) {
      const [hold] = await this.db.select().from(holds).where(eq(holds.paypalAuthorizationId, resourceId));
      if (hold && hold.state !== "VOIDED" && hold.state !== "RELEASED" && hold.state !== "CANCELLED") {
        if (hold.state !== "DENIED") await this.transition(hold.id, "DENIED", "paypal-webhook", { event: event.event_type });
        await this.transition(hold.id, "VOIDED", "paypal-webhook", { event: event.event_type, eventId: event.id });
      }
    } else if (event.event_type.startsWith("PAYMENT.PAYOUTS")) {
      const header = resource.batch_header as { payout_batch_id?: string; batch_status?: string } | undefined;
      const batchId = (resource.payout_batch_id as string | undefined) ?? header?.payout_batch_id;
      const status = (resource.transaction_status as string | undefined) ?? header?.batch_status;
      if (batchId && status) {
        const [hold] = await this.db.update(holds).set({ payoutStatus: status, updatedAt: this.now() }).where(eq(holds.payoutBatchId, batchId)).returning();
        if (hold) await this.audit(hold.id, "paypal-webhook", { event: event.event_type, status });
      }
    } else if (event.event_type === "PAYMENT.CAPTURE.COMPLETED" && resourceId) {
      const [hold] = await this.db.select().from(holds).where(eq(holds.paypalCaptureId, resourceId));
      if (hold) await this.audit(hold.id, "paypal-webhook", { event: event.event_type });
    }

    await this.db.update(webhookEvents).set({ processedAt: this.now() }).where(eq(webhookEvents.eventId, event.id));
    return true;
  }
}

function describe(e: unknown) {
  if (e instanceof PayPalError) return `${e.code}: ${e.message} (debug id ${e.debugId})`;
  return e instanceof Error ? e.message : String(e);
}
