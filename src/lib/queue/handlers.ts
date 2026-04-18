// Register all job handlers. This module has side effects — importing it
// registers the handlers against the queue's singleton registry.
import { registerHandler } from "../queue";
import { processWebhook } from "../shopify/webhook-processor";
import {
  syncProducts,
  syncOrders,
  syncCustomers,
} from "../shopify/sync";

registerHandler("shopify.webhook.process", async (p) => {
  await processWebhook(p as { shopId: string; topic: string; webhookId: string });
});
registerHandler("shopify.sync.products", async (p) => {
  await syncProducts(p as { shopId: string; cursor?: string });
});
registerHandler("shopify.sync.orders", async (p) => {
  await syncOrders(p as { shopId: string; cursor?: string });
});
registerHandler("shopify.sync.customers", async (p) => {
  await syncCustomers(p as { shopId: string; cursor?: string });
});
