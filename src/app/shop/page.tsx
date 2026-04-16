import Link from "next/link";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import { ProductCard } from "@/components/shop/product-card";
import { LiveInventory } from "@/components/shop/live-inventory";

export const dynamic = "force-dynamic";

type SP = Promise<{ category?: string; q?: string; sort?: string }>;

export default async function ShopPage({ searchParams }: { searchParams: SP }) {
  const { category, q, sort } = await searchParams;

  const conds = [eq(products.status, "active" as const)];
  if (category) conds.push(eq(products.category, category));
  if (q)
    conds.push(
      or(ilike(products.name, `%${q}%`), ilike(products.description, `%${q}%`))!
    );

  const orderBy =
    sort === "price_asc"
      ? products.price
      : sort === "price_desc"
        ? desc(products.price)
        : desc(products.createdAt);

  const rows = await db
    .select()
    .from(products)
    .where(and(...conds))
    .orderBy(orderBy)
    .limit(48);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-10 flex items-end justify-between gap-4 flex-wrap border-b border-[#1a1a1a]/10 pb-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/60">
            {q ? `search: "${q}"` : "shop"}
          </p>
          <h1 className="font-serif text-4xl md:text-5xl tracking-tight mt-2">
            {category || "Everything"}
          </h1>
          <p className="text-sm text-[#1a1a1a]/60 mt-2">
            {rows.length} items · stock updates live as shoppers check out
          </p>
        </div>
        <form className="flex gap-2">
          {category && <input type="hidden" name="category" value={category} />}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search"
            className="px-3 py-2 rounded-full bg-white border border-[#1a1a1a]/20 text-sm w-56"
          />
          <select
            name="sort"
            defaultValue={sort ?? "new"}
            className="px-3 py-2 rounded-full bg-white border border-[#1a1a1a]/20 text-sm"
          >
            <option value="new">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 rounded-full bg-[#1a1a1a] text-[#faf7f2] text-sm"
          >
            Apply
          </button>
        </form>
      </div>

      <LiveInventory productIds={rows.map((r) => r.id)} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {rows.map((p) => (
          <ProductCard
            key={p.id}
            product={{
              id: p.id,
              name: p.name,
              slug: p.slug,
              price: p.price,
              compareAtPrice: p.compareAtPrice,
              imageUrl: p.imageUrl,
              stock: p.stock,
              category: p.category,
            }}
          />
        ))}
      </div>
      {rows.length === 0 && (
        <div className="py-24 text-center text-muted-foreground text-sm">
          No products found. <Link href="/shop" className="underline">Clear filters</Link>
        </div>
      )}
    </div>
  );
}
