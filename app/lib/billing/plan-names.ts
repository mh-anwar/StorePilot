// Billing plan names as registered with the Shopify Billing API.
// Kept in their own module so client code can import them without pulling in server code.
export const PLAN_GROWTH = "StorePilot Growth";
export const PLAN_PRO = "StorePilot Pro";
export const PAID_PLANS = [PLAN_GROWTH, PLAN_PRO] as const;
export type PaidPlanName = (typeof PAID_PLANS)[number];
