// Dispute detail: the recommendation, the evidence pack, the response editor
// and the history. Nothing reaches the bank until the merchant confirms.

import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import type { ActionResult } from "../lib/action-result";
import { FIELD_LABELS, TEXT_FIELDS } from "../lib/disputes/evidence-input";
import type { DraftView } from "../lib/disputes/records.server";
import type { Assessment, EvidenceTextField, OrderSnapshot } from "../lib/disputes/types";
import { Flash } from "./Flash";
import { capitalize } from "./Inbox";
import {
  dueLabel,
  formatDate,
  formatMoney,
  RECOMMENDATION_LABEL,
  RECOMMENDATION_TONE,
  scoreTone,
  STATUS_LABEL,
  STATUS_TONE,
  timeAgo,
} from "./format";

export interface DetailData {
  dispute: {
    id: string;
    shopifyId: string;
    orderId: string | null;
    orderName: string | null;
    type: string;
    status: string;
    reason: string;
    reasonLabel: string;
    networkReasonCode: string | null;
    amountCents: number;
    currencyCode: string;
    initiatedAt: string;
    evidenceDueBy: string | null;
    evidenceSentOn: string | null;
    finalizedOn: string | null;
    daysLeft: number | null;
    decision: string | null;
    redactedAt: string | null;
    snapshotAt: string | null;
  };
  editable: boolean;
  snapshot: OrderSnapshot | null;
  assessment: Assessment | null;
  drafts: DraftView[];
  activity: Array<{ id: string; kind: string; message: string; actor: string | null; createdAt: string }>;
  plan: string;
  shopDomain: string;
  aiDrafts: boolean;
  planAllowsAi: boolean;
  isDemo: boolean;
}

/** Fields that matter most for each reason; the rest hide behind "all fields". */
const REASON_FIELDS: Record<string, EvidenceTextField[]> = {
  FRAUDULENT: ["accessActivityLog"],
  UNRECOGNIZED: ["accessActivityLog"],
  PRODUCT_NOT_RECEIVED: [],
  PRODUCT_UNACCEPTABLE: ["refundPolicyDisclosure", "refundRefusalExplanation"],
  CREDIT_NOT_PROCESSED: ["refundPolicyDisclosure", "refundRefusalExplanation"],
  SUBSCRIPTION_CANCELLED: ["cancellationPolicyDisclosure", "cancellationRebuttal"],
};

const CUSTOMER_FIELDS: EvidenceTextField[] = ["customerFirstName", "customerLastName", "customerEmailAddress"];

const STATUS_ICON = { strong: "check-circle", weak: "alert-circle", missing: "x-circle" } as const;
const STATUS_TONE_ITEM = { strong: "success", weak: "caution", missing: "critical" } as const;

type Fields = Partial<Record<EvidenceTextField, string>>;

function textFields(draft: DraftView | undefined): Fields {
  const out: Fields = {};
  if (!draft) return out;
  for (const key of TEXT_FIELDS) {
    const v = draft.fields[key];
    if (typeof v === "string") out[key] = v;
  }
  return out;
}

export function DisputeView({ data, base }: { data: DetailData; base: string }) {
  const fetcher = useFetcher<ActionResult>();
  const { dispute: d, snapshot, assessment, drafts, editable } = data;
  const latest = drafts[0];
  const [fields, setFields] = useState<Fields>(() => textFields(latest));
  const [showAll, setShowAll] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const busy = fetcher.state !== "idle";
  const pending = fetcher.formData?.get("intent");

  // A new version arrived (drafted, saved, submitted): load it into the editor.
  useEffect(() => {
    setFields(textFields(latest));
    setConfirming(false);
  }, [latest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => JSON.stringify(fields) !== JSON.stringify(textFields(latest)), [fields, latest]);
  const visible = useMemo(() => {
    const keys = new Set<EvidenceTextField>(["uncategorizedText", ...(REASON_FIELDS[d.reason] ?? [])]);
    for (const k of TEXT_FIELDS) if (fields[k]?.trim() && !CUSTOMER_FIELDS.includes(k)) keys.add(k);
    if (showAll) for (const k of TEXT_FIELDS) if (!CUSTOMER_FIELDS.includes(k)) keys.add(k);
    return TEXT_FIELDS.filter((k) => keys.has(k));
  }, [d.reason, fields, showAll]);

  const run = (intent: string, withFields = false) =>
    fetcher.submit({ intent, ...(withFields ? normalizeForSubmit(fields) : {}) }, { method: "post" });

  const due = dueLabel(d.daysLeft);
  const heading = `${d.orderName ?? "Dispute"} · ${capitalize(d.reasonLabel)}`;

  return (
    <s-page heading={heading} inlineSize="large">
      <s-link slot="breadcrumb-actions" href={base}>
        Disputes
      </s-link>
      {editable && !snapshot ? (
        <s-button slot="primary-action" variant="primary" loading={busy && pending === "build"} onClick={() => run("build")}>
          Build evidence pack
        </s-button>
      ) : null}
      {editable && snapshot ? (
        <s-button slot="secondary-actions" loading={busy && pending === "build"} onClick={() => run("build")}>
          Refresh evidence
        </s-button>
      ) : null}

      <s-stack gap="base">
        <Flash result={fetcher.data} />
        <StatusBanner data={data} />

        <s-query-container>
        <s-grid gridTemplateColumns="@container (inline-size > 860px) 2fr 1fr, 1fr" gap="base">
          <s-stack gap="base">
            {/* Recommendation */}
            <s-section heading="Recommendation">
              {assessment ? (
                <s-stack gap="base">
                  <s-stack direction="inline" gap="base" alignItems="center">
                    <s-badge size="large" tone={RECOMMENDATION_TONE[assessment.recommendation]}>
                      {RECOMMENDATION_LABEL[assessment.recommendation]}
                    </s-badge>
                    <s-badge tone={scoreTone(assessment.score)}>{`Evidence ${assessment.score}/100`}</s-badge>
                  </s-stack>
                  <s-unordered-list>
                    {assessment.reasons.map((r) => (
                      <s-list-item key={r}>{r}</s-list-item>
                    ))}
                  </s-unordered-list>
                  <s-divider />
                  <s-heading>What the bank will look for</s-heading>
                  <s-stack gap="small-200">
                    {assessment.checklist.map((item) => (
                      <s-stack key={item.key} direction="inline" gap="small-200" alignItems="start">
                        <s-icon type={STATUS_ICON[item.status]} tone={STATUS_TONE_ITEM[item.status]} />
                        <s-stack gap="none">
                          <s-text type="strong">{item.label}</s-text>
                          <s-text color="subdued">{item.detail}</s-text>
                        </s-stack>
                      </s-stack>
                    ))}
                  </s-stack>
                </s-stack>
              ) : (
                <s-paragraph color="subdued">
                  {d.redactedAt
                    ? "The customer's data was erased at their request, so this pack can't be rebuilt."
                    : "Build the evidence pack to see how strong this case is. StorePilot reads the order, payment checks, shipping and the customer's history from Shopify."}
                </s-paragraph>
              )}
            </s-section>

            {/* Response editor */}
            <s-section heading="Response to the bank">
              {!latest && !editable ? (
                <s-paragraph color="subdued">No response was prepared in StorePilot.</s-paragraph>
              ) : !latest ? (
                <s-stack gap="base">
                  <s-paragraph>
                    {data.aiDrafts
                      ? "Claude will write a rebuttal from the evidence pack. You can edit every word before anything is sent."
                      : data.planAllowsAi
                        ? "StorePilot will write a rebuttal from the evidence pack using its built-in templates (add an Anthropic API key to get Claude-written drafts)."
                        : "StorePilot will write a rebuttal from the evidence pack using its built-in templates. Growth and Pro plans get drafts written by Claude."}
                  </s-paragraph>
                  <s-button variant="primary" loading={busy && pending === "draft"} onClick={() => run("draft")}>
                    Draft the response
                  </s-button>
                </s-stack>
              ) : (
                <s-stack gap="base">
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-badge tone={latest.source === "AI" ? "info" : "neutral"}>
                      {latest.source === "AI" ? "Written by Claude" : latest.source === "TEMPLATE" ? "Template draft" : "Edited by you"}
                    </s-badge>
                    <s-text color="subdued">{`Version ${latest.version} · ${timeAgo(latest.createdAt)}`}</s-text>
                    {latest.submittedAt ? <s-badge tone="success">Submitted</s-badge> : latest.savedToShopifyAt ? <s-badge>Saved in Shopify</s-badge> : null}
                  </s-stack>

                  {latest.notes.length ? (
                    <s-banner tone="info" heading="Before you submit">
                      <s-unordered-list>
                        {latest.notes.map((n) => (
                          <s-list-item key={n}>{n}</s-list-item>
                        ))}
                      </s-unordered-list>
                    </s-banner>
                  ) : null}

                  {visible.map((key) => (
                    <s-text-area
                      key={key}
                      label={FIELD_LABELS[key]}
                      name={key}
                      rows={key === "uncategorizedText" ? 14 : 4}
                      value={fields[key] ?? ""}
                      readOnly={!editable}
                      maxLength={key === "uncategorizedText" ? 4500 : 2000}
                      onInput={(e) => {
                        const value = e.currentTarget.value;
                        setFields((f) => ({ ...f, [key]: value }));
                      }}
                    />
                  ))}

                  <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="small-200">
                    {CUSTOMER_FIELDS.map((key) => (
                      <s-text-field
                        key={key}
                        label={FIELD_LABELS[key]}
                        name={key}
                        value={fields[key] ?? ""}
                        readOnly={!editable}
                        onInput={(e) => {
                          const value = e.currentTarget.value;
                          setFields((f) => ({ ...f, [key]: value }));
                        }}
                      />
                    ))}
                  </s-grid>

                  {editable ? (
                    <s-stack gap="base">
                      {!showAll ? (
                        <s-link onClick={() => setShowAll(true)}>Show every evidence field</s-link>
                      ) : null}
                      {confirming ? (
                        <s-banner tone="critical" heading="Submit this response to the bank?">
                          <s-stack gap="base">
                            <s-paragraph>
                              {`Shopify sends it to the cardholder's bank for ${formatMoney(d.amountCents, d.currencyCode)}. A dispute gets one submission: you can't change or add evidence afterwards.`}
                            </s-paragraph>
                            <s-stack direction="inline" gap="small-200">
                              <s-button variant="primary" tone="critical" loading={busy && pending === "submit"} onClick={() => run("submit", true)}>
                                Submit to the bank
                              </s-button>
                              <s-button onClick={() => setConfirming(false)}>Cancel</s-button>
                            </s-stack>
                          </s-stack>
                        </s-banner>
                      ) : (
                        <s-stack direction="inline" gap="small-200">
                          <s-button variant="primary" disabled={!fields.uncategorizedText?.trim() || busy} onClick={() => setConfirming(true)}>
                            Submit to the bank…
                          </s-button>
                          <s-button loading={busy && pending === "save_shopify"} onClick={() => run("save_shopify", true)}>
                            Save to Shopify
                          </s-button>
                          <s-button disabled={!dirty} loading={busy && pending === "save"} onClick={() => run("save", true)}>
                            Save draft
                          </s-button>
                          <s-button variant="tertiary" loading={busy && pending === "draft"} onClick={() => run("draft")}>
                            Redraft
                          </s-button>
                        </s-stack>
                      )}
                    </s-stack>
                  ) : null}
                </s-stack>
              )}
            </s-section>
          </s-stack>

          <s-stack gap="base">
            <s-section heading="Dispute">
              <s-stack gap="small-200">
                <Row label="Amount" value={formatMoney(d.amountCents, d.currencyCode)} />
                <Row label="Status" badge={{ text: STATUS_LABEL[d.status] ?? d.status, tone: STATUS_TONE[d.status] }} />
                {d.status === "NEEDS_RESPONSE" ? (
                  <Row label="Evidence due" value={formatDate(d.evidenceDueBy)} badge={{ text: due.text, tone: due.tone }} />
                ) : null}
                <Row label="Type" value={d.type === "INQUIRY" ? "Inquiry" : "Chargeback"} />
                <Row label="Reason" value={`${capitalize(d.reasonLabel)}${d.networkReasonCode ? ` (code ${d.networkReasonCode})` : ""}`} />
                <Row label="Opened" value={formatDate(d.initiatedAt)} />
                {d.evidenceSentOn ? <Row label="Evidence sent" value={formatDate(d.evidenceSentOn)} /> : null}
                {d.finalizedOn ? <Row label="Closed" value={formatDate(d.finalizedOn)} /> : null}
              </s-stack>
              {editable ? (
                <s-box paddingBlockStart="base">
                  {d.decision === "ACCEPT" ? (
                    <s-button loading={busy && pending === "undecide"} onClick={() => run("undecide")}>
                      Undo accept
                    </s-button>
                  ) : (
                    <s-button tone="critical" variant="tertiary" loading={busy && pending === "accept"} onClick={() => run("accept")}>
                      Accept the chargeback (don't fight)
                    </s-button>
                  )}
                </s-box>
              ) : null}
            </s-section>

            {snapshot ? <OrderFacts s={snapshot} /> : null}

            {data.activity.length ? (
              <s-section heading="History">
                <s-stack gap="small-200">
                  {data.activity.map((a) => (
                    <s-stack key={a.id} gap="none">
                      <s-text>{a.message}</s-text>
                      <s-text color="subdued">{`${timeAgo(a.createdAt)}${a.actor && a.actor !== "system" ? ` · ${a.actor}` : ""}`}</s-text>
                    </s-stack>
                  ))}
                </s-stack>
              </s-section>
            ) : null}
          </s-stack>
        </s-grid>
        </s-query-container>
      </s-stack>
    </s-page>
  );
}

/** Empty fields must be sent too, so clearing a field actually clears it. */
function normalizeForSubmit(fields: Fields): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of TEXT_FIELDS) out[key] = fields[key] ?? "";
  return out;
}

function StatusBanner({ data }: { data: DetailData }) {
  const d = data.dispute;
  if (d.status === "WON") return <s-banner tone="success" heading="You won this dispute">The funds were returned to your payout balance.</s-banner>;
  if (d.status === "LOST") return <s-banner tone="critical" heading="This dispute was lost">The bank sided with the cardholder.</s-banner>;
  if (d.status === "UNDER_REVIEW")
    return (
      <s-banner tone="info" heading="Evidence submitted">
        {`Sent ${formatDate(d.evidenceSentOn)}. Banks usually decide within 60-75 days; StorePilot updates this page when Shopify does.`}
      </s-banner>
    );
  if (d.status === "NEEDS_RESPONSE" && d.daysLeft !== null && d.daysLeft < 0)
    return <s-banner tone="critical" heading="The evidence deadline has passed">Shopify no longer accepts a response for this dispute.</s-banner>;
  if (d.decision === "ACCEPT")
    return <s-banner tone="info" heading="You chose not to fight this one">It will close when the deadline passes. You can change your mind until then.</s-banner>;
  if (d.type === "INQUIRY")
    return (
      <s-banner tone="info" heading="This is an inquiry, not a chargeback yet">
        The bank is asking for information before deciding. A good answer now often stops it from becoming a chargeback.
      </s-banner>
    );
  return null;
}

function Row({ label, value, badge }: { label: string; value?: string; badge?: { text: string; tone?: string } }) {
  return (
    <s-stack direction="inline" justifyContent="space-between" gap="small-200">
      <s-text color="subdued">{label}</s-text>
      <s-stack direction="inline" gap="small-200" alignItems="center">
        {value ? <s-text>{value}</s-text> : null}
        {badge ? <s-badge tone={badge.tone as "neutral"}>{badge.text}</s-badge> : null}
      </s-stack>
    </s-stack>
  );
}

const AVS_TEXT: Record<string, string> = {
  Y: "address and ZIP match", X: "address and ZIP match", D: "address and ZIP match", F: "address and ZIP match", M: "address and ZIP match",
  A: "address matches, ZIP doesn't", B: "address matches, ZIP not checked", P: "ZIP matches, address not checked", W: "ZIP matches, address doesn't", Z: "ZIP matches, address doesn't",
  N: "no match", C: "no match",
};

function OrderFacts({ s }: { s: OrderSnapshot }) {
  const name = [s.customer?.firstName, s.customer?.lastName].filter(Boolean).join(" ");
  const fulfilment = s.fulfillments.find((f) => f.status !== "CANCELLED");
  const refunded = s.refunds.reduce((sum, r) => sum + r.amountCents, 0);
  return (
    <s-section heading="Evidence pack">
      <s-stack gap="small-200">
        <Row label="Order" value={`${s.orderName} · ${formatDate(s.createdAt)}`} />
        <Row label="Total" value={formatMoney(s.totalCents, s.currencyCode)} />
        {s.customer ? (
          <Row
            label="Customer"
            value={`${name || "Unnamed"} · ${s.customer.ordersCount} order${s.customer.ordersCount === 1 ? "" : "s"}`}
          />
        ) : (
          <Row label="Customer" value="Guest checkout" />
        )}
        <Row label="Card" value={[s.payment.cardBrand, s.payment.last4 ? `•••• ${s.payment.last4}` : null].filter(Boolean).join(" ") || "Unknown"} />
        <Row label="AVS" value={s.payment.avsResultCode ? `${s.payment.avsResultCode}: ${AVS_TEXT[s.payment.avsResultCode] ?? "other"}` : "Not checked"} />
        <Row label="CVV" value={s.payment.cvvResultCode === "M" ? "Match" : s.payment.cvvResultCode === "N" ? "No match" : "Not checked"} />
        {s.payment.browserIp ? <Row label="IP" value={s.payment.browserIp} /> : null}
        <Row
          label="Shipping"
          value={
            fulfilment
              ? `${fulfilment.trackingCompany ?? "Carrier"}${fulfilment.deliveredAt ? `, delivered ${formatDate(fulfilment.deliveredAt)}` : `, ${(fulfilment.displayStatus ?? fulfilment.status).toLowerCase().replace(/_/g, " ")}`}`
              : "Not fulfilled"
          }
        />
        {fulfilment?.trackingUrl ? (
          <s-link href={fulfilment.trackingUrl} target="_blank">
            {`Tracking ${fulfilment.trackingNumber ?? ""}`}
          </s-link>
        ) : null}
        {refunded ? <Row label="Refunded" value={formatMoney(refunded, s.currencyCode)} /> : null}
        <s-divider />
        <s-text color="subdued">Items</s-text>
        {s.lineItems.map((li, i) => (
          <s-text key={i}>{`${li.quantity} × ${li.title}${li.variantTitle ? ` (${li.variantTitle})` : ""}`}</s-text>
        ))}
      </s-stack>
    </s-section>
  );
}
