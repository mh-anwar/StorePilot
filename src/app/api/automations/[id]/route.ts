import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const patch: Partial<typeof automations.$inferInsert> = {};
  if (body?.status) patch.status = body.status;
  if (body?.name) patch.name = body.name;
  if (body?.description !== undefined) patch.description = body.description;
  if (body?.prompt) patch.prompt = body.prompt;
  if (body?.trigger) patch.trigger = body.trigger;
  if (body?.triggerConfig) patch.triggerConfig = body.triggerConfig;
  await db.update(automations).set(patch).where(eq(automations.id, Number(id)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  await db.delete(automations).where(eq(automations.id, Number(id)));
  return NextResponse.json({ ok: true });
}
