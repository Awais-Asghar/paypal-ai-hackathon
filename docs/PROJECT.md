# Project: SureSend, a circuit breaker for scam payments

Our entry for the PayPal AI Hackathon (chosen 2026-10-21). Deadline: **Nov 12, 2026, 12:00 pm PT**. Solo build.

Related docs: [ARCHITECTURE.md](ARCHITECTURE.md) (how it's built) · [DEMO_PLAN.md](DEMO_PLAN.md) (video and judge access) · [HACKATHON.md](HACKATHON.md) (rules and judging) · [PAYPAL_SETUP.md](PAYPAL_SETUP.md) (sandbox setup).

The earlier brainstorm of 12 other ideas is in git history only: `git show 4260579:IDEAS.md`.


> Bank fraud systems stop strangers from stealing your money. Nothing stops *you* from sending it to a scammer yourself. SureSend puts a pause between "send" and "gone": the money is held, not moved, until an AI check and the people you trust say it's safe.

**Problem.** In authorized push payment (APP) fraud, the victim sends the money themselves. Common versions are grandparent and voice-clone "family emergency" calls, CRA and immigration-threat calls, romance scams, tech support scams and fake investments. Fraud detection doesn't fire, because the real account owner is making the payment.
- Canadians lost **$704M** to fraud in 2025 (CAFC). Only 5–10% of fraud is reported.
- Seniors lost **$137.9M** in 2024.
- UK APP fraud rose 19% in 2025 to **£576M**.
- AI voice cloning makes "it's me, Grandma, I'm in trouble" calls convincing.

**Who it's for.** Seniors (the protected person) and their family (the trusted circle). Second audience: newcomers and international students in Canada, who are targeted by fake CRA and immigration-threat calls.

**How it works**
1. **Hold, don't send.** When the protected person sends money (say, $2,500 "for my grandson's bail"), SureSend creates a **PayPal order with `intent=AUTHORIZE`**. The funds are reserved on her PayPal but **not moved**.
2. **AI check-in.** A warm, non-judgmental conversation in her language (text, with voice as a stretch goal):
   - It asks the questions that expose scams: who asked, is it urgent, were you told to keep it secret, did they call from a new number?
   - It can read a screenshot of the message, or transcribe the voicemail.
   - It matches the situation against known scam patterns and gives a risk level with plain-language reasons.
3. **"Is this really you?"** If the story involves a family member, SureSend sends that person, at the contact on file, a link. They must **Log In with PayPal**, and their verified PayPal identity must match the family-circle record. A voice clone can imitate a grandson, but it can't log in to his PayPal.
4. **Trusted circle decides.** The family gets a one-screen summary. The response scales with risk:
   - Low risk goes through instantly.
   - Medium risk waits a cooling-off timer.
   - High risk needs a family approval.
5. **Outcome.** If it's approved, SureSend **captures** the authorization and pays the recipient through **Payouts**. If it's denied or times out, SureSend **voids** the authorization. The money never left.
6. **Aftercare.** If a scam got through anyway, the AI prepares a pre-filled CAFC report and, where applicable, a PayPal dispute with evidence.
7. **Family dashboard.** It shows money kept safe, new and unusual payees (baselined from **Transaction Search**), and the history of check-ins.

**Why PayPal is central.** PayPal's authorize, capture and void model *is* the safety mechanism: money is promised but not gone. Log In with PayPal provides identity that a deepfake can't fake. It also uses Payouts and Webhooks (authorization voided or captured, payout status), with Disputes for aftercare. This is a feature PayPal could ship natively, and the prototype shows how.

**Why AI is central:** a multimodal check-in agent (conversation, screenshot reading, voicemail transcription), scam-pattern reasoning with structured risk output, family summaries, and multilingual support.

**Sponsor fit:** **Render** for hosting, with Workflows for cooling-off timers and authorization expiry. **APIMatic** while building. Optionally Elastic for retrieval over published scam scripts (no Elastic prize).

**Demo (under 3 min):**
1. A stat and a voice-clone "grandson" call, cloned from *our own* voice with a disclosure on screen.
2. Nana taps send for $2,500. The PayPal sandbox shows an authorization, and her balance hasn't moved.
3. The AI check-in spots *secrecy + urgency + bail + new number*.
4. A "Is this really Ethan?" link goes out. The real Ethan logs in with PayPal and replies "I'm fine, I'm at class."
5. The authorization is **voided**, and the dashboard shows "$2,500 kept safe."
6. Finally, a normal rent payment to a known payee goes through instantly, which proves it doesn't get in the way of everyday life.

**Prior art (checked 2026-10-21)**
- [Starling Bank's Scam Intelligence](https://thepaypers.com/fraud-and-fincrime/news/starling-bank-adds-ai-agent-to-detect-romance-and-investment-fraud) (UK, Gemini) asks contextual questions before a payment. It's for that bank's own customers, and it only *recommends* calling support.
- Hackathon projects [SafePay Family](https://devpost.com/software/safepay-family) (ML scoring plus family alerts), [ScamShield](https://devpost.com/software/scamshield-v4) (message checker plus family alerts) and [Foni.ai](https://devpost.com/software/foni-ai) (call analysis).
- Cooling-off holds and trusted contacts exist as [policy proposals and bank rules](https://spectrumnews1.com/wi/madison/news/2026/10/01/ai-scam-seniors-awareness) and [FINRA-style trusted contacts](https://www.ctvnews.ca/business/article/spike-in-elder-financial-abuse-renews-calls-to-designate-trusted-contact-person-dale-jackson/).
- Deepfake defence today is mostly [family codewords and callbacks](https://staysafeonline.org/articles/when-scammers-call-grandma). **[KinConfirm](https://apps.apple.com/us/app/-/id6751080203)** (iOS, found 2026-10-21, no ratings yet) sends a relative an identity check that they confirm with Face ID or a secret question. That's close to our "Is this really you?" step, but it doesn't hold money or control where the payment goes.
- **What's new here:** (a) the money is actually *held* through a PayPal authorization, not just flagged; (b) verification is **tied to the payout**: the money can only go to the PayPal account of the person who verified, so a "send it to my lawyer" switch fails; (c) the identity proof is the family member's own PayPal login; (d) open to anyone on PayPal, not one bank's customers. Pitch the *combination*, not the verification step alone.

**Rules against scammer counter-moves** (for example "I don't have my phone, send it to this other account"):
1. **Never trust caller-supplied contact details.** Verification goes only to the contact details the family saved at setup. The real person can verify from any device by logging in with PayPal.
2. **Pay only the verified person.** If the stated purpose is "for Ethan", the payout can go *only* to Ethan's verified PayPal account. Any other recipient is a mismatch and an automatic high-risk flag.
3. **Fail safe: when in doubt, wait.** If the person can't be reached, the funds stay held and a second trusted contact is asked. SureSend suggests calling the hospital or police station on a number it looks up itself, never one the caller gave.
4. **Scam phrases raise risk, they don't unlock money.** "No phone", "different account", "don't tell anyone", "urgent" and "gift cards/crypto" all increase the risk score.

**Risks:**
- Log In with PayPal must be enabled on the sandbox app with a return URL, and Payouts must be enabled. **Verify in week 1.**
- Authorizations have a 3-day honor period, which is fine for a 24h cooling-off.
- The obvious judge question: "a scammer will just ask for gift cards." Answer: SureSend protects the PayPal rail, and its check-in also warns about gift-card and crypto requests. The pitch is that this belongs *inside* PayPal.

| Tech | Design | Impact | Innovation | Presentation | Build (solo) |
|---|---|---|---|---|---|
| 5 | 4 | 5 | 4 | 5 | 4 |

**Total 23/25**, the highest after the prior-art check. Prize targets: Grand Prize, Most Impactful, Best Use of PayPal + AI, Best Demo Delivery, plus Render or APIMatic.

## Week-1 feasibility checks

Run with [`scripts/sandbox-check.mjs`](../scripts/sandbox-check.mjs). Setup steps are in [PAYPAL_SETUP.md](PAYPAL_SETUP.md).

- [x] Sandbox business account (SureSend Demo) plus personal accounts Margaret Collins ("Nana"), Ethan Collins and Robert Hayes (landlord), all in Canada (CAD) (2026-10-21)
- [x] Access token from client credentials (2026-10-21)
- [x] Order with `intent=AUTHORIZE` → Margaret approves → authorize → **void**: authorization `9UK966797J1895949` CREATED → VOIDED, 25.00 CAD (2026-10-21). Authorizations expire after 29 days
- [ ] Authorize → **capture** (same flow, `authorize capture`)
- [x] Payouts from the business account to a personal sandbox account: batch `W3YARBZK4AA2Q` SUCCESS, 1.00 CAD to Ethan (2026-10-21). Note: the Payouts amount field is `currency`, not `currency_code`
- [ ] Log In with PayPal enabled on the app; code exchange + userinfo returns a stable PayPal user ID/email
- [x] Transaction Search returns data (2026-10-21, after requesting a fresh token with `ignoreCache=true`)
- [ ] Webhook delivery through a tunnel (ngrok/Cloudflare) with signature verification
- [ ] PayPal AI Toolkit and APIMatic Context Plugin installed in Claude Code
