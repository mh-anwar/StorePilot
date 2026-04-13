"use client";

import { useState, useTransition } from "react";
import type { CartSummary } from "@/lib/cart";
import { Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function CartView({ initialCart }: { initialCart: CartSummary }) {
  const [cart, setCart] = useState(initialCart);
  const [code, setCode] = useState(cart.discountCode ?? "");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function setQty(itemId: number, qty: number) {
    startTransition(async () => {
      const r = await fetch("/api/shop/cart/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, quantity: qty }),
      });
      const j = await r.json();
      if (j.cart) setCart(j.cart);
      router.refresh();
    });
  }

  function remove(itemId: number) {
    startTransition(async () => {
      const r = await fetch(`/api/shop/cart/items?itemId=${itemId}`, {
        method: "DELETE",
      });
      const j = await r.json();
      if (j.cart) setCart(j.cart);
      router.refresh();
    });
  }

  function applyCode() {
    setCodeError(null);
    startTransition(async () => {
      const r = await fetch("/api/shop/cart/discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await r.json();
      if (!r.ok) setCodeError(j.error || "Invalid code");
      if (j.cart) setCart(j.cart);
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-3">
        {cart.lines.map((l) => (
          <div
            key={l.itemId}
            className="flex gap-4 p-4 border border-border rounded-xl"
          >
            <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden flex-shrink-0">
              {l.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.imageUrl} alt={l.name} className="w-full h-full object-cover" />
              ) : null}
            </div>
            <div className="flex-1 min-w-0">
              <Link
                href={`/shop/${l.slug}`}
                className="font-medium hover:underline line-clamp-1"
              >
                {l.name}
              </Link>
              <p className="text-sm text-muted-foreground">
                ${l.unitPrice.toFixed(2)}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div className="inline-flex items-center border border-border rounded-lg">
                  <button
                    onClick={() => setQty(l.itemId, Math.max(0, l.quantity - 1))}
                    className="px-2 py-1 text-sm hover:bg-muted"
                  >
                    −
                  </button>
                  <span className="px-3 py-1 text-sm">{l.quantity}</span>
                  <button
                    onClick={() =>
                      setQty(l.itemId, Math.min(l.stock, l.quantity + 1))
                    }
                    className="px-2 py-1 text-sm hover:bg-muted"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => remove(l.itemId)}
                  className="text-xs text-muted-foreground hover:text-red-400 inline-flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </div>
            </div>
            <div className="font-semibold">${l.lineTotal.toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-xl p-5 h-fit sticky top-20">
        <h2 className="font-semibold mb-4">Summary</h2>
        <div className="space-y-2 text-sm">
          <Row label="Subtotal" value={`$${cart.subtotal.toFixed(2)}`} />
          {cart.discountAmount > 0 && (
            <Row
              label={`Discount (${cart.discountCode})`}
              value={`-$${cart.discountAmount.toFixed(2)}`}
              highlight
            />
          )}
          <Row label="Shipping" value={`$${cart.shipping.toFixed(2)}`} />
          <Row label="Tax" value={`$${cart.tax.toFixed(2)}`} />
          <div className="border-t border-border pt-2 mt-2 flex justify-between font-semibold text-base">
            <span>Total</span>
            <span>${cart.total.toFixed(2)}</span>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Discount code"
              className="flex-1 px-3 py-2 rounded-lg bg-muted text-sm border border-border"
            />
            <button
              onClick={applyCode}
              disabled={isPending}
              className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              Apply
            </button>
          </div>
          {codeError && (
            <p className="text-xs text-red-400 mt-1">{codeError}</p>
          )}
        </div>
        <Link
          href="/shop/checkout"
          className="mt-5 flex items-center justify-center gap-2 py-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Checkout
        </Link>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "text-emerald-400" : ""}>{value}</span>
    </div>
  );
}
