"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Plus, Pause, Trash2, Loader2, Clock } from "lucide-react";

type Automation = {
  id: number;
  name: string;
  description: string | null;
  prompt: string;
  trigger: "schedule" | "low_stock" | "new_order" | "manual";
  triggerConfig: Record<string, unknown> | null;
  status: "active" | "paused";
  lastRunAt: string | null;
  createdAt: string;
  lastRun: { status: string; startedAt: string } | null;
};

export function AutomationsAdmin({ initial }: { initial: Automation[] }) {
  const [list, setList] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [running, setRunning] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [trigger, setTrigger] = useState<Automation["trigger"]>("manual");

  function create() {
    if (!name || !prompt) return;
    start(async () => {
      const r = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, prompt, trigger }),
      });
      if (r.ok) {
        const j = await r.json();
        setList((ls) => [{ ...j.automation, lastRun: null }, ...ls]);
        setShowForm(false);
        setName("");
        setDescription("");
        setPrompt("");
      }
    });
  }

  async function run(id: number) {
    setRunning((s) => new Set(s).add(id));
    try {
      const userKey = localStorage.getItem("sp_user_key");
      await fetch(`/api/automations/${id}/run`, {
        method: "POST",
        headers: userKey ? { "x-anthropic-key": userKey } : undefined,
      });
      router.refresh();
    } finally {
      setRunning((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  function toggle(id: number, status: Automation["status"]) {
    const next = status === "active" ? "paused" : "active";
    start(async () => {
      await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      setList((ls) => ls.map((a) => (a.id === id ? { ...a, status: next } : a)));
    });
  }

  function remove(id: number) {
    start(async () => {
      await fetch(`/api/automations/${id}`, { method: "DELETE" });
      setList((ls) => ls.filter((a) => a.id !== id));
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
          {showForm ? "Cancel" : "New automation"}
        </button>
      </div>
      {showForm && (
        <div className="mb-6 p-4 border border-border rounded-xl space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Daily low-stock scan)"
            className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm"
          />
          <select
            value={trigger}
            onChange={(e) =>
              setTrigger(e.target.value as Automation["trigger"])
            }
            className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm"
          >
            <option value="manual">Manual</option>
            <option value="schedule">Scheduled (daily)</option>
            <option value="low_stock">On low stock</option>
            <option value="new_order">On new order</option>
          </select>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="Instruction for the agent — e.g. 'List all products under 5 units and draft an email campaign promoting the well-stocked alternatives.'"
            className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm"
          />
          <button
            disabled={pending}
            onClick={create}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
          >
            Create automation
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map((a) => {
          const isRunning = running.has(a.id);
          return (
            <div
              key={a.id}
              className="border border-border rounded-xl p-4 flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{a.name}</h3>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        a.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {a.status}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {a.trigger}
                    </span>
                  </div>
                  {a.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {a.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2">
                    &ldquo;{a.prompt}&rdquo;
                  </p>
                  {a.lastRun && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last run{" "}
                      {new Date(a.lastRun.startedAt).toLocaleString()} ·{" "}
                      <span
                        className={
                          a.lastRun.status === "succeeded"
                            ? "text-emerald-400"
                            : a.lastRun.status === "failed"
                              ? "text-red-400"
                              : "text-amber-400"
                        }
                      >
                        {a.lastRun.status}
                      </span>
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => run(a.id)}
                  disabled={isRunning}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs disabled:opacity-50"
                >
                  {isRunning ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  {isRunning ? "Running…" : "Run now"}
                </button>
                <Link
                  href={`/dashboard/automations/${a.id}`}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted"
                >
                  History
                </Link>
                <button
                  onClick={() => toggle(a.id, a.status)}
                  className="p-2 rounded-lg border border-border hover:bg-muted"
                  title={a.status === "active" ? "Pause" : "Activate"}
                >
                  {a.status === "active" ? (
                    <Pause className="h-3 w-3" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </button>
                <button
                  onClick={() => remove(a.id)}
                  className="p-2 rounded-lg border border-border hover:bg-muted text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            No automations yet — create one to let agents work on autopilot.
          </div>
        )}
      </div>
    </div>
  );
}
