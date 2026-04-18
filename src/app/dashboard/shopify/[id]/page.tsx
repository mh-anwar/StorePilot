import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  shops,
  products,
  orders,
  customers,
  webhookEvents,
} from "@/lib/db/schema";
import { eq, count, desc } from "drizzle-orm";
import { SyncButton } from "@/components/dashboard/sync-button";

export const dynamic = "force-dynamic";

export default async function ShopDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ installed?: string }>;
}) {
  const { id } = await params;
  const { installed } = await searchParams;
  const [s] = await db.select().from(shops).where(eq(shops.id, id));
  if (!s) notFound();

  const [productCount] = await db
    .select({ c: count() })
    .from(products)
    .where(eq(products.shopId, s.id));
  const [orderCount] = await db
    .select({ c: count() })
    .from(orders)
    .where(eq(orders.shopId, s.id));
  const [customerCount] = await db
    .select({ c: count() })
    .from(customers)
    .where(eq(customers.shopId, s.id));
  const recentWebhooks = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.shopId, s.id))
    .orderBy(desc(webhookEvents.receivedAt))
    .limit(15);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/shopify"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Back to Shopify
        </Link>
        <h1 className="text-2xl font-bold mt-2">{s.shopDomain}</h1>
        <p className="text-sm text-muted-foreground">
          Status:{" "}
          <span
            className={
              s.status === "active"
                ? "text-emerald-400"
                : "text-muted-foreground"
            }
          >
            {s.status}
          </span>
          {s.lastSyncedAt
            ? ` · last sync ${new Date(s.lastSyncedAt).toLocaleString()}`
            : " · not synced yet"}
        </p>
      </div>

      {installed === "1" && (
        <div className="p-3 border border-emerald-500/30 bg-emerald-500/5 rounded-xl text-sm">
          Store connected. Kick off an initial sync below.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Products" value={productCount.c} />
        <Stat label="Orders" value={orderCount.c} />
        <Stat label="Customers" value={customerCount.c} />
      </div>

      <div className="border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-3">Sync</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Pull products, customers and orders from Shopify into StorePilot.
          You can re-run this any time — data is upserted by Shopify GID so
          records stay in one place.
        </p>
        <SyncButton shopId={s.id} />
      </div>

      <div>
        <h2 className="font-semibold mb-3">Recent webhooks</h2>
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2">Topic</th>
                <th className="text-left px-4 py-2">Received</th>
                <th className="text-left px-4 py-2">Processed</th>
                <th className="text-left px-4 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {recentWebhooks.map((w) => (
                <tr key={w.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{w.topic}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(w.receivedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {w.processedAt
                      ? new Date(w.processedAt).toLocaleTimeString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-red-400 text-xs">
                    {w.error ?? ""}
                  </td>
                </tr>
              ))}
              {recentWebhooks.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No webhooks received yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
    </div>
  );
}
