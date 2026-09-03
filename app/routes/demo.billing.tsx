// Plans in the demo switch instantly; the embedded app goes through Shopify's
// approval page instead (see app.billing.tsx).
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { PlansView } from "../components/PlansView";
import type { ActionResult } from "../lib/action-result";
import { setPlan } from "../lib/billing/billing.server";
import { PLANS, type PlanKey } from "../lib/billing/plans";
import { packsUsed } from "../lib/disputes/records.server";
import { demoContext } from "../lib/demo/demo.server";

export const loader = async (_args: LoaderFunctionArgs) => {
  const ctx = await demoContext();
  return { current: ctx.shop.plan as PlanKey, packsUsed: await packsUsed(ctx.shop.id), testMode: true, isDemo: true };
};

export const action = async ({ request }: ActionFunctionArgs): Promise<ActionResult> => {
  const ctx = await demoContext();
  const plan = String((await request.formData()).get("plan")) as PlanKey;
  if (!(plan in PLANS)) return { ok: false, error: "Unknown plan." };
  await setPlan(ctx.shop, plan, ctx.actor);
  return { ok: true, message: `Demo store switched to ${PLANS[plan].label}. In a real store Shopify asks the merchant to approve the charge first.` };
};

export default function DemoBilling() {
  return <PlansView data={useLoaderData<typeof loader>()} base="/demo" />;
}
