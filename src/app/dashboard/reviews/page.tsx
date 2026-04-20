import { db } from "@/lib/db";
import { reviews, products } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { ReviewsAdmin } from "@/components/dashboard/reviews-admin";
import { getCurrentOrgId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const orgId = await getCurrentOrgId();
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      authorName: reviews.authorName,
      status: reviews.status,
      createdAt: reviews.createdAt,
      productName: products.name,
      productSlug: products.slug,
      productId: products.id,
    })
    .from(reviews)
    .innerJoin(products, eq(reviews.productId, products.id))
    .where(and(eq(reviews.orgId, orgId), eq(products.orgId, orgId)))
    .orderBy(desc(reviews.createdAt))
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reviews</h1>
        <p className="text-muted-foreground text-sm">
          Moderate customer reviews — approve, reject, or delete
        </p>
      </div>
      <ReviewsAdmin
        initial={rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
