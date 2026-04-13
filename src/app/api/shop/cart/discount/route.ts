import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { carts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getOrCreateCartId, loadCart, resolveDiscount } from "@/lib/cart";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const rawCode = String(body?.code || "").trim();
  const cartId = await getOrCreateCartId();

  if (!rawCode) {
    await db
      .update(carts)
      .set({ discountCode: null })
      .where(eq(carts.id, cartId));
    return NextResponse.json({ ok: true, cart: await loadCart() });
  }

  const summary = await loadCart();
  const d = await resolveDiscount(rawCode, summary.subtotal);
  if (!d) {
    return NextResponse.json(
      { error: "Invalid or expired code" },
      { status: 400 }
    );
  }
  await db
    .update(carts)
    .set({ discountCode: d.code })
    .where(eq(carts.id, cartId));
  return NextResponse.json({ ok: true, cart: await loadCart() });
}
