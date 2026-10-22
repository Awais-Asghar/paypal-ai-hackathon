import { getPayPal } from "@/lib/paypal/client";

async function readStatus(authorizationId: string) {
  try {
    return await getPayPal().getAuthorizationStatus(authorizationId);
  } catch {
    return null;
  }
}

/** Reads the authorization straight from the PayPal sandbox, so viewers see where the money really is. */
export async function PayPalStatus({ authorizationId }: { authorizationId: string | null }) {
  if (!authorizationId) return <span className="text-stone-400">no authorization</span>;
  const status = await readStatus(authorizationId);
  if (!status) return <span className="text-stone-400">PayPal unavailable</span>;
  const tone = status === "VOIDED" ? "text-emerald-700" : status === "CAPTURED" ? "text-sky-700" : "text-amber-700";
  return <span className={`font-mono font-semibold ${tone}`}>{status}</span>;
}
