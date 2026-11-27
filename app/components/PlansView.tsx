import { useFetcher } from "react-router";
import type { ActionResult } from "../lib/action-result";
import { PLANS, type PlanKey } from "../lib/billing/plans";
import type { PlansRecord } from "../lib/disputes/views.server";
import { Flash } from "./Flash";
import { formatMoney } from "./format";

export interface PlansData {
  current: PlanKey;
  packsUsed: number;
  testMode: boolean;
  isDemo: boolean;
  record?: PlansRecord;
}

/** One line in the store's own numbers on why a plan pays for itself, or null. */
export function recordLine(r: PlansRecord | undefined): string | null {
  if (!r) return null;
  const money = (c: number) => formatMoney(c, r.currencyCode);
  const parts: string[] = [];
  if (r.open) parts.push(`${money(r.atStakeCents)} is at stake in ${r.open} open dispute${r.open === 1 ? "" : "s"}`);
  if (r.unanswered) parts.push(`${money(r.unansweredCents)} was lost to disputes nobody answered`);
  if (r.won) parts.push(`you have won back ${money(r.recoveredCents)} in disputes`);
  if (!parts.length) return null;
  const line = parts.join("; ");
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}.`;
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
        {recordLine(data.record) ? (
          <s-banner tone="info" heading="Your store so far">
            {recordLine(data.record)}
          </s-banner>
        ) : null}
        {data.testMode && !data.isDemo ? (
          <s-banner tone="info">Billing is in test mode: approving a plan won&apos;t charge the store.</s-banner>
        ) : null}
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          {ORDER.map((key) => {
            const plan = PLANS[key];
            const current = key === data.current;
            return (
              <s-section key={key} heading={plan.label}>
                <s-stack gap="base">
                  <s-heading>{plan.priceUsd === 0 ? "$0" :`$${plan.priceUsd} / month`}</s-heading>
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
                      loading={(busy && pendingPlan === key) || undefined}
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
