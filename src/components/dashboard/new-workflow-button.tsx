"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

const TEMPLATES = [
  {
    id: "blank",
    name: "Blank workflow",
    description: "Start from scratch",
    definition: {
      trigger: { type: "manual" },
      steps: [] as unknown[],
    },
  },
  {
    id: "fraud-triage",
    name: "Fraud triage on new orders",
    description: "Classify every order, route suspicious ones to a review queue",
    definition: {
      trigger: { type: "shopify", topic: "orders/create" },
      steps: [
        {
          id: "analyze",
          type: "llm.reason",
          config: {
            prompt:
              "Given the order, assess whether it looks like potential fraud (mismatched ship/bill, unusually large, rush shipping to free-mail). Return a score 0-1 and a brief rationale.",
            output: {
              type: "object",
              properties: {
                fraud_score: { type: "number" },
                rationale: { type: "string" },
              },
            },
          },
        },
        {
          id: "check",
          type: "condition",
          config: { expression: "steps.analyze.fraud_score > 0.6" },
        },
        {
          id: "flag",
          type: "proposal.gate",
          config: {
            actionType: "store.tag_customer",
            summary: "Flag customer for fraud review",
            rationale: "{{steps.analyze.output.rationale}}",
            actionConfig: {
              customerId: "{{trigger.payload.customer.id}}",
              tags: ["fraud-review"],
            },
          },
        },
      ],
    },
  },
  {
    id: "low-stock",
    name: "Daily low-stock report with restock proposals",
    description:
      "Every morning, pull the low-stock list; for each item propose a restock quantity the merchant can approve.",
    definition: {
      trigger: { type: "schedule", intervalMinutes: 1440 },
      steps: [
        { id: "report", type: "store.low_stock_report", config: { limit: 20 } },
        {
          id: "plan",
          type: "llm.reason",
          config: {
            prompt:
              "For each low-stock product in the report, recommend a restock quantity considering 30 days of typical velocity. Return a list.",
            output: {
              type: "object",
              properties: {
                plan: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      productId: { type: "integer" },
                      recommendQty: { type: "integer" },
                      rationale: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        {
          id: "notify",
          type: "notify.email",
          config: {
            to: "owner@example.com",
            subject: "Daily restock plan",
            body: "See proposals in StorePilot:\n\n{{steps.plan.output.plan}}",
          },
          onError: "continue",
        },
      ],
    },
  },
  {
    id: "vip-tag",
    name: "Tag VIP customers on big orders",
    description: "When an order over $500 comes in, tag the customer 'vip'.",
    definition: {
      trigger: { type: "shopify", topic: "orders/create" },
      steps: [
        {
          id: "check",
          type: "condition",
          config: {
            expression: "trigger.payload.total_price > 500",
          },
        },
        {
          id: "tag",
          type: "store.tag_customer",
          config: {
            customerId: "{{trigger.payload.customer.id}}",
            tags: ["vip"],
          },
        },
      ],
    },
  },
];

export function NewWorkflowButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const router = useRouter();

  async function create(templateId: string) {
    setPending(templateId);
    const t = TEMPLATES.find((x) => x.id === templateId)!;
    const r = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: t.name,
        description: t.description,
        trigger: t.definition.trigger,
        steps: t.definition.steps,
      }),
    });
    const j = await r.json();
    setPending(null);
    setOpen(false);
    if (j.workflow?.id) router.push(`/dashboard/workflows/${j.workflow.id}`);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm"
      >
        <Plus className="h-4 w-4" />
        New workflow
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold">Start a workflow</h2>
              <p className="text-sm text-muted-foreground">
                Pick a template or start blank.
              </p>
            </div>
            <div className="p-3 space-y-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => create(t.id)}
                  disabled={pending !== null}
                  className="w-full text-left border border-border rounded-lg p-3 hover:bg-muted flex items-start gap-3"
                >
                  <div className="flex-1">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                  </div>
                  {pending === t.id && <Loader2 className="h-4 w-4 animate-spin" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
