"use client";

import { useEffect, useState, useTransition } from "react";
import { Key, Save, TestTube } from "lucide-react";

const MODELS = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
];

export function SettingsForm({ initial }: { initial: Record<string, unknown> }) {
  const storeName =
    (initial.storeName as string) || "StorePilot Demo Store";
  const [name, setName] = useState(storeName);
  const [currency, setCurrency] = useState((initial.currency as string) || "USD");
  const [support, setSupport] = useState((initial.supportEmail as string) || "");

  // Client-side BYO key — kept in localStorage, never sent to our DB.
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [test, setTest] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setApiKey(localStorage.getItem("sp_user_key") || "");
    setModel(localStorage.getItem("sp_user_model") || MODELS[0].id);
  }, []);

  function saveStore() {
    start(async () => {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: name,
          currency,
          supportEmail: support,
        }),
      });
    });
  }

  function saveKey() {
    if (apiKey) localStorage.setItem("sp_user_key", apiKey);
    else localStorage.removeItem("sp_user_key");
    localStorage.setItem("sp_user_model", model);
    setTest("Saved to this browser only.");
  }

  async function testKey() {
    setTest("Testing…");
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "x-anthropic-key": apiKey } : {}),
        "x-model": model,
      },
      body: JSON.stringify({
        messages: [
          {
            id: "t",
            role: "user",
            parts: [{ type: "text", text: "Say hi in 3 words." }],
          },
        ],
      }),
    });
    setTest(r.ok ? "Key works ✓" : `Failed (${r.status})`);
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <section className="p-5 border border-border rounded-xl">
        <h2 className="font-semibold mb-4">Store</h2>
        <Field label="Store name" value={name} onChange={setName} />
        <Field label="Currency" value={currency} onChange={setCurrency} />
        <Field label="Support email" value={support} onChange={setSupport} type="email" />
        <button
          disabled={pending}
          onClick={saveStore}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save
        </button>
      </section>

      <section className="p-5 border border-border rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Bring your own Anthropic key</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Stored in your browser&apos;s localStorage and sent with chat requests
          in an <code>x-anthropic-key</code> header. It never leaves your
          machine except to Anthropic. If unset, the server uses its default
          key (when configured).
        </p>
        <Field
          label="API key"
          value={apiKey}
          onChange={setApiKey}
          placeholder="sk-ant-…"
          type="password"
        />
        <label className="text-xs text-muted-foreground">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="mt-1 mb-3 w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={saveKey}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm"
          >
            <Save className="h-4 w-4" />
            Save locally
          </button>
          <button
            onClick={testKey}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
          >
            <TestTube className="h-4 w-4" />
            Test
          </button>
          {test && (
            <span className="text-sm self-center text-muted-foreground">
              {test}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="mb-3">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm"
      />
    </div>
  );
}
