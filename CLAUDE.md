# CLAUDE.md

Guide for AI coding agents working in this repository.

## Read first

All project docs live in [docs/](docs/). Only this file and README.md stay at the root: Claude Code loads CLAUDE.md from the root, and GitHub shows README.md on the repo page.

1. **[docs/RULES.md](docs/RULES.md): hard rules.** No `git push`, no deleting anything, and no publishing without the owner's explicit permission each time. Never commit secrets. Sandbox only.
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): architecture, money flow, **safety rules enforced in code**, stack and timeline.
3. [docs/PROJECT.md](docs/PROJECT.md): product spec for **SureSend**, a circuit breaker for scam payments.
4. [docs/DEMO_PLAN.md](docs/DEMO_PLAN.md): demo video script and judge access plan. Several features exist because of it.
5. [docs/PAYPAL_SETUP.md](docs/PAYPAL_SETUP.md): PayPal developer/sandbox setup and how to run the sandbox checks.
6. [docs/HACKATHON.md](docs/HACKATHON.md): requirements, judging criteria, prizes, sponsor tools, submission checklist.
7. [docs/WEBINAR_TRANSCRIPTS.md](docs/WEBINAR_TRANSCRIPTS.md): the four official webinars (key takeaways at the top).

## What this project is

**SureSend**, an entry for the **PayPal AI Hackathon** ("Build what's next with PayPal and AI"), hosted on Devpost. SureSend holds a scam-prone payment as a PayPal authorization, runs an AI check-in, and verifies the named family member through Log In with PayPal. Then it either captures and pays out to the verified payee only, or voids. Solo build.

- **Never weaken the safety rules** in docs/ARCHITECTURE.md (pay only the verified payee, fail safe, hard red flags override the LLM, the LLM never calls PayPal money-moving endpoints directly).
- Sandbox checks: `node --env-file=.env scripts/sandbox-check.mjs <token|search|webhooks|payouts|authorize|login|all>`.

- **Deadline:** Nov 12, 2026, 12:00 pm PT.
- **Hard requirement:** PayPal *and* AI must both be central. A bolted-on PayPal button fails.
- **Judging:** five equally weighted criteria: technical implementation, design, impact, innovation, presentation.
- **Deliverables:** public repo with a LICENSE, working demo (hosted URL or full run instructions), a YouTube demo video under 3 minutes, and a written description plus tools list.
- **Writing style:** no emojis and no em dashes anywhere (docs/RULES.md §7).

## Current status (updated 2026-10-22)

**Phase:** app foundation built. Next: the AI check-in agent (it plugs into `PaymentGate.assess`), verification-link delivery (outbox), the family dashboard with sign-in, Judge Mode and the PayPal live status panel. Feature freeze Nov 6.

**Built (2026-10-22), all checks pass (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`):**
- Next.js 16 app (App Router, Tailwind, Cache Components on). DB-reading pages call `await connection()` inside `<Suspense>`.
- Drizzle schema and migration in `drizzle/`; `src/lib/db` picks PGlite or node-postgres from `DATABASE_URL`. `npm run seed` creates the Collins family circle.
- `src/lib/paypal/client.ts`: sandbox-only REST client (token cache, refresh on 401, required `PayPal-Request-Id`, webhook signature postback, Log In with PayPal).
- `src/lib/risk/rules.ts`: hard red flags and `combineRisk` (model can raise risk, never lower the rule floor; no verdict means at least MEDIUM).
- `src/lib/gate/`: state machine plus the Payment Gate, the only code that changes hold state or moves money. Row-locked transitions with audit rows, fixed per-hold request IDs, `sweep()` for cooling-off, expiry voids and retries.
- Routes: create hold, PayPal return/cancel, assess (rules only for now), webhook, cron sweep, Judge skip-cooling-off, Log In with PayPal `/callback`, and the "Is this really you?" page at `/verify/[token]`.
- Unverified in the sandbox: payouts with `recipient_type: PAYPAL_ID` (family payouts go to the verified payer_id), and the full app flow against real PayPal.

**Verified in the PayPal sandbox (Canada, CAD)** with `scripts/sandbox-check.mjs`:
- Token and scopes, Transaction Search, Webhooks API
- Order `intent=AUTHORIZE` → buyer approval → authorize → void (authorization `9UK966797J1895949`)
- Payouts to a personal account (batch `W3YARBZK4AA2Q`)
- Log In with PayPal → userinfo; match family members on `payer_id` (Ethan = `SMLTYXGPGSUYC`)
- Not yet run: authorize → capture; webhook delivery through a tunnel

**Sandbox accounts** (emails live in `.env`):

| Account | Type | Role |
|---|---|---|
| SureSend Demo | Business | Platform: holds, captures, pays out |
| Margaret Collins ("Nana") | Personal, 5,000 CAD | Protected person |
| Ethan Collins | Personal | Real grandson; verifies and receives |
| Robert Hayes | Personal | Known payee (landlord) for the normal-payment scene |

The PayPal app shows as "HoldOn" in the dashboard list (page title SureSend); its keys are unchanged.

**Decisions made**
- Name: **SureSend** (renamed from HoldOn). Only idea; the old brainstorm is in git history only (`git show 4260579:IDEAS.md`).
- AI: provider switch `LLM_PROVIDER` (default `gemini`). Main model `gemini-3.8-flash` on the free tier (`GEMINI_API_KEY_Pro`, backup `GEMINI_API_KEY_Plus`). Groq (`GROQ_API_KEY`) for `whisper-large-v3-turbo` transcription, `openai/gpt-oss-120b` fallback chat and `llama-prompt-guard-2` injection screening. Groq has no vision model. Free-tier Gemini latency still needs measuring.
- Database: Postgres everywhere: PGlite locally (nothing to install), Render Postgres (paid Basic plan from the $50 Render credits) for the hosted demo, Drizzle ORM. Not Supabase: free projects pause after 7 days idle.
- Hosting: Render (sponsor prize), around Nov 5–6. Not Vercel.
- Log In with PayPal return URL is `http://127.0.0.1:3000/callback`; PayPal rejects `localhost` for it.

**Not done yet (owner side):** install the PayPal AI Toolkit plugin and the APIMatic Context Plugin (APIMatic prize eligibility).

## How to work here

- **Before writing PayPal code**, use the PayPal AI Toolkit skill (`paypal-best-practices`) and/or the APIMatic Context Plugin. Don't rely on memory of PayPal APIs, because older v1 patterns are deprecated.
  - Using the APIMatic plugin also qualifies the project for the APIMatic prize. Note when it was used.
- For any other library or SDK docs, use Context7.
- **Database work** (tables, column types, migrations, indexes, queries): load the `supabase-postgres-best-practices` skill first. It applies to any Postgres, including our PGlite and Render Postgres. `postgresql-best-practices` (Microsoft) is a secondary reference; ignore its Azure-only sections.
- **Drizzle ORM:** use Context7 for current docs. No Drizzle skill is installed on purpose.
- **Next.js:** follow the `AGENTS.md` / `CLAUDE.md` rules that `next dev` generates (Next.js 16.3+) and the bundled docs in `node_modules/next/dist/docs/`; `vercel-react-best-practices` covers React patterns.
- Keep the agent's money-moving actions behind one policy/approval gate, with an idempotency key (`PayPal-Request-Id`) and an audit log (see docs/ARCHITECTURE.md safety rules).
- Webhooks are the source of truth for payment state. Always verify webhook signatures.
- Make the demo deterministic: seed scripts plus a "simulate next event" control.
- Match the existing code style. Keep comments sparse and useful.
- Small, verifiable steps. Run the app or tests before saying something works.

## PayPal sandbox facts and gotchas

- Base URL: `https://api-m.sandbox.paypal.com`. Credentials are a client ID (public) and a client secret (server only).
- OAuth tokens expire after about 8–9 hours. Cache them and refresh on 401. For the AI Toolkit MCP use `/paypal:setup refresh`.
- Business sandbox account = merchant (receives). Personal sandbox account = buyer (pays). All of ours are in **Canada (CAD)**; never mix countries.
- The Log In with PayPal settings only stick when the privacy policy and user agreement URLs are filled in and the return URL uses `127.0.0.1`. Save inside the dialog and look for "Application was saved successfully".
- Sandbox checkout pages and their payment methods (a test Visa and a test bank) are fake. Always confirm the address is `sandbox.paypal.com`.
- Enable **Transaction Search** in the app settings. Settings changes take 10–15 minutes.
- **Cached tokens keep old scopes.** PayPal returns the same access token until it expires, so a feature enabled later won't appear in it. Request tokens with `grant_type=client_credentials&ignoreCache=true` after changing app features.
- The Payouts amount field is `currency`, not `currency_code` (Orders/Payments v2 use `currency_code`).
- Webhooks: tunnel localhost (ngrok or Cloudflare Tunnel) and subscribe to all events. Respond 2xx, or PayPal retries up to 25 times over 3 days. Webhooks are per app, per environment.
- Debug in Developer Dashboard → Event logs (API calls, webhook events with resend, error logs) and Sandbox notifications. Select the app first.
- Test unhappy paths: declines, failed renewals, refunds, disputes.
- Some products (Store Sync, parts of agentic commerce) are gated behind business review. Don't depend on them.

## Useful commands and tools

- PayPal AI Toolkit (Claude Code): `/plugin install paypal@claude-plugins-official`, then `/paypal:setup`, `/paypal:sandbox`, `/paypal:test-accounts`, `/paypal:explain-error <code>`, `/paypal:doctor`
- Sandbox token: `curl -X POST https://api-m.sandbox.paypal.com/v1/oauth2/token -u "$PAYPAL_CLIENT_ID:$PAYPAL_CLIENT_SECRET" -d "grant_type=client_credentials&ignoreCache=true"`
- PayPal examples: https://github.com/paypal-examples/docs-examples
- AG Grid + PayPal boilerplate: https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate
- Postman collections: https://www.postman.com/paypal

## Git

- Remote: `origin` → https://github.com/Awais-Asghar/paypal-ai-hackathon (public).
- **Nothing is pushed without permission** (docs/RULES.md §1). Before each push, check that `.env` isn't tracked and scan new commits for key patterns.
- Commit locally with clear messages and report each commit to the owner.
