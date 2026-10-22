import { redirect } from "next/navigation";
import { getPayPal } from "@/lib/paypal/client";

// Starts Log In with PayPal. The one-time verification token rides in `state`, so the callback
// knows which verification to check.
export async function GET(_request: Request, ctx: RouteContext<"/api/verify/[token]/login">) {
  const { token } = await ctx.params;
  redirect(getPayPal().loginUrl(token));
}
