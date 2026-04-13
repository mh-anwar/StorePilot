"use client";

import { useState, useTransition } from "react";
import { Loader2, ShoppingBag, Check } from "lucide-react";
import { useRouter } from "next/navigation";

export function PDPActions({
  productId,
  maxStock,
}: {
  productId: number;
  maxStock: number;
}) {
  const [qty, setQty] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const router = useRouter();

  function onAdd() {
    startTransition(async () => {
      const r = await fetch("/api/shop/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: qty }),
      });
      if (r.ok) {
        setAdded(true);
        setTimeout(() => setAdded(false), 1800);
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-5 flex items-center gap-3">
      <div className="inline-flex items-center border border-border rounded-lg">
        <button
          onClick={() => setQty((n) => Math.max(1, n - 1))}
          className="px-3 py-2 hover:bg-muted"
        >
          −
        </button>
        <span className="px-4 py-2 text-sm font-medium">{qty}</span>
        <button
          onClick={() => setQty((n) => Math.min(maxStock, n + 1))}
          className="px-3 py-2 hover:bg-muted"
        >
          +
        </button>
      </div>
      <button
        disabled={isPending || maxStock <= 0}
        onClick={onAdd}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-foreground text-background font-medium text-sm disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : added ? (
          <>
            <Check className="h-4 w-4" />
            Added to cart
          </>
        ) : (
          <>
            <ShoppingBag className="h-4 w-4" />
            Add to cart
          </>
        )}
      </button>
    </div>
  );
}
