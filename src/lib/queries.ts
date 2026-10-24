import "server-only";
import { and, asc, count, desc, eq, notInArray, sum } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { checkins, circles, holds, members, outbox, payees } from "@/lib/db/schema";

/** The demo runs one circle (seeded by `npm run seed`). */
export async function demoCircle() {
  const db = await getDb();
  const [circle] = await db.select().from(circles).orderBy(asc(circles.createdAt)).limit(1);
  if (!circle) return null;
  const [circleMembers, circlePayees] = await Promise.all([
    db.select().from(members).where(eq(members.circleId, circle.id)).orderBy(asc(members.createdAt)),
    db.select().from(payees).where(eq(payees.circleId, circle.id)).orderBy(asc(payees.createdAt)),
  ]);
  return { circle, members: circleMembers, payees: circlePayees };
}

export async function recentHolds(circleId: string, limit = 12) {
  const db = await getDb();
  return db
    .select({ hold: holds, payeeLabel: payees.label })
    .from(holds)
    .innerJoin(payees, eq(payees.id, holds.payeeId))
    .where(eq(holds.circleId, circleId))
    .orderBy(desc(holds.createdAt))
    .limit(limit);
}

/** Real payments only: drafts never approved in PayPal and cancelled drafts are left out. */
const realPayment = (circleId: string) => and(eq(holds.circleId, circleId), notInArray(holds.state, ["DRAFT", "CANCELLED"]));

/** Count and total per state, for the family dashboard's headline numbers. */
export async function familyTotals(circleId: string) {
  const db = await getDb();
  const rows = await db
    .select({ state: holds.state, count: count(), cents: sum(holds.amountCents) })
    .from(holds)
    .where(realPayment(circleId))
    .groupBy(holds.state);
  return rows.map((r) => ({ state: r.state, count: r.count, cents: Number(r.cents ?? 0) }));
}

/** Payment history with the AI's two-sentence summary for the family, when the check-in produced one. */
export async function familyHistory(circleId: string, limit = 30) {
  const db = await getDb();
  return db
    .select({ hold: holds, payeeLabel: payees.label, verdict: checkins.verdict })
    .from(holds)
    .innerJoin(payees, eq(payees.id, holds.payeeId))
    .leftJoin(checkins, eq(checkins.holdId, holds.id))
    .where(realPayment(circleId))
    .orderBy(desc(holds.createdAt))
    .limit(limit);
}

export async function messagesFor(memberId: string) {
  const db = await getDb();
  return db.select().from(outbox).where(eq(outbox.memberId, memberId)).orderBy(desc(outbox.createdAt)).limit(20);
}
