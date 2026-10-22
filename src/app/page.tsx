const STEPS = [
  ["Hold, don't send", "Your payment is authorized in PayPal, so the money is reserved but not moved."],
  ["A friendly check-in", "SureSend asks a few gentle questions and reads the message or voicemail for scam signs."],
  ["Is this really you?", "If the story names a family member, they confirm by logging in with their own PayPal. A voice clone can't."],
  ["Release or void", "Approved payments go only to the verified person. Anything else is cancelled and the money never leaves."],
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">SureSend</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight text-stone-900 sm:text-5xl">A pause between &ldquo;send&rdquo; and &ldquo;gone.&rdquo;</h1>
        <p className="mt-4 text-lg leading-relaxed text-stone-600">
          When a scammer convinces you to send money yourself, fraud systems stay silent. SureSend holds the payment through PayPal until an AI check-in and the people you trust say it is safe.
        </p>
      </header>
      <ol className="grid gap-4">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="flex gap-4 rounded-2xl border border-stone-200 bg-white p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 font-semibold text-white">{i + 1}</span>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
              <p className="mt-1 leading-relaxed text-stone-600">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-sm text-stone-500">Built for the PayPal AI Hackathon. Runs on the PayPal sandbox only; no real money moves.</p>
    </main>
  );
}
