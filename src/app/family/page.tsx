import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { canReport, outcomeOf } from "@/lib/aftercare";
import type { HoldState } from "@/lib/db/schema";
import { judgeMode } from "@/lib/demo/scenarios";
import { money, STATE_COPY } from "@/lib/format";
import { demoCircle, familyHistory, familyTotals } from "@/lib/queries";

const card = "rounded-2xl border border-stone-200 bg-white p-5";
const PILL = {
  wait: "bg-amber-100 text-amber-900",
  safe: "bg-emerald-100 text-emerald-900",
  sent: "bg-sky-100 text-sky-900",
  neutral: "bg-stone-100 text-stone-700",
};
const RISK_PILL = { LOW: "bg-stone-100 text-stone-700", MEDIUM: "bg-amber-100 text-amber-900", HIGH: "bg-red-100 text-red-900" };

const KEPT_SAFE: HoldState[] = ["VOIDED", "DENIED"];
const WAITING: HoldState[] = ["HELD", "ASSESSING", "COOLING_OFF", "VERIFYING", "APPROVED"];
const NEEDS_FAMILY: HoldState[] = ["COOLING_OFF", "VERIFYING"];

const when = (d: Date) => d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" });

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={card}>
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-stone-900">{value}</p>
      <p className="mt-1 text-sm text-stone-500">{hint}</p>
    </div>
  );
}

async function Dashboard() {
  await connection(); // Database reads happen per request, never at build time.
  const data = await demoCircle();
  if (!data) return <p className="text-lg">No family circle yet. Run <code>npm run seed</code> first.</p>;
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
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">SureSend family</p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-900">The {data.circle.name}</h1>
        <p className="mt-2 text-lg leading-relaxed text-stone-600">
          {protectedMember?.name.split(" ")[0] ?? "Your family member"} is protected. Payments that look like scams wait in PayPal until the family confirms.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Kept safe" value={money(kept.cents, currency)} hint={`${kept.count} scam ${kept.count === 1 ? "attempt" : "attempts"} stopped`} />
        <Stat label="Sent safely" value={money(sent.cents, currency)} hint={`${sent.count} ${sent.count === 1 ? "payment" : "payments"} checked and sent`} />
        <Stat label="Waiting" value={String(waiting.count)} hint="held in PayPal right now" />
      </section>

      {attention.length > 0 && (
        <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-amber-950">
          <h2 className="font-semibold">Needs the family</h2>
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
        <h2 className="text-lg font-semibold text-stone-900">History</h2>
        {history.length === 0 && <p className="text-stone-600">No payments yet.</p>}
        {history.map(({ hold, payeeLabel, verdict }) => {
          const copy = STATE_COPY[hold.state];
          const summary = (verdict as { familySummary?: string } | null)?.familySummary ?? hold.riskReasons?.slice(0, 2).join(". ");
          return (
            <article key={hold.id} className={card}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold text-stone-900">
                  {money(hold.amountCents, hold.currency)} to {payeeLabel}
                </h3>
                <span className="text-sm text-stone-500">{when(hold.createdAt)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-sm font-semibold">
                <span className={`rounded-full px-3 py-1 ${PILL[copy.tone]}`}>{copy.title}</span>
                {hold.risk && <span className={`rounded-full px-3 py-1 ${RISK_PILL[hold.risk]}`}>{hold.risk} risk</span>}
              </div>
              {summary && <p className="mt-3 leading-relaxed text-stone-700">{summary}</p>}
              <p className="mt-2 font-medium text-stone-900">{outcomeOf(hold, payeeLabel)}</p>
              <div className="mt-3 flex flex-wrap gap-4 font-semibold">
                <Link href={`/holds/${hold.id}`} className="text-emerald-800 underline underline-offset-4">
                  Details
                </Link>
                {canReport(hold) && (
                  <Link href={`/holds/${hold.id}/report`} className="text-red-800 underline underline-offset-4">
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
          <h2 className="font-semibold text-stone-900">Family circle</h2>
          <ul className="mt-2 space-y-2 text-stone-700">
            {data.members.map((m) => (
              <li key={m.id}>
                <span className="font-semibold">{m.name}</span> {m.role === "protected" ? "(protected)" : "(trusted)"}
                {m.role === "trusted" && (
                  <span className={`block text-sm ${m.paypalPayerId && m.verifiedAt ? "text-emerald-700" : "text-stone-500"}`}>
                    {m.paypalPayerId && m.verifiedAt ? "PayPal identity verified: can confirm and receive" : "No PayPal identity saved yet"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className={card}>
          <h2 className="font-semibold text-stone-900">Saved payees</h2>
          <ul className="mt-2 space-y-2 text-stone-700">
            {data.payees.map((p) => (
              <li key={p.id}>
                {p.label}{" "}
                <span className={`text-sm font-semibold ${p.known ? "text-emerald-700" : "text-amber-800"}`}>{p.known ? "known" : "new, extra checks"}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {judgeMode() && (
        <Link href="/judge" className="text-center font-semibold text-emerald-700">
          Back to Judge Mode
        </Link>
      )}
    </>
  );
}

export default function FamilyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <Suspense fallback={<p className="text-lg text-stone-500">Loading...</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}
