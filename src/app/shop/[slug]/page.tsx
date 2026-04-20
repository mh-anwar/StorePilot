import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { products, reviews } from "@/lib/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { DEMO_ORG_ID } from "@/lib/tenant";
import { PDPActions } from "@/components/shop/pdp-actions";
import { LiveInventory } from "@/components/shop/live-inventory";
import { ReviewsSection } from "@/components/shop/reviews-section";

export const dynamic = "force-dynamic";

export default async function PDP({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [p] = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.orgId, DEMO_ORG_ID)));
  if (!p) notFound();

  const related = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.orgId, DEMO_ORG_ID),
        eq(products.category, p.category),
        ne(products.id, p.id)
      )
    )
    .limit(4);

  const productReviews = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.productId, p.id), eq(reviews.status, "approved")))
    .orderBy(desc(reviews.createdAt))
    .limit(10);

  const avgRating =
    productReviews.length > 0
      ? productReviews.reduce((a, r) => a + r.rating, 0) / productReviews.length
      : 0;

  const price = parseFloat(p.price);
  const compare = p.compareAtPrice ? parseFloat(p.compareAtPrice) : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <nav className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
        <Link href="/shop">Shop</Link>
        <span>/</span>
        <Link href={`/shop?category=${encodeURIComponent(p.category)}`}>
          {p.category}
        </Link>
        <span>/</span>
        <span className="text-foreground">{p.name}</span>
      </nav>

      <LiveInventory productIds={[p.id]} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="aspect-square bg-muted rounded-2xl overflow-hidden">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageUrl}
              alt={p.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No image
            </div>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {p.vendor}
          </p>
          <h1 className="text-3xl font-bold mt-1">{p.name}</h1>
          {avgRating > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              ★ {avgRating.toFixed(1)} · {productReviews.length} review
              {productReviews.length === 1 ? "" : "s"}
            </p>
          )}
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-2xl font-semibold">${price.toFixed(2)}</span>
            {compare && compare > price && (
              <span className="text-lg text-muted-foreground line-through">
                ${compare.toFixed(2)}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-5 leading-relaxed whitespace-pre-line">
            {p.description || "No description available."}
          </p>
          <div className="mt-6">
            <span
              data-live-stock={p.id}
              className={`inline-block px-2 py-1 rounded-md text-[11px] font-medium ${
                p.stock <= 0
                  ? "bg-gray-500 text-white"
                  : p.stock <= 5
                    ? "bg-amber-500 text-white"
                    : "bg-emerald-500/90 text-white"
              }`}
            >
              {p.stock <= 0
                ? "Sold out"
                : p.stock <= 5
                  ? `Only ${p.stock} left`
                  : "In stock"}
            </span>
          </div>
          <PDPActions productId={p.id} maxStock={p.stock} />
          {p.tags && p.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {p.tags.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <ReviewsSection productId={p.id} reviews={productReviews} />

      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="text-lg font-semibold mb-4">You might also like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/shop/${r.slug}`}
                className="group rounded-xl border border-border overflow-hidden"
              >
                <div className="aspect-square bg-muted overflow-hidden">
                  {r.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.imageUrl}
                      alt={r.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium line-clamp-1">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ${parseFloat(r.price).toFixed(2)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
