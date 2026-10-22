import "server-only";
import { timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { GateError } from "@/lib/gate/payment-gate";
import { PayPalError } from "@/lib/paypal/client";

const GATE_STATUS = { NOT_FOUND: 404, CONFLICT: 409, INVALID: 400, REFUSED: 403 } as const;

/** Maps known errors to JSON responses. PayPal details stay in the server log, not the response. */
export function errorResponse(e: unknown) {
  if (e instanceof GateError) return Response.json({ error: e.message, code: e.code }, { status: GATE_STATUS[e.code] });
  if (e instanceof ZodError) return Response.json({ error: "Invalid request", issues: e.issues }, { status: 400 });
  if (e instanceof PayPalError) {
    console.error(`PayPal error ${e.status} ${e.code}: ${e.message} (debug id ${e.debugId})`);
    return Response.json({ error: "PayPal request failed. The money stays held.", debugId: e.debugId }, { status: 502 });
  }
  console.error(e);
  return Response.json({ error: "Something went wrong. The money stays held." }, { status: 500 });
}

/** Constant-time check of "Authorization: Bearer <secret>". An unset secret always fails. */
export function hasBearer(request: Request, secret: string | undefined) {
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
