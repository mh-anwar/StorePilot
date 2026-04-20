"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Play,
  Plus,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type Step = {
  id: string;
  type: string;
  config: Record<string, unknown>;
  requiresApproval?: boolean;
  onError?: "continue" | "fail";
};

type Trigger =
  | { type: "manual" }
  | { type: "schedule"; intervalMinutes?: number }
  | { type: "shopify"; topic: string }
  | { type: "http"; token?: string };

type WorkflowValue = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "paused" | "archived";
  trigger: Trigger;
  steps: Step[];
};

type StepTypeInfo = { type: string; category: string; description: string };

export function WorkflowEditor({
  workflow,
  stepTypes,
}: {
  workflow: WorkflowValue;
  stepTypes: StepTypeInfo[];
}) {
  const [state, setState] = useState(workflow);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPayload, setTestPayload] = useState("{}");
  const router = useRouter();

  function save() {
    setStatus(null);
    start(async () => {
      const r = await fetch(`/api/workflows/${state.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          description: state.description,
          status: state.status,
          trigger: state.trigger,
          steps: state.steps,
        }),
      });
      setStatus(r.ok ? "Saved." : `Failed: ${(await r.json()).error ?? r.status}`);
      router.refresh();
    });
  }

  async function runNow(triggerData: unknown = {}) {
    setRunning(true);
    setStatus("Running…");
    try {
      const r = await fetch(`/api/workflows/${state.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerData }),
      });
      const j = await r.json();
      if (!r.ok) setStatus(j.error ?? "Run failed");
      else {
        setStatus(`Run ${j.runId} completed.`);
        router.refresh();
        router.push(`/dashboard/workflows/${state.id}/runs/${j.runId}`);
      }
    } finally {
      setRunning(false);
      setShowTestModal(false);
    }
  }

  function openTest() {
    // Seed with a sensible sample based on trigger type.
    const t = state.trigger;
    const sample =
      t.type === "shopify"
        ? sampleForShopifyTopic((t as { topic: string }).topic)
        : t.type === "schedule"
          ? { scheduledAt: new Date().toISOString() }
          : { sample: true };
    setTestPayload(JSON.stringify(sample, null, 2));
    setShowTestModal(true);
  }

  function addStep(type: string) {
    const base: Step = { id: "s" + (state.steps.length + 1), type, config: defaultConfigFor(type) };
    setState({ ...state, steps: [...state.steps, base] });
  }

  function removeStep(i: number) {
    setState({ ...state, steps: state.steps.filter((_, k) => k !== i) });
  }

  function updateStep(i: number, patch: Partial<Step>) {
    setState({
      ...state,
      steps: state.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)),
    });
  }

  function moveStep(i: number, direction: -1 | 1) {
    const j = i + direction;
    if (j < 0 || j >= state.steps.length) return;
    const next = [...state.steps];
    const [s] = next.splice(i, 1);
    next.splice(j, 0, s);
    setState({ ...state, steps: next });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-64">
          <input
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            className="text-2xl font-bold bg-transparent w-full border-b border-transparent focus:border-border focus:outline-none"
          />
          <input
            value={state.description ?? ""}
            onChange={(e) => setState({ ...state, description: e.target.value })}
            placeholder="Add a description…"
            className="mt-1 text-sm text-muted-foreground bg-transparent w-full focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={state.status}
            onChange={(e) =>
              setState({ ...state, status: e.target.value as WorkflowValue["status"] })
            }
            className="px-3 py-2 rounded-lg bg-muted border border-border text-sm"
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
          <button
            onClick={() => runNow({})}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run now
          </button>
          <button
            onClick={openTest}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
          >
            Test with payload
          </button>
        </div>
      </div>

      {showTestModal && (
        <div
          onClick={() => setShowTestModal(false)}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-xl max-w-2xl w-full"
          >
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold">Test with a trigger payload</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your steps receive this as <code>{"{{trigger.*}}"}</code>. Good
                for dry-running a workflow against a realistic order without
                waiting for Shopify to fire one.
              </p>
            </div>
            <div className="p-4">
              <textarea
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                rows={14}
                className="w-full font-mono text-xs px-3 py-2 rounded bg-muted border border-border"
              />
            </div>
            <div className="p-4 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={() => setShowTestModal(false)}
                className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  try {
                    runNow(JSON.parse(testPayload));
                  } catch (e) {
                    setStatus(`Invalid JSON: ${(e as Error).message}`);
                  }
                }}
                disabled={running}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
              >
                {running && <Loader2 className="h-4 w-4 animate-spin" />}
                Run with this payload
              </button>
            </div>
          </div>
        </div>
      )}

      {status && <p className="text-xs text-muted-foreground">{status}</p>}

      <div className="border border-border rounded-xl p-4">
        <h3 className="font-semibold mb-3">Trigger</h3>
        <TriggerEditor
          trigger={state.trigger}
          onChange={(t) => setState({ ...state, trigger: t })}
        />
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Steps</h3>
        {state.steps.map((step, i) => (
          <StepCard
            key={i}
            index={i}
            step={step}
            onChange={(p) => updateStep(i, p)}
            onRemove={() => removeStep(i)}
            onMoveUp={i > 0 ? () => moveStep(i, -1) : null}
            onMoveDown={
              i < state.steps.length - 1 ? () => moveStep(i, 1) : null
            }
            isLast={i === state.steps.length - 1}
          />
        ))}
        <AddStepMenu stepTypes={stepTypes} onAdd={addStep} />
      </div>
    </div>
  );
}

function TriggerEditor({
  trigger,
  onChange,
}: {
  trigger: Trigger;
  onChange: (t: Trigger) => void;
}) {
  return (
    <div className="space-y-3">
      <select
        value={trigger.type}
        onChange={(e) => {
          const next = e.target.value as Trigger["type"];
          if (next === "manual") onChange({ type: "manual" });
          else if (next === "schedule") onChange({ type: "schedule", intervalMinutes: 60 });
          else if (next === "shopify") onChange({ type: "shopify", topic: "orders/create" });
          else onChange({ type: "http", token: cryptoRandom() });
        }}
        className="px-3 py-2 rounded-lg bg-muted border border-border text-sm"
      >
        <option value="manual">Manual / Run now</option>
        <option value="schedule">Schedule</option>
        <option value="shopify">Shopify event</option>
        <option value="http">HTTP webhook</option>
      </select>

      {trigger.type === "schedule" && (
        <div className="flex items-center gap-2 text-sm">
          Every
          <input
            type="number"
            min={1}
            value={trigger.intervalMinutes ?? 60}
            onChange={(e) =>
              onChange({ type: "schedule", intervalMinutes: Number(e.target.value) })
            }
            className="w-20 px-2 py-1 rounded bg-muted border border-border"
          />
          minutes
        </div>
      )}
      {trigger.type === "shopify" && (
        <select
          value={trigger.topic}
          onChange={(e) => onChange({ type: "shopify", topic: e.target.value })}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-sm w-64"
        >
          <option value="orders/create">Order created</option>
          <option value="orders/updated">Order updated</option>
          <option value="orders/cancelled">Order cancelled</option>
          <option value="products/create">Product created</option>
          <option value="products/update">Product updated</option>
          <option value="inventory_levels/update">Inventory level updated</option>
          <option value="customers/create">Customer created</option>
          <option value="customers/update">Customer updated</option>
        </select>
      )}
      {trigger.type === "http" && (
        <div className="text-xs text-muted-foreground font-mono">
          POST /api/workflows/[id]/http?token={trigger.token?.slice(0, 10)}…
        </div>
      )}
    </div>
  );
}

function StepCard({
  index,
  step,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isLast,
}: {
  index: number;
  step: Step;
  onChange: (patch: Partial<Step>) => void;
  onRemove: () => void;
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(true);
  // Track the raw text in the config textarea so users can type invalid
  // JSON transiently without the editor snapping back. We only commit
  // the parsed object to state when it parses cleanly.
  const [rawConfig, setRawConfig] = useState(() =>
    JSON.stringify(step.config, null, 2)
  );
  const [configErr, setConfigErr] = useState<string | null>(null);
  return (
    <>
      <div className="border border-border rounded-xl bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setOpen((o) => !o)}
              className="p-1 rounded hover:bg-muted"
            >
              {open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <input
              value={step.id}
              onChange={(e) => onChange({ id: e.target.value })}
              className="font-mono text-xs bg-transparent border-b border-transparent focus:border-border focus:outline-none w-20"
            />
            <span className="text-sm">·</span>
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
              {step.type}
            </span>
            {step.requiresApproval && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                approval
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onMoveUp?.()}
              disabled={!onMoveUp}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-30"
              title="Move up"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onMoveDown?.()}
              disabled={!onMoveDown}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-30"
              title="Move down"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onRemove}
              className="p-2 rounded hover:bg-muted text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-border p-4 space-y-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">Config (JSON)</span>
              <textarea
                value={rawConfig}
                onChange={(e) => {
                  setRawConfig(e.target.value);
                  try {
                    onChange({ config: JSON.parse(e.target.value) });
                    setConfigErr(null);
                  } catch (err) {
                    setConfigErr((err as Error).message);
                  }
                }}
                rows={Math.min(14, rawConfig.split("\n").length + 1)}
                className={`mt-1 w-full font-mono text-xs px-3 py-2 rounded bg-muted border ${
                  configErr ? "border-red-500" : "border-border"
                }`}
              />
              {configErr && (
                <p className="text-xs text-red-400 mt-1 font-mono">
                  {configErr}
                </p>
              )}
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!step.requiresApproval}
                  onChange={(e) =>
                    onChange({ requiresApproval: e.target.checked })
                  }
                />
                Requires approval
              </label>
              <label className="flex items-center gap-2 text-sm">
                On error:
                <select
                  value={step.onError ?? "fail"}
                  onChange={(e) => onChange({ onError: e.target.value as "continue" | "fail" })}
                  className="px-2 py-1 rounded bg-muted border border-border"
                >
                  <option value="fail">Fail the workflow</option>
                  <option value="continue">Continue anyway</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>
      {!isLast && (
        <div className="flex justify-center">
          <ArrowDown className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </>
  );
}

function AddStepMenu({
  stepTypes,
  onAdd,
}: {
  stepTypes: StepTypeInfo[];
  onAdd: (t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const byCategory = stepTypes.reduce(
    (acc, s) => {
      (acc[s.category] = acc[s.category] ?? []).push(s);
      return acc;
    },
    {} as Record<string, StepTypeInfo[]>
  );
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-muted w-full justify-center"
      >
        <Plus className="h-4 w-4" /> Add step
      </button>
      {open && (
        <div className="absolute left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg max-h-96 overflow-y-auto z-10 p-2">
          {Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat} className="mb-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
                {cat}
              </p>
              {items.map((s) => (
                <button
                  key={s.type}
                  onClick={() => {
                    onAdd(s.type);
                    setOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 rounded hover:bg-muted"
                >
                  <span className="font-mono text-xs">{s.type}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {s.description}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function defaultConfigFor(type: string): Record<string, unknown> {
  switch (type) {
    case "condition":
      return { expression: "trigger.total > 100" };
    case "llm.reason":
      return {
        prompt: "Summarize the trigger context in one sentence.",
        output: { type: "object", properties: { summary: { type: "string" } } },
      };
    case "llm.classify":
      return { input: "{{trigger.payload}}", labels: ["safe", "suspicious"] };
    case "store.update_inventory":
      return { productId: 0, quantity: 0, reason: "workflow adjustment" };
    case "store.update_price":
      return { productId: 0, price: "0.00" };
    case "store.create_discount":
      return { code: "AUTO10", type: "percentage", value: 10 };
    case "store.tag_customer":
      return { customerId: 0, tags: ["vip"] };
    case "store.fetch_order":
      return { orderId: "{{trigger.payload.id}}" };
    case "store.low_stock_report":
      return { limit: 20 };
    case "notify.email":
      return {
        to: "owner@example.com",
        subject: "Workflow alert",
        body: "Something happened.",
      };
    case "notify.slack":
      return { webhookUrl: "", text: "StorePilot workflow update" };
    case "http.request":
      return { method: "POST", url: "", body: {} };
    case "proposal.gate":
      return {
        actionType: "store.update_inventory",
        summary: "Restock low items",
        actionConfig: { productId: 0, quantity: 0, reason: "AI-suggested restock" },
      };
    case "delay.sleep":
      return { seconds: 60 };
    case "store.refund_order":
      return { orderId: "{{trigger.payload.id}}", notify: true, note: "auto-refund" };
    case "store.fulfill_order":
      return { orderId: "{{trigger.payload.id}}", status: "shipped" };
    case "store.fetch_customer":
      return { customerId: "{{trigger.payload.customer.id}}" };
    case "store.top_sellers":
      return { days: 30 };
    case "llm.draft_email_reply":
      return {
        context: "Customer complained about a delayed order.",
        tone: "apologetic, concise",
        signer: "The team",
      };
    case "llm.summarize_run":
      return {};
    case "llm.extract":
      return {
        input: "{{trigger.payload.message}}",
        output: {
          type: "object",
          properties: {
            intent: { type: "string", description: "what the customer wants" },
            urgency: { type: "string", description: "low/medium/high" },
          },
        },
      };
  }
  return {};
}

function sampleForShopifyTopic(topic: string): Record<string, unknown> {
  // Minimal sample shapes so authors can test workflows without firing a
  // real Shopify event. These are the fields our handlers actually read.
  const base = { topic };
  if (topic.startsWith("orders/")) {
    return {
      ...base,
      payload: {
        id: 99999,
        name: "#1999",
        total_price: "125.00",
        subtotal_price: "120.00",
        total_tax: "5.00",
        total_discounts: "0.00",
        financial_status: "paid",
        customer: { id: 42, email: "jane@example.com" },
      },
    };
  }
  if (topic.startsWith("products/")) {
    return {
      ...base,
      payload: {
        id: 777,
        title: "Demo Product",
        handle: "demo-product",
        status: "active",
        variants: [{ price: "29.99", inventory_quantity: 5, sku: "DEMO-1" }],
      },
    };
  }
  if (topic.startsWith("customers/")) {
    return {
      ...base,
      payload: {
        id: 42,
        email: "jane@example.com",
        first_name: "Jane",
        last_name: "Doe",
      },
    };
  }
  return base;
}

function cryptoRandom() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as { randomUUID: () => string }).randomUUID().replace(/-/g, "").slice(0, 32);
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
