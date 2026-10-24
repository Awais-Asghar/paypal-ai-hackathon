import Link from "next/link";
import { button, Eyebrow } from "@/components/ui";

const STEPS = [
  ["Hold, don't send", "The payment is authorized in PayPal, so the money is reserved but not moved."],
  ["A friendly check-in", "SureSend asks a few gentle questions and reads the message or voicemail for scam signs."],
  ["Is this really you?", "If the story names a family member, they confirm by logging in with their own PayPal. A voice clone can't."],
  ["Release or void", "Approved payments go only to the verified person. Anything else is cancelled and the money never leaves."],
] as const;

// Canadian Anti-Fraud Centre figures (docs/PROJECT.md).
const STATS = [
  ["$704M", "lost to fraud by Canadians in 2025"],
  ["5 to 10%", "of fraud is ever reported"],
  ["$137.9M", "lost by Canadian seniors in 2024"],
] as const;

const PAYPAL = [
  ["Authorize, not pay", "Orders with intent AUTHORIZE reserve the money. Nothing moves until the check passes."],
  ["Identity a voice clone can't fake", "Log In with PayPal proves the family member is who they say, matched on their PayPal ID."],
  ["Paid only to the verified person", "Capture and Payouts go to the PayPal account saved for that family member. Anyone else is refused."],
  ["Void when in doubt", "Denied, unanswered or near its deadline: the authorization is voided and the money never left."],
] as const;

const AI = [
  ["Asks, never decides alone", "A warm check-in in plain language finds urgency, secrecy, new numbers and gift-card requests."],
  ["Reads the evidence", "Screenshots of the message and voicemail recordings are read and transcribed as untrusted evidence."],
  ["Hard rules come first", "Red flags written in code set a minimum risk the AI can raise but never lower."],
  ["Never touches the money", "The AI has no PayPal access. Only the Payment Gate can capture, pay out or void."],
] as const;

function Example() {
  return (
    <figure className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <figcaption className="font-mono text-xs uppercase tracking-[0.15em] text-muted">Example: a voice-clone scam</figcaption>
      <div className="mt-4 rounded-xl border border-wait/30 bg-wait-soft p-4">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-2">$2,500.00 to Ethan Collins (grandson)</p>
        <p className="mt-1 font-serif text-2xl font-medium">Checking with your family</p>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm font-medium text-alert">
          {["Asked to keep it secret", "New number", "Urgent bail"].map((f) => (
            <li key={f} className="rounded-full bg-alert-soft px-3 py-1">
              {f}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 space-y-2 text-base">
        <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-sunk px-4 py-2">Is this really you, Ethan?</p>
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-4 py-2 text-white">Logged in with my PayPal. That wasn&apos;t me.</p>
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-brand/30 bg-brand-soft p-4">
        <span aria-hidden className="text-2xl text-brand">✓</span>
        <p className="font-semibold text-brand-strong">Kept safe. The $2,500 never left her account.</p>
      </div>
    </figure>
  );
}

function Pillars({ title, items, n }: { title: string; items: readonly (readonly [string, string])[]; n: string }) {
  return (
    <div>
      <Eyebrow n={n}>{title}</Eyebrow>
      <dl className="mt-4 divide-y divide-line border-y border-line">
        {items.map(([t, d]) => (
          <div key={t} className="py-4">
            <dt className="text-lg font-semibold text-ink">{t}</dt>
            <dd className="mt-1 leading-relaxed text-ink-2">{d}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-4 py-10 sm:px-6 sm:py-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <Eyebrow>PayPal AI Hackathon · 2026 · Scam protection</Eyebrow>
          <h1 className="mt-5 font-serif text-5xl font-medium leading-[1.05] tracking-tight sm:text-6xl">
            A pause between <em className="text-brand">send</em> and <em className="text-alert">gone.</em>
          </h1>
          <p className="mt-6 max-w-xl text-xl leading-relaxed text-ink-2">
            When a scammer talks you into sending money yourself, fraud systems stay silent. SureSend holds the payment in PayPal until an AI check-in and the people you trust say it is safe.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/judge" className={button.primary}>
              Try the demo
              <span aria-hidden>→</span>
            </Link>
            <Link href="/send" className={button.secondary}>
              Send money as Nana
            </Link>
          </div>
          <Link href="/family" className="mt-5 inline-block font-semibold text-brand underline underline-offset-4">
            See the family dashboard
          </Link>
        </div>
        <Example />
      </section>

      <section aria-label="Why it matters" className="grid gap-6 border-y border-line py-8 sm:grid-cols-3">
        {STATS.map(([value, label]) => (
          <div key={label}>
            <p className="font-serif text-4xl font-medium text-ink">{value}</p>
            <p className="mt-1 text-ink-2">{label}</p>
          </div>
        ))}
        <p className="text-sm text-muted sm:col-span-3">Source: Canadian Anti-Fraud Centre. In these scams the victim sends the money, so the bank sees a normal payment.</p>
      </section>

      <section id="how" className="scroll-mt-24">
        <Eyebrow n="01">How it works</Eyebrow>
        <h2 className="mt-3 max-w-2xl font-serif text-4xl font-medium tracking-tight">Four steps between the scammer and the money.</h2>
        <ol className="mt-8 grid gap-x-10 gap-y-2 sm:grid-cols-2">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-4 border-t border-line py-5">
              <span className="font-mono text-sm text-brand">0{i + 1}</span>
              <div>
                <h3 className="text-xl font-semibold text-ink">{title}</h3>
                <p className="mt-1 leading-relaxed text-ink-2">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-10 md:grid-cols-2">
        <Pillars n="02" title="PayPal is the safety mechanism" items={PAYPAL} />
        <Pillars n="03" title="AI that asks, rules that decide" items={AI} />
      </section>

      <section className="flex flex-col items-start gap-5 rounded-2xl bg-ink p-8 text-paper sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div>
          <h2 className="font-serif text-3xl font-medium">See it stop a scam in three minutes.</h2>
          <p className="mt-2 text-paper/80">Judge Mode plays the grandparent scam, a fake CRA threat and a normal rent payment on the PayPal sandbox.</p>
        </div>
        <Link href="/judge" className="inline-flex min-h-12 shrink-0 items-center rounded-full bg-paper px-6 py-3 text-lg font-semibold text-ink hover:bg-sunk">
          Open Judge Mode
        </Link>
      </section>
    </main>
  );
}
