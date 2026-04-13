import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { db } from "./db";
import { carts, cartItems, products, discounts } from "./db/schema";
import { eq, and, gte, lte, or, isNull } from "drizzle-orm";

export const CART_COOKIE = "sp_cart";

export async function getOrCreateCartId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(CART_COOKIE)?.value;
  if (existing) return existing;
  const id = nanoid();
  jar.set(CART_COOKIE, id, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  try {
    await db.insert(carts).values({ id }).onConflictDoNothing();
  } catch {}
  return id;
}

export async function getCartIdOptional(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(CART_COOKIE)?.value ?? null;
}

export type CartLine = {
  itemId: number;
  productId: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stock: number;
};

export type CartSummary = {
  id: string | null;
  lines: CartLine[];
  subtotal: number;
  discountCode: string | null;
  discountAmount: number;
  shipping: number;
  tax: number;
  total: number;
  itemCount: number;
};

const EMPTY: CartSummary = {
  id: null,
  lines: [],
  subtotal: 0,
  discountCode: null,
  discountAmount: 0,
  shipping: 0,
  tax: 0,
  total: 0,
  itemCount: 0,
};

export async function loadCart(): Promise<CartSummary> {
  const id = await getCartIdOptional();
  if (!id) return EMPTY;
  try {
    const [cart] = await db.select().from(carts).where(eq(carts.id, id));
    if (!cart) return { ...EMPTY, id };

    const rows = await db
      .select({
        itemId: cartItems.id,
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        name: products.name,
        slug: products.slug,
        imageUrl: products.imageUrl,
        price: products.price,
        stock: products.stock,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.cartId, id));

    const lines: CartLine[] = rows.map((r) => {
      const unit = parseFloat(r.price);
      return {
        itemId: r.itemId,
        productId: r.productId,
        name: r.name,
        slug: r.slug,
        imageUrl: r.imageUrl,
        unitPrice: unit,
        quantity: r.quantity,
        lineTotal: +(unit * r.quantity).toFixed(2),
        stock: r.stock,
      };
    });

    const subtotal = +lines.reduce((a, l) => a + l.lineTotal, 0).toFixed(2);

    let discountAmount = 0;
    let shipping = subtotal > 0 ? 9.99 : 0;
    const code = cart.discountCode;
    if (code) {
      const d = await resolveDiscount(code, subtotal);
      if (d) {
        if (d.type === "percentage")
          discountAmount = +((subtotal * Number(d.value)) / 100).toFixed(2);
        else if (d.type === "fixed_amount")
          discountAmount = Math.min(subtotal, Number(d.value));
        else if (d.type === "free_shipping") shipping = 0;
      }
    }

    const taxable = Math.max(0, subtotal - discountAmount);
    const tax = +(taxable * 0.08).toFixed(2);
    const total = +(taxable + tax + shipping).toFixed(2);
    const itemCount = lines.reduce((a, l) => a + l.quantity, 0);

    return {
      id,
      lines,
      subtotal,
      discountCode: code ?? null,
      discountAmount,
      shipping,
      tax,
      total,
      itemCount,
    };
  } catch {
    return { ...EMPTY, id };
  }
}

export async function resolveDiscount(code: string, subtotal: number) {
  const now = new Date();
  const [d] = await db
    .select()
    .from(discounts)
    .where(
      and(
        eq(discounts.code, code.toUpperCase()),
        eq(discounts.active, true),
        or(isNull(discounts.startsAt), lte(discounts.startsAt, now)),
        or(isNull(discounts.endsAt), gte(discounts.endsAt, now))
      )
    );
  if (!d) return null;
  if (d.minSubtotal && subtotal < Number(d.minSubtotal)) return null;
  if (d.usageLimit && d.usageCount >= d.usageLimit) return null;
  return d;
}
