# Architecture & Project Plan

> **Status:** ideation. No idea chosen yet; candidates are in [IDEAS.md](IDEAS.md).
> This file holds the baseline architecture that every shortlisted idea shares. When an idea is chosen, fill in the **Chosen project** section and adjust the rest.

## Chosen project

| Field | Value |
|---|---|
| Name | _TBD_ |
| One-line pitch | _TBD_ |
| Target user | _TBD_ |
| Problem | _TBD_ |
| Prize targets | _TBD_ (one Grand or Honorable Mention + one Sponsor prize) |
| Demo "wow" moment | _TBD_ |

## Baseline architecture

```
                 ┌─────────────────────────────── Web app (Next.js / React) ──────────────────────────────┐
  User ─────────►│  UI · chat with the agent · PayPal JS SDK v6 buttons/approval · sponsor UI components   │
                 └───────────────┬────────────────────────────────────────────────────────────▲──────────┘
                                 │ HTTPS (REST / server actions)                               │ live updates (SSE)
                 ┌───────────────▼────────────────────────── Backend (Node.js + TypeScript) ───┴──────────┐
                 │                                                                                        │
                 │  Agent runtime ──► LLM (Claude API, tool use)                                          │
                 │     │   system prompt + guardrails + structured outputs                                │
                 │     ▼                                                                                  │
                 │  Tool layer (typed functions the agent may call)                                       │
                 │     ├─ PayPal tools ──► PayPal Server SDK / REST v2 (sandbox)                          │
                 │     │                    Orders · Payments · Subscriptions · Payouts · Invoicing ·     │
                 │     │                    Disputes · Vault · Transaction Search                         │
                 │     ├─ Domain tools (DB reads/writes, scheduling, notifications)                       │
                 │     └─ Sponsor tools (Channel3 search, Elastic retrieval, …)                           │
                 │                                                                                        │
                 │  Policy / approval gate ── every money-moving tool call is checked and logged          │
                 │  Webhook receiver ── verify PayPal signature → idempotent event handler → agent       │
                 │  Jobs / scheduler (Render Workflows or cron) ── cycle runs, reminders, reconciliation  │
                 └───────────────┬───────────────────────────────▲────────────────────────────────────────┘
                                 │                               │ webhooks (POST, retried up to 25×/3 days)
                          ┌──────▼──────┐                 ┌──────┴───────────┐
                          │  Postgres / │                 │  PayPal sandbox  │
                          │  SQLite     │                 │  api-m.sandbox.  │
                          └─────────────┘                 │  paypal.com      │
                                                          └──────────────────┘
```

### Design principles

1. **The agent never holds money and never sees secrets.** It calls typed tools, the tools call PayPal, and credentials stay on the server.
2. **Every money-moving action goes through one gate.** A policy check, an optional human approval, an idempotency key (`PayPal-Request-Id`) and an audit-log row. That gate is what makes an "AI that moves money" safe, and the demo should show it.
3. **Webhooks are the source of truth** for payment state. The UI and agent react to verified events, not to browser callbacks.
4. **Sandbox and live are configuration only:** `PAYPAL_BASE_URL`, `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. No code changes.
5. **Demo mode is deterministic.** Seed scripts create sandbox data, and a "simulate next cycle/event" control exists, so the 3-minute video never waits on real time.

### Proposed stack (to confirm once the idea is chosen)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + React + Tailwind | Fast to build, deploys on Render |
| Payments UI | PayPal JS SDK v6 | Current PayPal-recommended SDK |
| Backend | Node.js + TypeScript (Next.js route handlers or a separate service) | Matches PayPal Server SDK + Agent Toolkit (TS) |
| PayPal | PayPal Server SDK (TS) + REST for anything the SDK doesn't cover | The SDK doesn't cover every API (Payouts, Invoicing, Disputes are REST) |
| AI | Claude API with tool use (e.g. `claude-sonnet-5-5` for the agent loop, `claude-opus-5-5` for hard reasoning steps) | Strong tool calling; any model is allowed |
| Agent tooling | PayPal Agent Toolkit (where it fits) + our own typed tools | Counts toward "meaningful PayPal + AI" |
| Data | Postgres on Render (SQLite locally) | Simple and free tier |
| Jobs | Render Workflows or cron worker | Cycle runs, reminders, reconciliation; Render prize eligibility |
| Tunneling (dev) | ngrok or Cloudflare Tunnel | Webhooks to localhost |
| Sponsor UI | Bryntum Scheduler/Calendar **or** AG Studio (depends on idea) | Sponsor prize |
| Dev tooling | PayPal AI Toolkit plugin, APIMatic Context Plugin, Postman PayPal collections | Correct APIs plus APIMatic prize eligibility |

### Environment variables (`.env.example`)

```
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
ANTHROPIC_API_KEY=
DATABASE_URL=
APP_BASE_URL=http://localhost:3000
```

### Repository layout (planned)

```
/
├─ CLAUDE.md             # agent guide (read first)
├─ RULES.md              # hard rules (no push/delete without permission, secrets, sandbox only)
├─ ARCHITECTURE.md       # this file
├─ IDEAS.md              # brainstorm + scoring
├─ README.md             # judge-facing: pitch, demo link, setup, test credentials
├─ LICENSE               # MIT (shows in GitHub About)
├─ docs/
│  ├─ HACKATHON.md       # rules, prizes, judging, sponsors, checklist
│  └─ WEBINAR_TRANSCRIPTS.md
└─ app/                  # source (created once the idea is chosen)
```

## Timeline (Oct 21 → Nov 12, 12:00 pm PT)

| Window | Goal |
|---|---|
| Oct 21–23 | Pick the idea. Sandbox accounts and apps. Install AI Toolkit + APIMatic plugin. Run the week-1 feasibility checks in IDEAS.md |
| Oct 24–31 | Core money flows end to end in the sandbox (create → approve → webhook → state). Agent with PayPal tools |
| Nov 1–5 | Product UI, sponsor component, approval gate, unhappy paths (failures, refunds) |
| Nov 6–8 | Deploy (Render). Seed and demo mode. README with judge setup and test logins. **Feature freeze** |
| Nov 9–10 | Script, record and edit the demo video (<3:00). Write the Devpost story and tools list |
| Nov 11 | Buffer, final checks, submit (with owner approval) |
| Nov 12, 12:00 pm PT | **Hard deadline** |
