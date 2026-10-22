import { eq } from "drizzle-orm";
import { createDb } from "@/lib/db";
import { auditLog, members, payees } from "@/lib/db/schema";
import { seedDemo } from "@/lib/db/seed";
import { PaymentGate } from "@/lib/gate/payment-gate";
import type { PayoutReceiver, PayPalGateway } from "@/lib/paypal/client";

export const ETHAN_PAYER_ID = "ETHANPAYERID1";

/** In-memory stand-in for PayPal that records every call and honors PayPal-Request-Id. */
export class FakePayPal implements PayPalGateway {
  calls: { op: string; requestId?: string; receiver?: PayoutReceiver }[] = [];
  authStatus = new Map<string, string>();
  failVoid = false;
  private seen = new Map<string, unknown>();
  private n = 0;

  private once<T>(requestId: string, fn: () => T): T {
    if (!this.seen.has(requestId)) this.seen.set(requestId, fn());
    return this.seen.get(requestId) as T;
  }

  async createAuthorizeOrder(input: { holdId: string }) {
    this.calls.push({ op: "createOrder", requestId: `${input.holdId}-order` });
    return { orderId: `ORDER-${++this.n}`, approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=x" };
  }
  async authorizeOrder(orderId: string, requestId: string) {
    this.calls.push({ op: "authorize", requestId });
    return this.once(requestId, () => {
      const id = `AUTH-${orderId}`;
      this.authStatus.set(id, "CREATED");
      return { id, status: "CREATED", expirationTime: "2026-11-20T00:00:00Z" };
    });
  }
  async captureAuthorization(authorizationId: string, requestId: string) {
    this.calls.push({ op: "capture", requestId });
    return this.once(requestId, () => {
      this.authStatus.set(authorizationId, "CAPTURED");
      return { captureId: `CAP-${authorizationId}`, status: "COMPLETED" };
    });
  }
  async voidAuthorization(authorizationId: string, requestId: string) {
    this.calls.push({ op: "void", requestId });
    if (this.failVoid) throw new Error("PayPal unavailable");
    this.authStatus.set(authorizationId, "VOIDED");
  }
  async getAuthorizationStatus(authorizationId: string) {
    return this.authStatus.get(authorizationId) ?? "UNKNOWN";
  }
  async createPayout(input: { senderBatchId: string; requestId: string; receiver: PayoutReceiver }) {
    this.calls.push({ op: "payout", requestId: input.requestId, receiver: input.receiver });
    return this.once(input.requestId, () => ({ batchId: `BATCH-${input.senderBatchId}`, status: "PENDING" }));
  }
  ops() {
    return this.calls.map((c) => c.op);
  }
}

export async function setup() {
  const handle = createDb("memory://");
  await handle.migrate();
  const { circleId } = await seedDemo(handle.db, { ethanEmail: "ethan@sandbox.test", ethanPayerId: ETHAN_PAYER_ID, robertEmail: "robert@sandbox.test" });
  const clock = { now: new Date("2026-10-22T12:00:00Z") };
  const paypal = new FakePayPal();
  const gate = new PaymentGate(handle.db, paypal, {}, () => clock.now);

  const allMembers = await handle.db.select().from(members).where(eq(members.circleId, circleId));
  const allPayees = await handle.db.select().from(payees).where(eq(payees.circleId, circleId));
  const member = (name: string) => allMembers.find((m) => m.name.startsWith(name))!;
  const payee = (label: string) => allPayees.find((p) => p.label.startsWith(label))!;

  const states = async (holdId: string) =>
    (await handle.db.select().from(auditLog).where(eq(auditLog.holdId, holdId)).orderBy(auditLog.id))
      .filter((a) => a.toState)
      .map((a) => a.toState);

  /** Creates a hold and simulates the buyer approving it in PayPal. */
  const heldPayment = async (input: { payee: string; amountCents: number; purpose: "family" | "bills" | "shopping" | "other"; named?: string; story?: string }) => {
    const { hold } = await gate.createHold({
      circleId,
      payeeId: payee(input.payee).id,
      amountCents: input.amountCents,
      purpose: input.purpose,
      namedMemberId: input.named ? member(input.named).id : null,
      story: input.story,
    });
    return gate.onBuyerApproved(hold.id);
  };

  return { db: handle.db, close: handle.close, circleId, clock, paypal, gate, member, payee, states, heldPayment };
}
