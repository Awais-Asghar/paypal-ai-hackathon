import { connection } from "next/server";
import { Suspense } from "react";
import { SendForm, type SendDefaults } from "@/components/send-form";
import { isScenarioId, judgeMode, SCENARIOS } from "@/lib/demo/scenarios";
import { demoCircle } from "@/lib/queries";

async function SendContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const data = await demoCircle();
  if (!data) return <p className="text-lg">No family circle yet. Run <code>npm run seed</code> first.</p>;

  const { scenario } = await searchParams;
  const defaults: SendDefaults = {};
  if (judgeMode() && isScenarioId(scenario)) {
    const s = SCENARIOS[scenario];
    Object.assign(defaults, {
      scenario,
      payeeId: data.payees.find((p) => p.label.startsWith(s.payeeLabelPrefix))?.id,
      amount: (s.amountCents / 100).toFixed(2),
      purpose: s.purpose,
      namedMemberId: s.namedMemberPrefix ? data.members.find((m) => m.name.startsWith(s.namedMemberPrefix!))?.id : undefined,
      story: s.story,
    });
  }
  const sender = data.members.find((m) => m.role === "protected");

  return (
    <>
      <h1 className="text-3xl font-semibold text-stone-900">Send money{sender ? `, ${sender.name.split(" ")[0]}` : ""}</h1>
      <SendForm
        key={defaults.scenario ?? "blank"}
        circleId={data.circle.id}
        payees={data.payees.map((p) => ({ id: p.id, label: p.label }))}
        family={data.members.filter((m) => m.role === "trusted").map((m) => ({ id: m.id, label: m.name }))}
        defaults={defaults}
      />
    </>
  );
}

export default function SendPage({ searchParams }: PageProps<"/send">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">SureSend</p>
      <Suspense fallback={<p className="text-lg text-stone-500">Loading...</p>}>
        <SendContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
