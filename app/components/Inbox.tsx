// Dispute inbox: the numbers that matter at the top, then every dispute
// sorted by deadline.

import { useFetcher } from "react-router";
import type { ActionResult } from "../lib/action-result";
import type { DashboardStats, InboxRow, InboxTab } from "../lib/disputes/views.server";
import { Flash } from "./Flash";
import {
  dueLabel,
  formatMoney,
  RECOMMENDATION_LABEL,
  RECOMMENDATION_TONE,
  scoreTone,
  STATUS_LABEL,
  STATUS_TONE,
  timeAgo,
} from "./format";

export interface InboxData {
  shopName: string;
  tab: InboxTab;
  stats: DashboardStats;
  rows: InboxRow[];
  activity: Array<{ id: string; kind: string; message: string; disputeId: string | null; createdAt: string }>;
  isDemo: boolean;
}

const TAB_LABEL: Record<InboxTab, string> = {
  open: "Needs response",
  submitted: "Submitted",
  closed: "Closed",
  all: "All",
};

function Stat({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "critical" | "success" }) {
  return (
    <s-box padding="base" background="base" border="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-text color="subdued">{label}</s-text>
        <s-heading>
          <s-text tone={tone} fontVariantNumeric="tabular-nums">
            {value}
          </s-text>
        </s-heading>
        {detail ? <s-text color="subdued">{detail}</s-text> : null}
      </s-stack>
    </s-box>
  );
}

export function Inbox({ data, base }: { data: InboxData; base: string }) {
  const fetcher = useFetcher<ActionResult>();
  const { stats, rows, tab } = data;
  const cur = stats.currencyCode;
  const syncing = fetcher.state !== "idle";

  return (
    <s-page heading="Disputes" inlineSize="large">
      <s-button
        slot="primary-action"
        variant="primary"
        loading={syncing}
        onClick={() => fetcher.submit({ intent: "sync" }, { method: "post" })}
      >
        Sync from Shopify
      </s-button>
      <s-button slot="secondary-actions" href={`${base}/settings`}>
        Settings
      </s-button>

      <s-stack gap="base">
        <Flash result={fetcher.data} />
        {stats.dueSoon > 0 ? (
          <s-banner tone="warning" heading={`${stats.dueSoon} dispute${stats.dueSoon === 1 ? "" : "s"} due in the next 3 days`}>
            Shopify closes a dispute as lost if no evidence arrives by the deadline.
          </s-banner>
        ) : null}

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap="base">
          <Stat
            label="Needs response"
            value={String(stats.open)}
            detail={`${formatMoney(stats.atStakeCents, cur)} at stake`}
            tone={stats.dueSoon ? "critical" : undefined}
          />
          <Stat label="Recovered" value={formatMoney(stats.recoveredCents, cur)} detail={`${stats.won} won`} tone="success" />
          <Stat
            label="Win rate"
            value={stats.winRate === null ? "–" : `${stats.winRate}%`}
            detail={`${stats.won} won, ${stats.lost} lost`}
          />
          <Stat
            label={`${stats.plan.label} plan`}
            value={stats.plan.packsLimit === null ? "Unlimited" : `${stats.plan.packsLeft} left`}
            detail={
              stats.plan.packsLimit === null
                ? `${stats.plan.packsUsed} packs this month`
                : `${stats.plan.packsUsed} of ${stats.plan.packsLimit} packs used this month`
            }
          />
        </s-grid>

        <s-section padding="none" accessibilityLabel="Disputes">
          <s-box padding="base">
            <s-stack direction="inline" gap="small-200">
              {(Object.keys(TAB_LABEL) as InboxTab[]).map((t) => (
                <s-button key={t} href={`${base}?tab=${t}`} variant={t === tab ? "primary" : "secondary"}>
                  {TAB_LABEL[t]}
                </s-button>
              ))}
            </s-stack>
          </s-box>
          {rows.length === 0 ? (
            <s-box padding="large-200">
              <s-stack alignItems="center" gap="small-200">
                <s-heading>{tab === "open" ? "Nothing needs a response" : "No disputes here"}</s-heading>
                <s-paragraph color="subdued">
                  {tab === "open"
                    ? "New Shopify Payments disputes show up here the moment Shopify opens them."
                    : "Try another tab, or sync from Shopify."}
                </s-paragraph>
              </s-stack>
            </s-box>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Order</s-table-header>
                <s-table-header>Reason</s-table-header>
                <s-table-header format="currency">Amount</s-table-header>
                <s-table-header>Deadline</s-table-header>
                <s-table-header>Evidence</s-table-header>
                <s-table-header listSlot="secondary">Status</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {rows.map((r) => {
                  const due = dueLabel(r.daysLeft);
                  return (
                    <s-table-row key={r.id} clickDelegate={`dispute-${r.id}`}>
                      <s-table-cell>
                        <s-link id={`dispute-${r.id}`} href={`${base}/disputes/${r.id}`}>
                          {r.orderName ?? "No order"}
                        </s-link>
                        {r.type === "INQUIRY" ? <s-badge tone="info">Inquiry</s-badge> : null}
                      </s-table-cell>
                      <s-table-cell>{capitalize(r.reasonLabel)}</s-table-cell>
                      <s-table-cell>{formatMoney(r.amountCents, r.currencyCode)}</s-table-cell>
                      <s-table-cell>
                        {r.status === "NEEDS_RESPONSE" ? <s-badge tone={due.tone}>{due.text}</s-badge> : <s-text color="subdued">–</s-text>}
                      </s-table-cell>
                      <s-table-cell>
                        {r.score === null ? (
                          <s-text color="subdued">Not built</s-text>
                        ) : (
                          <s-stack direction="inline" gap="small-200">
                            <s-badge tone={scoreTone(r.score)}>{`${r.score}/100`}</s-badge>
                            {r.recommendation ? (
                              <s-badge tone={RECOMMENDATION_TONE[r.recommendation]}>
                                {RECOMMENDATION_LABEL[r.recommendation]}
                              </s-badge>
                            ) : null}
                          </s-stack>
                        )}
                      </s-table-cell>
                      <s-table-cell>
                        <s-badge tone={STATUS_TONE[r.status]}>
                          {r.decision === "ACCEPT" && r.status === "NEEDS_RESPONSE" ? "Accepting" : STATUS_LABEL[r.status] ?? r.status}
                        </s-badge>
                      </s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>
            </s-table>
          )}
        </s-section>

        {data.activity.length ? (
          <s-section heading="Recent activity">
            <s-stack gap="small-200">
              {data.activity.map((a) => (
                <s-stack key={a.id} direction="inline" gap="small-200" justifyContent="space-between">
                  {a.disputeId ? (
                    <s-link href={`${base}/disputes/${a.disputeId}`}>{a.message}</s-link>
                  ) : (
                    <s-text>{a.message}</s-text>
                  )}
                  <s-text color="subdued">{timeAgo(a.createdAt)}</s-text>
                </s-stack>
              ))}
            </s-stack>
          </s-section>
        ) : null}
      </s-stack>
    </s-page>
  );
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
