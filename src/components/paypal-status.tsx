import { getPayPal } from "@/lib/paypal/client";

async function read(fn: () => Promise<string>) {
  try {
    return await fn();
  } catch {
    return null;
  }
}

const GOOD = ["VOIDED", "SUCCESS"];
const MOVED = ["CAPTURED"];

function Status({ status }: { status: string | null }) {
  if (!status) return <span className="text-stone-400">PayPal unavailable</span>;
  const tone = GOOD.includes(status) ? "text-emerald-700" : MOVED.includes(status) ? "text-sky-700" : "text-amber-700";
  return <span className={`font-mono font-semibold ${tone}`}>{status}</span>;
}

/** Reads the authorization straight from the PayPal sandbox, so viewers see where the money really is. */
export async function PayPalStatus({ authorizationId }: { authorizationId: string | null }) {
  if (!authorizationId) return <span className="text-stone-400">no authorization</span>;
  return <Status status={await read(() => getPayPal().getAuthorizationStatus(authorizationId))} />;
}

/** Reads the payout to the verified payee straight from the PayPal sandbox. */
export async function PayoutStatus({ batchId }: { batchId: string | null }) {
  if (!batchId) return <span className="text-stone-400">-</span>;
  return <Status status={await read(() => getPayPal().getPayoutStatus(batchId))} />;
}
