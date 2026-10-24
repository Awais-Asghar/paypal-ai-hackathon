import { and, eq } from "drizzle-orm";
import { connection } from "next/server";
import { Suspense } from "react";
import { button, Eyebrow, Loading, Page } from "@/components/ui";
import { getDb } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { money } from "@/lib/format";
import { getGate, GateError } from "@/lib/gate";

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
    return <Outcome tone="safe" title="Thank you. The payment was stopped." body={`${sender?.name ?? "Your family member"}'s ${amount} never left their account.`} />;
  }
  if (verification.status === "confirmed" || hold.state === "RELEASED") {
    return <Outcome tone="sent" title="Confirmed" body={`The ${amount} is being sent to your own PayPal account.`} />;
  }
  if (expired || hold.state !== "VERIFYING") return <Outcome tone="neutral" title="This check is closed" body="Nothing more is needed from you." />;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Eyebrow tone="alert">Safety check from SureSend</Eyebrow>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">Is this really you, {firstName}?</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          {sender?.name ?? "A family member"} is about to send <strong className="text-ink">{amount}</strong>. Someone told them it was for you. The money is on hold in PayPal until you answer.
        </p>
      </header>
      {verification.status === "identity_matched" ? (
        <form action={`/api/verify/${encodeURIComponent(token)}/answer`} method="post" className="flex flex-col gap-3">
          <p className="flex items-center gap-2 font-semibold text-brand-strong">
            <span aria-hidden>✓</span> PayPal confirmed it is you. Did you ask for this money?
          </p>
          <button name="answer" value="not_me" className={button.danger}>
            No, that wasn&apos;t me. Stop it.
          </button>
          <button name="answer" value="it_was_me" className={button.secondary}>
            Yes, I asked for it
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          {verification.status === "identity_mismatch" && (
            <p role="alert" className="rounded-xl bg-wait-soft p-4 text-wait">
              That PayPal account isn&apos;t the one saved for {firstName}. Please log in with your own PayPal.
            </p>
          )}
          <p className="text-ink-2">To prove it is you, log in with your own PayPal account. A voice can be copied; your PayPal login can&apos;t.</p>
          <a href={`/api/verify/${encodeURIComponent(token)}/login`} className={button.paypal}>
            Log in with PayPal
          </a>
        </div>
      )}
    </div>
  );
}

const OUTCOME = {
  safe: "border-brand/30 bg-brand-soft text-brand-strong",
  sent: "border-sent/25 bg-sent-soft text-sent",
  neutral: "border-line bg-surface text-ink",
};

function Outcome({ title, body, tone }: { title: string; body: string; tone: keyof typeof OUTCOME }) {
  return (
    <div className={`rounded-xl border p-6 ${OUTCOME[tone]}`}>
      <h1 className="font-serif text-3xl font-medium">{title}</h1>
      <p className="mt-2 text-lg text-ink-2">{body}</p>
    </div>
  );
}

export default function VerifyPage({ params }: PageProps<"/verify/[token]">) {
  return (
    <Page>
      <Suspense fallback={<Loading />}>
        <VerifyCard params={params} />
      </Suspense>
    </Page>
  );
}
