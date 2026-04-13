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
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {category || "All products"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rows.length} items · live stock updates
          </p>
        </div>
        <form className="flex gap-2">
          {category && <input type="hidden" name="category" value={category} />}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search products"
            className="px-3 py-2 rounded-lg bg-muted text-sm w-56 border border-border"
          />
          <select
            name="sort"
            defaultValue={sort ?? "new"}
            className="px-3 py-2 rounded-lg bg-muted text-sm border border-border"
          >
            <option value="new">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm"
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
