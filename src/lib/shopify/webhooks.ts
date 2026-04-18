import { APP_URL, SHOPIFY_API_VERSION } from "./config";

// Shopify webhook topics we want subscribed on install. GDPR topics
// (customers/data_request, customers/redact, shop/redact) are declared
// in the Partner dashboard and point at the same inbound endpoint; listed
// here for completeness.
export const CORE_TOPICS = [
  "products/create",
  "products/update",
  "products/delete",
  "orders/create",
  "orders/updated",
  "orders/cancelled",
  "inventory_levels/update",
  "customers/create",
  "customers/update",
  "app/uninstalled",
  "customers/data_request",
  "customers/redact",
  "shop/redact",
];

export async function registerWebhooks(shop: string, accessToken: string) {
  const endpoint = `${APP_URL}/api/shopify/webhooks`;
  for (const topic of CORE_TOPICS) {
    try {
      const r = await fetch(
        `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({
            webhook: {
              topic,
              address: endpoint,
              format: "json",
            },
          }),
        }
      );
      if (!r.ok && r.status !== 422) {
        // 422 = already subscribed; ignore.
        console.warn(
          `webhook register ${topic} failed: ${r.status} ${await r.text()}`
        );
      }
    } catch (e) {
      console.warn(`webhook register ${topic} error`, (e as Error).message);
    }
  }
}
