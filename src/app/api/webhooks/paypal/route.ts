import { getGate } from "@/lib/gate";
import { errorResponse } from "@/lib/http";
import { getPayPal } from "@/lib/paypal/client";

// Webhooks are the source of truth for payment state. Unverified deliveries are rejected;
// verified ones are de-duplicated by event ID inside the gate.
export async function POST(request: Request) {
  let event: { id?: string; event_type?: string; resource?: Record<string, unknown> };
  try {
    event = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!event.id || !event.event_type) return Response.json({ error: "Not a PayPal event" }, { status: 400 });

  try {
    if (!(await getPayPal().verifyWebhookSignature(request.headers, event))) {
      return Response.json({ error: "Signature verification failed" }, { status: 401 });
    }
    const fresh = await (await getGate()).handleWebhookEvent({ id: event.id, event_type: event.event_type, resource: event.resource });
    return Response.json({ received: true, duplicate: !fresh });
  } catch (e) {
    // A non-2xx makes PayPal retry later, which is what we want for a transient failure.
    return errorResponse(e);
  }
}
