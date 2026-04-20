import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentOrgId, getSession } from "@/lib/tenant";
import { listStepTypes } from "@/lib/workflows/handlers";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const orgId = await getCurrentOrgId();
  const [wf] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.orgId, orgId)));
  if (!wf) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ workflow: wf });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.activeOrgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);

  if (Array.isArray(body?.steps)) {
    const known = new Set(listStepTypes().map((s) => s.type));
    const unknown = (body.steps as Array<{ type: string }>)
      .map((s) => s.type)
      .filter((t) => !known.has(t));
    if (unknown.length) {
      return NextResponse.json(
        { error: `unknown step types: ${unknown.join(", ")}` },
        { status: 400 }
      );
    }
  }

  const patch: Partial<typeof workflows.$inferInsert> = { updatedAt: new Date() };
  if (body?.name) patch.name = body.name;
  if (body?.description !== undefined) patch.description = body.description;
  if (body?.trigger) patch.trigger = body.trigger;
  if (body?.steps) patch.steps = body.steps;
  if (body?.status) patch.status = body.status;
  await db
    .update(workflows)
    .set(patch)
    .where(and(eq(workflows.id, id), eq(workflows.orgId, session.activeOrgId)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.activeOrgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  await db
    .delete(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.orgId, session.activeOrgId)));
  return NextResponse.json({ ok: true });
}
