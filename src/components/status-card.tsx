import type { HoldState } from "@/lib/db/schema";
import { STATE_COPY } from "@/lib/format";

const TONE = {
  wait: "border-amber-300 bg-amber-50 text-amber-950",
  safe: "border-emerald-300 bg-emerald-50 text-emerald-950",
  sent: "border-sky-300 bg-sky-50 text-sky-950",
  neutral: "border-stone-300 bg-white text-stone-900",
};

export function StatusCard({ state, amount }: { state: HoldState; amount: string }) {
  const copy = STATE_COPY[state];
  return (
    <div className={`rounded-2xl border-2 p-6 ${TONE[copy.tone]}`}>
      <p className="text-sm font-medium uppercase tracking-wide opacity-70">{amount}</p>
      <h2 className="mt-1 text-3xl font-semibold">{copy.title}</h2>
      <p className="mt-2 text-lg leading-relaxed">{copy.body}</p>
    </div>
  );
}
