import Link from "next/link";
import type { ReactNode } from "react";

// Shared look for every page. Buttons are at least 48px tall: the main users are older adults on phones.

const base = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-lg font-semibold transition-colors disabled:opacity-50";
export const button = {
  primary: `${base} bg-ink text-paper hover:bg-ink-2`,
  secondary: `${base} border border-line-strong bg-surface text-ink hover:border-ink`,
  brand: `${base} bg-brand text-white hover:bg-brand-strong`,
  paypal: `${base} bg-paypal text-white hover:bg-paypal-strong`,
  danger: `${base} bg-alert text-white hover:brightness-95`,
  dangerOutline: `${base} border-2 border-alert/40 bg-surface text-alert hover:border-alert`,
  small: "inline-flex min-h-10 items-center rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:border-ink",
};

export const card = "rounded-xl border border-line bg-surface p-5";
export const field = "w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-lg text-ink placeholder:text-muted focus:border-brand focus:outline-none";

/** Small mono label above a heading, with a number ("01") or a dot. */
export function Eyebrow({ children, n, tone = "brand" }: { children: ReactNode; n?: string; tone?: "brand" | "alert" }) {
  const color = tone === "alert" ? "text-alert" : "text-brand";
  return (
    <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
      {n ? <span className={`mr-3 ${color}`}>{n}</span> : <span aria-hidden className={`mr-3 ${color}`}>●</span>}
      {children}
    </p>
  );
}

/** The mark: a paper plane (send) inside a protective frame, next to a pause. Same drawing as src/app/icon.svg. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <g fill="none" stroke="var(--color-brand)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 28V21a11 11 0 0 1 11-11h21c3.6 0 5.6 1.3 8 4.2l4.6 5.8" />
        <path d="M9 36v7a11 11 0 0 0 11 11h21c3.6 0 5.6-1.3 8-4.2l4.6-5.8" />
      </g>
      <path d="M19 19.5 39.5 32 19 44.5l3.6-9.3L33.5 32l-10.9-3.2z" fill="var(--color-brand)" stroke="var(--color-brand)" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="42.2" y="24.5" width="4.6" height="15" rx="2.3" fill="var(--color-alert)" />
      <rect x="49.4" y="24.5" width="4.6" height="15" rx="2.3" fill="var(--color-alert)" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" aria-label="SureSend home" className="flex items-center gap-2.5 font-serif text-2xl font-medium tracking-tight text-ink">
      <LogoMark />
      <span>
        SureSend<span className="text-brand">.</span>
      </span>
    </Link>
  );
}

const NAV = [
  ["/#how", "How it works"],
  ["/send", "Send"],
  ["/family", "Family"],
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 text-sm font-medium text-ink-2 sm:gap-2 sm:text-base">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="hidden rounded-full px-3 py-2 hover:bg-sunk sm:inline-flex">
              {label}
            </Link>
          ))}
          <Link href="/judge" className="rounded-full bg-ink px-4 py-2 text-paper hover:bg-ink-2">
            Try the demo
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>PayPal sandbox only: no real money moves. Built for the PayPal AI Hackathon.</p>
        <a href="https://github.com/Awais-Asghar/paypal-ai-hackathon" className="font-medium text-ink-2 underline underline-offset-4">
          Source on GitHub
        </a>
      </div>
    </footer>
  );
}

/** Page body. Narrow for the phone-first screens Nana and Ethan use, wide for dashboards. */
export function Page({ children, width = "narrow" }: { children: ReactNode; width?: "narrow" | "wide" }) {
  const max = width === "wide" ? "max-w-5xl" : "max-w-md";
  return <main className={`mx-auto flex w-full ${max} flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10`}>{children}</main>;
}

export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <p role="status" className="text-lg text-muted">
      {label}
    </p>
  );
}
