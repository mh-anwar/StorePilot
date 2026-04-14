import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const patch: Partial<typeof discounts.$inferInsert> = {};
  if (typeof body?.active === "boolean") patch.active = body.active;
  if (body?.value !== undefined) patch.value = String(body.value);
  if (body?.description !== undefined) patch.description = body.description;
  if (body?.usageLimit !== undefined) patch.usageLimit = body.usageLimit;
  await db.update(discounts).set(patch).where(eq(discounts.id, Number(id)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  await db.delete(discounts).where(eq(discounts.id, Number(id)));
  return NextResponse.json({ ok: true });
}
