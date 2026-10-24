import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { button, Eyebrow, Loading, Page } from "@/components/ui";
import { getDb } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { judgeMode } from "@/lib/demo/scenarios";
import { messagesFor } from "@/lib/queries";

// Judge Mode: what the family member would receive. Reads the outbox the gate writes.
async function Inbox({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await connection();
  if (!judgeMode()) notFound();
  if (!/^[0-9a-f-]{36}$/i.test(memberId)) notFound();
  const [member] = await (await getDb()).select().from(members).where(eq(members.id, memberId));
  if (!member) notFound();
  const messages = await messagesFor(member.id);

  return (
    <>
      <header>
        <Eyebrow>Judge Mode · family phone</Eyebrow>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">{member.name.split(" ")[0]}&apos;s phone</h1>
      </header>
      {messages.length === 0 && <p className="text-ink-2">No messages yet. A message arrives here when a payment names {member.name.split(" ")[0]}.</p>}
      {messages.map((m) => (
        <article key={m.id} className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_0_var(--color-line)]">
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            From SureSend to {m.to ?? "saved contact"} &middot; {m.createdAt.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          <h2 className="mt-2 font-serif text-xl font-medium">{m.subject}</h2>
          <p className="mt-1 leading-relaxed text-ink-2">{m.body}</p>
          {m.link && (
            <a href={m.link} className={`${button.primary} mt-4 w-full`}>
              Open
            </a>
          )}
        </article>
      ))}
    </>
  );
}

export default function PhonePage({ params }: PageProps<"/judge/phone/[memberId]">) {
  return (
    <Page>
      <Link href="/judge" className="text-sm font-semibold text-brand underline underline-offset-4">
        Back to Judge Mode
      </Link>
      <Suspense fallback={<Loading />}>
        <Inbox params={params} />
      </Suspense>
    </Page>
  );
}
