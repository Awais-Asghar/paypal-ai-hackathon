import "server-only";
import { timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { GateError } from "@/lib/gate/payment-gate";
import { PayPalError } from "@/lib/paypal/client";

const GATE_STATUS = { NOT_FOUND: 404, CONFLICT: 409, INVALID: 400, REFUSED: 403 } as const;

/**
 * Maps known errors to JSON responses. PayPal details stay in the server log, not the response.
 * `safeMessage` tells the person what state their money is in when something unexpected fails.
 */
export function errorResponse(e: unknown, safeMessage = "Something went wrong. The money stays held.") {
  if (e instanceof GateError) return Response.json({ error: e.message, code: e.code }, { status: GATE_STATUS[e.code] });
  if (e instanceof ZodError) return Response.json({ error: "Invalid request", issues: e.issues }, { status: 400 });
  if (e instanceof PayPalError) {
    console.error(`PayPal error ${e.status} ${e.code}: ${e.message} (debug id ${e.debugId})`);
    return Response.json({ error: safeMessage, debugId: e.debugId }, { status: 502 });
  }
  console.error(e);
  return Response.json({ error: safeMessage }, { status: 500 });
}

/**
 * Form posts come back to a page with a 303, so the browser follows with a GET. The Location is
 * relative on purpose: request.url carries the server's own host (localhost in dev, an internal
 * address behind Render's proxy), not the one the browser used.
 */
export const backTo = (path: string) => new Response(null, { status: 303, headers: { Location: path } });

/** Constant-time check of "Authorization: Bearer <secret>". An unset secret always fails. */
export function hasBearer(request: Request, secret: string | undefined) {
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
