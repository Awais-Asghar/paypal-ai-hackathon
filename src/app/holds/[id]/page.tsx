import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckinChat } from "@/components/checkin-chat";
import { StatusCard } from "@/components/status-card";
import { getDb } from "@/lib/db";
import { holds, payees } from "@/lib/db/schema";
import { money } from "@/lib/format";

async function HoldStatus({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection(); // Database reads happen per request, never at build time.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return <p className="text-lg">This payment was not found.</p>;
  const db = await getDb();
  const [row] = await db.select({ hold: holds, payee: payees }).from(holds).innerJoin(payees, eq(payees.id, holds.payeeId)).where(eq(holds.id, id));
  if (!row) return <p className="text-lg">This payment was not found.</p>;
  const { hold, payee } = row;
  return (
    <>
      <StatusCard state={hold.state} amount={`${money(hold.amountCents, hold.currency)} to ${payee.label}`} />
      {(hold.state === "HELD" || hold.state === "ASSESSING") && <CheckinChat holdId={hold.id} />}
      {hold.riskReasons && hold.riskReasons.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h3 className="font-semibold text-stone-900">Why we paused</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-700">
            {hold.riskReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function HoldPage({ params }: PageProps<"/holds/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">SureSend</p>
      <Suspense fallback={<p className="text-lg text-stone-500">Loading your payment...</p>}>
        <HoldStatus params={params} />
      </Suspense>
    </main>
  );
}
