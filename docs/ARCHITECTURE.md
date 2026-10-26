# Architecture & Project Plan: SureSend

> **Status (2026-10-21):** sandbox feasibility verified in Canada (authorize→void, payouts, Log In with PayPal, Transaction Search); AI keys verified (Gemini, Groq); database and hosting decided. Next: build the app. Product spec: [PROJECT.md](PROJECT.md). Demo plan: [DEMO_PLAN.md](DEMO_PLAN.md). Sandbox setup: [PAYPAL_SETUP.md](PAYPAL_SETUP.md).

## Chosen project

| Field | Value |
|---|---|
| Name | **SureSend** |
| One-line pitch | A pause between "send" and "gone": the money is held through PayPal until an AI check-in and your trusted family say it's safe |
| Target users | **Protected person:** seniors (later, newcomers and international students). **Trusted circle:** their family |
| Problem | Authorized push payment scams (voice-clone "family emergency", CRA/immigration threats, romance, tech support). The victim sends the money themselves, so fraud systems don't fire. Canada lost $704M to fraud in 2025 |
| Prize targets | One Grand Prize or one Honorable Mention (Most Impactful, Best Use of PayPal + AI, Best Demo Delivery) + one Sponsor Prize (Render or APIMatic) |
| Demo moment | The voice-clone "grandson" asks for $2,500. The money is held, the AI flags the scam, the real grandson verifies with Log In with PayPal and says "not me", the authorization is voided, and the screen shows "$2,500 kept safe" |
| Team | Solo |

## System overview

```
 Nana's phone (web app)          Ethan's phone (web app)           Family dashboard
 send · check-in chat            "Is this really you?" link        decisions · history
        │                                │                                │
        ▼                                ▼                                ▼
┌──────────────────────────────── SureSend backend (Node.js + TypeScript) ─────────────────────────────┐
│                                                                                                      │
│  Payment Gate (single choke point for all money movement)                                            │
│    create hold → assess → verify → decide → capture+payout │ void   (idempotent, audit-logged)       │
│                                                                                                      │
│  Check-in Agent (LLM, tool use)               Risk Engine                                            │
│    conversation · screenshot (vision) ·         rules (hard red flags) + LLM structured verdict      │
│    voicemail transcript · family summary        → LOW / MEDIUM / HIGH + reasons                      │
│                                                                                                      │
│  Identity Verifier                             Scheduler (Render cron/Workflows)                     │
│    Log In with PayPal (OIDC) → match the        cooling-off expiry · authorization expiry            │
│    saved family-circle record                    (auto-void before the 3-day honor period ends)      │
│                                                                                                      │
│  Webhook receiver: verify signature → idempotent handler → update state → push UI update (SSE)       │
└───────┬───────────────────────────────────────────────┬──────────────────────────────────────────────┘
        │ REST (sandbox)                                │
        ▼                                               ▼
  PayPal sandbox                                    Postgres (PGlite locally)
  Orders v2 (intent=AUTHORIZE) · Authorizations     circles · members · payees · holds ·
  (capture/void/reauthorize) · Payouts ·            checkins · verifications · decisions ·
  Log In with PayPal (identity) · Webhooks ·        audit_log
  Transaction Search
```

## Money flow

```
Nana taps "Send $2,500 to Ethan"
  │
  ├─► POST /v2/checkout/orders  {intent: AUTHORIZE, amount, custom_id: hold_id}  ──► Nana approves in PayPal popup (JS SDK)
  ├─► POST /v2/checkout/orders/{id}/authorize   → authorization CREATED (funds reserved, NOT moved)   [state: HELD]
  │
  ├─► Risk Engine + Check-in Agent              → LOW | MEDIUM | HIGH                                    [state: ASSESSING]
  │      LOW and known payee  ──────────────────────────────────────────────┐
  │      MEDIUM               → cooling-off timer (24h, skippable in demo)   │
  │      HIGH / family story  → "Is this really you?" + trusted-circle vote  │                           [state: VERIFYING]
  │                                                                         ▼
  ├─ APPROVED ─► POST /v2/payments/authorizations/{id}/capture   → funds to SureSend platform account
  │              POST /v1/payments/payouts  (receiver = the *verified* payee only)                       [state: RELEASED]
  │
  └─ DENIED / TIMEOUT / EXPIRING ─► POST /v2/payments/authorizations/{id}/void   → money never left       [state: VOIDED]
```

**Hold state machine:** `DRAFT → HELD → ASSESSING → (VERIFYING | COOLING_OFF) → APPROVED → RELEASED`, or `→ DENIED → VOIDED`. Only the Payment Gate may change state. Each transition writes an audit row.

## Safety rules (enforced in code, not in the prompt)

1. **Pay only the verified payee.** For a "family" purpose, the payout receiver must be the family member's PayPal account saved and verified at setup. A caller-supplied account means automatic HIGH risk, and the payout is refused.
2. **Never use caller-supplied contacts.** Verification links go only to contact details saved at setup.
3. **Fail safe.** Unknown, unreachable or erroring all mean the money stays held. A scheduled job voids authorizations before the 3-day honor period ends unless someone has approved.
4. **Hard red flags override the LLM.** Secrecy ("don't tell"), "no phone / new number", a different account, gift cards or crypto, and an urgency + bail/hospital/arrest combination each force at least HIGH, whatever the model's verdict.
5. **The LLM never calls PayPal directly.** The agent's tools are read-only plus `propose_decision`. Capture, void and payout run only in the Payment Gate after the rules and verification checks pass.
6. **Idempotency.** `PayPal-Request-Id` on every POST, and webhook events de-duplicated by event ID.

## AI design

| Piece | Model use | Output |
|---|---|---|
| Check-in conversation | LLM with tool use, warm and non-judgmental, plain language, the protected person's language | Next question or explanation |
| Evidence reading | Vision for screenshots; speech-to-text for voicemail audio | Extracted claims (who, what, urgency, secrecy, payment method, new contact) |
| Risk verdict | Structured output (JSON schema): `risk`, `scam_type`, `red_flags[]`, `reasons_plain[]` | Combined with hard rules → final risk |
| Family summary | Short summary for the trusted circle | One-screen card |
| Aftercare | Drafts a CAFC report text and dispute evidence | Pre-filled text |

**Agent tools (read-only + propose):** `get_hold`, `get_payee_history` (Transaction Search baseline), `get_circle`, `record_red_flag`, `request_verification`, `propose_decision`.

**Provider:** pluggable, chosen with `LLM_PROVIDER` in `.env`, so switching needs no code changes.
- Default for text: **Groq** `openai/gpt-oss-120b` (free; about 1 s per answer, JSON structured output). Groq also does voicemail transcription (Whisper).
- **Google Gemini** (free tier) reads screenshots, since Groq has no vision model, and backs up text. Each key tries `gemini-3.8-flash`, then `gemini-flash-lite-latest`, which stayed up when the main model returned 503 "high demand". Each model gets 12 s before the next is tried.
- `LLM_PROVIDER=gemini` puts Gemini first. An Anthropic provider is not implemented.

Verified 2026-10-21 on the free tiers: `gemini-3.8-flash` (JSON-schema output worked, rated the grandparent-scam test HIGH; latency on the free tier needs measuring), Groq `openai/gpt-oss-120b` (chat), `whisper-large-v3-turbo` (speech-to-text) and `llama-prompt-guard-2` (available for prompt-injection screening, not built yet; today a hard rule flags text aimed at the AI and scammer text is passed as untrusted). Groq has no vision model, so images go to Gemini. Model IDs live in `.env` (`GEMINI_MODEL`, `GROQ_CHAT_MODEL`, `GROQ_STT_MODEL`); `gemini-2.5-flash` is retired for new users. The safety rules above are enforced in code, so a smaller free model can't weaken them. Demo scenarios keep a cached fallback so the hosted demo still plays if the free tier is rate-limited.

## Data model (first cut)

- `circles` (id, protected_member_id)
- `members` (id, circle_id, role: protected|trusted, name, contact, paypal_user_id, paypal_email, verified_at)
- `payees` (id, circle_id, label, paypal_email, member_id?, known: bool)
- `holds` (id, circle_id, payee_id, amount, currency, purpose, state, paypal_order_id, paypal_authorization_id, risk, expires_at)
- `checkins` (id, hold_id, transcript, evidence refs, verdict json)
- `verifications` (id, hold_id, member_id, token, status, paypal_user_id_seen)
- `decisions` (id, hold_id, member_id|system, decision, reason)
- `audit_log` (id, hold_id, from_state, to_state, actor, at, detail)

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + React + Tailwind, phone-first layouts for Nana/Ethan |
| Payments UI | PayPal JS SDK (v6) for buyer approval |
| Backend | Next.js route handlers (TypeScript); REST calls to PayPal (Orders, Payments, Payouts, Identity, Reporting) |
| AI | Groq (free) for text and Whisper voicemail transcription; Google Gemini API, free tier, for screenshots (vision) and text fallback; provider order set by `LLM_PROVIDER` |
| Data | **Postgres everywhere**: PGlite (embedded Postgres, no install) locally, **Render Postgres** Basic plan for the hosted demo (paid from the $50 Render credits; Render's free database is deleted after 30 days, which would fall inside judging). **Drizzle ORM** for schema, migrations and queries. Neon or Supabase are drop-in alternatives via `DATABASE_URL`; Supabase free projects pause after 7 days idle, which is risky between submission and judging |
| Jobs | Render cron or Workflows (expiry, cooling-off) |
| Dev tooling | PayPal AI Toolkit, APIMatic Context Plugin (prize eligibility), Postman PayPal collections |
| Hosting | Render (judge demo URL) |

## Environment variables

See [.env.example](../.env.example). Secrets stay in `.env` locally and in Render environment variables in production, never in git.

## Timeline (Oct 21 → Nov 12, 12:00 pm PT)

| Window | Goal |
|---|---|
| Oct 21–23 | Sandbox accounts and app; run `scripts/sandbox-check.mjs` (token, authorize→void/capture, payouts, Log In with PayPal, transaction search); install AI Toolkit and APIMatic plugin |
| Oct 24–28 | Payment Gate + state machine + webhooks end to end (hold → void, hold → capture → payout) |
| Oct 29–Nov 2 | Check-in agent (chat, screenshot, voicemail), risk engine with hard rules, "Is this really you?" verification |
| Nov 3–5 | Family dashboard, Judge Mode (scenarios, seed/reset, skip timer), live PayPal status panel, aftercare text |
| Nov 6 | **Feature freeze**, deployed on Render |
| Nov 7–10 | Rehearse, record, edit, publish the video; README and Devpost text |
| Nov 11 | Buffer, then submit (with owner's approval) |
