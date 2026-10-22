"use client";

import { useState } from "react";

type Option = { id: string; label: string };
export type SendDefaults = { payeeId?: string; amount?: string; purpose?: string; namedMemberId?: string; story?: string; scenario?: string };

const PURPOSES = [
  ["family", "For family"],
  ["bills", "Bills or rent"],
  ["shopping", "Shopping"],
  ["other", "Something else"],
] as const;

const field = "w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-3 text-lg focus:border-emerald-700 focus:outline-none";

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
        <span className="text-lg font-medium text-stone-900">Who are you paying?</span>
        <select name="payeeId" defaultValue={defaults.payeeId} className={field} required>
          {payees.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-lg font-medium text-stone-900">How much? (CAD)</span>
        <input name="amount" inputMode="decimal" defaultValue={defaults.amount} placeholder="0.00" className={field} required />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-medium text-stone-900">What is it for?</legend>
        <div className="grid grid-cols-2 gap-2">
          {PURPOSES.map(([value, label]) => (
            <label key={value} className={`cursor-pointer rounded-xl border-2 px-4 py-3 text-center text-lg ${purpose === value ? "border-emerald-700 bg-emerald-50 font-semibold" : "border-stone-300 bg-white"}`}>
              <input type="radio" name="purpose" value={value} checked={purpose === value} onChange={() => setPurpose(value)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {purpose === "family" && (
        <label className="flex flex-col gap-2">
          <span className="text-lg font-medium text-stone-900">Which family member is it for?</span>
          <select name="namedMemberId" defaultValue={defaults.namedMemberId} className={field}>
            {family.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-2">
        <span className="text-lg font-medium text-stone-900">In your own words, what is this for?</span>
        <textarea name="story" rows={3} defaultValue={defaults.story} className={field} />
      </label>
      {error && <p className="rounded-xl bg-red-50 p-3 text-red-900">{error}</p>}
      <p className="text-stone-600">Next, you&apos;ll approve this in PayPal. Your money will be <strong>held, not sent</strong>, until it&apos;s checked.</p>
      <button disabled={busy} className="rounded-xl bg-emerald-700 px-5 py-4 text-lg font-semibold text-white disabled:opacity-50">
        {busy ? "Opening PayPal..." : "Continue to PayPal"}
      </button>
    </form>
  );
}
