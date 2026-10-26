import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PayoutStatus, PayPalStatus } from "@/components/paypal-status";
import { button, card, Eyebrow, Loading, Page } from "@/components/ui";
import { judgeMode, SCENARIOS } from "@/lib/demo/scenarios";
import { money, STATE_COPY } from "@/lib/format";
import { demoCircle, messagesFor, recentHolds, recentWebhookEvents } from "@/lib/queries";

const smallButton = button.small;

function SandboxLogins() {
  const people = [
    ["Nana (Margaret Collins)", process.env.SANDBOX_MARGARET_EMAIL, process.env.SANDBOX_MARGARET_PASSWORD, "approves the payment in PayPal"],
    ["Ethan Collins", process.env.SANDBOX_ETHAN_EMAIL, process.env.SANDBOX_ETHAN_PASSWORD, "logs in to answer “Is this really you?”"],
  ] as const;
  return (
    <section className={card}>
      <h2 className="font-serif text-xl font-medium">PayPal sandbox logins</h2>
      <p className="mt-1 text-ink-2">Fake money only. Every PayPal page should be on sandbox.paypal.com.</p>
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
  if (!data) return <p className="text-lg">No family circle yet. Run <code className="font-mono">npm run seed</code> first.</p>;
  const rows = await recentHolds(data.circle.id);
  const family = data.members.filter((m) => m.role === "trusted");
  const inboxes = await Promise.all(family.map(async (m) => ({ member: m, count: (await messagesFor(m.id)).length })));
  const webhooks = await recentWebhookEvents();

  return (
    <>
      <header>
        <Eyebrow>Judge Mode · PayPal sandbox</Eyebrow>
        <h1 className="mt-3 font-serif text-5xl font-medium tracking-tight">Try SureSend in three minutes</h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-ink-2">
          Pick a scenario and play Nana: approve in the PayPal sandbox, answer the check-in, and watch the money stay held. For the scam scenarios, open Ethan&apos;s phone and answer as the real Ethan. The PayPal column reads the live sandbox, so you can see the money never moved.
        </p>
      </header>
      <section className="flex flex-col gap-4">
        <Eyebrow n="01">Pick a scenario</Eyebrow>
        <div className="grid gap-3 md:grid-cols-3">
          {Object.values(SCENARIOS).map((s, i) => (
            <Link key={s.id} href={`/send?scenario=${s.id}`} className={`${card} group flex flex-col gap-2 transition-colors hover:border-ink`}>
              <span className={`font-mono text-xs uppercase tracking-[0.15em] ${s.id === "rent" ? "text-brand" : "text-alert"}`}>
                Scenario {i + 1} · {s.id === "rent" ? "everyday payment" : "scam"}
              </span>
              <h2 className="font-serif text-2xl font-medium">{s.title}</h2>
              <p className="text-ink-2">{s.blurb}</p>
              <span className="mt-auto pt-2 font-semibold text-ink group-hover:underline">Start as Nana →</span>
            </Link>
          ))}
        </div>
        <SandboxLogins />
      </section>

      <section className={`${card} flex flex-wrap items-center gap-3`}>
        <div className="mr-auto">
          <Eyebrow n="02">Family phones</Eyebrow>
          <p className="mt-1 text-ink-2">Where &ldquo;Is this really you?&rdquo; arrives, at the contact saved at setup.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {inboxes.map(({ member, count }) => (
            <Link key={member.id} href={`/judge/phone/${member.id}`} className={smallButton}>
              {member.name.split(" ")[0]}&apos;s phone ({count})
            </Link>
          ))}
          <Link href="/family" className={smallButton}>
            Family dashboard
          </Link>
        </div>
      </section>

      {kept > 0 && (
        <p role="status" className="rounded-xl bg-wait-soft p-4 text-wait">
          Reset kept {kept} held {kept === 1 ? "payment" : "payments"}: PayPal could not void {kept === 1 ? "it" : "them"} just now, so {kept === 1 ? "it stays" : "they stay"} on record. Try the reset again in a moment.
        </p>
      )}

      <section className={card}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <Eyebrow n="03">Watch the money</Eyebrow>
            <p className="mt-1 text-ink-2">Live from the PayPal sandbox.</p>
          </div>
          <form action="/api/judge/sweep" method="post">
            <button className={smallButton}>Run the scheduler now</button>
          </form>
          <form action="/api/judge/reset" method="post">
            <button className="inline-flex min-h-10 items-center rounded-full border border-alert/40 bg-surface px-4 text-sm font-semibold text-alert hover:border-alert">Reset demo (voids open holds)</button>
          </form>
        </div>
        {rows.length === 0 ? (
          <p className="mt-4 text-ink-2">No payments yet. Pick a scenario above.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead className="font-mono text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Payment</th>
                  <th className="py-2 pr-3 font-medium">SureSend</th>
                  <th className="py-2 pr-3 font-medium">Risk</th>
                  <th className="py-2 pr-3 font-medium">PayPal says</th>
                  <th className="py-2 pr-3 font-medium">Payout</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ hold, payeeLabel }) => (
                  <tr key={hold.id}>
                    <td className="py-3 pr-3">
                      <Link href={`/holds/${hold.id}`} className="font-semibold text-ink underline underline-offset-4">
                        {money(hold.amountCents, hold.currency)}
                      </Link>{" "}
                      to {payeeLabel}
                    </td>
                    <td className="py-3 pr-3">{STATE_COPY[hold.state].title}</td>
                    <td className="py-3 pr-3">{hold.risk ?? "-"}</td>
                    <td className="py-3 pr-3">
                      <Suspense fallback={<span className="text-muted">checking...</span>}>
                        <PayPalStatus authorizationId={hold.paypalAuthorizationId} />
                      </Suspense>
                    </td>
                    <td className="py-3 pr-3">
                      <Suspense fallback={<span className="text-muted">checking...</span>}>
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

      <section className={card}>
        <Eyebrow n="04">PayPal webhooks</Eyebrow>
        <p className="mt-1 text-ink-2">PayPal&apos;s own notifications, each one signature-verified with PayPal before it is stored.</p>
        {webhooks.length === 0 ? (
          <p className="mt-4 text-ink-2">None received yet. They arrive a few seconds after a payment is approved, captured or voided.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {webhooks.map((w) => (
              <li key={`${w.eventType}-${w.receivedAt.toISOString()}-${w.resourceId}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <span className="font-mono text-sm font-semibold text-ink">{w.eventType}</span>
                <span className="text-sm text-muted">
                  {w.receivedAt.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" })} ·{" "}
                  <span className="font-semibold text-brand">verified</span>
                  {w.processedAt ? "" : ", processing"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function JudgePage({ searchParams }: PageProps<"/judge">) {
  return (
    <Page width="wide">
      <Suspense fallback={<Loading />}>
        <JudgeContent searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}
