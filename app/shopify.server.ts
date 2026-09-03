import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
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
export const shopifyConfigured = Boolean(
  process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET && process.env.SHOPIFY_APP_URL,
);
if (!shopifyConfigured) {
  console.warn(
    "[storepilot] SHOPIFY_API_KEY, SHOPIFY_API_SECRET or SHOPIFY_APP_URL is not set: only /demo, /privacy and /healthz will work.",
  );
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY || "not-configured",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "not-configured",
  apiVersion: ApiVersion.October26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "http://localhost:3000",
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
  hooks: {
    afterAuth: async ({ session, admin }) => {
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
