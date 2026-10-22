import { and, eq } from "drizzle-orm";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { money } from "@/lib/format";
import { getGate, GateError } from "@/lib/gate";

const button = "block w-full rounded-xl px-5 py-4 text-center text-lg font-semibold";

async function VerifyCard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await connection(); // Database reads happen per request, never at build time.
  const gate = await getGate();
  const found = await gate.getVerification(token).catch((e) => {
    if (e instanceof GateError && e.code === "NOT_FOUND") return null;
    throw e;
  });
  if (!found) return <p className="text-lg">This link is not valid.</p>;

  const { verification, member, hold } = found;
  const db = await getDb();
  const [sender] = await db.select().from(members).where(and(eq(members.circleId, hold.circleId), eq(members.role, "protected")));
  const amount = money(hold.amountCents, hold.currency);
  const firstName = member.name.split(" ")[0];
  const expired = verification.status === "expired" || verification.expiresAt <= new Date();

  if (verification.status === "denied" || hold.state === "VOIDED") {
    return <Outcome title="Thank you. The payment was stopped." body={`${sender?.name ?? "Your family member"}'s ${amount} never left their account.`} />;
  }
  if (verification.status === "confirmed" || hold.state === "RELEASED") {
    return <Outcome title="Confirmed" body={`The ${amount} is being sent to your own PayPal account.`} />;
  }
  if (expired || hold.state !== "VERIFYING") return <Outcome title="This check is closed" body="Nothing more is needed from you." />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-stone-900">Is this really you, {firstName}?</h1>
        <p className="mt-3 text-lg leading-relaxed text-stone-700">
          {sender?.name ?? "A family member"} is about to send <strong>{amount}</strong>. Someone told them it was for you. The money is on hold until you answer.
        </p>
      </div>
      {verification.status === "identity_matched" ? (
        <form action={`/api/verify/${encodeURIComponent(token)}/answer`} method="post" className="flex flex-col gap-3">
          <p className="text-stone-600">PayPal confirmed it is you. Did you ask for this money?</p>
          <button name="answer" value="not_me" className={`${button} bg-red-700 text-white`}>No, that wasn&apos;t me. Stop it.</button>
          <button name="answer" value="it_was_me" className={`${button} border-2 border-stone-300 bg-white text-stone-900`}>Yes, I asked for it</button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          {verification.status === "identity_mismatch" && (
            <p className="rounded-xl bg-amber-50 p-4 text-amber-950">That PayPal account isn&apos;t the one saved for {firstName}. Please log in with your own PayPal.</p>
          )}
          <p className="text-stone-600">To prove it is you, log in with your own PayPal account. A voice can be copied; your PayPal login can&apos;t.</p>
          <a href={`/api/verify/${encodeURIComponent(token)}/login`} className={`${button} bg-[#0070ba] text-white`}>Log in with PayPal</a>
        </div>
      )}
    </div>
  );
}

function Outcome({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 text-emerald-950">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-lg">{body}</p>
    </div>
  );
}

export default function VerifyPage({ params }: PageProps<"/verify/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">SureSend</p>
      <Suspense fallback={<p className="text-lg text-stone-500">Loading...</p>}>
        <VerifyCard params={params} />
      </Suspense>
    </main>
  );
}
