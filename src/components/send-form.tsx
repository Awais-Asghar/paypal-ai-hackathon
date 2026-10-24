"use client";

import { useState } from "react";
import { button, field } from "@/components/ui";

type Option = { id: string; label: string };
export type SendDefaults = { payeeId?: string; amount?: string; purpose?: string; namedMemberId?: string; story?: string; scenario?: string };

const PURPOSES = [
  ["family", "For family"],
  ["bills", "Bills or rent"],
  ["shopping", "Shopping"],
  ["other", "Something else"],
] as const;

export function SendForm({ circleId, payees, family, defaults }: { circleId: string; payees: Option[]; family: Option[]; defaults: SendDefaults }) {
  const [purpose, setPurpose] = useState(defaults.purpose ?? "bills");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setError(null);
    const amountCents = Math.round(Number(String(form.get("amount")).replace(/[$,\s]/g, "")) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) return setError("Please enter an amount, like 250.00");
    setBusy(true);
    try {
      const res = await fetch("/api/holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          circleId,
          payeeId: form.get("payeeId"),
          amountCents,
          purpose,
          namedMemberId: purpose === "family" ? form.get("namedMemberId") || null : null,
          story: String(form.get("story") ?? "").trim() || null,
          scenario: defaults.scenario ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Nothing was sent.");
      window.location.href = data.approveUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-lg font-semibold text-ink">Who are you paying?</span>
        <select name="payeeId" defaultValue={defaults.payeeId} className={field} required>
          {payees.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-lg font-semibold text-ink">How much? (CAD)</span>
        <input name="amount" inputMode="decimal" defaultValue={defaults.amount} placeholder="0.00" className={field} required />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-semibold text-ink">What is it for?</legend>
        <div className="grid grid-cols-2 gap-2">
          {PURPOSES.map(([value, label]) => (
            <label key={value} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 px-4 py-3 text-center text-lg has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand ${purpose === value ? "border-brand bg-brand-soft font-semibold text-brand-strong" : "border-line-strong bg-surface text-ink"}`}>
              <input type="radio" name="purpose" value={value} checked={purpose === value} onChange={() => setPurpose(value)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {purpose === "family" && (
        <label className="flex flex-col gap-2">
          <span className="text-lg font-semibold text-ink">Which family member is it for?</span>
          <select name="namedMemberId" defaultValue={defaults.namedMemberId} className={field}>
            {family.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-2">
        <span className="text-lg font-semibold text-ink">In your own words, what is this for?</span>
        <textarea name="story" rows={3} defaultValue={defaults.story} className={field} />
      </label>
      {error && <p role="alert" className="rounded-xl bg-alert-soft p-3 text-alert">{error}</p>}
      <p className="text-ink-2">Next, you&apos;ll approve this in PayPal. Your money will be <strong>held, not sent</strong>, until it&apos;s checked.</p>
      <button disabled={busy} className={button.paypal}>
        {busy ? "Opening PayPal..." : "Continue to PayPal"}
      </button>
    </form>
  );
}
