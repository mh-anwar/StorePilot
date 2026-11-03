// app_subscriptions/update: plan approved, cancelled, frozen or expired.
import type { ActionFunctionArgs } from "react-router";
import {
  handleSubscriptionWebhook,
  syncPlanFromShopify,
  type AppSubscriptionWebhook,
} from "../lib/billing/billing.server";
import { fromShopifyAdmin } from "../lib/shopify/admin-client";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, admin, payload } = await authenticate.webhook(request);
  if (admin) {
    try {
      await syncPlanFromShopify(shop, fromShopifyAdmin(admin));
      return new Response();
    } catch (error) {
      console.warn(`[billing] could not re-read subscriptions for ${shop}; using the webhook payload`, error);
    }
  }
  await handleSubscriptionWebhook(shop, payload as AppSubscriptionWebhook);
  return new Response();
};
