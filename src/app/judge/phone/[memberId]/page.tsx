import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
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
      <h1 className="text-2xl font-semibold">{member.name.split(" ")[0]}&apos;s phone</h1>
      {messages.length === 0 && <p className="text-stone-600">No messages yet.</p>}
      {messages.map((m) => (
        <article key={m.id} className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-500">
            From SureSend to {m.to ?? "saved contact"} &middot; {m.createdAt.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          <h2 className="mt-2 text-lg font-semibold">{m.subject}</h2>
          <p className="mt-1 leading-relaxed text-stone-700">{m.body}</p>
          {m.link && (
            <a href={m.link} className="mt-4 block rounded-xl bg-emerald-700 px-5 py-3 text-center text-lg font-semibold text-white">
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-10">
      <Link href="/judge" className="text-sm font-semibold text-emerald-700">Back to Judge Mode</Link>
      <Suspense fallback={<p className="text-lg text-stone-500">Loading...</p>}>
        <Inbox params={params} />
      </Suspense>
    </main>
  );
}
