"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; text: string };

async function post(url: string, body?: BodyInit, json = true) {
  const res = await fetch(url, { method: "POST", body, headers: json && body ? { "Content-Type": "application/json" } : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Your money stays held.");
  return data;
}

export function CheckinChat({ holdId, sample }: { holdId: string; sample?: { label: string } }) {
  const router = useRouter();
  const base = `/api/holds/${holdId}/checkin`;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    post(base)
      .then((data) => setTurns(data.transcript))
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [base]);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [turns]);

  async function run(step: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await step();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const send = () =>
    run(async () => {
      const text = draft.trim();
      if (!text) return;
      setTurns((t) => [...t, { role: "user", text }]);
      setDraft("");
      const data = await post(`${base}/messages`, JSON.stringify({ text }));
      setTurns((t) => [...t, { role: "assistant", text: data.reply }]);
      setDone(data.done);
    });

  const attach = (file: File | "sample") =>
    run(async () => {
      let data;
      if (file === "sample") {
        data = await post("/api/judge/sample-evidence", JSON.stringify({ holdId }));
      } else {
        const form = new FormData();
        form.append("file", file);
        data = await post(`${base}/evidence`, form, false);
      }
      const note = data.read ? `I've read your ${data.kind === "voicemail" ? "voicemail" : "screenshot"}. Thank you.` : data.message;
      setTurns((t) => [...t, { role: "user", text: `(Added a ${data.kind ?? "file"})` }, { role: "assistant", text: note }]);
    });

  const finish = () =>
    run(async () => {
      await post(`${base}/finish`);
      router.refresh();
    });

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4">
      <h3 className="text-lg font-semibold text-stone-900">A few quick questions</h3>
      <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto" aria-live="polite">
        {turns.map((turn, i) => (
          <p
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-lg leading-relaxed ${
              turn.role === "assistant" ? "self-start bg-stone-100 text-stone-900" : "self-end bg-emerald-700 text-white"
            }`}
          >
            {turn.text}
          </p>
        ))}
        {busy && <p className="self-start text-stone-500">Thinking...</p>}
        <div ref={endRef} />
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-red-900">{error}</p>}

      {!done && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label className="sr-only" htmlFor="answer">Your answer</label>
          <input
            id="answer"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
            placeholder="Type your answer"
            className="min-w-0 flex-1 rounded-xl border-2 border-stone-300 px-4 py-3 text-lg focus:border-emerald-700 focus:outline-none"
          />
          <button disabled={busy || !draft.trim()} className="rounded-xl bg-emerald-700 px-5 py-3 text-lg font-semibold text-white disabled:opacity-50">
            Send
          </button>
        </form>
      )}

      <label className={`cursor-pointer text-center text-emerald-800 underline underline-offset-4 ${busy ? "pointer-events-none opacity-50" : ""}`}>
        Add a screenshot or voicemail
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,audio/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) attach(file);
          }}
        />
      </label>

      {sample && (
        <button onClick={() => attach("sample")} disabled={busy} className="text-center text-emerald-800 underline underline-offset-4 disabled:opacity-50">
          Share the {sample.label} (demo)
        </button>
      )}

      <button
        onClick={finish}
        disabled={busy || turns.length < 2}
        className={`rounded-xl px-5 py-4 text-lg font-semibold disabled:opacity-50 ${done ? "bg-emerald-700 text-white" : "border-2 border-stone-300 text-stone-900"}`}
      >
        {done ? "Check this payment" : "I've told you everything"}
      </button>
    </section>
  );
}
