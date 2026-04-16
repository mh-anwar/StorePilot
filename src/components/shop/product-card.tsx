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
      className="group bg-white border border-[#1a1a1a]/10 overflow-hidden flex flex-col"
    >
      <Link href={`/shop/${product.slug}`} className="block">
        <div className="aspect-square bg-[#f0ece5] relative overflow-hidden">
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
            <span className="absolute top-3 left-3 px-2 py-0.5 bg-[#b54a23] text-white text-[10px] font-mono uppercase tracking-wider">
              Sale
            </span>
          )}
          <span
            data-live-stock={product.id}
            className={`absolute top-3 right-3 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
              product.stock <= 0
                ? "bg-[#1a1a1a] text-white"
                : product.stock <= 5
                  ? "bg-[#b54a23] text-white"
                  : "bg-white/90 text-[#1a1a1a]"
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
      <div className="p-4 flex-1 flex flex-col">
        <Link href={`/shop/${product.slug}`}>
          <p className="text-[10px] font-mono uppercase tracking-wider text-[#1a1a1a]/50">
            {product.category}
          </p>
          <h3 className="font-serif text-lg leading-tight mt-0.5 line-clamp-1">
            {product.name}
          </h3>
        </Link>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-medium">${price.toFixed(2)}</span>
          {onSale && (
            <span className="text-xs text-[#1a1a1a]/50 line-through">
              ${compare!.toFixed(2)}
            </span>
          )}
        </div>
        <button
          onClick={addToCart}
          disabled={isPending || product.stock <= 0}
          className="mt-3 flex items-center justify-center gap-2 text-xs uppercase tracking-wider font-mono py-2.5 bg-[#1a1a1a] text-[#faf7f2] disabled:opacity-40 hover:bg-[#b54a23] transition-colors"
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
