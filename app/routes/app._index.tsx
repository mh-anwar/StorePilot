import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { Inbox } from "../components/Inbox";
import { adminContext } from "../lib/app-context.server";
import { billingTestMode, planFromSubscriptions, setPlan } from "../lib/billing/billing.server";
import { PAID_PLANS } from "../lib/billing/plan-names";
import { inboxAction, inboxLoader } from "../lib/handlers.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { ctx, billing } = await adminContext(request);
  // Shopify is the source of truth for the plan; mirror it on the home page.
  try {
    const { appSubscriptions } = await billing.check({ plans: [...PAID_PLANS], isTest: billingTestMode() });
    ctx.shop = await setPlan(ctx.shop, planFromSubscriptions(appSubscriptions));
  } catch (error) {
    console.warn("[billing] check failed", error);
  }
  return inboxLoader(ctx, request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { ctx } = await adminContext(request);
  return inboxAction(ctx, request);
};

export default function Index() {
  return <Inbox data={useLoaderData<typeof loader>()} base="/app" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
