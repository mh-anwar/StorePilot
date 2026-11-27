import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { PlansView } from "../components/PlansView";
import { adminContext } from "../lib/app-context.server";
import { billingTestMode, planFromSubscriptions, setPlan } from "../lib/billing/billing.server";
import { PAID_PLANS, PLAN_GROWTH, PLAN_PRO } from "../lib/billing/plan-names";
import type { PlanKey } from "../lib/billing/plans";
import { packsUsed } from "../lib/disputes/records.server";
import { dashboardStats, plansRecord } from "../lib/disputes/views.server";
import type { ActionResult } from "../lib/action-result";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { ctx, billing } = await adminContext(request);
  const { appSubscriptions } = await billing.check({ plans: [...PAID_PLANS], isTest: billingTestMode() });
  const shop = await setPlan(ctx.shop, planFromSubscriptions(appSubscriptions), ctx.actor);
  ctx.shop = shop;
  return {
    current: shop.plan as PlanKey,
    packsUsed: await packsUsed(shop.id),
    testMode: billingTestMode(),
    isDemo: false,
    record: plansRecord(await dashboardStats(ctx)),
  };
};

export const action = async ({ request }: ActionFunctionArgs): Promise<ActionResult> => {
  const { ctx, billing } = await adminContext(request);
  const form = await request.formData();
  const plan = String(form.get("plan") ?? "");
  const isTest = billingTestMode();

  if (plan === "free") {
    const { appSubscriptions } = await billing.check({ plans: [...PAID_PLANS], isTest });
    for (const sub of appSubscriptions) {
      await billing.cancel({ subscriptionId: sub.id, isTest, prorate: true });
    }
    await setPlan(ctx.shop, "free", ctx.actor);
    return { ok: true, message: "You're on the Free plan. Your paid subscription was cancelled." };
  }
  if (plan === "growth" || plan === "pro") {
    // Throws a redirect to Shopify's approval page; Shopify sends the merchant back here.
    await billing.request({ plan: plan === "pro" ? PLAN_PRO : PLAN_GROWTH, isTest });
  }
  return { ok: false, error: "Unknown plan." };
};

export default function Billing() {
  return <PlansView data={useLoaderData<typeof loader>()} base="/app" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
