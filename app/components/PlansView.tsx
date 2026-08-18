import { useFetcher } from "react-router";
import type { ActionResult } from "../lib/action-result";
import { PLANS, type PlanKey } from "../lib/billing/plans";
import { Flash } from "./Flash";

export interface PlansData {
  current: PlanKey;
  packsUsed: number;
  testMode: boolean;
  isDemo: boolean;
}

const ORDER: PlanKey[] = ["free", "growth", "pro"];

export function PlansView({ data, base }: { data: PlansData; base: string }) {
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const pendingPlan = fetcher.formData?.get("plan");

  return (
    <s-page heading="Plans">
      <s-link slot="breadcrumb-actions" href={base}>
        Disputes
      </s-link>
      <s-stack gap="base">
        <Flash result={fetcher.data} />
        <s-paragraph>
          A flat monthly price. You keep 100% of every dispute you win; StorePilot never takes a cut of recovered
          funds.
        </s-paragraph>
        {data.testMode && !data.isDemo ? (
          <s-banner tone="info">Billing is in test mode: approving a plan won't charge the store.</s-banner>
        ) : null}
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          {ORDER.map((key) => {
            const plan = PLANS[key];
            const current = key === data.current;
            return (
              <s-section key={key} heading={plan.label}>
                <s-stack gap="base">
                  <s-heading>{plan.priceUsd === 0 ? "Free" : `$${plan.priceUsd} / month`}</s-heading>
                  {plan.priceUsd ? <s-text color="subdued">7-day free trial</s-text> : null}
                  <s-unordered-list>
                    {plan.features.map((f) => (
                      <s-list-item key={f}>{f}</s-list-item>
                    ))}
                  </s-unordered-list>
                  {current ? (
                    <s-badge tone="success">Current plan</s-badge>
                  ) : (
                    <s-button
                      variant={key === "free" ? "secondary" : "primary"}
                      loading={busy && pendingPlan === key}
                      onClick={() => fetcher.submit({ plan: key }, { method: "post" })}
                    >
                      {key === "free" ? "Downgrade to Free" : `Choose ${plan.label}`}
                    </s-button>
                  )}
                </s-stack>
              </s-section>
            );
          })}
        </s-grid>
        <s-text color="subdued">{`${data.packsUsed} evidence pack${data.packsUsed === 1 ? "" : "s"} built this month.`}</s-text>
      </s-stack>
    </s-page>
  );
}
