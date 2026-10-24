import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getGate } from "@/lib/gate";
import { getPayPal } from "@/lib/paypal/client";

// Log In with PayPal return URL: <app address>/callback (http://127.0.0.1:3000/callback locally,
// https://<service>.onrender.com/callback on Render). It must also be listed in the PayPal app's settings.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token = params.get("state");
  const code = params.get("code");
  if (!token) return Response.json({ error: "Missing state" }, { status: 400 });
  if (code && !params.get("error")) {
    try {
      const user = await getPayPal().userInfoFromCode(code);
      await (await getGate()).recordIdentity(token, user.payerId);
    } catch (e) {
      console.error("Log In with PayPal failed", e);
    }
  }
  redirect(`/verify/${encodeURIComponent(token)}`);
}
