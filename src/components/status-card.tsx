import type { HoldState, RiskLevel } from "@/lib/db/schema";
import { STATE_COPY } from "@/lib/format";

const TONE = {
  wait: { box: "border-wait/30 bg-wait-soft", text: "text-wait" },
  safe: { box: "border-brand/30 bg-brand-soft", text: "text-brand-strong" },
  sent: { box: "border-sent/25 bg-sent-soft", text: "text-sent" },
  neutral: { box: "border-line bg-surface", text: "text-ink-2" },
};

function Icon({ tone }: { tone: keyof typeof TONE }) {
  const common = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (tone === "wait")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  if (tone === "safe")
    return (
      <svg {...common}>
        <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" />
        <path d="M8.5 12l2.5 2.5 4.5-5" />
      </svg>
    );
  if (tone === "sent")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.5 2.5L16 9.5" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function StatusCard({ state, amount, risk = null }: { state: HoldState; amount: string; risk?: RiskLevel | null }) {
  const copy = STATE_COPY[state];
  const tone = TONE[copy.tone];
  return (
    <section aria-label="Payment status" className={`rounded-xl border p-5 ${tone.box}`}>
      <p className="font-mono text-xs uppercase tracking-[0.15em] text-ink-2">{amount}</p>
      <div className={`mt-2 flex items-center gap-3 ${tone.text}`}>
        <Icon tone={copy.tone} />
        <h2 className="font-serif text-3xl font-medium text-ink">{copy.title}</h2>
      </div>
      <p className="mt-2 text-lg leading-relaxed text-ink-2">{copy.body}</p>
      <HoldProgress state={state} risk={risk} />
    </section>
  );
}

type Step = { label: string; status: "done" | "now" | "todo" | "skipped" };

// Which of the four steps each state is on (4 = finished).
const STAGE: Record<HoldState, number> = {
  DRAFT: 0,
  HELD: 1,
  ASSESSING: 1,
  COOLING_OFF: 2,
  VERIFYING: 2,
  APPROVED: 3,
  RELEASED: 4,
  DENIED: 4,
  VOIDED: 4,
  CANCELLED: -1,
};

function steps(state: HoldState, risk: RiskLevel | null): Step[] | null {
  const stage = STAGE[state];
  if (stage < 0) return null;
  const at = (i: number): Step["status"] => (i < stage ? "done" : i === stage ? "now" : "todo");
  const stopped = state === "DENIED" || state === "VOIDED";
  return [
    { label: "Held in PayPal", status: at(0) },
    // Stopped by the sender before the check finished: there was no check to show.
    { label: "Safety check", status: stopped && !risk ? "skipped" : at(1) },
    { label: state === "COOLING_OFF" ? "Waiting period" : "Family check", status: (risk === "LOW" || (stopped && !risk)) && stage >= 3 ? "skipped" : at(2) },
    { label: state === "RELEASED" ? "Sent" : stopped ? "Kept safe" : "Outcome", status: at(3) },
  ];
}

const DOT = {
  done: "border-ink bg-ink text-paper",
  now: "border-ink bg-surface text-ink",
  todo: "border-line-strong bg-surface text-muted",
  skipped: "border-line-strong bg-sunk text-muted",
};
const WORD = { done: "done", now: "now", todo: "next", skipped: "not needed" };

/** Where the payment is: held, checked, family, outcome. Each step says its status in words too. */
export function HoldProgress({ state, risk }: { state: HoldState; risk: RiskLevel | null }) {
  const list = steps(state, risk);
  if (!list) return null;
  return (
    <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Progress">
      {list.map((s, i) => (
        <li key={s.label} className="flex flex-col items-start gap-1.5">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${DOT[s.status]}`}>
            {s.status === "done" ? "✓" : i + 1}
          </span>
          <span className={`text-sm leading-tight ${s.status === "todo" || s.status === "skipped" ? "text-muted" : "font-semibold text-ink"}`}>{s.label}</span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">{WORD[s.status]}</span>
        </li>
      ))}
    </ol>
  );
}
