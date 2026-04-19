import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  workflows,
  workflowRuns,
  stepRuns,
  proposals,
} from "@/lib/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { getCurrentOrgId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function RunDetail({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id, runId } = await params;
  const orgId = await getCurrentOrgId();

  const [wf] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.orgId, orgId)));
  if (!wf) notFound();

  const [run] = await db
    .select()
    .from(workflowRuns)
    .where(and(eq(workflowRuns.id, runId), eq(workflowRuns.workflowId, id)));
  if (!run) notFound();

  const steps = await db
    .select()
    .from(stepRuns)
    .where(eq(stepRuns.runId, run.id))
    .orderBy(asc(stepRuns.stepIndex));

  const pendingProposals = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.runId, run.id), eq(proposals.status, "pending")));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/workflows/${wf.id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Back to workflow
        </Link>
        <h1 className="text-2xl font-bold mt-2">{wf.name}</h1>
        <p className="text-sm text-muted-foreground font-mono">
          run {run.id} · <StatusBadge status={run.status} />
        </p>
      </div>

      {pendingProposals.length > 0 && (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl p-4">
          <p className="font-medium">Waiting on approval</p>
          <p className="text-sm text-muted-foreground mt-1">
            This run has {pendingProposals.length} pending proposal(s).
          </p>
          <Link
            href="/dashboard/proposals"
            className="mt-3 inline-block text-sm underline"
          >
            Open proposals inbox →
          </Link>
        </div>
      )}

      <div>
        <h2 className="font-semibold mb-3">Step timeline</h2>
        <div className="space-y-3">
          {steps.map((s) => (
            <div key={s.id} className="border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {String(s.stepIndex + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                  {s.stepType}
                </span>
                <span className="text-xs text-muted-foreground">· {s.stepId}</span>
                <StatusBadge status={s.status} />
                <span className="ml-auto text-xs text-muted-foreground">
                  {s.finishedAt
                    ? `${Math.round(
                        (new Date(s.finishedAt).getTime() -
                          new Date(s.startedAt).getTime()) /
                          10
                      ) / 100}s`
                    : "…"}
                </span>
              </div>
              {s.error && (
                <p className="mt-2 text-xs text-red-400 font-mono">{s.error}</p>
              )}
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  input / output
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Input</p>
                    <pre className="mt-1 bg-muted/50 rounded p-2 overflow-x-auto text-[11px]">
                      {JSON.stringify(s.input, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Output</p>
                    <pre className="mt-1 bg-muted/50 rounded p-2 overflow-x-auto text-[11px]">
                      {JSON.stringify(s.output, null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            </div>
          ))}
          {steps.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No step runs yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "succeeded"
      ? "bg-emerald-500/10 text-emerald-400"
      : status === "failed"
        ? "bg-red-500/10 text-red-400"
        : status === "awaiting_approval"
          ? "bg-amber-500/10 text-amber-400"
          : status === "running"
            ? "bg-sky-500/10 text-sky-400"
            : "bg-muted text-muted-foreground";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded ${color}`}>{status}</span>
  );
}
