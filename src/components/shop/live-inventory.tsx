"use client";

import { useEffect } from "react";

// Subscribes to an SSE stream with stock updates and patches the DOM.
export function LiveInventory({ productIds }: { productIds: number[] }) {
  useEffect(() => {
    if (productIds.length === 0) return;
    const qs = `ids=${productIds.join(",")}`;
    const es = new EventSource(`/api/shop/stream?${qs}`);
    es.addEventListener("stock", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as Array<{ id: number; stock: number }>;
        for (const row of data) {
          const el = document.querySelector(
            `[data-live-stock="${row.id}"]`
          ) as HTMLElement | null;
          if (!el) continue;
          if (row.stock <= 0) {
            el.textContent = "Sold out";
            el.className = el.className
              .replace(/bg-[a-z-]+(?=\/|\s|$)/g, "")
              .trim();
            el.classList.add("bg-gray-500", "text-white");
          } else if (row.stock <= 5) {
            el.textContent = `Only ${row.stock} left`;
            el.classList.remove("bg-emerald-500/90", "bg-gray-500");
            el.classList.add("bg-amber-500", "text-white");
          } else {
            el.textContent = "In stock";
            el.classList.remove("bg-amber-500", "bg-gray-500");
            el.classList.add("bg-emerald-500/90", "text-white");
          }
        }
      } catch {}
    });
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }, [productIds]);
  return null;
}
