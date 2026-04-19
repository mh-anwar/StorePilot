import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentOrgId } from "@/lib/tenant";

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
  const { id } = await ctx.params;
  const orgId = await getCurrentOrgId();
  const body = await req.json().catch(() => null);
  const patch: Partial<typeof workflows.$inferInsert> = { updatedAt: new Date() };
  if (body?.name) patch.name = body.name;
  if (body?.description !== undefined) patch.description = body.description;
  if (body?.trigger) patch.trigger = body.trigger;
  if (body?.steps) patch.steps = body.steps;
  if (body?.status) patch.status = body.status;
  await db
    .update(workflows)
    .set(patch)
    .where(and(eq(workflows.id, id), eq(workflows.orgId, orgId)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const orgId = await getCurrentOrgId();
  await db.delete(workflows).where(and(eq(workflows.id, id), eq(workflows.orgId, orgId)));
  return NextResponse.json({ ok: true });
}
