"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded-xl border-2 border-stone-300 bg-white px-4 py-2 font-semibold text-stone-900 hover:border-stone-500"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
