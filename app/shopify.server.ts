import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  DeliveryMethod,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { PLAN_GROWTH, PLAN_PRO } from "./lib/billing/plan-names";
import { onInstalled } from "./lib/shop.server";
import { fromShopifyAdmin } from "./lib/shopify/admin-client";

// Without Partner app credentials the server still boots so /demo, /privacy
// and /healthz work (screenshots, a public demo, a first deploy before the
// app exists). Embedded routes need the real values; see docs/INSTALL.md.
//
// The public URL is detected on Render and Fly, so a fresh deploy only needs
// the client id and secret.
export const appUrl =
  process.env.SHOPIFY_APP_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.FLY_APP_NAME ? `https://${process.env.FLY_APP_NAME}.fly.dev` : "");

export const shopifyConfigured = Boolean(
  process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET && appUrl,
);
if (!shopifyConfigured) {
  console.warn(
    "[storepilot] SHOPIFY_API_KEY, SHOPIFY_API_SECRET or SHOPIFY_APP_URL is not set: only /demo, /privacy and /healthz will work.",
  );
}

export const DEFAULT_SCOPES =
  "read_orders,read_customers,read_legal_policies,read_shopify_payments_disputes,read_shopify_payments_dispute_evidences,write_shopify_payments_dispute_evidences";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY || "not-configured",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "not-configured",
  apiVersion: ApiVersion.October26,
  scopes: (process.env.SCOPES || DEFAULT_SCOPES).split(","),
  appUrl: appUrl || "http://localhost:3000",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  billing: {
    [PLAN_GROWTH]: {
      trialDays: 7,
      lineItems: [
        { amount: 29, currencyCode: "USD", interval: BillingInterval.Every30Days },
      ],
    },
    [PLAN_PRO]: {
      trialDays: 7,
      lineItems: [
        { amount: 79, currencyCode: "USD", interval: BillingInterval.Every30Days },
      ],
    },
  },
  // Also declared in shopify.app.toml. Registering them over the API on every
  // install means an app created by hand in the Dev Dashboard (no CLI deploy)
  // still gets its webhooks. Handlers are idempotent, so a duplicate delivery
  // from both registrations is harmless.
  webhooks: {
    DISPUTES_CREATE: { deliveryMethod: DeliveryMethod.Http, callbackUrl: "/webhooks/disputes" },
    DISPUTES_UPDATE: { deliveryMethod: DeliveryMethod.Http, callbackUrl: "/webhooks/disputes" },
    APP_UNINSTALLED: { deliveryMethod: DeliveryMethod.Http, callbackUrl: "/webhooks/app/uninstalled" },
    APP_SUBSCRIPTIONS_UPDATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/app_subscriptions/update",
    },
  },
  hooks: {
    afterAuth: async ({ session, admin }) => {
      if (process.env.REGISTER_WEBHOOKS !== "off") {
        try {
          await shopify.registerWebhooks({ session });
        } catch (error) {
          console.error(`[install] webhook registration failed for ${session.shop}`, error);
        }
      }
      await onInstalled(session.shop, fromShopifyAdmin(admin));
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
