# SureSend

**A pause between "send" and "gone."** SureSend protects people from scams where *they* are tricked into sending money (voice-clone "grandson in trouble" calls, fake CRA threats, romance and tech-support scams). The payment is **held through PayPal**, not sent, until an AI check-in and the person's trusted family confirm it's safe. If it's a scam, the hold is voided and the money never leaves.

> In development for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/) (deadline Nov 12, 2026). Setup instructions, the hosted demo link and the demo video will appear here.

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

## Documents

- [docs/PROJECT.md](docs/PROJECT.md): what SureSend is, the problem, how it works, prior art
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): architecture, money flow, safety rules, timeline
- [docs/DEMO_PLAN.md](docs/DEMO_PLAN.md): demo video script and judge access plan
- [docs/PAYPAL_SETUP.md](docs/PAYPAL_SETUP.md): PayPal developer account and sandbox setup
- [docs/HACKATHON.md](docs/HACKATHON.md): hackathon requirements, judging, prizes
- [docs/WEBINAR_TRANSCRIPTS.md](docs/WEBINAR_TRANSCRIPTS.md): official webinar transcripts
- [docs/RULES.md](docs/RULES.md) / [CLAUDE.md](CLAUDE.md): contributor and AI-agent rules

## License

[MIT](LICENSE)
