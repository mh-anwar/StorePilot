import Link from "next/link";
import { loadCart } from "@/lib/cart";
import { CartView } from "@/components/shop/cart-view";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const cart = await loadCart();
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-6">Your cart</h1>
      {cart.lines.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-muted-foreground mb-4">Your cart is empty.</p>
          <Link
            href="/shop"
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <CartView initialCart={cart} />
      )}
    </div>
  );
}
