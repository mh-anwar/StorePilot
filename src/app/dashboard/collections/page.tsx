import { db } from "@/lib/db";
import { collections, products, productCollections } from "@/lib/db/schema";
import { desc, eq, asc } from "drizzle-orm";
import { CollectionsAdmin } from "@/components/dashboard/collections-admin";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const rows = await db.select().from(collections).orderBy(asc(collections.sortOrder), desc(collections.createdAt));
  const counts = await db
    .select({
      collectionId: productCollections.collectionId,
      count: products.id,
    })
    .from(productCollections);
  const map = new Map<number, number>();
  for (const c of counts) map.set(c.collectionId, (map.get(c.collectionId) || 0) + 1);

  const allProducts = await db
    .select({ id: products.id, name: products.name, slug: products.slug })
    .from(products)
    .orderBy(products.name);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Collections</h1>
        <p className="text-muted-foreground text-sm">
          Curate products into themed groups
        </p>
      </div>
      <CollectionsAdmin
        initial={rows.map((c) => ({
          ...c,
          productCount: map.get(c.id) ?? 0,
          createdAt: c.createdAt.toISOString(),
        }))}
        products={allProducts}
      />
    </div>
  );
}
