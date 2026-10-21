# HoldOn

**A pause between "send" and "gone."** HoldOn protects people from scams where *they* are tricked into sending money (voice-clone "grandson in trouble" calls, fake CRA threats, romance and tech-support scams). The payment is **held through PayPal**, not sent, until an AI check-in and the person's trusted family confirm it's safe. If it's a scam, the hold is voided and the money never leaves.

> 🚧 In development for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/) (deadline Nov 12, 2026). Setup instructions, the hosted demo link and the demo video will appear here.

## How it works (short version)

1. **Hold, don't send:** PayPal Orders with `intent=AUTHORIZE` reserve the funds without moving them.
2. **AI check-in:** a friendly conversation that reads the scam message or voicemail and spots red flags.
3. **"Is this really you?":** the family member the story names must confirm by logging in with *their own* PayPal. A voice clone can't do that.
4. **Release or void:** approved payments are captured and paid out only to the verified person; everything else is voided.

## Documents

- [docs/PROJECT.md](docs/PROJECT.md): what HoldOn is, the problem, how it works, prior art
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): architecture, money flow, safety rules, timeline
- [docs/DEMO_PLAN.md](docs/DEMO_PLAN.md): demo video script and judge access plan
- [docs/PAYPAL_SETUP.md](docs/PAYPAL_SETUP.md): PayPal developer account and sandbox setup
- [docs/HACKATHON.md](docs/HACKATHON.md): hackathon requirements, judging, prizes
- [docs/WEBINAR_TRANSCRIPTS.md](docs/WEBINAR_TRANSCRIPTS.md): official webinar transcripts
- [docs/RULES.md](docs/RULES.md) / [CLAUDE.md](CLAUDE.md): contributor and AI-agent rules

## License

[MIT](LICENSE)
