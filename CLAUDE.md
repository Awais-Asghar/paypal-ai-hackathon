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

## Current status (updated 2026-10-23)

**Phase:** foundation, AI check-in, Send page and Judge Mode built (PR #1, reviewed and fast-forwarded into local `main` on 2026-10-23). Next: run the full flow against the real sandbox on the owner's machine, then the family dashboard with sign-in, email delivery for the outbox, the aftercare text, and deployment to Render. Feature freeze Nov 6.

**Built (2026-10-22), all checks pass (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`):**
- Next.js 16 app (App Router, Tailwind, Cache Components on). DB-reading pages call `await connection()` inside `<Suspense>`.
- Drizzle schema and migration in `drizzle/`; `src/lib/db` picks PGlite or node-postgres from `DATABASE_URL`. `npm run seed` creates the Collins family circle.
- `src/lib/paypal/client.ts`: sandbox-only REST client (token cache, refresh on 401, required `PayPal-Request-Id`, webhook signature postback, Log In with PayPal).
- `src/lib/risk/rules.ts`: hard red flags and `combineRisk` (model can raise risk, never lower the rule floor; no verdict means at least MEDIUM).
- `src/lib/gate/`: state machine plus the Payment Gate, the only code that changes hold state or moves money. Row-locked transitions with audit rows, fixed per-hold request IDs, `sweep()` for cooling-off, expiry voids and retries.
- Routes: create hold, PayPal return/cancel, assess (rules only for now), webhook, cron sweep, Judge skip-cooling-off, Log In with PayPal `/callback`, and the "Is this really you?" page at `/verify/[token]`.
- AI check-in (2026-10-22): `src/lib/ai/` (Gemini and Groq JSON clients with fallback, check-in agent, Whisper transcription), `src/lib/checkin/service.ts`, chat UI on `/holds/[id]`, routes under `/api/holds/[id]/checkin`. The agent asks scripted scam-exposing questions (AI-phrased, script fallback), reads screenshots and voicemails, and returns a structured verdict that only reaches the gate. Hard rules see the person's answers, the story and the evidence, never the agent's questions. Instructions aimed at the AI are a HIGH red flag. Verification links are written to the `outbox` table, addressed only to the saved contact.
- Send page and Judge Mode (2026-10-22): `/send` (Nana's form; `?scenario=` prefills it in Judge Mode), `/judge` (scenarios, sandbox logins, family phones, live PayPal authorization status, run scheduler, reset demo), `/judge/phone/[memberId]` (reads the outbox), "Stop this payment" on `/holds/[id]`. Scenarios live in `src/lib/demo/scenarios.ts`. `JUDGE_MODE` is read per request (inside Suspense), never at build time. Reset voids open authorizations through the gate first and keeps any hold PayPal would not void.
- Live-tested on the owner's machine (2026-10-23) with the branch's own code: Groq `openai/gpt-oss-120b` (about 1 s per call; grandparent scam HIGH, rent LOW, sensible follow-up questions), Groq Whisper (sample voicemail transcribed word for word in 0.5 s), and Gemini `gemini-flash-lite-latest` (chat, verdicts and screenshot reading of a fake CRA text, 1 to 3 s). `gemini-3.8-flash` returned 503 "high demand" or hung on both keys that day, so Groq now goes first for text (`LLM_PROVIDER=groq`, the default), each Gemini key falls back to `GEMINI_FALLBACK_MODEL` (`gemini-flash-lite-latest`), and each model gets 12 s before the next one is tried. Live through the app's real chain (2026-10-24): chat about 1 s, verdict about 1.3 s, screenshot about 9 s.
- Fixed 2026-10-24: Nana can press "Stop this payment" during the check-in (HELD and ASSESSING), not only later; `decide()` and `answerVerification()` re-check the hold's state under the row lock, so a stop or answer can't land on a hold that is already being paid out; route redirects use a relative `Location` (`backTo` in `src/lib/http.ts`), because `request.url` carries the server's own host (localhost in dev, an internal address behind Render's proxy). 48 tests.
- LLM_PROVIDER=anthropic is not implemented. Known trade-off: hard rules can match negated answers ("they didn't say keep it secret"), which raises risk; this is the safe direction.
- Verified in the sandbox (2026-10-23): payouts with `recipient_type: PAYPAL_ID` to Ethan's payer_id (batch `E25Z6ST7SP3UQ`, 1.00 CAD, SUCCESS).
- **Full app flow verified live (2026-10-24)** in Chrome against the real sandbox and live AI: grandparent scam $2,500 (Margaret approves, check-in with sample voicemail, HIGH, "Is this really you?" to Ethan, Ethan logs in with PayPal, payer_id matched, "not me", authorization VOIDED) and rent $900 (one question, LOW, CAPTURED, payout to Robert SUCCESS). Judge Mode now shows a live Payout column. Fixed on the way: the check-in chat crashed in current Chrome (its scroll effect returned the Promise that `scrollIntoView` now returns).
- Family dashboard and aftercare (2026-10-24): `/family` shows money kept safe, sent safely and waiting, the history with the AI's family summary plus the real outcome (from the hold's state, since the summary is written before the outcome), the circle with PayPal-verified members, and saved payees. It is read-only on purpose: there is no sign-in yet, so approvals happen only through the PayPal-verified "Is this really you?" link. `/holds/[id]/report` drafts a Canadian Anti-Fraud Centre report for any MEDIUM or HIGH risk hold (`src/lib/ai/report-writer.ts`, `src/lib/aftercare/`, table `reports`). The AI writes only the narrative; amounts, dates, outcome and the CAFC contacts (online reportcyberandfraud.canada.ca, phone 1-888-495-8501, checked 2026-10-24) come from the hold and fixed text, with a template fallback when no model answers. Verified live on the voided grandparent hold. 52 tests.
- Testing tip: use separate browser contexts (or a private window) for Margaret and Ethan, or PayPal reuses the last login. Orders set `brand_name: "SureSend"`, or the checkout would say "Test Store" (the app's default name).
- Tests need `hookTimeout: 30_000` (in `vitest.config.mts`): each test boots an in-memory PGlite, and on Windows that setup can pass the 10 s default when files run in parallel.

**Verified in the PayPal sandbox (Canada, CAD)** with `scripts/sandbox-check.mjs`:
- Token and scopes, Transaction Search, Webhooks API
- Order `intent=AUTHORIZE` → buyer approval → authorize → void (authorization `9UK966797J1895949`)
- Payouts to a personal account (batch `W3YARBZK4AA2Q`)
- Log In with PayPal → userinfo; match family members on `payer_id` (Ethan = `SMLTYXGPGSUYC`)
- Authorize → capture → payout through the app (2026-10-24, see above)
- Not yet run: webhook delivery (planned on the Render URL, so no tunnel is needed)

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
- AI (changed 2026-10-24): provider switch `LLM_PROVIDER` (default `groq`, so Groq `openai/gpt-oss-120b` answers text first in about 1 s). Gemini reads screenshots (Groq has no vision model) and backs up text: `gemini-3.8-flash`, then `gemini-flash-lite-latest`, on `GEMINI_API_KEY_Pro`, then `GEMINI_API_KEY_Plus`. Groq (`GROQ_API_KEY`) also does `whisper-large-v3-turbo` transcription and `llama-prompt-guard-2` injection screening.
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

## Next.js dev gotcha

- Keep `logging: { browserToTerminal: false }` in `next.config.ts`. With browser log forwarding on, `next dev` on Windows looped: every page load wrote to `.next/dev/logs/next-development.log`, which triggered a rebuild and a full page reload, so pages sat on "Loading..." and could not be clicked (2026-10-24). Production builds were not affected.

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
