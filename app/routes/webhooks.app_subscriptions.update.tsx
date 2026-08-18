// app_subscriptions/update: plan approved, cancelled, frozen or expired.
import type { ActionFunctionArgs } from "react-router";
import { handleSubscriptionWebhook, type AppSubscriptionWebhook } from "../lib/billing/billing.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);
  await handleSubscriptionWebhook(shop, payload as AppSubscriptionWebhook);
  return new Response();
};
