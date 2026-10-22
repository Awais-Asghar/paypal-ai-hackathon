import { inArray, notInArray } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { auditLog, checkins, decisions, holds, outbox, verifications } from "@/lib/db/schema";
import type { PaymentGate } from "@/lib/gate/payment-gate";

/**
 * Judge Mode "Reset demo": first voids every live authorization through the gate, so no sandbox
 * money is left reserved, then clears demo activity. The circle, members and payees stay.
 */
export async function resetDemo(db: Db, gate: PaymentGate) {
  const open = await db.select().from(holds).where(notInArray(holds.state, ["RELEASED", "VOIDED", "CANCELLED"]));
  const failed: string[] = [];
  for (const h of open) {
    try {
      await gate.voidHold(h.id, "judge", "demo reset");
    } catch {
      failed.push(h.id);
    }
  }
  // A hold PayPal would not void stays, with its history, so nothing reserved is forgotten.
  const removable = (await db.select({ id: holds.id }).from(holds)).map((h) => h.id).filter((id) => !failed.includes(id));
  if (removable.length > 0) {
    await db.transaction(async (t) => {
      await t.delete(outbox).where(inArray(outbox.holdId, removable));
      await t.delete(decisions).where(inArray(decisions.holdId, removable));
      await t.delete(verifications).where(inArray(verifications.holdId, removable));
      await t.delete(checkins).where(inArray(checkins.holdId, removable));
      await t.delete(auditLog).where(inArray(auditLog.holdId, removable));
      await t.delete(holds).where(inArray(holds.id, removable));
    });
  }
  return { voided: open.length - failed.length, kept: failed.length, cleared: removable.length };
}
