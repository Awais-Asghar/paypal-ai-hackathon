# SureSend

**A pause between "send" and "gone."** SureSend protects people from scams where *they* are tricked into sending money (voice-clone "grandson in trouble" calls, fake CRA threats, romance and tech-support scams). The payment is **held through PayPal**, not sent, until an AI check-in and the person's trusted family confirm it's safe. If it's a scam, the hold is voided and the money never leaves.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

- **Demo video (2:07):** https://youtu.be/JHUiZ52T3pA
- **Try it live (Judge Mode):** https://suresend-71bi.onrender.com/judge (PayPal sandbox, fake money only)

## How it works (short version)

1. **Hold, don't send:** PayPal Orders with `intent=AUTHORIZE` reserve the funds without moving them.
2. **AI check-in:** a friendly conversation that reads the scam message or voicemail and spots red flags.
3. **"Is this really you?":** the family member the story names must confirm by logging in with *their own* PayPal. A voice clone can't do that.
4. **Release or void:** approved payments are captured and paid out only to the verified person; everything else is voided.

## Run it locally

Needs Node.js 22+. No database to install: PGlite stores data in `./.pglite`.

1. `npm install`
2. `cp .env.example .env` and fill in your PayPal sandbox app credentials and sandbox account emails ([setup guide](docs/PAYPAL_SETUP.md)).
3. `npm run seed` creates the database and the demo family.
4. `npm run dev`, then open http://127.0.0.1:3000 (use `127.0.0.1`, not `localhost`, to match the Log In with PayPal return URL).

Set `JUDGE_MODE=1` in `.env` and open http://127.0.0.1:3000/judge for the guided demo: three scenarios (voice-clone grandparent scam, fake CRA threat, normal rent), Ethan's phone, a live PayPal status column, "run the scheduler now" and "reset demo". Nana's send page is at `/send`.

Checks: `npm test`, `npm run typecheck`, `npm run lint`.

Hosted demo: deployed on Render from [`render.yaml`](render.yaml) (web app, Postgres, a scheduler cron job). Steps: [docs/DEPLOY.md](docs/DEPLOY.md).

## Project layout

| Path | What's there |
|---|---|
| `src/app/` | Pages (`/send`, `/holds/[id]`, `/holds/[id]/report`, `/verify/[token]`, `/family`, `/judge`) and the API routes under `src/app/api/` |
| `src/components/` | UI pieces: check-in chat, send form, status card, PayPal status |
| `src/lib/gate/` | The Payment Gate and the hold state machine: the only code that moves money |
| `src/lib/risk/` | Hard red-flag rules that the AI can't override |
| `src/lib/ai/` | Groq and Gemini clients, the check-in agent, voicemail transcription |
| `src/lib/checkin/` | Runs a check-in and hands the verdict to the gate |
| `src/lib/paypal/` | Sandbox-only PayPal REST client |
| `src/lib/db/` | Drizzle schema, database connection (PGlite or Postgres), demo seed |
| `src/lib/aftercare/` | Scam report drafts for the Canadian Anti-Fraud Centre (aftercare) |
| `src/lib/demo/` | Judge Mode scenarios and reset |
| `drizzle/` | Database migrations |
| `tests/` | Vitest tests (in-memory database, fake PayPal, fake AI) |
| `scripts/` | `seed.mts` (demo data), `sweep.mjs` (Render cron job) and `sandbox-check.mjs` (PayPal sandbox checks) |
| `render.yaml` | Render Blueprint for the hosted demo |
| `video/` | How the demo video was made: narration script, title cards, build script |
| `docs/` | Project documents (listed below) |

`AGENTS.md` is written by Next.js for AI coding agents; `CLAUDE.md` holds this project's agent guide.

## Documents

- [docs/PROJECT.md](docs/PROJECT.md): what SureSend is, the problem, how it works, prior art
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): architecture, money flow, safety rules, timeline
- [docs/DEMO_PLAN.md](docs/DEMO_PLAN.md): demo video script and judge access plan
- [docs/PAYPAL_SETUP.md](docs/PAYPAL_SETUP.md): PayPal developer account and sandbox setup
- [docs/DEPLOY.md](docs/DEPLOY.md): deploying the hosted demo on Render
- [docs/DEVPOST.md](docs/DEVPOST.md): the Devpost submission text, tools list and judge testing steps
- [docs/HACKATHON.md](docs/HACKATHON.md): hackathon requirements, judging, prizes
- [docs/WEBINAR_TRANSCRIPTS.md](docs/WEBINAR_TRANSCRIPTS.md): official webinar transcripts
- [docs/RULES.md](docs/RULES.md) / [CLAUDE.md](CLAUDE.md): contributor and AI-agent rules

## License

[MIT](LICENSE)
