import "server-only";
import { getDb } from "@/lib/db";
import { getPayPal } from "@/lib/paypal/client";
import { PaymentGate } from "./payment-gate";

let gate: Promise<PaymentGate> | undefined;

/** The app's single Payment Gate, wired to the database and the PayPal sandbox. */
export function getGate() {
  gate ??= getDb().then(
    (db) =>
      new PaymentGate(db, getPayPal(), {
        appBaseUrl: process.env.APP_BASE_URL || "http://127.0.0.1:3000",
        currency: process.env.PAYPAL_CURRENCY || "CAD",
        coolingOffHours: Number(process.env.COOLING_OFF_HOURS || 24),
      }),
  );
  return gate;
}

export { GateError } from "./payment-gate";
