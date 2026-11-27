import { useState } from "react";
import { useFetcher } from "react-router";
import type { ActionResult } from "../lib/action-result";
import { Flash } from "./Flash";
import { formatDate } from "./format";

export interface SettingsData {
  shop: {
    domain: string;
    name: string | null;
    supportEmail: string;
    refundPolicy: string;
    shippingPolicy: string;
    autoDraft: boolean;
    minFightAmount: number;
    deadlineAlerts: boolean;
    alertEmail: string;
    ownerEmail: string;
    currencyCode: string;
    lastSyncedAt: string | null;
  };
  plan: string;
  planHasAlerts: boolean;
  emailConfigured: boolean;
  aiConfigured: boolean;
  privacy: Array<{ id: string; topic: string; status: string; createdAt: string; hasExport: boolean }>;
  isDemo: boolean;
}

const TOPIC_LABEL: Record<string, string> = {
  "customers/data_request": "Customer data request",
  "customers/redact": "Customer erasure",
  "shop/redact": "Shop erasure",
};

export function SettingsView({ data, base }: { data: SettingsData; base: string }) {
  const fetcher = useFetcher<ActionResult>();
  const [form, setForm] = useState({
    supportEmail: data.shop.supportEmail,
    refundPolicy: data.shop.refundPolicy,
    shippingPolicy: data.shop.shippingPolicy,
    minFightAmount: String(data.shop.minFightAmount),
    autoDraft: data.shop.autoDraft,
    deadlineAlerts: data.shop.deadlineAlerts,
    alertEmail: data.shop.alertEmail,
  });
  const busy = fetcher.state !== "idle";
  const set = (key: keyof typeof form) => (e: Event) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  return (
    <s-page heading="Settings">
      <s-link slot="breadcrumb-actions" href={base}>
        Disputes
      </s-link>
      <s-button
        slot="primary-action"
        variant="primary"
        loading={busy && fetcher.formData?.get("intent") === "save"}
        onClick={() =>
          fetcher.submit(
            {
              intent: "save",
              ...form,
              autoDraft: form.autoDraft ? "true" : "false",
              deadlineAlerts: form.deadlineAlerts ? "true" : "false",
            },
            { method: "post" },
          )
        }
      >
        Save
      </s-button>
      <s-stack gap="base">
        <Flash result={fetcher.data} />

        <s-section heading="Policies quoted in responses">
          <s-stack gap="base">
            <s-paragraph color="subdued">
              Loaded from your store&apos;s published policies. Edit them here if the bank should see a shorter or more
              specific version.
            </s-paragraph>
            <s-text-area label="Refund policy" rows={5} value={form.refundPolicy} onInput={set("refundPolicy")} />
            <s-text-area label="Shipping policy" rows={5} value={form.shippingPolicy} onInput={set("shippingPolicy")} />
            <s-button
              variant="tertiary"
              loading={busy && fetcher.formData?.get("intent") === "reload_policies"}
              onClick={() => fetcher.submit({ intent: "reload_policies" }, { method: "post" })}
            >
              Reload from my store
            </s-button>
          </s-stack>
        </s-section>

        <s-section heading="Responses">
          <s-stack gap="base">
            <s-email-field
              label="Support email"
              details="Shown in responses as the address the customer could have used to reach you."
              value={form.supportEmail}
              onInput={set("supportEmail")}
            />
            <s-number-field
              label={`Don't recommend fighting disputes under (${data.shop.currencyCode})`}
              details="Below this amount StorePilot recommends accepting unless the evidence is very strong."
              min={0}
              value={form.minFightAmount}
              onInput={set("minFightAmount")}
            />
            <s-checkbox
              label="Draft a response as soon as a dispute arrives (Pro)"
              checked={form.autoDraft}
              disabled={data.plan !== "pro"}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                setForm((f) => ({ ...f, autoDraft: checked }));
              }}
            />
            <s-text color="subdued">
              {data.aiConfigured
                ? "Claude drafting is configured on this server."
                : "No Anthropic API key is configured on this server, so drafts use StorePilot's templates."}
            </s-text>
          </s-stack>
        </s-section>

        <s-section heading="Deadline alerts">
          <s-stack gap="base">
            <s-paragraph color="subdued">
              An email when a new dispute arrives and again 7, 3 and 1 day before its deadline, so nothing expires
              unanswered. Disputes you&apos;ve accepted or already submitted are left out.
            </s-paragraph>
            {!data.planHasAlerts ? (
              <s-banner tone="info">
                Deadline alerts come with the Growth and Pro plans. <s-link href={`${base}/billing`}>Compare plans</s-link>
              </s-banner>
            ) : !data.emailConfigured ? (
              <s-banner tone="warning">
                Email isn&apos;t configured on this StorePilot server yet (RESEND_API_KEY and ALERTS_FROM_EMAIL), so
                alerts can&apos;t be sent. The deadline banner on the Disputes page still works.
              </s-banner>
            ) : null}
            <s-checkbox
              label="Email me about dispute deadlines"
              checked={form.deadlineAlerts}
              disabled={!data.planHasAlerts}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                setForm((f) => ({ ...f, deadlineAlerts: checked }));
              }}
            />
            <s-email-field
              label="Send alerts to"
              placeholder={data.shop.ownerEmail || "you@example.com"}
              details={
                data.shop.ownerEmail
                  ? `Leave empty to use your store's email (${data.shop.ownerEmail}).`
                  : "Your store has no email on file, so add one here to get alerts."
              }
              disabled={!data.planHasAlerts}
              value={form.alertEmail}
              onInput={set("alertEmail")}
            />
          </s-stack>
        </s-section>

        <s-section heading="Privacy requests">
          {data.privacy.length === 0 ? (
            <s-paragraph color="subdued">
              No customer data or erasure requests yet. When Shopify forwards one, it is handled automatically and
              listed here.
            </s-paragraph>
          ) : (
            <s-stack gap="small-200">
              {data.privacy.map((r) => (
                <s-stack key={r.id} direction="inline" justifyContent="space-between">
                  <s-text>{`${TOPIC_LABEL[r.topic] ?? r.topic} · ${formatDate(r.createdAt)}`}</s-text>
                  {r.hasExport ? (
                    <s-link href={`${base}/settings/export/${r.id}`} target="_blank">
                      Download export
                    </s-link>
                  ) : (
                    <s-badge tone="success">Done</s-badge>
                  )}
                </s-stack>
              ))}
            </s-stack>
          )}
        </s-section>

        <s-section heading="Store">
          <s-stack gap="small-200">
            <s-text>{`${data.shop.name ?? data.shop.domain} (${data.shop.domain})`}</s-text>
            <s-text color="subdued">
              {data.shop.lastSyncedAt ? `Last synced ${formatDate(data.shop.lastSyncedAt)}` : "Not synced yet"}
            </s-text>
            <s-link href="/privacy" target="_blank">
              Privacy policy
            </s-link>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
