// Keeps Shop.plan in step with the merchant's Shopify app subscription.
// Shopify is the source of truth; we mirror it on every app load (billing.check)
// and on app_subscriptions/update webhooks.

import type { Shop } from "@prisma/client";
import prisma from "../../db.server";
import { logActivity } from "../context.server";
import { PLANS, planKeyFromName, type PlanKey } from "./plans";

export interface SubscriptionLike {
  name: string;
  status?: string | null;
}

/** The best active plan among a shop's subscriptions. */
export function planFromSubscriptions(subs: SubscriptionLike[]): PlanKey {
  const active = subs.filter((s) => !s.status || s.status.toUpperCase() === "ACTIVE");
  const keys = active.map((s) => planKeyFromName(s.name));
  if (keys.includes("pro")) return "pro";
  if (keys.includes("growth")) return "growth";
  return "free";
}

export async function setPlan(shop: Shop, plan: PlanKey, actor = "system"): Promise<Shop> {
  if (shop.plan === plan) return shop;
  const updated = await prisma.shop.update({ where: { id: shop.id }, data: { plan } });
  await logActivity(shop.id, "plan_changed", `Plan changed from ${PLANS[shop.plan as PlanKey]?.label ?? shop.plan} to ${PLANS[plan].label}.`, {
    actor,
  });
  return updated;
}

/** app_subscriptions/update webhook body (REST shape). */
export interface AppSubscriptionWebhook {
  app_subscription?: { name?: string; status?: string; admin_graphql_api_id?: string };
}

export async function handleSubscriptionWebhook(shopDomain: string, payload: AppSubscriptionWebhook) {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  const sub = payload.app_subscription;
  if (!shop || !sub?.name) return null;
  const status = (sub.status ?? "").toUpperCase();
  const key = planKeyFromName(sub.name);
  if (status === "ACTIVE") return setPlan(shop, key);
  // Cancelled, declined, expired or frozen: only downgrade if it's the plan we think they're on.
  if (shop.plan === key) return setPlan(shop, "free");
  return shop;
}

export function billingTestMode(): boolean {
  return process.env.BILLING_TEST_MODE !== "false";
}
