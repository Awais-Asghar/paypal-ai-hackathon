# Deploying SureSend to Render

The hosted demo runs on [Render](https://render.com) from [`render.yaml`](../render.yaml), a Blueprint that creates three resources from this repo's `main` branch:

| Resource | Type and plan | What it does | Cost |
|---|---|---|---|
| `suresend` | Web service, `starter` | The Next.js app. Always on, so judges never wait for a cold start. Runs migrations and seeds the Collins family before each deploy (`npm run seed`, safe to repeat) | about $7/month |
| `suresend-db` | Postgres, `0.1c-256mb` | The database. Private network only. The free plan is deleted after 30 days, which would fall inside judging | $10.50/month (Render's price at deploy, Oct 2026) |
| `suresend-sweep` | Cron job, every 10 minutes | Calls `/api/cron/sweep`: ends cooling-off timers, voids holds before PayPal's authorization deadline, retries stuck steps | about $1/month |

All three are paid from the hackathon's Render credit ($50, valid until Sep 30, 2027). Render needs a card on file for paid services even when the credit covers them; it makes a temporary $1 check.

**After judging ends (Dec 15, 2026), delete all three resources** in the Render dashboard. At about $18.50/month in total the credit runs out around January 2027, and the card would be charged after that. Deploy to Dec 15 uses about $32 of the $50.

Render sets `RENDER_EXTERNAL_URL`, and the app uses it for its own address, the PayPal return URLs and the Log In with PayPal return URL (`src/lib/env.ts`). There's no need to set `APP_BASE_URL` on Render.

## 1. Create the Blueprint (Render dashboard)

1. Sign in at https://dashboard.render.com with GitHub.
2. **New > Blueprint**, connect the repo `Awais-Asghar/paypal-ai-hackathon`, branch `main`. Render reads `render.yaml` and lists the three resources above.
3. Fill in the secret values it asks for. Copy each one from your local `.env`:
   - `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
   - `SANDBOX_MARGARET_EMAIL`, `SANDBOX_ETHAN_EMAIL`, `SANDBOX_ROBERT_EMAIL`
   - `GROQ_API_KEY`, `GEMINI_API_KEY_Pro`, `GEMINI_API_KEY_Plus`
   - `PAYPAL_WEBHOOK_ID`: leave it empty for now (step 3).
4. Click **Apply**. The first build takes a few minutes. When `suresend` shows **Live**, note its URL, for example `https://suresend.onrender.com`. Below, `<url>` means that address.

## 2. Allow the Render URL in the PayPal app (Developer Dashboard)

Apps & Credentials > the SureSend app (listed as "HoldOn") > **Log in with PayPal**:

- Add the return URL `<url>/callback`. Keep `http://127.0.0.1:3000/callback` for local development.
- Save inside the dialog and look for "Application was saved successfully". The privacy and user agreement URLs must stay filled in, or the setting silently unticks.

## 3. Webhooks

Same app > **Webhooks > Add webhook**:

- URL: `<url>/api/webhooks/paypal`
- Events: **All events** (the app uses `PAYMENT.AUTHORIZATION.VOIDED`, `PAYMENT.CAPTURE.COMPLETED` and the payouts events)
- Copy the **Webhook ID**, then in Render: `suresend` > **Environment** > `PAYPAL_WEBHOOK_ID` > paste > **Save**. Render restarts the service with it.

Without a webhook ID the app rejects every webhook (it cannot verify the signature), which is the safe default.

## 4. Check it

- `<url>/` loads the home page, and `<url>/judge` shows the three scenarios and the Collins family.
- Play the rent scenario: it should end **Sent**, with **CAPTURED** and payout **SUCCESS** in Judge Mode.
- Render > `suresend-sweep` > **Logs** shows `sweep 200` every 10 minutes.

## Sandbox logins for judges

The Judge page shows `SANDBOX_MARGARET_PASSWORD` and `SANDBOX_ETHAN_PASSWORD` only if they're set. Leave them unset on Render, so the passwords aren't on a public page where anyone could change them. Give them to judges in the Devpost judges-only field instead.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails | Render > `suresend` > **Events** > the failed deploy > logs. `npm run build` must pass locally first |
| Pre-deploy (seed) fails | Usually a missing secret: check step 1.3 |
| PayPal says the return URL doesn't match | Step 2: the URL must be exactly `<url>/callback` |
| Webhooks rejected with 401 | `PAYPAL_WEBHOOK_ID` is missing or from another app (step 3) |
