import Link from "next/link";
import { db } from "@/lib/db";
import {
  workflows,
  workflowRuns,
  proposals,
} from "@/lib/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { getCurrentOrgId } from "@/lib/tenant";
import { NewWorkflowButton } from "@/components/dashboard/new-workflow-button";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const orgId = await getCurrentOrgId();
  const rows = await db
    .select()
    .from(workflows)
    .where(eq(workflows.orgId, orgId))
    .orderBy(desc(workflows.updatedAt));

  // Per-workflow metrics: total, 7-day runs, success rate, median
  // duration, last run status. One query keeps the page snappy.
  const runStats = await db
    .select({
      workflowId: workflowRuns.workflowId,
      total: sql<number>`count(*)`.as("total"),
      week: sql<number>`count(*) filter (where ${workflowRuns.createdAt} >= NOW() - INTERVAL '7 days')`.as("week"),
      successes: sql<number>`count(*) filter (where ${workflowRuns.status} = 'succeeded')`.as("successes"),
      failures: sql<number>`count(*) filter (where ${workflowRuns.status} = 'failed')`.as("failures"),
      medianDurationMs: sql<number>`
        percentile_cont(0.5) within group (order by
          EXTRACT(EPOCH FROM (${workflowRuns.finishedAt} - ${workflowRuns.startedAt})) * 1000
        ) filter (where ${workflowRuns.finishedAt} is not null and ${workflowRuns.startedAt} is not null)
      `.as("median_ms"),
      last: sql<Date>`max(${workflowRuns.createdAt})`.as("last"),
      lastStatus: sql<string>`(array_agg(${workflowRuns.status} order by ${workflowRuns.createdAt} desc))[1]`.as("last_status"),
    })
    .from(workflowRuns)
    .where(eq(workflowRuns.orgId, orgId))
    .groupBy(workflowRuns.workflowId);
  const runMap = new Map(runStats.map((r) => [r.workflowId, r]));

  const pending = await db
    .select({ count: sql<number>`count(*)` })
    .from(proposals)
    .where(and(eq(proposals.orgId, orgId), eq(proposals.status, "pending")));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-muted-foreground text-sm">
            LLM-powered automations. Chain reasoning steps with real actions; put
            anything risky behind an approval gate.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/proposals"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Pending proposals
            {Number(pending[0]?.count ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-medium">
                {pending[0].count}
              </span>
            )}
          </Link>
          <NewWorkflowButton />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.map((w) => {
          const stats = runMap.get(w.id);
          const trigger = w.trigger as {
            type: string;
            topic?: string;
            intervalMinutes?: number;
          };
          return (
            <Link
              key={w.id}
              href={`/dashboard/workflows/${w.id}`}
              className="block border border-border rounded-xl p-4 hover:bg-muted/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{w.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        w.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {w.status}
                    </span>
                    <span className="font-mono">
                      {trigger.type}
                      {trigger.topic ? ` · ${trigger.topic}` : ""}
                      {trigger.intervalMinutes ? ` · every ${trigger.intervalMinutes}m` : ""}
                    </span>
                  </p>
                  {w.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {w.description}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <p>{(w.steps as unknown[])?.length ?? 0} steps</p>
                  {stats && (
                    <div className="mt-2 space-y-0.5">
                      <p>
                        {Number(stats.week)} runs <span className="opacity-60">/ 7d</span>
                      </p>
                      <p>
                        {Math.round(
                          (Number(stats.successes) / Math.max(1, Number(stats.successes) + Number(stats.failures))) * 100
                        )}
                        % ok
                      </p>
                      {stats.medianDurationMs && (
                        <p>
                          {Math.round(Number(stats.medianDurationMs))}ms median
                        </p>
                      )}
                      <p
                        className={
                          stats.lastStatus === "succeeded"
                            ? "text-emerald-400"
                            : stats.lastStatus === "failed"
                              ? "text-red-400"
                              : stats.lastStatus === "awaiting_approval"
                                ? "text-amber-400"
                                : ""
                        }
                      >
                        {stats.lastStatus ?? ""}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
        {rows.length === 0 && (
          <div className="md:col-span-2 text-center py-16 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            No workflows yet — create one or clone a template to get started.
          </div>
        )}
      </div>
    </div>
  );
}
