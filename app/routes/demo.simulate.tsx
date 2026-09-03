// Demo-only controls that play Shopify's part: a dispute arriving, the bank
// deciding, or starting over.
import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { demoContext, resetDemo, simulateBankDecisions, simulateNewDispute } from "../lib/demo/demo.server";

export const loader = () => redirect("/demo");

export const action = async ({ request }: ActionFunctionArgs) => {
  const intent = String((await request.formData()).get("intent"));
  if (intent === "reset") {
    await resetDemo();
    return redirect("/demo");
  }
  const ctx = await demoContext();
  if (intent === "new_dispute") {
    const id = await simulateNewDispute(ctx);
    return redirect(`/demo/disputes/${id}`);
  }
  if (intent === "decide") {
    await simulateBankDecisions(ctx);
    return redirect("/demo?tab=closed");
  }
  return redirect("/demo");
};
