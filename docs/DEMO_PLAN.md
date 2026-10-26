# Demo Plan: SureSend

> **Status (2026-10-26): done.** The video was made from live recordings of the hosted site, with an AI narration voice and burned-in captions (2:07), public at https://youtu.be/JHUiZ52T3pA. The file is in the owner's Videos folder (`SureSend-demo.mp4`), and the pipeline is in [`video/`](../video/README.md). Judge access is live at https://suresend-71bi.onrender.com/judge. The plan below is the original; the schedule moved up because the owner had no time after Oct 26.

Two separate things have to work:

1. **The demo video**: under 3:00, public on YouTube. It's the main input for *Presentation* (20% of the score) and the whole basis for **Best Demo Delivery** ($5k). Judges aren't required to run the app, so many will only watch this.
2. **The functional demo**: judges must be able to run or click through a working build (hosted URL or full run instructions). A mockup is disqualifying.

---

## Part 1: The video (target 2:45)

### Cast (all played by one person)

| Role | What's on screen | How it's recorded |
|---|---|---|
| **Nana** (Margaret Collins, protected person) | Phone-sized SureSend app | Chrome window in device emulation (iPhone frame), sandbox *personal* account A |
| **Ethan Collins** (real grandson, trusted circle) | Second phone-sized window | Separate Chrome profile, sandbox *personal* account B |
| **"Scammer"** | Incoming-call screen plus voicemail audio | Built into the app's demo mode. The voice is an AI clone of **our own voice** |
| **Proof** | PayPal sandbox: authorization status and balances | Developer Dashboard / sandbox.paypal.com in a third window, or an in-app "PayPal live status" panel that reads the real API |
| **Narrator** | Voice-over | Our own voice (preferred) or clear TTS |

### Script

| Time | Scene | On screen | Narration / audio |
|---|---|---|---|
| 0:00–0:12 | **Hook** | Black screen, phone ringing, caller "Unknown". Caption: *"This voice is AI-generated. It took 30 seconds of audio."* | Cloned voice: "Nana? It's Ethan… I got arrested. I need $2,500 for bail. Please don't tell Mom." |
| 0:12–0:27 | **Problem** | Three stats animate in: $704M lost in Canada in 2025 · only 5–10% reported · voice clones on the rise | "When a scammer convinces you to send money yourself, fraud systems stay silent, because it really is you pressing send." |
| 0:27–0:37 | **Solution** | SureSend logo, tagline: *A pause between "send" and "gone."* | "SureSend holds the money, checks the story, and asks the people you trust." |
| 0:37–1:00 | **Nana sends** | Nana enters $2,500 to "Ethan (new number)". PayPal sandbox approval pops up and she approves. The screen says **"Held, not sent."** Cut to the proof panel: authorization `CREATED`, balance unchanged | "Nana approves with PayPal, but SureSend only *authorizes* the payment. The money is reserved, not moved." |
| 1:00–1:35 | **AI check-in** | Chat: AI asks gentle questions, and Nana uploads the voicemail. Red-flag chips appear: *secrecy*, *urgency*, *bail*, *new number*. Risk: **High**, with a plain-language reason | "The AI listens to the voicemail and spots the classic grandparent-scam pattern, without making Nana feel foolish." |
| 1:35–2:00 | **"Is this really Ethan?"** | Ethan's phone gets a link. He taps **Log in with PayPal**, and the identity matches the family record. He taps "That's not me. I'm in class." | "A voice clone can copy Ethan's voice. It can't log in to Ethan's PayPal." |
| 2:00–2:15 | **Money kept safe** | Authorization **voided** (proof panel updates from the webhook). Nana's screen: "$2,500 kept safe." Family summary card | "The hold is cancelled. The money never left." |
| 2:15–2:30 | **Normal life still works** | Nana pays $900 rent to her usual landlord, Robert Hayes. Low risk, captured and paid through Payouts in seconds | "Everyday payments to people she knows go straight through." |
| 2:30–2:45 | **How it's built + close** | One architecture slide: PayPal Orders (authorize/capture/void) · Log In with PayPal · Payouts · Webhooks · Transaction Search · Claude · Render. End card: name, repo URL, "Built for the PayPal AI Hackathon" | "The money should wait, not Nana." |

### Production checklist

- **Record each scene separately** with OBS Studio (free) at 1080p, then edit in DaVinci Resolve or CapCut (free). Don't try to do it in one take.
- **Layout:** split screen with Nana's phone on the left, Ethan's phone or the PayPal proof panel on the right. Zoom in on anything that matters (balances, status).
- **Voice clone:** clone only *our own* voice, with our consent, and show the "AI-generated" caption on screen. Never clone a real third person.
- **Rules compliance:**
  - No third-party trademarks or logos. Don't show bank logos or the CRA logo; use generic "Unknown caller".
  - No copyrighted music. Use YouTube Audio Library tracks or none.
  - English, with **burned-in captions**, since judges often watch muted.
- **No secrets on screen:** hide the client secret, tokens and real personal data. Use sandbox emails only.
- Keep it **under 3:00**; aim for 2:45. Judges stop at 3:00.
- Upload to YouTube as **Public**. Check the link in a logged-out browser.

---

## Part 2: Judge access (functional demo)

### Primary: hosted on Render

- `https://suresend.onrender.com` (name TBD). Use the paid instance from the $50 Render credits so it doesn't sleep and isn't cold when a judge opens it.
- **Judge Mode landing page:**
  1. A short "what you're about to see" note.
  2. **Scenario buttons:** *Grandparent voice-clone scam*, *CRA threat call*, *Normal rent payment*.
  3. **Sandbox logins** for "Nana" and "Ethan" shown on the page and in the README. Sharing sandbox test logins is allowed by the rules; they're fake money.
  4. A **Reset demo** button that restores seed data.
  5. A **Skip cooling-off** button, so judges don't wait 24h.
- Server-side secrets (PayPal client secret, LLM key) live only in Render environment variables, never in the repo.

### Backup: run it locally

The README gives exact steps:
1. Clone, `cp .env.example .env`, and add your own PayPal sandbox app credentials plus an LLM key.
2. `npm install && npm run seed && npm run dev`.
3. Optionally run a tunnel (ngrok or Cloudflare) for webhooks. If no tunnel is detected, the app falls back to polling PayPal.

### Last resort

Unlisted backup clips of each scenario, linked in the README, in case the sandbox or hosting is down during judging (Dec 1–15).

---

## Features that exist *because of* the demo

Build these as real features, not video tricks:
- Seeded sandbox accounts and payees (`npm run seed`), plus a reset endpoint
- Scenario injector: simulated incoming-call screen and sample voicemail or screenshot per scam type
- "PayPal live status" panel that reads real authorization and capture state from the API, so viewers *see* the money didn't move
- Skip-timer control for cooling-off
- Webhook handling with a polling fallback, because sandbox webhooks can lag
- Phone-sized responsive layout for the Nana and Ethan views

## Schedule

| Date | Demo milestone |
|---|---|
| Nov 6 | Feature freeze. Judge Mode and seed/reset working on Render |
| Nov 7 | Voice clone recorded, script finalized, dry run start to finish (time it) |
| Nov 8 | Record all scenes |
| Nov 9 | Edit, captions, music; upload as Unlisted for a review pass |
| Nov 10 | Fix issues, make the video Public, logged-out link check, README final |
| Nov 11 | Buffer, then submit on Devpost (with owner's approval) |
