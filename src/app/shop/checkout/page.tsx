import Link from "next/link";
import { loadCart } from "@/lib/cart";
import { CheckoutForm } from "@/components/shop/checkout-form";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const cart = await loadCart();
  if (cart.lines.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <p className="text-muted-foreground mb-4">Your cart is empty.</p>
        <Link
          href="/shop"
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm"
        >
          Browse products
        </Link>
      </div>
    );
  }
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <CheckoutForm cart={cart} />
        <div className="border border-border rounded-xl p-5 h-fit">
          <h2 className="font-semibold mb-3">Order summary</h2>
          <div className="space-y-3">
            {cart.lines.map((l) => (
              <div key={l.itemId} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {l.name} × {l.quantity}
                </span>
                <span>${l.lineTotal.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border mt-4 pt-3 space-y-1 text-sm">
            <Row label="Subtotal" value={`$${cart.subtotal.toFixed(2)}`} />
            {cart.discountAmount > 0 && (
              <Row
                label={`Discount (${cart.discountCode})`}
                value={`-$${cart.discountAmount.toFixed(2)}`}
              />
            )}
            <Row label="Shipping" value={`$${cart.shipping.toFixed(2)}`} />
            <Row label="Tax" value={`$${cart.tax.toFixed(2)}`} />
            <div className="border-t border-border pt-2 mt-2 flex justify-between font-semibold text-base">
              <span>Total</span>
              <span>${cart.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
