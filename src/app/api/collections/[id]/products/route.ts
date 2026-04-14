import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productCollections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const rows = await db
    .select({ productId: productCollections.productId })
    .from(productCollections)
    .where(eq(productCollections.collectionId, Number(id)));
  return NextResponse.json({ productIds: rows.map((r) => r.productId) });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const ids = (body?.productIds || []).map((x: unknown) => Number(x)).filter(Boolean);
  await db.delete(productCollections).where(eq(productCollections.collectionId, Number(id)));
  if (ids.length > 0) {
    await db.insert(productCollections).values(
      ids.map((pid: number) => ({ collectionId: Number(id), productId: pid }))
    );
  }
  return NextResponse.json({ ok: true, count: ids.length });
}
