import { eq } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { button, card, Eyebrow, Loading, Page } from "@/components/ui";
import { canReport, getReports, moneyLost, outcomeOf } from "@/lib/aftercare";
import { getDb } from "@/lib/db";
import { holds, payees } from "@/lib/db/schema";
import { money } from "@/lib/format";

// Official CAFC channels (checked 2026-10-24 on antifraudcentre-centreantifraude.ca). Fixed text, never from the model.
const CAFC_ONLINE = "https://reportcyberandfraud.canada.ca/";
const CAFC_PHONE = "1-888-495-8501";

async function ReportView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection(); // Database reads happen per request, never at build time.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return <p className="text-lg">This payment was not found.</p>;
  const [row] = await (await getDb()).select({ hold: holds, payee: payees }).from(holds).innerJoin(payees, eq(payees.id, holds.payeeId)).where(eq(holds.id, id));
  if (!row) return <p className="text-lg">This payment was not found.</p>;
  const { hold, payee } = row;
  if (!canReport(hold)) return <p className="text-lg">This payment didn&apos;t show any scam signs, so there is nothing to report.</p>;
  const service = await getReports();
  const [report, facts] = await Promise.all([service.get(hold.id), service.facts(hold)]);

  return (
    <>
      <header>
        <Eyebrow tone="alert">Aftercare</Eyebrow>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">Report this scam attempt</h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-2">
          {moneyLost(hold)
            ? "Reporting helps the police and other families."
            : "No money was lost, but the Canadian Anti-Fraud Centre asks for reports of attempts too. It helps them warn other families."}
        </p>
      </header>

      <section className={card}>
        <h2 className="font-serif text-xl font-medium">The facts</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-ink-2">
          <dt className="font-medium text-muted">Date</dt>
          <dd>{facts.date}</dd>
          <dt className="font-medium text-muted">Asked to send</dt>
          <dd>
            {money(hold.amountCents, hold.currency)} to {payee.label}
          </dd>
          {facts.scamType && (
            <>
              <dt className="font-medium text-muted">Looks like</dt>
              <dd>{facts.scamType}</dd>
            </>
          )}
          {facts.redFlags.length > 0 && (
            <>
              <dt className="font-medium text-muted">Warning signs</dt>
              <dd>{facts.redFlags.join(", ")}</dd>
            </>
          )}
          <dt className="font-medium text-muted">What happened</dt>
          <dd>{outcomeOf(hold, payee.label)}</dd>
        </dl>
      </section>

      {!report ? (
        <form action={`/api/holds/${hold.id}/report`} method="post">
          <button className={`${button.brand} w-full`}>Write the report for me</button>
          <p className="mt-2 text-center text-sm text-muted">SureSend&apos;s AI drafts it from the check-in. You check it before sending.</p>
        </form>
      ) : (
        <>
          <section className={card}>
            <h2 className="font-serif text-xl font-medium">Summary</h2>
            <p className="mt-2 leading-relaxed text-ink-2">{report.body.summary}</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-ink-2">
              {report.body.whatHappened.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </section>

          <section className={card}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-xl font-medium">Text for the report form</h2>
              <CopyButton text={report.body.reportText} />
            </div>
            <p className="mt-3 whitespace-pre-line rounded-xl bg-sunk p-4 leading-relaxed text-ink">{report.body.reportText}</p>
            <p className="mt-2 text-sm text-muted">
              {report.source === "ai" ? "Drafted by SureSend's AI from the check-in." : "Written from the payment record (the AI was busy)."} Read it over before you send it.
            </p>
          </section>

          {report.body.nextSteps.length > 0 && (
            <section className={card}>
              <h2 className="font-serif text-xl font-medium">What to do next</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
                {report.body.nextSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="rounded-xl border border-brand/30 bg-brand-soft p-5 text-ink">
        <h2 className="font-serif text-xl font-medium">How to report</h2>
        <ul className="mt-2 space-y-2">
          <li>
            Online:{" "}
            <a href={CAFC_ONLINE} className="font-semibold underline underline-offset-4" target="_blank" rel="noreferrer">
              reportcyberandfraud.canada.ca
            </a>{" "}
            (paste the text above into the description)
          </li>
          <li>
            By phone: Canadian Anti-Fraud Centre, <span className="whitespace-nowrap font-semibold">{CAFC_PHONE}</span> (Monday to Friday, 10 am to 4:45 pm Eastern)
          </li>
          {moneyLost(hold) && <li>Money was sent: call your local police too, and contact PayPal through the Resolution Center.</li>}
        </ul>
      </section>
    </>
  );
}

export default function ReportPage({ params }: PageProps<"/holds/[id]/report">) {
  return (
    <Page>
      <Suspense fallback={<Loading />}>
        <ReportView params={params} />
      </Suspense>
      <Link href="/family" className="text-center font-semibold text-brand underline underline-offset-4">
        Family dashboard
      </Link>
    </Page>
  );
}
