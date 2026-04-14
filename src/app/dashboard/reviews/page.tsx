import { db } from "@/lib/db";
import { reviews, products } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { ReviewsAdmin } from "@/components/dashboard/reviews-admin";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
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
