"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState, useTransition } from "react";
import { Loader2, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";

type Product = {
  id: number;
  name: string;
  slug: string;
  price: string;
  compareAtPrice: string | null;
  imageUrl: string | null;
  stock: number;
  category: string;
};

export function ProductCard({ product }: { product: Product }) {
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const router = useRouter();

  async function addToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const r = await fetch("/api/shop/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      if (r.ok) {
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
        router.refresh();
      }
    });
  }

  const price = parseFloat(product.price);
  const compare = product.compareAtPrice
    ? parseFloat(product.compareAtPrice)
    : null;
  const onSale = compare && compare > price;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="group rounded-xl border border-border bg-card overflow-hidden flex flex-col"
    >
      <Link href={`/shop/${product.slug}`} className="block">
        <div className="aspect-square bg-gradient-to-br from-violet-500/10 via-transparent to-cyan-500/10 relative overflow-hidden">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              {product.category}
            </div>
          )}
          {onSale && (
            <span className="absolute top-2 left-2 px-2 py-1 rounded-md bg-red-500 text-white text-[10px] font-semibold">
              SALE
            </span>
          )}
          <span
            data-live-stock={product.id}
            className={`absolute top-2 right-2 px-2 py-1 rounded-md text-[10px] font-medium ${
              product.stock <= 0
                ? "bg-gray-500 text-white"
                : product.stock <= 5
                  ? "bg-amber-500 text-white"
                  : "bg-emerald-500/90 text-white"
            }`}
          >
            {product.stock <= 0
              ? "Sold out"
              : product.stock <= 5
                ? `Only ${product.stock} left`
                : "In stock"}
          </span>
        </div>
      </Link>
      <div className="p-3 flex-1 flex flex-col">
        <Link href={`/shop/${product.slug}`}>
          <h3 className="font-medium text-sm line-clamp-1 group-hover:text-violet-400 transition-colors">
            {product.name}
          </h3>
        </Link>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-semibold">${price.toFixed(2)}</span>
          {onSale && (
            <span className="text-xs text-muted-foreground line-through">
              ${compare!.toFixed(2)}
            </span>
          )}
        </div>
        <button
          onClick={addToCart}
          disabled={isPending || product.stock <= 0}
          className="mt-3 flex items-center justify-center gap-2 text-xs font-medium py-2 rounded-lg bg-foreground text-background disabled:opacity-50 hover:opacity-90 transition"
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : added ? (
            "Added!"
          ) : (
            <>
              <ShoppingBag className="h-3 w-3" />
              Add to cart
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
