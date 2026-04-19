import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentOrgId, getSession } from "@/lib/tenant";
import { runManual } from "@/lib/workflows/triggers";
// Make sure all step handlers are registered even when this is the first
// module touched on a cold start.
import "@/lib/workflows/handlers";

export const maxDuration = 120;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  const orgId = await getCurrentOrgId();
  const [wf] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.orgId, orgId)));
  if (!wf) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { runId } = await runManual({
    workflowId: wf.id,
    orgId: wf.orgId,
    actor: session?.userId ?? "anonymous",
    triggerData: body?.triggerData ?? {},
    // Run inline so the HTTP response waits for it — quicker feedback
    // when the merchant is testing a workflow by hand.
    inline: true,
  });
  return NextResponse.json({ ok: true, runId });
}
