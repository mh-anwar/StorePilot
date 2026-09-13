// A fake Shopify behind `fetch`: OAuth token exchange, the Admin GraphQL
// endpoint (webhook registration, billing, and StorePilot's own operations via
// MockShopifyAdmin), plus helpers to mint session tokens and signed webhooks
// the way Shopify does. The real @shopify/shopify-app-react-router library
// runs unmodified on top of it.

import { createHmac, randomUUID } from "node:crypto";
import { MockShopifyAdmin } from "../../app/lib/demo/mock-admin";

export const API_KEY = "e2e-client-id";
export const API_SECRET = "e2e-client-secret";
export const APP_URL = "https://storepilot.test";

export interface Subscription {
  id: string;
  name: string;
  test: boolean;
  status: string;
  trialDays: number;
  createdAt: string;
  currentPeriodEnd: string | null;
  lineItems: unknown[];
}

export class FakeShopify {
  admin = new MockShopifyAdmin();
  accessTokens = new Map<string, string>(); // shop -> token
  tokenExchanges = 0;
  webhooks: Array<{ topic: string; callbackUrl: string }> = [];
  subscriptions: Subscription[] = [];
  pendingCharge: string | null = null;
  graphqlOps: string[] = [];

  handle = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (!url.hostname.endsWith(".myshopify.com")) {
      throw new Error(`Unexpected network call in e2e test: ${url.href}`);
    }
    const shop = url.hostname;
    const bodyText = typeof init?.body === "string" ? init.body : init?.body ? await new Response(init.body).text() : "";

    if (url.pathname === "/admin/oauth/access_token") {
      const body = JSON.parse(bodyText);
      if (body.client_id !== API_KEY || body.client_secret !== API_SECRET) return json({ error: "invalid_client" }, 401);
      this.tokenExchanges++;
      const token = `shpat_${randomUUID().replace(/-/g, "")}`;
      this.accessTokens.set(shop, token);
      return json({
        access_token: token,
        scope: "read_orders,read_customers,read_legal_policies,read_shopify_payments_disputes,read_shopify_payments_dispute_evidences,write_shopify_payments_dispute_evidences",
        expires_in: 3600,
        refresh_token: `shprt_${randomUUID()}`,
        refresh_token_expires_in: 7_776_000,
      });
    }

    if (/^\/admin\/api\/[^/]+\/graphql\.json$/.test(url.pathname)) {
      const headers = new Headers(init?.headers);
      if (headers.get("X-Shopify-Access-Token") !== this.accessTokens.get(shop)) {
        return json({ errors: "[API] Invalid API key or access token" }, 401);
      }
      const { query, variables } = JSON.parse(bodyText) as { query: string; variables?: Record<string, unknown> };
      return json(await this.graphql(query, variables ?? {}));
    }

    return json({ errors: "Not Found" }, 404);
  };

  private async graphql(query: string, variables: Record<string, unknown>) {
    const op = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? "anonymous";
    this.graphqlOps.push(op);
    if (query.includes("webhookSubscriptions(")) {
      return {
        data: {
          webhookSubscriptions: {
            edges: this.webhooks.map((w, i) => ({
              node: {
                id: `gid://shopify/WebhookSubscription/${i + 1}`,
                topic: w.topic,
                includeFields: [],
                metafieldNamespaces: [],
                endpoint: { __typename: "WebhookHttpEndpoint", callbackUrl: w.callbackUrl },
              },
            })),
            pageInfo: { endCursor: null, hasNextPage: false },
          },
        },
      };
    }
    if (query.includes("webhookSubscriptionCreate")) {
      const topic = /topic:\s*([A-Z_]+)/.exec(query)?.[1] ?? "?";
      const callbackUrl = /callbackUrl:\s*"([^"]+)"/.exec(query)?.[1] ?? "?";
      this.webhooks.push({ topic, callbackUrl });
      return { data: { webhookSubscriptionCreate: { userErrors: [] } } };
    }
    if (query.includes("currentAppInstallation")) {
      return {
        data: {
          currentAppInstallation: {
            activeSubscriptions: this.subscriptions.filter((s) => s.status === "ACTIVE"),
            oneTimePurchases: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } },
          },
        },
      };
    }
    if (query.includes("appSubscriptionCreate")) {
      const name = String(variables.name);
      this.pendingCharge = name;
      return {
        data: {
          appSubscriptionCreate: {
            appSubscription: { id: "gid://shopify/AppSubscription/1" },
            confirmationUrl: "https://e2e.myshopify.com/admin/charges/1/confirm_recurring_application_charge",
            userErrors: [],
          },
        },
      };
    }
    if (query.includes("appSubscriptionCancel")) {
      const id = String(variables.id);
      const sub = this.subscriptions.find((s) => s.id === id);
      if (sub) sub.status = "CANCELLED";
      return { data: { appSubscriptionCancel: { appSubscription: sub ?? null, userErrors: [] } } };
    }
    return this.admin.respond(query, variables);
  }

  /** The merchant approves the pending charge on Shopify's page. */
  approveCharge() {
    if (!this.pendingCharge) throw new Error("no pending charge");
    this.subscriptions = [
      {
        id: "gid://shopify/AppSubscription/1",
        name: this.pendingCharge,
        test: true,
        status: "ACTIVE",
        trialDays: 7,
        createdAt: new Date().toISOString(),
        currentPeriodEnd: null,
        lineItems: [],
      },
    ];
    this.pendingCharge = null;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** An App Bridge session token (what the admin hands the embedded app). */
export function sessionToken(shop: string, opts: { secret?: string; aud?: string } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: `https://${shop}/admin`,
      dest: `https://${shop}`,
      aud: opts.aud ?? API_KEY,
      sub: "42",
      exp: now + 60,
      nbf: now - 5,
      iat: now - 5,
      jti: randomUUID(),
      sid: randomUUID(),
    }),
  );
  const sig = createHmac("sha256", opts.secret ?? API_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

/** A webhook delivery signed like Shopify signs it. */
export function webhookRequest(path: string, topic: string, shop: string, payload: unknown, opts: { secret?: string } = {}) {
  const body = JSON.stringify(payload);
  const hmac = createHmac("sha256", opts.secret ?? API_SECRET).update(body).digest("base64");
  return new Request(`${APP_URL}${path}`, {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Topic": topic,
      "X-Shopify-Hmac-Sha256": hmac,
      "X-Shopify-Shop-Domain": shop,
      "X-Shopify-API-Version": "2026-10",
      "X-Shopify-Webhook-Id": randomUUID(),
      "X-Shopify-Event-Id": randomUUID(),
      "X-Shopify-Triggered-At": new Date().toISOString(),
    },
  });
}

/** A request from the embedded app (App Bridge adds the bearer token). */
export function appRequest(path: string, shop: string, init: { method?: string; form?: Record<string, string> } = {}) {
  const headers = new Headers({ Authorization: `Bearer ${sessionToken(shop)}` });
  let body: string | undefined;
  if (init.form) {
    body = new URLSearchParams(init.form).toString();
    headers.set("Content-Type", "application/x-www-form-urlencoded");
  }
  return new Request(`${APP_URL}${path}`, { method: init.method ?? (body ? "POST" : "GET"), headers, body });
}
