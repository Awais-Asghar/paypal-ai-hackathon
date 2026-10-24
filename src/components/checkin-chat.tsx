"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { button, card, field } from "@/components/ui";

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

  // Braces matter: newer Chrome returns a Promise from scrollIntoView, and an effect may only return a cleanup function.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

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
    <section className={`${card} flex flex-col gap-4`}>
      <div>
        <h3 className="font-serif text-2xl font-medium">A few quick questions</h3>
        <p className="mt-1 text-muted">SureSend&apos;s safety assistant. Your money stays held while we talk.</p>
      </div>
      <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto" aria-live="polite">
        {turns.map((turn, i) => (
          <p
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-lg leading-relaxed ${
              turn.role === "assistant" ? "self-start rounded-bl-sm bg-sunk text-ink" : "self-end rounded-br-sm bg-brand text-white"
            }`}
          >
            {turn.text}
          </p>
        ))}
        {busy && (
          <p role="status" className="self-start text-muted">
            Thinking...
          </p>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-alert-soft p-3 text-alert">
          {error}
        </p>
      )}

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
            className={`${field} min-w-0 flex-1`}
          />
          <button disabled={busy || !draft.trim()} className={button.brand}>
            Send
          </button>
        </form>
      )}

      <label className={`cursor-pointer text-center font-semibold text-brand underline underline-offset-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand ${busy ? "pointer-events-none opacity-50" : ""}`}>
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
        <button onClick={() => attach("sample")} disabled={busy} className="text-center font-semibold text-brand underline underline-offset-4 disabled:opacity-50">
          Share the {sample.label} (demo)
        </button>
      )}

      <button
        onClick={finish}
        disabled={busy || turns.length < 2}
        className={done ? button.primary : button.secondary}
      >
        {done ? "Check this payment" : "I've told you everything"}
      </button>
    </section>
  );
}
