// Register all job handlers. This module has side effects — importing it
// registers the handlers against the queue's singleton registry.
import { registerHandler } from "../queue";
import { processWebhook } from "../shopify/webhook-processor";
import {
  syncProducts,
  syncOrders,
  syncCustomers,
} from "../shopify/sync";
import { runWorkflow } from "../workflows/executor";
import { fanoutShopifyTrigger } from "../workflows/triggers";
// Importing handlers/index has the side effect of registering every
// workflow step handler with the registry. It MUST be imported before
// runWorkflow is called.
import "../workflows/handlers";

registerHandler("shopify.webhook.process", async (p) => {
  await processWebhook(p as { shopId: string; topic: string; webhookId: string });
  // After the mirror is updated, fan the topic out to any matching workflows.
  await fanoutShopifyTrigger(p as { shopId: string; topic: string; webhookId: string });
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
registerHandler("workflow.run", async (p) => {
  await runWorkflow((p as { runId: string }).runId);
});
registerHandler("workflow.resume", async (p) => {
  await runWorkflow((p as { runId: string }).runId);
});
