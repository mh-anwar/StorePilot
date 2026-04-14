import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reviews } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const patch: Partial<typeof reviews.$inferInsert> = {};
  if (body?.status) patch.status = body.status;
  await db.update(reviews).set(patch).where(eq(reviews.id, Number(id)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  await db.delete(reviews).where(eq(reviews.id, Number(id)));
  return NextResponse.json({ ok: true });
}
