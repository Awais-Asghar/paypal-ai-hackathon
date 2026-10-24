import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PayoutStatus, PayPalStatus } from "@/components/paypal-status";
import { judgeMode, SCENARIOS } from "@/lib/demo/scenarios";
import { money, STATE_COPY } from "@/lib/format";
import { demoCircle, messagesFor, recentHolds } from "@/lib/queries";

const card = "rounded-2xl border border-stone-200 bg-white p-5";
const smallButton = "rounded-lg border-2 border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-stone-900 hover:border-stone-500";

function SandboxLogins() {
  const people = [
    ["Nana (Margaret Collins)", process.env.SANDBOX_MARGARET_EMAIL, process.env.SANDBOX_MARGARET_PASSWORD, "approves the payment in PayPal"],
    ["Ethan Collins", process.env.SANDBOX_ETHAN_EMAIL, process.env.SANDBOX_ETHAN_PASSWORD, "logs in to answer “Is this really you?”"],
  ] as const;
  return (
    <section className={card}>
      <h2 className="text-lg font-semibold">PayPal sandbox logins</h2>
      <p className="mt-1 text-stone-600">Fake money only. Every PayPal page should be on sandbox.paypal.com.</p>
      <ul className="mt-3 space-y-2">
        {people.map(([who, email, password, role]) => (
          <li key={who}>
            <span className="font-semibold">{who}</span> {role}:{" "}
            <span className="font-mono text-sm">{email ?? "(set in .env)"}</span>
            {password && <span className="font-mono text-sm"> / {password}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

async function JudgeContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection(); // JUDGE_MODE is read per request, never frozen at build time.
  if (!judgeMode()) notFound();
  const kept = Number((await searchParams).kept ?? 0);
  const data = await demoCircle();
  if (!data) return <p className="text-lg">No family circle yet. Run <code>npm run seed</code> first.</p>;
  const rows = await recentHolds(data.circle.id);
  const family = data.members.filter((m) => m.role === "trusted");
  const inboxes = await Promise.all(family.map(async (m) => ({ member: m, count: (await messagesFor(m.id)).length })));

  return (
    <>
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">SureSend Judge Mode</p>
        <h1 className="mt-2 text-3xl font-semibold">Try SureSend in three minutes</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-stone-600">
          Pick a scenario and play Nana: approve in the PayPal sandbox, answer the check-in, and watch the money stay held. For the scam scenarios, open Ethan&apos;s phone and answer as the real Ethan. The PayPal column reads the live sandbox, so you can see the money never moved.
        </p>
      </header>
      <SandboxLogins />
      <section className="grid gap-3 sm:grid-cols-3">
        {Object.values(SCENARIOS).map((s) => (
          <Link key={s.id} href={`/send?scenario=${s.id}`} className={`${card} flex flex-col gap-2 hover:border-emerald-600`}>
            <h2 className="text-lg font-semibold">{s.title}</h2>
            <p className="text-stone-600">{s.blurb}</p>
            <span className="mt-auto font-semibold text-emerald-700">Start as Nana</span>
          </Link>
        ))}
      </section>

      <section className={`${card} flex flex-wrap items-center gap-3`}>
        <h2 className="mr-auto text-lg font-semibold">Family phones</h2>
        <Link href="/family" className={smallButton}>
          Family dashboard
        </Link>
        {inboxes.map(({ member, count }) => (
          <Link key={member.id} href={`/judge/phone/${member.id}`} className={smallButton}>
            {member.name.split(" ")[0]}&apos;s phone ({count})
          </Link>
        ))}
      </section>

      {kept > 0 && (
        <p className="rounded-xl bg-amber-50 p-4 text-amber-950">
          Reset kept {kept} held {kept === 1 ? "payment" : "payments"}: PayPal could not void {kept === 1 ? "it" : "them"} just now, so {kept === 1 ? "it stays" : "they stay"} on record. Try the reset again in a moment.
        </p>
      )}

      <section className={card}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-lg font-semibold">Payments</h2>
          <form action="/api/judge/sweep" method="post">
            <button className={smallButton}>Run the scheduler now</button>
          </form>
          <form action="/api/judge/reset" method="post">
            <button className="rounded-lg border-2 border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-800 hover:border-red-500">Reset demo (voids open holds)</button>
          </form>
        </div>
        {rows.length === 0 ? (
          <p className="mt-4 text-stone-600">No payments yet. Pick a scenario above.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead className="text-sm text-stone-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Payment</th>
                  <th className="py-2 pr-3 font-medium">SureSend</th>
                  <th className="py-2 pr-3 font-medium">Risk</th>
                  <th className="py-2 pr-3 font-medium">PayPal says</th>
                  <th className="py-2 pr-3 font-medium">Payout</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map(({ hold, payeeLabel }) => (
                  <tr key={hold.id}>
                    <td className="py-3 pr-3">
                      <Link href={`/holds/${hold.id}`} className="font-semibold text-emerald-800 underline underline-offset-4">
                        {money(hold.amountCents, hold.currency)}
                      </Link>{" "}
                      to {payeeLabel}
                    </td>
                    <td className="py-3 pr-3">{STATE_COPY[hold.state].title}</td>
                    <td className="py-3 pr-3">{hold.risk ?? "-"}</td>
                    <td className="py-3 pr-3">
                      <Suspense fallback={<span className="text-stone-400">checking...</span>}>
                        <PayPalStatus authorizationId={hold.paypalAuthorizationId} />
                      </Suspense>
                    </td>
                    <td className="py-3 pr-3">
                      <Suspense fallback={<span className="text-stone-400">checking...</span>}>
                        <PayoutStatus batchId={hold.payoutBatchId} />
                      </Suspense>
                    </td>
                    <td className="py-3 text-right">
                      {hold.state === "COOLING_OFF" && (
                        <form action="/api/judge/skip-cooling-off" method="post">
                          <input type="hidden" name="holdId" value={hold.id} />
                          <button className={smallButton}>Skip cooling-off</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default function JudgePage({ searchParams }: PageProps<"/judge">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <Suspense fallback={<p className="text-lg text-stone-500">Loading...</p>}>
        <JudgeContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
