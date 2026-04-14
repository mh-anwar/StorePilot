import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const patch: Partial<typeof collections.$inferInsert> = {};
  if (typeof body?.featured === "boolean") patch.featured = body.featured;
  if (body?.name) patch.name = body.name;
  if (body?.description !== undefined) patch.description = body.description;
  if (body?.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder);
  await db.update(collections).set(patch).where(eq(collections.id, Number(id)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  await db.delete(collections).where(eq(collections.id, Number(id)));
  return NextResponse.json({ ok: true });
}
