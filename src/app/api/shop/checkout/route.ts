import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  carts,
  cartItems,
  customers,
  orders,
  orderItems,
  products,
  discounts,
  inventoryAdjustments,
  analyticsEvents,
} from "@/lib/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { loadCart, getCartIdOptional, resolveDiscount } from "@/lib/cart";
import { cookies } from "next/headers";
import { DEMO_ORG_ID } from "@/lib/tenant";

function orderNumber() {
  return "SP-" + Date.now().toString(36).toUpperCase() + "-" +
    Math.random().toString(36).slice(2, 6).toUpperCase();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const firstName = String(body?.firstName || "").trim();
  const lastName = String(body?.lastName || "").trim();
  const addr = body?.shippingAddress;
  if (!email || !firstName || !lastName || !addr?.line1 || !addr?.city) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const cartId = await getCartIdOptional();
  if (!cartId)
    return NextResponse.json({ error: "no cart" }, { status: 400 });
  const cart = await loadCart();
  if (cart.lines.length === 0)
    return NextResponse.json({ error: "empty cart" }, { status: 400 });

  // Re-check stock to avoid oversell
  const ids = cart.lines.map((l) => l.productId);
  const live = await db
    .select({ id: products.id, stock: products.stock })
    .from(products)
    .where(inArray(products.id, ids));
  for (const l of cart.lines) {
    const row = live.find((x) => x.id === l.productId);
    if (!row || row.stock < l.quantity) {
      return NextResponse.json(
        { error: `Insufficient stock for ${l.name}` },
        { status: 400 }
      );
    }
  }

  // Upsert customer
  let customerId: number;
  const [existingCustomer] = await db
    .select()
    .from(customers)
    .where(eq(customers.email, email));
  if (existingCustomer) {
    customerId = existingCustomer.id;
  } else {
    const [newCust] = await db
      .insert(customers)
      .values({
        orgId: DEMO_ORG_ID,
        email,
        firstName,
        lastName,
        city: addr.city,
        state: addr.state,
        country: addr.country || "US",
      })
      .returning({ id: customers.id });
    customerId = newCust.id;
  }

  // Re-resolve discount server-side
  let discountAmount = 0;
  let shipping = 9.99;
  if (cart.discountCode) {
    const d = await resolveDiscount(cart.discountCode, cart.subtotal);
    if (d) {
      if (d.type === "percentage")
        discountAmount = +((cart.subtotal * Number(d.value)) / 100).toFixed(2);
      else if (d.type === "fixed_amount")
        discountAmount = Math.min(cart.subtotal, Number(d.value));
      else if (d.type === "free_shipping") shipping = 0;
      await db
        .update(discounts)
        .set({ usageCount: sql`${discounts.usageCount} + 1` })
        .where(eq(discounts.id, d.id));
    }
  }
  const taxable = Math.max(0, cart.subtotal - discountAmount);
  const tax = +(taxable * 0.08).toFixed(2);
  const total = +(taxable + tax + shipping).toFixed(2);
  const num = orderNumber();

  const [created] = await db
    .insert(orders)
    .values({
      orgId: DEMO_ORG_ID,
      orderNumber: num,
      customerId,
      status: "confirmed",
      subtotal: cart.subtotal.toFixed(2),
      tax: tax.toFixed(2),
      shippingCost: shipping.toFixed(2),
      discount: discountAmount.toFixed(2),
      total: total.toFixed(2),
      shippingAddress: addr,
    })
    .returning({ id: orders.id });

  await db.insert(orderItems).values(
    cart.lines.map((l) => ({
      orderId: created.id,
      productId: l.productId,
      productName: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice.toFixed(2),
      totalPrice: l.lineTotal.toFixed(2),
    }))
  );

  // Decrement stock + log adjustments
  for (const l of cart.lines) {
    await db
      .update(products)
      .set({ stock: sql`${products.stock} - ${l.quantity}` })
      .where(eq(products.id, l.productId));
    await db.insert(inventoryAdjustments).values({
      productId: l.productId,
      delta: -l.quantity,
      reason: `Order ${num}`,
      actor: "storefront",
    });
  }

  // Update customer totals
  await db
    .update(customers)
    .set({
      totalOrders: sql`${customers.totalOrders} + 1`,
      totalSpent: sql`${customers.totalSpent} + ${total}`,
    })
    .where(eq(customers.id, customerId));

  // Emit purchase analytics event
  try {
    await db.insert(analyticsEvents).values({
      eventType: "purchase",
      customerId,
      orderId: created.id,
      properties: { total, itemCount: cart.itemCount },
    });
  } catch {}

  // Clear cart
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
  await db
    .update(carts)
    .set({ discountCode: null })
    .where(eq(carts.id, cartId));

  (await cookies()).set("sp_last_order", num, { maxAge: 60 * 60 * 24, path: "/" });

  return NextResponse.json({ ok: true, orderNumber: num });
}
