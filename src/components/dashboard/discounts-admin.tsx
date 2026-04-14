"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pause, Play } from "lucide-react";

type Discount = {
  id: number;
  code: string;
  description: string | null;
  type: "percentage" | "fixed_amount" | "free_shipping";
  value: string;
  minSubtotal: string | null;
  usageLimit: number | null;
  usageCount: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

export function DiscountsAdmin({ initial }: { initial: Discount[] }) {
  const [list, setList] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [type, setType] = useState<Discount["type"]>("percentage");
  const [value, setValue] = useState("10");
  const [desc, setDesc] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [usageLimit, setUsageLimit] = useState("");

  function create() {
    if (!code) return;
    start(async () => {
      const r = await fetch("/api/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.toUpperCase(),
          type,
          value,
          description: desc || null,
          minSubtotal: minSubtotal || null,
          usageLimit: usageLimit ? Number(usageLimit) : null,
        }),
      });
      if (r.ok) {
        const j = await r.json();
        setList((ls) => [j.discount, ...ls]);
        setShowForm(false);
        setCode("");
        setDesc("");
        setMinSubtotal("");
        setUsageLimit("");
        router.refresh();
      }
    });
  }

  function toggle(id: number, active: boolean) {
    start(async () => {
      await fetch(`/api/discounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      setList((ls) => ls.map((d) => (d.id === id ? { ...d, active: !active } : d)));
    });
  }

  function remove(id: number) {
    start(async () => {
      await fetch(`/api/discounts/${id}`, { method: "DELETE" });
      setList((ls) => ls.filter((d) => d.id !== id));
    });
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "New discount"}
        </button>
      </div>
      {showForm && (
        <div className="mb-6 p-4 border border-border rounded-xl grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            className="px-3 py-2 rounded-lg bg-muted border border-border text-sm font-mono"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Discount["type"])}
            className="px-3 py-2 rounded-lg bg-muted border border-border text-sm"
          >
            <option value="percentage">Percentage off</option>
            <option value="fixed_amount">Fixed amount off</option>
            <option value="free_shipping">Free shipping</option>
          </select>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === "percentage" ? "10 (= 10%)" : "5.00"}
            className="px-3 py-2 rounded-lg bg-muted border border-border text-sm"
            disabled={type === "free_shipping"}
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            className="md:col-span-2 px-3 py-2 rounded-lg bg-muted border border-border text-sm"
          />
          <input
            value={minSubtotal}
            onChange={(e) => setMinSubtotal(e.target.value)}
            placeholder="Min subtotal"
            className="px-3 py-2 rounded-lg bg-muted border border-border text-sm"
          />
          <input
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            placeholder="Usage limit"
            className="px-3 py-2 rounded-lg bg-muted border border-border text-sm"
          />
          <button
            disabled={pending}
            onClick={create}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
          >
            Create
          </button>
        </div>
      )}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3">Code</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Value</th>
              <th className="text-left px-4 py-3">Used</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono font-medium">{d.code}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.type}</td>
                <td className="px-4 py-3">
                  {d.type === "percentage"
                    ? `${parseFloat(d.value).toFixed(0)}%`
                    : d.type === "fixed_amount"
                      ? `$${parseFloat(d.value).toFixed(2)}`
                      : "Free shipping"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {d.usageCount}
                  {d.usageLimit ? ` / ${d.usageLimit}` : ""}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      d.active
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {d.active ? "Active" : "Paused"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggle(d.id, d.active)}
                    className="p-2 hover:bg-muted rounded"
                    title={d.active ? "Pause" : "Activate"}
                  >
                    {d.active ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => remove(d.id)}
                    className="p-2 hover:bg-muted rounded text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No discount codes yet. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
