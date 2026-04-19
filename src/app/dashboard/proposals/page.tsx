import { db } from "@/lib/db";
import { proposals, workflowRuns, workflows } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentOrgId } from "@/lib/tenant";
import { ProposalsList } from "@/components/dashboard/proposals-list";

export const dynamic = "force-dynamic";

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const orgId = await getCurrentOrgId();
  const { status = "pending" } = await searchParams;

  const rows = await db
    .select({
      id: proposals.id,
      actionType: proposals.actionType,
      actionConfig: proposals.actionConfig,
      summary: proposals.summary,
      rationale: proposals.rationale,
      status: proposals.status,
      createdAt: proposals.createdAt,
      resolvedAt: proposals.resolvedAt,
      runId: proposals.runId,
      workflowId: workflowRuns.workflowId,
      workflowName: workflows.name,
    })
    .from(proposals)
    .leftJoin(workflowRuns, eq(proposals.runId, workflowRuns.id))
    .leftJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
    .where(
      and(eq(proposals.orgId, orgId), eq(proposals.status, status as never))
    )
    .orderBy(desc(proposals.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Proposals</h1>
        <p className="text-muted-foreground text-sm">
          Actions workflows want to take, waiting for your call. Everything
          you approve runs against your real store — read carefully.
        </p>
      </div>

      <div className="flex gap-2">
        {(["pending", "applied", "rejected"] as const).map((s) => (
          <a
            key={s}
            href={`?status=${s}`}
            className={`px-3 py-1.5 rounded-lg text-xs border ${
              status === s
                ? "bg-violet-600 text-white border-violet-600"
                : "border-border hover:bg-muted"
            }`}
          >
            {s}
          </a>
        ))}
      </div>

      <ProposalsList
        initial={rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
