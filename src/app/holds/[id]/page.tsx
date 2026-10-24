import { eq } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckinChat } from "@/components/checkin-chat";
import { StatusCard } from "@/components/status-card";
import { button, card, Loading, Page } from "@/components/ui";
import { canReport } from "@/lib/aftercare";
import { getDb } from "@/lib/db";
import { holds, payees } from "@/lib/db/schema";
import { isScenarioId, judgeMode, SCENARIOS } from "@/lib/demo/scenarios";
import { money } from "@/lib/format";

const SANDBOX_WEB = "https://www.sandbox.paypal.com";

async function HoldStatus({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection(); // Database reads happen per request, never at build time.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return <p className="text-lg">This payment was not found.</p>;
  const db = await getDb();
  const [row] = await db.select({ hold: holds, payee: payees }).from(holds).innerJoin(payees, eq(payees.id, holds.payeeId)).where(eq(holds.id, id));
  if (!row) return <p className="text-lg">This payment was not found.</p>;
  const { hold, payee } = row;
  const judge = judgeMode();
  const sample = judge && isScenarioId(hold.demoScenario) ? SCENARIOS[hold.demoScenario].evidence : null;
  const safe = hold.risk === "LOW";
  const stoppable = hold.state === "HELD" || hold.state === "ASSESSING" || hold.state === "COOLING_OFF" || hold.state === "VERIFYING";

  return (
    <>
      <StatusCard state={hold.state} risk={hold.risk} amount={`${money(hold.amountCents, hold.currency)} to ${payee.label}`} />

      {hold.state === "DRAFT" && hold.paypalOrderId && (
        <a href={`${SANDBOX_WEB}/checkoutnow?token=${hold.paypalOrderId}`} className={button.paypal}>
          Continue to PayPal
        </a>
      )}

      {(hold.state === "HELD" || hold.state === "ASSESSING") && <CheckinChat holdId={hold.id} sample={sample ? { label: sample.label } : undefined} />}

      {hold.state === "COOLING_OFF" && hold.coolingOffUntil && (
        <p className="text-lg text-ink-2">
          It can go out after{" "}
          <strong className="text-ink">{hold.coolingOffUntil.toLocaleString("en-CA", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" })}</strong>. You can still stop it before then.
        </p>
      )}

      {hold.riskReasons && hold.riskReasons.length > 0 && (
        <section className={card}>
          <h3 className="font-serif text-xl font-medium">{safe ? "Why this looked safe" : "Why we paused"}</h3>
          <ul className="mt-3 space-y-2">
            {hold.riskReasons.map((r) => (
              <li key={r} className="flex gap-3 text-ink-2">
                <span aria-hidden className={`mt-0.5 font-bold ${safe ? "text-brand" : "text-alert"}`}>
                  {safe ? "✓" : "!"}
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canReport(hold) && (
        <Link href={`/holds/${hold.id}/report`} className={button.secondary}>
          Report this scam attempt
        </Link>
      )}

      {stoppable && (
        <form action={`/api/holds/${hold.id}/stop`} method="post">
          <button className={`${button.dangerOutline} w-full`}>Stop this payment</button>
          <p className="mt-2 text-center text-sm text-muted">Stopping cancels it in PayPal. The money stays with you.</p>
        </form>
      )}

      {judge && (
        <Link href="/judge" className="text-center font-semibold text-brand underline underline-offset-4">
          Back to Judge Mode
        </Link>
      )}
    </>
  );
}

export default function HoldPage({ params }: PageProps<"/holds/[id]">) {
  return (
    <Page>
      <Suspense fallback={<Loading label="Loading your payment..." />}>
        <HoldStatus params={params} />
      </Suspense>
    </Page>
  );
}
