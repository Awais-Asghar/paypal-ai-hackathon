# PayPal Developer Account & Sandbox Setup

Step-by-step setup for HoldOn. Takes about 15–20 minutes plus a 10–15 minute wait for settings to apply. **No documents, ID upload or credit card are needed.** Everything runs in the sandbox with fake money.

## Step 1: Get a PayPal account (skip if you already have one)

1. Go to **https://www.paypal.com/ca** (or your country's PayPal site) → **Sign Up** → choose **Personal account**.
2. Enter your email, phone number (you'll get an SMS code), a password, your name, address and date of birth.
3. Confirm your email from the message PayPal sends.

> A personal account is enough to use the developer sandbox. You don't need to add a bank account or card.

## Step 2: Open the Developer Dashboard

1. Go to **https://developer.paypal.com** → **Log in to Dashboard**, and log in with the same PayPal email and password.
2. At the top of the dashboard, make sure the toggle says **Sandbox**, not Live. Keep it on Sandbox for everything below.
3. PayPal has automatically created two test accounts for you: one **Business** and one **Personal**.

## Step 3: Create the test accounts for HoldOn

HoldOn needs four sandbox accounts, **all in Canada (CAD)**, which matches our Canadian story (CAFC fraud data, fake CRA calls). Don't mix countries. If a check fails because of the country, we'll add a US set as a fallback.

Go to **Testing Tools → Sandbox Accounts → Create account**. Use the **default** dialog: it generates the email and password for you. The "custom account" form needs an email and password typed in. Create:

| Account | Type | Country | Name (set after creating) | Used as |
|---|---|---|---|---|
| Platform | Business | Canada | **HoldOn Demo** | The HoldOn app that holds and releases money |
| Grandma | Personal | Canada | **Margaret Collins** ("Nana") | The person being protected (pays) |
| Grandson | Personal | Canada | **Ethan Collins** | The real grandson (verifies, receives) |
| Landlord | Personal | Canada | **Robert Hayes** | Known payee for the "normal rent payment" scene |

For each one, open the **⋯ menu → View/Edit account**, then:
- **Profile:** set the name above, so it shows up on transactions;
- **Funding:** give Margaret a big balance, for example 5,000 CAD;
- note down each account's **email** and **password**. You'll use them to log in during tests.

## Step 4: Create the HoldOn app (this gives you the API keys)

1. Go to **Apps & Credentials** (top menu), make sure **Sandbox** is selected → **Create App**.
2. App name: `HoldOn`. Type: **Merchant**. Sandbox account: pick **HoldOn Platform** (the business account from Step 3) → **Create App**.
3. You'll see:
   - **Client ID**: public, fine to use in front-end code;
   - **Secret**: click **Show**. It's private, like a password. **Never share it, paste it in chat or commit it.**

## Step 5: Turn on the features HoldOn needs

On the HoldOn app's page, scroll to **Features** (some may sit under "Other features"):

- [x] **Transaction search**
- [x] **Payouts**
- [x] **Log in with PayPal**, then open its **Advanced settings**:
  - **Return URL:** `http://localhost:3000/callback`
  - **Information requested from customers:** tick **Email** and **PayPal account ID (payer ID)**
  - If it asks for privacy policy or user agreement URLs, any placeholder works for the sandbox, for example `http://localhost:3000/privacy` and `http://localhost:3000/terms`.

Click **Save Changes**, then **wait 10–15 minutes**. Feature changes take a while to apply.

## Step 6: Put your keys in `.env` (on your computer only)

1. In the project folder, copy the template: `cp .env.example .env`.
2. Open `.env` and fill in:
   ```
   PAYPAL_CLIENT_ID=<Client ID from Step 4>
   PAYPAL_CLIENT_SECRET=<Secret from Step 4>
   PAYPAL_CURRENCY=CAD
   SANDBOX_MARGARET_EMAIL=<Margaret's sandbox email>
   SANDBOX_ETHAN_EMAIL=<Ethan's sandbox email>
   SANDBOX_ROBERT_EMAIL=<Robert's sandbox email>
   ```
3. `.env` is git-ignored, so it never gets committed. Don't paste these values anywhere else.

## Step 7: Run the checks

You need Node 20.6+; this machine has Node 24. From the project folder:

```bash
node --env-file=.env scripts/sandbox-check.mjs all              # token scopes, transaction search, webhooks, payouts
node --env-file=.env scripts/sandbox-check.mjs authorize         # hold $25 → void (opens an approval link)
node --env-file=.env scripts/sandbox-check.mjs authorize capture # hold → capture
node --env-file=.env scripts/sandbox-check.mjs login             # Log In with PayPal → identity (opens a login link)
```

For `authorize` and `login`, the script prints a link and waits on `localhost:3000`:
- `authorize`: log in as **Margaret** and approve;
- `login`: log in as **Ethan**.

Each line starts with ✓ (works) or ✗ (problem, with the fix). The script only works with the sandbox and never prints your secret.

## Step 8 (recommended): AI dev tools

In Claude Code:
- **PayPal AI Toolkit:** `/plugin install paypal@claude-plugins-official`, then `/paypal:setup`.
- **APIMatic Context Plugin:** install it with the command on APIMatic's [resource page](https://drive.google.com/file/d/1qa7Xkjt3PGJllHQVCP1IuE-XxlRNz4mN/view), linked from the Devpost APIMatic page. **Using it while building qualifies us for the APIMatic prize.**

## Troubleshooting

| Problem | Fix |
|---|---|
| `401 Client Authentication failed` | Wrong Client ID or Secret, or you copied Live keys. Re-copy them from **Sandbox** → Apps & Credentials |
| `✗ scope for Payouts / Transaction Search missing` | Turn the feature on in Step 5 and wait 10–15 minutes |
| `NOT_AUTHORIZED` on Transaction Search | The feature isn't enabled yet, or is still propagating. Wait and retry |
| Login link shows "invalid redirect_uri" | The return URL in Step 5 must be exactly `http://localhost:3000/callback` |
| Payout `DENIED` or stuck | Check that `SANDBOX_ETHAN_EMAIL` is a sandbox **personal** account and the currency matches the accounts' country |
| Can't create a PayPal account in your country | Ask in the PayPal Discord: https://discord.gg/sJ2G6DyvSK |
| Token works in the morning, then 401 later | Tokens expire after about 8–9 hours. The script fetches a new one each run; in the AI Toolkit use `/paypal:setup refresh` |
