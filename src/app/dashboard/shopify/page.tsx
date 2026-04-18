import Link from "next/link";
import { db } from "@/lib/db";
import { shops } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/tenant";
import { ConnectShopify } from "@/components/dashboard/connect-shopify";
import { isConfigured } from "@/lib/shopify/config";

export const dynamic = "force-dynamic";

export default async function ShopifyPage() {
  const session = await getSession();
  const orgId = session?.activeOrgId;

  let connected: Array<{
    id: string;
    shopDomain: string;
    status: string;
    installedAt: Date | null;
    lastSyncedAt: Date | null;
  }> = [];
  if (orgId) {
    connected = await db
      .select({
        id: shops.id,
        shopDomain: shops.shopDomain,
        status: shops.status,
        installedAt: shops.installedAt,
        lastSyncedAt: shops.lastSyncedAt,
      })
      .from(shops)
      .where(eq(shops.orgId, orgId))
      .orderBy(desc(shops.createdAt));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Shopify</h1>
        <p className="text-muted-foreground text-sm">
          Connect a Shopify store to sync products, orders and customers.
          StorePilot agents will operate on real data.
        </p>
      </div>

      {!session && (
        <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-xl text-sm">
          You need an account to connect a shop.{" "}
          <Link href="/signup" className="underline">
            Sign up
          </Link>{" "}
          or{" "}
          <Link href="/login" className="underline">
            sign in
          </Link>
          .
        </div>
      )}

      {!isConfigured() && (
        <div className="p-4 border border-border bg-muted/20 rounded-xl text-sm">
          Shopify app credentials aren&apos;t set yet. Add{" "}
          <code className="font-mono">SHOPIFY_API_KEY</code>,{" "}
          <code className="font-mono">SHOPIFY_API_SECRET</code>, and{" "}
          <code className="font-mono">APP_URL</code> to the environment.
        </div>
      )}

      {session && <ConnectShopify />}

      {connected.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">Connected stores</h2>
          <div className="space-y-3">
            {connected.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/shopify/${s.id}`}
                className="block border border-border rounded-xl p-4 hover:bg-muted/20"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{s.shopDomain}</p>
                    <p className="text-xs text-muted-foreground">
                      installed{" "}
                      {s.installedAt
                        ? new Date(s.installedAt).toLocaleDateString()
                        : "—"}
                      {s.lastSyncedAt
                        ? ` · last sync ${new Date(s.lastSyncedAt).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      s.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : s.status === "uninstalled"
                          ? "bg-muted text-muted-foreground"
                          : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
