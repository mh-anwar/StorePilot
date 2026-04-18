// Shopify app config. All values come from env; APP_URL is the public
// base URL the app is served from (must match what's set in the Partner
// dashboard). Scopes are kept intentionally broad but read-heavy —
// writes are scoped to what the agent tools actually need.

export const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || "";
export const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || "";
export const SHOPIFY_SCOPES =
  process.env.SHOPIFY_SCOPES ||
  [
    "read_products",
    "write_products",
    "read_inventory",
    "write_inventory",
    "read_orders",
    "read_customers",
    "read_discounts",
    "write_discounts",
    "read_fulfillments",
    "read_price_rules",
    "write_price_rules",
  ].join(",");

export const APP_URL =
  process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const SHOPIFY_API_VERSION = "2025-01";

export function isConfigured(): boolean {
  return !!(SHOPIFY_API_KEY && SHOPIFY_API_SECRET);
}

export function shopDomainIsValid(shop: string): boolean {
  // Accept only <name>.myshopify.com — prevents open redirect via the auth flow.
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}
