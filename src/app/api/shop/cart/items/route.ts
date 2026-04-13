import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cartItems, carts, products } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getOrCreateCartId, loadCart } from "@/lib/cart";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const productId = Number(body?.productId);
  const quantity = Math.max(1, Math.min(99, Number(body?.quantity) || 1));
  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }

  const [p] = await db.select().from(products).where(eq(products.id, productId));
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (p.status !== "active") {
    return NextResponse.json({ error: "unavailable" }, { status: 400 });
  }

  const cartId = await getOrCreateCartId();

  const existing = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));

  if (existing.length) {
    const nextQty = Math.min(
      p.stock,
      existing[0].quantity + quantity
    );
    await db
      .update(cartItems)
      .set({ quantity: nextQty })
      .where(eq(cartItems.id, existing[0].id));
  } else {
    await db.insert(cartItems).values({
      cartId,
      productId,
      quantity: Math.min(p.stock, quantity),
    });
  }
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));

  const summary = await loadCart();
  return NextResponse.json({ ok: true, cart: summary });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const itemId = Number(body?.itemId);
  const quantity = Math.max(0, Math.min(99, Number(body?.quantity) || 0));
  if (!itemId)
    return NextResponse.json({ error: "itemId required" }, { status: 400 });

  if (quantity === 0) {
    await db.delete(cartItems).where(eq(cartItems.id, itemId));
  } else {
    await db
      .update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, itemId));
  }
  const summary = await loadCart();
  return NextResponse.json({ ok: true, cart: summary });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("itemId"));
  if (!id)
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  await db.delete(cartItems).where(eq(cartItems.id, id));
  const summary = await loadCart();
  return NextResponse.json({ ok: true, cart: summary });
}
