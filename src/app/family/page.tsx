import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { card, Eyebrow, Loading, Page } from "@/components/ui";
import { canReport, outcomeOf } from "@/lib/aftercare";
import type { HoldState } from "@/lib/db/schema";
import { judgeMode } from "@/lib/demo/scenarios";
import { money, STATE_COPY } from "@/lib/format";
import { demoCircle, familyHistory, familyTotals } from "@/lib/queries";

const PILL = {
  wait: "bg-wait-soft text-wait",
  safe: "bg-brand-soft text-brand-strong",
  sent: "bg-sent-soft text-sent",
  neutral: "bg-sunk text-ink-2",
};
const RISK_PILL = { LOW: "bg-sunk text-ink-2", MEDIUM: "bg-wait-soft text-wait", HIGH: "bg-alert-soft text-alert" };

const KEPT_SAFE: HoldState[] = ["VOIDED", "DENIED"];
const WAITING: HoldState[] = ["HELD", "ASSESSING", "COOLING_OFF", "VERIFYING", "APPROVED"];
const NEEDS_FAMILY: HoldState[] = ["COOLING_OFF", "VERIFYING"];

const when = (d: Date) => d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" });

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "brand" | "sent" }) {
  const color = tone === "brand" ? "text-brand-strong" : tone === "sent" ? "text-sent" : "text-ink";
  return (
    <div className={card}>
      <p className="font-mono text-xs uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className={`mt-2 font-serif text-4xl font-medium ${color}`}>{value}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </div>
  );
}

async function Dashboard() {
  await connection(); // Database reads happen per request, never at build time.
  const data = await demoCircle();
  if (!data) return <p className="text-lg">No family circle yet. Run <code className="font-mono">npm run seed</code> first.</p>;
  const [totals, history] = await Promise.all([familyTotals(data.circle.id), familyHistory(data.circle.id)]);
  const total = (states: HoldState[]) => totals.filter((t) => states.includes(t.state)).reduce((a, t) => ({ count: a.count + t.count, cents: a.cents + t.cents }), { count: 0, cents: 0 });
  const kept = total(KEPT_SAFE);
  const sent = total(["RELEASED"]);
  const waiting = total(WAITING);
  const currency = history[0]?.hold.currency ?? "CAD";
  const protectedMember = data.members.find((m) => m.role === "protected");
  const attention = history.filter(({ hold }) => NEEDS_FAMILY.includes(hold.state));

  return (
    <>
      <header>
        <Eyebrow>Family dashboard</Eyebrow>
        <h1 className="mt-3 font-serif text-5xl font-medium tracking-tight">The {data.circle.name}</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-2">
          {protectedMember?.name.split(" ")[0] ?? "Your family member"} is protected. Payments that look like scams wait in PayPal until the family confirms.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat tone="brand" label="Kept safe" value={money(kept.cents, currency)} hint={`${kept.count} scam ${kept.count === 1 ? "attempt" : "attempts"} stopped`} />
        <Stat tone="sent" label="Sent safely" value={money(sent.cents, currency)} hint={`${sent.count} ${sent.count === 1 ? "payment" : "payments"} checked and sent`} />
        <Stat label="Waiting" value={String(waiting.count)} hint="held in PayPal right now" />
      </section>

      {attention.length > 0 && (
        <section className="rounded-xl border border-wait/30 bg-wait-soft p-5 text-ink">
          <h2 className="font-serif text-xl font-medium">Needs the family</h2>
          <ul className="mt-2 space-y-2">
            {attention.map(({ hold, payeeLabel }) => (
              <li key={hold.id}>
                <Link href={`/holds/${hold.id}`} className="font-semibold underline underline-offset-4">
                  {money(hold.amountCents, hold.currency)} to {payeeLabel}
                </Link>
                : {STATE_COPY[hold.state].title.toLowerCase()}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <Eyebrow n="01">History</Eyebrow>
        {history.length === 0 && <p className="text-ink-2">No payments yet. They appear here as soon as one is held.</p>}
        {history.map(({ hold, payeeLabel, verdict }) => {
          const copy = STATE_COPY[hold.state];
          const summary = (verdict as { familySummary?: string } | null)?.familySummary ?? hold.riskReasons?.slice(0, 2).join(". ");
          return (
            <article key={hold.id} className={card}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-serif text-xl font-medium">
                  {money(hold.amountCents, hold.currency)} to {payeeLabel}
                </h3>
                <span className="font-mono text-xs uppercase tracking-wider text-muted">{when(hold.createdAt)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-sm font-semibold">
                <span className={`rounded-full px-3 py-1 ${PILL[copy.tone]}`}>{copy.title}</span>
                {hold.risk && <span className={`rounded-full px-3 py-1 ${RISK_PILL[hold.risk]}`}>{hold.risk} risk</span>}
              </div>
              {summary && <p className="mt-3 leading-relaxed text-ink-2">{summary}</p>}
              <p className="mt-2 font-semibold text-ink">{outcomeOf(hold, payeeLabel)}</p>
              <div className="mt-3 flex flex-wrap gap-4 font-semibold">
                <Link href={`/holds/${hold.id}`} className="text-brand underline underline-offset-4">
                  Details
                </Link>
                {canReport(hold) && (
                  <Link href={`/holds/${hold.id}/report`} className="text-alert underline underline-offset-4">
                    Report this scam
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className={card}>
          <h2 className="font-serif text-xl font-medium">Family circle</h2>
          <ul className="mt-3 space-y-3 text-ink-2">
            {data.members.map((m) => (
              <li key={m.id}>
                <span className="font-semibold">{m.name}</span> {m.role === "protected" ? "(protected)" : "(trusted)"}
                {m.role === "trusted" && (
                  <span className={`block text-sm ${m.paypalPayerId && m.verifiedAt ? "font-medium text-brand" : "text-muted"}`}>
                    {m.paypalPayerId && m.verifiedAt ? "PayPal identity verified: can confirm and receive" : "No PayPal identity saved yet"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className={card}>
          <h2 className="font-serif text-xl font-medium">Saved payees</h2>
          <ul className="mt-3 space-y-3 text-ink-2">
            {data.payees.map((p) => (
              <li key={p.id}>
                {p.label}{" "}
                <span className={`text-sm font-semibold ${p.known ? "text-brand" : "text-wait"}`}>{p.known ? "known" : "new, extra checks"}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {judgeMode() && (
        <Link href="/judge" className="text-center font-semibold text-brand underline underline-offset-4">
          Back to Judge Mode
        </Link>
      )}
    </>
  );
}

export default function FamilyPage() {
  return (
    <Page width="wide">
      <Suspense fallback={<Loading />}>
        <Dashboard />
      </Suspense>
    </Page>
  );
}
