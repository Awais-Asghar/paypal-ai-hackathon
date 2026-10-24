import { connection } from "next/server";
import { Suspense } from "react";
import { SendForm, type SendDefaults } from "@/components/send-form";
import { Eyebrow, Loading, Page } from "@/components/ui";
import { isScenarioId, judgeMode, SCENARIOS } from "@/lib/demo/scenarios";
import { demoCircle } from "@/lib/queries";

async function SendContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const data = await demoCircle();
  if (!data) return <p className="text-lg">No family circle yet. Run <code className="font-mono">npm run seed</code> first.</p>;

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
      <header>
        <Eyebrow>Protected by SureSend</Eyebrow>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">Send money{sender ? `, ${sender.name.split(" ")[0]}` : ""}</h1>
        <p className="mt-2 text-lg text-ink-2">Your money is held safely in PayPal until it&apos;s checked.</p>
      </header>
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
    <Page>
      <Suspense fallback={<Loading />}>
        <SendContent searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}
