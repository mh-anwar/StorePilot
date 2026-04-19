"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";

type Row = {
  id: string;
  actionType: string;
  actionConfig: Record<string, unknown>;
  summary: string | null;
  rationale: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  runId: string | null;
  workflowId: string | null;
  workflowName: string | null;
};

export function ProposalsList({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();

  function decide(id: string, decision: "approve" | "reject") {
    setBusy(id);
    start(async () => {
      const r = await fetch(`/api/proposals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      setBusy(null);
      if (r.ok) {
        setRows((rs) => rs.filter((x) => x.id !== id));
        router.refresh();
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
        Nothing here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="border border-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono bg-muted px-2 py-0.5 rounded">
                  {r.actionType}
                </span>
                {r.workflowName && (
                  <>
                    <span>·</span>
                    <Link
                      href={`/dashboard/workflows/${r.workflowId}/runs/${r.runId}`}
                      className="hover:underline"
                    >
                      {r.workflowName}
                    </Link>
                  </>
                )}
                <span>·</span>
                <span>{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              {r.summary && <p className="font-medium mt-2">{r.summary}</p>}
              {r.rationale && (
                <p className="text-sm text-muted-foreground mt-1 italic">
                  {r.rationale}
                </p>
              )}
              <details className="mt-3">
                <summary className="text-xs text-muted-foreground cursor-pointer">
                  Resolved action config
                </summary>
                <pre className="mt-2 bg-muted/50 rounded p-3 text-[11px] overflow-x-auto">
                  {JSON.stringify(r.actionConfig, null, 2)}
                </pre>
              </details>
            </div>
            {r.status === "pending" ? (
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => decide(r.id, "approve")}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50"
                >
                  {busy === r.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Approve
                </button>
                <button
                  onClick={() => decide(r.id, "reject")}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                  Reject
                </button>
              </div>
            ) : (
              <span
                className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                  r.status === "applied"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {r.status}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
