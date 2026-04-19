import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { proposals, workflows, workflowRuns } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { getCurrentOrgId } from "@/lib/tenant";

export async function GET(req: Request) {
  const orgId = await getCurrentOrgId();
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";
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
    .where(and(eq(proposals.orgId, orgId), eq(proposals.status, status as never)))
    .orderBy(desc(proposals.createdAt))
    .limit(100);
  return NextResponse.json({ proposals: rows });
}
