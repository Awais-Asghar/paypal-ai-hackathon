# Devpost submission text

Copy each section into the matching Devpost field. Sandbox passwords are never written here (this repo is public); paste them into the judges-only field yourself.

---

## Project name

SureSend

## Elevator pitch (tagline)

A pause between send and gone: SureSend holds scam-prone payments in PayPal until an AI check-in and your family say it's safe, so a voice-clone "grandson" can't drain Nana's savings.

## Links

- Try it (Judge Mode): https://suresend-71bi.onrender.com/judge
- Code: https://github.com/Awais-Asghar/paypal-ai-hackathon
- Video: https://youtu.be/JHUiZ52T3pA

## YouTube upload

Uploaded 2026-10-26: https://youtu.be/JHUiZ52T3pA (Public, plays logged out). File: `C:\Users\awais\Videos\SureSend-demo.mp4` (2:07). Visibility **Public**, "not made for kids". Thumbnail: `C:\Users\awais\Videos\SureSend-thumbnail.png`.

Title:

```
SureSend: a pause between send and gone (PayPal AI Hackathon)
```

Description:

```
SureSend holds a scam-prone payment in PayPal until an AI check-in and the people you trust say it is safe. If it's a scam, the authorization is voided and the money never leaves.

Live demo: https://suresend-71bi.onrender.com/judge
Code: https://github.com/Awais-Asghar/paypal-ai-hackathon

Built with PayPal Orders (authorize, capture, void), Log In with PayPal, Payouts and Webhooks; an AI check-in with Groq and Gemini; hosted on Render. PayPal sandbox only, no real money.

Narration and the scam voicemail use AI-generated voices, made for this demo.
```

## Image gallery

Upload from `C:\Users\awais\Videos\SureSend-gallery\`, in this order: `00-logo.png`, `01-s3.png` (held, not sent), `02-s4.png` (AI check-in), `03-s5.png` (Is this really you?), `04-s6.png` ($2,500 kept safe), `05-s7.png` (rent sent), `06-judge-mode.png` (live PayPal status and verified webhooks), `07-problem.png` (the figures).

---

## About the project

### Inspiration

"Nana? It's Ethan. I got arrested and I need bail. Please don't tell Mom." With AI voice cloning, that call now sounds exactly like your grandson. Canadians lost $704 million to fraud in 2025, seniors lost $137.9 million in 2024, and only 5 to 10% of fraud is ever reported (Canadian Anti-Fraud Centre).

In these scams the victim sends the money themselves, so the bank sees a normal payment from the real account owner, and fraud detection stays silent. Today's advice is "call back on a number you know", which is the first thing a panicked grandparent forgets. We wanted a pause between *send* and *gone* that doesn't depend on Nana remembering anything.

### What it does

1. **Hold, don't send.** Nana sends money as usual, but SureSend creates a PayPal order with `intent=AUTHORIZE`. She approves it in PayPal, and the money is reserved, not moved.
2. **A friendly AI check-in.** In plain, warm language, the AI asks the questions that expose scams: who asked, was it urgent, were you told to keep it secret, did they call from a new number, did they ask for gift cards or a different account? It reads a screenshot of the message and transcribes a voicemail. It then gives a structured verdict: risk level, scam type, red flags, and plain-language reasons.
3. **Hard rules first.** Secrecy, a new number, an urgent bail or hospital story, gift cards or crypto, a government threat, and text that tries to give the AI instructions are all red flags written in code. They set a minimum risk the AI can raise but never lower, so a fooled model can't release the money.
4. **"Is this really you?"** If the story names a family member, SureSend messages *the contact the family saved at setup*, never the caller. The real Ethan proves it's him with **Log In with PayPal**, matched on his PayPal ID. A voice can be cloned. A PayPal login can't.
5. **Release or void.** If Ethan says "that wasn't me", the authorization is **voided**: the money never left. Approved payments are **captured** and paid out with **Payouts**, and only ever to the verified family member's PayPal account or a payee the family already knows. "Send it to my lawyer instead" fails.
6. **Fail safe.** Unanswered or uncertain means the money waits. A scheduler voids every hold before PayPal's authorization honor period ends, so silence never sends money.
7. **Everyday payments still flow.** Rent to a known landlord is one question, low risk, and paid out in seconds.
8. **Family dashboard and aftercare.** The family sees money kept safe, payments sent, and the AI's summary of each check-in. For any scam attempt, the AI drafts a ready-to-paste report for the Canadian Anti-Fraud Centre, with the official reporting links.

### How we built it

- **Next.js 16 (App Router) with React and TypeScript**, Tailwind, and a design system built for older adults: large type, 48px buttons, and status always in words as well as color.
- **The Payment Gate** is the only code that changes a payment's state or moves money. It is a state machine (held, assessing, verifying or cooling off, approved, released, or denied and voided) with row-locked transitions, an audit row for every change, and a fixed `PayPal-Request-Id` per step, so a retry can never move money twice.
- **Postgres with Drizzle ORM**: PGlite locally (nothing to install), Render Postgres in production.
- **PayPal REST APIs** called directly from TypeScript, sandbox only (details below).
- **The AI layer** is pluggable. Groq answers the conversation first, at about one second per reply. Gemini reads screenshots (Groq has no vision model) and backs up text with a lighter fallback model, so a busy model never stalls Nana. If no model answers at all, the check-in falls back to scripted questions and the payment fails safe to at least medium risk.
- **Render** hosts the app, its private Postgres database, and a cron job that runs the scheduler every 10 minutes.
- **52 automated tests** (Vitest, in-memory Postgres, a fake PayPal and deliberately fooled AI models) cover every demo scenario, the safety rules and race conditions. The full flow was also run end to end against the live PayPal sandbox on the hosted site.

### How PayPal is used

PayPal isn't a checkout button here. Its authorize, capture and void model *is* the safety mechanism.

- **Orders v2 with `intent=AUTHORIZE`**: the hold. Money is reserved in Nana's account, not moved.
- **Authorizations: capture and void.** Capture only after the check passes; void on "not me", a denial, or a deadline.
- **Payouts** with `recipient_type: PAYPAL_ID`: family money goes only to the PayPal ID that the family member verified.
- **Log In with PayPal (OpenID Connect)**: the "Is this really you?" check, matched on `payer_id`.
- **Webhooks**: every notification is signature-verified with PayPal before it is stored, and de-duplicated by event ID. Judge Mode lists them live: order approved, authorization created or voided, capture completed, payout succeeded.
- **Judge Mode reads PayPal directly**, so viewers see the authorization status (CREATED, VOIDED, CAPTURED) and the payout status from PayPal itself.

### How AI is used

| Model or service | What it does in SureSend |
|---|---|
| Groq, `openai/gpt-oss-120b` | The check-in conversation, the structured risk verdict (JSON schema), the family summary, and the Anti-Fraud Centre report draft |
| Groq, `whisper-large-v3-turbo` | Transcribes the voicemail the scammer left |
| Google Gemini, `gemini-3.8-flash` with `gemini-flash-lite-latest` as fallback | Reads screenshots of the scam message (vision), and backs up text when Groq is unavailable |
| Claude Code (Anthropic) | AI pair programmer used to design, build, test and deploy the project |
| Microsoft neural text-to-speech (via edge-tts) | Narration and the demo "grandson" voicemail in the video, labelled as AI-generated |
| ChatGPT | Helped create the logo, which was then redrawn as SVG |

The AI never touches money. It has no PayPal access; only the Payment Gate can capture, pay out or void. Scammer text, screenshots and transcripts are passed to the model marked as untrusted evidence, and text that tries to instruct the AI is itself a red flag.

### Challenges we ran into

- **Making the AI safe to be wrong.** The design rule became: the model can only make SureSend *more* careful. Hard rules set the floor, a missing verdict means "wait", and money moves only through one gated path.
- **Scammer counter-moves.** "I lost my phone, send it to this account instead" is beaten by three rules: verification only goes to contacts saved at setup, payouts only go to the verified person, and unanswered means void.
- **Race conditions.** A "stop" pressed while the scheduler is releasing a payment could land on a hold that was already going out. Decisions now re-check the payment's state under a row lock, with a test that fails without the fix.
- **Free AI tiers under load.** Gemini's main model returned "high demand" errors during testing, so we added an ordered fallback chain with short timeouts. Screenshot reading went from 26 seconds to 9.

### Accomplishments that we're proud of

- The full scam story runs on the **real PayPal sandbox** on the hosted site: authorize, AI check-in, Log In with PayPal, void; and for rent, capture then payout. All of it is confirmed by signature-verified webhooks.
- The safety rules are enforced in code and covered by tests, including a model that is always fooled.
- A calm, readable interface designed for the people this is meant to protect.

### What we learned

PayPal's authorization model is a natural fit for scam protection: "promised but not gone" is exactly the window a family needs. And the strongest anti-deepfake check isn't detecting the fake voice; it's asking the real person to prove who they are with something a clone doesn't have.

### What's next for SureSend

- Sign-in for the family dashboard, so trusted members can approve or deny from there.
- Email and SMS delivery of "Is this really you?" (today the demo shows it on the family member's phone screen in Judge Mode).
- More languages for the check-in, for newcomers targeted by fake immigration and tax calls.
- Built natively into PayPal, any PayPal user could turn on a trusted circle.

### Questions judges might ask

**"The caller said he lost his phone. How can Ethan log in?"** "I lost my phone" is the scammer's line: the real Ethan still has his phone, and SureSend messages the contact saved at setup, never the caller's new number. A PayPal login also works from any device. If Ethan truly can't be reached, the money stays held, Nana or another trusted family member can stop it, and SureSend voids it before PayPal's deadline. "No phone / new number" is itself a hard red flag.

**"Won't scammers just ask for gift cards?"** SureSend protects the PayPal rail, and its check-in also flags gift-card and crypto requests as red flags. The idea is meant to live inside PayPal itself.

---

## Built with

`next.js` `react` `typescript` `tailwindcss` `postgresql` `drizzle-orm` `pglite` `paypal-orders-api` `paypal-payouts` `log-in-with-paypal` `paypal-webhooks` `groq` `gemini` `whisper` `render` `vitest` `claude-code`

---

## Testing instructions for judges (judges-only field)

1. Open **https://suresend-71bi.onrender.com/judge**. It is always on, no wake-up wait.
2. Pick **Grandparent voice-clone scam** and click **Continue to PayPal**. Log in as Nana (Margaret) and approve. Everything is on `sandbox.paypal.com`, with fake money only.
3. Answer the check-in (or click **Share the sample voicemail**), then **I've told you everything**. Expect: high risk, "Checking with your family".
4. Back on Judge Mode, open **Ethan's phone**, click **Open**, then **Log in with PayPal** as Ethan, using a private window so PayPal doesn't reuse Nana's login. Click **No, that wasn't me**. Judge Mode shows the authorization **VOIDED**.
5. Try **Normal rent payment**: one question, then **CAPTURED** and payout **SUCCESS**.
6. **Reset demo** clears everything and voids any open holds.

Sandbox logins (fake money):
- Nana (Margaret Collins): sb-ukev4353485360@personal.example.com / *(paste password)*
- Ethan Collins: sb-zzkwv53485396@personal.example.com / *(paste password)*

---

## Sponsor questions

- **Hosted on Render?** Yes: web service, private Postgres, and a cron job for the scheduler (`render.yaml` in the repo).
- **Used the APIMatic Context Plugin?** No.
- **Did the project exist before Oct 1, 2026?** No. Started Oct 21, 2026.
