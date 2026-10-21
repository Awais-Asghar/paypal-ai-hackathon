# Sandbox feasibility checks

`sandbox-check.mjs` confirms that the PayPal features HoldOn depends on work on your sandbox app. It needs Node 20.6+ (for `--env-file`) and no dependencies. It refuses to run against live PayPal.

## One-time setup (PayPal Developer Dashboard, Sandbox mode)

1. **Testing tools → Sandbox accounts.** You need one **Business** account (HoldOn platform, the default is fine) and two **Personal** accounts, "Nana" and "Ali". Create all of them in the **same country** and give them those names.
2. **Apps & Credentials → your app** (linked to the business account):
   - copy the **Client ID** and **Secret** into `.env` (never paste them in chat or commit them);
   - **Features:** turn on **Transaction search**, **Payouts** and **Log in with PayPal**;
   - under Log in with PayPal → Advanced settings, add the return URL `http://localhost:3000/callback` and enable the email and PayPal account ID scopes;
   - save, then wait 10–15 minutes for changes to apply.
3. `cp .env.example .env` and fill in `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `SANDBOX_NANA_EMAIL` and `SANDBOX_ALI_EMAIL`.

## Run

```bash
node --env-file=.env scripts/sandbox-check.mjs all          # token scopes, transaction search, webhooks, payouts
node --env-file=.env scripts/sandbox-check.mjs authorize     # hold $25 → void (opens an approval link)
node --env-file=.env scripts/sandbox-check.mjs authorize capture   # hold → capture
node --env-file=.env scripts/sandbox-check.mjs login         # Log In with PayPal → identity (opens a login link)
```

For `authorize` and `login`, the script prints a link and waits on `localhost:3000` for the browser redirect. Log in with the **sandbox personal** account's email and password (Dashboard → Sandbox accounts → View/edit account).
