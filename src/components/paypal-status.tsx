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
  if (!status) return <span className="text-muted">PayPal unavailable</span>;
  const tone = GOOD.includes(status) ? "text-brand" : MOVED.includes(status) ? "text-sent" : "text-wait";
  return <span className={`font-mono font-semibold ${tone}`}>{status}</span>;
}

/** Reads the authorization straight from the PayPal sandbox, so viewers see where the money really is. */
export async function PayPalStatus({ authorizationId }: { authorizationId: string | null }) {
  if (!authorizationId) return <span className="text-muted">no authorization</span>;
  return <Status status={await read(() => getPayPal().getAuthorizationStatus(authorizationId))} />;
}

/** Reads the payout to the verified payee straight from the PayPal sandbox. */
export async function PayoutStatus({ batchId }: { batchId: string | null }) {
  if (!batchId) return <span className="text-muted">-</span>;
  return <Status status={await read(() => getPayPal().getPayoutStatus(batchId))} />;
}
