import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflowRuns, proposals } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentOrgId } from "@/lib/tenant";

// Cancel a run that's queued, running, or awaiting_approval. Open
// proposals tied to the run are expired so they stop showing up in the
// inbox.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const orgId = await getCurrentOrgId();
  const [run] = await db
    .select()
    .from(workflowRuns)
    .where(and(eq(workflowRuns.id, id), eq(workflowRuns.orgId, orgId)));
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(["queued", "running", "awaiting_approval"] as const as string[]).includes(run.status)) {
    return NextResponse.json({ error: `run is ${run.status}, cannot cancel` }, { status: 409 });
  }

  await db
    .update(workflowRuns)
    .set({ status: "cancelled", finishedAt: new Date() })
    .where(eq(workflowRuns.id, run.id));
  await db
    .update(proposals)
    .set({ status: "expired", resolvedAt: new Date() })
    .where(
      and(
        eq(proposals.runId, run.id),
        inArray(proposals.status, ["pending"])
      )
    );
  return NextResponse.json({ ok: true });
}
