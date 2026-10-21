#!/usr/bin/env node
// Week-1 feasibility checks for HoldOn against the PayPal sandbox. Setup: docs/PAYPAL_SETUP.md
// Usage: node --env-file=.env scripts/sandbox-check.mjs <command>
// Commands: token | search | webhooks | payouts | authorize [capture] | login | all
// Never prints secrets or access tokens.

import http from "node:http";
import { randomUUID } from "node:crypto";

const BASE = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const CURRENCY = process.env.PAYPAL_CURRENCY || "USD";
const REDIRECT_URI = process.env.PAYPAL_LOGIN_REDIRECT_URI || "http://localhost:3000/callback";
const WEB_BASE = BASE.includes("sandbox") ? "https://www.sandbox.paypal.com" : "https://www.paypal.com";

// Exiting with process.exit() while a fetch socket is closing crashes libuv on Windows,
// so failures throw and the top-level handler sets the exit code instead.
class CheckError extends Error {}
function fail(msg) {
  throw new CheckError(msg);
}
function abort(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!BASE.includes("sandbox")) {
  abort("PAYPAL_BASE_URL is not a sandbox URL. HoldOn checks run against the sandbox only (docs/RULES.md §4).");
}
if (!CLIENT_ID || !CLIENT_SECRET) {
  abort("Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET. Copy .env.example to .env and fill them in.");
}

const ok = (msg) => console.log(`✓ ${msg}`);
const info = (msg) => console.log(`  ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const basicAuth = "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

let cachedToken;
async function appToken() {
  if (cachedToken) return cachedToken;
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: basicAuth, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const body = await res.json();
  if (!res.ok) fail(`Token request failed (${res.status}): ${body.error_description || JSON.stringify(body)}`);
  cachedToken = body;
  return body;
}

async function api(method, path, { body, headers = {}, token } = {}) {
  const access = token || (await appToken()).access_token;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      ...(method === "POST" ? { "PayPal-Request-Id": randomUUID() } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, json, debugId: res.headers.get("paypal-debug-id") };
}

function describeError(r) {
  const j = r.json || {};
  const detail = j.details?.map((d) => `${d.issue}${d.description ? `: ${d.description}` : ""}`).join("; ");
  return `${r.status} ${j.name || j.error || ""} ${j.message || j.error_description || ""}${detail ? ` [${detail}]` : ""} (debug id ${r.debugId})`;
}

// One-shot local server that captures the browser redirect after approval/login.
function waitForRedirect(pathname, timeoutMs = 5 * 60_000) {
  const url = new URL(REDIRECT_URI);
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, url.origin);
      if (reqUrl.pathname !== pathname) { res.writeHead(404).end(); return; }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h2>HoldOn sandbox check: received. You can close this tab and return to the terminal.</h2>");
      clearTimeout(timer);
      server.close();
      resolve(reqUrl.searchParams);
    });
    const timer = setTimeout(() => { server.close(); reject(new Error("Timed out waiting for the browser redirect")); }, timeoutMs);
    server.listen(Number(url.port) || 80, url.hostname);
  });
}

async function checkToken() {
  const t = await appToken();
  ok(`Access token issued (expires in ${Math.round(t.expires_in / 3600)}h)`);
  const scopes = t.scope.split(" ");
  const need = {
    "Orders authorize/capture": "https://uri.paypal.com/services/payments/payment/authcapture",
    Payouts: "https://uri.paypal.com/payments/payouts",
    "Log In with PayPal (openid)": "openid",
    "Transaction Search": "https://uri.paypal.com/services/reporting/search/read",
    Webhooks: "https://uri.paypal.com/services/applications/webhooks",
  };
  for (const [label, scope] of Object.entries(need)) {
    const has = scopes.includes(scope);
    console.log(`${has ? "✓" : "✗"} scope for ${label}${has ? "" : " missing; enable the feature on the app in the Developer Dashboard"}`);
  }
}

async function checkSearch() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 3600 * 1000);
  const q = new URLSearchParams({ start_date: start.toISOString(), end_date: end.toISOString(), fields: "all", page_size: "5" });
  const r = await api("GET", `/v1/reporting/transactions?${q}`);
  if (r.ok) ok(`Transaction Search works (${r.json.total_items ?? 0} transactions in the last 30 days)`);
  else console.log(`✗ Transaction Search: ${describeError(r)}\n  Enable "Transaction search" on the app, then wait 10–15 minutes.`);
}

async function checkWebhooks() {
  const r = await api("GET", "/v1/notifications/webhooks");
  if (!r.ok) { console.log(`✗ Webhooks list: ${describeError(r)}`); return; }
  const hooks = r.json.webhooks || [];
  ok(`Webhooks API works (${hooks.length} registered)`);
  for (const h of hooks) info(`${h.id} → ${h.url} (${h.event_types?.length ?? 0} event types)`);
}

async function checkPayouts() {
  const receiver = process.env.SANDBOX_ALI_EMAIL;
  if (!receiver) { console.log("✗ Payouts: set SANDBOX_ALI_EMAIL to a sandbox personal account email"); return; }
  const r = await api("POST", "/v1/payments/payouts", {
    body: {
      sender_batch_header: { sender_batch_id: `holdon-check-${Date.now()}`, email_subject: "HoldOn sandbox payout check" },
      items: [{ recipient_type: "EMAIL", receiver, amount: { value: "1.00", currency_code: CURRENCY }, note: "HoldOn feasibility check", sender_item_id: "check-1" }],
    },
  });
  if (!r.ok) { console.log(`✗ Payouts create: ${describeError(r)}`); return; }
  const id = r.json.batch_header.payout_batch_id;
  ok(`Payout batch created (${id}), status ${r.json.batch_header.batch_status}`);
  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    const s = await api("GET", `/v1/payments/payouts/${id}`);
    const status = s.json.batch_header?.batch_status;
    const item = s.json.items?.[0]?.transaction_status;
    info(`batch ${status}, item ${item}`);
    if (["SUCCESS", "DENIED", "CANCELED"].includes(status)) break;
  }
}

async function checkAuthorize(finish = "void") {
  const returnPath = "/return";
  const origin = new URL(REDIRECT_URI).origin;
  const r = await api("POST", "/v2/checkout/orders", {
    body: {
      intent: "AUTHORIZE",
      purchase_units: [{ custom_id: "holdon-check", description: "HoldOn feasibility check (held, not sent)", amount: { currency_code: CURRENCY, value: "25.00" } }],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: "CONTINUE",
            shipping_preference: "NO_SHIPPING",
            return_url: `${origin}${returnPath}`,
            cancel_url: `${origin}${returnPath}?cancelled=1`,
          },
        },
      },
    },
  });
  if (!r.ok) fail(`Create order: ${describeError(r)}`);
  const orderId = r.json.id;
  const approve = r.json.links.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  ok(`Order ${orderId} created with intent=AUTHORIZE`);
  console.log(`\n  Open this link and approve as the sandbox PERSONAL account ("Nana"):\n  ${approve}\n`);

  const params = await waitForRedirect(returnPath);
  if (params.get("cancelled")) fail("Buyer cancelled the approval");

  const a = await api("POST", `/v2/checkout/orders/${orderId}/authorize`, { body: {} });
  if (!a.ok) fail(`Authorize: ${describeError(a)}`);
  const auth = a.json.purchase_units[0].payments.authorizations[0];
  ok(`Authorization ${auth.id} status ${auth.status}, expires ${auth.expiration_time}. Funds are reserved, not moved`);

  if (finish === "capture") {
    const c = await api("POST", `/v2/payments/authorizations/${auth.id}/capture`, { body: { final_capture: true }, headers: { Prefer: "return=representation" } });
    if (!c.ok) fail(`Capture: ${describeError(c)}`);
    ok(`Captured: capture ${c.json.id} status ${c.json.status}`);
  } else {
    const v = await api("POST", `/v2/payments/authorizations/${auth.id}/void`, { headers: { Prefer: "return=representation" } });
    if (!v.ok) fail(`Void: ${describeError(v)}`);
    ok(`Voided: authorization ${auth.id} status ${v.json.status || "VOIDED"}. The money never left`);
  }
}

async function checkLogin() {
  const callbackPath = new URL(REDIRECT_URI).pathname;
  const state = randomUUID();
  const q = new URLSearchParams({
    flowEntry: "static",
    client_id: CLIENT_ID,
    response_type: "code",
    scope: "openid email https://uri.paypal.com/services/paypalattributes",
    redirect_uri: REDIRECT_URI,
    state,
  });
  console.log(`\n  Open this link and log in as the sandbox PERSONAL account ("Ali"):\n  ${WEB_BASE}/signin/authorize?${q}\n`);
  info(`(Requires "Log in with PayPal" enabled on the app with return URL ${REDIRECT_URI})`);

  const params = await waitForRedirect(callbackPath);
  if (params.get("error")) fail(`Login error: ${params.get("error")} ${params.get("error_description") || ""}`);
  if (params.get("state") !== state) fail("State mismatch on login callback");

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: basicAuth, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code: params.get("code") }),
  });
  const tok = await res.json();
  if (!res.ok) fail(`Code exchange failed (${res.status}): ${tok.error_description || JSON.stringify(tok)}`);
  ok("Authorization code exchanged for a user token");

  const u = await api("GET", "/v1/identity/oauth2/userinfo?schema=paypalv1.1", { token: tok.access_token });
  if (!u.ok) fail(`userinfo: ${describeError(u)}`);
  const email = u.json.emails?.find((e) => e.primary)?.value || u.json.emails?.[0]?.value;
  ok("Identity received from PayPal:");
  info(`user_id: ${u.json.user_id}`);
  info(`payer_id: ${u.json.payer_id ?? "(not returned; paypalattributes scope may be off)"}`);
  info(`email: ${email ?? "(not returned)"}`);
  info(`verified_account: ${u.json.verified_account ?? "(not returned)"}`);
  const expected = process.env.SANDBOX_ALI_EMAIL;
  if (expected && email) console.log(`${email.toLowerCase() === expected.toLowerCase() ? "✓" : "✗"} matches SANDBOX_ALI_EMAIL`);
}

const [cmd = "all", arg] = process.argv.slice(2);
const commands = {
  token: checkToken,
  search: checkSearch,
  webhooks: checkWebhooks,
  payouts: checkPayouts,
  authorize: () => checkAuthorize(arg === "capture" ? "capture" : "void"),
  login: checkLogin,
  all: async () => { await checkToken(); await checkSearch(); await checkWebhooks(); await checkPayouts(); },
};

if (!commands[cmd]) abort(`Unknown command "${cmd}". Use: ${Object.keys(commands).join(" | ")}`);
commands[cmd]().catch((e) => {
  console.error(`✗ ${e instanceof CheckError ? e.message : e.stack || e.message}`);
  process.exitCode = 1;
});
