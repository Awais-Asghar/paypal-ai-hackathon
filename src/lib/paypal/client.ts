import "server-only";

// Thin REST client for the PayPal sandbox. Request shapes follow the calls verified in
// scripts/sandbox-check.mjs. Money-moving methods are only called from the Payment Gate.

export class PayPalError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues: string[],
    readonly debugId: string | null,
  ) {
    super(message);
    this.name = "PayPalError";
  }

  hasIssue(issue: string) {
    return this.issues.includes(issue);
  }
}

export type PayPalConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  currency: string;
  webhookId?: string;
  loginRedirectUri: string;
};

export type Authorization = { id: string; status: string; expirationTime: string };
export type UserInfo = { userId: string; payerId: string | null; email: string | null };
export type PayoutReceiver = { type: "EMAIL"; value: string } | { type: "PAYPAL_ID"; value: string };

/** The PayPal operations SureSend uses. Tests swap in a fake. */
export interface PayPalGateway {
  createAuthorizeOrder(input: {
    holdId: string;
    amountCents: number;
    currency: string;
    description: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<{ orderId: string; approveUrl: string }>;
  authorizeOrder(orderId: string, requestId: string): Promise<Authorization>;
  captureAuthorization(authorizationId: string, requestId: string): Promise<{ captureId: string; status: string }>;
  voidAuthorization(authorizationId: string, requestId: string): Promise<void>;
  getAuthorizationStatus(authorizationId: string): Promise<string>;
  createPayout(input: {
    senderBatchId: string;
    requestId: string;
    receiver: PayoutReceiver;
    amountCents: number;
    currency: string;
    note: string;
  }): Promise<{ batchId: string; status: string }>;
}

export function sandboxConfigFromEnv(env = process.env): PayPalConfig {
  const baseUrl = env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";
  // docs/RULES.md §4: sandbox only, never live endpoints.
  if (!new URL(baseUrl).hostname.includes("sandbox")) {
    throw new Error("PAYPAL_BASE_URL is not a sandbox URL. SureSend runs against the PayPal sandbox only.");
  }
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new Error("Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET. Copy .env.example to .env and fill them in.");
  }
  return {
    baseUrl,
    clientId: env.PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
    currency: env.PAYPAL_CURRENCY || "CAD",
    webhookId: env.PAYPAL_WEBHOOK_ID || undefined,
    loginRedirectUri: env.PAYPAL_LOGIN_REDIRECT_URI || "http://127.0.0.1:3000/callback",
  };
}

export function centsToValue(cents: number) {
  if (!Number.isInteger(cents) || cents <= 0) throw new Error(`Invalid amount: ${cents} cents`);
  return (cents / 100).toFixed(2);
}

const LOGIN_SCOPES = "openid email https://uri.paypal.com/services/paypalattributes";

export class PayPalClient implements PayPalGateway {
  private token?: { value: string; expiresAt: number };

  constructor(
    private readonly config: PayPalConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get webBase() {
    return this.config.baseUrl.includes("sandbox") ? "https://www.sandbox.paypal.com" : "https://www.paypal.com";
  }

  private basicAuth() {
    return "Basic " + Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
  }

  private async appToken(forceRefresh = false) {
    if (!forceRefresh && this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const res = await this.fetchImpl(`${this.config.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: this.basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      // ignoreCache: otherwise PayPal hands back a cached token that lacks scopes enabled since it was issued.
      body: "grant_type=client_credentials&ignoreCache=true",
    });
    const body = await res.json();
    if (!res.ok) throw toError(res, body);
    this.token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return this.token.value;
  }

  /** POSTs always carry a caller-chosen PayPal-Request-Id so a retry can never move money twice. */
  private async request<T>(
    method: "GET" | "POST",
    path: string,
    opts: { body?: unknown; requestId?: string; userToken?: string; headers?: Record<string, string> } = {},
  ): Promise<T> {
    if (method === "POST" && !opts.requestId) throw new Error(`POST ${path} needs a PayPal-Request-Id`);
    for (let attempt = 0; ; attempt++) {
      const token = opts.userToken ?? (await this.appToken(attempt > 0));
      const res = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(opts.requestId ? { "PayPal-Request-Id": opts.requestId } : {}),
          ...opts.headers,
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
      if (res.status === 401 && attempt === 0 && !opts.userToken) continue;
      const text = await res.text();
      const json = text ? safeJson(text) : {};
      if (!res.ok) throw toError(res, json);
      return json as T;
    }
  }

  async createAuthorizeOrder(input: Parameters<PayPalGateway["createAuthorizeOrder"]>[0]) {
    const order = await this.request<{ id: string; links: { rel: string; href: string }[] }>("POST", "/v2/checkout/orders", {
      requestId: `${input.holdId}-order`,
      body: {
        intent: "AUTHORIZE",
        purchase_units: [
          {
            custom_id: input.holdId,
            description: input.description.slice(0, 127),
            amount: { currency_code: input.currency, value: centsToValue(input.amountCents) },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              // Otherwise the checkout page shows the app's default name ("Test Store").
              brand_name: "SureSend",
              user_action: "CONTINUE",
              shipping_preference: "NO_SHIPPING",
              return_url: input.returnUrl,
              cancel_url: input.cancelUrl,
            },
          },
        },
      },
    });
    const approveUrl = order.links.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
    if (!approveUrl) throw new Error(`Order ${order.id} has no approval link`);
    return { orderId: order.id, approveUrl };
  }

  async authorizeOrder(orderId: string, requestId: string): Promise<Authorization> {
    const r = await this.request<{
      purchase_units: { payments: { authorizations: { id: string; status: string; expiration_time: string }[] } }[];
    }>("POST", `/v2/checkout/orders/${orderId}/authorize`, { requestId, body: {} });
    const auth = r.purchase_units[0]?.payments.authorizations[0];
    if (!auth) throw new Error(`Order ${orderId} returned no authorization`);
    return { id: auth.id, status: auth.status, expirationTime: auth.expiration_time };
  }

  async getAuthorizationStatus(authorizationId: string) {
    const r = await this.request<{ status: string }>("GET", `/v2/payments/authorizations/${authorizationId}`);
    return r.status;
  }

  /** Read-only, for status displays: the payout item's status (SUCCESS, PENDING, UNCLAIMED...), else the batch's. */
  async getPayoutStatus(batchId: string) {
    const r = await this.request<{ batch_header: { batch_status: string }; items?: { transaction_status?: string }[] }>(
      "GET",
      `/v1/payments/payouts/${batchId}`,
    );
    return r.items?.[0]?.transaction_status ?? r.batch_header.batch_status;
  }

  async captureAuthorization(authorizationId: string, requestId: string) {
    const r = await this.request<{ id: string; status: string }>("POST", `/v2/payments/authorizations/${authorizationId}/capture`, {
      requestId,
      body: { final_capture: true },
      headers: { Prefer: "return=representation" },
    });
    return { captureId: r.id, status: r.status };
  }

  async voidAuthorization(authorizationId: string, requestId: string) {
    await this.request("POST", `/v2/payments/authorizations/${authorizationId}/void`, { requestId });
  }

  async createPayout(input: Parameters<PayPalGateway["createPayout"]>[0]) {
    const r = await this.request<{ batch_header: { payout_batch_id: string; batch_status: string } }>("POST", "/v1/payments/payouts", {
      requestId: input.requestId,
      body: {
        sender_batch_header: { sender_batch_id: input.senderBatchId, email_subject: "You received money through SureSend" },
        items: [
          {
            recipient_type: input.receiver.type,
            receiver: input.receiver.value,
            // Payouts uses `currency`, not `currency_code`.
            amount: { value: centsToValue(input.amountCents), currency: input.currency },
            note: input.note,
            sender_item_id: input.senderBatchId,
          },
        ],
      },
    });
    return { batchId: r.batch_header.payout_batch_id, status: r.batch_header.batch_status };
  }

  /** Verifies a webhook delivery with PayPal's postback API. Unverifiable means rejected. */
  async verifyWebhookSignature(headers: Headers, event: unknown) {
    if (!this.config.webhookId) return false;
    const h = (name: string) => headers.get(name);
    const fields = {
      auth_algo: h("paypal-auth-algo"),
      cert_url: h("paypal-cert-url"),
      transmission_id: h("paypal-transmission-id"),
      transmission_sig: h("paypal-transmission-sig"),
      transmission_time: h("paypal-transmission-time"),
    };
    if (Object.values(fields).some((v) => !v)) return false;
    const r = await this.request<{ verification_status: string }>("POST", "/v1/notifications/verify-webhook-signature", {
      requestId: `verify-${fields.transmission_id}`,
      body: { ...fields, webhook_id: this.config.webhookId, webhook_event: event },
    });
    return r.verification_status === "SUCCESS";
  }

  loginUrl(state: string) {
    const q = new URLSearchParams({
      flowEntry: "static",
      client_id: this.config.clientId,
      response_type: "code",
      scope: LOGIN_SCOPES,
      redirect_uri: this.config.loginRedirectUri,
      state,
    });
    return `${this.webBase}/signin/authorize?${q}`;
  }

  /** Log In with PayPal: exchange the code, then read the user's stable payer_id. */
  async userInfoFromCode(code: string): Promise<UserInfo> {
    const res = await this.fetchImpl(`${this.config.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: this.basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code }),
    });
    const tok = await res.json();
    if (!res.ok) throw toError(res, tok);
    const u = await this.request<{ user_id: string; payer_id?: string; emails?: { value: string; primary?: boolean }[] }>(
      "GET",
      "/v1/identity/oauth2/userinfo?schema=paypalv1.1",
      { userToken: tok.access_token },
    );
    const email = u.emails?.find((e) => e.primary)?.value ?? u.emails?.[0]?.value ?? null;
    return { userId: u.user_id, payerId: u.payer_id ?? null, email };
  }
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function toError(res: Response, body: Record<string, unknown>) {
  const details = (body.details as { issue?: string; description?: string }[] | undefined) ?? [];
  const issues = details.map((d) => d.issue ?? "").filter(Boolean);
  const name = String(body.name ?? body.error ?? "PAYPAL_ERROR");
  const message = String(body.message ?? body.error_description ?? `PayPal request failed (${res.status})`);
  return new PayPalError(res.status, name, `${message}${issues.length ? ` [${issues.join(", ")}]` : ""}`, issues, res.headers.get("paypal-debug-id"));
}

let shared: PayPalClient | undefined;
export function getPayPal() {
  shared ??= new PayPalClient(sandboxConfigFromEnv());
  return shared;
}
