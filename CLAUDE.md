# CLAUDE.md

Guide for AI coding agents working in this repository.

## Read first

1. **[RULES.md](RULES.md): hard rules.** No `git push`, no deleting anything, and no publishing without the owner's explicit permission each time. Never commit secrets. Sandbox only.
2. [ARCHITECTURE.md](ARCHITECTURE.md): architecture, money flow, **safety rules enforced in code**, stack and timeline.
3. [IDEAS.md](IDEAS.md): product spec for **HoldOn** (the chosen and only idea): a circuit breaker for scam payments.
4. [docs/DEMO_PLAN.md](docs/DEMO_PLAN.md): demo video script and judge access plan. Several features exist because of it.
5. [docs/HACKATHON.md](docs/HACKATHON.md): requirements, judging criteria, prizes, sponsor tools, submission checklist.
6. [docs/WEBINAR_TRANSCRIPTS.md](docs/WEBINAR_TRANSCRIPTS.md): the four official webinars (key takeaways at the top).

## What this project is

**HoldOn**, an entry for the **PayPal AI Hackathon** ("Build what's next with PayPal and AI"), hosted on Devpost. HoldOn holds a scam-prone payment as a PayPal authorization, runs an AI check-in, and verifies the named family member through Log In with PayPal. Then it either captures and pays out to the verified payee only, or voids. Solo build.

- **Never weaken the safety rules** in ARCHITECTURE.md (pay only the verified payee, fail safe, hard red flags override the LLM, the LLM never calls PayPal money-moving endpoints directly).
- Sandbox checks: `node --env-file=.env scripts/sandbox-check.mjs <token|search|webhooks|payouts|authorize|login|all>`.

- **Deadline:** Nov 12, 2026, 12:00 pm PT.
- **Hard requirement:** PayPal *and* AI must both be central. A bolted-on PayPal button fails.
- **Judging:** five equally weighted criteria: technical implementation, design, impact, innovation, presentation.
- **Deliverables:** public repo with a LICENSE, working demo (hosted URL or full run instructions), a YouTube demo video under 3 minutes, and a written description plus tools list.

## How to work here

- **Before writing PayPal code**, use the PayPal AI Toolkit skill (`paypal-best-practices`) and/or the APIMatic Context Plugin. Don't rely on memory of PayPal APIs, because older v1 patterns are deprecated.
  - Using the APIMatic plugin also qualifies the project for the APIMatic prize. Note when it was used.
- For any other library or SDK docs, use Context7.
- Keep the agent's money-moving actions behind one policy/approval gate, with an idempotency key (`PayPal-Request-Id`) and an audit log (see ARCHITECTURE.md design principles).
- Webhooks are the source of truth for payment state. Always verify webhook signatures.
- Make the demo deterministic: seed scripts plus a "simulate next event" control.
- Match the existing code style. Keep comments sparse and useful.
- Small, verifiable steps. Run the app or tests before saying something works.

## PayPal sandbox facts and gotchas

- Base URL: `https://api-m.sandbox.paypal.com`. Credentials are a client ID (public) and a client secret (server only).
- OAuth tokens expire after about 8–9 hours. Cache them and refresh on 401. For the AI Toolkit MCP use `/paypal:setup refresh`.
- Business sandbox account = merchant (receives). Personal sandbox account = buyer (pays). Create both **in the same country**.
- Enable **Transaction Search** in the app settings. Settings changes take 10–15 minutes.
- Webhooks: tunnel localhost (ngrok or Cloudflare Tunnel) and subscribe to all events. Respond 2xx, or PayPal retries up to 25 times over 3 days. Webhooks are per app, per environment.
- Debug in Developer Dashboard → Event logs (API calls, webhook events with resend, error logs) and Sandbox notifications. Select the app first.
- Test unhappy paths: declines, failed renewals, refunds, disputes.
- Some products (Store Sync, parts of agentic commerce) are gated behind business review. Don't depend on them.

## Useful commands and tools

- PayPal AI Toolkit (Claude Code): `/plugin install paypal@claude-plugins-official`, then `/paypal:setup`, `/paypal:sandbox`, `/paypal:test-accounts`, `/paypal:explain-error <code>`, `/paypal:doctor`
- Sandbox token: `curl -X POST https://api-m.sandbox.paypal.com/v1/oauth2/token -u "$PAYPAL_CLIENT_ID:$PAYPAL_CLIENT_SECRET" -d grant_type=client_credentials`
- PayPal examples: https://github.com/paypal-examples/docs-examples
- AG Grid + PayPal boilerplate: https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate
- Postman collections: https://www.postman.com/paypal

## Git

- Remote: `origin` → https://github.com/Awais-Asghar/paypal-ai-hackathon (public).
- **Nothing is pushed without permission** (RULES.md §1).
- Commit locally with clear messages and report each commit to the owner.
