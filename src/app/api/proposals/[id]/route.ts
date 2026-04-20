// Resolve a proposal: approve (apply the action + resume the run) or
// reject (drop it and resume with a skipped step). The actual apply
// re-uses the same step handler registry the executor does — the action
// type is simply looked up and invoked with the stored resolved config.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { proposals, workflowRuns, workflows } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/tenant";
import { resumeAfterProposal } from "@/lib/workflows/executor";
import { getHandler } from "@/lib/workflows/registry";
import "@/lib/workflows/handlers";
import type { StepResult } from "@/lib/workflows/types";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.activeOrgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const orgId = session.activeOrgId;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const decision = body?.decision as "approve" | "reject" | undefined;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "decision must be 'approve' or 'reject'" }, { status: 400 });
  }

  const [p] = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.id, id), eq(proposals.orgId, orgId)));
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (p.status !== "pending")
    return NextResponse.json({ error: `already ${p.status}` }, { status: 409 });

  if (decision === "reject") {
    await db
      .update(proposals)
      .set({
        status: "rejected",
        resolvedAt: new Date(),
        resolverUserId: session?.userId ?? null,
        resolverNote: body?.note ?? null,
      })
      .where(eq(proposals.id, p.id));

    // Resume the workflow — the gated step becomes "succeeded" with a
    // rejected marker so later steps can still reference it but know it
    // didn't apply anything.
    await resumeAfterProposal(p.id, { rejected: true });
    return NextResponse.json({ ok: true });
  }

  // Approve: execute the stored action now.
  const handler = getHandler(p.actionType);
  if (!handler) {
    await db
      .update(proposals)
      .set({
        status: "rejected",
        resolvedAt: new Date(),
        resolverNote: `no handler for ${p.actionType}`,
      })
      .where(eq(proposals.id, p.id));
    return NextResponse.json(
      { error: `no handler for ${p.actionType}` },
      { status: 500 }
    );
  }

  // Build a fake step + fake context — the handler doesn't need the full
  // run context to apply a resolved action (everything's already
  // interpolated), but it does need org + run ids for audit.
  const [run] = p.runId
    ? await db.select().from(workflowRuns).where(eq(workflowRuns.id, p.runId))
    : [null as never];
  const result = (await handler(
    { id: p.stepId ?? "proposal", type: p.actionType, config: {} },
    p.actionConfig,
    {
      runId: run?.id ?? "approval",
      workflowId: run?.workflowId ?? "",
      orgId: p.orgId,
      trigger: (run?.triggerData as Record<string, unknown>) ?? {},
      steps: {},
      actor: session?.userId,
    }
  )) as StepResult;

  if (result.status !== "ok") {
    await db
      .update(proposals)
      .set({
        status: "rejected",
        resolvedAt: new Date(),
        resolverNote: `apply failed: ${result.status === "error" ? result.error : result.status}`,
      })
      .where(eq(proposals.id, p.id));
    return NextResponse.json({ error: "apply failed" }, { status: 500 });
  }

  await db
    .update(proposals)
    .set({
      status: "applied",
      resolvedAt: new Date(),
      resolverUserId: session?.userId ?? null,
      resolverNote: body?.note ?? null,
      appliedResult: result.output as never,
    })
    .where(eq(proposals.id, p.id));

  if (p.runId) {
    await resumeAfterProposal(p.id, result.output);
  }
  return NextResponse.json({ ok: true });
}
